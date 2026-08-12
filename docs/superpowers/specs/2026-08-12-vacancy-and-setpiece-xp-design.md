# Positional Vacancy Boost + Set-Piece Duty in Core XP — Design Spec

_Written 2026-08-12._

## Problem

Two related gaps in the xP model, both found via real player investigation this session:

**1. No "next man up" signal.** `computeStartProbability` (`lib/startProbability.js`) is a pure
per-player function — it only ever looks at *that player's own* history (recent starts, prior-season
rate, price/ownership). It has no visibility into a teammate's status. Real example: Cristhian
Mosquera (Arsenal DEF) has a real, data-driven `startProbability` of ~61% reflecting his historical
role as a squad/rotation player (9 starts last season behind Saliba/Gabriel). But William Saliba is
currently out with a long-term back injury (`status: 'i'`, confirmed in real synced data) — Mosquera
is now Arsenal's clear next-choice centre-back, and his real chance of starting is much higher than
his historical rate alone suggests. Nothing in the pipeline currently detects this.

**2. Set-piece duty has zero effect on core XP.** Confirmed via direct code search: `player.setPieceDuty`
(added this session, sourced from FPL's own live API) is read *only* inside
`components/optimizer.js`'s internal squad-ranking heuristic (and even there, gated behind a
"Prioritize Spot-Kick" toggle for two of its three uses). `lib/predictionModel.js` — the function
that actually produces every displayed XP number across the whole app (Squad Planner, OPTA Stats,
AI Optimizer's base projections) — has no reference to it at all. Designated penalty/corner/free-kick
takers get no credit for that duty in their core projected points anywhere a user actually looks.

## Goals

- Build a real, evidence-based "positional vacancy" signal: when a clear starter is ruled out via
  official status, boost the most likely direct replacement's `startProbability`.
- Wire `setPieceDuty` into `lib/predictionModel.js` so penalty/corner/free-kick duty affects every
  displayed XP number, not just the Optimizer's internal ranking.
- Avoid double-counting: a long-established taker's real scoring history (`basePPG`, ultimately
  derived from real `totalPoints`/appearances) already reflects whatever they've actually scored
  from penalties/set-pieces. Any new bonus must be modest enough to mostly serve *recently-assigned*
  takers whose history hasn't caught up yet, not stack fully on top of established ones.

## Non-goals

- Not attempting to model *which specific* teammate benefits with perfect accuracy when a position
  has several fit alternatives (e.g. a back four with 5 fit centre-backs). The tie-break rule below
  (next-highest existing `startProbability`) is a reasonable heuristic, not a claim of certainty.
- Not building a precise, data-derived corner/free-kick assist-value model. Real underlying data for
  "assists specifically attributable to being the designated set-piece taker" isn't available in
  this session — that piece uses a conservative, clearly-labeled estimate rather than a fully
  derived figure like the penalty-duty number below, and should be revisited if better data becomes
  available.

## Design

### 1. Positional vacancy boost

New pure function in `lib/startProbability.js`, matching the existing `detectDisplacementRisk`
pattern (same file, same "zero I/O, plain data in/out" style, called from `sync.js` in the same
per-sync pass, right after `detectDisplacementRisk`):

```js
const VACANCY_MIN_VACATED_RATE = 0.65; // the unavailable player must have been a real starter
const VACANCY_BOOST_FRACTION = 0.6;    // how much of the gap to the vacated player's rate to close
const VACANCY_BOOST_CEILING = 0.85;    // never boost a backup to a false "certain starter" level

export function detectPositionalVacancy(playersWithProbabilities) {
    // playersWithProbabilities: same shape as detectDisplacementRisk's input, plus two extra
    // fields per player: `officialStatus` (raw FPL status, not yet zeroed by unavailability) and
    // `historicalStartRate` (the recentWindow/priorSeasonRate-derived rate computed *before* the
    // officialStatus override -- i.e. what their startProbability would be if they were fit. This
    // is necessary because an injured player's own `startProbability` is already 0 by this point
    // in the pipeline -- their historical rate is the only remaining signal that they were a real
    // starter before the injury, not a squad player who was never playing anyway.)
    ...
}
```

Logic:
1. For each player currently unavailable (`officialStatus` is `'i'`/`'s'`/`'u'`) whose
   `historicalStartRate >= VACANCY_MIN_VACATED_RATE` (i.e. they were genuinely a starter, not
   already a fringe player) — this is a real vacancy.
2. Find same-team, same-position teammates who are themselves available (`officialStatus` not
   `'i'`/`'s'`/`'u'`) and have a valid `startProbability`.
3. Pick the single beneficiary: whoever already has the **highest existing `startProbability`**
   among those candidates (your confirmed tie-break — the most-used existing backup is the most
   likely direct replacement; this reuses a signal already computed, no new data needed).
4. Boost that beneficiary's `startProbability` toward (not equal to) the vacated player's own
   `historicalStartRate`, closing 60% of the gap, capped at 0.85 so a genuine squad player never
   gets displayed as an absolute certainty just because one specific competitor is out (there could
   always be a less-heralded third option, tactical change, etc. this signal can't see).
5. If multiple teammates are simultaneously out at the same position (rare, but possible), each
   vacancy is still evaluated independently — the beneficiary calculation re-runs per vacancy, so a
   player could theoretically benefit from more than one gap; this is intentional, not a bug, since
   it correctly reflects "two competitors are both out."

`sync.js` wiring: extend the object mapped into `detectDisplacementRisk`'s call (and reuse for a new
adjacent `detectPositionalVacancy` call) with the two extra fields noted above. Apply the result by
overwriting `p.startProbability` for any player who received a boost, same pattern as
`p.displacementRisk` is currently set from `displacementMap`.

### 2. Set-piece duty in core XP

New terms in `computeGwPrediction` (`lib/predictionModel.js`), applied in the same block as the
existing `xgiAdj` (MID/FWD attacking bonus), gated the same way (`fixture.opp !== 'BYE'`):

```js
// Real anchoring: ~100-110 penalties awarded across a 380-game PL season (~0.14/team/game),
// ~77% historical conversion rate -> ~0.108 expected goals/game purely from guaranteed penalty
// duty. Dampened to ~50% of full credit (same double-counting rationale as the Optimizer's
// set-piece bonus, see components/optimizer.js's PLAYER_ATTACK_MULTIPLIER-adjacent comments) --
// an established taker's real scoring history already reflects most of this; the dampened
// remainder mainly serves recently-assigned takers whose basePPG hasn't caught up yet.
const PENALTY_DUTY_BONUS = { FWD: 0.2, MID: 0.27, DEF: 0.3 };

// Corner/free-kick duty contributes via assists, not goals. Real data on assists specifically
// attributable to set-piece delivery wasn't available this session -- this is a conservative,
// low-confidence estimate (flat across positions, since FPL values every assist at 3 pts
// regardless of position), not a precisely derived figure like PENALTY_DUTY_BONUS above.
// Revisit if better data becomes available.
const SET_PIECE_ASSIST_BONUS = 0.06;
```

Applied once per fixture, additively (same style as `xgiAdj`), only for outfield positions
(`position !== 'GKP'`, matching `getPlayerSetPieceDuty`'s own existing GKP exclusion):

- `duty.pk` → `+ PENALTY_DUTY_BONUS[position]`
- `duty.fk || duty.ck` → `+ SET_PIECE_ASSIST_BONUS` (not additive between fk and ck — a player who
  takes both doesn't generate two independent extra assist channels, they're delivering from the
  same handful of set-piece situations either way)

`computeGwPrediction`'s signature gains a `setPieceDuty: {pk, fk, ck}` parameter (defaulting to
`{pk: false, fk: false, ck: false}` if omitted, so every existing caller/test that doesn't pass it
keeps working unchanged). `sync.js` passes `player.setPieceDuty` through at the call site.

## Testing

- `detectPositionalVacancy`: unit tests in `test/startProbability.test.js` (or wherever
  `detectDisplacementRisk`'s existing tests live), covering: a genuine vacancy correctly boosts the
  single highest-existing-probability teammate; a fringe player's injury (low `historicalStartRate`)
  does *not* trigger a vacancy; a player already at/above the boost ceiling doesn't get pushed
  further; two simultaneous vacancies at the same position each resolve independently; non-numeric
  `startProbability`/`historicalStartRate` inputs are excluded the same way
  `detectDisplacementRisk` already excludes them (no `null` arithmetic coercion bugs).
- `computeGwPrediction`'s new terms: unit tests in `test/predictionModel.test.js` covering: a `pk`
  duty player gets the position-correct bonus; a GKP with (hypothetically) `pk: true` gets no bonus
  (matches `getPlayerSetPieceDuty`'s own GKP exclusion); `fk` and `ck` both true doesn't double the
  assist bonus; omitting `setPieceDuty` entirely doesn't throw and produces the same result as
  passing all-false (backward compatibility with existing tests that don't pass this new param).
- Manual verification: re-sync, confirm Mosquera's `startProbability` rises meaningfully (not to
  100%) with the real Saliba injury in place; confirm a known real penalty taker's displayed 5-GW XP
  moves up modestly, not dramatically (the dampening working as intended, not fully closing any
  gap to a third-party site's numbers).
