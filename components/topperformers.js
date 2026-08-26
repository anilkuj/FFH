import { PLAYERS } from '../data.js';

const TOP_PERFORMERS = {
    xa: {
        title: "XA/90 LEADERS",
        icon: "target",
        badgeColor: "#8b5cf6",
        columns: {
            DEF: [
                { name: "O'Reilly", val: "0.59" },
                { name: "Maguire", val: "0.40" },
                { name: "Hall", val: "0.35" },
                { name: "Guéhi", val: "0.32" },
                { name: "Hume", val: "0.31" },
                { name: "Reinildo", val: "0.29" },
                { name: "Murillo", val: "0.28" },
                { name: "Shaw", val: "0.26" },
                { name: "De Cuyper", val: "0.24" },
                { name: "White", val: "0.21" }
            ],
            MID: [
                { name: "Fatawu", val: "0.57" },
                { name: "Gomez", val: "0.51" },
                { name: "Jensen", val: "0.46" },
                { name: "Foden", val: "0.44" },
                { name: "Slater", val: "0.44" },
                { name: "Enciso", val: "0.40" },
                { name: "Sangaré", val: "0.40" },
                { name: "O.Dango", val: "0.40" },
                { name: "Bobb", val: "0.40" },
                { name: "Anderson", val: "0.36" }
            ],
            FWD: [
                { name: "Georginio", val: "0.44" },
                { name: "Evanilson", val: "0.26" },
                { name: "Barry", val: "0.10" },
                { name: "Thiago", val: "0.09" },
                { name: "Emersonn", val: "0.08" },
                { name: "João Pedro", val: "0.06" },
                { name: "Havertz", val: "0.03" },
                { name: "Mateta", val: "0.03" },
                { name: "Thomas-Asante", val: "0.03" },
                { name: "Haaland", val: "0.02" }
            ]
        }
    },
    xg: {
        title: "XG/90 LEADERS",
        icon: "circle-dot",
        badgeColor: "#3b82f6",
        columns: {
            DEF: [
                { name: "De Cuyper", val: "1.72" },
                { name: "Guéhi", val: "0.89" },
                { name: "Ajayi", val: "0.74" },
                { name: "Kayode", val: "0.60" },
                { name: "Mendy", val: "0.40" },
                { name: "Collins", val: "0.34" },
                { name: "Mazraoui", val: "0.25" },
                { name: "Virgil", val: "0.25" },
                { name: "Gvardiol", val: "0.19" },
                { name: "White", val: "0.18" }
            ],
            MID: [
                { name: "Hinshelwood", val: "2.01" },
                { name: "Rogers", val: "1.07" },
                { name: "Saka", val: "0.86" },
                { name: "Szoboszlai", val: "0.85" },
                { name: "Lewis-Potter", val: "0.77" },
                { name: "Maeda", val: "0.69" },
                { name: "Schade", val: "0.52" },
                { name: "Moore", val: "0.51" },
                { name: "Mbeumo", val: "0.50" },
                { name: "Tavernier", val: "0.40" }
            ],
            FWD: [
                { name: "Emersonn", val: "1.14" },
                { name: "Thiago", val: "1.10" },
                { name: "Isak", val: "1.09" },
                { name: "Mateta", val: "1.02" },
                { name: "Wissa", val: "1.00" },
                { name: "Haaland", val: "0.74" },
                { name: "García", val: "0.73" },
                { name: "João Pedro", val: "0.63" },
                { name: "Barry", val: "0.52" },
                { name: "Brobbey", val: "0.41" }
            ]
        }
    },
    xgi: {
        title: "XGI/90 LEADERS",
        icon: "flame",
        badgeColor: "#ec4899",
        columns: {
            DEF: [
                { name: "De Cuyper", val: "1.96" },
                { name: "Guéhi", val: "1.21" },
                { name: "Ajayi", val: "0.74" },
                { name: "O'Reilly", val: "0.70" },
                { name: "Kayode", val: "0.60" },
                { name: "Maguire", val: "0.44" },
                { name: "Mendy", val: "0.40" },
                { name: "White", val: "0.39" },
                { name: "Collins", val: "0.38" },
                { name: "Castagne", val: "0.36" }
            ],
            MID: [
                { name: "Hinshelwood", val: "2.04" },
                { name: "Szoboszlai", val: "1.12" },
                { name: "Saka", val: "0.97" },
                { name: "Lewis-Potter", val: "0.89" },
                { name: "Rogers", val: "0.84" },
                { name: "Mbeumo", val: "0.73" },
                { name: "Gomez", val: "0.70" },
                { name: "Maeda", val: "0.69" },
                { name: "Enciso", val: "0.69" },
                { name: "Foden", val: "0.58" }
            ],
            FWD: [
                { name: "Emersonn", val: "1.22" },
                { name: "Thiago", val: "1.19" },
                { name: "Isak", val: "1.10" },
                { name: "Mateta", val: "1.04" },
                { name: "Wissa", val: "1.02" },
                { name: "Haaland", val: "0.76" },
                { name: "García", val: "0.72" },
                { name: "Barry", val: "0.62" },
                { name: "Georginio", val: "0.52" },
                { name: "João Pedro", val: "0.49" }
            ]
        }
    },
    defcon: {
        title: "DEFCON/90 LEADERS",
        icon: "shield-alert",
        badgeColor: "#ef4444",
        columns: {
            DEF: [
                { name: "Egan", val: "21.00" },
                { name: "Mendy", val: "18.57" },
                { name: "O'Shea", val: "18.00" },
                { name: "Richards", val: "16.00" },
                { name: "Senesi", val: "16.00" },
                { name: "Acheampong", val: "15.00" },
                { name: "Thiaw", val: "15.00" },
                { name: "Murillo", val: "14.00" },
                { name: "Silva", val: "13.00" },
                { name: "Lacroix", val: "12.00" }
            ],
            MID: [
                { name: "Armstrong", val: "16.00" },
                { name: "Stach", val: "16.00" },
                { name: "L.Miley", val: "15.60" },
                { name: "Sangaré", val: "15.60" },
                { name: "Wharton", val: "14.00" },
                { name: "Kamada", val: "14.00" },
                { name: "Núñez", val: "13.67" },
                { name: "Janelt", val: "13.00" },
                { name: "Ampadu", val: "13.00" },
                { name: "Xhaka", val: "13.00" }
            ]
        }
    }
};

function getPlayerData(name) {
    const cleanName = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s\-']/g, "");

    // Specific overrides
    if (name === "O.Dango") {
        const dango = PLAYERS.find(pl => pl.web_name === "O.Dango");
        if (dango) return dango;
    }
    if (name === "Thomas-Asante") {
        const asante = PLAYERS.find(pl => pl.web_name === "Thomas-Asante");
        if (asante) return asante;
    }

    let p = PLAYERS.find(pl => {
        const webName = pl.web_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return webName === cleanName;
    });

    if (!p) {
        p = PLAYERS.find(pl => {
            const fullName = pl.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return fullName.includes(cleanName) || cleanName.includes(fullName);
        });
    }

    return p;
}

export function renderTopPerformers(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    const activeCat = container.dataset.activeCat || 'xa';
    const catData = TOP_PERFORMERS[activeCat];

    let tabsHtml = '';
    Object.keys(TOP_PERFORMERS).forEach(key => {
        const isSel = key === activeCat;
        const info = TOP_PERFORMERS[key];
        tabsHtml += `
            <button class="top-perf-tab-btn ${isSel ? 'active' : ''}" data-cat="${key}" style="
                padding: 10px 20px;
                border-radius: 8px;
                background: ${isSel ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)'};
                border: 1px solid ${isSel ? 'var(--primary)' : 'var(--border-color)'};
                color: ${isSel ? '#ffffff' : 'var(--text-muted)'};
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s ease;
            ">
                <i data-lucide="${info.icon}" style="width: 14px; height: 14px; ${isSel ? `color: ${info.badgeColor}` : ''}"></i>
                <span>${info.title.split(' ')[0]}</span>
            </button>
        `;
    });

    let columnsHtml = '';
    const posKeys = Object.keys(catData.columns);
    posKeys.forEach(pos => {
        const rows = catData.columns[pos];
        let rowsHtml = '';
        
        rows.forEach((row, idx) => {
            const p = getPlayerData(row.name);
            const teamText = p ? p.team : 'FPL';
            const code = p ? p.code : 3;
            
            const shirtUrl = p && p.position === 'GKP'
                ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}_1-110.webp`
                : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-110.webp`;

            const rank = idx + 1;
            let rankBg = 'rgba(255, 255, 255, 0.05)';
            let rankColor = 'var(--text-muted)';
            if (rank === 1) {
                rankBg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                rankColor = '#ffffff';
            } else if (rank === 2) {
                rankBg = 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)';
                rankColor = '#ffffff';
            } else if (rank === 3) {
                rankBg = 'linear-gradient(135deg, #b45309 0%, #78350f 100%)';
                rankColor = '#ffffff';
            }

            rowsHtml += `
                <div class="top-perf-row" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.01);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
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
                            <span style="font-weight: 700; color: var(--text-main);">${row.name}</span>
                            <span style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${teamText}</span>
                        </div>
                    </div>
                    <span style="font-weight: 800; color: var(--text-main); font-family: monospace; font-size: 13.5px;">${row.val}</span>
                </div>
            `;
        });

        columnsHtml += `
            <div class="top-perf-col" style="
                flex: 1;
                min-width: 280px;
                background: rgba(30, 41, 59, 0.4);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                overflow: hidden;
            ">
                <div style="
                    background: rgba(255, 255, 255, 0.02);
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
                background: linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #4c0519 100%);
                border-radius: 16px;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
            ">
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
                    <i data-lucide="${catData.icon}" style="width: 28px; height: 28px; color: ${catData.badgeColor};"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <h1 style="
                        margin: 0;
                        font-size: 26px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        color: #ffffff;
                        font-family: var(--font-header);
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${catData.title}</h1>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">
                        <span>BY POSITION</span>
                        <span style="opacity: 0.5;">•</span>
                        <span>GW1</span>
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
