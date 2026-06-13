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

## Outcome anchors (asserted by `src/engine/balance.test.ts`, v0.5)

Full-tournament rates for a representative **good roster (~92.5 total)**,
real opponent generation + Swiss + double elim. Measured v0.5 values:

| Difficulty | Playoffs | Title | Notes |
| --- | --- | --- | --- |
| Easy | ~100% | ~59% | learning mode |
| Normal | ~97% | ~12% | a 94.5 dream draft reaches ~28% |
| Hard | ~79% | ~1-3% | the title is the chase, playoffs the fight |

If a balance change moves these outside the test bands, the suite fails —
retune or consciously update the test with a CHANGELOG entry.

## The variance model (why two noise sources)

`engine/match.ts` mixes:

1. **Series form** (`SIMULATION.seriesFormRange`, ±4.5 since v0.5 — was ±6):
   rolled **once per team per series**. This is the upset engine — per-game
   noise alone gets averaged away by a best-of-5 and makes favorites win ~95%
   of close matchups (we measured it; see CHANGELOG v0.1.0). Form does not
   average out. At ±6 a +3 edge played like a coin flip (v0.5 feedback).
2. **Per-game roll** (difficulty `userRollRange` / `aiRollRange`): small
   game-to-game swings; creates close series, OTs and momentum flips.

Consistency (stat) and `defense_stability` (special effect) dampen the
*negative* side of both rolls — strong-floor teams lose less to variance.

**Tuning tips**
- Game feels too random → lower `seriesFormRange`.
- Favorites stomp too much → raise it.
- Keep `userRollRange` asymmetries small; they tilt every single game.

## Difficulty profiles (`DIFFICULTY`) — v0.5 values

| Knob | easy | normal | hard | legacy |
| --- | --- | --- | --- | --- |
| `rerolls` | 3 | 1 | 0 | 0 |
| `overallLockedHidden` | no | no | yes | yes |
| `userRollRange` | [-3, 5] | [-3, 4] | [-3.5, 4] | [-5, 5] |
| `chemistryMaxBonus` | 1.0 | 1.6 | 1.8 | 2.2 |
| `opponentRatingShift` | -2.0 | 0 | +0.3 | +1.2 |
| `opponentSpecialChance` | 2% | 5% | 12% | 18% |
| `opponentTierWeights` | favors solid | slightly soft | favors elite | heavily elite |
| `xpMultiplier` | 1.0 | 1.0 | 1.5 | 2.0 |

`chemistryMaxBonus` is also a FIELD-WIDE buff: every AI lineup is a real
roster at 100% chemistry while drafts sit near ~20% — keep it modest.

Rules that must NOT change (base doc §5): difficulty never touches the
**draft** pool — only rerolls, visibility, opponents and simulation weights.

## Team rating (`TEAM_RATING`) — base doc §18 weighting

```
rating = avg player overall            (dominant, ~82-96)
       + coach   (overall-75)·0.10 + bonusLevel·0.25   max 2.5
       + sub     (overall-75)·0.05                     max 1.2
       + org     buffLevel·0.6                         max 1.8
       + chem    percent · chemistryMaxBonus           max 2.2 (legacy)
       + special 0.4/card                              max 1.2
then:  anything above superteamPivot (94) counts at superteamSlope (0.55×)
```

All modifiers together ≈ ±9 max vs a player-average span of ~14 points —
players stay ~75% of the signal, as the base doc requires.

**Superteam compression (v0.5)**: the champion-heavy dataset produces
historical lineups at 98-102 raw total (elite trios + 100% chemistry +
maxed buffs) — an unbeatable Bo7 wall that made the title near-impossible.
Rating above the pivot is compressed for user AND AI alike, keeping the
hierarchy while making championships winnable. Lower the slope to flatten
the top end further; raise the pivot to let super-rosters breathe.

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

## Cards & specials

- `RARITY`: common ≤69 · silver 70-79 · gold 80-89 · blue ≥90 (visual only).
  Org cards map from buff level: ~ common · + silver · ++ gold · +++ blue.
- `SPECIALS.appearanceChance` (6% — v0.5.1, was 16%): chance a player card
  in an offer rolls one of that PLAYER's specials (the pool follows the
  person, so any card of theirs qualifies — which already multiplies
  exposure; at 16% runs saw 3-4 specials and they stopped feeling special).
  `coachAppearanceChance` (5%) for coach cards. ~0.4 sightings/run expected.
- `SPECIALS.rarityWeights` (rare 100 · epic 55 · mythic 28 · legendary 12):
  which special appears once the roll passes — legendaries are chase pulls.
  Raise legendary's weight to make the top tier less elusive.
- `DRAFT.staffScarcityBoost` (5): when only coach/sub slots remain, lineups
  that can fill them are favored by up to this weight (1 = off).

## Progression (`XP`, `RANKS`)

Run XP: complete 50 · swiss win 20 · qualify 75 · playoff series win 40 each
· placement bonus (title 200 / final 100 / 3rd 60 / 4th 40) — multiplied by
difficulty, +25% if hidden overalls. Achievement XP is flat (not multiplied).

Rank ladder (v0.3, target SSL in **100-150 runs**): Unranked 0 → Bronze 300
→ Silver 1k → Gold 2.4k → Platinum 4.8k → Diamond 8.5k → Champion 14k →
Grand Champion 21k → Supersonic Legend 30k. Average run ≈ 150-300 XP,
winning run ≈ 500-800. Mode multipliers: quick ×0.5 · daily ×1.5.
Tune `RANKS` minXp to stretch or compress the grind.

## Playtest workflow

1. Change a knob in `balance.ts`.
2. `npm test` — anchors still green?
3. Play one Easy and one Hard run; watch the Swiss table: the user should
   make playoffs *often* on Easy with a 90+ team, and *fight for it* on Hard.
4. Log findings in `docs/CHANGELOG.md` under "Balance".
