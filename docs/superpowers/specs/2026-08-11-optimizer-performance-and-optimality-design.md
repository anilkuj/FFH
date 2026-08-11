# AI Optimizer — Non-Blocking Progress + Correctness Improvements — Design Spec

_Written 2026-08-11._

## Problem

`components/optimizer.js`'s "AI Optimizer" feature has two related but distinct problems, both confirmed by direct investigation of the current implementation:

1. **No usable progress indication, and the page appears frozen while it runs.** A loading spinner and "AI Solver is analyzing player data..." message ARE already painted before the solve starts (`executeAnalysis`, around line 1049-1116), but the entire solve — `performOptimization` → `_performOptimizationWithFormation` (a single ~2700-line function) — runs as one fully synchronous call with no `async`, no `await`, no `Worker`, and no yield point back to the browser's event loop anywhere in the call stack. Once it starts, the main thread is blocked until it returns, so the spinner's CSS animation visually freezes and the message text never updates — indistinguishable from "no progress indication" even though the markup exists.

2. **The algorithm is a greedy-construct-then-local-search heuristic, not guaranteed to return the true optimal squad.** Confirmed via direct reading: the initial squad is built by a single-pass greedy fill (highest-expected-points player per slot, in slot order, never reconsidering earlier picks). Improvement passes ("optimize starting XI," "optimize bench," "pairwise upgrade") are first-improvement local search / hill-climbing, which is well-known to converge to a local optimum, not necessarily the global one — the code's own comments acknowledge this directly ("Escape local minima by checking pairs of slots," "best effort"). Additionally, the midseason ("respect free transfers") solver's 2-transfer search is conditioned on a pre-picked best single transfer rather than searching pairs independently, and — unlike every other pass in the file — has no candidate-pool cap, making it both incomplete (misses genuinely better pairs not involving the "best" single transfer) and the most likely single largest contributor to slow runtimes.

## Goals

- Make the optimizer's UI genuinely responsive while it runs: real phase-by-phase progress labels, an animating (not frozen) spinner, no "page unresponsive" risk.
- Meaningfully strengthen the algorithm's search quality — wider local-search coverage, a properly independent and properly-capped 2-transfer search — without attempting to become a provably-optimal exact solver (that tradeoff was explicitly considered and rejected: exact optimization over a ~700-player pool under budget/formation constraints would require integer programming and would very likely be *slower*, working against the performance goal).
- Cover both solver modes (preseason "unlimited transfers" and midseason "respect free transfers") — they have different correctness gaps and both matter.

## Non-goals

- Not building a provably-optimal exact solver (ILP/branch-and-bound). Explicitly considered and rejected — see Goals.
- Not moving computation to a Web Worker. The optimizer is currently entangled with `window.*` globals (e.g. `window.getPlayerMinutesFactor`) and other module-level state that a Worker can't access — extracting a fully pure, worker-safe computational core is a much bigger rebuild than this problem calls for. The chunked-async approach below solves the stated problems (responsiveness, progress feedback) without that rebuild.
- Not adding a cancel button. The async restructuring makes one easy to add later, but it wasn't requested — out of scope for this pass.
- Not reducing the algorithm's thoroughness to hit a specific time budget. That would directly work against the correctness goal; the async restructuring is what makes spending more wall-clock time on a better search acceptable (progress feedback keeps the user informed instead of staring at a frozen tab).

## Design

### 1. Non-blocking execution via chunked async yielding

Convert `performOptimization` and `_performOptimizationWithFormation` to `async` functions. Add a small helper:

```js
function yieldToEventLoop() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
```

Insert `await yieldToEventLoop()` at the boundary between each major phase of the solve, and update a phase-label element (a `<span>` inside the existing loading card, given an id so its `textContent` can be updated in place) immediately before each yield:

- "Scoring formations..." (only in "optimum formation" mode, before the 8x `_scoreOptimizationForFormation` loop)
- "Building initial squad..." (before the greedy slot-fill pass)
- "Optimizing starting XI..." (before the starting-XI local-search pass)
- "Optimizing bench..." (before the bench local-search pass)
- "Refining squad within budget..." (covers the bench-trim/fine-tune/bank-exhaustion passes — grouped under one label since they're all budget-adjustment mechanics a user doesn't need to distinguish)
- "Checking pairwise upgrades..." (before the "escape local minima" pairwise pass)
- Midseason mode only: "Checking single transfers..." (before the 1-transfer search), then "Checking double transfers..." (before the 2-transfer search)
- "Finalizing..." (before final safety/validation passes and rendering results)

`executeAnalysis`'s existing `setTimeout(() => { performOptimization(...) }, 50)` wrapper becomes unnecessary once `performOptimization` is itself async and yields early (the first phase's yield achieves the same "let the browser paint once before real work starts" effect) — replace it with a direct `await performOptimization(...)` call, keeping `executeAnalysis` itself `async`.

No data-access changes needed: because everything stays in the same module/scope (not moved to a Worker), all existing references to `PLAYERS`, `state`, `window.getPlayerMinutesFactor`, `_scoreCache`, etc. continue to work unmodified — only control flow changes (sync function → async function with yield points), not what the code touches.

### 2. Midseason 2-transfer search: independent, properly-capped search

Current behavior (confirmed via code reading, lines ~3499-3589): picks the best single transfer first (`best1Tx`), then only searches 2-transfer combinations built around/consistent with that pick, using uncapped `candidates1`/`candidates2` pools (only position/budget/must-exclude filtered, no top-N cap unlike every other pass in the file).

New behavior:
- Search sell-pairs × buy-candidate-pairs **independently** of whatever the 1-transfer search found — i.e., the 2-transfer search evaluates its own candidates on their own merits, not conditioned on `best1Tx`.
- Apply the same "elite pool" capping pattern already used in the pairwise-upgrade step (top-N candidates per position + a small number of cheap fallbacks) to `candidates1`/`candidates2`, so this search is bounded the same way every other pass in the file already is — this is both a correctness fix (no longer silently missing pairs that don't involve the "best" single pick) and very likely the main performance fix (removes the one unbounded hotspot).
- After both searches complete, compare the best 1-transfer result against the best (now-independent) 2-transfer result on equal footing (same scoring function, same horizon) and return whichever genuinely scores higher — not "2-transfer options that build on the 1-transfer pick."

### 3. Preseason mode: widen local-search coverage

The "escape local minima" pairwise-upgrade pass currently samples from a capped top-16-per-position "elite" pool (plus up to 4 cheap fallbacks) and runs at most 3 iterations (`while (pairwiseImproved && pairwiseIter < 3)`).

Since the async restructuring removes the "must finish before the tab looks frozen" constraint, widen this:
- Elite pool cap: 16 → 30 candidates per position (plus the existing cheap-fallback allowance, unchanged).
- Iteration cap: 3 → 6.

These are reasonable starting points, not something provable as "correct" — the explicit goal (per the approved design direction) is a meaningfully better heuristic, not a formally optimal one. If real usage shows these bounds are still too narrow or unnecessarily wide, they're easy to retune later; this isn't locking in a permanent architecture, just adjusting existing bounded-search parameters.

Not adding a new search mechanism (e.g. a triple-slot swap pass) — widening the existing, already-understood pairwise mechanism is a smaller, lower-risk change than introducing new search logic, consistent with not over-building beyond what's needed.

## Testing

- **`yieldToEventLoop` and the phase-label sequencing**: no dedicated unit test (trivial one-line helper, and the sequencing is UI-coupled) — verified manually in the browser: run an optimization, confirm phase labels visibly change in order, confirm the spinner animates continuously (doesn't freeze), confirm the page remains scrollable/responsive during the solve (e.g. can scroll the page while it's running).
- **2-transfer search independence + capping fix**: if this logic can be cleanly extracted into a standalone function that takes a squad/candidate-pool shape and returns the best transfer combination + score (without touching the DOM), extract it and give it real `node:test` unit tests — e.g., a synthetic case where the best 2-transfer combination does NOT involve either player from the best 1-transfer combination, confirming the new independent search finds it (the current conditioned search would miss it). If it can't be cleanly extracted without a disproportionate refactor of surrounding DOM-coupled code, fall back to manual verification with a constructed scenario in the browser.
- **Preseason widened local search**: manual verification — run the preseason/wildcard solver on a few real squad configurations, confirm it still terminates in a reasonable time (the widened bounds are still bounded, not unbounded) and that results are at least as good as before the widening (never worse, since it's still first-improvement local search — a wider search can only find more improvements, not lose ones the narrower search already had).
- **No regression in existing behavior**: run the optimizer in both modes (preseason and midseason), both regular and "optimum formation" mode, and confirm it still produces a valid squad (budget respected, formation respected, team-count ≤ 3, must-include/exclude respected) — matching the existing (unwritten but implicit) correctness contract, not just the new changes.
