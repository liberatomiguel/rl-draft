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
| A prospect's season gain at 15 · at 18 (p50, default setup) | 7.0 · 0.1 | 4.5 · 1.9 |
| Age he reaches his peak (p50): all · early · standard · late | 17.7 | 20.0 · 18.6 · 20.0 · 21.3 |
| Peak within ±tolerance of his potential | 100.0% | 100.0% |
| A 13–14-year-old (potential 85+) reaches his peak in season (p50) | – | 6.9 |
| No report, settled players (headroom 0–2): truth at the band's floor · mean position | 35.4% · 0.31 | 22.1% · 0.46 |
| A report narrows inside the band shown before | 42.0% | 100.0% |
| The band moves when his overall grows | 87.8% | 0.0% |
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
| fillers · 1 | 2592 | 7.8% | 2.9% | 95 | 2.0 |
| free agents · 1 | 1152 | 15.1% | 3.0% | 99 | 2.0 |
| fillers · 2 | 2592 | 6.1% | 1.5% | 97 | 2.0 |
| free agents · 2 | 1152 | 14.6% | 2.7% | 99 | 1.0 |

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
| 1 · all | 448 | 66.0 | 70.0 | 69.8 | 72.9 | 76.0 | 78.0 | 78.3 | 79.0 | 79.0 | 78.8 | 78.3 | 78.1 | 77.8 | 76.6 | 75.4 | 73.8 |
| 2 · all | 448 | 66.0 | 68.0 | 68.0 | 70.1 | 73.0 | 75.5 | 76.9 | 78.8 | 79.0 | 79.2 | 79.2 | 79.0 | 78.0 | 77.0 | 75.6 | 74.4 |
| 2 · early | 124 | 67.0 | 70.0 | 68.1 | 70.1 | 73.4 | 76.8 | 77.3 | 78.9 | 78.6 | 78.0 | 77.0 | 76.2 | 74.6 | 73.0 | 70.6 | 68.4 |
| 2 · standard | 208 | 66.0 | 67.6 | 68.0 | 70.4 | 72.8 | 75.3 | 77.3 | 79.5 | 80.0 | 80.0 | 80.0 | 79.6 | 79.0 | 78.1 | 76.2 | 74.6 |
| 2 · late | 116 | 68.0 | 68.0 | 68.4 | 70.3 | 72.0 | 74.5 | 75.3 | 78.0 | 78.8 | 80.0 | 80.0 | 80.0 | 80.0 | 79.6 | 79.0 | 78.2 |

#### G4b. Season gain by age (p50 / p90)

| Model | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 7.0 / 7.0 | 7.0 / 7.0 | 7.0 / 7.0 | 4.9 / 7.0 | 0.3 / 3.9 | 0.1 / 3.5 | 0.0 / 2.7 | 0.0 / 0.8 | -0.3 / -0.2 | -0.8 / -0.5 | -0.4 / -0.2 | -0.6 / -0.3 | -0.9 / -0.5 | -1.5 / -0.8 | -1.3 / -0.7 |
| 2 | 3.5 / 5.7 | 3.8 / 6.2 | 4.5 / 7.0 | 3.6 / 7.0 | 2.4 / 4.3 | 1.9 / 4.1 | 1.3 / 3.9 | 0.5 / 1.8 | 0.0 / 0.8 | 0.0 / 0.2 | -0.2 / 0.0 | -0.6 / 0.0 | -1.1 / 0.0 | -1.4 / -0.4 | -1.7 / -0.8 |

### G5. Peak age and peak against potential

Peak = his best overall over 16 seasons; reached = the first age within 0.5 of it. Model 2's tolerance: ±2 (CAREER_DEV.peakTolerance).

| Model · profile | n | peak age (profile) p50 | reached at p10 / p50 / p90 | peak − potential p10 / p50 / p90 | within ±tolerance | over +tolerance | under −tolerance |
|---|---|---|---|---|---|---|---|
| 1 · all | 448 | 20 | 15.0 / 17.7 / 20.3 | 0.0 / 0.0 / 0.0 | 100.0% | 0.0% | 0.0% |
| 2 · all | 448 | 21 | 18.2 / 20.0 / 21.5 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |
| 2 · early | 124 | 19 | 17.3 / 18.6 / 19.7 | -1.0 / 0.0 / 1.0 | 100.0% | 0.0% | 0.0% |
| 2 · standard | 208 | 21 | 18.9 / 20.0 / 20.9 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |
| 2 · late | 116 | 23 | 20.4 / 21.3 / 22.5 | -2.0 / 0.0 / 2.0 | 100.0% | 0.0% | 0.0% |

Signed at 13–14 with potential 85+ (model 2, n 53): reaches his peak at 20.6 (p50), 22.2 (p90) — season 6.9 of his career (p50).

### G6. Scouting bands (DEV-01e) — where the true potential sits in the band (0 = the floor, 1 = the ceiling)

| Model · level | headroom | players | mean position | at the floor (≤ 0.15) | middle | at the ceiling (≥ 0.85) | ceiling − truth p50 |
|---|---|---|---|---|---|---|---|
| 1 · 0 | 0–2 | 4058 | 0.31 | 35.4% | 54.3% | 10.3% | 4.0 |
| 1 · 0 | 3–5 | 528 | 0.48 | 22.0% | 62.7% | 15.3% | 4.0 |
| 1 · 0 | 6–10 | 315 | 0.59 | 18.4% | 50.5% | 31.1% | 3.0 |
| 1 · 0 | 11+ | 277 | 0.56 | 16.6% | 54.9% | 28.5% | 4.0 |
| 1 · 1 | 0–2 | 4011 | 0.39 | 30.6% | 52.9% | 16.5% | 2.0 |
| 1 · 1 | 3–5 | 528 | 0.51 | 15.7% | 68.6% | 15.7% | 2.0 |
| 1 · 1 | 6–10 | 315 | 0.47 | 25.4% | 57.1% | 17.5% | 3.0 |
| 1 · 1 | 11+ | 277 | 0.55 | 14.4% | 65.3% | 20.2% | 2.0 |
| 1 · 2 | 0–2 | 3758 | 0.44 | 56.2% | 0.0% | 43.8% | 2.0 |
| 1 · 2 | 3–5 | 528 | 0.51 | 48.9% | 0.0% | 51.1% | 0.0 |
| 1 · 2 | 6–10 | 315 | 0.47 | 53.0% | 0.0% | 47.0% | 2.0 |
| 1 · 2 | 11+ | 271 | 0.46 | 53.9% | 0.0% | 46.1% | 1.0 |
| 2 · 0 | 0–2 | 2773 | 0.46 | 22.1% | 62.7% | 15.2% | 6.0 |
| 2 · 0 | 3–5 | 1025 | 0.50 | 20.5% | 58.5% | 21.0% | 5.0 |
| 2 · 0 | 6–10 | 848 | 0.59 | 14.0% | 55.0% | 31.0% | 4.0 |
| 2 · 0 | 11+ | 284 | 0.61 | 10.2% | 62.7% | 27.1% | 4.0 |
| 2 · 1 | 0–2 | 2773 | 0.46 | 23.2% | 59.0% | 17.8% | 4.0 |
| 2 · 1 | 3–5 | 1025 | 0.48 | 22.3% | 58.0% | 19.7% | 3.0 |
| 2 · 1 | 6–10 | 848 | 0.58 | 13.7% | 61.2% | 25.1% | 2.0 |
| 2 · 1 | 11+ | 284 | 0.58 | 18.3% | 50.4% | 31.3% | 2.0 |
| 2 · 2 | 0–2 | 2773 | 0.45 | 42.0% | 25.3% | 32.7% | 1.0 |
| 2 · 2 | 3–5 | 1025 | 0.50 | 38.2% | 22.5% | 39.2% | 1.0 |
| 2 · 2 | 6–10 | 848 | 0.58 | 29.8% | 23.6% | 46.6% | 1.0 |
| 2 · 2 | 11+ | 284 | 0.59 | 31.0% | 19.7% | 49.3% | 1.0 |

Model 1: a report narrows inside the band shown before (L1 ⊆ L0, L2 ⊆ L1) for 42.0% of players; the band moves when his overall grows by 3 for 87.8%.
Model 2: a report narrows inside the band shown before (L1 ⊆ L0, L2 ⊆ L1) for 100.0% of players; the band moves when his overall grows by 3 for 0.0%.

### G7. The AI world's growth — generated players over nine seasons, by age at the season start

| Age | model 1: overall p50 | gain p50 | gap to potential p50 | model 2: overall p50 | gain p50 | gap to his real peak p50 | at his real peak (±0.5) |
|---|---|---|---|---|---|---|---|
| 13 | 71.2 | 5.2 | 7.8 | 69.6 | 3.2 | 10.2 | 0.3% |
| 14 | 73.2 | 5.1 | 5.9 | 71.1 | 3.3 | 8.4 | 0.5% |
| 15 | 74.0 | 4.8 | 5.0 | 72.2 | 3.3 | 7.0 | 1.0% |
| 16 | 74.5 | 3.9 | 3.4 | 73.6 | 3.3 | 5.5 | 2.6% |
| 17 | 76.0 | 2.7 | 2.0 | 75.9 | 2.5 | 3.1 | 11.6% |
| 18 | 77.0 | 1.8 | 1.9 | 77.2 | 1.9 | 1.4 | 29.3% |
| 19 | 77.7 | 1.6 | 1.4 | 78.0 | 1.2 | 0.4 | 53.9% |
| 20 | 78.0 | 1.2 | 2.0 | 78.0 | 0.5 | 0.0 | 71.7% |
| 21 | 77.9 | 0.8 | 2.0 | 78.0 | 0.0 | 0.0 | 76.9% |
| 22 | 76.5 | -0.7 | 2.0 | 77.0 | 0.0 | 0.0 | 71.8% |
| 23 | 75.2 | -0.7 | 2.0 | 75.3 | -0.3 | 0.3 | 58.6% |
| 24 | 74.0 | -1.6 | 2.0 | 74.0 | -0.9 | 1.2 | 41.0% |
| 25 | 72.1 | -1.6 | 2.0 | 72.0 | -1.5 | 2.5 | 27.1% |
| 26 | 69.0 | -2.6 | 2.0 | 69.6 | -2.0 | 4.0 | 12.3% |
| 27 | 65.3 | -2.6 | 2.0 | 66.2 | -2.0 | 6.0 | 4.7% |
| 28 | 62.4 | -2.3 | 2.0 | 62.0 | -1.8 | 7.5 | 0.9% |

_Probe runtime: 19 s._
