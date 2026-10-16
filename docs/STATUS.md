# Project Status — current state only

> Last updated: **2026-10-16**. History lives in `CHANGELOG.md`; rationale in
> `DESIGN-DECISIONS.md`. Grep those, never read them whole.

## Where things are

- **Production:** `main` @ v1.4.6, live on Cloudflare (`rocketdraft.app`,
  static export, assets-only Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** branch `claude/dazzling-cannon-1d6thr`, published as
  **v2.0.0-rc.1 on `staging`** (`staging.rocketdraft.app`, career on, noindex).
  Phases 0–3 of `V2-IMPLEMENTATION-PLAN.md` are done; Phase 4 is in progress.
  **Never deploy v2.0 to `main` before the full review.**
- **Road to Worlds (career)** is a separate workstream: `ROAD-TO-WORLDS-STATUS.md`.

## What v2.0 contains (shipped on the branch)

Season reset + legacy snapshot (profile v12), Season Rating, cosmetics
(titles/badges/frames/banners), Supabase v2 client, missions + login streak,
event cards + Special Hunt, series variety, bracket spoiler fix; recap screen,
Profile v2, Leaderboard v2 + Hall of Fame, missions UI, Daily Quiz, Home v2;
Challenges 2.0 (3 stars, 4 gauntlets, 24 validated); Road to Worlds 2.0
(weekly payroll, bank loan, HQ rebuilt, Training 2.0, Wednesday qualifier,
real orgs by season, permanent achievements, weekly inserts, colour kits).
Decisions: DESIGN-DECISIONS #110–#118, ROAD-TO-WORLDS-DECISIONS R20–R34.

## Open before `main` (Phase 4)

- **Miguel (plan §6, in order):** A staging Supabase project + Worker vars;
  B production SQL (season columns, `profile_grants`, freeze trigger, views);
  C freeze the pre-season board once at launch; D grants; E Cloudflare vars +
  resubmit sitemap.
- **Manual regression on staging** (plan §7): fresh / pre-season / signed-in
  profiles, two devices, all run modes, event cards, quiz, challenges, career
  end to end. Lighthouse. Event-card curation and a PT pass.
- Then merge to `main`, tag `v2.0.0`, move this section into CHANGELOG.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **483** tests / 38 files (385 on `main`)
  · `npm run lint` at baseline **5 errors + 1 warning** (pre-existing:
  TournamentScreen, AnimatedNumber, Modal, useMounted, calibrate-rarity)
  · `build:data` + `validate:data` green · green `npm run build` for anything
  that ships (`prebuild` validates data, contract test, images; `postbuild`
  checks the export).
- Perf reference on `wrangler dev` (rc.1, career on): cold home **25**
  requests, `/career` 34, 0 same-origin 4xx across 21 routes, home HTML 9.8 KB
  gz, `out/` 1,206 files / 40 MB. Keep it there.

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
  hand-maintained `achievements.json` and `specialCards.json`.

## Backlog (not blocking)

- `@/data` barrel still on the shared path (#60); PT locale not lazy-loaded;
  `CAREER_*` constants still in `balance.ts`; deploy-skew 404s after a deploy
  (keep previous `_next/static` or show a reload hint); content pages lack
  `og:image`; lazy PostHog can miss UTMs.
- Missing optional art (fallbacks render): special photos
  `sp-repi-wings-e-sports`, `sp-ninja23509-wings-e-sports`,
  `sp-freedom-og-brazil-goat`; org logos `bodybuilders`, `cringe-society`,
  `pioneers-oce`, `poison-bullets`, `sapphire`, `senbei-strikers`.
- `specialCards.json` `"secret": true` on two Wings cards has no effect
  (implement or delete). S9 Worlds is a 12-team approximation; 2026 field
  provisional. A few players are countryless; coach bonus types are
  hash-derived; Liquipedia art may collide on same-name orgs.
