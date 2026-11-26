# PROSPINE handoff (Pro slices 3 and 4)

Branch `v22/pro-spine`, behind `FEATURES.proCareer`; merged `v22/pro-engine` (slice 2, 9e4299a).

## What shipped

- `store/proFlow.ts`: the Pro on the real calendar (cups, Open Qualifier, regionals, Majors, Worlds, AI transfers, Mundo vivo, rollover). Week blocks land Tue/Thu/Fri, the week closes Monday, through pro-engine's functions behind one adapter (`pro/spineBridge.ts`). `proStore.playWeek` now runs the calendar to next Monday or a matchday.
- `pro/team.ts`: a local amateur side (two teammates near his level) takes the `"user"` seat; better sides call later. Its events come back as a match report, revealed game by game, with his box-score line and 0-10 rating.
- `pro/offers.ts`, `pro/lineup.ts`: window offers from real orgs of his region with a reason quoting save data, stored once, expiring with the window; one counter with the risk shown; signing puts `pro:self` in `playerIds`/`reserveIds`, the displaced starter goes to the bench or free agency. Split lineups (overall, form, coach trust), rotation starts, transfer request, renewal or free agency. His org's AI series reach the report through a read-only hook.
- Screens `/career/pro/career` (Today, Team, Offers, Inbox); copy group `proWorld` EN/PT.

## Decisions

- **R-PROSPINE-1** Fallback, not extraction: the world parts of `processDayArrival` are interleaved with save bookkeeping, and the Pro also needs the event machinery. His world runs on a hidden host CareerSave sharing his world/clock/competition; `settleHost` answers manager-only decisions, money is floored. careerFlow got one import and one hook line in `resolveAiEvent`. No `worldTick.ts`.
- **R-PROSPINE-2** The host squad always holds `pro:self`: the AI market, aging and world growth never touch him.
- **R-PROSPINE-3** Matches are played, then revealed (no decision exists before slice 5). The amateur seat can step for real (host custom mode); the org stage cannot yet.
- **R-PROSPINE-4** A "1 season" deal signed after the preseason window runs through the next season.
- **R-PROSPINE-5** Amateur invites open at ranked's GC or overall 54.

## Tunables

`CAREER_PRO_TEAM`: inviteOverall 54, firstInviteWeek 3, teammateOffset -1, teammateSpread 1.5, teammateHeadroom 5, betterSideGap 3, inviteEveryWeeks 4, inviteDays 13, ratingEdgePerPoint 0.12, ratingEdgeCap 1.5, matchLogCap 30, formWindow 8, newsCap 60, hostFloor 50M.
`CAREER_PRO_ORG`: minAge 14, youngChance 0.12, formWeight 1.5, fameWeight 0.6, youthWeight 0.4, rotationMargin 6, starterMargin 1, baseChance 0.35, perPoint 0.06, maxChance 0.85, difficultyChance 1.2/1/0.8, maxOffers 3, salaryBase 2000, salaryPerValue 450, salaryPerPrestige 1500, weeksPerSplit 10, counterRaise 0.2, counterRisk 0.25 (+0.08/prestige), trustStart 50, trustPromised 10, goodRating 7.5, badRating 5, trustGood 3, trustBad 2, rotationGap 6, rotationShare 0.4, trustBenchWeek 1, trustRequestCost 10, formLineup 1, trustLineup 2, renewalWeek 23, renewTrust 40, renewalRaise 0.15.
No existing value changed; BALANCE_VERSION untouched.

## Measured

- Manager identity (`PROSPINE_ID=1`, NA Normal, seed 4242, 3 seasons): same sha256 before and after the hook, flags off and all staging flags on, observer on or off.
- `P1_SOFT=1` NA,SAM, 4 seasons, both policies: 0 findings.
- Pro bot (`PRO_BOT=1`, NA/EU/SAM × Normal/Hard, 5 seasons): no throw, no stuck day, never two rosters; first org at 15-16 in all six; overall about 55/63/70/75/78 at 13-17.

## Not verified

- No browser check (dev servers not allowed): screens only server-render in a test; phone layout unchecked.
- Peak calibration, Hard vs Normal, the "80 on a 90 org" feel (formula only).
- The week planner stops at a matchday without saying why.
- pro-engine's `weekFlow.playProWeek` is now used only by its test.

## For Miguel

1. Org series are watched, not played step by step, until slice 5.
2. NA's weakest starters sit near 80: a 15-year-old signs as rotation and plays rotation weeks. Faster growth or weaker first suitors?
3. An org that leaves the historical dataset makes him a free agent.
