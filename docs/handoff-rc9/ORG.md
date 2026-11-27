# rc.9 ORG: the existing-org mode's own rules (handoff)

Branch `rc9/org`. Decisions R220-R225 (R226-R229 unused). Engine, store and view-model `.ts` only.

## What changed

- **Catalogue (R220).** New `engine/career/orgCatalogue.ts` (`orgOperationsOf`, `tierStandardOf`, `facilityLevelOf`, `FOUNDED_ITEM_IDS`, `orgItemOfFounded`). New `store/orgFlow.ts` (`upgradeFacilityFlow`, `setDepartmentFlow`, `runEventCampFlow`, `facilityUpgradeRefusalOf`). Mapping, same modifiers and prices: training centre L1/L2/L3 = peripherals/monitors/pcs; performance centre = perfCenter; development = assistant; analysis = analyst; psychology = psychologist; health = physio; commercial = brand; event bootcamp = bootcamp tier 2. `ladderOf` and `toolboxUnlockedIds` return `[]` for an established save; `announceUnlockCrossings` sends nothing for it; the `facility` ledger line and `boardUpgradeOptionsOf` (`org`) carry catalogue ids; `orgmode.words` renames every founded name old screens look up; `operationsView.opsNameOf/opsEffectOf` give catalogue names.
- **Sponsor in force (R221).** `signInheritedSponsor` at the takeover (`boardOnCreate`), `inheritedDealOf` / `renewInheritedBrand` in `sponsorDeals.ts`, `CAREER_ORG.inheritedSponsor`, `SponsorTerms.inherited/renewal`, mail `sponsorInherited`.
- **Standing (R222).** `standingSenseOf`, `reputationFigureOf` (established.ts); goal/insert lines without figures; owner letter `ownerTierUp/Down` replaces `boardTierUp/Down`.
- **Money (R223).** `seasonMoneyOf` (budget.ts), `BoardSeason.openingCash`; view-model `moneyGapSentenceOf`, `keepBackLineOf`, `commitmentRowsOf` (budgetLines.ts).
- **Repair (R225).** `repairEstablishedOnLoad` in `migrateSaveToV5`.
- `takeoverPreview`: `org`, `sponsor`, `sense`, `money`. `RealOrgChoice.structure`.

## For wave 2

- **Selectors:** `orgOperationsOf`, `facilityRowOf`, `nextUpgradeOf`, `staffedNamesOf`, `departmentEffectOf`, `standingSenseOf`, `reputationFigureOf`, `seasonMoneyOf` + the three budgetLines helpers, preview `org/sponsor/sense/money`, choice `structure`. Store actions to add in `careerStore`: the three orgFlow flows.
- **Copy keys:** `orgmode.org.*`, `orgmode.sense.*`, `orgmode.money.*`, `board.mail.tpl/body.{ownerTierUp,ownerTierDown,sponsorInherited}`, `orgmode.ops.*` reworded, `orgmode.words` overlay.
- **Redundant:** `finances/SeasonBudget.tsx` (replace with one `seasonMoneyOf` block), the founded three-figure balance strip in `FinancesScreen` for established saves, `hub/FinanceBlock.tsx` for established, `finances/SeasonOutlook.tsx`, `operationsOf`-based `Operations.tsx` / `hub/OperationsBlock.tsx` (rebuild on `orgOperationsOf`), `ToolboxBlock` (founded only).
- **Board page link:** its own tab in the career tab bar for an established org, plus the HQ board row and the Club page linking to it.
- **Rules that read wrong in screens:** `CareerTopBar` prints `save.reputation` (use `reputationFigureOf`); the pick screen shows `standing.value`, `rep`, `sponsorLevel` and founded `gear`/`staff` (use `structure`, `sense`); `BoardScreen` uses `useCareerCopy()` so `BoardUpgradePanel` names founded items (use `useOrgCareerCopy` or `org`); the ledger prints `refName` raw (resolve catalogue ids via `orgmode.org.name`); sponsor screen must show the inherited deal (`terms.inherited`) on day one, not an empty desk.

## Measured

- `tsc` clean. `rc9Org.test.ts` 13/13 (catalogue per tier, upgrade = founded purchase, founded-name walk over catalogues / toolbox / unlock notice / board upgrade / news / mail / ledger in EN and PT for all four tiers, inherited deal in NA/EU/SAM x 4 tiers, renewal, standing sense and owner letter, money identities pending / read / day 20 for 4 tiers, rc.8 save repair + one season by the bot).
- Slices (default flags): engine/career + components/career 863 passed; store + content + config 1575 passed, 1 fail `balanceVersion.test.ts` (expected: new `CAREER_ORG` export, integration bumps), `careerAnalytics.test.ts` hook timeout under load, passes alone (26/26). Flag-off tests (`careerBoard.flagOff`, `fanFeedFlow.flagOff`) and `persistContract` pass unrefreshed.
- Soft-lock probe, every staging flag, `P1_SOFT_ERA=6`, NA/EU/SAM, autopilot + tuned, 4 seasons: 6/6 careers, 0 findings.
- Updated tests that asserted the old rules: `careerMandate` (desk after the mandate), `careerOrgMode.round2` R168/R169 (sponsor desk, income before sponsor), `careerOrgMode` (owner letter), `orgCopy` (goal line wording).

## Not verified

- No screen seen (no `.tsx` touched). Current screens still read `operationsOf` rows (four facility rows named by level) until wave 2 rebuilds them.
- Money effect of the inherited deal is equal to a day-one desk signing only when the player picked the same profile; not measured on the board probe (`BOARD_PROBE`).
- A job move into another org arrives without a deal (desk opens after the mandate).
- Scouting department not built (no engine effect to map).

## For Miguel

- Profile per tier of the inherited deal (Steady small orgs, Balanced big ones) and that its fixed part is paid on day one.
- Whether the signing cap (a player rating) may stay as the one figure the standing shows.
