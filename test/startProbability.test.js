import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStartProbability, detectDisplacementRisk, detectPositionalVacancy } from '../lib/startProbability.js';

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

test('detectDisplacementRisk: a player with startProbability null is never flagged as displaced (failed computation, not a real 0%)', () => {
    const players = [
        { code: 1, name: 'Failed Player', team: 'ARS', position: 'DEF', startProbability: null, isNewToCurrentTeam: false },
        { code: 2, name: 'New Signing', team: 'ARS', position: 'DEF', startProbability: 0.8, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.equal(result[1], undefined);
});

test('detectDisplacementRisk: a player with startProbability null never counts as a threat to a teammate', () => {
    const players = [
        { code: 1, name: 'Old Def', team: 'ARS', position: 'DEF', startProbability: 0.5, isNewToCurrentTeam: false },
        { code: 2, name: 'New Def (failed calc)', team: 'ARS', position: 'DEF', startProbability: null, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.equal(result[1], undefined); // null "threat" must not wrongly trigger a flag
    assert.equal(result[2], undefined);
});

test('detectPositionalVacancy: boosts the highest-existing-probability teammate when a real starter is ruled out', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Backup A', team: 'ARS', position: 'DEF', startProbability: 0.6, officialStatus: 'a', historicalStartRate: 0.6 },
        { code: 3, name: 'Backup B', team: 'ARS', position: 'DEF', startProbability: 0.3, officialStatus: 'a', historicalStartRate: 0.3 }
    ];
    const result = detectPositionalVacancy(players);
    // Backup A had the higher existing startProbability -- they're the beneficiary, not Backup B.
    assert.equal(result[2].boostedFrom, 0.6);
    // 60% of the gap to the vacated player's historicalStartRate (0.9): 0.6 + (0.9-0.6)*0.6 = 0.78
    assert.equal(result[2].boostedTo, 0.78);
    assert.equal(result[2].vacatedByCode, 1);
    assert.equal(result[3], undefined); // the lower-probability backup doesn't also get boosted
});

test('detectPositionalVacancy: does not fire for a fringe player\'s injury (historicalStartRate below threshold)', () => {
    const players = [
        { code: 1, name: 'Fringe Player', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.2 },
        { code: 2, name: 'Backup', team: 'ARS', position: 'DEF', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 }
    ];
    assert.deepEqual(detectPositionalVacancy(players), {});
});

test('detectPositionalVacancy: never boosts past the ceiling', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.99 },
        { code: 2, name: 'Backup', team: 'ARS', position: 'DEF', startProbability: 0.7, officialStatus: 'a', historicalStartRate: 0.7 }
    ];
    const result = detectPositionalVacancy(players);
    // 0.7 + (0.99-0.7)*0.6 = 0.874, which exceeds the 0.85 ceiling -- confirms the clamp actually
    // engages here, not just coincidentally passes because the raw value happened to be under it.
    assert.ok(result[2].boostedTo <= 0.85);
    assert.equal(result[2].boostedTo, 0.85);
});

test('detectPositionalVacancy: does not fire across different positions or teams', () => {
    const players = [
        { code: 1, name: 'Injured DEF', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'MID teammate', team: 'ARS', position: 'MID', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 },
        { code: 3, name: 'DEF other team', team: 'CHE', position: 'DEF', startProbability: 0.5, officialStatus: 'a', historicalStartRate: 0.5 }
    ];
    assert.deepEqual(detectPositionalVacancy(players), {});
});

test('detectPositionalVacancy: a player with null startProbability is never picked as the beneficiary', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Failed calc', team: 'ARS', position: 'DEF', startProbability: null, officialStatus: 'a', historicalStartRate: null },
        { code: 3, name: 'Valid backup', team: 'ARS', position: 'DEF', startProbability: 0.4, officialStatus: 'a', historicalStartRate: 0.4 }
    ];
    const result = detectPositionalVacancy(players);
    assert.equal(result[3].boostedFrom, 0.4);
    assert.equal(result[2], undefined);
});

test('detectPositionalVacancy: never DECREASES the beneficiary, even when their own startProbability already exceeds the vacated player\'s historicalStartRate', () => {
    const players = [
        { code: 1, name: 'Marginal Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.65 },
        { code: 2, name: 'Hot Backup', team: 'ARS', position: 'DEF', startProbability: 0.75, officialStatus: 'a', historicalStartRate: 0.75 }
    ];
    const result = detectPositionalVacancy(players);
    // Without a floor, boostedTo = 0.75 + (0.65-0.75)*0.6 = 0.69 -- LOWER than the beneficiary's
    // starting 0.75. The floor must clamp this back up to at least boostedFrom.
    assert.ok(result[2].boostedTo >= result[2].boostedFrom, `boostedTo (${result[2].boostedTo}) must never be below boostedFrom (${result[2].boostedFrom})`);
    assert.equal(result[2].boostedFrom, 0.75);
    assert.equal(result[2].boostedTo, 0.75);
});

test('detectPositionalVacancy: officialChanceOfPlaying === 0 counts as vacated even when officialStatus is still "a"', () => {
    const players = [
        { code: 1, name: 'Ruled Out This Round', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'a', officialChanceOfPlaying: 0, historicalStartRate: 0.9 },
        { code: 2, name: 'Backup', team: 'ARS', position: 'DEF', startProbability: 0.5, officialStatus: 'a', officialChanceOfPlaying: 100, historicalStartRate: 0.5 }
    ];
    const result = detectPositionalVacancy(players);
    // 0.5 + (0.9-0.5)*0.6 = 0.74
    assert.equal(result[2].boostedFrom, 0.5);
    assert.equal(result[2].boostedTo, 0.74);
    assert.equal(result[2].vacatedByCode, 1);
});

test('detectPositionalVacancy: a player with officialChanceOfPlaying === 0 is excluded as a beneficiary candidate (they are unavailable, not a fit replacement)', () => {
    const players = [
        { code: 1, name: 'Injured Starter', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        // historicalStartRate 0.9 also makes this player itself a qualifying "vacated" starter --
        // both 1 and 2 are unavailable-and-vacating here, so player 3 ends up the sole beneficiary
        // candidate against two vacancies. With grouped pairing, ties in historicalStartRate are
        // resolved by stable sort (input order), so player 1 -- listed first -- is paired with the
        // sole candidate; player 2's vacancy has no remaining candidate to pair with.
        { code: 2, name: 'Also Ruled Out', team: 'ARS', position: 'DEF', startProbability: 0.9, officialStatus: 'a', officialChanceOfPlaying: 0, historicalStartRate: 0.9 },
        { code: 3, name: 'Fit Backup', team: 'ARS', position: 'DEF', startProbability: 0.4, officialStatus: 'a', officialChanceOfPlaying: 100, historicalStartRate: 0.4 }
    ];
    const result = detectPositionalVacancy(players);
    assert.equal(result[2], undefined); // 0% chance of playing must not be picked despite the higher startProbability
    assert.equal(result[3].boostedFrom, 0.4);
    assert.equal(result[3].vacatedByCode, 1);
});

test('detectPositionalVacancy: two simultaneous vacancies at the same position pair with the top-2 candidates by existing probability', () => {
    const players = [
        { code: 1, name: 'Injured Starter A', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Injured Starter B', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.85 },
        { code: 3, name: 'Top Backup', team: 'ARS', position: 'DEF', startProbability: 0.6, officialStatus: 'a', historicalStartRate: 0.6 },
        { code: 4, name: 'Second Backup', team: 'ARS', position: 'DEF', startProbability: 0.3, officialStatus: 'a', historicalStartRate: 0.3 }
    ];
    const result = detectPositionalVacancy(players);
    // Biggest vacancy (player 1, rate 0.9) pairs with the top candidate (player 3, prob 0.6).
    assert.equal(result[3].boostedFrom, 0.6);
    assert.equal(result[3].vacatedByCode, 1);
    // 0.6 + (0.9-0.6)*0.6 = 0.78
    assert.equal(result[3].boostedTo, 0.78);
    // Second vacancy (player 2, rate 0.85) pairs with the second candidate (player 4, prob 0.3) --
    // this is the real fix: player 4 gets a genuine boost instead of getting nothing while player 3
    // is boosted twice (or the second vacancy is a no-op).
    assert.equal(result[4].boostedFrom, 0.3);
    assert.equal(result[4].vacatedByCode, 2);
    // 0.3 + (0.85-0.3)*0.6 = 0.63
    assert.equal(result[4].boostedTo, 0.63);
});

test('detectPositionalVacancy: more vacancies than candidates only boosts the single best candidate, paired with the bigger vacancy', () => {
    const players = [
        { code: 1, name: 'Injured Starter A', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.9 },
        { code: 2, name: 'Injured Starter B', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', historicalStartRate: 0.85 },
        { code: 3, name: 'Only fit DEF', team: 'ARS', position: 'DEF', startProbability: 0.3, officialStatus: 'a', historicalStartRate: 0.3 }
    ];
    const result = detectPositionalVacancy(players);
    // Only one candidate exists, so it pairs with the bigger (more severe) vacancy, player 1.
    assert.equal(result[3].boostedFrom, 0.3);
    assert.equal(result[3].vacatedByCode, 1);
    // The second, less severe vacancy (player 2) simply has no beneficiary -- not an error.
    assert.equal(Object.keys(result).length, 1);
});

test('detectPositionalVacancy: candidates already at/above the ceiling are skipped so the boost reaches a genuine backup', () => {
    // Real scenario: Arsenal loses both starting CBs at once. Hincapie and Gabriel are already
    // near/above the 0.85 ceiling -- boosting them further would be a no-op -- so the naive top-2
    // pairing would waste both vacancies on them while Mosquera, a genuine third-choice option,
    // never gets reached. The fix filters out already-certain candidates before ranking/pairing.
    const players = [
        { code: 1, name: 'Vacated A (bigger loss)', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', officialChanceOfPlaying: 0, historicalStartRate: 0.97 },
        { code: 2, name: 'Vacated B', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', officialChanceOfPlaying: 0, historicalStartRate: 0.9 },
        { code: 3, name: 'Already-certain A', team: 'ARS', position: 'DEF', startProbability: 0.99, officialStatus: 'a', historicalStartRate: 0.99 },
        { code: 4, name: 'Already-certain B', team: 'ARS', position: 'DEF', startProbability: 0.93, officialStatus: 'a', historicalStartRate: 0.93 },
        { code: 5, name: 'Genuine Backup', team: 'ARS', position: 'DEF', startProbability: 0.6, officialStatus: 'a', historicalStartRate: 0.6 }
    ];
    const result = detectPositionalVacancy(players);
    assert.equal(result[3], undefined); // already-certain players never get touched
    assert.equal(result[4], undefined);
    assert.equal(result[5].boostedFrom, 0.6);
    assert.equal(result[5].vacatedByCode, 1); // paired with the bigger vacancy
    assert.ok(result[5].boostedTo > 0.6);
});

test('detectPositionalVacancy: a genuine vacancy with no eligible candidate (everyone already at/above the ceiling) silently no-ops', () => {
    const players = [
        { code: 1, name: 'Vacated', team: 'ARS', position: 'DEF', startProbability: 0, officialStatus: 'i', officialChanceOfPlaying: 0, historicalStartRate: 0.9 },
        { code: 2, name: 'Already-certain A', team: 'ARS', position: 'DEF', startProbability: 0.99, officialStatus: 'a', historicalStartRate: 0.99 },
        { code: 3, name: 'Already-certain B', team: 'ARS', position: 'DEF', startProbability: 0.9, officialStatus: 'a', historicalStartRate: 0.9 }
    ];
    // No candidate is below VACANCY_BOOST_CEILING (0.85) -- there's no genuine backup to boost, and
    // boosting an already-near-certain player would be a no-op anyway, so this should return {}
    // rather than throw or produce a spurious entry.
    assert.deepEqual(detectPositionalVacancy(players), {});
});
