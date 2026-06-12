# Balance Guide

Every tunable number lives in **`src/config/balance.ts`**. Edit, save, play.
After any change run `npm test` — the suite asserts the base document's
design anchors (§25) still hold, so you can't accidentally break "overall is
the strongest factor".

---

## Design anchors (asserted by `src/engine/match.test.ts`)

| Rating gap | Series outcome target | Test band |
| --- | --- | --- |
| 0 | coin flip | 42–58% |
| +2 | favored but beatable | 55–82% |
| +6 | wins most of the time | >82% |
| +12 | upsets very rare | >96% |

## The variance model (why two noise sources)

`engine/match.ts` mixes:

1. **Series form** (`SIMULATION.seriesFormRange`, ±6): rolled **once per team
   per series**. This is the upset engine — per-game noise alone gets averaged
   away by a best-of-5 and makes favorites win ~95% of close matchups (we
   measured it; see CHANGELOG v0.1.0). Form does not average out.
2. **Per-game roll** (difficulty `userRollRange` / `aiRollRange`): small
   game-to-game swings; creates close series, OTs and momentum flips.

Consistency (stat) and `defense_stability` (special effect) dampen the
*negative* side of both rolls — strong-floor teams lose less to variance.

**Tuning tips**
- Game feels too random → lower `seriesFormRange` (5 or 4).
- Favorites stomp too much → raise it (7).
- Keep `userRollRange` asymmetries small; they tilt every single game.

## Difficulty profiles (`DIFFICULTY`)

| Knob | easy | normal | hard | legacy |
| --- | --- | --- | --- | --- |
| `rerolls` | 3 | 1 | 0 | 0 |
| `overallLockedHidden` | no | no | yes | yes |
| `userRollRange` | [-3, 5] | [-4, 4] | [-5, 4] | [-5, 5] |
| `chemistryMaxBonus` | 1.2 | 2.2 | 2.8 | 2.8 |
| `opponentRatingShift` | -1.5 | 0 | +1.0 | +1.5 |
| `opponentSpecialChance` | 2% | 5% | 12% | 18% |
| `opponentTierWeights` | favors solid | flat | favors elite | heavily elite |
| `xpMultiplier` | 1.0 | 1.0 | 1.5 | 2.0 |

Rules that must NOT change (base doc §5): difficulty never touches the
**draft** pool — only rerolls, visibility, opponents and simulation weights.

## Team rating (`TEAM_RATING`) — base doc §18 weighting

```
rating = avg player overall            (dominant, ~82-96)
       + coach   (overall-75)·0.10 + bonusLevel·0.25   max 2.5
       + sub     (overall-75)·0.05                     max 1.2
       + org     buffLevel·0.6                         max 1.8
       + chem    percent · chemistryMaxBonus           max 2.8 (hard)
       + special 0.4/card                              max 1.2
```

All modifiers together ≈ ±9 max vs a player-average span of ~14 points —
players stay ~75% of the signal, as the base doc requires.

## Chemistry (`CHEMISTRY`) — base doc §22

Points: same-lineup pair **3** · same-country pair **2** · same-org pair
**1** (strongest link only per pair) · org-history link **1**/player ·
coach link **1** (cap 2) · sub link **1** (cap 2). Max raw = 16.

Tiers by percent: Perfect ≥85 · Great ≥62 · Good ≥40 · Okay ≥18 · Poor <18.

Note: AI historical lineups are naturally Great/Perfect (same lineup ×3).
The user trades raw overall vs chemistry — that's the intended draft tension.

## Situational stats (`SIMULATION`)

| Knob | Default | Effect |
| --- | --- | --- |
| `clutchWeight` | 1.2 | deciding-game bonus × clutch norm |
| `experienceWeight` | 0.8 | every playoff game × experience norm |
| `consistencyDampen` | 0.35 | negative-variance reduction × consistency norm |
| `mechProcBaseChance` | 0.12 | chance of a +2 "high roll" game spike |
| `overtimeThreshold` | 0.9 | score gap that sends a game to OT |

Stat norm = `(stat − 82) / 18`, clamped — so an 82-stat team is neutral and
stats only nudge (the game must be playable with overall alone).

## Cards

- `RARITY`: common ≤69 · silver 70-79 · gold 80-89 · blue ≥90 (visual only).
  Org cards map from buff level: ~ common · + silver · ++ gold · +++ blue.
- `DRAFT.specialAppearanceChance` (7%): chance a base card shows up as its
  special version in an offer. Raise to make the collection faster to fill.

## Progression (`XP`, `RANKS`)

Run XP: complete 50 · swiss win 20 · qualify 75 · playoff series win 40 each
· placement bonus (title 200 / final 100 / 3rd 60 / 4th 40) — multiplied by
difficulty, +25% if hidden overalls. Achievement XP is flat (not multiplied).

Rank ladder (v0.2, "moderate grind" target): Unranked 0 → Bronze 200 →
Silver 600 → Gold 1.4k → Platinum 2.6k → Diamond 4.5k → Champion 7.2k →
Grand Champion 10.5k → Supersonic Legend 14.5k. Average run ≈ 150-300 XP,
winning run ≈ 500-800 → SSL lands around 35-60 runs. Tune `RANKS` minXp to
stretch or compress the grind.

## Playtest workflow

1. Change a knob in `balance.ts`.
2. `npm test` — anchors still green?
3. Play one Easy and one Hard run; watch the Swiss table: the user should
   make playoffs *often* on Easy with a 90+ team, and *fight for it* on Hard.
4. Log findings in `docs/CHANGELOG.md` under "Balance".
