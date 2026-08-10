# xP Model Improvement — Status & Roadmap

_Last updated: 2026-08-10_

## Phase 1 — Backtest Infrastructure: ✅ Complete (not yet deployed)

Built on branch `feature/xp-backtest-infra` (13 planned tasks + 1 critical fix found in final
review, 20 commits, all individually TDD'd and independently reviewed for spec compliance and
code quality).

**What it does:**
- Extracted the xP formula into a single shared module (`lib/predictionModel.js`) used by both the
  live app and the backtest tooling — no more duplicate copies drifting apart.
- Every 6-hour sync now snapshots predictions and scores real results against them
  (`lib/backtestStore.js`, new `/api/backtest/*` endpoints on `server.js`, persisted on a Railway
  volume).
- A global calibration factor auto-tunes from that real predicted-vs-actual data (replacing the old
  hand-set, never-verified `0.90` constant), clamped and audited so it can't overreact to one noisy
  gameweek.
- A retrospective validation script (`scripts/retro-backtest.js`) tests the current formula against
  **real results from last season** (2025/26), pulled from the public `vaastav/Fantasy-Premier-League`
  dataset.

**Critical bug found and fixed during final review:** the calibration formula as originally written
had no stable equilibrium — fed the model's real (raw) predictions, it would have silently walked
the factor to a hard floor and stayed there, a *worse* outcome than the static constant this whole
effort was meant to replace. Caught before deploy, fixed, re-verified by independent re-derivation
of the math, not just re-running tests.

**Real results so far (last season, 29,747 real player-gameweeks):**
- Overall: MAE 2.83 / RMSE 3.24
- **Worst error source by far: minutes/availability, not the scoring math.** 61% of all
  player-gameweeks were 0-minute outcomes (didn't play), and that bucket has *higher* error than the
  played-60+-minutes bucket.
- Error increases with price — worst at ≥£10.0m (MAE 4.15), best under £5.0m (MAE 2.70).
- Worst by position: GKP (3.48). Best: DEF (2.44).
- Season-total sanity check: a strong static squad (no transfers/chips modeled) projects to ~2,625
  pts for a full season — close to last season's actual winner (2,582 pts), which is the most
  relevant comparison point since it reflects current scoring rules.

**Still pending before Phase 2 can start:**
1. Merge/push the branch (holding for explicit go-ahead — this touches the live CI/CD pipeline).
2. Deploy `server.js`'s new endpoints to the production Railway service.
3. Re-run `scripts/retro-backtest.js` once deployed, so the real report gets durably stored (the run
   during development hit production before the new routes existed, so nothing persisted).
4. Let a few real 2026/27 gameweeks accumulate so forward-tracking has live data, not just the retro
   baseline.

---

## What Phase 1 revealed → data-driven priority order for what's next

Before Phase 1, the priority order for fixing the model's static-calibration problems was a
judgment call. Now there's real evidence:

### Phase 2 — Rotation & availability modeling (highest priority, confirmed by data)
The single biggest error source, by a wide margin. Replace:
- Hardcoded `ROLE_OVERRIDES`/`KNOWN_TRANSFERS` name tables → a rolling real-minutes-based start
  probability, refreshed every sync.
- The current override precedence bug (official live FPL status can be silently overwritten by
  AI-guessed or hardcoded status) → official live data should always win.
- Hardcoded promoted-team/new-signing lists → a generic "low games-played" rule.

### Phase 3 — Fixture difficulty from real data already being fetched
- Replace the static FDR step function (1.12/0.88/0.70, with a known gap where difficulty=1 gets
  no bonus at all) with the `teams[].strength_*` fields FPL's own API already returns — currently
  fetched and unused.
- Fold in `goalsConceded90` (already computed per-player, currently unused) into the clean-sheet
  model.
- Directly relevant to why premium players are currently the weakest price band — worth checking
  whether it's fixture-modeling error specifically, not just variance, once this lands.

### Phase 4 — Set-piece duty from real event data
- Replace hardcoded penalty/free-kick/corner-taker name lists with FPL's own
  `penalties_order`/`corners_and_indirect_freekicks_order` fields (verify still present in the
  current API payload).
- Separate open-play vs. set-piece xG/xA so set-piece bonuses don't double-count.

### Phase 5 — Odds-derived fixture modeling (optional, only if still justified)
- Bigger lift, requires a paid odds API. Only pursue if Phase 3's backtest results show fixture
  modeling is still the dominant error source after the free FPL-API-data fix — don't build this on
  a guess when it can be built on evidence instead.

---

## One-line status
**Phase 1: done, reviewed, verified against real historical data, awaiting deploy go-ahead.**
**Phase 2 (rotation/availability): not started — now the clearly evidence-backed next priority.**
