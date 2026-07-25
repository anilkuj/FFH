import { PLAYERS, TEAMS } from '../data.js';
import { getFormationConstraints } from './formation.js';

export function renderOptimizer(container, state, actions) {
    // Premium Lock Check
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    const squadInfo = state.getSquadForGw(state.currentGw);
    const { freeTransfers } = squadInfo;

    const totalVal = squadInfo.squad.reduce((sum, id) => {
        const p = PLAYERS.find(pl => pl.id === id);
        return sum + (p ? p.price : 0);
    }, 0);
    const squadValue = totalVal + squadInfo.bank;

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

                    <div class="setting-group">
                        <label for="optimizerFormationSelect">Preferred Formation</label>
                        <select id="optimizerFormationSelect" class="settings-select">
                            <option value="4-3-3" ${state.formation === '4-3-3' ? 'selected' : ''}>4-3-3</option>
                            <option value="4-4-2" ${state.formation === '4-4-2' ? 'selected' : ''}>4-4-2</option>
                            <option value="3-5-2" ${state.formation === '3-5-2' ? 'selected' : ''}>3-5-2</option>
                            <option value="3-4-3" ${state.formation === '3-4-3' ? 'selected' : ''}>3-4-3</option>
                            <option value="4-5-1" ${state.formation === '4-5-1' ? 'selected' : ''}>4-5-1</option>
                            <option value="5-3-2" ${state.formation === '5-3-2' ? 'selected' : ''}>5-3-2</option>
                            <option value="5-4-1" ${state.formation === '5-4-1' ? 'selected' : ''}>5-4-1</option>
                            <option value="5-2-3" ${state.formation === '5-2-3' ? 'selected' : ''}>5-2-3</option>
                        </select>
                    </div>

                    <div class="setting-group" id="benchBudgetGroup">
                        <label for="benchBudgetRange">Reserved Bench Budget: <span id="benchBudgetValue" style="color: var(--primary); font-weight: 800;">£${state.benchBudget.toFixed(1)}m</span></label>
                        <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px; height: 38px;">
                            <span style="font-size: 11px; color: var(--text-muted);">£17.0m</span>
                            <input type="range" id="benchBudgetRange" min="17.0" max="25.0" step="0.5" value="${state.benchBudget}" style="flex: 1; accent-color: var(--primary); cursor: pointer; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); outline: none;">
                            <span style="font-size: 11px; color: var(--text-muted);">£25.0m</span>
                        </div>
                        <span class="setting-help">Reserves a portion of your total squad budget (£${squadValue.toFixed(1)}m) for the 4 bench slots.</span>
                    </div>
                </div>

                <div class="optimizer-rules-container" style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="shield-alert" style="color: var(--primary); width:16px; height:16px;"></i> Solver Constraints (Optional)
                    </h4>
                    <div class="settings-form-grid">
                        <div class="setting-group">
                            <label style="font-size: 13px; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 6px;">Force Include Players</label>
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" list="mustIncludeOptions" id="mustIncludeSearch" placeholder="Type to search player..." class="settings-select" style="flex: 1; min-width: 140px; border-color: rgba(255, 255, 255, 0.08);">
                                <datalist id="mustIncludeOptions"></datalist>
                                <button id="addMustIncludeBtn" class="pitch-btn" style="padding: 10px 14px; border-radius: 8px; height: 38px; display: flex; align-items: center; justify-content: center;"><i data-lucide="plus"></i></button>
                            </div>
                            <div id="mustIncludeTags" style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 24px;">
                                <!-- Badges dynamic -->
                            </div>
                        </div>

                        <div class="setting-group">
                            <label style="font-size: 13px; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 6px;">Force Exclude Players</label>
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" list="mustExcludeOptions" id="mustExcludeSearch" placeholder="Type to search player..." class="settings-select" style="flex: 1; min-width: 140px; border-color: rgba(255, 255, 255, 0.08);">
                                <datalist id="mustExcludeOptions"></datalist>
                                <button id="addMustExcludeBtn" class="pitch-btn" style="padding: 10px 14px; border-radius: 8px; height: 38px; display: flex; align-items: center; justify-content: center;"><i data-lucide="plus"></i></button>
                            </div>
                            <div id="mustExcludeTags" style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 24px;">
                                <!-- Badges dynamic -->
                            </div>
                        </div>
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
    const benchGroup = container.querySelector('#benchBudgetGroup');

    const updateHelpText = () => {
        if (phaseSelect.value === 'preseason') {
            helpText.textContent = `Allows unlimited squad upgrades within total squad budget. Perfect for preseason/wildcard planning.`;
            if (benchGroup) benchGroup.style.display = 'flex';
        } else {
            const currentFt = state.currentGw === 1 ? 'Unlimited' : freeTransfers;
            helpText.textContent = `Respects your available free transfers (${currentFt} FT) for GW${state.currentGw} to avoid points hits.`;
            if (benchGroup) benchGroup.style.display = 'none';
        }
    };

    phaseSelect.addEventListener('change', updateHelpText);
    updateHelpText();

    // Wire bench budget slider listeners
    const benchSlider = container.querySelector('#benchBudgetRange');
    const benchValueDisplay = container.querySelector('#benchBudgetValue');
    if (benchSlider && benchValueDisplay) {
        benchSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            benchValueDisplay.textContent = `£${val.toFixed(1)}m`;
            state.benchBudget = val;
            state.saveState();
        });
    }

    const formationSelect = container.querySelector('#optimizerFormationSelect');
    if (formationSelect) {
        formationSelect.addEventListener('change', () => {
            actions.setFormation(formationSelect.value);
        });
    }

    // Populate include/exclude selects and search filters using datalist
    const includeSearch = container.querySelector('#mustIncludeSearch');
    const excludeSearch = container.querySelector('#mustExcludeSearch');
    const includeDatalist = container.querySelector('#mustIncludeOptions');
    const excludeDatalist = container.querySelector('#mustExcludeOptions');

    const populatePlayerSelects = () => {
        const sortedPlayers = [...PLAYERS].sort((a, b) => a.name.localeCompare(b.name));
        
        let html = '';
        sortedPlayers.forEach(p => {
            html += `<option value="${p.name} (${p.team} - £${p.price.toFixed(1)}m)"></option>`;
        });
        
        if (includeDatalist) includeDatalist.innerHTML = html;
        if (excludeDatalist) excludeDatalist.innerHTML = html;
    };
    populatePlayerSelects();

    // Render tags
    const includeTagsContainer = container.querySelector('#mustIncludeTags');
    const excludeTagsContainer = container.querySelector('#mustExcludeTags');

    const renderTags = () => {
        if (includeTagsContainer) {
            includeTagsContainer.innerHTML = state.mustInclude.map(id => {
                const p = PLAYERS.find(pl => pl.id === id);
                if (!p) return '';
                return `
                    <span class="pill-value" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(0, 255, 136, 0.1); border: 1px solid var(--primary-glow); border-radius: 20px; font-size: 11px; color: var(--primary);">
                        ${p.name}
                        <i data-lucide="x" class="remove-include-tag" data-id="${id}" style="width: 12px; height: 12px; cursor: pointer; color: var(--text-muted);"></i>
                    </span>
                `;
            }).join('');
        }

        if (excludeTagsContainer) {
            excludeTagsContainer.innerHTML = state.mustExclude.map(id => {
                const p = PLAYERS.find(pl => pl.id === id);
                if (!p) return '';
                return `
                    <span class="pill-value" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 20px; font-size: 11px; color: #ef4444;">
                        ${p.name}
                        <i data-lucide="x" class="remove-exclude-tag" data-id="${id}" style="width: 12px; height: 12px; cursor: pointer; color: var(--text-muted);"></i>
                    </span>
                `;
            }).join('');
        }

        lucide.createIcons();
        registerTagListeners();
    };

    const registerTagListeners = () => {
        container.querySelectorAll('.remove-include-tag').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.getAttribute('data-id'));
                state.mustInclude = state.mustInclude.filter(includeId => includeId !== id);
                state.saveState();
                renderTags();
            });
        });

        container.querySelectorAll('.remove-exclude-tag').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.getAttribute('data-id'));
                state.mustExclude = state.mustExclude.filter(excludeId => excludeId !== id);
                state.saveState();
                renderTags();
            });
        });
    };

    renderTags();

    container.querySelector('#addMustIncludeBtn').addEventListener('click', () => {
        const val = includeSearch.value;
        if (!val) return;
        
        // Find player by matching the datalist value string
        const selectedPlayer = PLAYERS.find(p => `${p.name} (${p.team} - £${p.price.toFixed(1)}m)` === val);
        if (!selectedPlayer) {
            actions.showToast("Please select a player from the autocomplete list.", "error");
            return;
        }

        const id = selectedPlayer.id;
        if (!state.mustInclude.includes(id)) {
            // Check team counts beforehand (max 3 per team)
            const hypIncludes = [...state.mustInclude, id];
            const teamCounts = {};
            for (const incId of hypIncludes) {
                const player = PLAYERS.find(pl => pl.id === incId);
                if (player) {
                    teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
                    if (teamCounts[player.team] > 3) {
                        actions.showToast(`Team limit exceeded! You cannot force include more than 3 players from ${player.team}.`, 'error');
                        return;
                    }
                }
            }

            state.mustInclude.push(id);
            // Remove from exclude if present
            state.mustExclude = state.mustExclude.filter(excludeId => excludeId !== id);
            state.saveState();
            renderTags();
        }
        includeSearch.value = '';
    });

    container.querySelector('#addMustExcludeBtn').addEventListener('click', () => {
        const val = excludeSearch.value;
        if (!val) return;

        // Find player by matching the datalist value string
        const selectedPlayer = PLAYERS.find(p => `${p.name} (${p.team} - £${p.price.toFixed(1)}m)` === val);
        if (!selectedPlayer) {
            actions.showToast("Please select a player from the autocomplete list.", "error");
            return;
        }

        const id = selectedPlayer.id;
        if (!state.mustExclude.includes(id)) {
            state.mustExclude.push(id);
            // Remove from include if present
            state.mustInclude = state.mustInclude.filter(includeId => includeId !== id);
            state.saveState();
            renderTags();
        }
        excludeSearch.value = '';
    });

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
        let currentSquadVal = optimizedSquadSlots.reduce((sum, slot) => {
            if (slot.playerId === null) return sum;
            const p = PLAYERS.find(pl => pl.id === slot.playerId);
            return sum + (p ? p.price : 0);
        }, 0) + bank;
        let totalValue = Math.max(100.0, currentSquadVal);

        // Separate and force recalculation of starting/bench slots based on selected formation
        const cons = getFormationConstraints(state.formation);
        optimizedSquadSlots.forEach(s => {
            s.isStarting = false;
            s.locked = false;
        });
        
        let assignedGKP = 0, assignedDEF = 0, assignedMID = 0, assignedFWD = 0;
        optimizedSquadSlots.forEach(slot => {
            if (slot.position === 'GKP' && assignedGKP < cons.GKP) { slot.isStarting = true; assignedGKP++; }
            else if (slot.position === 'DEF' && assignedDEF < cons.DEF) { slot.isStarting = true; assignedDEF++; }
            else if (slot.position === 'MID' && assignedMID < cons.MID) { slot.isStarting = true; assignedMID++; }
            else if (slot.position === 'FWD' && assignedFWD < cons.FWD) { slot.isStarting = true; assignedFWD++; }
        });

        const startingIndices = [];
        const benchIndices = [];
        for (let i = 0; i < optimizedSquadSlots.length; i++) {
            if (optimizedSquadSlots[i].isStarting) {
                startingIndices.push(i);
            } else {
                benchIndices.push(i);
            }
        }

        const initUsedIds = [];

        // 1. Assign must-include players to slots first and lock them
        if (state.mustInclude && state.mustInclude.length > 0) {
            for (const incId of state.mustInclude) {
                const player = PLAYERS.find(p => p.id === incId);
                if (!player) continue;

                // Find an empty matching position slot
                let targetSlotIndex = -1;
                for (const idx of startingIndices) {
                    if (optimizedSquadSlots[idx].position === player.position && optimizedSquadSlots[idx].playerId === null && !optimizedSquadSlots[idx].locked) {
                        targetSlotIndex = idx;
                        break;
                    }
                }
                if (targetSlotIndex === -1) {
                    for (const idx of benchIndices) {
                        if (optimizedSquadSlots[idx].position === player.position && optimizedSquadSlots[idx].playerId === null && !optimizedSquadSlots[idx].locked) {
                            targetSlotIndex = idx;
                            break;
                        }
                    }
                }

                // If no empty slot, replace an unlocked player's slot
                if (targetSlotIndex === -1) {
                    for (const idx of startingIndices) {
                        if (optimizedSquadSlots[idx].position === player.position && !optimizedSquadSlots[idx].locked) {
                            targetSlotIndex = idx;
                            break;
                        }
                    }
                }
                if (targetSlotIndex === -1) {
                    for (const idx of benchIndices) {
                        if (optimizedSquadSlots[idx].position === player.position && !optimizedSquadSlots[idx].locked) {
                            targetSlotIndex = idx;
                            break;
                        }
                    }
                }

                if (targetSlotIndex !== -1) {
                    optimizedSquadSlots[targetSlotIndex].playerId = player.id;
                    optimizedSquadSlots[targetSlotIndex].locked = true;
                    initUsedIds.push(player.id);
                }
            }
        }

        // Budget boundaries based on user selection
        const minBenchBudget = state.benchBudget || 17.0;
        const maxBenchBudget = minBenchBudget;
        const maxStartingBudget = totalValue - minBenchBudget; // remaining budget for starting 11

        // Cheapest players for fallback and initialization (excluding mustExclude)
        const cheapestGKPs = PLAYERS.filter(p => p.position === 'GKP' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestDEFs = PLAYERS.filter(p => p.position === 'DEF' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestMIDs = PLAYERS.filter(p => p.position === 'MID' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestFWDs = PLAYERS.filter(p => p.position === 'FWD' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);

        const getCheapestPlayersList = (pos, count, usedIds) => {
            const list = pos === 'GKP' ? cheapestGKPs : (pos === 'DEF' ? cheapestDEFs : (pos === 'MID' ? cheapestMIDs : cheapestFWDs));
            const result = [];
            for (const p of list) {
                if (!usedIds.includes(p.id)) {
                    result.push(p);
                    usedIds.push(p.id);
                    if (result.length === count) break;
                }
            }
            return result;
        };

        // Initialize starting slots first (with cheapest) if they are not locked
        for (const idx of startingIndices) {
            const slot = optimizedSquadSlots[idx];
            if (!slot.locked) {
                const cheapest = getCheapestPlayersList(slot.position, 1, initUsedIds)[0];
                slot.playerId = cheapest ? cheapest.id : null;
            }
        }
        // Initialize bench slots (with cheapest) if they are not locked
        for (const idx of benchIndices) {
            const slot = optimizedSquadSlots[idx];
            if (!slot.locked) {
                const cheapest = getCheapestPlayersList(slot.position, 1, initUsedIds)[0];
                slot.playerId = cheapest ? cheapest.id : null;
            }
        }

        // Duplicates and team-limit resolution helper for bench
        const resolveBenchDuplicates = () => {
            const startingIds = startingIndices.map(sIdx => optimizedSquadSlots[sIdx].playerId).filter(id => id !== null);
            const usedInBench = [];
            
            // Calculate starting team counts
            const startingTeamCounts = {};
            for (const id of startingIds) {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) {
                    startingTeamCounts[p.team] = (startingTeamCounts[p.team] || 0) + 1;
                }
            }

            for (const bIdx of benchIndices) {
                const slot = optimizedSquadSlots[bIdx];
                if (slot.locked) {
                    usedInBench.push(slot.playerId);
                    continue;
                }

                const currentPlayer = slot.playerId !== null ? PLAYERS.find(pl => pl.id === slot.playerId) : null;
                
                // If current bench player is also in starting 11, is a duplicate on the bench, or causes a team count violation
                let needsReplacement = (slot.playerId === null || startingIds.includes(slot.playerId) || usedInBench.includes(slot.playerId));
                if (!needsReplacement && currentPlayer) {
                    if ((startingTeamCounts[currentPlayer.team] || 0) >= 3) {
                        needsReplacement = true;
                    }
                }

                if (needsReplacement) {
                    // Replace with the cheapest player of the same position not in startingIds/usedInBench and doesn't violate team limit (and not excluded)
                    const pool = slot.position === 'GKP' ? cheapestGKPs : (slot.position === 'DEF' ? cheapestDEFs : (slot.position === 'MID' ? cheapestMIDs : cheapestFWDs));
                    for (const p of pool) {
                        if (!startingIds.includes(p.id) && !usedInBench.includes(p.id)) {
                            if ((startingTeamCounts[p.team] || 0) < 3) {
                                slot.playerId = p.id;
                                usedInBench.push(p.id);
                                startingTeamCounts[p.team] = (startingTeamCounts[p.team] || 0) + 1;
                                break;
                            }
                        }
                    }
                } else if (currentPlayer) {
                    usedInBench.push(slot.playerId);
                    startingTeamCounts[currentPlayer.team] = (startingTeamCounts[currentPlayer.team] || 0) + 1;
                }
            }
        };

        // --- OPTIMIZE STARTING 11 ---
        let startingImproved = true;
        let startingIter = 0;
        while (startingImproved && startingIter < 20) {
            startingImproved = false;
            startingIter++;

            for (const idx of startingIndices) {
                const currentSlot = optimizedSquadSlots[idx];
                if (currentSlot.locked) continue; // Skip locked force-included players!

                const currentSlotPlayer = currentSlot.playerId !== null ? PLAYERS.find(p => p.id === currentSlot.playerId) : null;
                const currentPts = currentSlotPlayer ? getExpectedPts(currentSlotPlayer) : 0;

                // Cost of other starting players
                const otherStartingCost = startingIndices.reduce((sum, sIdx) => {
                    if (sIdx === idx) return sum;
                    const pId = optimizedSquadSlots[sIdx].playerId;
                    const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
                    return sum + (p ? p.price : 0);
                }, 0);

                const maxBudgetForSlot = maxStartingBudget - otherStartingCost;
                const usedStartingIds = startingIndices.filter(sIdx => sIdx !== idx).map(sIdx => optimizedSquadSlots[sIdx].playerId).filter(id => id !== null);
                
                const candidates = PLAYERS.filter(p => 
                    p.position === currentSlot.position && 
                    !usedStartingIds.includes(p.id) && 
                    p.price <= maxBudgetForSlot &&
                    !state.mustExclude.includes(p.id)
                ).sort((a, b) => getExpectedPts(b) - getExpectedPts(a));

                let bestCandidate = null;
                let bestPts = currentPts;

                for (const cand of candidates) {
                    const candPts = getExpectedPts(cand);
                    if (candPts > bestPts) {
                        // Check max 3 players per team constraint for starting 11
                        const tempStartingIds = [...usedStartingIds, cand.id];
                        const teamCounts = {};
                        let ok = true;
                        for (const id of tempStartingIds) {
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
                    startingImproved = true;
                }
            }
        }

        // Ensure bench is clean and has no duplicates before starting bench optimization
        resolveBenchDuplicates();

        // --- OPTIMIZE BENCH ---
        const startingCost = startingIndices.reduce((sum, sIdx) => {
            const pId = optimizedSquadSlots[sIdx].playerId;
            const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
            return sum + (p ? p.price : 0);
        }, 0);
        
        const remainingForBench = totalValue - startingCost;
        const benchBudget = Math.min(maxBenchBudget, remainingForBench);

        let benchImproved = true;
        let benchIter = 0;
        while (benchImproved && benchIter < 20) {
            benchImproved = false;
            benchIter++;

            for (const idx of benchIndices) {
                const currentSlot = optimizedSquadSlots[idx];
                if (currentSlot.locked) continue; // Skip locked force-included players!

                const currentSlotPlayer = currentSlot.playerId !== null ? PLAYERS.find(p => p.id === currentSlot.playerId) : null;
                const currentPts = currentSlotPlayer ? getExpectedPts(currentSlotPlayer) : 0;

                // Cost of other bench players
                const otherBenchCost = benchIndices.reduce((sum, bIdx) => {
                    if (bIdx === idx) return sum;
                    const pId = optimizedSquadSlots[bIdx].playerId;
                    const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
                    return sum + (p ? p.price : 0);
                }, 0);

                const maxBudgetForSlot = benchBudget - otherBenchCost;
                
                const startingIds = startingIndices.map(sIdx => optimizedSquadSlots[sIdx].playerId).filter(id => id !== null);
                const otherBenchIds = benchIndices.filter(bIdx => bIdx !== idx).map(bIdx => optimizedSquadSlots[bIdx].playerId).filter(id => id !== null);
                const unavailableIds = [...startingIds, ...otherBenchIds];

                const candidates = PLAYERS.filter(p => 
                    p.position === currentSlot.position && 
                    !unavailableIds.includes(p.id) && 
                    p.price <= maxBudgetForSlot &&
                    getExpectedPts(p) >= 0.5 &&
                    !state.mustExclude.includes(p.id)
                ).sort((a, b) => getExpectedPts(b) - getExpectedPts(a));

                let bestCandidate = null;
                let bestPts = currentPts;

                for (const cand of candidates) {
                    const candPts = getExpectedPts(cand);
                    if (candPts > bestPts) {
                        // Check max 3 players per team constraint across entire 15-player squad
                        const tempSquadIds = [...startingIds, ...otherBenchIds, cand.id];
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
                    benchImproved = true;
                }
            }
        }

        // --- POST-SOLVER FINE-TUNING: REINVEST ANY REMAINING BANK BALANCE ---
        let squadImproved = true;
        let fineTuneIter = 0;
        while (squadImproved && fineTuneIter < 15) {
            squadImproved = false;
            fineTuneIter++;

            let currentSquadCost = optimizedSquadSlots.reduce((sum, slot) => {
                if (slot.playerId === null) return sum;
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                return sum + (p ? p.price : 0);
            }, 0);
            let currentBank = totalValue - currentSquadCost;

            if (currentBank < 0.1) break; // No budget left to reinvest

            let bestUpgrade = null;
            let bestPtsGain = -0.01; // Allow equal-points upgrades if they cost more (to spend budget)
            let targetSlotIdx = -1;

            const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(id => id !== null);

            for (let i = 0; i < optimizedSquadSlots.length; i++) {
                const slot = optimizedSquadSlots[i];
                if (slot.locked) continue;

                const isBenchSlot = !slot.isStarting;
                const player = slot.playerId !== null ? PLAYERS.find(p => p.id === slot.playerId) : null;
                const playerPts = player ? getExpectedPts(player) : 0;
                const playerPrice = player ? player.price : 0;

                let currentBenchCost = 0;
                if (isBenchSlot) {
                    currentBenchCost = benchIndices.reduce((sum, bIdx) => {
                        const pId = optimizedSquadSlots[bIdx].playerId;
                        const pl = pId !== null ? PLAYERS.find(p => p.id === pId) : null;
                        return sum + (pl ? pl.price : 0);
                    }, 0);
                }

                const maxPrice = playerPrice + currentBank;

                const candidates = PLAYERS.filter(p => 
                    p.position === slot.position && 
                    !currentSquadIds.includes(p.id) && 
                    p.price <= maxPrice &&
                    !state.mustExclude.includes(p.id)
                );

                for (const cand of candidates) {
                    if (isBenchSlot) {
                        const newBenchCost = currentBenchCost - playerPrice + cand.price;
                        if (newBenchCost > minBenchBudget) {
                            continue; // Skip this candidate, it exceeds the reserved bench budget!
                        }
                    }

                    const candPts = getExpectedPts(cand);
                    const gain = candPts - playerPts;

                    // Upgrade if we get more points, or if points are equal but the player is more expensive (to spend down budget)
                    const isBetter = gain > bestPtsGain;
                    const isSamePtsButMoreExpensive = Math.abs(gain - bestPtsGain) < 0.01 && bestUpgrade && cand.price > bestUpgrade.price;

                    if (isBetter || isSamePtsButMoreExpensive) {
                        // Check team limit (max 3 per team)
                        const tempSquadIds = currentSquadIds.filter(id => id !== slot.playerId);
                        tempSquadIds.push(cand.id);
                        
                        const teamCounts = {};
                        let ok = true;
                        for (const id of tempSquadIds) {
                            const pl = PLAYERS.find(p => p.id === id);
                            if (pl) {
                                teamCounts[pl.team] = (teamCounts[pl.team] || 0) + 1;
                                if (teamCounts[pl.team] > 3) {
                                    ok = false;
                                    break;
                                }
                            }
                        }

                        if (ok) {
                            bestPtsGain = gain;
                            bestUpgrade = cand;
                            targetSlotIdx = i;
                        }
                    }
                }
            }

            if (bestUpgrade && targetSlotIdx !== -1) {
                optimizedSquadSlots[targetSlotIdx].playerId = bestUpgrade.id;
                squadImproved = true;
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

            let candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !currentSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                !state.mustExclude.includes(p.id)
            );

            // If there are must-include players not in the squad for this position, restrict candidates to only those!
            const mustIncludeNotInSquad = state.mustInclude.filter(id => 
                !currentSquadIds.includes(id) && 
                PLAYERS.find(pl => pl.id === id)?.position === soldPlayer.position
            );
            if (mustIncludeNotInSquad.length > 0) {
                candidates = candidates.filter(p => mustIncludeNotInSquad.includes(p.id));
            }

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

                let candidates1 = PLAYERS.filter(p => 
                    p.position === s1.position && 
                    !currentSquadIds.includes(p.id) &&
                    !state.mustExclude.includes(p.id)
                );
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
                    !state.mustExclude.includes(p.id)
                );
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
