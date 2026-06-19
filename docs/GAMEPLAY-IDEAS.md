# Gameplay ideas — longevity backlog (brainstorm, NOT committed work)

> Status: **IDEAS ONLY.** Nothing here is built or scheduled. This is a menu of
> directions to extend replayability and lifespan, written against what the game
> already has so the effort estimates are realistic. Each idea notes **fit**
> (how well it reuses existing systems) and a rough **effort**. Pick the ones
> that excite you; many compose.

The north star (per ROADMAP §42): *does it make the draft more fun, more readable,
or more replayable?* Monetization / lootboxes / wagering stay out of scope.

---

## A. Ride the v1.4 systems (highest leverage — the rails are now laid)

These get most of their value from Challenges + Leaderboards, which just shipped.

1. **Weekly Featured Challenge (rotating, global).** A single hand-picked or
   seeded challenge that everyone gets the same week, with its own leaderboard
   (fastest clear / highest margin / lowest team overall to still win). Turns the
   one-and-done challenge set into a *recurring event*. **Fit:** very high (reuses
   challenge engine + the daily's date-seed idea + leaderboards). **Effort:** S–M.

2. **Community Challenge Builder + sharing.** Let players author a challenge
   (pick the boss line + a twist) and share it via a short code/URL; others play
   the exact same puzzle. A "featured community challenges" board. **Fit:** high
   (the challenge data model already encodes everything; you'd add encode/decode
   + a small builder UI). **Effort:** M. *This is the biggest replayability
   multiplier — UGC never runs out.*

3. **Draft-vs-Draft (async PvP).** You draft a team; it's stored as a "ghost"
   others can be matched against (their draft vs your saved team, simulated). A
   ladder of head-to-head records. **Fit:** high (you already store
   `TournamentTeam`s and simulate series; needs the cloud to exchange ghosts).
   **Effort:** M–L. Huge social hook once accounts are live.

4. **Seasons / ladder resets.** A 4–8 week "season": leaderboards reset, a season
   number + a cosmetic season badge, all-time boards preserved separately. Gives
   lapsed players a reason to return at each reset. **Fit:** high (leaderboards +
   a season field). **Effort:** S–M.

5. **Predictions tied to real RLCS.** Before a real event, draft who you think
   wins / make bracket calls; score after results land (you curate the outcome).
   Ties the game to the live esport calendar. **Fit:** medium (new light mode +
   manual result entry). **Effort:** M.

## B. New draft modes (reuse draft → sim, low engine risk)

6. **Survival / Gauntlet.** One draft, then face an *endless* ladder of
   progressively stronger lines; how far can you go? Score = rounds survived. A
   natural leaderboard. **Fit:** high (loop `simulateSeries` with a rising boss).
   **Effort:** S–M.

7. **Auction / Budget draft.** Each player has a *cost* (scaled to overall); you
   build under a salary cap. Forces real trade-offs (one superstar vs. a balanced
   roster). **Fit:** medium (add a cost model + a budget UI to the draft).
   **Effort:** M.

8. **Snake / multi-team draft.** Draft against AI GMs who also pick from the pool
   (cards get taken), so board awareness matters. **Fit:** medium (the pool +
   exclusions already exist; add AI picking). **Effort:** M.

9. **Blind / Mystery draft.** Overalls fully hidden AND names obscured until
   picked — pure read on org/era/region cues. (Extends the Hard "hidden overall"
   idea one step further.) **Fit:** high. **Effort:** S.

10. **Redraft a real event.** Pre-seed the bracket with a historical field and let
    the player redraft ONE slot of it — "what if iBUYPOWER had picked X?" **Fit:**
    medium (scripted tournament + a single redraft). **Effort:** M.

## C. Draft depth (more decisions per pick = more replay)

11. **Player traits / archetypes.** Tag players (Playmaker, Wall, Clutch, Mechanical,
    Anchor) and reward *complementary* trait combos in chemistry, not just
    same-org/country. Adds a second axis to "who fits with whom". **Fit:** medium
    (extend chemistry; data tagging effort). **Effort:** M. *Deepens the core loop
    everything else rides on.*

12. **Fixed roles (1/2/3 / striker–mid–anchor).** The base doc deferred this until
    the core loop was validated — it now is. Assign each pick a role and grade the
    roster on role coverage. **Fit:** medium. **Effort:** M.

13. **Synergy specials.** Special cards that only fire when paired (e.g. two
    ex-teammates on the roster) — turns the collection into a combo puzzle. **Fit:**
    high (special-effect system + the shared-history chemistry data exist).
    **Effort:** S–M.

14. **Coaching / draft "perks".** Spend a small earned currency on one-time draft
    perks (an extra reroll, peek a hidden overall, lock a card). Light roguelite
    texture. **Fit:** medium. **Effort:** M.

## D. Collection & meta progression

15. **Card mastery / favorites.** Track wins-with-card; a "most successful roster"
    hall of fame on the profile. Cheap, sticky. **Fit:** high (you already store
    run history + rosters). **Effort:** S.

16. **Cosmetic, earn-only card frames / nameplate.** Non-pay cosmetics tied to
    milestones (clear all challenges, SSL rank, season badges). Status without
    monetization. **Fit:** high. **Effort:** S–M.

17. **Set / collection bonuses.** Completing a themed set (e.g. "all S1 legends",
    "an entire region's special cards") grants a cosmetic or a tiny daily perk —
    gives the collection a *finish line* beyond raw count. **Fit:** high. **Effort:** S.

## E. Engagement loops & social proof

18. **Milestone & login cadence rewards** (cosmetic): a gentle daily/streak track
    that hands out frames/badges, not power. Pairs with the existing daily streak.
    **Fit:** high. **Effort:** S.

19. **Richer share cards** with the *replayable seed* embedded — "beat my run"
    links that drop a friend into the exact same daily/challenge. Organic growth.
    **Fit:** high (seeds are already deterministic; encode in the share URL).
    **Effort:** S–M.

20. **Spectate / replay a famous clear.** Save + replay a notable run's series
    (the sim is deterministic from `{seed, rngState}`). **Fit:** high (determinism
    already guarantees byte-identical replay). **Effort:** M.

---

## Suggested first picks (my read)

If the goal is *maximum lifespan per unit of effort*, in order:

1. **Community Challenge Builder + sharing (A2)** — UGC is the only content source
   that scales without you authoring forever, and the data model already supports it.
2. **Weekly Featured Challenge (A1)** + **Seasons (A4)** — turn the new systems
   into a *recurring reason to come back*, cheaply.
3. **Survival/Gauntlet (B6)** — a fresh, leaderboard-native mode for near-zero
   engine risk.
4. **Player traits (C11)** — the one that deepens the *core draft* itself, which
   every other mode inherits.

Everything else is a strong à-la-carte backlog. None of it requires changing the
engine's determinism contract or the store boundary — they're all additive.
