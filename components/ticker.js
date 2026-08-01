import { TEAMS, TICKER_DATA } from '../data.js';

// Exact Clean Sheet Odds % lookup from FFS ticker screenshots for GW1-5
const CS_ODDS_LOOKUP = {
    ARS: [57, 37, 46, 43, 42],
    AVL: [26, 12, 34, 33, 23],
    BOU: [18, 34, 22, 37, 25],
    BRE: [34, 31, 39, 22, 34],
    BHA: [32, 23, 41, 35, 15],
    CHE: [29, 43, 9, 51, 27],
    COV: [5, 37, 10, 28, 21],
    CRY: [32, 24, 33, 45, 36],
    EVE: [23, 16, 24, 18, 34],
    FUL: [25, 22, 25, 13, 26],
    HUL: [23, 25, 21, 15, 12],
    IPS: [29, 19, 18, 16, 21],
    LEE: [26, 34, 25, 25, 28],
    LIV: [30, 50, 44, 51, 34],
    MCI: [41, 39, 57, 43, 51],
    MUN: [39, 46, 30, 26, 31],
    NEW: [30, 26, 32, 31, 51],
    NFO: [30, 16, 23, 20, 35],
    SUN: [27, 32, 20, 11, 11],
    TOT: [29, 29, 32, 34, 30]
};

// Exact Projected Goals lookup from FFS ticker screenshots for GW1-5
const PROJ_GOALS_LOOKUP = {
    ARS: [3.03, 2.06, 2.35, 2.17, 1.85],
    AVL: [1.12, 0.99, 1.55, 1.60, 1.19],
    BOU: [0.87, 1.81, 1.11, 1.47, 1.07],
    BRE: [1.21, 1.07, 1.57, 0.97, 1.28],
    BHA: [1.34, 0.83, 1.35, 1.24, 0.84],
    CHE: [1.34, 1.44, 0.75, 1.90, 1.05],
    COV: [0.55, 1.36, 0.55, 1.03, 1.03],
    CRY: [1.42, 0.92, 1.35, 1.82, 1.27],
    EVE: [1.11, 1.06, 1.17, 1.05, 1.55],
    FUL: [1.22, 1.11, 1.10, 0.67, 1.16],
    HUL: [0.93, 0.98, 1.07, 0.66, 0.67],
    IPS: [1.29, 0.76, 0.80, 0.79, 1.06],
    LEE: [1.17, 1.16, 0.88, 1.14, 1.01],
    LIV: [1.18, 1.81, 1.70, 2.04, 1.37],
    MCI: [1.71, 1.39, 2.29, 1.34, 2.18],
    MUN: [1.46, 1.63, 1.40, 0.83, 1.33],
    NEW: [1.18, 1.22, 1.51, 1.36, 2.06],
    NFO: [1.31, 0.68, 1.12, 1.07, 1.53],
    SUN: [1.22, 1.50, 0.91, 0.82, 0.66],
    TOT: [1.06, 1.34, 1.43, 1.67, 1.43]
};

function getCleanSheetOdds(teamShort, opponentShort, loc, gw, diff = 3) {
    const list = CS_ODDS_LOOKUP[teamShort];
    if (list && list[gw - 1] !== undefined) {
        return list[gw - 1];
    }
    // Dynamic formula for GW6-10
    let odds = 30;
    if (diff === 2) odds = 48;
    else if (diff === 4) odds = 18;
    else if (diff === 5) odds = 8;
    if (loc === 'H') odds += 5;
    else odds -= 5;
    return Math.max(5, Math.min(65, odds));
}

function getProjectedGoals(teamShort, opponentShort, loc, gw, diff = 3) {
    const list = PROJ_GOALS_LOOKUP[teamShort];
    if (list && list[gw - 1] !== undefined) {
        return list[gw - 1];
    }
    // Dynamic formula for GW6-10
    let goals = 1.4;
    if (diff === 2) goals = 2.2;
    else if (diff === 4) goals = 1.0;
    else if (diff === 5) goals = 0.6;
    if (loc === 'H') goals += 0.25;
    else goals -= 0.25;
    return Math.max(0.4, Math.min(3.5, parseFloat(goals.toFixed(2))));
}

export function renderTicker(container, state, actions) {
    let mode = container.dataset.tickerMode || 'fdr';
    let sortCol = container.dataset.sortCol || 'avg';
    let sortAsc = container.dataset.sortAsc !== undefined ? container.dataset.sortAsc === 'true' : (mode === 'fdr');

    const renderTable = () => {
        const teamsSorted = TEAMS.map(team => {
            const fixtures = TICKER_DATA[team.shortName] || [];
            
            let adjustedFixtures = [];
            let avg = 0;

            if (mode === 'cleansheet') {
                adjustedFixtures = fixtures.map(f => {
                    const odds = getCleanSheetOdds(team.shortName, f.opp, f.loc, f.gw, f.diff);
                    let diffClass = 'diff-3';
                    if (odds >= 38) diffClass = 'diff-2';
                    else if (odds >= 28) diffClass = 'diff-3';
                    else if (odds >= 18) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: `${odds}%`, numeric: odds, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else if (mode === 'goals') {
                adjustedFixtures = fixtures.map(f => {
                    const goals = getProjectedGoals(team.shortName, f.opp, f.loc, f.gw, f.diff);
                    let diffClass = 'diff-3';
                    if (goals >= 1.8) diffClass = 'diff-2';
                    else if (goals >= 1.3) diffClass = 'diff-3';
                    else if (goals >= 0.9) diffClass = 'diff-4';
                    else diffClass = 'diff-5';
                    return { ...f, val: goals.toFixed(2), numeric: goals, diffClass };
                });
                avg = adjustedFixtures.reduce((sum, f) => sum + f.numeric, 0) / adjustedFixtures.length;
            } else {
                adjustedFixtures = fixtures.map(f => {
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
                valA = a.name;
                valB = b.name;
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
                            <span class="team-name-ticker">${team.name}</span>
                        </div>
                    </td>
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(gw => {
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
                <div class="ticker-btn-group">
                    <button class="ticker-tab-btn ${mode === 'fdr' ? 'active' : ''}" data-mode="fdr">Difficulty (FDR)</button>
                    <button class="ticker-tab-btn ${mode === 'cleansheet' ? 'active' : ''}" data-mode="cleansheet">Clean Sheet %</button>
                    <button class="ticker-tab-btn ${mode === 'goals' ? 'active' : ''}" data-mode="goals">Projected Goals</button>
                </div>
            </div>
 
            <!-- Ticker Grid Table -->
            <div class="ticker-grid-wrapper">
                <table class="ticker-table">
                    <thead>
                        <tr>
                            <th data-col="name" style="text-align: left; width: 180px; cursor: pointer;">Team ${getHeaderArrow('name')}</th>
                            <th data-col="GW1" style="cursor: pointer;">GW1 ${getHeaderArrow('GW1')}</th>
                            <th data-col="GW2" style="cursor: pointer;">GW2 ${getHeaderArrow('GW2')}</th>
                            <th data-col="GW3" style="cursor: pointer;">GW3 ${getHeaderArrow('GW3')}</th>
                            <th data-col="GW4" style="cursor: pointer;">GW4 ${getHeaderArrow('GW4')}</th>
                            <th data-col="GW5" style="cursor: pointer;">GW5 ${getHeaderArrow('GW5')}</th>
                            <th data-col="GW6" style="cursor: pointer;">GW6 ${getHeaderArrow('GW6')}</th>
                            <th data-col="GW7" style="cursor: pointer;">GW7 ${getHeaderArrow('GW7')}</th>
                            <th data-col="GW8" style="cursor: pointer;">GW8 ${getHeaderArrow('GW8')}</th>
                            <th data-col="GW9" style="cursor: pointer;">GW9 ${getHeaderArrow('GW9')}</th>
                            <th data-col="GW10" style="cursor: pointer;">GW10 ${getHeaderArrow('GW10')}</th>
                            <th data-col="avg" style="cursor: pointer;">${avgColName} ${getHeaderArrow('avg')}</th>
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
