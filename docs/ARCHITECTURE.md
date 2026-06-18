# Architecture

Rocket Draft is built in four strict layers. Each layer only talks to the one
below it. **Game logic never imports React; UI never computes game rules.**

```txt
┌──────────────────────────────────────────────────────────┐
│  UI        src/app + src/components                      │  screens, cards
├──────────────────────────────────────────────────────────┤
│  State     src/store (zustand + localStorage persist)    │  orchestration
├──────────────────────────────────────────────────────────┤
│  Engine    src/engine (pure TypeScript, deterministic)   │  game rules
├──────────────────────────────────────────────────────────┤
│  Data      src/data (JSON + zod) · src/config/balance.ts │  content + tuning
└──────────────────────────────────────────────────────────┘
```

## Data layer

- `src/data/*.json` — the hand-curated dataset (see DATA-GUIDE.md).
- `src/data/schemas.ts` — zod schemas; a typo in a JSON file becomes a clear
  startup error, not a silent gameplay bug.
- `src/data/index.ts` — parses everything once, builds lookup `Map`s, runs
  referential-integrity checks (every id mentioned anywhere must exist), and
  exports typed arrays/maps. **Every other module reads data through here** —
  a future Liquipedia/Supabase source only changes this file's internals.
- `src/config/balance.ts` — every tunable number (difficulty profiles, rating
  weights, chemistry weights, simulation variance, XP, ranks).

## Engine layer (`src/engine`)

Pure functions: `(state, rng) → new state`. No side effects, no React, no
storage. Fully unit-tested (`npm test`).

| Module | Responsibility |
| --- | --- |
| `types.ts` | Every domain type (entities, run state, tournament, results) |
| `cards.ts` | Resolve raw refs into display-ready cards; rarity; stat fallback |
| `draft.ts` | Draft state machine: offers, picks, rerolls, skips, exclusions |
| `chemistry.ts` | Chemistry points → percent → tier, with breakdown items |
| `rating.ts` | Team rating = avg player overall + bounded modifiers |
| `teams.ts` | Build a `TournamentTeam` from a user roster or a historical lineup |
| `opponents.ts` | Difficulty-weighted opponent sampling + special upgrades |
| `match.ts` | Series simulation (per-series form + per-game rolls + situational stats) |
| `swiss.ts` | 16-team Swiss: pairings by record, records, seeding |
| `playoffs.ts` | 8-team bracket: double-elim Bo7 (classic, `PLAYOFF_ROUND_ORDER`) or single-elim (quick); `PlayoffState.format` selects |
| `tournament.ts` | Stage orchestration: swiss → playoffs → finished |
| `results.ts` | Placement, highlights, unlocks, achievements, XP breakdown |
| `achievements.ts` | One rule function per achievement |
| `progression.ts` | XP → rank mapping |

### Determinism

`src/lib/rng.ts` is a seeded mulberry32 RNG. Each run stores its `seed` and
the current cursor (`rngState`). Every store action recreates the RNG from the
cursor, runs engine calls, then persists the new cursor — so **reloading the
page resumes the run with identical randomness**. Daily challenges build on the
same primitive: a date-derived seed makes every player's daily run identical
(see Game modes → Daily Challenge).

## State layer (`src/store`)

THREE persisted Zustand stores, each with its own localStorage key and schema
version. **The `:v1` suffix in every key is a fixed namespace string, NOT the
schema version** — the actual schema version is the `version` number passed to
the persist middleware (run/profile are both at version 3, settings unversioned).

- `runStore.ts` — the active run (one state machine:
  `draft → review → tournament → results`).
  - key `rocket-draft:run:v1`, version **3**.
  - `partialize` persists only `{ run }` (the run-state machine).
  - `migrate` **drops** any pre-v3 persisted run (`version < 3 → { run: null }`)
    — the run shape changed in v0.2 (double elim) and v0.3 (modes), so a stale
    run is discarded rather than resumed broken.
  - Actions are thin: they call engine functions and store the result.
- `profileStore.ts` — long-term progress.
  - key `rocket-draft:profile:v1`, version **3**.
  - `migrate` deep-merges `settings`/`flags` (so new keys pick up defaults on
    old saves) and backfills the lifetime counters (`playoffAppearances`,
    `podiums`, `swissWinsTotal`) + `dailyResults`/setup-memory for pre-v2 saves.
  - `applyRunResults` is called exactly once per run by `finishRun`.
  - Derived selectors live in the same module: `selectLegacyUnlocked`,
    `selectDailyStreak`, `selectChampionships`, `selectBestClear`.
- `settingsStore.ts` (`useSettings`) — player settings.
  - key `rocket-draft:settings:v1`, no schema version.
  - fields: `soundEnabled`/`soundVolume`, `reducedMotion` (motion override),
    `animSpeed` (`slow`/`normal`/`fast`), `lang` (`en`/`pt`). Read by the SFX
    layer, the CSS animation-speed applier, the tournament-playback default,
    and copy access (language).
- `useMounted.ts` — SSR-safety gate: persisted state renders after first
  client mount to avoid hydration mismatches.

### Persistence & sync boundary

The stores split along a hard line that the future Supabase mirror (v1.3) must
respect:

- **`runStore` is EPHEMERAL.** It is the active-run state machine — disposable
  by design (leaving to the menu clears it; there is no resume system beyond a
  single in-flight run). It does NOT need to sync anywhere.
- **`profileStore` is the DURABLE, sync-worthy progress** — the only store a
  cloud mirror has to carry. Its full `ProfileState` (verified against
  `profileStore.ts`) is:
  - `xp`
  - `runsCompleted`
  - `wins` — championships per difficulty (`easy`/`normal`/`hard`/`legacy`)
  - lifetime counters `playoffAppearances`, `podiums`, `swissWinsTotal`
    (kept separate because they outlive the capped run history)
  - `unlockedSpecials` — specialCardId → ISO unlock date
  - `achievements` — achievementId → ISO earned date
  - `runHistory` — most-recent-first, capped at `HISTORY_LIMIT`
  - `dailyResults` — ISO date → daily result (placement/xp/label)
  - `settings` (setup memory) — `lastDifficulty`, `lastShowOverall`,
    `lastMode`, `lastRegionLock`
  - `flags` (onboarding) — `seenHowToPlay`, `seenLegacyIntro`,
    `seenRegionalIntro`
- `settingsStore` is per-device preference (sound/motion/anim/lang) and is not
  progress — it stays local.

## Game modes

`RunMode` (on `RunState.mode`) is `classic | quick | daily`:

- **classic** — the full game: 6-slot draft (3 players + coach + sub + org) →
  16-team Swiss → 8-team double-elimination playoffs.
- **quick** — players only (no coach/sub/org slots) → straight single-elim
  bracket. `PlayoffState.format` is `single` for these runs.
- **daily** — the classic structure run against a date-seeded modifier set
  (see below).

### Daily Challenge

`src/lib/daily.ts` turns a UTC date string into a deterministic challenge:

- `seedFromDate(date)` hashes the date with **FNV-1a** into the mulberry32 run
  seed. **The same date yields the same seed for every player** — the draft,
  opponents and modifiers are identical worldwide. (The v1.3 daily leaderboard
  depends on exactly this guarantee.)
- `generateDailyConfig(date)` picks the challenge: a deterministic **template
  wheel** (Pure Bracket, Regional Lockdown, eras, Blackout, No Safety Net,
  Gauntlet, Specials Surge, Legacy Day, Underdog, Champions Only…) plus an
  optional bonus objective — both rolled from the seed. `AUTHORED_DAILIES`
  **overrides** the wheel for specific hand-curated dates (still deterministic:
  a fixed config for a fixed date).
- Results are recorded in `profileStore.dailyResults`, keyed by ISO date;
  `selectDailyStreak` reads consecutive daily victories from it.

### Region lock

`RunState.regionLock` (a `Region`, e.g. `SAM`; undefined = worldwide) restricts
a classic run to one region. `lineupPoolForRegion()` (in `src/data/index.ts`)
builds that pool: the region's Worlds finalists **plus** its `samOnly` Top-8
teams. `Lineup` carries two pool flags — `samOnly` (regional team that never
reached Worlds, excluded from general/daily pools) and `rareSpawn` (easter-egg
lineup force-injected into one regional-mode offer). **Only SAM is live today.**

## Analytics

`trackEvent()` in `src/lib/analytics.ts` is the single typed entry point for
custom game events. It fans each event to two sinks — Vercel Web Analytics and
PostHog — and is a **no-op until keyed** (PostHog needs `NEXT_PUBLIC_POSTHOG_KEY`;
Vercel needs prod with Web Analytics on), so calling it never blocks gameplay.
Event payloads are pre-flattened to scalars. Only the UI/store layer may call
it — **the engine must NEVER import analytics** (it has to stay pure and
deterministic, AGENTS.md hard rule).

## UI layer

- Route `page.tsx` files are **server components** (they `export const
  metadata`) that delegate to a sibling `"use client"` `*View`. E.g.
  `src/app/play/page.tsx` exports `Metadata` and renders `PlayView`; `PlayView`
  switches screens on `run.phase`. **"No URL per phase"** applies to the phases
  *inside* `/play` (draft → review → tournament → results) on purpose: the run
  is one continuous, refresh-safe flow under a single route.
- `components/screens/*` — one file per phase plus `RunStepper` (progress +
  abandon).
- `components/cards/GameCard.tsx` — single renderer for every card kind and
  state (draft offer, review, reveal, collection, hidden-overall).
- `components/ui/*` — small presentational primitives.
- `src/content/copy.ts` is the **access layer** for player-facing strings (tone:
  broadcast desk); the actual strings live in `copy.en.ts` + `copy.pt.ts`, with
  the active language selected via `settingsStore` (`lang`).
- Other `src/lib` helpers: `rng` (seeded RNG), `daily` (daily generator),
  `analytics` (`trackEvent`), `sfx` (sound), `shareCard` (result-card image),
  `util` (ids/misc).
- Theme tokens + card frames + animations live in `src/app/globals.css`
  (Tailwind v4 `@theme`).

## How one run flows

```txt
SetupScreen ── startRun(difficulty, showOverall)
  └─ engine/draft.createDraft + drawNextOffer       phase: draft
DraftScreen ── pickCard / reroll / skipLineup  (×6 picks)
  └─ engine/draft.applyPick … complete             phase: review
ReviewScreen ── startTournament
  └─ engine/teams.buildUserTeam
  └─ engine/tournament.initTournament (15 weighted opponents)
TournamentScreen ── playRound (per click)          phase: tournament
  └─ engine/swiss.playSwissRound | playoffs.playPlayoffRound
  └─ user out? engine/tournament.fastForward (champion still crowned)
  └─ finishRun
       └─ engine/results.compileResults
       └─ profileStore.applyRunResults             phase: results
ResultsScreen ── clearRun → back to setup
```

## Extension points

| Want to… | Touch |
| --- | --- |
| Add/edit cards, lineups, orgs | `src/data/*.json` only (validated on load) |
| Rebalance difficulty/sim/XP | `src/config/balance.ts` only |
| Change a playoff round / add a bracket reset | `src/engine/playoffs.ts` (double elim already ships; `PLAYOFF_ROUND_ORDER`) |
| Add a game mode | new engine options + a `RunMode` + a setup entry |
| Plug Liquipedia (data source) | reimplement `src/data/index.ts` exports |
| Sync profiles to Supabase (v1.3) | mirror `profileStore` `ProfileState` only |
| Translate the UI | add a `copy.*.ts` dictionary; switch via `settingsStore` |
