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

## Still open for Miguel (career mode)

The design doc's §21 `[DECIDE]` list — the resolved ones (roster-churn tiers,
$1M Worlds pool, fixed-ask→negotiation, career→profile progression, mobile
6-nav, no manual saves, auto-train default ON, Season X alternate history) are
LOCKED and built. Remaining review items:

- **Beat corpus** — the ~30 hand-written scripted beats (EN+PT) for launch is
  the biggest content ask; currently a partial floor.
- **`born:` rows** for the ~150–200 modern-era players (ages are inferred
  today; §21.13 PT glossary tone check also pending).
- **`CAREER_ARC` pacing harness** — the 120-career difficulty sweep isn't built
  yet; v0.3 moved the whole money surface, so the economy bands need a
  re-validation pass after Miguel plays.
- **First-guess tunables to confirm after playtests:** scrim chemistryCredit
  0.05 / xpWeeks 0.5, the daily-poach rates, the talk's flexibility floor 0.94 (rc.33, R64),
  the filler headliner band 77–84.
