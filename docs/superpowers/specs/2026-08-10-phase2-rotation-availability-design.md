# Phase 2 — Rotation & Availability Modeling — Design

Date: 2026-08-10
Status: Approved, pending implementation plan

## Problem

Phase 1's real backtest data (MAE 2.83/RMSE 3.24 across 29,747 real player-gameweeks) showed the
dominant error source isn't the scoring formula — it's minutes prediction. 61% of all
player-gameweeks were 0-minute outcomes, and that bucket has *higher* error than the
played-60+-minutes bucket. Today's minutes/rotation signal is driven by hardcoded, manually
maintained name tables (`ROLE_OVERRIDES`, `KNOWN_TRANSFERS`, `PROMOTED_TEAMS`) that go stale
immediately and require constant hand-editing, plus a background Gemini AI call whose guesses are
allowed to silently override FPL's own official live status — backwards precedence that risks a
wrong AI guess clobbering correct official data.

This phase replaces all of that with a rolling, real-data-driven start-probability model, fixes the
override precedence, and surfaces two new player-level signals (low data confidence, positional
displacement risk) through the existing "Check Risks" feature.

## Goals

1. Compute a per-player `startProbability` (0–1) from real minutes/starts history, weighted toward
   recent games, refreshed once per real completed gameweek (not every 6-hour sync — playing time
   only changes when a match happens).
2. Official FPL live status (`status`/`chance_of_playing_next_round`) always wins over any other
   signal when present — fixes the current backwards precedence.
3. Remove `sync.js`'s automatic Gemini call, `ROLE_OVERRIDES`, `KNOWN_TRANSFERS`, and the
   `PROMOTED_TEAMS`-gated zero-minutes bypass — replace with generic, data-derived rules.
4. Detect new-to-team players and positional displacement risk generically (no hardcoded names),
   using the same rolling history.
5. Surface `dataConfidence` (low/medium/high) and displacement risk through the existing
   client-side "Check Risks" feature (`components/planner.js`), without touching its existing
   optional Gemini-powered analysis — additive, not a replacement.

## Non-goals

- The client-side, user-initiated "Check Risks" Gemini call (with user-supplied API key) is
  explicitly kept as-is. It's opt-in, has a working local fallback already, and isn't the
  precedence-inversion problem this phase fixes (that problem is specific to `sync.js`'s
  *automatic*, unconditional background Gemini call).
- Odds-based or Elo-style team-strength modeling (Phase 3).
- Set-piece duty detection (Phase 4).
- Perfect same-day reaction to a brand-new tactical benching — a rolling window inherently lags by
  a game or two behind a real-time news feed for *fit-but-dropped* players (injury/suspension is
  still caught immediately via official status, which isn't windowed).

## Architecture

### 1. `lib/rotationHistory.js` (new) — pure rolling-snapshot state machine

Same shape as Phase 1's `lib/backtestStore.js`: pure functions, no I/O, server.js does persistence.

```js
export function createEmptyHistory() { /* { players: {} } */ }

export function recordGwSnapshot(history, { gw, players }) {
  // players: [{ code, team, position, minutesThisGw, startedThisGw }]
  // No-op if this gw's snapshot already recorded for a given player (idempotent re-POST safe,
  // same "locking" principle as backtestStore.js's GW-scoring, keyed per-player not per-GW-global
  // since a player's own history is independent of another's).
}

export function getPlayerHistory(history, code) {
  // Returns { snapshots: [...], currentTeam, currentPosition } or null if never seen.
}
```

Snapshot list per player is capped at the last **10** gameweeks (rolling window is 6, but keeping a
few extra makes future window-size tuning possible without losing data — cheap to store, avoids a
second migration later). Each snapshot records the team the player was actually at for that
gameweek, so the recent-window calculation (`getRecentWindow`, below) can filter to only games at
the player's *current* team by simple equality check (`snapshot.team === currentTeam`) — no separate
"team changed at GW X" bookkeeping needed.

**Correction made during planning (catching this now rather than mid-implementation):** the
original draft of this section planned to detect team changes by diffing each new snapshot against
the previous one. That has a cold-start gap — on the very first sync after this phase deploys,
there's no prior snapshot to diff against, so it would fail to recognize *any* of this transfer
window's signings as new, including the ones that matter most right now. Fixed by using
`team_join_date`, a field already confirmed present in `bootstrap-static` (verified live before
writing this doc) that FPL maintains directly and is available immediately, with no bootstrapping
period. `isNewToCurrentTeam` is computed in `sync.js` as `daysSinceJoin <= 75` (roughly one transfer
window), independent of `lib/rotationHistory.js` entirely. This also directly replaces
`KNOWN_TRANSFERS`' other job (detecting `transferredThisSeason`) with the same generic, always-available
signal — one less thing `lib/rotationHistory.js` needs to track, and it now has a single job: recent
minutes/starts windowing.

```js
export function getRecentWindow(history, code, { asOfGw, windowSize = 6 }) {
  const p = getPlayerHistory(history, code);
  if (!p) return { starts: 0, games: 0 };
  const relevant = p.snapshots.filter(s =>
    s.team === p.currentTeam && s.gw <= asOfGw && s.gw > asOfGw - windowSize
  );
  return { games: relevant.length, starts: relevant.filter(s => s.started).length };
}
```

### 2. `lib/startProbability.js` (new) — the actual algorithm

Pure function, one player at a time:

```js
export function computeStartProbability({
  officialStatus,        // 'a'|'d'|'i'|'s'|'u'
  officialChanceOfPlaying, // 0-100 or null
  recentWindow,           // { starts: number, games: number } -- games played AT CURRENT TEAM, last 6 GWs
  priorSeasonRate,        // 0-1 or null -- starts/appearances from last season, if this player existed then
  price,
  ownership,
  position                // 'GKP'|'DEF'|'MID'|'FWD' -- only used by branch 5's price threshold
}) {
  // 1. Official status is authoritative and short-circuits everything else.
  if (officialStatus === 'i' || officialStatus === 's' || officialChanceOfPlaying === 0) {
    return { startProbability: 0, dataConfidence: 'high', source: 'official-unavailable' };
  }

  const officialFactor = (officialChanceOfPlaying !== null && officialChanceOfPlaying !== undefined)
    ? officialChanceOfPlaying / 100
    : 1.0;

  // 2. Enough current-team recent data (>= 3 of the last 6 GWs) -> trust it directly.
  if (recentWindow.games >= 3) {
    const rate = recentWindow.starts / recentWindow.games;
    return { startProbability: rate * officialFactor, dataConfidence: 'high', source: 'recent-window' };
  }

  // 3. Some current-team data, not enough for full confidence -> blend with prior season,
  //    weighted by how many real current-team data points exist.
  if (recentWindow.games > 0 && priorSeasonRate !== null) {
    const weight = recentWindow.games / 3;
    const recentRate = recentWindow.starts / recentWindow.games;
    const blended = (weight * recentRate) + ((1 - weight) * priorSeasonRate);
    return { startProbability: blended * officialFactor, dataConfidence: 'medium', source: 'blended' };
  }

  // 4. No current-team data at all, but has prior-season history (returning player, domestic
  //    transfer with EPL history elsewhere) -> use prior season's rate as-is.
  if (recentWindow.games === 0 && priorSeasonRate !== null) {
    return { startProbability: priorSeasonRate * officialFactor, dataConfidence: 'medium', source: 'prior-season' };
  }

  // 5. Genuinely no history anywhere (new to the EPL entirely) -> generic price/ownership prior.
  //    Mirrors sync.js's existing (already generic, name-free) isExpectedStarter heuristic,
  //    including its position-differentiated price threshold (GKP/DEF are cheaper positions --
  //    a nailed-on GKP/DEF starter is priced lower than a nailed-on MID/FWD starter).
  const priceThreshold = (position === 'GKP' || position === 'DEF') ? 4.5 : 5.5;
  const genericPrior = (ownership > 1.5 || price >= priceThreshold) ? 0.75 : 0.3;
  return { startProbability: genericPrior * officialFactor, dataConfidence: 'low', source: 'generic-prior' };
}
```

`recentWindow.games` counts only finished GWs at the player's *current* team (via `getRecentWindow`'s
team-equality filter above) — so a domestic transfer's window resets to 0 the moment they change clubs, correctly
routing them through branch 4 (prior-season rate as-is, since zero games exist yet at the new club)
immediately after the move, then into branch 3's blend once a game or two is actually played there,
rather than branch 2 (which would wrongly assume a full trusted current-team window).

### 3. Positional displacement detection — folds into the same module

```js
export function detectDisplacementRisk(playersWithProbabilities) {
  // playersWithProbabilities: [{ code, name, team, position, startProbability, isNewToCurrentTeam }]
  // isNewToCurrentTeam is computed by sync.js from bootstrap-static's team_join_date (see the
  // sync.js changes section below) and passed in here -- this function itself has no notion of
  // "recent," it just consumes the flag.
  // For each player P (not itself new): find teammates Q where Q.team === P.team,
  // Q.position === P.position, Q.isNewToCurrentTeam === true, and
  // Q.startProbability - P.startProbability > DISPLACEMENT_GAP_THRESHOLD (0.15). If multiple
  // teammates qualify, P is flagged with whichever has the largest gap.
  // Returns a map: { [P.code]: { threatenedByCode, threatenedByName, gap } }
}
```

`0.15` is a starting threshold — unlike the core xP formula, there's no historical backtest to
calibrate this against yet (it's a new signal). Documented as a named constant, tunable later once
real gameweeks show whether it over- or under-fires.

### 4. `sync.js` changes

- Remove `fetchAIPleayerNews()` and its call site entirely, along with the `GEMINI_API_KEY` env var
  usage in `sync.js` specifically (the workflow secret itself can stay — `components/planner.js`'s
  *client-side* Check Risks feature uses a *user-supplied* key from `localStorage`, a completely
  separate credential, unaffected by this removal).
- Remove `ROLE_OVERRIDES`, `KNOWN_TRANSFERS`, and the `PROMOTED_TEAMS`-gated branch in the
  zero-minutes fallback. `computeBasePPG`'s `isPromotedOrTransfer` input becomes simply
  `minutes === 0` (season-cumulative, club-agnostic, already exactly what's needed for the
  *productivity* baseline — a domestic transfer with real minutes at their old club already flows
  correctly through `computeBasePPG`'s existing `minutes > 500`/`minutes > 0` branches without any
  new logic, since those stats accumulate on the player regardless of which club earned them).
  Separately, compute `isNewToCurrentTeam = daysSinceJoin(el.team_join_date) <= 75` per player —
  this is the *availability* signal (feeds `computeStartProbability`'s window-reset and
  `detectDisplacementRisk`), answering a different question than `isPromotedOrTransfer` and
  computed independently.
- Each sync: after determining `getLatestFinishedGw` (already computed today for backtest scoring —
  reused, not duplicated), if that GW hasn't been recorded in rotation history yet, fetch its
  per-player stats via the same `event/{gw}/live/` call already made for backtest actuals (one
  extra field read: `e.stats.starts`, verify present against the real payload once the first GW
  completes — see Testing), and call `recordGwSnapshot`.
- Compute `startProbability`/`dataConfidence`/`displacementRisk` per player, bake into each player
  object written to `data.js` (new fields, additive — doesn't change the existing `predictions`
  array shape).

### 5. `app.js` changes

`getPlayerMinutesFactor` currently derives its own matchMinutesRatio/startRatio from
`player.MPPG`/`player.GS` with its own separate bypass rules. Replace its body with a direct read of
`player.startProbability` (now computed once, server-side, consistently) — removes a second,
independently-drifting copy of "how likely is this player to play" logic.

### 6. `components/planner.js` — Check Risks enhancement

`runPlannerSquadRiskCheck`'s local fallback becomes a **local pass that always runs**, not just when
no Gemini key is set. New risk entries populate `state.squadRisks` from `player.displacementRisk`/
`player.dataConfidence`:

- Displacement: `{ risk: 'Medium'|'High' (based on gap size), reason: "At risk of losing his place to {threatenedByName}", details: "{threatenedByName} joined {gw} gameweeks ago and has a higher start probability ({X}% vs {Y}%)." }`
- Low confidence: a visually distinct badge (not on the High/Medium/Low risk color scale — this
  isn't "might not start," it's "trust this projection less"), e.g. a small "Limited Data" tag with
  tooltip explaining why (new signing / returning from long absence / etc.)

If a Gemini key **is** set, its results are layered on top of (not replaced by) the local
data-driven pass — Gemini's per-player entries take precedence for players it covers (richer,
news-grounded text), the local pass fills in anything Gemini's response didn't address, and the
displacement/low-confidence checks always run regardless of Gemini's availability since they're not
things an LLM prompt is well-suited to computing precisely. The Gemini prompt itself also gets two
new bullet points added to its risk-category list (new-signing uncertainty, positional competition
from a new arrival) so a Gemini-covered player benefits from awareness of these categories too.

## Data shape additions (baked into each player object in `data.js`)

```jsonc
{
  "startProbability": 0.83,
  "dataConfidence": "high",       // "low" | "medium" | "high"
  "isNewToCurrentTeam": false,
  "displacementRisk": null        // or { "threatenedByCode": 12345, "threatenedByName": "...", "gap": 0.22 }
}
```

## Server storage

New file on the same `/data` Railway volume: `rotation_history.json`, following the exact same
load/save/write-fallback pattern already built for `backtest_log.json` in Phase 1 (`server.js`).
New endpoints: `POST /api/rotation/snapshot` (sync.js calls this once per newly-finished GW),
`GET /api/rotation/history?code=<playerCode>` (mainly for debugging/inspection, not required by the
live app itself since the computed fields are baked into `data.js`).

## Testing plan

Same approach as Phase 1: pure functions in `lib/`, unit-tested in isolation with `node:test`.

1. **`lib/rotationHistory.js`** — snapshot recording, idempotency (re-recording the same GW is a
   no-op), team-change detection, window capping at 10 entries.
2. **`lib/startProbability.js`** — one test per branch of the algorithm (official-unavailable
   short-circuit, full recent window, blended, prior-season-only, generic-prior), plus the
   domestic-transfer scenario explicitly (recent window resets to 0 at new team even though prior
   history exists) and the new-signing-from-abroad scenario (no prior season, no recent window ->
   generic prior).
3. **Displacement detection** — a constructed scenario proving it fires (established player +
   newly-arrived higher-probability teammate, same team/position) and doesn't false-positive on
   normal squad depth (two long-tenured players at the same position, neither "new").
4. **`components/planner.js`** — not currently under `node:test` coverage (browser UI code, same as
   the rest of `app.js`/`components/*`); verified manually via the browser, same as Phase 1's
   approach to `app.js`.

## Rollout / verification notes

- No gameweeks have been played yet this season, so `recentWindow` will be empty for everyone at
  first sync post-deploy — expected, falls through to branches 3/4/5 until real GW data accumulates.
- The `event/{gw}/live/` payload's `starts` field needs a real-payload confirmation once the first
  GW actually finishes (evidence from the `vaastav` dataset's `merged_gw.csv`, which is built from
  this same endpoint, strongly suggests it's present — same verify-before-trusting discipline as
  Phase 1's CSV schema check, not a blocking unknown, just something to confirm rather than assume).
- **Lesson carried forward from the Phase 1 deploy incident**: any new field added to `data.js` that
  another file imports by name must be checked against a real `npm run build` (Vite/Rollup does
  static export validation — a named import of a not-yet-present export is a hard build error, not
  a runtime-catchable one). None of this phase's new fields are consumed via named imports from
  `data.js` (they're properties on player objects already imported via `PLAYERS`), so this specific
  failure mode doesn't apply here — but the implementation task must still run a real `npm run
  build` as part of verification, not just `npm test`, given what happened last time.
