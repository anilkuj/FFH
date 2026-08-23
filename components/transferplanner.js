import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG, renderPlayerRow, renderBenchRow } from './planner.js';
import { renderSetPieceBadges } from './optimizer.js';


export function renderTransferPlanner(container, state, actions) {
    const squadInfo = state.getSquadForGw(state.currentGw);
    const bank = squadInfo.bank;
    
    // Determine context-aware default transfers based on available Free Transfers or active chips
    let defaultNumTransfers = squadInfo.freeTransfers;
    if (state.currentGw === 1 || state.chips[state.currentGw]?.wildcard) {
        defaultNumTransfers = 15; // Preseason or Wildcard unlimited
    } else if (defaultNumTransfers === 0 || isNaN(defaultNumTransfers)) {
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
            if (gw > 38) break;
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) {
                sum += pred.diff;
                count++;
            }
        }
        return count > 0 ? (sum / count).toFixed(1) : "3.0";
    };

    const getExpectedPts = (player, h) => {
        if (!player || !player.predictions) return 0;
        const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + h; gw++) {
            if (gw > 38) break;
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) {
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                sum += (raw * factor);
            }
        }
        return sum;
    };


    const getFdrColor = (diff) => {
        if (diff <= 2) return '#00ff88';
        if (diff === 3) return '#eab308';
        return '#ef4444';
    };

    const formatFdrOpponentText = (pr) => {
        if (!pr || !pr.opp || pr.opp === 'BYE') return 'BYE';
        const rawOpp = pr.opp.replace(/\s*\([haHA]\)$/, '').trim().toUpperCase();
        const loc = pr.loc ? pr.loc.toUpperCase() : (pr.opp.toLowerCase().includes('(a)') ? 'A' : 'H');
        return `${rawOpp} (${loc})`;
    };

    const renderFdrFixtures = (player) => {
        if (!player || !player.predictions) return '';
        const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;

        let fixturesHtml = '';
        for (let gw = state.currentGw; gw < state.currentGw + 5; gw++) {
            if (gw > 38) break;
            const pred = player.predictions.find(p => p.gw === gw);
            if (pred) {
                const color = getFdrColor(pred.diff);
                const oppText = formatFdrOpponentText(pred);
                const ptsVal = pred.actualPts !== undefined && pred.actualPts !== null 
                    ? pred.actualPts 
                    : ((pred._rawPts !== undefined ? pred._rawPts : pred.pts) * factor);
                const ptsText = pred.actualPts !== undefined && pred.actualPts !== null
                    ? `${Math.round(ptsVal)} pts`
                    : `${ptsVal.toFixed(1)} XP`;

                const isDarkBg = pred.diff === 4 || pred.diff === 5 || pred.diff === 1;
                const textColor = isDarkBg ? '#ffffff' : '#0f172a';

                fixturesHtml += `
                    <div style="background:${color}; color:${textColor}; padding:4px 7px; border-radius:5px; min-width:52px; text-align:center; box-shadow: 0 1px 3px rgba(0,0,0,0.25); display:inline-flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.15;" title="GW${gw}: ${oppText} - FDR ${pred.diff} (${ptsText})">
                        <span style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:${textColor}; letter-spacing:0.2px;">${oppText}</span>
                        <span style="font-size:9px; font-weight:800; margin-top:2px; color:${textColor}; opacity:0.95;">${ptsText}</span>
                    </div>
                `;
            }
        }
        return `<div style="display:flex; gap:5px; margin-top:4px; flex-wrap:wrap; align-items:center;">${fixturesHtml}</div>`;
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
                                    <button class="action-secondary-btn" id="checkSquadRisksBtn" style="margin:0; padding:8px 16px; font-size:12px; height:38px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #f59e0b; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                        <i data-lucide="shield-alert" style="width: 14px; height: 14px;"></i> Check Squad Risks
                                    </button>
                                </div>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Number of Transfers</label>
                                <select id="tpNumTransfers" class="settings-select" style="width:100%;">
                                    ${state.currentGw === 1 ? `
                                        <option value="15" ${numTransfers === 15 ? 'selected' : ''}>Unlimited (Preseason)</option>
                                    ` : ''}
                                    <option value="1" ${numTransfers === 1 ? 'selected' : ''}>1 Transfer</option>
                                    <option value="2" ${numTransfers === 2 ? 'selected' : ''}>2 Transfers</option>
                                    <option value="3" ${numTransfers === 3 ? 'selected' : ''}>3 Transfers</option>
                                    <option value="4" ${numTransfers === 4 ? 'selected' : ''}>4 Transfers</option>
                                    <option value="5" ${numTransfers === 5 ? 'selected' : ''}>5 Transfers</option>
                                </select>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Active Chip</label>
                                <select id="tpActiveChip" class="settings-select" style="width:100%;">
                                    <option value="none" ${!state.chips[state.currentGw]?.wildcard && !state.chips[state.currentGw]?.benchBoost && !state.chips[state.currentGw]?.tripleCaptain ? 'selected' : ''}>None</option>
                                    <option value="wildcard" ${state.chips[state.currentGw]?.wildcard ? 'selected' : ''}>Wildcard</option>
                                    <option value="benchBoost" ${state.chips[state.currentGw]?.benchBoost ? 'selected' : ''}>Bench Boost</option>
                                    <option value="tripleCaptain" ${state.chips[state.currentGw]?.tripleCaptain ? 'selected' : ''}>Triple Captain</option>
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
            // Build the squad entering the currentGw by applying all prior-GW transfers
            // to a clone of the base squadSlots (which is the GW1 / base squad state).
            let slotsAtGw = JSON.parse(JSON.stringify(state.squadSlots));
            for (let gw = 1; gw < state.currentGw; gw++) {
                const priorTx = (state.transfers && state.transfers[gw]) || [];
                priorTx.forEach(tx => {
                    const slot = slotsAtGw.find(s => s.playerId === tx.out);
                    if (slot) slot.playerId = tx.in;
                });
            }

            // Now apply the currentGw transfers on top to get the post-transfer preview
            const gwTxForSlots = (state.transfers && state.transfers[state.currentGw]) || [];
            if (gwTxForSlots.length > 0) {
                previewSlots = JSON.parse(JSON.stringify(slotsAtGw));
                gwTxForSlots.forEach(tx => {
                    const slot = previewSlots.find(s => s.playerId === tx.out);
                    if (slot) slot.playerId = tx.in;
                });
                // Recalculate bank: start from pre-transfer bank then adjust for this GW's transfers
                const preGwInfo = state.getSquadForGw(state.currentGw - 1 < 1 ? 1 : state.currentGw - 1);
                let adjBank = state.currentGw <= 1 ? bank : preGwInfo.bank;
                gwTxForSlots.forEach(tx => {
                    const pOut = PLAYERS.find(p => p.id === tx.out);
                    const pIn = PLAYERS.find(p => p.id === tx.in);
                    if (pOut && pIn) adjBank += pOut.price - pIn.price;
                });
                previewBank = Math.max(0, adjBank);
            } else {
                previewSlots = slotsAtGw;
                // Show the bank for this GW without transfers
                const gwInfo = state.currentGw <= 1 ? squadInfo : state.getSquadForGw(state.currentGw);
                previewBank = gwInfo.bank;
            }
        } else if (sourceVal.startsWith('draft_')) {
            const draftIdx = parseInt(sourceVal.split('_')[1]);
            const d = state.drafts[draftIdx];
            if (!d.squadSlots) {
                d.squadSlots = JSON.parse(JSON.stringify(state.squadSlots));
                d.captain = state.captain;
                d.vice = state.vice;
                d.formation = state.formation;
            }
            if (!d.transfers) {
                d.transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
            }
            if (!d.chips) {
                d.chips = {};
                for (let gw = 1; gw <= 38; gw++) {
                    d.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false };
                }
            }
            previewCap = d.captain || state.captain;
            previewVice = d.vice || state.vice;

            // Apply all prior-GW transfers cumulatively to d.squadSlots base
            let draftSlotsAtGw = JSON.parse(JSON.stringify(d.squadSlots));
            for (let gw = 1; gw < state.currentGw; gw++) {
                const priorTx = d.transfers[gw] || [];
                priorTx.forEach(tx => {
                    const slot = draftSlotsAtGw.find(s => s.playerId === tx.out);
                    if (slot) slot.playerId = tx.in;
                });
            }

            // Apply current GW transfers for the highlighted preview
            const draftGwTx = d.transfers[state.currentGw] || [];
            if (draftGwTx.length > 0) {
                previewSlots = JSON.parse(JSON.stringify(draftSlotsAtGw));
                draftGwTx.forEach(tx => {
                    const slot = previewSlots.find(s => s.playerId === tx.out);
                    if (slot) slot.playerId = tx.in;
                });
                // Bank: base draft cost adjusted for all transfers up to currentGw
                const baseSpent = d.squadSlots.reduce((sum, slot) => {
                    if (slot.playerId === null) return sum;
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    return sum + (p ? p.price : 0);
                }, 0);
                let adjBank = 100 - baseSpent;
                for (let gw = 1; gw <= state.currentGw; gw++) {
                    const txs = d.transfers[gw] || [];
                    txs.forEach(tx => {
                        const pOut = PLAYERS.find(p => p.id === tx.out);
                        const pIn = PLAYERS.find(p => p.id === tx.in);
                        if (pOut && pIn) adjBank += pOut.price - pIn.price;
                    });
                }
                previewBank = Math.max(0, adjBank);
            } else {
                previewSlots = draftSlotsAtGw;
                // Bank for this GW without current-GW transfers
                const baseSpent = d.squadSlots.reduce((sum, slot) => {
                    if (slot.playerId === null) return sum;
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    return sum + (p ? p.price : 0);
                }, 0);
                let adjBank = 100 - baseSpent;
                for (let gw = 1; gw < state.currentGw; gw++) {
                    const txs = d.transfers[gw] || [];
                    txs.forEach(tx => {
                        const pOut = PLAYERS.find(p => p.id === tx.out);
                        const pIn = PLAYERS.find(p => p.id === tx.in);
                        if (pOut && pIn) adjBank += pOut.price - pIn.price;
                    });
                }
                previewBank = Math.max(0, adjBank);
            }
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
            // Build a lookup: playerId (IN) -> playerName (OUT) for current GW transfers
            const gwTransfers = (state.transfers && state.transfers[state.currentGw]) || [];
            const transferInMap = {}; // inId -> outPlayer
            gwTransfers.forEach(tx => {
                const pOut = PLAYERS.find(p => p.id === tx.out);
                if (pOut) transferInMap[tx.in] = pOut;
            });
            const hasTransfers = gwTransfers.length > 0;

            tpSquadPreviewContainer.innerHTML = `
                <style>
                    #tpSquadPreviewContainer .pitch-sell-btn {
                        display: none !important;
                    }
                    #tpSquadPreviewContainer .player-pitch-card {
                        cursor: default !important;
                    }
                    .tp-transfer-badge {
                        position: absolute;
                        bottom: -6px;
                        right: -6px;
                        padding: 1px 5px;
                        background: linear-gradient(135deg, #22c55e, #16a34a);
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 9px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                        color: #fff;
                        border: 1.5px solid rgba(255,255,255,0.35);
                        box-shadow: 0 2px 8px rgba(34,197,94,0.55);
                        z-index: 20;
                        cursor: pointer;
                        animation: tpBadgePulse 2s infinite alternate;
                    }
                    @keyframes tpBadgePulse {
                        0% { box-shadow: 0 0 4px rgba(34,197,94,0.4); }
                        100% { box-shadow: 0 0 12px rgba(34,197,94,0.9); }
                    }
                    #tpSquadPreviewContainer .player-pitch-card.is-transferred-in {
                        border: 2px solid rgba(34,197,94,0.6) !important;
                        background: rgba(34,197,94,0.06) !important;
                    }
                    .tp-transfer-tooltip {
                        position: fixed;
                        z-index: 99999;
                        background: #0d1f3c;
                        border: 1px solid rgba(0,242,254,0.4);
                        border-radius: 10px;
                        padding: 10px 14px;
                        min-width: 180px;
                        max-width: 240px;
                        pointer-events: none;
                        display: none;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    }
                    .tp-transfer-tooltip.visible {
                        display: block;
                    }
                    .tp-revert-all-btn {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        font-size: 11px;
                        font-weight: 700;
                        color: #ef4444;
                        background: rgba(239,68,68,0.12);
                        border: 1px solid rgba(239,68,68,0.35);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    }
                    .tp-revert-all-btn:hover {
                        background: rgba(239,68,68,0.22);
                        border-color: rgba(239,68,68,0.6);
                        transform: translateY(-1px);
                    }
                </style>
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px; box-shadow: var(--shadow-sm);">
                    <h3 style="font-family:var(--font-heading); margin:0; font-size:14px; font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span style="display:flex; align-items:center; gap:8px;">
                            Squad Preview
                            ${hasTransfers ? `<span style="font-size:11px; font-weight:700; color:rgba(0,242,254,0.9); background:rgba(0,242,254,0.1); border:1px solid rgba(0,242,254,0.25); border-radius:6px; padding:2px 8px;">${gwTransfers.length} transfer${gwTransfers.length > 1 ? 's' : ''} applied</span>` : ''}
                        </span>
                        <span style="display:flex; align-items:center; gap:10px;">
                            ${hasTransfers ? `<button class="tp-revert-all-btn" id="tpRevertAllBtn"><i data-lucide="rotate-ccw" style="width:12px;height:12px;"></i> Revert All</button>` : ''}
                            <span style="font-size:12px; color:var(--primary); font-weight:700;">Bank: £${previewBank.toFixed(1)}m</span>
                        </span>
                    </h3>

                    <!-- Regular Full Size Football Pitch -->
                    <div class="football-pitch" id="pitchBoard">
                        <div class="pitch-box-top"></div>
                        <div class="pitch-half-line"></div>
                        <div class="pitch-center-circle"></div>
                        <div class="pitch-box-bottom"></div>

                        <!-- GKP Row -->
                        <div class="pitch-row" data-row="GKP">
                            ${renderPlayerRow(previewSlots, "GKP", state.currentGw, previewCap, previewVice, actions, false, state)}
                        </div>

                        <!-- DEF Row -->
                        <div class="pitch-row" data-row="DEF">
                            ${renderPlayerRow(previewSlots, "DEF", state.currentGw, previewCap, previewVice, actions, false, state)}
                        </div>

                        <!-- MID Row -->
                        <div class="pitch-row" data-row="MID">
                            ${renderPlayerRow(previewSlots, "MID", state.currentGw, previewCap, previewVice, actions, false, state)}
                        </div>

                        <!-- FWD Row -->
                        <div class="pitch-row" data-row="FWD">
                            ${renderPlayerRow(previewSlots, "FWD", state.currentGw, previewCap, previewVice, actions, false, state)}
                        </div>
                    </div>

                    <!-- Bench Section -->
                    <div class="bench-container" style="margin-top: 16px;">
                        <span class="bench-title">Bench Preview</span>
                        <div class="bench-row" id="benchRow">
                            ${renderBenchRow(previewSlots, state.currentGw, previewCap, previewVice, actions, false, state)}
                        </div>
                    </div>

                    ${hasTransfers ? `
                    <!-- Transfer Summary Log -->
                    <div style="border-top:1px solid var(--border-color); padding-top:14px; display:flex; flex-direction:column; gap:8px;">
                        <p style="margin:0 0 6px 0; font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">GW${state.currentGw} Transfers</p>
                        ${gwTransfers.map((tx, idx) => {
                            const pOut = PLAYERS.find(p => p.id === tx.out);
                            const pIn = PLAYERS.find(p => p.id === tx.in);
                            if (!pOut || !pIn) return '';
                            const priceDiff = pIn.price - pOut.price;
                            const diffStr = priceDiff > 0 ? `<span style="color:#ef4444;">+£${priceDiff.toFixed(1)}m</span>` :
                                           priceDiff < 0 ? `<span style="color:#00f2fe;">-£${Math.abs(priceDiff).toFixed(1)}m</span>` : `<span style="color:var(--text-muted);">±0</span>`;
                            return `
                            <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:8px 12px;">
                                <div style="flex:1; min-width:0;">
                                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                        <span style="font-size:12px; font-weight:700; color:#ef4444; white-space:nowrap;">OUT</span>
                                        <span style="font-size:12px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${pOut.name}">${pOut.name}</span>
                                        <span style="font-size:10px; color:var(--text-muted);">${pOut.team} • £${pOut.price.toFixed(1)}m</span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px;">
                                        <span style="font-size:12px; font-weight:700; color:rgba(0,242,254,0.9); white-space:nowrap;">IN</span>
                                        <span style="font-size:12px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${pIn.name}">${pIn.name}</span>
                                        <span style="font-size:10px; color:var(--text-muted);">${pIn.team} • £${pIn.price.toFixed(1)}m • ${diffStr}</span>
                                    </div>
                                </div>
                                <button class="tp-revert-single-btn" data-idx="${idx}" title="Revert this transfer" style="flex-shrink:0; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:6px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; transition:all 0.15s;">✕</button>
                            </div>`;
                        }).join('')}
                    </div>
                    ` : ''}
                </div>
                <!-- Floating transfer tooltip -->
                <div id="tpTransferTooltip" class="tp-transfer-tooltip"></div>
            `;
            lucide.createIcons();

            // --- Overlay transfer badges on transferred-in player cards ---
            const tooltip = tpSquadPreviewContainer.querySelector('#tpTransferTooltip');
            tpSquadPreviewContainer.querySelectorAll('.player-pitch-card:not(.empty-slot)').forEach(card => {
                const playerId = parseInt(card.getAttribute('data-id'));
                const pOut = transferInMap[playerId];
                if (!pOut) return;

                // Mark card with transferred-in class
                card.classList.add('is-transferred-in');

                // Inject badge into shirt wrapper
                const shirtWrapper = card.querySelector('.shirt-icon-wrapper');
                if (shirtWrapper) {
                    const badge = document.createElement('div');
                    badge.className = 'tp-transfer-badge';
                    badge.title = `Planned transfer: ${pOut.name} → OUT`;
                    badge.textContent = 'IN';
                    badge.style.position = 'absolute';
                    shirtWrapper.style.position = 'relative';
                    shirtWrapper.appendChild(badge);

                    // Hover tooltip
                    const showTip = (e) => {
                        const pIn = PLAYERS.find(p => p.id === playerId);
                        const xpIn = pIn && pIn.predictions ? pIn.predictions.slice(0, 5).reduce((s, pr) => s + (pr.pts || 0), 0).toFixed(1) : '—';
                        const xpOut = pOut.predictions ? pOut.predictions.slice(0, 5).reduce((s, pr) => s + (pr.pts || 0), 0).toFixed(1) : '—';
                        tooltip.innerHTML = `
                            <div style="font-size:10px; font-weight:800; color:rgba(0,242,254,0.9); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Transfer Applied</div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="font-size:10px; font-weight:800; color:#ef4444; background:rgba(239,68,68,0.12); padding:1px 5px; border-radius:4px;">OUT</span>
                                    <span style="font-size:12px; font-weight:700; color:var(--text-main);">${pOut.name}</span>
                                    <span style="font-size:10px; color:var(--text-muted);">£${pOut.price.toFixed(1)}m</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="font-size:10px; font-weight:800; color:#00f2fe; background:rgba(0,242,254,0.12); padding:1px 7px; border-radius:4px;">IN</span>
                                    <span style="font-size:12px; font-weight:700; color:var(--text-main);">${pIn ? pIn.name : '—'}</span>
                                    <span style="font-size:10px; color:var(--text-muted);">£${pIn ? pIn.price.toFixed(1) : '—'}m</span>
                                </div>
                                <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:5px; margin-top:2px; display:flex; gap:12px;">
                                    <div style="font-size:10px; color:var(--text-muted);">5GW XP: <strong style="color:var(--text-main);">${xpIn}</strong> vs <strong style="color:var(--text-muted);">${xpOut}</strong></div>
                                </div>
                            </div>`;
                        tooltip.classList.add('visible');
                        // Position tooltip
                        const rect = card.getBoundingClientRect();
                        let top = rect.top - 10;
                        let left = rect.left + rect.width / 2 - 90;
                        if (top < 10) top = rect.bottom + 10;
                        left = Math.max(8, Math.min(left, window.innerWidth - 250));
                        tooltip.style.top = top + 'px';
                        tooltip.style.left = left + 'px';
                    };
                    const hideTip = () => { tooltip.classList.remove('visible'); };

                    card.addEventListener('mouseenter', showTip);
                    card.addEventListener('mouseleave', hideTip);
                    badge.addEventListener('mouseenter', showTip);
                    badge.addEventListener('mouseleave', hideTip);
                    card.addEventListener('click', (e) => {
                        if (tooltip.classList.contains('visible')) {
                            hideTip();
                        } else {
                            showTip(e);
                            setTimeout(hideTip, 3000);
                        }
                    });
                }
            });

            // --- Revert All Transfers ---
            const revertAllBtn = tpSquadPreviewContainer.querySelector('#tpRevertAllBtn');
            if (revertAllBtn) {
                revertAllBtn.addEventListener('click', () => {
                    const count = gwTransfers.length;
                    if (!confirm(`Revert all ${count} transfer${count > 1 ? 's' : ''} for GW${state.currentGw}? This cannot be undone.`)) return;
                    state.transfers[state.currentGw] = [];
                    state.optimizeCaptaincy();
                    state.saveState();
                    actions.showToast(`Reverted all ${count} transfer${count > 1 ? 's' : ''} for GW${state.currentGw}.`, 'success');
                    updateSquadPreview();
                });
            }

            // --- Revert individual transfers ---
            tpSquadPreviewContainer.querySelectorAll('.tp-revert-single-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    const tx = gwTransfers[idx];
                    const pOut = tx ? PLAYERS.find(p => p.id === tx.out) : null;
                    const pIn = tx ? PLAYERS.find(p => p.id === tx.in) : null;
                    actions.removeTransfer(state.currentGw, idx);
                    if (pOut && pIn) {
                        actions.showToast(`Reverted: ${pIn.name} → ${pOut.name}`, 'success');
                    }
                    updateSquadPreview();
                });
            });
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

        const detectFormation = (slots) => {
            const startingDef = slots.filter(s => s.position === 'DEF' && s.isStarting).length;
            const startingMid = slots.filter(s => s.position === 'MID' && s.isStarting).length;
            const startingFwd = slots.filter(s => s.position === 'FWD' && s.isStarting).length;
            return `${startingDef}-${startingMid}-${startingFwd}`;
        };

        try {
            const res = await fetch(`/api/fpl-picks?teamId=${teamId}&gw=${state.currentGw}`);
            if (!res.ok) throw new Error("Network response error");
            const responseData = await res.json();
            if (responseData && responseData.success && responseData.data && responseData.data.picks) {
                const picks = responseData.data.picks;
                const importedSlots = mapFplPicksToSquadSlots(picks);
                const bankVal = (responseData.data.entry_history ? responseData.data.entry_history.bank : 0) / 10;
                
                tempSourceSlots = importedSlots;
                tempCaptain = picks.find(p => p.is_captain)?.element || null;
                tempVice = picks.find(p => p.is_vice_captain)?.element || null;
                tempBank = bankVal;

                // Overwrite the first draft slot (FPL Team ID)
                state.drafts[0].squadSlots = importedSlots;
                state.drafts[0].captain = tempCaptain;
                state.drafts[0].vice = tempVice;
                state.drafts[0].formation = detectFormation(importedSlots);
                state.drafts[0].transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };

                // Save to localStorage cache
                localStorage.setItem('fpl_hub_last_imported_team_id', teamId);
                localStorage.setItem('fpl_hub_last_imported_squad_slots', JSON.stringify(tempSourceSlots));
                localStorage.setItem('fpl_hub_last_imported_captain', (tempCaptain || '').toString());
                localStorage.setItem('fpl_hub_last_imported_vice', (tempVice || '').toString());
                localStorage.setItem('fpl_hub_last_imported_bank', tempBank.toString());

                // Persist state
                state.saveState();

                actions.showToast(`Imported Team ID ${teamId} into FPL Team ID Draft successfully!`, "success");
                updateSquadPreview();
            } else {
                throw new Error("Invalid picks data format");
            }
        } catch (err) {
            console.error(err);
            actions.showToast("Failed to fetch FPL picks. Verify ID is active.", "error");
        } finally {
            tpImportBtn.innerText = "Import";
            tpImportBtn.disabled = false;
        }
    });

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

    const showRiskReportModal = (squadPlayers) => {
        const existing = document.getElementById('tpRiskModal');
        if (existing) existing.remove();

        const riskyPlayers = squadPlayers.filter(p => state.squadRisks && state.squadRisks[p.name]);

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
            const borderCol = r.risk === 'High' ? '#ef4444' : (r.risk === 'Medium' ? '#f59e0b' : '#38bdf8');
            const bgCol = r.risk === 'High' ? 'rgba(239, 68, 68, 0.05)' : (r.risk === 'Medium' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(56, 189, 248, 0.05)');
            return `
                <div style="background:${bgCol}; border-left:4px solid ${borderCol}; border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:4px; font-size:11.5px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:13px; color:var(--text-main); font-family:var(--font-heading);">${p.name} <span style="font-size:10px; font-weight:700; color:var(--text-muted); padding:2px 6px; background:rgba(0,0,0,0.15); border-radius:4px;">${p.team} - ${p.position}</span></strong>
                        <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:${borderCol}; background:${borderCol}1a; padding:2px 8px; border-radius:12px; border:1px solid ${borderCol}33;">${r.risk} Risk</span>
                    </div>
                    <p style="margin:4px 0 0 0; color:var(--text-main); font-weight:600;">⚠️ ${r.reason}</p>
                    ${r.details ? `<p style="margin:2px 0 0 0; color:var(--text-muted); font-size:10.5px; font-style:italic;">ℹ️ ${r.details}</p>` : ''}
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
    };

    const runSquadRiskCheck = async (slots) => {
        const apiKey = localStorage.getItem('fpl_hub_gemini_api_key');
        const squadPlayers = slots.map(s => {
            if (s.playerId === null) return null;
            return PLAYERS.find(p => p.id === s.playerId);
        }).filter(Boolean);

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

                        // Rules-based backup GKP risk enforcer
                        squadPlayers.forEach(p => {
                            if (p.position === 'GKP' && p.price <= 4.0) {
                                const primaryGKPs = PLAYERS.filter(other => 
                                    other.position === 'GKP' && 
                                    other.team === p.team && 
                                    other.price >= 4.5
                                );
                                const hasActivePrimary = primaryGKPs.some(other => 
                                    other.status !== 'i' && 
                                    other.status !== 's' && 
                                    (other.chanceOfPlaying === undefined || other.chanceOfPlaying > 0)
                                );
                                if (hasActivePrimary) {
                                    state.squadRisks[p.name] = {
                                        risk: "High",
                                        reason: "Second-choice / backup goalkeeper.",
                                        details: "Goalkeepers priced at £4.0m are backup options and will not start or score points on Bench Boost unless the first-choice keeper is injured or suspended."
                                    };
                                }
                            }
                        });

                        showRiskReportModal(squadPlayers);
                        updateSquadPreview();
                        return;
                    }
                }
            } catch (err) {
                console.error("Gemini risk scan error, falling back to local scan:", err);
            }
        }

        // Local rules-based fallback scan
        state.squadRisks = {};
        const PROMOTED_TEAMS = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];
        squadPlayers.forEach(p => {
            let riskLevel = null;
            let reason = "";
            let details = "";

            // Check for backup goalkeeper risk
            if (p.position === 'GKP' && p.price <= 4.0) {
                const primaryGKPs = PLAYERS.filter(other => 
                    other.position === 'GKP' && 
                    other.team === p.team && 
                    other.price >= 4.5
                );
                const hasActivePrimary = primaryGKPs.some(other => 
                    other.status !== 'i' && 
                    other.status !== 's' && 
                    (other.chanceOfPlaying === undefined || other.chanceOfPlaying > 0)
                );
                if (hasActivePrimary) {
                    riskLevel = "High";
                    reason = "Second-choice / backup goalkeeper.";
                    details = "Goalkeepers priced at £4.0m are backup options and will not start or score points on Bench Boost unless the first-choice keeper is injured or suspended.";
                }
            }

            const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;
            const status = p.status || 'a';
            const starts = typeof p.GS === 'number' ? p.GS : 25;
            const mppg = typeof p.MPPG === 'number' ? p.MPPG : 80;

            if (status === 'i' || chance === 0) {
                riskLevel = "High";
                reason = p.news || "Ruled out with injury.";
                details = "FPL official status flag set to unavailable.";
            } else if (status === 's') {
                riskLevel = "High";
                reason = p.news || "Suspended.";
                details = "FPL official status flag set to suspended.";
            } else if (status === 'd' || chance < 75) {
                riskLevel = "Medium";
                reason = p.news || `Doubtful starting chance (${chance}% play probability).`;
                details = "Player flagged by team medical staff.";
            } else if (chance < 100) {
                riskLevel = "Low";
                reason = p.news || `Minor fitness concern (${chance}% play probability).`;
                details = "Mild flag. Check press conferences before deadline.";
            } else if (starts > 0 && starts < 15) {
                const isPromotedOrNew = (p.team && PROMOTED_TEAMS.includes(p.team)) || p.transferredThisSeason;
                if (!isPromotedOrNew) {
                    riskLevel = "Medium";
                    reason = `Tactical rotation risk (started only ${starts} matches last season).`;
                    details = "Historical starting frequency indicates rotation risk.";
                }
            } else if (mppg > 0 && mppg < 60) {
                const isPromotedOrNew = (p.team && PROMOTED_TEAMS.includes(p.team)) || p.transferredThisSeason;
                if (!isPromotedOrNew) {
                    riskLevel = "Low";
                    reason = `Minutes risk (averages only ${mppg.toFixed(0)} mins per appearance).`;
                    details = "Averages less than 60 minutes per game.";
                }
            }

            if (riskLevel) {
                state.squadRisks[p.name] = {
                    risk: riskLevel,
                    reason: reason,
                    details: details
                };
            }
        });

        showRiskReportModal(squadPlayers);
        updateSquadPreview();
    };

    const checkSquadRisksBtn = container.querySelector('#checkSquadRisksBtn');
    if (checkSquadRisksBtn) {
        checkSquadRisksBtn.addEventListener('click', async () => {
            const sourceVal = tpSourceSquad.value;
            let squadSlots = null;
            if (sourceVal === 'active') {
                squadSlots = state.squadSlots;
            } else if (sourceVal.startsWith('draft_')) {
                const draftIdx = parseInt(sourceVal.split('_')[1]);
                squadSlots = state.drafts[draftIdx].squadSlots || state.squadSlots;
            } else if (sourceVal === 'import') {
                squadSlots = tempSourceSlots;
            }

            if (!squadSlots || squadSlots.every(s => s.playerId === null)) {
                actions.showToast("Please load or import a squad first.", "warning");
                return;
            }

            checkSquadRisksBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:14px; height:14px;"></i> Scanning...`;
            checkSquadRisksBtn.disabled = true;

            try {
                await runSquadRiskCheck(squadSlots);
                actions.showToast("Squad risk scan completed!", "success");
            } catch (err) {
                console.error(err);
                actions.showToast("Notice: Fallback scan completed.", "info");
            } finally {
                checkSquadRisksBtn.innerHTML = `<i data-lucide="shield-alert" style="width: 14px; height: 14px;"></i> Check Squad Risks`;
                checkSquadRisksBtn.disabled = false;
                lucide.createIcons();
            }
        });
    }

    const tpActiveChip = container.querySelector('#tpActiveChip');
    if (tpActiveChip) {
        tpActiveChip.addEventListener('change', (e) => {
            const chosen = e.target.value;
            const gw = state.currentGw;
            if (!state.chips[gw]) {
                state.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false };
            }
            Object.keys(state.chips[gw]).forEach(k => state.chips[gw][k] = false);
            if (chosen !== 'none') {
                state.chips[gw][chosen] = true;
            }
            state.saveState();
            
            // Re-run optimization automatically
            numTransfers = parseInt(tpNumTransfers.value);
            horizon = parseInt(tpHorizon.value);
            runTransferPlannerOptimization(tpResultsGrid, state, actions, numTransfers, horizon);
        });
    }

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
                                    <div style="display:flex; align-items:center; gap:6px; min-width:0; flex-wrap:wrap;">
                                        <span style="font-size:10px; font-weight:800; background:var(--primary); color:#000; padding:1px 5px; border-radius:4px; flex-shrink:0;">#${optIdx + 1}</span>
                                        <span style="font-weight:700; color:var(--text-main); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pOpt.name}</span>
                                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">${pOpt.team} • £${pOpt.price.toFixed(1)}m</span>
                                        ${renderSetPieceBadges(pOpt)}
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
                                    ${renderSetPieceBadges(tx.out)}
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
                    if (state.currentGw === 1) {
                        // Update state.squadSlots directly
                        state.squadSlots = result.finalSquadSlots;
                    } else {
                        // Apply as planned transfers in the current gw
                        if (!state.transfers[state.currentGw]) {
                            state.transfers[state.currentGw] = [];
                        }
                        result.sequence.forEach(tx => {
                            state.transfers[state.currentGw].push({ out: tx.out.id, in: tx.in.id });
                        });
                    }
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

        const isGuaranteedStart = (player) => {
            if (state.mustInclude && state.mustInclude.includes(player.id)) return true;
            if (player.status === 'i' || player.status === 's' || player.status === 'u') return false;
            if (player.MPPG === undefined || player.MPPG === null || player.MPPG < 80) return false;
            const chance = (player.chanceOfPlaying !== undefined && player.chanceOfPlaying !== null) ? player.chanceOfPlaying : 100;
            if (chance < 50) return false;
            const minMins = state.guaranteedStart || 0;
            if (minMins > 0) {
                return player.MPPG >= minMins;
            }
            return true;
        };

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
            if (starters.length === 0) return 0;

            // Dynamically optimize captaincy choice to maximize squad return
            let bestCapId = starters[0];
            let maxCapXP = -999;
            starters.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    const xp = getExpectedPts(player, horizon);
                    if (xp > maxCapXP) {
                        maxCapXP = xp;
                        bestCapId = id;
                    }
                }
            });

            starters.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    let multiplier = 1;
                    if (id === bestCapId) {
                        multiplier = state.chips[state.currentGw]?.tripleCaptain ? 3 : 2;
                    }
                    expectedPoints += getExpectedPts(player, horizon) * multiplier;
                }
            });

            const bench = slots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);
            bench.forEach(id => {
                const player = PLAYERS.find(p => p.id === id);
                if (player) {
                    const benchWeight = state.chips[state.currentGw]?.benchBoost ? 1.0 : 0.10;
                    expectedPoints += getExpectedPts(player, horizon) * benchWeight;
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
                    !state.mustExclude.includes(p.id) &&
                    (!state.chips[state.currentGw]?.benchBoost || isGuaranteedStart(p))
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
                    !state.mustExclude.includes(p.id) &&
                    (!state.chips[state.currentGw]?.benchBoost || isGuaranteedStart(p))
                );

                const optionsList = [];
                for (const boughtPlayer of candidates) {
                    if (!checkTeamConstraints(currentSquadSlots, soldPlayer.id, boughtPlayer.id)) continue;

                    const tempSlots = JSON.parse(JSON.stringify(currentSquadSlots));
                    const targetSlot = tempSlots.find(s => s.playerId === soldPlayer.id);
                    if (targetSlot) targetSlot.playerId = boughtPlayer.id;

                    const gain = getSquadExpectedPts(tempSlots) - getSquadExpectedPts(currentSquadSlots);
                    if (gain > 0.01) {
                        optionsList.push({
                            player: boughtPlayer,
                            gain: gain
                        });
                    }
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
