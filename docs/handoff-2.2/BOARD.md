# v2.2 front BOARD: real-org start and the board

Branch `v22/board`, merged with `release/v2.2` (rc.4). Flags: `FEATURES.realOrgStart`, `FEATURES.board`. Earlier rounds' features are unchanged.

## Round 3

- **Stated chances** (`engine/career/board.ts`): a board objective now states its goal's measured record for clubs of its stature and difficulty, `(met + k·prior) / (seasons + k)` (`CAREER_BOARD.goalRates`, `goalRatesK` = 8). The prior is the free-slope calibrated model (`calibration`).
- **Data and probe**: both are fitted on 88 competent careers × 6 seasons, seeds 9000/12000/12101/15000/20000/20101, every staging flag on including endless. Regenerate with the probe header's `BOARD_FIT_FREE` + `BOARD_FIT_FROM` (the GOALRATES line).
- **Bands, not percentages**: `CAREER_BOARD.bands` sets Expected ≥ 65%, Within reach 45–65%, A stretch 25–45%, A long shot < 25%. They show on the package card, the Board page (start band and "now" band), and in the checkpoint and ultimatum mails, EN and PT.
- **Checkpoints** compare the model's chance now with its own chance with nothing played. The stated chance carries the same offset.
- **R-BOARD-7: why the raw model fails.** It reads a squad's level, but under the staging flags clubs of one stature hit the same goal at very different rates from the model's (elite underrated, founded overrated). A single logistic shift did not hold out of sample (round 2). A per-goal record by stature does.

## Held-out measurement (seeds 30000/30101, 120 careers, final config)

Competent bot on Expected. N = career-seasons at the starting club.

| Cell | Normal: stated → measured | Hard: stated → measured |
|---|---|---|
| Elite | 52 → 61 (36) | 52 → 43 (35) |
| Contender | 52 → 44 (36) | 55 → 69 (36) |
| Mid | 60 → 61 (36) | 58 → 61 (36) |
| Underdog | 63 → **92** (36) | 62 → 50 (36) |
| Founded | 70 → 61 (36) | 65 → 58 (36) |

- 8 of 10 cells are within ±12 points.
- Underdog Normal is understated by 29 points (one band, easier than stated). Contender Hard is 14 points off.
- No stature is off by more than one band.
- Cautious is always easier than Ambitious; measured Cautious is 61–100% and Ambitious 28–64%.
- Season 1 Expected hit: 17–83% by cell, N = 6 each (too small to read).
- **Bands** (all three packages, competent, N = 1077 objectives): the measured rate falls in the stated band 65% of the time, in an adjacent band 34%, two or more away 1%.
- **Careless** players (badSponsor bot on Ambitious) hit far below the stated chances: 35% same band, 34% two or more away. The stated chance is a competent manager's.

## Dismissals (6 seasons, N = 30 careers per row)

| | Normal | Hard |
|---|---|---|
| Competent | 1/30 (contender S6) | 1/30 (elite S5) |
| Careless | 7/30 (S4–6) | 9/30 (S4–6) |

- Careless dismissals land late (S4–6, not S3–5). Careless mid and underdog clubs are rarely dismissed (season recovery 25%).
- Cash at S6 (median, competent): elite $107–544k, contender $302–910k, mid $126–382k, underdog $54–220k, founded $34–39k.
- 0 soft locks in all 120 careers.

## Proposed (not done)

- Underdog Normal hits more than stated: offer it the next harder objective (or refit with more seeds). Cells with fewer than 40 records lean on the prior.
- Careless dismissals: lower `seasonRecovery.board` to 0.15 if Miguel wants them out by S4.

## Not verified

The screens in a browser and at 320 px. Easy difficulty has no cells, so it reads the raw model.
