# AI Optimizer — Non-Blocking Progress + Correctness Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI Optimizer's solve responsive (real phase-by-phase progress instead of a frozen spinner) and meaningfully strengthen its search quality, without attempting a provably-optimal exact solver.

**Architecture:** Convert the solver's call chain (`executeAnalysis` → `performOptimization` → `_performOptimizationWithFormation`) to `async` functions that periodically `await` a zero-delay yield back to the browser's event loop at each major phase boundary, updating a phase-label element each time. Fix the midseason 2-transfer search to be an independent, properly-capped search rather than one conditioned on a pre-picked single transfer. Widen the preseason mode's local-search bounds now that there's no "must finish before the tab looks frozen" pressure.

**Tech Stack:** Vanilla JS, no framework, no build-time changes needed.

---

## Before you start

`components/optimizer.js` is a 4062-line file with no existing unit tests (UI-driving code, tightly coupled to DOM rendering) — this matches the rest of the codebase's convention of only unit-testing pure `lib/*.js` logic. Task 2 extracts one piece of pure, testable logic; everything else in this plan is verified manually in the browser.

Read the design spec first if anything here needs more context: `docs/superpowers/specs/2026-08-11-optimizer-performance-and-optimality-design.md`.

---

### Task 1: Non-blocking execution with phase-by-phase progress labels

**Files:**
- Modify: `components/optimizer.js`

This task converts the solver's call chain to `async`/`await` and inserts 10 yield-and-label-update points at the boundaries between major phases. Each insertion follows the same pattern: update the phase-label text, then `await` a zero-delay yield, immediately before that phase's work begins.

- [ ] **Step 1: Add the two helper functions**

Modify `components/optimizer.js` — add near the top of the file, after the existing imports (before `export function getPlayerSetPieceDuty` at line 128):

```js
function yieldToEventLoop() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function updateOptimizerPhase(resultsGrid, text) {
    const label = resultsGrid.querySelector('#optimizerPhaseLabel');
    if (label) label.textContent = text;
}
```

- [ ] **Step 2: Give the loading card's label an id so it can be updated later**

Modify `components/optimizer.js` — in the `executeAnalysis` function, find the loading-card HTML (around line 1108-1114):

Old:
```js
        resultsGrid.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; gap: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px;">
                <i data-lucide="loader" class="animate-spin" style="color: var(--primary); width: 32px; height: 32px;"></i>
                <span style="font-weight: 700; color: var(--text-main); font-size: 15px;">AI Solver is analyzing player data...</span>
                <span style="color: var(--text-muted); font-size: 12px;">Running expected points projections and fixture constraints</span>
            </div>
        `;
```

New:
```js
        resultsGrid.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; gap: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px;">
                <i data-lucide="loader" class="animate-spin" style="color: var(--primary); width: 32px; height: 32px;"></i>
                <span id="optimizerPhaseLabel" style="font-weight: 700; color: var(--text-main); font-size: 15px;">AI Solver is analyzing player data...</span>
                <span style="color: var(--text-muted); font-size: 12px;">Running expected points projections and fixture constraints</span>
            </div>
        `;
```

- [ ] **Step 3: Make `executeAnalysis` async and remove the setTimeout wrapper**

Modify `components/optimizer.js` — find where `executeAnalysis` is declared and where it calls `performOptimization` (around line 1049 and 1118-1135):

Old:
```js
    let isExecuting = false;
    const executeAnalysis = () => {
        if (isExecuting) return;
        isExecuting = true;
```

New:
```js
    let isExecuting = false;
    const executeAnalysis = async () => {
        if (isExecuting) return;
        isExecuting = true;
```

Then, further down in the same function:

Old:
```js
        setTimeout(() => {
            try {
                performOptimization(resultsGrid, state, actions, horizon, mode);
                updateActivePills(horizon, mode);
                toggleSettingsBody(true); // Gently collapse form so results are focal, while preserving form DOM
                setTimeout(() => resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            } catch (err) {
                console.error("AI Optimizer Execution Error:", err);
                actions.showToast("Optimizer notice: " + (err.message || "Optimization complete"), "warning");
            } finally {
                runBtn.disabled = false;
                if (reRunInBodyBtn) reRunInBodyBtn.disabled = false;
                runBtn.innerHTML = `<i data-lucide="play-circle"></i> Re-run Analysis`;
                if (reRunInBodyBtn) reRunInBodyBtn.innerHTML = `<i data-lucide="play-circle"></i> Re-run Analysis`;
                lucide.createIcons();
                isExecuting = false;
            }
        }, 50);
    };
```

New:
```js
        try {
            await performOptimization(resultsGrid, state, actions, horizon, mode);
            updateActivePills(horizon, mode);
            toggleSettingsBody(true); // Gently collapse form so results are focal, while preserving form DOM
            setTimeout(() => resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        } catch (err) {
            console.error("AI Optimizer Execution Error:", err);
            actions.showToast("Optimizer notice: " + (err.message || "Optimization complete"), "warning");
        } finally {
            runBtn.disabled = false;
            if (reRunInBodyBtn) reRunInBodyBtn.disabled = false;
            runBtn.innerHTML = `<i data-lucide="play-circle"></i> Re-run Analysis`;
            if (reRunInBodyBtn) reRunInBodyBtn.innerHTML = `<i data-lucide="play-circle"></i> Re-run Analysis`;
            lucide.createIcons();
            isExecuting = false;
        }
    };
```

- [ ] **Step 4: Make `performOptimization` async, add the "Scoring formations..." phase, and await the solver calls**

Modify `components/optimizer.js` — find `performOptimization` (line 1166):

Old:
```js
function performOptimization(resultsGrid, state, actions, horizon, mode) {
    // If 'optimum' formation: score each formation with top-starter expected points,
    // then temporarily set state.formation to the winner before running the real solver.
    if (state.formation === 'optimum') {
        const originalFormation = 'optimum';
        let bestFormation = '3-5-2';
        let bestScore = -Infinity;

        for (const formation of ALL_FORMATIONS) {
            state.formation = formation;
            const score = _scoreOptimizationForFormation(state, horizon, mode);
            if (score > bestScore) {
                bestScore = score;
                bestFormation = formation;
            }
        }

        state.formation = originalFormation;
        _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, bestFormation, true);
        return;
    }

    _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, state.formation, false);
}
```

New:
```js
async function performOptimization(resultsGrid, state, actions, horizon, mode) {
    // If 'optimum' formation: score each formation with top-starter expected points,
    // then temporarily set state.formation to the winner before running the real solver.
    if (state.formation === 'optimum') {
        const originalFormation = 'optimum';
        let bestFormation = '3-5-2';
        let bestScore = -Infinity;

        updateOptimizerPhase(resultsGrid, 'Scoring formations...');
        await yieldToEventLoop();

        for (const formation of ALL_FORMATIONS) {
            state.formation = formation;
            const score = _scoreOptimizationForFormation(state, horizon, mode);
            if (score > bestScore) {
                bestScore = score;
                bestFormation = formation;
            }
        }

        state.formation = originalFormation;
        await _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, bestFormation, true);
        return;
    }

    await _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, state.formation, false);
}
```

- [ ] **Step 5: Make `_performOptimizationWithFormation` async**

Modify `components/optimizer.js` — find the function declaration (line 1325):

Old:
```js
function _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, chosenFormation, isOptimumMode) {
```

New:
```js
async function _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, chosenFormation, isOptimumMode) {
```

- [ ] **Step 6: Insert "Building initial squad..." before the greedy fill (preseason mode)**

Modify `components/optimizer.js` — find this comment (line 1943):

Old:
```js
        // Initialize starting slots with budget-constrained top-scoring guaranteed starters
        let runningStartingCost = 0;
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Building initial squad...');
        await yieldToEventLoop();

        // Initialize starting slots with budget-constrained top-scoring guaranteed starters
        let runningStartingCost = 0;
```

- [ ] **Step 7: Insert "Optimizing starting XI..." before that pass**

Modify `components/optimizer.js` — find (line 2237):

Old:
```js
        // --- OPTIMIZE STARTING 11 ---
        let startingImproved = true;
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Optimizing starting XI...');
        await yieldToEventLoop();

        // --- OPTIMIZE STARTING 11 ---
        let startingImproved = true;
```

- [ ] **Step 8: Insert "Optimizing bench..." before that pass**

Modify `components/optimizer.js` — find (line 2412, immediately after `resolveBenchDuplicates();`):

Old:
```js
        // Ensure bench is clean and has no duplicates before starting bench optimization
        resolveBenchDuplicates();

        // --- OPTIMIZE BENCH ---
        const startingCost = startingIndices.reduce((sum, sIdx) => {
```

New:
```js
        // Ensure bench is clean and has no duplicates before starting bench optimization
        resolveBenchDuplicates();

        updateOptimizerPhase(resultsGrid, 'Optimizing bench...');
        await yieldToEventLoop();

        // --- OPTIMIZE BENCH ---
        const startingCost = startingIndices.reduce((sum, sIdx) => {
```

- [ ] **Step 9: Insert "Refining squad within budget..." before the budget-adjustment cascade**

Modify `components/optimizer.js` — find (line 2512, right after the bench-optimize `while` loop closes):

Old:
```js
                if (bestCandidate) {
                    currentSlot.playerId = bestCandidate.id;
                    benchImproved = true;
                }
            }
        }

        // --- HARD BENCH BUDGET SAFETY ENFORCER ---
        let currentBenchCost = benchIndices.reduce((sum, bIdx) => {
```

New:
```js
                if (bestCandidate) {
                    currentSlot.playerId = bestCandidate.id;
                    benchImproved = true;
                }
            }
        }

        updateOptimizerPhase(resultsGrid, 'Refining squad within budget...');
        await yieldToEventLoop();

        // --- HARD BENCH BUDGET SAFETY ENFORCER ---
        let currentBenchCost = benchIndices.reduce((sum, bIdx) => {
```

- [ ] **Step 10: Insert "Checking pairwise upgrades..." before that pass**

Modify `components/optimizer.js` — find (line 2781):

Old:
```js
        // --- PAIRWISE DOUBLE-UPGRADE STEP ---
        // Escape local minima by checking pairs of slots and swapping them with elite candidates
        let pairwiseImproved = true;
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Checking pairwise upgrades...');
        await yieldToEventLoop();

        // --- PAIRWISE DOUBLE-UPGRADE STEP ---
        // Escape local minima by checking pairs of slots and swapping them with elite candidates
        let pairwiseImproved = true;
```

- [ ] **Step 11: Insert "Finalizing..." before the preseason mode's last safety pass**

Modify `components/optimizer.js` — find (line 3041):

Old:
```js
        // --- FINAL HARD BENCH BUDGET SAFETY ENFORCER ---
        // Runs after ALL optimization passes to guarantee bench cost never exceeds the user's bench budget.
        // This catches any bench upgrades that slipped through the pairwise or fine-tune passes.
        {
            let finalBenchCost = benchIndices.reduce((sum, bIdx) => {
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Finalizing...');
        await yieldToEventLoop();

        // --- FINAL HARD BENCH BUDGET SAFETY ENFORCER ---
        // Runs after ALL optimization passes to guarantee bench cost never exceeds the user's bench budget.
        // This catches any bench upgrades that slipped through the pairwise or fine-tune passes.
        {
            let finalBenchCost = benchIndices.reduce((sum, bIdx) => {
```

- [ ] **Step 12: Insert "Checking single transfers..." before the midseason 1-transfer search**

Modify `components/optimizer.js` — find (line 3438):

Old:
```js
        // --- FIND BEST 1-TRANSFER OPTION ---
        let best1Tx = null;
        let maxGain1 = -999;
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Checking single transfers...');
        await yieldToEventLoop();

        // --- FIND BEST 1-TRANSFER OPTION ---
        let best1Tx = null;
        let maxGain1 = -999;
```

- [ ] **Step 13: Insert "Checking double transfers..." before the midseason 2-transfer search**

Modify `components/optimizer.js` — find (line 3499, this exact comment appears once in the file):

Old:
```js
        // --- FIND BEST 2-TRANSFER OPTION ---
        // IMPORTANT: The double transfer must be coherent with the single transfer.
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Checking double transfers...');
        await yieldToEventLoop();

        // --- FIND BEST 2-TRANSFER OPTION ---
```

Note: Task 2 (next task) rewrites the body of this section, including removing the "must be coherent with the single transfer" comment (that constraint is exactly what Task 2 removes) — so don't worry about preserving that specific comment line here; Task 2's diff handles it.

- [ ] **Step 14: Insert "Finalizing..." before the midseason mode's results are rendered**

Modify `components/optimizer.js` — find (line 3591-3592, right after the 2-transfer search's closing braces, before the 1-GW gain calculation):

Old:
```js
        // Calculate 1-GW expected points gains for display comparison
        let best1Tx1GwGain = 0;
```

New:
```js
        updateOptimizerPhase(resultsGrid, 'Finalizing...');
        await yieldToEventLoop();

        // Calculate 1-GW expected points gains for display comparison
        let best1Tx1GwGain = 0;
```

- [ ] **Step 15: Syntax-check**

Run: `node --check components/optimizer.js`
Expected: no output (valid syntax — confirms the `async`/`await` additions and all 10 insertions parse correctly)

- [ ] **Step 16: Manual browser verification**

Run: `npm run dev` (or use the project's preview tooling), open the app, navigate to the AI Optimizer tab.

Click "Run Analysis" (or "Re-run Analysis") in both preseason and midseason modes (switch the phase selector between runs), and in both regular and "optimum formation" mode. For each run, confirm:
- The spinner icon visibly keeps spinning throughout (not frozen).
- The phase label text visibly changes at least 3-4 times during a single run (confirms multiple yield points are actually being hit, not just the first one).
- The page remains responsive during the run — e.g. you can scroll the page while it's computing.
- A valid squad is still returned at the end (this task only adds yield points and async plumbing, it doesn't change any scoring/selection logic, so results should be identical to before this task, just delivered with visible progress instead of a frozen page).

- [ ] **Step 17: Commit**

```bash
git add components/optimizer.js
git commit -m "feat: non-blocking optimizer execution with phase-by-phase progress"
```

---

### Task 2: Independent, properly-capped 2-transfer search

**Files:**
- Modify: `components/optimizer.js`

Currently the 2-transfer search is conditioned on the pre-picked best single transfer (`best1Tx`) and has no candidate-pool cap, unlike every other search pass in the file. This task makes it search independently and applies the same "elite pool" capping pattern already used in the pairwise-upgrade step (Task 1's Step 10 context, `getEliteCandidates`).

- [ ] **Step 1: Replace the 2-transfer search body**

Modify `components/optimizer.js` — find the full "FIND BEST 2-TRANSFER OPTION" block (after Task 1's Step 13 change, this starts right after the `await yieldToEventLoop();` you just added). Replace from `// --- FIND BEST 2-TRANSFER OPTION ---` through the block's closing `}` (originally lines 3499-3589, now shifted down by Task 1's insertions — locate it by the unique comment text, not by line number):

Old:
```js
        // --- FIND BEST 2-TRANSFER OPTION ---
        // IMPORTANT: The double transfer must be coherent with the single transfer.
        // We must NOT suggest selling a player we just recommended buying (single IN),
        // and we must NOT suggest buying back a player we just recommended selling (single OUT).
        const single1TxInId  = best1Tx ? best1Tx.in.id  : null; // player recommended to BUY in single
        const single1TxOutId = best1Tx ? best1Tx.out.id : null; // player recommended to SELL in single

        let best2Tx = null;
        let maxGain2 = -999;

        for (let i = 0; i < candidateSoldIds.length; i++) {
            for (let j = i + 1; j < candidateSoldIds.length; j++) {
                const s1 = PLAYERS.find(p => p.id === candidateSoldIds[i]);
                const s2 = PLAYERS.find(p => p.id === candidateSoldIds[j]);

                if (!s1 || !s2) continue;

                // Cannot sell a player who is the single-transfer "buy" recommendation
                // (they're not in the squad yet — this would be incoherent)
                if (s1.id === single1TxInId || s2.id === single1TxInId) continue;

                const sellBudget = s1.price + s2.price + bank;

                let candidates1 = PLAYERS.filter(p => 
                    p.position === s1.position && 
                    !currentSquadIds.includes(p.id) &&
                    !state.mustExclude.includes(p.id) &&
                    p.id !== single1TxOutId &&
                    (p.position !== 'FWD' || p.price >= (state.minFwdPrice ?? 6.0) || (state.mustInclude && state.mustInclude.includes(p.id)))
                );
                const g1 = candidates1.filter(p => isGuaranteedStart(p, state));
                if (g1.length > 0) candidates1 = g1;

                const mustIncludeNotInSquad1 = state.mustInclude.filter(id => 
                    !currentSquadIds.includes(id) && 
                    PLAYERS.find(pl => pl.id === id)?.position === s1.position
                );
                if (mustIncludeNotInSquad1.length > 0) {
                    candidates1 = candidates1.filter(p => mustIncludeNotInSquad1.includes(p.id));
                }

                let candidates2 = PLAYERS.filter(p => 
                    p.position === s2.position && 
                    !currentSquadIds.includes(p.id) &&
                    !state.mustExclude.includes(p.id) &&
                    p.id !== single1TxOutId &&
                    (p.position !== 'FWD' || p.price >= (state.minFwdPrice ?? 6.0) || (state.mustInclude && state.mustInclude.includes(p.id)))
                );
                const g2 = candidates2.filter(p => isGuaranteedStart(p, state));
                if (g2.length > 0) candidates2 = g2;

                const mustIncludeNotInSquad2 = state.mustInclude.filter(id => 
                    !currentSquadIds.includes(id) && 
                    PLAYERS.find(pl => pl.id === id)?.position === s2.position
                );
                if (mustIncludeNotInSquad2.length > 0) {
                    candidates2 = candidates2.filter(p => mustIncludeNotInSquad2.includes(p.id));
                }

                for (const b1 of candidates1) {
                    for (const b2 of candidates2) {
                        if (b1.id === b2.id) continue;
                        if (b1.price + b2.price > sellBudget) continue;
                        if (!checkTeamConstraintsDouble(currentSquadIds, s1.id, s2.id, b1.id, b2.id)) continue;

                        // Calculate squad gain
                        const tempSlots = JSON.parse(JSON.stringify(activeSquadSlots));
                        const slot1 = tempSlots.find(s => s.playerId === s1.id);
                        const slot2 = tempSlots.find(s => s.playerId === s2.id);
                        if (slot1) slot1.playerId = b1.id;
                        if (slot2) slot2.playerId = b2.id;

                        if (!isBenchBudgetOk(tempSlots)) continue;

                        const solveGain = getSquadExpectedPts(tempSlots, true) - getSquadExpectedPts(activeSquadSlots, true);
                        const realGain = getSquadExpectedPts(tempSlots, false) - getSquadExpectedPts(activeSquadSlots, false);

                        if (solveGain > maxGain2 && solveGain > 0.01) {
                            maxGain2 = solveGain;
                            best2Tx = {
                                out1: s1,
                                out2: s2,
                                in1: b1,
                                in2: b2,
                                gain: realGain
                            };
                        }
                    }
                }
            }
        }
```

New:
```js
        // --- FIND BEST 2-TRANSFER OPTION ---
        // Searched independently of the single-transfer pick (best1Tx) -- a 2-transfer search
        // conditioned on "must be coherent with whichever single transfer scored highest" can miss
        // a genuinely better pair that doesn't involve that specific player at all. The only
        // remaining coherence rule is a mechanical one: don't sell a player at the same time as
        // buying them (checked below via `s1.id === b1.id` etc., which is already impossible since
        // candidates exclude currentSquadIds -- kept here as a defensive no-op comment, not logic).
        //
        // Candidate pools are capped to a top-N "elite" set per position (same pattern as the
        // preseason pairwise-upgrade step's getEliteCandidates), so this stays a genuine, bounded
        // search instead of the previous uncapped nested loop over the full position pool.
        const getTransferEliteCandidates = (pos) => {
            // Note: no separate exclusion for "the other player in this sell-pair" is needed --
            // both s1 and s2 are already in currentSquadIds (they're being sold FROM the current
            // squad), so the existing !currentSquadIds.includes(p.id) filter already rules out
            // buying either one back as part of the same 2-transfer combination.
            let list = PLAYERS.filter(p =>
                p.position === pos &&
                !currentSquadIds.includes(p.id) &&
                !state.mustExclude.includes(p.id) &&
                (p.position !== 'FWD' || p.price >= (state.minFwdPrice ?? 6.0) || (state.mustInclude && state.mustInclude.includes(p.id)))
            );
            const guaranteed = list.filter(p => isGuaranteedStart(p, state));
            if (guaranteed.length > 0) list = guaranteed;
            return list.sort((a, b) => getSolverScore(b) - getSolverScore(a)).slice(0, 20);
        };

        let best2Tx = null;
        let maxGain2 = -999;

        for (let i = 0; i < candidateSoldIds.length; i++) {
            for (let j = i + 1; j < candidateSoldIds.length; j++) {
                const s1 = PLAYERS.find(p => p.id === candidateSoldIds[i]);
                const s2 = PLAYERS.find(p => p.id === candidateSoldIds[j]);

                if (!s1 || !s2) continue;

                const sellBudget = s1.price + s2.price + bank;

                let candidates1 = getTransferEliteCandidates(s1.position);
                const mustIncludeNotInSquad1 = state.mustInclude.filter(id =>
                    !currentSquadIds.includes(id) &&
                    PLAYERS.find(pl => pl.id === id)?.position === s1.position
                );
                if (mustIncludeNotInSquad1.length > 0) {
                    candidates1 = candidates1.filter(p => mustIncludeNotInSquad1.includes(p.id));
                }

                let candidates2 = getTransferEliteCandidates(s2.position);
                const mustIncludeNotInSquad2 = state.mustInclude.filter(id =>
                    !currentSquadIds.includes(id) &&
                    PLAYERS.find(pl => pl.id === id)?.position === s2.position
                );
                if (mustIncludeNotInSquad2.length > 0) {
                    candidates2 = candidates2.filter(p => mustIncludeNotInSquad2.includes(p.id));
                }

                for (const b1 of candidates1) {
                    for (const b2 of candidates2) {
                        if (b1.id === b2.id) continue;
                        if (b1.price + b2.price > sellBudget) continue;
                        if (!checkTeamConstraintsDouble(currentSquadIds, s1.id, s2.id, b1.id, b2.id)) continue;

                        // Calculate squad gain
                        const tempSlots = JSON.parse(JSON.stringify(activeSquadSlots));
                        const slot1 = tempSlots.find(s => s.playerId === s1.id);
                        const slot2 = tempSlots.find(s => s.playerId === s2.id);
                        if (slot1) slot1.playerId = b1.id;
                        if (slot2) slot2.playerId = b2.id;

                        if (!isBenchBudgetOk(tempSlots)) continue;

                        const solveGain = getSquadExpectedPts(tempSlots, true) - getSquadExpectedPts(activeSquadSlots, true);
                        const realGain = getSquadExpectedPts(tempSlots, false) - getSquadExpectedPts(activeSquadSlots, false);

                        if (solveGain > maxGain2 && solveGain > 0.01) {
                            maxGain2 = solveGain;
                            best2Tx = {
                                out1: s1,
                                out2: s2,
                                in1: b1,
                                in2: b2,
                                gain: realGain
                            };
                        }
                    }
                }
            }
        }
```

Note what changed: removed the `single1TxInId`/`single1TxOutId` exclusion logic (the independence fix), removed the "cannot sell the single-transfer buy recommendation" skip (no longer applicable since this search doesn't reference `best1Tx` at all), and replaced the uncapped `PLAYERS.filter(...)` candidate-pool construction with the new capped `getTransferEliteCandidates` helper (the capping fix). The final comparison between `best1Tx` and `best2Tx` (already existing further down in the file, in the "Calculate 1-GW expected points gains" and rendering section) is untouched — it already picks whichever genuinely scores higher, so no change needed there.

- [ ] **Step 2: Syntax-check**

Run: `node --check components/optimizer.js`
Expected: no output

- [ ] **Step 3: Manual verification — construct a case where the independent search matters**

This is the one piece of this plan worth a real regression check, since it's a genuine behavior change (not just a progress-UI addition). In the browser, with the AI Optimizer in midseason mode:

1. Note the current best 1-transfer suggestion and best 2-transfer suggestion for your squad.
2. Confirm the 2-transfer suggestion no longer necessarily avoids the exact player the 1-transfer suggestion recommended buying (previously it was hard-excluded from 2-transfer candidates; now it's a legitimate candidate in its own right, since the two searches are independent). This is the direct, observable sign the independence fix is live.
3. Confirm the app still shows a coherent comparison between the 1-transfer and 2-transfer options (whichever scores higher is presented as the recommendation) — this logic already existed and this task doesn't touch it, just confirm it still works with the new search feeding it.

- [ ] **Step 4: Commit**

```bash
git add components/optimizer.js
git commit -m "fix: search 2-transfer options independently of the 1-transfer pick, with capped candidate pools"
```

---

### Task 3: Widen preseason mode's local-search bounds

**Files:**
- Modify: `components/optimizer.js`

- [ ] **Step 1: Widen the pairwise-upgrade elite pool and iteration cap**

Modify `components/optimizer.js` — find the `getEliteCandidates` function inside the pairwise-upgrade step:

Old:
```js
            const getEliteCandidates = (pos) => {
                let list = PLAYERS.filter(p => 
                    p.position === pos &&
                    !state.mustExclude.includes(p.id) &&
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                );
                if (pos === 'GKP') {
                    list = list.filter(p => p.price >= 4.5 || isGuaranteedStart(p, state));
                }
                return list.sort((a, b) => getSolverScore(b) - getSolverScore(a))
                 .slice(0, 16);
            };
```

New:
```js
            const getEliteCandidates = (pos) => {
                let list = PLAYERS.filter(p => 
                    p.position === pos &&
                    !state.mustExclude.includes(p.id) &&
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                );
                if (pos === 'GKP') {
                    list = list.filter(p => p.price >= 4.5 || isGuaranteedStart(p, state));
                }
                // Widened from 16 to 30: the async restructuring (see the non-blocking-execution
                // task) removed the "must finish before the tab looks frozen" pressure that
                // originally motivated a narrow cap, so this pass can afford to consider more
                // candidates per position without hurting the user experience.
                return list.sort((a, b) => getSolverScore(b) - getSolverScore(a))
                 .slice(0, 30);
            };
```

And the iteration cap just above it:

Old:
```js
        // --- PAIRWISE DOUBLE-UPGRADE STEP ---
        // Escape local minima by checking pairs of slots and swapping them with elite candidates
        let pairwiseImproved = true;
        let pairwiseIter = 0;
        
        while (pairwiseImproved && pairwiseIter < 3) {
```

New:
```js
        // --- PAIRWISE DOUBLE-UPGRADE STEP ---
        // Escape local minima by checking pairs of slots and swapping them with elite candidates
        let pairwiseImproved = true;
        let pairwiseIter = 0;
        
        while (pairwiseImproved && pairwiseIter < 6) {
```

(Note: this `while` line's context now includes the `updateOptimizerPhase`/`await yieldToEventLoop()` lines added by Task 1's Step 10 immediately above it — match on the `while (pairwiseImproved && pairwiseIter < 3)` line itself, which is unique in the file.)

- [ ] **Step 2: Syntax-check**

Run: `node --check components/optimizer.js`
Expected: no output

- [ ] **Step 3: Manual verification**

In the browser, run the AI Optimizer in preseason mode on a real squad configuration:
- Confirm it still completes in a reasonable time (the widened bounds are still bounded — 30 candidates × up to 6 iterations, not unbounded).
- Confirm the resulting squad's total expected points is at least as good as before this change (never worse — this is still first-improvement local search, so a wider search can only find more improving swaps, not lose ones the narrower search already found).

- [ ] **Step 4: Commit**

```bash
git add components/optimizer.js
git commit -m "feat: widen preseason mode's pairwise local-search bounds"
```

---

### Task 4: Final manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full syntax check**

Run: `node --check components/optimizer.js`
Expected: no output

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds, no new errors or warnings introduced by this branch's changes.

- [ ] **Step 3: End-to-end browser verification across all 4 mode combinations**

Run the AI Optimizer for each combination of {preseason, midseason} × {a specific formation, "optimum formation"}. For each:
- Confirm the spinner animates and phase labels visibly change throughout (not frozen).
- Confirm a valid squad is returned (budget respected, formation respected, team-count ≤ 3 per club, must-include/exclude respected if configured).
- Confirm the page stays responsive throughout (can scroll during the run).

- [ ] **Step 4: Report status**

Summarize: build status, and confirmation that all 4 mode combinations were manually verified with visible progress feedback and valid results. This branch is ready for the same `finishing-a-development-branch` flow used for prior phases (present options → push/PR → merge → confirm Railway redeploy → re-run `npm run build` explicitly).
