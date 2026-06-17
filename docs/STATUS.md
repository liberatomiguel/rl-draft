# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-17. **The game is LAUNCHED.** v1.2.1 is published; the
> **overall review + SAM legacy flag** (just below) is the newest uncommitted
> change under Miguel's review, on top of the staged analytics + v1.2.2 patch.
> v1.1.x and older are historical — see `docs/CHANGELOG.md` for detail.

## Overall review + SAM legacy + Hard/Legacy rebalance (current · uncommitted, under review)

Applied the community-reviewed overall CSV, made the reviewer's **"Legacy"** marks
bite in-engine, added a **repeatable review pipeline** (tool + recipe), and lightly
**rebalanced Hard/Legacy** (chemistry is now the player's edge). Data + a couple of
small engine/balance edits — no UI changes. Gates green: `build:data`,
`validate:data`, `tsc`, lint at the 8-error baseline (0 new), **51** vitest tests.

### Done this session
- **151 reviewed overalls** applied to `data-sources/teams.md` (113 player / 21
  sub / 17 coach; all SAM; avg +5.1, range +1…+25). The CSV's "OVR atual" matched
  the dataset on every row before the bump — surgical number edits only, no
  identity/lineup changes, accents intact (no mojibake).
- **`legacy` lineup flag** added in `teams.md` + parsed by
  `scripts/build-dataset.mjs`: it floors a flagged lineup's `historicalStrength`
  at **"strong"** (never downgrades elite). That field is the lever the
  difficulty opponent sampler (`balance.ts → opponentTierWeights`) reads, so the
  team now surfaces in **legacy** runs without touching its card ratings.
- Applied to the **20** reviewer-flagged SAM landmark teams (KRÜ, Complexity,
  The Three Sins, Noble, eRa, Exeed, NiP, w7m, Godfidence, Sunset, …). All are
  `samOnly`, so the effect is scoped to **region-locked SAM runs**; in a SAM
  legacy run their expected share of the opponent field rises **~21% → ~74%**.
- **Reconciled pre-existing pipeline drift** found while rebuilding: v1.2.3's
  "org buffs small fixes" had been hand-edited straight into `lineups.json` (23
  buffs) without updating `teams.md` — I ported them back into the `teams.md`
  `org:` lines, so the rebuild **preserves them (net buff change vs shipped: 0)**
  and `teams.md` is canonical again. Also regenerated one stale overall (swiftt
  FURIA 2026 `88`→`87`, matching `teams.md` + the review CSV). A clean
  `build:data` is now idempotent. See CHANGELOG [Unreleased] → Fixed.
- **Added `turbopolsa` as Northern Gaming S2 sub (92)** — the one free-text note
  in the review CSV. ⚠ 92 is high vs his S1 (78) / S3 (88); applied as the
  reviewer wrote it — flag if you want it lowered.
- **Repeatable review pipeline** — `scripts/apply-overall-review.mjs` applies a
  review CSV to `teams.md` (dry-run by default, validates "OVR atual", applies
  overalls + `legacy` flags, refuses on drift) and `--export`s a fresh baseline
  CSV; documented in `docs/DATA-GUIDE.md`. Fresh baseline with the new overalls:
  `data-sources/overall-review-v1.2.5.csv` (round-trips: export → apply = 0 changes).
- **Hard/Legacy lightly rebalanced** — players were getting knocked out of the
  Hard/Legacy Swiss even with a strong team because AI lineups (real rosters,
  ~100% chemistry) banked the full chemistry bonus a draft can't. New
  `opponentChemistryMaxBonus = 0` on Hard/Legacy makes chemistry the player's
  edge. Good-team playoff odds: Hard ~65%→~88%, Legacy ~5%→~28%; Legacy stays a
  gauntlet, ladder still Normal < Hard < Legacy. See DESIGN-DECISIONS #54.

### Why "strong" not "elite" (the design call)
"strong" (weight 1.2) puts them level with FURIA — the only real SAM Worlds
qualifier in the pool — instead of "elite" (2.6), which would rank these regional
rosters *above* it. And flagging beats raw-overall inflation: the GAME-DESIGN §25
"overall stays dominant" anchors and card ratings are untouched. Rationale logged
in `docs/DESIGN-DECISIONS.md` #53.

### Next steps (open)
1. Review the `teams.md` diff (151 overalls + 20 legacy flags + 23 org-buff
   restorations + a doc note) + the generator change + the regenerated JSONs
   (lineups / playerCards / subs / coaches / orgs), then **assign a version and
   commit**.
2. Side effect by design: the floor also nudges these teams up a little in SAM
   **hard/normal** (flatter weights) — they are the SAM greats, but flag if not
   wanted. Worldwide and other-region pools are unaffected (SAM is the only live
   region).

## Analytics upgrade — PostHog (current · uncommitted, under review)

Free, detailed product analytics so we can measure real play (runs by
difficulty, win-rate, drop-off, retention) **without the paid Vercel events
tier**. Code is wired and **no-ops until configured**. Full technical detail in
`docs/CHANGELOG.md` [Unreleased].

### Done this session
- `posthog-js` added; `PostHogProvider` mounted in the root layout (cookieless +
  anonymous). `trackEvent` (`src/lib/analytics.ts`) now fans `run_started /
  tournament_started / run_completed` out to BOTH Vercel and PostHog, plus a new
  `run_abandoned` (phase + reason) for the drop-off funnel and SPA-aware
  pageviews (`history_change`).
- Privacy policy (EN + PT) updated to name PostHog and the cookieless /
  anonymous / DNT config.

### Next steps (open) — mostly Miguel, not code
1. **Turn it on:** create a free PostHog Cloud account, set the billing limit to
   **$0** (can never be charged), copy the **Project API Key** (`phc_…`) + host
   into `.env.local` (already templated) AND into the Vercel project's env vars
   (`NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST`), then **redeploy**
   (NEXT_PUBLIC_ vars are inlined at build time). Until then PostHog is a no-op.
2. In PostHog, build the funnel (`$pageview` → `run_started` →
   `tournament_started` → `run_completed`) and a win-rate breakdown of
   `run_completed` by `difficulty` / `won`.
3. (Optional) Confirm Vercel Web Analytics is enabled — the free tier still
   gives visitor counts even without the paid events view.
4. (Optional, later) Reverse-proxy PostHog through a Next rewrite (`/ingest`) to
   dodge ad-blockers; pick the US/EU region first.
5. Review + commit (assign a version) and deploy.

## v1.2.2 — post-launch patch (current · uncommitted, under review)

A small follow-up. Built + verified (`tsc`, **50** vitest tests, lint at the
8-error baseline / 0 new; `build:data` + `validate:data`) and checked live in the
preview. Technical detail in `docs/CHANGELOG.md` [1.2.2].

### Done this session
- **Org & coach buff readout clarified** (`GameCard.tsx`) — the cryptic `·` /
  `+`/`++`/`+++` became plain **"—" / "No buff"** (neutral) and **"+2" /
  "Mechanics +2"** (boost); coach pills match. Players weren't understanding the
  old symbols.
- **Roster/coach data fixes** (`teams.md`, regenerated): +coaches xpere (Team
  Liquid 22-23), Lethamyr (mousesports S9), fireworks (EG S5), Jimmah (Canberra
  Havoc S8); FURIA 2024 coach → STL (was brunovisqui); `SnipJuzo` unified into
  `snipjz`. Coaches 120 → 124.

### Next steps (open)
1. Review + commit `v1.2.2`, then deploy.

## v1.2.1 — launch polish (SHIPPED · published)

The last pass before launch. Built + verified locally (`tsc`, **50** vitest tests,
lint at the 8-error baseline / 0 new) and exercised live in the preview (EN, a
full daily run desktop + mobile, the achievements wall, the creator field FX).
NOT committed — Miguel reviews first. Technical detail in `docs/CHANGELOG.md`
[1.2.1]; rationale in `docs/DESIGN-DECISIONS.md` #49–52.

### Done this session (10 items)
1. **Featured Daily for today** — `2026-06-17` is the authored **"Loaded Draft"**:
   Hard field but overalls VISIBLE, and a **hand-scripted 6-pick draft** (al0t
   special on pick 2, violentpanda "Brain" legend on pick 5, a weaker Gen.G team
   carrying the coach/sub right before it to nudge leaving a slot). New
   `AUTHORED_DAILIES` override + `DraftState.scriptedLineups` (exact lineup per
   pick + forced special, reroll-proof, with a fallback so the run always
   completes) in `draft.ts`. Natural specials suppressed; no rerolls. Dailies now
   own their overall visibility (decoupled from the Hard hidden-lock in `runStore`).
2. **Special-card buff tag** — every special wears a `+5 MEC` / `+5 Team` pill
   (`+?? MEC` on hidden runs), reusing `Badge`. Shows even on un-unlocked draft
   specials (no identity leak).
3. **Perfect chemistry reachable** — `CHEMISTRY.tiers` thresholds lowered
   (Perfect 80→72…). Label remap only; rating math + anchor tests unchanged.
4. **Achievements read varied** — per-tier hue spread in `achievementStyle.ts`;
   Legend stays standardized prismatic.
5. **Creator field FX fixed** — `FieldView.fieldFx` was missing the `creator`
   case (no on-pitch glow); added (rose/pink).
6. **Mobile card-fit** — in-card logo shrinks on mobile only (40/56/72 px);
   fixes BOTH the draft and team-reveal "cut info" reports. Desktop untouched.
7. **Results staff row** — coach/sub/org now match the player cards' size +
   spacing on one desktop row; mobile staff cards widened so badges clear.
8. **Region chips** — code labels `text-sm`→`text-base` (match Worldwide).
9. **SEO polish** — title, keywords, description (EN+PT), OG line, schema genre;
   fixed the false "budget" claim in `how-to-play` metadata.
10. **Version bump** → `1.2.1` (`site.ts` + `package.json`); changelog page
    (EN+PT) updated with friendly notes.

### Next steps (open)
1. **Review + commit `v1.2.1`**, then deploy for launch.
2. Optional art still pending from v1.2.0 (below) — non-blocking.
3. The buff-pill `+?? MEC` (hidden-overall) path is logic-verified but was not
   screenshotted in a live Hard-hidden run; quick to eyeball if wanted.

---

## v1.2.0 — "Regional Champions" (shipped · committed `cf5d1a2`)

Full detail in `docs/CHANGELOG.md` [1.2.0]; rationale in
`docs/DESIGN-DECISIONS.md` #44–48. Highlights kept here only as context for the
open follow-ups below.

### Done this session
- **Region-locked draft mode** — a "Region" picker on the setup screen for
  Classic + Quick. Worldwide (default, unchanged) or a region; only **SAM** is
  live, the rest show **"Em Breve"**. Region runs draw from the region's full
  pool (Worlds finalists + the `samOnly` Top-8). `RunState.regionLock`,
  `lineupPoolForRegion`, persisted last choice.
- **SAM Top-8 imported** — 46 new lineups merged into `teams.md` (a labeled
  "Regional Top-8 (sam-only)" section). Dataset now 254 lineups / 372 players /
  762 cards; the Worlds/draftable pool is unchanged at **208**. Separation via
  `samOnly` + the `draftableLineups` default.
- **Reviewed overalls integrated** — applied the friend's manual review CSV: 162
  overall edits (all regions) + 9 coach fixes (3 corrections, 6 missing coaches
  added). Coaches 114 → 120.
- **"Creator" rarity + Wings easter egg** — the unique "Rocket Draft Creator"
  card (`liberatorl`, +2 all-team). Wings · S2 is **force-injected** into a draft
  offer at ~1% (region-locked SAM only), excluded from normal draws + opponents,
  and GUARANTEES the Creator card when it appears. Secret achievement to obtain
  it; plus a `regional-champion` achievement.
- **Chemistry reworked into a real lever** — per-pair/link weights + tiers
  re-floored so a coherent roster (shared country / org / historical lineup)
  reaches Great–Perfect, making the boost worth chasing over a higher-rated
  all-star mix. Tutorial now explains it. (`balance.ts` + `chemistry.ts`.)
- **Achievements reclassified** into **Common · Rare · Epic · Legend** (recoloured
  to match: slate / blue / violet / prismatic). The corner unlock toasts are
  unchanged.
- **Fixes / polish** — overall toggle re-enables when leaving Hard; the region
  selector is a full-width **Worldwide** card over a **4-then-3 grid** of equal
  region chips (mode-style Badges: orange Selected / grey Coming soon, no green
  accent); in-card logos enlarged a notch; the results team-reveal shows three
  draft-sized cards across the pitch (middle raised) with a spaced staff row, and
  the eliminator strip is left-aligned; the Creator card reads just "Creator" and
  sorts **last** among unlocked cards; "The Three Sins" logo fixed (+ SAM logo
  collisions resolved); the slot-machine reel shows only the run's pool in regional
  mode; tutorials are more visual + a new regional tutorial; rank / card / Legacy
  celebrations are full-screen (portaled) and advance only on input; footer credits
  **GWR** for overall balance.
- **Org logos completed + logo eras.** Every SAM org logo fetched from Liquipedia
  (exact-file overrides for the ~14 misses; styled monogram for the logo-less few);
  **NRG / Dignitas / Spacestation / Vitality** now show season-correct logos
  (`ORG_LOGO_ERAS` + `orgFiles`). Contrast verified per-logo. 128 logos + 6
  monograms, 0 gaps. (CHANGELOG [1.2.0].)
- **Gates green**: `tsc`, **49** vitest tests, lint at the 8-error baseline
  (0 new), `build:data` + `validate:data`. Verified live in the preview (EN + PT).

### Next steps (open)
1. **Overall review — DONE.** The friend's CSV pass is integrated (162 overalls
   + 9 coach fixes). Further tweaks: edit `teams.md`, then `build:data`.
2. **Confirm data flags:** `SnipJuzo` vs `snipjz` (possible same person, two
   ids — left separate); whether to add `Obtth` to Blazar 22-23; whether to add
   the `diaz` Major-2 variants (w7m / Complexity); `Roken` (FCB S7 coach) is
   countryless (friend didn't specify).
3. **Drop-in art (optional):** SAM + era org logos are now fetched from Liquipedia.
   Only `public/orgs/wings-e-sports.png` has no source (drop a custom one if
   wanted) and the Creator card photo
   `public/cards/specials/sp-liberatorl-rocket-draft-creator.png` (styled fallbacks
   render until then). A logo-less few use the monogram by design.
4. **Commit `v1.2.0`** once reviewed, then deploy.
5. **v1.3.0 (planned, NOT in this build):** Discord login (save progress) +
   leaderboards. Deferred by direction.

---

## v1.1.6 / v1.1.7 — indexing fix + performance (historical)

Shipped detail is in **`docs/CHANGELOG.md`**. v1.1.6 fixed Google indexing
(apex made the primary domain, `www → apex` 308 — no code change) and v1.1.7
removed render-blocking CSS (`experimental.inlineCss` → PageSpeed mobile ~95 /
desktop ~99). The SAM Top-8 dataset was staged here and **has since been merged
into `teams.md` (v1.2.0)**, so `data-sources/sam-pending/` is now reference-only.
Still-open follow-ups remain below.

### Next steps (open)
**SEO — Search Console (Miguel, not code):**
1. Submit `https://rocketdraft.app/sitemap.xml` (still "no sitemap detected").
2. URL Inspection → request indexing of `https://rocketdraft.app/` (homepage
   still shows the stale `http://` entry; self-heals on re-crawl).
3. Prefer a **Domain property** for `rocketdraft.app` (covers apex/www/http/https).

**Performance — now PageSpeed mobile ~95 / desktop ~99 (A11y/BP/SEO 100).**
Shipped v1.1.7: ✅ `experimental.inlineCss` (render-blocking CSS gone; warm LCP
3.5s→1.4s). `browserslist` is applied (Chrome ≥111…) but Next 16 still emits the
~14 KiB legacy polyfills regardless (no effect; off-score).

Remaining optimization backlog (PLANNED — none urgent at 95/99):
1. **Font CLS 0.107 (mobile)** — the only Core Web Vital just over "good" (>0.1).
   The display font (Rajdhani via `next/font`) swaps and shifts the "Game modes"
   section (an inlineCss tradeoff: faster paint → swap now visible; CLS was 0
   before). Fix: preload the display font and/or reserve height on the mode cards
   (min-height / fixed line-height), or tune the `next/font` fallback metrics
   (`adjustFontFallback`). **Highest value — CLS is a ranking signal.**
2. **Stop importing the whole dataset on the home page (~94 KiB unused JS).**
   `src/app/page.tsx` (`"use client"`) imports `@/data` (all JSON + Zod) +
   `@/lib/daily` (lineups) just for two `.length` counts + `daily.info`. Plan: a
   generated `counts.ts` for the counts; split a cheap date-only
   `generateDailyInfo` from the lineup-pool build; defer the pool into
   `startDailyRun` (dynamic import); ideally make the hero a Server Component.
   Touches the deterministic daily — do with `npm test`.
3. **`unranked.png` 160→80** (~6 KiB) — serve at 80px or via `next/image`. Trivial.
4. Cosmetic: 4 non-composited animations, 2 long tasks, DOM size — only if
   chasing a perfect 100.

## v1.1.1 — post-launch follow-up (historical)

Shipped in v1.1.1 (full detail in `docs/CHANGELOG.md` [1.1.1]; rationale in
`docs/DESIGN-DECISIONS.md` #41–43): `specialCards.json` decoupled to
HAND-MAINTAINED; the RLCS Worlds dataset audited + corrected vs Liquipedia (all
15 seasons); collection + onboarding UI polish; special-card rarity colours
reworked; the collection-grid performance pass (`GameCard` lite mode, special
photos → `next/image`); all 83 special photos present; analytics + Speed
Insights mounted. The still-open data decisions below survive (none blocking).

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

- Only **2 players** still have no nationality (`Ghaazi0`, `Plu'oh` — no
  Liquipedia page; left countryless rather than guessed). The rest were
  completed/corrected from Liquipedia in v1.1.5 (see CHANGELOG +
  `data-sources/nationalities-audit.md`). Re-audit anytime with
  `node scripts/fetch-nationalities.mjs`; the curated `COUNTRY` map lives in
  `scripts/build-dataset.mjs` (add only high-confidence entries).
- Coach bonus types are hash-derived (file only has overalls) — curate in
  the generator if wanted.
- Liquipedia art is a bootstrap, not a curation: a few logos will be wrong
  (same-name orgs) or missing (old/regional teams) until the overrides file
  is filled in.
- `docs/ARCHITECTURE.md` predates modes/daily — still accurate on layers,
  see CHANGELOG for evolution.
