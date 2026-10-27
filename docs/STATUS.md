# Project Status — current state only

> Last updated: **2026-10-27**. History lives in `CHANGELOG.md`; rationale in
> `DESIGN-DECISIONS.md`. Grep those, never read them whole.

## Where things are

- **Production:** `main` @ v1.4.6, live on Cloudflare (`rocketdraft.app`,
  static export, assets-only Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** built on the `staging` branch, published as
  **v2.0.0-rc.26** (`staging.rocketdraft.app`, career on, noindex, preview
  tools on: unlock-all cosmetics switch on /profile, fictional boards).
  Phases 0–3 of `V2-IMPLEMENTATION-PLAN.md` are done; Phase 4 is in progress.
  **Never deploy v2.0 to `main` before the full review.**
- **Road to Worlds (career)** is a separate workstream: `ROAD-TO-WORLDS-STATUS.md`.
- If a push to `staging` does not trigger the `rocket-draft-staging` Workers
  Build (happened at rc.20), check the build's GitHub connection / watch paths.

## What v2.0 contains (shipped on the branch)

Season reset + legacy snapshot (profile v12), Season Rating, Supabase v2
client, missions + login streak, event cards + Special Hunt, recap screen,
Profile v2, Leaderboard v2 + Hall of Fame, Daily Quiz, Home v2, Challenges 2.0,
Road to Worlds 2.0. **Cosmetics are final** (rc.20–23): 35 badges as
pre-rendered WebP (`build:badges` → `build:images`), 36 titles, 18 banners as
WebP art (`build:banners`), login calendar, rank track, unlock pop-up.
**rc.24 = the v2.0 database expansion** (Miguel's base export, 2026-10-26):
438 lineups (was 289), real birth dates (career ages), **Region-only mode for
NA, EU, SAM, MENA and OCE** with per-region boosts fitted to worldwide parity,
and **national teams** (FIFAe 2024/2025, 32 teams): a rare draw (2.5% per
offer), all-gold "National team" specials, the whole team collected on sight,
their own collection album. **rc.25:** difficulty calibrated on live PostHog
play by reset profile (every pool ≈ live worldwide rates; Hard/Legacy grinders
capped at the live level; worldwide Legacy 1.6), APAC/SSA closed with their
regional rosters dormant, D01 fixed via card-id aliases. Decisions:
DESIGN-DECISIONS #110–#142, ROAD-TO-WORLDS-DECISIONS R20–R39. Cosmetics reference: `COSMETICS-CATALOG.md`.

## Open before `main` (Phase 4)

- **Miguel (plan §6, in order):** A staging Supabase project + Worker vars;
  B production SQL (season columns, `profile_grants`, freeze trigger, views);
  C freeze the pre-season board once at launch; D grants; E Cloudflare vars +
  resubmit sitemap.
- **Manual regression on staging** (plan §7): fresh / pre-season / signed-in
  profiles, two devices, all run modes, event cards, quiz, challenges, career
  end to end. **rc.24 adds:** one Region-only run per region (feel of each
  difficulty), a national-team find (rare — `/collection?dev=1` previews the
  album), the album in EN and PT, a new career (real ages). **rc.26 adds:**
  Classic / Quick / Daily from a cold home, the home quiz modal, leaving a run
  mid-draft (#142). Lighthouse.
  Event-card curation and a PT pass. The in-game changelog page still stops
  at 1.4.2 (write the v2.0 player notes at launch).
- **Decide:** worldwide Legacy is 1.6 (typical ≈2.8 %, grinders ≈12.5 % = live);
  1.3 keeps typical ≈3.7 % but grinders ≈16 % (#140).
- Open details: login-calendar XP values are a first pass; `early-supporter`
  must exist in `profile_grants` when granted; Season 2 needs its own
  rank-track items.
- Then merge to `main`, tag `v2.0.0`, move this section into CHANGELOG.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **555** tests / 43 files (+2 opt-in
  tools skipped) · `npm run lint` at baseline **5 errors** (pre-existing:
  TournamentScreen ×2, AnimatedNumber, Modal, one more react-hooks rule)
  · `build:data` + `validate:data` green · green `npm run build` for anything
  that ships (`prebuild` validates data, contract test, images; `postbuild`
  checks the export). For visual effects: `npm run perf:probe` (#130).
- **Data or pool changes:** run `difficulty.matrix.test.ts` (`SIM_MATRIX=1`)
  before and after, and `challenges.tune.test.ts` (`CH_TUNE=1`) if challenges
  leave their bands (DESIGN-DECISIONS #136–#137).
- Perf reference on `wrangler dev` (rc.1, career on): cold home **25**
  requests, `/career` 34, 0 same-origin 4xx across 21 routes, home HTML 9.8 KB
  gz. Dataset chunk (rc.26, #142): **62 KB gz**, loaded only by the game pages
  (`src/data/sharedPath.test.ts` keeps the layout, home and content pages off
  it); home first-load JS **288 KB gz** (was 367).

## Standing facts

- Player saves = `localStorage` on `https://rocketdraft.app` only; persist keys
  and versions frozen by `src/store/persistContract.test.ts`.
- Career mode is off in production builds unless `NEXT_PUBLIC_CAREER_MODE=1`
  (on in dev/tests). `/career` is always noindex.
- Accounts: code complete (email + code, cloud sync, boards); production has
  never had the Supabase variables. Invariant: DESIGN-DECISIONS #55. Setup:
  `ACCOUNTS-SETUP.md`.
- Analytics: PostHog only, EU, cookieless, lazy (`ANALYTICS.md`). SEO: apex
  canonical, www → apex 301; resubmit the sitemap after page changes.
- Data is generated from `data-sources/teams.md` (`build:data`), except the
  hand-maintained `achievements.json`, `specialCards.json` and
  `challenges.json`. National-team cards are derived at load time (`@/data`).

## Backlog (not blocking)

- `specialCards.json` (~10 KB gz) still ships on every page (counters,
  prune); PT locale not lazy-loaded; `CAREER_*` constants still in
  `balance.ts`; deploy-skew 404s after a deploy (keep previous
  `_next/static` or show a reload hint); content pages lack `og:image`; lazy
  PostHog can miss UTMs.
- Missing optional art (fallbacks render): special photos for the Wings pair,
  `sp-freedom-og-brazil-goat` and the 18 rc.24 specials; 23 org logos
  (`public/orgs/README.md` lists every expected file).
- `specialCards.json` `"secret": true` on two Wings cards has no effect
  (implement or delete). S9 Worlds is a 12-team approximation; 2026 field
  provisional. Coach bonus types are hash-derived; Liquipedia art may collide
  on same-name orgs.
