# Defensive Contribution — Design Spec

_Written 2026-08-12._

## Problem

Two related gaps found this session while investigating why the model's XP for genuine defensive
grafters (tacklers, interceptors) felt low compared to third-party sites, mirroring the exact
pattern that motivated the set-piece-duty work:

**1. The "Defcon Potential" UI badge is mislabeled.** Confirmed via reading `sync.js`'s
`getPlayerRatings` (around the `defconPotential` variable): it's computed from `avgOdds`, the same
fixture-difficulty-derived formula used for clean-sheet-style odds elsewhere in the same function.
The code's own comment even says `// 5. Defcon Potential (clean sheet potential...)`. It has never
been based on a player's real tackles/interceptions/clearances output. Since FPL introduced a real,
distinct "Defensive Contribution" scoring category for 2025/26 (2 bonus points for hitting a
per-match combined-actions threshold), users reasonably expect a badge called "Defcon Potential" to
reflect that — not fixture ease. This badge is surfaced in multiple places: the player tooltip, the
detail panel, a dedicated filter dropdown (`modalDefconSelect`), and a "🛡️ Best Defcon" badge in
`components/planner.js`.

**2. Real defensive-contribution data has zero effect on core XP.** Confirmed via grep:
`lib/predictionModel.js` has no reference to `defcon`/`defensive_contribution` anywhere.
`computeGwPrediction` — the function producing every displayed XP number app-wide — has no signal
for a player's real, per-90 combined defensive-actions rate, even though FPL's live
`bootstrap-static` API exposes it directly per player (`defensive_contribution_per_90`, confirmed
present and internally consistent this session — `defensive_contribution` was verified to exactly
equal `clearances_blocks_interceptions + tackles` for DEF, and `+ recoveries` for MID/FWD, by
reconstructing it from the sub-fields on real synced players).

## Goals

- Fix the mislabeled badge to reflect real defensive output (`defensive_contribution_per_90` vs. the
  real FPL threshold), not fixture ease.
- Add a real, evidence-anchored defensive-contribution term to `computeGwPrediction` so designated
  defensive workhorses get credit for it in every displayed XP number, not just an internal rating.

## Non-goals

- Not modeling fixture-difficulty dependence for defensive-contribution rate (e.g. "tougher fixture
  → more defensive actions needed"). Plausible in theory, but no real evidence was gathered this
  session for the direction or magnitude — adding it would be pure speculation. Flagged as a
  possible future refinement if evidence turns up, not silently assumed.
- Not attempting to model real per-match variance (FPL only exposes a season-aggregate per-90 rate,
  not match logs) — the hit-probability mapping below is a bucketed heuristic, not a fitted
  distribution. This is the same honesty level as `SET_PIECE_ASSIST_BONUS`'s existing comment.

## Design

### 1. Real per-player defensive-contribution rate (`sync.js`, pass 1)

`sync.js` already regresses several per-90 stats toward a league-average baseline for players with
under 450 minutes, to avoid small-sample noise (see `saves90`'s existing pattern). Apply the same
treatment to a new `dcPer90` field, sourced directly from FPL's own precomputed
`el.defensive_contribution_per_90` (no need to reconstruct it from sub-fields — the API already
provides the rate):

```js
// Real league averages this season (min. 900 minutes, i.e. ~10 full games, so the baseline itself
// isn't distorted by the same small-sample problem this regression exists to fix): DEF 7.76 (n=98),
// MID 8.38 (n=126), FWD 4.50 (n=24) -- computed directly from a fresh bootstrap-static pull. Only
// ~16% of qualifying DEF and ~6% of qualifying MID average at or above their own real threshold
// across a full season -- confirms sitting at the threshold is already an elite outcome, not a
// median one, which the hit-probability mapping below (Section 2) is calibrated against.
const BASE_DC90 = { DEF: 7.76, MID: 8.38, FWD: 4.50 };

const rawDcPer90 = parseFloat(el.defensive_contribution_per_90) || 0;
const baseDc90 = BASE_DC90[position] || 0;
const dcPer90 = minutes >= 450 ? rawDcPer90 : baseDc90 + (rawDcPer90 - baseDc90) * sampleSizeFactor;
```

Placed alongside the existing `saves90`/`goalsConceded90` regression block (same `sampleSizeFactor`
already in scope). `dcPer90` becomes a pass-1 scratch field like `mppg`/`starts`, destructured out at
the top of the prediction loop (same pattern `saves90` already follows) and passed into
`computeGwPrediction`. Not added to the public `PLAYERS` schema (matches `saves90`, which also isn't
publicly exposed — the schema's explicit allow-list keeps this feed-only, matching the "forgotten
scratch field is a loud bug, not a silent leak" architecture already documented in `sync.js`).

### 2. Expected defensive-contribution points (`lib/predictionModel.js`)

New function, structured like the existing `getExpectedSavePts` (a real per-90 rate converted to
expected points, position-gated, scaled by expected minutes) — **not** like the penalty-duty bonus.
This distinction matters: penalty duty is a discrete role flag mostly already reflected in an
established taker's `basePPG`, so it was deliberately dampened to avoid double-counting. Defensive
contribution is a continuous, minutes-varying real stat in the same structural category as GK saves
(an already-undampened precedent in this codebase) — not a role-change signal.

```js
// Real FPL thresholds (2025/26+): DEF need 10 combined clearances+blocks+interceptions+tackles in a
// match; MID/FWD need 12 combined (same + recoveries). Flat +2 pts, no partial credit for
// overshooting. Verified against Premier League's own 2025/26 rules announcement.
const DEFCON_THRESHOLD = { DEF: 10, MID: 12, FWD: 12 };

/**
 * Expected defensive-contribution points for a fixture, from a player's real season per-90 combined
 * defensive-actions rate. FPL only exposes a season-aggregate per-90 rate, not match-by-match logs,
 * so hitProb is a bucketed heuristic (ratio of real rate to the real threshold), not a fitted
 * distribution -- deliberately conservative around ratio=1.0 (see BASE_DC90's comment in sync.js:
 * only ~16%/6% of DEF/MID average at or above their own threshold across a full season, so sitting
 * exactly at it is already a strong outcome, not a coin flip).
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

Applied once per fixture in `computeGwPrediction`, additively as a new `breakdown.defconAdj`, gated
the same way as every other adjustment (`fixture.opp !== 'BYE'`):

- DEF branch: applied alongside the existing `csAdj`/`setPieceAdj` block.
- MID branch: applied alongside the existing `csAdj`/`xgiAdj`/`setPieceAdj` block.
- FWD branch: applied alongside the existing `xgiAdj` block (will naturally compute to a small value
  given real FWD rates average well under threshold — no special-casing needed, the formula already
  reflects that reality).
- GKP: excluded entirely (real FPL rule — GKP don't earn defensive-contribution points).

`computeGwPrediction`'s signature gains a `dcPer90` parameter (defaults safely to `0` /
"contributes nothing" if omitted, so every existing caller/test that doesn't pass it keeps working
unchanged, same backward-compatibility approach as `setPieceDuty`).

### 3. Fix the mislabeled badge (`sync.js`, `getPlayerRatings`)

Replace the `avgOdds`-based `defconPotential` computation with a real grade from `dcPer90` vs. the
real threshold, bucketed the same way `attackingPotential` already is from `xgi90` (existing
precedent a few lines above it in the same function):

```js
// 5. Defcon Potential (real defensive-contribution output: combined tackles/interceptions/
// clearances(+recoveries for MID/FWD) per 90, vs. the real FPL per-match threshold. N/A for FWD/GKP
// -- FWD real rates average well under threshold (4.50 vs. 12, see BASE_DC90's comment), so a
// graded badge for them would mostly just read "E" and add no useful signal; GKP don't earn the
// points at all.
let defconPotential = 'N/A';
if (pos === 'DEF' || pos === 'MID') {
    const threshold = pos === 'DEF' ? 10 : 12;
    const ratio = dcPer90 / threshold;
    if (ratio >= 1.4) defconPotential = 'A';
    else if (ratio >= 1.1) defconPotential = 'B';
    else if (ratio >= 0.9) defconPotential = 'C';
    else if (ratio >= 0.7) defconPotential = 'D';
    else defconPotential = 'E';
}
```

This changes scope slightly from the current behavior (currently computed for all non-FWD, i.e.
GKP/DEF/MID) — GKP moves from a graded odds-based badge to `N/A`, which is more correct (GKP
literally cannot earn these points under the real rule) but is a user-visible behavior change worth
calling out explicitly. `components/planner.js`'s existing "Best Defcon" badge logic
(`hasGoodDefcon`) already gates on `position === 'DEF' || position === 'MID'` only, so this doesn't
introduce any new inconsistency there — it removes one (GKP could previously get a graded badge that
the "Best Defcon" UI logic never surfaced anyway).

## Testing

- `getExpectedDefconPts`: unit tests in `test/predictionModel.test.js` covering: GKP always returns
  0 regardless of input; a DEF/MID/FWD player with `dcPer90` comfortably above their threshold gets
  the top `hitProb` tier; a player at/near their threshold gets the mid tier; a player well below
  gets the floor tier; `mppg` below 90 scales the result down proportionally; `dcPer90` of 0 (or
  missing) returns 0, not `NaN` or a negative value.
- `computeGwPrediction`'s new `defconAdj` term: covers DEF/MID/FWD each get position-correct
  threshold behavior; omitting `dcPer90` entirely doesn't throw and produces the same result as
  passing `0` (backward compatibility with existing tests that don't pass this new param).
- `sync.js`'s `dcPer90` regression: covered by extending the existing low-minutes-regression test
  pattern already used for `saves90`/`goalsConceded90`, if one exists — otherwise a light manual
  check (re-sync, spot-check a known low-minutes player's `dcPer90` sits between their raw rate and
  the position baseline).
- `getPlayerRatings`'s new `defconPotential` grading: unit/manual check that a known real defensive
  stalwart (e.g. a DM with a season-long high tackle+interception count) grades A/B, and a
  GKP/attack-minded FWD grades `N/A`/`E`.
- Manual verification: re-sync, confirm a known real defensive-contribution merchant (e.g. a
  ball-winning midfielder) shows a materially higher `defconAdj` than a similar-basePPG attacking
  midfielder with a low defensive rate; confirm the "Defcon Potential" badge now visibly diverges
  from fixture-ease-driven badges (e.g. a tough-fixture team's ball-playing CB with a low real tackle
  count should no longer auto-grade well just because their run of fixtures is easy).
