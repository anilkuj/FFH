import { PLAYERS, TEAMS } from '../data.js';

export function renderOptimizer(container, state, actions) {
    // Premium Lock Check
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    const squadInfo = state.getSquadForGw(state.currentGw);
    const { freeTransfers } = squadInfo;

    container.innerHTML = `
        <div class="optimizer-view-container">
            <div class="optimizer-intro">
                <div class="intro-text-area">
                    <h2>AI Transfer & Squad Optimizer</h2>
                    <p>Our machine learning solvers analyze fixture difficulties, clean sheet probabilities, and projected goals to recommend the highest expected points squad.</p>
                </div>
            </div>
            
            <div class="optimizer-settings-card">
                <h3><i data-lucide="settings" style="color: var(--primary); margin-right: 8px;"></i> Optimization Settings</h3>
                <div class="settings-form-grid" style="margin-top: 16px;">
                    <div class="setting-group">
                        <label for="gwHorizon">Gameweek Horizon</label>
                        <select id="gwHorizon" class="settings-select">
                            <option value="1">1 Gameweek (Short-term)</option>
                            <option value="3" selected>3 Gameweeks (Recommended)</option>
                            <option value="5">5 Gameweeks (Long-term)</option>
                        </select>
                        <span class="setting-help">Analyze fixtures and expected points over this horizon.</span>
                    </div>

                    <div class="setting-group">
                        <label for="seasonPhase">Season Mode</label>
                        <select id="seasonPhase" class="settings-select">
                            <option value="preseason" ${state.currentGw === 1 ? 'selected' : ''}>Preseason Mode (Unlimited Transfers)</option>
                            <option value="midseason" ${state.currentGw > 1 ? 'selected' : ''}>Midseason Mode (Respect Free Transfers)</option>
                        </select>
                        <span class="setting-help" id="phaseHelpText">Respects FPL rules.</span>
                    </div>
                </div>
                <button class="run-optimization-btn" id="runOptBtn" style="margin-top: 20px; width: 100%; justify-content: center;">
                    <i data-lucide="play-circle"></i> Run AI Analysis
                </button>
            </div>
            
            <div class="optimization-results-grid hidden" id="optResultsGrid">
                <!-- Recommendations will be populated here -->
            </div>
        </div>
    `;

    lucide.createIcons();

    const runBtn = container.querySelector('#runOptBtn');
    const resultsGrid = container.querySelector('#optResultsGrid');
    const phaseSelect = container.querySelector('#seasonPhase');
    const helpText = container.querySelector('#phaseHelpText');

    const updateHelpText = () => {
        if (phaseSelect.value === 'preseason') {
            helpText.textContent = `Allows unlimited squad upgrades within total squad budget. Perfect for preseason/wildcard planning.`;
        } else {
            const currentFt = state.currentGw === 1 ? 'Unlimited' : freeTransfers;
            helpText.textContent = `Respects your available free transfers (${currentFt} FT) for GW${state.currentGw} to avoid points hits.`;
        }
    };

    phaseSelect.addEventListener('change', updateHelpText);
    updateHelpText();

    runBtn.addEventListener('click', () => {
        runBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="margin-right: 8px;"></i> Running AI Solver...`;
        lucide.createIcons();

        const horizon = parseInt(container.querySelector('#gwHorizon').value);
        const mode = phaseSelect.value;

        setTimeout(() => {
            runBtn.innerHTML = `<i data-lucide="check-circle" style="margin-right: 8px;"></i> Optimization Complete`;
            resultsGrid.classList.remove('hidden');
            performOptimization(resultsGrid, state, actions, horizon, mode);
            lucide.createIcons();
        }, 1200);
    });
}

function renderLockOverlay(container, actions) {
    container.innerHTML = `
        <div class="premium-overlay-container">
            <div class="premium-lock-overlay">
                <div class="lock-card">
                    <div class="lock-icon-wrapper">
                        <i data-lucide="lock" style="width: 32px; height: 32px;"></i>
                    </div>
                    <h3 class="lock-title">AI Optimizer Locked</h3>
                    <p class="lock-desc">Unlock our advanced machine learning transfer planner. Pro members get weekly optimal 1-transfer and 2-transfer combinations calculated using OPTA-expected points models.</p>
                    <button class="lock-cta-btn" id="lockUpgradeBtn">Upgrade to Pro Now</button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();

    container.querySelector('#lockUpgradeBtn').addEventListener('click', () => {
        actions.switchTab('dashboard');
    });
}

function performOptimization(resultsGrid, state, actions, horizon, mode) {
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { starters, bench, bank } = squadInfo;
    const currentSquadIds = [...starters, ...bench];

    // Helper: expected points over horizon
    const getExpectedPts = (player) => {
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) sum += pred.pts;
        }
        return sum;
    };

    // Helper: FDR (average fixture difficulty)
    const getAvgFDR = (player) => {
        let sum = 0;
        let count = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred && pred.opp !== 'BYE') {
                sum += pred.diff;
                count++;
            }
        }
        return count > 0 ? (sum / count).toFixed(1) : '3.0';
    };

    // Helper: Clean Sheet Odds %
    const getCleanSheetOdds = (player) => {
        if (player.position !== 'GKP' && player.position !== 'DEF') return null;
        let sumOdds = 0;
        let count = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred && pred.opp !== 'BYE') {
                let base = 30;
                if (pred.diff === 2) base = 48;
                else if (pred.diff === 4) base = 18;
                else if (pred.diff === 5) base = 8;
                
                if (pred.loc === 'H') base += 5;
                else base -= 5;
                
                sumOdds += base;
                count++;
            }
        }
        return count > 0 ? `${Math.round(sumOdds / count)}%` : '0%';
    };

    // Helper: Projected Attacking Returns (xGI)
    const getProjectedReturns = (player) => {
        if (player.position === 'GKP' || player.position === 'DEF') return null;
        const xGI90 = (player.xG90 || 0) + (player.xA90 || 0);
        const base = xGI90 > 0 ? xGI90 : (player.position === 'FWD' ? 0.35 : 0.22);
        
        let multiplier = 1.0;
        let count = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred && pred.opp !== 'BYE') {
                if (pred.diff === 2) multiplier += 0.25;
                else if (pred.diff === 4) multiplier -= 0.15;
                else if (pred.diff === 5) multiplier -= 0.35;
                count++;
            }
        }
        const value = base * (count > 0 ? count : horizon) * multiplier;
        return value.toFixed(1);
    };

    const renderPlayerStatsBreakdown = (player) => {
        const fdr = getAvgFDR(player);
        const csOdds = getCleanSheetOdds(player);
        const projRet = getProjectedReturns(player);
        const pts = getExpectedPts(player);

        return `
            <div class="analysis-stats-grid">
                <div class="stat-pill">
                    <span class="stat-pill-label">Avg FDR</span>
                    <span class="stat-pill-val fdr-${Math.round(parseFloat(fdr))}">${fdr}</span>
                </div>
                ${csOdds !== null ? `
                    <div class="stat-pill">
                        <span class="stat-pill-label">CS Odds</span>
                        <span class="stat-pill-val">${csOdds}</span>
                    </div>
                ` : ''}
                ${projRet !== null ? `
                    <div class="stat-pill">
                        <span class="stat-pill-label">Proj xGI</span>
                        <span class="stat-pill-val">${projRet}</span>
                    </div>
                ` : ''}
                <div class="stat-pill highlight">
                    <span class="stat-pill-label">XP (${horizon} GW)</span>
                    <span class="stat-pill-val">${pts.toFixed(1)}</span>
                </div>
            </div>
        `;
    };

    const getOptimizationExplanation = (outPlayer, inPlayer) => {
        if (!inPlayer) return '';
        
        const outPts = outPlayer ? getExpectedPts(outPlayer) : 0;
        const inPts = getExpectedPts(inPlayer);
        const gain = inPts - outPts;

        const outFdr = outPlayer ? parseFloat(getAvgFDR(outPlayer)) : 5.0;
        const inFdr = parseFloat(getAvgFDR(inPlayer));

        const outCs = outPlayer ? getCleanSheetOdds(outPlayer) : null;
        const inCs = getCleanSheetOdds(inPlayer);

        const outRet = outPlayer ? getProjectedReturns(outPlayer) : null;
        const inRet = getProjectedReturns(inPlayer);

        let reasons = [];

        // 1. Fixture difficulty comparison
        if (inFdr < outFdr) {
            reasons.push(`<strong>Fixtures Upgrade:</strong> Opponent difficulty decreases from FDR ${outFdr} to FDR ${inFdr}.`);
        } else if (inFdr === outFdr && outPlayer) {
            reasons.push(`<strong>Comparable Fixtures:</strong> Opponent difficulty is similar, but ${inPlayer.name} has superior output.`);
        }

        // 2. Goal threat/assist threat comparison
        if (inRet !== null) {
            const outRVal = outRet ? parseFloat(outRet) : 0;
            const inRVal = parseFloat(inRet);
            if (inRVal > outRVal) {
                reasons.push(`<strong>Higher Goal Threat:</strong> Attacking projected returns increase from Proj xGI ${outRVal} to ${inRet}.`);
            }
        }

        // 3. Clean sheet comparison (for gk/def)
        if (inCs !== null) {
            const outCVal = outCs ? parseInt(outCs) : 0;
            const inCVal = parseInt(inCs);
            if (inCVal > outCVal) {
                reasons.push(`<strong>Better Clean Sheet Potential:</strong> Defensive clean sheet odds jump from ${outCs || '0%'} to ${inCs}.`);
            }
        }

        // 4. Budget
        if (outPlayer && inPlayer.price < outPlayer.price) {
            reasons.push(`<strong>Budget Enabler:</strong> Frees up £${(outPlayer.price - inPlayer.price).toFixed(1)}m in capital value.`);
        }

        // Fallback
        if (reasons.length === 0) {
            reasons.push(`<strong>Overall Expected Value:</strong> ${inPlayer.name} shows a higher expected value (+${gain.toFixed(1)} XP) for this window.`);
        }

        return `
            <div class="rec-explanation-box">
                <h4><i data-lucide="info" style="width:13px; height:13px; vertical-align:middle; margin-right:4px;"></i> Swapping Rationale:</h4>
                <ul class="rec-explanation-list">
                    ${reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    };

    if (mode === 'preseason') {
        // --- PRESEASON SOLVER: UNLIMITED TRANSFERS ---
        let optimizedSquadSlots = JSON.parse(JSON.stringify(state.squadSlots)); // deep clone
        let totalValue = optimizedSquadSlots.reduce((sum, slot) => {
            if (slot.playerId === null) return sum;
            const p = PLAYERS.find(pl => pl.id === slot.playerId);
            return sum + (p ? p.price : 0);
        }, 0) + bank;

        let improved = true;
        let iterations = 0;
        
        while (improved && iterations < 15) {
            improved = false;
            iterations++;
            
            for (let i = 0; i < optimizedSquadSlots.length; i++) {
                const currentSlot = optimizedSquadSlots[i];
                const currentSlotPlayer = currentSlot.playerId !== null ? PLAYERS.find(p => p.id === currentSlot.playerId) : null;
                const currentPts = currentSlotPlayer ? getExpectedPts(currentSlotPlayer) : 0;
                
                let otherCost = optimizedSquadSlots.reduce((sum, slot, idx) => {
                    if (idx === i || slot.playerId === null) return sum;
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    return sum + (p ? p.price : 0);
                }, 0);
                
                let maxBudgetForSlot = totalValue - otherCost;

                const existingIds = optimizedSquadSlots.map((s, idx) => idx !== i ? s.playerId : null).filter(id => id !== null);
                const candidates = PLAYERS.filter(p => 
                    p.position === currentSlot.position && 
                    !existingIds.includes(p.id) &&
                    p.price <= maxBudgetForSlot
                );

                let bestCandidate = null;
                let bestPts = currentPts;

                for (const cand of candidates) {
                    const candPts = getExpectedPts(cand);
                    if (candPts > bestPts) {
                        const tempSquadIds = [...existingIds, cand.id];
                        const teamCounts = {};
                        let ok = true;
                        for (const id of tempSquadIds) {
                            const p = PLAYERS.find(pl => pl.id === id);
                            if (p) {
                                teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
                                if (teamCounts[p.team] > 3) {
                                    ok = false;
                                    break;
                                }
                            }
                        }
                        if (ok) {
                            bestPts = candPts;
                            bestCandidate = cand;
                        }
                    }
                }

                if (bestCandidate) {
                    currentSlot.playerId = bestCandidate.id;
                    improved = true;
                }
            }
        }

        // Compare original and optimized slots
        const upgrades = [];
        let totalOriginalPts = 0;
        let totalOptimizedPts = 0;

        for (let i = 0; i < state.squadSlots.length; i++) {
            const originalId = state.squadSlots[i].playerId;
            const optimizedId = optimizedSquadSlots[i].playerId;
            
            const originalPlayer = originalId !== null ? PLAYERS.find(p => p.id === originalId) : null;
            const optimizedPlayer = optimizedId !== null ? PLAYERS.find(p => p.id === optimizedId) : null;

            totalOriginalPts += originalPlayer ? getExpectedPts(originalPlayer) : 0;
            totalOptimizedPts += optimizedPlayer ? getExpectedPts(optimizedPlayer) : 0;

            if (originalId !== optimizedId) {
                upgrades.push({
                    slotIndex: i,
                    out: originalPlayer,
                    in: optimizedPlayer,
                    gain: (optimizedPlayer ? getExpectedPts(optimizedPlayer) : 0) - (originalPlayer ? getExpectedPts(originalPlayer) : 0)
                });
            }
        }

        const overallGain = totalOptimizedPts - totalOriginalPts;

        resultsGrid.innerHTML = `
            <div class="optimizer-card" style="grid-column: span 2;">
                <h3><i data-lucide="sparkles" class="highlight-transfers"></i> Preseason AI Full-Squad Optimization</h3>
                <div class="recommendations-list" style="margin-top: 16px;">
                    ${upgrades.length > 0 ? `
                        <div class="rec-option-box">
                            <div class="rec-option-header" style="margin-bottom: 16px;">
                                <span class="rec-badge" style="background: rgba(0, 255, 136, 0.1); color: var(--primary); border-color: rgba(0, 255, 136, 0.2);">UNLIMITED UPGRADES ENABLED</span>
                                <span class="rec-pts-gain">+${overallGain.toFixed(1)} Overall XP (${horizon} GWs)</span>
                            </div>
                            
                            <div style="display:flex; flex-direction:column; gap:20px;">
                                ${upgrades.map(up => `
                                    <div class="rec-row-preseason">
                                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
                                            <div class="transfer-player-card player-card-out" style="flex:1;">
                                                <span class="player-name-main">${up.out ? up.out.name : 'Empty Slot'}</span>
                                                <span class="player-team-sub">${up.out ? `${up.out.team} • £${up.out.price.toFixed(1)}m` : 'N/A'}</span>
                                                ${up.out ? renderPlayerStatsBreakdown(up.out) : ''}
                                            </div>
                                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:12px;">
                                                <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="margin: 0 0 6px 0;"></i>
                                                <span class="pill-value" style="font-size:10px; background:rgba(0, 255, 136, 0.1); color:var(--primary);">+${up.gain.toFixed(1)} XP</span>
                                            </div>
                                            <div class="transfer-player-card player-card-in" style="flex:1;">
                                                <span class="player-name-main">${up.in.name}</span>
                                                <span class="player-team-sub">${up.in.team} • £${up.in.price.toFixed(1)}m</span>
                                                ${renderPlayerStatsBreakdown(up.in)}
                                            </div>
                                        </div>
                                        ${getOptimizationExplanation(up.out, up.in)}
                                    </div>
                                `).join('')}
                            </div>
                            
                            <button class="apply-rec-btn" id="applyAllPreseasonBtn" style="margin-top: 24px; width:100%;">Apply All AI Upgrades</button>
                        </div>
                    ` : `
                        <div class="transfer-list-empty">Your current squad is mathematically optimized for a ${horizon}-Gameweek horizon! No upgrades found.</div>
                    `}
                </div>
            </div>
        `;

        const applyAllBtn = resultsGrid.querySelector('#applyAllPreseasonBtn');
        if (applyAllBtn) {
            applyAllBtn.addEventListener('click', () => {
                state.squadSlots = optimizedSquadSlots;
                // Sync captain/vice if sold
                const activeStarterIds = optimizedSquadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
                if (!activeStarterIds.includes(state.captain)) {
                    state.captain = activeStarterIds[0] || null;
                }
                if (!activeStarterIds.includes(state.vice)) {
                    state.vice = activeStarterIds[1] || null;
                }

                // Deduct budget
                const spent = optimizedSquadSlots.reduce((sum, slot) => {
                    if (slot.playerId === null) return sum;
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    return sum + (p ? p.price : 0);
                }, 0);
                state.saveState();
                
                actions.showToast("All AI squad upgrades applied successfully!", "success");
                actions.switchTab('planner');
            });
        }
    } else {
        // --- MIDSEASON SOLVER: CONSTRAINED BY FREE TRANSFERS ---
        const freeTransfersCount = state.currentGw === 1 ? 2 : squadInfo.freeTransfers;

        const checkTeamConstraints = (oldSquadIds, soldId, boughtId) => {
            const tempSquad = oldSquadIds.filter(id => id !== soldId);
            tempSquad.push(boughtId);
            const counts = {};
            for (const id of tempSquad) {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) {
                    counts[p.team] = (counts[p.team] || 0) + 1;
                    if (counts[p.team] > 3) return false;
                }
            }
            return true;
        };

        const checkTeamConstraintsDouble = (oldSquadIds, s1, s2, b1, b2) => {
            const tempSquad = oldSquadIds.filter(id => id !== s1 && id !== s2);
            tempSquad.push(b1, b2);
            const counts = {};
            for (const id of tempSquad) {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) {
                    counts[p.team] = (counts[p.team] || 0) + 1;
                    if (counts[p.team] > 3) return false;
                }
            }
            return true;
        };

        // --- FIND BEST 1-TRANSFER OPTION ---
        let best1Tx = null;
        let maxGain1 = -999;

        for (const soldId of currentSquadIds) {
            const soldPlayer = PLAYERS.find(p => p.id === soldId);
            if (!soldPlayer) continue;

            const soldPts = getExpectedPts(soldPlayer);
            const sellBudget = soldPlayer.price + bank;

            const candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !currentSquadIds.includes(p.id) &&
                p.price <= sellBudget
            );

            for (const boughtPlayer of candidates) {
                if (!checkTeamConstraints(currentSquadIds, soldId, boughtPlayer.id)) continue;

                const boughtPts = getExpectedPts(boughtPlayer);
                const gain = boughtPts - soldPts;

                if (gain > maxGain1) {
                    maxGain1 = gain;
                    best1Tx = {
                        out: soldPlayer,
                        in: boughtPlayer,
                        gain: gain
                    };
                }
            }
        }

        // --- FIND BEST 2-TRANSFER OPTION ---
        let best2Tx = null;
        let maxGain2 = -999;

        for (let i = 0; i < currentSquadIds.length; i++) {
            for (let j = i + 1; j < currentSquadIds.length; j++) {
                const s1 = PLAYERS.find(p => p.id === currentSquadIds[i]);
                const s2 = PLAYERS.find(p => p.id === currentSquadIds[j]);
                if (!s1 || !s2) continue;

                const soldPts = getExpectedPts(s1) + getExpectedPts(s2);
                const sellBudget = s1.price + s2.price + bank;

                const candidates1 = PLAYERS.filter(p => p.position === s1.position && !currentSquadIds.includes(p.id));
                const candidates2 = PLAYERS.filter(p => p.position === s2.position && !currentSquadIds.includes(p.id));

                for (const b1 of candidates1) {
                    for (const b2 of candidates2) {
                        if (b1.id === b2.id) continue;
                        if (b1.price + b2.price > sellBudget) continue;
                        if (!checkTeamConstraintsDouble(currentSquadIds, s1.id, s2.id, b1.id, b2.id)) continue;

                        const boughtPts = getExpectedPts(b1) + getExpectedPts(b2);
                        const gain = boughtPts - soldPts;

                        if (gain > maxGain2) {
                            maxGain2 = gain;
                            best2Tx = {
                                out1: s1,
                                out2: s2,
                                in1: b1,
                                in2: b2,
                                gain: gain
                            };
                        }
                    }
                }
            }
        }

        // Render Midseason results
        resultsGrid.innerHTML = `
            <!-- Single Transfer Recommendation -->
            <div class="optimizer-card" style="${freeTransfersCount === 1 ? 'grid-column: span 2;' : ''}">
                <h3><i data-lucide="arrow-right-left" class="highlight-transfers"></i> Best Single Transfer</h3>
                <div class="recommendations-list" style="margin-top: 16px;">
                    ${best1Tx && best1Tx.gain > 0.1 ? `
                        <div class="rec-option-box">
                            <div class="rec-option-header" style="margin-bottom: 12px;">
                                <span class="rec-badge">RECOMMENDED</span>
                                <span class="rec-pts-gain">+${best1Tx.gain.toFixed(1)} XP (${horizon} GWs)</span>
                            </div>
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                                <div class="transfer-player-card player-card-out" style="flex:1;">
                                    <span class="player-name-main">${best1Tx.out.name}</span>
                                    <span class="player-team-sub">${best1Tx.out.team} • £${best1Tx.out.price.toFixed(1)}m</span>
                                    ${renderPlayerStatsBreakdown(best1Tx.out)}
                                </div>
                                <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                <div class="transfer-player-card player-card-in" style="flex:1;">
                                    <span class="player-name-main">${best1Tx.in.name}</span>
                                    <span class="player-team-sub">${best1Tx.in.team} • £${best1Tx.in.price.toFixed(1)}m</span>
                                    ${renderPlayerStatsBreakdown(best1Tx.in)}
                                </div>
                            </div>
                            ${getOptimizationExplanation(best1Tx.out, best1Tx.in)}
                            <button class="apply-rec-btn" id="applySingleBtn" style="margin-top: 16px; width: 100%;">Apply AI Transfer</button>
                        </div>
                    ` : `
                        <div class="transfer-list-empty">Current squad is optimized. No beneficial single transfer found.</div>
                    `}
                </div>
            </div>

            <!-- Double Transfer Recommendation -->
            ${freeTransfersCount >= 2 ? `
                <div class="optimizer-card">
                    <h3><i data-lucide="layers" class="highlight-bank"></i> Best Double Transfer</h3>
                    <div class="recommendations-list" style="margin-top: 16px;">
                        ${best2Tx && best2Tx.gain > 0.5 ? `
                            <div class="rec-option-box">
                                <div class="rec-option-header" style="margin-bottom: 12px;">
                                    <span class="rec-badge" style="background:rgba(0, 242, 254, 0.1); color: var(--secondary); border-color: var(--secondary-glow)">HIGH IMPACT</span>
                                    <span class="rec-pts-gain">+${best2Tx.gain.toFixed(1)} XP (${horizon} GWs)</span>
                                </div>
                                
                                <!-- Transfer 1 -->
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                                    <div class="transfer-player-card player-card-out" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.out1.name}</span>
                                        <span class="player-team-sub">${best2Tx.out1.team} • £${best2Tx.out1.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.out1)}
                                    </div>
                                    <i data-lucide="arrow-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                    <div class="transfer-player-card player-card-in" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.in1.name}</span>
                                        <span class="player-team-sub">${best2Tx.in1.team} • £${best2Tx.in1.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.in1)}
                                    </div>
                                </div>
        
                                <!-- Transfer 2 -->
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                                    <div class="transfer-player-card player-card-out" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.out2.name}</span>
                                        <span class="player-team-sub">${best2Tx.out2.team} • £${best2Tx.out2.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.out2)}
                                    </div>
                                    <i data-lucide="arrow-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                    <div class="transfer-player-card player-card-in" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.in2.name}</span>
                                        <span class="player-team-sub">${best2Tx.in2.team} • £${best2Tx.in2.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.in2)}
                                    </div>
                                </div>
                                
                                ${getOptimizationExplanation(best2Tx.out1, best2Tx.in1)}
                                ${getOptimizationExplanation(best2Tx.out2, best2Tx.in2)}
        
                                <button class="apply-rec-btn" id="applyDoubleBtn" style="margin-top: 16px; width: 100%;">Apply Both Transfers</button>
                            </div>
                        ` : `
                            <div class="transfer-list-empty">Current squad is optimized. No beneficial double transfer found.</div>
                        `}
                    </div>
                </div>
            ` : ''}
        `;

        const singleBtn = resultsGrid.querySelector('#applySingleBtn');
        if (singleBtn) {
            singleBtn.addEventListener('click', () => {
                const ok = actions.addTransfer(state.currentGw, best1Tx.out.id, best1Tx.in.id);
                if (ok) {
                    actions.showToast("AI single transfer applied successfully!", "success");
                    actions.switchTab('planner');
                }
            });
        }

        const doubleBtn = resultsGrid.querySelector('#applyDoubleBtn');
        if (doubleBtn) {
            doubleBtn.addEventListener('click', () => {
                const ok1 = actions.addTransfer(state.currentGw, best2Tx.out1.id, best2Tx.in1.id);
                if (ok1) {
                    const ok2 = actions.addTransfer(state.currentGw, best2Tx.out2.id, best2Tx.in2.id);
                    if (ok2) {
                        actions.showToast("AI double transfer applied successfully!", "success");
                        actions.switchTab('planner');
                    } else {
                        const list = state.transfers[state.currentGw];
                        list.pop();
                        state.saveState();
                        actions.showToast("Could not apply second transfer due to budget/constraints.", "error");
                    }
                } else {
                    actions.showToast("Could not apply transfers due to constraints.", "error");
                }
            });
        }
    }
}
