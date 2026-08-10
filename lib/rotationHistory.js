/**
 * State machine tracking, per player, a rolling window of recent gameweek
 * minutes/starts, filtered to the player's *current* club.
 *
 * The per-player record keeps a `currentTeam` alongside its snapshot list
 * because rotation/start-probability is a function of a player's role at
 * their *current* club, not their career history. A player who was a nailed
 * starter at their old club before a mid-season transfer tells us nothing
 * about their standing at the new one — in fact a fresh transfer is usually
 * a rotation risk precisely because they haven't yet nailed down a starting
 * spot. `getRecentWindow` filters snapshots by `s.team === currentTeam` so
 * that a transfer instantly and silently discards the stale pre-transfer
 * signal, without needing an explicit "transfer happened" event.
 *
 * Snapshots are capped at 10 gameweeks even though the intended analysis
 * window (`getRecentWindow`'s default `windowSize`) is only 6. The extra
 * headroom exists so a short absence — a 1-2 gameweek injury or suspension
 * gap where no snapshot is recorded for this player — doesn't immediately
 * push genuinely recent form out of the retained history; 10 gives the
 * window some slack against gaps without keeping unbounded history per
 * player.
 *
 * This module has zero I/O on purpose, matching `lib/backtestStore.js`:
 * pure state transitions over a plain-object store, passed in and returned
 * explicitly rather than mutated. A later task feeds this module's
 * `getRecentWindow` output into a start-probability algorithm.
 */

const MAX_SNAPSHOTS_PER_PLAYER = 10;
const DEFAULT_WINDOW_SIZE = 6;

/** Fresh history with no players recorded yet. */
export function createEmptyHistory() {
    return { players: {} };
}

/**
 * Records one gameweek's minutes/start snapshot for each player supplied.
 *
 * Idempotent per (player, gw): if a snapshot already exists for a player at
 * this gw, it is left untouched rather than overwritten. This makes it safe
 * for a caller to re-post the same gameweek's data (e.g. a retry, or a
 * re-run of an ingest job) without corrupting history with a second entry
 * or silently replacing an earlier (possibly more authoritative) minutes
 * figure with a later one.
 *
 * `changed` reports whether any player's history actually grew, so a caller
 * (e.g. a persistence layer deciding whether to write the store back to
 * disk) can skip work when a snapshot call was a total no-op.
 */
export function recordGwSnapshot(history, { gw, players }) {
    const newPlayers = { ...history.players };
    let changed = false;

    players.forEach(p => {
        const existing = newPlayers[p.code];
        const priorSnapshots = existing ? existing.snapshots : [];

        if (priorSnapshots.some(s => s.gw === gw)) {
            return; // idempotent: this gw is already recorded for this player
        }

        const newSnapshot = {
            gw,
            team: p.team,
            position: p.position,
            minutes: p.minutesThisGw,
            started: !!p.startedThisGw
        };
        const updatedSnapshots = [...priorSnapshots, newSnapshot].slice(-MAX_SNAPSHOTS_PER_PLAYER);

        newPlayers[p.code] = {
            currentTeam: p.team,
            currentPosition: p.position,
            snapshots: updatedSnapshots
        };
        changed = true;
    });

    return { history: { players: newPlayers }, changed };
}

/** Raw per-player record (currentTeam/currentPosition + snapshot list), or null if unknown. */
export function getPlayerHistory(history, code) {
    return history.players[code] || null;
}

/**
 * Rolls up a player's recent starts/games within `windowSize` gameweeks of
 * `asOfGw`, restricted to snapshots recorded at the player's *current* team
 * (see module header for why). Unknown players return zeros rather than
 * throwing, so a caller computing a rotation signal across a full squad
 * doesn't need a special case for players with no recorded history yet
 * (e.g. new signings).
 */
export function getRecentWindow(history, code, { asOfGw, windowSize = DEFAULT_WINDOW_SIZE }) {
    const p = getPlayerHistory(history, code);
    if (!p) return { starts: 0, games: 0 };

    const relevant = p.snapshots.filter(s =>
        s.team === p.currentTeam && s.gw <= asOfGw && s.gw > asOfGw - windowSize
    );

    return {
        games: relevant.length,
        starts: relevant.filter(s => s.started).length
    };
}
