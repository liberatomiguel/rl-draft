# Road to Worlds — status (current state only)

> Last updated: 2026-10-30. Spec: `ROAD-TO-WORLDS-DESIGN.md` (grep the section
> you need). Why: `ROAD-TO-WORLDS-DECISIONS.md` R1–R80. History: `CHANGELOG.md`
> `[1.5.0-alpha]` and `[2.0.0]`. Do not read any of them whole.

## Run / verify

- `npm run dev` → home card "Road to Worlds" → `/career` wizard → HQ.
- Career tests: `npx vitest run src/engine/career src/store/career
  src/components/career` (part of the full suite; the weekend lives in
  `src/store/careerWeekend.test.ts`, the save repair in `careerRepair.test.ts`).
- Opt-in instruments (commands in each file's header): `CAREER_ARC=1` /
  `CAREER_CURVES=1` (`careerArc.test.ts`, bot `careerArcBot.ts`; latest
  `CAREER-ARC-rc34.md`), `CAREER_ECON=1` (`careerEconomy.probe.test.ts`;
  latest `ECONOMY-PROBE-rc34.md`), `CAREER_GROWTH=1`, `CAREER_TRAINING=1`,
  `RTW_LOCALS=1`. Tests that walk the clock use `walkPastForTests`.
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
| Development (model 2, R55–R57 `developmentProfileOf`), the age clock (R54) and retirement (R48) | `development.ts`, `worldSim.ts` | `applyDailyTraining`, rollover | `TrainingScreen.tsx` |
| Training packages per period, scrim levels, coaches (R74–R75) | `training.ts` | `careerTraining.ts` (`trainingDayStart`, `trainingDecisionOf`, `repairTrainingOnLoad`) | `TrainingScreen.tsx`, `training/` (`TrainingPackageParts`, `CoachHireCard`) |
| Economy: the money index (R50, R62), payroll, the bank's emergency loan, its deadline and caps, the investor (R77 `weeklyPayroll`, `canSettleLoan`, `moneyRuleFor`), the money notice, the Monday ring (R63), the voluntary bank loan, gear | `economy.ts` | `runWeeklyPayroll`, `weeklyStatementOf`, `runwayWeeksOf`, `mondayBalancesOf`, `moneyNoticeOf`, `repairMoneyOnLoad`, `repairLoanOnLoad` | `FinancesScreen.tsx`, `finances/BalanceHistory.tsx`, `MoneyNoticeModal.tsx` |
| Sponsors: three profiles, dated goals, fines, ECO-05's cap, the handover (R76) | `sponsorDeals.ts` | `careerFlow.ts` (`sponsorDecisionOf`, `chooseSponsorFlow`, `repairSponsorsOnLoad`) | `sponsors/SponsorOfferCard.tsx`, Finances' deal panel |
| Market, coaches (R47), renewals (R58, R69 jump cap + title raise), the contract talk and the prize share (R64, R79 `talkPressFor`, share only above 79), honest bands (R65) | `market.ts`, `renewal.ts`, `contract.ts` | `signPlayerFlow`, `renewPlayerFlow`, `renewalTermsOfSave`, `signingTalkFor` | `MarketScreen.tsx`, `SalaryNegotiator.tsx`, `RenewalReadout.tsx` |
| Reputation, the newcomer's path (R68) | `reputation.ts` | `finishEvent` | event digest |
| A full squad to play (R67), skipping a regional (R73) | — | `squadHoldFor`, `emptySeatPriceFor` | hub `NowCards.tsx` |
| Presets, the career's difficulty (R59, R79), the start budget by roster (R78) | `difficulty.ts`, `economy.ts` `startingBudgetFor` | `createCareerSave` | `WizardScreen.tsx` |
| Analytics (#145) | — | `careerAnalytics.ts` | — |
| Inserts (weekly decision cards) | `inserts.ts` + `data/career/inserts.ts` | `resolveInsertFlow` | hub `NowCards.tsx` |
| Achievements (permanent, cross-save) | `achievements.ts` + `data/career/achievements.ts` | `careerStore` `settleAchievements` | `ClubScreen.tsx` |
| HQ: the decision queue (R71: `pendingDecisionsOf`, `clockHoldOf`, `DECISION_SOURCES`), the blocks (R72), "New" and the contract clock (R73) | `careerNew.ts` | `careerDecisions.ts`, `careerHq.ts` (`hqFinanceOf`) | `HubScreen.tsx` + `hub/` (`DecisionBlock`, `DayCard`, `SquadBlock`, `RaceBlock`, `FinanceBlock`, `ToolboxBlock`, `NowCards`), `ContractReview.tsx` |

Tunables: `CAREER_*` blocks in `src/config/balance.ts`. Copy: `copy.career.en.ts`
/ `.pt.ts` via `useCareerCopy()`. Save shape: `engine/career/types.ts`
(`CareerSave`, persist v3 frozen, saveVersion 5: additive migrations up to
`migrateSaveToV5` run on every load).

## v2.0 state

Built: the v2.0 guide (R20–R37), R39–R45 (birth years, the weekend, the
Match Center, the direct-8 week), Etapa 2b in rc.31–rc.33 (R46–R70) and
Etapa 3 in rc.34 (R71–R80: the decision queue and HQ, "New" and contracts,
training packages and coaches, sponsors, the bank's loan and its deadline,
the start budget by roster, the talk and the difficulty step). Values
Miguel left to Claude stay behind their keys, tested at Gates 2 and 3b.

## Remaining / open

- **Next in Etapa 3:** UX-02 season goals, UX-03 news and 50/50, UX-04
  creation, UX-05 RTW achievements in the general list, CAL-01 the calendar,
  SUN-01..03 the weekend (ROADMAP Etapa 3). Gate 3b is Miguel's play of
  rc.34.
- The money: `ECONOMY-CONTRACT.md` §11. Still out of band: EU on Normal
  (36 % of careers end on the loan's 48-week deadline), the snowball at the
  top (hands-off careers in weak regions banking T3–T4 base pay; the wage
  budget is the next lever), the star path. Hard is in its band since rc.34.
- Content: scripted beats corpus (~30, EN+PT). New birth dates go in the base
  export (`BIRTHDAY`), not in `born:` rows.
- Deferred by design: org relocation, t1 circuit, PvP.

## Guardrails

- Engine pure and seeded; no React in `src/engine`. Game logic never in screens.
- Never bump the career persist version without an additive migrate and a
  DESIGN-DECISIONS entry (the contract test freezes it).
- Golden master (`regression.golden.test.ts`) locks the shared sim; regenerate
  only with a CHANGELOG-documented decision.
