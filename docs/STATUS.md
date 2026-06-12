# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-12, after v0.5.0 (first live-playtest feedback round).

## Where we are

**The MVP is live on Vercel and the first community feedback round is
addressed** at v0.5.0 — declared the last MVP version before the 1.0 push.
Working today:

- Classic Draft (6 slots, select-then-place on the RLCS field view,
  slot-machine lineup reveal, region-colored badges, free reroll when
  blocked, staff-scarcity weighting, person-once-per-run rule; vacant
  coach/sub cards show but are never pickable)
- Quick Draft (3 players, single-elim Bo5) and Daily Challenge (date-seeded
  template wheel, one attempt/day, Victory/Defeat states, win-streak)
- Difficulties Easy/Normal/Hard + unlockable Legacy; hidden-overall mode
  with full blackout and results reveal
- Tournament: 16-team Swiss (Bo5) → double-elimination Bo7 playoffs;
  **user-centric playback v3** — Match Center shows only the user's series,
  standings step per revealed round, upcoming opponents stay hidden until
  the round is fully revealed (spoiler-proof), readable pacing with
  1×/2×/4×/skip
- **Real dataset**: 208 lineups / 624 cards / 305 players / 101 orgs
  (era spellings unified for chemistry; same-name orgs split per region) /
  15 seasons (2016-2026) / 7 regions — generated from
  `data-sources/teams.md` via `npm run build:data`
- **54 official special cards** owned by the PLAYER (any card of theirs can
  roll any of their specials, rarity-weighted appearance, the special's own
  moment drives display + chemistry), tiered holo, 3D tilt (deepened in
  v0.5), unlock ceremony, collection album (collected first)
- Progression: XP → 9 ranks, rank-up celebration, 22 achievements with
  per-achievement visual identity (legend tier = animated prismatic frame;
  unlock toast matches), profile stats, run history, share-card PNG export
- Navigation: every page has Back to menu; leaving a run mid-way asks one
  confirmation (results never warns)
- **Assets**: `npm run fetch:assets` pulls org logos + player photos from
  Liquipedia (rate-limited, attribution generated) and flags from flagcdn;
  drop-in overrides via `data-sources/asset-overrides.json`; styled
  fallbacks still cover anything missing
- All local persistence (guest play); leaving to the menu resets the run

Quality gates: 39 vitest tests (incl. full-tournament difficulty outcome
bands), `tsc` clean, `next build` clean. Git: v0.1.0 → v0.5.0.

## Balance picture (v0.5, measured)

Good roster (~92.5): Easy 100% playoffs / 59% title · Normal 97% / 12%
(dream draft 94.5 → 28%) · Hard 79% / ~1-3%. Title chance scales with draft
quality; the Swiss wall is gone. Knobs and rationale: BALANCE-GUIDE.md.

## Pending / next actions (in order)

1. **Finish the asset pass**: `npm run fetch:assets` resolves most org
   logos/player photos automatically; review the misses it lists and map
   them in `data-sources/asset-overrides.json` (watch same-name collisions,
   e.g. FUT Esports NA). Rank art (9 ×2 sets) is still hand-made by Miguel.
2. **Deploy v0.5.0** (push → Vercel auto-builds) → second community
   playtest round, validate the new difficulty curve + playback pacing.
3. Decide the remaining open questions (DESIGN-DECISIONS.md bottom):
   PT-BR translation, opponents fielding drafted people, grand-final
   bracket reset, hidden-mode scope.
4. Then **1.0 release** and **MVP 3** (`docs/ROADMAP.md`): Supabase +
   Discord OAuth, synced progress, daily leaderboard, settings screen
   (animation speed / reduced motion / language).

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
