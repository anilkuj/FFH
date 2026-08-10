import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeErrorMetrics,
    bandForPrice,
    bracketForMinutes,
    shouldApplyCalibration,
    computeSuggestedCalibration
} from '../lib/calibration.js';

test('computeErrorMetrics: MAE and RMSE over a small known set', () => {
    const pairs = [{ predictedPts: 5, actualPts: 7 }, { predictedPts: 3, actualPts: 3 }];
    const result = computeErrorMetrics(pairs);
    assert.equal(result.n, 2);
    assert.equal(result.mae, 1);
    assert.equal(result.rmse, 1.41);
});

test('computeErrorMetrics: empty input returns zeros, not NaN', () => {
    assert.deepEqual(computeErrorMetrics([]), { mae: 0, rmse: 0, n: 0 });
});

test('bandForPrice: boundaries', () => {
    assert.equal(bandForPrice(4.9), '<5.0');
    assert.equal(bandForPrice(5.0), '5.0-7.4');
    assert.equal(bandForPrice(7.4), '5.0-7.4');
    assert.equal(bandForPrice(7.5), '7.5-9.9');
    assert.equal(bandForPrice(9.9), '7.5-9.9');
    assert.equal(bandForPrice(10.0), '>=10.0');
});

test('bracketForMinutes: boundaries', () => {
    assert.equal(bracketForMinutes(0), '0');
    assert.equal(bracketForMinutes(45), '1-59');
    assert.equal(bracketForMinutes(59), '1-59');
    assert.equal(bracketForMinutes(60), '60+');
    assert.equal(bracketForMinutes(90), '60+');
});

test('shouldApplyCalibration: gated at 3 scored GWs', () => {
    assert.equal(shouldApplyCalibration(2), false);
    assert.equal(shouldApplyCalibration(3), true);
});

test('computeSuggestedCalibration: moves toward the implied bias ratio, clamped to +-0.03', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.90,
        scoredPairs: [{ predictedPts: 10, actualPts: 7 }]
    });
    assert.equal(result, 0.87); // implied ratio 7/10 = 0.7; delta -0.20 clamped to -0.03
});

test('computeSuggestedCalibration: never crosses the hard floor even under a huge bias', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.61,
        scoredPairs: [{ predictedPts: 100, actualPts: 1 }]
    });
    assert.equal(result, 0.6);
});

test('computeSuggestedCalibration: zero predicted total is a safe no-op', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.90,
        scoredPairs: [{ predictedPts: 0, actualPts: 0 }]
    });
    assert.equal(result, 0.90);
});

test('computeSuggestedCalibration: small in-bounds nudge is applied and rounded', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.90,
        scoredPairs: [{ predictedPts: 300, actualPts: 277 }]
    });
    // implied ratio = 277/300 = 0.923333... ; delta = 0.023333... well within +-0.03, no clamp
    // newFactor = 0.90 + 0.023333... = 0.923333..., rounded to 4dp = 0.9233
    assert.equal(result, 0.9233);
});

test('computeSuggestedCalibration: non-finite result degrades to a no-op instead of poisoning the factor', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.90,
        scoredPairs: [{ predictedPts: 10, actualPts: undefined }]
    });
    assert.equal(result, 0.90);
    assert.notEqual(Number.isNaN(result), true);
});
