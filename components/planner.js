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
                <div class="pitch-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div class="pitch-title-area" style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                        <h2 style="margin: 0;">Squad Selection</h2>
                        <div class="header-rating-badge" style="display: flex; align-items: center; gap: 12px; background: rgba(0, 255, 136, 0.05); border: 1px solid var(--primary-glow); padding: 4px 12px; border-radius: 20px; flex-wrap: nowrap;">
                            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Rating:</span>
                            <strong class="highlight-transfers" style="font-size: 14px; font-weight: 800;">${ratingScore}/100</strong>
                            <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.1);"></span>
                            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">GW${state.currentGw} XP:</span>
                            <strong class="highlight-bank" style="font-size: 14px; font-weight: 800;">${expectedPoints.toFixed(1)}</strong>
                        </div>
                    </div>
                    <div class="pitch-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                        <button class="pitch-btn" id="renameDraftBtn" title="Rename Current Draft" style="flex: 0 0 auto; padding: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: center; height: 32px; width: 32px;">
                            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="pitch-btn" id="cloneDraftBtn" title="Clone Current Draft" style="flex: 0 0 auto; padding: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: center; height: 32px; width: 32px;">
                            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="pitch-btn" id="captainAnalyzerBtn" title="Captaincy Analyzer" style="flex: 0 0 auto; padding: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; justify-content: center; height: 32px; width: 32px; margin-right: 4px;">
                            <i data-lucide="award" style="width: 14px; height: 14px; color: #fbbf24;"></i>
                        </button>
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

            <!-- Gameweek Transfers planned (GW2+) -->
            ${state.currentGw > 1 ? `
            <div class="gw-transfers-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; max-height: 100%; overflow-y: auto;">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <span>GW${state.currentGw} Planned Transfers</span>
                    <span class="pill-value highlight-transfers">${state.chips.wildcard ? 'Unlimited' : `${freeTransfers} FT`}</span>
                </h3>
                <div class="transfer-list" id="plannedTransfersList">
                    ${renderTransfersList(state, actions)}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // Trigger Lucide icons
    lucide.createIcons();

    // Scroll active draft into view
    const activeTab = document.querySelector('.draft-tab-btn.active-chip');
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    // Event listeners
    setupPlannerListeners(container, state, actions, starters, bench);
}

function getFdrColor(diff) {
    switch (diff) {
        case 1:
            return 'var(--fpl-green-5)';
        case 2:
            return 'var(--fpl-green-4)';
        case 3:
            return 'var(--fpl-grey)';
        case 4:
            return 'var(--fpl-red-4)';
        case 5:
            return 'var(--fpl-red-5)';
        default:
            return '#334155'; // Dark Grey for BYE
    }
}

function get5GwXp(player, currentGw) {
    if (!player.predictions) return 0;
    let sum = 0;
    for (let gw = currentGw; gw < currentGw + 5; gw++) {
        const pred = player.predictions.find(p => p.gw === gw);
        if (pred) sum += pred.pts;
    }
    return sum;
}

function renderPitchFixtures(player, currentGw) {
    let html = '';
    for (let gw = currentGw; gw < currentGw + 5; gw++) {
        if (gw > 10) break;
        const pr = player.predictions.find(p => p.gw === gw);
        if (pr) {
            const oppText = pr.opp !== 'BYE' ? `${pr.opp} (${pr.loc})` : 'BYE';
            const fdrColor = getFdrColor(pr.diff);
            
            // Resolve XP or actual points
            const ptsVal = pr.actualPts !== undefined && pr.actualPts !== null ? pr.actualPts : pr.pts;
            const ptsText = ptsVal.toFixed(1).endsWith('.0') ? Math.round(ptsVal) : ptsVal.toFixed(1);
            
            // Format opponent name: lowercase for Away, uppercase for Home
            const teamNameText = pr.opp !== 'BYE' 
                ? (pr.loc === 'A' ? pr.opp.toLowerCase() : pr.opp.toUpperCase()) 
                : 'bye';
                
            html += `
                <div class="pitch-fixture-badge" title="GW${gw}: ${oppText} - FDR ${pr.diff} (XP: ${pr.pts.toFixed(1)})" style="background-color: ${fdrColor}; color: #0f172a; padding: 4px 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; font-weight: 800; text-align: center; font-family: var(--font-body); width: 100%; box-sizing: border-box;">
                    <span class="pitch-fixture-badge-xp" style="font-size: 10.5px; font-weight: 800; display: block; text-shadow: 0 0.5px 1px rgba(255,255,255,0.4);">${ptsText}</span>
                    <span class="pitch-fixture-badge-team" style="font-size: 8.5px; font-weight: 700; opacity: 0.85; display: block; margin-top: 1px; text-transform: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${teamNameText}</span>
                </div>
            `;
        } else {
            html += `
                <div class="pitch-fixture-badge" title="GW${gw}: BYE" style="background-color: #334155; color: #94a3b8; padding: 4px 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; font-weight: 800; text-align: center; font-family: var(--font-body); width: 100%; box-sizing: border-box;">
                    <span class="pitch-fixture-badge-xp" style="font-size: 10.5px; font-weight: 800; display: block; color: #fff;">0</span>
                    <span class="pitch-fixture-badge-team" style="font-size: 8.5px; font-weight: 700; opacity: 0.85; display: block; margin-top: 1px; color: #94a3b8;">bye</span>
                </div>
            `;
        }
    }
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
                <span class="fdr-fixture-badge diff-${pr.diff}" title="GW${gw}: ${oppText} (FDR ${pr.diff})" style="
                    font-size: 8.5px;
                    font-weight: 800;
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

export function renderPlayerRow(squadSlots, position, currentGw, captain, vice, actions) {
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
                <div class="player-card-info" style="padding: 0 !important; overflow: hidden; display: flex; flex-direction: column; border-radius: 8px;">
                    <div style="padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; width: 100%; box-sizing: border-box; text-align: center;">
                        <div class="player-pitch-name">${actions.getWebName(player.name)}</div>
                        <div class="player-pitch-points">
                            £${player.price.toFixed(1)}m • 
                            ${prediction.actualPts !== undefined && prediction.actualPts !== null ? 
                                `<strong style="color: var(--primary);">${prediction.actualPts} pts</strong> <span class="player-xp-subtext">(${prediction.pts.toFixed(1)} XP)</span>` : 
                                `${prediction.pts.toFixed(1)} XP`
                            }
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); width: 100%; gap: 0; border-top: 1px solid rgba(255,255,255,0.05); margin-top: auto;">
                        ${renderPitchFixtures(player, currentGw)}
                    </div>
                </div>
                ${renderPlayerTooltip(player, currentGw)}
            </div>
        `;
    }).join('');
}

export function renderBenchRow(squadSlots, currentGw, captain, vice, actions) {
    const benchSlots = squadSlots.filter(s => !s.isStarting);
    return benchSlots.map((slot, index) => {
        const label = index === 0 ? "GKP" : `Sub ${index} (${slot.position})`;
        const slotIndex = squadSlots.indexOf(slot);
        
        if (slot.playerId === null) {
            return `
                <div class="bench-slot-wrapper">
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
            <div class="bench-slot-wrapper">
                <span class="bench-slot-label">${label}</span>
                <div class="player-pitch-card" data-id="${player.id}" data-type="bench" data-index="${index}" style="width: 100%;">
                    <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player">&times;</button>
                    <div class="shirt-icon-wrapper">
                        ${getShirtSVG(teamObj.color, player.team)}
                        ${designationBadge}
                        ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="Transferred from ${player.oldTeam}">⇆</div>` : ''}
                    </div>
                    <div class="player-card-info" style="padding: 0 !important; overflow: hidden; display: flex; flex-direction: column; border-radius: 8px;">
                        <div style="padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; width: 100%; box-sizing: border-box; text-align: center;">
                            <div class="player-pitch-name">${actions.getWebName(player.name)}</div>
                            <div class="player-pitch-points">
                                £${player.price.toFixed(1)}m • 
                                ${prediction.actualPts !== undefined && prediction.actualPts !== null ? 
                                    `<strong style="color: var(--primary);">${prediction.actualPts} pts</strong> <span class="player-xp-subtext">(${prediction.pts.toFixed(1)} XP)</span>` : 
                                    `${prediction.pts.toFixed(1)} XP`
                                }
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); width: 100%; gap: 0; border-top: 1px solid rgba(255,255,255,0.05); margin-top: auto;">
                            ${renderPitchFixtures(player, currentGw)}
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
        return `
            <div class="transfer-list-empty" style="display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 20px; flex-shrink: 0;">
                <div style="flex-shrink: 0;">No transfers planned for this Gameweek. Click a player to transfer out.</div>
                <button class="action-main-btn goto-tp-btn" style="margin: 4px auto 0 auto; height: 32px; padding: 0 16px; font-size: 11px; display: flex; align-items: center; gap: 6px; border-radius: 6px; width: auto; font-family: var(--font-heading); font-weight: 700; cursor: pointer; flex-shrink: 0; flex: none;">
                    <i data-lucide="compass" style="width: 14px; height: 14px;"></i> Go to Transfer Planner
                </button>
            </div>
        `;
    }

    const rowsHtml = list.map((tx, idx) => {
        const pOut = PLAYERS.find(p => p.id === tx.out);
        const pIn = PLAYERS.find(p => p.id === tx.in);
        if (!pOut || !pIn) return '';

        return `
            <div class="transfer-item-row">
                <div class="transfer-player-card player-card-out">
                    <span class="player-name-main">${pOut.name}</span>
                    <span class="player-team-sub">${pOut.team} • ${pOut.position} OUT</span>
                </div>
                <i data-lucide="arrow-right" class="transfer-arrow-icon"></i>
                <div class="transfer-player-card player-card-in">
                    <span class="player-name-main">${pIn.name}</span>
                    <span class="player-team-sub">${pIn.team} • ${pIn.position} IN</span>
                </div>
                <button class="remove-transfer-btn" data-index="${idx}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
    }).join('');

    return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${rowsHtml}
            <button class="action-main-btn goto-tp-btn" style="margin: 8px auto 0 auto; height: 32px; padding: 0 16px; font-size: 11px; display: flex; align-items: center; gap: 6px; border-radius: 6px; width: 100%; font-family: var(--font-heading); font-weight: 700; cursor: pointer; flex-shrink: 0; flex: none; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); color: var(--text-main);">
                <i data-lucide="compass" style="width: 14px; height: 14px;"></i> Go to Transfer Planner
            </button>
        </div>
    `;
}

function setupPlannerListeners(container, state, actions, starters, bench) {
    // Clear active mobile cards when clicking outside (using global reference to prevent duplicates)
    if (window._mobileClearListener) {
        document.removeEventListener('click', window._mobileClearListener);
    }
    window._mobileClearListener = (e) => {
        if (!e.target.closest('.player-pitch-card')) {
            container.querySelectorAll('.player-pitch-card').forEach(c => c.classList.remove('active-mobile-card'));
        }
    };
    document.addEventListener('click', window._mobileClearListener);

    // Go to Transfer Planner Button click listener
    container.querySelectorAll('.goto-tp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tpPrepopulatedSource = `draft_${state.activeDraftIndex}`;
            actions.switchTab('transferplanner');
        });
    });

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

    // Draft cloning
    const cloneDraftBtn = container.querySelector('#cloneDraftBtn');
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
            actions.renderActiveView();
            actions.showToast(`Successfully cloned into slot ${targetNum} ("${targetDraft.name}")`, "success");
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

                container.querySelectorAll('.player-pitch-card').forEach(c => {
                    c.style.border = 'none';
                    c.classList.remove('active-mobile-card');
                });

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

    // Captaincy Analyzer click listener
    const captainAnalyzerBtn = container.querySelector('#captainAnalyzerBtn');
    if (captainAnalyzerBtn) {
        captainAnalyzerBtn.addEventListener('click', () => {
            const currentGw = state.currentGw;
            const squadIds = state.squadSlots.map(s => s.playerId).filter(id => id !== null);
            const squadPlayers = squadIds.map(id => PLAYERS.find(p => p.id === id)).filter(p => p !== undefined);

            const getGwPrediction = (player, gw) => {
                return player.predictions.find(pr => pr.gw === gw) || { pts: 0, opp: 'BYE', loc: '', diff: 3 };
            };

            const getFdrBadge = (diff) => {
                let cls = 'diff-3';
                if (diff <= 2) cls = 'diff-2';
                else if (diff === 4) cls = 'diff-4';
                else if (diff >= 5) cls = 'diff-5';
                return `<span class="difficulty-cell ${cls}" style="padding: 2px 8px; border-radius: 4px; font-size: 10px; display: inline-block; min-height: auto;">FDR ${diff}</span>`;
            };

            // Get top 3 options from squad
            const options = [...squadPlayers]
                .map(p => {
                    const pred = getGwPrediction(p, currentGw);
                    return { player: p, pred };
                })
                .sort((a, b) => b.pred.pts - a.pred.pts)
                .slice(0, 3);

            if (options.length === 0) {
                actions.showToast("Your squad is empty. Please add players first.", "error");
                return;
            }

            const modalHTML = `
                <div class="modal-header-section">
                    <h3 style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="award" style="color: #fbbf24; width: 18px; height: 18px;"></i>
                        AI Captaincy Analyzer (GW${currentGw})
                    </h3>
                    <button class="close-modal-btn" id="closeCaptainModalBtn"><i data-lucide="x"></i></button>
                </div>
                <div class="checkout-modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto; text-align: left; align-items: stretch;">
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 8px 0; line-height: 1.5;">
                        We analyzed your active squad for GW${currentGw} using fixture difficulty, historical conversion rates, and expected points. Here are the top 3 recommended captains:
                    </p>
                    
                    <div style="display: flex; flex-direction: column; gap: 14px;">
                        ${options.map((item, index) => {
                            const { player, pred } = item;
                            const isCurrentCap = state.captain === player.id;
                            const rankLabel = index === 0 ? "🥇 Primary Pick" : (index === 1 ? "🥈 Secondary Pick" : "🥉 Alternative Pick");
                            const xGI = player.xGI !== undefined ? player.xGI.toFixed(2) : '0.00';
                            
                            let rationale = '';
                            if (player.position === 'FWD' || player.position === 'MID') {
                                rationale = `Highly efficient midfielder/forward with ${xGI} xGI this season. Leeds/their team facing ${pred.opp} (${pred.loc === 'H' ? 'Home' : 'Away'}) represents a high-probability attacking ceiling of ${pred.pts.toFixed(1)} predicted points.`;
                            } else {
                                rationale = `Solid defensive/goalkeeping asset. Projected at ${pred.pts.toFixed(1)} expected points due to a high clean sheet probability against ${pred.opp}.`;
                            }

                            return `
                                <div style="border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                        <div>
                                            <span style="font-size: 10px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">${rankLabel}</span>
                                            <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                                                ${player.name}
                                                ${isCurrentCap ? `<span style="font-size: 9px; padding: 1px 6px; background: rgba(0,255,136,0.1); color: var(--primary); border: 1px solid var(--primary-glow); border-radius: 10px; font-weight: 700;">CURRENT CAPTAIN</span>` : ''}
                                            </h4>
                                            <span style="font-size: 11px; color: var(--text-muted);">${player.position} • ${player.team} • £${player.price.toFixed(1)}m</span>
                                        </div>
                                        <div style="text-align: right;">
                                            <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: var(--secondary);">${pred.pts.toFixed(1)} XP</span>
                                            <div style="margin-top: 2px;">
                                                ${getFdrBadge(pred.diff)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; padding: 8px 12px; background: rgba(255, 255, 255, 0.01); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                                        <strong>AI Rationale:</strong> ${rationale}
                                    </div>
                                    ${!isCurrentCap ? `
                                        <button class="apply-rec-btn make-captain-btn" data-id="${player.id}" style="padding: 6px 12px; font-size: 11px; width: auto; height: 30px; border-radius: 6px; margin: 4px 0 0 0; align-self: flex-start;">
                                            Set as Captain
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            actions.showModal(modalHTML, () => {
                const closeBtn = document.getElementById('closeCaptainModalBtn');
                if (closeBtn) closeBtn.addEventListener('click', actions.hideModal);

                document.querySelectorAll('.make-captain-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = parseInt(btn.getAttribute('data-id'));
                        actions.setCaptain(id);
                        actions.hideModal();
                        actions.renderActiveView();
                        actions.showToast("Captain choice updated!", "success");
                    });
                });
                lucide.createIcons();
            });
        });
    }

    // Scroll active draft tab into view
    const activeTab = container.querySelector('.draft-tab-btn.active-chip');
    if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
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

    const starts = typeof player.GS === 'number' ? player.GS : 0;
    const avgMins = typeof player.MPPG === 'number' ? player.MPPG.toFixed(0) : '0';

    const modalContent = `
        <div class="modal-header-section">
            <h3>Player Profile</h3>
            <button class="close-modal-btn" id="closeDetailModalBtn"><i data-lucide="x"></i></button>
        </div>
        <div class="player-detail-horizontal-layout" style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; padding: 20px; text-align: left;">
            <!-- Left Column: Profile, Ratings & Actions -->
            <div class="detail-left-column" style="display: flex; flex-direction: column; gap: 16px; min-width: 0;">
                <div class="player-detail-profile" style="padding: 0; display: flex; align-items: center; gap: 16px;">
                    <div class="profile-avatar-shirt" style="width: 64px; height: 64px; flex-shrink: 0;">
                        ${getShirtSVG(teamObj ? teamObj.color : "#ffffff", player.team)}
                    </div>
                    <div class="detail-player-info">
                        <h4 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: var(--text-main);">${player.name}</h4>
                        <p style="margin: 0; font-size: 13px; color: var(--text-muted);">${player.position} • ${player.team} ${player.transferredThisSeason ? `<span class="transfer-badge" style="margin-left: 8px;" title="Transferred from ${player.oldTeam}">⇆ ex-${player.oldTeam}</span>` : ''}</p>
                        <div style="margin-top: 8px;">
                            ${renderFdrFixtures(player, state.currentGw)}
                        </div>
                    </div>
                </div>

                ${getPlayerNewsBanner(player, prediction) ? `<div>${getPlayerNewsBanner(player, prediction)}</div>` : ''}

                <!-- AI Performance Ratings Grid -->
                <div>
                    <h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px; margin: 0 0 10px 0;">
                        <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> AI Performance Ratings (A-E Grades)
                    </h4>
                    <div class="player-detail-stats-grid" style="padding: 0; margin-bottom: 0; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%;">
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

                <!-- Action Buttons -->
                <div class="player-action-section" style="padding: 0; margin-top: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%;">
                    <button class="action-main-btn btn-secondary-action" id="detailSwapBtn" style="margin: 0; width: 100%;">Swap Player</button>
                    ${!isCaptain ? `<button class="action-main-btn btn-secondary-action" id="detailCapBtn" style="margin: 0; width: 100%;">Make Captain</button>` : ''}
                    ${!isVice ? `<button class="action-main-btn btn-secondary-action" id="detailViceBtn" style="margin: 0; width: 100%;">Make Vice-Cap</button>` : ''}
                    <button class="action-main-btn btn-transfer-out" id="detailSellBtn" style="margin: 0; width: 100%; grid-column: span ${(!isCaptain && !isVice) ? '1' : '2'};">Remove Player</button>
                </div>
            </div>

            <!-- Right Column: OPTA Stats & Alternatives -->
            <div class="detail-right-column" style="display: flex; flex-direction: column; gap: 16px; min-width: 0; border-left: 1px solid var(--border-color); padding-left: 20px;">
                <!-- OPTA Match Stats -->
                <div>
                    <h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin: 0 0 10px 0;">
                        <i data-lucide="bar-chart-3" style="width: 14px; height: 14px;"></i> OPTA Match Stats
                    </h4>
                    <div class="player-detail-stats-grid" style="margin: 0; padding: 0; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">£${player.price.toFixed(1)}m</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Price</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.ownership.toFixed(1)}%</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Ownership</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.points}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Total Points</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${starts}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Starts</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${avgMins}m</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Avg Minutes</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${prediction.pts.toFixed(1)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">GW${state.currentGw} Exp Pts</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${get5GwXp(player, state.currentGw).toFixed(1)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">5-GW Exp Pts</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.xG.toFixed(1)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Expected Goals</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.xA.toFixed(1)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">Expected Assists</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.ictIndex.toFixed(1)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">ICT Index</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.xG90.toFixed(2)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">xG per 90</span>
                        </div>
                        <div class="detail-stat-box" style="padding: 8px;">
                            <span class="detail-stat-val" style="font-size: 13px;">${player.xA90.toFixed(2)}</span>
                            <span class="detail-stat-lbl" style="font-size: 9px;">xA per 90</span>
                        </div>
                    </div>
                </div>

                <!-- Similarly Priced Alternatives -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <h4 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--secondary); display: flex; align-items: center; gap: 6px; margin: 0 0 10px 0;">
                        <i data-lucide="arrow-right-left" style="width: 14px; height: 14px;"></i> Similarly Priced Alternatives
                    </h4>
                    <div class="alternatives-scroll-container">
                        ${comparablePlayers.map(comp => {
                            const compPrediction = comp.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
                            
                            const newBank = bank + player.price - comp.price;
                            const budgetOk = newBank >= 0;
                            
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
                            
                            const statusOk = comp.status !== 'i' && comp.status !== 's' && comp.status !== 'u';
                            const allOk = budgetOk && teamOk && statusOk;
                            
                            let disabledReason = "";
                            if (!statusOk) disabledReason = "Injured";
                            else if (!budgetOk) disabledReason = "Over budget";
                            else if (!teamOk) disabledReason = "3/team max";
                            
                            return `
                                <div class="compare-alternative-card" style="display: flex; flex-direction: column; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; font-size: 11px;">
                                    <div style="font-weight:700; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${comp.name}">${actions.getWebName(comp.name)}</div>
                                    <div style="color:var(--text-muted); font-size: 10px; margin-top:2px;">£${comp.price.toFixed(1)}m • GW${state.currentGw}: ${compPrediction.pts.toFixed(1)} XP</div>
                                    <div style="color:var(--text-muted); font-size: 10px; margin-top:1px;">5-GW: ${get5GwXp(comp, state.currentGw).toFixed(1)} XP</div>
                                    
                                    <!-- Swap button and alert -->
                                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: stretch; margin-top: 10px;">
                                        ${disabledReason ? `
                                            <span style="font-size: 8.5px; color: #f43f5e; font-weight: 600; text-align: center; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${disabledReason}">
                                                ${disabledReason}
                                            </span>
                                        ` : ''}
                                        <button class="action-main-btn btn-secondary-action direct-comp-swap-btn" 
                                                data-comp-id="${comp.id}" 
                                                style="font-size: 10px; padding: 4px 8px; height: 24px; margin: 0; width: 100%;" 
                                                ${!allOk ? 'disabled' : ''}>
                                            Swap
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
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
    
    // Count players per team in current squad to enforce FPL team limit (max 3 per team)
    const teamCounts = {};
    allSquadIds.forEach(id => {
        const p = PLAYERS.find(pl => pl.id === id);
        if (p) {
            teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        }
    });

    const buyablePlayers = PLAYERS.filter(p => 
        p.position === position && 
        !allSquadIds.includes(p.id) &&
        p.price <= bank &&
        (teamCounts[p.team] || 0) < 3
    ).sort((a, b) => get5GwXp(b, state.currentGw) - get5GwXp(a, state.currentGw));

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
                    <p style="font-size: 11px; color: var(--text-muted); margin: 0; opacity: 0.85;">Only showing <strong style="color: var(--primary);">${position}s</strong> <span id="modalFilterCount" style="color: var(--secondary); font-weight: 700; margin-left: 4px;"></span>. Search by name or team.</p>
                </div>
                <div style="display: flex; gap: 8px; width: 100%; flex-wrap: wrap;">
                    <input type="text" class="transfer-search-field" id="modalSearchField" placeholder="Search by name or team..." style="flex: 2; min-width: 150px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;" />
                    <select class="panel-price-select" id="modalPriceSelect" style="flex: 1; min-width: 95px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                        ${priceOptions}
                    </select>
                    <select class="panel-price-select" id="modalAttSelect" style="flex: 1; min-width: 95px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                        <option value="">Attacking (Any)</option>
                        <option value="A">Attacking: A (Excellent)</option>
                        <option value="B">Attacking: B+</option>
                        <option value="C">Attacking: C+</option>
                        <option value="D">Attacking: D+</option>
                    </select>
                    <select class="panel-price-select" id="modalDefconSelect" style="flex: 1; min-width: 95px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                        <option value="">Defcon (Any)</option>
                        <option value="A">Defcon: A (Excellent)</option>
                        <option value="B">Defcon: B+</option>
                        <option value="C">Defcon: C+</option>
                        <option value="D">Defcon: D+</option>
                    </select>
                    <select class="panel-price-select" id="modalMppgSelect" style="flex: 1; min-width: 95px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                        <option value="">Avg Mins (Any)</option>
                        <option value="60">60+ mins/game</option>
                        <option value="45">45+ mins/game</option>
                        <option value="30">30+ mins/game</option>
                        <option value="15">15+ mins/game</option>
                    </select>
                    <select class="panel-price-select" id="modalGsSelect" style="flex: 1; min-width: 95px; font-size: 12px; padding: 8px; background: var(--bg-card); color:var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                        <option value="">Starts (Any)</option>
                        <option value="30">30+ starts</option>
                        <option value="20">20+ starts</option>
                        <option value="10">10+ starts</option>
                        <option value="5">5+ starts</option>
                        <option value="1">1+ starts</option>
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
        const attSelect = document.getElementById('modalAttSelect');
        const defconSelect = document.getElementById('modalDefconSelect');
        const mppgSelect = document.getElementById('modalMppgSelect');
        const gsSelect = document.getElementById('modalGsSelect');
        const listContainer = document.getElementById('modalPlayerList');

        const applyFilters = () => {
            try {
                const query = searchField ? searchField.value.trim().toLowerCase() : "";
                const maxPriceStr = priceSelect ? priceSelect.value : "";
                const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;
                
                const minAttGrade = attSelect ? attSelect.value : "";
                const minDefconGrade = defconSelect ? defconSelect.value : "";
                
                const minMinsStr = mppgSelect ? mppgSelect.value : "";
                const minMins = minMinsStr ? parseFloat(minMinsStr) : 0;
                
                const minGsStr = gsSelect ? gsSelect.value : "";
                const minGs = minGsStr ? parseInt(minGsStr) : 0;
                
                const gradeScores = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'N/A': 0 };
     
                const filtered = buyablePlayers.filter(p => {
                    if (p.price > maxPrice) return false;
                    if (minMins > 0 && (p.MPPG || 0) < minMins) return false;
                    if (minGs > 0 && (p.GS || 0) < minGs) return false;
                    
                    const ratings = getPlayerRatings(p, state.currentGw);
                    
                    if (minAttGrade) {
                        const score = gradeScores[ratings.attackingPotential] || 0;
                        const reqScore = gradeScores[minAttGrade] || 0;
                        if (score < reqScore) return false;
                    }
                    
                    if (minDefconGrade) {
                        const score = gradeScores[ratings.defconPotential] || 0;
                        const reqScore = gradeScores[minDefconGrade] || 0;
                        if (score < reqScore) return false;
                    }
     
                    if (!query) return true;
     
                    // 1. Direct name match
                    if (p.name.toLowerCase().includes(query)) return true;
     
                    // 2. Direct team name match
                    const teamObj = TEAMS.find(t => t.shortName === p.team);
                    if (teamObj && (teamObj.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query))) {
                        return true;
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
                        if (allQueryWordsMatch) return true;
                    }
     
                    return false;
                });
                
                console.log("[FPL HUB] Filters applied. Count:", filtered.length, "Query:", query, "Price:", maxPrice, "Att:", minAttGrade, "Defcon:", minDefconGrade);
                
                const filterCountLabel = document.getElementById('modalFilterCount');
                if (filterCountLabel) {
                    filterCountLabel.textContent = `(${filtered.length} found)`;
                }

                if (listContainer) {
                    listContainer.innerHTML = renderModalPlayerRows(filtered, bank, state);
                }
                wireAddButtons();
            } catch (err) {
                console.error("Filter error:", err);
            }
        };
 
        if (searchField) searchField.addEventListener('input', applyFilters);
        if (priceSelect) priceSelect.addEventListener('change', applyFilters);
        if (attSelect) attSelect.addEventListener('change', applyFilters);
        if (defconSelect) defconSelect.addEventListener('change', applyFilters);
        if (mppgSelect) mppgSelect.addEventListener('change', applyFilters);
        if (gsSelect) gsSelect.addEventListener('change', applyFilters);

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
        applyFilters(); // Trigger filters initially to count and render the list
        lucide.createIcons();
    });
}

function renderModalPlayerRows(players, bank, state) {
    if (players.length === 0) {
        return `<div class="transfer-list-empty" style="text-align: center; padding: 20px; color: var(--text-muted);">No matching players found.</div>`;
    }
    
    const currentGw = parseInt(state.currentGw) || 1;
    
    return players.map(player => {
        const isAffordable = player.price <= bank;
        
        // Get ratings for this player (grades A-E)
        const ratings = getPlayerRatings(player, currentGw);
        
        // Elite Attacking = A or B grade
        const hasGoodAttacking = (player.position === 'DEF' || player.position === 'MID') && 
                                 (ratings.attackingPotential === 'A' || ratings.attackingPotential === 'B');
        
        // Elite Defcon = A or B grade
        const hasGoodDefcon = (player.position === 'DEF' || player.position === 'MID') && 
                               (ratings.defconPotential === 'A' || ratings.defconPotential === 'B');
        
        const isBoth = hasGoodAttacking && hasGoodDefcon;
        const isBestAttacking = hasGoodAttacking && !isBoth;
        const isBestDefcon = hasGoodDefcon && !isBoth;
        
        if (isBoth || isBestAttacking || isBestDefcon) {
            console.log("[FPL HUB] Badge matched for player:", player.name, "Att:", ratings.attackingPotential, "Defcon:", ratings.defconPotential, "Both:", isBoth);
        }

        let badgesHtml = '';
        if (isBoth) {
            badgesHtml = `
                <span class="badge-best-both" style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: linear-gradient(135deg, rgba(255, 179, 0, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%); color: #ffd700; border: 1px dashed #ffd700; font-weight: 800; display: inline-flex; align-items: center; gap: 2px;" title="Elite Double Asset: Elite rating in BOTH Attacking and Defcon Potential!">
                    👑 Elite Double Asset
                </span>
            `;
        } else {
            if (isBestAttacking) {
                badgesHtml = `
                    <span class="badge-best-att" style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(255, 179, 0, 0.15); color: #ffb300; border: 1px solid rgba(255, 179, 0, 0.3); font-weight: 700; display: inline-flex; align-items: center; gap: 2px;" title="Vibrant Attacking potential (A/B Rating)">
                        🔥 Best Attacking
                    </span>
                `;
            }
            if (isBestDefcon) {
                badgesHtml = `
                    <span class="badge-best-defcon" style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(0, 242, 254, 0.15); color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.3); font-weight: 700; display: inline-flex; align-items: center; gap: 2px;" title="Vibrant clean sheet defense (A/B Rating)">
                        🛡️ Best Defcon
                    </span>
                `;
            }
        }
        
        return `
            <div class="panel-player-row ${!isAffordable ? 'disabled-row' : ''}" data-id="${player.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: all var(--transition-fast);">
                <div class="player-info-left" style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <span class="player-name-main" style="font-weight: 600; color: var(--text-main); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${player.name}</span>
                        ${badgesHtml}
                    </div>
                    ${renderFdrFixtures(player, state.currentGw)}
                    <span class="player-team-sub" style="font-size: 11px; color: var(--text-muted);">${player.team} • £${player.price.toFixed(1)}m • Owned: ${player.ownership.toFixed(1)}%</span>
                    <span class="player-team-sub" style="font-size: 10px; color: var(--text-muted); opacity: 0.85;">Matches last year: ${player.GS} • Avg Min: ${player.MPPG.toFixed(0)}m</span>
                </div>
                <div class="player-info-right" style="display: flex; align-items: center; gap: 12px; margin-left: 8px;">
                    <span class="player-pts-val" style="font-size: 12px; font-weight: 700; color: var(--primary); white-space: nowrap;">${get5GwXp(player, state.currentGw).toFixed(1)} XP (5-GW)</span>
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
