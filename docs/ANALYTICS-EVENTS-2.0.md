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

Priority (see "Budget"): **essential** events are never sampled or capped and
still go out past the circuit breaker; **critical** events are never sampled or
capped; **standard** events are the volume, thinned first by the guard. "?"
marks an optional property.

### Draft, challenges, quiz, collection

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `run_completed` | standard | A run reaches its results screen (after every grant landed) | `runId`, `mode`, `difficulty`, `region`, `placement`, `won`, `hiddenOverall`, `teamOverall`, `swissWins`, `swissLosses`, `playoffWins`, `gameWins`, `goalsFor`, `goalsAgainst`, `eliminatedStage?`, `xpGained`, `chemistryTier`, `chemistryPercent`, `durationSec?`, `dailyTemplate?`, `resets`, `rerollsLeft`, `picks`, `specials`, `specialsCount`, `specialsNew`, `achievementsNew`, `ratingDelta`, `ratingAfter`, `rankId`, `rankUp`; rc.9: `seriesWon`, `seriesLost`, `oppOverallAvg`, `lostToLowerBy5`, `lostToLowerBy8`, `lostToLowerBy10`, `worstLossGap?`, `endOppOverall?`, `endOppStrength?`, `endGap?`, `endScore?`, `endRound?` (see the note below) |
| `run_abandoned` | standard | A run is left for good before its results (never for a restart, never for a challenge that was already played) | `runId`, `mode`, `difficulty`, `region`, `hiddenOverall`, `phase`, `reason` (`quit`), `resets`, `picksMade`, `durationSec?` |
| `challenge_played` | standard | A challenge attempt is evaluated | `challengeId`, `difficulty`, `kind` (`boss`, `gauntlet`, `draft`), `cleared`, `stars`, `starsNew`, `firstClear`, `resets`, `rerollsUsed`, `teamOverall`, `chemistryPercent`, `picks`, `specials`, `xpGained` |
| `daily_insight` | standard | v2.1: a finished Daily's best-draft panel finished its analysis (`action` = `shown`, once per Daily) or its result line was shared (`shared`) | `action`, `dailyNumber`, `dailyTemplate`, `percentile` (vs simulated drafts), `percentileSource` (`simulated`), `gap` (rating points to the best draft), `matched`, `teamOverall`, `bestOverall`, `computeMs?` |
| `friend_duel` | standard | v2.1 friend duel: a link opened or refused, a duel run finished, a link shared | `action` (`opened`, `invalid`, `completed`, `shared`), `entries`, `mode`?, `difficulty`?, `region`?, `placement`?, `beat`?, `lost`?, `resets`?, `method`? (`native`, `copy`), `reason`? (`missing`, `malformed`, `tampered`, `unsupported`, `region`), `staleVersion`? |
| `content_shared` | critical | v2.2 share kit: one action taken in a share sheet | `surface` (`run`, `daily`, `duel`, `career`, `invite`), `channel` (`native`, `whatsapp`, `x`, `reddit`, `telegram`, `copyImage`, `copyText`, `download`), `format`? (`post`, `story`), `gameMode` |
| `quiz_played` | standard | The daily quiz ends (solved or out of guesses) | `solved`, `attempts`, `maxAttempts`, `score`, `xp`, `streak` (clues shown = `attempts − 1`) |
| `special_discovered` | standard | A special card enters the collection, once per card | `specialId`, `rarity`, `national`, `mode` |
| `collection_milestone` | critical | A national team is first seen (`national_team_found`) or its album is completed (`album_completed`) | `kind`, `id` (the lineup), `albumsCompleted?` |

- `picks` is the roster in slot order, `p1:<cardId>|p2:…|p3:…|sub:…|coach:…|org:…`.
  `specials` is the fielded special ids joined by `|`. In PostHog, filter with
  "contains"; for a per-card ranking use HogQL
  `arrayJoin(splitByChar('|', properties.specials))`.
- `resets` counts the restarts before this run in the same sitting.
- The daily challenge is `run_completed` with `mode = daily` and `dailyTemplate`.
- rc.9 (DESIGN-DECISIONS #224): `run_completed` carries the player's series,
  computed by `engine/runSeriesFacts.ts` from the finished tournament, no new
  event. A gap is the player's shown overall minus the rival's shown overall
  (`displayTeamOverall`, the number the screens print even when the run hid
  it). `endOppStrength` is the rating the rival that ended the run actually
  played at: the hidden difficulty shift and region lift included, the upset
  guard applied. `endOppStrength - endOppOverall` is the hidden part. "The run
  ended" = the last lost series that is not the third-place match.
  `lostToLowerBy8 > 0` is the "absurd loss" the rc.9 complaint names.

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
| `session_started` | critical | The first activity of a visit, or after 30 idle minutes | `sessionNumber`, `dayNumber`, `daysSinceFirst`, `daysSinceLast?`, `existingPlayer?`, `entryPath`, `signedIn?`, `loginStreak?`, `xp?`, `rankId?`, `rating?`, `runsCompleted?`, `specialsOwned?`, `achievements?`, `challengesCleared?`, `quizPlayed?`, `careerMarks?`, `equippedTitle?`, `equippedBanner?`, `equippedBadge?`, `openRunPhase?`, `lastCareerTab?` |
| `onboarding_step` | critical | A first on this device, once ever per step | `step`, `sessionNumber`, `dayNumber`, `secondsSinceFirstSeen` |
| `$pageview` | standard | The **first** visit to each route in a session. Since 2.1.0-dev.4 none for the career's inner screens: only `/career`, `/career/new` and `/career/saves` send one | PostHog's own, plus the common properties |

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
- `lastCareerTab` (2.1.0-dev.4) is the last career screen this device saw
  before the session began (`hq`, a tab key, or a sub-route such as `event`,
  `follow`, `saves`): where a player who stopped was standing.

### Road to Worlds

`careerId` is the random id stored in the save; `actionId` =
`careerId:seasonIndex:day:kind:ref` (sent at most once per session).

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `career_created` | essential | The wizard founds a career | `region`, `difficulty`, `rosterKey`, `startOverall`, `startBalance`, `slot?` |
| `career_event_completed` | essential | **One per tournament** the user played | `seasonIndex`, `week`, `tier`, `eventRegion`, `placement`, `qualified?`, `qualifierPlacement?`, `watched`, `seedingDirect?`, `briefing?`, `squadOverall`, `balance`, `tab_<tab>?` × 10, `advanceCount?`, `advanceMaxMs?`, `advanceSlowCount?`, `seriesWon?`, `seriesLost?`, `upsetWins?`, `upsetLosses?`, `oppOverallAvg?`, `liveSeries?`, `decisions?` |
| `career_split_summary` | essential | The Monday that closes a split (3 per season) | `seasonIndex`, `split`, `balance`, `payrollPerSplit`, `incomePrize`, `incomeSponsor`, `incomeFanbase`, `incomeTransfers`, `spendWages`, `spendTransfers`, `spendOther`, `debtBacker`, `debtBank`, `splitRank?`, `ledgerComplete`, `squadOverall`, `squadSize`, `coachOverall?`, `sponsorTier?`, `trainingMode?`, `staffCount`, `rep` |
| `career_season_completed` | essential | The season review is written | `seasonIndex`, `region`, `difficulty`, `regionRank`, `seasonPoints`, `majorsQualified`, `worldsPlacement?`, `grade`, `earnings`, `balance`, `rep`, `titlesSeason`, `titlesTotal`, `titlesWorlds`, `squadOverall`, `squadSize`, `squadAvgAge`, `payrollPerSplit`, `coachOverall?`, `sponsorTier?`, `sponsorProfile?`, `trainingMode?`, `staffCount`, `debtBacker`, `debtBank`, `realOrgsTop8?`, `formatId?` |
| `career_transfer` | critical | Sign, sell, release, renew, trade | `seasonIndex`, `kind`, `overall`, `age`, `potentialBandMid`, `fee`, `salaryPerSplit`, `role`, `warned`, `tradeSide?` |
| `career_staff` | critical | `coach_hired`, `coach_fired`, `coach_renewed`, `sponsor_signed`, `staff_on`, `staff_off` | `seasonIndex`, `kind`, `overall?`, `salaryPerSplit?`, `tier?`, `basePerSplit?`, `objectiveKind?`, `profile?`, `staffId?` |
| `career_milestone` | essential | `first_title`, `first_major`, `first_worlds`, `worlds_title`, `backer` (each rescue), `bank_loan` | `seasonIndex`, `kind`, `amount?` |
| `career_ended` | essential | The career closes | `seasonIndex`, `reason` (`worlds_won`, `timeline_complete`, `insolvency`, `retired`), `legacyGrade?`, `titles`, `titlesWorlds`, `balance`, `rep` |
| `career_action_refused` | essential | The career refused an action the player asked for (2.1.0-dev.4). Once per session and reason | `reason` (the store's error key: `blocked`, `actionFailed`, `funds`, `windowClosed`, `decisionPending`…), `screen` (`hq`, a tab, or a sub-route) |

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
- **Series (2.1.0-dev.4, Etapa 1 M7).** `seriesWon` / `seriesLost` count the
  user's series in the tournament (a regional weekend adds Saturday's
  qualifier). An **upset** is a series won as the underdog (`upsetWins`) or
  lost as the favourite (`upsetLosses`) by **5+ average player overall**
  (`ANALYTICS_UPSET_GAP`, the tournament's `avgPlayerOverall`).
  `oppOverallAvg` is the opponents' mean average player overall, one decimal.
  `finishEvent` notes the bracket before it is discarded; null when it was
  not seen. `liveSeries` and `decisions` are reserved for Matchday fatia 3
  and are null until it lands.
- **Mundo vivo (2.1.0-dev.4).** `realOrgsTop8` counts the real dataset orgs
  in the final top 8 of the user's region (the user, local sides and entrants
  excluded). `formatId` is reserved (null) until seasons have more than one
  format.
- **Trades (2.1.0-dev.4).** Saying yes to an agreed or countered trade sends
  two `career_transfer` with `kind = trade`: `tradeSide = out` (the user's
  player, fee 0) and `tradeSide = in` (the arriving player, fee = the cash the
  user added). Before 2.1.0-dev.4 a trade showed as `sell` + `sign`.

### Player research

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `research_invite` | critical | The research-form card opens, its link is clicked, or it is dismissed (`components/ResearchInvite.tsx`; a few per device per campaign) | `action` (`shown`, `opened`, `dismissed`), `surface` (`draft`, `career`; also `gameMode`), `campaign`, `activeDays`, `runsCompleted`, `careerSeasons` |

### Accounts and health

| Event | Priority | Fires | Properties |
|---|---|---|---|
| `account_signed_in` | essential | A sign-in completes in this tab (not a restored session) | `hadLocalProgress` |
| `account_sync_failed` | essential | A cloud sync aborts, once per session, stage and reason | `stage` (`read`, `push`), `reason` (`offline`, `network`, `auth`, `denied`, `conflict`, `server`, `rate`, `unavailable`, `other`; since 2.0.25), `code` (database / PostgREST code, when there is one) |
| `career_cloud_failed` | essential | A step of the career cloud save fails, once per session, stage and reason (2.0.26) | `stage` (`list`, `read`, `push`, `delete`, `load`), `reason` (as `account_sync_failed`), `code` |
| `career_cloud_conflict` | essential | The player answers the notice about two copies of a career (2.0.26) | `kind` (`diverged`, `different-career`, `cloud-deleted`), `choice` (`local`, `cloud`) |
| `quality_save_error` | essential | A persisted store fails to save or load | `store`, `kind` (`quota`, `parse`, `migrate`, `write`) |
| `quality_migration` | essential | A save is upgraded to a newer shape | `store`, `fromVersion`, `toVersion` |
| `quality_duplicate_reward` | essential | A grant is refused as already given | `kind`, `id` |
| `quality_error` | essential | A screen error: the error boundary, an uncaught error, an unhandled rejection. At most 3 distinct per page load | `source`, `name`, `route`, `message` |
| `quality_slow_advance` | essential | A day advance over 1.5 s, or an advance-to-next-stop over 5 s. Once per session and kind | `kind`, `ms` |
| `quality_event_cap` | essential | The guard starts dropping this device's events today | `kind` (`cap`, `breaker`, `ceiling` = the essential ceiling, since 2.1.0-dev.4), `level` |

`quality_error.message` is the error's own message with quoted text, URLs and
long numbers removed (a JSON parse error quotes the data it choked on, which
could be a name the player typed), cut to 120 characters.

Since 2.0.32, `source` = `heal` (name `AssetHeal`) means the page had build
files fail to load and the inline repair (`lib/assetHeal.ts`, DESIGN-DECISIONS
#171) fetched them again and reloaded the tab. It is sent once, on the load
after the repair; `message` is the reason (`status`: a 400+ answer, usually a
404 the browser had cached; `stalled`: the app never mounted, browsers without
`responseStatus`) and up to three chunk file names. Before 2.0.32 these players
sent nothing: the page hung before analytics loaded.

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

**The plan:** PostHog **free** tier, **1,000,000 events a month** (product
analytics; checked in billing on 20/11/2026, period 14/11 → 14/12). Rule
(Miguel, 20/11): never past the free tier; target **≤ 70%** (700k), the rest is
headroom for growth after v2.1.

### Measured (launch week, 14–19/11/2026, production, aggregates only)

About **357 devices and 26.5k events a day** (~74 per device-day), so
**~795k a month** (PostHog's own projection on 20/11: 785k). Top events over the
billing period so far:

| Event | Share | Note |
|---|---|---|
| `career_event_completed` | 33% | ~194 per capped device-day |
| `$pageview` | 14% | 65% of them are career routes; 2/3 of those inner screens |
| `run_completed` | 9% | the Classic Legacy rating farm |
| `career_transfer` | 6% | |
| `career_split_summary` | 4% | |
| `career_staff` | 3% | `sponsor_signed`, `staff_on/off`, coaches |
| `unlock_granted`, `special_discovered`, `achievement_unlocked` | 2% each | |
| `session_started` | 2% | |

**The breaker was the problem.** 129 devices (155 device-days, ~19 a day) hit
the 400-a-day breaker — the longest careers. Careers that came back after a
capped day had jumped a median of **3 seasons** (mean 5) of events they never
sent: roughly 140–240 events per capped device-day, **2.7–4.6k a day** lost
(~10–17% of the volume), almost all of it career.

### The budget since 2.1.0-dev.4

| | Per day | Per month | Of the free tier |
|---|---|---|---|
| Before (measured) | 26.5k | ~795k | 79% |
| Before, if the breaker were simply raised | 29.2–31.1k | 875–935k | 88–94% |
| − career inner-screen pageviews | −2.0k | −60k | |
| − level 1: standard events past 20 a day thinned 1 in 8 | −4.3k | −130k | |
| + the career line the breaker no longer drops (essential) | +1.6–2.7k | +48–80k | |
| + `career_action_refused` (once per session and reason; bound) | ≤ +0.3k | ≤ +9k | |
| **After** | **22.5–23.2k** | **~675–695k** | **68–70%** |

Every new property rides on an existing event (zero extra events); the only new
event is `career_action_refused`.

### The guard (`src/lib/analyticsBudget.ts`)

A static site cannot know how many people are playing, so the guard has one
input that someone keeps up to date: **`playersPerDay`** in
`public/analytics-budget.json` (or `NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY` at
build). Edit the number, deploy. The file is a static asset: no Worker request.
A missing or broken file leaves the build's value. "Players" = **devices a
day** (unique `$device_id` per UTC day in PostHog). **Shipped value: 360**
(level 1). Review it weekly; raise it before a promotion, not after.

Three priorities:

- **essential** — never sampled or capped, and **past the breaker**: the
  career's spine (`career_created`, `career_event_completed`,
  `career_split_summary`, `career_season_completed`, `career_milestone`,
  `career_ended`), `career_action_refused`, accounts and health (`account_*`,
  `career_cloud_*`, `quality_*`). They have their own ceiling, **1,500 a device
  a day** (`essentialPerDay`), against a loop (`quality_event_cap`, `ceiling`).
- **critical** — never sampled or capped, stopped by the breaker: sessions, the
  entry funnel, rank-ups, collection, research, `career_transfer`,
  `career_staff`.
- **standard** — the volume (Draft runs, unlocks, specials, achievements,
  missions, `$pageview`): capped and sampled first.

| Level | Devices a day | What changes | ~70% of the tier up to |
|---|---|---|---|
| 0 | up to 299 | Everything is sent | ~300 |
| 1 | 300 to 369 | Per device and UTC day: 20 standard events in full, then 1 in 8 | ~370 |
| 2 | 370 to 489 | 15 in full, then 1 in 8; `$pageview` from half of the devices; **75% of careers** send the per-tournament and decision events | ~495 |
| 3 | 490 to 669 | Also: half of the devices send standard events; 50% of careers | ~700 |
| 4 | 670 to 949 | A quarter of the devices; 30% of careers | ~1,000 |
| 5 | 950 to 1,399 | 15% of careers | ~1,370 |
| 6 | 1,400 and up | A tenth of the devices; 5% of careers | ~1,950 (100% at ~2,800) |

- Past the cap, each standard event is sent with probability 1 in N and
  carries `sampleWeight = N`. Random, not "every Nth", so sums of
  `sampleWeight` are unbiased.
- Device and per-event sampling use the device's fixed bucket, so a device is
  in or out for a whole event type and funnels stay coherent inside the sample.
  To build a funnel across sampled events, add `sampleBucket < 50` (or `< 25`)
  to every step.
- **Career sampling** (`careerRate`, levels 2+) applies only to
  `career_event_completed`, `career_transfer` and `career_staff`, by a hash of
  the `careerId`: a career is in or out **as a whole**, so a sampled career is
  still complete tournament by tournament, and its events carry
  `sampleWeight = 1 / careerRate`. Split, season, milestone and end events are
  never sampled: every career keeps its season line.
- **Always on, at any level:** the circuit breaker counts every event a device
  sends in a UTC day; past **400** only essential events still go out. It exists
  for a loop or a bot and trims the very longest days; it reports itself once
  (`quality_event_cap`, `breaker`).
- Past ~2,800 devices a day even level 6 would reach the free tier (the
  essential floor is ~9 events a device-day): that is a decision to take before
  such a launch, not something the ladder can absorb.
- The file may also carry its own ladder (`levels`: `minPlayers`, `dailyCap`,
  `thinTo`, `deviceRate`, `eventRates` by event name, `careerRate`),
  `breakerPerDay` and `essentialPerDay`.

## Device state

The analytics layer keeps one small record in `localStorage` on
`rocketdraft.app`, key `rd-analytics:v1`: the sample bucket, the session and day
counters, the funnel steps already sent, today's budget counters, the reset
counter of the open run, the career tab counters and the last career screen. It is **not a save**: the
game never reads it, it holds nothing personal, and deleting it only restarts
the counters. It is separate from the four persisted stores, whose keys and
versions are unchanged (`persistContract.test.ts`).

## Where each event fires

| Event | Fires in |
|---|---|
| `run_completed`, `run_abandoned`, `challenge_played`, album `collection_milestone` | `runStore` (`finishRun`, `clearRun`, `playChallenge`); `restartRun` only counts a reset |
| `friend_duel` | `runStore.finishRun` (completed), `store/duelStore` (opened, invalid, shared) |
| `content_shared` | `components/share/ShareSheet` (every channel button) |
| `special_discovered`, `mission_completed`, `quiz_played`, national-team `collection_milestone`, `quality_duplicate_reward` | `profileStore` actions |
| `rank_up`, `achievement_unlocked`, `unlock_granted` | `profileStore`'s subscription, built by `profileAnalytics.ts` |
| `session_started`, `onboarding_step`, `$pageview`, `quality_error`, `quality_slow_advance`, `quality_event_cap` | `lib/analytics.ts` (sessions and pageviews from `PostHogProvider`; the boundary error from `app/error.tsx`) |
| `career_*` | `careerStore`, read off the write by `careerAnalytics.ts` (a reload cannot fire one) |
| `account_signed_in`, `account_sync_failed` | `accountStore` |
| `quality_save_error`, `quality_migration` | `store/persistStorage.ts` |

Tests: `src/lib/analytics.test.ts`, `analyticsCatalog.test.ts`,
`analyticsBudget.test.ts`, `src/store/draftAnalytics.test.ts`,
`src/store/careerAnalytics.test.ts`.
