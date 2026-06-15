# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-15. **v0.6.0 "Main Stage"** (the big polish pass before
> 1.0) is COMMITTED. **v0.6.1** (a tuning round on top) is implemented but
> **uncommitted** — Miguel reviews on localhost and commits manually.

## v0.6.1 — tuning round (uncommitted)

Colors, effects and celebration moments (full detail in CHANGELOG /
DESIGN-DECISIONS #36–40):
- **Rarity palette take 2**: rare → bluish indigo (restored); epic → orange;
  mythic → red; legendary → radiant platinum-gold + shimmer (clearly above the
  gold base cards). Per-tier holo/halo EFFECTS now ramp rare → legendary.
- **Collection** back to a single grid (unlocked first by rarity→overall, then
  locked).
- **Reset run** restarts a fresh draft on the same difficulty (no setup bounce).
- **"Who ended your run"** shows the FULL opposing roster (coach/sub/org too).
- **Field special FX** now show on Hard/hidden runs and glow (not just border).
- **Legacy unlock** (first Hard win) gets its own full-screen celebration;
  the unlock/rank-up overlays dismiss on a tap anywhere.
- Gates: 42 vitest tests pass, `tsc` clean, no new lint.

## v0.6.0 "Main Stage" — the committed polish pass

Feedback batch + launch polish (CHANGELOG / DESIGN-DECISIONS #30–35):
- Run reset is automatic + silent on leaving the run page; Reset button by the
  difficulty tag. Mobile scroll resets per step; review strip overlap fixed.
- Slot-machine flash fixed (per-round keyed child + lazy-init reel). Rank-up is
  a full-screen ceremony using MENU art. Kind tags color-coded. Hidden-run
  specials show the lineup crest. Eliminator reveal (flag-gated). Special-unlock
  XP by rarity. (Some v0.6.1 items below revise the palette/collection here.)

## Where we are

**The MVP is live on Vercel; v0.5.x addressed feedback round 1; v0.6.x is the
final polish before 1.0.** Working today:

- Classic Draft (6 slots, ONE-click drafting onto the first open slot,
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

Quality gates: 42 vitest tests (incl. full-tournament difficulty outcome
bands), `tsc` clean, `next build` clean, ESLint baseline unchanged. Git:
v0.1.0 → v0.6.0 (v0.6.1 uncommitted, pending Miguel's localhost review).

## Balance picture (v0.5, measured)

Good roster (~92.5): Easy 100% playoffs / 59% title · Normal 97% / 12%
(dream draft 94.5 → 28%) · Hard 79% / ~1-3%. Title chance scales with draft
quality; the Swiss wall is gone. Knobs and rationale: BALANCE-GUIDE.md.

## Pending / next actions (in order)

1. **Miguel reviews v0.6.1 on localhost and commits manually** (his call —
   if `npm run dev` won't start, stop stray `node.exe` and delete `.next`,
   then start again; running `next build` before a dev server can serve stale
   CSS until `.next` is cleared). Then bump to **1.0** when happy; v0.6.x is
   the last pre-launch polish.
2. **Finish the asset pass**: remaining manual curation = `pioneers-oce`
   logo + `jstn`/`fairypeak` photos (`false` markers in
   `data-sources/asset-overrides.json`); replace any photo by overwriting
   `public/cards/specials/<specialId>.png` (the fetcher never overwrites).
   Era logos: extend `ORG_LOGO_ERAS` as rebrands are confirmed (NRG done).
   Rank art (9 ×2 sets) is still hand-made by Miguel.
3. **Deploy** (push → Vercel auto-builds) → second community playtest
   round, validate the difficulty curve + playback pacing + 6% specials.
4. Decide the remaining open questions (DESIGN-DECISIONS.md bottom):
   PT-BR translation, opponents fielding drafted people, grand-final
   bracket reset, hidden-mode scope.
5. Then **1.0 release** and **MVP 3** (`docs/ROADMAP.md`): Supabase +
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
