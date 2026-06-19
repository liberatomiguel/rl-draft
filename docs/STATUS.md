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
  after a Hard win. Legacy is the all-time wall — only an elite (~97 worldwide /
  ~92 SAM) draft wins the title; eased slightly for the very best in v1.3.4 (#75).
- **Rewards:** `RANK_REWARDS` gates special-card rarities and ramps appearance
  chance only at the top (base 0.04 → Champion 6% / GC 10% / SSL 16%); the
  Collection unlocks at **Bronze (200 XP)** and its home button is non-clickable
  until then. XP ladder stretched to **SSL 60k** (1.3.5).
- **Chemistry:** same-country / org / region pairs + **shared career history**
  (ex-teammates, shared-org) + coach/sub links; Perfect is reachable, AI unaffected
  (#74, #77). Country always shows over career links (#77 fix).
- **Sub & specials:** sub "depth" scales with the sub's overall and subs can roll
  specials; the Creator card grants **+5 team overall** on top of its stat boost (#78).

Standard gates before any commit: `tsc` clean, **66** vitest tests pass,
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
   `src/data/challenges.json` (10 starters), `/challenges` route + nav, briefing +
   match screens, `profileStore.challengesCompleted`. Winnability is sim-validated
   (`challenges.test.ts`). See `docs/CHALLENGES-DESIGN.md` (now marked SHIPPED).
2. **Rarity rework** — absolute per-rarity spawn rates (`SPECIALS.rarityChance`),
   rolled rarest-first. Calibrated with `scripts/calibrate-rarity.mjs`. Fixes the
   kronovi/monkey_moon over-appearance. Tested.
3. **Visual/nav/mobile** — slot-machine replays on reset, eliminator bolt icon,
   Legacy crown emblem (setup card + in-run indicator + unlock ceremony), richer
   Legacy-champion celebration, mobile modal close-button fix. (Play-button reset
   was reported broken but verified already-working from v1.3.1 — no change.)
4. **Leaderboards + accounts foundation** — `/leaderboards` (peak overall per
   difficulty + worldwide/SAM, championships, streak, challenges cleared) works
   today from the local profile. `lib/profileSync.ts` merge is tested (no progress
   loss, #55.7). `lib/supabase.ts` is a no-op until configured.

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
`docs/ANALYTICS.md`. **Vercel Web Analytics** hit its free event cap and is
redundant with PostHog — dropping it (`<Analytics/>` in `layout.tsx` + the Vercel
sink in `analytics.ts`) is a ~2-line change, **deferred by Miguel's call**. GA4 was
evaluated and **declined** (cookie-consent + privacy-policy cost, worse for funnels).

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
