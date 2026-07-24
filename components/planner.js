import { PLAYERS, TEAMS } from '../data.js';

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
                        <button class="pitch-btn ${state.chips.wildcard ? 'active-chip' : ''}" id="chipWildcardBtn">
                            <i data-lucide="zap"></i> Wildcard
                        </button>
                        <button class="pitch-btn ${state.chips.tripleCaptain ? 'active-chip' : ''}" id="chipTcBtn">
                            <i data-lucide="award"></i> Triple Capt.
                        </button>
                        <button class="pitch-btn ${state.chips.benchBoost ? 'active-chip' : ''}" id="chipBbBtn">
                            <i data-lucide="arrow-up-circle"></i> Bench Boost
                        </button>
                        <button class="pitch-btn" id="resetTeamBtn" title="Reset/Clear Team">
                            <i data-lucide="rotate-ccw"></i> Reset Team
                        </button>
                    </div>
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
                        ${renderPlayerRow(state.squadSlots, "GKP", state.currentGw, state.captain, state.vice)}
                    </div>

                    <!-- DEF Row -->
                    <div class="pitch-row" data-row="DEF">
                        ${renderPlayerRow(state.squadSlots, "DEF", state.currentGw, state.captain, state.vice)}
                    </div>

                    <!-- MID Row -->
                    <div class="pitch-row" data-row="MID">
                        ${renderPlayerRow(state.squadSlots, "MID", state.currentGw, state.captain, state.vice)}
                    </div>

                    <!-- FWD Row -->
                    <div class="pitch-row" data-row="FWD">
                        ${renderPlayerRow(state.squadSlots, "FWD", state.currentGw, state.captain, state.vice)}
                    </div>
                </div>

                <!-- Bench Section -->
                <div class="bench-container">
                    <span class="bench-title">Bench (Click starter to swap with bench)</span>
                    <div class="bench-row" id="benchRow">
                        ${renderBenchRow(state.squadSlots, state.currentGw, state.captain, state.vice)}
                    </div>
                </div>
            </div>

            <!-- Right Column: AI Rating & Transfers List OR Add Player Panel -->
            <div class="planner-side-panel">
                ${state.selectedEmptySlot ? renderAddPlayerPanel(state, actions) : `
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
                `}
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

function renderPlayerRow(squadSlots, position, currentGw, captain, vice) {
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

        const fixtureText = prediction.opp !== 'BYE' ? `${prediction.opp}(${prediction.loc})` : 'BYE';

        return `
            <div class="player-pitch-card" data-id="${player.id}" data-type="starter">
                <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player">&times;</button>
                <div class="shirt-icon-wrapper">
                    ${getShirtSVG(teamObj.color, player.team)}
                    ${designationBadge}
                    ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="Transferred from ${player.oldTeam}">⇆</div>` : ''}
                </div>
                <div class="player-card-info">
                    <div class="player-pitch-name">${player.name.split(' ')[1] || player.name}</div>
                    <div class="player-pitch-points">£${player.price.toFixed(1)}m • ${prediction.pts.toFixed(1)} XP</div>
                    <div class="player-pitch-points-sub">${fixtureText} • 5-GW: ${player.xp5 !== undefined ? player.xp5.toFixed(1) : 'N/A'}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderBenchRow(squadSlots, currentGw, captain, vice) {
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

        const fixtureText = prediction.opp !== 'BYE' ? `${prediction.opp}(${prediction.loc})` : 'BYE';

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
                        <div class="player-pitch-name">${player.name.split(' ')[1] || player.name}</div>
                        <div class="player-pitch-points">£${player.price.toFixed(1)}m • ${prediction.pts.toFixed(1)} XP</div>
                        <div class="player-pitch-points-sub">${fixtureText} • 5-GW: ${player.xp5 !== undefined ? player.xp5.toFixed(1) : 'N/A'}</div>
                    </div>
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

    // Add Player slot click trigger
    container.querySelectorAll('.player-pitch-card.empty-slot').forEach(card => {
        card.addEventListener('click', e => {
            const slotIndex = parseInt(card.getAttribute('data-slot-index'));
            const position = card.getAttribute('data-position');
            state.selectedEmptySlot = { slotIndex, position };
            actions.renderActiveView();
        });
    });

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

    // If empty slot is selected, wire up the add player panel listeners
    if (state.selectedEmptySlot) {
        const cancelBtn = container.querySelector('#cancelAddPlayerBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                state.selectedEmptySlot = null;
                actions.renderActiveView();
            });
        }

        const searchField = container.querySelector('#panelSearchField');
        const priceSelect = container.querySelector('#panelPriceSelect');
        const listContainer = container.querySelector('#panelPlayerList');
        if (searchField && priceSelect && listContainer) {
            const { position, slotIndex } = state.selectedEmptySlot;
            const squadInfo = state.getSquadForGw(state.currentGw);
            const { bank } = squadInfo;
            const allSquadIds = state.squadSlots.map(s => s.playerId).filter(id => id !== null);
            const buyablePlayers = PLAYERS.filter(p => 
                p.position === position && 
                !allSquadIds.includes(p.id)
            ).sort((a, b) => (b.xp5 || 0) - (a.xp5 || 0));

            const applyFilters = () => {
                const query = searchField.value.toLowerCase();
                const maxPriceStr = priceSelect.value;
                const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;

                const filtered = buyablePlayers.filter(p => 
                    p.name.toLowerCase().includes(query) && 
                    p.price <= maxPrice
                );
                listContainer.innerHTML = renderPanelPlayerRows(filtered, bank, state);
                wireAddButtons();
            };

            searchField.addEventListener('input', applyFilters);
            priceSelect.addEventListener('change', applyFilters);

            const wireAddButtons = () => {
                listContainer.querySelectorAll('.add-player-action-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const playerId = parseInt(btn.getAttribute('data-id'));
                        const success = actions.addPlayer(state.currentGw, slotIndex, playerId);
                        if (success) {
                            state.selectedEmptySlot = null;
                            actions.renderActiveView();
                        }
                    });
                });
                lucide.createIcons();
            };

            wireAddButtons();
        }
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
        <div class="player-detail-stats-grid">
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

// Renders the Add Player sidebar panel in the right column
function renderAddPlayerPanel(state, actions) {
    const { slotIndex, position } = state.selectedEmptySlot;
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

    return `
        <div class="add-player-panel-card">
            <div class="panel-header">
                <h3>Select ${position}</h3>
                <button class="panel-close-btn" id="cancelAddPlayerBtn" title="Cancel">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <p class="panel-subtitle">Max Budget: £${bank.toFixed(1)}m</p>
            <div class="panel-search-wrapper">
                <input type="text" class="transfer-search-field" id="panelSearchField" placeholder="Search by name..." style="flex: 1;" />
                <select class="panel-price-select" id="panelPriceSelect">
                    ${priceOptions}
                </select>
            </div>
            <div class="panel-player-list" id="panelPlayerList">
                ${renderPanelPlayerRows(buyablePlayers, bank, state)}
            </div>
        </div>
    `;
}

// Renders individual player list items in the sidebar panel
function renderPanelPlayerRows(players, bank, state) {
    if (players.length === 0) {
        return `<div class="transfer-list-empty">No matching players found.</div>`;
    }
    
    return players.map(player => {
        const prediction = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
        const isAffordable = player.price <= bank;
        
        return `
            <div class="panel-player-row ${!isAffordable ? 'disabled-row' : ''}" data-id="${player.id}">
                <div class="player-info-left">
                    <span class="player-name-main">${player.name}</span>
                    <span class="player-team-sub">${player.team} • £${player.price.toFixed(1)}m • Owned: ${player.ownership.toFixed(1)}%</span>
                    <span class="player-team-sub" style="font-size: 10px; opacity: 0.85;">Matches last year: ${player.GS} • Avg Min: ${player.MPPG.toFixed(0)}m</span>
                </div>
                <div class="player-info-right">
                    <span class="player-pts-val">${player.xp5 !== undefined ? player.xp5.toFixed(1) : '0.0'} XP (5-GW)</span>
                    ${isAffordable ? `
                        <button class="add-player-action-btn" data-id="${player.id}">
                            Add
                        </button>
                    ` : `
                        <span class="price-locked-badge">Locked</span>
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
