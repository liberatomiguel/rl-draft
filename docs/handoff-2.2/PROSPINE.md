# PROSPINE handoff (Pro slices 3-4, round 3: stall fix and slice 7 calibration)

Rounds 1-2 are in release/v2.2.

## Round 3

- **A. Manager stall fixed.** Changelog root cause: in double-elimination playoffs `userHasPendingSeries` stays true for a round with no user series, so `userSeriesGate` returned "open" and `stepEventRound` made no progress. The gate now plays such a round. Test: `careerMatchdayIdleRound.test.ts`.
- **B. Calibration on the real flow** (`proBattery.probe.test.ts`, opt-in `PRO_BATTERY=1`). Ages 13-29; STYLES, WORLD_LIFE, DECISIONS, BOXSCORE, PRO_CAREER, ENDLESS_VARIETY on; no BOARD/REAL_ORG_START. Talent 0.82 / 1.0 / 1.2 (before: 0.88 / 1.12).
- **Cause found.** Match XP. A starter plays 60-100 official series a season on the real calendar; the pure model assumed about 9. Match XP was 64-71% of all gains, flattened the talents and kept him growing to 27; a careless Pro never reached a team.

## Battery, Normal unless noted (median [range])

| Profile (N) | Peak before | Peak after | Peak age | Worlds played / won | Majors won | First org |
|---|---|---|---|---|---|---|
| avg managed (12) | 93.6 [87.6-95.4] | 92.1 [90.6-93.7] | 22.5 | 92% / 8% | 0 [0-2] | 15 |
| avg managed Hard (12) | 94.1 | 92.0 [89.2-93.5] | 24 | 83% / 0% | 0 | 15 |
| high managed (6) | 96.4, age 27 | 97.2 [96.1-99] | 24 | 100% / 33% | 0.5 [0-3] | 14 |
| low managed (6) | 90.0 | 85.3 [82.4-85.9] | 21 | 33% / 0% | 0 | 15 |
| avg careless (6) | 53.8 (no team) | 82.2 [77.2-84.1] | 25 | 67% / 0% | 0 | 15 |

Rotation to starter: 83%. First invite: week 6-10 (careless 20). First-season cups won: 43% (was 31%). Hard is harder in results only ("never a weaker player"): titles 4.5 vs 13, no Worlds title.

## Values changed (before → after)

- `CAREER_PRO.growth.afterPeak` 0.03 → 0.01.
- `CAREER_PRO_TEAM`:
  - new: `matchXpFullSeries` 25, `matchXpTalentExp` 2, `inviteAfterWeeks` 20, `localAnchorEdge` 1.5;
  - changed: `inviteOverall` 54 → 50.8, `firstInviteWeek` 3 → 6.
- `CAREER_PRO_ORG.byDifficulty` (new): starterMargin 0 / 1 / 3, rotationEvery 2 / 3 / 4.
- `CAREER_PRO_RANKED.skillTable` (round 2).
- Series teach fully up to 25 × talent² (linear below 1), then full/n; the anchor edge centres the cups on his level. The seated org keeps its coach; its titles return under its ref. Lifecycle bands pass.

## Not brought into band

- **Worlds played 92% for avg-managed (target about 40%).** A 90+ player lifts any side there; the lever (one player's weight in a team rating) is engine-wide.
- **Peak age.** Within 20-24 except the high profile at its ceiling (98-99 held to 25-28). The largest single-season gain after the peak is 0.5-0.7.
- **Endless projects.** Never triggered: his reigns (5 seasons in the battery) all fell before season 12, and projects start at season 12. The champion record now reads the org's ref, not "user"; unverified in an endless reign.
- **Hand-like first org.** The bot (coach's plan, instinct) signs at 15; the round-1 hand career predates the offer shaping.

## C. Emptiest stretches (avg-managed data)

1. Rotation at 15-17: 31 series a season (16-39), mostly watched.
2. Amateur: 63 series a season (41-126) of the same cups.
3. Starter from 22: 74 series a season, 70 of 81 seasons without a title.

## Stability, every staging flag including BOARD and REAL_ORG_START

NA / EU / SAM Normal to retirement: no throw, no stuck day, every season closed, the card round-tripped. Probe commands carry every flag.
