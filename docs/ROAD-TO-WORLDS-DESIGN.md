# Road to Worlds — design guide

> **Status: DESIGN, v0 (2026-07-07).** The base for the career-mode workstream
> (target versions v1.5.0-alpha → v1.6.0, all behind `FEATURES.careerMode`).
> Produced by a multi-agent design pass (6 subsystem designers + 3 adversarial
> critics) over the full v1.4.4 codebase, synthesized and reconciled by the
> lead-design pass. Every number below is an **initial tunable** for
> `balance.ts` `CAREER_*` groups — the harnesses (§17) own the final values.
> Open items for Miguel are collected in §21 `[DECIDE]`.
>
> **v0.1 adjustment pass (2026-07-09, Miguel — LOCKED):** squad cap **4**
> (3 starters + 1 sub) · RL-realistic ages (prospects debut **13-15**, careers
> generally end **~24-25**) · match XP scales with **field quality** (share of
> high-overall teams present) and unofficials DO grant it · cosmetic **team
> star rating (0-4★)** from overall+reputation · bankruptcy rescue happens
> **once** — going broke again after the rescue ends the career (real game
> over) · **reputation can fall** on missed stated expectations · staff/buff
> purchases **unlock progressively** along the career · there **IS** a
> transfer window before Worlds · region relocation stays a future unlock
> (expensive but attainable) · progression must make what's still lockable
> **visible** · every match is **simulated and presented individually**
> (animated goals, scorers, per-game flow — never a static results dump).
> The affected sections below have been updated to match.
>
> **v0.3 adjustment pass (2026-07-11, Miguel's second playtest list — LOCKED,
> BUILT):** (1) FIFA-style day AUTOPLAY is the primary advance (▶/⏸ +
> self-pausing autopilot; the batched skip demoted to secondary) + a career
> toast layer narrating mail/priority news; (2) scrims are schedulable with
> opponent choice, engine-truth benefit preview, a per-game result log and a
> same-day rematch guard; (3) SALARY NEGOTIATION ships in v1 after all —
> bounded counter-offers against a deterministic hidden reserve with the TRUE
> accept odds shown (supersedes §21.4's fixed-ask recommendation; sliders stay
> out); (4) the §21.3 soft-premium star-gate is REPLACED by a visible rep cap
> on new signings (74 + 0.3×rep, free at 84; locked rows stay browsable) and
> coach hiring is earned at rep 10; (5) ONE unified market value anchors every
> fee (AI↔AI fiction, AI bids — which now land on ANY window day and also hunt
> prospects — and user buys), prizes grow ×1.12^season, sponsors ×1.10^season;
> (6) the AI needs pass shops lower-rated orgs (org↔org fee trades) and a
> scavenger pass drains displaced quality from the FA pool; a transfer wire +
> window-close report make the market legible; (7) training anti-stagnation:
> weeklyBase 0.13, headroomSoftK 2.5, match-prep weeks train at 0.5 share
> (never freeze), 4-decimal tick quantization, ages 21-24 lifted; (8) early
> rep floor — regional swiss exits and unofficial finals pay +1; (9) fictional
> players develop every rollover, wonderkid 8%, headliner slots 77-84;
> (10) Backer debt is repayable (sales amortize 50% + manual pay-down);
> (11) org rosters inspectable everywhere (OrgSheet); (12) classic 22-tone
> crest palette + badge/banner shapes, lion/comet/anchor/trident symbols,
> sash/quarters patterns. Save v3 (additive). Affected clauses below are
> superseded accordingly.
>
> **v0.2 adjustment pass (2026-07-09/10, Miguel's playtest feedback — LOCKED,
> BUILT):** supersedes the "one clock = weeks" rule and several v0/v0.1 values.
> 1. **DAY CLOCK (FIFA-career style).** The playable unit is the day:
>    `clock = {seasonIndex, day}` (1..224; 7-day Monday-start weeks over the
>    same 32-week grid — seed streams stay week-keyed, so determinism holds).
>    Real calendar dates per season (`CAREER_SEASONS[i].startDate`, always a
>    Monday; Season X starts 2020-10-05). Weekly world processing lands on
>    Mondays; training runs Mon-Fri; official/unofficial events play on
>    **Saturday** (matchday); Sunday rests. Continue = advance to the next
>    stop (matchday, window-open Monday, pending decision); "advance one day"
>    always available. Officials block the clock until played/simmed;
>    advancing past an unofficial matchday declines it.
> 2. **Between-event actions:** **scrims** (CAREER_SCRIM) — up to 2 weekday
>    blocks/week, one Bo5 vs a nearby-strength regional org, granting a small
>    chemistry credit + light match XP; plus the training plan below. The
>    empty click-to-next-event stretch is gone.
> 3. **Training v2:** single-attribute focus now trains overall at **0.9**
>    share (was 0.7) + a bigger offset (+0.35/wk) — balanced no longer
>    dominates; `auto` uses the coach's plan at 0.95 share and falls back to
>    balanced without a coach (no double penalty). NEW per-player
>    **intensity** (light 0.6× / normal 1× / heavy 1.35×; heavy adds a small,
>    telegraphed pre-event unavailability risk). Daily ticks (weeklyBase ÷ 5).
>    UI projections come from the engine (`trainingProjection`), never UI math.
> 4. **Economy rescale (garage-org start):** startingBudget 20k/12k/8k;
>    salary curve $1.5k @ OVR 70, growth 1.2/pt, floor $250 (entry salaries in
>    the hundreds; stars cost fortunes); prizes t3 $2k · t2 $10k · regional
>    $40k · major $150k · **worlds $600k**; sponsor tiers $1.5k/6k/18k/45k
>    base; fees floor $2.5k; scout $2.5k; loan floor −$5k; quantum $50.
> 5. **Gear & staff ladder (replaces generic facilities):** peripherals (rep
>    8, $1.5k) → monitors (14, $4k) → PCs (20, $10k, +buff level) → bootcamp
>    T1 (26, $4k/run) → structured bootcamp T2 (38, $10k/run) → sports
>    psychologist (46, $4k/split) → Performance Center (55, $60k, +2 buff
>    levels). Bought strictly in order; training bonuses stack to +35%.
>    **Sponsor perks**: tier 2+ discounts gear (20/35/50%), tier 3+ grants
>    free bootcamps (1/2 per season).
> 6. **Coach market:** hireable coaches in a Market tab — **real retired
>    pros** (from the world's retirement flow, coachOVR = 55 + 0.25 × final
>    OVR) mixed with generated names (CAREER_COACH_MARKET); hiring validates
>    the shortlist and replacing pays a split of severance.
> 7. **Stars v2:** 0-**5★ in half-star steps**, world-percentile driven
>    (0.8 × rating percentile across all live orgs + 0.2 × prestige tier) —
>    the strong always read strong by construction (the v0.1 absolute band
>    under-rated contenders).
> 8. **Chemistry swap softening:** a newcomer's pairs inherit
>    `newcomerGraceFactor` (0.35) of the strongest incumbent pair's tenure —
>    an established core absorbs one new face (~85% → ~60% instead of
>    halving); maxRawPerPair 6.0 keeps Perfect reachable.
> 9. **HQ + Inbox split:** the news feed (now with body text per template,
>    `news.body.*`) lives on the HQ dashboard; the Inbox is **mail only** —
>    actionable items addressed to the manager (transfer bids, sponsor
>    offers/settlements, contract notices, backer, unlocks) as `save.mail`
>    (MailItem, per-item read state).
> 10. **Event screen rebuilt** to the classic-TournamentScreen bar: full-field
>    reveal (AI ticker + user goal-by-goal), live spoiler-safe Swiss
>    standings, playoff bracket, working speeds/skip/sim, instant mode goes
>    straight to an animated digest (CAREER_PLAYBACK pacing group).
> 11. **Crest v2 + procedural org marks:** crestId encodes
>    `shape[:symbol[:pattern]]` (back-compatible); filler orgs get
>    deterministic procedural crests (every team has a logo).
> 12. Save bump to v2 with in-place migration (week→day Monday, facilities→
>    gear, mail/scrims/seq defaults). §7's "no day sub-ticks" and §3's
>    "weeks, no dates" clauses are superseded by this pass.

---

## 1. The idea (one line)

A Football Manager / Brasfoot-style **career mode**: found an esports org at
RLCS Season X, sign and develop players, manage money and a calendar of
unofficial + official tournaments, and win the World Championship before the
end of 2026 — in a world that is **simulated but realistic**, drifting toward
real RLCS history unless you disrupt it.

## 2. Why it fits — and the north-star extension

- It aims at a **new audience** (FM/Brasfoot management players) while reusing
  ~70-80% of what's shipped: the match/series simulator, Swiss + double-elim
  formats, chemistry, rating, the deterministic RNG contract, the entire visual
  identity, and the era-sliced historical dataset (867 per-season player cards
  = real growth trajectories).
- It formalizes sanctioned backlog seeds: GAMEPLAY-IDEAS **B7** (budget/player
  costs), **B8** (AI GMs consuming the pool), **A4** (season cadence),
  **C11/C12** (traits/attributes — explicitly unblocked).
- **North star**: GAME-DESIGN §42 ("is this making the draft more fun, more
  readable or more replayable?") does not cover a management fantasy. Record a
  DESIGN-DECISIONS entry extending it for this mode:
  *"Career: is this making the climb from nobody to World Champion more
  meaningful, more legible, or more alive?"* §25 (overall dominant) and §39
  (user-facing simplicity) apply unchanged.

## 3. Design pillars (Miguel's five, made structural)

1. **Player experience first** — a confusing/tedious mechanic loses to a
   simpler one, even if less realistic.
2. **Authenticity without friction** — real data is the foundation; when
   realism and fun conflict, simplify **and telegraph the simplification**.
3. **Depth is optional** — every advanced mechanic ships with a fast path
   (auto / recommend / simulate). Presets change **defaults, never
   capabilities**, and every automated action is attributed ("Handled by
   coach") with a one-tap takeover.
4. **Decisions have visible consequences** — every confirm shows cost, new
   balance, and next-payday projection **before** commit. No hidden dice: all
   market/qualification math is deterministic and inspectable.
5. **The world moves without the player** — AI orgs transfer, develop, and
   win; the news feed is the proof.

Derived hard rules:
- **Failure is survivable — once.** Bankruptcy triggers a single Emergency
  Backer rescue per career; going broke **again** after the rescue ends the
  career (an "Insolvency" ending — game over is real, but never a surprise:
  every confirm that risks it warns first, and the Backer chip is a standing
  reminder). Sponsors never claw back (patience meter), every official
  placement pays something, an absent starter never forfeits an event
  (Emergency Stand-in). **Reputation can fall** when stated expectations are
  missed (always telegraphed via the Season Goals card) and rises with
  results.
- **Difficulty never filters the player's acquisition pool** (locked rule):
  it shapes opponents and money pressure only.
- **One clock, one currency name, one scale.** Weeks (no dates, no day
  sub-ticks), "Season Points", numeric 60-99 everywhere (potential included).

## 4. Player flow (the loop)

```
CREATE ORG (wizard: identity → crest/colors → region → starter roster → difficulty)
   ↓
┌──────────────────────────── SEASON (32 weeks) ────────────────────────────┐
│ Preseason (2w, window)                                                    │
│  → Split 1 (8w: R1·R2·R3·MAJOR)  → Window (2w)                            │
│  → Split 2 (8w)                  → Window (2w)                            │
│  → Split 3 (8w)                  → Worlds window (1w) → WORLDS (1w)        │
│ Between stops: train, sign, watch news — or just press CONTINUE           │
└───────────────┬───────────────────────────────────────────────────────────┘
                ↓ Season Review → rollover (world snaps toward real history)
     Worlds won? → CREDITS → retire or INFINITE MODE (2027+, procedural)
     End of 2026 without title → FINAL WHISTLE → retire or INFINITE MODE
```

The whole loop is drivable from **one labeled button**: `Continue` always
names its destination ("Advance to Regional 2 · Split 1 · Week 6") and
previews what will resolve. ~17 meaningful stops per season; target **one
split ≈ 30-45 min** per sitting.

## 5. Core decisions locked (the skeleton)

1. **Timeline**: starts at **RLCS Season X** (`rlcs-x`, dataset order 10) —
   the season the split format arrived. Alternate history, telegraphed by a
   preseason news beat: Season X's international Majors are played (COVID
   never grounds the circuit). Seasons: X, 2021-22, 2022-23, 2024, 2025, 2026
   → **6 seasons max** before the credits; every season uses the same uniform
   config-driven template (3 splits × [3 regionals + 1 Major] + Worlds).
2. **Clock**: 32 abstract weeks/season, labels "Split 2 · Week 3". No dates,
   no months, no day ticks. One `Advance` per week; consecutive open weeks
   auto-batch. Wages and paydays are **per split** (3 chunky paydays/season).
3. **Attributes**: the engine's existing six stats (offense, defense,
   mechanics, consistency, experience, clutch). Career adds **age** and
   **potential** (hidden scalar, shown as a numeric band). Overall stays
   60-99. **Form/morale: CUT from v1** — the ±4.5 per-series roll already IS
   the form budget (a visible form stat would double-count variance);
   `FEATURES.careerForm` reserved, and any v2 form must consume part of the
   ±4.5, never stack on it. *(Candidate for later: mint a collectible special
   card on career peak moments — a reward hook, not a managed stat.)*
4. **Engine reuse is the law**: `simulateSeries` resolves every match;
   16-Swiss→8-double-elim = regionals/Majors/Worlds verbatim; 8-team
   single-elim = unofficials; `fastForward` = every AI-only event and the
   "Sim" fast path. New engine code = new pure modules in `src/engine/career/`.
5. **Determinism**: one `careerSeed` + derived per-stream seeds
   (`deriveSeed(careerSeed, streamId)`, FNV-1a + fmix32) — never one linear
   cursor across the career. Only the user's in-progress event persists an RNG
   cursor (the runStore trick). Stream-id grammar is a compatibility surface.
6. **Separation**: new `/career` routes + persistent `careerStore`
   (`rocket-draft:career:v1`, 3 slots, additive migrate from day one). Career
   data in new lazily-loaded files (`src/data/career/`), never appended to
   pools existing modes read. Existing modes stay **byte-identical**, enforced
   by a golden-master suite committed before any refactor.
7. **User org is save-side** (never injected into `orgs.json`). The AI world
   = the dataset, expanded by Miguel's parallel data workstream (filler teams
   for 16-team regional fields).
8. **Economy fiction**: in-game USD, "close to real, simplified". No
   real-money mechanics (locked: no monetization).
9. **Squad model (v1)**: up to **4 contracted players — 3 starters + 1 sub
   (hard cap)** — + 1 coach + staff buffs. The 3-tuple Lineup is only the
   *fielded* trio.
10. **Officials are always entered** (the org holds a telegraphed "partner
    slot"; no open qualifiers in v1). Play or sim — never skip.

## 6. Career creation (wizard, 5 steps)

Reuses SetupScreen patterns; each step teaches its concept in one kicker line.

1. **Identity** — org name (2-18 chars, unique vs dataset), abbreviation
   (2-4, auto-suggested), manager name, country (CountryChip picker, defaults
   from locale).
2. **Crest & colors** — 12 predefined tintable SVG crests × 10 primary
   swatches (2 curated secondaries each, contrast-safe on `--bg`); live
   preview on a GameCard + mini FieldView. Rendered by a `UserCrest` grown
   from TeamLogo's monogram fallback. Colors re-tintable anytime; crest swap
   1×/season; name immutable (brand equity fiction).
3. **Region** — 7 region cards with strength indicator (avg top-8 OVR per
   era, derived at build time), 3 notable Season X rivals, Worlds-slot count.
   Region choice is a telegraphed difficulty lever (SAM/MENA/OCE = softer road,
   fewer slots). Locale-matching region pre-selected. Note: "relocation
   unlocks later" (v1.1 feature).
4. **Starter roster** — 3 offers built from org-less players (free-agent
   derivation + fictional fillers): **Prospects** (avg ~66 OVR, **14-16yo**,
   high POT), **Journeymen** (avg ~72, **21-23yo** — the scene's veterans,
   low POT), **Balanced** (avg ~69, mixed — pre-selected "Recommended").
   Each card: total OVR, avg age, POT bands, wage bill vs starting budget.
5. **Difficulty & summary** — easy/normal/hard cards (legacy reserved);
   management-style preset (Hands-on / **Balanced** / Delegate); collapsed
   custom-seed field; full recap → **"Found [ORG]"** splash (crest reveal,
   "EST. 2020").

**Quick start**: one ghost button randomizes everything → one confirm →
playing in under 20 seconds. Harness-asserted: first playable event within 2
stops of founding.

## 7. Calendar & season structure

- **Season layout (32w)**: W1-2 preseason (window open, sponsor offers);
  W3-10 Split 1 (R1 W4, R2 W6, R3 W8, **Major W10**); W11-12 window; W13-20
  Split 2; W21-22 window; W23-30 Split 3; **W31 Worlds window** (1 week — a
  last roster call before the big stage; Season Points no longer matter, so
  the visible cost of a late swap is chemistry, previewed on the confirm);
  W32 **Worlds**. Config-driven per season (`careerCalendar` data) so later
  seasons can vary.
- **Advance semantics** (one week): resolve player commitments (event → play
  or sim) → world-sim tick (AI events via `fastForward`; AI market moves if a
  window is open) → weekly training tick (user squad) → news digest → persist.
  The week card lists everything that will happen **before** the press.
- **Batching**: "Advance to next event" skips open weeks in one press,
  auto-applying the training plan and auto-entering recommended unofficials
  (default ON for Balanced/Delegate); the confirm sheet prices what's skipped.
- **Random events (v1 = exactly one type)**: "starter unavailable for one
  event". Owned by the calendar tick, stream `rand:{seasonId}:{week}`,
  ≤1 per split, **never in Split 1 of Season 1** (novice guard). This is what
  the sub slot and Emergency Stand-in exist for. Tilt/illness families,
  psychologist event-halving: cut from v1 (ship the risk with its insurance or
  ship neither).

### Points & qualification (one legible currency)

- **"Season Points"** (PT: *Pontos da Temporada*) — the only qualification
  currency, everywhere (standings, widget, warnings, news).
- **Regionals** award points by placement: `400/320/260/210/160/120/60-flat`
  (champion → swiss exit; flat for 9th-16th — readability wins). **Majors pay
  exactly 2×.** Worlds awards no points (it's the finale).
- **Major qualification**: split standings (reset per split) lock after R3;
  top K per region qualify — `NA 4 · EU 4 · SAM 2 · MENA 2 · OCE 2 · APAC 1 ·
  SSA 1` (= 16). Deterministic, telegraphed tiebreakers: points → event wins →
  best placement → latest regional → seeded coin-flip ("committee decision"
  news item).
- **Worlds qualification**: season standings (all official points, 3 splits)
  fill the same slot table after Split 3's Major. Pure points — no
  Major-winner auto-qual (simplification, telegraphed in the widget footnote).
- **Standings UX**: cut-lines drawn into the table; clinched / in contention /
  eliminated badges; "Road to Worlds" widget always on the Hub (points, gap to
  the line, points left on the board); "What do I need?" expands scenario math.

### Unofficial tournaments (v1: two tiers)

Offers appear on open weeks; entering consumes the week; **no entry fees**
(the cost is the calendar slot — skipping grants a "Training Week": +25%
training efficiency). No Season Points — official points stay clean.

| Tier | Name | Gate | Format | Pool | Notes |
|---|---|---|---|---|---|
| t3 | **Community Cup** | none | 8-team SE Bo5, field matchmade ±4 of user rating | $5k | max 2 entries/split; rep gain capped +2/split; offers stop above ~85 team rating ("you've outgrown the community circuit") |
| t2 | **Invitational** | rep 30 | 8-team SE Bo5, field = region's current top orgs | $25k | ~60% of eligible open weeks |
| t1 | *Circuit LAN* | — | — | — | **deferred to v1.1** (cross-region invite 16-Swiss LAN, W9/W19) |

Unofficials pay money + capped rep + **chemistry** (shared-event history) —
but **development match-XP comes from official events only** (kills the grind
double-dip). Auto-enter band: field median within ±3 of user rating.

### Spectator weeks (not qualified for a Major/Worlds)

Never a dead click: (1) **Sim results** (default) — one press, news digest +
standings movement + "what this means for you" line; (2) **Training Week**
consolation is automatic (+25% training that week); (3) full spectate
playback = v1.1 (needs the no-user-team results refactor). Other regions'
events resolve silently into news (only your region's officials + Worlds are
calendar stops). The first unqualified Worlds gets the styled "watch party"
framing; later ones get the standard digest.

### Season rollover (atomic, ordered)

Season Review (champion ceremony → your report card graded vs a stated
expectation → development recap → business recap) → **rollover sheet**
(expiring contracts w/ renew shortcuts, retirement warnings, next-season
teaser) → world advance: (a) **history gravity** — AI rosters snap toward the
next dataset season's real lineups (§12); (b) aging/decline/retirement pass;
(c) contracts tick, sponsor renewals; (d) new calendar from template. One
persisted step — a mid-rollover reload can't half-advance.

**Season Goals** (new, from critique): a preseason card states the season's
target computed from the same expectation formula that grades you ("Target:
reach a Major · stretch: regional top-4") and stays one line on the Hub — so
an 0-3 Swiss season 1 reads as the intended arc, not failure.

### Endgame + infinite mode

- **Win Worlds (≤2026)** → full credits: trophy lift, gold roster hall,
  journey montage, stats board, share card → fork: **Retire** (career archived
  read-only; profile milestone funnel fires) or **Continue** (defend the title
  through 2026, then infinite).
- **End of 2026 without the title** → "Final Whistle" retrospective (near-miss
  reel, respectful tone) → same fork.
- **Infinite mode (2027+)**: clones the 2026 template on `infinite:{n}` seed
  streams; historical beats stop; world evolves by simulation alone —
  retirement waves + procedural rookies (8/region/season; potential pyramid
  60%: 73-80, 25%: 81-87, 12%: 88-93, 3%: 94-99 — **generational tier
  unlocked only in infinite mode**; during 2020-26 procedural intake caps at
  ~88 ceiling so fictional regens never outshine the real zen/Vatira class).
  Economy freeze: salary inflation pinned at S6 level, T4 sponsor stays the
  income ceiling, prize/points tables flat. Legacy ceremony re-triggerable on
  retirement; first Worlds win keeps the only credits-fork.
- **Legacy Grade**: Legend (Worlds title) / Contender (Worlds top-4 or a
  Major) / Challenger (qualified for Worlds) / Journeyman (never qualified).

## 8. Player model & development

### CareerPlayer (a dynamic layer; the dataset is never mutated)

```ts
interface CareerPlayer {
  id: string                       // real personId | 'fic-…' | 'regen-…'
  kind: 'real' | 'fictional' | 'regen'
  region: Region; country?: string
  birthYear: number                // curated `born:` row, else deterministic debut-age inference
  archetype: ArchetypeId           // flavor + attribute offsets, NOT roles
  overall: number                  // float 60-99, display-rounded
  attrOffsets: Record<StatKey, number>  // attr = clamp(overall + offset), |offset| ≤ 6
  potentialTrue: number            // HIDDEN; derived from real future cards + seed jitter
  peakAge: number; declineRate: 'slow'|'normal'|'fast'   // hidden
  trainingFocus: StatKey | 'balanced' | 'auto'
  careerLineupIds: string[]; careerOrgIds: string[]      // chemistry fuel
  anchored: boolean                // AI-owned real player tracks real cards; flips false forever when user signs
}
```

- **Potential from real trajectories**: `potentialTrue = max overall across
  the player's real future cards + jitter(-1..+2)`. Wonderkids are the real
  ones — that's the product's soul; the jitter + the fact that user-signed
  players **diverge from script forever** ("his story is yours now") keeps it
  from being trivia. Players with no future cards get +2 headroom.
- **Potential display**: **numeric band only** ("POT 84-90") — no stars, no
  letter grades. Band width by scout level L0-L3 (±5/±3/±1/exact); band never
  excludes the truth, never prints the raw scalar (spoiler-safe by
  construction). Own squad auto-narrows 1 level per split played; one paid
  **Scout Report** jumps any player to L2 (price in CAREER_ECONOMY, ~$10k);
  L3 = play together. (No per-window free-report capacity system.)
- **Archetypes** (offsets sum ~0, |v| ≤ 5; ~40 famous identities curated via
  `archetype:` rows, rest hash-derived): Mechanical, Anchor, Playmaker,
  Ice Cold, Veteran Mind, All-Around. **No prescriptive roles** — RL trios
  rotate; roles would be fake depth.
- **Aging (RL-realistic — a YOUNG scene)**: prospects debut **13-15**;
  careers generally end **~24-25**. Growth multiplier 1.5 (≤16) → 1.25
  (17-18) → 1.0 (19-20) → 0.6 (21-22) → 0.3 (23-24) → 0.15 (25+); hidden
  peak age 18-22 (mean ~20). **Decline once per season at rollover** (one
  telegraphed beat, news-announced, never silent): −0.5 at 22, −1.5 at 23-24,
  −2.0 at 25-26, −3.0 at 27+; hidden per-player decline rate
  (slow/normal/fast); active training dampens ×0.7; mechanics decline first,
  experience grows. Debut-age inference weights: 13: 0.10 · 14: 0.20 ·
  15: 0.30 · 16: 0.25 · 17: 0.15.
- **Retirement**: rollover roll from 23 (5%), ~25% at 25, ~50% at 27,
  guaranteed-ish 70%+ at 28+; stars linger ×0.5; **anchor protection** — a
  real player never retires before his real final dataset season (this is
  what lets real long-career veterans play on authentically past the curve).
  User-squad players get a "Final Season" announcement one full season ahead,
  never an abrupt exit. 60% of retirees convert to coach candidates
  (`coachOVR ≈ 55 + 0.25 × finalOVR`) — familiar names feed the coach market
  (static AI coaches through 2026; retiree pool from S2+).

### Training (weekly tick, set-and-forget by default)

```
weeklyGain = 0.10 OVR × ageMult × headroomMult × coachMult × facilityMult × delegateMult
headroomMult = h/(h+4)            // smooth diminishing returns toward potential
coachMult    = 1 + (coachOVR−75)×0.01, clamp [0.85, 1.20]; no coach = 0.85
```

- **Focus**: per player — one attribute (offset +0.3/wk, overall ×0.70 — a
  real specialize-vs-grow tradeoff), `balanced`, or `auto` (default; coach
  picks at **delegateEfficiency 0.88**). Squad-level "Delegate to coach"
  toggle default ON. A player who never opens the Training screen fields a
  healthily developing squad (~12% efficiency cost — optional depth, never
  crippling). No focus-switch penalty (cut — punished exploration for zero
  depth). Attribute tooltips print the truthful effect ("clutch decides
  deciding games; experience pays in playoffs").
- **Match XP (field-quality-scaled, ALL events)**: playing an event grants
  bonus training weeks to fielded starters (0.7× for the registered sub),
  scaled by the **quality of the field**, not by the event's label:
  `xpWeeks = 2 × fieldQualityMult`, where fieldQualityMult ramps from 0.25
  (weak community field) to 1.5 (stacked Major/Worlds field) driven by the
  share of high-overall (85+) teams present and the field's average rating.
  Unofficials DO develop players — but farming weak fields pays little
  because the field is weak, which is the honest anti-grind.
- **Caps**: max +6 OVR/season, +2.5/split per player (matches real dataset
  deltas). Sanity: 17yo w/ headroom ≈ +3.8..5.5/season; 24yo ≈ +0.9; 28yo ≈
  training offsets decline.
- **AI development**: anchored real players **snap to their real per-season
  card** at rollover (the scripted-era world cannot inflate — the strongest
  authenticity anchor, zero tuning). Off-anchor/fictional/regens/post-2026:
  ONE season-boundary pass using the same curves at parity 1.0 with a passive
  user (world-sim owns execution; no weekly ticks for 400+ AI players).
- **Chemistry**: zero new engine code — each split together appends synthetic
  `career-{save}-{season}-s{split}` lineup ids + a career org id;
  `computeChemistry` yields time-together cohesion (2+ splits core → High;
  same-country core or matching staff → Perfect reachable). **Registered sub
  accrues 0.5 split-credit** so sub insurance carries real chemistry (fixes
  the accrual gap the critics found). Tuning per the chemistry-lever memory:
  reachable scoring, never `chemistryMaxBonus`.

## 9. Economy

**Owner note**: economy owns **every** money formula and table (salary ask,
fees, prizes, prices). The market layer (§10) consumes them.

- **Money core**: integer in-game USD quantized to $250; every mutation flows
  through two pure funnels — `settleEvent` (prizes, sponsor progress, rep) and
  `settleSplit` (salaries, sponsor base, passive income, upkeep, loan garnish)
  — into a ledger (ring buffer, tail 100 + per-season summaries).
  `formatMoney` util in `src/lib/format.ts` (compact "$85k" headlines, full
  "$8,500" in ledgers/confirms; PT keeps $ — telegraphed fiction, no R$).
- **Starting budget**: easy $150k / normal $100k / hard $60k. Difficulty
  multiplies **only pressure knobs**: prizeMult 1.15/1.0/0.9, salaryAskMult
  0.9/1.0/1.15, sponsorMult 1.15/1.0/0.9, garnish 10/15/20%. AI market
  behavior and availability identical across difficulties (locked rule).
- **Prize pools** (placement-distributed, every placement pays): Community Cup
  $5k · Invitational $25k · Regional $100k (winner $30k, 9-16th $1k flat) ·
  Major $300k (winner $90k) · **Worlds $1M (winner $350k)** — the win is the
  credits; infinite-mode banks stay sane.
- **Salary ask** (per split): `$8k × 1.13^(OVR−70) × ageFactor ×
  potentialFactor × repPremium × lengthDiscount × askMult × inflation ×
  ambition`, floor $2.5k, ±8% deterministic personality jitter. Curve: 75 ≈
  $14.5k · 80 ≈ $27k · 85 ≈ $50k · 90 ≈ $92k · 95 ≈ $170k. `repPremium = 1 +
  0.04 × max(0, OVR − (62 + 0.35×rep))`, cap ×2 — **the soft star-gate**:
  money, never a hard refusal (spirit of the no-filter rule).
- **Contracts** (simple): salary/split + length 1-3 seasons (lengthDiscount
  0.95^(n−1); locked for the life of the deal — long contracts hedge
  inflation) + role. Renewal in any window of the final season at a fresh ask;
  expiry warning one full window before the last chance; **exclusive re-sign
  window during Split 3** for your own expiring players (no surprise losses —
  AI bids only once the player actually hits free agency). Release = 50% of
  remaining salary. Coach: rolling per-split, fire = 1 split severance.
- **Transfer fees**: free agents = $0 fee + signing bonus (15% of first-season
  salary, "luvas"); under-contract = `ask × splitsRemaining × 1.4`, min $10k;
  selling receives ×0.9; quick-flip guard ×0.7 within 3 splits.
- **Sponsors** (1 main slot; season-long deals; offers at season start):

  | Tier | Rep gate | Base/split | Bonus | Objective |
  |---|---|---|---|---|
  | T1 Community | 0 | $8k | $3k | enter ≥2 events this split (**officials count**) |
  | T2 Challenger | 25 | $20k | $10k | ≥1 regional top-8 |
  | T3 Global | 50 | $45k | $25k | qualify for the Major |
  | T4 Title Partner | 75 | $90k | $60k | Major top-4 |

  **Non-frustration is structural**: base always paid; objectives are bonus
  targets, never penalties; no clawbacks, no termination. Patience meter: 3
  misses in a deal → renewal offered one tier lower (re-earnable). Signing
  bonus 1× base upfront. *(Cut from v1: partner slot, "delighted" status,
  Worlds kicker — texture, not spine.)*
- **Reputation** (0-100, starts 5, **can rise AND fall**): gains — unofficial
  win +1 (t3 capped +2/split) · regional top-8/top-4/win +1/+2/+4 · Major
  qual/top-4/win +2/+4/+7 · Worlds qual/top-4 +8/+10; gains halve above 80.
  **Losses (telegraphed expectations only, never silent)**: with rep ≥ 40,
  failing to qualify for a split's Major −2; with rep ≥ 60, failing to
  qualify for Worlds −4; missing the stated Season Goal −1. Every rep-risk is
  visible in advance on the Season Goals card and standings widget ("your
  reputation expects a Major"); the loss lands as a news item with the
  reason. Floor: rep never drops below the highest sponsor-tier gate already
  earned minus 5 (a bad season stings; it doesn't unravel the org). Gates:
  sponsor tiers, t2 invites (30), progressive buff unlocks (below), the
  salary comfort line. Market acceptance tier = `floor(rep/20)` → 1-5 (one
  mapping, one table).
- **Staff & facilities** (map 1:1 onto existing rating channels — zero new
  rating math): coach hire (salary 0.35 × curve; effect = existing coach mod
  ≤ +2.5); facilities L1 Equipment Bay $30k / L2 Team House $90k / L3
  Performance Center $250k → existing orgBuffLevel (+0.6/level, cap +1.8) +
  training +10%/level, upkeep $2k/$6k/$15k per split (permanent power has a
  running cost).
- **Progressive unlock ladder (buffs & features arrive along the career)**:
  purchases are bought with the career budget but become AVAILABLE by
  progression, so the org's toolbox visibly grows: coach + sub + scout
  reports + facilities L1 — from the start · **psychologist at rep 20** ·
  **facilities L2 at rep 25** · **bootcamp at rep 35** · **facilities L3 at
  rep 50** · **region relocation at rep 70 (or any Worlds qualification)** —
  future feature, its locked entry is already visible. Locked items render
  greyed with their unlock condition stated ("Unlocks at 35 Reputation") —
  see the Progression Track below.
- **Buffs (bounded)**: Sports Psychologist $15k/split rolling → +1 clutch +1
  consistency (stat layer only in v1). **Bootcamp** $25k one-shot, consumes an
  open week, max 1/split → permanent chemistry bump via an **explicit new
  engine input** (small additive chemistry bonus clamped inside the user-only
  path — declared honestly as an engine change, AI cap stays 0) + "Sharp" +1.0
  rating for the next official event. Hard bound: Σ active temp rating mods ≤
  2.0 (under the coach cap; §25 anchors stay safe; clamp lives in the engine).
- **Sub insurance**: sub costs 0.4× starter formula, fills the existing sub
  rating/depth channels + accrues half chemistry credit. When the
  unavailability event fires: with a sub → sub steps in at full OVR with his
  chemistry; without → **Emergency Stand-in** (fictional 60 OVR, $5k fee, zero
  chemistry) — you always play, it visibly stings.
- **Passive income**: fanbase trickle `rep × $120`/split (max $12k) — growth
  felt in the books, zero management surface.
- **Emergency Backer (ONE rescue per career — then it's real)**: overdraft
  floor −$20k; a mandatory payment breaching it triggers the Backer **once**:
  a grant restoring balance to +$10k, repaid at 120% via a 15% garnish on
  future prizes (line-itemized on every payout); while the loan is active: no
  transfer fees, no facility upgrades (FA signings and renewals always
  allowed — you can always field a team). **Going broke a second time —
  breaching the floor again after the rescue — ends the career**: the
  "Insolvency" ending (dignified retrospective, same Legacy ceremony family
  as Final Whistle, archived save). This is never a surprise: every confirm
  that projects a negative payday warns, the Backer chip is a standing
  reminder, and the Hub budget tile goes red two paydays out.
- **Anti-snowball**: salary inflation ×1.08^season on NEW deals only (S6 ≈
  ×1.47) + facility upkeep + T4 as the income ceiling → a maxed org
  (~$250k/split payroll) is roughly self-funding only while winning.
  **Ambition** (the hold-it-together pressure, deterministic and shown): a
  player whose prestige band exceeds your rep tier for 2+ splits renews at
  ×1.25 ("ambitious" chip); refusing a Blockbuster offer adds +10% to that
  player's next renewal ask (shown). *(Champion escalation: cut — one brake
  too many; kept as a dormant tunable.)* Rating-side snowball is already
  handled by superteam compression.
- **Pacing arc anchors** (harness-owned): S1 payroll $10-18k/split, end-bank
  $25k-100k; first fee transfer affordable by S2W2 in ≥60% of careers; T3
  sponsor by S3 in ≥50%; contender payroll $120-220k/split by S4-5; Backer
  rate <15% on normal (<35% hard, ~0% easy after S1); **and a nonzero
  "tight payday" band on normal in S3-5** so the mid-game economy never
  becomes theater.

## 10. Market & living world

### Transfer windows

**4 per season** (preseason W1-2, W11-12, W21-22, and the 1-week **Worlds
window** at W31 — you CAN re-tool before the big stage; the telegraphed cost
is chemistry, since Season Points are already banked). Windows are just their
calendar weeks — **no deadline-day sub-clock** (cut): offers resolve on each
weekly Advance; pending items expire at window close (telegraphed). Outside
windows the market is browse-only (scouting always on; offer buttons state
when the next window opens).

### Offers (v1: fixed ask, fully legible)

**No negotiation minigame in v1.** Every target shows a computed, fixed ask
(fee + salary) with a static "why this price" factor readout (age, potential,
rep premium, region, contract length). The player picks **contract length**
(the real lever: longer = cheaper rate, bigger release exposure) and
accepts/declines; resolution next Advance. Deterministic acceptance: same
offer, same answer — factors visible (rep vs prestige, role, region, former
teammate, **anchor pull +30** toward the player's real next org). Sliders +
counter round + My Negotiations tab = v1.1 behind a flag. *(Rationale: the
critics showed the slider sheet is a calculator with one displayed correct
position — the honest v1 decision space is who / when / how long.)*

### Roster Stability (Miguel's 2/3 rule, redesigned)

Measured on **fielded lineups, not transactions** — stockpile signings
freely; fielding a rebuilt trio mid-season is what costs:

- New faces fielded this split (vs squad at split start): **0-1 → free · 2 →
  −25% of Season Points earned to date · 3 → −60%**. Applied once per split at
  the worst tier, with a news item; never below 0; never blocks playing.
- **Preseason fully exempt** (rebuilds have a sanctioned home — the intent is
  to discourage mid-season rebuilds, not rebuilds).
- **Emergency slots** (replacement doesn't count): retirement, scripted-beat
  departure, contract expiry after a logged re-sign attempt, the
  unavailability event. Fielding your registered sub never counts.
- Persistent meter on squad + market screens ("New faces: 1/3 — next costs
  25% of your 240 pts"); any action that would raise the tier shows the exact
  point cost in its confirm.
- `FEATURES.careerHardStabilityRule` keeps Miguel's original hard forfeit
  (2+ starter changes zero the Season Points) one flag away → **[DECIDE §21]**.

### Selling & incoming offers (v1 slim)

- **Release** anytime (severance 50%); **"shop him" flag** raises AI bid
  probability; selling happens by accepting **incoming AI offers** (fee
  0.9-1.3× value, needs/budget-gated, seeded). Full transfer-listing UI with
  interest previews = v1.1.
- **Poaching pressure**: per window, P(AI bid for a user player) = 15% + 10%
  per top-10 player, cap 45%. Always refusable (no forced sales; ambition +10%
  renewal consequence shown).

### The living world (anchor drift + needs)

- **Preseason anchor pass**: each AI org diffs its roster vs its real
  next-season dataset lineup; each move executes with **fidelity 0.85 (0.95
  for top-3 orgs/region)** if the target is available. A blocked/failed slot
  **breaks its anchor permanently (per-slot, not per-org)** and falls back to
  needs-based signing — divergence stays localized; the untouched world
  reproduces ~85-95% of real rosters. Your disruption is authorship, not
  vandalism.
- **Needs pass** (mid windows: ~25% of orgs make ≤1 move): fill weakest slot;
  score = OVR + 0.5×upside + region/teammate bonuses − salary pressure. AI
  wallets by prestige tier ($250k/$600k/$1.2M/$2.5M; income from the same
  prize tables + sponsor stipends; spend cap 60%/window). Displacement chains
  resolve one level deep (telegraphed simplification).
- **Free-agent lifecycle**: materialized at career start (card in season N−1,
  no lineup in N — build-time derivation); in: releases, expiries, real
  debutants (arrive with their anchor org, or FA if the roll fails),
  procedural rookies (floor: ≥10 FAs/region); out: signings, retirements.

### Scripted historical beats (`newsBeats.json`, hand-curated like specialCards)

```
{ id: 'vitality-signs-zen',
  trigger: { seasonId: 'rlcs-2024', slot: 'preseason' },
  conditions: [ playerNotUserOwned('zen') ],
  effects: [ forceTransfer('zen', 'vitality') ],
  degradeToOffer: { feeMultiplier: 1.5 },          // user owns zen → Blockbuster bid instead
  preemptedHeadlineKey: '…',                        // or an alternate news line
  headlineKey/bodyKey: EN+PT }
```

Precedence: beats > anchor pass > needs pass; beats never mutate the user
squad without consent; each fires once per career. **v1 floor: 4-5 flagship
beats per season (~30 total)** — grow post-launch; the template layer carries
the world's liveliness regardless.

### News & inbox

One feed + toast layer (AchievementToaster pattern; max 2 toasts/advance,
priority: mine > region > world). Sources: beats (WIRE kicker) > user-action
items (pinned until resolved) > world templates (~15 templates × 1 variant at
launch; transfers, results, milestones, retirements, rookie classes) > flavor
pool (20 items, rotation-tagged). Volume 3-6 items/tick, cap 12, overflow →
"Around the League" digest. Ring buffer 250; verbosity pref Full/Digest
(default Digest). Beat/template content lives in the data file with co-located
en/pt fields (challenges precedent — **record the copy-rule amendment in
DESIGN-DECISIONS**); UI chrome stays in copy.en/pt.

## 11. UX / IA

### Shell & navigation

- Nested routes under `/career`: `hub · calendar · squad · training · market ·
  finances · standings · news · club · event/[id] · saves · new`. Guard
  redirect when no active save; careerStore is exempt from AppShell's
  run-clearing effect (regression-tested).
- **Desktop**: persistent CareerTopBar (crest · "Season X · Split 2 · Week 6"
  · budget + rep chip · **CONTINUE**) + tab rail. **Mobile**: inside /career
  the bottom nav swaps to `Hub · Calendar · Squad · Market · More` (More sheet:
  Training, Finances, Standings, News, Club, Settings, Exit); Continue as FAB
  on Hub/Calendar. Global nav gains a 6th "Career" item (grid-cols-6) when the
  flag is on → **[DECIDE §21]**.
- **Blue = structure, orange = action** discipline carried through: Continue
  and every commit-CTA orange; tables/tabs/cut-lines blue.

### The Hub (returning player's single screen)

Order: **NOW card** (next stop + stakes + Continue; replaced by the pending
decision card when one blocks) → Season Goals line → roster form strip
(3 chips + chemistry meter) → Road-to-Worlds mini (rank, points, cut-line) →
budget tile (balance + net/split; red if projected negative) → news (3
headlines) → sponsor objective chip. Every module is a consequence surface
and a tap-through to its spoke.

### Team stars (cosmetic tier, 0-4★)

Every org — user and AI — carries a **star rating (0-4★)** derived from
`0.6 × overall-percentile-in-region + 0.4 × reputation-tier` (initial
weights): 4★ = elite (a Worlds-favorite profile), 3★ = contender, 2★ =
established, 1★ = rising, 0★ = unranked newcomer. **Purely cosmetic** (at
most a balancing/seeding input — never a gameplay gate): it renders beside
TeamLogo on standings rows, event lobbies, market org chips, and the org
header, giving instant "who am I up against" reads without numbers. The user
org's star-ups are celebrated (toast + news item) — a visible ladder from 0★
founder to 4★ elite that shadows the whole career arc.

### Progression Track (what's still ahead — always visible)

One dedicated surface (a `Progression` panel inside Club + a compact strip on
the Hub) listing every unlockable with its condition and current progress:
sponsor tiers (rep 25/50/75) · psychologist (rep 20) · facilities L2/L3 (rep
25/50) · bootcamp (rep 35) · t2 Invitationals (rep 30) · team star
milestones · region relocation (rep 70 or Worlds qualification — "future"
badge) · Legacy grades. Locked entries are greyed with the condition stated,
never hidden — the pull of "what do I unlock next" is a core progression
motivator, and it must never require guesswork.

### Screens (v1 set, wireframe-level specs in the design set)

Wizard · Hub · Calendar (agenda list, not month grid; windows as bands;
event preview sheet with field/points/prizes and Sign up / Sim options) ·
Squad (FieldView hero + bench + staff chips; contracts table; **"Lock In"** =
pre-event lineup gate — "Roster Lock" is only the pre-Worlds freeze) · Player
sheet (portal: StatBars, POT band track, development projection, contract,
history **horizon-limited**) · Training (focus rows + projection chips +
auto-train banner) · Market (Free Agents default tab + Recommended shelf;
Under Contract behind one tap — first-window vocabulary stays small) ·
Finances (statement + ledger tail + sponsor cards with the patience
consequence stated) · Standings (regional table + Road to Worlds tab;
scenarios strip collapsed, v1.1) · News · Club (identity, rep track, trophy
room with the empty Worlds pedestal visible from day one, records, season
history, settings + Handbook list) · Event (TournamentScreen playback **Full +
Instant** in v1 — Full = existing pacing incl. 1x/2x/4x, Instant =
fastForward → results digest; "Sim to end" available at any stage; the
dedicated Quick digest mode = v1.1) · Saves (3 slots, slot meta rendered
without hydrating saves; continuous autosave; **no manual saves/rollback —
determinism makes results fate, stated proudly in the Handbook**) ·
Ceremonies (split recap with "Save & rest" exit beat; season review ≤90s
skipped; career end).

**Event playback is a centerpiece (Miguel-locked)**: every match is simulated
individually and **presented individually** — never a static results dump.
The career gets its own playback suite (`CareerEventScreen` +
`CareerMatchCenter`, new components modeled on the shipped TournamentScreen's
queue/cursor pacing patterns but built fresh so the shipped screen is never
touched): per-game **goal timeline** (goals pop in sequence with scorer names
from the engine's per-game scorer data), game-by-game chips filling the
series (Bo5/Bo7), desk-tone narration lines, then the series banner, then the
next series — Swiss standings and the bracket animating between rounds.
Speeds 1x/2x/4x + "Sim to end" at any stage (same seeded outcome watched or
simmed — stated in the Handbook). AI-only series resolve in a lighter ticker
view. Instant mode = fastForward → an animated results digest (placement
count-up, prize/points ceremony), still never a bare table.

### Onboarding & the management dial

- Layer 1: the wizard teaches inline. Layer 2: founding chain (Hub intro ≤60
  words → first NOW card is a hand-authored free Community Cup 3 days out —
  first tournament within 60s of founding → post-event "two doors opened"
  pulse on Training + Market). Layer 3: ~12 one-shot contextual explainers
  (≤90 words, 1 CTA, re-readable in the Handbook; "Skip all tips" on the 3rd).
  The window explainer teaches only "windows are when you sign" — the
  stability rule teaches itself via the meter + just-in-time confirm.
- **Management styles** (presets over toggles, changeable anytime): Hands-on /
  **Balanced** (default: auto-train ON, auto-sign-up officials ON,
  auto-enter recommended unofficials ON, Instant offered on unofficials,
  recommendations pre-highlighted) / Delegate (+ pre-filled offers, pre-
  answered renewals — still confirmed). Presets change defaults, never
  capabilities; every automation emits an attributed news line ("Handled by
  coach — Manage it myself").

### Session rhythm & spoiler safety

- Budgets (harness-asserted): ≤8 blocking stops/split; ≤30 taps/split on
  Delegate; Instant event ≤45s; one split ≈ 30-45 min; split recap ends with
  "Save & rest".
- **Spoiler horizon (global rule)**: no per-season dataset value later than
  the current career season ever reaches a component — including trajectory
  sparklines and "projected next season" (every consumer takes `careerNow` as
  a horizon parameter). Future seasons render as locked silhouettes; Worlds
  field hidden until all regions resolve; beats are broadcast-voice news with
  a WIRE kicker, zero IRL framing; Spoiler Shield toggle (default ON)
  additionally strips real-history flavor lines.
- Mobile-first: single column at 375px, 44px targets, portal sheets over
  tooltips, tables scroll inside their panels, consequence panels above the
  fold on 375×667.

## 12. Data plan (files, generators, and what Miguel's expansion must provide)

**Architecture**: new package `src/data/career/` (own Zod schemas + barrel,
**never imported by the main `src/data/index.ts` barrel** — lazily imported by
the /career layout). Sources: sibling `data-sources/career.md` + new
`scripts/build-career-data.mjs` wired into `build:data`/`validate:data`
(teams.md and build-dataset.mjs stay untouched — they are fragile,
load-bearing systems). `teams.md` gains only two optional per-player rows
(`born: YYYY-MM`, `archetype: <id>` — parser is extensible). Hand-maintained
exceptions (specialCards workflow): `newsBeats.json`.

Files: `careerPlayers.json` (birthYear, potential, startTier — **synthetic
fallback derived from real trajectories, marked `synthetic:true`, so Phase 1
is never blocked**; authored values always win) · `careerCalendar.json` (6
season configs) · `careerEconomy.json` (prize/points tables, sponsor
templates) · `newsBeats.json` · `fillerWorld.json` (authored filler orgs +
generator-created filler players with stable ids `gen:{org}:{slot}`) ·
`careerCrests` (12 SVGs + color pairs) · `sponsors.json` (12 fictional
brands, 3+/tier, monogram fallback) · name banks per region.

**Data needs from the expansion (priority order)**:
1. **Filler orgs/lineups** to reach ≥15 AI lineups per region per season
   (rlcs-x → 2026). Today: NA/EU are close; SAM has 57 sam-only; MENA/OCE/
   APAC/SSA have ~5-9 → roughly 7-11 filler orgs per thin region. Spread:
   2-4 real elite, mid 74-82, tail 66-74 (a 68-72 starter squad must win some
   S1 Swiss series). Miguel authors org identities; players are generated.
2. **`born:` rows** for the ~150-200 modern-era players (Liquipedia public;
   the community-workbook fetch script can bulk-collect; year precision OK).
3. **`archetype:` rows** for ~40 famous identities.
4. **Starter-lineup pools** per region at Season X (org-less real players +
   fillers).
5. Unofficial-event name pools, rookie name banks (~40/region,
   generator-proposed for approval), sponsor brands, crest SVGs.
6. rlcs-2026 completion (19 lineups today) before launch of the mode.

## 13. Technical architecture

### Engine (`src/engine/career/` — pure, deterministic, data-injected)

`calendar.ts` (season construction, `nextStop`, `advanceClock`) ·
`development.ts` (`deriveCareerPlayer`, `trainWeek`, `advanceSeason`,
`generateRookie`, `scoutedPotentialBand`) · `economy.ts` (`computeSalaryAsk`,
`computeTransferFee`, `prizeFor`, `settleEvent`, `settleSplit`) · `market.ts`
(acceptance scoring, `runAiTransferWindow`) · `worldSim.ts`
(`simulateWorldWeek`: due AI events → assemble → `fastForward` → compact
results → points → news hooks) · `careerResults.ts` (`compileEventResults`
for EVERY team, `computeCircuitStandings`, qualifier math —
`results.ts/compileResults` stays classic-only) · `news.ts` (beat + template
compilation) · `seeds.ts` (`deriveSeed`, stream grammar:
`evt:{season}:{split}:{kind}{n}:{region}` · `dev:{season}:{week}` ·
`mkt:{season}:{windowIdx}` · `news:{season}:{week}` · `rand:{season}:{week}` ·
`create` · `infinite:{n}`).

### Two engine refactors (verified-additive, Phase 0)

1. **Export the team assembler**: `assembleTournamentTeam(input)` from
   `teams.ts` + optional `org?: {name, buffType, buffLevel}` override (absent
   → current dataset-lookup path, bit-for-bit). Career feeds in-memory
   CareerPlayers + the user org + synthetic chemistry ids.
2. **Explicit-field tournaments**: `TournamentOptions.field?: TournamentTeam[]`
   — skips `generateOpponents`, works with or without a user team. No format
   parameterization in v1 (fillers guarantee 16; unofficials use the existing
   8-team shape) — swiss/playoffs stay byte-identical.

**No TournamentScreen extraction** (decision changed in the v0.1 pass): the
career builds its own playback suite (`CareerEventScreen`, `CareerMatchCenter`,
career standings/bracket views) modeled on the shipped screen's patterns but
as fresh components — the shipped `TournamentScreen.tsx` is never touched,
which both removes the riskiest refactor and frees the career playback to be
richer (goal timelines, scorer feeds) than the draft-mode presentation.

**Golden-master suite first**: `regression.golden.test.ts` committed BEFORE
any refactor — fixed seeds across classic/quick/daily/challenges, full results
asserted against checked-in fixtures; regenerated only by documented intent.
Career code never imports the draft pools; an isolation test asserts
`src/data/*.json` untouched.

### careerStore & saves

Zustand persist `rocket-draft:career:v1`, version 1, **additive deep-merge
migrate from day one** (destructive run-store policy is unacceptable for a
20-hour save). `slots: (CareerSave|null)[3]` + `activeSlot` + separate
slot-meta for the picker. Save size bounded by design: AI TournamentStates
compiled to ~1KB `EventResult`s and discarded; only the user's in-progress
event persists `{eventId, rngState, tournament}` (proven serializable); world
state as **deltas** over the dataset (rosterOverrides, overallDelta,
freeAgents, version → invalidates the team-assembly cache); ring buffers
(news 250, ledger tail 100, match logs 40); **maxSaveBytes 400k asserted** by
a simulated 6-season test. Coarse actions (one persist per decision). Career
results **never** flow through `applyRunResults`; a narrow
`applyCareerMilestones` funnel grants profile XP + career achievements at
milestones, **never MMR**. Cloud: local-only through Phase 4; Phase 5 syncs a
compact CareerSummary via the existing profile channel; full-save backup =
later explicit "Upload save" (last-write-wins on updatedAt; monotonic
mergeProfiles math must never touch career state).

### Performance

Whole world advances inside one `advanceWeek` action: worst week ≈ 7 regions
× (Swiss 33 + DE 14 series) ≈ 330 series — tens of ms (the difficulty harness
already runs thousands of tournaments in seconds). Disciplines: team-assembly
cache per (teamId, world.version); compact-and-discard; multi-week batches
chunked at 80ms/frame with a "Simulating the world…" strip. Perf log test:
full 6-season bot career < 10s, tick warn at 150ms.

### Analytics (PostHog, decision-grade only)

`career_created`, `career_first_event` (time-to-first-match funnel),
`career_event_finished {watched}`, `career_split_finished`,
`career_transfer`, `career_sponsor_signed`, `career_training_set
{auto|manual}` (principle-3 telemetry), `career_season_finished`,
`career_finished {worlds_win|time_up|abandoned}`, `career_infinite_started`,
`career_save_deleted`.

## 14. Copy & content plan

- New copy groups (EN + PT keyed identically): `CAREER_UI`, `CAREER_NAV`,
  `WIZARD`, `HUB`, `CALENDAR_UI`, `SQUAD_UI`, `TRAINING_UI`, `MARKET_UI`,
  `FINANCE_UI`, `STANDINGS_UI`, `NEWS_UI`, `CLUB_UI`, `CAREER_CEREMONIES`,
  `CAREER_EXPLAINERS` (+ Handbook), `CAREER_NEWS_TEMPLATES`. Broadcast-desk
  tone, no forced memes. Beat/template **content** co-located en/pt in the
  data file (rule amendment → DESIGN-DECISIONS).
- **One glossary, one PT term per concept** (single pass with Miguel):
  Advance/Avançar · Season Points/Pontos da Temporada · Transfer
  Window/Janela de transferências · Roster Lock/Elenco travado (pre-Worlds
  only) · Lock In/Confirmar escalação (pre-event) · Free Agent/Agente livre ·
  Signing Bonus/Luvas · Asking Price/Pedida · Roster Stability/Estabilidade do
  elenco · New Faces/Caras novas · Scout Report/Relatório de olheiro ·
  POT/Potencial (numeric band) · Training Week/Semana de treino (free) vs
  Bootcamp (paid) · The Wire/Plantão (beats only) · Emergency
  Backer/Investidor de emergência · Watch Party/Assistindo de casa · Save &
  Rest/Salvar e descansar · Final Whistle/Apito final · Endless Era/Era
  infinita · Handled by coach/Resolvido pelo coach. ("Jornaleiro" for
  Journeyman needs Miguel's tone check → §21.)
- **Content floors for launch** (grow post-launch): ~30 beats (4-5/season) ·
  15 news templates × 1 variant · 20 flavor items · 12 sponsors · 12 crests ·
  Handbook = the 12 explainers re-listed (no extra corpus). Name banks and
  filler names arrive generator-proposed for approval, never hand-written from
  scratch.

## 15. Persistence of progress into the profile

Career milestones grant profile XP + a new career achievement set (~10-14:
first signing, first sponsor, first Major qualification, first Major title,
Worlds qualification, Worlds title, 2026 completed, infinite-era title,
Legacy grades…), via `applyCareerMilestones` once each. No MMR, no collection
specials from career in v1. `CareerSummary` written to the profile on
retirement. → needs Miguel's sign-off (§21).

## 16. Balance config (`balance.ts` groups)

`CAREER_CALENDAR` · `CAREER_SEASON_TEMPLATES` (data file) · `CAREER_POINTS` ·
`CAREER_SLOTS` · `CAREER_PRIZES` · `CAREER_UNOFFICIAL` · `CAREER_STABILITY`
(+ `FEATURES.careerHardStabilityRule`) · `CAREER_DEV` · `CAREER_TRAINING` ·
`CAREER_AGE` · `CAREER_REGEN` · `CAREER_SCOUT` · `CAREER_ECONOMY` ·
`CAREER_SALARY` · `CAREER_CONTRACT` · `CAREER_TRANSFER` · `CAREER_SPONSOR` ·
`CAREER_REP` · `CAREER_FACILITIES` · `CAREER_BUFFS` · `CAREER_SUB` ·
`CAREER_LOAN` · `CAREER_WINDOW` · `CAREER_WORLD` · `CAREER_FA` ·
`CAREER_NEWS` · `CAREER_UI` · `CAREER_UX` · `CAREER_SIM` · `CAREER_SAVE` ·
**`CAREER_ARC` (the single master pacing table — every harness imports it,
none restates it)** · `FEATURES.careerMode` (master flag).

## 17. Validation (the harnesses own the numbers)

1. **Golden-master suite** (Phase 0): existing modes byte-identical.
2. **Career pacing harness** (`career.sim.test.ts`, difficulty-harness mold;
   built in Phase 1 **before** market/training tuning): a deterministic
   BotManager plays 120 careers/difficulty. Asserts `CAREER_ARC`:
   - first Major qualification by end of season 2: ≥70% (normal)
   - first Worlds qualification by season 4: ≥60% (normal)
   - **Worlds title by 2026: easy 45-70% · normal 20-45% · hard 8-25%**
   - Backer rate, tight-payday band, stability-rule trigger rate <10% of bot
     windows, session budgets (≤8 stops/split), time-to-first-event.
   - **Two-policy gap** (anti-autopilot): naive full-autopilot must land
     materially below the tuned bot (autopilot title band ~5-20% on normal) —
     engagement has to pay, created by detuned recommendation quality, not by
     nerfing the player.
   - **Both-archetypes check**: a youth-core strategy and a veteran-core
     strategy must both reach Worlds contention, with youth-core edging over
     the 6-season horizon (anti veteran-stacking degeneracy).
3. **Inflation harness**: 200 headless careers; per-season mean of each
   region's top-16 ratings within ±2.0 of the real dataset means (2020-26);
   infinite drift ≤ +0.5 OVR/season over 10 seasons. Same bot runs as (2) —
   one consolidated suite with assertion groups, not five separate suites.
4. **World-fidelity assertions** (same runs): untouched world reproduces
   ≥80% of real rosters season-over-season; FA floors hold; AI wallets
   bounded; news volume in band; t3 grinding never out-earns one regional
   placement.
5. **New §25 anchor**: equal-overall, different-archetype teams must stay
   within a stated band of 50/50 series before attribute offsets ship.
6. **Economy calibrator** (`scripts/calibrate-career-economy.mjs`,
   calibrate-rarity mold): Monte Carlo sweeps of salary curve / pools /
   sponsor bases against the §9 arc bands (manual tool, not CI).
7. **Store tests**: migrate fixtures, mid-event save/reload identical
   champion, AppShell exemption, save-size ≤400KB, seed-stream stability
   snapshot.

## 18. v1 cut-line (minimum lovable career)

**IN v1**: weekly calendar + batched Advance · 6 config-identical seasons ·
regionals/Majors/Worlds on existing formats + Season Points + slot tables ·
t3+t2 unofficials · CareerPlayer layer (age, POT band, archetype offsets) ·
weekly training w/ delegate default + rollover aging/decline/retirement ·
economy (prizes, fixed-ask salaries/contracts, release, coach, facilities,
psychologist+bootcamp, sponsors w/ patience, rep ratchet, Backer, ambition) ·
market (FA + under-contract buys, incoming AI offers, shop-him flag,
anchor-drift world sim, ~30 beats, news) · one random-event type + sub +
stand-in · UX (wizard, Hub+Continue, calendar, squad, training, market,
finances, standings, news, club, Full+Instant playback, ceremonies, 3 slots) ·
endgame (credits / Final Whistle) + minimal infinite mode.

**DEFERRED to v1.1+** (each telegraphed where visible): org relocation ·
t1 Circuit LAN · negotiation sliders/counters · transfer-listing UI with
interest preview · Quick playback digest mode · spectate Key Matches / Full
Broadcast + follow-mode reveal · compare tray · scenarios strip · Handbook
search · "Previously" session recap · trophy ceremony replays · crest-swap
allowance UI · partner sponsor slot, delighted status, Worlds kicker ·
champion escalation (dormant tunable) · second sub slot promotion · watch
party set-piece beyond the first · psychologist event-halving · additional
random-event families · beats beyond the floor.

## 19. Build phases (all behind `FEATURES.careerMode=false`; each ships dark, suite-green)

| Phase | Version | Scope | Exit criteria | Effort |
|---|---|---|---|---|
| 0 Groundwork | v1.5.0-alpha | Golden-master suite FIRST; TournamentScreen extraction + snapshot tests; assembler export + org override; `TournamentOptions.field`; `careerResults` compiler; `seeds.ts`; career types | goldens identical; AI-only event test passes; existing modes pixel/behavior-stable | M |
| 1 Season loop | v1.5.0 | career data files (synthetic fallbacks OK); careerStore + slots + migrate; wizard; Hub + calendar + Advance; officials playable (watch/sim); points + qualification; full 7-region world sim; minimal squad screen; **pacing harness skeleton** | bot completes 6-season careers; a human plays a full season | XL |
| 2 Economy + market | v1.5.1 | finances, prize/salary/contract tables live, transfer windows, FA market + AI GM moves, Roster Stability, filler-world data lands, economy calibrator | economy bands green; market playable | L |
| 3 Development | v1.5.2 | training + auto-train, aging/potential, rollover progression, coach/staff/buffs, sub + the one random event, archetype anchor test | dev/inflation bands green | M |
| 4 Living world | v1.5.3 | news system + beats floor, sponsors + patience, unofficials t3/t2, reputation, spectator digests | world-fidelity + news-volume bands green | L |
| 5 Endgame + launch | v1.6.0 | credits/Final Whistle, infinite mode, onboarding chain + explainers, mobile nav, analytics, `CAREER_ARC` calibrated + CI-enforced, docs (DESIGN-DECISIONS entries, §42 extension, BALANCE-GUIDE careers section), flag ON | full-career playtest + launch checklist | M |

## 20. Risk register (top 10)

1. **RNG-stream drift breaks fixed-seed content** (challenges/daily) →
   golden suite first, additive-only options, new streams only, challenge
   bands in CI, re-tune harness as last resort.
2. **Save bloat / localStorage quota** → deltas, compact results, ring
   buffers, 400KB assertion.
3. **Scope creep (FM depth vs solo maintainer)** → §18 cut-line, phase exit
   criteria, "depth is optional" enforced at review.
4. **Data workstream slips** → synthetic fallbacks unblock every phase;
   authored data replaces without save breaks (stable ids).
5. **Save-shape churn in beta** → dark-phase saves disposable (friendly
   notice); strict migrations forever after flag-ON (needs §21 agreement).
6. **Economy snowball or self-solving mid-game** → calibrator + tight-payday
   band + ambition pressure; no-game-over floor stays.
7. **Advance-tick jank on low-end mobile** → 80ms chunks, assembly cache,
   perf log test.
8. **Chemistry double-dip vs §25** → career chemistry through the user-only
   cap path; anchors stay CI gates; bootcamp bonus is an explicit clamped
   engine input.
9. **Autopilot ≈ optimal (boredom by S3)** → two-policy harness gap; detuned
   recommendations; ambition + stability rule keep late-game active.
10. **EN+PT content volume on Miguel** → §14 floors; generator-proposed
    lists; co-located en/pt in data files.

## 21. `[DECIDE]` — open items for Miguel (each with a recommendation)

1. **Roster-churn rule**: ship the tiered fielded-based **Roster Stability**
   (free/−25%/−60%, preseason exempt) with your original hard forfeit behind
   `FEATURES.careerHardStabilityRule`? *Recommend: yes — two of three critics
   found the cliff novice-hostile; the tiers keep your intent and the flag
   keeps the authentic rule one switch away.*
2. **Worlds prize pool**: $1M (winner $350k) vs $2M (real-ish $600k)?
   *Recommend $1M — the win is the credits; infinite banks stay sane.*
3. **Star-signing gate**: soft rep-based salary premium (recommended) vs
   FM-style hard refusals? *Recommend soft — money stays the universal gate,
   honoring the no-filter rule's spirit.*
4. **Fixed-ask market in v1** (no negotiation sliders/counters until v1.1)?
   *Recommend yes — the deterministic slider is a calculator; who/when/length
   is the honest v1 decision space.*
5. **Career → profile progression**: profile XP + ~10-14 career achievements
   via `applyCareerMilestones`, never MMR, no collection specials in v1?
   *Recommend yes.*
6. **Mobile global nav**: grow to 6 items (grid-cols-6) when the flag is on,
   vs keep 5 + a "Continue career" pill on the Home hero? *Recommend 6.*
7. **No manual saves / no rollback** (continuous autosave; determinism =
   results are fate)? *Recommend yes, stated proudly in the Handbook — FM
   players may expect save files, so this needs your explicit call.*
8. **Auto-train default ON** for Balanced/Delegate (a literal reading of
   "assign training" becomes opt-in)? *Recommend yes with attributed
   training-report news + one-tap takeover; record in DESIGN-DECISIONS.*
9. **Beat corpus floor** ~30 hand-written beats (EN+PT) for launch, growing
   later — is that authoring budget OK? (It's the biggest content ask.)
10. **Sponsor brands**: fictional-but-flavored pastiches (e.g. "RedBeast
    Energy"), hand-curated like specialCards? *Recommend yes.*
11. **Season X alternate history** (Majors played as LANs, telegraphed news
    beat) — comfortable with the fiction? *Recommend yes; it buys the 6th
    season and the uniform format.*
12. **Beta save policy**: dark-phase career saves are disposable until the
    first flag-ON release? *Recommend yes.*
13. **PT glossary pass** (incl. "Jornaleiro" tone) — one review session over
    §14's table.

## 22. Process notes

- This doc follows the CHALLENGES-DESIGN mold and is the spec of record for
  the mode. **Career-mode deviations land in
  [`ROAD-TO-WORLDS-DECISIONS.md`](ROAD-TO-WORLDS-DECISIONS.md) (numbered R#),
  NOT the draft game's `DESIGN-DECISIONS.md`** — the two modes' decision logs
  are kept separate on purpose. Balance values land in BALANCE-GUIDE.md when a
  careers section is built; per-version narrative in CHANGELOG.md
  `[1.5.0-alpha]`; current state + remaining work in
  [`ROAD-TO-WORLDS-STATUS.md`](ROAD-TO-WORLDS-STATUS.md).
- The §42 north-star extension, the copy-rule amendment (beat content en/pt in
  data files) and the §21 resolutions are recorded in
  `ROAD-TO-WORLDS-DECISIONS.md` (header + R1–R18).
- Commit cadence: per phase (`v1.5.x` milestones); Miguel reviews diffs before
  any commit. Shipped on `staging` through **v1.5.0-alpha.2** (v0.3 pass).
