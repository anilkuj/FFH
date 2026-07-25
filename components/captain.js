import { PLAYERS, TEAMS } from '../data.js';

export function renderCaptain(container, state, actions) {
    const currentGw = state.currentGw;

    // Get user squad players
    const squadIds = state.squadSlots.map(s => s.playerId).filter(id => id !== null);
    const squadPlayers = squadIds.map(id => PLAYERS.find(p => p.id === id)).filter(p => p !== undefined);

    // Get expected points for a player in a given gameweek
    const getGwPrediction = (player, gw) => {
        return player.predictions.find(pr => pr.gw === gw) || { pts: 0, opp: 'BYE', loc: '', diff: 3 };
    };

    // 1. Sort squad options by expected points for active GW
    const squadOptions = [...squadPlayers]
        .map(p => {
            const pred = getGwPrediction(p, currentGw);
            return { player: p, pred };
        })
        .sort((a, b) => b.pred.pts - a.pred.pts)
        .slice(0, 4);

    // 2. Sort global options by expected points for active GW
    const globalOptions = [...PLAYERS]
        .map(p => {
            const pred = getGwPrediction(p, currentGw);
            return { player: p, pred };
        })
        .sort((a, b) => b.pred.pts - a.pred.pts)
        .slice(0, 6);

    const getFdrBadge = (diff) => {
        let cls = 'diff-3';
        if (diff <= 2) cls = 'diff-2';
        else if (diff === 4) cls = 'diff-4';
        else if (diff >= 5) cls = 'diff-5';
        return `<span class="difficulty-cell ${cls}" style="padding: 2px 8px; border-radius: 4px; font-size: 10px; display: inline-block; min-height: auto;">FDR ${diff}</span>`;
    };

    const renderOptionCard = (item, isGlobal = false) => {
        const { player, pred } = item;
        const isCurrentCaptain = state.captain === player.id;
        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: '#ffffff' };

        // Generate custom metric breakdown
        const xGI = player.xGI !== undefined ? player.xGI.toFixed(2) : '0.00';
        const ownership = player.ownership !== undefined ? player.ownership.toFixed(1) : '0.0';

        // Custom AI Rationale text
        let rationale = '';
        if (player.position === 'FWD' || player.position === 'MID') {
            rationale = `${actions.getWebName(player.name)} has an attacking xGI of ${xGI} this season. Facing ${pred.opp} (${pred.loc}) makes them a prime captaincy choice.`;
        } else {
            rationale = `High clean sheet probability for ${actions.getWebName(player.name)} playing at ${pred.loc === 'H' ? 'home' : 'away'} against ${pred.opp}.`;
        }

        return `
            <div class="rec-option-box" style="display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 12px; padding: 16px; position: relative;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 8px; height: 36px; background: ${isCurrentCaptain ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 4px;"></div>
                        <div>
                            <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                                ${player.name}
                                ${isCurrentCaptain ? `<span class="pill-value" style="font-size: 9px; padding: 2px 6px; background: rgba(0,255,136,0.1); color: var(--primary); border: 1px solid var(--primary-glow); border-radius: 10px;">ACTIVE CAPTAIN</span>` : ''}
                            </h4>
                            <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                                ${player.position} • ${player.team} • £${player.price.toFixed(1)}m • ${ownership}% Own
                            </p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: var(--secondary);">${pred.pts.toFixed(1)} XP</span>
                        <div style="margin-top: 4px;">
                            ${getFdrBadge(pred.diff)}
                        </div>
                    </div>
                </div>

                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; padding: 8px 12px; background: rgba(255, 255, 255, 0.01); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <strong>AI Rationale:</strong> ${rationale}
                </div>

                <div style="display: flex; gap: 12px; margin-top: 4px;">
                    <div style="flex: 1; font-size: 11px; color: var(--text-muted);">
                        <span>Fixture: <strong>${pred.opp} (${pred.loc})</strong></span>
                    </div>
                    ${!isGlobal && !isCurrentCaptain ? `
                        <button class="apply-rec-btn make-captain-btn" data-id="${player.id}" style="padding: 4px 12px; font-size: 11px; width: auto; height: 28px; border-radius: 6px; margin: 0;">
                            Set as Captain
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="captain-view-container" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="optimizer-intro" style="margin-bottom: 8px;">
                <div class="intro-text-area">
                    <h2>AI Captain Picker & Analyzer</h2>
                    <p>Algorithmically identifies the highest projected captaincy returns for Gameweek ${currentGw} based on team strength, opponent FDR, and live predicted points.</p>
                </div>
            </div>

            <div class="grid-2-col" style="align-items: start;">
                <!-- Squad Captaincy Recommendations -->
                <div class="optimizer-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="users" style="color: var(--primary);"></i> Recommended from Your Squad
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${squadOptions.length > 0 ? squadOptions.map(item => renderOptionCard(item, false)).join('') : `
                            <div class="transfer-list-empty">Add players to your squad in the Team Planner to analyze squad captain choices.</div>
                        `}
                    </div>
                </div>

                <!-- Global Captaincy Recommendations -->
                <div class="optimizer-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="globe" style="color: var(--secondary);"></i> Global Captaincy Board (Top FPL Options)
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${globalOptions.map(item => renderOptionCard(item, true)).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Bind Make Captain button click listeners
    container.querySelectorAll('.make-captain-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.getAttribute('data-id'));
            
            // Set captain
            state.captain = playerId;
            
            // Verify and make sure captain is starting (move to starters if on bench)
            const slot = state.squadSlots.find(s => s.playerId === playerId);
            if (slot && !slot.isStarting) {
                // Find a starting slot of the same position to swap starter status
                const starterSlot = state.squadSlots.find(s => s.position === slot.position && s.isStarting);
                if (starterSlot) {
                    slot.isStarting = true;
                    starterSlot.isStarting = false;
                }
            }

            state.saveState();
            actions.showToast("Captain selection updated successfully!", "success");
            
            // Re-render Captain tab
            renderCaptain(container, state, actions);
        });
    });
}
