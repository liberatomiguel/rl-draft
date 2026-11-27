# ORGMODE 2027, stage 2: the board's mandate (front MANDATE, handoff)

Branch `v22/mandate`, cut from `release/v2.2` at the 2027 spec (`7e94926`). Spec: `ORGMODE-2027-SPEC.md`, "Stage 2". Decisions R177 to R179 (R173 to R176 are front ERA's). BALANCE_VERSION 53 → 54. Founded clubs are untouched: their three plans, secondary and legacy asks, mails and bots run as before (their tests pass unchanged).

## What changed, by file

- **Engine.** `src/engine/career/mandate.ts` (new, pure): `demandOf`, `orgIssuesOf`, `buildMandate`, `moneyProgressOf`, `squadProgressOf`, `markWageDeadline`, `countYouthEvent`, `settleMandate`, `orgHistoryOf`, `transferMoneyOf`, `billsOf`. `boardTypes.ts`: `BoardSeason.mandate?`, `BoardState.prestige?`, the types `DemandLevel`, `OrgIssue(Kind)`, `MoneyGoal`, `SquadGoal`, `ClassificationGoal`, `MandateTerms`, `BoardMandate`. `board.ts`: `PackageInput.demandShift?` (moves the established aims, clamped). `economy.ts`: `pushLedger` keeps `finances.transferTally` while it exists (`tallyTransfers`). `types.ts`: `FinanceState.transferTally?`.
- **Flow.** `store/boardFlow.ts`: `offerSeason` builds the mandate for an established org (one package, id "expected", carrying the mandate's terms; no secondary, no legacy), seeds the transfer tally, sends the mandate mail and, on the board's first season, the owner's welcome. `pendingMandateOf`, `mandateOf`, `acknowledgeMandateFlow` (any `chooseBoardPackageFlow` id reads the mandate), the decision id `board:mandate:<s>`, the week-21 wage deadline and the split report (`boardMandateReport`, every split, on all three), `boardOnEventResult` (hook in `careerFlow.ingestResult`), the review's settlement (step 1b) and its verdict mail (`boardMandateVerdict`). The org's prestige is read before the takeover and before a job move. `careerStore.acknowledgeMandate`. `takeoverPreview.ts`: `mandate`.
- **Bots.** `careerArcBot.ts`: `ArcPolicy.followsMandate` (on `tuned`, the probes' competent bot). It renews the named player, never sells or releases a named one, signs at the bar (`mandateMarket`), starts the prospect (`mandateLineup`), takes a bid for the reserve when the goal is sales, and checks every signing against the money goal (`mandateAllows` inside `affordable`). Every bot reads the mandate through `boardAutoAnswer`.
- **Screens.** `components/career/board/MandateParts.tsx` (new): `MandatePrompt` (the pop-up), `MandateSheet` (inline: HQ's decision block, the Board page while unread), `MandateGoals`, `MandateIssues`, `MandateHqRows`, `MandatePendingLine`, `MandateVerdict`, `MandateDossier`. Wired in `CareerShell` (the prompt comes first; the sponsor prompt, the money notice and the training report wait), `CareerAnnouncement` (blocked while unread), `BoardParts` (decision block, the classification object's label, the verdict with the count met), `BoardScreen` (the goals under the object, "What needs fixing" read live), `SeasonGoalBlock`, `TakeoverPick` (the dossier's board section; the founded/no-mandate branch kept), `newsText` (the mail params become the three goal sentences).
- **Copy** (EN and PT, keyed identically): `board.mandate.*`, `board.reasons.mandate*`, `board.glance.pendingMandate`, `board.money.notYetMandate`, `board.mail.tpl/body.board{Welcome,Mandate,MandateReport,MandateVerdict}`, `mail.from.owner`, `takeover.dossier.budgetNote` reworded.
- **Tests.** New: `engine/career/mandate.test.ts` (12), `store/careerMandate.test.ts` (4). Changed (takeover tests that asserted three plans): `careerBoard.test.ts`, `careerOrgMode.round2.test.ts`, `takeoverPreview.test.ts`. The probe (`careerBoard.probe.test.ts`) records each season's mandate and prints `MANDATE` and `MANDATE KINDS` lines.

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

MEASURED_PLACEHOLDER

## Decided on my own, and why

- **The classification goal is the season's one package.** Keeping `offers` with one entry (id "expected") lets checkpoints, the ultimatum, the review, the season goal card, `seasonBudgetOf` and the probe run unchanged. The alternative (a new path for the mandate) duplicated the settlement.
- **No secondary and no legacy ask in a mandate season.** Three goals is the brief; the legacy ask after a title would be a fourth.
- **The pop-up has no close.** It replaces a decision that held the clock (the plan choice); a dismissible pop-up would leave the season on a decision the player never sees. Its one action reads the mandate.
- **A signing goal pairs with the cash floor**, not the transfer cap: the first probe slice gave elite boards "sign a starter of 88+" with "net spend within $35k", and the bot met the signing 0 of 4 times.
- **"No reserve" and "no sponsor" are problems.** With the 2020 data every takeover is young, contracted for 2-3 seasons and at 80-84 % of its ceiling; without them most dossiers would show one problem or none. Both are true (an absent starter with no reserve sits a regional out; the desk opens on day one).
- **The stretch row stays on HQ.** The season goal's stretch (and its standing reward) predates this front and still shows under the classification row, so HQ lists four lines. Removing it changes the season goal model; Miguel's call.

## Not verified

- A 2027 start (front ERA): the problems read there (ages, contracts) were not seen.
- The bot does not cut wages: `wagesUnder` is met only if the bill falls on its own.
- The terms are not tuned by measurement; the ultimatum and dismissal still read confidence only.
- HQ's decision-block version of the unread mandate (the pop-up covers it), the review on a phone, the job-move mandate in the browser.
- The full suite with every staging flag on is not a valid run (it fails in unrelated weekend tests); the suite was run with the default flags.

## Screenshots

Seen in the browser (dev server on 3210, real takeover flow for day one; later states from fixtures written by a scratch test and injected into slot 3): in `C:/Users/Miguel/AppData/Local/Temp/claude/3d912f5954756c8a/e0fb6bf8-099f-4754-bb0d-361596a5b932/scratchpad/mandate/shots/`:
`01-dossier-1280-pt`, `02-popup-1280-pt`, `03-popup-1280-en`, `04-popup-375-en`, `05-popup-320-pt`, `06-hq-goalblock-1280-pt`, `07-board-day1-1280-pt`, `08-board-day1-goals-1280-pt`, `09-inbox-welcome-1280-pt`, `10-popup-season2-1280-pt`, `11-board-midseason-1280-pt`, `12-board-midseason-375-pt`, `13-popup-season2-375-en`, `14-review-verdict-1280-en`, `15-dossier-375-en`. No sideways scroll at 320 and 375 on the pages measured.
