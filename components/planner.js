import { PLAYERS, TEAMS, getPlayerRatings } from '../data.js';
import { renderSetPieceBadges, renderSetPieceLegend, getPlayerSetPieceDuty } from './optimizer.js';



export function renderPlanner(container, state, actions) {
    if (state.isSquadUnlocked === undefined) {
        state.isSquadUnlocked = false;
    }

    // Inject risk highlights stylesheet in head
    if (typeof document !== 'undefined' && !document.getElementById('fpl-squad-risk-styles')) {
        const style = document.createElement('style');
        style.id = 'fpl-squad-risk-styles';
        style.innerHTML = `
            .player-pitch-card.has-starting-risk {
                animation: borderPulseHigh 2s infinite alternate;
            }
            .player-pitch-card.has-starting-risk.risk-high {
                border: 2px solid #ef4444 !important;
                background: rgba(239, 68, 68, 0.08) !important;
                animation: borderPulseHigh 2s infinite alternate;
            }
            .player-pitch-card.has-starting-risk.risk-medium {
                border: 2px solid #f59e0b !important;
                background: rgba(245, 158, 11, 0.08) !important;
                animation: borderPulseMedium 2s infinite alternate;
            }
            .player-pitch-card.has-starting-risk.risk-low {
                border: 2px solid #38bdf8 !important;
                background: rgba(56, 189, 248, 0.06) !important;
                animation: borderPulseLow 2s infinite alternate;
            }
            @keyframes borderPulseHigh {
                0% { box-shadow: 0 0 3px rgba(239, 68, 68, 0.2); }
                100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.6); }
            }
            @keyframes borderPulseMedium {
                0% { box-shadow: 0 0 3px rgba(245, 158, 11, 0.2); }
                100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.6); }
            }
            @keyframes borderPulseLow {
                0% { box-shadow: 0 0 3px rgba(56, 189, 248, 0.2); }
                100% { box-shadow: 0 0 10px rgba(56, 189, 248, 0.6); }
            }
            .pitch-risk-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ef4444;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                border: 1.5px solid var(--bg-card);
                z-index: 10;
                cursor: help;
            }
            .pitch-risk-badge.risk-medium {
                background: #f59e0b;
            }
            .pitch-risk-badge.risk-low {
                background: #38bdf8;
            }
            .pitch-risk-badge svg {
                width: 10px;
                height: 10px;
                stroke-width: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    // Asynchronously fetch live points for this gameweek to display actual stats
    if (!state.livePoints[state.currentGw]) {
        state.loadLivePoints(state.currentGw).then(points => {
            if (points && Object.keys(points).length > 0) {
                actions.renderActiveView();
            }
        });
    }

    const livePointsMap = state.livePoints[state.currentGw] || {};

    // Determine active squad and lineup for this gameweek.
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { bank, freeTransfers } = squadInfo;

    const lineupInfo = state.getGwLineup(state.currentGw);
    const { starters, bench, captain, vice, formation } = lineupInfo;

    // Clone baseline slots and apply planned transfers to show correct week-by-week squad
    let currentSlots = JSON.parse(JSON.stringify(state.squadSlots));
    for (let gw = 2; gw <= state.currentGw; gw++) {
        // Skip applying transfers if a Free Hit was played in an intermediate week
        // (but apply them if we are viewing the Free Hit week itself!)
        if (gw !== state.currentGw && state.chips[gw]?.freeHit) continue;

        const weeklyTransfers = state.transfers[gw] || [];
        weeklyTransfers.forEach(tx => {
            const slot = currentSlots.find(s => s.playerId === tx.out);
            if (slot) {
                slot.playerId = tx.in;
            }
        });
    }

    // Dynamic lineup assignment: set isStarting on each slot in currentSlots based on the resolved starters list
    currentSlots.forEach(slot => {
        if (slot.playerId !== null) {
            slot.isStarting = starters.includes(slot.playerId);
        } else {
            slot.isStarting = false;
        }
    });

    // Calculate total predicted & actual points for starters
    let expectedPoints = 0;
    let actualPoints = 0;
    let hasActualPoints = false;
    starters.forEach(id => {
        const player = PLAYERS.find(p => p.id === id);
        if (player) {
            const pred = player.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
            const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
            let multiplier = 1;
            if (id === captain) {
                multiplier = state.chips[state.currentGw]?.tripleCaptain ? 3 : 2;
            }
            const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
            expectedPoints += (raw * factor) * multiplier;

            const livePts = livePointsMap[id];
            const hasLive = (livePts !== undefined && livePts !== null);
            const actualVal = hasLive ? livePts : pred.actualPts;

            if (actualVal !== undefined && actualVal !== null) {
                hasActualPoints = true;
                actualPoints += actualVal * multiplier;
            }
        }
    });

    // Add bench points if Bench Boost is active (either manual or planned via optimizer)
    const isBbActiveCurrentGw = !!(state.chips[state.currentGw]?.benchBoost || (state.planBenchBoost && state.benchBoostTargetGw === state.currentGw));
    if (isBbActiveCurrentGw) {
        bench.forEach(id => {
            const player = PLAYERS.find(p => p.id === id);
            if (player) {
                const pred = player.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
                const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                expectedPoints += (raw * factor);

                const livePts = livePointsMap[id];
                const hasLive = (livePts !== undefined && livePts !== null);
                const actualVal = hasLive ? livePts : pred.actualPts;

                if (actualVal !== undefined && actualVal !== null) {
                    actualPoints += actualVal;
                }
            }
        });
    }

    // Calculate total squad predicted points over horizons
    const getSquadXPForHorizon = (numGws) => {
        let total = 0;
        for (let gw = state.currentGw; gw < state.currentGw + numGws; gw++) {
            if (gw > 38) break;

            const gwLineup = state.getGwLineup(gw);
            const { starters: gwStarters, bench: gwBench, captain: gwCaptain } = gwLineup;

            let gwTotal = 0;
            gwStarters.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    const pred = player.predictions.find(pr => pr.gw == gw) || { pts: 0 };
                    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
                    let multiplier = 1;
                    if (id === gwCaptain) {
                        multiplier = state.chips[gw]?.tripleCaptain ? 3 : 2;
                    }
                    const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                    gwTotal += (raw * factor) * multiplier;
                }
            });
            const isBbActiveGw = !!(state.chips[gw]?.benchBoost || (state.planBenchBoost && state.benchBoostTargetGw === gw));
            if (isBbActiveGw) {
                gwBench.forEach(id => {
                    const player = PLAYERS.find(p => p.id === id);
                    if (player) {
                        const pred = player.predictions.find(pr => pr.gw == gw) || { pts: 0 };
                        const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
                        const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                        gwTotal += (raw * factor);
                    }
                });
            }
            total += gwTotal;
        }
        return total;
    };


    const gw1XP = expectedPoints;
    const gw3XP = getSquadXPForHorizon(3);
    const gw5XP = getSquadXPForHorizon(5);
    const gw10XP = getSquadXPForHorizon(10);

    // Deactivate Wildcard / Free Hit if we are in preseason (GW 1)
    if (state.currentGw === 1) {
        let changed = false;
        if (state.chips[1]?.wildcard) {
            state.chips[1].wildcard = false;
            changed = true;
        }
        if (state.chips[1]?.freeHit) {
            state.chips[1].freeHit = false;
            changed = true;
        }
        if (changed) {
            state.saveState();
        }
    }

    const isPreseason = state.currentGw === 1;
    const currentWeekChips = state.chips[state.currentGw] || { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
    const isBbActive = !!(currentWeekChips.benchBoost || (state.planBenchBoost && state.benchBoostTargetGw === state.currentGw));
    let chipsHtml = '';
    if (!isPreseason) {
        chipsHtml += `
            <button class="pitch-btn ${currentWeekChips.wildcard ? 'active-chip' : ''}" id="chipWildcardBtn" title="Play Wildcard (Unlimited Free Transfers)">
                <i data-lucide="zap"></i> Wildcard
            </button>
            <button class="pitch-btn ${currentWeekChips.freeHit ? 'active-chip' : ''}" id="chipFreeHitBtn" title="Play Free Hit (Unlimited Free Transfers for 1 GW, resets after)">
                <i data-lucide="repeat"></i> Free Hit
            </button>
        `;
    }
    chipsHtml += `
        <button class="pitch-btn ${currentWeekChips.tripleCaptain ? 'active-chip' : ''}" id="chipTcBtn" title="Play Triple Captain (Captain points tripled)">
            <i data-lucide="award"></i> Triple Capt.
        </button>
        <button class="pitch-btn ${isBbActive ? 'active-chip' : ''}" id="chipBbBtn" title="Play Bench Boost (Bench points added to starting XI)">
            <i data-lucide="shield"></i> Bench Boost
        </button>
    `;

    // Calculate AI Squad Rating (0-100).
    // Calibrated against 24 years of FPL Overall World Winners historical data.
    // Modern 10-year champion average is 70.5 pts/GW (~2,680 pts/season).
    // Benchmark: 4.1 base XP/player average (45.1 base starters XP + ~5.5 captaincy bonus = 50.6 GW total) = 100 rating.
    // Distribution: Average squad (~36 total GW xP) → ~80 rating | Strong template (~41 total xP) → ~91 | Elite AI (~45+ total xP) → 100
    const captainPlayer = PLAYERS.find(p => p.id === captain);
    const captainBonus = captainPlayer ? (captainPlayer.predictions.find(pr => pr.gw == state.currentGw)?.pts || 0) * (state.chips[state.currentGw]?.tripleCaptain ? 2 : 1) : 0;
    const rawExpectedPoints = Math.max(0, expectedPoints - captainBonus);
    const averagePlayerXP = rawExpectedPoints / 11;
    const ratingScore = Math.min(100, Math.round((averagePlayerXP / 4.1) * 100));

    container.innerHTML = `
        <div class="planner-grid">
            <!-- Left Column: The Football Pitch -->
            <div class="pitch-container">
                <div class="pitch-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div class="pitch-title-area" style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                        <h2 style="margin: 0;">Squad Selection</h2>
                        <div class="header-rating-badge" style="display: flex; align-items: center; gap: 10px; background: rgba(0, 255, 136, 0.05); border: 1px solid var(--primary-glow); padding: 5px 14px; border-radius: 20px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">RATING:</span>
                                <strong class="highlight-transfers" style="font-size: 13.5px; font-weight: 800; color: var(--secondary);">${ratingScore}/100</strong>
                            </div>

                            <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.15);"></span>

                            <div style="display: flex; align-items: center; gap: 4px;" title="GW${state.currentGw} Expected Points">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">GW${state.currentGw} XP:</span>
                                <strong class="highlight-bank" style="font-size: 13.5px; font-weight: 800; color: var(--primary);">${gw1XP.toFixed(1)}</strong>
                            </div>

                            ${hasActualPoints ? `
                                <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.15);"></span>
                                <div style="display: flex; align-items: center; gap: 4px;" title="GW${state.currentGw} Actual Points Scored">
                                    <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">GW${state.currentGw} ACTUAL:</span>
                                    <strong style="font-size: 13.5px; font-weight: 800; color: #10b981;">${actualPoints} pts</strong>
                                </div>
                            ` : ''}

                            <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.15);"></span>

                            <div style="display: flex; align-items: center; gap: 4px;" title="Cumulative XP over 3 Gameweeks">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">3 GW XP:</span>
                                <strong style="font-size: 13.5px; font-weight: 800; color: #00f2fe;">${gw3XP.toFixed(1)}</strong>
                            </div>

                            <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.15);"></span>

                            <div style="display: flex; align-items: center; gap: 4px;" title="Cumulative XP over 5 Gameweeks">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">5 GW XP:</span>
                                <strong style="font-size: 13.5px; font-weight: 800; color: #38bdf8;">${gw5XP.toFixed(1)}</strong>
                            </div>

                            <span style="height: 12px; width: 1px; background: rgba(255,255,255,0.15);"></span>

                            <div style="display: flex; align-items: center; gap: 4px;" title="Cumulative XP over 10 Gameweeks">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">10 GW XP:</span>
                                <strong style="font-size: 13.5px; font-weight: 800; color: #a78bfa;">${gw10XP.toFixed(1)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="pitch-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
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
                        <button class="pitch-btn" id="autoRotateBtn" title="Auto-Optimize Lineup & Captaincy" style="background: rgba(0, 255, 136, 0.1); border: 1px solid var(--primary-glow); color: var(--primary); margin-left: 8px;">
                            <i data-lucide="sparkles" style="width: 14px; height: 14px; margin-right: 4px;"></i> Auto Pick
                        </button>
                        <button class="pitch-btn" id="resetTeamBtn" title="Reset/Clear Team" style="margin-left: 8px;">
                            <i data-lucide="rotate-ccw"></i> Reset Team
                        </button>
                    </div>
                </div>

                <!-- Draft Selector Dropdown Row -->
                <div class="draft-select-row" style="display: flex; align-items: center; gap: 8px; margin: 0 0 16px 0; background: rgba(30, 41, 59, 0.15); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px; box-sizing: border-box; width: 100%;">
                    <i data-lucide="folder" style="width: 14px; height: 14px; color: var(--text-muted); flex-shrink: 0;"></i>
                    <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; white-space: nowrap; margin-right: 4px;">Active Draft:</span>
                    <select id="draftSelect" class="formation-select" style="flex: 1; min-width: 120px; max-width: 250px; text-transform: none; font-size: 13px; font-weight: 500; height: 32px; padding: 4px 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); cursor: pointer;">
                        ${state.drafts.map((draft, idx) => `
                            <option value="${idx}" ${state.activeDraftIndex === idx ? 'selected' : ''}>
                                📁 ${draft.name}
                            </option>
                        `).join('')}
                    </select>
                    <input type="text" id="plannerFplTeamId" class="formation-select" placeholder="FPL ID" style="display: inline-block; width: 70px; height: 32px; font-size: 12px; padding: 4px 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); margin-left: 4px; box-sizing: border-box;" value="${localStorage.getItem('fpl_hub_last_imported_team_id') || ''}" />
                    <button class="pitch-btn" id="plannerImportBtn" title="Import from FPL Team ID" style="display: flex; height: 32px; padding: 0 10px; align-items: center; justify-content: center; border-radius: 6px; background: var(--primary); border: 1px solid var(--primary-glow); color: #000; font-weight: 700; cursor: pointer; font-size: 12px; margin-left: 4px; border: none;">Import</button>
                    <button class="pitch-btn" id="renameDraftBtn" title="Rename Current Draft" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer;"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
                    <button class="pitch-btn" id="cloneDraftBtn" title="Clone Current Draft" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer;"><i data-lucide="copy" style="width: 14px; height: 14px;"></i></button>
                    <button class="pitch-btn" id="deleteDraftBtn" title="Reset/Clear Current Draft" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; cursor: pointer;"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                    <button class="pitch-btn" id="exportDraftsBtn" title="Export All Drafts" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer;"><i data-lucide="download" style="width: 14px; height: 14px;"></i></button>
                    <button class="pitch-btn" id="importDraftsBtn" title="Import Drafts from File" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer;"><i data-lucide="upload" style="width: 14px; height: 14px;"></i></button>
                    <button class="pitch-btn" id="copySquadClipboardBtn" title="Copy Current Squad to Clipboard" style="height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer;"><i data-lucide="clipboard" style="width: 14px; height: 14px;"></i></button>
                    <input type="file" id="importDraftsInput" accept=".json" style="display: none;" />
                    
                    ${renderSetPieceLegend()}

                    <!-- Lock / Unlock Button & Check Risks -->

                    <button class="pitch-btn" id="plannerCheckSquadRisksBtn" title="Check Squad Starter Risks" style="height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-radius: 6px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #f59e0b; cursor: pointer; font-size: 12px; font-weight: 600; margin-left: auto; flex-shrink: 0; white-space: nowrap;">
                        <i data-lucide="shield-alert" style="width: 14px; height: 14px;"></i>
                        <span>Check Risks</span>
                    </button>

                    <button class="pitch-btn" id="toggleLockBtn" title="${state.isSquadUnlocked ? 'Lock Squad' : 'Unlock Squad to Remove Players'}" style="height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-radius: 6px; background: ${state.isSquadUnlocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${state.isSquadUnlocked ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}; color: ${state.isSquadUnlocked ? '#ef4444' : 'var(--text-main)'}; cursor: pointer; font-size: 12px; font-weight: 600; margin-left: 8px; flex-shrink: 0;">
                        <i data-lucide="${state.isSquadUnlocked ? 'unlock' : 'lock'}" style="width: 14px; height: 14px;"></i>
                        <span>${state.isSquadUnlocked ? 'Unlocked' : 'Locked'}</span>
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
                        ${renderPlayerRow(currentSlots, "GKP", state.currentGw, captain, vice, actions, state.isSquadUnlocked, state)}
                    </div>

                    <!-- DEF Row -->
                    <div class="pitch-row" data-row="DEF">
                        ${renderPlayerRow(currentSlots, "DEF", state.currentGw, captain, vice, actions, state.isSquadUnlocked, state)}
                    </div>

                    <!-- MID Row -->
                    <div class="pitch-row" data-row="MID">
                        ${renderPlayerRow(currentSlots, "MID", state.currentGw, captain, vice, actions, state.isSquadUnlocked, state)}
                    </div>

                    <!-- FWD Row -->
                    <div class="pitch-row" data-row="FWD">
                        ${renderPlayerRow(currentSlots, "FWD", state.currentGw, captain, vice, actions, state.isSquadUnlocked, state)}
                    </div>
                </div>

                <!-- Bench Section -->
                <div class="bench-container">
                    <span class="bench-title">Bench (Click starter to swap with bench)</span>
                    <div class="bench-row" id="benchRow">
                        ${renderBenchRow(currentSlots, state.currentGw, captain, vice, actions, state.isSquadUnlocked, state)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Trigger Lucide icons
    lucide.createIcons();

    // No horizontal draft tabs to scroll

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
    return getNGwXp(player, currentGw, 5);
}

function getNGwXp(player, currentGw, n) {
    if (!player || !player.predictions) return 0;
    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
    let sum = 0;
    for (let gw = currentGw; gw < currentGw + n; gw++) {
        const pred = player.predictions.find(p => p.gw == gw);
        if (pred) {
            const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
            sum += (raw * factor);
        }
    }
    return sum;
}


function formatFdrOpponentText(pr) {
    if (!pr || !pr.opp || pr.opp === 'BYE') return 'BYE';
    const rawOpp = pr.opp.replace(/\s*\([haHA]\)$/, '').trim().toUpperCase();
    const loc = pr.loc ? pr.loc.toUpperCase() : (pr.opp.toLowerCase().includes('(a)') ? 'A' : 'H');
    return `${rawOpp} (${loc})`;
}

function renderPitchFixtures(player, currentGw) {
    let html = '';
    const startGw = Number(currentGw);
    for (let gw = startGw; gw < startGw + 3; gw++) {
        if (gw > 38) break;
        const pr = player.predictions.find(p => p.gw == gw);
        if (pr) {
            const oppText = formatFdrOpponentText(pr);
            const fdrColor = getFdrColor(pr.diff);
            
            // Resolve XP
            const ptsVal = pr.pts;
            const ptsText = ptsVal.toFixed(1).endsWith('.0') ? Math.round(ptsVal) : ptsVal.toFixed(1);
            
            // Uppercase opponent team name with (H) or (A)
            const teamNameText = formatFdrOpponentText(pr);
            
            // Dynamic text color for accessibility contrast
            const isDarkBg = pr.diff === 4 || pr.diff === 5;
            const textColor = isDarkBg ? '#ffffff' : '#0f172a';
            const textShadow = isDarkBg 
                ? '0 0.5px 1px rgba(0,0,0,0.5)' 
                : '0 0.5px 1px rgba(255,255,255,0.4)';
                
            html += `
                <div class="pitch-fixture-badge" title="GW${gw}: ${oppText} - FDR ${pr.diff} (XP: ${pr.pts.toFixed(1)})" style="background-color: ${fdrColor}; color: ${textColor}; padding: 4px 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; font-weight: 800; text-align: center; font-family: var(--font-body); width: 100%; box-sizing: border-box;">
                    <span class="pitch-fixture-badge-xp" style="font-size: 10.5px; font-weight: 800; display: block; text-shadow: ${textShadow}; color: ${textColor};">${ptsText}</span>
                    <span class="pitch-fixture-badge-team" style="font-size: 10px; font-weight: 800; opacity: ${isDarkBg ? '0.95' : '0.9'}; display: block; margin-top: 1px; text-transform: uppercase; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${textColor}; text-shadow: ${textShadow};">${teamNameText}</span>
                </div>
            `;
        } else {
            html += `
                <div class="pitch-fixture-badge" title="GW${gw}: BYE" style="background-color: #334155; color: #ffffff; padding: 4px 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; font-weight: 800; text-align: center; font-family: var(--font-body); width: 100%; box-sizing: border-box;">
                    <span class="pitch-fixture-badge-xp" style="font-size: 10.5px; font-weight: 800; display: block; color: #ffffff; text-shadow: 0 0.5px 1px rgba(0,0,0,0.5);">0</span>
                    <span class="pitch-fixture-badge-team" style="font-size: 10px; font-weight: 800; opacity: 0.9; display: block; margin-top: 1px; color: #94a3b8; text-shadow: 0 0.5px 1px rgba(0,0,0,0.5);">BYE</span>
                </div>
            `;
        }
    }
    return html;
}

function renderFdrFixtures(player, currentGw) {
    if (!player || !player.predictions) return '';
    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
    const currentGwNum = parseInt(currentGw) || 1;

    let html = '<div class="fdr-fixtures-container" style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin: 4px 0 2px 0;">';
    for (let gw = currentGwNum; gw < currentGwNum + 5; gw++) {
        if (gw > 38) break;
        const pr = player.predictions.find(p => p.gw == gw);
        if (pr) {
            const oppText = formatFdrOpponentText(pr);
            const ptsVal = ((pr._rawPts !== undefined ? pr._rawPts : pr.pts) * factor);
            const ptsText = `${ptsVal.toFixed(1)} XP`;

            const isDarkBg = pr.diff === 4 || pr.diff === 5 || pr.diff === 1;
            const textColor = isDarkBg ? '#ffffff' : '#0f172a';

            html += `
                <div class="fdr-fixture-badge diff-${pr.diff}" title="GW${gw}: ${oppText} (FDR ${pr.diff} - ${ptsText})" style="
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4px 7px;
                    border-radius: 5px;
                    min-width: 52px;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                    line-height: 1.15;
                ">
                    <span style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: ${textColor}; letter-spacing: 0.2px;">${oppText}</span>
                    <span style="font-size: 9px; font-weight: 800; margin-top: 2px; color: ${textColor}; opacity: 0.95;">${ptsText}</span>
                </div>
            `;
        } else {
            html += `
                <div class="fdr-fixture-badge" title="GW${gw}: BYE" style="
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4px 7px;
                    border-radius: 5px;
                    min-width: 52px;
                    text-align: center;
                    background-color: #334155;
                    color: #ffffff;
                    line-height: 1.15;
                ">
                    <span style="font-size: 9.5px; font-weight: 800; color: #ffffff;">BYE</span>
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; margin-top: 2px;">0 XP</span>
                </div>
            `;
        }
    }
    html += '</div>';
    return html;
}




function renderPlayerTooltip(player, currentGw, state = null) {
    const ratings = getPlayerRatings(player, currentGw);
    const getBadgeClass = (val) => {
        if (val === 'A') return 'rating-badge-a';
        if (val === 'B') return 'rating-badge-b';
        if (val === 'C') return 'rating-badge-c';
        if (val === 'D') return 'rating-badge-d';
        if (val === 'E') return 'rating-badge-e';
        return 'rating-badge-na';
    };

    const starts = typeof player.GS === 'number' ? player.GS : '—';
    const avgMins = typeof player.MPPG === 'number' ? player.MPPG.toFixed(0) + 'm' : '—';

    // GK-specific quick stats
    const isGKP = player.position === 'GKP';
    const savesTotal = isGKP && typeof player.saves === 'number' ? player.saves : null;
    const saves90Val = isGKP && typeof player.saves90 === 'number' ? player.saves90.toFixed(1) : null;
    
    // Check if player is transferred in during currentGw
    const weeklyTransfers = (state && state.transfers && state.transfers[currentGw]) || [];
    const txForPlayer = weeklyTransfers.find(tx => tx.in === player.id);
    const isTransferredIn = !!txForPlayer;
    const pOut = isTransferredIn ? PLAYERS.find(p => p.id === txForPlayer.out) : null;
    const transferReplacementHtml = isTransferredIn && pOut ? `
        <div style="background: rgba(0, 255, 136, 0.12); border: 1px solid rgba(0, 255, 136, 0.25); color: var(--primary); font-size: 11.5px; font-weight: 700; padding: 6px 10px; border-radius: 6px; margin: 8px 0; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>🔄 Replaces: ${pOut.name}</span>
        </div>
    ` : '';
    
    return `
        <div class="player-card-tooltip">
            <div class="tooltip-title">
                <span>${player.name}</span>
                <span class="tooltip-title-team">${player.team}</span>
            </div>
            ${transferReplacementHtml}
            <div class="tooltip-quick-stats">
                <div class="tooltip-quick-stat">
                    <span class="tooltip-quick-stat-val">${starts}</span>
                    <span class="tooltip-quick-stat-lbl">Starts</span>
                </div>
                <div class="tooltip-quick-stat">
                    <span class="tooltip-quick-stat-val">${avgMins}</span>
                    <span class="tooltip-quick-stat-lbl">Avg Mins</span>
                </div>
                ${isGKP && savesTotal !== null ? `
                <div class="tooltip-quick-stat">
                    <span class="tooltip-quick-stat-val">${savesTotal}</span>
                    <span class="tooltip-quick-stat-lbl">Saves</span>
                </div>
                <div class="tooltip-quick-stat">
                    <span class="tooltip-quick-stat-val">${saves90Val}</span>
                    <span class="tooltip-quick-stat-lbl">Sv/90</span>
                </div>` : ''}
            </div>
            <hr class="tooltip-stats-divider">
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


const getPlayerRiskInfo = (player, state) => {
    if (!state || !state.squadRisks) return null;
    return state.squadRisks[player.name] || null;
};

export function renderPlayerRow(squadSlots, position, currentGw, captain, vice, actions, isSquadUnlocked = false, state = null) {
    const rowSlots = squadSlots.filter(s => s.position === position && s.isStarting);

    return rowSlots.map((slot, index) => {
        if (slot.playerId === null) {
            const slotIndex = squadSlots.indexOf(slot);
            const prevPlayer = slot.prevPlayerId ? PLAYERS.find(p => p.id === slot.prevPlayerId) : null;
            const prevPlayerName = prevPlayer ? (prevPlayer.name.split(' ').pop()) : '';
            return `
                <div class="player-pitch-card empty-slot" data-slot-index="${slotIndex}" data-position="${position}" data-type="starter">
                    <div class="shirt-icon-wrapper">
                        <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div class="player-card-info">
                        <div class="player-pitch-name">Add ${position}</div>
                        <div class="player-pitch-points">Empty Slot</div>
                        ${prevPlayer ? `
                            <button class="restore-player-btn" data-slot-index="${slotIndex}" data-player-id="${prevPlayer.id}" style="margin-top: 5px; padding: 2px 6px; font-size: 9px; font-weight: 700; background: rgba(0, 242, 254, 0.2); color: var(--secondary); border: 1px solid var(--secondary-glow); border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; z-index: 10;">
                                <i data-lucide="rotate-ccw" style="width: 10px; height: 10px;"></i> Restore ${prevPlayerName}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        const player = PLAYERS.find(p => p.id === slot.playerId);
        if (!player) return '';

        const prediction = player.predictions.find(pr => pr.gw == currentGw) || { pts: 0, opp: "BYE", loc: "" };
        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: "#ffffff" };

        const livePointsMap = (state && state.livePoints && state.livePoints[currentGw]) || {};
        const livePts = livePointsMap[player.id];
        const hasLive = (livePts !== undefined && livePts !== null);
        const actualVal = hasLive ? livePts : prediction.actualPts;
        
        let designationBadge = '';
        if (player.id === captain) {
            designationBadge = `<span class="badge-captain">C</span>`;
        } else if (player.id === vice) {
            designationBadge = `<span class="badge-vice">V</span>`;
        }

        const riskInfo = getPlayerRiskInfo(player, state);
        const cardClass = riskInfo ? `has-starting-risk risk-${riskInfo.risk.toLowerCase()}` : '';
        const riskBadge = riskInfo ? `
            <div class="pitch-risk-badge risk-${riskInfo.risk.toLowerCase()}" title="Starting Risk: ${riskInfo.risk}\n${riskInfo.reason}">
                <i data-lucide="alert-triangle"></i>
            </div>
        ` : '';

        const riskColor = riskInfo ? (riskInfo.risk === 'High' ? '#ef4444' : (riskInfo.risk === 'Medium' ? '#f59e0b' : '#38bdf8')) : '';
        const riskLabel = riskInfo ? `
            <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: ${riskColor}; background: ${riskColor}1a; padding: 1px 4px; border-radius: 3px; border: 0.5px solid ${riskColor}33; margin-right: 4px; display: inline-flex; align-items: center; gap: 2px;">
                <span style="width: 4px; height: 4px; border-radius: 50%; background: ${riskColor}; display: inline-block;"></span>
                ${riskInfo.risk}
            </span>
        ` : '';

        // Check if player was transferred in during currentGw
        const weeklyTransfers = (state && state.transfers && state.transfers[currentGw]) || [];
        const txForPlayer = weeklyTransfers.find(tx => tx.in === player.id);
        const isTransferredIn = !!txForPlayer;
        const pOut = isTransferredIn ? PLAYERS.find(p => p.id === txForPlayer.out) : null;
        
        let finalCardClass = cardClass;
        if (isTransferredIn) {
            finalCardClass += ' is-transferred-in';
        }
        
        const transferBadgeHtml = isTransferredIn && pOut ? `
            <div class="tp-transfer-badge" title="Planned transfer: ${pOut.name} &rarr; OUT">IN</div>
        ` : '';

        return `
            <div class="player-pitch-card ${finalCardClass}" data-id="${player.id}" data-type="starter">
                <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player" style="display: ${isSquadUnlocked ? 'flex' : 'none'} !important; opacity: 1 !important;">&times;</button>
                <div class="shirt-icon-wrapper" style="position: relative;">
                    ${getShirtSVG(teamObj.color, player.team, player.position)}
                    ${designationBadge}
                    ${riskBadge}
                    ${transferBadgeHtml}
                    ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="${player.oldTeam ? `Transferred from ${player.oldTeam}` : 'New arrival this season'}">⇆</div>` : ''}
                </div>

                <div class="player-card-info" style="padding: 0 !important; overflow: hidden; display: flex; flex-direction: column; border-radius: 8px;">
                    <div class="pitch-card-info-header">
                        <div class="player-pitch-name" style="display:flex; align-items:center; justify-content:center; gap:4px; flex-wrap:wrap;">
                            <span>${actions.getWebName(player)}</span>
                            ${renderSetPieceBadges(player)}
                        </div>
                        <div class="player-pitch-points" style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; line-height: 1.2;">
                            ${riskLabel}
                            <span class="player-pitch-price">£${player.price.toFixed(1)}m</span>
                            <span class="player-pitch-sep" style="color: var(--text-muted);"> • </span>
                            ${actualVal !== undefined && actualVal !== null ? `
                                <span class="player-pitch-xp" style="display: inline-flex; align-items: center; gap: 3px;">
                                    <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">xP:</span>
                                    <strong style="color: var(--primary); font-weight: 700;">${prediction.pts.toFixed(1)}</strong>
                                    <span style="color: var(--text-muted); font-weight: 500;">•</span>
                                    <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">Act:</span>
                                    <strong style="color: ${actualVal >= 8 ? '#10b981' : (actualVal >= 2 ? '#f59e0b' : '#ef4444')}; font-weight: 800;">${actualVal}</strong>
                                </span>
                            ` : `
                                <span class="player-pitch-xp" style="display: inline-flex; align-items: center; gap: 3px;">
                                    <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">xP:</span>
                                    <strong style="color: var(--primary); font-weight: 700;">${prediction.pts.toFixed(1)}</strong>
                                    <span style="color: var(--text-muted); font-weight: 500;">•</span>
                                    <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">5GW:</span>
                                    <strong style="color: var(--secondary); font-weight: 700;">${get5GwXp(player, currentGw).toFixed(1)}</strong>
                                </span>
                            `}
                        </div>
                    </div>
                    <div class="pitch-card-fixtures-grid">
                        ${renderPitchFixtures(player, currentGw)}
                    </div>
                </div>
                ${renderPlayerTooltip(player, currentGw, state)}
            </div>
        `;
    }).join('');
}

export function renderBenchRow(squadSlots, currentGw, captain, vice, actions, isSquadUnlocked = false, state = null) {
    const benchSlots = squadSlots.filter(s => !s.isStarting);
    return benchSlots.map((slot, index) => {
        const label = index === 0 ? "GKP" : `Sub ${index} (${slot.position})`;
        const slotIndex = squadSlots.indexOf(slot);
        
        if (slot.playerId === null) {
            const prevPlayer = slot.prevPlayerId ? PLAYERS.find(p => p.id === slot.prevPlayerId) : null;
            const prevPlayerName = prevPlayer ? (prevPlayer.name.split(' ').pop()) : '';
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
                            ${prevPlayer ? `
                                <button class="restore-player-btn" data-slot-index="${slotIndex}" data-player-id="${prevPlayer.id}" style="margin-top: 5px; padding: 2px 6px; font-size: 9px; font-weight: 700; background: rgba(0, 242, 254, 0.2); color: var(--secondary); border: 1px solid var(--secondary-glow); border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; z-index: 10;">
                                    <i data-lucide="rotate-ccw" style="width: 10px; height: 10px;"></i> Restore ${prevPlayerName}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        const player = PLAYERS.find(p => p.id === slot.playerId);
        if (!player) return '';
        const prediction = player.predictions.find(pr => pr.gw == currentGw) || { pts: 0, opp: "BYE", loc: "" };
        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: "#ffffff" };

        const livePointsMap = (state && state.livePoints && state.livePoints[currentGw]) || {};
        const livePts = livePointsMap[player.id];
        const hasLive = (livePts !== undefined && livePts !== null);
        const actualVal = hasLive ? livePts : prediction.actualPts;

        let designationBadge = '';
        if (player.id === captain) {
            designationBadge = `<span class="badge-captain">C</span>`;
        } else if (player.id === vice) {
            designationBadge = `<span class="badge-vice">V</span>`;
        }

        const riskInfo = getPlayerRiskInfo(player, state);
        const cardClass = riskInfo ? `has-starting-risk risk-${riskInfo.risk.toLowerCase()}` : '';
        const riskBadge = riskInfo ? `
            <div class="pitch-risk-badge risk-${riskInfo.risk.toLowerCase()}" title="Starting Risk: ${riskInfo.risk}\n${riskInfo.reason}">
                <i data-lucide="alert-triangle"></i>
            </div>
        ` : '';

        const riskColor = riskInfo ? (riskInfo.risk === 'High' ? '#ef4444' : (riskInfo.risk === 'Medium' ? '#f59e0b' : '#38bdf8')) : '';
        const riskLabel = riskInfo ? `
            <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: ${riskColor}; background: ${riskColor}1a; padding: 1px 4px; border-radius: 3px; border: 0.5px solid ${riskColor}33; margin-right: 4px; display: inline-flex; align-items: center; gap: 2px;">
                <span style="width: 4px; height: 4px; border-radius: 50%; background: ${riskColor}; display: inline-block;"></span>
                ${riskInfo.risk}
            </span>
        ` : '';

        // Check if player was transferred in during currentGw
        const weeklyTransfers = (state && state.transfers && state.transfers[currentGw]) || [];
        const txForPlayer = weeklyTransfers.find(tx => tx.in === player.id);
        const isTransferredIn = !!txForPlayer;
        const pOut = isTransferredIn ? PLAYERS.find(p => p.id === txForPlayer.out) : null;
        
        let finalCardClass = cardClass;
        if (isTransferredIn) {
            finalCardClass += ' is-transferred-in';
        }
        
        const transferBadgeHtml = isTransferredIn && pOut ? `
            <div class="tp-transfer-badge" title="Planned transfer: ${pOut.name} &rarr; OUT">IN</div>
        ` : '';

        return `
            <div class="bench-slot-wrapper">
                <span class="bench-slot-label">${label}</span>
                <div class="player-pitch-card ${finalCardClass}" data-id="${player.id}" data-type="bench" data-index="${index}" style="width: 100%;">
                    <button class="pitch-sell-btn" data-id="${player.id}" title="Remove Player" style="display: ${isSquadUnlocked ? 'flex' : 'none'} !important; opacity: 1 !important;">&times;</button>
                    <div class="shirt-icon-wrapper" style="position: relative;">
                        ${getShirtSVG(teamObj.color, player.team, player.position)}
                        ${designationBadge}
                        ${riskBadge}
                        ${transferBadgeHtml}
                        ${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="${player.oldTeam ? `Transferred from ${player.oldTeam}` : 'New arrival this season'}">⇆</div>` : ''}
                    </div>

                    <div class="player-card-info" style="padding: 0 !important; overflow: hidden; display: flex; flex-direction: column; border-radius: 8px;">
                        <div class="pitch-card-info-header">
                            <div class="player-pitch-name" style="display:flex; align-items:center; justify-content:center; gap:4px; flex-wrap:wrap;">
                                <span>${actions.getWebName(player)}</span>
                                ${renderSetPieceBadges(player)}
                            </div>
                            <div class="player-pitch-points" style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; line-height: 1.2;">
                                ${riskLabel}
                                <span class="player-pitch-price">£${player.price.toFixed(1)}m</span>
                                <span class="player-pitch-sep" style="color: var(--text-muted);"> • </span>
                                ${actualVal !== undefined && actualVal !== null ? `
                                    <span class="player-pitch-xp" style="display: inline-flex; align-items: center; gap: 3px;">
                                        <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">xP:</span>
                                        <strong style="color: var(--primary); font-weight: 700;">${prediction.pts.toFixed(1)}</strong>
                                        <span style="color: var(--text-muted); font-weight: 500;">•</span>
                                        <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">Act:</span>
                                        <strong style="color: ${actualVal >= 8 ? '#10b981' : (actualVal >= 2 ? '#f59e0b' : '#ef4444')}; font-weight: 800;">${actualVal}</strong>
                                    </span>
                                ` : `
                                    <span class="player-pitch-xp" style="display: inline-flex; align-items: center; gap: 3px;">
                                        <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">xP:</span>
                                        <strong style="color: var(--primary); font-weight: 700;">${prediction.pts.toFixed(1)}</strong>
                                        <span style="color: var(--text-muted); font-weight: 500;">•</span>
                                        <span style="color: var(--text-muted); font-size: 9.5px; font-weight: 600; text-transform: uppercase;">5GW:</span>
                                        <strong style="color: var(--secondary); font-weight: 700;">${get5GwXp(player, currentGw).toFixed(1)}</strong>
                                    </span>
                                `}
                            </div>
                        </div>
                        <div class="pitch-card-fixtures-grid">
                            ${renderPitchFixtures(player, currentGw)}
                        </div>
                    </div>
                    ${renderPlayerTooltip(player, currentGw, state)}
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


    // IMPORTANT: .player-pitch-card:hover has a CSS transform (translateY + scale).
    // CSS transforms create a new stacking context, which breaks position:fixed children —
    // they get trapped inside the transformed element no matter the z-index.
    // Fix: physically move the tooltip to document.body on mouseenter, restore on hide.
    let _tooltipHideTimer = null;
    let _activeTooltip = null;     // the tooltip currently in body
    let _activeTooltipOrigin = null; // the card it came from

    const hideActiveTooltip = () => {
        if (_tooltipHideTimer) {
            clearTimeout(_tooltipHideTimer);
            _tooltipHideTimer = null;
        }
        if (_activeTooltip) {
            _activeTooltip.classList.remove('tooltip-visible');
            if (_activeTooltipOrigin) {
                _activeTooltipOrigin.appendChild(_activeTooltip);
            } else if (_activeTooltip.parentNode === document.body) {
                _activeTooltip.remove();
            }
            _activeTooltip = null;
            _activeTooltipOrigin = null;
        }
        document.querySelectorAll('body > .player-card-tooltip').forEach(el => {
            el.classList.remove('tooltip-visible');
            el.remove();
        });
    };

    const _docClickHideTooltip = (e) => {
        if (!e.target.closest('.player-pitch-card') && !e.target.closest('.player-card-tooltip')) {
            hideActiveTooltip();
        }
    };
    document.addEventListener('click', _docClickHideTooltip);
    if (window._plannerDocClickCleanup) window._plannerDocClickCleanup();
    window._plannerDocClickCleanup = () => document.removeEventListener('click', _docClickHideTooltip);

    container.querySelectorAll('.player-pitch-card:not(.empty-slot)').forEach(card => {
        card.addEventListener('mouseenter', () => {
            if (_tooltipHideTimer) { clearTimeout(_tooltipHideTimer); _tooltipHideTimer = null; }

            // If there's already a tooltip from another card, hide it immediately
            if (_activeTooltip && _activeTooltipOrigin !== card) {
                _activeTooltip.classList.remove('tooltip-visible');
                if (_activeTooltipOrigin) _activeTooltipOrigin.appendChild(_activeTooltip);
                _activeTooltip = null;
                _activeTooltipOrigin = null;
            }

            const tooltip = card.querySelector('.player-card-tooltip');
            if (!tooltip) return;

            // Detach from card and attach to body to escape the CSS transform stacking context
            document.body.appendChild(tooltip);
            _activeTooltip = tooltip;
            _activeTooltipOrigin = card;

            // Measure while invisible
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';
            const tooltipH = tooltip.offsetHeight;
            const tooltipW = tooltip.offsetWidth;
            tooltip.style.display = '';
            tooltip.style.visibility = '';

            const cardRect = card.getBoundingClientRect();
            const vpW = window.innerWidth;
            const GAP = 8;

            // Vertical: prefer above, fall back to below
            let top;
            if (cardRect.top - tooltipH - GAP >= 0) {
                top = cardRect.top - tooltipH - GAP;
            } else {
                top = cardRect.bottom + GAP;
            }

            // Horizontal: center on card, clamped to viewport
            let left = cardRect.left + cardRect.width / 2 - tooltipW / 2;
            left = Math.max(GAP, Math.min(left, vpW - tooltipW - GAP));

            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            tooltip.classList.add('tooltip-visible');
        });

        card.addEventListener('mouseleave', () => {
            _tooltipHideTimer = setTimeout(() => {
                hideActiveTooltip();
            }, 80);
        });
    });

    // Hide tooltip if user scrolls (position would be stale)
    const _scrollHideTooltip = () => hideActiveTooltip();
    window.addEventListener('scroll', _scrollHideTooltip, { passive: true, once: false });
    // Clean up scroll listener when planner re-renders (next renderActiveView call)
    if (window._plannerScrollCleanup) window._plannerScrollCleanup();
    window._plannerScrollCleanup = () => window.removeEventListener('scroll', _scrollHideTooltip);

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
            const restoreBtn = e.target.closest('.restore-player-btn');
            if (restoreBtn) {
                e.stopPropagation();
                const slotIndex = parseInt(restoreBtn.getAttribute('data-slot-index'));
                const playerId = parseInt(restoreBtn.getAttribute('data-player-id'));
                actions.restorePlayer(slotIndex, playerId);
                return;
            }
            const slotIndex = parseInt(card.getAttribute('data-slot-index'));
            const position = card.getAttribute('data-position');
            openAddPlayerModal(container, state, actions, slotIndex, position);
        });
    });

    // Draft switching dropdown listener
    const draftSelect = container.querySelector('#draftSelect');
    if (draftSelect) {
        draftSelect.addEventListener('change', e => {
            const newIdx = parseInt(e.target.value);
            if (newIdx === state.activeDraftIndex) return;

            state.switchDraft(newIdx);
            actions.renderActiveView();
            actions.showToast(`Loaded ${state.drafts[newIdx].name}`, 'success');
        });
    }

    // Toggle Squad Lock/Unlock
    const toggleLockBtn = container.querySelector('#toggleLockBtn');
    if (toggleLockBtn) {
        toggleLockBtn.addEventListener('click', () => {
            state.isSquadUnlocked = !state.isSquadUnlocked;
            actions.renderActiveView();
            actions.showToast(state.isSquadUnlocked ? "Squad unlocked! Tap the red X to remove players." : "Squad locked.", "info");
        });
    }

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

    // Draft deleting/resetting
    const deleteDraftBtn = container.querySelector('#deleteDraftBtn');
    if (deleteDraftBtn) {
        deleteDraftBtn.addEventListener('click', () => {
            const currentDraft = state.drafts[state.activeDraftIndex];
            if (confirm(`Are you sure you want to reset and clear the draft "${currentDraft.name}"? This will empty the squad and clear all transfers.`)) {
                currentDraft.squadSlots = null;
                currentDraft.captain = null;
                currentDraft.vice = null;
                currentDraft.formation = '4-4-2';
                currentDraft.transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
                currentDraft.chips = {};
                for (let gw = 1; gw <= 38; gw++) {
                    currentDraft.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
                }
                currentDraft.weeklyLineups = {};
                currentDraft.name = state.activeDraftIndex === 0 ? 'FPL Team ID' : `Draft ${state.activeDraftIndex + 1}`;
                
                state.loadActiveDraftState();
                state.saveState();
                actions.renderActiveView();
                actions.showToast('Draft has been reset and cleared.', 'info');
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
            state.cloneDraft(targetIndex);
            actions.renderActiveView();
            actions.showToast(`Successfully cloned into slot ${targetNum} ("${targetDraft.name}")`, "success");
        });
    }

    // Export drafts
    const exportDraftsBtn = container.querySelector('#exportDraftsBtn');
    if (exportDraftsBtn) {
        exportDraftsBtn.addEventListener('click', () => {
            // Sync current active view to the active draft slot first
            state.saveState();

            try {
                const dataStr = JSON.stringify(state.drafts, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', 'fpl_hub_drafts.json');
                linkElement.click();
                actions.showToast("All drafts exported successfully!", "success");
            } catch (err) {
                console.error(err);
                actions.showToast("Failed to export drafts.", "error");
            }
        });
    }

    // Import drafts
    const importDraftsBtn = container.querySelector('#importDraftsBtn');
    const importDraftsInput = container.querySelector('#importDraftsInput');
    if (importDraftsBtn && importDraftsInput) {
        importDraftsBtn.addEventListener('click', () => {
            importDraftsInput.click();
        });

        importDraftsInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (!Array.isArray(imported)) {
                        throw new Error("Imported data must be an array of drafts.");
                    }

                    const validatedDrafts = imported.map((draft, idx) => {
                        return {
                            name: draft.name || `Draft ${idx + 1}`,
                            squadSlots: Array.isArray(draft.squadSlots) ? draft.squadSlots : null,
                            captain: typeof draft.captain === 'number' || draft.captain === null ? draft.captain : null,
                            vice: typeof draft.vice === 'number' || draft.vice === null ? draft.vice : null,
                            formation: draft.formation || '4-4-2',
                            transfers: draft.transfers || null,
                            chips: draft.chips || null
                        };
                    });

                    while (validatedDrafts.length < 10) {
                        const idx = validatedDrafts.length;
                        validatedDrafts.push({
                            name: `Draft ${idx + 1}`,
                            squadSlots: null,
                            captain: null,
                            vice: null,
                            formation: '4-4-2',
                            transfers: null,
                            chips: null
                        });
                    }

                    state.drafts = validatedDrafts.slice(0, 10);

                    // Sync the active draft to current state
                    state.loadActiveDraftState();
                    actions.renderActiveView();
                    actions.showToast("All drafts imported successfully!", "success");
                } catch (err) {
                    console.error(err);
                    actions.showToast("Failed to parse file. Ensure it is a valid drafts JSON file.", "error");
                }
                importDraftsInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    // FPL Team ID Import handler directly from My Team Planner
    const plannerImportBtn = container.querySelector('#plannerImportBtn');
    const plannerFplTeamId = container.querySelector('#plannerFplTeamId');
    if (plannerImportBtn && plannerFplTeamId) {
        plannerImportBtn.addEventListener('click', async () => {
            const teamId = plannerFplTeamId.value.trim();
            if (!teamId) {
                actions.showToast("Please enter a valid FPL Team ID.", "error");
                return;
            }

            plannerImportBtn.innerText = "Loading...";
            plannerImportBtn.disabled = true;

            const mapFplPicksToSquadSlots = (picks) => {
                const slots = [];
                const pickPlayers = picks.map(pick => {
                    const p = PLAYERS.find(pl => pl.id === pick.element);
                    return {
                        id: pick.element,
                        position: p ? p.position : 'MID',
                        isStarting: pick.multiplier > 0
                    };
                });

                const gkps = pickPlayers.filter(p => p.position === 'GKP');
                const defs = pickPlayers.filter(p => p.position === 'DEF');
                const mids = pickPlayers.filter(p => p.position === 'MID');
                const fwds = pickPlayers.filter(p => p.position === 'FWD');

                const addSlotsForPosition = (posName, posPlayers, totalCount) => {
                    let players = [...posPlayers];
                    while (players.length < totalCount) {
                        players.push({ id: null, position: posName, isStarting: false });
                    }
                    players.forEach((p, idx) => {
                        let isStarting = false;
                        if (posName === 'GKP' && idx === 0) isStarting = true;
                        if (posName === 'DEF' && idx < 3) isStarting = true;
                        if (posName === 'MID' && idx < 4) isStarting = true;
                        if (posName === 'FWD' && idx < 3) isStarting = true;

                        slots.push({
                            position: posName,
                            playerId: p.id,
                            isStarting
                        });
                    });
                };

                addSlotsForPosition('GKP', gkps, 2);
                addSlotsForPosition('DEF', defs, 5);
                addSlotsForPosition('MID', mids, 5);
                addSlotsForPosition('FWD', fwds, 3);

                return slots;
            };

            const detectFormation = (slots) => {
                const startingDef = slots.filter(s => s.position === 'DEF' && s.isStarting).length;
                const startingMid = slots.filter(s => s.position === 'MID' && s.isStarting).length;
                const startingFwd = slots.filter(s => s.position === 'FWD' && s.isStarting).length;
                return `${startingDef}-${startingMid}-${startingFwd}`;
            };

            try {
                const res = await fetch(`/api/fpl-picks?teamId=${teamId}&gw=${state.currentGw}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || "Failed to fetch FPL picks");
                }
                const responseData = await res.json();
                if (responseData && responseData.success && responseData.data && responseData.data.picks) {
                    const picks = responseData.data.picks;
                    const importedSlots = mapFplPicksToSquadSlots(picks);
                    const bankVal = (responseData.data.entry_history ? responseData.data.entry_history.bank : 0) / 10;
                    
                    const tempCaptain = picks.find(p => p.is_captain)?.element || null;
                    const tempVice = picks.find(p => p.is_vice_captain)?.element || null;
                    const tempFormation = detectFormation(importedSlots);

                    const teamName = responseData.teamName;
                    const finalDraftName = teamName ? `${teamName} (ID: ${teamId})` : `FPL Team (ID: ${teamId})`;

                    // Overwrite the current active draft slot
                    const activeIdx = state.activeDraftIndex;
                    state.drafts[activeIdx].name = finalDraftName;
                    state.drafts[activeIdx].squadSlots = importedSlots;
                    state.drafts[activeIdx].captain = tempCaptain;
                    state.drafts[activeIdx].vice = tempVice;
                    state.drafts[activeIdx].formation = tempFormation;
                    state.drafts[activeIdx].transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
                    state.drafts[activeIdx].weeklyLineups = {
                        [state.currentGw]: {
                            starters: importedSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId),
                            bench: importedSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId),
                            captain: tempCaptain,
                            vice: tempVice,
                            formation: tempFormation
                        }
                    };

                    // Save last imported caches
                    localStorage.setItem('fpl_hub_last_imported_team_id', teamId);
                    if (teamName) {
                        localStorage.setItem('fpl_hub_last_imported_team_name', teamName);
                    } else {
                        localStorage.removeItem('fpl_hub_last_imported_team_name');
                    }
                    localStorage.setItem('fpl_hub_last_imported_squad_slots', JSON.stringify(importedSlots));
                    localStorage.setItem('fpl_hub_last_imported_captain', (tempCaptain || '').toString());
                    localStorage.setItem('fpl_hub_last_imported_vice', (tempVice || '').toString());
                    localStorage.setItem('fpl_hub_last_imported_bank', bankVal.toString());

                    // Load active draft directly
                    state.loadActiveDraftState();
                    
                    state.saveState();
                    
                    actions.showToast(`Imported FPL Team "${teamName || teamId}" successfully!`, "success");
                    actions.renderActiveView();
                } else {
                    throw new Error("Invalid picks data format");
                }
            } catch (err) {
                console.error(err);
                actions.showToast(err.message || "Failed to fetch FPL picks. Verify ID is active.", "error");
            } finally {
                plannerImportBtn.innerText = "Import";
                plannerImportBtn.disabled = false;
            }
        });
    }

    // Copy squad starters and bench to clipboard
    const copySquadClipboardBtn = container.querySelector('#copySquadClipboardBtn');
    if (copySquadClipboardBtn) {
        copySquadClipboardBtn.addEventListener('click', () => {
            try {
                const startersList = starters.map(id => {
                    const p = PLAYERS.find(pl => pl.id === id);
                    if (!p) return null;
                    let textStr = `${p.name} (${p.team}, ${p.position})`;
                    if (id === state.captain) textStr += " (C)";
                    else if (id === state.vice) textStr += " (V)";
                    return textStr;
                }).filter(Boolean);

                const benchList = bench.map(id => {
                    const p = PLAYERS.find(pl => pl.id === id);
                    if (!p) return null;
                    return `${p.name} (${p.team}, ${p.position})`;
                }).filter(Boolean);

                const squadText = `Gameweek ${state.currentGw} Squad:\n\n` +
                                  `Starting XI:\n` +
                                  startersList.map((n, i) => `${i + 1}. ${n}`).join('\n') +
                                  `\n\nBench:\n` +
                                  benchList.map((n, i) => `${i + 1}. ${n}`).join('\n');

                navigator.clipboard.writeText(squadText).then(() => {
                    actions.showToast("Squad copied to clipboard!", "success");
                }).catch(err => {
                    console.error("Clipboard copy failed:", err);
                    actions.showToast("Failed to copy squad to clipboard.", "error");
                });
            } catch (err) {
                console.error(err);
                actions.showToast("Failed to generate squad copy text.", "error");
            }
        });
    }

    const showPlannerRiskReportModal = (squadPlayers) => {
        const existing = document.getElementById('tpRiskModal');
        if (existing) existing.remove();

        const riskyPlayers = squadPlayers.filter(p => (state.squadRisks && state.squadRisks[p.name]) || (state.squadDataConfidence && state.squadDataConfidence[p.name]));

        // Calculate dynamic starting XI vs bench rotation advice
        const currentSlotsCopy = JSON.parse(JSON.stringify(state.squadSlots));
        
        const squadPlayersForOpt = currentSlotsCopy
            .map(slot => {
                if (slot.playerId === null) return null;
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                if (!p) return null;
                const pred = p.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
                const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(p) : 1.0;
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                const pts = raw * factor;
                return { slot, player: p, pts };
            })
            .filter(Boolean);

        const gkps = squadPlayersForOpt.filter(p => p.player.position === 'GKP').sort((a, b) => b.pts - a.pts);
        const defs = squadPlayersForOpt.filter(p => p.player.position === 'DEF').sort((a, b) => b.pts - a.pts);
        const mids = squadPlayersForOpt.filter(p => p.player.position === 'MID').sort((a, b) => b.pts - a.pts);
        const fwds = squadPlayersForOpt.filter(p => p.player.position === 'FWD').sort((a, b) => b.pts - a.pts);

        const validFormations = [
            [3, 4, 3], [3, 5, 2], [4, 4, 2], [4, 5, 1], [4, 3, 3], [5, 3, 2], [5, 4, 1], [5, 2, 3]
        ];

        let bestScore = -1;
        let bestStarters = [];
        let bestFormStr = '4-4-2';

        for (const [reqDef, reqMid, reqFwd] of validFormations) {
            const chosenGkp = gkps.slice(0, 1);
            const chosenDef = defs.slice(0, reqDef);
            const chosenMid = mids.slice(0, reqMid);
            const chosenFwd = fwds.slice(0, reqFwd);

            const currentStarters = [...chosenGkp, ...chosenDef, ...chosenMid, ...chosenFwd];
            if (currentStarters.length !== 11) continue;

            let score = currentStarters.reduce((sum, p) => sum + p.pts, 0);
            const maxPts = Math.max(...currentStarters.map(p => p.pts), 0);
            score += maxPts;

            if (score > bestScore) {
                bestScore = score;
                bestStarters = currentStarters.map(p => p.player.id);
                bestFormStr = `${reqDef}-${reqMid}-${reqFwd}`;
            }
        }

        const currentStartersIds = state.squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
        const currentBenchIds = state.squadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);

        const shouldStart = currentBenchIds.filter(id => bestStarters.includes(id)).map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
        const shouldBench = currentStartersIds.filter(id => !bestStarters.includes(id)).map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

        let rotationAdviceHtml = '';
        if (shouldStart.length > 0 && shouldBench.length > 0) {
            rotationAdviceHtml += `
                <div style="background: rgba(0, 255, 136, 0.04); border: 1px solid rgba(0, 255, 136, 0.2); border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 11.5px; display: flex; flex-direction: column; gap: 10px;">
                    <h4 style="margin: 0; font-family: var(--font-heading); color: var(--primary); font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="sparkles" style="width: 14px; height: 14px; color: var(--primary);"></i>
                        AI Lineup Optimization Tips (GW${state.currentGw})
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
            `;

            for (let idx = 0; idx < Math.min(shouldStart.length, shouldBench.length); idx++) {
                const sPlayer = shouldStart[idx];
                const bPlayer = shouldBench[idx];
                
                const sPred = sPlayer.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
                const sFactor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(sPlayer) : 1.0;
                const sXP = (sPred._rawPts !== undefined ? sPred._rawPts : sPred.pts) * sFactor;

                const bPred = bPlayer.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
                const bFactor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(bPlayer) : 1.0;
                const bXP = (bPred._rawPts !== undefined ? bPred._rawPts : bPred.pts) * bFactor;

                const diff = sXP - bXP;
                const diffText = diff > 0 ? `+${diff.toFixed(1)} XP` : '0.0 XP';

                const bRisk = state.squadRisks && state.squadRisks[bPlayer.name];
                const riskLabel = bRisk ? ` (${bRisk.risk} starting risk)` : '';

                rotationAdviceHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.015); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; gap: 10px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span style="color: var(--primary); font-weight: 600;">Start</span>
                            <span style="color: var(--text-main); font-weight: 700;">${sPlayer.name}</span>
                            <span style="color: var(--text-muted); font-size: 10.5px;">(${sXP.toFixed(1)} XP)</span>
                            <span style="color: var(--text-muted);">⇆ Bench</span>
                            <span style="color: var(--text-muted); font-weight: 700;">${bPlayer.name}</span>
                            <span style="color: var(--text-muted); font-size: 10.5px;">(${bXP.toFixed(1)} XP)${riskLabel}</span>
                        </div>
                        <span style="color: var(--primary); font-weight: 800; font-family: var(--font-heading); font-size: 12px;">${diffText}</span>
                    </div>
                `;
            }

            rotationAdviceHtml += `
                    </div>
                    <div style="text-align: right; margin-top: 4px;">
                        <button class="action-main-btn" id="applyAutoRotateBtn" style="margin: 0; padding: 6px 14px; font-size: 11px; background: var(--primary); border: none; color: black; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <i data-lucide="rotate-cw" style="width: 12px; height: 12px; color: black;"></i>
                            Apply Rotations
                        </button>
                    </div>
                </div>
            `;
        }

        const modalDiv = document.createElement('div');
        modalDiv.id = 'tpRiskModal';
        modalDiv.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const cardHtml = riskyPlayers.length === 0 ? `
            <div style="text-align:center; padding:30px; color:var(--text-muted);">
                <i data-lucide="check-circle" style="width:48px; height:48px; color:var(--primary); margin-bottom:12px;"></i>
                <h4 style="margin:0; font-size:14px; font-weight:800; color:var(--text-main);">No Starter Risks Detected!</h4>
                <p style="font-size:11px; margin:6px 0 0 0;">All 15 players in your squad are currently expected to start or are fully fit.</p>
            </div>
        ` : riskyPlayers.map(p => {
            const r = state.squadRisks[p.name];
            const confidence = state.squadDataConfidence && state.squadDataConfidence[p.name];
            const borderCol = r ? (r.risk === 'High' ? '#ef4444' : (r.risk === 'Medium' ? '#f59e0b' : '#38bdf8')) : '#94a3b8';
            const bgCol = r ? (r.risk === 'High' ? 'rgba(239, 68, 68, 0.05)' : (r.risk === 'Medium' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(56, 189, 248, 0.05)')) : 'rgba(148, 163, 184, 0.05)';
            return `
                <div style="background:${bgCol}; border-left:4px solid ${borderCol}; border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:4px; font-size:11.5px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:13px; color:var(--text-main); font-family:var(--font-heading);">${p.name} <span style="font-size:10px; font-weight:700; color:var(--text-muted); padding:2px 6px; background:rgba(0,0,0,0.15); border-radius:4px;">${p.team} - ${p.position}</span></strong>
                        <span style="display:flex; align-items:center; gap:6px;">
                            ${confidence ? `<span title="${confidence.reason}" style="font-size:10px; font-weight:800; text-transform:uppercase; color:#94a3b8; background:rgba(148,163,184,0.12); padding:2px 8px; border-radius:12px; border:1px solid rgba(148,163,184,0.33);">${confidence.label}</span>` : ''}
                            ${r ? `<span style="font-size:10px; font-weight:800; text-transform:uppercase; color:${borderCol}; background:${borderCol}1a; padding:2px 8px; border-radius:12px; border:1px solid ${borderCol}33;">${r.risk} Risk</span>` : ''}
                        </span>
                    </div>
                    ${r ? `<p style="margin:4px 0 0 0; color:var(--text-main); font-weight:600;">⚠️ ${r.reason}</p>` : ''}
                    ${r && r.details ? `<p style="margin:2px 0 0 0; color:var(--text-muted); font-size:10.5px; font-style:italic;">ℹ️ ${r.details}</p>` : ''}
                </div>
            `;
        }).join('<hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">');

        modalDiv.innerHTML = `
            <div class="opt-settings-card" style="width: 100%; max-width: 580px; max-height: 80vh; display: flex; flex-direction: column; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--shadow-lg); overflow: hidden;">
                <div class="opt-card-header" style="border-bottom: 1px solid var(--border-color); padding: 16px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.1);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; background:rgba(245,158,11,0.15); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(245,158,11,0.3);">
                            <i data-lucide="shield-alert" style="width:18px; height:18px; color:#f59e0b;"></i>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:15px; font-weight:800; font-family:var(--font-heading); color:var(--text-main);">AI Squad Starting Risk Analysis</h3>
                            <p style="margin:2px 0 0 0; font-size:10.5px; color:var(--text-muted);">Real-time monitoring of manager tactics, press conferences, and injury news.</p>
                        </div>
                    </div>
                    <button id="closeTpRiskModalBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:20px; font-weight:300;">&times;</button>
                </div>

                <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:12px; box-sizing:border-box;">
                    ${rotationAdviceHtml}
                    ${cardHtml}
                </div>

                <div style="padding:16px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.1);">
                    <button class="action-main-btn" id="closeTpRiskModalOkBtn" style="margin:0; padding:8px 24px; font-size:12px;">Close Report</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
        lucide.createIcons();

        const close = () => {
            modalDiv.remove();
        };

        modalDiv.querySelector('#closeTpRiskModalBtn').addEventListener('click', close);
        modalDiv.querySelector('#closeTpRiskModalOkBtn').addEventListener('click', close);

        const applyBtn = modalDiv.querySelector('#applyAutoRotateBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                // Apply optimal starting lineup directly to state.squadSlots
                bestStarters.forEach(id => {
                    const slot = state.squadSlots.find(s => s.playerId === id);
                    if (slot) slot.isStarting = true;
                });
                const allPlayerIds = [...currentStartersIds, ...currentBenchIds];
                const benchIds = allPlayerIds.filter(id => !bestStarters.includes(id));
                benchIds.forEach(id => {
                    const slot = state.squadSlots.find(s => s.playerId === id);
                    if (slot) slot.isStarting = false;
                });

                state.formation = bestFormStr;

                state.optimizeCaptaincy();
                state.saveState();
                modalDiv.remove();
                actions.renderActiveView();
                actions.showToast('Squad auto-rotated to maximize points!', 'success');
            });
        }
    };

    const computeLocalRiskEntry = (p) => {
        // Backup goalkeeper risk
        if (p.position === 'GKP' && p.price <= 4.0) {
            const primaryGKPs = PLAYERS.filter(other =>
                other.position === 'GKP' && other.team === p.team && other.price >= 4.5
            );
            const hasActivePrimary = primaryGKPs.some(other =>
                other.status !== 'i' && other.status !== 's' && (other.chanceOfPlaying === undefined || other.chanceOfPlaying > 0)
            );
            if (hasActivePrimary) {
                return { risk: "High", reason: "Second-choice / backup goalkeeper.", details: "Goalkeepers priced at £4.0m are backup options and will not start or score points on Bench Boost unless the first-choice keeper is injured or suspended." };
            }
        }

        const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;
        const status = p.status || 'a';
        const starts = typeof p.GS === 'number' ? p.GS : 25;
        const mppg = typeof p.MPPG === 'number' ? p.MPPG : 80;

        if (status === 'i' || status === 'u' || chance === 0) {
            const fallbackReason = status === 'u' ? "Unavailable (e.g. left the club)." : "Ruled out with injury.";
            return { risk: "High", reason: p.news || fallbackReason, details: "FPL official status flag set to unavailable." };
        }
        if (status === 's') {
            return { risk: "High", reason: p.news || "Suspended.", details: "FPL official status flag set to suspended." };
        }
        if (status === 'd' || chance < 75) {
            return { risk: "Medium", reason: p.news || `Doubtful starting chance (${chance}% play probability).`, details: "Player flagged by team medical staff." };
        }

        // New: positional displacement risk (data-driven, not name-keyed).
        // Displacement is a medium-term signal, checked after acute official-status risks
        // (injury/suspension/doubtful above) but before the low-priority historical-pattern
        // checks below.
        if (p.displacementRisk) {
            const gapPct = Math.round(p.displacementRisk.gap * 100);
            const risk = p.displacementRisk.gap > 0.3 ? "High" : "Medium";
            return {
                risk,
                reason: `At risk of losing his place to ${p.displacementRisk.threatenedByName}.`,
                details: `${p.displacementRisk.threatenedByName} recently joined the squad and has a ${gapPct}-point-higher start probability.`
            };
        }

        if (chance < 100) {
            return { risk: "Low", reason: p.news || `Minor fitness concern (${chance}% play probability).`, details: "Mild flag. Check press conferences before deadline." };
        }

        // Historical starting-pattern checks -- only trusted when dataConfidence isn't 'low'
        // (replaces the old PROMOTED_TEAMS-gated isPromotedOrNew bypass: a low-data player's thin
        // history shouldn't be read as a rotation risk, it just means we don't know yet).
        // Treat `undefined` (data.js not yet resynced with this field) the same as 'low' so these
        // checks stay dormant-but-safe during the transition period rather than firing on every
        // player because `undefined !== 'low'` is true.
        if (p.dataConfidence !== 'low' && p.dataConfidence !== undefined) {
            if (starts > 0 && starts < 15) {
                return { risk: "Medium", reason: `Tactical rotation risk (started only ${starts} matches last season).`, details: "Historical starting frequency indicates rotation risk." };
            }
            if (mppg > 0 && mppg < 60) {
                return { risk: "Low", reason: `Minutes risk (averages only ${mppg.toFixed(0)} mins per appearance).`, details: "Averages less than 60 minutes per game." };
            }
        }

        return null;
    };

    const computeDataConfidenceBadge = (p) => {
        // Unlike the risk-entry gate above, `undefined` is treated as NOT low here: showing a
        // "Limited Data" badge on literally every player during the transition period (before
        // data.js is resynced with real confidence values) would be noisy and wrong. Only an
        // explicit 'low' should surface the badge.
        if (p.dataConfidence !== 'low') return null;
        return {
            label: 'Limited Data',
            reason: p.transferredThisSeason
                ? 'New arrival with no Premier League track record yet at this club.'
                : 'Limited data available for this projection -- treat with extra caution.'
        };
    };

    const runPlannerSquadRiskCheck = async (slots) => {
        const apiKey = localStorage.getItem('fpl_hub_gemini_api_key');
        const squadPlayers = slots.map(s => {
            if (s.playerId === null) return null;
            return PLAYERS.find(p => p.id === s.playerId);
        }).filter(Boolean);

        state.squadRisks = {};
        state.squadDataConfidence = {};

        if (apiKey) {
            const squadListText = squadPlayers.map(p => {
                const chance = p.chanceOfPlaying !== undefined ? p.chanceOfPlaying : 100;
                return `- ${p.name} (${p.team}, ${p.position}): status=${p.status || 'a'}, news="${p.news || 'None'}", chanceOfPlaying=${chance}%, starts=${p.GS || 0}, avgMinutes=${p.MPPG || 0}m, price=£${p.price.toFixed(1)}m`;
            }).join('\n');

            const promptText = `
You are an expert Fantasy Premier League scout and analyst.
Analyze the following squad of players for their starting risk in the upcoming Premier League Gameweek.
Determine if any of them are at risk of not starting. Risks can be due to:
- Injuries (recent flags, doubt, recovery schedules)
- Manager press conferences and rotation policy
- European commitments (Champions League, Europa League, Conference League lineup shifts)
- League table situation (e.g. resting players after securing positions)
- Cup rotations (FA Cup, EFL Cup)
- International duty fatigue (long travel) or late returns
- Tactical shifts (losing their starting spot to a teammate)
- New signing uncertainty (limited or no Premier League track record at this club yet)
- Positional competition from a new arrival in the same position

Use Google Search to verify the latest manager quotes and team news for each player.

Return a JSON array of objects. Each object MUST have this exact structure:
{
  "name": "Player Name (matching input list exactly)",
  "risk": "High" (unlikely to start) or "Medium" (rotation/doubtful, ~50% chance) or "Low" (slight concern),
  "reason": "Short 1-sentence explanation of the primary risk.",
  "details": "Manager quote, injury context, or match calendar details."
}

Do not include players who are 100% fit, guaranteed starters with no rotation risk. If no player is at risk, return an empty array [].
Return ONLY a raw JSON array. No markdown formatting, no code block backticks.

Players:
${squadListText}
`;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        tools: [{ googleSearch: {} }],
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (jsonText) {
                        const parsedRisks = JSON.parse(jsonText.trim());
                        state.squadRisks = {};
                        if (Array.isArray(parsedRisks)) {
                            parsedRisks.forEach(r => {
                                state.squadRisks[r.name] = {
                                    risk: r.risk,
                                    reason: r.reason,
                                    details: r.details
                                };
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Gemini risk scan error, falling back to local scan:", err);
            }
        }

        // Always run the local, data-driven pass -- runs whether or not Gemini ran/succeeded, and
        // never overwrites a Gemini-sourced entry (Gemini's news-grounded text takes precedence
        // for the players it covers; this fills in everything else, including the two new
        // data-driven risk types Gemini's prompt doesn't compute precisely: displacement and
        // low-confidence).
        squadPlayers.forEach(p => {
            if (!state.squadRisks[p.name]) {
                const entry = computeLocalRiskEntry(p);
                if (entry) state.squadRisks[p.name] = entry;
            }
            const confidenceBadge = computeDataConfidenceBadge(p);
            if (confidenceBadge) {
                state.squadDataConfidence[p.name] = confidenceBadge;
            }
        });

        showPlannerRiskReportModal(squadPlayers);
        actions.renderActiveView();
    };

    const plannerCheckSquadRisksBtn = container.querySelector('#plannerCheckSquadRisksBtn');
    if (plannerCheckSquadRisksBtn) {
        plannerCheckSquadRisksBtn.addEventListener('click', async () => {
            if (!state.squadSlots || state.squadSlots.every(s => s.playerId === null)) {
                actions.showToast("Please add players to your squad first.", "warning");
                return;
            }

            plannerCheckSquadRisksBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:14px; height:14px;"></i> Scanning...`;
            plannerCheckSquadRisksBtn.disabled = true;

            try {
                await runPlannerSquadRiskCheck(state.squadSlots);
                actions.showToast("Squad risk scan completed!", "success");
            } catch (err) {
                console.error(err);
                actions.showToast("Notice: Fallback scan completed.", "info");
            } finally {
                plannerCheckSquadRisksBtn.innerHTML = `<i data-lucide="shield-alert" style="width: 14px; height: 14px;"></i> Check Risks`;
                plannerCheckSquadRisksBtn.disabled = false;
                lucide.createIcons();
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
                hideActiveTooltip();
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

    const freeHitBtn = container.querySelector('#chipFreeHitBtn');
    if (freeHitBtn) {
        freeHitBtn.addEventListener('click', () => toggleChip('freeHit'));
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

    // Auto Pick / Optimize Lineup
    const autoRotateBtn = container.querySelector('#autoRotateBtn');
    if (autoRotateBtn) {
        autoRotateBtn.addEventListener('click', () => {
            state.autoRotateLineup(state.currentGw);
            actions.renderActiveView();
            actions.showToast('AI optimized starting XI, formation, and captaincy!', 'success');
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
                return player.predictions.find(pr => pr.gw == gw) || { pts: 0, opp: 'BYE', loc: '', diff: 3 };
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
                            const currentLineup = state.getGwLineup(currentGw);
                            const isCurrentCap = currentLineup.captain === player.id;
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

    // Scroll active draft tab into view removed
}

// Opens the detail modal when player pitch card is clicked
function openPlayerDetailModal(playerId, type, starters, bench, state, actions, triggerSwapCallback) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    const prediction = player.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0, opp: "BYE", loc: "" };
    const teamObj = TEAMS.find(t => t.shortName === player.team);

    const lineup = state.getGwLineup(state.currentGw);
    const isCaptain = lineup.captain === playerId;
    const isVice = lineup.vice === playerId;

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
        
        const ptsA = a.predictions.find(pr => pr.gw == state.currentGw)?.pts || 0;
        const ptsB = b.predictions.find(pr => pr.gw == state.currentGw)?.pts || 0;
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
                        ${getShirtSVG(teamObj ? teamObj.color : "#ffffff", player.team, player.position)}
                    </div>
                    <div class="detail-player-info">
                        <h4 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: var(--text-main);">${player.name}</h4>
                        <p style="margin: 0; font-size: 13px; color: var(--text-muted);">${player.position} • ${player.team} ${player.transferredThisSeason ? (player.oldTeam ? `<span class="transfer-badge" style="margin-left: 8px;" title="Transferred from ${player.oldTeam}">⇆ ex-${player.oldTeam}</span>` : `<span class="transfer-badge" style="margin-left: 8px;" title="New arrival this season">⇆ NEW</span>`) : ''}</p>
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
                            const compPrediction = comp.predictions.find(pr => pr.gw == state.currentGw) || { pts: 0 };
                            
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
    const { bank, squad: allSquadIds } = squadInfo;

    const slot = state.squadSlots[slotIndex];
    const prevPlayer = (slot && slot.prevPlayerId) ? PLAYERS.find(p => p.id === slot.prevPlayerId) : null;

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
    );

    let gwWindow = 5; // default sort window

    // Generate Price Options in 0.5m increments
    let priceOptions = '<option value="">Any Price</option>';
    for (let p = 4.0; p <= 15.0; p += 0.5) {
        priceOptions += `<option value="${p.toFixed(1)}">Max: £${p.toFixed(1)}m</option>`;
    }

    // Generate Team Options sorted alphabetically
    const sortedTeams = TEAMS.slice().sort((a, b) => a.name.localeCompare(b.name));
    let teamOptions = '<option value="">All Teams (20)</option>';
    sortedTeams.forEach(t => {
        teamOptions += `<option value="${t.shortName}">${t.name} (${t.shortName})</option>`;
    });

    const modalHTML = `
        <div class="modal-header-section">
            <h3 style="display: flex; align-items: center; gap: 8px;">
                <i data-lucide="plus-circle" class="highlight-transfers" style="width: 18px; height: 18px;"></i>
                Add ${position} Slot
            </h3>
            <button class="close-modal-btn" id="closeAddPlayerModalBtn"><i data-lucide="x"></i></button>
        </div>
        <div class="checkout-modal-body" style="padding: 0; display: flex; flex-direction: column; gap: 0; max-height: 85vh; overflow-y: auto;">
            ${prevPlayer ? `
                <div class="restore-banner-modal" style="margin: 16px 20px 0 20px; padding: 12px 16px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-main);">
                        <i data-lucide="rotate-ccw" style="width: 16px; height: 16px; color: var(--secondary);"></i>
                        <span>Would you like to restore <strong>${prevPlayer.name}</strong> (${prevPlayer.team} • £${prevPlayer.price.toFixed(1)}m)?</span>
                    </div>
                    <button class="restore-modal-action-btn" data-slot-index="${slotIndex}" data-player-id="${prevPlayer.id}" style="padding: 6px 12px; font-size: 11px; font-weight: 700; background: var(--secondary); color: #000; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: transform 0.2s;">
                        Restore
                    </button>
                </div>
            ` : ''}
            <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px dashed var(--border-color); width: 100%; box-sizing: border-box;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; width: 100%;">
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0;">Max Budget: <strong class="highlight-bank" style="font-size: 14px;">£${bank.toFixed(1)}m</strong></p>
                    <p style="font-size: 11px; color: var(--text-muted); margin: 0; opacity: 0.85;">Only showing <strong style="color: var(--primary);">${position}s</strong> <span id="modalFilterCount" style="color: var(--secondary); font-weight: 700; margin-left: 4px;"></span>. Search by name or team.</p>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 8px; width: 100%;">
                    <!-- Row 1: Search | GW Sort | Team | Price -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Search</label>
                        <input type="text" class="transfer-search-field" id="modalSearchField" placeholder="Name or team..." style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 10px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;" />
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Sort by XP</label>
                        <select class="panel-price-select" id="modalGwWindowSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--primary); border: 1px solid var(--primary); border-radius: 6px; font-weight: 700;">
                            <option value="1">1-GW XP</option>
                            <option value="2">2-GW XP</option>
                            <option value="3">3-GW XP</option>
                            <option value="4">4-GW XP</option>
                            <option value="5" selected>5-GW XP</option>
                            <option value="10">10-GW XP</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Team</label>
                        <select class="panel-price-select" id="modalTeamSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            ${teamOptions}
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Max Price</label>
                        <select class="panel-price-select" id="modalPriceSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            ${priceOptions}
                        </select>
                    </div>

                    <!-- Row 2: Spot Kicks | Attacking | Defcon | Avg Mins | Starts -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: #ffd700; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Spot Kicks / Set Pieces</label>
                        <select class="panel-price-select" id="modalSetPieceSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            <option value="">Any</option>
                            <option value="pk">🎯 Spot-Kicks / Penalties (PK)</option>
                            <option value="fk">⚡ Direct Free-Kicks (FK)</option>
                            <option value="ck">🚩 Corners (CK)</option>
                            <option value="any">🎯/⚡/🚩 Any Set-Piece Duty</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Attacking Rating</label>
                        <select class="panel-price-select" id="modalAttSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            <option value="">Any</option>
                            <option value="A">A — Excellent</option>
                            <option value="B">B+</option>
                            <option value="C">C+</option>
                            <option value="D">D+</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Defcon Rating</label>
                        <select class="panel-price-select" id="modalDefconSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            <option value="">Any</option>
                            <option value="A">A — Excellent</option>
                            <option value="B">B+</option>
                            <option value="C">C+</option>
                            <option value="D">D+</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Avg Mins / Game</label>
                        <select class="panel-price-select" id="modalMppgSelect" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 8px 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px;">
                            <option value="">Any</option>
                            <option value="60">60+ mins</option>
                            <option value="45">45+ mins</option>
                            <option value="30">30+ mins</option>
                            <option value="15">15+ mins</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="modal-player-list-scroll" id="modalPlayerList" style="display: flex; flex-direction: column; gap: 8px; max-height: 55vh; overflow-y: auto; padding: 16px 20px;">
                ${renderModalPlayerRows(buyablePlayers, bank, state, gwWindow)}
            </div>
        </div>
    `;

    actions.showModal(modalHTML, () => {
        const closeBtn = document.getElementById('closeAddPlayerModalBtn');
        if (closeBtn) closeBtn.addEventListener('click', actions.hideModal);

        const restoreBannerBtn = document.querySelector('.restore-modal-action-btn');
        if (restoreBannerBtn) {
            restoreBannerBtn.addEventListener('click', () => {
                const slotIndex = parseInt(restoreBannerBtn.getAttribute('data-slot-index'));
                const playerId = parseInt(restoreBannerBtn.getAttribute('data-player-id'));
                actions.restorePlayer(slotIndex, playerId);
                actions.hideModal();
            });
        }

        const searchField = document.getElementById('modalSearchField');
        const gwWindowSelect = document.getElementById('modalGwWindowSelect');
        const teamSelect = document.getElementById('modalTeamSelect');
        const priceSelect = document.getElementById('modalPriceSelect');
        const setPieceSelect = document.getElementById('modalSetPieceSelect');
        const attSelect = document.getElementById('modalAttSelect');
        const defconSelect = document.getElementById('modalDefconSelect');
        const mppgSelect = document.getElementById('modalMppgSelect');
        const gsSelect = document.getElementById('modalGsSelect');
        const listContainer = document.getElementById('modalPlayerList');

        const applyFilters = () => {
            try {
                const query = searchField ? searchField.value.trim().toLowerCase() : "";
                gwWindow = gwWindowSelect ? parseInt(gwWindowSelect.value) || 5 : 5;
                const selectedTeam = teamSelect ? teamSelect.value : "";
                const maxPriceStr = priceSelect ? priceSelect.value : "";
                const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;
                const selectedSetPiece = setPieceSelect ? setPieceSelect.value : "";
                
                const minAttGrade = attSelect ? attSelect.value : "";
                const minDefconGrade = defconSelect ? defconSelect.value : "";
                
                const minMinsStr = mppgSelect ? mppgSelect.value : "";
                const minMins = minMinsStr ? parseFloat(minMinsStr) : 0;
                
                const minGsStr = gsSelect ? gsSelect.value : "";
                const minGs = minGsStr ? parseInt(minGsStr) : 0;
                
                const gradeScores = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'N/A': 0 };
     
                const filtered = buyablePlayers.filter(p => {
                    if (selectedTeam && p.team !== selectedTeam) return false;
                    if (p.price > maxPrice) return false;
                    if (minMins > 0 && (p.MPPG || 0) < minMins) return false;
                    if (minGs > 0 && (p.GS || 0) < minGs) return false;
                    
                    if (selectedSetPiece) {
                        const duty = getPlayerSetPieceDuty(p);
                        if (selectedSetPiece === 'pk' && !duty.pk) return false;
                        if (selectedSetPiece === 'fk' && !duty.fk) return false;
                        if (selectedSetPiece === 'ck' && !duty.ck) return false;
                        if (selectedSetPiece === 'any' && !duty.hasDuty) return false;
                    }
                    
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
     
                    // 1. Direct full name or official FPL web_name match
                    if (p.name.toLowerCase().includes(query) || (p.web_name && p.web_name.toLowerCase().includes(query))) return true;
     
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

                // Sort descending by selected GW window xP
                filtered.sort((a, b) => getNGwXp(b, state.currentGw, gwWindow) - getNGwXp(a, state.currentGw, gwWindow));
                
                console.log("[FPL HUB] Filters applied. Count:", filtered.length, "GW Window:", gwWindow, "Query:", query, "Team:", selectedTeam, "Price:", maxPrice, "Att:", minAttGrade, "Defcon:", minDefconGrade);
                
                const filterCountLabel = document.getElementById('modalFilterCount');
                if (filterCountLabel) {
                    filterCountLabel.textContent = `(${filtered.length} found)`;
                }

                if (listContainer) {
                    listContainer.innerHTML = renderModalPlayerRows(filtered, bank, state, gwWindow);
                }
                wireAddButtons();
            } catch (err) {
                console.error("Filter error:", err);
            }
        };
 
        if (searchField) searchField.addEventListener('input', applyFilters);
        if (gwWindowSelect) gwWindowSelect.addEventListener('change', applyFilters);
        if (teamSelect) teamSelect.addEventListener('change', applyFilters);
        if (priceSelect) priceSelect.addEventListener('change', applyFilters);
        if (setPieceSelect) setPieceSelect.addEventListener('change', applyFilters);
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

function renderModalPlayerRows(players, bank, state, gwWindow) {
    gwWindow = gwWindow || 5;
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
                    <span class="badge-best-defcon" style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(0, 242, 254, 0.15); color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.3); font-weight: 700; display: inline-flex; align-items: center; gap: 2px;" title="Elite real defensive output: tackles/interceptions/clearances(+recoveries) per 90 vs. the real FPL Defensive Contribution threshold (A/B Rating)">
                        🛡️ Best Defcon
                    </span>
                `;
            }
        }
        
        return `
            <div class="panel-player-row ${!isAffordable ? 'disabled-row' : ''}" data-id="${player.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: all var(--transition-fast);">
                <div class="player-info-left" style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <span class="player-name-main" style="font-weight: 600; color: var(--text-main); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;" title="${player.name}">${player.web_name || player.name}</span>
                        ${renderSetPieceBadges(player)}
                        ${badgesHtml}
                    </div>

                    ${renderFdrFixtures(player, state.currentGw)}
                    <span class="player-team-sub" style="font-size: 11px; color: var(--text-muted);">${player.team} • £${player.price.toFixed(1)}m • Owned: ${player.ownership.toFixed(1)}%</span>
                    <span class="player-team-sub" style="font-size: 10px; color: var(--text-muted); opacity: 0.85;">Matches last year: ${player.GS} • Avg Min: ${player.MPPG.toFixed(0)}m</span>
                </div>
                <div class="player-info-right" style="display: flex; align-items: center; gap: 12px; margin-left: 8px;">
                    <span class="player-pts-val" style="font-size: 12px; font-weight: 700; color: var(--primary); white-space: nowrap;">${getNGwXp(player, state.currentGw, gwWindow).toFixed(1)} XP (${gwWindow}-GW)</span>
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

// Official FPL Team Jersey Codes Map
export const TEAM_SHIRT_CODES = {
    'ARS': 3,   // Arsenal
    'AVL': 7,   // Aston Villa
    'BOU': 91,  // Bournemouth
    'BRE': 94,  // Brentford
    'BHA': 36,  // Brighton
    'CHE': 8,   // Chelsea
    'COV': 9,   // Coventry City
    'CRY': 31,  // Crystal Palace
    'EVE': 11,  // Everton
    'FUL': 54,  // Fulham
    'HUL': 88,  // Hull City
    'IPS': 40,  // Ipswich Town
    'LEE': 2,   // Leeds United
    'LIV': 14,  // Liverpool
    'MCI': 43,  // Manchester City
    'MUN': 1,   // Manchester United
    'NEW': 4,   // Newcastle United
    'NFO': 17,  // Nottingham Forest
    'TOT': 6,   // Tottenham Hotspur
    'SUN': 56   // Sunderland
};

// Official Premier League Kit Image Generator Engine
export function getShirtSVG(color, teamShortName = '', position = 'MID') {
    const isGKP = position === 'GKP';
    const code = TEAM_SHIRT_CODES[teamShortName] || (typeof TEAMS !== 'undefined' ? TEAMS.find(t => t.shortName === teamShortName)?.id : 3) || 3;
    
    const shirtUrl = isGKP 
        ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}_1-110.webp`
        : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-110.webp`;
    
    return `
        <img 
            src="${shirtUrl}" 
            alt="${teamShortName} ${position} jersey" 
            class="shirt-svg fpl-official-jersey" 
            loading="lazy"
            draggable="false"
            style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));" 
            onerror="this.onerror=null; this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-110.webp';"
        />
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
