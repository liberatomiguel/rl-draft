# Road to Worlds — status (current state only)

> Last updated: 2026-10-29. Spec: `ROAD-TO-WORLDS-DESIGN.md` (grep the section
> you need). Why: `ROAD-TO-WORLDS-DECISIONS.md` R1–R49. History: `CHANGELOG.md`
> `[1.5.0-alpha]` and `[2.0.0]`. Do not read any of them whole.

## Run / verify

- `npm run dev` → home card "Road to Worlds" → `/career` wizard → HQ.
- Career tests: `npx vitest run src/engine/career src/store/career
  src/components/career` (part of the full suite; the weekend lives in
  `src/store/careerWeekend.test.ts`, the save repair in `careerRepair.test.ts`).
- Opt-in instruments (commands in each file's header): the long-career
  harness `CAREER_ARC=1` / `CAREER_CURVES=1` (`careerArc.test.ts` + the bot
  `careerArcBot.ts`; baseline `CAREER-BASELINE-rc30.md`), the money probe
  `CAREER_ECON=1` (`careerEconomy.probe.test.ts`, ~35 min) and local sides in
  the fields `RTW_LOCALS=1` (`careerRace.test.ts`).
- Flag `FEATURES.careerMode` (balance.ts): on in dev/tests; production builds
  only with `NEXT_PUBLIC_CAREER_MODE=1` (staging Worker has it). `/career` is
  always noindex; with the flag off the routes are not exported.

## Map (where each system lives)

| System | Engine | Flow / store | Screen |
|---|---|---|---|
| Calendar, day clock, the R40 weekend | `calendar.ts` (`playoffsDayFor`) | `careerFlow.ts` `processDayArrival`, `eventDayPhaseOf` | `CalendarScreen.tsx`, `event/weekendView.ts`, `ChampionshipSunday` |
| Direct-8 seeding (R45, `competition.weekSeeding`) | `worldSim.ts` `regionalSeedingFor` | `userSeedRatingFor`, `userIsDirect` | `event/lobbyField.ts` |
| World, fields, seeding, local scene (R49 anchor `localAnchorFor`), real-org intake | `worldSim.ts`, `localScene.ts` | rollover, Monday block in `careerFlow.ts` | `EventScreen.tsx`, `event/lobbyField.ts` |
| Name banks by role, rookie gamertags (R42) | `data/career/names.ts`, `localScene.ts`, `development.ts` | `world.rookieNames` | — |
| Reveal cursor, spoiler hold (R43) | — | `careerRevealStore.ts` (sessionStorage) | `event/eventPlayback.ts`, `careerUi.ts` `useRevealHeldEventId` |
| Results, standings, qualified refs, the R49 race tables | `careerResults.ts`, `raceTable.ts` | `finishEvent`, `careerUi.raceTableOf` | `StandingsScreen.tsx`, `hub/RaceBlock.tsx` |
| Match Center timeline, clock, OT (R41) | `matchTimeline.ts` | — | `event/CareerMatchCenter.tsx`, `GameClock.tsx` |
| Development, drills, ETA, coach effects, ages and retirement (R48 `retirementChanceFor`) | `development.ts`, `worldSim.ts` | `applyDailyTraining`, `setDrillFlow`, rollover | `TrainingScreen.tsx` |
| Economy: weekly payroll, Emergency Backer, bank loan, sponsors, gear | `economy.ts` (`weeklyPayroll`, `debtPaymentFor`) | `runWeeklyPayroll`, `payDebtFlow`, `takeBankLoanFlow` | `FinancesScreen.tsx` |
| Market, negotiation, coaches (R47 `signingPlanFor`, cap 4) | `market.ts` | `signPlayerFlow`, `renewPlayerFlow`, `hireCoachFlow` | `MarketScreen.tsx` (`#coaches`) |
| Inserts (weekly decision cards) | `inserts.ts` + `data/career/inserts.ts` | `resolveInsertFlow` | hub `NowCards.tsx` |
| Achievements (permanent, cross-save) | `achievements.ts` + `data/career/achievements.ts` | `careerStore` `settleAchievements` | `ClubScreen.tsx` |
| HQ | — | — | `HubScreen.tsx` + `hub/` (`DayCard`, `SquadBlock`, `RaceBlock`, `NowCards`) |

Tunables: `CAREER_*` blocks in `src/config/balance.ts`. Copy: `copy.career.en.ts`
/ `.pt.ts` via `useCareerCopy()`. Save shape: `engine/career/types.ts`
(`CareerSave`, persist v3 frozen, saveVersion 5: additive migrations up to
`migrateSaveToV5` run on every load).

## v2.0 state

Built: the v2.0 guide's Part 3 (R20–R34), the rc.2 UX pass (R35–R37), real
birth years (R39), the weekend calendar (R40), the Match Center timeline
(R41), the rc.29 E2E fixes (R42–R44), rc.30's direct-8 week decision and
one-time save repair (R45), and rc.31's Etapa 2b part 1 (R46–R49: the
Backer/bank integrity, the sub contract and a bid-free first window,
longevity, local sides in the races with the two tables). Details: the R
entries.

## Remaining / open

- Manual playtest on staging: V2 plan §7's career line plus rc.31's list
  (`ROADMAP.md`, "Waiting on Miguel").
- Miguel to confirm: the career decisions in `ROADMAP.md` ("Waiting on
  Miguel").
- Content: scripted beats corpus (~30, EN+PT). New birth dates go in the base
  export (`BIRTHDAY`), not in `born:` rows.
- The money: `ECONOMY-CONTRACT.md` (ECO-01) waits on Miguel's ten
  decisions; no number moves before. Insolvent careers: 64 % on rc.30, 68 %
  on rc.31 (Normal 67 → 76 %): the late break grew with DEV-02 and ECO-03
  (the contract's §8).
  Next in 2b: the contract's packages, DEV-01 (growth), BAL-02 (presets),
  each re-measured on the same seeds.
- Deferred by design: org relocation, t1 circuit, PvP.

## Guardrails

- Engine pure and seeded; no React in `src/engine`. Game logic never in screens.
- Never bump the career persist version without an additive migrate and a
  DESIGN-DECISIONS entry (the contract test freezes it).
- Golden master (`regression.golden.test.ts`) locks the shared sim; regenerate
  only with a CHANGELOG-documented decision.
