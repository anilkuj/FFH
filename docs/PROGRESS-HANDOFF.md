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

## HIGH PRIORITY, ROOT-CAUSE FOUND, NOT YET FIXED: Arsenal (and likely others) overpriced

User flagged this via Solio screenshots (a third-party FPL projection site — confirmed both
screenshots were Solio's own UI, not ours, after comparing layouts). Real, controlled comparison run
this session (our model's real 5-GW average vs. Solio's, same players, `node` one-liner against
local `data.js` — reproducible any time, not a one-off):

| Player | Ours | Solio | Diff |
|---|---|---|---|
| Saka | 10.26 | 4.57 | **+5.69** |
| Gabriel | 8.04 | 4.96 | **+3.08** |
| O'Reilly | 6.44 | 4.08 | +2.36 |
| Anderson | 6.30 | 4.24 | +2.06 |
| Semenyo | 7.10 | 4.98 | +2.12 |
| B.Fernandes | 7.64 | 6.20 | +1.44 |
| Haaland | 8.08 | 6.68 | +1.40 |
| Buendía | 5.38 | 4.10 | +1.28 |
| Ndiaye | 3.94 | 4.43 | -0.49 |
| Tavernier | 3.40 | 4.22 | -0.82 |

(Full 28-player table is reproducible — see the `node -e` one-liner used, not saved as a script;
recreate by loading `data.js`'s `PLAYERS`, averaging `predictions.slice(0,5)`, against a hand-entered
Solio baseline if the user provides a fresh screenshot.) Not every player is over — some are under —
but the biggest outliers are dramatic and skew toward specific teams/positions, not random noise.

**User pushed back: this isn't defender-specific — it's the whole Arsenal squad.** Confirmed with a
full-roster comparison (23 Arsenal players, every position, using the exact Solio numbers from the
user's Arsenal-filtered screenshot):

| Player | Pos | Ours | Solio | Diff |
|---|---|---|---|---|
| Eze | MID | 8.46 | 2.01 | **+6.45** |
| White | DEF | 8.02 | 1.57 | **+6.45** |
| Merino | MID | 6.94 | 0.91 | +6.03 |
| Hincapie | DEF | 7.70 | 1.79 | +5.91 |
| Saka | MID | 10.26 | 4.57 | +5.69 |
| Gyökeres | FWD | 7.94 | 2.40 | +5.54 |
| Martinelli | MID | 6.34 | 1.16 | +5.18 |
| Bruno G. | MID | 9.00 | 3.88 | +5.12 |
| Rice | MID | 8.70 | 3.67 | +5.03 |
| Zubimendi | MID | 6.46 | 1.48 | +4.98 |
| Ødegaard | MID | 7.60 | 2.66 | +4.94 |
| Havertz | FWD | 8.28 | 3.52 | +4.76 |
| Calafiori | DEF | 8.04 | 3.40 | +4.64 |
| Raya | GKP | 8.14 | 3.95 | +4.19 |
| Gabriel | DEF | 8.04 | 4.96 | +3.08 |
| Nwaneri | MID | 3.06 | 0.11 | +2.95 |
| Dowman | MID | 3.08 | 0.24 | +2.84 |
| G.Jesus | FWD | 3.26 | 0.48 | +2.78 |
| Lewis-Skelly | MID | 2.98 | 0.74 | +2.24 |
| Tzolis | MID | 5.02 | 3.41 | +1.61 |
| Mosquera | DEF | 4.38 | 4.18 | +0.20 |
| J.Timber | DEF | 0.00 | 2.86 | **-2.86** |

**Squad total: ours 149.1 vs. Solio 55.2 — 170% higher, every single position included.** This is
far bigger than the DEF-multiplier theory alone can explain — that mechanism inflates DEF the most
visibly (because defenders "shouldn't" benefit from an attack multiplier at all), but MID/FWD/GKP
get the exact same `pts *= fdrMultiplier` applied too, so an inflated Arsenal attack rating inflates
literally everyone on the team, just less obviously for attackers (who are "supposed" to score more
anyway).

**Second, separate mechanism found — data staleness, not a code bug.** Nwaneri/Dowman/Lewis-Skelly
are all fringe academy players currently showing real `chanceOfPlaying: 15` (i.e. FPL's own live
data says ~15% likely to play). Recomputing Nwaneri fresh through the pure `computeGwPrediction`
function with that real 15% correctly applied gives GW1 = **0.6** pts. But his *stored* prediction in
`data.js` shows GW1 = **2.8** — proving the stored predictions were computed at an earlier sync, when
his `chanceOfPlaying` was much higher, and `data.js` on `main` simply hasn't been refreshed since his
availability dropped. This is an operational fix (re-run `node sync.js`), not a model bug — but it's
real and inflates every low-availability fringe player across the WHOLE app, not just Arsenal's.
**Before trusting any further Arsenal-specific diagnosis, re-sync `main`'s `data.js` first and
re-measure the gap** — some of the "170% higher" figure will shrink once fringe players reflect their
real current availability. What's left after that re-sync is the real, model-level signal to fix.

### Root cause (attack-multiplier-for-all-positions), confirmed via direct inspection (not guessed)

`computeGwPrediction` (`lib/predictionModel.js`) applies one multiplier —
`breakdown.fdrMultiplier = clamp(getAttackMultiplier(fixture), PLAYER_ATTACK_MULTIPLIER_MIN, MAX)`
— to `pts *= fdrMultiplier` **before** branching into GKP/DEF/MID/FWD-specific logic. This means a
**defender's** baseline points get scaled by the team's ATTACKING-strength gap vs. the opponent's
defence, not by a defensive/clean-sheet-relevant signal. `csAdj` (the clean-sheet-probability term)
is a separate, smaller additive term layered on top — it doesn't correct for this.

Checked real team-strength data (`TEAMS` in `data.js`, sourced from FPL's own `bootstrap-static`):

```
ARS  strengthAttackHome=1340  strengthAttackAway=1390   <- higher than Man City below
MCI  strengthAttackHome=1220  strengthAttackAway=1310
AVL  strengthDefenceHome=1150 (Arsenal's GW2 opponent)
SUN  strengthDefenceHome=1040 strengthDefenceAway=1130  (Arsenal's GW4 opponent, promoted team)
COV  strengthAttack/Defence: null/null                  (promoted, no data yet -> fallback path)
```

Arsenal's real, FPL-official attack rating is currently higher than Man City's, and several of their
next-5 opponents (Sunderland, Aston Villa, newly-promoted Coventry) have weak/missing defence
ratings. The attack-vs-defence gap repeatedly approaches `PLAYER_ATTACK_MULTIPLIER_MAX` (2.0) across
*multiple* of the 5 gameweeks, not just one — confirmed via per-fixture breakdown:

```
Saka:    GW1 9.6, GW2 10.9(diff=4!), GW3 8.2, GW4 12.6(diff=3), GW5 10.0  -> avg 10.26
Gabriel: GW1 7.5, GW2 8.6(diff=4!),  GW3 6.3, GW4 10.0(diff=3), GW5 7.8   -> avg 8.04
```

Note GW2 (diff=4, "hard" per FPL's own official difficulty) scoring *higher* than GW1/GW3 (easier
diff) for both players — the strength-based path is overriding FPL's own diff rating in the
"favorable" direction here, which is a previously-accepted, *intentional* design choice for
attackers (there's an existing test for exactly this: `getAttackMultiplier: real ARS @ AVL GW2 case
-- overall strength disagrees with FPL official diff, and we side with strength`). The bug is less
"the multiplier disagrees with diff" and more "**this same multiplier gets applied to defenders,
where attacking-strength gap isn't the relevant signal**."

### Recommended direction for next session (not yet designed, don't just patch blindly)

- **Step 0, do this first:** re-run `node sync.js` on `main` to refresh `data.js` with current real
  availability data, then re-run the full-squad comparison table above. This will shrink (not
  eliminate) the gap for fringe/low-minutes players. Don't redesign the model against numbers that
  are partly a stale-data artifact.
- **Most likely real fix (for what remains after re-sync):** give DEF (and maybe GKP) a separate, more dampened fixture multiplier
  tied to defensive strength (opponent attack vs. own defence — `K_DEFENCE_SPECIFIC`/
  `K_DEFENCE_OVERALL` already exist in `lib/predictionModel.js` for `getCleanSheetProb`; investigate
  whether an analogous defence-oriented multiplier should replace or dampen `fdrMultiplier` for the
  DEF/GKP branches specifically, instead of reusing the attack-oriented one).
  Attack-strength-based `fdrMultiplier`is not the right coupling for Gabriel's basePPG; the same
  applies to any other Arsenal/high-attack-team defender.
- Saka/Haaland/B.Fernandes-style overages (elite attackers on a team with a genuinely high, real
  attack rating) are smaller in magnitude and more defensible — may just need the existing
  `PLAYER_ATTACK_MULTIPLIER_MAX` re-examined for whether 2.0 is still right now that it's compounding
  across most of a 5-GW window for a top attacking side, not firing rarely as originally intended.
  **This DOES touch the standing-constraint constant** — needs a fresh, explicit user conversation
  before changing it, not a unilateral tweak. Bring the new evidence (this table) to that
  conversation rather than re-deriving it.
- This needs the full `superpowers:brainstorming` → spec → plan → subagent-driven-development cycle,
  same rigor as every other scoring change this session — don't shortcut it just because the evidence
  is strong. A DEF-specific multiplier is a real architecture change to `computeGwPrediction`, not a
  one-line tweak.
- Do NOT reproduce or rely on Solio's actual displayed numbers beyond what's needed for this internal
  comparison — same copyright-awareness as the rest of this session.

**Priority call for next session:** user pushed on this harder than the Defcon Contribution branch
in this session's final messages — consider asking the user whether to finish/merge Defcon
Contribution first (small remaining surface, already 4/5 tasks reviewed) or pivot to this
Arsenal/defender-multiplier investigation first. Don't assume the order — this is a genuine
priority call, not an implementation detail.

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
