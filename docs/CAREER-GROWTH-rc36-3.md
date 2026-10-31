# Career growth — rc.32 (DEV-01, the growth contract)

> **Generated** by `CAREER_GROWTH=1 GROWTH_SEEDS=24 GROWTH_MD=docs/CAREER-GROWTH-rc32.md npx vitest run src/store/careerGrowth.probe.test.ts` (src/store/careerGrowth.probe.test.ts). Regenerate, never hand-edit. Pure engine functions on fixed seeds, both development models side by side: **model 1** = rc.31's (an rc.31 save keeps it for life), **model 2** = DEV-01 (every new career, `CAREER_DEV.growthModel`). Decisions: ROAD-TO-WORLDS-DECISIONS R55–R57.

What model 2 changes (each number a `balance.ts` key):

- **a) Elite prospects in every era.** A dataset-era kid aged 13–15 from a top tier the era caps at 88 becomes a 93–98 prospect with `CAREER_WORLD.eliteProspect.chance` (97/98 the rarest); the 88+ share does not grow; the infinite era keeps its pyramid.
- **b) An individual arc.** Maturity (early / standard / late, `CAREER_DEV.maturity`) sets the peak age, a plateau (`plateauYearsWeights`) holds the top, then a gradual decline (`declinePerYear` × the decline rate). A real player peaks at his best moment's age (`realPeakAgeRange`). Fixed per (career seed, player id). The potential is the **expected** peak: the real one sits within ±`peakTolerance`.
- **c) Specials.** A real player's potential is max(best club card + jitter, his best eligible special): his own real-moment player cards of the career's era (`potentialSpecialTypes` / `potentialSpecialRarities`, `potentialSpecialCareerEraOnly`); national, community, Creator, Wings and coach cards never count. His debut overall is unchanged.
- **d) The curve.** No split cap; a season cap (`seasonGainCap`); the pace = `paceCurvature` × gap ÷ years to the peak (floor `paceFloorPerYear`, at most the season cap a year), in training-week equivalents (`trainingWeeksPerYear`). Days plus the series a player actually plays (`xpWeeksPerSeries`); a reserve who did not play earns no event XP. No step on a birthday or at the rollover: the decline lands day by day and the AI world grows every Monday.
- **e) Scouting.** Bands read the potential only and nest (a report narrows inside the band shown before); the truth's place is uniform, so it can sit at the floor, the middle or the top.

## Summary — model 1 (rc.31) → model 2 (DEV-01), same seeds

| Measure | model 1 | model 2 |
|---|---|---|
| Dataset-era rookies aged 13–15 with potential 93+ (of 6720) | 0.0% | 0.8% |
| … of them 97–98 · the era's max potential | 0 · 88 | 7 · 98 |
| Dataset-era rookies at 88+ (wonderkids) | 14.7% | 14.7% |
| Real players under their eligible special | 85.1% | 0.0% |
| A prospect's season gain at 15 · at 18 (p50, default setup) | 5.4 · 0.0 | 1.8 · 1.8 |
| Age he reaches his peak (p50): all · early · standard · late | 16.9 | 21.8 · 19.9 · 21.8 · 23.5 |
| Peak within ±tolerance of his potential | 100.0% | 100.0% |
| A 13–14-year-old (potential 85+) reaches his peak in season (p50) | – | 8.8 |
| No report, settled players (headroom 0–2): truth at the band's floor · mean position | 11.3% · 0.49 | 55.4% · 0.22 |
| A report narrows inside the band shown before | 100.0% | 100.0% |
| The band moves when his overall grows | 80.1% | 66.4% |
| AI world at 21: gap to potential (model 1) / to his real peak (model 2), p50 | 2.0 | 0.0 |

## Appendix — the growth tables

### G1. Prospect classes (DEV-01a) — every rookie intake, by era and model

| Era · model | rookies | pot ≥ 88 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | aged 13–15 with pot ≥ 93 | max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dataset (S1–S5) · 1 | 6720 | 14.7% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 88 |
| dataset (S1–S5) · 2 | 6720 | 14.7% | 0.2% | 0.2% | 0.2% | 0.2% | 0.1% | 0.0% | 0.0% | 0.8% | 98 |
| infinite (S6–S9) · 1 | 5376 | 14.5% | 2.0% | 0.4% | 0.7% | 0.5% | 0.4% | 0.5% | 0.4% | 3.7% | 99 |
| infinite (S6–S9) · 2 | 5376 | 14.5% | 2.0% | 0.4% | 0.7% | 0.5% | 0.4% | 0.5% | 0.4% | 3.7% | 99 |

Model 2's dataset-era elite roll: CAREER_WORLD.eliteProspect (chance 0.08 of a capped top-tier kid aged ≤ 15). The infinite era keeps its pyramid.

#### G1b. Elite prospects (aged 13–15, potential 93+) by region — model 2

| Region | rookies | dataset era: elite | per career (S1–S5, one region) | 97–98 | infinite era: elite |
|---|---|---|---|---|---|
| NA | 1728 | 0.8% | 0.33 | 0 | 3.4% |
| EU | 1728 | 0.5% | 0.21 | 0 | 4.0% |
| SAM | 1728 | 1.1% | 0.46 | 3 | 4.6% |
| MENA | 1728 | 0.6% | 0.25 | 1 | 3.4% |
| OCE | 1728 | 0.6% | 0.25 | 0 | 4.2% |
| APAC | 1728 | 1.4% | 0.54 | 3 | 3.0% |
| SSA | 1728 | 0.8% | 0.33 | 0 | 3.1% |

#### G1c. By class (the intake season) — aged 13–15 with potential 93+

| Class | model 1 | model 2 | model 2: 97–98 |
|---|---|---|---|
| S1 (2021-22) | 0.0% | 0.6% | 1 |
| S2 (2022-23) | 0.0% | 0.9% | 1 |
| S3 (2024) | 0.0% | 1.1% | 4 |
| S4 (2025) | 0.0% | 0.9% | 0 |
| S5 (2026) | 0.0% | 0.7% | 1 |
| S6 (infinite) | 3.7% | 3.7% | 11 |
| S7 (infinite) | 3.8% | 3.8% | 14 |
| S8 (infinite) | 3.6% | 3.6% | 17 |
| S9 (infinite) | 3.6% | 3.6% | 12 |

### G2. The season-0 world — generated players and the free-agent pool

| Pool · model | players | pot ≥ 88 | pot ≥ 93 | max pot | headroom (pot − ovr) p50 |
|---|---|---|---|---|---|
| fillers · 1 | 3051 | 7.6% | 2.7% | 95 | 2.0 |
| free agents · 1 | 867 | 10.1% | 2.3% | 95 | 2.0 |
| fillers · 2 | 3051 | 6.3% | 1.4% | 99 | 2.0 |
| free agents · 2 | 867 | 9.7% | 1.6% | 99 | 2.0 |

### G3. Real players against their eligible special cards (DEV-01c)

Players with an eligible special: 47 (player specials that never count — national, community, Creator, Wings: 99). Five seeds each.

| Model | samples | potential below the special | special − potential p50 | p90 | max |
|---|---|---|---|---|---|
| 1 | 235 | 85.1% | 3 | 5 | 8 |
| 2 | 235 | 0.0% | 0 | 0 | 0 |

### G4. A prospect's arc by age — overall p50 at each season start (the default setup, through the real daily tick)

Every rookie of one intake (S1, aged 13–16), trained with no coach, no gear, auto focus and normal intensity: 16 open weeks (the Training Week bonus) and 16 event weeks (match prep, four series at field quality 0.85, about 64 series a season). Model 2 splits by maturity profile.

| Model · profile | n | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 · all | 448 | 66.0 | 70.0 | 72.5 | 74.0 | 77.0 | 78.3 | 79.0 | 79.0 | 79.0 | 78.8 | 78.3 | 78.1 | 77.8 | 76.6 | 75.4 | 73.8 |
| 2 · all | 448 | 66.0 | 67.0 | 68.0 | 69.0 | 70.8 | 72.8 | 74.7 | 76.2 | 77.7 | 78.6 | 79.0 | 79.0 | 78.8 | 78.0 | 77.0 | 75.4 |
| 2 · early | 124 | 67.0 | 68.0 | 68.8 | 69.7 | 72.1 | 74.0 | 76.4 | 78.0 | 78.7 | 78.6 | 77.6 | 77.0 | 76.2 | 74.6 | 72.6 | 70.6 |
| 2 · standard | 208 | 66.0 | 66.7 | 67.5 | 69.0 | 70.8 | 72.6 | 74.3 | 76.2 | 77.9 | 79.6 | 80.0 | 80.0 | 79.6 | 79.0 | 78.1 | 76.2 |
| 2 · late | 116 | 68.0 | 67.0 | 68.0 | 68.8 | 70.4 | 71.7 | 73.2 | 74.8 | 76.3 | 77.4 | 78.7 | 79.9 | 80.0 | 80.0 | 79.6 | 79.0 |

#### G4b. Season gain by age (p50 / p90)

| Model | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 7.0 / 7.0 | 6.5 / 7.0 | 5.4 / 7.0 | 3.2 / 7.0 | 0.3 / 5.4 | 0.0 / 3.1 | 0.0 / 0.5 | 0.0 / 0.0 | -0.3 / -0.2 | -0.8 / -0.5 | -0.4 / -0.2 | -0.6 / -0.3 | -0.9 / -0.5 | -1.5 / -0.8 | -1.3 / -0.7 |
| 2 | 1.7 / 2.6 | 1.7 / 2.8 | 1.8 / 3.1 | 1.9 / 3.6 | 1.8 / 3.6 | 1.8 / 3.5 | 1.7 / 3.2 | 1.4 / 2.7 | 0.8 / 2.1 | 0.3 / 1.7 | 0.0 / 1.0 | -0.2 / 0.3 | -0.6 / 0.0 | -1.1 / 0.0 | -1.4 / -0.4 |

### G5. Peak age and peak against potential

Peak = his best overall over 16 seasons; reached = the first age within 0.5 of it. Model 2's tolerance: ±2 (CAREER_DEV.peakTolerance).

| Model · profile | n | peak age (profile) p50 | reached at p10 / p50 / p90 | peak − potential p10 / p50 / p90 | within ±tolerance | over +tolerance | under −tolerance |
|---|---|---|---|---|---|---|---|
| 1 · all | 448 | 20 | 15.0 / 16.9 / 19.1 | 0.0 / 0.0 / 0.0 | 100.0% | 0.0% | 0.0% |
| 2 · all | 448 | 22 | 19.4 / 21.8 / 23.8 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |
| 2 · early | 124 | 20 | 18.7 / 19.9 / 21.0 | -1.0 / 0.0 / 1.0 | 100.0% | 0.0% | 0.0% |
| 2 · standard | 208 | 22 | 20.7 / 21.8 / 22.8 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |
| 2 · late | 116 | 24 | 22.6 / 23.5 / 24.7 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |

Signed at 13–14 with potential 85+ (model 2, n 53): reaches his peak at 22.7 (p50), 24.6 (p90) — season 8.8 of his career (p50).

### G6. Scouting bands (DEV-01e) — where the true potential sits in the band (0 = the floor, 1 = the ceiling)

| Model · level | headroom | players | mean position | at the floor (≤ 0.15) | middle | at the ceiling (≥ 0.85) | ceiling − truth p50 |
|---|---|---|---|---|---|---|---|
| 1 · 0 | 0–2 | 3883 | 0.49 | 11.3% | 84.4% | 4.2% | 2.0 |
| 1 · 0 | 3–5 | 458 | 0.67 | 0.0% | 93.9% | 6.1% | 2.0 |
| 1 · 0 | 6–10 | 318 | 0.73 | 0.0% | 81.4% | 18.6% | 2.0 |
| 1 · 0 | 11+ | 294 | 0.67 | 0.0% | 93.9% | 6.1% | 2.0 |
| 1 · 1 | 0–2 | 3725 | 0.50 | 23.0% | 52.6% | 24.4% | 1.0 |
| 1 · 1 | 3–5 | 445 | 0.60 | 13.9% | 57.3% | 28.8% | 1.0 |
| 1 · 1 | 6–10 | 283 | 0.59 | 16.3% | 53.4% | 30.4% | 1.0 |
| 1 · 1 | 11+ | 284 | 0.59 | 11.3% | 58.8% | 29.9% | 1.0 |
| 1 · 2 | 0–2 | 1616 | 0.36 | 63.6% | 0.0% | 36.4% | 1.0 |
| 1 · 2 | 3–5 | 167 | 0.56 | 43.7% | 0.0% | 56.3% | 0.0 |
| 1 · 2 | 6–10 | 94 | 0.56 | 43.6% | 0.0% | 56.4% | 0.0 |
| 1 · 2 | 11+ | 127 | 0.35 | 65.4% | 0.0% | 34.6% | 1.0 |
| 2 · 0 | 0–2 | 2428 | 0.22 | 55.4% | 43.2% | 1.4% | 2.0 |
| 2 · 0 | 3–5 | 1050 | 0.67 | 0.0% | 92.9% | 7.1% | 2.0 |
| 2 · 0 | 6–10 | 938 | 0.70 | 0.0% | 89.4% | 10.6% | 2.0 |
| 2 · 0 | 11+ | 305 | 0.66 | 0.0% | 95.1% | 4.9% | 2.0 |
| 2 · 1 | 0–2 | 2296 | 0.25 | 52.9% | 40.7% | 6.4% | 1.0 |
| 2 · 1 | 3–5 | 1050 | 0.58 | 0.0% | 82.2% | 17.8% | 1.0 |
| 2 · 1 | 6–10 | 938 | 0.60 | 0.0% | 82.3% | 17.7% | 1.0 |
| 2 · 1 | 11+ | 305 | 0.57 | 0.0% | 85.6% | 14.4% | 1.0 |
| 2 · 2 | 0–2 | 1879 | 0.25 | 74.6% | 0.0% | 25.4% | 1.0 |
| 2 · 2 | 3–5 | 1050 | 0.48 | 51.5% | 0.0% | 48.5% | 1.0 |
| 2 · 2 | 6–10 | 938 | 0.45 | 55.0% | 0.0% | 45.0% | 1.0 |
| 2 · 2 | 11+ | 305 | 0.41 | 59.0% | 0.0% | 41.0% | 1.0 |

Model 1: a report narrows inside the band shown before (L1 ⊆ L0, L2 ⊆ L1) for 100.0% of players; the band moves when his overall grows by 3 for 80.1%.
Model 2: a report narrows inside the band shown before (L1 ⊆ L0, L2 ⊆ L1) for 100.0% of players; the band moves when his overall grows by 3 for 66.4%.

### G7. The AI world's growth — generated players over nine seasons, by age at the season start

| Age | model 1: overall p50 | gain p50 | gap to potential p50 | model 2: overall p50 | gain p50 | gap to his real peak p50 | at his real peak (±0.5) |
|---|---|---|---|---|---|---|---|
| 13 | 71.2 | 5.2 | 7.8 | 68.4 | 2.3 | 11.3 | 0.3% |
| 14 | 73.3 | 5.1 | 5.9 | 69.8 | 2.3 | 10.0 | 0.6% |
| 15 | 74.5 | 4.9 | 4.1 | 70.9 | 2.4 | 8.7 | 0.9% |
| 16 | 75.0 | 3.8 | 3.0 | 72.1 | 2.4 | 7.2 | 1.0% |
| 17 | 76.5 | 2.0 | 2.0 | 74.2 | 2.1 | 5.0 | 2.7% |
| 18 | 77.4 | 1.8 | 1.3 | 75.9 | 1.8 | 3.0 | 12.8% |
| 19 | 78.0 | 1.8 | 1.5 | 77.0 | 1.4 | 1.5 | 26.3% |
| 20 | 79.0 | 1.5 | 2.0 | 77.4 | 1.0 | 0.5 | 49.4% |
| 21 | 78.5 | 1.0 | 2.0 | 77.0 | 0.5 | 0.0 | 61.1% |
| 22 | 77.3 | -0.7 | 2.0 | 76.6 | 0.0 | 0.0 | 70.7% |
| 23 | 75.7 | -0.7 | 2.0 | 75.0 | 0.0 | 0.0 | 65.8% |
| 24 | 74.0 | -1.6 | 2.0 | 74.3 | -0.3 | 0.3 | 57.5% |
| 25 | 71.6 | -1.6 | 2.0 | 72.4 | -0.9 | 1.2 | 40.2% |
| 26 | 67.8 | -2.6 | 2.0 | 70.2 | -1.5 | 2.8 | 23.6% |
| 27 | 63.9 | -2.6 | 2.0 | 67.5 | -1.8 | 4.5 | 18.1% |
| 28 | 61.2 | -2.1 | 2.0 | 64.6 | -1.8 | 6.5 | 4.8% |

_Probe runtime: 94 s._
