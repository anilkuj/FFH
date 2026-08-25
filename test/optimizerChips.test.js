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
