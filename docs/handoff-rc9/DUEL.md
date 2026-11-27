# DUEL front handoff (engine, wave 1)

Branch `rc9/duel`. Decisions #225-#229 in DESIGN-DECISIONS, CHANGELOG entry under `## rc.9 (unreleased)`.

## What changed
New: `src/engine/duelRules.ts` (rules, seeds, `DUEL_GRANTS`), `duelDraft.ts`, `duelMatch.ts`, `duelLink.ts`, `duelViews.ts`, `duelTestKit.ts` (tests only) and four test files. `DUEL_MATCH` block in `balance.ts` (the existing `DUEL` stays for the special table). Copy group `DUEL_MATCH_UI` (EN/PT, marked `// rc9 duel`). Old `engine/duel.ts`, its test and its screens are untouched and deprecated: `tsc` is green, nothing breaks until wave 2 removes them.

## API for the screens
- `makeDuelRules({mode, rerolls 0|3|7, showOverall, region}, seed)`; region/pool/special table as the old duel (Diamond table, no national teams, profile-free). Difficulty is no longer a rule.
- Draft: `startDuelDraft`, `duelPick`, `duelReroll`, `duelTeamFromRoster` (a `DuelDraft` is plain JSON; the run store is not needed).
- Link: `makeDuelChallenge`, `makeDuelReply`, `encodeDuelCode`, `parseDuelCode` (errors missing/malformed/tampered/unsupported), `readDuelHash`, `duelCodePath`, `duelRematch(reply, asker)`, `isKnownDuelTeam` (add "unknownCards").
- Match: `playDuel(rules, teamA, teamB)` (A = challenger): score, winner, per game final/after/timeline/box/team and running stats.
- Views (`duelViews.ts`): `duelRulesTags`/`duelRulesLine` (the rules in words), `duelScoreline`, `duelWinner`/`duelWinnerLine`, `duelGameRows`, `duelGameTimeline` (rows with clock label, scorer, running score, golden goal), `formatDuelClock`, `duelSideLabel`, `duelErrorText`, `duelBestOfLabel`.

## Measured
33 new tests pass (draft, match, link, views, exhibition guard). Boards coincide across three different reroll paths; swapping A and B mirrors goals, minutes, scorers and stats exactly; equal teams win 42-58% of 500 seeds. Link sizes: typical reply 330 chars (max 364 of 11), worst case from the longest ids 1146, ceiling 1600. `playDuel` ~1 ms. Series over 300 seeds averaged 4.8 games, 17% overtime games.

## Existing duel pieces that break when wave 2 switches over
`src/app/duel/*`, `src/components/duel/*`, `store/duelStore.ts`, `runStore.startDuel`/`run.duel`/`RunState.duel` (types.ts imports `DuelLink` from `duel.ts`), `lib/share/runShare.ts`, `SetupScreen`, `FriendsSection`, `RunShareSheet`, `analyticsCatalog` (friend_duel). Delete or rewire them together with `engine/duel.ts`.

## Depends on (engine functions called, not edited)
`simulateSeries` and `SeriesOptions` (match.ts); `buildUserTeam` (teams.ts); `createDraft`, `drawNextOffer`, `applyPick`, `filledCount` (draft.ts); `buildGameTimeline`; `buildSeriesBoxScore`; `deriveSeed`; `displayTeamOverall`. The upset change in the series engine will move results but not determinism or the mirror property (test will say).

## Not verified
Full suite, lint, build; `balanceVersion.test.ts` fails as expected (new export). Screens untested. Overall hiding is only a flag (`rules.showOverall`): the screens must honour it. A lineup can recur across slots (no without-replacement across slots, by design). Heavy lock was held for the runs.

## For Miguel
Typed names are optional and unverified (anyone can type anything). Rematch has no stored record.
