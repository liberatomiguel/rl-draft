# Roadmap

Follows the base document's MVP phasing (§37), adjusted for what v0.1.0
already shipped. The north star for every item (§42): *does it make the draft
more fun, more readable or more replayable?*

## ✅ Shipped — v0.1.0 → v1.2.6 (LAUNCHED on Vercel)

Classic Draft core, 4 difficulties (Legacy unlockable), hidden-overall mode,
Swiss + DOUBLE-ELIM playoffs (lower bracket + 3rd-place series), automatic
simulation playback, Quick Draft, Daily Challenges (template wheel +
streak), Regional Draft (lineup-pool filter; shipped v1.2.0), full historical
dataset (254 lineups, 2016-2026, generated pipeline), 84 official special
cards with holo tiers + 3D tilt, unlock ceremony, share card, star narration,
24 achievements, XP/9 ranks, local persistence, docs + 51 tests. See
CHANGELOG + STATUS.md.

Release & playtest (DONE / shipped):

- Real images dropped (orgs / ranks / specials — manifests in `public/`).
- Published on Vercel; shared with the community testers.
- Feedback-driven balance passes (BALANCE-GUIDE workflow).
- Polish from playtest notes; optional SFX pack (muted by default).

## Then — MVP 3: accounts & sync (v1.3, genuine NEXT phase)

- Supabase project + schema mirroring the stores (profileStore is the durable
  store to mirror).
- Discord OAuth via Supabase Auth; guest → account migration of local saves.
- Daily leaderboard (the daily seed is already shared globally).
- Settings (animation speed, reduced motion, language PT-BR/EN) — the settings
  screen already exists.

## Later — MVP 4: data expansion & advanced modes

- Liquipedia API ingestion feeding `data-sources/teams.md` (the generator
  pipeline already isolates the game from the source format).
- Grand-final bracket reset option; collection categories beyond specials;
  run detail replay from history.

## Explicitly out of scope (per base doc)

Monetization, lootboxes, betting/wagering mechanics of any kind; era-based
chemistry; fixed player roles (1st/2nd/3rd) until the core loop is validated.
