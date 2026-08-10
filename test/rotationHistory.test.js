import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyHistory, recordGwSnapshot, getPlayerHistory, getRecentWindow } from '../lib/rotationHistory.js';

test('recordGwSnapshot: records a new player, returns changed=true', () => {
    const history = createEmptyHistory();
    const { history: h2, changed } = recordGwSnapshot(history, {
        gw: 1,
        players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }]
    });
    assert.equal(changed, true);
    const p = getPlayerHistory(h2, 100);
    assert.equal(p.currentTeam, 'ARS');
    assert.equal(p.snapshots.length, 1);
    assert.deepEqual(p.snapshots[0], { gw: 1, team: 'ARS', position: 'MID', minutes: 90, started: true });
});

test('recordGwSnapshot: re-recording the same gw for a player is idempotent (no duplicate, changed=false)', () => {
    let history = createEmptyHistory();
    history = recordGwSnapshot(history, { gw: 1, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;

    const result = recordGwSnapshot(history, { gw: 1, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 45, startedThisGw: false }] });
    assert.equal(result.changed, false);
    assert.equal(getPlayerHistory(result.history, 100).snapshots.length, 1);
    assert.equal(getPlayerHistory(result.history, 100).snapshots[0].minutes, 90); // unchanged, not overwritten
});

test('recordGwSnapshot: caps snapshot history at 10 gameweeks, dropping the oldest', () => {
    let history = createEmptyHistory();
    for (let gw = 1; gw <= 11; gw++) {
        history = recordGwSnapshot(history, {
            gw,
            players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }]
        }).history;
    }
    const p = getPlayerHistory(history, 100);
    assert.equal(p.snapshots.length, 10);
    assert.equal(p.snapshots[0].gw, 2); // gw 1 dropped
    assert.equal(p.snapshots[9].gw, 11);
});

test('recordGwSnapshot: team change updates currentTeam and future snapshots record the new team', () => {
    let history = createEmptyHistory();
    history = recordGwSnapshot(history, { gw: 1, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;
    history = recordGwSnapshot(history, { gw: 2, players: [{ code: 100, team: 'CHE', position: 'MID', minutesThisGw: 60, startedThisGw: true }] }).history;

    const p = getPlayerHistory(history, 100);
    assert.equal(p.currentTeam, 'CHE');
    assert.equal(p.snapshots.length, 2);
    assert.equal(p.snapshots[0].team, 'ARS');
    assert.equal(p.snapshots[1].team, 'CHE');
});

test('recordGwSnapshot: out-of-order backfill (postponed fixture) does not regress currentTeam, and snapshots stay gw-ordered', () => {
    let history = createEmptyHistory();
    history = recordGwSnapshot(history, { gw: 1, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;
    history = recordGwSnapshot(history, { gw: 3, players: [{ code: 100, team: 'CHE', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;

    let p = getPlayerHistory(history, 100);
    assert.equal(p.currentTeam, 'CHE');

    // gw2 was postponed and only gets backfilled now, after gw3 already recorded.
    history = recordGwSnapshot(history, { gw: 2, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;

    p = getPlayerHistory(history, 100);
    assert.equal(p.currentTeam, 'CHE'); // must not regress to ARS; gw3 is still the most recent gw
    assert.deepEqual(p.snapshots.map(s => s.gw), [1, 2, 3]); // gw-ordered, not insertion-ordered [1, 3, 2]
});

test('getPlayerHistory: unknown player code returns null', () => {
    assert.equal(getPlayerHistory(createEmptyHistory(), 999), null);
});

test('getRecentWindow: unknown player returns zeros', () => {
    assert.deepEqual(getRecentWindow(createEmptyHistory(), 999, { asOfGw: 5 }), { starts: 0, games: 0 });
});

test('getRecentWindow: only counts games at the current team, excluding pre-transfer games even within the raw gw window', () => {
    let history = createEmptyHistory();
    history = recordGwSnapshot(history, { gw: 1, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;
    history = recordGwSnapshot(history, { gw: 2, players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] }).history;
    history = recordGwSnapshot(history, { gw: 3, players: [{ code: 100, team: 'CHE', position: 'MID', minutesThisGw: 30, startedThisGw: false }] }).history;

    const window = getRecentWindow(history, 100, { asOfGw: 3, windowSize: 6 });
    assert.deepEqual(window, { starts: 0, games: 1 }); // only the gw3 CHE snapshot counts; gw1/gw2 ARS excluded
});

test('getRecentWindow: respects windowSize, excluding games older than the window', () => {
    let history = createEmptyHistory();
    for (let gw = 1; gw <= 8; gw++) {
        history = recordGwSnapshot(history, {
            gw,
            players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }]
        }).history;
    }
    const window = getRecentWindow(history, 100, { asOfGw: 8, windowSize: 6 });
    // gw > asOfGw - windowSize = gw > 2, so gws 3-8 count = 6 games
    assert.deepEqual(window, { starts: 6, games: 6 });
});
