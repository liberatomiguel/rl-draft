# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) ·
versioning: [SemVer](https://semver.org/) (0.x while the MVP is being
validated).

Sections per release: **Added · Changed · Balance · Fixed**.
Bugs found after a release get an entry under **Fixed** in the next release,
with the root cause — that section doubles as the project's bugfix log.

---

## [1.3.2] — 2026 · Second live-feedback pass

More staging feedback: winning was still rare (not because a strong team's WIN
chance is low, but because BUILDING a strong team is), the Hard rank-gate broke
the flow, and Perfect chemistry was too hard again. Supersedes [1.3.1] balance.

### Added
- **Legendary achievement "Continental Crown"** (300 XP): win a **Legacy**
  tournament in **region-locked** mode — the hardest feat in the game.
- **Collection lock shown on the home menu** (a padlock + "unlocks at Bronze")
  when Unranked, not only inside the Collection screen.

### Changed
- **Win rates raised across the board** (the run-level odds were too low because
  strong drafts are rare): Normal `opponentRatingShift` -1.0 → **-1.3**, Hard -0.2
  → **-0.5**, Legacy 0.2 → **-0.3**. A ~92 elite now wins Hard ~12%, a ~95 dream
  wins Legacy ~17% (was ~10%), and the chemistry change (below) makes those totals
  easier to reach. `balance.test.ts` Legacy band rebased (playoffs is reachable;
  the title is the wall).
- **Hard mode is no longer rank-gated** (`RANK_REWARDS.hardMode` = true for all
  ranks) — gating it behind Silver broke the experience in playtest. Every
  difficulty is open from the start (Legacy still needs a Hard win).
- **Chemistry thresholds eased to Miguel's spec**: **3 same-country players reach
  Great** (was Good), and **adding one org connection** (drafting a player's org,
  or a coach/sub who shares it) **reaches Perfect**. Country alone still can't hit
  Perfect — a same-country coach+sub is a soft bonus that falls short on its own.
  `maxRaw` 15 → 11, `sameCountryPair` 2 → 3, org/staff links 1.5 → 2,
  `staffCountryBonus` 0.5.
- **Region-lock boost 3 → 2** (`REGION_LOCK.opponentRatingBoost`): a regional field
  is too weak to wall a genuinely strong SAM draft at any boost, so SAM favours
  winnability — a typical ~90 SAM team wins Legacy ~18% (not ~40%), a great one
  wins comfortably. SAM stays the more accessible region-pride mode.
- **Ranks**: Bronze 300 → **250 XP** (one run clears Unranked even on a loss);
  Supersonic Legend 40k → **50k XP** (longer endgame).

## [1.3.1] — 2026 · Live-feedback pass (balance targets, chemistry rules, polish)

Pre-launch iteration on v1.3 from live play. Supersedes the [1.3.0] balance.

### Added
- **First-launch tutorial**: a short full-screen, multi-step feature tour (draft →
  collection → ranks → difficulties), shown once (`flags.seenTutorial`),
  skippable. Client-only + mounted-gated → no SSR/SEO/page-speed impact.
- **Rank-up screen now lists what you unlocked** (the Collection, a new rarity,
  Hard mode, a higher special chance) — derived from `RANK_REWARDS`.
- **Region-lock difficulty normalisation** (`REGION_LOCK.opponentRatingBoost` = 3):
  a flat boost to region-locked (SAM) opponents so the regional curve mirrors
  worldwide with adapted overalls — a SAM-best (~90) draft faces roughly the same
  odds a worldwide dream (~95) does, instead of SAM being trivially easy.
- **Share preview**: the share button now opens a preview modal (image + caption)
  with native Share (image + text), an X compose intent, or a plain download. The
  share image now shows the **drafted roster as rarity-framed mini-cards**.
- **Follow on X pill** on the home, next to Join the Discord.

### Changed
- **Difficulty retuned to live targets** (measured for ~90 "good" / ~92 "elite" /
  ~95 "dream" teams): Normal `opponentRatingShift` 0 → **-1.0** (a good team can
  win, an elite has strong odds); Hard `{elite 1.15…}` → **`{elite 0.7, strong
  1.1, solid 1.0, underdog 0.7}`** + shift 0.3 → **-0.2** (a 90 can't win, a 92
  elite ~10%, a 95 dream comfortably); Legacy shift 0.6 → **0.2**, elite weight
  1.8 → **1.4** (a 95 dream ~10%, a 92 elite very rarely). Hard's real difficulty
  remains drafting with overalls hidden. `balance.test.ts` Hard band rebased.
- **Chemistry reworked** (engine + CHEMISTRY): **Perfect only at a FULL bar** (raw
  ≥ maxRaw; tiers Perfect=100). **Shared org now outranks country** (org 3 >
  country 2) and **Perfect requires real org/lineup overlap** — a country-only (or
  country+staff) stack tops out at Good, never Perfect. Same-country/-org/-lineup
  pairs are **merged into one breakdown line** (a 3-player Brazil core reads as one
  "Same country +6", not three +2s). Coach/sub now state a **named reason**
  ("coached this lineup" / "same org" / "same country") instead of a vague
  "connection". `maxRaw` 12 → 15.
- **Special cards show the DRAFTED org on your field** (and in the draft offer), not
  the special's historical org — a yanxnz FURIA special drafted from a Rebel offer
  now wears the Rebel crest. The special keeps its moment for art/title + chemistry,
  and the Collection still shows the moment (resolves via the special's own base
  card). Updates DESIGN-DECISIONS #23.
- **Header "Play" always opens Setup**, even mid-run on `/play` (clears the run).
- **"Who ended your run" cards** now use the team-review screen's proven 6-card row
  (3-up mobile / 6-up desktop, fluid `max-w-32` cells) instead of a cramped
  flex-wrap — the layout that fixed the long-standing mobile overflow there.

### Fixed
- Share card download now goes via a Blob URL (revoked after use) instead of a
  giant data-URL `href`.

## [1.3.0] — 2026 · Rewards, chemistry, legacy rebalance + sim/UI overhaul

A large gameplay update. Progression now **unlocks content**; Legacy is finally
winnable for a great draft; chemistry is reachable; tournament fields are
org-unique; the Match Center and playoff reveal were reworked; and the community
SAM overall review landed. The Challenges feature was **designed** (see
`docs/CHALLENGES-DESIGN.md`) and deferred to a later release.

### Added
- **Rank-gated reward system** (`RANK_REWARDS`, `engine/progression`): special-card
  **rarities unlock by rank** — Unranked none · Bronze rare · Silver epic ·
  Gold/Platinum mythic · Diamond+ legendary — and the special **appearance chance
  ramps at the top** (Champion 8% · Grand Champion 12% · SSL 16%; Bronze–Diamond
  stay the familiar 5%). The **Collection is locked until Bronze** with a clear
  "reach Bronze" panel, and the rarity-progress tiles show **"Unlocks at <Rank>"**
  hints. **Hard mode unlocks at Silver** (Legacy still needs a Hard win on top);
  existing Hard/Legacy winners keep access. **Bronze lowered 400→300 XP** so one
  run — win or lose — clears the Unranked on-ramp. New `engine/progression.test.ts`
  pins the whole ladder.
- **New chemistry sources** (reachable Perfect, especially region-locked): a
  **same-region pair** link (the weakest pairwise tier — the floor that lifts a
  mixed-nationality roster out of Poor) and **coach/sub nationality** links (same
  country, or region at half), within the existing staff caps.
- **`docs/CHALLENGES-DESIGN.md`** — full design for rank-unlocked "beat-the-line"
  puzzles. Design only; implementation deferred.

### Changed
- **Org-unique tournament fields**: the Swiss/quick field now draws **one lineup
  per org** (graceful fallback for tiny regional pools), so a bracket is a set of
  distinct teams instead of "FURIA 24 + FURIA 25 + …".
- **Special cards in hidden-overall (Hard/Legacy) mode** now always show their
  **photo, identity (title/org/season) and full buff** — only the overall number
  and the rarity label stay hidden, matching base cards and GAME-DESIGN §11/§14.
  (Reverts the v0.7 over-masking.)
- **Match Center games split by outcome**: each game card lands in the **winner's
  column** (mirroring the scoreline — teamA left, teamB right), so a 4-2 series
  reads as 4 cards under one team and 2 under the other, instead of a chronological
  flow.
- **Playoffs reveal a whole round at once**: entering a round shows **all its
  matchups** (teams + overalls); the user's match plays, then the other results
  reveal one-by-one before advancing. (Previously only the user's match showed
  until its result.)
- **Draft anti-frustration tilt** (`DRAFT.tierBias`, 0.35): offers are *softly*
  weighted toward historically stronger lineups so a long session is less of a
  parade of no-hope teams — weak rosters still appear. Global and
  difficulty-independent; the **daily draw stays byte-identical** (mode-gated).

### Balance
- **Legacy made winnable** (live feedback: a 2-hour session, zero titles).
  `opponentRatingShift` 1.2→**0.6**, `opponentTierWeights` elite 2.6→**1.8**
  (a mixed gauntlet, not all-elite), user `chemistryMaxBonus` 2.6→**2.9**. Net:
  a great, chemistry-built draft (~95.5+) now wins Legacy ~**8%** of runs while a
  merely-good (92.5) team still almost never lifts it — the crown is a real but
  rare achievement. Combined with org-unique fields this dismantles the SAM "FURIA
  wall". The `balance.test.ts` Legacy band was rebased to the new intent and a
  **reachability assertion** added (a strong draft *must* be able to win it).
- **Hard**: user `chemistryMaxBonus` 2.1→**2.3** (chemistry is the player's
  asymmetric edge here — the AI cap stays 0).
- **Community SAM overall review** (`data-sources/overall-review-v1.3.csv`): **69
  overalls** adjusted via the repeatable review tool (zero drift). Roster fixes:
  Team Secret coach **BRUNOVISQUII** added (2122 ovr 79 · 2024/2025 ovr 84),
  **FURIA 2025 coach corrected to STL** (was mis-assigned BRUNOVISQUII), **EndGame
  2022-23 Luk→Royales**, **Kronovi iBUYPOWER S1 92→97**. The SAM `legacy`
  historicalStrength floors were already consistent.
- **Normal anchor**: org-unique fields restored the good-team Normal title rate;
  the test sample was raised 300→1000 runs to read the true ~5.5% reliably past
  the 5% line (the field is a touch stronger after the overall review).

### Fixed
- **Tournament fields could draw an org's multiple seasons into one bracket**
  (e.g. FURIA 24 + FURIA 25). Root cause: `generateOpponents` sampled lineups
  with no org-uniqueness guard. Now one lineup per org, with a fallback that only
  repeats an org when a small regional pool can't otherwise fill the field.

## [1.2.7] — 2026 · Info pages, full PT translation + technical polish

New static info pages with full Portuguese, richer page metadata and structured
data, a web app manifest, and a few technical/perf tidy-ups. No gameplay or
balance changes.

### Added
- **Six info pages, bilingual (EN + localized PT URLs), server-rendered and
  static**: `/about`, `/faq`, `/ratings` (overall methodology), `/strategy`,
  `/special-cards`, `/sam` (South America) and their PT twins `/pt`, `/pt/sobre`,
  `/pt/faq`, `/pt/overalls`, `/pt/estrategia`, `/pt/cartas-especiais`, `/pt/sam`.
  Copy fact-checked against `GAME-DESIGN.md` (no invented players/stats).
  `/special-cards` is a curated **no-spoiler** showcase — the in-game `???`
  collection mystery is untouched (DESIGN-DECISIONS #59).
- **Bilingual content**: the EN/PT toggle now also translates these pages + the
  home's lower content block in place — `LocaleContent` is mounted-gated to each
  URL's locale; landing on a `/pt` URL switches the whole UI to Portuguese
  (`SyncLocale`). `hreflang` (en-US ↔ pt-BR ↔ x-default) links each pair via
  `src/lib/contentMeta.ts`. (DESIGN-DECISIONS #56–57.)
- **GWR credited** as the overall-balancing lead on `/about` and `/ratings`
  (EN + PT), alongside the existing footer credit.
- **Structured data**: `BreadcrumbList` on hub pages, `FAQPage` on `/faq`,
  `HowTo` on `/how-to-play`, plus an `ItemList` builder — alongside the existing
  site-wide `VideoGame`. Helpers in `src/lib/jsonld.ts` + `<JsonLd>`.
- **Web app manifest** (`/manifest.webmanifest`) + a generated **apple-icon**.
- **`src/data/counts.ts`** — a light module for the home's "x/89" denominators so
  the menu stops importing the full `@/data` barrel just for two integers.

### Changed
- **Home** split into a server shell (`page.tsx`, metadata) and a client island
  (`HomeMenu.tsx`) that also carries the lower content block. The route map lives
  in `pageRoutes.ts` (no JSON imports) so the home bundle stays lean.
- **Footer**: added `About` + `FAQ` links; the draftrlcs.app attribution is now
  plain text (credit retained, link removed). Removed `isBasedOn` from the
  VideoGame JSON-LD.
- **Sitemap**: stable per-release `lastModified` (was `new Date()` every build),
  all new EN+PT routes, and `hreflang` alternates.
- **`RankBadge`** no longer sets `fetchPriority="high"` on the decorative,
  mounted-gated rank emblem (it paints after hydration, so the priority was wasted).
- **Canonical host signals** (metadataBase / sitemap / robots / canonical tags)
  are consistent on the apex. Removed a redundant in-code `www`→apex redirect —
  host canonicalization is already handled at the Vercel edge.

### Fixed
- None — no gameplay or balance changes this release.

## [1.2.6] — 2026 · champion-on-Hard scroll fix

### Fixed
- **Champion-on-Hard "can't scroll down"** (`ResultsScreen.tsx`). The first Hard
  championship mandatorily shows the **Legacy-unlock** ceremony, which locks page
  scroll (intended) — but its overlay was `overflow:hidden` (via `.celebrate`) and
  vertically centered, so on a **short viewport** the content and the "tap to
  continue" dismiss hint were clipped off-screen, reading as a stuck scroll lock.
  Only short viewports overflowed, so it didn't reproduce on taller screens. Root
  cause: a centered, overflow-hidden full-screen overlay clips its own dismiss
  affordance when its content exceeds a short viewport. Fix: `CeremonyPortal` is
  now a scroll container (`overflow-y-auto` + a `min-h-full` center-or-scroll
  wrapper) so any ceremony stays reachable; the Legacy rays moved to their own
  fixed clip layer (`.celebrate-rays-prism` CSS untouched → the champion hero is
  unaffected); the body-scroll lock now captures/restores the prior value. Verified
  live at 880×300 (overlay scrolls, hint reachable, scroll restored on dismiss).

## [1.2.5] — 2026 · SAM overall review + Legacy relevance + Hard/Legacy rebalance

A community overall-review pass (151 reviewed overalls), a new `legacy` lineup
flag that lifts hand-picked SAM landmark rosters into the legacy gauntlet, and a
Hard/Legacy rebalance that makes chemistry the player's edge.

### Added
- **`legacy` lineup flag** (`data-sources/teams.md` → `scripts/build-dataset.mjs`).
  A block tagged `flag: … legacy` has its `historicalStrength` floored at
  **"strong"** regardless of average overall, so the difficulty-based opponent
  sampler (`balance.ts → opponentTierWeights`) surfaces it in the **legacy**
  gauntlet — without inflating the underlying card ratings. It only weights
  opponent generation; the draft pool is untouched, and a naturally-elite lineup
  is never downgraded. Applied to **20** community-flagged SAM regional landmark
  rosters (KRÜ, Complexity, The Three Sins, Noble, eRa, Exeed, NiP, w7m,
  Godfidence, Sunset, …) that previously sat at solid/underdog and were filtered
  out of SAM legacy runs. Their expected share of a SAM-legacy opponent field
  rises from ~21% to ~74%.

### Balance
- **Community overall review applied** (`data-sources/teams.md`, regenerated +
  validated). 151 reviewed overalls from the shared review CSV — **113 player,
  21 sub, 17 coach** cards, all SAM teams (deltas +1…+25, avg +5.1; e.g. Erodium
  S7 valt 73→80, Noble esports X renaN 75→83, Most Wanted S9 math 79→84). The
  CSV's "OVR atual" column matched the dataset exactly on all 151 rows before the
  bump (no drift). Player/sub/coach ratings only — identities and lineups
  unchanged (org buffs: see Fixed).
- **Hard & Legacy rebalanced — chemistry is now the player's edge.** Players
  reported a very good team still getting knocked out in the Hard/Legacy Swiss.
  Cause: every AI lineup is a real roster at ~100% chemistry, so the shared
  chemistry cap was a near-flat field-wide buff a drafted team (~20% chemistry)
  couldn't match. New `opponentChemistryMaxBonus` (`balance.ts`) is **0 on Hard
  and Legacy** — opponents keep their rating shift, stronger field, hidden
  overalls and specials, but no longer bank a chemistry bonus the player can't.
  Easy/Normal unchanged. A "good" (~92.5) drafted team's playoff odds go ~65%→~88%
  on Hard and ~5%→~28% on Legacy; Legacy stays a brutal gauntlet (title still a
  long shot) and the ladder still reads Normal < Hard < Legacy. Overall-dominant
  anchors (GAME-DESIGN §25) untouched; a Legacy case was added to the sanity
  suite. See DESIGN-DECISIONS #54.

### Fixed
- **Data-pipeline drift reconciled** (`data-sources/teams.md` ↔ generated JSON).
  Rebuilding from `teams.md` surfaced two pre-existing spots where the generated
  JSON had been edited out-of-band without updating the source (against the
  pipeline contract): (1) the **v1.2.3 "org buffs small fixes"** — 23 org-buff
  bumps hand-applied straight to `lineups.json` — are now written back into the
  `teams.md` `org:` lines so they survive a rebuild (**net org-buff change vs the
  shipped data: none**); (2) **swiftt** (FURIA 2026) carried a stale `88` in
  `lineups.json` vs the canonical `87` in `teams.md` — the review CSV agrees (87)
  — regenerated to 87. `teams.md` is the single source of truth again and a clean
  `build:data` is now idempotent. `orgs.json` default buff levels are regenerated
  to match (18 orgs); this is the org-card *default/fallback* only — in-match org
  buffs are read per-lineup (`lineups[].orgBuffLevel`, unchanged), so gameplay is
  unaffected.

## [1.2.4] — 2026 · analytics

Post-launch analytics: detailed, **free** product analytics so we can see how
the game is actually played (runs by difficulty, win-rate, where players drop
off) without the paid Vercel events tier.

### Added
- **PostHog product analytics** (`posthog-js`) as a second analytics sink
  alongside Vercel Web Analytics. The typed `trackEvent` wrapper
  (`src/lib/analytics.ts`) now fans the same events out to BOTH; a new
  `PostHogProvider` (`src/components/PostHogProvider.tsx`) bootstraps it in the
  root layout. Configured cookieless + anonymous (localStorage persistence, no
  `identify`, autocapture and session recording off, DNT respected) so the
  privacy promise is unchanged. **No-op until `NEXT_PUBLIC_POSTHOG_KEY` is set**
  (env), so local dev and an unconfigured build behave exactly as before.
  Unlocks funnels (visit → run_started → tournament_started → run_completed),
  retention / returning players, and difficulty / win-rate breakdowns on the
  free tier.
- **`run_abandoned` event** — emitted from the run store when a run is left
  before its results screen, with `phase` (draft / review / tournament) and
  `reason` (`"quit"` to the menu / `"restart"`). Turns the funnel's implicit
  drop-off into an explicit, attributable signal.
- **SPA-aware pageviews** for PostHog (`capture_pageview: "history_change"`,
  App Router route changes), and a documented `.env.local` template for the two
  `NEXT_PUBLIC_POSTHOG_*` vars.

### Changed
- **Privacy policy — Analytics section** (EN + PT) now names both processors
  (Vercel + PostHog), states the cookieless / anonymous / DNT configuration, and
  notes that aggregate gameplay (difficulty mix, completion) is measured — not
  only page visits.

## [1.2.3] — 2026 · org buff fixes

### Balance
- **Org buff small fixes** — 23 per-season org-buff levels were hand-tuned for
  SAM regional + 2026 teams. (Edited directly into `lineups.json`; v1.2.5
  reconciled them back into `data-sources/teams.md` as the source of truth — see
  [1.2.5] → Fixed.)

## [1.2.2] — 2026

A small post-launch patch: a clearer org/coach buff readout plus roster data
corrections.

### Changed
- **Org & coach buff readout is now plain-language** (`GameCard.tsx`). The org
  card's cryptic centre symbol (`·` for neutral, `+`/`++`/`+++` for a boost) and
  matching nameplate text confused players. A neutral org now reads a muted
  **"—" / "No buff"**; a boost reads a numeric **"+2" / "Mechanics +2"** (the tier
  as a number). Coach buff pills use the same **"Stat +N"** form for consistency.

### Fixed
- **Roster / coach data** (`data-sources/teams.md`, regenerated + validated):
  coaches added — Team Liquid 2022-23 **xpere** (85), mousesports S9 **Lethamyr**
  (79), Evil Geniuses S5 **fireworks** (75), Canberra Havoc S8 **Jimmah** (72);
  FURIA 2024 coach corrected to **STL** (was brunovisqui).
- **`SnipJuzo` unified into `snipjz`** — the two ids were the same person; the
  FantasyDeath S7 card now resolves to `snipjz` (3 cards across his teams).

## [1.2.1] — 2026 · launch polish

The final pass before the public launch: a featured Daily, a special-card buff
tag, mobile card-fit fixes, more reachable chemistry, and SEO copy polish.

### Added
- **Authored Daily Challenges** (`src/lib/daily.ts`). A new `AUTHORED_DAILIES`
  map lets a specific date OVERRIDE the template wheel with a hand-designed
  config; `generateDailyConfig` short-circuits to it. Today (**2026-06-17**) is
  **"Loaded Draft"**: a **stronger field** (Hard difficulty) with **overalls left
  visible** so the cards show off, and a **hand-scripted 6-pick draft** — balanced,
  distinct orgs, a single Dignitas — where **al0t's special lands on pick 2** and
  **violentpanda's "Brain" legend (OVR 97) on pick 5**, with a deliberately weaker
  team (Gen.G, carrying the coach+sub) right before it. Deterministic by
  construction, so it stays "the same run for everyone."
- **Scripted daily draft** (`DraftState.scriptedLineups`: an exact lineup per pick,
  each optionally forcing a player to appear as a specific special; threaded
  through `createDraft` → `daily` → `runStore`). `drawNextOffer` offers the
  authored lineup for each pick (keyed off picks made, so it's reroll-proof) and
  `buildOffer` forces the scripted special onto that player — shown regardless of
  whether the slot is still open (the legend still APPEARS at pick 5; it's only
  pickable if a player slot was left open, which the weaker pick-4 team nudges by
  carrying the coach/sub the player wants instead). A scripted offer that can't
  fill the remaining slots falls back to a normal staff-aware draw, so the run
  always completes. Natural specials are suppressed (`specialChanceMult: 0`) so
  only the two authored cards appear; no rerolls (the draft is curated). Inert
  unless the field is set (default runs are byte-identical).
- **Special-card buff tag** (`GameCard.tsx`). Every special now wears a small
  pill advertising its boost — `+5 MEC`, `+3 OFF·CON`, `+5 Team` — reusing the
  existing `Badge` (`tone="good"`). On hidden-overall / Hard runs the value masks
  to `+?? MEC` (stat shown, amount hidden), per direction. It never reveals the
  card's identity, so it shows even on not-yet-unlocked specials in the draft.

### Changed
- **Daily overall-visibility is now the daily's own call**, decoupled from the
  difficulty's hidden-lock (`runStore.startDailyRun`). A Daily can run a stronger
  field (Hard) while keeping overalls visible — `config.hiddenOverall` is the
  single source of truth. (Also fixes the latent "Champions Only" template, which
  declared `hiddenOverall: false` but was being force-hidden by Hard.)
- **Achievements read varied, not monochrome-per-tier** (`achievementStyle.ts`).
  Each non-Legend tier now spreads across several distinct hues (Common: cool
  muted; Rare: cool brights; Epic: vivid jewels) so the trophy wall looks varied;
  vividness still rises with rarity. **Legend stays standardized** — one prismatic
  look for every legend, unchanged.
- **Results team-reveal staff row matches the players** (`ResultsScreen.tsx`).
  On desktop the coach/sub/org cards now use the same size and spacing as the
  three player cards, aligned on one row (a `sm+` grid mirroring the top). Mobile
  layout is preserved (and its card-fit is fixed below).
- **Region chips match the Worldwide label size** (`SetupScreen.tsx`): the region
  codes went `text-sm` → `text-base` (16px), so they no longer read squished.
- **In-card org logos shrink on mobile only** (`GameCard.tsx`). After the v1.2.0
  enlargement (`lg` = 72px) the logo crowded out the nameplate on small cards;
  it now steps down on mobile (`40px` base / `56px` `sm`) and restores to the
  full `72px` at `md+` — desktop is untouched. Card mobile padding and the overall
  number also tighten a step on mobile to keep every line inside the frame.
- **SEO copy polish** (no score regression, just sharper): refreshed `<title>`,
  a deduplicated/expanded `keywords` set, an `Esports` schema genre, a stronger
  product `description` (EN + PT, feeds metadata/OG/hero), and the OG / link-preview
  image now leads with the SAME logo lockup as the site header (the `icon.svg`
  hexagon mark + the ink/orange "RocketDraft" wordmark).

### Balance
- **Perfect chemistry is reachable** (`balance.ts` `CHEMISTRY.tiers`). Tier
  thresholds lowered — Perfect 80→72, Great 58→52, Good 36→32, Okay 15→14 — so a
  committed coherent roster (a 3-player country stack = 9 raw = 75%, or a lineup
  pair + org/coach links) now lands **Perfect** instead of stalling at Great.
  This is a label remap ONLY: the chemistry rating reward is percent-based
  (`rating.ts`), so it is unchanged, the overall-dominant anchors (GAME-DESIGN
  §25) still hold, and the AI (already ~100% chemistry) is not buffed. The 50-test
  suite — including the chemistry and full-tournament anchors — stays green.

### Fixed
- **The Creator card showed no field effect.** `FieldView.fieldFx` switches on the
  special's rarity to pick the on-pitch glow/border/holo, but the `switch` had no
  `creator` case (added after the other four), so the newest rarity fell through
  to "no effect" — on both mobile and desktop. Added the `creator` case (rose/pink
  at mythic energy, matching `.card-creator` / `.ovr-creator` in `globals.css`).
- **`how-to-play` AND `play` route metadata claimed a "budget" mechanic** that
  doesn't exist (both inherited the phrasing from the v1.1.4 per-page SEO pass) —
  both reworded to "build team chemistry" (accurate; both pages are indexed).
- **Daily "Good+/Great+ chemistry" objectives now track the tier floors.** The
  satisfaction gates in `results.ts` were hardcoded (40% / 62%) and drifted from
  the displayed tier after this patch's threshold change; they now read
  `CHEMISTRY.tiers` (Good 32% / Great 52%), so the objective passes exactly when
  the chemistry badge shows that tier. (Featured launch day isn't affected — it
  runs a win-title objective.)

## [1.2.0] — 2026 · "Regional Champions"

A second draft pool per region, the SAM Top-8 import, an easter-egg card, and a
batch of UX polish. Prep for the public launch.

### Added
- **Region-locked draft mode.** A new "Region" picker on the setup screen
  (`SetupScreen.tsx`), for both Classic and Quick: **Worldwide** (default — the
  Worlds/finals pool, unchanged) or a region. Only **SAM** is live; the other six
  show a disabled **"Em Breve" / "Coming soon"** state. A region-locked run draws
  from that region's FULL pool — its Worlds finalists PLUS its regional Top-8
  teams. Pool computed in `runStore.startRun` via `lineupPoolForRegion(region)`
  (`src/data`) and threaded through `createDraft`'s `poolLineupIds` into both the
  draft and the opponent field. `RunState.regionLock` persists it across reload /
  "play again"; `profileStore` remembers the last choice (`lastRegionLock`).
- **SAM (South America) regional dataset — 46 new lineups.** The SAM Top-8 teams
  that did NOT reach Worlds (S7→2025), researched from Liquipedia, merged into
  `data-sources/teams.md` under a labeled "Regional Top-8 (sam-only)" trailing
  section (parser reads season from each team line, region from `### SAM`). +72
  players, +138 cards → 254 lineups / 372 players / 762 cards; the Worlds /
  draftable pool stays **208**. Every block carries `flag: sam-only` → `samOnly`.
- **`samOnly` separation tag.** New `Lineup.samOnly` (schema + generator + type).
  A new `draftableLineups` export (`!samOnly`) is the default pool for the general
  draft, opponents AND daily challenges, so regional teams never leak into them.
- **"Creator" special-card rarity + the Wings easter egg.** A new `creator`
  rarity (pink/violet frame, rose-pink OVR, mythic-tier halo, `holo-creator`
  sheen). One unique card — **"Rocket Draft Creator"** (player `liberatorl`,
  OVR 91) — whose effect lifts EVERY team attribute by +2. It lives on **Wings
  E-Sports · S2**, a hidden SAM-region lineup (`rareSpawn`) that is EXCLUDED from
  the normal draw and the opponent pool and instead **force-injected** into one
  draft offer at `DRAFT.easterEggChance` (≈1%/offer, region-locked only); when it
  appears, LiberatoRL's card is GUARANTEED to be the Creator special, so the prize
  isn't gated behind a second 5% roll. Player specials can now carry
  `team_attribute_boost` (was coach-only) — applied for the user and AI teams.
- **Regional first-run tutorial** (`RunOnboarding`): a one-time "Regional Draft"
  modal (flag `seenRegionalIntro`) that chains after How-to-play.
- **Two achievements:** `regional-champion` ("Regional Royalty" — win a
  region-locked run) and the **secret** `creator` ("The Creator's Card" — unlock
  the hidden card). New optional `AchievementDef.secret` masks it as "???" in the
  grid until earned.

### Changed
- **Onboarding tutorials are more visual** — themed numbered step cards
  (how-to orange · regional emerald · legacy cyan), larger gradient badges,
  emphasized intro line.
- **Celebratory overlays are robustly full-screen.** The unlock-ceremony, rank-up
  AND Legacy-unlock now render through a shared `CeremonyPortal` that portals onto
  `<body>`. Root cause they needed it: the results screen animates with a
  `rise-in` transform, whose containing block was re-anchoring the previously
  inline `position: fixed` overlays (most visibly the Legacy unlock, which read as
  "not full-screen").
- **Celebrations advance ONLY on user input** — removed the auto-dismiss / auto-
  advance timers (unlock 1s + 3.2s, rank-up 4.2s, Legacy 5.2s). They now wait for
  a tap / Continue.
- **Region selector UX** (`SetupScreen.tsx`): the full-width **Worldwide** card
  is back on top (the default); below it a **4-then-3 grid** of equal-size region
  chips fills the container. Only **SAM** is selectable; the tags reuse the
  difficulty-mode Badges — orange **Selected** and neutral grey **Coming soon**.
  No SAM accent green. A dynamic line below names the locked region.
- **In-card logos enlarged** — `TeamLogo` md/lg/xl bumped a notch for readability
  on the draft/result cards, without overlapping the card frame.
- **Achievements reclassified into rarity tiers** — **Common · Rare · Epic ·
  Legend** (was Milestone/Skill/Collection/Legend), recoloured to match
  (slate / blue / violet / prismatic). 24 achievements: 4 common, 9 rare, 6 epic,
  5 legend.
- **Results team-reveal reworked.** The drafted line-up now shows as three
  draft-sized cards across the pitch (the middle one raised, the outer two
  aligned) with the coach/sub/org in a spaced row below — replacing the cramped
  flat grid. Achievement unlocks keep the existing corner toasts (unchanged).
- **Eliminator strip ("who ended your run") realigned** to a tidy left-aligned row.
- **Creator card reads simply "Creator"** (no rarity-type line) and is pinned
  **last** among unlocked cards in the collection (lowest sort weight).
- Version → **1.2.0 "Regional Champions"** (`site.ts` + `package.json`); reader-facing site
  changelog updated (EN + PT).

### Balance
- `DRAFT.easterEggChance = 0.01` — per-offer chance to force-inject the easter-egg
  lineup (Wings) when a region-locked pool contains one. The `&&` short-circuits
  when no `rareSpawn` lineup is present, so the seeded daily/general draws stay
  byte-identical (≈8-10% over a classic run, 3-6% over quick; tune in `balance.ts`).
- `SPECIALS.rarityWeights.creator = 12`; `XP.specialUnlock.creator = 100`.
- **Chemistry reworked to be a real lever.** Per-pair/link weights rebalanced
  (same-lineup 4 · same-country 3 · same-org 2 · org-link 1.5/player · coach 1.5
  cap 3 · sub 1 cap 2), `maxRaw 12`, tiers re-floored (Perfect 80 / Great 58 /
  Good 36 / Okay 15). A coherent roster (shared country / org / historical lineup)
  now reaches Great–Perfect, so the boost is worth chasing over a higher-rated
  all-star mix — the top overall is no longer always the smart pick. Per-difficulty
  `chemistryMaxBonus` raised (easy 1.0→1.3, normal 1.6→2.0, hard 1.8→2.1,
  legacy 2.2→2.6). `chemistry.test.ts` rewritten to the new weights + reachability
  anchors; `balance.test.ts` unaffected (fixed user team). The first-run tutorial
  now explains chemistry as the player's edge.

### Fixed
- **Overall-visibility toggle stayed off after Hard.** Selecting Hard/Legacy
  correctly locks overalls hidden, but switching back to Normal/Easy left the
  toggle off. Root cause: the difficulty button only called `setDifficulty`; the
  `showOverall` preference was never restored when the new difficulty unlocked it.
  Fix (`SetupScreen.tsx`): on a locked→open difficulty change, re-enable overalls.
- **"The Three Sins" showed Ellevens' logo**, and a few SAM orgs collided on the
  Liquipedia name-search. Pinned exact `File:` overrides (`the-three-sins`,
  `denial-esports`) and monogram fallbacks (`northern-gaming`, `cringe-society`,
  `senbei-strikers`) in `asset-overrides.json`; re-verified no duplicate logos
  (except the intentional FUT NA/SSA share) and dark-card contrast per-logo.
- **Slot-machine reel showed non-pool teams in regional mode.** The draft reel now
  spins only over the run's actual lineup pool (`run.draft.poolLineupIds`), so a
  region-locked run never flashes a team outside its region.

### Data / generator / docs
- `scripts/build-dataset.mjs`: parses `flag: sam-only` and `rare`; added SAM Top-8
  `COUNTRY` entries. Per Miguel's notes: `obtth`/`liberatorl`/`ninja23509` = BR;
  `diaz` kept as the single existing NA player (no `diaz-sam` split);
  `brunovisquii` kept as FURIA 2025 coach. Fixed the Wings block's season key
  (`· 2016` → `· S2 · 2016`).
- **Reviewed overalls integrated** (manual review-pass CSV from Miguel's friend):
  **162 overall edits** across all regions + **9 coach fixes** — 3 corrections
  (FC Barcelona S7 → `Roken`, Veloce S8 → `miztik`, FUT NA 2026 → `adam_baguette`)
  and 6 missing coaches added (Team Secret 22-23, and Twisted Minds / NiP /
  Shopify / SSG / PWR 2026). `COUNTRY` += `adambaguette` FR, `lbp` AU; coaches
  114 → 120. Applied via a matched + nick-verified migration over `teams.md`.
- **Footer credit:** added **GWR** ([x.com/zgwr_rl](https://x.com/zgwr_rl)), who
  helped balance the overalls (`site.ts` `balanceCreditName/Url`, `SiteFooter`).
- **Org logos completed + logo-era system extended.** Fetched every missing SAM
  org logo from Liquipedia (`npm run fetch:assets --orgs`), curating exact
  `File:` titles in `asset-overrides.json` for the ~14 where the name-search
  grabbed another org's logo (`w7m`, `hawks`, `monos`, `ruby`, `endgame`, …).
  Orgs with no Liquipedia logo (`bodybuilders`, `era`, `poison-bullets`,
  `sapphire`, `wings-e-sports`, `pioneers-oce`) fall back to the styled monogram.
  Added season-correct `ORG_LOGO_ERAS` for **NRG** (2016/2017/2019/2020 → 2024),
  **Dignitas** (2018 → 2025), **Spacestation** (2021 → 2023) and **Team Vitality**
  (2018 → modern), using dark-card-legible variants (verified by per-logo
  luminance — several `lightmode` files were near-black and swapped to `darkmode`).
  Coverage: 128 logos + 6 intentional monograms, 0 gaps. ATTRIBUTION.md (CC-BY-SA)
  regenerated.
- Profile persist bumped to **v3** with a backfill migration (deep-merges new
  `settings.lastRegionLock` + `flags.seenRegionalIntro` onto older saves).
- Review aids: `data-sources/sam-pending/overall-review.csv` (every team) +
  `overall-review.md` (the new SAM teams) for the manual overall pass.
- New `src/engine/regional.test.ts` (pool separation · regional pool · rare-spawn
  rarity · Creator team boost). Suite: **49 tests**, all green; `tsc` clean; lint
  at the 8-error baseline (0 new).
- **Open item:** `SnipJuzo` vs `snipjz` may be the same person under two ids —
  left separate pending confirmation.

---

## [1.1.7] — 2026

### Changed
- **Performance (PageSpeed): render-blocking CSS removed.** Enabled
  `experimental.inlineCss` in `next.config.ts` — the Tailwind CSS is now inlined
  into the HTML `<head>` instead of two render-blocking `<link rel="stylesheet">`
  requests (~590 ms of render-blocking on mobile per Lighthouse). Build-verified:
  the prerendered home has **1 inline `<style>` and 0 blocking CSS links**. Helps
  FCP/LCP (mobile LCP was render-delay-bound). Must be deployed before PageSpeed
  reflects it.
- **Modern `browserslist`** added to `package.json` (Chrome/Edge/FF ≥111,
  Safari/iOS ≥16.4) so SWC stops shipping ~14 KiB of legacy polyfills
  (`Array.at/flat/flatMap`, `Object.fromEntries/hasOwn`, `String.trimStart/End`)
  — all targeted browsers support these natively. (Observed post-deploy: Next 16
  still emits these polyfills regardless, so no measurable effect — kept as a
  modern-target baseline.) Net result after deploy: PageSpeed **mobile ~95 /
  desktop ~99** (warm run; the inlineCss change took mobile LCP 3.5s→1.4s).

> Still pending (tracked in STATUS): the home page imports the full dataset +
> Zod for two counts + `daily.info` (~94 KiB unused JS on the landing page) —
> a refactor saved for a focused follow-up (it touches the deterministic daily).

## [1.1.6] — 2026

### Fixed
- **Site not indexing on Google — apex/www canonical conflict.** The app is
  canonical on the apex (`SITE.url = https://rocketdraft.app` → `metadataBase`,
  sitemap, robots, every page canonical), but Vercel was redirecting
  apex → www (308). Googlebot hit `rocketdraft.app` → 308 → `www…`, whose
  canonical pointed back at the *redirecting* apex, so Search Console reported
  "Page with redirect", canonical "N/D", and refused to index.
  - **Fix:** made the **apex the primary served domain** and flipped the redirect
    to **`www → apex`** (Vercel → Domains). **No code change** — the code was
    already apex-canonical; only the redirect direction was wrong.
  - Verified live: apex `200`, `www → apex` `308`, `http → https` `308`, and
    sitemap/robots/all canonicals on apex+https. Pages now show under
    `site:rocketdraft.app`. Root cause: redirect direction contradicted the
    declared canonical. Remaining (Miguel, Search Console): submit the sitemap;
    the stale `http://` homepage entry self-heals on re-crawl.

### Added
- **SAM (South America) regional Top-8 dataset — staged for the "SAM Only"
  mode.** `data-sources/sam-pending/` holds `teams-sam.md` (45 new Top-8 SAM
  lineups, S7→2025, that did NOT reach Worlds/Finals, each flagged
  `flag: sam-only`), `sam-merge-notes.md` (merge steps + the generator change
  for the flag + `COUNTRY` additions + dedup/collision map + overall methodology
  + per-season Top-8 tables + Liquipedia sources) and `validate-sam.mjs`.
  **Inert:** `build:data` only reads `teams.md`, so this does NOT affect the game
  yet — it ships with the SAM-only mode patch. Researched from Liquipedia
  (rosters sourced; overalls anchored to existing dataset values per
  player/season). Validated: 0 duplicate lineup ids vs the 208 existing teams.

## [1.1.5] — 2026

### Fixed
- **Player nationalities completed + corrected from Liquipedia.** Most players
  had no country (so same-country chemistry skipped them and flags were missing
  or wrong). New audit tool `scripts/fetch-nationalities.mjs` read every player's
  Liquipedia `{{Infobox player}}` `|country=` and compared it to the curated
  `COUNTRY` map: **137 → 2 players without a country** (only `Ghaazi0` and
  `Plu'oh` have no LP page; left countryless rather than guessed). **158 entries
  written** to `COUNTRY` in `build-dataset.mjs` (134 fills + 22 verified
  corrections + 2 manual). Real fixes included e.g. `al0t` FI→SE, `deevo` AU→GB,
  `radosin` CZ→FR, `ronaky` ES→DK, `eversax` FR→BE, and the SSA-guessed `lawler`
  /`leoro`/`noxes` ZA→US/ES/PR (imports, not South Africans).
  - Each suspect was verified by hand against the LP infobox (id/name/team).
    **Wrong matches were rejected** (a shared handle resolving to a *different*
    person) and kept their prior value: `scrub` (≠ "Scrub Killa"), `greazy`
    (≠ "gReazymeister"), `torres823` (≠ "TORRES8232"), `jhzer`, `kairos`
    (LP says US but the real name is Brazilian — kept BR). Region-odd but
    id-confirmed imports (APAC/SSA Western players) were applied intentionally.
  - Root cause: the original `COUNTRY` map was a small high-confidence-only
    hand pass, so ~133 players were never assigned and a handful were guessed
    wrong. Evidence: `data-sources/nationalities-audit.md`.

### Added
- **13 new country flags** (`ch cl id ie is ma my no nz pr pt sg th`) fetched to
  `public/flags/` by `npm run fetch:assets -- --flags`, which now sees the new
  ISO codes in the rebuilt data (21 → 34 flags).

---

## [1.1.4] — 2026

### Added
- **Per-page SEO metadata** for `/play`, `/collection`, `/how-to-play` and
  `/achievements`. They were client components (can't export `metadata`), so all
  four inherited the home page's title/description — Google would have indexed
  them with the same generic title. Each is now split into a server `page.tsx`
  that exports a unique `title` + `description` + canonical and renders its
  client `…View` (the same pattern already used for `/privacy` and `/changelog`;
  `git mv` preserved the view bytes). Verified in the production build: the
  prerendered HTML carries the distinct `<title>`, `<meta name="description">`
  and `<link rel="canonical">` per route.

---

## [1.1.1 – 1.1.3] — 2026 (shipped)

> Shipped as the post-launch wave across three tags: **1.1.1** visual/special-card
> polish + revamped icon, **1.1.2** full database review + special-card photos,
> **1.1.3** image compression + collection performance. Bundled in one narrative
> below.

A post-launch follow-up: a bigger special-card collection, mobile + onboarding
polish, the analytics/SEO groundwork for measuring real usage, and PT-BR for the
last two English-only pages.

### Added
- **Custom in-game analytics events** — `src/lib/analytics.ts`, a typed
  `trackEvent` wrapper over Vercel Web Analytics, emitted from the run store:
  `run_started` (mode / difficulty / hiddenOverall), `tournament_started`, and
  `run_completed` (placement, won, team overall, swiss W-L, xp). Gives
  completion rate, difficulty mix and win-rate-by-difficulty. Values are scalar
  and non-PII, store-layer only (never in `engine/`); `run_completed` fires once
  per run (finishRun guards re-entry), never from React render.
- **Vercel Speed Insights** (`@vercel/speed-insights`) mounted next to
  `<Analytics/>` in the root layout — page-speed / Web-Vitals data.
- **`season_mvp` special cardType** — a season/league MVP award kept distinct
  from `worlds_mvp` so it isn't mislabelled as a world title. Wired through the
  Zod schema, `SpecialCardType`, and both copy dictionaries (`SPECIAL_TYPE_LABELS`).
- **PT-BR for the Privacy Policy and Changelog pages.** Both moved off hardcoded
  English into `PRIVACY` + `CHANGELOG_PAGE` copy groups and now follow the EN/PT
  switch — the route stays a server component (keeps `metadata` for SEO) and
  renders a client `…View` that reads `useCopy()`. Reverses the earlier
  "EN by design" call for these two pages (see DESIGN-DECISIONS #41).
- **Org logo-era guide**: a step-by-step comment + season-key cheat sheet +
  worked NRG example on `ORG_LOGO_ERAS` (`scripts/build-dataset.mjs`) and a
  recipe in `docs/DATA-GUIDE.md`, so multiple logos per org can be added without
  code help. (The mechanism itself already shipped in v0.5.1.)
- **Hidden dev preview** for reviewing card art: visiting `/collection?dev=1`
  renders every special as unlocked. Visual only — it never writes to the
  profile (real collection / achievements stay honest) and shows a "DEV PREVIEW"
  badge. No UI entry point; `mounted`-gated so the page stays statically rendered.

### Changed
- **Special-card rarity identity reworked** (the cards are the centerpiece):
  legendary OVR is now a **white-gold metallic** gradient (not flat amber) with
  a brighter halo; mythic OVR matches the **border red** with a stronger glow;
  epic moved from teal to a **blue → purple** border with a light-purple OVR;
  rare set to a **deep, dark blue** (slight purple touch) with a matching blue
  OVR, kept clearly distinct from epic. Effect intensity
  now clearly ramps rare → epic → mythic → legendary. Colors live in the
  `.card-*` / `.ovr-*` rules in `globals.css` + `SPECIAL_OVR_COLOR` in GameCard;
  field-glow tints in `FieldView`.
- **Header brand icon** now renders `public/icon.svg` (the same file as the
  favicon) instead of a separate inline SVG, so updating the icon in one place
  updates both.
- **Special-card photos now use `next/image`** — Vercel (and the local
  optimizer) serves a resized **WebP/AVIF** per card at its display size, lazily,
  with **transparency preserved** (so the blended/transparent photos keep
  working). A ~620KB source PNG becomes a **~13KB** WebP at card width (≈98%
  smaller); source files and their framing are untouched. Keeps the collection
  light even with the full 83-card photo set. (Quality left at the default 75 —
  Next 16 rejects non-allowlisted `quality` values.) Image optimization is
  **off in dev** (`images.unoptimized` when `NODE_ENV !== "production"`) so that
  replacing a card photo shows up on a refresh instead of serving a stale cached
  transform; production stays fully optimized.
- **Special-card source photos compressed** — the curated PNGs shipped at
  ~500KB each (600×823), **45.8MB** total. The client never gets them
  (`next/image` transcodes to WebP), but on a cold Vercel cache the optimizer
  still had to download + transform a 500KB source before the first paint —
  measurably dropping the **/collection Speed Insights score (99 → 93)** on a
  full collection. Re-encoded in place to ≤512px-wide quantized PNGs (the
  largest on-screen use is the detail modal at ~208px CSS): **45.8MB → 11.6MB
  (~74% smaller)**, alpha preserved on cut-out photos, no visible quality change
  (the client output WebP is indistinguishable at display size). New
  `scripts/optimize-images.mjs` (`npm run optimize:images`) keeps future photo
  drops light and is idempotent; `--check` fails if any file is over budget.
  Root cause: source PNGs were dropped in at full editor export weight with no
  compression pass.
- **Collection LCP** — the first ~6 (above-the-fold) unlocked card photos now
  load with `priority` (eager + high fetch priority) instead of lazily. The page
  is client-rendered and gated on `localStorage`, so photos only mount after
  hydration; without a priority hint the largest paint waited on
  IntersectionObserver. New optional `priority` prop on `GameCard` → `SpecialArt`
  → `next/image`; passed only to the leading grid cells (unlocked cards sort
  first, so those indices are exactly the above-the-fold photos).
- **Collection renders progressively** — the album now mounts `PAGE_BATCH` (24)
  cards up front and appends another batch via a bottom sentinel
  (IntersectionObserver, 600px margin) as you scroll, instead of mounting the
  whole catalogue at once. This is the lever that scales: initial DOM + image
  requests stay flat as the special-card set keeps growing (83 → 200+), which is
  what actually moves LCP/INP on a full collection. Cards still render in full
  (no `content-visibility` clipping of the overflowing glows/tilt) and the
  continuous "album wall" feel is preserved — no "load more" click. The reveal
  resets to one batch on a filter change via a render-phase reset (no
  setState-in-effect). Why progressive reveal over virtualization: the rarity
  glows/tilt deliberately overflow the card frame, so windowing would risk
  clipping; appending keeps every mounted card intact.
- **Collection grid on mobile** now shows **2 cards per row** instead of one
  oversized card (`grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]`).
  Desktop is unchanged — the original auto-fill grid still applies from `sm:` up.
  ⇢ Only the collection grid `<div>` changed; **no card-component internals were
  touched** (cards are already `fluid`/`w-full`, so they just fill the cell).
- **First-run onboarding** (How-to-Play + Legacy intros): each numbered step now
  renders as its own **Panel card** for more scannable reading. Copy is unchanged
  (still `string[]`), so EN/PT stay correct automatically.
- **`specialCards.json` is now HAND-MAINTAINED** (like `achievements.json`) and
  decoupled from the generator. `npm run build:data` no longer writes it — it
  only re-validates that every `baseCardId` resolves and regenerates the photo
  README. The legacy `SPECIALS` catalogue in the generator is reference-only now.
  This protects the hand-curated cards (now 83) from being overwritten.
  (see DESIGN-DECISIONS #42)

### Fixed
- **Game wouldn't boot after the manual `specialCards.json` edit** — two root
  causes:
  1. A new card used `cardType: "season_mvp"`, which wasn't in the Zod enum /
     `SpecialCardType` / copy labels, so schema parsing threw at load. Added it
     everywhere.
  2. Six cards referenced players/base cards that didn't resolve (referential
     integrity threw). Five were nickname/id drift or wrong era anchors and were
     re-linked to real cards: `exotiiik`→`exotiik` (spelling; base
     `exotiik-team-bds-2024` already existed), and re-anchored
     `okhalid`→`okhalid-team-falcons-2122`, `lostt`→`lostt-furia-2024`,
     `bananahead`→`bananahead-wildcard-2025`, `seikoo`→`seikoo-team-bds-2122`
     (note: this last title says "Endpoint" but seikoo has no Endpoint card in
     the dataset — flagged for Miguel). The sixth, `mawkzy`, isn't in the dataset
     at all and was moved to `data-sources/specials-pending.json` (nothing lost).
  Result: **83 valid specials**; `validate:data`, 42 tests and `next build` all green.
- **Collection lag / freeze with a large (near-complete) collection.** Root
  cause: every special card rendered a 3D `TiltCard` layer **plus** two
  `mix-blend-mode` holo layers (cursor color-dodge + reverse-holo screen) **plus**
  two `backdrop-filter: blur` pills **plus** infinite sheen/halo animations — all
  of them, for every card at once. Dozens of blend-mode + backdrop-blur + 3D
  compositing layers thrash the GPU and froze scrolling; with photos now added,
  83 images also decoded up front. Fix, in layers: (1) `TiltCard` now sets
  `will-change: transform` **only while actually tilting** (it was always-on —
  one forced GPU layer per card × 83); (2) a **`lite` mode** for the collection
  grid (`GameCard` `lite`) skips the cursor holo (mix-blend-mode) + backdrop-blur
  pills and the per-frame box-shadow halo pulse, but **keeps the 3D tilt and the
  foil sheen** so the grid still feels alive; (3) card photos **lazy-load**
  (`loading="lazy"`); (4) an `FxCard` IntersectionObserver pauses the remaining
  sheen on off-screen cards. The **full effects** (cursor holo + animated halo)
  still play on the detail / single-card view. (A first attempt that only paused
  off-screen animations didn't help — the real cost was the always-on
  blend/backdrop/tilt *layers* on the visible cards, not the animations.)
- **Toned down the rarity halos/glows** a notch (legendary especially) — it read
  too strong once real card photos were added. `*-halo` keyframes, the static
  `.card-*` glows, and the legendary holo sheen (`.holo-legendary::after`, ~25%
  lower opacity) in `globals.css`.

### Data — RLCS Worlds dataset corrected vs Liquipedia
- Audited every RLCS World Championship field (S1 → 2026) against Liquipedia
  (wikitext-verified) — full findings in `data-sources/liquipedia-worlds-audit.md`.
  Team **counts were all correct**; the errors were **rosters**, mostly in the
  3rd slot and in MENA/APAC/SSA + the 2025 season.
- Fixed in `data-sources/teams.md` (then regenerated): S6 (Chiefs ↔ Tainted
  Minds swap), 2021-22 + 2022-23 (MENA/APAC/SSA/OCE/SAM rosters), 2024 (Oxygen,
  QuikTrip Pioneers, Team Secret), 2025 (Dignitas/NiP rosters, **Geekay moved
  MENA → EU**, TSM, FURIA, Team Secret). `validate:data` + 42 tests pass; all
  special-card refs still resolve.
- **Normalized duplicate player spellings**: `ExplosiveGyro` → `Gyro.`,
  `Sweaty_Clarence` → `Sweaty`. `zen` (EU) and `ZeN` (OCE) kept distinct (the
  generator already splits that key). Org spellings already unified via
  `ORG_ALIAS` (no new duplicates found).
- Obscure-region + newly-added players use approximate overalls. **Not changed:**
  S9 (no Worlds happened — COVID) and 2026 (not played yet) — flagged for a call.

## [1.0.0] — "Kickoff" — 2026 (released)

The public launch (rocketdraft.app), assembled across focused passes.
**Pass 1: launch foundation + card work. Pass 2: settings, sound, dailies.
Pass 3a: polish adjustments (below).** Still to land before 1.0 ships:
**PT-BR translation + language switch** (Pass 3b). (Accounts + leaderboard are
a v1.1 fast-follow.)

### Added (Pass 3b — PT-BR + language switch)
- **Full Portuguese (PT-BR) translation** of the UI with an **EN/PT toggle in
  the header** (always visible). Persisted per device; switches instantly with
  no reload, including mid-run.
- i18n architecture: `copy.en.ts` (`EN`) + `copy.pt.ts` (`PT`) + a `useCopy()`
  hook **gated by `useMounted()`** so the first (server-matching) render is EN,
  then the saved language — no hydration mismatch/flash. `getCopy()` covers
  non-component helpers. `<html lang>` updates with the language.
- Translated: home, nav, footer, setup, draft, team review (incl. analyst
  readout), tournament, results, collection, profile, settings, achievements,
  how-to-play, onboarding, difficulty names/taglines, card role tags, and
  narration. Scope note: historical CONTENT stays EN by design — achievement
  titles/descriptions, special-card titles/flavor/effects, player/org/season
  names, daily-challenge labels, the engine-generated XP-line labels, and the
  changelog/privacy long-form pages.

### Changed / Fixed (Pass 3a — polish)
- Settings icon is now a proper **gear** (was a sun).
- Light **menu click** sound + a light **match-resolved** cue in the sim
  (distinct for the user's series won vs lost).
- **Collection grid fills the row** (CSS auto-fill, fluid cards) — no more
  empty column on the right on desktop; locked + earned stay the same size.
- Special **overall numbers**: legendary is a true **gold** (not pale yellow),
  and mythic/rare/epic are more saturated (less washed out).
  ⇢ tweak in `SPECIAL_OVR_COLOR` in `src/components/cards/GameCard.tsx`.

### Added (Pass 2 — settings, sound, dailies)
- **Settings screen** (`/settings`, gear in the header): sound on/off + volume,
  reduce-motion override, and animation speed (Slow/Normal/Fast). Persisted.
- **Animation speed** scales the draft reel, reveals, ceremonies and page
  transitions (`--anim-scale`) and sets the tournament playback default;
  **Reduce motion** is a manual override on top of the OS setting.
- **Subtle sound effects** (synthesized — no assets): draft pick, reroll,
  tournament start, card unlock, rank-up, win/lose. Respects the volume/mute
  setting; off is instant.
- **Richer daily challenges**: a sequential **daily number** (#1, #2, …), new
  models (**Legacy Day**, **Underdog** — win with a sub-88 team, **Champions
  Only**), and new bonus objectives (Great+ chemistry, win the title,
  team-overall-under). The number + objective show on the home card.

### Added (Pass 1 — launch foundation)
- **SEO**: full metadata for rocketdraft.app (canonical, Open Graph, Twitter
  card, keywords), a generated OG/preview image, `sitemap.xml`, `robots.txt`,
  `VideoGame` JSON-LD, and a Google Search Console verification hook
  (`GOOGLE_SITE_VERIFICATION` env).
- **Vercel Web Analytics** (privacy-first, no cookie banner). Search-impression
  data comes from Search Console (set up at deploy).
- **Footer** across the site: Changelog · How to play · Privacy · Discord ·
  Support links, "Made by LiberatoRL", "Inspired by draftrlcs.app by Rams",
  and the version/codename. (Discord + support links render once set in
  `src/config/site.ts`.)
- **Changelog** and **Privacy Policy** pages (`/changelog`, `/privacy`).
- **Subtle home buttons** for the community Discord and "buy me a coffee"
  (hidden until their URLs are set).
- **First-run How-to-Play modal** (shown once) and a **first-Legacy intro**
  modal (one-time flags in the profile store).
- `src/config/site.ts` — one place for the domain, version, attribution and
  external links.

### Changed
- **Special-card overall numbers are rarity-colored** (legendary gold, mythic
  red, epic teal, rare indigo) with a heavy `.ovr-shadow` so they stay legible
  over the photo.
- **Epic rarity → teal/emerald** (frame, halo, holo, accents, field FX) — a
  cleaner blue→green→red→gold ladder than the orange trial.
- **Special cards on the "Your Team" field now carry a rarity-tinted
  holographic sheen** (`field-holo`) on top of the glow + border, on every run.
- **Draft header shows the season's year** next to the season label (only when
  the label doesn't already contain it).
- **Rank images load faster**: explicit dimensions + eager/high-priority
  decoding (no layout shift / late paint).

### Fixed
- **Org cards: the "ORG" tag is a fixed color again** (it was tracking the
  region color); only the org's region chip stays region-tinted.
- **Small/reduced cards no longer clip the type·rarity pill** — it now
  truncates with an ellipsis inside the card instead of spilling past the
  frame and clipping mid-letter.

---

## [0.6.1] — "Main Stage" (cont.) — 2026-06-15

Tuning round on v0.6.0, by direction — colors, effects and the celebration
moments. Not yet committed: Miguel reviews on localhost first.

### Changed
- **Special-rarity palette, take 2** (by direction): **rare** goes back to the
  bluish dark-purple (indigo) it was before; **epic** becomes **orange/amber**
  (the purple/pink wasn't working); **mythic** stays red; **legendary** is
  pushed further from the gold base cards — a near-white platinum-gold border
  with a traveling shimmer and the brightest halo, so it reads as the single
  most special card in the game.
- **Special-card effects now ramp by tier**: the cursor holo, sheen and halo
  scale from rare (faintest) up to legendary (most spectacular), and are more
  pronounced across the board than before.
- **Collection is a single grid again** (no rarity sections): unlocked cards
  lead in rarity→overall order, then the still-locked cards in the same order.
- **Reset run restarts in place**: the in-run Reset button now starts a fresh
  draft on the SAME difficulty/mode instead of bouncing back to the setup
  screen (`runStore.restartRun`).
- **"Who ended your run" shows the FULL opposing roster** — players plus coach
  and sub (when fielded) and the org, not just the three players.
- **Special FX on the "Your Team" pitch now show on Hard/hidden runs too** and
  are a living rarity glow (animated `field-fx`), not just a border line — a
  special's presence is public information; only base-card rarity stays hidden.

### Added
- **Legacy unlock celebration**: winning your first Hard tournament (which
  unlocks Legacy) now gets its own full-screen, prismatic moment in the same
  language as the card-unlock / rank-up ceremonies.

### Fixed
- **"New card unlocked" and "Rank up" now advance on a tap ANYWHERE** on the
  overlay (not only on the emblem); the explicit Continue/Next button stops
  propagation so it doesn't double-advance.

---

## [0.6.0] — "Main Stage" — 2026-06-15

The last polish pass before the **1.0** community launch — a feedback round on
the MVP plus launch-prep. Committed by Miguel after localhost review.

### Added
- **Run resets automatically when you leave it** (by direction): the
  leave-the-run confirmation modal is gone. Navigating off the run page — to
  home, collection, profile, anywhere — now silently resets the run
  (`AppShell` clears it whenever the route isn't `/play`; a refresh on `/play`
  still resumes). DESIGN-DECISIONS #30.
- **"Reset run" button** next to the difficulty tag in the run header — a
  deliberate restart back to the setup screen, behind one confirmation.
- **Eliminator reveal** (experimental, `FEATURES.showEliminatorTeam`): on a
  lost run, a subdued strip on the results screen shows the historical lineup
  that knocked you out (last lost series' opponent), with the stage and final
  score. Built to be trivially reversible — flip the flag and the data field
  stays null, so nothing renders. DESIGN-DECISIONS #31.
- **Special-unlock XP** (by direction): a newly unlocked special grants flat XP
  by rarity (rare 10 · epic 20 · mythic 40 · legendary 75), added after the
  difficulty multiplier like achievement XP and shown as its own breakdown line.
- **Card role tags**: player/coach/sub/org wear a small color-coded pill
  (player blue · coach amber · sub emerald · org region-colored) so kinds read
  at a glance; the org card's region chip matches the draft-draw region accent.
- **Collection rarity sections**: the album is grouped by rarity
  (Legendary → Mythic → Epic → Rare), each section sorted by overall; locked
  cards are grouped the same way.

### Changed
- **Special-card rarity palette** (by direction): legendary → white & gold
  (Ultimate Team "Legend" look), mythic → red, epic → purple/pink, rare → dark
  purple — a distinct color identity per tier on the frame, halo and title
  accent. DESIGN-DECISIONS #32.
- **Drafted cards on the field now wear their rarity border** (overalls-visible
  modes only): special cards get their rarity color + glow, base cards their
  gold/silver/blue border. Hidden runs stay neutral — rarity is secret there.
- **Rank-up celebration reworked**: now a full-screen overlay in the same
  language as the "new card unlocked" ceremony (black backdrop, emblem bursting
  in the center) and using the MENU rank art instead of the profile set (the
  v0.5 version read as cramped and pulled the wrong art).
- **Hidden-run specials show a team logo**: on Hard/hidden runs a masked
  special now wears the drawn lineup's crest — like the other cards — instead
  of a bare "?", while its own moment stays hidden. DESIGN-DECISIONS #33.
- **Mobile step transitions reset the scroll** to the top of the page (every
  phase change and each new draft lineup) — tapping a bottom-of-screen button
  used to land the next step still scrolled to the bottom.

### Balance
- Special-unlock XP added (above) — small, collection-side, never scaled by
  difficulty (`XP.specialUnlock`). No simulation knobs changed.

### Fixed
- **Drawn team flashed before the slot-machine reel** (recurring — the v0.5.1
  `useLayoutEffect` only narrowed it). Root cause: the reel was armed AFTER the
  new offer rendered, so the real lineup name painted for one frame before the
  reel covered it. The reel reveal is now a child component remounted per draft
  round (`key`), building its spinning names in a lazy `useState` initializer,
  so the drawn name is never rendered before the reel lands. React-Compiler
  safe — no setState or ref access during render (the project has
  `reactCompiler: true`).
- **Mobile review cards overlapped**. Root cause: the review strip used
  fixed-width `size="sm"` cards (w-32 / 128px) inside a 3-column grid whose
  mobile tracks are narrower than 128px, so cards overflowed and overlapped.
  The strip now uses the same proven fluid + max-width wrapper the draft and
  results screens already use — only this strip changed, card internals
  untouched (measured: 0 overlaps at 375px, cards shrink to ~109px to fit).
- **Collection card sizes differed**: locked cards rendered narrower than
  earned ones (md:w-40 vs md:w-44). Locked cards now match the earned GameCard
  footprint exactly (w-36 md:w-44 — measured identical).

### Quality gates
- 42 vitest tests pass, `tsc` clean, `next build` clean. ESLint baseline
  unchanged (8 pre-existing `react-hooks/set-state-in-effect` warnings in
  untouched UI primitives; this change adds none).

---

## [0.5.1] — 2026-06-12

Hotfix round on v0.5.0 feedback — the draft screen is the visual heart of
the app and shipped broken. Not yet committed/deployed: Miguel reviews on
localhost first.

### Added
- **Era-aware org logos**: orgs rebrand, and a card should wear the logo of
  ITS season. `seasons.json` gained `order`, orgs can declare `logoEras`
  (curated `ORG_LOGO_ERAS` map in the generator), and `TeamLogo` resolves
  `public/orgs/<orgId>@<era>.png → <orgId>.png → monogram` from the card /
  lineup season. Wired through draft cards, field view and every tournament
  view. NRG is the worked example: classic shield through S9, modern mark
  after. `fetch-assets` gained an `"orgFiles"` override block (exact
  Liquipedia file → asset) and now prefers NEWER files for the default logo
  slot (org pages list every past identity, including predecessor orgs).
- Identity guard tests: zen (EU) ≠ ZeN (OCE), era spellings never become
  separate orgs (alias map), same-name orgs from different regions stay
  split — the unification contract is now CI-enforced.

### Changed
- **One-click drafting** (by direction): clicking a card drafts it straight
  into the first open compatible slot — the select-then-place step is gone
  (player slots are functionally identical, so there was nothing to choose).
- **Hidden runs reveal org logos** (by direction): base cards and org cards
  show their team crest on blackout runs — only ratings, buffs and rarity
  stay secret.
- **Specials are masked on hidden runs** (by direction): the rarity frame,
  holo and effect description announce "this is a special", but the photo,
  title, card type, moment context and overall stay hidden until the
  results-screen reveal (draft, review and field views).
- Draft hint copy updated for the one-click flow.

### Balance
- **Special appearance 16% → 6%** (coach 12% → 5%) by direction — a Hard
  run surfaced 4 specials and they stopped feeling special. ~0.4 expected
  special sightings per run across all modes.

### Fixed
- **Draft cards rendered at different sizes** (v0.5.0 regression, urgent):
  pickable cards collapsed to their content width while disabled ones kept
  full size. Root cause: the fluid-width attempt set `w-full` only on the
  inner card frame, but `<button>` wrappers are shrink-to-fit (unlike the
  `<div>` used by disabled cards), so 100% of a collapsed parent collapsed.
  `GameCard` now has a real `fluid` mode that threads `w-full` through
  TiltCard → button → frame, with the size cap on an outer wrapper
  (`max-w-36 md:max-w-44` — the original card size). Team reveal uses the
  same path.
- **Drawn team name flashed before the slot-machine reel** (v0.5.0
  regression): the reel was armed in `useEffect`, which runs after paint —
  the new offer rendered for a frame first. Moved to `useLayoutEffect`.
- **Leaving a run briefly showed the screen underneath**: `clearRun()`
  before `router.push("/")` re-rendered `/play` as the setup screen during
  the route transition. Leaving now only navigates — the home page already
  abandons the run on mount (run-header back button, leave-run modal and
  the results back-to-menu button all fixed).
- Review screen no longer leaks special-card titles on hidden runs (the
  effect description still shows, per direction).

## [0.5.0] — 2026-06-12

First live-playtest feedback round (Vercel MVP) — the "last MVP version"
before the 1.0 push.

### Added
- **Slot-machine lineup reveal**: each drawn lineup spins in through a
  decelerating name reel ("the draw felt instant" feedback). Reduced-motion
  users skip it; resumes after refresh don't replay it.
- **Rank-up celebration**: ranking up now gets its own full-screen moment
  (badge burst + rays) after the unlock ceremony — the old corner badge was
  easy to miss.
- **Region color identity** in the draft: the drawn lineup's region badge is
  color-coded (NA blue · EU amber · SAM green · MENA purple · OCE cyan ·
  APAC rose · SSA orange).
- **Leave-run guard**: navigating to the menu mid-run (nav links, logo, the
  run-header back button) asks for confirmation — playtesters lost drafts to
  stray Home clicks. Results phase never warns. Profile, collection,
  achievements and how-to-play pages all gained a "Back to menu" link.
- **Asset fetcher** (`npm run fetch:assets`): downloads org logos and player
  photos from Liquipedia (rate-limited per their API terms, CC-BY-SA
  attribution generated in `public/ATTRIBUTION.md`) and country flags from
  flagcdn — no more saving 200 images by hand. Misses are reported and can
  be mapped in `data-sources/asset-overrides.json`; existing files are never
  overwritten. Country chips now render real flag images when present.
- **Difficulty outcome tests** (`balance.test.ts`): full-tournament rates
  for a representative good roster are pinned per difficulty (playoffs/title
  bands), so balance regressions fail CI, not playtests.

### Changed
- **Tournament playback v3 (focus + pacing)**: the Match Center now shows
  ONLY the user's series — AI series never hijack it (they pop into the
  bracket/standings and stay clickable). Within a round the user's series
  plays first, game by game (950ms), then lingers ~2.8s so the result and
  narration can be read; a breath separates rounds. Swiss standings move
  only when a full round is revealed ("Through Round N" tag).
- **Spoiler fixes**: upcoming Swiss opponents are hidden until every
  simulated round is fully revealed (Swiss pairs by record — naming the next
  opponent leaked the current result), and the playoff bracket only appears
  once the whole Swiss stage has been revealed.
- **Special cards belong to the PLAYER, not one base card**: any Kronovi
  card can roll any Kronovi special. When one appears it carries its own
  historical moment (org/season shown and used for chemistry). Which special
  shows is weighted by rarity — legendaries are the chase pulls
  (`SPECIALS.rarityWeights`).
- **"No Coach"/"No Sub" are no longer pickable** (v0.3 punt reverted by
  feedback): they render as stamped vacant cards, a fully blocked offer
  grants the free reroll, and when only staff slots remain the lineup draw
  softly favors lineups that still have a coach/sub
  (`DRAFT.staffScarcityBoost`).
- Collection grid sorts collected cards first.
- Draft/team-reveal card grids are fluid on phones (fixed-width cards
  overlapped below ~400px).
- Achievements: per-achievement hue variation inside each category family,
  light 3D tilt on earned cards, and a premium animated prismatic frame for
  the legend tier. The unlock toast (and results list) now wears each
  achievement's own icon/colors instead of a generic trophy.
- 3D tilt deepened on all tiers (light 5°→8°, strong 10°→14°, max 15°→19°).
- How-to-play texts caught up with v0.2 rules (double elim, no player-as-sub).

### Balance
- **The game was too hard overall** (live feedback: good teams missing
  playoffs). Three structural causes found and fixed:
  1. **Series form swing ±6 → ±4.5** — at ±6, a +3 rating edge was close to
     a coin flip, which read as "my good team keeps losing".
  2. **AI chemistry advantage trimmed**: every historical lineup has 100%
     chemistry, so `chemistryMaxBonus` acted as a flat field-wide buff —
     lowered across the board (easy 1.2→1.0 · normal 2.2→1.6 · hard 2.8→1.8
     · legacy 2.8→2.2).
  3. **Superteam compression** (`TEAM_RATING.superteamPivot/Slope`): rating
     above 94 counts at 0.55× for BOTH sides. Historical 99-overall rosters
     (zen/Vatira/M0nkey M00n at 100% chemistry ≈ 102 total) were an
     unbeatable Bo7 wall — the title was near-impossible even with a great
     draft. Hierarchy preserved, wall removed.
- Normal: user roll −4..4 → −3..4, elite weight 1.0 → 0.7. Hard: user roll
  → −3.5..4, elite 1.5 → 1.15, shift +0.5 → +0.3. Easy: shift −1.5 → −2.0.
- Measured outcomes for a 92.5-rated roster (300+ runs/difficulty): Easy
  100% playoffs / 59% title · Normal 97% / 12% (28% with a 94.5 dream
  draft) · Hard 79% / ~1%. Title chance now scales with draft quality.
- Specials appear meaningfully more often: base card chance 7% → 16%
  (coach 5% → 12%) — the per-player pool also multiplies eligible cards.
  Daily "Specials Surge" multiplier ×4 → ×2.5 accordingly.

### Fixed
- **Chemistry felt broken — root cause: org identity fragmentation.** The
  same organization spelled differently per era created SEPARATE orgs
  ("Team Dignitas"≠"Dignitas", "Renault Vitality"≠"Team Vitality",
  "Chiefs ESC"≠"Chiefs Esports Club", Mock-It ×3, QuikTrip Pioneers), so
  same-org chemistry never connected across eras. The generator now
  unifies them via an alias map while lineups keep their era display name.
  Conversely, same-name-different-org collisions (OCE Pioneers vs SSA
  Pioneers, FUT Esports NA/SSA) are now split per region — they were
  incorrectly fused into one org before. Player ids were already normalized
  (yanxnz/Yanxnz/yanXNZ = one person) — verified by test.
- ~24 missing nationalities curated (high-confidence only), improving
  same-country chemistry coverage (157 → 133 without one).
- **Champion celebration rays clipped while rotating** — the `inset:-55%`
  ray layer was a rectangle, so its short side crossed the panel edges as it
  spun. Now a square sized past the container diagonal, centered with the
  `translate` property (which survives the `transform` rotation).
- Stale `.next` Turbopack cache served pre-edit CSS in dev — cleaned;
  README troubleshooting note already covered the recovery.

## [0.4.0] — 2026-06-12

The real dataset + MVP closing polish.

### Added
- **Full historical dataset** imported from the curated finals archive:
  **208 lineups · 624 player cards · 305 players · 83 coaches · 76 subs ·
  104 orgs across 15 seasons (2016 → 2026) and 7 regions (SSA added)**.
  Test data fully replaced.
- **Dataset pipeline**: `npm run build:data` regenerates every JSON (and the
  image-manifest READMEs) from `data-sources/teams.md` — future data updates
  are an MD edit + one command. Tests are dataset-agnostic now.
- **54 official special cards** (47 players + 7 coaches) from the v3
  catalogue: legendary legacy cards, every Worlds/Major MVP, iconic moments.
  New v3 effect model (direct attribute boosts; coach cards boost TEAM
  attributes), multiple specials per base card, coach specials appear on
  coach cards in the draft (separate low-frequency pool).
- **Era-accurate org buffs**: the same org can be `+` in one season and
  `+++` in another (per-lineup override; the org entity keeps a default).
- Tilt 3D em todas as cartas (leve nas normais, forte nas especiais, máximo
  na visualização da coleção) + **holo Balatro-style reativo ao cursor**
  por tier: foil (rare) · reverse-holo (epic) · holo (mythic) ·
  polychrome animado (legendary).
- One unique icon per achievement (22), keeping category colors.
- Back-to-menu link on the achievements page.

### Changed
- Home mode cards now open their OWN setup (Classic → classic difficulty
  select; Quick → quick) — no mode switcher inside setup. "Play again"
  returns to that mode's difficulty selection.
- Draft: clicking a card whose kind has a single open destination
  (coach/sub/org or the last open player slot) assigns immediately.
- Unlock ceremony auto-plays (reveal + advance); clicking skips ahead.
- Daily Challenge: a loss no longer reads as "completed" — the card shows
  Victory (+XP) or Defeat plus "come back tomorrow", and the streak counts
  only victories.
- Player nationality is now optional data (the archive doesn't carry it);
  same-country chemistry applies only when both players have one. ~85
  well-known nationalities curated in the generator.
- Card overall floor relaxed to 50 (bench/staff ratings + vacant cards).

### Fixed
- **`npm run dev` failing with "connection refused"**: orphaned dev-server
  processes plus a stale `.next/dev/lock` (Next 16's single-instance lock)
  blocked new instances. Cleaned up; troubleshooting note added to README.
- **Champion celebration showed only two rotating beams**: a plain
  `conic-gradient` holds its last stop instead of repeating — switched to
  `repeating-conic-gradient` (gold and prismatic variants).
- UTF-8 corruption introduced by a PowerShell bulk-edit during development
  was caught and reverted before commit (files restored from git).

## [0.3.0] — 2026-06-12

Feedback round 2 + the first MVP 2 features.

### Added
- **Quick Draft (live)**: players-only draft into a straight 8-team
  single-elimination Bo5 bracket. Mode selector on the setup screen;
  XP at ×0.5.
- **Daily Challenge (live)**: date-seeded run — same draft, opponents and
  modifiers for everyone on the same day. Template wheel for variety
  (Pure Bracket, Regional Lockdown, Old School, Modern Era, Blackout,
  No Safety Net, Gauntlet, Specials Surge) plus optional bonus objectives
  (chemistry / goals-conceded). One play per day, local streak counter,
  XP at ×1.5. Lives on the home screen with today's modifiers.
- **Star-of-the-game narration**: every game has a star from the winning
  side; OT/deciding/high-roll games show them in the Match Center, series
  summaries name who led the charge, and "Best player" on results now uses
  real star counts instead of noise.
- **Unlock ceremony**: freshly unlocked specials get a card-back → burst
  reveal moment before the results screen.
- **Share card**: canvas-rendered 1200×630 result image (placement, roster,
  record, XP) downloadable from results.
- 8 new achievements (Lift-Off, Comeback Kings, On the Podium, The Long Way,
  Strangers, Old School, Immortal Gauntlet, Curator) with per-category
  visual identities (milestone/skill/collection/legend) in the grid.
- Tiered holographic effects on special cards (epic reverse-holo, mythic
  holo, legendary prismatic) and **3D tilt + cursor glare** in the collection.
- Flawless-run celebration (prismatic variant) when winning without
  dropping a series; champion celebration fixed and upgraded.
- "No Coach"/"No Sub" vacant cards are now **pickable** — intentionally
  punt a slot (overall 50, no bonuses, excludes nobody).
- Profile: title rate, playoff rate, podiums and lifetime Swiss wins.

### Changed
- Home reworked: Classic Draft is the menu's primary action; Quick and
  Daily are live side cards.
- Review screen relayout (field + analyst left, numbers right, card strip
  below) — cards no longer sink below the fold. Starting the tournament now
  begins the simulation automatically.
- Simulation controls gained 4× speed; "View results" is bigger and
  duplicated at the bottom of the bracket page.
- Setup pre-selects the last mode/difficulty/visibility; "Play again"
  starts a new run directly with the same setup.
- Hidden-overall runs now black out EVERYTHING except special cards:
  coach bonuses, org buffs and org rarities included (draft, field, review,
  brackets).
- Run history shows the last 10 entries.

### Balance
- Hard softened (was over-tuned, compounded by the champion-heavy small
  dataset): user roll range −5..4 → −4..4, opponent shift +1.0 → +0.5,
  elite weight 1.8 → 1.5. Legacy shift 1.5 → 1.2.
- Rank curve stretched for a 100-150-run road to Supersonic Legend
  (SSL at 30,000 XP; growing gaps per tier).

### Fixed
- **Reset-progress modal could open unreachable and lock the scroll.** Root
  cause: the page-level `rise-in` animation kept a computed transform
  (fill-mode `both`), turning the page into a containing block for
  `position: fixed` — the dialog anchored to the page middle instead of the
  viewport. Fixed by rendering modals through a portal on `<body>` and
  switching `rise-in` to fill-mode `backwards`.
- **Champion celebration looked broken**: `text-shadow` renders above
  `background-clip: text` gradients. Switched the glow to
  `filter: drop-shadow`.
- Daily run no longer gets wiped by the home screen's "reset run on menu"
  rule when launched from the menu.

## [0.2.0] — 2026-06-11

First feedback round on the MVP — draft flow, simulation flow and visual
identity reworked.

### Added
- **RLCS field view**: the drafted team renders on a stylized top-down pitch
  (3 players on field, coach/sub on the bench, org slot) — used on the draft
  and review screens, and as the placement target during the draft.
- **Double-elimination playoffs** (upper + lower bracket, Bo7) plus a
  dedicated **third-place series** (LB semifinal loser vs LB final loser).
  New placements: Champion / Grand Finalist / 3rd / 4th / Top 6 / Top 8.
- **Automatic tournament simulation**: press Start once — user series play
  game-by-game in the Match Center, AI series resolve in the background,
  rounds chain automatically. Speed toggle (1×/2×), pause and skip-to-end.
  Standings and brackets are spoiler-safe (only revealed results show).
  After the run, every finished series can be clicked open for review.
- Swiss "Your Path" bracket cards with team logos and green/red outlines on
  the user's matches (also applied across the playoff bracket).
- Placeholder cards ("No Coach" / "No Sub", overall 50, no rarity) when a
  historical lineup didn't field one.
- **Common (no-rarity) tier**: overalls ≤69 and neutral orgs; org cards now
  carry rarity from their buff (+ silver · ++ gold · +++ blue).
- Asset pipeline (drop files in, no code): `public/orgs/<orgId>.png`,
  `public/ranks/menu|profile/<rankId>.png`,
  `public/cards/specials/<specialId>.png` — all with automatic styled
  fallbacks and README manifests in each folder.
- "Unranked" rank tier; growing XP curve up to Supersonic Legend (14.5k XP).
- Achievements tile on the home screen, dedicated `/achievements` page and
  slide-in achievement toasts on the results screen.
- "Untouchable" achievement + results callout: complete a run without
  conceding a single goal (intentionally near-mythical).
- Champion celebration on the results screen (rotating rays, confetti,
  shining title) — restrained for non-title runs.

### Changed
- **Draft interaction**: click a card, then click the target slot on the
  field — no confirm button. Players choose WHICH player slot (1/2/3).
- Offer layout: two rows of three (players / coach·sub·org).
- Card redesign: base cards show the org logo as centerpiece (no player
  photos by design); special cards carry a player photo with stronger
  rarity treatment (halos, foil sheen, photo gradient).
- **No resume system**: returning to the menu resets the run; the in-run
  header has a back button. Refreshing mid-run still resumes (accident
  protection), but leaving the flow abandons it.
- Sub slot accepts only sub cards (player-as-sub removed). When an offer has
  nothing pickable the player now gets a **free reroll** (doesn't consume
  the difficulty budget).
- Results team reveal arranged as players row + staff row.
- XP model: per-playoff-series-win line + placement bonuses replace the old
  semifinal/final lines (see BALANCE-GUIDE).

### Fixed
- Persisted runs from v0.1 are discarded on load (store version bump) — the
  run shape changed and resuming one would crash.

## [0.1.0] — 2026-06-11

First playable build (MVP 1 + collection/progression slice).

### Added
- Classic Draft: free-choice draft over 6 slots (3 players, coach, sub, org)
  from randomly drawn historical lineups; person-level draft exclusion;
  player-as-substitute rule; forced free skip; rerolls by difficulty.
- Difficulties Easy / Normal / Hard + unlockable Legacy (win on Hard).
- Overall visibility toggle; locked hidden on Hard/Legacy; full reveal on the
  results screen (card-flip animation).
- Base card rarities (silver / gold / blue) + hidden "??" black cards.
- 10 special cards (rare/epic/mythic/legendary) with situational effects and
  the draft-and-finish unlock rule; collection album with filters, rarity
  progress and detail modal.
- Tournament: 16-team Swiss (Bo5, pre-computed next pairings, live standings)
  into single-elimination Bo7 playoffs (8 teams, seeded bracket); skippable
  game-by-game series ticker with broadcast-tone narration.
- Chemistry system (lineup / country / org / coach / sub links) with tiers
  and review breakdown; org buffs; coach bonuses; sub depth bonuses.
- Results screen: placement, highlights (best player, biggest win, closest
  series, toughest loss), XP breakdown with difficulty/hidden modifiers, rank
  progress, achievements, special unlocks.
- Progression: XP, 8 RL-inspired ranks, 13 achievements, run history (25),
  profile screen with reset.
- Hand-curated dataset: 24 lineups · 72 player cards · 49 players · 16 orgs ·
  12 coaches · 4 subs · 11 seasons (2016 → 2023-24, all six regions).
- Zod validation + referential integrity for the whole dataset.
- Seeded, reload-deterministic RNG; runs resume after refresh.
- Test suite (26 tests): dataset integrity, draft rules, chemistry, Swiss
  structure, simulation sanity anchors, full-run integration.
- Docs: architecture, data guide, balance guide, design decisions, roadmap.

### Balance
- Initial values for every knob in `src/config/balance.ts` (see
  BALANCE-GUIDE.md). Simulation anchors verified by tests:
  equal ratings ≈ 50/50 · +2 ≈ 65-75% · +6 ≥ 85% · +12 ≥ 97% per series.

### Fixed
(pre-release QA, kept for the record)
- **Simulation was far too deterministic** — a +2 rating edge won ~93% of
  Bo5 series because per-game noise averages out across a best-of. Root
  cause: single noise source. Fix: added a per-series "form" roll
  (`SIMULATION.seriesFormRange`) that does not average out; consistency and
  defense-stability dampen its negative side.
- **User team region was computed from the first pick only** (display bug in
  `engine/teams.ts`).
- **"Best player" highlight ignored the actual card overalls** (used the team
  average for every candidate).
- **Series ticker could label a Bo7 as Bo5** when the series ended in 5 games.
- **Going 3-0 in Swiss auto-simulated the entire playoffs** (caught in the
  first visual playtest). Root cause: "user advanced" was treated as "user has
  no series left", triggering the fast-forward meant for eliminations. Fix:
  rounds now auto-resolve only while the user has no pending series
  (`userHasPendingSeries`), stopping at the user's next playoff matchup; a
  "Playoff spot secured" panel covers the waiting state.

[0.1.0]: v0.1.0
