import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStartProbability, detectDisplacementRisk } from '../lib/startProbability.js';

test('computeStartProbability: official status "i" short-circuits to 0 regardless of anything else', () => {
    const result = computeStartProbability({
        officialStatus: 'i', officialChanceOfPlaying: null,
        recentWindow: { starts: 6, games: 6 }, priorSeasonRate: 0.9,
        price: 12.0, ownership: 40, position: 'FWD'
    });
    assert.equal(result.startProbability, 0);
    assert.equal(result.dataConfidence, 'high');
});

test('computeStartProbability: official status "s" (suspended) short-circuits to 0', () => {
    const result = computeStartProbability({
        officialStatus: 's', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 5.0, ownership: 1.0, position: 'DEF'
    });
    assert.equal(result.startProbability, 0);
});

test('computeStartProbability: official status "u" (unavailable, e.g. left the club) short-circuits to 0', () => {
    const result = computeStartProbability({
        officialStatus: 'u', officialChanceOfPlaying: null,
        recentWindow: { starts: 6, games: 6 }, priorSeasonRate: 0.9,
        price: 8.0, ownership: 10, position: 'FWD'
    });
    assert.equal(result.startProbability, 0);
    assert.equal(result.dataConfidence, 'high');
    assert.equal(result.source, 'official-unavailable');
});

test('computeStartProbability: officialChanceOfPlaying === 0 short-circuits to 0 even with status "a"', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: 0,
        recentWindow: { starts: 5, games: 5 }, priorSeasonRate: 0.8,
        price: 8.0, ownership: 10, position: 'MID'
    });
    assert.equal(result.startProbability, 0);
});

test('computeStartProbability: trusts a full recent window (>= 3 games), scaled by officialChanceOfPlaying', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: 80,
        recentWindow: { starts: 3, games: 4 }, priorSeasonRate: 0.9,
        price: 7.0, ownership: 5, position: 'MID'
    });
    // rate = 3/4 = 0.75; 0.75 * 0.8 = 0.6
    assert.equal(result.startProbability, 0.6);
    assert.equal(result.dataConfidence, 'high');
    assert.equal(result.source, 'recent-window');
});

test('computeStartProbability: blends recent window (1-2 games) with prior-season rate', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 2, games: 2 }, priorSeasonRate: 0.4,
        price: 6.0, ownership: 3, position: 'MID'
    });
    // weight = 2/3; recentRate = 1.0; blended = (2/3 * 1.0) + (1/3 * 0.4) = 0.8
    assert.equal(result.startProbability, 0.8);
    assert.equal(result.dataConfidence, 'medium');
    assert.equal(result.source, 'blended');
});

test('computeStartProbability: zero current-team games, but has prior-season rate -> uses it as-is', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: 0.65,
        price: 6.0, ownership: 3, position: 'MID'
    });
    assert.equal(result.startProbability, 0.65);
    assert.equal(result.dataConfidence, 'medium');
    assert.equal(result.source, 'prior-season');
});

test('computeStartProbability: no history anywhere, high price -> generic prior 0.75', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 8.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.75);
    assert.equal(result.dataConfidence, 'low');
    assert.equal(result.source, 'generic-prior');
});

test('computeStartProbability: no history anywhere, low price/ownership -> generic prior 0.3', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.3);
});

test('computeStartProbability: malformed/undefined recentWindow does not throw, falls through to generic prior', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: undefined, priorSeasonRate: null,
        price: 8.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.75);
    assert.equal(result.dataConfidence, 'low');
    assert.equal(result.source, 'generic-prior');
});

test('computeStartProbability: 1-2 recent-team games with no prior-season rate deliberately routes to generic prior, discarding the partial window', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 2, games: 2 }, priorSeasonRate: null,
        price: 8.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.75);
    assert.equal(result.dataConfidence, 'low');
    assert.equal(result.source, 'generic-prior');
});

test('computeStartProbability: generic prior price threshold is position-aware (GKP/DEF cheaper than MID/FWD)', () => {
    const def = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.5, ownership: 0.5, position: 'DEF'
    });
    const mid = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.5, ownership: 0.5, position: 'MID'
    });
    assert.equal(def.startProbability, 0.75); // 4.5 >= DEF threshold (4.5)
    assert.equal(mid.startProbability, 0.3);  // 4.5 < MID threshold (5.5)
});

test('detectDisplacementRisk: fires when a new arrival has a meaningfully higher start probability at the same team/position', () => {
    const players = [
        { code: 1, name: 'Old Def', team: 'ARS', position: 'DEF', startProbability: 0.5, isNewToCurrentTeam: false },
        { code: 2, name: 'New Def', team: 'ARS', position: 'DEF', startProbability: 0.8, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.deepEqual(result[1], { threatenedByCode: 2, threatenedByName: 'New Def', gap: 0.3 });
    assert.equal(result[2], undefined); // the new arrival itself isn't "displaced"
});

test('detectDisplacementRisk: does not fire for normal squad depth (gap below threshold)', () => {
    const players = [
        { code: 1, name: 'Player A', team: 'ARS', position: 'DEF', startProbability: 0.5, isNewToCurrentTeam: false },
        { code: 2, name: 'Player B', team: 'ARS', position: 'DEF', startProbability: 0.55, isNewToCurrentTeam: false }
    ];
    assert.deepEqual(detectDisplacementRisk(players), {});
});

test('detectDisplacementRisk: does not fire across different positions or teams', () => {
    const players = [
        { code: 1, name: 'Player A', team: 'ARS', position: 'DEF', startProbability: 0.3, isNewToCurrentTeam: false },
        { code: 2, name: 'Player B', team: 'ARS', position: 'MID', startProbability: 0.9, isNewToCurrentTeam: true },
        { code: 3, name: 'Player C', team: 'CHE', position: 'DEF', startProbability: 0.9, isNewToCurrentTeam: true }
    ];
    assert.deepEqual(detectDisplacementRisk(players), {});
});

test('detectDisplacementRisk: picks the biggest threat when multiple new arrivals qualify', () => {
    const players = [
        { code: 1, name: 'Old Mid', team: 'ARS', position: 'MID', startProbability: 0.4, isNewToCurrentTeam: false },
        { code: 2, name: 'New Mid A', team: 'ARS', position: 'MID', startProbability: 0.6, isNewToCurrentTeam: true },
        { code: 3, name: 'New Mid B', team: 'ARS', position: 'MID', startProbability: 0.75, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.equal(result[1].threatenedByCode, 3);
    assert.equal(Math.round(result[1].gap * 100) / 100, 0.35);
});
