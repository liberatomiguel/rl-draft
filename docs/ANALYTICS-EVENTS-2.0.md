# Analytics events for 2.0 — the contract

> Status: **approved by Miguel on 2026-11-11 and built** (session A1, branch
> `v2/A1`). This replaces the rc.32 catalogue (OBS-01, DESIGN-DECISIONS #145),
> which never reached production. The catalogue itself is code:
> `src/lib/analyticsCatalog.ts`. This page explains it. Production only: nothing
> is sent from staging, playtest, a local preview, dev or tests. The operational
> PostHog guide (PT) is `ANALYTICS.md`; its insight recipes still describe the
> 1.x events and need a rewrite after launch.

## Why it changed

PostHog bills **per event, not per property**, and the plan allows **1 million
events per month** (per month, not per day). Measured on the 30 days before the
launch (PostHog EU, 12 Oct to 11 Nov 2026):

| Measure | Value |
|---|---|
| Events | 172,028 over 1,349 player-days (a person on a day) |
| Events per player-day | mean 127, median 31, p90 332, p99 1,307, max 3,237 |
| Concentration | 22% of player-days produce 80% of the events |
| `run_started` | 54,482, of which 25,672 (47%) are restarts |
| `run_abandoned` | 30,294: 25,672 restarts, 4,622 real exits |
| `$pageview` | 14.4 per player-day, over only 3.0 distinct routes |

At that rate 800 players a day would send about 3 million events a month. The
2.0 design sends about **40 per player-day on average** (about 15 for the
median player) and adds a guard for peaks.

## Rules

- One SDK, **production only**: a production build (no `NEXT_PUBLIC_NOINDEX`,
  no `NEXT_PUBLIC_PLAYTEST`) running on `rocketdraft.app`. Anywhere else the SDK
  is never downloaded and `trackEvent` drops everything.
- Cookieless, lazy, queued until the SDK loads; a failure never touches gameplay.
- **Few events, many properties.** One event per run, per tournament, per
  season. Nothing per pick, per reroll, per run start, per day advanced.
- Scalars only. **No PII and no free text**: never a manager, org or player
  name, an e-mail, a username or a raw save. Ids are random and anonymous.
- Fired from the **store** (or the analytics layer), at the action that wrote
  the state, once. Never from `src/engine`, never from a render.
- No autocapture, no session replay, no SDK pageview capture.
- **The catalogue is enforced.** Under Vitest, `trackEvent` throws when an
  event is not in the catalogue, a required property is missing or null, a type
  is wrong, or a property is not listed. So any test that drives a store action
  fails on a bad payload. `analyticsCatalog.test.ts` also scans the source for
  event names outside the catalogue.

## Common properties (sent with every event and with `$pageview`)

| Property | Value |
|---|---|
| `release` | `package.json` version |
| `balanceVersion` | `BALANCE_VERSION` |
| `schemaVersion` | `2` (the 2.0 catalogue) |
| `season` | `SEASON.id` (1 = Season 1) |
| `environment` | `production` (the only value that can be sent) |
| `locale` | `en` or `pt` |
| `gameMode` | `draft`, `career` or `app` (sessions, the entry funnel, accounts, screen errors, pageviews) |
| `sampleWeight` | How many real events this one stands for (1 = nothing was dropped) |
| `sampleBucket` | The device's fixed 0–99 sample bucket |

**Separating pre-season data from 2.0 data:** the 1.x production build sent
none of these. In PostHog, filter `schemaVersion = 2` (or `season = 1`, or
"`release` is set") to see only 2.0; "`schemaVersion` is not set" is the
pre-season series.

**Counting under sampling:** use *sum of `sampleWeight`* instead of *total
count* for volumes. It equals the count while the guard is at level 0.

## The catalogue

Priority: **critical** events are never sampled or capped; **standard** events
are the volume, thinned first by the guard. "?" marks an optional property.

### Draft, challenges, quiz, collection

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `run_completed` | standard | A run reaches its results screen (after every grant landed) | `runId`, `mode`, `difficulty`, `region`, `placement`, `won`, `hiddenOverall`, `teamOverall`, `swissWins`, `swissLosses`, `playoffWins`, `gameWins`, `goalsFor`, `goalsAgainst`, `eliminatedStage?`, `xpGained`, `chemistryTier`, `chemistryPercent`, `durationSec?`, `dailyTemplate?`, `resets`, `rerollsLeft`, `picks`, `specials`, `specialsCount`, `specialsNew`, `achievementsNew`, `ratingDelta`, `ratingAfter`, `rankId`, `rankUp` |
| `run_abandoned` | standard | A run is left for good before its results (never for a restart, never for a challenge that was already played) | `runId`, `mode`, `difficulty`, `region`, `hiddenOverall`, `phase`, `reason` (`quit`), `resets`, `picksMade`, `durationSec?` |
| `challenge_played` | standard | A challenge attempt is evaluated | `challengeId`, `difficulty`, `kind` (`boss`, `gauntlet`, `draft`), `cleared`, `stars`, `starsNew`, `firstClear`, `resets`, `rerollsUsed`, `teamOverall`, `chemistryPercent`, `picks`, `specials`, `xpGained` |
| `quiz_played` | standard | The daily quiz ends (solved or out of guesses) | `solved`, `attempts`, `maxAttempts`, `score`, `xp`, `streak` (clues shown = `attempts − 1`) |
| `special_discovered` | standard | A special card enters the collection, once per card | `specialId`, `rarity`, `national`, `mode` |
| `collection_milestone` | critical | A national team is first seen (`national_team_found`) or its album is completed (`album_completed`) | `kind`, `id` (the lineup), `albumsCompleted?` |

- `picks` is the roster in slot order, `p1:<cardId>|p2:…|p3:…|sub:…|coach:…|org:…`.
  `specials` is the fielded special ids joined by `|`. In PostHog, filter with
  "contains"; for a per-card ranking use HogQL
  `arrayJoin(splitByChar('|', properties.specials))`.
- `resets` counts the restarts before this run in the same sitting.
- The daily challenge is `run_completed` with `mode = daily` and `dailyTemplate`.

### Progression

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `mission_completed` | standard | A mission is completed, or the "all missions" bonus of a period | `id`, `period`, `tier?`, `xp`, `bonus` |
| `achievement_unlocked` | standard | An achievement is earned, once per id | `id` |
| `rank_up` | critical | The profile's XP crosses a rank | `rankId`, `rankIndex`, `xp` |
| `unlock_granted` | standard | A cosmetic becomes owned (`cosmetic`), four or more at once (`cosmetic_batch`, id `batch`), or Legacy opens (`mode`) | `kind`, `id`, `count` |

Rank-ups, achievements and unlocks are read off the profile write
(`src/store/profileAnalytics.ts`), whoever granted the XP: a run, the quiz, a
mission, the login calendar, a challenge or the career. A hydrate, a cloud merge
and the staff preview are silent. Login streak and equipped cosmetics are
properties of `session_started`, not events.

### Entry funnel and sessions

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `session_started` | critical | The first activity of a visit, or after 30 idle minutes | `sessionNumber`, `dayNumber`, `daysSinceFirst`, `daysSinceLast?`, `existingPlayer?`, `entryPath`, `signedIn?`, `loginStreak?`, `xp?`, `rankId?`, `rating?`, `runsCompleted?`, `specialsOwned?`, `achievements?`, `challengesCleared?`, `quizPlayed?`, `careerMarks?`, `equippedTitle?`, `equippedBanner?`, `equippedBadge?`, `openRunPhase?` |
| `onboarding_step` | critical | A first on this device, once ever per step | `step`, `sessionNumber`, `dayNumber`, `secondsSinceFirstSeen` |
| `$pageview` | standard | The **first** visit to each route in a session | PostHog's own, plus the common properties |

- Steps: `draft_started`, `draft_confirmed`, `run_completed`,
  `challenge_played`, `quiz_played`, `career_created`, `career_first_event`.
- The launch funnel: `session_started` (`sessionNumber = 1`) →
  `onboarding_step` (`draft_started`) → `onboarding_step` (`run_completed`) →
  `session_started` (`sessionNumber = 2`).
- `existingPlayer = true` marks a profile that already had progress when the
  device was first counted (every pre-2.0 player on launch day). Those players
  never send the steps their profile had already done. Filter
  `existingPlayer = false` for the new-player funnel.
- `sessionNumber` and `dayNumber` count from the 2.0 launch on this device.

### Road to Worlds

`careerId` is the random id stored in the save; `actionId` =
`careerId:seasonIndex:day:kind:ref` (sent at most once per session).

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `career_created` | critical | The wizard founds a career | `region`, `difficulty`, `rosterKey`, `startOverall`, `startBalance`, `slot?` |
| `career_event_completed` | standard | **One per tournament** the user played | `seasonIndex`, `week`, `tier`, `eventRegion`, `placement`, `qualified?`, `qualifierPlacement?`, `watched`, `seedingDirect?`, `briefing?`, `squadOverall`, `balance`, `tab_<tab>?` × 10, `advanceCount?`, `advanceMaxMs?`, `advanceSlowCount?` |
| `career_split_summary` | critical | The Monday that closes a split (3 per season) | `seasonIndex`, `split`, `balance`, `payrollPerSplit`, `incomePrize`, `incomeSponsor`, `incomeFanbase`, `incomeTransfers`, `spendWages`, `spendTransfers`, `spendOther`, `debtBacker`, `debtBank`, `splitRank?`, `ledgerComplete`, `squadOverall`, `squadSize`, `coachOverall?`, `sponsorTier?`, `trainingMode?`, `staffCount`, `rep` |
| `career_season_completed` | critical | The season review is written | `seasonIndex`, `region`, `difficulty`, `regionRank`, `seasonPoints`, `majorsQualified`, `worldsPlacement?`, `grade`, `earnings`, `balance`, `rep`, `titlesSeason`, `titlesTotal`, `titlesWorlds`, `squadOverall`, `squadSize`, `squadAvgAge`, `payrollPerSplit`, `coachOverall?`, `sponsorTier?`, `sponsorProfile?`, `trainingMode?`, `staffCount`, `debtBacker`, `debtBank` |
| `career_transfer` | critical | Sign, sell, release, renew | `seasonIndex`, `kind`, `overall`, `age`, `potentialBandMid`, `fee`, `salaryPerSplit`, `role`, `warned` |
| `career_staff` | critical | `coach_hired`, `coach_fired`, `coach_renewed`, `sponsor_signed`, `staff_on`, `staff_off` | `seasonIndex`, `kind`, `overall?`, `salaryPerSplit?`, `tier?`, `basePerSplit?`, `objectiveKind?`, `profile?`, `staffId?` |
| `career_milestone` | critical | `first_title`, `first_major`, `first_worlds`, `worlds_title`, `backer` (each rescue), `bank_loan` | `seasonIndex`, `kind`, `amount?` |
| `career_ended` | critical | The career closes | `seasonIndex`, `reason` (`worlds_won`, `timeline_complete`, `insolvency`, `retired`), `legacyGrade?`, `titles`, `titlesWorlds`, `balance`, `rep` |

- **A regional weekend is one tournament.** A Saturday qualifier the team got
  through is not reported alone: it rides on Sunday's regional
  (`qualified = true`, `qualifierPlacement`). A qualifier the team fell in is
  the weekend's event (`tier = qualifier`, `qualified = false`).
- **Tab usage** is not an event. Every visit to a career tab (`hq`, `club`,
  `squad`, `market`, `training`, `finances`, `calendar`, `standings`, `news`,
  `season`) is counted on the device and sent as `tab_<tab>` on the next
  `career_event_completed`, then reset. So the counters are "visits since the
  previous tournament".
- **Slow day advances** ride the same way (`advanceCount`, `advanceMaxMs`,
  `advanceSlowCount`); a single advance over the threshold also sends
  `quality_slow_advance`.
- Spending in the split summary is reported positive: wages (squad and coach),
  the market (fees, signing bonuses, severance, stand-ins) and everything else.
  Debt service is not spending; it shows as the debt going down.
- `potentialBandMid` is the midpoint of the band the screens show, never the
  hidden potential.

### Accounts and health

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `account_signed_in` | critical | A sign-in completes in this tab (not a restored session) | `hadLocalProgress` |
| `account_sync_failed` | critical | A cloud sync aborts, once per session and stage | `stage` (`read`, `push`) |
| `quality_save_error` | critical | A persisted store fails to save or load | `store`, `kind` (`quota`, `parse`, `migrate`, `write`) |
| `quality_migration` | critical | A save is upgraded to a newer shape | `store`, `fromVersion`, `toVersion` |
| `quality_duplicate_reward` | critical | A grant is refused as already given | `kind`, `id` |
| `quality_error` | critical | A screen error: the error boundary, an uncaught error, an unhandled rejection. At most 3 distinct per page load | `source`, `name`, `route`, `message` |
| `quality_slow_advance` | critical | A day advance over 1.5 s, or an advance-to-next-stop over 5 s. Once per session and kind | `kind`, `ms` |
| `quality_event_cap` | critical | The guard starts dropping this device's events today | `kind` (`cap`, `breaker`), `level` |

`quality_error.message` is the error's own message with quoted text, URLs and
long numbers removed (a JSON parse error quotes the data it choked on, which
could be a name the player typed), cut to 120 characters.

## What left the catalogue

| Removed | Where the information is now |
|---|---|
| `run_started` | `run_completed` / `run_abandoned`; first-time starts in `onboarding_step` |
| `tournament_started` | `run_abandoned.phase`; first time in `onboarding_step` (`draft_confirmed`) |
| `special_used` (one per card) | `run_completed.specials`, `specialsCount`, `specialsNew` |
| `run_abandoned` with `reason = restart` | `resets` on the run's event |
| `ux_tutorial`, `ux_unlock_seen`, `ux_contract_warning`, `ux_sunday_briefing` | Cut. Tutorials: Miguel, 11/11. A warned contract is `career_transfer.warned`; the briefing is `career_event_completed.briefing` |
| `career_scout_report` | Cut (no per-report event) |
| `career_training_plan` | Was reserved and never built; `trainingMode` is in the summaries |
| `career_milestone` kind `insolvency` | `career_ended` (`reason = insolvency`) |

### Breaks in the historical series

Production (v1.4.8) only ever sent `run_started`, `run_abandoned`,
`tournament_started`, `run_completed`, `special_used`, `challenge_played` and
`$pageview`. At the 2.0 deploy:

- `run_started`, `tournament_started` and `special_used` stop. Any saved
  insight on them goes flat.
- `run_abandoned` drops by about 85%: only real exits remain.
- `$pageview` totals drop by about 75% (once per route per session). Unique
  visitors and sessions per page stay comparable; views per page do not.
- `run_completed` and `challenge_played` continue unbroken, with more
  properties.
- A run left open in a closed tab sends nothing until the player comes back and
  finishes or leaves it. The exact start-to-finish rate of all runs is gone; the
  first-time funnel covers new players.

Add a PostHog annotation on the launch day.

## Budget

Estimated events per player-day, everything sent. Draft numbers are measured;
career numbers are an **estimate** with no production data (35% of player-days
in the career, 0.75 season a day, about 30 events a season). Re-measure 48 hours
after launch.

| Event | Per player-day | Monthly at 100 / 500 / 1,000 / 2,000 players a day (thousands) |
|---|---|---|
| `run_completed` | 17.2 | 52 / 258 / 516 / 1,032 |
| `run_abandoned` | 2.7 | 8 / 41 / 81 / 162 |
| `challenge_played` | 1.4 | 4 / 21 / 42 / 84 |
| `quiz_played` | 0.4 | 1 / 6 / 12 / 24 |
| `special_discovered` | 0.8 | 2 / 12 / 24 / 48 |
| `mission_completed` | 1.0 | 3 / 15 / 30 / 60 |
| `achievement_unlocked`, `rank_up`, `unlock_granted`, `collection_milestone` | 0.8 | 2 / 12 / 24 / 48 |
| `session_started` | 1.6 | 5 / 24 / 48 / 96 |
| `onboarding_step` | 1.0 | 3 / 15 / 30 / 60 |
| `$pageview` | 5.0 | 15 / 75 / 150 / 300 |
| `career_event_completed` | 4.5 | 14 / 68 / 135 / 270 |
| `career_split_summary`, `career_season_completed` | 1.1 | 3 / 16 / 32 / 64 |
| `career_transfer`, `career_staff`, `career_milestone`, `career_created`, `career_ended` | 2.3 | 7 / 35 / 69 / 138 |
| accounts and health | 0.15 | 0 / 2 / 5 / 9 |
| **Total** | **about 40** | **120 / 600 / 1,200 / 2,400** |

### The guard (`src/lib/analyticsBudget.ts`)

A static site cannot know how many people are playing, so the guard has one
input that someone keeps up to date: **`playersPerDay`** in
`public/analytics-budget.json` (or `NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY` at
build). Edit the number, deploy. The file is a static asset: no Worker request.
A missing or broken file leaves the build's value.

| Level | Players a day | What changes | Monthly total at the level's top |
|---|---|---|---|
| 0 | up to 699 | Everything is sent | about 840k |
| 1 | 700 to 999 | Per device and UTC day: 30 standard events in full, then 1 in 4 | about 930k |
| 2 | 1,000 to 1,399 | 15 in full, then 1 in 8; `$pageview` from half of the devices | about 945k |
| 3 | 1,400 to 2,499 | Also: half of the devices send standard events | about 955k |
| 4 | 2,500 and up | A quarter of the devices | 1M at about 4,200 |

- Past the cap, each standard event is sent with probability 1 in N and
  carries `sampleWeight = N`. Random, not "every Nth", so sums of
  `sampleWeight` are unbiased.
- Device and per-event sampling use the device's fixed bucket, so a device is
  in or out for a whole event type and funnels stay coherent inside the sample.
  To build a funnel across sampled events, add `sampleBucket < 50` (or `< 25`)
  to every step.
- Critical events are never sampled or capped.
- **Always on, at any level:** the circuit breaker stops a device at 400 events
  in a UTC day (the new design's 99th percentile is about 220). It exists for a
  loop or a bot, and reports itself once (`quality_event_cap`, `breaker`).
- The file may also carry its own ladder (`levels`: `minPlayers`, `dailyCap`,
  `thinTo`, `deviceRate`, `eventRates` by event name) and `breakerPerDay`.
- Launch setting: level 0 (`playersPerDay: 120`). A 10× spike for one week costs
  about 260k events, inside the month. Review the number 48 hours after launch
  and weekly after that.

## Device state

The analytics layer keeps one small record in `localStorage` on
`rocketdraft.app`, key `rd-analytics:v1`: the sample bucket, the session and day
counters, the funnel steps already sent, today's budget counters, the reset
counter of the open run and the career tab counters. It is **not a save**: the
game never reads it, it holds nothing personal, and deleting it only restarts
the counters. It is separate from the four persisted stores, whose keys and
versions are unchanged (`persistContract.test.ts`).

## Where each event fires

| Event | Fires in |
|---|---|
| `run_completed`, `run_abandoned`, `challenge_played`, album `collection_milestone` | `runStore` (`finishRun`, `clearRun`, `playChallenge`); `restartRun` only counts a reset |
| `special_discovered`, `mission_completed`, `quiz_played`, national-team `collection_milestone`, `quality_duplicate_reward` | `profileStore` actions |
| `rank_up`, `achievement_unlocked`, `unlock_granted` | `profileStore`'s subscription, built by `profileAnalytics.ts` |
| `session_started`, `onboarding_step`, `$pageview`, `quality_error`, `quality_slow_advance`, `quality_event_cap` | `lib/analytics.ts` (sessions and pageviews from `PostHogProvider`; the boundary error from `app/error.tsx`) |
| `career_*` | `careerStore`, read off the write by `careerAnalytics.ts` (a reload cannot fire one) |
| `account_signed_in`, `account_sync_failed` | `accountStore` |
| `quality_save_error`, `quality_migration` | `store/persistStorage.ts` |

Tests: `src/lib/analytics.test.ts`, `analyticsCatalog.test.ts`,
`analyticsBudget.test.ts`, `src/store/draftAnalytics.test.ts`,
`src/store/careerAnalytics.test.ts`.
