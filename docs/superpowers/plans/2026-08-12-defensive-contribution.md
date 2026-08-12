# Defensive Contribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire FPL's real per-player defensive-contribution rate into core XP (`computeGwPrediction`), and fix the "Defcon Potential" UI badge which currently reflects fixture-ease odds instead of real defensive output.

**Architecture:** Follows the exact structure of the existing GK-saves precedent (`getExpectedSavePts`) — a real per-90 rate converted to expected points, undamped (not the dampened penalty-duty pattern), gated by position and scaled by expected minutes. `sync.js` computes a real `dcPer90` per player (regressed toward a real league-average baseline for low-minutes players, same pattern as `saves90`), passes it into `computeGwPrediction`, and reuses it to fix the mislabeled badge in `getPlayerRatings`.

**Tech Stack:** Vanilla JS ES modules, `node:test` test runner.

---

### Task 1: `getExpectedDefconPts` in `lib/predictionModel.js`

**Files:**
- Modify: `lib/predictionModel.js` (add new constant + function after `getExpectedSavePts`, which currently ends at line 302; also modify `computeSetPieceAdj`'s neighborhood is untouched — this is a fully separate function)
- Test: `test/predictionModel.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/predictionModel.test.js`, after the existing `getExpectedSavePts` tests (find the last `test('getExpectedSavePts...` block and add these after it). First add `getExpectedDefconPts` to the import list at the top of the file:

```js
import {
    computeBasePPG,
    getCleanSheetProb,
    getExpectedSavePts,
    getExpectedDefconPts,
    getAttackMultiplier,
    computeGoalsConcededNudge,
    computeLeagueAverageGoalsConceded90,
    computeGwPrediction
} from '../lib/predictionModel.js';
```

Then add the tests:

```js
test('getExpectedDefconPts: GKP always returns 0 regardless of input', () => {
    assert.equal(getExpectedDefconPts({ position: 'GKP', dcPer90: 20, mppg: 90 }), 0);
});

test('getExpectedDefconPts: DEF well above threshold gets the top hitProb tier (0.75 * 2 = 1.5, full minutes)', () => {
    // threshold DEF = 10, ratio 14/10 = 1.4 -> top tier
    const pts = getExpectedDefconPts({ position: 'DEF', dcPer90: 14, mppg: 90 });
    assert.equal(pts, 1.5);
});

test('getExpectedDefconPts: MID right at threshold gets the mid tier (0.55 * 2 = 1.1, full minutes)', () => {
    // threshold MID = 12, ratio 13.2/12 = 1.1 -> second tier
    const pts = getExpectedDefconPts({ position: 'MID', dcPer90: 13.2, mppg: 90 });
    assert.equal(pts, 1.1);
});

test('getExpectedDefconPts: FWD well below threshold gets the floor tier (0.05 * 2 = 0.1, full minutes)', () => {
    // real league average FWD rate (4.50) is well under threshold 12 -> ratio 0.375 -> floor tier
    const pts = getExpectedDefconPts({ position: 'FWD', dcPer90: 4.5, mppg: 90 });
    assert.equal(Math.round(pts * 100) / 100, 0.1);
});

test('getExpectedDefconPts: mppg below 90 scales the result down proportionally', () => {
    const full = getExpectedDefconPts({ position: 'DEF', dcPer90: 14, mppg: 90 });
    const half = getExpectedDefconPts({ position: 'DEF', dcPer90: 14, mppg: 45 });
    assert.equal(Math.round(half * 100) / 100, Math.round((full * 0.5) * 100) / 100);
});

test('getExpectedDefconPts: dcPer90 of 0 or missing returns 0, not NaN or negative', () => {
    assert.equal(getExpectedDefconPts({ position: 'DEF', dcPer90: 0, mppg: 90 }), 0);
    assert.equal(getExpectedDefconPts({ position: 'DEF', mppg: 90 }), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -i defcon`
Expected: FAIL — `getExpectedDefconPts is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `getExpectedDefconPts`**

In `lib/predictionModel.js`, add this immediately after `getExpectedSavePts` (which ends at line 302, right before the `PENALTY_DUTY_BONUS` comment block):

```js
// Real FPL thresholds (2025/26+): DEF need 10 combined clearances+blocks+interceptions+tackles in a
// match; MID/FWD need 12 combined (same + recoveries). Flat +2 pts, no partial credit for
// overshooting. Verified against Premier League's own 2025/26 rules announcement.
const DEFCON_THRESHOLD = { DEF: 10, MID: 12, FWD: 12 };

/**
 * Expected defensive-contribution points for a fixture, from a player's real season per-90 combined
 * defensive-actions rate. FPL only exposes a season-aggregate per-90 rate, not match-by-match logs,
 * so hitProb is a bucketed heuristic (ratio of real rate to the real threshold), not a fitted
 * distribution -- deliberately conservative around ratio=1.0: real league data (min. 900 minutes,
 * fetched fresh this session) shows only ~16% of DEF and ~6% of MID average at or above their own
 * threshold across a full season, so sitting exactly at it is already a strong outcome, not a coin
 * flip (see BASE_DC90's comment in sync.js for the same real numbers).
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Returns 0 for GKP (rule doesn't apply).
 * @param {number} dcPer90 - Player's real combined-defensive-actions rate per 90 minutes.
 * @param {number} mppg - Minutes per game played (scales down partial-appearance players).
 * @returns {number} Expected defensive-contribution points for the fixture.
 */
export function getExpectedDefconPts({ position, dcPer90, mppg }) {
    const threshold = DEFCON_THRESHOLD[position];
    if (!threshold || !(dcPer90 > 0)) return 0;
    const ratio = dcPer90 / threshold;
    let hitProb;
    if (ratio >= 1.4) hitProb = 0.75;
    else if (ratio >= 1.1) hitProb = 0.55;
    else if (ratio >= 0.9) hitProb = 0.35;
    else if (ratio >= 0.7) hitProb = 0.15;
    else hitProb = 0.05;
    const minutesFactor = Math.min(1.0, (mppg || 0) / 90);
    return hitProb * 2 * minutesFactor;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -i defcon`
Expected: All 6 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: add getExpectedDefconPts, a real per-90-rate defensive-contribution points model"
```

---

### Task 2: Wire `defconAdj` into `computeGwPrediction`

**Files:**
- Modify: `lib/predictionModel.js:355-451` (function signature, breakdown init, DEF/MID/FWD branches)
- Test: `test/predictionModel.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/predictionModel.test.js`:

```js
test('computeGwPrediction: DEF gets defconAdj from a real dcPer90 rate', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };
    const withDc = computeGwPrediction({ ...base, dcPer90: 14 });
    const withoutDc = computeGwPrediction(base);
    assert.equal(withDc.breakdown.defconAdj, 1.5);
    assert.equal(withoutDc.breakdown.defconAdj, 0);
    assert.ok(withDc.pts > withoutDc.pts);
});

test('computeGwPrediction: MID gets defconAdj from a real dcPer90 rate', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 4.5, position: 'MID', xG90: 0.1, xA90: 0.1, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture, dcPer90: 13.2 };
    const { breakdown } = computeGwPrediction(base);
    assert.equal(breakdown.defconAdj, 1.1);
});

test('computeGwPrediction: FWD gets a small defconAdj from a real (low) dcPer90 rate', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 5.0, position: 'FWD', xG90: 0.4, xA90: 0.1, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture, dcPer90: 4.5 };
    const { breakdown } = computeGwPrediction(base);
    assert.equal(Math.round(breakdown.defconAdj * 100) / 100, 0.1);
});

test('computeGwPrediction: GKP never gets defconAdj even if dcPer90 is passed', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture, dcPer90: 20 };
    const { breakdown } = computeGwPrediction(base);
    assert.equal(breakdown.defconAdj, 0);
});

test('computeGwPrediction: omitting dcPer90 entirely does not throw and matches passing 0', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };
    const omitted = computeGwPrediction(base);
    const explicitZero = computeGwPrediction({ ...base, dcPer90: 0 });
    assert.equal(omitted.pts, explicitZero.pts);
    assert.equal(omitted.breakdown.defconAdj, explicitZero.breakdown.defconAdj);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -i defconAdj`
Expected: FAIL — `breakdown.defconAdj` is `undefined` (property doesn't exist yet).

- [ ] **Step 3: Wire `defconAdj` into `computeGwPrediction`**

In `lib/predictionModel.js`, update the function signature (currently at line 355) to accept `dcPer90`:

```js
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90, setPieceDuty, dcPer90 }) {
```

Update the `breakdown` initializer (currently at line 356) to include the new field:

```js
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0, setPieceAdj: 0, defconAdj: 0 };
```

In the DEF branch (currently lines 412-416, the `else` under `if (position === 'GKP')`), add `defconAdj` right after `setPieceAdj`:

```js
            } else {
                // --- Set-piece duty contribution (DEF only; GKP excluded above) ---
                breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
                pts += breakdown.setPieceAdj;

                // --- Defensive-contribution points (DEF only here; GKP excluded above) ---
                breakdown.defconAdj = getExpectedDefconPts({ position, dcPer90, mppg });
                pts += breakdown.defconAdj;
            }
```

In the MID branch (currently lines 435-436, right after `setPieceAdj`), add:

```js
            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;

            breakdown.defconAdj = getExpectedDefconPts({ position, dcPer90, mppg });
            pts += breakdown.defconAdj;
        } else {
```

In the FWD branch (currently lines 446-447, right after `setPieceAdj`), add:

```js
            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;

            breakdown.defconAdj = getExpectedDefconPts({ position, dcPer90, mppg });
            pts += breakdown.defconAdj;
        }
```

Also update the JSDoc block above the function (currently ending around line 352, right before the function signature) to document the new parameter — add this line after the existing `setPieceDuty` `@param` line:

```js
 * @param {number|null|undefined} dcPer90 - Player's real combined-defensive-actions rate per 90 minutes (see getExpectedDefconPts; ignored for GKP; treated as 0/no contribution if omitted).
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS (new ones plus the full existing suite — this confirms no regression in the untouched GKP/legacy paths).

- [ ] **Step 5: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: wire real defensive-contribution rate into computeGwPrediction (defconAdj)"
```

---

### Task 3: Compute real `dcPer90` in `sync.js` (pass 1) and pass it through

**Files:**
- Modify: `sync.js:360-438` (pass-1 regression block and player object), `sync.js:457-477` (pass-2 destructure and `computeGwPrediction` call), `sync.js:546-577` (final public player object)

- [ ] **Step 1: Add the `dcPer90` regression in pass 1**

In `sync.js`, immediately after the existing `goalsConceded90` regression block (currently lines 365-367, right before `let appearances = starts;`), add:

```js
        // Real league averages this season (min. 900 minutes, i.e. ~10 full games, so the baseline
        // itself isn't distorted by the same small-sample problem this regression exists to fix):
        // DEF 7.76 (n=98), MID 8.38 (n=126), FWD 4.50 (n=24) -- computed directly from a fresh
        // bootstrap-static pull. Only ~16% of qualifying DEF and ~6% of qualifying MID average at or
        // above their own real threshold across a full season -- confirms sitting at the threshold
        // is already an elite outcome, not a median one (see getExpectedDefconPts's comment in
        // lib/predictionModel.js, which the hit-probability mapping is calibrated against).
        const BASE_DC90 = { GKP: 0, DEF: 7.76, MID: 8.38, FWD: 4.50 };
        const rawDcPer90 = parseFloat(el.defensive_contribution_per_90) || 0;
        const baseDc90 = BASE_DC90[position] || 0;
        const dcPer90 = minutes >= 450 ? rawDcPer90 : baseDc90 + (rawDcPer90 - baseDc90) * sampleSizeFactor;
```

Then add `dcPer90` to the pass-1 return object (currently lines 393-438) — add this line right after the existing `goalsConceded90: parseFloat(goalsConceded90.toFixed(2)),` line:

```js
            dcPer90: parseFloat(dcPer90.toFixed(2)),
```

- [ ] **Step 2: Pass `dcPer90` through pass 2 to `computeGwPrediction`**

Update the pass-2 destructure (currently line 457):

```js
        const { basePPG, mppg, starts, minutes, rawStarts, dcPer90 } = player;
```

Update the `computeGwPrediction` call (currently lines 464-477) to pass it:

```js
            const { pts } = computeGwPrediction({
                basePPG,
                position: player.position,
                xG90: player.xG90,
                xA90: player.xA90,
                saves90: player.saves90,
                mppg,
                starts,
                chanceOfPlaying: player.chanceOfPlaying,
                fixture,
                goalsConceded90: player.goalsConceded90,
                leagueAvgGoalsConceded90,
                setPieceDuty: player.setPieceDuty,
                dcPer90
            });
```

- [ ] **Step 3: Expose `dcPer90` on the public player schema**

`getPlayerRatings` (Task 4) runs both in `sync.js` and, via `data.js`'s re-export, directly in the browser on `PLAYERS` objects — so `dcPer90` must be part of the public schema, the same way `saves90` already is. In the final public player object (currently lines 546-577), add this line right after the existing `goalsConceded90: player.goalsConceded90,` line:

```js
            dcPer90: player.dcPer90,
```

- [ ] **Step 4: Verify with a real sync**

Run: `node sync.js`
Expected: Sync completes without errors. Then spot-check:

```bash
node -e "
import('./data.js').then(mod => {
  const p = mod.PLAYERS.find(p => p.web_name === 'Rice') || mod.PLAYERS.find(p => p.position === 'MID');
  console.log(p.web_name, 'dcPer90:', p.dcPer90, 'position:', p.position);
});
"
```

Expected: A real, non-zero `dcPer90` value printed for an established midfielder.

- [ ] **Step 5: Commit**

```bash
git add sync.js
git commit -m "feat: compute real dcPer90 per player in sync.js, pass into computeGwPrediction"
```

Note: this task intentionally does not update `scripts/retro-backtest.js` to pass `dcPer90` — that mirrors the existing, already-flagged gap where `retro-backtest.js` doesn't pass `setPieceDuty` either. Both are deferred to a separate follow-up the user has already asked for after this feature ships.

---

### Task 4: Fix the mislabeled "Defcon Potential" badge in `getPlayerRatings`

**Files:**
- Modify: `sync.js:856-885`

- [ ] **Step 1: Replace the fixture-odds-based computation with a real dcPer90-based grade**

In `sync.js`, replace the entire block currently at lines 856-885:

```js
    // 5. Defcon Potential (clean sheet potential. N/A for FWD)
    let defconPotential = 'N/A';
    if (pos !== 'FWD') {
        let sumOdds = 0;
        let count = 0;
        if (player.predictions && player.predictions.length > 0) {
            for (let gw = currentGw; gw < currentGw + 5; gw++) {
                const pred = player.predictions.find(p => p.gw === gw);
                if (pred && pred.opp !== 'BYE') {
                    let base = 30;
                    if (pred.diff === 2) base = 48;
                    else if (pred.diff === 4) base = 18;
                    else if (pred.diff === 5) base = 8;
                    
                    if (pred.loc === 'H') base += 5;
                    else base -= 5;
                    
                    sumOdds += base;
                    count++;
                }
            }
        }
        const avgOdds = count > 0 ? (sumOdds / count) : 25;
        if (avgOdds >= 40) defconPotential = 'A';
        else if (avgOdds >= 30) defconPotential = 'B';
        else if (avgOdds >= 20) defconPotential = 'C';
        else if (avgOdds >= 10) defconPotential = 'D';
        else defconPotential = 'E';
    }
```

with:

```js
    // 5. Defcon Potential (real defensive-contribution output: combined tackles/interceptions/
    // clearances(+recoveries for MID/FWD) per 90, vs. the real FPL per-match threshold. N/A for
    // FWD/GKP -- FWD real rates average well under threshold (4.50 vs. 12, see BASE_DC90's comment
    // in the pass-1 loop above), so a graded badge for them would mostly just read "E" and add no
    // useful signal; GKP don't earn these points at all under the real rule.
    let defconPotential = 'N/A';
    if (pos === 'DEF' || pos === 'MID') {
        const threshold = pos === 'DEF' ? 10 : 12;
        const dcRatio = (player.dcPer90 || 0) / threshold;
        if (dcRatio >= 1.4) defconPotential = 'A';
        else if (dcRatio >= 1.1) defconPotential = 'B';
        else if (dcRatio >= 0.9) defconPotential = 'C';
        else if (dcRatio >= 0.7) defconPotential = 'D';
        else defconPotential = 'E';
    }
```

Note the behavior change: GKP now gets `N/A` instead of a graded odds-based badge (previously `pos !== 'FWD'` included GKP). This is more correct — GKP cannot earn defensive-contribution points under the real rule — and `components/planner.js`'s existing "Best Defcon" badge logic already only checks `DEF`/`MID`, so this doesn't break anything there.

- [ ] **Step 2: Manual verification**

Run: `node sync.js` (if not already re-run from Task 3), then:

```bash
node -e "
import('./data.js').then(mod => {
  const { getPlayerRatings } = mod;
  const rice = mod.PLAYERS.find(p => p.web_name === 'Rice');
  const gk = mod.PLAYERS.find(p => p.position === 'GKP');
  const fwd = mod.PLAYERS.find(p => p.position === 'FWD');
  console.log('Rice (MID) defconPotential:', getPlayerRatings(rice, 1).defconPotential);
  console.log('A GKP defconPotential (expect N/A):', getPlayerRatings(gk, 1).defconPotential);
  console.log('A FWD defconPotential (expect N/A):', getPlayerRatings(fwd, 1).defconPotential);
});
"
```

Expected: Rice (a known real ball-winner) grades A or B; GKP and FWD both show `N/A`.

- [ ] **Step 3: Commit**

```bash
git add sync.js
git commit -m "fix: Defcon Potential badge now reflects real defensive output, not fixture-ease odds"
```

---

### Task 5: Full regression + manual verification

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (existing suite + all new tests from Tasks 1-2), 0 failures.

- [ ] **Step 2: Manual spot-check against real data**

```bash
node -e "
import('./data.js').then(mod => {
  const names = ['Rice', 'Ndiaye'];
  names.forEach(n => {
    const p = mod.PLAYERS.find(pl => pl.web_name === n);
    if (!p) { console.log(n, 'not found'); return; }
    console.log(n, 'dcPer90:', p.dcPer90, 'GW1 pts:', p.predictions[0]?.pts);
  });
});
"
```

Confirm the values look sane (non-zero `dcPer90` for real established defensive players, GW1 `pts` not wildly different from before this change — a few tenths of a point higher for genuine ball-winners, not a dramatic jump).

- [ ] **Step 3: No commit needed** — this task is verification only. If anything looks wrong, fix in the relevant task above and re-commit there, don't create a new fixup task.
