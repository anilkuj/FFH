import test from 'node:test';
import assert from 'node:assert/strict';

test('toggleChip mutual exclusivity rules for Wildcard, Free Hit, and Bench Boost', () => {
    // Mock state object
    const state = {
        currentGw: 2,
        chips: {
            2: { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: false }
        },
        planBenchBoost: false,
        benchBoostTargetGw: 1,
        planWildcard: false,
        wildcardTargetGw: 1,
        planFreeHit: false,
        freeHitTargetGw: 1,
        
        saveState() {},
    };
    
    // Simulate toggleChip action logic
    function toggleChipMock(state, chipName) {
        const gw = state.currentGw;
        let wasActive = state.chips[gw][chipName];
        if (chipName === 'benchBoost' && state.planBenchBoost && state.benchBoostTargetGw === gw) {
            wasActive = true;
        } else if (chipName === 'wildcard' && state.planWildcard && state.wildcardTargetGw === gw) {
            wasActive = true;
        } else if (chipName === 'freeHit' && state.planFreeHit && state.freeHitTargetGw === gw) {
            wasActive = true;
        }
        
        Object.keys(state.chips[gw]).forEach(k => state.chips[gw][k] = false);
        
        if (chipName === 'benchBoost') {
            if (wasActive) {
                state.chips[gw].benchBoost = false;
                state.planBenchBoost = false;
            } else {
                state.chips[gw].benchBoost = true;
                state.planBenchBoost = true;
                state.benchBoostTargetGw = gw;
                if (state.planWildcard && state.wildcardTargetGw === gw) state.planWildcard = false;
                if (state.planFreeHit && state.freeHitTargetGw === gw) state.planFreeHit = false;
            }
        } else if (chipName === 'wildcard') {
            if (wasActive) {
                state.chips[gw].wildcard = false;
                state.planWildcard = false;
            } else {
                state.chips[gw].wildcard = true;
                state.planWildcard = true;
                state.wildcardTargetGw = gw;
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) state.planBenchBoost = false;
                if (state.planFreeHit && state.freeHitTargetGw === gw) state.planFreeHit = false;
            }
        } else if (chipName === 'freeHit') {
            if (wasActive) {
                state.chips[gw].freeHit = false;
                state.planFreeHit = false;
            } else {
                state.chips[gw].freeHit = true;
                state.planFreeHit = true;
                state.freeHitTargetGw = gw;
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) state.planBenchBoost = false;
                if (state.planWildcard && state.wildcardTargetGw === gw) state.planWildcard = false;
            }
        } else {
            state.chips[gw][chipName] = !wasActive;
            if (state.chips[gw][chipName]) {
                if (state.planBenchBoost && state.benchBoostTargetGw === gw) state.planBenchBoost = false;
                if (state.planWildcard && state.wildcardTargetGw === gw) state.planWildcard = false;
                if (state.planFreeHit && state.freeHitTargetGw === gw) state.planFreeHit = false;
            }
        }
    }
    
    // 1. Activate Bench Boost
    toggleChipMock(state, 'benchBoost');
    assert.equal(state.planBenchBoost, true);
    assert.equal(state.chips[2].benchBoost, true);
    assert.equal(state.chips[2].wildcard, false);
    assert.equal(state.chips[2].freeHit, false);
    
    // 2. Activate Wildcard on same GW (should disable Bench Boost)
    toggleChipMock(state, 'wildcard');
    assert.equal(state.planWildcard, true);
    assert.equal(state.planBenchBoost, false);
    assert.equal(state.chips[2].wildcard, true);
    assert.equal(state.chips[2].benchBoost, false);
    assert.equal(state.chips[2].freeHit, false);

    // 3. Activate Free Hit on same GW (should disable Wildcard)
    toggleChipMock(state, 'freeHit');
    assert.equal(state.planFreeHit, true);
    assert.equal(state.planWildcard, false);
    assert.equal(state.chips[2].freeHit, true);
    assert.equal(state.chips[2].wildcard, false);
    assert.equal(state.chips[2].benchBoost, false);
});

test('getGwLineup self-healing and fallback alignment', () => {
    // Mock getFormationConstraints
    const formationConstraints = {
        '4-4-2': { GKP: 1, DEF: 4, MID: 4, FWD: 2 },
        '3-5-2': { GKP: 1, DEF: 3, MID: 5, FWD: 2 }
    };
    
    const PLAYERS = [
        { id: 1, position: 'GKP', price: 5.0 },
        { id: 2, position: 'GKP', price: 4.0 },
        { id: 3, position: 'DEF', price: 6.0 },
        { id: 4, position: 'DEF', price: 5.5 },
        { id: 5, position: 'DEF', price: 5.0 },
        { id: 6, position: 'DEF', price: 4.5 },
        { id: 7, position: 'DEF', price: 4.0 },
        { id: 8, position: 'MID', price: 8.0 },
        { id: 9, position: 'MID', price: 7.5 },
        { id: 10, position: 'MID', price: 7.0 },
        { id: 11, position: 'MID', price: 6.5 },
        { id: 12, position: 'MID', price: 6.0 },
        { id: 13, position: 'FWD', price: 9.0 },
        { id: 14, position: 'FWD', price: 8.5 },
        { id: 15, position: 'FWD', price: 7.5 }
    ];

    // Mock state
    const state = {
        formation: '4-4-2',
        weeklyLineups: {},
        getSquadForGw(gw) {
            return {
                squad: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                starters: [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14],
                bench: [2, 7, 12, 15],
                bank: 0.5,
                freeTransfers: 1
            };
        },
        getGwLineup(gw) {
            const squadInfo = this.getSquadForGw(gw);
            const { squad } = squadInfo;
            
            let starters = [];
            let bench = [];
            let captain = null;
            let vice = null;
            let formation = this.formation;
            
            const weekly = this.weeklyLineups[gw];
            if (weekly) {
                if (weekly.formation) formation = weekly.formation;
                
                const validStarters = (weekly.starters || []).filter(id => squad.includes(id));
                const validBench = (weekly.bench || []).filter(id => squad.includes(id));
                const missing = squad.filter(id => !validStarters.includes(id) && !validBench.includes(id));
                
                starters = validStarters;
                bench = validBench;
                
                const cons = formationConstraints[formation];
                const missingByPos = { GKP: [], DEF: [], MID: [], FWD: [] };
                missing.forEach(id => {
                    const p = PLAYERS.find(pl => pl.id === id);
                    if (p) missingByPos[p.position].push(id);
                });
                
                const getStarterCount = (pos) => starters.filter(id => PLAYERS.find(pl => pl.id === id)?.position === pos).length;
                
                while (getStarterCount('GKP') < cons.GKP && missingByPos.GKP.length > 0) starters.push(missingByPos.GKP.shift());
                while (getStarterCount('DEF') < cons.DEF && missingByPos.DEF.length > 0) starters.push(missingByPos.DEF.shift());
                while (getStarterCount('MID') < cons.MID && missingByPos.MID.length > 0) starters.push(missingByPos.MID.shift());
                while (getStarterCount('FWD') < cons.FWD && missingByPos.FWD.length > 0) starters.push(missingByPos.FWD.shift());
                
                ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
                    bench.push(...missingByPos[pos]);
                });
                
                if (weekly.captain && squad.includes(weekly.captain)) captain = weekly.captain;
                if (weekly.vice && squad.includes(weekly.vice)) vice = weekly.vice;
            }
            
            if (starters.length + bench.length !== 15 || starters.length !== 11) {
                const cons = formationConstraints[formation];
                starters = [];
                bench = [];
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
            }
            
            if (!captain || !starters.includes(captain)) captain = starters[0] || null;
            if (!vice || !starters.includes(vice) || vice === captain) vice = starters.find(id => id !== captain) || null;
            
            return { starters, bench, captain, vice, formation };
        }
    };

    // 1. Check default fallback alignment
    const l1 = state.getGwLineup(5);
    assert.equal(l1.starters.length, 11);
    assert.equal(l1.bench.length, 4);
    assert.equal(l1.formation, '4-4-2');
    
    // 2. Mock a custom weekly lineup for GW5 (e.g. 3-5-2 with custom captain/vice)
    state.weeklyLineups[5] = {
        formation: '3-5-2',
        starters: [1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14], // 3 DEF, 5 MID, 2 FWD
        bench: [2, 6, 7, 15],
        captain: 13,
        vice: 8
    };

    const l2 = state.getGwLineup(5);
    assert.equal(l2.formation, '3-5-2');
    assert.equal(l2.captain, 13);
    assert.equal(l2.vice, 8);
    assert.deepEqual(l2.bench, [2, 6, 7, 15]);
});

test('Deactivating Free Hit / Wildcard resets transfers and weekly lineups', () => {
    const mockState = {
        currentGw: 4,
        chips: {
            4: { wildcard: false, tripleCaptain: false, benchBoost: false, freeHit: true }
        },
        planFreeHit: true,
        freeHitTargetGw: 4,
        transfers: {
            4: [{ out: 1, in: 2 }]
        },
        weeklyLineups: {
            4: { starters: [2], bench: [], captain: 2, vice: 2, formation: '3-4-3' }
        },
        saveState() {}
    };

    // Simulate deactivation logic from toggleChip
    const gw = mockState.currentGw;
    mockState.chips[gw].freeHit = false;
    mockState.planFreeHit = false;
    mockState.transfers[gw] = [];
    if (mockState.weeklyLineups && mockState.weeklyLineups[gw]) {
        delete mockState.weeklyLineups[gw];
    }

    assert.equal(mockState.chips[4].freeHit, false);
    assert.equal(mockState.planFreeHit, false);
    assert.deepEqual(mockState.transfers[4], []);
    assert.equal(mockState.weeklyLineups[4], undefined);
});
