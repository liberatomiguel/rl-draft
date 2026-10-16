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
  0.05 / xpWeeks 0.5, the daily-poach rates, negotiation reserveFloor 0.88,
  the filler headliner band 77–84.
