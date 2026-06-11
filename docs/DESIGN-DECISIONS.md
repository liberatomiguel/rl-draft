# Design Decisions (beyond the base document)

The base document ([GAME-DESIGN.md](GAME-DESIGN.md)) left some gaps that had
to be closed to ship a coherent MVP. Every call is listed here with its
rationale so it can be reviewed — none of these are sacred.

## Gameplay rules

1. **Person-level exclusion covers players, coaches and subs.**
   The rule "a player picked once cannot be picked again in later rolls"
   is enforced on the *person*, not the card — and extended to coaches/subs
   for consistency (Mew drafted once = every Mew card is gone for that run).
   Orgs don't need it (a single org slot already blocks repeats).

2. **Player cards can fill the substitute slot.** Once the three player slots
   are full, player cards remain pickable as "Joins as substitute" (sub-level
   impact, not player-level). Reason: only some historical lineups carry a
   dedicated sub card, so a sub-only hunt at the end of a draft could drag for
   many rounds; this keeps every round meaningful and adds a real decision
   (bench a star for depth?). Dedicated sub cards can ONLY fill the sub slot.

3. **Forced skip.** If nothing in an offer is pickable (slots full / persons
   taken / lineup lacks the card type you still need), the lineup can be
   skipped for free. Voluntary skips don't exist — that would make rerolls
   pointless.

4. **Lineups are drawn without replacement** within a run (no repeated
   offers). If the pool ever exhausts (tiny dataset + many skips), it resets
   silently, keeping person exclusions.

5. **Swiss pairings are pre-computed** one round ahead so the UI can show
   "your next opponent" before you press play (anticipation beats surprise
   here). The simulation still happens on click.

6. **When the user is eliminated, the rest of the tournament auto-simulates**
   so the results screen can say who won the title. Costs nothing, adds story.

7. **Playoffs = single-elimination Bo7, 8 teams, seeds 1v8/4v5/2v7/3v6** from
   Swiss results (losses, then game diff, then rating). Double elimination is
   roadmap (only `engine/playoffs.ts` changes).

8. **Legacy is in the MVP** (the base doc deferred it) — it was nearly free
   on top of the difficulty system and completes the unlock loop:
   win on Hard → Legacy appears on setup.

9. **Opponent teams can include people you drafted.** Facing "Vitality
   2022-23" while you own zen is allowed — it's a what-if fantasy draft, and
   blocking it would distort the opponent pool. Flag for review if it feels
   wrong in playtests.

10. **Special card appearance is per-offer (7%)** on each player card that
    has a special version, independent of difficulty (base doc §7 lists the
    *opponent* special chance per difficulty; the player-side draft chance
    stays flat to keep the draft pool fair).

## Scope

11. **MVP 1 ships with a slice of MVP 2** (special cards + collection +
    13 achievements + XP/rank + run history). Rationale: the special-card
    unlock rule is the core replay motivator ("finish the run even when
    losing"), and validating the loop without it would test the wrong game.
    Cut from MVP 2 still pending: collection categories beyond specials.

12. **UI language: English.** The base doc's copy examples are English and
    esports UI convention favors it. Every string lives in
    `src/content/copy.ts`, so a PT-BR pass is a single-file translation.
    **Open question for Miguel.**

13. **Placeholder art**: initials in a hex shield, gradient by rarity; org
    monograms; country code chips instead of flag images (no external
    requests, works offline). `imageUrl`/`logoUrl` fields are already in the
    schema for real art later.

## Technical

14. **Single `/play` route with phase switching** (no URL per game phase).
    The run is one continuous, refresh-safe flow; deep links into a half
    -finished draft would create broken states. Hub pages (home, collection,
    profile, how-to-play) have real routes.

15. **Seeded RNG with a persisted cursor** — reload-deterministic runs and a
    free path to daily challenges (shared seed).

16. **Zustand + localStorage** (`persist`) over Context/Redux: tiny API,
    built-in persistence, model matches "one run store + one profile store".

17. **The dataset is honest about uncertainty**: unknown coaches are either
    absent (old eras) or generic "Coaching Staff" cards (modern eras), never
    invented people. Some assignments are best-effort and documented as such
    in DATA-GUIDE.md.

## Open questions for review

- UI language final call (EN now; PT-BR translation is one file).
- Should opponents be allowed to field people you drafted (decision #9)?
- Special draft chance 7% — fast enough collection pace?
- Hidden runs currently hide opponent team ratings too (full blackout).
  Alternative: show opponent ratings, hide only yours.
- "Best player" of the run is currently overall + small variance — a deeper
  per-game impact model is possible if it matters.
