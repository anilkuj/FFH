import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeBasePPG,
    getCleanSheetProb,
    getExpectedSavePts,
    computeGwPrediction
} from '../lib/predictionModel.js';

test('computeBasePPG: manual override wins, still gets position-clamped', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'MID', teamShort: 'BRE', price: 5.5,
        isPromotedOrTransfer: true, manualOverridePPG: 3.2
    });
    assert.equal(ppg, 3.2); // within MID clamp [1.8, 6.0]
});

test('computeBasePPG: established player uses totalPoints / appearances', () => {
    const ppg = computeBasePPG({
        minutes: 3000, appearances: 35, totalPoints: 140,
        position: 'DEF', teamShort: 'ARS', price: 6.0,
        isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    assert.equal(ppg, 4.0); // 140/35, within DEF clamp [1.5, 4.5]
});

test('computeBasePPG: promoted/transferred player with zero minutes gets position default', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'FWD', teamShort: 'SUN', price: 5.0,
        isPromotedOrTransfer: true, manualOverridePPG: undefined
    });
    assert.equal(ppg, 3.5); // FWD default, within FWD clamp [2.0, 6.0]
});

test('computeBasePPG: unknown non-promoted player with zero minutes falls to price-based floor', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'MID', teamShort: 'EVE', price: 4.5,
        isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    assert.equal(ppg, 1.8); // price <= 6.0 -> 0.5, clamped up to MID floor 1.8
});

test('getCleanSheetProb: easy home fixture beats hard away fixture', () => {
    assert.equal(getCleanSheetProb(2, 'H'), 0.53);
    assert.equal(getCleanSheetProb(5, 'A'), 0.03);
});

test('getExpectedSavePts: only applies to GKP', () => {
    assert.equal(getExpectedSavePts({ position: 'MID', diff: 5, loc: 'A', saves90: 3.6 }), 0);
    const gkSaves = getExpectedSavePts({ position: 'GKP', diff: 5, loc: 'A', saves90: 3.6 });
    assert.equal(Math.round(gkSaves * 1000) / 1000, 2.112);
});

test('computeGwPrediction: MID, easy home fixture with attacking output', () => {
    const { pts } = computeGwPrediction({
        basePPG: 4.0, position: 'MID', xG90: 0.3, xA90: 0.2, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 2 }
    });
    assert.equal(pts, 5.4);
});

test('computeGwPrediction: GKP, hard away fixture leans on saves, not clean sheet', () => {
    const { pts } = computeGwPrediction({
        basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.6,
        mppg: 90, starts: 25, chanceOfPlaying: 100,
        fixture: { opp: 'MCI', loc: 'A', diff: 5 }
    });
    assert.equal(pts, 2.9);
});

test('computeGwPrediction: BYE gameweek always scores 0', () => {
    const { pts } = computeGwPrediction({
        basePPG: 5.0, position: 'FWD', xG90: 0.5, xA90: 0.3, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'BYE', loc: 'H', diff: 3 }
    });
    assert.equal(pts, 0);
});

test('computeGwPrediction: 0% chance of playing always scores 0', () => {
    const { pts } = computeGwPrediction({
        basePPG: 6.0, position: 'FWD', xG90: 0.5, xA90: 0.3, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 0,
        fixture: { opp: 'BOU', loc: 'H', diff: 2 }
    });
    assert.equal(pts, 0);
});

test('computeGwPrediction: documents the current diff=1/diff=3 gap (no FDR bonus at diff=1)', () => {
    const base = { basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100 };
    const diff1 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 1 } });
    const diff3 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 3 } });
    assert.equal(diff1.breakdown.fdrMultiplier, diff3.breakdown.fdrMultiplier);
});
