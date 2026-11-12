# Handoff S1 — SEO and analytics audit before the Season 1 launch

> Session S1, 2026-11-12, on `claude/rc42-balance` (rc.53 plus the uncommitted rc.54
> work of other sessions). Read-only audit plus four small edits (section 1.6).
> Nothing was committed, built, deployed or sent to any external service.
>
> **How it was checked.** Code reading; the export already in `out/` (a **staging**
> build from 00:23, `NEXT_PUBLIC_NOINDEX=1`, career on: same pages and sitemap as
> production, but every robots tag is noindex, so production robots output is
> **not** verified here); `git show origin/main:…` for v1.4.8; targeted tests
> (analytics 114 tests, pages / shared path / locale / database 64 tests, all green);
> one throwaway probe test for the hydration order (deleted after the run).
> `npm run build` was not run.

## 1. SEO findings

### 1.1 Verdict

No blocker in the code. The launch depends on **one build variable**:
`NEXT_PUBLIC_NOINDEX` must be absent on the production Worker (and
`NEXT_PUBLIC_PLAYTEST` too). If it leaks in, the whole site ships `noindex` +
`Disallow: /` **and** analytics stays off (`analyticsEnvironment()` returns
`staging`). `NEXT_PUBLIC_CAREER_MODE=1` must be present, or the manager landing
pages 404 and the sitemap drops to 705 URLs. `scripts/postexport.mjs` prints the
proof in the build log (section 2, step 1).

### 1.2 What is right (verified in `out/` and in the code)

| Item | State |
|---|---|
| Sitemap (`src/app/sitemap.ts`) | 707 URLs, every one exported and indexable; no exported indexable page missing except `/profile` (left out on purpose). hreflang `en-US` / `pt-BR` / `x-default` on the home pair and the 13 content pairs, reciprocal. |
| `robots.ts` | Production: `Allow: /` + `Sitemap:`. NOINDEX build: `Disallow: /`. |
| Canonical | Every indexable page has exactly one, pointing at itself (726 pages checked). `og:url` matches. |
| Titles / descriptions | Every page has its own. One duplicate title pair (1.5). |
| JSON-LD | `VideoGame` + `WebSite` everywhere; `BreadcrumbList` + `Article` (+ `FAQPage`) on content pages; `BreadcrumbList` on `/rlcs/**`. All parse. |
| `<html lang>` | `pt-BR` on `/pt/**`, `en` elsewhere. |
| `public/_headers` | No `X-Robots-Tag`. `Cache-Control` only in path rules; HTML, `sitemap.xml` and `robots.txt` keep the host default (revalidate every load). Nothing blocks crawling. |
| Internal links (static HTML) | 0 dead links across 726 pages. Every `href` in `src/` points at an existing route. |
| Old URLs | **Every v1.4.8 route still exists.** No 404 after the launch, so **no Cloudflare redirect rule is needed**. |
| Build guard | `postexport` fails a production build with a stray noindex, a missing canonical, or a sitemap URL that is not exported and indexable. |

### 1.3 URLs new in the v2.0 sitemap (20 → 707)

| Group | URLs | Count |
|---|---|---|
| App pages now listed | `/quiz` (new page), `/challenges`, `/leaderboards` (existed, were not listed) | 3 |
| Regional pages | `/na` `/eu` `/mena` `/oce` + `/pt/na` `/pt/eu` `/pt/mena` `/pt/oce` | 8 |
| Search-intent pages | `/rocket-league-simulator` `/rocket-league-manager` `/rlcs-fantasy-draft` + `/pt/simulador-rocket-league` `/pt/manager-rocket-league` `/pt/fantasy-rlcs` | 6 |
| RLCS database | `/rlcs`, `/rlcs/teams`, `/rlcs/players`, 16 seasons, 230 teams, 421 players | 670 |

New and **not** indexed on purpose: `/missions`, `/career/**` (14 pages).

### 1.4 noindex gating

| Route | Robots | Right for this launch? |
|---|---|---|
| `/settings`, `/missions` | `noindex, follow` | Yes: per-device screens. |
| `/career/**` | `noindex, nofollow` (`career/layout.tsx`) | Yes, see below. |
| 404 | `noindex` | Yes. |
| `/profile` | indexable, not in the sitemap | Kept (C4: it earns sitelink clicks). Empty `<main>` in the HTML; watch it. |
| Staging / playtest hosts | blanket noindex + `Disallow: /` | Yes. |

**`/career` at launch: keep it noindex.** The indexable door is
`/rocket-league-manager` (and its PT twin): real text, FAQ, a call to action
into `/career`. The career routes are 14 client screens with an empty server
`<main>`, the root layout's default title and description (identical on all 14,
and the same description as the 404), no canonical and no hreflang. Indexed
today they would be thin duplicates competing with the landing page for the
same queries. Indexing the hub later means: own metadata for `/career`, a change
to `NOINDEX_BY_DESIGN` and to the sitemap rule in `postexport.mjs`. Not a
launch-day change.

### 1.5 Findings not fixed (none blocks)

| # | Finding | Suggested action |
|---|---|---|
| 1 | `/rlcs/teams/fut-esports-na` and `/rlcs/teams/fut-esports-ssa` share the title "FUT Esports RLCS Rosters by Season" (descriptions differ). | Add the region to `teamTitle` when two orgs share a name. After launch. |
| 2 | `Article` JSON-LD has `dateModified` and no `datePublished`. | Add a fixed publish date per page. After launch. |
| 3 | Home descriptions are long (EN 172, PT 187 characters): Google cuts at about 155 to 160. | Trim when the copy is next touched. |
| 4 | `out/` holds the RSC payloads (`about.txt`, `__next.*.txt`). Google may list a few as "Crawled, currently not indexed". | Harmless; ignore in the report. An `X-Robots-Tag` rule is possible later. |
| 5 | The 667 season, team and player pages are data-generated. | Expect slow, partial indexing (section 2, "watch"). |
| 6 | `npx tsc --noEmit` currently fails in `src/store/seasonBoards.test.ts` (`"swiss"` is not a `Placement`). Another session's in-progress leaderboard work, not this audit. | That session must fix it before the build. |

### 1.6 Fixes made

| File | Change | Why |
|---|---|---|
| `src/content/pageRoutes.ts` | `CONTENT_DATE` `2026-11-11` → `2026-11-12` | Sitemap `lastmod` and articles' `dateModified` on launch day. **If the deploy slips past midnight UTC, bump it again.** |
| `src/app/quiz/page.tsx` | Description said "three attempts" → "five attempts" | The quiz has five (`QUIZ.attempts`, and the in-game copy says five). |
| `src/app/HomeMenu.tsx` | "Daily Quiz" link to `/quiz` in the home's link list (not in a playtest build) | `/quiz` is indexable and in the sitemap, but **no exported HTML linked to it**: its only link sat inside a modal. Uses the existing `QUIZ_UI.kicker` string. |
| `src/app/pt/page.tsx` | Same link on `/pt` ("Quiz diário") | Same reason. |

ESLint clean on the four files; `pages`, `sharedPath`, `locale`, `database` tests pass.
Not verified in an export (no build run): the next build's `postexport` and
`node scripts/link-audit.mjs out` cover it.

## 2. Miguel's launch-day SEO checklist

**Before the deploy**

1. In the production build log, read the `postexport` lines. Expected:
   `… indexable page(s) with a self canonical · 707 sitemap URL(s) · … noindex by design`
   (about 708 indexable, 18 noindex), and in the summary `indexable`,
   `career ON`, `playtest OFF`, analytics `ENABLED`. If it says
   **`NOINDEX build`**, stop: the Worker has `NEXT_PUBLIC_NOINDEX` set.
2. Cloudflare → production Worker → build variables: `NEXT_PUBLIC_CAREER_MODE=1`
   present; `NEXT_PUBLIC_NOINDEX` and `NEXT_PUBLIC_PLAYTEST` absent; the PostHog
   and Supabase variables unchanged.

**Right after the deploy (3 minutes, in a browser)**

3. `https://rocketdraft.app/robots.txt` shows `Allow: /` and the `Sitemap:` line.
4. View source of `/`: `<meta name="robots" content="index, follow">`.
5. `/sitemap.xml`: 707 entries, `lastmod` 2026-11-12.
6. `/rocket-league-manager` opens (proves the career flag). View source of
   `/career`: `noindex`.
7. A made-up URL returns the 404 page.

**Search Console, same day**

8. **Resubmit `sitemap.xml`: yes.** Google would re-read it on its own in a few
   days (robots.txt names it), so it is not strictly required. Do it anyway: the
   file goes from 20 to 707 URLs, a resubmit triggers a fetch now, and the
   "discovered URLs" number confirms Google read all 707.
9. URL Inspection → "Request indexing" (about 10 a day is the quota). Day 1:
   `/`, `/pt`, `/rocket-league-manager`, `/rocket-league-simulator`,
   `/rlcs-fantasy-draft`, `/rlcs`, `/sam`, `/na`, `/eu`, `/quiz`.
   Day 2: `/pt/manager-rocket-league`, `/pt/simulador-rocket-league`,
   `/pt/fantasy-rlcs`, `/rlcs/teams`, `/rlcs/players`, `/rlcs/2026`, `/mena`,
   `/oce`, `/pt/sam`, `/leaderboards`.
   Do **not** request the season, team and player pages one by one: the sitemap
   and the internal links carry them.
10. Rich Results Test on `/rocket-league-manager` (Article, Breadcrumb, FAQ) and
    on `/` (VideoGame, WebSite).

**Bing (optional, 5 minutes)**: Bing Webmaster Tools → import the site from
Search Console → submit the same sitemap. It also feeds DuckDuckGo.

**Watch in the following days**

| When | Where | What |
|---|---|---|
| Day 2 to 3 | Sitemaps | Status "Success", 707 discovered. |
| Week 1 | Pages → "Why pages aren't indexed" | `/settings` and `/career/**` under "Excluded by noindex" (expected). Nothing else there. No "Blocked by robots.txt". |
| Weeks 1 to 4 | Pages → "Crawled / Discovered, currently not indexed" | `/rlcs/teams/*` and `/rlcs/players/*` will sit here for a while. Normal for 650 new data pages on a small site. If most are still there after 4 weeks, the pages need more unique text. |
| Week 1 | Pages | The `/pt/*` twins must be **indexed**, not "Alternate page with proper canonical". `/profile` now has its own canonical. |
| Weeks 1 to 4 | Performance → Queries | "rocket league simulator", "rocket league manager game", "rocket league career simulator", "sam rocket league", "fantasy rocket league", "simulador rocket league": impressions and position per new page. |
| Weeks 1 to 2 | Performance → `/` | The home title changed. Brand CTR ("rocket draft", about 80%) must not fall. |
| Week 2 | Core Web Vitals, PageSpeed on `/` and one content page | CLS should now be 0 on mobile. |

No redirect rule, no removal request and no disavow are needed.

## 3. Analytics verification

### 3.1 When analytics runs

All four must hold (`analyticsAllowed()` in `src/lib/analytics.ts`, plus the key):

| Condition | Source |
|---|---|
| `NODE_ENV === "production"` | any `next build` |
| `NEXT_PUBLIC_PLAYTEST !== "1"` and `NEXT_PUBLIC_NOINDEX !== "1"` | build variables |
| `window.location.hostname === "rocketdraft.app"` | `SITE.domain` |
| `NEXT_PUBLIC_POSTHOG_KEY` set at build | build variable (host defaults to `https://eu.i.posthog.com`) |

A staging build fails two of them (the NOINDEX flag and the host): the SDK is
never downloaded, `trackEvent` returns before queueing, `connectAnalytics`
refuses the SDK, and the device record is not written. Covered by
`analytics.test.ts` (staging, playtest, dev, wrong host) and by both store
suites. A local `wrangler dev` of a production build sends nothing either (host).
Browsers with Do Not Track are not counted (`respect_dnt`), as in 1.x.

### 3.2 Catalogue against the code

`analyticsCatalog.test.ts` passes (it scans `src/`). Its "emitted somewhere"
check only looks for the name as a string, so each emission site was also
located by hand: **all 28 events are emitted, and nothing outside the catalogue
is**. All 7 `onboarding_step` values have a call site.

Common properties on every event and on `$pageview`: `release`, `balanceVersion`,
`schemaVersion` (2), `season` (1), `environment`, `locale`, `gameMode`,
`sampleWeight`, `sampleBucket`.

| Event | Priority | Properties (`?` = optional) |
|---|---|---|
| `run_completed` | standard | `runId` `mode` (classic, quick, daily) `difficulty` (easy, normal, hard, legacy) `region` `placement` `won` `hiddenOverall` `teamOverall` `swissWins` `swissLosses` `playoffWins` `gameWins` `goalsFor` `goalsAgainst` `eliminatedStage?` `xpGained` `chemistryTier` `chemistryPercent` `durationSec?` `dailyTemplate?` `resets` `rerollsLeft` `picks` `specials` `specialsCount` `specialsNew` `achievementsNew` `ratingDelta` `ratingAfter` `rankId` `rankUp` |
| `run_abandoned` | standard | `runId` `mode` `difficulty` `region` `hiddenOverall` `phase` (draft, review, tournament) `reason` (quit) `resets` `picksMade` `durationSec?` |
| `challenge_played` | standard | `challengeId` `difficulty` `kind` (boss, gauntlet, draft) `cleared` `stars` `starsNew` `firstClear` `resets` `rerollsUsed` `teamOverall` `chemistryPercent` `picks` `specials` `xpGained` |
| `quiz_played` | standard | `solved` `attempts` `maxAttempts` `score` `xp` `streak` |
| `special_discovered` | standard | `specialId` `rarity` `national` `mode` |
| `collection_milestone` | critical | `kind` (national_team_found, album_completed) `id` `albumsCompleted?` |
| `mission_completed` | standard | `id` `period` `tier?` `xp` `bonus` |
| `achievement_unlocked` | standard | `id` |
| `rank_up` | critical | `rankId` `rankIndex` `xp` |
| `unlock_granted` | standard | `kind` (cosmetic, cosmetic_batch, mode) `id` `count` |
| `session_started` | critical | `sessionNumber` `dayNumber` `daysSinceFirst` `daysSinceLast?` `existingPlayer?` `entryPath` `signedIn?` `loginStreak?` `xp?` `rankId?` `rating?` `runsCompleted?` `specialsOwned?` `achievements?` `challengesCleared?` `quizPlayed?` `careerMarks?` `equippedTitle?` `equippedBanner?` `equippedBadge?` `openRunPhase?` |
| `onboarding_step` | critical | `step` (draft_started, draft_confirmed, run_completed, challenge_played, quiz_played, career_created, career_first_event) `sessionNumber` `dayNumber` `secondsSinceFirstSeen` |
| `$pageview` | standard | PostHog's own (`$pathname`, `$current_url`, `$referrer`…) + common. First visit to each route per session. |
| `career_created` | critical | `careerId` `actionId` `region` `difficulty` `rosterKey` `startOverall` `startBalance` `slot?` |
| `career_event_completed` | standard | `careerId` `actionId` `seasonIndex` (0-based) `week` `tier` (t3, t2, qualifier, regional, major, worlds) `eventRegion` `placement` `qualified?` `qualifierPlacement?` `watched` `seedingDirect?` `briefing?` `squadOverall` `balance` `tab_hq?` `tab_club?` `tab_squad?` `tab_market?` `tab_training?` `tab_finances?` `tab_calendar?` `tab_standings?` `tab_news?` `tab_season?` `advanceCount?` `advanceMaxMs?` `advanceSlowCount?` |
| `career_split_summary` | critical | `careerId` `actionId` `seasonIndex` `split` (1 to 3) `balance` `payrollPerSplit` `incomePrize` `incomeSponsor` `incomeFanbase` `incomeTransfers` `spendWages` `spendTransfers` `spendOther` `debtBacker` `debtBank` `splitRank?` `ledgerComplete` `squadOverall` `squadSize` `coachOverall?` `sponsorTier?` `trainingMode?` `staffCount` `rep` |
| `career_season_completed` | critical | `careerId` `actionId` `seasonIndex` `region` `difficulty` `regionRank` `seasonPoints` `majorsQualified` `worldsPlacement?` `grade` `earnings` `balance` `rep` `titlesSeason` `titlesTotal` `titlesWorlds` `squadOverall` `squadSize` `squadAvgAge` `payrollPerSplit` `coachOverall?` `sponsorTier?` `sponsorProfile?` `trainingMode?` `staffCount` `debtBacker` `debtBank` |
| `career_transfer` | critical | `careerId` `actionId` `seasonIndex` `kind` (sign, sell, release, renew) `overall` `age` `potentialBandMid` `fee` `salaryPerSplit` `role` `warned` |
| `career_staff` | critical | `careerId` `actionId` `seasonIndex` `kind` (coach_hired, coach_fired, coach_renewed, sponsor_signed, staff_on, staff_off) `overall?` `salaryPerSplit?` `tier?` `basePerSplit?` `objectiveKind?` `profile?` `staffId?` |
| `career_milestone` | critical | `careerId` `actionId` `seasonIndex` `kind` (first_title, first_major, first_worlds, worlds_title, backer, bank_loan) `amount?` |
| `career_ended` | critical | `careerId` `actionId` `seasonIndex` `reason` (worlds_won, timeline_complete, insolvency, retired) `legacyGrade?` `titles` `titlesWorlds` `balance` `rep` |
| `account_signed_in` | critical | `hadLocalProgress` |
| `account_sync_failed` | critical | `actionId` `stage` (read, push) |
| `quality_save_error` | critical | `gameMode` `actionId` `store` `kind` (quota, parse, migrate, write, action) |
| `quality_migration` | critical | `gameMode` `actionId` `store` `fromVersion` `toVersion` |
| `quality_duplicate_reward` | critical | `gameMode` `actionId` `kind` `id` |
| `quality_error` | critical | `actionId` `source` (boundary, window, promise) `name` `route` `message` |
| `quality_slow_advance` | critical | `actionId` `kind` (day, stop) `ms` |
| `quality_event_cap` | critical | `kind` (cap, breaker) `level` |

### 3.3 Finding: the first 2.0 session of every pre-2.0 player has no snapshot

Reproduced with a probe (a v11 profile in storage, production build, production host):

```
order:            session_started > quality_migration > $pageview
session_started:  sessionNumber 1, existingPlayer: null, no xp / rankId / runsCompleted / …
```

Root cause: the profile store hydrates while its module is still being
evaluated. The v11 → v12 migration (the Season 1 reset, which every existing
player runs on the first 2.0 load) reports `quality_migration` from inside that
hydration. That first `trackEvent` opens the session, but
`registerSessionProps` and `setAnalyticsHistorySource` are only called at the
bottom of `profileStore.ts`, a few lines later. A new player is not affected
(`existingPlayer: false`, full snapshot: also probed).

What it means:

- The new-player filter `existingPlayer = false` stays exact. Funnels are safe:
  `onboarding_step` decides `existing` again before sending, so old players
  still skip the firsts they had already done.
- `existingPlayer = true` only appears from a returning player's **second**
  session. `ANALYTICS-EVENTS-2.0.md` and A1 say "every pre-2.0 player on launch
  day": not on session 1.
- The launch-day picture of the old base (runs completed, collection,
  achievements at the moment of the reset) is not on that event and cannot be
  recovered later.

Not a blocker. Two ways to live with it:

- **In PostHog (no code):** returning pre-2.0 device = it sent
  `quality_migration` with `store = profile` and `fromVersion = 11`. On session 1
  use "`existingPlayer` is not `false`". The build list below does this.
- **In code (small, optional, before the deploy if there is time):** defer the
  two reporters in `src/store/persistStorage.ts` (`reportMigration`,
  `reportSaveError`) with `queueMicrotask`, so they run after the store module
  has registered its sources. The persist-wrapper cases in
  `draftAnalytics.test.ts` then need one `await Promise.resolve()`. Not done
  here: analytics code was out of scope for edits.

### 3.4 What stops and what replaces it (annotate old insights)

Production v1.4.8 sends six events and automatic pageviews, with no common properties.

| v1.4.8 | At the deploy | Where the information goes |
|---|---|---|
| `run_started` | **Stops** | Runs started = `run_completed` + `run_abandoned` + sum of `resets`. First ever start: `onboarding_step` `draft_started`. |
| `tournament_started` | **Stops** | Every `run_completed` reached the bracket; exits before it: `run_abandoned.phase`. First time: `onboarding_step` `draft_confirmed`. |
| `special_used` (one per card) | **Stops** | `run_completed.specials` (ids joined by `\|`), `specialsCount`, `specialsNew`; also on `challenge_played`. |
| `run_abandoned` | Continues, about 85% lower | Restarts are no longer events (`resets` counter). Only real exits remain; a challenge already played is no longer an exit. New: `runId`, `resets`, `picksMade`, `durationSec`. |
| `run_completed` | Continues, unbroken | 9 → 31 properties. |
| `challenge_played` | Continues, unbroken | 3 → 14 properties. |
| `$pageview` (every navigation) | Continues, about 75% lower | Once per route per session. Unique visitors and sessions per page stay comparable; views per page do not. |

Old tabs keep the 1.x script until they reload, so `run_started` fades over a
day or two instead of stopping at the minute of the deploy.

### 3.5 Instrumentation gaps in what was added after A1 (nothing added here)

| Feature | What exists | Gap worth a decision |
|---|---|---|
| Guided tour (rc.50, reworked in rc.54: `markTourSeen`, shown once per season) | Nothing. Tutorials were cut from the catalogue on Miguel's request. | Every player now sees a tour once in Season 1. Two more `onboarding_step` values (`tour_finished`, `tour_skipped`), once per device, would show whether the tour helps the first draft. Cost: at most 1 event per device, ever. |
| Cosmetics (rc.51 to rc.53: 16 new rewards, Supernova at 90 stars) | `unlock_granted` per cosmetic (one `cosmetic_batch` when 4 or more land at once); equipped title, banner and first badge on `session_started`. Grants made during hydration (the legacy rewards of the reset) are silent, by design. | Total challenge stars is not in the snapshot, so "how far are players from Supernova" needs a sum of `starsNew` per device. Opening the locker and equipping are not events (the snapshot is enough). |
| New leaderboards (in progress, `supabase.ts`, `LeaderboardsView.tsx`) | `$pageview` on `/leaderboards`, once per session. | No signal for which board is opened or whether a score was submitted. Only add one if a decision depends on it. |
| Season recap screen | Nothing. | Low value. |
| Outbound links (Discord, Ko-fi, X), share card | Nothing (autocapture is off). | One `outbound_click` event with a `target` enum would answer "does the Discord card work". After launch. |
| Sign-out, account deletion, successful sync | Only sign-in and sync failures. | Failure **rate** has to use sessions with `signedIn = true` as the base. |

## 4. PostHog build list (after the deploy)

**Conventions for every insight**

- Base filter **F2**: `schemaVersion = 2`. (1.x events carry none of the common properties.)
- **New player**: `session_started` with `sessionNumber = 1` and `existingPlayer = false`.
- **Returning pre-2.0 device**: sent `quality_migration` with `store = profile`, `fromVersion = 11` (see 3.3).
- Volumes of standard events: use **sum of `sampleWeight`**, not the count. They are equal while the guard is at level 0.
- Everyone is anonymous (no `identify`): "users" means devices; person properties do not exist, so segment by **event** properties only. Confirm on the first retention insight that it computes for anonymous users.
- `picks` and `specials` are `|`-joined lists: per-card rankings need SQL, `arrayJoin(splitByChar('|', properties.specials))`.
- Career funnels: aggregate by `properties.careerId` (a device can run several careers).

### 4.0 First hour: verification and annotation

1. **Annotation** (project scope) at the deploy time: "v2.0 Season 1. Catalogue 2.0 (`schemaVersion` 2). `run_started`, `tournament_started`, `special_used` stop. `run_abandoned` = real exits only (about −85%). `$pageview` once per route per session (about −75%). Profile reset v11 → v12."
2. Open the site in a browser that has an old save. In Activity expect, in this order: `session_started`, `quality_migration` (`store` profile, 11 → 12), `$pageview`. Check `release`, `season = 1`, `environment = production`, `sampleWeight = 1`.
3. Open it in a private window: `session_started` with `existingPlayer = false` and the snapshot (`rankId = unranked`).
4. Play one run with two restarts: `onboarding_step` `draft_started`, `draft_confirmed`, `run_completed`; one `run_completed` with `resets = 2`, `picks`, `specials`; **no** `run_started`, `tournament_started`, `special_used` from that browser.
5. Found a career, visit Club and Market, play the first tournament: `career_created`, `onboarding_step` `career_created` and `career_first_event`, one `career_event_completed` with `tab_club`, `tab_market`, `advanceCount`.
6. Move between the same pages several times: one `$pageview` per route.
7. Trend, `$pageview` by `$host`, last 7 days: only `rocketdraft.app`.
8. Add descriptions to the retired 1.x insights (anything on `run_started`, `tournament_started`, `special_used`, pageview totals) and move them to a "1.x archive" folder.

### 4.1 Dashboard "Launch monitor" (first 72 hours, hourly)

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Active devices | Trend, unique users, hourly | `session_started` | `existingPlayer` (false = new, true or not set = returning) | Is the launch bringing people, and who? |
| Old base coming back | Trend, unique users, cumulative | `quality_migration`, `store = profile`, `fromVersion = 11` | none | How many 1.x players have opened 2.0? |
| Events by name | Trend, total, hourly | all events (no F2, to see 1.x names fade) | event name | Is anything missing or flooding? |
| Errors | Trend, total | `quality_error` | `route`, then `name` | Is a screen breaking? |
| Save health | Trend, total | `quality_save_error`; `quality_migration` | `store` + `kind`; `fromVersion` | Did the reset migration fail for anyone? (`kind = migrate` must be 0) |
| Sync failures | Trend, total | `account_sync_failed` | `stage` | Are accounts syncing? |
| Guard | Trend, total | `quality_event_cap` | `kind` | Is any device hitting the 400-a-day breaker? |
| Month to date | SQL, number | `count()` since the 1st, and the same projected to month end | none | Are we inside 1M? |

### 4.2 Dashboard "Acquisition and onboarding"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| New players per day | Trend, unique users | new-player event | `locale`; second copy by `entryPath`; third by `$referring_domain` | How many, from where, in which language? |
| Entry funnel | Funnel, ordered, 1-day and 7-day window | new-player event → `onboarding_step` `step = draft_started` → `draft_confirmed` → `run_completed` → `session_started` `sessionNumber = 2` | `entryPath`, `locale`, device type | Where do new players drop before finishing a first run and coming back? |
| Time to first draft | Trend, median of `secondsSinceFirstSeen` | `onboarding_step` | `step` | How long until each first? |
| First modes tried | Trend, unique users | `onboarding_step` | `step` | Which modes do players reach (draft, challenge, quiz, career)? |
| Mode funnels | Funnel, 14-day window | new-player event → `onboarding_step` `challenge_played`; same for `quiz_played`; same for `career_created` → `career_first_event` | `locale` | How many new players reach each mode? |
| Retention D1 to D30 | Retention, first-time, daily and weekly | cohort: new-player event; return: `session_started` | `locale`, `entryPath` | Do new players come back? |
| Played retention | Retention | cohort: new-player event; return: `run_completed` or `career_event_completed` | none | Do they come back and play? |
| Retention of the old base | Retention | cohort: `quality_migration` (profile, from 11); return: `session_started` | none | Did the reset keep the 1.x players? |
| DAU, WAU, MAU | Trend, unique users | `session_started` | none; ratio DAU/MAU as a formula | Size and stickiness of the base. |
| Lifecycle | Lifecycle | `session_started` | none | New, returning, resurrected, dormant per week. |
| Stickiness | Stickiness | `session_started` | none | Days active per week. |
| Sessions per player-day | Trend, formula total / unique users | `session_started` | none | How often per day? |
| Gap between visits | Trend, unique users | `session_started` | `daysSinceLast` (buckets 0, 1, 2 to 6, 7+) | How long between sessions? |
| Open run on return | Trend, total | `session_started` | `openRunPhase` | Do players come back to an unfinished run? |

### 4.3 Dashboard "Core loop: runs"

Filter F2 and `mode` in classic, quick unless stated.

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Runs per day | Trend, sum of `sampleWeight` | `run_completed` (all modes) | `mode` | Volume of play. |
| Runs per active player | Trend, formula | `run_completed` total / unique users | none | Depth of a play day. |
| Title rate | Trend, formula `won = true` / all | `run_completed` | `difficulty`; copies by `mode`, `region` | Is each difficulty in its target band? |
| Placement mix | Trend, stacked 100% | `run_completed` | `placement`, one chart per `difficulty` | Where do runs end? |
| Elimination stage | Trend, total | `run_completed`, `won = false` | `eliminatedStage` | Swiss or playoffs? |
| Title rate by overall | SQL | `run_completed`, group by `floor(teamOverall)` | `difficulty` | Does overall stay dominant? (design anchor) |
| Title rate by chemistry | Trend, formula | `run_completed` | `chemistryTier` | Is chemistry worth chasing? |
| Resets per run | Trend, average and p90 of `resets` | `run_completed` | `difficulty`, `mode` | How much do players reroll the whole run? |
| Runs started | Trend, formula | `run_completed` + `run_abandoned` + sum of `resets` on both | none | The 1.x `run_started` number, rebuilt. |
| Abandon rate | Trend, formula `run_abandoned` / (`run_abandoned` + `run_completed`) | both | `mode`, `difficulty` | How many runs are left for good? |
| Where runs are left | Trend, total | `run_abandoned` | `phase`; `picksMade` | Draft, review or bracket? |
| Run length | Trend, median and p90 of `durationSec` | `run_completed` | `mode` | How long is a run? |
| Hidden overall | Trend, total; title rate | `run_completed` | `hiddenOverall` | Who plays blind, and how does it go? |
| Region lock | Trend, total | `run_completed` | `region` | Which regional drafts are played? |
| Most drafted cards | SQL table | `run_completed`, `arrayJoin(splitByChar('\|', picks))` | card, with title rate | Which cards are picked, which win? |
| Specials fielded | SQL table | `run_completed`, `arrayJoin(splitByChar('\|', specials))` | special id, with title rate | Which specials are used, which win? |
| Specials or not | Trend, formula title rate | `run_completed` | `specialsCount` (0, 1, 2+) | Do specials decide runs? |
| XP per run | Trend, average `xpGained` | `run_completed` | `difficulty`, `placement` | Is the XP curve as designed? |
| Rating movement | Trend, average `ratingDelta` | `run_completed` | `difficulty` × `won` | Is Season Rating fair by difficulty? |
| Rating distribution | SQL histogram | last `ratingAfter` per device | `rankId` | Where does the base sit? |
| Daily challenge | Trend, unique users; title rate | `run_completed`, `mode = daily` | `dailyTemplate` | Participation and difficulty per template. |

### 4.4 Dashboard "Challenges and quiz"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Challenge attempts | Trend, sum of `sampleWeight`; unique users | `challenge_played` | `kind`, `difficulty` | How much are challenges played? |
| Clear rate per challenge | Table, formula `cleared = true` / all | `challenge_played` | `challengeId` | Which challenges are too easy or too hard? |
| Attempts to first clear | SQL | attempts per device and `challengeId` up to `firstClear = true` | `challengeId` | How many tries does each take? |
| Stars | Trend, sum of `starsNew`; average `stars` on clears | `challenge_played` | `challengeId` | Are three stars reachable? |
| Stars per device | SQL | sum of `starsNew` per device, histogram | none | How far is the base from Supernova (90 stars)? |
| Effort | Trend, average `resets`, `rerollsUsed` | `challenge_played` | `challengeId` | Where do players grind? |
| Quiz players | Trend, unique users; share of DAU | `quiz_played` | none | Is the quiz a daily habit? |
| Quiz solve rate | Trend, formula `solved = true` / all | `quiz_played` | none | Is the puzzle fair? |
| Attempts used | Trend, total | `quiz_played`, `solved = true` | `attempts` (1 to 5) | On which clue is it solved? |
| Quiz streak | Trend, unique users | `quiz_played` | `streak` buckets | Do streaks hold? |

### 4.5 Dashboard "Progression and season"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Rank mix of the active base | Trend, unique users, weekly | `session_started` | `rankId` | How fast does Season 1 fill the ranks? |
| Rank-ups | Trend, total | `rank_up` | `rankId` | Pace of promotion. |
| Days to each rank | SQL | first `session_started` to `rank_up` per device | `rankId` | Is the XP curve too slow or too fast? |
| Missions completed | Table, total | `mission_completed`, `bonus = false` | `id`; `period`; `tier` | Which missions are done, which ignored? |
| Full sets | Trend, unique users / DAU | `mission_completed`, `bonus = true` | `period` | Who finishes all missions? |
| Achievements | Table, unique users | `achievement_unlocked` | `id` | Most and least earned. |
| Unlocks | Trend, total | `unlock_granted` | `kind`; `id` for `kind = cosmetic` | Which rewards land? |
| Legacy opened | Trend, unique users | `unlock_granted`, `kind = mode`, `id = legacy` | none | How many reach Legacy? |
| Cosmetics in use | Table, unique users | `session_started` | `equippedTitle`; `equippedBanner`; `equippedBadge` | Which cosmetics are worn? Who wears none ("")? |
| Specials discovered | Trend, sum of `sampleWeight` | `special_discovered` | `rarity`; `national`; `mode` | Pace of the collection. |
| Rarest finds | Table, unique users | `special_discovered` | `specialId` | Which cards almost nobody has? |
| Collection size | Trend, unique users | `session_started` | `specialsOwned` buckets | How full are collections? |
| Albums | Trend, total | `collection_milestone` | `kind`; `id` | National teams found, albums completed. |
| Login streak | Trend, unique users | `session_started` | `loginStreak` buckets | Does the login calendar work? |

### 4.6 Dashboard "Career: Road to Worlds"

Filter F2 and `gameMode = career`. `seasonIndex` starts at 0.

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Careers created | Trend, total and unique users | `career_created` | `region`; `difficulty`; `rosterKey` | Who starts a career, and how? |
| Share of the base in career | Trend, formula | unique users of `career_event_completed` / unique users of `session_started` | none | Adoption of the mode. |
| Career funnel | Funnel by `careerId`, 30-day window | `career_created` → `career_event_completed` → `career_split_summary` `split = 1` → `career_season_completed` `seasonIndex = 0` → `career_season_completed` `seasonIndex = 1` | `difficulty`, `region` | Where do careers stop? |
| Results by tier | Trend, stacked 100% | `career_event_completed` | `placement`, per `tier`; filter `difficulty` | Is each tier winnable? |
| Qualifier pass rate | Trend, formula `qualified = true` / (`tier` in qualifier, regional) | `career_event_completed` | `seasonIndex`, `difficulty`, `eventRegion` | Is the Saturday gate fair? |
| Watched or simulated | Trend, total | `career_event_completed` | `watched`; per `tier` | Do players watch matches? |
| Briefing effect | Trend, placement mix | `career_event_completed`, `tier = regional` | `briefing` | Does the Sunday choice matter? |
| Tab usage | Trend, sum of each `tab_*` | `career_event_completed` | `seasonIndex` | Which screens are used between events, and does it change over seasons? |
| Day-advance cost | Trend, p90 of `advanceMaxMs`; sum of `advanceSlowCount` | `career_event_completed` | device type | Is advancing slow anywhere? |
| Cash by split | Trend, median `balance` | `career_split_summary` | `seasonIndex` + `split`; `difficulty` via SQL join on `careerId` | Does the economy snowball or starve? |
| Income mix | Trend, average of `incomePrize`, `incomeSponsor`, `incomeFanbase`, `incomeTransfers` | `career_split_summary`, `ledgerComplete = true` | `seasonIndex` | Where does money come from? |
| Spending mix | Trend, average of `spendWages`, `spendTransfers`, `spendOther` | same | `seasonIndex` | Where does it go? |
| Debt | Trend, share with `debtBacker > 0` or `debtBank > 0` | `career_split_summary` | `seasonIndex` | How many careers live on debt? |
| Season outcome | Trend, total | `career_season_completed` | `grade`; `worldsPlacement`; `regionRank` | How do seasons end? |
| Title pace | Trend, average `titlesTotal`, `titlesWorlds` | `career_season_completed` | `seasonIndex`, `region`, `difficulty` | Is a Worlds title reachable by 2026 to 2027 (seasonIndex 5 to 6) on NA, EU, SAM at Normal and Hard? |
| First times | Trend, total; SQL for the season it happens | `career_milestone` | `kind`; `seasonIndex` | When do the first title, Major, Worlds come? |
| Squad shape | Trend, average `squadOverall`, `squadAvgAge`, `payrollPerSplit` | `career_season_completed` | `seasonIndex` | How do squads grow? |
| Market | Trend, total; average `fee`, `overall`, `age` | `career_transfer` | `kind`; `role` | What is bought, sold, released, renewed? |
| Renewals after a warning | Trend, formula | `career_transfer`, `kind = renew` | `warned` | Does the contract warning work? |
| Coach and staff | Trend, total | `career_staff` | `kind`; `staffId` for `staff_on` | Which staff are used? |
| Sponsors | Trend, total | `career_staff`, `kind = sponsor_signed` | `tier`; `profile`; `objectiveKind` | Which deals are taken? |
| Rescues and loans | Trend, total; average `amount` | `career_milestone`, `kind` in backer, bank_loan | `seasonIndex` | How often is a career rescued? |
| Career endings | Trend, total | `career_ended` | `reason`; `seasonIndex`; `legacyGrade` | Bankrupt, retired or champion, and when? |

### 4.7 Dashboard "Accounts and sync"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Sign-ins per day | Trend, total and unique users | `account_signed_in` | `hadLocalProgress` | Who signs in: new devices or players with progress? |
| Signed-in share | Trend, formula | unique users of `session_started` with `signedIn = true` / all | `existingPlayer` | How much of the base has an account? |
| Sign-in funnel | Funnel, 30-day window | new-player event → `onboarding_step` `run_completed` → `account_signed_in` | `locale` | Do players who finish a run make an account? |
| Sync failure rate | Trend, formula | unique users of `account_sync_failed` / unique users of `session_started` with `signedIn = true` | `stage` | Is cloud save reliable? |
| Leaderboard visits | Trend, unique users | `$pageview`, `$pathname = /leaderboards` | `signedIn` is not on pageviews: none | Do the new boards get traffic? |

### 4.8 Dashboard "Content pages and SEO landing"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Landing pages | Trend, unique users | `session_started` | `entryPath` | Where do visits start? |
| Search landings | Trend, unique users | `session_started`, `$referring_domain` contains google, bing, duckduckgo | `entryPath` | Which pages does search bring people to? |
| Page reach | Table, unique users | `$pageview` | `$pathname` | Reach of each page (views are once per session). |
| Landing to play | Funnel, 1-day window | `session_started` with `entryPath` in the content, regional and intent pages → `onboarding_step` `draft_started` | `entryPath` | Which landing pages turn a reader into a player? |
| Manager page to career | Funnel, 7-day window | `session_started`, `entryPath` in `/rocket-league-manager`, `/pt/manager-rocket-league` → `onboarding_step` `career_created` | `entryPath` | Does the manager landing page feed the career mode? |
| Database traffic | Trend, unique users | `$pageview`, `$pathname` starts with `/rlcs` | first two path segments (SQL) | Are the 670 database pages visited? |
| Database to game | Funnel, 1-day window | `session_started`, `entryPath` starts with `/rlcs` → `$pageview` `$pathname = /` or `/play` → `onboarding_step` `draft_started` | none | Do database visitors become players? |
| Language | Trend, unique users | `session_started` | `locale`; country (GeoIP) | PT against EN; Germany was 47% of search clicks. |
| Referrers | Table, unique users | `session_started` | `$referring_domain` | Discord, X, Reddit, search. |

Use PostHog Web Analytics as well for referrers and countries; it reads the same
`$pageview` events. Bounce rate and time on page are not available
(`$pageleave` is off).

### 4.9 Dashboard "Health and budget"

| Insight | Type | Events and filters | Breakdown | Question |
|---|---|---|---|---|
| Events per day | Trend, total | all events | event name | What does the bill consist of? |
| Events per player-day | SQL | events / distinct devices per day; mean, median, p90, p99 | none | Is the 40-per-player-day design holding? |
| Month to date and projection | SQL, number | as in 4.1 | none | When to raise `playersPerDay`. |
| Sampling in force | Trend, average `sampleWeight` | `run_completed` | none | 1 while the guard is at level 0. |
| Guard hits | Trend, unique users | `quality_event_cap` | `kind`, `level` | Loops, bots, or real heavy players? |
| Screen errors | Table, total and unique users | `quality_error` | `route`, `name`, `release` | What breaks, since which release? |
| Save errors | Trend, total | `quality_save_error` | `store`, `kind` | Full storage, corrupt saves? |
| Migrations | Trend, total | `quality_migration` | `store`, `fromVersion` → `toVersion` | Are saves upgrading as expected? |
| Duplicate grants | Trend, total | `quality_duplicate_reward` | `kind` | Is a reward path firing twice? |
| Slow advances | Trend, total; p90 of `ms` | `quality_slow_advance` | `kind`, device type | Career performance in the field. |
| Releases in the wild | Trend, unique users | `session_started` | `release` | How fast does a deploy reach players? |

### 4.10 Volume against the 1M limit

| Input | Value | Source |
|---|---|---|
| Players per day before launch | about 45 (1,349 player-days in 30 days) | A1 |
| Events per player-day, 1.x | 127 (172,028 in 30 days) | A1 |
| Events per player-day, 2.0 design | about 40 (career part is an estimate) | A1 |
| Plan | 1,000,000 events a month | A1 |

| Players per day | Events a month at 40 per player-day |
|---|---|
| 45 (today) | 54k |
| 120 (the number in the file) | 144k |
| 450 (10× today) | 540k |
| 700 (guard level 1 starts) | 840k |
| 833 | 1M |

- November already spent about 63k on 1.x (11 days). The 19 days left hold an
  **average of about 1,230 players a day** at 40 events each before 1M. Assumes a
  calendar-month cycle: check the billing date in PostHog.
- One-off at launch: 1 `quality_migration` per returning device, and up to 7
  `onboarding_step` per new device. Small.
- If the real figure is 80 per player-day (twice the estimate), level 0 still
  holds to about 415 players a day.

**`public/analytics-budget.json` needs no change at launch.** Keep
`{ "playersPerDay": 120 }`: the number only matters against the 700 threshold.
48 hours after the deploy, read "Events per player-day" and the projection. Set
`playersPerDay` to the measured daily devices (and deploy) when either daily
devices pass 700 for two days, or the month projection passes 850k.

## 5. Not verified

- A production-format export (the `out/` on disk is a staging build, made before the four edits).
- The production Worker's build variables in Cloudflare.
- Anything in PostHog, Search Console, Supabase or on the live site.
- PostHog's billing cycle date and what the plan does at the limit.
- That retention and lifecycle insights behave as expected with anonymous-only events.
- The leaderboard work in progress (its test file does not typecheck right now).
