# rc.9 ORG-UI: the established org's screens (handoff)

Branch `rc9/ui`. DESIGN-DECISIONS #270 to #278 (#279 unused). Screens, view-model `.ts` and copy only.

## Found done (first agent, commits b8bd362e, 7b8014a6)

Board tab beside Club (desktop and More), standing word in the top bar, one-moment arrival, the mandate as one goal table with one button, sponsor comparison table and deal block, offers parked on close.

## Built in this pass

- Pick (`takeover/TakeoverPick.tsx`): per Miguel's second note, a grid of org cards with a region filter, the file in a modal (Escape closes, focus back on the card: checked). Logo keyed by org (stale logo bug).
- Finances (`finances/SeasonMoney.tsx` new, `screens/FinancesScreen.tsx`, `hub/FinanceBlock.tsx`, `finances/budgetLines.ts`): budget as the lead figure, cash beside it, one bar (still to pay, kept by the mandate, free) whose keys add up to "cash and income still to come"; three blocks led by figures. `SeasonBudget.tsx` deleted; the founded strip is founded-only. Ledger as rows, refName resolved.
- Operations (`finances/Operations.tsx`, `operationsView.ts`, `hub/OperationsBlock.tsx`): cards on `orgOperationsOf`, levels as steps; Club summary and HQ on the catalogue.
- Board (`board/BoardScreen.tsx`, `BoardParts.tsx`): confidence (wide, meter), mandate progress, the brief; standing as a word; org copy.
- `CareerTopBar.tsx`: one class (tab padding at 2xl).
- Copy EN and PT: see #278.

## Evidence

`.claude/rc9/shots/orgui/final-*` (pick grid and modal 1280/375/320, finances 1280/375/320, board 1280/320, door 1280) and `before2-*`. Sums checked on screen: Dynasty 280k + 35.4k = 315k = 258k + 16.7k + 40.2k; FURIA 1,508,900 + 230,100 - 1,387,560 = 351,440. No sideways scroll at 375 and 320 (scrollWidth = innerWidth) on pick, modal, finances, board. 1280 shots were taken with a `transform: scale(.625)` on body to fit the pane (sticky bars look misplaced in them; that is the transform).

Click-through: door "Choose an org"; region tabs; card opens modal (keyboard focus + Enter); Escape closes, focus returns; take over FURIA and Dynasty; arrival "Go to HQ"; mandate "Start the season"; Board tab; Finances "Balance history" button; Upgrade/Staff it buttons rendered (not pressed).

## Not verified

- The sponsor offers modal for a renewal or a founded club at 1280/375/320 (no save reached a decision; needs a sim to August).
- Upgrade / staff / close / camp actions pressed in a save; Club page summary on screen; HQ operations block on screen.
- 375 board, 375/320 modal of the founded wizard.
- Tests: `rc9Org`, `orgCopy` (after removing four overlays whose base keys other fronts deleted), `hqPolish`, `launchPolish` green. `careerSponsors` has 1 failure in the mail group (`sponsorDecision` wording, not ORG-UI). `tsc`: no error in ORG-UI files; another front's file had one (`SquadScreen.tsx`) at the time.
- Club page: the standing board and the operations summary render; at 1280 the operations card's head sat tight under the standing board (seen through the scaled screenshot only).
- The emergency-loan board's long rule paragraph (`finances.loanRule`) is unchanged.

## Rules that read wrong

None found in the engine. `seasonMoneyOf` before the mandate is read excludes the budget, so `freeToSpend` reads negative on day one; the screen counts the proposed budget in and hides "free" until it is paid.
