# Analytics events for 2.0 — the contract (OBS-01)

> Status: **built in rc.32, provisional until Miguel approves** the catalogue
> (ROADMAP Etapa 2b, DESIGN-DECISIONS #145). Every event below is typed in
> `src/lib/analytics.ts` and fired from the store, except the three marked
> RESERVED (their feature is not built). "Built (rc.32)" at the end says where
> each one fires and what the build added or read differently. Production
> only: nothing is sent from staging, playtest, a local preview, dev or tests.
> The operational PostHog guide (PT) stays `ANALYTICS.md`.

## Rules (unchanged from today, now written down for the career too)

- One SDK. **Production only** (Miguel, 29/10: no analytics on staging or
  playtest for now): a hard guard, not only a missing key. `analyticsAllowed()`
  needs a production build (no `NEXT_PUBLIC_NOINDEX`, no
  `NEXT_PUBLIC_PLAYTEST`) running on `rocketdraft.app`; anywhere else the
  provider never downloads the SDK and `trackEvent` drops everything, even
  with a key set by mistake.
- Cookieless, lazy, queued until the SDK loads (`analytics.ts`); a failure to
  load or capture never touches gameplay.
- Scalars only. **No PII and no free text**: never the manager's name, the
  org's name or abbreviation, an e-mail, a username or a raw save. Ids are
  random and anonymous (below).
- Fired from the **store**, at the action that changed the state, once: the
  same moment the save is written. Never from `src/engine` (pure) and never
  from a render.
- Summaries, not streams: one event per finished event, per split, per
  season. Never one per frame, tick, goal or Advance.
- Draft and career are separate **dashboards**, not separate SDKs: every event
  carries `gameMode`, and the career events share the `career_` prefix.

## Common properties (registered once, sent with every event)

| Property | Value | Why |
|---|---|---|
| `release` | `package.json` version (`SITE.version`, kept equal by a test) | Compare before/after a release |
| `balanceVersion` | `BALANCE_VERSION` in `balance.ts` (an integer), hand-bumped by any tuning commit; `balanceVersion.test.ts` fails until it is | Split data across retunes inside one release |
| `schemaVersion` | `1` (bumped when an event's shape changes) | Keep old and new payloads apart |
| `environment` | `production` · `staging` · `playtest` · `dev` (from the build; only `production` can ever be sent) | A second guard against mixed data |
| `locale` | `en` · `pt` | Copy and onboarding questions |
| `gameMode` | `draft` · `career` (per event) | The dashboard split |

## Draft (existing events, extended)

| Event | Today | Add |
|---|---|---|
| `run_started` | mode, difficulty, hiddenOverall, region | `runId` (random per run) |
| `tournament_started` | mode, difficulty | `runId`, `region` |
| `run_completed` | mode, difficulty, placement, won, hiddenOverall, teamOverall, swissWins/Losses, xpGained | `runId`, **`region`** (missing today), `chemistryTier`, `chemistryPercent`, `durationSec`, `dailyTemplate` (DailyInfo.templateId) |
| `run_abandoned` | mode, difficulty, phase, reason, hiddenOverall, region | `runId` |
| `special_used` | specialId, title, rarity, mode, difficulty | `isNew` (not owned before this run, COL-02a) |
| `challenge_played` | challengeId, difficulty, cleared | `stars` (0–3) |
| **new** `special_discovered` | — | specialId, rarity, `national` (bool), mode — once per card, the first time it is owned |

## Career (all new; `careerId` = a random id stored in the save at creation)

| Event | When (store action) | Properties |
|---|---|---|
| `career_created` | `newCareer` | careerId, region, difficulty, rosterKey |
| `career_event_completed` | `completeEvent` (the result is banked once) | careerId, seasonIndex, tier, eventRegion, placement, qualified (qualifier only), watched, seedingDirect (regional weeks) |
| `career_milestone` | the flow that first sets it | careerId, seasonIndex, kind: `first_title` · `first_major` · `first_worlds` · `worlds_title` · `backer` · `bank_loan` · `insolvency` |
| `career_split_summary` | the Monday that closes a split (weeks 11 / 21 / 31) | careerId, seasonIndex, split, balance, payrollPerSplit, income by source (prize, sponsor, fanbase, transfers), debtBacker, debtBank, splitRank |
| `career_season_completed` | `continueToNextSeason` / the review | careerId, seasonIndex, regionRank, seasonPoints, majorsQualified, worldsPlacement, grade, balance, rep |
| `career_transfer` | sign / sell / release / renew | careerId, seasonIndex, kind, overall, age, potentialBandMid, fee, salaryPerSplit, role |
| `career_staff` | coach hired / fired, sponsor signed | careerId, kind, overall or tier, salary or basePerSplit, objectiveKind |
| `career_scout_report` | a report bought | careerId, level, age, headroomBand (bucketed, never the hidden truth) |
| `career_training_plan` | DEV-03, once approved: plan approved / delegated / completed | careerId, objective, focus, scrimLevel, delegated, gain summary |

## UX and quality (both modes)

| Event | Properties |
|---|---|
| `ux_unlock_seen` | kind (toolbox, cosmetic, challenge), id |
| `ux_contract_warning` | careerId, seen / acted (renewed, released, let go) |
| `ux_sunday_briefing` | careerId, choice (keep, recover, prepare) — SUN-01 (rc.36) |
| `ux_tutorial` | id, step, completed / skipped |
| `quality_save_error` | store, kind (quota, parse, migrate) |
| `quality_migration` | store, fromVersion, toVersion (once per save) |
| `quality_duplicate_reward` | kind, id — a grant that was refused as already given |

## Deduplication

Each career event carries `actionId = careerId:seasonIndex:day:kind:ref`. The
store fires from the state change itself (a banked result, a signed contract),
so a reload cannot fire it again; the UX events keep a short session ring of
sent ids. PostHog counts are a sample (anonymous visitors, DNT/opt-out, lost
beacons), never a census.

## Volume

About 30 career events per played season (9 regional weeks × 2 events, 3
Majors, Worlds, cups, 3 split summaries, 1 season), plus a handful of
transfers — far below the free tier, and nothing per Advance.

## Open for Miguel

1. Approve the catalogue, or cut events (the career finance summary is the
   biggest one). Built as written in rc.32 (provisional), so a cut is a
   deletion, not a build.
2. ~~Staging/playtest~~ — **decided 29/10:** no analytics there for now (few
   players); tests verify the payloads, production gets the events at launch.
3. ~~`BALANCE_VERSION`~~ — built as the hand-bumped constant (the task's
   reading); the fingerprint test makes the bump impossible to forget.
4. New mechanics from Etapa 2b part 2 are not in the catalogue yet (a
   restructuring after a Backer breach, a sale listing, the difficulty preset,
   a founding sponsor): proposed additions wait for (1).

## Built (rc.32) — where each event fires

All from the store, at the write; never from `src/engine`, never from a
render. The career events are read off the write itself
(`src/store/careerAnalytics.ts`: the save before the action and the save the
career store just wrote), so a reload, which only rehydrates, cannot fire one.
Tests: `src/lib/analytics.test.ts` (guard, common props, scalars, ring, queue),
`src/store/careerAnalytics.test.ts`, `src/store/draftAnalytics.test.ts`.

| Event | Fires in | Notes |
|---|---|---|
| `run_started` · `run_abandoned` · `tournament_started` · `run_completed` · `special_used` · `challenge_played` | `runStore` actions | `region` is one label everywhere: the lock, `daily`, a challenge's region, else `worldwide` (`run_abandoned` used to send `worldwide` for a daily). `durationSec` is wall clock from creation. `isNew` compares the card's unlock date with the run's start (stamped before the first offer). |
| `special_discovered` | `profileStore` `applyRunResults` · `collectSpecials` · `recordChallengeResult` · `completeChallenge` | Never from a hydrate or a cloud merge. `rarity` from the light catalog (`national` for `nt-` cards). |
| `career_created` | `careerStore.createCareer` | Stamps `save.careerId` (random, `c` + 16 hex). Older saves derive a stable id from their seed. |
| `career_event_completed` · `career_milestone` · `career_split_summary` · `career_season_completed` | any career write that banks it | `eventRegion` is `international` for Majors and Worlds. `first_title` counts any tier (as the save's titles do), `first_major` the first Major played, `bank_loan` each loan taken. The split summary adds `ledgerComplete` (the 160-line ledger ring may have dropped lines of a long split) and `payrollPerSplit` is the wage bill (squad + coach) at the boundary. |
| `career_transfer` | `signPlayer` · `releasePlayer` · `renewPlayer` · `acceptBid` | A full squad's signing reports the leaver (`release`) and the signing. `fee`: sign = transfer fee, sell = bid, release = severance, renew = 0. `potentialBandMid` is the shown band's midpoint. Adds `seasonIndex`. |
| `career_staff` · `career_scout_report` | `hireCoach` · `fireCoach` · `chooseSponsor` · `buyScoutReport` | Add `seasonIndex`. `headroomBand`: `0`, `1-2`, `3-5`, `6-9`, `10+` (band midpoint − overall). |
| `ux_contract_warning` | `markMailRead` (a contract mail: `seen`) · renew / release of a warned player · the rollover (`let_go`) | `outcome` carries seen / renewed / released / let_go. |
| `ux_unlock_seen` | `profileStore.markCosmeticsSeen` (`cosmetic`) · `careerStore.markMailRead` on an unlock mail (`toolbox`) | `challenge` is RESERVED: challenges have no seen marker. |
| `ux_tutorial` | `profileStore.markFlag` (`seenTutorial` with its step and skipped / completed; `seenHowToPlay`, `seenRegionalIntro`, `seenLegacyIntro`) · the career's `seenHub` | One-step explainers cannot tell close from confirm: both count as completed. |
| `quality_save_error` | the persist storage of the four stores (`store/persistStorage.ts`) | `kind` adds `write` (a non-quota write failure). Reports, then rethrows: saving behaves exactly as before. Once per store and kind per session. |
| `quality_migration` | each store's persist `migrate`; the career's per-slot `saveVersion` upgrade on load | The career's load-time upgrade is written back with the next action, so a reload before any action can repeat it (same `actionId`, count distinct). |
| `quality_duplicate_reward` | `completeChallenge` a second time · `recordChallengeResult` offered XP for stars already held | The two refusal points that exist today. |
| `ux_sunday_briefing` | `careerStore.startSunday` (rc.36, SUN-01: HQ's "Start Sunday" records `save.weekend.briefing`) | Once per Sunday event (`actionId` per event id). `keep` = the plan kept, or no pick; a spectator's Sunday (out in the Swiss) reports `keep`. |
| `career_training_plan` | RESERVED | Typed only: DEV-03 is not built. |

Every career and UX / quality event carries an `actionId`; the module sends
each `actionId` at most once per session (a ring of the last 256).
