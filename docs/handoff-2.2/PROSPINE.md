# PROSPINE handoff (Pro slices 3-4, round 2, QA round)

Branch `v22/pro-spine`, behind `FEATURES.proCareer`. Round 1 is in release/v2.2.

## Shipped in round 2

- **He plays his series** (`store/proMatch.ts`): the host's Matchday custom mode runs his side's series one game at a time, with one decision a game (`buildDecision`, `resolveDecision`, `EMPTY_LEDGER` per series). The team edge plays that game through the Matchday engine; his rating is `finalProRating` on the box line. On instinct, sim the series or the event. Benched: simmed, short report. Needs `FEATURES.matchdayDecisions`, otherwise the event is simmed.
- **Org seat** (`store/proSeat.ts`): under contract his org takes the host's user seat, leaving `world.orgs` with its points, seeding and fields remapped. It returns to its ref at the stint's end and around every rollover, players' growth as drift. No filler, no duplicate.
- **The end**: `rolloverProPlayer` at rollovers, retirement by age, by choice or after a season without contract, `bridge` legend; the card from orgs, titles, gala award keys, nickname, best season. Season rows: team, role, games, average, titles.
- **Gala, nicknames** (`store/proGala.ts`): every rostered player plus his box line; no deciding-moment data, so "most decisive" is never given.
- **QA fixes**: Continue stops every Monday for the plan (one tap, or the auto-plan opt-in) and for offers arriving or two days from expiry, burnout warning and burnout, matchdays, a contract ending, season end. Today says what last week did and why it stopped. A plan that would tire him falls back to the coach's. Rotation: one event in three, stated on the offer and the Team tab with a countdown, role review after 6 series. Orgs the dataset ends next season make no offer; near the end they say "uncertain". No invites under contract or from a side declined this season. The card counts every org. The planner says why it stopped.

## Decisions

- R-PROSPINE-6: temporary org seat.
- R-PROSPINE-7: bottom-half orgs offer a start, top-half a rotation spot; at 15-16, one start offer once he reaches a bottom-half org's bar.
- R-PROSPINE-9: the Monday plan gate (Continue accepts the plan shown).

## Tunables

- `CAREER_PRO_ORG`: topStarterMargin 2, youthStarterAge 16, rotationEvery 3, reviewAfter 6, promoteRating 6.8.
- `CAREER_PRO_TEAM`: inviteDays 14 (was 13), expiryWarnDays 2.
- **Changed**, `CAREER_PRO_RANKED.skillTable`: `[66,2800]` became `[65,2550],[78,2800]`.

Overall at each rank floor now: Silver 47, Gold 51, Platinum 53, Diamond 54, Champion 55, Grand Champion 57 (unchanged), SSL 75 (was 65).

## Measured

- Whole-career probe, all staging flags, 13 to retirement, after the QA fixes:

  | Run | First org | Starter seasons | Peak (age) | Worlds | Titles | Retired |
  |---|---|---|---|---|---|---|
  | NA Normal | 14 | 15 | 99.0 (27) | 3 | 22 | 30 |
  | EU Normal | 15 | 15 | 98.3 (27) | 3 | 10 | 30 |
  | SAM Normal | 15 | 14 | 94.4 (28) | 3 | 10 | 30 |
  | NA Hard | 15 | 15 | 90.7 (21) | 2 | 4 | 31 |

- In all four runs: no throw, no stuck step, one roster at a time, every season closed with its line, and the card round-tripped.
- Manager identity (flags on, 3 seasons): same sha256 as the rc.6 baseline (48046fa1...).

## Not verified

No browser check. Calibration: Normal peaks run high. On the seat the org plays as the host team (no coach modifier), not as `orgTeamFor`.

## For Miguel

1. Fixed in round 3 (careerFlow `userSeriesGate`). Changelog root cause: in double-elimination playoffs `userHasPendingSeries` stays true for a round with no user series (his bracket waits), so the custom-mode gate returned "open", `openUserSeriesOn` found no pairing and `stepEventRound` made no progress. The gate now returns "play" when no pairing exists. Regression test: `careerMatchdayIdleRound.test.ts`. The Pro flow's quick-mode workaround is removed.
2. Bronze to Grand Champion spans overall 47-57 (pro-engine's table).
