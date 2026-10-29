# Analytics events for 2.0 — the contract (OBS-01, PROPOSAL)

> Status: **proposal, waiting for Miguel's approval** (ROADMAP Etapa 2a). No
> capture code exists for anything below except the six Draft events already in
> `src/lib/analytics.ts`. Etapa 2b builds what is approved. The operational
> PostHog guide (PT) stays `ANALYTICS.md`.

## Rules (unchanged from today, now written down for the career too)

- One SDK, one project per environment. Production keeps its key. Staging and
  playtest get **their own PostHog project** (or no key at all), never the
  production one, so test runs never reach the real dashboards.
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
| `release` | `package.json` version (`2.0.0-rc.30`) | Compare before/after a release |
| `balanceVersion` | a new `BALANCE_VERSION` constant in `balance.ts`, bumped by any tuning commit | Split data across retunes inside one release |
| `schemaVersion` | `1` (bumped when an event's shape changes) | Keep old and new payloads apart |
| `environment` | `production` · `staging` · `playtest` · `dev` (from the build) | A second guard against mixed data |
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
| `ux_sunday_briefing` | careerId, choice (keep, recover, prepare) — SUN-01, once built |
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
   biggest one).
2. ~~Staging/playtest~~ — **decided 29/10:** no analytics there for now (few
   players); tests verify the payloads, production gets the events at launch.
3. `BALANCE_VERSION`: a hand-bumped constant (proposed), or the git short hash
   at build time?
