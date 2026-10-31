# Road to Worlds — current state

> Last updated: **2026-10-31**. Candidate: **v2.0.0-rc.36.3**, `staging`.
> Decisions: `ROAD-TO-WORLDS-DECISIONS.md` R1–R91. Gate: `CAREER-PACING-rc36-3.md`.

## Run and verify

- Dev: home → Road to Worlds → wizard → HQ. Production stays off until the
  approved cutover; staging enables NEXT_PUBLIC_CAREER_MODE=1 and noindex.
- Career logic is in `src/engine/career`, flows in `src/store/career*`, screens
  in `src/components/career`. Pure seeded engine, bilingual career copy,
  tunables in `src/config/balance.ts`.
- Full suite: 1449 passed, 15 optional checks skipped. Typecheck,
  lint, data, static build and 65 browser checks: `CAREER-PACING-rc36-3.md`.
- Probes: CAREER_ARC (run alone; never with ARC_REPORT), CAREER_ECON (four
  processes by ECON_REGIONS), CAREER_GROWTH, CAREER_TRAINING; latest reports
  use the rc36 suffix. `ECONOMY-CONTRACT.md` §13 compares guardrails.

## Gate 3b candidate

Etapa 3 is complete: POL-01..04 and UX-02..05/CAL-01/SUN-01..03, with an
independent integration review. Miguel's playtest approval is still required.

- Training starts only after a plan is selected, in 28-day periods. Evolve,
  Gel, Recover; focus restored; modest Heavy/Hard wear; running progress;
  most gain along the way, remainder on completion. Coach plans can renew
  cycles; without one, repeat the previous plan with one click. rc.35's active 14-day period finishes
  before the new grid. Signings join the plan; no duplicate session or payout.
- Compact HQ, squad/sub/coach, progression, finances and stacked arsenal;
  unlocks use notification/inbox, no automatic purchase sheet; weekly scrims
  sit under the calendar controls. Bootcamps are beside the HQ squad. Sponsor cards in a modal, Decide later until
  deadline. Contract responses arrive only after sending; refusals raise the
  floor and each lever counts.
- Same founding budget by difficulty, fitted founding wages, no Merch &
  streams income. Seasonal free-agent prospect replenishment and listing;
  slower generated-player growth, later peak, season ceiling 8.5. rc.36.3
  fits founding wages to 32/18 Normal/Hard weeks, reduces session/match pace
  and low-result reputation, and contains founding market jumps. 98 matched
  careers, 7 academy and 28 mixed-strategy careers; 63 finance-probe careers.
  First-Major timing improves among qualifiers, but regional timing and
  historical Worlds titles remain open. Match profiles are unchanged.
- Fixed season goals with +1/+2 reputation at review, deadline/progress;
  Sunday trade-offs, 15% common money growth and firmer renewals/coach wages.
  Visual news with honest archive
  labels, career achievements in the general mode-filtered list. 50/50 stays
  behind the brand key pending partner agreement.
- Custom crest shapes/symbols/layouts and predefined colour palettes;
  calendar windows blue on every day chip, event icons keep their tier accents;
  no payroll marker.
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
