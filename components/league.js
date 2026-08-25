import { PLAYERS } from '../data.js';

export function renderLeague(container, state, actions) {
    const currentGw = state.currentGw;

    // 1. Calculate user active squad stats dynamically
    const squadInfo = state.getSquadForGw(currentGw);
    const userStarters = state.squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => PLAYERS.find(p => p.id === s.playerId));
    
    const currentWeekChips = state.chips[currentGw] || { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };

    // Sum active expected points for user starters
    let userGwPts = userStarters.reduce((sum, p) => {
        const pred = p.predictions.find(pr => pr.gw === currentGw) || { pts: 0 };
        // double or triple captain points
        const multiplier = (state.captain === p.id) ? (currentWeekChips.tripleCaptain ? 3 : 2) : 1;
        return sum + (pred.pts * multiplier);
    }, 0);

    const capPlayer = PLAYERS.find(p => p.id === state.captain);
    const userCaptain = capPlayer ? actions.getWebName(capPlayer.name) : 'None';
    const userTransfersCount = (state.transfers[currentGw] || []).length;
    const userActiveChip = Object.keys(currentWeekChips).find(k => currentWeekChips[k] === true) || 'None';
    
    // Format chip display name
    const formatChip = (chip) => {
        if (chip === 'tripleCaptain') return 'Triple Captain';
        if (chip === 'benchBoost') return 'Bench Boost';
        if (chip === 'wildcard') return 'Wildcard';
        if (chip === 'freeHit') return 'Free Hit';
        return 'None';
    };

    // 2. Prepare league standings list
    const standings = [
        { rank: 1, manager: "Magnus Carlsen", teamName: "Grandmaster FC", gwPts: 68.4, totalPts: 2482, captain: "Haaland", chip: "None", transfers: 1 },
        { rank: 2, manager: "FPL Raptor", teamName: "Preseason Beast", gwPts: 62.1, totalPts: 2410, captain: "Salah", chip: "None", transfers: 1 },
        {
            rank: 3,
            manager: "My Team (You)",
            teamName: "My Hub Squad",
            gwPts: parseFloat(userGwPts.toFixed(1)),
            totalPts: 2390 + Math.round(userGwPts), // dynamic points addition
            captain: userCaptain,
            chip: formatChip(userActiveChip),
            transfers: userTransfersCount,
            isUser: true
        },
        { rank: 4, manager: "FPL General", teamName: "General's 11", gwPts: 54.3, totalPts: 2364, captain: "Haaland", chip: "None", transfers: 2 },
        { rank: 5, manager: "FPL Mate", teamName: "Mate's Differentials", gwPts: 59.5, totalPts: 2320, captain: "Isak", chip: "Wildcard", transfers: 1 }
    ];

    // Sort standings by totalPts desc
    standings.sort((a, b) => b.totalPts - a.totalPts);
    // Update ranks based on sorted order
    standings.forEach((m, idx) => m.rank = idx + 1);

    container.innerHTML = `
        <div class="league-view-container" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="optimizer-intro" style="margin-bottom: 8px;">
                <div class="intro-text-area">
                    <h2>Mini-League Analyzer</h2>
                    <p>Track live rank standings, chip deployment, and transfer activities of rival managers inside your FPL Mini-Leagues.</p>
                </div>
            </div>

            <div class="grid-split-3-1" style="align-items: start;">
                <!-- Standings Table -->
                <div class="stats-table-wrapper">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th style="text-align: center; width: 60px;">Rank</th>
                                <th>Manager / Team</th>
                                <th style="text-align: center; width: 100px;">GW XP</th>
                                <th style="text-align: center; width: 120px;">Total Points</th>
                                <th style="text-align: center; width: 120px;">GW Captain</th>
                                <th style="text-align: center; width: 120px;">Active Chip</th>
                                <th style="text-align: center; width: 100px;">Transfers</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${standings.map(m => `
                                <tr style="${m.isUser ? 'background: rgba(0, 255, 136, 0.05); font-weight: bold; border-left: 3px solid var(--primary);' : ''}">
                                    <td style="text-align: center;">
                                        <span class="pill-value" style="font-size: 13px; display: inline-block; background: ${m.rank === 1 ? '#fbbf24' : '#1e293b'}; color: ${m.rank === 1 ? 'var(--bg-dark)' : '#fff'}; width: 24px; height: 24px; border-radius: 50%; line-height: 24px; text-align: center; font-weight: 800;">
                                            ${m.rank}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-size: 14px; color: ${m.isUser ? 'var(--primary)' : '#fff'};">${m.manager}</span>
                                            <span style="font-size: 11px; color: var(--text-muted);">${m.teamName}</span>
                                        </div>
                                    </td>
                                    <td style="text-align: center; color: var(--secondary); font-family: var(--font-heading); font-weight: 700;">
                                        ${m.gwPts.toFixed(1)}
                                    </td>
                                    <td style="text-align: center; font-family: var(--font-heading); font-weight: 700;">
                                        ${m.totalPts}
                                    </td>
                                    <td style="text-align: center;">
                                        <span class="pill-value" style="font-size: 11px; padding: 2px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
                                            ${m.captain}
                                        </span>
                                    </td>
                                    <td style="text-align: center; color: ${m.chip !== 'None' ? 'var(--accent-purple)' : 'var(--text-muted)'}; font-size: 12px;">
                                        ${m.chip}
                                    </td>
                                    <td style="text-align: center; font-size: 13px;">
                                        ${m.transfers}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Side panel widgets -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Chip Usage Widget -->
                    <div class="optimizer-card" style="padding: 20px;">
                        <h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="pie-chart" style="color: var(--accent-purple);"></i> Chip Deployment
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                                    <span class="pill-label">Wildcard</span>
                                    <span class="pill-value">40% used</span>
                                </div>
                                <div class="progress-track" style="height: 6px;"><div class="progress-bar-fill fill-rise" style="width: 40%; background: var(--accent-purple);"></div></div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                                    <span class="pill-label">Triple Captain</span>
                                    <span class="pill-value">20% used</span>
                                </div>
                                <div class="progress-track" style="height: 6px;"><div class="progress-bar-fill fill-rise" style="width: 20%; background: var(--primary);"></div></div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                                    <span class="pill-label">Bench Boost</span>
                                    <span class="pill-value">0% used</span>
                                </div>
                                <div class="progress-track" style="height: 6px;"><div class="progress-bar-fill fill-rise" style="width: 0%;"></div></div>
                            </div>
                        </div>
                    </div>

                    <!-- Ownership overlap widget -->
                    <div class="optimizer-card" style="padding: 20px;">
                        <h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="shield-check" style="color: var(--primary);"></i> Template Overlap
                        </h4>
                        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                            Your squad matches <strong>73%</strong> of the league leader's core player selections.
                        </p>
                        <span class="pill-value" style="font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(0, 255, 136, 0.1); border: 1px solid var(--primary-glow); border-radius: 20px; color: var(--primary);">
                            73% Core Overlap
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
}
