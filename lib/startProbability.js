/**
 * Real-data start-probability algorithm and same-team/position displacement
 * detection. No hardcoded player/team names anywhere in this module -- every
 * signal is a parameter supplied by the caller (bootstrap-static official
 * status, `lib/rotationHistory.js`'s `getRecentWindow`, last season's rate,
 * price/ownership).
 *
 * This module has zero I/O, matching `lib/rotationHistory.js` and
 * `lib/calibration.js`: pure functions over plain data, so the precedence
 * rules below can be unit tested without a sync pipeline. A later task wires
 * `computeStartProbability` into `sync.js`, feeding it `recentWindow`
 * computed via `getRecentWindow`.
 */

const RECENT_WINDOW_TRUST_THRESHOLD = 3; // >= this many current-team games in the window -> trust it fully
// Currently set to half of getRecentWindow's default windowSize (6, in lib/rotationHistory.js) --
// if that default changes, reconsider this threshold too.
const DISPLACEMENT_GAP_THRESHOLD = 0.15; // new, untested signal -- tunable once real gameweeks show over/under-firing

// Every branch below multiplies/blends floats (e.g. 0.75 * 0.8 === 0.6000000000000001 in
// IEEE-754), so the result is rounded before being returned -- same reasoning as the
// Math.round(...*100)/100 already applied to the `gap` in detectDisplacementRisk below,
// and to every computed metric in lib/calibration.js. Four decimal places keeps far more
// precision than any input here actually carries, while still killing the float noise.
function round(startProbability) {
    return Math.round(startProbability * 10000) / 10000;
}

/**
 * Estimates the probability a player starts their next fixture, from real data only --
 * no hardcoded player/team names anywhere in this function.
 *
 * Precedence (checked in order):
 *   1. Official FPL status (injured/suspended/unavailable/0% chance) is authoritative and wins outright.
 *   2. A trusted recent window (>=3 of the last 6 GWs at the player's CURRENT team) is used directly.
 *   3. A partial recent window (1-2 games) is blended with last season's rate, weighted by how much
 *      real current-team data exists.
 *   4. Zero current-team games but a real prior-season rate exists (new to this team, not new to
 *      the league) -> use the prior-season rate as-is.
 *   5. No history anywhere (new to the league entirely) -> a generic price/ownership prior,
 *      position-aware since GKP/DEF "nailed starter" pricing sits lower than MID/FWD. This is also
 *      where a player with 1-2 recent-team games but no prior-season rate lands (neither branch 3
 *      nor 4 matches): a deliberate choice to discard a tiny, context-free sample rather than trust
 *      it over a generic prior -- not an oversight.
 *
 * In every branch except #1, the result is scaled by officialChanceOfPlaying when FPL provides a
 * doubtful/partial-fitness signal (e.g. 75%) -- official data always has a say, even when it isn't
 * an outright unavailability.
 */
export function computeStartProbability({
    officialStatus,
    officialChanceOfPlaying,
    recentWindow,
    priorSeasonRate,
    price,
    ownership,
    position
}) {
    if (officialStatus === 'i' || officialStatus === 's' || officialStatus === 'u' || officialChanceOfPlaying === 0) {
        return { startProbability: 0, dataConfidence: 'high', source: 'official-unavailable' };
    }

    const officialFactor = (officialChanceOfPlaying !== null && officialChanceOfPlaying !== undefined)
        ? officialChanceOfPlaying / 100
        : 1.0;

    // Guard against a malformed/undefined recentWindow -- once this is wired into a per-player sync
    // loop with no individual error isolation, one bad recentWindow shouldn't throw for every player.
    const window = recentWindow || { starts: 0, games: 0 };

    if (window.games >= RECENT_WINDOW_TRUST_THRESHOLD) {
        const rate = window.starts / window.games;
        return { startProbability: round(rate * officialFactor), dataConfidence: 'high', source: 'recent-window' };
    }

    if (window.games > 0 && priorSeasonRate !== null && priorSeasonRate !== undefined) {
        const weight = window.games / RECENT_WINDOW_TRUST_THRESHOLD;
        const recentRate = window.starts / window.games;
        const blended = (weight * recentRate) + ((1 - weight) * priorSeasonRate);
        return { startProbability: round(blended * officialFactor), dataConfidence: 'medium', source: 'blended' };
    }

    if (window.games === 0 && priorSeasonRate !== null && priorSeasonRate !== undefined) {
        return { startProbability: round(priorSeasonRate * officialFactor), dataConfidence: 'medium', source: 'prior-season' };
    }

    const priceThreshold = (position === 'GKP' || position === 'DEF') ? 4.5 : 5.5;
    const genericPrior = (ownership > 1.5 || price >= priceThreshold) ? 0.75 : 0.3;
    return { startProbability: round(genericPrior * officialFactor), dataConfidence: 'low', source: 'generic-prior' };
}

/**
 * Detects positional competition: a rostered player whose spot looks threatened by a teammate who
 * (a) recently joined the team and (b) has a meaningfully higher start probability. Generic --
 * doesn't know or care *why* a player is "new", just that isNewToCurrentTeam is true (computed
 * upstream from bootstrap-static's team_join_date, see sync.js).
 */
export function detectDisplacementRisk(playersWithProbabilities) {
    const result = {};

    playersWithProbabilities.forEach(p => {
        if (p.isNewToCurrentTeam) return; // a new arrival can't be flagged as "displaced" in this pass

        const threats = playersWithProbabilities.filter(q =>
            q.code !== p.code &&
            q.team === p.team &&
            q.position === p.position &&
            q.isNewToCurrentTeam &&
            (q.startProbability - p.startProbability) > DISPLACEMENT_GAP_THRESHOLD
        );

        if (threats.length > 0) {
            const biggestThreat = threats.reduce((max, t) =>
                (t.startProbability - p.startProbability) > (max.startProbability - p.startProbability) ? t : max
            , threats[0]);

            result[p.code] = {
                threatenedByCode: biggestThreat.code,
                threatenedByName: biggestThreat.name,
                gap: Math.round((biggestThreat.startProbability - p.startProbability) * 100) / 100
            };
        }
    });

    return result;
}
