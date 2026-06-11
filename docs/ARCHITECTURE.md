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
| `playoffs.ts` | Single-elim Bo7 bracket (V2: swap for double elim here) |
| `tournament.ts` | Stage orchestration: swiss → playoffs → finished |
| `results.ts` | Placement, highlights, unlocks, achievements, XP breakdown |
| `achievements.ts` | One rule function per achievement |
| `progression.ts` | XP → rank mapping |

### Determinism

`src/lib/rng.ts` is a seeded mulberry32 RNG. Each run stores its `seed` and
the current cursor (`rngState`). Every store action recreates the RNG from the
cursor, runs engine calls, then persists the new cursor — so **reloading the
page resumes the run with identical randomness**, and daily challenges
(shared seed) come almost for free later.

## State layer (`src/store`)

- `runStore.ts` — the active run (one state machine:
  `draft → review → tournament → results`). Persisted under
  `rocket-draft:run:v1` so refresh resumes mid-run. Actions are thin: they
  call engine functions and store the result.
- `profileStore.ts` — long-term progress (XP, wins, collection, achievements,
  run history) under `rocket-draft:profile:v1`. `applyRunResults` is called
  exactly once per run by `finishRun`.
- `useMounted.ts` — SSR-safety gate: persisted state renders after first
  client mount to avoid hydration mismatches.

Both stores have a `version` field for future migrations.

## UI layer

- `src/app/play/page.tsx` switches screens on `run.phase`. There is no URL
  per phase on purpose: the run is one continuous, refresh-safe flow.
- `components/screens/*` — one file per phase plus `RunStepper` (progress +
  abandon).
- `components/cards/GameCard.tsx` — single renderer for every card kind and
  state (draft offer, review, reveal, collection, hidden-overall).
- `components/ui/*` — small presentational primitives.
- `src/content/copy.ts` — every player-facing string (tone: broadcast desk).
  Localization later = translate this one file.
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
| Swap playoffs for double elim | `src/engine/playoffs.ts` |
| Add a game mode (Quick Draft) | new engine options + a setup entry |
| Plug Liquipedia/Supabase | reimplement `src/data/index.ts` exports |
| Translate the UI | `src/content/copy.ts` |
