import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG, renderPlayerRow, renderBenchRow } from './planner.js';

export function renderTransferPlanner(container, state, actions) {
    const squadInfo = state.getSquadForGw(state.currentGw);
    const bank = squadInfo.bank;
    
    // Determine context-aware default transfers based on available Free Transfers
    let defaultNumTransfers = squadInfo.freeTransfers;
    if (defaultNumTransfers === 0 || isNaN(defaultNumTransfers)) {
        defaultNumTransfers = 1;
    }

    // Read selections from state or localStorage
    const hasPrepopulated = !!state.tpPrepopulatedSource;
    let numTransfers = hasPrepopulated ? defaultNumTransfers : (parseInt(localStorage.getItem('fpl_hub_tp_num_transfers')) || defaultNumTransfers);
    let horizon = hasPrepopulated ? 5 : (parseInt(localStorage.getItem('fpl_hub_tp_horizon')) || 5);
    
    let activeSource = state.tpPrepopulatedSource || localStorage.getItem('fpl_hub_tp_source') || 'active';
    delete state.tpPrepopulatedSource; // Clear the flag!
    localStorage.setItem('fpl_hub_tp_source', activeSource);

    // Update local storage values to keep selections synced
    localStorage.setItem('fpl_hub_tp_num_transfers', numTransfers.toString());
    localStorage.setItem('fpl_hub_tp_horizon', horizon.toString());

    // Temporary variables for imported team (initialized from localStorage cache if available)
    let tempSourceSlots = null;
    let tempCaptain = null;
    let tempVice = null;
    let tempBank = 0;

    const lastImportedId = localStorage.getItem('fpl_hub_last_imported_team_id') || '';
    const cachedSlotsStr = localStorage.getItem('fpl_hub_last_imported_squad_slots');
    if (cachedSlotsStr) {
        try {
            tempSourceSlots = JSON.parse(cachedSlotsStr);
            tempCaptain = parseInt(localStorage.getItem('fpl_hub_last_imported_captain')) || null;
            tempVice = parseInt(localStorage.getItem('fpl_hub_last_imported_vice')) || null;
            tempBank = parseFloat(localStorage.getItem('fpl_hub_last_imported_bank')) || 0;
        } catch (e) {
            console.error("Error parsing cached FPL squad slots:", e);
        }
    }

    // Helper functions for rendering
    const getAvgFDR = (player) => {
        let sum = 0;
        let count = 0;
        for (let gw = state.currentGw; gw < state.currentGw + 5; gw++) {
            if (gw > 10) break;
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) {
                sum += pred.diff;
                count++;
            }
        }
        return count > 0 ? (sum / count).toFixed(1) : "3.0";
    };

    const getExpectedPts = (player, h) => {
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + h; gw++) {
            if (gw > 10) break;
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) sum += pred.pts;
        }
        return sum;
    };

    const getFdrColor = (diff) => {
        if (diff <= 2) return '#00ff88';
        if (diff === 3) return '#eab308';
        return '#ef4444';
    };

    const renderFdrFixtures = (player) => {
        let fixturesHtml = '';
        for (let gw = state.currentGw; gw < state.currentGw + 5; gw++) {
            if (gw > 10) break;
            const pred = player.predictions.find(p => p.gw === gw);
            if (pred) {
                const color = getFdrColor(pred.diff);
                fixturesHtml += `
                    <div style="background:${color}; color:#111; padding:2px 4px; border-radius:4px; font-size:9px; font-weight:800; min-width:24px; text-align:center;" title="GW${gw}: ${pred.opp} (${pred.loc}) - FDR ${pred.diff}">
                        ${pred.opp.substring(0, 3)}${pred.loc}
                    </div>
                `;
            }
        }
        return `<div style="display:flex; gap:3px; margin-top:4px; flex-wrap:wrap;">${fixturesHtml}</div>`;
    };

    const renderPlayerStats = (player) => {
        const starts = typeof player.GS === 'number' ? player.GS : 0;
        const avgMins = typeof player.MPPG === 'number' ? player.MPPG.toFixed(0) : '0';
        return `
            <div class="analysis-stats-grid" style="margin-top:8px; gap:4px;">
                <div class="stat-pill" style="min-width:45px; padding:2px 4px;">
                    <span class="stat-pill-label" style="font-size:8px;">Starts</span>
                    <span class="stat-pill-val" style="font-size:10px; font-weight:700;">${starts}</span>
                </div>
                <div class="stat-pill" style="min-width:45px; padding:2px 4px;">
                    <span class="stat-pill-label" style="font-size:8px;">Avg Min</span>
                    <span class="stat-pill-val" style="font-size:10px; font-weight:700;">${avgMins}m</span>
                </div>
                <div class="stat-pill" style="min-width:45px; padding:2px 4px;">
                    <span class="stat-pill-label" style="font-size:8px;">FDR</span>
                    <span class="stat-pill-val" style="font-size:10px; font-weight:700;">${getAvgFDR(player)}</span>
                </div>
            </div>
        `;
    };

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

    const showCompareModal = (tx) => {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'player-detail-modal-overlay compare-modal-overlay';
        modalDiv.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; padding:10px;';

        const p1 = tx.out;
        const p2 = tx.in;

        const formatVal = (val, dec = 1) => {
            if (val === null || val === undefined || isNaN(val)) return '0';
            return typeof val === 'number' ? val.toFixed(dec) : val;
        };

        modalDiv.innerHTML = `
            <style>
                .compare-modal-card {
                    width: 100%;
                    max-width: 600px;
                    background: var(--bg-dark);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                .compare-modal-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12.5px;
                    text-align: left;
                    table-layout: fixed;
                }
                .compare-modal-table th, .compare-modal-table td {
                    padding: 8px 6px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .compare-header-banner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .compare-banner-player {
                    flex: 1;
                    overflow: hidden;
                }
                
                @media (max-width: 768px) {
                    .compare-modal-overlay {
                        align-items: flex-start !important;
                        overflow-y: auto !important;
                        padding: 10px !important;
                    }
                    .compare-modal-card {
                        padding: 10px !important;
                        gap: 6px !important;
                        border-radius: 12px;
                        width: 95% !important;
                        max-width: 95% !important;
                        margin: 10px auto !important;
                        max-height: none !important;
                    }
                    .compare-modal-table {
                        font-size: 9.5px !important;
                    }
                    .compare-modal-table th, .compare-modal-table td {
                        padding: 4px 2px !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                    }
                    .compare-header-banner {
                        gap: 6px !important;
                        padding: 4px 0 !important;
                    }
                    .compare-banner-player h4 {
                        font-size: 11.5px !important;
                    }
                    .compare-banner-player span {
                        font-size: 9.5px !important;
                    }
                    .player-action-section {
                        padding-top: 10px !important;
                        gap: 6px !important;
                    }
                    .player-action-section button {
                        font-size: 11px !important;
                        height: 32px !important;
                        padding: 6px 12px !important;
                    }
                    .compare-player-lbl-suffix {
                        display: none !important;
                    }
                }
            </style>
            
            <div class="compare-modal-card">
                <!-- Header Title -->
                <div class="modal-header-section" style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-family: var(--font-heading); margin: 0; font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px; color: var(--text-main);">
                        <i data-lucide="git-compare" style="color: var(--primary);"></i> Player Stats Comparison
                    </h3>
                    <button class="close-modal-btn" id="closeCompareModalBtn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
                </div>

                <!-- Side-by-Side Player Names Banner -->
                <div class="compare-header-banner">
                    <div class="compare-banner-player">
                        <span style="font-size:10px; color:#ef4444; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Transfer Out</span>
                        <h4 style="margin:2px 0 0 0; font-size:14px; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p1.name}">${p1.name}</h4>
                        <span style="font-size:11px; color:var(--text-muted);">${p1.team} • ${p1.position}</span>
                    </div>
                    <div style="flex:0 0 auto; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="arrow-right-left" style="width:18px; height:18px; color:var(--primary);"></i>
                    </div>
                    <div class="compare-banner-player" style="text-align:right;">
                        <span style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Transfer In</span>
                        <h4 style="margin:2px 0 0 0; font-size:14px; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p2.name}">${p2.name}</h4>
                        <span style="font-size:11px; color:var(--text-muted);">${p2.team} • ${p2.position}</span>
                    </div>
                </div>

                <!-- Stats Grid Table -->
                <div style="width: 100%; overflow: hidden;">
                    <table class="compare-modal-table">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color);">
                                <th style="color: var(--text-muted); font-weight: 700; width: 34%;">Metric</th>
                                <th style="color: #ef4444; font-weight: 800; text-align: right; width: 33%;">OUT<span class="compare-player-lbl-suffix"> Player</span></th>
                                <th style="color: var(--primary); font-weight: 800; text-align: right; width: 33%;">IN<span class="compare-player-lbl-suffix"> Player</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Team</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p1.team || 'N/A'}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p2.team || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Price</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">£${formatVal(p1.price, 1)}m</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">£${formatVal(p2.price, 1)}m</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Ownership</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.ownership, 1)}%</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.ownership, 1)}%</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Total Points</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p1.points !== undefined ? p1.points : 0}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p2.points !== undefined ? p2.points : 0}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Starts</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p1.GS !== undefined ? p1.GS : 0}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${p2.GS !== undefined ? p2.GS : 0}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Avg Minutes</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.MPPG, 0)}m</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.MPPG, 0)}m</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Expected Goals (xG)</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.xG, 1)}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.xG, 1)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">Expected Assists (xA)</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.xA, 1)}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.xA, 1)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">xG per 90</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.xG90, 2)}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.xG90, 2)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">xA per 90</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.xA90, 2)}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.xA90, 2)}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600; color: var(--text-muted);">ICT Index</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p1.ictIndex, 1)}</td>
                                <td style="text-align: right; color: var(--text-main); font-weight: 700;">${formatVal(p2.ictIndex, 1)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Action Footer -->
                <div class="player-action-section" style="padding: 0; display: flex; justify-content: flex-end; gap: 10px; width: 100%; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <button class="action-main-btn btn-secondary-action" id="cancelCompareModalBtn" style="margin: 0; width: auto; padding: 10px 20px; font-size: 12px; height: 38px;">Close</button>
                    <button class="action-main-btn" id="applyCompareModalBtn" style="margin: 0; width: auto; padding: 10px 20px; font-size: 12px; height: 38px;">Apply Transfer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
        lucide.createIcons();

        const closeModal = () => {
            document.body.removeChild(modalDiv);
        };

        modalDiv.querySelector('#closeCompareModalBtn').addEventListener('click', closeModal);
        modalDiv.querySelector('#cancelCompareModalBtn').addEventListener('click', closeModal);

        modalDiv.querySelector('#applyCompareModalBtn').addEventListener('click', () => {
            closeModal();
            const ok = actions.addTransfer(state.currentGw, p1.id, p2.id, false);
            if (ok) {
                // Keep screen active and update preview
                updateSquadPreview();

                // Mark as applied in results list
                const stepIdx = tx.step - 1;
                const stepCard = container.querySelector(`[data-step-card-idx="${stepIdx}"]`);
                if (stepCard) {
                    stepCard.querySelectorAll('.apply-option-btn').forEach(btn => {
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'default';
                    });
                    
                    const appliedBtn = stepCard.querySelector(`.apply-option-btn[data-opt-id="${p2.id}"]`);
                    if (appliedBtn) {
                        appliedBtn.disabled = true;
                        appliedBtn.style.opacity = '1';
                        appliedBtn.style.background = 'var(--primary)';
                        appliedBtn.style.color = '#000';
                        appliedBtn.style.borderColor = 'var(--primary)';
                        appliedBtn.innerHTML = `<i data-lucide="check-circle" style="width:12px; height:12px;"></i> Applied`;
                    }

                    const header = stepCard.querySelector('h4');
                    if (header && !header.querySelector('.applied-badge-label')) {
                        const badge = document.createElement('span');
                        badge.className = 'applied-badge-label';
                        badge.style.cssText = 'font-size:11px; background:rgba(0, 255, 136, 0.15); padding:2px 8px; border-radius:4px; color:var(--primary); text-transform:none; margin-left:12px; font-weight:700;';
                        badge.innerHTML = `Applied: ${p2.name}`;
                        header.appendChild(badge);
                    }
                    lucide.createIcons();
                }
            }
        });
    };

    container.innerHTML = `
        <div class="tp-outer-container" style="display:flex; flex-direction:column; gap:16px; width:100%;">
            <div class="optimizer-intro" style="margin-bottom: 4px; flex-shrink: 0;">
                <div class="intro-text-area">
                    <h2 style="font-size: 20px; font-weight: 800; margin: 0;">AI Multi-Transfer Roadmap Planner</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Map out multi-gameweek transfer sequences. Simulate step-by-step roster changes from 1 to 5 transfers.</p>
                </div>
            </div>

            <div class="tp-main-grid" style="display: flex; flex-direction: column; gap: 20px; width: 100%;">
                <!-- Left Column: Configurations & Results -->
                <div class="tp-left-col" style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                    <!-- Configuration Card -->
                    <div class="optimizer-settings-card" style="padding:16px; margin:0; flex-shrink: 0;">
                        <h3 style="font-family: var(--font-heading); margin-bottom:16px; font-weight:700; display:flex; align-items:center; gap:8px; font-size: 14px;">
                            <i data-lucide="settings" class="highlight-transfers"></i> Setup Roadmap Configurations
                        </h3>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items: flex-end;">
                            <!-- Source Selection -->
                            <div style="display:flex; flex-direction:column; gap:6px; grid-column: span 2;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Source Squad / Team Selection</label>
                                <div style="display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
                                    <select id="tpSourceSquad" class="settings-select" style="flex:1; min-width:180px;">
                                        <option value="active" ${activeSource === 'active' ? 'selected' : ''}>Active Squad Roster</option>
                                        <option value="import" ${activeSource === 'import' ? 'selected' : ''}>Import from FPL Team ID...</option>
                                        ${state.drafts.map((d, idx) => `
                                            <option value="draft_${idx}" ${activeSource === `draft_${idx}` ? 'selected' : ''}>Draft ${idx + 1}: ${d.name}</option>
                                        `).join('')}
                                    </select>
                                    <input type="text" id="tpFplTeamId" class="settings-select" placeholder="FPL Team ID" style="display:none; width:110px; font-size:12px; padding:8px;" value="${lastImportedId}" />
                                    <button class="action-main-btn" id="tpImportBtn" style="display:none; margin:0; padding:8px 16px; font-size:12px; height:38px;">Import</button>
                                </div>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Number of Transfers (1-5)</label>
                                <select id="tpNumTransfers" class="settings-select" style="width:100%;">
                                    <option value="1" ${numTransfers === 1 ? 'selected' : ''}>1 Transfer</option>
                                    <option value="2" ${numTransfers === 2 ? 'selected' : ''}>2 Transfers</option>
                                    <option value="3" ${numTransfers === 3 ? 'selected' : ''}>3 Transfers</option>
                                    <option value="4" ${numTransfers === 4 ? 'selected' : ''}>4 Transfers</option>
                                    <option value="5" ${numTransfers === 5 ? 'selected' : ''}>5 Transfers</option>
                                </select>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Projection Horizon Weeks</label>
                                <select id="tpHorizon" class="settings-select" style="width:100%;">
                                    <option value="1" ${horizon === 1 ? 'selected' : ''}>Next 1 Gameweek</option>
                                    <option value="2" ${horizon === 2 ? 'selected' : ''}>Next 2 Gameweeks</option>
                                    <option value="3" ${horizon === 3 ? 'selected' : ''}>Next 3 Gameweeks</option>
                                    <option value="4" ${horizon === 4 ? 'selected' : ''}>Next 4 Gameweeks</option>
                                    <option value="5" ${horizon === 5 ? 'selected' : ''}>Next 5 Gameweeks</option>
                                    <option value="10" ${horizon === 10 ? 'selected' : ''}>Next 10 Gameweeks</option>
                                    <option value="15" ${horizon === 15 ? 'selected' : ''}>Next 15 Gameweeks</option>
                                    <option value="20" ${horizon === 20 ? 'selected' : ''}>Next 20 Gameweeks</option>
                                    <option value="25" ${horizon === 25 ? 'selected' : ''}>Next 25 Gameweeks</option>
                                </select>
                            </div>
                            <button class="action-main-btn" id="runTpBtn" style="margin:0; height:38px; display:flex; align-items:center; justify-content:center; gap:8px;">
                                <i data-lucide="play" style="width:16px; height:16px;"></i> Calculate Roadmap
                            </button>
                        </div>
                    </div>

                    <!-- Optimization Results Grid -->
                    <div id="tpResultsGrid" style="display:flex; flex-direction:column;"></div>
                </div>

                <!-- Right Column: Squad Preview -->
                <div class="tp-right-col" style="width:100%;">
                    <div id="tpSquadPreviewContainer" style="width: 100%; height: auto;"></div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Setup DOM Listeners
    const runTpBtn = container.querySelector('#runTpBtn');
    const tpNumTransfers = container.querySelector('#tpNumTransfers');
    const tpHorizon = container.querySelector('#tpHorizon');
    const tpResultsGrid = container.querySelector('#tpResultsGrid');
    const tpSourceSquad = container.querySelector('#tpSourceSquad');
    const tpFplTeamId = container.querySelector('#tpFplTeamId');
    const tpImportBtn = container.querySelector('#tpImportBtn');
    const tpSquadPreviewContainer = container.querySelector('#tpSquadPreviewContainer');

    const updateSquadPreview = () => {
        const sourceVal = tpSourceSquad.value;
        let previewSlots = null;
        let previewCap = state.captain;
        let previewVice = state.vice;
        let previewBank = bank;

        if (sourceVal === 'active') {
            previewSlots = state.squadSlots;
        } else if (sourceVal.startsWith('draft_')) {
            const draftIdx = parseInt(sourceVal.split('_')[1]);
            const d = state.drafts[draftIdx];
            if (!d.squadSlots) {
                d.squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
                d.captain = state.captain;
                d.vice = state.vice;
                d.formation = state.formation;
            }
            previewSlots = d.squadSlots;
            previewCap = d.captain || state.captain;
            previewVice = d.vice || state.vice;
            const spent = d.squadSlots.reduce((sum, slot) => {
                if (slot.playerId === null) return sum;
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                return sum + (p ? p.price : 0);
            }, 0);
            previewBank = Math.max(0, 100 - spent);
        } else if (sourceVal === 'import') {
            if (tempSourceSlots) {
                previewSlots = tempSourceSlots;
                previewCap = tempCaptain || state.captain;
                previewVice = tempVice || state.vice;
                previewBank = tempBank;
            } else {
                tpSquadPreviewContainer.innerHTML = `
                    <div style="background:var(--bg-card); border:1px dashed var(--border-color); border-radius:12px; padding:24px; text-align:center; color:var(--text-muted); font-size:12px;">
                        Enter FPL Team ID and click "Import" to preview squad picks.
                    </div>
                `;
                return;
            }
        }

        if (previewSlots) {
            tpSquadPreviewContainer.innerHTML = `
                <style>
                    #tpSquadPreviewContainer .pitch-sell-btn {
                        display: none !important;
                    }
                    #tpSquadPreviewContainer .player-pitch-card {
                        cursor: default !important;
                    }
                </style>
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px; box-shadow: var(--shadow-sm);">
                    <h3 style="font-family:var(--font-heading); margin:0; font-size:14px; font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span>Squad Preview</span>
                        <span style="font-size:12px; color:var(--primary); font-weight:700;">Bank Capital: £${previewBank.toFixed(1)}m</span>
                    </h3>

                    <!-- Regular Full Size Football Pitch -->
                    <div class="football-pitch" id="pitchBoard">
                        <div class="pitch-box-top"></div>
                        <div class="pitch-half-line"></div>
                        <div class="pitch-center-circle"></div>
                        <div class="pitch-box-bottom"></div>

                        <!-- GKP Row -->
                        <div class="pitch-row" data-row="GKP">
                            ${renderPlayerRow(previewSlots, "GKP", state.currentGw, previewCap, previewVice, actions)}
                        </div>

                        <!-- DEF Row -->
                        <div class="pitch-row" data-row="DEF">
                            ${renderPlayerRow(previewSlots, "DEF", state.currentGw, previewCap, previewVice, actions)}
                        </div>

                        <!-- MID Row -->
                        <div class="pitch-row" data-row="MID">
                            ${renderPlayerRow(previewSlots, "MID", state.currentGw, previewCap, previewVice, actions)}
                        </div>

                        <!-- FWD Row -->
                        <div class="pitch-row" data-row="FWD">
                            ${renderPlayerRow(previewSlots, "FWD", state.currentGw, previewCap, previewVice, actions)}
                        </div>
                    </div>

                    <!-- Bench Section -->
                    <div class="bench-container" style="margin-top: 16px;">
                        <span class="bench-title">Bench Preview</span>
                        <div class="bench-row" id="benchRow">
                            ${renderBenchRow(previewSlots, state.currentGw, previewCap, previewVice, actions)}
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    };

    const toggleImportFields = () => {
        if (tpSourceSquad.value === 'import') {
            tpFplTeamId.style.display = 'inline-block';
            tpImportBtn.style.display = 'inline-block';
        } else {
            tpFplTeamId.style.display = 'none';
            tpImportBtn.style.display = 'none';
        }
    };

    // Toggle fields on load (Active is default, so hidden initially)
    toggleImportFields();

    tpSourceSquad.addEventListener('change', () => {
        localStorage.setItem('fpl_hub_tp_source', tpSourceSquad.value);
        toggleImportFields();
        updateSquadPreview();
    });

    tpImportBtn.addEventListener('click', async () => {
        const teamId = tpFplTeamId.value.trim();
        if (!teamId) {
            actions.showToast("Please enter a valid FPL Team ID.", "error");
            return;
        }

        tpImportBtn.innerText = "Loading...";
        tpImportBtn.disabled = true;

        try {
            const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${state.currentGw}/picks/`);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response error");
            const data = await response.json();
            if (data && data.picks) {
                const importedSlots = mapFplPicksToSquadSlots(data.picks);
                const bankVal = (data.entry_history ? data.entry_history.bank : 0) / 10;
                
                tempSourceSlots = importedSlots;
                tempCaptain = data.picks.find(p => p.is_captain)?.element || null;
                tempVice = data.picks.find(p => p.is_vice_captain)?.element || null;
                tempBank = bankVal;

                // Save to localStorage cache
                localStorage.setItem('fpl_hub_last_imported_team_id', teamId);
                localStorage.setItem('fpl_hub_last_imported_squad_slots', JSON.stringify(tempSourceSlots));
                localStorage.setItem('fpl_hub_last_imported_captain', (tempCaptain || '').toString());
                localStorage.setItem('fpl_hub_last_imported_vice', (tempVice || '').toString());
                localStorage.setItem('fpl_hub_last_imported_bank', tempBank.toString());

                actions.showToast(`Imported Team ID ${teamId} successfully!`, "success");
                updateSquadPreview();
            } else {
                throw new Error("Invalid picks data");
            }
        } catch (err) {
            console.error(err);
            actions.showToast("Failed to fetch FPL picks. Verify ID is active.", "error");
        } finally {
            tpImportBtn.innerText = "Import";
            tpImportBtn.disabled = false;
        }
    });

    runTpBtn.addEventListener('click', () => {
        numTransfers = parseInt(tpNumTransfers.value);
        horizon = parseInt(tpHorizon.value);

        localStorage.setItem('fpl_hub_tp_num_transfers', numTransfers.toString());
        localStorage.setItem('fpl_hub_tp_horizon', horizon.toString());

        runTransferPlannerOptimization(tpResultsGrid, state, actions, numTransfers, horizon);
    });

    // Initialize default squad preview list on page load
    updateSquadPreview();

    // Helper rendering function inside
    function runTransferPlannerOptimization(resultsContainer, state, actions, numTransfers, horizon) {
        resultsContainer.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; padding:40px; flex-direction:column; gap:12px;">
                <div class="loader" style="border: 4px solid var(--border-color); border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                <p style="font-size:12px; color:var(--text-muted); font-weight:600;">AI solver calculating optimum transfer roadmap...</p>
            </div>
        `;

        setTimeout(() => {
            let sourceSlots = null;
            let activeCap = state.captain;
            let activeVice = state.vice;
            let activeBank = bank;

            const sourceVal = tpSourceSquad.value;
            if (sourceVal === 'active') {
                sourceSlots = state.squadSlots;
            } else if (sourceVal.startsWith('draft_')) {
                const draftIdx = parseInt(sourceVal.split('_')[1]);
                const d = state.drafts[draftIdx];
                if (!d.squadSlots) {
                    d.squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
                    d.captain = state.captain;
                    d.vice = state.vice;
                    d.formation = state.formation;
                }
                sourceSlots = d.squadSlots;
                activeCap = d.captain || state.captain;
                activeVice = d.vice || state.vice;
                
                const spent = d.squadSlots.reduce((sum, slot) => {
                    if (slot.playerId === null) return sum;
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    return sum + (p ? p.price : 0);
                }, 0);
                activeBank = Math.max(0, 100 - spent);
            } else if (sourceVal === 'import') {
                if (!tempSourceSlots) {
                    resultsContainer.innerHTML = `
                        <div class="transfer-list-empty" style="padding:40px; text-align:center; color:#ef4444; border:1px dashed rgba(239, 68, 68, 0.2); border-radius:12px; background:rgba(239, 68, 68, 0.02);">
                            Please enter a valid FPL Team ID and click "Import" before running the optimization.
                        </div>
                    `;
                    actions.showToast("Source squad not imported yet!", "error");
                    return;
                }
                sourceSlots = tempSourceSlots;
                activeCap = tempCaptain || state.captain;
                activeVice = tempVice || state.vice;
                activeBank = tempBank;
            }

            const result = solveOptimalTransferSequence(sourceSlots, activeCap, activeVice, activeBank, numTransfers, horizon);
            if (result.sequence.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="transfer-list-empty" style="padding:40px; text-align:center; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:12px;">
                        No beneficial transfers found for the selected squad. Roster is fully optimized for this horizon window!
                    </div>
                `;
                return;
            }

            let cardsHtml = result.sequence.map((tx, idx) => {
                const teamOut = TEAMS.find(t => t.shortName === tx.out.team) || { color: '#fff' };
                
                let optionsHtml = '';
                if (tx.options && tx.options.length > 0) {
                    optionsHtml = tx.options.map((opt, optIdx) => {
                        const pOpt = opt.player;
                        const gainText = opt.gain >= 0 ? `+${opt.gain.toFixed(1)}` : opt.gain.toFixed(1);
                        
                        return `
                            <div class="buy-option-row" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                                    <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                        <span style="font-size:10px; font-weight:800; background:var(--primary); color:#000; padding:1px 5px; border-radius:4px; flex-shrink:0;">#${optIdx + 1}</span>
                                        <span style="font-weight:700; color:var(--text-main); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pOpt.name}</span>
                                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">${pOpt.team} • £${pOpt.price.toFixed(1)}m</span>
                                    </div>
                                    <span style="font-size:11px; font-weight:800; color:${opt.gain >= 0 ? 'var(--primary)' : '#f43f5e'}; flex-shrink:0;">${gainText} XP</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <div style="display:flex; flex-direction:column; gap:2px; min-width: 0; flex: 1;">
                                        <span style="font-size:9.5px; color:var(--text-muted);">Avg Mins: <strong>${pOpt.MPPG ? pOpt.MPPG.toFixed(0) : 0}m</strong> • Starts: <strong>${pOpt.GS || 0}</strong></span>
                                        ${renderFdrFixtures(pOpt)}
                                    </div>
                                    <div style="display:flex; gap:6px;">
                                        <button class="action-main-btn compare-option-btn" data-step-idx="${idx}" data-opt-idx="${optIdx}" style="margin:0; padding:4px 8px; font-size:10px; height:28px; background:rgba(255,255,255,0.02); border-color:var(--border-color); color:var(--text-main); border-radius:4px; cursor:pointer; width:auto; display:flex; align-items:center; gap:4px;">
                                            <i data-lucide="git-compare" style="width:10px; height:10px;"></i> Compare
                                        </button>
                                        <button class="action-main-btn apply-option-btn" data-step-idx="${idx}" data-opt-idx="${optIdx}" data-opt-id="${pOpt.id}" style="margin:0; padding:4px 8px; font-size:10px; height:28px; border-radius:4px; cursor:pointer; width:auto; display:flex; align-items:center; gap:4px;">
                                            <i data-lucide="check" style="width:10px; height:10px;"></i> Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    optionsHtml = `<p style="font-size:11px; color:#f43f5e; margin:0;">No eligible buy options found.</p>`;
                }

                return `
                    <div class="optimizer-card" data-step-card-idx="${idx}" style="margin-bottom: 16px; border-left: 4px solid var(--primary); padding:16px;">
                        <h4 style="font-size: 13px; font-weight:800; color:var(--primary); margin:0 0 16px 0; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; justify-content:space-between;">
                            <span>Step ${idx + 1}: Suggestion</span>
                        </h4>
                        
                        <div class="tp-step-layout" style="display: grid; grid-template-columns: 1fr 40px 1.4fr; gap: 12px; align-items: start;">
                            <!-- Sell Player -->
                            <div class="transfer-player-card player-card-out" style="margin:0; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <span class="player-name-main" style="font-size:14px; font-weight:700;">${tx.out.name}</span>
                                    <span class="player-team-sub">${tx.out.team} • £${tx.out.price.toFixed(1)}m</span>
                                    ${renderPlayerStats(tx.out)}
                                </div>
                                <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
                                    <span style="font-size: 9.5px; color: var(--text-muted); display: block; margin-bottom: 4px;">Fixture FDR:</span>
                                    ${renderFdrFixtures(tx.out)}
                                </div>
                            </div>
                            
                            <!-- Arrow icon centered -->
                            <div style="display:flex; align-items:center; justify-content:center; height:100%; min-height:100px;">
                                <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="margin:0; font-size: 20px; color: var(--text-muted);"></i>
                            </div>

                            <!-- Buy Options (Top 3) -->
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                ${optionsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            resultsContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="background:rgba(0, 255, 136, 0.03); border:1px solid var(--primary-glow); border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h4 style="margin:0; font-size:14px; font-weight:800; color:var(--text-main);">Optimized Roadmap Generated</h4>
                            <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-muted);">Planned sequence of ${result.sequence.length} transfers over next ${horizon} gameweeks.</p>
                        </div>
                        <div style="display:flex; align-items:center; gap:16px;">
                            <div style="text-align:right;">
                                <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Roadmap XP Gain</span>
                                <h3 style="margin:2px 0 0 0; font-size:20px; font-weight:900; color:var(--primary);">+${result.totalGain.toFixed(1)} XP</h3>
                            </div>
                            <button class="action-main-btn" id="applyAllTpBtn" style="margin:0; height:38px;">Apply Roadmap</button>
                        </div>
                    </div>
                    
                    <div>
                        ${cardsHtml}
                    </div>
                </div>
            `;

            lucide.createIcons();

            // Wire Apply All button
            const applyAllTpBtn = resultsContainer.querySelector('#applyAllTpBtn');
            if (applyAllTpBtn) {
                applyAllTpBtn.addEventListener('click', () => {
                    // Update state.squadSlots directly
                    state.squadSlots = result.finalSquadSlots;
                    state.optimizeCaptaincy();
                    state.saveState();
                    actions.syncTopBar();
                    actions.showToast(`Applied planned transfer roadmap!`, "success");
                    actions.switchTab('planner');
                });
            }

            // Wire compare option buttons
            resultsContainer.querySelectorAll('.compare-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const stepIdx = parseInt(btn.getAttribute('data-step-idx'));
                    const optIdx = parseInt(btn.getAttribute('data-opt-idx'));
                    const tx = result.sequence[stepIdx];
                    if (tx && tx.options && tx.options[optIdx]) {
                        const opt = tx.options[optIdx];
                        showCompareModal({
                            step: tx.step,
                            slotIdx: tx.slotIdx,
                            out: tx.out,
                            in: opt.player,
                            gain: opt.gain
                        });
                    }
                });
            });

            // Wire apply option buttons
            resultsContainer.querySelectorAll('.apply-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const stepIdx = parseInt(btn.getAttribute('data-step-idx'));
                    const optIdx = parseInt(btn.getAttribute('data-opt-idx'));
                    const tx = result.sequence[stepIdx];
                    if (tx && tx.options && tx.options[optIdx]) {
                        const opt = tx.options[optIdx];
                        const pIn = opt.player;
                        
                        const ok = actions.addTransfer(state.currentGw, tx.out.id, pIn.id, false);
                        if (ok) {
                            // Keep user on same screen and update preview
                            updateSquadPreview();

                            // Disable all option buttons in this step card
                            const stepCard = resultsContainer.querySelector(`[data-step-card-idx="${stepIdx}"]`);
                            if (stepCard) {
                                stepCard.querySelectorAll('.apply-option-btn').forEach(b => {
                                    b.disabled = true;
                                    b.style.opacity = '0.5';
                                    b.style.cursor = 'default';
                                });
                                
                                // Highlight the applied one
                                btn.disabled = true;
                                btn.style.opacity = '1';
                                btn.style.background = 'var(--primary)';
                                btn.style.color = '#000';
                                btn.style.borderColor = 'var(--primary)';
                                btn.innerHTML = `<i data-lucide="check-circle" style="width:12px; height:12px;"></i> Applied`;

                                // Add indicator badge in header
                                const header = stepCard.querySelector('h4');
                                if (header && !header.querySelector('.applied-badge-label')) {
                                    const badge = document.createElement('span');
                                    badge.className = 'applied-badge-label';
                                    badge.style.cssText = 'font-size:11px; background:rgba(0, 255, 136, 0.15); padding:2px 8px; border-radius:4px; color:var(--primary); text-transform:none; margin-left:12px; font-weight:700;';
                                    badge.innerHTML = `Applied: ${pIn.name}`;
                                    header.appendChild(badge);
                                }
                                lucide.createIcons();
                            }
                        }
                    }
                });
            });

        }, 400);
    }

    function solveOptimalTransferSequence(sourceSlots, activeCap, activeVice, activeBank, numTransfers, horizon) {
        let currentSquadSlots = JSON.parse(JSON.stringify(sourceSlots));
        let bank = activeBank;
        let sequence = [];
        let totalGain = 0;

        const checkTeamConstraints = (slots, soldId, boughtId) => {
            const tempIds = slots.map(s => s.playerId).filter(id => id !== null && id !== soldId);
            tempIds.push(boughtId);
            const counts = {};
            for (const id of tempIds) {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) {
                    counts[p.team] = (counts[p.team] || 0) + 1;
                    if (counts[p.team] > 3) return false;
                }
            }
            return true;
        };

        const getSquadExpectedPts = (slots) => {
            let expectedPoints = 0;
            const starters = slots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
            
            starters.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    let multiplier = 1;
                    if (id === activeCap) {
                        multiplier = state.chips.tripleCaptain ? 3 : 2;
                    }
                    expectedPoints += getExpectedPts(player, horizon) * multiplier;
                }
            });

            const bench = slots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);
            bench.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    expectedPoints += getExpectedPts(player, horizon) * 0.10;
                }
            });

            return expectedPoints;
        };

        for (let step = 1; step <= numTransfers; step++) {
            let bestTx = null;
            let maxGain = -999;
            const currentSquadIds = currentSquadSlots.map(s => s.playerId).filter(id => id !== null);

            for (const soldId of currentSquadIds) {
                const soldPlayer = PLAYERS.find(p => p.id === soldId);
                if (!soldPlayer) continue;

                const sellBudget = soldPlayer.price + bank;

                const candidates = PLAYERS.filter(p => 
                    p.position === soldPlayer.position && 
                    !currentSquadIds.includes(p.id) &&
                    p.price <= sellBudget &&
                    !state.mustExclude.includes(p.id)
                );

                for (const boughtPlayer of candidates) {
                    if (!checkTeamConstraints(currentSquadSlots, soldId, boughtPlayer.id)) continue;

                    const tempSlots = JSON.parse(JSON.stringify(currentSquadSlots));
                    const targetSlot = tempSlots.find(s => s.playerId === soldId);
                    if (targetSlot) targetSlot.playerId = boughtPlayer.id;

                    const gain = getSquadExpectedPts(tempSlots) - getSquadExpectedPts(currentSquadSlots);

                    if (gain > maxGain && gain > 0.01) {
                        maxGain = gain;
                        bestTx = {
                            step: step,
                            out: soldPlayer,
                            in: boughtPlayer,
                            gain: gain,
                            slotIdx: currentSquadSlots.indexOf(currentSquadSlots.find(s => s.playerId === soldId))
                        };
                    }
                }
            }

            if (bestTx) {
                // Find all valid candidates specifically for this sold player
                const soldPlayer = bestTx.out;
                const sellBudget = soldPlayer.price + bank;
                const candidates = PLAYERS.filter(p => 
                    p.position === soldPlayer.position && 
                    !currentSquadIds.includes(p.id) &&
                    p.price <= sellBudget &&
                    !state.mustExclude.includes(p.id)
                );

                const optionsList = [];
                for (const boughtPlayer of candidates) {
                    if (!checkTeamConstraints(currentSquadSlots, soldPlayer.id, boughtPlayer.id)) continue;

                    const tempSlots = JSON.parse(JSON.stringify(currentSquadSlots));
                    const targetSlot = tempSlots.find(s => s.playerId === soldPlayer.id);
                    if (targetSlot) targetSlot.playerId = boughtPlayer.id;

                    const gain = getSquadExpectedPts(tempSlots) - getSquadExpectedPts(currentSquadSlots);
                    optionsList.push({
                        player: boughtPlayer,
                        gain: gain
                    });
                }

                // Sort options by gain descending
                optionsList.sort((a, b) => b.gain - a.gain);

                // Take top 3
                bestTx.options = optionsList.slice(0, 3);
                if (bestTx.options.length > 0) {
                    bestTx.in = bestTx.options[0].player;
                    bestTx.gain = bestTx.options[0].gain;
                }

                sequence.push(bestTx);
                totalGain += bestTx.gain;
                currentSquadSlots[bestTx.slotIdx].playerId = bestTx.in.id;
                bank = bank + bestTx.out.price - bestTx.in.price;
            } else {
                break;
            }
        }

        return { sequence, totalGain, finalSquadSlots: currentSquadSlots };
    }
}
