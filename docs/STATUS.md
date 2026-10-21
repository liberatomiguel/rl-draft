# Project Status — current state only

> Last updated: **2026-10-20**. History lives in `CHANGELOG.md`; rationale in
> `DESIGN-DECISIONS.md`. Grep those, never read them whole.

## Where things are

- **Production:** `main` @ v1.4.6, live on Cloudflare (`rocketdraft.app`,
  static export, assets-only Worker). Season 1 announcement pop-up is up.
- **v2.0 "Season 1":** built on the `staging` branch, published as
  **v2.0.0-rc.16** (`staging.rocketdraft.app`, career on, noindex, preview
  tools on: unlock-all cosmetics switch on /profile, fictional boards). The old
  `claude/dazzling-cannon-1d6thr` branch stopped at rc.3.
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
real orgs by season, permanent achievements, weekly inserts, colour kits);
rc.2 UX pass (profile + locker modal, home bento, login/quiz modals, challenge
cards, hub v3, training/finances clarity), the rc.3 visual reset (tag-like
titles, quiet banners; no avatars/frames) and rc.4: Miguel's 36 illustrated
badges (`npm run build:badges` → `public/badges/`), featured badge, locker
without spoilers + green new-item dots, home missions Daily/Weekly switch,
quiz tile with Live tag, board rows (badges + title left), and "Reduce visual
effects" replacing the broken "Reduce motion"; rc.5: badge slots in the locker
(first free slot / pick a slot / swap / bin), hero badges above the rating,
taller board rows, a rebuilt player peek, quiz card reads top-down; rc.6: badge
rarity effects (holo → rainbow + sparkles → rays + tilt), Supernova (37
badges), badge showcase on the profile, no in-season rank rewards, locker
sorted by rarity, whole home cards clickable; rc.7: badge effects rebuilt
light (transform/opacity only, on-screen only); rc.8: rare plain, epic sweep;
rc.9: badges as pre-rendered WebP (build-images), board loops transform-only,
legendary sway; rc.10–11: legendary glow pre-blurred in the badge's own
silhouette (build-images *.glow.webp); rc.13: legendaries still at rest (no
rays), tilt on hover; fixed the banner-sheen main-thread bug (profile 44 ms/s,
board 19 ms/s of main thread while idle, everything unlocked).
Decisions: DESIGN-DECISIONS #110–#129, ROAD-TO-WORLDS-DECISIONS R20–R38.
Cosmetics reference: `COSMETICS-CATALOG.md` (generated).

## Open before `main` (Phase 4)

- **Miguel (plan §6, in order):** A staging Supabase project + Worker vars;
  B production SQL (season columns, `profile_grants`, freeze trigger, views);
  C freeze the pre-season board once at launch; D grants; E Cloudflare vars +
  resubmit sitemap.
- **Manual regression on staging** (plan §7): fresh / pre-season / signed-in
  profiles, two devices, all run modes, event cards, quiz, challenges, career
  end to end. Lighthouse. Event-card curation and a PT pass.
- **Cosmetics art still to come (Miguel):** the 20 titles, 16 banners and 6
  generic badges proposed in `data-sources/badges/badges-desbloqueios.md`.
  Until then titles/banners are the provisional rc.3 set. The Season 1
  rank-reward set (handed out at the season's turnover) is still to define.
- Then merge to `main`, tag `v2.0.0`, move this section into CHANGELOG.

## Gates (before any commit)

- `npm run typecheck` clean · `npm test` **493** tests / 38 files (385 on `main`)
  · `npm run lint` at baseline **5 errors** (pre-existing:
  TournamentScreen ×2, AnimatedNumber, Modal, and one more react-hooks rule)
  · `build:data` + `validate:data` green · green `npm run build` for anything
  that ships (`prebuild` validates data, contract test, images; `postbuild`
  checks the export). For visual effects: `npm run perf:probe` against a
  staging-like build (DESIGN-DECISIONS #130).
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
