import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEmptyStore, applyPredictionSnapshot, applyActuals, getReport } from './lib/backtestStore.js';
import { createEmptyHistory, recordGwSnapshot, getPlayerHistory } from './lib/rotationHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const PERSIST_DIR = process.env.FFH_PERSIST_DIR || (fs.existsSync('/data') ? '/data' : __dirname);

// Resolves a persistent-storage filename against PERSIST_DIR, probing with a
// throwaway write to confirm the directory is actually writable (e.g. a
// read-only filesystem in some deployment environments) and falling back to
// /tmp when it isn't.
function resolvePersistentFile(filename) {
    const primary = path.join(PERSIST_DIR, filename);
    try {
        fs.writeFileSync(primary + '.test', 'ok');
        fs.unlinkSync(primary + '.test');
        return primary;
    } catch (e) {
        return path.join('/tmp', filename);
    }
}

const STORAGE_FILE = resolvePersistentFile('cloud_drafts_store.json');
const BACKTEST_STORE_FILE = resolvePersistentFile('backtest_log.json');
const RETRO_REPORT_FILE = resolvePersistentFile('retro_backtest_report.json');
const ROTATION_HISTORY_FILE = resolvePersistentFile('rotation_history.json');

// In-memory cache
let cloudDraftsStore = {};

// Solio Projections cache
let solioCache = null;
let solioCacheTime = 0;

// Load existing store from disk if present
if (fs.existsSync(STORAGE_FILE)) {
    try {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        cloudDraftsStore = JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load cloud_drafts_store.json:', e);
        cloudDraftsStore = {};
    }
}

function saveStoreToDisk() {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(cloudDraftsStore, null, 2));
    } catch (e) {
        console.warn('Ephemeral storage note: saved in memory, disk write skipped:', e.message);
    }
}

let backtestStore = createEmptyStore();
if (fs.existsSync(BACKTEST_STORE_FILE)) {
    try {
        backtestStore = JSON.parse(fs.readFileSync(BACKTEST_STORE_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to load backtest_log.json:', e);
    }
}

function saveBacktestStore() {
    try {
        fs.writeFileSync(BACKTEST_STORE_FILE, JSON.stringify(backtestStore, null, 2));
    } catch (e) {
        console.warn('Backtest store write skipped:', e.message);
    }
}

let rotationHistory = createEmptyHistory();
if (fs.existsSync(ROTATION_HISTORY_FILE)) {
    try {
        rotationHistory = JSON.parse(fs.readFileSync(ROTATION_HISTORY_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to load rotation_history.json:', e);
    }
}

function saveRotationHistory() {
    try {
        fs.writeFileSync(ROTATION_HISTORY_FILE, JSON.stringify(rotationHistory, null, 2));
    } catch (e) {
        console.warn('Rotation history write skipped:', e.message);
    }
}

// Validates the shape of an incoming rotation-snapshot `players` array at the
// HTTP boundary (separate from `validatePlayersPayload` above, which expects
// an `id`/`pts`-shaped payload for the backtest routes rather than the
// `code`/`team`/`position`/`minutesThisGw` shape rotation snapshots use).
function validateRotationPlayersPayload(players) {
    if (!Array.isArray(players)) return 'players must be an array';
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p || typeof p !== 'object') {
            return `players[${i}] is not an object`;
        }
        if (typeof p.code !== 'number' || Number.isNaN(p.code)) {
            return `players[${i}] has a non-numeric code`;
        }
        if (typeof p.team !== 'string') {
            return `players[${i}] is missing a string team`;
        }
        if (typeof p.position !== 'string') {
            return `players[${i}] is missing a string position`;
        }
        if (typeof p.minutesThisGw !== 'number' || Number.isNaN(p.minutesThisGw)) {
            return `players[${i}] has a non-numeric minutesThisGw`;
        }
    }
    return null;
}

// Validates the shape of an incoming `players` array at the HTTP boundary.
// `extraNumericField` (e.g. 'pts' or 'actualPts') is checked in addition to
// `id` when provided. Returns null if valid, or a string error message.
function validatePlayersPayload(players, extraNumericField) {
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p || typeof p !== 'object' || typeof p.id !== 'number' || Number.isNaN(p.id)) {
            return `players[${i}] is missing a numeric id`;
        }
        if (extraNumericField && (typeof p[extraNumericField] !== 'number' || Number.isNaN(p[extraNumericField]))) {
            return `players[${i}] is missing a numeric ${extraNumericField}`;
        }
    }
    return null;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // Health Check endpoint for Railway monitoring
    if (pathname === '/health' || pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));
        return;
    }

    // API Route: Fetch live Solio Analytics points projections with cache proxy
    if (pathname === '/api/solio-projections') {
        const now = Date.now();
        // 10-minute cache expiration
        if (solioCache && (now - solioCacheTime < 10 * 60 * 1000)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: solioCache }));
            return;
        }

        try {
            const response = await fetch('https://fpl.solioanalytics.com/api/data/latest.json');
            if (response.ok) {
                const data = await response.json();
                solioCache = data;
                solioCacheTime = now;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: data }));
            } else {
                throw new Error(`Solio API returned status: ${response.status}`);
            }
        } catch (e) {
            console.error('Failed to fetch Solio projections:', e);
            if (solioCache) {
                // Return stale cache if remote fetch fails
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: solioCache, fallback: true }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        }
        return;
    }

    // API Route: Fetch live actual points from FPL for a gameweek
    if (pathname === '/api/live-points') {
        const gw = reqUrl.searchParams.get('gw');
        if (!gw || isNaN(parseInt(gw))) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing or invalid gw parameter' }));
            return;
        }

        try {
            const fplRes = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (fplRes.ok) {
                const data = await fplRes.json();
                const pointsMap = {};
                if (data && Array.isArray(data.elements)) {
                    data.elements.forEach(el => {
                        pointsMap[el.id] = el.stats.total_points;
                    });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, gw: parseInt(gw), points: pointsMap }));
            } else {
                throw new Error(`FPL API returned status: ${fplRes.status}`);
            }
        } catch (e) {
            console.error(`Failed to fetch live points for GW${gw}:`, e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    // API Route: Fetch live FPL picks for a team ID with fallback scanning downwards
    if (pathname === '/api/fpl-picks') {
        const teamId = reqUrl.searchParams.get('teamId');
        let gw = parseInt(reqUrl.searchParams.get('gw')) || 1;
        if (!teamId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing teamId parameter' }));
            return;
        }

        let data = null;
        let success = false;
        let resolvedGw = gw;
        let teamName = null;
        let entryExists = false;

        // Fetch team entry info to get team name
        try {
            const entryUrl = `https://fantasy.premierleague.com/api/entry/${teamId}/`;
            const entryRes = await fetch(entryUrl);
            if (entryRes.ok) {
                entryExists = true;
                const entryData = await entryRes.json();
                teamName = entryData.name || null;
            } else if (entryRes.status === 404) {
                entryExists = false;
            } else {
                entryExists = true;
            }
        } catch (e) {
            console.error('Failed to fetch team entry info:', e);
            entryExists = true; // fallback
        }

        // FPL API returns 404 for future gameweeks. Try to find the latest active picks by looping down.
        for (let g = gw; g >= 1; g--) {
            try {
                const url = `https://fantasy.premierleague.com/api/entry/${teamId}/event/${g}/picks/`;
                const response = await fetch(url);
                if (response.ok) {
                    data = await response.json();
                    success = true;
                    resolvedGw = g;
                    break;
                }
            } catch (err) {
                // Ignore and try next gameweek down
            }
        }

        if (success && data) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: data, resolvedGw: resolvedGw, teamName: teamName }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            let errorMsg = 'Could not retrieve picks for any gameweek. Check team ID.';
            if (entryExists) {
                errorMsg = teamName
                    ? `FPL locks all squads until the GW1 deadline. "${teamName}" (ID: ${teamId}) is active, but picks are locked until the season starts.`
                    : `FPL locks all squads until the GW1 deadline. Team ID ${teamId} is active, but picks are locked until the season starts.`;
            }
            res.end(JSON.stringify({ success: false, error: errorMsg }));
        }
        return;
    }

    // API Route: Fetch classic league standings
    if (pathname === '/api/fpl-league') {
        const leagueId = reqUrl.searchParams.get('leagueId');
        if (!leagueId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing leagueId parameter' }));
            return;
        }
        try {
            const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
            } else {
                res.writeHead(response.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `FPL API returned status ${response.status}` }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // API Route: Fetch entry (manager team) history
    if (pathname === '/api/fpl-entry-history') {
        const entryId = reqUrl.searchParams.get('entryId');
        if (!entryId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing entryId parameter' }));
            return;
        }
        try {
            const url = `https://fantasy.premierleague.com/api/entry/${entryId}/history/`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
            } else {
                res.writeHead(response.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `FPL API returned status ${response.status}` }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // API Route: Save Cloud Drafts (Google Account & Email)
    if (req.method === 'POST' && pathname === '/api/sync-drafts') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const identifier = data.sub || (data.email ? data.email.toLowerCase().trim() : null);
                if (identifier && Array.isArray(data.drafts)) {
                    const record = {
                        sub: data.sub || '',
                        email: data.email ? data.email.toLowerCase().trim() : '',
                        drafts: data.drafts,
                        activeDraftIndex: typeof data.activeDraftIndex === 'number' ? data.activeDraftIndex : 0,
                        updatedAt: data.updatedAt || Date.now()
                    };
                    if (data.sub) cloudDraftsStore[data.sub] = record;
                    if (data.email) cloudDraftsStore[data.email.toLowerCase().trim()] = record;
                    saveStoreToDisk();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Synced to cloud' }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required sub/email or drafts array' }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get Cloud Drafts (by sub or email)
    if (req.method === 'GET' && pathname === '/api/sync-drafts') {
        const sub = reqUrl.searchParams.get('sub');
        const email = reqUrl.searchParams.get('email');
        const key = sub || (email ? email.toLowerCase().trim() : null);
        
        if (key && cloudDraftsStore[key]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: cloudDraftsStore[key] }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, data: null }));
        }
        return;
    }

    // API Route: Save Room PIN Sync (Instant 6-digit device pairing)
    if (req.method === 'POST' && pathname === '/api/room-sync') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const code = data.code ? data.code.toString().trim() : '';
                if (code && Array.isArray(data.drafts)) {
                    cloudDraftsStore['room_' + code] = {
                        code: code,
                        drafts: data.drafts,
                        activeDraftIndex: typeof data.activeDraftIndex === 'number' ? data.activeDraftIndex : 0,
                        updatedAt: data.updatedAt || Date.now()
                    };
                    saveStoreToDisk();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: `Room ${code} synced` }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing room code or drafts' }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload' }));
            }
        });
        return;
    }

    // API Route: Get Room PIN Sync Data
    if (req.method === 'GET' && pathname === '/api/room-sync') {
        const code = reqUrl.searchParams.get('code') ? reqUrl.searchParams.get('code').toString().trim() : '';
        const key = 'room_' + code;
        if (code && cloudDraftsStore[key]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: cloudDraftsStore[key] }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, data: null }));
        }
        return;
    }

    // API Route: Log Backtest Prediction Snapshot
    if (req.method === 'POST' && pathname === '/api/backtest/predictions') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number' || !Array.isArray(data.players)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw or players array' }));
                    return;
                }
                const playersError = validatePlayersPayload(data.players, 'pts');
                if (playersError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: playersError }));
                    return;
                }
                const result = applyPredictionSnapshot(backtestStore, {
                    gw: data.gw,
                    capturedAt: data.capturedAt || Date.now(),
                    players: data.players
                });
                backtestStore = result.store;
                saveBacktestStore();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, skipped: result.skipped }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Log Backtest Actual Results
    if (req.method === 'POST' && pathname === '/api/backtest/actuals') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number' || !Array.isArray(data.players)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw or players array' }));
                    return;
                }
                const playersError = validatePlayersPayload(data.players, 'actualPts');
                if (playersError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: playersError }));
                    return;
                }
                const result = applyActuals(backtestStore, { gw: data.gw, players: data.players });
                backtestStore = result.store;
                saveBacktestStore();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    skipped: result.skipped,
                    reason: result.reason || null,
                    pairCount: result.pairCount || 0
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Store the (manually-run) retrospective backtest report
    if (req.method === 'POST' && pathname === '/api/backtest/retro-report') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                JSON.parse(body); // validate it's well-formed JSON before persisting
                fs.writeFileSync(RETRO_REPORT_FILE, body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get Backtest Report (live forward-tracking by default, or ?source=retro)
    if (req.method === 'GET' && pathname === '/api/backtest/report') {
        const source = reqUrl.searchParams.get('source') || 'live';
        if (source === 'retro') {
            if (fs.existsSync(RETRO_REPORT_FILE)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(RETRO_REPORT_FILE, 'utf-8'));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Retro report not generated yet' }));
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...getReport(backtestStore) }));
        return;
    }

    // API Route: Record a Rotation History Snapshot (one per real finished gameweek)
    if (req.method === 'POST' && pathname === '/api/rotation/snapshot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw' }));
                    return;
                }
                const playersError = validateRotationPlayersPayload(data.players);
                if (playersError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: playersError }));
                    return;
                }
                const result = recordGwSnapshot(rotationHistory, { gw: data.gw, players: data.players });
                rotationHistory = result.history;
                saveRotationHistory();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, changed: result.changed }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get a Player's Rotation History (debugging/inspection)
    if (req.method === 'GET' && pathname === '/api/rotation/history') {
        const code = Number(reqUrl.searchParams.get('code'));
        const playerHistory = Number.isFinite(code) ? getPlayerHistory(rotationHistory, code) : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (playerHistory) {
            res.end(JSON.stringify({ success: true, data: playerHistory }));
        } else {
            res.end(JSON.stringify({ success: false, data: null }));
        }
        return;
    }

    // API Route: Get the full Rotation History document (bulk, for sync.js's per-sync computation
    // across ~700 players -- a per-player GET loop would be 700 requests per sync, this is 1)
    if (req.method === 'GET' && pathname === '/api/rotation/history-bulk') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: rotationHistory }));
        return;
    }

    // Static File Serving
    let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

export { server };
