import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEmptyStore, applyPredictionSnapshot, applyActuals, getReport } from './lib/backtestStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const PERSIST_DIR = process.env.FFH_PERSIST_DIR || (fs.existsSync('/data') ? '/data' : __dirname);

let STORAGE_FILE = path.join(PERSIST_DIR, 'cloud_drafts_store.json');
try {
    fs.writeFileSync(STORAGE_FILE + '.test', 'ok');
    fs.unlinkSync(STORAGE_FILE + '.test');
} catch (e) {
    STORAGE_FILE = '/tmp/cloud_drafts_store.json';
}

const BACKTEST_STORE_FILE = path.join(PERSIST_DIR, 'backtest_log.json');
const RETRO_REPORT_FILE = path.join(PERSIST_DIR, 'retro_backtest_report.json');

// In-memory cache
let cloudDraftsStore = {};

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

const server = http.createServer((req, res) => {
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
        res.end(JSON.stringify(getReport(backtestStore)));
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
