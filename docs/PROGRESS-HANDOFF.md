# Progress Handoff — xP Model Improvement Effort

_Last updated 2026-08-11 (usage-limit break) to allow clean resumption._

## Big picture

Multi-phase effort to fix an FPL app's points-projection model, which a deep review found relied on
hardcoded, never-verified calibration and rotation heuristics instead of real data.

- **Phase 1 (backtest infrastructure): ✅ DONE, MERGED, DEPLOYED, LIVE.**
- **Phase 2 (rotation/availability modeling): ✅ DONE, MERGED, DEPLOYED, VERIFIED LIVE.**
- **Phase 3 (fixture difficulty from real team-strength data): 🔄 5 of 6 tasks done, all
  reviewed/approved, 102/102 tests passing. NOT yet merged. One task left (manual verification),
  then finish the branch (push/PR/merge/deploy, same as Phases 1-2).**

---

## Phase 3 — exact current state (pick up here)

**Branch:** `feature/phase3-fixture-difficulty`
**Worktree:** `.worktrees/phase3-fixture-difficulty` (already set up, `npm install` done)
**Plan:** `docs/superpowers/plans/2026-08-11-phase3-fixture-difficulty.md` (6 tasks — the plan file
itself was corrected mid-implementation, see below, so it now matches what actually shipped)
**Design spec:** `docs/superpowers/specs/2026-08-11-phase3-fixture-difficulty-design.md`
**Execution mode:** Subagent-driven-development (same process as Phases 1-2)
**Latest commit on the branch:** `4361cb0`. Test suite: **102/102 passing.**

### Task status

| # | Task | Status |
|---|------|--------|
| 1 | `lib/teamStrength.js` — 3-tier team-strength resolution (this season → last season archive → null) | ✅ done, reviewed, one real fix (NaN could slip through `typeof v==='number'` tier-1 check; switched to `Number.isFinite`, added mixed-zero/non-numeric test coverage) |
| 2 | `lib/predictionModel.js` — `getAttackMultiplier`, restructured `getCleanSheetProb`, `computeGoalsConcededNudge`, `computeLeagueAverageGoalsConceded90`, rewired `computeGwPrediction` | ✅ done, reviewed, 3 real fixes: (a) `usedStrengthPath` only checked tier-2 fields, not tier-1 — widened to a `fixtureHasStrengthData` helper checking either; (b) the `goalsConceded90` nudge cap wasn't scaled for MID's smaller csAdj weight (×1 vs ×4 for GKP/DEF), made it proportionally ~4x too strong for MID — added a `MID_GOALS_CONCEDED_NUDGE_SCALE=0.25`; (c) missing/undefined `diff` behaved inconsistently (neutral in one function, worst-case in two others) — standardized to neutral everywhere |
| 3 | `sync.js` — wire team strength into `teamsList`/`fixturesSchedule` | ✅ done, reviewed, no real bugs (2 comment-only additions requested and added) |
| 4 | `sync.js` — two-pass restructure for the `goalsConceded90` league average | ✅ done, reviewed, **1 real Critical bug found and fixed — this was a mistake in the plan itself, not the implementer's**: the `actualPts` backtest-simulation gate used the *mutated* `starts` local (overridden to e.g. 25 by the "expected starter" heuristic for promoted-team players) instead of the original code's raw `el.starts`, which would have fabricated non-zero `actualPts` for players who never actually played a finished fixture, corrupting data fed into `lib/calibration.js`. Fixed with a distinct `rawStarts` field; also replaced a fragile deny-list destructure (`...restFields`) with an explicit allow-list return object. **The plan document itself was corrected to match** (commit `c050c7e` on `main`), so re-reading the plan now shows the fixed version, not the original bug. |
| 5 | `sync.js` `LEAGUE_AVG_GOALS_PER_GAME` seed + `ticker.js` uses the real model | ✅ done, reviewed, no real bugs (2 suggestion-level notes, not required: a missing comment on `getFixtureForGw`'s GW>10 fallback lacking strength fields, and a minor style nit) — **this is the task that actually fixes the original bug that kicked off Phase 3**: `ticker.js`'s hardcoded `CS_ODDS_LOOKUP`/`PROJ_GOALS_LOOKUP` tables (hand-copied from a competitor site, causing the ticker's three tabs to visually disagree) are now fully removed, confirmed via grep — the Clean Sheet%/Projected Goals tabs call the real `getCleanSheetProb`/`getAttackMultiplier` functions. Verified live: the ARS@AVL GW2 case (the motivating example throughout this phase) now reads as *easier* by the new strength-based model (attack multiplier 1.144) even though FPL's official `diff` still says hard — exactly as designed. |
| 6 | Manual verification | ⏳ **NOT STARTED — next task to dispatch** |

### To resume

1. Re-open this conversation or start a fresh one with this file as context.
2. `cd` into `.worktrees/phase3-fixture-difficulty`, confirm `npm test` still shows 102/102 and
   `git log --oneline -3` shows `4361cb0` at the tip.
3. Dispatch Task 6 (plan file, section "### Task 6: Manual verification" — search for it near the
   end of the plan doc): full test suite, `npm run build`, re-check the ARS@AVL GW2 case
   end-to-end including in the actual rendered UI, spot-check a newly-promoted team's fixture to
   confirm the tier-3/`null` fallback engages correctly (not a fake `0`), confirm the hardcoded
   tables are gone (`grep -n "CS_ODDS_LOOKUP\|PROJ_GOALS_LOOKUP" components/ticker.js` → no output).
4. After Task 6: dispatch a final holistic cross-file reviewer (same pattern as Phases 1-2 — this
   caught real bugs both previous times, don't skip it) before calling the branch done.
5. Then `finishing-a-development-branch` skill: verify tests → present 4 options → push/PR/merge →
   confirm Railway redeploy → **re-run `npm run build` explicitly** before considering it deployed
   (Phase 1's production-incident precedent — this phase changes `data.js`'s team-object shape, so
   don't skip this).

### User's pending request, not yet done

User asked for a **side-by-side comparison** of what's actually shown on screen (not the underlying
calculation — they were explicit about this: "i dont want underlying calculation just what is shown
on screen") for the Fixture Difficulty Ticker's three tabs (Difficulty/Clean Sheet%/Projected Goals),
presumably comparing our now-real numbers against Fantasy Football Scout's published ticker
(`https://www.fantasyfootballscout.co.uk/fpl/ticker`) for the same fixtures, using screenshots the
user already shared earlier in the conversation (Arsenal/Man City/Man Utd rows, GW1-10, all three
tabs). **Do this next, before or alongside Task 6.** Approach: run the app locally (`npm run build`
+ preview, or `npm run sync` in the worktree + open the built site), navigate to the ticker, and
screenshot/describe the actual rendered values for the same rows/gameweeks the user's FFS
screenshots showed, so the user can compare visually. Do NOT reproduce FFS's specific numbers
verbatim in any file/artifact — only describe OUR OWN app's rendered output; if putting both side by
side, that's fine as an ephemeral chat comparison (not a copied dataset committed anywhere).

**Important context on why FFS's raw data was not used as a data source** (in case asked again):
User pushed multiple times to use Fantasy Football Scout's or Solio Analytics' published FDR/Clean
Sheet%/Projected Goals numbers as a temporary hardcoded stopgap "until we have real Gameweek data",
including asserting the data was confirmed free-to-use. Declined each time — reproducing another
site's computed proprietary output (their Elo model's results) into this codebase is a copyright/
reproduction concern independent of whether their tool is free-to-view (free-to-view ≠ licensed for
reuse), and it would also reintroduce the exact hardcoded-data anti-pattern this whole phase exists
to remove. Instead built a real, free, FPL-sourced 3-tier fallback (this season's real data → last
season's real archived data → null) — this is what Tasks 1-5 above actually deliver, and it was
confirmed to already resolve the user's underlying need (accurate data for personal team-building)
without needing FFS's numbers at all. If this comes up again, the answer hasn't changed; point back
to this section rather than re-relitigating from scratch.

---

## Phase 1 & Phase 2 — final state (for reference, nothing left to do here)

Both fully merged to `main`, deployed, verified live on `https://ffh-production.up.railway.app`.

- **Phase 1**: real backtest/calibration infrastructure. MAE 2.83/RMSE 3.24 baseline against last
  season's real data. `/api/backtest/report?source=retro` is live.
- **Phase 2**: replaced `ROLE_OVERRIDES`/`KNOWN_TRANSFERS`/hardcoded promoted-team lists with a real
  `startProbability`/`dataConfidence`/`displacementRisk` model. Also removed a hardcoded patch that
  cloned Calafiori's exact predictions onto Mosquera — this was the root cause of a real user-
  reported bug ("XP looks identical for some players"), found and fixed as part of this phase's
  final holistic review + a follow-up user report.

**Recently discussed but NOT yet investigated**: user asked how Phase 1/2/3 changes affect XP
calculation and noted some players seem to have lower XP than expected. Answered conceptually
(Phase 2's `startProbability` is more conservative than the old heuristic for players without 3+
real current-season games yet — a cold-start effect that should ease as the season progresses,
not a bug) but no specific player was named/traced through the actual live computation. If the user
raises specific players, trace `startProbability`/`dataConfidence`/the resulting minutes factor for
them directly (same method used earlier in this project for Mosquera/Bruno G./Shaw).

## Important context to carry forward (still applies)

### The Phase 1 production incident (don't repeat it)

Named ES imports of not-yet-existing `data.js` exports are a **hard build-time error** under
Vite/Rollup's static export validation — not runtime-catchable, `npm test` won't catch it. Always
use a namespace import (`import * as X from './data.js'`) for any field that might not exist in the
currently-committed `data.js` yet. Phase 3 already follows this correctly for its new
`LEAGUE_AVG_GOALS_PER_GAME` export in `ticker.js` (see Task 5 above). Always run `npm run build`,
not just `npm test`, before considering any `data.js`-schema-touching change deploy-ready.

### Process discipline that's worked well across all three phases so far

Subagent-driven-development (implementer → independent spec-compliance reviewer → independent
code-quality reviewer → fix loop, repeated per task) + a final holistic cross-file review before
finishing any branch + independent re-verification after any post-review fix pass. **Every phase so
far has found at least one real, non-trivial bug this way that a single-pass review would have
missed** — including, this time, a bug in the plan document itself (Task 4's `rawStarts` issue),
caught by code-quality review rather than the plan's own self-review. Keep doing this discipline for
Task 6 and any future phase.

## Files worth reading first when resuming

1. This file.
2. `docs/superpowers/plans/2026-08-11-phase3-fixture-difficulty.md` — the task specs (now corrected
   to match what actually shipped).
3. `git log --oneline` in the worktree — commit messages document what happened and why in detail.
