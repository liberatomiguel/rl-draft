# Roadmap

Follows the base document's MVP phasing (§37), adjusted for what v0.1.0
already shipped. The north star for every item (§42): *does it make the draft
more fun, more readable or more replayable?*

## ✅ Shipped — v0.1.0 → v0.4.0 (MVP complete)

Classic Draft core, 4 difficulties (Legacy unlockable), hidden-overall mode,
Swiss + DOUBLE-ELIM playoffs (lower bracket + 3rd-place series), automatic
simulation playback, Quick Draft, Daily Challenges (template wheel +
streak), full historical dataset (208 lineups, 2016-2026, generated
pipeline), 54 official special cards with holo tiers + 3D tilt, unlock
ceremony, share card, star narration, 22 achievements, XP/9 ranks, local
persistence, docs + 33 tests. See CHANGELOG + STATUS.md.

## Next — release & playtest

- Drop real images (orgs / ranks / specials — manifests in `public/`).
- Publish on Vercel; share with the community testers.
- Feedback-driven balance pass (BALANCE-GUIDE workflow).
- Small polish from playtest notes; optional SFX pack (muted by default).

## Then — MVP 3: accounts & sync

- Supabase project + schema mirroring the two stores (profile + runs).
- Discord OAuth via Supabase Auth; guest → account migration of local saves.
- Daily leaderboard (the daily seed is already shared globally).
- Settings screen (animation speed, reduced motion, language PT-BR/EN).

## Later — MVP 4: data expansion & advanced modes

- Liquipedia API ingestion feeding `data-sources/teams.md` (the generator
  pipeline already isolates the game from the source format).
- Regional Draft (the draft engine already takes a lineup-pool filter).
- Grand-final bracket reset option; collection categories beyond specials;
  run detail replay from history.

## Explicitly out of scope (per base doc)

Monetization, lootboxes, betting/wagering mechanics of any kind; era-based
chemistry; fixed player roles (1st/2nd/3rd) until the core loop is validated.
