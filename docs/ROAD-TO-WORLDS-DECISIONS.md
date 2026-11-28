# Road to Worlds — design decisions

Decisions log for the **career mode ONLY** (`FEATURES.careerMode`). Kept
separate from the draft game's [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) so
the two modes' rationale never tangles.

- **Spec of record:** [`ROAD-TO-WORLDS-DESIGN.md`](ROAD-TO-WORLDS-DESIGN.md)
  (the v0 design + the v0.1 / v0.2 / v0.3 adjustment-pass headers are the
  authoritative brief — this file records the *why* behind the calls, in the
  DESIGN-DECISIONS numbered style). R19 (release gating) was added on the
  static-relaunch branch.
- **Current state + remaining work:** [`ROAD-TO-WORLDS-STATUS.md`](ROAD-TO-WORLDS-STATUS.md).
- **Per-version narrative:** `CHANGELOG.md` `[1.5.0-alpha]`.
- **North-star note:** GAME-DESIGN §42 doesn't cover a management fantasy;
  the extension recorded for this mode is *"Career: is this making the climb
  from nobody to World Champion more meaningful, more legible, or more alive?"*
  §25 (overall dominant) and §39 (user-facing simplicity) apply unchanged.
- **Copy-rule amendment (from the design pass):** scripted-beat / news-template
  *content* is co-located EN+PT in the data file (`beats.ts`, `news.body.*`),
  not in `copy.*.ts` — the challenges precedent. UI chrome stays in copy.

The base design (v0) and the two earlier LOCKED adjustment passes are
summarized below as R1–R12 (their full prose lives in the design-doc headers);
the v0.3 pass (R13–R18) is written out in full — it's the freshest and its
rationale wasn't previously captured anywhere but the code.

---

## v0 → v0.2 locked decisions (summary; full prose in the design doc)

R1. **Reuse the shipped engine wholesale.** `simulateSeries` resolves every
    match; 16-Swiss→8-double-elim = regionals/Majors/Worlds verbatim; 8-team SE
    = unofficials; `fastForward` = every AI-only event. New career code is pure
    modules in `src/engine/career/`; the shipped `TournamentScreen` is NEVER
    touched (the career builds its own richer playback suite). A golden-master
    suite (`regression.golden.test.ts`) locks the existing modes byte-identical.

R2. **The world is save-side deltas over the dataset, never a mutation of it.**
    The user org is never injected into `orgs.json`; real players/orgs are
    referenced by id and everything derivable (offsets, potential, birth years,
    filler identities) is DERIVED from `(careerSeed, id)`, not stored.
    Determinism via `deriveSeed(careerSeed, streamId)` streams (FNV-1a + fmix32)
    — never one linear cursor; only the user's in-progress event persists an RNG
    cursor. Stream-id grammar is a compatibility surface.

R3. **Squad cap 4 (3 starters + 1 sub); RL-realistic ages** (prospects debut
    13–15, careers generally end ~24–25). **Form/morale CUT** from v1 — the
    ±4.5 per-series roll already IS the form budget; a visible form stat would
    double-count variance (`FEATURES.careerForm` reserved).

R4. **Potential comes from real trajectories** (`max overall across a player's
    real future cards + jitter`), display as a **numeric band only** (scout
    level widens/narrows it, never prints the raw scalar — spoiler-safe by
    construction). Wonderkids are the real ones; user-signed players diverge
    from script forever ("his story is yours now").

R5. **Failure is survivable — once.** Bankruptcy triggers a single Emergency
    Backer rescue per career; a second breach ends it (the Insolvency ending —
    real game over, but never a surprise: every risky confirm warns, the Backer
    chip is a standing reminder). **Difficulty never filters the acquisition
    pool** (locked rule) — it shapes opponents and money pressure only.

R6. **Reputation can rise AND fall** (telegraphed expectations only, never
    silent) and gates the progressive unlock ladder. Progression must make what
    is still lockable **visible** (greyed with its condition) — a core motivator.

R7. **Every match is simulated AND presented individually** (Miguel-locked) —
    never a static results dump. The career's own playback suite
    (`CareerEventScreen` + `CareerMatchCenter`) does goal timelines, scorer
    feeds, game-by-game chips, animating standings/bracket between rounds.

R8. **Roster Stability = Miguel's 2/3 rule, redesigned as a tiered penalty on
    FIELDED new faces** (0-1 free / 2 → −25% / 3 → −60% of Season Points),
    preseason exempt, emergency slots exempt. The original hard forfeit stays
    one flag away (`FEATURES.careerHardStabilityRule`).

R9. **v0.2 DAY CLOCK (FIFA-career style)** supersedes v0's "one clock = weeks".
    The playable unit is the day (`clock = {seasonIndex, day}`, 1..224, Monday-
    start weeks over the same 32-week grid — seed streams stay week-keyed, so
    determinism holds). Real calendar dates per season. Officials block the
    clock until played/simmed; advancing past an unofficial declines it.

R10. **v0.2 economy rescale — the garage-org start.** Budgets 20k/12k/8k;
     salary curve $1.5k @ OVR 70, growth 1.2/pt, floor $250 (entry salaries in
     the hundreds, stars cost fortunes); prizes 2k/10k/40k/150k/600k; sponsors
     1.5k/6k/18k/45k with **perks** (gear discount, free bootcamps). Progression
     IS the product — money pressure must be real in seasons 1–2.

R11. **v0.2 gear & staff ladder** replaces generic facilities: peripherals →
     monitors → PCs → bootcamp T1 → bootcamp T2 → psychologist → Performance
     Center, each rep-gated and bought strictly in order; effects map onto
     existing engine channels (training multiplier + org buff levels), so zero
     new rating math. **Coach market** mixes REAL retired pros (from the world's
     retirement flow, coachOVR = 55 + 0.25×final) with generated candidates.

R12. **v0.2 HQ + Inbox split, event-screen rebuild, procedural crests.** Mail
     (`save.mail`) is the actionable manager channel; the news wire lives on the
     HQ. Every filler org gets a deterministic procedural crest; crestId encodes
     `shape[:symbol[:pattern]]` (legacy ids render unchanged). Save bumped to v2
     with in-place migration.

---

## v0.3 adjustment pass (2026-07-11 — Miguel's second playtest list)

R13. **Salary negotiation ships in v1 — as a bounded counter, not sliders
     (amends the design's §10/§21.4 "no negotiation minigame" recommendation).**
     v0 cut negotiation because a deterministic slider "is a calculator with one
     displayed correct position". Miguel asked for interactivity on sign/renew,
     so v0.3 ships the honest version: every player carries a hidden reserve,
     uniform in [0.88, 1] × ask, drawn deterministically per (player, season,
     window) — **fixed per window, so reloading can't re-roll it**. The UI shows
     the TRUE accept probability (the uniform CDF — no lying meters); each
     rejected counter hardens the reserve +4% (telegraphed) and after 2
     rejections only the full ask signs that window. The decision space is real
     (save 0–12% vs. risk hardening the price), bounded, and save-scum-proof by
     construction. Sliders/counters-round still deferred. `CAREER_NEGOTIATION`,
     `economy.negotiationAccepts`, `SalaryNegotiator`, `careerFlow.resolveSalaryOffer`.

R14. **Visible rep cap on new signings REPLACES the soft salary premium as the
     star gate (resolves §21.3 the other way).** The design recommended "money,
     never a hard refusal"; Miguel's playtest verdict: high-OVR free agents were
     trivially available day 1, hollowing the climb. v0.3 adds
     `signableOverallCap(rep) = 74 + 0.3×rep` (uncapped at rep 84) for NEW
     signings only — renewals and the current squad are ALWAYS exempt, so
     nothing you own is ever taken away. Per R6 ("progression must be visible"),
     locked players stay browsable with the exact rep that opens the door
     ("Signs at N reputation"). The soft rep premium stays on top as the
     price-side pressure. Coach hiring joins the ladder at rep 10 — early, but
     earned. `CAREER_UNLOCKS`, `signPlayerFlow`, Market locked rows.

R15. **One market value to rule every fee.** Fees were computed three different
     ways (user buys: ask × synthetic splits-remaining ×1.4; AI↔AI news fiction:
     same formula at fixed rep 50; AI bids: ×[0.9,1.3] on top) — same-OVR
     players priced up to 6× apart and the news numbers never matched the market
     screen. v0.3 introduces `marketValueFor` (person-neutral salary curve × 3.2,
     no rep/jitter) as the single anchor; buys apply a bounded contract load
     (0.85–1.6×), AI fiction a ±15% band, AI bids ×[1.0,1.35]. **Prizes grow
     ×1.12^season and sponsor tiers ×1.10^season** so income outpaces the
     1.08^season wage inflation — the late game funds itself only by winning, as
     the design's §9 intended. The living market also gained org↔org fee trades
     (needs pass shops lower-rated orgs), a scavenger pass draining displaced
     quality from the FA pool, and daily incoming bids that also hunt prospects.

R16. **The training "stagnation" was a quantization BUG, then a curve problem.**
     Root-cause ordering matters: (a) per-tick gains floored at 2 decimals
     zeroed ANY daily gain below 0.01 OVR — players 21+ or near potential gained
     literal 0 forever (fixed: 4-decimal quantization); (b) h/(h+4) headroom
     collapsed to 1/3 speed 2 points from potential (softK 4 → 2.5); (c)
     committed-event weeks froze training entirely, making weak-field
     unofficials a development TRAP (matchPrepShare 0.5). Only AFTER the
     mechanics were fixed did the rates get touched (weeklyBase 0.10 → 0.13,
     ages 21–24 lifted, caps 6/2.5 → 7/3) — tuning on top of a bug would have
     hidden it. Early rep floor added alongside: a regional swiss exit and
     unofficial finals now pay +1 (an 0-3 season 1 still climbs toward unlocks).

R17. **Backer debt must be escapable by playing well (bugfix + design).**
     Selling a star while in debt paid nothing toward it — the only amortization
     path was the prize garnish, so a rescued org stayed locked out of fee
     transfers/gear for seasons (Miguel: "muito frustrante"). v0.3: player sales
     auto-amortize 50% of the fee (line-itemized), Finances gains a manual
     pay-down (any amount, any time), and clearing the debt lifts the lock
     immediately with a "debt cleared" beat. The lock itself STAYS (anti-
     snowball) — the fix is a fast, legible way OUT, not removing the consequence.

R18. **Autoplay is the primary clock control (day clock, phase 2).** v0.2 made
     the day the unit; v0.3 makes it the RHYTHM: ▶ advances one day per tick
     (850ms), pauses itself at every stop state the batched advance already knew
     (matchday, fresh invite, window Monday, pending decision), and a career
     toast layer narrates what happens en route — the FIFA-career feel Miguel
     asked for. The batched "skip ahead" stays one tap away. Adjacent v0.3 UI
     calls: scrims became schedulable with an opponent shortlist + engine-truth
     benefit preview + per-game result log + a same-day rematch guard; AI org
     rosters are inspectable everywhere (`OrgSheet`); the HQ got a region-
     filterable transfer wire + a window-close report; the crest builder gained
     a classic 22-tone palette (the length 22 is load-bearing —
     `contrastingSecondaryIndex` steps +5, coprime with it) plus badge/banner
     shapes, lion/comet/anchor/trident symbols and sash/quarters patterns. Cost
     of the livelier world: bot seasons ~1.3s → ~3.5s (integration tests carry
     explicit timeouts; `aiWindowMoves` memoizes player views — next lever is a
     global view memo per `world.version`). Save bumped to **v3** (additive
     migrate `migrateSaveToV2` → `migrateSaveToV3`).

## Static relaunch gating (2026-10-03 — `perf/static-cloudflare`)

R19. **`careerMode` is env-driven, `/career` is always noindex, and career copy
     ships only with career.** The static relaunch (DESIGN-DECISIONS #102) is cut
     from `staging`, so the alpha travels with it. It must not go public by
     accident, and it must not cost the draft game anything.
     - **Flag.** `FEATURES.careerMode = NODE_ENV !== "production" ||
       NEXT_PUBLIC_CAREER_MODE === "1"`. Dev and tests always have career on.
       Production builds have it off unless the env var is set **at build time**,
       inline, for a local preview build only — never in `.env*` files or the
       production Worker's build variables (a shareable preview needs a separate
       staging Worker). It is a per-build constant, identical on
       server and client, so there is no hydration mismatch.
     - **Gate.** `src/app/career/layout.tsx` is a server component: `notFound()` when
       the flag is off, and `robots: { index: false, follow: false }` **always**,
       even with the flag on, while the mode is alpha. The client guard and UI live
       in `CareerShell.tsx`. A static export writes every route, so the old
       client-side `useEffect` redirect was not a gate: flag-off builds still shipped
       an indexable `/career` with HTTP 200.
     - **Strip.** `scripts/postexport.mjs` deletes `out/career*` when the flag is
       off. It reads `.env*` the way `next build` does. If the home page links
       `/career` or the sitemap lists it, it fails instead of deleting, because the
       build and the script would disagree.
     - **Copy split.** Career strings live only in `copy.career.{en,pt}.ts`, read
       through `useCareerCopy()` / `getCareerCopy()` (`src/content/careerCopy.ts`).
       `useCopy().CAREER` no longer exists, which cut the core copy chunk on every
       page from 55.2 to 28.6 KB gz. The 4 home-card strings are core copy
       (`HOME.career*`), because the home page renders them.
     - Existing career saves are untouched: with the flag off the store simply isn't
       loaded, and the saves come back when career is enabled.

---

## v2.0 pass — Road to Worlds 2.0, sub-phase A (2026-10-16 — economy & market clarity)

Source: the v2.0 design guide, Part 3 (playtesters went broke in the first
weeks, found finances confusing, could not sign a sub, could not find the
coach tab, and lost every Community Cup for splits). Decisions R20–R25 are
built on `claude/dazzling-cannon-1d6thr`; the rest of Part 3 (hub rebuild, day
calendar animation, training rework, qualifier, inserts, achievements) follows
as sub-phases B+.

R20. **Money moves WEEKLY, contracts stay per split.** Every Monday
     `processDayArrival` runs `economy.weeklyPayroll`: sponsor base in, fanbase
     in, ONE aggregated `payroll` line for the squad, coach, psychologist,
     upkeep, bank instalment out, then the floor/Backer check. A split figure is
     spread ×3/32 per week (`weeklyOf`), quantized to $10, so a season still
     costs exactly 3 × `salaryPerSplit` — the save schema is untouched (no
     migration) and the negotiation curve is unchanged; only the DISPLAY unit
     changed (every wage label is now "/ week" via `wageLabel`/`weeklyWage`).
     The founding Monday (season 0, week 1) is skipped. `weeklyStatement` is the
     ONE breakdown the hub tile, the Finances tiles and the Monday funnel all
     read — they can no longer disagree. The old `splitPayday` is gone; the
     split boundary keeps only the sponsor objective settlement and turnover.
     Ledger cap 100 → 160 so a full split stays visible.

R21. **Bank loan — the planned alternative to the Emergency Backer.** One loan
     at a time, principal capped by reputation tier (`CAREER_BANK.maxByRepTier`
     6k/12k/25k/50k/90k), flat 12% interest, 16 weekly instalments booked by the
     payroll, early pay-down any time, refused while the Backer debt is open.
     Taking one never ends the career; it just adds a weekly line. Finances
     groups both debts under "Loans & debt" (bank request/pay early + Backer
     pay-down, with the Backer's garnish rules spelled out). A "cash warning"
     mail/news fires once when the runway (balance ÷ weekly burn) hits
     `CAREER_PAYROLL.runwayWarnWeeks` (4), so bankruptcy stops being a surprise.

R22. **Coach effects are explicit and better coaches pay more.**
     `coachEffectsFor` (development.ts) spells out the three effects — training
     speed vs. no coach, team-rating add (the existing `TEAM_RATING.coach`
     formula, untouched for the draft game), and the stat buff — and ONE
     component (`CoachEffectLines`) renders them on the market card, the current
     coach panel and the squad slot. `CAREER_TRAINING.coachMult` widened
     0.01/1.2 → 0.015/1.3 (85 OVR ≈ +15%, 92 ≈ +25% over the 0.85 no-coach
     floor). Every "coach" link now opens `/career/market#coaches` (the tab
     reads the hash on mount) — the "button that didn't go to the coaches"
     report. Attribute buffs (+clutch, +offense) and their tie-in to training
     stay for sub-phase C (training rework).

R23. **Community Cups field the LOCAL SCENE, not the region's best.** The t3
     field is the closest orgs by rating with at most
     `t3MaxStrongerTeams` (2) rated above the user; when the region has fewer
     weaker orgs than seats (true for EVERY region at season 0 — all 16 orgs
     out-rate a starter roster), the rest are **local amateur teams**:
     procedural sides (`engine/career/localScene.ts`, refs
     `local:<region>:<season>:<k>`) rated within `localSceneBand` (−7..+1) of
     the user team, with amateur-flavored names and gamertag players, never
     persisted and never in standings. `t3FieldRefsFor` is the single selection
     rule the engine AND the lobby preview use. Early cups become winnable
     without touching regionals (the "don't make it easy, just less
     frustrating" ask).

R24. **Starter rosters overlap in day-one strength.** Shapes rebalanced to
     prospects 65–68 (pot 80–90), journeymen 71–74 (pot cap 76), balanced
     68–71 (pot 76–84) — no option is a dead start; the trade is today vs.
     ceiling. Guarded by a test (average OVR spread ≤ 8 across the three).

R25. **A full starting three defaults the market offer to the sub slot.** The
     offer sheet's role picker now opens on "sub" when three starters are
     signed, and the block reason distinguishes "starters full → signs as sub"
     from "sub slot taken" and "squad full (4)". Root cause of "it won't let me
     sign with a free sub slot": the role state always reset to "starter".

R26. **HQ is a day you can read at a glance (hub rebuild, sub-phase B).**
     Playtesters called the hub confusing and the window "one same day". The
     new layout puts the CLOCK first: a **Day Card** (date, season progress,
     a seven-day strip whose "today" ring glides to the next chip on every
     advance and whose strip slides in when a week turns — `hub/DayCard.tsx`,
     CSS `day-marker` / `week-slide` / `day-tick`) with the three ways to move
     time side by side: **Advance one day** (primary), **Advance — next stop**
     (skip) and ▶/⏸ autoplay. When the clock is blocked (matchday, season
     stop) the primary action becomes that stop. Below it, **Needs you** lists
     every pending decision as its own card (season stop, event today,
     Community Cup invite — new `NowInvite`, incoming bid, sponsor offers,
     expiring contracts, cash warning, open Backer debt) or says plainly that
     nothing needs a decision. **What you can do today** is a grid of status
     cards (training, scrim with the run button, market with window state,
     finances with runway, bootcamp when a slot is open, squad) and **Your
     edges** shows the active coach/gear/psychologist/Sharp/sponsor perks so
     the toolbox is visible where the player lives. The feeds (wire, transfer
     wire, inbox) stay below; the budget tile folded into the finances card.
     Day-by-day advance was always in the engine; it is now the primary
     control, which is what gives the transfer window its "day after day"
     feel (R27 will add the window's own daily rhythm).

R27. **One training decision a week: the team drill.** Training was
     "set-and-forget" by design (R-era) and playtesters read it as "nothing to
     do". The drill is the weekly decision that is cheap to make and visible
     in results: pick one of five (`CAREER_TRAINING.drills` — mechanics lab,
     rotations, set plays, film room, clutch sets) and every squad player
     grows that attribute by `drillOffsetPerWeek` (0.25) on top of their own
     focus, inside the offset cap, while sessions run ×`drillOverallMult`
     (1.05). It is week-scoped (`save.drill` = season/week/id; a stale week is
     "no drill") so the Monday choice recurs. With "Delegate to coach" on, the
     coach's plan auto-picks the drill that trains the coach's own buff (or
     rotates weekly); the player can still override it. No save migration:
     the field is optional.

R28. **Attributes are visible and all six matter.** DESIGN-DECISIONS #117 adds
     offense/defense weights to the shared sim; the Training screen gains
     "What your attributes do" — the fielded team's stat line turned into the
     exact modifiers the sim applies (`statEffectsFor`), so "train what your
     results need" is a readable instruction and the drill/focus choices have a
     visible target.

R29. **Growth made tangible; the 21+ curve lifted; sparring in three tiers.**
     Each player card now shows progress to the NEXT whole point, an ETA in
     training days at the current rate (`trainingEta`, honest about the
     split/season caps and potential), and "this split +x of 3 · season +y of
     7" — the "+0.08/week" abstraction becomes "next point in ~9 days".
     `CAREER_AGE.growthMult` 21-22 / 23-24 / 25+ lifted 0.7/0.35/0.15 →
     0.8/0.45/0.2 (journeyman rosters stopped moving at 23). Scrims keep their
     engine (XP × opponent quality + chemistry credit) but the screen offers
     three sparring tiers first — Easier (chemistry, likely win), Even, Harder
     (develops faster, expect to lose) — with the full shortlist and booking
     behind "More opponents". Attribute-buff coaches now make sense with the
     drill (the coach's pick trains their own buff).

R30. **Every regional opens with a Wednesday qualifier for everyone outside
     the direct 8.** Miguel: "uma qualificatória antes do regional, somente com
     times que não são o top 8 … para sentir melhor a progressão, mesmo sem
     classificar". Each regional week now carries a 16-team Swiss
     **qualifier** (new `EventTier`, `CAREER_QUALIFIER`, ids
     `{s}:{split}:qual{n}:{region}`, matchday = Saturday − 3) per region. The
     split's **direct 8** come from one seeding rule (`regionalSeedingFor`:
     split points → prestige → stored rating; the user races for a slot with
     reputation tier as prestige — stored fields only, so hub, calendar, lobby
     and engine agree). The qualifier fields the non-direct orgs, the user
     when not direct, and **local amateur sides (R23) to fill** — the lowest
     seeds drop when the pool overflows; the user's qualifier is a team-rated
     local scene plus eight real orgs. Its top 8 are stored as
     `competition.qualifiedRefs[region]` and Saturday's regional fields the
     direct 8 + those 8 (locals can make it; they never enter the points
     tables). AI regions resolve their qualifiers on the Wednesday; the user's
     waits in the lobby and, on finish, books the regional (news + mail) or
     reports the miss — a week without a regional trains at full share.
     Pays no Season Points, a small pool (6k), rep +1 to advance (+1 to win).
     Pre-2.0 saves: no qualifier data → the regional stays open as before.
     `eventResultsCap` 60 → 90 for the extra results.

R31. **Real orgs enter the world when their season arrives.** The season-0
     world is built from Season X lineups and padded with fillers; the
     anchor pass (R-era) could only pull real players into orgs that already
     existed, so Karmine Corp, Moist, Gen.G, FUT… never showed up ("times de
     lines novas reais podem entrar quando a simulação chegar na season
     deles"). `realOrgIntake` runs at every rollover into a dataset season:
     each new lineup's org replaces the REGION'S WEAKEST FILLER (by stored
     rating) — the filler roster keeps the seat, the filler's players go to
     free agency, and the next preseason anchor pass brings the real lineup in
     with the usual fidelity. Org counts never grow (16/region stays the
     engine contract); regions out of fillers keep their field. News per
     entrant ("{org} enters the {region} scene", priority 2 at home). This is
     also what makes local fields "evolve": the scene hardens season by
     season exactly as history did.

R32. **Permanent career achievements, outside the save, with limited Season XP
     and cosmetics.** Miguel's examples (first regional / Major / Worlds, three
     Worlds, Worlds under an overall ceiling, Worlds without signings, every
     difficulty) are the spine of a 15-entry catalog (`data/career/
     achievements.ts`, hand-maintained; names in career copy). Evaluation is
     pure (`engine/career/achievements.ts`) and runs after EVERY flow in the
     store wrappers: it reads lifetime stats, reputation, the season index and
     one-shot MARKERS the flows leave on `save.flags` (sponsor signed, bank
     cleared, qualifier advanced, the Worlds-win roster context: max fielded
     starter overall and "founding roster only" via the new
     `foundingSquadIds`). Memory lives on the career store (`achievements:
     { unlocked, worldsWonOn }`, persisted — DESIGN-DECISIONS #118) so it
     survives abandoned saves and seasons; "Every Road" reads the difficulties
     Worlds was won on across saves. Each unlock pays its Season XP once
     through `profileStore.grantXp` (the mode never gates on the calendar;
     40–800 XP per entry), posts an achievement toast, and mirrors the id into
     `profile.careerMarks`, from which the cosmetics catalog derives eight
     career items (Regional Champion badge, Major Winner title, World Champion
     title + frame, Underdog, Homegrown, Dynasty, Road Warrior). The Club
     screen lists the whole catalog with unlock dates.

R33. **Weekly inserts: one small decision between tournaments.** "Skipando
     para o próximo campeonato" was the complaint; the fix is a mid-week card
     (Tue–Thu, ~35% of weeks, `CAREER_INSERTS`) with two legible options and
     effects limited to money, reputation, chemistry credit and ± training-week
     equivalents — never a new system to manage. Catalog
     `data/career/inserts.ts` (10: side quests, sponsor asks that only roll
     with a sponsor, training calls that only roll with a coach / a budget),
     deterministic roll per (career, season, week) with a recency window
     (`engine/career/inserts.ts`), one roll per week on a seeded weekday. The
     card is a "Needs you" stop for autoplay/skip but never blocks a single
     advance: an unanswered card expires with its day, no penalty, no nag.
     `resolveInsertFlow` applies the choice (ledger kind `insert`).

R34. **Curated colour kits in the wizard; contrast-guarded custom pairs.**
     Miguel: "as cores não fazem sentido na paleta". `CREST_KITS` (16 named
     pairs, every hex in `CREST_PALETTE`) is the wizard's first choice — one
     tap sets both colours; custom swatches stay one toggle away and
     secondaries within 0.12 luminance of the primary are disabled, so a
     crest can no longer be built without contrast. Crest shapes (14),
     symbols (18) and patterns (7) are unchanged.

R35. **Hub v3 — the clock has a hierarchy; squad and training are blocks, not
     cards.** Miguel on rc.1: "What you can do today" was "horrível com cards
     básicos e repetitivos", "Suas vantagens" belonged with training, and the
     primary action should be play/pause. The timeline block now carries
     Play/Pause (primary), Skip to the next stop (secondary) and +1 day
     (tertiary, quiet); the Squad block shows the starters as people (OVR,
     archetype, age, phase, growth ETA) with sub, coach and chemistry; the
     Training block holds today's status, the drill, the scrim CTA and the
     edges. Finances moved to a side tile. Any route change pauses autoplay.

R36. **Inserts are rare and block the clock.** 1–2 per split (chance per
     week 0.35 → 0.14), rendered INSIDE the timeline block with icon rows
     (cash · reputation · chemistry · training, signed), and `advanceDayFlow`
     refuses to move while one is pending — the player must answer.

R37. **Local sides keep the regional flavour.** The v2.0 local-scene bank was
     region-neutral Rocket League slang ("Flip Reset FC") and the players
     wore numeric tags ("Pivete37"). Now one bank per region with the same
     flavour the filler orgs have (SAM: "Pão de Queijo FC", "Mate Amargo
     Juniors", "Bonde do Boost"), and three distinct plain names from the
     regional player bank. Local sides open a roster sheet from the lobby.

R38. **Underdog is any big title won as the weaker side; Worlds count across
     saves (rc.4, Miguel's badge catalog).** `car-worlds-underdog` keeps its id
     but its condition is now "win a regional, Major or Worlds with a team
     overall at least 3 below the average of the rest of that event's field"
     (`titleUnderdog`, margin 3 in the catalog; the flow records the biggest
     gap on `achUnderdogGap`). Was: Worlds with no starter above 85. Every
     Worlds title also feeds the profile (`addCareerWorlds`: lifetime
     `careerWorldsWon` + this season's `season.careerWorlds`) for the World
     Champion / Crowned World Champion / Dynasty badges in the draft game.

R39. **Real players have their real age; FIFAe cards are not club history
     (rc.24, the v2.0 base export).** `deriveBirthYear` returns the year of
     the player's real birth date (`players.json` `birthday`, 364 players,
     from PandaScore) and only samples a debut age for players without one.
     Ages stay year-based (`seasonYear − birthYear`), like before. A career
     that already exists keeps the `birthYear` stored on its squad; only new
     careers (and players met for the first time) get the real age — no save
     migration. The national-team cards (FIFAe 2024/2025) share the RLCS
     season `order` of their year, so they are kept OUT of the career's card
     history (`cardsByPlayer`, `lastDatasetCardOrder`): a national card would
     otherwise become a player's anchor overall for that season and lift
     their potential (Saudi Arabia 2024 is rated 95–96). Season X now has 18 real EU
     orgs (was 6), so the world can hold more than 16 orgs in a region; the
     regionals already field the top 16 by rating.

R40. **The weekend calendar: Saturday qualifier → Sunday regional; Major and
     Worlds over two days (rc.28, GAME-02/03).** Event, stage and day are
     separate things, and a qualifier never produces a champion. Regional
     week: the qualifier plays SATURDAY as a 16-team Swiss only (format
     `swissOnly`: the 8 teams that reach 3 wins qualify and it ends there —
     no playoffs, champion, champion rep, prize or news); the regional plays
     SUNDAY with the direct 8 + the 8 qualified (meeting a qualifier opponent
     again is fine: another tournament). Major / Worlds: Saturday lobby and
     Swiss, a pause, then the playoffs on "Championship Sunday"; finishEvent
     runs once. Open weeks and Mon-Fri training are unchanged. (a) No new
     `Placement` (it is the Draft's too): in a qualifier `top8` = Qualified,
     `swiss_exit` = Eliminated (`qualifierOutcomeOf`); its `championRef` is
     the top Swiss seed and `hasChampion` is false. (b) Days are balance
     constants; `CareerEventDef.day` is the day the event opens, the
     Major/Worlds Sunday is derived (`playoffsDayFor`), `eventIdFor` is
     untouched. (c) The pause is derived from saved state (two-day event,
     clock before its playoffs day, Swiss finished, no playoff round played):
     stepping and sim hold, the clock may move exactly one day, and Saturday
     + Sunday equal one uninterrupted run. (d) The week's commitment owns the
     user's event (pending, active or played); AI events resolve on their last
     day and never twice; with the user in a direct seat, the AI qualifier of
     their region is seeded with the user in it, so the displaced org plays
     Saturday (it used to miss both events). (e) The team is fixed at
     `startEvent` (`fieldedIds` gets the XP and stability credit; the lineup
     locks until the event ends). (f) The results list (cap 90) never drops
     the user's own current-season rows — the season review counts from it.
     (g) Rewards: `qualifierAdvance` rep only (`qualifierWin` removed), a flat
     `swissOnlyPct` 9 % / 3 % prize (provisional, ECO-01), no points; one rep
     rule in the engine (`eventRepKindFor`). (h) UI: weekend strip in the
     lobbies, Swiss verdict strip, the Swiss-complete pause panel ("Continue
     to Championship Sunday"; its own ContinueKind, so autoplay stops), the
     top bar waits for the replay before it moves on (session-only
     `careerRevealStore`), a once-per-event Championship Sunday title card
     (pairings only, skippable, static under reduced motion), a spectator
     Sunday for a user out in the Swiss; PT keeps the name "Championship
     Sunday". (i) Saves: additive `migrateSaveToV4` (saveVersion 4, persist
     version 3 frozen) re-dates pending defs, ends a legacy qualifier at its
     Swiss, pauses a legacy Major mid-Swiss (one already in its playoffs
     finishes Saturday); history is untouched. Rejected: a new "qualified"
     placement, a stored pause field, raising the results cap.

R41. **The Match Center tells each game as a timeline (rc.28, GAME-04).** The
     engine still settles a game as a winner, a winner-first score, an OT flag
     and per-player goals; `engine/career/matchTimeline.ts` turns that into a
     story, presentation only: a local RNG seeded from the round, both teams,
     the rating gap and every saved game result — never the event cursor — so
     reloads replay the same story and winners, drafts and balance cannot
     move. Regulation interleaves the goals uniformly (the loser can open and
     lead; a 3-0 never fakes a comeback), on clock times inside 4:55-0:01, at
     least 4 s apart. Overtime (W-(W-1)): regulation ends tied, an END OF
     REGULATION / OVERTIME beat lands, an accelerated +M:SS clock runs to the
     winner's golden goal at an OT length from weighted buckets (0:30-2:00
     55 %, 2-5 min 30 %, 5-10 min 12 %, 10-20 min 3 %; median about 1:52).
     Scorers keep the engine's counts. One plan (`clockPlayback.ts`) drives
     the beat timer and the `GameClock`, and a shared record of how far the
     step played (`BeatSync`) keeps them together through pause, speed
     changes and remounts. No spoilers: OVERTIME comes from the revealed beat,
     game chips read left team - right team, and upcoming chips look the same
     until the series is fully shown. Tunables: `CAREER_MATCH_CLOCK`.

R42. **Name banks split by role (rc.29, CAR-01).** Local amateur sides
     (`LOCAL_PLAYER_NAME_BANK`, 36 per region), the wizard's founders
     (`STARTER_NAME_BANK`) and the filler/rookie bank are disjoint from each
     other and from every name in the dataset. Rookies get a gamertag at
     intake that nobody in their region holds, stored in the additive
     `world.rookieNames`. A new world has `nameBankVersion` 2, which swaps the
     five real nicknames the old bank held. A Season X player who changed
     teams mid-season is rostered once: the first org in dataset order keeps
     them, and the other seat signs the best free agent of that region.
     Existing careers keep every persisted or derived name, along with their
     old clashes. No save migration (persist v3 and saveVersion 4 are
     unchanged). Rejected: renaming players in running careers.

R43. **The reveal cursor lives in sessionStorage, not in the save (rc.29,
     CAR-02/03).** `rd:career:reveal:<careerSeed>:<eventId>` records how many
     rounds of an event the player has watched. A reload or a trip to HQ
     replays the unfinished round from its start. The top bar, HQ and the
     calendar hold the event's own Continue until that replay ends, so none of
     them can give away a result. A new tab treats every simulated round as
     seen. Under reduced motion, an event day stops on its last round ("See
     results" / "See the Swiss result") before the digest or the pause panel.

R44. **Lobbies advertise the prize that is paid (rc.29, CAR-08).**
     `economy.prizePoolPaidFor` sums `prizeFor` over each format's
     placements, with this season's growth, the difficulty and the rounding.
     The lobby, the calendar detail and the HQ cards show it. The qualifier's
     flat split becomes 10 % / 2.5 % (8 × $600 + 8 × $150 = $6k at season
     0). Provisional, to recalibrate in ECO-01. Side effect: the regional shows
     $40.8k because the swiss16 table pays 102 %, and the Community Cup shows
     $1.8k after rounding to $50. Miguel to confirm, or reshape the tables.

R45. **One direct-8 decision per week, and the one-time repair (rc.30, Etapa
     2a).** (a) The user's seeding rating is the team rating HQ shows
     (`userSeedRatingFor`: the fielded trio with chemistry, coach, gear and the
     bootcamp edge), on the scale of the orgs' stored intrinsic ratings. The
     starters' plain average now feeds only scrim matchmaking and the
     unofficial offers (DEV-03 rebuilds scrims). (b) A regional week's Monday
     commits the user's region seeding (`competition.weekSeeding`). Saturday's
     qualifier, Sunday's regional, the lobby, the agenda, the calendar and
     `userIsDirect` read it for that week, so a signing, the Mon–Fri training
     or a change in points never moves the user across the line mid-week.
     Later weeks preview live. (c) saveVersion 5 (`migrateSaveToV5`; persist
     version 3 frozen) runs the world's one-time repair
     (`repairLegacyWorld`) for careers started before rc.29, which reverses
     R42's "existing careers keep every name". It also rebuilds an in-flight
     week's seeding from the commit the save already made. (d) Rejected:
     re-seeding the weekend with a frozen user rating (stored org ratings can
     still split the AI side) and renaming the user's players.

R46. **The Backer and the bank keep their rules, and the screens quote what
     the ledger books (rc.31, Etapa 2b ECO-02).** The engine already granted
     the Backer once (`loanUsed`) and the bank one loan at a time; the harness
     shows one rescue per insolvent career. Four integrity bugs sat around it.
     (a) A manual pay-down quantized the payment down
     (`quantize(min(amount, remaining))`), but the Backer's ×1.2 and the
     bank's interest leave debts off the $50 quantum (a $9,612 Backer debt).
     "Pay it all" left a $2–48 stub that no button could pay ("invalid"), and
     the stub kept the Backer lock alive: no bank loan, no fee transfer, no
     gear. `economy.debtPaymentFor` now settles the exact remainder when the
     request covers it and stays on the quantum otherwise, for both debts
     (the bank's stub used to wait for Monday). (b) An insolvency after a
     Worlds title or in the endless era kept the earlier ending's reason
     (`endCareer` wrote `reason ?? "insolvency"`), and the season screen
     offered "Defend the title" / "Endless era" for any ending but
     retirement. A broke org rolled into a new season and broke again on its
     first Monday. Now an insolvency always records itself (a retirement
     still keeps the ending it earned, and the legacy grade stays), an ended
     career never rolls over (`rolloverToNextSeason`, the new
     `continueInfiniteFlow`), the screen shows only Retire, and the saves
     list archives it. An ended career is closed: ONE guard in the store
     (`careerStore` `withSave` / `withResult`) refuses every action that
     changes the career (money, roster, staff, events, the clock) with
     "blocked" and leaves the save untouched; only retiring and the viewing
     state (read marks, seen flags) pass. HQ then shows the season stop and
     no decision card or money notice (runway, the Backer, the next bank
     instalment). (c) The bank
     panel guessed its own refusal. It now shows the real `bankLoanRefusal`
     reason (the strings the flow returns, EN+PT) and disables the request.
     While a loan runs it shows the next instalment (`nextPaydayFor`: the
     amount, the Monday's date) and the instalments left
     (`bankInstalmentsLeft`). HQ names the Backer debt and the next bank
     payment. The Backer has no schedule (prize and sale garnish), which the
     panel already states. (d) A pay-down may still use the overdraft down to
     the floor (unchanged rule), but it now shows the balance after and warns
     when that is below zero: below the floor on a Monday "the Backer steps
     in", or, once it has, "the career ends". The "Loans & debt" panel opens
     by default while a debt exists and then follows the user's toggling, so
     paying a debt off never folds it away under the cursor. (e) A sale's
     confirmation (Market and HQ, one `SaleConsequences` block) quotes
     `economy.salePreviewFor`: the balance after net of the Backer's share
     (`saleGarnishFor`, the rule `applyTransferIncome` books), "Backer repaid
     $X" while it is owed, and the weekly wage bill before → after. No
     economy number moved.

R47. **The lineup slot is not the price of the job, and the first window is
     bid-free (rc.31, Etapa 2b ECO-03 / ECO-03b).** (a) The "signed as a sub"
     discount is gone (`CAREER_SALARY.subRoleFactor` 0.4 removed;
     `computeSalaryAsk` has no role factor). Signing cheap as a sub and then
     promoting for free was the exploit. A player signs at his normal value
     and then the lineup is set. He takes an open seat in the starting three,
     otherwise the reserve slot, and nobody is demoted. `role` stays an
     ignored, deprecated option so older callers compile. (b) The squad cap
     is explicit (`CAREER_CONTRACT.squadCap` 4, R3). A full squad must name
     who leaves (`signPlayerFlow` `releaseId`), and that player is released,
     with severance, in the same operation. If he was a starter, the signing
     takes his seat. The market's offer sheet asks (EN+PT) and shows the
     severance and the weekly wage bill before and after; the severance and
     the balance after come from the chosen leaver even when the plan is
     refused (funds, the loan lock), so the reason and the numbers agree.
     Its "why this price" keeps the wage effects per split, labelled (the
     weekly wage line rounds them, so converted rows would not add up), and
     the under-contract fee as a one-off. (c)
     `signingPlanFor` validates everything (window, slot, age, rep cap,
     funds = fee + bonus + severance, the Backer lock) before anything moves.
     The flow applies exactly that plan and the sheet renders it. A rejected
     counter keeps only the hardened negotiation count; a failed transfer
     moves no money and no slot. A sale settles every pending bid for that
     player, as a release does, and a bid for a player who already left is
     refused and dropped. Promotion stays a free `setStartersFlow`.
     Renewals price through `market.renewalAskFor` (a reserve renews like a
     starter), and the renewal sheet shows the payroll projection
     (`economy.payrollProjection`, the Monday funnel's own rounding). (d) Old
     saves: no save change. Existing contracts keep their stored wage until
     renewal and reprice then; no retroactive raise. (e) ECO-03b, decided
     29/10: no bid of any kind for the user's players in the career's first
     transfer window (season 0's preseason window, windowIdx 0 = weeks 1–2 of
     "Season 1"). The flag is `CAREER_TRANSFER.firstWindowBidFree` and the
     guard `market.userBidsBlocked`, read by `incomingBidForDay` and by the
     scripted-beat Blockbuster degrade, which reads "preempted" there. Today
     no degrade beat falls in that window; the guard covers the corpus to
     come. The daily roll is a hash, so later windows' bids are unchanged.

R48. **Longevity: 13 to play, 24–29 to retire (rc.31, Etapa 2b DEV-02,
     decided 29/10).** (a) `CAREER_AGE.minCompetitiveAge` 13 is the one
     minimum. Debut ages clamp to it (`MIN_AGE`), the market lists and the
     signing accepts only 13+ (`isCompetitiveAge`, error "tooYoung"), and the
     youth intake starts at 13 (`rookieAgeRange`). Audit: fielding,
     registration and substitution carry no age rule and need none (nobody
     under 13 can join the squad); the wizard's rosters start at 15 and the
     fillers at 16. (b) `retirementChanceFor` is one rule for the user's
     squad and the world: the chance that the season a player plays at age A
     is his last. It is 0 before `retireMinAge` 24 or before his peak, read
     through `peakAgeOf` (today the stored 18–22 peak; DEV-01 individualises
     it there). Inside the window it is `retirementByAge` {24: 10 %, 25: 20 %,
     26: 30 %, 27: 45 %, 28: 60 %}, × 0.5 for stars, inside the window only.
     Who counts as a star differs by caller (both kept from rc.30, now named
     in `CAREER_AGE`): overall 85 in the user's squad
     (`retirementStarOverallSquad`), 90 in the world
     (`retirementStarOverallWorld`, the blue-card bar today).
     It is 1 when the next season would pass `retireMaxAge` 29: the season at
     29 always ends it, and the 2022 → 2024 calendar gap makes 28 the last.
     The squad still announces at the rollover into the final season and
     retires at the next (never abrupt). A player signed in a season that
     must be his last (`signsForFinalSeason`: the coming rollover's chance
     is 1 — a 29-year-old, or a 28-year-old in 2022-23) signs with that final
     season announced and for one season only; the offer sheet says so
     (EN+PT) and offers only the 1-season deal, so he never plays at 30 for
     the user. A legacy player already past 29 announces at once and plays
     one farewell season. An announcement made under the old table is
     honoured. The world decides on the season just
     played. rc.30 rolled on the new season's age with no cap, so players
     left after a season at 21–23 (the gap) and a few played on past 29.
     Measured over 4 seeds × 10 seasons: every world retirement now follows
     a season at 24–29, nobody plays at 30, and the world holds ~15 % more
     players (≈610 vs ≈530). (c) Real history: a real player plays every
     season he has a club card for. The old guard (`last > orderNow`) let him
     retire before his final dataset season; across 4 seeds, 116 cases were
     exposed. Once his history ends the window applies, so a real player
     already older than the window when his history ends retires at that
     first rollover (no extra season). A user-signed real player is off
     script and follows the squad rule. (d) A retiring real ex-pro becomes a
     coach with `retireCoachConvertRate` 60 %, decided per (career, player)
     from the seed (`becomesCoachOnRetirement`; no save state). Only those
     feed the coach market's real pool. Generic (fictional) retirees always
     leave the game: the market's generated coaches stay anonymous, and a
     fictional coach would need a stored name and record (DEV-03). Coaches
     already hired stay; coach quality and effects are untouched (DEV-03).
     World retirees keep the generic "hangs up the controller" line. (e) The
     user's retiring player now leaves the world for good (`retiredIds`).
     Before, the anchor pass re-signed a real one to his real org the next
     preseason (GarrettG back at NRG). The season-start news and a mail say
     which way he went (`retiredToCoach` / `retiredLeaves`, EN+PT).

R49. **Local sides score and race for Major and Worlds slots (rc.31, Etapa
     2b, RTW-01).** Miguel (29/10): local amateur sides score in the regional
     and can earn a Major slot; a split Major table and a season Worlds
     table, both viewable. Reverses R23's "never in standings" and R30's
     "they never enter the points tables"; local sides are still never
     persisted as teams, and R23's cup selection, R30's qualifier layout, the
     pool of 8 per region-season and `localSceneBand` are unchanged.
     (a) Points: `applyResultToStandings` banks every regional row, a local
     side that came through Saturday included, into its region's split and
     season tables. A Major banks it at home: `regionOfRef` parses
     `local:<region>:…` (it fell back to the user's region).
     `majorFieldFor` / `worldsFieldFor` rank every team on the table, and
     `fieldForEvent` fields a local side that earned a slot.
     (b) Strength: one rating per side per season, its region's anchor plus
     its hashed offset (`localAnchorFor`). The user's region is rated around
     the user's squad: its best trio on the team-rating scale
     (`worldSim.bestTrioRatingFor` via `careerFlow.localAnchorRatingFor`:
     userTeamFor's own rating with chemistry, coach and gear, every
     three-player lineup of the squad rated, the bootcamp edge left out),
     frozen on the season's first regional Monday (`competition.localAnchor`,
     optional, reset with the competition at the rollover). Who the user
     fields that Monday and an armed bootcamp never move it, so a lineup swap
     on the eve cannot soften the season's local scene (the R45 week seeding
     still reads the fielded rating, `userSeedRatingFor`). Every other region uses the median of its stored org ratings,
     the season's computeStars snapshot. The side is the same team in a cup,
     on Saturday, on Sunday, in a Major and at Worlds, whether the user plays
     or watches, and a Major never reads the user's current squad. Before
     the freeze (the season's W1–3 cups) and on a save from before rc.31
     until its next Monday, the user's own events read the user's current
     rating, as shipped. This keeps Gate-1 question 6's default ("rated
     around the user"), frozen instead of live: an improving squad no longer
     drags its local scene up, so late-season cups and qualifiers get a
     little easier. If Miguel answers 6 with "no", the user's region takes
     the median like the others (drop the freeze).
     (c) Seeding (R45): a local side holding split points is a team of the
     region in the direct-8 race (prestige 0, its season rating,
     `localSeedRowsFor`). A direct local side plays Sunday and skips
     Saturday, and no side is seeded twice. When the qualifier pool
     overflows (the user's region with all eight sides scoring: 25 teams for
     24 seats), the lowest-seeded local side drops, so every org keeps a
     Saturday or a direct seat. Invitationals still invite orgs only.
     (d) Tables: one view-model (`engine/career/raceTable.ts`) for the
     Standings tabs and the HQ toggle. The Major table is the split's
     regional points, cut at `CAREER_SLOTS.major`; the Worlds table is the
     season's regional and Major points, cut at `CAREER_SLOTS.worlds`. Both
     rank with `rankByPoints`, the selection's own order and tie-break, list
     every team of the region (zero-point orgs by name), mark local sides,
     give the user's status (secured, in the race, out of reach; conservative
     until the field is announced) and count the fixtures left. Before the
     table has points (`started`) the rows are only listed by name: nobody
     is inside the cut and the user's line reads "No points yet", neutral.
     Level with the last seat on points but below it on the tie-break reads
     "Level with the line", neutral, never "0 pts below the line"
     (`raceLineOf`, one wording for the toggle and the Standings hero). The
     season review's region table reads the same order, and so does the
     season grade: its region rank (the top-2 / top-4 bonus,
     `seasonGradeFor`, and through it the season goal) now counts local sides
     like any team of the region.
     (e) Measured (opt-in `RTW_LOCALS=1`, 42 hands-off careers × 4 seasons):
     local sides take 0.2 % of the Major slots and 0.04 % of the Worlds
     slots; they hold 14–24 % of the Sunday regional seats and 3–8 % of the
     direct seats in AI regions. Real orgs keep 84 % of the slots; the rest
     are filler orgs, nearly all of APAC's and SSA's single slot (their real
     orgs from 2021-22 rate below the top fillers, which predates R49). No
     retune.
     (f) Saves: persist version 3 and saveVersion 5 unchanged. An old save
     banks local points from its next regional on, nothing retroactive, and
     keeps any announced field. Rejected: storing an anchor for every region
     (the median is already a season snapshot), the user's live rating in
     the user's events (a side would change strength between Saturday and a
     Major), and keeping local sides out of the direct 8 or the Major slots
     (they are teams of the region, and they do not crowd the orgs out).

R50. **One money scale: one season index, tables that pay the pool (rc.32,
     Etapa 2b part 2, ECONOMY-CONTRACT M1 + M5 — provisional default
     (30/10), to be confirmed by Miguel).** (a) M1, decision 1-A:
     `economy.moneyIndex(seasonIndex, stream)` is the one season index.
     `CAREER_ECONOMY.indexMode` "single" puts every stream on
     `indexPerSeason` 1.08^s: wage asks and fees (they read
     `CAREER_SALARY.inflationPerSeason` before), prizes (1.12),
     new sponsor deals (1.10), and the amounts that were flat — the fanbase,
     the bank's limits and minimum, the minimum fee and salary, the stand-in,
     scouting, gear prices and upkeep, the psychologist, the founding partner
     (R51) and the inserts' money (`indexedAmount`, quantized, never to $0).
     Signed contracts and stored sponsor deals keep their figure. The Backer
     is sized in weeks of payroll (R52), so it follows wages without a second
     index; the start budget is a day-one amount. "rc31" restores rc.31
     exactly (the three rates, every other amount flat). (b) M5, decision 6-B:
     `CAREER_PRIZES.tables` "contract" — Swiss-16 28 / 18 / 12 / 9 / 6.5 / 5 /
     1.25 and single-elimination 40 / 20 / 10 / 5, both 100 % (a season-0
     regional pays its $40k, the Community Cup its $2k); the qualifier's
     10 % / 2.5 % and every pool are unchanged and the lobby still shows the
     paid total (R44). "rc31" restores rc.31's tables (`swiss16PctRc31`, which
     paid 102 %). (c) Saves: nothing stored moves; a running career reads the
     new prices from its next purchase or Monday. (d) Measured (indicative,
     the probe's 21 Normal careers of EU, SAM and OCE, seed 9100, before
     R52's two soft-lock fixes): with M1 switched back and the rest of rc.32
     on, 48 % went insolvent instead of 62 % — M1 lowers late prizes and new
     deals while the renewal shock stands (M2, front B, is what the contract
     pairs it with); its gain is the snowball (p90 2.5 → 0.8 seasons of
     payroll). Re-measure with M2.

R51. **The founding partner (rc.32, Etapa 2b part 2, ECONOMY-CONTRACT M3 —
     provisional default (30/10), to be confirmed by Miguel).** Decision 3-A.
     A day-one tier-0 deal (`CAREER_SPONSOR.founding`): base per split =
     `payrollShare` 0.7 × the founding wage bill (squad + coach, fixed at
     creation, then on the sponsor stream's index), objective "enter events",
     no signing bonus, paid every Monday as its own statement and ledger line
     ("Founding partner") and shown in Finances with its end condition. It
     runs until the first real deal or the end of season index
     `throughSeasonIndex` 1, whichever is later: a deal signed in the first
     two seasons runs alongside it and it steps back on the first Monday of
     season index 2 ("Season 3"); a first deal signed later ends it there and
     then (a mail says so). Saves: optional `foundingPartner` (null = none). A save from before
     rc.32 gets it at load only while in season index ≤ 1 with no sponsor
     ever signed, sized on its wage bill at that load and announced once in
     the inbox (`backfillEconomyOnLoad`, run by migrateSaveToV5 on every
     load, idempotent, no version bump); every other one records null.
     `enabled: false` restores rc.31 (no partner, no mail, no line).

R52. **The safety net: warnings with the breach, the Backer in weeks, what
     ends a career (rc.32, Etapa 2b part 2, ECONOMY-CONTRACT M4 — provisional
     default (30/10), to be confirmed by Miguel).** Decision 4-B. (a)
     Warnings (`CAREER_PAYROLL.runwayWarnMode` "weekly"): the accountant
     writes every Monday the runway is ≤ `runwayWarnWeeks` 4 (the overdraft
     included; the news line once a squeeze) and once when it first drops to
     ≤ `runwayNoticeWeeks` 8, each with the projected breach (the Monday the
     books would close below the floor at this net, `mondaysToBreach`), what
     that breach would mean and a recovery checklist; a runway back above 8
     re-arms both. rc.31 mailed once, at exactly 4 weeks with a positive
     balance, so a fast burn or an overdraft skipped it ("rc31" restores
     that). The Market's offer sheet shows the runway a signing leaves
     (`economy.runwayWeeksAfter`, ready for the renewal readout). (b) The
     Backer in weeks of payroll (`CAREER_LOAN.sizing` "weeks"): the floor is
     −`floorWeeks` 8 and the rescue target +`rescueToWeeks` 6 × the weekly
     wage bill (squad + coach, at least `weeksBasisMin`), so season 0 keeps
     about rc.31's line (−$4k / +$3k on a $500 week) and a season-6 $11k week
     gets −$88k / +$66k. Every "funds" check reads the same line
     (`backerLineOf`). "flat" restores −$5k / +$3k. (c) While the Backer is
     owed, a signing, a coach hire or the psychologist that would shorten the
     runway is refused with the reason ("loanRunway", `lockCommitments`), on
     top of rc.31's lock (fees, gear, the bank — R21's "no bank loan while the
     Backer is owed" is kept). One exception: a free agent into an empty
     starting seat (a restructured squad under three) — the probe found Easy
     careers sold down to an empty squad that could never sign again.
     Renewals are not locked (front B's flow). (d)
     What ends a career (`breachesToEnd`, by difficulty): Easy never, Normal
     the third breach, Hard the second (rc.31: 2 everywhere). The first breach
     is the rescue; every breach strictly between is a RESTRUCTURING: the
     highest-paid player is sold at market value to an AI org of his region
     that would field him (half the fee to the debt, like any sale), rep −5
     (`restructureRepLoss`, never below the rep floor) and the Backer's rescue
     rule tops the books back up to its target (a grant repaid ×1.2 on top of
     what is owed). The squad stays playable (the reserve moves up, an empty
     seat takes a stand-in) and can be rebuilt: the Market always lists a
     page (24) of free agents the org can sign (`market.listingFor`'s
     `signableCap`; the top 120 by overall could all sit above a rep-0 cap,
     so a restructured org saw only locked rows). An inbox mail, a news line
     and the HQ's Backer card say what happened, why and what the next breach
     means.
     Saves: optional `finances.loanBreaches`, read from `loanUsed` (1) until
     the next breach writes it. (e) Measured with the whole rc.32 package
     (the probe's 63 careers — EU, SAM, OCE × 7 policies × Easy / Normal /
     Hard, seed 9100 — rc.31 → rc.32): insolvent over 8 seasons 43 → 0 % /
     76 → 57 % / 90 → 86 %, by season 3 33 → 0 / 62 → 29 / 86 → 43 %; the
     newcomers' first two seasons pay their way without a big win 44 → 67 /
     11 → 67 / 11 → 67 %; every rescue is warned in the 8 weeks before
     (rc.31: 0–67 %), the first warning 13–32 weeks ahead, and the Backer buys
     13–27 weeks of burn (rc.31: 2–8); restructured careers 33 / 71 / 0 %.
     Money still decides: season-rows with a tight Monday in S3–S5 32 → 52 /
     50 → 90 / 42 → 91 %, the spender still goes broke on Normal and Hard
     (67 / 100 %), snowball p90 1.6 / 0.8 / 1.7 seasons of payroll, and no
     Normal or Hard career can carry a 90+ at S3–S7. The late break stands
     without front B's M2 (Normal 57 %): re-measure the full sweep with it.

R53. **Stars, the snowball and selling (rc.32, Etapa 2b part 2,
     ECONOMY-CONTRACT M6 + M8 — provisional default (30/10), to be confirmed
     by Miguel).** (a) M6, decision 5-B: the comfort level stops at
     `CAREER_SALARY.repComfortMax` 86, so a star always carries a premium (at
     rep 100 a 90 pays ×1.16 and a 95 ×1.36, P2b; null restores rc.31); the
     players' share of podium prizes (`CAREER_PRIZES.playerShare`: regional
     0.2, Major 0.35, Worlds 0.5, 1st–4th only) is booked as its own ledger
     line right after the prize, the Backer garnishes the org's part, and the
     event result and Finances show it (`enabled: false` restores rc.31).
     The probe's curves: a 90's season wage ÷ the T4-contender income is
     0.85 every season (P8; rc.31 drifted 0.74 → 0.63), and a dominant
     season's prizes kept ÷ a three-85 squad's wages 1.13 (P4b, band e2 ≤ 1.5).
     Lever C (the title raise) stays in reserve. Decision 7-A: the T4
     contender stays the yardstick only; no AI money. Decision 9-B: tier bases
     and the fanbase rate are not retuned (M1 only indexes them); 10-A: §3's
     bands stand. (b) M8, decision 8-B: "List for sale"
     (`CAREER_TRANSFER.listingEnabled`) — after `listingOfferDays` 1–3
     eligible window days an AI org of his region that would field him
     offers market value × `listingOfferRange` 0.9–1.15; accept it like any
     bid (atomic, R47; the Backer's half while owed), decline it (he stays,
     the listing ends) or withdraw it. The window rules apply, R47's bid-free
     first window included (the Market says so). A seat sold in a window can
     be refilled with one free agent until `lateSigningDays` 7 after the
     window closes (one per window, so one per split); 0 = option C. Saves:
     optional `saleListings`, `lateSigning`; offers carry `listing`.

R54. **The age clock steps one year a season; the Blockbuster bid explained
     (rc.32, Miguel 30/10 — fixes).** (a) RLCS 2022-23 started in 2022 and the
     next season is "2024": `seasonYear` read each label's first year (2020,
     2021, 2022, 2024), so every age jumped two years at that rollover and
     R48's "the 2022 → 2024 gap makes 28 the last" followed. It now reads the
     year a season ends (2021, 2022, 2023, 2024, 2025, 2026, +1 per infinite
     season), so ages step exactly +1, real birth dates (R39) give the real
     age from RLCS 2024 on, and the birth-year inference reads the debut
     season on the same clock (inferred debut ages keep their 13–17 band ±1).
     `retirementChanceFor`, `signsForFinalSeason` and the rollover's
     `calendarStep` keep their formulas (the step is now always 1): only a
     29-year-old signs for his final season. The retirement table is
     unchanged, and so is its outcome (4 seeds × 10 seasons, the world):
     retirees' last season p10 / p50 / p90 24 / 26 / 28, always 24–29, no
     season at 30, before and after; fewer go at 28–29 (371 → 275 of about
     1.5k, the phantom year pushed them past 29) and the world holds 637
     players instead of 618. The squad rule's final season stays p50 27 with
     badges from 24 (300 seeds). A running save shifts once, at its first
     load, never at a rollover: in seasons 0–2 a squad player, a real player
     with a birth date and an inferred one who debuted before Season X read
     one year older; from RLCS 2024 on a squad player and a real player with
     a birth date read as before, while fillers, rookies and inferred players
     who debuted in Season X–2022-23 read one year younger (the phantom year
     is gone). (b) The scripted Blockbuster bid explains itself in the offer
     (Market deals, the HQ card) and in its mail (EN + PT, numbers from
     balance.ts): a scripted moment — a big-money org chasing the player it
     built around in real history —, a fee of ×`blockbusterFeeMult` 1.5 his
     value, and refusing it raises his next renewal ask by
     `blockbusterRefusalRenewalMult` (+10 %). That surcharge was declared
     since v0.2 but no caller passed it: declining or letting a Blockbuster
     expire now stamps the deal in force (`blockbusterRefusedUntil`), and its
     renewal asks the 10 % more (`market.renewalAskFor`), once. (c) The
     integration review: an rc.31 save keeps growth model 1 (R55a), and model
     1's growth multipliers and rollover decline are banded by age, so in
     seasons 0–2 its players also develop and decline one age band later
     than they did in rc.31 (weekly gain 0.15 → 0.12 at the band edge; a
     rollover decline step rc.31 skipped). Kept on purpose: reading model 1
     on the old first-year clock would bring back the two-year jump at
     2022-23 → 2024 inside the curves. Only existing staging and playtest
     careers meet it; a new career runs model 2 on the one clock.

R55. **The growth contract: an individual arc, and potential is the expected
     peak (rc.32, Etapa 2b DEV-01b/d; direction decided by Miguel 29/10).**
     (a) Versioned per career. `CAREER_DEV.growthModel` 2 is stamped on a
     new career's world (`world.growthModel`, optional and additive); a save
     without it, every rc.31 career, keeps rc.31's development for life (its
     potentials, bands, curve, caps and rollover), so nothing it scouted,
     trained or signed moves on load and no overall jumps to "compensate".
     Its curve reads R54's age clock, one age band later in seasons 0–2
     (R54c).
     The key at 1 starts new careers on rc.31's model again. (b) Three
     separate dimensions, derived from (career seed, player id) and never
     rerolled by a signing, a sale, a renewal or a new club
     (`developmentProfileOf`): the maturity (early 18–20, standard 20–22,
     late 22–24; weights 0.3 / 0.45 / 0.25) sets the peak age; a plateau of
     1–4 years holds the top; then the decline (`declinePerYear` 0.5 / 1.5 /
     2 / 2.5 / 3 a year after the plateau, × the decline rate, the squad ×
     0.7 as before). A real player peaks at the age of his best moment (the
     card or special his potential comes from, inside 17–26) and stays at the
     top at least as long as his club cards do. A generated player is never
     promised a peak sooner than his gap needs (ceil(gap ÷ 7) + 1 seasons, at
     most 26). `peakAgeOf` keeps its meaning (the age he reaches his peak:
     the stored or derived `peakAge`), so DEV-02's "never retire before the
     peak" reads the new peak. (c) The potential is the EXPECTED peak: his
     real peak is the potential plus an offset of −2…+2 (`peakTolerance`,
     weights 10/20/40/20/10 %), rolled once; growth never passes it. (d) The
     curve: pace = 2 × gap ÷ years to the peak age (at least 0.6 a year while
     a gap remains, at most 7), × the training multipliers (coach, gear,
     focus, intensity, drill, Training Week), in units of 40 training-week
     equivalents a year (a no-coach starter's days and series); a late
     arrival keeps catching up through his plateau, never after it. No
     per-split cap; the season cap stays 7 (`seasonGainCap`). Ages are exact
     (the season age plus the share of the season played), so nothing steps
     on a birthday; the decline lands on each training day instead of the
     rollover; the AI world develops every Monday (`worldGrowthWeek`, the
     same pace at `worldTrainingMult` 1, the decline undampened like rc.31's
     world) and the rollover pass grows nobody on model 2. (e) Measured
     (`CAREER-GROWTH-rc32.md`, 24 seeds, the default setup): a prospect's
     season gain at 15 goes from 7.0 to 4.5 and at 18 from 0.1 to 1.9; the
     peak lands at 18.6 / 20.0 / 21.3 (early / standard / late, p50) instead
     of 17.7 for everyone; 100 % end within ±2 of their potential; a
     13–14-year-old with potential 85+ peaks in his 7th season; the AI world
     reaches its real peak (gap p50 0.0 at 21, rc.31 stalled 2.0 under).
     Rejected: rerolling the profile at a signing; the fixed 18–22 window; a
     split cap; growing the AI world at the rollover (a visible jump);
     migrating rc.31 saves onto the new derivation (their bought bands would
     move).

R56. **Rare elite prospects in every era, and the potential of a real player
     with special cards (rc.32, DEV-01a/c).** (a) Model 2's dataset-era
     rookie intake keeps the pyramid and the 88 ceiling, but a kid aged 13–15
     whose tier reaches past the ceiling becomes an elite prospect with
     `CAREER_WORLD.eliteProspect.chance` 0.08: potential 93–98 by weight
     (93 25 %, 94 22 %, 95 19 %, 96 15 %, 97 11 %, 98 8 %). The 88+ share does
     not grow (the elite kids come out of the capped ones); the infinite era
     keeps its pyramid. Measured over 24 seeds: 0.8 % of dataset-era rookies
     (0.2–0.5 per region per career, about two in the whole world), seven
     97–98s in 6,720 kids; by region and class in the growth doc's G1. (b) A real player's potential = max(best
     club card from his debut + the stable jitter, his best eligible special
     at its printed overall), fixed (it no longer climbs with his current
     overall); his debut overall is untouched. The explicit rule for
     "eligible": his own player card (by playerId, never a coach card) of a
     real RLCS moment (legend, moment, Worlds/season/Major MVP) with a real
     rarity (rare, epic, legendary, mythic) whose moment is inside the
     career's own seasons (RLCS X on, `potentialSpecialCareerEraOnly`).
     Never: national-team cards (a derived +boost), the community vote, the
     Creator and the Wings tributes (fan or easter-egg cards), and pre-2020
     legend cards (a 2016 peak a 2020 free agent would otherwise read
     forever). Measured: 47 players hold an eligible special; none sits under
     it (rc.31: 85 %).

R57. **Honest bands that never move; base growth is days plus the series
     played (rc.32, DEV-01e and the base-growth rule).** (a) Model 2's band
     reads the potential only — never the current overall, the day or a
     reload — and nests: each report narrows inside the band shown before (L0
     ⊇ L1 ⊇ L2 ⊇ the exact L3), widths unchanged (`bandWidthByLevel`). At each
     level the truth's place is a uniform draw over what the outer band
     allows, kept inside 60–99, so the truth can sit at the floor, in the
     middle or at the top. The floor may fall under the current overall: a
     player at or past his expected peak reads so instead of a ceiling he
     never reaches. Measured: settled players (headroom 0–2) at the floor 35
     → 22 %, mean position 0.31 → 0.46; nested 42 → 100 %; a growing overall
     moves the band 88 → 0 %. Near 99 the band cannot pass the top, so 90+
     potentials read top-heavy (inherent). An rc.31 save keeps rc.31's band
     (floored at the overall), so a report it bought never moves. (b) Base
     growth without a package: a player's training days plus the series he
     actually plays (`xpWeeksPerSeries` 0.4 training-week equivalents × the
     field quality per series; rc.31 paid two weeks an event whatever its
     length). A reserve who did not play keeps his training days and earns
     no event or scrim XP (rc.31 paid the registered sub 70 % of a starter's
     event XP). Packages (Etapa 3, DEV-03) can only speed this up. (c) The
     expectation is rolled once per player and career (the profile and the
     offset); more series reach the peak sooner, never past it.

R58. **Renewing your own players: a raise cap and a market floor (rc.32,
     ECONOMY-CONTRACT M2, decision 2 option B — a provisional default
     (30/10), to be confirmed by Miguel).** (a) `renewPlayerFlow` prices
     `renewalTermsFor` (engine/career/renewal.ts — one function for the
     flow, the Squad renewal sheet and the Market's renewal panel): ask =
     min(fresh, max(current wage × `CAREER_SALARY.renewalRaiseCap` 1.5,
     fresh × `renewalMarketFloor` 0.5)) on the core fresh ask (without the
     ambition premium), then the ambition premium (×1.25) and the
     Blockbuster-refusal surcharge (×1.1) on top. A declining veteran renews
     at his lower fresh ask: the rule only ever lowers the price. It also
     spreads the repricing of an old cheap reserve contract (R47 removed the
     0.4 sub factor) over his renewals. (b) The Blockbuster surcharge was
     declared but never applied (nothing passed `blockbusterRefused`). Front
     A fixed it too (R54); the integration kept ONE source, A's stamp on the
     deal (`SquadPlayer.blockbusterRefusedUntil`, set on a decline or an
     expiry, read by `market.blockbusterRefusalApplies`): `renewalAskFor`'s
     `surcharges: false` prices the core ask without either surcharge, and
     `renewalTermsFor` adds both on top, once. (c) The readout (EN + PT) states the rule, his
     market ask and the renewal ask, which bound priced it, and the
     ambition / Blockbuster lines: on Squad's renewal sheet and in the
     Market's "My deals" tab (this season's expiring contracts), with the
     runway the renewal leaves (M4's `runwayWeeksAfter`, wired at the
     integration). (d) Switch: `renewalRule` "fresh" restores rc.31's rule
     (the plain fresh ask); a refused Blockbuster still surcharges it, which
     is the bug fix (b), not part of M2. (e) Measured on top of DEV-01, the same 147 careers (one
     seed, 8 seasons): insolvent 71 → 61 % (Easy 49 → 43, Normal 80 → 69,
     Hard 84 → 71); payroll ÷ guaranteed income p50 3.97 → 3.18; the median
     payroll per split in seasons 3–5 64–75k → 53–57k; careers alive at S7
     44 → 63; youth 43 → 24 % insolvent. Money still decides: p90 six
     Mondays below $0 a season, the spender still breaks in 86 %, the
     snowball p90 at S7 is $537k. Rejected: option A (a cap alone keeps a
     breakout star far under his value) and C (a homegrown ×0.7 leaves the
     founders at ×3).

R59. **The career's own difficulty presets, and filler orgs capped at the
     region's best real lineup (rc.32, Etapa 2b BAL-02; the filler cap a
     provisional default (30/10), to be confirmed by Miguel).** (a) Road to
     Worlds reads `CAREER_DIFFICULTY` (balance.ts,
     `engine/career/difficulty.ts`), never the Draft's `DIFFICULTY`: every
     career team carries its own form roll (`TournamentTeam.rollRange`,
     career-only, optional) and chemistry cap
     (`AssembleInput.chemistryMaxBonus`), and the AI shift comes from the
     career block. A Draft retune of `DIFFICULTY` moves no career team or
     series (tested); Draft teams never carry the fields, so the golden
     master is untouched. (b) Easy and Normal keep rc.31's values exactly.
     Hard was the Draft's Hard, whose AI chemistry cap 0 stripped every
     career AI org of the chemistry its standing roster earns, so in the
     career Hard played as easy as Easy: at equal player strength the user
     won 81 % of Bo5 series on Easy, 65 % on Normal and 81 % on Hard. Hard
     now counts the AI's chemistry (2) and shifts it −0.2 (was −0.5): 81 /
     65 / 55 %; the user keeps Hard's 2.4 chemistry reward. (c) The presets
     replace the wizard's Management Style step: one sentence each and their
     real effects, read live from balance.ts (the match edge, chemistry, the
     starting budget, the prize / ask / sponsor multipliers — front A's
     keys, read and not moved — and how much is guided), from one descriptor
     list (`PRESET_ROWS`): a new row, e.g. `CAREER_LOAN.breachesToEnd`, is
     one entry plus its label in both copy files. How much is guided: Easy
     and Normal delegate the weekly drill to the coach and enter the cups for
     you (Normal is rc.31's "balanced"); Hard starts hands-on (you plan every
     week and choose every cup); the Training screen's delegation toggle
     stays. A new career's prefs come from its preset (`presetPrefs`); an
     existing save keeps its prefs and `managementStyle`; the deprecated
     `style` input still maps as rc.31 (tests, tools); the arc bot passes
     rc.31's "balanced" prefs explicitly, so the economy probe stays
     comparable. (d) The filler cap (`CAREER_WORLD.fillerCapToBestReal`;
     rc.31 uncapped = false): a filler org's team rating never passes the
     strongest real org of its region at that moment (a region with no real
     org yet stays uncapped; the players keep their overalls). Over 6 seeds ×
     6 seasons it lowers the bar only where fillers ruled: APAC's top org
     83.0 → 81.9 and SSA's 83.3 → 81.4 (the top filler had sat 1.3 / 2.2
     above the best real org), MENA 87.7 → 87.5; NA, EU, SAM and OCE
     unchanged; APAC and SSA have no real org in season 0. Local sides stay
     rated around the user, frozen at the season's first regional Monday
     (R49, unchanged). (e) Measured on top of DEV-01 and M2, the same 147
     careers as the rc.31 baseline: first Major by S2 Easy 14 → 35 %, Normal
     2 → 29 %, Hard 6 → 20 % (rc.31: 29 / 18 / 6 %); Majors qualified per
     season 0.37 / 0.24 / 0.22 → 0.74 / 0.53 / 0.25 (rc.31 0.82 / 0.62 /
     0.30); insolvent Easy 43 → 39 %, Normal 69 → 65 %, Hard 71 → 84 % (rc.31
     49 / 69 / 84 %). The swing sits in APAC and SSA, where the cap meets
     weak real orgs (Normal first Major by S2 0 → 100 % in both); elsewhere
     it is within one seed's noise. The regional identities keep their slots
     (SAM 2, EU 4). Rejected: tuning Easy's edge down (it is rc.31's),
     zeroing the user's Hard chemistry reward, and capping the filler
     players instead of the org.

R60. **The integration of Etapa 2b part 2, and the fixes from its
     independent review (rc.32).** (a) Wired across fronts: the renewal
     readout shows the runway the renewal leaves (R52 on R58); the wizard's
     presets say what ends a career through money (`breachesToEnd`, R52 on
     R59); one Blockbuster stamp (R58b); the moment-age table reads R54's
     clock. (b) The Backer's commitment lock is measured to the floor in
     exact weeks of burn (`backerLocks`): measured to $0 in whole weeks it
     read 0 before and after any commitment in the overdraft, where an open
     Backer spends most of its weeks, so it was off exactly when it
     mattered. (c) A founder who leaves the squad stays in the world: his
     "fic:{region}:starterN" id comes from no generator, so a sold founder
     vanished and his buyer fielded a stand-in (since rc.31's accepted bids;
     the restructurings and listings made it common). His record is kept in
     `WorldState.formerSquad` (optional, additive) on a sale, a release or
     an expired deal, and `playerViewById` resolves it: the buyer fields
     him, and a released founder is a free agent like any other. (d) The
     restructuring mail and news state what the sale and the Backer did
     (the share to the debt, the top-up, the real balance), not "half to the
     debt, back at the rescue line" whatever happened. (e) The late signing
     refills the seat a window sale left open: not once the squad was
     refilled inside the window, and never as a swap
     (`LateSigningState.squadAfterSale`). (f) Analytics reads the potential
     band of the save's development model, as the screens do (#145).

R61. **What ends a career through money, by difficulty, and Easy's rescue
     partner (rc.33, ECO-07 + ECO-08; decided by Miguel 30/10, replaces
     ECONOMY-CONTRACT decisions 3-A and 4-B).** (a) `breachesToEnd` Easy 3 /
     Normal 2 / Hard 1 (`breachesToEndFor`): every breach before the last is
     an Emergency Backer rescue (a second one adds to the debt), the last
     ends the career. The restructuring is gone (`restructureAfterBreach`,
     `restructureRepLoss`, the "restructure" outcome): no forced sale of the
     highest-paid player. rc.32's `restructured`, `listingOffer` and `listed`
     mail and news templates stay only so an older save's inbox still
     renders; a stored `next: "restructure"` predicts nothing. The warnings
     (8 weeks, then every Monday at ≤ 4) stay and now read next Monday's
     statement. (b) No day-one founding partner: `founding.enabled` off; an
     rc.32 career holding the deal is paid to its own end (`honourRunning`),
     a new career and the load backfill record `null`. (c) Easy's "partner's
     help" is the rescue partner (`CAREER_LOAN.rescuePartner`: at breach 1 on
     Easy, 50 % of the rescue Monday's wage bill each Monday for 10 weeks,
     "Overtime Fund"): income, never garnished, its own ledger line, in the
     statement and the runway, announced in the rescue mail with its last
     payday and shown on a Finances card while it runs. Rejected: a partner
     on Normal (Miguel: Normal gets the loan only), a partner sized in money
     (it would not scale with the squad), and keeping the restructuring as a
     softer step (Miguel: restructurings go).

R62. **The money scale at 12 % with a star bend, and guaranteed income
     (rc.33, ECO-09 and M7; values are Claude's call, tested at Gate 2).**
     (a) One index, `indexPerSeason` 1.12, for every stream (each ×2.20–2.23
     by S7, b1 within ±2 %). (b) Above `starCurveFrom` 80 the ask grows
     `starGrowthPerPoint` 1.03 a point on top of the curve (an 85 ×1.16 of
     rc.32, a 90 ×1.34, a 95 ×1.56); market values follow, coaches do not. A
     90's wage is 1.12 × the T4-contender income (rc.32 0.85; band ≥ 0.35).
     (c) M7: sponsor tier bases $5k / $12k / $22k / $45k a split and the
     fanbase $60 a reputation point. The money went to the newcomer tiers:
     T3/T4 holders were already at payroll ÷ guaranteed 1.5 / 1.1, and
     $35k / $60k bases raised the snowball in the first measurement.
     Rejected: 1.10 (Miguel: 12 % felt better), indexing coaches with the
     bend, raising T3/T4.

R63. **No sale listing, and the Monday ring behind the expanded balance
     chart (rc.33, ECO-12 withdraws ECONOMY-CONTRACT 8-B; UX-07, HQ-CONTRACT
     decision 4-A).** (a) The listing and the late signing are removed (the
     flows, the store actions, the Market panel, badge and banner, the market
     helpers, their four keys and copy); random AI bids stay; a future update
     rethinks selling (ECO-06). `repairMoneyOnLoad` (idempotent, in the load
     chain next to `backfillEconomyOnLoad`, no version bump) drops
     `saleListings` and `lateSigning` and turns a listing's pending offer into
     a plain bid. (b) `FinanceState.balanceRing` keeps up to 96 Monday
     balances (`balanceRingWeeks`); the Monday funnel and the founding day
     record each Monday once (re-recording replaces); an older save seeds it
     only from the Mondays its ledger really booked. The chart lives in the
     portal Modal; its geometry is pure (`balanceChart.ts`).

R64. **The prize share per contract and the contract talk (rc.33, ECO-10
     replaces M6's fixed 20 / 35 / 50 %; ECO-11; the share values are
     Claude's call, tested at Gate 2).** (a) One number per contract
     (`SquadPlayer.prizeSharePct`), not scaled by tier: the ask is 8 % at an
     80, ±0.5 a point (`CAREER_PRIZE_SHARE`, 2–18 %), the talk moves it from 3
     below to 4 above the ask, and a point is worth 2 % of the wage. Paid only
     to the players who played, only on a 1st–4th at a regional, Major or
     Worlds, booked once from `eventPlayerShareFor` (the digest reads the
     same function). A deal without the field reads rc.32's rule ÷ 3 seats.
     The e2 guard (a dominant season's kept prizes ÷ three 85s' wages ≤ 1.5)
     holds at S0, S3 and S7. (b) One answer for signings and renewals
     (`negotiationAnswerFor`): a visible zone from his flexibility
     (`flexFloor` 0.94, seeded per player, season and window) to his ask at
     the share offered; below it he counters at the zone's floor and taking
     it signs; nothing is stored between tries (`negotiationTries` stays in
     the save, unwritten). M2's renewal rule (2-B) is unchanged. Rejected: a
     hidden reserve, any hardening after a refusal, a share on every prize
     (it would tax newcomers' cups), paying a reserve who did not play.

R65. **Honest potential, and the Market's filter and full squad (rc.33,
     DEV-04 revisits DEV-01e; UX-07).** (a) Model-2 bands at most 5 / 3 / 1
     points wide by report level, their top 0–2 above the truth
     (`CAREER_SCOUT.honestWidthByLevel`, `bandMaxAbove`), drawn from the
     deepest report outward so the deepest stays uncertain; capped at
     `reachableOverallOf` (development.ts's own model: past his plateau a
     player tops at his overall); `phaseTagFor` (growing / at his peak /
     declining) from the real development state, "?" below report level 1.
     Careers created before rc.33 (no `CareerSave.bandModel`) keep rc.32's
     band for reports, so a bought report only narrows. By design the truth
     sits in the band's top three points. (b) "Signable at my reputation"
     reads `signableAtRep`, the rule behind the "repGate" refusal and the
     locked tiles. A full squad warns and links to Squad; the flow still
     refuses "squadFull" (its `releaseId` swap stays for tests and the bot).
     The Blockbuster sentence shows only on a Blockbuster bid.

R66. **Every org enters its history, and fewer known players without a
     team (rc.33, RTW-03 answers C-1; RTW-04).** (a) `orgIntake: "everyOrg"`:
     an entrant takes the weakest filler; else the weakest org whose history
     is over (no lineup that season or later) leaves; else the region grows.
     A dry run over the dataset never needs the growth case; event fields
     still take 16 by the seeding (R45). `nameOfRef` falls back to the
     dataset name for an org that left, and a bid from one sends the player
     to free agency. Older saves need no repair: the missing orgs enter at
     the next rollover. (b) `creationFreeAgentRecentSeasons` 1 (only careers
     that ended within one season of Season X, or resume later, start as
     free agents) and `historyOverFreeAgentLeaveChance` 0.5 (a real free
     agent whose history is over leaves at a dataset rollover; his id goes
     to `retiredIds` but not to the age-retirement list, so DEV-02 holds).

R67. **A full squad to play (rc.33, RTW-05).** Miguel: no event with fewer
     than three players, no stand-in, an empty seat counts 0. (a)
     `squadHoldFor`: `advanceDayFlow` refuses to enter the user's matchday
     with under three players (Advance, the batched Advance, the autoplay —
     `continueKind` "decision" — Championship Sunday, a reload); `startEvent`
     refuses too; HQ's `NowSquadShort` card offers Market and Squad, plus
     Pass for a cup. (b) A free agent can take an empty seat any day, window
     or not; the funds and Backer checks are waived only for a free agent no
     dearer than the cheapest one the user can sign (the review's fix), so a
     broke squad can always fill the seat without a loophole. (c) The
     unavailability roll needs a reserve; without one nobody is ruled out.
     (d) `userTeamFor` rates an empty seat 0 and reports `emptySeats`;
     chemistry counts three pairs; `approxUserRating`, the save slot's stars
     and the local-anchor freeze count three seats. Scrims refuse a short
     squad. The arc bot signs first when short (0 softlocks).

R68. **The newcomer's reputation path, match difficulty and the preset
     step (rc.33, RTW-02, BAL-04, UX-07; values are Claude's call).** (a)
     Results judged against the seed (`engine/career/reputation.ts`): a cup
     semi-final from seed 3 or lower pays `gains.t3Semi` 1 inside the cup's
     cap; two Swiss wins from outside the qualifying eight pay
     `gains.qualifierDeepRun` 1, once a split; nothing pays at reputation 25
     or above (`newcomer.repCeiling`). (b) BAL-04's yardstick is a series
     between sides of equal team rating: rc.32 gave 84.7 / 70.5 / 56.2 % on
     Easy / Normal / Hard against R59's 81 / 65 / 55 (R59's numbers had the
     user rated slightly below), so Normal carried a 1.55-point edge. Easy's
     shift −2 → −1.6 and Normal's −1.05 → −0.6 give 81.4 / 65.2 / 56.2 %;
     Hard is at its intent and stays; the filler cap stays
     (`fillerCapMargin` 0: a 1-point margin moved nothing in APAC/SSA). (c)
     The preset step shows three lines (matches from `matchEdgeOf` against
     Normal, money from `breachesToEnd`, day to day), no numbers.

R69. **A renewal climbs at most ×2.5, and winning raises the renewal
     (rc.33, the integration's tuning; 2-B's values and M6 lever 3 are
     Claude's call, tested at Gate 2).** The first re-measure of the merged
     fronts (294 careers, §10) put the unfair break where it lived: the
     hands-off prospects careers renewed developed players at ×3.9 p50 /
     ×12 p90 (up to ×25) of their wage — 2-B's market floor reprices a
     breakout at half his value in one step, and ECO-09's star bend raised
     that value — and every such career in EU and NA on Normal went broke in
     seasons 4–6. (a) `renewalMaxJump` 2.5: the market floor never lifts a
     wage more than ×2.5 in one renewal (`bound: "jump"`, named by the
     readout); a breakout climbs to his value over two renewals. (b) The
     development dividend feeds the snowball, so the contract's reserved
     brake ships with it: `titleRenewalPremium` (+10 % a Major or Worlds
     title, +5 % a regional title won with him in the last two seasons, at
     most +30 %), read by `renewalTermsOfSave` — the talk, `renewPlayerFlow`
     and the readout price the same number. Rejected: lowering the floor
     itself (it is the contract's "far below his market value" line),
     regional prize or sponsor scales (contract f: the money rules are the
     same everywhere), and a wage budget (lever 4, Etapa 3).

R70. **The integration of Etapa 2b part 3, and the fixes from its two
     independent reviews (rc.33).** (a) Wired across fronts: the empty-seat
     signing (RTW-05) meets ECO-12's window-only rule; the preset step reads
     ECO-08's key; the arc bot signs when short and renews at the talk's
     floor. (b) The share lever priced per split in $50 steps under a $10
     weekly label, so a press could leave the wage unchanged: the share is
     priced in weekly money (`sharePointWeeklyFor`). (c) The wizard drew its
     own ±5 band: it reads the engine's (`founderPotentialBandFor`). (d) The
     empty-seat waiver covered any free agent: only one no dearer than the
     cheapest signable (`emptySeatPriceFor`). (e) The share lever ignored
     the switch; scrims ran with a short squad. (f) Model-1 careers get the
     honest width and top too (no age cap: model 1 never stops growing by
     age); a bought report still only narrows. (g) The rescue mail printed
     a raw "1540 a week" (`partnerWeekly` not a money param; templates now
     test amounts with `positive()`, which also fixes rc.32's restructure
     mail always saying "nothing is owed"). (h) The warnings projected the
     breach as if the rescue partner paid forever (a warning in week 7
     quoted week 32 for a breach in week 23): the runway reads the partner's
     remaining Mondays. (i) Copy promised a Backer where the next breach
     ends the career (`nextBreachOutcomeOf`). (j) An older save's chart seed
     counted a Monday purchase as payroll; the chart now re-measures its
     width. (k) The Backer analytics milestone fires on every rescue
     (`backer:N`).

R71. **HQ around the next decision: one queue for every clock path (rc.34,
     UX-01a; HQ-CONTRACT decision 1-B, Gate 3a 30/10).** `pendingDecisionsOf`
     (`store/careerDecisions.ts`) lists every needed decision, urgent first:
     a matchday, the money notice, the contract review, a short squad, the
     weekly insert, the training proposal, a bid, the sponsor offers.
     `clockHoldOf` is read by `advanceDayFlow`, `isStopState` and
     `continueKind`, so the Advance, the batched Advance, the autoplay,
     Championship Sunday and a reload cannot walk past one. "Later" only for
     bids and sponsor offers, up to their deadline; on the deadline the clock
     waits for an answer (a bid never lapses silently; the sponsor offers are
     signed or declined). A cup the user entered holds its matchday (Play or
     Pass); a fresh invite only stops the batched Advance once (an invite's
     default is "not entered", so it is not a needed decision — the review's
     Gate 3b finding). The other fronts plug in through `DECISION_SOURCES`
     (training, sponsor, notice: `{id, deadline?, holds?}`); a money notice
     holds only its own Monday (the modal itself waits for "OK").

R72. **HQ's blocks show engine truth (rc.34, UX-01b–f; HQ decisions 2-A,
     3-A, 4-A, 5-A, 6-A, 7-A).** The squad as Draft cards (`baseRarityOf`'s
     frame, the user's crest); the race block's seeding line from
     `userIsDirect`; the finance block from `hqFinanceOf`, the projection
     Finances shows, rc.33's ring opening larger; the toolbox with a confirm
     sheet whose refusals come from a dry run of the flow; the bootcamp lasts
     the split (`CAREER_GEAR.bootcampSpan` "split", its end shown;
     `bootcampSplitEdgeShare` 0.5 = 5-B in reserve). Measured: a camp every
     split moved official series won 56.7 → 56.9 % and Major series 24.4 →
     29.5 %, and costs more per rating point than a coach who also trains —
     so the price stays.

R73. **"New" per career save and the contract clock (rc.34, UX-06).** rc.33's
     seen-state module (#154) with a per-save scope (`careerNew.ts`):
     contracts first, then toolbox items; an existing save sees nothing new;
     opening (or buying) marks seen; dots on Squad and Finances; the unlock
     modal once per novelty. Contracts: time left on the cards and on Squad,
     reminders in weeks 28 and 31 (`CAREER_HQ.contractReminderWeeks`), and
     an explicit review the rollover waits for. With two players a regional
     cannot be played: each regional (or its qualifier) offers "Skip this
     regional" (RTW-06, Miguel 31/10) — no points, no prize, training goes
     on, the region still gets its result; a Major keeps the hold.

R74. **Training is a package per period (rc.34, DEV-03; TRAINING-CONTRACT
     1–7 A).** (a) A 28-day grid, 8 a season (`CAREER_PLAN.periodMode`;
     "split" behind the key). (b) A package only speeds the road to DEV-01's
     peak and shapes the attributes; with no package and no coach a player
     grows at the base (`baseRateMult` 0.85 keeps rc.33's measured base);
     the coach acts through the package. (c) Three scrim levels, practice
     only, capped at 25 % of a period's gain, with a local side when no org
     fits the level's gap. (d) Wear feeds the pre-event roll, at most +4
     points. (e) Delegation by preset — Easy: the coach runs it; Normal: he
     proposes on the period's first Monday (HQ waits); Hard: you set it, with
     Repeat; a mode switch takes its own repeat flag. (f) Reports filed as
     history (a ring of 16). (g) Old saves load on the base
     (`repairTrainingOnLoad`); the weekly drill and per-card controls
     retired into the package. Measured (`CAREER_TRAINING`): a development
     package takes a 13–19-year-old 1.14–1.31× the base speed (band
     1.10–1.35), the peak unchanged; scrims are 17–26 % of a coached
     player's gain (rc.33 uncapped: up to 41 %).

R75. **Coaches are distinct (rc.34, DEV-03; decision 5-A).** Quality (focus
     efficiency, 0.5–1.1), experience (plan quality and less wear) and a
     specialty (+25 % on its objective), each printed on the hire card;
     senior generics 72–90 and standard 60–84; ex-pros from their
     career-best card (66 + 0.8 × (best − 75) ± 4, 64–94, experience 3, the
     archetype's specialty, ×1.15 wage); a coach grows +1 experience a
     season he worked (+0.5 quality, +1 when most periods ran his specialty),
     up to a ceiling. "Pass" on an invite no longer grants a hidden training
     day.

R76. **Sponsors (rc.34, ECO-04 + ECO-05; SPONSOR-CONTRACT 1–5 A, 6-B, 7-A,
     adjusted to ECO-07/08).** (a) Each decision offers three deals of
     equal expected value, one per profile, at the best tier the
     reputation allows (decisions 2-A, 3-A): Steady (6 splits, "Likely"
     goals, a signing payment, no fines, the patience meter kept — 7-A),
     Balanced (3 splits, "Even", fines) and Bold (1 split, "Stretch", a
     milestone payment, the biggest bonuses and fines). Weekly pay is a
     fixed share of the tier's value (Steady 0.76 ≥ Balanced 0.70 ≥ Bold
     0.65 a Monday); the fixed part and the bonuses absorb the goal's
     chance (the review's finding: a share of a ceiling that grew as the
     chance fell put Bold's weekly pay above the others' in 15 % of
     decisions). (b) Goals only from events still ahead, worded by the
     modelled chance (`goalModel`, logistic curves fitted on the harness;
     `wordChance` 0.8 / 0.5 / 0.25, never under `wordMin` 0.66 / 0.38 /
     0.16, so never unreachable) and priced at it; set at a split's start,
     settled at its boundary. (c) Fines (1-A): `fineShare` (0 / 0.15 / 0.5)
     × the goal's bonus × the shortfall, at most a week of the deal's pay,
     over 4 Mondays, waived where an instalment would take the books under
     the bank's floor, booked after the loan's deadline check; none on
     Steady deals or on Easy. (d) `levelValue` (0.08 a rating point, floors
     T2 0.7 / T3 0.5 / T4 0.4): T2–T4 pay in full against the region's 8th,
     the Major's 8th and the Major's 4th — the snowball's brake (at 0.06
     the p90 fell only 12.9 → 11.0). (e) ECO-05 (6-B): the money inserts stay
     random inserts, indexed and capped (2 a split, 10 % of the season's
     earned income), never guaranteed; the jersey shoot costs agenda time.
     (f) The deadline is the Sunday before the split's first event week;
     "Later" until then (1-B), then the clock waits for a signature or a
     decline. A Worlds-window renewal keeps its one-tier demotion across
     the rollover (`sponsorDemotedSlot`) and the season review waits for
     it. (g) The founding partner's handover (5-A) applies only to an rc.32
     career still running one (ECO-07/08 left no day-one partner): ⅔, then
     ⅓, then nothing, on boundary Mondays (`founding.taper`; `[]` restores
     the cliff), each card showing the net weekly change; measured 0.36 of
     the full pay a step (band ⅓ plus rounding). Measured on a slice before
     the review (20 careers a difficulty): Normal insolvent 10 → 5 %, Hard
     45 → 15 %, Normal's snowball p90 12.9 → 9.9; goals hit at their word
     72 / 50 / 34 %. Open for Miguel: Bold-only careers break the
     season-fines band (s3) in 24 % of seasons against 10 % — accept it as
     Bold's risk, lower Bold's fine to 0.35, or cap a season's fines at two
     weeks of payroll.

R77. **The rescue is the bank's emergency loan, and the debt's deadline ends
     a career (rc.34, ECO-13/14/15; Miguel 31/10, replacing R61's breach
     count).** (a) A Monday below the floor opens the
     bank's emergency loan (`CAREER_LOAN.emergency`): the balance lent back
     to the rescue line, owed ×1.2, repaid from prizes (10 / 15 / 20 %),
     sales (half) and Finances. `finances.loan` keeps its name; the product
     says "emergency loan". (b) The investor (rc.33's rescue partner, the
     Overtime Fund) joins only the career's first loan, where
     `investor.payrollShare` has a share (Easy 0.2, Claude's call — Miguel
     can extend it), for 10 Mondays. (c) The deadline: `deadlineWeeks` 64 /
     48 / 24 from the first loan; a later breach adds to it (the deadline
     stays; `maxTopUps` 3, the next one ends the career); at most
     `maxLoans` 3 / 2 / 1 loans a career (the review: a loan paid on its
     deadline into the overdraft broke the floor again and opened a fresh
     loan with a fresh term). Warnings at `warnWeeks` 8, 4 and 1 quote the
     projection (the balance plus the weeks left × the weekly net), and
     inside the last `slipWatchWeeks` 4 a notice fires the day it stops
     covering the debt. On the day the bank collects when the books stay at
     or above its floor after paying (`canSettleLoan`, "Pay it all"'s own
     test: the overdraft counts); otherwise the career ends (`end.moneyCause`
     "deadline"). `breachesToEnd` null everywhere; `hard: 1` restores Hard's
     first-breach end. (d) The money notice: a modal at the career shell for
     each event that changes the stakes, once per save (`moneyNotices`); the
     batched Advance stops on its Monday, the autoplay pauses. (e) No lock
     while a loan is owed (`lockCommitments` false; true restores R52(c));
     the bank still writes one loan at a time. (f) Saves: `repairLoanOnLoad`
     (in `migrateSaveToV5`'s chain) turns an open Backer debt into the
     emergency loan with a deadline from the update, announced once.
     Front H first collected only from a balance that covered the debt;
     the review moved the deadline to "Pay it all"'s test so the two never
     disagree (in the measured careers no ending moved: 2 of 19 were within
     the floor's room before the other fixes). Rejected: shorter terms (32 /
     24 / 16) — no rescued bot career covered its debt in time, so every
     rescue became a delayed end.

R78. **Every founding roster carries its first split (rc.34, BAL-05).** The
     start budget is at least `startingBudgetWeeks` (44 / 24 / 13) of the
     roster's founding wage bill (`startingBudgetFor`), the flat budget as a
     floor; the wizard shows each roster's budget. Root cause of Miguel's
     rc.33 run: one flat budget for founding payrolls that differ ×3–5
     between rosters (Normal journeymen had 15 weeks of runway, EU's about
     10, against the balanced roster's 25). The hands-off veterans policy
     (`veterans`, opt-in) measures it.

R79. **The contract talk's levers always move; a prize share only above 79
     (rc.34, ECO-16, ECO-17; Miguel 31/10).** (a) The zone is at least one
     wage press wide (`minZoneSteps`), never under the league minimum; a
     share press moves the wage one point the other way (`talkPressFor`) and
     the zone keeps its width across shares; every closed lever names its
     reason. Root cause: the zone was (1 − flex) × the ask with its floor
     rounded up to $10, which collapsed on 85 % of founder renewals. (b) No
     share at or under 79 (`shareThresholdOverall`), +1.2 a point above (85
     → 7 %, 90 → 13 %, cap 18 %); founding deals carry none (an rc.33
     founder's founding share is zeroed on load); signed deals keep theirs;
     e2 at the lowest share 1.38 (≤ 1.5). (c) The difficulty step is a
     promise and three plain bullets per preset; its money line states the
     preset's rule from the keys (the loan and its deadline). Rejected:
     rc.33's slope (e2 1.52), a two-press minimum zone, a wider flexibility.

R80. **The integration of Etapa 3 and Miguel's 31/10 answers, and the fixes
     from its three independent reviews (rc.34).** (a) The integration: G's queue takes the other
     fronts' decisions through `DECISION_SOURCES` — the training proposal,
     the sponsor decision and the money notice (which holds only its own
     Monday; the modal waits for "OK"). The sponsor offers hold on their
     deadline (1-B) instead of lapsing silently. A fine settled on a
     boundary Monday books its first instalment the next Monday
     (`SponsorFineState.from`), because the review moved the boundary
     before the payroll. (b) Three independent reviews (money, talk and
     wizard; HQ queue and training; sponsors) found 21 issues, each fixed
     against a test that failed first: one rule for the deadline and "Pay
     it all"; a loan cap per career; the boundary's bonus before the
     deadline; a projected "covered" with a 1-week warning and a slip
     notice; fines after the deadline check; "Backer" gone from what a new
     career shows; rc.33 founders' shares zeroed on load; the skip on the
     event's own day; the training mode switch and its repeat; the bootcamp
     allowance at the rollover; no hidden training day for passing a cup;
     coach growth by tenure; invites that never hold the clock; a
     Worlds-window renewal that keeps its demotion and holds the review;
     weekly pay ordered Steady ≥ Balanced ≥ Bold; rc.33's demotion carried
     on load; fines in HQ's projection; the handover note by season with
     its net change; signing validated before any change. (c) Re-measured
     on the §9 seeds in `ECONOMY-CONTRACT.md` §11.

R81. **The contract talk has odds, a signing bonus and a length
     lever; cheaper founders and coaches; "Merch & streams" (rc.35, Miguel
     on rc.34).** (a) An offer may go under his zone: from the floor his odds
     fall smoothly (smoothstep) to 0 over `oddsFallPct` 0.25 of his ask; he
     signs when they beat a roll seeded per player and window
     (`negotiationRollFor`), so a reload changes nothing and more money
     never turns a yes into a no; a refusal counters at the floor. (b) Every
     player has the share lever (one who asks 0 % can be offered a share,
     which buys wage); the signing bonus (luvas) is a third lever, 0 …
     `bonusMaxMult` × the standard bonus, each $1 over his ask worth
     `bonusWeight` 1.25 / contract weeks of wage; the zone moves with share
     and bonus. (c) Each season past the first takes `lengthReliefPerSeason`
     3 % of his ask off the floor. (d) The sheet is three sliders with the
     zone painted on the wage track, an odds meter and icons. (e) Founding
     deals pay `foundingWageMult` 0.85 of the founding ask while the start
     budget reads the full ask (more runway); coaches get their own curve,
     `wageGrowthPerPoint` 1.12 (a Normal S0 coach at 80 costs ~$160/wk, was
     $340; at 90 ~$510, was $2,160). (f) The reputation-tied income stays
     (removing it measured unsafe in rc.33 M7) and is renamed "Merch &
     streams" — what it models. Rejected: a hidden reserve without shown
     odds; removing the income.

R82. **Sponsors priced by risk; one level model for the season goal; the
     ladder's sponsor access (rc.35 front S; Miguel's rc.34 playtest).**
     (a) Replaces R76(a)'s equal expected value: each profile pays
     `ceilingOfValue` (Steady 0.95 / Balanced 1.2 / Bold 1.5) × the tier's
     value for its Mondays, `weeklyOfCeiling` of it weekly, so weekly pay and
     the most a deal pays both read Bold > Balanced > Steady. Risk is the
     price: Bold's goal is capped at Balanced's chance, Balanced's at
     Steady's; fines `fineShare` 0 / 0.3 / 0.6 of a bonus, at most
     `fineCapWeeks` 0 / 1 / 2 weeks of weekly pay a miss and
     `fines.seasonCapWeeks` 2 a season. Stretch's floor 0.16 → 0.2.
     (b) The season goal: the target a Balanced deal would set for one
     split, met if reached in ANY split (never harder than a Balanced goal),
     the stretch the Bold one (`seasonGoalModelFor`; older saves keep the
     grade rule). (c) `sponsorAccessFor(level)` (CAREER_SPONSOR.access):
     levels 0–1 two offers, no Bold; 2–3 three, ×1.05; 4 global, ×1.1 and
     2 free bootcamps. Level = `repTierOf(rep)` until front P's ladder.
R83. **Training: nothing runs until you pick; 28-day cycles that pay in
     full on completion (rc.36 front T2, POL-01; Miguel's rc.35 playtest).**
     (a) Back to the 28-day grid (`CAREER_PLAN.periodDays` 14 → 28, 8 a
     season). A period opens on DEV-01's base and nothing starts by itself:
     the manager picks objective, focus, intensity and scrims (the picker
     starts empty) and "Start training" runs the plan from today — tomorrow
     if today's session ran — to the period's end; without a coach a
     finished cycle is started again by hand (rc.35's Easy applied the best
     plan and "Keep my plan" repeated it; `repeatByMode` now only fills the
     old save field). A hired coach plans and starts each cycle while
     `coachPlans` is on (`coachPlansByDefault` true, a toggle on Training);
     off, his plan is only tagged. The preset's mode now decides the
     RECOMMENDED tag only (`NewTag`): Easy and Normal tag the best plan,
     Hard none. (b) Not picking is the base, never a penalty, so an
     unpicked plan is a NUDGE, not a decision: it never enters the queue
     (`DECISION_SOURCES.training` still reads rc.34's proposal, which
     nothing raises) and never holds the clock (Gate 3b: no repetitive
     chore). HQ's Training block becomes "No plan running · Choose a plan"
     with the recommendation, the report modal leads to "Plan the next
     cycle", and the batched Advance stops once on the day a cycle completes
     with nothing started after it (`stopOnCycleEnd` true; a second press
     goes on). (c) Evolve / Gel / Recover (the ids stay development /
     preparation / recovery: no migration). The squad focus is a choice
     again, one per plan (Balanced or the five drill themes, named by their
     attribute); without a coach the tag marks the fielded trio's weakest
     theme (`recommendedFocus` "need": a focus costs no overall, so Balanced
     is never the best pick), with one his buff stat's theme. (d) The
     promise ("you climb to 8–9 of 10, the rest lands on completion"): a
     session pays `payout.alongShare` 0.85 of the plan's rate, never under
     the base (`paidSessionMultFor` = max(1, mult × 0.85)), a package scrim
     0.85 of its XP; the rest is held per player
     (`TrainingPeriodPlayer.held`) and lands on the cycle's last day
     (`closePlan` → `landHeldGain`, inside the peak and the season room a
     tick obeys, read with a cap-sized `trainWeek`, so DEV-01's rules stay
     the only ones), filed as `completion`. An adjustment keeps what is
     earned and held; a stop (the flow's null — the screen offers none) or
     a player who leaves forfeits it; it pays once (the pool empties as it
     pays: a reload, the same day twice and the batched Advance reach the
     same save). The running plan shows the bar — earned · to come · on
     completion — and the ETA reads the paid rate. (e) Heavy and Hard raise
     the absence risk again, modestly and additively: hard scrims 2 → 0.5
     wear, easy −1 → −0.25 (`CAREER_SCRIM.levels`; Heavy's +1 a week
     unchanged) — a cycle reads Heavy ≈ +2 points, Hard ≈ +2, both the +4
     cap; Easy no longer cancels Heavy (rc.35: Hard alone hit the cap,
     Heavy + Easy read 0). (f) A signing joins the running cycle the day he
     signs (`onSquadJoined` in `signPlayerFlow`: his entry, a summary line,
     counted in the promise); a "?" phase is read after `phaseRevealDays` 5
     training days with the squad (`SquadPlayer.phaseDays`,
     `squadPhaseLevelOf`; the band is not narrowed for free), with a feed
     line. (g) HQ's green bar fills toward the next point the card PRINTS:
     cards show Math.round(overall), so it lands at shown + 0.5
     (`trainingEta.progress`, `nextPoint`; rc.35 read floor — at 78.6 the
     card said 79 and the bar still led to 79). (h) An rc.35 save: the
     running 14-day plan keeps its window to its end (`trainingDayStart`
     reads the plan's window, not its index), then the grid's period opens
     from that day; summaries and the seen report are keyed by the period's
     first day (`reportKeyOf` "season:dDay", rc.35's "season:index"
     re-keyed on load) because the grid reuses rc.35's indexes in that
     season. Training no longer shows the season ceiling, "this cycle so
     far", "expected result" or "use the base". (i) The arc bot starts
     cycles as its players would (`startArcCycle`): "repeat" policies their
     Development package by hand while no coach plans, "delegate" the
     recommendation, the trainer with his coach's planning off.
     Measured (`CAREER_TRAINING=1`, P1 now pays the held part at each
     cycle's end; the ratio to the base at 13–19, p50, rc.35 → rc.36 on
     rc.35's base growth): a development package without a coach 1.14 →
     1.14, a generic 75 1.16–1.17 → 1.16–1.17, a generic 88 1.20 → 1.20, an
     ex-pro 99 1.19 → 1.20, heavy + hard + generic 88 1.32 → 1.33 (band
     1.10–1.35); nobody past his peak; scrims' share p90 16–18 → 17–18 %.
     P4 (coach 75/2): Heavy +1.9 points, three hard scrims a week +2.8,
     both +4.0 (the cap), Heavy + Easy +0.5 (rc.35: Hard alone +4.0, Heavy
     + Easy 0). In the flow (`careerTraining.rc36.test.ts`) a cycle's bar
     reads 80–95 % earned on its last day and the rest lands the next
     morning. Rejected:
     floating cycles from the start day (an idle container between cycles;
     the grid keeps "Cycle N of 8", the history and the coach's growth);
     holding part of the base too (a plan would grow slower than not
     picking along the way); the unpicked plan as a decision (a hold every
     four weeks for a default that is fine); a separate risk adder on top
     of wear (two systems for one effect); repeating a plan without a coach
     (Miguel: by hand).

R84. **HQ and the screens polished to Miguel's rc.35 playtest (rc.36 front
     H2, POL-02).** (a) HQ squad: the reserve and the coach are thin rows
     again (rc.33's shape) under the three starter cards, stacked on a phone
     and side by side from `sm`. The reserve: his OVR in the Draft's rarity
     frame (3-A), name, "New", role · age (the trait from `sm`) and the
     contract chip; a tap opens his sheet. The coach: Training's whistle,
     name, OVR and his training edge. An empty seat is a dashed row with the
     way to fill it. (b) The progression card leads with the next unlock;
     then a three-rung track (`HQ_LADDER_WINDOW` 3, a layout constant: five
     gave each name ~50 px at 360 px and PT's long words ran together), the
     items to buy as icon rows (no orphan tiles), and one footer row for
     "See more" and Finances. "See more" opens the whole ladder in a modal
     (`LadderGrid`), so the card never grows. (c) HQ finances: the balance,
     the weekly net ("the weekly out"), the Monday chart, and next payroll
     and runway as full-width lines (rc.35's tiles truncated at 360 px). No
     debt tile or loan badge: the loan keeps its own HQ card. `hqFinanceOf`
     still returns `debt` and `guaranteed`, unrendered, to stay clear of
     front M's "Merch & streams" edit; trim them after the merge. (d) The
     unlock announcement only informs: Close, no Buy, and "not bought yet:
     it waits in Progression". A row the manager taps keeps Buy (Gate 3a
     7-A). (e) Market: "Signable at my reputation" is a chip in the filter
     row again (rc.34's place), with its icon and count. (f) Finances'
     arsenal: every step stacked again (rc.34's list), each rail node its
     ladder icon badge (check, lock, the glow on the next buy); on a phone
     the price and Buy sit under the text. rc.35's track and "See more"
     leave Finances. (g) Club: the stars without the "0.5-star org" words,
     which stay their accessible name. (h) "Recommended": audited; the only
     tags are training's (front T2) and the wizard's (front B). No balance
     change. Rejected: Close only on a tapped row too (it undoes 7-A); the
     weekly expenses as "the weekly out" (the payroll line carries them);
     four or five rungs with hyphenated names.

R85. **Sponsors are picked in a pop-up and the deadline holds; the talk
     answers only the offer sent, a refusal raises his floor, every lever
     counts (rc.36 front S2; Miguel's rc.35 playtest, POL-03).** (a) HQ's
     decision block only prompts the sponsor choice (an icon, one chip per
     brand in its profile's colour, the deadline, "See the offers" and
     "Decide later" as a plain ghost button); the offers open in a pop-up
     (the shared Modal: portal, focus trap, Escape), one card per sponsor —
     the same cards on Finances — with the goal's difficulty as three
     horizontal bars again. (b) "No deal for now" is gone, so what a
     deadline does is keyed: `CAREER_SPONSOR.deadlineRule` "hold" (Claude's
     pick) keeps R71's rule — the deadline day holds the clock until a card
     is signed (a Steady deal has no fine, so no offer is worse than none);
     "signSafest" lets that day pass and signs the smallest-fine offer the
     day after, mailed. Rejected: signing for him by default (a silent money
     decision the queue exists to prevent) and lapsing (a "No deal" by
     another name). (c) rc.34's open decision 3 (Bold-only careers over the
     season-fines band): R82's `fines.seasonCapWeeks` did not settle it —
     the tally lived on each deal and a Bold deal lasts one split, so a run
     of Bold deals had a cap per split. `fines.seasonCapScope` "season"
     hands the ended deal's tally to the next offers (one cap a season);
     "deal" restores rc.35. Measured (`ECON_SPONSOR=bold`, EU, Normal +
     Hard, seed 9100, 14 careers × 8 seasons): s3 22 / 27 → 8 / 10 % of
     seasons (band ≤ 10 %), fines a season p90 $10.6k / $9.4k → $5.8k /
     $5.0k, insolvent 29 / 71 → 29 / 57 %. So decision 3 is settled as
     option C, on the deal's weekly pay (not payroll).
     (d) The talk (rc.35-(e), "count attempts?": yes): the levers only shape
     the offer, "Send offer" gets his answer, and the sheet shows the same
     thing whether he would sign or refuse (its money is the offer's, never
     his counter). Each refusal in a window raises what he needs for sure by
     `CAREER_NEGOTIATION.refusalRaisePct` 0.03 of his ask, counted
     `refusalsCounted` 3 times at most (≤ 9 %, never past his ask: paying it
     always signs), per player and window in the save's `negotiationTries`
     ("talk:{player}:{season}:{window}", pruned with the window, cleared at
     the rollover), so a reload cannot reset it; his roll stays the
     window's, so the same offer is never answered twice differently.
     Rejected: a fresh roll per send (at the cap a lowball could be resent
     until it landed) and raising his ask (the Market's price stays it).
     (e) Every lever counts: his odds read the offer's worth — the wage plus
     what the share and bonus are worth against his ask, unrounded — and
     under his ask a share or bonus press moves only itself (rc.35 moved the
     wage back, so his answer never changed); at his full ask they still
     trade against the wage. The length is a lever of the sheet (the offer
     keeps its place when it changes) and the sheet names what each lever is
     worth to him in $ a week (share, bonus, length, refusals). (f) rc.35-(d)
     kept: `emptySeatCountsOfferedBonus` true — the empty seat's waiver
     counts the bonus offered (more is the org's own money), and the sheet
     now says so (`fundsSeatBonus`); false reads the bonus he asks. The arc
     bot is unchanged: it signs at his ask and renews at his floor, both
     sure, so it is never refused.

R86. **One founding budget, no passive fanbase pay, prospects throughout
     the career, and a slower route to the same peak (rc.36, POL-04).**
     (a) Reverses R78's roster-sized budget: startingBudgetWeeks is null for
     every difficulty. Every roster starts with the preset's flat budget;
     foundingWagesFor fits its discounted founding wages to at least
     foundingFitWeeks 44 / 24 / 13 of that budget, with the normal salary
     floor. The engine owns the money formula; the wizard and creation use
     the same seeded roster and fitted deals. Existing saves keep their
     booked balance and signed contracts. (b) passivePerRepPoint 60 to 0;
     Finances drops the line. Old fanbase ledger entries remain readable;
     they are never erased or refunded. (c) After every seasonal intake each
     region replenishes its free-agent prospects to four with potential 81+
     and at least three points left to grow (bounded seeded rookie scan).
     The listing appends all competitive-age free-agent prospects with
     potential 80+ and three points of room, so the overall-ranked top 120
     cannot hide the new kids. The signable-player top-up still applies.
     (d) First pace lever approved by Miguel: generated peakAgeShift +1
     year, paceCurvature 2 to 1.5, seasonGainHardCap 13 to 8.5 and
     seasonCapSpread 2 to 1. Filler potential reads the unshifted peak:
     the same potential, reached later. Real players retain their historical
     peak. A strong package keeps growing each week instead of exhausting
     the cap early. The calibrated user pace uses the existing
     trainingWeeksPerYear denominator (40 to 50.25); opposition keeps its
     own weekly pace. Heavy scales the normal package boost by 1.3 instead
     of 1.5 to keep the development-package gain band. Potential and normal
     packages are unchanged. Match difficulty is unchanged. Final CAREER_GROWTH,
     CAREER_TRAINING, CAREER_ECON and CAREER_ARC measurements are integration
     gates; the Normal competitive target remains 0.44 Majors per season
     and Worlds in 16% of season rows. Final Normal measured 0.4562 /
     17.12%; the remaining difference is explicit for Gate 3b, not an exact
     target pass. The residual remains an explicit progression
     decision for this playtest. (e) rc.34 decisions 1/2 (loan rules),
     4 (EU spending policies), 5 (the wage budget), 7 (scouted bands) and
     9 (the older roster's rebuild) remain explicit Gate 3b choices.
     Their existing defaults are retained for the remeasurement; POL-04
     does not silently approve a different loan, band or wage-budget rule.

R87. **Season goals read the season; a visual news desk with its archive;
     the career's achievements in the general list (rc.36 front A; ROADMAP
     UX-02, UX-03, UX-05).** (a) The board's goal is set once at the season's
     start (the rollover, or the founding day) and never moves
     (`engine/career/seasonGoals.ts`, `seasonGoals.plan`). It reads the
     squad's level against its region (the sponsors' `TeamLevel`, difficulty
     edge included), its Community Cup draw and the Saturday qualifier's line
     (the region's 16th org), the career's stage (`targetAim` founding 0.6,
     rising 0.56, established 0.52 from `establishedRep` 40), its resources (a
     runway under `tightRunwayWeeks` 8 or a loan owed eases the aim by 0.04;
     26+ weeks raises it by 0.02) and last season's target (met −0.03, missed
     +0.05), clamped to 0.45–0.68. A goal counts over the season: Community
     Cup finals and titles (the newcomer's rung), Sunday regionals played,
     regional top 8, top 4 and titles, Majors qualified, a Major top 4 or
     title, Worlds. The target is the goal nearest the aim inside
     `targetBand` 0.40–0.75 that leaves room for a stretch; the stretch is
     the one nearest `stretchAim` 0.17 inside `stretchBand` 0.10–0.35, at
     least `stretchGap` 0.15 less likely. The model reads the level
     `seasonForm` 1.5 points up (squads grow 4.3 points p50 in a season; the
     likelihood peaks at 1.5–2), regional reach on its own curve against the
     qualifier's line (`reachCurve` mid −2, scale 4.5; the 12th org misread
     EU's deep pool), cups on a series logistic fitted on rc.35's series by
     gap (`cupSeries` mid −1.2, scale 1.8). HQ and the season review show
     both goals with an icon, a meter, the chances left, the dated deadline
     (the last event that can count) and the status, plus the board's
     reasons; a miss still costs `repRisk`, and the stretch settles too.
     (b) Measured (CAREER_GOALS, 252 seasons: 7 regions × 3 presets ×
     autopilot / tuned / youth × 4 seasons; GOALS_FIT replays the shipped
     settings): target met 63 % (Easy 70, Normal 56, Hard 63; founding 59,
     rising 63, established 66), stretch 29 % (37 / 23 / 29). SAM (78 / 47)
     and MENA (75 / 33) run high, NA (50 / 25) and EU (53 / 17) low; by
     manager, autopilot 40 %, tuned 69 %, youth 80 % (the board cannot see the
     growth ahead). (c) Miguel's rc.35-(b), decided by measurement: a
     Balanced split goal met in any split was met in 94 % of the same seasons
     (100 % of founding ones), its Bold stretch in 88 % — trivial.
     `CAREER_SEASON_GOAL.rule` "season" replaces it ("anySplit" keeps rc.35's
     path); an rc.35 save keeps its current season's goal and rule, and gets
     a plan at its next rollover. (d) HQ's feed (`news/NewsFeed.tsx`) leads
     with the freshest headline of priority 2+ from the last 7 days, then
     rows: the crests of the orgs it names, a short subject, the headline, a
     line of body and the action (the screen that handles it). A historical
     beat carries a `check` (`engine/career/beats.ts`: the org in the world
     and near the top of its region, the player still playing or not signed
     yet, a region's Major run this season); when the save contradicts it,
     the beat files "From the archive" with its real season, at priority 1,
     and its effect does not run. Real history the sim does not replay is
     `archiveOnly`: the LANs coming back (this timeline never lost them), the
     prodigy era, the salary boom, the old guard, and Miguel's example, FURIA
     fielding its roster in NA in 2022–23 (a new beat). Vitality signs zen
     only with Vitality in the world and zen still playing. FaZe plays from
     Season X in the dataset, so its beat is the Firstkiller signing; Moist
     entered a season earlier, so its preempted line no longer says
     "enters". (e) 50/50: `CAREER_NEWS.brand` "wire" | "fiftyFifty", "wire"
     until the partner agrees on material, naming and credit. The 50/50 desk
     shows its name, a logo slot (`partnerLogoSrc`, `public/partners/`,
     built to WebP like the other art; a styled fallback in the game's own
     chrome, never a redrawn mark) and a credit line saying the headlines
     are the game's own — never a quote in the partner's mouth. (f) UX-05:
     DESIGN-DECISIONS #155.

R88. **The weekend goes back to HQ, a coach briefing, Championship Sunday
     full-screen, following an event you are out of, the crest builder and
     the calendar (rc.36 front B: SUN-01..03, UX-04, CAL-01).** (a) SUN-01:
     once the user's Saturday is done — the qualifier won (`weekend` =
     {eventId, briefing: null}, set by finishEvent) or a Major / Worlds
     paused after its Swiss — the digest and the pause panel go back to HQ,
     and Saturday evening is a stop of the decision queue (kind "sunday",
     group 6 with the pause, no "Later"): +1 day, the batched Advance, the
     autoplay (continueKind "sunday") and a reload hold until HQ's "Start
     Sunday" (`careerSunday.startSundayFlow`) records the briefing and moves
     the clock exactly one day (`CAREER_SUNDAY.saturdayStop` true; false =
     rc.35's walk). The calendar's own dates: Sunday trains and pays nobody,
     nothing replays, no prize twice. A direct seed gets no stop; an rc.35
     save on that evening plays on as before (no record), a paused Major is
     the stop by itself. (b) The briefing, optional and shown upfront: keep
     the plan (no change — the default, and what starting without a pick
     means), recover (+0.25 team rating in every Sunday series,
     `briefing.recover.everySeries`), prepare for the opponent (+0.5 in the
     day's opening series, `briefing.prepare.opener`) — a per-round edge on
     the user's side (`sunday.sundayEdgeFor`), the frozen team untouched; a
     Bo5 at an even rating moves ≈ +3.5 / +7 points, under a bootcamp. The
     bot keeps the plan (`ArcPolicy.briefing` "keep": the arc measures the
     base career); analytics `ux_sunday_briefing`. (c) SUN-02: the
     Championship Sunday card is a short full-screen intro (a portal over
     the bar and the nav, scroll locked, pop-ups held; `sundayIntroMs` 4.2 →
     3.6 s), skippable, static under reduced motion, once per event, seeds
     only; the briefing rides as a chip. (d) SUN-03: an event the user is out
     of — their regional after a lost qualifier, a Major / Worlds without
     them — is kept compact when it resolves (`followEvent`, ~4 KB, one slot:
     the field, every series' score, the bracket); the eliminated Saturday
     offers Sunday without you (watch / results / skip, never holds), HQ
     offers a resolved one for `followCardDays` 2 days, /career/follow
     replays it a round every `followRoundMs` 1.6 s or shows the readable
     results; a Swiss exit picks watch / results / skip as Sunday starts.
     (e) UX-04: six shapes, eight symbols (a battle car, the ball, a wheel,
     a trophy, wings, a peak, a gem, chevrons), four patterns and a layout
     (emblem / emblem + letters / band) as a fourth crestId part; the
     procedural pool's lists stay frozen (every filler org keeps its crest)
     and every saved id renders as before. Presets fill both colours, each
     colour is free (the palette or any colour), the crest previews live
     (sticky on phones); the contrast guard (`CAREER_CREST.contrast`:
     pairMin 1.6, cardMin 1.25, fixMargin 1.25 — every kit clears both)
     warns and offers a one-tap fix, never a block; "Recommended" is the NEW
     pill. (f) CAL-01: the whole window blue (one band per row, its end date
     on the month), a tier icon per event, the event drawn over the band,
     the champion's crest in the day detail, no payroll marker on the
     calendar or HQ's week (Finances keeps it). Rejected: the batched
     Advance starting Sunday by itself (it skipped the briefing); a training
     day for the briefing (a weekend effect only); storing a followed
     event's whole TournamentState (~52 KB, the save's size again) or
     re-simulating it (the field moves after Sunday); rc.35's disabled
     low-contrast swatches (a silent block).

     Completion review: the full-screen intro also uses the shared dialog focus
     trap and restoration (Tab never enters the obscured navigation). Verification
     tools accept CHROME_PATH to reuse an installed Chrome/Edge; it changes no
     game dependency, save or hosting behavior.

R89. **Gate 3b visual consistency and interaction corrections (rc.36.1).**
     Miguel's rc.36 playtest replaces the decorative HQ track with three
     vertical item rows, purchases and next unlock below; compact finances,
     taller starters, smaller race tabs, simple goals, thin news and one lead.
     Neutral surfaces follow Squad/Market/Inbox/Draft; color is an accent.
     Calendar shows one navigable month and window-day chips keep blue strips.
     Training displays earned gain, a quiet counter/report and one-click repeat;
     past-cycle history is hidden. The bar's future segments and rounding
     caused misleading fill; presentation precision and animation are repaired,
     without changing growth/payouts. Sponsor offers open directly with the
     existing persisted deferral/deadline. Reducing bonus/share preserves the
     chosen wage, so it reduces offer worth instead of silently compensating.
     Crest uses predefined colors without contrast scoring; saved colors stay.
     Follow uses shared Swiss/bracket boards from recorded, reveal-safe rounds.
     This is a Gate 3b correction, not approval/start of Etapa 4.

R90. **Gate 3b accents, interaction and the economy playtest (rc.36.2).**
     Miguel's 31/10 feedback restores selective color and compact hierarchy,
     HQ bootcamp purchases, simple abandonment, weekly scrim recaps from actual
     records and quieter skips. Club palettes have strong/light pairs and subtle
     Latin club geometry, preserving saved IDs and procedural generation.
     Miguel chose the initial RLCS X rivals: sort numeric roster strength, no
     later FURIA boost. Every-org intake was already fixed in rc.33.
     Miguel approved +1 target/+2 stretch reputation once at review with normal
     cap/unlocks, and Sunday keep +.10, recover −.15 opener/+.35 later, prepare
     +.60 opener/−.15 later. No retroactive rewards or extra training/payroll.
     Requested economy experiment: common money index 1.15, renewal multiplier
     1.75/floor .60/core guard 2.5, coach curve 1.14. One matched six-career
     smoke is in ECONOMY-RC36-2-PLAYTEST.md; the prior 294-career pacing/bands
     are not claimed as remeasured. Compare sponsors per payment week because
     Steady's longer contract has a larger total/signing sum; prices unchanged.
     This remains Gate 3b, not approval/start of Etapa 4 or main publication.

R91. **Timing-first career playtest, weekly feedback (rc.36.3).**
     Miguel's 31/10 chat sets the direction: Normal regionals around split 3,
     first Major seasons 3–4, Major title late, Worlds in the final 2–3 of
     the six historical seasons. These replace the old early-Major aggregate
     anchors; never calendar locks or forced outcomes. Paired 98-career
     runs confirm early regionals/rep while late titles are already rare.
     Local band −1…+4, training unit 60, modest-result rep limits and a lower
     founding signing cap contain the opening; founding wages fit 32/18
     Normal/Hard weeks and sponsorship starts at rep 10. Potential, existing
     contracts, earned growth, saves, roster data and match profiles stay.
     Broad match hardening and faster star access were tested and rejected.
     Seven academy careers and 28 four-seed mixed careers add path coverage;
     63 finance-probe careers, growth and training probes complement them.
     The regional split-3 target and Worlds-title arc remain open, explicitly:
     CAREER-PACING-rc36-3.md includes non-achievers and separates infinite years.
     Unlocks notify without an automatic purchase sheet; manual purchases
     remain. Weekly real scrims appear beneath calendar controls. Fix the
     insert unlock announcement omission and rounded founding-payroll fit;
     explain the existing Monday credit-floor rescue rule, not a new loan.
     BALANCE_VERSION 8. Gate 3b stays open; no Etapa 4–6 work or main deploy.

R92. **Paid endgame evidence and stronger advanced support (rc.36.4).**
     Miguel's follow-up asks for an honest coverage audit, meaningful late
     unlocks, stacked crest/score scrims and distinct mail/news notices.
     Existing centre gains +1.5 competitive team rating, structured camp
     1 → 1.75, psychology Clutch/Consistency 1 → 3. Same costs, reputation
     gates, upkeep, temporary cap and signed contracts; no individual OVR
     grant. BALANCE_VERSION 9. Full paired 63-cell matrix plus 14 paired
     Normal/prospect careers use real paid support and all finance flows.
     None won a historical Worlds. Latest qualified fields replayed with
     identical roster/psychology/opponents isolate the new flat edge:
     Normal/prospects 0 → 21 titles over 768 draws per variant. This is
     conditional on qualification, not a human success estimate. Only 9/63
     and 6/14 own the final centre by S6; star purchases remain sparse.
     Do not call the game balanced or bypass costs to claim full equipment
     coverage. Next calibration isolates star affordability, access gates
     and regional timing; no blind global rep/growth/match nerf. Additional
     analysis/elite-camp/scouting unlocks are proposals, not implemented.
     News uses an editorial masthead/date/headline; mail envelope/sender;
     scrims stack under Advance with both crests and score, no extra sim.
     CAREER-ENDGAME-rc36-4.md records evidence; ROADMAP-NEXT-2026-10-31.md
     plans remaining packages only. Gate 3b stays open; no main deploy.

R93. **31/10 playtest follow-up (rc.36.5).**
     Miguel corrects the news typography: retain the game's identity, distinct
     through layout/blue accents. Slow career playback ~25% in duration;
     Skip secondary, +1 day tertiary, Instant result blue secondary. Prefer
     fresh weekly scrim opponents, occasional rematches (15% full-pool
     allowance), same-day exclusion. Cycle Continue repeats even with coach,
     Change opens editing, persisted automatic-report opt-out/re-enable.
     Team roster inspection throughout events/results, pausing playback;
     spectator Swiss games left/standings right. Clear coach gates; no Buy
     for owned/used progression. New sponsor profiles all three splits;
     legacy signed/quoted terms survive. Seasonal prizes grow in round tier
     steps, exact advertised/paid totals, all placements increase; preserve
     explicit rc31 rollback. Local annual rebasing was absorbing upgrades:
     retain a local origin, own growth capped at 1.5/year, current freezes
     preserved. 126 three-season careers + 8 six-season SAM/Normal/prospect
     careers isolate this local change under the same new finance rules.
     S1 identical in all 63 pairs; SAM first Major S6/S6/none/S4 → S4/S4/S6/S4.
     Not Miguel's actual save; regional and Worlds-title pacing stay open.
     BALANCE_VERSION 10; additive metadata/settings only. Gate 3b stays open,
     no Etapa 4–6 features/main deploy. CAREER-FEEDBACK-rc36-5.md.

R94. **03/11 career feedback and supplied catalogs (rc.36.6).**
     Miguel authorizes this correction package and staging publication.
     Calendar controls must honor the clock's real hold reason; hidden cycle
     reports still acknowledge and repeat the plan exactly once. Practices
     happen Tuesday/Wednesday, with brief playback of recorded results only;
     no new simulation or reward. Legacy Thursday bookings move forward.
     Spectator actions reduce to watch/results/calendar; failed qualification
     never removes the event. All window days have blue markers. HQ surfaces
     buyable upgrades and explains camps without a locked purchase action.
     50/50 presents public esports reporting using the supplied SVG; personal
     decisions use mail, routine technical chatter is silent. Load repair
     reclassifies prior communications. New 50/50/duds showmatches, rotating
     50/50 cup and rare selected-roster community 1v1/2v2 brackets; weekly
     random events start after the first regional. Official events stay 3v3.
     Workbook supplies 834 player/280 org names, with four exclusions. Seeded
     disjoint allocations share each regional bank across generic contexts.
     Five real-player collisions use II, three regional homonyms a region
     suffix. New worlds use nameBankVersion 3; legacy identities remain.
     Persist 3/saveVersion 5 frozen. BALANCE_VERSION 11. This does not close
     progression/economy acceptance or assert solved Worlds pacing. Next-chat
     plan: ROADMAP-NEXT-2026-11-03.md; Gate 3b remains open, no main deploy.

R95. **rc.36.7 — follow-up after published rc.36.6.**
     Miguel wants the practice detail in This week's scrims, no clock/banner,
     fast score reveals and no Skip stops. Preserve Tuesday/Wednesday seeded
     results and payouts. Window dates use an underline, one event icon.
     Add Newsroom / Central de notícias beside 50/50, partner art in news
     toasts/unattributed stories, clickable lead-story selection. Watching
     and continuing to calendar share weight in separate card positions.
     Qualifier lobby lists the direct eight beside participants using the
     same committed engine seeding; weekend roles gain distinct icons.
     Briefing changes from opener/later to Swiss/playoffs: Recover −.15/+.35,
     Prepare +.35/−.15, Continuity +.10/+.10. A post-Swiss choice affects
     remaining playoffs only, never retroactively. BALANCE_VERSION 12.
     Targeted regression 160 passed; types/lint/static export pass. Persist
     contracts unchanged. Still Gate 3b; no progression/economy acceptance.

R96. **rc.36.8 — small interactions and route transitions.**
     Miguel clarifies Advance: orange primary, dismiss the spectator offer
     and resume HQ daily autoplay, never navigate to Calendar. Articles expand
     at their list position; only row partner logos shrink. News toasts use
     resolved team crests; padded rails preserve mail rings. Scrims use 100ms
     game steps; spectator rounds gain 1x/2x/4x. Visual community roster cards
     live in the HQ offer/matchday and persist before acceptance. Single cups
     show their bracket centrally and in results. Departure guards prevent
     empty old-route flashes after mutation; offered fields preview correctly.
     BALANCE_VERSION 13. 141 targeted tests plus types/lint/static export pass;
     preview connection timed out, leaving visual staging acceptance open.

R97. **rc.36.9 — presentation and decision priority.**
     Miguel requests placement/rewards above the bracket, participants in the
     community side rail, and only one expanded article without repositioning
     it. Inserts preserve autoplay intent instead of switching it off; manual
     pause stays off. An unparked sponsor prompt has first priority globally,
     including over money/training popups and focused HQ decisions. Explicit
     Later retains its existing deadline/parking contract. Tests cover both
     Play states, sponsor priority and deferral. 167 affected tests, types,
     lint and static export pass. Browser preview timeout leaves visual
     acceptance on staging. BALANCE_VERSION 13 and saves unchanged.

R98. **rc.36.10 — spectator actions return to the timeline.**
     Miguel requests Watch only inside non-participant cards. Results is
     removed; the normal Play/Skip/+1 controls appear below. An eliminated
     Major/Worlds Swiss uses the same skipped-Sunday settlement before its
     chosen clock action. No forced watch or calendar navigation, no extra
     training/rewards. Existing Sunday/queue regression checks apply.

R99. **rc.37 integration — the emergency sale honours F1's two-window resale
     lock.** F2's emergency offer (cash below $0, inside a window, 65–80 % of
     value) and F1's resale lock were built in parallel: F2 read rc.35's
     same-window rule (`signedInWindow`), while F1 moved every sale to
     `market.resaleLocked`, none in the signing window nor the next
     (`CAREER_VALUATION.resaleLockWindows` 1; the Worlds window's next is the
     next preseason). The integration (ROADMAP-NEXT-2026-11-05 §3, round 2)
     keeps one lock for every exit: AI bids, the Blockbuster and the
     emergency offer (`careerFlow.rollEmergencySale` passes `resaleLocked(p,
     seasonIndex, day)`). Going red on purpose never reopens a fresh signing
     for resale; the first legal emergency offer comes two windows after the
     signing (exploit probe: ~68 % of value). The offer prices on F1's single
     valuation (`valueInputOf` + the career's growth model), like every bid.
     Sales stay AI-initiated (05/11 decision 14: no active sale). Test:
     `careerRc37Integration.test.ts`. BALANCE_VERSION 14; provisional until
     the battery report and Miguel's review.

R100. **rc.37 F6 — two ways to win: renewals climb faster, the ask curve is
     flatter (Miguel, 09/11).** The 06/11 battery (4,914 careers) had the
     youth path at 52 % Worlds titles on Normal and every other style at
     0–5 %: a formed prospect renewed at 2–5 % of his market ask, and a star
     cost more than any S1–S10 income, so nobody bought. Applied together:
     `CAREER_SALARY.renewalMaxJump` 2.5 → 4.0 with
     `CAREER_RENEWAL_TENURE.jumpMax` 3.0 → 5.0 (no value floor: 55/70/80 %
     and 30/45/60 % were measured and rejected, they erase the return on
     developing and reprice up to 38–54×), and `CAREER_SALARY.growthPerPoint`
     1.20 → 1.17. Paired triage (Normal, 147 careers): youth 52 % → 38 %,
     buying 0 % → 24 %, overall title 16 % → 15 %, bankruptcies 3 % → 2 %;
     youth ÷ best non-youth ~10× → 1.6×. Also rejected, measured: a cheaper
     transfer fee, a higher signing cap by reputation, a Worlds title
     defence by rating (+0.5 no effect, +1 bankrupts 8 % of champions) and
     `CAREER_AGE.growthMult` (it does not drive the growth contract).
     Existing saves: signed deals keep their wage; future asks, values, fees
     and renewals read the new numbers. Contract e2's snowball brake moves
     from ≤ 1.5 × to ≤ 2 × three 85s' wages. BALANCE_VERSION 16. Evidence:
     `docs/battery-rc37/F6-EXPERIMENTOS.md` (E1, E2, P1).

R101. **rc.37 F6 — the easy regions start slower; the slots and the deep
     pools stay (Miguel, 09/11).** SSA and APAC reached the Worlds in 100 %
     of Normal careers (median S1–S2) and then lost in the Swiss. Founders:
     `CAREER_REGION_FIELD.starterOvrOffset` SSA −4 / APAC −3 / OCE −2,
     overall and potential (so the Prospects headliner there sits under his
     EU twin); MENA stays 0 (a cheaper founding payroll became market there
     and the reach rose). Scene: `.shift` SSA +2.0 / APAC +1.5 / OCE +0.5,
     qualifier and regional AI sides only; Major and Worlds never read it.
     Paired (P2): first Worlds of SSA and APAC S2 → S3; reach by S10 APAC
     100 % → 67 %, SSA 100 % → 81 %. EU and NA are untouched on Normal
     ("the strongest pool is the hardest", Miguel). Founders apply to new
     careers; the scene applies from the next regional event of a save there.

R102. **rc.37 F6 — chemistry grows with time and official matches together,
     up to 100 %; heritage is only the base (Miguel, 09/11).** Until rc.38 a
     pair's connection stopped at `connMaxPerPair`, so a trio from three
     regions sat at 67 % for ever. Past the fast phase (two splits) each
     further split-unit together adds `CAREER_CHEMISTRY.bondPerSplitTogether`
     (0.10) until heritage + connection fills the pair, and every official
     series the fielded players play adds `officialSeriesCredit` (0.02) to
     their time together. The newcomer's grace covers the fast phase only:
     swapping one starter of a long-standing core costs 100 % → 78 % and is
     earned back (rc.38: nothing, once the core was old). Time together runs
     about five split-units a season, so a no-heritage trio is Perfect about
     four seasons in. Dose, measured on Normal against the battery (seed
     17019, 147 careers an arm; staging: Worlds titles 22 %, the youth path
     76 %, buying 0 %): no late phase 17 % / 52 % / 5 %; 0.10 21 % / 62 % /
     7 %; 0.15 25 % / 74 % / 10 % — the youth path keeps a mixed trio for
     years, so it gains most. 0.10 ships: the overall difficulty back at
     staging's, the youth path still cut. A counterpart on the Major /
     Worlds AI sides (`CAREER_REGION_FIELD.tierShift`, +0.5) was measured
     and rejected — on the whole package it only removed titles (10 % →
     6 %); the lever stays at 0.

R103. **rc.37 F6 — a three-player squad is ruled out too; a reserve only
     signs in a transfer window (Miguel, 09–10/11).** `CAREER_WORLD
     .unavailabilityWithoutReserve` "short": the pre-event roll no longer
     skips a squad without a reserve. With the starter out and nobody on the
     bench the team does not enter that event, whatever its tier — the hold
     card offers "Sit this event out" (and the Market only while a window is
     open); an absence is not an empty seat, so no free agent signs outside a
     window for it (a squad UNDER three keeps R67). Claude's calls: a
     career's first season is exempt for a squad without a reserve
     (`unavailabilityNoReserveGraceSeasons` 1), three players under contract
     still scrim, and the rate halves — `unavailabilityEventMult` 4 → 2 (4 %
     an official event, about one absence every two seasons): until rc.38
     nobody without a reserve felt the rate, and at 8 % it cost about one
     event a season and 8 pp of Worlds reach on Normal. The player is told
     before it can happen: the Squad screen's empty reserve slot, the help
     entry, a club mail at the start of the second season; the absence mail
     says there is no reserve and the missed event is a club mail. The audit
     bots keep a modest reserve from season two, signed in a window.
     "immune" restores rc.38.

R104. **rc.37 F6 — reputation in proportion to the org (Miguel, 09/11).**
     `CAREER_REP.proportional` replaces the flat soft cap (every gain halved
     from 60). Org tier = reputation gates passed (25 / 50 / 75); each result
     has a level (0 local cups and qualifier runs, 1 qualifier advance and
     regional top 8 / top 4, 2 regional title and Major berth, 3 Major
     results and the Worlds). At or above the org's tier a result pays in
     full, one level below half ROUNDED UP, further below nothing; a title
     never pays under 1. Rounding down was measured first and stalled mid
     orgs at ~50 (reputation at S10 67 → 46). As shipped: under 60 nothing
     of note changes; from 60 a contender keeps rc.38's +1 for getting
     through and earns titles, Majors and the Worlds whole (rc.38 half); an
     elite org (75+) stops earning from qualifiers and regional places. The
     season's Worlds champion no longer loses reputation to a missed season
     goal.

R105. **rc.37 F6 — the psychologist is a stronger hire; "recover" is the
     favourite's plan.** `CAREER_GEAR.psychologistStatBonus` +3/+3 → +5/+5,
     `psychologistPerSplit` 4,000 → 4,500 (Miguel, 10/11: 6,000 was 22 % of
     the payroll when she unlocks). Priced by match.ts Monte Carlo
     (`f6Probes.test.ts`) at +0.23 to +0.50 rating (rc.38 +0.13 to +0.31), a
     54–56 % series against an equal side. `CAREER_SUNDAY
     .championshipBriefing.recover.final` 0.4 → 0.6: on 0.4 "recover" never
     beat "keep"; on 0.6 it adds about one point of title chance for a
     favourite, and "prepare" stays the way through the quarter-final.

R106. **rc.37 F6 — rivals rise against a dynasty: a lever, off (Miguel
     decides the dose).** `CAREER_DYNASTY`: the `rivals` (3) strongest AI
     sides of the user's Major and Worlds fields gain `shiftPerTitle` per
     Worlds title the user won in the last `windowSeasons` (3), up to
     `maxShift` (3). Unlike the rejected title defence it leaves the early
     rounds and their prize alone and relaxes when the dynasty stops
     winning. `shiftPerTitle` 0 ships (rc.38 exactly).

R107. **rc.37 F6 — in the red the bank writes no ordinary loan (Miguel's
     staging playtest, 10/11).** The Monday credit offer (rc.37 F2) also
     came "when already negative", every cooldown, so a structural deficit
     chained ordinary loans and never reached the floor where the counted
     emergency loans end a career. `CAREER_BANK.blockedWhileNegative`: no
     voluntary loan — offer or Finances request — while the balance is below
     $0 (`bankLoanRefusal` "negative", its own line on Finances). The
     ordinary loan is for books still in the black; in the red the only
     bank money is the emergency loan at the floor, counted
     (`CAREER_LOAN.emergency.maxLoans`). The floor itself is unchanged.

R108. **rc.37 F6 — Hard reads the package through its own two scales.** The
     approved package (R100, R101) is neutral on Normal and broke Hard
     (battery-paired: Worlds titles 9 % → 1 %, insolvency 18 % → 27 %,
     hands-off prospects 64 %; APAC's Worlds reach 100 % → 0–14 %).
     `CAREER_RENEWAL_TENURE.jumpScaleByDifficulty.hard` 0.625 (rc.37's ×2.5
     / ×3.125 ladder: insolvency 23 % at ×4.0, 18 % at ×3.25, 11–14 % at
     ×2.5) and `CAREER_REGION_FIELD.shiftScaleByDifficulty.hard` 0 (no
     stronger scene; the founders' offset stays, because the wizard shows
     the roster before the difficulty is picked). The flatter ask curve
     stays on Hard: restoring 1.20 there did not help (titles 7 % → 2 %).

R109. **rc.39 / rc.39.1 — the RLCS 2027 lineups arrive in the infinite
     era's first season (Miguel, 10/11).** The game still ends in 2026: the timeline is
     the six seasons of `CAREER_SEASONS` and the labels do not change
     (season seven is still called "RLCS 2027"). The dataset's 2027 lineups
     are a late wave: `CAREER_WORLD.lateIntake` { `seasonId` "rlcs-2027",
     `atSeasonIndex` 6 } — at that rollover the orgs enter (the same rules
     as every dataset intake) and the preseason anchor pass seats the
     rosters with `anchorFidelity`; a player with a card of the wave does
     not retire before it. rc.39 shipped it at index 8 (the ninth career
     season, a misreading of "s9"); rc.39.1 puts it where Miguel meant, the
     first endless season, which the game already labels "RLCS 2027". His
     pacing target, restated the same day: a Worlds title should be
     winnable between 2026 and 2027 (seasons six and seven). One number
     moves it (`atSeasonIndex`), `enabled: false`
     removes it. Not done: the real players' card overalls still follow
     the calendar (a 2027 card reads from season seven on, as in rc.38):
     with the wave in season seven, rosters and ratings now arrive together.

## R110 — 10 November 2026: career feedback package (rc.40)

Miguel's 19-item request supersedes the earlier Later decision: incoming bids
and sponsorships must be accepted or declined before the clock advances.
The legacy park action refuses them, including already parked saves. Closing
a sponsor dialog leaves its decision pending; Decline is an explicit action.
Normal bank offers are inbox-only; emergency debt retains the popup.

Contracted signings open at reputation 20 as well as meeting the existing
overall rule. Direct regional seeds receive the coach briefing; a legacy save
already on Sunday answers on that same date. Coachless direct entries need
no new Saturday stop.

HQ progression contains direct purchases only. Coaches and sponsorships use
mail and their relevant screen markers. The requested visual/layout changes,
colours, loan readouts and partner events are mapped in CAREER-FEEDBACK-rc40.md.
Third crest colour and weekly growth baseline are additive save fields; the
emblem colour role is encoded as an optional fifth crest-id segment.

Historical title counting is RLCS-only, cut off before X: eight Worlds,
zero Majors, with the actual winning org and playing trio. Post-start results
are alternate history, recorded once per event with roster snapshots that
survive transfers/rollovers. Missing player rosters in older saves are never
invented; known org/user totals remain available. Sources: CAREER-HONORS-SOURCES.md.
The Duds Cup joins the existing invitational rotation. BALANCE_VERSION 18;
persist keys, persist version 3 and saveVersion 5 stay frozen.

## Still open for Miguel (career mode)

The design doc's §21 `[DECIDE]` list — the resolved ones (roster-churn tiers,
$1M Worlds pool, fixed-ask→negotiation, career→profile progression, mobile
6-nav, no manual saves, auto-train default ON, Season X alternate history) are
LOCKED and built. Remaining review items:

- **Beat corpus** — the ~30 hand-written scripted beats (EN+PT) for launch is
  the biggest content ask; currently a partial floor.
- **`born:` rows** for the ~150–200 modern-era players (ages are inferred
  today; §21.13 PT glossary tone check also pending).
- **Career pacing acceptance** — rc.36.3 adds split/season milestones;
  rc.36.4 adds the full paid-support matrix and controlled endgame replays.
  Regional timing, star affordability and historical Worlds titles still
  need calibration and Miguel's play.
- **First-guess tunables to confirm after playtests:** scrim chemistryCredit
  0.05 / xpWeeks 0.5, the daily-poach rates, the talk's flexibility floor 0.94 (rc.33, R64),
  the filler headliner band 77–84.


## 2026-11-09 — rc.38, Road Warrior correction

Miguel sets Road Warrior to four seasons with one org (enter season four,
zero-based seasonIndex >= 3), replacing three. Keep `car-three-seasons` as the
persisted achievement ID and historical XP entitlement, but correct its new
grant threshold/copy. The badge now reads the additive cosmetic-only
`car-four-seasons` fact, derived from saves on load/actions, because old
permanent achievement marks cannot prove four seasons. Do not reset keys,
replay XP, or infer four seasons from an unavailable/deleted save. Retiring
Underdog affects only the cosmetic; the career achievement remains historical.

## R111 — 10 November 2026: revision after rc.40

Remove club-inspired presets. Kits select two colours and preserve a separate third colour; third-colour emblems and supported patterns reveal its picker. Harmonize inset patterns and symbols. HQ hosts the title race below Inbox. Training recap measures the active cycle. Every open week offers a cup below the invitational reputation gate, or an invitational above it; remove the old rating/entry ceilings and random invitational absence. Future dates and Skip previews include them. Spectator Major/Worlds Sundays stop Skip without moving AI settlement earlier, including Worlds follow options at season review. Coach multiplier 0.8 applies only to training wear, not base illness. Store the real absence category; use No substitute and explicit transfer-window notices. BALANCE_VERSION 19; save schema remains additive.

## R112 — 10 November 2026: title race and card composition

Use the standard card heading/filter system for Chasing History. HQ is a short preview with the user's club; Standings contains the complete title ledger. Entity and competition filters are independent. Keep Club identity inside the left column, Reputation/Progression at the right top and paired card columns aligned at the bottom. Reward placement markers and compact partner art follow the game's existing icons. Redistribute finance summaries across three equally sized cards; debt belongs below left-column progression. Display-only changes: BALANCE_VERSION 19 and all save contracts unchanged.

## R113 — 10 November 2026: the bank lends in a shallow red (rc.43)

R107 refused every ordinary loan below zero, so the mailed offer arrived too late and the first help was the counted emergency loan. `CAREER_BANK.negativeDepthOfLimit` 0.5: the bank still writes the loan while the hole is within half the reputation limit. Offer by mail, emergency loan by pop-up (Miguel, 10/11). 0 restores rc.39.

## R114 — 10 November 2026: bids pay for youth and potential (rc.43)

R100's flatter ask curve cut an 85's value by about 30 % and every AI bid with it. `CAREER_TALENT.bidPremium` multiplies only the AI's bid for a user player: +20 % up to age 21, +4 % a point of reachable gap, +60 % at most. Asks, renewals and the user's own fees keep the shared valuation.

## R115 — 10 November 2026: regionals and qualifiers pay more (rc.43)

Regional $40k to $50k, qualifier $6k to $8k, tables unchanged (champion most, every place in proportion). +50 % measured no better on NA/EU/SAM Normal and doubled the easy regions' season-five cash. The snowball brake in contract.test moves from 2 to 2.15 × three 85s' wages (it reads 2.11); the dominants' cash in the battery did not rise.

## R116 — 10 November 2026: chemistry Perfect in about two seasons (rc.43)

`CAREER_CHEMISTRY.bondPerSplitTogether` 0.10 to 0.20 (Miguel, 10/11).

## R117 — 10 November 2026: Normal renews on Hard's ladder (rc.43)

R100's ×4.0 first jump raised the youth careers' payroll from season four with no income to match. ×3.25 left titles by 2027 at 1 in 63; ×2.5 (scale 0.625, at most ×3.125) gave 4. Easy keeps ×4.0. Open after launch: two simultaneous sponsors, a longer growth window (growth speed did not change between rc.38 and rc.39).

## R118 — 10 November 2026: real coaches and better ex-pros (rc.44)

Playtest (an experienced tester on staging): no real coaches to hire, ex-pros too weak, no good coach in the endgame. The dataset already holds 144 real coaches; the career never offered them. `CAREER_COACH_MARKET.staff` seats two a window (source "dataset", id `coach:staff:<personId>`), quality from the best coach card at or before the current season, capped by reputation (80 + 0.15 x rep) so the elite answers only a big club; gated at the ex-pros' rung. Ex-pro base 66 to 70. The shortlist is derived, never persisted: no save change. `staff.perWindow` 0 and base 66 restore rc.43.

## R119 — 10 November 2026: the bench grows, the squad fades slower (rc.44)

`CAREER_DEV.benchXpShare` 0.6: a reserve banks that share of the team's series XP (DEV-01 paid him none; he grew at half a starter's pace and aged out on the bench). `CAREER_AGE.trainingDeclineDampen` 0.7 to 0.55, user squad only. Not changed: the growth curve and the peak windows. The runs show starters reach their potential; growth already reads the distance to the peak and each player's own window. Open: the 2027 wave has no birth dates, so its ages are inferred young (13-17 at debut); real birthdays in the dataset fix it.

## R120 — 10 November 2026: support staff (rc.45)

Playtest: too few things to unlock and buy. Miguel chose four of six proposals (10/11): an opponent analyst, a physical trainer ("reduces wear in general"), a brand manager and an assistant coach. `CAREER_STAFF`: rolling retainers on the flat money index, on existing channels only (bench XP share, a playoff rating edge outside the temporary cap, the wear-risk multiplier, the sponsor decision's value multiplier). Gates 16 / 30 / 36 / 50, $1.5k / $3k / $3k / $2.5k a split. The brand manager multiplies the decision's value (x1.15) instead of adding a fourth offer: the three offers are one per risk profile. Not built: the regional scout and the academy. Not measured on Hard and Easy; doses are deliberately small and each has a switch (the role's number at its neutral value).

## R121 — 11 November 2026: elite talent costs more and signs later (rc.46)

Miguel won Worlds in 2025 on SAM Normal after signing nass early. `CAREER_TALENT.elite`: from a reachable top of 93 the shared valuation (fee, wage ask, AI bids, renewals' fresh ask) is multiplied by up to x2.2, and the reputation gate reads overall + 40 % of the gap to the potential while he grows (`economy.signingLevelOf`, read by `market.signableAtRep`). Chosen over a lower season growth cap (it would slow every prospect) and over a yearly wage step in multi-season deals (contract and screen work; open for after launch). Side effect measured: titles by season 10 on Normal 14 to 9 in the bots; watch it in the next playtest. valuePerPoint 0 and gateShare 0 restore rc.45.

## R122 — 11 November 2026: one sponsor goal per contract (rc.47)

Miguel: the goal must run for the contract, counted from the signature, not for one split. One goal, one bonus (the whole pot, paid later in the season) and one fine per contract; the fine cap is x3 (a contract covers three splits), still under the season cap. A Steady partner's patience is spent in proportion to the shortfall. Cash effect not measured in a battery.

## R123 — 11 November 2026: region moves follow the database (rc.47)

An org that changes region takes its roster only when at least two of its players are in the new region's lineup. Elevate leaves SAM for APAC with a new roster; FURIA goes to NA with its players and returns in 2024. The origin region keeps one org fewer; no filler replaces it.

## R124 — 11 November 2026: Season X has no Worlds (rc.47)

Cancelled by the pandemic: a headline on the Monday of W24, W32 empty. The qualified field is still computed and shown, without reputation change and without counting as a Worlds qualification.

## R125 — 11 November 2026: headlines and automatic sponsor bootcamps (rc.47)

`headline: true` marks bombshell news (HEADLINE_BEATS / KEYS / UNLOCKS in communications.ts); the UI opens each once. Non-purchasable unlocks announce through the progression ladder, so their mail copies do not open a second pop-up. A sponsor's free bootcamp starts on the first day of a split while an allowance remains.

## R126 — 11 November 2026: contracted players visible below reputation 20 (rc.47)

Listed and locked; the lock reads the higher of the contracted-market gate and the player's own reputation gate (rc.46 elite level).

## R127 — 11 November 2026: coaches have contracts (rc.47)

Two-season deals, renewed on the players' rule (raise cap and market floor on the coach's market wage) with no negotiation, for 1 to 3 seasons, from the coach card or the season's contract review; not renewed, he leaves at the rollover. Quality and experience grow slowly to a ceiling; professionals and former pros carry a source edge (`sourceEfficiency` 0 / 0.04 / 0.07); a hired coach never trains below `hiredFloor` 0.62 (DEV-03). All values provisional.

## R128 — 11 November 2026: the career pays profile XP (rc.47)

`CAREER_XP`: series 25 (+15 on a win), events 100–800, titles 200–5,000, a completed season 1,500, at most 10,000 a write. C2 proposed 50 / 30 a series for about 10k a season; halved because Skip simulates a season in minutes. Season Rating stays draft-only.

## R129 — 11 November 2026: elite talent signs at his overall again (rc.48)

Revises R121. Miguel judged the potential-based reputation gate too strict. `CAREER_TALENT.elite.gateShare` 0.4 to 0: `economy.signingLevelOf` returns the overall, so the gate is rc.45's. The elite price factor (up to x2.2) stays as the only brake on signing a nass early. The rule stays in code behind the knob. Not measured; the rc.46 numbers (titles by season 10 14 to 9) mixed both effects.

## R130 — 12 November 2026: a short region keeps 16-team events (rc.50)

A region with fewer than 16 organizations (an org moved away, R123) keeps 16-team qualifiers and regionals: local sides past the pool of 8 (`localOverflowRefs`) take the empty seats. The pool never changes; no org is created in its place. Found by P1: rc.47 to rc.49 stopped every career at season 3, day 26.

## R131 — 12 November 2026: one rule to start an event (rc.50)

`eventStartBlockOf` (not today, roster short, absent with no reserve) is read by `startEvent` and by the lobby; a refusal hands the same save back and the lobby shows "Sit this event out".

## R132 — 12 November 2026: no silent failure (rc.50)

A career flow that throws leaves the save untouched, sets `lastError` "actionFailed", stops the autoplay and reports `quality_save_error` (kind `action`). After any change to the career engine or store, run the soft-lock probe (`P1_SOFT=1 npx vitest run src/store/careerSoftlock.probe.test.ts`) before a staging publish.

## R133 — 12 November 2026: Rocket Street reaches a South American career from its first season (Season 1)

Revises the G1 addendum (the partner event as an invitational only). Miguel, playing SAM: almost no Rocket Street news and never the championship. Measured on `RS_PROBE=1` (`careerRocketStreet.probe.test.ts`; SAM, Normal, autopilot and tuned, 4 seeds, 3 seasons, 24 seasons in all): the championship was on the calendar in 0 of 16 seasons across the first two years and in 6 of 8 third seasons, because it replaced one invitational name and an invitational needs reputation 30, which a new org crosses in its third season; the desk signed 1.0 / 0 / 0 news items a season (one scripted beat; the rookie-class story names the first rookie of the world's list, never a South American).

The championship: `CAREER_ROCKET_STREET.cupAnchorWeeks` (7 and 27) are a SAM career's partner weeks. The week's open-week event keeps its id, day, tier, prize and field and takes the name and the region: a Community Cup below the gate, an Invitational above it, always 3v3. An anchor the name rotation gives to the 50/50 Community Cup or the Duds Cup Invitational moves to the next free open week of its split (`calendar.rocketStreetCupWeeksFor`). The old alias (the first invitational name in SAM) is gone. Other regions are unchanged.

The desk (`engine/career/rocketStreet.ts`, careers based in SAM only): the build-up on the championship's Monday (priority 2, a toast), its recap with the user's finish, a recap of about a third of the region's regionals (`regionalRecapChance`), the region's sides in each announced Major and Worlds field, a wrap of each transfer window with a SAM move, and the SAM rookie class when the world's headline rookie is from elsewhere. Each story has three lines per language; the line and the regionals covered come from derived streams (`gen:rsDesk:*`). Rocket Street also signs a SAM organisation that leaves the scene (`orgLeaves`). Transfers, an organisation entering or relocating, and the `s4-sam-worlds` beat keep the general desk, as in G1.

After, same probe: the championship offered and played twice in 24 of 24 seasons; 13.9 / 19.5 / 19.6 signed items a season (the rollover's four departing organisations and the rookie class included from the second season), about a fifth of the feed. No save field is added and no existing RNG draw moves: a career in progress keeps its results and gets the partner weeks and the desk from its next Monday; on a partner week a Community Cup that would have rolled 1v1 or 2v2 is played 3v3. All values provisional.

The 50/50 Community Cup (and every partner event) now keeps its logo on the playback header as well as on the lobby and the result.

## R134 — 17 November 2026: the career save has a copy in the account (v2.0.26)

Recorded in DESIGN-DECISIONS #165–#169, because it amends the rule on player saves: a copy per slot in `career_saves`, localStorage still the copy the game plays from, no merge, a notice when two copies differ, save files for guests, Staff accounts first.

## R135 — 17 November 2026: selling and trading on the user's initiative (closes ECO-06; reopens R63)

Miguel, 17/11 (ROADMAP-RTW-2026-11-17, Etapa 1): players ask to sell and to trade; until now a sale needed an AI bid to arrive. R63 (rc.33, ECO-12) withdrew rc.32's "List for sale" and left the question to ECO-06. This is the answer. It ships to `main` without waiting for the Etapa 1 gate.

**The transfer list.** The user lists a squad player with an asking fee between 70 % and 160 % of his market value (`CAREER_TRANSFER.listing.askRange`), two players at most. After 1 to 3 window days one org of his region answers (`engine/career/transferList.ts`): one that would field him, or, when none would, the funded org he is closest to, which takes him as depth (an unsolicited bid never checked the fit either, and a founding squad would otherwise never sell). An org without a wallet (prestige 0) only buys a player inside its own level. The org has a ceiling: market value × 0.85–1.15, one draw per player and window, plus half of the youth premium an unsolicited bid pays (R114). An ask at or under the ceiling is paid in full, an ask up to 25 % above it draws a counter-offer at the ceiling, a higher one gets no answer; with no funded org in his region the list says so. The ceiling does not move inside a window, so re-pricing never re-rolls it. On average it pays less than a poach (`aiBidRange` 1.0–1.35 with the full premium) and it never reaches a poach's top; the two bands overlap (a plain player lists for 0.85–1.15 of his value and is poached for 1.0–1.35): being wanted is worth more than asking. The answer is an ordinary bid (`pendingOffers`, `listed`): accepting it is the same atomic sale as R47, with the Backer's half while a debt is owed. Declining it ends the listing. rc.32's late signing does not come back.

**The trade.** The user proposes one of his players for a player of an AI org of the same region, with optional cash. The org answers after 1 to 3 days. It credits the user's player at market value × 0.85–1.05 (one draw per pair and window, half the youth premium) against the fee a plain buy of its player would cost. Credit plus cash covering the fee is a yes. A gap of up to 60 % of the fee comes back as a counter in cash. A larger gap is refused, and so is a player more than 8 overall below the one it gives up. The org never pays a difference (decision 7-A: no AI money). An agreed or countered trade waits for the user's yes or no and holds the clock like a bid (R110). Completing it is atomic: the user's player takes the other's seat on the org, the arrival passes every signing gate (reputation, elite, overall cap, payroll and floor checks), signs at his ask and takes the seat left open; no fee and no severance, only the cash.

**Rules kept.** Both work inside a transfer window only, never in the career's first window (R47), never for a player under the resale lock (rc.37 F1), and completing either waits for an event in progress. One trade proposal at a time. A listing or a proposal lapses at the window's close.

**Short tenure (new).** A player who signed less than one season ago is worth 60 % of the ceiling to a buyer and of a trade's credit (`shortTenureSeasons` 1, `shortTenureShare` 0.6). Why: a free agent costs no fee, so signing one into the reserve seat and listing him two windows later would sell him at about his full value, a repeatable profit the random bids never offered. Founders are not discounted. Developing a player for a season and selling him stays worth it.

**No buying back (new, from the pre-commit review).** A player the user sold or traded away does not sign for him again for one season (`buyBackLockSeasons`, `CareerSave.soldOn`, error "buyBack"). Why: his fee at his new org depends on the contract he was given (value × 0.7 + 0.15 per split left, 1 to 6 splits), so one time in six he costs 0.85 of his value; listing him at up to 1.15–1.5 and buying him back on a cheap day would pay the difference on demand. The lock covers every sale, an ordinary bid's included: before, the same loop existed but needed a bid to arrive. This is the one place where a career that never lists or trades can differ from before (re-signing a player it sold within the season is now refused).

**Saves.** Three additive fields, `transferList`, `tradeProposals` and `soldOn`, and two optional fields on an offer (`listed`, `ask`). Persist keys and versions are unchanged. The withdrawn `saleListings` field is still deleted on every load (R63), which is why the new list has another name. An older client ignores both fields and reads a listed offer as a plain bid. New RNG streams only (`listAnswerDay`, `listCeiling`, `listBuyer`, `tradeAnswerDay`, `tradeCredit`): a career that never lists or trades draws the same numbers as before.

**Analytics.** No new event (the event budget). A completed trade reports the departing player as a `sell` with fee 0.

Rejected: a guaranteed sale at a fixed share of value (rc.32's shape: no decision in the price); a trade the org tops up in cash (7-A); trades across regions (an AI roster is rebuilt from its own region); listing in the first window (R47). All values provisional; BALANCE_VERSION 36.

## R136 — 18 November 2026: the search pages open the founding wizard on its Quick start (v2.0.33)

Miguel, 18/11 ("faça tudo o que precisar fazer para garantirmos o melhor ranqueamento possível"). The career landing became the first page search visitors land on (17–18/11). Of those who reached the founding wizard from it, 42 % left: step 1 asks for three text fields before anything is shown, and the Quick start was a small button in its corner.

**Rule.** The landing offers two buttons (Miguel, 18/11: not sure the Quick start is the best idea, so both): the main one, "Found your club", opens the wizard at step 1 as before; the second, "Start with a random club", links to `/career?start=quick` (`lib/careerEntry.ts`). The guides' button opens `/career`. Which start founds more careers, and which keeps them playing, is read in PostHog from the `/career/new` pageview (with or without `?start=quick`) before either goes. `CareerShell` keeps the flag when it sends a player with no career to `/career/new`; the wizard then runs the Quick start once, exactly as its button does (a free random name and abbreviation, a random crest and buff, the Balanced roster, the default preset, step 5). The player still chooses the difficulty and presses Found; the progress dots go back to any step. A player who has a career lands on it, as before. A reload of the wizard with the flag rolls another club. After founding, the address bar can still read `/career?start=quick` (Next's router cache keeps the search of the `/career` entry it saw first); with a save the flag does nothing. Checked on a local export: landing → step 5 with a random club → found → HQ; the guide's button with a career → the hub.

**Unchanged.** The wizard's steps, the Quick start itself, the save, the seed (the same world the preview shows) and analytics: `career_created` has no new property; the entry shows in the `$pageview` URL (`?start=quick`).

Rejected: founding the club without the last step (the preset is the one choice that sets a career's economy, R59 and R68); a separate one-click route (two ways to found a club to keep in step).

## R137 — 20 de novembro de 2026: Etapa 1 aprovada (v2.1, Matchday + Mundo vivo)

Miguel, 20/11, sobre `docs/MATCHDAY-SPEC.md` e o roadmap de 17/11.

**Princípio.** O objetivo não é manter o jogo como está hoje, e sim deixá-lo **melhor sem quebrar**: nunca fácil demais, nunca difícil demais.
- Os dados reais do PostHog (`docs/ANALISE-POSTHOG-2026-11-20.md`) decidem o que é fácil ou difícil demais e definem as metas.
- `docs/BALANCE-BASELINE-v2.0.35.md` é a referência simulada: cada fatia roda de novo a mesma bateria para mostrar o que mexeu, junto com algumas travas duras de "não quebrar".
- Toda mudança de balanceamento entra atrás de uma flag em `FEATURES` (`balance.ts`) que a desliga.

**Matchday.** As fatias 1 a 3 estão aprovadas e precisam ser muito bem feitas, para que o comportamento do jogo e o balanceamento nunca quebrem. Há **dois jeitos de jogar**:
- **rápido**: o técnico decide o plano e as pausas, sem paradas;
- **personalizado**: plano antes da série e decisões entre os jogos.

O modo rápido só pode custar alguns pontos percentuais contra um bom jogo manual; a bateria mede isso.

**Fatia 4 (opção B, escolhida pelo Miguel em 20/11).** Súmula com momentos-chave:
- **Súmula:** gols, assistências, defesas, chutes, demolições, pontuação, nota de 0 a 10, MVP tirado dos números e estatísticas da temporada no elenco.
- **Momentos-chave:** de 2 a 4 frases curtas por jogo, só quando acontece algo notável (gol na prorrogação, virada de 0–2, hat-trick e parecidos).
- Todo momento-chave sai da súmula, então sempre bate com o resultado.
- **Sem** narração lance a lance e **sem** barra de embalo.

**Mundo vivo.**
- M1: a hipótese do Miguel é que as orgs grandes precisam continuar contratando bons jogadores novos para se manter relevantes.
- M2 precisa de especificação e bateria próprias antes de qualquer código, porque pode quebrar o balanceamento.
- M3 mantém as diferenças naturais entre regiões (umas mais fáceis, outras mais difíceis); só se corrige um ponto fora da curva real, sem quebrar a progressão natural.
- M4: as zebras continuam realistas, nunca demais.

**Próximas etapas.** As Etapas 2 (Pro) e 3 estão aprovadas em princípio, cada uma com especificação própria antes do código. A Etapa 4 (online e jogadores interagindo entre si) tem prioridade alta e é um diferencial importante.

## R138 — 20 de novembro de 2026: Matchday fatia 2, estilos e traços (v2.1.0-dev.3)

Implementação de `MATCHDAY-SPEC.md` §4–§5 atrás de `FEATURES.matchdayStyles` (desligada até o gate do Miguel). Desvios da especificação, todos por não mexer em `worldSim.ts` enquanto o M1 está aberto:
- **Estilo pelos atributos.** `MemberView` não traz o `archetype`, então o estilo sai só dos atributos de cada titular (contra a média do próprio jogador). Os pesos foram ajustados para que o deslocamento de cada arquétipo leve a um estilo (playmaker → Pressão, anchor → Contra-ataque, mechanical → Individual, icecold → Posse, veteranmind → Jogada em equipe). `MemberView.archetype` é opcional e passa a contar quando a integração preencher.
- **Traços pelo nome, sem o seed da carreira.** A chave é o nome do jogador mais um sal fixo: o mesmo jogador tem os mesmos traços em toda carreira. Um seed por carreira precisa que o `worldSim` passe id e seed.
- **Jogador de LAN não está ligado.** O motor lê `TournamentTeam.lanEvent`, que ninguém marca ainda: eventos só da IA nascem dentro do `worldSim.simulateAiEvent`, e marcar só os do usuário seria desigual.
- **Comportamento no bounce atual.** Líder, Temperamental e Sangue frio dobram o `momentumBounce` (±0,5) até o embalo da fatia 3.
- O ciclo de estilos é o proposto (pergunta P1 continua aberta).

## R139 — 20 November 2026: Mundo vivo M1, the world renews itself in the infinite seasons (v2.1.0-dev.2, flag off)

**Rule.** Behind `FEATURES.worldLife`, from the first infinite season (`CAREER_WORLD_LIFE`): strong orgs scout a near-ready prospect onto a reserve seat (he starts only when he beats the weakest starter, who moves to the bench and stays); a Local side that reached a Major or Worlds is signed at the rollover; a small org outside its region's top 12 for two seasons gives way to a new org; the local scene stays under its region's median − 2; coaches age and retire (the user's announces a season ahead in the Inbox and leaves only at a rollover; an AI org outside its top 10 may change coach after two seasons; retired ex-pros feed the jobs). Optional save fields only.

**Why.** Player survey: real orgs fade from Worlds in the infinite seasons. Diagnosis (docs/MUNDO-VIVO-M1.md): AI orgs signed by current overall only once the anchor pass ended, and the local ceiling grew with no tie to the world. Miguel (20/11): scouting must not drop a top org's overall; coaches need a life cycle.

**Measured.** S0–S5 identical with the flag on; top-4 overall above the flag-off world every season; Local sides at Worlds ~0. The endgame is not harder: the field's top falls ~3 points over six seasons either way, so Miguel's target 5 (title per Worlds ≤ 30–35 %) needs the top to hold (M2).

Rejected: scouting within 3 of the weakest starter (0.6 reserves a region, no measurable effect). A retiring AI coach's successor is at most 2 points worse, so a retirement never costs a top org its level (dataset coaches outclass the generated pool).

## R140 — 20 de novembro de 2026: Matchday fatia 3, plano, pausas, embalo e modos (v2.1.0-dev.5)

Implementação de `MATCHDAY-SPEC.md` §6–§7 e §9 atrás de `FEATURES.matchdayDecisions` (desligada até o gate do Miguel). Só motor e store; as telas são a fatia 5. Desvios e escolhas:
- **O embalo guarda o "reagir" do bounce.** O medidor (−2 a +2 por time, 0,75 ponto de rating por ponto, teto ±1,5) decai pela metade a cada jogo. Derrota comum deixa o perdedor em +2 (= o bounce antigo de 1,5); derrota na prorrogação dá +1 e goleada (3+ gols) dá 0: o time sai abalado. Vitória por goleada, na prorrogação ou de virada carrega o vencedor. Líder ergue o time depois de perder; Temperamental derruba depois de prorrogação ou goleada; Sangue frio amortece as quedas do próprio time e a reação do rival. Motivo: um medidor só de sequência de vitórias correlaciona os jogos e derruba o favorito de +2 abaixo dos 73%.
- **Timeout vale no máximo 0,75.** Zera o embalo positivo do adversário até 0,75 ponto de rating, sem bônus extra; um por série, só entre jogos.
- **Jogar fora do estilo natural custa** 0,5 × (encaixe natural − encaixe no estilo escolhido) por jogo, para a escolha ser uma troca. Marcar o jogador errado custa 0,15. Os dois somam no teto do plano (±0,4); plano, confronto, traços e briefing de domingo somam no teto de ±1,2 (o briefing passa a entrar ali, e não mais no rating; o analista continua no rating, como staff permanente).
- **Marcar** mira o "jogador de jogadas especiais" (`playmakerIndex`: o titular com mais mecânica + ataque). Marcar o certo corta 60% da chance da jogada especial do time (o proc de mecânica), com o mesmo sorteio.
- **Kickoff** multiplica a variação do jogo dos dois lados (seguro 0,85, agressivo 1,15), dentro de 0,7–1,3 com os traços.
- **"Deixar com o coach":** cada decisão (estilo, kickoff, marcação, timeout, ajuste depois de perder) sai certa com chance = qualidade do coach (overall 60 → 0, 90 → 1), por hash do seed da série, sem consumir RNG. Sem coach: plano padrão e nenhuma pausa. O coach não faz a troca.
- **IA:** estilo natural e plano padrão. Só na série do usuário, depois de perder um jogo, troca para o estilo que responde ao do usuário com chance 0,15 + 0,5 × qualidade (0,4 quando o montador não conhece o coach; `worldSim.ts` não foi tocado). Séries IA × IA da carreira usam o medidor no lugar do bounce, sem pausas.
- **Modos:** `prefs.matchdayMode` (ausente = rápido, carreiras novas e antigas) e `prefs.matchdayStopAt`. O personalizado para, por padrão, só nos playoffs e em eventos LAN (Major/Worlds); "toda série" é opcional.
- **Série do usuário no próprio seed** (`seriesSeed`) só em eventos marcados `activeEvent.matchday = 1` (iniciados com a flag ligada); um evento em andamento na atualização termina no motor antigo. No personalizado a rodada espera a série do usuário e é jogada quando ela termina; como a série não usa o RNG da rodada, o resto da rodada sai igual em qualquer ordem.
- **Troca:** o reserva entra no lugar de um titular para o resto da série, com o time remontado por `userTeamFor` (encaixe, química e traços mudam). `fieldedIds` (XP e estabilidade do elenco) não muda; a fatia 5 decide se o reserva recebe crédito.

## R141 — 20 de novembro de 2026: Matchday fatia 4, súmula e momentos-chave (v2.1.0-dev.9)

Implementação de `MATCHDAY-SPEC.md` §3 C e §8 (R137, opção B) atrás de `FEATURES.matchdayBoxScore` (desligada até o gate). Só motor e store. Escolhas:
- **Os gols são os do motor.** A súmula lê `GameResult.scorers` (o mesmo que a linha do tempo) e só inventa o resto (assistências, chutes, defesas, demos) em cima dos gols. Não há como mudar placar nem vencedor.
- **MVP da série = maior pontuação no jogo do vencedor** (desempate: nota média), no lugar do sorteio de `starName`. O `starName` continua nos dados antigos.
- **Momentos-chave**: 8 tipos por regra (prorrogação, virada de 2+, hat-trick, jogo decisivo sem sofrer gol, gol no fim, maratona de defesas, blitz de demos, e o gol que decide como complemento). Três variações de texto por tipo, nunca repetidas na série.
- **Estatísticas da temporada** no `CareerSave.boxStats` (opcional; persist version e `saveVersion` iguais): temporada atual e anterior, 12 jogadores. Entram quando o evento termina, a partir das séries do usuário. Chave pelo id do jogador.
- Sabor de estilo (com `matchdayStyles`): Pressão +2 demos, Posse tira 2 chutes do rival.

## R142 — 20 November 2026: Mundo vivo M2.1, the world grows (v2.1.0-dev.7, flag off)

**Decided by Miguel (20/11, on docs/MUNDO-VIVO-M2-SPEC.md).** (1) The full dose: the elite is held at its S6 level, as a `balance.ts` number (`eliteRenewal.baselineShare`) he can dial down after playing on staging. (2) Controlled renewal per region, not removing the 88 ceiling. (3) The user may sign a promoted prodigy; his region refills its baseline at the next rollover. (4) Superteams (lever b) later, as M2.2, only if the endgame stays easy on staging. (5) Refusing a poach costs salary only (×1.25) when M2.2 comes; morale belongs to Etapa 3. (6) Counter-style (lever d) after Matchday fatia 3, as M2.3. **Champion goal:** in the infinite seasons the Worlds should now and then go to a superteam from outside Europe (NRG, Spacestation, FURIA, Falcons), occasionally as in history, not parity; EU stays first on average.

**Rule.** Behind `FEATURES.worldLife`, from the first infinite rollover (`CAREER_WORLD_LIFE.eliteRenewal`): each region counts its active AI elite (potential ≥ 94, not declining; the user's players never count) into `world.eliteBaseline`. At every later rollover a region under its baseline promotes up to 2 young AI players (≤ 21, potential ≥ 85; contracted first, the readiest first) to a potential of 94–98 with a peak age fixed then (`world.potentialLift`); they grow at the normal pace. News: "X breaks out as a prodigy". Optional save fields only.

**Why.** The diagnosis in the spec: the dataset-era rookies are capped at potential 88, so nobody succeeded the 2027 stars and the top of the field fell ~3 points by S12.

**Measured** (10 careers, 16 seasons, flag off vs on). The Worlds field's best side in S10–S15: 95.3–97.0 off, 97.2–97.3 on (98.4 at S6). User at a fixed rating, Worlds title % in S10–S15: 97 → 38.8 off / 19.2 on; 99 → 73.8 / 54.6; 101 → 92.4 / 84.0. AI Worlds champions, S6–S15: EU 40 % off / 59 % on (history: 8 of 13 Worlds, 62 %); NA 16 / 21 %, MENA 28 / 13 %, SAM 13 / 6 %. S0–S5 identical, 0 soft locks.

Rejected: an extra lever for non-EU champions (the measured share outside Europe, 41 %, already matches history's 38 %; the flag-off world's 60 % was the decay, EU's old stars falling first). A stronger dose that holds the field's best at exactly its S6 rating (98.4) as well: the replay of that field puts a 99 team at ~31 % and a 101 team at ~70 %, against Miguel's guard that a 99–101 team must still win often. The dose stays a number (`baselineShare`, `perRegionPerSeason`) to tune on staging.

## R143 — 20 November 2026: Mundo vivo M3, an early regional ramp for EU and NA (v2.1.0-dev.8, flag off)

**Rule.** Behind `FEATURES.worldLife`: the AI sides of EU's and NA's qualifiers and regionals play `CAREER_REGION_FIELD.earlyShift` weaker (EU −5, NA −1.5; every other region 0), on Easy and Normal alike (scale 1; Hard 0). Full through seasonIndex 4 (T5), fading linearly to nothing at seasonIndex 9 (T10). Carried in `difficultyShift`: the players' ratings and the seeding never change; Major and Worlds never read it. No save field.

**Why.** Real players (PostHog, 20/11): a regional final by T5 in 1 % of EU Normal careers and 35 % of NA's, against 67–69 % elsewhere, and Easy barely helped EU (19 %). Every region starts with the same budget and founders, but the real EU field sits at 95–96 from the first season, 15 points above a new club at T3. It never reaches the first result that pays for its growth (docs/MUNDO-VIVO-M3.md). Miguel's targets (20/11): Normal by T5 EU ≥ 20 %, NA ≥ 40 %, other regions unchanged; Easy EU ≥ Normal + 20 points; Hard stays as it is; no region easier than a naturally easier one.

**Measured** (calibrated `strong` bot, 30 seeds, final by T5 / T7 / T9). Normal: EU 3/3/3 → 23/37/57 %; NA 23/33/37 → 43/57/60 %; SAM 57/60/67 % untouched. Easy: EU 10 → 50 %, NA 60 → ~90 %, SAM 97 %. Soft lock 0, bankruptcies 0.

Rejected:
- **Fade gone at T8 (goneAt 7):** a wall. The EU field rose from 92.4 to 95.2 while the user stayed at 87–88.
- **Gone at T11 (10):** no gain over T10.
- **NA −1.25:** 37 % by T5.
- **Easy ×1.2 / ×1.1:** Easy EU above Easy NA (80 against 73 at T5; 97 against 93 at T9).
- **A constant dose, no fade:** the EU regional became weaker than SAM's from S6.

## R144 — 20 de novembro de 2026: Matchday fatia 3, a IA planeja com o seu coach (v2.1.0-dev.6)

Miguel, 20/11, sobre os dois pontos abertos do R139:
- **Sem coach no modo rápido custa ~6 pp contra o bom manual: aceito.** Motivo dele: o rápido sem coach era igual ao jogo de hoje.
- **A IA também planeja, com o seu coach, exatamente como o "deixar com o coach" do usuário:** plano, timeout e ajustes, com qualidade proporcional ao coach, em IA × IA e IA × usuário, dentro dos mesmos tetos. Motivo: decidir não pode deixar o jogo mais fácil que hoje; só ser melhor que o adversário ajuda. Meta: rápido + coach médio contra IA com coach médio volta a ~50% em série igual; o bom manual guarda uma vantagem pequena (≈ +2–3 pp).

Implementação: `startSeries` dá a cada lado marcado sem plano o plano do seu coach (`coachPlanFor` com `aiQualityOf`, 0,4 quando o montador não conhece o coach); `simulateSeries` dá a pausa do coach (`coachBreakOn`) aos dois lados entre os jogos. As decisões fazem hash do cursor do RNG no início da série, então nenhum número extra é sorteado. Saem `aiAdjustBase` / `aiAdjustPerQuality` (a regra própria da IA na fatia 3).

**Consequência que volta para o Miguel:** com a IA planejando, o rápido sem coach deixa de ser igual a hoje; fica ~4 pp abaixo em série igual (45,9% contra 49,7%) e o favorito de +2 sem coach cai para ~72%. A premissa do primeiro ponto mudou com o segundo.

## R145 — 20 de novembro de 2026: Matchday fatia 3, piso de planejamento sem coach (v2.1.0-dev.10)

Decisão sobre os pontos do R144:
- **Sem coach, como no dev.6, não é aceitável:** o favorito de +2 sem coach caía para 71,8% (quebra a guarda de 73%) e a regra do Miguel é que o rápido sem coach não fique pior que hoje. Entra um **piso de planejamento**, `CAREER_MATCHDAY.coachlessQuality` = 0,3: um time sem coach, ou com coach abaixo disso, decide com essa qualidade (`planningQuality`), no plano e nas pausas. Medido com 0,25 e 0,3 (20 mil séries por célula): 0,25 fica 1,1–1,7 pp abaixo de hoje em série igual, fora do "cerca de 1 pp"; 0,3 iguala hoje. A diferença entre o coach médio e o sem coach é pequena por construção: o coach médio (0,4) precisa empatar com a IA média, e o sem coach precisa ficar perto de hoje. O coach bom (0,7) vale ~+3 pp.
- **XP do reserva que entra na troca:** fica como hoje (`fieldedIds` não muda), para não mexer no balanço do desenvolvimento nesta versão. Em aberto para o gate da Etapa 1.

## R146 — 21 de novembro de 2026: a divisão regional dos títulos do Worlds (v2.1.0-rc.4, `worldLife`)

Pedido do Miguel no gate do rc.3: "ajustar a dominância no fim de jogo. quando eu disse que a EU ganhava sempre, estava falando das seasons iniciais mesmo (1-8), não só do endless". Meta: a EU é a campeã mais frequente sem ganhar todo ano (50–60%), a NA disputa de verdade (25–35%), as outras regiões ganham às vezes (8–15% somadas), nenhuma região acima de ~60% em nenhuma janela.

Medição antes (`careerWorldTop.probe`, WORLDTOP=1, 10 carreiras: 5 regiões × 2 seeds, Normal, tudo ligado; Worlds só da IA, 100 por temporada; temporadas como o jogo mostra, `seasonIndex + 1`):
- Temporadas 1–8: **EU 79, NA 16, MENA 5, SAM 0,4**. A causa são as temporadas do dataset (o topo da EU é o mais fundo), onde nenhuma alavanca do Mundo vivo chega ao Worlds.
- Temporadas 10+: EU 49, NA 36, SAM 7, MENA 7. Com 10 carreiras a NA não domina: os 55% do rc.3 eram ruído de 5 carreiras. Fica como está (M2.1 já segura).

Decisão: **`CAREER_REGION_FIELD.worldsRegionShift`**, só no Worlds e só com `worldLife`: cada lado da IA ganha um ajuste de rating pela própria região (NA +1, EU −0,5, SAM +1,5, MENA +1, OCE/APAC/SSA +0,5), cheio até `seasonIndex` 5 e zerado em 8 (`worldsRegionShiftFade` 5/8). Vai no `difficultyShift` como os outros ajustes de campo: os jogadores, o seeding, as Majors, a escalada e o lado do usuário não mudam.
- Por que subir as outras em vez de só baixar a EU: EU −1,25 sozinha dava a mesma divisão, mas dobrava a chance de título de um time do usuário de 97 nas primeiras temporadas (S2 9 → 20%). Com a dose escolhida essa chance fica igual (média S1–S8: 14,2 → 14,4%).
- Braços medidos (S1–S8, Worlds da IA): A EU −1,5 / NA +0,5 → EU 51, NA 39, outras 10; B EU −1,25, SAM +1, MENA +0,5 → 58 / 26 / 16 (fácil demais para o usuário); C mais forte nas outras → 56 / 25 / 20; **D (escolhido) → EU 57, NA 30, MENA 10, SAM 3**.
- Guardas: os jogadores do mundo idênticos temporada a temporada (só a coluna do campo do Worlds se move); motor da partida intocado (+2/+5/+6 iguais); Draft intocado; 0 soft lock; vale igual em todas as dificuldades (Hard continua acima da Normal). Um ano isolado ainda pode ser de uma região só (S3 tem a EU em ~94%): é a janela que segue a meta.
- Rampa EU do M3 (40% de final regional até T5 na Normal) não mexida: não ajuda o Worlds e a NA ficaria abaixo de 40%.

## R147 — 21 de novembro de 2026: Matchday fatia 5, as telas (v2.1.0-rc.4)

Regras de tela que o motor não decide:
- **O resultado instantâneo nunca para**, nem no modo personalizado: quem escolhe "Resultado instantâneo" escolheu o técnico para o evento todo.
- **Voltar ao rápido com uma série aberta**: o técnico termina a série; os jogos já jogados valem.
- **A mesa (plano/pausa) toma o lugar do Match Center** enquanto o evento segura a série; os controles de reprodução somem nesse tempo. Uma série jogada na mesa não é reprisada: o banner e a súmula aparecem direto, e a reprodução para uma vez ali ("Retomar" pede a próxima rodada).
- **Sem técnico**, a etiqueta das escolhas pré-preenchidas é "Capitão" (o piso de planejamento do R145), e o botão é "Deixar com o capitão".
- A súmula abre aberta na série do usuário e fechada nas da IA. As estatísticas da temporada no elenco contam todas as séries do usuário (copas da comunidade incluídas), como `accumulateBoxStats` já fazia.

## R148 — 24 de novembro de 2026: a carreira no celular (v2.1.0-rc.5)

Parte do redesenho mobile (`docs/redesign/MOBILE-PLAN.md`, DESIGN-DECISIONS #178 a #182). Só abaixo de 640px; o desktop não muda.

- **Uma barra em cima, uma embaixo.** O cabeçalho do site deixa de ficar preso dentro da carreira (`html[data-career]`); a barra da carreira (data, avançar) gruda no topo e as abas viram a barra de baixo (`CareerTabBar`: QG, Elenco, Mercado, Treinos, Mais), no lugar do `<select>`. Calendário, Finanças, Classificação, Notícias, Clube e Saves ficam em "Mais"; o contador de e-mails não lidos aparece no "Mais".
- **Voltar ao menu fica sempre na tela**: uma seta à esquerda da barra da carreira (Miguel, 24/11: sentiu falta; a saída estava a três toques, dentro de "Mais"). "Voltar ao menu" continua em "Mais".
- **O QG no celular mostra só o essencial, e isto se afasta do HQ-CONTRACT H7** (que mandava a mesma ordem de blocos numa coluna): o dia, a caixa de entrada, um painel-resumo (`HubGlance`: elenco, treino, corrida e finanças com um número cada, dois por linha, e a progressão numa linha), a meta da temporada e a manchete com duas notícias. Cada célula abre a sua aba, onde o bloco inteiro vive. Os blocos completos de elenco, treino, corrida, finanças e progressão, a janela de transferências e a corrida pela história não aparecem no QG do celular. De 640px para cima o QG é o de sempre.
- **Nada de cards fechados na carreira.** A etapa 3 dobrou os blocos do QG e a etapa 4 os de Clube, Finanças, Treinos e Classificação; Miguel jogou e recusou (24/11): "focar em cada aba e deixar no QG só o mais importante". As abas ficam com tudo aberto, reordenadas: em Finanças, patrocinadores, movimentações e empréstimos vêm antes da escada de progressão (a maior da tela); no Clube, a reputação vem antes das conquistas, que mostram seis e uma tecla "Ver todas as 22".
- **Mercado**: as quatro abas cabem numa linha com rótulos curtos (Livres, Contrato, Coaches, Negócios); a lista é um quadro de linhas.
- **Treinos**: as opções do plano são linhas (o efeito aparece na opção escolhida) e o botão do plano fica grudado dentro do próprio quadro.
- **Dia de jogo**: prêmio, pontos e nível do campo são três linhas, não três caixas (os rótulos quebravam em três linhas).
- Um aviso por e-mail que aponta para `/career#career-progression` cai no topo do QG no celular (o bloco de progressão não está lá); a linha "Progressão" do painel leva à escada em Finanças.
- **Não feito:** celular real e Safari; a reprodução do evento mantém os controles acima da série; a tela de acompanhamento (Follow) não foi aberta.

## R149 — 24 de novembro de 2026: o gate da Etapa 1 fecha; a linha do staging acumula etapas (v2.1.0-rc.6)

Decisões do Miguel depois de jogar o rc.4 no staging:
- **Gate da Etapa 1 aprovado** (Matchday fatias 1–5, Mundo vivo M1/M2.1/M3, a divisão do Worlds do R146, a identidade nova).
- **As flags `matchdayStyles`, `matchdayDecisions`, `matchdayBoxScore` e `worldLife` ficam ligadas, mas só no staging** (`STAGING_BUILD`, `stagingFlags.test.ts`). Nada da Etapa 1 vai para `main` agora.
- **A linha do staging acumula etapas; `main` só quando o Miguel decidir.** A produção segue nas v2.0.x (hoje v2.0.36); cada v2.0.x que sair em `main` entra no staging por merge, nunca o contrário. O rc.5 é o rc.4 com a v2.0.36 dentro.
- **Hard EU sem final regional até a T5 (0 de 16) é aceito como está:** `earlyShiftScaleByDifficulty.hard` continua 0. A Hard não ganha rampa.
- **Próxima etapa = Pro (carreira de jogador, v2.2)**, antecipada conforme `PLANO-PROXIMO-NIVEL-2026-11-19.md` (E1, N1). **Frentes paralelas do Draft:** desafio por link e Daily com draft ótimo (E2). Cada frente sai de `origin/staging` em sessão própria e publica no staging por fast-forward.

Continuam abertos (não decididos no gate): o XP do reserva que entra na troca (`fieldedIds` não muda); confirmar a divisão do Worlds do R146 (EU 57 / NA 30 / outras 13 nas temporadas 1–8); as metas 3, 6 e 7 do gate; A7, a tab bar mobile da carreira; P1–P4 do `MATCHDAY-SPEC.md` §11 (ciclo de estilos, nomes dos traços, "Deixar com o coach" por padrão, limites da seção 7).

## R150 — 24 de novembro de 2026: Pro, a carreira de jogador (Etapa 2, v2.2; spec em PRO-SPEC.md)

Respostas do Miguel à versão 1 da spec, e o que vale daqui em diante:
- **Save próprio:** chave `rocket-draft:pro:v1`, três slots ao lado dos três do Manager; dá para ter carreiras de jogador e de manager ao mesmo tempo, mais de uma de cada. Cópia na conta só depois do gate (DESIGN-DECISIONS #185).
- **Começa aos 13 ou 14** (o RLCS aceita 13 desde 2024); as orgs quase nunca assinam antes dos 15.
- **Sem potencial fixo:** o teto é 99 para todo Pro; o quanto ele chega perto depende do treino, do descanso, do time e de um talento oculto da seed (×0,85 a ×1,15). Metas: talento alto e tudo certo 96-99 no pico; talento médio e tudo certo 90-93; sem cuidado 82-86. O declínio é tardio, gradual e explicado.
- **Estilo = os seis arquétipos** que o motor já lê; todas as regiões abertas, calibradas em NA/EU/SAM; as mesmas dificuldades do Manager; o Pro desloca um titular real quando assina.
- **Sem modo expresso** (as pessoas querem profundidade); o ritmo vem de atalhos (plano do técnico, repetir a semana, simular até o próximo jogo).
- **Um lance por jogo**, a medir no playtest. Cartão final por hash na URL e imagem por canvas.
- **Abertos:** gala e apelido (recomendado: os dois, na fatia 7); a saída Manager da ponte (recomendado: Etapa 3, com a carreira de coach). A v2.2 grava `bridge` e tem a saída Lenda.
- **Flag** `FEATURES.proCareer`, ligada só no staging como as da Etapa 1.

## R151 — 26 de novembro de 2026: começar numa organização real, e a troca de assento (v2.2.0-rc.5, `realOrgStart`)

Os rótulos R-BOARD-n desta e das duas próximas entradas seguem a numeração da rodada 2 do handoff do board (a rodada 1 usava outra); o R-BOARD-7 é da rodada 3.

- **Segunda porta do wizard:** região, organização, dificuldade, nome do manager. Cada card mostra estatura, rank do elenco, caixa, orçamento da temporada ao lado da folha, colocação esperada e a temporada de graça.
- **Estatura** (`engine/career/orgProfile.ts`, `CAREER_BOARD.stature`): rank do elenco na região mais o prestígio curado; vale a primeira regra que bater (elite: rank ≤ 2, ou ≤ 4 com prestígio 3; contender: ≤ 5 ou ≤ 7 com prestígio 2; mid: ≤ 10 ou ≤ 12 com prestígio 1; o resto é underdog). O ponto de partida vem de `CAREER_BOARD.profiles`: reputação 50/36/24/14, caixa de 10/10/12/14 semanas de folha, orçamento da temporada de 16/22/20/18 semanas (elite/contender/mid/underdog).
- **Troca de assento** (`engine/career/seatSwap.ts`): a org real sai do mundo, uma org de preenchimento ocupa o lugar (a contagem de times da IA não muda) e `world.userOrgRef` impede a volta. Os jogadores que o dataset mandaria depois para essa org ficam onde estão (R-BOARD-2). Um clube que o usuário deixa entra em `world.userBuiltRefs`: o passe de âncoras não puxa o histórico dele para dentro nem os jogadores dele para fora (R-BOARD-5).
- **Por quê:** o usuário assume o lugar da org sem duplicar nem apagar ninguém, e o mundo segue inteiro ao redor.
- **Medido:** com as flags desligadas uma carreira de seed fixa é idêntica ao rc.6 mais a correção do `formerSquad` (`careerBoard.flagOff.test.ts`; DESIGN-DECISIONS #186). Jogado no navegador no rc.3: o wizard a 375 px (parte a 320 px), PT e parte do EN.
- **Não verificado:** o wizard de tomada em EN e a 320 px; `competition.localOrigin` numa troca de região (cai ao trocar, sem teste de navegador); a escala de salários das tomadas de elite (o handoff da rodada 1 cita cerca de US$ 57k por semana na BDS, sem decisão).

Absorve R-BOARD-2 e R-BOARD-5.

## R152 — 26 de novembro de 2026: a diretoria, com pacotes, confiança, ultimato, demissão e clubes fundados (v2.2.0-rc.5, `board`)

- **Três pacotes por temporada** (`CAREER_BOARD.packages`): cautious (chance +0,14, orçamento ×0,85, bônus 2 semanas, +8/−14 de confiança), expected (0, ×1, bônus 4, +12/−18; pré-selecionado) e ambitious (−0,18, ×1,2, bônus 8, +18/−24). A proposta fica fixa depois de mostrada. O objetivo esportivo vira a meta da temporada (um cartão só, R-BOARD-3); há um objetivo secundário e, depois de título, um de legado sem pena (`legacy`).
- **Confiança** começa em 75 (`confidence`: aviso em 40, ultimato em 25, alta em 80), com cada mudança registrada e o motivo. Checkpoints nas semanas 11 e 21 (×20, limitado a ±5), título protege a temporada seguinte (+6 Major, +15 Worlds), dívida funda custa −6 e cada temporada nova devolve parte da diferença (`seasonRecovery`: diretoria 25 %, donos 50 %).
- **A escada:** aviso, ultimato (missão com chance-alvo 0,6 nos splits que restam; cumprida, a confiança volta a 45) e demissão **só numa revisão de temporada, depois de um ultimato falho** (R-BOARD-1). Sem ultimato na primeira temporada de diretoria numa org real e nas duas primeiras de um clube fundado (`graceSeasons` 1 e 2), então nunca há demissão na T1.
- **Confiança alta ou baixa:** o orçamento da temporada seguinte anda em passos de 0,1 (faixa 0,6–1,3), prorroga o contrato e paga um upgrade que o jogador escolhe; abaixo de 30 no veredito há corte de orçamento e uma janela sem contratar.
- **Clubes fundados** têm diretoria de "donos", mais branda (paciência 0,4, forma de objetivo +0,08, recuperação 50 %); saves antigos e clubes fundados ganham essa diretoria no próximo rollover, com confiança 100 (R-BOARD-4).
- **Medido** (rodada 3, 6 temporadas, N = 30 carreiras por linha, dificuldade Normal/Hard): demissões do bot competente 1/30 e 1/30 (contender na T6; elite na T5); do descuidado (badSponsor em Ambitious) 7/30 e 9/30, nas T4–6. Caixa na T6, mediana do competente: elite US$ 107–544k, contender 302–910k, mid 126–382k, underdog 54–220k, fundado 34–39k. 0 soft lock nas 120 carreiras. Antes (rodada 1, config antiga) o descuidado era demitido 9 de 12 nas T3–6; vale a medição nova.
- **Não verificado:** a tela da diretoria a 320 px (a 375 px passou no rc.3); o upgrade pago pela diretoria no navegador. **Proposto, não feito:** `seasonRecovery.board` 0,15 se o Miguel quiser o descuidado fora até a T4 (hoje mid e underdog descuidados quase não saem).

Absorve R-BOARD-1, R-BOARD-3 e R-BOARD-4.

## R153 — 26 de novembro de 2026: reputação do manager, ofertas de emprego e a mudança de clube (v2.2.0-rc.5, `board`)

- **Reputação do manager** (0–100, `engine/career/manager.ts`, `reputation.ts`; `CAREER_BOARD.manager`): começa em 30; objetivo cumprido +2/+4/+7 (cautious/expected/ambitious), falhado −3; título regional +1, Major +4, Worlds +10; demissão −8.
- **A demissão nunca encerra o save:** até 3 ofertas (`offersAfterDismissal`), uma sempre na região de casa, mais "fundar um clube novo". A estatura que pode oferecer depende da reputação (elite 65, contender 45, mid 25). O clube deixado continua no mundo com o elenco que o usuário montou.
- **Sondagem fora de temporada:** com reputação 55 e confiança 60 ou mais, 50 % de chance de uma org maior chamar (`manager.unsolicited`).
- **Por quê:** a demissão é consequência, não fim de jogo, e o histórico do manager passa a pesar no mercado de empregos.
- **Medido:** `BOARD_SOFT=1` (`careerBoard.softlock.test.ts`): um manager demitido que aceita uma oferta joga mais 2 temporadas, e uma sondagem aceita idem; os dois passam. A checagem de tomada, demissão e oferta rodou 2 de 2 no rc.4 com todas as flags ligadas. Jogado no navegador no rc.3, por saves gerados: ultimato, demissão com ofertas, aceitar uma e chegar.
- **Não verificado:** a sondagem não pedida e o wizard de tomada em EN e a 320 px no navegador (rc.3); o Hard no navegador. Esta entrada não repete os R-BOARD-6 a 10 da rodada 1 (fundação com 3 agentes livres, oferta só com 3 jogadores, contratos de 2–3 temporadas), que o handoff atual não lista; o código é a fonte.

Absorve R-BOARD-5 (a parte da volta do clube deixado).

## R154 — 26 de novembro de 2026: as chances do objetivo viram faixas em palavras, medidas por estatura (v2.2.0-rc.5, BALANCE_VERSION 51)

- **Decidido:** um objetivo da diretoria declara o recorde medido da sua meta para clubes da estatura e da dificuldade: `(cumpridas + k·prior) / (temporadas + k)`, com `goalRatesK` = 8 e o prior sendo o modelo calibrado de inclinação livre (`CAREER_BOARD.calibration`, `a + b·logit`; troca o ajuste só de deslocamento do R-BOARD-6).
- **Faixas, nunca percentual** (`CAREER_BOARD.bands`): Expected ≥ 65 %, Within reach 45–65 %, A stretch 25–45 %, A long shot < 25 %, em EN e PT. Aparecem no card do pacote, na página da diretoria (começo e "agora") e nos e-mails de checkpoint e ultimato. O checkpoint compara a chance de agora com a chance sem nada jogado, e a chance declarada leva o mesmo desvio.
- **Por quê (R-BOARD-7):** o modelo lê o nível do elenco, mas com as flags do staging clubes da mesma estatura cumprem a mesma meta em taxas muito diferentes das do modelo (elite subestimada, fundado superestimado). Um deslocamento logístico único não se sustentou fora da amostra (rodada 2); um recorde por meta e estatura sim.
- **Ajuste:** 88 carreiras competentes × 6 temporadas, seeds 9000/12000/12101/15000/20000/20101, todas as flags do staging com endless (`BOARD_FIT_FREE` + `BOARD_FIT_FROM`, linha GOALRATES).
- **Medido fora da amostra** (seeds 30000/30101, 120 carreiras, bot competente em Expected; N = temporadas de carreira no clube inicial, 35–36 por célula), declarado → medido: Normal elite 52→61, contender 52→44, mid 60→61, underdog 63→**92**, fundado 70→61; Hard elite 52→43, contender 55→69, mid 58→61, underdog 62→50, fundado 65→58. 8 de 10 células dentro de ±12 pontos; underdog Normal subestimada em 29 (mais fácil que o declarado) e contender Hard em 14. Nenhuma estatura passa de uma faixa de distância.
- **Faixas contra a medição** (3 pacotes, competente, N = 1077 objetivos): mesma faixa 65 %, faixa vizinha 34 %, duas ou mais 1 %. Cautious mede 61–100 % e Ambitious 28–64 %. O **descuidado** (badSponsor em Ambitious) cai bem abaixo: 35 % na mesma faixa e 34 % a duas ou mais; a chance declarada é a de um manager competente.
- **Não verificado:** telas no navegador e a 320 px; a Easy (sem células, lê o modelo bruto); T1 (N = 6 por célula, pequeno demais); células com menos de 40 registros apoiam-se no prior. **Proposto, não feito:** oferecer à underdog Normal o objetivo seguinte mais difícil, ou reajustar com mais seeds.

Absorve R-BOARD-6 (substituído) e R-BOARD-7.

## R155 — 26 de novembro de 2026: variedade nas temporadas infinitas, rodada 1: copas sorteadas, Legends, Intercontinental e sedes (v2.2.0-rc.5, `endlessVariety`)

- **Diagnóstico** (`careerEndless.probe.test.ts`, bot `strong`, Normal, NA/EU/SAM × 2 seeds, 14 temporadas; dois braços com o elenco forçado a 97 e 99 de overall desde a T6): com um time de 100+ o usuário ganhou 56 de 62 Worlds, com 0,8–1,4 lados da IA a até 3 pontos; o Invitational era o usuário mais os 7 primeiros da região, então havia só 2 adversários distintos de semifinal por temporada, um deles em 61–70 % das semis, e as temporadas só diferiam pelo nome da copa.
- **Copas** (R-ENDLESS-2): os 2 primeiros em pontos ficam, 5 vagas são sorteadas entre os lugares 3–12, e a chave junta cabeças 1–2 e sorteia o resto.
- **Legends** (R-ENDLESS-3): 2 semanas por temporada, para titulares de 93+; sete dos 18 melhores elencos de todos os tempos, nas cartas especiais deles; prêmio e reputação de t2, sem pontos. Na Easy vale o deslocamento usual da IA; na Normal e na Hard, nenhum.
- **Intercontinental** (R-ENDLESS-4): 2 semanas, com convidados do top 2 das outras regiões. **Sedes** (R-ENDLESS-5): quatro cidades por temporada, anunciadas nas notícias (`endlessHosts`).
- **Começa na T7** (`CAREER_ENDLESS.fromSeasonIndex` 7, a primeira sem elencos do dataset para ancorar). O save pega a flag no próximo rollover (`save.endless`); com a flag desligada a carreira tem o mesmo hash do rc.6 (`endlessFlagOff.test.ts`).
- **Medido** (rodada 1, 6 carreiras por braço, config anterior à rodada 2): adversários distintos de semi / semis 139/572 → 307/568 (braço 97) e 138/565 → 325/569 (braço 99); o adversário mais frequente caiu de 61–63 % para 35–38 %. As Legends da config final: 34 vencidas de 48 jogadas (braço 97) e 57 de 84 (braço 99).
- **Formatos de circuito por temporada: não construídos, por segurança.** `SCHEDULE` é uma constante; `CAREER_SLOTS` é lido direto por careerResults, raceTable, sponsorDeals, calendar, Standings e o Wizard; os nomes de Major vêm de `officialEventDefsForWeek`, que não recebe o save. Precisariam de um `slotsFor(save, kind)` antes, e um playoff de Major em eliminação simples perde as linhas de prêmio e pontos do top 6. Só as sedes entram.
- **Não verificado:** no navegador só passou, em save gerado (rc.3), uma T8 de endless com projetos rivais e um Legends Invitational jogado até o título; o handoff do endless não fez checagem de tela (a linha da ficha da org inclusive). O passo das "zebras" do plano original não foi construído.

Absorve R-ENDLESS-2 a R-ENDLESS-5.

## R156 — 26 de novembro de 2026: projetos rivais com a caixa de ferramentas do usuário, escala por dinastia, geração de elite e a oferta do projeto (v2.2.0-rc.5, `endlessVariety`)

- **A caixa de ferramentas** (R-ENDLESS-6): o kit de um projeto só tem o que o usuário pode comprar, lendo a configuração dele: instalações (pcs + perfCenter = bônus de org "+++" mais +1,5 do perfCenter), o melhor coach da região (troca), um reserva do banco como sub, um bootcamp (a nitidez do melhor campo, sob `tempRatingMax`) e um psicólogo (`psychologistStatBonus`). A compressão de superteam vale para o kit como para o usuário. A notícia do projeto nomeia o kit e a ficha da org mostra "Project, season n: …".
- **Escala por dinastia** (R-ENDLESS-7): o mundo responde ao campeão mundial em exercício enquanto ele está a 1 ponto (`holdSlack`) do topo; senão responde ao líder. Uma regra para o usuário e para a IA. A primeira defesa pede vantagem de 2 (`defenceFloor`); uma sequência de 2+ títulos é respondida enquanto durar; uma vantagem sem defesa é respondida a 2,5. Força = títulos seguidos (no mínimo 1), +1 com vantagem de 3 (`bigGap`) e +1 por ponto a mais, máximo 5. O kit tem 3 itens na força 1 e mais um por degrau. Os núcleos ficam juntos até 3 temporadas e um projeto que continua completa com uma contratação; dinastia quebrada recomeça do zero.
- **Por quê:** núcleos de uma temporada só não eram o motivo de os projetos pararem no teto (a química da IA já é cheia, ids de escalação compartilhados); faltava a caixa de ferramentas. `bigGap` 2,5 foi medido mais duro (um time de 100,7 ganhou 6 de 12) e ficou em 3; o braço r3 não vai.
- **Geração de elite** (R-ENDLESS-8): a partir de 2 Worlds seguidos, as promoções novas do M2.1 ganham +1 de potencial por título a mais (máximo +2, teto 99), só jogadores novos; notícia `endlessGeneration`.
- **Oferta do projeto, alavanca (c)** (R-ENDLESS-9): durante uma dinastia do usuário (2+ títulos) o projeto mais forte faz oferta pelo melhor titular dele, pela decisão de oferta comum, no máximo uma por janela, 15 % de chance por dia, valor = o topo de `aiBidRange` (1,0–1,35). Recusável (teste cobre).
- **Medido** (Normal, bot `strong` com o elenco forçado desde a T6, NA/EU/SAM × 2 seeds = 6 carreiras por braço; o braço 99 joga 16 temporadas): Worlds ganhos por times de 100+, 91 % (67/74) → **64 % (51/80)** agrupado; séries de Major e Worlds 96,5 → 88,1 % (97) e 95,5 → 87,4 % (99); lados da IA a até 3 pontos 0,8/1,2 → 2,2/2,7 (meta 3, **não atingida**). Hard, 3 carreiras: Worlds 11/12 → 10/12. Easy: 5/6 → 8/9. Bot sem piso, 6 carreiras: da T6 em diante Worlds 5/28 → 3/27 (dentro do ruído, apontando para baixo).
- **Não verificado:** configuração final = commit a0a75ec, mas os braços Normal rodaram em f367511 sem a alavanca (c); a rodada final com (c) parou em 3 de 6 carreiras (16/27 Worlds, séries 85,2 %, 2,9 lados a até 3; sem (c) as mesmas 3 deram 59 % e 85,8 %). A quinta defesa nunca foi alcançada (N = 4 no degrau mais fundo). Os caminhos de dinastia do usuário e de oferta do projeto só têm o teste `endlessFlow.test.ts`: a sonda de soft lock usa o bot sem piso. Se os projetos respondem a uma dinastia da org do próprio Pro: não observado.
- **Para o Miguel decidir:** manter que carreiras naturais enfrentem projetos que respondem a líderes da IA, ou responder só a dinastias do usuário; e o multiplicador da oferta (topo da faixa da IA, ou mais).

Absorve R-ENDLESS-1 (a base dos projetos, hoje em escala) e R-ENDLESS-6 a R-ENDLESS-9.

## R157 — 26 de novembro de 2026: Pro, o mundo roda num save hospedeiro (sem `worldTick.ts`) e o assento é reversível (v2.2.0-rc.5, `proCareer`)

- **Desvio da spec** (PRO-SPEC §12, fatia 3 previa `engine/career/worldTick.ts`): não foi extraído. As partes de mundo de `processDayArrival` estão entrelaçadas com a contabilidade do save, e o Pro precisa da máquina de eventos inteira. O mundo dele roda num `CareerSave` oculto, o hospedeiro, que compartilha o mundo, o relógio e a competição; `settleHost` responde as decisões que só existem no manager e o dinheiro fica no piso (`hostFloor`). O careerFlow ganhou um import e uma linha de gancho em `resolveAiEvent` (`onAiEvent`, `store/proHooks.ts`), só leitura (R-PROSPINE-1).
- **O elenco do hospedeiro sempre tem `pro:self`:** o mercado da IA, a idade e o crescimento do mundo nunca encostam nele (R-PROSPINE-2). Como amadores, um time local com dois companheiros do nível dele ocupa o assento "user" (`pro/team.ts`).
- **O assento da org** (`store/proSeat.ts`, R-PROSPINE-6): sob contrato a org dele toma o assento "user" do hospedeiro, sai de `world.orgs` com pontos, seeding e chaves remapeados, e **volta ao próprio ref** no fim da passagem e em volta de todo rollover; o crescimento dos jogadores vira deriva. Sem substituto de preenchimento e sem duplicata. A org mantém o técnico e os títulos de Major e Worlds dela voltam ao nome dela (rc.4; antes o registro de campeão lia "user").
- **As séries são jogadas** (rodada 2): o modo custom do Matchday do hospedeiro joga a série do lado dele jogo a jogo, com uma decisão por jogo; precisa de `FEATURES.matchdayDecisions`, senão o evento é simulado. No banco, a série é simulada com um relatório curto (a rodada 1 só revelava o resultado, R-PROSPINE-3).
- **Medido:** o manager do hospedeiro e o de verdade são idênticos: mesmo sha256 do baseline do rc.6 (NA Normal, seed 4242, 3 temporadas) com as flags desligadas e com todas as do staging ligadas, com o observador ligado ou não (`proSpine.managerIdentity.test.ts`). Bot do Pro (`PRO_BOT=1`, NA/EU/SAM × Normal/Hard, 5 temporadas): sem erro, sem dia travado, nunca dois elencos.
- **Não verificado / diferente da spec:** não há ponte para o manager (a saída Manager do §8, recomendada para a Etapa 3 com a carreira de coach); só a saída Legend. Na rodada 2 a org no assento jogava como o time do hospedeiro, sem modificador de técnico; o rc.4 diz que ela mantém o técnico, e o rc.4 vale.

Absorve R-PROSPINE-1, R-PROSPINE-2, R-PROSPINE-3 e R-PROSPINE-6.

## R158 — 26 de novembro de 2026: Pro, a semana, o ranqueado, as mecânicas e uma decisão por jogo, com limites (v2.2.0-rc.5, `proCareer`)

- **A semana** (`pro/week.ts`, `weekFlow.ts`; `CAREER_PRO_WEEK`): três blocos (terça, quinta, sexta), a semana fecha na segunda; custos de energia por bloco, descanso +35, +15 no fechamento, aviso abaixo de 45, energia baixa em 30. O burnout só pode sair numa semana que fecha abaixo de 30 com o aviso já aceso de uma semana anterior (R-PROENGINE-1); treinar, ranquear ou descansar mantém a linha e três treinos esgotam (R-PROENGINE-2). A confiança vem das últimas 5 notas.
- **Ranqueado** (`pro/ranked.ts`, `CAREER_PRO_RANKED`): 6 jogos de ±10 de MMR, decididos pela diferença entre o MMR que o overall dele (ajustado por forma e energia) merece e o MMR que ele tem (R-PROENGINE-3). O `skillTable` mudou duas vezes na calibração; a tabela de hoje sobe 53/55/57 de overall em 1500/2000/2400 de MMR e 66 em 2800.
- **Um lance por jogo** (`pro/moments.ts`, `CAREER_PRO_MOMENTS.bounds`): o efeito de um lance fica em 0,5 no time por jogo, 1,0 por série e 1,5 na nota por jogo. "No instinto" tem valor esperado zero: escala o acerto e o erro para que p·x = (1−p)·y, dentro dos limites (R-PROENGINE-6). Mecânicas de assinatura pedem blocos E atributo Mecânica, em ordem, e nunca se perdem (R-PROENGINE-7). A nota dele é `finalProRating` sobre a linha do box score.
- **Ritmo:** a rodada 2 fazia o Continue parar toda segunda para o plano (R-PROSPINE-9); depois da primeira semana confirmada o Continue passa a jogar o plano do técnico e para a cada 4 semanas com um resumo (`CAREER_PRO_PLAN.digestWeeks`) e em cada evento real (oferta, oferta perto de vencer, burnout, jogo, contrato, fim de temporada, subida de rank, mecânica nova). Planejar semana a semana é escolha guardada no save. Uma rodada de eliminatória dupla em que ele não joga corre em modo rápido (R-PROSPINE-8).
- **Medido:** Monte Carlo dos lances (milhares de seeds): os limites se sustentam; o instinto fica em |0,012| de média no time e |0,04| na nota.
- **Não verificado:** Web Share e o arquivo de download do cartão depois da mudança de títulos (rc.4); a série ao vivo, a barra fixa e a legenda da carta de decisão foram jogadas no navegador no rc.3 (375 px, parte a 320 px).

Absorve R-PROENGINE-1, R-PROENGINE-2, R-PROENGINE-3, R-PROENGINE-6, R-PROENGINE-7, R-PROSPINE-8 e R-PROSPINE-9.

## R159 — 26 de novembro de 2026: Pro, ofertas, rotação e vaga de titular (v2.2.0-rc.5, `proCareer`)

- **Convites amadores** abrem no ranqueado Grand Champion ou no overall 54 (R-PROSPINE-5); a bateria desceu `inviteOverall` para 50,8, `firstInviteWeek` de 3 para 6 e criou `inviteAfterWeeks` 20 (um Pro descuidado também recebe o primeiro convite na T1). Sem convites sob contrato nem de um time recusado na temporada.
- **Ofertas de orgs reais** (`pro/offers.ts`, `CAREER_PRO_ORG`): orgs da região dele, a partir dos 14 anos, com um motivo que cita dados do save, guardadas uma vez e vencendo com a janela; até 3 ofertas; uma contraproposta com o risco à mostra (`counterRaise` 0,2, `counterRisk` 0,25 mais 0,08 por prestígio). Um acordo "1 temporada" assinado depois da janela de pré-temporada vale pela temporada seguinte (R-PROSPINE-4). Orgs que o dataset encerra na temporada seguinte não oferecem e, perto do fim, dizem "incerto".
- **Papel pela metade da tabela** (R-PROSPINE-7): a metade de baixo oferece vaga de titular, a de cima oferece rotação; aos 15–16 sai uma oferta de titular quando ele alcança a barra de uma org da metade de baixo. A margem para titular e a rotação agora variam por dificuldade (R-PROSPINE-12, `CAREER_PRO_ORG.byDifficulty`): Easy margem 0 e uma partida a cada 2, Normal 1 e 3, Hard 3 e 4. O talento do jogador não muda com a dificuldade ("nunca um jogador mais fraco"): muda o duelo pela vaga e os resultados.
- **Rotação:** joga um evento em três (na Normal), dito na oferta e na aba Time com contagem regressiva; o papel é revisto depois de 6 séries (`reviewAfter`, `promoteRating` 6,8), com confiança do técnico, pedido de transferência (custa 10 de confiança) e renovação na semana 23.
- **Medido** (bateria no fluxo real, bots, NA/EU/SAM; N 12 para a média gerida na Normal e na Hard, 6 nos outros): primeira org aos 15 (14–15 com talento alto); da rotação ao titular em 83 % das carreiras médias geridas; primeiro convite nas semanas 6–10 da T1 (descuidado: 20); um time amador novo vence 43 % das copas da primeira temporada (era 31 %). Títulos por carreira (mediana da média gerida): 4,5 na Hard contra 13 na Normal, sem título de Worlds na Hard.
- **Não verificado:** o primeiro org de uma carreira jogada à mão (o bot assina aos 15 pelo plano do técnico; a carreira à mão da rodada 1 é anterior à forma das ofertas). Da primeira passada no navegador (PROQA, contra o rc.1) ficou como decisão conhecida, sem correção registrada depois: orgs que saem de cena em uma ou duas temporadas ("Team Secret left the scene", duas vezes numa carreira) e parecem um bug.

Absorve R-PROSPINE-4, R-PROSPINE-5, R-PROSPINE-7 e R-PROSPINE-12.

## R160 — 26 de novembro de 2026: Pro, idade, aposentadoria, gala, apelidos e o cartão (v2.2.0-rc.5, `proCareer`)

- **Idade** (`pro/aging.ts`, `CAREER_PRO_AGING`): o declínio começa na temporada depois de um ano de platô; experiência segura 3 anos a mais e clutch 2 (R-PROENGINE-8); toda mudança tem um motivo. **Aposentadoria** por idade (forçada aos 32), por escolha (com confirmação, tela de despedida e aviso na última temporada, rc.4) ou **oferecida** depois de um ano sem contrato, nunca forçada (R-PROENGINE-5; decisão (a) da rodada 2). A ponte `bridge` só tem a saída Legend.
- **Gala** (`pro/gala.ts`, `store/proGala.ts`): MVP (overall 70+), revelação (até 20 anos, até 2 temporadas de Pro, +2 de overall), time da temporada (3) e **o mais decisivo**, que exige uma linha de box score com 10+ jogos e (MVPs de série + lances decisivos) por jogo de 0,3 ou mais. A spine entrega todo jogador de elenco com a linha dele, mas **não existe dado de lance decisivo no fluxo real, então o prêmio de mais decisivo nunca é dado**. O Pro é candidato normal (`honorsOf`: vencedor ou indicado). O rc.4 mostra a gala na tela de fim de temporada; antes eram só linhas do inbox.
- **Apelidos** (`pro/nickname.ts`): 12, a partir de totais que o save guarda (defesas, títulos de LAN, vitórias decisivas, jogos de clutch, Worlds, temporadas na org, assistências, gols, demolições, viradas, temporadas estáveis, prodígio). Um apelido usado fica, a menos que um de ranking melhor seja conquistado; o id mora em `ProPlayer.nickname`. **Nomes e limiares são de primeira passada.**
- **O cartão** (`/career/pro/card#<payload>`, `pro/card.ts`): leva só chaves sem idioma (id do apelido, `mvp.world.2026` por `awardKey`) e a página traduz em EN/PT; não leva Lendas, a página calcula o ranking de todos os tempos (melhor overall de carta por jogador real) do dataset ao carregar (R-PROENGINE-9). Títulos em ordem Worlds, Majors, regionais, o resto, depois recência, repetidos recolhidos; a carreira guarda 120 (antes 40 descartavam Worlds antigos); conta todas as orgs.
- **Medido:** payload de ida e volta em todas as carreiras de bot das sondas; as faixas do ciclo de vida são testes (`lifecycle.test.ts`).
- **Não verificado:** entradas de gala e apelido contra dados reais de mundo (só testes); o cartão com títulos baixado e aberto, o Web Share, a página do cartão em PT, a confirmação de aposentadoria por escolha e a despedida a 320 px no navegador. Dois itens do PROQA seguem sem motor: o cartão mostrou "Orgs: None yet" depois de um ano numa org (a spine da rodada 2 diz que passou a contar todas) e o MMR 2880 com overall 71 parece alto.

Absorve R-PROENGINE-5, R-PROENGINE-8 e R-PROENGINE-9.

## R161 — 26 de novembro de 2026: Pro, a calibração no fluxo real e o que ficou fora da faixa (v2.2.0-rc.5, BALANCE_VERSION 51)

- **Metas** (PRO-SPEC §4.1 e §13): talento alto bem conduzido 96–99 no pico, médio 90–93, sem cuidado 82–86; primeira org aos 15–16; Worlds jogado em cerca de 40 % das carreiras médias bem conduzidas.
- **Primeiro nos módulos puros** (permissão (b) da rodada 2): `growth.perBlock` 0,7 → 0,5, `ageBands` {17: 1, 20: 0,85, 23: 0,6} → {17: 1, 19: 0,3, 21: 0,1}, `beforePeak` 0,35 → 0,05, `afterPeak` 0,1 → 0,03, `gapExponent` 0,7 → 0,92, `gapFloor` 0,12 → 0,03, `talentRange` [0,85; 1,15] → [0,78; 1,25], `matchXp.base` 0,5 → 1,0. Resultado com o bot (10 seeds): alto gerido 96,5, médio gerido 92,8, médio descuidado 85,2, todos dentro da meta.
- **No fluxo real o pico fugiu** (quatro corridas de bot: 94–99 aos 27–28 e 10–22 títulos na Normal). Causa: o XP de partida. Um titular joga 60–100 séries oficiais por temporada no calendário real, e o modelo puro supunha cerca de 9; o XP de partida era 64–71 % de todo o ganho, achatava os talentos e o mantinha crescendo até os 27, e um Pro descuidado nunca chegava a um time.
- **Valores** (antes → depois): `growth.afterPeak` 0,03 → 0,01; `CAREER_PRO_TEAM.inviteOverall` 54 → 50,8 e `firstInviteWeek` 3 → 6; novos `matchXpFullSeries` 25, `matchXpTalentExp` 2, `inviteAfterWeeks` 20, `localAnchorEdge` 1,5; `CAREER_PRO_ORG.byDifficulty` (R159) e `CAREER_PRO_PLAN.digestWeeks` 4. As séries de uma temporada ensinam por inteiro até 25 × talento² (linear abaixo de 1) e depois com peso 1/n; a vantagem de âncora centra as copas no nível dele (R-PROSPINE-10 e R-PROSPINE-11).
- **Medido** (bots, 13 a 29 anos, NA/EU/SAM, talento fixo 0,82/1,0/1,2, Normal salvo indicação; N 12 para médio gerido na Normal e na Hard, 6 nos outros), pico mediano [faixa], idade do pico, Worlds jogado / ganho: médio gerido 92,1 [90,6–93,7], 22,5, 92 % / 8 %; médio gerido Hard 92,0 [89,2–93,5], 24, 83 % / 0 %; alto gerido 97,2 [96,1–99], 24, 100 % / 33 %; baixo gerido 85,3 [82,4–85,9], 21, 33 % / 0 %; médio descuidado 82,2 [77,2–84,1], 25, 67 % / 0 %. Majors ganhos: 0 de mediana nos médios, 0,5 [0–3] no alto.
- **Dentro da meta:** picos de médio gerido, alto gerido e descuidado; primeira org aos 15; titular em 83 % das médias geridas.
- **Fora da faixa, deixado como está para o Miguel julgar:** (1) **92 % das carreiras médias geridas jogam um Worlds** (meta cerca de 40 %): um jogador de 90+ puxa qualquer time para o campo, e o peso de um jogador no rating do time é do motor inteiro; (2) o talento alto segura 98–99 até os 25–28 em vez de cair a partir dos 24 (maior ganho de uma temporada depois do pico: 0,5–0,7); (3) cerca de 13 títulos por carreira na média gerida. O técnico quase não pesa: 85 contra nenhum move o pico médio 0,4 (92,8 contra 92,4, nos módulos puros); `coachMax` 0,2 é a alavanca. O descuidado só chega perto de 85 porque o XP de partida é generoso; se as séries parecerem recompensadoras demais, baixar `matchXp.base` e subir `perBlock`.
- **Não verificado:** a bateria rodou sem as flags `board` e `realOrgStart`; a corrida com todas as flags (NA, EU, SAM, Normal, 13 até a aposentadoria: sem erro, sem dia travado) usou números anteriores ao último ajuste do talento baixo. As corridas NA e EU Normal da sonda deram a mesma linha de carreira (mesma seed, pico 99,0 aos 25, 10 Worlds, 32 títulos), então a região pode não chegar ao Pro nessa sonda e as células EU da bateria podem repetir a NA. Os projetos do endless nunca dispararam num Pro (os reinados de 5 temporadas caíram antes da "temporada 12" do handoff; o código diz `fromSeasonIndex` 7, não reconciliado). Trechos mais vazios de uma carreira Pro: rotação aos 15–17 (31 séries por temporada, quase todas do banco), amador (63 séries das mesmas copas), titular a partir dos 22 (74 séries, 70 de 81 temporadas sem título).

Absorve R-PROSPINE-10, R-PROSPINE-11 e as decisões (a) e (b) da rodada 2 do PROENGINE.

## R162 — 26 de novembro de 2026: a diretoria fica inerte no hospedeiro do Pro, e a integração roda as sondas do manager e do Pro com todas as flags juntas (v2.2.0-rc.5)

- **O bloqueio do rc.2:** com `FEATURES.board` ligada, uma carreira Pro não avançava um único dia: o hospedeiro recebia a decisão de pacote da diretoria da temporada, que segura o relógio, e o `settleHost` não a respondia. **Causa raiz:** os testes do Pro rodavam sem a flag da diretoria e a integração rodou só a sonda de soft lock do manager, então nada cobria as duas juntas.
- **Decidido:** a diretoria é inerte no hospedeiro (`CareerSave.proHost`, gravado na criação): sem diretoria, sem registro de manager, sem pacote, checkpoint, ultimato, demissão nem ofertas. Um projeto rival nunca faz oferta por jogadores do hospedeiro. O `settleHost` tira a diretoria de um hospedeiro criado no rc.2 e estaciona qualquer tipo de decisão que não conheça. Teste de regressão: `proAllFlags.test.ts`, com todas as flags do staging.
- **A mesma família de bug, no manager:** em eliminatória dupla uma rodada sem série do usuário deixava `userHasPendingSeries` verdadeiro, o `userSeriesGate` abria uma série que `openUserSeriesOn` não conseguia parear e o evento não andava (no modo custom do Matchday, no staging desde o rc.3, segundo o changelog do rc.2). O portão agora joga a rodada quando não há pareamento (`careerMatchdayIdleRound.test.ts`).
- **A regra:** toda integração do v2.2 em diante roda, **com todas as flags do staging ligadas ao mesmo tempo e cada sonda sozinha** (uma máquina ocupada dá falsos negativos por tempo), (1) a sonda de soft lock do manager (`P1_SOFT=1`), (2) a sonda da carreira Pro inteira (`PRO_CAREER=1`) e (3) a checagem de tomada, demissão e oferta da diretoria (`BOARD_SOFT=1`). Os comandos estão em `V2.2-STATUS.md`.
- **Medido no rc.4** com essa regra: soft lock do manager em cheio, 14 carreiras (7 regiões × autopiloto e ajustado, Normal, 7 temporadas), 0 achados; Pro NA, EU, SAM Normal e NA Hard, dos 13 anos à aposentadoria aos 30–31: sem erro, sem dia travado, toda temporada fechada, cartão de ida e volta; diretoria 2 de 2. Suíte: 3203 passaram, 0 falharam (62 sondas opt-in puladas).
- **O polimento do navegador** (`1b21b55`, `1e70c80`): Continue joga o plano do técnico, prólogo, tela de revisão e de despedida, filtro de nomes sem número, diretoria antes do popup de patrocínio, aviso de novo e-mail escondido sob um diálogo; sem valor de balanço novo além de `CAREER_PRO_PLAN.digestWeeks`.
- **Não verificado:** a confirmação de aposentadoria, a ordem patrocinador/diretoria e as versões PT das telas novas no navegador; 320 px da revisão e da despedida; se projetos rivais respondem a uma dinastia da org do próprio Pro.

Absorve o polimento do PROQA (itens 1–10) e a correção da rodada 3 do PROSPINE (parte A).

## R163 — 27 de novembro de 2026: a org consolidada, com Prestígio no lugar da escada de reputação e o teto de contratação do patamar (v2.2.0-rc.6, `realOrgStart`, BALANCE_VERSION 52)

- **Decidido:** uma org é *consolidada* quando o manager comanda uma organização real (`save.identity.realOrgRef`: tomada ou oferta aceita) com `realOrgStart` ligada; um só predicado, `establishedOf(save)` no módulo puro novo `engine/career/established.ts`. O clube fundado (`board.kind === "owners"`) segue com as regras de antes, e com a flag desligada nada muda (`careerBoard.flagOff.test.ts` verde).
- **Prestígio:** `save.reputation` continua sendo o número do motor; numa org consolidada ele aparece como Prestígio, numa trilha de quatro patamares (Azarão, Meio de tabela, Candidato, Elite). Os valores de partida continuam 14 / 24 / 36 / 50, então o patrocínio, a torcida e o empréstimo começam onde o rc.5 mediu.
- **Nada travado por reputação:** todo portão de reputação lê `gateRepOf(save)` (100 numa org consolidada, a reputação do save num clube fundado): instalações, os dois níveis de bootcamp, a psicóloga, os quatro cargos de apoio, técnicos genéricos e ex-pros, jogadores sob contrato, Invitational T2 (só exibição). O que **escala** com a reputação continua lendo `save.reputation`: nível de patrocínio, torcida, teto de qualidade do técnico, empréstimo, pedidos salariais. A tabela da auditoria está no handoff (`ORGMODE-ENGINE.md`).
- **Teto de contratação do patamar:** `signCapOf(save)` lê `CAREER_BOARD.profiles.*.signCap`: azarão 86, meio de tabela 90, candidato 95, elite 99. Antes um azarão na reputação 14 só contratava até 76,6 com titulares de 79 a 85.
- **Por quê:** o Miguel pediu que o modo retrate uma org consolidada, não uma zerada; a escada de reputação só faz sentido no clube fundado.
- **Medido:** `established.test.ts` e `careerOrgMode.test.ts` (o azarão abre a prateleira inteira no dia 1 e o fundado na mesma reputação não; o teto de cada patamar). 0 soft lock em 30 carreiras de tomada (BOARD_PROBE, R167).
- **Não verificado:** nenhuma tela no navegador; o Market e a Finanças só foram tipados e passados no lint.

## R164 — 27 de novembro de 2026: operações no lugar da escada de desbloqueios, a estrutura herdada e a aprovação da diretoria (v2.2.0-rc.6)

- **Decidido:** tudo fica na prateleira desde o primeiro dia, com preço e manutenção de sempre. Numa org consolidada as instalações **podem ser compradas em qualquer ordem** (os efeitos são somas independentes); o clube fundado mantém a ordem estrita. O bootcamp roda o nível estruturado (nível 2), como num clube fundado depois da reputação 38; escolher o nível por bootcamp ficou de fora (fluxo e tela novos).
- **A estrutura herdada** (`profiles.*.staff`, `inheritedGearFor`): instalações como antes (elite 3, candidato 2, meio 1, azarão 0) mais a equipe retida: elite analista e psicóloga, candidato analista, meio de tabela assistente, azarão nenhuma. O caixa inicial não muda; os salários da equipe saem dele toda semana e o manager pode cortá-los.
- **A diretoria aprova obras:** comprar uma instalação pede confiança ≥ 50 (`approval.capital`), o centro de performance ≥ 65 (`approval.flagship`), e nunca numa janela de congelamento (`boardFrozen`). Equipe, técnicos e bootcamps são decisão do manager: só dinheiro. Os motivos de recusa são tipados (`boardApproval`, `boardFlagship`, `boardFrozen`) e têm texto em EN e PT.
- **`operationsOf(save)`:** visão pura com três departamentos (instalações, equipe, bootcamps), cada item com estado (`owned`, `retained`, `available`, `needsApproval`, `frozen`, `cantAfford`), preço, custo semanal, chave do efeito e a confiança que exige.
- **Por quê:** "o desafio deve ser mais em gerenciar o time, os treinamentos, o orçamento" (Miguel). Numa org consolidada o limite é dinheiro e diretoria, não reputação.
- **Medido:** testes de fluxo (compra fora de ordem, recusa abaixo de 50 e de 65, congelamento; estrutura por patamar). Caixa na T6 na R167.
- **Não verificado:** a tela de Clube com as operações (é da frente UI-C); o arc bot não corta salários herdados, então a medição não testa um manager que enxuga a equipe.

## R165 — 27 de novembro de 2026: o orçamento é da org, e é um plano (v2.2.0-rc.6)

- **Decidido:** numa org consolidada o orçamento da temporada não segue mais a folha atual. É `board.grantBase` (fixado na tomada: as semanas do patamar sobre a folha herdada) × a razão do índice de dinheiro × `budgetMult` × o `grantMult` do plano, mais a parte antecipada. Cortar salários não corta o orçamento seguinte e aumentá-los não o aumenta; o teto salarial continua.
- **`seasonBudgetOf(save)`** no módulo puro novo `engine/career/budget.ts`: alocação, bônus em jogo, comprometido por linha até o fim da temporada (a declaração da segunda-feira × as segundas que faltam), gasto e receita por linha a partir dos tipos do razão, receita contratada a vir, livre, projeção do fim, folha contra teto e semanas cobertas. Não há regra de dinheiro nova: é uma leitura dos livros.
- **Limite:** o razão guarda as últimas 160 entradas, menos que uma temporada de linhas de segunda; `ledgerFromWeek` diz a partir de que semana o gasto e a receita estão completos. Antes da escolha do plano a alocação ainda não está no saldo, então o "livre" do dia 1 é muito negativo; a tela deve ler depois da escolha ou somar a verba do plano pendente.
- **Por quê:** "cada org deve ter suas metas por temporada, seu orçamento" (Miguel).
- **Medido:** teste de fluxo (com os salários cortados pela metade a parte do orçamento não se move; as linhas de `seasonBudgetOf` fecham com o saldo).
- **Não verificado:** a soma de uma temporada inteira contra o razão completo; a tela de Finanças (UI-C).

## R166 — 27 de novembro de 2026: objetivos de temporada que soam como a temporada daquela org, e o recado da diretoria (v2.2.0-rc.6)

- **Decidido:** os três planos continuam (cautious, expected, ambitious) com as chances medidas e as faixas do R154; muda a meta que cada um escolhe. Cada patamar prefere as próprias competições (`objectiveKinds`): elite, finais de Major e Worlds e vaga no Worlds; candidato, vaga e finais de Major, vaga no Worlds, título regional; meio de tabela, vaga em Major e colocações em regionais; azarão, colocações e presença em regionais, com vaga em Major no plano ambicioso (`objectivePlanKinds`). Uma org consolidada nunca recebe Community Cup nem mais de 5 regionais (`objectiveMaxCount`). A preferida vence quando a chance dela fica a até 0,15 da mira do plano (`objectivePrefWindow`); senão, a mais próxima de qualquer tipo. Os três planos são três metas diferentes, em ordem de dificuldade.
- **O recado** (`board.season.brief`, opcional): por que a diretoria pede isso, lendo a temporada anterior: `takeover`, `promoted` / `relegated`, `title`, `ultimatumSurvived`, `met` / `missed`, nessa prioridade, com o objetivo anterior, a posição na região e o melhor resultado. Uma ou duas frases em EN e PT. Clube fundado não tem recado.
- **Totais na meta:** `goalTotalOf` e `C.goals.seasonTotal` ("top 4 em 3 dos 9 regionais"); `C.goals.season` do modo fundado ficou intacto.
- **Medido:** em todas as orgs de NA, EU e SAM, temporadas 0 a 2, os três planos são metas diferentes e em ordem, sem copa e sem mais de 5 regionais, e a regra da preferida vale sempre que houver uma na janela (`careerOrgMode.test.ts`). No seed 4242 os planos de uma elite são top 4 em 2 Majors / vencer um Major / vencer 2 Majors; de um candidato, vaga nos 3 Majors / vencer um Major / vencer 2; de um meio de tabela, vencer 2 regionais / vaga nos 3 Majors / top 4 em 2 Majors; de um azarão, top 8 em 2 regionais / top 8 em 3 / vaga em um Major.
- **Desvio medido, não reajustado:** com as metas novas, o Expected declarado do meio de tabela e do azarão fica bem acima do medido (R167). Os `goalRates` não foram reajustados, por instrução do integrador.
- **Não verificado:** o recado e as metas nas telas (UI-B); temporadas 3 em diante no teste das preferências.

## R167 — 27 de novembro de 2026: o patamar muda na revisão, com linha de promoção, piso de permanência e objetivo cumprido (v2.2.0-rc.6, BALANCE_VERSION 52)

- **Decidido:** na revisão da temporada, depois do veredito e só se o manager não foi demitido, o patamar é relido a partir do Prestígio: sobe ao atingir a linha de promoção do patamar seguinte (`standing.promote`: meio de tabela 35, candidato 50, elite 85) **e com o objetivo da temporada cumprido** (`promoteNeedsObjective`); cai abaixo do piso do próprio patamar (`standing.keep`: 18 / 28 / 40). Um passo por temporada, nunca na primeira temporada da diretoria. Na mudança, paciência, expectativa e célula de calibração seguem o patamar novo; `grantBase` e `wageRoom` andam ×1,2 na subida e ×0,9 na queda; a subida dá +5 de confiança; vão um e-mail da diretoria, uma notícia pública e uma linha no veredito da revisão (`board.tierChange`).
- **Desvio da spec:** a spec pedia uma linha por patamar (20 / 32 / 45) com histerese 3. Medido com elas, todo candidato e todo meio de tabela subiu na primeira revisão permitida, e azarões chegaram à elite na T4 errando todos os objetivos. Com a promoção desligada, o Prestígio de um meio de tabela fica entre 29 e 68 depois da primeira temporada e entre 40 e 100 depois da segunda (um título de Major leva perto de 100). Com os valores de partida fixos, uma linha alta o bastante para frear essa subida rebaixaria um candidato que começa em 36; por isso há duas linhas por patamar. Com só o Prestígio, 3 das 4 demissões vieram logo depois de uma promoção que o objetivo da temporada não justificou; por isso a promoção pede o objetivo.
- **Medido** (BOARD_PROBE, bot competente em Expected, todas as flags do staging, NA/EU/SAM, Normal e Hard, 6 temporadas, seed 30000, 30 carreiras, 3 por célula; N = 18 temporadas por célula; entre parênteses o rc.5 do BOARD.md), declarado → medido no Expected: Normal elite 52→50 (61), candidato 53→50 (44), meio 54→**28** (61), azarão 62→**33** (92), fundado 70→56 (61); Hard elite 48→83 (43), candidato 51→50 (69), meio 57→44 (61), azarão 61→**22** (50), fundado 66→67 (58). Faixas (3 planos, N = 540): mesma 50 %, vizinha 36 %, duas ou mais 14 % (rc.5: 65 / 34 / 1). Demissões 4/30, todas na T6 e todas em SAM (rc.5: 1/30 por dificuldade). Caixa na T6 (mediana), Normal / Hard: elite US$ 113k / 254k, candidato 222k / 185k, meio 200k / 209k, azarão 147k / 57k, fundado 26k / 34k. 0 soft lock. **Subidas:** candidato → elite 2/3 (Normal, T2) e 3/3 (Hard, T2–T4); meio → candidato 2/3 nas duas dificuldades, na T2 ou T3 (na Normal os dois seguem para elite na T3); azarão → meio 3/3 na Normal (T2–T3) e 1/3 na Hard (T2); nenhuma queda.
- **Por quê:** "não é uma org zerada", e a progressão longa do modo é subir de patamar; uma promoção sem resultado só aumenta a cobrança e leva à demissão.
- **Reajuste das chances declaradas (mesmo rc.6, BALANCE_VERSION 52):** `calibration` e `goalRates` reajustados nas regras novas, em 90 carreiras competentes × 6 temporadas (seeds 9000, 12000, 12101; NA/EU/SAM, Normal e Hard, os quatro patamares e o fundado; todas as flags do staging com endless), com cada meta registrada no patamar que a diretoria tinha **naquela temporada** (depois de uma promoção a temporada é do patamar novo). `goalRatesK` fica 8. A sonda passou a agrupar o resumo do mesmo jeito (`SeasonRow.tier`); as linhas de calibração e a avaliação offline já usavam o patamar da temporada.
- **Medido fora da amostra** (seeds 30000 e 30101, 120 carreiras: 60 competentes em Expected e 60 descuidadas em Ambitious; N = temporadas em que a diretoria tinha o patamar), declarado → medido no Expected do competente: Normal elite 56→43 (76), candidato 53→**72** (25), meio 58→58 (26), azarão 63→65 (17), fundado 69→81 (36); Hard elite 44→57 (58), candidato 55→41 (34), meio 58→73 (26), azarão 62→**27** (26), fundado 59→58 (36). **Ainda a mais de 15 pontos:** candidato Normal (+19) e azarão Hard (−35); meio Hard no limite (+15). Faixas do competente (3 planos, N = 1080): mesma 69 %, vizinha 29 %, duas ou mais 3 % (rc.5: 65 / 34 / 1; antes do reajuste: 50 / 36 / 14); do descuidado: 18 / 61 / 22. Demissões: competente **0/60** (antes do reajuste 4/30, todas em SAM), descuidado 11/60 (rc.5: 16/60), 7 delas em SAM; nenhuma carreira competente de SAM foi demitida. Duas insolvências, ambas do descuidado. Caixa na T6 (mediana, competente) Normal / Hard: elite US$ 672k / 689k, candidato 782k / 210k, meio 710k / 117k, azarão 206k / 85k, fundado 69k / 34k. Subidas (competente, 6 carreiras por célula): candidato → elite 6/6 e 5/6, meio → candidato 5/6 nas duas dificuldades, azarão → meio 6/6 e 3/6; nenhuma queda nas 120 carreiras. 0 soft lock.
- **Não verificado:** nenhuma queda aconteceu (coberta só por testes); o ajuste usou 3 dos 6 seeds do rc.5 (15000, 20000 e 20101 não foram jogados); as células de azarão têm 21 e 25 temporadas no ajuste. **Proposto, não feito:** uma segunda rodada de ajuste para candidato Normal e azarão Hard, ou metas mais fáceis para o azarão no Hard; decidir se as demissões do descuidado em SAM (7 de 11) pedem uma paciência regional.

## R168 — 27 de novembro de 2026: a org consolidada tem patrocínio desde o primeiro dia (v2.2.0-rc.6)

- **Decidido:** numa org consolidada a mesa de patrocínio abre no dia 1, no nível de patrocínio do próprio Prestígio, sem portão de reputação; é a mesma decisão de três ofertas da virada de split (`openEstablishedSponsorDesk`). Ela abre quando o plano da temporada é aceito, então a ordem do dia 1 é plano primeiro, patrocínio depois; com a diretoria desligada, abre na criação. Depois de uma oferta de emprego também (a mudança começa com um plano novo). O `boardAutoAnswer` assina a oferta mais segura (a regra do prazo da própria mesa), e o arc bot responde com a política dele. O clube fundado continua esperando a reputação.
- **Por quê:** na tomada o patrocínio zerava e a mesa dizia que as ofertas viriam no próximo split: a org consolidada jogava o primeiro split sem patrocinador e o orçamento não mostrava receita contratada (passada do integrador no navegador, True Neutral).
- **Medido:** o plano vem primeiro e a mesa depois; 20 dias de piloto automático andam (o relógio não trava); `P1_SOFT` 0 achados em 656 lobbies; `BOARD_SOFT` 2/2; 0 soft lock nas 30 carreiras do BOARD_PROBE de checagem.
- **Não verificado:** a mesa depois de uma oferta de emprego sem teste dedicado (só o caminho do código); a tela no navegador.

## R169 — 27 de novembro de 2026: o orçamento da diretoria cobre a temporada que ela pede (v2.2.0-rc.6, BALANCE_VERSION 52)

- **Decidido:** as semanas de caixa e de orçamento da diretoria multiplicam a conta semanal inteira da org (salários e técnico mais a equipe herdada, a psicóloga e a manutenção das instalações, `structureWeeklyOf`), e o `grantWeeks` da elite vai de 16 para 22. É o único número mudado; o teto salarial continua em semanas da folha, Cautious fica abaixo e Ambitious acima como antes.
- **Por quê:** a elite recebia 10 + 16 + 1 = 27 semanas da folha para uma temporada de 31 segundas, sem contar equipe e manutenção; a True Neutral abria o dia 1 com "faltam US$ 47,2k" antes de qualquer decisão.
- **Medido:** em todas as orgs de NA, EU e SAM, Normal e Hard, na temporada 0, o plano Expected mais o caixa cobre o comprometido da temporada antes de qualquer patrocínio (`free` ≥ 0; menor folga: elite US$ 13k, candidato 5k, meio 6k, azarão 2k). Normal, antes → depois: BDS −264k → +121k, Vitality −93k → +36k, NRG −136k → +58k, True Neutral −47k → +13k, FURIA +2k → +11k, Top Blokes +12k → +17k, Team Singularity +4k → +4k.
- **Leitura, sem rebalancear:** na T6 a org consolidada competente tem mediana de US$ 210k (refit fora da amostra, N = 48; elite 672k) contra 42k do clube fundado. Em semanas da própria folha isso é pouco (a folha de uma elite é de US$ 6k a 60k por semana). Na rodada 2, 10 de 24 terminam a T6 acima do caixa da T1. Mais rica que o fundado em dólares, não em semanas de folha; a decisão é do Miguel.
- **Não verificado:** a Easy; temporadas depois da primeira não têm o mesmo teste (o orçamento passa a seguir o `grantBase` no índice de dinheiro e o `budgetMult`).

## R170 — 27 de novembro de 2026: as linhas do orçamento contra o razão, e o bootcamp que o fluxo roda (v2.2.0-rc.6)

- **Decidido:** a linha de patrocínio contratada para no `terms.endsOn` do contrato (antes ia até o fim da temporada). A torcida aparece zerada, recebida e contratada, porque `CAREER_ECONOMY.passivePerRepPoint` é 0 em todo o jogo: a linha existe e não paga nada (explicado, não é bug). O `operationsOf` devolve só o bootcamp que o fluxo roda (o estruturado numa org consolidada) e marca grátis e disponível o bootcamp que o patrocínio paga.
- **Medido:** testes de fluxo (o pagamento semanal do contrato entra como recebido e contratado, nunca acima da semana do contrato × segundas que faltam; um bootcamp só, grátis com patrocínio).

## R171 — 27 de novembro de 2026: as conquistas permanentes da carreira são do caminho do clube fundado (v2.2.0-rc.6; regra do rc.6, o Miguel decide a final no portão)

- **Decidido:** uma carreira numa org consolidada não ganha nenhuma das conquistas permanentes da carreira, nem as marcas cosméticas, nem a dificuldade do Worlds ganho na memória da conta (`achievementsOpenFor`, lido na hora da checagem). Um manager demitido que funda um clube ganha de novo lá, contado a partir da fundação (`save.achievementBase`: estatísticas e temporadas são diferenças desde a base, e as marcas de um disparo são apagadas na mudança), sem nada retroativo. "N temporadas" conta as temporadas do clube fundado. Títulos, sala de troféus, histórico do manager e Season XP de resultados não mudam. Na página do Clube o quadro continua (é a coleção da conta) com uma linha dizendo que elas são ganhas no caminho do clube fundado, em EN e PT.
- **Por quê:** "Um nome na cena: chegue a 50 de reputação" caía no momento da tomada de uma elite (Prestígio 50), e a BDS no Easy entregava "Campeão de Major" e "Campeão mundial" na primeira temporada; elas pagam Season XP e liberam cosméticos para a conta inteira e foram feitas para o caminho fundado.
- **Proposto, não feito:** 6 a 8 conquistas do modo de tomada para um patch seguinte (lista no handoff `ORGMODE-ENGINE.md`).
- **Não verificado:** a base numa demissão jogada até a fundação (testada só na função pura).

## R172 — 27 de novembro de 2026: a meta da temporada na HQ lê o plano da diretoria (v2.2.0-rc.6)

- **Decidido:** com o plano da temporada pendente numa org consolidada, o bloco da meta mostra uma linha e o link para o plano, não uma meta diferente. Depois da escolha, meta e meta ousada são lidas com o total da temporada, como no card do plano ("Vença 2 dos 3 Majors"); a revisão da temporada lê do mesmo jeito.
- **Correção:** `C.goals.season` perdia a contagem de um `majorFinish` de colocação 1 ("Vença um Major" para dois títulos: o "(0/2)" que o integrador viu). Causa raiz: o ramo da colocação 1 retornava antes de ler a contagem. Vale também para o clube fundado, em EN e PT.
- **Medido:** `seasonGoalCounts.test.ts` passa por toda meta com contagem acima de um nas duas línguas e nas duas funções.
- **Não verificado:** o bloco no navegador.

> Nota de numeração (27/11): R173–R176 são do front ERA (ORGMODE-2027). Se o front MANDATE também usou R173+, o integrador renumera um dos blocos na fusão.

## R173 — 27 de novembro de 2026: a carreira começa em qualquer era; `seasonIndex` continua sendo a era (v2.2.0-dev, BALANCE_VERSION 53)

- **Decidido:** o save ganha `startSeasonIndex` opcional (ausente = 0) e o mundo ganha `eraStart`. `seasonIndex` continua absoluto (6 = RLCS 2027): idade, rótulos, dados, intake e sementes leem a era. O progresso da carreira (dia de fundação, primeira janela sem propostas, guardas de novato, a graça da estreia na nota, a rampa regional R143, o aviso de saves, o número da temporada na confirmação de apagar) lê `era.careerSeasonOf`. Nesta etapa só a tomada de org usa outra era; o clube fundado começa em 0 (o dinheiro da fundação é dinheiro da temporada 0).
- **Por quê:** a auditoria (handoff `ORGMODE-2027-ERA.md`) achou centenas de leitores de era e cerca de vinte de progresso: o lado menor é o do progresso.
- **Medido:** carreira fundada bit a bit igual ao rc.6 (2 fundadas × 8 temporadas e 1 tomada × 2, todas as flags de staging, hash do save no início e no fim de cada temporada, 40 linhas iguais).
- **BALANCE_VERSION 52 → 53:** só porque `balance.ts` ganhou `CAREER_ERA` (o teste de impressão digital exige); nenhum número de carreira fundada muda.

## R174 — 27 de novembro de 2026: o mundo de uma era tardia, e o dinheiro é da era (v2.2.0-dev)

- **Decidido:** `buildWorldAtCreation(seed, era)` monta as lineups daquela temporada; região abaixo de 16 completa primeiro com orgs que voltam (última lineup nas 2 temporadas anteriores, mais nova primeiro, depois força), depois fillers. Agentes livres: jogadores reais sem vaga com último card de clube nas 3 temporadas anteriores e os subs dessa janela, no último overall, ninguém além da janela de aposentadoria, nenhum técnico de lineup da era.
- **Dinheiro:** o índice de dinheiro e a receita tardia leem a era (absoluto), não o progresso. O índice único (×1,15 por temporada) multiplica todo valor indexado por igual, então uma tomada em 2027 é a economia de 2020 ×2,31 em tudo que é indexado; a diferença real é a receita tardia (Majors e Worlds maiores, patrocínio tardio) ligada desde o primeiro dia. Trocar para progresso pediria passar o início por dezenas de funções de dinheiro usadas também pelo mundo. **Não medido:** o caixa de uma tomada em 2027 contra a de 2020 (a decisão 3 do portão rc.6, "a economia é folgada?", fica mais pertinente).
- **Medido (seed 5150):** em 2027 NA 19 orgs, EU 24, SAM 16 (4 voltam), MENA 16 (6 voltam), nenhum filler nessas quatro; OCE 9 fillers, APAC 3, SSA 12.

## R175 — 27 de novembro de 2026: jogadores reais depois do fim dos dados (v2.2.0-dev)

- **Decidido:** só num mundo montado na última era (`CAREER_ERA.lastEraRules`): jogador real de até 21 anos no início tem potencial `max(dos dados, overall no início + folga)`, folga sorteada por seed numa tabela por idade (teto 96), e o pico vai para onde ele alcança; todo jogador real passa a evoluir fora dos cards (antes ficava congelado no último card até se aposentar); aposentadoria de 26 a 32 (`CAREER_ERA.longCareers`) para mundo e elenco.
- **Medido** (conjunto dos 213 jogadores de 2027, 2 tomadas jogadas pelo bot, EU seed 5150 e NA seed 9100, 8 temporadas): ativos depois de 3/6/8 temporadas 87–90 % / 62 % / 46–47 % → 99 % / 87–90 % / 72 %; reais no top 30 na temporada 4 / 8: 80–83 % / 3–13 % → 97–100 % / 63–67 %. Metas do spec cumpridas (≥ 75 %, ≥ 50 %, ≥ 60 %), mas as do "antes" já eram cumpridas em 3 e 6 temporadas.
- **Efeito colateral medido:** o corte do top 30 do mundo sobe de 88 para 92–93 na temporada 3–4 (os jovens reais crescem). **Não medido:** o efeito disso na chance de título de uma tomada.

## R176 — 27 de novembro de 2026: a tomada começa em 2027 (v2.2.0-dev)

- **Decidido:** a tela de escolha monta o mundo em `CAREER_ERA.takeoverDefaultStart` (6); no build de staging `?era=N` (0–6) troca a era para teste até existir o seletor (etapa 4). Org que volta é marcada no dossiê ("De volta, vista pela última vez em RLCS 2026"). O técnico de uma org na onda de 2027 é o da lineup de 2027.
- **Não feito:** as telas da diretoria (contrato "até a temporada N", registro "S7 · W3") ainda mostram o índice absoluto +1; é a UI do front MANDATE.

## R200 — 27 de novembro de 2026: o Skip e o autoplay param na última semana da janela (v2.3.0-dev)

- **Decidido:** na segunda-feira em que uma janela de transferências entra na última semana, o Avançar em lote para uma vez (como a abertura da janela, protegido por `day !== startedAtDay`, então o segundo toque segue) e o autoplay também. É parada do lote, nunca trava do relógio. Nessa segunda sai uma notícia "A janela de transferências fecha em N dias" (chave `windowClosing`, pública) com corpo dizendo o que caduca (propostas sem resposta, jogadores no mercado). Predicado puro: `isWindowLastWeekStart(day)` em `calendar.ts`.
- **Janela de uma semana (Worlds, S31):** o predicado é falso; a segunda de abertura já é a parada e não há aviso de fechamento (a opção mais simples).
- **Não feito:** regras de expiração de lances/trocas e a contagem das telas ficam como estavam.

## R195 — 27 de novembro de 2026: o feed lê o que o save já guarda, e o que faltava vira um log (v2.3.0-dev, front FEED)

- **Decidido:** `fanFeedFor(save)` (puro, semeado) deriva os posts na hora e nunca os guarda. Títulos e finais perdidas vêm de `eventResults` e do livro de honras; contratações e vendas, de `transferLog`.
- **Fato que o save não tinha:** o resultado de cada série (adversário, placar, upset). Só sobrava o total em `stats` e o placement do evento. Em vez de mexer em como os resultados são gravados, `finishEvent` chama um gancho de uma linha (`recordFeedSeries`) que só lê o torneio e grava um anel de 40 séries em `save.fanFeed.series`. Com a flag ligada. Save antigo não tem o log: sem posts de série, nunca inventados.
- **Também pulado:** título de temporada antiga (o livro de honras guarda o evento, não o nome do evento): conta para a dinastia, mas não vira post.
- **Alternativa descartada:** derivar série de `followEvent`/`activeEvent` (só existem em momentos soltos).

## R196 — 27 de novembro de 2026: o post do manager e o recibo (v2.3.0-dev, front FEED)

- **Decidido:** uma ação, `postToFeedFlow(save, tom | "skip")`, responde à última série (uma resposta por série). Guarda tom, adversário e semana (mais o número da série e a temporada) em `fanFeed.posts` (últimos 12). "Pular" só marca a série como respondida.
- **Recibo:** só o tom provocador pode virar recibo. A primeira série **posterior** contra o mesmo adversário (mesmo ref) fecha o post: derrota = recibo (os fãs citam de volta), vitória = "cumpriu". Fecha uma vez só e dentro de 1 temporada (`receiptWindowSeasons`). Vem do log, não de um segundo registro.
- **Derivado, não guardado:** o recibo e a resposta dos fãs aparecem no feed a partir do post guardado; o guardado é só o dado.

## R197 — 27 de novembro de 2026: variedade e afirmações com dado (v2.3.0-dev, front FEED)

- **Decidido:** cada tipo de evento tem uma tabela de variantes (`fanFeedVariants.ts`): 6 a 9 por tipo, cada uma com os slots que exige (sempre 2 ou mais, e o texto usa exatamente esses), e opcionalmente uma afirmação (`dynasty`, `bestInRegion`, `firstMajor`) ou um tom. Variante só é elegível com todos os slots presentes: dado ausente em save antigo derruba a variante, não inventa.
- **Afirmações:** "dinastia" = 3 ou mais títulos de Major e Mundial no livro até aquele momento (`CAREER_FEED.claims.dynastyTitles`); "melhor time da região" = o último regional registrado até ali foi do usuário; "primeiro título" = o título é o número 1 do livro. Um teste varre o copy EN e PT e falha se uma dessas palavras aparecer em variante sem a marca.
- **Janela:** nenhuma variante se repete nas últimas 5 do mesmo tipo (`window`); com menos variantes elegíveis a janela encolhe para elegíveis menos 1 (a resposta dos fãs ao post, por exemplo, tem 3 variantes por tom). Série que fecha marco de sequência (3, 5, 8, 12) vira post de sequência antes de upset.
- **Texto:** `copy.career.feed.*` com `{slot}`; o placar é sempre o da série, vencedor primeiro. Fã é informal; jogador ou org real só como assunto, nunca autor nem citação.

## R198 — 27 de novembro de 2026: seguidores são um número e nada mais (v2.3.0-dev, front FEED)

- **Decidido:** `fanFeed.followers` começa em 400 mais 6 por ponto de reputação e se move em percentual (mínimo 1): vitória +3 %, derrota −2 %, upset +2 % / −1 % extra, título +10 %, post por tom (+1 / +2 / +4 %), recibo −8 %, cumpriu +6 %. Nunca abaixo de 0. Não toca dinheiro, moral nem nada: só enfeita o feed (curtidas escalam com ele, até 12×).
- **Por quê guardado e não derivado:** o log de séries é um anel de 40; derivar da janela faria o número andar para trás quando séries velhas saíssem.

## R199 — 27 de novembro de 2026: a flag, o contrato fechado e os handles (v2.3.0-dev, front FEED)

- **Decidido:** `FEATURES.fanFeed` (`NEXT_PUBLIC_FAN_FEED=1`, ligada só no staging). Desligada, o gancho e a ação voltam sem tocar no save (teste: o save de um evento real não tem o campo). Os números ficam em `balance.fanFeed.ts`; `BALANCE_VERSION` 53 → 54 só porque `CAREER_FEED` entrou na exportação (nenhum número de jogo mudou; o merge com os outros fronts recalcula a impressão digital).
- **Handles:** banco próprio de palavras de jogo e cena ("ceilingkid", "boost_fan42"), sem jogador, org ou criador real; um teste confere todas as palavras e 20 mil handles contra o dataset e o catálogo de nomes da carreira (isso tirou "shadow", "andy", "goblin", "rookie" e "ghost", que são nicknames reais).
- **Não feito (onda 2):** tela do feed, o botão do post depois da série e a ligação da ação ao `careerStore`.

> Nota de numeração (27/11): R190–R194 são do front LOCKER (v2.3, onda 1, `v23/locker-room`); R195–R199 ficam com o FEED.

## R190 — 27 de novembro de 2026: a conversa é um e-mail com respostas e nunca segura o calendário (v2.3.0-dev, LOCKER)

- **Decidido:** a fila de decisões (`careerDecisions`) não carrega título, texto nem respostas (cada tipo tem a sua tela), e o e-mail não tinha ações. A conversa vira um e-mail da comissão (`lockerTalk_<tema>`, com `talkId` nos params) e o leitor da caixa de entrada ganhou o mínimo: `components/career/locker/LockerTalkAnswers.tsx`, um botão por resposta, e depois a resposta dada. Não entra na fila: nunca segura o relógio nem o autoplay. Sem resposta em `CAREER_LOCKER.talkDays` (7) dias, fecha sozinha com a resposta neutra e manda um e-mail dizendo qual foi.
- **Por quê:** o spec pede que a conversa nunca trave o calendário e que o jogo funcione para quem ignora o sistema. Sem a sonda de soft lock nesta onda, a opção que não segura nada é a única segura.
- **Não visto num navegador.** A onda 2 troca o componente pela tela do vestiário.

## R191 — 27 de novembro de 2026: a "série" do spec é um evento que o clube jogou (v2.3.0-dev, LOCKER)

- **Decidido:** a unidade do tempo de jogo e da promessa `minutes` é um evento do clube com resultado em `eventResults` (o sábado e o domingo de um fim de semana são dois). A escalação é a `fieldedIds` do evento (congelada desde o R40), senão os titulares. Evento lateral 1v1/2v2 não conta. A troca no meio da série (Matchday) não conta.
- **Reservas:** quem tem overall abaixo do titular mais fraco escalado não espera jogar: o banco sozinho o leva só até `benchFloorReserve` (32, acima do limite do pedido de transferência) e ele não pede a conversa. Quem é melhor que um titular cai sem piso e pede a conversa no 3º evento seguido no banco (`benchRunTalk`), e continua caindo até jogar.
- **Por quê:** contar séries pediria ler a chave do torneio por dentro; o evento já é o que o save registra com escalação.

## R192 — 27 de novembro de 2026: os fatos do vestiário vêm do save antes e depois de cada escrita (v2.3.0-dev, LOCKER)

- **Decidido:** nenhum fluxo da carreira mudou. A store chama `lockerRoomAfter(prev, next)` em `withSave` e `withResult` (duas linhas), e `store/lockerRoomFlow.ts` lê a diferença: segundas cruzadas (o tick semanal), resultado novo do clube (evento jogado), entrada nova na lista de transferências, jogador que saiu com `soldOn` novo (vendido; sem ele, liberado ou fim de contrato), proposta recebida que sumiu no mesmo dia com o jogador ainda no elenco (recusada). Se o passo falha, a escrita segue sem ele.
- **Limite:** o que não passa por esses dois helpers (bots, sondas, testes que chamam fluxos direto) não roda o vestiário. Com a flag desligada nada roda e nada é gravado (teste de seis semanas, save igual byte a byte).

## R193 — 27 de novembro de 2026: como uma promessa fecha, e a palavra do técnico (v2.3.0-dev, LOCKER)

- **`minutes`** (3 dos próximos 4 eventos como titular): cumprida assim que ele soma 3; quebrada assim que não dá mais (2 eventos fora). Se em 70 dias o clube não jogou eventos suficientes, ela caduca sem contar para a palavra (senão prometer na pré-temporada seria palavra grátis).
- **`stay`**: vale até o fim da janela aberta, ou da próxima. Lista ou venda antes disso quebra; a janela fechar cumpre. Vender um jogador quebra toda promessa feita a ele; liberar ou o fim do contrato só as apaga.
- **Efeitos:** cumprida +8 para ele; quebrada −20 para ele e −4 para cada companheiro. A palavra é `(cumpridas + 1) / (cumpridas + quebradas + 2)`; uma promessa nova acalma 10 × `clamp((palavra − 0,3) / 0,2, 0, 1,25)`: 10 para um técnico novo, 2 depois de uma quebrada, 0 com duas quebradas e nenhuma cumprida. Promessa herdada (L5) conta para a palavra de quem a cumpre ou quebra.

## R194 — 27 de novembro de 2026: as consequências e os números de partida (v2.3.0-dev, LOCKER)

- **Pedido de transferência:** moral abaixo de 25 por 4 ticks semanais seguidos abre a conversa "vender, prometer, recusar" (neutra: recusar, −6). Depois de respondida, 8 semanas sem novo pedido. "Vender" coloca o jogador na lista pelo valor dele se a janela estiver aberta (sem a queda de ser listado); com a janela fechada, um e-mail manda listar quando abrir.
- **Treino:** fator linear 0,94 (moral 0) a 1,06 (moral 100) no ganho bruto de todo tick que lê `growthCtxOf` (treino, scrims, XP de partida); nunca no declínio, então nenhum efeito de moral baixa overall ou potencial gravado. Moral neutra não entra no contexto: o tick é o antigo bit a bit.
- **Partida:** `CAREER_LOCKER.matchEffect` existe e vale 0; `matchMoraleEffectOf` não está ligado em lugar nenhum.
- **Outros números:** título regional, Major ou Worlds +6 para o elenco, top 4 sem título num Major ou Worlds +3, a partir do 3º evento seguido eliminado na Swiss −2 cada, listado −10, resposta seca −5, deriva semanal de 1 em direção a 50 (não para quem está emburrado no banco). Os cinco humores cortam em 20/40/60/80. Mudança de humor vira um e-mail por motivo, com os nomes e o humor novo. **Não medido:** nenhum desses números passou por bateria.

## R201 — 27 de novembro de 2026: a conversa mostra quem, e a comissão relata o que ele disse (v2.3.0-dev, UI)

- **Decidido:** a conversa (`locker/LockerTalk.tsx`) tem a cara do jogador (o overall na moldura de raridade do Draft, como a linha do reserva no QG), o nome, o humor e o prazo; depois "A comissão relata" com o texto do e-mail; depois as respostas, cada uma com o que compromete o técnico; a neutra leva a etiqueta "Se você não responder". Respondida, a conversa fica na tela com a resposta, o humor dele agora e onde a promessa mora (o vestiário, no Elenco).
- **Por quê:** o wave 2 pede "quem fala, o que diz", mas HISTORIAS-SPEC proíbe frase inventada na boca de um pro de verdade. A fala é relatada pela comissão (o texto da onda 1), nunca entre aspas na voz dele.
- **Um toque responde.** O texto da conversa já avisa que promessa é lembrada; não há confirmação extra.

## R202 — 27 de novembro de 2026: onde o vestiário aparece, e o que o QG mostra (v2.3.0-dev, UI)

- **Elenco:** o humor no rodapé de cada card titular e um bloco "Vestiário" na coluna principal: a primeira conversa aberta por inteiro (as outras viram linhas que abrem a ficha do jogador), uma linha por jogador (cara, nome, o último motivo como frase, humor), a palavra do técnico (cumpridas e quebradas como números) e as promessas abertas com progresso e prazo. Tocar num jogador abre a ficha "por quê" (as últimas 4 mudanças com motivo e valor, a promessa, a conversa).
- **QG:** um cartão "Vestiário" logo abaixo do bloco de decisão, só quando há conversa esperando (um pedido de transferência é uma conversa) ou promessa `minutes` a um banco de quebrar. No desktop a primeira conversa se responde ali; no celular (QG é resumo, DESIGN.md "Phone") cada conversa é uma linha que leva ao vestiário. Nunca entra na fila de decisões e nunca segura o relógio (R190).
- **Seletores novos, puros e testados** em `lockerRoom.ts` (`promiseProgressOf`, `playerLockerLogOf`, `squadMoodOf`, `wordStandingOf`, `lockerAttentionOf`, `lockerDaysBetween`): só leitura, nenhuma regra ou número mudou. "Em risco" = mais um evento no banco quebra a promessa. "Palavra arranhada" = credibilidade abaixo de 0,5.

## R203 — 27 de novembro de 2026: a torcida é uma aba da mesa, e o post do técnico um cartão do QG (v2.3.0-dev, UI)

- **Torcida:** quarta aba em Caixa de entrada (`#fans`), só com `FEATURES.fanFeed`. Seguidores como o número da aba; depois os posts, mais novo primeiro (handle, texto, evento, semana, curtidas), os 12 primeiros e "Ver todos os N". O post do técnico é um quadro com a marca do clube e o tom; o print leva etiqueta vermelha e cita o post que ele responde; a resposta da torcida diz "Respondendo ao seu post". Save sem série registrada: estado vazio.
- **Post do técnico:** cartão do QG depois de uma série do clube (`pendingFeedPostOf`): a série numa linha, os três tons com a dica, o texto do post aparece ao escolher o tom (`managerPostDraftOf`, o mesmo texto que o feed mostra depois), "Postar" e "Pular". Postado, o cartão mostra o post e o caminho para a torcida até sair da tela. Não está no `EventScreen` (outra sessão). `postToFeed` entrou na `careerStore` (uma linha, `withSave`).
- **No celular** a faixa de abas rola de lado quando a torcida está ligada (a aba aberta fica centralizada); com a flag desligada a faixa é a de antes.

## R204 — 27 de novembro de 2026: o que foi visto, e como (v2.3.0-dev, UI)

- **Visto no navegador** (dev, flags ligadas) a 1280, 375 e 320 px, em EN e PT, nos estados listados em `docs/handoff-2.3/UI.md`. Os estados com promessa, conversa, palavra arranhada, print e posts foram montados à mão no localStorage de uma carreira rápida (um script descartável fora do repo), não jogados semana a semana.
- **Flag desligada:** servidor reiniciado com `NEXT_PUBLIC_LOCKER_ROOM=0` e `NEXT_PUBLIC_FAN_FEED=0` sobre o mesmo save com estado: nada renderiza, o invólucro do QG fica `display: none` (`empty:hidden`), a aba Torcida some e `#fans` cai na caixa de entrada.

## R205 — 27 de novembro de 2026: a oferta é um e-mail com resposta, nunca segura o calendário e vence como recusada (v2.3.0-dev, MEDIA)

- **O mecanismo é o do vestiário (R190):** uma oferta de dia de mídia vira e-mail (`mediaOffer`) com os botões aceitar e recusar sob a mensagem. Não é decisão da fila do relógio (`careerDecisions`), então não segura o calendário. Sem resposta, vence como recusada no dia seguinte ao prazo (o prazo é o dia antes do primeiro dia fora). Recusar e vencer mudam só o status da oferta.
- **Os fatos vêm do save antes e depois de cada escrita** (como R192): `mediaDaysAfter(prev, next)` roda nas duas escritas da store (`withSave`, `withResult`), sem tocar em `careerFlow.ts`. Flag desligada: nada roda e nada é escrito. Ligada, `save.mediaDays` nasce na primeira oferta.
- **Lacuna de UI, dita:** os botões (`MediaOfferAnswers`) precisam de uma linha em `NewsScreen.tsx`, arquivo que outra sessão edita agora; sem ela a oferta aparece como e-mail comum, sem botões, e vence sozinha. **Não visto em navegador.**

## R206 — 27 de novembro de 2026: quando, para quem e em quais dias (v2.3.0-dev, MEDIA)

- **Quando:** a cada tick semanal (uma segunda cruzada) um sorteio com semente (`careerSeed`, temporada, semana absoluta). Chance = `min(0,20; 0,03 + 0,0015 × reputação)`, vezes `1 + 0,5 × min(1, seguidores / 4000)` com o feed ligado: 3 % / 10,5 % / 18 % por semana com reputação 0 / 50 / 100. Nunca antes da semana 3, uma oferta aberta por vez, e 2 semanas de intervalo depois de cada oferta.
- **Quem:** um jogador do elenco, sorteado com peso `overall²` (o nome mais procurado). **Dias:** 2 a 4 dias; o primeiro dia fica de 2 a 6 dias depois da segunda do sorteio; tudo dentro da mesma temporada. Até 6 tentativas de (jogador, datas); se nenhuma passa pela regra do R207, não há oferta.
- **A marca** é um índice no banco de 15 paródias (`copy.career.media.*`); nunca uma empresa real (um teste confere contra a lista dos nomes reais parodiados).

## R207 — 27 de novembro de 2026: usa o sistema de ausência existente, e o time nunca fica curto (v2.3.0-dev, MEDIA)

- **O sistema existente é `pendingUnavailability`** (o de doença e fadiga: um jogador fora de um evento, com a nota que nomeia causa e jogador). Aceitar, com um evento do clube já comprometido dentro dos dias, grava `{ playerId, eventId, reason: "media" }`; o lobby, o HQ e `userTeamForEvent` já leem isso. Sem evento nos dias, não há o que vetar: o jogador só fica registrado como fora (`awayOn`) e o dinheiro entra.
- **"Evento do clube"** = o que `userEventDefOnDay` diz que ocupa o dia, só oficiais (qualifier, regional, Major, Worlds); copas t2/t3 e formatos 1v1/2v2 não contam. Um Major ou Worlds com campo já decidido sem o clube não conta; campo ainda indefinido conta (o lado seguro).
- **M3, `leavesEnough`:** com o jogador fora restam pelo menos 3, e se ele é titular existe reserva registrada e livre (a regra `reserveCovers`). Um evento que já tem outro ausente (a rolagem de doença) ou outra viagem marcada recusa a data. Um clube de 3 jogadores nunca recebe data com evento; datas sem evento continuam possíveis.
- **Limite conhecido:** a rolagem de doença roda na segunda da semana do evento e pode cair depois do aceite. Se ela pega outro jogador para o mesmo evento e a viagem ainda não foi paga, a viagem é cancelada (e-mail `mediaCalledOff`, nada pago). Se vender ou liberar o jogador antes do primeiro dia, o mesmo.

## R208 — 27 de novembro de 2026: o dinheiro, modesto, e o que não foi medido (v2.3.0-dev, MEDIA)

- **Valor:** `tierValuePerWeek` do tier de patrocínio que a reputação alcança (os mesmos `repGate`), na temporada e dificuldade do save, que já é o ganho semanal de um patrocinador típico nessa reputação. Vezes `weeks` (1) × 0,8 / 1 / 1,2 para 2 / 3 / 4 dias, ± 15 % semeado, quantizado. Temporada 1, Normal: cerca de $750 (tier 1) a $9.350 (tier 4, 4 dias).
- **Lançamento:** um tipo novo de lançamento, `mediaDay` ("Dia de mídia", com a marca como referência), no primeiro dia fora e uma vez só (o trecho `paid` do trip). Fica de fora do teto de renda "outra" dos inserts de propósito: não consome vaga de insert.
- **Não medido:** nenhum número passou por bateria; só a conta contra o `tierValuePerWeek`. A oferta mostra o valor antes de aceitar; o jogador decide.

## R209 — 27 de novembro de 2026: repetir o mesmo jogador cansa, só com o vestiário ligado (v2.3.0-dev, MEDIA)

- **Regra:** uma segunda viagem do mesmo jogador até 6 semanas depois da primeira (contadas da semana do primeiro dia fora) tira 6 de moral dele pela API da onda 1 (`nudgeMorale`, motivo novo `mediaFatigue`: "ele foi enviado a outro dia de mídia logo depois do último"). O motivo aparece no e-mail de humor, quando o humor muda de faixa, e em `lockerRoom.players[id].last` e no log.
- **Aviso na oferta:** a oferta já diz que repetir pesa, mas só com o vestiário ligado (sem custo, sem aviso). Com o vestiário desligado nada é escrito em `lockerRoom`.
- **Efeito colateral aceito:** o vestiário da onda 1 conta um evento sem ele no time como "banco" (R191); um dia de mídia que o tira de um evento entra nessa conta como qualquer outra ausência.

## R177 — 27 de novembro de 2026: a diretoria de uma org consolidada define o mandato, o manager não escolhe (v2.2 ORGMODE 2027, front MANDATE; BALANCE_VERSION 54)

- **Decidido:** numa org consolidada a temporada abre com o mandato da diretoria: três metas, classificação, dinheiro e elenco, cada uma com o que dá se cumprida e o que custa se perdida (confiança, passo do orçamento da próxima temporada, bônus). Não há escolha: os três planos e as faixas de chance saem desse modo; o clube fundado continua com os três planos exatamente como antes. A classificação é o objetivo Expected do patamar com a mira movida pelo nível de exigência; no motor é o único pacote da temporada (`offers` com id "expected", com os termos do mandato), então pontos de controle, ultimato, revisão, meta da HQ e o orçamento seguem funcionando sem caminho novo. O secundário e o legado não existem numa temporada com mandato (as metas de dinheiro e elenco ocupam esse lugar).
- **Termos (`CAREER_BOARD.mandate.terms`):** classificação +12 / −18 de confiança, ±5 % de orçamento, bônus de 4 semanas da folha; dinheiro +5 / −6, ±5 %; elenco +5 / −6, bônus de 1,5 semana. Perdas × paciência do patamar e da dificuldade; ganhos e perdas × `stakes` da exigência (baixa 0,85, média 1, alta 1,2). A classificação pesa mais.
- **Como o jogador é avisado:** depois da tela de chegada, um pop-up (portal no `<body>`, sem fechar, um botão "Começar a temporada"); em toda temporada nova de novo, com a última temporada (as três decisões e o recado da diretoria). Na caixa de entrada: as boas-vindas do dono (com a história da org no dataset: temporadas da RLCS, a primeira, quantas entre as fortes da região) e o mail do mandato; os mails da semana 11 e 21 relatam as três; o veredito da revisão também. A mesa de patrocínio abre quando o mandato é lido.
- **Por quê:** Miguel, 27/11: "Não deve ter a opção de escolher qual meta você quer... deve somente receber um pop up avisando quais as suas metas e o que você ganha/perde com isso."
- **Não verificado:** os números dos termos não foram ajustados por medição; o ultimato e a demissão continuam lendo só a confiança.

## R178 — 27 de novembro de 2026: os problemas da casa e o nível de exigência (v2.2 ORGMODE 2027, front MANDATE)

- **Decidido:** `orgIssuesOf(save)` lê a org como ela está e devolve até três problemas, do mais urgente: contrato de titular acabando, folha acima de 92 % do teto, caixa abaixo de 4 semanas da conta corrente, elo fraco (um titular 4+ pontos abaixo da média dos outros dois), núcleo velho, entrosamento baixo, sem técnico, sem reserva, banco caro, promessa fora do trio, patrocínio acabando, sem patrocinador, contratos acabando na próxima, pouca margem na folha. A meta de dinheiro sai de um problema de dinheiro (folha → baixar a folha até a semana 21; caixa → terminar com um piso; banco caro → arrecadar em vendas), senão do patamar (elite e candidato: gasto líquido em transferências dentro de um teto; meio e azarão: piso de caixa). A meta de elenco sai de um problema de elenco (contrato → renovar o nomeado; elo fraco → contratar um titular na régua; núcleo velho → baixar a média de idade; promessa no banco → escalar em 6 eventos; entrosamento → manter o núcleo), senão da exigência (alta: contratar; as outras: manter o núcleo). O nível de exigência é a soma do patamar (0 a 3) e do prestígio do dataset (−0,5 a +1): alta a partir de 2,5, média a partir de 1.
- **Forma para a etapa 3:** `OrgIssue` nomeia a situação e o jogador, nunca a solução; as metas guardam o problema que respondem (`issue`). Cláusulas, pedidos à diretoria e departamentos se penduram nesses tipos.
- **Leitura:** com os dados de 2020 as orgs tomadas são uniformes (elenco jovem, contratos de 2 a 3 temporadas, folha a 80-84 % do teto, sem reserva), então na chegada os problemas mais comuns são "sem reserva", "sem patrocinador", "pouca margem" e, em algumas, "elo fraco" e "sem técnico". Os problemas de contrato e de idade aparecem nas temporadas seguintes e numa chegada em 2027 (front ERA).
- **Não verificado:** o conjunto de problemas numa chegada em 2027 (depende do front ERA).

## R179 — 27 de novembro de 2026: as contas do mandato e os bots (v2.2 ORGMODE 2027, front MANDATE)

- **Decidido:** o dinheiro de transferências da temporada é contado por `pushLedger` num campo opcional `finances.transferTally` que só o mandato cria (o razão guarda menos que uma temporada); um clube fundado nunca o tem. O piso de caixa lê o saldo antes dos bônus da revisão. A meta de folha é lida na fronteira da semana 21 e de novo na revisão. Os eventos da promessa contam no `ingestResult` (titular escalado num evento oficial). O bot competente (`tuned`, `followsMandate`) trabalha o mandato: renova o nomeado, não vende nem dispensa os nomeados, contrata o titular na régua, escala a promessa, aceita oferta pelo reserva quando a meta é de vendas, e só contrata dentro da meta de dinheiro. Qualquer bot lê o mandato (`boardAutoAnswer`), então nenhum trava nele.
- **Sobreviver antes de manter o núcleo:** o bot competente vende um jogador nomeado pela meta quando o caixa aperta (a meta fica perdida). Sem isso, duas tomadas de 2027 (NA Hard, meio e azarão, seed 30000) quebraram: recusaram as ofertas que o rc.6 aceitava e caíram no empréstimo de emergência. A contratação do mandato também lê o saldo previsto da temporada.
- **2027 (depois do merge com o ERA):** as telas da diretoria leem a temporada da carreira (`careerSeasonOf`) ou o ano (`seasonLabelFor`); a régua de contratação tem teto por patamar (`barMax`; uma elite de 2027 tem o pior titular em 91-93 e pedia 95); "sem patrocinador" não conta na primeira semana da diretoria.
- **Medido:** BOARD_PROBE de checagem em 2027 (24 carreiras, 3 temporadas, NA/EU/SAM, Normal e Hard): 24/24 terminam, 0 soft lock, 0 demissão, 0 insolvência; `BOARD_SOFT` 2/2 em 2020 e em 2027. Números por patamar e por tipo de meta no handoff `ORGMODE-2027-MANDATE.md`.

## R180 — 27 de novembro de 2026: em 2027 o declínio de um jogador real não começa antes dos 24 a 27 anos (v2.2.0-rc.7, integração; BALANCE_VERSION 55)

- **Achado na passada do navegador:** no dossiê da FURIA em RLCS 2027, kv1 (21) e yanxnz (23) apareciam "em declínio" no primeiro dia. Medido em dois mundos de 2027 (seeds 5150 e 9100): 19 e 20 dos 36 jogadores reais de 88+ começavam depois do platô (Vatira e Daniel aos 21, Firstkiller aos 23); na faixa de 22 a 23 anos, 42 de 63.
- **Causa:** o arco de um jogador real data o auge pela melhor carta dele (`developmentProfileOf`). Com os dados acabando no início da carreira, a melhor carta é só a última coisa que a base viu. Enquanto os reais seguiam as cartas isso não aparecia; o R175 tirou todos do roteiro num mundo de 2027.
- **Decidido:** num mundo da última era, o declínio de um jogador real nunca começa antes de uma idade sorteada por seed e jogador em `CAREER_ERA.longCareers.declineFromAgeWeights` (24: 20 %, 25: 30 %, 26: 30 %, 27: 20 %). Todo leitor começa o declínio em `peakAge + plateauYears`, então a alavanca é a idade de auge da visão (`lateArcPeakOf`): ela vai para (essa idade − o platô dele) quando isso é mais tarde. Quem já passou da idade sorteada segue em declínio. Os outros mundos (fundado, eras 1 a 5) leem o arco dos dados, intocado (teste em `era.e3.test.ts`).
- **Efeito colateral aceito:** um jovem com teto projetado cresce um pouco mais devagar, porque o ritmo divide a distância pelos anos até o auge, e o auge ficou mais tarde.
- **Não medido:** as parcelas do R175 (ativos depois de 3, 6 e 8 temporadas; reais no top 30) não foram refeitas com esta regra. O esperado é mais reais no top 30 na 8ª temporada e um mundo ainda mais forte.
- **Outros acertos da integração (sem número próprio):** a meta de contratação do mandato só é pedida quando a régua fica acima do pior titular (a Gentle Mates, 96 / 95 / 94, recebia "contrate um titular de 93 ou mais"; agora recebe "mantenha o núcleo"); a tomada não repõe um time genérico numa região que segue no piso de 16 orgs sem a org tomada (EU e NA em 2027); "o patrocínio acaba" só é problema a 56 dias do fim (`issues.sponsorEndingDays`; um contrato de uma temporada era lido como acabando no dia da assinatura).

## R210 — 27 de novembro de 2026: formatos dos Majors e do Worlds por temporada (branch `v22/event-formats`, integrado ao staging em 27/11; BALANCE_VERSION 57 na integração)

- **Decidido (Miguel):** os três Majors de cada temporada e o Worlds seguem o documento "Formatos dos Majors e Worlds no Road to Worlds" (linhas em `CAREER_EVENT_LAYOUTS`, spec `docs/handoff-2.2/FORMATS-SPEC.md`). O Worlds da Season X continua cancelado (C1 fica). A partir de 2027 as temporadas alternam pelas seis linhas em ordem (2027 = linha da Season X, com o Worlds dela jogado). Fase 1 em Bo5, chave em Bo7, grande final em uma série. Só modo crie sua org por enquanto; o modo escolher org herda a mesma tabela se usar o calendário oficial.
- **Decidido (por mim, a pedido do Miguel):** cada evento distribui o mesmo total de pontos e prêmio que o formato clássico; colocações empatadas recebem a média das posições que cobrem, e onde a chave separa 9º–12º de 13º–16º o primeiro grupo leva 1/6 acima e o segundo 1/6 abaixo do valor clássico. Sorteio dos grupos por potes de rating, evitando a mesma região no grupo quando der.
- **Regras de engenharia:** o formato é carimbado no `TournamentState` quando o evento começa (`layout`), então um save no meio de um Major termina no formato em que começou. A eliminação dupla de 16 joga quatro rodadas no sábado (até sobrarem oito) e pausa como as outras. Persist e saveVersion não mudam.
- **Medido:** `eventLayouts.test.ts` (todo formato chega a um campeão com o número certo de séries e as contagens de colocação que a tabela de prêmio paga, determinístico, total de pontos e prêmio igual ao clássico); `careerEventFormats.test.ts` (o usuário joga o Major em cada formato pelo fluxo real: sábado até a pausa, domingo até o fim, liquidação pela chave); probe de carreira EU Normal, 7 temporadas, 13 eventos nos formatos certos, sem travar. Telas vistas no navegador em 800 px e 375 px.
- **Não verificado:** chance de título por formato (bateria pareada antes/depois em NA/EU/SAM, Normal/Hard), o probe de soft-lock completo com a flag, e o caminho do usuário além do primeiro Major (o bot da probe não chegou a um Major em 7 temporadas).

## R220 — 27 de novembro de 2026: a org consolidada tem a sua própria progressão, sem a prateleira do clube fundado (v2.2.0-dev, rc.9 ORG)

- **Decidido:** uma org consolidada não compra "periféricos" nem "monitores 240Hz". O catálogo dela (`engine/career/orgCatalogue.ts`) tem estruturas que sobem de nível com o aval da diretoria e departamentos com gente: centro de treinamento (níveis 1 a 3), centro de performance (nível único, o projeto de aval mais alto), desenvolvimento de jogadores, análise, psicologia do esporte, saúde e preparação física, comercial, e o bootcamp de evento. O que o patamar já tem está montado no primeiro dia e aparece como tal (`standard`).
- **Balanço intacto:** cada item é um efeito que o motor já tinha. Nível n do centro de treinamento = as n primeiras instalações do clube fundado (periféricos, monitores, PCs: mesmo preço, manutenção, +5/+5/+10 % de treino, buff); centro de performance = `perfCenter`; desenvolvimento = `assistant`; análise = `analyst`; psicologia = `psychologist`; saúde = `physio`; comercial = `brand`; bootcamp de evento = bootcamp nível 2. O save guarda o mesmo `finances.gear`: nada novo é escrito, e um save do rc.8 lê os seus itens como níveis (um item comprado fora de ordem conta uma vez).
- **Nenhum nome do clube fundado chega a um save consolidado:** `ladderOf` e `toolboxUnlockedIds` voltam vazios (sem tag "Novo", sem o modal "Novas possibilidades"), nenhum aviso de desbloqueio sai (nem os níveis de patrocínio), a linha do razão e as opções de melhoria da diretoria levam o id do catálogo, e o overlay `orgmode.words` renomeia todo nome que as telas antigas ainda buscam pelo id do clube fundado. `rc9Org.test.ts` percorre catálogos, toolbox, aviso de desbloqueio, melhoria da diretoria, notícias, mails e razão e falha num nome do clube fundado.
- **Não feito:** olheiros (não há efeito no motor para mapear sem mexer no balanço); a melhoria paga pela diretoria e o razão ainda são lidos pela tela com a cópia sem overlay (`BoardScreen` usa `useCareerCopy`), o que a onda 2 resolve.

## R221 — 27 de novembro de 2026: a org chega com um patrocínio em vigor (v2.2.0-dev, rc.9 ORG)

- **Decidido:** uma tomada de controle não abre com proposta de patrocínio. A org chega com um contrato assinado antes da chegada do manager: a oferta do perfil do patamar (`CAREER_ORG.inheritedSponsor`: Steady para azarão e meio de tabela, Balanced para candidato e elite) que a mesa da org faria naquele dia, com as mesmas marcas, valores, meta e multas. Ele vale até o fim da temporada (o último split), paga toda segunda, e a parte fixa entra no caixa no primeiro dia, como entraria numa assinatura: o dinheiro é o mesmo de quem assinava a mesa no dia 1. Um mail do Patrocínio diz o que o contrato paga, o que pede e quando termina.
- **A primeira negociação é a renovação:** quando o contrato herdado termina, a mesa abre e a mesma marca volta com a oferta do mesmo perfil (`renewInheritedBrand`, mesmo nível só). A mesa de patrocínio segue igual para as temporadas seguintes.
- **Não feito:** uma troca de emprego para outra org (proposta aceita na revisão) ainda chega sem contrato e abre a mesa depois do mandato; o caminho de virada de temporada é delicado e ficou fora desta passada.

## R222 — 27 de novembro de 2026: o prestígio de uma org consolidada é uma palavra, e o dono escreve quando ele muda (v2.2.0-dev, rc.9 ORG)

- **Decidido:** numa org consolidada o número do prestígio não aparece. `standingSenseOf` dá o patamar como palavra, para onde ele está indo (subindo, estável, caindo: acima da linha de promoção, abaixo do piso), o que significa na prática (o teto de contratação do patamar, o que a diretoria cobra, quanto uma meta perdida pesa) e nenhum número além do teto de contratação, que é a regra do mercado. `reputationFigureOf` devolve `null` para a org consolidada (a barra do topo deve ler isso). As linhas de meta e de inserts trocam "+4 de prestígio" por frases sem número.
- **A carta do dono:** quando o patamar muda na revisão, o dono escreve (`ownerTierUp` / `ownerTierDown`, de "O Dono"): onde a org está agora e o que muda no mercado e na cobrança, em EN e PT, escrita como pessoa. Ela substitui o aviso da diretoria (`boardTierUp`/`Down`); a notícia da cena continua.

## R223 — 27 de novembro de 2026: uma verdade para o dinheiro da org (v2.2.0-dev, rc.9 ORG)

- **A causa:** a verba da temporada (1,3M) e o caixa (1,8M) não são dois potes. A diretoria deposita a verba uma vez no caixa quando o mandato é lido; o caixa também guarda o que a org já tinha (a reserva da chegada, o dinheiro da temporada anterior) e se move toda semana. A tela mostrava as duas como se fossem comparáveis, e o card de saldo repetia os números.
- **Decidido:** `seasonMoneyOf` (engine `budget.ts`) é o resumo único: caixa hoje; o que a temporada ainda compromete (salários, coach, departamentos, manutenção, empréstimo); a receita ainda contratada (patrocínio, torcida); o fim da temporada neste ritmo; o que o plano da diretoria segura (o piso de caixa da meta de dinheiro, ou a parte que o limite de gasto líquido em transferências não deixa usar); o livre para gastar; e a ponte verba → caixa (`caixa = abertura + verba + líquido desde então`), com a frase que explica a diferença. As identidades valem por construção e os testes as conferem: fim = caixa + receita contratada − compromissos (= `seasonBudgetOf.free`), livre + retido = fim, abertura + verba + líquido = caixa.
- **Dado novo:** `BoardSeason.openingCash` (opcional, aditivo), o caixa no momento em que a diretoria define a temporada, antes da verba.

## R224 — 27 de novembro de 2026: o que fica para a onda 2 nas telas da org (v2.2.0-dev, rc.9 ORG)

- A página da Diretoria deve ser alcançável do HQ: uma aba própria na barra da carreira para a org consolidada (o clube fundado não precisa dela), e o bloco da diretoria do HQ e a página Clube levando até ela. Os seletores, chaves e blocos redundantes estão em `docs/handoff-rc9/ORG.md`.

## R225 — 27 de novembro de 2026: um save de tomada do rc.8 abre e continua (v2.2.0-dev, rc.9 ORG)

- **Decidido:** um reparo a cada carregamento (`repairEstablishedOnLoad`, idempotente, sem mudar versão): a abertura de caixa da temporada é reconstruída do razão (o caixa antes da linha da verba da diretoria, quando ela ainda está no razão; com o mandato ainda não lido, o caixa em mãos). Nada mais é escrito: o catálogo lê os itens como níveis, a mesa de patrocínio aberta (ou o contrato assinado) do rc.8 segue, o patamar lê a estatura da diretoria. Um save do rc.8 com a mesa aberta continua com a mesa; não recebe um contrato herdado por cima da escolha do jogador.

## R240 — 27 de novembro de 2026: a série no modo Comandar é um plano e um jogo ao vivo (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** a mesa jogo a jogo do slice 5 sai. No modo Comandar, a série é um plano antes do jogo 1 (três diretrizes) e depois roda sozinha, jogo após jogo, sem parada entre eles (Miguel, 27/11: "a pausa entre cada jogo ... quebra muito o fluxo"). O técnico faz as escolhas de intervalo (o tempo técnico, o ajuste depois de uma derrota), como no modo rápido. Cliques por série: 2 (Jogar a série, Continuar); pular: 1. O motor: `playUserNext` / `playUserSeriesNextFlow` jogam o próximo jogo com o intervalo do técnico antes, exatamente como `playOutWithCoach`.
- **Prova:** `careerMatchday.rc9.test.ts`: assistida jogo a jogo, pulada no plano, pulada depois de um jogo e o modo rápido dão o mesmo evento com o plano do técnico; com o plano do jogador, as três formas dão o mesmo evento; recarregar entre os jogos não muda nada.

## R241 — 27 de novembro de 2026: a história de um jogo não depende dos jogos seguintes (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** `timelineSeed` passa a ler só os jogos até o atual. Assim o jogo ao vivo (a série ainda pela metade) e a súmula depois da série contam a mesma história. Só apresentação: nenhum resultado lê esse seed.
- **O que muda para quem já jogou:** os minutos dos gols, a ordem dos artilheiros dentro do jogo, assistências, chutes, defesas e demolições dos jogos que não são o último de uma série passam a ser outros na Match Center, na súmula (`SeriesBoxScoreView`), no replay de desafios (`ChallengeMatchBoard`) e no duelo (`duelMatch`, que chama `buildGameTimeline`). Placar, vencedor e artilheiros por jogo não mudam. As estatísticas da temporada já gravadas (`boxStats`) ficam como estão; eventos novos somam com a história nova.

## R242 — 27 de novembro de 2026: marcar o armador é uma troca (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** marcar o jogador certo custa `markRightCost` = −0,08 por jogo (prende um defensor). O valor da marcação é `markValue` (as jogadas especiais cortadas, a mesma fórmula de `match.ts`); o técnico só marca quando vale (`markWorthIt`). Dentro do teto do plano (±0,4, `planCap`, MATCHDAY-SPEC §7); `matchday.test.ts` confere.

## R243 — 27 de novembro de 2026: a linha do plano vem do registro do motor (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** cada jogo da série do usuário grava o que o plano fez (`userLog`: estilos, vantagem de confronto calculada, marcação, risco, vitória, quanto embalo o tempo técnico cortou). A linha depois da série (`planLine`) só monta frases a partir desses fatos. Campo opcional, nunca lido pela simulação.

## R244 — 27 de novembro de 2026: o jogo ao vivo (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** `components/match/LiveGameView` (reutilizável no duelo): o relógio corre, os gols entram no minuto com o autor, placar e estatísticas sobem com o relógio, a prorrogação é um momento próprio, o fim apaga o placar do perdedor. Ritmo em `MATCH_LIVE` (balance.ts): 5:00 vazio em 12 s a 1×; velocidades 1×, 2×, 4×.

## R245 — 27 de novembro de 2026: um ajuste de dia de jogo, no Treino, marcado BETA (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** três níveis: Só o resultado (eventos vão ao resultado), Assistir (suas séries passam ao vivo, o técnico monta o plano), Comandar (você faz o plano antes de cada série). Mora no Treino (saiu do Clube). O botão principal do lobby segue o nível; o outro caminho fica a um toque.

## R246 — 27 de novembro de 2026: o evento não para de novo depois da série (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido:** a parada do slice 5 depois de uma série jogada na mesa sai: o fim da série já mostrou resultado e súmula. Continuar marca a rodada como vista (mesmo depois de um remount), então a série não é reprisada na Match Center.

## R247 — 27 de novembro de 2026: o tempo técnico é um botão sempre à mão (v2.2.0-dev, rc.9 MATCHDAY)

- **Decidido (Miguel, 27/11):** "o botão deve estar disponível o tempo todo, e ao clicar você pede o timeout no próximo intervalo." O botão fica nos controles do jogo ao vivo; pedido, ele é gasto no próximo intervalo (`callTimeout`, um por série) e pode ser desfeito até lá; depois mostra "usado". Sem modal, sem contagem.

## R248 — 27 de novembro de 2026: sem número

## R249 — 27 de novembro de 2026: sem número
