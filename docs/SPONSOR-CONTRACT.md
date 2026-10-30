# Road to Worlds — the sponsor contract (ECO-04, with ECO-05's caps)

> **APPROVED (Gate 3a, 30/10: decisions 1–5 A, 6-B, 7-A, adjusted to
> ECO-07/08) and BUILT in rc.34** (ROAD-TO-WORLDS-DECISIONS R76, R80; the
> values are Claude's, behind `CAREER_SPONSOR`, tested at Gate 3b). Since
> rc.33 no career opens with a founding partner: (f) and S6 apply only to an
> rc.32 career still running one. The proposal below is kept as written.
>
> *Original status:* PROPOSAL — waiting for Miguel's approval (Gate 3a). ROADMAP Etapa 3,
> ECO-04 (sponsors) and the caps of ECO-05 (other income). It lives inside
> `ECONOMY-CONTRACT.md`: its bands (§3), its money index (M1), the founding
> partner (M3) and the guaranteed-income bases (M7, which decision 9-B tunes
> only after M1–M3 are measured). **No code, number or save shape changes
> until Miguel approves.** *Formula* numbers are computed from the cited code;
> *probe* numbers come from the economy contract's appendix (rc.30).
> Candidates are not measurements. Companions: `TRAINING-CONTRACT.md`,
> `HQ-CONTRACT.md`.

## 1. Why a contract

Sponsors are the guaranteed half of the economy, and today they are one
choice a season between two cards that differ only by tier. The ROADMAP asks
for
weekly pay, a fixed or milestone payment and a performance bonus; goals,
deadlines and proportional fines, announced up front and scaled to the
team's level and to the opportunities the calendar really offers; and
stability, total return, length, risk and the goal compared in one
component. ECO-05 adds appearance fees and partner actions with a cap and an
agenda cost, never free money that hides an imbalance.

## 2. The contract

**(a) Three dated parts in every deal:** weekly pay; a fixed payment on
signing or a milestone payment on a dated achievement; a performance bonus
per goal.

**(b) Fair goals.** A goal comes from the team's level and only from events
the calendar still offers before its deadline and the team can enter. Never
an unreachable goal, never a goal window without an event.

**(c) Fines are announced, proportional and bounded.** Printed on the offer,
proportional to the shortfall, capped, spread over the following weeks, and
never on a safe deal. This reverses the design's rule "objectives are bonus
targets, never penalties" (`ROAD-TO-WORLDS-DESIGN.md` §9), so it needs
Miguel's explicit yes (decision 1).

**(d) The choice is about risk, not a hidden best.** The offers of one
decision carry about the same expected value and differ in stability,
length, risk and goal, all shown in one comparison component.

**(e) Inside the economy contract.** A tier's money is M7's; every figure is
on M1's index at offer time; a signed deal keeps its figures (so a long deal
hedges the index); bands b3 (payroll ÷ guaranteed income) and b4 (prize
share) hold.

**(f) The founding partner hands over without a cliff.** *(rc.34, adjusted
to ECO-07/08:)* where a founding partner still runs, it hands over without a
cliff. Since rc.33 no career opens with one, and Easy's rescue partner (rc.34:
the investor on the first emergency loan) does not taper.

**(g) Other income is capped and costs agenda time.** It never counts as
guaranteed income.

**Legibility runs through all seven:** every rule is visible before it
bites, and the offer card, HQ and the Finances desk read one engine function.

## 3. Acceptance criteria

Measured on the economy contract's seeds and cells (§7 says how).

| # | Criterion | Candidate (Normal) |
|---|---|---|
| s1 | Expected value spread across one decision's offers (engine estimate at the goal's band) | ≤ ±10 % |
| s2 | Goals hit at their announced word: Likely ≥ 65 %, Even 35–65 %, Stretch 15–35 % (harness) | every word in band |
| s3 | Careers whose fines in a season exceed 2 weeks of payroll | ≤ 10 % |
| s4 | Backer rescues within 4 weeks after a fine | Easy 0; Normal ≤ 2 % of fines |
| s5 | b3 and b4 (`ECONOMY-CONTRACT.md` §3) with the bot on the Balanced profile | in band; Steady and Bold move b3 p50 by ≤ ±0.3 |
| s6 | The largest one-step fall in weekly guaranteed income at the founding partner's handover, seasons 0–2 | ≤ ⅓ of the partner's pay |
| s7 | Other income (ECO-05) ÷ earned income, p90 per season | ≤ 10 % |
| s8 | A deal signed before ECO-04 | runs to its end under its old rules |

Also: the comparison component fits a 360 px phone in EN and PT, and every
figure on it equals what the ledger books. **The gate** stays the economy
contract's playtest (its §7.6), plus one question: before signing, did you
understand what the deal asked and what a miss would cost?

## 4. Today against the contract

**The deals.** Four tiers at rep 0 / 25 / 50 / 75, with a base of $1.5k /
$6k / $18k / $45k a split, a bonus of $750 / $3k / $9k / $25k, one fixed
objective per tier (enter 2 events; a regional top 8; qualify for the Major;
a Major top 4) and perks (gear −20 / 35 / 50 %, one or two free bootcamps)
(`CAREER_SPONSOR`, `balance.ts:1364–1387`). Every deal lasts one season.

**The offers.** The best tier the rep allows plus the one below
(`sponsorOffersFor`, `economy.ts:960–984`), from two fictional brands per tier
(`economy.ts:919–924`), × difficulty (1.15 / 1.0 / 0.9) and ×1.10 a season at
offer time (`economy.ts:926–957`). The first offers come only once rep ≥ 12,
at a split boundary (the Mondays of W11, W21 and W31:
`careerFlow.ts:792–794, 1055–1077`). Renewal offers come at the rollover,
where the old deal ends (`careerFlow.ts:2270–2285`).

**The money.** A signing payment of one split's base
(`careerFlow.ts:3377–3392`), the base spread over the Mondays
(`weeklyStatement`, `economy.ts:719`), and the bonus at each split boundary
if the objective was hit, a miss if not (`careerFlow.ts:1261–1300`). Three
misses drop the renewal one tier (`economy.ts:973`;
`balance.ts:1380`). No fines, by design ("Never clawbacks",
`balance.ts:1379`).

**Goals are not scaled.** The tier sets both the money and the goal. In
*probe* C2 (Normal, every policy) the sponsor bonus income is about half the
base income in seasons 0–1 and 0.11–0.13 of it from season 4. A split's bonus
is about half its base, so this implies that T1's "enter 2 events" is
nearly always hit and the later objectives about one split in four. That is
an inference from the means, not a measured rate.

**Guaranteed income misses its band.** Payroll ÷ guaranteed, p50: 4.4 with
a T1 deal, 3.2 (T2), 2.5 (T3), 1.8 (T4), against Normal's 1.0–2.0 (*probe*
C3b). A T1 deal pays $141 a week at season 0 (P5).

**The choice.** HQ's card shows the brand, tier, weekly base, bonus and
objective (`NowCards.tsx:360–420`): no length, total, risk or deadline. The
Finances desk shows the active deal, its progress, the patience pips and the
perks (`FinancesScreen.tsx:940–1035`).

**Other income.** Three money inserts (`data/career/inserts.ts:35–62`): a
showmatch +$1,500 for −0.3 training weeks, sponsor content +$1,200 for −0.4,
a jersey shoot +$900 and +1 rep. They are random at 14 % a week
(`balance.ts:1001`), flat (M1 lists them), uncapped, and never taken by the
harness bot, which answers "b" (`careerArcBot.ts:445`): *probe* C2's inserts
row is $0, so no measurement has seen them.

## 5. Mechanisms and levers — *proposed, not applied*

New keys go in `CAREER_SPONSOR`; new save fields are optional and additive
(the persist contract stays frozen).

**S1. The deal.** A length of one split, one season or two seasons. A deal
signed at a split boundary starts its goals at the next split with events.
Its fields: length and end date, weekly pay, a fixed or milestone payment,
goals (each with its deadline, its events, its bonus and its fine), and the
tier's perks (kept). **ECO-04 moves no money by itself:** a tier's value is
what it pays today at an "Even" goal (base, signing payment and half the
bonuses: T2 $28.5k a season at season 0, *formula* from
`balance.ts:1370–1376`), or M7's once decision 9-B retunes it. Three
profiles share out their own ceiling (candidates):

| Profile | Weekly pay | Fixed / milestone | Bonus | Fine per missed goal | Lengths |
|---|---|---|---|---|---|
| Steady | 80 % | 10 % on signing | 10 % | none | 1–2 seasons |
| Balanced | 65 % | 10 % on signing | 25 % | ≤ 25 % of its bonus | 1 season |
| Bold | 50 % | 20 % at a milestone | 30 % | ≤ 50 % of its bonus | 1 split–1 season |

Ranges: weekly 50–85 %, bonus 10–35 %. Each ceiling is sized so that the
expected value at an "Even" goal (a hit one time in two) equals the tier's
value (s1). With these shares that puts Balanced's ceiling at about 1.13×
Steady's and Bold's at about 1.4× (arithmetic on the candidates): the reward
for the risk, in plain sight.

**S2. Goals.** Kinds: enter N events, a top 8 or top 4 in K of the regionals
left, qualify for the split's Major, a Major top 4, qualify for Worlds. Each
is built at offer time from:
- *the team's level:* its seed rating (`userSeedRatingFor`, the rating R45's
  direct-8 seeding reads) ranked among the region's teams, mapped to an
  expected finish band;
- *the calendar:* only events before the deadline that the team can enter,
  and a Major or Worlds goal only while the slots are still within reach (the
  race table, `raceTable.ts`).

The card shows a word (Likely / Even / Stretch), the deadline as a date and
the events that count. The rank-to-word mapping is calibrated on the harness
(s2), not guessed. A goal whose last event the career never reaches (an
ending) is void.

**S3. Fines.** Fine = the profile's share × the goal's bonus × the shortfall
(a top 8 in one of two regionals is half). Cap: ≤ **2** weeks of the deal's
weekly pay per goal (range 1–4), booked as its own ledger line and spread
over the next **4** Mondays (2–6), never a lump sum. Never on Steady deals,
never on Easy (decision 1). One consequence per miss: on a deal with fines,
a miss no longer counts on the patience meter; Steady deals keep today's
meter (decision 7).

**S4. Offers.** When: at the season start (renewals) and at each split
boundary for an org without a deal (as today), and at the founding partner's
handover (S6). How many: three cards, one per profile, all at the best tier
the rep allows (after three misses on a Steady deal the renewal comes one
tier lower, as today). Goals now follow the team, not the tier, so today's "tier
below" safe option becomes the Steady card. Difficulty and the index apply
to the tier's value before the profiles share it out. The brand pool (8
today) grows with the copy, EN and PT.

**S5. The comparison component.** One card per offer, five rows in the same
order on every card, the current deal shown above for reference, and no
"recommended" badge. A low-fidelity phone sketch (a full-season T2 Balanced
deal at season-0 money, on the candidates above):

```
┌ APEXFUEL · Tier 2 · Balanced ───────────────┐
│ Stability   ███████░░░  $690 a week, sure   │
│ Total       $25.3k sure · up to $33.8k      │
│ Length      1 season · ends with Worlds week│
│ Risk        a missed goal costs up to $700  │
│ Goal        Top 8 in 2 of the split's 3     │
│             regionals · by its W8 · Even    │
│ [ Sign ]                                    │
└─────────────────────────────────────────────┘
```

PT rows: Estabilidade · Retorno total · Duração · Risco · Meta.

**S6. The founding partner's handover (M3).** *Built in rc.34:* only an
rc.32 career still running a founding partner (`honourRunning`) hands over.
Once its end condition is met (past season index 1 with a real deal), it pays
⅔ of its indexed base for one split, then ⅓ for one split, then ends
(`founding.taper`; `[]` restores the cliff). The steps land on boundary
Mondays; a mail gives both dates when the handover begins, and the decision
card and Finances show it with the net weekly change. Band: each step ≤ ⅓ of
the full pay at that Monday's index, plus rounding; measured 0.36.
*As proposed:* M3, being built in 2b part 2
as a provisional default: a tier-0 deal from day one paying 0.7 × the
founding wage bill per split, indexed, until the first real deal and at
least through season index 1. *Formula:* a Normal balanced roster costs $500
a week (P0), so the partner pays $350 at season 0 and about $408 at season
index 2 on M1's 1.08. A T1 deal pays about $170 a week at season index 2
today (P5 gives $155 at S1 and $183 at S3). Ending the partner at once on
such a deal would cut the guaranteed income by more than half at the very
rollover where the founders renew (P0, C6).

Proposed: through season index 1 the partner pays in full, whatever deal is
held. From then, starting with the first real deal (or at the end of season
index 1 if one is already held), it tapers over two splits (⅔, ⅓, then 0).
The taper is announced on the Finances desk and the offer cards from the day
the first real deal is signed. Each real offer shows the net weekly change at
the handover. The cost is at most one extra split of partner pay (s6).

**S7. ECO-05: other income, capped.** Two kinds: *appearance fees* (a
showmatch, a fan event, a creator day, offered by the scene) and *partner
actions* (content days that a Balanced or Bold deal carries as clauses).
- *Agenda cost:* each takes a weekday, and that day's session and scrim do
  not run. DEV-03's plan shows them as agenda days and its summary counts
  them. Never on a match day.
- *Fee:* about one week of the org's guaranteed income (range 0.5–1.5
  weeks), on M1's index. Today's flat $900–1,500 is two to three weeks of a
  Normal balanced roster's wages at season 0 (P0).
- *Cap:* **2** a split (1–3), and at most **10 %** (5–15 %) of the season's
  earned income. Beyond it the offer is refused, with the reason.
- *Never guaranteed:* outside b3 and outside the Finances "guaranteed" line;
  shown as "other income".

## 6. Decisions for Miguel

1. **Fines** (S3; reverses design §9). A. Proportional fines on Balanced and
   Bold deals only, none on Steady deals or on Easy. B. Fines on every deal
   and difficulty. C. No fines; risk only through a lower weekly pay and a
   bigger bonus. *Recommendation: A:* risk becomes a choice, and the
   newcomer's path stays penalty-free.
2. **Deal length** (S1). A. One split, one season or two seasons. B. One
   season, as today. C. One season or two. *Recommendation: A.*
3. **Offers per decision** (S4). A. Three, one per profile, at the best
   tier. B. Two, as today (the best tier and the one below), one profile
   each. C. Four. *Recommendation: A* (readable on a phone, and s1 holds).
4. **The goal's difficulty** (S2). A. A word (Likely / Even / Stretch),
   calibrated on the harness. B. A percentage. C. No estimate.
   *Recommendation: A:* a percentage would claim a precision the model does
   not have.
5. **The founding partner's handover** (S6, M3). A. In full through season
   index 1, then a two-split taper from the first real deal. B. M3 as
   built: it ends when a real deal is held after season index 1. C. A top-up
   to the partner's level through season index 1, then it ends.
   *Recommendation: A* (no cliff, bounded cost); B if the M1–M3 re-measure
   shows no drop.
6. **Today's money inserts** (S7). A. They become capped, indexed ECO-05
   items with the agenda cost. B. They stay random inserts, indexed and
   counted against the cap. C. Leave them. *Recommendation: B for 2.0* (no
   new screen; the cap and the index still hold), A once the agenda proves
   itself.
7. **The patience meter** (S3). A. Steady deals keep it; fines replace it on
   the others (one consequence per miss). B. Keep it on every deal, fines
   too. C. Retire it. *Recommendation: A.*

## 7. Order of work once approved

Start after the economy contract's E1–E2 (M1 and M5, M3 and M2) are
re-measured, with M7 measured on the same seeds (decision 9-B).
1. **P1:** S1, S5 and S6: the deal shape without fines, the comparison card,
   the handover; old deals run out. Flow tests: sign, renew, the handover, an
   old save mid-deal, a refresh mid-offer.
2. **P2:** S2, with the probe table that calibrates the words (s2).
3. **P3:** S3, if decision 1 is A or B. Tests: proportional, capped, spread,
   none on Steady or Easy.
4. **P4:** S7 and decision 6.

**Measuring.** After each package: `CAREER_ECON=1` (C1, C2's sponsor lines,
C3, C3b) on the same 294 careers, plus a new probe table, "deals by profile"
(the expected value spread, hits by word, fines paid, the handover's step).
The bot gets `sponsor: "steady" | "balanced" | "bold"` beside today's
`"best" | "worst"`, and `others: "take" | "skip"`, so ECO-05 is measured at
all. The bands before and after go in the CHANGELOG, the rule in an R entry.
