# xP Model Backtest Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build measurement infrastructure (prediction snapshots, real-result scoring, retrospective validation, safe auto-calibration) so the xP model's accuracy can be measured and its global calibration factor auto-corrected, instead of relying on a hand-set, unverified constant.

**Architecture:** Extract the prediction formula out of `sync.js` into a pure, shared module (`lib/predictionModel.js`). Track predictions vs. real results forward from GW1 via new `server.js` endpoints backed by the already-provisioned Railway volume at `/data`. Validate the same formula retrospectively against last season's real results using the public `vaastav/Fantasy-Premier-League` dataset. Auto-apply a clamped, audited calibration factor once enough data exists, and bake it into `data.js` so the live app picks it up automatically.

**Tech Stack:** Plain Node.js (ES modules), Node's built-in `node:test` runner (no new test framework dependency), native `fetch`, existing `http` server in `server.js`.

**Reference:** [docs/superpowers/specs/2026-08-10-xp-backtest-infra-design.md](../specs/2026-08-10-xp-backtest-infra-design.md)

**Note on the design doc:** the design doc's retro-validation season pairing was stated backwards ("last-completed-season aggregate... season-before-that's GW-by-GW"). The correct pairing — and what this plan implements — is: **baseline** = the season before last (its final aggregate becomes `basePPG`, exactly mirroring how the live model bootstraps a new season), **validation** = last season's real GW-by-GW results (the season that followed the baseline season). Concretely: baseline = `2024-25` aggregate, validation = `2025-26` GW-by-GW (confirmed populated via a live check of the dataset — see Task 11).

---

## Task 1: Add a test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the `test` script**

In `package.json`, add a `test` entry to `"scripts"`:

```json
{
  "name": "fpl-hub",
  "type": "module",
  "version": "1.0.0",
  "description": "Premium FPL Hub Tool modeled after Fantasy Football Hub",
  "main": "index.html",
  "scripts": {
    "dev": "vite",
    "build": "node ./node_modules/vite/bin/vite.js build",
    "preview": "vite preview",
    "sync": "node sync.js",
    "start": "node server.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "sirv-cli": "^3.0.1",
    "vite": "^5.0.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Verify it runs (with zero tests, should report 0 pass/0 fail, not error)**

Run: `npm test`
Expected: Node's test runner reports no test files found yet (that's fine — `test/` is still empty) and exits 0.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add node:test runner script"
```

---

## Task 2: `lib/predictionModel.js` — extract the prediction formula

**Files:**
- Create: `lib/predictionModel.js`
- Test: `test/predictionModel.test.js`

This is the single source of truth for the per-gameweek points formula, extracted verbatim (not redesigned) from `sync.js:341-490` so behavior is unchanged. Both the live sync and the retrospective backtest script will import from here — never duplicate this formula elsewhere.

- [ ] **Step 1: Write the failing tests**

Create `test/predictionModel.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/predictionModel.js'`

- [ ] **Step 3: Write `lib/predictionModel.js`**

```js
export function computeBasePPG({ minutes, appearances, totalPoints, position, teamShort, price, isPromotedOrTransfer, manualOverridePPG }) {
    let basePPG = 0.5;

    if (manualOverridePPG !== undefined && manualOverridePPG !== null) {
        basePPG = manualOverridePPG;
    } else if (minutes > 500 && appearances > 0) {
        basePPG = totalPoints / appearances;
    } else if (minutes > 0 && appearances > 0) {
        const playingRatio = Math.min(1.0, minutes / 500);
        const defaultPPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
        basePPG = 0.5 + (defaultPPG - 0.5) * playingRatio;
    } else if (isPromotedOrTransfer) {
        basePPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
    } else {
        basePPG = (price > 6.0) ? 2.0 : 0.5;
    }

    const TOP_TEAMS = ['MCI', 'ARS', 'LIV', 'TOT', 'CHE', 'MUN'];
    if (position === 'GKP') {
        const minGkpPpg = TOP_TEAMS.includes(teamShort) ? 3.2 : 1.8;
        basePPG = Math.max(minGkpPpg, Math.min(4.2, basePPG));
    } else if (position === 'DEF') {
        basePPG = Math.max(1.5, Math.min(4.5, basePPG));
    } else if (position === 'MID') {
        basePPG = Math.max(1.8, Math.min(6.0, basePPG));
    } else if (position === 'FWD') {
        basePPG = Math.max(2.0, Math.min(6.0, basePPG));
    }

    return basePPG;
}

export function getCleanSheetProb(diff, loc) {
    let base;
    if (diff <= 2) base = 0.48;
    else if (diff === 3) base = 0.30;
    else if (diff === 4) base = 0.18;
    else base = 0.08;

    base += (loc === 'H') ? 0.05 : -0.05;
    return Math.max(0.02, Math.min(0.65, base));
}

export function getExpectedSavePts({ position, diff, loc, saves90 }) {
    if (position !== 'GKP') return 0;

    let diffMultiplier;
    if (diff <= 2) diffMultiplier = 0.65;
    else if (diff === 3) diffMultiplier = 1.0;
    else if (diff === 4) diffMultiplier = 1.30;
    else diffMultiplier = 1.60;

    const locMultiplier = (loc === 'A') ? 1.10 : 0.92;
    const baseSaves90 = saves90 > 0 ? saves90 : 3.0;
    const expectedSavesPerGame = baseSaves90 * diffMultiplier * locMultiplier;

    return expectedSavesPerGame / 3;
}

export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        if (fixture.diff === 2) breakdown.fdrMultiplier = 1.12;
        else if (fixture.diff === 4) breakdown.fdrMultiplier = 0.88;
        else if (fixture.diff === 5) breakdown.fdrMultiplier = 0.70;
        pts *= breakdown.fdrMultiplier;

        breakdown.homeAwayAdj = (fixture.loc === 'H') ? 0.35 : -0.35;
        pts += breakdown.homeAwayAdj;

        if (position === 'GKP' || position === 'DEF') {
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H');
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            pts += breakdown.csAdj;

            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            }
        } else if (position === 'MID') {
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H');
            breakdown.csAdj = (csProb - avgCsProb) * 1;
            pts += breakdown.csAdj;

            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        } else {
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        }
    } else {
        pts = 0.0;
    }

    const chance = (chanceOfPlaying !== null && chanceOfPlaying !== undefined) ? chanceOfPlaying / 100 : 1.0;
    pts *= chance;

    const isExpectedStarter = chance > 0.8 && (mppg >= 45 || starts >= 15);
    if (isExpectedStarter && fixture.opp !== 'BYE') {
        pts = Math.max(0.8, pts);
    }

    pts = Math.max(0, Math.round(pts * 10) / 10);

    return { pts, breakdown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `predictionModel.test.js` cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: extract xP formula into lib/predictionModel.js"
```

---

## Task 3: `lib/calibration.js` — error metrics & auto-tune math

**Files:**
- Create: `lib/calibration.js`
- Test: `test/calibration.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/calibration.test.js`:

```js
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

test('computeSuggestedCalibration: moves toward the real ratio, clamped to +-0.03', () => {
    const result = computeSuggestedCalibration({
        currentFactor: 0.90,
        scoredPairs: [{ predictedPts: 10, actualPts: 9 }]
    });
    assert.equal(result, 0.87); // raw target 0.81, but step clamped to -0.03
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/calibration.js'`

- [ ] **Step 3: Write `lib/calibration.js`**

```js
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

export function bandForPrice(price) {
    if (price < 5.0) return '<5.0';
    if (price < 7.5) return '5.0-7.4';
    if (price < 10.0) return '7.5-9.9';
    return '>=10.0';
}

export function bracketForMinutes(minutes) {
    if (!minutes || minutes === 0) return '0';
    if (minutes < 60) return '1-59';
    return '60+';
}

export function shouldApplyCalibration(scoredGwCount) {
    return scoredGwCount >= 3;
}

const CALIBRATION_MAX_STEP = 0.03;
const CALIBRATION_MIN = 0.6;
const CALIBRATION_MAX = 1.3;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `calibration.test.js` cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/calibration.js test/calibration.test.js
git commit -m "feat: add calibration math (error metrics + clamped auto-tune)"
```

---

## Task 4: `lib/backtestStore.js` — state machine + GW simulation harness

**Files:**
- Create: `lib/backtestStore.js`
- Test: `test/backtestStore.test.js`

Pure, in-memory state transitions — no file I/O here (that's `server.js`'s job in Task 7). This is what makes the simulation harness possible without spinning up a server.

- [ ] **Step 1: Write the failing tests**

Create `test/backtestStore.test.js`:

```js
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

test('simulated 6-GW season: calibration stays put for 2 GWs, then converges under a steady 8% overprediction bias, clamped every step', () => {
    let store = createEmptyStore();
    const BIAS = 0.92; // actual always comes in at 92% of predicted
    const expectedFactorByGw = { 1: 0.90, 2: 0.90, 3: 0.87, 4: 0.84, 5: 0.81, 6: 0.78 };

    for (let gw = 1; gw <= 6; gw++) {
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
    assert.equal(report.scoredGwCount, 6);
    assert.equal(report.calibrationHistory.length, 4); // one real adjustment per GW from GW3 onward
    assert.equal(report.overall.n, 120); // 20 players x 6 GWs
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/backtestStore.js'`

- [ ] **Step 3: Write `lib/backtestStore.js`**

```js
import { computeErrorMetrics, computeSuggestedCalibration, shouldApplyCalibration, bandForPrice, bracketForMinutes } from './calibration.js';

const DEFAULT_CALIBRATION_FACTOR = 0.90;
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];
const PRICE_BANDS = ['<5.0', '5.0-7.4', '7.5-9.9', '>=10.0'];
const MINUTES_BRACKETS = ['0', '1-59', '60+'];

export function createEmptyStore() {
    return {
        predictions: {},
        actuals: {},
        scoredGws: [],
        calibrationHistory: [],
        currentCalibrationFactor: DEFAULT_CALIBRATION_FACTOR
    };
}

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

export function applyActuals(store, { gw, players }) {
    const predEntry = store.predictions[gw];
    if (!predEntry) {
        return { store, skipped: true, reason: 'no-prediction-snapshot' };
    }
    if (predEntry.locked) {
        return { store, skipped: true, reason: 'already-locked' };
    }

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `backtestStore.test.js` cases green, including the 6-GW simulation.

- [ ] **Step 5: Commit**

```bash
git add lib/backtestStore.js test/backtestStore.test.js
git commit -m "feat: add backtest store state machine + GW simulation test"
```

---

## Task 5: `lib/gwStatus.js` — interpret FPL fixtures for GW locking

**Files:**
- Create: `lib/gwStatus.js`
- Test: `test/gwStatus.test.js`

Small, easy to get wrong (postponed fixtures, partially-finished GWs) — worth its own tested module rather than inlining into `sync.js`.

- [ ] **Step 1: Write the failing tests**

Create `test/gwStatus.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextUnplayedGw, getLatestFinishedGw } from '../lib/gwStatus.js';

function fixture(event, finished) {
    return { event, finished, team_h: 1, team_a: 2 };
}

test('getNextUnplayedGw: first gw with any unfinished fixture', () => {
    const fixtures = [
        fixture(1, true), fixture(1, true),
        fixture(2, true), fixture(2, false),
        fixture(3, false)
    ];
    assert.equal(getNextUnplayedGw(fixtures), 2);
});

test('getNextUnplayedGw: null when every known gw is finished', () => {
    const fixtures = [fixture(1, true), fixture(2, true)];
    assert.equal(getNextUnplayedGw(fixtures), null);
});

test('getLatestFinishedGw: highest gw where every fixture finished, skipping a partially-finished later gw', () => {
    const fixtures = [
        fixture(1, true), fixture(1, true),
        fixture(2, true), fixture(2, true),
        fixture(3, true), fixture(3, false) // gw3 postponed fixture -> not finished
    ];
    assert.equal(getLatestFinishedGw(fixtures), 2);
});

test('getLatestFinishedGw: null when nothing has finished yet', () => {
    const fixtures = [fixture(1, false)];
    assert.equal(getLatestFinishedGw(fixtures), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/gwStatus.js'`

- [ ] **Step 3: Write `lib/gwStatus.js`**

```js
function getGwEventNumbers(fixturesData) {
    return [...new Set(fixturesData.map(f => f.event).filter(e => e !== null && e !== undefined))].sort((a, b) => a - b);
}

function isGwFinished(fixturesData, gw) {
    const gwFixtures = fixturesData.filter(f => f.event === gw);
    if (gwFixtures.length === 0) return false;
    return gwFixtures.every(f => f.finished === true);
}

export function getNextUnplayedGw(fixturesData) {
    const gws = getGwEventNumbers(fixturesData);
    for (const gw of gws) {
        if (!isGwFinished(fixturesData, gw)) return gw;
    }
    return null;
}

export function getLatestFinishedGw(fixturesData) {
    const gws = getGwEventNumbers(fixturesData);
    let latest = null;
    for (const gw of gws) {
        if (isGwFinished(fixturesData, gw)) latest = gw;
    }
    return latest;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gwStatus.js test/gwStatus.test.js
git commit -m "feat: add gwStatus helpers for locking gameweeks"
```

---

## Task 6: `lib/csv.js` — minimal CSV parser for the retro dataset

**Files:**
- Create: `lib/csv.js`
- Test: `test/csv.test.js`

The vaastav dataset's `fixtures.csv` has a `stats` column containing embedded JSON with commas and quotes (confirmed by pulling it live) — a naive `split(',')` will corrupt rows. Needs a real quoted-field-aware parser.

- [ ] **Step 1: Write the failing test**

Create `test/csv.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../lib/csv.js';

test('parseCsv: handles quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'a,b,c\n1,"hello, world",3\n4,"say ""hi""",6\n';
    const rows = parseCsv(csv);
    assert.deepEqual(rows, [
        { a: '1', b: 'hello, world', c: '3' },
        { a: '4', b: 'say "hi"', c: '6' }
    ]);
});

test('parseCsv: works without a trailing newline', () => {
    const csv = 'x,y\n1,2';
    assert.deepEqual(parseCsv(csv), [{ x: '1', y: '2' }]);
});

test('parseCsv: empty input returns no rows', () => {
    assert.deepEqual(parseCsv(''), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/csv.js'`

- [ ] **Step 3: Write `lib/csv.js`**

```js
export function parseCsv(text) {
    if (!text) return [];

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    while (i < text.length) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += char; i++; continue;
        }
        if (char === '"') { inQuotes = true; i++; continue; }
        if (char === ',') { pushField(); i++; continue; }
        if (char === '\r') { i++; continue; }
        if (char === '\n') { pushField(); pushRow(); i++; continue; }
        field += char; i++;
    }
    if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }

    const header = rows.shift();
    if (!header) return [];

    return rows
        .filter(r => r.length === header.length)
        .map(r => {
            const obj = {};
            header.forEach((h, idx) => { obj[h] = r[idx]; });
            return obj;
        });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.js test/csv.test.js
git commit -m "feat: add quoted-field-aware CSV parser for retro dataset"
```

---

## Task 7: `server.js` — persistent storage + backtest API

**Files:**
- Modify: `server.js`
- Test: `test/backtestApi.test.js`

Two changes bundled together: (1) point storage at the now-provisioned `/data` volume — fixes the pre-existing `cloud_drafts_store.json` durability bug as a direct side effect, and (2) add the backtest endpoints.

- [ ] **Step 1: Write the failing endpoint tests**

Create `test/backtestApi.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `/api/backtest/predictions` returns 404 (route doesn't exist yet), and `server` isn't exported.

- [ ] **Step 3: Modify `server.js`**

Add the import at the top (after the existing `url` import):

```js
import { fileURLToPath } from 'url';
import { createEmptyStore, applyPredictionSnapshot, applyActuals, getReport } from './lib/backtestStore.js';
```

Replace the storage-path setup block (currently `server.js:9-31`):

```js
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const PERSIST_DIR = process.env.FFH_PERSIST_DIR || (fs.existsSync('/data') ? '/data' : __dirname);

let STORAGE_FILE = path.join(PERSIST_DIR, 'cloud_drafts_store.json');
try {
    fs.writeFileSync(STORAGE_FILE + '.test', 'ok');
    fs.unlinkSync(STORAGE_FILE + '.test');
} catch (e) {
    STORAGE_FILE = '/tmp/cloud_drafts_store.json';
}

const BACKTEST_STORE_FILE = path.join(PERSIST_DIR, 'backtest_log.json');
const RETRO_REPORT_FILE = path.join(PERSIST_DIR, 'retro_backtest_report.json');

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

let backtestStore = createEmptyStore();
if (fs.existsSync(BACKTEST_STORE_FILE)) {
    try {
        backtestStore = JSON.parse(fs.readFileSync(BACKTEST_STORE_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to load backtest_log.json:', e);
    }
}

function saveBacktestStore() {
    try {
        fs.writeFileSync(BACKTEST_STORE_FILE, JSON.stringify(backtestStore, null, 2));
    } catch (e) {
        console.warn('Backtest store write skipped:', e.message);
    }
}
```

(`(el) => { STORAGE_FILE = '/tmp/...' }` fallback is kept as-is for the rare case `/data` itself is somehow unwritable — same defensive pattern the code already had, just pointed at the right directory first.)

Add the three new routes. Insert them right before the existing `// Static File Serving` comment (`server.js:170` in the original):

```js
    // API Route: Log Backtest Prediction Snapshot
    if (req.method === 'POST' && pathname === '/api/backtest/predictions') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number' || !Array.isArray(data.players)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw or players array' }));
                    return;
                }
                const result = applyPredictionSnapshot(backtestStore, {
                    gw: data.gw,
                    capturedAt: data.capturedAt || Date.now(),
                    players: data.players
                });
                backtestStore = result.store;
                saveBacktestStore();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, skipped: result.skipped }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Log Backtest Actual Results
    if (req.method === 'POST' && pathname === '/api/backtest/actuals') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number' || !Array.isArray(data.players)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw or players array' }));
                    return;
                }
                const result = applyActuals(backtestStore, { gw: data.gw, players: data.players });
                backtestStore = result.store;
                saveBacktestStore();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    skipped: result.skipped,
                    reason: result.reason || null,
                    pairCount: result.pairCount || 0
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Store the (manually-run) retrospective backtest report
    if (req.method === 'POST' && pathname === '/api/backtest/retro-report') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                JSON.parse(body); // validate it's well-formed JSON before persisting
                fs.writeFileSync(RETRO_REPORT_FILE, body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get Backtest Report (live forward-tracking by default, or ?source=retro)
    if (req.method === 'GET' && pathname === '/api/backtest/report') {
        const source = reqUrl.searchParams.get('source') || 'live';
        if (source === 'retro') {
            if (fs.existsSync(RETRO_REPORT_FILE)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(RETRO_REPORT_FILE, 'utf-8'));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Retro report not generated yet' }));
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getReport(backtestStore)));
        return;
    }

```

Finally, export `server` so tests can read its assigned port. Change the bottom of the file from:

```js
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
```

to:

```js
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

export { server };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `backtestApi.test.js` cases green, plus everything from Tasks 2-6 still passing.

- [ ] **Step 5: Commit**

```bash
git add server.js test/backtestApi.test.js
git commit -m "feat: add backtest API endpoints, persist storage on /data volume"
```

---

## Task 8: Refactor `sync.js` to use `lib/predictionModel.js`

**Files:**
- Modify: `sync.js`

Behavior-preserving refactor — replaces the inline formula block with calls into the module built in Task 2. No new tests here; correctness is already covered by `predictionModel.test.js`. Verification is a manual sync run (Task 13).

- [ ] **Step 1: Add the import**

At the top of `sync.js`, add:

```js
import fs from 'fs';
import { computeBasePPG, computeGwPrediction } from './lib/predictionModel.js';
```

- [ ] **Step 2: Replace the basePPG block**

Replace `sync.js:341-372` (from `let basePPG = 0.5;` through the position-clamp `if/else if` chain) with:

```js
        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: (manualOverride && manualOverride.basePPG !== undefined) ? manualOverride.basePPG : undefined
        });
```

- [ ] **Step 3: Delete the now-redundant local helper functions**

Delete `sync.js:373-417` in full — the `getCleanSheetProb` and `getExpectedSavePts` local function declarations (including their comment headers). These now live in `lib/predictionModel.js` and are used internally by `computeGwPrediction`; `sync.js` doesn't need to call them directly.

- [ ] **Step 4: Replace the per-GW prediction loop**

Replace the points-computation portion of the loop (originally `sync.js:419-490`, i.e. everything from `const predictions = [];` down to `pts = Math.max(0, Math.round(pts * 10) / 10);` inclusive) with:

```js
        const predictions = [];
        const fixtures = fixturesSchedule[teamShort] || [];

        for (let gw = 1; gw <= 38; gw++) {
            const fixture = fixtures.find(f => f.gw === gw) || { opp: 'BYE', loc: 'H', diff: 3 };
            const chanceOfPlaying = el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100;

            const { pts } = computeGwPrediction({
                basePPG,
                position,
                xG90,
                xA90,
                saves90,
                mppg,
                starts,
                chanceOfPlaying,
                fixture
            });
```

Everything after this point — the `// Calculate deterministic actual points if the fixture is completed` block through the closing `predictions.push({...})` and the loop's closing brace — is unchanged; it doesn't reference any of the variables that moved into `predictionModel.js`.

- [ ] **Step 5: Sanity-check the diff**

Run: `git diff sync.js`
Expected: the basePPG assignment, the two deleted helper functions, and the loop header are the only changes — the rest of `parseAndWriteData` (transfers, teams, `actualPts` simulation, `fileContent` template) is untouched.

- [ ] **Step 6: Commit**

```bash
git add sync.js
git commit -m "refactor: sync.js uses lib/predictionModel.js instead of inline formula"
```

---

## Task 9: Wire `sync.js` forward-tracking + calibration feed

**Files:**
- Modify: `sync.js`

- [ ] **Step 1: Add the gwStatus import and backtest API base URL constant**

Near the top of `sync.js`, alongside the other imports:

```js
import { getNextUnplayedGw, getLatestFinishedGw } from './lib/gwStatus.js';

const BACKTEST_API_BASE_URL = process.env.BACKTEST_API_BASE_URL || 'https://ffh-production.up.railway.app';
```

- [ ] **Step 2: Add the tracking function**

Add this function to `sync.js` (e.g. directly above `async function parseAndWriteData`):

```js
async function syncBacktestTracking(playersList, fixturesData) {
    let calibrationFactor = 0.90; // fallback if the backtest server is unreachable

    try {
        const reportRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/report`);
        if (!reportRes.ok) {
            console.warn('Backtest tracking skipped: report endpoint returned', reportRes.status);
            return calibrationFactor;
        }
        const report = await reportRes.json();
        if (typeof report.currentCalibrationFactor === 'number') {
            calibrationFactor = report.currentCalibrationFactor;
        }

        const nextUnplayedGw = getNextUnplayedGw(fixturesData);
        if (nextUnplayedGw !== null) {
            const predictionPlayers = playersList
                .map(p => {
                    const pred = p.predictions.find(pr => pr.gw === nextUnplayedGw);
                    return pred ? { id: p.id, position: p.position, price: p.price, pts: pred.pts } : null;
                })
                .filter(Boolean);

            await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/predictions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gw: nextUnplayedGw, capturedAt: Date.now(), players: predictionPlayers })
            });
            console.log(`Backtest: snapshotted predictions for GW${nextUnplayedGw}.`);
        }

        const latestFinishedGw = getLatestFinishedGw(fixturesData);
        const alreadyScored = latestFinishedGw !== null && Object.prototype.hasOwnProperty.call(report.byGw || {}, String(latestFinishedGw));
        if (latestFinishedGw !== null && !alreadyScored) {
            const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${latestFinishedGw}/live/`);
            if (liveRes.ok) {
                const liveData = await liveRes.json();
                const actualPlayers = liveData.elements.map(e => ({
                    id: e.id,
                    actualPts: e.stats.total_points,
                    minutesPlayed: e.stats.minutes
                }));
                const actualsRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/actuals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gw: latestFinishedGw, players: actualPlayers })
                });
                if (actualsRes.ok) {
                    const actualsBody = await actualsRes.json();
                    console.log(`Backtest: scored GW${latestFinishedGw} (${actualsBody.pairCount} players matched).`);
                }
            }
        }
    } catch (err) {
        console.warn('Backtest tracking skipped (non-fatal):', err.message);
    }

    return calibrationFactor;
}
```

- [ ] **Step 3: Call it before writing `data.js`, and bake the factor into the output**

In `parseAndWriteData`, right before the `// Write file content` comment (originally `sync.js:689`), add:

```js
    const calibrationFactor = await syncBacktestTracking(playersList, fixturesData);
```

Then in the template literal itself, add the export right after `export const TICKER_DATA = ...;`:

```js
export const TICKER_DATA = ${JSON.stringify(fixturesSchedule, null, 4)};

export const XP_CALIBRATION_FACTOR = ${calibrationFactor};

```

- [ ] **Step 4: Sanity-check the diff**

Run: `git diff sync.js`
Expected: new import, new constant, new `syncBacktestTracking` function, one new `await` call, and one new line in the `fileContent` template. Nothing else changed.

- [ ] **Step 5: Commit**

```bash
git add sync.js
git commit -m "feat: wire sync.js forward-tracking + calibration factor into data.js"
```

---

## Task 10: `app.js` — consume the synced calibration factor

**Files:**
- Modify: `app.js`

Since `data.js` won't have `XP_CALIBRATION_FACTOR` exported until the next successful sync (it's a generated file, not something this change touches directly), this needs a safe fallback for the transition period.

- [ ] **Step 1: Update the import**

Change `app.js:1`:

```js
import { PLAYERS, DEFAULT_SQUAD } from './data.js';
```

to:

```js
import { PLAYERS, DEFAULT_SQUAD, XP_CALIBRATION_FACTOR as SYNCED_XP_CALIBRATION_FACTOR } from './data.js';
```

- [ ] **Step 2: Replace the hardcoded constant**

Replace `app.js:85-91`:

```js
// Universal dataset-wide minutes & rotation risk discounting for all 700+ players.
// CALIBRATION_FACTOR: scales raw predictions down to realistic FPL score levels.
// Real-world FPL sites estimate a good squad at 50-65 GW pts; our raw data averages 70+ 
// due to historical PPG including bonus pts & easy-fixture multipliers stacking.
// 0.82 brings elite players (Saka 9.3→7.6, Bruno 9.1→7.5) to realistic levels, and 
// typical squads from 70+ to the expected 55-65 range.
const XP_CALIBRATION_FACTOR = 0.90;
```

with:

```js
// Calibration factor is now computed and auto-tuned server-side by the backtest
// infrastructure (see lib/calibration.js), baked into data.js by sync.js on each
// sync run. 0.90 here is only the fallback used before data.js has ever been
// re-synced with the new export (or if a sync run failed to reach the backtest
// server) — see docs/superpowers/specs/2026-08-10-xp-backtest-infra-design.md.
const XP_CALIBRATION_FACTOR = (typeof SYNCED_XP_CALIBRATION_FACTOR === 'number') ? SYNCED_XP_CALIBRATION_FACTOR : 0.90;
```

- [ ] **Step 3: Verify nothing else in app.js references the old local-only constant differently**

Run: `grep -n "XP_CALIBRATION_FACTOR" app.js`
Expected: only the import line and the two lines just edited — `window.applyUniversalMinutesDiscount` (further down) already references `XP_CALIBRATION_FACTOR` by name and needs no change.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: app.js consumes synced calibration factor, with safe fallback"
```

---

## Task 11: `scripts/retro-backtest.js` — retrospective validation

**Files:**
- Create: `scripts/retro-backtest.js`
- Test: `test/retroBacktest.test.js`

Confirmed live against the real dataset before writing this task: `data/2024-25/players_raw.csv` (805 rows, season aggregate, has `code`, `element_type`, `minutes`, `starts`, `total_points`, `now_cost`, `expected_goals_per_90`, `expected_assists_per_90`, `saves_per_90`), `data/2025-26/players_raw.csv` (id/code/team mapping for the validation season), `data/2025-26/teams.csv` (id -> short_name), `data/2025-26/fixtures.csv` (event, team_h/a, team_h/a_difficulty — has an embedded-JSON `stats` column, hence Task 6's real CSV parser), `data/2025-26/gws/merged_gw.csv` (29758 rows, real per-GW actuals, has `element`, `GW`, `total_points`, `minutes`).

Known, documented simplifications versus the live model (acceptable for a first "before" baseline, not silent):
- No manual `ROLE_OVERRIDES`/`KNOWN_TRANSFERS` — those are current-season hand lists that don't apply to a historical season.
- `isPromotedOrTransfer` is inferred generically as "zero baseline-season minutes" rather than a hardcoded team list.
- `chanceOfPlaying` is always 100 — no historical week-by-week injury data is available from this dataset, so the retro run cannot account for players who missed time to injury. This means retro-predicted points likely run slightly high versus reality for injury-affected players; that's a known, stated limitation of this baseline, not a bug.

- [ ] **Step 1: Write the failing test for the pure join/aggregation logic**

Create `test/retroBacktest.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetroPairs } from '../scripts/retro-backtest.js';
import { computeGwPrediction, computeBasePPG } from '../lib/predictionModel.js';

test('buildRetroPairs: joins baseline aggregate to validation-season GW rows by stable player code', () => {
    const baselineRows = [
        { code: '111', element_type: '3', minutes: '3000', starts: '35', total_points: '175', expected_goals_per_90: '0.30', expected_assists_per_90: '0.20', saves_per_90: '0' }
    ];
    const validationPlayersRows = [
        { id: '50', code: '111', element_type: '3', team: '1', now_cost: '80' }
    ];
    const validationTeamsRows = [
        { id: '1', short_name: 'ARS' },
        { id: '2', short_name: 'BHA' }
    ];
    const validationFixturesRows = [
        { event: '1', team_h: '1', team_a: '2', team_h_difficulty: '2', team_a_difficulty: '3' }
    ];
    const validationGwRows = [
        { element: '50', GW: '1', total_points: '8', minutes: '90' }
    ];

    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });

    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].actualPts, 8);
    assert.equal(pairs[0].minutesPlayed, 90);
    assert.equal(pairs[0].position, 'MID');
    assert.equal(pairs[0].price, 8.0);

    // Cross-check against calling the formula directly with the same derived inputs
    const basePPG = computeBasePPG({
        minutes: 3000, appearances: 35, totalPoints: 175, position: 'MID',
        teamShort: 'ARS', price: 8.0, isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    const expected = computeGwPrediction({
        basePPG, position: 'MID', xG90: 0.30, xA90: 0.20, saves90: 0,
        mppg: 3000 / 35, starts: 35, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 2 }
    });
    assert.equal(pairs[0].predictedPts, expected.pts);
});

test('buildRetroPairs: a validation player with no baseline-season history is treated as promoted/transferred', () => {
    const baselineRows = []; // no history at all
    const validationPlayersRows = [{ id: '99', code: '222', element_type: '4', team: '1', now_cost: '55' }];
    const validationTeamsRows = [{ id: '1', short_name: 'ARS' }, { id: '2', short_name: 'BHA' }];
    const validationFixturesRows = [{ event: '1', team_h: '1', team_a: '2', team_h_difficulty: '3', team_a_difficulty: '3' }];
    const validationGwRows = [{ element: '99', GW: '1', total_points: '2', minutes: '60' }];

    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });
    assert.equal(pairs.length, 1);

    // Cross-check against the formula directly rather than hand-computing the rounded
    // float — basePPG for a zero-minutes "promoted/transferred" FWD is the position
    // default (3.5), then the normal home-fixture/rounding rules apply on top.
    const basePPG = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0, position: 'FWD',
        teamShort: 'ARS', price: 5.5, isPromotedOrTransfer: true, manualOverridePPG: undefined
    });
    const expected = computeGwPrediction({
        basePPG, position: 'FWD', xG90: 0, xA90: 0, saves90: 0,
        mppg: 0, starts: 0, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 3 }
    });
    assert.equal(pairs[0].predictedPts, expected.pts);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../scripts/retro-backtest.js'` (or `buildRetroPairs` not exported).

- [ ] **Step 3: Write `scripts/retro-backtest.js`**

```js
import fs from 'fs';
import { parseCsv } from '../lib/csv.js';
import { computeBasePPG, computeGwPrediction } from '../lib/predictionModel.js';
import { computeErrorMetrics, bandForPrice, bracketForMinutes } from '../lib/calibration.js';

const BASELINE_SEASON = '2024-25';
const VALIDATION_SEASON = '2025-26';
const RAW_BASE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const POSITION_MAP = { '1': 'GKP', '2': 'DEF', '3': 'MID', '4': 'FWD' };

export function buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows }) {
    const baselineByCode = new Map(baselineRows.map(r => [r.code, r]));
    const teamShortById = new Map(validationTeamsRows.map(t => [t.id, t.short_name]));

    // Build each validation team's fixture schedule, same shape the live model uses.
    const fixturesSchedule = {};
    validationTeamsRows.forEach(t => { fixturesSchedule[t.short_name] = []; });
    validationFixturesRows.forEach(f => {
        const gw = parseInt(f.event, 10);
        if (!gw) return;
        const homeShort = teamShortById.get(f.team_h);
        const awayShort = teamShortById.get(f.team_a);
        if (homeShort) fixturesSchedule[homeShort].push({ gw, opp: awayShort, loc: 'H', diff: parseInt(f.team_h_difficulty, 10) });
        if (awayShort) fixturesSchedule[awayShort].push({ gw, opp: homeShort, loc: 'A', diff: parseInt(f.team_a_difficulty, 10) });
    });

    // Real actual points/minutes per validation-season element id per GW.
    const actualsByElementGw = new Map();
    validationGwRows.forEach(row => {
        const key = `${row.element}_${row.GW}`;
        actualsByElementGw.set(key, { actualPts: parseFloat(row.total_points) || 0, minutesPlayed: parseInt(row.minutes, 10) || 0 });
    });

    const pairs = [];

    validationPlayersRows.forEach(vp => {
        const baseline = baselineByCode.get(vp.code);
        const position = POSITION_MAP[vp.element_type];
        const teamShort = teamShortById.get(vp.team);
        const price = (parseInt(vp.now_cost, 10) || 0) / 10;
        if (!position || !teamShort) return;

        const minutes = baseline ? (parseInt(baseline.minutes, 10) || 0) : 0;
        const starts = baseline ? (parseInt(baseline.starts, 10) || 0) : 0;
        const totalPoints = baseline ? (parseInt(baseline.total_points, 10) || 0) : 0;
        const appearances = starts > 0 ? starts : (minutes > 0 ? 1 : 0);
        const isPromotedOrTransfer = minutes === 0;

        const basePPG = computeBasePPG({
            minutes, appearances, totalPoints, position, teamShort, price,
            isPromotedOrTransfer, manualOverridePPG: undefined
        });

        const xG90 = baseline ? (parseFloat(baseline.expected_goals_per_90) || 0) : 0;
        const xA90 = baseline ? (parseFloat(baseline.expected_assists_per_90) || 0) : 0;
        const saves90 = baseline ? (parseFloat(baseline.saves_per_90) || 0) : 0;
        const mppg = appearances > 0 ? minutes / appearances : 0;

        const schedule = fixturesSchedule[teamShort] || [];
        schedule.forEach(fx => {
            const actual = actualsByElementGw.get(`${vp.id}_${fx.gw}`);
            if (!actual) return; // GW not played yet / player not in that GW's data

            const { pts } = computeGwPrediction({
                basePPG, position, xG90, xA90, saves90, mppg, starts,
                chanceOfPlaying: 100,
                fixture: { opp: fx.opp, loc: fx.loc, diff: fx.diff }
            });

            pairs.push({
                position,
                price,
                predictedPts: pts,
                actualPts: actual.actualPts,
                minutesPlayed: actual.minutesPlayed
            });
        });
    });

    return pairs;
}

function buildReport(pairs) {
    const byPosition = {};
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        byPosition[pos] = computeErrorMetrics(pairs.filter(p => p.position === pos));
    });
    const byPriceBand = {};
    ['<5.0', '5.0-7.4', '7.5-9.9', '>=10.0'].forEach(band => {
        byPriceBand[band] = computeErrorMetrics(pairs.filter(p => bandForPrice(p.price) === band));
    });
    const byMinutesBracket = {};
    ['0', '1-59', '60+'].forEach(bracket => {
        byMinutesBracket[bracket] = computeErrorMetrics(pairs.filter(p => bracketForMinutes(p.minutesPlayed) === bracket));
    });

    return {
        source: 'retro',
        baselineSeason: BASELINE_SEASON,
        validationSeason: VALIDATION_SEASON,
        generatedAt: new Date().toISOString(),
        overall: computeErrorMetrics(pairs),
        byPosition,
        byPriceBand,
        byMinutesBracket
    };
}

async function fetchCsv(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return parseCsv(await res.text());
}

async function main() {
    console.log(`Fetching baseline season ${BASELINE_SEASON} aggregate...`);
    const baselineRows = await fetchCsv(`${RAW_BASE}/${BASELINE_SEASON}/players_raw.csv`);

    console.log(`Fetching validation season ${VALIDATION_SEASON} players/teams/fixtures/gw data...`);
    const validationPlayersRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/players_raw.csv`);
    const validationTeamsRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/teams.csv`);
    const validationFixturesRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/fixtures.csv`);
    const validationGwRows = await fetchCsv(`${RAW_BASE}/${VALIDATION_SEASON}/gws/merged_gw.csv`);

    console.log('Building predicted-vs-actual pairs...');
    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });
    console.log(`${pairs.length} predicted-vs-actual player-GW pairs built.`);

    const report = buildReport(pairs);
    fs.writeFileSync('retro_backtest_report.local.json', JSON.stringify(report, null, 2));
    console.log('Wrote retro_backtest_report.local.json');
    console.log('Overall MAE/RMSE:', report.overall);

    const targetUrl = process.env.BACKTEST_API_BASE_URL || 'https://ffh-production.up.railway.app';
    try {
        const postRes = await fetch(`${targetUrl}/api/backtest/retro-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        if (postRes.ok) {
            console.log(`Posted retro report to ${targetUrl}/api/backtest/retro-report`);
        } else {
            console.warn(`Failed to post retro report: ${postRes.status}`);
        }
    } catch (err) {
        console.warn('Could not reach backtest server to store retro report (saved locally only):', err.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error('Retro backtest failed:', err);
        process.exit(1);
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — `retroBacktest.test.js` green, and the full suite from Tasks 2-10 still green.

- [ ] **Step 5: Commit**

```bash
git add scripts/retro-backtest.js test/retroBacktest.test.js
git commit -m "feat: add retrospective backtest script against vaastav dataset"
```

---

## Task 12: Wire `BACKTEST_API_BASE_URL` into the GitHub Actions sync workflow

**Files:**
- Modify: `.github/workflows/sync.yml`

This changes CI/CD config — confirm with the user before pushing, per standard practice for pipeline changes. The plan captures the change; execution should still pause for a explicit go-ahead on this step specifically since it affects the live automated pipeline.

- [ ] **Step 1: Add the env var to the sync step**

In `.github/workflows/sync.yml`, the existing sync step is:

```yaml
      - name: 🌐 Sync live FPL data
        run: node sync.js
        env:
          NODE_OPTIONS: '--no-warnings'
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

Change it to:

```yaml
      - name: 🌐 Sync live FPL data
        run: node sync.js
        env:
          NODE_OPTIONS: '--no-warnings'
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          BACKTEST_API_BASE_URL: https://ffh-production.up.railway.app
```

(Plain env value, not a secret — it's a public URL, matching how `sync.js` already defaults to it if the env var is absent.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync.yml
git commit -m "ci: point scheduled sync at the backtest API for forward-tracking"
```

---

## Task 13: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every test file from Tasks 2-11 passes, 0 failures.

- [ ] **Step 2: Run a local sync and diff the output**

Run: `npm run sync`
Expected: `data.js` regenerates without throwing. Since the local backtest server isn't reachable from a dev machine unless the volume/deploy from Task 7 is live, expect the console to log `Backtest tracking skipped (non-fatal): ...` — that's the designed fallback behavior, not a failure. Confirm via `git diff data.js` that player prediction values are in the same ballpark as before (no NaNs, no wildly different totals) and that `export const XP_CALIBRATION_FACTOR = 0.9;` now appears in the file.

- [ ] **Step 3: Run the retro backtest once, manually**

Run: `node scripts/retro-backtest.js`
Expected: logs progress through each CSV fetch, ends with an MAE/RMSE summary printed to the console and `retro_backtest_report.local.json` written locally. This is genuinely the first real accuracy read on the current model — inspect the numbers together before deciding what Phase 2 should target first.

- [ ] **Step 4: After Task 7 and Task 12 are deployed, confirm the live loop end-to-end**

Once the server is redeployed (activating the `/data` volume) and the GitHub Actions workflow has the new env var, watch the next scheduled sync run's logs for `Backtest: snapshotted predictions for GW...` and, once a real GW finishes, `Backtest: scored GW... (N players matched)`. Hit `GET https://ffh-production.up.railway.app/api/backtest/report` directly in a browser to see the live report.

---

## Self-review notes

- **Spec coverage:** every numbered item in the design doc's Architecture section (1-5) maps to a task: formula extraction -> Task 2 & 8; forward tracking -> Task 5, 7, 9; retro validation -> Task 6, 11; server storage -> Task 7; calibration auto-tune -> Task 3, 4; consuming the tuned factor live -> Task 10 (this was implicit in "auto apply" from the brainstorming conversation, not spelled out in the design doc's Architecture section — added explicitly here since without it, "auto apply" would only update a number in a report nobody reads).
- **Type consistency check:** `applyPredictionSnapshot` and `applyActuals` both return `{ store, skipped, ... }` (fixed during planning — an earlier draft had `applyPredictionSnapshot` return a bare `store`, which would have been a real bug given `server.js` and the simulation tests call both functions the same way).
- **No placeholders:** the retro dataset's exact file paths, column names, and row counts were verified live against `raw.githubusercontent.com` before Task 11 was written, rather than assumed.
