export function renderLeagueAnalyzer(container, state, actions) {
    const isLight = document.documentElement.classList.contains('light-theme');

    // Retrieve active league code from state or container dataset (default to 314)
    let leagueId = container.dataset.leagueId || '';
    let leagueData = null;
    let entriesHistory = {}; // Key: entryId, Value: history data
    let isLoading = false;
    let loadProgress = '';
    let activeSubTab = container.dataset.subTab || 'analysis'; // Tab options: analysis, standings, chart
    let selectedEntries = []; // List of entryIds to compare in the chart

    // Read stored variables if already loaded in container memory
    if (container.dataset.loadedData) {
        try {
            const cached = JSON.parse(container.dataset.loadedData);
            leagueData = cached.leagueData;
            entriesHistory = cached.entriesHistory;
            selectedEntries = cached.selectedEntries || [];
        } catch (e) {
            console.error('Failed to parse cached league analyzer data:', e);
        }
    }

    function saveStateToContainer() {
        container.dataset.leagueId = leagueId;
        container.dataset.subTab = activeSubTab;
        container.dataset.loadedData = JSON.stringify({
            leagueData,
            entriesHistory,
            selectedEntries
        });
    }

    async function loadLeague() {
        if (!leagueId) return;
        isLoading = true;
        loadProgress = 'Fetching league standings...';
        leagueData = null;
        entriesHistory = {};
        render();

        try {
            const res = await fetch(`/api/fpl-league?leagueId=${leagueId}`);
            const result = await res.json();
            if (result.success && result.data) {
                leagueData = result.data;
                const standings = leagueData.standings ? leagueData.standings.results : [];
                
                // Select top 10 managers by default for the chart comparison
                selectedEntries = standings.slice(0, 10).map(entry => entry.entry);

                // Fetch history for top 15 managers to perform analysis
                const managersToFetch = standings.slice(0, 15);
                let loadedCount = 0;

                for (const entry of managersToFetch) {
                    loadProgress = `Analyzing manager performance (${++loadedCount}/${managersToFetch.length})...`;
                    render();
                    try {
                        const historyRes = await fetch(`/api/fpl-entry-history?entryId=${entry.entry}`);
                        const historyResult = await historyRes.json();
                        if (historyResult.success && historyResult.data) {
                            entriesHistory[entry.entry] = historyResult.data;
                        }
                    } catch (e) {
                        console.error(`Failed to fetch history for entry ${entry.entry}:`, e);
                    }
                }
            } else {
                alert(result.error || 'Failed to load league standings. Please check the code.');
            }
        } catch (e) {
            console.error('Error loading league:', e);
            alert('Failed to contact local API server. Make sure server.js is running.');
        } finally {
            isLoading = false;
            loadProgress = '';
            saveStateToContainer();
            render();
        }
    }

    function render() {
        if (isLoading) {
            container.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 20px;
                    gap: 16px;
                    width: 100%;
                    box-sizing: border-box;
                    color: var(--text-main);
                ">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 3px solid rgba(139, 92, 246, 0.1);
                        border-top-color: #8b5cf6;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                    <span style="font-weight: 700; font-size: 15px;">${loadProgress}</span>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            return;
        }

        if (!leagueData) {
            // Render Input Landing Form
            container.innerHTML = `
                <div class="analyzer-input-card" style="
                    max-width: 500px;
                    margin: 80px auto;
                    background: ${isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.4)'};
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 32px;
                    box-shadow: ${isLight ? '0 10px 15px -3px rgba(0,0,0,0.03)' : '0 10px 30px -10px rgba(0,0,0,0.5)'};
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                ">
                    <div style="text-align: center; display: flex; flex-direction: column; gap: 8px;">
                        <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: var(--text-main);">FPL Mini-League Analyzer</h2>
                        <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                            Analyze player statistics, calculate cumulative highlights (hits, benchings, peaks), and visualize week-by-week overall standings.
                        </p>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Classic League Code</label>
                        <input type="text" id="leagueCodeInput" value="${leagueId || '314'}" placeholder="e.g. 314" style="
                            padding: 12px 16px;
                            border-radius: 8px;
                            background: ${isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)'};
                            border: 1px solid var(--border-color);
                            color: var(--text-main);
                            font-size: 15px;
                            font-weight: 700;
                            text-align: center;
                            outline: none;
                            transition: border-color 0.2s ease;
                        ">
                    </div>

                    <button id="loadLeagueBtn" style="
                        padding: 14px;
                        border-radius: 8px;
                        background: #8b5cf6;
                        color: #ffffff;
                        font-weight: 800;
                        font-size: 14px;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                    ">
                        <i data-lucide="bar-chart-2" style="width: 16px; height: 16px;"></i>
                        <span>Start Intelligent Analysis</span>
                    </button>
                </div>
            `;

            lucide.createIcons();

            const btn = container.querySelector('#loadLeagueBtn');
            const inp = container.querySelector('#leagueCodeInput');
            
            btn.addEventListener('click', () => {
                leagueId = inp.value.trim();
                if (leagueId) loadLeague();
            });

            inp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    leagueId = inp.value.trim();
                    if (leagueId) loadLeague();
                }
            });
            return;
        }

        // --- Data Loaded Dashboard ---
        const standings = leagueData.standings ? leagueData.standings.results : [];
        const leagueName = leagueData.league ? leagueData.league.name : 'Classic League';

        // Calculate Intelligent Analysis Highlights
        let highlightCardsHtml = '';
        if (Object.keys(entriesHistory).length > 0) {
            let maxHitsManager = null;
            let maxHitsVal = -1;

            let maxBenchManager = null;
            let maxBenchVal = -1;

            let maxTransfersManager = null;
            let maxTransfersVal = -1;

            let maxGwScoreManager = null;
            let maxGwScoreVal = -1;

            let maxClimberManager = null;
            let maxClimbVal = -999999;

            standings.forEach(manager => {
                const history = entriesHistory[manager.entry];
                if (!history || !history.current || history.current.length === 0) return;

                const weeks = history.current;
                
                // 1. Total Hits Cost
                const totalHits = weeks.reduce((sum, w) => sum + (w.event_transfers_cost || 0), 0);
                if (totalHits > maxHitsVal) {
                    maxHitsVal = totalHits;
                    maxHitsManager = manager;
                }

                // 2. Total Bench Points
                const totalBench = weeks.reduce((sum, w) => sum + (w.points_on_bench || 0), 0);
                if (totalBench > maxBenchVal) {
                    maxBenchVal = totalBench;
                    maxBenchManager = manager;
                }

                // 3. Total Transfers Made
                const totalTransfers = weeks.reduce((sum, w) => sum + (w.event_transfers || 0), 0);
                if (totalTransfers > maxTransfersVal) {
                    maxTransfersVal = totalTransfers;
                    maxTransfersManager = manager;
                }

                // 4. Highest Single GW Score
                const maxGw = Math.max(...weeks.map(w => w.points || 0));
                if (maxGw > maxGwScoreVal) {
                    maxGwScoreVal = maxGw;
                    maxGwScoreManager = manager;
                }

                // 5. Rank Climb (comparing GW1 Overall Rank vs current Overall Rank)
                const gw1Rank = weeks[0].overall_rank || 0;
                const latestRank = weeks[weeks.length - 1].overall_rank || 0;
                if (gw1Rank > 0 && latestRank > 0) {
                    const climb = gw1Rank - latestRank; // Positive climb is good (rank gets smaller)
                    if (climb > maxClimbVal) {
                        maxClimbVal = climb;
                        maxClimberManager = manager;
                    }
                }
            });

            // Card highlight data array
            const highlights = [
                {
                    title: 'Transfer Hit King',
                    manager: maxHitsManager,
                    metric: `-${maxHitsVal} pts in hits`,
                    icon: 'flame',
                    color: '#ef4444',
                    desc: 'Manager willing to tank point hits for roster shifts.'
                },
                {
                    title: 'Bench Points Champion',
                    manager: maxBenchManager,
                    metric: `${maxBenchVal} pts benched`,
                    icon: 'archive',
                    color: '#3b82f6',
                    desc: 'Managers nightmare leaving raw points on the sidelines.'
                },
                {
                    title: 'Most Active Trader',
                    manager: maxTransfersManager,
                    metric: `${maxTransfersVal} transfers`,
                    icon: 'refresh-cw',
                    color: '#10b981',
                    desc: 'Extremely active manager constantly tweaking roster.'
                },
                {
                    title: 'Highest Single GW Peak',
                    manager: maxGwScoreManager,
                    metric: `${maxGwScoreVal} points`,
                    icon: 'trending-up',
                    color: '#f59e0b',
                    desc: 'Record-setting single-GW performance score.'
                }
            ];

            if (maxClimberManager && maxClimbVal > 0) {
                highlights.push({
                    title: 'Biggest Rank Climber',
                    manager: maxClimberManager,
                    metric: `+${maxClimbVal.toLocaleString()} ranks`,
                    icon: 'arrow-up-right',
                    color: '#8b5cf6',
                    desc: 'Manager with the fastest upward global ranking velocity.'
                });
            }

            highlights.forEach(hl => {
                if (!hl.manager) return;
                highlightCardsHtml += `
                    <div style="
                        flex: 1;
                        min-width: 230px;
                        background: ${isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.4)'};
                        border: 1px solid var(--border-color);
                        border-radius: 12px;
                        padding: 16px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        box-shadow: ${isLight ? '0 4px 6px -1px rgba(0,0,0,0.02)' : 'none'};
                    ">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${hl.title}</span>
                            <div style="width: 28px; height: 28px; border-radius: 6px; background: ${hl.color}15; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="${hl.icon}" style="width: 14px; height: 14px; color: ${hl.color};"></i>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: 15px; font-weight: 800; color: var(--text-main);">${hl.manager.entry_name}</span>
                            <span style="font-size: 11px; color: var(--text-muted);">${hl.manager.player_name}</span>
                        </div>
                        <div style="
                            padding: 6px 10px;
                            border-radius: 6px;
                            background: rgba(255, 255, 255, 0.02);
                            border: 1px solid var(--border-color);
                            font-size: 12.5px;
                            font-weight: 800;
                            color: ${hl.color};
                            text-align: center;
                        ">${hl.metric}</div>
                        <p style="margin: 0; font-size: 10px; color: var(--text-muted); line-height: 1.4;">${hl.desc}</p>
                    </div>
                `;
            });
        }

        // Sub tab navigation items
        const subTabs = [
            { key: 'analysis', label: 'League Highlights', icon: 'award' },
            { key: 'standings', label: 'Standings Grid', icon: 'list' },
            { key: 'chart', label: 'Performance Plot', icon: 'activity' }
        ];

        let subTabButtonsHtml = '';
        subTabs.forEach(tab => {
            const isSel = tab.key === activeSubTab;
            subTabButtonsHtml += `
                <button class="sub-tab-btn" data-subtab="${tab.key}" style="
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid ${isSel ? '#8b5cf6' : 'var(--border-color)'};
                    background: ${isSel ? 'rgba(139, 92, 246, 0.1)' : 'transparent'};
                    color: ${isSel ? '#ffffff' : 'var(--text-muted)'};
                    font-weight: 700;
                    font-size: 12.5px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                ">
                    <i data-lucide="${tab.icon}" style="width: 13px; height: 13px; ${isSel ? 'color: #8b5cf6' : ''}"></i>
                    <span>${tab.label}</span>
                </button>
            `;
        });

        // Content Area HTML depending on selected tab
        let tabContentHtml = '';

        if (activeSubTab === 'analysis') {
            tabContentHtml = `
                <div style="display: flex; flex-direction: column; gap: 20px; width: 100%;">
                    <div style="display: flex; gap: 16px; flex-wrap: wrap; width: 100%;">
                        ${highlightCardsHtml || `
                            <div style="padding: 40px; text-align: center; width: 100%; color: var(--text-muted);">
                                Failed to perform highlight analysis. Managers list might be empty.
                            </div>
                        `}
                    </div>
                </div>
            `;
        } else if (activeSubTab === 'standings') {
            let rowsHtml = '';
            standings.forEach(entry => {
                const history = entriesHistory[entry.entry];
                let hitsHtml = '-';
                let benchHtml = '-';
                let transfersHtml = '-';

                if (history && history.current) {
                    const totalHits = history.current.reduce((sum, w) => sum + (w.event_transfers_cost || 0), 0);
                    const totalBench = history.current.reduce((sum, w) => sum + (w.points_on_bench || 0), 0);
                    const totalTransfers = history.current.reduce((sum, w) => sum + (w.event_transfers || 0), 0);
                    hitsHtml = `${totalHits} pts`;
                    benchHtml = `${totalBench} pts`;
                    transfersHtml = `${totalTransfers}`;
                }

                rowsHtml += `
                    <tr style="
                        border-bottom: 1px solid var(--border-color);
                        transition: background-color 0.2s ease;
                    ">
                        <td style="padding: 12px; font-weight: 800; color: var(--text-main); font-family: monospace;">${entry.rank}</td>
                        <td style="padding: 12px; font-weight: 700; color: var(--text-main);">${entry.entry_name}</td>
                        <td style="padding: 12px; color: var(--text-muted);">${entry.player_name}</td>
                        <td style="padding: 12px; font-weight: 700; color: var(--text-main); text-align: center;">${entry.event_total}</td>
                        <td style="padding: 12px; font-weight: 800; color: #8b5cf6; text-align: center;">${entry.total}</td>
                        <td style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">${transfersHtml}</td>
                        <td style="padding: 12px; text-align: center; color: #ef4444; font-weight: 700; font-size: 12px;">${hitsHtml}</td>
                        <td style="padding: 12px; text-align: center; color: #3b82f6; font-weight: 700; font-size: 12px;">${benchHtml}</td>
                    </tr>
                `;
            });

            tabContentHtml = `
                <div style="
                    width: 100%;
                    overflow-x: auto;
                    background: ${isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.4)'};
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                ">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                        <thead>
                            <tr style="
                                border-bottom: 1px solid var(--border-color);
                                background: rgba(255, 255, 255, 0.01);
                                text-transform: uppercase;
                                font-size: 10.5px;
                                font-weight: 800;
                                color: var(--text-muted);
                                letter-spacing: 0.5px;
                            ">
                                <th style="padding: 12px; width: 60px;">Rank</th>
                                <th style="padding: 12px;">Team Name</th>
                                <th style="padding: 12px;">Manager</th>
                                <th style="padding: 12px; text-align: center;">GW Points</th>
                                <th style="padding: 12px; text-align: center;">Total Points</th>
                                <th style="padding: 12px; text-align: center;">Transfers</th>
                                <th style="padding: 12px; text-align: center;">Hits Cost</th>
                                <th style="padding: 12px; text-align: center;">Bench Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (activeSubTab === 'chart') {
            // Checkbox panel to toggle compared players
            let comparisonControlsHtml = '';
            standings.slice(0, 15).forEach(entry => {
                const isChecked = selectedEntries.includes(entry.entry);
                comparisonControlsHtml += `
                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 12.5px;
                        font-weight: 700;
                        color: var(--text-main);
                        cursor: pointer;
                        padding: 6px 10px;
                        border-radius: 6px;
                        background: ${isChecked ? 'rgba(139, 92, 246, 0.05)' : 'transparent'};
                        border: 1px solid ${isChecked ? 'rgba(139, 92, 246, 0.2)' : 'transparent'};
                        transition: all 0.2s ease;
                    ">
                        <input type="checkbox" class="manager-chart-checkbox" data-entry="${entry.entry}" ${isChecked ? 'checked' : ''} style="
                            accent-color: #8b5cf6;
                            width: 14px;
                            height: 14px;
                        ">
                        <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">
                            ${entry.entry_name}
                        </span>
                    </label>
                `;
            });

            tabContentHtml = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    width: 100%;
                ">
                    <!-- Checkbox selectors -->
                    <div style="
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                        padding: 12px;
                        background: rgba(255, 255, 255, 0.01);
                        border: 1px solid var(--border-color);
                        border-radius: 12px;
                    ">
                        <div style="width: 100%; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Compare Managers (Select to plot)</div>
                        ${comparisonControlsHtml}
                    </div>

                    <!-- Chart Box -->
                    <div style="
                        background: ${isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.4)'};
                        border: 1px solid var(--border-color);
                        border-radius: 16px;
                        padding: 20px;
                        position: relative;
                        width: 100%;
                        box-sizing: border-box;
                    ">
                        <canvas id="leaguePerformanceChart" style="width: 100%; height: 350px;"></canvas>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="league-analyzer-view" style="
                display: flex;
                flex-direction: column;
                gap: 20px;
                padding: 24px;
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
                box-sizing: border-box;
            ">
                <!-- Header Banner -->
                <div class="analyzer-header" style="
                    background: linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #4c1d95 100%);
                    border-radius: 16px;
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                    flex-wrap: wrap;
                ">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="
                            width: 56px;
                            height: 56px;
                            border-radius: 12px;
                            background: rgba(255, 255, 255, 0.06);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                        ">
                            <i data-lucide="bar-chart-2" style="width: 28px; height: 28px; color: #8b5cf6;"></i>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <h1 style="
                                margin: 0;
                                font-size: 24px;
                                font-weight: 900;
                                letter-spacing: 0.5px;
                                color: #ffffff;
                                font-family: var(--font-header);
                            ">${leagueName}</h1>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #c084fc; text-transform: uppercase; letter-spacing: 1px;">
                                <span>LEAGUE CODE: ${leagueId}</span>
                                <span style="opacity: 0.5;">•</span>
                                <span>${standings.length} MANAGERS</span>
                            </div>
                        </div>
                    </div>
                    
                    <button id="resetLeagueCodeBtn" style="
                        background: rgba(255, 255, 255, 0.08);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #ffffff;
                        padding: 10px 16px;
                        border-radius: 8px;
                        font-weight: 800;
                        font-size: 12.5px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: all 0.2s ease;
                    ">
                        <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
                        <span>Change League Code</span>
                    </button>
                </div>

                <!-- Sub-Navigation Tab Panel -->
                <div style="
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                ">
                    ${subTabButtonsHtml}
                </div>

                <!-- Active View Tab Content -->
                <div class="analyzer-tab-content" style="width: 100%;">
                    ${tabContentHtml}
                </div>
            </div>
        `;

        lucide.createIcons();

        // Attach Header Reset Button Click
        container.querySelector('#resetLeagueCodeBtn').addEventListener('click', () => {
            leagueData = null;
            entriesHistory = {};
            selectedEntries = [];
            saveStateToContainer();
            render();
        });

        // Attach Sub-Tab Switch Click Events
        container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeSubTab = btn.getAttribute('data-subtab');
                saveStateToContainer();
                render();
            });
        });

        // Toggle Manager Compare Selection Click Event (Chart view only)
        if (activeSubTab === 'chart') {
            container.querySelectorAll('.manager-chart-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const entryId = parseInt(cb.getAttribute('data-entry'));
                    if (cb.checked) {
                        if (!selectedEntries.includes(entryId)) selectedEntries.push(entryId);
                    } else {
                        selectedEntries = selectedEntries.filter(id => id !== entryId);
                    }
                    saveStateToContainer();
                    renderChart();
                });
            });

            // Trigger Chart Rendering
            renderChart();
        }
    }

    function renderChart() {
        const canvas = container.querySelector('#leaguePerformanceChart');
        if (!canvas) return;

        // Collect FPL Gameweek history metrics
        const firstEntryId = Object.keys(entriesHistory)[0];
        if (!firstEntryId) return;

        const weeksSample = entriesHistory[firstEntryId]?.current || [];
        const labels = weeksSample.map(w => `GW${w.event}`);

        // Prepare line plot datasets
        const datasets = [];
        const colors = [
            '#8b5cf6', '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
            '#ec4899', '#06b6d4', '#64748b', '#a855f7', '#f43f5e',
            '#34d399', '#fb7185', '#60a5fa', '#fbbf24', '#c084fc'
        ];

        let colorIdx = 0;
        selectedEntries.forEach(entryId => {
            const history = entriesHistory[entryId];
            const standingInfo = leagueData.standings.results.find(res => res.entry === entryId);
            if (!history || !history.current || !standingInfo) return;

            const name = standingInfo.entry_name;
            const pointsData = history.current.map(w => w.total_points);
            const color = colors[colorIdx++ % colors.length];

            datasets.push({
                label: name,
                data: pointsData,
                borderColor: color,
                backgroundColor: color + '15', // light fill opacity
                borderWidth: 2.5,
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
                // Pass extra info (event points and overall rank) into metadata array for tooltips
                extra: history.current.map(w => ({
                    eventPts: w.points,
                    rank: w.overall_rank
                }))
            });
        });

        // Initialize Global Chart.js
        if (window.leagueChartInstance) {
            window.leagueChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        window.leagueChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: isLight ? '#1f2937' : '#94a3b8',
                            font: {
                                size: 11,
                                weight: 'bold'
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        padding: 10,
                        backgroundColor: isLight ? '#ffffff' : '#0f172a',
                        titleColor: isLight ? '#1f2937' : '#ffffff',
                        bodyColor: isLight ? '#4b5563' : '#94a3b8',
                        borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        callbacks: {
                            labelColor: function(context) {
                                return {
                                    borderColor: context.dataset.borderColor,
                                    backgroundColor: context.dataset.borderColor
                                };
                            },
                            label: function(context) {
                                const dataset = context.dataset;
                                const index = context.dataIndex;
                                const totalPts = context.parsed.y;
                                
                                const extra = dataset.extra ? dataset.extra[index] : null;
                                let labelText = `${dataset.label}: ${totalPts} pts`;
                                
                                if (extra) {
                                    const rankText = extra.rank ? extra.rank.toLocaleString() : 'N/A';
                                    labelText += ` (+${extra.eventPts} pts) [Rank: ${rankText}]`;
                                }
                                return labelText;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'
                        },
                        ticks: {
                            color: isLight ? '#1f2937' : '#94a3b8',
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'
                        },
                        ticks: {
                            color: isLight ? '#1f2937' : '#94a3b8',
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        });
    }

    // Initial render
    render();
}
