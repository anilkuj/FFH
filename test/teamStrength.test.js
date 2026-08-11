import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalStrengthByCode, resolveTeamStrength } from '../lib/teamStrength.js';

test('buildHistoricalStrengthByCode: parses valid rows keyed by numeric team code', () => {
    const rows = [
        { code: '3', strength_attack_home: '1340', strength_attack_away: '1390', strength_defence_home: '1270', strength_defence_away: '1320' },
        { code: '7', strength_attack_home: '1120', strength_attack_away: '1210', strength_defence_home: '1150', strength_defence_away: '1250' }
    ];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.deepEqual(byCode.get(3), { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 });
    assert.deepEqual(byCode.get(7), { attackHome: 1120, attackAway: 1210, defenceHome: 1150, defenceAway: 1250 });
});

test('buildHistoricalStrengthByCode: skips rows with non-numeric code', () => {
    const rows = [{ code: 'not-a-number', strength_attack_home: '1340', strength_attack_away: '1390', strength_defence_home: '1270', strength_defence_away: '1320' }];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.equal(byCode.size, 0);
});

test('buildHistoricalStrengthByCode: skips rows with any non-numeric strength field', () => {
    const rows = [{ code: '3', strength_attack_home: '1340', strength_attack_away: '', strength_defence_home: '1270', strength_defence_away: '1320' }];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.equal(byCode.size, 0);
});

test('resolveTeamStrength: tier 1 -- this-season non-zero values pass through unchanged', () => {
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: 1350, strengthAttackAway: 1400, strengthDefenceHome: 1280, strengthDefenceAway: 1330 },
        new Map()
    );
    assert.deepEqual(result, { strengthAttackHome: 1350, strengthAttackAway: 1400, strengthDefenceHome: 1280, strengthDefenceAway: 1330 });
});

test('resolveTeamStrength: tier 2 -- this-season all zero, falls back to historical value for the same code', () => {
    const historicalByCode = new Map([[3, { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 }]]);
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: 0, strengthAttackAway: 0, strengthDefenceHome: 0, strengthDefenceAway: 0 },
        historicalByCode
    );
    assert.deepEqual(result, { strengthAttackHome: 1340, strengthAttackAway: 1390, strengthDefenceHome: 1270, strengthDefenceAway: 1320 });
});

test('resolveTeamStrength: tier 3 -- this-season all zero, no historical match, returns explicit nulls not zeros', () => {
    const result = resolveTeamStrength(
        { code: 999, strengthAttackHome: 0, strengthAttackAway: 0, strengthDefenceHome: 0, strengthDefenceAway: 0 },
        new Map()
    );
    assert.deepEqual(result, { strengthAttackHome: null, strengthAttackAway: null, strengthDefenceHome: null, strengthDefenceAway: null });
});

test('resolveTeamStrength: a single zero mixed with otherwise-valid values still fails tier 1 (guards against .every regressing to .some)', () => {
    const historicalByCode = new Map([[3, { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 }]]);
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: 1350, strengthAttackAway: 0, strengthDefenceHome: 1280, strengthDefenceAway: 1330 },
        historicalByCode
    );
    assert.deepEqual(result, { strengthAttackHome: 1340, strengthAttackAway: 1390, strengthDefenceHome: 1270, strengthDefenceAway: 1320 });
});

test('resolveTeamStrength: non-numeric this-season fields (null/undefined/NaN) fail tier 1 and fall through', () => {
    const historicalByCode = new Map([[3, { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 }]]);
    const result = resolveTeamStrength(
        { code: 3, strengthAttackHome: null, strengthAttackAway: undefined, strengthDefenceHome: NaN, strengthDefenceAway: 1330 },
        historicalByCode
    );
    assert.deepEqual(result, { strengthAttackHome: 1340, strengthAttackAway: 1390, strengthDefenceHome: 1270, strengthDefenceAway: 1320 });
});

test('buildHistoricalStrengthByCode: a duplicate code keeps the last row (Map.set "last write wins")', () => {
    const rows = [
        { code: '3', strength_attack_home: '1000', strength_attack_away: '1000', strength_defence_home: '1000', strength_defence_away: '1000' },
        { code: '3', strength_attack_home: '1340', strength_attack_away: '1390', strength_defence_home: '1270', strength_defence_away: '1320' }
    ];
    const byCode = buildHistoricalStrengthByCode(rows);
    assert.equal(byCode.size, 1);
    assert.deepEqual(byCode.get(3), { attackHome: 1340, attackAway: 1390, defenceHome: 1270, defenceAway: 1320 });
});
