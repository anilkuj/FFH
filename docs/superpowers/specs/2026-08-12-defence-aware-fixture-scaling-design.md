# Defence-Aware Fixture Scaling for DEF/GKP — Design Spec

_Written 2026-08-12._

## Problem

Real, controlled comparison this session (`lib/predictionModel.js`'s own live output vs. a
third-party site, Solio) showed Arsenal's entire squad overvalued — 142.1 vs. Solio's 55.2 (157%
higher) across all 23 players, every position. Root cause, confirmed via direct inspection: every
position's `basePPG` is multiplicatively scaled by `fdrMultiplier`
(`pts *= breakdown.fdrMultiplier`, `lib/predictionModel.js`'s `computeGwPrediction`), and
`fdrMultiplier` comes from `getAttackMultiplier` — an **attacking**-strength-gap signal (own team's
attack rating vs. opponent's defence rating). This is the right signal for MID/FWD, whose points are
genuinely driven by their team's attacking output. It's the wrong signal for GKP/DEF: a defender's
`basePPG` already bakes in their real historical points-per-game (appearance points, past clean
sheets, past bonus points) — none of which should scale with how strong their OWN team's attack is
this particular fixture.

Concretely: Arsenal's real, FPL-official attack rating is currently rated higher than Man City's.
Every Arsenal player's `fdrMultiplier` repeatedly approaches `PLAYER_ATTACK_MULTIPLIER_MAX` (2.0)
against several of their real upcoming opponents (Sunderland, Aston Villa, newly-promoted Coventry —
all weak or missing defence ratings). For a MID/FWD this produces a large-but-arguably-defensible
attacking swing. For a DEF like Gabriel or a GKP like Raya, it doubles their *entire* baseline —
appearance points, bonus-point history, everything — for a reason that has nothing to do with their
own game.

Confirmed via real data:
| Player | Pos | Ours (5GW avg) | Solio | Diff |
|---|---|---|---|---|
| Bruno G. | MID | 9.30 | 3.88 | +5.42 |
| Gabriel | DEF | 8.70 | 4.96 | +3.74 |
| Raya | GKP | 8.14 | 3.95 | +4.19 |
| White | DEF | 8.10 | 1.57 | +6.53 |

(MID/FWD also show real gaps — e.g. Bruno G. — but that's a separate, smaller-magnitude question
about whether `PLAYER_ATTACK_MULTIPLIER_MAX` itself needs revisiting for genuinely elite attacking
squads; out of scope here, flagged separately, touches the standing-constraint constant and needs
its own explicit conversation. This spec is scoped to the clearly-wrong GKP/DEF mechanism.)

## Goals

- Stop scaling GKP/DEF's entire `basePPG` by an attack-strength-gap signal.
- Preserve real fixture-difficulty sensitivity for GKP/DEF through the *right* signal:
  `csAdj` (already defence-strength-based, via `getCleanSheetProb`) already exists and stays as the
  primary fixture-difficulty driver for these positions.
- Give DEF a personal attacking-nudge, using their own real `xG90`/`xA90`, the same way MID/FWD
  already get one (`xgiAdj`) — so a genuinely attack-minded defender (ball-playing CB, attacking
  fullback) still gets *some* fixture-sensitive credit for their own real attacking output, just not
  their entire baseline multiplicatively inflated by it.
- Leave MID/FWD's existing `fdrMultiplier` behavior completely unchanged — attack-strength-gap is
  the right signal for them.

## Non-goals

- Not touching `PLAYER_ATTACK_MULTIPLIER_MIN/MAX` — that's the standing-constraint constant, needs a
  fresh explicit user conversation, and is a separate (smaller) question from the GKP/DEF mechanism
  fixed here.
- Not introducing a new defence-oriented *multiplier* to replace the attack one (considered and
  rejected — see design doc's approach comparison below). `csAdj` already exists and is
  defence-oriented; duplicating that signal as a second, multiplicative mechanism would risk a new
  double-counting bug, the same class of issue the vacancy/set-piece branch's holistic review caught
  earlier this session.
- Not attempting to re-derive GKP/DEF's attacking-nudge coefficients from fresh data. Reusing MID/
  FWD's existing, already-tuned `xgiAdj` coefficients (`xGI90 * 0.8` easy fixture / `xGI90 * -0.6`
  hard fixture) — defenders' naturally much lower real `xG90`/`xA90` already self-limits the
  resulting magnitude without needing a separate dampening factor.

## Design

In `computeGwPrediction`, the multiplicative fixture-scaling step currently runs unconditionally,
before the position branch:

```js
const rawFdrMultiplier = getAttackMultiplier(fixture);
breakdown.fdrMultiplier = usedStrengthPath
    ? clamp(rawFdrMultiplier, PLAYER_ATTACK_MULTIPLIER_MIN, PLAYER_ATTACK_MULTIPLIER_MAX)
    : rawFdrMultiplier;
pts *= breakdown.fdrMultiplier;
```

Change to gate the multiplicative application on position — GKP/DEF get a neutral `1.0` (no
multiplicative scaling applied to `basePPG` at all), MID/FWD keep the existing behavior exactly:

```js
const rawFdrMultiplier = getAttackMultiplier(fixture);
const computedFdrMultiplier = usedStrengthPath
    ? clamp(rawFdrMultiplier, PLAYER_ATTACK_MULTIPLIER_MIN, PLAYER_ATTACK_MULTIPLIER_MAX)
    : rawFdrMultiplier;
// Attack-strength-gap is the wrong signal for GKP/DEF's ENTIRE baseline -- their basePPG already
// reflects real historical points-per-game (appearance points, past bonus points, etc.), none of
// which should scale with how strong their own team's attack is this fixture. Real evidence:
// Arsenal's currently very high attack rating was multiplicatively inflating every Arsenal
// defender's whole basePPG, not just an attacking-return portion. GKP/DEF instead get their own
// fixture-difficulty signal via csAdj (defence-strength-based, see getCleanSheetProb) below, plus
// (DEF only) a personal attacking nudge using their own real xG90/xA90 -- same architecture MID/FWD
// already use, just each signal driven by the direction actually relevant to it.
breakdown.fdrMultiplier = (position === 'GKP' || position === 'DEF') ? 1.0 : computedFdrMultiplier;
pts *= breakdown.fdrMultiplier;
```

In the DEF branch (the `else` under the existing `GKP || DEF` combined block, alongside the existing
`csAdj`/`setPieceAdj`/`defconAdj`), add a personal attacking-output nudge, identical in structure and
coefficients to MID/FWD's existing `xgiAdj`:

```js
// --- Personal attacking-output contribution (own real xG90/xA90, fixture-difficulty gated) ---
// Same coefficients as MID/FWD's xgiAdj below -- DEF's naturally much lower real xG90/xA90 rate
// already self-limits the resulting magnitude without needing a separate dampening factor.
const xGI90 = xG90 + xA90;
if (xGI90 > 0.1) {
    if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
    if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
}
pts += breakdown.xgiAdj;
```

GKP gets no equivalent addition (goalkeepers' `xG90`/`xA90` are effectively always ~0; not worth a
special case). GKP's branch already has `csAdj` + `savesAdj` — this spec only removes the incorrect
multiplicative scaling from it, adds nothing new.

`breakdown.xgiAdj` is already initialized to `0` in the breakdown object (existing field, currently
just never set for DEF) — no initializer change needed.

## Expected impact

Every existing test that asserts a specific `pts` value for DEF or GKP fixtures will need updating —
this is a real, intentional behavior change, not a regression. MID/FWD tests should be entirely
unaffected (their code path is unchanged). Re-run the live Arsenal comparison after implementing to
confirm the gap for Gabriel/Raya/White/Calafiori/Hincapie/Mosquera specifically shrinks toward
Solio's numbers, while Bruno G./Saka/Rice (MID, unaffected by this fix) still show their separate,
smaller, out-of-scope gap.

## Testing

- `computeGwPrediction`: new/updated tests confirming `breakdown.fdrMultiplier === 1.0` for GKP and
  DEF regardless of fixture difficulty/strength data (both the strength-based and legacy diff-based
  paths), and unchanged (`computedFdrMultiplier`, matching current behavior) for MID/FWD.
  Existing DEF/GKP tests that hardcode a specific `pts` value computed under the old
  multiplicative-scaling behavior will need their expected values recalculated by hand against the
  new formula (basePPG + csAdj + (xgiAdj for DEF) + savesAdj/setPieceAdj/defconAdj), not just
  bumped to whatever the new code happens to output — verify the arithmetic, don't just accept
  the diff.
- New test: a DEF with real, meaningful `xG90`/`xA90` (e.g. an attacking fullback) gets a positive
  `xgiAdj` on an easy fixture (`diff === 2`) and a negative one on a hard fixture (`diff === 5`),
  matching MID/FWD's existing behavior exactly.
- New test: a DEF with `xG90`/`xA90` both near 0 (a pure stopper) gets `xgiAdj === 0` regardless of
  fixture difficulty (the `xGI90 > 0.1` gate).
- Manual verification: re-run the live Arsenal comparison table (`node -e` one-liner against
  `data.js`, comparing against the Solio baseline already used this session) and confirm DEF/GKP
  gaps shrink substantially; MID/FWD gaps stay roughly where they were (separate, out-of-scope
  issue).
