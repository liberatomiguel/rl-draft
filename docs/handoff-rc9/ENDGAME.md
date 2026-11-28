# rc.9 ENDGAME handoff (28/11)

Branch `rc9/endgame`. Decisions R230-R235 (ROAD-TO-WORLDS-DECISIONS.md), CHANGELOG `## rc.9 (unreleased)`.

## Files

`config/balance.ts` (coaches window, `lifeFromSeasonIndex`, `CAREER_ENDLESS.late`), `engine/career/worldLife.ts` (`coachLifeOn`, `coachLifecycle`, `marketCoachRetiredBy`, `marketCoachAge`), `engine/career/market.ts` (`staffRetired`, `staffAge`), `engine/career/endless.ts` (`projectsAt`), `store/careerFlow.ts` (marked block), tests `worldLife.test.ts`, `endless.test.ts`, `stagingFlags.test.ts`, probes `careerEndgameRc9.probe.test.ts` (new), `careerEndless.probe.test.ts` (EP_DUMP_AT / EP_FROM / EP_LATE).

## 1. Coaches (done)

Retire 28-35 from season 1. Exit age of 400 generated coaches: 28: 24, 29: 26, 30: 56, 31: 57, 32: 82, 33: 69, 34: 57, 35: 29. Real coaches past 35 at the start: 0 (43 of 146 have a birthday, all 27 or younger in 2020; ages are drawn 24-32).

| Season (NA career) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AI coach changes, 7 regions (57 coached orgs) | 5 | 11 | 6 | 8 | 6 | 9 | 20 | 26 | 25 | 30 | 27 |

S1-S5 are retirements only; S6+ adds sackings and project swaps. Market, every region, every season, 3 careers: 6 names (2 dataset, 2 ex-pro, 2 generated), best 80-91. User coach mails seen: announce S1, leaves S2; announce S7, leaves S8 (NA).

## 2. Formats (verified, no change)

NA to S11: S6 = Season X row ... S11 = 2026 row; the user played Majors/Worlds in those layouts.

## 3. Real orgs at Worlds (no fade to S11)

Worlds field of 16, real orgs per season S1..S11:

| career | values |
|---|---|
| NA on / off | 12 13 12 13 15 15 14 14 16 15 15 / 13 13 13 11 12 13 15 14 15 14 15 |
| EU on / off | 12 13 11 12 14 13 14 14 15 15 15 / 13 13 12 11 14 14 15 15 16 14 15 |
| SAM on / off | 14 13 12 11 13 15 14 13 14 13 14 / 14 13 14 13 14 14 15 15 15 15 14 |

Locals at Worlds 0-3 in S1-S6, 0-1 after. Top 8 real: NA/EU 4-8, SAM 3-8; Locals rise in the user's own region once he is 93+ (anchor follows him, R49). No rule added.

## 4. Top too easy (missed 30 %)

Floor 99 from S6, Normal, NA/EU/SAM x 2 seeds, all staging flags, S8-S15 from the same S7 saves:

| arm | Worlds at 100+ | sides within 3 | series | best AI |
|---|---|---|---|---|
| base (round 2) | 23/42 (55 %) | 2.76 | 89.9 % | 99.0 |
| A1 full kit, more projects | 16/39 (41 %) | 3.77 | 86.6 % | 99.5 |
| A2 (shipped) + 6 projects, APAC | 13/37 (35 %) | 3.74 | 86.7 % | 99.8 |

Early guard (coach life on vs rc.8, S0-S7, 1 seed per cell, NA/EU/SAM x Normal/Hard): Worlds titles 3 vs 3; S6-S7 titles won in both arms (NA Hard S6, SAM S7). Noise dominates; no sign of harder.

## 5. Money: R235 (three proposals, none built)

## Checks

Soft-lock, all 12 flags: founded 7 regions x 2 policies x 7 seasons, takeover era 6 NA/EU/SAM x 2 x 4: 0 findings. Flag-off hashes pass unrefreshed; `balanceVersion.test.ts` fails as expected (new exports). tsc clean.

## Not verified

Beyond S11 for item 3; Hard/Easy for the late arms; human play; no browser.
