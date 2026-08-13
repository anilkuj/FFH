# Progress Handoff — xP Model + AI Optimizer Effort

_Last updated 2026-08-12 (mid-session, approaching usage limit — this file is a real resume point,
not historical context)._

## Immediate next action (pick up here)

Resuming subagent-driven-development on branch `feature/defensive-contribution`, worktree at
`.worktrees/defensive-contribution`. Tasks 1-4 of the plan are implemented, spec-reviewed, and
code-quality-reviewed. **One fix from Task 4's code-quality review has NOT been applied yet:**

- `sync.js`'s `getPlayerRatings` computes `dcRatio = (player.dcPer90 || 0) / threshold` with no
  float-precision guard. `lib/predictionModel.js`'s `getExpectedDefconPts` computes the identical
  ratio and explicitly rounds it (`Math.round(x * 1e6) / 1e6`) specifically because IEEE 754 breaks
  exact boundary values — e.g. a MID with `dcPer90 = 13.2` computes `13.2/12 = 1.0999999999999999`,
  not `1.1`, misclassifying into the wrong tier. `dcPer90` is stored via `.toFixed(2)`, so real
  boundary values reproduce this. Net effect: the "Defcon Potential" UI badge and the xP model's
  internal hit-probability tier can silently disagree for players sitting exactly at a threshold
  multiple. **Fix:** apply the same rounding guard in `sync.js` (search for `const dcRatio =`).
- After that fix: re-run `npm test` (should stay 133/133 — this isn't a new-test-covered path), then
  a quick manual check that a known boundary-value player now grades consistently between the badge
  and the model, then commit.
- Then: **Task 5** (full regression + manual verification, per
  `docs/superpowers/plans/2026-08-12-defensive-contribution.md`) — not started yet.
- Then: final holistic cross-file review (per `superpowers:subagent-driven-development`'s process —
  a dedicated reviewer subagent looking at the WHOLE branch diff together, the way the earlier
  vacancy/set-piece branch caught a real double-counting bug that per-task review missed).
- Then: `superpowers:finishing-a-development-branch` (push, PR, merge into `main`, verify live).

**Worktree housekeeping:** `git status` in the worktree shows `data.js` modified (from a live
`node sync.js` run done to verify Task 4) plus `package-lock.json`/`node_modules/.package-lock.json`
noise (npm side effects, not related to this feature — do not commit those). Decide at
finishing-the-branch time whether to commit a fresh `data.js` sync (matching the pattern from the
vacancy/set-piece branch, which ended with a `chore(sync): refresh data.js` commit) or let the next
real sync pick it up.

Design spec: `docs/superpowers/specs/2026-08-12-defensive-contribution-design.md`
Plan: `docs/superpowers/plans/2026-08-12-defensive-contribution.md`

---

## New, NOT YET INVESTIGATED: Arsenal XP looks overpriced vs. Solio

User flagged this via a screenshot of the Projections table (points-sorted, all Arsenal shown):
Gabriel 4.96 avg, Saka 4.57, Mosquera 4.18, Raya 3.95, Bruno G. 3.88, Rice 3.67, Havertz 3.52,
Tzolis 3.41, Calafiori 3.40 — an unusually large cluster of one team's players at the top of a
GW1-5 points table. User's explicit ask: "we need to scale that down to be realistic."

**Not yet done, do this first when resuming (after the Defcon branch is merged, or in parallel if
more urgent):**
1. Get real, current Solio numbers for the same Arsenal players/window to confirm this is a real gap
   and not just "Arsenal genuinely have good fixtures + a stacked squad this window" (which alone
   wouldn't be a bug). Same methodology as the earlier Ndiaye/Calvert-Lewin investigations this
   session — controlled comparison, not vibes.
2. Consider whether this is confounded by the **positional vacancy boost** (Saliba+Timber both out
   → Mosquera boosted, and possibly interacting with Gabriel/others) landed earlier this session —
   worth checking whether removing that boost's effect still leaves Arsenal overpriced, to isolate
   root cause before touching anything.
3. Consider whether Arsenal's real team-strength inputs (`lib/teamStrength.js`) are simply rated
   very high right now (real, not a bug) vs. whether there's a genuine calibration skew specific to
   this team.
4. **Standing constraint still applies:** no further changes to the AGGREGATE season-pace
   calibration (`PLAYER_ATTACK_MULTIPLIER_MIN/MAX` in `lib/predictionModel.js`) without a fresh
   explicit user request — user previously confirmed that pair's current value is correct. If this
   Arsenal issue turns out to be team-specific (not aggregate), a fix likely lives elsewhere (team
   strength inputs, or a per-team check) — don't reach for the MIN/MAX pair by default.
5. Do NOT reproduce or rely on Solio's actual displayed numbers beyond what's needed for a real,
   narrow comparison — same copyright-awareness as the rest of this session.

---

## Big picture — what's DONE, MERGED, DEPLOYED, LIVE on `main`

- **Phases 1-3 (xP model rework):** backtest infra, rotation/availability modeling, real
  fixture-difficulty model.
- **Phase 4 (set-piece duty from real FPL API data):** penalty/free-kick/corner duty replaces old
  hardcoded name lists; `PENALTY_DUTY_BONUS` currently `{ FWD: 0.32, MID: 0.4, DEF: 0.49 }` (75% of
  full real-anchored credit, raised from 50% per explicit user direction; see
  `lib/predictionModel.js`'s comment above that constant for the full derivation).
- **Positional vacancy boost + set-piece duty wired into core XP** (not just the Optimizer's
  internal ranking) — PR #6, merged. `lib/startProbability.js`'s `detectPositionalVacancy`.
- **AI Optimizer perf/correctness fixes** (PR #4 + follow-ups): non-blocking progress UI, decay-
  weighting bug fix (every horizon GW now weighted equally), squad-fill fallback hardening.
- **AI Optimizer starting-XI reconciliation bug (`86d376e`, pushed to `origin/main` this session):**
  `isStarting` was assigned once, by slot array index, before any player was placed — never
  re-derived from which players actually ended up in the squad. A genuinely stronger player could
  sit on the bench indefinitely while a weaker same-position teammate started. Real example that
  surfaced it: Thomas (6.4 XP/5GW) started over Heaven (20.4) and Hickey (17.7), with budget still
  unspent. Fixed by re-deriving `isStarting` from real horizon score after the squad is final.
  **Verified live in-browser** (fresh preseason optimizer run): every starting DEF/MID now strictly
  outscores the benched options at that position.
  - **Known, deliberately untouched:** `midseason` mode (limited transfers) uses a separate code
    path that inherits `isStarting` from the user's existing saved lineup rather than reassigning
    it. Not confirmed broken — if the same symptom shows up there, apply the same fix pattern.
- **Calibration state:** `PLAYER_ATTACK_MULTIPLIER_MIN=0.5` / `MAX=2.0`, `K_ATTACK_OVERALL=0.20`,
  `K_ATTACK_SPECIFIC=0.003` in `lib/predictionModel.js`. Season-pace re-checked this session with a
  corrected methodology (real max-3-per-club + £100m budget constraint, previously missing) →
  ≈2734.3 pts (no captain/chips, free weekly lineup swaps) vs. real #1-overall-rank range
  2557-2844 (which includes captain doubling + chips) — directionally sane, not re-tuned. **Do not
  touch `PLAYER_ATTACK_MULTIPLIER_MIN/MAX` without a fresh explicit user request** — this is a
  standing constraint from earlier in the session.

## Deferred, non-blocking items (user confirmed wants these after Defcon Contribution ships)

1. **Displacement-risk staleness:** `detectDisplacementRisk` runs before the positional vacancy
   boost in `sync.js`, so a boosted player (e.g. Mosquera) could still show a stale "High risk of
   displacement" badge alongside their now-boosted `startProbability`.
2. **`scripts/retro-backtest.js` gaps:** doesn't pass `setPieceDuty` OR (as of this session)
   `dcPer90` into `computeGwPrediction`. Low priority — doesn't affect live calibration, only the
   offline backtest script.
3. Smaller nits already noted in earlier commits' comments: `sync.js`'s `historicalStartRate` left
   `undefined` rather than the established `null` sentinel on a failed-computation path;
   `SET_PIECE_ASSIST_BONUS` (flat 0.06) is a low-confidence estimate, revisit if better data shows up.

## Standing behavioral constraints (both explicit, both still active)

- **Minimize AskUserQuestion for implementation-level decisions.** User was explicit earlier this
  session: use engineering judgment for pairing algorithms, ceiling-exclusion filters, etc. — only
  ask about genuine product/scope-level calls with no clear right answer.
- **No further `PLAYER_ATTACK_MULTIPLIER_MIN/MAX` changes without fresh explicit request** — see
  above. Narrower, targeted parameter tweaks (like the 75% penalty-dampening change) are a different,
  already-approved category, not a re-opening of this.

## Files worth reading first if picking this back up

1. This file.
2. `git log --oneline` on `main` — commit messages document what happened and why, in detail.
3. `git log --oneline` in `.worktrees/defensive-contribution` (branch `feature/defensive-contribution`)
   for the in-progress Defcon Contribution work.
4. `docs/superpowers/plans/2026-08-12-defensive-contribution.md` — the plan currently being executed.
5. `docs/superpowers/specs/2026-08-12-defensive-contribution-design.md` — the design it implements.
