import { PLAYERS, DEFAULT_SQUAD } from './data.js';
import { renderPlanner } from './components/planner.js';
import { renderOptimizer } from './components/optimizer.js';
import { renderStats } from './components/stats.js';
import { renderCompare } from './components/compare.js';
import { renderTicker } from './components/ticker.js';
import { renderDifferentials } from './components/differentials.js';
import { getFormationConstraints } from './components/formation.js';
import { renderCaptain } from './components/captain.js';
import { renderLeague } from './components/league.js';
import { renderLiveRank } from './components/liverank.js';
import { renderReveals } from './components/reveals.js';

// Application State class
class AppState {
    constructor() {
        this.activeTab = 'planner';
        this.currentGw = 1;
        this.selectedEmptySlot = null;
        
        // Hardcoded to ultra to make all features free
        this.tier = 'ultra';
        
        // Load slot-based squad representation
        const savedSquadSlots = localStorage.getItem('fpl_hub_squad_slots');
        if (savedSquadSlots) {
            this.squadSlots = JSON.parse(savedSquadSlots);
        } else {
            // Initialize from old local storage or DEFAULT_SQUAD
            const savedSquad = localStorage.getItem('fpl_hub_squad');
            const squadIds = savedSquad ? JSON.parse(savedSquad) : [...DEFAULT_SQUAD];
            
            const gkps = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP');
            const defs = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF');
            const mids = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID');
            const fwds = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD');
            
            const savedStarters = localStorage.getItem('fpl_hub_starters');
            const startersList = savedStarters ? JSON.parse(savedStarters) : [];
            
            this.squadSlots = [];
            
            const addSlotsForPosition = (position, allIds, totalCount) => {
                let ids = [...allIds];
                while (ids.length < totalCount) ids.push(null);
                ids.forEach((id, index) => {
                    let isStarting = false;
                    if (id !== null) {
                        isStarting = startersList.includes(id);
                    } else {
                        // fallback default starting pattern if startersList is empty or incomplete
                        if (position === 'GKP' && index === 0) isStarting = true;
                        if (position === 'DEF' && index < 3) isStarting = true;
                        if (position === 'MID' && index < 4) isStarting = true;
                        if (position === 'FWD' && index < 3) isStarting = true;
                    }
                    this.squadSlots.push({
                        position,
                        playerId: id,
                        isStarting
                    });
                });
            };
            
            addSlotsForPosition('GKP', gkps, 2);
            addSlotsForPosition('DEF', defs, 5);
            addSlotsForPosition('MID', mids, 5);
            addSlotsForPosition('FWD', fwds, 3);
            
            // Adjust starters to be exactly 11 if startersList is empty
            const activeStarters = this.squadSlots.filter(s => s.isStarting && s.playerId !== null);
            if (activeStarters.length === 0) {
                this.squadSlots.forEach(s => s.isStarting = false);
                const gkp = this.squadSlots.find(s => s.position === 'GKP');
                if (gkp) gkp.isStarting = true;
                this.squadSlots.filter(s => s.position === 'DEF').slice(0, 3).forEach(s => s.isStarting = true);
                this.squadSlots.filter(s => s.position === 'MID').slice(0, 4).forEach(s => s.isStarting = true);
                this.squadSlots.filter(s => s.position === 'FWD').slice(0, 3).forEach(s => s.isStarting = true);
            }
        }

        // Load formation selection
        const savedFormation = localStorage.getItem('fpl_hub_formation');
        this.formation = savedFormation || "4-3-3";

        // Load must include / exclude players
        const savedMustInclude = localStorage.getItem('fpl_hub_must_include');
        this.mustInclude = savedMustInclude ? JSON.parse(savedMustInclude) : [];

        const savedMustExclude = localStorage.getItem('fpl_hub_must_exclude');
        this.mustExclude = savedMustExclude ? JSON.parse(savedMustExclude) : [];


        // Active chips
        this.chips = {
            wildcard: false,
            tripleCaptain: false,
            benchBoost: false
        };

        // Planned transfers: { gwNum: [ { out: id, in: id } ] }
        const savedTransfers = localStorage.getItem('fpl_hub_transfers');
        this.transfers = savedTransfers ? JSON.parse(savedTransfers) : {
            1: [], 2: [], 3: [], 4: [], 5: []
        };
    }

    get squad() {
        return this.squadSlots.map(s => s.playerId).filter(id => id !== null);
    }
    
    get starters() {
        return this.squadSlots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
    }
    
    get bench() {
        return this.squadSlots.filter(s => !s.isStarting && s.playerId !== null).map(s => s.playerId);
    }

    saveState() {
        localStorage.setItem('fpl_hub_tier', this.tier);
        localStorage.setItem('fpl_hub_squad', JSON.stringify(this.squad));
        localStorage.setItem('fpl_hub_starters', JSON.stringify(this.starters));
        localStorage.setItem('fpl_hub_captain', this.captain ? this.captain.toString() : 'null');
        localStorage.setItem('fpl_hub_vice', this.vice ? this.vice.toString() : 'null');
// Persist formation selection
        localStorage.setItem('fpl_hub_formation', this.formation);
        // Existing saveState lines continue

        localStorage.setItem('fpl_hub_squad_slots', JSON.stringify(this.squadSlots));

        // Persist must include / exclude lists
        localStorage.setItem('fpl_hub_must_include', JSON.stringify(this.mustInclude));
        localStorage.setItem('fpl_hub_must_exclude', JSON.stringify(this.mustExclude));
    }

    // Resolves squad, bench, bank, and free transfers specifically for a given gameweek
    getSquadForGw(targetGw) {
        // Clone baseline arrays
        let starters = [...this.starters];
        let bench = [...this.bench];
        let squad = [...this.squad];
        
        // Calculate initial baseline cost of the squad
        const sumCost = squad.reduce((sum, id) => {
            const p = PLAYERS.find(pl => pl.id === id);
            return sum + (p ? p.price : 0);
        }, 0);
        let bank = 100.0 - sumCost;

        // Trace and apply transfers sequentially up to targetGw
        // Keep track of free transfers
        let freeTransfers = 1;

        for (let gw = 1; gw <= targetGw; gw++) {
            // Apply this week's planned transfers
            const weeklyTransfers = this.transfers[gw] || [];
            weeklyTransfers.forEach(tx => {
                const pOut = PLAYERS.find(p => p.id === tx.out);
                const pIn = PLAYERS.find(p => p.id === tx.in);
                
                if (pOut && pIn) {
                    // Update lists
                    squad = squad.map(id => id === tx.out ? tx.in : id);
                    starters = starters.map(id => id === tx.out ? tx.in : id);
                    bench = bench.map(id => id === tx.out ? tx.in : id);

                    // Update budget
                    bank = bank + pOut.price - pIn.price;
                }
            });

            // Adjust free transfers for next week (starts at 1, max 5)
            // Wildcard gives unlimited free transfers for that week
            if (gw < targetGw) {
                const txCount = weeklyTransfers.length;
                if (this.chips.wildcard) {
                    freeTransfers = 5; // Reset to max after wildcard
                } else {
                    freeTransfers = Math.min(5, Math.max(0, freeTransfers - txCount) + 1);
                }
            }
        }

        return { starters, bench, squad, bank, freeTransfers };
    }
}

// Instantiate Global App State
const state = new AppState();

// UI Render Action Controllers
const actions = {
    switchTab(tab) {
        state.activeTab = tab;
        state.selectedEmptySlot = null;
        
        // Update Sidebar Active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-tab') === tab) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Close mobile drawer if open
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');

        // Trigger dynamic view render
        actions.renderActiveView();
    },

    renderActiveView() {
        const container = document.getElementById('viewContainer');
        if (!container) return;

        // Clear contents
        container.innerHTML = '';
        
        // Sync Top bar displays
        actions.syncTopBar();

        // Render matching view
        switch (state.activeTab) {
            case 'planner':
                renderPlanner(container, state, actions);
                break;
            case 'optimizer':
                renderOptimizer(container, state, actions);
                break;
            case 'stats':
                renderStats(container, state, actions);
                break;
            case 'compare':
                renderCompare(container, state, actions);
                break;
            case 'ticker':
                renderTicker(container, state, actions);
                break;
            case 'differentials':
                renderDifferentials(container, state, actions);
                break;
            case 'captain':
                renderCaptain(container, state, actions);
                break;
            case 'league':
                renderLeague(container, state, actions);
                break;
            case 'liverank':
                renderLiveRank(container, state, actions);
                break;
            case 'reveals':
                renderReveals(container, state, actions);
                break;
        }
    },

    syncTopBar() {
        // Sync current GW
        document.getElementById('currentGwDisplay').innerText = `Gameweek ${state.currentGw}`;
        
        // Fetch active squad values
        const squadInfo = state.getSquadForGw(state.currentGw);
        
        // Total squad value
        const totalVal = squadInfo.squad.reduce((sum, id) => {
            const p = PLAYERS.find(pl => pl.id === id);
            return sum + (p ? p.price : 0);
        }, 0);

        document.getElementById('squadValueDisplay').innerText = `£${(totalVal + squadInfo.bank).toFixed(1)}m`;
        document.getElementById('bankValueDisplay').innerText = `£${squadInfo.bank.toFixed(1)}m`;
        document.getElementById('freeTransfersDisplay').innerText = state.currentGw === 1 ? 'Unlimited' : squadInfo.freeTransfers;

        // Sync Sidebar details
        const tierDisplay = document.getElementById('userTierDisplay');
        const upgradeBtn = document.getElementById('sidebarUpgradeBtn');
        const badge = document.querySelector('.logo-badge');

        if (tierDisplay) tierDisplay.innerText = 'Ultimate Edition';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        if (badge) {
            badge.style.display = 'block';
            badge.innerText = 'ULTIMATE';
            badge.style.background = 'linear-gradient(135deg, #ec4899, #fbbf24)';
        }

        // Active Chips Indicator
        const chipsPillVal = document.querySelector('#activeChipsDisplay .pill-value');
        const activeChips = Object.keys(state.chips).filter(k => state.chips[k]);
        if (activeChips.length > 0) {
            chipsPillVal.innerText = activeChips.map(c => c === 'tripleCaptain' ? 'TC' : (c === 'benchBoost' ? 'BB' : 'WC')).join(', ');
            chipsPillVal.style.color = 'var(--primary)';
        } else {
            chipsPillVal.innerText = 'None';
            chipsPillVal.style.color = 'inherit';
        }
    },

    setCaptain(playerId) {
        state.captain = playerId;
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Captain updated successfully!', 'success');
    },

    setVice(playerId) {
        state.vice = playerId;
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Vice-Captain updated successfully!', 'success');
    },

    // Set formation and adjust starters accordingly
    setFormation(formation) {
        state.formation = formation;
        // Recalculate starters based on formation constraints
        const cons = getFormationConstraints(formation);
        // Reset starters
        state.squadSlots.forEach(s => s.isStarting = false);
        // Assign GK starters
        let assigned = 0;
        for (const slot of state.squadSlots) {
            if (slot.position === 'GKP' && assigned < cons.GKP) {
                slot.isStarting = true;
                assigned++;
            }
        }
        // Assign DEF starters
        assigned = 0;
        for (const slot of state.squadSlots) {
            if (slot.position === 'DEF' && assigned < cons.DEF) {
                slot.isStarting = true;
                assigned++;
            }
        }
        // Assign MID starters
        assigned = 0;
        for (const slot of state.squadSlots) {
            if (slot.position === 'MID' && assigned < cons.MID) {
                slot.isStarting = true;
                assigned++;
            }
        }
        // Assign FWD starters
        assigned = 0;
        for (const slot of state.squadSlots) {
            if (slot.position === 'FWD' && assigned < cons.FWD) {
                slot.isStarting = true;
                assigned++;
            }
        }
        state.saveState();
        actions.renderActiveView();
        actions.showToast(`Formation set to ${formation}`, 'success');
    },

    swapPlayers(id1, id2) {
        // Find positions
        const inStarters1 = state.starters.includes(id1);
        const inStarters2 = state.starters.includes(id2);

        if (inStarters1 === inStarters2) {
            // Swap ordering in starters or bench directly by swapping the player IDs in their slots
            const slot1 = state.squadSlots.find(s => s.playerId === id1);
            const slot2 = state.squadSlots.find(s => s.playerId === id2);
            if (slot1 && slot2) {
                const temp = slot1.playerId;
                slot1.playerId = slot2.playerId;
                slot2.playerId = temp;
            }
        } else {
            // Starters vs Bench swap. Check formation validation
            // Create hypothetical starting lineup
            const hypStarters = state.starters.map(id => id === id1 ? id2 : (id === id2 ? id1 : id));
            
            // Validate formation based on selected formation constraints
            if (hypStarters.length === 11) {
                const constraints = getFormationConstraints(state.formation);
                const gkpCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP').length;
                const defCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF').length;
                const midCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID').length;
                const fwdCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD').length;

                if (gkpCount !== constraints.GKP) {
                    actions.showToast(`Starting lineup must contain exactly ${constraints.GKP} Goalkeeper(s).`, 'error');
                    return;
                }
                if (defCount !== constraints.DEF) {
                    actions.showToast(`Starting lineup must contain exactly ${constraints.DEF} Defenders.`, 'error');
                    return;
                }
                if (midCount !== constraints.MID) {
                    actions.showToast(`Starting lineup must contain exactly ${constraints.MID} Midfielders.`, 'error');
                    return;
                }
                if (fwdCount !== constraints.FWD) {
                    actions.showToast(`Starting lineup must contain exactly ${constraints.FWD} Forwards.`, 'error');
                    return;
                }
            }

            // Apply swap by toggling the starting statuses of the two slots
            const slot1 = state.squadSlots.find(s => s.playerId === id1);
            const slot2 = state.squadSlots.find(s => s.playerId === id2);
            if (slot1 && slot2) {
                const temp = slot1.isStarting;
                slot1.isStarting = slot2.isStarting;
                slot2.isStarting = temp;
            }
        }

        state.saveState();
        actions.renderActiveView();
        actions.showToast('Formation adjusted successfully!', 'success');
    },

    removePlayer(playerId) {
        const slot = state.squadSlots.find(s => s.playerId === playerId);
        if (slot) {
            slot.playerId = null;
            
            // Clear captain/vice-captain if they were sold/removed
            if (state.captain === playerId) {
                const anotherStarter = state.squadSlots.find(s => s.isStarting && s.playerId !== null);
                state.captain = anotherStarter ? anotherStarter.playerId : null;
            }
            if (state.vice === playerId) {
                const anotherStarter = state.squadSlots.find(s => s.isStarting && s.playerId !== null && s.playerId !== state.captain);
                state.vice = anotherStarter ? anotherStarter.playerId : null;
            }
            
            state.saveState();
            actions.renderActiveView();
            actions.showToast('Player removed completely.', 'success');
        }
    },

    addPlayer(gw, slotIndex, inId) {
        const squadInfo = state.getSquadForGw(gw);
        const { squad, bank } = squadInfo;

        const pIn = PLAYERS.find(p => p.id === inId);
        if (!pIn) return false;

        // Check budget
        if (pIn.price > bank) {
            actions.showToast(`Insufficient funds! Need £${(pIn.price - bank).toFixed(1)}m more.`, 'error');
            return false;
        }

        // Check max 3 players per team
        const hypSquad = [...squad, inId];
        const teamCounts = {};
        for (const id of hypSquad) {
            const p = PLAYERS.find(pl => pl.id === id);
            if (p) {
                teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
                if (teamCounts[p.team] > 3) {
                    actions.showToast(`Team limit exceeded! You can select a maximum of 3 players from ${p.team}.`, 'error');
                    return false;
                }
            }
        }

        // Assign to the slot
        if (gw === 1) {
            state.squadSlots[slotIndex].playerId = inId;
        } else {
            state.squadSlots[slotIndex].playerId = inId;
        }

        state.saveState();
        actions.renderActiveView();
        actions.showToast(`Added ${pIn.name} to the team!`, 'success');
        return true;
    },

    resetToDefault() {
        state.squadSlots = [];
        const squadIds = [...DEFAULT_SQUAD];
        
        const gkps = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP');
        const defs = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF');
        const mids = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID');
        const fwds = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD');
        
        const addSlotsForPosition = (position, allIds, totalCount) => {
            let ids = [...allIds];
            while (ids.length < totalCount) ids.push(null);
            ids.forEach((id, index) => {
                let isStarting = false;
                if (position === 'GKP' && index === 0) isStarting = true;
                if (position === 'DEF' && index < 3) isStarting = true;
                if (position === 'MID' && index < 4) isStarting = true;
                if (position === 'FWD' && index < 3) isStarting = true;
                
                state.squadSlots.push({
                    position,
                    playerId: id,
                    isStarting
                });
            });
        };
        
        addSlotsForPosition('GKP', gkps, 2);
        addSlotsForPosition('DEF', defs, 5);
        addSlotsForPosition('MID', mids, 5);
        addSlotsForPosition('FWD', fwds, 3);

        state.captain = 302; // Palmer
        state.vice = 401; // Haaland
        state.transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };

        state.saveState();
        actions.renderActiveView();
        actions.showToast('Squad reset to default lineup.', 'success');
    },

    clearSquad() {
        state.squadSlots = [];
        
        const addSlotsForPosition = (position, totalCount) => {
            for (let index = 0; index < totalCount; index++) {
                let isStarting = false;
                if (position === 'GKP' && index === 0) isStarting = true;
                if (position === 'DEF' && index < 3) isStarting = true;
                if (position === 'MID' && index < 4) isStarting = true;
                if (position === 'FWD' && index < 3) isStarting = true;
                
                state.squadSlots.push({
                    position,
                    playerId: null,
                    isStarting
                });
            }
        };
        
        addSlotsForPosition('GKP', 2);
        addSlotsForPosition('DEF', 5);
        addSlotsForPosition('MID', 5);
        addSlotsForPosition('FWD', 3);

        state.captain = null;
        state.vice = null;
        state.transfers = { 1: [], 2: [], 3: [], 4: [], 5: [] };

        state.saveState();
        actions.renderActiveView();
        actions.showToast('Squad cleared completely.', 'success');
    },

    addTransfer(gw, outId, inId) {
        const squadInfo = state.getSquadForGw(gw);
        const { squad, bank } = squadInfo;

        const pOut = PLAYERS.find(p => p.id === outId);
        const pIn = PLAYERS.find(p => p.id === inId);

        if (!pOut || !pIn) return false;

        // Check budget
        if (pIn.price > pOut.price + bank) {
            actions.showToast(`Insufficient funds! Need £${(pIn.price - pOut.price - bank).toFixed(1)}m more.`, 'error');
            return false;
        }

        // Check max 3 players per team
        const hypSquad = squad.map(id => id === outId ? inId : id);
        const teamCounts = {};
        for (const id of hypSquad) {
            const p = PLAYERS.find(pl => pl.id === id);
            if (p) {
                teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
                if (teamCounts[p.team] > 3) {
                    actions.showToast(`Team limit exceeded! You can select a maximum of 3 players from ${p.team}.`, 'error');
                    return false;
                }
            }
        }

        // If validation passes, commit transfer
        if (gw === 1) {
            const slot = state.squadSlots.find(s => s.playerId === outId);
            if (slot) {
                slot.playerId = inId;
            }
        } else {
            // Otherwise, we record it in planned transfers object
            if (!state.transfers[gw]) state.transfers[gw] = [];
            state.transfers[gw].push({ out: outId, in: inId });
        }

        // Swap captain / vice-captain if they were sold
        if (state.captain === outId) state.captain = inId;
        if (state.vice === outId) state.vice = inId;

        state.saveState();
        actions.renderActiveView();
        actions.showToast(`Transferred in ${pIn.name} for ${pOut.name}!`, 'success');
        return true;
    },

    removeTransfer(gw, index) {
        if (state.transfers[gw]) {
            state.transfers[gw].splice(index, 1);
            state.saveState();
            actions.renderActiveView();
            actions.showToast('Planned transfer removed.', 'success');
        }
    },

    toggleChip(chipName) {
        state.chips[chipName] = !state.chips[chipName];
        actions.renderActiveView();
        actions.showToast(`${chipName.toUpperCase()} chip ${state.chips[chipName] ? 'Activated' : 'Deactivated'}`, 'success');
    },

    setTier(tier) {
        state.tier = tier;
        state.saveState();
        actions.renderActiveView();
    },

    showModal(contentHTML, initCallback) {
        const backdrop = document.getElementById('modalContainer');
        const content = document.getElementById('modalContent');

        content.innerHTML = contentHTML;
        backdrop.classList.remove('hidden');
        
        if (initCallback) initCallback();
    },

    hideModal() {
        const backdrop = document.getElementById('modalContainer');
        if (backdrop) backdrop.classList.add('hidden');
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-msg toast-${type}`;
        
        let icon = type === 'success' ? 'check-circle' : 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        lucide.createIcons();

        // Fade out
        setTimeout(() => {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            toast.style.transition = 'all 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};

// Global App Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Attach Sidebar Navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            actions.switchTab(tab);
        });
    });

    // Sidebar Upgrade Button
    document.getElementById('sidebarUpgradeBtn').addEventListener('click', () => {
        actions.showToast('You already have the Ultimate Edition!', 'info');
    });

    // Theme Toggle Handler
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem('fpl_hub_theme', isLight ? 'light' : 'dark');
            actions.renderActiveView();
            lucide.createIcons();
        });
    }

    // Gameweek Planner Controllers
    document.getElementById('prevGwBtn').addEventListener('click', () => {
        if (state.currentGw > 1) {
            state.currentGw--;
            actions.renderActiveView();
        }
    });

    document.getElementById('nextGwBtn').addEventListener('click', () => {
        if (state.currentGw < 5) {
            state.currentGw++;
            actions.renderActiveView();
        }
    });

    // Mobile Hamburger Menu Controls
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');
    const sidebar = document.querySelector('.sidebar');

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => sidebar.classList.add('open'));
    }
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // Render Initial View
    actions.renderActiveView();
});
