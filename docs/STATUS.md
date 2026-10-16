# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: **2026-10-16**.
>
> **Production is LIVE on Cloudflare** (`main` @ v1.4.6, static export, assets-only
> Worker, `rocketdraft.app`). The Season 1 announcement pop-up is up.
>
> **v2.0 "Season 1" is IN PROGRESS on branch `claude/dazzling-cannon-1d6thr`.** Read
> **`docs/V2-IMPLEMENTATION-PLAN.md`** first: it is the execution order (Phase 0 technical
> base → Phase 1 surfaces → Phase 2 Challenges 2.0 → Phase 3 Road to Worlds 2.0 → Phase 4
> QA/launch), the Supabase SQL Miguel must run, and the launch checklist. CHANGELOG
> `[2.0.0]` is the narrative; DESIGN-DECISIONS #110–#115 the why.
>
> **v2.0 progress:** Phases 0, 1 and 2 are DONE — technical base (season model, profile v12
> reset + legacy snapshot, Season Rating, cosmetics, Supabase v2 client, missions + login
> streak, event cards + Special Hunt, series variety, bracket spoiler fix), the surfaces
> (recap screen, Profile v2, Leaderboard v2, missions UI, Daily Quiz, Home v2) and
> Challenges 2.0 (3 stars, 4 gauntlets, 24 validated challenges). Phase 3 (Road to Worlds
> 2.0) is next, then Phase 4 (content, QA, staging, launch).
>
> **Never deploy v2.0 to `main` before the full review.** Test builds go to the staging
> Worker (`staging.rocketdraft.app`) from the `staging` branch with a SEPARATE Supabase
> project (plan §6-A).
>
> **Road to Worlds (career mode) is a SEPARATE workstream** with its own docs:
> `ROAD-TO-WORLDS-STATUS.md`, `-DESIGN.md` and `-DECISIONS.md`. Its v2.0 overhaul is
> Phase 3 of the plan.
>
> This file stays **current-state only**. Grep CHANGELOG/DESIGN-DECISIONS for history.

## Current state

### Hosting (live since v1.4.5)

- **Why Vercel hit the cap.** Hobby counts every request, static files
  included. The real multipliers were viewport `<Link>` prefetch (several
  segment requests per visible link) and `/public` art that revalidated on every
  load (`max-age=0`). The analytics beacons that the v1.4 notes blamed were only
  about 7–20% of requests.
- **What `perf/static-cloudflare` does** (details: CHANGELOG):
  - Hosting:
    - `output: "export"`.
    - Assets-only `wrangler.jsonc` (no Worker script: hard rule).
    - Cache and security headers in `public/_headers`.
    - `scripts/postexport.mjs` fixes up and checks the export.
  - Images:
    - Pre-built hashed WebP (`scripts/build-images.mjs` → `public/img/**`) plus a
      committed `src/generated/asset-manifest.json`.
    - A custom `next/image` loader.
    - Missing art renders its fallback with no request.
  - Request diet:
    - `AppLink` (intent-only prefetch) replaces every `next/link`.
    - PostHog and Supabase load lazily.
    - No runtime zod.
    - Career copy split out (`useCareerCopy`).
    - `experimental.inlineCss` removed.
    - Static OG/apple PNGs.
    - Automatic `html.lite-fx` for weak devices.
  - Supabase sync hardening.
  - Career mode is **off in production builds** unless
    `NEXT_PUBLIC_CAREER_MODE=1`. Dev and tests keep it on. With the flag off,
    `/career` exports as a real 404.
- **Measured on `wrangler dev`** (local, same export, before → after):

  | Measure | Before | After |
  |---|---|---|
  | Cold home | 74–80 requests | **27** |
  | Warm return | 80 | **2** |
  | Click to `/play` | — | 3 requests; `/play.txt` 316 KB → **11.5 KB** raw |
  | Full draft run | 166 requests (22 404s, 68 prefetch) | **≤71** (42 images, **0** 404s) |
  | Home first-load JS+CSS | JS alone 544 KB gz | **344 KB gz** |
  | Home HTML | 504 KB raw / 27 KB br | **40 KB / 7.5 KB** |

  Build: 48 s; `out/` = 1,071 files, 35 MB.
- **Staging Worker** (`rocket-draft-staging`, `staging.rocketdraft.app`): deployed with
  `npx wrangler deploy --env staging` from the `staging` branch (career on, noindex).
  Separate origin → separate localStorage.
- **Player saves** live only in `localStorage` on `https://rocketdraft.app`.
  Never serve the game from another host. Persist keys and versions are frozen by
  `src/store/persistContract.test.ts`.

### The draft game (feature set of the last live build, v1.4.4)

- **Modes:** Classic, Quick, Daily and Challenges (20 rank-gated Bo7 puzzles).
- **Difficulties:** 4, all open. Legacy needs a Classic/Quick Hard win.
- **Structure:** region-lock (SAM live); Swiss + double-elim playoffs.
- **Progression:** special cards, Collection, achievements, XP/ranks, cosmetic
  MMR.
- **Leaderboards:** local today; global boards dormant (see Accounts).
- **Persistence:** local only (run / profile / settings stores).

Key current tunings. The numbers live in `src/config/balance.ts` and the
rationale in `DESIGN-DECISIONS.md`. Do NOT duplicate the figures here; they
drift.

- **Difficulty.** Hard is NOT rank-gated (#72). Legacy unlocks after a
  **Classic/Quick** Hard (or Legacy) championship, through the `legacyUnlocked`
  latch; Daily and Challenge wins don't open it. Legacy is the all-time wall,
  tuned on the realistic draft sim (`difficulty.sim.test.ts`, #79.1/#94):
  - Worldwide, a ~92 team wins ≈ 0%; the elite tier climbs (96–97 ≈ 15%,
    98+ ≈ 42%) via `legacy.opponentRatingShift`.
  - SAM runs on its own flatter scale (`REGION_LOCK.legacy`, #99): the 94–95
    ceiling wins ≈ 32% / reaches the final 87%; a 90–91 ≈ 3% / 14%.
  - Never impossible, never trivial.
- **Rewards.** `RANK_REWARDS` gates special-card rarities and ramps appearance
  chance from Diamond up. The Collection unlocks at Bronze (200 XP). The XP
  ladder runs to SSL 60k.
- **Chemistry.** Additive: each pair scores **connection** (same lineup >
  ex-teammates > shared org) **+ heritage** (country > region). Perfect
  chemistry is reachable; the AI is unaffected (#74, #77, #87).
- **Subs and specials.** Sub depth scales with the sub's overall, and subs can
  roll specials. The Creator card grants +7 team overall (#86). Rarity spawn
  rates are absolute per rarity (`SPECIALS.rarityChance`).

### Standard gates (before any commit)

- `npm run typecheck` (tsc) clean.
- `npm test`: **444** vitest tests pass (33 files) on the v2.0 branch (385 on `main`).
- `npm run lint` at its baseline: **5 errors + 1 warning**, all pre-existing
  (TournamentScreen, AnimatedNumber, Modal, useMounted, calibrate-rarity).
  Don't add new ones.
- `build:data` + `validate:data` green.
- A green **`npm run build`** for anything that ships. This is now the static
  export:
  - `prebuild` = `validate:data` + `test:contract` + `build:images`
  - `next build` writes `out/`
  - `postbuild` = `scripts/postexport.mjs`, which fails the build on a broken
    export

**Scripts:**

- `npm run build:images`: refreshes the WebP set and the manifest. It is
  incremental and also runs on every build.
- `npm run preview:static` (also `npm run start`): `wrangler dev` serving
  `out/` at `localhost:8787`. Stop it when you're done. `next start` does not
  work with an export.
- `npm run deploy`: build + `wrangler deploy`. Prefer Workers Builds, and read
  the `.env.local` warning in the runbook first.

### Accounts and leaderboards

**v2.0 changes the schema.** Before the v2.0 deploy Miguel runs the SQL in
`docs/V2-IMPLEMENTATION-PLAN.md` §6-B (season columns, `profile_grants`, the freeze
trigger, the `leaderboard` view v2, `preseason_hall_of_fame`), then §6-C once at launch
(freeze the pre-season positions). The v2.0 client never writes `xp` / `mmr` again.

#### Pre-v2.0 notes (v1.4, still accurate for `main`)

The code is in place (email + 6-digit code, cloud sync, global boards). The sync
was hardened on this branch: tagged read result, abort on error, one sync in
flight, and it waits for profile hydration. After the first sync, a debounced
push (4.5 s) sends in-session progress, and each sync folds in the profile
other tabs saved. Production has never had the Supabase variables.

Open product decision: a signed-in "Reset all progress" is restored from the
cloud by the next sync (monotonic merge). Hide the reset for signed-in players
or reword its copy (CHANGELOG → Known limitations).

Live DNS already carries Resend email records (`resend._domainkey`, `send`).
These must move with the zone.

Remaining for Miguel, per `docs/ACCOUNTS-SETUP.md`:

1. Run the SQL.
2. Finish email sending (custom SMTP).
3. Add `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` as **Cloudflare build
   variables**.

Invariants to keep: DESIGN-DECISIONS **#55**.

### Analytics

PostHog only (EU host, cookieless). Operator guide: `docs/ANALYTICS.md`. On this
branch:

- The SDK loads after load + idle; earlier events are queued.
- Feature flags and remote config are off.
- `$pageleave` is no longer captured.

Expect pageviews and sessions to dip at the cutover. Don't compare numbers from
before and after the cutover directly. GA4 was evaluated and declined.

### SEO

The apex is canonical. After the relaunch, www → apex is a Cloudflare Redirect
Rule (301); Vercel used a 308. Search Console is a Domain property verified by a
DNS TXT record, which must move with the zone.

Standing ops:

- Resubmit `…/sitemap.xml` after the relaunch and after page changes.
- A launch post in r/RocketLeagueEsports and the SAM communities is still worth
  doing.

### Data

- **Generator and tooling:**
  - `data-sources/teams.md` → `build:data`.
  - The Majors harvest tooling stays in `data-sources/` for the next pass.
  - Community intake: `data-sources/community-suggestions.xlsx` +
    `scripts/build-community-sheet.py`.
- **Optional art still missing** (styled fallbacks render, and no request is
  made):
  - Special photos: `sp-repi-wings-e-sports`, `sp-ninja23509-wings-e-sports`,
    `sp-freedom-og-brazil-goat`.
  - Org logos: `bodybuilders`, `cringe-society`, `pioneers-oce`,
    `poison-bullets`, `sapphire`, `senbei-strikers`.
  - Drop the PNG in and rebuild (see AGENTS.md "Asset drop-in").
- **Open data question for Miguel.** `specialCards.json` has `"secret": true` on
  the two Wings easter-egg cards. Neither the schema nor the type declares it,
  so it has never had any effect. Either implement it (schema + type + UI) or
  delete the key.
- S9 (2020) had no Worlds (COVID) and keeps a 12-team approximation. The 2026
  field is provisional.

### Performance and robustness backlog (none blocking the relaunch)

- **`@/data` barrel is still on the shared path.** The home imports it through
  `@/lib/daily` + `runStore`. Splitting it touches the deterministic daily and
  save migration, so first capture a real v1.4.4 save as a fixture (DevTools on
  `rocketdraft.app`) and add fixture tests. Then make it a focused change
  (#60).
- **PT locale lazy-load.** Both language dictionaries still ship to every page.
- **Split the `CAREER_*` constants** out of `balance.ts` (e.g.
  `src/config/careerBalance.ts`). They still load on the home page (~3.6 KB gz +
  1 request).
- **Animation compositor rewrite.** Sheens and halos still repaint on capable
  devices; `lite-fx` only covers weak or reduced-motion devices.
- **Deploy skew.** After a deploy, an open tab that requests a deleted hashed
  chunk (route chunks, the lazy PostHog/Supabase chunks) gets a 404. Options:
  keep the previous build's `_next/static` in each upload, and/or show a "new
  version — reload" hint.
- **Smaller items:**
  - Content pages have no `og:image` (pre-existing).
  - Lazy PostHog can miss UTM params when a visitor navigates before the SDK
    loads.
  - A `public/.assetsignore` could drop the raw PNGs from the upload (upload
    size only, not requests).

## Known soft spots (not bugs)

- A few players have no nationality (e.g. `Ghaazi0`, `Plu'oh`, who have no
  Liquipedia page), so they're left countryless. Re-audit with
  `node scripts/fetch-nationalities.mjs`. The curated `COUNTRY` map lives in
  `scripts/build-dataset.mjs` (high-confidence entries only).
- Coach bonus *types* are hash-derived, because the source data has only
  overalls. Curate them in the generator if wanted.
- The Liquipedia art is a bootstrap: a few logos may be wrong (same-name orgs)
  until `data-sources/asset-overrides.json` is filled in.
