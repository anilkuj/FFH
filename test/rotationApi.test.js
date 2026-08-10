import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffh-rotation-'));
process.env.FFH_PERSIST_DIR = tmpDir;
process.env.PORT = '0';

const { server } = await import('../server.js');

function baseUrl() {
    const { port } = server.address();
    return `http://localhost:${port}`;
}

test('POST /api/rotation/snapshot then GET /api/rotation/history round trip', async () => {
    const postRes = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 1,
            players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }]
        })
    });
    assert.equal(postRes.status, 200);
    const postBody = await postRes.json();
    assert.equal(postBody.success, true);
    assert.equal(postBody.changed, true);

    const getRes = await fetch(`${baseUrl()}/api/rotation/history?code=100`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.equal(getBody.data.currentTeam, 'ARS');
    assert.equal(getBody.data.snapshots.length, 1);
});

test('GET /api/rotation/history for an unknown code returns success:false, not an error', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/history?code=999999`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false);
});

test('POST /api/rotation/snapshot rejects malformed player entries (non-numeric code)', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gw: 2, players: [{ code: 'not-a-number', team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] })
    });
    assert.equal(res.status, 400);
});

test('POST /api/rotation/snapshot rejects a missing gw', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: [] })
    });
    assert.equal(res.status, 400);
});

test.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
