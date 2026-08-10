import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetroPairs } from '../scripts/retro-backtest.js';
import { computeGwPrediction, computeBasePPG } from '../lib/predictionModel.js';

test('buildRetroPairs: joins baseline aggregate to validation-season GW rows by stable player code', () => {
    const baselineRows = [
        { code: '111', element_type: '3', minutes: '3000', starts: '35', total_points: '175', expected_goals_per_90: '0.30', expected_assists_per_90: '0.20', saves_per_90: '0' }
    ];
    const validationPlayersRows = [
        { id: '50', code: '111', element_type: '3', team: '1', now_cost: '80' }
    ];
    const validationTeamsRows = [
        { id: '1', short_name: 'ARS' },
        { id: '2', short_name: 'BHA' }
    ];
    const validationFixturesRows = [
        { event: '1', team_h: '1', team_a: '2', team_h_difficulty: '2', team_a_difficulty: '3' }
    ];
    const validationGwRows = [
        { element: '50', GW: '1', total_points: '8', minutes: '90' }
    ];

    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });

    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].actualPts, 8);
    assert.equal(pairs[0].minutesPlayed, 90);
    assert.equal(pairs[0].position, 'MID');
    assert.equal(pairs[0].price, 8.0);

    // Cross-check against calling the formula directly with the same derived inputs
    const basePPG = computeBasePPG({
        minutes: 3000, appearances: 35, totalPoints: 175, position: 'MID',
        teamShort: 'ARS', price: 8.0, isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    const expected = computeGwPrediction({
        basePPG, position: 'MID', xG90: 0.30, xA90: 0.20, saves90: 0,
        mppg: 3000 / 35, starts: 35, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 2 }
    });
    assert.equal(pairs[0].predictedPts, expected.pts);
});

test('buildRetroPairs: a validation player with no baseline-season history is treated as promoted/transferred', () => {
    const baselineRows = []; // no history at all
    const validationPlayersRows = [{ id: '99', code: '222', element_type: '4', team: '1', now_cost: '55' }];
    const validationTeamsRows = [{ id: '1', short_name: 'ARS' }, { id: '2', short_name: 'BHA' }];
    const validationFixturesRows = [{ event: '1', team_h: '1', team_a: '2', team_h_difficulty: '3', team_a_difficulty: '3' }];
    const validationGwRows = [{ element: '99', GW: '1', total_points: '2', minutes: '60' }];

    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });
    assert.equal(pairs.length, 1);

    // Cross-check against the formula directly rather than hand-computing the rounded
    // float — basePPG for a zero-minutes "promoted/transferred" FWD is the position
    // default (3.5), then the normal home-fixture/rounding rules apply on top.
    const basePPG = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0, position: 'FWD',
        teamShort: 'ARS', price: 5.5, isPromotedOrTransfer: true, manualOverridePPG: undefined
    });
    const expected = computeGwPrediction({
        basePPG, position: 'FWD', xG90: 0, xA90: 0, saves90: 0,
        mppg: 0, starts: 0, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 3 }
    });
    assert.equal(pairs[0].predictedPts, expected.pts);
});

test('buildRetroPairs: a fixture with a non-numeric team_h_difficulty is excluded for the home team only, not turned into diff: NaN', () => {
    const baselineRows = [
        { code: '111', element_type: '3', minutes: '3000', starts: '35', total_points: '175', expected_goals_per_90: '0.30', expected_assists_per_90: '0.20', saves_per_90: '0' },
        { code: '333', element_type: '3', minutes: '3000', starts: '35', total_points: '175', expected_goals_per_90: '0.30', expected_assists_per_90: '0.20', saves_per_90: '0' }
    ];
    const validationPlayersRows = [
        { id: '50', code: '111', element_type: '3', team: '1', now_cost: '80' }, // home team (ARS)
        { id: '51', code: '333', element_type: '3', team: '2', now_cost: '80' }  // away team (BHA)
    ];
    const validationTeamsRows = [
        { id: '1', short_name: 'ARS' },
        { id: '2', short_name: 'BHA' }
    ];
    // team_h_difficulty is malformed; team_a_difficulty is fine.
    const validationFixturesRows = [
        { event: '1', team_h: '1', team_a: '2', team_h_difficulty: 'N/A', team_a_difficulty: '3' }
    ];
    const validationGwRows = [
        { element: '50', GW: '1', total_points: '8', minutes: '90' },
        { element: '51', GW: '1', total_points: '6', minutes: '90' }
    ];

    const pairs = buildRetroPairs({ baselineRows, validationPlayersRows, validationTeamsRows, validationFixturesRows, validationGwRows });

    // Only the away-team (BHA) pair should be produced; the home-team (ARS) fixture
    // entry was dropped because its difficulty didn't parse, so no pair with diff: NaN
    // is ever built for it.
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].position, 'MID');
    assert.equal(pairs[0].actualPts, 6);
    assert.ok(!Number.isNaN(pairs[0].predictedPts));
});
