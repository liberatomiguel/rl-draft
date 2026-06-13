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

3b. ~~Slot-target picking (v0.2): select the card, then click the
   destination slot.~~ **Replaced in v0.5.1 by direction**: ONE click drafts
   the card into the first open compatible slot. Player slots are
   functionally identical (positions are cosmetic), so the second click was
   pure friction.

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

10. ~~Special card appearance is per-offer (7%) on each player card that
    has a special version.~~ **Reworked in v0.5** — see decision #23:
    specials belong to the player and roll at 16% with rarity weighting.

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

18. **No resume system.** Returning to the menu resets the run. Refreshing
    the page mid-run still restores it — that protects against accidents,
    not intentional exits. *(v0.5: the exit is now guarded by ONE
    confirmation modal — live playtesters lost drafts to stray Home clicks.
    The no-resume rule itself is unchanged.)*

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

## v0.5 additions (first live-playtest round)

22. **Vacant coach/sub picks removed** (reverts the v0.3 punt). Players felt
    forced into dead picks; instead, blocked offers free-reroll and the draw
    softly favors staffed lineups when only those slots remain
    (`DRAFT.staffScarcityBoost`). Vacant cards still render — stamped, never
    pickable — so the lineup reads historically honest.

23. **Specials belong to the PERSON, not one base card.** Any Kronovi card
    can roll any Kronovi special (the old per-base-card link made specials
    nearly unfindable). Which one appears is rarity-weighted
    (`SPECIALS.rarityWeights`) so legendaries stay chase pulls. A special
    carries its own historical moment: org/season display AND chemistry use
    the special's base lineup, not the card it replaced — the card *becomes*
    that moment.

24. **Superteam compression** (`TEAM_RATING.superteamPivot/Slope`): team
    rating above 94 counts at 0.55×, both sides. Without it the historical
    super-rosters (~102 raw) made titles near-impossible (measured 0% on
    Hard, <9% on Normal with a good draft). Compression preserves ordering;
    it only narrows gaps at the very top. Applied before the difficulty
    shift so the knob stays independent.

25. **Org identity unification + region splits** in the generator: era
    spellings/sponsor names map to one org (Dignitas, Vitality, Chiefs,
    Mock-It, Pioneers/QuikTrip) so org chemistry connects across eras, while
    same-name-different-org cases (Pioneers OCE/SSA, FUT NA/SSA) split per
    region. Lineups keep their era display name.

26. **Playback is user-centric**: the Match Center never shows AI series
    uninvited; standings step per ROUND; future opponents stay hidden until
    the current round is fully revealed (Swiss pairs by record — an early
    pairing reveal is a result spoiler). Pacing favors readability over
    speed; 2×/4×/skip remain for the impatient.

## v0.5.1 additions (hotfix round, by direction)

27. **Hidden runs show org logos but mask special identities.** Blackout
    hides *ratings knowledge* (overalls, buffs, rarity), not *history* —
    you're supposed to recognize teams. Specials flip the other way: the
    frame/holo/effect say "a special is live", but the photo, title, type
    and moment stay secret until results, otherwise a recognizable photo
    gives away the card's strength on the mode about knowledge.

28. **Special sightings are rare again (6%)**: with the per-player pool the
    16% rate surfaced several per run. Specials are the chase, not the
    routine — collection pace comes from playing more runs, not more drops
    per run.

29. **Era logos are data, not filenames-only**: `org.logoEras` (generated
    from a curated map) + season `order` resolve which asset a card wears,
    with graceful fallback to the default logo. Drop-in stays the workflow:
    `public/orgs/<orgId>@<era>.png`. Curate eras only when an org's rebrand
    is era-defining (NRG first); wrong-era logos are a polish bug, not a
    data error.

## Open questions for review

- UI language final call (EN now; PT-BR translation is one file).
- Should opponents be allowed to field people you drafted (decision #9)?
- Hidden runs currently hide opponent team ratings too (full blackout).
  Alternative: show opponent ratings, hide only yours.
- Grand final bracket reset (LB team must win twice)? Currently single GF.
- "Best player" of the run is currently overall + small variance — a deeper
  per-game impact model is possible if it matters.
- Liquipedia-fetched art is a bootstrap: a curation pass over
  `data-sources/asset-overrides.json` will be needed for misses and
  same-name org collisions (e.g. FUT Esports NA logo).
