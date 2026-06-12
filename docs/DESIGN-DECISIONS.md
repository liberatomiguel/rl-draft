# Design Decisions (beyond the base document)

The base document ([GAME-DESIGN.md](GAME-DESIGN.md)) left some gaps that had
to be closed to ship a coherent MVP. Every call is listed here with its
rationale so it can be reviewed — none of these are sacred.
Items marked ~~struck~~ were superseded by the v0.2 feedback round.

## Gameplay rules

1. **Person-level exclusion covers players, coaches and subs.**
   The rule "a player picked once cannot be picked again in later rolls"
   is enforced on the *person*, not the card — and extended to coaches/subs
   for consistency (Mew drafted once = every Mew card is gone for that run).
   Orgs don't need it (a single org slot already blocks repeats).

2. ~~Player cards can fill the substitute slot.~~ **Removed in v0.2** by
   direction: only sub cards fill the sub slot. The sub-scarcity problem
   (few lineups carry one) is covered by the free-reroll rule below; growing
   the subs dataset further reduces friction (see DATA-GUIDE).

3. **Free reroll when stuck** (v0.2, replaces "forced skip"). If nothing in
   an offer is pickable, the player is granted a free reroll that does NOT
   consume the difficulty budget. Voluntary skips still don't exist.

3b. **Slot-target picking** (v0.2). Drafting is two clicks: select the card,
   then click the destination slot on the field view. Players choose which
   of the three player slots — free positional ordering, no confirm button.

4. **Lineups are drawn without replacement** within a run (no repeated
   offers). If the pool ever exhausts (tiny dataset + many skips), it resets
   silently, keeping person exclusions.

5. **Swiss pairings are pre-computed** one round ahead so the UI can show
   "your next opponent" before you press play (anticipation beats surprise
   here). The simulation still happens on click.

6. **When the user is eliminated, the rest of the tournament auto-simulates**
   so the results screen can say who won the title. Costs nothing, adds story.

7. **Playoffs = DOUBLE ELIMINATION Bo7** (v0.2), 8 teams seeded
   1v8/4v5/2v7/3v6 from Swiss results. Lower bracket R2 crosses sides to
   delay rematches. One grand final (no bracket reset — flag if wanted).
   **Third-place series**: in pure double elim 3rd/4th are decided without a
   match; per direction we added a bronze decider — LB semifinal loser vs
   LB final loser — played right before the grand final.

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

## v0.2 additions

18. **No resume system.** Returning to the menu resets the run (one-click
    back button in the run header, no confirmation modal). Refreshing the
    page mid-run still restores it — that protects against accidents, not
    intentional exits.

19. **Spoiler-safe playback.** The tournament simulates ahead internally but
    the UI derives standings/brackets only from *revealed* series, so the
    auto-playback never leaks results before showing them.

20. **"Untouchable"** (no goals conceded all run) is implemented literally
    as directed and is therefore near-impossible by design (~25+ games all
    with clean sheets). It doubles as a long-term chase goal. If it should
    be attainable, the goal model in `match.ts → flavorGoals` is the knob.

21. **Asset conventions over configuration**: org logos, rank art (two sets)
    and special-card photos are looked up by id under `public/`, with styled
    fallbacks when missing. Dropping files in is the whole integration.

## Open questions for review

- UI language final call (EN now; PT-BR translation is one file).
- Should opponents be allowed to field people you drafted (decision #9)?
- Special draft chance 7% — fast enough collection pace?
- Hidden runs currently hide opponent team ratings too (full blackout).
  Alternative: show opponent ratings, hide only yours.
- Grand final bracket reset (LB team must win twice)? Currently single GF.
- "Best player" of the run is currently overall + small variance — a deeper
  per-game impact model is possible if it matters.
