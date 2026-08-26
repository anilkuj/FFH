import { PLAYERS, DEFAULT_SQUAD } from './data.js';
// Namespace import (not a named import) for XP_CALIBRATION_FACTOR: data.js is a generated file
// that may not always have this export yet (e.g. before the first sync.js run that bakes it in,
// or if a sync run fails). A named `import { XP_CALIBRATION_FACTOR }` is a hard build-time error
// in bundlers (and native ESM) if the export doesn't statically exist -- there is no way to
// runtime-fall-back from a named import. Property access on a namespace object degrades to
// `undefined` instead, which is what the fallback below actually needs.
import * as DataModule from './data.js';
const SYNCED_XP_CALIBRATION_FACTOR = DataModule.XP_CALIBRATION_FACTOR;
import { renderPlanner } from './components/planner.js';
import { renderOptimizer } from './components/optimizer.js';
import { renderStats } from './components/stats.js';
import { renderCompare } from './components/compare.js';
import { renderTicker } from './components/ticker.js';
import { renderDifferentials } from './components/differentials.js';
import { getFormationConstraints, FORMATIONS } from './components/formation.js';
import { renderCaptain } from './components/captain.js';
import { renderLeague } from './components/league.js';
import { renderLiveRank } from './components/liverank.js';
import { renderReveals } from './components/reveals.js';
import { renderTransferPlanner } from './components/transferplanner.js';
import { renderSolioProjections } from './components/solioprojections.js';
import { renderTopPerformers } from './components/topperformers.js';
import { renderLeagueAnalyzer } from './components/leagueanalyzer.js';

if (typeof window !== 'undefined') {
    window.PLAYERS = PLAYERS;
}

window.getPlayerMinutesFactor = function(player) {
    if (!player) return 1.0;
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return 0;

    // Backup goalkeeper suppression stays -- this is a squad-slot rule
    const allPlayers = (typeof PLAYERS !== 'undefined' && Array.isArray(PLAYERS)) ? PLAYERS : (typeof window !== 'undefined' && window.PLAYERS ? window.PLAYERS : []);
    if (player.position === 'GKP' && player.price <= 4.0) {
        const primaryGKPs = allPlayers.filter(p => p.position === 'GKP' && p.team === player.team && p.price >= 4.5);
        const hasActivePrimary = primaryGKPs.some(p => p.status !== 'i' && p.status !== 's' && (p.chanceOfPlaying === undefined || p.chanceOfPlaying > 0));
        if (hasActivePrimary) return 0.0;
    }

    return 1.0;
};



// Calibration factor disabled as requested: set to 1.0 to use Solio numbers as-is.
const XP_CALIBRATION_FACTOR = 1.0;

window.applyUniversalMinutesDiscount = function() {
    if (typeof PLAYERS === 'undefined' || !Array.isArray(PLAYERS)) return;
    PLAYERS.forEach(player => {
        const factor = window.getPlayerMinutesFactor(player);
        if (player.predictions && Array.isArray(player.predictions)) {
            player.predictions.forEach(pr => {
                if (pr._rawPts === undefined) {
                    // Scale _rawPts by calibration factor so all code paths get realistic values.
                    // Components like optimizer and planner read _rawPts directly and re-apply
                    // the minutes factor, so calibrating _rawPts covers all usage sites.
                    pr._rawPts = pr.pts * XP_CALIBRATION_FACTOR;
                }
                // pts = calibrated base × per-player minutes/rotation factor
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

// Application State class

const safeJsonParse = (str, fallback) => {
    if (!str || str === 'undefined') return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

class AppState {
    constructor() {
        this.activeTab = 'planner';
        this.currentGw = 1;
        this.selectedEmptySlot = null;
        
        // Hardcoded to ultra to make all features free
        this.tier = 'ultra';
        
        // Load slot-based squad representation
        const savedSquadSlots = localStorage.getItem('fpl_hub_squad_slots');
        if (savedSquadSlots && savedSquadSlots !== 'undefined') {
            this.squadSlots = safeJsonParse(savedSquadSlots, null);
        }
        
        if (!this.squadSlots) {
            // Initialize from old local storage or DEFAULT_SQUAD
            const savedSquad = localStorage.getItem('fpl_hub_squad');
            const squadIds = safeJsonParse(savedSquad, null) || [...DEFAULT_SQUAD];
            
            const gkps = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP');
            const defs = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF');
            const mids = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID');
            const fwds = squadIds.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD');
            
            const savedStarters = localStorage.getItem('fpl_hub_starters');
            const startersList = safeJsonParse(savedStarters, []);
            
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
        this.mustInclude = safeJsonParse(savedMustInclude, []);

        const savedMustExclude = localStorage.getItem('fpl_hub_must_exclude');
        this.mustExclude = safeJsonParse(savedMustExclude, []);

        const savedBenchBudget = localStorage.getItem('fpl_hub_bench_budget');
        this.benchBudget = savedBenchBudget ? parseFloat(savedBenchBudget) : 17.0;

        const savedGuaranteedStart = localStorage.getItem('fpl_hub_guaranteed_start');
        this.guaranteedStart = savedGuaranteedStart ? parseInt(savedGuaranteedStart) : 60;

        const savedMinFwdPrice = localStorage.getItem('fpl_hub_min_fwd_price');
        this.minFwdPrice = savedMinFwdPrice ? parseFloat(savedMinFwdPrice) : 6.0;

        const savedPrioritizeDefcon = localStorage.getItem('fpl_hub_prioritize_defcon');
        this.prioritizeDefcon = savedPrioritizeDefcon ? (savedPrioritizeDefcon === 'true') : false;

        const savedPrioritizeSpotKicks = localStorage.getItem('fpl_hub_prioritize_spot_kicks');
        this.prioritizeSpotKicks = savedPrioritizeSpotKicks ? (savedPrioritizeSpotKicks === 'true') : false;

        const savedPlanBenchBoost = localStorage.getItem('fpl_hub_plan_bench_boost');
        this.planBenchBoost = savedPlanBenchBoost ? (savedPlanBenchBoost === 'true') : false;

        const savedBenchBoostTargetGw = localStorage.getItem('fpl_hub_bench_boost_target_gw');
        this.benchBoostTargetGw = savedBenchBoostTargetGw ? parseInt(savedBenchBoostTargetGw) : 1;

        const savedPlanWildcard = localStorage.getItem('fpl_hub_plan_wildcard');
        this.planWildcard = savedPlanWildcard ? (savedPlanWildcard === 'true') : false;

        const savedWildcardTargetGw = localStorage.getItem('fpl_hub_wildcard_target_gw');
        this.wildcardTargetGw = savedWildcardTargetGw ? parseInt(savedWildcardTargetGw) : 1;

        const savedPlanFreeHit = localStorage.getItem('fpl_hub_plan_free_hit');
        this.planFreeHit = savedPlanFreeHit ? (savedPlanFreeHit === 'true') : false;

        const savedFreeHitTargetGw = localStorage.getItem('fpl_hub_free_hit_target_gw');
        this.freeHitTargetGw = savedFreeHitTargetGw ? parseInt(savedFreeHitTargetGw) : 1;

        this.optimizerObjective = localStorage.getItem('fpl_hub_optimizer_objective') || 'xp';

        const savedProfile = localStorage.getItem('fpl_hub_user_profile');
        this.userProfile = safeJsonParse(savedProfile, null);

        const savedLastLocalUpdate = localStorage.getItem('fpl_hub_last_local_update');
        this.lastLocalUpdate = savedLastLocalUpdate ? parseInt(savedLastLocalUpdate) : 0;

        // Active chips stored per Gameweek: { gwNum: { wildcard: bool, tripleCaptain: bool, benchBoost: bool, freeHit: bool } }
        const savedChips = localStorage.getItem('fpl_hub_active_chips');
        this.chips = safeJsonParse(savedChips, {});
        for (let gw = 1; gw <= 38; gw++) {
            if (!this.chips[gw]) {
                this.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
            }
        }

        // Planned transfers: { gwNum: [ { out: id, in: id } ] }
        const savedTransfers = localStorage.getItem('fpl_hub_transfers');
        this.transfers = safeJsonParse(savedTransfers, null) || {
            1: [], 2: [], 3: [], 4: [], 5: []
        };

        const savedWeeklyLineups = localStorage.getItem('fpl_hub_weekly_lineups');
        this.weeklyLineups = safeJsonParse(savedWeeklyLineups, {});

        this.livePoints = {};
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
            this.drafts[this.activeDraftIndex].transfers = JSON.parse(JSON.stringify(this.transfers));
            this.drafts[this.activeDraftIndex].chips = JSON.parse(JSON.stringify(this.chips));
            this.drafts[this.activeDraftIndex].weeklyLineups = JSON.parse(JSON.stringify(this.weeklyLineups));
        }

        localStorage.setItem('fpl_hub_weekly_lineups', JSON.stringify(this.weeklyLineups));

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
        localStorage.setItem('fpl_hub_prioritize_defcon', (this.prioritizeDefcon || false).toString());
        localStorage.setItem('fpl_hub_prioritize_spot_kicks', (this.prioritizeSpotKicks || false).toString());
        localStorage.setItem('fpl_hub_optimizer_objective', this.optimizerObjective || 'xp');
        localStorage.setItem('fpl_hub_active_chips', JSON.stringify(this.chips));
        localStorage.setItem('fpl_hub_plan_bench_boost', (this.planBenchBoost || false).toString());
        localStorage.setItem('fpl_hub_bench_boost_target_gw', (this.benchBoostTargetGw || 1).toString());
        localStorage.setItem('fpl_hub_plan_wildcard', (this.planWildcard || false).toString());
        localStorage.setItem('fpl_hub_wildcard_target_gw', (this.wildcardTargetGw || 1).toString());
        localStorage.setItem('fpl_hub_plan_free_hit', (this.planFreeHit || false).toString());
        localStorage.setItem('fpl_hub_free_hit_target_gw', (this.freeHitTargetGw || 1).toString());

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
                        
                        const mergedDrafts = JSON.parse(JSON.stringify(data.drafts));
                        if (this.drafts && Array.isArray(this.drafts)) {
                            this.drafts.forEach((localDraft, idx) => {
                                const cloudDraft = mergedDrafts[idx];
                                if (cloudDraft && localDraft) {
                                    const localPopulated = localDraft.squadSlots && localDraft.squadSlots.some(s => s.playerId !== null);
                                    const cloudPopulated = cloudDraft.squadSlots && cloudDraft.squadSlots.some(s => s.playerId !== null);
                                    if (localPopulated && !cloudPopulated) {
                                        mergedDrafts[idx] = JSON.parse(JSON.stringify(localDraft));
                                    }
                                }
                            });
                        }
                        this.drafts = mergedDrafts;
                        this.activeDraftIndex = typeof data.activeDraftIndex === 'number' ? data.activeDraftIndex : 0;
                        this.loadActiveDraftState();


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
                    
                    const mergedDrafts = JSON.parse(JSON.stringify(cloudData.drafts));
                    if (this.drafts && Array.isArray(this.drafts)) {
                        this.drafts.forEach((localDraft, idx) => {
                            const cloudDraft = mergedDrafts[idx];
                            if (cloudDraft && localDraft) {
                                const localPopulated = localDraft.squadSlots && localDraft.squadSlots.some(s => s.playerId !== null);
                                const cloudPopulated = cloudDraft.squadSlots && cloudDraft.squadSlots.some(s => s.playerId !== null);
                                if (localPopulated && !cloudPopulated) {
                                    mergedDrafts[idx] = JSON.parse(JSON.stringify(localDraft));
                                }
                            }
                        });
                    }
                    this.drafts = mergedDrafts;
                    this.activeDraftIndex = typeof cloudData.activeDraftIndex === 'number' ? cloudData.activeDraftIndex : 0;
                    this.loadActiveDraftState();

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
                    this.loadActiveDraftState();
                    
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
        const squadInfo = this.getSquadForGw(this.currentGw);
        const starters = squadInfo.starters;
        if (starters.length === 0) return;

        const starterPts = starters.map(id => {
            const p = PLAYERS.find(pl => pl.id === id);
            let pts = 0;
            if (p) {
                const pred = p.predictions.find(pr => pr.gw == this.currentGw);
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
            if (gw === targetGw || !this.chips[gw]?.freeHit) {
                weeklyTransfers.forEach(tx => {
                    const pOut = PLAYERS.find(p => p.id === tx.out);
                    const pIn = tx.in ? PLAYERS.find(p => p.id === tx.in) : null;
                    
                    if (pOut) {
                        // Update lists
                        squad = squad.map(id => id === tx.out ? tx.in : id);
                        starters = starters.map(id => id === tx.out ? tx.in : id);
                        bench = bench.map(id => id === tx.out ? tx.in : id);

                        // Update budget
                        bank = bank + pOut.price - (pIn ? pIn.price : 0);
                    }
                });
            }

            // Adjust free transfers for next week (starts at 1, max 5)
            // Wildcard/Free Hit gives unlimited free transfers for that week
            if (gw < targetGw) {
                const txCount = weeklyTransfers.length;
                if (this.chips[gw]?.wildcard) {
                    freeTransfers = 5; // Reset to max after wildcard
                } else if (this.chips[gw]?.freeHit) {
                    // Free Hit does not consume accumulated free transfers, and you get 1 more next week
                    freeTransfers = Math.min(5, freeTransfers + 1);
                } else {
                    freeTransfers = Math.min(5, Math.max(0, freeTransfers - txCount) + 1);
                }
            } else {
                const txCount = weeklyTransfers.length;
                if (this.chips[gw]?.wildcard || this.chips[gw]?.freeHit) {
                    // No transfers consumed
                } else {
                    freeTransfers = Math.max(0, freeTransfers - txCount);
                }
            }
        }

        return {
            starters: starters.filter(id => id !== null),
            bench: bench.filter(id => id !== null),
            squad: squad.filter(id => id !== null),
            bank,
            freeTransfers
        };
    }

    getGwLineup(gw) {
        const squadInfo = this.getSquadForGw(gw);
        const { squad } = squadInfo;
        
        let starters = [];
        let bench = [];
        let captain = null;
        let vice = null;
        let formation = this.formation; // default to global baseline formation
        
        const weekly = this.weeklyLineups[gw];
        if (weekly) {
            if (weekly.formation) formation = weekly.formation;
            
            // Check if weekly starters/bench are still in the resolved squad for this week
            const validStarters = (weekly.starters || []).filter(id => squad.includes(id));
            const validBench = (weekly.bench || []).filter(id => squad.includes(id));
            const missing = squad.filter(id => !validStarters.includes(id) && !validBench.includes(id));
            
            // Reconstruct starters and bench preserving valid ones
            starters = validStarters;
            bench = validBench;
            
            // Fill in any missing players based on position constraints of the formation
            const cons = getFormationConstraints(formation);
            
            // We want to fill starters up to the formation constraints
            // Group missing players by position
            const missingByPos = { GKP: [], DEF: [], MID: [], FWD: [] };
            missing.forEach(id => {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) missingByPos[p.position].push(id);
            });
            
            // Helper to get count of starters in a position
            const getStarterCount = (pos) => starters.filter(id => PLAYERS.find(pl => pl.id === id)?.position === pos).length;
            
            // GK
            while (getStarterCount('GKP') < cons.GKP && missingByPos.GKP.length > 0) {
                starters.push(missingByPos.GKP.shift());
            }
            // DEF
            while (getStarterCount('DEF') < cons.DEF && missingByPos.DEF.length > 0) {
                starters.push(missingByPos.DEF.shift());
            }
            // MID
            while (getStarterCount('MID') < cons.MID && missingByPos.MID.length > 0) {
                starters.push(missingByPos.MID.shift());
            }
            // FWD
            while (getStarterCount('FWD') < cons.FWD && missingByPos.FWD.length > 0) {
                starters.push(missingByPos.FWD.shift());
            }
            
            // Any remaining missing go to the bench
            ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
                bench.push(...missingByPos[pos]);
            });
            
            // Resolve captain and vice
            if (weekly.captain && squad.includes(weekly.captain)) {
                captain = weekly.captain;
            }
            if (weekly.vice && squad.includes(weekly.vice)) {
                vice = weekly.vice;
            }
        }
        
        // Default fallback if weekly lineup is not set, or is incomplete/corrupted
        if (starters.length + bench.length !== 15 || starters.length !== 11) {
            // Run default formation constraints alignment
            const cons = getFormationConstraints(formation);
            starters = [];
            bench = [];
            
            const squadByPos = { GKP: [], DEF: [], MID: [], FWD: [] };
            squad.forEach(id => {
                const p = PLAYERS.find(pl => pl.id === id);
                if (p) squadByPos[p.position].push(id);
            });
            
            // Assign starters up to constraints, rest to bench
            ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
                const limit = cons[pos];
                starters.push(...squadByPos[pos].slice(0, limit));
                bench.push(...squadByPos[pos].slice(limit));
            });
        }
        
        // Ensure captain and vice are set from starters
        if (!captain || !starters.includes(captain)) {
            // Find highest value/XP player in starters
            captain = starters[0] || null;
        }
        if (!vice || !starters.includes(vice) || vice === captain) {
            vice = starters.find(id => id !== captain) || null;
        }
        
        return {
            starters,
            bench,
            captain,
            vice,
            formation
        };
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
                const pred = p.predictions.find(pr => pr.gw == gw) || { pts: 0 };
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
            // Apply new starting configuration to baseline slots
            this.squadSlots.forEach(slot => {
                if (slot.playerId !== null) {
                    // Resolve who occupies this slot in week gw after transfers
                    let currentId = slot.playerId;
                    for (let g = 2; g <= gw; g++) {
                        const weeklyTransfers = this.transfers[g] || [];
                        const tx = weeklyTransfers.find(t => t.out === currentId);
                        if (tx) {
                            currentId = tx.in;
                        }
                    }
                    slot.isStarting = bestStarters.includes(currentId);
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

    async loadLivePoints(gw) {
        if (this.livePoints[gw]) return this.livePoints[gw];
        try {
            const res = await fetch(`/api/live-points?gw=${gw}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.points) {
                    this.livePoints[gw] = data.points;
                    return data.points;
                }
            }
        } catch (e) {
            console.warn(`Failed to load live points for GW${gw}:`, e);
        }
        this.livePoints[gw] = {};
        return {};
    }

    getActiveDraftIdxStorageKey() {
        if (this.userProfile && this.userProfile.sub) {
            return `fpl_hub_active_draft_idx_${this.userProfile.sub}`;
        }
        return 'fpl_hub_active_draft_idx';
    }

    loadActiveDraftState() {
        const activeDraft = this.drafts[this.activeDraftIndex];
        if (activeDraft) {
            let autoPreserved = false;

            // 1. Squad slots
            if (activeDraft.squadSlots) {
                this.squadSlots = JSON.parse(JSON.stringify(activeDraft.squadSlots));
                this.captain = activeDraft.captain;
                this.vice = activeDraft.vice;
                this.formation = activeDraft.formation;
            } else if (this.squadSlots) {
                activeDraft.squadSlots = JSON.parse(JSON.stringify(this.squadSlots));
                activeDraft.captain = this.captain;
                activeDraft.vice = this.vice;
                activeDraft.formation = this.formation;
                autoPreserved = true;
            }

            // 2. Transfers
            if (activeDraft.transfers) {
                this.transfers = JSON.parse(JSON.stringify(activeDraft.transfers));
            } else {
                activeDraft.transfers = JSON.parse(JSON.stringify(this.transfers));
                autoPreserved = true;
            }

            // 3. Chips
            if (activeDraft.chips) {
                this.chips = JSON.parse(JSON.stringify(activeDraft.chips));
            } else {
                activeDraft.chips = JSON.parse(JSON.stringify(this.chips));
                autoPreserved = true;
            }

            // Ensure chips is fully populated
            let chipsUpdated = false;
            for (let gw = 1; gw <= 38; gw++) {
                if (!this.chips[gw]) {
                    this.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
                    chipsUpdated = true;
                }
            }
            if (chipsUpdated) {
                activeDraft.chips = JSON.parse(JSON.stringify(this.chips));
                autoPreserved = true;
            }

            // 4. Weekly Lineups
            if (activeDraft.weeklyLineups) {
                this.weeklyLineups = JSON.parse(JSON.stringify(activeDraft.weeklyLineups));
            } else {
                this.weeklyLineups = {};
                activeDraft.weeklyLineups = {};
                autoPreserved = true;
            }

            if (autoPreserved) {
                this.saveState();
            }
        }
    }

    switchDraft(newIdx) {
        if (newIdx === this.activeDraftIndex) return;

        // Auto-save current squad state to previous active draft slot
        if (this.drafts && this.drafts[this.activeDraftIndex]) {
            this.drafts[this.activeDraftIndex].squadSlots = JSON.parse(JSON.stringify(this.squadSlots));
            this.drafts[this.activeDraftIndex].captain = this.captain;
            this.drafts[this.activeDraftIndex].vice = this.vice;
            this.drafts[this.activeDraftIndex].formation = this.formation;
            this.drafts[this.activeDraftIndex].transfers = JSON.parse(JSON.stringify(this.transfers));
            this.drafts[this.activeDraftIndex].chips = JSON.parse(JSON.stringify(this.chips));
            this.drafts[this.activeDraftIndex].weeklyLineups = JSON.parse(JSON.stringify(this.weeklyLineups));
        }

        // Set active index
        this.activeDraftIndex = newIdx;

        // Apply new draft state
        this.loadActiveDraftState();
        this.saveState();
    }

    cloneDraft(targetIdx) {
        if (targetIdx === this.activeDraftIndex) return false;

        const sourceDraft = this.drafts[this.activeDraftIndex];
        const targetDraft = this.drafts[targetIdx];
        if (!sourceDraft || !targetDraft) return false;

        targetDraft.squadSlots = JSON.parse(JSON.stringify(this.squadSlots));
        targetDraft.captain = this.captain;
        targetDraft.vice = this.vice;
        targetDraft.formation = this.formation;
        targetDraft.transfers = JSON.parse(JSON.stringify(this.transfers));
        targetDraft.chips = JSON.parse(JSON.stringify(this.chips));
        targetDraft.name = `Copy of ${sourceDraft.name}`;

        this.saveState();
        return true;
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

        const lastTeamId = localStorage.getItem('fpl_hub_last_imported_team_id');
        const lastTeamName = localStorage.getItem('fpl_hub_last_imported_team_name');
        const defaultName = lastTeamName ? `${lastTeamName} (ID: ${lastTeamId})` : (lastTeamId ? `FPL Team (ID: ${lastTeamId})` : 'FPL Team ID');

        this.drafts = safeJsonParse(savedDrafts, null) || Array.from({ length: 10 }, (_, i) => ({
            name: i === 0 ? defaultName : `Draft ${i + 1}`,
            squadSlots: null,
            captain: null,
            vice: null,
            formation: '4-4-2',
            transfers: null,
            chips: null
        }));

        // Migration: Ensure the first item is named after the last imported FPL team
        if (this.drafts && this.drafts[0]) {
            if (this.drafts[0].name === 'Draft 1' || this.drafts[0].name === 'FPL Team ID' || !this.drafts[0].name || (lastTeamId && this.drafts[0].name.startsWith('FPL Team (ID:'))) {
                this.drafts[0].name = defaultName;
            }
        }

        const savedActiveDraftIdx = localStorage.getItem(activeIdxKey);
        this.activeDraftIndex = savedActiveDraftIdx ? parseInt(savedActiveDraftIdx) : 0;

        // Apply active draft state
        this.loadActiveDraftState();
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
        this.prioritizeDefcon = false;
        this.prioritizeSpotKicks = false;
        this.optimizerObjective = 'xp';
        this.chips = {};
        for (let gw = 1; gw <= 38; gw++) {
            this.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
        }
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
    getWebName(target) {
        if (!target) return '';
        
        // 1. If passed a player object directly
        if (typeof target === 'object') {
            if (target.web_name) return target.web_name;
            target = target.name || '';
        }
        
        // 2. If passed a numeric player ID
        if (typeof target === 'number') {
            const p = (typeof PLAYERS !== 'undefined' && Array.isArray(PLAYERS)) ? PLAYERS.find(pl => pl.id === target) : null;
            if (p && p.web_name) return p.web_name;
            if (p && p.name) target = p.name;
        }

        if (typeof target !== 'string') return '';
        const trimmed = target.trim();
        if (!trimmed) return '';

        // 3. Exact or case-insensitive lookup in PLAYERS array
        if (typeof PLAYERS !== 'undefined' && Array.isArray(PLAYERS)) {
            const p = PLAYERS.find(pl => pl.name === trimmed || pl.web_name === trimmed || pl.name.toLowerCase() === trimmed.toLowerCase());
            if (p && p.web_name) return p.web_name;
        }

        const webNameOverrides = {
            "Pedro Porro Sauceda": "Pedro Porro",
            "Pedro Porro": "Pedro Porro",
            "João Pedro Junqueira de Jesus": "João Pedro",
            "João Pedro": "João Pedro",
            "Bruno Borges Fernandes": "B.Fernandes",
            "Bruno Fernandes": "B.Fernandes",
            "Francisco Evanilson de Lima Barbosa": "Evanilson",
            "Evanilson": "Evanilson",
            "Matheus Santos Carneiro da Cunha": "Cunha",
            "Matheus Cunha": "Cunha",
            "Dominic Solanke-Mitchell": "Solanke",
            "Dominic Solanke": "Solanke",
            "Pedro Lomba Neto": "Pedro Neto",
            "Pedro Neto": "Pedro Neto",
            "Bruno Guimarães Rodriguez Moura": "Bruno G.",
            "Bruno Guimarães": "Bruno G.",
            "Igor Thiago Nascimento Rodrigues": "Thiago",
            "David Raya Martín": "Raya",
            "Gabriel dos Santos Magalhães": "Gabriel",
            "Emile Smith Rowe": "Smith Rowe",
            "Virgil van Dijk": "van Dijk",
            "Kevin De Bruyne": "De Bruyne",
            "Diogo Teixeira da Silva": "Diogo J.",
            "Diogo Jota": "Diogo J.",
            "Rodrigo Muniz Carvalho": "Rodrigo Muniz",
            "Alex Moreno Lopera": "Alex Moreno",
            "Alex Moreno": "Alex Moreno",
            "Hwang Hee-chan": "Hwang",
            "Son Heung-min": "Son",
            "Andreas Hoelgebaum Pereira": "Andreas",
            "Andreas Pereira": "Andreas",
            "Alejandro Garnacho Ferreyra": "Garnacho",
            "Darwin Núñez Ribeiro": "Darwin",
            "Gabriel Fernando de Jesus": "G.Jesus",
            "Gabriel Jesus": "G.Jesus",
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

        if (webNameOverrides[trimmed]) {
            return webNameOverrides[trimmed];
        }

        // Handle "van " names dynamically (e.g. Micky van de Ven, Jan Paul van Hecke)
        const vanIdx = trimmed.toLowerCase().indexOf(' van ');
        if (vanIdx !== -1) {
            return trimmed.substring(vanIdx + 1);
        }

        // Handle "de " names dynamically (e.g. Matthijs de Ligt, Bobby De Cordova-Reid)
        const deIdx = trimmed.toLowerCase().indexOf(' de ');
        if (deIdx !== -1) {
            return trimmed.substring(deIdx + 1);
        }

        // Default to last word
        return trimmed.split(' ').pop() || trimmed;
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

        // --- Optimizer guard: never tear down a live optimizer session on re-render ---
        // The optimizer manages its own DOM (results, loader, buttons, isExecuting flag).
        // Any call to renderActiveView() while on the optimizer tab — e.g. from a chip toggle
        // or squad mutation — must NOT wipe and rebuild the whole view, otherwise:
        //   1. isExecuting resets to false mid-solve → duplicate concurrent runs fire
        //   2. Event listeners stack up → run button triggers multiple solves on each click
        //   3. Results are wiped mid-render → user sees blank flicker
        // Instead we just sync the top bar and return early.
        if (state.activeTab === 'optimizer' && container.querySelector('#runOptBtn')) {
            actions.syncTopBar();
            return;
        }

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
            case 'solio':
                renderSolioProjections(container, state, actions);
                break;
            case 'topperformers':
                renderTopPerformers(container, state, actions);
                break;
            case 'leagueanalyzer':
                renderLeagueAnalyzer(container, state, actions);
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
        const formattedTransfers = (state.currentGw === 1 || state.chips[state.currentGw]?.wildcard || state.chips[state.currentGw]?.freeHit) ? 'Unlimited' : squadInfo.freeTransfers;

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
        const currentWeekChips = state.chips[state.currentGw] || { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
        const isBbActive = !!(currentWeekChips.benchBoost || (state.planBenchBoost && state.benchBoostTargetGw === state.currentGw));
        
        const activeChips = [];
        if (currentWeekChips.wildcard) activeChips.push('wildcard');
        if (currentWeekChips.freeHit) activeChips.push('freeHit');
        if (currentWeekChips.tripleCaptain) activeChips.push('tripleCaptain');
        if (isBbActive) activeChips.push('benchBoost');

        const formattedChips = activeChips.length > 0 ? activeChips.map(c => c === 'tripleCaptain' ? 'TC' : (c === 'benchBoost' ? 'BB' : c === 'freeHit' ? 'FH' : 'WC')).join(', ') : 'None';

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
                            state.loadActiveDraftState();
                            
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
        const gw = state.currentGw;
        if (!state.weeklyLineups[gw]) {
            const current = state.getGwLineup(gw);
            state.weeklyLineups[gw] = { 
                starters: current.starters, 
                bench: current.bench, 
                captain: current.captain, 
                vice: current.vice, 
                formation: current.formation 
            };
        }
        state.weeklyLineups[gw].captain = playerId;
        // Fallback global update
        state.captain = playerId;
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Captain updated successfully!', 'success');
    },

    setVice(playerId) {
        const gw = state.currentGw;
        if (!state.weeklyLineups[gw]) {
            const current = state.getGwLineup(gw);
            state.weeklyLineups[gw] = { 
                starters: current.starters, 
                bench: current.bench, 
                captain: current.captain, 
                vice: current.vice, 
                formation: current.formation 
            };
        }
        state.weeklyLineups[gw].vice = playerId;
        // Fallback global update
        state.vice = playerId;
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Vice-Captain updated successfully!', 'success');
    },

    // Set formation and adjust starters accordingly
    setFormation(formation) {
        const gw = state.currentGw;
        if (!state.weeklyLineups[gw]) {
            const current = state.getGwLineup(gw);
            state.weeklyLineups[gw] = { 
                starters: current.starters, 
                bench: current.bench, 
                captain: current.captain, 
                vice: current.vice, 
                formation: current.formation 
            };
        }
        state.weeklyLineups[gw].formation = formation;
        
        // Re-align starters based on the new formation
        const squadInfo = state.getSquadForGw(gw);
        const { squad } = squadInfo;
        const cons = getFormationConstraints(formation);
        
        const starters = [];
        const bench = [];
        const squadByPos = { GKP: [], DEF: [], MID: [], FWD: [] };
        squad.forEach(id => {
            const p = PLAYERS.find(pl => pl.id === id);
            if (p) squadByPos[p.position].push(id);
        });
        
        ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
            const limit = cons[pos];
            starters.push(...squadByPos[pos].slice(0, limit));
            bench.push(...squadByPos[pos].slice(limit));
        });
        
        state.weeklyLineups[gw].starters = starters;
        state.weeklyLineups[gw].bench = bench;
        state.formation = formation;
        state.saveState();
        actions.renderActiveView();
        actions.showToast(`Formation set to ${formation}`, 'success');
    },

    swapPlayers(id1, id2) {
        const gw = state.currentGw;
        if (!state.weeklyLineups[gw]) {
            const current = state.getGwLineup(gw);
            state.weeklyLineups[gw] = { 
                starters: current.starters, 
                bench: current.bench, 
                captain: current.captain, 
                vice: current.vice, 
                formation: current.formation 
            };
        }
        const lineup = state.weeklyLineups[gw];
        
        const inStarters1 = lineup.starters.includes(id1);
        const inStarters2 = lineup.starters.includes(id2);
        
        if (inStarters1 === inStarters2) {
            // Swap ordering in starters or bench directly
            if (inStarters1) {
                const idx1 = lineup.starters.indexOf(id1);
                const idx2 = lineup.starters.indexOf(id2);
                lineup.starters[idx1] = id2;
                lineup.starters[idx2] = id1;
            } else {
                const idx1 = lineup.bench.indexOf(id1);
                const idx2 = lineup.bench.indexOf(id2);
                lineup.bench[idx1] = id2;
                lineup.bench[idx2] = id1;
            }
        } else {
            // Starters vs Bench swap. Swap starting status and validate formation
            const hypStarters = lineup.starters.map(id => id === id1 ? id2 : (id === id2 ? id1 : id));
            
            // Validate formation
            const gkpCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'GKP').length;
            const defCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'DEF').length;
            const midCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'MID').length;
            const fwdCount = hypStarters.filter(id => PLAYERS.find(p => p.id === id)?.position === 'FWD').length;

            if (gkpCount !== 1) {
                actions.showToast('Starting lineup must contain exactly 1 Goalkeeper.', 'error');
                return;
            }
            if (defCount < 3 || defCount > 5) {
                actions.showToast('Starting lineup must contain between 3 and 5 Defenders.', 'error');
                return;
            }
            if (midCount < 2 || midCount > 5) {
                actions.showToast('Starting lineup must contain between 2 and 5 Midfielders.', 'error');
                return;
            }
            if (fwdCount < 1 || fwdCount > 3) {
                actions.showToast('Starting lineup must contain between 1 and 3 Forwards.', 'error');
                return;
            }

            // If valid, apply swap
            const idxS = lineup.starters.indexOf(inStarters1 ? id1 : id2);
            const idxB = lineup.bench.indexOf(inStarters1 ? id2 : id1);
            lineup.starters[idxS] = inStarters1 ? id2 : id1;
            lineup.bench[idxB] = inStarters1 ? id1 : id2;

            lineup.formation = `${defCount}-${midCount}-${fwdCount}`;
            state.formation = lineup.formation;
        }

        state.saveState();
        actions.renderActiveView();
        actions.showToast(`Formation automatically updated to ${state.formation}!`, 'success');
    },

    removePlayer(playerId) {
        if (state.currentGw === 1) {
            const slot = state.squadSlots.find(s => s.playerId === playerId);
            if (slot) {
                slot.playerId = null;
                slot.prevPlayerId = playerId;
            }
        } else {
            // Check if this player was already transferred IN in this gameweek
            const weeklyTransfers = state.transfers[state.currentGw] || [];
            const existingTxIdx = weeklyTransfers.findIndex(tx => tx.in === playerId);
            if (existingTxIdx !== -1) {
                weeklyTransfers.splice(existingTxIdx, 1);
            } else {
                if (!state.transfers[state.currentGw]) {
                    state.transfers[state.currentGw] = [];
                }
                state.transfers[state.currentGw].push({ out: playerId, in: null });
            }
        }
        
        state.optimizeCaptaincy();
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Player removed.', 'success');
    },

    restorePlayer(slotIndex, playerId) {
        if (state.currentGw === 1) {
            const slot = state.squadSlots[slotIndex];
            if (slot && slot.prevPlayerId === playerId) {
                slot.playerId = playerId;
                delete slot.prevPlayerId;
            }
        } else {
            const weeklyTransfers = state.transfers[state.currentGw] || [];
            const idx = weeklyTransfers.findIndex(tx => tx.out === playerId && tx.in === null);
            if (idx !== -1) {
                weeklyTransfers.splice(idx, 1);
            }
        }
        
        state.optimizeCaptaincy();
        state.saveState();
        actions.renderActiveView();
        actions.showToast('Player restored successfully!', 'success');
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
            delete state.squadSlots[slotIndex].prevPlayerId;
        } else {
            // Find the original player in this slot entering this GW (after applying transfers from GW2 to gw - 1)
            let slotsAtGwStart = JSON.parse(JSON.stringify(state.squadSlots));
            for (let g = 2; g < gw; g++) {
                const weeklyTxs = state.transfers[g] || [];
                weeklyTxs.forEach(tx => {
                    const slot = slotsAtGwStart.find(s => s.playerId === tx.out);
                    if (slot) slot.playerId = tx.in;
                });
            }
            const originalPlayerId = slotsAtGwStart[slotIndex].playerId;

            if (originalPlayerId) {
                if (!state.transfers[gw]) {
                    state.transfers[gw] = [];
                }
                const existingTx = state.transfers[gw].find(tx => tx.out === originalPlayerId);
                if (existingTx) {
                    existingTx.in = inId;
                } else {
                    state.transfers[gw].push({ out: originalPlayerId, in: inId });
                }
            } else {
                state.squadSlots[slotIndex].playerId = inId;
                delete state.squadSlots[slotIndex].prevPlayerId;
            }
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

        // Turn off Bench Boost and reset all active chips across all gameweeks
        state.planBenchBoost = false;
        state.benchBoostTargetGw = null;
        for (let g = 1; g <= 38; g++) {
            state.chips[g] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
        }
        state.squadRisks = {};

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

        // Turn off Bench Boost and reset all active chips across all gameweeks
        state.planBenchBoost = false;
        state.benchBoostTargetGw = null;
        for (let g = 1; g <= 38; g++) {
            state.chips[g] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
        }
        state.squadRisks = {};

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
        const gw = state.currentGw;
        if (!state.chips[gw]) {
            state.chips[gw] = { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false };
        }
        
        let wasActive = state.chips[gw][chipName];
        if (chipName === 'benchBoost' && state.planBenchBoost && state.benchBoostTargetGw === gw) {
            wasActive = true;
        } else if (chipName === 'wildcard' && state.planWildcard && state.wildcardTargetGw === gw) {
            wasActive = true;
        } else if (chipName === 'freeHit' && state.planFreeHit && state.freeHitTargetGw === gw) {
            wasActive = true;
        }
        
        // Deactivate all chips for this gameweek first (FPL rules: 1 chip per week max)
        Object.keys(state.chips[gw]).forEach(k => state.chips[gw][k] = false);
        
        // Handle target chip toggling
        if (chipName === 'benchBoost') {
            if (wasActive) {
                // If it was active (manual or planned), deactivate it completely
                state.chips[gw].benchBoost = false;
                state.planBenchBoost = false;
                // Clear any active benchBoost chip in state.chips for all weeks
                for (let g = 1; g <= 38; g++) {
                    if (state.chips[g]) {
                        state.chips[g].benchBoost = false;
                    }
                }
            } else {
                state.chips[gw].benchBoost = true;
                state.planBenchBoost = true;
                state.benchBoostTargetGw = gw;
                // Clear any other manual benchBoost activation on other weeks
                for (let g = 1; g <= 38; g++) {
                    if (g !== gw && state.chips[g]) {
                        state.chips[g].benchBoost = false;
                    }
                }
                // FPL rule: only one chip per GW, so turn off planned Wildcard or Free Hit if they are planned for this GW
                if (state.planWildcard && state.wildcardTargetGw === gw) state.planWildcard = false;
                if (state.planFreeHit && state.freeHitTargetGw === gw) state.planFreeHit = false;
            }
        } else if (chipName === 'wildcard') {
            if (wasActive) {
                state.chips[gw].wildcard = false;
                state.planWildcard = false;
                for (let g = 1; g <= 38; g++) {
                    if (state.chips[g]) {
                        state.chips[g].wildcard = false;
                    }
                }
                state.transfers[gw] = [];
                if (state.weeklyLineups && state.weeklyLineups[gw]) {
                    delete state.weeklyLineups[gw];
                }
            } else {
                state.chips[gw].wildcard = true;
                state.planWildcard = true;
                state.wildcardTargetGw = gw;
                for (let g = 1; g <= 38; g++) {
                    if (g !== gw && state.chips[g]) {
                        state.chips[g].wildcard = false;
                    }
                }
                // FPL rule: only one chip per GW, so turn off planned Bench Boost or Free Hit if they are planned for this GW
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) state.planBenchBoost = false;
                if (state.planFreeHit && state.freeHitTargetGw === gw) state.planFreeHit = false;
            }
        } else if (chipName === 'freeHit') {
            if (wasActive) {
                state.chips[gw].freeHit = false;
                state.planFreeHit = false;
                for (let g = 1; g <= 38; g++) {
                    if (state.chips[g]) {
                        state.chips[g].freeHit = false;
                    }
                }
                state.transfers[gw] = [];
                if (state.weeklyLineups && state.weeklyLineups[gw]) {
                    delete state.weeklyLineups[gw];
                }
            } else {
                state.chips[gw].freeHit = true;
                state.planFreeHit = true;
                state.freeHitTargetGw = gw;
                for (let g = 1; g <= 38; g++) {
                    if (g !== gw && state.chips[g]) {
                        state.chips[g].freeHit = false;
                    }
                }
                // FPL rule: only one chip per GW, so turn off planned Bench Boost or Wildcard if they are planned for this GW
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) state.planBenchBoost = false;
                if (state.planWildcard && state.wildcardTargetGw === gw) state.planWildcard = false;
            }
        } else {
            state.chips[gw][chipName] = !wasActive;
            // FPL rule: only one chip per GW, so if they manual-activated TC, deactivate planned chips
            if (state.chips[gw][chipName]) {
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) {
                    state.planBenchBoost = false;
                    state.chips[gw].benchBoost = false;
                }
                if (state.planWildcard && state.wildcardTargetGw === gw) {
                    state.planWildcard = false;
                    state.chips[gw].wildcard = false;
                }
                if (state.planFreeHit && state.freeHitTargetGw === gw) {
                    state.planFreeHit = false;
                    state.chips[gw].freeHit = false;
                }
            }
        }
        
        state.saveState();
        actions.renderActiveView();
        
        const isChipNowActive = (chipName === 'benchBoost' && (state.chips[gw].benchBoost || (state.planBenchBoost && state.benchBoostTargetGw === gw))) ||
                               (chipName === 'wildcard' && (state.chips[gw].wildcard || (state.planWildcard && state.wildcardTargetGw === gw))) ||
                               (chipName === 'freeHit' && (state.chips[gw].freeHit || (state.planFreeHit && state.freeHitTargetGw === gw))) ||
                               (chipName === 'tripleCaptain' && state.chips[gw].tripleCaptain);
        const statusText = isChipNowActive ? 'Activated' : 'Deactivated';
        const formattedName = chipName === 'tripleCaptain' ? 'Triple Captain' : chipName === 'benchBoost' ? 'Bench Boost' : chipName === 'freeHit' ? 'Free Hit' : 'Wildcard';
        actions.showToast(`${formattedName} chip ${statusText} for Gameweek ${gw}`, 'success');
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
        const updateThemeIcon = () => {
            const isLight = document.documentElement.classList.contains('light-theme');
            themeBtn.innerHTML = isLight ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
            lucide.createIcons();
        };
        updateThemeIcon();

        themeBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem('fpl_hub_theme', isLight ? 'light' : 'dark');
            updateThemeIcon();
            actions.renderActiveView();
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
        if (state.currentGw < 38) {
            state.currentGw++;
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
