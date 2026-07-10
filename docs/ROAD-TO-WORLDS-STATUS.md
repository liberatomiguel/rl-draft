# Road to Worlds — implementation status & handoff

> **For the next session.** The career mode (design: `docs/ROAD-TO-WORLDS-DESIGN.md`,
> including the **v0.2 adjustment pass** header — read that first) is BUILT and
> playable end-to-end behind `FEATURES.careerMode` (currently `true`).
> Nothing is committed unless Miguel's staging-commit request is confirmed —
> check `git log` on `staging`. Last updated: 2026-07-10 (v0.2 overhaul).
> Gates: `tsc` clean, **265 vitest tests**, golden-master locks the existing
> modes byte-identical.

## How to run / verify
- `npm run dev` → home has a "Road to Worlds" card; nav has a **Career** entry.
  `/career` → creation wizard → hub (HQ).
- `npm test` (265 green). Career-specific: `npx vitest run src/engine/career
  src/store/careerFlow.test.ts src/engine/regression.golden.test.ts`.
- Kill switch: `FEATURES.careerMode = false` in `src/config/balance.ts`.

## v0.2 OVERHAUL (2026-07-09/10) — what changed on top of v0.1

Everything below is Miguel's playtest-feedback list, designed + built this
session. Details in the design doc's v0.2 header + CHANGELOG `[1.5.0-alpha]`.

1. **Day clock** — `clock = {seasonIndex, day}` (1..224; Monday-start weeks on
   the same 32-week grid; matchdays Saturday; training Mon-Fri; Sunday rest).
   Real dates (`CAREER_SEASONS[i].startDate`). Seed streams stay week-keyed —
   determinism unchanged. `processDayArrival` in `careerFlow.ts` is the heart
   (Monday = world tick; every day = offer expiry; Sat = AI events + lobby).
   Advance: `advanceDayFlow` (+1) / `advanceToNextStopFlow` (batched; stops at
   matchday, window-open Monday, fresh unofficial invite Monday, pending
   bids/sponsor offers, season end). Officials BLOCK the clock until
   played/simmed; skipping past an unofficial matchday declines it.
   **Save v2** (`migrateSaveToV2` — persist version 2, in-place migration).
2. **Scrims** (`CAREER_SCRIM`, `runScrimFlow`): 2 weekday blocks/week, Bo5 vs
   nearby-strength regional org, chemistry credit + light XP.
3. **Economy rescale**: budgets 20k/12k/8k; salary $1.5k@70 ×1.2^Δ floor $250;
   prizes 2k/10k/40k/150k/600k; sponsors 1.5k/6k/18k/45k (+ **perks**: gear
   discount 0/20/35/50%, free bootcamps 0/0/1/2); quantum $50; loan −5k→+3k.
4. **Gear & staff ladder** (`CAREER_GEAR`, replaces facilities/CAREER_BUFFS):
   peripherals(8)→monitors(14)→PCs(20)→bootcamp T1(26)→bootcamp T2(38)→
   psychologist(46)→Performance Center(55); strict purchase order
   (`buyGearFlow`); `FinanceState.gear`; bootcampSharp is now a number.
5. **Coach market**: `coachCandidatesFor` (market.ts) mixes REAL retired pros
   (world.retiredIds; OVR = 55 + 0.25×final) + generated; hire validates the
   shortlist; replacing pays severance (`CAREER_COACH_MARKET`).
6. **Stars v2**: 0-5★ half-steps, world percentile (`starsFor` v2 +
   `userStarsFor`; org `rating` snapshot persisted by `computeStars`).
7. **Chemistry**: `newcomerGraceFactor` 0.35 in `worldSim.careerChemistry` —
   swap ≈ 85%→60%, not halved; maxRawPerPair 6.0.
8. **Training v2**: focus share 0.9 (+0.35 offset), auto=coach plan 0.95 (no
   coach → balanced), per-player **intensity** light/normal/heavy (heavy adds
   telegraphed unavailability risk), daily ticks (`trainDay`), engine-truth
   UI projections (`trainingProjection`).
9. **Mail/Inbox split**: `save.mail` (MailItem; per-item read) = offers,
   sponsors, contracts, finance, unlocks; news feed (+ `news.body.*` texts
   EN/PT) lives on the HQ. Unified resolver:
   `src/components/career/news/newsText.ts`.
10. **UI rebuilds** (all screens): HQ dashboard (NOW hero + week strip +
    quick actions + wire w/ bodies + tiles), Inbox (email client), Calendar
    (FIFA month grid + next-for-you + day detail), Event screen v2 (live
    swiss standings + bracket + goal-by-goal + working controls, wired the
    previously-dead `eventPlayback.ts`; pacing in `CAREER_PLAYBACK`),
    Squad/Training v2, Market (search/sort/filters + Coaches tab + PlayerSheet
    preview) / Finances (gear ladder + perks + sparkline), Standings/Club/
    Saves/Season polish, TopBar date clock.
11. **Crests v2**: `UserCrest` renders composite ids `shape[:symbol[:pattern]]`
    (legacy ids unchanged); shared `OrgMark` dispatcher gives every filler org
    a deterministic procedural crest; wizard step 2 = shape+symbol+pattern+
    free colors + randomize.

### v0.2 fixed bugs (root causes in CHANGELOG)
Training-cap double count · event score orientation (fake ties) · instant-sim
trap · sale fee polluting biggestSigningFee · Math.random news ids (now
`save.seq`) · WINDOW_LAST_WEEK hardcode (now `resolveDay`).

## File map deltas (vs v0.1 map)
- Engine: `calendar.ts` gained the day layer (weekOfDay/dayOfWeekOf/
  eventDayFor/dateOfDay/DAYS_PER_SEASON/windowCloseDayFor/nextUserStopDay);
  `economy.ts` gained gear helpers + starsFor v2; `development.ts` gained
  trainDay/trainingProjection/focusShareFor/intensityMultFor; `market.ts`
  gained coachCandidatesFor; `worldSim.ts` gained userStarsFor + grace
  chemistry + org rating snapshots.
- Store: `careerFlow.ts` = day machine + scrim/gear/mail flows +
  migrateSaveToV2; `careerStore.ts` persist v2 + new actions.
- UI shared: `careerUi.ts` (day-clock view-models), `dateText.ts`,
  `news/newsText.ts`, `OrgMark.tsx`, `TeamStars.tsx` (0-5 halves).
- Copy: new groups `dates`, `mail`, `scrim`, `news.body`; extended hub/
  calendar/training/market/finances/event/club/wizard. PT mirrored (type-enforced).

## REMAINING / NEXT (post-v0.2)
- **Real player ages** (v0.1 item B — still open): add `born:` rows for
  modern-era players; `development.deriveBirthYear` stays the fallback.
- **Progressive market availability by reputation** (v0.1 item C — still
  open): hard rep gate on signable OVR (design §21.3 chose soft premium;
  Miguel wants a visible lock — `maxSignableOverall = f(rep)` + locked rows).
- **Pacing harness** (`CAREER_ARC` bands) — the bot plays seasons in
  `careerFlow.test.ts`; the 120-career difficulty sweep is still to build.
  Re-validate economy bands after Miguel plays the rescale.
- Balance watch: entry salaries/prizes after real playtests; scrim
  chemistryCredit 0.04 and CAREER_SCRIM.xpWeeks 0.4 are first guesses.
- `upcomingStops` never emits kind "payday" (UI handles it defensively).
- Club "Edit crest" needs a store action for identity colors/crest re-edit
  (wizard-only today).

## Guardrails (do not break)
- Engine pure/deterministic; randomness via `deriveSeed` streams; seed-stream
  ids are a compatibility surface (day clock kept them week-keyed on purpose).
- Every tunable in `balance.ts`; every string in `copy.career.en.ts` + `.pt.ts`.
- Existing modes byte-identical — `regression.golden.test.ts` is the tripwire.
- Saves migrate additively forever (`migrateSaveToV2` pattern).
