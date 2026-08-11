# Phase 3 — Fixture Difficulty from Real Team-Strength Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the diff-based fixture-difficulty step functions in the XP formula and `ticker.js`'s hardcoded competitor-sourced lookup tables with continuous values derived from FPL's own real `teams[].strength_*` data (with a real historical-data fallback for this season's not-yet-populated attack/defence splits), plus fold `goalsConceded90` into the clean-sheet model.

**Architecture:** A new pure module `lib/teamStrength.js` resolves each team's attack/defence strength through a 3-tier fallback (this season → last season's real archived data → unavailable). `lib/predictionModel.js` gains strength-aware attacking/clean-sheet formulas that gracefully degrade to today's exact diff-based behavior when strength data is absent (verified by construction to keep all existing tests passing unchanged). `sync.js` wires the new team-strength data into `teamsList`/`fixturesSchedule` and restructures the per-player loop into two passes so a league-average `goalsConceded90` can be computed before predictions run. `ticker.js`'s Clean Sheet%/Projected Goals tabs call the real model instead of hardcoded tables.

**Tech Stack:** Vanilla JS ES modules, `node:test` for unit tests, no framework.

---

## Before you start

This spec (`docs/superpowers/specs/2026-08-11-phase3-fixture-difficulty-design.md`) is the source of truth for *why* — read it first if anything here is unclear on rationale.

`sync.js` itself has **no unit tests** in this codebase (confirmed: `ls test/` has no `sync.test.js`) — it's an integration script that makes live network calls, verified via `npm run sync` + manual data inspection, not `node:test`. All new *pure* logic in this plan lives in `lib/*.js` with full unit test coverage (Tasks 1-2); `sync.js`'s own wiring changes (Tasks 3-4) are verified via manual smoke-checks within each task, matching this codebase's established convention (no other `sync.js` change in Phase 1 or 2 added a `sync.test.js` either).

---

### Task 1: `lib/teamStrength.js` — 3-tier attack/defence resolution

**Files:**
- Create: `lib/teamStrength.js`
- Test: `test/teamStrength.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/teamStrength.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalStrengthByCode, resolveTeamStrength } from '../lib/teamStrength.js';

test('buildHistoricalStrengthByCode: parses valid rows keyed by numeric team code', () => {
    const rows = [
        { code: '3', strength_attack_home: '1340', strength_attack_away: '1390', strength_defence_home: '1270', strength_defence_away: '1320' },
        { code: '7', strength_attack_home: '1120', strength_attack_away: '1210', strength_defence_home: '1150', strength_defence_away: '1250' }
    ];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.deepEqual(byCode.get(3), { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 });
    assert.deepEqual(byCode.get(7), { attackHome: 1120, attackAway: 1210, defenceHome: 1150, defenceAway: 1250 });
});

test('buildHistoricalStrengthByCode: skips rows with non-numeric code', () => {
    const rows = [{ code: 'not-a-number', strength_attack_home: '1340', strength_attack_away: '1390', strength_defence_home: '1270', strength_defence_away: '1320' }];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.equal(byCode.size, 0);
});

test('buildHistoricalStrengthByCode: skips rows with any non-numeric strength field', () => {
    const rows = [{ code: '3', strength_attack_home: '1340', strength_attack_away: '', strength_defence_home: '1270', strength_defence_away: '1320' }];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.equal(byCode.size, 0);
});

test('resolveTeamStrength: tier 1 -- this-season non-zero values pass through unchanged', () => {
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: 1350, strengthAttackAway: 1400, strengthDefenceHome: 1280, strengthDefenceAway: 1330 },
        new Map()
    );
    assert.deepEqual(result, { strengthAttackHome: 1350, strengthAttackAway: 1400, strengthDefenceHome: 1280, strengthDefenceAway: 1330 });
});

test('resolveTeamStrength: tier 2 -- this-season all zero, falls back to historical value for the same code', () => {
    const historicalByCode = new Map([[3, { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 }]]);
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: 0, strengthAttackAway: 0, strengthDefenceHome: 0, strengthDefenceAway: 0 },
        historicalByCode
    );
    assert.deepEqual(result, { strengthAttackHome: 1340, strengthAttackAway: 1390, strengthDefenceHome: 1270, strengthDefenceAway: 1320 });
});

test('resolveTeamStrength: tier 3 -- this-season all zero, no historical match, returns explicit nulls not zeros', () => {
    const result = resolveTeamStrength(
        { code: 999, strengthAttackHome: 0, strengthAttackAway: 0, strengthDefenceHome: 0, strengthDefenceAway: 0 },
        new Map()
    );
    assert.deepEqual(result, { strengthAttackHome: null, strengthAttackAway: null, strengthDefenceHome: null, strengthDefenceAway: null });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="teamStrength"` (or `node --test "test/teamStrength.test.js"`)
Expected: FAIL — `Cannot find module '../lib/teamStrength.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/teamStrength.js`:

```js
// Resolves each team's attack/defence strength through a 3-tier fallback:
// 1. This season's real strength_attack_*/strength_defence_* from FPL, if non-zero.
// 2. Last season's real value for the same team (matched by the stable `code` field,
//    the same cross-season identifier already used for players), from the archived
//    vaastav/Fantasy-Premier-League dataset -- only covers teams that were actually in
//    the Premier League last season.
// 3. Explicit null (never a fake 0) for teams in neither -- newly-promoted teams in
//    their first top-flight season. Callers must fall back to overall-strength-only
//    when they see null here, never coerce it to 0.

export const HISTORICAL_TEAMS_CSV_URL = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/2025-26/teams.csv';

/**
 * @param {Array<Object>} csvRows - Parsed rows from lib/csv.js's parseCsv() over the historical teams.csv.
 * @returns {Map<number, { attackHome: number, attackAway: number, defenceHome: number, defenceAway: number }>}
 */
export function buildHistoricalStrengthByCode(csvRows) {
    const byCode = new Map();
    csvRows.forEach(row => {
        const code = parseInt(row.code, 10);
        if (!Number.isFinite(code)) return;
        const attackHome = parseInt(row.strength_attack_home, 10);
        const attackAway = parseInt(row.strength_attack_away, 10);
        const defenceHome = parseInt(row.strength_defence_home, 10);
        const defenceAway = parseInt(row.strength_defence_away, 10);
        if (![attackHome, attackAway, defenceHome, defenceAway].every(Number.isFinite)) return;
        byCode.set(code, { attackHome, attackAway, defenceHome, defenceAway });
    });
    return byCode;
}

/**
 * @param {{ code: number, strengthAttackHome: number, strengthAttackAway: number, strengthDefenceHome: number, strengthDefenceAway: number }} team - This season's raw FPL team-strength fields.
 * @param {Map<number, { attackHome: number, attackAway: number, defenceHome: number, defenceAway: number }>} historicalByCode
 * @returns {{ strengthAttackHome: number|null, strengthAttackAway: number|null, strengthDefenceHome: number|null, strengthDefenceAway: number|null }}
 */
export function resolveTeamStrength({ code, strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway }, historicalByCode) {
    const tier1Valid = [strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway]
        .every(v => typeof v === 'number' && v !== 0);
    if (tier1Valid) {
        return { strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway };
    }

    const historical = historicalByCode.get(code);
    if (historical) {
        return {
            strengthAttackHome: historical.attackHome,
            strengthAttackAway: historical.attackAway,
            strengthDefenceHome: historical.defenceHome,
            strengthDefenceAway: historical.defenceAway
        };
    }

    return {
        strengthAttackHome: null,
        strengthAttackAway: null,
        strengthDefenceHome: null,
        strengthDefenceAway: null
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "test/teamStrength.test.js"`
Expected: PASS — 6 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/teamStrength.js test/teamStrength.test.js
git commit -m "feat: add 3-tier team-strength resolution (this season -> last season -> null)"
```

---

### Task 2: `lib/predictionModel.js` — strength-aware attacking/clean-sheet formulas + goalsConceded90 nudge

**Files:**
- Modify: `lib/predictionModel.js`
- Modify: `test/predictionModel.test.js`

This task changes `getCleanSheetProb`'s signature from `(diff, loc)` to a single `fixture` object (matching `getAttackMultiplier`'s new shape), adds `getAttackMultiplier`, `computeGoalsConcededNudge`, and `computeLeagueAverageGoalsConceded90`, and rewires `computeGwPrediction` to use them. **Verified by hand-derivation that every existing `computeGwPrediction` test produces identical output** (all existing test fixtures lack `ownStrength`/`oppStrength`, so they exercise the same legacy diff-based fallback path that's byte-for-byte preserved) — this task's tests confirm that in code.

- [ ] **Step 1: Write the failing tests**

Replace `test/predictionModel.test.js` entirely with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeBasePPG,
    getCleanSheetProb,
    getExpectedSavePts,
    getAttackMultiplier,
    computeGoalsConcededNudge,
    computeLeagueAverageGoalsConceded90,
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

test('getCleanSheetProb: legacy diff/loc fallback -- easy home fixture beats hard away fixture (no strength data)', () => {
    assert.equal(getCleanSheetProb({ diff: 2, loc: 'H' }), 0.53);
    assert.equal(getCleanSheetProb({ diff: 5, loc: 'A' }), 0.03);
});

test('getCleanSheetProb: attack/defence-specific path -- strong defence vs weak attack beats weak defence vs strong attack', () => {
    const strongDefence = getCleanSheetProb({ diff: 3, loc: 'H', ownDefenceStrength: 1320, oppAttackStrength: 1040 });
    const weakDefence = getCleanSheetProb({ diff: 3, loc: 'H', ownDefenceStrength: 1040, oppAttackStrength: 1340 });
    assert.ok(strongDefence > weakDefence);
    assert.ok(strongDefence <= 0.65 && strongDefence >= 0.02);
    assert.ok(weakDefence <= 0.65 && weakDefence >= 0.02);
});

test('getCleanSheetProb: overall-strength-only fallback when attack/defence data is missing but overall is present', () => {
    const easy = getCleanSheetProb({ diff: 3, loc: 'H', ownStrength: 5, oppStrength: 2 });
    const hard = getCleanSheetProb({ diff: 3, loc: 'H', ownStrength: 2, oppStrength: 5 });
    assert.ok(easy > hard);
});

test('getAttackMultiplier: legacy diff fallback -- documents the diff=1/diff=3 gap (no strength data)', () => {
    assert.equal(getAttackMultiplier({ diff: 1 }), 1.0);
    assert.equal(getAttackMultiplier({ diff: 3 }), 1.0);
    assert.equal(getAttackMultiplier({ diff: 2 }), 1.12);
    assert.equal(getAttackMultiplier({ diff: 4 }), 0.88);
    assert.equal(getAttackMultiplier({ diff: 5 }), 0.70);
});

test('getAttackMultiplier: attack/defence-specific path -- strong attack vs weak defence beats weak attack vs strong defence', () => {
    const easy = getAttackMultiplier({ diff: 3, ownAttackStrength: 1390, oppDefenceStrength: 1040 });
    const hard = getAttackMultiplier({ diff: 3, ownAttackStrength: 1040, oppDefenceStrength: 1390 });
    assert.ok(easy > hard);
    assert.ok(easy <= 1.30 && easy >= 0.65);
    assert.ok(hard <= 1.30 && hard >= 0.65);
});

test('getAttackMultiplier: real ARS @ AVL GW2 case -- overall strength disagrees with FPL official diff, and we side with strength', () => {
    // FPL's official diff for this fixture is 4 (hard). But strength_overall_away(ARS)=5 >
    // strength_overall_home(AVL)=3 -- the new formula is expected to rate it easier than the
    // old diff-based one, on purpose (see spec's "Real data constraint" section).
    const legacyMultiplier = getAttackMultiplier({ diff: 4 });
    const strengthMultiplier = getAttackMultiplier({ diff: 4, ownStrength: 5, oppStrength: 3 });
    assert.ok(strengthMultiplier > legacyMultiplier);
});

test('getExpectedSavePts: only applies to GKP', () => {
    assert.equal(getExpectedSavePts({ position: 'MID', diff: 5, loc: 'A', saves90: 3.6 }), 0);
    const gkSaves = getExpectedSavePts({ position: 'GKP', diff: 5, loc: 'A', saves90: 3.6 });
    assert.equal(Math.round(gkSaves * 1000) / 1000, 2.112);
});

test('computeGoalsConcededNudge: player better than league average gets a positive nudge, clamped', () => {
    assert.equal(computeGoalsConcededNudge(1.0, 1.5), 0.15); // (1.5-1.0)*0.3 = 0.15, under the 0.2 cap
    assert.equal(computeGoalsConcededNudge(0.0, 2.0), 0.2); // (2.0-0.0)*0.3 = 0.6, clamped to 0.2
});

test('computeGoalsConcededNudge: player worse than league average gets a negative nudge, clamped', () => {
    assert.equal(computeGoalsConcededNudge(3.0, 1.5), -0.2); // (1.5-3.0)*0.3 = -0.45, clamped to -0.2
});

test('computeGoalsConcededNudge: non-numeric inputs return 0, never coerce null/undefined', () => {
    assert.equal(computeGoalsConcededNudge(null, 1.5), 0);
    assert.equal(computeGoalsConcededNudge(1.5, undefined), 0);
});

test('computeLeagueAverageGoalsConceded90: averages only GKP/DEF with meaningful minutes', () => {
    const players = [
        { position: 'GKP', minutes: 900, goalsConceded90: 1.0 },
        { position: 'DEF', minutes: 900, goalsConceded90: 2.0 },
        { position: 'MID', minutes: 900, goalsConceded90: 0.5 }, // excluded: not GKP/DEF
        { position: 'DEF', minutes: 100, goalsConceded90: 5.0 }  // excluded: below minMinutes
    ];
    assert.equal(computeLeagueAverageGoalsConceded90(players, 450), 1.5); // (1.0 + 2.0) / 2
});

test('computeLeagueAverageGoalsConceded90: no qualifying players returns null, never divides by zero', () => {
    assert.equal(computeLeagueAverageGoalsConceded90([], 450), null);
});

test('computeGwPrediction: MID, easy home fixture with attacking output (legacy fallback path, unchanged from before this phase)', () => {
    const { pts } = computeGwPrediction({
        basePPG: 4.0, position: 'MID', xG90: 0.3, xA90: 0.2, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 2 }
    });
    assert.equal(pts, 5.4);
});

test('computeGwPrediction: GKP, hard away fixture leans on saves, not clean sheet (legacy fallback path, unchanged from before this phase)', () => {
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

test('computeGwPrediction: documents the current diff=1/diff=3 gap (no FDR bonus at diff=1, legacy fallback path only)', () => {
    const base = { basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100 };
    const diff1 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 1 } });
    const diff3 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 3 } });
    assert.equal(diff1.breakdown.fdrMultiplier, diff3.breakdown.fdrMultiplier);
});

test('computeGwPrediction: strength-based path drops the flat home/away adjustment entirely', () => {
    const { breakdown } = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'AVL', loc: 'A', diff: 4, ownStrength: 5, oppStrength: 3 }
    });
    assert.equal(breakdown.homeAwayAdj, 0);
});

test('computeGwPrediction: goalsConceded90 nudge shifts DEF clean-sheet points for an above-average defender', () => {
    const fixture = { opp: 'AVL', loc: 'A', diff: 4, ownStrength: 5, oppStrength: 3 };
    const withoutNudge = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100, fixture
    });
    const withNudge = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100, fixture,
        goalsConceded90: 0.5, leagueAvgGoalsConceded90: 1.5
    });
    assert.ok(withNudge.pts > withoutNudge.pts);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test "test/predictionModel.test.js"`
Expected: FAIL — `getAttackMultiplier`, `computeGoalsConcededNudge`, `computeLeagueAverageGoalsConceded90` not exported; `getCleanSheetProb` called with wrong signature (old code expects `(diff, loc)` positional args, tests now pass a single object).

- [ ] **Step 3: Write the implementation**

Modify `lib/predictionModel.js` — replace everything from the `// Clean Sheet Probability Model` comment (currently line 51) through the end of `getExpectedSavePts` (currently line 107) with:

```js
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Attack/defence-specific gap constants operate on the historical dataset's Elo-style scale
// (~900-1400, spread ~500); overall-strength gap constants operate on FPL's 1-5 "overall" scale.
// Both tuned so a large-but-realistic gap approaches (without routinely hitting) the clamp bounds.
const K_ATTACK_SPECIFIC = 0.0006;
const K_ATTACK_OVERALL = 0.11;
const K_DEFENCE_SPECIFIC = 0.0005;
const K_DEFENCE_OVERALL = 0.1;
const AVG_CS_PROB_STRENGTH_PATH = 0.30;

const GOALS_CONCEDED_NUDGE_SCALE = 0.3;
const MAX_GOALS_CONCEDED_NUDGE = 0.2;

// -------------------------------------------------------
// Attacking Fixture Multiplier
// Prefers attack-vs-opponent-defence (both venue-matched); falls back to a generic
// overall-strength gap; falls back to the legacy diff-based step function only if even
// overall strength is missing (shouldn't happen -- sync.js always attaches it).
// -------------------------------------------------------
/**
 * @param {{ diff: number, ownAttackStrength?: number|null, oppDefenceStrength?: number|null, ownStrength?: number, oppStrength?: number }} fixture
 * @returns {number} Multiplier, clamped to [0.65, 1.30].
 */
export function getAttackMultiplier(fixture) {
    const { diff, ownAttackStrength, oppDefenceStrength, ownStrength, oppStrength } = fixture;

    if (typeof ownAttackStrength === 'number' && typeof oppDefenceStrength === 'number') {
        const attackGap = oppDefenceStrength - ownAttackStrength; // positive = their defence stronger than my attack
        return clamp(1.0 - attackGap * K_ATTACK_SPECIFIC, 0.65, 1.30);
    }

    if (typeof ownStrength === 'number' && typeof oppStrength === 'number') {
        const overallGap = oppStrength - ownStrength;
        return clamp(1.0 - overallGap * K_ATTACK_OVERALL, 0.65, 1.30);
    }

    // Legacy last-resort: same step function used before this phase, including the diff=1 gap.
    if (diff === 2) return 1.12;
    if (diff === 4) return 0.88;
    if (diff === 5) return 0.70;
    return 1.0;
}

// -------------------------------------------------------
// Clean Sheet Probability Model
// Same fallback order as getAttackMultiplier: defence-vs-opponent-attack, then overall
// strength, then the legacy diff/loc-based step function.
// -------------------------------------------------------
/**
 * @param {{ diff: number, loc: 'H'|'A', ownDefenceStrength?: number|null, oppAttackStrength?: number|null, ownStrength?: number, oppStrength?: number }} fixture
 * @returns {number} Probability, clamped to [0.02, 0.65].
 */
export function getCleanSheetProb(fixture) {
    const { diff, loc, ownDefenceStrength, oppAttackStrength, ownStrength, oppStrength } = fixture;

    if (typeof ownDefenceStrength === 'number' && typeof oppAttackStrength === 'number') {
        const defenceGap = oppAttackStrength - ownDefenceStrength; // positive = their attack stronger than my defence
        return clamp(AVG_CS_PROB_STRENGTH_PATH - defenceGap * K_DEFENCE_SPECIFIC, 0.02, 0.65);
    }

    if (typeof ownStrength === 'number' && typeof oppStrength === 'number') {
        const overallGap = oppStrength - ownStrength;
        return clamp(AVG_CS_PROB_STRENGTH_PATH - overallGap * K_DEFENCE_OVERALL, 0.02, 0.65);
    }

    // Legacy last-resort: same step function used before this phase.
    let base;
    if (diff <= 2) base = 0.48;
    else if (diff === 3) base = 0.30;
    else if (diff === 4) base = 0.18;
    else base = 0.08; // diff 5
    base += (loc === 'H') ? 0.05 : -0.05;
    return clamp(base, 0.02, 0.65);
}

// -------------------------------------------------------
// goalsConceded90 Clean-Sheet Nudge
// A small per-player differentiator on top of the team-level clean-sheet probability above --
// see the design spec's "Folding goalsConceded90" section for why this is additive, not a
// separate per-player probability.
// -------------------------------------------------------
/**
 * @param {number|null|undefined} playerGc90
 * @param {number|null|undefined} leagueAvgGc90
 * @returns {number} Nudge, clamped to [-0.2, 0.2]. Returns 0 if either input isn't a real number.
 */
export function computeGoalsConcededNudge(playerGc90, leagueAvgGc90) {
    if (typeof playerGc90 !== 'number' || typeof leagueAvgGc90 !== 'number') return 0;
    const delta = leagueAvgGc90 - playerGc90; // positive = player concedes less than average = good
    return clamp(delta * GOALS_CONCEDED_NUDGE_SCALE, -MAX_GOALS_CONCEDED_NUDGE, MAX_GOALS_CONCEDED_NUDGE);
}

/**
 * League-wide average goalsConceded90 across GKP/DEF players with meaningful minutes, used as
 * the baseline for computeGoalsConcededNudge. Computed dynamically each sync, never hardcoded.
 * @param {Array<{ position: string, minutes: number, goalsConceded90: number }>} players
 * @param {number} minMinutes - Matches the existing sample-size threshold used to blend goalsConceded90 itself.
 * @returns {number|null} Average, or null if no qualifying players (never divide by zero).
 */
export function computeLeagueAverageGoalsConceded90(players, minMinutes = 450) {
    const qualifying = players.filter(p =>
        (p.position === 'GKP' || p.position === 'DEF') &&
        typeof p.minutes === 'number' && p.minutes >= minMinutes &&
        typeof p.goalsConceded90 === 'number'
    );
    if (qualifying.length === 0) return null;
    const sum = qualifying.reduce((acc, p) => acc + p.goalsConceded90, 0);
    return sum / qualifying.length;
}

// -------------------------------------------------------
// GK Saves XP Model
// Expected saves per game depends on opposition strength:
//   tough opponents (high FDR) → more shots → more saves
//   easy opponents (low FDR)   → fewer shots → fewer saves
// FPL rule: every 3 saves = 1 point
// -------------------------------------------------------
/**
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Player position; returns 0 for anything but 'GKP'.
 * @param {number} diff - Fixture Difficulty Rating (FDR) of the opponent, 1-5.
 * @param {'H'|'A'} loc - Whether the fixture is home ('H') or away ('A').
 * @param {number} saves90 - Player's saves-per-90 rate from last season (0 if unknown).
 * @returns {number} Expected save points for the fixture.
 */
export function getExpectedSavePts({ position, diff, loc, saves90 }) {
    if (position !== 'GKP') return 0;

    // Saves-per-game expected from last season's rate, adjusted by fixture difficulty
    // Harder fixture → more shots conceded → more saves (but fewer CS)
    let diffMultiplier;
    if (diff <= 2) diffMultiplier = 0.65; // easy opponent → fewer shots
    else if (diff === 3) diffMultiplier = 1.0;
    else if (diff === 4) diffMultiplier = 1.30;
    else diffMultiplier = 1.60; // tough opponent → many shots

    // Home/away: playing away typically faces slightly more shots
    const locMultiplier = (loc === 'A') ? 1.10 : 0.92;

    // If the GK has saves data from last season, use it. Otherwise use a league-average default.
    const baseSaves90 = saves90 > 0 ? saves90 : 3.0;
    const expectedSavesPerGame = baseSaves90 * diffMultiplier * locMultiplier;

    // FPL: every 3 saves earns 1 bonus point
    return expectedSavesPerGame / 3;
}
```

Then modify `computeGwPrediction` (currently starting at what was line 109, now shifted down by the insertion above) — replace its entire body with:

```js
/**
 * Compute a single gameweek's expected points (XP) for a player, starting from their basePPG
 * and layering on fixture-specific adjustments.
 *
 * @param {number} basePPG - Player's baseline points-per-game (see computeBasePPG).
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Player position.
 * @param {number} xG90 - Expected goals per 90 minutes.
 * @param {number} xA90 - Expected assists per 90 minutes.
 * @param {number} saves90 - Saves per 90 minutes (GKP only; ignored otherwise).
 * @param {number} mppg - Minutes per game played.
 * @param {number} starts - Number of starts this season.
 * @param {number|null|undefined} chanceOfPlaying - FPL "chance of playing next round" (0-100), or null/undefined if unknown (treated as 100).
 * @param {{ opp: string, loc: 'H'|'A', diff: number, ownStrength?: number, oppStrength?: number, ownAttackStrength?: number|null, oppDefenceStrength?: number|null, ownDefenceStrength?: number|null, oppAttackStrength?: number|null }} fixture - The gameweek fixture; opp === 'BYE' means no fixture.
 * @param {number|null|undefined} goalsConceded90 - This player's own goalsConceded90 (for the clean-sheet nudge; GKP/DEF/MID only).
 * @param {number|null|undefined} leagueAvgGoalsConceded90 - League-average goalsConceded90 baseline (see computeLeagueAverageGoalsConceded90).
 * @returns {{ pts: number, breakdown: object }} Rounded XP and a breakdown of each adjustment applied.
 */
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90 }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        const usedStrengthPath = typeof fixture.ownStrength === 'number' && typeof fixture.oppStrength === 'number';

        // --- FDR-based scaling (strength-aware, see getAttackMultiplier) ---
        breakdown.fdrMultiplier = getAttackMultiplier(fixture);
        pts *= breakdown.fdrMultiplier;

        // --- Home/Away base adjustment ---
        // Only applied on the legacy diff-based fallback path: venue-matched strength values
        // already bake in home/away advantage, so adding this on top would double-count it.
        if (usedStrengthPath) {
            breakdown.homeAwayAdj = 0;
        } else {
            breakdown.homeAwayAdj = (fixture.loc === 'H') ? 0.35 : -0.35;
            pts += breakdown.homeAwayAdj;
        }

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
            // MID gets 1 pt for a clean sheet (FPL rule)
            const csProb = getCleanSheetProb(fixture);
            const avgCsProb = usedStrengthPath ? AVG_CS_PROB_STRENGTH_PATH : getCleanSheetProb({ diff: 3, loc: 'H' });
            breakdown.csAdj = (csProb - avgCsProb) * 1;
            breakdown.csAdj += computeGoalsConcededNudge(goalsConceded90, leagueAvgGoalsConceded90);
            pts += breakdown.csAdj;

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
    } else {
        pts = 0.0;
    }

    const chance = (chanceOfPlaying !== null && chanceOfPlaying !== undefined) ? chanceOfPlaying / 100 : 1.0;
    pts *= chance;

    // Floor at 0.8 expected points for expected playing starters to avoid showing 0.0 XP for active fixtures
    const isExpectedStarter = chance > 0.8 && (mppg >= 45 || starts >= 15);
    if (isExpectedStarter && fixture.opp !== 'BYE') {
        pts = Math.max(0.8, pts);
    }

    pts = Math.max(0, Math.round(pts * 10) / 10);

    return { pts, breakdown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "test/predictionModel.test.js"`
Expected: PASS — all tests green, including the pre-existing `computeGwPrediction` tests (confirms the legacy fallback path is byte-for-byte unchanged).

- [ ] **Step 5: Run the full suite to confirm no other test broke**

Run: `npm test`
Expected: PASS — every test file, no regressions elsewhere (nothing else imports `getCleanSheetProb` directly per the codebase-wide grep done during brainstorming).

- [ ] **Step 6: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: strength-aware attack/clean-sheet formulas + goalsConceded90 nudge"
```

---

### Task 3: `sync.js` — wire team strength into teamsList and fixturesSchedule

**Files:**
- Modify: `sync.js`

No dedicated test file (see "Before you start" — `sync.js` has no unit tests in this codebase). Verified via a syntax check plus a manual smoke-check against real FPL data.

- [ ] **Step 1: Add the new imports**

Modify `sync.js` — after the existing imports (currently lines 1-5), add:

```js
import { buildHistoricalStrengthByCode, resolveTeamStrength, HISTORICAL_TEAMS_CSV_URL } from './lib/teamStrength.js';
import { parseCsv } from './lib/csv.js';
```

- [ ] **Step 2: Fetch historical team strength before building teamsList**

Modify `sync.js` — inside `parseAndWriteData(data, fixturesData)`, immediately after the closing of the `existingPlayers` try/catch block (the block ending with `console.warn('Warning: Could not read/parse existing players from data.js: ', err.message); }`) and before `const teams = data.teams;`, add:

```js
    let historicalStrengthByCode = new Map();
    try {
        const historicalRes = await fetch(HISTORICAL_TEAMS_CSV_URL, { signal: AbortSignal.timeout(5000) });
        if (historicalRes.ok) {
            historicalStrengthByCode = buildHistoricalStrengthByCode(parseCsv(await historicalRes.text()));
        }
    } catch (err) {
        console.warn('Historical team-strength fetch skipped (non-fatal, falls back to overall-strength only):', err.message);
    }
```

- [ ] **Step 3: Attach strength fields to teamsList**

Modify `sync.js` — the `teamsList` map (the block starting `const teamsList = teams.map(t => {` and ending with its closing `});`). Replace the `return` statement inside it:

Old:
```js
        return {
            id: t.id,
            name: t.name,
            shortName: shortName,
            color: color
        };
```

New:
```js
        const resolvedStrength = resolveTeamStrength({
            code: t.code,
            strengthAttackHome: t.strength_attack_home,
            strengthAttackAway: t.strength_attack_away,
            strengthDefenceHome: t.strength_defence_home,
            strengthDefenceAway: t.strength_defence_away
        }, historicalStrengthByCode);

        return {
            id: t.id,
            code: t.code,
            name: t.name,
            shortName: shortName,
            color: color,
            strengthOverallHome: t.strength_overall_home,
            strengthOverallAway: t.strength_overall_away,
            ...resolvedStrength
        };
```

Then, immediately after the `teamsList` map's closing `});`, add a lookup table for the next step:

```js
    const teamByShortName = {};
    teamsList.forEach(t => { teamByShortName[t.shortName] = t; });
```

- [ ] **Step 4: Attach venue-matched strength to each fixture**

Modify `sync.js` — the `fixturesData.forEach(f => { ... })` block that builds `fixturesSchedule`. Replace it entirely:

Old:
```js
    fixturesData.forEach(f => {
        const gw = f.event;
        if (gw >= 1 && gw <= 38) {
            const homeTeam = teamMap[f.team_h];
            const awayTeam = teamMap[f.team_a];
            
            if (fixturesSchedule[homeTeam]) {
                fixturesSchedule[homeTeam].push({
                    gw: gw,
                    opp: awayTeam,
                    loc: 'H',
                    diff: f.team_h_difficulty
                });
            }
            if (fixturesSchedule[awayTeam]) {
                fixturesSchedule[awayTeam].push({
                    gw: gw,
                    opp: homeTeam,
                    loc: 'A',
                    diff: f.team_a_difficulty
                });
            }
        }
    });
```

New:
```js
    fixturesData.forEach(f => {
        const gw = f.event;
        if (gw >= 1 && gw <= 38) {
            const homeTeam = teamMap[f.team_h];
            const awayTeam = teamMap[f.team_a];
            const homeTeamObj = teamByShortName[homeTeam];
            const awayTeamObj = teamByShortName[awayTeam];

            if (fixturesSchedule[homeTeam]) {
                fixturesSchedule[homeTeam].push({
                    gw: gw,
                    opp: awayTeam,
                    loc: 'H',
                    diff: f.team_h_difficulty,
                    ownStrength: homeTeamObj.strengthOverallHome,
                    oppStrength: awayTeamObj.strengthOverallAway,
                    ownAttackStrength: homeTeamObj.strengthAttackHome,
                    oppDefenceStrength: awayTeamObj.strengthDefenceAway,
                    ownDefenceStrength: homeTeamObj.strengthDefenceHome,
                    oppAttackStrength: awayTeamObj.strengthAttackAway
                });
            }
            if (fixturesSchedule[awayTeam]) {
                fixturesSchedule[awayTeam].push({
                    gw: gw,
                    opp: homeTeam,
                    loc: 'A',
                    diff: f.team_a_difficulty,
                    ownStrength: awayTeamObj.strengthOverallAway,
                    oppStrength: homeTeamObj.strengthOverallHome,
                    ownAttackStrength: awayTeamObj.strengthAttackAway,
                    oppDefenceStrength: homeTeamObj.strengthDefenceHome,
                    ownDefenceStrength: awayTeamObj.strengthDefenceAway,
                    oppAttackStrength: homeTeamObj.strengthAttackHome
                });
            }
        }
    });
```

- [ ] **Step 5: Syntax-check and smoke-test against real data**

Run: `node --check sync.js`
Expected: no output (valid syntax)

Run:
```bash
node -e "
import('./sync.js').then(async () => {
  console.log('sync.js loaded without throwing');
}).catch(e => { console.error('LOAD FAILED:', e.message); process.exit(1); });
"
```
Expected: `sync.js loaded without throwing` (confirms no import/reference errors before doing a full live sync)

Run: `npm run sync`
Expected: completes successfully (same as any other sync run). Then verify the new fields landed:
```bash
node -e "
import('./data.js').then(({ TEAMS }) => {
  const ars = TEAMS.find(t => t.shortName === 'ARS');
  console.log(JSON.stringify(ars, null, 2));
});
"
```
Expected: the Arsenal team object includes `strengthOverallHome`, `strengthOverallAway` (real FPL values) and `strengthAttackHome`/`strengthAttackAway`/`strengthDefenceHome`/`strengthDefenceAway` (either this season's real values if FPL has populated them by now, or last season's historical values around the 1300-1400 range for a strong team like Arsenal — not `0` and not `null`, since Arsenal was in last season's Premier League).

- [ ] **Step 6: Commit**

```bash
git add sync.js
git commit -m "feat: wire team-strength data into teamsList and fixturesSchedule"
```

---

### Task 4: `sync.js` — two-pass restructure for the goalsConceded90 league average

**Files:**
- Modify: `sync.js`

Splits the single `elements.map(el => {...})` (which currently computes both per-player base stats AND predictions in one pass) into two passes, so `computeLeagueAverageGoalsConceded90` can run on the full player pool before any predictions are computed. No dedicated test file (see "Before you start").

- [ ] **Step 1: Add the new import**

Modify `sync.js` — add `computeLeagueAverageGoalsConceded90` to the existing `predictionModel.js` import line:

Old:
```js
import { computeBasePPG, computeGwPrediction } from './lib/predictionModel.js';
```

New:
```js
import { computeBasePPG, computeGwPrediction, computeLeagueAverageGoalsConceded90 } from './lib/predictionModel.js';
```

- [ ] **Step 2: Split the player-processing loop into two passes**

Modify `sync.js` — this replaces the entire `const playersList = elements.map(el => { ... });` block (from `const playersList = elements.map(el => {` through its matching closing `});`, which currently contains everything from player-name resolution through the predictions loop and final return object).

Old (full block being replaced):
```js
    const playersList = elements.map(el => {
        const playerName = `${el.first_name} ${el.second_name}`;
        let teamShort = teamMap[el.team] || 'MUN';
        const position = posMap[el.element_type] || 'MID';
        const price = el.now_cost / 10;
        const ownership = parseFloat(el.selected_by_percent) || 0;

        let transferredThisSeason = false;
        let oldTeam = null;

        // isNewToCurrentTeam: generic, always-available signal from FPL's own team_join_date --
        // no hardcoded transfer list needed, and unlike diffing our own rotation history this
        // works immediately on the very first sync, including summer transfer window signings.
        let isNewToCurrentTeam = false;
        if (el.team_join_date) {
            const joinedAt = new Date(el.team_join_date);
            if (!Number.isNaN(joinedAt.getTime())) {
                const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
                isNewToCurrentTeam = daysSinceJoin <= NEW_TO_TEAM_DAYS_THRESHOLD;
            }
        }
        transferredThisSeason = isNewToCurrentTeam;

        // Mock target price change
        const transfersIn = el.transfers_in_event || 0;
        const transfersOut = el.transfers_out_event || 0;
        let changeTarget = 0;
        if (transfersIn + transfersOut > 0) {
            changeTarget = ((transfersIn - transfersOut) / (transfersIn + transfersOut)) * 100;
        }
        if (changeTarget === 0) {
            changeTarget = (Math.random() * 200) - 100;
        }
        changeTarget = Math.max(-100, Math.min(100, changeTarget));

        // Prefer the stable `code` field for matching, but fall back to name matching if no
        // code match is found (e.g. the first sync after this field started being written --
        // existing data.js entries won't have a `code` yet, so this keeps last season's
        // historical merge below working exactly as it did before, self-healing after one sync).
        const existingPlayer = existingPlayers.find(ep => ep.code === el.code) || existingPlayers.find(ep => ep.name === playerName);

        if (isNewToCurrentTeam && existingPlayer && existingPlayer.team && existingPlayer.team !== teamShort) {
            oldTeam = existingPlayer.team;
        }

        let minutes = el.minutes || 0;
        let starts = el.starts || 0;
        let totalPoints = el.total_points || 0;
        let totalSaves = parseInt(el.saves) || 0;
        let goalsConceded = parseInt(el.goals_conceded) || 0;

        // Early-season merge logic: if current season minutes are low (e.g. < 900 minutes played this season),
        // we merge with historical stats from the existing database to avoid overwriting last season's stats.
        const isEarlySeason = (el.minutes || 0) < 900;
        if (isEarlySeason && existingPlayer) {
            starts = existingPlayer.GS !== undefined ? existingPlayer.GS : starts;
            minutes = (existingPlayer.MPPG !== undefined && existingPlayer.GS !== undefined) 
                ? Math.round(existingPlayer.MPPG * (existingPlayer.GS || 1)) 
                : (existingPlayer.MPPG !== undefined ? Math.round(existingPlayer.MPPG * 10) : minutes);
            totalPoints = existingPlayer.points !== undefined ? existingPlayer.points : totalPoints;
            totalSaves = existingPlayer.saves !== undefined ? existingPlayer.saves : totalSaves;
            goalsConceded = existingPlayer.goalsConceded !== undefined ? existingPlayer.goalsConceded : goalsConceded;
        }

        // If they still have 0 minutes/starts (e.g. newly promoted teams or new signings from abroad not in the old database)
        const isPromoted = PROMOTED_TEAMS.includes(teamShort);
        if (minutes === 0 && starts === 0) {
            const isExpectedStarter = isPromoted 
                ? (ownership > 0.4 || price >= (position === 'GKP' || position === 'DEF' ? 4.0 : 4.5)) 
                : (price >= (position === 'GKP' || position === 'DEF' ? 4.5 : 5.5) || ownership > 1.5);
                
            if (isExpectedStarter) {
                starts = 25;
                const defaultMins = (position === 'GKP' || position === 'DEF') ? 90 : 80;
                minutes = starts * defaultMins;
                totalPoints = starts * (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.5 : (position === 'MID' ? 3.0 : 3.5)));
                totalSaves = position === 'GKP' ? starts * 3 : 0;
                goalsConceded = (position === 'GKP' || position === 'DEF') ? starts * 1.2 : 0;
            }
        }

        const xG = parseFloat(el.expected_goals) || 0.0;
        const xA = parseFloat(el.expected_assists) || 0.0;

        // Regress per-90 metrics for low minutes (< 450 minutes) to prevent small sample size inflation
        const sampleSizeFactor = minutes >= 450 ? 1.0 : (minutes / 450);
        const xG90 = minutes > 0 ? ((xG / minutes) * 90) * sampleSizeFactor : 0.0;
        const xA90 = minutes > 0 ? ((xA / minutes) * 90) * sampleSizeFactor : 0.0;

        // GK-specific stats regression
        const baseSaves90 = 3.0;
        const rawSaves90 = minutes > 0 ? (totalSaves / minutes) * 90 : baseSaves90;
        const saves90 = minutes >= 450 ? rawSaves90 : baseSaves90 + (rawSaves90 - baseSaves90) * sampleSizeFactor;

        const baseGc90 = 1.37;
        const rawGc90 = minutes > 0 ? (goalsConceded / minutes) * 90 : baseGc90;
        const goalsConceded90 = minutes >= 450 ? rawGc90 : baseGc90 + (rawGc90 - baseGc90) * sampleSizeFactor;

        let appearances = starts;
        if (minutes > starts * 90) {
            appearances = starts + Math.round((minutes - starts * 90) / 20);
        }
        if (minutes > 0 && appearances === 0) appearances = 1;
        const mppg = appearances > 0 ? minutes / appearances : 0.0;

        // Calculate a realistic points-per-game baseline.
        // isPromotedOrTransfer here is purely a productivity question: season-cumulative
        // minutes already correctly reflect a player's real point-scoring history regardless
        // of which club earned it, so "no minutes yet" is the only signal computeBasePPG needs.
        const isPromotedOrTransfer = minutes === 0;

        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: undefined
        });

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

            // Calculate deterministic actual points if the fixture is completed
            let actualPts = null;
            if (fixture.opp !== 'BYE') {
                const teamId = data.teams.find(t => t.short_name === teamShort)?.id;
                const fData = fixturesData.find(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
                if (fData && fData.finished) {
                    let cleanSheet = false;
                    if (position === 'GKP' || position === 'DEF') {
                        if (fData.team_h === teamId && fData.team_a_score === 0) cleanSheet = true;
                        if (fData.team_a === teamId && fData.team_h_score === 0) cleanSheet = true;
                    }
                    
                    let ptsBase = 2;
                    if (cleanSheet) ptsBase += 4;
                    
                    const seed = el.id * 17 + gw * 31;
                    const pseudoRandom = (Math.abs(Math.sin(seed)) * 1000) % 1;
                    
                    let attackingPts = 0;
                    const goalChance = (xG / 38) * 1.5;
                    const assistChance = (xA / 38) * 1.5;
                    
                    if (pseudoRandom < goalChance) {
                        attackingPts += (position === 'FWD' ? 4 : 5);
                    } else if (pseudoRandom < goalChance + assistChance) {
                        attackingPts += 3;
                    }
                    
                    let cardPts = 0;
                    if (pseudoRandom > 0.88) cardPts = -1;
                    
                    let bonusPts = 0;
                    if (pseudoRandom < 0.15) bonusPts = 3;
                    else if (pseudoRandom < 0.25) bonusPts = 2;
                    else if (pseudoRandom < 0.35) bonusPts = 1;
                    
                    // GK: actual saves bonus from real match data
                    let savePts = 0;
                    if (position === 'GKP') {
                        // Use goals conceded as a proxy: teams that concede 2+ goals typically face 5+ shots saved
                        const goalsIn = fData.team_h === teamId ? fData.team_a_score : fData.team_h_score;
                        // Rough: 2-3 saves per goal scored on average (FPL-approximate)
                        const estimatedSaves = Math.round(goalsIn * 2.5 + (pseudoRandom * 2));
                        savePts = Math.floor(estimatedSaves / 3);
                    }
                    
                    actualPts = ptsBase + attackingPts + cardPts + bonusPts + savePts;
                    const playChance = el.starts / 38;
                    if (pseudoRandom > playChance && playChance < 0.8) {
                        actualPts = 0;
                    }
                    actualPts = Math.max(0, actualPts);
                }
            }

            predictions.push({
                gw: gw,
                pts: pts,
                opp: fixture.opp,
                loc: fixture.loc,
                diff: fixture.diff,
                actualPts: actualPts
            });
        }

        const totalXp10 = predictions.slice(0, 10).reduce((sum, pr) => sum + pr.pts, 0);
 
        return {
            id: el.id,
            code: el.code,
            name: `${el.first_name} ${el.second_name}`,
            web_name: el.web_name,
            team: teamShort,
            position: position,
            price: price,
            ownership: ownership,
            points: totalPoints,
            xG: xG,
            xA: xA,
            xG90: parseFloat(xG90.toFixed(2)),
            xA90: parseFloat(xA90.toFixed(2)),
            xGI: parseFloat(el.expected_goal_involvements) || 0.0,
            ictIndex: parseFloat(el.ict_index) || 0.0,
            priceChangeTarget: changeTarget,
            predictions: predictions,
            GS: starts,
            MPPG: parseFloat(mppg.toFixed(1)),
            saves: totalSaves,
            saves90: parseFloat(saves90.toFixed(2)),
            goalsConceded: goalsConceded,
            goalsConceded90: parseFloat(goalsConceded90.toFixed(2)),
            transferredThisSeason: transferredThisSeason,
            oldTeam: oldTeam,
            news: el.news || "",
            status: el.status || "a",
            chanceOfPlaying: el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100,
            xp10: parseFloat(totalXp10.toFixed(1))
        };

    });
```

New (two passes replacing it):
```js
    const playerBaseList = elements.map(el => {
        const playerName = `${el.first_name} ${el.second_name}`;
        let teamShort = teamMap[el.team] || 'MUN';
        const position = posMap[el.element_type] || 'MID';
        const price = el.now_cost / 10;
        const ownership = parseFloat(el.selected_by_percent) || 0;

        let transferredThisSeason = false;
        let oldTeam = null;

        // isNewToCurrentTeam: generic, always-available signal from FPL's own team_join_date --
        // no hardcoded transfer list needed, and unlike diffing our own rotation history this
        // works immediately on the very first sync, including summer transfer window signings.
        let isNewToCurrentTeam = false;
        if (el.team_join_date) {
            const joinedAt = new Date(el.team_join_date);
            if (!Number.isNaN(joinedAt.getTime())) {
                const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
                isNewToCurrentTeam = daysSinceJoin <= NEW_TO_TEAM_DAYS_THRESHOLD;
            }
        }
        transferredThisSeason = isNewToCurrentTeam;

        // Mock target price change
        const transfersIn = el.transfers_in_event || 0;
        const transfersOut = el.transfers_out_event || 0;
        let changeTarget = 0;
        if (transfersIn + transfersOut > 0) {
            changeTarget = ((transfersIn - transfersOut) / (transfersIn + transfersOut)) * 100;
        }
        if (changeTarget === 0) {
            changeTarget = (Math.random() * 200) - 100;
        }
        changeTarget = Math.max(-100, Math.min(100, changeTarget));

        // Prefer the stable `code` field for matching, but fall back to name matching if no
        // code match is found (e.g. the first sync after this field started being written --
        // existing data.js entries won't have a `code` yet, so this keeps last season's
        // historical merge below working exactly as it did before, self-healing after one sync).
        const existingPlayer = existingPlayers.find(ep => ep.code === el.code) || existingPlayers.find(ep => ep.name === playerName);

        if (isNewToCurrentTeam && existingPlayer && existingPlayer.team && existingPlayer.team !== teamShort) {
            oldTeam = existingPlayer.team;
        }

        let minutes = el.minutes || 0;
        let starts = el.starts || 0;
        let totalPoints = el.total_points || 0;
        let totalSaves = parseInt(el.saves) || 0;
        let goalsConceded = parseInt(el.goals_conceded) || 0;

        // Early-season merge logic: if current season minutes are low (e.g. < 900 minutes played this season),
        // we merge with historical stats from the existing database to avoid overwriting last season's stats.
        const isEarlySeason = (el.minutes || 0) < 900;
        if (isEarlySeason && existingPlayer) {
            starts = existingPlayer.GS !== undefined ? existingPlayer.GS : starts;
            minutes = (existingPlayer.MPPG !== undefined && existingPlayer.GS !== undefined) 
                ? Math.round(existingPlayer.MPPG * (existingPlayer.GS || 1)) 
                : (existingPlayer.MPPG !== undefined ? Math.round(existingPlayer.MPPG * 10) : minutes);
            totalPoints = existingPlayer.points !== undefined ? existingPlayer.points : totalPoints;
            totalSaves = existingPlayer.saves !== undefined ? existingPlayer.saves : totalSaves;
            goalsConceded = existingPlayer.goalsConceded !== undefined ? existingPlayer.goalsConceded : goalsConceded;
        }

        // If they still have 0 minutes/starts (e.g. newly promoted teams or new signings from abroad not in the old database)
        const isPromoted = PROMOTED_TEAMS.includes(teamShort);
        if (minutes === 0 && starts === 0) {
            const isExpectedStarter = isPromoted 
                ? (ownership > 0.4 || price >= (position === 'GKP' || position === 'DEF' ? 4.0 : 4.5)) 
                : (price >= (position === 'GKP' || position === 'DEF' ? 4.5 : 5.5) || ownership > 1.5);
                
            if (isExpectedStarter) {
                starts = 25;
                const defaultMins = (position === 'GKP' || position === 'DEF') ? 90 : 80;
                minutes = starts * defaultMins;
                totalPoints = starts * (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.5 : (position === 'MID' ? 3.0 : 3.5)));
                totalSaves = position === 'GKP' ? starts * 3 : 0;
                goalsConceded = (position === 'GKP' || position === 'DEF') ? starts * 1.2 : 0;
            }
        }

        const xG = parseFloat(el.expected_goals) || 0.0;
        const xA = parseFloat(el.expected_assists) || 0.0;

        // Regress per-90 metrics for low minutes (< 450 minutes) to prevent small sample size inflation
        const sampleSizeFactor = minutes >= 450 ? 1.0 : (minutes / 450);
        const xG90 = minutes > 0 ? ((xG / minutes) * 90) * sampleSizeFactor : 0.0;
        const xA90 = minutes > 0 ? ((xA / minutes) * 90) * sampleSizeFactor : 0.0;

        // GK-specific stats regression
        const baseSaves90 = 3.0;
        const rawSaves90 = minutes > 0 ? (totalSaves / minutes) * 90 : baseSaves90;
        const saves90 = minutes >= 450 ? rawSaves90 : baseSaves90 + (rawSaves90 - baseSaves90) * sampleSizeFactor;

        const baseGc90 = 1.37;
        const rawGc90 = minutes > 0 ? (goalsConceded / minutes) * 90 : baseGc90;
        const goalsConceded90 = minutes >= 450 ? rawGc90 : baseGc90 + (rawGc90 - baseGc90) * sampleSizeFactor;

        let appearances = starts;
        if (minutes > starts * 90) {
            appearances = starts + Math.round((minutes - starts * 90) / 20);
        }
        if (minutes > 0 && appearances === 0) appearances = 1;
        const mppg = appearances > 0 ? minutes / appearances : 0.0;

        // Calculate a realistic points-per-game baseline.
        // isPromotedOrTransfer here is purely a productivity question: season-cumulative
        // minutes already correctly reflect a player's real point-scoring history regardless
        // of which club earned it, so "no minutes yet" is the only signal computeBasePPG needs.
        const isPromotedOrTransfer = minutes === 0;

        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: undefined
        });

        return {
            id: el.id,
            code: el.code,
            name: `${el.first_name} ${el.second_name}`,
            web_name: el.web_name,
            team: teamShort,
            position: position,
            price: price,
            ownership: ownership,
            points: totalPoints,
            xG: xG,
            xA: xA,
            xG90: parseFloat(xG90.toFixed(2)),
            xA90: parseFloat(xA90.toFixed(2)),
            xGI: parseFloat(el.expected_goal_involvements) || 0.0,
            ictIndex: parseFloat(el.ict_index) || 0.0,
            priceChangeTarget: changeTarget,
            GS: starts,
            MPPG: parseFloat(mppg.toFixed(1)),
            saves: totalSaves,
            saves90: parseFloat(saves90.toFixed(2)),
            goalsConceded: goalsConceded,
            goalsConceded90: parseFloat(goalsConceded90.toFixed(2)),
            transferredThisSeason: transferredThisSeason,
            oldTeam: oldTeam,
            news: el.news || "",
            status: el.status || "a",
            chanceOfPlaying: el.chance_of_playing_next_round !== null ? el.chance_of_playing_next_round : 100,
            basePPG,
            mppg,
            starts,
            minutes
        };
    });

    // Computed from the full player pool now that pass 1 is complete, before any predictions
    // run, so every player's clean-sheet nudge (Task 2, lib/predictionModel.js) compares
    // against the same real, dynamically-computed baseline.
    const leagueAvgGoalsConceded90 = computeLeagueAverageGoalsConceded90(playerBaseList);
    // Sanity log: if this ever prints "null" during a real sync, the goalsConceded90 nudge is
    // silently a no-op for every player -- a wiring bug (mismatched field name/shape between
    // this array and computeLeagueAverageGoalsConceded90's expectations), not a real "no data"
    // case, since every sync has hundreds of GKP/DEF players with real minutes.
    console.log('League average goalsConceded90 (GKP/DEF, min. 450 mins):', leagueAvgGoalsConceded90);

    const playersList = playerBaseList.map(player => {
        // minutes is stripped from restFields here (not spread into the final player object) --
        // it's only needed for the league-average computation above; the original data.js schema
        // never exposed raw minutes (only the derived MPPG), and this preserves that exactly.
        const { basePPG, mppg, starts, minutes, ...restFields } = player;
        const predictions = [];
        const fixtures = fixturesSchedule[player.team] || [];

        for (let gw = 1; gw <= 38; gw++) {
            const fixture = fixtures.find(f => f.gw === gw) || { opp: 'BYE', loc: 'H', diff: 3 };

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

            // Calculate deterministic actual points if the fixture is completed
            let actualPts = null;
            if (fixture.opp !== 'BYE') {
                const teamId = data.teams.find(t => t.short_name === player.team)?.id;
                const fData = fixturesData.find(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
                if (fData && fData.finished) {
                    let cleanSheet = false;
                    if (player.position === 'GKP' || player.position === 'DEF') {
                        if (fData.team_h === teamId && fData.team_a_score === 0) cleanSheet = true;
                        if (fData.team_a === teamId && fData.team_h_score === 0) cleanSheet = true;
                    }

                    let ptsBase = 2;
                    if (cleanSheet) ptsBase += 4;

                    const seed = player.id * 17 + gw * 31;
                    const pseudoRandom = (Math.abs(Math.sin(seed)) * 1000) % 1;

                    let attackingPts = 0;
                    const goalChance = (player.xG / 38) * 1.5;
                    const assistChance = (player.xA / 38) * 1.5;

                    if (pseudoRandom < goalChance) {
                        attackingPts += (player.position === 'FWD' ? 4 : 5);
                    } else if (pseudoRandom < goalChance + assistChance) {
                        attackingPts += 3;
                    }

                    let cardPts = 0;
                    if (pseudoRandom > 0.88) cardPts = -1;

                    let bonusPts = 0;
                    if (pseudoRandom < 0.15) bonusPts = 3;
                    else if (pseudoRandom < 0.25) bonusPts = 2;
                    else if (pseudoRandom < 0.35) bonusPts = 1;

                    // GK: actual saves bonus from real match data
                    let savePts = 0;
                    if (player.position === 'GKP') {
                        // Use goals conceded as a proxy: teams that concede 2+ goals typically face 5+ shots saved
                        const goalsIn = fData.team_h === teamId ? fData.team_a_score : fData.team_h_score;
                        // Rough: 2-3 saves per goal scored on average (FPL-approximate)
                        const estimatedSaves = Math.round(goalsIn * 2.5 + (pseudoRandom * 2));
                        savePts = Math.floor(estimatedSaves / 3);
                    }

                    actualPts = ptsBase + attackingPts + cardPts + bonusPts + savePts;
                    const playChance = starts / 38;
                    if (pseudoRandom > playChance && playChance < 0.8) {
                        actualPts = 0;
                    }
                    actualPts = Math.max(0, actualPts);
                }
            }

            predictions.push({
                gw: gw,
                pts: pts,
                opp: fixture.opp,
                loc: fixture.loc,
                diff: fixture.diff,
                actualPts: actualPts
            });
        }

        const totalXp10 = predictions.slice(0, 10).reduce((sum, pr) => sum + pr.pts, 0);

        return {
            ...restFields,
            predictions,
            xp10: parseFloat(totalXp10.toFixed(1))
        };
    });
```

- [ ] **Step 3: Syntax-check and smoke-test**

Run: `node --check sync.js`
Expected: no output (valid syntax)

Run: `npm run sync`
Expected: completes successfully, and the sync log includes a line `League average goalsConceded90 (GKP/DEF, min. 450 mins): <a real number, not null>` — if it prints `null`, stop and fix the wiring before continuing (see the code comment above that log line for why `null` here means a bug, not a legitimate "no data" state).

Run:
```bash
node -e "
import('./data.js').then(({ PLAYERS }) => {
  const p = PLAYERS.find(pl => pl.position === 'DEF' && pl.MPPG > 60);
  console.log('sample DEF player:', JSON.stringify({ web_name: p.web_name, goalsConceded90: p.goalsConceded90, gw1: p.predictions[0] }, null, 2));
  console.log('total players:', PLAYERS.length);
});
"
```
Expected: a real DEF player prints with a valid `goalsConceded90` and a `predictions[0].pts` that's a normal-looking number (not `NaN`, not `undefined`) — confirms the two-pass restructure didn't break the per-player output shape, and `total players` matches the usual ~700 (confirms no players were silently dropped by the restructure).

- [ ] **Step 4: Commit**

```bash
git add sync.js
git commit -m "refactor: split player processing into two passes for the goalsConceded90 league average"
```

---

### Task 5: `sync.js` — bake in a real league-average-goals seed, `ticker.js` uses the real model

**Files:**
- Modify: `sync.js`
- Modify: `components/ticker.js`

- [ ] **Step 1: Compute and export a real league-average-goals-per-game value**

Modify `sync.js` — add this function near the top of the file, after the existing imports:

```js
// League-average goals-per-team-per-game, used by ticker.js's Projected Goals tab. Computed from
// this season's real finished fixtures; the 1.4 fallback is only a bootstrap seed for before any
// fixture has been played this season (recent Premier League seasons have averaged close to this),
// and self-corrects to real data the moment GW1 finishes -- same pattern as baseGc90/baseSaves90
// elsewhere in this file (a documented default used only until real per-fixture data exists).
function computeLeagueAvgGoalsPerGame(fixturesData) {
    const finished = fixturesData.filter(f => f.finished && typeof f.team_h_score === 'number' && typeof f.team_a_score === 'number');
    if (finished.length === 0) return 1.4;
    const totalGoals = finished.reduce((sum, f) => sum + f.team_h_score + f.team_a_score, 0);
    return totalGoals / (finished.length * 2);
}
```

Then, inside `parseAndWriteData`, immediately before the `const fileContent = ...` template-literal assignment, add:

```js
    const leagueAvgGoalsPerGame = computeLeagueAvgGoalsPerGame(fixturesData);
```

Then modify the `fileContent` template literal — add a new export line immediately after the existing `export const XP_CALIBRATION_FACTOR = ${calibrationFactor};` line:

Old:
```js
export const XP_CALIBRATION_FACTOR = ${calibrationFactor};

export function getPlayerRatings(player, currentGw = 1) {
```

New:
```js
export const XP_CALIBRATION_FACTOR = ${calibrationFactor};

export const LEAGUE_AVG_GOALS_PER_GAME = ${leagueAvgGoalsPerGame};

export function getPlayerRatings(player, currentGw = 1) {
```

- [ ] **Step 2: Syntax-check**

Run: `node --check sync.js`
Expected: no output

- [ ] **Step 3: Update `ticker.js` to use the real model instead of the hardcoded lookup tables**

Modify `components/ticker.js` — replace the entire top of the file, from the import line through the end of `getProjectedGoals` (currently lines 1-79), with:

```js
import { TEAMS, TICKER_DATA } from '../data.js';
import * as DataModule from '../data.js';
import { getCleanSheetProb, getAttackMultiplier } from '../lib/predictionModel.js';

// Namespace import (not a named import) for LEAGUE_AVG_GOALS_PER_GAME: same reasoning as
// app.js's XP_CALIBRATION_FACTOR handling -- a named import of a field data.js might not yet
// have (e.g. right after a merge, before the next sync bakes it in) is a hard Vite build-time
// error, not a runtime-catchable undefined.
const LEAGUE_AVG_GOALS_PER_GAME = (typeof DataModule.LEAGUE_AVG_GOALS_PER_GAME === 'number') ? DataModule.LEAGUE_AVG_GOALS_PER_GAME : 1.4;
```

- [ ] **Step 4: Replace the mode branches to call the real model**

Modify `components/ticker.js` — inside `renderTicker`'s `renderTable` function, replace the `if (mode === 'cleansheet') { ... } else if (mode === 'goals') { ... }` block:

Old:
```js
            if (mode === 'cleansheet') {
                adjustedFixtures = activeFixtures.map(f => {
                    const odds = getCleanSheetOdds(team.shortName, f.opp, f.loc, f.gw, f.diff);
                    let diffClass = 'diff-3';
                    if (odds >= 38) diffClass = 'diff-2';
                    else if (odds >= 28) diffClass = 'diff-3';
                    else if (odds >= 18) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: `${odds}%`, numeric: odds, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else if (mode === 'goals') {
                adjustedFixtures = activeFixtures.map(f => {
                    const goals = getProjectedGoals(team.shortName, f.opp, f.loc, f.gw, f.diff);
                    let diffClass = 'diff-3';
                    if (goals >= 1.8) diffClass = 'diff-2';
                    else if (goals >= 1.3) diffClass = 'diff-3';
                    else if (goals >= 0.9) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: goals.toFixed(2), numeric: goals, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else {
```

New:
```js
            if (mode === 'cleansheet') {
                adjustedFixtures = activeFixtures.map(f => {
                    const odds = Math.round(getCleanSheetProb(f) * 100);
                    let diffClass = 'diff-3';
                    if (odds >= 38) diffClass = 'diff-2';
                    else if (odds >= 28) diffClass = 'diff-3';
                    else if (odds >= 18) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: `${odds}%`, numeric: odds, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else if (mode === 'goals') {
                adjustedFixtures = activeFixtures.map(f => {
                    const multiplier = getAttackMultiplier(f);
                    const goals = Math.max(0.4, Math.min(3.5, parseFloat((LEAGUE_AVG_GOALS_PER_GAME * multiplier).toFixed(2))));
                    let diffClass = 'diff-3';
                    if (goals >= 1.8) diffClass = 'diff-2';
                    else if (goals >= 1.3) diffClass = 'diff-3';
                    else if (goals >= 0.9) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: goals.toFixed(2), numeric: goals, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else {
```

- [ ] **Step 5: Syntax-check ticker.js**

Run: `node --check components/ticker.js`
Expected: no output

- [ ] **Step 6: Full smoke-test — sync, build, and verify the ticker's three tabs agree on direction**

Run: `npm run sync && npm run build`
Expected: both complete successfully

Run:
```bash
node -e "
import('./data.js').then(async ({ TEAMS, TICKER_DATA, LEAGUE_AVG_GOALS_PER_GAME }) => {
  const { getCleanSheetProb, getAttackMultiplier } = await import('./lib/predictionModel.js');
  console.log('LEAGUE_AVG_GOALS_PER_GAME:', LEAGUE_AVG_GOALS_PER_GAME);
  const arsGw2 = TICKER_DATA['ARS'].find(f => f.gw === 2);
  console.log('ARS GW2 fixture (vs AVL, away):', JSON.stringify(arsGw2));
  console.log('FDR tab value (unchanged, official):', arsGw2.diff);
  console.log('Clean Sheet% tab value (new):', Math.round(getCleanSheetProb(arsGw2) * 100) + '%');
  console.log('Attack multiplier (new, drives Projected Goals tab):', getAttackMultiplier(arsGw2));
});
"
```
Expected: `LEAGUE_AVG_GOALS_PER_GAME` is a real number close to 1.4 (or the real season-to-date average if any fixtures have finished); the FDR tab still shows `diff: 4` (official, untouched); the attack multiplier is above 1.0 (confirms the ARS@AVL GW2 case behaves as the design predicted — easier by the new strength-based read than the old diff-based one).

- [ ] **Step 7: Commit**

```bash
git add sync.js components/ticker.js
git commit -m "feat: ticker.js Clean Sheet%/Projected Goals tabs use the real strength-based model"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass, including the new `test/teamStrength.test.js` and the updated `test/predictionModel.test.js`

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds. A warning about an export not being present in `data.js` would indicate a named-import mistake somewhere — there shouldn't be one here since `ticker.js` uses the namespace-import pattern for `LEAGUE_AVG_GOALS_PER_GAME`, but double-check the build output for any unexpected warning before proceeding.

- [ ] **Step 3: Re-verify the ARS @ AVL GW2 case end-to-end, including in the actual rendered UI**

This is the one concretely-verified example from the design spec where the new formula is *expected* to disagree with the old diff-based one.

```bash
node -e "
import('./data.js').then(({ PLAYERS }) => {
  const bruno = PLAYERS.find(p => p.web_name === 'Bruno G.' && p.team === 'ARS');
  console.log('Bruno G. GW2 (vs AVL, away):', JSON.stringify(bruno.predictions.find(p => p.gw === 2)));
});
"
```
Confirm the GW2 prediction is no longer computed purely off `diff: 4` (hard) in isolation — the underlying `fdrMultiplier` in a direct `getAttackMultiplier` call for this fixture should read above 1.0, not the old fallback's 0.88. Then load the app in a browser (`npm run build` output, or the dev server) and visually confirm the Fixture Difficulty Ticker's three tabs (Difficulty/Clean Sheet %/Projected Goals) for ARS GW2 are now internally consistent with each other in direction (all three agreeing on "easier" or "harder", not contradicting).

- [ ] **Step 4: Spot-check a newly-promoted team's fixture — confirm the tier-3 fallback engages correctly**

```bash
node -e "
import('./data.js').then(({ TEAMS, TICKER_DATA }) => {
  const promoted = TEAMS.find(t => ['HUL','IPS','COV'].includes(t.shortName));
  console.log('Promoted team strength:', JSON.stringify({ shortName: promoted.shortName, strengthAttackHome: promoted.strengthAttackHome, strengthDefenceHome: promoted.strengthDefenceHome }));
  const fixture = TICKER_DATA[promoted.shortName].find(f => f.gw === 1);
  console.log('Their GW1 fixture:', JSON.stringify(fixture));
});
"
```
Expected: the promoted team's `strengthAttackHome`/`strengthDefenceHome` are `null` (tier 3 — genuinely no last-season top-flight data), never `0`. Their GW1 fixture's `ownAttackStrength`/`ownDefenceStrength` are also `null`, confirming `getAttackMultiplier`/`getCleanSheetProb` will fall through to the overall-strength-only path for any fixture involving them (per Task 2's design), not silently produce a nonsense zero-strength result.

- [ ] **Step 5: Confirm the previously-hardcoded values are gone**

```bash
grep -n "CS_ODDS_LOOKUP\|PROJ_GOALS_LOOKUP" components/ticker.js
```
Expected: no output (both constants fully removed).

- [ ] **Step 6: Report status**

Summarize: test count, build status, and the two spot-check results above. This phase is ready for the same `finishing-a-development-branch` flow used for Phases 1 and 2 (present options → push/PR → merge → confirm Railway redeploy → re-run `npm run build` explicitly per the Phase 1 incident precedent).
