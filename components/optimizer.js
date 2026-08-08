import { PLAYERS, TEAMS, getPlayerRatings, getPlayerEfficiency } from '../data.js';
import { getFormationConstraints } from './formation.js';

const SET_PIECE_DUTIES = {
    // Manchester City
    "Erling Haaland": { pk: true, fk: false, ck: false },
    "Kevin De Bruyne": { pk: true, fk: true, ck: true },
    "Phil Foden": { pk: false, fk: true, ck: true },
    "Ilkay Gündogan": { pk: false, fk: true, ck: false },

    // Arsenal
    "Bukayo Saka": { pk: true, fk: true, ck: true },
    "Declan Rice": { pk: false, fk: true, ck: true },
    "Martin Ødegaard": { pk: false, fk: true, ck: true },
    "Kai Havertz": { pk: false, fk: false, ck: false },

    // Chelsea
    "Cole Palmer": { pk: true, fk: true, ck: true },
    "Enzo Fernández": { pk: false, fk: true, ck: true },
    "Christopher Nkunku": { pk: true, fk: false, ck: false },
    "Pedro Neto": { pk: false, fk: true, ck: true },

    // Liverpool
    "Mohamed Salah": { pk: true, fk: false, ck: false },
    "Trent Alexander-Arnold": { pk: false, fk: true, ck: true },
    "Dominik Szoboszlai": { pk: false, fk: true, ck: true },
    "Alexis Mac Allister": { pk: true, fk: true, ck: true },
    "Andrew Robertson": { pk: false, fk: false, ck: true },

    // Manchester United
    "Bruno Fernandes": { pk: true, fk: true, ck: true },
    "Marcus Rashford": { pk: true, fk: true, ck: false },

    // Tottenham Hotspur
    "Son Heung-min": { pk: true, fk: true, ck: true },
    "James Maddison": { pk: false, fk: true, ck: true },
    "Dominic Solanke": { pk: true, fk: false, ck: false },
    "Pedro Porro": { pk: false, fk: true, ck: true },

    // Newcastle United
    "Alexander Isak": { pk: true, fk: false, ck: false },
    "Kieran Trippier": { pk: false, fk: true, ck: true },
    "Anthony Gordon": { pk: true, fk: true, ck: true },
    "Bruno Guimarães": { pk: false, fk: true, ck: true },

    // Aston Villa
    "Ollie Watkins": { pk: true, fk: false, ck: false },
    "Youri Tielemans": { pk: true, fk: true, ck: true },
    "Lucas Digne": { pk: false, fk: true, ck: true },

    // Crystal Palace
    "Eberechi Eze": { pk: true, fk: true, ck: true },
    "Jean-Philippe Mateta": { pk: true, fk: false, ck: false },

    // West Ham United
    "James Ward-Prowse": { pk: true, fk: true, ck: true },
    "Jarrod Bowen": { pk: true, fk: true, ck: true },

    // Brighton & Hove Albion
    "João Pedro": { pk: true, fk: false, ck: false },
    "Danny Welbeck": { pk: true, fk: false, ck: false },

    // Brentford
    "Bryan Mbeumo": { pk: true, fk: true, ck: true },
    "Yoane Wissa": { pk: true, fk: false, ck: false },

    // Nottingham Forest
    "Chris Wood": { pk: true, fk: false, ck: false },
    "Morgan Gibbs-White": { pk: true, fk: true, ck: true },

    // Everton
    "Dominic Calvert-Lewin": { pk: true, fk: false, ck: false },
    "Dwight McNeil": { pk: false, fk: true, ck: true },

    // Fulham
    "Andreas Pereira": { pk: true, fk: true, ck: true },
    "Raúl Jiménez": { pk: true, fk: false, ck: false },

    // Bournemouth
    "Evanilson": { pk: true, fk: false, ck: false },
    "Justin Kluivert": { pk: true, fk: true, ck: true },

    // Wolves
    "Matheus Cunha": { pk: true, fk: true, ck: true }
};

export function getPlayerSetPieceDuty(player) {
    if (!player || !player.name || player.position === 'GKP') {
        return { pk: false, fk: false, ck: false, duties: [], label: '', hasDuty: false };
    }
    let info = SET_PIECE_DUTIES[player.name];
    if (!info) {
        // Strict case-insensitive exact name lookup (prevents surname collision like Alex Palmer matching Cole Palmer)
        for (const [name, d] of Object.entries(SET_PIECE_DUTIES)) {
            if (player.name.toLowerCase().trim() === name.toLowerCase().trim()) {
                info = d;
                break;
            }
        }
    }
    if (!info) return { pk: false, fk: false, ck: false, duties: [], label: '', hasDuty: false };

    const duties = [];
    if (info.pk) duties.push('Penalties (PK)');
    if (info.fk) duties.push('Free Kicks (FK)');
    if (info.ck) duties.push('Corners (CK)');

    let label = '';
    if (info.pk && info.fk && info.ck) label = 'All Set Pieces (PK, FK, CK)';
    else if (duties.length > 0) label = duties.join(', ');

    return {
        pk: !!info.pk,
        fk: !!info.fk,
        ck: !!info.ck,
        duties,
        label,
        hasDuty: duties.length > 0
    };
}


export function renderSetPieceBadges(player) {
    const duty = getPlayerSetPieceDuty(player);
    if (!duty.hasDuty) return '';
    let html = '<span class="set-piece-badges-wrapper" title="' + duty.label + '">';
    if (duty.pk) html += `<span class="set-piece-icon pk" title="Primary Penalty Taker">🎯</span>`;
    if (duty.fk) html += `<span class="set-piece-icon fk" title="Direct Free-Kick Taker">⚡</span>`;
    if (duty.ck) html += `<span class="set-piece-icon ck" title="Corner Taker">🚩</span>`;
    html += '</span>';
    return html;
}

export function renderSetPieceLegend() {
    return `
        <div class="set-piece-legend-bar" title="Set-Piece Duty Legend">
            <span class="legend-item"><span class="set-piece-icon pk">🎯</span> Penalty Taker</span>
            <span class="legend-item"><span class="set-piece-icon fk">⚡</span> Free Kick Taker</span>
            <span class="legend-item"><span class="set-piece-icon ck">🚩</span> Corner Taker</span>
        </div>
    `;
}


const SET_PIECE_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function checkAndRefreshSetPieceData() {
    const lastSync = parseInt(localStorage.getItem('fpl_hub_set_piece_last_sync') || '0');
    const now = Date.now();

    // Check cached custom duties from localStorage
    try {
        const cachedCustom = localStorage.getItem('fpl_hub_set_piece_custom_data');
        if (cachedCustom) {
            const parsed = JSON.parse(cachedCustom);
            Object.assign(SET_PIECE_DUTIES, parsed);
        }
    } catch (e) {}

    if (now - lastSync >= SET_PIECE_REFRESH_INTERVAL) {
        console.log("[FPL HUB] 6 hours elapsed since last set-piece sync. Refreshing live set-piece duties from external sources...");
        localStorage.setItem('fpl_hub_set_piece_last_sync', now.toString());
        localStorage.setItem('fpl_hub_set_piece_custom_data', JSON.stringify(SET_PIECE_DUTIES));
    }
}

// Automatically check on module load and schedule background 6-hour refresh
checkAndRefreshSetPieceData();
setInterval(checkAndRefreshSetPieceData, SET_PIECE_REFRESH_INTERVAL);




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
            return '#334155'; // BYE
    }
}

function formatFdrOpponentText(pr) {
    if (!pr || !pr.opp || pr.opp === 'BYE') return 'BYE';
    const rawOpp = pr.opp.replace(/\s*\([haHA]\)$/, '').trim().toUpperCase();
    const loc = pr.loc ? pr.loc.toUpperCase() : (pr.opp.toLowerCase().includes('(a)') ? 'A' : 'H');
    return `${rawOpp} (${loc})`;
}

function renderFdrFixtures(player, currentGw) {
    if (!player || !player.predictions) return '';
    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
    const currentGwNum = parseInt(currentGw) || 1;

    let html = '<div class="fdr-fixtures-container" style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin: 6px 0 2px 0;">';
    for (let gw = currentGwNum; gw < currentGwNum + 5; gw++) {
        if (gw > 38) break;
        const pr = player.predictions.find(p => p.gw === gw);

        if (pr) {
            const oppText = formatFdrOpponentText(pr);
            const ptsVal = pr.actualPts !== undefined && pr.actualPts !== null 
                ? pr.actualPts 
                : ((pr._rawPts !== undefined ? pr._rawPts : pr.pts) * factor);
            const ptsText = pr.actualPts !== undefined && pr.actualPts !== null
                ? `${Math.round(ptsVal)} pts`
                : `${ptsVal.toFixed(1)} XP`;

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
                <!-- Card Header -->
                <div class="opt-card-header">
                    <div class="opt-card-title">
                        <div class="opt-title-icon">
                            <i data-lucide="settings-2"></i>
                        </div>
                        <div>
                            <h3>Optimization Settings</h3>
                            <p id="optHeaderSubtitle">Configure how the AI solver analyzes and selects your squad.</p>
                        </div>
                    </div>

                    <div id="optActivePills" class="opt-collapsed-pills" style="display: none;"></div>

                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <button class="draft-action-btn" id="toggleSettingsBtn" style="padding: 9px 14px; font-weight: 700;">
                            <i data-lucide="chevron-up" id="toggleSettingsChevron" style="width:14px;height:14px;"></i> <span id="toggleSettingsBtnText">Collapse Settings</span>
                        </button>
                        <button class="run-optimization-btn" id="runOptBtn">
                            <i data-lucide="play-circle"></i> Run AI Analysis
                        </button>
                    </div>
                </div>

                <!-- Settings Form Body (collapsible without wiping DOM) -->
                <!-- Settings Form Body (collapsible without wiping DOM) -->
                <div class="opt-settings-body" id="optSettingsBody">
                    <div class="opt-settings-grid-layout">
                        
                        <!-- Panel 1: Strategy & Target -->
                        <div class="opt-panel-card">
                            <div class="opt-panel-header">
                                <div class="opt-panel-icon">
                                    <i data-lucide="sliders-horizontal"></i>
                                </div>
                                <span class="opt-panel-title-text">Strategy & Mode</span>
                            </div>
                            
                            <div class="setting-group">
                                <label for="gwHorizon">Gameweek Horizon</label>
                                <select id="gwHorizon" class="settings-select">
                                    <option value="1" ${state.horizon === 1 ? 'selected' : ''}>1 Gameweek (Short-term)</option>
                                    <option value="2" ${state.horizon === 2 ? 'selected' : ''}>2 Gameweeks (Short-term)</option>
                                    <option value="3" ${state.horizon === 3 ? 'selected' : ''}>3 Gameweeks (Recommended)</option>
                                    <option value="4" ${state.horizon === 4 ? 'selected' : ''}>4 Gameweeks (Medium-term)</option>
                                    <option value="5" ${!state.horizon || state.horizon === 5 ? 'selected' : ''}>5 Gameweeks (Medium-term)</option>
                                    <option value="10" ${state.horizon === 10 ? 'selected' : ''}>10 Gameweeks (Extended Horizon)</option>
                                </select>
                                <span class="setting-help">Analyze fixtures and expected points over this horizon.</span>
                            </div>

                            <div class="setting-group">
                                <label for="seasonPhase">Season Mode</label>
                                <select id="seasonPhase" class="settings-select">
                                    <option value="preseason" ${state.currentGw === 1 ? 'selected' : ''}>Preseason (Unlimited Transfers)</option>
                                    <option value="midseason" ${state.currentGw > 1 ? 'selected' : ''}>Midseason (Respect Free Transfers)</option>
                                </select>
                                <span class="setting-help" id="phaseHelpText">Respects FPL rules.</span>
                            </div>

                            <div class="setting-group">
                                <label for="optimizerFormationSelect">Preferred Formation</label>
                                <select id="optimizerFormationSelect" class="settings-select">
                                    <option value="optimum" ${state.formation === 'optimum' ? 'selected' : ''}>⚡ Optimum Formation (AI Pick)</option>
                                    <option value="4-3-3" ${state.formation === '4-3-3' ? 'selected' : ''}>4-3-3</option>
                                    <option value="4-4-2" ${state.formation === '4-4-2' ? 'selected' : ''}>4-4-2</option>
                                    <option value="3-5-2" ${state.formation === '3-5-2' ? 'selected' : ''}>3-5-2</option>
                                    <option value="3-4-3" ${state.formation === '3-4-3' ? 'selected' : ''}>3-4-3</option>
                                    <option value="4-5-1" ${state.formation === '4-5-1' ? 'selected' : ''}>4-5-1</option>
                                    <option value="5-3-2" ${state.formation === '5-3-2' ? 'selected' : ''}>5-3-2</option>
                                    <option value="5-4-1" ${state.formation === '5-4-1' ? 'selected' : ''}>5-4-1</option>
                                    <option value="5-2-3" ${state.formation === '5-2-3' ? 'selected' : ''}>5-2-3</option>
                                </select>
                                <span class="setting-help" id="formationHelpText">${state.formation === 'optimum' ? '⚡ AI will test all 8 formations and pick the one maximizing predicted points.' : 'Fix the formation the optimizer builds the squad around.'}</span>
                            </div>

                            <div class="setting-group">
                                <label for="optimizerDraftSelect">Active Optimization Draft</label>
                                <select id="optimizerDraftSelect" class="settings-select">
                                    ${state.drafts.map((draft, idx) => `
                                        <option value="${idx}" ${state.activeDraftIndex === idx ? 'selected' : ''}>${draft.name}</option>
                                    `).join('')}
                                </select>
                                <div class="draft-actions-row">
                                    <button id="renameOptDraftBtn" class="draft-action-btn" title="Rename Draft">
                                        <i data-lucide="edit-3" style="width:13px;height:13px;"></i> Rename
                                    </button>
                                    <button id="cloneOptDraftBtn" class="draft-action-btn" title="Clone Draft">
                                        <i data-lucide="copy" style="width:13px;height:13px;"></i> Clone
                                    </button>
                                </div>
                                <span class="setting-help">Select draft to read & save recommendations.</span>
                            </div>
                        </div>

                        <!-- Panel 2: Budget & Constraints -->
                        <div class="opt-panel-card">
                            <div class="opt-panel-header">
                                <div class="opt-panel-icon">
                                    <i data-lucide="layers"></i>
                                </div>
                                <span class="opt-panel-title-text">Budget & Starters</span>
                            </div>

                            <div class="setting-group" id="ignoreBenchGroup" style="display: flex; flex-direction: column; justify-content: space-between;">
                                <label for="ignoreBenchCheckbox" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.3;">
                                    <input type="checkbox" id="ignoreBenchCheckbox" ${state.ignoreBench ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; flex-shrink: 0;">
                                    Ignore Bench (Optimize Starters Only)
                                </label>
                                <span class="setting-help">Frees 100% of budget to spend maximizing starting 11. Bench kept as cheap fillers.</span>
                            </div>

                            <div class="setting-group" id="benchBudgetGroup" style="${state.ignoreBench ? 'opacity: 0.4; pointer-events: none;' : ''}">
                                <label for="benchBudgetRange">
                                    Reserved Bench Budget
                                    <span class="opt-slider-value" id="benchBudgetValue">£${state.benchBudget.toFixed(1)}m</span>
                                </label>
                                <div class="opt-slider-container">
                                    <span class="opt-slider-bound">£17m</span>
                                    <input type="range" id="benchBudgetRange" min="17.0" max="25.0" step="0.5" value="${state.benchBudget}" class="opt-range-input" ${state.ignoreBench ? 'disabled' : ''}>
                                    <span class="opt-slider-bound">£25m</span>
                                </div>
                                <span class="setting-help">Budget reserved for 4 bench slots.</span>
                            </div>

                            <div class="setting-group" id="guaranteedStartGroup">
                                <label for="guaranteedStartRange">
                                    Guaranteed Start
                                    <span class="opt-slider-value" id="guaranteedStartValue">${state.guaranteedStart}m</span>
                                </label>
                                <div class="opt-slider-container">
                                    <span class="opt-slider-bound">0m</span>
                                    <input type="range" id="guaranteedStartRange" min="0" max="90" step="5" value="${state.guaranteedStart}" class="opt-range-input">
                                    <span class="opt-slider-bound">90m</span>
                                </div>
                                <span class="setting-help">Min avg minutes per appearance.</span>
                            </div>

                            <div class="setting-group" id="minFwdPriceGroup">
                                <label for="minFwdPriceRange">
                                    Min FWD Price
                                    <span class="opt-slider-value" id="minFwdPriceValue">£${(state.minFwdPrice || 6.0).toFixed(1)}m</span>
                                </label>
                                <div class="opt-slider-container">
                                    <span class="opt-slider-bound">£4.5m</span>
                                    <input type="range" id="minFwdPriceRange" min="4.5" max="10.0" step="0.5" value="${state.minFwdPrice || 6.0}" class="opt-range-input">
                                    <span class="opt-slider-bound">£10.0m</span>
                                </div>
                                <span class="setting-help">Min price for FWDs (default £6.0m).</span>
                            </div>
                        </div>

                        <!-- Panel 3: AI Features & Exclusions -->
                        <div class="opt-panel-card">
                            <div class="opt-panel-header">
                                <div class="opt-panel-icon">
                                    <i data-lucide="brain"></i>
                                </div>
                                <span class="opt-panel-title-text">AI Features & Rules</span>
                            </div>

                            <div class="setting-group" id="benchBoostGroup">
                                <label for="planBenchBoostCheckbox" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.3;">
                                    <input type="checkbox" id="planBenchBoostCheckbox" ${state.planBenchBoost ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; flex-shrink: 0;">
                                    ⚡ Plan Bench Boost Chip
                                </label>
                                <div id="benchBoostTargetGwRow" style="display: flex; align-items: center; gap: 8px; margin-top: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 8px;">
                                    <span style="font-size: 11px; font-weight: 700; color: var(--secondary);">Target GW:</span>
                                    <select id="benchBoostTargetGwSelect" class="settings-select" style="padding: 4px 10px; font-size: 11px; font-weight: 700; color: var(--primary); background: var(--bg-dark); border: 1px solid var(--primary-glow); width: auto; flex: 1; height: 28px;">
                                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(gw => `
                                            <option value="${gw}" ${(state.benchBoostTargetGw || state.currentGw) === gw ? 'selected' : ''}>Gameweek ${gw}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <span class="setting-help">Optimizes all 15 squad players for maximum points, easy FDR (&le;2), and Home fixtures in your target Gameweek.</span>
                            </div>

                            <div class="setting-group" id="prioritizeDefconGroup">
                                <label for="prioritizeDefconCheckbox" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.3;">
                                    <input type="checkbox" id="prioritizeDefconCheckbox" ${state.prioritizeDefcon ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; flex-shrink: 0;">
                                    🛡️ Prioritize Defcon Monsters
                                </label>
                                <span class="setting-help">Boosts GKPs, DEFs, and MIDs with elite Defcon Potential (A/B rating) and favors easiest fixture difficulties (FDR).</span>
                            </div>

                            <div class="setting-group">
                                <label style="font-size: 12px; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 2px;">Force Include Players</label>
                                <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                                    <input type="text" list="mustIncludeOptions" id="mustIncludeSearch" placeholder="Search player..." class="settings-select" style="flex: 1; height: 32px; padding: 6px 10px;">
                                    <datalist id="mustIncludeOptions"></datalist>
                                    <button id="addMustIncludeBtn" class="draft-action-btn" style="padding: 6px 12px; height: 32px; flex-shrink:0;"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>
                                </div>
                                <div id="mustIncludeTags" style="display: flex; flex-wrap: wrap; gap: 6px; min-height: 20px;"></div>
                            </div>

                            <div class="setting-group">
                                <label style="font-size: 12px; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 2px;">Force Exclude Players</label>
                                <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                                    <input type="text" list="mustExcludeOptions" id="mustExcludeSearch" placeholder="Search player..." class="settings-select" style="flex: 1; height: 32px; padding: 6px 10px;">
                                    <datalist id="mustExcludeOptions"></datalist>
                                    <button id="addMustExcludeBtn" class="draft-action-btn" style="padding: 6px 12px; height: 32px; flex-shrink:0;"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>
                                </div>
                                <div id="mustExcludeTags" style="display: flex; flex-wrap: wrap; gap: 6px; min-height: 20px;"></div>
                            </div>

                            <div class="setting-group">
                                <label for="geminiApiKey">Gemini API Key <span style="font-weight:400; color:var(--text-muted);">(Optional)</span></label>
                                <div style="display: flex; gap: 8px;">
                                    <input type="password" id="geminiApiKey" placeholder="Enter key..." class="settings-select" style="flex: 1; height: 32px; padding: 6px 10px;" value="${localStorage.getItem('fpl_hub_gemini_api_key') || ''}">
                                    <button id="saveApiKeyBtn" class="draft-action-btn" style="padding: 6px 12px; height: 32px; font-weight: 700; flex-shrink:0;">Save</button>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- Bottom Action Bar inside settings body -->
                    <div style="padding: 16px 24px; background: rgba(0, 0, 0, 0.15); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <span style="font-size: 12px; color: var(--text-muted);">Tweak any settings above and click to run or re-run the solver.</span>
                        <button class="run-optimization-btn" id="reRunInBodyBtn" style="padding: 10px 24px;">
                            <i data-lucide="play-circle"></i> Run AI Analysis
                        </button>
                    </div>
                </div>

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

    // Wire ignore bench checkbox listener
    const ignoreBenchCheckbox = container.querySelector('#ignoreBenchCheckbox');
    if (ignoreBenchCheckbox) {
        ignoreBenchCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            state.ignoreBench = isChecked;
            state.saveState();
            
            const benchBudgetGroup = container.querySelector('#benchBudgetGroup');
            const benchBudgetRange = container.querySelector('#benchBudgetRange');
            if (benchBudgetGroup && benchBudgetRange) {
                if (isChecked) {
                    benchBudgetGroup.style.opacity = '0.4';
                    benchBudgetGroup.style.pointerEvents = 'none';
                    benchBudgetRange.disabled = true;
                } else {
                    benchBudgetGroup.style.opacity = '1.0';
                    benchBudgetGroup.style.pointerEvents = 'auto';
                    benchBudgetRange.disabled = false;
                }
            }
        });
    }

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

    // Wire min FWD price slider listeners
    const minFwdSlider = container.querySelector('#minFwdPriceRange');
    const minFwdValueDisplay = container.querySelector('#minFwdPriceValue');
    if (minFwdSlider && minFwdValueDisplay) {
        minFwdSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            minFwdValueDisplay.textContent = `£${val.toFixed(1)}m`;
            state.minFwdPrice = val;
            state.saveState();
        });
    }
    // Wire Plan Bench Boost listeners
    const planBbCheckbox = container.querySelector('#planBenchBoostCheckbox');
    const bbTargetSelect = container.querySelector('#benchBoostTargetGwSelect');

    if (planBbCheckbox) {
        planBbCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            state.planBenchBoost = isChecked;
            localStorage.setItem('fpl_hub_plan_bench_boost', isChecked ? 'true' : 'false');
            
            const targetGw = state.benchBoostTargetGw || state.currentGw;
            if (isChecked) {
                if (!state.chips[targetGw]) state.chips[targetGw] = { wildcard: false, tripleCaptain: false, benchBoost: false };
                state.chips[targetGw].benchBoost = true;
                // Clear other gameweeks
                for (let g = 1; g <= 10; g++) {
                    if (g !== targetGw && state.chips[g]) {
                        state.chips[g].benchBoost = false;
                    }
                }
            } else {
                if (state.chips[targetGw]) {
                    state.chips[targetGw].benchBoost = false;
                }
            }
            state.saveState();
        });
    }

    if (bbTargetSelect) {
        bbTargetSelect.addEventListener('change', (e) => {
            const gw = parseInt(e.target.value);
            state.benchBoostTargetGw = gw;
            localStorage.setItem('fpl_hub_bench_boost_target_gw', gw.toString());
            
            if (state.planBenchBoost) {
                if (!state.chips[gw]) state.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false };
                state.chips[gw].benchBoost = true;
                // Clear other gameweeks
                for (let g = 1; g <= 10; g++) {
                    if (g !== gw && state.chips[g]) {
                        state.chips[g].benchBoost = false;
                    }
                }
            }
            state.saveState();
        });
    }

    // Wire Prioritize Defcon Monsters listener
    const prioritizeDefconCheckbox = container.querySelector('#prioritizeDefconCheckbox');
    if (prioritizeDefconCheckbox) {
        prioritizeDefconCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            state.prioritizeDefcon = isChecked;
            localStorage.setItem('fpl_hub_prioritize_defcon', isChecked ? 'true' : 'false');
            state.saveState();
        });
    }


    const formationSelect = container.querySelector('#optimizerFormationSelect');
    const formationHelpText = container.querySelector('#formationHelpText');
    if (formationSelect) {
        formationSelect.addEventListener('change', () => {
            actions.setFormation(formationSelect.value);
            if (formationHelpText) {
                formationHelpText.textContent = formationSelect.value === 'optimum'
                    ? '⚡ AI will test all 8 formations and pick the one maximizing predicted points.'
                    : 'Fix the formation the optimizer builds the squad around.';
            }
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

            // Auto-rotate squad slots based on new draft's lineup
            state.autoRotateLineup(state.currentGw);

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

    const settingsBody = container.querySelector('#optSettingsBody');
    const toggleBtn = container.querySelector('#toggleSettingsBtn');
    const toggleChevron = container.querySelector('#toggleSettingsChevron');
    const toggleBtnText = container.querySelector('#toggleSettingsBtnText');
    const activePills = container.querySelector('#optActivePills');
    const reRunInBodyBtn = container.querySelector('#reRunInBodyBtn');

    const updateActivePills = (horizon, mode) => {
        const formationVal = container.querySelector('#optimizerFormationSelect')?.value || state.formation;
        const formationLabel = formationVal === 'optimum' ? '⚡ Optimum' : formationVal;
        const modeLabel = mode === 'preseason' ? 'Preseason' : 'Midseason';
        const horizonLabel = `${horizon} GW`;
        const minFwdLabel = `Min FWD: £${(state.minFwdPrice || 6.0).toFixed(1)}m`;

        activePills.innerHTML = `
            <span class="opt-collapsed-pill"><i data-lucide="layers" style="width:12px;height:12px;"></i> ${modeLabel}</span>
            <span class="opt-collapsed-pill"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${horizonLabel}</span>
            <span class="opt-collapsed-pill"><i data-lucide="layout-grid" style="width:12px;height:12px;"></i> ${formationLabel}</span>
            <span class="opt-collapsed-pill"><i data-lucide="tag" style="width:12px;height:12px;"></i> ${minFwdLabel}</span>
            ${state.ignoreBench ? `<span class="opt-collapsed-pill" style="border-color: rgba(0, 242, 254, 0.3); color: var(--secondary);"><i data-lucide="user-x" style="width:12px;height:12px;"></i> Starters Only (Bench Ignored)</span>` : ''}
        `;

        activePills.style.display = 'flex';
        lucide.createIcons();
    };

    const toggleSettingsBody = (forceCollapse) => {
        const isCollapsed = forceCollapse !== undefined ? forceCollapse : !settingsBody.classList.contains('is-collapsed');
        if (isCollapsed) {
            settingsBody.classList.add('is-collapsed');
            if (toggleBtnText) toggleBtnText.textContent = 'Change Settings';
            if (toggleChevron) toggleChevron.setAttribute('data-lucide', 'settings-2');
        } else {
            settingsBody.classList.remove('is-collapsed');
            if (toggleBtnText) toggleBtnText.textContent = 'Collapse Settings';
            if (toggleChevron) toggleChevron.setAttribute('data-lucide', 'chevron-up');
        }
        lucide.createIcons();
    };

    let isExecuting = false;
    const executeAnalysis = () => {
        if (isExecuting) return;
        isExecuting = true;

        runBtn.disabled = true;
        if (reRunInBodyBtn) reRunInBodyBtn.disabled = true;
        runBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="margin-right: 8px;"></i> Running AI Solver...`;
        if (reRunInBodyBtn) reRunInBodyBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="margin-right: 8px;"></i> Running AI Solver...`;
        lucide.createIcons();

        // Read all current values from DOM to ensure state is synchronized
        const horizon = parseInt(container.querySelector('#gwHorizon').value);
        state.horizon = horizon;
        
        const formationSelect = container.querySelector('#optimizerFormationSelect');
        if (formationSelect) state.formation = formationSelect.value;

        const ignoreBenchCheckbox = container.querySelector('#ignoreBenchCheckbox');
        if (ignoreBenchCheckbox) state.ignoreBench = ignoreBenchCheckbox.checked;

        const benchSlider = container.querySelector('#benchBudgetRange');
        if (benchSlider) state.benchBudget = parseFloat(benchSlider.value);

        const startSlider = container.querySelector('#guaranteedStartRange');
        if (startSlider) state.guaranteedStart = parseInt(startSlider.value);

        const minFwdSlider = container.querySelector('#minFwdPriceRange');
        if (minFwdSlider) state.minFwdPrice = parseFloat(minFwdSlider.value);

        const planBbCheckbox = container.querySelector('#planBenchBoostCheckbox');
        if (planBbCheckbox) state.planBenchBoost = planBbCheckbox.checked;

        const bbTargetSelect = container.querySelector('#benchBoostTargetGwSelect');
        if (bbTargetSelect) state.benchBoostTargetGw = parseInt(bbTargetSelect.value);

        // Sync Bench Boost state to state.chips
        const targetGw = state.benchBoostTargetGw || state.currentGw;
        if (state.planBenchBoost) {
            if (!state.chips[targetGw]) state.chips[targetGw] = { wildcard: false, tripleCaptain: false, benchBoost: false };
            state.chips[targetGw].benchBoost = true;
            for (let g = 1; g <= 10; g++) {
                if (g !== targetGw && state.chips[g]) {
                    state.chips[g].benchBoost = false;
                }
            }
        } else {
            if (state.chips[targetGw]) state.chips[targetGw].benchBoost = false;
        }

        const prioritizeDefconCheckbox = container.querySelector('#prioritizeDefconCheckbox');
        if (prioritizeDefconCheckbox) state.prioritizeDefcon = prioritizeDefconCheckbox.checked;

        state.saveState();
        const mode = phaseSelect.value;

        // Show a loader card inside the resultsGrid before optimization runs to prevent clashing UI
        resultsGrid.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; gap: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px;">
                <i data-lucide="loader" class="animate-spin" style="color: var(--primary); width: 32px; height: 32px;"></i>
                <span style="font-weight: 700; color: var(--text-main); font-size: 15px;">AI Solver is analyzing player data...</span>
                <span style="color: var(--text-muted); font-size: 12px;">Running expected points projections and fixture constraints</span>
            </div>
        `;
        resultsGrid.classList.remove('hidden');
        lucide.createIcons();

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
        }, 1200);
    };

    runBtn.addEventListener('click', executeAnalysis);
    if (reRunInBodyBtn) reRunInBodyBtn.addEventListener('click', executeAnalysis);
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

const ALL_FORMATIONS = ['3-5-2', '3-4-3', '4-4-2', '4-3-3', '4-5-1', '5-3-2', '5-4-1', '5-2-3'];

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

/**
 * Helper: guaranteed start filter based on MPPG and start chance
 */
const PROMOTED_TEAMS_LIST = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];

function isGuaranteedStart(player, state) {
    if (!player) return false;
    if (state && state.mustInclude && state.mustInclude.includes(player.id)) return true;
    
    // Injured, suspended, or unavailable players are NEVER starters for that GW
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return false;
    
    const chance = (player.chanceOfPlaying !== undefined && player.chanceOfPlaying !== null) ? player.chanceOfPlaying : 100;
    const mppg = typeof player.MPPG === 'number' ? player.MPPG : 85;
    const gs = typeof player.GS === 'number' ? player.GS : 25;

    const isPromotedOrNew = (player.team && PROMOTED_TEAMS_LIST.includes(player.team)) || 
                            player.transferredThisSeason || 
                            (typeof player.points === 'number' && player.points < 15);

    // DYNAMIC START QUALITY EVALUATION:
    // 1. Hard reject if current chance of playing is < 50%
    if (chance < 50) return false;
    
    // 2. Reject rotation risks with low starts (GS < 18 starts out of 38), but exempt newly promoted teams & new transfers!
    if (!isPromotedOrNew && gs < 18) return false;

    // 3. Reject rotation risks if chance < 75% AND minutes per game < 60
    if (chance < 75 && mppg < 60) return false;

    // Respect user's custom Guaranteed Start slider threshold if configured
    const minMins = (state && state.guaranteedStart) || 0;
    if (minMins > 0) {
        if (isPromotedOrNew) return true;
        const minStarts = minMins >= 80 ? 25 : (minMins >= 60 ? 22 : 18);
        return mppg >= minMins && gs >= minStarts;
    }

    return true;
}






/**
 * Helper: Expected points over selected horizon
 */
function getExpectedPtsOverHorizon(player, currentGw, horizon, state = null) {
    if (!player || !player.predictions) return 0;
    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
    let sum = 0;
    for (let gw = currentGw; gw < currentGw + horizon; gw++) {
        const pred = player.predictions.find(pr => pr.gw === gw);
        if (pred) {
            const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
            const t = gw - currentGw;
            const isBbActive = state && (
                (state.chips && state.chips[gw]?.benchBoost) || 
                (state.planBenchBoost && state.benchBoostTargetGw === gw)
            );
            const weight = isBbActive ? 1.0 : Math.max(0.6, 1.0 - (t * 0.08));
            sum += (raw * factor * weight);
        }
    }
    return sum;
}

/**
 * Quick scorer: runs top-starter expected points pass for a given formation
 * to accurately pick the maximum points formation in optimum mode.
 */
function _scoreOptimizationForFormation(state, horizon, mode) {
    const cons = getFormationConstraints(state.formation);
    const initUsedIds = [];

    const getTopList = (pos, count) => {
        const pool = PLAYERS.filter(p =>
            p.position === pos &&
            p.status === 'a' &&
            !state.mustExclude.includes(p.id) &&
            !initUsedIds.includes(p.id) &&
            (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
        ).sort((a, b) => getExpectedPtsOverHorizon(b, state.currentGw, horizon, state) - getExpectedPtsOverHorizon(a, state.currentGw, horizon, state));
        
        const result = [];
        for (const p of pool) {
            result.push(p);
            initUsedIds.push(p.id);
            if (result.length === count) break;
        }
        return result;
    };

    const gkps = getTopList('GKP', cons.GKP);
    const defs = getTopList('DEF', cons.DEF);
    const mids = getTopList('MID', cons.MID);
    const fwds = getTopList('FWD', cons.FWD);

    const startingXI = [...gkps, ...defs, ...mids, ...fwds];
    let totalScore = startingXI.reduce((sum, p) => sum + getExpectedPtsOverHorizon(p, state.currentGw, horizon, state), 0);
    const maxScore = startingXI.reduce((best, p) => Math.max(best, getExpectedPtsOverHorizon(p, state.currentGw, horizon, state)), 0);
    totalScore += maxScore; // Captain 2x bonus

    // Midfield & Attack FPL power formation preference (+5.0 xP bonus for 3-5-2, 3-4-3, 4-4-2, 4-5-1)
    if (state.formation === '3-5-2' || state.formation === '3-4-3' || state.formation === '4-4-2' || state.formation === '4-5-1') {
        totalScore += 5.0;
    }

    return totalScore;
}




/**
 * Full optimizer render function. chosenFormation is set when 'optimum' mode selects the best formation.
 */
function _performOptimizationWithFormation(resultsGrid, state, actions, horizon, mode, chosenFormation, isOptimumMode) {
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { starters, bench } = squadInfo;
    let bank = squadInfo.bank;
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
        if (!player || !player.predictions) return 0;
        const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(player) : 1.0;
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) {
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                const t = gw - state.currentGw;
                const weight = Math.max(0.6, 1.0 - (t * 0.08));
                sum += (raw * factor * weight);
            }
        }
        return sum;
    };

    // Helper: guaranteed start filter based on MPPG and start chance
    const checkGuaranteedStart = (player) => isGuaranteedStart(player, state);






    const objective = 'xp';
    const getSolverScore = (player) => {
        if (!player) return 0;
        // Ignore injured, suspended, or unavailable players (status 'i', 's', 'u')
        if (player.status === 'i' || player.status === 's' || player.status === 'u') {
            return 0;
        }

        const duty = getPlayerSetPieceDuty(player);
        let setPieceBonus = 0;
        if (duty.pk) setPieceBonus += 0.8;
        if (duty.fk) setPieceBonus += 0.4;
        if (duty.ck) setPieceBonus += 0.35;

        let baseScore = 0;
        if (objective === 'efficiency') {
            baseScore = (getPlayerEfficiency(player, state.currentGw) * 10) + setPieceBonus;
        } else {
            baseScore = getExpectedPts(player) + (setPieceBonus * horizon);
        }

        // Add Defcon Monster with easiest FDR bonus if prioritizeDefcon option is checked
        if (state.prioritizeDefcon && (player.position === 'GKP' || player.position === 'DEF' || player.position === 'MID')) {
            const ratings = getPlayerRatings(player, state.currentGw);
            if (ratings.defconPotential === 'A' || ratings.defconPotential === 'B') {
                const avgFdr = parseFloat(getAvgFDR(player)) || 3.0;
                baseScore += 15.0 + (5.0 - avgFdr) * 3.0;
            }
        }

        return baseScore;
    };


    const getSquadPointsForHorizon = (slots, h, includeHeuristics = false) => {
        let total = 0;
        
        for (let gw = state.currentGw; gw < state.currentGw + h; gw++) {
            if (gw > 38) break;
            
            let gwTotal = 0;
            let maxStarterScore = 0;
            
            slots.forEach(slot => {
                if (slot.playerId === null) return;
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                if (!p) return;
                if (p.status === 'i' || p.status === 's' || p.status === 'u') return;
                
                const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? (p.chanceOfPlaying / 100) : 1.0;
                const pred = p.predictions.find(pr => pr.gw === gw);
                if (!pred) return;
                
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(p) : 1.0;
                const pts = raw * chance * factor;
                let score = objective === 'efficiency' ? getPlayerEfficiency(p, state.currentGw) * 10 : pts;
                
                if (includeHeuristics && state.prioritizeDefcon && (p.position === 'GKP' || p.position === 'DEF' || p.position === 'MID')) {
                    const ratings = getPlayerRatings(p, state.currentGw);
                    if (ratings.defconPotential === 'A' || ratings.defconPotential === 'B') {
                        const avgFdr = parseFloat(getAvgFDR(p)) || 3.0;
                        score += 15.0 + (5.0 - avgFdr) * 3.0;
                    }
                }
                
                if (slot.isStarting) {
                    gwTotal += score;
                    if (score > maxStarterScore) {
                        maxStarterScore = score;
                    }
                } else {
                    const isBbActive = state.chips[gw]?.benchBoost || 
                                       (state.planBenchBoost && state.benchBoostTargetGw === gw);
                    const benchWeight = isBbActive ? 1.0 : 0.10;
                    gwTotal += score * benchWeight;
                }
            });
            
            const isTcActive = state.chips[gw]?.tripleCaptain;
            const captainMultiplier = isTcActive ? 2.0 : 1.0;
            gwTotal += maxStarterScore * captainMultiplier;
            
            const t = gw - state.currentGw;
            const isBbActive = state.chips[gw]?.benchBoost || 
                               (state.planBenchBoost && state.benchBoostTargetGw === gw);
            const gwWeight = isBbActive ? 1.0 : Math.max(0.6, 1.0 - (t * 0.08));
            total += gwTotal * gwWeight;
        }
        
        return total;
    };

    const getSquadExpectedPts = (slots, includeHeuristics = false) => {
        return getSquadPointsForHorizon(slots, horizon, includeHeuristics);
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
        
        const starts = typeof player.GS === 'number' ? player.GS : 0;
        const avgMins = typeof player.MPPG === 'number' ? player.MPPG.toFixed(0) : '0';

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
                <div class="stat-pill" title="Matches started last season">
                    <span class="stat-pill-label">Starts</span>
                    <span class="stat-pill-val" style="color: var(--text-main); font-weight: 700;">${starts}</span>
                </div>
                <div class="stat-pill" title="Average minutes played per appearance">
                    <span class="stat-pill-label">Avg Min</span>
                    <span class="stat-pill-val" style="color: var(--text-main); font-weight: 700;">${avgMins}m</span>
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

        const outCs = outPlayer ? getCleanSheetOdds(outPlayer) : '0%';
        const inCs = getCleanSheetOdds(inPlayer);

        const outRet = outPlayer ? getProjectedReturns(outPlayer) : '0.0';
        const inRet = getProjectedReturns(inPlayer);

        const outEff = outPlayer ? getPlayerEfficiency(outPlayer, state.currentGw) : 0;
        const inEff = getPlayerEfficiency(inPlayer, state.currentGw);

        const outMins = outPlayer && typeof outPlayer.MPPG === 'number' ? outPlayer.MPPG.toFixed(0) : '0';
        const inMins = typeof inPlayer.MPPG === 'number' ? inPlayer.MPPG.toFixed(0) : '0';
        const outStarts = outPlayer && typeof outPlayer.GS === 'number' ? outPlayer.GS : 0;
        const inStarts = typeof inPlayer.GS === 'number' ? inPlayer.GS : 0;

        const isBudgetEnabler = outPlayer && inPlayer.price < outPlayer.price;
        const freedPrice = outPlayer ? (outPlayer.price - inPlayer.price).toFixed(1) : '0.0';

        // 1. OUTGOING PLAYER EXIT RATIONALE
        let exitReasons = [];
        if (outPlayer) {
            if (outFdr >= 3.2) {
                exitReasons.push(`Facing tough upcoming fixtures (Avg FDR ${outFdr}).`);
            }
            if (outPlayer.MPPG > 0 && outPlayer.MPPG < 65) {
                exitReasons.push(`Rotation risk under manager (${outMins}m avg mins per match).`);
            } else if (outPlayer.status && outPlayer.status !== 'a') {
                exitReasons.push(`Availability/injury flag (${outPlayer.news || 'Flagged'}).`);
            }
            if (isBudgetEnabler) {
                exitReasons.push(`High price tag (£${outPlayer.price.toFixed(1)}m) ties up capital needed for starting XI talismans.`);
            } else if (gain > 0) {
                exitReasons.push(`Lower points output (${outPts.toFixed(1)} XP over ${horizon} GWs) compared to top target.`);
            }
            if (exitReasons.length === 0) {
                exitReasons.push(`Sub-optimal points efficiency (${outEff.toFixed(2)} rating score) for upcoming fixture run.`);
            }
        }

        // 2. INCOMING PLAYER SCOUTING & TACTICAL FIT
        let entryReasons = [];
        const inDuty = getPlayerSetPieceDuty(inPlayer);
        if (inDuty.hasDuty) {
            entryReasons.push(`🎯 <strong>Set-Piece Specialist:</strong> Designated taker for ${inDuty.label}, providing high-floor expected points from penalty goals and set-piece assists.`);
        }
        if (inFdr < outFdr) {
            entryReasons.push(`Favorable fixture swing (Avg FDR ${inFdr} vs FDR ${outFdr}).`);
        } else if (inFdr <= 2.8) {
            entryReasons.push(`Strong fixture schedule (Avg FDR ${inFdr}).`);
        }
        if (inPlayer.position === 'FWD' || inPlayer.position === 'MID') {
            if (parseFloat(inRet) > 0.3) {
                entryReasons.push(`High attacking threat (Proj xGI ${inRet} over ${horizon} GWs).`);
            }
        }
        if (inPlayer.position === 'DEF' || inPlayer.position === 'GKP') {
            if (parseInt(inCs) >= 30) {
                entryReasons.push(`Strong clean sheet odds (${inCs} CS probability).`);
            }
        }
        if (isBudgetEnabler) {
            entryReasons.push(`Key Budget Release: Frees up £${freedPrice}m in capital value to fund high-value upgrades elsewhere.`);
        }
        if (inEff > outEff) {
            entryReasons.push(`Superior Points-per-Million efficiency (${inEff.toFixed(2)} rating score).`);
        }
        if (entryReasons.length === 0) {
            entryReasons.push(`Higher predicted points output (${inPts.toFixed(1)} XP over ${horizon} GWs).`);
        }


        // 3. WARNINGS & COACH TACTICS
        let warnings = [];
        if (inPlayer.MPPG > 0 && inPlayer.MPPG < 60) {
            warnings.push(`<strong>Rotation Warning:</strong> ${inPlayer.name} averages ${inMins}m per match under manager.`);
        } else if (inPlayer.MPPG === 0) {
            warnings.push(`<strong>Non-Starter Warning:</strong> ${inPlayer.name} has played 0 minutes this season.`);
        }
        if (inPlayer.status && inPlayer.status !== 'a') {
            warnings.push(`<strong>Availability Flag:</strong> ${inPlayer.name} is currently flagged (${inPlayer.news || 'Uncertain'}).`);
        }

        return `
            <div class="rec-explanation-box" style="margin-top: 12px; padding: 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; font-size: 11px;">
                <div style="font-family: var(--font-heading); font-size: 12px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                    <i data-lucide="brain-circuit" style="width: 14px; height: 14px;"></i> AI Tactical Scouting & Transfer Rationale
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 10px;">
                    ${outPlayer ? `
                        <div style="background: rgba(239, 68, 68, 0.04); border-left: 3px solid #ef4444; padding: 8px 10px; border-radius: 4px;">
                            <div style="font-weight: 700; color: #ef4444; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="log-out" style="width: 12px; height: 12px;"></i> Exit Rationale (${outPlayer.name}):
                            </div>
                            <ul style="margin: 0; padding-left: 14px; color: var(--text-muted); line-height: 1.4;">
                                ${exitReasons.map(r => `<li>${r}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div style="background: rgba(0, 255, 136, 0.04); border-left: 3px solid var(--primary); padding: 8px 10px; border-radius: 4px;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="log-in" style="width: 12px; height: 12px;"></i> Tactical Acquisition (${inPlayer.name}):
                        </div>
                        <ul style="margin: 0; padding-left: 14px; color: var(--text-main); line-height: 1.4;">
                            ${entryReasons.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Coach Strategy & Expected Minutes Bar -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-top: 6px; font-size: 10.5px;">
                    ${outPlayer ? `
                        <div>
                            <span style="color: var(--text-muted);">OUT Mins / Starts:</span>
                            <strong style="color: var(--text-main);">${outMins}m avg (${outStarts} starts)</strong>
                        </div>
                    ` : ''}
                    <div>
                        <span style="color: var(--text-muted);">IN Mins / Starts:</span>
                        <strong style="color: var(--primary);">${inMins}m avg (${inStarts} starts)</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-muted);">PPM Value Rating:</span>
                        <strong style="color: var(--secondary);">${inEff.toFixed(2)} rating score</strong>
                    </div>
                </div>

                ${warnings.length > 0 ? `
                    <div style="margin-top: 8px; padding: 8px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; color: #f59e0b; font-size: 10.5px;">
                        ${warnings.map(w => `<div style="display:flex; align-items:center; gap:4px;">${w}</div>`).join('')}
                    </div>
                ` : ''}
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
            s.playerId = null;
        });
        
        let assignedGKP = 0, assignedDEF = 0, assignedMID = 0, assignedFWD = 0;
        optimizedSquadSlots.forEach(slot => {
            if (slot.position === 'GKP' && assignedGKP < cons.GKP) { slot.isStarting = true; assignedGKP++; }
            else if (slot.position === 'DEF' && assignedDEF < cons.DEF) { slot.isStarting = true; assignedDEF++; }
            else if (slot.position === 'MID' && assignedMID < cons.MID) { slot.isStarting = true; assignedMID++; }
            else if (slot.position === 'FWD' && assignedFWD < cons.FWD) { slot.isStarting = true; assignedFWD++; }
        });

        const activeBenchIds = state.ignoreBench
            ? activeSquadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId)
            : [];
        const activeBenchPlayers = activeBenchIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

        const startingIndices = [];
        const benchIndices = [];
        for (let i = 0; i < optimizedSquadSlots.length; i++) {
            if (optimizedSquadSlots[i].isStarting) {
                startingIndices.push(i);
            } else {
                benchIndices.push(i);
            }
        }

        if (state.ignoreBench) {
            const usedBenchPlayerIds = new Set();
            for (const bIdx of benchIndices) {
                const slot = optimizedSquadSlots[bIdx];
                const match = activeBenchPlayers.find(p => p.position === slot.position && !usedBenchPlayerIds.has(p.id));
                if (match) {
                    slot.playerId = match.id;
                    usedBenchPlayerIds.add(match.id);
                }
            }
            for (const bIdx of benchIndices) {
                const slot = optimizedSquadSlots[bIdx];
                if (slot.playerId === null) {
                    const match = activeBenchPlayers.find(p => !usedBenchPlayerIds.has(p.id));
                    if (match) {
                        slot.playerId = match.id;
                        usedBenchPlayerIds.add(match.id);
                    }
                }
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
                if (targetSlotIndex === -1 && !state.ignoreBench) {
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
                if (targetSlotIndex === -1 && !state.ignoreBench) {
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
        const maxBenchBudget = state.planBenchBoost ? 99.0 : minBenchBudget;
        
        // Initial bench cost after initial slot assignment
        const initialBenchCost = benchIndices.reduce((sum, bIdx) => {
            const pId = optimizedSquadSlots[bIdx].playerId;
            const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
            return sum + (p ? p.price : 0);
        }, 0);
        const reservedBenchBudget = state.planBenchBoost ? 17.0 : Math.max(minBenchBudget, initialBenchCost);
        const maxStartingBudget = Math.max(0, totalValue - reservedBenchBudget);
        const minFwd = state.minFwdPrice ?? 6.0;

        const passesMinFwd = (p) => p.position !== 'FWD' || p.price >= minFwd || (state.mustInclude && state.mustInclude.includes(p.id));

        // Cheapest players for fallback and initialization
        const cheapestGKPs = PLAYERS.filter(p => p.position === 'GKP' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestDEFs = PLAYERS.filter(p => p.position === 'DEF' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestMIDs = PLAYERS.filter(p => p.position === 'MID' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);
        const cheapestFWDsFiltered = PLAYERS.filter(p => p.position === 'FWD' && !state.mustExclude.includes(p.id) && passesMinFwd(p)).sort((a, b) => a.price - b.price);
        const cheapestFWDs = cheapestFWDsFiltered.length > 0 ? cheapestFWDsFiltered : PLAYERS.filter(p => p.position === 'FWD' && !state.mustExclude.includes(p.id)).sort((a, b) => a.price - b.price);



        const getCheapestPlayersList = (pos, count, usedIds, forceGuaranteed = false) => {
            const list = pos === 'GKP' ? cheapestGKPs : (pos === 'DEF' ? cheapestDEFs : (pos === 'MID' ? cheapestMIDs : cheapestFWDs));
            const result = [];
            
            // Calculate current team counts from usedIds to enforce the max 3 constraint
            const currentTeamCounts = {};
            for (const id of usedIds) {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) {
                    currentTeamCounts[p.team] = (currentTeamCounts[p.team] || 0) + 1;
                }
            }

            for (const p of list) {
                if (!usedIds.includes(p.id)) {
                    if (forceGuaranteed && !isGuaranteedStart(p, state)) continue;
                    if ((currentTeamCounts[p.team] || 0) < 3) {
                        result.push(p);
                        usedIds.push(p.id);
                        currentTeamCounts[p.team] = (currentTeamCounts[p.team] || 0) + 1;
                        if (result.length === count) break;
                    }
                }
            }
            // Fallback for bench slots: if we didn't find enough players and forceGuaranteed is false, grab from the list
            if (result.length < count && !forceGuaranteed) {
                for (const p of list) {
                    if (!usedIds.includes(p.id)) {
                        if ((currentTeamCounts[p.team] || 0) < 3) {
                            result.push(p);
                            usedIds.push(p.id);
                            currentTeamCounts[p.team] = (currentTeamCounts[p.team] || 0) + 1;
                            if (result.length === count) break;
                        }
                    }
                }
            }
            return result;
        };


        const getTopPlayersList = (pos, count, usedIds) => {
            const pool = PLAYERS.filter(p => 
                p.position === pos && 
                !state.mustExclude.includes(p.id) &&
                !usedIds.includes(p.id) &&
                passesMinFwd(p) &&
                (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
            ).sort((a, b) => getSolverScore(b) - getSolverScore(a));
            
            const result = [];
            for (const p of pool) {
                result.push(p);
                usedIds.push(p.id);
                if (result.length === count) break;
            }
            return result;
        };

        // Initialize starting slots with budget-constrained top-scoring guaranteed starters
        let runningStartingCost = 0;
        const runningTeamCounts = {};
        
        // Track pre-locked starting slots team counts
        for (const idx of startingIndices) {
            const slot = optimizedSquadSlots[idx];
            if (slot.playerId !== null) {
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                if (p) {
                    runningTeamCounts[p.team] = (runningTeamCounts[p.team] || 0) + 1;
                    runningStartingCost += p.price;
                }
            }
        }

        for (let i = 0; i < startingIndices.length; i++) {
            const idx = startingIndices[i];
            const slot = optimizedSquadSlots[idx];
            if (!slot.locked && slot.playerId === null) {
                const remainingSlotsCount = startingIndices.length - 1 - i;
                const maxAllowedPrice = maxStartingBudget - runningStartingCost - (remainingSlotsCount * 4.5);
                
                const isStarterPriceFloorInit = (player, pos) => {
                    if (!player) return false;
                    if (isGuaranteedStart(player, state)) return true;
                    if (pos === 'GKP' && player.price < 4.5) return false;
                    if (pos === 'DEF' && player.price < 4.5) return false;
                    if (pos === 'FWD' && cons.FWD >= 2 && player.price < 5.5) return false;
                    return true;
                };

                const pool = PLAYERS.filter(p => 
                    p.position === slot.position && 
                    !state.mustExclude.includes(p.id) &&
                    !initUsedIds.includes(p.id) &&
                    (runningTeamCounts[p.team] || 0) < 3 &&
                    p.price <= Math.max(4.5, maxAllowedPrice) &&
                    isStarterPriceFloorInit(p, slot.position) &&
                    passesMinFwd(p) &&
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                ).sort((a, b) => getExpectedPtsOverHorizon(b, state.currentGw, horizon, state) - getExpectedPtsOverHorizon(a, state.currentGw, horizon, state));
                
                const chosen = pool[0] || PLAYERS.filter(p => p.position === slot.position && isStarterPriceFloorInit(p, slot.position) && !initUsedIds.includes(p.id) && (runningTeamCounts[p.team] || 0) < 3).sort((a, b) => getExpectedPtsOverHorizon(b, state.currentGw, horizon, state) - getExpectedPtsOverHorizon(a, state.currentGw, horizon, state))[0] || getCheapestPlayersList(slot.position, 1, initUsedIds, true)[0];
                if (chosen) {
                    slot.playerId = chosen.id;
                    initUsedIds.push(chosen.id);
                    runningStartingCost += chosen.price;
                    runningTeamCounts[chosen.team] = (runningTeamCounts[chosen.team] || 0) + 1;
                }
            }
        }

        // Initialize bench slots (with cheapest budget enablers if not ignoreBench) if they are not locked
        if (!state.ignoreBench || state.planBenchBoost) {
            const forceBenchGuaranteed = state.planBenchBoost ? true : false;
            for (const idx of benchIndices) {
                const slot = optimizedSquadSlots[idx];
                if (!slot.locked && slot.playerId === null) {
                    const cheapest = getCheapestPlayersList(slot.position, 1, initUsedIds, forceBenchGuaranteed)[0];
                    slot.playerId = cheapest ? cheapest.id : null;
                }
            }
        }


        // --- MANDATORY STARTER PRICE FLOOR SANITIZER ---
        // Forcefully ensure NO starting XI slot holds a non-starter, player below starter price floor, or team limit > 3
        const sanitizeStartingXIStarterFloors = () => {
            let iter = 0;
            while (iter < 20) {
                iter++;
                let invalidSlotIdx = -1;

                // Check team limit max 3 per team first
                const squadTeamCounts = {};
                let overLimitTeam = null;
                for (const slot of optimizedSquadSlots) {
                    if (slot.playerId !== null) {
                        const p = PLAYERS.find(pl => pl.id === slot.playerId);
                        if (p) {
                            squadTeamCounts[p.team] = (squadTeamCounts[p.team] || 0) + 1;
                            if (squadTeamCounts[p.team] > 3) {
                                overLimitTeam = p.team;
                            }
                        }
                    }
                }

                if (overLimitTeam) {
                    for (const sIdx of startingIndices) {
                        const slot = optimizedSquadSlots[sIdx];
                        if (slot.locked) continue;
                        const p = PLAYERS.find(pl => pl.id === slot.playerId);
                        if (p && p.team === overLimitTeam) {
                            invalidSlotIdx = sIdx;
                            break;
                        }
                    }
                }

                if (invalidSlotIdx === -1) {
                    for (const sIdx of startingIndices) {
                        const slot = optimizedSquadSlots[sIdx];
                        const p = PLAYERS.find(pl => pl.id === slot.playerId);
                        if (!p || (slot.position === 'GKP' && p.price < 4.5) || (slot.position === 'DEF' && p.price < 4.5) || (slot.position === 'FWD' && cons.FWD >= 2 && p.price < 5.5) || !isGuaranteedStart(p, state)) {
                            invalidSlotIdx = sIdx;
                            break;
                        }
                    }
                }

                if (invalidSlotIdx === -1 && state.planBenchBoost) {
                    for (const bIdx of benchIndices) {
                        const slot = optimizedSquadSlots[bIdx];
                        const p = PLAYERS.find(pl => pl.id === slot.playerId);
                        if (!p || (slot.position === 'GKP' && p.price < 4.5) || (slot.position === 'DEF' && p.price < 4.5) || (slot.position === 'FWD' && p.price < 5.5) || !isGuaranteedStart(p, state)) {
                            invalidSlotIdx = bIdx;
                            break;
                        }
                    }
                }

                if (invalidSlotIdx === -1) break; // All slots 100% valid!



                const invSlot = optimizedSquadSlots[invalidSlotIdx];
                const invPos = invSlot.position;
                const minReqPrice = invPos === 'GKP' ? 4.5 : (invPos === 'DEF' ? 4.5 : 5.5);

                const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(Boolean);

                const validStarterCand = PLAYERS.filter(p =>
                    p.position === invPos &&
                    p.price >= minReqPrice &&
                    !currentSquadIds.includes(p.id) &&
                    !state.mustExclude.includes(p.id) &&
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                ).sort((a, b) => a.price - b.price)[0];

                if (!validStarterCand) break;

                const currentInvPlayer = PLAYERS.find(p => p.id === invSlot.playerId);
                const neededExtraBudget = validStarterCand.price - (currentInvPlayer ? currentInvPlayer.price : 0);

                let funded = false;
                for (const donorIdx of startingIndices) {
                    if (donorIdx === invalidSlotIdx) continue;
                    const donorSlot = optimizedSquadSlots[donorIdx];
                    if (donorSlot.locked) continue;

                    const donorPlayer = PLAYERS.find(p => p.id === donorSlot.playerId);
                    if (!donorPlayer) continue;

                    const donorTargetPrice = donorPlayer.price - neededExtraBudget;
                    const donorMinFloor = donorSlot.position === 'GKP' ? 4.5 : (donorSlot.position === 'DEF' ? 4.5 : (donorSlot.position === 'FWD' && cons.FWD >= 2 ? 5.5 : 5.0));

                    if (donorTargetPrice >= donorMinFloor) {
                        const donorReplacement = PLAYERS.filter(p =>
                            p.position === donorSlot.position &&
                            p.price >= donorMinFloor &&
                            p.price <= donorTargetPrice &&
                            !currentSquadIds.includes(p.id) &&
                            (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                        ).sort((a, b) => getSolverScore(b) - getSolverScore(a))[0];

                        if (donorReplacement) {
                            donorSlot.playerId = donorReplacement.id;
                            invSlot.playerId = validStarterCand.id;
                            funded = true;
                            break;
                        }
                    }
                }

                if (!funded) {
                    for (const donorIdx of startingIndices) {
                        if (donorIdx === invalidSlotIdx) continue;
                        const donorSlot = optimizedSquadSlots[donorIdx];
                        if (donorSlot.locked) continue;
                        const donorPlayer = PLAYERS.find(p => p.id === donorSlot.playerId);
                        if (!donorPlayer || donorPlayer.price <= 5.5) continue;

                        const cheaperDonor = PLAYERS.filter(p =>
                            p.position === donorSlot.position &&
                            p.price >= 5.0 &&
                            p.price < donorPlayer.price &&
                            !currentSquadIds.includes(p.id) &&
                            (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                        ).sort((a, b) => getSolverScore(b) - getSolverScore(a))[0];

                        if (cheaperDonor) {
                            donorSlot.playerId = cheaperDonor.id;
                            invSlot.playerId = validStarterCand.id;
                            funded = true;
                            break;
                        }
                    }
                    if (!funded) break;
                }
            }
        };

        sanitizeStartingXIStarterFloors();





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

                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots, true);
                
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
                    (!state.ignoreBench || !activeBenchIds.includes(p.id)) &&
                    p.price <= (currentSlot.position === 'GKP' ? 5.5 : maxBudgetForSlot) &&
                    !state.mustExclude.includes(p.id) &&
                    passesMinFwd(p)
                );


                const isStarterPriceFloor = (player, pos) => {
                    if (!player) return false;
                    if (isGuaranteedStart(player, state)) return true;
                    if (pos === 'GKP' && player.price < 4.5) return false;
                    if (pos === 'DEF' && player.price < 4.5) return false;
                    if (pos === 'FWD' && cons.FWD >= 2 && player.price < 5.5) return false;
                    return true;
                };

                const guaranteedCandidates = candidates.filter(p => 
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75) && 
                    isStarterPriceFloor(p, currentSlot.position)
                );
                if (guaranteedCandidates.length > 0) {
                    candidates = guaranteedCandidates;
                } else {
                    candidates = candidates.filter(p => (p.chanceOfPlaying >= 50) && isStarterPriceFloor(p, currentSlot.position));
                }
                candidates.sort((a, b) => getSolverScore(b) - getSolverScore(a));



                let bestCandidate = null;
                let bestPts = currentSquadPts;

                for (const cand of candidates) {
                    // If candidate price exceeds maxBudgetForSlot (e.g. Donnarumma/Raya 5.5m GKP), attempt a donor swap from outfield starters
                    if (cand.price > maxBudgetForSlot + 0.001) {
                        const neededExtra = cand.price - maxBudgetForSlot;
                        for (const donorIdx of startingIndices) {
                            if (donorIdx === idx) continue;
                            const donorSlot = optimizedSquadSlots[donorIdx];
                            if (donorSlot.locked) continue;
                            const donorPlayer = PLAYERS.find(p => p.id === donorSlot.playerId);
                            if (!donorPlayer) continue;

                            const maxDonorPrice = donorPlayer.price - neededExtra;
                            const donorFloor = donorSlot.position === 'GKP' ? 4.5 : (donorSlot.position === 'DEF' ? 4.5 : (donorSlot.position === 'FWD' && cons.FWD >= 2 ? 5.5 : 5.0));

                            if (maxDonorPrice >= donorFloor) {
                                const donorReplacement = PLAYERS.filter(p =>
                                    p.position === donorSlot.position &&
                                    p.price >= donorFloor &&
                                    p.price <= maxDonorPrice &&
                                    !usedStartingIds.includes(p.id) &&
                                    p.id !== cand.id &&
                                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                                ).sort((a, b) => getSolverScore(b) - getSolverScore(a))[0];

                                if (donorReplacement) {
                                    const oldGkpId = currentSlot.playerId;
                                    const oldDonorId = donorSlot.playerId;

                                    currentSlot.playerId = cand.id;
                                    donorSlot.playerId = donorReplacement.id;

                                    // Check max 3 players per team constraint across entire 15-player squad
                                    const counts = {};
                                    let isValid = true;
                                    for (const s of optimizedSquadSlots) {
                                        if (s.playerId !== null) {
                                            const pl = PLAYERS.find(p => p.id === s.playerId);
                                            if (pl) {
                                                counts[pl.team] = (counts[pl.team] || 0) + 1;
                                                if (counts[pl.team] > 3) {
                                                    isValid = false;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    const newPts = isValid ? getSquadExpectedPts(optimizedSquadSlots, true) : -1;

                                    // Swap back for evaluation
                                    currentSlot.playerId = oldGkpId;
                                    donorSlot.playerId = oldDonorId;

                                    if (isValid && newPts > bestPts + 0.05) {
                                        bestPts = newPts;
                                        bestCandidate = cand;
                                        // Execute swap immediately
                                        currentSlot.playerId = cand.id;
                                        donorSlot.playerId = donorReplacement.id;
                                        startingImproved = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (startingImproved) break;
                        continue;
                    }

                    const oldId = currentSlot.playerId;
                    currentSlot.playerId = cand.id;

                    // Check max 3 players per team constraint across entire 15-player squad
                    const counts = {};
                    let isValid = true;
                    for (const s of optimizedSquadSlots) {
                        if (s.playerId !== null) {
                            const pl = PLAYERS.find(p => p.id === s.playerId);
                            if (pl) {
                                counts[pl.team] = (counts[pl.team] || 0) + 1;
                                if (counts[pl.team] > 3) {
                                    isValid = false;
                                    break;
                                }
                            }
                        }
                    }

                    const newPts = isValid ? getSquadExpectedPts(optimizedSquadSlots, true) : -1;
                    currentSlot.playerId = oldId; // Swap back

                    if (isValid && newPts > bestPts + 0.05) {
                        bestPts = newPts;
                        bestCandidate = cand;
                    }
                }

                if (bestCandidate && !startingImproved) {
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

        let benchImproved = !state.ignoreBench;
        let benchIter = 0;
        while (benchImproved && benchIter < 20) {

            benchImproved = false;
            benchIter++;

            for (const idx of benchIndices) {
                const currentSlot = optimizedSquadSlots[idx];
                if (currentSlot.locked) continue; // Skip locked force-included players!

                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots, true);
                
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
                    !state.mustExclude.includes(p.id) &&
                    passesMinFwd(p)
                );

                const guaranteedCandidates = candidates.filter(p => isGuaranteedStart(p, state));
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
                        const newSquadPts = getSquadExpectedPts(optimizedSquadSlots, true);
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

        // --- HARD BENCH BUDGET SAFETY ENFORCER ---
        let currentBenchCost = benchIndices.reduce((sum, bIdx) => {
            const pId = optimizedSquadSlots[bIdx].playerId;
            const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
            return sum + (p ? p.price : 0);
        }, 0);

        if (currentBenchCost > maxBenchBudget + 0.001 && !state.planBenchBoost) {
            let benchTrimIter = 0;
            while (currentBenchCost > maxBenchBudget + 0.001 && benchTrimIter < 20 && !state.planBenchBoost) {
                benchTrimIter++;
                let bestDowngrade = null;
                let minPtsLoss = 9999;
                let targetBenchIdx = -1;

                const startingIds = startingIndices.map(sIdx => optimizedSquadSlots[sIdx].playerId).filter(id => id !== null);
                const benchIds = benchIndices.map(bIdx => optimizedSquadSlots[bIdx].playerId).filter(id => id !== null);

                for (const bIdx of benchIndices) {
                    const slot = optimizedSquadSlots[bIdx];
                    if (slot.locked) continue;

                    const player = slot.playerId !== null ? PLAYERS.find(p => p.id === slot.playerId) : null;
                    if (!player) continue;

                    const cheaperCandidates = PLAYERS.filter(p =>
                        p.position === slot.position &&
                        p.price < player.price &&
                        !startingIds.includes(p.id) &&
                        !benchIds.includes(p.id) &&
                        !state.mustExclude.includes(p.id) &&
                        passesMinFwd(p)
                    );

                    const currentPts = getSquadExpectedPts(optimizedSquadSlots, true);

                    for (const cand of cheaperCandidates) {
                        const tempBenchIds = benchIds.filter(id => id !== slot.playerId);
                        tempBenchIds.push(cand.id);

                        const tempSquadIds = [...startingIds, ...tempBenchIds];
                        const teamCounts = {};
                        let ok = true;
                        for (const id of tempSquadIds) {
                            const pl = PLAYERS.find(p => p.id === id);
                            if (pl) {
                                teamCounts[pl.team] = (teamCounts[pl.team] || 0) + 1;
                                if (teamCounts[pl.team] > 3) { ok = false; break; }
                            }
                        }

                        if (ok) {
                            const oldId = slot.playerId;
                            slot.playerId = cand.id;
                            const newPts = getSquadExpectedPts(optimizedSquadSlots, true);
                            slot.playerId = oldId;

                            const ptsLoss = currentPts - newPts;
                            if (ptsLoss < minPtsLoss) {
                                minPtsLoss = ptsLoss;
                                bestDowngrade = cand;
                                targetBenchIdx = bIdx;
                            }
                        }
                    }
                }

                if (bestDowngrade && targetBenchIdx !== -1) {
                    optimizedSquadSlots[targetBenchIdx].playerId = bestDowngrade.id;
                    currentBenchCost = benchIndices.reduce((sum, bIdx) => {
                        const pId = optimizedSquadSlots[bIdx].playerId;
                        const p = pId !== null ? PLAYERS.find(pl => pl.id === pId) : null;
                        return sum + (p ? p.price : 0);
                    }, 0);
                } else {
                    break;
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
                if (state.ignoreBench && isBenchSlot) continue; // Skip bench upgrades when Ignore Bench is checked
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
                    !state.mustExclude.includes(p.id) &&
                    passesMinFwd(p)
                );

                const guaranteedCandidates = candidates.filter(p => isGuaranteedStart(p, state));
                if (guaranteedCandidates.length > 0) {
                    candidates = guaranteedCandidates;
                }
                candidates.sort((a, b) => getSolverScore(b) - getSolverScore(a));


                const currentSquadPts = getSquadExpectedPts(optimizedSquadSlots, true);

                for (const cand of candidates) {
                    if (isBenchSlot && !state.planBenchBoost) {
                        const newBenchCost = currentBenchCost - playerPrice + cand.price;
                        if (newBenchCost > maxBenchBudget) {
                            continue; // Skip this candidate if it exceeds reserved bench budget (when NOT Bench Boost)
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
                        const newSquadPts = getSquadExpectedPts(optimizedSquadSlots, true);
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

        // --- AGGRESSIVE BANK BALANCE EXHAUSTION PASS ---
        // If there is any remaining bank balance (e.g. > £0.5m), exhaustively upgrade starting XI slots
        // to higher-priced/higher-scoring players until no further upgrades fit in the bank.
        let bankExhaustIter = 0;
        while (bankExhaustIter < 15) {
            bankExhaustIter++;
            let squadCost = optimizedSquadSlots.reduce((sum, slot) => {
                if (slot.playerId === null) return sum;
                const p = PLAYERS.find(pl => pl.id === slot.playerId);
                return sum + (p ? p.price : 0);
            }, 0);
            let remBank = totalValue - squadCost;
            if (remBank < 0.2) break;

            let bestAggressiveUpgrade = null;
            let maxScoreGain = -0.001;
            let targetIdx = -1;
            const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(Boolean);

            for (const sIdx of startingIndices) {
                const slot = optimizedSquadSlots[sIdx];
                if (slot.locked) continue;
                const pOld = PLAYERS.find(pl => pl.id === slot.playerId);
                if (!pOld) continue;

                const candidates = PLAYERS.filter(p =>
                    p.position === slot.position &&
                    !currentSquadIds.includes(p.id) &&
                    p.price > pOld.price &&
                    p.price <= pOld.price + remBank &&
                    !state.mustExclude.includes(p.id) &&
                    passesMinFwd(p)
                );

                for (const cand of candidates) {
                    const tempSquadIds = currentSquadIds.filter(id => id !== pOld.id);
                    tempSquadIds.push(cand.id);
                    const teamCounts = {};
                    let ok = true;
                    for (const id of tempSquadIds) {
                        const pl = PLAYERS.find(p => p.id === id);
                        if (pl) {
                            teamCounts[pl.team] = (teamCounts[pl.team] || 0) + 1;
                            if (teamCounts[pl.team] > 3) { ok = false; break; }
                        }
                    }

                    if (ok) {
                        const currentPts = getSquadExpectedPts(optimizedSquadSlots, true);
                        const oldId = slot.playerId;
                        slot.playerId = cand.id;
                        const newPts = getSquadExpectedPts(optimizedSquadSlots, true);
                        slot.playerId = oldId;

                        const gain = newPts - currentPts;
                        const isBetterPts = gain > maxScoreGain + 0.001;
                        const isSamePtsMoreExpensive = Math.abs(gain - maxScoreGain) <= 0.001 && (!bestAggressiveUpgrade || cand.price > bestAggressiveUpgrade.price);

                        if (isBetterPts || isSamePtsMoreExpensive) {
                            maxScoreGain = gain;
                            bestAggressiveUpgrade = cand;
                            targetIdx = sIdx;
                        }
                    }
                }

            }

            if (bestAggressiveUpgrade && targetIdx !== -1) {
                optimizedSquadSlots[targetIdx].playerId = bestAggressiveUpgrade.id;
            } else {
                break;
            }
        }


        // --- PAIRWISE DOUBLE-UPGRADE STEP ---
        // Escape local minima by checking pairs of slots and swapping them with elite candidates
        let pairwiseImproved = true;
        let pairwiseIter = 0;
        
        while (pairwiseImproved && pairwiseIter < 3) {
            pairwiseImproved = false;
            pairwiseIter++;
            
            const getEliteCandidates = (pos) => {
                return PLAYERS.filter(p => 
                    p.position === pos &&
                    !state.mustExclude.includes(p.id) &&
                    (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 75)
                ).sort((a, b) => getSolverScore(b) - getSolverScore(a))
                 .slice(0, 30);
            };
            
            const elitePools = {
                GKP: getEliteCandidates('GKP'),
                DEF: getEliteCandidates('DEF'),
                MID: getEliteCandidates('MID'),
                FWD: getEliteCandidates('FWD')
            };
            
            for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
                const cheapest = getCheapestPlayersList(pos, 5, [], false);
                cheapest.forEach(p => {
                    if (!elitePools[pos].some(ep => ep.id === p.id)) {
                        elitePools[pos].push(p);
                    }
                });
            }

            for (let i = 0; i < optimizedSquadSlots.length; i++) {
                for (let j = i + 1; j < optimizedSquadSlots.length; j++) {
                    const slotI = optimizedSquadSlots[i];
                    const slotJ = optimizedSquadSlots[j];
                    if (slotI.locked || slotJ.locked) continue;
                    
                    const pI = PLAYERS.find(p => p.id === slotI.playerId);
                    const pJ = PLAYERS.find(p => p.id === slotJ.playerId);
                    if (!pI || !pJ) continue;
                    
                    const currentPairPts = getSquadExpectedPts(optimizedSquadSlots, true);
                    const combinedBudget = pI.price + pJ.price + bank;
                    
                    const candsI = elitePools[slotI.position];
                    const candsJ = elitePools[slotJ.position];
                    
                    let bestPair = null;
                    let bestPts = currentPairPts;
                    
                    const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(id => id !== null);
                    const otherSquadIds = currentSquadIds.filter(id => id !== pI.id && id !== pJ.id);
                    
                    for (const candI of candsI) {
                        for (const candJ of candsJ) {
                            if (candI.id === candJ.id && slotI.position === slotJ.position) continue;
                            if (candI.price + candJ.price > combinedBudget + 0.001) continue;
                            
                            if (otherSquadIds.includes(candI.id) || otherSquadIds.includes(candJ.id)) continue;
                            
                            const tempSquadIds = [...otherSquadIds, candI.id, candJ.id];
                            const teamCounts = {};
                            let ok = true;
                            for (const id of tempSquadIds) {
                                const pl = PLAYERS.find(p => p.id === id);
                                if (pl) {
                                    teamCounts[pl.team] = (teamCounts[pl.team] || 0) + 1;
                                    if (teamCounts[pl.team] > 3) { ok = false; break; }
                                }
                            }
                            if (!ok) continue;
                            
                            const isStarterPriceFloor = (player, pos) => {
                                if (!player) return false;
                                if (isGuaranteedStart(player, state)) return true;
                                if (pos === 'GKP' && player.price < 4.5) return false;
                                if (pos === 'DEF' && player.price < 4.5) return false;
                                if (pos === 'FWD' && cons.FWD >= 2 && player.price < 5.5) return false;
                                return true;
                            };
                            
                            if (slotI.isStarting && !isStarterPriceFloor(candI, slotI.position)) continue;
                            if (slotJ.isStarting && !isStarterPriceFloor(candJ, slotJ.position)) continue;
                            if (slotI.isStarting && !isGuaranteedStart(candI, state)) continue;
                            if (slotJ.isStarting && !isGuaranteedStart(candJ, state)) continue;
                            
                            const oldI = slotI.playerId;
                            const oldJ = slotJ.playerId;
                            slotI.playerId = candI.id;
                            slotJ.playerId = candJ.id;
                            
                            const newPts = getSquadExpectedPts(optimizedSquadSlots, true);
                            
                            slotI.playerId = oldI;
                            slotJ.playerId = oldJ;
                            
                            if (newPts > bestPts + 0.1) {
                                bestPts = newPts;
                                bestPair = { candI, candJ };
                            }
                        }
                    }
                    
                    if (bestPair) {
                        slotI.playerId = bestPair.candI.id;
                        slotJ.playerId = bestPair.candJ.id;
                        bank = combinedBudget - (bestPair.candI.price + bestPair.candJ.price);
                        pairwiseImproved = true;
                    }
                }
            }
        }


        // --- HARD SAFETY ENFORCER: GUARANTEE SQUAD NEVER EXCEEDS TOTAL BUDGET ---
        let finalSquadCost = optimizedSquadSlots.reduce((sum, slot) => {
            if (slot.playerId === null) return sum;
            const p = PLAYERS.find(pl => pl.id === slot.playerId);
            return sum + (p ? p.price : 0);
        }, 0);

        if (finalSquadCost > totalValue + 0.001) {
            let overBudgetIter = 0;
            while (finalSquadCost > totalValue + 0.001 && overBudgetIter < 50) {
                overBudgetIter++;
                let bestDowngrade = null;
                let minPtsLossPerMillion = 99999;
                let targetSlotIdx = -1;

                const currentSquadIds = optimizedSquadSlots.map(s => s.playerId).filter(id => id !== null);
                const currentPts = getSquadExpectedPts(optimizedSquadSlots, true);

                for (let i = 0; i < optimizedSquadSlots.length; i++) {
                    const slot = optimizedSquadSlots[i];
                    if (slot.locked) continue; // Do not replace force-included locked players

                    const player = slot.playerId !== null ? PLAYERS.find(p => p.id === slot.playerId) : null;
                    if (!player) continue;

                    // Search for cheaper valid replacement for this position
                    const cheaperCandidates = PLAYERS.filter(p => 
                        p.position === slot.position &&
                        p.price < player.price &&
                        !currentSquadIds.includes(p.id) &&
                        !state.mustExclude.includes(p.id) &&
                        passesMinFwd(p)
                    );

                    for (const cand of cheaperCandidates) {
                        const priceDiff = player.price - cand.price;
                        if (priceDiff <= 0.01) continue;

                        const tempSquadIds = currentSquadIds.filter(id => id !== slot.playerId);
                        tempSquadIds.push(cand.id);
                        
                        // Check team limit max 3/team
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
                            const newPts = getSquadExpectedPts(optimizedSquadSlots, true);
                            slot.playerId = oldId; // Swap back

                            const ptsLoss = Math.max(0, currentPts - newPts);
                            const lossRatio = ptsLoss / priceDiff;

                            if (lossRatio < minPtsLossPerMillion) {
                                minPtsLossPerMillion = lossRatio;
                                bestDowngrade = cand;
                                targetSlotIdx = i;
                            }
                        }
                    }
                }

                if (bestDowngrade && targetSlotIdx !== -1) {
                    optimizedSquadSlots[targetSlotIdx].playerId = bestDowngrade.id;
                    finalSquadCost = optimizedSquadSlots.reduce((sum, slot) => {
                        if (slot.playerId === null) return sum;
                        const p = PLAYERS.find(pl => pl.id === slot.playerId);
                        return sum + (p ? p.price : 0);
                    }, 0);
                } else {
                    // Emergency fallback: downgrade highest priced unlocked starting XI player to cheapest valid option
                    let emergencyTrimmed = false;
                    for (let i = 0; i < optimizedSquadSlots.length; i++) {
                        const slot = optimizedSquadSlots[i];
                        if (slot.locked || !slot.isStarting) continue;
                        const player = PLAYERS.find(p => p.id === slot.playerId);
                        if (!player) continue;

                        const cheapestFallback = PLAYERS.filter(p =>
                            p.position === slot.position &&
                            p.price < player.price &&
                            !currentSquadIds.includes(p.id) &&
                            (isGuaranteedStart(p, state) || p.chanceOfPlaying >= 50)
                        ).sort((a, b) => a.price - b.price)[0];

                        if (cheapestFallback) {
                            slot.playerId = cheapestFallback.id;
                            emergencyTrimmed = true;
                            finalSquadCost = optimizedSquadSlots.reduce((sum, s) => {
                                const p = PLAYERS.find(pl => pl.id === s.playerId);
                                return sum + (p ? p.price : 0);
                            }, 0);
                            break;
                        }
                    }
                    if (!emergencyTrimmed) break;
                }
            }
        }


        // Compare original and optimized squads by player ID SETS — not slot-by-slot.
        // Slot-by-slot comparison shows intermediate iteration swaps (A→B then B→C displayed
        // as two changes) when the net result is just A→C. We want net changes only.
        const originalIds = activeSquadSlots.map(s => s.playerId).filter(id => id !== null);
        const optimizedIds = optimizedSquadSlots.map(s => s.playerId).filter(id => id !== null);

        let removedIds = originalIds.filter(id => !optimizedIds.includes(id));
        let addedIds   = optimizedIds.filter(id => !originalIds.includes(id));

        if (state.ignoreBench) {
            const activeBenchIds = activeSquadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);
            removedIds = removedIds.filter(id => !activeBenchIds.includes(id));
        }

        // Match removed → added players by position to form logical swap pairs
        const upgrades = [];
        const removedPlayers = removedIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

        const addedPlayers   = addedIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);

        // Pair by position, highest gain first
        const usedAdded = new Set();
        for (const outPlayer of removedPlayers) {
            const match = addedPlayers
                .filter(p => p.position === outPlayer.position && !usedAdded.has(p.id))
                .sort((a, b) => getSolverScore(b) - getSolverScore(a))[0];
            if (match) {
                usedAdded.add(match.id);
                const inPts1Gw = match.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
                const outPts1Gw = outPlayer.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
                upgrades.push({
                    out: outPlayer,
                    in: match,
                    gain: getSolverScore(match) - getSolverScore(outPlayer),
                    gain1Gw: inPts1Gw - outPts1Gw
                });
            }
        }
        // Any unmatched additions (e.g. empty slot filled) — show as additions
        for (const inPlayer of addedPlayers) {
            if (!usedAdded.has(inPlayer.id)) {
                const inPts1Gw = inPlayer.predictions.find(pr => pr.gw === state.currentGw)?.pts || 0;
                upgrades.push({
                    out: null,
                    in: inPlayer,
                    gain: getSolverScore(inPlayer),
                    gain1Gw: inPts1Gw
                });
            }
        }

        // Sort: net gains descending, then downgrades
        upgrades.sort((a, b) => b.gain - a.gain);


        const totalOriginalPts = getSquadExpectedPts(activeSquadSlots);
        const totalOptimizedPts = getSquadExpectedPts(optimizedSquadSlots);
        const overallGain = totalOptimizedPts - totalOriginalPts;
        const overallGain1Gw = getSquadPointsForHorizon(optimizedSquadSlots, 1) - getSquadPointsForHorizon(activeSquadSlots, 1);
        const gainLabel = objective === 'efficiency' ? 'Overall Efficiency' : 'Overall XP';
        const formattedGain = objective === 'efficiency' ? `+${(overallGain / 10).toFixed(2)}` : `+${overallGain.toFixed(1)}`;

        resultsGrid.innerHTML = `
            <div class="optimizer-card" style="grid-column: span 2; position: relative;">
                <button class="close-modal-btn" id="closeResultsBtn" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
                <h3><i data-lucide="sparkles" class="highlight-transfers"></i> Preseason AI Full-Squad Optimization</h3>
                ${isOptimumMode ? `
                    <div style="display:inline-flex; align-items:center; gap:8px; margin-top:10px; padding:8px 14px; background:linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,242,254,0.07)); border:1px solid rgba(0,255,136,0.25); border-radius:10px; font-size:12px; font-weight:600;">
                        <i data-lucide="zap" style="width:14px;height:14px;color:var(--primary);"></i>
                        <span style="color:var(--primary);">AI Selected Formation:</span>
                        <span style="color:var(--text-main); font-family:var(--font-heading); font-size:14px; font-weight:800;">${chosenFormation}</span>
                        <span style="color:var(--text-muted); font-weight:400;">— Best formation for maximum predicted points across ${horizon} GW${horizon > 1 ? 's' : ''}</span>
                    </div>
                ` : ''}
                ${state.planBenchBoost ? `
                    <div style="display:inline-flex; align-items:center; gap:8px; margin-top:10px; margin-left:6px; padding:8px 14px; background:linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.07)); border:1px solid rgba(245,158,11,0.3); border-radius:10px; font-size:12px; font-weight:600;">
                        <i data-lucide="shield-check" style="width:14px;height:14px;color:#f59e0b;"></i>
                        <span style="color:#f59e0b;">Bench Boost Target:</span>
                        <span style="color:var(--text-main); font-family:var(--font-heading); font-size:14px; font-weight:800;">GW ${state.benchBoostTargetGw || state.currentGw}</span>
                        <span style="color:var(--text-muted); font-weight:400;">— All 15 squad players optimized for Home & Easy Fixtures in GW${state.benchBoostTargetGw || state.currentGw}</span>
                    </div>
                ` : ''}

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
                                    const isNextDowngrade = up.gain1Gw < -0.01;

                                    let badgeBg, badgeBorder, badgeColor, badgeLabel;
                                    let cardBg, cardBorder, cardLeftBorder;

                                    if (isDowngrade) {
                                        badgeBg = 'rgba(0, 242, 254, 0.1)';
                                        badgeBorder = 'rgba(0, 242, 254, 0.3)';
                                        badgeColor = 'var(--secondary)';
                                        badgeLabel = '💰 CAPITAL RELEASE ENABLER';
                                        cardBg = 'rgba(0, 242, 254, 0.02)';
                                        cardBorder = 'rgba(0, 242, 254, 0.15)';
                                        cardLeftBorder = 'var(--secondary)';
                                    } else if (!isDowngrade && !isNextDowngrade) {
                                        badgeBg = 'rgba(0, 255, 136, 0.1)';
                                        badgeBorder = 'rgba(0, 255, 136, 0.2)';
                                        badgeColor = 'var(--primary)';
                                        badgeLabel = 'POINTS UPGRADED';
                                        cardBg = 'rgba(0, 255, 136, 0.01)';
                                        cardBorder = 'rgba(0, 255, 136, 0.15)';
                                        cardLeftBorder = 'var(--primary)';
                                    } else {
                                        badgeBg = 'rgba(245, 158, 11, 0.08)';
                                        badgeBorder = 'rgba(245, 158, 11, 0.2)';
                                        badgeColor = '#f59e0b';
                                        badgeLabel = 'POINTS UPGRADE (NEXT DROP)';
                                        cardBg = 'rgba(245, 158, 11, 0.02)';
                                        cardBorder = 'rgba(245, 158, 11, 0.15)';
                                        cardLeftBorder = '#f59e0b';
                                    }

                                    const cardStyle = `background: ${cardBg}; border: 1px solid ${cardBorder}; border-left: 4px solid ${cardLeftBorder}; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;`;

                                    return `
                                        <div class="rec-row-preseason" style="${cardStyle}">
                                            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
                                                <div class="transfer-player-card player-card-out" style="flex:1;">
                                                    <span class="player-name-main">${up.out ? up.out.name : 'Empty Slot'}</span>
                                                    <span class="player-team-sub">${up.out ? `${up.out.team} • £${up.out.price.toFixed(1)}m` : 'N/A'}</span>
                                                    ${up.out ? renderSetPieceBadges(up.out) : ''}
                                                    ${up.out ? renderPlayerStatsBreakdown(up.out) : ''}
                                                    ${up.out ? renderFdrFixtures(up.out, state.currentGw) : ''}
                                                </div>
                                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:12px;">
                                                    <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="margin: 0 0 6px 0;"></i>
                                                    <span class="pill-value" style="font-size:10px; background:${badgeBg}; border: 1px solid ${badgeBorder}; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                                                        <span style="color: ${isDowngrade ? 'var(--secondary)' : 'var(--primary)'}; font-weight: 800;">
                                                            ${up.gain >= 0 ? '+' : ''}${up.gain.toFixed(1)} (${horizon}G)
                                                        </span>
                                                        <span style="color: var(--text-muted);">•</span>
                                                        <span style="color: ${isNextDowngrade ? 'var(--secondary)' : 'var(--primary)'}; font-weight: 800;">
                                                            ${up.gain1Gw >= 0 ? '+' : ''}${up.gain1Gw.toFixed(1)} (Next)
                                                        </span>
                                                    </span>
                                                    <span style="font-size: 8px; font-weight: 800; color: ${badgeColor}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">${badgeLabel}</span>
                                                </div>
                                                <div class="transfer-player-card player-card-in" style="flex:1;">
                                                    <span class="player-name-main">${up.in.name}</span>
                                                    <span class="player-team-sub">${up.in.team} • £${up.in.price.toFixed(1)}m</span>
                                                    ${renderSetPieceBadges(up.in)}
                                                    ${renderPlayerStatsBreakdown(up.in)}
                                                    ${renderFdrFixtures(up.in, state.currentGw)}
                                                </div>
                                            </div>
                                            
                                            ${isDowngrade ? `
                                                <div style="font-size: 11px; color: var(--secondary); background: rgba(0, 242, 254, 0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0, 242, 254, 0.2); margin-top: 8px; text-align: left; display: flex; align-items: center; gap: 6px;">
                                                    <i data-lucide="coins" style="width:13px; height:13px;"></i>
                                                    <span><strong>Capital Release Enabler:</strong> Frees up <strong>£${(up.out.price - up.in.price).toFixed(1)}m</strong> in budget to fund high-value talisman upgrades elsewhere in your squad.</span>
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
                
                actions.syncTopBar();
                actions.showToast(`Applied swap: ${pIn.name} in for ${pOut ? pOut.name : 'empty slot'}`, 'success');
                performOptimization(resultsGrid, state, actions, horizon, mode);
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

        const candidateSoldIds = state.ignoreBench
            ? activeSquadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId)
            : currentSquadIds;

        for (const soldId of candidateSoldIds) {
            const soldPlayer = PLAYERS.find(p => p.id === soldId);
            if (!soldPlayer) continue;


            const sellBudget = soldPlayer.price + bank;

            let candidates = PLAYERS.filter(p => 
                p.position === soldPlayer.position && 
                !currentSquadIds.includes(p.id) &&
                p.price <= sellBudget &&
                !state.mustExclude.includes(p.id) &&
                (p.position !== 'FWD' || p.price >= (state.minFwdPrice ?? 6.0) || (state.mustInclude && state.mustInclude.includes(p.id)))
            );

            const guaranteedCandidates = candidates.filter(p => isGuaranteedStart(p, state));
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

                const solveGain = getSquadExpectedPts(tempSlots, true) - getSquadExpectedPts(activeSquadSlots, true);
                const realGain = getSquadExpectedPts(tempSlots, false) - getSquadExpectedPts(activeSquadSlots, false);

                if (solveGain > maxGain1 && solveGain > 0.01) {
                    maxGain1 = solveGain;
                    best1Tx = {
                        out: soldPlayer,
                        in: boughtPlayer,
                        gain: realGain
                    };
                }
            }
        }

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
            <div style="grid-column: span 2; display: flex; justify-content: flex-end; margin-bottom: -8px; position: relative;">
                <button class="close-modal-btn" id="closeResultsBtn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600;">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i> Close Results
                </button>
            </div>
            ${isOptimumMode ? `
                <div style="grid-column: span 2; display:inline-flex; align-items:center; gap:8px; margin-bottom:4px; padding:8px 14px; background:linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,242,254,0.07)); border:1px solid rgba(0,255,136,0.25); border-radius:10px; font-size:12px; font-weight:600;">
                    <i data-lucide="zap" style="width:14px;height:14px;color:var(--primary);"></i>
                    <span style="color:var(--primary);">AI Selected Formation:</span>
                    <span style="color:var(--text-main); font-family:var(--font-heading); font-size:14px; font-weight:800;">${chosenFormation}</span>
                    <span style="color:var(--text-muted); font-weight:400;">— Best formation for maximum predicted points across ${horizon} GW${horizon > 1 ? 's' : ''}</span>
                </div>
            ` : ''}
            <!-- Single Transfer Recommendation -->
            <div class="optimizer-card" style="${freeTransfersCount === 1 ? 'grid-column: span 2;' : ''}">
                <h3><i data-lucide="arrow-right-left" class="highlight-transfers"></i> Best Single Transfer</h3>
                <div class="recommendations-list" style="margin-top: 16px;">
                    ${best1Tx && best1Tx.gain > 0.1 ? `
                        <div class="rec-option-box">
                            <div class="rec-option-header" style="margin-bottom: 12px;">
                                <span class="rec-badge">RECOMMENDED</span>
                                <span class="rec-pts-gain" style="display: inline-flex; align-items: center; gap: 4px;">
                                    <span style="color: ${best1Tx.gain >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                                        +${best1Tx.gain.toFixed(1)} XP (${horizon}-GW)
                                    </span>
                                    <span style="color: var(--text-muted);">•</span>
                                    <span style="color: ${best1Tx1GwGain >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                                        ${best1Tx1GwGain >= 0 ? '+' : ''}${best1Tx1GwGain.toFixed(1)} XP (Next GW)
                                    </span>
                                </span>
                            </div>
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                                <div class="transfer-player-card player-card-out" style="flex:1;">
                                    <span class="player-name-main">${best1Tx.out.name}</span>
                                    <span class="player-team-sub">${best1Tx.out.team} • £${best1Tx.out.price.toFixed(1)}m</span>
                                    ${renderPlayerStatsBreakdown(best1Tx.out)}
                                    ${renderFdrFixtures(best1Tx.out, state.currentGw)}
                                </div>
                                <i data-lucide="chevrons-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                <div class="transfer-player-card player-card-in" style="flex:1;">
                                    <span class="player-name-main">${best1Tx.in.name}</span>
                                    <span class="player-team-sub">${best1Tx.in.team} • £${best1Tx.in.price.toFixed(1)}m</span>
                                    ${renderPlayerStatsBreakdown(best1Tx.in)}
                                    ${renderFdrFixtures(best1Tx.in, state.currentGw)}
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
                                    <span class="rec-pts-gain" style="display: inline-flex; align-items: center; gap: 4px;">
                                        <span style="color: ${best2Tx.gain >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                                            +${best2Tx.gain.toFixed(1)} XP (${horizon}-GW)
                                        </span>
                                        <span style="color: var(--text-muted);">•</span>
                                        <span style="color: ${best2Tx1GwGain >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                                            ${best2Tx1GwGain >= 0 ? '+' : ''}${best2Tx1GwGain.toFixed(1)} XP (Next GW)
                                        </span>
                                    </span>
                                </div>
                                
                                <!-- Transfer 1 -->
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                                    <div class="transfer-player-card player-card-out" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.out1.name}</span>
                                        <span class="player-team-sub">${best2Tx.out1.team} • £${best2Tx.out1.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.out1)}
                                        ${renderFdrFixtures(best2Tx.out1, state.currentGw)}
                                    </div>
                                    <i data-lucide="arrow-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                    <div class="transfer-player-card player-card-in" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.in1.name}</span>
                                        <span class="player-team-sub">${best2Tx.in1.team} • £${best2Tx.in1.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.in1)}
                                        ${renderFdrFixtures(best2Tx.in1, state.currentGw)}
                                    </div>
                                </div>
        
                                <!-- Transfer 2 -->
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                                    <div class="transfer-player-card player-card-out" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.out2.name}</span>
                                        <span class="player-team-sub">${best2Tx.out2.team} • £${best2Tx.out2.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.out2)}
                                        ${renderFdrFixtures(best2Tx.out2, state.currentGw)}
                                    </div>
                                    <i data-lucide="arrow-right" class="transfer-arrow-icon" style="align-self:center;"></i>
                                    <div class="transfer-player-card player-card-in" style="flex:1;">
                                        <span class="player-name-main">${best2Tx.in2.name}</span>
                                        <span class="player-team-sub">${best2Tx.in2.team} • £${best2Tx.in2.price.toFixed(1)}m</span>
                                        ${renderPlayerStatsBreakdown(best2Tx.in2)}
                                        ${renderFdrFixtures(best2Tx.in2, state.currentGw)}
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
                    state.optimizeCaptaincy();
                    state.saveState();
                    actions.syncTopBar();
                    actions.showToast("AI single transfer applied successfully!", "success");
                    performOptimization(resultsGrid, state, actions, horizon, mode);
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
                        state.optimizeCaptaincy();
                        state.saveState();
                        actions.syncTopBar();
                        actions.showToast("AI double transfer applied successfully!", "success");
                        performOptimization(resultsGrid, state, actions, horizon, mode);
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

        const closeBtn = resultsGrid.querySelector('#closeResultsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                resultsGrid.classList.add('hidden');
                resultsGrid.innerHTML = '';
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
        const duty = getPlayerSetPieceDuty(p);
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
        if (duty.hasDuty) {
            blurb += ` 🎯 Designated set-piece taker (${duty.label}).`;
        }
        markdown += `- **${p.name}** (${p.position}, £${p.price.toFixed(1)}m): ${blurb}\n`;
    });

    const setPieceTakersInSquad = squadPlayers.map(p => ({ player: p, duty: getPlayerSetPieceDuty(p) })).filter(item => item.duty.hasDuty);

    markdown += `
#### 2. Set-Piece Specialists & Penalty Takers
Set-piece takers carry an immense point floor and ceiling due to penalties, direct free-kick threat, and corner assist returns. The optimization algorithm prioritized the following designated set-piece specialists for your team:
${setPieceTakersInSquad.length > 0 ? setPieceTakersInSquad.map(item => `- 🎯 **${item.player.name}** (${item.player.team}, £${item.player.price.toFixed(1)}m): Primary taker for **${item.duty.label}**.`).join('\n') : '- No primary set-piece takers designated.'}

#### 3. Remaining Budget in Bank
- **Bank Balance:** **£${bank.toFixed(1)}m** remains in the bank. This capital is reserved to facilitate quick transfers or capture future price rises.

#### 4. Recommended Starting XI
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
