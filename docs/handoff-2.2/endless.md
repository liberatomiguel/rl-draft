# v2.2 ENDLESS: the infinite seasons once a team dominates

Branch `v22/endless` (from staging rc.6). Flag `FEATURES.endlessVariety` (staging only; probes `NEXT_PUBLIC_ENDLESS_VARIETY=1`). Engine `engine/career/endless.ts`, store `store/endlessFlow.ts`, numbers `CAREER_ENDLESS`. A save gets the front from its next rollover (`save.endless`, optional). Flag off: three seasons hash like rc.6 byte for byte (`endlessFlagOff.test.ts`, NA and SAM).

## Diagnosis (step 0)

Probe `careerEndless.probe.test.ts` (`ENDLESS_PROBE=1`, every staging flag on), bot `strong`, Normal, NA/EU/SAM × 2 seeds, 14 seasons (6 careers an arm). The bot tops out near 96, so two arms raise every squad player to an overall floor from S6 (97 or 99, a human who trains past the bot): team 100.3 to 101.2.

- **A 100+ team is untouchable.** Worlds 40 of 40, Majors 70 of 71, series won 97 to 99 %, 0.2 to 0.6 AI sides within 3 points at its Majors/Worlds.
- **The AI cannot build an answer.** The world's best side holds at 97 to 98 every season. Re-staffing the best org with the world's three best AI players reaches only 98 to 99 (`superWorld`): concentration alone cannot reach a 101 team.
- **Saturday cups repeat because the field is fixed.** The Invitational fields the user plus the region's top 7 by Season Points, seeded by rating (`fieldForEvent`, `initFieldTournament` "single"): 2.3 distinct semi-final opponents a season over ~12 cups; the most frequent one is 70 % of them.
- **Season N and N+1 differ only by the event-name rotation** (`nameRotationOf`); calendar, slots, formats and fields are the same every year.

## What shipped

- **Rival projects (R-ENDLESS-1).** At each endless rollover (from S7, `fromSeasonIndex`) the dominance gap is measured as the matches read it: leader minus the next three sides' mean. 1.5 or more starts one project, +1 per 0.75 (max 5); an AI leader needs 3. The leader's region answers first, then a seeded order of NA/EU/SAM/MENA/OCE. The project org (one of the region's best 4, not the leader, not a recent project) signs up to 3 players who beat its weakest starter by 1 overall, as swaps; from a gap of 2 it signs worldwide. Level 2+ also takes the region's best AI coach and opens a performance centre: the user's own `perfCenter` bonus (1.5) for 2 seasons. News `endlessProject` names the signings and the rating before and after.
- **Cups (R-ENDLESS-2).** The Invitational keeps the points top 2 and draws 5 from places 3 to 12 per event. The bracket keeps seeds 1 and 2 apart and draws 3-4 and 5-8. One helper serves the engine and the lobby. Partner cups keep their week and art.
- **Legends Invitational (R-ENDLESS-3).** 2 open weeks per endless season, starters' average 93+: 7 of the 18 best all-time lineups (distinct orgs), each player on his roster's own special card, no difficulty shift. Field 98 average. t2 prize and reputation, no points. Crests use the era logo.
- **Intercontinental Invitational (R-ENDLESS-4).** 2 more weeks: guests drawn from the other regions' top 2.
- **Season hosts (R-ENDLESS-5).** Four distinct cities per endless season (copy list), announced at the rollover (`endlessHosts`). Event names are not renamed (see below).

## Before / after (Normal, 6 careers an arm, S6+ unless noted)

TABLE

## Step 3, honestly

Per-season circuit formats are not feasible now. `SCHEDULE` is a module constant. `CAREER_SLOTS` is read directly by `careerResults`, `raceTable` (cut lines), `sponsorDeals` (Major chances), `calendar.REGION_ORDER`, Standings and the Wizard. Major names come from `officialEventDefsForWeek`, which has no save: renaming a Major per save would split the Calendar, Standings and forecast. Slots that follow last season's results need one `slotsFor(save, kind)` accessor threaded through those six readers first. That is the next slice, not shipped. Bracket alternatives: a single-elim Major playoff drops the top6 rows of the prize and points tables, so it is not shipped either.

## Not done / not verified

- Step 4 (upsets) not started. (c) poaching not built.
- Hard measured on one arm only (see table); Easy not measured.
- The 45 to 60 % Worlds target for a 100+ team is **not reached** (see table). No rating is created, so the ceiling is the best AI trio plus a centre, about 100.
- The flag-off hashes pin rc.6. After the merge, refresh them on the merged base with the flag off (`ENDLESS_PRINT_BASE=1`).
- No screen test in a browser. The Legends note and crest are a two-line edit in EventScreen / OrgMark.

## Miguel decides

1. Is 75 to 90 % for a 101 team acceptable? Going lower needs a rating lever (e.g. lifting a project's Normal handicap of −1.6), which the brief rules out.
2. The project performance centre (+1.5 on the user's own item): keep it, or keep projects to signings and coaches only?
3. Legends: no difficulty shift on Easy too?
