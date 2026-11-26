# PROENGINE handoff (branch v22/pro-engine)

## Round 1 (merged, 71ea066)
- Slice 2: `pro/week.ts`, `ranked.ts`, `form.ts`, `weekFlow.ts`, `growth.applyMatchXp`, `proStore.playWeek`; screens `ProWeekScreen` (`/career/pro/week`), `ProRankedPanel`, `ProGrowthLog`; copy `proWeek`.
- Slice 5: `mechanics.ts`, `moments.ts` (bounds 0.5 / 1.0 / 1.5, instinct EV zero, hint words), `ProDecisionCard`; copy `proMoments`.
- Slice 6: `aging.ts`, `retire.ts` (legend bridge), `card.ts`, page `/career/pro/card#<payload>`; copy `proCard`.
- Spine hooks: `applyWeekToSave`, `rolloverProPlayer` (aging, retire by age, `check.offer`), `applyMatchXp`, `buildDecision`/`resolveDecision`/`finalProRating`, `cardFromSave`. `stage "freeAgent"` counts seasons without a contract.

## Round 2
**Decision (a)**: a year without a contract stays an OFFER.

**Slice 7 pure parts**
- `gala.ts`: `galaAwards`, `galaForSeason(season, region, candidates)`, `honorsOf(awards, id, season)`. Awards: MVP, breakout, team of the season (3), most decisive. The spine supplies one `GalaCandidate` per player (overall, overall at season start, age, seasons as pro, team result 0-1, optional box-score `line`). Rules: MVP needs overall 70+; breakout needs age 20 or less, 2 seasons or less, +2 overall; most decisive needs a line with 10+ games and (series MVPs + deciding moments) per game of 0.3+, so with no line nobody gets it. The Pro (`pro:self`) is a normal candidate; `honorsOf` gives winner or nominee.
- `nickname.ts`: 12 nicknames from totals the save must keep (`saves`, `lanTitles`, `decidingWins`, `clutchGames`, `worldsTitles`, `seasonsAtOrg`, `assists`, `goals`, `demos`, `comebackWins`, `steadySeasons`, `prodigy`). `activeNickname(facts, current)` returns one; a worn one is kept unless a better-ranked one is earned. Store the id in `ProPlayer.nickname`; `cardFromSave` reads it.
- The card carries language-free keys (a nickname id, `mvp.world.2026` via `awardKey`); the card page translates them EN/PT. Copy: `proCard.gala`, `.nicknames`, `.nicknameWhy`.

**Growth recalibration** (permission (b)). Changed values, before to after:
`CAREER_PRO.growth.perBlock` 0.7 to 0.5; `ageBands` {17: 1, 20: 0.85, 23: 0.6} to {17: 1, 19: 0.3, 21: 0.1}; `beforePeak` 0.35 to 0.05; `afterPeak` 0.1 to 0.03; `gapExponent` 0.7 to 0.92; `gapFloor` 0.12 to 0.03; `talentRange` [0.85, 1.15] to [0.78, 1.25]; `CAREER_PRO_WEEK.matchXp.base` 0.5 to 1.0; `CAREER_PRO_RANKED.skillTable` rows 54/57/60/66 (1500/1950/2400/2800) to 53/55/57/66 (1500/2000/2400/2800). Unchanged: `gapRef`, coach values, scrim and ranked shares.

**Bot** (`lifecycleBot.ts`): regional weeks come from the real calendar for his region (9 a season), 3 series of 3 games each as an org, 2 cup series a week outside windows as an amateur, no majors. Amateur side from week 40 after Grand Champion, org at overall 72+ and age 15+. Careless = on a team, plays its series and scrims, own blocks on content, no rest.

| Profile (10 seeds) | Peak median [range] | Target |
|---|---|---|
| High talent (1.2), managed | 96.5 [94.6-97.6] | 96-99 |
| Average, managed | 92.8 [91.2-94.4] | 90-93 |
| Average, careless | 85.2 [83.5-86.3] | 82-86 |

Grand Champion 65 weeks [57-71]; overall at 16 80.4 [79.1-82.1]; org signing at week 102 [94-108]; peak seen at age 22 [21-24]. Coach 85 vs none moves the average peak by only 0.4 (92.8 vs 92.4); `coachMax` 0.2 is the lever if coaches should matter more. Bands are tests in `lifecycle.test.ts`; `pro.test.ts` "training alone" was rewritten (training alone is now a floor, about 72 for a median Pro, the series carry the rest).

## Not verified
Screens, canvas image and share sheet never ran in a browser. Gala and nickname inputs are untested against real world data (the spine must supply them). Calibration is on the pure modules with a bot, not the real flow. Soft-lock probe not run (no manager flow touched). `BALANCE_VERSION` untouched, so `balanceVersion.test.ts` still fails by design.

## For Miguel
Careless tops out near 85 only because match XP is generous; if series feel too rewarding, lower `matchXp.base` and raise `perBlock`. Nickname names and thresholds are a first pass.
