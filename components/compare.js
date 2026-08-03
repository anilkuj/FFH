import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

export function renderCompare(container, state, actions) {
    if (!container) return;

    // Safely load midfielders from active squad
    let selectedIds = [];
    if (state && state.squadSlots && Array.isArray(state.squadSlots)) {
        selectedIds = state.squadSlots
            .filter(s => s && s.position === 'MID' && s.playerId !== null && s.playerId !== undefined)
            .map(s => parseInt(s.playerId))
            .filter(id => !isNaN(id));
    }

    // Fallback default prepopulate (Cole Palmer and Bukayo Saka) if active squad has fewer than 2 midfielders
    if (!selectedIds || selectedIds.length < 2) {
        selectedIds = [302, 12]; 
    }

    container.innerHTML = `
        <div class="compare-view-container" style="display: flex; flex-direction: column; gap: 24px; width: 100%;">
            <!-- Header section -->
            <div class="optimizer-intro" style="margin-bottom: 4px; flex-shrink: 0; padding: 24px; background: linear-gradient(135deg, var(--bg-card), rgba(139, 92, 246, 0.05)); border: 1px solid var(--border-color); border-radius: 16px;">
                <div class="intro-text-area">
                    <h2 style="font-size: 20px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="users" class="highlight-transfers"></i> FPL Player Comparison Deck
                    </h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Compare up to 5 players side-by-side. Get detailed stats and AI recommendation reports to choose your transfers.</p>
                </div>
            </div>

            <!-- Search and Deck Controls Card -->
            <div class="optimizer-settings-card" style="padding: 20px; margin: 0; display: flex; flex-direction: column; gap: 16px;">
                <h3 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="search" class="highlight-bank"></i> Search and Add Players
                </h3>
                
                <!-- Search bar input -->
                <div style="position: relative; width: 100%;">
                    <i data-lucide="search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px;"></i>
                    <input type="text" id="playerCompareSearch" class="search-field" placeholder="Search players by name (e.g. Palmer, Saka, Salah)..." style="width: 100%; height: 42px; border-radius: 8px; padding-left: 42px; background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; outline: none; transition: border-color 0.2s;" />
                    <!-- Search Results dropdown -->
                    <div id="compareSearchResults" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; z-index: 100; max-height: 250px; overflow-y: auto; margin-top: 6px; box-shadow: var(--shadow-lg);"></div>
                </div>

                <!-- Compare deck slots -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Comparison Deck (Max 5 Players)</label>
                    <div id="compareDeck" style="display: flex; gap: 8px; flex-wrap: wrap; min-height: 48px; align-items: center; background: rgba(0, 0, 0, 0.1); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; width: 100%;">
                        <!-- Dynamic compare cards will display here -->
                    </div>
                </div>

            </div>

            <!-- Comparison Results Grid Section -->
            <div id="compareResultsSection" style="display: none; flex-direction: column; gap: 24px; width: 100%;">
                <!-- Dynamic comparison table -->
                <div class="stats-table-wrapper" style="width: 100%;">
                    <table class="stats-table" id="compareStatsTable" style="width: 100%;">
                        <!-- Content rendered in JS -->
                    </table>
                </div>

                <!-- AI Analysis Card -->
                <div class="optimizer-card" id="compareAiAnalysisCard" style="background: linear-gradient(135deg, var(--bg-card), rgba(139, 92, 246, 0.05)); border: 1px solid rgba(139, 92, 246, 0.2); padding: 24px; border-radius: 16px;">
                    <!-- Content rendered in JS -->
                </div>
            </div>
        </div>
    `;

    const resultsSection = container.querySelector('#compareResultsSection');
    const statsTable = container.querySelector('#compareStatsTable');
    const aiAnalysisCard = container.querySelector('#compareAiAnalysisCard');

    const currentGw = (state && state.currentGw) ? state.currentGw : 1;

    // Main comparison runner
    const runComparison = () => {
        const players = selectedIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
        if (players.length < 2) {
            if (resultsSection) resultsSection.style.display = 'none';
            return;
        }

        // Build stats grid table columns
        let tableHtml = `
            <thead>
                <tr>
                    <th style="font-weight: 700 !important; background: var(--bg-panel); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Metric</th>
                    ${players.map(p => `
                        <th style="font-weight: 700 !important; text-align: center; color: var(--primary); background: var(--bg-panel);">
                            <div style="font-size: 13px; font-weight: 800;">${p.name || 'Unknown'}</div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">${p.position || 'MID'} • ${p.team || 'UNK'}</div>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Price</td>
                    ${players.map(p => `<td style="text-align: center; font-weight: 700; color: var(--text-main);">£${(p.price || 0).toFixed(1)}m</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Ownership</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.ownership || 0).toFixed(1)}%</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Total Points</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main); font-weight: 600;">${p.points || 0}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Expected Points (GW${currentGw})</td>
                    ${players.map(p => {
                        const pred = ((p.predictions || []).find(pr => pr.gw === currentGw) || { pts: 0 }).pts || 0;
                        return `<td style="text-align: center; font-weight: bold; color: var(--secondary);">${pred.toFixed(1)}</td>`;
                    }).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">10-GW Expected Points</td>
                    ${players.map(p => `<td style="text-align: center; font-weight: bold; color: var(--primary);">${(p.xp10 || 0).toFixed(1)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Expected Goals (xG)</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.xG || 0).toFixed(2)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">xG per 90 (xG90)</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.xG90 || 0).toFixed(2)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Expected Assists (xA)</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.xA || 0).toFixed(2)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">xA per 90 (xA90)</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.xA90 || 0).toFixed(2)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">xG Involvement (xGI)</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main); font-weight: 600;">${(p.xGI || 0).toFixed(2)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">ICT Index</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.ictIndex || 0).toFixed(1)}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Games Started</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${p.GS || 0}</td>`).join('')}
                </tr>
                <tr>
                    <td style="font-weight: 600; color: var(--text-muted);">Avg Minutes Per Game</td>
                    ${players.map(p => `<td style="text-align: center; color: var(--text-main);">${(p.MPPG || 0).toFixed(1)}</td>`).join('')}
                </tr>
            </tbody>
        `;
        if (statsTable) statsTable.innerHTML = tableHtml;

        // Generate AI analysis report content
        const reportHtml = generateAiComparisonReport(players, state);
        if (aiAnalysisCard) aiAnalysisCard.innerHTML = reportHtml;

        if (resultsSection) resultsSection.style.display = 'flex';
        
        if (window.lucide) {
            window.lucide.createIcons();
        } else if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    };

    // Render deck chips on load
    const updateCompareDeck = () => {
        const deck = container.querySelector('#compareDeck');
        if (!deck) return;
        if (selectedIds.length === 0) {
            deck.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No players selected. Search and add up to 5 players to compare.</span>`;
            if (resultsSection) resultsSection.style.display = 'none';
            return;
        }
        deck.innerHTML = selectedIds.map(id => {
            const p = PLAYERS.find(pl => pl.id === id);
            if (!p) return '';
            return `
                <div class="stat-pill" style="padding: 6px 12px; display: flex; align-items: center; gap: 8px; background: rgba(0, 255, 136, 0.05); border: 1px solid var(--primary-glow); border-radius: 20px; font-size: 12px;">
                    <span style="font-weight: 700; color: var(--text-main);">${p.name || 'Unknown'} (${p.team || 'UNK'} • ${p.position || 'MID'})</span>
                    <button class="remove-compare-player-btn" data-id="${p.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; padding: 0 2px; transition: color 0.2s;"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
                </div>
            `;
        }).join('');
        
        if (window.lucide) {
            window.lucide.createIcons();
        } else if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Bind remove actions
        deck.querySelectorAll('.remove-compare-player-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                selectedIds = selectedIds.filter(x => x !== id);
                updateCompareDeck();
                runComparison(); // Automatically run comparison on remove
            });
        });
    };

    updateCompareDeck();

    // Search event handling
    const searchInput = container.querySelector('#playerCompareSearch');
    const searchResults = container.querySelector('#compareSearchResults');

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                if (searchResults) searchResults.style.display = 'none';
                return;
            }

            const matches = PLAYERS.filter(p => p.name && p.name.toLowerCase().includes(query))
                                   .filter(p => !selectedIds.includes(p.id))
                                   .slice(0, 10);

            if (searchResults) {
                if (matches.length === 0) {
                    searchResults.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">No matching players found.</div>`;
                } else {
                    searchResults.innerHTML = matches.map(p => `
                        <div class="search-result-item" data-id="${p.id}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s;">
                            <div>
                                <strong style="color: var(--text-main); font-size: 13px;">${p.name || 'Unknown'}</strong>
                                <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${p.position || 'MID'} • ${p.team || 'UNK'}</span>
                            </div>
                            <span style="font-size: 12px; color: var(--primary); font-weight: 700;">£${(p.price || 0).toFixed(1)}m</span>
                        </div>
                    `).join('');
                }
                searchResults.style.display = 'block';

                // Bind clicks on search items
                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = parseInt(item.getAttribute('data-id'));
                        if (selectedIds.length >= 5) {
                            if (actions && actions.showToast) {
                                actions.showToast("You can compare up to 5 players at a time.", "error");
                            }
                            return;
                        }
                        selectedIds.push(id);
                        searchInput.value = '';
                        searchResults.style.display = 'none';
                        updateCompareDeck();
                        runComparison(); // Automatically run comparison on add
                    });
                });
            }
        });
    }

    // Close search dropdown when clicking outside
    document.addEventListener('click', e => {
        if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
            searchResults.style.display = 'none';
        }
    });



    // Run initial comparison on load with default selected midfielders
    runComparison();
}

// Logic-based FPL Advisor comparison report
function generateAiComparisonReport(players, state) {
    const currentGw = (state && state.currentGw) ? state.currentGw : 1;

    const sortedByGwXp = [...players].sort((a, b) => {
        const predA = ((a.predictions || []).find(pr => pr.gw === currentGw) || { pts: 0 }).pts || 0;
        const predB = ((b.predictions || []).find(pr => pr.gw === currentGw) || { pts: 0 }).pts || 0;
        return predB - predA;
    });

    const sortedByXp10 = [...players].sort((a, b) => (b.xp10 || 0) - (a.xp10 || 0));
    const sortedByValue = [...players].sort((a, b) => ((b.xp10 || 0) / (b.price || 1)) - ((a.xp10 || 0) / (a.price || 1)));
    const sortedByXg = [...players].sort((a, b) => (b.xG || 0) - (a.xG || 0));

    // Compute dynamic scores
    const scoredPlayers = players.map(p => {
        const gwXp = ((p.predictions || []).find(pr => pr.gw === currentGw) || { pts: 0 }).pts || 0;
        const xp10 = p.xp10 || 0;
        const price = p.price || 1;
        const valueRatio = xp10 / price; // points per million
        const optaScore = p.xGI || 0; // xGI is season expected goal involvement

        // Overall score logic: 40% 10-GW expectation + 30% value + 20% immediate GW projection + 10% underlying OPTA strength
        const score = (xp10 * 0.40) + (valueRatio * 5.0) + (gwXp * 0.20) + (optaScore * 0.20);
        return { player: p, score: score, gwXp: gwXp, valueRatio: valueRatio };
    });

    scoredPlayers.sort((a, b) => b.score - a.score);

    const recommended = scoredPlayers[0].player;
    const runnerUp = scoredPlayers.length > 1 ? scoredPlayers[1].player : null;

    // Format analysis bullet points dynamically
    return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-family: var(--font-heading); margin: 0; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="sparkles" style="color: var(--secondary); width: 18px; height: 18px;"></i> FPL AI Advisor Recommendation
                </h3>
                <span class="logo-badge" style="background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #000; font-weight: 800; padding: 4px 12px; border-radius: 20px; font-size: 11px;">
                    AI PICK: ${recommended.name || 'Unknown'}
                </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13.5px; line-height: 1.6; color: var(--text-main);">
                <!-- Recommended Pick Header -->
                <p>
                    Based on an algorithmic evaluation of expected points, price configurations, and underlying OPTA threat metrics, we recommend recruiting 
                    <strong style="color: var(--primary);">${recommended.name || 'Unknown'}</strong> (${recommended.position || 'MID'} • ${recommended.team || 'UNK'}) as your primary target.
                </p>

                <!-- Comparative Highlights -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px;">
                        <strong style="color: var(--secondary); font-size: 12px; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">👑 Projections King</strong>
                        <span style="font-size: 13px;">
                            <strong>${sortedByXp10[0].name || 'Unknown'}</strong> leads long-term projections with a total expected output of 
                            <strong style="color: var(--primary);">${(sortedByXp10[0].xp10 || 0).toFixed(1)} Expected Points</strong> over the next 10 gameweeks.
                        </span>
                    </div>

                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px;">
                        <strong style="color: var(--accent-purple); font-size: 12px; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">💎 Value Engine</strong>
                        <span style="font-size: 13px;">
                            <strong>${sortedByValue[0].name || 'Unknown'}</strong> offers the best value-for-money, generating 
                            <strong style="color: var(--primary);">${((sortedByValue[0].xp10 || 0) / (sortedByValue[0].price || 1)).toFixed(2)} XP per million</strong> spent.
                        </span>
                    </div>

                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px;">
                        <strong style="color: #fbbf24; font-size: 12px; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">⚽ Underlying Goal Threat</strong>
                        <span style="font-size: 13px;">
                            <strong>${sortedByXg[0].name || 'Unknown'}</strong> is generating the highest shot quality, accumulating 
                            <strong style="color: var(--primary);">${(sortedByXg[0].xG || 0).toFixed(2)} Expected Goals (xG)</strong> over the current season.
                        </span>
                    </div>
                </div>

                <!-- Final Advisor Verdict -->
                <div style="margin-top: 8px; border-left: 3px solid var(--primary); padding-left: 12px; background: rgba(0, 255, 136, 0.02); padding-top: 8px; padding-bottom: 8px; border-radius: 0 8px 8px 0;">
                    <strong>Advisor Verdict:</strong>
                    <span style="color: var(--text-muted); font-size: 13px;">
                        If you have budget to spare, <strong>${sortedByXp10[0].name || 'Unknown'}</strong> remains the absolute best pick for raw expected output. However, taking squad value and structural flexibility into account, 
                        <strong>${recommended.name || 'Unknown'}</strong> scores the highest overall rating of <strong>${(scoredPlayers[0].score).toFixed(1)}/100</strong>. 
                        ${runnerUp ? `If you are looking for a cheaper differential option, consider <strong>${runnerUp.name || 'Unknown'}</strong> who scored the second highest rating with ${(scoredPlayers[1].score).toFixed(1)}/100.` : ''}
                    </span>
                </div>
            </div>
        </div>
    `;
}
