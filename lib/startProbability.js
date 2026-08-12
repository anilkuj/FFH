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

// Shared with detectDisplacementRisk and detectPositionalVacancy below: startProbability can be
// `null` when an upstream computation failed for that player -- a deliberate "no signal" sentinel,
// not a valid 0%. JS would otherwise coerce null to 0 in arithmetic (e.g. "0.8 - null" = 0.8),
// wrongly manufacturing or suppressing signals, so both functions exclude non-numeric values first.
function hasValidProbability(player) {
    return typeof player.startProbability === 'number' && !Number.isNaN(player.startProbability);
}

// Shared between computeStartProbability's precedence rule #1 and detectPositionalVacancy's
// vacancy check -- a single definition so the two can't silently drift on what "unavailable" means.
function isOfficiallyUnavailable(officialStatus, officialChanceOfPlaying) {
    return officialStatus === 'i' || officialStatus === 's' || officialStatus === 'u' || officialChanceOfPlaying === 0;
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
    if (isOfficiallyUnavailable(officialStatus, officialChanceOfPlaying)) {
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
 *
 * `startProbability` can be `null` when sync.js's upstream computation failed for that player --
 * a deliberate "no signal" sentinel, not a valid 0%. Players with a non-numeric startProbability
 * (null/undefined/NaN) are excluded on both sides of the comparison below: they can't be flagged
 * as displaced (their own signal isn't trustworthy) and they can't count as a threat to a teammate
 * (JS would otherwise coerce null to 0 in arithmetic, e.g. "0.8 - null" = 0.8, wrongly manufacturing
 * or suppressing a flag).
 */
export function detectDisplacementRisk(playersWithProbabilities) {
    const result = {};

    playersWithProbabilities.forEach(p => {
        if (p.isNewToCurrentTeam) return; // a new arrival can't be flagged as "displaced" in this pass
        if (!hasValidProbability(p)) return; // failed computation -- no trustworthy signal to compare against

        const threats = playersWithProbabilities.filter(q =>
            q.code !== p.code &&
            q.team === p.team &&
            q.position === p.position &&
            q.isNewToCurrentTeam &&
            hasValidProbability(q) &&
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

const VACANCY_MIN_VACATED_RATE = 0.65; // the unavailable player must have been a real starter
const VACANCY_BOOST_FRACTION = 0.6;    // how much of the gap to the vacated player's rate to close
const VACANCY_BOOST_CEILING = 0.85;    // never boost a backup to a false "certain starter" level

/**
 * Detects "positional vacancies": players who were real starters (historicalStartRate >=
 * VACANCY_MIN_VACATED_RATE) now ruled out via official status. Rather than resolving each vacancy
 * in isolation -- which would let multiple simultaneous vacancies at the same team/position all
 * pick the same single "best available" teammate -- vacancies and candidates are grouped by
 * team+position and paired 1:1: vacancies sorted by severity (historicalStartRate descending, so
 * the biggest loss is handled first) against candidates sorted by existing startProbability
 * descending (so the most likely replacement is matched first). This means a team losing two
 * starters at once gets two boosted candidates (the top-2 most likely replacements), not one
 * candidate boosted twice or a no-op. If there are more vacancies than candidates, the extra
 * vacancies (the least severe ones) simply have no beneficiary -- not an error.
 *
 * Before ranking, candidates already at or above VACANCY_BOOST_CEILING are filtered out of the
 * pool entirely -- they're already treated as near-certain starters and don't need the vacancy
 * signal, so leaving them in would waste a pairing slot that should reach a genuine backup further
 * down the list. Real example: Arsenal loses both starting CBs (Saliba, Timber) at once. Without
 * the filter, the top-2 pairing picks Hincapie (0.992) and Gabriel (0.926) -- both already above
 * the ceiling, so both boosts are no-ops -- while Mosquera (0.609), a genuine third-choice option
 * who actually needs the signal, is never reached because he's ranked 5th, not top-2.
 *
 * `historicalStartRate` is required separately from `startProbability` because an unavailable
 * player's own `startProbability` is already 0 by the time this runs (computeStartProbability's
 * official-status precedence rule) -- historicalStartRate is what their rate would be if fit, the
 * only remaining signal that they were a genuine starter and not a fringe player who was barely
 * playing anyway.
 *
 * @param {Array<{code: number, name: string, team: string, position: string, startProbability: number|null, officialStatus: string, officialChanceOfPlaying: number|null|undefined, historicalStartRate: number|null}>} players
 * @returns {Object<number, {boostedFrom: number, boostedTo: number, vacatedByCode: number, vacatedByName: string}>}
 */
export function detectPositionalVacancy(players) {
    const result = {};

    const isUnavailable = (p) => isOfficiallyUnavailable(p.officialStatus, p.officialChanceOfPlaying);
    const hasValidRate = (p) => typeof p.historicalStartRate === 'number' && !Number.isNaN(p.historicalStartRate);

    // Group players by team+position so multiple simultaneous vacancies at the same slot can be
    // paired against multiple candidates, instead of every vacancy independently picking the same
    // single "best available" player and leaving a real second-in-line candidate with no signal.
    const groups = new Map();
    players.forEach(p => {
        const key = `${p.team}|${p.position}`;
        if (!groups.has(key)) groups.set(key, { vacated: [], candidates: [] });
        const group = groups.get(key);
        if (isUnavailable(p)) {
            if (hasValidRate(p) && p.historicalStartRate >= VACANCY_MIN_VACATED_RATE) {
                group.vacated.push(p);
            }
        } else if (hasValidProbability(p)) {
            group.candidates.push(p);
        }
    });

    groups.forEach(group => {
        if (group.vacated.length === 0) return;

        // Candidates already at/above the ceiling don't need the vacancy signal -- they're already
        // treated as near-certain starters. Including them in the ranked pool would waste a pairing
        // slot that should go to a genuine backup further down the list (see function doc for the
        // real Arsenal/Mosquera example that motivated this).
        const eligibleCandidates = group.candidates.filter(c => c.startProbability < VACANCY_BOOST_CEILING);
        if (eligibleCandidates.length === 0) return;

        // Biggest loss first: the most-established starter's vacancy gets matched to the most
        // likely replacement first.
        const sortedVacancies = [...group.vacated].sort((a, b) => b.historicalStartRate - a.historicalStartRate);
        // Most likely replacement first: whoever already has the highest existing probability is
        // the most likely direct replacement for the biggest vacancy.
        const sortedCandidates = [...eligibleCandidates].sort((a, b) => b.startProbability - a.startProbability);

        const pairCount = Math.min(sortedVacancies.length, sortedCandidates.length);
        for (let i = 0; i < pairCount; i++) {
            const vacated = sortedVacancies[i];
            const beneficiary = sortedCandidates[i];

            const boostedTo = Math.max(
                beneficiary.startProbability,
                Math.min(
                    VACANCY_BOOST_CEILING,
                    beneficiary.startProbability + (vacated.historicalStartRate - beneficiary.startProbability) * VACANCY_BOOST_FRACTION
                )
            );

            result[beneficiary.code] = {
                boostedFrom: beneficiary.startProbability,
                boostedTo: round(boostedTo),
                vacatedByCode: vacated.code,
                vacatedByName: vacated.name
            };
        }
    });

    return result;
}
