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
 * the directly-implied bias-correcting ratio (sumActual/sumPredicted).
 *
 * This assumes `predictedPts` in every scored pair is always the model's
 * raw, uncalibrated output (never pre-scaled by any previously-applied
 * factor) — sync.js snapshots raw predictions specifically so this contract
 * holds. Under that contract, sumActual/sumPredicted is a direct estimate
 * of "the factor that would make raw predictions match reality," so the
 * step-clamp below nudges currentFactor toward that target gradually
 * (damped, not instant) rather than jumping there in one call — this keeps
 * a single noisy gameweek from causing an overshoot. It still converges to
 * the true bias within a few cycles when the bias is stable, and then
 * stays flat once it arrives, because at that point the implied ratio is
 * approximately equal to currentFactor and the step goes to ~0. (An
 * earlier version of this function multiplied the ratio by currentFactor,
 * which only has a fixed point if predictedPts already had currentFactor
 * baked in — it didn't, so that version decayed geometrically toward the
 * floor under any sustained bias instead of converging.)
 */
export function computeSuggestedCalibration({ currentFactor, scoredPairs }) {
    const sumPredicted = scoredPairs.reduce((s, p) => s + p.predictedPts, 0);
    const sumActual = scoredPairs.reduce((s, p) => s + p.actualPts, 0);
    if (sumPredicted === 0) return currentFactor;

    const impliedFactor = sumActual / sumPredicted;
    const step = Math.max(-CALIBRATION_MAX_STEP, Math.min(CALIBRATION_MAX_STEP, impliedFactor - currentFactor));
    let newFactor = currentFactor + step;
    newFactor = Math.max(CALIBRATION_MIN, Math.min(CALIBRATION_MAX, newFactor));

    // Safety net: if malformed upstream data (e.g. a non-numeric predictedPts
    // or actualPts) produced a NaN/Infinity through the math above, degrade to
    // a no-op rather than persisting a poisoned factor that would scale every
    // future prediction.
    if (!Number.isFinite(newFactor)) return currentFactor;

    return Math.round(newFactor * 10000) / 10000;
}
