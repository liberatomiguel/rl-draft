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
