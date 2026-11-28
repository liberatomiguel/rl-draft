# rc.9 LEGACY handoff

Branch `rc9/legacy`. Method: `difficulty.matrix.test.ts` with `SIM_TAIL=1`, live reset profile `0,1,2,3,5,8,12,20`, 6 tournaments per session. n = 1,440 tournaments per cell (240 sessions), 2,880 for the retuned cells (480). Gap = player's shown overall minus the rival's shown overall.

## Cause
Region-only rivals play above their shown number: region boost, plus in MENA `fieldDepth` 0.5 (half the gap to the best team). The weakest-looking rival carries the biggest lift (up to +13). PostHog shows MENA's title rate is normal; the rivals only LOOK weak. Hard/Legacy hide every overall during the run, so players judge by the name and their own final number.

## Tail, Legacy (P lose series / effective gap), 2,880
| shown gap | MENA before | MENA after | OCE before | OCE after | WW, unchanged (1,440) |
|---|---|---|---|---|---|
| 5-7 | 68.5% / -2.3 | 58.4% / -1.5 | 53.3% | 53.0% | 4.1% |
| 8-9 | 52.4% / -1.4 | 5.4% / +4.1 | 21.3% | 3.9% | 0.5% |
| 10-14 | 27.5% / +0.4 | 0.0% / +10.1 | 4.0% | 0.0% | 0.2% |
| 15+ | 6.4% | 0.0% | 0.0% | 0.0% | 0.0% |

Runs ended by a loss at 8+: MENA Legacy 42.3% to 1.6%, MENA Hard 8.0 to 0.1, OCE Legacy 10.0 to 2.0. MENA Legacy 97 teams 20.3% to 0.2%; 99 teams 16.7% to 0 (n 42).

## Rule
`DRAFT_UPSET_GUARD` (#220): in the player's series the rival's region lift fades from full at gap 5 to zero at 10. Region-only only. It moves ratings, not draws. Retune rides on it (#221): MENA Hard +0.3, Legacy +0.5, OCE Hard +0.1, Legacy +1.5.

## Title rate, before / after
Every region x difficulty within 1.3 points (n 1,440: SAM Hard 35.3/34.0 is noise; at n 2,880 it is 35.1/35.0). Retuned: MENA Hard 25.4/24.6, Legacy 3.6/3.8; OCE Hard 36.4/36.2, Legacy 7.4/7.6. Worldwide is bit-identical. **Moves:** MENA Legacy top 4 36 to 64%, Swiss exit 34 to 10%. Season Rating pays top 4: Miguel decides.

## RNG
Worldwide, Daily, challenges, career: untouched (no `regionLift`; regression.golden, challenges, dailyOptimal, duel tests green). Region duel links replay differently where the guard bites. CH_TUNE not run (the challenge path cannot reach the guard).

## Final overall
`overallBreakdown` (#222). Defect: rows omit the curve, cap and rounding (three 99 cards read 97). Rows: `ReviewScreen.tsx:127-136`, `ResultsScreen.tsx:338-347`; number: `ReviewScreen.tsx:121`, `ResultsScreen.tsx:239, 334`. Hidden runs: "??" everywhere (`TournamentScreen.tsx:118, 836`) until Results. Recommend: Results shows the parts with `curveNote`, and `endedBy` + `playedAt` from `runSeriesFacts`. Double rounding left (#223).

## Analytics
`run_completed` gets series facts (#224).

## MENA compensation
Miguel (27/11): MENA was made harder on purpose because it paid too much rating; the guard must not give that back. Rating points per run = `seasonRatingDelta` on the classic placement shares, hidden-overall bonus on Hard/Legacy, no ceiling or placement protection. Same probe; n 5,760 per cell (960 sessions) for the six cells below, 2,880 elsewhere.

| cell | rc.8 pts / top 4 / Swiss / title / end@8+ | guard, plain table | guard + row |
|---|---|---|---|
| MENA Legacy | 5.66 / 37.4 / 32.2 / 3.9 / 41.6 | 9.53 / 65.9 / 8.4 / 4.4 / 1.6 | 5.72 (+1.1%) |
| MENA Hard | 4.19 / 77.1 / 10.4 / 26.8 / 7.9 | 4.44 / 83.3 / 5.5 / 25.9 / 0.1 | 4.18 (-0.2%) |
| MENA Normal | 2.27 | 2.37 (+4.4%) | 2.27 (+0.4%) |
| SAM Legacy | 12.09 | 13.68 (+13.2%) | 12.22 (+1.0%) |
| OCE Legacy | 8.93 | 10.05 (+12.6%) | 8.93 (-0.0%) |
| EU Legacy | 6.28 | 6.55 (+4.3%) | 6.30 (+0.3%) |

Every other cell drifts under 2% with the guard (largest: NA Legacy +1.5%, NA Hard +1.4%, n 2,880; OCE Hard +0.8%, n 5,760) and keeps the table. Easy is bit-identical (its boosts leave no lift).

**The honest route cannot get there** (MENA Legacy, 2,880, guard on). A lift for rivals shown near or above the player (`nearLift` 2/4/6/8, faded like the guard): points 6.5/5.1/4.5/3.9 but the title falls to 1.9/1.2/0.9/0.7% and Swiss exits stay 11-13%; the near rivals are the ones that decide titles. A wider fade (start 6-8, full 10-13): points 7.9 to 6.3, Swiss 11-16%, and the tail comes back (end@8+ 3.1 to 16.7%). The old Swiss exits WERE the absurd losses, and the pool is 35 lineups for a 15-team org-unique field, so pool weights cannot add strong rivals. So the placement shares stay as the guard leaves them and the points move instead.

**Rule** (#221, `DRAFT_UPSET_GUARD.ratingRows`, guard on, classic Region-only runs only; worldwide, Quick, Daily and the history re-price keep the table): the title keeps its value, the placements that got easier pay less. MENA Legacy 70/9/3/3/0/-6 (rc.8 70/20/6/6/0/-3), MENA Hard 10/4/0/0/0/-4, MENA Normal 4/2/1/1/0/-7, SAM Legacy 70/16/6/6/0/-4, OCE Legacy 70/15/5/5/0/-4, EU Legacy 70/17/6/6/0/-3 (champion / final / third / fourth / top 8 / Swiss). The simulation is untouched by it: titles and tail are the guard's. `profileStore` passes `entry.region`.

Not measured: Region-only Quick (keeps the table); real players' shares (the rows are fitted on the sim's reset profile); the fitted cells' rows at n 2,880 alone move up to 4% (OCE Legacy), so read them as about 2%.

## Not verified
Full suite; UI; live data; `balanceVersion.test` fails as expected (58).
