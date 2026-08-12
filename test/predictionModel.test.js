import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeBasePPG,
    getCleanSheetProb,
    getExpectedSavePts,
    getAttackMultiplier,
    computeGoalsConcededNudge,
    computeLeagueAverageGoalsConceded90,
    computeGwPrediction
} from '../lib/predictionModel.js';

test('computeBasePPG: manual override wins, still gets position-clamped', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'MID', teamShort: 'BRE', price: 5.5,
        isPromotedOrTransfer: true, manualOverridePPG: 3.2
    });
    assert.equal(ppg, 3.2); // within MID clamp [1.8, 6.0]
});

test('computeBasePPG: established player uses totalPoints / appearances', () => {
    const ppg = computeBasePPG({
        minutes: 3000, appearances: 35, totalPoints: 140,
        position: 'DEF', teamShort: 'ARS', price: 6.0,
        isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    assert.equal(ppg, 4.0); // 140/35, within DEF clamp [1.5, 4.5]
});

test('computeBasePPG: promoted/transferred player with zero minutes gets position default', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'FWD', teamShort: 'SUN', price: 5.0,
        isPromotedOrTransfer: true, manualOverridePPG: undefined
    });
    assert.equal(ppg, 3.5); // FWD default, within FWD clamp [2.0, 6.0]
});

test('computeBasePPG: unknown non-promoted player with zero minutes falls to price-based floor', () => {
    const ppg = computeBasePPG({
        minutes: 0, appearances: 0, totalPoints: 0,
        position: 'MID', teamShort: 'EVE', price: 4.5,
        isPromotedOrTransfer: false, manualOverridePPG: undefined
    });
    assert.equal(ppg, 1.8); // price <= 6.0 -> 0.5, clamped up to MID floor 1.8
});

test('getCleanSheetProb: legacy diff/loc fallback -- easy home fixture beats hard away fixture (no strength data)', () => {
    assert.equal(getCleanSheetProb({ diff: 2, loc: 'H' }), 0.53);
    assert.equal(getCleanSheetProb({ diff: 5, loc: 'A' }), 0.03);
});

test('getCleanSheetProb: attack/defence-specific path -- strong defence vs weak attack beats weak defence vs strong attack', () => {
    const strongDefence = getCleanSheetProb({ diff: 3, loc: 'H', ownDefenceStrength: 1320, oppAttackStrength: 1040 });
    const weakDefence = getCleanSheetProb({ diff: 3, loc: 'H', ownDefenceStrength: 1040, oppAttackStrength: 1340 });
    assert.ok(strongDefence > weakDefence);
    assert.ok(strongDefence <= 0.70 && strongDefence >= 0.02);
    assert.ok(weakDefence <= 0.70 && weakDefence >= 0.02);
});

test('getCleanSheetProb: overall-strength-only fallback when attack/defence data is missing but overall is present', () => {
    const easy = getCleanSheetProb({ diff: 3, loc: 'H', ownStrength: 5, oppStrength: 2 });
    const hard = getCleanSheetProb({ diff: 3, loc: 'H', ownStrength: 2, oppStrength: 5 });
    assert.ok(easy > hard);
});

test('getAttackMultiplier: legacy diff fallback -- documents the diff=1/diff=3 gap (no strength data)', () => {
    assert.equal(getAttackMultiplier({ diff: 1 }), 1.0);
    assert.equal(getAttackMultiplier({ diff: 3 }), 1.0);
    assert.equal(getAttackMultiplier({ diff: 2 }), 1.12);
    assert.equal(getAttackMultiplier({ diff: 4 }), 0.88);
    assert.equal(getAttackMultiplier({ diff: 5 }), 0.70);
});

test('getAttackMultiplier: attack/defence-specific path -- strong attack vs weak defence beats weak attack vs strong defence', () => {
    const easy = getAttackMultiplier({ diff: 3, ownAttackStrength: 1390, oppDefenceStrength: 1040 });
    const hard = getAttackMultiplier({ diff: 3, ownAttackStrength: 1040, oppDefenceStrength: 1390 });
    assert.ok(easy > hard);
    assert.ok(easy <= 2.6 && easy >= 0.3);
    assert.ok(hard <= 2.6 && hard >= 0.3);
});

test('getAttackMultiplier: extreme overall-strength mismatch (e.g. a top team at home vs a newly-promoted away side) produces a meaningfully bigger swing than a moderate gap, not just a marginal one', () => {
    const extreme = getAttackMultiplier({ diff: 4, ownStrength: 4, oppStrength: 2 }); // e.g. Arsenal vs Coventry
    const moderate = getAttackMultiplier({ diff: 3, ownStrength: 4, oppStrength: 3 }); // one level apart
    assert.equal(extreme, 1.4);
    assert.equal(moderate, 1.2);
    assert.ok(extreme > moderate); // extreme mismatch should differentiate meaningfully more than a mild one
});

test('getAttackMultiplier: real ARS @ AVL GW2 case -- overall strength disagrees with FPL official diff, and we side with strength', () => {
    // FPL's official diff for this fixture is 4 (hard). But strength_overall_away(ARS)=5 >
    // strength_overall_home(AVL)=3 -- the new formula is expected to rate it easier than the
    // old diff-based one, on purpose (see spec's "Real data constraint" section).
    const legacyMultiplier = getAttackMultiplier({ diff: 4 });
    const strengthMultiplier = getAttackMultiplier({ diff: 4, ownStrength: 5, oppStrength: 3 });
    assert.ok(strengthMultiplier > legacyMultiplier);
});

test('getExpectedSavePts: only applies to GKP', () => {
    assert.equal(getExpectedSavePts({ position: 'MID', diff: 5, loc: 'A', saves90: 3.6 }), 0);
    const gkSaves = getExpectedSavePts({ position: 'GKP', diff: 5, loc: 'A', saves90: 3.6 });
    assert.equal(Math.round(gkSaves * 1000) / 1000, 2.112);
});

test('computeGoalsConcededNudge: player better than league average gets a positive nudge, clamped', () => {
    assert.equal(computeGoalsConcededNudge(1.0, 1.5), 0.15); // (1.5-1.0)*0.3 = 0.15, under the 0.2 cap
    assert.equal(computeGoalsConcededNudge(0.0, 2.0), 0.2); // (2.0-0.0)*0.3 = 0.6, clamped to 0.2
});

test('computeGoalsConcededNudge: player worse than league average gets a negative nudge, clamped', () => {
    assert.equal(computeGoalsConcededNudge(3.0, 1.5), -0.2); // (1.5-3.0)*0.3 = -0.45, clamped to -0.2
});

test('computeGoalsConcededNudge: non-numeric inputs return 0, never coerce null/undefined', () => {
    assert.equal(computeGoalsConcededNudge(null, 1.5), 0);
    assert.equal(computeGoalsConcededNudge(1.5, undefined), 0);
});

test('computeLeagueAverageGoalsConceded90: averages only GKP/DEF with meaningful minutes', () => {
    const players = [
        { position: 'GKP', minutes: 900, goalsConceded90: 1.0 },
        { position: 'DEF', minutes: 900, goalsConceded90: 2.0 },
        { position: 'MID', minutes: 900, goalsConceded90: 0.5 }, // excluded: not GKP/DEF
        { position: 'DEF', minutes: 100, goalsConceded90: 5.0 }  // excluded: below minMinutes
    ];
    assert.equal(computeLeagueAverageGoalsConceded90(players, 450), 1.5); // (1.0 + 2.0) / 2
});

test('computeLeagueAverageGoalsConceded90: no qualifying players returns null, never divides by zero', () => {
    assert.equal(computeLeagueAverageGoalsConceded90([], 450), null);
});

test('computeGwPrediction: MID, easy home fixture with attacking output (legacy fallback path, unchanged from before this phase)', () => {
    const { pts } = computeGwPrediction({
        basePPG: 4.0, position: 'MID', xG90: 0.3, xA90: 0.2, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'BHA', loc: 'H', diff: 2 }
    });
    assert.equal(pts, 5.4);
});

test('computeGwPrediction: GKP, hard away fixture leans on saves, not clean sheet (legacy fallback path, unchanged from before this phase)', () => {
    const { pts } = computeGwPrediction({
        basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.6,
        mppg: 90, starts: 25, chanceOfPlaying: 100,
        fixture: { opp: 'MCI', loc: 'A', diff: 5 }
    });
    assert.equal(pts, 2.9);
});

test('computeGwPrediction: BYE gameweek always scores 0', () => {
    const { pts } = computeGwPrediction({
        basePPG: 5.0, position: 'FWD', xG90: 0.5, xA90: 0.3, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'BYE', loc: 'H', diff: 3 }
    });
    assert.equal(pts, 0);
});

test('computeGwPrediction: 0% chance of playing always scores 0', () => {
    const { pts } = computeGwPrediction({
        basePPG: 6.0, position: 'FWD', xG90: 0.5, xA90: 0.3, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 0,
        fixture: { opp: 'BOU', loc: 'H', diff: 2 }
    });
    assert.equal(pts, 0);
});

test('computeGwPrediction: documents the current diff=1/diff=3 gap (no FDR bonus at diff=1, legacy fallback path only)', () => {
    const base = { basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100 };
    const diff1 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 1 } });
    const diff3 = computeGwPrediction({ ...base, fixture: { opp: 'X', loc: 'H', diff: 3 } });
    assert.equal(diff1.breakdown.fdrMultiplier, diff3.breakdown.fdrMultiplier);
});

test('computeGwPrediction: strength-based path drops the flat home/away adjustment entirely', () => {
    const { breakdown } = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'AVL', loc: 'A', diff: 4, ownStrength: 5, oppStrength: 3 }
    });
    assert.equal(breakdown.homeAwayAdj, 0);
});

test('computeGwPrediction: goalsConceded90 nudge shifts DEF clean-sheet points for an above-average defender', () => {
    const fixture = { opp: 'AVL', loc: 'A', diff: 4, ownStrength: 5, oppStrength: 3 };
    const withoutNudge = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100, fixture
    });
    const withNudge = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100, fixture,
        goalsConceded90: 0.5, leagueAvgGoalsConceded90: 1.5
    });
    assert.ok(withNudge.pts > withoutNudge.pts);
});

test('computeGwPrediction: tier-1-only strength data (attack/defence-specific, no overall) still drops the flat home/away adjustment', () => {
    // No ownStrength/oppStrength (tier-2) here, only the defence-vs-opponent-attack fields
    // getCleanSheetProb's own tier-1 branch looks for. usedStrengthPath must not be blind to this.
    const { breakdown } = computeGwPrediction({
        basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0,
        mppg: 90, starts: 20, chanceOfPlaying: 100,
        fixture: { opp: 'AVL', loc: 'A', diff: 4, ownDefenceStrength: 1320, oppAttackStrength: 1040 }
    });
    assert.equal(breakdown.homeAwayAdj, 0);
});

test('getAttackMultiplier: missing/non-numeric diff falls back to neutral (1.0), not worst-case', () => {
    assert.equal(getAttackMultiplier({ diff: undefined }), 1.0);
    assert.equal(getAttackMultiplier({ diff: NaN }), 1.0);
    assert.equal(getAttackMultiplier({}), 1.0);
});

test('getCleanSheetProb: missing/non-numeric diff falls back to the same neutral fixture-difficulty as diff=3, not worst-case', () => {
    assert.equal(getCleanSheetProb({ diff: undefined, loc: 'H' }), getCleanSheetProb({ diff: 3, loc: 'H' }));
    assert.equal(getCleanSheetProb({ diff: NaN, loc: 'A' }), getCleanSheetProb({ diff: 3, loc: 'A' }));
});

test('getExpectedSavePts: missing/non-numeric diff falls back to the same neutral fixture-difficulty as diff=3, not worst-case', () => {
    const missing = getExpectedSavePts({ position: 'GKP', diff: undefined, loc: 'H', saves90: 3.0 });
    const neutral = getExpectedSavePts({ position: 'GKP', diff: 3, loc: 'H', saves90: 3.0 });
    assert.equal(missing, neutral);
});

test('computeGwPrediction: player-scoring multiplier is dampened relative to getAttackMultiplier\'s wider team-level range, preventing unrealistic single-GW spikes', () => {
    // At the current PLAYER_ATTACK_MULTIPLIER_MAX (2.0), the overall-strength fallback path's own
    // max possible raw value (a full 4-point gap on the 1-5 scale, K_ATTACK_OVERALL=0.20) is only
    // 1.8 -- it can no longer exceed this ceiling at all. Only the attack/defence-specific path
    // (raw range up to 2.6) still can, for a genuinely extreme real matchup: an elite attack vs a
    // truly poor defence.
    const fixture = { opp: 'WEAK', loc: 'H', diff: 2, ownAttackStrength: 1390, oppDefenceStrength: 1000 };
    const rawTeamLevelMultiplier = getAttackMultiplier(fixture);
    assert.equal(rawTeamLevelMultiplier, 2.17); // the wide range ticker.js correctly uses as-is

    const { pts, breakdown } = computeGwPrediction({
        basePPG: 6.0, position: 'FWD', xG90: 0.6, xA90: 0.3, saves90: 0,
        mppg: 90, starts: 30, chanceOfPlaying: 100, fixture
    });
    assert.ok(breakdown.fdrMultiplier < rawTeamLevelMultiplier); // player-scoring value is dampened below the raw team-level value
    assert.equal(breakdown.fdrMultiplier, 2.0);
    // basePPG(6.0) * dampened fdrMultiplier(2.0) = 12.0, plus this fixture's diff:2 FWD attacking
    // bonus (xgiAdj = (xG90+xA90)*0.8 = 0.72, independent of the fdrMultiplier clamp) = 12.72 -> 12.7.
    // Still below the undampened 13.74 (basePPG * raw 2.17 + xgiAdj), demonstrating the fix still
    // does something even at the higher ceiling -- though the accepted tradeoff (see
    // PLAYER_ATTACK_MULTIPLIER_MAX's comment) is that 12.7 itself now exceeds the original "12+ is
    // unrealistic" line for the most extreme real fixtures, a deliberate choice to hit the
    // season-pace target.
    assert.equal(pts, 12.7);
});

test('computeGwPrediction: goalsConceded90 nudge is scaled down for MID relative to GKP/DEF (matches the 1:4 csAdj weight ratio)', () => {
    const fixture = { opp: 'AVL', loc: 'A', diff: 4, ownStrength: 5, oppStrength: 3 };
    const base = { basePPG: 4.0, xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture };

    const defWithout = computeGwPrediction({ ...base, position: 'DEF' });
    const defWith = computeGwPrediction({ ...base, position: 'DEF', goalsConceded90: 0.5, leagueAvgGoalsConceded90: 1.5 });
    const midWithout = computeGwPrediction({ ...base, position: 'MID' });
    const midWith = computeGwPrediction({ ...base, position: 'MID', goalsConceded90: 0.5, leagueAvgGoalsConceded90: 1.5 });

    const defNudgeEffect = defWith.breakdown.csAdj - defWithout.breakdown.csAdj;
    const midNudgeEffect = midWith.breakdown.csAdj - midWithout.breakdown.csAdj;

    assert.ok(midNudgeEffect > 0); // still a positive nudge in the right direction
    assert.ok(midNudgeEffect < defNudgeEffect); // but proportionally smaller than GKP/DEF's
    assert.equal(Math.round(midNudgeEffect * 10000) / 10000, Math.round(defNudgeEffect * 0.25 * 10000) / 10000);
});
