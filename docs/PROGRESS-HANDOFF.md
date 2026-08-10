# Progress Handoff — xP Model Improvement Effort

_Written 2026-08-10 to allow clean resumption after a usage-limit break._

## Big picture

Two-phase effort to fix an FPL app's points-projection model, which a deep review found relied on
hardcoded, never-verified calibration and rotation heuristics instead of real data.

- **Phase 1 (backtest infrastructure): ✅ DONE, MERGED, DEPLOYED, LIVE.**
  Merged to `main` via PR #1, hotfixed once post-merge (a Vite build break — see below), confirmed
  live on production (`https://ffh-production.up.railway.app`). Real accuracy baseline recorded:
  MAE 2.83 / RMSE 3.24 across 29,747 real player-gameweeks from last season, durably stored and
  fetchable at `GET /api/backtest/report?source=retro`. Full writeup: `docs/xp-model-roadmap.md`.

- **Phase 2 (rotation/availability modeling): 🔄 IN PROGRESS.**
  This is what's mid-flight right now. Details below.

## Phase 2 — exact current state

**Branch:** `feature/phase2-rotation-availability`
**Worktree:** `.worktrees/phase2-rotation-availability` (already set up, `npm install` done)
**Plan:** `docs/superpowers/plans/2026-08-10-phase2-rotation-availability.md` (9 tasks)
**Design spec:** `docs/superpowers/specs/2026-08-10-phase2-rotation-availability-design.md`
**Execution mode:** Subagent-driven-development (fresh implementer subagent per task, then a
spec-compliance reviewer subagent, then a code-quality reviewer subagent, fix loops as needed) —
same process Phase 1 used throughout.

### Task status

| # | Task | Status |
|---|------|--------|
| 1 | `lib/rotationHistory.js` — rolling snapshot history | ✅ done, reviewed, one real bug found+fixed (currentTeam was tracking insertion order instead of max-gw; fixed to handle postponed-fixture backfills correctly) |
| 2 | `lib/startProbability.js` — start-probability algorithm + displacement detection | ✅ done, reviewed, fixes applied (missing `'u'` status short-circuit, missing null-guard on `recentWindow`, plus documentation improvements) |
| 3 | `server.js` — rotation storage + 3 endpoints (`/api/rotation/snapshot`, `/history`, `/history-bulk`) | ✅ done, reviewed, fixes applied (added missing test for the bulk endpoint, extracted a `resolvePersistentFile()` helper to stop a 4th copy-paste of the write-fallback pattern, tightened validation) |
| 4 | `sync.js` — remove `ROLE_OVERRIDES`/`KNOWN_TRANSFERS`/automatic Gemini call, generic `team_join_date`-based signals | ✅ done, reviewed, **one Critical bug found and fixed**: switching `existingPlayers` matching from `name` to `code` would have silently broken an unrelated existing feature (the early-season historical-stats merge) for the *entire* player pool on the first post-deploy sync, since today's `data.js` has zero `code` fields yet. Fixed with a `code`-first-then-`name`-fallback lookup, self-healing after one sync. |
| 5 | `sync.js` — wire rotation snapshot recording + compute `startProbability`/`dataConfidence`/`displacementRisk` into `data.js` | ⏳ **NOT STARTED — this is the next task to dispatch** |
| 6 | `app.js` — `getPlayerMinutesFactor` consumes `startProbability` | ⏳ pending |
| 7 | `components/optimizer.js` — consolidate 3 duplicate `PROMOTED_TEAMS_LIST` usages onto the new signal | ⏳ pending |
| 8 | `components/planner.js` — Check Risks enhancement (displacement + low-confidence badges, restructure `runPlannerSquadRiskCheck` so the local pass always runs alongside the optional Gemini pass) | ⏳ pending |
| 9 | Manual verification (`npm test`, `npm run build`, `npm run sync` against live data, browser-test Check Risks, post-deploy confirmation) | ⏳ pending |

**Latest commit on the branch:** `9bf0759` (Task 4's fix commit). Test suite currently green: 74/74.

### To resume

1. Re-open this conversation or start a fresh one with this file as context.
2. `cd` into `.worktrees/phase2-rotation-availability`, confirm `npm test` still passes (74/74
   expected) and `git log --oneline -5` shows `9bf0759` at the tip.
3. Continue subagent-driven-development starting at **Task 5** — the plan doc has its complete
   spec (real code, hand-verified where numeric). Task 5 is the most complex remaining task: it
   wires Tasks 1-3's new modules into `sync.js`'s live sync loop, including a real per-player loop
   over ~700 players that (per code review findings on Task 2) needs to tolerate individual
   malformed entries gracefully rather than aborting the whole computation.
4. After all 9 tasks are done and reviewed, follow the same finishing sequence Phase 1 used:
   final holistic cross-file review → `finishing-a-development-branch` skill → push → PR → merge →
   confirm Railway redeploy → **re-run `npm run build` explicitly** before considering it deployed
   (see incident note below — this is now a mandatory step, not optional).

## Important context to carry forward

### The Phase 1 production incident (don't repeat it)

After merging Phase 1's PR, the Railway build broke: `app.js` had a *named* ES import
(`import { XP_CALIBRATION_FACTOR } from './data.js'`) for a field that didn't exist yet in the
currently-committed `data.js` (a race between the merge and the next scheduled data-sync). Vite/
Rollup does *static* export validation on named imports — this is a hard build-time error, not a
runtime-catchable `undefined`, so `npm test` never would have caught it. Fixed by switching to a
namespace import (`import * as DataModule from './data.js'`) for that one optional field, and
that's now the established pattern for any new optional/not-yet-guaranteed field. **Task 9's
manual-verification step explicitly requires running `npm run build`, not just `npm test`, for
exactly this reason — do not skip it.**

### The calibration math bug (already fixed, informational)

Also during Phase 1's final review, the auto-tuning calibration formula was found to have no stable
equilibrium (it would have permanently decayed the calibration factor to a hard floor for any
sustained real-world model bias). Already fixed and deployed — mentioned here only because it's a
good example of why the holistic final-review pass (not just per-task review) matters, and the same
discipline should apply to Phase 2's eventual final review.

### What the real backtest data already told us (motivating Phase 2)

From Phase 1's retrospective validation against last season's 29,747 real player-gameweeks:
minutes/rotation prediction is the dominant error source (61% of all mispredictions were players
who scored 0 actual minutes, and that bucket had *higher* error than the played-60+-minutes
bucket), and error increases with player price (worst at ≥£10.0m). This is why Phase 2 exists and
why it's scoped the way it is — full breakdown in `docs/xp-model-roadmap.md`.

### Design decisions already made in Phase 2 (don't re-litigate unless something's actually wrong)

- The automatic Gemini call in `sync.js` is being removed entirely (done, Task 4). The **separate**,
  user-triggered, opt-in Gemini feature in Check Risks/Optimizer/Transfer Planner (shared
  `fpl_hub_gemini_api_key` localStorage setting) is explicitly staying — confirmed with the user,
  not in scope to touch.
- `isNewToCurrentTeam`/transfer detection uses `bootstrap-static`'s `team_join_date` field (verified
  live to exist), not diffing our own snapshot history — avoids a cold-start gap where the very
  first sync wouldn't recognize any of the current summer's transfers.
- `computeBasePPG`'s `isPromotedOrTransfer` (productivity question) and the new
  `isNewToCurrentTeam` (availability question) are deliberately two separate signals answering two
  different questions — don't merge them.
- Task 7 (optimizer.js) was discovered during planning, not in the original design doc — it has its
  own independent copy of the same hardcoded-list pattern (three spots) that needed the same fix.
- Displacement risk in Check Risks is explicitly **linked** (names the specific threatening
  teammate), not just an independent score, per explicit user preference.

## Files worth reading first when resuming

1. This file.
2. `docs/superpowers/plans/2026-08-10-phase2-rotation-availability.md` — the actual task specs.
3. `git log --oneline` in the worktree — commit messages document what happened and why in detail.
