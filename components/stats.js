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

    // Alternate cell backgrounds based on even/odd index for zebra-striping
    const getGroupStyles = (isEven) => {
        if (isLight) {
            return {
                info: isEven ? 'background-color: #f8fafc !important; color: #0f172a !important;' : 'background-color: #f1f5f9 !important; color: #0f172a !important;',
                core: isEven ? 'background-color: #f0f9ff !important; color: #0369a1 !important;' : 'background-color: #e0f2fe !important; color: #0369a1 !important;',
                attack: isEven ? 'background-color: #f0fdf4 !important; color: #15803d !important;' : 'background-color: #dcfce7 !important; color: #15803d !important;',
                expected: isEven ? 'background-color: #faf5ff !important; color: #6d28d9 !important;' : 'background-color: #f3e8ff !important; color: #6d28d9 !important;',
                defence: isEven ? 'background-color: #fff1f2 !important; color: #be123c !important;' : 'background-color: #ffe4e6 !important; color: #be123c !important;',
                passing: isEven ? 'background-color: #eef2ff !important; color: #4338ca !important;' : 'background-color: #e0e7ff !important; color: #4338ca !important;',
                xp: isEven ? 'background-color: #fffbeb !important; color: #b45309 !important;' : 'background-color: #fef3c7 !important; color: #b45309 !important;',
            };
        } else {
            return {
                info: isEven ? 'background-color: #0f172a !important; color: #f8fafc !important;' : 'background-color: #1e293b !important; color: #f8fafc !important;',
                core: isEven ? 'background-color: rgba(2, 132, 199, 0.08) !important; color: #38bdf8 !important;' : 'background-color: rgba(2, 132, 199, 0.18) !important; color: #38bdf8 !important;',
                attack: isEven ? 'background-color: rgba(22, 163, 74, 0.08) !important; color: #4ade80 !important;' : 'background-color: rgba(22, 163, 74, 0.18) !important; color: #4ade80 !important;',
                expected: isEven ? 'background-color: rgba(124, 58, 237, 0.08) !important; color: #c084fc !important;' : 'background-color: rgba(124, 58, 237, 0.18) !important; color: #c084fc !important;',
                defence: isEven ? 'background-color: rgba(219, 39, 119, 0.08) !important; color: #f472b6 !important;' : 'background-color: rgba(219, 39, 119, 0.18) !important; color: #f472b6 !important;',
                passing: isEven ? 'background-color: rgba(99, 102, 241, 0.08) !important; color: #818cf8 !important;' : 'background-color: rgba(99, 102, 241, 0.18) !important; color: #818cf8 !important;',
                xp: isEven ? 'background-color: rgba(217, 119, 6, 0.08) !important; color: #fbbf24 !important;' : 'background-color: rgba(217, 119, 6, 0.18) !important; color: #fbbf24 !important;',
            };
        }
    };

    const headerStyles = {
        info: isLight ? 'background-color: #cbd5e1 !important; color: #1e293b !important;' : 'background-color: #0f172a !important; color: #94a3b8 !important;',
        core: isLight ? 'background-color: #bae6fd !important; color: #0369a1 !important;' : 'background-color: rgba(2, 132, 199, 0.35) !important; color: #38bdf8 !important;',
        attack: isLight ? 'background-color: #bbf7d0 !important; color: #15803d !important;' : 'background-color: rgba(22, 163, 74, 0.35) !important; color: #4ade80 !important;',
        expected: isLight ? 'background-color: #e9d5ff !important; color: #6d28d9 !important;' : 'background-color: rgba(124, 58, 237, 0.35) !important; color: #c084fc !important;',
        defence: isLight ? 'background-color: #fecdd3 !important; color: #be123c !important;' : 'background-color: rgba(219, 39, 119, 0.35) !important; color: #f472b6 !important;',
        passing: isLight ? 'background-color: #c7d2fe !important; color: #3730a3 !important;' : 'background-color: rgba(99, 102, 241, 0.35) !important; color: #818cf8 !important;',
        xp: isLight ? 'background-color: #fde68a !important; color: #92400e !important;' : 'background-color: rgba(217, 119, 6, 0.35) !important; color: #fbbf24 !important;',
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

        const currentGw = parseInt(state.currentGw) || 1;
        const getNGwXp = (p, n) => {
            if (!p || !p.predictions) return 0;
            const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(p) : 1.0;
            let sum = 0;
            for (let gw = currentGw; gw < currentGw + n; gw++) {
                if (gw > 38) break;
                const pred = p.predictions.find(predObj => predObj.gw === gw);
                if (pred) {
                    const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                    sum += (raw * factor);
                }
            }
            return parseFloat(sum.toFixed(1));
        };

        const xp1 = getNGwXp(player, 1);
        const xp2 = getNGwXp(player, 2);
        const xp3 = getNGwXp(player, 3);
        const xp4 = getNGwXp(player, 4);
        const xp5 = getNGwXp(player, 5);
        const xp10 = getNGwXp(player, 10);

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
            crosses,
            xp1,
            xp2,
            xp3,
            xp4,
            xp5,
            xp10
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

        tableBody.innerHTML = filtered.map((player, idx) => {
            const st = getComputedStats(player);
            const displayName = formatPlayerShortName(player.name);
            const rowStyles = getGroupStyles(idx % 2 === 0);
            return `
                <tr>
                    <td class="col-grp-info cell-player-name" style="${rowStyles.info} text-align: left; padding-left: 8px; cursor: pointer;" title="${player.name}">
                        <div style="display: flex; align-items: center; gap: 5px; overflow: visible;">
                            <strong style="font-weight: 700; font-size: 12.5px; white-space: nowrap;" title="${player.name}">${displayName}</strong>
                            <span class="cell-team-tag" style="font-size: 10px; font-weight: 700; color: var(--text-muted); flex-shrink: 0; padding: 1px 4px; background: rgba(0,0,0,0.06); border-radius: 3px;">${player.team}</span>
                        </div>
                    </td>

                    <td class="col-grp-info font-weight-700" style="${rowStyles.info}">${player.position}</td>
                    <td class="col-grp-info font-weight-800" style="${rowStyles.info} color: var(--primary);">£${player.price.toFixed(1)}</td>

                    <!-- Core -->
                    <td class="col-grp-core" style="${rowStyles.core}">${player.ownership.toFixed(1)}%</td>
                    <td class="col-grp-core font-weight-800" style="${rowStyles.core}">${player.points}</td>
                    
                    <!-- Attack (Includes Set Pieces) -->
                    <td class="col-grp-attack" style="${rowStyles.attack}">${renderYesNoBadge(st.pk, '#ef4444')}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${renderYesNoBadge(st.fk, '#f59e0b')}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${renderYesNoBadge(st.ck, '#0284c7')}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${st.goals}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${st.assists}</td>
                    <td class="col-grp-attack font-weight-700" style="${rowStyles.attack}">${st.ga}</td>
                    <td class="col-grp-attack ${parseFloat(st.goalPerf) < 0 ? 'text-negative' : 'text-positive'}" style="${rowStyles.attack}">${st.goalPerf}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${st.shots}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${st.bigChancesCreated}</td>
                    <td class="col-grp-attack" style="${rowStyles.attack}">${st.bigChancesMissed}</td>

                    <!-- Expected -->
                    <td class="col-grp-expected" style="${rowStyles.expected}">${st.xG.toFixed(2)}</td>
                    <td class="col-grp-expected" style="${rowStyles.expected}">${st.xA.toFixed(2)}</td>
                    <td class="col-grp-expected font-weight-700" style="${rowStyles.expected}">${st.xGI.toFixed(2)}</td>

                    <!-- Defence -->
                    <td class="col-grp-defence" style="${rowStyles.defence}">${st.defCon}</td>
                    <td class="col-grp-defence" style="${rowStyles.defence}">${st.defConPts}</td>
                    <td class="col-grp-defence" style="${rowStyles.defence}">${st.recoveries}</td>

                    <!-- Passing -->
                    <td class="col-grp-passing" style="${rowStyles.passing}">${st.keyPasses}</td>
                    <td class="col-grp-passing" style="${rowStyles.passing}">${st.crosses}</td>

                    <!-- XP -->
                    <td class="col-grp-xp font-weight-700" style="${rowStyles.xp}">${st.xp1}</td>
                    <td class="col-grp-xp font-weight-700" style="${rowStyles.xp}">${st.xp2}</td>
                    <td class="col-grp-xp font-weight-700" style="${rowStyles.xp}">${st.xp3}</td>
                    <td class="col-grp-xp font-weight-700" style="${rowStyles.xp}">${st.xp4}</td>
                    <td class="col-grp-xp font-weight-700" style="${rowStyles.xp}">${st.xp5}</td>
                    <td class="col-grp-xp font-weight-800" style="${rowStyles.xp}">${st.xp10}</td>
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
                            <th colspan="3" class="cat-header cat-info" style="${headerStyles.info}">Player Info</th>
                            <th colspan="2" class="cat-header cat-core" style="${headerStyles.core}">Core</th>
                            <th colspan="10" class="cat-header cat-attack" style="${headerStyles.attack}">Attack</th>
                            <th colspan="3" class="cat-header cat-expected" style="${headerStyles.expected}">Expected</th>
                            <th colspan="3" class="cat-header cat-defence" style="${headerStyles.defence}">Defence</th>
                            <th colspan="2" class="cat-header cat-passing" style="${headerStyles.passing}">Passing</th>
                            <th colspan="6" class="cat-header cat-xp" style="${headerStyles.xp}">XP Projections</th>
                        </tr>
                        <tr class="stats-columns-row">
                            <th class="col-grp-info" data-col="name" style="${headerStyles.info} text-align: left; padding-left: 10px;">Player ${getSortArrow('name', sortColumn, sortAsc)}</th>
                            
                            <!-- Position Header Filter -->
                            <th class="col-grp-info" style="${headerStyles.info}">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <span data-col="position" style="cursor: pointer;">Pos ${getSortArrow('position', sortColumn, sortAsc)}</span>
                                    <select id="thPosFilterSelect" style="background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.25); color: inherit; font-size: 10.5px; font-weight: 700; border-radius: 4px; padding: 1px 3px; cursor: pointer; text-transform: uppercase; outline: none;" title="Filter Position">
                                        <option value="ALL" ${positionFilter === 'ALL' ? 'selected' : ''}>All</option>
                                        <option value="GKP" ${positionFilter === 'GKP' ? 'selected' : ''}>GK</option>
                                        <option value="DEF" ${positionFilter === 'DEF' ? 'selected' : ''}>DEF</option>
                                        <option value="MID" ${positionFilter === 'MID' ? 'selected' : ''}>MID</option>
                                        <option value="FWD" ${positionFilter === 'FWD' ? 'selected' : ''}>FWD</option>
                                    </select>
                                </div>
                            </th>

                            <!-- Price Header Filter -->
                            <th class="col-grp-info" style="${headerStyles.info}">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <span data-col="price" style="cursor: pointer;">Price ${getSortArrow('price', sortColumn, sortAsc)}</span>
                                    <select id="thMaxPriceSelect" style="background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.25); color: inherit; font-size: 10.5px; font-weight: 700; border-radius: 4px; padding: 1px 3px; cursor: pointer; outline: none;" title="Filter Max Price">
                                        <option value="16.0" ${maxPriceFilter === 16.0 ? 'selected' : ''}>All</option>
                                        <option value="4.5" ${maxPriceFilter === 4.5 ? 'selected' : ''}>≤ 4.5m</option>
                                        <option value="6.0" ${maxPriceFilter === 6.0 ? 'selected' : ''}>≤ 6.0m</option>
                                        <option value="8.0" ${maxPriceFilter === 8.0 ? 'selected' : ''}>≤ 8.0m</option>
                                        <option value="10.0" ${maxPriceFilter === 10.0 ? 'selected' : ''}>≤ 10.0m</option>
                                        <option value="12.0" ${maxPriceFilter === 12.0 ? 'selected' : ''}>≤ 12.0m</option>
                                    </select>
                                </div>
                            </th>

                            <th class="col-grp-core" data-col="ownership" style="${headerStyles.core}">Owned % ${getSortArrow('ownership', sortColumn, sortAsc)}</th>
                            <th class="col-grp-core" data-col="points" style="${headerStyles.core}">Points ${getSortArrow('points', sortColumn, sortAsc)}</th>
                            
                            <!-- Attack Column Headers (Includes Set Pieces) -->
                            <th class="col-grp-attack" data-col="pk" style="${headerStyles.attack}">Penalty ${getSortArrow('pk', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="fk" style="${headerStyles.attack}">Free Kick ${getSortArrow('fk', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="ck" style="${headerStyles.attack}">Corner ${getSortArrow('ck', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="goals" style="${headerStyles.attack}">Goals ${getSortArrow('goals', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="assists" style="${headerStyles.attack}">Assists ${getSortArrow('assists', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="ga" style="${headerStyles.attack}">G + A ${getSortArrow('ga', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="goalPerf" style="${headerStyles.attack}">Goal Perf ${getSortArrow('goalPerf', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="shots" style="${headerStyles.attack}">Shots ${getSortArrow('shots', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="bigChancesCreated" style="${headerStyles.attack}">Big Ch. Created ${getSortArrow('bigChancesCreated', sortColumn, sortAsc)}</th>
                            <th class="col-grp-attack" data-col="bigChancesMissed" style="${headerStyles.attack}">Big Ch. Missed ${getSortArrow('bigChancesMissed', sortColumn, sortAsc)}</th>
                            
                            <th class="col-grp-expected" data-col="xG" style="${headerStyles.expected}">xG ${getSortArrow('xG', sortColumn, sortAsc)}</th>
                            <th class="col-grp-expected" data-col="xA" style="${headerStyles.expected}">xA ${getSortArrow('xA', sortColumn, sortAsc)}</th>
                            <th class="col-grp-expected" data-col="xGI" style="${headerStyles.expected}">xGI ${getSortArrow('xGI', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="defCon" style="${headerStyles.defence}">DefCon ${getSortArrow('defCon', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="defConPts" style="${headerStyles.defence}">DefCon Pts ${getSortArrow('defConPts', sortColumn, sortAsc)}</th>
                            <th class="col-grp-defence" data-col="recoveries" style="${headerStyles.defence}">Recoveries ${getSortArrow('recoveries', sortColumn, sortAsc)}</th>
                            <th class="col-grp-passing" data-col="keyPasses" style="${headerStyles.passing}">Key Passes ${getSortArrow('keyPasses', sortColumn, sortAsc)}</th>
                            <th class="col-grp-passing" data-col="crosses" style="${headerStyles.passing}">Crosses ${getSortArrow('crosses', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp1" style="${headerStyles.xp}">1 GW XP ${getSortArrow('xp1', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp2" style="${headerStyles.xp}">2 GW XP ${getSortArrow('xp2', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp3" style="${headerStyles.xp}">3 GW XP ${getSortArrow('xp3', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp4" style="${headerStyles.xp}">4 GW XP ${getSortArrow('xp4', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp5" style="${headerStyles.xp}">5 GW XP ${getSortArrow('xp5', sortColumn, sortAsc)}</th>
                            <th class="col-grp-xp" data-col="xp10" style="${headerStyles.xp}">10 GW XP ${getSortArrow('xp10', sortColumn, sortAsc)}</th>
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
    const thPosSelect = container.querySelector('#thPosFilterSelect');
    const handlePosChange = (val) => {
        positionFilter = val;
        container.dataset.posFilter = positionFilter;
        if (posSelect && posSelect.value !== val) posSelect.value = val;
        if (thPosSelect && thPosSelect.value !== val) thPosSelect.value = val;
        renderTable();
    };

    if (posSelect) posSelect.addEventListener('change', e => handlePosChange(e.target.value));
    if (thPosSelect) thPosSelect.addEventListener('change', e => handlePosChange(e.target.value));

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
            const thMaxPriceSelectEl = container.querySelector('#thMaxPriceSelect');
            if (thMaxPriceSelectEl) thMaxPriceSelectEl.value = maxPriceFilter.toFixed(1);
        }
        renderTable();
    });

    const maxPriceSelect = container.querySelector('#maxPriceSelect');
    const thMaxPriceSelect = container.querySelector('#thMaxPriceSelect');
    const handleMaxPriceChange = (valStr) => {
        maxPriceFilter = parseFloat(valStr);
        container.dataset.maxPrice = maxPriceFilter;
        if (maxPriceFilter < minPriceFilter) {
            minPriceFilter = maxPriceFilter;
            container.dataset.minPrice = minPriceFilter;
            const minPriceSelectEl = container.querySelector('#minPriceSelect');
            if (minPriceSelectEl) minPriceSelectEl.value = minPriceFilter.toFixed(1);
        }
        if (maxPriceSelect && maxPriceSelect.value !== valStr) maxPriceSelect.value = parseFloat(valStr).toFixed(1);
        if (thMaxPriceSelect && thMaxPriceSelect.value !== valStr) thMaxPriceSelect.value = valStr;
        renderTable();
    };

    if (maxPriceSelect) maxPriceSelect.addEventListener('change', e => handleMaxPriceChange(e.target.value));
    if (thMaxPriceSelect) thMaxPriceSelect.addEventListener('change', e => handleMaxPriceChange(e.target.value));

    const startSelect = container.querySelector('#startFilterSelect');
    startSelect.addEventListener('change', e => {
        startFilter = e.target.value;
        container.dataset.startFilter = startFilter;
        renderTable();
    });

    // Table Header Click Sorts (Ignore click if inside select element)
    container.querySelectorAll('.stats-table th[data-col], .stats-table span[data-col]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
            e.stopPropagation();
            const clickedCol = el.getAttribute('data-col');
            if (!clickedCol) return;
            
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
