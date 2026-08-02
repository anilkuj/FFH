import { PLAYERS, TEAMS, getPlayerRatings, getPlayerEfficiency } from '../data.js';
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
                            <option value="3">3 Gameweeks (Recommended)</option>
                            <option value="5" selected>5 Gameweeks (Long-term)</option>
                        </select>
                        <span class="setting-help">Analyze fixtures and expected points over this horizon.</span>
                    </div>

                    <div class="setting-group">
                        <label for="optimizerObjectiveSelect">Optimization Objective</label>
                        <select id="optimizerObjectiveSelect" class="settings-select">
                            <option value="xp" ${state.optimizerObjective === 'xp' ? 'selected' : ''}>Maximize Projected Points (XP)</option>
                            <option value="efficiency" ${state.optimizerObjective === 'efficiency' ? 'selected' : ''}>Maximize Rating Efficiency (A-E/Price)</option>
                        </select>
                        <span class="setting-help">Optimize for raw expected points or value-for-money rating efficiency.</span>
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

                    <div class="setting-group">
                        <label for="optimizerDraftSelect">Active Optimization Draft</label>
                        <div style="display: flex; gap: 8px;">
                            <select id="optimizerDraftSelect" class="settings-select" style="flex: 1;">
                                ${state.drafts.map((draft, idx) => `
                                    <option value="${idx}" ${state.activeDraftIndex === idx ? 'selected' : ''}>
                                        ${draft.name}
                                    </option>
                                `).join('')}
                            </select>
                            <button id="renameOptDraftBtn" class="pitch-btn" title="Rename Selected Draft" style="padding: 10px 14px; border-radius: 8px; height: 38px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.02);">
                                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                            </button>
                            <button id="cloneOptDraftBtn" class="pitch-btn" title="Clone Selected Draft" style="padding: 10px 14px; border-radius: 8px; height: 38px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.02); margin-left: 4px;">
                                <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                            </button>
                        </div>
                        <span class="setting-help">Select which draft the optimizer will read from and save recommendations into.</span>
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

                    <div class="setting-group" id="guaranteedStartGroup">
                        <label for="guaranteedStartRange">Guaranteed Start: <span id="guaranteedStartValue" style="color: var(--primary); font-weight: 800;">${state.guaranteedStart}m</span></label>
                        <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px; height: 38px;">
                            <span style="font-size: 11px; color: var(--text-muted);">0m</span>
                            <input type="range" id="guaranteedStartRange" min="0" max="90" step="5" value="${state.guaranteedStart}" style="flex: 1; accent-color: var(--primary); cursor: pointer; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); outline: none;">
                            <span style="font-size: 11px; color: var(--text-muted);">90m</span>
                        </div>
                        <span class="setting-help">Filter candidates by minimum average minutes per appearance to guarantee playing starters.</span>
                    </div>
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

                <div class="optimizer-rules-container" style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="brain" style="color: var(--secondary); width:16px; height:16px;"></i> AI Analyst Settings
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px; max-width: 450px;">
                        <label for="geminiApiKey" style="font-size: 13px; font-weight: 700; color: var(--text-main);">Gemini API Key (Optional)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="password" id="geminiApiKey" placeholder="Enter your Gemini API Key..." class="settings-select" style="flex: 1; border-color: rgba(255, 255, 255, 0.08);" value="${localStorage.getItem('fpl_hub_gemini_api_key') || ''}">
                            <button id="saveApiKeyBtn" class="pitch-btn" style="padding: 10px 16px; border-radius: 8px; height: 38px; font-weight: 600;">Save</button>
                        </div>
                        <span class="setting-help">Provides real-time elite LLM strategist reports customized to your team. If left blank, FPL Hub's local analysis engine will be used.</span>
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

    // Wire guaranteed start slider listeners
    const startSlider = container.querySelector('#guaranteedStartRange');
    const startValueDisplay = container.querySelector('#guaranteedStartValue');
    if (startSlider && startValueDisplay) {
        startSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            startValueDisplay.textContent = `${val}m`;
            state.guaranteedStart = val;
            state.saveState();
        });
    }

    const formationSelect = container.querySelector('#optimizerFormationSelect');
    if (formationSelect) {
        formationSelect.addEventListener('change', () => {
            actions.setFormation(formationSelect.value);
        });
    }

    const objectiveSelect = container.querySelector('#optimizerObjectiveSelect');
    if (objectiveSelect) {
        objectiveSelect.addEventListener('change', () => {
            state.optimizerObjective = objectiveSelect.value;
            state.saveState();
        });
    }

    // Draft selection listener
    const draftSelect = container.querySelector('#optimizerDraftSelect');
    if (draftSelect) {
        draftSelect.addEventListener('change', () => {
            const newIdx = parseInt(draftSelect.value);
            if (newIdx === state.activeDraftIndex) return;

            // Auto-save current squad state to previous active draft slot
            state.drafts[state.activeDraftIndex].squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
            state.drafts[state.activeDraftIndex].captain = state.captain;
            state.drafts[state.activeDraftIndex].vice = state.vice;
            state.drafts[state.activeDraftIndex].formation = state.formation;

            // Load new active draft state
            const targetDraft = state.drafts[newIdx];
            if (!targetDraft.squadSlots) {
                // Initialize to current squad state if first time loaded
                targetDraft.squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
                targetDraft.captain = state.captain;
                targetDraft.vice = state.vice;
                targetDraft.formation = state.formation;
            }

            // Set active state variables
            state.squadSlots = JSON.parse(JSON.stringify(targetDraft.squadSlots));
            state.captain = targetDraft.captain;
            state.vice = targetDraft.vice;
            state.formation = targetDraft.formation;
            state.activeDraftIndex = newIdx;

            // Save and render optimizer view
            state.saveState();
            renderOptimizer(container, state, actions);
            actions.showToast(`Loaded ${targetDraft.name} for optimization`, 'success');
        });
    }

    // Rename draft listener
    const renameDraftBtn = container.querySelector('#renameOptDraftBtn');
    if (renameDraftBtn) {
        renameDraftBtn.addEventListener('click', () => {
            const currentDraft = state.drafts[state.activeDraftIndex];
            const newName = prompt("Rename this draft:", currentDraft.name);
            if (newName && newName.trim()) {
                currentDraft.name = newName.trim();
                state.saveState();
                renderOptimizer(container, state, actions);
                actions.showToast(`Draft renamed to "${newName.trim()}"`, 'success');
            }
        });
    }

    // Clone draft listener
    const cloneDraftBtn = container.querySelector('#cloneOptDraftBtn');
    if (cloneDraftBtn) {
        cloneDraftBtn.addEventListener('click', () => {
            const currentDraft = state.drafts[state.activeDraftIndex];
            const promptMsg = `Clone current draft "${currentDraft.name}" into another draft slot.\n\nEnter target draft slot number (1-10):`;
            const targetInput = prompt(promptMsg);
            if (targetInput === null) return; // cancelled
            
            const targetNum = parseInt(targetInput.trim());
            if (isNaN(targetNum) || targetNum < 1 || targetNum > 10) {
                actions.showToast("Invalid draft number. Please enter a number between 1 and 10.", "error");
                return;
            }
            
            const targetIndex = targetNum - 1;
            if (targetIndex === state.activeDraftIndex) {
                actions.showToast("Cannot clone a draft into itself.", "error");
                return;
            }
            
            const targetDraft = state.drafts[targetIndex];
            const confirmOverwrite = confirm(`Are you sure you want to overwrite draft "${targetDraft.name}" with the contents of "${currentDraft.name}"?`);
            if (!confirmOverwrite) return;
            
            // Perform clone
            targetDraft.squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
            targetDraft.captain = state.captain;
            targetDraft.vice = state.vice;
            targetDraft.formation = state.formation;
            targetDraft.name = `Copy of ${currentDraft.name}`;
            
            state.saveState();
            renderOptimizer(container, state, actions);
            actions.showToast(`Successfully cloned into slot ${targetNum} ("${targetDraft.name}")`, "success");
        });
    }

    // Save Gemini API Key listener
    const saveApiKeyBtn = container.querySelector('#saveApiKeyBtn');
    const geminiApiKeyInput = container.querySelector('#geminiApiKey');
    if (saveApiKeyBtn && geminiApiKeyInput) {
        saveApiKeyBtn.addEventListener('click', () => {
            const keyVal = geminiApiKeyInput.value.trim();
            if (keyVal) {
                localStorage.setItem('fpl_hub_gemini_api_key', keyVal);
                actions.showToast("Gemini API Key saved successfully!", "success");
            } else {
                localStorage.removeItem('fpl_hub_gemini_api_key');
                actions.showToast("Gemini API Key removed. Using local engine.", "info");
            }
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

    // Resolve current active squad slots for the active gameweek (applying prior transfers)
    const activeSquadSlots = (() => {
        let slots = JSON.parse(JSON.stringify(state.squadSlots));
        for (let gw = 1; gw <= state.currentGw; gw++) {
            const weeklyTransfers = state.transfers[gw] || [];
            weeklyTransfers.forEach(tx => {
                slots.forEach(slot => {
                    if (slot.playerId === tx.out) {
                        slot.playerId = tx.in;
                    }
                });
            });
        }
        return slots;
    })();

    // Helper: expected points over horizon
    const getExpectedPts = (player) => {
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) sum += pred.pts;
        }
        return sum;
    };

    // Helper: guaranteed start filter
    const isGuaranteedStart = (player) => {
        if (state.mustInclude && state.mustInclude.includes(player.id)) return true;
        const minMins = state.guaranteedStart || 0;
        if (minMins === 0) return true;
        const mppg = player.MPPG || 0;
        if (mppg >= minMins) return true;
        // Exception: new or highly priced signings with 0 mins might still be starting players (e.g. price >= 5.0m)
        if (mppg === 0 && player.price >= 5.0) return true;
        return false;
    };



    const objective = state.optimizerObjective || 'xp';
    const getSolverScore = (player) => {
        if (!player) return 0;
        // Ignore injured, suspended, or unavailable players (status 'i', 's', 'u')
        if (player.status === 'i' || player.status === 's' || player.status === 'u') {
            return 0;
        }
        if (objective === 'efficiency') {
            return getPlayerEfficiency(player, state.currentGw) * 10;
        } else {
            return getExpectedPts(player);
        }
    };

    const getSquadPointsForHorizon = (slots, h) => {
        let total = 0;
        let maxStarterPts = 0;
        
        slots.forEach(slot => {
            if (slot.playerId === null) return;
            const p = PLAYERS.find(pl => pl.id === slot.playerId);
            if (!p) return;
            if (p.status === 'i' || p.status === 's' || p.status === 'u') return;
            
            let sum = 0;
            for (let gw = state.currentGw; gw < state.currentGw + h; gw++) {
                const pred = p.predictions.find(pr => pr.gw === gw);
                if (pred) sum += pred.pts;
            }
            
            const rawScore = objective === 'efficiency' ? getPlayerEfficiency(p, state.currentGw) * 10 : sum;
            if (slot.isStarting) {
                total += rawScore;
                if (rawScore > maxStarterPts) {
                    maxStarterPts = rawScore;
                }
            } else {
                const benchWeight = state.chips.benchBoost ? 1.0 : 0.10;
                total += rawScore * benchWeight;
            }
        });
        
        const captainMultiplier = state.chips.tripleCaptain ? 2.0 : 1.0;
        total += maxStarterPts * captainMultiplier;
        
        return total;
    };

    const getSquadExpectedPts = (slots) => {
        return getSquadPointsForHorizon(slots, horizon);
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
        const pts = getExpectedPts(player);
        const eff = getPlayerEfficiency(player, state.currentGw);
        const ratings = getPlayerRatings(player, state.currentGw);
        const grades = `${ratings.expectedMinutes}${ratings.next5Fixtures}${ratings.attackingRole}${ratings.attackingPotential}${ratings.defconPotential === 'N/A' ? '-' : ratings.defconPotential}${ratings.availability}`;

        return `
            <div class="analysis-stats-grid">
                <div class="stat-pill" title="Avg FDR">
                    <span class="stat-pill-label">Avg FDR</span>
                    <span class="stat-pill-val fdr-${Math.round(parseFloat(fdr))}">${fdr}</span>
                </div>
                <div class="stat-pill" title="Mins, Fixt, Role, AttPot, Defcon, Avail">
                    <span class="stat-pill-label">Grades</span>
                    <span class="stat-pill-val" style="color: var(--secondary); letter-spacing: 0.5px;">${grades}</span>
                </div>
                <div class="stat-pill" title="Average grade rating score divided by price">
                    <span class="stat-pill-label">Efficiency</span>
                    <span class="stat-pill-val" style="color: var(--primary);">${eff.toFixed(2)}</span>
                </div>
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

        // 5. Rating Efficiency
        const outEff = outPlayer ? getPlayerEfficiency(outPlayer, state.currentGw) : 0;
        const inEff = getPlayerEfficiency(inPlayer, state.currentGw);
        if (inEff > outEff) {
            reasons.push(`<strong>Higher Efficiency:</strong> Value-for-money rating efficiency improves from ${outEff.toFixed(2)} to ${inEff.toFixed(2)}.`);
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
        let optimizedSquadSlots = JSON.parse(JSON.stringify(activeSquadSlots)); // deep clone
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
        optimizedSquadSlots.forEach(s => {
            if (s.playerId !== null) {
                initUsedIds.push(s.playerId);
            }
        });

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

        const getCheapestPlayersList = (pos, count, usedIds, forceGuaranteed = false) => {
            const list = pos === 'GKP' ? cheapestGKPs : (pos === 'DEF' ? cheapestDEFs : (pos === 'MID' ? cheapestMIDs : cheapestFWDs));
            const result = [];
            for (const p of list) {
                if (!usedIds.includes(p.id)) {
                    if (forceGuaranteed && !isGuaranteedStart(p)) continue;
                    result.push(p);
                    usedIds.push(p.id);
                    if (result.length === count) break;
                }
            }
            // Fallback: if we didn't find enough players matching the guaranteed start criteria, grab from the list without checking it
            if (result.length < count) {
                for (const p of list) {
                    if (!usedIds.includes(p.id)) {
                        result.push(p);
                        usedIds.push(p.id);
                        if (result.length === count) break;
                    }
                }
            }
            return result;
        };

        // Initialize starting slots first (with cheapest playing) if they are not locked
        for (const idx of startingIndices) {
            const slot = optimizedSquadSlots[idx];
            if (!slot.locked && slot.playerId === null) {
                const cheapest = getCheapestPlayersList(slot.position, 1, initUsedIds, true)[0];
                slot.playerId = cheapest ? cheapest.id : null;
            }
        }
        // Initialize bench slots (with cheapest, trying to respect guaranteed start if possible) if they are not locked
        for (const idx of benchIndices) {
            const slot = optimizedSquadSlots[idx];
            if (!slot.locked && slot.playerId === null) {
                const cheapest = getCheapestPlayersList(slot.position, 1, initUsedIds, true)[0];
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

                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots);
                
                // Cost of other starting players
                const otherStartingCost = startingIndices.reduce((sum, sIdx) => {
                    if (sIdx === idx) return sum;
                    const pId = optimizedSquadSlots[sIdx].playerId;
                    const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
                    return sum + (p ? p.price : 0);
                }, 0);

                const maxBudgetForSlot = maxStartingBudget - otherStartingCost;
                const usedStartingIds = startingIndices.filter(sIdx => sIdx !== idx).map(sIdx => optimizedSquadSlots[sIdx].playerId).filter(id => id !== null);
                
                let candidates = PLAYERS.filter(p => 
                    p.position === currentSlot.position && 
                    !usedStartingIds.includes(p.id) && 
                    p.price <= maxBudgetForSlot &&
                    !state.mustExclude.includes(p.id)
                );

                const guaranteedCandidates = candidates.filter(isGuaranteedStart);
                if (guaranteedCandidates.length > 0) {
                    candidates = guaranteedCandidates;
                }
                candidates.sort((a, b) => getSolverScore(b) - getSolverScore(a));

                let bestCandidate = null;
                let bestPts = currentSquadPts;

                for (const cand of candidates) {
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
                        const oldId = currentSlot.playerId;
                        currentSlot.playerId = cand.id;
                        const newSquadPts = getSquadExpectedPts(optimizedSquadSlots);
                        currentSlot.playerId = oldId; // Swap back

                        if (newSquadPts > bestPts) {
                            bestPts = newSquadPts;
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

                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots);
                
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

                let candidates = PLAYERS.filter(p => 
                    p.position === currentSlot.position && 
                    !unavailableIds.includes(p.id) && 
                    p.price <= maxBudgetForSlot &&
                    getSolverScore(p) >= 0.5 &&
                    !state.mustExclude.includes(p.id)
                );

                const guaranteedCandidates = candidates.filter(isGuaranteedStart);
                if (guaranteedCandidates.length > 0) {
                    candidates = guaranteedCandidates;
                }
                candidates.sort((a, b) => getSolverScore(b) - getSolverScore(a));

                let bestCandidate = null;
                let bestPts = currentSquadPts;

                for (const cand of candidates) {
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
                        const oldId = currentSlot.playerId;
                        currentSlot.playerId = cand.id;
                        const newSquadPts = getSquadExpectedPts(optimizedSquadSlots);
                        currentSlot.playerId = oldId; // Swap back

                        if (newSquadPts > bestPts) {
                            bestPts = newSquadPts;
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

                let candidates = PLAYERS.filter(p => 
                    p.position === slot.position && 
                    !currentSquadIds.includes(p.id) && 
                    p.price <= maxPrice &&
                    !state.mustExclude.includes(p.id)
                );

                const guaranteedCandidates = candidates.filter(isGuaranteedStart);
                if (guaranteedCandidates.length > 0) {
                    candidates = guaranteedCandidates;
                } else if (!isBenchSlot) {
                    candidates = [];
                }

                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots);

                for (const cand of candidates) {
                    if (isBenchSlot) {
                        const newBenchCost = currentBenchCost - playerPrice + cand.price;
                        if (newBenchCost > minBenchBudget) {
                            continue; // Skip this candidate, it exceeds the reserved bench budget!
                        }
                    }

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
                        const oldId = slot.playerId;
                        slot.playerId = cand.id;
                        const newSquadPts = getSquadExpectedPts(optimizedSquadSlots);
                        slot.playerId = oldId; // Swap back

                        const gain = newSquadPts - currentSquadPts;

                        // Upgrade if we get more points, or if points are equal but the player is more expensive (to spend down budget)
                        const isBetter = gain > bestPtsGain;
                        const isSamePtsButMoreExpensive = Math.abs(gain - bestPtsGain) < 0.01 && bestUpgrade && cand.price > bestUpgrade.price;

                        if (isBetter || isSamePtsButMoreExpensive) {
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
        const totalOriginalPts = getSquadExpectedPts(activeSquadSlots);
        const totalOptimizedPts = getSquadExpectedPts(optimizedSquadSlots);

        for (let i = 0; i < activeSquadSlots.length; i++) {
            const originalId = activeSquadSlots[i].playerId;
            const optimizedId = optimizedSquadSlots[i].playerId;
            
            const originalPlayer = originalId !== null ? PLAYERS.find(p => p.id === originalId) : null;
            const optimizedPlayer = optimizedId !== null ? PLAYERS.find(p => p.id === optimizedId) : null;

            if (originalId !== optimizedId) {
                const inPts1Gw = optimizedPlayer ? (optimizedPlayer.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0) : 0;
                const outPts1Gw = originalPlayer ? (originalPlayer.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0) : 0;
                upgrades.push({
                    slotIndex: i,
                    out: originalPlayer,
                    in: optimizedPlayer,
                    gain: (optimizedPlayer ? getSolverScore(optimizedPlayer) : 0) - (originalPlayer ? getSolverScore(originalPlayer) : 0),
                    gain1Gw: inPts1Gw - outPts1Gw
                });
            }
        }

        const overallGain = totalOptimizedPts - totalOriginalPts;
        const overallGain1Gw = getSquadPointsForHorizon(optimizedSquadSlots, 1) - getSquadPointsForHorizon(activeSquadSlots, 1);
        const gainLabel = objective === 'efficiency' ? 'Overall Efficiency' : 'Overall XP';
        const formattedGain = objective === 'efficiency' ? `+${(overallGain / 10).toFixed(2)}` : `+${overallGain.toFixed(1)}`;

        resultsGrid.innerHTML = `
            <div class="optimizer-card" style="grid-column: span 2;">
                <h3><i data-lucide="sparkles" class="highlight-transfers"></i> Preseason AI Full-Squad Optimization</h3>
                <div class="recommendations-list" style="margin-top: 16px;">
                    ${upgrades.length > 0 ? `
                        <div class="rec-option-box">
                            <div class="rec-option-header" style="margin-bottom: 16px;">
                                <span class="rec-badge" style="background: rgba(0, 255, 136, 0.1); color: var(--primary); border-color: rgba(0, 255, 136, 0.2);">UNLIMITED UPGRADES ENABLED</span>
                                <span class="rec-pts-gain">+${overallGain.toFixed(1)} XP (${horizon}-GW) • +${overallGain1Gw.toFixed(1)} XP (Next GW)</span>
                            </div>
                            
                            <div style="display:flex; flex-direction:column; gap:20px;">
                                ${upgrades.map(up => {
                                    const currentSquadIds = activeSquadSlots.map(s => s.playerId).filter(id => id !== null);
                                    const outPrice = up.out ? up.out.price : 0;
                                    const budgetOk = bank + outPrice - up.in.price >= -0.01;

                                    const hypSquad = currentSquadIds.filter(id => id !== (up.out ? up.out.id : null));
                                    hypSquad.push(up.in.id);
                                    const teamCounts = {};
                                    let teamOk = true;
                                    for (const id of hypSquad) {
                                        const p = PLAYERS.find(pl => pl.id === id);
                                        if (p) {
                                            teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
                                            if (teamCounts[p.team] > 3) {
                                                teamOk = false;
                                                break;
                                            }
                                        }
                                    }
                                    const canApply = budgetOk && teamOk;
                                    const isDowngrade = up.gain < -0.01;
                                    const badgeBg = isDowngrade ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 255, 136, 0.1)';
                                    const badgeColor = isDowngrade ? '#ef4444' : 'var(--primary)';
                                    const badgeBorder = isDowngrade ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 255, 136, 0.2)';
                                    const badgeLabel = isDowngrade ? 'BUDGET DOWNGRADED' : 'POINTS UPGRADED';

                                    return `
                                        <div class="rec-row-preseason">
                                            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
                                                <div class="transfer-player-card player-card-out" style="flex:1;">
                                                    <span class="player-name-main">${up.out ? up.out.name : 'Empty Slot'}</span>
                                                    <span class="player-team-sub">${up.out ? `${up.out.team} • £${up.out.price.toFixed(1)}m` : 'N/A'}</span>
                                                    ${up.out ? renderPlayerStatsBreakdown(up.out) : ''}
                                                </div>
                                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:12px;">
                                                    <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="margin: 0 0 6px 0;"></i>
                                                    <span class="pill-value" style="font-size:10px; background:${badgeBg}; color:${badgeColor}; border: 1px solid ${badgeBorder}; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                                                        ${up.gain >= 0 ? '+' : ''}${up.gain.toFixed(1)} (${horizon}G) • ${up.gain1Gw >= 0 ? '+' : ''}${up.gain1Gw.toFixed(1)} (Next)
                                                    </span>
                                                    <span style="font-size: 8px; font-weight: 800; color: ${badgeColor}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${badgeLabel}</span>
                                                </div>
                                                <div class="transfer-player-card player-card-in" style="flex:1;">
                                                    <span class="player-name-main">${up.in.name}</span>
                                                    <span class="player-team-sub">${up.in.team} • £${up.in.price.toFixed(1)}m</span>
                                                    ${renderPlayerStatsBreakdown(up.in)}
                                                </div>
                                            </div>
                                            
                                            ${isDowngrade ? `
                                                <div style="font-size: 10px; color: var(--text-muted); margin-top: 8px; text-align: center;">
                                                    <i data-lucide="info" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"></i>
                                                    Budget release: Frees up <strong>£${(up.out.price - up.in.price).toFixed(1)}m</strong> for upgrades.
                                                </div>
                                            ` : ''}

                                            ${getOptimizationExplanation(up.out, up.in)}
                                            
                                            <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                                                ${!canApply ? `
                                                    <span style="font-size: 9px; color: #ef4444; font-weight: 500;">
                                                        ${!budgetOk ? 'Insufficient budget' : 'Team limit exceeded (max 3)'}
                                                    </span>
                                                ` : ''}
                                                <button class="apply-rec-btn apply-single-preseason-btn" 
                                                        data-slot-idx="${up.slotIndex}" 
                                                        data-in-id="${up.in.id}" 
                                                        data-out-id="${up.out ? up.out.id : 'null'}"
                                                        style="width: auto; padding: 4px 12px; font-size: 11px; height: 26px; border-radius: 6px; margin: 0;"
                                                        ${!canApply ? 'disabled' : ''}>
                                                    Apply Swap
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            
                            <div class="optimizer-info-banner" style="margin-top: 16px; font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.01); padding: 12px; border-radius: 8px; border-left: 3px solid var(--primary); line-height: 1.6;">
                                <i data-lucide="info" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px; color: var(--primary);"></i>
                                <strong>Horizon Points Calibration:</strong> The cumulative gain of <strong>${formattedGain} ${gainLabel}</strong> is calculated over the full <strong>${horizon}-Gameweek horizon</strong>. The immediate point difference for next week's single gameweek may be smaller (e.g. +0.6 XP), with the rest of the improvement realized across future gameweeks due to optimal long-term fixture schedules and expected minutes.
                            </div>
                            <button class="apply-rec-btn" id="applyAllPreseasonBtn" style="margin-top: 24px; width:100%;">Apply All AI Upgrades</button>
                        </div>
                    ` : `
                        <div class="transfer-list-empty">Your current squad is mathematically optimized for a ${horizon}-Gameweek horizon! No upgrades found.</div>
                    `}
                </div>
            </div>
            <div id="aiStrategistReportContainer" style="grid-column: span 2; margin-top: 24px;"></div>
        `;

        const reportContainer = resultsGrid.querySelector('#aiStrategistReportContainer');
        if (reportContainer) {
            generateAIStrategistReport(reportContainer, state, actions, optimizedSquadSlots, bank, horizon);
        }

        const applyAllBtn = resultsGrid.querySelector('#applyAllPreseasonBtn');
        if (applyAllBtn) {
            applyAllBtn.addEventListener('click', () => {
                state.squadSlots = optimizedSquadSlots;
                state.optimizeCaptaincy();

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

        const applySingleBtns = resultsGrid.querySelectorAll('.apply-single-preseason-btn');
        applySingleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const slotIdx = parseInt(btn.getAttribute('data-slot-idx'));
                const inId = parseInt(btn.getAttribute('data-in-id'));
                const outIdStr = btn.getAttribute('data-out-id');
                const outId = outIdStr !== 'null' ? parseInt(outIdStr) : null;
                
                state.squadSlots[slotIdx].playerId = inId;
                state.optimizeCaptaincy();
                state.saveState();
                
                const pIn = PLAYERS.find(p => p.id === inId);
                const pOut = outId !== null ? PLAYERS.find(p => p.id === outId) : null;
                
                actions.renderActiveView();
                actions.showToast(`Applied swap: ${pIn.name} in for ${pOut ? pOut.name : 'empty slot'}`, 'success');
            });
        });
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

            const sellBudget = soldPlayer.price + bank;

            let candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !currentSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                !state.mustExclude.includes(p.id)
            );

            const guaranteedCandidates = candidates.filter(isGuaranteedStart);
            if (guaranteedCandidates.length > 0) {
                candidates = guaranteedCandidates;
            }

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

                // Calculate squad gain
                const tempSlots = JSON.parse(JSON.stringify(activeSquadSlots));
                const targetSlot = tempSlots.find(s => s.playerId === soldId);
                if (targetSlot) targetSlot.playerId = boughtPlayer.id;

                const gain = getSquadExpectedPts(tempSlots) - getSquadExpectedPts(activeSquadSlots);

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

                const sellBudget = s1.price + s2.price + bank;

                let candidates1 = PLAYERS.filter(p => 
                    p.position === s1.position && 
                    !currentSquadIds.includes(p.id) &&
                    !state.mustExclude.includes(p.id)
                );
                const g1 = candidates1.filter(isGuaranteedStart);
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
                    !state.mustExclude.includes(p.id)
                );
                const g2 = candidates2.filter(isGuaranteedStart);
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

                        const gain = getSquadExpectedPts(tempSlots) - getSquadExpectedPts(activeSquadSlots);

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

        // Calculate 1-GW expected points gains for display comparison
        let best1Tx1GwGain = 0;
        if (best1Tx) {
            const tempSlots = JSON.parse(JSON.stringify(activeSquadSlots));
            const slot = tempSlots.find(s => s.playerId === best1Tx.out.id);
            if (slot) slot.playerId = best1Tx.in.id;
            best1Tx1GwGain = getSquadPointsForHorizon(tempSlots, 1) - getSquadPointsForHorizon(activeSquadSlots, 1);
        }

        let best2Tx1GwGain = 0;
        if (best2Tx) {
            const tempSlots = JSON.parse(JSON.stringify(activeSquadSlots));
            const slot1 = tempSlots.find(s => s.playerId === best2Tx.out1.id);
            const slot2 = tempSlots.find(s => s.playerId === best2Tx.out2.id);
            if (slot1) slot1.playerId = best2Tx.in1.id;
            if (slot2) slot2.playerId = best2Tx.in2.id;
            best2Tx1GwGain = getSquadPointsForHorizon(tempSlots, 1) - getSquadPointsForHorizon(activeSquadSlots, 1);
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
                                <span class="rec-pts-gain">+${best1Tx.gain.toFixed(1)} XP (${horizon}-GW) • +${best1Tx1GwGain.toFixed(1)} XP (Next GW)</span>
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
                            <div class="optimizer-info-banner" style="margin-top: 12px; font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.01); padding: 10px; border-radius: 6px; border-left: 3px solid var(--primary); line-height: 1.5;">
                                <i data-lucide="info" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px; color: var(--primary);"></i>
                                <strong>Horizon Points Calibration:</strong> This transfer is expected to yield <strong>+${best1Tx.gain.toFixed(1)} XP</strong> over the next 5 weeks. The immediate points increase for next week's single gameweek is <strong>+${best1Tx1GwGain.toFixed(1)} XP</strong>, with the remaining points improvement realized in subsequent weeks.
                            </div>
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
                        ${best2Tx && (objective === 'efficiency' ? best2Tx.gain > 0.1 : best2Tx.gain > 0.5) ? `
                            <div class="rec-option-box">
                                <div class="rec-option-header" style="margin-bottom: 12px;">
                                    <span class="rec-badge" style="background:rgba(0, 242, 254, 0.1); color: var(--secondary); border-color: var(--secondary-glow)">HIGH IMPACT</span>
                                    <span class="rec-pts-gain">+${best2Tx.gain.toFixed(1)} XP (${horizon}-GW) • +${best2Tx1GwGain.toFixed(1)} XP (Next GW)</span>
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
        
                                <div class="optimizer-info-banner" style="margin-top: 12px; font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.01); padding: 10px; border-radius: 6px; border-left: 3px solid var(--primary); line-height: 1.5;">
                                    <i data-lucide="info" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px; color: var(--primary);"></i>
                                    <strong>Horizon Points Calibration:</strong> This double transfer is expected to yield <strong>+${best2Tx.gain.toFixed(1)} XP</strong> over the next 5 weeks. The immediate points increase for next week's single gameweek is <strong>+${best2Tx1GwGain.toFixed(1)} XP</strong>, with the remaining points improvement realized in subsequent weeks.
                                </div>
                                <button class="apply-rec-btn" id="applyDoubleBtn" style="margin-top: 16px; width: 100%;">Apply Both Transfers</button>
                            </div>
                        ` : `
                            <div class="transfer-list-empty">Current squad is optimized. No beneficial double transfer found.</div>
                        `}
                    </div>
                </div>
            ` : ''}
            <div id="aiStrategistReportContainer" style="grid-column: span 2; margin-top: 24px;"></div>
        `;

        const reportContainer = resultsGrid.querySelector('#aiStrategistReportContainer');
        if (reportContainer) {
            const optimizedSquadSlots = JSON.parse(JSON.stringify(activeSquadSlots));
            // Apply recommended single transfer as default optimization squad report
            if (best1Tx && best1Tx.gain > 0.1) {
                const slotOut = optimizedSquadSlots.find(s => s.playerId === best1Tx.out.id);
                if (slotOut) slotOut.playerId = best1Tx.in.id;
            }
            generateAIStrategistReport(reportContainer, state, actions, optimizedSquadSlots, bank, horizon);
        }

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

function generateAIStrategistReport(reportContainer, state, actions, squadSlots, bank, horizon) {
    reportContainer.innerHTML = `
        <div class="optimizer-card" style="padding: 24px; position: relative; overflow: hidden; background: linear-gradient(135deg, var(--bg-card), rgba(0, 242, 254, 0.05)); border: 1px solid rgba(0, 242, 254, 0.25);">
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
                <i data-lucide="brain" style="color: var(--secondary); width: 20px; height: 20px;"></i>
                Elite FPL AI Strategist Report
            </h3>
            <div id="aiReportText" style="font-size: 13px; line-height: 1.6; color: var(--text-muted); display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; justify-content: center; padding: 24px 0;">
                    <i data-lucide="loader" class="animate-spin" style="color: var(--secondary); width: 24px; height: 24px;"></i>
                    <span style="font-weight: 600; color: var(--text-main);">Analyzing optimized squad and generating strategist report...</span>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();

    const apiKey = localStorage.getItem('fpl_hub_gemini_api_key');
    const squadPlayers = squadSlots.map(s => s.playerId ? PLAYERS.find(p => p.id === s.playerId) : null).filter(p => p !== null);
    
    const starters = squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => PLAYERS.find(p => p.id === s.playerId));
    const bench = squadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => PLAYERS.find(p => p.id === s.playerId));

    const bestPlayer = [...starters].sort((a, b) => {
        const predA = a.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        const predB = b.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        return predB - predA;
    })[0];
    const secondBestPlayer = starters.filter(p => p !== bestPlayer).sort((a, b) => {
        const predA = a.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        const predB = b.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        return predB - predA;
    })[0] || bestPlayer;

    const differentials = squadPlayers.filter(p => p.ownership < 15).slice(0, 3);
    
    let squadDesc = `\n**Starting XI:**\n`;
    starters.forEach(p => {
        squadDesc += `- ${p.name} (${p.position}, ${p.team}, £${p.price.toFixed(1)}m, expected points next ${horizon} GWs: ${(p.predictions.filter(pr => pr.gw >= state.currentGw && pr.gw < state.currentGw + horizon).reduce((s, pr) => s + pr.pts, 0)).toFixed(1)} XP)\n`;
    });
    squadDesc += `\n**Bench:**\n`;
    bench.forEach((p, idx) => {
        squadDesc += `- Bench Slot ${idx + 1}: ${p.name} (${p.position}, ${p.team}, £${p.price.toFixed(1)}m)\n`;
    });

    if (apiKey) {
        const promptText = `
You are an elite Fantasy Premier League (FPL) strategist. Your task is to build the strongest possible FPL squad for the current season.
Before selecting players:
Read and apply the official Fantasy Premier League rules, including:
- Squad budget (£100.0m total)
- Position requirements (2 GKPs, 5 DEFs, 5 MIDs, 3 FWDs)
- Maximum three players per Premier League club
- Bench rules
- Captain and vice-captain
- Chips (Wildcard, Bench Boost, Triple Captain, Free Hit)
- Transfers and price changes

Research the latest information available, including:
- Current player prices
- Expected minutes
- Injury news
- Suspensions
- Predicted starting line-ups
- Pre-season form
- Set-piece duties
- Expected Goals (xG)
- Expected Assists (xA)
- Clean sheet odds
- Fixture Difficulty Ratings
- Bookmakers’ anytime goalscorer odds
- Team attacking and defensive strength
- Expert FPL consensus where appropriate

Optimise the squad to maximise expected points over the first 6-8 Gameweeks, not just Gameweek 1.
Prioritise:
- Value for money
- Reliable starters
- Strong captaincy options
- Players with favourable opening fixtures
- High upside players with good underlying statistics

Avoid:
- Rotation risks unless justified
- Players returning from injury without expected minutes
- Players with difficult opening fixtures unless they are essential premium picks

Here is the current optimized squad we selected for you:
${squadDesc}

Remaining Bank: £${bank.toFixed(1)}m
Forced Include Players: ${state.mustInclude.map(id => PLAYERS.find(p => p.id === id)?.name).filter(n => !!n).join(', ') || 'None'}
Forced Exclude Players: ${state.mustExclude.map(id => PLAYERS.find(p => p.id === id)?.name).filter(n => !!n).join(', ') || 'None'}
Optimization Horizon: ${horizon} Gameweeks

After selecting the squad:
1. Explain why every player was chosen.
2. State how much money remains in the bank.
3. Recommend the starting XI.
4. Recommend captain and vice-captain.
5. Explain the bench order.
6. Identify 3 differential picks.
7. Suggest the first transfer if everything goes to plan.
8. Suggest contingency transfers if a key player gets injured.
9. Give the expected strengths and weaknesses of the squad.
10. If there are any uncertainties (injuries, transfers, expected line-ups), explain your assumptions before finalising the team.

Write a detailed, structured markdown response. Highlight key strategic decisions. Be professional and authoritative.
`;

        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        })
        .then(response => response.json())
        .then(data => {
            const reportText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reportText) {
                renderMarkdownReport(reportContainer, reportText, true);
            } else {
                throw new Error("Invalid API response format");
            }
        })
        .catch(err => {
            console.error(err);
            renderMarkdownReport(reportContainer, `**Error generating live Gemini report:** ${err.message}. Falling back to local analysis engine below.`, false);
            setTimeout(() => {
                const fallbackText = getLocalReportMarkdown(squadPlayers, starters, bench, bank, horizon, bestPlayer, secondBestPlayer, differentials, state);
                renderMarkdownReport(reportContainer, fallbackText, false);
            }, 1500);
        });
    } else {
        setTimeout(() => {
            const reportText = getLocalReportMarkdown(squadPlayers, starters, bench, bank, horizon, bestPlayer, secondBestPlayer, differentials, state);
            renderMarkdownReport(reportContainer, reportText, false);
        }, 800);
    }
}

function getLocalReportMarkdown(squadPlayers, starters, bench, bank, horizon, bestPlayer, secondBestPlayer, differentials, state) {
    let markdown = `
### FPL Strategist Squad Analysis & GW1 Plan
*Analyzing performance metrics, expected value, and opening schedules for a **${horizon}-Gameweek** horizon.*

---

#### 1. Player-by-Player Selection Rationale
Here is why each of your squad players is recommended by our optimization model:
`;

    squadPlayers.forEach(p => {
        let blurb = '';
        if (p.price >= 11.0) {
            blurb = `Elite premium asset and reliable captaincy choice. Has projected stats of ${p.predictions.find(pr=>pr.gw===state.currentGw)?.pts.toFixed(1)} expected points for the opening match.`;
        } else if (p.position === 'DEF' && p.price >= 6.0) {
            blurb = `Premium defensive asset with high clean sheet potential and offensive threat from set-pieces/crosses.`;
        } else if (p.price <= 5.5) {
            blurb = `Exceptional budget enabler showing reliable expected starting minutes and solid value per million.`;
        } else {
            blurb = `Core mid-priced selection with strong fixtures and high xGI numbers.`;
        }
        markdown += `- **${p.name}** (${p.position}, £${p.price.toFixed(1)}m): ${blurb}\n`;
    });

    markdown += `
#### 2. Remaining Budget in Bank
- **Bank Balance:** **£${bank.toFixed(1)}m** remains in the bank. This capital is reserved to facilitate quick transfers or capture future price rises.

#### 3. Recommended Starting XI
Your strongest starting 11 based on mathematically projected points for Gameweek ${state.currentGw}:
- **Goalkeeper:** ${starters.filter(p=>p.position==='GKP').map(p=>p.name).join(', ')}
- **Defenders:** ${starters.filter(p=>p.position==='DEF').map(p=>p.name).join(', ')}
- **Midfielders:** ${starters.filter(p=>p.position==='MID').map(p=>p.name).join(', ')}
- **Forwards:** ${starters.filter(p=>p.position==='FWD').map(p=>p.name).join(', ')}

#### 4. Captain & Vice-Captain Recommendations
- 👑 **Captain:** **${bestPlayer ? bestPlayer.name : 'None'}** — Projecting the highest expected points for GW${state.currentGw} (${(bestPlayer ? (bestPlayer.predictions.find(pr=>pr.gw===state.currentGw)?.pts || 0) : 0).toFixed(1)} XP).
- 🪙 **Vice-Captain:** **${secondBestPlayer ? secondBestPlayer.name : 'None'}** — Next highest predicted value in starting 11, serving as a reliable backup captain.

#### 5. Bench Ordering Logic
To prevent points from being lost to unexpected rotations, the bench has been ordered logically by position and value:
1. **Slot 1 (GK):** ${bench.find(p=>p.position==='GKP')?.name || 'None'} — Secondary goalkeeper.
2. **Slot 2 (1st Sub):** ${bench.filter(p=>p.position!=='GKP')[0]?.name || 'None'} — Highest expected points backup.
3. **Slot 3 (2nd Sub):** ${bench.filter(p=>p.position!=='GKP')[1]?.name || 'None'}
4. **Slot 4 (3rd Sub):** ${bench.filter(p=>p.position!=='GKP')[2]?.name || 'None'}

#### 6. Differential Picks (Low Ownership Upside)
These 3 low-ownership assets can help you gain a significant rank advantage early on:
${differentials.length > 0 ? differentials.map(p => `- **${p.name}** (${p.team}, £${p.price.toFixed(1)}m) — Ownership: **${p.ownership.toFixed(1)}%**`).join('\n') : '- None found under 15%.'}

#### 7. Planned First Transfer (GW2/GW3)
- If everything goes to plan, the first transfer strategy will be to upgrade a budget defender or roll the transfer to gain a 2-FT advantage. Target players with high FDR spikes after GW3.

#### 8. Injury Contingencies
- If a premium asset gets injured, replace them immediately with an equivalent priced key-player (e.g. Haaland $\\rightarrow$ Watkins/Isak, Salah $\\rightarrow$ Palmer/Saka) to avoid point hits.

#### 9. Squad Strengths & Weaknesses
- **Strengths:** High captaincy upside, strict budget compliance, and balanced starting XI expected points value.
- **Weaknesses:** Slight susceptibility to bench rotation points loss if double starts are missed.
`;
    return markdown;
}

function renderMarkdownReport(reportContainer, text, isLive) {
    const reportTextDiv = reportContainer.querySelector('#aiReportText');
    if (!reportTextDiv) return;

    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/^### (.*$)/gim, '<h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--secondary); margin-top: 16px; margin-bottom: 8px;">$1</h3>')
        .replace(/^#### (.*$)/gim, '<h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: var(--text-main); margin-top: 14px; margin-bottom: 6px;">$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main);">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\- (.*$)/gim, '<li style="margin-left: 16px; list-style-type: disc; margin-bottom: 4px;">$1</li>')
        .replace(/\n$/gim, '<br />');

    html = html.split('\n\n').map(p => {
        if (p.trim().startsWith('<h') || p.trim().startsWith('<li')) return p;
        return `<p style="margin-bottom: 12px; line-height: 1.6;">${p}</p>`;
    }).join('');

    const sourceBadge = isLive 
        ? `<span style="font-size: 10px; font-weight: 700; background: rgba(0, 242, 254, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--secondary-glow); align-self: flex-start;">GEMINI 1.5 FLASH LIVE REPORT</span>`
        : `<span style="font-size: 10px; font-weight: 700; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--border-color); align-self: flex-start;">LOCAL FPL STRATEGIST ENGINE</span>`;

    reportTextDiv.innerHTML = `
        ${sourceBadge}
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px;">
            ${html}
        </div>
    `;
    lucide.createIcons();
}
