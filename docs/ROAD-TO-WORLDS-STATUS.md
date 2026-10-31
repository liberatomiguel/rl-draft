# Road to Worlds — current state

> Last updated: **2026-10-30**. Candidate: **v2.0.0-rc.36**, `staging`.
> Decisions: `ROAD-TO-WORLDS-DECISIONS.md` R1–R88. Gate: `RC36-GATE3B.md`.

## Run and verify

- Dev: home → Road to Worlds → wizard → HQ. Production stays off until the
  approved cutover; staging enables NEXT_PUBLIC_CAREER_MODE=1 and noindex.
- Career logic is in `src/engine/career`, flows in `src/store/career*`, screens
  in `src/components/career`. Pure seeded engine, bilingual career copy,
  tunables in `src/config/balance.ts`.
- Full suite: 1438 passed, 13 optional checks skipped. Typecheck,
  lint, data, static build and browser gates: `RC36-GATE3B.md`.
- Probes: CAREER_ARC (run alone; never with ARC_REPORT), CAREER_ECON (four
  processes by ECON_REGIONS), CAREER_GROWTH, CAREER_TRAINING; latest reports
  use the rc36 suffix. `ECONOMY-CONTRACT.md` §13 compares guardrails.

## Gate 3b candidate

Etapa 3 is complete: POL-01..04 and UX-02..05/CAL-01/SUN-01..03, with an
independent integration review. Miguel's playtest approval is still required.

- Training starts only after a plan is selected, in 28-day periods. Evolve,
  Gel, Recover; focus restored; modest Heavy/Hard wear; running progress;
  most gain along the way, remainder on completion. Coach plans can renew
  cycles; without one restart by hand. rc.35's active 14-day period finishes
  before the new grid. Signings join the plan; no duplicate session or payout.
- Compact HQ, squad/sub/coach, progression, finances and stacked arsenal;
  unlock modal is Close-only. Sponsor cards in a modal, Decide later until
  deadline. Contract responses arrive only after sending; refusals raise the
  floor and each lever counts.
- Same founding budget by difficulty, fitted founding wages, no Merch &
  streams income. Seasonal free-agent prospect replenishment and listing;
  slower generated-player growth, later peak, season ceiling 8.5. Normal
  pace: 0.4562 Majors/season, Worlds in 17.12% of season rows.
- Fixed season goals with deadline/progress, visual news with honest archive
  labels, career achievements in the general mode-filtered list. 50/50 stays
  behind the brand key pending partner agreement.
- Custom crest shapes/symbols/layouts, independent colours and contrast guard;
  calendar windows blue, events take priority, no payroll marker.
- Saturday returns to HQ, optional coach briefing and conscious Sunday start;
  no extra training/payroll. Skippable once-only full-screen intro with keyboard
  focus and reduced motion. Watch/sim/skip events after elimination.

## System map

| System | Engine → flow → screen |
|---|---|
| Calendar, weekend, follow | calendar/sunday/follow → careerFlow/careerSunday → CalendarScreen, SundayCard, ChampionshipSunday, FollowScreen |
| Fields, races, local scene | worldSim/localScene/careerResults/raceTable → careerFlow → StandingsScreen, RaceBlock, event/ |
| Growth, training, coaches | development/training → careerTraining → TrainingScreen, TrainingBlock |
| Money, loans, gear, sponsors | economy/sponsorDeals → careerFlow/careerHq → FinancesScreen, FinanceBlock, SponsorDecisionPrompt |
| Contracts, free agents | market/renewal/contract → careerFlow → MarketScreen, SalaryNegotiator, SquadScreen |
| Goals, news, achievements | seasonGoals/beats/achievements → careerFlow/careerStore → SeasonGoalBlock, NewsFeed, AchievementsGrid |
| Queue, creation, migration | careerNew/difficulty/types → careerDecisions/careerFlow → DecisionBlock, WizardScreen |

## Open and frozen contracts

- Gate 3b retains the explicit loan rules, EU spending-policy risk, wage-budget,
  scouting-band and older-roster rebuild decisions in ROADMAP.
- Scripted news corpus is still partial; partner artwork/permission pending.
- Career persist version **3**, saveVersion **5**, unchanged: repairs additive
  on every load. Permanent achievement marks survive save/season resets.
- Organization relocation, t1 circuit and PvP remain deferred. Next stage only
  after Miguel approves Gate 3b.
