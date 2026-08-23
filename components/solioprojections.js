import { TEAMS } from '../data.js';

let activeSubTab = 'projections';
let searchQuery = '';
let solioData = null;
let isLoading = false;
let loadError = null;

export function renderSolioProjections(container, state, actions) {
    
    function render() {
        if (isLoading) {
            container.innerHTML = renderSkeletonLoader();
            return;
        }

        if (loadError) {
            container.innerHTML = renderErrorAlert(loadError);
            setupErrorListeners();
            return;
        }

        if (!solioData) {
            fetchData();
            return;
        }

        const genDate = solioData.generatedAt ? new Date(solioData.generatedAt).toLocaleString() : 'N/A';
        const deadlineDate = solioData.deadlineIso ? new Date(solioData.deadlineIso).toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'N/A';

        container.innerHTML = `
            <div class="solio-projections-container" style="display:flex; flex-direction:column; gap:24px; padding-bottom: 40px;">
                <!-- Header Card -->
                <div class="glass-panel" style="padding: 24px; border-radius: 16px; border: 1px solid var(--border-color); background: var(--bg-card); display:flex; flex-direction:column; gap:12px; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:-20px; right:-20px; width:120px; height:120px; background: radial-gradient(circle, rgba(0, 255, 136, 0.08) 0%, transparent 70%); border-radius:50%; pointer-events:none;"></div>
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
                        <div>
                            <span class="pill-value" style="background: rgba(0, 255, 136, 0.1); color: var(--primary); border: 1px solid var(--primary-glow); font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">Live Feed</span>
                            <h2 style="font-family: var(--font-heading); font-weight:800; font-size:26px; margin: 6px 0 2px 0; background: linear-gradient(135deg, var(--text-main), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Solio Analytics Hub</h2>
                            <p style="color:var(--text-muted); font-size:13px; max-width:600px;">Pairing market-based projection models and statistical simulations. View clean sheet odds, goal/assist creators, differentials, and optimal captains.</p>
                        </div>
                        <div style="display:flex; gap:12px; flex-wrap:wrap;">
                            <div class="stat-badge" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:10px 14px; text-align:center;">
                                <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; display:block; margin-bottom:2px;">Gameweek</span>
                                <span style="font-family:var(--font-heading); font-size:16px; font-weight:800; color:var(--primary);">GW ${solioData.gameweek || state.currentGw}</span>
                            </div>
                            <div class="stat-badge" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:10px 14px; text-align:center;">
                                <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; display:block; margin-bottom:2px;">Deadline</span>
                                <span style="font-family:var(--font-heading); font-size:14px; font-weight:700; color:var(--secondary);">${deadlineDate}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.04); padding-top:12px;">
                        <span style="font-size:11px; color:var(--text-muted);">Last Sync: <strong>${genDate}</strong></span>
                        <a href="https://fpl.solioanalytics.com" target="_blank" style="font-size:11px; color:var(--secondary); text-decoration:none; font-weight:700; display:flex; align-items:center; gap:4px;">
                            Visit Solio Analytics <i data-lucide="external-link" style="width:12px; height:12px;"></i>
                        </a>
                    </div>
                </div>

                <!-- Sub-Tabs and Search bar Row -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;">
                    <!-- Scrollable Pill Menu -->
                    <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; max-width:100%; -webkit-overflow-scrolling: touch;">
                        ${renderTabButton('projections', 'Points Projections', 'trending-up')}
                        ${renderTabButton('cleansheets', 'Clean Sheet Odds', 'shield-check')}
                        ${renderTabButton('goalsassists', 'Goals & Assists', 'swords')}
                        ${renderTabButton('captains', 'Captain Picker', 'crown')}
                        ${renderTabButton('differentials', 'Differentials', 'zap')}
                        ${renderTabButton('defcon', 'DefCon Shield', 'shield-alert')}
                    </div>

                    <!-- Search Input -->
                    <div style="position:relative; width: 100%; max-width:300px;">
                        <i data-lucide="search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted);"></i>
                        <input type="text" id="solioSearchInput" placeholder="Search player or team..." value="${searchQuery}" style="width:100%; height:36px; padding: 0 16px 0 38px; font-size:13px; font-weight:500; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); outline:none; transition: border-color 0.2s;" />
                        ${searchQuery ? `<button id="clearSolioSearchBtn" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px;"><i data-lucide="x" style="width:13px; height:13px;"></i></button>` : ''}
                    </div>
                </div>

                <!-- Content Panel -->
                <div class="glass-panel" style="padding: 20px; border-radius: 16px; border: 1px solid var(--border-color); background: var(--bg-card);">
                    ${renderSubTabContent()}
                </div>
            </div>
        `;

        lucide.createIcons();
        setupInteractiveListeners();
    }

    function renderTabButton(tabId, label, iconName) {
        const isActive = activeSubTab === tabId;
        const bg = isActive ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'transparent';
        const color = isActive ? '#05070f' : 'var(--text-main)';
        const border = isActive ? 'none' : '1px solid var(--border-color)';
        const padding = isActive ? '8px 16px' : '7px 15px';
        const fontWeight = isActive ? '700' : '500';

        return `
            <button class="solio-tab-btn" data-tab-id="${tabId}" style="display:flex; align-items:center; gap:8px; padding:${padding}; font-size:12px; font-weight:${fontWeight}; border-radius:20px; background:${bg}; color:${color}; border:${border}; cursor:pointer; white-space:nowrap; transition: background 0.2s, transform 0.1s;">
                <i data-lucide="${iconName}" style="width:14px; height:14px;"></i>
                ${label}
            </button>
        `;
    }

    function renderSkeletonLoader() {
        return `
            <div style="display:flex; flex-direction:column; gap:24px; padding-bottom: 40px; animate-pulse">
                <!-- Header skeleton -->
                <div style="height:120px; border-radius:16px; background:rgba(255,255,255,0.015); border:1px solid var(--border-color); padding:24px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="width:80px; height:16px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="width:240px; height:28px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="width:400px; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                    </div>
                    <div style="width:150px; height:60px; background:rgba(255,255,255,0.03); border-radius:10px;"></div>
                </div>
                
                <!-- Pills skeleton -->
                <div style="display:flex; justify-content:space-between; gap:20px;">
                    <div style="display:flex; gap:8px;">
                        <div style="width:120px; height:32px; background:rgba(255,255,255,0.02); border-radius:20px;"></div>
                        <div style="width:120px; height:32px; background:rgba(255,255,255,0.02); border-radius:20px;"></div>
                        <div style="width:120px; height:32px; background:rgba(255,255,255,0.02); border-radius:20px;"></div>
                    </div>
                    <div style="width:200px; height:32px; background:rgba(255,255,255,0.02); border-radius:8px;"></div>
                </div>

                <!-- Table skeleton -->
                <div style="height:400px; border-radius:16px; background:rgba(255,255,255,0.01); border:1px solid var(--border-color); padding:20px; display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; gap:10px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:12px;">
                        <div style="flex:2; height:18px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="flex:1; height:18px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="flex:1; height:18px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="flex:1.5; height:18px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                        <div style="flex:1; height:18px; background:rgba(255,255,255,0.03); border-radius:4px;"></div>
                    </div>
                    ${Array.from({ length: 8 }).map(() => `
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="flex:2; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                            <div style="flex:1; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                            <div style="flex:1; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                            <div style="flex:1.5; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                            <div style="flex:1; height:14px; background:rgba(255,255,255,0.02); border-radius:4px;"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderErrorAlert(msg) {
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px 20px; text-align:center; background:rgba(239, 68, 68, 0.02); border:1px dashed rgba(239, 68, 68, 0.15); border-radius:16px;">
                <div style="width:48px; height:48px; border-radius:50%; background:rgba(239, 68, 68, 0.1); display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="alert-circle" style="color:#ef4444; width:24px; height:24px;"></i>
                </div>
                <div>
                    <h3 style="font-family:var(--font-heading); font-size:16px; font-weight:700; margin-bottom:4px; color:var(--text-main);">Connection Failed</h3>
                    <p style="color:var(--text-muted); font-size:13px; max-width:400px;">Could not connect to Solio Analytics API proxy. Check internet or try again.</p>
                    <code style="display:block; margin-top:8px; font-size:11px; color:#ef4444; background:rgba(239,68,68,0.05); padding:4px 8px; border-radius:4px;">${msg}</code>
                </div>
                <button id="solioRetryBtn" class="apply-rec-btn" style="width:auto; height:34px; padding:0 20px; margin:0; border-radius:8px;">
                    <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Retry Connection
                </button>
            </div>
        `;
    }

    function matchSearch(name, team) {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase().trim();
        return (name || '').toLowerCase().includes(q) || (team || '').toLowerCase().includes(q);
    }

    function renderSubTabContent() {
        if (!solioData) return '';

        switch (activeSubTab) {
            case 'projections': {
                const list = (solioData.topProjected || []).filter(p => matchSearch(p.name, p.team));
                if (list.length === 0) return renderEmptySearch();

                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); color:var(--text-muted); font-weight:600;">
                                    <th style="padding:12px 10px; font-weight:600;">Player</th>
                                    <th style="padding:12px 10px; font-weight:600;">Pos</th>
                                    <th style="padding:12px 10px; font-weight:600;">Price</th>
                                    <th style="padding:12px 10px; font-weight:600;">Ownership</th>
                                    <th style="padding:12px 10px; font-weight:600;">Next Opponent</th>
                                    <th style="padding:12px 10px; font-weight:600; text-align:right;">Projected Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(p => {
                                    const teamColor = TEAMS.find(t => t.shortName === p.team)?.color || '#fff';
                                    const opp = p.opponents?.[0] || { opponent: 'BYE', isHome: true };

                                    return `
                                        <tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
                                            <td style="padding:12px 10px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                                                <span style="display:inline-block; width:6px; height:6px; background:${teamColor}; border-radius:50%;"></span>
                                                ${p.name}
                                                <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${p.team}</span>
                                            </td>
                                            <td style="padding:12px 10px;"><span class="pill-value" style="font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">${p.position}</span></td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">£${(p.price / 10).toFixed(1)}m</td>
                                            <td style="padding:12px 10px; color:var(--text-muted); font-weight:500;">
                                                <div style="display:flex; align-items:center; gap:6px;">
                                                    <div style="flex:1; width:50px; background:rgba(255,255,255,0.03); height:4px; border-radius:2px; overflow:hidden;">
                                                        <div style="background:var(--secondary); height:100%; width:${Math.min(100, p.ownership)}%;"></div>
                                                    </div>
                                                    <span>${p.ownership}%</span>
                                                </div>
                                            </td>
                                            <td style="padding:12px 10px; color:var(--text-main);">
                                                <span style="font-weight:600;">${opp.opponent}</span>
                                                <span style="font-size:11px; color:var(--text-muted);">${opp.isHome ? '(H)' : '(A)'}</span>
                                            </td>
                                            <td style="padding:12px 10px; font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--primary); text-align:right;">
                                                ${p.prPoints.toFixed(2)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            case 'cleansheets': {
                const list = (solioData.bestCleanSheets || []).filter(t => matchSearch(t.team, t.team));
                if (list.length === 0) return renderEmptySearch();

                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); color:var(--text-muted); font-weight:600;">
                                    <th style="padding:12px 10px; font-weight:600;">Team</th>
                                    <th style="padding:12px 10px; font-weight:600;">Fixture</th>
                                    <th style="padding:12px 10px; font-weight:600;">Projected GF</th>
                                    <th style="padding:12px 10px; font-weight:600;">Projected GA</th>
                                    <th style="padding:12px 10px; font-weight:600; text-align:right;">Clean Sheet Prob</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(t => {
                                    const csPct = Math.round(t.csProb * 100);
                                    let pbColor = 'var(--primary)';
                                    if (csPct < 25) pbColor = '#ef4444';
                                    else if (csPct < 35) pbColor = 'var(--accent-purple)';

                                    const fix = t.fixtures?.[0] || { opponent: 'BYE', isHome: true };

                                    return `
                                        <tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
                                            <td style="padding:12px 10px; font-weight:700; color:var(--text-main);">${t.team}</td>
                                            <td style="padding:12px 10px; color:var(--text-main);">
                                                <span>vs ${fix.opponent}</span>
                                                <span style="font-size:11px; color:var(--text-muted);">${fix.isHome ? '(H)' : '(A)'}</span>
                                            </td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">${t.prGoalsFor.toFixed(2)}</td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">${t.prGoalsAgainst.toFixed(2)}</td>
                                            <td style="padding:12px 10px; text-align:right;">
                                                <div style="display:inline-flex; align-items:center; gap:10px; justify-content:flex-end; width:100%;">
                                                    <div style="width:120px; background:rgba(255,255,255,0.03); height:8px; border-radius:4px; overflow:hidden;">
                                                        <div style="background:${pbColor}; height:100%; width:${csPct}%;"></div>
                                                    </div>
                                                    <span style="font-family:var(--font-heading); font-size:14px; font-weight:800; color:var(--text-main); min-width:36px;">${csPct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            case 'goalsassists': {
                const goalsList = (solioData.topGoals || []).filter(p => matchSearch(p.name, p.team));
                const assistsList = (solioData.topAssists || []).filter(p => matchSearch(p.name, p.team));

                if (goalsList.length === 0 && assistsList.length === 0) return renderEmptySearch();

                return `
                    <div class="price-predictor-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
                        <!-- Goals list -->
                        <div>
                            <h3 style="font-family:var(--font-heading); font-weight:800; font-size:16px; color:var(--primary); display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                                <i data-lucide="swords"></i> Top Projected Goalscorers
                            </h3>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${goalsList.map((p, idx) => {
                                    return `
                                        <div style="background:rgba(255,255,255,0.015); border:1px solid var(--border-color); border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                                            <div>
                                                <h4 style="font-size:13px; font-weight:700; color:var(--text-main);">${idx + 1}. ${p.name}</h4>
                                                <span style="font-size:11px; color:var(--text-muted);">${p.team} • ${p.position}</span>
                                            </div>
                                            <div style="text-align:right;">
                                                <span style="font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--primary);">${p.prGoals.toFixed(2)} Goals</span>
                                                <span style="display:block; font-size:10px; color:var(--text-muted); margin-top:2px;">${p.prPoints.toFixed(1)} XP</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Assists list -->
                        <div>
                            <h3 style="font-family:var(--font-heading); font-weight:800; font-size:16px; color:var(--secondary); display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                                <i data-lucide="users"></i> Top Assist Creators
                            </h3>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${assistsList.map((p, idx) => {
                                    return `
                                        <div style="background:rgba(255,255,255,0.015); border:1px solid var(--border-color); border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                                            <div>
                                                <h4 style="font-size:13px; font-weight:700; color:var(--text-main);">${idx + 1}. ${p.name}</h4>
                                                <span style="font-size:11px; color:var(--text-muted);">${p.team} • ${p.position}</span>
                                            </div>
                                            <div style="text-align:right;">
                                                <span style="font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--secondary);">${p.prAssists.toFixed(2)} Assists</span>
                                                <span style="display:block; font-size:10px; color:var(--text-muted); margin-top:2px;">${p.prPoints.toFixed(1)} XP</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
            case 'captains': {
                const list = (solioData.topCaptains || []).filter(p => matchSearch(p.name, p.team));
                if (list.length === 0) return renderEmptySearch();

                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); color:var(--text-muted); font-weight:600;">
                                    <th style="padding:12px 10px; font-weight:600;">Player</th>
                                    <th style="padding:12px 10px; font-weight:600;">Fixture</th>
                                    <th style="padding:12px 10px; font-weight:600;">Base XP</th>
                                    <th style="padding:12px 10px; font-weight:600; text-align:right;">Captain XP (2x)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map((p, idx) => {
                                    const teamColor = TEAMS.find(t => t.shortName === p.team)?.color || '#fff';
                                    const fix = p.opponents?.[0] || { opponent: 'BYE', isHome: true };

                                    return `
                                        <tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
                                            <td style="padding:12px 10px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                                                <span style="font-size:11px; color:var(--text-muted); width:15px;">#${idx + 1}</span>
                                                <span style="display:inline-block; width:6px; height:6px; background:${teamColor}; border-radius:50%;"></span>
                                                ${p.name}
                                                <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${p.team}</span>
                                            </td>
                                            <td style="padding:12px 10px; color:var(--text-main);">
                                                <span>vs ${fix.opponent}</span>
                                                <span style="font-size:11px; color:var(--text-muted);">${fix.isHome ? '(H)' : '(A)'}</span>
                                            </td>
                                            <td style="padding:12px 10px; color:var(--text-muted); font-weight:500;">${p.prPoints.toFixed(2)} XP</td>
                                            <td style="padding:12px 10px; font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--primary); text-align:right;">
                                                ${p.captainProjPoints.toFixed(2)} XP
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            case 'differentials': {
                const list = (solioData.topDifferentials || []).filter(p => matchSearch(p.name, p.team));
                if (list.length === 0) return renderEmptySearch();

                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); color:var(--text-muted); font-weight:600;">
                                    <th style="padding:12px 10px; font-weight:600;">Player</th>
                                    <th style="padding:12px 10px; font-weight:600;">Pos</th>
                                    <th style="padding:12px 10px; font-weight:600;">Price</th>
                                    <th style="padding:12px 10px; font-weight:600;">Ownership</th>
                                    <th style="padding:12px 10px; font-weight:600;">Base XP</th>
                                    <th style="padding:12px 10px; font-weight:600; text-align:right;">Leverage Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(p => {
                                    const teamColor = TEAMS.find(t => t.shortName === p.team)?.color || '#fff';

                                    return `
                                        <tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
                                            <td style="padding:12px 10px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                                                <span style="display:inline-block; width:6px; height:6px; background:${teamColor}; border-radius:50%;"></span>
                                                ${p.name}
                                                <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${p.team}</span>
                                            </td>
                                            <td style="padding:12px 10px;"><span class="pill-value" style="font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">${p.position}</span></td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">£${(p.price / 10).toFixed(1)}m</td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:600;">${p.ownership}%</td>
                                            <td style="padding:12px 10px; color:var(--text-muted); font-weight:500;">${p.prPoints.toFixed(2)} XP</td>
                                            <td style="padding:12px 10px; font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--secondary); text-align:right;">
                                                ${p.leverage.toFixed(2)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            case 'defcon': {
                const list = (solioData.topDefCon || []).filter(p => matchSearch(p.name, p.team));
                if (list.length === 0) return renderEmptySearch();

                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.06); color:var(--text-muted); font-weight:600;">
                                    <th style="padding:12px 10px; font-weight:600;">Player</th>
                                    <th style="padding:12px 10px; font-weight:600;">Pos</th>
                                    <th style="padding:12px 10px; font-weight:600;">Price</th>
                                    <th style="padding:12px 10px; font-weight:600;">Base XP</th>
                                    <th style="padding:12px 10px; font-weight:600;">DefCon Probability</th>
                                    <th style="padding:12px 10px; font-weight:600; text-align:right;">DefCon Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(p => {
                                    const teamColor = TEAMS.find(t => t.shortName === p.team)?.color || '#fff';
                                    const defconPct = Math.round(p.prDefConProb * 100);

                                    return `
                                        <tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
                                            <td style="padding:12px 10px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                                                <span style="display:inline-block; width:6px; height:6px; background:${teamColor}; border-radius:50%;"></span>
                                                ${p.name}
                                                <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${p.team}</span>
                                            </td>
                                            <td style="padding:12px 10px;"><span class="pill-value" style="font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);">${p.position}</span></td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">£${(p.price / 10).toFixed(1)}m</td>
                                            <td style="padding:12px 10px; color:var(--text-muted); font-weight:500;">${p.prPoints.toFixed(2)} XP</td>
                                            <td style="padding:12px 10px; color:var(--text-main); font-weight:500;">
                                                <div style="display:flex; align-items:center; gap:6px;">
                                                    <div style="flex:1; width:50px; background:rgba(255,255,255,0.03); height:4px; border-radius:2px; overflow:hidden;">
                                                        <div style="background:var(--accent-purple); height:100%; width:${defconPct}%;"></div>
                                                    </div>
                                                    <span>${defconPct}%</span>
                                                </div>
                                            </td>
                                            <td style="padding:12px 10px; font-family:var(--font-heading); font-size:15px; font-weight:800; color:var(--accent-purple); text-align:right;">
                                                ${p.prDefConPoints.toFixed(2)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }
        return '';
    }

    function renderEmptySearch() {
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; color:var(--text-muted); gap:8px;">
                <i data-lucide="search" style="width:28px; height:28px;"></i>
                <p style="font-size:13px; font-weight:600;">No results matched "${searchQuery}"</p>
                <p style="font-size:11px;">Try another search query or check spelling.</p>
            </div>
        `;
    }

    async function fetchData() {
        isLoading = true;
        loadError = null;
        render();

        try {
            const res = await fetch('/api/solio-projections');
            if (res.ok) {
                const responseData = await res.json();
                if (responseData && responseData.success && responseData.data) {
                    solioData = responseData.data;
                } else {
                    throw new Error('API returned invalid JSON format');
                }
            } else {
                throw new Error(`Failed to fetch: HTTP ${res.status}`);
            }
        } catch (e) {
            console.error('Error fetching Solio projections:', e);
            loadError = e.message;
        } finally {
            isLoading = false;
            render();
        }
    }

    function setupErrorListeners() {
        const retryBtn = container.querySelector('#solioRetryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                fetchData();
            });
        }
    }

    function setupInteractiveListeners() {
        // Tab buttons
        container.querySelectorAll('.solio-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab-id');
                if (activeSubTab === tabId) return;
                activeSubTab = tabId;
                render();
            });
        });

        // Search Input
        const searchInput = container.querySelector('#solioSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                searchQuery = searchInput.value;
                const contentDiv = container.querySelector('.solio-projections-container > div:last-child');
                if (contentDiv) {
                    contentDiv.innerHTML = renderSubTabContent();
                    lucide.createIcons();
                }
            });

            searchInput.addEventListener('change', () => {
                searchQuery = searchInput.value;
                render();
            });
        }

        // Clear Search
        const clearBtn = container.querySelector('#clearSolioSearchBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchQuery = '';
                render();
            });
        }
    }

    // Run first render
    render();
}
