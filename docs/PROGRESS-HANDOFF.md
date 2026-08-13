# Progress Handoff — xP Model + AI Optimizer Effort

_Last updated 2026-08-13 (mid-session, approaching usage limit — this file is a real resume point,
not historical context)._

## Current state of `main`: clean, all tests passing, nothing in flight

`git status` is clean (only untracked `.claude/launch.json`, harmless). `npm test` → 141/141 passing.
No worktrees, no open branches. Everything described as "done" below is genuinely merged and live.
The one thing NOT done is the basePPG recalibration investigation below — that's mid-investigation,
with two real trials run and **both deliberately reverted** (not committed) because neither alone was
sufficient — see "Immediate next action."

## Immediate next action (pick up here)

**Confirmed root cause of the Arsenal/Man City overvaluation: `basePPG` itself, not primarily the
fixture-difficulty scaling.** Full investigation trail:

1. Fixed the DEF/GKP attack-multiplier bug (see "Done" section) — real, measured improvement, but
   Arsenal and Man City were STILL massively overvalued afterward.
2. User pushed back further: **it's not Arsenal-specific** — Man City's full roster is *also* ~133%
   higher than Solio, across every position, including defenders (even after the DEF/GKP fix). Real
   comparison table run this session (see "Man City comparison" below).
3. Traced Man City's case: their real defence-strength rating is ALSO a league outlier (1400 away,
   highest in the league, same pattern as Arsenal's attack rating being highest). Their inflated
   defenders are coming through `csAdj` (defence-strength-based), not `fdrMultiplier` — a different
   channel, same underlying phenomenon (both teams are genuine current outliers on their respective
   axis of real team strength).
4. **Key diagnostic that changed the whole direction**: tested Bruno G. (real 154 pts / 27 starts =
   5.70 raw PPG) and Haaland at a fully NEUTRAL fixture (fdrMultiplier forced to 1.0, no
   strength-based scaling applied at all). Even then, Bruno G.'s baseline alone was **6.1 points** —
   already higher than Solio's *whole 5-GW average* of 3.88 for him. This proves the fixture-scaling
   constants (`K_ATTACK_SPECIFIC/OVERALL`, `K_DEFENCE_SPECIFIC/OVERALL`) are NOT the dominant driver
   — `basePPG` itself is, because it's currently `totalPoints / appearances`: **raw, unregressed
   historical PPG carried forward at full strength**, by design (see the existing comment in
   `computeBasePPG` — this was always intentional, not an oversight).

**The real, still-open design question:** should `basePPG` apply regression-to-the-mean (dampen raw
historical PPG toward a more conservative baseline, accounting for the fact recent form/a transfer/
aging make pure history an imperfect predictor), or is trusting raw history at full strength a
legitimate modeling choice Solio simply doesn't share? **User has decided: add regression-to-mean
(option 1 of 3 offered).** This is now the task.

### Recommended design (proposed, evidence-based, NOT yet implemented on `main`)

Replace `computeBasePPG`'s hard cutoff (100% raw history above 500 minutes, hard blend below) with
continuous Bayesian shrinkage / empirical-Bayes smoothing — a real, standard statistical technique,
not an arbitrary knob:

```js
const PRIOR_GAMES = 15; // TUNABLE - see trial data below, this value was NOT finalized

export function computeBasePPG({ minutes, appearances, totalPoints, position, teamShort, price, isPromotedOrTransfer, manualOverridePPG }) {
    let basePPG = 0.5;
    if (manualOverridePPG !== undefined && manualOverridePPG !== null) {
        basePPG = manualOverridePPG;
    } else if (minutes > 0 && appearances > 0) {
        const defaultPPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
        basePPG = (totalPoints + defaultPPG * PRIOR_GAMES) / (appearances + PRIOR_GAMES);
    } else if (isPromotedOrTransfer) {
        // ... unchanged
    } else {
        // ... unchanged
    }
    // ... ceilings unchanged
}
```

This blends real historical points with `PRIOR_GAMES` worth of an assumed-average performance. A
player with few real appearances gets pulled hard toward `defaultPPG` (prior dominates); a player
with a long, proven 35+ game track record barely moves (real data dominates). It naturally subsumes
the OLD low-minutes blending branch (which only applied below 500 minutes, with zero blending above
that threshold) into one continuous formula — no more hard cutoff.

### Real trial data (both trials reverted, not committed — this is what to pick up)

**Trial A: basePPG only, `PRIOR_GAMES=15`.** Implemented, synced, measured, then reverted.
- Bruno G.: basePPG dropped from raw 5.70 to shrunk 4.81; his actual 5-GW average dropped from 9.30 → **8.00** (confirmed via live sync, not just hand math).
- Arsenal squad total: 149.1 → ~127.8 (from the earlier DEF fix) → **~116.7** (132%→112% higher than Solio).
- Man City squad total: 120.6 → **105.8** (133%→105% higher than Solio).
- **Season-pace benchmark dropped to 2464.3** — below the real #1-overall-rank range (2557-2844).
  This alone is too aggressive; `PRIOR_GAMES=15` overcorrects the season-aggregate even though it
  undercorrects the Arsenal/City-specific gap. These two targets pull in different directions and
  need to be balanced together, not tuned against one in isolation.

**Trial B (run earlier, separate from A): K-constant slope reduction (30% cut to
`K_ATTACK_SPECIFIC/OVERALL` and `K_DEFENCE_SPECIFIC/OVERALL`).** Implemented, synced, measured, then
reverted (BEFORE trying Trial A — these were NOT combined/tested together, that's the obvious next
experiment).
- Arsenal: 132% → 111% higher. Man City: 133% → 107% higher. Similar magnitude of improvement to
  Trial A, via a completely different mechanism (fixture-scaling slope, not the flat baseline).
- Season-pace benchmark was NOT re-measured for this specific trial in isolation (measured before/
  after Trial A instead) — needs checking if this path is revisited.

**Neither trial alone closes the gap.** Each closes roughly a fifth to a quarter of the ~130
percentage-point gap. The two mechanisms are largely independent (one dampens the fixture-varying
portion, one dampens the flat baseline portion) — **the next experiment should combine both at more
moderate individual strengths** (e.g. a smaller K-constant cut + a smaller `PRIOR_GAMES`, tuned
together) rather than pushing either one alone to an extreme that breaks the season-pace benchmark.

### Full reproducible comparison methodology (use this exact approach for any future trial)

```bash
# 1. Make the trial code change in lib/predictionModel.js
# 2. Re-sync: node sync.js  (live FPL fetch, ~30-60s)
# 3. Measure team-level Solio gap:
node -e "
import('./data.js').then(mod => {
  function compareTeam(teamCode, solio) {
    let sumOurs = 0, sumSolio = 0;
    Object.entries(solio).forEach(([name, solioVal]) => {
      const p = mod.PLAYERS.find(pl => pl.web_name === name && pl.team === teamCode);
      if (!p) return;
      const ours = p.predictions.slice(0,5).reduce((s,pr)=>s+pr.pts,0) / 5;
      sumOurs += ours; sumSolio += solioVal;
    });
    console.log(teamCode, 'Ours:', sumOurs.toFixed(1), 'Solio:', sumSolio.toFixed(1), '(' + (((sumOurs/sumSolio)-1)*100).toFixed(0) + '% higher)');
  }
  compareTeam('ARS', {
    Gabriel: 4.96, Saka: 4.57, Mosquera: 4.18, Raya: 3.95, 'Bruno G.': 3.88,
    Rice: 3.67, Havertz: 3.52, Tzolis: 3.41, Calafiori: 3.40, 'J.Timber': 2.86,
    'Ødegaard': 2.66, 'Gyökeres': 2.40, Eze: 2.01, Hincapie: 1.79, White: 1.57,
    Zubimendi: 1.48, Madueke: 1.24, Martinelli: 1.16, Merino: 0.91,
    'Lewis-Skelly': 0.74, 'G.Jesus': 0.48, Dowman: 0.24, Nwaneri: 0.11
  });
  compareTeam('MCI', {
    Haaland: 6.68, Semenyo: 4.98, Anderson: 4.24, \"O'Reilly\": 4.08, 'Matheus N.': 3.82,
    Doku: 3.82, Gvardiol: 3.80, Donnarumma: 3.62, Foden: 3.43, Cherki: 3.22,
    'Rúben': 1.95, 'N.Gonzalez': 1.71, 'Aït-Nouri': 1.42, Savinho: 1.05, Marmoush: 0.97,
    Khusanov: 0.92, Reijnders: 0.86, 'Kovačić': 0.66, Lewis: 0.25, Grealish: 0.21
  });
});
"
# 4. Measure season-pace benchmark (real max-3-per-club, £100m budget, free weekly lineup swaps):
#    see git log for the exact node -e one-liner (used identically ~4 times this session,
#    search commit messages for "season-pace benchmark" to find it verbatim), target range 2557-2844.
```

### What still needs doing after a good `PRIOR_GAMES` + K-constant combo is found

1. Update `test/predictionModel.test.js`'s `computeBasePPG` tests (at least
   `established player uses totalPoints / appearances`, which hardcodes `4.0` for a raw
   `140/35` calculation — will need a hand-recalculated new expected value under shrinkage, same
   rigor as the DEF/GKP fix's hand-verified test updates).
2. Check whether `getAttackMultiplier`/`getCleanSheetProb` tests need updating if K-constants change
   too (e.g. `extreme overall-strength mismatch` test hardcodes `1.4`/`1.2`; the `ARS @ AVL GW2` test
   and the `12.7` season-pace-target regression test in `computeGwPrediction` may also need new
   hand-verified values).
3. Full design/spec/plan cycle per this session's established rigor (brainstorm was already done —
   see conversation; a written spec was NOT yet created for this specific basePPG-shrinkage change,
   unlike every other change this session — write one before implementing for real, capturing this
   trial data as the evidence section).
4. Re-verify BOTH benchmarks together before considering this done: Arsenal/Man City gap vs. Solio,
   AND the season-pace benchmark staying in the real 2557-2844 range.
5. This is a global change (affects `basePPG` for every player in the game) — after implementing,
   spot-check a few players OUTSIDE Arsenal/Man City (a mid-table team, a promoted team) to confirm
   nothing broke for them specifically.

---

## Big picture — what's DONE, MERGED, DEPLOYED, LIVE on `main`

- **Phases 1-3 (xP model rework):** backtest infra, rotation/availability modeling, real
  fixture-difficulty model.
- **Phase 4 (set-piece duty from real FPL API data), positional vacancy boost:** both merged
  earlier this session (PRs #4-#6).
- **Defensive Contribution (PR #7, merged):** real per-player `dcPer90` wired into core XP
  (`getExpectedDefconPts`/`defconAdj`) and the previously-mislabeled "Defcon Potential" UI badge
  fixed to use real defensive stats instead of fixture-ease odds. Full task-by-task + final holistic
  review cycle (holistic review caught 2 real cross-file issues: a dead GKP code path in the
  optimizer's "Prioritize Defcon Monsters" heuristic, and a stale UI tooltip).
- **AI Optimizer starting-XI reconciliation bug (`86d376e`):** `isStarting` was assigned once by
  slot array index, never re-derived from which players actually ended up in the squad — a stronger
  player could sit on the bench indefinitely. Fixed, verified live in-browser.
- **chanceOfPlaying classifier reorder (`e06426d`):** a rules-based rotation-risk classifier
  (flags low-starts/low-minutes players, sets `chanceOfPlaying=15`) ran AFTER predictions were
  already computed with the OLD higher chanceOfPlaying — the classification never actually dampened
  anything. Fixed by moving the classifier before the prediction loop. Confirmed via live sync:
  Nwaneri/Dowman/Lewis-Skelly/G.Jesus's GW1 predictions dropped from ~2.8-3.3 to ~0.4-0.5,
  correctly reflecting their real 15% availability. App-wide fix, not Arsenal-specific.
- **DEF/GKP attack-multiplier fix (PR #8, `9e822e0` + `bd46a33`):** `computeGwPrediction` was
  multiplying GKP/DEF's ENTIRE baseline by an attack-strength-gap signal meant for MID/FWD. Fixed:
  GKP/DEF now get `fdrMultiplier=1.0` (no multiplicative scaling), rely on the already-existing
  `csAdj` (defence-strength-based) instead, plus DEF gets a new personal attacking nudge (`xgiAdj`,
  own real `xG90`/`xA90`, same architecture MID/FWD already use). MID/FWD completely unchanged.
  **Real, measured, but PARTIAL improvement** — see "Immediate next action" above for what's still
  wrong after this fix (the bigger, basePPG-driven piece of the gap).
- **Calibration state:** `PLAYER_ATTACK_MULTIPLIER_MIN=0.5` / `MAX=2.0`, `K_ATTACK_OVERALL=0.20`,
  `K_ATTACK_SPECIFIC=0.003`, `K_DEFENCE_SPECIFIC=0.0008`, `K_DEFENCE_OVERALL=0.13`,
  `computeBasePPG` uses raw `totalPoints/appearances` above 500 minutes (all as of this writing —
  the basePPG shrinkage change above is NOT yet applied to `main`). Season-pace benchmark
  (real max-3-per-club + £100m budget methodology) last measured at **2822.9** (post DEF/GKP +
  chanceOfPlaying fixes, before any basePPG/K-constant recalibration) — within the real
  2557-2844 range but near the top of it, meaning there's some room to dampen before this benchmark
  itself would break, but not unlimited room.
- **Standing constraint UPDATED this session:** user has now given fresh explicit permission to
  touch `PLAYER_ATTACK_MULTIPLIER_MAX` and the K-constants as part of this recalibration effort
  (previously required asking first — that ask happened, user said "Sure"/proceed). This does NOT
  mean the constraint is gone forever — it means THIS specific recalibration effort is
  pre-approved; still don't casually re-open it again for unrelated future changes without asking.

## Reference resource discovered this session

User shared an open-source FPL forecasting model, [OpenFPL](https://github.com/daniegr/OpenFPL)
([paper](https://arxiv.org/html/2508.09992v1)). Saved as a memory
(`openfpl_reference_model` in the persistent memory system). Training code, not a
plug-and-play prediction API — not directly useful for the current basePPG question, but
architecturally validates position-specific treatment, and publishes real RMSE benchmarks
(Zeros/Blanks/Tickers/Haulers categories) that could validate FFH's model once real 2026/27
results exist (not yet, as of this session — preseason).

## Deferred, non-blocking items (still pending, lower priority than the basePPG work above)

1. **Displacement-risk staleness:** `detectDisplacementRisk` runs before the positional vacancy
   boost in `sync.js`, so a boosted player could still show a stale "High risk of displacement" badge.
2. **`scripts/retro-backtest.js` gaps:** doesn't pass `setPieceDuty` OR `dcPer90` into
   `computeGwPrediction`. Low priority, doesn't affect live calibration.
3. `sync.js`'s `historicalStartRate` left `undefined` rather than the established `null` sentinel on
   a failed-computation path; `SET_PIECE_ASSIST_BONUS` (flat 0.06) is a low-confidence estimate.

## Standing behavioral constraints (still active)

- **Minimize AskUserQuestion for implementation-level decisions** — reserve questions for genuine
  product/scope-level calls with no clear right answer (this session's basePPG-shrinkage-vs-leave-
  alone question was exactly this kind of call, correctly asked).
- **`PLAYER_ATTACK_MULTIPLIER_MIN/MAX` and the K-constants**: pre-approved for THIS recalibration
  effort only (see above) — don't treat that as blanket permission for unrelated future tweaks.

## Files worth reading first if picking this back up

1. This file.
2. `git log --oneline` on `main` — commit messages document what happened and why, in detail.
3. This file's "Immediate next action" section has the full trial data and exact reproduction
   commands — no need to re-derive the Solio comparison baselines or season-pace methodology from
   scratch.
