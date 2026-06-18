# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-18. **The game is LAUNCHED.** Production tip: **v1.2.7**.
> **v1.3.2 is committed to a `staging` branch** (Vercel preview URL, NOT production)
> for Miguel to test the difficulty/chemistry rebalance with colleagues before
> launching v1.3 to the apex domain. v1.3.2 adds a second live-feedback pass:
> higher win rates, eased chemistry (3 country = Great, +1 org = Perfect), Hard
> rank-gate removed, SAM boost 3→2, a legendary region-Legacy achievement, and a
> menu collection-lock. v1.3 is a big gameplay update:
> rank-gated rewards, reachable chemistry, a Legacy rebalance that makes the title
> winnable, org-unique tournament fields, a reworked Match Center + playoff reveal,
> the always-visible special-card art, and the community SAM overall review. See
> `docs/CHANGELOG.md` [1.3.0] + `DESIGN-DECISIONS.md` #61–66. The **Challenges**
> feature was designed this pass (`docs/CHALLENGES-DESIGN.md`) but NOT implemented
> — it's the next build. Per-version detail is in `docs/CHANGELOG.md`; this file
> stays **current-state only**. Grep CHANGELOG/DESIGN-DECISIONS for history.

## Current state

Launched on Vercel; committed tip **v1.2.7**, with **v1.3.0 staged uncommitted**.
The core loop is complete — Classic + Quick + Daily modes, 4 difficulties (Hard now
gated at Silver, Legacy behind a Hard win), region-lock (SAM live), Swiss +
double-elim playoffs, special cards + collection + achievements + XP/ranks, local
persistence (run / profile / settings stores). What v1.3 changed (full detail in
`docs/CHANGELOG.md` [1.3.0]):

- **Rewards**: `RANK_REWARDS` — rank gates special-card rarities (Unranked none →
  Diamond legendary), ramps appearance chance at the top (Champion 8 / GC 12 / SSL
  16%), locks the Collection until Bronze (300 XP), gates Hard at Silver.
- **Chemistry**: same-region pair + coach/sub nationality links (reachable Perfect,
  AI unaffected — it already saturates).
- **Legacy rebalance**: org-unique fields + softer mixed gauntlet (`opponentRatingShift`
  0.6, elite weight 1.8, user `chemistryMaxBonus` 2.9) — a great draft wins ~8%.
- **Sim/UI**: org-unique opponent fields; Match Center splits games win/loss by column;
  playoffs reveal the whole round at once; specials always show art + buff in hidden
  mode (only number + rarity hide).
- **Data**: community SAM overall review (69 overalls + roster fixes), via
  `scripts/apply-overall-review.mjs` + `data-sources/overall-review-v1.3.csv`.

Gates as of v1.3.0: `tsc` clean, **60** vitest tests pass, lint at the 8-error
baseline (0 new), `build:data` + `validate:data` green. NOTE: automated browser
verification of the UI changes was blocked by a running dev server holding Next's
`.next/dev/lock` (port 3000) — verify the Match Center / playoff / card visuals
on the live dev server.

## Next up

**1. Challenges** (designed, not built) — rank-unlocked "beat-the-line" puzzles.
Full design + open decisions in `docs/CHALLENGES-DESIGN.md`; await Miguel's calls
on the five `[DECIDE]` points, then build in the suggested phases.

**2. Accounts & sync** (the originally-planned v1.3, now a later version): Supabase
mirror of the stores + Discord OAuth + guest→account migration + a daily
leaderboard (the daily seed is already globally shared). Scope in `docs/ROADMAP.md`.
The **invariants this patch must not break** are recorded in
`docs/DESIGN-DECISIONS.md` **#55** — engine purity, persist `seed`+`rngState`
verbatim, the single `applyRunResults` funnel, the run (ephemeral) / profile
(durable, sync-worthy) / settings store boundary, persistence keys + schema versions,
the full ProfileState migration payload, etc. `docs/ARCHITECTURE.md` now documents
the three persisted stores + the sync boundary accurately — read it first.

## Open follow-ups (mostly ops, not code)

**Analytics — turn it on (Miguel):** create a free PostHog Cloud account, set the
billing limit to **$0** (can never be charged), put the Project API key (`phc_…`) +
host into `.env.local` (templated) AND the Vercel env vars (`NEXT_PUBLIC_POSTHOG_KEY`
/ `NEXT_PUBLIC_POSTHOG_HOST`), then **redeploy** (`NEXT_PUBLIC_` vars are inlined at
build). Confirm **Vercel Web Analytics + Speed Insights** are enabled in the
dashboard. Then build the PostHog funnel (`$pageview → run_started →
tournament_started → run_completed`) + a win-rate breakdown by `difficulty` / `won`.

**SEO — Search Console only; Vercel is already correct (Miguel):** the domains
are fine — apex `rocketdraft.app` is primary/production and `www` + `*.vercel.app`
already **308** to it. **Do NOT change Vercel.** The "4 origins" in the GSC export
were the launch-window discovery period (~3 days of data). Action: prefer a GSC
**Domain property** (consolidates apex/www/http reporting), **resubmit
`…/sitemap.xml`** (now 20 URLs incl. the new EN+PT pages), and URL-inspect →
request indexing of the home + `/ratings`, `/sam`, `/faq`; then give Google time
to consolidate onto the apex (the canonical tags + sitemap + hreflang all point
there). **Community outreach:** a launch post in r/RocketLeagueEsports + the SAM
communities is worth doing; ask Claude to draft it.

**Performance backlog (planned, none urgent — PageSpeed ~95 mobile / ~99 desktop):**
the remaining mobile-LCP lever is **stop importing the whole `@/data` barrel on the
home** via `@/lib/daily` + `runStore` (~94 KiB). Deferred from the v1.3 SEO pass
because it touches the **deterministic daily** — do it as a focused change with
`npm test` (DESIGN-DECISIONS #60). Already done in v1.3: generated `counts.ts`
(home no longer imports the barrel for two integers) + dropped `fetchPriority` on
the decorative rank emblem. (Font CLS is a non-issue — latest PageSpeed shows
mobile CLS 0 / desktop 0.035.)

**Data decisions (none blocking):** S9 (2020) had no World Championship (COVID → 4
regionals) and keeps a 12-team approximation; the 2026 field is provisional until the
event; a few special-card title/era pairings are content choices (see CHANGELOG
[1.1.1]). Optional art still pending: `public/orgs/wings-e-sports.png` and the Creator
card photo (`public/cards/specials/sp-liberatorl-rocket-draft-creator.png`) — styled
fallbacks render until dropped in.

## Known soft spots (not bugs)

- A few players have no nationality (e.g. `Ghaazi0`, `Plu'oh` — no Liquipedia page;
  left countryless rather than guessed). Re-audit with
  `node scripts/fetch-nationalities.mjs`; the curated `COUNTRY` map lives in
  `scripts/build-dataset.mjs` (add only high-confidence entries).
- Coach bonus *types* are hash-derived (the source data has only overalls) — curate
  in the generator if wanted.
- Liquipedia art is a bootstrap, not a curation: a few logos may be wrong (same-name
  orgs) or missing (old/regional teams) until `data-sources/asset-overrides.json`
  is filled in.
