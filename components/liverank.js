import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

export function renderLiveRank(container, state, actions) {
    // Current gameweek
    const currentGw = state.currentGw || 2;
    
    // User overall rank in the 3 millions range (defaults to #3,250,000)
    if (!state.overallRank || state.overallRank < 1000000) {
        state.overallRank = 3250000;
    }
    const baseRank = state.overallRank;

    // Filter available gameweeks to ONLY COMPLETED / ACTIVE gameweeks up to currentGw, sorted in REVERSE chronological order
    const completedGws = Array.from({ length: currentGw }, (_, i) => i + 1).sort((a, b) => b - a);

    // Selected view GW (defaults to latest active GW, e.g. GW2)
    const selectedGw = container.dataset.gw ? parseInt(container.dataset.gw) : currentGw;
    const viewGw = completedGws.includes(selectedGw) ? selectedGw : currentGw;

    const squadInfo = state.getSquadForGw ? state.getSquadForGw(viewGw) : { starters: [], bench: [], bank: 0 };
    
    // Get actual starting 11 and bench players for viewGw
    const starterIds = squadInfo.starters && squadInfo.starters.length > 0
        ? squadInfo.starters
        : state.squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
    
    const benchIds = squadInfo.bench && squadInfo.bench.length > 0
        ? squadInfo.bench
        : state.squadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);

    const starters = starterIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const benchers = benchIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const captainId = state.captain || (starters[0] ? starters[0].id : null);
    const viceId = state.viceCaptain || (starters[1] ? starters[1].id : null);
    const activeChips = state.chips ? state.chips[viewGw] || {} : {};

    // Get simulation state
    if (!container.dataset.simulatedEvents) {
        container.dataset.simulatedEvents = JSON.stringify({});
    }
    const simulatedEvents = JSON.parse(container.dataset.simulatedEvents);
    const isSimulating = container.dataset.isSimulating === 'true';

    // Calculate actual live points scored by squad for viewGw
    let liveGwPoints = 0;
    let playedStartersCount = 0;
    const squadMatrix = [];

    starters.forEach(p => {
        const pred = (p.predictions || []).find(pr => pr.gw === viewGw) || {};
        let actualPts = pred.actualPts;
        if (state.livePoints && state.livePoints[viewGw] && state.livePoints[viewGw][p.id] !== undefined) {
            actualPts = state.livePoints[viewGw][p.id];
        }

        const isCap = p.id === captainId;
        const isVice = p.id === viceId;
        let multiplier = 1;
        if (isCap) multiplier = activeChips.tripleCaptain ? 3 : 2;

        const basePts = actualPts !== null && actualPts !== undefined ? actualPts : Math.round(pred.pts || 0);
        const finalPts = basePts * multiplier;
        liveGwPoints += finalPts;

        if (actualPts !== null && actualPts !== undefined) playedStartersCount++;

        squadMatrix.push({
            player: p,
            role: isCap ? 'C' : (isVice ? 'VC' : 'STARTER'),
            multiplier,
            basePts,
            finalPts,
            isPlayed: actualPts !== null && actualPts !== undefined,
            opp: pred.opp || 'TBD',
            loc: pred.loc || 'H',
            eo: Math.min(99.9, (p.ownership || 15) * (isCap ? 1.4 : 1.0)).toFixed(1)
        });
    });

    // Add bench points if Bench Boost is active
    if (activeChips.benchBoost) {
        benchers.forEach(p => {
            const pred = (p.predictions || []).find(pr => pr.gw === viewGw) || {};
            let actualPts = pred.actualPts;
            if (state.livePoints && state.livePoints[viewGw] && state.livePoints[viewGw][p.id] !== undefined) {
                actualPts = state.livePoints[viewGw][p.id];
            }
            const basePts = actualPts !== null && actualPts !== undefined ? actualPts : Math.round(pred.pts || 0);
            liveGwPoints += basePts;

            squadMatrix.push({
                player: p,
                role: 'BENCH (BB)',
                multiplier: 1,
                basePts,
                finalPts: basePts,
                isPlayed: actualPts !== null && actualPts !== undefined,
                opp: pred.opp || 'TBD',
                loc: pred.loc || 'H',
                eo: (p.ownership || 10).toFixed(1)
            });
        });
    }

    // Add simulated event adjustments if simulation mode is toggled on
    let simAdjustment = 0;
    const events = [];
    starters.forEach(p => {
        const lastName = actions.getWebName ? actions.getWebName(p.name) : p.name;
        const isCap = p.id === captainId;
        const mult = isCap ? (activeChips.tripleCaptain ? 3 : 2) : 1;

        if (p.position === 'GKP' || p.position === 'DEF') {
            events.push({ id: `${p.id}_cs`, label: `${lastName} Clean Sheet`, pts: 4 * mult, desc: `Defensive shutout (+${4 * mult} pts)` });
            events.push({ id: `${p.id}_goal`, label: `${lastName} Goal Scored`, pts: 6 * mult, desc: `Goal by defender (+${6 * mult} pts)` });
        } else if (p.position === 'MID') {
            events.push({ id: `${p.id}_goal`, label: `${lastName} Goal Scored`, pts: 5 * mult, desc: `Goal by midfielder (+${5 * mult} pts)` });
            events.push({ id: `${p.id}_assist`, label: `${lastName} Assist`, pts: 3 * mult, desc: `Goal assist (+${3 * mult} pts)` });
        } else if (p.position === 'FWD') {
            events.push({ id: `${p.id}_goal`, label: `${lastName} Goal Scored`, pts: 4 * mult, desc: `Goal by forward (+${4 * mult} pts)` });
            events.push({ id: `${p.id}_assist`, label: `${lastName} Assist`, pts: 3 * mult, desc: `Goal assist (+${3 * mult} pts)` });
        }
    });

    if (isSimulating) {
        Object.keys(simulatedEvents).forEach(evId => {
            if (simulatedEvents[evId]) {
                const ev = events.find(e => e.id === evId);
                if (ev) simAdjustment += ev.pts;
            }
        });
    }

    const displayGwPoints = liveGwPoints + simAdjustment;
    const avgGwScore = viewGw === 2 ? 44 : 52;

    // Real Live Overall Rank calculation centered on baseRank (#3,250,000)
    const ptsDelta = displayGwPoints - avgGwScore;
    const rankShiftFactor = Math.pow(0.965, ptsDelta);
    const liveRank = Math.max(1, Math.round(baseRank * rankShiftFactor));
    const rankDelta = baseRank - liveRank;
    const estTopPercent = ((liveRank / 10500000) * 100).toFixed(1);
    const gwRank = Math.max(1, Math.round(3120400 * Math.pow(0.96, ptsDelta)));

    container.innerHTML = `
        <div class="liverank-view-container" style="display: flex; flex-direction: column; gap: 20px; max-width: 1100px; margin: 0 auto; padding-bottom: 30px;">
            <!-- Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
                <div>
                    <h2 style="font-family: var(--font-heading); font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px;">
                        <i data-lucide="activity" style="color: var(--primary); width: 26px; height: 26px;"></i> Live Rank & Completed GW History
                    </h2>
                    <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
                        Showing completed/active gameweeks in reverse order. Overall Rank Baseline: <strong style="color: var(--primary);">#${baseRank.toLocaleString()}</strong> (~3M range).
                    </p>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <!-- Reverse Chronological Completed GW Selector (NO FUTURE GWs SHOWN) -->
                    <div style="display: flex; background: var(--bg-panel); padding: 3px; border-radius: 8px; border: 1px solid var(--border-color);">
                        ${completedGws.map(gwNum => `
                            <button class="live-gw-tab-btn" data-gw="${gwNum}" style="padding: 5px 14px; font-size: 12px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; ${gwNum === viewGw ? 'background: var(--primary); color: var(--text-dark);' : 'background: transparent; color: var(--text-muted);'}">
                                GW${gwNum} ${gwNum === currentGw ? '🔥 (Live)' : ' (Completed)'}
                            </button>
                        `).join('')}
                    </div>

                    <!-- Sync FPL Team ID / Edit Rank Button -->
                    <button id="syncFplIdBtn" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="refresh-cw" style="width: 13px; height: 13px; color: var(--secondary);"></i> Sync FPL Rank
                    </button>

                    <!-- Event Simulator Toggle -->
                    <button id="toggleSimModeBtn" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: ${isSimulating ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)'}; color: ${isSimulating ? '#8b5cf6' : 'var(--text-main)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="${isSimulating ? 'sliders' : 'radio'}" style="width: 13px; height: 13px;"></i>
                        ${isSimulating ? 'Simulator On' : 'Live Data'}
                    </button>
                </div>
            </div>

            <!-- Top Performance Cards Grid (GW${viewGw}) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                <!-- Live Overall Rank Card -->
                <div class="optimizer-card" style="padding: 20px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; text-align: center; box-shadow: var(--shadow-md);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);">Live Overall Rank (GW${viewGw})</span>
                    <h1 style="font-family: var(--font-heading); font-size: 44px; font-weight: 800; color: var(--primary); margin: 6px 0;">#${liveRank.toLocaleString()}</h1>
                    <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span style="color: ${rankDelta >= 0 ? '#22c55e' : '#ef4444'}; font-weight: 800; display: flex; align-items: center; gap: 3px;">
                            <i data-lucide="${rankDelta >= 0 ? 'trending-up' : 'trending-down'}" style="width: 13px; height: 13px;"></i>
                            ${rankDelta >= 0 ? '+' : ''}${rankDelta.toLocaleString()} ranks
                        </span>
                        <span>•</span>
                        <span style="color: var(--secondary); font-weight: 700;">Top ${estTopPercent}%</span>
                    </div>
                </div>

                <!-- Gameweek Score Card -->
                <div class="optimizer-card" style="padding: 20px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; text-align: center; box-shadow: var(--shadow-md);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);">Gameweek ${viewGw} Score</span>
                    <h1 style="font-family: var(--font-heading); font-size: 44px; font-weight: 800; color: var(--secondary); margin: 6px 0;">${displayGwPoints} pts</h1>
                    <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>Average: ${avgGwScore} pts</span>
                        <span>•</span>
                        <span style="color: ${displayGwPoints >= avgGwScore ? '#22c55e' : '#ef4444'}; font-weight: 700;">
                            ${displayGwPoints >= avgGwScore ? '+' : ''}${displayGwPoints - avgGwScore} above avg
                        </span>
                    </div>
                </div>

                <!-- Gameweek Rank Card -->
                <div class="optimizer-card" style="padding: 20px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; text-align: center; box-shadow: var(--shadow-md);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);">Gameweek ${viewGw} Rank</span>
                    <h1 style="font-family: var(--font-heading); font-size: 44px; font-weight: 800; color: var(--text-main); margin: 6px 0;">#${gwRank.toLocaleString()}</h1>
                    <div style="font-size: 11.5px; color: var(--text-muted);">
                        <span>Starters Played: <strong style="color: var(--text-main);">${playedStartersCount} / 11</strong></span>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div style="display: grid; grid-template-columns: ${isSimulating ? '1fr 340px' : '1fr'}; gap: 20px;">
                <!-- Squad Performance Matrix for View GW -->
                <div class="optimizer-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-md);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="shield" style="color: var(--primary); width: 18px; height: 18px;"></i> GW${viewGw} Squad Live Breakdown Matrix
                        </h3>
                        <span style="font-size: 11px; color: var(--text-muted);">Effective Ownership (EO) Rank Impact</span>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 10px; text-transform: uppercase; font-weight: 700;">
                                    <th style="padding: 8px 6px;">Player</th>
                                    <th style="padding: 8px 6px;">Role</th>
                                    <th style="padding: 8px 6px;">Opponent</th>
                                    <th style="padding: 8px 6px; text-align: center;">Effective Ownership</th>
                                    <th style="padding: 8px 6px; text-align: center;">Base Pts</th>
                                    <th style="padding: 8px 6px; text-align: right;">Live Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${squadMatrix.map((item, idx) => `
                                    <tr style="border-bottom: 1px solid var(--border-color); background: ${idx % 2 === 0 ? 'var(--bg-panel)' : 'transparent'};">
                                        <td style="padding: 8px 6px;">
                                            <div style="font-weight: 700; color: var(--text-main); font-size: 12.5px;">
                                                ${actions.getWebName ? actions.getWebName(item.player.name) : item.player.name}
                                                ${item.role === 'C' ? `<span style="background: var(--primary); color: #000; font-weight: 900; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">C</span>` : ''}
                                                ${item.role === 'VC' ? `<span style="background: var(--secondary); color: #000; font-weight: 900; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">VC</span>` : ''}
                                            </div>
                                            <div style="font-size: 9.5px; color: var(--text-muted); margin-top: 1px;">
                                                ${item.player.position} • ${item.player.team}
                                            </div>
                                        </td>
                                        <td style="padding: 8px 6px;">
                                            <span style="font-size: 10px; font-weight: 700; color: ${item.role === 'C' ? 'var(--primary)' : 'var(--text-muted)'};">
                                                ${item.role} (${item.multiplier}x)
                                            </span>
                                        </td>
                                        <td style="padding: 8px 6px;">
                                            <span style="font-size: 11px; font-weight: 600; color: var(--text-main);">${item.opp} (${item.loc})</span>
                                        </td>
                                        <td style="padding: 8px 6px; text-align: center;">
                                            <span style="font-size: 11px; font-weight: 700; color: var(--secondary);">${item.eo}%</span>
                                        </td>
                                        <td style="padding: 8px 6px; text-align: center; font-weight: 700; color: var(--text-muted);">
                                            ${item.basePts}
                                        </td>
                                        <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: var(--primary); font-size: 13px;">
                                            ${item.finalPts} pts
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                ${isSimulating ? `
                    <!-- Event Simulator Controls Sidebar -->
                    <div class="optimizer-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 14px;">
                        <h3 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="sliders" style="color: #8b5cf6; width: 16px; height: 16px;"></i> GW${viewGw} Event Simulator
                        </h3>
                        <p style="font-size: 11.5px; color: var(--text-muted); margin: 0;">
                            Check scenarios to simulate live rank impact:
                        </p>

                        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                            ${events.map(ev => {
                                const isChecked = !!simulatedEvents[ev.id];
                                return `
                                    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--border-color); background: ${isChecked ? 'var(--bg-panel)' : 'transparent'}; border-radius: 8px; cursor: pointer; transition: all 0.15s;">
                                        <input type="checkbox" class="event-checkbox" data-id="${ev.id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px; cursor: pointer;">
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 12px; color: var(--text-main);">
                                                <span>${ev.label}</span>
                                                <span style="color: ${ev.pts >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                                                    ${ev.pts >= 0 ? '+' : ''}${ev.pts} pts
                                                </span>
                                            </div>
                                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                                                ${ev.desc}
                                            </div>
                                        </div>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach Event Listeners

    // Reverse Gameweek tab selection
    container.querySelectorAll('.live-gw-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gwVal = parseInt(btn.getAttribute('data-gw'));
            container.dataset.gw = gwVal;
            renderLiveRank(container, state, actions);
        });
    });

    // Toggle simulation mode
    const toggleSimBtn = container.querySelector('#toggleSimModeBtn');
    if (toggleSimBtn) {
        toggleSimBtn.addEventListener('click', () => {
            container.dataset.isSimulating = isSimulating ? 'false' : 'true';
            renderLiveRank(container, state, actions);
        });
    }

    // Sync FPL Rank / Team ID button
    const syncFplIdBtn = container.querySelector('#syncFplIdBtn');
    if (syncFplIdBtn) {
        syncFplIdBtn.addEventListener('click', () => {
            const inputVal = prompt("Enter your exact FPL Overall Rank or Team ID:", baseRank.toLocaleString());
            if (inputVal !== null) {
                const parsed = parseInt(inputVal.replace(/[^0-9]/g, ''));
                if (!isNaN(parsed) && parsed > 0) {
                    state.overallRank = parsed;
                    renderLiveRank(container, state, actions);
                    if (actions.showToast) actions.showToast(`Overall rank updated to #${parsed.toLocaleString()}!`, "success");
                }
            }
        });
    }

    // Checkbox event listeners in simulation mode
    container.querySelectorAll('.event-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const evId = cb.getAttribute('data-id');
            simulatedEvents[evId] = cb.checked;
            container.dataset.simulatedEvents = JSON.stringify(simulatedEvents);
            renderLiveRank(container, state, actions);
        });
    });
}
