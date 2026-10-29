# Project Status — current state only

> Last updated: **2026-10-29**. History: `CHANGELOG.md`; rationale:
> `DESIGN-DECISIONS.md` / `ROAD-TO-WORLDS-DECISIONS.md` (grep them, never read
> them whole). The 2.0 plan of record, its stages and approval gates:
> `ROADMAP.md`.

## Where things are

- **Production:** `main` @ v1.4.6 (`rocketdraft.app`, static export on an
  assets-only Cloudflare Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** branch `staging`, published as **v2.0.0-rc.30**
  (`staging.rocketdraft.app`: career on, noindex, preview tools on).
  **Never deploy v2.0 to `main` before the full review.**
- Road to Worlds (career): `ROAD-TO-WORLDS-STATUS.md`. If a push to `staging`
  does not trigger the `rocket-draft-staging` Workers Build, check its GitHub
  connection / watch paths.

## What v2.0 contains

The Season reset and Season Rating, accounts v2, missions, login streak,
event cards, Profile/Leaderboard/Home v2, Daily Quiz, Challenges 2.0,
cosmetics, the database expansion, Road to Worlds 2.0 and the completion
plan's Etapas 1–2a so far (rc.27–30; `ROADMAP.md` "Done", CHANGELOG).

## Where the completion plan stands

- **Etapa 1 + 1b: done** (rc.27–29). **Gate 1:** answered by Miguel's 28/10
  plan (playtest + direction), now written into `ROADMAP.md` by ID.
- **Etapa 2a, rc.30:** package A closed the rc.29 integration (review
  fixes, direct-8 decided once a week, legacy saves, the one-time career
  repair, PT run labels). The long-career harness and its baseline are in
  (`CAREER-BASELINE-rc30.md`: 59 % of careers insolvent, 63 % on Normal; no
  93+ rookie in the dataset eras; specials above potential). The analytics
  contract is a proposal (`ANALYTICS-EVENTS-2.0.md`). Still open in 2a:
  ENG-01 audit, DATA-01, ENG-02 rest, real-save fixtures.
- **Next, 2b** (after Miguel's four answers in `ROADMAP.md`): ECO-02/03 and
  DEV-01/02 first, then ECO-01, BAL-02, RTW-01, OBS-01, re-measured on the
  same seeds.

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

- `npm run typecheck` clean · `npm test` **752** tests (+5 opt-in tools
  skipped) · `npm run lint` **0 errors, 0 warnings** · `build:data` +
  `validate:data` green · green `npm run build` for anything that ships. Visual
  effects: `npm run perf:probe` (#130).
- Data or pool changes: `difficulty.matrix.test.ts` (`SIM_MATRIX=1`) before and
  after; `challenges.tune.test.ts` (`CH_TUNE=1`) if challenges leave their
  bands (#136–#137). Shared-sim changes regenerate the golden master only with
  a CHANGELOG-documented decision.
- Career sweeps: `CAREER_ARC=1` / `CAREER_CURVES=1` (`careerArc.test.ts`)
  before and after any economy or growth change (Etapa 2b).
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
  deploy-skew 404s; no `og:image` on content pages; lazy PostHog can miss
  UTMs. Missing optional art (fallbacks render): 20 special photos, 23 org
  logos. Deferred items: `ROADMAP.md` ("Deferred").
