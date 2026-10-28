# Road to Worlds — status (current state only)

> Last updated: 2026-10-27. Spec: `ROAD-TO-WORLDS-DESIGN.md` (grep the section
> you need). Why: `ROAD-TO-WORLDS-DECISIONS.md` R1–R39. History: `CHANGELOG.md`
> `[1.5.0-alpha]` and `[2.0.0]`. Do not read any of them whole.

## Run / verify

- `npm run dev` → home card "Road to Worlds" → `/career` wizard → HQ.
- Career tests: `npx vitest run src/engine/career src/store/careerFlow.test.ts
  src/store/careerV03.test.ts src/store/careerV2.test.ts
  src/store/careerStore.achievements.test.ts` (part of the full suite, 563 tests at rc.27).
- Flag `FEATURES.careerMode` (balance.ts): on in dev/tests; production builds
  only with `NEXT_PUBLIC_CAREER_MODE=1` (staging Worker has it). `/career` is
  always noindex; with the flag off the routes are not exported.

## Map (where each system lives)

| System | Engine | Flow / store | Screen |
|---|---|---|---|
| Calendar, day clock, qualifier defs | `engine/career/calendar.ts` | `store/careerFlow.ts` `processDayArrival` | `screens/CalendarScreen.tsx` |
| World, fields, seeding, local scene, real-org intake | `worldSim.ts`, `localScene.ts` | rollover in `careerFlow.ts` | `EventScreen.tsx` |
| Results, standings, qualified refs | `careerResults.ts` | `finishEvent` | `StandingsScreen.tsx` |
| Development, drills, ETA, coach effects | `development.ts` | `applyDailyTraining`, `setDrillFlow` | `TrainingScreen.tsx` |
| Economy: weekly payroll, bank loan, sponsors, gear | `economy.ts` | `runWeeklyPayroll`, `takeBankLoanFlow` | `FinancesScreen.tsx` |
| Market, negotiation, coaches | `market.ts` | `signPlayerFlow`, `hireCoachFlow` | `MarketScreen.tsx` (`#coaches`) |
| Inserts (weekly decision cards) | `inserts.ts` + `data/career/inserts.ts` | `resolveInsertFlow` | hub `NowCards.tsx` |
| Achievements (permanent, cross-save) | `achievements.ts` + `data/career/achievements.ts` | `careerStore` `settleAchievements` | `ClubScreen.tsx` |
| HQ | — | — | `HubScreen.tsx` + `hub/DayCard.tsx` (timeline + inline insert), `SquadBlock.tsx`, `TrainingBlock.tsx`, `NowCards.tsx` |

Tunables: `CAREER_*` blocks in `src/config/balance.ts`. Copy: `copy.career.en.ts`
/ `.pt.ts` via `useCareerCopy()`. Save shape: `engine/career/types.ts`
(`CareerSave`, persist v3, additive migrations `migrateSaveToV3`).

## v2.0 state

All Part 3 asks of the v2.0 guide are built (R20–R34), plus the rc.2 UX pass
(R35–R37: hub v3 hierarchy, rare blocking inserts, regional local names): weekly payroll + bank
loan + loans panel; sub-slot signing fix; coach deep link + explicit effects;
HQ rebuilt around the day card; Training 2.0 (weekly drill, growth ETA,
attribute effects, scrim tiers); Wednesday qualifier + local amateur scene;
real orgs enter by season; permanent achievements; weekly inserts; colour kits.
rc.24 (R39): real players use their real birth year (364 from the base
export; others keep the inferred debut age; existing careers keep theirs), and
the FIFAe national cards stay out of the career's card history.

## Remaining / open

- Manual playtest on staging (plan §7 career line): creation → first week →
  qualifier → regional; payroll; loan; drill; insert.
- Content: scripted beats corpus (~30, EN+PT). Birth dates now come from the
  base export (`BIRTHDAY` in the generator); more go there, not in `born:` rows.
- `CAREER_ARC` pacing harness (120-career sweep) not built; economy bands need
  re-validation after Miguel plays.
- Deferred by design: org relocation, t1 circuit, PvP.

## Guardrails

- Engine pure and seeded; no React in `src/engine`. Game logic never in screens.
- Never bump the career persist version without an additive migrate and a
  DESIGN-DECISIONS entry (the contract test freezes it).
- Golden master (`regression.golden.test.ts`) locks the shared sim; regenerate
  only with a CHANGELOG-documented decision.
