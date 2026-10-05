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
│  Data      src/data (JSON; zod at build/CI) · balance.ts │  content + tuning
└──────────────────────────────────────────────────────────┘
```

## Data layer

- `src/data/*.json` — the hand-curated dataset (see DATA-GUIDE.md).
- `src/data/index.ts` — the runtime data layer. It serves **typed casts** of the
  JSON (no zod in the browser), builds the lookup `Map`s (throwing on a
  duplicate id), and exports typed arrays/maps. **Every other module reads data
  through here** — a future Liquipedia/Supabase source only changes this file's
  internals. It still mirrors zod's one transform: it strips the undeclared
  `secret` key from 2 special cards.
- `src/data/schemas.ts` + `src/data/validate.ts` — **build/CI-time validation
  only.** `validateDataset()` runs the zod schemas, duplicate-id checks,
  referential integrity (every id mentioned anywhere must exist) and the rank
  check. `src/data/integrity.test.ts` calls it, so it runs in `npm test`,
  `npm run validate:data` and the `prebuild` hook of `npm run build`. A typo in a
  JSON file therefore fails the build, not a player's page load. That test also
  asserts the runtime casts deep-equal the zod output (an undeclared key fails
  CI) and that no runtime file imports `zod`/`schemas`/`validate`.
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
| `challenges.ts` | Rank-unlocked authored puzzles: constrained draft + single Bo7 vs a fixed boss lineup (pure, reuses draft + series engine) |

### Determinism

`src/lib/rng.ts` is a seeded mulberry32 RNG. Each run stores its `seed` and
the current cursor (`rngState`). Every store action recreates the RNG from the
cursor, runs engine calls, then persists the new cursor — so **reloading the
page resumes the run with identical randomness**. Daily challenges build on the
same primitive: a date-derived seed makes every player's daily run identical
(see Game modes → Daily Challenge).

## State layer (`src/store`)

FOUR Zustand stores, three with their own localStorage key + schema version.
**The `:v1` suffix in every key is a fixed namespace string, NOT the schema
version** — the actual schema version is the `version` number passed to the
persist middleware (runStore at version 3, profileStore at version 11, settings
unversioned). The fourth, `accountStore` (v1.4), holds the live Supabase
session/sync state and is **not localStorage-persisted** — it rehydrates from
the Supabase session at runtime. The Supabase SDK is a lazy chunk, loaded at
startup only when a stored session exists. A full sync runs once per page load
per signed-in user, then a debounced push (`CLOUD_SYNC.pushDebounceMs`) sends
later profile changes. Every sync waits for profile hydration, folds in the
profile currently saved in localStorage, and aborts without pushing if the
cloud read fails (see `ACCOUNTS-SETUP.md`). The persist keys and versions are
frozen by `src/store/persistContract.test.ts` (DESIGN-DECISIONS #107). The
career store (`rocket-draft:career:v1`, version 3) loads only when career mode
is on. A fifth store, `achievementToastStore`, is also
**non-persisted** (an in-memory toast queue, no localStorage key).

- `runStore.ts` — the active run (one state machine:
  `draft → review → tournament → results`).
  - key `rocket-draft:run:v1`, version **3**.
  - `partialize` persists only `{ run }` (the run-state machine).
  - `migrate` **drops** any pre-v3 persisted run (`version < 3 → { run: null }`)
    — the run shape changed in v0.2 (double elim) and v0.3 (modes), so a stale
    run is discarded rather than resumed broken.
  - Actions are thin: they call engine functions and store the result.
- `profileStore.ts` — long-term progress.
  - key `rocket-draft:profile:v1`, version **11**.
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
- `accountStore.ts` (`useAccountStore`, v1.4) — Supabase session/sync state
  (am I signed in, who am I, am I syncing). Read by the header chip, the Profile
  account hub and the Leaderboards. Not localStorage-persisted; with no Supabase
  env it sits in a permanent `signedOut` state and every action is a no-op, so
  the app is unchanged for guests.
- `achievementToastStore.ts` — non-persisted in-memory queue for achievement
  toasts.
- `useMounted.ts` — SSR-safety gate: persisted state renders after first
  client mount to avoid hydration mismatches.

### Persistence & sync boundary

The stores split along a hard line that the Supabase mirror (shipped v1.4,
code-complete and dormant until the Supabase env vars are set) respects. That
mirror lives in `accountStore` + `src/lib/supabase.ts` (auth/queries) +
`src/lib/profileSync.ts` (the durable-slice merge):

- **`runStore` is EPHEMERAL.** It is the active-run state machine — disposable
  by design (leaving to the menu clears it; there is no resume system beyond a
  single in-flight run). It does NOT need to sync anywhere.
- **`profileStore` is the DURABLE, sync-worthy progress** — the only store a
  cloud mirror has to carry. Its full `ProfileState` (verified against
  `profileStore.ts`) is:
  - `xp`
  - `mmr` — cosmetic skill rating (v1.4), parallel to XP; profile card +
    leaderboard only, never spent or lost
  - `legacyUnlocked` (v1.4) — the Legacy-difficulty gate, set once by a real
    Classic/Quick Hard (or Legacy) championship (`selectLegacyUnlocked`)
  - `runsCompleted`
  - `wins` — championships per difficulty (`easy`/`normal`/`hard`/`legacy`)
  - lifetime counters `playoffAppearances`, `podiums`, `swissWinsTotal`
    (kept separate because they outlive the capped run history)
  - `gamesWon`, `goalsScored` — lifetime individual-game achievement counters (v1.4)
  - `unlockedSpecials` — specialCardId → ISO unlock date
  - `achievements` — achievementId → ISO earned date
  - `runHistory` — most-recent-first, capped at `HISTORY_LIMIT`
  - `dailyResults` — ISO date → daily result (placement/xp/label)
  - `challengesCompleted` (v1.4) — challengeId → ISO date cleared (one-and-done)
  - `records` (v1.4) — leaderboard aggregates: peak team overall per difficulty
    and per pool (`bestOverallWorldwide`/`bestOverallSam`)
  - `settings` (setup memory) — `lastDifficulty`, `lastShowOverall`,
    `lastMode`, `lastRegionLock`
  - `flags` (onboarding) — `seenHowToPlay`, `seenLegacyIntro`,
    `seenRegionalIntro`
- `settingsStore` is per-device preference (sound/motion/anim/lang) and is not
  progress — it stays local.

## Game modes

`RunMode` (on `RunState.mode`) is `classic | quick | daily | challenge`:

- **classic** — the full game: 6-slot draft (3 players + coach + sub + org) →
  16-team Swiss → 8-team double-elimination playoffs.
- **quick** — players only (no coach/sub/org slots) → straight single-elim
  bracket. `PlayoffState.format` is `single` for these runs.
- **daily** — the classic structure run against a date-seeded modifier set
  (see below).
- **challenge** (v1.4) — a rank-unlocked authored puzzle: a constrained draft
  then a single Bo7 against a fixed boss lineup, scored one-and-done. Its run
  flow uses a dedicated `challenge` phase on `RunPhase` (`draft → challenge →
  results`) rather than the swiss/playoffs tournament path. See
  `src/engine/challenges.ts`.

### Daily Challenge

`src/lib/daily.ts` turns a UTC date string into a deterministic challenge:

- `seedFromDate(date)` hashes the date with **FNV-1a** into the mulberry32 run
  seed. **The same date yields the same seed for every player** — the draft,
  opponents and modifiers are identical worldwide. (The daily leaderboard —
  shipped v1.4, dormant until Supabase env is set — depends on exactly this
  guarantee.)
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
custom game events. It sends each event to a single sink — PostHog (the Vercel
Web Analytics sink was dropped in v1.4 as redundant) — and is a **no-op until
keyed** (PostHog needs `NEXT_PUBLIC_POSTHOG_KEY`), so calling it never blocks
gameplay. `posthog-js` is a **lazy chunk**. `PostHogProvider` imports it after
the window `load` event plus idle time, and until then `trackEvent` queues
events (cap 50) with their original timestamps and URLs, then replays them.
Feature flags/remote config and `$pageleave` are disabled.
Event payloads are pre-flattened to scalars. Only the UI/store layer may call
it — **the engine must NEVER import analytics** (it has to stay pure and
deterministic, AGENTS.md hard rule). The event catalogue is the typed `GameEvents`
in `analytics.ts`; for how to read the data (funnels/filters, the funnel-vs-Trends
gotcha) see the operator guide **`docs/ANALYTICS.md`**.

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
  the active language selected via `settingsStore` (`lang`). Career strings are
  split out into `copy.career.{en,pt}.ts`, read only through `useCareerCopy()`
  (`src/content/careerCopy.ts`), so they never ship in the core copy chunk.
- **Internal links use `AppLink`** (`components/ui/AppLink.tsx`), never
  `next/link` directly; ESLint enforces it. It prefetches only on intent (mouse
  hover / keyboard focus), not on viewport entry (DESIGN-DECISIONS #103).
- **Images go through `src/lib/assets.ts`** (see Asset pipeline). Never
  hard-code `/orgs/…`, `/flags/…`, `/ranks/…` or `/cards/specials/…` URLs in a
  component.
- Other `src/lib` helpers: `rng` (seeded RNG), `daily` (daily generator),
  `analytics` (`trackEvent`), `sfx` (sound), `shareCard` (result-card image),
  `util` (ids/misc).
- Theme tokens + card frames + animations live in `src/app/globals.css`
  (Tailwind v4 `@theme`). Tailwind scans `src/` only (`source("..")`). The
  "Lite effects" block at the end applies under `html.lite-fx` (automatic on
  low-memory devices or OS reduced motion, set in `SettingsEffects.tsx`) and
  under `html.force-reduce-motion` (Settings → Reduce motion). Its opaque
  fallbacks match exact utility-class strings in AppShell, CareerTopBar,
  FoundingSplash, FirstRunTutorial, ResultsScreen and Modal, so if you change
  those elements' background/blur classes, update the matching selector.

## Asset pipeline (images)

The drop-in convention is unchanged: PNGs go in `public/orgs/`, `public/flags/`,
`public/ranks/{menu,profile}/` and `public/cards/specials/`. What ships to
production is generated from them:

- **`scripts/build-images.mjs`** (sharp; runs in `prebuild`, or
  `npm run build:images`) writes content-hashed WebP to `public/img/**`
  (git-ignored):
  - org logos at 96 and 264 px (`orgs/<key>.<hash>.<w>.webp`; `<key>` is
    `<orgId>` or `<orgId>@<era>`);
  - special photos at 256 and 512 px;
  - rank emblems in a 224 px box.

  It also writes the committed **`src/generated/asset-manifest.json`**, which
  says which flags, orgs, specials and ranks have a file. It is deterministic
  and incremental, prunes stale files, and each output's URL hash covers the
  source bytes plus that category's encoder settings, so a settings change
  yields new URLs (no cache stamp; `--force` redoes everything). Widths are
  written to the manifest's `widths` and read by `src/lib/assets.ts`; change
  them only in `scripts/build-images.mjs` (`ORG_WIDTHS` / `SPECIAL_WIDTHS`).
  `postexport` verifies that every manifest URL exists in `out/`.
- **`src/lib/assets.ts`** is the only place that builds asset URLs: `flagSrc`,
  `orgLogoSrc(key, displayPx)` (≤ 32 CSS px → 96 px file, else 264 px),
  `hasSpecialPhoto`, `specialPhotoSrc(id, width)` and `rankSrc(variant, id)`.
  - In production they return the hashed, percent-encoded `/img/…` URL
    (`/flags/<cc>.png` for flags), **or `null` when the file doesn't exist**.
    Components then render their fallback (text chip, monogram, CSS emblem,
    stylized art) without making a request.
  - In dev/test they return the raw PNG paths and treat every asset as present,
    so a freshly dropped PNG shows on refresh.
- **`src/lib/imageLoader.ts`** is the custom `next/image` loader
  (`images.loader: "custom"`). The only `next/image` is the special-card photo:
  the loader maps `/cards/specials/<id>.png` to the 256/512 px WebP, and
  `deviceSizes: [512]` + `imageSizes: [256]` keep the srcset at exactly those two
  widths. In dev, `unoptimized` serves the raw PNG.
- A PNG dropped after a build reaches production only on the next
  `npm run build`.

## Hosting & build (static export on Cloudflare)

Production is a **pure static export** served by **Cloudflare Workers Static
Assets**, with **no Worker script** (DESIGN-DECISIONS #102; account/DNS steps in
the runbook `docs/DEPLOY-CLOUDFLARE.md`). Static-asset
requests are not metered there. There is no server runtime, so nothing may be
added that needs one: route handlers that read the request,
`rewrites`/`redirects`/`headers()`, middleware/proxy, Server Actions, ISR, or
dynamic routes without `generateStaticParams`.

- **`next.config.ts`** sets `output: "export"` (writes `out/`), `reactCompiler`
  and the custom image loader. `trailingSlash` stays false. There is no
  `inlineCss` (DESIGN-DECISIONS #104). `robots.ts`, `sitemap.ts` and
  `manifest.ts` are `force-static`. The OG image and the apple icon are static
  PNGs (`src/app/opengraph-image.png`, `apple-icon.png`) picked up by Next's
  file conventions. `layout.tsx` must not set `metadata.icons`: that would
  suppress the file-convention icons.
- **`npm run build`** runs three stages:
  1. `prebuild`: `validate:data` (dataset integrity), then `test:contract`
     (the persist-contract save gate), then `build:images`;
  2. `next build`;
  3. `postbuild`: `scripts/postexport.mjs`.

  The `postexport` steps:
  - flatten Next's Windows-only `__next.*` segment folders (a no-op on Linux);
  - strip `out/career*` when career mode is off;
  - check that every route has its `__PAGE__` prefetch file;
  - check that the required files exist;
  - check that every image URL `assets.ts` can request exists in `out/`;
  - reject non-https or loopback `NEXT_PUBLIC_POSTHOG_HOST` /
    `NEXT_PUBLIC_SUPABASE_URL` (unless `ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1`
    is set in the shell, for measurement builds that must never be deployed)
    and log whether accounts and analytics are ENABLED;
  - check Cloudflare's limits (20,000 files, 25 MiB per file).

  Always build through `npm run build`: a bare `next build` skips validation
  and image generation.
- **`wrangler.jsonc`** is assets-only (`assets.directory: "./out"`, no `main`)
  and sets:
  - `not_found_handling: "404-page"` (serves `out/404.html`);
  - `html_handling: "auto-trailing-slash"` (`/play` serves `play.html`;
    `/play/` → 307 → `/play`);
  - `workers_dev: false`, `preview_urls: false`;
  - the apex custom-domain route `rocketdraft.app`.

  `www` → apex is a Cloudflare zone Redirect Rule, not code.
- **`public/_headers`** holds the caching rules. `/_next/static/*` and `/img/*`
  are immutable for a year (content-hashed). Unhashed `public/` folders and
  icons get 1–7 day TTLs. HTML and `.txt` RSC payloads keep the host default
  (`max-age=0, must-revalidate` + ETag), so a deploy is visible on the next
  load. Every response gets `nosniff` + `Referrer-Policy`. Never put
  `Cache-Control` under `/*`: matching rules combine.
- **Local preview / deploy:** `npm run preview:static` (also `npm start`) runs
  `wrangler dev` on `out/`; `next start` does not work with a static export.
  `npm run deploy` = `npm run build && wrangler deploy` (needs `wrangler login`).
  `NEXT_PUBLIC_*` values are inlined at **build** time: from `.env.local` for a
  local build, or from Cloudflare **Build variables** for Workers Builds.
- **Career gating:** `FEATURES.careerMode` is on in dev/tests and off in
  production builds unless `NEXT_PUBLIC_CAREER_MODE=1` is set at build time
  (ROAD-TO-WORLDS-DECISIONS R19).

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
| Add/edit cards, lineups, orgs | `src/data/*.json` only (validated by `npm run validate:data` / `npm test` / `prebuild`) |
| Add an image (logo, flag, rank, special photo) | drop the PNG in `public/…`; `npm run build` regenerates the WebP + manifest |
| Rebalance difficulty/sim/XP | `src/config/balance.ts` only |
| Change a playoff round / add a bracket reset | `src/engine/playoffs.ts` (double elim already ships; `PLAYOFF_ROUND_ORDER`) |
| Add a game mode | new engine options + a `RunMode` + a setup entry |
| Plug Liquipedia (data source) | reimplement `src/data/index.ts` exports |
| Sync profiles to Supabase (shipped v1.4) | the durable slice in `src/lib/profileSync.ts` + `accountStore` + `src/lib/supabase.ts` mirror `profileStore` `ProfileState` only |
| Translate the UI | add a `copy.*.ts` dictionary; switch via `settingsStore` |
