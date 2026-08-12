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
// Both tuned so a large-but-realistic gap reaches the clamp bounds -- as of the widened
// calibration (d20cf5b, 2b06cfb), a weak/promoted team hosting a big club (or vice versa)
// routinely hits [0.3, 2.6] on real current-season data. That's the deliberate intent (see
// getAttackMultiplier's own team-level ticker use), not a bug.
//
// K_ATTACK_OVERALL was previously 0.5, set without cross-checking it against K_ATTACK_SPECIFIC's
// effective sensitivity. That made the two fallback tiers (attack/defence-specific vs.
// overall-only, chosen per-fixture based on which fields a given opponent has real data for --
// see fixtureHasStrengthData) produce very different-magnitude multipliers for a comparable
// real-world quality gap: a single 1-point overall-scale gap (very common) already produced a raw
// swing of +-0.5, saturating the outer PLAYER_ATTACK_MULTIPLIER clamp for even modest gaps,
// while the specific-scale path only saturated for genuinely extreme mismatches. Confirmed on
// real 2026/27 data: Sunderland (promoted, has real specific data) vs Ipswich (promoted,
// specific-strength fields still null -> falls to this overall-only path) computed a raw 1.5
// multiplier for a same-fixture-week teammate whose very next fixture (vs Fulham, which does
// have specific data) computed 0.52 via the other path -- despite FPL's own diff rating calling
// both fixtures equally "easy" (diff=2). Re-derived K_ATTACK_OVERALL empirically: teams with both
// overall and specific-strength data show a real regression slope of ~66.5 specific-scale units
// per 1 overall-scale unit, so K_ATTACK_OVERALL = K_ATTACK_SPECIFIC * 66.5 ~= 0.20 makes a given
// overall-scale gap produce a multiplier swing comparable to the same real quality gap on the
// specific-scale path, instead of saturating far earlier.
const K_ATTACK_SPECIFIC = 0.003;
const K_ATTACK_OVERALL = 0.20;
// K_DEFENCE_SPECIFIC/K_DEFENCE_OVERALL were widened once (alongside the attack constants' first
// round) and deliberately left alone through the attack side's two later steepening rounds --
// clean-sheet outcomes are a bounded win/lose signal with real-world variance tighter than raw
// attacking output, so they don't need the same degree of widening. Not an oversight: both sides
// independently reach their own clamp bounds at a comparable rate on real fixture data.
const K_DEFENCE_SPECIFIC = 0.0008;
const K_DEFENCE_OVERALL = 0.13;
const AVG_CS_PROB_STRENGTH_PATH = 0.30;

// getAttackMultiplier's raw output is re-clamped to this narrower band before scaling an
// individual player's basePPG -- see the comment in computeGwPrediction for why this differs
// from getAttackMultiplier's own (wider) clamp used by the team-level ticker display.
// NOTE: this bounds only the multiplicative basePPG x fdrMultiplier term, preserving
// computeBasePPG's "prevent 9+ XP" invariant against THAT specific compounding mechanism.
// Additive per-fixture bonuses applied afterward (e.g. xgiAdj) are a separate mechanism and
// can still push a fixture's total points modestly past 9 -- see the regression test below.
// MAX tuned via controlled real-data checks (same squad, same underlying player stats, only this
// constant varied). Target (user-specified, aiming for a raw no-captain/no-chips baseline sensibly
// below what a real #1-overall-rank manager's actual season total (2582, WITH captain doubling
// and chips already included) achieves): originally 2450-2500, later tightened to ~2500 exactly.
//
// First round (pre K_ATTACK_OVERALL recalibration): 1.5 -> ~3104; 1.3 -> ~2943; 1.1 -> hit the
// original 2450-2500 target.
//
// Second round: after the K_ATTACK_OVERALL recalibration (see that constant's comment) reshaped
// the whole overall-strength fallback path -- which no longer overshoots the way it used to --
// MAX=1.1 became the actual binding constraint rather than the target, silently erasing real
// fixture-difficulty signal for teams whose opponents route through that fallback path (real
// example: Sunderland vs Ipswich computed a raw 1.2 multiplier post-recalibration, still fully
// clamped away at MAX=1.1). Re-tuned via a fresh controlled sweep on the reshaped curve: 1.2 ->
// season pace ~2258; 1.3 -> ~2334; 1.5 -> ~2444.5; 1.6 -> ~2465.8; 2.0 -> ~2498.1, hitting the
// ~2500 target precisely.
//
// Known tradeoff at MAX=2.0, explicitly accepted: the overall-strength path's own max possible raw
// value (a full 4-point gap on the 1-5 scale) is now only 1.8, so that fallback path can never
// saturate against this ceiling anymore -- only the attack/defence-specific path (raw range up to
// 2.6) still can, and does, for genuinely extreme real matchups (e.g. an elite attack vs a truly
// poor defence computes raw ~2.17, damped to 2.0, pushing a single fixture's total points to ~12.7
// -- above the "12+ is unrealistic" line the MIN/MAX pair was originally introduced to enforce).
// Accepted deliberately: this only fires for genuinely extreme real fixtures (rare by
// construction), and xP is an expected value, not a hard cap -- real single-game hauls already
// exceed this routinely. Re-verify season pace against real data if this is revisited.
const PLAYER_ATTACK_MULTIPLIER_MIN = 0.5;
const PLAYER_ATTACK_MULTIPLIER_MAX = 2.0;

// MAX_GOALS_CONCEDED_NUDGE is intentionally small relative to the fixture-based csAdj it sits
// alongside. Against the current (widened) clean-sheet calibration, real fixture data shows
// csAdj typically well under +-1.0 point but reaching as high as +-1.56 for the most extreme
// matchups -- the nudge stays capped at 0.2 regardless, so it can differentiate teammates without
// ever overriding or rivaling the team-level fixture signal, even at that extreme.
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
 * @returns {number} Multiplier, clamped to [0.3, 2.6].
 */
export function getAttackMultiplier(fixture) {
    const { diff, ownAttackStrength, oppDefenceStrength, ownStrength, oppStrength } = fixture;

    if (Number.isFinite(ownAttackStrength) && Number.isFinite(oppDefenceStrength)) {
        const attackGap = oppDefenceStrength - ownAttackStrength; // positive = their defence stronger than my attack
        return clamp(1.0 - attackGap * K_ATTACK_SPECIFIC, 0.3, 2.6);
    }

    if (Number.isFinite(ownStrength) && Number.isFinite(oppStrength)) {
        const overallGap = oppStrength - ownStrength;
        return clamp(1.0 - overallGap * K_ATTACK_OVERALL, 0.3, 2.6);
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
 * @returns {number} Probability, clamped to [0.02, 0.70] on the strength-based paths, or
 * [0.02, 0.65] on the legacy diff-based fallback (see below).
 */
export function getCleanSheetProb(fixture) {
    const { diff, loc, ownDefenceStrength, oppAttackStrength, ownStrength, oppStrength } = fixture;

    if (Number.isFinite(ownDefenceStrength) && Number.isFinite(oppAttackStrength)) {
        const defenceGap = oppAttackStrength - ownDefenceStrength; // positive = their attack stronger than my defence
        return clamp(AVG_CS_PROB_STRENGTH_PATH - defenceGap * K_DEFENCE_SPECIFIC, 0.02, 0.70);
    }

    if (Number.isFinite(ownStrength) && Number.isFinite(oppStrength)) {
        const overallGap = oppStrength - ownStrength;
        return clamp(AVG_CS_PROB_STRENGTH_PATH - overallGap * K_DEFENCE_OVERALL, 0.02, 0.70);
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

// Real FPL thresholds (2025/26+): DEF need 10 combined clearances+blocks+interceptions+tackles in a
// match; MID/FWD need 12 combined (same + recoveries). Flat +2 pts, no partial credit for
// overshooting. Verified against Premier League's own 2025/26 rules announcement.
const DEFCON_THRESHOLD = { DEF: 10, MID: 12, FWD: 12 };

/**
 * Expected defensive-contribution points for a fixture, from a player's real season per-90 combined
 * defensive-actions rate. FPL only exposes a season-aggregate per-90 rate, not match-by-match logs,
 * so hitProb is a bucketed heuristic (ratio of real rate to the real threshold), not a fitted
 * distribution -- deliberately conservative around ratio=1.0: real league data (min. 900 minutes,
 * fetched fresh this session) shows only ~16% of DEF and ~6% of MID average at or above their own
 * threshold across a full season, so sitting exactly at it is already a strong outcome, not a coin
 * flip (see BASE_DC90's comment in sync.js for the same real numbers).
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position - Returns 0 for GKP (rule doesn't apply).
 * @param {number} dcPer90 - Player's real combined-defensive-actions rate per 90 minutes.
 * @param {number} mppg - Minutes per game played (scales down partial-appearance players).
 * @returns {number} Expected defensive-contribution points for the fixture.
 */
export function getExpectedDefconPts({ position, dcPer90, mppg }) {
    const threshold = DEFCON_THRESHOLD[position];
    if (!threshold || !(dcPer90 > 0)) return 0;
    // Rounded to 6dp to avoid float-division edge cases landing just under a tier boundary
    // (e.g. 13.2 / 12 === 1.0999999999999999 in IEEE 754, not the mathematical 1.1).
    const ratio = Math.round((dcPer90 / threshold) * 1e6) / 1e6;
    let hitProb;
    if (ratio >= 1.4) hitProb = 0.75;
    else if (ratio >= 1.1) hitProb = 0.55;
    else if (ratio >= 0.9) hitProb = 0.35;
    else if (ratio >= 0.7) hitProb = 0.15;
    else hitProb = 0.05;
    const minutesFactor = Math.min(1.0, (mppg || 0) / 90);
    return hitProb * 2 * minutesFactor;
}

// Real anchoring: ~100-110 penalties awarded across a 380-game PL season (~0.14/team/game),
// ~77% historical conversion rate -> ~0.108 expected goals/game purely from guaranteed penalty
// duty. Dampened to 75% of full credit -- not eliminated, because an established taker's real
// scoring history already reflects most of this value via basePPG (so full credit would double
// count it), but weighted toward trusting the real duty signal more than a flat 50/50 split,
// per explicit user direction after reviewing the initial 50%-dampened values against real
// players. Revisit this fraction if it still under/over-shoots against real results.
const PENALTY_DUTY_BONUS = { FWD: 0.32, MID: 0.4, DEF: 0.49 };

// Corner/free-kick duty contributes via assists, not goals. Real data on assists specifically
// attributable to set-piece delivery wasn't available when this was written -- this is a
// conservative, low-confidence estimate (flat across positions, since FPL values every assist at
// 3 pts regardless of position), not a precisely derived figure like PENALTY_DUTY_BONUS above.
// Revisit if better data becomes available.
const SET_PIECE_ASSIST_BONUS = 0.06;

/**
 * Additive set-piece-duty XP contribution. Not applied to GKP (matches getPlayerSetPieceDuty's
 * own GKP exclusion in components/optimizer.js). fk and ck are not additive with each other --
 * a player taking both isn't generating two independent extra assist channels, just delivering
 * from the same handful of set-piece situations either way.
 * @param {'GKP'|'DEF'|'MID'|'FWD'} position
 * @param {{pk?: boolean, fk?: boolean, ck?: boolean}} setPieceDuty
 * @returns {number}
 */
function computeSetPieceAdj(position, setPieceDuty) {
    if (position === 'GKP' || !setPieceDuty) return 0;
    let adj = 0;
    if (setPieceDuty.pk) adj += PENALTY_DUTY_BONUS[position] || 0;
    if (setPieceDuty.fk || setPieceDuty.ck) adj += SET_PIECE_ASSIST_BONUS;
    return adj;
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
 * @param {{pk?: boolean, fk?: boolean, ck?: boolean}|null|undefined} setPieceDuty - Designated penalty/free-kick/corner duty (see computeSetPieceAdj; ignored for GKP).
 * @returns {{ pts: number, breakdown: object }} Rounded XP and a breakdown of each adjustment applied.
 */
export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture, goalsConceded90, leagueAvgGoalsConceded90, setPieceDuty }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0, setPieceAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        const usedStrengthPath = fixtureHasStrengthData(fixture);

        // --- FDR-based scaling (strength-aware, see getAttackMultiplier) ---
        // getAttackMultiplier's own clamp range ([0.3, 2.6]) is deliberately wide for the
        // team-level "Projected Goals" ticker display (components/ticker.js), which multiplies a
        // small league-average-goals baseline (~1.4) and needs that range to differentiate
        // genuinely lopsided fixtures. Applying that same wide range directly to an individual
        // player's basePPG (up to 6.0 for an elite forward) would compound into unrealistic
        // single-gameweek projections (12+ XP), because team goals scored and an individual
        // player's bounded FPL points (one goal, one assist, clean sheet, bonus -- can't scale
        // 1:1 with team goals) have fundamentally different natural variance. Re-clamp to a
        // narrower, player-appropriate band before applying to basePPG, preserving
        // computeBasePPG's own documented "prevent 9+ XP" invariant above against this specific
        // multiplicative (basePPG x fdrMultiplier) compounding mechanism. Additive per-fixture
        // bonuses applied further below (e.g. xgiAdj) are separate and can still push a
        // fixture's total modestly past 9 -- see PLAYER_ATTACK_MULTIPLIER_MIN/MAX's comment.
        //
        // Only applied when usedStrengthPath is true -- the legacy diff-based fallback (below)
        // already has its own safe, pre-Phase-3 range ([0.70, 1.12]) that was never the
        // compounding problem this clamp exists for. Applying PLAYER_ATTACK_MULTIPLIER_MIN/MAX
        // unconditionally would silently reclamp the legacy path too whenever MAX is tuned below
        // 1.12 or MIN above 0.70 (a real bug caught by this file's own "legacy fallback path,
        // unchanged from before this phase" regression test after a later calibration pass
        // dropped MAX below 1.12) -- scoping to the strength-based path keeps that guarantee real.
        const rawFdrMultiplier = getAttackMultiplier(fixture);
        breakdown.fdrMultiplier = usedStrengthPath
            ? clamp(rawFdrMultiplier, PLAYER_ATTACK_MULTIPLIER_MIN, PLAYER_ATTACK_MULTIPLIER_MAX)
            : rawFdrMultiplier;
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
            } else {
                // --- Set-piece duty contribution (DEF only; GKP excluded above) ---
                breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
                pts += breakdown.setPieceAdj;
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

            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;
        } else {
            // FWD — attacking only, no CS points
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;

            breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
            pts += breakdown.setPieceAdj;
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
