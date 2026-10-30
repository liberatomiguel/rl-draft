# Project Status — current state only

> Last updated: **2026-10-29**. History: `CHANGELOG.md`; rationale:
> `DESIGN-DECISIONS.md` / `ROAD-TO-WORLDS-DECISIONS.md` (grep them, never read
> them whole). The 2.0 plan of record, its stages and approval gates:
> `ROADMAP.md`.

## Where things are

- **Production:** `main` @ v1.4.6 (`rocketdraft.app`, static export on an
  assets-only Cloudflare Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** branch `staging`, published as **v2.0.0-rc.32**
  (`staging.rocketdraft.app`: career on, noindex, preview tools on, no
  analytics). **Never deploy v2.0 to `main` before the full review.**
- Road to Worlds (career): `ROAD-TO-WORLDS-STATUS.md`. If a push to `staging`
  does not trigger the `rocket-draft-staging` Workers Build, check its GitHub
  connection / watch paths.

## What v2.0 contains

The Season reset and Season Rating, accounts v2, missions, login streak,
event cards, Profile/Leaderboard/Home v2, Daily Quiz, Challenges 2.0,
cosmetics, the database expansion, Road to Worlds 2.0 and the completion
plan's Etapas 1, 2a and 2b (rc.27–32; `ROADMAP.md` "Done", CHANGELOG).

## Where the completion plan stands

- **Etapa 1 + 1b: done** (rc.27–29). **Gate 1:** answered by Miguel's 28/10
  plan.
- **Etapa 2a: done** (rc.30 + rc.32) except ENG-03's fixtures from real
  exported saves.
- **Etapa 2b:** part 1 in rc.31 (R46–R49); **part 2 in rc.32** (R50–R60):
  the economy decisions as **provisional defaults** (each flips back to
  rc.31 by its `balance.ts` key), DEV-01, M2, BAL-02, the age clock; the
  Etapa 3 contracts written; DRAFT-11 and WEB-02 pulled forward.
- **Next: Etapa 2b part 3**, Miguel's 30/10 answers on rc.32 (`ROADMAP.md`
  Etapa 2, "2b part 3": the rescue partner, 3 / 2 / 1 breaches, the 12 %
  scale, a per-contract prize share, the negotiation, honest bands, the
  EU path, the seat rule, the screens). The re-measure to beat is
  `ECONOMY-CONTRACT.md` §9.

## Open before `main`

- **Miguel (V2 plan §6, in order):** A staging Supabase + Worker vars; B the
  production SQL (§6-B — its freeze trigger goes in at the cutover if any v1.x
  client signs in); C freeze the pre-season board; D grants; E Cloudflare vars
  + resubmit the sitemap.
- **Manual regression on staging** (V2 plan §7) plus the rc.29–rc.32 lists in
  `ROADMAP.md`. Lighthouse; event-card curation; a PT pass; the v2.0 player
  notes.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **1021** tests (+9 opt-in tools
  skipped) · `npm run lint` **0 errors, 0 warnings** · `build:data` +
  `validate:data` green · green `npm run build` for anything that ships. Visual
  effects: `npm run perf:probe` (#130).
- A change to a `balance.ts` value bumps `BALANCE_VERSION` (now 2):
  `balanceVersion.test.ts` prints the new fingerprint.
- Data or pool changes: `difficulty.matrix.test.ts` (`SIM_MATRIX=1`) before and
  after; `challenges.tune.test.ts` (`CH_TUNE=1`) if challenges leave their
  bands (#136–#137). Shared-sim changes regenerate the golden master only with
  a CHANGELOG-documented decision.
- Career sweeps before and after any economy or growth change:
  `CAREER_ECON=1` (294 careers, ~25 min in four processes by
  `ECON_REGIONS`), `CAREER_ARC=1` / `CAREER_CURVES=1`, `CAREER_GROWTH=1`
  (never set `CAREER_ARC` with `ARC_REPORT`: it replays the sweep).
- Perf reference (rc.32, a staging-like Turbopack export, `node
  scripts/request-budget.mjs`): cold home **26** requests; a whole Classic run
  from a cold home **56–59**, desktop and mobile (budget 75; rc.31 65–78). The
  dataset chunk (62 KB gz) loads on game pages only; home first-load JS 288 KB
  gz.

## Standing facts

- Saves = `localStorage` on `https://rocketdraft.app` only; persist keys and
  versions frozen by `src/store/persistContract.test.ts`.
- Career is off in production builds unless `NEXT_PUBLIC_CAREER_MODE=1`;
  `/career` is always noindex.
- Accounts are code-complete; production never had the Supabase variables
  (#55, `ACCOUNTS-SETUP.md`).
- Analytics: PostHog, EU, cookieless, lazy, **production only** (staging,
  playtest and dev never send, #145); the 2.0 catalogue is provisional.
- A local `npm run build` rewrites badge/banner hashes in
  `src/generated/asset-manifest.json` (platform rasterization): don't commit
  hash-only changes.

## Backlog (not blocking)

- `specialCards.json` (~10 KB gz) on every page; PT locale not lazy;
  deploy-skew 404s; no `og:image` on content pages; lazy PostHog can miss
  UTMs. Missing optional art (fallbacks render): 20 special photos, 23 org
  logos. Deferred items and rc.32's findings: `ROADMAP.md` ("Deferred").
