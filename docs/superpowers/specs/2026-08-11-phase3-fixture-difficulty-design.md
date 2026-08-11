# Phase 3 — Fixture Difficulty from Real Team-Strength Data — Design Spec

_Written 2026-08-11._

## Problem

The xP model's fixture-difficulty handling has two related problems, both instances of the same
pattern the whole xP-model effort has been removing: static/hardcoded data standing in for a real
signal that's already available.

1. **The core prediction formula** (`lib/predictionModel.js`) derives its fixture-difficulty
   adjustment from FPL's official `diff` value (1-5) via a blunt step function
   (`fdrMultiplier`: 1.12 for diff=2, 0.88 for diff=4, 0.70 for diff=5 — with a known gap where
   `diff===1` gets no bonus at all). `getCleanSheetProb` has the same kind of step function.
   FPL's own API separately returns `teams[].strength_*` fields — real, continuous team-strength
   data — that are fetched by `sync.js` but never used.

2. **The Fixture Difficulty Ticker widget** (`components/ticker.js`) has two lookup tables,
   `CS_ODDS_LOOKUP` and `PROJ_GOALS_LOOKUP`, explicitly commented `"Exact ... lookup from FFS
   ticker screenshots for GW1-5"` — hand-copied numbers from a competitor site, completely
   disconnected from our own model. This is why the ticker's "Clean Sheet %" and "Projected Goals"
   tabs can visually disagree with the (correct) "Difficulty (FDR)" tab sitting right next to them
   in the same widget — a real, user-visible inconsistency discovered while investigating an
   unrelated user question.

## Real data constraint (discovered during brainstorming, drives several decisions below)

Checked FPL's live `bootstrap-static` API directly for all 20 teams. `strength_overall_home` and
`strength_overall_away` are populated with real, varying values (2-5 range) for every team right
now. **But `strength_attack_home/away` and `strength_defence_home/away` are `0` for every single
team** — FPL hasn't populated those granular splits yet this early in the season. Any design that
assumes those sub-fields are usable today would silently produce nonsense (a constant 0 "attack
strength" for all 20 teams).

## Goals

- Replace the diff-based step functions inside the actual XP calculation with a continuous
  value derived from real team-strength data.
- Fold `goalsConceded90` (already computed per-player, currently unused) into the clean-sheet
  model as a per-player differentiator.
- Fix `ticker.js`'s two hardcoded lookup tables so all three ticker tabs are internally
  consistent with the real model and with each other.
- Keep FPL's official `diff` (1-5) unchanged for all UI display — colors, badges, ticker "FDR"
  labels stay exactly as users see them today and on FPL's own site.

## Non-goals

- Not touching `diff` itself, or anything that reads it for display purposes.
- Not building a full team-level attacking model beyond what's needed for the ticker's
  "Projected Goals" tab.
- Not fixing `ticker.js`'s `getFixtureForGw` fallback (lines 83-105) — a hardcoded team-name-based
  synthetic fixture generator for gameweeks beyond `TICKER_DATA`'s coverage. Since FPL publishes
  the full 38-GW fixture list in advance and `TICKER_DATA` is built from that real data for all 38
  gameweeks, this fallback should rarely or never actually trigger in practice. Explicitly out of
  scope for this phase (confirmed with user).
- Not waiting for `strength_attack_*`/`strength_defence_*` to populate before shipping — building
  on `strength_overall_home/away` now, with a guard so the granular split activates automatically
  once FPL fills it in later this season.

## Design

### 1. Data acquisition (`sync.js`)

`teamsList` currently carries only `{id, name, shortName, color}` (built at `sync.js:154-173`).
Add `strengthOverallHome`/`strengthOverallAway` (from `t.strength_overall_home`/
`t.strength_overall_away`) to each team object, plus `strengthAttackHome`/`strengthAttackAway`/
`strengthDefenceHome`/`strengthDefenceAway` (from the corresponding FPL fields) for forward
compatibility — even though these are all `0` today, threading them through now means no future
code change is needed once FPL populates them.

When `fixturesSchedule` is constructed (`sync.js:184-207`), attach venue-matched strength values
directly onto each fixture object:
- `ownStrength`: this team's overall strength in the venue they're playing (`strengthOverallHome`
  if `loc==='H'`, else `strengthOverallAway`)
- `oppStrength`: the opponent's overall strength in the venue *they're* playing (the mirror image)
- `ownAttackStrength`/`oppDefenceStrength` (and the reverse pairing): same pattern for the granular
  fields, for later use once populated. Guarded as "unknown" (not zero) when the underlying FPL
  field is `0`, so downstream code can distinguish "genuinely weak" from "not yet available" and
  fall back to the overall-strength-only calculation.

This keeps `diff` (FPL's official rating) completely untouched, and gives
`computeGwPrediction`/`getCleanSheetProb` everything needed for a continuous strength comparison
without new lookups at prediction time.

### 2. Formula change (`lib/predictionModel.js`)

**`fdrMultiplier`**: replace the step function with a continuous value derived from
`fixture.oppStrength - fixture.ownStrength` (both venue-matched per section 1):

```
strengthGap = fixture.oppStrength - fixture.ownStrength   // positive = harder fixture
multiplier = clamp(1.0 - strengthGap * K, 0.65, 1.30)
```

`K` is a scaling constant tuned during implementation to keep the multiplier in roughly the same
conservative range the existing code already targets (there's an existing comment about avoiding
stacking with other bonuses — preserve that philosophy). Real observed strength values span
roughly 2-5, so `K` should be chosen such that the maximum realistic gap (~3) maps close to the
clamp bounds without needing to hit them constantly.

**Drop the flat `homeAwayAdj` (±0.35)** when strength data is available. `ownStrength`/
`oppStrength` are already venue-specific (a team's home strength is usually rated higher than its
away strength), so home/away advantage is already partly baked into the strength comparison.
Keeping the flat term on top would double-count it. **Fallback**: if `fixture.ownStrength`/
`oppStrength` are missing or invalid (defensive case — shouldn't happen given section 1, but keep
the guard), fall back to the old diff-based step function *and* the flat home/away term together,
exactly as today.

Concretely verified this produces a genuinely different read than the pure `diff` field for at
least one real fixture: Arsenal away at Aston Villa, GW2. FPL's official `diff` says hard (4), but
`strength_overall_away`(ARS)=5 > `strength_overall_home`(AVL)=3 says easy. This disagreement
between FPL's own two signals is exactly why this phase exists — the new formula is *expected* to
disagree with the old one here, and that's the point, not a bug.

**`getCleanSheetProb`**: gets the same treatment, for consistency — if only `fdrMultiplier` moved
to strength-based data and `getCleanSheetProb` stayed diff-based, the attacking-points multiplier
and the clean-sheet probability could disagree about the same fixture's difficulty, reintroducing
the exact inconsistency this phase removes. Same continuous strength-gap formula, own clamp bounds
appropriate to a probability (currently clamped to `[0.02, 0.65]` — keep that overall range, just
change how the pre-home/away-adjustment base value is derived).

### 3. Folding `goalsConceded90` into the clean-sheet model

Clean sheets are a team-level event — every eligible player on a team gets the same CS bonus if
the team achieves it for that fixture. This isn't about giving teammates different clean-sheet
*probability* for the same match; it's about recognizing a player's own underlying defensive
record can differ from their team's fixture-implied baseline (e.g. a fringe defender with a worse
individual record than the regular starters).

Compute a league-wide average `goalsConceded90` dynamically each sync (across GKP/DEF with
meaningful minutes — reuse whatever minutes threshold the existing per-player `goalsConceded90`
blending already uses, don't hardcode a new one). Then, for each player:

```
delta = leagueAvgGoalsConceded90 - player.goalsConceded90   // positive = player concedes less than average = good
nudge = clamp(delta * NUDGE_SCALE, -MAX_NUDGE, MAX_NUDGE)
```

`NUDGE_SCALE`/`MAX_NUDGE` are tuning constants chosen during implementation (same approach as `K`
in section 2) — `MAX_NUDGE` should be small relative to the fixture-based `csAdj` magnitude (which
is `(csProb - avgCsProb) * 4`, typically well under ±1 point) so this differentiates teammates
without overriding the team-level signal. Applied only to GKP/DEF/MID (the positions that already
receive `csAdj`), added directly to `breakdown.csAdj`'s contribution to `pts`.

### 4. `ticker.js` — replacing the hardcoded tables

- **Clean Sheet % tab**: call the real (now strength-based) `getCleanSheetProb` per team/fixture
  directly. Remove `CS_ODDS_LOOKUP` entirely.
- **Projected Goals tab**: no existing team-level "expected goals" model exists to reuse. Add a
  small one: a league-average goals-per-game baseline (computed dynamically from real season data,
  not hardcoded) adjusted by the same strength-gap multiplier from section 2. Remove
  `PROJ_GOALS_LOOKUP` entirely.
- **Difficulty (FDR) tab**: unchanged — still reads `f.diff` directly (FPL's official value).
- `getFixtureForGw`'s GW>10 fallback (lines 83-105): explicitly out of scope, left as-is (see
  Non-goals).

## Testing

- Unit tests for the new continuous strength-gap formula in `lib/predictionModel.js` (multiplier
  and clean-sheet-probability variants), including the fallback path when strength data is
  missing/invalid.
- Unit tests for the `goalsConceded90` league-average baseline computation and the nudge
  calculation (including the sample-size-blended input already being trusted, per section 3).
- Unit or integration tests for `ticker.js`'s Clean Sheet %/Projected Goals tabs now producing
  values consistent with the same underlying strength data the FDR tab uses (i.e. same sign of
  "easy vs hard" across all three tabs for a given fixture).
- Manual verification: re-check the Arsenal/Aston Villa GW2 case end-to-end once implemented,
  since it's the one concretely-verified example where the new formula is expected to disagree
  with the old diff-based one — confirm the disagreement is present and makes sense, not a bug.
- `npm run build` before considering this deploy-ready (per the Phase 1 incident precedent — this
  phase changes `data.js`'s team-object shape, so re-verify no export/shape assumptions break).
