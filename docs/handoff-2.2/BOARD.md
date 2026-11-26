# v2.2 front BOARD: real-org start and the board

Branch `v22/board`. Flags `FEATURES.realOrgStart`, `FEATURES.board` (staging; probes `NEXT_PUBLIC_REAL_ORG_START=1`, `NEXT_PUBLIC_BOARD=1`). Flags off: a fixed-seed career is byte-identical to base cfcf1cd (`careerBoard.flagOff.test.ts`).

## Shipped

- **Wizard**: "found a club" (unchanged), or "take over an organization". The takeover is one screen: region, org, difficulty, go. Each card shows the trade-off as numbers.
- **Stature** (`engine/career/orgProfile.ts`): from the squad's rating rank in its region plus prestige. Money is counted in weeks of the squad's wage bill.
- **Seat swap** (`engine/career/seatSwap.ts`): the org leaves the world and a filler takes its seat, so the AI count is kept. `world.userOrgRef` blocks re-entry. A move leaves the old club behind as an AI side.
- **Board** (`engine/career/board.ts`, `store/boardFlow.ts`): three packages with Expected preselected and a one-tap accept. Each objective is a season goal picked by its chance. It replaces the goal card's target. A secondary objective, and a legacy one after a title. Confidence is logged with a reason at every change: checkpoints, the verdict, titles, debt, a partial recovery each season. The ladder goes warning, ultimatum (a mission over the splits left, about 60% likely), then dismissal at the review.
- **Manager** (`engine/career/manager.ts`): manager reputation and spells. A dismissal brings up to 3 offers, one always at home, plus "found a new club". A strong record can bring an unsolicited approach.
- **Screens** (`components/career/board/`): the Board page, HQ's package card, the season-screen offers.

## Decisions

- R-BOARD-1: dismissal only at a review, after a failed ultimatum. No mid-season swap.
- R-BOARD-2: no ultimatum in the first board season, or the first two for owners. So no dismissal in season 1.
- R-BOARD-3: the dataset's future arrivals for the user's org stay at their club or in free agency.
- R-BOARD-4: one goal card, which carries the board's objective.
- R-BOARD-5: older saves and founded clubs get an owners board at the next rollover, at confidence 100.
- R-BOARD-6: "found a new club" signs the 3 best home free agents.
- R-BOARD-7: a left real club follows its anchors again.
- R-BOARD-8: losses are × patience (stature × difficulty).
- R-BOARD-9: the offer waits for a three-player squad.
- R-BOARD-10: takeover deals run 2-3 seasons on market asks.

## Tunables

All in `CAREER_BOARD` (balance.ts), documented inline: the stature profiles (rep, runway, grant, wage room, patience, aim shift), the packages, checkpoints, confidence lines (start 75, warn 40, ultimatum 25), season recovery (25% / owners 50%), budget range 0.6-1.3, manager reputation and offers. No existing value was changed.

## Measured (BOARD_PROBE, 1 seed, 6 seasons, arc bots)

Figures come from consecutive configs. Competent = tuned on Expected; careless = badSponsor on Ambitious.

- Normal, competent, real orgs: dismissed 0/6 elite+underdog and 0/3 mid (final config). Earlier configs: 2/9 mid. Season 1: 100% hit (N=6, stated 60%).
- Normal, careless: dismissed 9/12 real orgs, in seasons 3-6 (target 3-4). 1 insolvency after a move.
- Hard, competent: 3/9 dismissed (pre-final config). Too harsh, and not re-measured.
- Soft locks: 0 across about 70 careers, including dismissed careers that took an offer and played on. `P1_SOFT` NA,SAM, 4 seasons, flags on: 0 findings.
- Stated chances are not calibrated by stature. Elite hits 72-78% vs 44-47% stated. Founded hits 11-22% vs about 70% stated, so founded owners almost never see an objective met. They are never dismissed (patience, recovery).
- Real-org cash stays positive (tens of k up to about $900k). A winning elite reaches $2-8M by S6. Founded cash is near the no-board baseline.

## Not done or not verified

The facility upgrade at high confidence. UI not seen in a browser; 320 px untested. `localOrigin` across a region move. Hard is not re-measured.

## For Miguel

1. The wage scale of elite takeovers (BDS about $57k/week).
2. Whether the season-goal curves should be refit (the founded miss rate predates this front).
3. `agePassAndIntake` drops `world.formerSquad` (a base bug). It is fixed only under `FEATURES.board`.
