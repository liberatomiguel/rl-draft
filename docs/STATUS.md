# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-16. **v1.1.1** is built and **uncommitted** — Miguel
> reviews on localhost, then commits + deploys. **v1.0.0 "Kickoff"** (the public
> launch on rocketdraft.app) is committed. The v1.1.1 section below is the full
> record of a long work session; read it + `docs/CHANGELOG.md` to continue in a
> fresh chat.

## v1.1.1 — post-launch follow-up (uncommitted, Miguel testing)

A large follow-up session. **All gates green**: `tsc`, 42 vitest tests, ESLint
(8 pre-existing baseline errors, 0 new), `next build` (16 routes prerendered
static), `validate:data`. Full per-change detail is in `docs/CHANGELOG.md` under
`[1.1.1]`; design rationale in `docs/DESIGN-DECISIONS.md` #41–43.

### What shipped (grouped)
**Gameplay data**
- **specialCards.json now HAND-MAINTAINED** (decoupled from the generator; added
  `season_mvp` cardType; fixed 6 broken refs). `build:data` only re-validates +
  regenerates the photo README, never overwrites it. (DESIGN-DECISIONS #42.)
- **RLCS Worlds dataset corrected vs Liquipedia** — audited ALL 15 seasons
  (full report + FIXED summary in `data-sources/liquipedia-worlds-audit.md`).
  Team counts were already right; rosters were fixed in `data-sources/teams.md`:
  **S6** (Chiefs↔Tainted Minds swap), **2021-22 / 2022-23** (MENA/APAC/SSA/OCE/SAM),
  **2024** (Oxygen, QuikTrip Pioneers, Team Secret), **2025** (Dignitas/NiP,
  Geekay moved MENA→EU, TSM, FURIA, Team Secret). S1–S5/S7/S8/RLCS-X were
  verified CORRECT (no change needed). Normalized `ExplosiveGyro`→`Gyro.`,
  `Sweaty_Clarence`→`Sweaty`; `zen` (EU) ≠ `ZeN` (OCE) kept distinct.

**UI / UX**
- **Collection: 2 cards/row on mobile** (desktop unchanged; no card internals).
- **Onboarding tutorials** render each numbered step as a Panel card.
- **Special-card rarity colours reworked + tuned**: legendary OVR = white-gold
  metallic gradient (`.ovr-legendary`), mythic = border-red, epic = blue→purple
  border + light-purple OVR, rare = deep dark blue (+ slight purple) OVR. Halos
  + legendary holo sheen toned down. Colours live in `globals.css` `.card-*` /
  `.ovr-*` + `SPECIAL_OVR_COLOR` in `GameCard.tsx`; field tints in `FieldView`.
- **Header brand icon** now renders `public/icon.svg` (same file as favicon).
- **PT-BR** for /privacy and /changelog (server `metadata` kept for SEO).

**Performance (collection lag fix)**
- `GameCard` `lite` mode (used only by the collection grid): drops the GPU-heavy
  cursor holo (mix-blend-mode), backdrop-blur pills, and the per-frame box-shadow
  halo PULSE; keeps tilt + foil sheen + a static glow. `TiltCard` only sets
  `will-change` while actively tilting. `FxCard` IntersectionObserver pauses
  off-screen sheen. Full effects still play on the detail/single-card view.
- **Special photos → `next/image`** (Vercel serves resized WebP/AVIF, alpha
  preserved, lazy — ~620KB PNG → ~13KB). `next.config.ts` sets
  `images.unoptimized` in **dev only** so swapping a photo file shows on refresh;
  prod stays optimized. Quality left at default 75 (Next 16 rejects others).

**Assets**
- **All 83 special-card photos present.** Cleaned `public/cards/specials/`
  (26 renamed to match new ids = salvaged Miguel's manual work, 10 true orphans
  deleted), fetched 25 from Liquipedia via `npm run fetch:assets --players`,
  fairypeak added manually. `public/ATTRIBUTION.md` regenerated (CC-BY-SA).

**Analytics / SEO**
- Custom events (`run_started` / `tournament_started` / `run_completed`) via
  `src/lib/analytics.ts`; **Vercel Speed Insights** mounted.
- Org logo-era guide (beginner template + season cheat sheet on `ORG_LOGO_ERAS`
  in `scripts/build-dataset.mjs` + DATA-GUIDE recipe; mechanism shipped v0.5.1).

### NEXT STEPS / open decisions (for the new chat)
**Ops Miguel must do (Vercel/Google — not code):**
1. Vercel dashboard → enable **Web Analytics** AND **Speed Insights** (components
   are mounted but only collect once enabled).
2. Google Search Console → submit `https://rocketdraft.app/sitemap.xml` (DNS TXT
   already added; `GOOGLE_SITE_VERIFICATION` env optional).

**Data decisions still pending (none blocking; flagged in the audit):**
3. **S9 (2020)** — had NO World Championship (COVID → 4 regionals). Dataset keeps
   a 12-team approximation. Decide: rework or leave.
4. **2026** — not played yet; dataset field is provisional (LP differs: NA 4th =
   Virtus.pro not FUT, SSA = Five Fears not Pioneers, + TBD seats). Revisit after
   the event.
5. **Special-card title vs era mismatches** (data valid, content choice):
   `sp-seikoo-endpoint-breakout` (anchored to Team BDS — seikoo has no Endpoint
   card), `sp-snaski-gentle-mates` (anchored to Oxygen 2024), minor
   `sp-jstn-this-is-rocket-league` (NRG S5, the goal was S6). `mawkzy` "1v1 Final
   Boss" is parked in `data-sources/specials-pending.json` (player not in dataset).

**Curation (Miguel, ongoing):**
6. Some fetched Liquipedia photos are stage shots (player off-centre) — overwrite
   `public/cards/specials/<id>.png` to re-frame; transparency pass in progress.
   The fetcher never overwrites existing files; dev shows swaps on refresh.
7. Org era-logos: edit `ORG_LOGO_ERAS`, run `build:data`, drop PNGs.

**Then:** commit (`v1.1.1`) + deploy.

### How the data pipeline works (so a new chat doesn't break it)
- Lineups/players/orgs are GENERATED from `data-sources/teams.md` → run
  `npm run build:data` then `npm run validate:data`. Do NOT hand-edit
  `src/data/*.json` (regenerated) **except** `specialCards.json` and
  `achievements.json` (both HAND-MAINTAINED).
- `teams.md` block format: ```` ```team: <Era name> · <SeasonKey> · <Year> ````
  then `player 1/2/3: <Nick> <overall>`, `sub:`, `coach:`, `org: <Name> <buff>`.
  Person ids = `personKeyOf(nick)` (lowercase, no punctuation); org ids via
  `ORG_ALIAS`; `zen`+OCE → `zen-oce` (the kept-distinct exception).

## Older versions (v0.1 → v1.0.0)

Per-version narrative moved to **`docs/CHANGELOG.md`** (history) and
**`docs/DESIGN-DECISIONS.md`** (rationale). This file stays **current-state
only** — grep those for history; do not paste it back here.

## Known soft spots (not bugs)

- ~133 players still have no nationality — same-country chemistry skips
  them; the curated map lives in `scripts/build-dataset.mjs` (add only
  high-confidence entries).
- Coach bonus types are hash-derived (file only has overalls) — curate in
  the generator if wanted.
- Liquipedia art is a bootstrap, not a curation: a few logos will be wrong
  (same-name orgs) or missing (old/regional teams) until the overrides file
  is filled in.
- `docs/ARCHITECTURE.md` predates modes/daily — still accurate on layers,
  see CHANGELOG for evolution.
