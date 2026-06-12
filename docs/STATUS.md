# Project Status — handoff notes

> Snapshot for whoever (human or agent) picks this up next.
> Last updated: 2026-06-12, after v0.4.0.

## Where we are

**The MVP is feature-complete** at v0.4.0 (see CHANGELOG for the full
journey). Working today:

- Classic Draft (6 slots, select-then-place on the RLCS field view, vacant
  No Coach/No Sub picks, free reroll when blocked, person-once-per-run rule)
- Quick Draft (3 players, single-elim Bo5) and Daily Challenge (date-seeded
  template wheel, one attempt/day, Victory/Defeat states, win-streak)
- Difficulties Easy/Normal/Hard + unlockable Legacy; hidden-overall mode
  with full blackout (incl. coach bonuses/org buffs) and results reveal
- Tournament: 16-team Swiss (Bo5) → double-elimination Bo7 playoffs with
  lower bracket + third-place series; fully automatic playback (1×/2×/4×,
  pause, skip), spoiler-safe standings, clickable series review
- **Real dataset**: 208 lineups / 624 cards / 305 players / 104 orgs /
  15 seasons (2016-2026) / 7 regions, generated from
  `data-sources/teams.md` via `npm run build:data`
- **54 official special cards** (incl. 7 coach specials) with v3 attribute
  -boost effects, tiered holo (foil/reverse-holo/holo/polychrome), 3D tilt
  everywhere, unlock ceremony (auto-plays), collection album with detail view
- Progression: XP → 9 ranks (Unranked→SSL, ~100-150 runs), 22 achievements
  (unique icons), profile stats, run history (last 10), share-card PNG export
- Star-of-the-game narration with real player names
- All local persistence (guest play); leaving to the menu resets the run

Quality gates: 33 vitest tests (dataset-agnostic), `tsc` clean,
`next build` clean. Git: 5 commits, v0.1.0 → v0.4.0.

## Pending / next actions (in order)

1. **Miguel drops the images** into `public/` (orgs ×104, ranks ×9 ×2 sets,
   specials ×54 — generated READMEs in each folder list exact filenames).
2. **Publish**: push to GitHub → import on Vercel (Hobby tier, zero config,
   no env vars). Instructions were given in chat; nothing in the code blocks
   deployment.
3. **Community playtest round** → collect feedback → balance pass
   (`docs/BALANCE-GUIDE.md` workflow).
4. Then **MVP 3** (`docs/ROADMAP.md`): Supabase + Discord OAuth, synced
   progress, daily leaderboard.

## Open questions awaiting Miguel

- UI language: EN now; PT-BR would be a one-file translation
  (`src/content/copy.ts`).
- Opponents can field people you drafted (what-if rule) — keep?
- Grand-final bracket reset (LB team must win twice)? Currently single GF.
- "Untouchable" achievement is near-impossible by design (literal: zero
  goals conceded all run) — keep as ultra-chase or rebalance?
- Hidden runs black out opponent ratings too — alternative: hide only yours.

## Known soft spots (not bugs)

- ~157 players have no nationality (file has none) — same-country chemistry
  skips them; nationality map lives in `scripts/build-dataset.mjs`.
- Coach bonus types are hash-derived (file only has overalls) — curate in
  the generator if wanted.
- Org name variants create separate orgs on purpose ("Chiefs ESC" ≠
  "Chiefs Esports Club"); unify in `data-sources/teams.md` if undesired.
- `docs/ARCHITECTURE.md` predates modes/daily — still accurate on layers,
  see CHANGELOG for evolution.
