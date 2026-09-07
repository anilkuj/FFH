import { PLAYERS, TEAMS } from '../data.js';
import { solveQuantStrategy, RISK_PROFILES } from '../lib/quantSolver.js';

export const EXPERT_CHANNELS = [
    {
        id: "ffscout",
        name: "Fantasy Football Scout - FPL Tips",
        handle: "@FFScout_",
        url: "https://www.youtube.com/@FFScout_",
        color: "#22c55e",
        videosCount: 8,
        subscribers: "185K",
        latestTitle: "THE FPL WATCHLIST GW2 (Odegaard, De Cuyper & Palmer)",
        keyTakeaway: "Scout Picks names B.Fernandes (MUN) captain & Haaland (MCI) vice. Advise rolling 1 FT into GW3 to prepare for Chelsea & Arsenal fixture turns.",
        watchlist: ["Cole Palmer (CHE)", "Odegaard (ARS)", "De Cuyper (BHA)"],
        captainPick: "B.Fernandes (MUN)",
        transferRec: "Roll Free Transfer (save for GW3/GW4)"
    },
    {
        id: "fplharry",
        name: "FPL Harry",
        handle: "@FPLHarry",
        url: "https://www.youtube.com/@FPLHarry",
        color: "#3b82f6",
        videosCount: 6,
        subscribers: "142K",
        latestTitle: "FPL GW2 PREVIEW! PALMER + ROGERS + JOAO PEDRO GOALS!",
        keyTakeaway: "Highlights M.Sangaré (BRE) (£5.6m) as top budget midfielder enabler. Evaluates Palmer, Rogers & João Pedro ahead of Chelsea's upcoming fixture swing.",
        watchlist: ["M.Sangaré (BRE)", "João Pedro (CHE)", "Rogers (CHE)"],
        captainPick: "B.Fernandes (MUN)",
        transferRec: "Hold transfers or buy M.Sangaré (£5.6m)"
    },
    {
        id: "letstalkfpl",
        name: "Let's Talk FPL",
        handle: "@LetsTalkFPL",
        url: "https://www.youtube.com/@LetsTalkFPL",
        color: "#8b5cf6",
        videosCount: 6,
        subscribers: "320K",
        latestTitle: "My FPL Team for GW2 (Fernandes Captain & Wissa Targets)",
        keyTakeaway: "Backs B.Fernandes (MUN) home captaincy based on elite Old Trafford underlying stats. Recommends Wissa (NEW) (£6.0m) & Szoboszlai (LIV) (£7.0m). Warns against panic-selling GW1 blankers.",
        watchlist: ["Wissa (NEW)", "Szoboszlai (LIV)", "B.Fernandes (MUN)"],
        captainPick: "B.Fernandes (MUN)",
        transferRec: "Do NOT panic-sell Isak, Wirtz, or Mbeumo"
    },
    {
        id: "fplraptor",
        name: "FPL Raptor",
        handle: "@FPLRaptor",
        url: "https://www.youtube.com/@FPLRaptor",
        color: "#ec4899",
        videosCount: 5,
        subscribers: "95K",
        latestTitle: "BENCHING HEADACHE! | MY FPL GW2 TEAM SELECTION",
        keyTakeaway: "Data model gives B.Fernandes 6.8 xP vs Haaland 6.2 xP for GW2 due to home fixture weighting. Solves benching headaches between De Cuyper vs 5th midfielder.",
        watchlist: ["De Cuyper (BHA)", "B.Fernandes (MUN)", "Haaland (MCI)"],
        captainPick: "B.Fernandes (MUN) (6.8 xP model lead)",
        transferRec: "Save Wildcard for GW4 or GW6"
    },
    {
        id: "fplfocal",
        name: "FPL Focal",
        handle: "@FPLfocal",
        url: "https://www.youtube.com/fplfocal",
        color: "#eab308",
        videosCount: 7,
        subscribers: "210K",
        latestTitle: "MY FPL GW2 TEAM REVEAL & TRANSFERS!",
        keyTakeaway: "Advises patience and rolling the free transfer into GW3. Backs B.Fernandes (MUN) home captaincy vs Ipswich Town, and highlights Palmer & Saka as core targets.",
        watchlist: ["Cole Palmer (CHE)", "Saka (ARS)", "B.Fernandes (MUN)"],
        captainPick: "B.Fernandes (MUN)",
        transferRec: "Roll Free Transfer (save for GW3)"
    }
];

export function renderStrategy(container, state, actions) {
    const isLight = document.documentElement.classList.contains("light-theme");
    const cardBg = isLight ? "#ffffff" : "var(--bg-card)";
    const panelBg = isLight ? "#f8fafc" : "var(--bg-panel)";
    const border = isLight ? "#e2e8f0" : "var(--border-color)";
    const textMain = isLight ? "#0f172a" : "var(--text-main)";
    const textMuted = isLight ? "#64748b" : "var(--text-muted)";

    const activeSubTab = container.dataset.stratTab || "actionhub";
    const solverResult = solveQuantStrategy(state);

    container.innerHTML = `
        <div class="quant-dashboard-container" style="display: flex; flex-direction: column; gap: 24px; max-width: 1240px; margin: 0 auto; padding-bottom: 40px;">
            
            <!-- Quant Header & Navigation Tabs -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid ${border}; padding-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe, #4facfe); display: flex; align-items: center; justify-content: center; color: #000; box-shadow: 0 4px 14px rgba(0, 242, 254, 0.3);">
                        <i data-lucide="cpu" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: ${textMain}; margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px;">
                            <span>Quant FPL Decision & Strategy Engine</span>
                            <span style="font-size: 10px; background: rgba(0, 242, 254, 0.15); color: var(--secondary); padding: 2px 8px; border-radius: 4px; font-weight: 800; border: 1px solid var(--secondary-glow);">MILP SOLVER v3.8</span>
                        </h2>
                        <p style="color: ${textMuted}; font-size: 13px; margin: 0;">
                            Multi-period mathematical decision dashboard optimizing transfers, captaincy, and 38-GW chip roadmaps.
                        </p>
                    </div>
                </div>

                <!-- Sub-Navigation Pills -->
                <div style="display: flex; background: ${panelBg}; padding: 3px; border-radius: 10px; border: 1px solid ${border}; flex-wrap: wrap; gap: 2px;">
                    ${[
                        { id: "actionhub", label: "⚡ Action Hub", icon: "zap" },
                        { id: "runway", label: "🗓️ 38-GW Runway", icon: "calendar" },
                        { id: "matrix", label: "📊 Metrics Matrix", icon: "bar-chart-2" },
                        { id: "playground", label: "🧪 Simulation Lab", icon: "flask-conical" },
                        { id: "youtube", label: "📺 Youtube Insights", icon: "youtube" }
                    ].map(tab => `
                        <button class="strat-nav-btn" data-tab="${tab.id}" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; ${activeSubTab === tab.id ? 'background: var(--primary); color: var(--text-dark); box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);' : 'background: transparent; color: ' + textMuted + ';'}">
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Tab Content Viewport -->
            <div id="stratTabViewport">
                ${activeSubTab === "actionhub" ? renderActionHubView(solverResult, state, cardBg, panelBg, border, textMain, textMuted) : ''}
                ${activeSubTab === "runway" ? renderRunwayView(solverResult, state, cardBg, panelBg, border, textMain, textMuted) : ''}
                ${activeSubTab === "matrix" ? renderMetricsMatrixView(solverResult, state, cardBg, panelBg, border, textMain, textMuted) : ''}
                ${activeSubTab === "playground" ? renderPlaygroundView(solverResult, state, cardBg, panelBg, border, textMain, textMuted) : ''}
                ${activeSubTab === "youtube" ? renderYoutubeView(cardBg, panelBg, border, textMain, textMuted) : ''}
            </div>

        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach Tab Switcher Event Listeners
    container.querySelectorAll('.strat-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.dataset.stratTab = btn.getAttribute('data-tab');
            renderStrategy(container, state, actions);
        });
    });

    // Wire Interactive Controls for Playground & Action Hub
    attachPlaygroundListeners(container, state, actions);
}

/* -------------------------------------------------------------------------- */
/* 1. GW Action Hub View                                                     */
/* -------------------------------------------------------------------------- */
function renderActionHubView(res, state, cardBg, panelBg, border, textMain, textMuted) {
    const isRoll = res.actionType === 'ROLL';
    const primaryCap = res.primaryCaptain;
    const viceCap = res.viceCaptain;

    return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Directive Recommendation Card -->
            <div style="background: ${cardBg}; border: 1px solid ${isRoll ? 'rgba(0, 242, 254, 0.4)' : 'rgba(0, 255, 136, 0.4)'}; border-radius: 16px; padding: 24px; box-shadow: var(--shadow-lg); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; right: 0; padding: 8px 16px; background: ${isRoll ? 'rgba(0, 242, 254, 0.15)' : 'rgba(0, 255, 136, 0.15)'}; border-bottom-left-radius: 12px; font-size: 11px; font-weight: 800; color: ${isRoll ? 'var(--secondary)' : 'var(--primary)'}; border-left: 1px solid ${border}; border-bottom: 1px solid ${border};">
                    OPTIMAL DIRECTIVE FOR GW${state.currentGw}
                </div>

                <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: ${isRoll ? 'rgba(0, 242, 254, 0.15)' : 'rgba(0, 255, 136, 0.15)'}; display: flex; align-items: center; justify-content: center; color: ${isRoll ? 'var(--secondary)' : 'var(--primary)'}; flex-shrink: 0;">
                        <i data-lucide="${isRoll ? 'rotate-ccw' : 'arrow-right-left'}" style="width: 26px; height: 26px;"></i>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: 800; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Action</span>
                        <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: ${textMain}; margin: 2px 0 6px 0;">
                            ${res.executiveRecommendation}
                        </h3>
                        <p style="font-size: 12.5px; color: ${textMuted}; margin: 0; line-height: 1.5;">
                            ${isRoll 
                                ? `Preserves your free transfer to bank ${res.nextFreeTransfers} FTs for GW${state.currentGw + 1}. No single transfer yields >${res.riskProfile.minDeltaThreshold.toFixed(1)} xP delta over 5 GWs.` 
                                : `Net projected gain of +${res.projectedEVGain.toFixed(1)} xP over 5 GWs after accounting for transfer costs.`}
                        </p>
                    </div>
                </div>

                <!-- Stats Strip -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; background: ${panelBg}; padding: 14px; border-radius: 10px; border: 1px solid ${border}; margin-top: 12px;">
                    <div>
                        <span style="font-size: 11px; color: ${textMuted}; display: block;">Projected 5-GW EV Gain</span>
                        <strong style="font-size: 16px; color: var(--primary); font-family: var(--font-heading);">+${res.projectedEVGain.toFixed(1)} xP</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: ${textMuted}; display: block;">In Bank Remaining</span>
                        <strong style="font-size: 16px; color: ${textMain}; font-family: var(--font-heading);">£${res.bank.toFixed(1)}m</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: ${textMuted}; display: block;">Banked FTs (Next GW)</span>
                        <strong style="font-size: 16px; color: var(--secondary); font-family: var(--font-heading);">${res.nextFreeTransfers} FTs</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: ${textMuted}; display: block;">Risk Profile</span>
                        <strong style="font-size: 14px; color: #8b5cf6; text-transform: uppercase;">${res.riskProfile.label.split(' ')[0]}</strong>
                    </div>
                </div>
            </div>

            <!-- Captaincy Advisor & Chip Roadmap Cards Side-by-Side -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px;">
                
                <!-- Captaincy Advisor Card -->
                <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 20px; box-shadow: var(--shadow-md);">
                    <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="crown" style="color: #f59e0b; width: 18px; height: 18px;"></i>
                        Captaincy Advisor
                    </h3>

                    <!-- Primary Captain -->
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="background: #f59e0b; color: #000; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Primary (C)</span>
                            <h4 style="margin: 4px 0 2px 0; font-size: 15px; font-weight: 800; color: ${textMain};">${primaryCap ? primaryCap.name : 'N/A'}</h4>
                            <span style="font-size: 11.5px; color: ${textMuted};">${primaryCap ? primaryCap.team : ''} • £${primaryCap ? primaryCap.price.toFixed(1) : ''}m</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 18px; font-weight: 800; color: var(--primary); font-family: var(--font-heading);">
                                ${primaryCap && primaryCap.predictions ? (primaryCap.predictions.find(p=>p.gw==state.currentGw)?.pts || 6.5).toFixed(1) : '6.5'} xP
                            </span>
                            <span style="display: block; font-size: 10.5px; color: ${textMuted};">Top Model Lead</span>
                        </div>
                    </div>

                    <!-- Vice Captain -->
                    <div style="background: ${panelBg}; border: 1px solid ${border}; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="background: rgba(255, 255, 255, 0.1); color: ${textMuted}; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Vice (V)</span>
                            <h4 style="margin: 4px 0 2px 0; font-size: 14px; font-weight: 700; color: ${textMain};">${viceCap ? viceCap.name : 'N/A'}</h4>
                            <span style="font-size: 11px; color: ${textMuted};">${viceCap ? viceCap.team : ''} • £${viceCap ? viceCap.price.toFixed(1) : ''}m</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 15px; font-weight: 700; color: ${textMain}; font-family: var(--font-heading);">
                                ${viceCap && viceCap.predictions ? (viceCap.predictions.find(p=>p.gw==state.currentGw)?.pts || 5.8).toFixed(1) : '5.8'} xP
                            </span>
                            <span style="display: block; font-size: 10.5px; color: ${textMuted};">Safe Backup</span>
                        </div>
                    </div>
                </div>

                <!-- Chip Roadmap Advisory Card -->
                <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 20px; box-shadow: var(--shadow-md);">
                    <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="shield-alert" style="color: var(--secondary); width: 18px; height: 18px;"></i>
                        Chip Advisory & Roadmap
                    </h3>

                    <div style="background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 10px; padding: 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="background: ${res.chipAdvisory.status === 'ACTIVATE' ? 'var(--primary)' : 'var(--secondary)'}; color: #000; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                                ${res.chipAdvisory.status} ${res.chipAdvisory.chipName || ''}
                            </span>
                            <h4 style="margin: 6px 0 2px 0; font-size: 14px; font-weight: 700; color: ${textMain};">
                                ${res.chipAdvisory.chipName ? res.chipAdvisory.chipName : 'Hold All Chips'}
                            </h4>
                        </div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--secondary);">
                            Target GW: ${res.chipAdvisory.targetGw || 'DGW34'}
                        </div>
                    </div>

                    <p style="font-size: 12px; color: ${textMuted}; line-height: 1.5; margin: 0; background: ${panelBg}; padding: 10px 12px; border-radius: 8px; border: 1px solid ${border};">
                        ${res.chipAdvisory.rationale}
                    </p>
                </div>

            </div>

        </div>
    `;
}

/* -------------------------------------------------------------------------- */
/* 2. 38-GW Strategic Runway View                                             */
/* -------------------------------------------------------------------------- */
function renderRunwayView(res, state, cardBg, panelBg, border, textMain, textMuted) {
    const half1Gws = Array.from({ length: 19 }, (_, i) => i + 1);
    const half2Gws = Array.from({ length: 19 }, (_, i) => i + 20);

    return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 20px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="calendar" style="color: var(--primary); width: 18px; height: 18px;"></i>
                    38-Gameweek Strategic Runway (2 Half Architecture)
                </h3>
                <p style="font-size: 12.5px; color: ${textMuted}; margin: 0 0 20px 0;">
                    Wildcards and half-specific chips are strictly bounded to Half 1 (GW1-19) and Half 2 (GW20-38).
                </p>

                <!-- HALF 1 TIMELINE -->
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 13px; font-weight: 800; color: var(--primary);">HALF 1 (GW1 – GW19)</span>
                        <span style="font-size: 11px; color: ${textMuted};">Wildcard 1 Deadline: GW19</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(19, 1fr); gap: 4px; overflow-x: auto; padding-bottom: 6px;">
                        ${half1Gws.map(gw => {
                            const isCurrent = gw === state.currentGw;
                            const isDgw = gw === 12 || gw === 16;
                            return `
                                <div style="background: ${isCurrent ? 'var(--primary)' : (isDgw ? 'rgba(0, 242, 254, 0.15)' : panelBg)}; border: 1px solid ${isCurrent ? 'var(--primary)' : (isDgw ? 'var(--secondary)' : border)}; border-radius: 6px; padding: 8px 4px; text-align: center; color: ${isCurrent ? '#000' : textMain}; font-size: 10px; font-weight: 700;">
                                    <div>GW${gw}</div>
                                    ${isDgw ? `<div style="font-size: 8px; color: var(--secondary); margin-top:2px;">DGW</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- HALF 2 TIMELINE -->
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 13px; font-weight: 800; color: #8b5cf6;">HALF 2 (GW20 – GW38)</span>
                        <span style="font-size: 11px; color: ${textMuted};">Wildcard 2 & Major DGWs (GW34/37)</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(19, 1fr); gap: 4px; overflow-x: auto; padding-bottom: 6px;">
                        ${half2Gws.map(gw => {
                            const isDgw = gw === 25 || gw === 34 || gw === 37;
                            const isBgw = gw === 29;
                            return `
                                <div style="background: ${isDgw ? 'rgba(139, 92, 246, 0.2)' : (isBgw ? 'rgba(239, 68, 68, 0.15)' : panelBg)}; border: 1px solid ${isDgw ? '#8b5cf6' : (isBgw ? '#ef4444' : border)}; border-radius: 6px; padding: 8px 4px; text-align: center; color: ${textMain}; font-size: 10px; font-weight: 700;">
                                    <div>GW${gw}</div>
                                    ${isDgw ? `<div style="font-size: 8px; color: #8b5cf6; margin-top:2px;">DGW</div>` : ''}
                                    ${isBgw ? `<div style="font-size: 8px; color: #ef4444; margin-top:2px;">BGW</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Banked FT Trajectory Projection -->
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 20px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="trending-up" style="color: var(--secondary); width: 18px; height: 18px;"></i>
                    Banked Free Transfers Trajectory (Up to 5 FTs)
                </h3>

                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    ${res.trajectory.map(item => `
                        <div style="flex: 1; min-width: 80px; background: ${panelBg}; border: 1px solid ${border}; border-radius: 8px; padding: 10px; text-align: center;">
                            <span style="font-size: 10px; color: ${textMuted}; display: block;">GW${item.gw}</span>
                            <strong style="font-size: 16px; color: var(--secondary); font-family: var(--font-heading); display: block; margin: 2px 0;">${item.bankedFt} FT</strong>
                            <span style="font-size: 10px; color: var(--primary); font-weight: 700;">~${item.projectedXp} xP</span>
                        </div>
                    `).join('')}
                </div>
            </div>

        </div>
    `;
}

/* -------------------------------------------------------------------------- */
/* 3. Metrics Matrix View                                                    */
/* -------------------------------------------------------------------------- */
function renderMetricsMatrixView(res, state, cardBg, panelBg, border, textMain, textMuted) {
    const topPlayers = [...PLAYERS].sort((a, b) => {
        const xPA = (a.predictions.find(p=>p.gw==state.currentGw)?.pts || 0);
        const xPB = (b.predictions.find(p=>p.gw==state.currentGw)?.pts || 0);
        return xPB - xPA;
    }).slice(0, 10);

    return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 20px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="bar-chart-2" style="color: var(--primary); width: 18px; height: 18px;"></i>
                    Clean Sheet Odds & Attacking Expected Value Matrix
                </h3>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 1px solid ${border}; color: ${textMuted}; font-size: 11px;">
                                <th style="padding: 10px;">Player</th>
                                <th style="padding: 10px;">Team</th>
                                <th style="padding: 10px;">Pos</th>
                                <th style="padding: 10px;">Price</th>
                                <th style="padding: 10px;">GW${state.currentGw} xP</th>
                                <th style="padding: 10px;">npxG90</th>
                                <th style="padding: 10px;">xA90</th>
                                <th style="padding: 10px;">Clean Sheet Odds</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topPlayers.map(p => {
                                const pred = p.predictions.find(pr=>pr.gw==state.currentGw) || { pts: 0, diff: 3 };
                                const csOdds = Math.round(Math.max(15, Math.min(65, (6 - (pred.diff || 3)) * 11))) + '%';
                                return `
                                    <tr style="border-bottom: 1px solid ${border}; color: ${textMain};">
                                        <td style="padding: 10px; font-weight: 800;">${p.name}</td>
                                        <td style="padding: 10px;"><span style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${p.team}</span></td>
                                        <td style="padding: 10px;">${p.position}</td>
                                        <td style="padding: 10px;">£${p.price.toFixed(1)}m</td>
                                        <td style="padding: 10px; color: var(--primary); font-weight: 800;">${pred.pts ? pred.pts.toFixed(1) : '0.0'} xP</td>
                                        <td style="padding: 10px;">${(p.xG90 || p.xG || 0.35).toFixed(2)}</td>
                                        <td style="padding: 10px;">${(p.xA90 || p.xA || 0.22).toFixed(2)}</td>
                                        <td style="padding: 10px; color: var(--secondary); font-weight: 700;">${csOdds}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/* -------------------------------------------------------------------------- */
/* 4. Simulation Playground View                                              */
/* -------------------------------------------------------------------------- */
function renderPlaygroundView(res, state, cardBg, panelBg, border, textMain, textMuted) {
    const currentMode = state.riskAppetite || 'conservative';

    return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 24px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="flask-conical" style="color: #8b5cf6; width: 18px; height: 18px;"></i>
                    Risk Appetite Diagnostics & Counterfactual Simulator
                </h3>

                <!-- Risk Mode Selector -->
                <div style="margin-bottom: 24px;">
                    <label style="font-size: 12px; font-weight: 700; color: ${textMuted}; display: block; margin-bottom: 8px;">Select Solver Risk Appetite Profile:</label>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        ${Object.keys(RISK_PROFILES).map(key => {
                            const p = RISK_PROFILES[key];
                            const isSel = currentMode === key;
                            return `
                                <button class="risk-profile-btn" data-risk="${key}" style="flex: 1; min-width: 200px; padding: 14px; border-radius: 10px; border: 1px solid ${isSel ? 'var(--primary)' : border}; background: ${isSel ? 'rgba(0, 255, 136, 0.08)' : panelBg}; text-align: left; cursor: pointer;">
                                    <strong style="font-size: 13px; color: ${isSel ? 'var(--primary)' : textMain}; display: block; margin-bottom: 4px;">${p.label}</strong>
                                    <span style="font-size: 11px; color: ${textMuted}; display: block; line-height: 1.4;">${p.description}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Scenario Simulator Results -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; background: ${panelBg}; padding: 18px; border-radius: 12px; border: 1px solid ${border};">
                    <div style="background: ${cardBg}; padding: 14px; border-radius: 8px; border: 1px solid ${border};">
                        <span style="font-size: 11px; color: ${textMuted}; font-weight: 700;">SCENARIO A: ROLL FREE TRANSFER</span>
                        <h4 style="margin: 6px 0; font-size: 16px; color: var(--primary); font-family: var(--font-heading);">+0.5 EV (Bank to ${Math.min(5, res.freeTransfers + 1)} FTs)</h4>
                        <span style="font-size: 11px; color: ${textMuted};">Variance: Low • Hit Penalty: 0 pts</span>
                    </div>

                    <div style="background: ${cardBg}; padding: 14px; border-radius: 8px; border: 1px solid ${border};">
                        <span style="font-size: 11px; color: ${textMuted}; font-weight: 700;">SCENARIO B: TAKE -4 HIT FOR DIFFERENTIAL</span>
                        <h4 style="margin: 6px 0; font-size: 16px; color: #ef4444; font-family: var(--font-heading);">-4.0 Hit Penalty Applied</h4>
                        <span style="font-size: 11px; color: ${textMuted};">Variance: High • Requires >+6.5 xP 5-GW delta</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachPlaygroundListeners(container, state, actions) {
    container.querySelectorAll('.risk-profile-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-risk');
            state.riskAppetite = mode;
            localStorage.setItem('fpl_hub_risk_appetite', mode);
            state.saveState();
            renderStrategy(container, state, actions);
        });
    });
}

/* -------------------------------------------------------------------------- */
/* 5. Youtube Expert Insights View                                           */
/* -------------------------------------------------------------------------- */
function renderYoutubeView(cardBg, panelBg, border, textMain, textMuted) {
    return `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 20px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="youtube" style="color: #ef4444; width: 18px; height: 18px;"></i>
                    Top FPL Analyst Channel Insights
                </h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                    ${EXPERT_CHANNELS.map(ch => `
                        <div style="background: ${panelBg}; border: 1px solid ${border}; border-radius: 12px; padding: 16px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <strong style="color: ${textMain}; font-size: 14px;">${ch.name}</strong>
                                <span style="font-size: 10px; background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: 800;">${ch.subscribers}</span>
                            </div>
                            <p style="font-size: 11.5px; color: ${textMuted}; margin: 0 0 10px 0; line-height: 1.4;">${ch.keyTakeaway}</p>
                            <div style="font-size: 11px; font-weight: 700; color: var(--primary);">Captain Pick: ${ch.captainPick}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}
