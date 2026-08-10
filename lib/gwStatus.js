// Extract unique gameweek numbers from fixtures, sorted ascending.
function getGwEventNumbers(fixturesData) {
    return [...new Set(fixturesData.map(f => f.event).filter(e => e !== null && e !== undefined))].sort((a, b) => a - b);
}

// Check if all fixtures for a given gameweek have finished.
// A gw is only considered finished if every fixture in that gw has finished === true.
// Partially finished gws (e.g., postponed matches) return false.
function isGwFinished(fixturesData, gw) {
    const gwFixtures = fixturesData.filter(f => f.event === gw);
    if (gwFixtures.length === 0) return false;
    return gwFixtures.every(f => f.finished === true);
}

// Find the first gameweek with at least one unfinished fixture.
// Returns the gw number, or null if all known gws are finished.
export function getNextUnplayedGw(fixturesData) {
    const gws = getGwEventNumbers(fixturesData);
    for (const gw of gws) {
        if (!isGwFinished(fixturesData, gw)) return gw;
    }
    return null;
}

// Find the highest gameweek where every fixture has finished.
// Stops at the first partially-finished gw, treating postponed matches as blockers.
// Returns the gw number, or null if nothing has finished yet.
export function getLatestFinishedGw(fixturesData) {
    const gws = getGwEventNumbers(fixturesData);
    let latest = null;
    for (const gw of gws) {
        if (isGwFinished(fixturesData, gw)) latest = gw;
    }
    return latest;
}
