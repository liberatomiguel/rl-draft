# Road to Worlds — the HQ contract (UX-01)

> **PROPOSAL — waiting for Miguel's approval (Gate 3a).** ROADMAP Etapa 3,
> UX-01 a–f: the HQ around the next decision. The asks themselves were
> decided in the 28/10 plan ("the HQ and profile asks" are not re-asked);
> this contract fixes how they are built and how each is checked. **No code
> changes until Miguel approves.** Mobile first, EN and PT. It also shows
> what `TRAINING-CONTRACT.md` (DEV-03) and `SPONSOR-CONTRACT.md` (ECO-04) put
> on HQ. Sketches are low fidelity and their figures illustrative.

## 1. Why a contract

HQ is where a career is lived. Today it stacks a clock card, a "Needs you"
list that can hold several decisions at once, the squad, training and two
news feeds, plus a side column (goal, race, finances, inbox, next unlock)
that on a phone renders after both feeds. Miguel asks for an HQ built around
the next decision, with the squad, the plan and the money readable at a
glance.

## 2. The contract

**(a) One main block, one decision.** The top block always shows exactly one
thing: the next needed decision, or the clock when none is due. The clock
never passes a needed decision, whatever button or path moves it.

**(b) The squad reads like Draft cards:** rating frame, club icon, the
numbers that matter, on a phone.

**(c) Training is a plan to see and steer,** not a weekly chore.

**(d) The race comes from the selection's own table.**

**(e) Money is honest:** only booked or committed figures, and a history made
only of what the save recorded.

**(f) The toolbox is within reach:** price, effect and duration before buying.

**(g) Mobile first:** 360 px with no horizontal scroll, 44 px tap targets, EN
and PT with the same keys.

**(h) HQ shows engine truth:** every figure comes from a flow or engine
function that its own screen also reads; no game logic in components.

## 3. Acceptance criteria

| # | Block | Passes when |
|---|---|---|
| h1 | Decision | For every decision kind, no control (Play, Skip, +1 day, the top bar's Continue) moves the clock past it, and `advanceDayFlow` itself refuses (one flow test per kind). One decision shows at a time; the others are listed with their deadlines. |
| h2 | Squad | No initials square. Each card shows the overall in its rating frame, the club icon, name, age, trait, growth and potential, readable at 360 px in EN and PT; a tap opens the player. |
| h3 | Training | The active plan, progress, days left, focus, scrims, coach and last result, with adjust, approve and delegate reachable from the block. |
| h4 | Race | Built (R49). It keeps reading the selection's table, the same figures as Standings. |
| h5 | Finances | Balance, next payroll (date and amount), guaranteed income, debt and projection; the chart opens larger, with up to 96 weeks once recorded and no point the save did not record. |
| h6 | Toolbox | Every boost can be bought from HQ with its price, effect and duration; the bootcamp shows its end date; every refusal says why. |
| h7 | Order | The phone order of H7; HQ makes no new network request. |

Each block ships with the ROADMAP's browser E2E: desktop and mobile, EN and
PT.

## 4. Today against the contract

**The layout** (`HubScreen.tsx:376–660`): a main column (the day card,
"Needs you", squad, training, the wire, the transfer wire) and a side column
(goal, race, finances, inbox, next unlock). On a phone it is one column, so
the race and finances sit below both feeds.

**(a) Decisions.** Only the weekly insert takes over the clock card
(`DayCard.tsx:236–239`). A bid, a sponsor choice or an invite is a card
below it (`HubScreen.tsx:381–465`) while Skip and +1 day stay live
(`DayCard.tsx:258–289`: no blocked primary for a "decision"). The autoplay
stops for them (`continueKind`, `careerUi.ts:614–631`;
`CareerAutopilot.tsx:33–42`), and so does the batched Skip, after moving one
day (`isStopState`, `careerFlow.ts:2540–2574`). But `advanceDayFlow` only
refuses an insert or an official matchday (`careerFlow.ts:2494–2526`), so +1
day walks past a bid until it expires (two weeks, `careerFlow.ts:606–607`)
and past an invite, which is declined on its matchday.

**(b) Squad** (`SquadBlock.tsx`): three starter tiles with an initials square
on the org's colours (`SquadBlock.tsx:24–26, 28–40`), the overall as plain
text, archetype and age, phase, the potential band and the growth bar; the
reserve and the coach as one-line tiles. No rating frame, no crest, no
contract warning.

**(c) Training** (`TrainingBlock.tsx`): the week's drill, a one-tap scrim and
the "edges" chips (coach, gear, psychologist, bootcamp, sponsor perks): the
weekly model DEV-03 replaces.

**(d) Race:** built in rc.31 (R49, `RaceBlock.tsx`). The Major / Worlds
toggle opens on the Major through the preseason and the splits, and on
Worlds in the windows and W31–32. It shows rank and points; the line (`raceLineOf`: secured, inside,
level, N points behind, out); the top two, both sides of the cut and the
user; local sides tagged; fixtures left; a link to Standings. It reads
`raceTableOf` (`careerUi.ts:464`), the selection's own order and tie-break.

**(e) Finances.** The HQ tile shows the balance, the week's net, the runway,
and the Backer's remainder or the bank's next instalment
(`HubScreen.tsx:553–590`). There is no next payroll, guaranteed income or
projection. The Finances chart is a sparkline of the last 40 ledger lines
(`FinancesScreen.tsx:365, 563–574`), rebuilt from a 160-line tail
(`balance.ts:1710`): its points are lines, not weeks, so its x-axis is not
time, and it has nothing larger to open.

**(f) Toolbox.** It is sold in Finances (the gear ladder, bootcamps, the
psychologist; `FinancesScreen.tsx:850–930`); HQ shows chips and a "bootcamp
ready" link (`TrainingBlock.tsx:35–55`). A bootcamp's edge is spent by the
next official event (`careerFlow.ts:1635–1638`), not a split, and no screen
shows when it ends.

## 5. The blocks — *proposed, not applied*

**H1. The decision block** (a).
- *One list.* A new flow function, `neededDecisionsFor(save)`, read by the
  day card, the top bar, the autoplay, `isStopState` and `advanceDayFlow`.
  It holds: today's matchday or an event in progress, the season review, an
  insert, an incoming bid, sponsor offers, a fresh unofficial invite, a
  DEV-03 period proposal (when not delegated) and a UX-06b contract review
  before the rollover. A standing rule takes a kind off the list
  (auto-entered unofficials, a coach who runs training).
- *Order:* the matchday and the season review first, then what is due
  today, then by deadline.
- *The block* shows one decision whole, with its consequence and deadline.
  One line below lists the others. Warnings that are not decisions (cash
  tight, the Backer, expiring contracts) become one notice line under the
  block, linking to their screen.
- *With nothing due* it is today's clock: date, week strip, Play / Skip /
  +1 day, the next stop.
- *"Later"* (decision 1) parks a bid or a sponsor choice on that line; the
  clock stops again on its deadline day.

```
┌ TUE 15 DEC 2020 · W11 · WINDOW ─────── 1 of 3 ┐
│ BID FOR AXEL                                   │
│ Team Nova offers $48k (his value $44k)         │
│ He leaves now · you can refill the seat        │
│ [ Accept ]    [ Decline ]    [ Later ]         │
│ Also: sponsor offers · training plan (28 Dec)  │
├────────────────────────────────────────────────┤
│ ⚠ 6 weeks of runway · Finances →               │
└────────────────────────────────────────────────┘

┌ MON 16 NOV 2020 · W7 · TRAINING WEEK +25 % ────┐
│ M  T  W  T  F  S  S          (week strip)      │
│ [ ▶ Play ]   [ Skip to Regional 3 ]    +1 day  │
│ Next stop: Regional 3 · Sun 29 Nov · 13 days   │
└────────────────────────────────────────────────┘
```

(Season 0 dates: day 1 is Mon 5 Oct 2020, `CAREER_SEASONS`; bids only come
in windows.)

**H2. Squad cards** (b). Compact Draft-style cards. The border is the
Draft's rating frame by overall (`baseRarityOf`, `cards.ts:73`: silver from
70, gold from 80, blue from 90). The club icon sits in the logo slot
(decision 2). Each card shows the overall large; the name; age · trait (the
archetype, plus DEV-01's maturation profile once scouted); growth (the bar
and "next point in N days", from DEV-01's ETA); potential as DEV-01's
expected peak ("Peak ~91", or the scouted band); a role chip (starter or
reserve) and UX-06b's contract chip. Phone: a 2 × 2 grid, three starters and
the reserve (the squad caps at four, R47), with the coach as one line under
it. Desktop: four in a row. A tap opens the player.

```
┌───────────────┐ ┌───────────────┐
│ 84        [◆] │ │ 79        [◆] │  overall in its frame · crest
│ AXEL          │ │ NOVA          │
│ 16 · Playmaker│ │ 19 · Anchor   │  age · trait
│ ▓▓▓▓▓░ 3 days │ │ ▓▓░░░░ 9 days │  growth to the next point
│ Peak ~91      │ │ Peak ~82      │  expected peak
│ STARTER       │ │ ⚑ ENDS 2022   │  role · contract
└───────────────┘ └───────────────┘
Coach Ferro · quality 82 · development · +22 % on Development
```

(+22 %: `TRAINING-CONTRACT.md` T2 and T4's candidates, 0.20 × 0.89 × 1.25.)

**H3. The training block** (c), DEV-03 on HQ:

```
TRAINING · Development · Mechanics           Training →
Day 12 of 28  ▓▓▓▓▓▓░░░░░░  16 days left
Scrims 3 of 8 · even          Coach Ferro +22 %
Last period  +1.4 avg · AXEL +2.1 · wear low
[ Adjust ]          Delegate: the coach runs it ✓
```

A waiting proposal ("approve" mode) is H1's block, not a card here. Until
DEV-03 lands, today's block stays; its "edges" chips move to H6.

**H4. Race** (d). What exists is §4 (d). What stays:
1. On a phone it moves up, after training (H7).
2. The ROADMAP's "the same source as the seeding" is read here as the Major /
   Worlds selection, which the block already uses. The direct-8 seeding of
   the next regional (R45) is a separate ranking; decision 6 adds one line
   for it ("Next regional: direct seat / Saturday qualifier", from
   `userIsDirect`).
3. Its EN and PT E2E at 360 px.

**H5. Finances** (e). The tile shows:
- the balance;
- the next payroll: the date (`nextPaydayFor`) and the amount (the week's
  expenses, `weeklyStatement`);
- guaranteed income a week (sponsor weekly pay, the founding partner and the
  fanbase; ECO-05's other income shown apart);
- debt: the Backer's remainder, and the bank's remainder with its next
  instalment;
- a projection to the end of the split from committed flows only (no prize
  assumed, and the label says so), and the runway.

The chart is a 12-week line on the tile. A tap opens a sheet with up to
**96** weeks (range 32–160): the closing balance each Monday, marked at
prizes, signings and rescues. Its data is a new optional ring of Monday
closing balances with the week's income and expenses (decision 4), recorded
from the first Monday after the update. Until two points exist the sheet
shows today's ledger sparkline, labelled as such. Nothing is back-filled or
interpolated.

```
FINANCES                                ▁▂▃▅▄▆  (tap)
$7.4k      −$630 a week · 11 weeks of runway
Payroll    Mon 28 Nov 2022 · $1,240
Guaranteed $1,040 a week (sponsor $680 · partner $270, tapering · fans $90)
Debt       bank $6.2k · next $430, same Monday
End of split (3 Mondays), no prizes counted: $5.5k
```

(Season index 2, a tier-2 sponsor deal, and the founding partner's taper
of `SPONSOR-CONTRACT.md` S6.)

**H6. The toolbox** (f). One HQ block: owned items with their effect, active
boosts with their end, and the next buys with the price (and the sponsor
discount), effect, duration and upkeep, with UX-06a's "New" marker. Buying
opens a confirm sheet (price, effect, duration, the balance and runway
after) and calls today's flows (`buyGearFlow`, `runBootcampFlow`,
`setPsychologistFlow`; `careerFlow.ts:2963–3031`), whose refusals (rep gate,
the Backer, funds) become the sheet's reason. The bootcamp lasts one split:
its edge applies to every official event from the purchase to the next split
boundary or the season's end (the Mondays of W11, W21 and W31 reset the
one-a-split allowance), so a split's Major is its last event, and the block
says "until Sun 13 Dec" (its value over a split is decision 5). Today's
"edges" chips move here.

```
TOOLBOX                                    Finances →
Active  Bootcamp T1 · +0.5 rating · until Sun 13 Dec (the Major)
Owned   Peripherals +5 % training · Monitors +5 %
Next    PCs  $10,000 → $8,000 (Tier 2 sponsor −20 %)
        +10 % training · +1 buff level · $250 a split  [ Buy ]
        Psychologist · $4,000 a split · +1 clutch, +1 consistency  [ Hire ]
```

**H7. The order.** Phone: the decision block → squad → training → race →
finances → toolbox → season goal → inbox → the wire → the transfer wire →
next unlock. Desktop keeps two columns: main (decision, squad, training, the
wire, the transfer wire) and side (race, finances, toolbox, goal, inbox,
next unlock).

**H8. Copy.** Every new string in `copy.career.en.ts` and `.pt.ts` under the
same keys (the types enforce parity), in the existing PT terms ("Treino",
"coach", "Patrocínio"). Proposed PT: Decisão · Depois · Receita garantida ·
Próxima folha · Projeção · Caixa de ferramentas · Plano de treino.

## 6. Decisions for Miguel

1. **"Later" on a decision** (H1). A. Never: every decision holds the clock
   until answered, like the insert. B. For bids and sponsor offers, up to
   their deadline. C. For everything but inserts and matchdays.
   *Recommendation: B.*
2. **The card's club icon** (H2). A. The user's crest. B. The player's last
   real org. C. Both, the crest large and the old org small.
   *Recommendation: A:* he plays for you, and the old org belongs on the
   player sheet.
3. **The card's frame** (H2). A. The Draft's rarity frames (70 / 80 / 90)
   through `baseRarityOf`. B. A career-only scale in `balance.ts`.
   *Recommendation: A:* it is the Draft look, and a Draft retune moving a
   frame is only cosmetic.
4. **The finance history** (H5). A. A ring of Monday balances, 96 weeks (a
   few KB), from the update on. B. The ledger tail only, as today. C. The
   whole career (an unbounded save). *Recommendation: A.*
5. **The bootcamp over a split** (H6). A. Today's edge (+0.5 / +1.0) for the
   whole split, with the price re-measured. B. Half the edge over the split.
   C. One event, as today, which contradicts the ask. *Recommendation: A*
   behind a key, measured with `CAREER_ARC` (series won) and `CAREER_ECON`
   (the price on M1's index); B if the bootcamp turns out to beat a coach.
6. **A seeding line in the race block** (H4). A. Add "Next regional: direct
   seat / Saturday qualifier". B. Keep the block as built.
   *Recommendation: A:* one line that answers the week's question.
7. **Buying in HQ** (H6). A. A confirm sheet on HQ, with the full ladder kept
   in Finances. B. HQ links to Finances, as today. *Recommendation: A.*

## 7. Order of work once approved

Each step is one task with its E2E (desktop and mobile, EN and PT):
1. **H1** with `neededDecisionsFor` and one flow test per decision kind.
   It comes first because DEV-03's proposals and ECO-04's offers both go
   through it.
2. **H2**, with UX-06b's contract chip.
3. **H5** (the ring and the sheet) and **H6** (with UX-06a's unlock modal
   and "New" markers).
4. **H3**, together with DEV-03's delegation step (D5).
5. **H7** and H4's two small changes.

There is no save bump: the new fields (the balance ring, the parked
decisions, the seen state) are optional and additive, and the persist
contract stays frozen.
