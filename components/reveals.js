import { EXPERT_REVEALS, PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

// Curated transfer plans from FFScout & PFT
const TRANSFER_PLANS = [
    {
        id: "tp_1",
        expert: "Gianni (PFT Lead Analyst)",
        source: "Premier Fantasy Tools",
        avatar: "crown",
        outId: 426, // Bruno Borges Fernandes (MID, £12.0m)
        inId: 154,  // Cole Palmer (MID, £9.5m)
        confidence: 5,
        horizon: "Long Term Hold (5+ GWs)",
        rationale: "Cole Palmer's underlying statistics and penalty duty make him an essential asset. Swapping Fernandes for Palmer is budget-positive and boosts overall expected points significantly."
    },
    {
        id: "tp_2",
        expert: "Joe (FFScout Editor)",
        source: "Fantasy Football Scout",
        avatar: "shield",
        outId: 13,  // Declan Rice (MID, £7.5m)
        inId: 12,   // Bukayo Saka (MID, £9.5m)
        confidence: 4,
        horizon: "Mid Term Hold (3-4 GWs)",
        rationale: "Saka represents the absolute spearhead of Arsenal's attack. Upgrading Rice to Saka increases your expected goal involvement per 90 (xGI90) from 0.29 to 0.60."
    },
    {
        id: "tp_3",
        expert: "Andy (Scout Pundit)",
        source: "Fantasy Football Scout",
        avatar: "cpu",
        outId: 426, // Bruno Borges Fernandes
        inId: 12,   // Bukayo Saka
        confidence: 4,
        horizon: "Long Term Hold (5+ GWs)",
        rationale: "Frees up £2.5m of budget while maintaining elite captaincy-tier coverage. Saka's fixture FDR is extremely favorable over the next five gameweeks."
    }
];

export function renderReveals(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    // Default to 'lineups' sub-tab if not set
    if (!container.dataset.activeSubTab) {
        container.dataset.activeSubTab = 'lineups';
    }
    const activeSubTab = container.dataset.activeSubTab;

    container.innerHTML = `
        <div class="reveals-view-container" style="display: flex; flex-direction: column; gap: 24px;">
            <div style="margin-bottom: 8px;">
                <h2 style="font-family: var(--font-heading); font-weight:800; font-size:24px; margin-bottom:6px;">Expert Team & Transfer Plan Reveals</h2>
                <p style="color:var(--text-muted); font-size:14px;">Unlock tactical insights, captain selections, and transfer strategies of elite FPL managers and pundits.</p>
            </div>

            <!-- Sub-tab buttons -->
            <div style="display: flex; border-bottom: 1px solid var(--border-color); gap: 24px; padding-bottom: 2px;">
                <button class="sub-tab-btn ${activeSubTab === 'lineups' ? 'active' : ''}" id="tabExpertLineups" style="background: none; border: none; padding: 8px 4px; font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: ${activeSubTab === 'lineups' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeSubTab === 'lineups' ? 'var(--primary)' : 'transparent'}; cursor: pointer; transition: all var(--transition-fast);">
                    Expert Lineups
                </button>
                <button class="sub-tab-btn ${activeSubTab === 'plans' ? 'active' : ''}" id="tabTransferPlans" style="background: none; border: none; padding: 8px 4px; font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: ${activeSubTab === 'plans' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeSubTab === 'plans' ? 'var(--primary)' : 'transparent'}; cursor: pointer; transition: all var(--transition-fast);">
                    FFScout + PFT Transfer Plans
                </button>
            </div>

            <div id="revealsSubTabContent">
                <!-- Rendered Dynamically -->
            </div>
        </div>
    `;

    const subTabContentContainer = container.querySelector('#revealsSubTabContent');
    if (activeSubTab === 'lineups') {
        renderLineupsView(subTabContentContainer, state, actions);
    } else {
        renderTransferPlansView(subTabContentContainer, state, actions);
    }

    // Bind sub-tab switches
    container.querySelector('#tabExpertLineups').addEventListener('click', () => {
        container.dataset.activeSubTab = 'lineups';
        renderReveals(container, state, actions);
    });

    container.querySelector('#tabTransferPlans').addEventListener('click', () => {
        container.dataset.activeSubTab = 'plans';
        renderReveals(container, state, actions);
    });
}

function renderLineupsView(container, state, actions) {
    container.innerHTML = `
        <div class="expert-reveals-grid" style="margin-top: 12px;">
            ${EXPERT_REVEALS.map(expert => {
                let avatarIcon = 'shield';
                if (expert.avatar === 'cpu') avatarIcon = 'cpu';
                if (expert.avatar === 'crown') avatarIcon = 'crown';

                return `
                    <div class="expert-card">
                        <div class="expert-card-header">
                            <div class="expert-avatar">
                                <i data-lucide="${avatarIcon}" class="expert-avatar-icon"></i>
                            </div>
                            <div class="expert-meta">
                                <h4>${expert.name}</h4>
                                <p>Global Rank: ${expert.rank}</p>
                            </div>
                            <span class="expert-rank-badge">${expert.points} pts</span>
                        </div>
                        <div class="expert-body">
                            <div class="expert-points-pill">
                                <span>GW${state.currentGw} Captain:</span>
                                <span>${PLAYERS.find(p => p.id === expert.captain)?.name || 'Unknown'}</span>
                            </div>
                            <div class="expert-points-pill">
                                <span>Active Transfers:</span>
                                <span style="color:var(--secondary);">${expert.transfers}</span>
                            </div>
                            <p class="expert-commentary">"${expert.commentary}"</p>
                            <button class="view-reveal-btn" data-id="${expert.id}">View Full Board Reveal</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    lucide.createIcons();

    // Setup reveal board buttons
    container.querySelectorAll('.view-reveal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const expertId = btn.getAttribute('data-id');
            const expert = EXPERT_REVEALS.find(e => e.id === expertId);
            if (expert) {
                openExpertBoardModal(expert, state, actions);
            }
        });
    });
}

function renderTransferPlansView(container, state, actions) {
    const squadIds = state.squadSlots.map(s => s.playerId).filter(id => id !== null);

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
            ${TRANSFER_PLANS.map(plan => {
                const pOut = PLAYERS.find(p => p.id === plan.outId);
                const pIn = PLAYERS.find(p => p.id === plan.inId);
                if (!pOut || !pIn) return '';

                const userOwnsOut = squadIds.includes(plan.outId);
                const userOwnsIn = squadIds.includes(plan.inId);

                let confidenceStars = '';
                for (let i = 0; i < 5; i++) {
                    confidenceStars += `<i data-lucide="star" style="width: 14px; height: 14px; fill: ${i < plan.confidence ? 'var(--secondary)' : 'none'}; color: var(--secondary);"></i>`;
                }

                let statusBadge = '';
                if (userOwnsIn) {
                    statusBadge = `<span class="pill-value" style="font-size: 10px; padding: 2px 8px; background: rgba(0, 255, 136, 0.1); color: var(--primary); border: 1px solid var(--primary-glow); border-radius: 10px;">ALREADY OWNED</span>`;
                } else if (!userOwnsOut) {
                    statusBadge = `<span class="pill-value" style="font-size: 10px; padding: 2px 8px; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border-radius: 10px;">OUT PLAYER NOT OWNED</span>`;
                }

                return `
                    <div class="optimizer-card" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 12px; position: relative;">
                        <!-- Top details -->
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(0, 242, 254, 0.1); border-radius: 50%;">
                                    <i data-lucide="${plan.avatar}" style="width: 16px; height: 16px; color: var(--secondary);"></i>
                                </div>
                                <div>
                                    <h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: #fff;">${plan.expert}</h4>
                                    <p style="font-size: 11px; color: var(--text-muted);">${plan.source}</p>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="display: flex; gap: 2px; align-items: center;">
                                    ${confidenceStars}
                                </div>
                                <span class="pill-value" style="font-size: 10px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); color: var(--accent-purple); border-radius: 10px; padding: 2px 8px;">
                                    ${plan.horizon}
                                </span>
                            </div>
                        </div>

                        <!-- Mid row: Transfer Action visualization -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                            <!-- Sell Player -->
                            <div style="flex: 1; min-width: 150px; display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 8px;">
                                <div style="color: #ef4444; font-family: var(--font-heading); font-size: 11px; font-weight: 800; text-transform: uppercase;">OUT</div>
                                <div>
                                    <h5 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: #fff;">${pOut.name}</h5>
                                    <p style="font-size: 11px; color: var(--text-muted);">${pOut.team} • ${pOut.position} • £${pOut.price.toFixed(1)}m</p>
                                </div>
                            </div>

                            <!-- Transfer arrow -->
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                                <i data-lucide="arrow-right" style="width: 20px; height: 20px; color: var(--secondary);"></i>
                                ${statusBadge}
                            </div>

                            <!-- Buy Player -->
                            <div style="flex: 1; min-width: 150px; display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(0, 255, 136, 0.03); border: 1px solid rgba(0, 255, 136, 0.1); border-radius: 8px;">
                                <div style="color: var(--primary); font-family: var(--font-heading); font-size: 11px; font-weight: 800; text-transform: uppercase;">IN</div>
                                <div>
                                    <h5 style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: #fff;">${pIn.name}</h5>
                                    <p style="font-size: 11px; color: var(--text-muted);">${pIn.team} • ${pIn.position} • £${pIn.price.toFixed(1)}m</p>
                                </div>
                            </div>
                        </div>

                        <!-- Rationale & Action buttons -->
                        <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
                                <strong>Rationale:</strong> ${plan.rationale}
                            </p>
                            
                            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px;">
                                ${!userOwnsIn && userOwnsOut ? `
                                    <button class="apply-plan-btn pitch-btn" data-id="${plan.id}" style="padding: 6px 16px; font-size: 12px; font-weight: 700; height: 32px; border-radius: 6px; width: auto; margin: 0; background: linear-gradient(135deg, var(--secondary-glow), var(--secondary)); color: var(--bg-dark);">
                                        Apply Transfer Plan
                                    </button>
                                ` : `
                                    <button class="pitch-btn" style="padding: 6px 16px; font-size: 12px; font-weight: 700; height: 32px; border-radius: 6px; width: auto; margin: 0; background: var(--border-color); opacity: 0.5; color: var(--text-muted); cursor: not-allowed;" disabled>
                                        Apply Transfer Plan
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    lucide.createIcons();

    // Bind Apply Transfer click listener
    container.querySelectorAll('.apply-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const planId = btn.getAttribute('data-id');
            const plan = TRANSFER_PLANS.find(p => p.id === planId);
            if (plan) {
                const success = actions.addTransfer(state.currentGw, plan.outId, plan.inId);
                if (success) {
                    // Redirect to the Team Planner view to show the transfer
                    actions.switchTab('planner');
                }
            }
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
                    <h3 class="lock-title">Expert Reveals Locked</h3>
                    <p class="lock-desc">Unlock tactical team reveal logs from former champion managers. Pro members gain access to weekly transfer reveals, team alignments, and chip utilization commentaries.</p>
                    <button class="lock-cta-btn" id="lockUpgradeBtn">Upgrade to Pro</button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();

    container.querySelector('#lockUpgradeBtn').addEventListener('click', () => {
        actions.switchTab('dashboard');
    });
}

// Opens a modal showcasing the expert's squad layout on a mini pitch board
function openExpertBoardModal(expert, state, actions) {
    // Map expert squad IDs to player objects
    const squadPlayers = expert.squad.map(id => PLAYERS.find(p => p.id === id)).filter(p => p !== undefined);
    
    // Group squad players by position to satisfy formation requirements
    const gkps = squadPlayers.filter(p => p.position === 'GKP');
    const defs = squadPlayers.filter(p => p.position === 'DEF');
    const mids = squadPlayers.filter(p => p.position === 'MID');
    const fwds = squadPlayers.filter(p => p.position === 'FWD');

    const starters = [];
    const bench = [];

    // Enforce base formation minimums: 1 GKP, 3 DEF, 3 MID, 1 FWD
    if (gkps.length > 0) starters.push(gkps[0]);
    starters.push(...defs.slice(0, 3));
    starters.push(...mids.slice(0, 3));
    starters.push(...fwds.slice(0, 1));

    // Gather remaining outfield players
    const remainingOutfield = [
        ...defs.slice(3),
        ...mids.slice(3),
        ...fwds.slice(1)
    ];

    // Sort remaining outfield candidates by expected points (XP) desc
    remainingOutfield.sort((a, b) => {
        const ptsA = (a.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
        const ptsB = (b.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
        return ptsB - ptsA;
    });

    // Fill up the remaining 3 starting slots
    starters.push(...remainingOutfield.slice(0, 3));

    // Place all other players on the bench
    squadPlayers.forEach(p => {
        if (!starters.includes(p)) {
            bench.push(p);
        }
    });

    const renderPitchRowExpert = (position) => {
        const rowPlayers = starters.filter(p => p.position === position);
        return rowPlayers.map(player => {
            const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: '#ffffff' };
            const pred = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
            
            let designation = '';
            if (player.id === expert.captain) designation = `<span class="badge-captain">C</span>`;
            if (player.id === expert.vice) designation = `<span class="badge-vice">V</span>`;

            return `
                <div class="player-pitch-card" style="width: 20%;">
                    <div class="shirt-icon-wrapper">
                        ${getShirtSVG(teamObj.color, player.team)}
                        ${designation}
                    </div>
                    <div class="player-card-info" style="padding: 2px;">
                        <div class="player-pitch-name" style="font-size:10px;">${actions.getWebName(player.name)}</div>
                        <div class="player-pitch-points" style="font-size:9px;">${pred.pts.toFixed(1)} pts</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const modalContent = `
        <div class="modal-header-section">
            <div>
                <h3>${expert.name}'s Reveal</h3>
                <p style="font-size:12px; color: var(--text-muted);">Gameweek ${state.currentGw} Roster Selection</p>
            </div>
            <button class="close-modal-btn" id="closeRevealModalBtn"><i data-lucide="x"></i></button>
        </div>
        
        <div style="padding: 20px;">
            <!-- Football Pitch -->
            <div class="football-pitch" style="aspect-ratio: 4/4.5; margin-bottom: 16px;">
                <div class="pitch-half-line"></div>
                <div class="pitch-center-circle"></div>

                <!-- GK Row -->
                <div class="pitch-row">
                    ${renderPitchRowExpert('GKP')}
                </div>
                <!-- DEF Row -->
                <div class="pitch-row">
                    ${renderPitchRowExpert('DEF')}
                </div>
                <!-- MID Row -->
                <div class="pitch-row">
                    ${renderPitchRowExpert('MID')}
                </div>
                <!-- FWD Row -->
                <div class="pitch-row">
                    ${renderPitchRowExpert('FWD')}
                </div>
            </div>

            <!-- Bench row -->
            <div class="bench-container">
                <span class="bench-title" style="font-size:10px;">Expert Bench</span>
                <div class="bench-row">
                    ${bench.map(player => {
                        const teamObj = TEAMS.find(t => t.shortName === player.team) || { color: '#ffffff' };
                        const pred = player.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 };
                        return `
                            <div class="player-pitch-card" style="width: 22%;">
                                <div class="shirt-icon-wrapper">
                                    ${getShirtSVG(teamObj.color, player.team)}
                                </div>
                                <div class="player-card-info" style="padding: 2px;">
                                    <div class="player-pitch-name" style="font-size:10px;">${actions.getWebName(player.name)}</div>
                                    <div class="player-pitch-points" style="font-size:9px;">${pred.pts.toFixed(1)} pts</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    actions.showModal(modalContent, () => {
        lucide.createIcons();
        document.getElementById('closeRevealModalBtn').addEventListener('click', actions.hideModal);
    });
}
