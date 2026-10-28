# Project Status — current state only

> Last updated: **2026-10-28**. History: `CHANGELOG.md`; rationale:
> `DESIGN-DECISIONS.md` / `ROAD-TO-WORLDS-DECISIONS.md` (grep them, never read
> them whole). The 2.0 plan of record, its stages and approval gates:
> `ROADMAP.md`.

## Where things are

- **Production:** `main` @ v1.4.6 (`rocketdraft.app`, static export on an
  assets-only Cloudflare Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** branch `staging`, published as **v2.0.0-rc.29**
  (`staging.rocketdraft.app`: career on, noindex, preview tools on).
  **Never deploy v2.0 to `main` before the full review.**
- Road to Worlds (career): `ROAD-TO-WORLDS-STATUS.md`. If a push to `staging`
  does not trigger the `rocket-draft-staging` Workers Build, check its GitHub
  connection / watch paths.

## What v2.0 contains

Season reset (profile v12) + Season Rating, Supabase v2 client, missions,
login streak, event cards, recap, Profile/Leaderboard/Home v2, Daily Quiz,
Challenges 2.0, final cosmetics, the database expansion (438 lineups, real
ages, Region-only, national teams), live-data difficulty (rc.25), the dataset
off the shared path (rc.26), Road to Worlds 2.0, and Etapas 1 and 1b
(rc.27–29, #143–#144, R40–R44; `ROADMAP.md` "Done").

## Where the completion plan stands

- **Etapa 1 + 1b: done** (rc.27–29).
- **Gate 1, now:** Miguel plays rc.29 on staging and answers the
  decisions in `ROADMAP.md` ("Waiting on Miguel"). Nothing in Etapa 2 starts
  before that.
- **Etapa 2, next:** first the instruments (long-career harness, save
  fixtures, module audit, dataset check), then the economy, growth curves
  and the RTW difficulty contract (ECO-01/02/03, DEV-01/02, BAL-02, RTW-01,
  OBS-01).

## Open before `main`

- **Miguel (V2 plan §6, in order):** A staging Supabase + Worker vars; B the
  production SQL (§6-B — its freeze trigger goes in at the cutover if any v1.x
  client signs in); C freeze the pre-season board; D grants; E Cloudflare vars
  + resubmit the sitemap.
- **Manual regression on staging** (V2 plan §7) plus: a Region-only run per
  region, a national-team find, Classic/Quick/Daily from a cold home, leaving
  mid-draft, a Swiss without rematches, a Saturday qualifier → Sunday
  regional, a Major weekend (reload on Saturday), an OT game in the Match
  Center. Lighthouse; event-card curation; a PT pass; the v2.0 player notes.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **736** tests (+2 opt-in tools
  skipped) · `npm run lint` **0 errors, 0 warnings** · `build:data` +
  `validate:data` green · green `npm run build` for anything that ships. Visual
  effects: `npm run perf:probe` (#130).
- Data or pool changes: `difficulty.matrix.test.ts` (`SIM_MATRIX=1`) before and
  after; `challenges.tune.test.ts` (`CH_TUNE=1`) if challenges leave their
  bands (#136–#137). Shared-sim changes regenerate the golden master only with
  a CHANGELOG-documented decision.
- Perf reference (rc.29, webpack export): cold home 28 requests; a whole
  Classic run from a cold home 77–80 (budget 75, Etapa 5 WEB-02). The dataset
  chunk (62 KB gz) loads on game pages only; home first-load JS 288 KB gz.

## Standing facts

- Saves = `localStorage` on `https://rocketdraft.app` only; persist keys and
  versions frozen by `src/store/persistContract.test.ts`.
- Career is off in production builds unless `NEXT_PUBLIC_CAREER_MODE=1`;
  `/career` is always noindex.
- Accounts are code-complete; production never had the Supabase variables
  (#55, `ACCOUNTS-SETUP.md`). Analytics: PostHog, EU, cookieless, lazy.
- A local `npm run build` rewrites badge/banner hashes in
  `src/generated/asset-manifest.json` (platform rasterization): don't commit
  hash-only changes.

## Backlog (not blocking)

- `specialCards.json` (~10 KB gz) on every page; PT locale not lazy;
  deploy-skew 404s; content pages lack `og:image`; lazy PostHog can miss UTMs.
- Missing optional art (fallbacks render): 20 special photos, 23 org logos.
- Deferred E2E items and their owner stage: `ROADMAP.md` ("Deferred").
