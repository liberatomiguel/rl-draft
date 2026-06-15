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
    not intentional exits. *(v0.5: the exit was guarded by ONE confirmation
    modal. **v0.6.0 removed the modal by direction** — see decision #30. The
    no-resume rule itself is unchanged.)*

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

## v0.6.0 additions (Main Stage — last polish before 1.0)

30. **Leaving the run resets it silently; the confirmation modal is gone**
    (supersedes the v0.5 leave-guard, by direction). Navigating off `/play`
    to any page clears the run (owned by `AppShell`, which clears whenever the
    route isn't `/play`); a refresh on `/play` still resumes. A dedicated
    **"Reset run"** button sits next to the difficulty tag for deliberate
    restarts — kept behind ONE confirmation because a mis-tap mid-tournament
    that wipes a draft is worse than one extra tap (the removed modal was the
    *every-exit* friction, not this intentional action). The no-resume rule
    (#18) is unchanged.

31. **Eliminator reveal is experimental and flag-gated**
    (`FEATURES.showEliminatorTeam`). On a LOST run, a subdued strip at the
    bottom of results shows the historical lineup that knocked the user out:
    the opponent of the user's LAST lost series (chronological), so a Swiss
    exit shows the 3rd-loss team and a bracket exit shows the knockout. Kept
    low-key on purpose (small base cards, muted panel) so it informs without
    competing with the placement hero. **Easy to revert**: set the flag false
    → `results.eliminatedBy` stays null → the UI block renders nothing.
    Flagged for review — may not survive to 1.0.

32. **Special-rarity color identity** (by direction): legendary → white & gold
    (Ultimate Team "Legend" language), mythic → red, epic → purple/pink,
    rare → dark purple. A glanceable tier identity on the frame, halo and
    title accent. Rare moved off indigo onto deep purple so it reads distinctly
    from the *blue* base-card (90+) frame.

33. **Hidden-run specials wear the drawn lineup's crest** (overrides part of
    #27, by direction). The masked "?" looked broken beside the other cards;
    a masked special now shows the OFFER lineup's logo — the same crest as its
    offer-mates — instead of a bare "?". Crucially it shows the *lineup's* org,
    NOT the special's own moment org, so the card stays consistent with the
    offer AND the special's identity (title/type/overall/moment) stays secret
    until the results reveal. Non-hidden modes are unchanged (real photo).

34. **Special unlocks grant XP by rarity** (rare 10 · epic 20 · mythic 40 ·
    legendary 75, `XP.specialUnlock`). Added AFTER the difficulty multiplier
    like achievement XP — it's a collection reward, not run performance — and
    shown as its own line in the breakdown. Kept small by direction: the chase
    is the card itself, the XP is a nod.

35. **Card kinds are color-tagged**; drafted cards on the field show their
    rarity border. Each card wears a small role pill (player blue · coach
    amber · sub emerald · org region-colored) so kinds read at a glance, and
    the org card's region uses the same accent as the draft-draw region badge.
    On the "Your Team" field, drafted cards now carry their rarity border
    (special → rarity color + glow; base → gold/silver/blue) — but only when
    overalls are visible, since rarity is hidden information on blackout runs.

## v0.6.1 adjustments (tuning round, by direction)

36. **Reset run restarts in place** (amends #30). The in-run Reset button now
    starts a FRESH draft on the same mode/difficulty/visibility
    (`runStore.restartRun`) rather than dropping to the setup screen — the
    player wanted a fast re-roll of the same run, not a reconfigure.

37. **Special-rarity palette, take 2** (amends #32). Rare returns to its
    original bluish dark-purple (indigo); epic becomes orange/amber (the
    purple/pink read poorly and sat too close to rare); mythic stays red;
    legendary is pushed further from gold base cards — a near-white
    platinum-gold border with a traveling shimmer + the brightest halo, the
    single most special card in the game. Per-tier EFFECTS (holo/sheen/halo)
    now ramp rare → legendary so rarity reads from across the screen.

38. **Field special FX show on hidden runs too** (amends #35). A special's
    PRESENCE is public information (the card frame already announces it), so a
    special drafted onto the pitch shows its living rarity glow even on Hard —
    only base-card rarity (gold/silver/blue) stays hidden when overalls are.
    The field treatment is a glow effect, not just a border.

39. **Collection is one grid** (amends the v0.6.0 rarity sections). Unlocked
    cards lead (rarity → overall), then locked cards in the same order — a
    single album reads better than four stacked sections.

40. **First Hard win gets a Legacy-unlock celebration.** Unlocking a whole new
    mode is a milestone; it now gets a full-screen prismatic moment alongside
    the card-unlock and rank-up ceremonies. All three (and the eliminator
    reveal) dismiss on a tap anywhere on the overlay.

## v1.1.0 additions (Overtime — post-launch follow-up)

41. **Privacy Policy + Changelog are now translated (amends the v1.0 "EN by
    design" scope).** v1.0 deliberately kept long-form prose EN-only. v1.1
    reverses that for these two pages: the prose lives in `PRIVACY` /
    `CHANGELOG_PAGE` copy groups and follows the EN/PT switch. SEO is preserved
    by keeping each route a server component that exports `metadata` and renders
    a `"use client"` `…View`. Version numbers, codenames and dates stay
    language-agnostic; only prose + labels translate. Other historical CONTENT
    (card flavor, achievements, player/org names) remains EN by design.

42. **`specialCards.json` is hand-maintained, decoupled from the generator.**
    Miguel curates the special cards directly in the JSON (now 83). The generator
    (`scripts/build-dataset.mjs`) no longer writes the file — it only reads it to
    re-validate `baseCardId` refs and to regenerate the photo README — so
    `npm run build:data` can no longer clobber the hand-edits. This makes
    `specialCards.json` the second hand-maintained data file (alongside
    `achievements.json`); the legacy `SPECIALS` catalogue is kept as reference
    only. Rationale: the catalogue and the live file had drifted (regenerating
    would have reverted 83 → ~54 cards), and editing the JSON directly matches
    how Miguel actually works.

43. **In-game analytics are aggregate, scalar and non-PII**, emitted only from
    the store layer (never `engine/`, never React render). Events: `run_started`,
    `tournament_started`, `run_completed`. The privacy policy was updated to note
    analytics also covers "how the game performs" so it stays truthful. Difficulty
    / mode / placement / win counters cannot fingerprint a player.

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
