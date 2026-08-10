/**
 * State machine tracking, per gameweek, what was predicted and what actually
 * happened, and driving the calibration auto-tune in `lib/calibration.js`.
 *
 * Predictions and actuals are kept as two separate objects keyed by
 * gameweek number (rather than one merged per-player record) because they
 * arrive at different times from different sources: predictions are
 * captured before kickoff from the live prediction model, actuals arrive
 * afterward from real results. Keeping them apart means a prediction
 * snapshot can be written without needing actuals to exist yet, and lets
 * `applyActuals` join the two by player id only once both sides are present.
 *
 * A gameweek's prediction snapshot "locks" the moment actuals are recorded
 * against it. Locking exists so a gameweek can only ever be scored once:
 * without it, a re-posted prediction snapshot could quietly rewrite history
 * after the real result was already used to move the calibration factor, or
 * a duplicate actuals post could double-count the same gameweek into the
 * error metrics and corrupt the calibration math. Once locked, both
 * `applyPredictionSnapshot` and `applyActuals` for that gw become no-ops.
 *
 * This module has zero I/O (no filesystem, no network) on purpose: it is
 * pure state transitions over a plain-object store, passed in and returned
 * explicitly rather than mutated. That's what makes it possible to unit
 * test an entire simulated multi-gameweek season (see
 * test/backtestStore.test.js) in-process, with no server or real fixtures
 * involved. `server.js` (a later task) owns loading/saving this store to
 * disk and exposing it over HTTP; it is expected to treat every function
 * here as `(store, input) -> { store, ... }` and persist the returned store.
 */

import { computeErrorMetrics, computeSuggestedCalibration, shouldApplyCalibration, bandForPrice, bracketForMinutes } from './calibration.js';

const DEFAULT_CALIBRATION_FACTOR = 0.90;
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];
const PRICE_BANDS = ['<5.0', '5.0-7.4', '7.5-9.9', '>=10.0'];
const MINUTES_BRACKETS = ['0', '1-59', '60+'];

/** Fresh store with no history and the default (uncalibrated) factor. */
export function createEmptyStore() {
    return {
        predictions: {},
        actuals: {},
        scoredGws: [],
        calibrationHistory: [],
        currentCalibrationFactor: DEFAULT_CALIBRATION_FACTOR
    };
}

/**
 * Records a prediction snapshot for a gameweek (what the model predicted,
 * captured before kickoff). Skipped as a no-op if that gameweek is already
 * locked (actuals already scored against it) — see module header for why.
 *
 * Note: `players` is stored by reference, not defensively cloned — callers
 * must not mutate a `players` array (or its objects) after passing it in.
 * This is safe today because the intended caller, `server.js` (Task 7),
 * always builds `players` fresh via `JSON.parse` on each incoming request,
 * so there is never a lingering reference for a caller to mutate.
 */
export function applyPredictionSnapshot(store, { gw, capturedAt, players }) {
    const existing = store.predictions[gw];
    if (existing && existing.locked) {
        return { store, skipped: true, reason: 'already-locked' };
    }

    const newStore = {
        ...store,
        predictions: {
            ...store.predictions,
            [gw]: { capturedAt, locked: false, players }
        }
    };
    return { store: newStore, skipped: false };
}

/**
 * Records real results for a gameweek, joins them against that gameweek's
 * prediction snapshot by player id, locks the snapshot (see module header),
 * and — once enough gameweeks have been scored — feeds the accumulated
 * predicted/actual pairs into the calibration auto-tune.
 *
 * Skipped as a no-op if there's no prediction snapshot to score against yet,
 * or if the gameweek is already locked (already scored once).
 *
 * Note: like `applyPredictionSnapshot`, `players` is stored by reference
 * here too — see that function's doc comment for the by-reference contract.
 */
export function applyActuals(store, { gw, players }) {
    const predEntry = store.predictions[gw];
    if (!predEntry) {
        return { store, skipped: true, reason: 'no-prediction-snapshot' };
    }
    if (predEntry.locked) {
        return { store, skipped: true, reason: 'already-locked' };
    }

    // Join by player id; actuals for a player id with no matching prediction
    // (e.g. a substitute who wasn't in the pre-kickoff squad) are silently
    // dropped rather than crashing or being scored against a made-up prediction.
    const predById = new Map(predEntry.players.map(p => [p.id, p]));
    const pairs = [];
    players.forEach(a => {
        const pred = predById.get(a.id);
        if (pred) {
            pairs.push({
                id: a.id,
                position: pred.position,
                price: pred.price,
                predictedPts: pred.pts,
                actualPts: a.actualPts,
                minutesPlayed: a.minutesPlayed || 0
            });
        }
    });

    const newScoredGws = store.scoredGws.includes(gw)
        ? store.scoredGws
        : [...store.scoredGws, gw].sort((x, y) => x - y);

    let newStore = {
        ...store,
        predictions: { ...store.predictions, [gw]: { ...predEntry, locked: true } },
        actuals: { ...store.actuals, [gw]: { recordedAt: new Date().toISOString(), players, pairs } },
        scoredGws: newScoredGws
    };

    if (shouldApplyCalibration(newScoredGws.length)) {
        const allPairs = newScoredGws.flatMap(g => newStore.actuals[g].pairs);
        const oldFactor = newStore.currentCalibrationFactor;
        const suggested = computeSuggestedCalibration({ currentFactor: oldFactor, scoredPairs: allPairs });

        // Only log a calibration-history entry when the factor actually moved;
        // a no-op suggestion (e.g. zero predicted total) shouldn't clutter the
        // history with a "0.90 -> 0.90" entry.
        if (suggested !== oldFactor) {
            newStore = {
                ...newStore,
                currentCalibrationFactor: suggested,
                calibrationHistory: [
                    ...newStore.calibrationHistory,
                    {
                        timestamp: new Date().toISOString(),
                        oldFactor,
                        newFactor: suggested,
                        gwsUsed: newScoredGws,
                        sampleSize: allPairs.length
                    }
                ]
            };
        }
    }

    return { store: newStore, skipped: false, pairCount: pairs.length };
}

/**
 * Rolls up all scored gameweeks into an overall + per-gw + per-position +
 * per-price-band + per-minutes-bracket error report, plus the calibration
 * history and current factor. Pure derived view over the store — computed
 * fresh on every call rather than cached, since scored history is small.
 */
export function getReport(store) {
    const allPairs = store.scoredGws.flatMap(g => store.actuals[g].pairs);

    const byGw = {};
    store.scoredGws.forEach(g => {
        byGw[g] = computeErrorMetrics(store.actuals[g].pairs);
    });

    const byPosition = {};
    POSITIONS.forEach(pos => {
        byPosition[pos] = computeErrorMetrics(allPairs.filter(p => p.position === pos));
    });

    const byPriceBand = {};
    PRICE_BANDS.forEach(band => {
        byPriceBand[band] = computeErrorMetrics(allPairs.filter(p => bandForPrice(p.price) === band));
    });

    const byMinutesBracket = {};
    MINUTES_BRACKETS.forEach(bracket => {
        byMinutesBracket[bracket] = computeErrorMetrics(allPairs.filter(p => bracketForMinutes(p.minutesPlayed) === bracket));
    });

    return {
        overall: computeErrorMetrics(allPairs),
        byGw,
        byPosition,
        byPriceBand,
        byMinutesBracket,
        calibrationHistory: store.calibrationHistory,
        currentCalibrationFactor: store.currentCalibrationFactor,
        scoredGwCount: store.scoredGws.length
    };
}
