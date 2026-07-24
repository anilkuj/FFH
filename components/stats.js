import { PLAYERS, TEAMS } from '../data.js';

export function renderStats(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    // Default filters state stored inside the element dataset to survive partial renders
    let positionFilter = container.dataset.posFilter || 'ALL';
    let teamFilter = container.dataset.teamFilter || 'ALL';
    let searchQuery = container.dataset.searchQuery || '';
    let sortColumn = container.dataset.sortCol || 'points';
    let sortAsc = container.dataset.sortAsc === 'true'; // string parsing

    const renderTable = () => {
        // Filter players
        let filtered = PLAYERS.filter(player => {
            const matchesPos = positionFilter === 'ALL' || player.position === positionFilter;
            const matchesTeam = teamFilter === 'ALL' || player.team === teamFilter;
            const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesPos && matchesTeam && matchesSearch;
        });

        // Sort players
        filtered.sort((a, b) => {
            let valA, valB;

            if (sortColumn === 'name' || sortColumn === 'team' || sortColumn === 'position') {
                valA = a[sortColumn];
                valB = b[sortColumn];
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortColumn === 'gwPred') {
                // Predicted points for current gameweek
                valA = (a.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
                valB = (b.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
            } else {
                valA = a[sortColumn];
                valB = b[sortColumn];
            }

            return sortAsc ? valA - valB : valB - valA;
        });

        const tableBody = container.querySelector('#statsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = filtered.map(player => {
            const currentGwPred = (player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
            return `
                <tr>
                    <td class="cell-player-name">
                        ${player.name}
                        <span class="cell-team-tag">${player.team}</span>
                        ${player.transferredThisSeason ? `<span class="transfer-badge" title="Transferred from ${player.oldTeam}">⇆ ${player.oldTeam}</span>` : ''}
                    </td>
                    <td>${player.position}</td>
                    <td>£${player.price.toFixed(1)}m</td>
                    <td>${player.ownership.toFixed(1)}%</td>
                    <td class="${sortColumn === 'points' ? 'highlight-column' : ''}">${player.points}</td>
                    <td class="${sortColumn === 'xG' ? 'highlight-column' : ''}">${player.xG.toFixed(2)}</td>
                    <td class="${sortColumn === 'xA' ? 'highlight-column' : ''}">${player.xA.toFixed(2)}</td>
                    <td class="${sortColumn === 'xG90' ? 'highlight-column' : ''}">${player.xG90.toFixed(2)}</td>
                    <td class="${sortColumn === 'xA90' ? 'highlight-column' : ''}">${player.xA90.toFixed(2)}</td>
                    <td class="${sortColumn === 'xGI' ? 'highlight-column' : ''}">${player.xGI.toFixed(2)}</td>
                    <td class="${sortColumn === 'ictIndex' ? 'highlight-column' : ''}">${player.ictIndex.toFixed(1)}</td>
                    <td class="${sortColumn === 'GS' ? 'highlight-column' : ''}">${player.GS}</td>
                    <td class="${sortColumn === 'MPPG' ? 'highlight-column' : ''}">${player.MPPG.toFixed(1)}</td>
                    <td class="${sortColumn === 'gwPred' ? 'highlight-column' : ''}">${currentGwPred.toFixed(1)}</td>
                    <td class="${sortColumn === 'xp5' ? 'highlight-column' : ''}">${player.xp5.toFixed(1)}</td>
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
                </div>
            </div>

            <!-- Stats Data Table -->
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th data-col="name">Player Name ${getSortArrow('name', sortColumn, sortAsc)}</th>
                            <th data-col="position">Pos ${getSortArrow('position', sortColumn, sortAsc)}</th>
                            <th data-col="price">Price ${getSortArrow('price', sortColumn, sortAsc)}</th>
                            <th data-col="ownership">Own % ${getSortArrow('ownership', sortColumn, sortAsc)}</th>
                            <th data-col="points">Pts ${getSortArrow('points', sortColumn, sortAsc)}</th>
                            <th data-col="xG">xG ${getSortArrow('xG', sortColumn, sortAsc)}</th>
                            <th data-col="xA">xA ${getSortArrow('xA', sortColumn, sortAsc)}</th>
                            <th data-col="xG90">xG90 ${getSortArrow('xG90', sortColumn, sortAsc)}</th>
                            <th data-col="xA90">xA90 ${getSortArrow('xA90', sortColumn, sortAsc)}</th>
                            <th data-col="xGI">xGI ${getSortArrow('xGI', sortColumn, sortAsc)}</th>
                            <th data-col="ictIndex">ICT ${getSortArrow('ictIndex', sortColumn, sortAsc)}</th>
                            <th data-col="GS">GS ${getSortArrow('GS', sortColumn, sortAsc)}</th>
                            <th data-col="MPPG">MPPG ${getSortArrow('MPPG', sortColumn, sortAsc)}</th>
                            <th data-col="gwPred">GW${state.currentGw} XP ${getSortArrow('gwPred', sortColumn, sortAsc)}</th>
                            <th data-col="xp5">5-GW XP ${getSortArrow('xp5', sortColumn, sortAsc)}</th>
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

    // Table Header Click Sorts
    container.querySelectorAll('.stats-table th').forEach(th => {
        th.addEventListener('click', () => {
            const clickedCol = th.getAttribute('data-col');
            if (sortColumn === clickedCol) {
                sortAsc = !sortAsc;
            } else {
                sortColumn = clickedCol;
                sortAsc = false; // default desc for stats
            }

            container.dataset.sortCol = sortColumn;
            container.dataset.sortAsc = sortAsc;
            
            // Re-render full view to refresh header sort arrows
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
