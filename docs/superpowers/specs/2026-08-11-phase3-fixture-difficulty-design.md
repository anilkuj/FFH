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
strength" for all 20 teams). There's no public documentation of when/whether FPL populates these
mid-season — not something this design can rely on a timeline for.

**Real fallback data confirmed available**: the same archived dataset already trusted for this
project's retro-backtest work (`vaastav/Fantasy-Premier-League` on GitHub) has last season's
(2025-26) `teams.csv` with fully-populated `strength_attack_home/away`/`strength_defence_home/away`
for every team that was in the Premier League last season (verified live: e.g. Arsenal
attack 1340/1390, defence 1270/1320 — a finer-grained Elo-style scale, not the 1-5 "overall"
scale). This gives a real, FPL-sourced prior for the start of a new season — the same pattern
`basePPG` already uses elsewhere in this model (lean on real last-season data until enough
current-season data accumulates) — for the majority of teams. It does **not** cover teams newly
promoted to the top flight this season (they won't appear in last season's Premier-League-only
file at all), so a further fallback is still needed for those.

(Explicitly considered and rejected: hardcoding third-party competitor sites' — Solio Analytics'
or Fantasy Football Scout's — own computed FDR/Clean-Sheet%/Projected-Goals output as a stopgap.
Rejected because it reproduces a paid tool's proprietary computed data wholesale, doesn't
self-correct or extend past whatever window was copied, and is exactly the anti-pattern that
caused `ticker.js`'s existing bug in the first place — see Problem #2 above.)

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
- Not waiting for `strength_attack_*`/`strength_defence_*` to populate before shipping — the
  3-tier fallback (section 1) means real attack/defence-specific data is usable immediately for
  most teams via last season's archive, with this season's live data taking over automatically
  once FPL populates it, no future code change needed either way.

## Design

### 1. Data acquisition (`sync.js`)

`teamsList` currently carries only `{id, name, shortName, color}` (built at `sync.js:154-173`).
Add `strengthOverallHome`/`strengthOverallAway` (from `t.strength_overall_home`/
`t.strength_overall_away`) to each team object directly — these are populated today, no fallback
needed.

**3-tier fallback for the granular `strengthAttack*`/`strengthDefence*` fields**, resolved once
per team when `teamsList` is built:
1. **This season's real value**, if FPL's `t.strength_attack_home` (etc.) is non-zero.
2. **Last season's real value for the same team**, matched by the team's stable `code` field
   (the same cross-season identifier already established for players in Phase 2 — team `code` is
   stable across seasons, unlike `id`), fetched once per sync from the archived 2025-26
   `vaastav/Fantasy-Premier-League` `teams.csv`. Only applies to teams that were actually in the
   Premier League last season.
3. **Not available** (explicit `null`, not `0` — a real zero would be silently wrong): for teams
   with neither tier 1 nor tier 2 (newly-promoted teams in their first top-flight season since
   this dataset started). Downstream formula code must treat `null` here as "use the
   overall-strength-only fallback for this side of the comparison," never coerce it to `0`.

Fetch the historical `teams.csv` with the same `AbortSignal.timeout(5000)` pattern already used
for other outbound fetches in `sync.js`, and treat a failed fetch as "tier 2 unavailable for every
team this sync" (falls through to tier 3), not a sync-aborting error.

When `fixturesSchedule` is constructed (`sync.js:184-207`), attach venue-matched strength values
directly onto each fixture object:
- `ownStrength`/`oppStrength`: overall strength in the venue each side is playing (`strengthOverallHome`
  if that side's `loc==='H'`, else `strengthOverallAway`) — unchanged from before, always available.
- `ownAttackStrength`/`oppDefenceStrength` (for the attacking/goals side) and
  `ownDefenceStrength`/`oppAttackStrength` (for the clean-sheet side): the venue-matched granular
  values from the 3-tier resolution above, or `null` if tier 3 (unavailable) applies to that team.

This keeps `diff` (FPL's official rating) completely untouched, and gives
`computeGwPrediction`/`getCleanSheetProb` everything needed for a continuous strength comparison
without new lookups at prediction time.

### 2. Formula change (`lib/predictionModel.js`)

Two *separate* signals, not one shared "difficulty" number — attacking output depends on my attack
vs. their defence; clean-sheet odds depend on my defence vs. their attack. Reusing a single
generic strength gap for both (as an earlier draft of this spec had it) would mean a team with a
great attack but leaky defence gets treated identically on both sides of the ball, which is wrong.

**Per-fixture, decide whether attack/defence-specific data is usable**: only when *both* sides of
the fixture have non-null attack/defence values for the relevant pairing (per section 1's 3-tier
resolution). If either side is `null` (tier 3), fall back to the plain overall-strength gap
(`fixture.oppStrength - fixture.ownStrength`) for that specific fixture — this is a fixture-level
decision (e.g. Arsenal vs. a newly-promoted team falls back for that one fixture, even though
Arsenal itself has real attack/defence data available for its other fixtures).

**`fdrMultiplier`** (attacking side, drives XP and the ticker's Projected Goals tab):
```
attackGap = fixture.oppDefenceStrength - fixture.ownAttackStrength   // positive = their defence stronger than my attack = harder to score
multiplier = clamp(1.0 - attackGap * K_ATTACK, 0.65, 1.30)
```

**`getCleanSheetProb`** (defensive side, drives clean-sheet XP and the ticker's Clean Sheet% tab):
```
defenceGap = fixture.oppAttackStrength - fixture.ownDefenceStrength   // positive = their attack stronger than my defence = lower CS odds
csBase = clamp(0.30 - defenceGap * K_DEFENCE, 0.02, 0.65)   // 0.30 matches today's diff===3 baseline
```

`K_ATTACK`/`K_DEFENCE` are separate scaling constants (tier-1/2 attack/defence values are on the
historical dataset's larger Elo-style scale, not the 1-5 "overall" scale, so they need their own
calibration) tuned during implementation to keep outputs in roughly the same conservative range
the existing code already targets (there's an existing comment about avoiding stacking with other
bonuses — preserve that philosophy).

**Drop the flat `homeAwayAdj` (±0.35)** whenever the strength-based path is used (either variant —
attack/defence-specific or the overall-strength fixture-level fallback). Since the strength values
feeding both are already venue-specific (a team's home rating is usually higher than its away
rating), home/away advantage is already partly baked in; keeping the flat term on top would
double-count it. **Only** the fully-defensive last-resort path (strength data missing/invalid
entirely, shouldn't happen given section 1's guarantees) falls back to the old diff-based step
function *and* the flat home/away term together, exactly as today.

Concretely verified the overall-strength gap produces a genuinely different read than the pure
`diff` field for at least one real fixture: Arsenal away at Aston Villa, GW2. FPL's official `diff`
says hard (4), but `strength_overall_away`(ARS)=5 > `strength_overall_home`(AVL)=3 says easy. This
disagreement between FPL's own two signals is exactly why this phase exists — the new formula is
*expected* to disagree with the old one here, and that's the point, not a bug.

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
  not hardcoded) adjusted by the same `fdrMultiplier`/`attackGap` logic from section 2 (own attack
  vs. opponent defence, falling back to the overall-strength gap per fixture exactly as section 2
  specifies). Remove `PROJ_GOALS_LOOKUP` entirely.
- **Difficulty (FDR) tab**: unchanged — still reads `f.diff` directly (FPL's official value).
- `getFixtureForGw`'s GW>10 fallback (lines 83-105): explicitly out of scope, left as-is (see
  Non-goals).

## Testing

- Unit tests for the 3-tier attack/defence resolution in `sync.js` (tier 1 non-zero passes through;
  tier 2 historical-dataset lookup by team `code`; tier 3 `null`, never `0`, for teams absent from
  both; historical fetch failure degrades to tier 3 for every team without aborting the sync).
- Unit tests for the attack-vs-defence formulas in `lib/predictionModel.js`: `fdrMultiplier`
  (attack vs. opponent defence) and `getCleanSheetProb` (defence vs. opponent attack) as separate
  functions/paths, plus the fixture-level fallback to the plain overall-strength gap when either
  side lacks attack/defence data, plus the fully-defensive last-resort path when strength data is
  missing/invalid entirely.
- Unit tests for the `goalsConceded90` league-average baseline computation and the nudge
  calculation (including the sample-size-blended input already being trusted, per section 3).
- Unit or integration tests for `ticker.js`'s Clean Sheet %/Projected Goals tabs now producing
  values consistent with the same underlying strength data the FDR tab uses (i.e. same sign of
  "easy vs hard" across all three tabs for a given fixture).
- Manual verification: re-check the Arsenal/Aston Villa GW2 case end-to-end once implemented,
  since it's the one concretely-verified example where the new formula is expected to disagree
  with the old diff-based one — confirm the disagreement is present and makes sense, not a bug.
  Also spot-check a fixture involving a newly-promoted team to confirm the tier-3/fixture-level
  fallback engages correctly rather than silently producing a zero-strength result.
- `npm run build` before considering this deploy-ready (per the Phase 1 incident precedent — this
  phase changes `data.js`'s team-object shape, so re-verify no export/shape assumptions break).
