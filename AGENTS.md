<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rocket Draft — project conventions

Fan-made Rocket League esports history draft game (Miguel's project; he
communicates in PT-BR, the product UI is in English). Next.js 16 + React 19 +
Tailwind v4 + Zustand + Zod + Vitest. Hosted as a **pure static export on
Cloudflare Workers Static Assets** (runbook: `docs/DEPLOY-CLOUDFLARE.md`).

**Start here — keep orientation cheap.** Read **`docs/STATUS.md`** (current
state + next steps); that alone orients you for almost any task. Everything else
is **reference, fetched on demand — NOT bedtime reading**:
- `docs/CHANGELOG.md` (append-only history), `docs/DESIGN-DECISIONS.md`,
  `docs/GAME-DESIGN.md`, `docs/ARCHITECTURE.md`, `data-sources/*-audit.md`:
  **grep for the entry you need; never read the whole file.**
- **Road to Worlds (career mode) is a SEPARATE workstream with its own docs** —
  `docs/ROAD-TO-WORLDS-STATUS.md` (start here for career work), `-DESIGN.md`
  (spec), `-DECISIONS.md` (decisions). Keep it separate from the draft game:
  career decisions go in `ROAD-TO-WORLDS-DECISIONS.md`, NOT `DESIGN-DECISIONS.md`.
- Data is LARGE — `data-sources/teams.md` (~1900 lines) and `src/data/*.json`
  (hundreds of records): **query with grep or a Node one-liner; never load the
  whole file** into context.
- Read a source file only when you're about to change it (or its direct callers).

Following this keeps a fresh chat at ~tens of k tokens of orientation instead of
pulling the whole repo in. STATUS.md must stay **current-state only** — when a
version ships, move its narrative to CHANGELOG.md and trim STATUS.

## Hard rules

- **Game logic only in `src/engine`** (pure TS, no React, deterministic via
  the seeded RNG in `src/lib/rng.ts`). UI calls engine through `src/store`.
- **Every tunable number** goes in `src/config/balance.ts` — never inline
  magic numbers for gameplay values.
- **Every player-facing string** goes in `src/content/copy.en.ts` AND its PT
  translation in `copy.pt.ts` (both keyed identically); `copy.ts` is only the
  runtime access layer (`useCopy`/`getCopy`). Broadcast tone: clean esports-desk
  language, no forced memes. **Career strings** go in `copy.career.en.ts` /
  `copy.career.pt.ts` and are read via `useCareerCopy()` / `getCareerCopy()`
  (`src/content/careerCopy.ts`). Import those only from `src/app/career/**` and
  `src/components/career/**`. `useCopy()` has no `CAREER` group.
- **Hosting = pure static export** (`output: "export"` → `out/`), served by an
  assets-only Worker (`wrangler.jsonc`). **No server code and no Worker script**:
  no `main`, no `run_worker_first`, no OpenNext/`@opennextjs/cloudflare`, no
  Pages Functions, no middleware/proxy, no Server Actions, no ISR, and no route
  handlers that read the request. Any of these puts every visit on the
  100k/day Worker cap. **Never** add `headers`/`redirects`/`rewrites` to
  `next.config.ts`. Headers go in `public/_headers`; redirects go in Cloudflare
  zone rules. Metadata routes need `export const dynamic = "force-static"`.
- **Links: always `AppLink`** (`@/components/ui/AppLink`, intent-only
  prefetch), never `next/link`. ESLint enforces this.
- **Asset URLs come from `src/lib/assets.ts`** (`orgLogoSrc`, `specialPhotoSrc`,
  `rankSrc`, `flagSrc`). Never hand-build `/orgs/<id>.png`-style URLs. The
  helpers return `null` for missing art, so the fallback renders without a 404.
  The one exception is GameCard's special photo. It passes the raw
  `/cards/specials/<id>.png` to `next/image`, gated by `hasSpecialPhoto`, and
  `src/lib/imageLoader.ts` maps it to WebP.
- **Player saves = `localStorage` on `https://rocketdraft.app` only.** The
  persist keys/versions are frozen by `src/store/persistContract.test.ts`.
  Change its `CONTRACT` only on purpose, with a DESIGN-DECISIONS entry and an
  additive `migrate`. Never serve the game from another host.
- **`FEATURES.careerMode`** (balance.ts) is on in dev/test. Production builds
  turn it on only with `NEXT_PUBLIC_CAREER_MODE=1` (never for the production
  deploy until career ships). `scripts/postexport.mjs` mirrors the expression,
  so keep them in sync.
- **The data JSONs are GENERATED** (since v0.4). Source of truth is
  `data-sources/teams.md`. To change data: edit it, run `npm run build:data`,
  then `npm run validate:data`. Do NOT hand-edit `src/data/*.json` **except**
  `achievements.json` AND `specialCards.json` — both are HAND-MAINTAINED.
  `specialCards.json` was decoupled from the generator in v1.1.1 (the
  `build-dataset.mjs` comments say v1.1.0 — they predate the decouple; Miguel
  curates the special cards by hand, 80+ entries); `build:data` only *reads* it
  to re-validate base-card refs and never overwrites it. The legacy `SPECIALS`
  catalogue in `scripts/build-dataset.mjs` is reference-only now. To add/edit a
  special card: edit `src/data/specialCards.json`, then `npm run validate:data`.
  Field reference + generator mappings: `docs/DATA-GUIDE.md`.
- After engine/balance changes run `npm test` — the suite asserts the design
  anchors from `docs/GAME-DESIGN.md` §25 (overall must stay dominant) and is
  dataset-agnostic (no hardcoded ids).
- Update `docs/CHANGELOG.md` (Added/Changed/Balance/Fixed) with every
  meaningful change; bugfixes always get a root-cause line.
- Design deviations from `docs/GAME-DESIGN.md` must be recorded in
  `docs/DESIGN-DECISIONS.md`.
- Commit per milestone with a `vX.Y.Z` message (Miguel wants version history).

## Pitfalls learned the hard way (do not repeat)

- **Never bulk-edit files via PowerShell `-replace`** — PS 5.1 mis-decodes
  UTF-8 and corrupts `·`/`→`/accents (mojibake). Use the Edit tool; if it
  happens, `git checkout -- <file>` and redo.
- **Always stop preview/dev servers you start.** Orphaned `node.exe` +
  Next 16's `.next/dev/lock` block Miguel's own `npm run dev`
  ("connection refused"). Cleanup: kill node processes, delete `.next`.
  `npm run start` / `npm run preview:static` is now `wrangler dev` serving
  `out/` (port 8787). It's a server too, so stop it. `next start` does not work
  with the export.
- On Windows, Next's export writes the prefetch segments as `__next.*` *folders*
  (backslash paths), and every prefetch 404s. `scripts/postexport.mjs`
  (postbuild) flattens them automatically and fails the build if the names
  drift. Keep that step.
- `public/_headers`: every matching rule applies and duplicate values get
  comma-joined. So `Cache-Control` goes only in path-specific rules, never under
  `/*`.
- A local `npm run build`/`deploy` reads `.env.local`, which holds the Supabase
  keys. A local deploy would switch accounts on in production.
- The `lite-fx` fallbacks in `globals.css` ("Lite effects") match the exact
  bg/blur utility classes of the sticky bars, overlays and Modal. If you change
  those classes, update the selectors.
- `position: fixed` breaks inside animated ancestors (transform containing
  block) — modals/toasts render via portal on `<body>`; keep `rise-in`
  fill-mode `backwards`.
- Plain `conic-gradient` does not repeat its segment — use
  `repeating-conic-gradient` for ray effects.
- Miguel may edit `data-sources/` or drop images into `public/` in parallel —
  don't overwrite his files without checking `git status` first.

## Asset drop-in conventions (no code changes needed)

`public/orgs/<orgId>.png` (era variant: `<orgId>@<era>.png`) ·
`public/ranks/menu/<rankId>.png` · `public/ranks/profile/<rankId>.png` ·
`public/cards/specials/<specialId>.png` · `public/flags/<cc>.png` (lowercase ISO
code). Every folder except flags has a generated README that lists the exact
filenames. Styled fallbacks render while files are missing.

The source PNGs stay the source of truth, so drop them in the same folders as
before.
- **Dev** shows the raw PNG immediately.
- **Production** uses hashed WebP that the build generates
  (`prebuild` → `build:images` → `public/img/**`, which is git-ignored).
- After adding or replacing art, run **`npm run build:images`** and **commit
  `src/generated/asset-manifest.json`**. The manifest decides which art exists
  in production. A PNG dropped after a build only appears in production after
  the next build.
- Never hand-edit the manifest or `public/img/`.
