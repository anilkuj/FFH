import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyStore, applyPredictionSnapshot, applyActuals, getReport } from '../lib/backtestStore.js';

function makeSyntheticPlayers() {
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const players = [];
    for (let i = 1; i <= 20; i++) {
        players.push({
            id: i,
            position: positions[i % 4],
            price: 4.0 + (i % 8),
            pts: 3.0 + (i % 5)
        });
    }
    return players;
}

test('simulated 8-GW season: calibration stays put for 2 GWs, converges to the true bias within a few clamped steps, then holds stable', () => {
    let store = createEmptyStore();
    const BIAS = 0.75; // actual always comes in at 75% of predicted -- a large, deliberately obvious miss
    const expectedFactorByGw = { 1: 0.90, 2: 0.90, 3: 0.87, 4: 0.84, 5: 0.81, 6: 0.78, 7: 0.75, 8: 0.75 };

    for (let gw = 1; gw <= 8; gw++) {
        const predPlayers = makeSyntheticPlayers();
        const snap = applyPredictionSnapshot(store, { gw, capturedAt: Date.now(), players: predPlayers });
        assert.equal(snap.skipped, false, `GW${gw} snapshot should not be skipped`);
        store = snap.store;

        const actualPlayers = predPlayers.map(p => ({
            id: p.id,
            actualPts: p.pts * BIAS,
            minutesPlayed: 90
        }));
        const res = applyActuals(store, { gw, players: actualPlayers });
        assert.equal(res.skipped, false, `GW${gw} actuals should not be skipped`);
        store = res.store;

        assert.equal(store.currentCalibrationFactor, expectedFactorByGw[gw], `GW${gw} calibration factor`);
    }

    const report = getReport(store);
    assert.equal(report.scoredGwCount, 8);
    // 5 real adjustments (GW3->0.87, GW4->0.84, GW5->0.81, GW6->0.78, GW7->0.75);
    // GW8 computes the same 0.75 again so no new history entry is appended (no-op guard).
    assert.equal(report.calibrationHistory.length, 5);
    assert.equal(report.overall.n, 160); // 20 players x 8 GWs
});

test('actuals for a player id absent from the prediction snapshot are excluded, not crashing', () => {
    let store = createEmptyStore();
    store = applyPredictionSnapshot(store, {
        gw: 1, capturedAt: Date.now(),
        players: [{ id: 1, position: 'MID', price: 8.0, pts: 5.0 }]
    }).store;

    const res = applyActuals(store, {
        gw: 1,
        players: [
            { id: 1, actualPts: 5, minutesPlayed: 90 },
            { id: 999, actualPts: 12, minutesPlayed: 90 } // no matching prediction, must be dropped silently
        ]
    });
    assert.equal(res.pairCount, 1);
    const report = getReport(res.store);
    assert.equal(report.overall.n, 1);
});

test('re-posting actuals for an already-locked gw is a no-op and does not double-count', () => {
    let store = createEmptyStore();
    store = applyPredictionSnapshot(store, { gw: 1, capturedAt: Date.now(), players: [{ id: 1, position: 'MID', price: 8.0, pts: 5.0 }] }).store;
    store = applyActuals(store, { gw: 1, players: [{ id: 1, actualPts: 6, minutesPlayed: 90 }] }).store;

    const second = applyActuals(store, { gw: 1, players: [{ id: 1, actualPts: 99, minutesPlayed: 90 }] });
    assert.equal(second.skipped, true);
    assert.equal(second.reason, 'already-locked');
    assert.deepEqual(second.store, store);
});

test('re-posting a prediction snapshot for an already-locked gw cannot reopen scoring', () => {
    let store = createEmptyStore();
    store = applyPredictionSnapshot(store, { gw: 1, capturedAt: Date.now(), players: [{ id: 1, position: 'MID', price: 8.0, pts: 5.0 }] }).store;
    store = applyActuals(store, { gw: 1, players: [{ id: 1, actualPts: 6, minutesPlayed: 90 }] }).store;

    const resnap = applyPredictionSnapshot(store, { gw: 1, capturedAt: Date.now(), players: [{ id: 1, position: 'MID', price: 8.0, pts: 999 }] });
    assert.equal(resnap.skipped, true);
    assert.deepEqual(resnap.store, store);
});

test('actuals posted with no matching prediction snapshot for that gw are skipped entirely', () => {
    const store = createEmptyStore();
    const res = applyActuals(store, { gw: 5, players: [{ id: 1, actualPts: 6, minutesPlayed: 90 }] });
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'no-prediction-snapshot');
});
