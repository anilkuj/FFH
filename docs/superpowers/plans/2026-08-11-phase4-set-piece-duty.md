# Phase 4 — Set-Piece Duty From Real Event Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, name-keyed `SET_PIECE_DUTIES` dictionary in `components/optimizer.js`
with real penalty/free-kick/corner taker data sourced from FPL's own live API, and reduce the
solver's set-piece scoring bonus to temper (not eliminate) double-counting against a player's
already-inclusive `xG`/`xA`.

**Architecture:** `sync.js` reads `penalties_order`/`direct_freekicks_order`/
`corners_and_indirect_freekicks_order` from the FPL bootstrap-static payload it already fetches, and
attaches a `setPieceDuty: {pk, fk, ck}` object to each player record (mirroring how every other
derived field like `xG`/`xG90` is already computed there). `components/optimizer.js` drops the
hardcoded dictionary and all of its supporting dead code (fuzzy name-matching, the fake
"refresh from external sources" `localStorage` scaffolding) and reads `player.setPieceDuty` directly.

**Tech Stack:** Vanilla JS ES modules, `sync.js` (Node, runs via GitHub Action), `data.js` (generated
output), `components/optimizer.js` (browser).

---

### Task 1: `sync.js` — compute `setPieceDuty` from real FPL API fields

**Files:**
- Modify: `sync.js:393-414` (the player-record return object, same block that sets `xG`/`xA`/etc.)

- [ ] **Step 1: Add the `setPieceDuty` field to the player record**

Modify `sync.js` — find the `return { id: el.id, ... }` object inside the player-mapping function
(the same block that computes `xG`/`xA`/`xG90`/etc. just above it). Add a new field:

Old (end of the return object, `sync.js` around line 393-414):
```js
        return {
            id: el.id,
            code: el.code,
            name: `${el.first_name} ${el.second_name}`,
            web_name: el.web_name,
            team: teamShort,
            position: position,
            price: price,
            ownership: ownership,
            points: totalPoints,
            xG: xG,
            xA: xA,
            xG90: parseFloat(xG90.toFixed(2)),
            xA90: parseFloat(xA90.toFixed(2)),
            xGI: parseFloat(el.expected_goal_involvements) || 0.0,
            ictIndex: parseFloat(el.ict_index) || 0.0,
            priceChangeTarget: changeTarget,
```

New:
```js
        return {
            id: el.id,
            code: el.code,
            name: `${el.first_name} ${el.second_name}`,
            web_name: el.web_name,
            team: teamShort,
            position: position,
            price: price,
            ownership: ownership,
            points: totalPoints,
            xG: xG,
            xA: xA,
            xG90: parseFloat(xG90.toFixed(2)),
            xA90: parseFloat(xA90.toFixed(2)),
            xGI: parseFloat(el.expected_goal_involvements) || 0.0,
            ictIndex: parseFloat(el.ict_index) || 0.0,
            priceChangeTarget: changeTarget,
            setPieceDuty: {
                pk: el.penalties_order === 1,
                fk: el.direct_freekicks_order === 1,
                ck: el.corners_and_indirect_freekicks_order === 1
            },
```

Only add the new `setPieceDuty` field — every other line in this block stays exactly as-is. Don't
reorder or touch surrounding fields.

- [ ] **Step 2: Syntax-check**

Run: `node --check sync.js`
Expected: no output

- [ ] **Step 3: Run a real sync and spot-check known takers**

Run: `node sync.js` (or however this project's sync is normally invoked locally — check for an npm
script first: `npm run sync` if present, otherwise `node sync.js` directly)

After it completes, inspect `data.js` for 2-3 known real-world takers to confirm the field landed
correctly, e.g.:

```bash
grep -A 20 '"web_name": "Haaland"' data.js | grep -A 3 "setPieceDuty"
grep -A 20 '"web_name": "Saka"' data.js | grep -A 3 "setPieceDuty"
```

Expected: Haaland shows `pk: true`; Saka shows `pk: true` (Arsenal's primary penalty taker as of this
sync). Exact values depend on live data at sync time — the point is confirming the field is present
and non-trivially populated (not all `false`), not matching an exact hardcoded expectation.

- [ ] **Step 4: Commit**

```bash
git add sync.js
git commit -m "feat: compute setPieceDuty from real FPL API penalty/free-kick/corner order fields"
```

---

### Task 2: `components/optimizer.js` — replace the hardcoded dictionary with real data

**Files:**
- Modify: `components/optimizer.js:1-270` (see exact ranges below)

- [ ] **Step 1: Delete the hardcoded `SET_PIECE_DUTIES` dictionary and `normalizeNameForSetPiece`**

Modify `components/optimizer.js` — delete lines 4-126 in full (the `SET_PIECE_DUTIES` object literal
through the end of `normalizeNameForSetPiece`). This includes the object itself and this helper:

```js
function normalizeNameForSetPiece(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
}
```

The file should go directly from the two `import` lines at the top to `function yieldToEventLoop() {`.

- [ ] **Step 2: Rewrite `getPlayerSetPieceDuty` to read real data**

Old (`components/optimizer.js`, the function as it exists before Step 1's deletion shifts line
numbers — locate it by its unique `export function getPlayerSetPieceDuty` signature):
```js
export function getPlayerSetPieceDuty(player) {
    if (!player || !player.name || player.position === 'GKP') {
        return { pk: false, fk: false, ck: false, duties: [], label: '', hasDuty: false };
    }
    
    // 1. Direct dictionary match
    let info = SET_PIECE_DUTIES[player.name];
    
    if (!info) {
        const pNorm = normalizeNameForSetPiece(player.name);
        const pWords = pNorm.split(/\s+/).filter(Boolean);
        
        // 2. Case and accent normalized exact match
        for (const [name, d] of Object.entries(SET_PIECE_DUTIES)) {
            if (pNorm === normalizeNameForSetPiece(name)) {
                info = d;
                break;
            }
        }
        
        // 3. Token subset match (e.g. "Bruno Fernandes" matches "Bruno Borges Fernandes")
        if (!info) {
            for (const [name, d] of Object.entries(SET_PIECE_DUTIES)) {
                const dWords = normalizeNameForSetPiece(name).split(/\s+/).filter(Boolean);
                if (dWords.length >= 2 && dWords.every(w => pWords.includes(w))) {
                    info = d;
                    break;
                } else if (dWords.length === 1 && dWords[0].length >= 5 && pWords.includes(dWords[0])) {
                    info = d;
                    break;
                }
            }
        }
    }
    
    if (!info) return { pk: false, fk: false, ck: false, duties: [], label: '', hasDuty: false };

    const duties = [];
    if (info.pk) duties.push('Penalties (PK)');
    if (info.fk) duties.push('Free Kicks (FK)');
    if (info.ck) duties.push('Corners (CK)');

    let label = '';
    if (info.pk && info.fk && info.ck) label = 'All Set Pieces (PK, FK, CK)';
    else if (duties.length > 0) label = duties.join(', ');

    return {
        pk: !!info.pk,
        fk: !!info.fk,
        ck: !!info.ck,
        duties,
        label,
        hasDuty: duties.length > 0
    };
}
```

New:
```js
export function getPlayerSetPieceDuty(player) {
    if (!player || player.position === 'GKP') {
        return { pk: false, fk: false, ck: false, duties: [], label: '', hasDuty: false };
    }

    const info = player.setPieceDuty || { pk: false, fk: false, ck: false };

    const duties = [];
    if (info.pk) duties.push('Penalties (PK)');
    if (info.fk) duties.push('Free Kicks (FK)');
    if (info.ck) duties.push('Corners (CK)');

    let label = '';
    if (info.pk && info.fk && info.ck) label = 'All Set Pieces (PK, FK, CK)';
    else if (duties.length > 0) label = duties.join(', ');

    return {
        pk: !!info.pk,
        fk: !!info.fk,
        ck: !!info.ck,
        duties,
        label,
        hasDuty: duties.length > 0
    };
}
```

Note: the `!player.name` check in the original guard clause is dropped since it's no longer relevant
(we're not looking anything up by name anymore) — only `!player` and the GKP check remain.

- [ ] **Step 3: Delete the dead refresh scaffolding**

Delete these three things in full (locate by the unique `SET_PIECE_REFRESH_INTERVAL` and
`checkAndRefreshSetPieceData` identifiers):

```js
const SET_PIECE_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function checkAndRefreshSetPieceData() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const lastSync = parseInt(localStorage.getItem('fpl_hub_set_piece_last_sync') || '0');
    const now = Date.now();

    // Check cached custom duties from localStorage
    try {
        const cachedCustom = localStorage.getItem('fpl_hub_set_piece_custom_data');
        if (cachedCustom) {
            const parsed = JSON.parse(cachedCustom);
            Object.assign(SET_PIECE_DUTIES, parsed);
        }
    } catch (e) {}

    if (now - lastSync >= SET_PIECE_REFRESH_INTERVAL) {
        console.log("[FPL HUB] 6 hours elapsed since last set-piece sync. Refreshing live set-piece duties from external sources...");
        localStorage.setItem('fpl_hub_set_piece_last_sync', now.toString());
        localStorage.setItem('fpl_hub_set_piece_custom_data', JSON.stringify(SET_PIECE_DUTIES));
    }
}

// Automatically check on module load and schedule background 6-hour refresh
if (typeof window !== 'undefined') {
    checkAndRefreshSetPieceData();
    setInterval(checkAndRefreshSetPieceData, SET_PIECE_REFRESH_INTERVAL);
}
```

Confirmed via search earlier in this project's history that `checkAndRefreshSetPieceData` is not
imported anywhere else in the codebase — safe to delete outright, not just un-export.

- [ ] **Step 4: Syntax-check**

Run: `node --check components/optimizer.js`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add components/optimizer.js
git commit -m "refactor: replace hardcoded set-piece duty dictionary with real API data, remove dead refresh scaffolding"
```

---

### Task 3: Reduce the set-piece scoring bonus

**Files:**
- Modify: `components/optimizer.js` (two call sites inside `_performOptimizationWithFormation`)

- [ ] **Step 1: Reduce the bonus in `getSolverScore`**

Old (locate by the unique `let setPieceBonus = 0;` line):
```js
        const duty = getPlayerSetPieceDuty(player);
        let setPieceBonus = 0;
        if (duty.pk) setPieceBonus += state.prioritizeSpotKicks ? 3.5 : 0.8;
        if (duty.fk) setPieceBonus += state.prioritizeSpotKicks ? 1.8 : 0.4;
        if (duty.ck) setPieceBonus += state.prioritizeSpotKicks ? 1.2 : 0.35;
```

New:
```js
        const duty = getPlayerSetPieceDuty(player);
        let setPieceBonus = 0;
        // Bonus values are deliberately modest: a player's underlying xG/xA already reflects
        // their real scoring rate, including whatever penalties/set-pieces they've actually
        // taken, so a large flat bonus on top would double-count that. This still credits
        // recently-assigned takers whose historical xG hasn't caught up to their new duty yet.
        if (duty.pk) setPieceBonus += state.prioritizeSpotKicks ? 2.0 : 0.4;
        if (duty.fk) setPieceBonus += state.prioritizeSpotKicks ? 1.0 : 0.2;
        if (duty.ck) setPieceBonus += state.prioritizeSpotKicks ? 0.7 : 0.15;
```

- [ ] **Step 2: Reduce the bonus in `_getCachedPlayerScore`**

Old (locate by the unique `if (includeHeuristics && state.prioritizeSpotKicks) {` line):
```js
        if (includeHeuristics && state.prioritizeSpotKicks) {
            const duty = getPlayerSetPieceDuty(p);
            if (duty.pk) score += 3.5;
            else if (duty.fk) score += 1.8;
            else if (duty.ck) score += 1.2;
        }
```

New:
```js
        if (includeHeuristics && state.prioritizeSpotKicks) {
            const duty = getPlayerSetPieceDuty(p);
            if (duty.pk) score += 2.0;
            else if (duty.fk) score += 1.0;
            else if (duty.ck) score += 0.7;
        }
```

- [ ] **Step 3: Syntax-check**

Run: `node --check components/optimizer.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add components/optimizer.js
git commit -m "fix: reduce set-piece scoring bonus to temper double-counting against real xG"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full syntax check**

Run: `node --check sync.js && node --check components/optimizer.js`
Expected: no output

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: 104/104 passing (this phase doesn't add or change any unit-tested pure functions, so the
count should be unchanged from before this phase started — confirm it, don't assume it).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds, no new errors or warnings introduced by this phase's changes.

- [ ] **Step 4: Browser verification**

Run the app locally (dev server), and confirm:
- Set-piece badges (🎯/⚡/🚩) still render correctly on player cards in the squad planner
  (`components/planner.js`) for known real takers.
- The "Prioritize Spot-Kick & Set-Piece Takers" filter in the AI Optimizer still visibly changes
  squad recommendations when toggled on vs. off.
- No console errors introduced by removing `SET_PIECE_DUTIES`/`normalizeNameForSetPiece`/
  `checkAndRefreshSetPieceData` (confirms nothing else in the codebase still references them —
  already checked via search during design, but re-confirm live).

- [ ] **Step 5: Confirm no dead references remain**

Run: `grep -rn "SET_PIECE_DUTIES\|normalizeNameForSetPiece\|checkAndRefreshSetPieceData\|SET_PIECE_REFRESH_INTERVAL" --include="*.js" .`
Expected: no output (excluding `node_modules/` and `dist/`, which may have stale build artifacts —
re-run `npm run build` if `dist/` shows matches, don't hand-edit it).

- [ ] **Step 6: Commit** (only if Step 4/5 surfaced a fix — otherwise nothing to commit here)
