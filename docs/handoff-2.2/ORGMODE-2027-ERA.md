# v2.2 front ERA: a career can start at any era (stage 1 of ORGMODE-2027-SPEC)

Branch `v22/era-2027`, cut from `release/v2.2` at `7e94926`. Spec: `ORGMODE-2027-SPEC.md`, "Stage 1 (front ERA)".

## 1. Audit: what `seasonIndex` means at each use

`seasonIndex` is read about 1700 times. Almost all of them compare a record's season with the clock's (`e.seasonIndex === save.clock.seasonIndex`), key a stream or an absolute week (`seasonIndex * 32 + week`), or count a contract's end: those are **neutral**, they only need one clock, whichever origin it has. The table lists the uses that read the season against a fixed number, so the origin matters.

| File | Use | Class | Decision |
|---|---|---|---|
| `development.ts` | `seasonYear`, `ageOf`, `seasonOrderFor`, `ageAtOrder`, `anchorOverall(…, seasonOrderFor)`, filler and rookie ages | era | absolute index, unchanged; filler birth years read the world's start era (see E2) |
| `calendar.ts` | `seasonLabelFor`, `seasonIdFor`, `intakeSeasonIdFor`, `orderFor`, `dateOfDay` (start dates), `worldsCancelledIn` | era | unchanged |
| `worldSim.ts` | `buildWorldAtCreation`, `realOrgIntake`, `orgRelocations`, `orgHistoryOverAt`, `agePassAndIntake` (anchor protection, late wave), `orderFor` | era | unchanged, plus the start-era build |
| `worldSim.ts` | `worldsRegionShift` (the early Worlds spread: the dataset's early-era strength) | era | unchanged |
| `worldSim.ts` | `earlyRegionShift` (R143: a new club's catch-up ramp in EU and NA) | progress | reads the career season (field ctx gains `startSeasonIndex`) |
| `data/career/beats.ts`, `careerFlow` beats step | scripted history beats (Season X format, KC enters…) | era | unchanged (a 2027 start is past all of them) |
| `worldLife.ts` `worldLifeOn`, `endless.ts` `endlessYear`, `careerFlow` `isInfinite`, the timeline's Final Whistle, `SeasonScreen.canContinueSeasons` | era (past the dataset) | era | unchanged; a career created inside the world-life era gets its creation-time setup (local caps) |
| `economy.ts` `moneyIndex`, `indexedAmount`, `lateRevenueActive`, the prize table loop, `sponsorDeals` quotes, `orgProfile.orgMoneyFor`, `budget.ts` ratios | money ramp | era (decision 1) | unchanged; see "Decisions" |
| `careerFlow` processDayArrival: founding day (`seasonIndex === 0 && day === 1`: founding partner, no payroll on W1, the start budget recorded) | progress | progress | `careerSeasonOf(save) === 0` |
| `careerFlow` `rollUnavailability` novice guard (`seasonIndex === 0 && split === 1`), the no-reserve grace (`< unavailabilityNoReserveGraceSeasons`), its one-time mail at the rollover | progress | progress | career season |
| `careerFlow` founding-partner repair (`<= founding.throughSeasonIndex`), `economy.foundingPartnerEnds`, `repairFoundingShareOnLoad` (`FOUNDING_DEAL_END_SEASON`) | progress | progress | career season (the founders' share repair only matches founders, absent in a takeover) |
| `market.userBidsBlocked` (first window bid-free, `seasonIndex === 0`) | progress | progress | optional start argument |
| `careerResults` season grade debut grace (`seasonIndex === 0`) | progress | progress | optional start in the input |
| `inserts.ts` first-regional quiet period (`seasonIndex === 0`) | progress | progress | career season |
| `lib/careerSavesNotice` (sign-in notice after the first season) | progress | progress | career season |
| `board.ts`, `established.ts`, `budget.ts` (`board.startSeason`, `protectedUntil`, `grantBaseNow`) | progress, already relative | progress | unchanged; `boardOnCreate` now passes the clock's season instead of `0` |
| `orgProfile.datasetCoachOf` (null past index 5), `realOrgChoicesFor` | era | era | reads the late wave's coach at its season |
| `pro/**` (`seasonIndex === 0` first invite, the Pro's own displays) | progress | Pro only | unchanged: a Pro career always starts at 0 |
| Board and manager displays (`logWhen(seasonIndex + 1)`, contract "until season N", spells) | progress display | progress | **not changed**: the MANDATE front owns the board UI (see "Not done") |
| `ClubScreen` delete confirm ("season N") | progress display | progress | career season |
| Bots (`auditHumanBot`, `careerArcBot`: `switchAfterSeason`, the no-reserve grace) | progress | progress | career season |

**Shape (E1):** `seasonIndex` stays the absolute era (6 = RLCS 2027); progress reads `seasonIndex − startSeasonIndex` through one helper, `careerSeasonOf(save, seasonIndex?)` in `src/engine/career/era.ts`. The audit makes this the smaller side: the era readers are hundreds of call sites (every age, label, dataset lookup and stream), the progress readers about twenty, each with the save or a context at hand.

## 2. What changed (commits `3403040` E1/E2, `0f18b19` E3/E4, then this handoff)

- **`src/engine/career/era.ts` (new):** the start era's helpers. `src/config/balance.ts`: `CAREER_ERA` (one block after `CAREER_CANCELLED_WORLDS`), `BALANCE_VERSION` 53.
- **Types (`types.ts`):** `CareerSave.startSeasonIndex?`, `WorldState.eraStart?`, `WorldOrgState.returningFrom?`. All optional; `persistContract.test.ts` untouched and green.
- **E1, progress sites:** `careerFlow.ts` (founding day, payroll skip on W1, unavailability guard, no-reserve grace and its mail, founding-partner calls and repairs, season grade, incoming bids, listing), `market.userBidsBlocked` and `transferList.listingBlockFor` (optional start), `inserts.ts`, the `worldSim` field build (`earlyRegionShift` reads `seasonIndex − world.eraStart`), `lib/careerSavesNotice` + `SavesNotice` + `HubScreen`, the `ClubScreen` delete confirm, `auditHumanBot` (two progress reads). `boardFlow.boardOnCreate`: `boardFor` and `newManagerState` get the clock's season instead of `0` (two lines; nothing else in the board).
- **E2:** `worldSim.buildWorldAtCreation(seed, startSeasonIndex = 0)` calls the new `buildWorldAtEra` for a start above 0; `addCreationFaProspects` takes the season; `agePassAndIntake` carries `eraStart`. `development.fillerPlayerView` reads its birth year at `world.eraStart`; `realPlayerView` resolves a window sub with no club card (`eraSubAnchorOf`). `careerFlow.createCareerSave`: start = `clampStartEra(input.startSeasonIndex)` for a takeover, 0 otherwise; the clock, goals, stars and the world-life local caps at that season.
- **E3:** `development.projectedArcOf`, `retirementChanceFor(p, table?)`, `signsForFinalSeason(p, season, world?)`, and `growthCtxOf` adds `retire` in a last-era world; the `worldSim` age pass reads `retirementTableOf(world)`; `buildWorldAtEra` marks every real player off-script in a last-era world; the `careerFlow` season outlook and signings and `MarketScreen` pass the world.
- **E4:** `orgProfile.datasetCoachOf(…, eraStart?)` reads the late wave's coach; `RealOrgChoice.returningFrom?`; `seatSwap` passes `eraStart`. `TakeoverPick.tsx`: the era from `takeoverStartEraFor(location.search)` goes into the world, the choices, the preview and `createCareer`; one line in the dossier header for a returning org (`C.takeover.pick.returning`, EN and PT).
- **Tests:** `engine/career/era.test.ts`, `engine/career/era.e3.test.ts`, `store/careerEra.test.ts`. Probes: `careerSoftlock.probe.test.ts` takes `P1_SOFT_ERA` (and `P1_SOFT_PICK`), `careerBoard.softlock.test.ts` takes `BOARD_SOFT_ERA`.

## 3. API for the other fronts

```ts
// src/engine/career/era.ts
LAST_START_ERA: number                                   // 6 (the late wave, RLCS 2027)
clampStartEra(n?: number | null): number                 // 0..LAST_START_ERA
startSeasonOf(save?: { startSeasonIndex?: number }): number
careerSeasonOf(save: { startSeasonIndex?; clock: { seasonIndex } }, seasonIndex = clock): number  // 0 = the career's first season
isLastEraWorld(world?) / lastEraRulesOn(world?): boolean
retirementTableOf(world?): RetirementTable              // CAREER_AGE, or CAREER_ERA.longCareers in a last-era world
takeoverStartEraFor(search: string, staging = STAGING_BUILD): number   // default 6; staging ?era=N
// worldSim
buildWorldAtCreation(careerSeed: number, startSeasonIndex = 0): WorldState
// CreateCareerInput.startSeasonIndex?: number          // honoured for a takeover with FEATURES.realOrgStart
// RealOrgChoice.returningFrom?: number                 // the era index of the org's last lineup
// takeoverInputOf(choice, difficulty, managerName, startSeasonIndex?)
```

For MANDATE: a 2027 takeover's board has `startSeason = 6`. Anything that shows "season N" should read `careerSeasonOf(save, s) + 1` (or `seasonLabelFor(s)` for the year). The board's logic and tests needed no change.

## 4. Measured (every staging flag on unless said)

| Check | N, seeds | Result |
|---|---|---|
| Founded bit-identity vs rc.6 | 2 founded careers × 8 seasons (NA autopilot, SAM tuned, seed 9100) + 1 EU mid takeover × 2 (seed 5150); save hash at each season's start and end | 40 / 40 rows identical, after E1/E2 and again after E3 |
| Suite, flags off | 3342 tests | 3280 passed, 62 skipped, 0 failed |
| `P1_SOFT`, 2027 takeover, 7 seasons | NA, EU, SAM, MENA × autopilot and tuned, seed 9100 (the org a third of the way down the list) | 8 careers, 1293 lobbies, **0 findings** |
| Soft-lock at each other era, 3 seasons, tuned | era 1 EU, 2 SAM, 3 NA, 4 MENA, 5 OCE, seed 9100 | 5 careers, 352 lobbies, **0 findings** |
| `BOARD_SOFT_ERA=6` | its two job moves (EU dismissal, SAM approach), seed 5150 | **2 / 2 passed** |
| 2027 world, seed 5150 | orgs per region | NA 19, EU 24, SAM 16 (4 returning), MENA 16 (6), OCE 16 (9 fillers, 5 returning), APAC 16 (3 fillers, 10 returning), SSA 16 (12 fillers, 3 returning) |

**E3, before → after**, on the 213 players on 2027 rosters, 2 takeover careers played by the arc bot (tuned, Normal): EU seed 5150 (Ninjas in Pyjamas) and NA seed 9100 (Gen.G). "Before" is the same code with `CAREER_ERA.lastEraRules = false` (dataset potential, real players frozen on their last card, retirement 24–29).

| | before EU / NA | after EU / NA | aim |
|---|---|---|---|
| active after 3 seasons | 90 % / 87 % | 99 % / 99 % | ≥ 75 % |
| active after 6 seasons | 62 % / 62 % | 90 % / 87 % | ≥ 50 % |
| active after 8 seasons | 47 % / 46 % | 72 % / 72 % | none |
| real players in the world's top 30, season 4 | 80 % / 83 % | 100 % / 97 % | ≥ 60 % |
| same, season 8 | 13 % / 3 % | 67 % / 63 % | none |
| top-30 cut-off, season 4 | 88.5 / 88.0 | 93.0 / 92.7 | none |

"After k seasons" is the snapshot on day 1 of season 6 + k. N is two careers, so the numbers show a direction; they are not a calibration. The aims are met. The "before" already met the 3-season, 6-season and season-4 aims. What it lost was season 8: real players were only 3–13 % of the top 30, and the generated prodigies had taken over.

## 5. Decisions taken here (R173–R176 in ROAD-TO-WORLDS-DECISIONS.md)

1. **Shape:** the preferred one (absolute era, progress through `careerSeasonOf`), because the audit found only about twenty progress sites.
2. **Money reads the era, not the progress** (R174). The single money index multiplies every indexed amount by the same factor, so a 2027 takeover is the 2020 economy ×2.31. The real difference is that the late-revenue factor (bigger Major and Worlds pools and late sponsor quotes, normally "from the 4th season") is on from day one. Making money progress-based would mean threading the start through the prize, wage, fee and sponsor functions that the world also reads. Not measured: the cash of a 2027 takeover against a 2020 one.
3. **A founded club starts at 0** in this stage, whatever the input says, because its founding money and budget are season-0 money.
4. **E3 un-anchors every real player in a last-era world.** Without that, a real player with no later card never develops (an anchored player follows his cards), and a projected potential would do nothing. This is the largest change in E3. It is also why the top-30 cut-off rises by about 5 points.
5. **Free agents "aged to the start"** means: their last overall, their real age at the start, and nobody past the retirement window. No decline is applied for the years they were away.
6. **A sub with no club card** has no card to date his debut, so the debut-age rule takes 2021 as his debut and he is 19–23 in 2027. That covers 12 people in the 2024–2026 window.
7. **BALANCE_VERSION 52 → 53.** The fingerprint test fails on any new export, so the bump is mechanical. No founded number changes (see the bit-identity check above). MANDATE will bump too, so the integrator takes the next number.

## 6. Not done, not verified

- **Not in the browser.** Nobody has opened the pick screen with `?era=N`, the dossier line or a 2027 takeover in a browser (no dev server, as the brief asked). `tsc` and ESLint are clean on the changed files.
- **Board and manager displays** still print the absolute index + 1 for a 2027 takeover ("contract until season 8", "S7 · W3"). They belong to the MANDATE front's UI.
- **Economy of a 2027 takeover** (decision 2) is not measured. Neither is the effect of the stronger 2027 top 30 on a takeover's chance of a title.
- **The Pro** always starts at 0. Only the suite checked it; its probe was not run, because nothing in `engine/career/pro` changed and `buildWorldAtCreation(seed)` is identical at 0.
- **Not supported:** a founded club at another era, and any era from 7 on (`clampStartEra` caps at 6).
- **OCE, APAC and SSA in 2027** still need 9, 3 and 12 fillers. The data has 2, 3 and 1 orgs there, and the look-back adds 5, 10 and 3.
- **MENA and APAC returning orgs** have holes that the region's free-agent pool cannot fill (it has no real free agent), so 9 and 10 of their seats are generated players.
