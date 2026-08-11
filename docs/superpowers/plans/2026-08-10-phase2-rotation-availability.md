# Phase 2 — Rotation & Availability Modeling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded rotation/transfer heuristics (`ROLE_OVERRIDES`, `KNOWN_TRANSFERS`, `PROMOTED_TEAMS`-gated bypasses, an automatic Gemini call) with a rolling, real-minutes-based start-probability model; fix the override-precedence bug so official FPL status always wins; surface the new signal through the existing Check Risks feature.

**Architecture:** Two new pure `lib/` modules (rolling snapshot history, start-probability algorithm) following the exact pattern established in Phase 1, wired into `sync.js` at the point real GW results become available (reusing Phase 1's `getLatestFinishedGw`/`event/{gw}/live/` machinery), baked into `data.js` as new per-player fields, consumed by `app.js`, `components/optimizer.js`, and `components/planner.js`.

**Tech Stack:** Same as Phase 1 — plain Node ES modules, `node:test`, native `fetch`.

**Reference:** [docs/superpowers/specs/2026-08-10-phase2-rotation-availability-design.md](../specs/2026-08-10-phase2-rotation-availability-design.md)

**Scope discovered during planning, not in the original design doc:** `components/optimizer.js` has its own independent copy of the same `PROMOTED_TEAMS`-gated bypass pattern (three separate spots, including a GKP-specific scoring penalty) that `app.js`'s `getPlayerMinutesFactor` also has. Left inconsistent, the Optimizer and the rest of the app would make different assumptions about the same players. Task 7 below fixes this — it's the same underlying problem the design doc already targets, not a new subsystem.

---

## Task 1: `lib/rotationHistory.js` — rolling snapshot state machine

**Files:**
- Create: `lib/rotationHistory.js`
- Test: `test/rotationHistory.test.js`

Pure, no I/O — same discipline as `lib/backtestStore.js`. Its only job: track recent per-GW
minutes/starts per player, filtered to their *current* team.

- [ ] **Step 1: Write the failing tests**

Create `test/rotationHistory.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/rotationHistory.js'`

- [ ] **Step 3: Write `lib/rotationHistory.js`**

```js
const MAX_SNAPSHOTS_PER_PLAYER = 10;

export function createEmptyHistory() {
    return { players: {} };
}

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

export function getPlayerHistory(history, code) {
    return history.players[code] || null;
}

export function getRecentWindow(history, code, { asOfGw, windowSize = 6 }) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `rotationHistory.test.js` cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/rotationHistory.js test/rotationHistory.test.js
git commit -m "feat: add rotation history rolling-snapshot state machine"
```

---

## Task 2: `lib/startProbability.js` — the start-probability algorithm

**Files:**
- Create: `lib/startProbability.js`
- Test: `test/startProbability.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/startProbability.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStartProbability, detectDisplacementRisk } from '../lib/startProbability.js';

test('computeStartProbability: official status "i" short-circuits to 0 regardless of anything else', () => {
    const result = computeStartProbability({
        officialStatus: 'i', officialChanceOfPlaying: null,
        recentWindow: { starts: 6, games: 6 }, priorSeasonRate: 0.9,
        price: 12.0, ownership: 40, position: 'FWD'
    });
    assert.equal(result.startProbability, 0);
    assert.equal(result.dataConfidence, 'high');
});

test('computeStartProbability: official status "s" (suspended) short-circuits to 0', () => {
    const result = computeStartProbability({
        officialStatus: 's', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 5.0, ownership: 1.0, position: 'DEF'
    });
    assert.equal(result.startProbability, 0);
});

test('computeStartProbability: officialChanceOfPlaying === 0 short-circuits to 0 even with status "a"', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: 0,
        recentWindow: { starts: 5, games: 5 }, priorSeasonRate: 0.8,
        price: 8.0, ownership: 10, position: 'MID'
    });
    assert.equal(result.startProbability, 0);
});

test('computeStartProbability: trusts a full recent window (>= 3 games), scaled by officialChanceOfPlaying', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: 80,
        recentWindow: { starts: 3, games: 4 }, priorSeasonRate: 0.9,
        price: 7.0, ownership: 5, position: 'MID'
    });
    // rate = 3/4 = 0.75; 0.75 * 0.8 = 0.6
    assert.equal(result.startProbability, 0.6);
    assert.equal(result.dataConfidence, 'high');
    assert.equal(result.source, 'recent-window');
});

test('computeStartProbability: blends recent window (1-2 games) with prior-season rate', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 2, games: 2 }, priorSeasonRate: 0.4,
        price: 6.0, ownership: 3, position: 'MID'
    });
    // weight = 2/3; recentRate = 1.0; blended = (2/3 * 1.0) + (1/3 * 0.4) = 0.8
    assert.equal(result.startProbability, 0.8);
    assert.equal(result.dataConfidence, 'medium');
    assert.equal(result.source, 'blended');
});

test('computeStartProbability: zero current-team games, but has prior-season rate -> uses it as-is', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: 0.65,
        price: 6.0, ownership: 3, position: 'MID'
    });
    assert.equal(result.startProbability, 0.65);
    assert.equal(result.dataConfidence, 'medium');
    assert.equal(result.source, 'prior-season');
});

test('computeStartProbability: no history anywhere, high price -> generic prior 0.75', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 8.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.75);
    assert.equal(result.dataConfidence, 'low');
    assert.equal(result.source, 'generic-prior');
});

test('computeStartProbability: no history anywhere, low price/ownership -> generic prior 0.3', () => {
    const result = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.0, ownership: 0.5, position: 'MID'
    });
    assert.equal(result.startProbability, 0.3);
});

test('computeStartProbability: generic prior price threshold is position-aware (GKP/DEF cheaper than MID/FWD)', () => {
    const def = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.5, ownership: 0.5, position: 'DEF'
    });
    const mid = computeStartProbability({
        officialStatus: 'a', officialChanceOfPlaying: null,
        recentWindow: { starts: 0, games: 0 }, priorSeasonRate: null,
        price: 4.5, ownership: 0.5, position: 'MID'
    });
    assert.equal(def.startProbability, 0.75); // 4.5 >= DEF threshold (4.5)
    assert.equal(mid.startProbability, 0.3);  // 4.5 < MID threshold (5.5)
});

test('detectDisplacementRisk: fires when a new arrival has a meaningfully higher start probability at the same team/position', () => {
    const players = [
        { code: 1, name: 'Old Def', team: 'ARS', position: 'DEF', startProbability: 0.5, isNewToCurrentTeam: false },
        { code: 2, name: 'New Def', team: 'ARS', position: 'DEF', startProbability: 0.8, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.deepEqual(result[1], { threatenedByCode: 2, threatenedByName: 'New Def', gap: 0.3 });
    assert.equal(result[2], undefined); // the new arrival itself isn't "displaced"
});

test('detectDisplacementRisk: does not fire for normal squad depth (gap below threshold)', () => {
    const players = [
        { code: 1, name: 'Player A', team: 'ARS', position: 'DEF', startProbability: 0.5, isNewToCurrentTeam: false },
        { code: 2, name: 'Player B', team: 'ARS', position: 'DEF', startProbability: 0.55, isNewToCurrentTeam: false }
    ];
    assert.deepEqual(detectDisplacementRisk(players), {});
});

test('detectDisplacementRisk: does not fire across different positions or teams', () => {
    const players = [
        { code: 1, name: 'Player A', team: 'ARS', position: 'DEF', startProbability: 0.3, isNewToCurrentTeam: false },
        { code: 2, name: 'Player B', team: 'ARS', position: 'MID', startProbability: 0.9, isNewToCurrentTeam: true },
        { code: 3, name: 'Player C', team: 'CHE', position: 'DEF', startProbability: 0.9, isNewToCurrentTeam: true }
    ];
    assert.deepEqual(detectDisplacementRisk(players), {});
});

test('detectDisplacementRisk: picks the biggest threat when multiple new arrivals qualify', () => {
    const players = [
        { code: 1, name: 'Old Mid', team: 'ARS', position: 'MID', startProbability: 0.4, isNewToCurrentTeam: false },
        { code: 2, name: 'New Mid A', team: 'ARS', position: 'MID', startProbability: 0.6, isNewToCurrentTeam: true },
        { code: 3, name: 'New Mid B', team: 'ARS', position: 'MID', startProbability: 0.75, isNewToCurrentTeam: true }
    ];
    const result = detectDisplacementRisk(players);
    assert.equal(result[1].threatenedByCode, 3);
    assert.equal(Math.round(result[1].gap * 100) / 100, 0.35);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/startProbability.js'`

- [ ] **Step 3: Write `lib/startProbability.js`**

```js
const RECENT_WINDOW_TRUST_THRESHOLD = 3; // >= this many current-team games in the window -> trust it fully
const DISPLACEMENT_GAP_THRESHOLD = 0.15; // new, untested signal -- tunable once real gameweeks show over/under-firing

/**
 * Estimates the probability a player starts their next fixture, from real data only --
 * no hardcoded player/team names anywhere in this function.
 *
 * Precedence (checked in order):
 *   1. Official FPL status (injured/suspended/0% chance) is authoritative and wins outright.
 *   2. A trusted recent window (>=3 of the last 6 GWs at the player's CURRENT team) is used directly.
 *   3. A partial recent window (1-2 games) is blended with last season's rate, weighted by how much
 *      real current-team data exists.
 *   4. Zero current-team games but a real prior-season rate exists (new to this team, not new to
 *      the league) -> use the prior-season rate as-is.
 *   5. No history anywhere (new to the league entirely) -> a generic price/ownership prior,
 *      position-aware since GKP/DEF "nailed starter" pricing sits lower than MID/FWD.
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
    if (officialStatus === 'i' || officialStatus === 's' || officialChanceOfPlaying === 0) {
        return { startProbability: 0, dataConfidence: 'high', source: 'official-unavailable' };
    }

    const officialFactor = (officialChanceOfPlaying !== null && officialChanceOfPlaying !== undefined)
        ? officialChanceOfPlaying / 100
        : 1.0;

    if (recentWindow.games >= RECENT_WINDOW_TRUST_THRESHOLD) {
        const rate = recentWindow.starts / recentWindow.games;
        return { startProbability: rate * officialFactor, dataConfidence: 'high', source: 'recent-window' };
    }

    if (recentWindow.games > 0 && priorSeasonRate !== null && priorSeasonRate !== undefined) {
        const weight = recentWindow.games / RECENT_WINDOW_TRUST_THRESHOLD;
        const recentRate = recentWindow.starts / recentWindow.games;
        const blended = (weight * recentRate) + ((1 - weight) * priorSeasonRate);
        return { startProbability: blended * officialFactor, dataConfidence: 'medium', source: 'blended' };
    }

    if (recentWindow.games === 0 && priorSeasonRate !== null && priorSeasonRate !== undefined) {
        return { startProbability: priorSeasonRate * officialFactor, dataConfidence: 'medium', source: 'prior-season' };
    }

    const priceThreshold = (position === 'GKP' || position === 'DEF') ? 4.5 : 5.5;
    const genericPrior = (ownership > 1.5 || price >= priceThreshold) ? 0.75 : 0.3;
    return { startProbability: genericPrior * officialFactor, dataConfidence: 'low', source: 'generic-prior' };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/startProbability.js test/startProbability.test.js
git commit -m "feat: add start-probability algorithm and displacement detection"
```

---

## Task 3: `server.js` — rotation history storage + endpoints

**Files:**
- Modify: `server.js`
- Test: `test/rotationApi.test.js`

Applying the lessons from Phase 1's Task 7 review from the start this time: validate player payload
shapes at the HTTP boundary, apply the write-fallback pattern to the new file immediately, keep
response envelopes consistent (`success` key on every response).

- [ ] **Step 1: Write the failing tests**

Create `test/rotationApi.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffh-rotation-'));
process.env.FFH_PERSIST_DIR = tmpDir;
process.env.PORT = '0';

const { server } = await import('../server.js');

function baseUrl() {
    const { port } = server.address();
    return `http://localhost:${port}`;
}

test('POST /api/rotation/snapshot then GET /api/rotation/history round trip', async () => {
    const postRes = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gw: 1,
            players: [{ code: 100, team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }]
        })
    });
    assert.equal(postRes.status, 200);
    const postBody = await postRes.json();
    assert.equal(postBody.success, true);
    assert.equal(postBody.changed, true);

    const getRes = await fetch(`${baseUrl()}/api/rotation/history?code=100`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.equal(getBody.data.currentTeam, 'ARS');
    assert.equal(getBody.data.snapshots.length, 1);
});

test('GET /api/rotation/history for an unknown code returns success:false, not an error', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/history?code=999999`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false);
});

test('POST /api/rotation/snapshot rejects malformed player entries (non-numeric code)', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gw: 2, players: [{ code: 'not-a-number', team: 'ARS', position: 'MID', minutesThisGw: 90, startedThisGw: true }] })
    });
    assert.equal(res.status, 400);
});

test('POST /api/rotation/snapshot rejects a missing gw', async () => {
    const res = await fetch(`${baseUrl()}/api/rotation/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: [] })
    });
    assert.equal(res.status, 400);
});

test.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — 404s on the new routes.

- [ ] **Step 3: Modify `server.js`**

Add the import alongside the existing `lib/backtestStore.js` import:

```js
import { createEmptyHistory, recordGwSnapshot, getPlayerHistory } from './lib/rotationHistory.js';
```

Add storage setup alongside `BACKTEST_STORE_FILE`/`RETRO_REPORT_FILE` (same `PERSIST_DIR`, same
pattern — no separate write-fallback probe needed per-file since `PERSIST_DIR` itself was already
validated once for `STORAGE_FILE`; follow the exact existing precedent for the two backtest files):

```js
const ROTATION_HISTORY_FILE = path.join(PERSIST_DIR, 'rotation_history.json');

let rotationHistory = createEmptyHistory();
if (fs.existsSync(ROTATION_HISTORY_FILE)) {
    try {
        rotationHistory = JSON.parse(fs.readFileSync(ROTATION_HISTORY_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to load rotation_history.json:', e);
    }
}

function saveRotationHistory() {
    try {
        fs.writeFileSync(ROTATION_HISTORY_FILE, JSON.stringify(rotationHistory, null, 2));
    } catch (e) {
        console.warn('Rotation history write skipped:', e.message);
    }
}

function validateRotationPlayersPayload(players) {
    if (!Array.isArray(players)) return false;
    return players.every(p =>
        typeof p.code === 'number' && !Number.isNaN(p.code) &&
        typeof p.team === 'string' &&
        typeof p.position === 'string' &&
        typeof p.minutesThisGw === 'number' && !Number.isNaN(p.minutesThisGw)
    );
}
```

Add the two new routes, in the same location as the `/api/backtest/*` routes (before
`// Static File Serving`):

```js
    // API Route: Record a Rotation History Snapshot (one per real finished gameweek)
    if (req.method === 'POST' && pathname === '/api/rotation/snapshot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.gw !== 'number' || !validateRotationPlayersPayload(data.players)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing gw or malformed players array' }));
                    return;
                }
                const result = recordGwSnapshot(rotationHistory, { gw: data.gw, players: data.players });
                rotationHistory = result.history;
                saveRotationHistory();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, changed: result.changed }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // API Route: Get a Player's Rotation History (debugging/inspection)
    if (req.method === 'GET' && pathname === '/api/rotation/history') {
        const code = parseInt(reqUrl.searchParams.get('code'), 10);
        const playerHistory = Number.isFinite(code) ? getPlayerHistory(rotationHistory, code) : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (playerHistory) {
            res.end(JSON.stringify({ success: true, data: playerHistory }));
        } else {
            res.end(JSON.stringify({ success: false, data: null }));
        }
        return;
    }

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js test/rotationApi.test.js
git commit -m "feat: add rotation history API endpoints"
```

---

## Task 4: `sync.js` — remove hardcoded overrides, generalize transfer/promotion detection

**Files:**
- Modify: `sync.js`

Removes `fetchAIPleayerNews`, `ROLE_OVERRIDES`, `KNOWN_TRANSFERS`, and the `PROMOTED_TEAMS`-gated
branch. Replaces with two independent, generic signals:
- `isPromotedOrTransfer` (feeds `computeBasePPG`, a *productivity* question) becomes simply
  `minutes === 0` — season-cumulative minutes already correctly reflect a player's real
  point-scoring history regardless of which club earned it, so a domestic transfer with real
  minutes already flows through `computeBasePPG`'s existing branches correctly with no new logic.
- `isNewToCurrentTeam` (feeds `startProbability`'s window-reset and displacement detection, an
  *availability* question) is computed from `bootstrap-static`'s `team_join_date` field — real,
  always-available, no bootstrapping period required (unlike diffing our own history, which would
  be blind to this summer's transfers on the very first sync).

`oldTeam` (used by the UI's transfer-icon tooltip in `components/planner.js`) is preserved as a
field, now populated generically: compare this sync's `teamShort` against the same player's team in
`existingPlayers` (this repo's own previous `data.js`, already read for the historical merge),
matched by `code` (stable) instead of `name` (fragile). When no prior record exists with a
different team, `oldTeam` is `null` — this is an honest, acceptable gap for players transferred
before this phase's own tracking existed (previously covered by the hardcoded list, which had gone
stale anyway); it fills in naturally within one sync/gameweek of `existingPlayers` reflecting the
post-transfer state.

- [ ] **Step 1: Remove `fetchAIPleayerNews` entirely**

Delete the whole function (currently `sync.js:29-99`, from `async function fetchAIPleayerNews() {`
through its closing `}`).

At its call site, find:

```js
    const aiOverrides = await fetchAIPleayerNews();
    const PROMOTED_TEAMS = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];
```

Delete both lines outright — no replacement needed here (the `ROLE_OVERRIDES`/`KNOWN_TRANSFERS`
code deleted in Steps 2-3 were the only consumers of this local `PROMOTED_TEAMS`, and `aiOverrides`
is consumed only by the block deleted in Step 2).

Also delete the module-level `const PROMOTED_TEAMS = ['LEI', 'IPS', 'SOU'];` (`sync.js:7`) — it's
dead/stale (unused inside `parseAndWriteData`, which redeclares its own local copy just deleted
above) and was never the one actually driving any behavior.

- [ ] **Step 2: Remove `ROLE_OVERRIDES` and its two usage sites**

Delete the `ROLE_OVERRIDES` object declaration (currently `sync.js:172-186`).

Delete the manual-override read at the basePPG call site — find:

```js
        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: (manualOverride && manualOverride.basePPG !== undefined) ? manualOverride.basePPG : undefined
        });
```

and change `manualOverridePPG` to always be `undefined` (no `ROLE_OVERRIDES` left to check):

```js
        const basePPG = computeBasePPG({
            minutes,
            appearances,
            totalPoints,
            position,
            teamShort,
            price,
            isPromotedOrTransfer,
            manualOverridePPG: undefined
        });
```

Delete the `const manualOverride = ROLE_OVERRIDES[playerName];` line that fed the above (it sits
just before the `isPromotedOrTransfer` computation, near the top of the `elements.map(el => {...})`
callback).

Delete the "Explicit hardcoded overrides" block near the end of the player-list construction
(matching `const override = ROLE_OVERRIDES[p.name]; if (override) {...}` and its surrounding
`playersList.forEach` block section — the whole numbered "3. Explicit hardcoded overrides" step,
including its now-empty surrounding comment).

- [ ] **Step 3: Remove `KNOWN_TRANSFERS` and replace with generic detection**

Find and delete the entire `KNOWN_TRANSFERS` object (currently starting `sync.js:278`) and the loop
that consumes it:

```js
        for (const [key, val] of Object.entries(KNOWN_TRANSFERS)) {
            if (playerName.includes(key)) {
                transferredThisSeason = true;
                oldTeam = val.oldTeam;
                teamShort = val.newTeam;
                break;
            }
        }
```

Replace the whole block (from `let transferredThisSeason = false; let oldTeam = null;` through the
end of that loop) with:

```js
        let transferredThisSeason = false;
        let oldTeam = null;

        // isNewToCurrentTeam: generic, always-available signal from FPL's own team_join_date --
        // no hardcoded transfer list needed, and unlike diffing our own rotation history this
        // works immediately on the very first sync, including summer transfer window signings.
        const NEW_TO_TEAM_DAYS_THRESHOLD = 75; // roughly one transfer window
        let isNewToCurrentTeam = false;
        if (el.team_join_date) {
            const joinedAt = new Date(el.team_join_date);
            if (!Number.isNaN(joinedAt.getTime())) {
                const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
                isNewToCurrentTeam = daysSinceJoin <= NEW_TO_TEAM_DAYS_THRESHOLD;
            }
        }
        transferredThisSeason = isNewToCurrentTeam;
```

This runs where `teamShort` is already set from `teamMap[el.team]` a few lines earlier (unchanged —
FPL's own live team assignment is trusted directly now, no override needed).

- [ ] **Step 4: Populate `oldTeam` generically from `existingPlayers`**

Find where `existingPlayer` is looked up (`const existingPlayer = existingPlayers.find(ep => ep.name === playerName);`)
and change the match to use `code` (stable across transfers/renamed entries) instead of `name`:

```js
        const existingPlayer = existingPlayers.find(ep => ep.code === el.code);
```

Immediately after `isNewToCurrentTeam`/`transferredThisSeason` are computed (Step 3), add:

```js
        if (isNewToCurrentTeam && existingPlayer && existingPlayer.team && existingPlayer.team !== teamShort) {
            oldTeam = existingPlayer.team;
        }
```

This requires each player object written to `data.js` to include a `code` field so future syncs can
match on it — check the final `return { id: el.id, name: ..., ... }` object literal in the
`elements.map` callback (near the end of that function, close to where `xp10` is set) and add
`code: el.code,` alongside the other identity fields (`id`, `name`, `web_name`) if not already
present.

- [ ] **Step 5: Sanity-check the diff**

Run: `git diff sync.js`
Expected changes only: deleted `fetchAIPleayerNews` + its call site + the stale module-level
`PROMOTED_TEAMS`, deleted `ROLE_OVERRIDES` + its two usage sites (now `manualOverridePPG: undefined`),
deleted `KNOWN_TRANSFERS` + its loop (replaced with `team_join_date`-based `isNewToCurrentTeam`),
`existingPlayer` lookup changed from `name` to `code` match, `oldTeam` computation added, `code`
field added to the output player object if missing. Nothing else in `parseAndWriteData` (teams
list, fixtures schedule, `syncBacktestTracking`, `fileContent` template) should be touched.

Run: `node --check sync.js`
Expected: syntax OK.

- [ ] **Step 6: Commit**

```bash
git add sync.js
git commit -m "refactor: remove hardcoded rotation overrides, use generic team_join_date signal"
```

---

## Task 5: `sync.js` — wire rotation snapshot recording + compute per-player signals

**Files:**
- Modify: `sync.js`

- [ ] **Step 1: Add imports**

```js
import { computeStartProbability, detectDisplacementRisk } from './lib/startProbability.js';
```

- [ ] **Step 2: Extend the existing actuals-scoring block to also capture `starts` and record a rotation snapshot**

In `syncBacktestTracking` (already fetches `event/{gw}/live/` for backtest actuals), extend the
`actualPlayers` mapping to also read `e.stats.starts`, and add a rotation-snapshot POST right after
the existing actuals POST — reusing the same `liveData` fetch rather than fetching it twice:

Find:

```js
                const actualPlayers = liveData.elements.map(e => ({
                    id: e.id,
                    actualPts: e.stats.total_points,
                    minutesPlayed: e.stats.minutes
                }));
                const actualsRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/actuals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gw: latestFinishedGw, players: actualPlayers }),
                    signal: AbortSignal.timeout(5000)
                });
                if (actualsRes.ok) {
                    const actualsBody = await actualsRes.json();
                    console.log(`Backtest: scored GW${latestFinishedGw} (${actualsBody.pairCount} players matched).`);
                }
```

Replace with (adds the `starts` field read and a new rotation-snapshot POST alongside the existing
actuals POST; verify `e.stats.starts` is genuinely present in the real payload the first time this
runs against a completed gameweek — logged explicitly so it's easy to notice if the field is ever
missing/renamed, matching the "verify, don't assume" discipline from Phase 1):

```js
                const actualPlayers = liveData.elements.map(e => ({
                    id: e.id,
                    actualPts: e.stats.total_points,
                    minutesPlayed: e.stats.minutes
                }));
                const actualsRes = await fetch(`${BACKTEST_API_BASE_URL}/api/backtest/actuals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gw: latestFinishedGw, players: actualPlayers }),
                    signal: AbortSignal.timeout(5000)
                });
                if (actualsRes.ok) {
                    const actualsBody = await actualsRes.json();
                    console.log(`Backtest: scored GW${latestFinishedGw} (${actualsBody.pairCount} players matched).`);
                }

                if (liveData.elements.length > 0 && liveData.elements[0].stats.starts === undefined) {
                    console.warn('Rotation snapshot: e.stats.starts is undefined in the live payload -- field may have been renamed by FPL, skipping this gw\'s snapshot.');
                } else {
                    const rotationPlayers = liveData.elements
                        .map(e => {
                            const p = playersList.find(pl => pl.id === e.id);
                            if (!p) return null;
                            return { code: p.code, team: p.team, position: p.position, minutesThisGw: e.stats.minutes, startedThisGw: !!e.stats.starts };
                        })
                        .filter(Boolean);
                    const snapshotRes = await fetch(`${BACKTEST_API_BASE_URL.replace('/api/backtest', '')}/api/rotation/snapshot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gw: latestFinishedGw, players: rotationPlayers }),
                        signal: AbortSignal.timeout(5000)
                    });
                    if (snapshotRes.ok) {
                        console.log(`Rotation: recorded snapshot for GW${latestFinishedGw} (${rotationPlayers.length} players).`);
                    }
                }
```

Note: `BACKTEST_API_BASE_URL.replace('/api/backtest', '')` is a no-op safety net in case that
constant is ever redefined to include a path suffix — today it's just the bare origin
(`https://ffh-production.up.railway.app`), so this simplifies to the same base URL; kept explicit
rather than assuming the constant's shape never changes.

This whole block is still inside `syncBacktestTracking`'s existing try/catch and still only runs
when `latestFinishedGw !== null && !alreadyScored` — so it naturally only fires once per real
gameweek, matching the design's "once per real completed gameweek, not every 6-hour cycle" intent.

- [ ] **Step 3: Compute per-player `startProbability`/`dataConfidence`/`isNewToCurrentTeam`/`displacementRisk`, bake into `data.js`**

`syncBacktestTracking` needs to return this computed data so `parseAndWriteData` can bake it into
the `fileContent` template. Change its return value from just `calibrationFactor` to an object, and
thread a rotation-history fetch through it (one GET per sync, not per-player — the report only needs
enough data to compute recent windows for every player at once, so fetch the whole rotation history
document instead of `/api/rotation/history` per player):

Find the end of `syncBacktestTracking`:

```js
    } catch (err) {
        console.warn('Backtest tracking skipped (non-fatal):', err.message);
    }

    return calibrationFactor;
}
```

This stays as-is (unrelated to this task) -- the new computation happens in `parseAndWriteData`,
not inside `syncBacktestTracking`, since it needs `playersList` fully built with `isNewToCurrentTeam`
already assigned (from Task 4) and needs to run regardless of whether the backtest server was
reachable (rotation probability shouldn't silently vanish just because the backtest server had a
blip).

In `parseAndWriteData`, after `const calibrationFactor = await syncBacktestTracking(playersList, fixturesData);`
add a rotation-probability computation pass over `playersList` before `fileContent` is built:

```js
    let rotationHistoryData = { players: {} };
    try {
        const historyRes = await fetch(`${BACKTEST_API_BASE_URL}/api/rotation/history?code=all`, { signal: AbortSignal.timeout(5000) });
        // The endpoint only supports single-code lookups today (Task 3) -- for the whole-list
        // computation below we instead reconstruct recent windows player-by-player. See note below.
    } catch (err) {
        console.warn('Rotation history fetch skipped (non-fatal):', err.message);
    }
```

**Stop — this reveals a real gap the plan needs to resolve before continuing, not paper over:** Task 3
only built a single-player `GET /api/rotation/history?code=X` endpoint (fine for debugging), but
computing `startProbability` for all ~700 players every sync needs the *whole* rotation history
document at once, not 700 sequential requests. Add one more endpoint to `server.js` in this task:

`server.js` — add alongside the existing rotation routes:

```js
    // API Route: Get the full Rotation History document (bulk, for sync.js's per-sync computation)
    if (req.method === 'GET' && pathname === '/api/rotation/history-bulk') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: rotationHistory }));
        return;
    }

```

Then in `sync.js`, replace the fetch above with:

```js
    let rotationHistoryData = { players: {} };
    try {
        const historyRes = await fetch(`${BACKTEST_API_BASE_URL}/api/rotation/history-bulk`, { signal: AbortSignal.timeout(5000) });
        if (historyRes.ok) {
            const body = await historyRes.json();
            if (body.success) rotationHistoryData = body.data;
        }
    } catch (err) {
        console.warn('Rotation history fetch skipped (non-fatal):', err.message);
    }

    const currentGwForWindow = getNextUnplayedGw(fixturesData) || 1;

    playersList.forEach(p => {
        const window = getRecentWindow(rotationHistoryData, p.code, { asOfGw: currentGwForWindow, windowSize: 6 });
        const priorSeasonRate = (typeof p.MPPG === 'number' && p.MPPG > 0 && typeof p.GS === 'number' && p.GS > 0)
            ? Math.min(1.0, p.MPPG / 90)
            : null;

        const result = computeStartProbability({
            officialStatus: p.status,
            officialChanceOfPlaying: p.chanceOfPlaying,
            recentWindow: window,
            priorSeasonRate,
            price: p.price,
            ownership: p.ownership,
            position: p.position
        });

        p.startProbability = Math.round(result.startProbability * 1000) / 1000;
        p.dataConfidence = result.dataConfidence;
    });

    const displacementMap = detectDisplacementRisk(playersList.map(p => ({
        code: p.code, name: p.web_name, team: p.team, position: p.position,
        startProbability: p.startProbability, isNewToCurrentTeam: p.transferredThisSeason
    })));
    playersList.forEach(p => {
        p.displacementRisk = displacementMap[p.code] || null;
    });
```

Add the `getRecentWindow` import alongside the other `lib/rotationHistory.js` import at the top of
`sync.js`:

```js
import { getRecentWindow } from './lib/rotationHistory.js';
```

(`priorSeasonRate` here approximates "starts per game" from `MPPG` (minutes per game played) divided
by 90 — a reasonable proxy already available on every player object from the existing historical
merge, without needing a separate stored "starts/appearances" ratio. This is intentionally a rough
proxy, not a precise recomputation of last season's exact start rate — precise enough for a
fallback branch that only matters when no current-season data exists yet.)

- [ ] **Step 4: Run tests, syntax check**

Run: `npm test` — all existing tests should remain green (no test file changes in this task; new
behavior here is network-dependent sync.js code, same untestable-by-design category as Task 8/9 in
Phase 1).

Run: `node --check sync.js` and `node --check server.js` — both must pass.

- [ ] **Step 5: Commit**

```bash
git add sync.js server.js
git commit -m "feat: compute startProbability/dataConfidence/displacementRisk, bake into data.js"
```

---

## Task 6: `app.js` — `getPlayerMinutesFactor` consumes `startProbability`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace the function body**

`app.js`'s `window.getPlayerMinutesFactor` currently derives its own matchMinutesRatio/startRatio
from `player.MPPG`/`player.GS` with a `PROMOTED_TEAMS`-gated bypass. Read the current function first
(`app.js`, search for `window.getPlayerMinutesFactor = function`) to confirm its exact current
boundaries, then replace its entire body with:

```js
window.getPlayerMinutesFactor = function(player) {
    if (!player) return 1.0;
    if (player.status === 'i' || player.status === 's' || player.status === 'u') return 0;

    // Backup goalkeeper suppression stays -- this is a squad-slot rule (bench-budget economics: a
    // 4.0m backup GK behind an active 4.5m+ primary contributes ~0 realistic points), not a
    // rotation-probability question startProbability already answers.
    const allPlayers = (typeof PLAYERS !== 'undefined' && Array.isArray(PLAYERS)) ? PLAYERS : (typeof window !== 'undefined' && window.PLAYERS ? window.PLAYERS : []);
    if (player.position === 'GKP' && player.price <= 4.0) {
        const primaryGKPs = allPlayers.filter(p => p.position === 'GKP' && p.team === player.team && p.price >= 4.5);
        const hasActivePrimary = primaryGKPs.some(p => p.status !== 'i' && p.status !== 's' && (p.chanceOfPlaying === undefined || p.chanceOfPlaying > 0));
        if (hasActivePrimary) return 0.0;
    }

    if (typeof player.startProbability === 'number') {
        return Math.min(1.0, Math.max(0.15, player.startProbability));
    }

    // Fallback for the transition period before data.js has been re-synced with startProbability.
    const chance = (player.chanceOfPlaying !== undefined && player.chanceOfPlaying !== null) ? (player.chanceOfPlaying / 100) : 1.0;
    return Math.min(1.0, Math.max(0.15, chance));
};
```

The `0.15` floor is kept from the original function (never fully zero out a fit, non-injured player
just because of low recent minutes — matches the original's documented intent).

- [ ] **Step 2: Verify no other code in `app.js` depended on the removed internals**

Run: `grep -n "isBypassPenalty\|isPromotedOrNew\|matchMinutesRatio\|startRatio" app.js`
Expected: no matches (all were internal to the old function body being replaced).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: app.js consumes startProbability with a safe transition-period fallback"
```

---

## Task 7: `components/optimizer.js` — consolidate the duplicate promoted-team logic

**Files:**
- Modify: `components/optimizer.js`

Fixes the inconsistency discovered during planning: three separate spots keyed on a hardcoded
`PROMOTED_TEAMS_LIST`, duplicating (and drifting from) the same logic `app.js` had.

- [ ] **Step 1: Replace the `isPromotedOrNew` bypass**

Find (currently around `optimizer.js:1216-1223`):

```js
    // Promoted/new team flag — NOTE: GKPs are explicitly excluded from this bypass
    // to prevent newly-promoted goalkeepers (e.g. Walton/IPS) from overriding established PL keepers.
    const isGKP = player.position === 'GKP';
    const isPromotedOrNew = !isGKP && (
        (player.team && PROMOTED_TEAMS_LIST.includes(player.team)) || 
        player.transferredThisSeason || 
        (typeof player.points === 'number' && player.points < 15)
    );
```

Replace with:

```js
    // Promoted/new team flag — NOTE: GKPs are explicitly excluded from this bypass
    // to prevent newly-promoted goalkeepers (e.g. Walton/IPS) from overriding established PL keepers.
    const isGKP = player.position === 'GKP';
    const isPromotedOrNew = !isGKP && (
        player.transferredThisSeason ||
        (typeof player.dataConfidence === 'string' && player.dataConfidence === 'low') ||
        (typeof player.points === 'number' && player.points < 15)
    );
```

(`player.transferredThisSeason` is unchanged as a check here — it's still a valid signal, just now
generically computed via `team_join_date` per Task 4 rather than the hardcoded list. Swapping the
hardcoded team check for `dataConfidence === 'low'` generalizes "promoted team with no real data"
to "any player with no real data," which is the actual intent.)

- [ ] **Step 2: Replace the GKP scoring penalty**

Find (currently around `optimizer.js:1401-1406`):

```js
        // Penalise GKPs from newly-promoted clubs so established PL keepers (Verbruggen,
        // Kinsky, Petrovic etc) are always ranked above newly-promoted options (Walton/IPS).
        // This is intentional: promoted-team GKPs have no PL data and higher variance.
        if (player.position === 'GKP' && PROMOTED_TEAMS_LIST.includes(player.team)) {
            baseScore -= 3.0;
        }
```

Replace with:

```js
        // Penalise low-data-confidence GKPs (promoted-team or otherwise) so established PL
        // keepers are always ranked above unproven options with no real PL track record.
        // This is intentional: no-data GKPs have higher variance than their point estimate shows.
        if (player.position === 'GKP' && player.dataConfidence === 'low') {
            baseScore -= 3.0;
        }
```

- [ ] **Step 3: Remove the now-unused `PROMOTED_TEAMS_LIST` constant**

Run: `grep -n "PROMOTED_TEAMS_LIST" components/optimizer.js`
Expected: zero matches after Steps 1-2 (all three usages removed). Delete the declaration line
(`const PROMOTED_TEAMS_LIST = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];`, currently `optimizer.js:1194`).

- [ ] **Step 4: Commit**

```bash
git add components/optimizer.js
git commit -m "refactor: optimizer.js consolidates onto dataConfidence, drops duplicate promoted-team list"
```

---

## Task 8: `components/planner.js` — Check Risks enhancement

**Files:**
- Modify: `components/planner.js`

Confirmed exact current structure of `runPlannerSquadRiskCheck` (spans roughly lines 1462-1641):
the Gemini branch, on success, populates `state.squadRisks`, shows the modal, and `return`s early
(line 1558). On failure or no key, control falls through to a "Local fallback scan" comment (line
1566) that resets `state.squadRisks = {}` and rebuilds it from scratch via a
`squadPlayers.forEach`, with **four** separate spots checking rotation risk (backup GKP, official
status/chance, a `starts < 15` check, and an `mppg < 60` check) — the latter two both gated by a
local `isPromotedOrNew` using a third copy of the hardcoded `PROMOTED_TEAMS` list (a duplicate of
the ones already fixed in `app.js`/`optimizer.js` in Tasks 6-7).

- [ ] **Step 1: Extract the local scan into a standalone function covering all four existing checks plus the two new ones**

Add this new function directly above `runPlannerSquadRiskCheck` (i.e. above the line
`const runPlannerSquadRiskCheck = async (slots) => {`):

```js
    const computeLocalRiskEntry = (p) => {
        // Backup goalkeeper risk
        if (p.position === 'GKP' && p.price <= 4.0) {
            const primaryGKPs = PLAYERS.filter(other =>
                other.position === 'GKP' && other.team === p.team && other.price >= 4.5
            );
            const hasActivePrimary = primaryGKPs.some(other =>
                other.status !== 'i' && other.status !== 's' && (other.chanceOfPlaying === undefined || other.chanceOfPlaying > 0)
            );
            if (hasActivePrimary) {
                return { risk: "High", reason: "Second-choice / backup goalkeeper.", details: "Goalkeepers priced at £4.0m are backup options and will not start or score points on Bench Boost unless the first-choice keeper is injured or suspended." };
            }
        }

        const chance = (p.chanceOfPlaying !== undefined && p.chanceOfPlaying !== null) ? p.chanceOfPlaying : 100;
        const status = p.status || 'a';
        const starts = typeof p.GS === 'number' ? p.GS : 25;
        const mppg = typeof p.MPPG === 'number' ? p.MPPG : 80;

        if (status === 'i' || chance === 0) {
            return { risk: "High", reason: p.news || "Ruled out with injury.", details: "FPL official status flag set to unavailable." };
        }
        if (status === 's') {
            return { risk: "High", reason: p.news || "Suspended.", details: "FPL official status flag set to suspended." };
        }
        if (status === 'd' || chance < 75) {
            return { risk: "Medium", reason: p.news || `Doubtful starting chance (${chance}% play probability).`, details: "Player flagged by team medical staff." };
        }

        // New: positional displacement risk (data-driven, not name-keyed)
        if (p.displacementRisk) {
            const gapPct = Math.round(p.displacementRisk.gap * 100);
            const risk = p.displacementRisk.gap > 0.3 ? "High" : "Medium";
            return {
                risk,
                reason: `At risk of losing his place to ${p.displacementRisk.threatenedByName}.`,
                details: `${p.displacementRisk.threatenedByName} recently joined the squad and has a ${gapPct}-point-higher start probability.`
            };
        }

        if (chance < 100) {
            return { risk: "Low", reason: p.news || `Minor fitness concern (${chance}% play probability).`, details: "Mild flag. Check press conferences before deadline." };
        }

        // Historical starting-pattern checks -- only trusted when dataConfidence isn't 'low'
        // (replaces the old PROMOTED_TEAMS-gated isPromotedOrNew bypass: a low-data player's thin
        // history shouldn't be read as a rotation risk, it just means we don't know yet).
        if (p.dataConfidence !== 'low') {
            if (starts > 0 && starts < 15) {
                return { risk: "Medium", reason: `Tactical rotation risk (started only ${starts} matches last season).`, details: "Historical starting frequency indicates rotation risk." };
            }
            if (mppg > 0 && mppg < 60) {
                return { risk: "Low", reason: `Minutes risk (averages only ${mppg.toFixed(0)} mins per appearance).`, details: "Averages less than 60 minutes per game." };
            }
        }

        return null;
    };

    const computeDataConfidenceBadge = (p) => {
        if (p.dataConfidence !== 'low') return null;
        return {
            label: 'Limited Data',
            reason: p.transferredThisSeason
                ? 'New arrival with no Premier League track record yet at this club.'
                : 'Very little recent playing time to base this projection on.'
        };
    };
```

- [ ] **Step 2: Restructure `runPlannerSquadRiskCheck` so both paths converge on the same tail**

**2a.** Add a fresh reset at the very top of the function body, right after
`const squadPlayers = slots.map(...)...filter(Boolean);` (the first two statements in the
function): insert `state.squadRisks = {}; state.squadDataConfidence = {};` — this replaces the
later `state.squadRisks = {}` reset that currently sits at the start of the "Local fallback scan"
section (delete that later one in 2c, since resetting there would wipe out a successful Gemini
pass's results).

**2b.** In the Gemini success branch, remove the early return. Find:

```js
                        showPlannerRiskReportModal(squadPlayers);
                        actions.renderActiveView();
                        return;
                    }
                }
            } catch (err) {
                console.error("Gemini risk scan error, falling back to local scan:", err);
            }
        }

        // Local fallback scan
        state.squadRisks = {};
        const PROMOTED_TEAMS = ['COV', 'HUL', 'SUN', 'IPS', 'LEE'];
        squadPlayers.forEach(p => {
            let riskLevel = null;
            let reason = "";
            let details = "";

            // Check for backup goalkeeper risk
            if (p.position === 'GKP' && p.price <= 4.0) {
```

Replace this entire span (from `showPlannerRiskReportModal(squadPlayers);` through to, but not
including, the backup-goalkeeper `if` block that starts the per-player logic) with:

```js
                    }
                }
            } catch (err) {
                console.error("Gemini risk scan error, falling back to local scan:", err);
            }
        }

        // Always run the local, data-driven pass -- runs whether or not Gemini ran/succeeded, and
        // never overwrites a Gemini-sourced entry (Gemini's news-grounded text takes precedence
        // for the players it covers; this fills in everything else, including the two new
        // data-driven risk types Gemini's prompt doesn't compute precisely: displacement and
        // low-confidence).
        squadPlayers.forEach(p => {
```

**2c.** The rest of the old per-player `forEach` body (backup-GKP check through the `mppg < 60`
check, i.e. everything that was between the deleted `squadPlayers.forEach(p => {` and its closing
`});` at the old line 1637) gets deleted and replaced with a call into the new helper:

```js
        squadPlayers.forEach(p => {
            if (!state.squadRisks[p.name]) {
                const entry = computeLocalRiskEntry(p);
                if (entry) state.squadRisks[p.name] = entry;
            }
            const confidenceBadge = computeDataConfidenceBadge(p);
            if (confidenceBadge) {
                state.squadDataConfidence[p.name] = confidenceBadge;
            }
        });

        showPlannerRiskReportModal(squadPlayers);
        actions.renderActiveView();
    };
```

(This closing `};` is the existing end of `runPlannerSquadRiskCheck` itself — don't duplicate it,
just confirm the function still closes correctly after this replacement.)

**Net effect of 2a-2c:** `state.squadRisks`/`state.squadDataConfidence` reset once at the top: →
Gemini branch conditionally fills `state.squadRisks` (no reset, no early return, no modal call) →
one unconditional `squadPlayers.forEach` runs `computeLocalRiskEntry`/`computeDataConfidenceBadge`
for every player, only writing where Gemini didn't already → one shared
`showPlannerRiskReportModal`/`renderActiveView` call at the very end, reached by every path.

- [ ] **Step 3: Verify no leftover references**

Run: `grep -n "PROMOTED_TEAMS\b" components/planner.js`
Expected: zero matches (the local-scan copy from Step 2 is now deleted; any other pre-existing
`PROMOTED_TEAMS_LIST`/`PROMOTED_TEAMS` references in this file were unrelated to this function and
out of scope for this task — if the grep finds any, read the surrounding context before deciding
whether it's actually part of this dead code or a genuinely separate usage).

- [ ] **Step 4: Update the Gemini prompt to ask about the two new risk categories**

In the `promptText` template (search for `"You are an expert Fantasy Premier League scout"`), add
two bullet points to the existing risk-category list:

```
- New signing uncertainty (limited or no Premier League track record at this club yet)
- Positional competition from a new arrival in the same position
```

- [ ] **Step 5: Make the transfer-icon tooltip null-safe**

Find the two occurrences of:

```js
${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="Transferred from ${player.oldTeam}">⇆</div>` : ''}
```

Replace both with:

```js
${player.transferredThisSeason ? `<div class="pitch-transfer-icon" title="${player.oldTeam ? `Transferred from ${player.oldTeam}` : 'New arrival this season'}">⇆</div>` : ''}
```

And the third occurrence (the squad-list view variant):

```js
${player.transferredThisSeason ? `<span class="transfer-badge" style="margin-left: 8px;" title="Transferred from ${player.oldTeam}">⇆ ex-${player.oldTeam}</span>` : ''}
```

Replace with:

```js
${player.transferredThisSeason ? (player.oldTeam ? `<span class="transfer-badge" style="margin-left: 8px;" title="Transferred from ${player.oldTeam}">⇆ ex-${player.oldTeam}</span>` : `<span class="transfer-badge" style="margin-left: 8px;" title="New arrival this season">⇆ NEW</span>`) : ''}
```

(`oldTeam` may legitimately be `null` now — see Task 4 — for players transferred before this
phase's own tracking existed. Must never render "Transferred from null"/"ex-null" literally.)

- [ ] **Step 6: Add a "Limited Data" badge to the risk report modal**

In `showPlannerRiskReportModal`, alongside the existing risk-badge rendering for each player card,
add a small additional badge when `state.squadDataConfidence[p.name]` is set — read the modal's
current card-rendering template (search for `riskyPlayers.map(p => {` inside
`showPlannerRiskReportModal`) to match its existing styling conventions, and add a visually distinct
tag (different from the High/Medium/Low color scale — e.g. a neutral gray/blue "Limited Data" pill)
using `state.squadDataConfidence[p.name].label` and `.reason`.

- [ ] **Step 7: Commit**

```bash
git add components/planner.js
git commit -m "feat: Check Risks surfaces displacement risk and data-confidence badges"
```

---

## Task 9: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests from Tasks 1-3 pass (Tasks 4-8 have no new automated tests — network-dependent
`sync.js` code and browser UI code, same untestable-by-design categories as Phase 1's equivalent
tasks).

- [ ] **Step 2: Run a real build**

Run: `npm run build`
Expected: succeeds. This is the exact check that would have caught Phase 1's production incident
(a named import of a not-yet-present `data.js` export is a hard Rollup build error, invisible to
`npm test`) — do not skip this step.

- [ ] **Step 3: Run a local sync against live data**

Run: `node sync.js`
Expected: completes without throwing. Since no gameweek has finished yet this season, the rotation
snapshot/actuals-scoring branch won't fire (`latestFinishedGw` is `null`) — confirm via the console
output that this is what actually happens (a log line or the natural absence of "Rotation: recorded
snapshot..." output), not a silent failure. Confirm `data.js` regenerates with `startProbability`/
`dataConfidence`/`displacementRisk`/`code` fields present on player objects, and confirm zero
`ROLE_OVERRIDES`/`KNOWN_TRANSFERS`/Gemini-related strings remain anywhere in the regenerated file or
in `sync.js` itself (`grep -c "ROLE_OVERRIDES\|KNOWN_TRANSFERS\|fetchAIPleayerNews" sync.js` should
be `0`).

- [ ] **Step 4: Browser-test Check Risks**

Load the app, build a squad including at least one low-price bench player and one recognizable
starter, click "Check Risks" with no Gemini key configured, and confirm: the modal opens, any
backup-goalkeeper/official-status risks still render as before, and (once real rotation data exists
in a future gameweek) displacement/limited-data badges would render without throwing on today's
all-`null`/all-`low`-or-`high`-confidence preseason data. Confirm the pitch view's transfer icons
render correctly (no literal "from null" text) for any player with `transferredThisSeason: true`.

- [ ] **Step 5: After deploy, confirm the live loop end-to-end**

Once merged and deployed (same process as Phase 1 — PR, merge, confirm Railway redeploy, verify
`/api/rotation/snapshot`/`/api/rotation/history-bulk` respond with JSON not HTML), watch the first
sync run after a real gameweek finishes for `Rotation: recorded snapshot for GW...` in the logs, and
confirm `e.stats.starts` was genuinely present in that real payload (the warning added in Task 5
Step 2 will fire loudly in the logs if it wasn't, rather than silently producing wrong data).

## Self-review notes

- **Spec coverage:** every numbered item in the design doc's Architecture section (1-6) maps to a
  task: rotation history -> Task 1; start-probability algorithm + displacement -> Task 2; storage ->
  Task 3; sync.js changes -> Tasks 4-5; app.js -> Task 6; Check Risks -> Task 8. Task 7 (optimizer.js)
  was discovered during planning, not in the original design doc, and is called out explicitly at
  the top of this plan rather than silently added.
- **A real gap was found and resolved while writing Task 5**, not glossed over: the single-player
  `GET /api/rotation/history` endpoint from Task 3 can't feed a whole-squad computation efficiently.
  Resolved by adding a second, bulk endpoint (`/api/rotation/history-bulk`) as part of Task 5 rather
  than pretending the single-player endpoint was sufficient.
- **Type consistency:** `startProbability`/`dataConfidence`/`displacementRisk` field names and
  shapes are used identically across Tasks 5 (producer), 6/7 (consumers), and 8 (consumer) — checked
  by re-reading each task's field references against Task 5's actual output shape before finalizing.
- **No placeholders:** real field names (`team_join_date`, `code`, `starts`) were verified live
  against the actual FPL API before this plan was written, not assumed.
