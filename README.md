# Rocket Draft

**A fan-made Rocket League esports history draft game.** Build a roster from
iconic RLCS lineups — 3 players, a coach, a substitute and an organization —
then survive a simulated RLCS-style championship: Swiss stage into playoffs.

> Fan-made, non-commercial project for educational purposes. Not affiliated
> with Psyonix, Epic Games or any esports organization.

---

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Engine + data test suite (vitest) |
| `npm run build:data` | Regenerate all data JSONs from `data-sources/teams.md` |
| `npm run validate:data` | Validate the JSON dataset only |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

> **`npm run dev` says "connection refused"?** A previous dev server didn't
> shut down cleanly. Close stray `node.exe` processes (Task Manager) and
> delete the `.next` folder — Next 16 keeps a single-instance lock in
> `.next/dev/lock` that blocks new servers.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens in `src/app/globals.css`)
- **Zustand** (state + localStorage persistence)
- **Zod** (dataset validation)
- **Vitest** (engine tests)

No backend in the MVP — progress is saved locally (guest play). The
architecture is prepared for Supabase + Discord OAuth later (see
[docs/ROADMAP.md](docs/ROADMAP.md)).

## Project layout

```txt
src/
├── app/            Routes: / · /play · /collection · /profile · /how-to-play
├── components/
│   ├── cards/      GameCard (rarity frames), MiniCard, roster views
│   ├── layout/     AppShell (top nav + mobile bottom nav)
│   ├── screens/    Setup · Draft · Review · Tournament · Results
│   └── ui/         Button, Panel, Badge, Modal, ProgressBar, Toggle…
├── config/
│   └── balance.ts  ⚖️ EVERY tunable number in the game
├── content/
│   └── copy.ts     All player-facing strings (broadcast tone, l10n-ready)
├── data/           📦 JSON dataset + zod schemas + validated loader
├── engine/         🧠 Pure game logic — zero React imports
├── lib/            Seeded RNG, small utils
└── store/          Zustand stores (active run + persistent profile)
```

**Golden rule:** game logic lives in `src/engine` (pure, deterministic,
testable); the UI only calls engine functions through the stores.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) | The original base design document |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data flow, how a run works end to end |
| [docs/DATA-GUIDE.md](docs/DATA-GUIDE.md) | How to edit/add cards, lineups, orgs — field by field |
| [docs/BALANCE-GUIDE.md](docs/BALANCE-GUIDE.md) | Every balance knob, current values, how to retune |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Decisions taken beyond the base doc + open questions |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history + bugfix log |
| [docs/ROADMAP.md](docs/ROADMAP.md) | MVP 2-4 plan (collection, accounts, Liquipedia API) |

## MVP scope (v0.1.0)

Implemented: Classic Draft (free choice, 6 slots), Easy/Normal/Hard + locked
Legacy, rerolls by difficulty, hidden-overall mode with results reveal, base
card rarities (silver/gold/blue), special cards with collection unlocks,
chemistry, org buffs, coach/sub systems, Swiss (16 teams, Bo5) + single-elim
Bo7 playoffs, results screen with XP/rank/achievements, local persistence
(refresh-safe runs), responsive desktop + mobile.

Not yet: login/sync, Liquipedia API, daily challenges, Quick/Regional Draft,
double-elimination playoffs. See the roadmap.
