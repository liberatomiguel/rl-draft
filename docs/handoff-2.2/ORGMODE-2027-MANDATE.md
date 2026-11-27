# ORGMODE 2027, stage 2: the board's mandate (front MANDATE, handoff)

Branch `v22/mandate`, cut from `release/v2.2` at the 2027 spec (`7e94926`). Spec: `ORGMODE-2027-SPEC.md`, "Stage 2". Decisions R177 to R179 (R173 to R176 are front ERA's). Merged with front ERA (`release/v2.2` at `dde0acf`): a takeover starts at era 6 (RLCS 2027) by default. BALANCE_VERSION 53 → 54. Founded clubs are untouched: their three plans, secondary and legacy asks, mails and bots run as before (their tests pass unchanged).

## What changed, by file

- **Engine.** `src/engine/career/mandate.ts` (new, pure): `demandOf`, `orgIssuesOf`, `buildMandate`, `moneyProgressOf`, `squadProgressOf`, `markWageDeadline`, `countYouthEvent`, `settleMandate`, `orgHistoryOf`, `transferMoneyOf`, `billsOf`. `boardTypes.ts`: `BoardSeason.mandate?`, `BoardState.prestige?`, the types `DemandLevel`, `OrgIssue(Kind)`, `MoneyGoal`, `SquadGoal`, `ClassificationGoal`, `MandateTerms`, `BoardMandate`. `board.ts`: `PackageInput.demandShift?` (moves the established aims, clamped). `economy.ts`: `pushLedger` keeps `finances.transferTally` while it exists (`tallyTransfers`). `types.ts`: `FinanceState.transferTally?`.
- **Flow.** `store/boardFlow.ts`: `offerSeason` builds the mandate for an established org (one package, id "expected", carrying the mandate's terms; no secondary, no legacy), seeds the transfer tally, sends the mandate mail and, on the board's first season, the owner's welcome. `pendingMandateOf`, `mandateOf`, `acknowledgeMandateFlow` (any `chooseBoardPackageFlow` id reads the mandate), the decision id `board:mandate:<s>`, the week-21 wage deadline and the split report (`boardMandateReport`, every split, on all three), `boardOnEventResult` (hook in `careerFlow.ingestResult`), the review's settlement (step 1b) and its verdict mail (`boardMandateVerdict`). The org's prestige is read before the takeover and before a job move. `careerStore.acknowledgeMandate`. `takeoverPreview.ts`: `mandate`.
- **Bots.** `careerArcBot.ts`: `ArcPolicy.followsMandate` (on `tuned`, the probes' competent bot). It renews the named player, never releases a named one and sells one only when the books are tight (survival first), signs at the bar (`mandateMarket`, only if the season's projected end keeps four weeks of payroll and the weekly net stays at or above zero), starts the prospect (`mandateLineup`), takes a bid for the reserve when the goal is sales, and checks every signing against the money goal (`mandateAllows` inside `affordable`). Every bot reads the mandate through `boardAutoAnswer`.
- **Screens.** `components/career/board/MandateParts.tsx` (new): `MandatePrompt` (the pop-up), `MandateSheet` (inline: HQ's decision block, the Board page while unread), `MandateGoals`, `MandateIssues`, `MandateHqRows`, `MandatePendingLine`, `MandateVerdict`, `MandateDossier`. Wired in `CareerShell` (the prompt comes first; the sponsor prompt, the money notice and the training report wait), `CareerAnnouncement` (blocked while unread), `BoardParts` (decision block, the classification object's label, the verdict with the count met), `BoardScreen` (the goals under the object, "What needs fixing" read live), `SeasonGoalBlock`, `TakeoverPick` (the dossier's board section; the founded/no-mandate branch kept), `newsText` (the mail params become the three goal sentences).
- **Copy** (EN and PT, keyed identically): `board.mandate.*`, `board.reasons.mandate*`, `board.glance.pendingMandate`, `board.money.notYetMandate`, `board.mail.tpl/body.board{Welcome,Mandate,MandateReport,MandateVerdict}`, `mail.from.owner`, `takeover.dossier.budgetNote` reworded.
- **After the merge with ERA (2027).** The board's displays read the career season (`careerSeasonOf`): the confidence log ("S1 · W3"), the contract ("Season 3"), the manager's spells, title protection, the high-confidence mail, the mandate and plan mails ("season 1"); the pop-up and headers show the year (`seasonLabelFor`, "RLCS 2027"). Money: every mandate figure is weeks of the org's own running bill (in the era's money), the indexed wage ceiling (`wageCeilingOf`) or a player's market value; nothing is a fixed dollar number. The signing bar is capped per tier (`squad.barMax`: an elite 2027 roster's weakest starter is 91-93, so weakest + 2 asked for a 95); "no sponsor" is not read in the board's first week (the desk opens with the mandate). The probe takes `BOARD_ERA`.
- **Tests.** New: `engine/career/mandate.test.ts` (12), `store/careerMandate.test.ts` (5, one a 2027 takeover). Changed (takeover tests that asserted three plans): `careerBoard.test.ts`, `careerOrgMode.round2.test.ts`, `takeoverPreview.test.ts`. The probe (`careerBoard.probe.test.ts`) records each season's mandate and prints `MANDATE` and `MANDATE KINDS` lines.

## The goals

**Demand level** = tier score (underdog 0, mid 1, contender 2, elite 3) + prestige score (prestige 0: −0.5, 1: 0, 2: +0.5, 3: +1). High from 2.5, medium from 1. It moves the classification aim (low +0.05, medium 0, high −0.05) and multiplies every confidence term (low 0.85, medium 1, high 1.2).

**Classification**: the tier's Expected objective (`objectiveKinds`, the measured chance) with the demand's aim. It is the season goal's target, so it is settled where it always was.

**Money**, from the first money problem, else the default:

| Kind | Picked when | Figure | Met at the review |
|---|---|---|---|
| `wagesUnder` | wage bill ≥ 92 % of the ceiling | the ceiling, by week 21 | bill ≤ it at week 21 and at the review |
| `cashFloor` | cash < 4 weeks of the running bill; default for mid and underdog, and for any org asked to sign a starter | 2 / 3 / 4 weeks of the running bill (low / medium / high) | balance before the review's bonuses ≥ it |
| `sales` | a reserve paid ≥ 60 % of a starter | 50 % of his market value (at least a week of the bill) | fees received this season ≥ it |
| `netSpend` | default for elite and contender | 3 / 4 / 5 weeks of the running bill | fees and signing bonuses paid − fees received ≤ it |

**Squad**, from the first squad problem, else the default:

| Kind | Picked when | Figure | Met at the review |
|---|---|---|---|
| `renew` | a starter's deal ends this season | the player | still at the club with a deal past this season |
| `signStarter` | a weak link (4+ under the other two); default at high demand | max(tier bar 76 / 80 / 84 / 88, weakest + 2), never over the tier's pull | a starter not in the squad of day one rated at or over the bar |
| `ageUnder` | starters average 26+ or two at 27+ | floor(average) − 1 | starters' average ≤ it |
| `youthEvents` | a prospect of 20 or younger outside the three | 6 official events in the starting three | counted per event |
| `keepCore` | chemistry under 60 %; default at low and medium demand | the two best starters | both still at the club |

**Terms** (`CAREER_BOARD.mandate.terms`; a loss × patience × stakes, a gain × stakes): classification +12 / −18 confidence, ±5 % budget, 4 weeks' bonus; money +5 / −6, ±5 %; squad +5 / −6, 1.5 weeks' bonus. The budget steps add to `budgetMult` at the review (clamped 0.6 to 1.3), on top of the confidence step that already existed.

## Measured

Every probe with every staging flag on, each run alone under the lock. `BOARD_PROBE`, competent bot (`tuned`), NA / EU / SAM, Normal and Hard, the region's first org of each tier, seed 30000, one career per cell (24 careers). N = settled mandate seasons per tier and difficulty: small cells, read as a sanity check, not as a calibration.

**2027 takeover (era 6, the default; after the merge with ERA, final rules), 3 seasons, 24 careers:** 24 / 24 finished, 0 soft locks, 0 dismissals, 0 insolvencies.

| Difficulty, tier | N | classification | money | squad | all three | demand |
|---|---|---|---|---|---|---|
| Normal, elite | 11 | 64 % | 91 % | 82 % | 36 % | high 11 |
| Normal, contender | 8 | 63 % | 100 % | 75 % | 38 % | medium 6, high 2 |
| Normal, mid | 10 | 30 % | 80 % | 60 % | 20 % | low 1, medium 9 |
| Normal, underdog | 7 | 71 % | 71 % | 14 % | 14 % | low 7 |
| Hard, elite | 10 | 90 % | 90 % | 80 % | 70 % | high 10 |
| Hard, contender | 8 | 38 % | 88 % | 88 % | 13 % | medium 6, high 2 |
| Hard, mid | 11 | 82 % | 73 % | 55 % | 27 % | low 2, medium 9 |
| Hard, underdog | 7 | 100 % | 71 % | 57 % | 43 % | low 7 |

By kind, both difficulties, met / set: money `cashFloor` 48 / 53, `netSpend` 10 / 10, `wagesUnder` 2 / 9; squad `signStarter` 28 / 38, `keepCore` 12 / 25 (the bot now sells a named player when the books are tight), `renew` 6 / 8, `ageUnder` 1 / 1. Raw lines: `scratchpad/mandate/f6_summary.txt`.

**2020 takeover (era 0), 4 seasons, 24 careers** (run before the merge, before the last two bot fixes: the projected-end check and selling a named player when the books are tight): 24 / 24 finished, 0 soft locks, 0 dismissals, 0 insolvencies. Classification 25-100 % by cell, money 50-91 %, squad 75-100 %. By kind: `cashFloor` 41 / 51, `netSpend` 21 / 21, `wagesUnder` 6 / 24, `signStarter` 34 / 47, `renew` 31 / 31, `keepCore` 18 / 18. `scratchpad/mandate/p3_summary.txt`.

**Careless bot (`badSponsor`), era 0, NA and SAM, Normal, 3 seasons, 8 careers:** 8 / 8 finished, 0 soft locks (it reads the mandate through `boardAutoAnswer` and works none of it): classification 0-40 %, squad 33-67 %, money 67-100 %.

**What the probe found and changed:**
- First slice (era 0): elite boards asked "sign a starter of 88+" with "keep net transfer spend within $35k"; the signing was met 0 of 4 times. A signing goal now pairs with the cash floor.
- One insolvency at era 0 (SAM Hard mid) and two at era 6 (NA Hard mid and underdog). The rc.6 baseline on the same careers stayed solvent. A trace of the era-6 mid: the baseline sold its two best players to bids when the books were tight (US$ 319k and 103k); the mandate's "keep the core" named those two and the bot refused every bid, ran out of cash, took the emergency loan and went under at the repayment. The bot now sells a named player when the books are tight (the goal is then missed); its mandate signing also reads the season's projected end. After both fixes: 0 insolvencies in the 24 era-6 careers. A human manager meets the same trade-off.
- The bot never cuts wages, so `wagesUnder` is met only when the bill falls by itself (renewals, departures): 2 / 9 at era 6.

**Soft-lock checks:** `BOARD_SOFT=1` 2 / 2 at era 0 and 2 / 2 with `BOARD_SOFT_ERA=6`. `P1_SOFT` was not run: it plays founded careers, whose path this front does not change (the founded tests pass unchanged).

**Suite** (default flags, after the merge): 257 files, 3297 tests passed, 0 failed, 62 skipped. Targeted: `mandate.test.ts` 12, `careerMandate.test.ts` 5 (one at era 6), the board, org-mode, preview and era tests green.

**The problems a 2027 takeover reads** (every NA, EU, SAM and MENA org, seed 4242, 76 orgs): no reserve 75, little wage room 70, no coach 49, a weak link 12. Deal and age problems do not appear on day one (fresh contracts, young rosters); they appear from the second season (the season-2 fixture reads wages over the ceiling, a weak link, chemistry).

## Decided on my own, and why

- **The classification goal is the season's one package.** Keeping `offers` with one entry (id "expected") lets checkpoints, the ultimatum, the review, the season goal card, `seasonBudgetOf` and the probe run unchanged. The alternative (a new path for the mandate) duplicated the settlement.
- **No secondary and no legacy ask in a mandate season.** Three goals is the brief; the legacy ask after a title would be a fourth.
- **The pop-up has no close.** It replaces a decision that held the clock (the plan choice); a dismissible pop-up would leave the season on a decision the player never sees. Its one action reads the mandate.
- **A signing goal pairs with the cash floor**, not the transfer cap: the first probe slice gave elite boards "sign a starter of 88+" with "net spend within $35k", and the bot met the signing 0 of 4 times.
- **"No reserve" is a problem.** Every takeover, 2020 or 2027, arrives with three players: an absent starter with no reserve sits a regional out. Without it most dossiers would show one problem or none on day one. "No sponsor" is read only after the board's first week.
- **Survival over keeping the core (bot).** A board that names players to keep does not stop the competent bot selling one when the cash is running out; the goal is then missed. Without it two 2027 careers went insolvent (see Measured).
- **The stretch row stays on HQ.** The season goal's stretch (and its standing reward) predates this front and still shows under the classification row, so HQ lists four lines. Removing it changes the season goal model; Miguel's call.

## Not verified

- On day one of a 2027 takeover the problems are few and alike (no reserve, wage room, no coach, a weak link); deal and age problems arrive from the second season. Whether that is enough variety is Miguel's read.
- The era-0 probe numbers predate the last two bot fixes; the era-6 run is on the final code.
- The bot does not cut wages: `wagesUnder` is met only if the bill falls on its own.
- The terms are not tuned by measurement; the ultimatum and dismissal still read confidence only.
- HQ's decision-block version of the unread mandate (the pop-up covers it), the review on a phone, the job-move mandate in the browser.
- The full suite with every staging flag on is not a valid run (it fails in unrelated weekend tests); the suite was run with the default flags.

## Screenshots

Shots 20 to 26 are a 2027 takeover on the final code (FURIA, SAM, real flow: dossier, pop-up at 1280 and 375; Ninjas in Pyjamas from fixtures: the review with the board page, the manager panel reading "Season 3" and "season 1 to now", the season-2 pop-up of 2028 at 1280 and 320). Shots 01 to 15 are the 2020 pass before the merge; 01, 06, 08 and 11 predate later copy and status-word fixes.

Seen in the browser (dev server on 3210, real takeover flow for day one; later states from fixtures written by a scratch test and injected into slot 3): in `C:/Users/Miguel/AppData/Local/Temp/claude/3d912f5954756c8a/e0fb6bf8-099f-4754-bb0d-361596a5b932/scratchpad/mandate/shots/`:
`01-dossier-1280-pt`, `02-popup-1280-pt`, `03-popup-1280-en`, `04-popup-375-en`, `05-popup-320-pt`, `06-hq-goalblock-1280-pt`, `07-board-day1-1280-pt`, `08-board-day1-goals-1280-pt`, `09-inbox-welcome-1280-pt`, `10-popup-season2-1280-pt`, `11-board-midseason-1280-pt`, `12-board-midseason-375-pt`, `13-popup-season2-375-en`, `14-review-verdict-1280-en`, `15-dossier-375-en`, `20-2027-dossier-1280-pt`, `21-2027-popup-1280-pt`, `22-2027-popup-375-pt`, `23-2027-review-board-1280-pt`, `24-2027-board-manager-1280-pt`, `25-2028-popup-season2-1280-pt`, `26-2028-popup-320-pt`. No sideways scroll at 320 and 375 on the pages measured.
