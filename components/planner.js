import { PLAYERS, TEAMS, getPlayerRatings } from '../data.js';

export function renderPlanner(container, state, actions) {
    // Determine active squad for this gameweek.
    // The active squad is computed by applying transfers from previous gameweeks up to the current one.
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { starters, bench, bank, freeTransfers } = squadInfo;

    // Calculate total predicted points for starters
    let expectedPoints = 0;
    starters.forEach(id => {
        const player = PLAYERS.find(p => p.id === id);
        if (player) {
            const pred = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
            let multiplier = 1;
            if (id === state.captain) {
                multiplier = state.chips.tripleCaptain ? 3 : 2;
            }
            expectedPoints += pred.pts * multiplier;
        }
    });

    // Add bench points if Bench Boost is active
    if (state.chips.benchBoost) {
        bench.forEach(id => {
            const player = PLAYERS.find(p => p.id === id);
            if (player) {
                const pred = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
                expectedPoints += pred.pts;
            }
        });
    }

    // Deactivate Wildcard if we are in preseason (GW 1)
    if (state.currentGw === 1 && state.chips.wildcard) {
        state.chips.wildcard = false;
        state.saveState();
    }

    const isPreseason = state.currentGw === 1;
    let chipsHtml = '';
    if (!isPreseason) {
        chipsHtml += `
            <button class="pitch-btn ${state.chips.wildcard ? 'active-chip' : ''}" id="chipWildcardBtn" title="Play Wildcard (Unlimited Free Transfers)">
                <i data-lucide="zap"></i> Wildcard
            </button>
        `;
    }
    chipsHtml += `
        <button class="pitch-btn ${state.chips.tripleCaptain ? 'active-chip' : ''}" id="chipTcBtn" title="Play Triple Captain (Captain points tripled)">
            <i data-lucide="award"></i> Triple Capt.
        </button>
        <button class="pitch-btn ${state.chips.benchBoost ? 'active-chip' : ''}" id="chipBbBtn" title="Play Bench Boost (Bench points added to starting XI)">
            <i data-lucide="shield"></i> Bench Boost
        </button>
    `;

    // Calculate AI Squad Rating (0-100) based on total expected points and average player quality
    const ratingScore = Math.min(100, Math.round((expectedPoints / 11) * 15));

    container.innerHTML = `
        <div class="planner-grid">
            <!-- Left Column: The Football Pitch -->
            <div class="pitch-container">
                <div class="pitch-header">
                    <div class="pitch-title-area">
                        <h2>Squad Selection</h2>
                    </div>
                    <div class="pitch-actions">
                        ${chipsHtml}
                        <select id="formationSelect" class="formation-select" style="margin-left: 12px;">
                            <option value="4-3-3" ${state.formation === '4-3-3' ? 'selected' : ''}>4-3-3</option>
                            <option value="4-4-2" ${state.formation === '4-4-2' ? 'selected' : ''}>4-4-2</option>
                            <option value="3-5-2" ${state.formation === '3-5-2' ? 'selected' : ''}>3-5-2</option>
                            <option value="3-4-3" ${state.formation === '3-4-3' ? 'selected' : ''}>3-4-3</option>
                            <option value="4-5-1" ${state.formation === '4-5-1' ? 'selected' : ''}>4-5-1</option>
                            <option value="5-3-2" ${state.formation === '5-3-2' ? 'selected' : ''}>5-3-2</option>
                            <option value="5-4-1" ${state.formation === '5-4-1' ? 'selected' : ''}>5-4-1</option>
                            <option value="5-2-3" ${state.formation === '5-2-3' ? 'selected' : ''}>5-2-3</option>
                        </select>
                        <button class="pitch-btn" id="resetTeamBtn" title="Reset/Clear Team">
                            <i data-lucide="rotate-ccw"></i> Reset Team
                        </button>
                    </div>
                </div>

                <!-- Draft Tabs Bar -->
                <div class="draft-tabs-bar" style="display: flex; gap: 8px; margin: 0 0 16px 0; overflow-x: auto; padding: 4px 0; scrollbar-width: none; align-items: center; width: 100%;">
                    ${state.drafts.map((draft, idx) => `
                        <button class="pitch-btn draft-tab-btn ${state.activeDraftIndex === idx ? 'active-chip' : ''}" data-draft-idx="${idx}" style="flex: 0 0 auto; min-width: 80px; text-transform: none; font-size: 11px; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px; height: 32px;">
                            <i data-lucide="folder" style="width: 12px; height: 12px;"></i>
                            <span>${draft.name}</span>
                        </button>
                    `).join('')}
                    <button class="pitch-btn" id="renameDraftBtn" title="Rename Current Draft" style="flex: 0 0 auto; padding: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: center; height: 32px; width: 32px;">
                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>

                <!-- Football Pitch -->
                <div class="football-pitch" id="pitchBoard">
                    <!-- Top Box (Away GK Box) -->
                    <div class="pitch-box-top"></div>
                    <div class="pitch-half-line"></div>
                    <div class="pitch-center-circle"></div>
                    <!-- Bottom Box (Home GK Box) -->
                    <div class="pitch-box-bottom"></div>

                    <!-- GKP Row -->
                    <div class="pitch-row" data-row="GKP">
                        ${renderPlayerRow(state.squadSlots, "GKP", state.currentGw, state.captain, state.vice, actions)}
                    </div>

                    <!-- DEF Row -->
                    <div class="pitch-row" data-row="DEF">
                        ${renderPlayerRow(state.squadSlots, "DEF", state.currentGw, state.captain, state.vice, actions)}
                    </div>

                    <!-- MID Row -->
                    <div class="pitch-row" data-row="MID">
                        ${renderPlayerRow(state.squadSlots, "MID", state.currentGw, state.captain, state.vice, actions)}
                    </div>

                    <!-- FWD Row -->
                    <div class="pitch-row" data-row="FWD">
                        ${renderPlayerRow(state.squadSlots, "FWD", state.currentGw, state.captain, state.vice, actions)}
                    </div>
                </div>

                <!-- Bench Section -->
                <div class="bench-container">
                    <span class="bench-title">Bench (Click starter to swap with bench)</span>
                    <div class="bench-row" id="benchRow">
                        ${renderBenchRow(state.squadSlots, state.currentGw, state.captain, state.vice, actions)}
                    </div>
                </div>
            </div>

            <!-- Right Column: AI Rating & Transfers List -->
            <div class="planner-side-panel">
                <!-- AI Team Rating -->
                <div class="ai-rating-card">
                    <div class="rating-ring-container">
                        <svg class="rating-svg">
                            <defs>
                                <linearGradient id="rating-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#00f2fe" />
                                    <stop offset="100%" stop-color="#00ff88" />
                                </linearGradient>
                            </defs>
                            <circle class="rating-bg-circle" cx="70" cy="70" r="60"></circle>
                            <circle class="rating-progress-circle" cx="70" cy="70" r="60" id="ratingIndicatorCircle"></circle>
                        </svg>
                        <div class="rating-text">
                            <span class="rating-num">${ratingScore}</span>
                            <span class="rating-max">/ 100</span>
                        </div>
                    </div>
                    <div class="rating-meta">
                        <h3>AI Squad Rating</h3>
                        <p>Expected GW Points: <strong class="highlight-bank">${expectedPoints.toFixed(1)}</strong></p>
                    </div>
                </div>

                <!-- Gameweek Transfers planned -->
                <div class="gw-transfers-card">
                    <h3>
                        <span>GW${state.currentGw} Planned Transfers</span>
                        <span class="pill-value highlight-transfers">${state.currentGw === 1 ? 'Unlimited' : freeTransfers + ' FT'}</span>
                    </h3>
                    <div class="transfer-list" id="plannedTransfersList">
                        ${renderTransfersList(state, actions)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Trigger Lucide icons
    lucide.createIcons();

    // Trigger circular rating animation
    setTimeout(() => {
        const circle = document.getElementById('ratingIndicatorCircle');
        if (circle) {
            const circumference = 2 * Math.PI * 60; // ~377
            const offset = circumference - (ratingScore / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }
    }, 100);

    // Event listeners
    setupPlannerListeners(container, state, actions, starters, bench);
}

function getFdrColor(diff) {
    switch (diff) {
        case 1:
        case 2:
            return '#02b056'; // Green
        case 3:
            return '#94a3b8'; // Grey / Neutral
        case 4:
            return '#e90052'; // Light Red / Pink
        case 5:
            return '#800030'; // Dark Red
        default:
            return '#334155'; // Dark Grey for BYE
    }
}

function renderFdrDots(player, currentGw) {
    let html = '<div class="fdr-dots-container" style="display: inline-flex; gap: 3px; align-items: center; justify-content: center; vertical-align: middle;">';
    for (let gw = currentGw; gw < currentGw + 5; gw++) {
        const pr = player.predictions.find(p => p.gw === gw);
        if (pr) {
            const oppText = pr.opp !== 'BYE' ? `${pr.opp} (${pr.loc})` : 'BYE';
            const fdrColor = getFdrColor(pr.diff);
            html += `<span class="fdr-dot" title="GW${gw}: ${oppText} (FDR ${pr.diff})" style="width: 6px; height: 6px; border-radius: 50%; background-color: ${fdrColor}; display: inline-block;"></span>`;
        } else {
            html += `<span class="fdr-dot" title="GW${gw}: BYE" style="width: 6px; height: 6px; border-radius: 50%; background-color: #334155; display: inline-block;"></span>`;
        }
    }
    html += '</div>';
    return html;
}

function renderFdrFixtures(player, currentGw) {
    let html = '<div class="fdr-fixtures-container" style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; margin: 2px 0;">';
    for (let gw = currentGw; gw < currentGw + 5; gw++) {
        const pr = player.predictions.find(p => p.gw === gw);
        if (pr) {
            const oppText = pr.opp !== 'BYE' ? `${pr.opp} (${pr.loc})` : 'BYE';
            const fdrColor = getFdrColor(pr.diff);
            html += `
                <span class="fdr-fixture-badge" title="GW${gw}: ${oppText} (FDR ${pr.diff})" style="
                    font-size: 8.5px;
                    font-weight: 800;
                    color: #fff;
                    background-color: ${fdrColor};
                    padding: 2px 4px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    display: inline-block;
                    min-width: 42px;
                    text-align: center;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
                ">
                    ${pr.opp}${pr.opp !== 'BYE' ? `(${pr.loc})` : ''}
                </span>
            `;
        } else {
            html += `
                <span class="fdr-fixture-badge" title="GW${gw}: BYE" style="
                    font-size: 8.5px;
                    font-weight: 800;
                    color: #fff;
                    background-color: #334155;
                    padding: 2px 4px;
                    border-radius: 4px;
                    display: inline-block;
                    min-width: 42px;
                    text-align: center;
                ">
                    BYE
                </span>
            `;
        }
    }
    html += '</div>';
    return html;
}

function renderPlayerTooltip(player, currentGw) {
    const ratings = getPlayerRatings(player, currentGw);
    const getBadgeClass = (val) => {
        if (val === 'A') return 'rating-badge-a';
        if (val === 'B') return 'rating-badge-b';
        if (val === 'C') return 'rating-badge-c';
        if (val === 'D') return 'rating-badge-d';
        if (val === 'E') return 'rating-badge-e';
        return 'rating-badge-na';
    };
    
    return `
        <div class="player-card-tooltip">
            <div class="tooltip-title">
                <span>${player.name}</span>
                <span class="tooltip-title-team">${player.team}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">Expected Minutes:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.expectedMinutes)}">${ratings.expectedMinutes}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">Next 5 Fixtures:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.next5Fixtures)}">${ratings.next5Fixtures}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">Attacking Role:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.attackingRole)}">${ratings.attackingRole}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">FPL Attacking:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.attackingPotential)}">${ratings.attackingPotential}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">Defcon Potential:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.defconPotential)}">${ratings.defconPotential}</span>
            </div>
            <div class="tooltip-rating-row">
                <span class="tooltip-rating-label">Availability:</span>
                <span class="tooltip-rating-value ${getBadgeClass(ratings.availability)}">${ratings.availability}</span>
            </div>
        </div>
    `;
}

function renderPlayerRow(squadSlots, position, currentGw, captain, vice, actions) {
    const rowSlots = squadSlots.filter(s => s.position === position && s.isStarting);

    return rowSlots.map((slot, index) => {
        if (slot.playerId === null) {
            const slotIndex = squadSlots.indexOf(slot);
            return `
                <div class="player-pitch-card empty-slot" data-slot-index="${slotIndex}" data-position="${position}" data-type="starter">
                    <div class="shirt-icon-wrapper">
                        <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div class="player-card-info">
                        <div class="player-pitch-name">Add ${position}</div>
                        <div class="player-pitch-points">Empty Slot</div>
                    </div>
                </div>
            `;
        }
        
        const player = PLAYERS.find(p => p.id === slot.playerId);
        if (!player) return '';

        const prediction = player.predictions.find(pr => pr.gw === currentGw) || { pts: 0, opp: "BYE", loc: "" };
        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: "#ffffff" };
        
        let designationBadge = '';
        if (player.id === captain) {
            designationBadge = `<span class="badge-captain">C</span>`;
        } else if (player.id === vice) {
            designationBadge = `<span class="badge-vice">V</span>`;
        }

        return `
            <div class="player-pitch-card" data-id="${player.id}" data-type="starter">
                <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player">&times;</button>
                <div class="shirt-icon-wrapper">
                    ${getShirtSVG(teamObj.color, player.team)}
                    ${designationBadge}
                    ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="Transferred from ${player.oldTeam}">⇆</div>` : ''}
                </div>
                <div class="player-card-info">
                    <div class="player-pitch-name">${actions.getWebName(player.name)}</div>
                    <div class="player-pitch-points">£${player.price.toFixed(1)}m • ${prediction.pts.toFixed(1)} XP</div>
                    <div class="player-pitch-points-sub" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 2px;">
                        ${renderFdrDots(player, currentGw)}
                        <span style="opacity: 0.6;">•</span>
                        <span>5-GW: ${player.xp5 !== undefined ? player.xp5.toFixed(1) : 'N/A'} XP</span>
                    </div>
                </div>
                ${renderPlayerTooltip(player, currentGw)}
            </div>
        `;
    }).join('');
}

function renderBenchRow(squadSlots, currentGw, captain, vice, actions) {
    const benchSlots = squadSlots.filter(s => !s.isStarting);
    const labels = ["GKP", "1. DEF", "2. DEF", "3. FWD"];
    return benchSlots.map((slot, index) => {
        const label = labels[index] || "SUB";
        const slotIndex = squadSlots.indexOf(slot);
        
        if (slot.playerId === null) {
            return `
                <div class="bench-slot-wrapper" style="width: 22%; display: flex; flex-direction: column; align-items: center;">
                    <span class="bench-slot-label">${label}</span>
                    <div class="player-pitch-card empty-slot" data-slot-index="${slotIndex}" data-position="${slot.position}" data-type="bench" style="width: 100%;">
                        <div class="shirt-icon-wrapper">
                            <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
                        </div>
                        <div class="player-card-info">
                            <div class="player-pitch-name">Add ${slot.position}</div>
                            <div class="player-pitch-points">Empty Slot</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const player = PLAYERS.find(p => p.id === slot.playerId);
        if (!player) return '';
        const prediction = player.predictions.find(pr => pr.gw === currentGw) || { pts: 0, opp: "BYE", loc: "" };
        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: "#ffffff" };

        let designationBadge = '';
        if (player.id === captain) {
            designationBadge = `<span class="badge-captain">C</span>`;
        } else if (player.id === vice) {
            designationBadge = `<span class="badge-vice">V</span>`;
        }

        return `
            <div class="bench-slot-wrapper" style="width: 22%; display: flex; flex-direction: column; align-items: center;">
                <span class="bench-slot-label">${label}</span>
                <div class="player-pitch-card" data-id="${player.id}" data-type="bench" data-index="${index}" style="width: 100%;">
                    <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player">&times;</button>
                    <div class="shirt-icon-wrapper">
                        ${getShirtSVG(teamObj.color, player.team)}
                        ${designationBadge}
                        ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="Transferred from ${player.oldTeam}">⇆</div>` : ''}
                    </div>
                    <div class="player-card-info">
                        <div class="player-pitch-name">${actions.getWebName(player.name)}</div>
                        <div class="player-pitch-points">£${player.price.toFixed(1)}m • ${prediction.pts.toFixed(1)} XP</div>
                        <div class="player-pitch-points-sub" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 2px;">
                            ${renderFdrDots(player, currentGw)}
                            <span style="opacity: 0.6;">•</span>
                            <span>5-GW: ${player.xp5 !== undefined ? player.xp5.toFixed(1) : 'N/A'} XP</span>
                        </div>
                    </div>
                    ${renderPlayerTooltip(player, currentGw)}
                </div>
            </div>
        `;
    }).join('');
}

function renderTransfersList(state, actions) {
    const list = state.transfers[state.currentGw] || [];
    if (list.length === 0) {
        return `<div class="transfer-list-empty">No transfers planned for this Gameweek. Click a player to transfer out.</div>`;
    }

    return list.map((tx, idx) => {
        const pOut = PLAYERS.find(p => p.id === tx.out);
        const pIn = PLAYERS.find(p => p.id === tx.in);
        if (!pOut || !pIn) return '';

        return `
            <div class="transfer-item-row">
                <div class="transfer-player-card player-card-out">
                    <span class="player-name-main">${pOut.name}</span>
                    <span class="player-team-sub">${pOut.team} • DEF OUT</span>
                </div>
                <i data-lucide="arrow-right" class="transfer-arrow-icon"></i>
                <div class="transfer-player-card player-card-in">
                    <span class="player-name-main">${pIn.name}</span>
                    <span class="player-team-sub">${pIn.team} • DEF IN</span>
                </div>
                <button class="remove-transfer-btn" data-index="${idx}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
    }).join('');
}

function setupPlannerListeners(container, state, actions, starters, bench) {
    // Sell/Remove button direct trigger
    container.querySelectorAll('.pitch-sell-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation(); // prevent opening details modal
            const playerId = parseInt(btn.getAttribute('data-id'));
            actions.removePlayer(playerId);
        });
    });

    // Add Player slot click trigger (opens the add player popup modal)
    container.querySelectorAll('.player-pitch-card.empty-slot').forEach(card => {
        card.addEventListener('click', e => {
            const slotIndex = parseInt(card.getAttribute('data-slot-index'));
            const position = card.getAttribute('data-position');
            openAddPlayerModal(container, state, actions, slotIndex, position);
        });
    });

    // Draft Tabs switching
    container.querySelectorAll('.draft-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newIdx = parseInt(btn.getAttribute('data-draft-idx'));
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

            // Save and render
            state.saveState();
            actions.renderActiveView();
            actions.showToast(`Loaded ${targetDraft.name}`, 'success');
        });
    });

    // Draft renaming
    const renameDraftBtn = container.querySelector('#renameDraftBtn');
    if (renameDraftBtn) {
        renameDraftBtn.addEventListener('click', () => {
            const currentDraft = state.drafts[state.activeDraftIndex];
            const newName = prompt("Enter a custom name for this draft:", currentDraft.name);
            if (newName && newName.trim()) {
                currentDraft.name = newName.trim();
                state.saveState();
                actions.renderActiveView();
                actions.showToast(`Draft renamed to "${newName.trim()}"`, 'success');
            }
        });
    }

    // Track if a player is selected to swap
    let selectedForSwap = null;

    container.querySelectorAll('.player-pitch-card:not(.empty-slot)').forEach(card => {
        card.addEventListener('click', e => {
            const playerId = parseInt(card.getAttribute('data-id'));
            const type = card.getAttribute('data-type');
            
            if (selectedForSwap) {
                const swapId = selectedForSwap.id;
                const swapType = selectedForSwap.type;

                container.querySelectorAll('.player-pitch-card').forEach(c => c.style.border = 'none');

                if (swapId === playerId) {
                    selectedForSwap = null;
                    return; // Cancel swap
                }

                actions.swapPlayers(swapId, playerId);
                selectedForSwap = null;
            } else {
                openPlayerDetailModal(playerId, type, starters, bench, state, actions, (swapSelected) => {
                    selectedForSwap = swapSelected;
                    const targetCard = container.querySelector(`.player-pitch-card[data-id="${playerId}"]`);
                    if (targetCard) {
                        targetCard.style.border = '2px dashed var(--primary)';
                        actions.showToast('Select another player to swap positions', 'success');
                    }
                });
            }
        });
    });

    // Delete planned transfers
    container.querySelectorAll('.remove-transfer-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            actions.removeTransfer(state.currentGw, idx);
        });
    });

    // Toggle Chips
    const toggleChip = (chipName) => {
        actions.toggleChip(chipName);
    };

    const wildcardBtn = container.querySelector('#chipWildcardBtn');
    if (wildcardBtn) {
        wildcardBtn.addEventListener('click', () => toggleChip('wildcard'));
    }

    const tcBtn = container.querySelector('#chipTcBtn');
    if (tcBtn) {
        tcBtn.addEventListener('click', () => toggleChip('tripleCaptain'));
    }

    const bbBtn = container.querySelector('#chipBbBtn');
    if (bbBtn) {
        bbBtn.addEventListener('click', () => toggleChip('benchBoost'));
    }

    // Reset Team
    const resetBtn = container.querySelector('#resetTeamBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            openResetModal(state, actions);
        });
    }

    // Formation Select
    const formationSelect = container.querySelector('#formationSelect');
    if (formationSelect) {
        formationSelect.addEventListener('change', () => {
            actions.setFormation(formationSelect.value);
        });
    }
}

// Opens the detail modal when player pitch card is clicked
function openPlayerDetailModal(playerId, type, starters, bench, state, actions, triggerSwapCallback) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    const prediction = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0, opp: "BYE", loc: "" };
    const teamObj = TEAMS.find(t => t.shortName === player.team);

    const isCaptain = state.captain === playerId;
    const isVice = state.vice === playerId;

    const ratings = getPlayerRatings(player, state.currentGw);
    const getBadgeClass = (val) => {
        if (val === 'A') return 'rating-badge-a';
        if (val === 'B') return 'rating-badge-b';
        if (val === 'C') return 'rating-badge-c';
        if (val === 'D') return 'rating-badge-d';
        if (val === 'E') return 'rating-badge-e';
        return 'rating-badge-na';
    };

    const squadInfo = state.getSquadForGw(state.currentGw);
    const squad = [...squadInfo.starters, ...squadInfo.bench];
    const bank = squadInfo.bank;
    
    const comparablePlayers = PLAYERS.filter(p => 
        p.position === player.position && 
        p.id !== player.id &&
        !squad.includes(p.id)
    ).sort((a, b) => {
        const diffA = Math.abs(a.price - player.price);
        const diffB = Math.abs(b.price - player.price);
        if (diffA !== diffB) return diffA - diffB;
        
        const ptsA = a.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        const ptsB = b.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
        return ptsB - ptsA;
    }).slice(0, 3);

    const modalContent = `
        <div class="modal-header-section">
            <h3>Player Profile</h3>
            <button class="close-modal-btn" id="closeDetailModalBtn"><i data-lucide="x"></i></button>
        </div>
        <div class="player-detail-profile">
            <div class="profile-avatar-shirt">
                ${getShirtSVG(teamObj ? teamObj.color : "#ffffff", player.team)}
            </div>
            <div class="detail-player-info">
                <h4>${player.name}</h4>
                <p>${player.position} • ${player.team} ${player.transferredThisSeason ? `<span class="transfer-badge" style="margin-left: 8px;" title="Transferred from ${player.oldTeam}">⇆ ex-${player.oldTeam}</span>` : ''}</p>
            </div>
        </div>
        ${getPlayerNewsBanner(player, prediction) ? `<div style="padding: 0 20px 10px 20px;">${getPlayerNewsBanner(player, prediction)}</div>` : ''}
        
        <!-- AI Performance Ratings Grid -->
        <div style="padding: 0 20px; margin-top: 12px;">
            <h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> AI Performance Ratings (A-E Grades)
            </h4>
            <div class="player-detail-stats-grid" style="padding: 0; margin-bottom: 12px; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.expectedMinutes)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.expectedMinutes}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">Expected Minutes</span>
                </div>
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.next5Fixtures)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.next5Fixtures}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">Next 5 Fixtures</span>
                </div>
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.attackingRole)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.attackingRole}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">Attacking Role</span>
                </div>
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.attackingPotential)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.attackingPotential}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">FPL Attacking</span>
                </div>
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.defconPotential)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.defconPotential}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">Defcon Potential</span>
                </div>
                <div class="detail-stat-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
                    <span class="tooltip-rating-value ${getBadgeClass(ratings.availability)}" style="font-size: 14px; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${ratings.availability}</span>
                    <span class="detail-stat-lbl" style="font-size: 10px; margin-top: 6px;">Availability</span>
                </div>
            </div>
        </div>

        <div style="padding: 0 20px;"><h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;"><i data-lucide="bar-chart-3" style="width: 14px; height: 14px;"></i> OPTA Match Stats</h4></div>
        <div class="player-detail-stats-grid" style="margin-top: 0; padding-top: 0;">
            <div class="detail-stat-box">
                <span class="detail-stat-val">£${player.price.toFixed(1)}m</span>
                <span class="detail-stat-lbl">Price</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.ownership.toFixed(1)}%</span>
                <span class="detail-stat-lbl">Ownership</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.points}</span>
                <span class="detail-stat-lbl">Total Points</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${prediction.pts.toFixed(1)}</span>
                <span class="detail-stat-lbl">GW${state.currentGw} Exp Pts</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.xp5 !== undefined ? player.xp5.toFixed(1) : 'N/A'}</span>
                <span class="detail-stat-lbl">5-GW Exp Pts (XP)</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.xG.toFixed(1)}</span>
                <span class="detail-stat-lbl">Expected Goals</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.xA.toFixed(1)}</span>
                <span class="detail-stat-lbl">Expected Assists</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.ictIndex.toFixed(1)}</span>
                <span class="detail-stat-lbl">ICT Index</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.shots}</span>
                <span class="detail-stat-lbl">Shots</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.xG90.toFixed(2)}</span>
                <span class="detail-stat-lbl">xG per 90</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.xA90.toFixed(2)}</span>
                <span class="detail-stat-lbl">xA per 90</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.GS}</span>
                <span class="detail-stat-lbl">Games Started</span>
            </div>
            <div class="detail-stat-box">
                <span class="detail-stat-val">${player.MPPG.toFixed(1)}</span>
                <span class="detail-stat-lbl">Avg Min/Game</span>
            </div>
            </div>
        </div>

        <!-- Similarly Priced Alternatives -->
        <div style="padding: 0 20px; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px; text-align: left;">
            <h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--secondary); display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                <i data-lucide="arrow-right-left" style="width: 14px; height: 14px;"></i> Similarly Priced Alternatives
            </h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                ${comparablePlayers.map(comp => {
                    const compPrediction = comp.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
                    const compRatings = getPlayerRatings(comp, state.currentGw);
                    
                    // Check budget constraint
                    const newBank = bank + player.price - comp.price;
                    const budgetOk = newBank >= 0;
                    
                    // Check team count constraint
                    const tempSquad = squad.filter(id => id !== player.id);
                    tempSquad.push(comp.id);
                    const teamCounts = {};
                    let teamOk = true;
                    for (const id of tempSquad) {
                        const p = PLAYERS.find(pl => pl.id === id);
                        if (p) {
                            teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
                            if (teamCounts[p.team] > 3) {
                                teamOk = false;
                                break;
                            }
                        }
                    }
                    
                    // Check health status
                    const statusOk = comp.status !== 'i' && comp.status !== 's' && comp.status !== 'u';
                    
                    const allOk = budgetOk && teamOk && statusOk;
                    
                    let disabledReason = "";
                    if (!statusOk) disabledReason = "Injured / Out";
                    else if (!budgetOk) disabledReason = "Insufficient Bank";
                    else if (!teamOk) disabledReason = "Team Limit (Max 3)";

                    return `
                        <div class="comp-player-card" style="background: rgba(255, 255, 255, 0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
                                    <span style="font-weight: 700; font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;" title="${comp.name}">${comp.name}</span>
                                    <span style="font-weight: 800; font-size: 11px; color: var(--primary);">£${comp.price.toFixed(1)}m</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 10px; color: var(--text-muted);">${comp.team} • ${comp.position}</span>
                                    <span style="font-size: 10px; color: var(--text-muted);">${compPrediction.pts.toFixed(1)} XP</span>
                                </div>
                                
                                <!-- Rating grades grid (2 columns) -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 9px; margin-bottom: 6px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="Expected Minutes">
                                        <span style="color: var(--text-muted);">MIN</span>
                                        <span class="${getBadgeClass(compRatings.expectedMinutes)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.expectedMinutes}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="Next 5 Fixtures">
                                        <span style="color: var(--text-muted);">FIX</span>
                                        <span class="${getBadgeClass(compRatings.next5Fixtures)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.next5Fixtures}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="Attacking Role">
                                        <span style="color: var(--text-muted);">ROLE</span>
                                        <span class="${getBadgeClass(compRatings.attackingRole)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.attackingRole}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="FPL Attacking Potential">
                                        <span style="color: var(--text-muted);">ATT</span>
                                        <span class="${getBadgeClass(compRatings.attackingPotential)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.attackingPotential}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="Defcon Potential">
                                        <span style="color: var(--text-muted);">DEF</span>
                                        <span class="${getBadgeClass(compRatings.defconPotential)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.defconPotential}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1px 3px; border-radius: 3px;" title="Availability">
                                        <span style="color: var(--text-muted);">AVL</span>
                                        <span class="${getBadgeClass(compRatings.availability)}" style="font-weight: 800; padding: 0 3px; border-radius: 2px;">${compRatings.availability}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Swap button and alert -->
                            <div style="display: flex; flex-direction: column; gap: 4px; align-items: stretch; margin-top: auto;">
                                ${disabledReason ? `
                                    <span style="font-size: 8.5px; color: #f43f5e; font-weight: 600; text-align: center; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${disabledReason}">
                                        ${disabledReason}
                                    </span>
                                ` : ''}
                                <button class="action-main-btn btn-secondary-action direct-comp-swap-btn" 
                                        data-comp-id="${comp.id}" 
                                        style="font-size: 10px; padding: 4px 8px; height: 26px; margin: 0; width: 100%;" 
                                        ${!allOk ? 'disabled' : ''}>
                                    Swap Player
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="player-action-section">
            <button class="action-main-btn btn-secondary-action" id="detailSwapBtn">Swap Player</button>
            ${!isCaptain ? `<button class="action-main-btn btn-secondary-action" id="detailCapBtn">Make Captain</button>` : ''}
            ${!isVice ? `<button class="action-main-btn btn-secondary-action" id="detailViceBtn">Make Vice-Cap</button>` : ''}
            <button class="action-main-btn btn-transfer-out" id="detailSellBtn">Remove Player</button>
        </div>
    `;

    actions.showModal(modalContent, () => {
        lucide.createIcons();

        document.getElementById('closeDetailModalBtn').addEventListener('click', actions.hideModal);
        
        document.getElementById('detailSwapBtn').addEventListener('click', () => {
            actions.hideModal();
            triggerSwapCallback({ id: playerId, type });
        });

        // Wire direct comparison swap buttons
        const compBtns = document.querySelectorAll('.direct-comp-swap-btn');
        compBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const compId = parseInt(btn.getAttribute('data-comp-id'));
                const ok = actions.addTransfer(state.currentGw, playerId, compId);
                if (ok) {
                    actions.hideModal();
                }
            });
        });

        const capBtn = document.getElementById('detailCapBtn');
        if (capBtn) {
            capBtn.addEventListener('click', () => {
                actions.setCaptain(playerId);
                actions.hideModal();
            });
        }

        const viceBtn = document.getElementById('detailViceBtn');
        if (viceBtn) {
            viceBtn.addEventListener('click', () => {
                actions.setVice(playerId);
                actions.hideModal();
            });
        }

        document.getElementById('detailSellBtn').addEventListener('click', () => {
            actions.hideModal();
            actions.removePlayer(playerId);
        });
    });
}

// Levenshtein distance helper for spelling-tolerant searching
function getEditDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Opens the Add Player popup modal
function openAddPlayerModal(container, state, actions, slotIndex, position) {
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { bank } = squadInfo;

    // Find buyable players
    const allSquadIds = state.squadSlots.map(s => s.playerId).filter(id => id !== null);
    const buyablePlayers = PLAYERS.filter(p => 
        p.position === position && 
        !allSquadIds.includes(p.id)
    ).sort((a, b) => (b.xp5 || 0) - (a.xp5 || 0));

    // Generate Price Options in 0.5m increments
    let priceOptions = '<option value="">Any Price</option>';
    for (let p = 4.0; p <= 15.0; p += 0.5) {
        priceOptions += `<option value="${p.toFixed(1)}">Max: £${p.toFixed(1)}m</option>`;
    }

    const modalHTML = `
        <div class="modal-header-section">
            <h3 style="display: flex; align-items: center; gap: 8px;">
                <i data-lucide="plus-circle" class="highlight-transfers" style="width: 18px; height: 18px;"></i>
                Add ${position} Slot
            </h3>
            <button class="close-modal-btn" id="closeAddPlayerModalBtn"><i data-lucide="x"></i></button>
        </div>
        <div class="checkout-modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; flex-direction: column; gap: 12px; border-bottom: 1px dashed var(--border-color); padding-bottom: 16px; margin-bottom: 4px; width: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; width: 100%;">
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Max Budget: <strong class="highlight-bank" style="font-size: 14px;">£${bank.toFixed(1)}m</strong></p>
                    <p style="font-size: 11px; color: var(--text-muted); margin: 0; opacity: 0.85;">Only showing <strong style="color: var(--primary);">${position}s</strong>. Search by name or team (e.g. "Coventry", "COV").</p>
                </div>
                <div style="display: flex; gap: 8px; width: 100%;">
                    <input type="text" class="transfer-search-field" id="modalSearchField" placeholder="Search by name or team..." style="flex: 2; font-size: 12px; padding: 8px; background: rgba(255,255,255,0.02); color:#fff; border: 1px solid var(--border-color); border-radius: 6px;" />
                    <select class="panel-price-select" id="modalPriceSelect" style="flex: 1; font-size: 12px; padding: 8px; background: var(--bg-panel); color:#fff; border: 1px solid var(--border-color); border-radius: 6px;">
                        ${priceOptions}
                    </select>
                </div>
            </div>

            <div class="modal-player-list-scroll" id="modalPlayerList" style="display: flex; flex-direction: column; gap: 10px; max-height: 48vh; overflow-y: auto; padding-right: 4px;">
                ${renderModalPlayerRows(buyablePlayers, bank, state)}
            </div>
        </div>
    `;

    actions.showModal(modalHTML, () => {
        const closeBtn = document.getElementById('closeAddPlayerModalBtn');
        if (closeBtn) closeBtn.addEventListener('click', actions.hideModal);

        const searchField = document.getElementById('modalSearchField');
        const priceSelect = document.getElementById('modalPriceSelect');
        const listContainer = document.getElementById('modalPlayerList');

        const applyFilters = () => {
            const query = searchField.value.trim().toLowerCase();
            const maxPriceStr = priceSelect.value;
            const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;

            const filtered = buyablePlayers.filter(p => {
                if (!query) return p.price <= maxPrice;

                // 1. Direct name match
                if (p.name.toLowerCase().includes(query)) return p.price <= maxPrice;

                // 2. Direct team name match
                const teamObj = TEAMS.find(t => t.shortName === p.team);
                if (teamObj && (teamObj.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query))) {
                    return p.price <= maxPrice;
                }

                // 3. Edit distance match on individual words (for queries >= 3 chars)
                if (query.length >= 3) {
                    const queryWords = query.split(/\s+/);
                    const nameWords = p.name.toLowerCase().split(/\s+/);
                    
                    const allQueryWordsMatch = queryWords.every(qw => {
                        return nameWords.some(nw => {
                            if (nw.includes(qw)) return true;
                            const dist = getEditDistance(nw, qw);
                            const maxDist = qw.length > 4 ? 2 : 1;
                            return dist <= maxDist;
                        });
                    });
                    if (allQueryWordsMatch) return p.price <= maxPrice;
                }

                return false;
            });
            listContainer.innerHTML = renderModalPlayerRows(filtered, bank, state);
            wireAddButtons();
        };

        if (searchField) searchField.addEventListener('input', applyFilters);
        if (priceSelect) priceSelect.addEventListener('change', applyFilters);

        const wireAddButtons = () => {
            listContainer.querySelectorAll('.add-player-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const playerId = parseInt(btn.getAttribute('data-id'));
                    const success = actions.addPlayer(state.currentGw, slotIndex, playerId);
                    if (success) {
                        actions.hideModal();
                        actions.renderActiveView();
                    }
                });
            });
            lucide.createIcons();
        };

        wireAddButtons();
        lucide.createIcons();
    });
}

// Renders individual player list items inside the modal
function renderModalPlayerRows(players, bank, state) {
    if (players.length === 0) {
        return `<div class="transfer-list-empty" style="text-align: center; padding: 20px; color: var(--text-muted);">No matching players found.</div>`;
    }
    
    return players.map(player => {
        const isAffordable = player.price <= bank;
        
        return `
            <div class="panel-player-row ${!isAffordable ? 'disabled-row' : ''}" data-id="${player.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: all var(--transition-fast);">
                <div class="player-info-left" style="display: flex; flex-direction: column; gap: 4px;">
                    <span class="player-name-main" style="font-weight: 600; color: #fff; font-size: 13px;">${player.name}</span>
                    ${renderFdrFixtures(player, state.currentGw)}
                    <span class="player-team-sub" style="font-size: 11px; color: var(--text-muted);">${player.team} • £${player.price.toFixed(1)}m • Owned: ${player.ownership.toFixed(1)}%</span>
                    <span class="player-team-sub" style="font-size: 10px; color: var(--text-muted); opacity: 0.85;">Matches last year: ${player.GS} • Avg Min: ${player.MPPG.toFixed(0)}m</span>
                </div>
                <div class="player-info-right" style="display: flex; align-items: center; gap: 12px;">
                    <span class="player-pts-val" style="font-size: 12px; font-weight: 700; color: var(--primary);">${player.xp5 !== undefined ? player.xp5.toFixed(1) : '0.0'} XP (5-GW)</span>
                    ${isAffordable ? `
                        <button class="add-player-action-btn apply-rec-btn" data-id="${player.id}" style="margin: 0; padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; width: auto; height: 28px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            Add
                        </button>
                    ` : `
                        <span class="price-locked-badge" style="font-size: 10px; padding: 4px 8px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);">Locked</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Opens the Reset Team options modal
function openResetModal(state, actions) {
    const modalContent = `
        <div class="modal-header-section">
            <h3>Reset Squad Options</h3>
            <button class="close-modal-btn" id="closeResetModalBtn"><i data-lucide="x"></i></button>
        </div>
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <p style="color: var(--text-muted); font-size: 14px; line-height: 1.5; margin: 0 0 8px 0;">
                How would you like to reset your team planner squad?
            </p>
            <button class="action-main-btn btn-secondary-action" id="resetToDefaultBtn" style="justify-content: center; padding: 12px; font-weight: 600;">
                <i data-lucide="refresh-cw" style="margin-right: 8px; width: 16px; height: 16px;"></i>
                Reset to Default Squad
            </button>
            <button class="action-main-btn btn-transfer-out" id="clearSquadBtn" style="justify-content: center; padding: 12px; font-weight: 600; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #f87171;">
                <i data-lucide="trash-2" style="margin-right: 8px; width: 16px; height: 16px;"></i>
                Clear Entire Squad (Blank slate)
            </button>
        </div>
    `;

    actions.showModal(modalContent, () => {
        lucide.createIcons();

        document.getElementById('closeResetModalBtn').addEventListener('click', actions.hideModal);

        document.getElementById('resetToDefaultBtn').addEventListener('click', () => {
            actions.hideModal();
            actions.resetToDefault();
        });

        document.getElementById('clearSquadBtn').addEventListener('click', () => {
            actions.hideModal();
            actions.clearSquad();
        });
    });
}

// Utility SVG generator for jerseys
export function getShirtSVG(color, teamShortName = '') {
    return `
        <svg viewBox="0 0 100 100" class="shirt-svg">
            <!-- Sleeves -->
            <path d="M 10,25 L 30,10 L 40,25 L 30,35 Z" fill="${color}" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
            <path d="M 90,25 L 70,10 L 60,25 L 70,35 Z" fill="${color}" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
            <!-- Body -->
            <path d="M 30,20 L 70,20 L 75,85 L 25,85 Z" fill="${color}" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
            <!-- Collar -->
            <path d="M 40,20 Q 50,30 60,20 Z" fill="#111" />
            <!-- Design Stripe (Subtle detail) -->
            <rect x="47" y="25" width="6" height="55" fill="rgba(255,255,255,0.2)" rx="2"/>
            <!-- Team Name overlay -->
            ${teamShortName ? `
                <text x="50" y="55" 
                      text-anchor="middle" 
                      fill="#ffffff" 
                      font-size="12px" 
                      font-weight="900" 
                      font-family="sans-serif"
                      style="text-shadow: 0px 1px 3px rgba(0,0,0,0.8), 0px 0px 1px rgba(0,0,0,0.9); font-stretch: condensed; letter-spacing: 0.5px;">
                    ${teamShortName}
                </text>
            ` : ''}
        </svg>
    `;
}

function getPlayerNewsBanner(player, prediction) {
    let html = '';
    
    // 1. Injury/Suspension Alert
    if (player.news) {
        let statusClass = 'news-injured';
        let icon = 'alert-triangle';
        if (player.status === 's') {
            statusClass = 'news-suspended';
            icon = 'slash';
        } else if (player.status === 'd') {
            statusClass = 'news-doubtful';
            icon = 'help-circle';
        }
        
        const reducedPts = (prediction.pts * (player.chanceOfPlaying / 100)).toFixed(1);
        
        html += `
            <div class="player-news-banner ${statusClass}">
                <i data-lucide="${icon}"></i>
                <div class="news-banner-content">
                    <strong style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">${player.status === 's' ? 'Suspension Alert' : 'Injury Alert'}</strong>
                    <div>${player.news} (${player.chanceOfPlaying}% chance of playing).</div>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 4px;">
                        XP Impact: Predicted points reduced from <strong>${prediction.pts.toFixed(1)}</strong> to <strong>${reducedPts}</strong>.
                    </div>
                </div>
            </div>
        `;
    }

    // 2. Rotation Risk Warning
    if (player.position !== 'GKP') {
        const isRotationRisk = player.MPPG > 10 && player.MPPG < 65;
        if (isRotationRisk) {
            html += `
                <div class="player-news-banner news-rotation">
                    <i data-lucide="refresh-cw"></i>
                    <div class="news-banner-content">
                        <strong style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Rotation / Early Sub Risk</strong>
                        <div>Averages ${player.MPPG} minutes per appearance.</div>
                        <div style="font-size: 11px; opacity: 0.9; margin-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 4px;">
                            XP Impact: High likelihood of late sub appearances or early substitutions.
                        </div>
                    </div>
                </div>
            `;
        }
    }

    return html;
}
