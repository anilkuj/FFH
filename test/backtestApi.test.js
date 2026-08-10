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

test.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
