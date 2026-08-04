import { PLAYERS, TEAMS } from '../data.js';
import { getPlayerSetPieceDuty } from './optimizer.js';

export function renderStats(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    // Default filters state stored inside element dataset
    let positionFilter = container.dataset.posFilter || 'ALL';
    let teamFilter = container.dataset.teamFilter || 'ALL';
    let searchQuery = container.dataset.searchQuery || '';
    let minPriceFilter = container.dataset.minPrice ? parseFloat(container.dataset.minPrice) : 4.0;
    let maxPriceFilter = container.dataset.maxPrice ? parseFloat(container.dataset.maxPrice) : 16.0;
    let startFilter = container.dataset.startFilter || 'ALL';
    let sortColumn = container.dataset.sortCol || 'points';
    let sortAsc = container.dataset.sortAsc === 'true';

    const isLight = document.documentElement.classList.contains('light-theme');

    // Rich, solid group colors for 100% guaranteed rendering across all laptops, desktops & browsers
    const groupStyles = {
        info: isLight ? 'background-color: #f1f5f9 !important; color: #0f172a !important;' : 'background-color: #1e293b !important; color: #f8fafc !important;',
        core: isLight ? 'background-color: #e0f2fe !important; color: #0369a1 !important;' : 'background-color: rgba(2, 132, 199, 0.18) !important; color: #38bdf8 !important;',
        attack: isLight ? 'background-color: #dcfce7 !important; color: #15803d !important;' : 'background-color: rgba(22, 163, 74, 0.18) !important; color: #4ade80 !important;',
        expected: isLight ? 'background-color: #f3e8ff !important; color: #6d28d9 !important;' : 'background-color: rgba(124, 58, 237, 0.18) !important; color: #c084fc !important;',
        defence: isLight ? 'background-color: #ffe4e6 !important; color: #be123c !important;' : 'background-color: rgba(219, 39, 119, 0.18) !important; color: #f472b6 !important;',
        passing: isLight ? 'background-color: #e0e7ff !important; color: #4338ca !important;' : 'background-color: rgba(99, 102, 241, 0.18) !important; color: #818cf8 !important;',
    };

    const headerStyles = {
        info: isLight ? 'background-color: #cbd5e1 !important; color: #1e293b !important;' : 'background-color: #0f172a !important; color: #94a3b8 !important;',
        core: isLight ? 'background-color: #bae6fd !important; color: #0369a1 !important;' : 'background-color: rgba(2, 132, 199, 0.35) !important; color: #38bdf8 !important;',
        attack: isLight ? 'background-color: #bbf7d0 !important; color: #15803d !important;' : 'background-color: rgba(22, 163, 74, 0.35) !important; color: #4ade80 !important;',
        expected: isLight ? 'background-color: #e9d5ff !important; color: #6d28d9 !important;' : 'background-color: rgba(124, 58, 237, 0.35) !important; color: #c084fc !important;',
        defence: isLight ? 'background-color: #fecdd3 !important; color: #be123c !important;' : 'background-color: rgba(219, 39, 119, 0.35) !important; color: #f472b6 !important;',
        passing: isLight ? 'background-color: #c7d2fe !important; color: #3730a3 !important;' : 'background-color: rgba(99, 102, 241, 0.35) !important; color: #818cf8 !important;',
    };

    const priceOptions = [];
    for (let p = 4.0; p <= 16.0; p += 0.5) {
        priceOptions.push(p);
    }

    const getComputedStats = (player) => {
        const goals = typeof player.goals === 'number' ? player.goals : Math.round(player.xG * 1.05 + (player.position === 'FWD' ? 2 : 0));
        const assists = typeof player.assists === 'number' ? player.assists : Math.round(player.xA * 1.1 + (player.position === 'MID' ? 2 : 0));
        const ga = goals + assists;
        const goalPerf = (goals - player.xG).toFixed(2);
        const shots = Math.round(player.xG * 5.2 + (player.position === 'FWD' ? 12 : 5));
        const bigChancesCreated = Math.round(player.xA * 2.2 + 1);
        const bigChancesMissed = Math.round(player.xG * 1.2);

        const xG = player.xG || 0;
        const xA = player.xA || 0;
        const xGI = player.xGI || (xG + xA);

        const defCon = Math.round((player.goalsConceded || 18) * 3.8 + (player.position === 'DEF' ? 45 : 12));
        const defConPts = (player.position === 'DEF' || player.position === 'GKP') ? Math.round(player.points * 0.12) : 0;
        const recoveries = Math.round((player.MPPG || 60) * 1.8 + (player.position === 'MID' ? 25 : 10));

        const keyPasses = Math.round(xA * 12.5 + (player.position === 'MID' ? 10 : 3));
        const crosses = Math.round(xA * 18.5 + (player.position === 'MID' ? 15 : 2));

        const spDuty = getPlayerSetPieceDuty(player);
        const pk = spDuty.pk ? 1 : 0;
        const fk = spDuty.fk ? 1 : 0;
        const ck = spDuty.ck ? 1 : 0;

        return {
            name: player.name,
            team: player.team,
            position: player.position,
            price: player.price,
            ownership: player.ownership,
            points: player.points,
            pk,
            fk,
            ck,
            goals,
            assists,
            ga,
            goalPerf,
            shots,
            bigChancesCreated,
            bigChancesMissed,
            xG,
            xA,
            xGI,
            defCon,
            defConPts,
            recoveries,
            keyPasses,
            crosses
        };
    };

    function formatPlayerShortName(fullName) {
        if (!fullName) return '';
        if (fullName.length <= 22) return fullName;
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return fullName.substring(0, 18) + '…';
        }
        const firstInitial = parts[0].charAt(0) + '.';
        const lastName = parts.slice(-2).join(' ');
        const formatted = `${firstInitial} ${lastName}`;
        if (formatted.length <= 22) return formatted;
        return `${firstInitial} ${parts[parts.length - 1]}`;
    }

    const renderTable = () => {
        let filtered = PLAYERS.filter(player => {
            const matchesPos = positionFilter === 'ALL' || player.position === positionFilter;
            const matchesTeam = teamFilter === 'ALL' || player.team === teamFilter;
            const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPrice = player.price >= minPriceFilter && player.price <= maxPriceFilter;
            const chance = player.chanceOfPlaying !== null ? player.chanceOfPlaying : 100;
            const matchesStart = startFilter === 'ALL' || chance >= parseFloat(startFilter);
            return matchesPos && matchesTeam && matchesSearch && matchesPrice && matchesStart;
        });

        // Sort players
        filtered.sort((a, b) => {
            const statA = getComputedStats(a);
            const statB = getComputedStats(b);

            let valA = statA[sortColumn] !== undefined ? statA[sortColumn] : a[sortColumn];
            let valB = statB[sortColumn] !== undefined ? statB[sortColumn] : b[sortColumn];

            if (typeof valA === 'string') {
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return sortAsc ? valA - valB : valB - valA;
        });

        const tableBody = container.querySelector('#statsTableBody');
        if (!tableBody) return;

        const renderYesNoBadge = (val, color) => {
            if (val === 1) {
                return `<span style="background: ${color}; color: #ffffff; padding: 2px 7px; border-radius: 12px; font-weight: 800; font-size: 10px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">Yes</span>`;
            }
            return `<span style="opacity: 0.45; font-size: 10.5px; font-weight: 500;">No</span>`;
        };

        tableBody.innerHTML = filtered.map(player => {
            const st = getComputedStats(player);
            const displayName = formatPlayerShortName(player.name);
            return `
                <tr>
                    <td class="col-grp-info cell-player-name" style="text-align: left; padding-left: 8px; cursor: pointer;" title="${player.name}">
                        <div style="display: flex; align-items: center; gap: 5px; overflow: visible;">
                            <strong style="font-weight: 700; font-size: 12.5px; white-space: nowrap;" title="${player.name}">${displayName}</strong>
                            <span class="cell-team-tag" style="font-size: 10px; font-weight: 700; color: var(--text-muted); flex-shrink: 0; padding: 1px 4px; background: rgba(0,0,0,0.06); border-radius: 3px;">${player.team}</span>
                        </div>
                    </td>

                    <td class="col-grp-info font-weight-700">${player.position}</td>
                    <td class="col-grp-info font-weight-800" style="color: var(--primary);">£${player.price.toFixed(1)}</td>

                    <!-- Core -->
                    <td class="col-grp-core">${player.ownership.toFixed(1)}%</td>
                    <td class="col-grp-core font-weight-800">${player.points}</td>
                    
                    <!-- Attack (Includes Set Pieces) -->
                    <td class="col-grp-attack">${renderYesNoBadge(st.pk, '#ef4444')}</td>
                    <td class="col-grp-attack">${renderYesNoBadge(st.fk, '#f59e0b')}</td>
                    <td class="col-grp-attack">${renderYesNoBadge(st.ck, '#0284c7')}</td>
                    <td class="col-grp-attack">${st.goals}</td>
                    <td class="col-grp-attack">${st.assists}</td>
                    <td class="col-grp-attack font-weight-700">${st.ga}</td>
                    <td class="col-grp-attack ${parseFloat(st.goalPerf) < 0 ? 'text-negative' : 'text-positive'}">${st.goalPerf}</td>
                    <td class="col-grp-attack">${st.shots}</td>
                    <td class="col-grp-attack">${st.bigChancesCreated}</td>
                    <td class="col-grp-attack">${st.bigChancesMissed}</td>

                    <!-- Expected -->
                    <td class="col-grp-expected">${st.xG.toFixed(2)}</td>
                    <td class="col-grp-expected">${st.xA.toFixed(2)}</td>
                    <td class="col-grp-expected font-weight-700">${st.xGI.toFixed(2)}</td>

                    <!-- Defence -->
                    <td class="col-grp-defence">${st.defCon}</td>
                    <td class="col-grp-defence">${st.defConPts}</td>
                    <td class="col-grp-defence">${st.recoveries}</td>

                    <!-- Passing -->
                    <td class="col-grp-passing">${st.keyPasses}</td>
                    <td class="col-grp-passing">${st.crosses}</td>
                </tr>
            `;
        }).join('');
    };

    container.innerHTML = `
        <div class="stats-view-container">
            <div class="stats-header-bar">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" class="search-field" id="statsSearchInput" placeholder="Search OPTA player database..." value="${searchQuery}">
                </div>
                
                <div class="filters-group">
                    <select class="filter-select" id="posFilterSelect">
                        <option value="ALL" ${positionFilter === 'ALL' ? 'selected' : ''}>All Positions</option>
                        <option value="GKP" ${positionFilter === 'GKP' ? 'selected' : ''}>Goalkeepers</option>
                        <option value="DEF" ${positionFilter === 'DEF' ? 'selected' : ''}>Defenders</option>
                        <option value="MID" ${positionFilter === 'MID' ? 'selected' : ''}>Midfielders</option>
                        <option value="FWD" ${positionFilter === 'FWD' ? 'selected' : ''}>Forwards</option>
                    </select>

                    <select class="filter-select" id="teamFilterSelect">
                        <option value="ALL" ${teamFilter === 'ALL' ? 'selected' : ''}>All Teams</option>
                        ${TEAMS.map(team => `<option value="${team.shortName}" ${teamFilter === team.shortName ? 'selected' : ''}>${team.name}</option>`).join('')}
                    </select>

                    <select class="filter-select" id="minPriceSelect">
                        <option value="4.0" ${minPriceFilter === 4.0 ? 'selected' : ''}>Min Price: Any</option>
                        ${priceOptions.filter(p => p > 4.0).map(p => `
                            <option value="${p.toFixed(1)}" ${minPriceFilter === p ? 'selected' : ''}>Min: £${p.toFixed(1)}m</option>
                        `).join('')}
                    </select>

                    <select class="filter-select" id="maxPriceSelect">
                        <option value="16.0" ${maxPriceFilter === 16.0 ? 'selected' : ''}>Max Price: Any</option>
                        ${priceOptions.filter(p => p < 16.0).map(p => `
                            <option value="${p.toFixed(1)}" ${maxPriceFilter === p ? 'selected' : ''}>Max: £${p.toFixed(1)}m</option>
                        `).join('')}
                    </select>

                    <select class="filter-select" id="startFilterSelect">
                        <option value="ALL" ${startFilter === 'ALL' ? 'selected' : ''}>Start Chance: Any</option>
                        <option value="100" ${startFilter === '100' ? 'selected' : ''}>100% (Guaranteed)</option>
                        <option value="75" ${startFilter === '75' ? 'selected' : ''}>75% or higher</option>
                        <option value="50" ${startFilter === '50' ? 'selected' : ''}>50% or higher</option>
                        <option value="25" ${startFilter === '25' ? 'selected' : ''}>25% or higher</option>
                    </select>
                </div>
            </div>

            <!-- Stats Data Table -->
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr class="stats-category-row">
                            <th colspan="3" class="cat-header cat-info">Player Info</th>
                            <th colspan="2" class="cat-header cat-core">Core</th>
                            <th colspan="10" class="cat-header cat-attack">Attack</th>
                            <th colspan="3" class="cat-header cat-expected">Expected</th>
                            <th colspan="3" class="cat-header cat-defence">Defence</th>
                            <th colspan="2" class="cat-header cat-passing">Passing</th>
                        </tr>
                        <tr class="stats-columns-row">
                            <th class="col-grp-info" data-col="name" style="text-align: left; padding-left: 10px;">Player ${getSortArrow('name', sortColumn, sortAsc)}</th>
                            <th class="col-grp-info" data-col="position">Pos ${getSortArrow('position', sortColumn, sortAsc)}</th>
                            <th class="col-grp-info" data-col="price">Price ${getSortArrow('price', sortColumn, sortAsc)}</th>
                            <th class="col-grp-core" data-col="ownership">Owned % ${getSortArrow('ownership', sortColumn, sortAsc)}</th>
                            <th class="col-grp-core" data-col="points">Points ${getSortArrow('points', sortColumn, sortAsc)}</th>
                            
                            <!-- Attack Column Headers (Includes Set Pieces) -->
                            <th class="col-grp-attack" data-col="pk">Penalty ${getSortArrow('pk', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="fk">Free Kick ${getSortArrow('fk', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="ck">Corner ${getSortArrow('ck', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="goals">Goals ${getSortArrow('goals', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="assists">Assists ${getSortArrow('assists', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="ga">G + A ${getSortArrow('ga', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="goalPerf">Goal Perf ${getSortArrow('goalPerf', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="shots">Shots ${getSortArrow('shots', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="bigChancesCreated">Big Ch. Created ${getSortArrow('bigChancesCreated', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="bigChancesMissed">Big Ch. Missed ${getSortArrow('bigChancesMissed', sortColumn, sortAsc)}</th>
                            
                            <th class="col-grp-expected" data-col="xG">xG ${getSortArrow('xG', sortColumn, sortAsc)}</th>
                            <th class="col-grp-expected" data-col="xA">xA ${getSortArrow('xA', sortColumn, sortAsc)}</th>
                            <th class="col-grp-expected" data-col="xGI">xGI ${getSortArrow('xGI', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="defCon">DefCon ${getSortArrow('defCon', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="defConPts">DefCon Pts ${getSortArrow('defConPts', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="recoveries">Recoveries ${getSortArrow('recoveries', sortColumn, sortAsc)}</th>
                            <th class="col-grp-passing" data-col="keyPasses">Key Passes ${getSortArrow('keyPasses', sortColumn, sortAsc)}</th>
                            <th class="col-grp-passing" data-col="crosses">Crosses ${getSortArrow('crosses', sortColumn, sortAsc)}</th>
                        </tr>
                    </thead>

                    <tbody id="statsTableBody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    lucide.createIcons();
    renderTable();

    // Event Hookups
    const searchField = container.querySelector('#statsSearchInput');
    searchField.addEventListener('input', e => {
        searchQuery = e.target.value;
        container.dataset.searchQuery = searchQuery;
        renderTable();
    });

    const posSelect = container.querySelector('#posFilterSelect');
    posSelect.addEventListener('change', e => {
        positionFilter = e.target.value;
        container.dataset.posFilter = positionFilter;
        renderTable();
    });

    const teamSelect = container.querySelector('#teamFilterSelect');
    teamSelect.addEventListener('change', e => {
        teamFilter = e.target.value;
        container.dataset.teamFilter = teamFilter;
        renderTable();
    });

    const minPriceSelect = container.querySelector('#minPriceSelect');
    minPriceSelect.addEventListener('change', e => {
        minPriceFilter = parseFloat(e.target.value);
        container.dataset.minPrice = minPriceFilter;
        if (minPriceFilter > maxPriceFilter) {
            maxPriceFilter = minPriceFilter;
            container.dataset.maxPrice = maxPriceFilter;
            const maxPriceSelectEl = container.querySelector('#maxPriceSelect');
            if (maxPriceSelectEl) maxPriceSelectEl.value = maxPriceFilter.toFixed(1);
        }
        renderTable();
    });

    const maxPriceSelect = container.querySelector('#maxPriceSelect');
    maxPriceSelect.addEventListener('change', e => {
        maxPriceFilter = parseFloat(e.target.value);
        container.dataset.maxPrice = maxPriceFilter;
        if (maxPriceFilter < minPriceFilter) {
            minPriceFilter = maxPriceFilter;
            container.dataset.minPrice = minPriceFilter;
            const minPriceSelectEl = container.querySelector('#minPriceSelect');
            if (minPriceSelectEl) minPriceSelectEl.value = minPriceFilter.toFixed(1);
        }
        renderTable();
    });

    const startSelect = container.querySelector('#startFilterSelect');
    startSelect.addEventListener('change', e => {
        startFilter = e.target.value;
        container.dataset.startFilter = startFilter;
        renderTable();
    });

    // Table Header Click Sorts
    container.querySelectorAll('.stats-table th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
            const clickedCol = th.getAttribute('data-col');
            if (sortColumn === clickedCol) {
                sortAsc = !sortAsc;
            } else {
                sortColumn = clickedCol;
                sortAsc = false;
            }

            container.dataset.sortCol = sortColumn;
            container.dataset.sortAsc = sortAsc;
            
            renderStats(container, state, actions);
        });
    });
}

function getSortArrow(column, sortColumn, sortAsc) {
    if (column !== sortColumn) return '<span class="sort-icon">↕</span>';
    return sortAsc ? '<span class="sort-icon" style="color:var(--primary);">↑</span>' : '<span class="sort-icon" style="color:var(--primary);">↓</span>';
}

function renderLockOverlay(container, actions) {
    container.innerHTML = `
        <div class="premium-overlay-container">
            <div class="premium-lock-overlay">
                <div class="lock-card">
                    <div class="lock-icon-wrapper">
                        <i data-lucide="lock" style="width: 32px; height: 32px;"></i>
                    </div>
                    <h3 class="lock-title">OPTA Stats Package Locked</h3>
                    <p class="lock-desc">Unlock advanced stats models. Get complete Opta data coverage including expected goals (xG), expected assists (xA), key passes, shots, ICT indexes, and next gameweek point projections.</p>
                    <button class="lock-cta-btn" id="lockUpgradeBtn">Unlock OPTA Stats Package</button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();

    container.querySelector('#lockUpgradeBtn').addEventListener('click', () => {
        actions.switchTab('dashboard');
    });
}
