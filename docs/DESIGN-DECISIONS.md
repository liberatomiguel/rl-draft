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

## v1.1.1 additions (post-launch follow-up)

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

## v1.2.0 additions (Regional Champions)

44. **Region lock is a draft-POOL axis, orthogonal to difficulty/mode.** Rather
    than a new `RunMode`, a region lock is an optional choice on the existing
    setup screen that just narrows the lineup pool; difficulty, Classic/Quick,
    Swiss + playoffs and chemistry are all unchanged. Implemented by computing
    `poolLineupIds` from the region and reusing the SAME mechanism daily
    challenges already use — so the engine needed no new mode. `Worldwide` (no
    lock) is the explicit default and is the unchanged Worlds experience.

45. **Worlds vs regional teams are separated by a `samOnly` tag + a
    `draftableLineups` default, not by deleting/duplicating data.** The general
    draft, opponents and daily all draw from `draftableLineups` (= `!samOnly`);
    the region-locked mode draws from the full per-region set (`region === X`,
    which includes both Worlds finalists and `samOnly` Top-8 teams). This keeps
    ONE dataset, makes "general = Worlds only" a single safe default, and means
    adding a region later is data-only. Net: nothing changed for today's modes.

46. **SAM Top-8 merged as a labeled trailing section in `teams.md`, not spliced
    per-season.** The generator reads a team's SEASON from its own team line and
    its REGION from the nearest `### REGION` heading, so a self-contained
    "Regional Top-8 (sam-only)" block at the end is parsed correctly AND keeps the
    curated 208-team Worlds file untouched/low-risk — which mirrors the
    conceptual Worlds-vs-regional split. Done via a one-shot UTF-8 Node merge to
    avoid PowerShell mojibake on accented orgs (Leviatán/KRÜ).

47. **"Creator" rarity + the Wings easter egg.** A new `creator` special rarity
    (pink/violet) sits beside the four earned tiers; there is exactly ONE creator
    card ("Rocket Draft Creator", `liberatorl`). Uniqueness is intrinsic (a single
    catalogue entry), so no per-account dedup was added. Mechanism (revised after
    playtest, v1.2.0): the Wings lineup is EXCLUDED from the normal draw and the
    opponent pool, then **force-injected** into one offer at `DRAFT.easterEggChance`
    (~1%/offer, region-locked SAM only); when it appears the Creator card is
    GUARANTEED on LiberatoRL's card — so finding the lineup is the only gate. The
    first cut (a low draw-weight × the 5% special roll) compounded to effectively
    unfindable, which is why it moved to an explicit force-inject + guarantee. Its
    team-wide `+2 all` is a player-card
    `team_attribute_boost` (the engine was extended to honor team boosts from
    player specials, previously coach-only). Obtaining it grants a **secret**
    achievement (new `AchievementDef.secret`, masked in the grid until earned) —
    so the card and the achievement reveal each other only through play.

48. **Celebratory overlays: full-screen via portal, advance-only-on-input.** All
    three (unlock ceremony, rank-up, Legacy unlock) now share `CeremonyPortal`,
    which portals onto `<body>` (the results screen's `rise-in` transform was
    re-anchoring inline `position:fixed`, per the AGENTS.md pitfall). Auto-dismiss
    timers were removed by direction — a celebration should never vanish before
    the player has looked at it.

## v1.2.1 additions (launch polish)

49. **Reaching MAX chemistry is a threshold remap, not a reward buff.** The
    player asked to make Perfect chemistry actually attainable. The safe lever is
    the TIER thresholds (Perfect 80→72, etc.), NOT `chemistryMaxBonus` or the pair
    weights: the chemistry rating bonus is percent-based, so lowering tier labels
    changes ZERO rating math — the overall-dominant anchors and full-tournament
    outcome tests can't regress — and it doesn't touch the AI (already ~100%
    chemistry, so already getting full bonus). A 3-player country stack (9 raw =
    75%) now reads Perfect, which is the intended "commit to a theme and it pays
    off" payoff. (Matches the project memory: reward chemistry via reachable
    player scoring, never via the field-wide bonus.)

50. **A featured Daily is an authored OVERRIDE, and a Daily owns its own overall
    visibility.** Rather than reshuffle the template wheel, specific dates get a
    hand-written `DailyConfig` via `AUTHORED_DAILIES` (deterministic, so "same run
    for everyone" holds). To let the featured day run a STRONGER field while still
    SHOWING the special cards, daily visibility was decoupled from the difficulty's
    hidden-lock — `config.hiddenOverall` is now the single source of truth in
    `startDailyRun` (a Hard daily no longer force-hides). This also corrects the
    pre-existing "Champions Only" template, which always intended visible overalls.
    The featured draft is HAND-SCRIPTED (`scriptedLineups`: an exact lineup per
    pick, each optionally forcing a specific special), not just "2 guaranteed".
    This buys full curation — balanced teams, distinct orgs, a single Dignitas,
    al0t's special on pick 2 and violentpanda's legend on pick 5 — deterministic
    and the same for everyone. The forced special shows REGARDLESS of slot state
    (the legend is a showcase even when not pickable); since specials are player
    cards, a player who fills all three player slots early can't draft the pick-5
    legend, so a deliberately weaker team carrying the coach/sub sits right before
    it to nudge leaving a slot open. A scripted offer that can't fill the remaining
    slots falls back to a normal staff-aware draw so the run always completes.

51. **Achievement colour = variety within a tier, with Legend the fixed apex.**
    The wall read monochrome (all Rare blue, all Epic violet). Each non-Legend
    tier now carries a SPREAD of distinct hues (still trending cool→vivid by
    rarity so the tier stays legible), assigned by the existing stable per-id
    `hueIndex`. Legend keeps a SINGLE prismatic identity by direction — the apex
    should look uniform and premium, so colour variety stops below it.

52. **The mobile in-card logo is the single shrink point for card-fit.** The
    v1.2.0 logo enlargement (`lg` 64→72px) is great on desktop but overflowed the
    nameplate on narrow mobile cards — the same root cause behind BOTH the draft
    and the team-reveal "cut info" reports. Fixed once, in `GameCard`, with a
    mobile-only responsive logo (40/56/72 by breakpoint) plus a one-step trim of
    mobile padding and the overall number; desktop is byte-identical. The
    team-reveal staff cards were additionally widened on mobile (they're the
    narrowest at `w-24`) so their badges clear the frame.

53. **Legacy relevance is a `historicalStrength` floor, not an overall buff.**
    A community overall review marked 20 SAM regional rosters "Legacy" — they
    should headline the SAM legacy gauntlet, but their reviewed overalls (avg
    78–84) leave them at solid/underdog, which the legacy opponent sampler
    (`opponentTierWeights`: elite 2.6 · strong 1.2 · solid 0.15 · underdog 0.1)
    all but filters out. `historicalStrength` is the *only* lever for legacy
    presence and it never touches the draft pool or the rating math, so a new
    `legacy` flag in `teams.md` floors flagged lineups at **"strong"** (elite
    kept if naturally derived). Chosen **"strong" over "elite"** so they sit level
    with FURIA — the genuine SAM Worlds qualifier — rather than outranking it;
    chosen **flag over inflating overalls** so the GAME-DESIGN §25 "overall stays
    dominant" anchors and the card ratings stay intact. All 20 are `samOnly`, so
    the effect is contained to region-locked SAM runs (their share of a SAM
    legacy field goes ~21% → ~74%); it also mildly lifts them in SAM hard/normal,
    which is acceptable since they are the region's historic best.

54. **Chemistry is the player's edge — opponents lose their chemistry bonus on
    Hard/Legacy.** Players reported that even a very good team got eliminated in
    the Hard/Legacy Swiss. Root cause: every AI lineup is a real roster at ~100%
    chemistry, so the shared `chemistryMaxBonus` handed the *whole field* a
    near-flat bonus a drafted all-star mix (~20% chemistry) could never match —
    on top of the rating shift, a stronger field and more specials. Fix: a
    separate `opponentChemistryMaxBonus`, set to **0** on Hard and Legacy
    (easy/normal keep both caps equal — they weren't the problem). Chosen over
    other knobs because it's the most *targeted* lever (it closes the exact
    player-vs-AI gap rather than nerfing opponents across the board) and the most
    thematic (your chemistry is *your* reward for a coherent draft; the AI's
    strength is raw talent + history). Tuned, not removed: opponents keep the
    rating shift, the elite-weighted field, hidden overalls and specials, so the
    ladder still reads Normal < Hard < Legacy. Simulated impact on a "good" (≈92.5)
    drafted team reaching playoffs — Hard ~65%→~88%, Legacy ~5%→~28% (worldwide);
    the title stays a long shot on Legacy. Anchors in GAME-DESIGN §25 are
    untouched (overall still dominates; user chemistry cap unchanged). A new
    `balance.test.ts` Legacy case pins "hard but not impossible".

## v1.3 readiness (invariants the accounts/sync patch must not break)

55. **Invariants the accounts/sync patch (Supabase + login +
    guest→account migration + daily leaderboard) MUST preserve.** This is a big
    patch touching persistence and identity; the list below is the contract it
    is NOT allowed to violate. Each line is the failure it prevents.
    *(Shipped in v1.4 — login is email + 6-digit code, NOT Discord OAuth as first
    drafted here; all the invariants below were preserved.)*
    1. **Engine purity.** `src/engine` never imports React, storage, network,
       analytics, Supabase or OAuth — it stays pure/deterministic. ALL account,
       auth, sync and remote-fetch code lives in `store`/`lib`/UI only (same rule
       analytics already follows, #43). A Supabase import under `engine/` is a bug.
    2. **Determinism is `{seed, rngState}`.** A run replays identically only from
       its persisted `seed` + RNG cursor (#15). Sync must store BOTH **verbatim**
       — never re-roll, re-seed or "normalize" them server-side — or a synced run
       diverges on replay and the result no longer matches the leaderboard.
    3. **Shared daily seed stays client-derived.** `src/lib/daily.ts` derives the
       daily seed from the date so "same run for everyone" holds (#15, #50); the
       leaderboard only ever compares runs sharing the same date-seed. Don't move
       seed derivation server-side in any way that changes the derived value.
    4. **Store boundary.** `runStore` is the EPHEMERAL in-flight run (no-resume,
       #18/#30); `profileStore` is the DURABLE source of truth and the only thing
       to mirror to the cloud. Don't collapse the two or sync the run store.
    5. **`applyRunResults` is the single funnel.** It is called exactly once, by
       `finishRun`, to apply XP / wins / unlocks / counters / history / daily.
       Sync hooks AFTER it — observe the resulting state, never re-apply results
       on a second path — or counters double-count.
    6. **Persistence keys & versions are contracts.** Keys are
       `rocket-draft:{run,profile,settings}:v1`; schema versions are run **3** and
       profile **11**. The `:v1` is a STORAGE-KEY NAMESPACE, *not* the schema
       version (the version lives in the persist config). Any new persisted field
       needs a profile `version` bump + a `migrate()` that deep-merges defaults
       (the existing migrate already deep-merges `settings`/`flags`).
    7. **Full `ProfileState` is the migration payload.** Guest→account migration
       must carry the WHOLE durable profile, not a subset:
       `xp`, `runsCompleted`, `wins` (per difficulty: easy/normal/hard/legacy),
       lifetime counters (`playoffAppearances`, `podiums`, `swissWinsTotal`),
       `unlockedSpecials`, `achievements`, `runHistory` (capped at
       `HISTORY_LIMIT`), `dailyResults`, `settings` (setup memory:
       `lastDifficulty`/`lastShowOverall`/`lastMode`/`lastRegionLock`) and the
       onboarding `flags` (`seenHowToPlay`/`seenLegacyIntro`/`seenRegionalIntro`).
       Dropping a field silently resets that progress on first sign-in. (See the
       current `ProfileState` in `profileStore.ts` — now also includes `mmr`,
       `legacyUnlocked`, `challengesCompleted`, `records`, `gamesWon`,
       `goalsScored`.)
    8. **`balance.ts` stays the single source of tunables** — any new sync/daily
       cadence numbers go there, never inlined.
    9. **Copy in both `copy.en`/`copy.pt`** — all new auth/leaderboard strings
       are translated, per the v1.1.1 EN/PT contract (#41).
    10. **Data via `src/data/index.ts` with its integrity checks** — leaderboard
        lineup/special refs resolve through the existing data layer, not ad-hoc.
    11. **SSR-safety.** Persisted/account state is read only after `useMounted`,
        so the server render never reads localStorage or a client-only session.
    12. **Process discipline.** Commit per milestone (`vX.Y.Z`), and log the patch
        in `CHANGELOG.md` + record any deviation here in `DESIGN-DECISIONS.md`.

## v1.2.7 additions (info pages, PT translation, technical polish)

56. **Content-page copy lives in server-only `src/content/pages.{en,pt}.json`,
    NOT in the `copy.{en,pt}.ts` runtime dictionary.** This is a deliberate,
    documented deviation from the "every player-facing string goes in copy.ts"
    rule. `copy.ts` is imported by the client `useCopy()` layer, so it ships in
    the client bundle on every page; adding ~3k words of long-form page prose to
    it would bloat all JS. The content pages are server-rendered per locale, so
    their copy is JSON imported only by the server routes — out of the client
    bundle, still fully translated and shape-checked (`ContentPageCopy`). The
    hard rule still governs interactive UI chrome (which DOES go in `copy.ts`).

57. **i18n = toggle translates everything in place + dedicated `/pt/*` SEO URLs
    (NOT full app-wide locale routing).** Chosen over full `[locale]` routing,
    which would need middleware + URL/toggle sync + hydration reconciliation —
    real usability/regression risk on launch day, overlapping accounts/sync (#55).
    How it works (Paradigm A):
    - The EN/PT header toggle (`settingsStore.lang`) is the single source of truth
      and now translates the content pages + the home SEO block **in place**, just
      like the game UI — `LocaleContent` is mounted-gated to the URL's canonical
      locale, so SSR ships EN HTML at bare paths (crawlable) and PT HTML at `/pt/*`,
      while the toggle swaps either for the player. (Initial cut shipped the
      content pages as server-EN-only — they didn't follow the toggle; fixed after
      launch-day review.)
    - `/pt/*` URLs render PT in SSR (crawlable PT + hreflang) AND run `SyncLocale`
      to set the session to PT, so a visitor landing from search gets the whole
      UI — header, footer, game — in Portuguese. Bare/EN paths do NOT force EN
      (they respect a returning player's saved preference).
    - Home SEO links are locale-aware (`localePath`): a PT player's links point at
      the `/pt` URLs. The route map lives in `pageRoutes.ts` (no JSON imports) so
      the home bundle never pulls in content-page copy.
    - Content-page copy is JSON imported per-route (`pages.{en,pt}.json`), not in
      the global `useCopy` dict (#56), so prose doesn't bloat every page's JS.
    Full `/en` + `/pt` routing for the *whole* site (incl. the game) was offered
    and declined for now — marginal SEO upside on interactive pages, big refactor.

58. **Canonical host stays the bare apex `https://rocketdraft.app`.** Chosen
    because the whole codebase already declared it (metadataBase, sitemap, robots,
    OG, JSON-LD). Enforced by a host-conditioned 308 `www`→apex redirect in
    `next.config.ts` + (ops) setting apex as the Vercel primary domain so `www`/
    `http` 301 there too. Reverting to `www` would mean rewriting every derived
    signal for no gain.

59. **`/special-cards` is a curated, public, no-spoiler showcase — the in-game
    `???` locked-collection mystery is preserved.** The SEO audit suggested
    exposing locked cards publicly for indexable content; that would attack the
    collection's discovery mechanic. Instead the public page celebrates a curated
    set of legends using only card flavor/history that is already public RLCS
    fact, fully decoupled from a player's unlock progress (which stays in the
    logged-in collection). SEO benefit without spoiling gameplay.

60. **Deferred (not a regression): the home's full mobile-LCP fix.** The biggest
    mobile-LCP lever is stopping the home from importing the ~434 KB `@/data`
    barrel via `@/lib/daily` + `runStore`. That touches the **deterministic daily**
    (#15) and must be done carefully with `npm test`, so it is left as a focused
    follow-up rather than rushed in alongside the SEO pass. The safe wins were
    taken now: `counts.ts` (kills the direct barrel import for two integers) and
    dropping `fetchPriority="high"` on the decorative rank emblem.

## v1.3 (rewards, chemistry, legacy rebalance)

61. **Legacy is a chase, not a wall — winnable only by a great, chemistry-built
    draft.** Live feedback: a 2-hour stream produced zero Legacy titles even with
    good teams. Root analysis: the field was all-elite (`opponentTierWeights.elite`
    2.6) AND every org could repeat (#62), so every match read as a top-5 superteam.
    Fix is structural + tuning: org-unique fields, `opponentRatingShift` 1.2→0.6,
    elite weight 2.6→1.8 (a *mixed* iconic gauntlet), user `chemistryMaxBonus`
    2.6→2.9. Measured target: a ~95.5 chemistry draft wins ~8%; a 92.5 "good" team
    ~0%. Legacy stays strictly harder than Hard. The `balance.test.ts` Legacy band
    was deliberately rebased (playoffs is now reachable; the *title* is the gate)
    and a reachability assertion added — a future regression that re-walls Legacy
    fails the suite.

62. **One lineup per org in a tournament field.** A bracket is a set of distinct
    teams; facing "FURIA 24" and "FURIA 25" in one Swiss broke the fiction and
    stacked the strongest orgs against the player. `generateOpponents` now draws
    org-unique, with a fallback that only repeats an org when a small regional pool
    (e.g. SAM) genuinely can't fill the field otherwise. Applies to every
    difficulty. Does not touch the draft pool.

63. **Chemistry reachability via new SOURCES, not a higher field-wide cap.**
    Perfect chemistry was "near-impossible", and region-locked play (everyone same
    region/often same country) needed a sensible floor. Added a **same-region pair**
    link (weakest pairwise tier, below same-org — lifts a mixed-nationality roster
    out of Poor) and **coach/sub nationality** links (same country, region at half).
    Safe by construction: AI historical lineups already saturate `maxRaw` (≈100%),
    so new sources do NOT inflate the field — they only help the PLAYER reach the
    cap. Honours the project memory (reward chemistry via reachable scoring, never
    the field-wide bonus) and extends #49. On Hard/Legacy the user cap also rose
    (2.1→2.3 / 2.6→2.9), which is a pure player buff there since the AI cap is 0.

64. **Progression unlocks CONTENT — rank-gated rewards.** The rank ladder did
    nothing in practice. Now (`RANK_REWARDS`): special-card rarities unlock by rank
    (Unranked none → Diamond legendary), appearance chance ramps at the top
    (Champion 8 / GC 12 / SSL 16%), the Collection is locked until Bronze, and Hard
    unlocks at Silver. Implemented by folding the rank chance into the existing
    `specialChanceMult` and adding a rarity filter to `rollSpecial`, so the draft
    engine stays mostly unchanged and the **daily is exempt** (no rank gate — its
    scripted specials and RNG sequence are untouched). Bronze lowered 400→300 so a
    single run clears Unranked. Back-compat: anyone who already won Hard/Legacy
    keeps Hard access regardless of XP. Bronze–Diamond keep the familiar 5% chance,
    so the gate is felt as *unlocks*, not a nerf to existing players.

65. **Special cards are never identity-masked by difficulty — only the number and
    rarity hide.** v0.7 over-masked: on hidden-overall runs a special showed only a
    team-logo silhouette. That contradicted GAME-DESIGN §11/§14 ("specials still
    show, with `??` for the overall"). Now a special always shows photo + title +
    org/season + full buff in every mode; only the overall number and the rarity
    label hide on no-overall runs. Collection-locking (uncollected → `???`/`??`)
    stays orthogonal to difficulty — that's the unlock reward, not the hidden-run
    mask.

66. **Draft anti-frustration tilt is a global, difficulty-independent soft weight —
    and never touches the daily.** A long session of all-no-hope drafts is
    frustrating; `DRAFT.tierBias` (0.35) softly favors historically stronger
    lineups (elite ~1.35×, underdog ~0.9×) without removing weak teams. It does NOT
    read difficulty (the hard rule "difficulty never shapes the draft pool" holds —
    this is a flat feel tweak) and is mode-gated OFF for the daily so the
    globally-shared seed stays byte-identical (`weightedPick` with a ×1 weight is
    provably identical to the prior `pick`).

## v1.3.1 (live-feedback pass)

67. **Difficulty is tuned to felt team-strength targets, not abstract bands.** Live
    play set the goalposts: ~90 "good", ~92 "elite", ~95 "dream". Normal — a good
    team can win, an elite has strong odds. Hard — 90 can't win, 92 ~10%, 95
    comfortably. Legacy — 95 ~10%, 92 very rarely, 90 never. Achieved by retuning
    `opponentRatingShift` + `opponentTierWeights` per difficulty (measured with a
    fixed-team harness across totals). The Bo7 gauntlet is inherently steep — a
    3-overall gap is the difference between "almost never" and "~10%" — so Legacy's
    elite-team rate lands below the loose "2%" wish; that's accepted. Hard's true
    difficulty is drafting with overalls hidden, which a fixed-team test can't model.

68. **Region-locked play is normalised, not left easy.** A regional pool (SAM) tops
    out ~5 overall below worldwide, so the same difficulty was trivially easy. A
    flat `REGION_LOCK.opponentRatingBoost` (+3) is added to every region-locked
    opponent so the regional curve mirrors worldwide with adapted overalls: a
    SAM-best (~90) draft faces ~the same odds a worldwide dream (~95) does. Threaded
    via `buildLineupTeam(extraShift)` ← `generateOpponents` ← `initTournament`
    options ← the run's `regionLock`. A single flat boost is slightly harsher than
    worldwide on Normal/Hard and on-target on Legacy — acceptable for a focused
    regional challenge; one tunable.

69. **Perfect chemistry demands real org/lineup overlap; the bar must be FULL.**
    Reworking #49: Perfect now means a 100% bar (`raw ≥ maxRaw`, maxRaw 12→15), and
    shared-org (3) outranks same-country (2), so a country-only or country+staff
    stack caps at Good — Perfect needs same-org or same-lineup player pairs.
    Same-kind pairs MERGE into one readout line (a Brazil core is one "+6", not
    three "+2"s), and coach/sub state a named reason, not a vague "connection".
    Still safe vs the overall-dominant anchors (AI lineups still saturate; the
    rating reward stays percent-based).

70. **A drafted special wears the DRAFTED org on YOUR field — only the Collection
    shows its moment.** Amends #23: the moment still drives chemistry and the card
    art/title, but the on-field crest/season follow the lineup you drafted from (a
    yanxnz FURIA special pulled from a Rebel offer reads as a Rebel pickup). The
    Collection is unaffected because it resolves a special via its OWN base card id,
    so it still shows the historical moment. Implemented in `resolvePlayerCard` /
    `resolveCoach` (display uses the passed card, not the special's base).

## v1.3.2 (second live-feedback pass)

71. **The bottleneck is BUILDING a strong team, not the strong team's win rate.**
    Live insight: a dream team's ~10% Legacy win is fine, but dreams are rare to
    assemble, so run-level odds felt impossible. Two compounding fixes: (a) win
    rates raised (shifts Normal -1.3 / Hard -0.5 / Legacy -0.3), and (b) chemistry
    made easier to max so more drafts reach high totals. Both lift P(win a run)
    without making any single matchup trivial.

72. **Hard is NOT rank-gated.** The v1.3 Silver gate on Hard broke the flow in
    playtest (you want the real challenge available immediately). `RANK_REWARDS`
    keeps the `hardMode` field for structure but it is always true; only the
    Collection and special-card rarities remain rank-gated.

73. **Region-lock favours winnability over strict parity.** A regional (SAM) field
    tops out far below worldwide and its opponent range is compressed, so NO flat
    boost gives a strong SAM team worldwide-parity (~15% Legacy) without making a
    typical one unwinnable — measured: a SAM-95 wins 84-96% across boosts 0-2. So
    the boost (now +2, was +3) targets the TYPICAL team (a ~90 wins Legacy ~18%,
    not ~40%) and accepts that strong SAM drafts win comfortably. SAM is the more
    accessible, region-pride mode by design.

74. ~~Superseded by #87 (chemistry is now additive).~~
    **Chemistry: 3 same-country = Great, +1 org connection = Perfect** (refines
    #69). Country alone still can't reach Perfect (Great is its cap), but the
    threshold from there is a single real org link (org-loyalty, or a coach/sub who
    shares the org). Same-country STAFF is a deliberately soft bonus
    (`staffCountryBonus` 0.5) that can't complete a country stack on its own —
    only a real org connection does. maxRaw 11.

## v1.3.3 (Legacy difficulty retune)

75. **Legacy is the all-time wall again — only a worldwide-elite (~97) draft wins,
    and SAM mirrors that curve (per-difficulty region boost).** Supersedes the
    Legacy half of #71 and the Legacy part of #73. Live feedback: Legacy had become
    too easy (an overall-97 draft won ~53%). Re-tuned on **real-team sims** (teams
    built from actual cards, so situational stats — not just overall — match the
    game): `legacy.opponentRatingShift` 0 → 2.3 puts an overall-97 worldwide draft
    at ~15%, the best-ever 99 at ~46%, a 95 at low single digits, a 92 ≈ 0.
    For SAM, `REGION_LOCK.opponentRatingBoost` became per-difficulty (was one flat
    +2): **legacy 2 → 2.3**. **Anchor choice (by direction, revised after playtest):**
    the first v1.3.3 draft anchored the theoretical SAM ceiling (~95) at 15%, but
    live SAM play showed real drafts land in the 80s — the pool is weak and random,
    so overall 92 is already a rare-good result and 95+ is essentially never built.
    Anchoring at 95 made the title near-impossible in practice. So we **anchor the
    best REALISTICALLY-ACHIEVABLE SAM team (overall ~92) at ~15%** instead. The
    engine's effective SAM opponent shift = `legacy.opponentRatingShift` (2.3) + this
    boost = **+4.6**; real-team sims then give a typical ~90 team ~2%, a 92 ~15% (the
    anchor), and the rare 95/97 unicorns a lot (once-in-a-lifetime SAM drafts —
    acceptable since they almost never occur). The weak SAM pool + larger shift nets
    to a field ~90-94, below the worldwide ~97 field — matching the lower SAM
    achievable ceiling, and mirroring worldwide where the best achievable ~97 also
    wins ~15%. easy/normal/hard keep +2 — Hard SAM stays easy at the top this pass.
    **v1.3.4 ease (by direction):** the worldwide ELITE end was a touch too punishing
    (a 97 dream won only ~15%), so `opponentRatingShift` dropped 2.3 → 1.65 — a 97 now
    wins ~25%, the all-time 99 ~60%, base unchanged. To keep SAM exactly where it was
    tuned, the SAM boost rose 2.3 → 2.95 (effective SAM shift pinned at +4.6). One knob
    moves the whole worldwide curve, so 97→30% would drag the 99 to ~65% and lift the
    base; ~25% is the agreed sweet spot between "a real elite shot" and "still brutal".

76. **The draft anti-frustration tilt weights by roster OVERALL, not historical
    strength.** The v1.3 tilt softly favoured "historically stronger" lineups
    via `historicalStrength`. That tier tracks roster overall worldwide (elite teams
    ARE high-overall: elite 93.2 / strong 88.5 / solid 84.3 / underdog 77.5) but is
    miscalibrated in the compressed SAM pool — there "strong" teams averaged LOWER
    overall (81.9) than "solid" ones (83.9) and there is no elite tier, so the tilt
    barely moved SAM offers (good-team ≥84 share 15.5% uniform → 16.3% tilted) and
    sometimes favoured the worse team. Fix: weight by the lineup's roster overall,
    normalised within the draw pool, so it self-adapts to any pool. Worldwide is
    preserved (mean offered overall +0.64 → +0.60, near-identical). Region-locked
    pools (SAM) use a firmer `regionTierBias` (0.6 vs 0.35) because that pool is
    bottom-heavy and needs more push: SAM good-team share 15.5% → ~19%, weak (≤78)
    36.6% → ~27%. Never filters the pool (weak rosters still appear); daily stays
    byte-identical (tilt off there).

77. ~~Superseded by #87 (chemistry is now additive).~~
    **Chemistry rewards SHARED CAREER history, not just the drafted card.** Two
    players who once shared a lineup (ex-teammates) or an org link even when their
    drafted cards are from different teams — built from each player's full career
    set (all their cards' orgs/lineups). Placed in the strongest-wins ladder:
    drafted lineup (4) > drafted org (3) > **career lineup (3)** > country (3) >
    **career org (2)** > region (1.5). Deliberately NOT additive — a same-country
    stack still tops out at Great (#74 invariant preserved), because career links
    don't stack on the country link; they replace the weak region/no-link for MIXED
    rosters of veterans who crossed paths. AI is unaffected (single real rosters
    already link by drafted lineup).

78. **The sub is squad DEPTH that scales with quality, and can be special.** The
    sub was the weakest slot — a flat +1 consistency / +1 experience plus a small
    overall bump. Now the depth bonus scales with the sub's overall (a strong or
    special sub is a real bench; a token one barely registers), giving the slot a
    reason to draft well. Subs can also roll specials now (specials belong to the
    person, so e.g. a Turbopolsa sub can appear as one of his Worlds-MVP cards).
    Still bounded so the sub never rivals a starter — it's depth, not a 4th player.

## v1.4 (Legacy ease, MMR, challenges, ops)

79. **Legacy eased toward ~5% total win rate — WW AND SAM, reversing the #75 SAM
    pin.** PostHog showed Legacy's live total win rate at ~2-4%; Miguel wants ~5%
    in both the worldwide and the region-locked (SAM) pools. Calibrated with a
    FAITHFUL blended sim — real drafted teams (`buildUserTeam` over every lineup)
    run through full tournaments — whose baseline reproduced the live ~2.6% WW /
    ~1.9% SAM, so the model is trustworthy. Change: `legacy.opponentRatingShift`
    1.65 → 1.35 (a flat per-opponent shift, added after compression, so it widens
    the gap most at the top where it's thinnest — a 97 dream ~25% → ~29%, a 92 stays
    near zero) and `REGION_LOCK.opponentRatingBoost.legacy` 2.95 → 2.05 so the SAM
    effective shift falls 4.60 → 3.40. **This deliberately reverses #75**, which had
    PINNED SAM at +4.6 so WW eases wouldn't touch it; v1.4's goal is the opposite —
    ease SAM too. The ease is intentionally LIGHT (Miguel's directive — Legacy has
    been retuned many times): in-sim blended only reaches ~3% because the sim
    weights weak historical teams a real drafter would never commit to, so live
    should land higher (~4-5%); the plan is to re-read PostHog after deploy and nudge
    again if short, rather than over-buff the elite now. `balance.test.ts` Legacy
    anchors still hold (good ~0%, strong ~2%, dream ~29% < the 40% ceiling). Hard was
    left untouched — it has its own rate. Levers deliberately NOT moved:
    `seriesFormRange` (global upset engine, guarded by the §25 match anchors) and
    `superteamSlope`/`Pivot` (reshape the whole hierarchy).

80. ~~Superseded by #82 (win-only rework).~~ Original rationale kept for history:
    **MMR — a cosmetic skill rating parallel to XP.** Starts at 200, rises a small
    capped amount per finished run (placement base × per-difficulty multiplier, +1
    region-locked), never spent or lost (cloud merge = MAX). Tuned ~50× slower than
    XP so it reads as skill, not playtime; surfaces on the profile card and as a
    leaderboard category (it replaced the Total-XP board). NOT a gameplay input —
    lives entirely in the profile store + `balance.ts` (`MMR`/`mmrForResult`), engine
    untouched. **No rank/achievement reset for the v1.4 patch** (would frustrate
    veterans): instead, MMR is BACKFILLED for pre-MMR profiles from their title
    history (`mmrBackfillFloor`) so a Supersonic Legend doesn't land on the board at
    200, and the new achievement set's already-satisfied counters are SILENTLY
    pre-marked on migrate (no toast/XP) so the swap doesn't spam veterans.

81. **Challenge mode is rank-gated at Bronze, alongside the Collection.** The whole
    mode (home card + the `/challenges` route) is locked while Unranked, mirroring
    the Collection's Bronze gate — a new player has a clean menu and unlocks both at
    once after their first run or two.

## v1.4 staging-review adjustments (2026-06-21)

82. **MMR reworked to a flat, win-only economy (revises #80).** Playtesting showed the
    placement-curve MMR over-rewarded — a fresh account with mediocre results drifted to
    ~1200 and elites blew past 1500. New rule: MMR moves **only on a title**, by a flat
    table — Easy/Normal championship **+1**, Hard **+3**, Legacy grand finalist **+5**,
    Legacy title **+9**; every other outcome **0** (no placement curve, no per-Swiss-win,
    no difficulty multiplier, no regional bonus). Start stays 1000; gains are linear and
    tiny, so climbing well past 1600 is a deliberate grind. **Retroactive backfill is
    capped at 1600** (`MMR.backfillCap`) via a saturating curve of title history
    (`MMR.backfillScale`, K=120): the best current players land *near* 1600, a title-less
    account stays at start — Miguel's brief ("good players near 1600, above is a grind").
    Daily titles earn MMR (a real tournament); Challenge mode never reaches the MMR path.
    Profile **v10 → v11** HARD-RESETS mmr to the new value (a one-time correction of the
    inflated old values, not a `Math.max` floor). The Legacy grand-finalist (+5) can't be
    reconstructed in backfill from aggregate counts (no per-difficulty runner-up counter)
    — an accepted minor undercount.

83. **Legacy unlock decoupled from Daily/Challenge wins (`legacyUnlocked` latch).** Miguel:
    a Daily/Challenge Hard win should still count as a **title** (achievements, leaderboard,
    MMR) but must NOT open Legacy. Rather than stop counting those wins (which would also
    drop them from titles), a dedicated `legacyUnlocked` boolean is set ONLY by a
    Classic/Quick Hard (or Legacy) championship; `selectLegacyUnlocked` reads it. Migrate
    seeds it `true` for anyone with an existing Hard/Legacy title so no one loses access;
    it's in the durable sync slice (OR-merged) so it propagates across devices.

84. **Challenges: all Bo7, rerolls scale with difficulty, 20 challenges across every rank.**
    Every series is Best-of-7 (schema `bestOf: z.literal(7)`). Rerolls were a flat 8 →
    now `CHALLENGE.rerollsByDifficulty` (easy 8 / normal 5 / hard 3 / legacy 0): the easy
    tiers stay forgiving, the brutal ones make every pick count (0-reroll can't soft-lock —
    a dead offer still grants a free reroll). The set grew 10 → 20, with `rankRequired`
    spread so **every rank Bronze→SSL unlocks new content** (gradual release; `tier`/rarity
    is now visual + difficulty-band only, independent of the rank gate). XP retuned into
    per-rarity bands (Common 80–110 → Legend 440–560): rewarding without trivialising the
    rank climb. Every seed is **sim-validated into a band** by `challenges.test.ts`, which
    now asserts BOTH a floor (legend ≥0.15 / others ≥0.30) and a **ceiling (≤0.85)** so no
    fixed seed is a walkover. The sim is deterministic (fixed seeds), so the bands are
    stable; `sim.opponentShift` is the per-challenge tuning knob.

85. **Rank-image lock messages.** Rank-locks show the unlocking rank's badge (reusing
    `RankBadge`): locked Challenge cards and the Collection's per-rarity locks. (The home
    Collection/Challenges tiles were tried with a Bronze badge but reverted to the original
    padlock glyph — Miguel preferred the lock there.)

86. **Special-card rarity ladder retune + secret Creator from Bronze.** Each rank
    Bronze→Platinum unlocks ONE visible rarity (rare→epic→mythic→**legendary at Platinum**,
    moved down from Diamond so Platinum isn't a dead rank); the per-run appearance chance now
    **ramps from Diamond** (4% Bronze–Platinum → 6/9/12/16% Diamond→SSL), not from Champion.
    The secret **Creator** card (the dev easter egg) is eligible from **Bronze** but never
    advertised (the Collection's rarity grid omits the `creator` tier), and its boost rose
    **+5 → +7** (schema cap raised to 7) so the low-overall (71) card is worth slotting — it
    stays rare and un-buildable-around, so it doesn't move competitive balance. The per-rarity
    ABSOLUTE rates (`SPECIALS.rarityChance`, the v1.4 kronovi fix) are fully honoured at every
    rank — the rank only gates which rarities are eligible and scales all rates by a mult.

87. **Chemistry reworked from STRONGEST-LINK to ADDITIVE (reverses #74/#77's "strongest link
    only").** Miguel: "the player weighs ALL factors when building for chemistry, so all
    factors should count." Per pair, raw = CONNECTION (same lineup > ex-teammates > shared
    org) + HERITAGE (country > region) — two independent axes summed, so a same-country pair
    who also shared an org now scores both (the old model masked the org behind the country —
    the reported "shared-org chemistry sometimes doesn't work"). WITHIN an axis only the
    strongest form counts, because the alternatives describe the SAME relationship (ex-
    teammates already implies a shared lineup/org); stacking them would double-count it and
    explode the bar. Recalibrated `maxRaw` 11→10 + rescaled weights so the invariants HOLD:
    3-same-country = Great (not Perfect), a real connection completes to Perfect, random =
    Poor, mixed-region = Good. **Sim-neutral:** AI lineups still saturate to 100% and
    Hard/Legacy weight AI chemistry at 0, so the field isn't inflated (verified).

88. **Rank-up ceremony fires on a challenge clear.** The full-screen rank-up celebration was
    only wired into the tournament results, so a challenge whose XP reward crossed a rank
    ranked the player up silently. The `ChallengeScreen` now fires the same ceremony, using
    the XP captured the instant before the reward (`ChallengeRunState.xpBefore`) so it's
    robust to re-renders and the one-and-done reward path.

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
