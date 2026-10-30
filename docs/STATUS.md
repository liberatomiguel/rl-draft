# Project Status — current state only

> Last updated: **2026-10-30**. History: `CHANGELOG.md`; rationale:
> `DESIGN-DECISIONS.md` / `ROAD-TO-WORLDS-DECISIONS.md` (grep them, never read
> them whole). The 2.0 plan of record, its stages and approval gates:
> `ROADMAP.md`.

## Where things are

- **Production:** `main` @ v1.4.6 (`rocketdraft.app`, static export on an
  assets-only Cloudflare Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** branch `staging`, published as **v2.0.0-rc.35**
  (`staging.rocketdraft.app`: career on, noindex, preview tools on, no
  analytics). **Never deploy v2.0 to `main` before the full review.**
- Career: `ROAD-TO-WORLDS-STATUS.md`. A push to `staging` that does not
  trigger the `rocket-draft-staging` Workers Build: check its GitHub
  connection / watch paths.

## What v2.0 contains

The Season reset and Season Rating, accounts v2, missions, login streak,
event cards, Profile/Leaderboard/Home v2, Daily Quiz, Challenges 2.0,
cosmetics, the database expansion, Road to Worlds 2.0, the completion plan's
Etapas 1–2 and most of 3 (rc.27–34), and Etapa 4's national album (rc.33).

## Where the completion plan stands

- **Etapas 1–2: built** (rc.27–33; ENG-03's fixtures from real saves
  open). **Gate 2** waits on Miguel's play.
- **Etapa 3: built in rc.34** (R71–R80): training packages (DEV-03),
  sponsors (ECO-04/05), HQ around the next decision (UX-01), "New" markers and
  contracts (UX-06), and Miguel's 31/10 answers on rc.33 (the bank's loan and
  its deadline, the talk, the difficulty step). Re-measured in
  `ECONOMY-CONTRACT.md` §11. **Gate 3b** waits on Miguel's play
  (`ROADMAP.md` "Waiting on Miguel").
- **rc.35:** Miguel's rc.34 playtest — training simplified (14-day cycles),
  sponsors priced by risk, the progression ladder, the talk's odds and
  bonus, creation/market/squad visuals (R81–R82; `ECONOMY-CONTRACT.md` §12).
- **Next in Etapa 3:** UX-02 (season goals), UX-03 (news, 50/50), UX-04
  (creation), UX-05 (achievements), CAL-01, SUN-01..03.

## Open before `main`

- **Miguel (V2 plan §6, in order):** A staging Supabase + Worker vars; B the
  production SQL (§6-B — its freeze trigger goes in at the cutover if any v1.x
  client signs in); C freeze the pre-season board; D grants; E Cloudflare vars
  + resubmit the sitemap.
- **Manual regression on staging** (V2 plan §7) plus the rc.29–rc.34 lists in
  `ROADMAP.md`. Lighthouse; event-card curation; a PT pass; the v2.0 player
  notes.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **1353** tests (+10 opt-in tools
  skipped) · `npm run lint` **0 errors, 0 warnings** · `build:data` +
  `validate:data` green · green `npm run build` for anything that ships. Visual
  effects: `npm run perf:probe` (#130).
- A `balance.ts` value change bumps `BALANCE_VERSION` (now 5;
  `balanceVersion.test.ts` prints the fingerprint). A version bump touches
  `package.json`, `package-lock.json` and `src/config/site.ts`; run the full
  suite after it.
- Data or pool changes: `difficulty.matrix.test.ts` (`SIM_MATRIX=1`) before and
  after; `challenges.tune.test.ts` (`CH_TUNE=1`) if challenges leave their
  bands (#136–#137). Shared-sim changes regenerate the golden master only with
  a CHANGELOG-documented decision.
- Career sweeps before and after any economy or growth change:
  `CAREER_ECON=1` (294 careers, ~37 min in four processes by
  `ECON_REGIONS`), `CAREER_ARC=1` (alone on the machine: its bot stops a
  career at 120 s; never with `ARC_REPORT`), `CAREER_GROWTH=1`,
  `CAREER_TRAINING=1`.
- Browser E2E of an rc: `node scripts/e2e-smoke.mjs` (home, a PT Classic run,
  a career's first weeks; desktop + mobile, EN + PT) on the export served by
  `wrangler dev`.
- Perf (rc.34, staging-like export, `node scripts/request-budget.mjs`):
  cold home **26** requests, a whole Classic run **57–60** (budget 75; as
  rc.33). The dataset chunk (62 KB gz) loads on game pages only; the home's
  scripts are 340 KB gz (rc.33 339).

## Standing facts

- Saves = `localStorage` on `https://rocketdraft.app` only; persist keys and
  versions frozen by `src/store/persistContract.test.ts`.
- Career is off in production builds unless `NEXT_PUBLIC_CAREER_MODE=1`;
  `/career` is always noindex.
- Accounts are code-complete; production never had the Supabase variables
  (#55, `ACCOUNTS-SETUP.md`).
- Analytics: PostHog, EU, cookieless, lazy, **production only** (staging,
  playtest and dev never send, #145); the 2.0 catalogue is provisional.
- A local `npm run build` may rewrite badge/banner hashes in
  `src/generated/asset-manifest.json`: don't commit hash-only changes.

## Backlog (not blocking)

- `specialCards.json` (~10 KB gz) on every page; PT locale not lazy;
  deploy-skew 404s; no `og:image` on content pages; lazy PostHog can miss
  UTMs. Missing optional art (fallbacks render): 20 special photos, 23 org
  logos. Deferred items: `ROADMAP.md` ("Deferred").
