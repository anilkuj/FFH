/**
 * Error metrics and auto-tune math for the backtest calibration loop.
 *
 * The global "calibration factor" scales predicted points toward what's
 * actually observed once real gameweek results come in. This module is
 * pure math (no I/O, no storage) so it can be unit tested in isolation;
 * `lib/backtestStore.js` is responsible for feeding it real predicted/actual
 * pairs and persisting the result.
 */

/**
 * Mean absolute error and root-mean-square error between predicted and
 * actual points across a set of scored player-gameweek pairs.
 */
export function computeErrorMetrics(pairs) {
    const n = pairs.length;
    if (n === 0) return { mae: 0, rmse: 0, n: 0 };

    let sumAbs = 0;
    let sumSq = 0;
    pairs.forEach(p => {
        const err = p.actualPts - p.predictedPts;
        sumAbs += Math.abs(err);
        sumSq += err * err;
    });

    return {
        mae: Math.round((sumAbs / n) * 100) / 100,
        rmse: Math.round(Math.sqrt(sumSq / n) * 100) / 100,
        n
    };
}

/** Buckets a player's price into the bands used for calibration breakdowns. */
export function bandForPrice(price) {
    if (price < 5.0) return '<5.0';
    if (price < 7.5) return '5.0-7.4';
    if (price < 10.0) return '7.5-9.9';
    return '>=10.0';
}

/** Buckets minutes played into the brackets used for calibration breakdowns. */
export function bracketForMinutes(minutes) {
    if (!minutes || minutes === 0) return '0';
    if (minutes < 60) return '1-59';
    return '60+';
}

/**
 * Calibration only kicks in once there's enough scored history to trust —
 * a single gameweek is too noisy (postponements, one red card, a flukey
 * bonus-points week) to justify adjusting a factor that affects every
 * future prediction.
 */
export function shouldApplyCalibration(scoredGwCount) {
    return scoredGwCount >= 3;
}

// Maximum the calibration factor is allowed to move in a single suggestion.
// Keeps any one volatile gameweek from swinging global predictions; the
// factor should drift slowly toward the true bias as more data accumulates.
const CALIBRATION_MAX_STEP = 0.03;

// Hard floor/ceiling on the calibration factor itself. These bound how far
// predictions can ever be scaled, so a sustained run of bad data (or a bug
// upstream) can't compound across many small steps into an absurd factor.
const CALIBRATION_MIN = 0.6;
const CALIBRATION_MAX = 1.3;

/**
 * Suggests a new calibration factor by nudging the current factor toward
 * the ratio of actual-to-predicted totals observed so far, clamped to a
 * small per-call step and to the hard [MIN, MAX] bounds.
 */
export function computeSuggestedCalibration({ currentFactor, scoredPairs }) {
    const sumPredicted = scoredPairs.reduce((s, p) => s + p.predictedPts, 0);
    const sumActual = scoredPairs.reduce((s, p) => s + p.actualPts, 0);
    if (sumPredicted === 0) return currentFactor;

    const rawSuggested = currentFactor * (sumActual / sumPredicted);
    const step = Math.max(-CALIBRATION_MAX_STEP, Math.min(CALIBRATION_MAX_STEP, rawSuggested - currentFactor));
    let newFactor = currentFactor + step;
    newFactor = Math.max(CALIBRATION_MIN, Math.min(CALIBRATION_MAX, newFactor));

    return Math.round(newFactor * 10000) / 10000;
}
