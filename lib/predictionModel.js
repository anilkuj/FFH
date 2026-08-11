/**
 * Calculate a realistic points-per-game baseline for a player.
 *
 * @param {number} minutes - Minutes played this season.
 * @param {number} appearances - Estimated number of appearances (starts + partial-appearance credit).
 * @param {number} totalPoints - Total FPL points scored this season.
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Player position.
 * @param {string} teamShort - 3-letter team code (e.g. 'ARS').
 * @param {number} price - Player price in millions.
 * @param {boolean} isPromotedOrTransfer - True for newly promoted team players or mid-season transfers with no history.
 * @param {number|null|undefined} manualOverridePPG - Optional manual PPG override from ROLE_OVERRIDES.
 * @returns {number} basePPG, clamped to a position-specific realistic ceiling.
 */
export function computeBasePPG({ minutes, appearances, totalPoints, position, teamShort, price, isPromotedOrTransfer, manualOverridePPG }) {
    let basePPG = 0.5;

    if (manualOverridePPG !== undefined && manualOverridePPG !== null) {
        basePPG = manualOverridePPG;
    } else if (minutes > 500 && appearances > 0) {
        basePPG = totalPoints / appearances;
    } else if (minutes > 0 && appearances > 0) {
        // Scale the default baseline by how much they play
        const playingRatio = Math.min(1.0, minutes / 500);
        const defaultPPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
        basePPG = 0.5 + (defaultPPG - 0.5) * playingRatio;
    } else if (isPromotedOrTransfer) {
        // Newly transferred players or promoted team starters are default starters
        basePPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
    } else {
        basePPG = (price > 6.0) ? 2.0 : 0.5;
    }

    // Ceilings calibrated so elite players realistically score 50-65 pts/GW across a squad.
    // FPL historical PPG for elite players is ~5-6/game including bonuses; we cap to prevent
    // easy-fixture multipliers compounding into unrealistic 9+ XP predictions.
    const TOP_TEAMS = ['MCI', 'ARS', 'LIV', 'TOT', 'CHE', 'MUN'];
    if (position === 'GKP') {
        const minGkpPpg = TOP_TEAMS.includes(teamShort) ? 3.2 : 1.8;
        basePPG = Math.max(minGkpPpg, Math.min(4.2, basePPG));
    } else if (position === 'DEF') {
        basePPG = Math.max(1.5, Math.min(4.5, basePPG));
    } else if (position === 'MID') {
        basePPG = Math.max(1.8, Math.min(6.0, basePPG));
    } else if (position === 'FWD') {
        basePPG = Math.max(2.0, Math.min(6.0, basePPG));
    }

    return basePPG;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Attack/defence-specific gap constants operate on the historical dataset's Elo-style scale
// (~900-1400, spread ~500); overall-strength gap constants operate on FPL's 1-5 "overall" scale.
// Both tuned so a large-but-realistic gap approaches (without routinely hitting) the clamp bounds.
const K_ATTACK_SPECIFIC = 0.0006;
const K_ATTACK_OVERALL = 0.11;
const K_DEFENCE_SPECIFIC = 0.0005;
const K_DEFENCE_OVERALL = 0.1;
const AVG_CS_PROB_STRENGTH_PATH = 0.30;

const GOALS_CONCEDED_NUDGE_SCALE = 0.3;
const MAX_GOALS_CONCEDED_NUDGE = 0.2;

// MID's team-level clean-sheet signal (csAdj weight x1) is 4x smaller in magnitude than
// GKP/DEF's (csAdj weight x4). The goalsConceded90 nudge's cap (MAX_GOALS_CONCEDED_NUDGE) was
// calibrated against the GKP/DEF x4 case, so applying it unscaled to MID would let a small
// per-player differentiator rival or dominate MID's own (much smaller) fixture-based signal.
// Scaling by the same 1:4 ratio keeps the nudge proportionally consistent across positions.
const MID_GOALS_CONCEDED_NUDGE_SCALE = 0.25;

/**
 * Whether a fixture carries usable strength data on any tier -- attack/defence-specific
 * (either direction: attack-vs-opp-defence or defence-vs-opp-attack) or overall. True whenever
 * getAttackMultiplier or getCleanSheetProb would actually take a strength-based branch rather
 * than falling all the way to the legacy diff-based one, so callers can avoid double-counting
 * adjustments (like home/away advantage) that strength-based branches already account for.
 * Deliberately does not assume tier-1 and tier-2 fields are attached together -- that's an
 * assumption about how sync.js populates fixtures, not something this module should trust.
 * @param {{ ownAttackStrength?: number|null, oppDefenceStrength?: number|null, ownDefenceStrength?: number|null, oppAttackStrength?: number|null, ownStrength?: number, oppStrength?: number }} fixture
 * @returns {boolean}
 */
function fixtureHasStrengthData(fixture) {
    const hasAttackDefenceSpecific =
        (Number.isFinite(fixture.ownAttackStrength) && Number.isFinite(fixture.oppDefenceStrength)) ||
        (Number.isFinite(fixture.ownDefenceStrength) && Number.isFinite(fixture.oppAttackStrength));
    const hasOverall = Number.isFinite(fixture.ownStrength) && Number.isFinite(fixture.oppStrength);
    return hasAttackDefenceSpecific || hasOverall;
}

// -------------------------------------------------------
// Attacking Fixture Multiplier
// Prefers attack-vs-opponent-defence (both venue-matched); falls back to a generic
// overall-strength gap; falls back to the legacy diff-based step function only if even
// overall strength is missing (shouldn't happen -- sync.js always attaches it).
// -------------------------------------------------------
/**
 * @param {{ diff: number, ownAttackStrength?: number|null, oppDefenceStrength?: number|null, ownStrength?: number, oppStrength?: number }} fixture
 * @returns {number} Multiplier, clamped to [0.65, 1.30].
 */
export function getAttackMultiplier(fixture) {
    const { diff, ownAttackStrength, oppDefenceStrength, ownStrength, oppStrength } = fixture;

    if (Number.isFinite(ownAttackStrength) && Number.isFinite(oppDefenceStrength)) {
        const attackGap = oppDefenceStrength - ownAttackStrength; // positive = their defence stronger than my attack
        return clamp(1.0 - attackGap * K_ATTACK_SPECIFIC, 0.65, 1.30);
    }

    if (Number.isFinite(ownStrength) && Number.isFinite(oppStrength)) {
        const overallGap = oppStrength - ownStrength;
        return clamp(1.0 - overallGap * K_ATTACK_OVERALL, 0.65, 1.30);
    }

    // Legacy last-resort: same step function used before this phase, including the diff=1 gap.
    // Missing/malformed diff is treated as neutral (matches diff=1/diff=3 -> 1.0), not worst-case --
    // consistent with getCleanSheetProb/getExpectedSavePts's explicit guards below.
    if (!Number.isFinite(diff)) return 1.0;
    if (diff === 2) return 1.12;
    if (diff === 4) return 0.88;
    if (diff === 5) return 0.70;
    return 1.0;
}

// -------------------------------------------------------
// Clean Sheet Probability Model
// Same fallback order as getAttackMultiplier: defence-vs-opponent-attack, then overall
// strength, then the legacy diff/loc-based step function.
// -------------------------------------------------------
/**
 * @param {{ diff: number, loc: 'H'|'A', ownDefenceStrength?: number|null, oppAttackStrength?: number|null, ownStrength?: number, oppStrength?: number }} fixture
 * @returns {number} Probability, clamped to [0.02, 0.65].
 */
export function getCleanSheetProb(fixture) {
    const { diff, loc, ownDefenceStrength, oppAttackStrength, ownStrength, oppStrength } = fixture;

    if (Number.isFinite(ownDefenceStrength) && Number.isFinite(oppAttackStrength)) {
        const defenceGap = oppAttackStrength - ownDefenceStrength; // positive = their attack stronger than my defence
        return clamp(AVG_CS_PROB_STRENGTH_PATH - defenceGap * K_DEFENCE_SPECIFIC, 0.02, 0.65);
    }

    if (Number.isFinite(ownStrength) && Number.isFinite(oppStrength)) {
        const overallGap = oppStrength - ownStrength;
        return clamp(AVG_CS_PROB_STRENGTH_PATH - overallGap * K_DEFENCE_OVERALL, 0.02, 0.65);
    }

    // Legacy last-resort: same step function used before this phase.
    // Missing/malformed diff is treated the same as diff=3 (neutral/average difficulty), not
    // worst-case -- consistent with getAttackMultiplier's neutral default and getExpectedSavePts's
    // explicit guard below.
    let base;
    if (!Number.isFinite(diff)) base = 0.30;
    else if (diff <= 2) base = 0.48;
    else if (diff === 3) base = 0.30;
    else if (diff === 4) base = 0.18;
    else base = 0.08; // diff 5
    base += (loc === 'H') ? 0.05 : -0.05;
    return clamp(base, 0.02, 0.65);
}

// -------------------------------------------------------
// goalsConceded90 Clean-Sheet Nudge
// A small per-player differentiator on top of the team-level clean-sheet probability above --
// see the design spec's "Folding goalsConceded90" section for why this is additive, not a
// separate per-player probability.
// -------------------------------------------------------
/**
 * @param {number|null|undefined} playerGc90
 * @param {number|null|undefined} leagueAvgGc90
 * @returns {number} Nudge, clamped to [-0.2, 0.2]. Returns 0 if either input isn't a real number.
 */
export function computeGoalsConcededNudge(playerGc90, leagueAvgGc90) {
    if (!Number.isFinite(playerGc90) || !Number.isFinite(leagueAvgGc90)) return 0;
    const delta = leagueAvgGc90 - playerGc90; // positive = player concedes less than average = good
    return clamp(delta * GOALS_CONCEDED_NUDGE_SCALE, -MAX_GOALS_CONCEDED_NUDGE, MAX_GOALS_CONCEDED_NUDGE);
}

/**
 * League-wide average goalsConceded90 across GKP/DEF players with meaningful minutes, used as
 * the baseline for computeGoalsConcededNudge. Computed dynamically each sync, never hardcoded.
 * @param {Array<{ position: string, minutes: number, goalsConceded90: number }>} players
 * @param {number} minMinutes - Matches the existing sample-size threshold used to blend goalsConceded90 itself.
 * @returns {number|null} Average, or null if no qualifying players (never divide by zero).
 */
export function computeLeagueAverageGoalsConceded90(players, minMinutes = 450) {
    const qualifying = players.filter(p =>
        (p.position === 'GKP' || p.position === 'DEF') &&
        Number.isFinite(p.minutes) && p.minutes >= minMinutes &&
        Number.isFinite(p.goalsConceded90)
    );
    if (qualifying.length === 0) return null;
    const sum = qualifying.reduce((acc, p) => acc + p.goalsConceded90, 0);
    return sum / qualifying.length;
}

// -------------------------------------------------------
// GK Saves XP Model
// Expected saves per game depends on opposition strength:
//   tough opponents (high FDR) → more shots → more saves
//   easy opponents (low FDR)   → fewer shots → fewer saves
// FPL rule: every 3 saves = 1 point
// -------------------------------------------------------
/**
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Player position; returns 0 for anything but 'GKP'.
 * @param {number} diff - Fixture Difficulty Rating (FDR) of the opponent, 1-5.
 * @param {'H'|'A'} loc - Whether the fixture is home ('H') or away ('A').
 * @param {number} saves90 - Player's saves-per-90 rate from last season (0 if unknown).
 * @returns {number} Expected save points for the fixture.
 */
export function getExpectedSavePts({ position, diff, loc, saves90 }) {
    if (position !== 'GKP') return 0;

    // Saves-per-game expected from last season's rate, adjusted by fixture difficulty
    // Harder fixture → more shots conceded → more saves (but fewer CS)
    // Missing/malformed diff is treated the same as diff=3 (neutral/average difficulty), not
    // worst-case -- consistent with getAttackMultiplier's neutral default and getCleanSheetProb's
    // explicit guard above.
    let diffMultiplier;
    if (!Number.isFinite(diff)) diffMultiplier = 1.0;
    else if (diff <= 2) diffMultiplier = 0.65; // easy opponent → fewer shots
    else if (diff === 3) diffMultiplier = 1.0;
    else if (diff === 4) diffMultiplier = 1.30;
    else diffMultiplier = 1.60; // tough opponent → many shots

    // Home/away: playing away typically faces slightly more shots
    const locMultiplier = (loc === 'A') ? 1.10 : 0.92;

    // If the GK has saves data from last season, use it. Otherwise use a league-average default.
    const baseSaves90 = saves90 > 0 ? saves90 : 3.0;
    const expectedSavesPerGame = baseSaves90 * diffMultiplier * locMultiplier;

    // FPL: every 3 saves earns 1 bonus point
    return expectedSavesPerGame / 3;
}

/**
 * Compute a single gameweek's expected points (XP) for a player, starting from their basePPG
 * and layering on fixture-specific adjustments.
 *
 * @param {number} basePPG - Player's baseline points-per-game (see computeBasePPG).
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Player position.
 * @param {number} xG90 - Expected goals per 90 minutes.
 * @param {number} xA90 - Expected assists per 90 minutes.
 * @param {number} saves90 - Saves per 90 minutes (GKP only; ignored otherwise).
 * @param {number} mppg - Minutes per game played.
 * @param {number} starts - Number of starts this season.
 * @param {number|null|undefined} chanceOfPlaying - FPL "chance of playing next round" (0-100), or null/undefined if unknown (treated as 100).
 * @param {{ opp: string, loc: 'H'|'A', diff: number, ownStrength?: number, oppStrength?: number, ownAttackStrength?: number|null, oppDefenceStrength?: number|null, ownDefenceStrength?: number|null, oppAttackStrength?: number|null }} fixture - The gameweek fixture; opp === 'BYE' means no fixture.
 * @param {number|null|undefined} goalsConceded90 - This player's own goalsConceded90 (for the clean-sheet nudge; GKP/DEF/MID only).
 * @param {number|null|undefined} leagueAvgGoalsConceded90 - League-average goalsConceded90 baseline (see computeLeagueAverageGoalsConceded90).
 * @returns {{ pts: number, breakdown: object }} Rounded XP and a breakdown of each adjustment applied.
 */
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90 }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        const usedStrengthPath = fixtureHasStrengthData(fixture);

        // --- FDR-based scaling (strength-aware, see getAttackMultiplier) ---
        breakdown.fdrMultiplier = getAttackMultiplier(fixture);
        pts *= breakdown.fdrMultiplier;

        // --- Home/Away base adjustment ---
        // Only applied on the legacy diff-based fallback path: venue-matched strength values
        // already bake in home/away advantage, so adding this on top would double-count it.
        if (usedStrengthPath) {
            breakdown.homeAwayAdj = 0;
        } else {
            breakdown.homeAwayAdj = (fixture.loc === 'H') ? 0.35 : -0.35;
            pts += breakdown.homeAwayAdj;
        }

        if (position === 'GKP' || position === 'DEF') {
            // --- Defcon-aligned clean sheet XP contribution (strength-aware, see getCleanSheetProb) ---
            const csProb = getCleanSheetProb(fixture);
            const avgCsProb = usedStrengthPath ? AVG_CS_PROB_STRENGTH_PATH : getCleanSheetProb({ diff: 3, loc: 'H' });
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            breakdown.csAdj += computeGoalsConcededNudge(goalsConceded90, leagueAvgGoalsConceded90);
            pts += breakdown.csAdj;

            // --- GK Saves contribution ---
            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            }
        } else if (position === 'MID') {
            // MID gets 1 pt for a clean sheet (FPL rule)
            const csProb = getCleanSheetProb(fixture);
            const avgCsProb = usedStrengthPath ? AVG_CS_PROB_STRENGTH_PATH : getCleanSheetProb({ diff: 3, loc: 'H' });
            breakdown.csAdj = (csProb - avgCsProb) * 1;
            // Scaled down (see MID_GOALS_CONCEDED_NUDGE_SCALE) so the nudge stays proportionally
            // consistent with the GKP/DEF case instead of dominating MID's smaller csAdj weight.
            breakdown.csAdj += computeGoalsConcededNudge(goalsConceded90, leagueAvgGoalsConceded90) * MID_GOALS_CONCEDED_NUDGE_SCALE;
            pts += breakdown.csAdj;

            // Attacking bonus for MID/FWD based on fixture difficulty
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        } else {
            // FWD — attacking only, no CS points
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        }
    } else {
        pts = 0.0;
    }

    const chance = (chanceOfPlaying !== null && chanceOfPlaying !== undefined) ? chanceOfPlaying / 100 : 1.0;
    pts *= chance;

    // Floor at 0.8 expected points for expected playing starters to avoid showing 0.0 XP for active fixtures
    const isExpectedStarter = chance > 0.8 && (mppg >= 45 || starts >= 15);
    if (isExpectedStarter && fixture.opp !== 'BYE') {
        pts = Math.max(0.8, pts);
    }

    pts = Math.max(0, Math.round(pts * 10) / 10);

    return { pts, breakdown };
}
