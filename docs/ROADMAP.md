# Roadmap — finishing v2.0 "Season 1"

> Plan of record for the 2.0 launch, built from Miguel's completion plan
> (analysed on rc.26 @ 082a854; its backlog IDs are used below). That plan is
> not in the repo: "plan §3/§10" cite it; "V2 plan" is
> `V2-IMPLEMENTATION-PLAN.md`. Last updated **2026-10-28**. Current state:
> `STATUS.md`. History: `CHANGELOG.md`. Grep this file for a stage or an ID;
> it is not meant to be read whole.

## How the stages run

- Each **Etapa** covers one or two of the plan's milestones (the table
  below), split into tasks of one behaviour package each (plan §10; Etapa 1
  took the Swiss, the weekend and the timeline as separate tasks). It ships
  to `staging` as one or more rcs. `main` (production, v1.4.6) is not
  touched until Etapa 6.
- **Every Etapa ends at an approval gate.** Claude publishes the rc, lists
  what to play and the open decisions, and stops. The next Etapa starts only
  after Miguel has played that rc on staging and answered those decisions.
  Plan §3: every milestone ends with technical evidence and, where it touches
  the experience, a playtest Miguel approves.
- A mechanic that is still a proposal gets a written contract first, and a
  task with an open product decision gets Miguel's answer first: most of
  Etapa 3, and also the DEV-02 age rule (plan §5.1), COL-01 (§5.4) and
  CH-01 (§5.7). Miguel approves before any code (plan §10).
- Each task: a short diagnosis first (bug, tuning or redesign) → implement →
  independent review → fixes → browser E2E (desktop + mobile, EN + PT) →
  gates → rc commits → push to `staging`.
- One behaviour package per task, so an Etapa usually takes several
  sessions; never "the whole roadmap at once" (plan §10).

| Etapa | Milestone | Scope | State |
|---|---|---|---|
| 1 | M1 rules | Swiss, weekend calendar, match timeline, lint | ✅ rc.27–28 |
| 1b | M1 hardening | Bugs the rc.28 E2E found | 🔄 rc.29, ends at its staging publish |
| — | **Gate 1** | Miguel plays rc.29 and answers the decisions below | ⏸ |
| 2 | M0 rest + M2 | Instruments, then a sustainable career | next |
| 3 | M3 | The new RTW loop (contract first) | |
| 4 | M4 | Collect and progress | |
| 5 | M5 | Calibration, SEO/perf, art, 50/50 | |
| 6 | M6 | Freeze, migration, cutover, launch | |

## Done

**Etapa 1 (rc.27–28):**
- GAME-01: no rematch inside a Swiss, in the Draft and in RTW (#143).
- GAME-02/03: qualifier on Saturday (Swiss only) → regional on Sunday;
  Major/Worlds Swiss on Saturday and playoffs on Sunday ("Championship
  Sunday"), with a pause that survives a reload (R40).
- GAME-03 closes with rc.29 (CAR-02/03, R43): a reload no longer spoils a
  live round, and reduced motion shows the deciding series.
- GAME-04: the goal timeline and overtime without spoilers (R41).
- ENG-01, first part: lint at 0 errors / 0 warnings.
- UI-02, first part: PT says "Swiss".
- SEA-04, first part: the grants SQL takes `early-supporter` (V2 plan §6-B).
- ENG-02, first part: README, STATUS, AGENTS, this roadmap.

Fixed along the way: the 8th AI org was missing from the qualifier and the
regional, and the season review undercounted (both since R30, fixed in R40);
local amateur sides repeated names; one album test failed intermittently.

**Etapa 1b, rc.29 (this package; it ends at its staging publish):**
- Draft: the Swiss result showed before its playback (DRAFT-01, blocker); a
  paid reroll was wasted on an offer with no pickable card (DRAFT-12); the
  bracket and standings layout (DRAFT-08/15).
- Shared UI: the unlock pop-up opened over a live tournament (DRAFT-02);
  the cold home made 33 requests, now 28 (DRAFT-03); rank-up had no hint and
  ignored Escape (04); the XP count-up hid behind the ceremony (05); a Modal
  shifted the page (06) and leaked focus (07); Quick results labels (09); PT
  "Your Team" and stage labels (10); the tour stacked on the login calendar
  (13); copy nits (14, 16).
- Career: one gamertag on both sides of a fixture (CAR-01); a reload counted
  a live round as seen (02); reduced motion skipped the deciding series (03);
  cut-off names in digests and standings (04/05); event lobbies listed a
  team that did not play (06); the mobile top bar (07); the qualifier lobby
  said $6k and paid $5.2k (08); the calendar detail under the sticky bar
  (09); the Championship Sunday header and skip hint (10).

## Deferred from the rc.28/29 E2E (owner Etapa)

- `/pt` first paint shows English chrome and `lang="en"` (DRAFT-11) → Etapa 5, WEB-01.
- A whole Classic run from a cold home makes 77–80 requests against a 75
  budget (org logos and flags in the draft and the bracket) → Etapa 5, WEB-02.
- Saves from before rc.28 only: the agenda can list an event that was
  already played as the next stop, and a Major already in its playoffs on
  Saturday is titled "Championship Sunday" (SEAM-1/2) → Etapa 2, ENG-03.
- `nextUserStopDay` is dead code (SEAM-3) → Etapa 2, ENG-01 audit.
- Near the direct-8 line, Monday's commit (HQ, calendar) rates the user by
  the starters' average while the engine seeds the fielded team, so an org
  can play Saturday and also take a direct seat → Etapa 2 (one rating;
  changes the fields of running careers).
- 375×667: achievement toasts cover the top of the rank-up ceremony; the XP
  breakdown lines and "Daily · Legacy Day" stay in English in PT → Etapa 4.
- Existing careers keep their old name clashes and Season X players listed on
  two teams; new careers are clean → decision for Miguel (a one-time
  migration?).

## Etapa 2 — instruments, then a sustainable career

Career tests by feature (`src/store`): `careerFlow.test.ts` (season bot),
`careerV2.test.ts` (weekly payroll, bank loan, qualifier, real-org intake,
starter rosters), `careerV03.test.ts` (training rounding, market value,
Backer pay-down, bids, negotiation, v3 migration), `careerWeekend.test.ts`
(weekend, `asLegacy`). Engine tests sit beside their module
(`economy.test.ts` covers the Backer and the bank). `market.ts` and
`worldSim.ts` have no test file.

**2a, measure first:**
- OBS-02: a long-career harness: 8+ seasons, a set of seeds, simple
  manager policies, short reports. Grow it from the season bot in
  `careerFlow.test.ts`; spec `ROAD-TO-WORLDS-DESIGN.md` §17 (asserts
  `CAREER_ARC`); keep the long sweep opt-in, like
  `difficulty.matrix.test.ts`. Every RTW region × 3 difficulties. Policies:
  losing start, median, title run, costly squad, youth core, coach change,
  bad sponsor, Backer or bank use; stop early on a softlock or insolvency.
  Report seed, version, policy, failures that reproduce, balance
  p10/p50/p90, debt, Backer and insolvency rates, growth by age and
  potential.
- ENG-03: save fixtures (v1.x, rc.20+, pre-R40) and the persist contract.
  Isolate staging from production. Fix SEAM-1/2 here. No fixture files exist:
  `persistContract.test.ts` migrates one synthetic `oldProfile()` from each
  profile version (1–11); `careerWeekend.test.ts` makes pre-R40 saves with
  `asLegacy`. Staging has its own origin but still needs its own Supabase
  project (V2 plan §6-A) and never the production PostHog key.
- ENG-01: the module audit, written as an inventory (a new doc, e.g.
  `docs/MODULE-AUDIT.md`: one row per module with its job, persistence,
  tests, findings with severity, and status), audited in packages (data,
  shared engine, stores/sync, economy, growth, calendar, UI,
  export/perf/SEO), each closed with its commit and evidence. SEAM-3 goes
  here.
- OBS-01, contract: the event catalogue and common properties (plan §6, a
  proposal). Miguel approves it; 2b then builds the events.
- DATA-01: check the expanded dataset (eras, IDs, overalls, chemistry), not
  redo it: `npm run validate:data`, `cardAliases.test.ts`,
  `chemistry.test.ts`; report by era and region; old ids still resolve via
  `cardIdAliases.json`.
- ENG-02, rest: no old doc read as the current plan or spec (the V2 plan and
  the CHANGELOG's 2.0 header still call the V2 plan the execution order;
  CHALLENGES-DESIGN still describes the v1.4 set), and the runbooks that
  drift from the code.
- A quantified diagnosis of ECO-01/02/03 and DEV-01: the "before" curves
  from the OBS-02 harness; 2b re-runs the same seeds for the "after" curves.

**2b, fix:**
- ECO-02: bank loan and bailout: granted once, the debt and payments
  consistent, no softlock, the UI shows why it is refused and when the next
  payment is due. The bailout is the Emergency Backer (`weeklyPayroll` floor
  check, `CAREER_LOAN`, `payDebtFlow`); the bank is `bankLoanRefusal` /
  `takeBankLoanFlow` (`CAREER_BANK`). Reproduce the problem in the real
  flow first.
- ECO-03: no incoming offers in split 1; no signing as a sub to cut salary.
  Incoming bids arrive only in transfer windows (`incomingBidForDay`, plus
  the scripted Blockbuster bids in W1-2), never inside a split, so Miguel
  names the windows (season 0's preseason, W1-2, and/or W11-12). The
  discount is `CAREER_SALARY.subRoleFactor` in `computeSalaryAsk`
  (`economy.ts`; signing asks reach it through `askPackageFor` in
  `market.ts`); `setStartersFlow` promotes a sub with no new wage and
  `renewPlayerFlow` prices at the current role. Fix it in the flow, not the
  button.
- ECO-01: recalibrate salaries, income and prizes together (the 10/2.5
  qualifier split is provisional here). Per season today: salary asks ×1.08
  (`CAREER_SALARY.inflationPerSeason`), prize pools ×1.12 and new sponsor
  deals ×1.1 (`growthPerSeason` in `CAREER_PRIZES` / `CAREER_SPONSOR`); the
  week's money is `weeklyStatement`. Done when a first career pays its way
  without an unlikely prize, money stays a challenge, and inflation forces
  neither bankruptcy nor wealth.
- DEV-01/02: potential, age and growth curves; prospects. Squad growth:
  `development.ts` (`trainDay`, `squadRollover`); world growth, retirements
  and rookies: `agePassAndIntake` (`worldSim.ts`); tunables `CAREER_AGE`,
  `CAREER_DEV`, `CAREER_TRAINING`. Done when the curves reproduce with no
  rounding stall, odd age jump or unreachable ceiling, the talent spread is
  written down, and the fix is not just more XP. DEV-02 needs Miguel's rule
  first: hiring age, playing age, retirement (today the rollover roll
  reaches 70 % from 28, half for stars).
- BAL-02: the RTW difficulty contract across every region (APAC and SSA
  too). RTW reads the Draft's `DIFFICULTY` (`worldSim.ts`, `match.ts`,
  `teams.ts`), so a Draft retune (BAL-01) moves it: the plan asks for RTW's
  own contract (rolls, opponent shift, chemistry caps, and the money in
  `CAREER_ECONOMY` and `CAREER_LOAN.garnishRate`) and selector text that
  says what it changes. The Draft matrix test does not cover RTW; use the
  OBS-02 harness and `CAREER_ARC`.
- RTW-01: orgs enter by era; rankings include generic orgs; Major/Worlds
  points in HQ. `realOrgIntake` (R31) exists: prove no org arrives early.
  `applyResultToStandings` drops local sides' points (R23/R30): keeping
  them needs Miguel, and so does whether they can then take a Major slot
  (`majorFieldFor` takes the top split points). HQ's Road to Worlds mini
  (`HubScreen.tsx`) shows only the season race, not the split race to the
  Major.
- OBS-01: typed career analytics events, added to `GameEvents` in
  `src/lib/analytics.ts` (today only `runStore.ts` calls `trackEvent`), fired
  from the store once per saved action, plus the plan's common properties
  (release, environment, region; `run_completed` has no `region` today). The
  runbook advises no PostHog on staging, so checking the events needs a
  separate PostHog project (Miguel).

**Gate 2:** Miguel approves the new numbers (curves, economy) and plays a
long career on staging.

## Etapa 3 — the new RTW loop (contracts first)

Covers DEV-03 (training plans + scrims + distinct coaches), ECO-04
(sponsors), ECO-05 (other income and boosts in HQ), UX-01 (HQ around the next
decision) and UX-02 (season goals). Also UX-03 (useful news, 50/50), UX-04
(creation: no Management Style; crest, shapes and colours), UX-05 (RTW
achievements in the general list) and UX-06 ("New" markers, unlock pop-ups,
tutorial).

- **Gate 3a:** Miguel approves the written contracts.
- **Gate 3b:** a playtest. The loop must not need a repetitive weekly chore.

## Etapa 4 — collect and progress

- COL-01: the national-team album, where discovering a team is separate from
  collecting its cards (if adopted).
- COL-02: filters, counters and "New" on the profile and collection.
- DATA-02: new special cards, their art, eligibility and windows (none
  leaks into RTW unless intended), and a regression of the Region-only modes
  already built (NA, EU, SAM, MENA, OCE; APAC and SSA have no Region-only
  mode but play in the RTW circuit).
- CH-01: Challenges with more varied mechanics.
- CH-02: test each Challenge and each star, one by one.
- CH-03: keep the quiz and the daily or not.
- UI-01: Season Pass rewards viewer; the daily login modal.
- SEA-01, review part: XP versus Season Rating, cadence and gains (no endless
  farm), the season's events and rewards. Plan §3 puts XP/rating and rewards
  in M4; the dates stay in Etapa 6.
- UI-02, rest: banner animations; badge size and alignment.
- ECO-06: decide on active sales and trades.

**Gate 4:** every card reachable, every Challenge star shown reachable in a
real draft, rewards granted once and progress correct (plan §3, M4). Miguel
plays it on staging.

## Etapa 5 — calibration and finish

- BAL-01: final Draft calibration with live data. The rc.27 difficulty
  matrix (simulated, not live) puts the SAM Normal title rate about 7 pp
  above worldwide and NA Hard about 5 pp below it.
- BAL-03: does Worlds need more pressure than a Major?
- UI-03: the 2.0 tutorial and what's new.
- ART-01: era logos, new special art; decide the national-team art.
- WEB-01: SEO and Search Console (with DRAFT-11).
- WEB-02: performance (with the whole-run request budget).
- REL-01: a playtest by difficulty and region, plus mobile.
- MKT-01 prep: the 50/50 presence and patch notes.

**Gate 5:** one integrated experience in EN, PT and on mobile, metrics that
read clearly, and a stable release candidate (plan §3, M5). Miguel plays it
by difficulty and region.

## Etapa 6 — cutover and launch

SEA-01 (Season 1 state and dates), SEA-02 (freeze the board, grants), SEA-03
(a migration and rollback rehearsal on copies of real saves) and SEA-04 (the
runbook). Then V2 plan §6 A–E, the production deploy, MKT-01 and monitoring.

**Gate 6, before the production deploy:** plan §9's launch checklist. Every
P0 is fixed. Every P1 is delivered and approved, or Miguel has explicitly
decided its change of scope. Nothing is dropped silently.

## Waiting on Miguel (Gate 1)

**What to play:** the manual regression in `STATUS.md` ("Open before
`main`") and the career playtest in `ROAD-TO-WORLDS-STATUS.md` ("Remaining /
open"), on rc.29.

**Decisions:**
1. PT for "Championship Sunday": keep it, or "Domingo de Finais"?
2. The qualifier pays 10 % / 2.5 % ($6k at season 0). Lobbies now show the
   real paid totals: the regional is $40.8k because swiss16 pays 102 %; the
   Community Cup is $1.8k after rounding to $50. Keep this, or reshape the
   tables in ECO-01?
3. Overtime pacing, about 6–7 s at 1×.
4. Worldwide Legacy at 1.6 or 1.3 (#140).
5. The real Season 1 dates (`season.ts`: 2026-10-20 → 12-22).
6. In the user's own qualifier, local sides are rated around the user. Keep that?
7. Weekends the user only watches are not Advance stops. Keep that?
8. Classic scrollbars (#144): the gutter is always reserved, so neither a
   dialog nor a route change shifts the page, but a short page ends its
   header and footer borders and its glow 10–15 px before the window's
   edge. Keep it, or reserve the gutter only while a dialog is open (routes
   jump again)?
9. PT standings tag "Avançou"/"Fora", and the new local-side sheet wording.
10. Existing careers: a one-time migration for old name clashes and Season X
    players listed twice?
11. Before Etapa 2b: which transfer windows lose incoming bids (ECO-03);
    hiring age, playing age and retirement (DEV-02); do local sides that
    score in a regional enter the tables, and can they take a Major slot
    (RTW-01; yes would reverse R23/R30)? Does staging get its own PostHog
    project (OBS-01)?

**Not needed for Gate 1 (V2 plan §8):** the Season Rating deltas and whether
a Swiss exit costs rating (defaults shipped; SEA-01); which 8–10 event cards,
one per week (none is set in `specialCards.json` yet; DATA-02).

**Career items still open** (ROAD-TO-WORLDS-DECISIONS, "Still open for
Miguel"): the ~30 hand-written scripted beats (EN + PT) for launch, the
biggest content ask and still a partial floor (UX-03; is that budget OK?);
the first-guess tunables (scrim chemistry 0.05 and XP 0.5, the poach rates,
the negotiation floor 0.88, the filler headliner band 77–84), to settle at
Gates 2 and 3.

**Outside the code:**
- V2 plan §6 A–E (staging Supabase, production SQL, the board freeze,
  grants, Cloudflare variables and the sitemap).
- Allow `staging.rocketdraft.app` in this environment's network settings,
  so Claude can check each deploy itself.

## After 2.0

Liquipedia ingestion; a grand-final bracket reset; more collection
categories. Never: monetisation, lootboxes or betting.
