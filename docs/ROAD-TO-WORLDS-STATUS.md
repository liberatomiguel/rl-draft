# Road to Worlds — current state

> Last updated: **2026-10-31**. Candidate: **v2.0.0-rc.36.4**, `staging`.
> Decisions: `ROAD-TO-WORLDS-DECISIONS.md` R1–R92. Gate: `CAREER-ENDGAME-rc36-4.md`.

## Run and verify

- Dev: home → Road to Worlds → wizard → HQ. Staging enables
  NEXT_PUBLIC_CAREER_MODE=1 and noindex; production awaits cutover.
- Career logic is in `src/engine/career`, flows in `src/store/career*`, screens
  in `src/components/career`. Pure seeded engine, bilingual career copy,
  tunables in `src/config/balance.ts`.
- Full suite: 1452 passed, 16 optional checks skipped. Typecheck,
  lint, data, static build and 97 browser checks: `CAREER-ENDGAME-rc36-4.md`.
- Probes: CAREER_ARC (run alone; never with ARC_REPORT), CAREER_ECON (four
  processes by ECON_REGIONS), CAREER_GROWTH, CAREER_TRAINING; latest reports
  use the rc36 suffix. `ECONOMY-CONTRACT.md` §13 compares guardrails.
- `ENDGAME=1`: all 63 difficulty/roster/region cells with paid support;
  14 additional paired prospect careers. Parameters/replay limits in
  `CAREER-ENDGAME-rc36-4.md`; data tables include actual purchase coverage.

## Gate 3b candidate

Etapa 3 is complete: POL-01..04 and UX-02..05/CAL-01/SUN-01..03, with an
independent integration review. Miguel's playtest approval is still required.

- Training starts after a plan choice: 28 days, Evolve/Gel/Recover, focus,
  intensity/wear and running progress. Coaches can renew cycles; otherwise
  repeat with one click. Legacy periods finish before switching grids;
  signings join the plan; no duplicate session or payout.
- Compact HQ, squad/sub/coach, progression, finances and stacked arsenal;
  unlocks use notification/inbox, no automatic purchase sheet; scrims stack
  with crests/scores under calendar controls. News notices use a newspaper
  masthead/date/headline; mail retains an envelope/sender. Bootcamps are beside
  the HQ squad. Sponsor cards in a modal, Decide later until
  deadline. Contract responses arrive only after sending; refusals raise the
  floor and each lever counts.
- Same founding budget by difficulty, fitted founding wages, no Merch &
  streams income. Seasonal free-agent prospect replenishment and listing;
  slower generated-player growth, later peak, season ceiling 8.5. rc.36.3
  fits founding wages to 32/18 Normal/Hard weeks, reduces growth/low-result rep
  and contains founding market jumps. rc.36.4 adds +1.5 team rating to the
  centre, structured-camp edge 1 → 1.75 and psychology stats 1 → 3. Prices and
  gates stay. 77 paired starts per snapshot: no historical Worlds titles;
  qualified-field replays show benefits, not end-to-end pacing acceptance.
  Regional timing, star affordability and historical Worlds titles stay open.
  Match profiles are unchanged. BALANCE_VERSION 9.
- Season goals, deadline/progress; Sunday trade-offs, 15% common money
  growth, firmer renewals/coach wages. News labels historical archives;
  career achievements join the general list. 50/50 awaits partner agreement.
- Custom crest shapes/symbols/layouts and predefined colour palettes;
  calendar windows blue on every day chip, event icons keep their tier accents;
  no payroll marker.
- Saturday HQ stop, optional coach briefing and explicit Sunday start;
  no extra training/payroll. Once-only skippable intro with keyboard/reduced
  motion. Watch/sim/skip after elimination.

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
