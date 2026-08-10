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

// -------------------------------------------------------
// Clean Sheet Probability Model (mirrors Defcon logic)
// Used to project CS contribution to XP for GKP/DEF/MID
// -------------------------------------------------------
/**
 * @param {number} diff - Fixture Difficulty Rating (FDR) of the opponent, 1-5 (1 = easiest, 5 = hardest).
 * @param {'H'|'A'} loc - Whether the fixture is home ('H') or away ('A').
 * @returns {number} Estimated clean sheet probability, clamped to [0.02, 0.65].
 */
export function getCleanSheetProb(diff, loc) {
    // Base clean sheet % derived from FDR (opponent strength)
    let base;
    if (diff <= 2) base = 0.48;
    else if (diff === 3) base = 0.30;
    else if (diff === 4) base = 0.18;
    else base = 0.08; // diff 5

    // Home advantage shifts the odds
    base += (loc === 'H') ? 0.05 : -0.05;
    return Math.max(0.02, Math.min(0.65, base));
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
    let diffMultiplier;
    if (diff <= 2) diffMultiplier = 0.65; // easy opponent → fewer shots
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
 * @param {{ opp: string, loc: 'H'|'A', diff: number }} fixture - The gameweek fixture; opp === 'BYE' means no fixture.
 * @returns {{ pts: number, breakdown: object }} Rounded XP and a breakdown of each adjustment applied.
 */
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        // --- FDR-based scaling ---
        // Using conservative multipliers to avoid stacking with xGI and home/away bonuses.
        if (fixture.diff === 2) breakdown.fdrMultiplier = 1.12;
        else if (fixture.diff === 4) breakdown.fdrMultiplier = 0.88;
        else if (fixture.diff === 5) breakdown.fdrMultiplier = 0.70;
        pts *= breakdown.fdrMultiplier;

        // --- Home/Away base adjustment ---
        breakdown.homeAwayAdj = (fixture.loc === 'H') ? 0.35 : -0.35;
        pts += breakdown.homeAwayAdj;

        if (position === 'GKP' || position === 'DEF') {
            // --- Defcon-aligned clean sheet XP contribution ---
            // CS probability * CS points value (4 for GKP/DEF)
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H'); // average fixture baseline

            // --- Remove the old flat CS bonus that was baked into basePPG ---
            // (basePPG already encodes historical CS partially, so we add the
            //  *difference* between the fixture-specific CS expectation and the
            //  average-fixture CS expectation to avoid double-counting)
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            pts += breakdown.csAdj;

            // --- GK Saves contribution ---
            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            }
        } else if (position === 'MID') {
            // MID gets 1 pt for a clean sheet (FPL rule)
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H');
            breakdown.csAdj = (csProb - avgCsProb) * 1; // marginal CS contribution vs average, same double-counting-avoidance logic as above
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
