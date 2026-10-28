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
| `npm run build` | Static export to `out/` (`prebuild` validates data, runs the persist contract test and builds the WebP images; `postbuild` checks the export) |
| `npm run start` | Serve `out/` locally with `wrangler dev` (port 8787) — stop it when done |
| `npm test` | Engine + data + store test suite (vitest) |
| `npm run typecheck` / `npm run lint` | TypeScript check / ESLint |
| `npm run build:data` | Regenerate the dataset JSONs from `data-sources/teams.md` |
| `npm run validate:data` | Validate the JSON dataset only |
| `npm run test:contract` | The frozen localStorage persist contract (`src/store/persistContract.test.ts`) |
| `npm run build:images` | Hashed WebP for every art PNG/SVG + `src/generated/asset-manifest.json` |
| `npm run build:badges` / `npm run build:banners` | Generate the badge / banner SVGs from Miguel's design files in `data-sources/` |
| `npm run perf:probe` | Headless-Chrome frame/paint probe for visual effects |
| `npm run fetch:assets` | Download org logos and flags into `public/` |

> **`npm run dev` says "connection refused"?** A previous dev server didn't
> shut down cleanly. Close stray `node.exe` processes (Task Manager) and
> delete the `.next` folder — Next 16 keeps a single-instance lock in
> `.next/dev/lock` that blocks new servers.

## Stack

- **Next.js 16** (App Router, Turbopack, React Compiler) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens in `src/app/globals.css`)
- **Zustand** (state + localStorage persistence)
- **Zod** (dataset validation)
- **Vitest** (engine, data and store tests)
- Hosting: a **pure static export** served by an assets-only Cloudflare Worker
  (`wrangler.jsonc`, runbook `docs/DEPLOY-CLOUDFLARE.md`) — no server code.

Progress is saved locally (guest play). An optional account layer (Supabase,
**email + 6-digit code**) syncs to the cloud and powers the leaderboards when
the `NEXT_PUBLIC_SUPABASE_*` variables are set; otherwise it stays dormant
(`docs/ACCOUNTS-SETUP.md`). Analytics: PostHog, EU, cookieless, lazy
(`docs/ANALYTICS.md`).

## Project layout

```txt
src/
├── app/            Routes: / · /play · /career (Road to Worlds) · /collection · /challenges · /quiz ·
│                   /missions · /leaderboards · /profile · /achievements · /settings · content pages
│                   (/how-to-play · /faq · /strategy · /ratings · /special-cards · /about · /changelog · …) · /pt
├── components/     screens (draft run), career (Road to Worlds), cards, cosmetics, layout, ui
├── config/
│   ├── balance.ts  ⚖️ EVERY tunable number in the game
│   └── season.ts   The current season (id, dates, event-card windows)
├── content/        Player-facing strings: copy.en.ts + copy.pt.ts (career: copy.career.*.ts),
│                   content pages (pages.*.json) — copy.ts / careerCopy.ts are the access layer
├── data/           📦 Generated dataset JSONs + hand-maintained specialCards / achievements /
│                   challenges + zod schemas + cosmetics catalog
├── engine/         🧠 Pure game logic — zero React imports (career/ = Road to Worlds)
├── lib/            Seeded RNG, assets, analytics, Supabase client, small utils
└── store/          Zustand stores (run, profile, career, settings, account)
```

**Golden rule:** game logic lives in `src/engine` (pure, deterministic,
testable); the UI only calls engine functions through the stores.

## Documentation

Start with `AGENTS.md` (conventions + the reading path), then `docs/STATUS.md`
(current state). For Road to Worlds: `docs/ROAD-TO-WORLDS-STATUS.md`.

| Doc | Contents |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | Current state, gates, what is open (short, current-state only) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The 2.0 plan of record: stages, approval gates, backlog IDs, decisions waiting on Miguel |
| [docs/V2-IMPLEMENTATION-PLAN.md](docs/V2-IMPLEMENTATION-PLAN.md) | v2.0 plan: Miguel's to-do (§6), launch regression checklist (§7), open decisions (§8) |
| [docs/ROAD-TO-WORLDS-STATUS.md](docs/ROAD-TO-WORLDS-STATUS.md) | Career mode state + system → file map |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data flow, how a run works end to end |
| [docs/DATA-GUIDE.md](docs/DATA-GUIDE.md) | How to edit/add cards, lineups, orgs — field by field |
| [docs/BALANCE-GUIDE.md](docs/BALANCE-GUIDE.md) | Balance knobs and how to retune them |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Decisions beyond the base design doc (grep, do not read whole) |
| [docs/ROAD-TO-WORLDS-DECISIONS.md](docs/ROAD-TO-WORLDS-DECISIONS.md) | Career-mode decisions (R1…) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history + bugfix log (root causes) |
| [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md) | Hosting runbook (static export, Workers Static Assets) |
| [docs/ACCOUNTS-SETUP.md](docs/ACCOUNTS-SETUP.md) · [docs/ANALYTICS.md](docs/ANALYTICS.md) | Supabase accounts · PostHog events |
| [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) | The original base design document |

## Scope

- **Production (`main`, rocketdraft.app):** v1.4.6.
- **`staging` (staging.rocketdraft.app):** v2.0 "Season 1" release candidates —
  season reset + Season Rating, cosmetics, missions, login streak, event cards,
  Daily Quiz, Challenges 2.0, the v2.0 database expansion (Region-only mode,
  national teams) and **Road to Worlds**, the career mode (flag-gated:
  `NEXT_PUBLIC_CAREER_MODE=1`). See `docs/STATUS.md` for what is still open.
