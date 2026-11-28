# rc.9 TRAIN-MARKET (written at integration, 28/11)

The front was killed at the 27/11 restart and finished by commit `50338431`
without a handoff. This page is reconstructed from that commit and the code;
the agent's own measurements are lost. Decisions #248 to #254.

## What changed (files)

- Training: `screens/TrainingScreen.tsx`, `training/TrainingPackageParts.tsx`,
  `CoachEffects.tsx`, `training/CoachHireCard.tsx`. One decision on top (the
  running plan with its gain as the figure and "Adjust plan", or the picker,
  empty by default, then "Start training"); the squad's growth as rows; coach,
  scrims and report on the side; attribute help at the bottom.
- Market: `screens/MarketScreen.tsx` back to a grid of candidate cards (Miguel
  rejected the rows), deals as rows (`market/MarketRows.tsx` now holds only
  `DealRow` and `OfferFact`).
- Sheets: `PlayerSheet.tsx` (the back of the card: overall as the figure,
  potential as a band, attributes and contract as rows), `ListPlayerSheet.tsx`,
  `TradeSheet.tsx`, `SaleConsequences.tsx` (what a sale books, as rows),
  `RenewalReadout.tsx`, `MarketValueTag.tsx` (red = cost, green = gain).
- Money modals: `MoneyNoticeModal.tsx` and `career.moneyNotice` (each rule
  said once: the opening says how the loan works, the warning what the
  deadline costs).
- Copy `career.training`, `career.market`, `career.moneyNotice` (EN, PT).

## Integration fixes (28/11)

The notices said "credit limit" while the mail and Finances said "floor": all
say floor (piso). The deadline warning says how to repay early ("Pay it all"
in Finances). `careerLoan` now reads the warning's own notice.

## Not verified

Phone widths (375, 320) of every rebuilt screen; keyboard through the market
grid and the sheets; `SalaryNegotiator.test.ts` passes but was edited by the
front (`negotiation.asks` removed); no screenshots exist for this front.

## For Miguel

1. The market grid and the training lead block need your look on a phone.
2. The lock line on a locked candidate is faint now; say if it reads too weak.
