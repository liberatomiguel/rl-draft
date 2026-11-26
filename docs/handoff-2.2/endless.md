# v2.2 ENDLESS: the infinite seasons once a team dominates

Flag `FEATURES.endlessVariety`; `engine/career/endless.ts`, `store/endlessFlow.ts`, `CAREER_ENDLESS`. A save gets it at its next rollover (`save.endless`). Flag off: careers hash like rc.6 (`endlessFlagOff.test.ts`).

## Diagnosis

`careerEndless.probe.test.ts` (`ENDLESS_PROBE=1`, staging flags), bot `strong`, Normal, NA/EU/SAM × 2 seeds, 14 seasons. Two arms floor every squad player from S6 at 97 / 99 (team 100.3 / 101.2).

- At 100+: 56 of 62 Worlds won; 0.8–1.4 AI sides within 3 points.
- The best AI side stays 97–98; the world's three best AI players in one org rate 98–99. Transfers alone cannot catch 101.
- The Invitational is the user + the region's top 7 by points, seeded by rating: 2 distinct semi opponents a season, one of them 61–70 % of the semis.
- Seasons differ only by the cup-name rotation.

## Shipped (decisions)

- **R-ENDLESS-1 Rival projects** (from S7). Dominance = leader minus the next three (match ratings). 1.5+ starts one project, +1 per 0.75 (max 4); an AI leader needs 3. The leader's region goes first; the org is one of its best 4, not the leader nor last season's. Up to 3 swap signings (1-overall edge; any region from 2.5). Level 2+: the region's best coach and a one-season performance centre (the user's `perfCenter` +1.5). News `endlessProject` names signings and rating before/after.
- **R-ENDLESS-2 Cups.** Points top 2 kept, 5 drawn from places 3–12; bracket seeds 1–2 apart, the rest drawn. Lobby shares the helper.
- **R-ENDLESS-3 Legends.** 2 weeks a season, starters 93+: seven of the 18 best all-time lineups on their roster's special cards, no AI shift (field ~98). t2 prize and reputation, no points.
- **R-ENDLESS-4 Intercontinental.** 2 weeks: guests from the other regions' top 2.
- **R-ENDLESS-5 Hosts.** Four cities a season, in the news (`endlessHosts`).

## Before / after (Normal, 6 careers an arm, S6+)

| | base 97 | on 97 | base 99 | on 99 |
|---|---|---|---|---|
| Worlds won, seasons at 100+ | 22/22 | 21/24 | 34/40 | 30/40 |
| Worlds won, all S6+ | 67 % | 76 % | 81 % | 71 % |
| Majors won at 100+ | 65/69 | 72/78 | 115/125 | 104/127 |
| Major+Worlds series won at 100+ | 96.5 % | 95.4 % | 94.9 % | 91.5 % |
| AI sides within 3 at its Majors/Worlds | 0.8 | 1.4 | 1.4 | 1.8 |
| Semis: distinct opponents / semis | 139/572 | 307/568 | 138/565 | 325/569 |
| Most frequent semi opponent | 61 % | 38 % | 63 % | 35 % |
| Legends played / won | – | 66/43 | – | 66/51 |

Unfloored: S0–5 equal (Worlds 10 %, Majors 3 vs 4 of 27); S6+ Worlds 18 → 15 % (N 28), semis 98/423 → 199/417; no project ran. Hard, floor 97, 3 careers: 92 % at 100+ both arms.

## Step 3, honestly

Per-season formats: not feasible now. `SCHEDULE` is a constant; `CAREER_SLOTS` is read directly by careerResults, raceTable, sponsorDeals, calendar, Standings, Wizard; Major names come from `officialEventDefsForWeek` (no save). Result-driven slots need a `slotsFor(save, kind)` accessor first. A single-elim Major playoff loses the top-6 prize/points rows. Only hosts ship.

## Not done / not verified

- Step 4 (upsets), (c) poaching: not built. Easy: not measured. Browser: not checked.
- **45–60 % not reached:** 100 → 88 %, 85 → 75 %; S6+ aggregate within noise. Without created rating a project tops out near 100.
- Refresh the flag-off hashes after the merge (`ENDLESS_PRINT_BASE=1`).

## Miguel decides

1. Accept 75–88 % at 101, or allow a rating lever (e.g. projects without Normal's −1.6 AI shift)?
2. Keep the project performance centre (+1.5)?
3. Legends with no AI shift on Easy too?
