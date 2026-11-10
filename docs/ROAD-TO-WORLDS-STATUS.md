# Road to Worlds — current state

> Last updated: **2026-11-10**. Candidate: **v2.0.0-rc.37**, `staging` (rc.36.21
> plus the rc.37 round: F1 market, F2 finance, F3 matchday, F4a battery tooling;
> handoffs `HANDOFF-rc37-*.md`). Decisions: `ROAD-TO-WORLDS-DECISIONS.md` R1–R108.
> Battery (4,914 careers): `docs/battery-rc37/RELATORIO-COMPLETO.md`. The F6
> package (R100–R108, BALANCE_VERSION 16) sits on `claude/rc37-balance`, not on
> staging, awaiting Miguel's approval: `docs/battery-rc37/F6-EXPERIMENTOS.md`
> Parts 7–8 (experiment runner `src/store/auditHumanExperiment.test.ts`).
> Gate: `CAREER-FEEDBACK-rc36-6.md`.
> Note: new careers grow on the growth contract (`contractPacePerWeek`,
> `CAREER_DEV.seasonGainCap`); `CAREER_AGE.growthMult` only drives model 1 and the
> AI world pass.

## Run and verify

- Dev: home → Road to Worlds → wizard → HQ. Staging enables
  NEXT_PUBLIC_CAREER_MODE=1 and noindex; production awaits approved cutover.
- Pure seeded engine in `src/engine/career`; flows in `src/store/career*`;
  screens in `src/components/career`; bilingual career copy and balance tunables.
- rc.36.6: 968 affected regression tests pass, 15 optional skipped;
  typecheck and changed-file lint clean. See its feedback report for build,
  data/persist and browser evidence. Prior full-suite baseline: rc.36.5.
- Economy/growth probes: CAREER_ARC alone, CAREER_ECON by ECON_REGIONS,
  CAREER_GROWTH, CAREER_TRAINING. Paid support/endgame: rc36-4 report;
  63 paired opening cells and four six-season SAM pairs: rc36-5 report.
  No new economy/title-pacing claim in this feedback release.

## Gate 3b candidate

rc.36.8: in-place article expansion, compact partner rows, fast scrims,
visual HQ lineups, spectator speed/Advance, knockout brackets and departure
guards. 141 targeted tests, types/lint/static export pass. Visual acceptance
remains on staging: this session’s browser preview timed out.

Etapa 3 is integrated. Miguel's playtest acceptance is still required.

- Training uses 28-day Evolve/Gel/Recover plans with focus, intensity, wear,
  coach renewal and history. Hidden reports consume/continue the completed
  plan automatically, including with a coach, without duplicate rewards.
  Attribute explanations sit higher, with actual values and baseline context.
- Practice happens Tuesday/Wednesday. A compact recorded-series clock/score
  reveal pauses the day briefly; autoplay resumes on completion. Skip crosses practice days; the quick score reveal lives in the weekly list,
  with no clock/banner. Reload never re-simulates.
  Legacy Thursday bookings move forward to a legal day.
- Calendar advance follows clock holds to the right decision/event/season.
  Failed qualifiers leave regionals visible as not playing. Every transfer
  window day has a blue marker. Spectator cards offer watch/results/calendar;
  no redundant clock cluster or follow CTA beside private bids.
- HQ highlights newly buyable progression items. Locked bootcamps have no
  purchase action; purpose, duration and active/used states are clearer.
- 50/50 presents public transfers, competition and major-org reporting.
  Private squad/contract/finance decisions use formatted mail; routine technical
  chatter is silent. Old communications are reclassified additively on load.
  The historical scripted news corpus remains partial.
- New 50/50 and duds showmatches, rotating 50/50 community cup, rare community
  1v1/2v2 brackets with selected roster members. Random weekly events start
  after the first regional. Standard circuit remains 3v3.
- Shared supplied name catalogs: 834 players, 280 orgs, seeded allocation
  across all generic roles. New careers use version 3; old identities survive.
- Founding economy, growth, late support, sponsor/contract talks, goals,
  crests and Sunday decisions remain as in rc.36.5. Regional timing, star
  affordability and historical Worlds titles remain open. Staging runs
  BALANCE_VERSION 15; the F6 branch is 16.

## System map

| System | Engine → flow → screen |
|---|---|
| Calendar, weekend, follow | calendar/sunday/follow → careerFlow/careerSunday → CalendarScreen, SundayCard, ChampionshipSunday, FollowScreen |
| Fields, small cups, local scene | worldSim/community/localScene/careerResults → careerFlow → EventScreen, StandingsScreen |
| Growth, training, coaches | development/training → careerTraining/careerStore → TrainingScreen, TrainingBlock, ScrimBroadcast |
| Money, gear, sponsors, contracts | economy/sponsorDeals/market/renewal/contract → careerFlow/careerHq → FinancesScreen, MarketScreen, ToolboxBlock |
| News, goals, names | communications/beats/seasonGoals/names → careerFlow/careerNew → NewsFeed, NewsScreen, WizardScreen |
| Queue, migration | types/difficulty → careerDecisions/careerFlow → DecisionBlock |

## Open and frozen contracts

- Next chat: close progression/economy, then seek Gate 3b acceptance.
  Scope/prompt/remaining sessions: `ROADMAP-NEXT-2026-11-03.md`.
- Persist version **3**, saveVersion **5**, unchanged. Repairs additive;
  permanent achievement marks survive save/season resets.
- Organization relocation as player action, t1 circuit and PvP remain deferred.
  Etapa 4 starts after Gate 3b approval; no production deploy in this package.
