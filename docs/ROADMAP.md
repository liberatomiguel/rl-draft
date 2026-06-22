# Roadmap

Follows the base document's MVP phasing (§37), adjusted for what v0.1.0
already shipped. The north star for every item (§42): *does it make the draft
more fun, more readable or more replayable?*

## ✅ Shipped — v0.1.0 → v1.3.5 (production) + v1.4 (on `staging`)

Classic Draft core, 4 difficulties (Legacy unlockable), hidden-overall mode,
Swiss + DOUBLE-ELIM playoffs (lower bracket + 3rd-place series), automatic
simulation playback, Quick Draft, Daily Challenges (template wheel +
streak), Regional Draft (lineup-pool filter; shipped v1.2.0), full historical
dataset (259 lineups, 2016-2026, generated pipeline), 86 official special
cards with holo tiers + 3D tilt, unlock ceremony, share card, star narration,
56 achievements, XP/9 ranks, local persistence, docs + ~121 tests. See
CHANGELOG + STATUS.md.

**v1.4 (built on `staging`)** ships on top: Challenges (20 authored puzzles,
every series Bo7), accounts + cloud sync + leaderboards + MMR (email + 6-digit
code login, dormant until the Supabase env vars are set), special-card rarity
rework, additive chemistry, Run recap (run history detail), and visual/mobile
polish.

Release & playtest (DONE / shipped):

- Real images dropped (orgs / ranks / specials — manifests in `public/`).
- Published on Vercel; shared with the community testers.
- Feedback-driven balance passes (BALANCE-GUIDE workflow).
- Polish from playtest notes; optional SFX pack (muted by default).

## ✅ Shipped — accounts & sync (v1.4, was MVP 3)

- Supabase project + schema mirroring the stores (profileStore is the durable
  store to mirror).
- **Email + 6-digit code login** (Supabase email OTP) via `sendEmailCode` /
  `verifyEmailCode`; guest → account migration of local saves. (Discord OAuth
  remains a possible LATER 2nd sign-in option, not the implemented auth.)
- Leaderboards + MMR (the daily seed is already shared globally).
- Run recap (run history detail) — shipped.
- Settings (animation speed, reduced motion, language PT-BR/EN) — the settings
  screen already exists.

## Later — MVP 4: data expansion & advanced modes

- Liquipedia API ingestion feeding `data-sources/teams.md` (the generator
  pipeline already isolates the game from the source format).
- Grand-final bracket reset option; collection categories beyond specials.

## Explicitly out of scope (per base doc)

Monetization, lootboxes, betting/wagering mechanics of any kind; era-based
chemistry; fixed player roles (1st/2nd/3rd) until the core loop is validated.
