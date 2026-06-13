# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) ·
versioning: [SemVer](https://semver.org/) (0.x while the MVP is being
validated).

Sections per release: **Added · Changed · Balance · Fixed**.
Bugs found after a release get an entry under **Fixed** in the next release,
with the root cause — that section doubles as the project's bugfix log.

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
