import { PLAYERS } from '../data.js';

export function renderTopPerformers(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    const isLight = document.documentElement.classList.contains('light-theme');
    const activeCat = container.dataset.activeCat || 'xa';

    let statKey = 'xA90';
    let statTitle = 'XA/90 LEADERS';
    let iconName = 'target';
    let badgeColor = '#8b5cf6';

    if (activeCat === 'xg') {
        statKey = 'xG90';
        statTitle = 'XG/90 LEADERS';
        iconName = 'circle-dot';
        badgeColor = '#3b82f6';
    } else if (activeCat === 'xgi') {
        statKey = 'xGI';
        statTitle = 'XGI/90 LEADERS';
        iconName = 'flame';
        badgeColor = '#ec4899';
    } else if (activeCat === 'defcon') {
        statKey = 'dcPer90';
        statTitle = 'DEFCON/90 LEADERS';
        iconName = 'shield-alert';
        badgeColor = '#ef4444';
    }

    // Filter players with a minimum of 60 minutes played in the current season to align with the FPLDoctor image thresholds
    const activePlayers = PLAYERS.filter(p => (p.currentSeasonMins || 0) >= 60);
    const columnsList = activeCat === 'defcon' ? ['DEF', 'MID'] : ['DEF', 'MID', 'FWD'];

    // Categories tabs
    const categoriesInfo = [
        { key: 'xa', title: 'xA/90 Leaders', icon: 'target', color: '#8b5cf6' },
        { key: 'xg', title: 'xG/90 Leaders', icon: 'circle-dot', color: '#3b82f6' },
        { key: 'xgi', title: 'xGI/90 Leaders', icon: 'flame', color: '#ec4899' },
        { key: 'defcon', title: 'Defcon/90 Leaders', icon: 'shield-alert', color: '#ef4444' }
    ];

    let tabsHtml = '';
    categoriesInfo.forEach(info => {
        const isSel = info.key === activeCat;
        let tabBg = 'rgba(255, 255, 255, 0.02)';
        let tabBorder = 'var(--border-color)';
        if (isLight) {
            tabBg = isSel ? 'var(--primary-glow)' : '#ffffff';
            tabBorder = isSel ? 'var(--primary)' : '#e5e7eb';
        } else {
            tabBg = isSel ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)';
            tabBorder = isSel ? 'var(--primary)' : 'var(--border-color)';
        }

        tabsHtml += `
            <button class="top-perf-tab-btn ${isSel ? 'active' : ''}" data-cat="${info.key}" style="
                padding: 10px 20px;
                border-radius: 8px;
                background: ${tabBg};
                border: 1px solid ${tabBorder};
                color: ${isSel ? (isLight ? 'var(--primary)' : '#ffffff') : 'var(--text-muted)'};
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s ease;
            ">
                <i data-lucide="${info.icon}" style="width: 14px; height: 14px; ${isSel ? `color: ${info.color}` : ''}"></i>
                <span>${info.title.split(' ')[0]}</span>
            </button>
        `;
    });

    // Custom value resolver to align with FPLDoctor metric formulas
    const getVal = (p) => {
        if (activeCat === 'xgi') {
            return (p.xG90 || 0) + (p.xA90 || 0);
        }
        if (activeCat === 'defcon') {
            return p.dcPer90 || 0;
        }
        return p[statKey] || 0;
    };

    let columnsHtml = '';
    columnsList.forEach(pos => {
        const topRankings = activePlayers
            .filter(p => p.position === pos && getVal(p) > 0)
            .sort((a, b) => getVal(b) - getVal(a))
            .slice(0, 10);

        let rowsHtml = '';
        topRankings.forEach((p, idx) => {
            const code = p.code || 3;
            const shirtUrl = p.position === 'GKP'
                ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}_1-110.webp`
                : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-110.webp`;

            const rank = idx + 1;
            let rankBg = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)';
            let rankColor = 'var(--text-muted)';
            if (rank === 1) {
                rankBg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                rankColor = '#ffffff';
            } else if (rank === 2) {
                rankBg = isLight 
                    ? 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)'
                    : 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)';
                rankColor = '#ffffff';
            } else if (rank === 3) {
                rankBg = isLight
                    ? 'linear-gradient(135deg, #d97706 0%, #92400e 100%)'
                    : 'linear-gradient(135deg, #b45309 0%, #78350f 100%)';
                rankColor = '#ffffff';
            }

            const val = getVal(p);
            const valFormatted = val.toFixed(2);

            rowsHtml += `
                <div class="top-perf-row" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: ${idx % 2 === 0 ? 'transparent' : (isLight ? 'rgba(0, 0, 0, 0.015)' : 'rgba(255, 255, 255, 0.01)')};
                    border-bottom: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.03)'};
                    font-size: 13px;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 800;
                            font-size: 10.5px;
                            background: ${rankBg};
                            color: ${rankColor};
                        ">${rank}</span>
                        <div style="width: 28px; height: 32px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="${shirtUrl}" style="width: 28px; height: auto;" onerror="this.onerror=null; this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-110.webp';">
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 700; color: var(--text-main);">${p.web_name}</span>
                            <span style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${p.team}</span>
                        </div>
                    </div>
                    <span style="font-weight: 800; color: var(--text-main); font-family: monospace; font-size: 13.5px;">${valFormatted}</span>
                </div>
            `;
        });

        if (rowsHtml === '') {
            rowsHtml = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
                    No player stats registered for this position.
                </div>
            `;
        }

        columnsHtml += `
            <div class="top-perf-col" style="
                flex: 1;
                min-width: 280px;
                background: ${isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.4)'};
                border: 1px solid var(--border-color);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: ${isLight ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none'};
            ">
                <div style="
                    background: ${isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)'};
                    padding: 10px;
                    text-align: center;
                    border-bottom: 1px solid var(--border-color);
                    font-weight: 800;
                    font-size: 13px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">${pos}</div>
                <div style="display: flex; flex-direction: column;">
                    ${rowsHtml}
                </div>
            </div>
        `;
    });

    const bannerBg = isLight 
        ? 'linear-gradient(135deg, #f3e8ff 0%, #fae8ff 50%, #fce7f3 100%)'
        : 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #4c0519 100%)';
    const bannerBorder = isLight ? '1px solid #e9d5ff' : '1px solid rgba(255, 255, 255, 0.05)';
    const titleColor = isLight ? '#4c1d95' : '#ffffff';
    const subLabelColor = isLight ? '#0284c7' : '#38bdf8';
    const iconContainerBg = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.06)';
    const iconContainerBorder = isLight ? '1px solid #e9d5ff' : '1px solid rgba(255, 255, 255, 0.1)';

    container.innerHTML = `
        <div class="top-performers-view" style="
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
            <div class="top-perf-header" style="
                background: ${bannerBg};
                border-radius: 16px;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                border: ${bannerBorder};
                box-shadow: ${isLight ? '0 10px 15px -3px rgba(0,0,0,0.03)' : '0 10px 30px -10px rgba(0,0,0,0.5)'};
            ">
                <div style="
                    width: 56px;
                    height: 56px;
                    border-radius: 12px;
                    background: ${iconContainerBg};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: ${iconContainerBorder};
                ">
                    <i data-lucide="${iconName}" style="width: 28px; height: 28px; color: ${badgeColor};"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <h1 style="
                        margin: 0;
                        font-size: 26px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        color: ${titleColor};
                        font-family: var(--font-header);
                        text-shadow: ${isLight ? 'none' : '0 2px 4px rgba(0,0,0,0.3)'};
                    ">${statTitle}</h1>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: ${subLabelColor}; text-transform: uppercase; letter-spacing: 1px;">
                        <span>BY POSITION</span>
                        <span style="opacity: 0.5;">•</span>
                        <span>UPDATED DAILY</span>
                    </div>
                </div>
            </div>

            <!-- Tab Menu -->
            <div class="top-perf-tabs" style="
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 4px;
            ">
                ${tabsHtml}
            </div>

            <!-- Position Columns Grid -->
            <div class="top-perf-grid" style="
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                width: 100%;
            ">
                ${columnsHtml}
            </div>
        </div>
    `;

    lucide.createIcons();

    // Attach click listeners to tabs
    container.querySelectorAll('.top-perf-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-cat');
            container.dataset.activeCat = cat;
            renderTopPerformers(container, state, actions);
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
                    <h3 class="lock-title">Top Performers Locked</h3>
                    <p class="lock-desc">Unlock advanced historical and live player performance dashboards. Review under-the-radar performers and underlying stats metrics.</p>
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
