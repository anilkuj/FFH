import test from 'node:test';
import assert from 'node:assert/strict';
import { syncSolioDataToPlayers } from '../components/solioprojections.js';
import { solveQuantStrategy } from '../lib/quantSolver.js';

test('syncSolioDataToPlayers syncs live prPoints and fallback SOLIO data into window.PLAYERS', () => {
    global.window = {
        PLAYERS: [
            { id: 101, name: 'Bukayo Saka', web_name: 'Saka', team: 'ARS', solioPts: {} },
            { id: 102, name: 'Cole Palmer', web_name: 'Palmer', team: 'CHE', solioPts: {} }
        ]
    };

    const mockLiveData = {
        gameweek: 5,
        topProjected: [
            { name: 'Bukayo Saka', prPoints: 7.2 },
            { name: 'Palmer', prPoints: 8.1 }
        ]
    };

    syncSolioDataToPlayers(mockLiveData);

    assert.equal(global.window.PLAYERS[0].solioPts[5], 7.2);
    assert.equal(global.window.PLAYERS[1].solioPts[5], 8.1);
});

test('quantSolver incorporates prioritizeHomeGames FDR boost correctly', () => {
    const playerHomeEasy = {
        id: 9981,
        name: "Home Easy Star",
        web_name: "HomeStar",
        position: 'MID',
        team: 'ARS',
        price: 7.0,
        status: 'a',
        chanceOfPlaying: 100,
        predictions: [
            { gw: 1, pts: 5.0, diff: 1, loc: 'H' }, // Boost: (6 - 1) * 0.5 = 2.5
            { gw: 2, pts: 5.0, diff: 2, loc: 'H' }  // Boost: (6 - 2) * 0.5 = 2.0
        ]
    };

    const playerAwayEasy = {
        id: 9982,
        name: "Away Easy Star",
        web_name: "AwayStar",
        position: 'MID',
        team: 'CHE',
        price: 7.0,
        status: 'a',
        chanceOfPlaying: 100,
        predictions: [
            { gw: 1, pts: 5.0, diff: 1, loc: 'A' },
            { gw: 2, pts: 5.0, diff: 2, loc: 'A' }
        ]
    };

    const state = {
        currentGw: 1,
        prioritizeHomeGames: true,
        riskAppetite: 'moderate',
        chips: {},
        getSquadForGw() {
            return {
                starters: [playerAwayEasy.id],
                bench: [],
                squad: [playerAwayEasy.id],
                bank: 2.0,
                freeTransfers: 1
            };
        }
    };

    const result = solveQuantStrategy(state, { horizonLength: 2, prioritizeHomeGames: true });

    assert.ok(result);
    assert.ok(result.actionType);
});
