# Road to Worlds — the training contract (DEV-03)

> **APPROVED (Gate 3a, 30/10: decisions 1–7 A) and BUILT in rc.34**
> (ROAD-TO-WORLDS-DECISIONS R74–R75, R80; the values are Claude's, behind
> `CAREER_PLAN`, `CAREER_SCRIM`, `CAREER_COACH_MARKET` and
> `CAREER_TRAINING`, tested at Gate 3b). The proposal below is kept as
> written.
>
> *Original status:* PROPOSAL — waiting for Miguel's approval (Gate 3a). ROADMAP Etapa 3,
> DEV-03 (direction approved 28/10: a package per period). **No code, number
> or save shape changes until Miguel approves.** Written at rc.31 (`staging`
> a187654) in the form of `ECONOMY-CONTRACT.md`, against the ROADMAP's spec
> of DEV-01 (growth) and BAL-02 (presets), both being built in Etapa 2b part
> 2. *Formula* numbers are computed from the cited code; *baseline* and
> *probe* numbers come from `CAREER-BASELINE-rc30.md` and
> `ECONOMY-CONTRACT.md`. Candidates are not measurements. Companions:
> `SPONSOR-CONTRACT.md`, `HQ-CONTRACT.md`.

## 1. Why a contract

Training today is weekly: a team drill valid for one week, a focus and an
intensity on every player's card, up to two scrims a week booked by hand, and
nothing that says what a month of it did. Miguel's direction: pick a routine
for a period, see its benefit and cost, get the result at the end; never
"click the same scrim every week". The contract comes now "so 2b never
calibrates the old training model as if it were final" (§8, step 0).

## 2. The contract

**(a) One training decision per period, none per week.** A package covers a
period: an objective, one squad focus, a workload, scrims (how many, which
level) and optional tweaks for single players. The manager meets training at
most once per period (approve, adjust or keep the base), and never when the
coach runs it.

**(b) The base never needs a package.** With no package every player grows at
DEV-01's base: days, plus series actually played. A package makes the road to
the expected peak faster and shapes the attributes. It never moves the peak
past DEV-01's tolerance, and neither a missing package nor a missing coach is
a malus against the base.

**(c) Benefit and cost before, the result after.** Before approval the card
shows the projected gain per player, the wear, the agenda days and the end
date, from the function that runs it. At the end a summary is filed as
history (T7).

**(d) Calendar-true and idempotent.** Sessions run Monday to Friday, around
events and windows. Each day applies once: an Advance, the autoplay, a reload
or a fast advance end in the same save as pressing +1 day.

**(e) Scrims are practice.** Never official points, prizes, reputation,
achievements for wins, or growth without a limit.

**(f) Coaches are distinct.** Quality, experience and a specialty, each with
one measurable effect that the hire card prints. Good generic coaches exist;
ex-pros cost a little more and bring a bit more; every coach grows with
relevant experience.

**(g) Delegation is real and honest.** A trusted coach renews and adjusts
without asking; exceptional events stay visible; how well the coach plans is
shown, never a hidden malus. The preset (BAL-02) only sets the default.

**Legibility runs through all seven:** one engine function per number, the
same on the package card, the hire card, HQ and the summary; every tunable in
`balance.ts`; every string in EN and PT.

## 3. Acceptance criteria

**Flow tests** (the ROADMAP's acceptance list, deterministic, one seed each):

| # | Case | Passes when |
|---|---|---|
| f1 | A whole period with and without a package | Without: every player grows exactly at DEV-01's base. With: the gain is ≥ that and equals the approval card's projection within rounding. |
| f2 | Three coach profiles: none, a good generic, an ex-pro | Each attribute's effect shows in the projection and the summary, in the order the hire cards claim. |
| f3 | Three scrim levels | XP easy < even < hard; wear easy < even < hard; chemistry highest on even; no points, prize, rep or achievement; scrim XP within its period cap. |
| f4 | Delegation over several periods | No prompt in 4+ periods; one summary per period; the coach switches objective for a period with a Major or Worlds; a new signing joins the plan with a summary line. |
| f5 | A coach change mid-period | The period runs on; each day uses the coach present; the summary splits the coach's share by days; after a firing, the coachless rate. |
| f6 | Refresh and fast advance | A reload mid-period; Skip, autoplay and +1 day reach identical saves; no session, scrim or summary twice. |
| f7 | Events in the period | No session on a match day; the committed-week share on event weeks; no scrim on an event day; a window signing mid-period. |
| f8 | A young reserve and a starter | The reserve who did not play keeps base + package growth without series XP; the starter earns series XP. |

**Harness bands** (candidates for Miguel, measured as in §7):

| # | Band | Candidate |
|---|---|---|
| t1 | Training prompts per season | delegated 0; "approve" mode ≤ 1 per period |
| t2 | A season's gain with a development package ÷ without, p50, ages 13–19 | 1.10–1.35 |
| t3 | Players ending a season above expected peak + tolerance | 0 % |
| t4 | Scrim share of a period's gain, p90 | ≤ 25 % |
| t5 | A delegated package's value ÷ the best manual one (engine estimate) | ≥ 0.85 new coach; ≥ 0.95 experienced |
| t6 | Extra unavailability from the heaviest workload with hard scrims | ≤ +4 points per event, shown before approval |
| t7 | Coach shortlists with a generic within 5 quality of the best ex-pro | ≥ 90 % of windows |
| t8 | `ECONOMY-CONTRACT.md` §3 bands once coaches are repriced (T4) | none worse by more than 5 points |

**The gate is a human playtest (Gate 3b):** the loop must not need a
repetitive weekly chore.

## 4. Today against the contract

**(a) Training is weekly.** Three controls, each per week or per player:
- the team drill (`CAREER_TRAINING.drills`, `balance.ts:1194–1202`), valid for
  the current week only (`activeDrillFor` / `setDrillFlow`,
  `careerFlow.ts:1103–1122`): +0.25 offset to its stats and ×1.05 overall;
- a focus and an intensity (×0.6 / 1.0 / 1.35, `balance.ts:1175`) on every
  player card (`TrainingScreen.tsx:360–376`; `focusShareFor`,
  `development.ts:751`): the "form for every player" the ROADMAP rules out;
- scrims booked by hand, two a week at most (`balance.ts:1096`), up to 14 days
  ahead (`scheduleScrimFlow`, `careerFlow.ts:3308`).

Delegation (`prefs.autoTrain`, which needs a coach) only picks the drill of
the coach's buff (`autoDrillFor`, `development.ts:724`) and the "auto" focus
(`balance.ts:1168`). Scrims are never delegated; the harness bot books its own
on Tuesdays and Thursdays (`careerArcBot.ts:465`).

**(b) No period, no result.** The only feedback is the bar to the next point
(`trainingEta`, `development.ts:906`) and a news line per scrim
(`careerFlow.ts:3280`). The screen even says a match week pauses the sessions
(`copy.career.en.ts:525`), while the engine trains them at half rate
(`matchPrepShare`, `careerFlow.ts:886–896`).

**(c) Scrims are a free weekly lever.** *Formula:* a scrim grants 0.5 × field
quality training weeks (`balance.ts:1100`; `fieldQualityFor`,
`development.ts:1084`: 0.25 against a 72-rated org, 0.75 at 80, 1.5 at 92+)
and +0.05 split of chemistry tenure to the whole squad (`balance.ts:1098`).
Two scrims a week against an 80-rated org add 0.75 of a training week, 60 % of
an open week (×1.25). There is no cost, no wear, and the result changes
nothing. The screen's easier / even / harder tiers
(`TrainingScreen.tsx:165–183`) are opponents by rating gap; the engine treats
them alike apart from the opponent's rating.

**(d) A coach is one number.** Generated coaches are uniform 62–84
(`balance.ts:1472`; `market.ts:709–724`). An ex-pro is
`round(min(92, 55 + 0.25 × last card))` (`balance.ts:1474–1475`;
`market.ts:687–691`). The buff stat is hashed (`market.ts:698–702, 720`), and
nothing about a coach ever changes (`CoachState`, `types.ts:459–468`). The
training effect is `clamp(1 + (Q − 75) × 0.015, 0.85, 1.3)`
(`development.ts:655`), and having no coach is the 0.85 floor: a 15 % malus
against a 75 coach. *Formula,* season 0, Normal (`coachEffectsFor`,
`development.ts:676`; `coachSalaryFor`, `economy.ts:481`):

| Coach | Training shown on the card | Match rating mod | Wage / week |
|---|---|---|---|
| Generic 62–65 | +0 % (the same as none) | 0 | $10 |
| Generic 70 | +9 % | 0 | $40 |
| Generic 75 | +18 % | +0.3 | $120 |
| Generic 80 | +26 % | +0.8 | $300 |
| Generic 84 (the best) | +34 % | +1.2 | $620 |
| Ex-pro, last card 70 → 99 | 73 → 80 (+14 → +26 %) | 0 → +0.8 | $80 → $300 |

So the "++" coach level (85+, `market.ts:647`) never appears, any generic
over 80 beats every ex-pro, and a 99 legend coaches at 80.

**(e) Growth stalls by 18–19** (*baseline* §5.1: the season's gain p50 is
+3.5 at 17 and +0.6 at 19; the gap to potential ≈ 0 at 18–21), so a package
would have little to speed up today. DEV-01's expected peak and profiles give
it room; this contract assumes them.

## 5. Mechanisms and levers — *proposed, not applied*

New keys go in a `CAREER_PLAN` block and the existing `CAREER_SCRIM` /
`CAREER_COACH_MARKET`. New save fields are optional and additive (the persist
contract stays frozen).

**T1. The period.** `CAREER_PLAN.periodDays` **28**. A season is exactly 8 ×
28 days (`DAYS_PER_SEASON` 224), so the default is a fixed grid from each
season's day 1. Every period starts on a Monday and holds one or two official
weekends (`calendar.ts:158–197`):

| Period | Weeks | Inside |
|---|---|---|
| 1 | W1–4 | the preseason window, regional 1 |
| 2 | W5–8 | regionals 2 and 3 |
| 3 | W9–12 | the Major, window 1 |
| 4 | W13–16 | regionals 1 and 2 |
| 5 | W17–20 | regional 3, the Major |
| 6 | W21–24 | window 2, regional 1 |
| 7 | W25–28 | regionals 2 and 3 |
| 8 | W29–32 | the Major, the Worlds window, Worlds |

A package started mid-period runs to the grid's boundary (the card says how
many days). The ROADMAP's comparison is the split mode: three periods (W1–12,
W13–22, W23–32), each a split with its window. A floating 21-day period
would cut across weekends and windows; not proposed.

**T2. The package.**
- *Objective,* one of three: **Development** (growth speed and the focus
  attributes), **Competitive preparation** (chemistry, scrim quality,
  readiness for the period's events; little growth), **Recovery /
  consistency** (less wear; players past their peak hold longer).
- *Squad focus,* one: balanced, or one of today's five drill themes
  (mechanics, defense, offense, consistency + experience, clutch), at today's
  drill offset (+0.25 a week, `balance.ts:1201`).
- *Workload* for the squad: light, normal or heavy.
- *Scrims:* 0–3 a week at one level, or "the coach picks" (T3).
- *Tweaks* (optional, per player): another focus (today's personal focus,
  +0.35 a week at 90 % of the overall rate, `balance.ts:1169–1170`), another
  workload, or rest. The default is "follow the squad", and the card lists
  only the players who differ.

Effects multiply DEV-01's daily base rate, never below ×1.00:
- Development × (1 + **0.20** × coach effect) (range 0.10–0.30).
- Preparation × (1 + **0.05** × coach effect) (0–0.10); scrim XP and chemistry
  ×**1.5** (1.25–2.0).
- Recovery × 1.00; wear −**50 %** (30–70 %); for players past their peak,
  DEV-01's decline ×**0.75** (0.6–0.9) while it runs.
- Workload scales the boost and the wear: light ×0.5 boost and −40 % wear,
  heavy ×1.5 boost and +1 wear a week.

The *coach effect* is T4's focus efficiency; a package without a coach runs
at **0.5**. Everything stays inside DEV-01's season curve and cap, and a
package never adds potential (decision 2).

**T3. Scrims.** Three levels by the opponent's rating gap, picked from the
existing shortlist (`scrimShortlistFor`, `careerFlow.ts:3127`): easy (3–8
below), even (within 3), hard (3–8 above).

| Level | XP weeks per scrim (× field quality) | Chemistry (splits) | Wear | Also |
|---|---|---|---|---|
| Easy | **0.25** | 0.03 | −1 | +0.1 consistency offset ("confidence", decision 4) |
| Even | **0.40** | **0.06** | 0 | — |
| Hard | **0.60** | 0.03 | +2 | — |

Candidates, each ±50 %. In a week the second scrim pays **60 %** and the
third **30 %**; a period's scrim XP is capped at **25 %** (15–35 %) of its
projected gain. Scrims run on fixed weekdays (Tuesday, Thursday, Wednesday
for a third), never on a match day; preparation picks opponents like the
coming field. No points, prizes, rep or achievements; one summary line a
week instead of a toast per scrim.

*Wear* feeds the roll that exists today, the pre-event unavailability chance
(8 % per event plus 1 point per heavy-intensity player, `balance.ts:1176,
1580–1582`; `careerFlow.ts:971–990`): **+0.5 point** of chance per wear point
in the period, capped at **+4** (decision 6). There is no new fatigue system.

**T4. Coaches: three attributes.**

| Attribute | Scale | Its measurable effect (printed on the card) | Candidate |
|---|---|---|---|
| Quality | 60–95 | focus efficiency, the share of a package's boost that lands; the match modifier as today (`TEAM_RATING.coach`) | 0.6 at 60 → 1.0 at 90 |
| Experience | 0–10 seasons | the plan's quality (t5); recovery, wear −3 % a point | 0.85 + 0.015 a point |
| Specialty | development · preparation · recovery | its objective's main effect +**25 %** (15–35 %); the stat buff (`bonusType`) stays | — |

- *Generic coaches:* quality **60–90**, most around 72 (a good generic shows
  up in most windows, t7), experience 0–8, a rolled specialty.
- *Ex-pros:* quality from the **career-best** normal card, not the last:
  66 + **0.8** × (peak − 75), ± 4, clamped 64–94 (slope 0.6–1.0). A 75 peak
  coaches around 66, a 90 around 78, a 99 around 85. Experience starts at
  **3** (2–4): the playing years count. The specialty follows the archetype
  (mechanical → development; playmaker, veteran mind → preparation; anchor,
  ice-cold → recovery; all-round → rolled). Wage ×**1.15** (1.10–1.20) of a
  generic with the same quality and experience.
- *Growth:* +1 experience per season coached; quality +**0.5** a season (+1
  when most periods matched the specialty), up to a personal ceiling (start +
  3–8, never above 95). The ask moves at the rollover under the economy
  contract's renewal rule (M2).
- *Wage:* priced on the expected impact and the money index (M1), measured
  with the probe's coach line (C2) before any number is fixed.
- *The hire card* compares wage, specialty, the package effect and the
  expected impact over the next period ("≈ +0.6 OVR per starter against your
  current coach", illustrative), from one new engine function
  (`coachImpactFor`).

**T5. Delegation.** Three modes, always offered (the first needs a coach):
- *The coach runs it:* builds and renews every period (development by
  default, preparation for a period with a Major or Worlds, recovery when
  wear is high). Exceptions (high wear, a new signing, a coach change, a
  change of objective) become summary lines, never stops.
- *The coach proposes, I approve:* at each boundary the proposal is HQ's main
  block (`HQ-CONTRACT.md` H1): approve, adjust or keep the base. One tap per
  period.
- *I set it:* the manager builds it; the coach's proposal is one tap away.

"Repeat until I change it" works in every mode, with or without a coach.
BAL-02 picks the default per preset (decision 3). Until a coach is hired
(rep 10 today, `balance.ts:1424`) every preset starts on the base, with "I set
it" and "Repeat" open.

**T6. Execution.** Optional save fields: `trainingPlan` (period id, start and
end day, the package, the mode, `lastSessionDay`, days per coach, running
totals) and `trainingHistory` (a ring of **16** summaries, two seasons). A
session applies only to a day after `lastSessionDay`; scrims are dated
entries with ids that run once; the summary is written once, on the
boundary's Monday (period 8: at the rollover). A period never crosses a
season. An ECO-05 agenda day (`SPONSOR-CONTRACT.md` S7) skips that day's
session and scrim.

**T7. The summary.** Per player: overall before and after, attribute deltas,
series played, scrims (won–lost by level), the coach's share (the gain above
the coachless package rate, summed per day), wear and any unavailability; for
the squad, the chemistry change and the next proposal. Shown in Training →
History and HQ's training block ("last period"), with a news line, not a
toast.

**T8. Saves and migration.** Additive only. An old save starts on base
growth; per-player focus and intensity become tweaks; booked scrims still
run; the week's drill expires with its week; hired coaches keep their quality
and get experience from their source. No overall jumps.

## 6. Decisions for Miguel

1. **The period (T1).** A. A 28-day grid, 8 a season. B. One period per split
   with its window, 3 a season. C. 21 days, floating. *Recommendation: A,*
   with B as the playtest's comparison behind one key.
2. **What a package may move (T2).** A. Speed and attributes only; the peak
   stays DEV-01's. B. A sustained package also nudges where a player lands
   inside DEV-01's tolerance. C. Packages raise the peak. *Recommendation: A*
   (no inflation, simplest to measure); B in reserve if packages feel
   pointless near the peak.
3. **Delegation by preset (T5, BAL-02).** A. Easy: the coach runs it; Normal:
   the coach proposes; Hard: I set it. B. The coach proposes on every preset.
   C. The coach runs it on every preset. *Recommendation: A,* every mode
   always available.
4. **The easy scrim's "confidence" (T3).** A. Existing channels: the
   consistency offset and less wear. B. A short-lived form state (the P2
   "form state", its own scope call). *Recommendation: A.*
5. **Ex-pro coaches (T4).** A. Quality from the career-best card at slope
   0.8, experience 3, the archetype's specialty, a ×1.15 wage. B. Today's
   formula on the best card. C. Today's formula. *Recommendation: A.*
6. **Wear (T3).** A. It feeds today's pre-event unavailability roll. B. A
   visible fatigue meter. *Recommendation: A* (no new system).
7. **No coach (T2, T4).** A. No coach = DEV-01's base; the coach's training
   effect acts through the package. B. Keep the 0.85 floor. *Recommendation:
   A:* the base is "never a toll".

## 7. How it is measured

The existing instruments, same seeds (9100 and 17019, `ARC_SEEDS=2`); the
"before" is the build with DEV-01 in.
- **`CAREER_CURVES=1`** (pure engine, seconds; `careerArc.test.ts`): a new
  "packages" table, the expected period gain by age (13–27) × headroom ×
  objective × coach profile (none; generic 75 / 2 experience; generic 88 / 6,
  development; ex-pro peak 85; ex-pro peak 99); scrim XP by level and count;
  wear by workload; the coach market's quality by source (t7).
- **`CAREER_ARC=1`** (whole careers; `careerArcBot.ts`): two policy fields,
  `training: "base" | "repeat" | "delegate"` and `scrimLevel`. The seven
  policies keep today's behaviour for the "before"; two join (a delegator, and
  a trainer on manual development packages with even scrims). New columns:
  the baseline's §5.1 gain-by-age table with and without a package, seasons
  to the expected peak for 13–15 prospects, t1, t3, t4, wear incidents.
- **`CAREER_ECON=1`:** coaches cost money, so C1, C2's coach line and C3 are
  re-read after T4 (t8).
- **Gate 3b:** three periods per mode; count the training taps over a split;
  did any week want a click, did the summary explain the change, did the
  coaches feel different?

## 8. Order of work once approved

0. **For DEV-01, now:** calibrate the base as the no-package rate (no drill,
   balanced focus, normal intensity, no scrims, the coach term at ×1.00, not
   0.85). Today's drill, focus, intensity, scrim and coach multipliers are
   provisional; the first-guess scrim tunables ("Waiting on Miguel") settle
   with D3, at Gate 3.
1. **D1, the period:** T1, T6 and T8 with a "base" package that has no
   effect. Flow tests f1, f6, f7.
2. **D2, the package:** T2, T7, the projection and the history. The weekly
   drill and the per-card controls retire into it (f1, f8).
3. **D3, scrims:** T3 (f3).
4. **D4, coaches:** T4, the hire card and the market (f2, f5).
5. **D5, delegation:** T5 with BAL-02's defaults and HQ's training block
   (`HQ-CONTRACT.md` H3; f4).
6. **After each package:** `CAREER_CURVES`, `CAREER_ARC` and `CAREER_ECON` on
   the same seeds, the bands before and after in the CHANGELOG, and an R entry
   in `ROAD-TO-WORLDS-DECISIONS.md`. Then Gate 3b.
