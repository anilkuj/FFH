import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
let STORAGE_FILE = path.join(__dirname, 'cloud_drafts_store.json');
try {
    fs.writeFileSync(STORAGE_FILE + '.test', 'ok');
    fs.unlinkSync(STORAGE_FILE + '.test');
} catch (e) {
    STORAGE_FILE = '/tmp/cloud_drafts_store.json';
}

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

    // API Route: Save Cloud Drafts

    if (req.method === 'POST' && pathname === '/api/sync-drafts') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data && data.sub && Array.isArray(data.drafts)) {
                    cloudDraftsStore[data.sub] = {
                        sub: data.sub,
                        email: data.email || '',
                        drafts: data.drafts,
                        activeDraftIndex: typeof data.activeDraftIndex === 'number' ? data.activeDraftIndex : 0,
                        updatedAt: Date.now()
                    };
                    saveStoreToDisk();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Synced to cloud' }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required sub or drafts array' }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get Cloud Drafts
    if (req.method === 'GET' && pathname === '/api/sync-drafts') {
        const sub = reqUrl.searchParams.get('sub');
        if (sub && cloudDraftsStore[sub]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: cloudDraftsStore[sub] }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, data: null }));
        }
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
