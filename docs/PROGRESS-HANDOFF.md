# Progress Handoff — xP Model Improvement Effort

_Last updated 2026-08-11 to allow clean resumption after a usage-limit break._

## Big picture

Multi-phase effort to fix an FPL app's points-projection model, which a deep review found relied on
hardcoded, never-verified calibration and rotation heuristics instead of real data.

- **Phase 1 (backtest infrastructure): ✅ DONE, MERGED, DEPLOYED, LIVE.**
  Merged to `main` via PR #1, hotfixed once post-merge (a Vite build break — see below), confirmed
  live on production (`https://ffh-production.up.railway.app`). Real accuracy baseline recorded:
  MAE 2.83 / RMSE 3.24 across 29,747 real player-gameweeks from last season, durably stored and
  fetchable at `GET /api/backtest/report?source=retro`. Full writeup: `docs/xp-model-roadmap.md`.

- **Phase 2 (rotation/availability modeling): ✅ DONE, MERGED, DEPLOYED, VERIFIED LIVE.**
  Merged to `main` via [PR #2](https://github.com/anilkuj/FFH/pull/2), all 9 planned tasks +
  4 post-holistic-review fixes. Confirmed live on production: bundle `index-Dwl3QTp5.js`, real
  `startProbability`/`dataConfidence`/`displacementRisk` populated after a manually-triggered sync.
  See "Phase 2 — final state" below for full detail.

- **Phase 3 (fixture difficulty from real team-strength data): 🔄 IN PROGRESS — brainstorming stage.**
  This is what's mid-flight right now. Details below. **Not yet started: no design doc has been
  written to disk yet** — all decisions so far exist only in this conversation and must be
  transcribed into a spec before implementation starts.

---

## Phase 2 — final state (for reference, nothing left to do here)

Branch `feature/phase2-rotation-availability` merged and deleted-from-active-use (still exists on
remote, not deleted). Final commit on that branch: `c841c1b` ("fix: address final holistic review
findings + remove Mosquera/Calafiori hardcode").

What shipped:
- `lib/rotationHistory.js`, `lib/startProbability.js` — new pure modules, rolling minutes-history
  based start-probability + displacement-risk detection.
- `server.js` — `/api/rotation/snapshot`, `/history`, `/history-bulk` endpoints.
- `sync.js` — removed `ROLE_OVERRIDES`/`KNOWN_TRANSFERS`/automatic Gemini call; computes
  `startProbability`/`dataConfidence`/`displacementRisk` per player each sync; uses
  `team_join_date` for new-to-team detection instead of a maintained list.
- `app.js` — `getPlayerMinutesFactor` consumes `startProbability`; **removed a hardcoded patch**
  that copied Calafiori's (id 8) exact predicted points onto Mosquera (id 11) whenever Saliba
  (id 6) was injured — this was the root cause of a real user-reported bug ("XP looks identical
  for some players").
- `components/optimizer.js`, `components/planner.js` — consolidated onto the new signals, Check
  Risks surfaces displacement-risk/"Limited Data" badges.

Post-holistic-review fixes (all independently re-reviewed, confirmed correct):
1. **Critical**: `sync.js`'s pre-existing rules-based classifier was mutating
   `p.chanceOfPlaying`, and that mutated value was flowing into `computeStartProbability` as if it
   were real official FPL status. Fixed by snapshotting the real value into a `Map`
   (`officialChanceOfPlayingById`) before the classifier runs.
2. **Important**: `optimizer.js`'s `isGuaranteedStart` slider bypass was triggering on the broad
   `dataConfidence==='low'` condition (nearly the whole player pool) instead of just genuine
   transfers. Narrowed to `player.transferredThisSeason`.
3. **Important**: `components/planner.js`'s `computeLocalRiskEntry` didn't check official status
   `'u'` (unavailable), unlike every other consumer of player status. Added.

Verified end-to-end on production after merge + a manually-triggered sync
(`gh workflow run sync.yml`): Mosquera and Calafiori now show independent XP (2.0 vs 4.7, not
identical), Mosquera has a real `startProbability` (60.9%) and a genuine displacement flag pointing
at **Hincapie** (not a hardcoded name).

**Two Solio-Analytics-comparison side-investigations, resolved during this work (informational,
no code changes needed):**
- User initially flagged Coventry/Hull/Ipswich as "wrong" Premier League teams — false alarm, they
  are genuinely promoted this season (2026/27), just past this assistant's Jan-2026 knowledge
  cutoff.
- User flagged Bruno Guimarães (Arsenal) showing red/low XP vs Aston Villa despite Solio showing
  FDR "2.09" — verified directly against FPL's live official fixtures API: the real official
  `difficulty` for that fixture is `4` (hard), matching our model. Solio's number wasn't from FPL's
  official API at all — turned out (see Phase 3 motivation below) to be a **different app view**,
  not a bug in our data. **Important nuance found in the process**: FPL's own
  `strength_overall_home`/`away` fields, if compared directly, would actually rate this exact
  fixture as *easy* for Arsenal — i.e. FPL's own official `diff` field and its own `strength_*`
  fields disagree with each other for this match. This is real motivation for Phase 3, not a bug to
  fix in Phase 2.

---

## Phase 3 — exact current state (brainstorming, not yet written to disk)

**No branch/worktree created yet.** This phase hasn't reached the design-doc-writing step of the
`brainstorming` skill, let alone `writing-plans` or `subagent-driven-development`.

### How this phase started

User re-examined the Bruno G./Aston Villa fixture question from a different angle: they were
looking at our own app's **"Fixture Difficulty Ticker"** (`components/ticker.js`) but on the
**"Projected Goals" tab**, not the "Difficulty (FDR)" tab, and mistook the Projected-Goals number
(2.06, close to what they said, "2.09") for an FDR value. Investigating that turned up a real,
separate, previously-undiscovered bug:

**`components/ticker.js:4-49`** has two hardcoded lookup tables, `CS_ODDS_LOOKUP` and
`PROJ_GOALS_LOOKUP`, explicitly commented `"Exact ... lookup from FFS ticker screenshots for
GW1-5"` — i.e. hand-copied numbers from a competitor site, completely disconnected from our own
model. This is why the "Clean Sheet %" and "Projected Goals" tabs can visually disagree with the
(correct) "Difficulty (FDR)" tab sitting right next to them in the same widget. The FDR tab itself
was never wrong — only these two other display-only tabs.

User asked to fold fixing this into Phase 3 rather than doing it as a standalone quick fix, since
it's thematically the same problem (static/hardcoded data instead of computed-from-real-signals)
as everything else this effort has targeted.

### Roadmap's original Phase 3 scope (`docs/xp-model-roadmap.md`)

- Replace the static FDR step function (1.12/0.88/0.70, with a known gap where `diff===1` gets no
  bonus at all) with the `teams[].strength_*` fields FPL's own API already returns — currently
  fetched and unused.
- Fold in `goalsConceded90` (already computed per-player, currently unused) into the clean-sheet
  model.
- Directly relevant to why premium players are currently the weakest price band in the Phase 1
  backtest — worth checking whether it's fixture-modeling error specifically, once this lands.

### Real data constraint discovered during brainstorming (important!)

Checked FPL's live `bootstrap-static` API directly for all 20 teams:
`strength_overall_home`/`strength_overall_away` are populated with real, varying values (2-5
range) for every team right now. **But `strength_attack_home/away` and
`strength_defence_home/away` are `0` for every single team** — FPL hasn't populated those granular
splits yet this early in the season (likely fills in after a few gameweeks of real results). Any
design that assumes those sub-fields are usable today will silently produce nonsense (e.g. a
constant 0 "attack strength" for all 20 teams). **User decision: build on `strength_overall_home/
away` only for now; add a guard so the granular attack/defence split is picked up automatically
once FPL populates it later this season — don't block on waiting for it.**

### Design decisions made so far (all approved by user in chat, NOT yet written to a spec file)

1. **Zero-strength-fields handling**: build on `strength_overall_home/away` now (reliable, real
   data); design a guard so `strength_attack_*`/`strength_defence_*` get used automatically once
   FPL populates them (no future code change needed) — approved.
2. **`goalsConceded90` fold-in**: yes, include it — approved.
3. **Scope of the strength-based replacement**: replace *only* the internal multiplier math inside
   `computeGwPrediction` (`fdrMultiplier` step function → continuous strength-gap-based value).
   **Do NOT change the `diff` field itself** — it stays FPL's official 1-5 value, used unchanged
   for all UI display (colors, badges, ticker "Difficulty (FDR)" tab labels) so fixture colors keep
   matching what users see on FPL's own site. Only the XP *calculation* changes — approved.
4. **Data flow (`sync.js`)**: add `strength_overall_home`/`strength_overall_away` to each team when
   `teamsList` is built (currently only `{id, name, shortName, color}`, around `sync.js:167-172`).
   When `fixturesSchedule` is constructed (`sync.js:184-207`), attach venue-matched
   `ownStrength`/`oppStrength` directly onto each fixture object (own team's strength in the venue
   they're playing; opponent's strength in the venue *they're* playing) — approved.
5. **Formula (`lib/predictionModel.js`)**: replace the `fdrMultiplier` step function with
   `multiplier = clamp(1.0 - (oppStrength - ownStrength) * K, 0.65, 1.30)` (K TBD during
   implementation, tuned to stay in the same conservative range the existing code already
   targets). **Drop the separate flat `homeAwayAdj` (±0.35) when strength data is available** —
   since `ownStrength`/`oppStrength` are already venue-specific, keeping the flat term on top would
   double-count home advantage. Keep the old diff-based step function + flat home/away term as a
   fallback path only if strength data is ever missing — approved. Concretely verified this
   produces a *different* read than the pure `diff` field for at least one real fixture (Arsenal
   away at Aston Villa GW2: FPL's official `diff` says hard/4, but `strength_overall_away`(ARS)=5 >
   `strength_overall_home`(AVL)=3 says easy) — approved, this disagreement between FPL's own two
   signals is exactly why this phase exists, not a sign of a mistake.
6. **`goalsConceded90` model**: clean sheets are a team-level event, so this isn't about giving
   teammates different CS *probability* for the same match. Instead: compute a league-wide average
   `goalsConceded90` (across GKP/DEF with meaningful minutes, computed dynamically each sync, not
   hardcoded) as a baseline. A player whose own `goalsConceded90` (already sample-size-blended in
   `sync.js`) is notably better than that baseline gets a small positive nudge to their CS-linked
   points; notably worse gets a small negative nudge. Deliberately small relative to the
   fixture-based `csAdj` so it differentiates teammates without overriding the team-level signal —
   approved.
7. **`getCleanSheetProb` gets the same treatment**: raised as a consistency point — if only
   `fdrMultiplier` moves to strength-based data and `getCleanSheetProb` stays diff-based, the
   attacking-points multiplier and the clean-sheet probability could disagree about the same
   fixture's difficulty (same inconsistency problem this phase exists to remove). Proposed
   extending the same strength-based continuous formula to `getCleanSheetProb` too (diff still kept
   for display only) — approved.
8. **`ticker.js` fix**: "Clean Sheet %" tab calls the real (now strength-based) `getCleanSheetProb`
   per team/fixture directly, replacing `CS_ODDS_LOOKUP`. "Projected Goals" tab: no existing
   team-level "expected goals" model exists to reuse, so add a small one — league-average
   goals-per-game baseline (computed dynamically from real season data, not hardcoded) adjusted by
   the same strength-gap multiplier from decision #5, replacing `PROJ_GOALS_LOOKUP` — approved.

### Open question, NOT yet answered (pick this up first on resume)

`ticker.js`'s `getFixtureForGw` (lines 83-105) has a *separate*, different hardcoded fallback: for
gameweeks beyond what `TICKER_DATA` covers, it synthesizes a fixture using hardcoded team-name
arrays to assign a fake `diff` (`if (["ARS","MCI","LIV"].includes(opp)) diff = 4...`). Since FPL
publishes the full 38-GW fixture list in advance and `TICKER_DATA` is built from that real data for
all 38 gameweeks, this fallback should rarely/never actually trigger — it's a defensive path, not
the primary display logic. **Asked the user whether to fix this too or leave it out of scope; no
answer yet when the usage limit hit.** Re-ask this, or use judgment (leaning toward "leave it
out of scope, it's dead-path defensive code, not user-visible in practice") if the user doesn't
have a strong preference.

### To resume

1. Re-open this conversation or start a fresh one with this file as context.
2. Re-ask (or resolve with judgment) the one open question above.
3. Continue the `brainstorming` skill process from where it left off: **write the design doc** to
   `docs/superpowers/specs/2026-08-11-phase3-fixture-difficulty-design.md` (all 8 decisions above
   are already user-approved and just need transcribing + the self-review checklist), commit it,
   have the user do a final review of the written file, then invoke `writing-plans` →
   `subagent-driven-development` (same process as Phases 1 and 2) → `finishing-a-development-branch`.
4. Manual-verification step for this phase should specifically re-check the Arsenal/Aston Villa
   GW2 case end-to-end once implemented, since it's the one concretely-verified example where the
   new formula is expected to disagree with the old one.

## Important context to carry forward (still applies)

### The Phase 1 production incident (don't repeat it)

Named ES imports of not-yet-existing `data.js` exports are a **hard build-time error** under
Vite/Rollup's static export validation — not runtime-catchable, `npm test` won't catch it. Always
use a namespace import (`import * as X from './data.js'`) for any field that might not exist in the
currently-committed `data.js` yet (e.g. right after a merge, before the next sync bakes a new field
in). Always run `npm run build`, not just `npm test`, before considering any `data.js`-schema-
touching change deploy-ready.

### Process discipline that's worked well across all phases so far

Subagent-driven-development (implementer → independent spec-compliance reviewer → independent
code-quality reviewer → fix loop, repeated per task) + a final holistic cross-file review before
finishing any branch + independent re-verification after any post-review fix pass. Every phase so
far has found at least one real bug this way that a single-pass review would have missed. Keep
doing this for Phase 3.

## Files worth reading first when resuming

1. This file.
2. `docs/xp-model-roadmap.md` — original phase roadmap (Phase 3's starting scope, before the
   ticker.js addition and the zero-strength-fields constraint were discovered).
3. `components/ticker.js` — the file with the two hardcoded lookup tables this phase also fixes.
4. `lib/predictionModel.js` — the formula being changed (`getCleanSheetProb`, `computeGwPrediction`).
5. `sync.js` around lines 152-213 — where `teamsList`/`fixturesSchedule` are built (Section 1/4's
   integration point).
