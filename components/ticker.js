import { TEAMS, TICKER_DATA } from '../data.js';
import * as DataModule from '../data.js';
import { getCleanSheetProb, getAttackMultiplier } from '../lib/predictionModel.js';

// Namespace import (not a named import) for LEAGUE_AVG_GOALS_PER_GAME: same reasoning as
// app.js's XP_CALIBRATION_FACTOR handling -- a named import of a field data.js might not yet
// have (e.g. right after a merge, before the next sync bakes it in) is a hard Vite build-time
// error, not a runtime-catchable undefined.
const LEAGUE_AVG_GOALS_PER_GAME = (typeof DataModule.LEAGUE_AVG_GOALS_PER_GAME === 'number') ? DataModule.LEAGUE_AVG_GOALS_PER_GAME : 1.4;

const OPPONENTS = ["ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL", "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"];

function getFixtureForGw(teamShort, gw) {
    const list = TICKER_DATA[teamShort] || [];
    const existing = list.find(f => f.gw === gw);
    if (existing) return existing;

    // Dynamically generate deterministic fixture for GW > 10
    const availableOpps = OPPONENTS.filter(o => o !== teamShort);
    const hash = (teamShort.charCodeAt(0) + (teamShort.charCodeAt(1) || 0) + gw) % availableOpps.length;
    const opp = availableOpps[hash];
    const loc = (teamShort.charCodeAt(0) + gw) % 2 === 0 ? 'H' : 'A';
    
    let diff = 3;
    if (["ARS", "MCI", "LIV"].includes(opp)) diff = 4;
    else if (["CHE", "MUN", "NEW", "TOT", "AVL"].includes(opp)) diff = 3;
    else if (["HUL", "COV", "IPS"].includes(opp)) diff = 2;

    return {
        gw,
        opp,
        loc,
        diff
    };
}

export function renderTicker(container, state, actions) {
    let mode = container.dataset.tickerMode || 'fdr';
    let horizon = parseInt(container.dataset.tickerHorizon || '5');
    let sortCol = container.dataset.sortCol || 'avg';
    let sortAsc = container.dataset.sortAsc !== undefined ? container.dataset.sortAsc === 'true' : (mode === 'fdr');

    const startGw = state.currentGw || 1;
    const gwIndices = Array.from({ length: horizon }, (_, i) => startGw + i);

    // Reset sort column if it exceeds current horizon display window
    if (sortCol.startsWith('GW')) {
        const gwNum = parseInt(sortCol.replace('GW', ''));
        if (gwNum < startGw || gwNum >= startGw + horizon) {
            sortCol = 'avg';
        }
    }

    const renderTable = () => {
        const teamsSorted = TEAMS.map(team => {
            const activeFixtures = gwIndices.map(gw => getFixtureForGw(team.shortName, gw));
            
            let adjustedFixtures = [];
            let avg = 0;

            if (mode === 'cleansheet') {
                adjustedFixtures = activeFixtures.map(f => {
                    const odds = Math.round(getCleanSheetProb(f) * 100);
                    let diffClass = 'diff-3';
                    if (odds >= 38) diffClass = 'diff-2';
                    else if (odds >= 28) diffClass = 'diff-3';
                    else if (odds >= 18) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: `${odds}%`, numeric: odds, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else if (mode === 'goals') {
                adjustedFixtures = activeFixtures.map(f => {
                    const multiplier = getAttackMultiplier(f);
                    const goals = Math.max(0.4, Math.min(3.5, parseFloat((LEAGUE_AVG_GOALS_PER_GAME * multiplier).toFixed(2))));
                    let diffClass = 'diff-3';
                    if (goals >= 1.8) diffClass = 'diff-2';
                    else if (goals >= 1.3) diffClass = 'diff-3';
                    else if (goals >= 0.9) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: goals.toFixed(2), numeric: goals, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else {
                adjustedFixtures = activeFixtures.map(f => {
                    return { ...f, val: `FDR ${f.diff}`, numeric: f.diff, diffClass: `diff-${f.diff}` };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            }

            return {
                ...team,
                fixtures: adjustedFixtures,
                avg: avg
            };
        });

        // Dynamic Sort algorithm
        teamsSorted.sort((a, b) => {
            let valA, valB;
            if (sortCol === 'name') {
                valA = a.shortName;
                valB = b.shortName;
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortCol.startsWith('GW')) {
                const gwNum = parseInt(sortCol.replace('GW', ''));
                valA = a.fixtures.find(f => f.gw === gwNum)?.numeric || 0;
                valB = b.fixtures.find(f => f.gw === gwNum)?.numeric || 0;
            } else {
                // sort by average
                valA = a.avg;
                valB = b.avg;
            }
            return sortAsc ? valA - valB : valB - valA;
        });

        const tableBody = container.querySelector('#tickerTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = teamsSorted.map(team => {
            let avgDisplay = team.avg.toFixed(1);
            if (mode === 'cleansheet') avgDisplay = `${team.avg.toFixed(1)}%`;
            else if (mode === 'goals') avgDisplay = team.avg.toFixed(2);

            return `
                <tr>
                    <td>
                        <div class="team-row-meta">
                            <span class="team-color-dot" style="background-color: ${team.color};"></span>
                            <span class="team-name-ticker">${team.shortName}</span>
                        </div>
                    </td>
                    ${gwIndices.map(gw => {
                        const f = team.fixtures.find(fi => fi.gw === gw) || { opp: 'BYE', loc: 'H', val: 'BYE', diffClass: 'diff-3' };
                        return `
                            <td>
                                <div class="difficulty-cell ${f.diffClass}">
                                    <span class="fixture-opp-lbl">${f.opp !== 'BYE' ? `${f.opp} (${f.loc})` : 'BYE'}</span>
                                    <span class="fixture-metric-lbl" style="font-size: 10px; font-weight:700; opacity:0.9; margin-top:2px;">${f.val}</span>
                                </div>
                            </td>
                        `;
                    }).join('')}
                    <td style="font-weight:700;">${avgDisplay}</td>
                </tr>
            `;
        }).join('');
    };

    const getHeaderArrow = (colName) => {
        if (sortCol !== colName) return '<span style="font-size: 9px; opacity: 0.4; margin-left: 2px;">↕</span>';
        return sortAsc ? '<span style="font-size: 9px; color: var(--primary); margin-left: 2px;">↑</span>' : '<span style="font-size: 9px; color: var(--primary); margin-left: 2px;">↓</span>';
    };

    const avgColName = mode === 'cleansheet' ? 'Avg CS %' : (mode === 'goals' ? 'Avg Goals' : 'Avg Diff');

    container.innerHTML = `
        <div class="ticker-view-container">
            <div class="ticker-controls-card">
                <div class="ticker-title-area">
                    <h2 style="font-family: var(--font-heading); font-weight:700; margin-bottom: 4px;">Fixture Difficulty Ticker</h2>
                    <p style="color: var(--text-muted); font-size: 13px;">Plan transfer rotations by identifying teams with easy scheduling streaks. Click column headers to sort.</p>
                </div>
                <div class="ticker-btn-group-wrapper" style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: space-between; width: 100%; align-items: center; margin-top: 8px;">
                    <div class="ticker-btn-group">
                        <button class="ticker-tab-btn ${mode === 'fdr' ? 'active' : ''}" data-mode="fdr">Difficulty (FDR)</button>
                        <button class="ticker-tab-btn ${mode === 'cleansheet' ? 'active' : ''}" data-mode="cleansheet">Clean Sheet %</button>
                        <button class="ticker-tab-btn ${mode === 'goals' ? 'active' : ''}" data-mode="goals">Projected Goals</button>
                    </div>
                    <div class="ticker-horizon-group" style="display: flex; gap: 4px; background: rgba(0, 0, 0, 0.04); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <button class="ticker-horizon-btn ${horizon === 5 ? 'active' : ''}" data-horizon="5" style="border: none; background: ${horizon === 5 ? 'var(--primary)' : 'transparent'}; color: ${horizon === 5 ? '#ffffff' : 'var(--text-muted)'}; padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: all var(--transition-fast);">5 GWs</button>
                        <button class="ticker-horizon-btn ${horizon === 10 ? 'active' : ''}" data-horizon="10" style="border: none; background: ${horizon === 10 ? 'var(--primary)' : 'transparent'}; color: ${horizon === 10 ? '#ffffff' : 'var(--text-muted)'}; padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: all var(--transition-fast);">10 GWs</button>
                    </div>
                </div>
            </div>
 
            <!-- Ticker Grid Table -->
            <div class="ticker-grid-wrapper" style="width: 100%; overflow-x: auto;">
                <table class="ticker-table">
                    <thead>
                        <tr>
                            <th data-col="name" style="text-align: left; width: 80px; cursor: pointer;">Team ${getHeaderArrow('name')}</th>
                            ${gwIndices.map(gw => `
                                <th data-col="GW${gw}" style="cursor: pointer; text-align: center;">GW${gw} ${getHeaderArrow(`GW${gw}`)}</th>
                            `).join('')}
                            <th data-col="avg" style="cursor: pointer; text-align: center;">${avgColName} ${getHeaderArrow('avg')}</th>
                        </tr>
                    </thead>
                    <tbody id="tickerTableBody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    // Mode Buttons Listeners
    container.querySelectorAll('.ticker-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextMode = btn.getAttribute('data-mode');
            container.dataset.tickerMode = nextMode;
            const defaultAsc = (nextMode === 'fdr');
            container.dataset.sortCol = 'avg';
            container.dataset.sortAsc = defaultAsc;
            renderTicker(container, state, actions);
        });
    });

    // Horizon Buttons Listeners
    container.querySelectorAll('.ticker-horizon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextHorizon = btn.getAttribute('data-horizon');
            container.dataset.tickerHorizon = nextHorizon;
            renderTicker(container, state, actions);
        });
    });

    // Column Header Sorting Listeners
    container.querySelectorAll('.ticker-table th').forEach(th => {
        th.addEventListener('click', () => {
            const clickedCol = th.getAttribute('data-col');
            if (sortCol === clickedCol) {
                sortAsc = !sortAsc;
            } else {
                sortCol = clickedCol;
                sortAsc = (mode === 'fdr' || clickedCol === 'name');
            }
            container.dataset.sortCol = sortCol;
            container.dataset.sortAsc = sortAsc;
            renderTicker(container, state, actions);
        });
    });
}
