# v2.2 front BOARD: real-org start and the board

Branch `v22/board`. Flags `FEATURES.realOrgStart`, `FEATURES.board` (staging only; probes `NEXT_PUBLIC_REAL_ORG_START=1`, `NEXT_PUBLIC_BOARD=1`). Flag off: a fixed-seed tuned career is byte-identical to the base cfcf1cd (`careerBoard.flagOff.test.ts`).

## What shipped

- **Two doors in the wizard**: found a club (unchanged) or take over a real org: one screen, region, org, difficulty, go. Each org shows stature, squad rank, cash, season budget, wage room, the finish the board expects, what a missed objective costs, the grace season.
- **Stature** (`engine/career/orgProfile.ts`): elite / contender / mid / underdog from the squad's rating rank in its region plus curated prestige. Money is in weeks of the squad's own wage bill.
- **Seat swap** (`engine/career/seatSwap.ts`): the org leaves `world.orgs`, a fresh filler takes its seat (the region keeps its AI count), `world.userOrgRef` stops `realOrgIntake` re-entering it. The squad is the org's roster on market asks, plus its dataset coach. The same operation runs a job move: the club left behind re-enters as an AI org with the user's starters, in place of its region's weakest filler.
- **Board** (`engine/career/board.ts`, `store/boardFlow.ts`): three packages each season (cautious / expected / ambitious). Each one's objective is a season goal picked by its fitted chance. Expected is preselected, one tap accepts, the offer is fixed once shown. The chosen objective becomes the season goal card's target, so there is one card and one settlement. A secondary objective comes from balance / wages / youth / home core. After a title there is a legacy objective (no penalty). Confidence 0-100, every change logged with a reason: split checkpoints (W11, W21), the verdict, titles (they add protection), deep debt. High confidence brings a budget rise and a contract extension. Low confidence brings a budget cut, a hiring freeze, a warning, then an ultimatum (a mission over the splits left, about 60% likely). A failed ultimatum dismisses at the review.
- **Manager** (`engine/career/manager.ts`): manager reputation, spells. After a dismissal: up to 3 org offers (always one at home) plus "found a new club". A strong career gets an unsolicited approach. Accepting moves at the rollover.
- Screens (`components/career/board/`): `/career/board`, the package card in HQ's decision block, the season-review offers panel, the takeover wizard. Real logo for a takeover via `OrgMark` and the top bar.

## Decisions (R-BOARD-n)

1. Dismissal happens only at a season review, after a failed ultimatum. Ultimatums are issued only at split checkpoints, so there is no mid-season seat swap.
2. No ultimatum in the board's first season (real org) or first two (owners). So there is never a dismissal in season 1.
3. Historical arrivals for the user's org stay where they are (their club or free agency). The anchor pass skips an org not in the world.
4. The board objective replaces the season goal's target (one card).
5. Founded clubs and older saves: an owners board at the next rollover, confidence 100, no retroactive judgement.
6. "Found a new club" signs the region's three best free agents and takes a name from the org bank.
7. A left real club follows its dataset anchors again (its history can pull players back).
8. Every loss is × patience (stature × difficulty). The package miss carries it already.

## Tunables (`CAREER_BOARD`)

MEASURE_PLACEHOLDER

## Not verified

UI not seen in a browser (no dev server per the rules); 320 px untested. `competition.localOrigin` carries across a cross-region move. Stated chance vs real hit rate is off by stature (below).

## For Miguel

Wage scale of elite takeovers (BDS about $57k/week at market asks), and whether the board should pay most of it. Whether the founded-club owners should judge at all, given the hit rate below. The `formerSquad` drop in `agePassAndIntake` is a base bug (a sold founder stops resolving after a rollover). It is fixed here only behind `FEATURES.board`, so the fix needs a decision for every build.
