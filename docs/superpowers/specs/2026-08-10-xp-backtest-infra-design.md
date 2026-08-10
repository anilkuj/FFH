# xP Model Backtest Infrastructure — Design

Date: 2026-08-10
Status: Approved, pending implementation plan

## Problem

The points-projection ("xP") model in `sync.js` / `app.js` / `components/optimizer.js` has no way to
measure its own accuracy. Its calibration constant (`XP_CALIBRATION_FACTOR` in
[app.js](../../../app.js), currently `0.90`) was hand-set and its own comment cites a different
number (`0.82`) than the code uses — direct evidence nobody has re-verified it against real
results. There is no logged history of "what did we predict" vs "what actually happened," and the
`actualPts` field currently written into `data.js` predictions ([sync.js:507-543](../../../sync.js))
is synthetic (derived from a `Math.sin()` pseudo-random seed), not real match data. Before any of
the model's static heuristics (FDR buckets, set-piece bonuses, rotation thresholds, etc.) can be
responsibly replaced with data-driven versions, there needs to be a way to measure whether a given
change actually improved accuracy.

This document scopes the measurement infrastructure only — not fixes to the model's heuristics
themselves (fixture-difficulty odds, team-strength ratings, set-piece detection, override-precedence
ordering). Those are follow-on phases that this infrastructure will validate.

## Goals

1. Extract the live prediction formula into a pure, reusable module so the same formula is used by
   the live app and by backtesting — no risk of testing a different formula than what's deployed.
2. Forward-track predictions vs. real results starting this season, GW by GW, persisted durably.
3. Retrospectively validate the current formula against last season's real results, using the model
   exactly as it would have run at the start of this season (static preseason baseline, no
   in-season relearning) — this is the "before" baseline that later phases get compared against.
4. Auto-apply a corrected global calibration factor once enough forward data exists, safely
   (clamped, audited).
5. A thorough test suite, including a simulated multi-gameweek harness, so the calibration-adjustment
   logic can be verified without waiting for real gameweeks to play out.

## Non-goals (explicitly out of scope for this phase)

- Replacing FDR buckets with odds-derived or Elo-derived team strength.
- Fixing the override precedence issue (official FPL status being overwritten by AI/hardcoded
  guesses).
- Set-piece duty detection from real event data.
- A results-visualization UI/dashboard in the app itself (deferred until there's real data to show).
- Per-segment (position/price-band) calibration factors — this phase auto-tunes one global factor;
  segment-level tuning is a natural fast-follow once the global version is proven out.

## Architecture

### 1. `lib/predictionModel.js` (new)

Pure-function extraction of the prediction formula currently inline in `parseAndWriteData` in
[sync.js](../../../sync.js) (roughly lines 341-490). Exports:

```js
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, fixture, chanceOfPlaying }) {
  // returns { pts, breakdown: { fdrAdj, homeAwayAdj, csAdj, xgiAdj, savesAdj } }
}
```

No `fetch`, no file I/O, no dependency on `window`/`PLAYERS` globals — takes plain data in, returns
plain data out. This is what makes it usable from both `sync.js` (live) and the retro backtest
script (last season) without duplicating logic.

`sync.js` is refactored to call this function instead of containing the formula inline. This is a
required refactor for this feature, not incidental cleanup — without a single shared
implementation, the live model and the backtest would silently drift into testing two different
formulas, making the whole exercise meaningless.

### 2. Forward tracking (sync.js + server.js)

On every 6-hourly sync run:

- **Snapshot predictions**: for the next *unplayed* gameweek, POST the full predicted-points list to
  `POST /api/backtest/predictions`. The server overwrites the stored snapshot for that GW on every
  call up until the GW is locked (see below) — so whatever was predicted right before deadline is
  what ends up being scored, without sync.js needing to know exactly when the deadline is.
- **Score completed gameweeks**: check the server for the latest *locked* GW. If a newer GW has
  fully finished (all its fixtures report `finished: true` in the FPL fixtures payload) and isn't
  locked yet, fetch real results with a single call to
  `https://fantasy.premierleague.com/api/event/{gw}/live/` (returns every player's actual stats for
  that GW in one request — not one call per player) and POST to `POST /api/backtest/actuals`. The
  server merges this with the stored prediction snapshot for that GW, computes deltas, marks the GW
  locked, and updates the running report aggregates.

### 3. Retrospective validation (`scripts/retro-backtest.js`, new)

Standalone, run manually (not part of the recurring sync). Pulls two seasons' worth of data from the
public `vaastav/Fantasy-Premier-League` GitHub dataset (free, static CSVs, no auth):

- Last-completed-season final aggregates (goals, assists, minutes, points/appearance) — used as the
  static `basePPG` input, exactly mirroring how the live model bootstraps a new season today.
- The season-before-that's real GW-by-GW results — the ground truth to compare against.

Feeds the aggregate into `predictionModel.js` once per fixture across that GW-by-GW season (applying
real fixture difficulty/home-away from that season's schedule) and compares against real results.
Deliberately does **not** re-derive `basePPG` progressively through the season — that would test a
hypothetical improved model, not the one actually deployed. This measures the current formula's real
error, which later phases will be judged against.

Output: `retro_backtest_report.json` written to `/data`, same shape as the forward-tracking report
(see below) so both can be viewed through the same `GET /api/backtest/report` endpoint via a
`?source=retro` query param.

### 4. `server.js` additions

New endpoints, backed by JSON file storage on the Railway persistent volume at `/data`
(`ffh-data`, already provisioned and mounted):

- `POST /api/backtest/predictions` — body `{ gw, capturedAt, players: [{ id, position, price, pts }] }`.
  No-ops if `gw` is already locked.
- `POST /api/backtest/actuals` — body `{ gw, players: [{ id, actualPts }] }`. Merges with the stored
  prediction snapshot, computes per-player delta, locks the GW, updates aggregates, runs the
  calibration auto-tune step (see below).
- `GET /api/backtest/report[?source=retro]` — returns aggregated MAE/RMSE broken out by GW, position,
  price band, and minutes bracket, plus the calibration audit trail.

**Existing-code fix bundled in**: `cloud_drafts_store.json`'s `STORAGE_FILE` currently falls back
between the app directory and `/tmp` ([server.js:11-17](../../../server.js)) because no persistent
volume existed — the exact problem this design just solved. Since `/data` now exists, both the
cloud-draft store and the new backtest log point at it, fixing an existing durability bug as a
direct side effect of this work.

### 5. Calibration auto-tune

Runs as part of `POST /api/backtest/actuals` handling, once ≥3 GWs are logged:

- Suggested factor is a ratio, not a fitted regression (deterministic and hand-computable, which the
  test plan below depends on):
  `suggestedFactor = currentCalibrationFactor * (sum(actualPts) / sum(predictedPts))` across every
  scored player-GW pair in the logged history (all GWs, not just the newest — so one-off noise
  averages out as more GWs accumulate).
- Applies it, but clamped: max **±0.03 change per update**, hard bounds **[0.6, 1.3]** — a single
  volatile gameweek (postponements, red cards, a flukey bonus-points week) can't swing the factor
  wildly.
- Every applied change is appended to an audit log: `{ timestamp, oldFactor, newFactor, gwsUsed,
  sampleSize }` — stored in the same report structure, satisfying "log calibration drift so
  degradation is visible, not silent."
- Below 3 GWs of data: report still computes MAE/RMSE, but no calibration change is applied.

## Data shapes

```jsonc
// /data/backtest_log.json
{
  "predictions": { "<gw>": { "capturedAt": "...", "locked": false, "players": [{ "id": 1, "position": "MID", "price": 8.5, "pts": 6.1 }] } },
  "actuals":     { "<gw>": { "recordedAt": "...", "players": [{ "id": 1, "actualPts": 5 }] } },
  "calibrationHistory": [ { "timestamp": "...", "oldFactor": 0.90, "newFactor": 0.93, "gwsUsed": [1,2,3], "sampleSize": 2100 } ],
  "currentCalibrationFactor": 0.93
}
```

## Error handling

- FPL `event/{gw}/live` call fails/times out → sync.js logs a warning, skips backtest logging for
  that run only. Never blocks the `data.js` refresh the rest of the app depends on.
- Backtest server endpoints unreachable (Railway mid-restart during a sync run) → same: caught,
  logged, retried next 6h cycle. Sync exits successfully regardless.
- Vaastav dataset unavailable or its CSV shape has changed → retro script fails loudly with a clear
  message. It's a standalone script; failure can't affect production.
- Partial/postponed GW (some fixtures finished, others not) → not treated as "finished" for locking
  purposes; sync.js waits until every fixture in that GW reports `finished: true`.

## Testing plan

This repo has no existing test setup (no `test` script in `package.json`). Using Node's built-in
`node:test` — zero new dependencies.

1. **`predictionModel.js` unit tests** — fixed inputs (position, base rate, fixture difficulty,
   home/away, xG/xA) → assert exact expected output and breakdown, covering every FDR bucket
   (including the diff-1/diff-3 edge cases identified in review) and both CS and xGI adjustment
   paths.
2. **Calibration auto-tune unit tests** (pure function, isolated from HTTP) — synthetic
   predicted/actual histories with a known correct regression answer computed by hand:
   - Below 3 GWs → factor unchanged.
   - Large sudden bias in one GW → change is clamped to ±0.03, not the full computed delta.
   - Factor pinned at its bound → further same-direction bias doesn't push it past [0.6, 1.3].
   - Every applied change produces a correctly-populated audit entry.
3. **GW simulation harness** (`scripts/simulate-backtest.js` or a test file driving the same logic) —
   generates N synthetic gameweeks across a synthetic player population spanning all
   position/price/minutes brackets, with a deliberately injected systematic bias (e.g. "actual runs
   8% below predicted"), and runs it through the full report + auto-calibration pipeline exactly as
   the server would:
   - MAE/RMSE aggregates match hand-computed expected values.
   - The calibration factor moves in the correct direction and converges toward correcting the
     injected bias over successive simulated GWs.
   - Missing/partial data in a simulated GW doesn't corrupt aggregates for other GWs.
4. **Backtest API endpoint tests** — `server.js` is plain `http`, no framework, so tests start it
   in-process on an ephemeral port, fire real requests via `fetch`, and tear down. Covers the
   predict → actual → lock → re-post-rejected flow end to end.
5. **Retro script** — tested against a small stubbed CSV fixture (not live network in CI) to validate
   parsing and the walk-forward-lite computation without depending on GitHub availability.

## Rollout

1. Railway persistent volume `ffh-data` at `/data` — already provisioned and mounted (done prior to
   this doc).
2. Implement `lib/predictionModel.js`, refactor `sync.js` to use it, add unit tests.
3. Implement `server.js` endpoints + `/data` storage (including the `cloud_drafts_store.json` fix),
   add endpoint tests.
4. Wire sync.js's forward-tracking calls, add calibration auto-tune + its unit tests + the
   simulation harness.
5. Implement `scripts/retro-backtest.js`, run it once manually to produce the first baseline report.
6. Deploy (redeploy activates the already-staged volume).
