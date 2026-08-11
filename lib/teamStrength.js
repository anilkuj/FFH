// Resolves each team's attack/defence strength through a 3-tier fallback:
// 1. This season's real strength_attack_*/strength_defence_* from FPL, if non-zero.
// 2. Last season's real value for the same team (matched by the stable `code` field,
//    the same cross-season identifier already used for players), from the archived
//    vaastav/Fantasy-Premier-League dataset -- only covers teams that were actually in
//    the Premier League last season.
// 3. Explicit null (never a fake 0) for teams in neither -- newly-promoted teams in
//    their first top-flight season. Callers must fall back to overall-strength-only
//    when they see null here, never coerce it to 0.

export const HISTORICAL_TEAMS_CSV_URL = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/2025-26/teams.csv';

/**
 * @param {Array<Object>} csvRows - Parsed rows from lib/csv.js's parseCsv() over the historical teams.csv.
 * @returns {Map<number, { attackHome: number, attackAway: number, defenceHome: number, defenceAway: number }>}
 */
export function buildHistoricalStrengthByCode(csvRows) {
    const byCode = new Map();
    csvRows.forEach(row => {
        const code = parseInt(row.code, 10);
        if (!Number.isFinite(code)) return;
        const attackHome = parseInt(row.strength_attack_home, 10);
        const attackAway = parseInt(row.strength_attack_away, 10);
        const defenceHome = parseInt(row.strength_defence_home, 10);
        const defenceAway = parseInt(row.strength_defence_away, 10);
        if (![attackHome, attackAway, defenceHome, defenceAway].every(Number.isFinite)) return;
        byCode.set(code, { attackHome, attackAway, defenceHome, defenceAway });
    });
    return byCode;
}

/**
 * @param {{ code: number, strengthAttackHome: number, strengthAttackAway: number, strengthDefenceHome: number, strengthDefenceAway: number }} team - This season's raw FPL team-strength fields.
 * @param {Map<number, { attackHome: number, attackAway: number, defenceHome: number, defenceAway: number }>} historicalByCode
 * @returns {{ strengthAttackHome: number|null, strengthAttackAway: number|null, strengthDefenceHome: number|null, strengthDefenceAway: number|null }}
 */
export function resolveTeamStrength({ code, strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway }, historicalByCode) {
    const tier1Valid = [strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway]
        .every(v => typeof v === 'number' && v !== 0);
    if (tier1Valid) {
        return { strengthAttackHome, strengthAttackAway, strengthDefenceHome, strengthDefenceAway };
    }

    const historical = historicalByCode.get(code);
    if (historical) {
        return {
            strengthAttackHome: historical.attackHome,
            strengthAttackAway: historical.attackAway,
            strengthDefenceHome: historical.defenceHome,
            strengthDefenceAway: historical.defenceAway
        };
    }

    return {
        strengthAttackHome: null,
        strengthAttackAway: null,
        strengthDefenceHome: null,
        strengthDefenceAway: null
    };
}
