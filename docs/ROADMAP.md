# Roadmap — finishing v2.0 "Season 1"

> Plan of record for the 2.0 launch, built from Miguel's completion plan
> (analysed on rc.26 @ 082a854; its backlog IDs are used below). Last updated
> **2026-10-28**. Current state: `STATUS.md`. History: `CHANGELOG.md`. Grep
> this file for a stage or an ID; it is not meant to be read whole.

## How the stages run

- Each **Etapa** is one package of behaviour. It ships to `staging` as one
  rc. `main` (production, v1.4.6) is not touched until Etapa 6.
- **Every Etapa ends at an approval gate.** Claude publishes the rc, lists
  what to play and the open decisions, and stops. The next Etapa starts only
  after Miguel has played that rc on staging and answered those decisions.
  Plan §3: every milestone ends with technical evidence and, where it touches
  the experience, a playtest Miguel approves.
- A mechanic that is still a proposal (most of Etapa 3) gets a written
  contract first. Miguel approves it before any code (plan §10).
- Inside an Etapa: implement → independent review → fixes → browser E2E
  (desktop + mobile, EN + PT) → gates → rc commits → push to `staging`.
- One Etapa per session or a few sessions; never "the whole roadmap at once".

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
- GAME-04: the goal timeline and overtime without spoilers (R41).
- ENG-01, first part: lint at 0 errors / 0 warnings.
- UI-02, first part: PT says "Swiss".
- SEA-04, first part: the grants SQL takes `early-supporter` (V2 plan §6-B).
- ENG-02, first part: README, STATUS, AGENTS, this roadmap.

Fixed along the way: the 8th AI org was missing from the qualifier and the
regional (R30); the season review undercounted; local amateur sides repeated
names; one album test failed intermittently.

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
  cut-off names in digests and standings (04/05); the Community Cup lobby
  listed the wrong team (06); the mobile top bar (07); the qualifier lobby
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

**2a, measure first:**
- OBS-02: a long-career harness: 8+ seasons, a set of seeds, simple
  manager policies, short reports.
- ENG-03: save fixtures (v1.x, rc.20+, pre-R40) and the persist contract.
  Isolate staging from production. Fix SEAM-1/2 here.
- ENG-01: the module audit, written as an inventory.
- DATA-01: check the expanded dataset (eras, IDs, overalls, chemistry).
- A quantified diagnosis of ECO-01/02/03 and DEV-01, with before and after
  curves.

**2b, fix:**
- ECO-02: bank loan and bailout: granted once, the debt and payments
  consistent, no softlock, the UI shows why it is refused and when the next
  payment is due.
- ECO-03: no incoming offers in split 1; no signing as a sub to cut salary.
- ECO-01: recalibrate salaries, income and prizes together (the 10/2.5
  qualifier split is provisional here).
- DEV-01/02: potential, age and growth curves; prospects.
- BAL-02: the RTW difficulty contract across every region.
- RTW-01: orgs enter by era; rankings include generic orgs; Major/Worlds
  points in HQ.
- OBS-01: typed career analytics events.

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
- DATA-02: new special cards, their art and windows.
- CH-01: Challenges with more varied mechanics.
- CH-02: test each Challenge and each star, one by one.
- CH-03: keep the quiz and the daily or not.
- UI-01: Season Pass rewards viewer; the daily login modal.
- UI-02, rest: banner animations; badge size and alignment.
- ECO-06: decide on active sales and trades.

## Etapa 5 — calibration and finish

- BAL-01: final Draft calibration with live data. The rc.27 snapshot has SAM
  Normal about 7 pp easier and NA Hard about 5 pp harder.
- BAL-03: does Worlds need more pressure than a Major?
- UI-03: the 2.0 tutorial and what's new.
- ART-01: era logos, new special art.
- WEB-01: SEO and Search Console (with DRAFT-11).
- WEB-02: performance (with the whole-run request budget).
- REL-01: a playtest by difficulty and region, plus mobile.
- MKT-01 prep: the 50/50 presence and patch notes.

## Etapa 6 — cutover and launch

SEA-01 (Season 1 state and dates), SEA-02 (freeze the board, grants), SEA-03
(a migration and rollback rehearsal on copies of real saves) and SEA-04 (the
runbook). Then V2 plan §6 A–E, the production deploy, MKT-01 and monitoring.

## Waiting on Miguel (Gate 1)

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
8. Classic scrollbars: dialogs keep the page still but leave the scrollbar
   gutter undimmed.
9. PT standings tag "Avançou"/"Fora", and the new local-side sheet wording.
10. Existing careers: a one-time migration for old name clashes and Season X
    players listed twice?

**Outside the code:**
- V2 plan §6 A–E (staging Supabase, production SQL, the board freeze,
  grants, Cloudflare variables and the sitemap).
- Allow `staging.rocketdraft.app` in this environment's network settings,
  so Claude can check each deploy itself.

## After 2.0

Liquipedia ingestion; a grand-final bracket reset; more collection
categories. Never: monetisation, lootboxes or betting.
