import { EXPERT_REVEALS, PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

export function renderReveals(container, state, actions) {
    if (state.tier === 'starter') {
        renderLockOverlay(container, actions);
        return;
    }

    container.innerHTML = `
        <div class="reveals-view-container">
            <div style="margin-bottom: 32px;">
                <h2 style="font-family: var(--font-heading); font-weight:800; font-size:24px; margin-bottom:6px;">Expert Team Reveals</h2>
                <p style="color:var(--text-muted); font-size:14px;">Unlock tactical insights, captain selections, and transfer strategies of elite FPL managers with top-10k histories.</p>
            </div>

            <div class="expert-reveals-grid">
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
    
    // Sort into starters and bench based on positions (standard simple 11 starters, 4 bench)
    const starters = [];
    const bench = [];

    const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
    const maxStarters = { GKP: 1, DEF: 5, MID: 5, FWD: 3 };

    // Simply put first GK and outfielders matching formation into starters
    squadPlayers.forEach(player => {
        if (player.position === 'GKP') {
            if (counts.GKP < 1) {
                starters.push(player);
                counts.GKP++;
            } else {
                bench.push(player);
            }
        } else {
            // Check standard FPL layout guidelines for mock visual mapping
            if (starters.length < 10) {
                starters.push(player);
            } else {
                bench.push(player);
            }
        }
    });

    // Make sure we have 11 starters and 4 bench
    while (starters.length < 11 && bench.length > 0) {
        starters.push(bench.shift());
    }

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
                        <div class="player-pitch-name" style="font-size:10px;">${player.name.split(' ')[1] || player.name}</div>
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
                                    <div class="player-pitch-name" style="font-size:10px;">${player.name.split(' ')[1] || player.name}</div>
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
