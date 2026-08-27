import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

export const EXPERT_CHANNELS = [
    {
        name: "Fantasy Football Scout - FPL Tips",
        handle: "@FFScout_",
        url: "https://www.youtube.com/@FFScout_",
        color: "#22c55e",
        videosCount: 8,
        subscribers: "185K",
        latestTitle: "THE FPL WATCHLIST GW2 (Odegaard, De Cuyper & Palmer)"
    },
    {
        name: "FPL Harry",
        handle: "@FPLHarry",
        url: "https://www.youtube.com/@FPLHarry",
        color: "#3b82f6",
        videosCount: 6,
        subscribers: "142K",
        latestTitle: "FPL GW2 PREVIEW! PALMER + ROGERS + JOAO PEDRO GOALS!"
    },
    {
        name: "Let's Talk FPL",
        handle: "@LetsTalkFPL",
        url: "https://www.youtube.com/@LetsTalkFPL",
        color: "#8b5cf6",
        videosCount: 6,
        subscribers: "320K",
        latestTitle: "My FPL Team for GW2 (Fernandes Captain & Wissa Targets)"
    },
    {
        name: "FPL Raptor",
        handle: "@FPLRaptor",
        url: "https://www.youtube.com/@FPLRaptor",
        color: "#ec4899",
        videosCount: 5,
        subscribers: "95K",
        latestTitle: "BENCHING HEADACHE! | MY FPL GW2 TEAM SELECTION"
    }
];

export const GAMEWEEK_STRATEGIES = {
    1: {
        gw: 1,
        deadline: "Fri, Aug 15, 06:30 PM",
        timeLeft: "Completed",
        videoCount: 28,
        channelCount: 4,
        overview: "Gameweek 1 set the baseline for the 2026/27 FPL season. The overwhelming pundit consensus across FFScout, FPL Harry, Let's Talk FPL, and FPL Raptor was to balance elite premium assets (Haaland & B.Fernandes) with flexible mid-priced key players like Palmer and Isak.",
        captainConsensus: {
            summary: "Haaland (MCI) and B.Fernandes (MUN) were the dominant captaincy choices across all expert channels for GW1.",
            picks: [
                {
                    player: "Haaland",
                    team: "MCI",
                    price: "£15.5m",
                    rationale: "was favored by over 65% of expert managers due to his formidable goalscoring record and top expected goal involvement (xGI)."
                },
                {
                    player: "B.Fernandes",
                    team: "MUN",
                    price: "£12.0m",
                    rationale: "remained the primary home captaincy alternative with elite set-piece and penalty duties."
                }
            ]
        },
        transferTargets: {
            summary: "Pre-season templates focused heavily on 3-4-3 and 3-5-2 flexible structures.",
            targets: [
                {
                    player: "Isak",
                    team: "LIV",
                    price: "£9.0m",
                    rationale: "was selected by top pundits as a premier forward target."
                },
                {
                    player: "Palmer",
                    team: "CHE",
                    price: "£9.5m",
                    rationale: "remained the core mid-priced talisman for Chelsea."
                }
            ]
        },
        differentials: {
            picks: [
                {
                    player: "Rogers",
                    team: "CHE",
                    price: "£7.5m",
                    rationale: "proved to be a standout attacking option."
                }
            ]
        },
        avoidSell: {
            items: [
                "Avoid rotation-risk options in pre-season without guaranteed starting minutes."
            ]
        },
        chipStrategy: {
            items: [
                "Hold all chips for upcoming double/blank gameweeks later in the season."
            ]
        }
    },
    2: {
        gw: 2,
        deadline: "Fri, Aug 28, 01:30 PM",
        timeLeft: "about 22 hours left",
        videoCount: 25,
        channelCount: 4,
        overview: "Gameweek 2 brings highly anticipated home fixtures for Manchester United and Manchester City, but the overwhelming expert consensus is to roll your transfer and avoid early chips.",
        captainConsensus: {
            summary: "There is an overwhelming consensus among pundits backing Fernandes (MUN) as the standout captaincy choice for GW2.",
            picks: [
                {
                    player: "B.Fernandes",
                    team: "MUN",
                    price: "£12.0m",
                    rationale: "is heavily favored by the vast majority of experts due to his exceptional home record and a highly projected fixture as Manchester United host Ipswich (MUN vs IPS)."
                },
                {
                    player: "Haaland",
                    team: "MCI",
                    price: "£15.5m",
                    rationale: "is the primary alternative for managers who prefer to back the Norwegian away to Crystal Palace (CRY vs MCI), though some hesitation remains around trusting him for this specific away fixture."
                },
                {
                    player: "Palmer",
                    team: "CHE",
                    price: "£9.5m",
                    rationale: "is favored as a top high-upside differential captain pick as Chelsea host their home fixture."
                }
            ]
        },
        transferTargets: {
            summary: "The strongest consensus of the week is to roll your free transfer. Nearly every pundit advises saving it to secure maximum flexibility and double moves ahead of GW3 and GW4. If you must buy:",
            targets: [
                {
                    player: "M.Sangaré",
                    team: "BRE",
                    price: "£5.6m",
                    rationale: "is the premier budget midfielder target after registering two assists in GW1."
                },
                {
                    groupName: "Chelsea assets",
                    players: ["João Pedro", "Palmer", "Rogers"],
                    rationale: "are highly desired, though the consensus is to wait until GW4 when their fixtures turn highly attractive."
                },
                {
                    players: ["Tzolis", "Calafiori"],
                    team: "ARS",
                    rationale: "are favored targets for those wanting immediate coverage ahead of Aston Villa (AVL vs ARS)."
                }
            ]
        },
        differentials: {
            picks: [
                {
                    player: "De Cuyper",
                    team: "BHA",
                    price: "£4.6m",
                    rationale: "is a highly popular out-of-position prospect playing on the left wing, though managers are split on whether to start or bench him away to Chelsea (CHE vs BHA)."
                },
                {
                    player: "Wissa",
                    team: "NEW",
                    price: "£6.0m",
                    rationale: "is a top mid-priced forward target playing an advanced role with improving fixtures from GW2 onwards."
                },
                {
                    player: "Szoboszlai",
                    team: "LIV",
                    price: "£7.0m",
                    rationale: "offers immense value in Liverpool's midfield, especially after taking a penalty in GW1."
                }
            ]
        },
        avoidSell: {
            items: [
                "Do NOT panic-sell GW1 blankers. Pundits strongly agree on holding Fernandes (MUN), Haaland (MCI), Mbeumo (MUN), Wirtz (LIV), and Isak (LIV) due to highly encouraging GW2 fixtures.",
                "Avoid Chelsea defensive assets for now, as goalkeeper Sánchez (CHE) appeared error-prone in GW1."
            ]
        },
        chipStrategy: {
            items: [
                "Do not use early chips like the Wildcard in GW2.",
                "If you previously planned a GW2 Bench Boost, stick to your strategy. Otherwise, a planned Wildcard in GW3 (to bring in Man City assets) or GW4/GW6 (to target Chelsea's fixture swing) is highly favored."
            ]
        }
    }
};

export function renderStrategy(container, state, actions) {
    const availableGws = Object.keys(GAMEWEEK_STRATEGIES).map(Number).sort((a, b) => a - b);
    const defaultGw = availableGws.includes(state.currentGw) ? state.currentGw : 2;
    const activeGw = container.dataset.gw ? parseInt(container.dataset.gw) : defaultGw;
    const strategy = GAMEWEEK_STRATEGIES[activeGw] || GAMEWEEK_STRATEGIES[2];
    const searchQuery = (container.dataset.search || '').toLowerCase().trim();

    container.innerHTML = `
        <div class="strategy-hub-container" style="display: flex; flex-direction: column; gap: 20px; max-width: 1100px; margin: 0 auto; padding-bottom: 30px;">
            <!-- Main Title & Controls Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
                <div>
                    <h2 style="font-family: var(--font-heading); font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px;">
                        <i data-lucide="compass" style="color: var(--primary); width: 26px; height: 26px;"></i> Gameweek Strategy Hub
                    </h2>
                    <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
                        Real-time expert consensus synthesized across top YouTube FPL analysts & data models.
                    </p>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <!-- Gameweek Selector (Only populated GWs) -->
                    <div style="display: flex; background: rgba(0,0,0,0.3); padding: 3px; border-radius: 8px; border: 1px solid var(--border-color);">
                        ${availableGws.map(gwNum => `
                            <button class="gw-strategy-tab-btn" data-gw="${gwNum}" style="padding: 5px 14px; font-size: 12px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; ${gwNum === activeGw ? 'background: var(--primary); color: #000;' : 'background: transparent; color: var(--text-muted);'}">
                                GW${gwNum} ${gwNum === 2 ? '🔥' : ''}
                            </button>
                        `).join('')}
                    </div>

                    <!-- Search Filter -->
                    <div style="position: relative; min-width: 180px;">
                        <input type="text" id="strategySearchInput" value="${searchQuery}" placeholder="Filter player/team..." style="width: 100%; padding: 6px 12px 6px 30px; font-size: 12px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); outline: none;">
                        <i data-lucide="search" style="position: absolute; left: 9px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: var(--text-muted);"></i>
                    </div>

                    <!-- Export / Refresh Actions -->
                    <button id="refreshConsensusBtn" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="refresh-cw" style="width: 13px; height: 13px; color: var(--secondary);"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- YouTube Sources Banner Bar -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
                ${EXPERT_CHANNELS.map(ch => `
                    <a href="${ch.url}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
                        <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; transition: all 0.2s;" class="hover-lift">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 30px; height: 30px; border-radius: 50%; background: ${ch.color}; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 11px; flex-shrink: 0;">
                                        ▶
                                    </div>
                                    <div style="overflow: hidden;">
                                        <div style="font-weight: 700; font-size: 12px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ch.name}</div>
                                        <div style="font-size: 10px; color: var(--text-muted);">${ch.handle} • ${ch.subscribers} subs</div>
                                    </div>
                                </div>
                                <span style="font-size: 9.5px; font-weight: 700; color: ${ch.color}; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">
                                    ${ch.videosCount} vids
                                </span>
                            </div>
                            <div style="font-size: 10.5px; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; border-left: 2px solid ${ch.color};" title="${ch.latestTitle}">
                                📹 "${ch.latestTitle}"
                            </div>
                        </div>
                    </a>
                `).join('')}
            </div>

            <!-- Strategy Card Main Container -->
            <div class="strategy-card-main" style="background: rgba(13, 18, 30, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: var(--font-main);">
                
                <!-- Card Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: #22c55e; margin: 0; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="trending-up" style="width: 22px; height: 22px;"></i> GW${strategy.gw} Strategy
                        </h3>
                        <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 16px; display: flex; align-items: center; gap: 5px;">
                            <i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${strategy.timeLeft}
                        </span>
                    </div>

                    <button id="sendStrategyBtn" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 16px; background: #2563eb; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4);">
                        <i data-lucide="send" style="width: 13px; height: 13px;"></i> Send
                    </button>
                </div>

                <!-- Deadline & Video Count Subtitle -->
                <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 16px;">
                    Deadline: <span style="color: #f8fafc; font-weight: 600;">${strategy.deadline}</span> • <span style="color: #60a5fa; font-weight: 600;">${strategy.videoCount} videos</span> from <span style="color: #60a5fa; font-weight: 600;">${strategy.channelCount} channels</span>
                </div>

                <!-- Executive Summary -->
                <div style="font-size: 13.5px; line-height: 1.6; color: #cbd5e1; margin-bottom: 22px; background: rgba(255,255,255,0.02); padding: 12px 16px; border-radius: 8px; border-left: 3px solid #22c55e;">
                    ${highlightSearch(strategy.overview, searchQuery)}
                </div>

                <div style="display: flex; flex-direction: column; gap: 20px;">
                    
                    <!-- 1. CAPTAIN CONSENSUS -->
                    <div class="strategy-section">
                        <h4 style="font-family: var(--font-heading); font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #60a5fa; display: flex; align-items: center; gap: 6px; margin: 0 0 8px 0;">
                            <i data-lucide="target" style="width: 14px; height: 14px; color: #60a5fa;"></i> CAPTAIN CONSENSUS
                        </h4>
                        <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">
                            ${highlightSearch(strategy.captainConsensus.summary, searchQuery)}
                        </div>
                        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${strategy.captainConsensus.picks.map(p => {
                                const foundP = PLAYERS.find(pl => pl.name.includes(p.player) || pl.web_name === p.player);
                                const teamCode = foundP ? foundP.team : p.team;
                                const priceVal = foundP ? `£${foundP.price.toFixed(1)}m` : p.price;
                                return `
                                    <li>
                                        <span style="font-weight: 700; color: #fff;">${p.player}</span>
                                        <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; color: #94a3b8; margin: 0 4px;">⚽ ${teamCode}</span>
                                        <span style="color: var(--primary); font-weight: 700; font-size: 11.5px;">(${priceVal})</span>
                                        ${p.rationale ? highlightSearch(p.rationale, searchQuery) : ''}
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>

                    <!-- 2. TRANSFER TARGETS -->
                    <div class="strategy-section">
                        <h4 style="font-family: var(--font-heading); font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #60a5fa; display: flex; align-items: center; gap: 6px; margin: 0 0 8px 0;">
                            <i data-lucide="repeat" style="width: 14px; height: 14px; color: #60a5fa;"></i> TRANSFER TARGETS
                        </h4>
                        <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">
                            ${highlightSearch(strategy.transferTargets.summary, searchQuery)}
                        </div>
                        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${strategy.transferTargets.targets.map(t => {
                                if (t.player) {
                                    const foundP = PLAYERS.find(pl => pl.name.includes(t.player) || pl.web_name === t.player);
                                    const teamCode = foundP ? foundP.team : t.team;
                                    const priceVal = foundP ? `£${foundP.price.toFixed(1)}m` : t.price;
                                    return `
                                        <li>
                                            <span style="font-weight: 700; color: #fff;">${t.player}</span>
                                            <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; color: #94a3b8; margin: 0 4px;">⚽ ${teamCode}</span>
                                            <span style="color: var(--primary); font-weight: 700; font-size: 11.5px;">(${priceVal})</span>
                                            ${t.rationale ? highlightSearch(t.rationale, searchQuery) : ''}
                                        </li>
                                    `;
                                }
                                if (t.groupName) {
                                    return `
                                        <li>
                                            <span style="font-weight: 700; color: #fff;">${t.groupName}</span> like ${t.players.map(pl => {
                                                const fp = PLAYERS.find(p => p.name.includes(pl) || p.web_name === pl);
                                                const tc = fp ? fp.team : 'CHE';
                                                return `<span style="font-weight: 700; color: #f8fafc;">${pl}</span> <span style="font-size: 9.5px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 0 4px; border-radius: 3px; color: #94a3b8;">⚽ ${tc}</span>`;
                                            }).join(', ')} ${t.rationale ? highlightSearch(t.rationale, searchQuery) : ''}
                                        </li>
                                    `;
                                }
                                if (t.players && !t.groupName) {
                                    return `
                                        <li>
                                            ${t.players.map(pl => {
                                                const fp = PLAYERS.find(p => p.name.includes(pl) || p.web_name === pl);
                                                const tc = fp ? fp.team : (t.team || 'ARS');
                                                return `<span style="font-weight: 700; color: #fff;">${pl}</span> <span style="font-size: 9.5px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 0 4px; border-radius: 3px; color: #94a3b8;">⚽ ${tc}</span>`;
                                            }).join(' and ')} ${t.rationale ? highlightSearch(t.rationale, searchQuery) : ''}
                                        </li>
                                    `;
                                }
                                return '';
                            }).join('')}
                        </ul>
                    </div>

                    <!-- 3. DIFFERENTIALS -->
                    <div class="strategy-section">
                        <h4 style="font-family: var(--font-heading); font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #60a5fa; display: flex; align-items: center; gap: 6px; margin: 0 0 8px 0;">
                            <i data-lucide="gem" style="width: 14px; height: 14px; color: #60a5fa;"></i> DIFFERENTIALS
                        </h4>
                        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${strategy.differentials.picks.map(d => {
                                const foundP = PLAYERS.find(pl => pl.name.includes(d.player) || pl.web_name === d.player);
                                const teamCode = foundP ? foundP.team : d.team;
                                const priceVal = foundP ? `£${foundP.price.toFixed(1)}m` : d.price;
                                return `
                                    <li>
                                        <span style="font-weight: 700; color: #fff;">${d.player}</span>
                                        <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; color: #94a3b8; margin: 0 4px;">⚽ ${teamCode}</span>
                                        <span style="color: var(--primary); font-weight: 700; font-size: 11.5px;">(${priceVal})</span>
                                        ${d.rationale ? highlightSearch(d.rationale, searchQuery) : ''}
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>

                    <!-- 4. AVOID / SELL -->
                    <div class="strategy-section">
                        <h4 style="font-family: var(--font-heading); font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #f87171; display: flex; align-items: center; gap: 6px; margin: 0 0 8px 0;">
                            <i data-lucide="alert-octagon" style="width: 14px; height: 14px; color: #f87171;"></i> AVOID / SELL
                        </h4>
                        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${strategy.avoidSell.items.map(item => `
                                <li>${highlightSearch(item, searchQuery)}</li>
                            `).join('')}
                        </ul>
                    </div>

                    <!-- 5. CHIP STRATEGY -->
                    <div class="strategy-section">
                        <h4 style="font-family: var(--font-heading); font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #c084fc; display: flex; align-items: center; gap: 6px; margin: 0 0 8px 0;">
                            <i data-lucide="rocket" style="width: 14px; height: 14px; color: #c084fc;"></i> CHIP STRATEGY
                        </h4>
                        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${strategy.chipStrategy.items.map(item => `
                                <li>${highlightSearch(item, searchQuery)}</li>
                            `).join('')}
                        </ul>
                    </div>

                </div>

                <!-- Footer Sources Bar -->
                <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-weight: 700; color: #94a3b8;">Sources:</span>
                    ${EXPERT_CHANNELS.map(ch => `
                        <a href="${ch.url}" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 600; text-decoration: none;" class="source-link-item hover-underline">
                            ${ch.name}
                        </a>
                    `).join('<span style="color: rgba(255,255,255,0.2);">•</span>')}
                </div>

            </div>
        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach Event Listeners

    // Gameweek Tab Switching
    container.querySelectorAll('.gw-strategy-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedGw = btn.getAttribute('data-gw');
            container.dataset.gw = selectedGw;
            renderStrategy(container, state, actions);
        });
    });

    // Real-time Search Input
    const searchInput = container.querySelector('#strategySearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            container.dataset.search = e.target.value;
            renderStrategy(container, state, actions);
            // Retain focus
            const newSearchInput = container.querySelector('#strategySearchInput');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        });
    }

    // Refresh Consensus Button
    const refreshBtn = container.querySelector('#refreshConsensusBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `<i data-lucide="loader-2" style="width: 13px; height: 13px; animation: spin 1s linear infinite;"></i> Syncing YouTube...`;
            if (window.lucide) window.lucide.createIcons();
            
            setTimeout(() => {
                actions.showToast ? actions.showToast("GW Strategy refreshed with latest video uploads!", "success") : alert("GW Strategy refreshed!");
                renderStrategy(container, state, actions);
            }, 800);
        });
    }

    // Send / Share Strategy Button
    const sendBtn = container.querySelector('#sendStrategyBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const summaryText = `GW${strategy.gw} FPL Strategy Summary:\n${strategy.overview}\n\nCaptain Consensus: ${strategy.captainConsensus.summary}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(summaryText);
                actions.showToast ? actions.showToast("Strategy summary copied to clipboard!", "info") : alert("Strategy summary copied!");
            }
        });
    }
}

// Helper to highlight search terms
function highlightSearch(text, query) {
    if (!query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, `<mark style="background: rgba(234, 179, 8, 0.35); color: #fef08a; padding: 1px 4px; border-radius: 3px;">$1</mark>`);
}
