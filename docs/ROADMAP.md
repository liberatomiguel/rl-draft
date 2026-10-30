# Roadmap — finishing v2.0 "Season 1"

> Plan of record for the 2.0 launch, built from Miguel's completion plan
> (analysed on rc.26 @ 082a854) and its **28/10 update** (checked on rc.29 @
> 4faffe9: the same IDs, his new playtest folded in, the product direction for
> growth, training and HQ decided). Neither file is in the repo; "plan §N"
> cites the 28/10 update, and its new requirements are written into the
> Etapas below by ID. "V2 plan" is `V2-IMPLEMENTATION-PLAN.md`. Last updated
> **2026-10-30**. Current state: `STATUS.md`. History: `CHANGELOG.md`. Grep
> this file for a stage or an ID; it is not meant to be read whole.

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
  Etapa 3, and also the DEV-02 age rule, COL-01 and CH-01. Miguel approves
  before any code. Directions the 28/10 plan already decided (prospects and
  peaks, no per-split cap, specials as potential, training as a period
  package, the HQ and profile asks) are not re-asked (plan §10).
- Priority (plan §3): **P0** integrity (direct-8 and legacy saves, the sub
  signing, the loan, broken growth, impossible challenges, migration and
  rewards); **P1** the redesigns asked for 2.0 (never deferred silently);
  **P2** new hypotheses that need a scope call (FIFAe/EWC, the form state, a
  harder Worlds).
- Each task: a short diagnosis first (bug, tuning or redesign) → implement →
  independent review → fixes → browser E2E (desktop + mobile, EN + PT) →
  gates → rc commits → push to `staging`.
- One behaviour package per task, so an Etapa usually takes several
  sessions; never "the whole roadmap at once" (plan §10).

| Etapa | Milestone | Scope | State |
|---|---|---|---|
| 1 | M1 rules | Swiss, weekend calendar, match timeline, lint | ✅ rc.27–28 |
| 1b | M1 hardening | Bugs the rc.28 E2E found | ✅ rc.29 (on staging) |
| — | **Gate 1** | Answered by the 28/10 plan (Miguel's rc.29 playtest + direction) | ✅ |
| 2 | M0 rest + M2 | Instruments, then a sustainable career | ✅ built: 2a rc.30 + rc.32; 2b rc.31–rc.33 (Gate 2: Miguel's play) |
| 3 | M3 | The new RTW loop (contract first) | ▶ rc.34: DEV-03, ECO-04/05, UX-01, UX-06 + the 31/10 answers; UX-02–05, CAL-01, SUN-01..03 next |
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

**Etapa 1b, rc.29 (on staging):**
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

**Etapa 2a, rc.30 (package A + the instruments):**
- The cross-package review of rc.27–29 that rc.29 left open: the playtest
  build froze the results XP at "+0" (P1); a live RTW event let the login
  calendar and the unlock pop-up open over it; a release or sale mid-event
  changed the squad while the event fielded the frozen team.
- Direct-8: Monday decides the week once, with the team rating HQ shows
  (R45). No more playing Saturday and taking a direct seat.
- Saves from before rc.28 (SEAM-1/2) and the one-time repair of careers from
  before rc.29 (one roster and one gamertag per player; saveVersion 5).
- PT: the Daily text and the XP breakdown; achievement toasts wait for a
  ceremony; `nextUserStopDay` removed.
- OBS-02: the long-career harness and its baseline
  (`CAREER-BASELINE-rc30.md`). OBS-01: the event contract, a proposal
  (`ANALYTICS-EVENTS-2.0.md`).

**Etapa 2b, rc.31 (part 1: the decided 29/10 items and the money's
integrity, built as three parallel fronts, then an independent review):**
- ECO-02 (R46): the Backer and the bank keep their rules and the screens
  quote what the ledger books. "Pay it all" settles the exact remainder (the
  $50 quantum left an unpayable stub that kept the Backer lock); an
  insolvency is final (it could be continued after a Worlds title or in the
  endless era); the bank panel shows its real refusal and its schedule.
- ECO-03 + 03b (R47): no "signed as a sub" discount; the slot is set after
  the price; a full squad (4) names who leaves, in the same deal; a reserve
  renews like a starter, with the payroll projection; no bids in the
  career's first window.
- DEV-02 (R48): 13 to play; retirement between 24 and 29, never before the
  peak, real history kept; 60 % of retiring real ex-pros coach; the user's
  retirees leave the world for good.
- RTW-01 (R49): local sides score, race for the direct 8 and can take Major
  and Worlds slots (0.2 % / 0.04 % of the slots in the sweep); one rating per
  side per season; the split Major table and the season Worlds table on
  Standings and the HQ toggle (UX-01d); no org arrives before its era.
- ECO-01: the economy contract, written (`ECONOMY-CONTRACT.md`), with its
  probe (`CAREER_ECON=1`). A proposal: no number moved.

**Etapa 2b, rc.32 (part 2: the pending decisions as provisional defaults —
Miguel, 30/10 — five parallel fronts, the integration and an independent
review):**
- ECO-01's mechanisms, each behind its own `balance.ts` key (R50–R53): M1
  one money index (1-A), M3 the founding partner (3-A), M4 warnings, the
  Backer in weeks, what ends a career by difficulty, restructurings and
  the commitment lock (4-B), M5 tables that pay 100 % (6-B), M6 the comfort
  cap and the players' share (5-B), M8 "List for sale" and the late signing
  (8-B); M7 held (9-B), 7-A and 10-A need no code. Re-measured in the
  contract's §9.
- M2, renewals with a raise cap and a market floor (2-B, R58); DEV-01, growth
  model 2 for new careers (R55–R57); BAL-02, the career presets, the
  career's own difficulty and the filler cap (R59).
- The age clock steps one year a season (R54); the Blockbuster bid explains
  itself (R54).
- The 2a leftovers: ENG-01 (`MODULE-AUDIT.md`, #147), DATA-01
  (`DATA-AUDIT-rc32.md`), ENG-02 (#146), OBS-01 (built, production only,
  #145).
- Etapa 3's written contracts, for Gate 3a: `TRAINING-CONTRACT.md`,
  `SPONSOR-CONTRACT.md`, `HQ-CONTRACT.md`.
- Pulled forward from Etapa 5: DRAFT-11 (#148) and WEB-02's request budget
  (#149–#150: a whole Classic run 65–78 → 56–59 of 75).
- The integration review's fixes (R60): the Backer lock in the overdraft,
  sold founders kept in the world, the restructuring mail's money, the late
  seat, the analytics band.

**Etapa 2b, rc.33 (part 3: Miguel's 30/10 answers on rc.32 — four parallel
fronts, the integration's tuning, two independent reviews):**
- Money (R61–R63): breaches 3 / 2 / 1 by difficulty with Easy's rescue
  partner, no day-one founding partner, no restructuring (ECO-07/08); one
  index at 12 % and a star bend (ECO-09); guaranteed income (M7); no sale
  listing (ECO-12); the Monday ring and the expanded balance chart (UX-07).
- Contracts and market (R64–R65): the prize share per contract (ECO-10), the
  contract talk (ECO-11), honest potential and the phase tag (DEV-04), the
  reputation filter, the full-squad warning and the Blockbuster sentence
  (UX-07).
- World and competition (R66–R68): every org enters its history (RTW-03),
  fewer known free agents (RTW-04), a full squad to play (RTW-05), the
  newcomer's reputation path (RTW-02), match difficulty (BAL-04) and the
  preset step (UX-07).
- The integration's tuning (R69): one renewal lifts a wage at most ×2.5, and
  titles raise the renewal (M6 lever 3). The reviews' fixes (R70).
  Re-measured in the economy contract's §10.
- Pulled forward from Etapa 4: COL-01 and COL-02 (#151–#154).

**Etapa 3, rc.34 (Gate 3a's three contracts, and Miguel's 31/10 answers on
rc.33 — five parallel fronts, three independent reviews):**
- HQ around the next decision (R71–R73): one decision queue for every clock
  path (UX-01a, HQ 1-B), the blocks from engine truth (UX-01b–f), "New" per
  career save and the contract clock (UX-06), skipping a regional with a
  short squad (RTW-06).
- Training (R74–R75): a package per 28-day period with its projection and
  report, three scrim levels, delegation by preset, distinct coaches
  (DEV-03).
- Sponsors (R76): three profiles in one comparison, dated goals by their
  word, fines on Balanced and Bold, money scaled to the team's level,
  ECO-05's cap, the founding partner's handover for rc.32 careers (ECO-04,
  ECO-05).
- Money (R77–R78): the bank's emergency loan with a deadline and caps, the
  investor on Easy's first loan, the money modal, no lock while owing
  (ECO-13/14/15); every founding roster carries its first split (BAL-05).
- The talk and the difficulty step (R79): every lever moves or says why
  (ECO-16), a prize share only above 79 (ECO-17), the difficulty step
  rewritten (UX-08). The integration and the reviews' 21 fixes (R80).
  Re-measured in the economy contract's §11.

## Deferred (owner Etapa)

- The share card's text (mode, difficulty) is English in PT → Etapa 5, with
  the PT pass.
- Found in rc.32 (audit, review, fronts), not fixed there:
  - PT pass (Etapa 5): achievement names stay English in the PT unlock toast;
    English-only aria-labels (`AppShell`); the privacy text still names
    Vercel Web Analytics (dropped in v1.4; Miguel reviews the wording).
  - WEB-01: a player who saved PT sees one English frame on an EN URL (`/`,
    `/play`); the PT chrome's links point at the EN URLs (`/about`).
  - Etapa 3 (the contracts cite them): Advance and "+1 day" stay active
    under a bid, a sponsor choice or an invite, so a day can pass a needed
    decision (UX-01a); the bootcamp's edge is spent by the next official
    event, not the split (UX-01f); Training says match weeks pause sessions,
    the engine trains them at half rate; the Finances sparkline plots ledger
    lines, not weeks (UX-01e); a coach rated 65 or below trains like no
    coach and the "++" level never appears (DEV-03).
  - Instruments: the harness bot answers every insert "b", so the money
    probe has never measured insert money; it also never lists players or
    takes a late signing (M8 is unmeasured by the bot).
  - Engineering (MODULE-AUDIT P2/P3): a guest with two tabs open can lose
    progress (the stale tab's write wins); split weeks hard-coded in
    `careerFlow.ts`; a few tunables outside `balance.ts` (`worldSim.ts`,
    `development.ts`, `match.ts`, `teams.ts`).

## Etapa 2 — instruments, then a sustainable career

Career tests by feature (`src/store`): `careerFlow.test.ts` (season bot),
`careerV2.test.ts` (weekly payroll, bank loan, qualifier, real-org intake,
starter rosters), `careerV03.test.ts` (training rounding, market value,
Backer pay-down, bids, negotiation, v3 migration), `careerWeekend.test.ts`
(weekend, `asLegacy`). Engine tests sit beside their module
(`economy.test.ts` covers the Backer and the bank). `market.ts` and
`worldSim.ts` have no test file.

**2a, measure first** (rc.30: package A and the instruments; rc.32: the
audit, the dataset check, the doc pass and OBS-01; only ENG-03's real-save
fixtures remain):
- ✅ OBS-02, the long-career harness: `src/store/careerArcBot.ts` (test
  support, never imported by the app) plays whole careers through the real
  flow under seven policies: autopilot (median, hands-off), tuned (title
  run), youth (youth core), spender (costly squad + bank), badSponsor,
  losingStart (the prospects roster) and coachChurn. `careerArc.test.ts`
  runs a smoke test in the suite. Opt-in: `CAREER_ARC=1` sweeps every region ×
  difficulty × policy × seed (knobs `ARC_*`, `ARC_SLICE=i/n` for parallel
  processes, `ARC_REPORT=1` merges slices into Markdown), and
  `CAREER_CURVES=1` samples the development model from the engine. Nothing
  asserts balance yet: 2b re-runs the same seeds for "after".
- ✅ The baseline ("before"), `CAREER-BASELINE-rc30.md`.
- ENG-03, partial: synthetic legacy fixtures now cover pre-R40 saves
  (`asLegacy`), a pre-rc.29 world and a pre-rc.30 week (`careerRepair.test.ts`).
  Still open: fixtures from real exported saves (v1.x profile, rc.20+
  careers, which need saves from Miguel), and isolating staging (its own
  Supabase project, V2 plan §6-A, and never the production PostHog key).
- ✅ ENG-01 (rc.32, #147): the module audit, written as an inventory (`docs/MODULE-AUDIT.md`:
  one row per module with its job, persistence, tests, findings with
  severity, and status), audited in packages (data, shared engine,
  stores/sync, economy, growth, calendar, UI, export/perf/SEO), each closed
  with its commit and evidence.
- ✅ OBS-01, the contract: `ANALYTICS-EVENTS-2.0.md` (a proposal; Miguel
  approves, 2b builds it).
- ✅ DATA-01 (rc.32, `DATA-AUDIT-rc32.md`; no data edit needed): check the expanded dataset (eras, IDs, overalls, chemistry), not
  redo it: `npm run validate:data`, `cardAliases.test.ts`,
  `chemistry.test.ts`; report by era and region; old ids still resolve via
  `cardIdAliases.json`. Prove each org enters in its right season.
- ✅ ENG-02, rest (rc.32, #146): no old doc read as the current plan or spec (the V2 plan and
  the CHANGELOG's 2.0 header still call the V2 plan the execution order;
  CHALLENGES-DESIGN still describes the v1.4 set), and the runbooks that
  drift from the code.

**2b, fix** (order: ECO-02/03 and DEV-01/02 are P0; the rest follow the
same seeds; never recalibrate the economy without the growth that the
Etapa 3 packages and coaches will add):
- ✅ ECO-02 (rc.31, R46): bank loan and bailout: granted once, the debt and payments
  consistent, no softlock, the UI shows why it is refused and when the next
  payment is due. The bailout is the Emergency Backer (`weeklyPayroll` floor
  check, `CAREER_LOAN`, `payDebtFlow`); the bank is `bankLoanRefusal` /
  `takeBankLoanFlow` (`CAREER_BANK`). Reproduce the problem in the real
  flow first (the harness ends most careers through it, baseline §1).
- ECO-03a, stars (rc.32: M6's comfort cap and the players' share built as
  provisional defaults, R53; the wage budget waits for Etapa 3): fee, wage, contract length, reputation and opportunity
  cost, priced without leaning on the sub discount (rc.31 removed the
  discount; the pricing itself is the ECO-01 contract's M6).
- ✅ ECO-03b, bids (**decided 29/10**; rc.31, R47): no incoming bids for the user's players
  during the career's **first transfer window** (season 1, weeks 1–2; the
  code calls it the preseason window, `windowIdx` 0 of season 0), the
  scripted Blockbuster bids of W1-2 included. From the next window on, bids
  arrive as today (`incomingBidForDay`, windows only). Keep the block
  explicit in the code.
- ✅ ECO-03, the sub contract (P0; rc.31, R47):
  the lineup slot is separate from the price of the job. No "signed as a sub"
  wage discount (`CAREER_SALARY.subRoleFactor` 0.4 in `computeSalaryAsk`,
  reached through `askPackageFor`): a player signs at his normal value, then
  the lineup is set. A full squad asks the user who leaves; nothing is
  released or demoted silently. Promotion never needs a renegotiation
  (`setStartersFlow`), and renewing a reserve prices the player
  (`renewPlayerFlow`). Every operation is atomic: fee, bonus, wage and slots
  move together. Old saves get no abrupt retroactive raise; their contracts
  reprice at renewal, with a payroll projection. Tests: sell a starter with
  and without a sub; promote; sign with three starters; renew a reserve;
  swap the lineup; sign and promote the same day; refresh mid-negotiation;
  a failed transfer.
- ECO-01 (the contract, rc.31: `ECONOMY-CONTRACT.md`; rc.32 built its
  mechanisms as provisional defaults, R50–R53, re-measured in its §9; Miguel
  confirms them at Gate 2): the whole money curve by era, season and event tier: wages,
  fines, fees, signing bonuses, prizes and income, in consistent units
  (week, split, season). Today, per season: asks ×1.08
  (`CAREER_SALARY.inflationPerSeason`), prizes ×1.12 and new sponsor deals
  ×1.1 (`growthPerSeason`); the week's money is `weeklyStatement`. The ask
  grows ×1.2 per overall point (`growthPerPoint`), so a founder who develops
  from 73 to 79 asks about 3× at renewal. Done when a first career pays its
  way without an unlikely win, a median career meets real choices, a title
  run does not snowball (baseline §1–§3), and inflation forces neither
  bankruptcy nor wealth. Report p10/p50/p90 of balance, debt, payroll ÷
  guaranteed income, rescues, bankruptcy and access to stars over 8+
  seasons, every pool and difficulty.
  - **Miguel's input (29/10):** playing it himself he never went bankrupt;
    friends less familiar with the game did. Star players become easy to
    buy at some point. Humans take different paths: develop their own
    players, sell and trade up, buy stars. The money scale should grow
    progressively over the seasons.
  - So the economy gets a **written contract before any retune** (like
    DEV-03), for Miguel's approval. It covers: a newcomer who plays normally
    never goes bankrupt (clear warnings, a recovery path that is not the
    end), a progressive money scale (prizes, wages, fees and sponsors grow
    together season by season), stars that stay a real decision late in the
    career (priced against the league's top budgets, not only the curve),
    and each path viable (developing your own players must not be punished
    at renewal; selling and trading up must work).
  - The harness is a regression check on fixed seeds, not a model of human
    play. The gate is a human playtest by Miguel and by newcomers.
- ✅ DEV-01, the growth contract (rc.32, R55–R57: growth model 2, new careers
  only; direction decided by Miguel; parameters are tuning):
  - a) rare generic prospects aged 13–15 with potential 93–98, in the
    historical eras too (today 0 %: `datasetEraPotentialCeiling` 88).
    Frequency configurable and measured by region, class and season,
    97/98 included. Not more wonderkids overall, not only the infinite era.
  - b) an individual peak: maturation profile (early or late), a
    maintenance phase at the top, then a gradual decline. These are three
    separate dimensions, fixed per save (signing, selling, renewing or a new
    club never rerolls them), not tied to a fixed 18–22 window
    (`peakAgeRange`). A prospect signed at 14 reaches his best within
    seasons the career plays. Potential becomes the **expected peak**, not a
    hard wall: finishing 1–2 points under or over is allowed (the tolerance
    is to be tested).
  - c) a real player with special cards: potential from the overall of his
    eligible special (by `playerId`, without effects, boosts or chemistry);
    his debut overall is unchanged. Community or fantasy cards that would
    bend the curve need an explicit rule. Today `derivePotential` reads only
    the normal cards (baseline §5).
  - d) no per-split cap (`maxSplitGain` 3) and a revised season cap (7): a
    non-linear curve, steep when young and slowing near the peak without
    stopping short of it. No jump on a birthday or at the rollover.
  - e) scouting: the potential never moves when a report is bought or the
    page reloads, and bands are honest (the truth can sit at the floor, the
    middle or the top; no systematically impossible ceiling). The baseline
    measures the floor bias Miguel reported (§6).
  - Base growth without a package: days plus series actually played, per
    player (a reserve who did not play keeps his base growth, not starter
    XP). Packages speed it up (Etapa 3), never as a toll for growing.
    Expectation rolled once per player and career; no XP inflation.
  - Migration: IDs, contracts and progress kept; no instant overall jump to
    "compensate" the old curve; bought scouting stays coherent.
- ✅ DEV-02 (rc.31, R48): signing, registering, fielding, substitution and rollover
  aligned with the new longevity; no retirement before the peak; youth
  never depends on the sub exploit. **Decided 29/10:** the minimum
  competitive age is **13** (signable and playable from 13, as in the RLCS
  today). Players retire **between 24 and 29** (Miguel's estimate; today the
  rollover roll reaches 70 % from 28, half for stars). A retiring player
  either leaves the game or **becomes a coach**: real ex-pros then feed the
  DEV-03 coach market.
- ✅ BAL-02 (rc.32, R59; Hard retuned, the filler cap provisional): difficulty presets for the career, Easy / Normal / Hard (Normal
  default), each moving matches (a small edge for the user on Easy, stronger
  opponents on Hard), money (starting budget) and how much of the training
  is guided. They replace the Management Style step in the wizard (one
  sentence + the real effects). Manual work is never the only lever, and no
  hidden malus stops a team from reaching its potential. RTW gets its own
  contract instead of reading the Draft's `DIFFICULTY` (`worldSim.ts`,
  `match.ts`, `teams.ts`), so a Draft retune cannot move the career; overall
  stays the engine's main signal. Keep the regional identities (SAM: an
  easier pool with 2 slots; EU: a stronger pool with 4). The Draft matrix
  test does not cover RTW; use the OBS-02 harness and `CAREER_ARC`.
- BAL-03 (experiment, not approved): a slightly harder Worlds. First
  measure P(win Worlds | won a Major) by squad strength, region, difficulty
  and career stage, and check the field takes the best qualifiers. Never a
  forced loss or a secret penalty for winning a Major.
- ✅ RTW-01 (rc.31, R49): orgs enter by era (prove none arrives early). **Decided 29/10:**
  local sides **score in the regional and can earn a Major slot** (reverses
  R23/R30: `applyResultToStandings` stops dropping their points, and
  `majorFieldFor` / the Major and Worlds fields resolve them). **Two
  tables, both viewable** (the Standings screen and the HQ toggle,
  UX-01d): the per-split **Major table** (that split's regional points) and
  the season **Worlds table** (regional + Major points). The focus stays
  on real orgs; generic teams (filler orgs and local sides) can take part
  too.
- ✅ OBS-01 (rc.32, #145: built, production only; the catalogue provisional
  until Miguel approves it): build the approved catalogue (`ANALYTICS-EVENTS-2.0.md`) in
  `src/lib/analytics.ts`, fired from the store once per saved action.
  **Decided 29/10:** no analytics on staging/playtest for now (few players
  there). The events are verified by tests (a fake sink), and production
  gets them at launch, so the build can wait for the end of 2b or Etapa 5,
  before the cutover.

**2b part 3 — Miguel's answers on rc.32 (30/10, his first rc.32 playtest;
he plays more before the numbers settle). Built in rc.33 (R61–R70; "Done"
above).** Each item is a behaviour
package; every value stays a `balance.ts` key and is re-measured on the
§9 seeds (`CAREER_ECON=1`, `CAREER_ARC=1`) before and after.
- **ECO-07 + ECO-08, breaches by difficulty (decided 30/10, replaces 3-A and
  4-B):** no day-one founding partner. Easy: breach 1 → the Backer loan AND
  a partner's help (an income boost for one split); breach 2 → the loan;
  breach 3 → bankruptcy. Normal: breach 1 → the loan; breach 2 →
  bankruptcy. Hard: breach 1 → bankruptcy. No forced sale of the
  highest-paid player (restructurings go). The warnings (8 weeks, then
  every Monday at ≤ 4) stay.
- **ECO-09, the money scale (revisits 1-A):** wages feel too low, or should
  grow more steeply; the old 12 % felt better. One index at 12 % a season
  and a steeper wage curve for strong players, measured on both sides of
  the guardrail.
- **ECO-10, the prize share per contract (replaces M6's fixed 20/35/50):**
  each contract carries the share of prize money the player keeps, shown and
  negotiable in the offer, the renewal and the contract, so deals vary.
- **ECO-11, the wage negotiation:** on a signing the negotiated value
  sometimes does not move or makes no sense. Diagnose and redesign (with
  ECO-10).
- **ECO-12, no sale listing for now (withdraws 8-B):** remove "List for
  sale" and the late signing; a future update rethinks selling (ECO-06).
- **M7, guaranteed income** (9-B: "after M1–M3 are measured"): next, with
  ECO-07/09.
- **RTW-02, reputation in EU (and NA):** playing EU, the reputation did not
  rise (§9: rep 5 for two seasons, no sponsor before S4). A path to
  reputation the first seasons can reach.
- **RTW-03, every org enters its history (C-1):** a region may hold more
  than 16 orgs, or an org without a lineup leaves; either is fine (Karmine
  Corp and the other later EU, SAM and NA orgs must appear).
- **RTW-04, fewer known players without a team:** it should happen, but much
  less often than now.
- **RTW-05, a full squad to play:** no event with fewer than three players
  (no stand-in for a missing player); the team rating always counts three
  seats, an empty one as 0.
- **DEV-04, honest potential (revisits DEV-01e):** bands at most 5–6 points
  wide, never much higher than the true potential (known players showing
  99 now); an older player in the market shows no potential he can no
  longer reach; a phase tag — developing / at his peak / declining —
  unknown until a scouting report reveals it.
- **UX-07, the screens:** a Market filter "signable at my reputation"; a
  signing with a full squad only warns and sends the user to Squad (no
  who-leaves block on the offer sheet); the difficulty screen with only the
  basics of each mode; the Blockbuster explanation only on a Blockbuster
  bid, and a better sentence (EN + PT; today it shows on plain bids too);
  the Finances balance chart opens an expanded view.
- **BAL-04, match difficulty:** Normal felt a bit easy (not played enough to
  be sure): measure the career's win rates by preset and region with the
  harness and tune against the presets' intent.

**Gate 2:** Miguel approves the new numbers (curves, economy) and plays a
long career on staging.

## Etapa 3 — the new RTW loop (contracts first)

Covers DEV-03 (training packages, scrims, distinct coaches), ECO-04
(sponsors), ECO-05 (other income), UX-01 (HQ around the next decision),
UX-02 (season goals), UX-03 (news, 50/50), UX-04 (creation), UX-05 (RTW
achievements in the general list), UX-06 (unlocks, "New", contracts),
CAL-01 and SUN-01..03. The written contract of DEV-03 starts now, so 2b
never calibrates the old training model as if it were final.

- **The written contracts (rc.32, proposals for Gate 3a):** DEV-03 →
  `TRAINING-CONTRACT.md`, ECO-04 + ECO-05's caps → `SPONSOR-CONTRACT.md`,
  UX-01 → `HQ-CONTRACT.md`: today against the contract with code
  references, acceptance criteria, candidates with ranges, seven decisions
  each, the order of work. No number moves before Miguel approves.

- **DEV-03, a package per period** (direction approved): pick a routine for
  a period, see its benefit and cost, get the result at the end; training
  is never "click the same scrim every week".
  - Flow: the coach suggests or the user configures → approve or delegate →
    the routine runs inside the calendar → a summary → renew, adjust or
    keep the base growth.
  - Parts: period (test default 28 days; compare 3–4 weeks with a whole
    split), objective (development, competitive preparation, recovery /
    consistency), one squad focus (optional per-player tweaks, never a
    form for every player), scrims (count and level), execution (automatic,
    around events and windows; an Advance or a reload never doubles a
    session), the end summary (overall before/after, attributes,
    series/scrims, the coach's effect, wear; kept as history, not a
    toast), delegation (the coach renews and adjusts without asking every
    week; exceptional decisions stay visible).
  - Scrim levels: easy (confidence, little growth), even (synergy, a
    moderate return), hard (more learning, more wear and risk). Scrims never
    give official points, prizes, win achievements or endless XP.
  - Coaches: technical quality + experience + specialization, each with a
    measurable effect (the plan's suggestion, focus efficiency, scrim
    quality, recovery). Ex-pros cost a little more and bring a bit more,
    good generic coaches exist too, and coaches grow with relevant
    experience. Today's problem: generic coaches are 62–84 and an ex-pro is
    `55 + 0.25 × last normal card`, so even a 99 card makes an ~80 coach.
    The hire screen compares wage, specialty, package effect and expected
    impact.
  - Acceptance: a whole period with and without a package; three coach
    profiles; three scrim levels; delegation over several periods; a coach
    change mid-period; refresh and fast advance; events in the period; a
    young reserve and a starter.
- **ECO-04 sponsors:** weekly pay, a fixed or milestone payment and a
  performance bonus; goals, deadlines and proportional fines, announced
  upfront and scaled to the team's level and to opportunities the calendar
  really offers. Compare stability, total return, length, risk and the goal
  in one component. **ECO-05:** appearance fees and partner actions with a
  cap and an agenda cost, never free money that hides an imbalance.
- **UX-01, HQ:** a) one main block per decision (offers, random events,
  invites replace the Advance block like the weekly insert does; the clock
  never passes a needed decision); b) squad as compact Draft-style cards
  (rating border, club icon; no initials square; age, trait, growth and
  potential readable on mobile); c) the training block (active plan,
  progress, days left, focus, scrims, coach, last result; adjust, approve or
  delegate from it); d) a Major / Worlds standings toggle (points, position,
  the cut, fixtures left) from the same source as the seeding; e) finances
  (balance, next payroll, guaranteed income, debt, projection; the chart
  opens larger with more history, no invented data); f) the toolbox (boosts
  bought in HQ, price/buff/duration visible; the bootcamp lasts one split
  and shows its end).
- **UX-06:** a) a centred unlock modal for the toolbox and "New" markers
  on tabs (unlocked to buy ≠ bought; once per novelty, seen state
  persisted); b) contracts: a warning on the HQ squad card, the time left,
  reminders before the player can leave, and an explicit review before the
  rollover (today: one general warning at week 23 and a news line).
- **UX-02 season goals:** realistic for the squad, resources, region,
  stage and past results; deadline and progress visible; no trivial or
  impossible goal, no goal that moves after each win.
- **UX-04 creation:** more crests, symbols and layouts; independent
  primary/secondary colours with an instant preview and a contrast guard;
  presets help without locking the combinations. The Management Style step
  goes (BAL-02 presets replace it).
- **CAL-01 calendar:** the whole window in blue, more visual events, no
  payroll marker (payroll stays correct in Finances; the event keeps
  priority over the window background).
- **SUN-01..03 the weekend:** back to HQ after Saturday's qualifier or
  Swiss, an optional preparation and a conscious start of Sunday (existing
  dates; no free training day or payroll; no replayed qualifier or double
  prize); a short full-screen intro before Championship Sunday (skippable,
  reduced motion, plays once, no spoiler); the rest of an event the user
  is out of (qualified teams and rounds, readable results, watch / sim /
  skip). Hypothesis for the optional activity: a coach briefing (keep the
  plan, recover, or prepare for the opponent) with a small, transparent
  effect; skipping keeps the career viable.
- **UX-03 news and 50/50:** a more visual feed (one headline, crests, a
  short subject, the consequence or action); historical beats conditioned on
  the save's state or labelled as archive (Vitality signing Zen, FURIA
  moving to NA). "The Wire" becomes a **50/50** presentation with its logo,
  if the partner agrees on material, naming and credit; never an invented
  quote. A minimum partnership is planned for 2.0.
- **UX-05:** RTW achievements in the general list, filterable by mode;
  one source per id, permanent across saves, never granted twice or lost at
  a Season reset.
- **"New" markers (all areas):** identity + profile/save scope + seen
  state; they clear when the content is opened, not when a tab is
  visited; urgent items (contracts) above cosmetics.

- **Built in rc.34** (R71–R80; "Done" above): DEV-03, ECO-04/05, UX-01,
  UX-06 and the 31/10 additions below. **Not built yet, next in Etapa 3:**
  UX-02 (season goals), UX-03 (news and 50/50), UX-04 (creation), UX-05
  (RTW achievements in the general list), CAL-01 (the calendar) and
  SUN-01..03 (the weekend).
- **rc.34 additions — Miguel's first rc.33 run (31/10), built in rc.34:**
  - ECO-13, the rescue is a bank loan: a breach brings the bank's emergency
    loan (the money), never an "investor"; an investor may come with the
    first loan and help the income lightly; a modal says what happened.
  - ECO-14: no signing lock while a loan is owed.
  - ECO-15, the debt ends the career, not the breach count: repay within a
    deadline (by difficulty, not punitive) or the career ends.
  - RTW-06: with two players a regional cannot be played: each one offers
    "Skip this regional"; a free agent can still fill the seat outside the
    window (R67).
  - UX-08: the difficulty screen again — plainer text, less clutter.
  - ECO-16: the talk's levers still freeze at times; ECO-17: no prize share
    for low-overall players and founders, only from a higher overall.
  - BAL-05: he went broke in the first split with the veterans roster —
    check every founding roster's first split.
- **Gate 3a: approved 30/10** — the recommended options of all three
  contracts (training 1–7 A; sponsors 1–5 A, 6-B, 7-A; HQ 1-B, 2–7 A), the
  sponsor contract adjusted to ECO-07/08: there is no day-one founding
  partner to hand over from, only Easy's rescue partner.
- **Gate 3b:** a playtest. The loop must not need a repetitive weekly chore.

## Etapa 4 — collect and progress

- **COL-01 and COL-02 were pulled forward and built in rc.33** (#151–#154).
  Open for Gate 4: the album's pacing (a card per find now: about 420
  Classic runs for the worldwide album against 150–180 in rc.32;
  `nationalTeamChance` or a weight for found-but-incomplete teams), whether
  the "New" markers sync across devices, and an analytics event for the
  find itself.
- COL-01a: the album looks like an album; inside a national team, the
  players in a formation instead of a grid (country and edition, slots,
  progress, locked and collected cards; no overlap on mobile).
- COL-01b: finding a national team reveals its page; drafting each player
  collects his card (discovery is separate from ownership; incomplete teams
  stay favoured in the drop; cards already granted are kept). Today every
  card of the team is granted on the find.
- COL-02a: a NEW tag in the draft on a special or national card not owned
  yet, decided against the inventory BEFORE the offer (the find grants the
  cards today, so a later check hides the tag). "Not owned" is not "not
  seen".
- COL-02b: an org/country card of a national team gets a national visual
  (player, coach and sub carry a specialId today; the org does not). No new
  collectible or mechanic unless needed; coach/sub/org's place in the album
  progress is written down.
- COL-02c: "New" across collection, profile, Challenges and the album,
  persisted per item, coherent outside and inside, never everything new at
  each login. Reuse the profile's unseen-cosmetics dots.
- DATA-02: new special cards, their art, eligibility and windows (none
  leaks into RTW unless intended), and a regression of the Region-only modes
  already built (NA, EU, SAM, MENA, OCE; APAC and SSA have no Region-only
  mode but play in the RTW circuit).
- CH-01: Challenges with more varied mechanics. CH-02: every Challenge and
  every star solvable from the real options, prerequisites right, reward
  once; a win sample does not prove a composition star. CH-03: test the
  daily quiz and the daily Challenge (seed, UTC reset, tries, rewards,
  PT) and decide whether they stay.
- UI-01a: the Season Tracker previews each rank's reward under the bar
  (pick a rank → the item, its art and condition), respecting when the
  reward is really given (today: at the cutover). UI-01: the daily login
  modal redesign.
- UI-02a: banner animations, Overdrive first, each banner in the profile,
  the picker, the preview and other screens, animated and static, EN/PT,
  desktop/mobile, reduced motion. UI-02b: badge centring one by one, First
  Chapter included: optical alignment and the useful area at every size.
- SEA-01, review part: XP versus Season Rating, cadence and gains (no endless
  farm), the season's events and rewards. Plan §3 puts XP/rating and rewards
  in M4; the dates stay in Etapa 6.
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
- WEB-01: SEO and Search Console (DRAFT-11 done in rc.32, #148: the PT pages
  export `lang="pt-BR"` and PT chrome).
- WEB-02: performance (the whole-run request budget done in rc.32, #149–#150:
  56–59 of 75; `node scripts/request-budget.mjs`).
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

## Scope proposals (P2, not authorized)

- **EVT-01 EWC (clubs)** and **EVT-02 FIFAe (national teams)** in RTW:
  proposals; format, frequency, field, dates and version are open. Design
  one event at a time (EWC reuses the club engine best; FIFAe needs the
  user's role, call-ups and the return to clubs). Guardrails: no Major or
  Worlds points by accident, extra money under control, own event
  namespaces (seeds and ids stay), and only once the base career is
  measured; never a fix for a broken economy.
- **FORM-01, a player "in form":** a small, short, clearly sourced
  temporary bonus (e.g. +1 to +3 for an event or a few days), apart from the
  permanent overall and potential, shown as base + bonus + expiry; one
  positive rule first, never stacked, never rerolled by a reload, the same
  treatment for AI teams, and never counted twice with the engine's
  per-series form. Patch scope open.

## Waiting on Miguel

**Gate 2 + Gate 3b — what to play on rc.34** (desktop and mobile, EN and
PT). Start **new careers**. An older save loads too: an open Backer debt
becomes the bank's loan, due from the update; training restarts on the base;
a pending sponsor offer becomes an rc.34 decision.
- Creation: the difficulty step (a promise and three plain bullets; the
  money line says whether the bank lends, how many loans and the deadline);
  the roster step's "Start budget" and the weeks of wages it covers; the
  veterans roster through its first split on Normal.
- HQ: one main block — the decision that waits, or the clock — with the
  "Also" line. Nothing walks past a needed decision (+1 day, the batched
  Advance, the autoplay, Championship Sunday, a reload); "Later" only on bids
  and sponsor offers, up to their deadline. An invite shows inline and stops
  the batched Advance once. The squad as Draft cards, the seeding line, the
  finance block (the chart opens larger), the toolbox's confirm sheet, the
  bootcamp lasting the split.
- Training: on Normal the coach proposes on each period's first Monday
  (approve, adjust, keep the base); the builder's projection; the three scrim
  levels; the period report; a coach's hire card (quality, experience,
  specialty; an ex-pro). Easy: the coach runs it. Hard: you set it, with
  Repeat.
- Sponsors: the three cards (Steady, Balanced, Bold) at 360 px in EN and PT;
  "Later", then the deadline holds the clock; a missed Balanced or Bold goal
  → the fine on Finances; Bold's milestone payment; a Steady deal with three
  misses renews a tier lower; no fines on Easy.
- Money: overspend below the floor → the modal (the bank's loan; on Easy the
  investor too); the warnings at 8, 4 and 1 weeks with the projection; sign a
  player while owing; "Pay it all"; reach the deadline without the money →
  the career ends. Hard's first breach is now a 24-week loan.
- The contract talk: every lever moves or says why; a prize share only from
  80 up (none for founders).
- A short squad: release a player → "Skip this regional" (or sign a free
  agent outside the window).
- "New": dots on Squad and Finances, the unlock modal once; the contract
  clock on the squad cards, reminders in weeks 28 and 31, the review before
  the rollover.
- From rc.33, where not played yet: the expanded balance chart, the
  reputation filter, renewals (the ×2.5 cap, the title raise), the potential
  bands, the 2021-22 rollover (Karmine Corp), match difficulty, the national
  album.

**Decide (rc.34):**
1. **Hard's first breach** is now a 24-week loan (one loan a career). Keep
   it, or restore "Hard ends at the first breach" (`breachesToEnd.hard: 1`)?
2. **The loan's numbers:** deadlines 64 / 48 / 24 weeks, 20 % interest,
   three top-ups, 3 / 2 / 1 loans a career; the investor only on Easy (20 %
   of the wage bill for 10 weeks). Keep them, or the investor on Normal too?
3. **Bold sponsors' fines:** careers that only take Bold deals go over the
   season-fines band in 24 % of seasons (band 10 %). A: accept it as Bold's
   risk; B: Bold's fine 0.5 → 0.35; C: a season's fines at most two weeks of
   payroll.
4. **EU on Normal:** 36 % of its careers (5 of 14) end on the loan's
   48-week deadline — the spender, tuned, badSponsor and coachChurn bots,
   owing 0.6–1.4 seasons of wages; the band is 20 % a region (the other six
   regions: 0–7 %). A 64-week term only moves four of the five endings 16
   weeks later (measured). A: keep it — the newcomers do not break there,
   these are the spending bots in the hardest region (recommended); B: a
   last-chance extension when half the debt is repaid; C: more guaranteed
   income in EU (against contract (f): the same money rules everywhere).
5. **The snowball at the top** (hands-off careers in weak regions bank many
   seasons of payroll; p90 14.9 / 8.6 / 6.8, flat since rc.33): the sponsors'
   level scale does not reach them. Next lever: the wage budget (M6 lever 4)
   or a steeper level scale?
6. The album's pacing (about 420 Classic runs for the worldwide album), and
   the card at the run's end or at the pick (rc.33's decision 1).
7. DEV-04's band: the truth always sits in the band's top three points.
   Keep it, or narrow the band (rc.33's decision 4)?
8. The "New" markers (the album's and the career's) stay on the device,
   not synced. OK?
9. **The older roster later on:** its first split is fixed (all 42
   measured careers carry it), but hands-off its veterans retire in seasons
   3–4 and the costly refill ends 43 / 64 / 86 % of those careers in seasons
   5–7. A retirement warning and a cheaper rebuild path: now, or with
   Etapa 5's calibration?

**Answered 31/10 (Miguel's first rc.33 run), built in rc.34:** the rescue is
the bank's loan with a deadline (ECO-13, ECO-15), an investor only with the
first loan, a modal, no lock while owing (ECO-14); "Skip this regional" with
a short squad, and a free agent outside the window (RTW-06, R67); the
difficulty screen again (UX-08); the talk's levers (ECO-16); a prize share
only for higher overalls (ECO-17); the veterans roster's first split
(BAL-05).

**Answered 30/10 (Gate 3a):** the three Etapa 3 contracts as recommended —
training 1–7 A; sponsors 1–5 A, 6-B, 7-A; HQ 1-B, 2–7 A — with the sponsor
contract adjusted to ECO-07/08 (no day-one founding partner). Built in
rc.34.

**Answered 30/10 on rc.32** (the work is Etapa 2's "2b part 3"): 3-A
rejected (ECO-07: a rescue partner at the first breach on Easy/Normal
instead); 4-B replaced (ECO-08: 3 / 2 / 1 breaches, no forced sale); 1-A
revisited (ECO-09: 12 %, steeper wages); M6's fixed share replaced (ECO-10:
per contract); 8-B withdrawn (ECO-12); C-1 answered (RTW-03). **The rest
(30/10): Claude decides what works best and Miguel tests it** — 2-B
(renewals), 5-B's comfort cap, 6-B (prize tables at 100 %), 7-A, 9-B (M7),
10-A, the filler cap, Hard's retune (BAL-04), DEV-01's parameters, and
ECO-10's prize share values. Each keeps its `balance.ts` key.

**Still open from rc.32:**
1. The analytics catalogue (`ANALYTICS-EVENTS-2.0.md`): built, production
   only; approve or cut events. Proposed additions: the rescue partner
   (ECO-07), the preset, the per-contract prize share (ECO-10), a national
   team's find (COL-01b).
2. Web: keep the one English frame a PT-saved player sees on an EN URL?
   Should the PT chrome link to the PT pages (`/pt/sobre`)? (WEB-01)

**Still open from Gate 1** (the 28/10 plan did not answer them; the
shipped defaults stay until Miguel says otherwise):
1. PT for "Championship Sunday": keep it, or "Domingo de Finais"?
2. The prize tables: now decision 6 of the economy contract.
3. Overtime pacing, about 6–7 s at 1×.
4. Worldwide Legacy at 1.6 or 1.3 (#140).
5. The real Season 1 dates (`season.ts`: 2026-10-20 → 12-22).
6. In the user's region, local sides are rated around the user's squad,
   frozen since rc.31 at the season's first regional Monday (R49). Keep
   that, or rate them on the region's org median like the other regions
   (much harder for a starter: NA sides ≈79–87 against a 68–74 squad)?
7. Weekends the user only watches are not Advance stops. Keep that?
8. Classic scrollbars (#144): always reserve the gutter (no shift; short
   pages end their borders 10–15 px early), or only while a dialog is open?
9. PT standings tag "Avançou"/"Fora", and the local-side sheet wording
   (rewritten in rc.31: their points count in both races).

**Not needed yet (V2 plan §8):** the Season Rating deltas and whether a
Swiss exit costs rating (defaults shipped; SEA-01); which 8–10 event cards,
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
