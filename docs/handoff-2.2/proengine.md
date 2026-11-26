# PROENGINE handoff (branch v22/pro-engine)

## What shipped
- **Slice 2 (week + ranked)**: `pro/week.ts` (applyBlock, applyWeekPlan, closeWeek, coachPlanFor, repeatPlanFor, previewBlock/previewWeek), `pro/ranked.ts` (playRankedSession, rankOf, cupsUnlocked, skillMmrFor, winChance), `pro/form.ts` (confidence from the last 5 ratings), `growth.applyMatchXp`, `pro/weekFlow.ts` (applyWeekToSave, nextWeekClock, rolloverProPlayer, playProWeek), `proStore.playWeek`. Screens: `ProWeekScreen` (route `/career/pro/week`), `ProRankedPanel`, `ProGrowthLog`; copy group `proWeek`.
- **Slice 5 (moments)**: `pro/mechanics.ts`, `pro/moments.ts` (buildDecision, resolveDecision, finalProRating), presentational `ProDecisionCard`; copy `proMoments`.
- **Slice 6 (end + card)**: `pro/aging.ts`, `pro/retire.ts`, `pro/card.ts`, page `/career/pro/card#<payload>` (`ProCardScreen`); copy `proCard`.
- Optional `ProPlayer` fields (slice-1 saves load): lastPlan, rankedLog, rankedSessions, recentRatings, burnout, mechanicsBlocks, chemistry, peakOverall, seasonsWithoutContract. `ProGrowthEntry.source` gained ranked/scrim, plus `reason`.

## For the spine
Call `applyWeekToSave(save, plan, coachOverall)` per week, `rolloverProPlayer(save)` at a season rollover (aging, retirement by age, contract-less count, returns `check.offer`), `applyMatchXp` per official game, `buildDecision`/`resolveDecision` + `finalProRating` per game with `EMPTY_LEDGER` per series. `playProWeek` is only the store's stand-in. `cardFromSave(save, {orgs, titles, awards, bestRating, nickname})`: the world's honours are yours to hand over. `stage "freeAgent"` is what counts seasons without a contract.

## Decisions
- R-PROENGINE-1: burnout can only roll in a week that closes under 30 with the warning already up from an earlier week; warning shows when a week closes under 45.
- R-PROENGINE-2: a week gets +15 energy at close; train/ranked/rest holds the line, three trainings drain.
- R-PROENGINE-3: ranked = 6 games of ±10 MMR decided by the gap between the MMR his (form- and energy-adjusted) overall deserves and his MMR; Grand Champion sits at overall ~60.
- R-PROENGINE-5: "a year without a contract" OFFERS retirement, never forces it; age forces it at 32.
- R-PROENGINE-6: instinct pays zero expected value by scaling the hit and the miss (p·x = (1-p)·y), inside the bounds.
- R-PROENGINE-7: signature mechanics need blocks AND Mechanics, in order, never lost.
- R-PROENGINE-8: decline starts the season after a plateau year; experience holds 3 more years, clutch 2.
- R-PROENGINE-9: the card carries no legends; the page computes the all-time ranking (best card overall per real player) from the dataset on load.

## Tunables (balance.ts, new blocks only)
`CAREER_PRO_WEEK` (costs 20/15/15/10, rest +35, close +15, lowEnergy 30, warnBelow 45, burnout 0.3 + 0.02/pt for 1-2 weeks, confidence window 5, matchXp), `CAREER_PRO_RANKED` (6 games, step 10, spread 200, skillTable, tiers), `CAREER_PRO_MOMENTS` (mechanics table, bounds 0.5/1.0/1.5, chance and option tables), `CAREER_PRO_AGING` (grace 1, 0.5/0.8/1.1 + 12% a year, range 0.5-1.5, retire table, forced 32). No existing value changed; BALANCE_VERSION untouched.

## Measured
- Sensible Pro (coach's plan, 8 seeds): Grand Champion in 53-71 weeks, median 65 (age ~15); careless (content + ranked, no training) never in 400.
- Moments Monte-Carlo (thousands of seeds): bounds hold; instinct mean team |0.012|, rating |0.04|.
- Lifecycle bot (12 seasons, 5 seeds, generous: team + coach 85 + a regional series a week from GC): high talent managed 99.0 (target 96-99), average managed 98.9 (target 90-93), average careless 55 (target 82-86).

## The calibration gap (slice 1 growth, not retuned)
Growth is too fast: `CAREER_PRO.growth.perBlock` 0.7 drives an average managed Pro to 99. perBlock 0.3 gives high 94.5 / average 89.9, but then Grand Champion takes ~136 weeks, so `CAREER_PRO_RANKED.skillTable` must be lowered with it. The careless profile cannot reach 82-86 because content and an unplayed team give no attribute XP: the lever is a small passive weekly gain, or a share of XP from content and from ranked.

## Not verified
Screens and the canvas image never ran in a browser (no dev server); share sheet untested; PT copy not read by a native speaker; the soft-lock probe was not run (no manager flow touched); nothing integrated with the spine's flow yet.

## For Miguel
perBlock and the careless floor (above); whether the end-by-contract stays an offer; the card's honours depend on the gala and nicknames (slice 7).
