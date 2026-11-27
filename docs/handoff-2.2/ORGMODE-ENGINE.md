# v2.2 rc.6 front ENGINE: the established-org mode

Branch `v22/org-engine`, cut from `release/v2.2` at the ORGMODE spec (`8400770`). Spec: `ORGMODE-SPEC.md` sections E1 to E6. `BALANCE_VERSION` 52. Flags: `FEATURES.realOrgStart` (the predicate) and `FEATURES.board` (the sign-off, the brief, the tier change). Founded clubs and flag-off careers are unchanged (`careerBoard.flagOff.test.ts` green).

## What was built, per spec section

- **Predicate.** `establishedOf(save)` in the new pure module `src/engine/career/established.ts`: `FEATURES.realOrgStart && !save.proHost && save.identity.realOrgRef`. Every rule below reads it.
- **E1, Standing.** `save.reputation` stays the number. In an established org it sits on a four-tier track (`CAREER_BOARD.standing`: promotion lines 35 / 50 / 85 into Mid-table / Contender / Elite, keep floors 18 / 28 / 40). The starting values stay 14 / 24 / 36 / 50, and each holds its own tier. **This deviates from the spec's single line with a hysteresis** (see "Decided on my own").
- **E1, nothing locked.** Every reputation gate reads `gateRepOf(save)`, which is 100 for an established org and the save's own reputation for a founded club. The audit table is below.
- **E1, signing pull.** `signCapOf(save)` returns the tier's `CAREER_BOARD.profiles.*.signCap` (underdog 86, mid 90, contender 95, elite 99) and the reputation line for a founded club. `signableFor(save, who)` is the rule the signing plan, the Market and the bots read.
- **E1, the tier change.** At the season review, after the verdict and only if the manager was not dismissed, `boardTierReview` (boardFlow) reads `standingChangeFor(board, rep, season, objectiveMet)`. The tier moves one step at most and never in the board's first season. A promotion also needs the season's objective met (`standing.promoteNeedsObjective`, on). `applyTierChange` moves the stature, so patience, expectations and the calibration cell follow it, and steps `grantBase` and `wageRoom` ×1.2 up or ×0.9 down. A promotion adds +5 confidence (log reason `promoted`). The review sends a mail (`boardTierUp` / `boardTierDown`), posts a news line (`orgTierUp` / `orgTierDown`, public) and records `board.tierChange`; the season review's verdict panel prints one line from it. A job-offer move builds a new board on the new org's own stature, as before.
- **E2, the shelf.** Installations, both bootcamp tiers, the psychologist, the four staff roles and every coach type are open from day one. An established org buys installations **in any order** (`gearRefusalOf`, `toolboxOf`, `gearBlockerOf`, Finances). Prices and upkeep are unchanged.
- **E2, the structure.** `inheritedGearFor(tier)`: the installations as before (elite 3, contender 2, mid 1, underdog 0) plus the retained staff from `profiles.*.staff`: elite analyst + psychologist, contender analyst, mid assistant, underdog none. `takeOrgSeat` applies it when `realOrgStart` is on. Starting cash is unchanged; the retainers bill weekly from it.
- **E2, sign-off.** `capitalRefusalOf(save, item)`: `boardFrozen` during a hiring-freeze window, `boardApproval` under confidence 50, `boardFlagship` for the performance centre under 65. Staff, coaches and camps are money only.
- **E2, `operationsOf(save, { floor? })`.** Three departments with a state per item (see API).
- **E3, the budget.** For an established org, `offerSeason` sizes the grant on `grantBaseNow(board, season)` (the takeover's `grantBase` on the money index) × `budgetMult` × the plan's `grantMult` + upfront. It no longer follows `min(wage bill, wage room)`. The wage ceiling stays. `seasonBudgetOf(save)` in the new `src/engine/career/budget.ts` reads the books (see API).
- **E4, objectives.** `boardPackagesFor(... established: true)`: no Community Cup, no more than `objectiveMaxCount` (5) regionals, each tier prefers `CAREER_BOARD.objectiveKinds` (underdog's ambitious plan: `objectivePlanKinds`, a Major qualification). A preferred goal wins when its chance is within `objectivePrefWindow` (0.15) of the plan's aim, else the nearest of any kind. The three plans keep their aims, bands and measured chances (R154), and stay strictly ordered (cautious > expected > ambitious), so they are three different goals.
- **E4, the brief.** `board.season.brief` (optional) from `seasonBriefFor`: `takeover`, `promoted` / `relegated`, `title`, `ultimatumSurvived`, `met` / `missed`, in that priority, with `tier`, `lastObjective`, `lastRegionalRank`, `bestFinish` and the title counts. EN and PT under `C.board.brief`.
- **E4, totals.** `goalTotalOf(kind)` (9 regionals, 3 Majors, 1 Worlds, the cups) and `C.goals.seasonTotal(kind, count, place, total)`, for example "Top 4 in 3 of the 9 regionals". `C.goals.season` is untouched.
- **E5.** `RealOrgChoice` gains `gear`, `staff`, `signCap`, `sponsorLevel`, `standing` (a `StandingView`), `confidenceStart`. `takeoverPreviewOf` was not built (UI-A owns it).
- **E6.** Every new save field is optional: `BoardSeason.brief`, `BoardState.tierChange`, and `gear.staff` already existed. Persist v3 and saveVersion 5 are unchanged; `persistContract.test.ts` is untouched and green. An rc.5-shaped takeover save (no staff, no brief, no tier change) goes through `migrateSaveToV5` and plays a full season with the arc bot (`careerOrgMode.test.ts`).

## API for the UI fronts

```ts
// src/engine/career/established.ts
establishedOf(save): boolean
gateRepOf(save): number                       // 100 for an established org, else save.reputation
tierOf(save): Stature | null                  // board.stature, else the standing's tier; null when founded
standingOf(save): StandingView | null
standingViewFor(tier: Stature, rep: number): StandingView
interface StandingView { tier: Stature; value: number; line: number; next: { tier: Stature; line: number } | null; relegationLine: number | null }
standingTierFor(value: number): Stature; standingLineOf(tier): number; STANDING_TIERS
standingChangeFor(board, rep, seasonIndex, objectiveMet?: boolean): Stature | null
promoteLineOf(tier): number                   // the standing that promotes into a tier; standingLineOf = its keep floor
applyTierChange(board, to, seasonIndex): TierChange   // mutates
signCapOf(save): number; signableFor(save, who): boolean
inheritedGearFor(tier): GearState
type CapitalRefusal = "boardFrozen" | "boardApproval" | "boardFlagship"
capitalApprovalFor(save, itemId): number | null      // 50 / 65, null when not asked
capitalRefusalOf(save, itemId): CapitalRefusal | null
freezeOnNow(save): boolean
operationsOf(save, opts?: { floor?: number }): Operations | null
interface Operations { facilities: OperationItem[]; staff: OperationItem[]; camps: OperationItem[] }
interface OperationItem {
  id: GearItemId | StaffId | "psychologist" | "bootcamp1" | "bootcamp2";
  state: "owned" | "retained" | "available" | "needsApproval" | "frozen" | "cantAfford";
  price: number;      // purchase or run price; a retainer's per split
  upkeep: number;     // weekly
  effect: string;     // the item id (copy key)
  confidence: number | null;
  note?: "used" | "active";   // camps: the split's camp is spent / running
}

// src/engine/career/budget.ts
seasonBudgetOf(save): SeasonBudget | null     // null without a board
wageCeilingOf(board, seasonIndex): number; grantBaseNow(board, seasonIndex): number
interface SeasonBudget {
  seasonIndex; allocation; bonusAtStake;
  committed: { wages; coach; staff; upkeep; loan }; committedTotal;
  spent: { wages; staff; facilities; camps; transfers; other }; spentTotal;
  income: { sponsor; prizes; fanbase; sales }; incomeToCome: { sponsor; prizes; fanbase; sales };
  free; projectedEnd; projectedEndIfMet; wageBill; wageCeiling: number | null; overCeiling;
  weeksCovered; mondaysLeft; ledgerFromWeek;
}

// src/engine/career/board.ts
goalTotalOf(kind): number
seasonBriefFor(input: BriefInput): SeasonBrief; bestFinishOf(results, seasonIndex)
establishedPool(pool); preferredKindsOf(stature, pkg); isPreferred(goal, kinds)

// src/engine/career/boardTypes.ts
type BriefReason = "takeover" | "met" | "missed" | "title" | "promoted" | "relegated" | "ultimatumSurvived"
interface SeasonBrief { reason; tier: Stature; lastObjective?; lastRegionalRank?; bestFinish?: { tier: "regional" | "major" | "worlds"; place }; majors?; worlds? }
interface TierChange { seasonIndex; from: Stature; to: Stature }
BoardSeason.brief?: SeasonBrief; BoardState.tierChange?: TierChange
```

- **Refusal reasons.** `gearRefusalOf` can now return `boardApproval`, `boardFlagship`, `boardFrozen` and `owned` (an established org asking for an installation it has). Their text is `hubShared.boardRefusalText(C, key)`, also read by `errorTextFor` and the toolbox sheet. Copy: `C.board.approval.{boardApproval(n), boardFlagship(n), boardFrozen, needs(n)}`.
- **Copy added** (EN and PT, keyed identically, no em dash): `C.board.standing.{title, tier, phrase, value, next, top, relegation}`, `C.board.brief.{heading, takeover, met, missed, title, promoted, relegated, ultimatumSurvived, lastRank, bestFinish}` (each reason takes `{ org, tier, goal? }`, where `tier` is `standing.phrase[tier]` and `goal` is goal text), `C.board.signCapLock(cap)`, `C.board.verdict.tier(up, tier)`, `C.board.reasons.promoted`, board mail and news `boardTierUp`, `boardTierDown`, `orgTierUp`, `orgTierDown`, `C.goals.seasonTotal`. Nothing under `takeover`.

## Rep-gate audit (every read of a reputation gate)

| Read | Where | Established org |
|---|---|---|
| `CAREER_GEAR.items[].repGate` | `gearRefusalOf`, `buyGearFlow`, `careerHq.toolboxOf` / `gearBlockerOf`, `FinancesScreen`, `ladderOf`, `careerUi.unlockTrack`, `careerNew.toolboxUnlockedIds`, `boardUpgradeOptionsOf`, both bots | **gate, opened**; any order; board sign-off |
| `CAREER_GEAR.bootcamp[].repGate` (`bootcampTierFor`) | `bootcampRefusalOf`, `runBootcampFlow`, `startSponsorBootcamp`, `toolboxOf`, `FinancesScreen`, `careerUi`, `careerNew`, bots | **gate, opened** (the structured camp runs, as at a founded club past rep 38) |
| `CAREER_GEAR.psychologistRep` | `psychologistRefusalOf`, `toolboxOf`, `FinancesScreen`, `ladderOf`, `careerNew`, bots | **gate, opened** |
| `CAREER_STAFF.roles.*.repGate` | `setStaffFlow`, `FinancesScreen`, `ladderOf`, `boardUpgradeOptionsOf`, audit bot | **gate, opened** |
| `CAREER_UNLOCKS.coachRep` | `hireCoachFlow`, `MarketScreen` coaches tab, `ladderOf`, bots | **gate, opened** |
| `CAREER_LADDER.exProCoachRep` (`coachHireRefusalFor`) | `hireCoachFlow`, `MarketScreen`, bots | **gate, opened** |
| `CAREER_UNLOCKS.contractedRep` | `signingPlanFor`, `MarketScreen` | **gate, opened** |
| `signableOverallCap` (the reputation line) | `signingPlanFor`, `emptySeatPriceFor`, `MarketScreen` (listing, filter, locked rows), both bots | **replaced** by the tier's `signCap` |
| `CAREER_UNLOCKS.t2InvitationalRep` | `unlocksFor` (display only; no flow reads it) | **gate, opened** (display) |
| `CAREER_UNLOCKS.relocationRep` | `unlocksFor`, `careerUi` (a "future" row; no feature) | gate, opened (nothing behind it) |
| Unlock news on a rep crossing | `announceUnlockCrossings` | only the sponsor levels are announced |
| `CAREER_LADDER.sponsorRep`, `CAREER_SPONSOR.tiers[].repGate`, `firstOfferRepGate`, `sponsorLadderLevelFor` | sponsor offers and access, `ladderOf` sponsor rungs | **scales** (kept) |
| `CAREER_ECONOMY.passivePerRepPoint` | the weekly fanbase line | **scales** |
| `CAREER_COACH_MARKET.staff.repCapBase/PerRep` | the coach shortlist's quality cap | **scales** |
| `bankLoanLimitFor` / `bankLoanRefusal` | the bank loan | **scales** |
| `askPackageFor` / `computeSalaryAsk` rep | player asks | **scales** |
| `repTierOf` | seeding prestige, lobby fields | **scales** |
| `careerResults` goal ladder `minRep` | a founded club's season goal (a board objective replaces it) | scales |
| `inserts` `minRep` | which random mid-week decisions can appear | scales (content, never shown as a lock) |
| `CAREER_REP` loss and gain rules, `repLossFloor` | the standing's own movement | scales |

## Measured

### After the refit (the current numbers)

`calibration` and `goalRates` were refitted on the rc.6 rules (commit `5653a98`). The fit used 90 competent careers × 6 seasons: seeds 9000, 12000 and 12101, NA / EU / SAM, Normal and Hard, the four tiers plus founded, every staging flag on including endless. That is 3 of rc.5's 6 fit seeds; the count matches rc.5's ~88 careers, and the full list would have doubled the run. `goalRatesK` stays 8, since the fit does not estimate it.

Every goal row is keyed by the tier the board held **that season**, so a promoted club's later seasons fit its new tier's cell. The probe's own summary now groups the same way (commit `effcdca`, see below). The underdog cells are thin (21 seasons in Normal, 25 in Hard), because underdogs that win are promoted out of the cell; those cells lean on the prior.

**Held out**, seeds 30000 and 30101, 120 careers: 60 competent on Expected and 60 careless (`badSponsor` on Ambitious), 6 seasons, every staging flag on. Competent Expected, stated → measured; N = career-seasons in which the board held that tier:

| Tier (that season) | Normal | Hard |
|---|---|---|
| Elite | 56 → 43 (76) | 44 → 57 (58) |
| Contender | 53 → **72** (25) | 55 → 41 (34) |
| Mid | 58 → 58 (26) | 58 → 73 (26) |
| Underdog | 63 → 65 (17) | 62 → **27** (26) |
| Founded | 69 → 81 (36) | 59 → 58 (36) |

- **Still more than 15 points off:** contender Normal (+19, N = 25) and underdog Hard (−35, N = 26). Mid Hard is at +15, on the line. No second fitting round was run, as instructed.
- **Bands** (all three plans): competent 69 % same band, 29 % adjacent, 3 % two or more away (N = 1080). rc.5 was 65 / 34 / 1; before the refit 50 / 36 / 14. Careless: 18 / 61 / 22 (N = 1077; rc.5: 35 % same band, 34 % two or more away).
- **Cautious / Ambitious measured**, competent. Normal: elite 67 / 30, contender 68 / 36, mid 69 / 46, underdog 88 / 29, founded 94 / 31. Hard: elite 69 / 29, contender 53 / 35, mid 85 / 46, underdog 46 / 27, founded 58 / 33.
- **Dismissals:** competent **0 / 60** (before the refit: 4 / 30, all SAM). Careless 11 / 60 (rc.5: 16 / 60). By starting tier, Normal: elite 1 (S4), contender 4 (S4-S6). Hard: elite 3 (S5-S6), contender 1, mid 1 (S5), underdog 1 (S6).
- **SAM:** the competent SAM careers (12) had no dismissal, so the SAM dismissals of the first measurement do not remain for a competent manager. Careless dismissals are still mostly SAM: 7 of 11 (NA 3, EU 1).
- **Career ends:** 2 insolvencies, both careless: NA Hard mid at S5, and a SAM Normal elite dismissed at S4 that founded a club and went broke there at S6. 0 soft locks in 120 careers.
- **Cash at S6** (median, by starting tier), competent Normal / Hard: elite $672k / $689k, contender $782k / $210k, mid $710k / $117k, underdog $206k / $85k, founded $69k / $34k.
- **Tier changes per starting tier**, competent, 6 careers per cell (promotions; no relegation in 120 careers):
  - elite: 0;
  - contender → elite: Normal 6 / 6 (S2-S3), Hard 5 / 6 (S2-S4);
  - mid → contender: 5 / 6 in both difficulties (Normal S2-S4, Hard S2-S5);
  - underdog → mid: Normal 6 / 6 (S2-S5, four go further), Hard 3 / 6 (S3-S5).
  - Careless: contender → elite 4 / 6 and 6 / 6; mid 3 / 6 Normal, 0 / 6 Hard; underdog 1 / 6 Normal, 0 / 6 Hard.
- **Probe change.** `SeasonRow.tier` records the tier the board held for the season's offer. The summary groups the stated → measured, plan and band columns by it, and counts the seasons after a job move instead of stopping there. Dismissals, cash, S1 hit and tier changes stay by starting tier. Rows from an older `BOARD_OUT` (no tier) read as before. The calibration rows (`BOARD_CAL_OUT`) and the offline evaluation already keyed by the season's tier and did not change.
- **Time.** About 2 h 15 min for 210 careers, run as 11 slices of 6.5-8.7 minutes each with the 2-minute gaps, against a 75-minute budget.

### Before the refit (first measurement, rc.5 `goalRates`)

**BOARD_PROBE**, competent bot (`tuned` on Expected), every staging flag on, NA / EU / SAM, Normal and Hard, 6 seasons, seed 30000 (one of rc.5's two held-out seeds), 30 careers (3 per cell). N = career-seasons at the starting club, so 18 per cell; 3 careers per cell is a small sample. The "before" is `BOARD.md` (rc.5, seeds 30000 and 30101, N = 35-36).

| Cell | Normal: stated → measured, rc.6 (rc.5) | Hard: stated → measured, rc.6 (rc.5) |
|---|---|---|
| Elite | 52 → 50 (61) | 48 → 83 (43) |
| Contender | 53 → 50 (44) | 51 → 50 (69) |
| Mid | 54 → **28** (61) | 57 → 44 (61) |
| Underdog | 62 → **33** (92) | 61 → **22** (50) |
| Founded | 70 → 56 (61) | 66 → 67 (58) |

- **The drift is in the mid and underdog cells.** Their objectives are now picked from their tier's competitions: a mid's Expected plan is "qualify for all 3 Majors", an underdog's "top 8 at 3 regionals", an underdog's Ambitious plan "qualify for a Major". The stated chance comes from `goalRates`, which rc.5 fitted on that seed set with the old picks and the old rep gates. The records exist for these goals, but the clubs that play them now are not the ones the records saw: promoted orgs carry their starting cell in this table, and every underdog can now sign up to 86. Founded clubs are untouched by this patch and moved 61 → 56 and 58 → 67, which is seed noise at N = 18. **Not refitted, as instructed.**
- **Bands** (all three plans, N = 540 objectives): same band 50 %, adjacent 36 %, two or more away 14 % (rc.5: 65 / 34 / 1 %).
- **Cautious / Ambitious measured**, Normal: elite 83 / 33, contender 72 / 28, mid 33 / 6, underdog 56 / 11. Hard: elite 94 / 61, contender 61 / 33, mid 50 / 22, underdog 33 / 6. Cautious is easier than Ambitious in every cell.
- **Dismissals: 4 / 30** (rc.5 competent: 2 / 60, that is 1 / 30 per difficulty), all at S6 and all in SAM: SAM Normal contender and mid (neither was ever promoted), SAM Hard contender (promoted at S3) and underdog. 0 soft locks in 30 careers.
- **Cash at S6** (median of 3), Normal / Hard: elite $113k / $254k, contender $222k / $185k, mid $200k / $209k, underdog $147k / $57k, founded $26k / $34k. rc.5 ranges: elite 107-544k, contender 302-910k, mid 126-382k, underdog 54-220k, founded 34-39k. The elite's retained psychologist and analyst bill weekly; the open shelf lets every org buy earlier.
- **Tier changes per starting tier** (promotions, the season of the review that made them; relegations: none):
  - elite: 0 (Normal and Hard);
  - contender → elite: Normal 2 / 3 at S2, Hard 3 / 3 at S2-S4;
  - mid → contender: Normal 2 / 3 at S2 (both reach elite at S3), Hard 2 / 3 at S2 and S3; the third mid stayed mid all 6 seasons in both;
  - underdog → mid: Normal 3 / 3 at S2-S3 (one goes on to contender at S3), Hard 1 / 3 at S2 (then contender at S5).
- **How the lines were set.** First run with the spec's lines (20 / 32 / 45, hysteresis 3): every contender and every mid was promoted at its first allowed review (S2), and underdogs reached elite by S4 while missing every objective. A run with promotion switched off read the standing's climb: a mid club is at 29-68 after its first season and 40-100 after its second, an underdog at 20-36 then 24-66, and any Major title lifts a club close to 100. A second run with lines 35 / 50 / 85 and keep floors 18 / 28 / 40 put a good mid club in Contender at S2-S3, but 3 of its 4 dismissals came right after a promotion the season's objective had not earned. The last run adds `promoteNeedsObjective` (the numbers above).

**Soft-lock probes**, every staging flag on, each run alone: `P1_SOFT=1` SAM and NA, 7 seasons, autopilot and tuned: 4 careers, 656 lobbies, **0 findings**. `BOARD_SOFT=1`: **2 / 2 passed** (a dismissal taken with an offer, an approach accepted). Both probes play founded careers (P1) or the job moves (BOARD); established careers were played by the 30 BOARD_PROBE careers (0 soft locks) and by `careerOrgMode.test.ts`.

**The suite** (`--testTimeout=30000 --hookTimeout=60000`): 247 files passed, 40 skipped; **3229 tests passed, 0 failed**, 62 opt-in probes skipped. New tests: `src/engine/career/established.test.ts` (13), `src/store/careerOrgMode.test.ts` (12). `careerBoard.test.ts`, `careerBoard.flagOff.test.ts` and `persistContract.test.ts` are green and the persist contract is untouched.

## Decided on my own, and why

- **Standing: a promotion line and a keep floor per tier, not one line with a hysteresis** (spec deviation, R167). With the starting values fixed at 14 / 24 / 36 / 50, a line high enough to slow a mid club's climb (a mid club is at 40-100 after two seasons) would relegate a contender on 36 at its first review. Promote 35 / 50 / 85, keep 18 / 28 / 40.
- **A promotion needs the season's objective met** (`standing.promoteNeedsObjective`, spec addition). On standing alone, 3 of 4 dismissals followed a promotion the squad had not earned. Relegation reads standing alone, as the spec says. One switch turns it off.
- **Installations in any order** for an established org: the spec puts everything on the shelf from day one, and a build order is a lock. The effects are independent sums (training share, org-buff levels, the performance centre's rating), so nothing depends on the order. A founded club keeps the strict ladder.
- **The bootcamp** at an established org runs the structured tier (tier 2), the way a founded club runs it once tier 2 is unlocked (tier 1 is superseded). A choice of tier per run would be a new flow and a new screen, so it was left out.
- **`gateRepOf` = 100** rather than a flag per gate: one rule, every existing gate check unchanged in shape, and a founded club's number untouched.
- **The tier reads `board.stature`** when a board exists, else the standing line (a takeover with the board flag off has no stature on the save).
- **The brief exists only for established orgs**; a founded club's owners keep their season as before.
- **`seasonBudgetOf.free`** is the spec's formula. Before the package is chosen, the allocation is not yet in the balance, so `free` is far below zero on day one: the UI should read it after the choice or add the pending plan's grant.
- **`ledgerFromWeek`**: the ledger keeps its last 160 entries, which is less than a season of Monday lines, so "spent" and "income" are complete only from that week. Keeping a full season's ledger would grow every save.
- **The news line** for a tier change is public (`orgTierUp` / `orgTierDown`), its copy in the board group; `resolveNews` falls back to the board's copy for it.

- **The bots** read `gateRepOf` and `signCapOf` (`careerArcBot.ts`, `auditHumanBot.ts`) so they buy and sign what is now on the shelf. Nothing else in their policy changed: the arc bot still buys installations in list order and does not cut the inherited retainers.

## Not verified

- **No screen was opened in a browser.** The edits to Market, Finances, the toolbox sheet, the HQ error banner, the season review's verdict line and the news feed were typechecked and linted only.
- **A relegation never happened** in the 30 probe careers; it is covered by unit and flow tests only.
- **Two cells stay more than 15 points off after the refit:** contender Normal (stated 53, measured 72) and underdog Hard (62 → 27). The underdog Hard fit cell has 25 seasons.
- **The fit used 3 of rc.5's 6 fit seeds** (9000, 12000, 12101). Seeds 15000, 20000 and 20101 were not played.
- **Easy difficulty** was not measured.
- **`seasonBudgetOf.spent` and `income`** are complete only from `ledgerFromWeek`; no test plays a full season to compare them with the ledger's whole-season totals.
- **The tier's goal preference on seasons 3 and later** (the E4 test covers seasons 0 to 2 across every org of NA, EU and SAM).
- **Job offers** into another org use the new org's stature and inherited structure, as the code says; only `BOARD_SOFT`'s two careers played one.
