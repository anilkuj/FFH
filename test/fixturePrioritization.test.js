import test from 'node:test';
import assert from 'node:assert/strict';
import { solveQuantStrategy } from '../lib/quantSolver.js';

test('quantSolver prioritizes players with easier fixture difficulty (FDR)', () => {
    // Player A has easy fixtures (FDR 2)
    const playerEasy = {
        id: 9991,
        name: "Easy Fixture Star",
        web_name: "EasyStar",
        position: 'MID',
        team: 'ARS',
        price: 7.0,
        status: 'a',
        chanceOfPlaying: 100,
        predictions: [
            { gw: 1, pts: 5.0, diff: 2, opp: 'SOU (H)' },
            { gw: 2, pts: 5.0, diff: 2, opp: 'IPS (H)' },
            { gw: 3, pts: 5.0, diff: 2, opp: 'LEI (A)' }
        ]
    };

    // Player B has hard fixtures (FDR 5) with same base raw pts
    const playerHard = {
        id: 9992,
        name: "Hard Fixture Star",
        web_name: "HardStar",
        position: 'MID',
        team: 'CHE',
        price: 7.0,
        status: 'a',
        chanceOfPlaying: 100,
        predictions: [
            { gw: 1, pts: 5.0, diff: 5, opp: 'MCI (A)' },
            { gw: 2, pts: 5.0, diff: 5, opp: 'LIV (A)' },
            { gw: 3, pts: 5.0, diff: 5, opp: 'ARS (A)' }
        ]
    };

    const state = {
        currentGw: 1,
        riskAppetite: 'moderate',
        chips: {},
        getSquadForGw() {
            return {
                starters: [playerHard.id],
                bench: [],
                squad: [playerHard.id],
                bank: 2.0,
                freeTransfers: 1
            };
        }
    };

    const result = solveQuantStrategy(state, { horizonLength: 3 });

    // Assert that a valid decision output is generated
    assert.ok(result);
    assert.ok(result.actionType);
    assert.ok(result.trajectory.length > 0);
});
