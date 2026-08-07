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
import { renderTransferPlanner } from './components/transferplanner.js';

const PROMOTED_TEAMS = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];

window.getPlayerMinutesFactor = function(player) {
    if (!player) return 1.0;
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return 0;
    
    const chance = (player.chanceOfPlaying !== undefined && player.chanceOfPlaying !== null) 
        ? (player.chanceOfPlaying / 100) 
        : 1.0;

    // Do NOT penalize newly promoted teams or new transfers without established PL start history!
    const isPromotedOrNew = (player.team && PROMOTED_TEAMS.includes(player.team)) || 
                            player.transferredThisSeason || 
                            (typeof player.points === 'number' && player.points < 15 && (player.minutes === 0 || player.MPPG === 0));

    // Also do NOT heavily penalize premium or highly-owned key players (they are established starters/key players)
    // BUT do not let them bypass if their historical stats indicate they are highly rotated (low minutes/starts)
    // EXCEPT if they have high ownership (>= 10.0%) indicating the community expects them to start regularly.
    const isPremiumOrKey = (((player.position === 'GKP' && player.price >= 5.0) ||
                             (player.position === 'DEF' && player.price >= 5.0) ||
                             (player.position === 'MID' && player.price >= 7.0) ||
                             (player.position === 'FWD' && player.price >= 7.5)) &&
                            (player.MPPG === undefined || player.MPPG >= 65.0) &&
                            (player.GS === undefined || player.GS >= 15)) ||
                           (player.ownership && player.ownership >= 10.0);

    const isBypassPenalty = isPromotedOrNew || isPremiumOrKey;

    let matchMinutesRatio = 1.0;
    if (typeof player.MPPG === 'number' && player.MPPG > 0) {
        // If they average 85+ minutes per game, treat them as a full 90-minute player (no discount)
        matchMinutesRatio = player.MPPG >= 85.0 ? 1.0 : Math.min(1.0, Math.max(isBypassPenalty ? 0.85 : 0.15, player.MPPG / 90));
    } else if (!isBypassPenalty) {
        // Only apply the 0.15 floor for established PL players with 0 recorded minutes
        // (e.g. true bench warmers). Promoted/new/premium players get full 90-min assumption.
        matchMinutesRatio = 0.15;
    }
    // isBypassPenalty with MPPG=0 → matchMinutesRatio stays 1.0 (full starter assumption)

    let startRatio = 1.0;
    // Only apply starting frequency (GS) penalty to established PL squad rotation players
    if (!isBypassPenalty && typeof player.GS === 'number' && player.GS > 0) {
        startRatio = Math.min(1.0, Math.max(0.20, player.GS / 28));
    }

    const combined = chance * startRatio * matchMinutesRatio;
    return Math.min(1.0, Math.max(0.15, combined));
};



// Universal dataset-wide minutes & rotation risk discounting for all 700+ players
window.applyUniversalMinutesDiscount = function() {
    if (typeof PLAYERS === 'undefined' || !Array.isArray(PLAYERS)) return;
    PLAYERS.forEach(player => {
        const factor = window.getPlayerMinutesFactor(player);
        if (player.predictions && Array.isArray(player.predictions)) {
            player.predictions.forEach(pr => {
                if (pr._rawPts === undefined) {
                    pr._rawPts = pr.pts;
                }
                pr.pts = Math.round(pr._rawPts * factor * 10) / 10;
            });
        }
        if (player.predictions && player.predictions.length >= 10) {
            const sum10 = player.predictions.slice(0, 10).reduce((acc, p) => acc + p.pts, 0);
            player.xp10 = Math.round(sum10 * 10) / 10;
        }
    });
};

// Run universal minutes discounting across all 700+ players immediately on startup
window.applyUniversalMinutesDiscount();

// Dynamic Injury/Suspension Boost: If Saliba (id 6) is injured/out, Mosquera (id 11) starts and gets Calafiori (id 8) XP
const saliba = PLAYERS.find(p => p.id === 6);
const mosquera = PLAYERS.find(p => p.id === 11);
const calafiori = PLAYERS.find(p => p.id === 8);
if (mosquera && saliba && calafiori && (saliba.chanceOfPlaying === 0 || saliba.status === 'i' || saliba.status === 's')) {
    mosquera.predictions.forEach(pred => {
        const calaPred = calafiori.predictions.find(cp => cp.gw === pred.gw);
        if (calaPred) {
            pred._rawPts = calaPred._rawPts !== undefined ? calaPred._rawPts : calaPred.pts;
            pred.pts = calaPred.pts;
        }
    });
    const sum10 = mosquera.predictions.slice(0, 10).reduce((acc, p) => acc + p.pts, 0);
    mosquera.xp10 = Math.round(sum10 * 10) / 10;
}

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

        const savedBenchBudget = localStorage.getItem('fpl_hub_bench_budget');
        this.benchBudget = savedBenchBudget ? parseFloat(savedBenchBudget) : 17.0;

        const savedGuaranteedStart = localStorage.getItem('fpl_hub_guaranteed_start');
        this.guaranteedStart = savedGuaranteedStart ? parseInt(savedGuaranteedStart) : 60;

        const savedMinFwdPrice = localStorage.getItem('fpl_hub_min_fwd_price');
        this.minFwdPrice = savedMinFwdPrice ? parseFloat(savedMinFwdPrice) : 6.0;

        const savedPlanBenchBoost = localStorage.getItem('fpl_hub_plan_bench_boost');
        this.planBenchBoost = savedPlanBenchBoost ? (savedPlanBenchBoost === 'true') : false;

        const savedBenchBoostTargetGw = localStorage.getItem('fpl_hub_bench_boost_target_gw');
        this.benchBoostTargetGw = savedBenchBoostTargetGw ? parseInt(savedBenchBoostTargetGw) : 1;

        this.optimizerObjective = localStorage.getItem('fpl_hub_optimizer_objective') || 'xp';


        const savedProfile = localStorage.getItem('fpl_hub_user_profile');
        this.userProfile = savedProfile ? JSON.parse(savedProfile) : null;

        const savedLastLocalUpdate = localStorage.getItem('fpl_hub_last_local_update');
        this.lastLocalUpdate = savedLastLocalUpdate ? parseInt(savedLastLocalUpdate) : 0;

        this.loadUserDrafts();
        this.loadCloudDrafts();
        this.checkUrlSync();

        // Real-time automatic background sync listeners for multi-device sync (Mobile <-> Laptop)
        if (typeof window !== 'undefined') {
            const triggerAutoSync = () => {
                if (this.userProfile && this.userProfile.sub) {
                    this.loadCloudDrafts();
                }
            };

            window.addEventListener('focus', triggerAutoSync);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    triggerAutoSync();
                }
            });

            // Polling interval every 15s to check for mobile updates in background
            setInterval(triggerAutoSync, 15000);
        }







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

        this.isSquadUnlocked = false; // By default the squad is locked to prevent accidental removals
        this.squadRisks = {};
        this.alignSlotPositions();
    }

    alignSlotPositions() {
        const alignSlots = (slots) => {
            if (!slots) return null;
            let modified = false;
            slots.forEach(slot => {
                if (slot.playerId !== null) {
                    const p = PLAYERS.find(pl => pl.id === slot.playerId);
                    if (p && slot.position !== p.position) {
                        slot.position = p.position;
                        modified = true;
                    }
                }
            });
            if (modified) {
                const allPlayers = slots.map(s => s.playerId).filter(id => id !== null);
                const starters = slots.filter(s => s.isStarting && s.playerId !== null).map(s => s.playerId);
                
                const newSlots = [];
                const addSlotsForPosition = (pos, total) => {
                    const posPlayers = allPlayers.filter(id => PLAYERS.find(p => p.id === id)?.position === pos);
                    for (let i = 0; i < total; i++) {
                        const id = posPlayers[i] || null;
                        const isStarting = id !== null ? starters.includes(id) : false;
                        newSlots.push({
                            position: pos,
                            playerId: id,
                            isStarting
                        });
                    }
                };
                addSlotsForPosition('GKP', 2);
                addSlotsForPosition('DEF', 5);
                addSlotsForPosition('MID', 5);
                addSlotsForPosition('FWD', 3);
                
                // fallback to ensure starting marking is populated if starters list was cleared
                const currentStarters = newSlots.filter(s => s.isStarting && s.playerId !== null).length;
                if (currentStarters === 0) {
                    const gkp = newSlots.find(s => s.position === 'GKP' && s.playerId !== null);
                    if (gkp) gkp.isStarting = true;
                    newSlots.filter(s => s.position === 'DEF' && s.playerId !== null).slice(0, 3).forEach(s => s.isStarting = true);
                    newSlots.filter(s => s.position === 'MID' && s.playerId !== null).slice(0, 4).forEach(s => s.isStarting = true);
                    newSlots.filter(s => s.position === 'FWD' && s.playerId !== null).slice(0, 2).forEach(s => s.isStarting = true);
                }
                return newSlots;
            }
            return slots;
        };

        if (this.squadSlots) {
            const aligned = alignSlots(this.squadSlots);
            if (aligned !== this.squadSlots) {
                this.squadSlots = aligned;
            }
        }
        if (this.drafts) {
            this.drafts.forEach(draft => {
                if (draft.squadSlots) {
                    const aligned = alignSlots(draft.squadSlots);
                    if (aligned !== draft.squadSlots) {
                        draft.squadSlots = aligned;
                    }
                }
            });
        }
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
        // Sync active draft slot with current active variables
        if (this.drafts && this.drafts[this.activeDraftIndex]) {
            this.drafts[this.activeDraftIndex].squadSlots = JSON.parse(JSON.stringify(this.squadSlots));
            this.drafts[this.activeDraftIndex].captain = this.captain;
            this.drafts[this.activeDraftIndex].vice = this.vice;
            this.drafts[this.activeDraftIndex].formation = this.formation;
        }

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
        localStorage.setItem('fpl_hub_bench_budget', this.benchBudget.toString());
        localStorage.setItem('fpl_hub_guaranteed_start', this.guaranteedStart.toString());
        localStorage.setItem('fpl_hub_min_fwd_price', (this.minFwdPrice || 6.0).toString());
        localStorage.setItem('fpl_hub_optimizer_objective', this.optimizerObjective || 'xp');

        // Save drafts state
        localStorage.setItem(this.getDraftsStorageKey(), JSON.stringify(this.drafts));
        localStorage.setItem(this.getActiveDraftIdxStorageKey(), this.activeDraftIndex.toString());

        this.lastLocalUpdate = Date.now();
        localStorage.setItem('fpl_hub_last_local_update', this.lastLocalUpdate.toString());

        // Save automatic rolling snapshot backup
        this.saveBackupSnapshot('User edit');

        // Asynchronously sync to Google Account & PIN Room Storage
        this.syncCloudDrafts();
        this.syncRoomSync();
    }

    saveBackupSnapshot(reason = 'auto') {
        try {
            if (!this.squadSlots || !Array.isArray(this.squadSlots)) return;
            const backup = {
                id: 'snap_' + Date.now(),
                timestamp: Date.now(),
                reason: reason,
                activeDraftIndex: this.activeDraftIndex,
                drafts: JSON.parse(JSON.stringify(this.drafts || [])),
                squadSlots: JSON.parse(JSON.stringify(this.squadSlots)),
                captain: this.captain,
                vice: this.vice,
                formation: this.formation,
                playerCount: this.squadSlots.filter(s => s.playerId !== null).length
            };
            let backups = [];
            try {
                backups = JSON.parse(localStorage.getItem('fpl_hub_backups') || '[]');
            } catch (e) {}

            if (backups.length > 0 && Math.abs(Date.now() - backups[0].timestamp) < 5000) {
                return;
            }

            backups.unshift(backup);
            if (backups.length > 15) backups = backups.slice(0, 15);
            localStorage.setItem('fpl_hub_backups', JSON.stringify(backups));
        } catch (e) {
            console.warn("Backup error:", e);
        }
    }

    getBackups() {
        try {
            return JSON.parse(localStorage.getItem('fpl_hub_backups') || '[]');
        } catch (e) {
            return [];
        }
    }

    restoreBackup(timestampOrId) {
        try {
            const backups = this.getBackups();
            const found = backups.find(b => b.id === timestampOrId || b.timestamp === parseInt(timestampOrId));
            if (!found) return false;

            if (found.drafts && Array.isArray(found.drafts)) {
                this.drafts = JSON.parse(JSON.stringify(found.drafts));
            }
            if (typeof found.activeDraftIndex === 'number') {
                this.activeDraftIndex = found.activeDraftIndex;
            }
            if (found.squadSlots && Array.isArray(found.squadSlots)) {
                this.squadSlots = JSON.parse(JSON.stringify(found.squadSlots));
            }
            this.captain = found.captain;
            this.vice = found.vice;
            this.formation = found.formation || '4-3-3';

            this.saveState();
            if (typeof actions !== 'undefined' && actions.renderActiveView) {
                actions.renderActiveView();
            }
            if (typeof actions !== 'undefined' && actions.showToast) {
                actions.showToast("⏪ Restored squad backup from " + new Date(found.timestamp).toLocaleTimeString() + "!", "success");
            }
            return true;
        } catch (e) {
            console.error("Restore backup error:", e);
            return false;
        }
    }


    getDeviceSyncCode() {
        let code = localStorage.getItem('fpl_hub_device_pin');
        if (!code) {
            code = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('fpl_hub_device_pin', code);
        }
        return code;
    }

    async syncRoomSync() {
        const code = this.getDeviceSyncCode();
        const pairedCode = localStorage.getItem('fpl_hub_paired_pin');
        const targetCodes = [code];
        if (pairedCode && pairedCode !== code) targetCodes.push(pairedCode);

        targetCodes.forEach(c => {
            try {
                fetch('/api/room-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: c,
                        drafts: this.drafts,
                        activeDraftIndex: this.activeDraftIndex,
                        updatedAt: Date.now()
                    })
                }).catch(() => {});
            } catch (e) {}
        });
    }

    async loadRoomSync(targetCode = null, force = false) {
        const code = targetCode || localStorage.getItem('fpl_hub_paired_pin');
        if (!code) return false;

        try {
            const res = await fetch(`/api/room-sync?code=${code}`).catch(() => null);
            if (res && res.ok) {
                const cloudRes = await res.json();
                if (cloudRes && cloudRes.success && cloudRes.data && Array.isArray(cloudRes.data.drafts)) {
                    const data = cloudRes.data;
                    const cloudTime = data.updatedAt || 0;
                    const localTime = this.lastLocalUpdate || 0;

                    if (force || !localTime || cloudTime > (localTime + 500)) {
                        this.saveBackupSnapshot('Pre-sync auto backup');
                        this.drafts = data.drafts;
                        this.activeDraftIndex = typeof data.activeDraftIndex === 'number' ? data.activeDraftIndex : 0;
                        
                        const activeDraft = this.drafts[this.activeDraftIndex];
                        if (activeDraft && activeDraft.squadSlots) {
                            this.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
                            this.captain = activeDraft.captain;
                            this.vice = activeDraft.vice;
                            this.formation = activeDraft.formation;
                        }


                        this.lastLocalUpdate = cloudTime > 0 ? cloudTime : Date.now();
                        localStorage.setItem('fpl_hub_last_local_update', this.lastLocalUpdate.toString());
                        localStorage.setItem('fpl_hub_paired_pin', code);
                        localStorage.setItem(this.getDraftsStorageKey(), JSON.stringify(this.drafts));
                        localStorage.setItem(this.getActiveDraftIdxStorageKey(), this.activeDraftIndex.toString());

                        if (typeof actions !== 'undefined' && actions.renderActiveView) {
                            actions.renderActiveView();
                        }
                        if (typeof actions !== 'undefined' && actions.showToast) {
                            actions.showToast(`⚡ Synced draft squads via Device PIN ${code}!`, "success");
                        }
                        return true;
                    }
                }
            }
        } catch (e) {
            console.warn("Room sync warning:", e);
        }
        return false;
    }

    async syncCloudDrafts() {
        if (!this.userProfile || (!this.userProfile.sub && !this.userProfile.email)) return;
        
        try {
            const now = Date.now();
            const syncData = {
                sub: this.userProfile.sub || '',
                email: this.userProfile.email || '',
                drafts: this.drafts,
                activeDraftIndex: this.activeDraftIndex,
                updatedAt: now
            };
            
            const cloudKey = `fpl_cloud_drafts_${this.userProfile.sub || this.userProfile.email}`;
            localStorage.setItem(cloudKey, JSON.stringify(syncData));

            fetch('/api/sync-drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData)
            }).catch(() => {});
        } catch (e) {
            console.warn("Cloud sync warning:", e);
        }
    }

    async loadCloudDrafts(force = false) {
        // First try room sync if paired
        const pairedCode = localStorage.getItem('fpl_hub_paired_pin');
        if (pairedCode) {
            const roomSynced = await this.loadRoomSync(pairedCode, force);
            if (roomSynced) return true;
        }

        if (!this.userProfile || (!this.userProfile.sub && !this.userProfile.email)) return false;

        try {
            const identifier = this.userProfile.sub || (this.userProfile.email ? this.userProfile.email.toLowerCase().trim() : null);
            const cloudKey = `fpl_cloud_drafts_${identifier}`;
            let cloudData = null;

            // 1. Fetch from server endpoint (by sub or email)
            const query = this.userProfile.sub ? `sub=${this.userProfile.sub}` : `email=${encodeURIComponent(this.userProfile.email)}`;
            const res = await fetch(`/api/sync-drafts?${query}`).catch(() => null);
            if (res && res.ok) {
                const cloudRes = await res.json();
                if (cloudRes && cloudRes.success && cloudRes.data && Array.isArray(cloudRes.data.drafts)) {
                    cloudData = cloudRes.data;
                }
            }

            // 2. Fallback to local account cache if offline
            if (!cloudData) {
                const cached = localStorage.getItem(cloudKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed && Array.isArray(parsed.drafts)) cloudData = parsed;
                    } catch (e) {}
                }
            }

            if (!cloudData || !Array.isArray(cloudData.drafts)) return false;

            const cloudTime = cloudData.updatedAt || 0;
            const localTime = this.lastLocalUpdate || 0;

            // Check if cloud has newer updates OR force sync requested
            if (force || !localTime || cloudTime > (localTime + 1000)) {
                const currentStr = JSON.stringify(this.drafts);
                const cloudStr = JSON.stringify(cloudData.drafts);
                
                if (force || currentStr !== cloudStr || this.activeDraftIndex !== cloudData.activeDraftIndex) {
                    this.saveBackupSnapshot('Pre-sync auto backup');
                    this.drafts = cloudData.drafts;
                    this.activeDraftIndex = typeof cloudData.activeDraftIndex === 'number' ? cloudData.activeDraftIndex : 0;

                    
                    const activeDraft = this.drafts[this.activeDraftIndex];
                    if (activeDraft && activeDraft.squadSlots) {
                        this.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
                        this.captain = activeDraft.captain;
                        this.vice = activeDraft.vice;
                        this.formation = activeDraft.formation;
                    }

                    this.lastLocalUpdate = cloudTime > 0 ? cloudTime : Date.now();
                    localStorage.setItem('fpl_hub_last_local_update', this.lastLocalUpdate.toString());
                    
                    localStorage.setItem(this.getDraftsStorageKey(), JSON.stringify(this.drafts));
                    localStorage.setItem(this.getActiveDraftIdxStorageKey(), this.activeDraftIndex.toString());
                    
                    if (typeof actions !== 'undefined' && actions.renderActiveView) {
                        actions.renderActiveView();
                    }
                    if (typeof actions !== 'undefined' && actions.showToast) {
                        actions.showToast("☁️ Synced latest mobile draft squads & picks!", "success");
                    }
                    return true;
                }
            } else if (localTime > (cloudTime + 2000)) {
                this.syncCloudDrafts();
            }
        } catch (e) {
            console.warn("Cloud draft load warning:", e);
        }
        return false;
    }




    checkUrlSync() {

        if (typeof window === 'undefined') return;
        const urlParams = new URLSearchParams(window.location.search);
        const syncDataStr = urlParams.get('sync');
        if (syncDataStr) {
            try {
                const decodedJson = decodeURIComponent(atob(syncDataStr));
                const syncData = JSON.parse(decodedJson);
                if (syncData && Array.isArray(syncData.drafts)) {
                    this.drafts = syncData.drafts;
                    this.activeDraftIndex = typeof syncData.activeDraftIndex === 'number' ? syncData.activeDraftIndex : 0;
                    
                    const activeDraft = this.drafts[this.activeDraftIndex];
                    if (activeDraft && activeDraft.squadSlots) {
                        this.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
                        this.captain = activeDraft.captain;
                        this.vice = activeDraft.vice;
                        this.formation = activeDraft.formation;
                    }
                    
                    this.saveState();
                    
                    // Clean URL query string without page reload
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    setTimeout(() => {
                        if (typeof actions !== 'undefined' && actions.renderActiveView) {
                            actions.renderActiveView();
                        }
                        if (typeof actions !== 'undefined' && actions.showToast) {
                            actions.showToast("☁️ All 10 draft squads & custom names synced successfully!", "success");
                        }
                    }, 300);
                }
            } catch (e) {
                console.error("URL sync error:", e);
            }
        }
    }




    optimizeCaptaincy() {
        const starters = this.starters;
        if (starters.length === 0) return;

        const starterPts = starters.map(id => {
            const p = PLAYERS.find(pl => pl.id === id);
            let pts = 0;
            if (p) {
                const pred = p.predictions.find(pr => pr.gw === this.currentGw);
                if (pred) {
                    const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(p) : 1.0;
                    pts = pred.pts * factor;
                }
            }
            return { id, pts };
        });


        starterPts.sort((a, b) => b.pts - a.pts);

        this.captain = starterPts[0].id;
        if (starterPts.length > 1) {
            this.vice = starterPts[1].id;
        }
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
        let freeTransfers = 0;

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
            } else {
                const txCount = weeklyTransfers.length;
                if (!this.chips.wildcard) {
                    freeTransfers = Math.max(0, freeTransfers - txCount);
                }
            }
        }

        return { starters, bench, squad, bank, freeTransfers };
    }

    autoRotateLineup(gw) {
        if (!this.squadSlots || this.squadSlots.every(s => s.playerId === null)) return;

        // Get the active squad for this gameweek (applying prior transfers)
        const squadInfo = this.getSquadForGw(gw);
        const allPlayerIds = [...squadInfo.starters, ...squadInfo.bench];
        const squadPlayers = allPlayerIds
            .map(id => {
                const p = PLAYERS.find(pl => pl.id === id);
                if (!p) return null;
                const pred = p.predictions.find(pr => pr.gw === gw) || { pts: 0 };
                const factor = window.getPlayerMinutesFactor ? window.getPlayerMinutesFactor(p) : 1.0;
                const raw = pred._rawPts !== undefined ? pred._rawPts : pred.pts;
                const pts = raw * factor;
                return { player: p, pts, id: p.id };
            })
            .filter(Boolean);

        if (squadPlayers.length === 0) return;

        const gkps = squadPlayers.filter(p => p.player.position === 'GKP').sort((a, b) => b.pts - a.pts);
        const defs = squadPlayers.filter(p => p.player.position === 'DEF').sort((a, b) => b.pts - a.pts);
        const mids = squadPlayers.filter(p => p.player.position === 'MID').sort((a, b) => b.pts - a.pts);
        const fwds = squadPlayers.filter(p => p.player.position === 'FWD').sort((a, b) => b.pts - a.pts);

        const validFormations = [
            [3, 4, 3],
            [3, 5, 2],
            [4, 4, 2],
            [4, 5, 1],
            [4, 3, 3],
            [5, 3, 2],
            [5, 4, 1],
            [5, 2, 3]
        ];

        let bestScore = -1;
        let bestStarters = [];
        let bestFormation = '4-4-2';

        for (const [reqDef, reqMid, reqFwd] of validFormations) {
            const chosenGkp = gkps.slice(0, 1);
            const chosenDef = defs.slice(0, reqDef);
            const chosenMid = mids.slice(0, reqMid);
            const chosenFwd = fwds.slice(0, reqFwd);

            const currentStarters = [...chosenGkp, ...chosenDef, ...chosenMid, ...chosenFwd];
            if (currentStarters.length !== 11) continue;

            let score = currentStarters.reduce((sum, p) => sum + p.pts, 0);
            const maxPts = Math.max(...currentStarters.map(p => p.pts), 0);
            score += maxPts;

            if (score > bestScore) {
                bestScore = score;
                bestStarters = currentStarters.map(p => p.id);
                bestFormation = `${reqDef}-${reqMid}-${reqFwd}`;
            }
        }

        if (bestStarters.length === 11) {
            // Apply new starting configuration
            this.squadSlots.forEach(slot => {
                if (slot.playerId !== null) {
                    slot.isStarting = bestStarters.includes(slot.playerId);
                }
            });

            this.formation = bestFormation;
            this.optimizeCaptaincy();
            this.saveState();
        }
    }

    getDraftsStorageKey() {
        if (this.userProfile && this.userProfile.sub) {
            return `fpl_hub_drafts_${this.userProfile.sub}`;
        }
        return 'fpl_hub_drafts';
    }

    getActiveDraftIdxStorageKey() {
        if (this.userProfile && this.userProfile.sub) {
            return `fpl_hub_active_draft_idx_${this.userProfile.sub}`;
        }
        return 'fpl_hub_active_draft_idx';
    }

    loadUserDrafts() {
        const draftsKey = this.getDraftsStorageKey();
        const activeIdxKey = this.getActiveDraftIdxStorageKey();

        let savedDrafts = localStorage.getItem(draftsKey);

        // Auto-migrate Guest drafts to Google Account if Google Account drafts key is empty
        if (!savedDrafts && this.userProfile && this.userProfile.sub) {
            const guestDrafts = localStorage.getItem('fpl_hub_drafts');
            if (guestDrafts) {
                savedDrafts = guestDrafts;
                localStorage.setItem(draftsKey, guestDrafts);
            }
        }

        this.drafts = savedDrafts ? JSON.parse(savedDrafts) : Array.from({ length: 10 }, (_, i) => ({
            name: `Draft ${i + 1}`,
            squadSlots: null,
            captain: null,
            vice: null,
            formation: '4-4-2'
        }));

        const savedActiveDraftIdx = localStorage.getItem(activeIdxKey);
        this.activeDraftIndex = savedActiveDraftIdx ? parseInt(savedActiveDraftIdx) : 0;

        // Apply active draft to squad slots if it exists
        const activeDraft = this.drafts[this.activeDraftIndex];
        if (activeDraft && activeDraft.squadSlots) {
            this.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
            this.captain = activeDraft.captain;
            this.vice = activeDraft.vice;
            this.formation = activeDraft.formation;
        } else if (this.squadSlots) {
            // Auto-preserve in-memory squad into active draft
            this.drafts[this.activeDraftIndex].squadSlots = JSON.parse(JSON.stringify(this.squadSlots));
            this.drafts[this.activeDraftIndex].captain = this.captain;
            this.drafts[this.activeDraftIndex].vice = this.vice;
            this.drafts[this.activeDraftIndex].formation = this.formation;
            this.saveState();
        }
    }


    createDefaultSquadSlots() {
        const gkps = DEFAULT_SQUAD.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP');
        const defs = DEFAULT_SQUAD.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF');
        const mids = DEFAULT_SQUAD.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID');
        const fwds = DEFAULT_SQUAD.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD');
        
        const slots = [];
        const addSlotsForPosition = (position, allIds, totalCount) => {
            let ids = [...allIds];
            while (ids.length < totalCount) ids.push(null);
            ids.forEach((id, index) => {
                let isStarting = false;
                if (position === 'GKP' && index === 0) isStarting = true;
                if (position === 'DEF' && index < 3) isStarting = true;
                if (position === 'MID' && index < 4) isStarting = true;
                if (position === 'FWD' && index < 3) isStarting = true;
                slots.push({
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
        return slots;
    }

    logoutAndClearData() {
        // 1. Wipe user profile
        this.userProfile = null;
        localStorage.removeItem('fpl_hub_user_profile');

        // 2. Remove all active squad/settings keys from localStorage so they don't leak to guest
        const keysToRemove = [
            'fpl_hub_squad_slots',
            'fpl_hub_squad',
            'fpl_hub_starters',
            'fpl_hub_captain',
            'fpl_hub_vice',
            'fpl_hub_formation',
            'fpl_hub_transfers',
            'fpl_hub_must_include',
            'fpl_hub_must_exclude',
            'fpl_hub_bench_budget',
            'fpl_hub_guaranteed_start',
            'fpl_hub_min_fwd_price',
            'fpl_hub_drafts',
            'fpl_hub_active_draft_idx',
            'fpl_hub_optimizer_objective'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // 3. Reset in-memory active variables to fresh defaults
        this.captain = null;
        this.vice = null;
        this.formation = '4-3-3';
        this.mustInclude = [];
        this.mustExclude = [];
        this.benchBudget = 17.0;
        this.guaranteedStart = 60;
        this.minFwdPrice = 6.0;
        this.optimizerObjective = 'xp';
        this.chips = {
            wildcard: false,
            tripleCaptain: false,
            benchBoost: false
        };
        this.transfers = {
            1: [], 2: [], 3: [], 4: [], 5: []
        };

        // Create a clean default squad
        this.squadSlots = this.createDefaultSquadSlots();

        // 4. Load/initialize guest drafts (which will be clean since we deleted 'fpl_hub_drafts')
        this.loadUserDrafts();

        // 5. Save the clean guest state
        this.saveState();
    }
}

// Instantiate Global App State
const state = new AppState();

// UI Render Action Controllers
const actions = {
    getWebName(name) {
        if (!name) return '';
        
        const webNameOverrides = {
            "Igor Thiago Nascimento Rodrigues": "Thiago",
            "David Raya Martín": "Raya",
            "Gabriel dos Santos Magalhães": "Gabriel",
            "Emile Smith Rowe": "Smith Rowe",
            "Virgil van Dijk": "van Dijk",
            "Kevin De Bruyne": "De Bruyne",
            "Bruno Guimarães Rodriguez Moura": "Bruno G.",
            "Bruno Guimarães": "Bruno G.",
            "Diogo Teixeira da Silva": "Diogo J.",
            "Diogo Jota": "Diogo J.",
            "Matheus Santos Carneiro da Cunha": "Cunha",
            "Matheus Cunha": "Cunha",
            "Pedro Lomba Neto": "Pedro Neto",
            "Pedro Neto": "Pedro Neto",
            "Rodrigo Muniz Carvalho": "Rodrigo Muniz",
            "Alex Moreno Lopera": "Alex Moreno",
            "Alex Moreno": "Alex Moreno",
            "Hwang Hee-chan": "Hwang",
            "Son Heung-min": "Son",
            "Andreas Hoelgebaum Pereira": "Andreas",
            "Andreas Pereira": "Andreas",
            "Alejandro Garnacho Ferreyra": "Garnacho",
            "Darwin Núñez Ribeiro": "Darwin",
            "Gabriel Fernando de Jesus": "Jesus",
            "Gabriel Jesus": "Jesus",
            "Gabriel Martinelli Silva": "Martinelli",
            "Gabriel Martinelli": "Martinelli",
            "Enzo Fernández": "Enzo",
            "Moisés Caicedo Corozo": "Caicedo",
            "Robert Sánchez": "Sánchez",
            "Ederson Santana de Moraes": "Ederson",
            "Bernardo Veiga de Carvalho e Silva": "Bernardo",
            "Bernardo Silva": "Bernardo",
            "Alexis Mac Allister": "Mac Allister",
            "Luis Díaz": "Luis Díaz",
            "Dominic Calvert-Lewin": "Calvert-Lewin",
            "Trent Alexander-Arnold": "Alexander-Arnold",
            "Dejan Kulusevski": "Kulusevski",
            "Josko Gvardiol": "Gvardiol",
            "Joško Gvardiol": "Gvardiol"
        };

        if (webNameOverrides[name]) {
            return webNameOverrides[name];
        }

        // Handle "van " names dynamically (e.g. Micky van de Ven, Jan Paul van Hecke)
        const vanIdx = name.toLowerCase().indexOf(' van ');
        if (vanIdx !== -1) {
            return name.substring(vanIdx + 1);
        }

        // Handle "de " names dynamically (e.g. Matthijs de Ligt, Bobby De Cordova-Reid)
        const deIdx = name.toLowerCase().indexOf(' de ');
        if (deIdx !== -1) {
            return name.substring(deIdx + 1);
        }

        // Default to last word
        return name.split(' ').pop() || name;
    },

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
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');

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
            case 'transferplanner':
                renderTransferPlanner(container, state, actions);
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

        const formattedSquadValue = `£${(totalVal + squadInfo.bank).toFixed(1)}m`;
        const formattedBankValue = `£${squadInfo.bank.toFixed(1)}m`;
        const formattedTransfers = (state.currentGw === 1 || state.chips.wildcard) ? 'Unlimited' : squadInfo.freeTransfers;

        document.getElementById('squadValueDisplay').innerText = formattedSquadValue;
        document.getElementById('bankValueDisplay').innerText = formattedBankValue;
        document.getElementById('freeTransfersDisplay').innerText = formattedTransfers;

        // Dynamic Available Transfers button configuration next to Gameweek
        const avTransBtn = document.getElementById('availableTransfersBtn');
        if (avTransBtn) {
            const hasTransfersAvailable = (formattedTransfers === 'Unlimited' || parseInt(formattedTransfers) > 0);
            if (state.activeTab === 'planner' && hasTransfersAvailable) {
                avTransBtn.style.display = 'flex';
                avTransBtn.querySelector('span').innerText = `Plan Transfers (${formattedTransfers === 'Unlimited' ? 'Unlimited' : `${formattedTransfers} FT`})`;
            } else {
                avTransBtn.style.display = 'none';
            }
        }

        // Sync mobile stats bar
        const mobVal = document.getElementById('mobileSquadValueDisplay');
        const mobBank = document.getElementById('mobileBankValueDisplay');
        const mobTrans = document.getElementById('mobileFreeTransfersDisplay');
        if (mobVal) mobVal.innerText = formattedSquadValue;
        if (mobBank) mobBank.innerText = formattedBankValue;
        if (mobTrans) mobTrans.innerText = formattedTransfers;

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

        // Active Chips Indicator (Desktop & Mobile)
        const chipsPillVal = document.querySelector('#activeChipsDisplay .pill-value');
        const mobChipsPillVal = document.querySelector('#mobileActiveChipsDisplay .pill-value');
        const activeChips = Object.keys(state.chips).filter(k => state.chips[k]);
        const formattedChips = activeChips.length > 0 ? activeChips.map(c => c === 'tripleCaptain' ? 'TC' : (c === 'benchBoost' ? 'BB' : 'WC')).join(', ') : 'None';

        if (chipsPillVal) {
            chipsPillVal.innerText = formattedChips;
            if (activeChips.length > 0) {
                chipsPillVal.style.color = 'var(--primary)';
            } else {
                chipsPillVal.style.color = 'inherit';
            }
        }

        if (mobChipsPillVal) {
            mobChipsPillVal.innerText = formattedChips;
            if (activeChips.length > 0) {
                mobChipsPillVal.style.color = 'var(--primary)';
            } else {
                mobChipsPillVal.style.color = 'inherit';
            }
        }
    },

    syncUserProfile() {
        const guestView = document.getElementById('authGuestView');
        const loggedInView = document.getElementById('authLoggedInView');
        const userAvatar = document.getElementById('userAvatar');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const topBarContainer = document.getElementById('topBarAuthContainer');

        if (state.userProfile) {
            // Update Sidebar Auth
            if (guestView) guestView.classList.add('hidden');
            if (loggedInView) loggedInView.classList.remove('hidden');
            if (userAvatar) userAvatar.src = state.userProfile.picture;
            if (userNameDisplay) userNameDisplay.textContent = state.userProfile.name;

            // Update Top Bar Auth (show user avatar icon + Sync button)
            if (topBarContainer) {
                topBarContainer.innerHTML = `
                    <button class="pitch-btn" id="topBarSyncBtn" title="Sync Draft Squads Between Mobile & Laptop" style="height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; cursor: pointer; font-size: 11.5px; font-weight: 700;">
                        <i data-lucide="cloud" style="width: 14px; height: 14px;"></i>
                        <span>Sync ☁️</span>
                    </button>
                    <img id="topBarAvatar" src="${state.userProfile.picture}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 1px solid var(--primary-glow); object-fit: cover;" title="View Profile">
                `;
                
                // Wire click on avatar to open profile modal
                const avatar = topBarContainer.querySelector('#topBarAvatar');
                if (avatar) {
                    avatar.addEventListener('click', actions.showUserProfileModal);
                }
                const syncBtn = topBarContainer.querySelector('#topBarSyncBtn');
                if (syncBtn) {
                    syncBtn.addEventListener('click', actions.showSyncModal);
                }
            }
        } else {
            // Update Sidebar Auth
            if (guestView) guestView.classList.remove('hidden');
            if (loggedInView) loggedInView.classList.add('hidden');
            
            // Update Top Bar Auth (show Sign In button + Sync button)
            if (topBarContainer) {
                topBarContainer.innerHTML = `
                    <button class="pitch-btn" id="topBarSyncBtn" title="Sync Draft Squads Between Mobile & Laptop" style="height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; cursor: pointer; font-size: 11.5px; font-weight: 700;">
                        <i data-lucide="cloud" style="width: 14px; height: 14px;"></i>
                        <span>Sync ☁️</span>
                    </button>
                    <button class="apply-rec-btn" id="topBarSignInBtn" style="margin: 0; padding: 6px 12px; font-size: 11px; font-weight: 700; width: auto; height: 32px; border-radius: 6px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="log-in" style="width: 12px; height: 12px;"></i> Sign In
                    </button>
                `;
                
                // Wire click on sign in to open login modal
                const signInBtn = topBarContainer.querySelector('#topBarSignInBtn');
                if (signInBtn) {
                    signInBtn.addEventListener('click', actions.showLoginModal);
                }
                const syncBtn = topBarContainer.querySelector('#topBarSyncBtn');
                if (syncBtn) {
                    syncBtn.addEventListener('click', actions.showSyncModal);
                }
            }

            // Re-render Google Sign-In Button if guest view is visible in sidebar
            actions.initGoogleSignInButton();
        }
        lucide.createIcons();
    },


    initGoogleSignInButton() {
        if (typeof google === 'undefined') {
            // If GSI script isn't loaded yet, wait and try again
            setTimeout(() => actions.initGoogleSignInButton(), 500);
            return;
        }

        const btnContainer = document.getElementById('googleSignInButton');
        const modalBtnContainer = document.getElementById('modalGoogleSignInButton');
        if (!btnContainer && !modalBtnContainer) return;

        // Use custom client ID if saved, otherwise fallback to placeholder
        const customClientId = localStorage.getItem('fpl_hub_google_client_id') || '119489651282-bfu1jpk2gkeqqvsj5majkgle5ochl1it.apps.googleusercontent.com';

        try {
            google.accounts.id.initialize({
                client_id: customClientId,
                callback: actions.handleGoogleSignInResponse
            });

            if (btnContainer) {
                btnContainer.innerHTML = ''; // Force clear previous iframe to redraw
                google.accounts.id.renderButton(btnContainer, {
                    type: 'standard',
                    theme: 'filled_black',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                    width: 230
                });
            }

            if (modalBtnContainer) {
                modalBtnContainer.innerHTML = ''; // Force clear previous iframe to redraw
                google.accounts.id.renderButton(modalBtnContainer, {
                    type: 'standard',
                    theme: 'filled_black',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                    width: 250
                });
            }

            // Prompt One Tap
            google.accounts.id.prompt();
        } catch (e) {
            console.warn("Failed to initialize Google Sign-In:", e);
        }
    },

    handleGoogleSignInResponse(response) {
        if (!response.credential) return;

        // Decode the JWT token on client-side
        const payload = actions.decodeJwt(response.credential);
        if (payload) {
            state.userProfile = {
                name: payload.name,
                email: payload.email,
                picture: payload.picture,
                sub: payload.sub
            };
            localStorage.setItem('fpl_hub_user_profile', JSON.stringify(state.userProfile));
            
            // Reload user drafts and sync from Cloud
            state.loadUserDrafts();
            state.loadCloudDrafts();
            
            actions.syncUserProfile();
            actions.renderActiveView(); // Refresh the planner view immediately
            actions.showToast(`Welcome back, ${payload.name.split(' ')[0]}!`, 'success');
            actions.hideModal(); // Close modal if open
        }
    },

    showSyncModal() {

        state.saveState();

        const syncPayload = {
            drafts: state.drafts,
            activeDraftIndex: state.activeDraftIndex,
            user: state.userProfile ? state.userProfile.name : 'Guest'
        };

        const jsonStr = JSON.stringify(syncPayload);
        const encodedData = btoa(encodeURIComponent(jsonStr));
        const syncUrl = `${window.location.origin}${window.location.pathname}?sync=${encodedData}`;

        const modalHtml = `
            <div style="padding: 10px; max-width: 480px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); display: flex; align-items: center; justify-content: center; color: #38bdf8;">
                        <i data-lucide="cloud" style="width: 22px; height: 22px;"></i>
                    </div>
                    <div style="text-align: left;">
                        <h3 style="margin: 0; font-size: 17px; font-weight: 800;">Sync Drafts Across Devices</h3>
                        <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-muted);">Sync all 10 draft squads, captain picks, and draft names instantly!</p>
                                  <!-- Section 0: Instant 6-Digit Device Pairing PIN -->
                <div style="background: rgba(0, 255, 136, 0.08); border: 1px solid var(--primary-glow); border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: left;">
                    <label style="display: block; font-size: 13px; font-weight: 800; color: var(--primary); margin-bottom: 6px;">
                        ⚡ Instant 6-Digit Device Pairing PIN
                    </label>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; line-height: 1.4;">
                        This device PIN is <strong style="color: var(--primary); font-size: 15px; font-family: monospace; letter-spacing: 2px;">${state.getDeviceSyncCode()}</strong>. Enter it on your laptop (or enter laptop's PIN below) to sync mobile & laptop in 1 second!
                    </p>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="pairPinInput" placeholder="Enter 6-digit PIN..." maxlength="6" style="flex: 1; font-size: 13px; font-weight: 800; text-align: center; letter-spacing: 2px; padding: 8px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);" />
                        <button id="pairPinBtn" style="padding: 8px 16px; font-size: 12px; font-weight: 800; background: var(--primary); color: #000; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                            Pair & Sync ⚡
                        </button>
                    </div>
                </div>

                <!-- Section 1: Instant Google Account Cloud Refresh -->
                <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: left;">
                    <label style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
                        ☁️ Google Account Auto-Sync
                    </label>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; line-height: 1.4;">
                        ${state.userProfile ? `Signed in as <strong>${state.userProfile.name}</strong> (${state.userProfile.email})` : 'Sign in with Google to automatically sync changes across all your mobile phones, tablets, and laptops.'}
                    </p>
                    <button id="manualCloudSyncBtn" style="width: 100%; padding: 10px; font-size: 12.5px; font-weight: 800; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <i data-lucide="cloud-lightning" style="width: 16px; height: 16px;"></i> Fetch & Sync Google Cloud Edits
                    </button>
                </div>

                <!-- Section 2: 1-Click Mobile Link -->
                <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: left;">
                    <label style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
                        📲 Direct Mobile Sync Link
                    </label>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; line-height: 1.4;">
                        Tap <strong>Copy Link</strong> below and send it to your phone (via WhatsApp, iMessage, AirDrop, or Email).
                    </p>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="syncUrlInput" readonly value="${syncUrl}" style="flex: 1; font-size: 11px; padding: 8px 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); text-overflow: ellipsis;" />
                        <button id="copySyncUrlBtn" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="copy" style="width: 14px; height: 14px;"></i> Copy Link
                        </button>
                    </div>
                </div>

                <!-- Section 3: Manual Code Import -->
                <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; text-align: left;">
                    <label style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
                        📥 Import / Paste Sync Code
                    </label>
                    <textarea id="pasteSyncInput" placeholder="Paste sync link or code here..." style="width: 100%; height: 50px; font-size: 11px; padding: 8px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); box-sizing: border-box; margin-bottom: 10px; resize: none;"></textarea>
                    <button id="applyPasteSyncBtn" style="width: 100%; padding: 10px; font-size: 12px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #16a34a); color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <i data-lucide="download-cloud" style="width: 16px; height: 16px;"></i> Import & Sync Squads Now
                    </button>
                </div>

                <!-- Section 4: ⏪ Restore Overwritten Squad Backups -->
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px; margin-top: 16px; text-align: left;">
                    <label style="display: block; font-size: 12.5px; font-weight: 700; color: #f87171; margin-bottom: 6px;">
                        ⏪ Restore Overwritten Squad Backups
                    </label>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 0; margin-bottom: 10px; line-height: 1.4;">
                        If a sync overwrote your mobile squad, click <strong>Restore ⏪</strong> next to a recent backup timestamp to recover your exact squad instantly:
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto;">
                        ${(() => {
                            const backups = state.getBackups();
                            if (backups.length === 0) return '<p style="font-size: 11px; color: var(--text-muted); margin: 0;">No previous backups recorded yet.</p>';
                            return backups.slice(0, 6).map(b => {
                                const timeStr = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const count = b.playerCount || 0;
                                return `
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border-color); font-size: 11.5px;">
                                        <div>
                                            <span style="font-weight: 700; color: var(--text-main);">${timeStr}</span>
                                            <span style="color: var(--text-muted); margin-left: 6px;">(${count} players, ${b.reason || 'auto'})</span>
                                        </div>
                                        <button class="restore-snap-btn" data-id="${b.id}" style="padding: 4px 10px; font-size: 10.5px; font-weight: 700; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; cursor: pointer;">
                                            Restore ⏪
                                        </button>
                                    </div>
                                `;
                            }).join('');
                        })()}
                    </div>
                </div>
            </div>
        `;


        actions.showCustomModal("Multi-Device Draft Sync", modalHtml);

        setTimeout(() => {
            const pairPinBtn = document.getElementById('pairPinBtn');
            const pairPinInput = document.getElementById('pairPinInput');
            if (pairPinBtn && pairPinInput) {
                pairPinBtn.addEventListener('click', async () => {
                    const pin = pairPinInput.value.trim();
                    if (!pin || pin.length < 6) {
                        actions.showToast("Please enter a valid 6-digit PIN.", "error");
                        return;
                    }
                    pairPinBtn.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> Pairing...`;
                    lucide.createIcons();
                    const success = await state.loadRoomSync(pin, true);
                    if (success) {
                        actions.showToast(`⚡ Paired with Device PIN ${pin}! Sync active.`, "success");
                        actions.hideModal();
                    } else {
                        actions.showToast(`Could not find drafts for PIN ${pin}. Make sure mobile app is open!`, "error");
                        pairPinBtn.innerHTML = `Pair & Sync ⚡`;
                        lucide.createIcons();
                    }
                });
            }

            const cloudSyncBtn = document.getElementById('manualCloudSyncBtn');
            if (cloudSyncBtn) {
                cloudSyncBtn.addEventListener('click', async () => {
                    if (!state.userProfile) {
                        actions.hideModal();
                        actions.showLoginModal();
                        return;
                    }
                    cloudSyncBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:16px; height:16px;"></i> Fetching mobile edits...`;
                    lucide.createIcons();
                    const updated = await state.loadCloudDrafts(true);
                    cloudSyncBtn.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px;"></i> Synced!`;
                    lucide.createIcons();
                    if (!updated) {
                        actions.showToast("☁️ All draft squads are up to date!", "success");
                    }
                    setTimeout(() => actions.hideModal(), 800);
                });
            }

            const copyBtn = document.getElementById('copySyncUrlBtn');

            const urlInput = document.getElementById('syncUrlInput');
            if (copyBtn && urlInput) {
                copyBtn.addEventListener('click', () => {
                    urlInput.select();
                    navigator.clipboard.writeText(urlInput.value).then(() => {
                        actions.showToast("📲 Mobile Sync Link copied! Send it to your phone.", "success");
                    }).catch(() => {
                        actions.showToast("Link copied to clipboard!", "success");
                    });
                });
            }

            const applyBtn = document.getElementById('applyPasteSyncBtn');
            const pasteInput = document.getElementById('pasteSyncInput');
            if (applyBtn && pasteInput) {
                applyBtn.addEventListener('click', () => {
                    let val = pasteInput.value.trim();
                    if (!val) {
                        actions.showToast("Please paste a sync link or code first.", "error");
                        return;
                    }
                    if (val.includes('sync=')) {
                        val = val.split('sync=')[1].split('&')[0];
                    }
                    try {
                        const decodedJson = decodeURIComponent(atob(val));
                        const syncData = JSON.parse(decodedJson);
                        if (syncData && Array.isArray(syncData.drafts)) {
                            state.drafts = syncData.drafts;
                            state.activeDraftIndex = typeof syncData.activeDraftIndex === 'number' ? syncData.activeDraftIndex : 0;
                            
                            const activeDraft = state.drafts[state.activeDraftIndex];
                            if (activeDraft && activeDraft.squadSlots) {
                                state.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
                                state.captain = activeDraft.captain;
                                state.vice = activeDraft.vice;
                                state.formation = activeDraft.formation;
                            }
                            
                            state.saveState();
                            actions.hideModal();
                            actions.renderActiveView();
                            actions.showToast("☁️ All 10 draft squads & names synced successfully!", "success");
                        } else {
                            throw new Error("Invalid format");
                        }
                    } catch (e) {
                        actions.showToast("Invalid sync code or link format.", "error");
                    }
                });
            }

            // Wire Restore Squad Backup buttons
            document.querySelectorAll('.restore-snap-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const success = state.restoreBackup(id);
                    if (success) {
                        actions.hideModal();
                    }
                });
            });
        }, 100);

    },

    decodeJwt(token) {

        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("JWT decoding failed:", e);
            return null;
        }
    },

    showLoginModal() {
        const customClientId = localStorage.getItem('fpl_hub_google_client_id') || '119489651282-bfu1jpk2gkeqqvsj5majkgle5ochl1it.apps.googleusercontent.com';
        const contentHTML = `
            <div class="modal-header-section">
                <h3 style="display: flex; align-items: center; gap: 8px;"><i data-lucide="lock" class="highlight-transfers" style="width: 18px; height: 18px;"></i> Sign In to FPL Hub</h3>
                <button class="close-modal-btn" id="closeLoginModalBtn"><i data-lucide="x"></i></button>
            </div>
            <div class="checkout-modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 16px; text-align: center; align-items: center;">
                <div class="logo" style="font-size: 26px; justify-content: center; margin-bottom: 4px;">
                    <span class="logo-accent">FPL</span><span class="logo-main">HUB</span>
                    <span class="logo-badge" style="display: block !important; background: linear-gradient(135deg, #ec4899, #fbbf24);">ULTIMATE</span>
                </div>
                <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; max-width: 400px;">
                    Log in with your Google account to unlock advanced squad optimization solvers, save constraints, and sync your FPL team predictions in real-time.
                </p>
                
                <!-- Google Sign-In Button inside Modal -->
                <div id="modalGoogleSignInButton" style="margin-top: 12px; min-height: 44px; display: flex; justify-content: center; width: 100%;"></div>
                
                <div style="border-top: 1px dashed var(--border-color); width: 100%; margin-top: 12px; padding-top: 16px;">
                    <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 8px;">Reviewing or testing locally?</span>
                    <button class="apply-rec-btn" id="modalMockSignInBtn" style="margin: 0 0 16px 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(0, 255, 136, 0.1); color: var(--primary); border: 1px solid var(--primary-glow);">
                        <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Demo Mock Log In
                    </button>
                    
                    <details style="cursor: pointer; text-align: left; width: 100%;">
                        <summary style="font-size: 11px; color: var(--text-muted); font-weight: 700; outline: none; margin-bottom: 6px;">Configure Google OAuth Client ID</summary>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                            <div style="font-size: 11px; margin-bottom: 4px; color: var(--text-muted); word-break: break-all; line-height: 1.4;">
                                <strong style="color: var(--text-main);">Active Client ID:</strong> 
                                <span style="font-family: monospace; color: var(--primary);">${customClientId}</span>
                            </div>
                            <span style="font-size: 10px; color: var(--text-muted); line-height: 1.4;">
                                If you are the developer or self-hosting, input your Google OAuth Client ID below to connect your own credentials (401 Client Not Found fix).
                            </span>
                            <input type="text" id="googleClientIdInput" placeholder="Enter your client_id.apps.googleusercontent.com" class="settings-select" style="font-size: 11px; padding: 8px; width: 100%; background: rgba(255, 255, 255, 0.02); color: #fff; border: 1px solid var(--border-color); border-radius: 4px;" value="${localStorage.getItem('fpl_hub_google_client_id') || ''}">
                            <button class="apply-rec-btn" id="saveClientIdBtn" style="margin: 0; width: 100%; padding: 6px; font-size: 11px; font-weight: 700; height: 28px; border-radius: 4px;">
                                Save & Reinitialize
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        `;

        actions.showModal(contentHTML, () => {
            // Close button
            const closeBtn = document.getElementById('closeLoginModalBtn');
            if (closeBtn) closeBtn.addEventListener('click', actions.hideModal);

            // Mock login trigger
            const mockBtn = document.getElementById('modalMockSignInBtn');
            if (mockBtn) {
                mockBtn.addEventListener('click', () => {
                    state.userProfile = {
                        name: 'Magnus Carlsen',
                        email: 'magnus@chess.com',
                        picture: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&h=120&q=80',
                        sub: 'mock_123456789'
                    };
                    localStorage.setItem('fpl_hub_user_profile', JSON.stringify(state.userProfile));
                    
                    // Reload user drafts
                    state.loadUserDrafts();
                    
                    actions.syncUserProfile();
                    actions.renderActiveView(); // Refresh the planner view immediately
                    actions.hideModal();
                    actions.showToast("Logged in as Magnus Carlsen (Mock Profile)!", "success");
                });
            }

            // Client ID configuration save handler
            const saveClientIdBtn = document.getElementById('saveClientIdBtn');
            const clientIdInput = document.getElementById('googleClientIdInput');
            if (saveClientIdBtn && clientIdInput) {
                saveClientIdBtn.addEventListener('click', () => {
                    const val = clientIdInput.value.trim();
                    if (!val) {
                        localStorage.removeItem('fpl_hub_google_client_id');
                        actions.showToast("Cleared custom Google Client ID. Falling back to default.", "info");
                    } else {
                        // Warn if it looks like a project ID instead of client ID
                        if (!/^\d+-/.test(val)) {
                            actions.showToast("Warning: ID should start with digits (e.g. 123456-abc.apps...)", "warning");
                        } else {
                            actions.showToast("Saved custom Client ID! Reloading to apply...", "success");
                        }
                        localStorage.setItem('fpl_hub_google_client_id', val);
                    }
                    
                    // Reload page after 1 second so GSI script initializes with the new client ID on fresh load
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                });
            }

            // Render Google Sign-in button in Modal
            actions.initGoogleSignInButton();
            lucide.createIcons();
        });
    },

    showUserProfileModal() {
        if (!state.userProfile) return;

        const contentHTML = `
            <div class="modal-header-section">
                <h3 style="display: flex; align-items: center; gap: 8px;"><i data-lucide="user" class="highlight-bank" style="width: 18px; height: 18px;"></i> Manager Profile</h3>
                <button class="close-modal-btn" id="closeProfileModalBtn"><i data-lucide="x"></i></button>
            </div>
            <div class="checkout-modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 20px; align-items: center; text-align: center;">
                <img src="${state.userProfile.picture}" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--primary); box-shadow: var(--shadow-md); object-fit: cover;">
                
                <div>
                    <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px;">${state.userProfile.name}</h3>
                    <p style="font-size: 13px; color: var(--text-muted);">${state.userProfile.email}</p>
                </div>

                <div class="analysis-stats-grid" style="width: 100%; justify-content: center; gap: 12px; margin: 8px 0; display: flex;">
                    <div class="stat-pill highlight" style="flex: 1; padding: 10px; min-width: auto;">
                        <span class="stat-pill-label" style="font-size: 8.5px;">Account Level</span>
                        <span class="stat-pill-val" style="font-size: 13px; color: var(--primary);">Ultimate Plan</span>
                    </div>
                    <div class="stat-pill" style="flex: 1; padding: 10px; min-width: auto;">
                        <span class="stat-pill-label" style="font-size: 8.5px;">ID Provider</span>
                        <span class="stat-pill-val" style="font-size: 13px;">Google Auth</span>
                    </div>
                </div>

                <button class="tier-action-btn" id="modalSignOutBtn" style="margin: 10px 0 0 0; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i data-lucide="log-out" style="width: 14px; height: 14px;"></i> Sign Out
                </button>
            </div>
        `;

        actions.showModal(contentHTML, () => {
            const closeBtn = document.getElementById('closeProfileModalBtn');
            if (closeBtn) closeBtn.addEventListener('click', actions.hideModal);

            const signOutBtn = document.getElementById('modalSignOutBtn');
            if (signOutBtn) {
                signOutBtn.addEventListener('click', () => {
                    state.logoutAndClearData();
                    actions.syncUserProfile();
                    actions.renderActiveView(); // Refresh the planner view immediately
                    actions.hideModal();
                    actions.showToast("Signed out successfully.", "info");
                });
            }
            lucide.createIcons();
        });
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
            // Swap ordering in starters or bench directly by swapping the player IDs and positions in their slots
            const slot1 = state.squadSlots.find(s => s.playerId === id1);
            const slot2 = state.squadSlots.find(s => s.playerId === id2);
            if (slot1 && slot2) {
                const tempId = slot1.playerId;
                const tempPos = slot1.position;
                
                slot1.playerId = slot2.playerId;
                slot1.position = slot2.position;
                
                slot2.playerId = tempId;
                slot2.position = tempPos;
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
            
            state.optimizeCaptaincy();
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

        state.optimizeCaptaincy();
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

    addTransfer(gw, outId, inId, shouldRender = true) {
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

        state.optimizeCaptaincy();
        state.saveState();
        if (shouldRender) {
            actions.renderActiveView();
        } else {
            actions.syncTopBar();
        }
        actions.showToast(`Transferred in ${pIn.name} for ${pOut.name}!`, 'success');
        return true;
    },

    removeTransfer(gw, index) {
        if (state.transfers[gw]) {
            state.transfers[gw].splice(index, 1);
            state.optimizeCaptaincy();
            state.saveState();
            actions.renderActiveView();
            actions.showToast('Planned transfer removed.', 'success');
        }
    },

    toggleChip(chipName) {
        const wasActive = state.chips[chipName];
        
        // Deactivate all chips first
        Object.keys(state.chips).forEach(k => state.chips[k] = false);
        
        // Toggle target chip
        state.chips[chipName] = !wasActive;
        
        actions.renderActiveView();
        
        const statusText = state.chips[chipName] ? 'Activated' : 'Deactivated';
        const formattedName = chipName === 'tripleCaptain' ? 'Triple Captain' : chipName === 'benchBoost' ? 'Bench Boost' : 'Wildcard';
        actions.showToast(`${formattedName} chip ${statusText}`, 'success');
    },

    setTier(tier) {
        state.tier = tier;
        state.saveState();
        actions.renderActiveView();
    },

    showModal(contentHTML, initCallback) {
        document.querySelectorAll('body > .player-card-tooltip').forEach(el => el.remove());

        const backdrop = document.getElementById('modalContainer');
        const content = document.getElementById('modalContent');

        content.innerHTML = contentHTML;
        backdrop.classList.remove('hidden');
        
        if (backdrop && !backdrop._hasClickListener) {
            backdrop._hasClickListener = true;
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    actions.hideModal();
                }
            });
        }

        if (initCallback) initCallback();
    },

    hideModal() {
        const backdrop = document.getElementById('modalContainer');
        if (backdrop) backdrop.classList.add('hidden');
        document.querySelectorAll('body > .player-card-tooltip').forEach(el => el.remove());
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
    const upgradeBtn = document.getElementById('sidebarUpgradeBtn');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', () => {
            actions.showToast('You already have the Ultimate Edition!', 'info');
        });
    }

    // Sign Out Button Handler
    const signOutBtn = document.getElementById('sidebarSignOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            state.logoutAndClearData();
            actions.syncUserProfile();
            actions.renderActiveView(); // Refresh the planner view immediately
            actions.showToast("Signed out successfully.", "info");
        });
    }

    // Guest view click handler for mock authentication simulation
    const guestView = document.getElementById('authGuestView');
    if (guestView) {
        guestView.addEventListener('dblclick', () => {
            state.userProfile = {
                name: 'Magnus Carlsen',
                email: 'magnus@chess.com',
                picture: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&h=120&q=80',
                sub: 'mock_123456789'
            };
            localStorage.setItem('fpl_hub_user_profile', JSON.stringify(state.userProfile));
            
            // Reload user drafts
            state.loadUserDrafts();
            
            actions.syncUserProfile();
            actions.renderActiveView(); // Refresh the planner view immediately
            actions.showToast("Logged in as Magnus Carlsen (Mock Profile)!", "success");
        });
    }

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
            state.autoRotateLineup(state.currentGw);
            actions.renderActiveView();
        }
    });

    document.getElementById('nextGwBtn').addEventListener('click', () => {
        if (state.currentGw < 38) {
            state.currentGw++;
            state.autoRotateLineup(state.currentGw);
            actions.renderActiveView();
        }
    });

    const avTransBtn = document.getElementById('availableTransfersBtn');
    if (avTransBtn) {
        avTransBtn.addEventListener('click', () => {
            state.tpPrepopulatedSource = 'active'; // Force prepopulation
            actions.switchTab('transferplanner'); // Switch tab
        });
    }

    // Mobile Hamburger Menu Controls
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    const openSidebar = () => {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    };

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    };

    if (mobileBtn) {
        mobileBtn.addEventListener('click', openSidebar);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Sync User profile state
    actions.syncUserProfile();

    // Render Initial View
    actions.renderActiveView();
});

if (typeof window !== 'undefined' && !window._modalEscListener) {
    window._modalEscListener = (e) => {
        if (e.key === 'Escape') {
            const backdrop = document.getElementById('modalContainer');
            if (backdrop && !backdrop.classList.contains('hidden')) {
                backdrop.classList.add('hidden');
            }
            document.querySelectorAll('body > .player-card-tooltip').forEach(el => el.remove());
        }
    };
    document.addEventListener('keydown', window._modalEscListener);
}
