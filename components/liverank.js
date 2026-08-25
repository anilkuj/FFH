import { PLAYERS } from '../data.js';

export function renderLiveRank(container, state, actions) {
    const currentGw = state.currentGw;

    // 1. Get user starting players
    const starterIds = state.squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
    const starters = starterIds.map(id => PLAYERS.find(p => p.id === id)).filter(p => p !== undefined);

    // Baseline points (sum of expected points for starting 11)
    let baselinePts = starters.reduce((sum, p) => {
        const pred = p.predictions.find(pr => pr.gw == currentGw) || { pts: 0 };
        const mult = (state.captain === p.id) ? 2 : 1;
        return sum + (pred.pts * mult);
    }, 0);

    // Initial baseline rank
    const baseRank = 142500;

    // Keep track of active checked event modifications
    if (!container.dataset.simulatedEvents) {
        container.dataset.simulatedEvents = JSON.stringify({});
    }
    const simulatedEvents = JSON.parse(container.dataset.simulatedEvents);

    // Generate potential events for starting players
    const events = [];
    starters.forEach(p => {
        const lastName = actions.getWebName(p.name);
        const isCaptain = state.captain === p.id;
        const multiplier = isCaptain ? 2 : 1;

        if (p.position === 'GKP' || p.position === 'DEF') {
            events.push({
                id: `${p.id}_cs`,
                label: `${lastName} Clean Sheet`,
                pts: 4 * multiplier,
                desc: `Clean sheet bonus for defensive shutout (+${4 * multiplier} pts)`
            });
            events.push({
                id: `${p.id}_goal`,
                label: `${lastName} Goal Scored`,
                pts: 6 * multiplier,
                desc: `Goal scored by defender (+${6 * multiplier} pts)`
            });
        } else if (p.position === 'MID') {
            events.push({
                id: `${p.id}_goal`,
                label: `${lastName} Goal Scored`,
                pts: 5 * multiplier,
                desc: `Goal scored by midfielder (+${5 * multiplier} pts)`
            });
            events.push({
                id: `${p.id}_assist`,
                label: `${lastName} Assist`,
                pts: 3 * multiplier,
                desc: `Goal assist (+${3 * multiplier} pts)`
            });
        } else if (p.position === 'FWD') {
            events.push({
                id: `${p.id}_goal`,
                label: `${lastName} Goal Scored`,
                pts: 4 * multiplier,
                desc: `Goal scored by forward (+${4 * multiplier} pts)`
            });
            events.push({
                id: `${p.id}_assist`,
                label: `${lastName} Assist`,
                pts: 3 * multiplier,
                desc: `Goal assist (+${3 * multiplier} pts)`
            });
        }

        // Common negative event
        events.push({
            id: `${p.id}_yc`,
            label: `${lastName} Yellow Card`,
            pts: -1 * multiplier,
            desc: `Yellow card booking (-${1 * multiplier} pts)`
        });
    });

    // Calculate added points based on checked options
    let addedPoints = 0;
    Object.keys(simulatedEvents).forEach(evId => {
        if (simulatedEvents[evId]) {
            const ev = events.find(e => e.id === evId);
            if (ev) addedPoints += ev.pts;
        }
    });

    const livePoints = Math.round(baselinePts + addedPoints);
    // Rank decay curve formula
    const liveRank = Math.max(1, Math.round(baseRank * Math.pow(0.96, addedPoints)));
    const rankDiff = baseRank - liveRank;

    container.innerHTML = `
        <div class="liverank-view-container" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="optimizer-intro" style="margin-bottom: 8px;">
                <div class="intro-text-area">
                    <h2>Live Rank Simulator</h2>
                    <p>Simulate live match occurrences (goals, assists, clean sheets) for your active players and calculate live points and rank fluctuations in real-time.</p>
                </div>
            </div>

            <div class="grid-split-2-3" style="align-items: start;">
                
                <!-- Left Column: Status Displays -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Live Points Display -->
                    <div class="optimizer-card" style="padding: 24px; text-align: center; background: linear-gradient(135deg, var(--bg-card), rgba(0, 255, 136, 0.03)); border-color: rgba(0, 255, 136, 0.15);">
                        <span class="pill-label" style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Simulated GW Points</span>
                        <h1 style="font-family: var(--font-heading); font-size: 54px; font-weight: 800; color: var(--primary); margin: 8px 0;">${livePoints}</h1>
                        <p style="font-size: 12px; color: var(--text-muted);">
                            Baseline: ${Math.round(baselinePts)} expected pts | Modifier: ${addedPoints >= 0 ? '+' : ''}${addedPoints} pts
                        </p>
                    </div>

                    <!-- Live Rank Display -->
                    <div class="optimizer-card" style="padding: 24px; text-align: center; background: linear-gradient(135deg, var(--bg-card), rgba(0, 242, 254, 0.03)); border-color: rgba(0, 242, 254, 0.15);">
                        <span class="pill-label" style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Live Projected Rank</span>
                        <h1 style="font-family: var(--font-heading); font-size: 54px; font-weight: 800; color: var(--secondary); margin: 8px 0;">#${liveRank.toLocaleString()}</h1>
                        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: ${rankDiff >= 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 20px; font-size: 12px; color: ${rankDiff >= 0 ? 'var(--primary)' : '#ef4444'}; font-weight: 800;">
                            <i data-lucide="${rankDiff >= 0 ? 'trending-up' : 'trending-down'}" style="width: 14px; height: 14px;"></i>
                            <span>${rankDiff >= 0 ? '+' : ''}${rankDiff.toLocaleString()} ranks</span>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Interactive Checkbox List -->
                <div class="optimizer-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="play" style="color: var(--primary);"></i> Match Event Simulator
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; padding-right: 4px;">
                        ${events.map(ev => {
                            const isChecked = !!simulatedEvents[ev.id];
                            return `
                                <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid var(--border-color); background: ${isChecked ? 'rgba(255, 255, 255, 0.02)' : 'transparent'}; border-radius: 8px; cursor: pointer; transition: all var(--transition-fast);">
                                    <input type="checkbox" class="event-checkbox" data-id="${ev.id}" ${isChecked ? 'checked' : ''} style="margin-top: 4px; cursor: pointer;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; color: var(--text-main);">
                                            <span>${ev.label}</span>
                                            <span style="color: ${ev.pts >= 0 ? 'var(--primary)' : '#ef4444'}; font-family: var(--font-heading); font-weight: 800;">
                                                ${ev.pts >= 0 ? '+' : ''}${ev.pts} pts
                                            </span>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                                            ${ev.desc}
                                        </div>
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>
        </div>
    `;

    lucide.createIcons();

    // Bind event listeners to checkboxes
    container.querySelectorAll('.event-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const evId = cb.getAttribute('data-id');
            simulatedEvents[evId] = cb.checked;
            
            // Save state back to container dataset and re-render
            container.dataset.simulatedEvents = JSON.stringify(simulatedEvents);
            renderLiveRank(container, state, actions);
        });
    });
}
