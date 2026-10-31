# Road to Worlds — current state

> Last updated: **2026-10-31**. Candidate: **v2.0.0-rc.36.5**, `staging`.
> Decisions: `ROAD-TO-WORLDS-DECISIONS.md` R1–R93. Gate: `CAREER-FEEDBACK-rc36-5.md`.

## Run and verify

- Dev: home → Road to Worlds → wizard → HQ. Staging enables
  NEXT_PUBLIC_CAREER_MODE=1 and noindex; production awaits cutover.
- Career logic is in `src/engine/career`, flows in `src/store/career*`, screens
  in `src/components/career`. Pure seeded engine, bilingual career copy,
  tunables in `src/config/balance.ts`.
- Full suite: 1463 passed, 18 optional checks skipped. Typecheck,
  lint, data, static build and browser checks: `CAREER-FEEDBACK-rc36-5.md`.
- Probes: CAREER_ARC (run alone; never with ARC_REPORT), CAREER_ECON (four
  processes by ECON_REGIONS), CAREER_GROWTH, CAREER_TRAINING; latest reports
  use the rc36 suffix. `ECONOMY-CONTRACT.md` §13 compares guardrails.
- `ENDGAME=1`: all 63 difficulty/roster/region cells with paid support;
  14 additional paired prospect careers. Parameters/replay limits in
  `CAREER-ENDGAME-rc36-4.md`; data tables include actual purchase coverage.
- `FEEDBACK=1`: 63 paired three-season starts, plus four paired six-season
  SAM/Normal/prospect starts, isolating local rebasing; rc36-5 report.

## Gate 3b candidate

Etapa 3 is complete: POL-01..04 and UX-02..05/CAL-01/SUN-01..03, with an
independent integration review. Miguel's playtest approval is still required.

- Training starts after a plan choice: 28 days, Evolve/Gel/Recover, focus,
  intensity/wear and running progress. Coaches can renew cycles; otherwise
  repeat with one click. Legacy periods finish before switching grids;
  signings join the plan; no duplicate session or payout.
  Results: Continue repeats even with coach, Change opens editing; persistent
  automatic-report opt-out, re-enabled in Training.
- Compact HQ, squad/sub/coach, progression, finances and stacked arsenal;
  unlocks use notification/inbox, no automatic purchase sheet; scrims stack
  with crests/scores and weekly variety. News retains game typography with
  editorial header; mail has envelope/sender. Skip secondary, +1 day tertiary;
  Instant result blue. Event/result roster inspection pauses playback;
  spectator Swiss games left/standings right. Clear coach locks; no Buy on
  owned/active/used items. Sponsor cards in a modal, Later until deadline.
  Contract replies require sending, and every lever counts.
- Founding budgets by difficulty, fitted wages, seasonal prospects, later
  peak and growth ceiling 8.5. Late support: centre +1.5 team rating,
  structured camp +1.75, psychology +3/+3. Local origin persists, growth capped
  at 1.5/year; current freezes survive. Regional timing, star affordability
  and Worlds-title pacing stay open. BALANCE_VERSION 10.
- Season goals, deadline/progress; Sunday trade-offs, 15% common money
  growth, rounded annual prize steps and one-season new sponsor profiles.
  Firmer renewals/coach wages. News labels historical archives;
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
