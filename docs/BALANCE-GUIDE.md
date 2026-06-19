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

## Outcome anchors (asserted by `src/engine/balance.test.ts`)

Full-tournament rates for a representative **good roster (~92.5 total)**,
real opponent generation + Swiss + double elim (Hard/Legacy reflect the
**v1.2.5** chemistry rebalance — opponents no longer get a chemistry bonus):

| Difficulty | Playoffs | Title | Notes |
| --- | --- | --- | --- |
| Easy | ~100% | ~59% | learning mode |
| Normal | ~96% | ~5% | a 94.5 dream draft reaches the title more often |
| Hard | ~88% | ~2% | a good team now usually makes playoffs; the title is the chase |
| Legacy | ~28% | ~0% | a brutal gauntlet — playoffs is the exception, the crown a long shot (but reachable) |

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

## Difficulty profiles (`DIFFICULTY`) — current (v1.3.5)

> The figures in the tables below are an illustrative snapshot; **`src/config/balance.ts`
> is authoritative** and drifts with every balance patch. When in doubt, read the
> file. Rationale for the current tunings is in `DESIGN-DECISIONS.md` (#71–78).

| Knob | easy | normal | hard | legacy |
| --- | --- | --- | --- | --- |
| `rerolls` | 3 | 1 | 0 | 0 |
| `overallLockedHidden` | no | no | yes | yes |
| `userRollRange` | [-3, 5] | [-3, 4] | [-3.5, 4] | [-5, 5] |
| `aiRollRange` | [-4, 4] | [-4, 4] | [-4, 4] | [-4, 4] |
| `chemistryMaxBonus` (user) | 1.3 | 2.0 | 2.4 | 3.0 |
| `opponentChemistryMaxBonus` (AI) | 1.3 | 2.0 | 0 | 0 |
| `opponentRatingShift` | -2.0 | -1.3 | -0.2 | +1.65 |
| `opponentSpecialChance` | 2% | 5% | 12% | 18% |

Region-locked (SAM) runs add a **per-difficulty** flat boost to every opponent
(`REGION_LOCK.opponentRatingBoost`: easy/normal/hard +2, legacy +2.95) so the
weaker regional field plays at the intended curve (#75).
| `opponentTierWeights` | favors solid | slightly soft | favors elite | heavily elite |
| `xpMultiplier` | 1.0 | 1.0 | 1.5 | 2.0 |

`requiresLegacyUnlock` is set on **legacy only** — it needs a Hard tournament
win to play.

**Chemistry is split into a user cap and an AI cap (v1.2.5).** Every AI lineup
is a real roster at ~100% chemistry while a drafted all-star mix sits near ~20%,
so a single shared cap was a near-flat FIELD-WIDE buff the player couldn't match —
the main reason a good team got eliminated in the Hard/Legacy Swiss. Hard/Legacy
now set `opponentChemistryMaxBonus: 0`, making chemistry the **player's** edge
(easy/normal keep both caps equal — they're not the problem). Opponents earn
their difficulty from raw overall + `opponentRatingShift` + a stronger field +
specials, not from chemistry. Keep the user cap modest so overall still dominates.

Rules that must NOT change (base doc §5): difficulty never touches the
**draft** pool — only rerolls, visibility, opponents and simulation weights.

## Team rating (`TEAM_RATING`) — base doc §18 weighting

```
rating = avg player overall            (dominant, ~82-96)
       + coach   (overall-75)·0.10 + bonusLevel·0.25   max 2.5
       + sub     (overall-75)·0.05                     max 1.2
       + org     buffLevel·0.6                         max 1.8
       + chem    percent · chemistryMaxBonus           max = chemistryMaxBonus (1.3–3 by difficulty); AI cap 0 on Hard/Legacy
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

Points: same-lineup pair **4** · same-country pair **3** · same-org pair
**2** (strongest link only per pair) · org-history link **1.5**/player ·
coach link **1.5** (cap 3) · sub link **1** (cap 2). Max raw = 12.

Tiers by percent: Perfect ≥72 · Great ≥52 · Good ≥32 · Okay ≥14 · Poor <14.

Note: AI historical lineups are naturally Great/Perfect (same lineup ×3).
The user trades raw overall vs chemistry — that's the intended draft tension.

## Situational stats (`SIMULATION`)

| Knob | Default | Effect |
| --- | --- | --- |
| `clutchWeight` | 1.2 | deciding-game bonus × clutch norm |
| `experienceWeight` | 0.8 | every playoff game × experience norm |
| `consistencyDampen` | 0.35 | negative-variance reduction × consistency norm |
| `mechProcBaseChance` | 0.12 | chance of a "high roll" game spike |
| `mechProcBonus` | 2.0 | flat bonus applied when the mech proc fires |
| `overtimeThreshold` | 0.9 | score gap that sends a game to OT |
| `overtimeClutchWeight` | 0.8 | extra clutch weight on the OT winner check |
| `defenseStabilityDampenPerPoint` | 0.08 | extra negative-variance dampen per `defense_stability` point |
| `upsetActivationGap` | 2 | `upset_boost` activates when own rating is below opponent's by this margin |

Stat norm = `(stat − 82) / 18`, clamped — so an 82-stat team is neutral and
stats only nudge (the game must be playable with overall alone).

## Cards & specials

- `RARITY`: common ≤69 · silver 70-79 · gold 80-89 · blue ≥90 (visual only).
  Org cards map from buff level: ~ common · + silver · ++ gold · +++ blue.
- `SPECIALS.appearanceChance` (5% — v0.5.1, was 16%): chance a player card
  in an offer rolls one of that PLAYER's specials (the pool follows the
  person, so any card of theirs qualifies — which already multiplies
  exposure; at 16% runs saw 3-4 specials and they stopped feeling special).
  `coachAppearanceChance` (5%) for coach cards. ~0.4 sightings/run expected.
- `SPECIALS.rarityWeights` (rare 100 · epic 55 · mythic 28 · legendary 12 ·
  creator 12):
  which special appears once the roll passes — legendaries are chase pulls.
  Raise legendary's weight to make the top tier less elusive.
- `DRAFT.staffScarcityBoost` (5): when only coach/sub slots remain, lineups
  that can fill them are favored by up to this weight (1 = off).

## Tournament structure (`TOURNAMENT`)

- **Swiss**: 16 teams, Bo5 — 3 wins advance, 3 losses eliminate.
- **Playoffs**: 8 teams, Bo7.
- **Quick Draft**: 8 teams, single-elimination, Bo5.

`HISTORY_LIMIT` (25) caps the stored run history. `FEATURES.showEliminatorTeam`
(true) reveals the lineup that knocked the user out on a lost run — flip to
false to fully disable with no other code change.

## Progression (`XP`, `RANKS`)

Run XP: complete 50 · swiss win 20 · qualify 75 · playoff series win 40 each
· placement bonus (title 200 / final 100 / 3rd 60 / 4th 40) — multiplied by
difficulty, +25% if hidden overalls. Achievement XP is flat (not multiplied).

Unlocking a NEW special card grants flat XP by rarity (`XP.specialUnlock`,
added after the difficulty multiplier like achievement XP): rare 10 · epic 20
· mythic 40 · legendary 75 · creator 100.

Rank ladder (`RANKS`, current v1.3.5): Unranked 0 → Bronze 200 → Silver 1.5k →
Gold 4k → Platinum 8.5k → Diamond 15k → Champion 24k → Grand Champion 38k →
Supersonic Legend 60k. Bronze stays low so the Collection unlocks on the first
run; the rest was stretched in v1.3.5 for a longer endgame. Average run ≈ 150-300
XP, winning run ≈ 500-800. Mode multipliers: classic ×1.0 · quick ×0.5 · daily ×1.5.
Tune `RANKS` minXp to stretch or compress the grind.

## Playtest workflow

1. Change a knob in `balance.ts`.
2. `npm test` — anchors still green?
3. Play one Easy and one Hard run; watch the Swiss table: the user should
   make playoffs *often* on Easy with a 90+ team, and *fight for it* on Hard.
4. Log findings in `docs/CHANGELOG.md` under "Balance".
