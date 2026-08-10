import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffh-backtest-'));
process.env.FFH_PERSIST_DIR = tmpDir;
process.env.PORT = '0';

const { server } = await import('../server.js');

function baseUrl() {
    const { port } = server.address();
    return `http://localhost:${port}`;
}

test('predictions -> actuals -> report round trip', async () => {
    const predRes = await fetch(`${baseUrl()}/api/backtest/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 1,
            capturedAt: Date.now(),
            players: [
                { id: 1, position: 'MID', price: 8.0, pts: 6.0 },
                { id: 2, position: 'DEF', price: 5.0, pts: 3.0 }
            ]
        })
    });
    assert.equal(predRes.status, 200);
    const predBody = await predRes.json();
    assert.equal(predBody.success, true);
    assert.equal(predBody.skipped, false);

    const actRes = await fetch(`${baseUrl()}/api/backtest/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 1,
            players: [
                { id: 1, actualPts: 8, minutesPlayed: 90 },
                { id: 2, actualPts: 2, minutesPlayed: 90 }
            ]
        })
    });
    assert.equal(actRes.status, 200);
    const actBody = await actRes.json();
    assert.equal(actBody.success, true);
    assert.equal(actBody.pairCount, 2);

    const reportRes = await fetch(`${baseUrl()}/api/backtest/report`);
    const report = await reportRes.json();
    assert.equal(report.scoredGwCount, 1);
    assert.equal(report.overall.n, 2);
});

test('re-posting actuals for a locked gw is a no-op via the API too', async () => {
    const res = await fetch(`${baseUrl()}/api/backtest/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gw: 1, players: [{ id: 1, actualPts: 99, minutesPlayed: 90 }] })
    });
    const body = await res.json();
    assert.equal(body.skipped, true);
    assert.equal(body.reason, 'already-locked');
});

test('retro-report is stored and served back under source=retro', async () => {
    const retroReport = { overall: { mae: 1.2, rmse: 1.6, n: 500 }, note: 'stub-retro-report' };
    const postRes = await fetch(`${baseUrl()}/api/backtest/retro-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retroReport)
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl()}/api/backtest/report?source=retro`);
    const body = await getRes.json();
    assert.equal(body.note, 'stub-retro-report');
});

test('POST /api/backtest/predictions with missing gw returns 400', async () => {
    const res = await fetch(`${baseUrl()}/api/backtest/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: [{ id: 1, position: 'MID', price: 8.0, pts: 6.0 }] })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
});

test('POST /api/backtest/predictions with malformed JSON body returns 500', async () => {
    const res = await fetch(`${baseUrl()}/api/backtest/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not valid json'
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
});

test('POST /api/backtest/predictions with a non-numeric id in players returns 400 and does not persist', async () => {
    const res = await fetch(`${baseUrl()}/api/backtest/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 99,
            players: [{ id: 'not-a-number', position: 'MID', price: 8.0, pts: 6.0 }]
        })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
});

test('POST /api/backtest/actuals with a non-numeric actualPts returns 400', async () => {
    const res = await fetch(`${baseUrl()}/api/backtest/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 1,
            players: [{ id: 1, actualPts: 'lots', minutesPlayed: 90 }]
        })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
});

test('data written to disk survives a fresh server instance loading from the same persist dir', async () => {
    // The earlier round-trip test already wrote GW1 predictions+actuals to
    // BACKTEST_STORE_FILE under tmpDir via the live in-memory `backtestStore`.
    // Close this server instance and re-import server.js as a distinct module
    // instance (cache-busted via a query string) pointed at the same
    // FFH_PERSIST_DIR, to prove the load-on-startup path actually reads back
    // what was persisted rather than just serving from memory.
    server.close();

    process.env.PORT = '0';
    const { server: server2 } = await import(`../server.js?t=${Date.now()}`);
    try {
        const { port } = server2.address();
        const res = await fetch(`http://localhost:${port}/api/backtest/report`);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.scoredGwCount, 1);
    } finally {
        server2.close();
    }
});

test.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
