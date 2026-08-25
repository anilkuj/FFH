import test from 'node:test';
import assert from 'node:assert/strict';

// Mock getSquadForGw logic to run unit tests on reversion logic
function getSquadForGwMock({ starters, bench, squad, transfers, chips, targetGw, PLAYERS }) {
    let currentStarters = [...starters];
    let currentBench = [...bench];
    let currentSquad = [...squad];
    
    const sumCost = currentSquad.reduce((sum, id) => {
        const p = PLAYERS.find(pl => pl.id === id);
        return sum + (p ? p.price : 0);
    }, 0);
    let bank = 100.0 - sumCost;

    let freeTransfers = 0;

    for (let gw = 1; gw <= targetGw; gw++) {
        const weeklyTransfers = transfers[gw] || [];
        // If gw is not targetGw, and they played a Free Hit in gw,
        // we skip applying its transfers to the projected squad.
        if (gw === targetGw || !chips[gw]?.freeHit) {
            weeklyTransfers.forEach(tx => {
                const pOut = PLAYERS.find(p => p.id === tx.out);
                const pIn = tx.in ? PLAYERS.find(p => p.id === tx.in) : null;
                
                if (pOut) {
                    currentSquad = currentSquad.map(id => id === tx.out ? tx.in : id);
                    currentStarters = currentStarters.map(id => id === tx.out ? tx.in : id);
                    currentBench = currentBench.map(id => id === tx.out ? tx.in : id);
                    bank = bank + pOut.price - (pIn ? pIn.price : 0);
                }
            });
        }

        // Adjust free transfers for next week (starts at 1, max 5)
        if (gw < targetGw) {
            const txCount = weeklyTransfers.length;
            if (chips[gw]?.wildcard) {
                freeTransfers = 5;
            } else if (chips[gw]?.freeHit) {
                freeTransfers = Math.min(5, freeTransfers + 1);
            } else {
                freeTransfers = Math.min(5, Math.max(0, freeTransfers - txCount) + 1);
            }
        } else {
            const txCount = weeklyTransfers.length;
            if (chips[gw]?.wildcard || chips[gw]?.freeHit) {
                // No transfers consumed
            } else {
                freeTransfers = Math.max(0, freeTransfers - txCount);
            }
        }
    }

    return {
        starters: currentStarters.filter(id => id !== null),
        bench: currentBench.filter(id => id !== null),
        squad: currentSquad.filter(id => id !== null),
        bank,
        freeTransfers
    };
}

const PLAYERS = [
    { id: 1, name: 'Player A', price: 6.0 },
    { id: 2, name: 'Player B', price: 7.0 },
    { id: 3, name: 'Player C', price: 8.5 },
    { id: 4, name: 'Player D', price: 5.5 },
    { id: 5, name: 'Player E', price: 6.5 }
];

test('getSquadForGwMock: normal transfer carries over', () => {
    const state = {
        starters: [1, 2],
        bench: [],
        squad: [1, 2],
        transfers: {
            1: [],
            2: [{ out: 1, in: 3 }] // transfer out A (6.0) for C (8.5)
        },
        chips: {
            1: { wildcard: false, freeHit: false },
            2: { wildcard: false, freeHit: false },
            3: { wildcard: false, freeHit: false }
        },
        PLAYERS
    };

    const squadGw2 = getSquadForGwMock({ ...state, targetGw: 2 });
    assert.deepEqual(squadGw2.squad, [3, 2]);
    assert.equal(squadGw2.bank, 100.0 - 15.5); // 3 (8.5) + 2 (7.0) = 15.5

    const squadGw3 = getSquadForGwMock({ ...state, targetGw: 3 });
    assert.deepEqual(squadGw3.squad, [3, 2]); // carries over
});

test('getSquadForGwMock: Free Hit transfers do not carry over to future gameweeks', () => {
    const state = {
        starters: [1, 2],
        bench: [],
        squad: [1, 2],
        transfers: {
            1: [],
            2: [{ out: 1, in: 3 }], // Free Hit transfer: out A (6.0) for C (8.5)
            3: []
        },
        chips: {
            1: { wildcard: false, freeHit: false },
            2: { wildcard: false, freeHit: true },
            3: { wildcard: false, freeHit: false }
        },
        PLAYERS
    };

    // GW2 (targetGw = 2): Free Hit is active, transfers applied
    const squadGw2 = getSquadForGwMock({ ...state, targetGw: 2 });
    assert.deepEqual(squadGw2.squad, [3, 2]);
    assert.equal(squadGw2.bank, 100.0 - 15.5);

    // GW3 (targetGw = 3): Reverts to baseline (no GW2 transfer)
    const squadGw3 = getSquadForGwMock({ ...state, targetGw: 3 });
    assert.deepEqual(squadGw3.squad, [1, 2]);
    assert.equal(squadGw3.bank, 100.0 - 13.0); // 1 (6.0) + 2 (7.0) = 13.0
});

test('getSquadForGwMock: Free Hit transfers are free and carry over saved free transfers', () => {
    const state = {
        starters: [1, 2],
        bench: [],
        squad: [1, 2],
        transfers: {
            1: [],
            2: [{ out: 1, in: 3 }], // Free Hit week: 1 transfer
            3: [{ out: 1, in: 4 }]  // GW3 transfer (from original team)
        },
        chips: {
            1: { wildcard: false, freeHit: false },
            2: { wildcard: false, freeHit: true },
            3: { wildcard: false, freeHit: false }
        },
        PLAYERS
    };

    // GW1 starts at 0, GW2 has 1 FT.
    // GW2 Free Hit does not consume FT, so FT carries over and adds 1 for GW3 (total 2 FT).
    const squadGw3 = getSquadForGwMock({ ...state, targetGw: 3 });
    assert.equal(squadGw3.freeTransfers, 1); // 1 FT remaining after GW3 transfer (started at 2)
    assert.deepEqual(squadGw3.squad, [4, 2]); // GW3 transfer applied to reverted squad
});
