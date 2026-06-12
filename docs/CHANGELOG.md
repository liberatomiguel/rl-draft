# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) ·
versioning: [SemVer](https://semver.org/) (0.x while the MVP is being
validated).

Sections per release: **Added · Changed · Balance · Fixed**.
Bugs found after a release get an entry under **Fixed** in the next release,
with the root cause — that section doubles as the project's bugfix log.

---

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
