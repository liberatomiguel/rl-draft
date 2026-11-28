# MATCHDAY handoff (rc.9)

## What changed
- `event/SeriesRoom.tsx`: plan (matchup with crests and ratings, three directives, coach's call preselected, trade-off per directive), live games back to back with no stop, Timeout button always in the controls (called for the next break, can be taken back, then "used"), end (series score, a chip per game, the plan line, player rows). Phone: plan buttons and live controls docked.
- `components/match/LiveGameView.tsx`: broadcast board, clock, 5:00 track with goal ticks, goals on their side, team comparison rows with proportional bars, player tables per team.
- Engine: `matchday.ts` (`markRightCost` −0.08, `markValue`, `markWorthIt`, `userLog`), `matchdaySeries.ts` (`playUserNext`, `planReport`; a 0 timeout cut is now logged), `matchTimeline.ts` (R241). Flow/store: `playUserSeriesNextFlow`, `setMatchdayLevelFlow`.
- `EventScreen.tsx`: no replay after Continue (fix), knockout title fix, `EventStatsCard`.
- Training: `MatchdayModeSetting` (3 levels, BETA, `aria-pressed`), one marked line.
- Copy: seriesDesk, club.matchdayMode, event, scrim, NARRATION (PT). Decisions R240-R247 (R248-R249 unused), #233-#239, CHANGELOG.

## Measured
- Clicks per Bo5: Manage 2 (Play the series, Continue), skip 1 (Skip to the result); Watch and Result only 0 (no stop). Baseline 5 to 7.
- Tests: tsc clean in my files (one error in `SquadScreen.tsx`, DS's). 21 files / 172 tests green, incl. the new `careerMatchday.rc9.test.ts` (watched = skipped = skipped after one = quick mode; reload between games; timeout logged; R241 cut series = full series), `duelMatch`, flag-off tests, persist contract (alone; it failed to load once under load).
- `matchday.test.ts`: the right mark now costs `markRightCost`, inside `planCap` ±0.4 (§7).
- Shots in `.claude/rc9/shots/matchday/`. Keyboard: Play the series by Enter; Continue is focused at the end and Enter works; Timeout toggles with `aria-pressed`.

## LiveGameView contract (for the duel)
`timeline: GameTimeline`, `sides: {a,b}: {name, players[], mark?, tone?: "blue"|"orange", own?}`, `finals?: {a,b}: LiveLine[]` (box score lines; without it goals only), `labels: LiveLabels`, `context?`, `speed`, `paused`, `skip`, `onEnd`. Imports only `MATCH_LIVE` and the timeline types.

## Not verified
- No "between games" screen exists any more (by Miguel's call); a final-whistle shot stands in. No plan shot at 320.
- Reduced motion checked by code only (`jump` shows the finished game).
- Live pacing in the browser was disturbed by dev hot reloads (a remount counts played games as seen); not reproducible in a build, not measured.
- No balance battery for the 0.08 mark.
