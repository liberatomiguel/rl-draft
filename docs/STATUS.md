# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-19. **Launched & live on Vercel.** Production tip:
> **v1.3.5 "Proving Grounds"** (apex `rocketdraft.app`). **v1.4 is built and
> sitting on the `staging` branch for team review** (not yet on `main`/prod).
> v1.4 adds: **Challenges** (a new rank-unlocked draft-puzzle mode), a
> **special-card rarity rework** (absolute per-rarity rates — lone legendaries
> no longer over-appear), a **Leaderboards + accounts foundation** (email-code
> login + cloud sync; code-complete but DORMANT until the Supabase env vars are
> set — see below), and a **visual/mobile/Legacy polish** pass. Per-version
> detail lives in `docs/CHANGELOG.md` ([1.4.0]) + `DESIGN-DECISIONS.md`. This
> file stays **current-state only** — grep CHANGELOG/DESIGN-DECISIONS for history.

## Current state

Live on Vercel, production tip **v1.3.5**. The core loop is complete — Classic +
Quick + Daily modes, 4 difficulties (all open; Legacy still needs a Hard win),
region-lock (SAM live), Swiss + double-elim playoffs, special cards + collection +
achievements + XP/ranks, local persistence (run / profile / settings stores).

Key current tunings (the numbers live in `src/config/balance.ts`; rationale in
`DESIGN-DECISIONS.md` — do NOT duplicate the figures here, they drift):

- **Difficulty:** Hard is NOT rank-gated (open from the start, #72); Legacy unlocks
  after a Hard win — specifically a **Classic/Quick** Hard (or Legacy) championship; a
  Daily or Challenge Hard win still counts as a title but does NOT open Legacy (v1.4,
  via the `legacyUnlocked` latch). Legacy is the all-time wall, tuned on the realistic
  draft sim (`difficulty.sim.test.ts`, #79.1): worldwide a ~92 team ≈ 0%, only a 98+
  pinnacle ≈ 40% (`legacy.opponentRatingShift` 1.70); SAM on its own flatter scale,
  ~92-93 ceiling ≈ 34% (`REGION_LOCK.legacy` 1.0). Never impossible, never trivial.
- **Rewards:** `RANK_REWARDS` gates special-card rarities and ramps appearance
  chance only at the top (ramps from Diamond: Diamond 6% / Champion 9% / GC 12% /
  SSL 16%); the Collection unlocks at **Bronze (200 XP)** and its home button is
  non-clickable until then. XP ladder stretched to **SSL 60k** (1.3.5).
- **Chemistry:** now ADDITIVE — each pair sums two independent axes, **connection**
  (same lineup > ex-teammates > shared org) **+ heritage** (country > region), instead
  of counting only the single strongest link; `maxRaw` 10. So a pair who share a
  country AND once shared an org now BOTH count. Perfect is reachable, AI unaffected
  (#74, #77, #87).
- **Sub & specials:** sub "depth" scales with the sub's overall and subs can roll
  specials; the Creator card grants **+7 team overall** on top of its stat boost (#86).

Standard gates before any commit: `tsc` clean, **~121** vitest tests pass,
`build:data` + `validate:data` green, lint at its baseline, and a green
`npm run build` (production) for anything shipping.

## In progress (committed, but NOT yet in the live game data)

- **International-Major DB expansion** (`data-sources/`, NOT yet in game data): a
  careful first-pass harvest of every international Major (RLCS 2021-22 → 2025) for
  teams that did NOT reach Worlds — `majors-new-teams.json` + the review workbook
  `majors-review.xlsx` (≈28 new / ~6 review teams) + `majors-harvest-report.md`.
  PENDING Miguel's manual overall review; then apply to `teams.md` →
  `build:data`/`validate:data`. Tooling: `scripts/fetch-liquipedia-majors.mjs`,
  `scripts/build-majors-review.py`. Dedup = same-lineup ≥2-player overlap (see the
  memory note + report for the caveats).
- **Community-suggestions intake** `data-sources/community-suggestions.xlsx`
  (overalls / specials / new-teams tabs) + `scripts/build-community-sheet.py` —
  ready to share with the community.

## v1.4 — built on `staging`, what's done vs. what's pending

**Done & on `staging` (4 commits on top of `main` tip `3403b7e`):**
1. **Challenges** — SHIPPED (was "designed, not built"). `engine/challenges.ts`,
   `src/data/challenges.json` (20 starters), `/challenges` route + nav, briefing +
   match screens, `profileStore.challengesCompleted`. Winnability is sim-validated
   (`challenges.test.ts`). See `docs/CHALLENGES-DESIGN.md` (now marked SHIPPED).
2. **Rarity rework** — absolute per-rarity spawn rates (`SPECIALS.rarityChance`),
   rolled rarest-first. Calibrated with `scripts/calibrate-rarity.mjs`. Fixes the
   kronovi/monkey_moon over-appearance. Tested.
3. **Visual/nav/mobile** — slot-machine replays on reset, eliminator bolt icon,
   Legacy crown emblem (setup card + in-run indicator + unlock ceremony), richer
   Legacy-champion celebration, mobile modal close-button fix. (Play-button reset
   was reported broken but verified already-working from v1.3.1 — no change.)
4. **Leaderboards + accounts foundation** — `/leaderboards` works today from the
   local profile; **trimmed to 4 categories + MMR** (titles total/legacy, overall
   legacy/regional, MMR — replaced the XP board). `lib/profileSync.ts` merge tested
   (no progress loss, #55.7). `lib/supabase.ts` is a no-op until configured.
5. **v1.4 final pass:** Vercel edge-request diet (analytics sinks
   dropped); achievements 3-bug fix (cloud-prune self-heal + reveal-time feats +
   silent set-swap backfill); **MMR** cosmetic skill rating (profile + board);
   **Legacy ease** WW+SAM toward ~5% (#79); **challenges** rank-gated at Bronze
   (#81), grouped by rarity, opponent field in the briefing, a real animated Bo7;
   **run recap** (history → see how a run went); collection counter ghost-card fix;
   leaderboards trophy in the header. Engine purity + the §25 anchors hold.
6. **Staging-review adjustments (2026-06-21)** — see CHANGELOG "Staging-review
   adjustments": **MMR reworked** to a win-only economy (Easy/Normal title +1, Hard +3,
   Legacy finalist +5, Legacy title +9; backfill capped at 1600; profile v11 hard-reset);
   **Legacy unlock** decoupled from Daily/Challenge wins (`legacyUnlocked` latch);
   **Challenges** all Bo7, **rerolls by difficulty** (8/5/3/0), XP retuned, grown to
   **20** spread across every rank Bronze→SSL, all sim-validated into a difficulty band
   (winnability test now has an upper bound too); **rank-image lock messages**
   everywhere; **sub special** now renders in the draft; **email-code login** dead-end
   fixed; **ACCOUNTS-SETUP §1c SQL** corrected (mid-list view column → DROP+CREATE).
   `tsc` clean, **~121** vitest tests green, `validate:data` green, production build green.

**PENDING — Miguel's infra (to light up email login + global leaderboards):**
follow **`docs/ACCOUNTS-SETUP.md`** — Supabase project is created and the local
env vars are set; remaining: run the SQL (profiles table + RLS), set up email
sending (the code template + a custom SMTP for launch), and add the env vars to
Vercel. Login is **email + 6-digit code** (no Discord). Until the SQL + email are
done the game runs exactly as the guest-only build.
Then we finish the wiring together (sync-after-run, a header sign-in chip, daily
leaderboard — listed in ACCOUNTS-SETUP "Follow-ups"). Invariants this must keep:
`DESIGN-DECISIONS.md` **#55**.

**Still a candidate (not started):** the Worldwide DB expansion (the reviewed
Major-only teams in `data-sources/`) — fold into `teams.md` when ready. And the
gameplay-longevity backlog (`docs/GAMEPLAY-IDEAS.md`, brainstorm only).

## Open follow-ups (mostly ops, not code)

**Analytics — LIVE (done):** PostHog is configured (key in Vercel env, EU host,
cookieless/anonymous) and receiving data; events: `run_started`,
`tournament_started`, `run_completed`, `run_abandoned`, `special_used` (live).
Operator guide (funnels/filters, the funnel-vs-Trends gotcha):
`docs/ANALYTICS.md`. **Vercel Analytics + Speed Insights — REMOVED (v1.4):** they
were redundant with PostHog and their per-pageview beacons (`/_vercel/insights/*`,
`/_vercel/speed-insights/vitals`) + the `trackEvent` double-sink were the dominant
driver of the launch **edge-request blowup** (~1.1M in 4 days vs the Hobby 1M/mo
cap). Now PostHog-only. GA4 was evaluated and **declined** (cookie-consent +
privacy-policy cost, worse for funnels).

**Vercel edge requests (v1.4 ops):** launch traffic projected ~8M/mo — over the
Hobby 1M cap. Code-side diet shipped: dropped the Vercel telemetry beacons (above)
and trimmed the `next/image` variant fan-out + 31-day `minimumCacheTTL`
(`next.config.ts`). Next levers if still over after monitoring PostHog: **Cloudflare
free in front of the apex** (absorbs static/asset requests off Vercel's edge) or
**upgrade to Pro** ($20/mo, 10M edge requests included — fits the projection). No
middleware / no PostHog-proxy / no in-code redirects exist, so those are not the
cause. Hobby is non-commercial-only, but the fan game has no revenue, so the cap is
the only real constraint.

**SEO:** the v1.3.3 pass added RLCS-draft-focused FAQ entries + keywords. Apex is
canonical; `www`/`*.vercel.app` 308 to it. Standing ops: keep the GSC Domain
property + resubmit `…/sitemap.xml` after page changes; a launch post in
r/RocketLeagueEsports + SAM communities is still worth doing.

**Performance backlog (none urgent — PageSpeed ~95 mobile / ~99 desktop):** the
remaining mobile-LCP lever is to stop importing the whole `@/data` barrel on the
home via `@/lib/daily` + `runStore`. It touches the **deterministic daily**, so do
it as a focused change with `npm test` (DESIGN-DECISIONS #60).

**Data decisions (none blocking):** S9 (2020) had no Worlds (COVID) and keeps a
12-team approximation; the 2026 field is provisional. Optional art pending:
`public/orgs/wings-e-sports.png` and the Creator card photo
(`public/cards/specials/sp-liberatorl-rocket-draft-creator.png`) — styled
fallbacks render until dropped in.

## Known soft spots (not bugs)

- A few players have no nationality (e.g. `Ghaazi0`, `Plu'oh` — no Liquipedia page;
  left countryless). Re-audit with `node scripts/fetch-nationalities.mjs`; curated
  `COUNTRY` map lives in `scripts/build-dataset.mjs` (high-confidence entries only).
- Coach bonus *types* are hash-derived (source data has only overalls) — curate in
  the generator if wanted.
- Liquipedia art is a bootstrap: a few logos may be wrong (same-name orgs) or
  missing until `data-sources/asset-overrides.json` is filled in.
