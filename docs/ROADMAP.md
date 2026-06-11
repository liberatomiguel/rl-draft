# Roadmap

Follows the base document's MVP phasing (§37), adjusted for what v0.1.0
already shipped. The north star for every item (§42): *does it make the draft
more fun, more readable or more replayable?*

## ✅ v0.1.0 — MVP 1 (+ collection slice)

Classic Draft core, 4 difficulties (Legacy unlockable), hidden-overall mode,
Swiss + single-elim playoffs, special cards + collection + achievements +
XP/rank, local persistence, responsive UI, docs + tests.

## v0.2 — Loop polish (validate the fun)

- Playtest balance pass (use BALANCE-GUIDE workflow; log under Balance).
- Dataset growth toward the "better early dataset" (§36): 30 lineups,
  90 cards, 10 subs, more coaches — pure JSON work.
- Draft feel: card hover details, pick history ("drafted from G2 '20-21"),
  small SFX hooks (muted by default).
- Optional: show opponent ratings on hidden runs (open question in
  DESIGN-DECISIONS.md).

## v0.3 — MVP 2 completion

- Collection categories beyond specials (players seen, orgs, moments).
- More achievements + achievement toasts in-run.
- Run detail page from history (full bracket replay of a past run).
- More special cards (target 20-30) and 1-2 new effect types.

## v0.4 — MVP 3: accounts & daily

- Supabase project + schema mirroring the two stores (profile + runs).
- Discord OAuth via Supabase Auth; guest → account migration of local saves.
- Daily Challenge: shared seed (the RNG layer is already seeded), modifier
  rules (§32), daily leaderboard later.
- Settings screen (animation speed, reduced motion, language).

## v0.5 — MVP 4: data expansion & advanced modes

- Liquipedia API ingestion script generating the same JSON contract
  (see DATA-GUIDE.md “Future” section); manual adjustments overlay file.
- Double-elimination Bo7 playoffs (swap `engine/playoffs.ts`).
- Quick Draft (3 players, short bracket) and Regional Draft (region-filtered
  pools — the draft engine already takes a pool parameter conceptually).
- Real card art / org logos via `imageUrl`/`logoUrl`.

## Explicitly out of scope (per base doc)

Monetization, lootboxes, betting/wagering mechanics of any kind; era-based
chemistry; fixed player roles (1st/2nd/3rd) until the core loop is validated.
