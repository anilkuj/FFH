# Defence-Aware Fixture Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop multiplicatively scaling GKP/DEF's entire `basePPG` by an attack-strength-gap signal (`fdrMultiplier`) in `computeGwPrediction` -- the wrong signal for those positions, confirmed to be inflating every defender/keeper on every team, most visibly Arsenal right now. GKP/DEF instead rely on the already-existing defence-strength-based `csAdj`, plus (DEF only) a new personal attacking nudge using their own real `xG90`/`xA90`. MID/FWD are completely unchanged.

**Architecture:** One conditional change to `computeGwPrediction`'s existing fixture-scaling step (gate on position instead of applying unconditionally), plus one new additive term in the DEF branch reusing MID/FWD's existing `xgiAdj` pattern verbatim.

**Tech Stack:** Vanilla JS ES modules, `node:test` test runner.

---

### Task 1: Gate `fdrMultiplier`'s multiplicative application on position

**Files:**
- Modify: `lib/predictionModel.js` (the fixture-scaling block inside `computeGwPrediction`, currently around lines 397-423)
- Test: `test/predictionModel.test.js`

- [ ] **Step 1: Write the failing tests**

Add these tests to `test/predictionModel.test.js`, anywhere reasonable (e.g. right after the existing `getAttackMultiplier` tests, before the `getExpectedSavePts` tests):

```js
test('computeGwPrediction: GKP always gets fdrMultiplier=1.0, strength-based path (attack-strength gap is the wrong signal for a keeper)', () => {
    const easyFixture = { opp: 'SUN', loc: 'H', diff: 2, ownStrength: 5, oppStrength: 2 };
    const hardFixture = { opp: 'MCI', loc: 'A', diff: 5, ownStrength: 2, oppStrength: 5 };
    const easy = computeGwPrediction({ basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: easyFixture });
    const hard = computeGwPrediction({ basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: hardFixture });
    assert.equal(easy.breakdown.fdrMultiplier, 1.0);
    assert.equal(hard.breakdown.fdrMultiplier, 1.0);
});

test('computeGwPrediction: DEF always gets fdrMultiplier=1.0, strength-based path (attack-strength gap is the wrong signal for a defender)', () => {
    const easyFixture = { opp: 'SUN', loc: 'H', diff: 2, ownStrength: 5, oppStrength: 2 };
    const { breakdown } = computeGwPrediction({ basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: easyFixture });
    assert.equal(breakdown.fdrMultiplier, 1.0);
});

test('computeGwPrediction: DEF always gets fdrMultiplier=1.0, legacy diff-based fallback path too', () => {
    const { breakdown } = computeGwPrediction({ basePPG: 4.0, position: 'DEF', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: { opp: 'X', loc: 'H', diff: 2 } });
    assert.equal(breakdown.fdrMultiplier, 1.0);
});

test('computeGwPrediction: MID/FWD fdrMultiplier behavior is completely unchanged by the GKP/DEF fix', () => {
    const fixture = { opp: 'SUN', loc: 'H', diff: 2, ownStrength: 5, oppStrength: 2 };
    const mid = computeGwPrediction({ basePPG: 4.0, position: 'MID', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture });
    const fwd = computeGwPrediction({ basePPG: 4.0, position: 'FWD', xG90: 0, xA90: 0, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture });
    assert.ok(mid.breakdown.fdrMultiplier > 1.0); // a real, strength-based favorable multiplier, same as before this fix
    assert.ok(fwd.breakdown.fdrMultiplier > 1.0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A 5 "fdrMultiplier=1.0"`
Expected: FAIL -- `breakdown.fdrMultiplier` is not `1.0` for GKP/DEF yet (the function still applies the computed attack-based multiplier to every position).

- [ ] **Step 3: Implement the position gate**

In `lib/predictionModel.js`, find this exact block inside `computeGwPrediction` (search for `const rawFdrMultiplier = getAttackMultiplier(fixture);`):

```js
        const rawFdrMultiplier = getAttackMultiplier(fixture);
        breakdown.fdrMultiplier = usedStrengthPath
            ? clamp(rawFdrMultiplier, PLAYER_ATTACK_MULTIPLIER_MIN, PLAYER_ATTACK_MULTIPLIER_MAX)
            : rawFdrMultiplier;
        pts *= breakdown.fdrMultiplier;
```

Replace it with:

```js
        const rawFdrMultiplier = getAttackMultiplier(fixture);
        const computedFdrMultiplier = usedStrengthPath
            ? clamp(rawFdrMultiplier, PLAYER_ATTACK_MULTIPLIER_MIN, PLAYER_ATTACK_MULTIPLIER_MAX)
            : rawFdrMultiplier;
        // Attack-strength-gap is the wrong signal for GKP/DEF's ENTIRE baseline -- their basePPG
        // already reflects real historical points-per-game (appearance points, past bonus points,
        // etc.), none of which should scale with how strong their own team's attack is this
        // fixture. Real evidence (2026-08-12 Arsenal XP investigation): Arsenal's currently very
        // high real attack rating was multiplicatively inflating every Arsenal defender's whole
        // basePPG, not just an attacking-return portion -- e.g. Gabriel (DEF) projected at 8.70
        // 5-GW average vs. a real third-party baseline of 4.96. GKP/DEF instead get their own
        // fixture-difficulty signal via csAdj (defence-strength-based, see getCleanSheetProb)
        // below, plus (DEF only) a personal attacking nudge using their own real xG90/xA90 --
        // same architecture MID/FWD already use just below, just each signal driven by the
        // direction actually relevant to it. See docs/superpowers/specs/
        // 2026-08-12-defence-aware-fixture-scaling-design.md for the full investigation.
        breakdown.fdrMultiplier = (position === 'GKP' || position === 'DEF') ? 1.0 : computedFdrMultiplier;
        pts *= breakdown.fdrMultiplier;
```

- [ ] **Step 4: Update the one existing test this change legitimately breaks**

Find this exact test in `test/predictionModel.test.js` (search for `GKP, hard away fixture leans on saves`):

```js
test('computeGwPrediction: GKP, hard away fixture leans on saves, not clean sheet (legacy fallback path, unchanged from before this phase)', () => {
    const { pts } = computeGwPrediction({
        basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.6,
        mppg: 90, starts: 25, chanceOfPlaying: 100,
        fixture: { opp: 'MCI', loc: 'A', diff: 5 }
    });
    assert.equal(pts, 2.9);
});
```

Replace it with (name updated to no longer claim "unchanged" -- this specific case is now intentionally different; expected value hand-recalculated below):

```js
test('computeGwPrediction: GKP, hard away fixture leans on saves, not clean sheet (legacy fallback path -- fdrMultiplier no longer scales GKP basePPG, see defence-aware fixture scaling fix)', () => {
    const { pts } = computeGwPrediction({
        basePPG: 3.5, position: 'GKP', xG90: 0, xA90: 0, saves90: 3.6,
        mppg: 90, starts: 25, chanceOfPlaying: 100,
        fixture: { opp: 'MCI', loc: 'A', diff: 5 }
    });
    // Hand-recalculated for fdrMultiplier=1.0 (previously 0.70 under the old scaling):
    // pts = 3.5*1.0 = 3.5; homeAwayAdj (legacy, loc=A) = -0.35 -> 3.15;
    // csAdj = (getCleanSheetProb(diff=5,loc=A)=0.03 - getCleanSheetProb(diff=3,loc=H)=0.35)*4 = -1.28 -> 1.87;
    // savesAdj = getExpectedSavePts(diff=5,loc=A,saves90=3.6) = (3.6*1.60*1.10)/3 = 2.112 -> 3.982;
    // chance=1.0 (no change); floor doesn't apply (already above 0.8); rounds to 4.0.
    assert.equal(pts, 4.0);
});
```

**No other existing test needs updating.** Verified by hand: every other DEF/GKP test in this file either (a) uses MID/FWD (unaffected -- this fix doesn't touch those branches), (b) uses a `diff: 3` (or `diff: 1`, which the legacy fallback also treats as neutral) fixture with no strength data, where the OLD `fdrMultiplier` was already `1.0` before this fix -- so forcing it to `1.0` changes nothing, or (c) only asserts a *relative* comparison (`pts > pts`, or a `breakdown.csAdj` delta) between two calls that both get the identical new `fdrMultiplier`, which holds regardless of what that shared value is.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS. Should be 133 (existing) + 4 (new) = 137 total, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "fix: stop scaling GKP/DEF basePPG by attack-strength-gap fdrMultiplier"
```

---

### Task 2: Add DEF's personal attacking-output nudge (`xgiAdj`)

**Files:**
- Modify: `lib/predictionModel.js` (the DEF branch inside `computeGwPrediction`)
- Test: `test/predictionModel.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `test/predictionModel.test.js`:

```js
test('computeGwPrediction: DEF with real attacking output gets a positive xgiAdj on an easy fixture', () => {
    const fixture = { opp: 'SUN', loc: 'H', diff: 2 };
    const { breakdown } = computeGwPrediction({ basePPG: 4.5, position: 'DEF', xG90: 0.15, xA90: 0.10, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture });
    // xGI90 = 0.25 (> 0.1 gate), diff=2 -> xgiAdj = 0.25 * 0.8 = 0.2, same formula as MID/FWD.
    assert.equal(Math.round(breakdown.xgiAdj * 100) / 100, 0.2);
});

test('computeGwPrediction: DEF with real attacking output gets a negative xgiAdj on a hard fixture', () => {
    const fixture = { opp: 'MCI', loc: 'A', diff: 5 };
    const { breakdown } = computeGwPrediction({ basePPG: 4.5, position: 'DEF', xG90: 0.15, xA90: 0.10, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture });
    // xGI90 = 0.25 (> 0.1 gate), diff=5 -> xgiAdj = -0.25 * 0.6 = -0.15.
    assert.equal(Math.round(breakdown.xgiAdj * 100) / 100, -0.15);
});

test('computeGwPrediction: a pure-stopper DEF (near-zero xG90/xA90) gets no xgiAdj regardless of fixture difficulty', () => {
    const easy = computeGwPrediction({ basePPG: 4.5, position: 'DEF', xG90: 0.02, xA90: 0.01, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: { opp: 'SUN', loc: 'H', diff: 2 } });
    const hard = computeGwPrediction({ basePPG: 4.5, position: 'DEF', xG90: 0.02, xA90: 0.01, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: { opp: 'MCI', loc: 'A', diff: 5 } });
    // xGI90 = 0.03, below the 0.1 gate both times.
    assert.equal(easy.breakdown.xgiAdj, 0);
    assert.equal(hard.breakdown.xgiAdj, 0);
});

test('computeGwPrediction: DEF xgiAdj is 0 on a neutral-difficulty fixture (diff 1/3/4), same gating as MID/FWD', () => {
    const { breakdown } = computeGwPrediction({ basePPG: 4.5, position: 'DEF', xG90: 0.15, xA90: 0.10, saves90: 0, mppg: 90, starts: 20, chanceOfPlaying: 100, fixture: { opp: 'X', loc: 'H', diff: 3 } });
    assert.equal(breakdown.xgiAdj, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A 3 "xgiAdj"`
Expected: FAIL -- `breakdown.xgiAdj` stays `0` for DEF regardless of `xG90`/`xA90` (the DEF branch doesn't compute it yet).

- [ ] **Step 3: Add the xgiAdj computation to the DEF branch**

In `lib/predictionModel.js`, find the DEF branch inside `computeGwPrediction` -- the `else` block under `if (position === 'GKP')`, which currently reads (search for `Set-piece duty contribution (DEF only; GKP excluded above)`):

```js
            } else {
                // --- Set-piece duty contribution (DEF only; GKP excluded above) ---
                breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
                pts += breakdown.setPieceAdj;

                // --- Defensive-contribution points (DEF only here; GKP excluded above) ---
                breakdown.defconAdj = getExpectedDefconPts({ position, dcPer90, mppg });
                pts += breakdown.defconAdj;
            }
```

Add the new `xgiAdj` computation, placed first in the block (before `setPieceAdj`, matching the order MID's branch uses: attacking-output nudge before set-piece):

```js
            } else {
                // --- Personal attacking-output contribution (own real xG90/xA90, fixture-
                // difficulty gated) -- DEF only; GKP excluded above. Same coefficients as MID/
                // FWD's xgiAdj below -- DEF's naturally much lower real xG90/xA90 rate already
                // self-limits the resulting magnitude without needing a separate dampening
                // factor. This replaces the old blanket fdrMultiplier scaling as DEF's source of
                // fixture-sensitive attacking credit -- see the fdrMultiplier gate above.
                const xGI90 = xG90 + xA90;
                if (xGI90 > 0.1) {
                    if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                    if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
                }
                pts += breakdown.xgiAdj;

                // --- Set-piece duty contribution (DEF only; GKP excluded above) ---
                breakdown.setPieceAdj = computeSetPieceAdj(position, setPieceDuty);
                pts += breakdown.setPieceAdj;

                // --- Defensive-contribution points (DEF only here; GKP excluded above) ---
                breakdown.defconAdj = getExpectedDefconPts({ position, dcPer90, mppg });
                pts += breakdown.defconAdj;
            }
```

No other existing test needs updating for this step: verified by hand that every existing DEF test either has `xG90`/`xA90` both `0` (or the `0.05`/`0.05` case in the penalty-bonus test, which sums to exactly `0.1`, not `> 0.1`, so the gate never fires), so `xgiAdj` stays `0` for all of them exactly as before this addition.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS. Should be 137 (after Task 1) + 4 (new) = 141 total, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add lib/predictionModel.js test/predictionModel.test.js
git commit -m "feat: give DEF a personal attacking-output nudge (xgiAdj), matching MID/FWD"
```

---

### Task 3: Manual verification against the real Arsenal comparison

**Files:** None modified -- verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (137 from Task 1 + 4 from Task 2 = 141), 0 failures.

- [ ] **Step 2: Re-sync and re-measure the real Arsenal comparison**

Run: `node sync.js` (live FPL fetch, updates `data.js`).

Then run this comparison (same Solio baseline used throughout this session's investigation):

```bash
node -e "
import('./data.js').then(mod => {
  const solio = {
    Gabriel: 4.96, Saka: 4.57, Mosquera: 4.18, Raya: 3.95, 'Bruno G.': 3.88,
    Rice: 3.67, Havertz: 3.52, Tzolis: 3.41, Calafiori: 3.40, 'J.Timber': 2.86,
    'Ødegaard': 2.66, 'Gyökeres': 2.40, Eze: 2.01, Hincapie: 1.79, White: 1.57,
    Zubimendi: 1.48, Madueke: 1.24, Martinelli: 1.16, Merino: 0.91,
    'Lewis-Skelly': 0.74, 'G.Jesus': 0.48, Dowman: 0.24, Nwaneri: 0.11
  };
  let sumOurs = 0, sumSolio = 0;
  console.log('web_name'.padEnd(14), 'Pos'.padEnd(5), 'Ours'.padEnd(7), 'Solio'.padEnd(7), 'Diff');
  Object.entries(solio).forEach(([name, solioVal]) => {
    const p = mod.PLAYERS.find(pl => pl.web_name === name && pl.team === 'ARS');
    if (!p) { console.log(name.padEnd(14), 'NOT FOUND'); return; }
    const ours = p.predictions.slice(0,5).reduce((s,pr)=>s+pr.pts,0) / 5;
    const diff = ours - solioVal;
    sumOurs += ours; sumSolio += solioVal;
    console.log(name.padEnd(14), p.position.padEnd(5), ours.toFixed(2).padEnd(7), String(solioVal).padEnd(7), (diff>=0?'+':'')+diff.toFixed(2));
  });
  console.log('Squad totals: Ours', sumOurs.toFixed(1), 'Solio', sumSolio.toFixed(1), 'Diff', '+'+(sumOurs-sumSolio).toFixed(1), '(' + (((sumOurs/sumSolio)-1)*100).toFixed(0) + '% higher)');
});
"
```

Expected: GKP/DEF rows (Gabriel, Mosquera, Raya, Calafiori, Hincapie, White) should show substantially smaller diffs than the pre-fix run (which had e.g. Gabriel +3.74, White +6.53, Raya +4.19). MID/FWD rows (Saka, Bruno G., Rice, Havertz, etc.) are expected to still show a real, separate, out-of-scope gap -- this fix doesn't touch them. Squad total should drop meaningfully from the pre-fix 142.1, but won't reach parity with Solio's 55.2 -- the remaining gap on MID/FWD (and the open question of whether `PLAYER_ATTACK_MULTIPLIER_MAX` itself needs revisiting) is explicitly out of scope for this plan.

- [ ] **Step 3: No commit needed for this task** -- verification only. If the `data.js` re-sync produced real changes worth keeping, commit it separately as a `chore(sync)` commit, not bundled into this task.
