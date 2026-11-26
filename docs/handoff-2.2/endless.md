# v2.2 ENDLESS: the infinite seasons once a team dominates (rounds 1 and 2)

Flag `FEATURES.endlessVariety`. Code: `engine/career/endless.ts`, `store/endlessFlow.ts`; numbers: `CAREER_ENDLESS`. A save picks it up at its next rollover (`save.endless`). With the flag off, careers hash identically to rc.6 (`endlessFlagOff.test.ts`, passes on the merged base). Round 1 shipped the cups, Legends, Intercontinental and hosts unchanged (R-ENDLESS-2 to 5).

## Round 2 (decisions)

- **R-ENDLESS-6, the user's toolbox.** A project's kit holds only items the user can buy. Each one reads the user's own config:
  - facilities: pcs + perfCenter = org buff "+++" plus perfCenter's +1.5;
  - the region's best coach (a swap);
  - a bench reserve playing as the sub;
  - a bootcamp: the best camp's sharpness, under `tempRatingMax`;
  - a psychologist: `psychologistStatBonus`.

  Superteam compression applies to the kit as it does to the user. The project's news names the kit. The org sheet shows "Project, season n: …".
- **R-ENDLESS-7, dynasty scaling.**
  - The world answers the reigning Worlds champion while it sits within 1 point (`holdSlack`) of the top; otherwise it answers the leader. One rule for the user and for an AI.
  - A first defence needs a lead of 2 (`defenceFloor`). A run of 2+ titles is answered while it holds. An undefended lead is answered at 2.5.
  - Strength = consecutive titles (at least 1), +1 at a lead of 3 and +1 per further point, max 5. The kit holds 3 items at strength 1 and one more per step.
  - Cores stay together up to 3 seasons; a continuing project tops up one signing. A broken dynasty starts from zero.
  - One-season cores were not why projects topped out: AI chemistry is already full (shared lineup ids). The missing toolbox was.
- **R-ENDLESS-8, elite generation.** From 2 consecutive Worlds, M2.1's new promotions get +1 potential per further title (max +2, cap 99). New players only. News `endlessGeneration`.
- **R-ENDLESS-9, lever (c).** During a user dynasty (2+ titles), the strongest project bids for the user's best starter through the ordinary bid decision. One bid per window at most; 15 % chance a day. Fee = the ordinary bid at the top of `aiBidRange`. Refusable (test covers it).
- **Legends.** On Easy, Easy's usual AI shift applies; Normal and Hard play with no shift.

## Before / after

Normal, bot `strong` with squad floored from S6, NA/EU/SAM × 2 seeds = 6 careers per arm. The 99 arm runs 16 seasons (9 endless). Counts are seasons played at a team rating of 100+.

| | base 97 | on 97 | base 99 | on 99 |
|---|---|---|---|---|
| Worlds won | 22/22 | 21/27 | 45/52 | 30/53 |
| Majors won | 65/69 | 52/80 | 151/161 | 117/164 |
| Major+Worlds series | 96.5 % | 88.1 % | 95.5 % | 87.4 % |
| AI sides within 3 | 0.8 | 2.2 | 1.2 | 2.7 |
| Best AI side | 97.7 | 99.5 | 97.2 | 99.0 |
| Legends won | – | 34/48 | – | 57/84 |

- **Pooled 100–101:** Worlds 91 % (67/74) → **64 % (51/80)**.
- **By titles held going in (on arms):** 0: 18/31 Worlds, strength 2.2. 1: 14/21, 1.6. 2: 9/14, 2.4. 3+: 1/4, 4.3. Series 86 / 91 / 81 / 84 %. With the flag off, the same steps won 16/17, 22/24, 12/15 and 9/9.
- **Hard, floor 97, 3 careers:** Worlds 11/12 → 10/12; series 89.3 → 82.8 %; sides within 3: 2.1 → 2.8.
- **Easy, same arms:** Worlds 5/6 → 8/9; series 93.6 → 89.7 %.
- **Unfloored bot (guard), 6 careers:**
  - S0–5: same Worlds (1), Majors 3 vs 4; ratings differ only through cups.
  - S6+: Worlds 5/28 → 3/27, Majors 13/89 → 13/79, series 65.9 → 65.7 %.
  - Projects ran in about half of these seasons, against AI leaders.

## Not verified / open

- **Targets missed:** AI sides within 3 points average 2.2–2.7 (target 3+). A fifth defence was never reached: dynasties break earlier now, so the deepest step has N = 4.
- **Lever (c) is not in the Normal arms** (they started before it). It is in Hard/Easy. A confirming run (`fin-f99`) was still running at handoff.
- **Soft-lock probe:** unfloored bot, so it never reaches a user dynasty or a project bid. Those paths are covered only by `endlessFlow.test.ts`.
- **Guard noise:** the unfloored drop (5 → 3 Worlds in 27–28) is within noise but points down.
- No browser check (org sheet line).

## Miguel decides

1. Natural careers now meet projects that answer AI leaders. Keep that, or answer only user dynasties?
2. Lever (c) fee multiplier: the top of the AI bid range, or more?
