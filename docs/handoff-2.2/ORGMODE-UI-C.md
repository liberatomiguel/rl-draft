# ORGMODE UI-C: money and operations (handoff)

Front UI-C of v2.2 rc.6, branch `v22/org-ui-c` (from `release/v2.2` at 05f0d5d). Spec: `ORGMODE-SPEC.md` "U. Screens", UI-C, plus the reputation wording sweep and the phone checks UI-B left open. No engine, flow, store-logic or balance file touched. Design decisions #196 to #201. A founded club (`establishedOf` false) renders exactly as before: every new piece is behind `establishedOf(save)` and the copy layer returns the copy object itself for a founded save.

## Finances, established org (`screens/FinancesScreen.tsx`, `finances/SeasonBudget.tsx`)

Order: title, error notice, **the season budget** (new, the focal object), the existing three-figure strip (balance, a Monday, projection), then Operations in place of the gear ladder beside sponsors, loans and the ledger (unchanged).

The season budget board (`panel-strong`):
- Head: "Season budget" and "RLCS Season X · 21 Mondays to go".
- Left: the board's allocation as the screen's largest figure (`seasonBudgetOf.allocation`), the bonus at stake under it; then **the season's money as one bar** split into spent (quiet ink), committed (blue) and free (green), with the three figures as a key under it (rows on a phone). The bar is sized to spent + committed + free, which is the cash carried in, the board's money and the income (#197); when commitments pass the money the free part becomes "Short" in red and one sentence says by how much.
- Right: the season's end (`projectedEnd`, "at this pace, before prizes and player sales"), "if the objective is met" (`projectedEndIfMet`); the wage bill against the board's ceiling as a meter (orange and a tick at the ceiling when over, "$1.8k a week over the ceiling"; otherwise the room left).
- Under a rule: **By department** (squad wages, coach, staff, facilities and upkeep, bootcamps, transfers, then loan repayments and other only when they hold money; spent and to come, with totals) and **Income** (sponsors, prize money, fanbase, player sales; received and contracted). When the ledger tail does not reach week 1 (`ledgerFromWeek`), a line says from which week the figures count.
- **Plan pending** (#198): the allocation figure shows the board's proposal (Expected plan's grant) in the faint ink with "The board's proposal, paid when you choose the plan"; a bordered note "Pending the season plan" with a link to `/career/board`; the season's end adds the proposal. No red day-one number.

`finances/budgetLines.ts` (pure, new): `deptRowsOf` splits the coach's pay out of `spent.wages` and loan instalments out of `spent.other` from the same season's ledger (`seasonBudgetOf` books them together); `budgetBarOf` builds the bar. No money rule.

Operations (`finances/Operations.tsx`, `OperationsBoard`, id `career-operations`): head "Operations", one sentence, the weekly running cost as its figure (upkeep of what is owned + retainers). Three departments, each a heading with a one-line note and a list of rows (the founded ladder's row anatomy: icon, name + state tag, effect, notes; price over the action on the right):
- Facilities: Owned / Needs sign-off ("The board signs it at confidence 50. It stands at 42.") / Frozen / Short of money; upkeep; "The board signs it" on an available capital project; Buy (the one filled button of the screen on the first installation the org lacks, unless a sponsor decision is pending, as the ladder did).
- Staff (psychologist + the four roles): Retained with "Releasing saves $4.5k a split" and Release, which opens a confirm modal stating the saving per split and per week (#200); Hire otherwise.
- Bootcamps: only the tier the org runs (#199), free runs from a sponsor perk, used / running until, the store's refusal as a note.
Actions are the store's `buyGear`, `setStaff`, `setPsychologist`, `runBootcamp`; disabled states read `gearRefusalOf` / `bootcampRefusalOf`, so the button never offers what the flow refuses. Sponsor desk with no deal: "No sponsor deal yet. New offers reach this desk when the next split opens." (the founded "Unlocks at 10 Reputation" bar is gone for an established org; its gate is 10 and every tier starts at 14 or more).

## Club, established org (`screens/ClubScreen.tsx`)

The right column (the founded reputation bar with gate ticks + Progression Track) becomes UI-B's `StandingTrack` (four tier cells, marker, next tier's line, relegation line) with one new optional `note` prop: "A promotion raises the budget base and the wage ceiling by 20%, raises what the board expects, and lets the org sign players up to 95." (from `CAREER_BOARD.standing.budgetStep` and the next tier's `signCap`; at Elite the line says what a drop costs). Under it `OperationsSummary`: three link rows (facilities "1 / 4" with what is owned, staff count with names, the camp's state), running costs and "Open in Finances". No "next unlock", no rungs.

## HQ (`hub/OperationsBlock.tsx`, `hub/HubGlance.tsx`)

Desktop rail: `OperationsBlock` replaces `ToolboxBlock` (and its ladder modal) for an established org: "Operations · $140 / week"; what is running per department; the next purchase (first installation the org lacks) with its price and the board's answer ("The board signs it" in green, the confidence it needs in orange, frozen, or not enough money) and a Buy button when it can be bought; "Open operations". Phone: HubGlance's progression row reads "Operations · $X / week" and "Next purchase: 240Hz monitors · The board signs it", linking to `#career-operations`.

## The wording sweep

Mechanism: `components/career/orgCopy.ts`. The replacement strings live in `copy.career.{en,pt}.ts` under `orgmode.words`, at the same paths as the strings they replace; `orgCopyFor(C, established)` merges them (cached), `useActiveCareerCopy()` reads the active save, `useOrgCareerCopy(save)` takes one. `orgCopy.test.ts` checks every path exists with the same type and that no replacement says reputation, EN and PT.

| Founded string | Where it showed | Established org reads |
|---|---|---|
| `common.rep` "Rep" / `common.reputation` | top bar chip, Finances, Season review figures, Market | "Standing" ("Prestígio"); the top bar adds the tier ("41 MID-TABLE") |
| `goals.reward` "+1 reputation at review" (UI-B's report) | HQ season-goal rows | "+1 standing at review" |
| `goals.missCost`, `noCost`, `repRisk` | season-goal rows | "Miss it: −n standing", "No standing at stake", "The org's standing expects it" |
| `inserts.fx.rep`, `repLabel` | mid-week decisions | "+n standing", "Standing" |
| `event.digestRep` | event digest | "Standing" |
| `hub.edgesEmpty` (unlock with reputation) | (no current caller) | rewritten anyway |
| `market.filterSignable` "Signable at my reputation", `lockedHint` | Market | "Signable at this org's pull", standing hint |
| `market.lockedAtRep` on the player sheet | Market sheet | `board.signCapLock(cap)` (the list already did; the sheet did not) |
| `market.errors.bankLimit`, `repGate` | Finances / Market errors | standing / the org's pull |
| `finances.bankHint`, `bankHintEnd`, `bankLockedRep` | Bank loan | "Credit sized by the org's standing" |
| `finances.deal.boldLocked` | sponsor offers | "Bold deals come with a higher standing." |
| `finances.lockedAtRep` + reputation bar (no sponsor) | sponsor desk | the sentence above |
| Gear ladder head "Reputation" + rungs, `lockedAtRep` | Finances | Operations (no ladder) |
| `ladder.rep`, `next`, `progress`, `top`, ladder modal | HQ toolbox, phone row | Operations block / row |
| `club.reputation`, `repNext`, `unlockAt`, Progression Track | Club | Standing track + Operations |
| `news.feed.subject.rep` | news filter | "Standing" |
| `news.body.unlock`, `mail.body.unlock` | unlock news / mail (only sponsor levels announce for an established org) | "The org's standing brings a new sponsor level" |
| `news.body.repDown` | standing loss | rewritten without "reputation is earned back" |
| `tour.hub.progress`, `tour.finances.progress` | the guide | Operations wording |
| Saves screen "Rep" row | slot card | "Standing" |

Left as they are (and why): `board.reputationLabel` / `managerRep` (the manager's own reputation, which the spec keeps); `takeover` door fact "You chase: Reputation" (the founded door's card); `mail.body` backer restructure and `news.body` backer breach ("Reputation −n", long templates, a breach at an established org is rare); `moneyNotice.creditOffer` ("the most the bank lends at your reputation", a long row builder); the career achievements in the core copy ("Reach 50 reputation", `useCopy().ACH_UI`, outside the career copy; they track the engine's number and are shared with founded clubs).

## Copy keys

Added (EN and PT, keyed identically): `orgmode.standing`, `orgmode.budget.*` (title, when, allocation, allocationProposed, bonus, barLabel, barNote, spent, committed, free, short, shortBy, pendingTitle, pendingBody, pendingLink, projected, projectedBasis, projectedIfMet, projectedPending, wagesTitle, wagesUnit, ceiling, room, over, noCeiling, linesTitle, colSpent, colCommitted, line.*, total, incomeTitle, colReceived, colContracted, income.*, incomeNote, ledgerFrom, sponsorNone), `orgmode.ops.*`, `orgmode.club.*`, `orgmode.words.*` (table above). Removed: none. Founded strings unchanged.

## Components added

`finances/SeasonBudget.tsx`, `finances/Operations.tsx` (`OperationsBoard`, `OperationsSummary`), `finances/operationsView.ts`, `finances/budgetLines.ts`, `hub/OperationsBlock.tsx` (`OperationsBlock`, `nextPurchaseLineOf`), `orgCopy.ts` (+ test). Changed: `board/BoardParts.tsx` (`StandingTrack` takes `note`, `className`).

## What I saw in the browser (dev server on 3210, every staging flag; saves injected from `public/qa-fixtures/` by fetch + `localStorage.setItem('rocket-draft:career:v1', ...)`)

Fixtures: UI-B's `b-*.json`, plus `c-elite.json`, `c-contender.json`, `c-underdog.json` (fresh takeovers, EU elite Team BDS, SAM contender FURIA, NA underdog), made by a scratch test that is not committed (`createCareerSave` with the board and real-org flags mocked on). States set by hand on top: confidence 40 (refusal), a freeze.

| State | 1280 | 375 x 812 | 320 x 640 | Language |
|---|---|---|---|---|
| Finances, plan pending, elite (staff + 3 installations inherited) | yes (budget board before the pending-figure change; Operations) | no | no | PT |
| Finances, plan chosen mid-season, over the wage ceiling and short of money (b-mid, mid-table) | yes | yes (no sideways scroll) | no | EN |
| Finances, board refuses installations (contender, confidence 40: "Needs sign-off" on PCs and the performance centre) | yes | no | no | PT |
| Finances, underdog with nothing inherited, plan pending (proposal figure in faint ink, pending note) | no | no | yes (no sideways scroll) | PT |
| Finances, hiring freeze | **not seen**: the fixtures sit outside a transfer window (`freezeOnNow` needs the window's index), so the frozen row never rendered | | | |
| Release a retained staff member (modal, then the row reads Hire) and Buy an installation from Operations (owned afterwards), through a real takeover (Dracon Esports) | no | yes | no | EN |
| Club, established (Standing track with the promotion line, Operations summary) | yes (mid-table) | yes (underdog) | no | EN, PT |
| HQ, established: Operations block (desktop) / phone row | yes | yes | no | EN, PT |
| Top bar "STANDING 41 MID-TABLE" / "PRESTÍGIO 50 ELITE" | yes | (hidden on a phone) | | EN, PT |
| Season review figure "Standing 87" | no | yes | no | EN |
| Founded club (b-owners): Finances keeps the ladder, top bar "REP 5", no budget board | yes | no | no | EN |

UI-B's phone checks:

| Screen | 375 x 812 | 320 x 640 | Result |
|---|---|---|---|
| Season review, verdict with tier change (b-tier) | yes | no | fine |
| Dismissal with offers (b-dismissed) | yes | no | fine; long names now wrap to two lines |
| Approach (b-approach) | yes | no | **fixed**: "TEAM V..." truncated beside the rating and the button; the org name now takes two lines on a phone (`OfferRow`) |
| Ultimatum on the Board page (b-ultimatum) | yes | no | fine |
| Arrival splash (real takeover flow) | yes | no | fine, action docked |
| The door | (UI-B checked) | yes | **fixed**: the takeover window's sixth logo wrapped to a second row and the window clipped both; one row now, five logos under 360 px |

Not seen: the freeze; Finances at 1280 after the pending-figure change (seen at 320 only); the budget with `ledgerFromWeek > 1`; a sponsor-paid camp; the Elite promotion line ("At the top tier..."); the HQ block with a camp running; PT on the season review; anything with `FEATURES.board` off in the browser (with no board `seasonBudgetOf` is null and Finances shows Operations without the budget). Pre-existing, outside this front: at 320 px the site's bottom nav labels "Challenges" and "Collection" touch; the season review's sections render dimmed for a few seconds while they rise in.


## Tests

Full suite (`--testTimeout=30000 --hookTimeout=60000`, holding the lock): 250 files passed, 40 skipped; 3240 tests passed, 62 skipped, 0 failed. New: `src/components/career/orgCopy.test.ts` (6). Typecheck clean; lint 0 errors (warnings pre-existing). `traits.test.ts.snap` rewritten by the run (line endings) and restored.

## For the engine / the integrator

- **An elite org's day-one projection is deeply negative.** Team BDS (EU elite, seed 5150): balance $586k, the proposed budget $996k, wages $58.6k a week, 31 Mondays: `committed.wages` $1.8M, `projectedEnd` + proposal = −$257k. No sponsor and no contracted fanbase income (`incomeToCome.fanbase` 0, "Fanbase" received 0 at b-mid too). Prizes are not counted by design, so the screen says "before prizes and player sales", but the fanbase line at 0 for every org looks wrong against the weekly statement; worth a check in `weeklyStatement`'s fanbase for an established org.
- The established org's bootcamp: `operationsOf` lists both tiers; the screens show only the tier the org runs (#199). If both should be choosable, the engine needs a tier argument on `runBootcamp`.
- `operationsOf` camps do not count a sponsor-paid run (`cantAfford` while a free run is left); the screen reads `sponsorFreeBootcampsOf` and `bootcampRefusalOf` instead.
- Not changed (engine-side wording): the backer restructure mail and news ("Reputation −n"), `moneyNotice.creditOffer` ("at your reputation"), the core achievements "Reach 50 / 100 reputation".
- `seasonBudgetOf` is consistent with the ledger on the saves I opened: at b-mid spent $289k + committed $292k − short $158k = $423k of the season's money, and the department lines sum to the totals.

