# Phase 4 — Set-Piece Duty From Real Event Data — Design Spec

_Written 2026-08-11._

## Problem

`components/optimizer.js` currently determines penalty/free-kick/corner duty from a hand-maintained
`SET_PIECE_DUTIES` dictionary — roughly 120 lines of `"Player Name": { pk, fk, ck }` entries, keyed by
full name with a fuzzy-normalization fallback for name variants. This is the exact anti-pattern the
rest of this project's phases have been removing: a static list that silently goes stale the moment a
real-world duty change happens (transfer, injury to the previous taker, a new signing) and is never
verified against anything real.

There's also a `checkAndRefreshSetPieceData()` function with a `setInterval`-driven "6 hour refresh"
that looks like it syncs from an external source but doesn't — it just re-saves the same in-memory
hardcoded dictionary back into `localStorage` on a timer. Confirmed via search: nothing else in the
app ever writes a genuine user edit into that `localStorage` key, so this is dead scaffolding, not a
real feature.

Separately, the solver stacks a flat "set-piece bonus" on top of a player's expected points wherever
they have a duty (`getSolverScore`, `_getCachedPlayerScore` in `optimizer.js`). Since a player's
underlying `xG`/`xG90` (sourced from FPL's own `expected_goals` field, confirmed in `sync.js:352`)
already blends penalty and open-play shot value into one number, this bonus double-counts to some
degree for existing recognized takers. True separation would require a new data source (e.g.
Understat, which tags shot types) that FPL's own API doesn't provide — out of scope for this phase,
matching the project's existing bias against adding data-source complexity without evidence
(see Phase 5 in `docs/xp-model-roadmap.md`).

## Goals

- Replace the hardcoded name dictionary with FPL's own live `penalties_order` /
  `direct_freekicks_order` / `corners_and_indirect_freekicks_order` fields — confirmed present in the
  current `bootstrap-static` API payload via a real fetch during this design session (e.g. Haaland:
  `penalties_order: 1`; Saka: `penalties_order: 1, direct_freekicks_order: 2`).
- Remove the dead `checkAndRefreshSetPieceData`/`localStorage` refresh scaffolding.
- Reduce (not eliminate) the set-piece scoring bonus, to temper — not fully solve — the
  double-counting concern, while still crediting recently-assigned takers whose historical xG hasn't
  caught up to their new duty yet.

## Non-goals

- Not separating open-play vs. set-piece xG. FPL's public API has no such split; doing this properly
  would require adding Understat or a similar data source — a separate, bigger-scoped effort, not
  bundled into this phase.
- Not modeling backup/2nd-choice takers. Only `order === 1` (primary taker) counts as a duty. Backup
  takers rarely get real chances (only if the primary is subbed/injured/misses) and modeling that
  tier adds complexity for a low-frequency event.
- Not building a user-facing manual-override editor for duties. The dead `localStorage` scaffolding
  wasn't a real editor either — no functionality is being removed here, just dead code.

## Design

### 1. `sync.js` — compute real duty data at sync time

In the player-record builder (`sync.js`, same block that already sets `xG`/`xA`/etc. around line
393-414), add:

```js
setPieceDuty: {
    pk: el.penalties_order === 1,
    fk: el.direct_freekicks_order === 1,
    ck: el.corners_and_indirect_freekicks_order === 1
}
```

This mirrors the existing pattern for every other derived field in this file — computed once per
sync (every 6 hours via the GitHub Action), written into `data.js`, read by the client. No
client-side fetching, refreshing, or caching needed — `data.js` is already the single source of
truth the rest of the app reads from.

### 2. `components/optimizer.js` — read real data, drop the hardcoded dictionary

Delete:
- The ~120-line `SET_PIECE_DUTIES` object (lines ~4-121).
- `normalizeNameForSetPiece` (only used for fuzzy-matching against the dictionary).
- The fuzzy name-matching block inside `getPlayerSetPieceDuty` (exact-match lookup, then a
  word-overlap fallback loop).
- `checkAndRefreshSetPieceData` and its module-load-time `setInterval` registration.
- `SET_PIECE_REFRESH_INTERVAL` constant.

Rewrite `getPlayerSetPieceDuty(player)` to read directly from `player.setPieceDuty` (falling back to
`{ pk: false, fk: false, ck: false }` if the field is missing, e.g. for any player record from before
a sync picks up this change) and derive the same `{ pk, fk, ck, duties, label, hasDuty }` return
shape it already produces today — every existing consumer (`renderSetPieceBadges`, the filters in
`planner.js`/`stats.js`, the solver's bonus logic) keeps working unchanged, since only the *source*
of the duty flags changes, not their shape or meaning.

### 3. Reduce the set-piece bonus magnitude

Both bonus call sites get roughly halved:

| | Baseline (always-on) | `state.prioritizeSpotKicks` toggle |
|---|---|---|
| Penalty (`pk`) | `0.8` → `0.4` | `3.5` → `2.0` |
| Free-kick (`fk`) | `0.4` → `0.2` | `1.8` → `1.0` |
| Corner (`ck`) | `0.35` → `0.15` | `1.2` → `0.7` |

Applies identically in both `getSolverScore` (~line 1408-1410) and `_getCachedPlayerScore`
(~line 1465-1467) — these are the two places the bonus is currently added.

## Testing

- No new unit-testable pure functions are introduced (the duty computation lives in `sync.js`, which
  — matching the existing pattern for its other derived fields like `xG90`/`goalsConceded90` — isn't
  unit tested; it's verified against real synced data instead).
- Real-data verification: after a sync run, spot-check 4-5 known real-world takers (e.g. Haaland for
  `pk`, a known free-kick specialist for `fk`) against what the live FPL API actually reports for
  those fields, confirming `setPieceDuty` matches. Also confirm a player with no duties gets
  `{pk:false, fk:false, ck:false}`.
- Manual browser verification: confirm set-piece badges (`planner.js`), the "Prioritize Spot-Kick &
  Set-Piece Takers" filter (`optimizer.js`/`stats.js`), and the solver's ranking all still behave
  correctly end-to-end using the new data path — no visual or functional regression from removing the
  hardcoded dictionary.
- Confirm the "Prioritize Spot-Kick" toggle still measurably changes squad recommendations with the
  new, smaller bonus values (i.e. the heuristic still has *some* effect, just a lighter one).
