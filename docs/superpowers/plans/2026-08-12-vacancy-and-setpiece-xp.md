# Positional Vacancy Boost + Set-Piece Duty in Core XP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real "next man up" signal that boosts a backup's `startProbability` when the
specific teammate blocking them is officially ruled out, and wire `player.setPieceDuty`
(penalty/free-kick/corner duty) into the core XP formula so it affects every displayed number, not
just the AI Optimizer's internal ranking heuristic.

**Architecture:** A new pure function `detectPositionalVacancy` in `lib/startProbability.js`
(matching the existing `detectDisplacementRisk` pattern exactly: zero I/O, plain data in/out, called
from `sync.js` in the same per-sync pass). A new `setPieceDuty` parameter and internal
`computeSetPieceAdj` helper in `lib/predictionModel.js`'s `computeGwPrediction`, applied additively
in the same place `xgiAdj` already lives.

**Tech Stack:** Vanilla JS ES modules, `node:test` test runner.

---

### Task 1: `lib/startProbability.js` — `detectPositionalVacancy`

**Files:**
- Modify: `lib/startProbability.js`
- Test: `test/startProbability.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/startProbability.test.js` (append after the existing `detectDisplacementRisk` tests,
around line 192):

```js
test('detectPositionalVacancy: boosts the highest-existing-probability teammate when a real starter is ruled out', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Backup A', team: 'ARS', position: 'DEF', startProbability: 0.6, officialStatus: 'a', historicalStartRate: 0.6 },
        { code: 3, name: 'Backup B', team: 'ARS', position: 'DEF', startProbability: 0.3, officialStatus: 'a', historicalStartRate: 0.3 }
    ];
    const result = detectPositionalVacancy(players);
    // Backup A had the higher existing startProbability -- they're the beneficiary, not Backup B.
    assert.equal(result[2].boostedFrom, 0.6);
    // 60% of the gap to the vacated player's historicalStartRate (0.9): 0.6 + (0.9-0.6)*0.6 = 0.78
    assert.equal(result[2].boostedTo, 0.78);
    assert.equal(result[2].vacatedByCode, 1);
    assert.equal(result[3], undefined); // the lower-probability backup doesn't also get boosted
});

test('detectPositionalVacancy: does not fire for a fringe player\'s injury (historicalStartRate below threshold)', () => {
    const players = [
        { code: 1, name: 'Fringe Player', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.2 },
        { code: 2, name: 'Backup', team: 'ARS', position: 'DEF', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 }
    ];
    assert.deepEqual(detectPositionalVacancy(players), {});
});

test('detectPositionalVacancy: never boosts past the ceiling', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.99 },
        { code: 2, name: 'Backup', team: 'ARS', position: 'DEF', startProbability: 0.7, officialStatus: 'a', historicalStartRate: 0.7 }
    ];
    const result = detectPositionalVacancy(players);
    // 0.7 + (0.99-0.7)*0.6 = 0.874, under the 0.85 ceiling -- but confirm the ceiling itself with a tighter case
    assert.ok(result[2].boostedTo <= 0.85);
});

test('detectPositionalVacancy: does not fire across different positions or teams', () => {
    const players = [
        { code: 1, name: 'Injured DEF', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'MID teammate', team: 'ARS', position: 'MID', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 },
        { code: 3, name: 'DEF other team', team: 'CHE', position: 'DEF', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 }
    ];
    assert.deepEqual(detectPositionalVacancy(players), {});
});

test('detectPositionalVacancy: a player with null startProbability is never picked as the beneficiary', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Failed calc', team: 'ARS', position: 'DEF', startProbability: null, officialStatus: 'a', historicalStartRate: null },
        { code: 3, name: 'Valid backup', team: 'ARS', position: 'DEF', startProbability: 0.4, officialStatus: 'a', historicalStartRate: 0.4 }
    ];
    const result = detectPositionalVacancy(players);
    assert.equal(result[3].boostedFrom, 0.4);
    assert.equal(result[2], undefined);
});

test('detectPositionalVacancy: two simultaneous vacancies at the same position each resolve independently', () => {
    const players = [
        { code: 1, name: 'Injured Starter A', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Injured Starter B', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.85 },
        { code: 3, name: 'Only fit DEF', team: 'ARS', position: 'DEF', startProbability: 0.3, officialStatus: 'a', historicalStartRate: 0.3 }
    ];
    const result = detectPositionalVacancy(players);
    // Benefits from both vacancies -- the second call's boostedFrom/vacatedByCode simply overwrites
    // the first for the same beneficiary code, since both apply to the same single remaining option.
    assert.equal(result[3].boostedFrom, 0.3);
    assert.ok([1, 2].includes(result[3].vacatedByCode));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `detectPositionalVacancy is not defined` (or similar import error)

- [ ] **Step 3: Implement `detectPositionalVacancy`**

Modify `lib/startProbability.js` — add after `detectDisplacementRisk` (after its closing `}` around
line 138):

```js
const VACANCY_MIN_VACATED_RATE = 0.65; // the unavailable player must have been a real starter
const VACANCY_BOOST_FRACTION = 0.6;    // how much of the gap to the vacated player's rate to close
const VACANCY_BOOST_CEILING = 0.85;    // never boost a backup to a false "certain starter" level

/**
 * Detects a "positional vacancy": a player who was a real starter (historicalStartRate >=
 * VACANCY_MIN_VACATED_RATE) now ruled out via official status. Boosts the single teammate at the
 * same team/position with the highest *existing* startProbability -- the most-used backup is the
 * most likely direct replacement, reusing a signal already computed rather than guessing.
 *
 * `historicalStartRate` is required separately from `startProbability` because an unavailable
 * player's own `startProbability` is already 0 by the time this runs (computeStartProbability's
 * official-status precedence rule) -- historicalStartRate is what their rate would be if fit, the
 * only remaining signal that they were a genuine starter and not a fringe player who was barely
 * playing anyway.
 *
 * @param {Array<{code: number, name: string, team: string, position: string, startProbability: number|null, officialStatus: string, historicalStartRate: number|null}>} players
 * @returns {Object<number, {boostedFrom: number, boostedTo: number, vacatedByCode: number, vacatedByName: string}>}
 */
export function detectPositionalVacancy(players) {
    const result = {};

    const isUnavailable = (p) => p.officialStatus === 'i' || p.officialStatus === 's' || p.officialStatus === 'u';
    const hasValidProbability = (p) => typeof p.startProbability === 'number' && !Number.isNaN(p.startProbability);
    const hasValidRate = (p) => typeof p.historicalStartRate === 'number' && !Number.isNaN(p.historicalStartRate);

    players.forEach(vacated => {
        if (!isUnavailable(vacated)) return;
        if (!hasValidRate(vacated) || vacated.historicalStartRate < VACANCY_MIN_VACATED_RATE) return;

        const candidates = players.filter(c =>
            c.code !== vacated.code &&
            c.team === vacated.team &&
            c.position === vacated.position &&
            !isUnavailable(c) &&
            hasValidProbability(c)
        );
        if (candidates.length === 0) return;

        const beneficiary = candidates.reduce((max, c) =>
            c.startProbability > max.startProbability ? c : max
        , candidates[0]);

        const boostedTo = Math.min(
            VACANCY_BOOST_CEILING,
            beneficiary.startProbability + (vacated.historicalStartRate - beneficiary.startProbability) * VACANCY_BOOST_FRACTION
        );

        result[beneficiary.code] = {
            boostedFrom: beneficiary.startProbability,
            boostedTo: Math.round(boostedTo * 10000) / 10000,
            vacatedByCode: vacated.code,
            vacatedByName: vacated.name
        };
    });

    return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all new tests green, existing count + 6)

- [ ] **Step 5: Commit**

```bash
git add lib/startProbability.js test/startProbability.test.js
git commit -m "feat: detect positional vacancies, boost the most likely direct replacement's start probability"
```

---

### Task 2: `sync.js` — wire `detectPositionalVacancy` into the sync pipeline

**Files:**
- Modify: `sync.js`

- [ ] **Step 1: Compute `historicalStartRate` alongside the existing `priorSeasonRate`, and call the new function**

Modify `sync.js` — find the per-player `startProbability` loop (around line 681-720) and the
`detectDisplacementRisk` call immediately after it (around line 722-728).

Old:
```js
        try {
            const priorSeasonRate = (typeof p.MPPG === 'number' && p.MPPG > 0 && typeof p.GS === 'number' && p.GS > 0)
                ? Math.min(1.0, p.MPPG / 90)
                : null;

            const result = computeStartProbability({
                officialStatus: p.status,
                officialChanceOfPlaying: officialChanceOfPlayingById.get(p.id),
                recentWindow: window,
                priorSeasonRate,
                price: p.price,
                ownership: p.ownership,
                position: p.position
            });

            p.startProbability = Math.round(result.startProbability * 1000) / 1000;
            p.dataConfidence = result.dataConfidence;
        } catch (err) {
            console.warn(`Rotation: computeStartProbability failed for player id=${p.id} code=${p.code}:`, err.message);
            // Deliberate sentinel: null means "computation failed, no signal", NOT "0% chance of starting".
            // detectDisplacementRisk (lib/startProbability.js) explicitly excludes non-numeric values for
            // this reason -- treating null as 0 via numeric coercion would fabricate/suppress flags.
            p.startProbability = null;
            p.dataConfidence = 'low';
        }
    });

    const displacementMap = detectDisplacementRisk(playersList.map(p => ({
        code: p.code, name: p.web_name, team: p.team, position: p.position,
        startProbability: p.startProbability, isNewToCurrentTeam: p.transferredThisSeason
    })));
    playersList.forEach(p => {
        p.displacementRisk = displacementMap[p.code] || null;
    });
```

New:
```js
        let priorSeasonRate = null;
        try {
            priorSeasonRate = (typeof p.MPPG === 'number' && p.MPPG > 0 && typeof p.GS === 'number' && p.GS > 0)
                ? Math.min(1.0, p.MPPG / 90)
                : null;

            const result = computeStartProbability({
                officialStatus: p.status,
                officialChanceOfPlaying: officialChanceOfPlayingById.get(p.id),
                recentWindow: window,
                priorSeasonRate,
                price: p.price,
                ownership: p.ownership,
                position: p.position
            });

            p.startProbability = Math.round(result.startProbability * 1000) / 1000;
            p.dataConfidence = result.dataConfidence;
        } catch (err) {
            console.warn(`Rotation: computeStartProbability failed for player id=${p.id} code=${p.code}:`, err.message);
            // Deliberate sentinel: null means "computation failed, no signal", NOT "0% chance of starting".
            // detectDisplacementRisk (lib/startProbability.js) explicitly excludes non-numeric values for
            // this reason -- treating null as 0 via numeric coercion would fabricate/suppress flags.
            p.startProbability = null;
            p.dataConfidence = 'low';
        }

        // historicalStartRate: what this player's rate would be based on real minutes history
        // alone, ignoring their current official-availability status. Needed by
        // detectPositionalVacancy below -- an injured player's own `startProbability` is already
        // 0 by this point (computeStartProbability's official-status precedence), so this is the
        // only remaining signal for "were they genuinely a starter before this injury". Prefers
        // the recent-window rate (more current) over priorSeasonRate when a real window exists.
        if (window && window.games > 0) {
            p.historicalStartRate = Math.round((window.starts / window.games) * 10000) / 10000;
        } else {
            p.historicalStartRate = priorSeasonRate;
        }
    });

    const displacementMap = detectDisplacementRisk(playersList.map(p => ({
        code: p.code, name: p.web_name, team: p.team, position: p.position,
        startProbability: p.startProbability, isNewToCurrentTeam: p.transferredThisSeason
    })));
    playersList.forEach(p => {
        p.displacementRisk = displacementMap[p.code] || null;
    });

    const vacancyMap = detectPositionalVacancy(playersList.map(p => ({
        code: p.code, name: p.web_name, team: p.team, position: p.position,
        startProbability: p.startProbability, officialStatus: p.status,
        historicalStartRate: p.historicalStartRate
    })));
    playersList.forEach(p => {
        const boost = vacancyMap[p.code];
        if (boost) {
            p.startProbability = boost.boostedTo;
        }
    });
```

- [ ] **Step 2: Update the import**

Modify `sync.js` — find the existing import (around line 4):

Old:
```js
import { computeStartProbability, detectDisplacementRisk } from './lib/startProbability.js';
```

New:
```js
import { computeStartProbability, detectDisplacementRisk, detectPositionalVacancy } from './lib/startProbability.js';
```

- [ ] **Step 3: Syntax-check**

Run: `node --check sync.js`
Expected: no output

- [ ] **Step 4: Run a real sync and confirm Mosquera's boost**

Run: `node sync.js`, then:
```bash
grep -A 5 '"web_name": "Mosquera"' data.js | grep startProbability
grep -A 5 '"web_name": "Saliba"' data.js | grep -E "status|chanceOfPlaying"
```
Expected: Saliba shows `status: "i"`; Mosquera's `startProbability` is meaningfully higher than
before this change (was ~0.609 pre-fix) but not at/above the 0.85 ceiling. Exact value depends on
live data at sync time.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all passing, same count as after Task 1 (this task doesn't add new unit-tested pure
functions, just wiring)

- [ ] **Step 6: Commit**

```bash
git add sync.js data.js
git commit -m "feat: wire detectPositionalVacancy into the sync pipeline"
```

---

### Task 3: `lib/predictionModel.js` — set-piece duty in core XP

**Files:**
- Modify: `lib/predictionModel.js`
- Test: `test/predictionModel.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/predictionModel.test.js` (append near the other `computeGwPrediction` tests):

```js
test('computeGwPrediction: a penalty-duty player gets the position-correct bonus', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 6.0, position: 'FWD', xG90: 0.4, xA90: 0.1, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };

    const withoutDuty = computeGwPrediction(base);
    const withDuty = computeGwPrediction({ ...base, setPieceDuty: { pk: true, fk: false, ck: false } });

    assert.equal(Math.round((withDuty.pts - withoutDuty.pts) * 100) / 100, 0.2); // FWD penalty bonus
});

test('computeGwPrediction: penalty bonus is position-scaled (DEF gets more than FWD)', () => {
    const fwdFixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const fwd = computeGwPrediction({ basePPG: 6.0, position: 'FWD', xG90: 0.4, xA90: 0.1, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: fwdFixture, setPieceDuty: { pk: true, fk: false, ck: false } });
    const fwdBase = computeGwPrediction({ basePPG: 6.0, position: 'FWD', xG90: 0.4, xA90: 0.1, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: fwdFixture });

    const defFixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const def = computeGwPrediction({ basePPG: 3.0, position: 'DEF', xG90: 0.05, xA90: 0.05, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: defFixture, setPieceDuty: { pk: true, fk: false, ck: false } });
    const defBase = computeGwPrediction({ basePPG: 3.0, position: 'DEF', xG90: 0.05, xA90: 0.05, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: defFixture });

    const fwdBonus = fwd.pts - fwdBase.pts;
    const defBonus = def.pts - defBase.pts;
    assert.ok(defBonus > fwdBonus);
});

test('computeGwPrediction: a GKP gets no set-piece bonus even if (hypothetically) flagged', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };
    const withoutDuty = computeGwPrediction(base);
    const withDuty = computeGwPrediction({ ...base, setPieceDuty: { pk: true, fk: true, ck: true } });
    assert.equal(withDuty.pts, withoutDuty.pts);
});

test('computeGwPrediction: fk and ck together do not double the assist bonus', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 4.0, position: 'MID', xG90: 0.15, xA90: 0.15, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };
    const fkOnly = computeGwPrediction({ ...base, setPieceDuty: { pk: false, fk: true, ck: false } });
    const both = computeGwPrediction({ ...base, setPieceDuty: { pk: false, fk: true, ck: true } });
    assert.equal(fkOnly.pts, both.pts);
});

test('computeGwPrediction: omitting setPieceDuty entirely matches passing all-false (backward compatible)', () => {
    const fixture = { opp: 'AVL', loc: 'H', diff: 3 };
    const base = { basePPG: 4.0, position: 'MID', xG90: 0.15, xA90: 0.15, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };
    const omitted = computeGwPrediction(base);
    const explicit = computeGwPrediction({ ...base, setPieceDuty: { pk: false, fk: false, ck: false } });
    assert.equal(omitted.pts, explicit.pts);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL (setPieceDuty not yet applied, bonus assertions fail)

- [ ] **Step 3: Implement the set-piece adjustment**

Modify `lib/predictionModel.js` — add constants and a helper function just before
`computeGwPrediction`'s JSDoc comment (before line ~268, the `/** Compute a single gameweek's...`
comment):

```js
// Real anchoring: ~100-110 penalties awarded across a 380-game PL season (~0.14/team/game),
// ~77% historical conversion rate -> ~0.108 expected goals/game purely from guaranteed penalty
// duty. Dampened to ~50% of full credit for the same double-counting reason the AI Optimizer's
// own set-piece bonus was halved (see components/optimizer.js's Phase 4 history): an established
// taker's real scoring history already reflects most of this value via basePPG; the dampened
// remainder mainly serves recently-assigned takers whose basePPG hasn't caught up yet.
const PENALTY_DUTY_BONUS = { FWD: 0.2, MID: 0.27, DEF: 0.3 };

// Corner/free-kick duty contributes via assists, not goals. Real data on assists specifically
// attributable to set-piece delivery wasn't available when this was written -- this is a
// conservative, low-confidence estimate (flat across positions, since FPL values every assist at
// 3 pts regardless of position), not a precisely derived figure like PENALTY_DUTY_BONUS above.
// Revisit if better data becomes available.
const SET_PIECE_ASSIST_BONUS = 0.06;

/**
 * Additive set-piece-duty XP contribution. Not applied to GKP (matches getPlayerSetPieceDuty's
 * own GKP exclusion in components/optimizer.js). fk and ck are not additive with each other --
 * a player taking both isn't generating two independent extra assist channels, just delivering
 * from the same handful of set-piece situations either way.
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position
 * @param {{pk?: boolean, fk?: boolean, ck?: boolean}} setPieceDuty
 * @returns {number}
 */
function computeSetPieceAdj(position, setPieceDuty) {
    if (position === 'GKP' || !setPieceDuty) return 0;
    let adj = 0;
    if (setPieceDuty.pk) adj += PENALTY_DUTY_BONUS[position] || 0;
    if (setPieceDuty.fk || setPieceDuty.ck) adj += SET_PIECE_ASSIST_BONUS;
    return adj;
}
```

Then modify `computeGwPrediction`'s signature and body:

Old (signature, line 321):
```js
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90 }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
```

New:
```js
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90, setPieceDuty }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0, setPieceAdj: 0 };
```

Old (the GKP/DEF branch, lines 366-378):
```js
        if (position === 'GKP' || position === 'DEF') {
            // --- Defcon-aligned clean sheet XP contribution (strength-aware, see getCleanSheetProb) ---
            const csProb = getCleanSheetProb(fixture);
            const avgCsProb = usedStrengthPath ? AVG_CS_PROB_STRENGTH_PATH : getCleanSheetProb({ diff: 3, loc: 'H' });
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            breakdown.csAdj += computeGoalsConcededNudge(goalsConceded90, leagueAvgGoalsConceded90);
            pts += breakdown.csAdj;

            // --- GK Saves contribution ---
            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            }
        } else if (position === 'MID') {
```

New:
```js
        if (position === 'GKP' || position === 'DEF') {
            // --- Defcon-aligned clean sheet XP contribution (strength-aware, see getCleanSheetProb) ---
            const csProb = getCleanSheetProb(fixture);
            const avgCsProb = usedStrengthPath ? AVG_CS_PROB_STRENGTH_PATH : getCleanSheetProb({ diff: 3, loc: 'H' });
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            breakdown.csAdj += computeGoalsConcededNudge(goalsConceded90, leagueAvgGoalsConceded90);
            pts += breakdown.csAdj;

            // --- GK Saves contribution ---
            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            } else {
                breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
                pts += breakdown.setPieceAdj;
            }
        } else if (position === 'MID') {
```

Old (the MID branch's end, lines 389-395):
```js
            // Attacking bonus for MID/FWD based on fixture difficulty
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        } else {
            // FWD — attacking only, no CS points
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        }
```

New:
```js
            // Attacking bonus for MID/FWD based on fixture difficulty
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;

            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;
        } else {
            // FWD — attacking only, no CS points
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;

            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all new tests green

- [ ] **Step 5: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: wire set-piece duty into core XP (computeGwPrediction), not just the Optimizer's internal ranking"
```

---

### Task 4: `sync.js` — pass `setPieceDuty` into the `computeGwPrediction` call

**Files:**
- Modify: `sync.js`

- [ ] **Step 1: Add the field to the call site**

Modify `sync.js` — find the `computeGwPrediction` call (around line 464-476):

Old:
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
                leagueAvgGoalsConceded90
            });
```

New:
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
                setPieceDuty: player.setPieceDuty
            });
```

- [ ] **Step 2: Syntax-check**

Run: `node --check sync.js`
Expected: no output

- [ ] **Step 3: Run a real sync and spot-check a known penalty taker**

Run: `node sync.js`, then confirm a known real penalty taker's displayed 5-GW XP moved up modestly
(not dramatically) compared to before this task, e.g.:
```bash
grep -A 30 '"web_name": "Haaland"' data.js | grep -A5 '"gw": 1'
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all passing

- [ ] **Step 5: Commit**

```bash
git add sync.js data.js
git commit -m "feat: pass real setPieceDuty into computeGwPrediction at sync time"
```

---

### Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full syntax check**

Run: `node --check lib/startProbability.js && node --check lib/predictionModel.js && node --check sync.js`
Expected: no output

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all passing (original 104 + Task 1's 6 + Task 3's 5 = 115)

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds, no new errors

- [ ] **Step 4: Real-data verification**

- Confirm Mosquera's `startProbability` in the freshly-synced `data.js` is meaningfully boosted
  (was ~0.609 before this plan) given Saliba's real current injury, but capped at/below 0.85.
- Confirm a known real penalty taker's displayed 5-GW XP moved up modestly (small, not dramatic --
  the dampening working as intended).
- Browser check: run the app, confirm Squad Planner / OPTA Stats numbers look sane (no NaN, no
  wildly-inflated values), confirm no new console errors.

- [ ] **Step 5: Commit** (only if Step 4 surfaced a fix — otherwise nothing to commit here)
