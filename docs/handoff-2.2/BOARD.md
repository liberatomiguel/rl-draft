# v2.2 front BOARD: real-org start and the board

Branch `v22/board` (merged with `release/v2.2`). Flags `FEATURES.realOrgStart`, `FEATURES.board`, staging only. Flag-off digests: `careerBoard.flagOff.test.ts`.

## Shipped

- Wizard: found a club, or take over a real org in one screen (region, org, difficulty, go). Each card shows stature, rank, cash, season budget next to the wage bill, wage room, expected finish and miss cost. The manager's flag is the roster's nationality, and the crest is the org's procedural crest.
- `orgProfile.ts` (stature, money) and `seatSwap.ts`. The org leaves the world, a filler keeps the count, and `userOrgRef` blocks re-entry. A club the user left is listed in `world.userBuiltRefs`, so the anchor pass neither pulls its history in nor its players out. A region move drops `competition.localOrigin`.
- `board.ts` and `boardFlow.ts`. Three packages, Expected preselected; the objective becomes the goal card's target. Also a secondary objective, a legacy objective after titles, logged confidence with checkpoints and season recovery, and warning, ultimatum, dismissal at a review only. Top confidence pays one upgrade the player picks: the next installation, or a staff role for a season.
- `manager.ts`: offers after dismissal, unsolicited approaches.
- Screens in `components/career/board/`.

## Decisions

- R-BOARD-1: dismissal only at a review, after a failed ultimatum; no ultimatum in the first board season (owners: two).
- R-BOARD-2: the dataset's future arrivals for the user's org stay where they are.
- R-BOARD-3: one goal card.
- R-BOARD-4: older saves get an owners board at the next rollover, at confidence 100.
- R-BOARD-5: a club the user managed is off the dataset script.
- R-BOARD-6: board objectives state calibrated chances. The fit is shift-only: logit(p) = logit(model) + a + first, per stature × difficulty (`CAREER_BOARD.calibration`). Plain season goals and sponsor goals are untouched.

## Root cause (stated vs real)

The season-goal model is biased by stature under the staging flags. On Normal, competent real orgs hit goals the model rates at 0-20% about 60% of the time, and founded clubs hit far less than stated. The settled outcome of every offered goal shows it (58 careers, about 10k goals). The bias also differs a lot between careers and seeds, so no single input error explains it. The fitted shift corrects the average.

**Changelog line:** `agePassAndIntake` rebuilt the world without `formerSquad`, so a sold founder stopped resolving after the next rollover and his buyer fielded a stand-in. Fixed in every build. Digests refreshed: `careerBoard.flagOff` season 2, `endlessFlagOff` seasons 2-3.

## Measured (final config, seed 15000, all staging flags incl. endless)

The run was cut to 15 careers when the owner's PC was saturated (N = career-seasons):

| cell | Expected stated → measured | Cautious / Ambitious measured |
|---|---|---|
| competent Normal, all (N=42) | 63% → 47% | 77% / 33% |
| competent Hard, all (N=30) | 59% → 70% | 67% / 37% |
| founded Normal / Hard (N=6 each) | 66% → 33% / 67% → 83% | |

- No cell reaches N ≥ 20, so the ±12 bar is NOT shown.
- On held-out seeds, single careers swing between 17% and 83%.
- Cautious is clearly easier than Ambitious in measured terms.
- Dismissals: competent 0/15 careers; careless 1/13 (Hard contender, S5).
- Season-1 hit, competent: 9/12 careers.
- Cash at S6 (median): elite $0.7-1.1M, mid $0.75-1.15M, underdog $78-162k, founded $42-61k.

Earlier config (round 1, 60+ careers): competent Normal 0/9, careless 9/12 dismissed in S3-6.

## Soft locks

- `P1_SOFT` NA,SAM, 4 seasons, every staging flag: 0 findings.
- `BOARD_SOFT=1` (`careerBoard.softlock.test.ts`): a dismissed manager takes an offer and plays 2 more seasons, and an accepted approach plays 2 more seasons. Both pass.
- 0 soft locks in every probe career.

## Not verified

- The ±12 calibration bar.
- The Hard and careless tables at real N.
- The UI in a browser and at 320 px.

## For Miguel

- Whether to tune with a larger seed battery, once the machine allows it.
