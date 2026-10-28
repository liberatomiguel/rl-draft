# Road to Worlds — status (current state only)

> Last updated: 2026-10-28. Spec: `ROAD-TO-WORLDS-DESIGN.md` (grep the section
> you need). Why: `ROAD-TO-WORLDS-DECISIONS.md` R1–R41. History: `CHANGELOG.md`
> `[1.5.0-alpha]` and `[2.0.0]`. Do not read any of them whole.

## Run / verify

- `npm run dev` → home card "Road to Worlds" → `/career` wizard → HQ.
- Career tests: `npx vitest run src/engine/career src/store/career
  src/components/career` (part of the full suite, 659 tests at rc.28; the
  weekend lives in `src/store/careerWeekend.test.ts`).
- Flag `FEATURES.careerMode` (balance.ts): on in dev/tests; production builds
  only with `NEXT_PUBLIC_CAREER_MODE=1` (staging Worker has it). `/career` is
  always noindex; with the flag off the routes are not exported.

## Map (where each system lives)

| System | Engine | Flow / store | Screen |
|---|---|---|---|
| Calendar, day clock, the weekend (R40: Sat qualifier → Sun regional; Major/Worlds Sat Swiss → pause → Sun playoffs) | `engine/career/calendar.ts` (`playoffsDayFor`, `eventEndDayFor`) | `store/careerFlow.ts` `processDayArrival`, `eventDayPhaseOf`, `continueEventToNextDayFlow` | `screens/CalendarScreen.tsx`, `event/weekendView.ts` + `WeekendPlan`, `SwissCompletePanel`, `ChampionshipSunday` |
| World, fields, seeding, local scene, real-org intake | `worldSim.ts`, `localScene.ts` | rollover in `careerFlow.ts` | `EventScreen.tsx` |
| Results, standings, qualified refs (`qualifierOutcomeOf`, `hasChampion`) | `careerResults.ts` | `finishEvent` | `StandingsScreen.tsx` |
| Match Center story: goal timeline, clock, OT (R41) | `matchTimeline.ts` | — | `event/CareerMatchCenter.tsx`, `GameClock.tsx`, `clockPlayback.ts`, `EventScreen.tsx` |
| Development, drills, ETA, coach effects | `development.ts` | `applyDailyTraining`, `setDrillFlow` | `TrainingScreen.tsx` |
| Economy: weekly payroll, bank loan, sponsors, gear | `economy.ts` | `runWeeklyPayroll`, `takeBankLoanFlow` | `FinancesScreen.tsx` |
| Market, negotiation, coaches | `market.ts` | `signPlayerFlow`, `hireCoachFlow` | `MarketScreen.tsx` (`#coaches`) |
| Inserts (weekly decision cards) | `inserts.ts` + `data/career/inserts.ts` | `resolveInsertFlow` | hub `NowCards.tsx` |
| Achievements (permanent, cross-save) | `achievements.ts` + `data/career/achievements.ts` | `careerStore` `settleAchievements` | `ClubScreen.tsx` |
| HQ | — | — | `HubScreen.tsx` + `hub/DayCard.tsx` (timeline + inline insert), `SquadBlock.tsx`, `TrainingBlock.tsx`, `NowCards.tsx` |

Tunables: `CAREER_*` blocks in `src/config/balance.ts`. Copy: `copy.career.en.ts`
/ `.pt.ts` via `useCareerCopy()`. Save shape: `engine/career/types.ts`
(`CareerSave`, persist v3 frozen, saveVersion 4: additive migrations up to
`migrateSaveToV4`, run on every load).

## v2.0 state

Built: the v2.0 guide's Part 3 (R20–R34) and the rc.2 UX pass (R35–R37) —
weekly payroll, bank loan, coach effects, HQ around the day card, Training 2.0,
local amateur scene, real orgs by season, permanent achievements, weekly
inserts, colour kits.
rc.24 (R39): real players use their real birth year (364 from the base
export; others keep the inferred debut age; existing careers keep theirs), and
the FIFAe national cards stay out of the career's card history.
rc.28: the weekend calendar (R40 — Saturday Swiss-only qualifier → Sunday
regional; Major/Worlds Saturday Swiss → pause → Championship Sunday) and the
Match Center timeline (R41 — varied goal order, game clock, OT beat and golden
goal, presentation only).

## Remaining / open

- Manual playtest on staging (plan §7 career line): creation → first week →
  Saturday qualifier → Sunday regional (watch and instant); a Major weekend
  (Saturday → pause → Championship Sunday, a reload in between); an OT game in
  the Match Center; payroll; loan; drill; insert.
- Miguel to confirm (defaults shipped): PT keeps "Championship Sunday"; the
  flat 9 %/3 % qualifier prize (ECO-01); a weekend you only watch is not an
  Advance stop; OT games take ~6-7 s at 1× (`CAREER_MATCH_CLOCK`); in your own
  qualifier the local sides are rated around YOUR team (a strong user who
  drops out of the direct 8 meets strong locals).
- Content: scripted beats corpus (~30, EN+PT). New birth dates go in the base
  export (`BIRTHDAY`), not in `born:` rows.
- `CAREER_ARC` pacing harness (120-career sweep) not built; economy bands need
  re-validation after Miguel plays.
- Deferred by design: org relocation, t1 circuit, PvP.

## Guardrails

- Engine pure and seeded; no React in `src/engine`. Game logic never in screens.
- Never bump the career persist version without an additive migrate and a
  DESIGN-DECISIONS entry (the contract test freezes it).
- Golden master (`regression.golden.test.ts`) locks the shared sim; regenerate
  only with a CHANGELOG-documented decision.
