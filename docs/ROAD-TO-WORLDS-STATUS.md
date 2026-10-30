# Road to Worlds — status (current state only)

> Last updated: 2026-10-30. Spec: `ROAD-TO-WORLDS-DESIGN.md` (grep the section
> you need). Why: `ROAD-TO-WORLDS-DECISIONS.md` R1–R60. History: `CHANGELOG.md`
> `[1.5.0-alpha]` and `[2.0.0]`. Do not read any of them whole.

## Run / verify

- `npm run dev` → home card "Road to Worlds" → `/career` wizard → HQ.
- Career tests: `npx vitest run src/engine/career src/store/career
  src/components/career` (part of the full suite; the weekend lives in
  `src/store/careerWeekend.test.ts`, the save repair in `careerRepair.test.ts`).
- Opt-in instruments (commands in each file's header): `CAREER_ARC=1` /
  `CAREER_CURVES=1` (`careerArc.test.ts`, the bot `careerArcBot.ts`; runs
  `CAREER-BASELINE-rc30.md`, `CAREER-ARC-rc32.md`), `CAREER_ECON=1`
  (`careerEconomy.probe.test.ts`; `ECONOMY-PROBE-rc31.md` / `-rc32.md`),
  `CAREER_GROWTH=1` (`CAREER-GROWTH-rc32.md`), `RTW_LOCALS=1`.
- Flag `FEATURES.careerMode` (balance.ts): on in dev/tests; production builds
  only with `NEXT_PUBLIC_CAREER_MODE=1` (staging Worker has it). `/career` is
  always noindex; with the flag off the routes are not exported.

## Map (where each system lives)

| System | Engine | Flow / store | Screen |
|---|---|---|---|
| Calendar, day clock, the R40 weekend | `calendar.ts` (`playoffsDayFor`) | `careerFlow.ts` `processDayArrival`, `eventDayPhaseOf` | `CalendarScreen.tsx`, `event/weekendView.ts`, `ChampionshipSunday` |
| Direct-8 seeding (R45, `competition.weekSeeding`) | `worldSim.ts` `regionalSeedingFor` | `userSeedRatingFor`, `userIsDirect` | `event/lobbyField.ts` |
| World, fields, seeding, local scene (R49 anchor `localAnchorFor`), real-org intake (R66 `orgIntake`) | `worldSim.ts`, `localScene.ts` | rollover, Monday block in `careerFlow.ts` | `EventScreen.tsx`, `event/lobbyField.ts` |
| Name banks by role, rookie gamertags (R42) | `data/career/names.ts`, `localScene.ts`, `development.ts` | `world.rookieNames` | — |
| Reveal cursor, spoiler hold (R43) | — | `careerRevealStore.ts` (sessionStorage) | `event/eventPlayback.ts`, `careerUi.ts` `useRevealHeldEventId` |
| Results, standings, qualified refs, the R49 race tables | `careerResults.ts`, `raceTable.ts` | `finishEvent`, `careerUi.raceTableOf` | `StandingsScreen.tsx`, `hub/RaceBlock.tsx` |
| Match Center timeline, clock, OT (R41) | `matchTimeline.ts` | — | `event/CareerMatchCenter.tsx`, `GameClock.tsx` |
| Development (model 2, R55–R57 `developmentProfileOf`), drills, coach effects, the age clock (R54) and retirement (R48) | `development.ts`, `worldSim.ts` | `applyDailyTraining`, `setDrillFlow`, rollover | `TrainingScreen.tsx` |
| Economy: the money index (R50, R62), payroll, breaches by difficulty and Easy's rescue partner (R61 `breachesToEndFor`, `backerLineFor`), the Monday ring (R63), bank, sponsors, gear | `economy.ts` | `runWeeklyPayroll`, `weeklyStatementOf`, `runwayWeeksOf`, `mondayBalancesOf`, `repairMoneyOnLoad` | `FinancesScreen.tsx`, `finances/BalanceHistory.tsx` |
| Market, coaches (R47), renewals (R58, R69 jump cap + title raise), the contract talk and the prize share (R64), honest bands (R65) | `market.ts`, `renewal.ts`, `contract.ts` | `signPlayerFlow`, `renewPlayerFlow`, `renewalTermsOfSave`, `signingTalkFor` | `MarketScreen.tsx`, `SalaryNegotiator.tsx`, `RenewalReadout.tsx` |
| Reputation, the newcomer's path (R68) | `reputation.ts` | `finishEvent` | event digest |
| A full squad to play (R67) | — | `squadHoldFor`, `emptySeatPriceFor` | hub `NowCards.tsx` |
| Presets, the career's difficulty (R59) | `difficulty.ts` | `createCareerSave` | `WizardScreen.tsx` |
| Analytics (#145) | — | `careerAnalytics.ts` | — |
| Inserts (weekly decision cards) | `inserts.ts` + `data/career/inserts.ts` | `resolveInsertFlow` | hub `NowCards.tsx` |
| Achievements (permanent, cross-save) | `achievements.ts` + `data/career/achievements.ts` | `careerStore` `settleAchievements` | `ClubScreen.tsx` |
| HQ | — | — | `HubScreen.tsx` + `hub/` (`DayCard`, `SquadBlock`, `RaceBlock`, `NowCards`) |

Tunables: `CAREER_*` blocks in `src/config/balance.ts`. Copy: `copy.career.en.ts`
/ `.pt.ts` via `useCareerCopy()`. Save shape: `engine/career/types.ts`
(`CareerSave`, persist v3 frozen, saveVersion 5: additive migrations up to
`migrateSaveToV5` run on every load).

## v2.0 state

Built: the v2.0 guide's Part 3 (R20–R34), the rc.2 UX pass (R35–R37), R39
(real birth years), R40–R44 (the weekend, the Match Center, the rc.29 E2E
fixes), R45 (the direct-8 week, the save repair), rc.31's Etapa 2b part 1
(R46–R49) and rc.32's part 2 (R50–R60: the economy mechanisms as
**provisional defaults**, renewals, growth model 2, the presets, the age
clock, the review's fixes).

## Remaining / open

- **Next: Etapa 2b part 3** (`ROADMAP.md` Etapa 2): Miguel's 30/10 answers
  on rc.32 replace several provisional defaults (ECO-07–12, RTW-02–05,
  DEV-04, UX-07, BAL-04); the rest stay provisional until he confirms.
- Content: scripted beats corpus (~30, EN+PT). New birth dates go in the base
  export (`BIRTHDAY`), not in `born:` rows.
- The money: `ECONOMY-CONTRACT.md` §9. Still out of band: EU and NA (a trap
  since rc.30), the snowball at the top, guaranteed income (M7, held by
  9-B), the star path; APAC and SSA got easy. The next package waits on
  Gate 2.
- Deferred by design: org relocation, t1 circuit, PvP.

## Guardrails

- Engine pure and seeded; no React in `src/engine`. Game logic never in screens.
- Never bump the career persist version without an additive migrate and a
  DESIGN-DECISIONS entry (the contract test freezes it).
- Golden master (`regression.golden.test.ts`) locks the shared sim; regenerate
  only with a CHANGELOG-documented decision.
