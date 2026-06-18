# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-18. **The game is LAUNCHED.** Committed tip: **v1.2.7**
> (info pages + full PT translation + technical polish — 13 new EN+PT info/landing
> pages, bilingual toggle for them, structured data, web manifest; see
> `docs/CHANGELOG.md` [1.2.7] + `DESIGN-DECISIONS.md` #56–60). **Next up: v1.3
> (accounts & sync)** — see `docs/ROADMAP.md` + the invariants in
> `DESIGN-DECISIONS.md` #55. Per-version detail is in `docs/CHANGELOG.md`; this
> file stays **current-state only**. Grep CHANGELOG/DESIGN-DECISIONS for history.

## Current state

Launched on Vercel; committed tip **v1.2.6**. The core loop is complete — Classic +
Quick + Daily modes, 4 difficulties (Legacy unlockable), region-lock (SAM live),
Swiss + double-elim playoffs, special cards + collection + achievements + XP/ranks,
local persistence (run / profile / settings stores). Recent releases (full detail in
`docs/CHANGELOG.md`):

- **v1.2.6** — champion-on-Hard scroll-lock fix (short-viewport ceremony overlay now
  scrolls; the dismiss hint is always reachable).
- **v1.2.5** — community **SAM overall review** (151 overalls), the **`legacy` lineup
  flag** (SAM legends surface in the legacy gauntlet via a `historicalStrength` floor),
  the **Hard/Legacy chemistry rebalance** (`opponentChemistryMaxBonus = 0` — opponents
  no longer bank a chemistry bonus the player can't), data-pipeline-drift
  reconciliation, and a repeatable review tool (`scripts/apply-overall-review.mjs` +
  `data-sources/overall-review-v1.2.5.csv` baseline).
- **v1.2.4** — analytics wiring (PostHog + Vercel Web Analytics), **no-op until enabled**.

Gates as of v1.2.6: `tsc`, **51** vitest tests, lint at the 8-error baseline (0 new),
`build:data` + `validate:data`.

## Next up — v1.3 (accounts & sync)

Supabase mirror of the stores + Discord OAuth + guest→account migration + a daily
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
