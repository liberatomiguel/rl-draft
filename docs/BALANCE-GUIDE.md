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
**v1.4 additive chemistry** — opponents no longer get a chemistry bonus):

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

## Difficulty profiles (`DIFFICULTY`) — current (v1.4)

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
| `opponentRatingShift` | -2.0 | -1.3 | -0.7 | +1.3 |
| `opponentSpecialChance` | 2% | 5% | 12% | 18% |

Legacy's `+1.3` (v1.4 retune; #79.1 set 1.2, #94 nudged 1.2 → 1.3) was tuned on the
**realistic-draft win-rate curve** (`difficulty.sim.test.ts`): a ~92 team ≈ 0%, the elite
tier climbs to 96-97 ≈ 15% and a 98+ pinnacle ≈ 49%. Region-locked (SAM) runs add a
**per-difficulty** flat boost to every opponent (`REGION_LOCK.opponentRatingBoost` is a
per-difficulty record: easy/normal/hard +2, **legacy +4.0** — tuned on SAM's OWN curve, NOT
in lockstep with the WW shift). SAM lives on its own flatter scale, re-anchored to its **~95
achievable ceiling** (v1.4.3, #99): the 94-95 ceiling ≈ 32% title, non-elite walled out, never
impossible — so the weaker regional field plays at its intended curve. Watch the **reach-the-
final %** the sim now logs, not just the title rate: it was a 90-91 making the grand final 32%
of runs (not the title rate) that exposed the pre-#99 ease.
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

**Additive model (v1.4).** Each player pair scores on two INDEPENDENT axes that
are **summed**; within an axis only the strongest form counts (the weaker forms
describe the same underlying fact, so stacking them would double-count):

- **Connection axis** (strongest wins): same-lineup pair **4** · ex-teammates
  (shared a real lineup in their careers) **3** · shared org **2.5**.
- **Heritage axis** (strongest wins): same country **2.5** · same region **1.5**.

So a same-country pair who also shared an org scores **2.5 + 2.5 = 5**, not just
the strongest single link — the additive rework's whole point.

On top of the pair axes (additive supplements): org loyalty **2**/player whose
drafted card org matches the drafted org · coach link **2** (cap **3**) · sub
link **2** (cap **2**) · staff nationality bonus **0.5** (region-only match
counts at half, `staffRegionFactor` 0.5).

**Max raw = 10** (real historical trios saturate well past it and cap at 100%).

Tiers by percent: **Perfect ≥100 · Great ≥70 · Good ≥40 · Okay ≥18 · Poor <18**.
Perfect is a **full bar (100% only)**. Three same-country players land Great
(3 pairs × 2.5 = 7.5 → 75%); a real connection on top is what completes the bar.

Note: AI historical lineups saturate to Perfect (a true trio is ~19+ raw, capped
to 100%). The user trades raw overall vs chemistry — the intended draft tension.

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
- `SPECIALS.rarityChance` (v1.4 rework — **absolute per-rarity** rates): rare
  **0.045** · epic **0.036** · mythic **0.03** · legendary **0.01** · creator
  **0.006**. Each rarity the person OWNS is rolled INDEPENDENTLY, **rarest
  first** (`rarityOrder` = creator → legendary → mythic → epic → rare); the
  first tier to proc supplies the card. This decouples a rarity's appearance
  rate from how many cards the player has of it (the old weighted-pick model
  meant a lone-legendary player showed their legendary every time a special
  procced). Overall special rate stays ~1.6%/offer slot; legendaries ~4× rarer.
  Coaches roll their own pool with the same table.
- `SPECIALS.rankBaselineChance` (**0.04**): the baseline (Bronze–Platinum)
  special-appearance chance. `RANK_REWARDS.specialChance` ramps it from Diamond
  up; `specialChanceMult = specialChance / rankBaselineChance` scales every
  per-rarity rate together (Diamond ×1.5 · Champion ×2.25 · GC ×3 · SSL ×4).
- `RANK_REWARDS` rarity unlocks & appearance ramp (v1.4): each rank
  Bronze→Platinum unlocks one new visible rarity (rare → epic → mythic →
  **legendary at Platinum**); from Diamond on nothing new unlocks but the
  appearance chance ramps: **Bronze–Platinum 4% → Diamond 6% → Champion 9% →
  GC 12% → SSL 16%**. `creator` is the secret dev card — eligible from Bronze
  at its own tiny rate, never surfaced as an "unlocks at" message. The Creator
  special grants a **+7** overall boost (schema cap raised to 7).
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

## MMR (`MMR`, v1.4)

A cosmetic "skill rating" parallel to XP — surfaced on the profile card, results
screen and leaderboard; it never touches gameplay. Everyone starts at **1000**.
It rises **only on a tournament title** (or a Legacy grand final) and is never
spent or lost (cloud merge takes the max). The flat per-title `award` table is the
whole economy — no placement curve, no difficulty multiplier:

| Outcome | MMR |
| --- | --- |
| Easy title | 1 |
| Normal title | 1 |
| Hard title | 3 |
| Legacy grand finalist (runner-up) | 5 |
| Legacy title | 9 |

Live gains are linear and tiny, so climbing past ~1500 (the elite band) is a real
grind. `backfillCap` (**1600**) clamps the retroactive value for pre-rework
profiles: a saturating curve (`backfillScale` K = 120) of a profile's title
history lands the best current players near 1600 and a fresh account at ~1000.
Functions: `mmrRawGain`, `mmrAfterRun`, `mmrBackfillFloor`.

## Challenges (`CHALLENGE`, v1.4)

20 authored puzzles — a constrained draft then a single **Bo7** vs a fixed boss.
Rerolls scale with the challenge's sim difficulty via
`CHALLENGE.rerollsByDifficulty`: **easy 8 · normal 5 · hard 3 · legacy 0** (the
easy tiers let you assemble freely; the brutal ones make every pick count). The
named challenge tiers map onto the difficulty enum (very-easy → easy, normal →
normal, hard → hard, very-hard → legacy).

## Playtest workflow

1. Change a knob in `balance.ts`.
2. `npm test` — anchors still green?
3. Play one Easy and one Hard run; watch the Swiss table: the user should
   make playoffs *often* on Easy with a 90+ team, and *fight for it* on Hard.
4. Log findings in `docs/CHANGELOG.md` under "Balance".
