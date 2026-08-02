import { PLAYERS, TEAMS } from '../data.js';

export function renderDifferentials(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    const horizon = 5; // 5 GW horizon for differentials
    const squadInfo = state.getSquadForGw(state.currentGw);
    const { starters, bench, bank } = squadInfo;
    const currentSquadIds = [...starters, ...bench];
    const currentSquadPlayers = currentSquadIds.map(id => PLAYERS.find(p => p.id === id)).filter(p => p !== undefined);

    // Helpers (consistent with Optimizer)
    const getExpectedPts = (player) => {
        let sum = 0;
        for (let gw = state.currentGw; gw < state.currentGw + horizon; gw++) {
            const pred = player.predictions.find(pr => pr.gw === gw);
            if (pred) sum += pred.pts;
        }
        return sum;
    };

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

    // Filter differentials: ownership < 12%, not in squad, not injured/suspended, and is a guaranteed starter (MPPG >= 60 or high price enabler with 0 mins)
    const differentials = PLAYERS.filter(p => 
        p.ownership < 12.0 && 
        !currentSquadIds.includes(p.id) &&
        p.status === 'a' &&
        (p.chanceOfPlaying === 100 || p.chanceOfPlaying === null) &&
        (p.MPPG >= 60 || (p.MPPG === 0 && p.price >= 5.0))
    );

    // Sort and select top 3 for each position
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const positionLabels = { GKP: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
    const bestDiffs = {};

    positions.forEach(pos => {
        bestDiffs[pos] = differentials
            .filter(p => p.position === pos)
            .sort((a, b) => getExpectedPts(b) - getExpectedPts(a))
            .slice(0, 10);
    });

    const getFitExplanation = (diffPlayer) => {
        // Find players of same position in the user's squad
        const posSquadPlayers = currentSquadPlayers.filter(p => p.position === diffPlayer.position);
        if (posSquadPlayers.length === 0) {
            return `Provides standard high-performing differential support in the ${diffPlayer.position} line.`;
        }

        // Sort by expected points to find the lowest scoring player of that position
        posSquadPlayers.sort((a, b) => getExpectedPts(a) - getExpectedPts(b));
        const weakest = posSquadPlayers[0];
        const weakestPts = getExpectedPts(weakest);
        const diffPts = getExpectedPts(diffPlayer);
        const gain = diffPts - weakestPts;

        let pointsText = '';
        if (gain > 0.1) {
            pointsText = `Swapping out <strong>${actions.getWebName(weakest.name)}</strong> (lowest scoring ${diffPlayer.position} in your team) for <strong>${actions.getWebName(diffPlayer.name)}</strong> yields an extra **+${gain.toFixed(1)} Expected Points** over 5 weeks.`;
        } else {
            pointsText = `Offers a high-scoring differential options compared to your current lineup bench alternatives.`;
        }

        const diffFdr = parseFloat(getAvgFDR(diffPlayer));
        const weakestFdr = parseFloat(getAvgFDR(weakest));
        let fixtureText = '';
        if (diffFdr < weakestFdr) {
            fixtureText = `Provides an easier run of fixtures (Avg FDR: ${diffFdr} vs ${weakestFdr}).`;
        }

        let budgetText = '';
        if (diffPlayer.price < weakest.price) {
            budgetText = `Frees up **£${(weakest.price - diffPlayer.price).toFixed(1)}m** in budget.`;
        } else {
            const extraCost = diffPlayer.price - weakest.price;
            if (extraCost <= bank) {
                budgetText = `Affordable within your bank reserves (cost: +£${extraCost.toFixed(1)}m).`;
            } else {
                budgetText = `Requires an extra £${(extraCost - bank).toFixed(1)}m from team capital.`;
            }
        }

        return `
            <div class="diff-fit-explanation" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 10px;">
                <h4 style="margin: 0 0 6px 0; font-size: 11.5px; color: var(--primary); display: flex; align-items: center; gap: 4px;"><i data-lucide="sparkles" style="width:12px; height:12px;"></i> Squad Fit Rationale:</h4>
                <ul class="diff-rationale-list" style="margin:0; padding-left: 16px; font-size: 11px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                    ${pointsText ? `<li>${pointsText}</li>` : ''}
                    ${fixtureText ? `<li>${fixtureText}</li>` : ''}
                    ${budgetText ? `<li>${budgetText}</li>` : ''}
                </ul>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="differentials-view-container" style="display:flex; flex-direction:column; gap:24px; height:100%; overflow-y:auto; padding-right:8px;">
            <div class="optimizer-intro" style="margin-bottom: 8px;">
                <div class="intro-text-area">
                    <h2>AI Differential Explorer</h2>
                    <p>Discover hidden gems with **under 12% ownership** who are projected to score highly and climb FPL ranks quickly.</p>
                </div>
            </div>

            <div class="diff-positions-container" style="display:flex; flex-direction:column; gap:32px;">
                ${positions.map(pos => {
                    const list = bestDiffs[pos];
                    if (list.length === 0) return '';

                    return `
                        <div class="diff-position-section">
                            <h3 class="diff-pos-title" style="font-family: var(--font-heading); font-size: 18px; font-weight:700; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">
                                <i data-lucide="chevron-right" style="color:var(--primary); vertical-align:middle; width:20px; height:20px;"></i> ${positionLabels[pos]} (Ownership &lt; 12%)
                            </h3>
                            <div class="diff-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                                ${list.map(player => {
                                    const fdr = getAvgFDR(player);
                                    const csOdds = getCleanSheetOdds(player);
                                    const projRet = getProjectedReturns(player);
                                    const pts = getExpectedPts(player);
                                    const squadPosPlayers = currentSquadPlayers.filter(p => p.position === pos);

                                    return `
                                        <div class="diff-player-card" style="background:var(--bg-card); border: 1px solid var(--border-color); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                <div>
                                                    <h4 style="font-size:15px; font-weight:700; margin:0; color:var(--text-main);">${player.name}</h4>
                                                    <span style="font-size:11px; color:var(--text-muted);">${player.team} • £${player.price.toFixed(1)}m</span>
                                                </div>
                                                <span class="diff-ownership-pill" style="font-size:10px; font-weight:700; background:rgba(139, 92, 246, 0.1); color: #a78bfa; border:1px solid rgba(139, 92, 246, 0.2); padding:3px 8px; border-radius:10px;">
                                                    ${player.ownership.toFixed(1)}% Owned
                                                </span>
                                            </div>

                                            <div class="analysis-stats-grid" style="margin-top:0;">
                                                <div class="stat-pill" style="flex:1;">
                                                    <span class="stat-pill-label">Avg FDR</span>
                                                    <span class="stat-pill-val fdr-${Math.round(parseFloat(fdr))}">${fdr}</span>
                                                </div>
                                                ${csOdds !== null ? `
                                                    <div class="stat-pill" style="flex:1;">
                                                        <span class="stat-pill-label">CS Odds</span>
                                                        <span class="stat-pill-val">${csOdds}</span>
                                                    </div>
                                                ` : ''}
                                                ${projRet !== null ? `
                                                    <div class="stat-pill" style="flex:1;">
                                                        <span class="stat-pill-label">Proj xGI</span>
                                                        <span class="stat-pill-val">${projRet}</span>
                                                    </div>
                                                ` : ''}
                                                <div class="stat-pill highlight" style="flex:1;">
                                                    <span class="stat-pill-label">XP (5 GW)</span>
                                                    <span class="stat-pill-val">${pts.toFixed(1)}</span>
                                                </div>
                                            </div>

                                            ${getFitExplanation(player)}

                                            <div class="quick-swap-container" style="border-top:1px dashed var(--border-color); padding-top:12px; display:flex; flex-direction:column; gap:8px; margin-top:auto;">
                                                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Quick Swap Roster Option:</label>
                                                <div style="display:flex; flex-direction:column; gap:8px;">
                                                    <select class="settings-select swap-out-select" data-in-id="${player.id}" style="width:100%; padding:8px; font-size:12px; border-radius:8px;">
                                                        ${squadPosPlayers.map(sp => `<option value="${sp.id}">Swap out: ${sp.name} (£${sp.price.toFixed(1)}m)</option>`).join('')}
                                                    </select>
                                                    <button class="apply-rec-btn swap-action-btn" data-in-id="${player.id}" style="padding:8px 16px; font-size:12px; font-weight:700; width:100%; border-radius:8px;">
                                                        Swap Player
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    lucide.createIcons();

    // Wire swap buttons
    container.querySelectorAll('.swap-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const inId = parseInt(btn.getAttribute('data-in-id'));
            const select = container.querySelector(`select[data-in-id="${inId}"]`);
            if (!select) return;

            const outId = parseInt(select.value);
            const inPlayer = PLAYERS.find(p => p.id === inId);

            const ok = actions.addTransfer(state.currentGw, outId, inId);
            if (ok) {
                actions.showToast(`Swapped in differential ${inPlayer.name}!`, "success");
                actions.switchTab('planner');
            }
        });
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
                    <h3 class="lock-title">AI Differentials Locked</h3>
                    <p class="lock-desc">Unlock advanced differential identification scanners. Find high-upside players with low ownership stats (<12%) before your rivals do.</p>
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
