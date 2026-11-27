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

## Not verified
Full suite; UI; live data; `balanceVersion.test` fails as expected (58).
