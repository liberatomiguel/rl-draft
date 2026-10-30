# Road to Worlds — the economy contract (ECO-01, PROPOSAL)

> Status: **a proposal for Miguel's approval** (ROADMAP Etapa 2b, written at
> rc.31 on top of rc.30). Miguel (30/10): build the recommended options as
> provisional defaults to test; **rc.32 did** (§5–§6, R50–R53, R58), each
> behind a `balance.ts` key that restores rc.31, re-measured in §9. Nothing
> is final until he confirms it at Gate 2. It binds ECO-01, frames ECO-02
> (bank and Backer), ECO-03/03a/03b (contracts, stars, bids) and BAL-02
> (difficulty presets), and leaves room for ECO-04 (sponsors) and ECO-05
> (other income) in Etapa 3. The numbers come from `CAREER-BASELINE-rc30.md`
> and the economy probe (`src/store/careerEconomy.probe.test.ts`), whose
> tables are the appendix. Regenerate them; never hand-edit them. §8
> re-measures rc.31 (fronts A and C merged) and §9 rc.32: the same seeds,
> the deltas.

## 1. Why a contract

The baseline (rc.30) found 59 % of the harness's careers going insolvent
(63 % on Normal, 100 % in EU and NA), survivors piling up $0.5–1.0M, and
developed players renewing at about three times their old wage. The probe
confirms it and counts 64 % once it includes the insolvencies the harness
misreports (§4). Miguel never went bankrupt; friends less familiar with the
game did, and stars became easy to buy at some point. People take different
paths: develop their own players, sell and trade up, buy stars. So the
economy gets a written contract before any retune, like DEV-03.

The document gives the principles (§2), how we know they hold (§3), where
today fails them (§4), what would change, marked *proposed — not applied*
(§5), Miguel's decisions (§6) and the order of work (§7).

Units: money moves every Monday (R20), contracts are priced per split, and a
season is 32 weeks or 3 splits. The tables give per week and per season.
**Every band is relative** (weeks of payroll, ratios, shares, rates), so the
contract survives DEV-01's growth curve, any rescale and the infinite era.

## 2. The contract

**(a) A newcomer never goes bankrupt by playing normally.** "Normally" means
taking a sponsor when one is offered, entering the events on offer, renewing
or replacing expiring players, and never signing past what Finances says the
books carry. On Easy and Normal such a career never ends through money.
Before any rescue the manager is warned at least twice, in weeks of runway,
with the projected breach. The Emergency Backer buys a real recovery window
and says how to clear it. On Easy and Normal a breach triggers a
restructuring before it can end the career.

**(b) One progressive money scale.** Wages, fees, bonuses, coach asks, prizes,
sponsor deals, the fanbase, the Backer, the bank and every price grow by the
same season index. Signed contracts keep their figure, so a long deal hedges
the index. The money grows season by season, but no ratio between two
streams drifts, so inflation alone pushes no median career toward bankruptcy
or wealth.

**(c) Stars stay a real decision late in the career.** At every season a star
(88+) costs a real share of what a top org takes in, not a point on a curve
that the user's income outgrows. AI orgs hold no money, so the yardstick is
the **T4 contender**: the top sponsor tier plus a contender's prizes (P8),
indexed. In a median career, carrying a 90+ in seasons 5–7 always costs
something: a sale, a skipped upgrade or a tighter runway.

**(d) Every path is viable.** Developing your own, selling and trading up,
and buying stars (costlier and riskier) all reach season 8 solvent at about
the median rate of their difficulty. A renewal never punishes development:
the raise is bounded by the player's own last wage unless that would leave
him far below his market value, and he never costs more than buying the same
overall. Selling returns market value, and the seat can be refilled in the
same window.

**(e) No snowball.** A title run does not stop money being a decision. The
best careers bank at most about two seasons of their payroll, a dominant
season's prizes pay a contender squad about once and a half, and winning
carries its own costs (a players' share, raises).

**(f) Regional identities stay, and no pool is a trap.** SAM stays the
accessible pool (2 slots) and EU the strong one (4). The money rules are the
same everywhere; only the competition differs. On Normal, no pool's
insolvency exceeds the band by more than ten points.

**Legibility runs through all six:** every money rule is visible before it
bites.

## 3. Acceptance criteria

The probe measures every band over 8 seasons, on every pool, policy and
difficulty, with the baseline's seeds. Row a1 is `CAREER_ARC.insolvencyRateMax`
(balance.ts). The ROADMAP's "done when" maps onto these rows: a first career
pays its way without an unlikely win (a1, a7), a median career meets real
choices (b2, e3), a title run does not snowball (e1, e2), and inflation forces
neither bankruptcy nor wealth (b1, b2).

"Today" is rc.30 measured by the probe, easy / normal / hard; ✗ marks a band
missed on some difficulty.

| # | Criterion (probe table) | Easy | Normal | Hard | Today (rc.30) |
|---|---|---|---|---|---|
| a1 | Insolvent careers over 8 seasons, every policy (C1; `CAREER_ARC`) | ≤ 2 % | ≤ 10 % | ≤ 25 % | 46 / 67 / 78 % ✗ |
| a2 | Insolvent newcomer careers: autopilot, badSponsor, losingStart (C1) | 0 % | ≤ 5 % | ≤ 20 % | 57 / 76 / 83 % ✗ |
| a3 | Rescues with an inbox warning in the 8 weeks before (C1) | 100 % | 100 % | 100 % | 38 / 24 / 13 % ✗ |
| a4 | Lead from that warning to the rescue, p50 (C1) | ≥ 4 wk | ≥ 4 wk | ≥ 3 wk | 7 / 7 / 8 wk |
| a5 | Rescue window: weeks of burn the Backer buys, p50 (C1) | ≥ 10 wk | ≥ 8 wk | ≥ 4 wk | 4 / 5 / 5 wk ✗ |
| a6 | Rescued careers that never go insolvent (C1) | ≥ 90 % | ≥ 60 % | ≥ 30 % | 4 / 7 / 8 % ✗ |
| a7 | Newcomer careers whose seasons 0–1 pay their way without a big win (C1c) | ≥ 80 % | ≥ 60 % | ≥ 40 % | 67 / 40 / 24 % ✗ |
| b1 | Every money stream on one season index (P1) | ±2 % | ±2 % | ±2 % | ×1.00–2.21 by S7 ✗ |
| b2 | Balance in seasons of payroll, p50, seasons 1–7 (C9) | 0.3–2.0 | 0.25–1.5 | 0.1–1.0 | 0.5–0.7 / 0.1–0.5 / 0.1–0.5 ✗ |
| b3 | Payroll ÷ guaranteed income, p50, every season (C3) | 0.8–1.6 | 1.0–2.0 | 1.2–2.5 | 1.8–6.2 / 2.2–7.2 / 2.8–8.1 ✗ |
| b4 | Prize share of earned income, p50, every season (C3) | ≤ 40 % | ≤ 45 % | ≤ 50 % | 43–72 / 36–70 / 32–70 % ✗ |
| c1 | A 90's season wage ÷ the T4-contender income, every season (P8) | ≥ 0.35 | ≥ 0.35 | ≥ 0.35 | 0.74 → 0.63 |
| c2 | Careers that can carry the cheapest 90+ at seasons 5–7, guaranteed + prize room (C7b) | ≤ 40 % | ≤ 25 % | ≤ 15 % | 10–36 / 0–3 / 0 % |
| c3 | Careers with an 88+ signing by season 4: the star path exists (C7b) | ≥ 20 % | ≥ 15 % | ≥ 10 % | 22 / 4 / 0 % ✗ |
| d1 | Developed players' renewal raise, p50 · a season-1 founder's ask ÷ guaranteed income, p50 (C6) | ≤ 1.6 · ≤ 1.5 | same | same | ×2.97 · 2.70 ✗ |
| d2 | Youth and tuned insolvency vs autopilot's; spender vs the band (C1) | ≤ autopilot + 5 pts; spender ≤ 2 × band | same | same | normal: youth 71 vs 64, spender 86 % ✗ |
| e1 | Balance in seasons of payroll, p90, seasons 2–7 (C9) | ≤ 3.0 | ≤ 2.0 | ≤ 1.5 | 1.6–4.4 / 0.7–1.1 / 0.5–1.6 ✗ |
| e2 | A dominant season's prizes ÷ a three-85 squad's wages (P4b) | ≤ 1.5 | ≤ 1.5 | ≤ 1.5 | 1.94 → 2.50 ✗ |
| e3 | Season-rows with a tight Monday, seasons 3–5: money still decides (C9) | ≥ 10 % | ≥ 20 % | ≥ 30 % | 14–19 / 30–50 / 32–60 % |
| f1 | Worst region's insolvency (C1b) | ≤ band + 10 pts | ≤ band + 10 pts | ≤ band + 10 pts | NA and EU 100 % on all three ✗ |

**What the harness is, and what the gate is.** The probe and `CAREER_ARC`
are a **regression check on fixed seeds**, not a model of human play. The bot
does not negotiate, buy gear or bootcamps, answer the inserts with money, list
players, or react to a warning the way a person does. A band can hold for the
bot and fail for a person, or the other way round. **The gate is a human
playtest** on staging: Miguel's long career (he never went bankrupt) and the
first careers of two or three newcomers (friends less familiar with the game
did), with the checklist in §7.

## 4. Today against the contract

Measured at rc.30 (`staging` f60ef74) by the probe on the baseline's 294
cells. Triples are easy / normal / hard; table names refer to the appendix.

**(a) Newcomers go bankrupt, the warning misses, the rescue is a countdown.**
- Day one on Normal: the founders cost $500 a week against $19 of guaranteed
  income (no sponsor before rep 12). The $12k budget lasts 24 weeks and the
  Backer about 27 more, while a weak side earns $120–280 a week in prizes
  (P0).
- The newcomer policies go insolvent in 57 / 76 / 83 % of careers, three in
  four Normal insolvencies in seasons 1–3. Only 40 % of Normal newcomer
  careers pay their way through seasons 0–1 without a big win (C1, C1c).
- Only 38 / 24 / 13 % of rescues get an inbox warning in the 8 weeks before.
  The warning fires only at exactly 4 weeks of runway, so a renewal jumps
  past it, and a rescue back to +$3k at a ~$750 burn triggers it just after.
  The rescue buys a median 4–5 weeks, and 93 % of rescued Normal careers
  still go broke (C1).

**(b) The streams drift apart.** By season 7 asks are ×1.72, prizes ×2.21
and new sponsor deals ×1.95, while the fanbase, start budget, Backer, bank and
prices stay ×1.00 (P1). The 14 insolvencies of seasons 6–7 come when a $3k
rescue covers less than a week of a contender's wages.

**(c) Stars: the curve holds, the wealth does not.** A 90's season wage is
63–74 % of a T4 contender's income (P8). Yet "stars get easy" is real where
careers win: on Easy, 36 % can carry a 90+ by season 7, while on Normal the
bot gets there in only 0–3 % of careers (4 % sign an 88+ by season 7, C7b).
The rep premium for players up to 88 vanishes from rep 75 and the signing
cap from rep 84 (P2b). A person who wins more than the bot meets this on
Normal, which only the playtest can show.

**(d) Developing is punished at renewal; selling is luck.** Founders renew at
×4.58 in season 1 (p90 ×11.1) and developed players at ×2.97, and one
founder's new ask is 2.7× the org's guaranteed income (C6). On Normal the
youth policy fails more often than autopilot (71 % against 64 %). Selling and
trading up is the healthiest path (43 % insolvent on Normal against 64–100 %
for the others, with a median $131k of sales, C2c), but only when a random
bid lands.

**(e) Winners snowball where the bot wins.** A dominant season's prizes pay a
three-85 squad 1.9× at season 0 and 2.5× at season 7 (P4b). On Easy the top
decile banks 1.6–4.4 seasons of payroll and $1.03M by season 7 (C9, C4). On
Normal the bot's best careers stay near one season, since few reach the top.

**(f) The strong pools are traps.** NA and EU end insolvent in 100 % of
careers on every difficulty, SAM in 43 / 86 / 71 % (C1b). In EU the founders
reach rep 7 by the end of season 1 with no sponsor: $16 a week of guaranteed
income against $658 of wages (C5).

**A measurement fix.** The harness's `ArcCareer.ended` gives 173 insolvencies
(59 %); the probe counts 187 (64 %). The other 14 careers went broke in seasons
6–7 after continuing past the timeline, and `endCareer` keeps the earlier
`end.reason` (`save.end.reason ?? reason`). The ending screen picks its splash
from that field, so such a career gets the Final Whistle (or the Worlds-won
ceremony) instead of the insolvency screen. That is a bug for 2b, left
unchanged here.

## 5. Mechanisms and levers — *proposed; rc.32 built them as provisional defaults*

> **rc.32 (Etapa 2b part 2, front A):** M1, M3, M4, M5, M6 (levers 1–2) and
> M8 are built as **provisional defaults** (30/10, not approved), each behind
> its own `balance.ts` key that restores rc.31 when flipped (R50–R53). M2 is
> front B's (decision 2-B); M7 is held (9-B); M6 lever 3 stays in reserve.

Every value is a candidate with a range; each package is re-measured on the
same seeds (§7). New keys go in the existing `CAREER_*` blocks; any new save
field is optional and additive (no persist bump; the contract test stays
frozen).

**M1. One season money index** (b). One `CAREER_ECONOMY.indexPerSeason`
replaces `CAREER_SALARY.inflationPerSeason` (1.08), `CAREER_PRIZES.growthPerSeason`
(1.12) and `CAREER_SPONSOR.growthPerSeason` (1.10). A single helper
(`moneyIndex(seasonIndex)` in `economy.ts`) applies it to every stream,
including today's flat ones: `passivePerRepPoint`, `CAREER_LOAN`,
`CAREER_BANK`, `CAREER_TRANSFER.minFee`, `CAREER_SUB.standInFee`,
`CAREER_SCOUT.reportCost`, `CAREER_GEAR` and the money in
`data/career/inserts.ts`. Signed contracts keep their figure.
- *Candidate:* **1.08** (range 1.06–1.10). *Effect:* at season 7, prizes are
  23 % and new sponsor deals 12 % below today; the fanbase is ×1.71 instead
  of flat. *Verify:* P1; C9 p50 flat; C1 after season 4.
- *Built (rc.32, provisional, R50):* `CAREER_ECONOMY.indexMode` "single" /
  `indexPerSeason` 1.08 ("rc31" restores the three rates).

**M2. Renewing players you already have** (d). In `renewPlayerFlow`: ask =
min(fresh ask, max(old wage × `renewalRaiseCap`, fresh ask ×
`renewalMarketFloor`)), with both as new `CAREER_SALARY` keys shown in the
readout. Ambition and the Blockbuster surcharge stay on top, and a declining
veteran renews at his lower fresh ask. The rule also spreads front A's
repricing of old reserve contracts (the 0.4 sub factor is gone) over
renewals.
- *Candidate:* cap **×1.5** (range 1.3–2.0), floor **0.5** (range 0.4–0.65).
- *Effect,* replayed on the sweep's 1,067 renewals: developed players ×2.97 →
  ×1.50 (p50), season-1 founders ×4.58 → ×2.29, a founder's new ask 2.70 →
  1.41× guaranteed income. (A 0.65 floor leaves the founders at ×2.98; a pure
  cap keeps a breakout star at a few percent of his value.)
- *Verify:* C6; youth against autopilot in C1.

**M3. The founding partner** (a, f). A day-one tier-0 deal: base per split =
`CAREER_SPONSOR.founding.payrollShare` × the founding wage bill (fixed at
creation, then indexed). Objective "enter events", no signing bonus. It runs
until the first real deal or the end of season 1, whichever is later. Sized
on the founders, it is a floor, not a growth engine, and it also covers front
A's ban on bids in the first window.
- *Candidate:* **0.7** (range 0.5–0.8). *Effect:* the Normal founders burn
  about $130 a week before prizes instead of $480 (P0).
- *Verify:* C1c, the newcomer rows of C1, C1b, C5.
- *Built (rc.32, provisional, R51):* `CAREER_SPONSOR.founding` (`enabled`,
  `payrollShare` 0.7, `throughSeasonIndex` 1).

**M4. The safety net** (a; ECO-02 on top of front A).
- *Warnings:* the inbox mail every Monday at ≤ 4 weeks of runway
  (`runwayWarnWeeks`) and once at a new `runwayNoticeWeeks` (**8**), each
  with the projected breach and a recovery checklist. A renewal or a signing
  shows the runway it leaves.
- *The Backer in weeks of payroll:* `CAREER_LOAN.floorWeeks` **8** (range
  4–10) and `rescueToWeeks` **6** (range 4–8) replace `floor`/`rescueTo`.
  While it is open, fees and runway-shortening commitments are blocked.
- *What ends a career:* `CAREER_LOAN.breachesToEnd` by difficulty (decision
  4). The breach before the last forces a **restructuring**: the highest-paid
  player is sold at market value (half the fee to the debt, as today), and
  rep −5.
- *Save and bank:* a breach counter is an optional save field
  (`finances.loanBreaches`, read from `loanUsed`); bank limits are indexed.
- *Effect:* season 0 keeps about today's net (−$4k / +$3k); a season-6 squad
  at $11k a week gets −$88k / +$66k.
- *Verify:* C1 (warned, lead, window, survival), C4, C1b.
- *Built (rc.32, provisional, R52):* `CAREER_PAYROLL.runwayWarnMode` /
  `runwayNoticeWeeks` 8; `CAREER_LOAN.sizing` "weeks" (`floorWeeks` 8,
  `rescueToWeeks` 6), `lockCommitments`, `breachesToEnd` (Easy never, Normal 3,
  Hard 2), `restructureRepLoss` 5.

**M5. The prize tables** (a, e; Gate-1 question 2). `swiss16Pct` **28 / 18 /
12 / 9 / 6.5 / 5 / 1.25** (1st … 9–16th: $11.2k … $500 at a season-0 regional)
and `single8Pct` **40 / 20 / 10 / 5**. Both sum to 100 % with round season-0
values. The qualifier's 10 % / 2.5 % and every pool stay unchanged, and the
lobby keeps showing the paid total (R44).
- *Effect:* a regional pays its $40k, the Community Cup its $2k, the title
  28 % instead of 30 %. *Verify:* P4, P4b.
- *Built (rc.32, provisional, R50):* `CAREER_PRIZES.tables` "contract"
  (rc.31's tables kept as `swiss16PctRc31` / `single8PctRc31`).

**M6. Stars and the snowball** (c, e; ECO-03a). Four levers for decision 5:
1. **A comfort cap.** `CAREER_SALARY.repComfortMax` **86**, so a star always
   carries a premium: a 90 at rep 100 pays ×1.16 and a 95 ×1.36 (P2b).
2. **A players' share of podium prizes.** `CAREER_PRIZES.playerShare`
   (regional **0.2**, Major **0.35**, Worlds **0.5**) on 1st–4th only, as its
   own ledger line. Newcomers' prizes are untouched, and a dominant season
   drops from $423k to $250–265k at season 0 (≈ 1.15–1.2× a three-85 squad,
   with or without M5).
3. **A title raise at renewal.** `CAREER_SALARY.titleRenewalPremium`: +10 % per
   Major or Worlds title won during the deal, capped at +30 % (the design's
   dormant "champion escalation").
4. **A wage budget.** Payroll ≤ guaranteed income + half the trailing prizes.
   The strongest lever, but a new system, for Etapa 3.

The yardstick for (c) is the T4-contender profile (P8), indexed; 2b builds no
AI money (decision 7). *Verify:* C7, C7b, C9 p90, P4b.
- *Built (rc.32, provisional, R53):* levers 1–2 — `CAREER_SALARY.repComfortMax`
  86 and `CAREER_PRIZES.playerShare` (regional 0.2, Major 0.35, Worlds 0.5);
  lever 3 in reserve, lever 4 for Etapa 3.

**M7. Guaranteed income** (a, b, e). Tier bases that bring payroll ÷
guaranteed to about 1.5 once M2 has lowered the payrolls. Today T1 holders
field a 77 squad on 4.4× their guaranteed income and T4 holders a 90 on 1.8×
(C3b). The fanbase is indexed and steeper (`passivePerRepPoint` 40 → **60**).
ECO-04 then redesigns the deals inside bands b3–b4 (proportional fines do not
exist today); ECO-05's appearance fees stay capped so they cannot hide a gap.
- *Candidate:* **$3–5k / $10–15k / $30–40k / $55–65k** a split at season 0
  for T1–T4 (today $1.5k / $6k / $18k / $45k). *Verify:* C3, C3b, P7.

**M8. Selling as a path** (d; ECO-03). Today bids arrive at random (5.5–18 %
a window day, two a window, at value × 1.0–1.35, P3). Proposed: "list for
sale", an AI offer within a few window days at value ×
`CAREER_TRANSFER.listingOfferRange` (**0.9–1.15**) from an org that can field
him. A seat sold in a window can be refilled with a free agent for a week
after it (one per split).
- *Verify:* C2c; the tuned and youth rows of C1.
- *Built (rc.32, provisional, R53):* `CAREER_TRANSFER.listingEnabled`,
  `listingOfferRange` 0.9–1.15, `listingOfferDays` 1–3, `lateSigningDays` 7.

## 6. Decisions for Miguel

> **Provisional defaults (30/10, Miguel: "I can't decide this yet").** Etapa
> 2b part 2 builds the recommended option of each decision below, as a
> **provisional default to be tested, not an approved rule**: 1-A, 2-B, 3-A,
> 4-B, 5-B, 6-B, 7-A, 8-B, 9-B, 10-A. Each one ships behind its own
> `balance.ts` key so it can be switched back, is re-measured with the probe
> on the same seeds (against §8), and is listed in the gate report for Miguel
> to play and confirm or reject. Nothing here is final until he says so.
>
> **Built in rc.32** (front A, R50–R53): 1-A, 3-A, 4-B, 5-B (levers 1–2), 6-B
> and 8-B, each behind its own key; 7-A, 9-B and 10-A need no code; 2-B is
> front B's.
>
> **The guardrail on every default (Miguel, 30/10): not too easy, not
> punitive.** Managing money stays part of the experience: a median career
> still meets tight weeks and real trade-offs, stars still cost a real
> sacrifice, and a careless spender can still go broke on Normal and Hard.
> What goes is the unfair break (a newcomer playing normally, or a team
> punished for developing its own players). Every re-measure reports both
> sides: insolvency inside §3's bands AND the "money still decides" rows
> (tight Mondays, snowball p90, star access) staying above their floors. A
> default that makes money irrelevant fails the gate as surely as one that
> bankrupts newcomers.

1. **The season money index (M1).** A. One index at 1.08 for every stream,
   the flat ones included. B. One index at 1.10. C. Keep the three rates and
   index only the flat amounts. *Recommendation: A* (no ratio drifts, and late
   prizes come down).
2. **Renewing your own players (M2).** A. A raise cap only (×1.5). B. The cap
   with a market floor (×1.5, never below 50 % of the fresh ask). C. A
   homegrown factor (0.7 × the fresh ask). *Recommendation: B.* On the
   sweep's renewals it takes developed players from ×2.97 to ×1.50 and the
   season-1 founders from ×4.58 to ×2.29. A keeps a breakout star far below
   his value; C leaves the founders at ×3.21.
3. **Newcomer income (M3).** A. A founding partner paying 70 % of the
   founding payroll until the first real deal (at least through season 1). B.
   Tier 1 open from day one with a higher base. C. A bigger start budget.
   *Recommendation: A.* B pays a squad of 65s the same as one of 75s and keeps
   the rep race as the trap; C only delays the burn.
4. **What ends a career through money (M4).** A. Today: the second breach, on
   every difficulty. B. By difficulty: Easy never (a restructuring at each
   breach after the first), Normal at the third (the second forces a
   restructuring), Hard at the second. C. Never; every later breach is a
   restructuring. *Recommendation: B* (the threat stays real on Hard).
5. **Stars and the snowball (M6).** A. The index and the comfort cap. B. A
   plus the players' share of podium prizes. C. B plus the title raise at
   renewal. *Recommendation: B,* keeping C in reserve in case C9's p90 stays
   above 2 seasons of payroll; the wage budget waits for Etapa 3.
6. **The prize tables (M5; Gate-1 question 2: the qualifier's 10 % / 2.5 %,
   the regional's $40.8k, the Community Cup's $1.8k).** A. Keep them. B. 100 %
   tables with round season-0 values (Swiss-16 28/18/12/9/6.5/5/1.25,
   single-elimination 40/20/10/5), the qualifier unchanged. C. B with a
   flatter top (the title at 25 %). *Recommendation: B:* the paid pool matches
   the advertised one, and M3/M6 do the heavier work.
7. **The "league's top budgets" anchor (M6).** A. The T4-contender profile as
   the yardstick only. B. Revive `walletByPrestige` as indexed AI budgets that
   bid for stars (Etapa 3). C. Delete `walletByPrestige` (no code reads it).
   *Recommendation: A now,* and B or C with Etapa 3's market work.
8. **Selling (M8).** A. Random bids only. B. "List for sale" plus a
   replacement signing after a late sale. C. B without the replacement.
   *Recommendation: B,* inside ECO-03.
9. **Guaranteed income (M7).** A. Approve bases inside the ranges, and the
   fanbase at $60 a rep point, now. B. Tune them after M1–M3 are measured
   (they move the same ratio). C. Leave sponsors to ECO-04. *Recommendation:
   B.*
10. **The bands of §3.** A. Approve them as written. B. Move some now.
    *Recommendation: A,* with one documented adjustment allowed after the first
    re-run, never a silent one.

## 7. Order of work once approved

0. **Re-baseline.** Fronts A and C land in rc.31 (no sub discount, the
   Backer/bank fix, no bids in the first window, retirement at 24–29, local
   sides with Major slots). Re-run the probe and `CAREER_ARC` on the merged
   build with the same seeds. That run is the "before" for everything below.
1. **E1, scale and tables** (M1, M5), with pure tests: one index for every
   stream over seasons 0–9, and every table summing to 100 %.
2. **E2, newcomers and renewals** (M3, M2), with a payroll projection on the
   renewal screen. Flow tests cover the cap and the floor, a reserve on the
   old 0.4 deal, and the partner giving way to the first real deal.
3. **E3, the safety net** (M4, on top of front A's ECO-02). Tests: a warning
   before every rescue; Normal survives a second breach; Hard ends at the
   second.
4. **E4, stars and snowball** (M6 as decided), then M7, then M8 inside ECO-03.
5. **After each package,** run the probe and `CAREER_ARC` on the same 294
   careers (`ECON_SEEDS=2`) and record the §3 bands before and after in the
   CHANGELOG. The golden master and the persist contract stay untouched. Once
   the bands hold, they become an opt-in regression assertion. DEV-01 moves
   overalls, hence asks, so re-run after it too.
6. **The gate.** On staging, two or three newcomers each play to the end of
   season 2 (one in EU on Normal), and Miguel plays to season 7. Ask: did a
   warning come before any rescue, with a clear way out? Did a renewal feel
   like a punishment? Was a star tempting and out of reach? Did money matter
   after a title? A newcomer's bankruptcy, or "money stopped mattering",
   sends the package back whatever the harness says.

## 8. After the merge — the rc.31 re-measure

Same probe, same 294 careers (seeds 9100 and 17019), on rc.31: fronts A and
C merged and the review fixes in. No money number moved; what moved is what
Miguel decided on 29/10 and the integrity fixes. The appendix stays the rc.30
"before" that §4 cites; regenerate the rc.31 tables with the appendix
command (the bot is deterministic; the run was split by `ECON_REGIONS` into
four processes and merged, ~14 minutes).

| | rc.30 | rc.31 |
|---|---|---|
| Insolvent, all careers | 64 % (187 of 294) | 68 % (201 of 294) |
| Easy / Normal / Hard (mean over the 7 policies) | 46 / 67 / 77 % | 44 / 76 / 85 % |
| Normal, insolvent by S3 (autopilot · tuned · youth) | 43 · 36 · 57 % | 43 · 29 · 43 % |
| Insolvencies the harness logged under another ending | 14 | 0 (R46) |
| Normal by region: SAM · MENA · OCE · APAC · SSA (EU, NA) | 86 · 64 · 43 · 43 · 36 % (100) | 93 · 100 · 50 · 43 · 50 % (100) |
| Renewal shock p50: developed founders · signed at ≤ 19 | ×2.95 · ×1.61 | ×2.90 · ×2.26 |
| Snowball p90 at S7, seasons of payroll: Easy · Normal | 1.6 · 1.0 | 3.3 · 2.0 |

How to read it:
- **The early failures are unchanged; the late ones grew.** By season 3 the
  rates hold, but more Normal and Hard careers break in seasons 4–7
  (Normal autopilot 64 → 86 %, tuned 43 → 64 %, coachChurn 43 → 64 %).
- **The likely drivers are rc.31's decided rules, not new bugs** (the
  mechanics point there; the probe does not isolate them one by one):
  players now retire at 24–29 (many left at 21–23 before), so founders and
  veterans stay on the payroll longer and renew at fresh asks; a reserve
  now costs a starter's wage; and no bid arrives in the first window.
- **So the contract's order holds, with M2 first.** The renewal rule (M2)
  and the money index (M1) target exactly the late break; the newcomer
  income (M3) still targets the early one; M4 decides what a break means.
- **The bands of §3 do not change.** The next re-run, after Miguel's
  decisions, is measured against these rc.31 numbers.

## 9. The rc.32 re-measure — the provisional defaults

Same probe, same 294 careers (seeds 9100 and 17019, 8 seasons) as §8, on
rc.32 (`d2e5445`): front A's M1, M3, M4, M5, M6 (levers 1–2), M8 and the age
clock, front B's DEV-01, M2 and BAL-02, the integration and the review's
fixes (R50–R60). Every move below comes from a **provisional default**
(§6's 30/10 note), not an approved rule; each flips back by its key. Full
tables: `ECONOMY-PROBE-rc32.md`, against rc.31's `ECONOMY-PROBE-rc31.md`
(regenerate with the appendix command; about 25 minutes in four processes
split by `ECON_REGIONS`). Easy / Normal / Hard unless noted.

| | rc.31 | rc.32 | band (§3) |
|---|---|---|---|
| Insolvent, all careers | 68 % (201 of 294) | **30 % (88 of 294)** | — |
| Insolvent, mean over the 7 policies (a1) | 44 / 77 / 85 % | **0 / 34 / 56 %** | ≤ 2 / 10 / 25 % |
| Newcomer policies insolvent (a2) | 48 / 81 / 86 % | **0 / 33 / 60 %** | 0 / ≤ 5 / ≤ 20 % |
| Newcomers' S0–S1 pay their way without a big win (a7) | 62 / 38 / 26 % | **86 / 86 / 69 %** | ≥ 80 / 60 / 40 % |
| Rescues warned in the 8 weeks before (a3) | 0–45 % | **100 %** | 100 % |
| Warning lead before the rescue, p50 (a4; rc.32: from the first warning) | 5–8 wk (the few warned) | 19–32 wk | ≥ 4 / 4 / 3 wk |
| Rescue window, p50 (a5) | 1–8 wk | 10–18 wk | ≥ 10 / 8 / 4 wk |
| Rescued careers that never end (a6) | 0–17 % | 100 / 28 / 20 % | ≥ 90 / 60 / 30 % |
| Careers restructured at least once (M4) | — | 29 / 41 / 0 % | — |
| Normal insolvent by S3: autopilot · tuned · youth | 43 · 29 · 43 % | 0 · 0 · 0 % | — |
| Renewal raise p50: developed founders · signed at ≤ 19 (d1) | ×2.90 · ×2.26 | ×1.58 · ×1.50 | ≤ ×1.6 |
| A founder's new ask ÷ guaranteed income, p50 (d1) | 1.63 | 0.64 | ≤ 1.5 |
| Normal by region: SAM · MENA · OCE · APAC · SSA (EU, NA) (f1) | 93 · 100 · 50 · 43 · 50 % (100, 100) | 21 · 21 · 21 · 0 · 0 % (86, 86) | ≤ 20 % |
| *Money still decides:* the spender insolvent (d2) | 57 / 93 / 100 % | 0 / 71 / 86 % | ≤ 2 × a1 |
| Season-rows with a tight Monday, S3–S5 (e3) | 20 / 49 / 52 % | 37 / 49 / 64 % | ≥ 10 / 20 / 30 % |
| Snowball p90, S2–S7 worst, in seasons of payroll (e1) | 4.4 / 2.0 / 1.8 | 10.4 / 4.2 / 2.1 | ≤ 3.0 / 2.0 / 1.5 |
| Careers with an 88+ signing by S4 (c3) | 17 / 3 / 0 % | 12 / 5 / 2 % | ≥ 20 / 15 / 10 % |
| A 90's wage ÷ the T4-contender income (c1) | 0.74 → 0.63 | 0.85 every season | ≥ 0.35 |
| A dominant season's kept prizes ÷ three-85 wages (e2) | 1.94 → 2.50 | 1.13 | ≤ 1.5 |
| Payroll ÷ guaranteed income, p50 by season, Normal (b3) | 2.1–7.4 | 2.4–9.5 | 1.0–2.0 |
| Every stream on one index (b1) | ×1.00–2.21 by S7 | ×1.71–1.73 | ±2 % |

(rc.31's C10 row values are rc.31's dump rendered by rc.32's probe: the
same records, the new table.)

How to read it:
- **The unfair break is more than halved, and Easy is solved.** No Easy
  career ends through money; a newcomer's first two seasons pay their way
  on every difficulty (a7 passes everywhere for the first time); every
  rescue now comes with a warning half a season ahead and buys two to four
  times the weeks. No Normal career breaks by season 3 any more. The
  founding partner (M3) and the safety net (M4) carry the start; the
  renewal rule (M2) and DEV-01's growth carry the late seasons (the youth
  path went from 71 % insolvent on Normal to 0 %).
- **Money still decides.** Tight Mondays held or grew, the spender still
  breaks on Normal (71 %) and Hard (86 %), a star still costs a real share
  of a top budget (c1), and a dominant season no longer pays twice its
  squad (e2).
- **What is still out of band, and why.**
  - EU and NA stay traps (86 % on Normal, as in rc.30 and rc.31): EU's
    reputation sits at 5 for two seasons (no sponsor before S4; guaranteed
    income $20 a week in S1), NA's at 12–19. Their pools out-rate a starter
    roster, so the early results that build reputation never come. This is
    the biggest single gap (f1), and it is about the path to reputation, not
    only money.
  - The snowball p90 rose (e1): more careers survive to the late seasons,
    and APAC and SSA careers run away (Normal reputation 68–74 by S1,
    balance $118–158k at S3, the Major slot by S2; DEV-01's world growth
    and the filler cap moved those regions, R59). The contract keeps M6's
    lever 3 (the title raise) for exactly this reading.
  - Payroll ÷ guaranteed income (b3) did not move: M7 was held (9-B, "tune
    after M1–M3 are measured"); they are now measured, so M7 is the next
    lever.
  - The star path (c3) stays rare outside Easy.
  - Normal and Hard insolvency (a1, a2) stays above the band, mostly EU and
    NA (24 of the 33 Normal insolvencies) and the spender.
- **So the next package, after Miguel plays rc.32:** M7 with the numbers it
  waited for; the EU/NA path to reputation (the early field or the rep the
  first results pay); M6 lever 3 if the snowball holds; APAC/SSA after the
  filler cap. Each re-measured on these seeds. Decision 10-A's one
  documented band adjustment is not used.

## Appendix — the probe tables (generated)

The probe's output for the baseline's 294 cells, as generated. The careers
take 35 minutes in one process (2,109 s on the shared 4-core machine); the
curves alone take seconds.

```bash
# the full run (curves + 294 careers), with a JSON dump of the records
CAREER_ECON=1 ECON_SEEDS=2 ECON_OUT=econ.json ECON_MD=econ.md npx vitest run src/store/careerEconomy.probe.test.ts
# re-render the Markdown from the dump, without replaying the careers
CAREER_ECON=1 ECON_SEEDS=2 ECON_IN=econ.json ECON_MD=econ.md npx vitest run src/store/careerEconomy.probe.test.ts
# the pure curves only (P0–P8)
CAREER_ECON=1 ECON_CURVES_ONLY=1 ECON_MD=curves.md npx vitest run src/store/careerEconomy.probe.test.ts
```

> Generated by `CAREER_ECON=1 ECON_SEEDS=2 ECON_MD=<file> npx vitest run src/store/careerEconomy.probe.test.ts` (src/store/careerEconomy.probe.test.ts). Regenerate, never hand-edit.

### Part 1 — the curves (pure engine functions)

#### P0. Day one — the founding payroll against the start budget (median of the 7 regions, seed 9100)

No sponsor until rep 12; the fanbase at rep 5 pays $19/wk. Runway = weeks of wages the start budget covers with no other income, then the Backer (floor −$5.0k, one rescue back to $3.0k). The founders' deals end after season 1.

| Difficulty · founding roster | wages / wk (season) | start budget | runway to $0 | … to the second breach (end) | S0 prizes / wk: out early · qualifier side |
|---|---|---|---|---|---|
| easy · balanced | $450 ($14.4k) | $20.0k | 45 wk | 75 wk | $131 · $309 |
| easy · prospects | $240 ($7.7k) | $20.0k | 87 wk | 143 wk | $131 · $309 |
| easy · journeymen | $730 ($23.4k) | $20.0k | 28 wk | 46 wk | $131 · $309 |
| normal · balanced | $500 ($16.0k) | $12.0k | 24 wk | 51 wk | $122 · $281 |
| normal · prospects | $260 ($8.3k) | $12.0k | 48 wk | 100 wk | $122 · $281 |
| normal · journeymen | $810 ($25.9k) | $12.0k | 15 wk | 31 wk | $122 · $281 |
| hard · balanced | $590 ($18.9k) | $8.0k | 14 wk | 36 wk | $98 · $239 |
| hard · prospects | $310 ($9.9k) | $8.0k | 27 wk | 70 wk | $98 · $239 |
| hard · journeymen | $940 ($30.1k) | $8.0k | 9 wk | 23 wk | $98 · $239 |

#### P1. The season index of each money stream (season 0 = ×1.00)

Read off the engine's own functions at normal difficulty. A flat row never grows, so it shrinks against the rest: by season 7 the Backer's $3k rescue and the $12k start budget are worth a fraction of a week of wages.

| Stream (engine source) | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| Wage asks, new deals (`computeSalaryAsk`, ×1.08) | ×1.00 | ×1.08 | ×1.17 | ×1.26 | ×1.37 | ×1.47 | ×1.59 | ×1.72 |
| Market value / fees (`marketValueFor`, ×1.08) | ×1.00 | ×1.08 | ×1.17 | ×1.26 | ×1.36 | ×1.47 | ×1.59 | ×1.72 |
| Coach asks (`coachSalaryFor`, ×1.08) | ×1.00 | ×1.08 | ×1.15 | ×1.25 | ×1.35 | ×1.46 | ×1.58 | ×1.71 |
| Prizes, every tier (`prizeFor`, ×1.12) | ×1.00 | ×1.12 | ×1.25 | ×1.40 | ×1.57 | ×1.76 | ×1.97 | ×2.21 |
| New sponsor deals (`sponsorOffersFor`, ×1.10) | ×1.00 | ×1.10 | ×1.21 | ×1.33 | ×1.46 | ×1.61 | ×1.77 | ×1.95 |
| Fanbase (rep × $40 a split) | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 |
| Start budget, Backer floor/rescue, bank limits, min fee, gear, scouting, stand-in, inserts | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 |
| Prizes ÷ asks | 1.00 | 1.03 | 1.07 | 1.11 | 1.15 | 1.19 | 1.24 | 1.29 |
| Sponsors ÷ asks | 1.00 | 1.02 | 1.03 | 1.05 | 1.07 | 1.09 | 1.11 | 1.13 |

#### P2. The wage ask by overall and season (per week · per season)

Prime age 20, potential = overall (no upside premium), rep 100 (no rep premium), normal, a 2-season deal, the median of the jitter. Each overall point is ×1.2 (`CAREER_SALARY.growthPerPoint`), so +5 points is ×2.49 and +10 is ×6.19.

| Overall | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| 70 | $145/wk · $4.7k | $155/wk · $5.0k | $169/wk · $5.4k | $183/wk · $5.8k | $197/wk · $6.3k | $216/wk · $6.9k | $230/wk · $7.3k | $248/wk · $8.0k |
| 75 | $366/wk · $11.7k | $394/wk · $12.6k | $427/wk · $13.7k | $459/wk · $14.7k | $497/wk · $15.9k | $539/wk · $17.3k | $581/wk · $18.6k | $628/wk · $20.1k |
| 80 | $909/wk · $29.1k | $984/wk · $31.5k | $1.1k/wk · $34.0k | $1.1k/wk · $36.8k | $1.2k/wk · $39.8k | $1.3k/wk · $42.9k | $1.4k/wk · $46.4k | $1.6k/wk · $50.0k |
| 85 | $2.3k/wk · $72.6k | $2.5k/wk · $78.5k | $2.6k/wk · $84.8k | $2.9k/wk · $91.5k | $3.1k/wk · $98.8k | $3.3k/wk · $106.8k | $3.6k/wk · $115.3k | $3.9k/wk · $124.5k |
| 90 | $5.7k/wk · $180.9k | $6.1k/wk · $195.3k | $6.6k/wk · $210.9k | $7.1k/wk · $227.8k | $7.7k/wk · $246.2k | $8.3k/wk · $265.8k | $9.0k/wk · $287.1k | $9.7k/wk · $310.1k |
| 95 | $14.1k/wk · $450.1k | $15.2k/wk · $486.1k | $16.4k/wk · $525.0k | $17.7k/wk · $567.0k | $19.1k/wk · $612.5k | $20.7k/wk · $661.5k | $22.3k/wk · $714.3k | $24.1k/wk · $771.5k |

#### P2b. The rep premium (× the ask at rep 100) and the signing cap, season 0

| Overall | rep 5 | rep 12 | rep 25 | rep 50 | rep 75 | rep 90 |
|---|---|---|---|---|---|---|
| 75 | ×1.45 | ×1.35 | ×1.17 | ×1.00 | ×1.00 | ×1.00 |
| 80 | ×1.65 | ×1.56 | ×1.37 | ×1.02 | ×1.00 | ×1.00 |
| 85 | ×1.85 | ×1.75 | ×1.57 | ×1.22 | ×1.00 | ×1.00 |
| 90 | ×2.00 | ×1.95 | ×1.77 | ×1.42 | ×1.07 | ×1.00 |
| 95 | ×2.00 | ×2.00 | ×1.97 | ×1.62 | ×1.27 | ×1.06 |
| Signable cap (new signings) | 75 | 77 | 81 | 89 | 96 | 99 |

#### P3. What a signing costs up front (age 20, potential = overall)

Market value = the rep-neutral ask × 3.2 (`CAREER_TRANSFER.valueMultiple`). A free agent costs no fee, only the signing bonus (15 % of a season's wage); a contracted player costs value × (0.7 + 0.15 × splits left). AI bids for the user's players pay value × 1.0–1.35.

| Overall | S0 value | S0 FA bonus | S0 fee (1–6 splits left) | S3 value | S7 value | S7 fee (1–6 splits left) |
|---|---|---|---|---|---|---|
| 75 | $13.1k | $1.8k | $11.1k–$20.9k | $16.6k | $22.5k | $19.1k–$36.0k |
| 80 | $32.6k | $4.3k | $27.8k–$52.2k | $41.1k | $56.0k | $47.6k–$89.5k |
| 85 | $81.3k | $10.8k | $69.1k–$130.1k | $102.5k | $139.4k | $118.5k–$223.0k |
| 90 | $202.4k | $27.1k | $172.0k–$323.8k | $254.9k | $346.9k | $294.9k–$555.0k |
| 95 | $503.6k | $67.5k | $428.1k–$805.8k | $634.5k | $863.2k | $733.7k–$1.38M |

#### P4. Prize tables by tier (normal; easy ×1.15, hard ×0.9)

| Event | advertised pool | table sums to | paid S0 | paid S3 | paid S7 | S0: 1st · 2nd · 3rd · 4th · 5–6 · 7–8 · 9–16 (qualifier: advance · out) |
|---|---|---|---|---|---|---|
| Community Cup (t3) | $2.0k | 100% | $1.8k | $2.7k | $4.2k | $800 · $400 · $200 · $200 · $50 · $50 · $0 |
| Invitational (t2) | $10.0k | 100% | $10.0k | $13.8k | $21.9k | $4.0k · $2.2k · $1.1k · $1.1k · $400 · $400 · $0 |
| Regional qualifier | $6.0k | 100% | $6.0k | $8.0k | $12.8k | $600 · $150 |
| Regional | $40.0k | 102% | $40.8k | $57.0k | $89.6k | $12.0k · $8.0k · $5.2k · $4.0k · $2.6k · $1.6k · $400 |
| Major | $150.0k | 102% | $153.0k | $214.6k | $338.0k | $45.0k · $30.0k · $19.5k · $15.0k · $9.8k · $6.0k · $1.5k |
| Worlds | $600.0k | 102% | $612.0k | $859.3k | $1.35M | $180.0k · $120.0k · $78.0k · $60.0k · $39.0k · $24.0k · $6.0k |

#### P4b. A season's prize money by results profile vs. a squad's season wages (normal)

A season = 9 regional weeks (Saturday qualifier → Sunday regional), 3 Majors, Worlds. Profiles: **out early** (fails 6 of 9 qualifiers, exits 3 regional Swiss stages); **qualifier side** (advances every qualifier, exits every regional Swiss stage); **direct top-8** (9 × regional 7–8th); **contender** (9 × regional 3rd, 3 Majors 5–6th, Worlds 7–8th); **dominant** (9 regional titles, 3 Majors, Worlds). The squad rows are three starters at the P2 ask.

| Season money | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| Prizes — out early | $3.9k | $4.0k | $4.7k | $5.3k | $5.7k | $6.8k | $7.2k | $8.3k |
| Prizes — qualifier side | $9.0k | $9.4k | $11.3k | $12.2k | $13.5k | $15.8k | $17.1k | $19.4k |
| Prizes — direct top-8 | $14.4k | $15.8k | $18.0k | $19.8k | $22.5k | $25.2k | $28.4k | $31.5k |
| Prizes — contender | $100.0k | $111.8k | $125.2k | $140.3k | $157.0k | $176.1k | $197.2k | $220.8k |
| Prizes — dominant | $423.0k | $473.4k | $530.4k | $594.1k | $665.3k | $745.0k | $834.5k | $934.8k |
| Wages — 3 × 75 | $35.1k | $37.8k | $41.0k | $44.1k | $47.7k | $51.8k | $55.8k | $60.3k |
| Wages — 3 × 80 | $87.3k | $94.5k | $102.2k | $110.3k | $119.3k | $128.7k | $139.1k | $149.8k |
| Wages — 3 × 85 | $217.8k | $235.3k | $254.3k | $274.5k | $296.6k | $320.4k | $346.1k | $373.5k |
| Wages — 3 × 90 | $542.7k | $585.9k | $632.7k | $683.5k | $738.5k | $797.4k | $861.3k | $930.1k |

#### P5. Guaranteed income: sponsor offers by reputation, and the fanbase (normal)

First offer at rep 12 (`firstOfferRepGate`); deals last one season, pay 1× base on signing and a bonus per split when the objective is hit. Fanbase = rep × $40 a split, never indexed. Cells: base per week · per season (bonus per split).

| Reputation (best tier) | S0 | S1 | S3 | S5 | S7 | fanbase per week · season |
|---|---|---|---|---|---|---|
| 5 (no offer yet) | – | – | – | – | – | $19/wk · $600 |
| 12 (T1) | $141/wk · $4.5k (+$750) | $155/wk · $5.0k (+$800) | $183/wk · $5.8k (+$950) | $225/wk · $7.2k (+$1.2k) | $272/wk · $8.7k (+$1.4k) | $45/wk · $1.4k |
| 25 (T2) | $563/wk · $18.0k (+$3.0k) | $619/wk · $19.8k (+$3.3k) | $745/wk · $23.9k (+$4.0k) | $905/wk · $28.9k (+$4.8k) | $1.1k/wk · $35.0k (+$5.8k) | $94/wk · $3.0k |
| 50 (T3) | $1.7k/wk · $54.0k (+$9.0k) | $1.9k/wk · $59.4k (+$9.9k) | $2.2k/wk · $71.8k (+$11.9k) | $2.7k/wk · $86.8k (+$14.4k) | $3.3k/wk · $105.2k (+$17.5k) | $188/wk · $6.0k |
| 75 (T4) | $4.2k/wk · $135.0k (+$25.0k) | $4.6k/wk · $148.5k (+$27.5k) | $5.6k/wk · $179.6k (+$33.3k) | $6.8k/wk · $217.3k (+$40.3k) | $8.2k/wk · $262.9k (+$48.7k) | $281/wk · $9.0k |
| 90 (T4) | $4.2k/wk · $135.0k (+$25.0k) | $4.6k/wk · $148.5k (+$27.5k) | $5.6k/wk · $179.6k (+$33.3k) | $6.8k/wk · $217.3k (+$40.3k) | $8.2k/wk · $262.9k (+$48.7k) | $338/wk · $10.8k |

#### P6. The renewal jump: a founder's fresh ask at the season-1 renewal ÷ his founding wage

Founders sign at season 0 at rep 5 (`CAREER_REP.start`) on deals that end after season 1; the renewal is a fresh ask one season of inflation later at the current overall, age and rep (here rep 20, a modest first year; at rep 50 the premium is gone). Founding overall 73, potential 82, normal. The jump compounds the overall (×1.2 a point), inflation (×1.08), the age band (×0.9 under 19 → ×1.1 at 19–22) and the rep premium, less the shrinking upside premium.

| Overall gained by the renewal | age 16 → 17 | 17 → 18 | 18 → 19 | 21 → 22 | 18 → 19 at rep 5 | 18 → 19 at rep 50 |
|---|---|---|---|---|---|---|
| +0 (73 → 73) | ×0.92 | ×0.92 | ×1.13 | ×0.92 | ×1.32 | ×0.97 |
| +2 (73 → 75) | ×1.37 | ×1.37 | ×1.68 | ×1.37 | ×1.96 | ×1.35 |
| +4 (73 → 77) | ×2.03 | ×2.03 | ×2.48 | ×2.02 | ×2.87 | ×1.87 |
| +6 (73 → 79) | ×2.99 | ×2.99 | ×3.66 | ×2.99 | ×4.21 | ×2.61 |
| +8 (73 → 81) | ×4.38 | ×4.38 | ×5.37 | ×4.38 | ×6.13 | ×3.83 |

#### P7. What the guaranteed income carries: the best three-starter squad its base pays for (normal)

Guaranteed = the best sponsor base at that rep + the fanbase, per split. The squad overall is the highest even trio whose three P2 asks (at that rep's premium) fit inside it. A dash: not even three 60s.

| Reputation | S0 | S1 | S3 | S5 | S7 |
|---|---|---|---|---|---|
| 5 | – ($19/wk) | – ($19/wk) | – ($19/wk) | – ($19/wk) | – ($19/wk) |
| 12 | 65 ($186/wk) | 65 ($200/wk) | 65 ($228/wk) | 65 ($270/wk) | 65 ($317/wk) |
| 25 | 71 ($656/wk) | 71 ($713/wk) | 72 ($839/wk) | 72 ($998/wk) | 72 ($1.2k/wk) |
| 50 | 77 ($1.9k/wk) | 77 ($2.0k/wk) | 78 ($2.4k/wk) | 78 ($2.9k/wk) | 78 ($3.5k/wk) |
| 75 | 82 ($4.5k/wk) | 82 ($4.9k/wk) | 82 ($5.9k/wk) | 83 ($7.1k/wk) | 83 ($8.5k/wk) |
| 90 | 82 ($4.6k/wk) | 82 ($5.0k/wk) | 82 ($5.9k/wk) | 83 ($7.1k/wk) | 83 ($8.6k/wk) |

#### P8. Candidate anchors for "the league's top budgets" vs. a 90 star (normal, per season)

AI orgs hold no money: `CAREER_WORLD.walletByPrestige` is declared but read by no code, so the engine has no league budget today. The rows are the candidates the contract weighs. The best AI rosters' wage bill (measured, not pure) is in table C7.

| Per season | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| `walletByPrestige` [3] (unused, flat) | $2.50M | $2.50M | $2.50M | $2.50M | $2.50M | $2.50M | $2.50M | $2.50M |
| Top sponsor (T4) base + bonus, every split hit | $210.0k | $231.0k | $254.1k | $279.3k | $307.4k | $338.1k | $371.9k | $409.1k |
| Contender profile: T4 base + fanbase (rep 80) + contender prizes | $244.7k | $269.9k | $298.1k | $329.5k | $364.1k | $403.0k | $445.9k | $493.3k |
| One 90 star's wage | $180.9k | $195.3k | $210.9k | $227.8k | $246.2k | $265.8k | $287.1k | $310.1k |
| Star ÷ contender income | 0.74 | 0.72 | 0.71 | 0.69 | 0.68 | 0.66 | 0.64 | 0.63 |

### Part 2 — careers through the real flow (the long-career bot)

Careers: 294 (7 regions × 3 difficulties × 7 policies × 2 seeds: 9100, 17019) · 8 seasons each, stopping early on insolvency. Money is in-game USD; "per week" = the season's total ÷ 32 (the payroll's own unit); "per split" = a contract's unit (a season is 3 splits).

#### C1. Outcomes and the safety net — by difficulty × policy

Rescued = the Emergency Backer granted (one per career). Warned = a cash-warning mail in the 8 weeks before the rescue; lead = weeks from that mail to the rescue. Rescue window = the weeks of the burn on the rescue Monday that the Backer's swing (floor → rescue) buys. Rescue → end = weeks from the Backer to insolvency. Tight Mondays = runway ≤ 4 weeks or the balance below $0.

| Difficulty · policy | n | insolvent | insolvent by S3 | rescued | rescued that survive | warned in the 8 weeks before the rescue | warning lead p50 | rescue window p50 | rescue → end p50 | bank loans / career | tight Mondays p50 (per season) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| easy · autopilot | 14 | 71% | 36% | 79% | 9% | 45% | 7 wk | 1 wk | 6 wk | 0.0 | 0 |
| easy · tuned | 14 | 29% | 14% | 29% | 0% | 25% | 7 wk | 9 wk | 102 wk | 0.0 | 0 |
| easy · youth | 14 | 43% | 29% | 43% | 0% | 33% | 8 wk | 1 wk | 17 wk | 0.0 | 0 |
| easy · spender | 14 | 50% | 43% | 50% | 0% | 43% | 6 wk | 5 wk | 6 wk | 0.7 | 0 |
| easy · badSponsor | 14 | 64% | 36% | 64% | 0% | 22% | 8 wk | 4 wk | 6 wk | 0.0 | 0 |
| easy · losingStart | 14 | 36% | 29% | 36% | 0% | 60% | 8 wk | 4 wk | 6 wk | 0.0 | 0 |
| easy · coachChurn | 14 | 29% | 14% | 36% | 20% | 40% | 7 wk | 8 wk | 102 wk | 0.0 | 0 |
| normal · autopilot | 14 | 64% | 43% | 71% | 10% | 20% | 8 wk | 3 wk | 5 wk | 0.0 | 0 |
| normal · tuned | 14 | 43% | 36% | 57% | 25% | 50% | 7 wk | 5 wk | 5 wk | 0.0 | 0 |
| normal · youth | 14 | 71% | 57% | 71% | 0% | 30% | 8 wk | 2 wk | 3 wk | 0.0 | 0 |
| normal · spender | 14 | 86% | 79% | 86% | 0% | 8% | 6 wk | 6 wk | 12 wk | 1.1 | 8 |
| normal · badSponsor | 14 | 100% | 79% | 100% | 0% | 7% | 7 wk | 6 wk | 7 wk | 0.0 | 3 |
| normal · losingStart | 14 | 64% | 43% | 64% | 0% | 22% | 8 wk | 4 wk | 5 wk | 0.0 | 0 |
| normal · coachChurn | 14 | 43% | 36% | 57% | 25% | 50% | 8 wk | 5 wk | 13 wk | 0.0 | 0 |
| hard · autopilot | 14 | 86% | 57% | 93% | 8% | 8% | 8 wk | 11 wk | 20 wk | 0.0 | 7 |
| hard · tuned | 14 | 64% | 43% | 86% | 25% | 33% | 8 wk | 5 wk | 26 wk | 0.0 | 3 |
| hard · youth | 14 | 64% | 43% | 86% | 25% | 17% | 8 wk | 1 wk | 24 wk | 0.0 | 2 |
| hard · spender | 14 | 93% | 93% | 93% | 0% | 8% | 6 wk | 6 wk | 13 wk | 1.4 | 15 |
| hard · badSponsor | 14 | 100% | 100% | 100% | 0% | 0% | – | 11 wk | 17 wk | 0.0 | 16 |
| hard · losingStart | 14 | 64% | 57% | 64% | 0% | 0% | – | 3 wk | 4 wk | 0.0 | 0 |
| hard · coachChurn | 14 | 71% | 43% | 71% | 0% | 30% | 8 wk | 7 wk | 40 wk | 0.0 | 3 |

Insolvent careers the harness's `ArcCareer.ended` reports under another reason (an insolvency in the infinite era keeps the earlier `timeline_complete` / `worlds_won`): 14 of 187 (SAM hard coachChurn S6, MENA easy autopilot S7, MENA easy autopilot S6, MENA easy spender S6, MENA easy badSponsor S7, MENA easy badSponsor S7, OCE easy autopilot S7, APAC easy autopilot S6, APAC easy badSponsor S7, APAC normal autopilot S6, APAC normal autopilot S6, APAC normal spender S6, APAC normal badSponsor S7, APAC hard autopilot S6).

#### C1b. Insolvent (rescued) by region × difficulty — every policy

| Region | easy | normal | hard |
|---|---|---|---|
| NA | 100% (100%) | 100% (100%) | 100% (100%) |
| EU | 100% (100%) | 100% (100%) | 100% (100%) |
| SAM | 43% (43%) | 86% (86%) | 71% (93%) |
| MENA | 50% (57%) | 64% (71%) | 86% (93%) |
| OCE | 7% (7%) | 43% (71%) | 79% (86%) |
| APAC | 21% (21%) | 43% (43%) | 50% (50%) |
| SSA | 0% (7%) | 36% (36%) | 57% (71%) |

#### C1c. Does a first career pay its way? Seasons 0–1, by difficulty × policy

Net = earned − spent over the first two seasons. "Without a big win" leaves out Major and Worlds prizes and regional titles (a first-season title is the unlikely win the ROADMAP rules out).

| Difficulty · policy | n | net S0–S1 ≥ 0 | … without a big win | net S0–S1 p10 / p50 / p90 | big-win share of S0–S1 earned p50 | alive at the end of S1 |
|---|---|---|---|---|---|---|
| easy · autopilot | 14 | 64% | 64% | −$25.1k / $16.9k / $72.6k | 0% | 100% |
| easy · tuned | 14 | 64% | 43% | −$9.6k / $7.8k / $32.5k | 0% | 100% |
| easy · youth | 14 | 93% | 71% | $8.9k / $34.8k / $104.1k | 0% | 100% |
| easy · spender | 14 | 14% | 7% | −$40.9k / −$12.1k / $16.7k | 0% | 71% |
| easy · badSponsor | 14 | 64% | 64% | −$25.1k / $16.9k / $42.0k | 0% | 100% |
| easy · losingStart | 14 | 71% | 71% | −$16.6k / $20.1k / $46.0k | 0% | 100% |
| easy · coachChurn | 14 | 64% | 43% | −$9.6k / $7.8k / $32.5k | 0% | 100% |
| normal · autopilot | 14 | 36% | 36% | −$27.3k / −$5.6k / $8.2k | 0% | 71% |
| normal · tuned | 14 | 93% | 86% | $600 / $9.3k / $41.0k | 0% | 93% |
| normal · youth | 14 | 79% | 79% | −$27.4k / $23.0k / $58.5k | 0% | 86% |
| normal · spender | 14 | 7% | 0% | −$32.7k / −$31.2k / −$7.1k | 0% | 43% |
| normal · badSponsor | 14 | 36% | 36% | −$27.3k / −$5.6k / $8.2k | 0% | 71% |
| normal · losingStart | 14 | 50% | 50% | −$23.1k / $1.3k / $17.3k | 0% | 100% |
| normal · coachChurn | 14 | 93% | 86% | $600 / $9.3k / $41.0k | 0% | 93% |
| hard · autopilot | 14 | 14% | 14% | −$22.2k / −$14.1k / $40 | 0% | 50% |
| hard · tuned | 14 | 93% | 86% | $9.2k / $15.5k / $54.6k | 0% | 100% |
| hard · youth | 14 | 86% | 71% | −$21.8k / $31.8k / $53.7k | 1% | 86% |
| hard · spender | 14 | 7% | 0% | −$35.6k / −$28.1k / −$25.9k | 0% | 36% |
| hard · badSponsor | 14 | 14% | 14% | −$22.2k / −$14.1k / $40 | 0% | 50% |
| hard · losingStart | 14 | 43% | 43% | −$24.4k / −$1.7k / $34.2k | 0% | 71% |
| hard · coachChurn | 14 | 93% | 86% | $9.2k / $15.5k / $54.6k | 0% | 100% |

#### C2. The week's money by source and season — normal, every policy (mean per week over the careers alive that season)

| Per week | S0 (n 98) | S1 (n 94) | S2 (n 77) | S3 (n 58) | S4 (n 46) | S5 (n 37) | S6 (n 36) | S7 (n 33) |
|---|---|---|---|---|---|---|---|---|
| in · prizes — t3 cups | $63 | $70 | $79 | $66 | $49 | $109 | $72 | $79 |
| in · prizes — t2 invitationals | $0 | $59 | $148 | $384 | $665 | $578 | $728 | $1.1k |
| in · prizes — qualifiers | $102 | $59 | $39 | $12 | $22 | $27 | $34 | $34 |
| in · prizes — regionals | $127 | $402 | $793 | $1.4k | $2.0k | $2.2k | $2.5k | $3.4k |
| in · prizes — Majors | $0 | $4 | $14 | $43 | $110 | $86 | $123 | $210 |
| in · prizes — Worlds | $0 | $4 | $18 | $54 | $89 | $174 | $113 | $370 |
| in · sponsor base | $39 | $183 | $557 | $1.2k | $2.1k | $2.7k | $2.9k | $3.7k |
| in · sponsor bonus | $19 | $90 | $185 | $253 | $274 | $284 | $355 | $403 |
| in · sponsor signing | $35 | $67 | $202 | $418 | $754 | $921 | $1.0k | $1.3k |
| in · fanbase | $35 | $83 | $127 | $182 | $230 | $272 | $276 | $296 |
| in · fees received (sales) | $101 | $343 | $495 | $609 | $729 | $476 | $973 | $1.1k |
| in · inserts | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| **in · earned, total** | $522 | $1.4k | $2.7k | $4.6k | $7.1k | $7.8k | $9.1k | $12.1k |
| in · loans (Backer grant, bank) | $46 | $72 | $87 | $56 | $70 | $0 | $57 | $8 |
| out · wages | $563 | $1000 | $2.1k | $3.4k | $5.6k | $6.3k | $7.3k | $8.5k |
| out · coach | $0 | $44 | $97 | $100 | $127 | $234 | $225 | $369 |
| out · fees paid | $0 | $0 | $134 | $174 | $1.1k | $284 | $1.4k | $1.8k |
| out · signing bonuses | $39 | $66 | $195 | $117 | $94 | $54 | $101 | $92 |
| out · severance / release | $27 | $26 | $154 | $139 | $238 | $111 | $283 | $279 |
| out · stand-in | $47 | $21 | $75 | $50 | $26 | $14 | $57 | $31 |
| out · gear, upkeep, psychologist | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| out · debt service (garnish, Backer, bank) | $15 | $27 | $34 | $27 | $18 | $0 | $25 | $3 |
| out · inserts | $0 | $0 | $0 | $0 | $0 | $0 | $0 | $0 |
| **out · total** | $692 | $1.2k | $2.8k | $4.0k | $7.1k | $7.0k | $9.4k | $11.0k |
| **net (earned − out)** | −$170 | $182 | −$163 | $620 | −$91 | $835 | −$252 | $1.0k |

#### C2b. Earned income, wages and net per week by season — p50 by difficulty

| Difficulty · per week | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| easy · earned | $663 | $1.8k | $3.1k | $6.3k | $9.7k | $15.4k | $16.0k | $20.9k |
| easy · wages + coach | $552 | $975 | $2.0k | $4.1k | $7.2k | $8.3k | $9.5k | $12.7k |
| easy · net | −$44 | $485 | $428 | $1.5k | $955 | $1.7k | $920 | $2.1k |
| normal · earned | $445 | $995 | $2.3k | $3.3k | $5.1k | $5.9k | $6.5k | $9.9k |
| normal · wages + coach | $610 | $919 | $1.7k | $2.7k | $5.2k | $5.0k | $5.7k | $7.1k |
| normal · net | −$123 | $142 | −$177 | $302 | −$186 | $438 | −$532 | $390 |
| hard · earned | $437 | $1.0k | $2.5k | $5.2k | $8.4k | $12.6k | $13.1k | $16.1k |
| hard · wages + coach | $572 | $875 | $2.1k | $3.5k | $6.2k | $9.4k | $9.1k | $10.2k |
| hard · net | −$162 | $74 | −$230 | $234 | −$728 | $533 | $1.4k | $450 |

#### C2c. The transfer market as a path — per career over its seasons, by policy (every difficulty)

| Policy | careers | fees received p50 · p90 | fees paid p50 · p90 | signing bonuses p50 | severance p50 | stand-in fees p50 | signings / career | insolvent |
|---|---|---|---|---|---|---|---|---|
| autopilot | 42 | $0 · $0 | $0 · $227.5k | $0 | $0 | $4.0k | 0.6 | 74% |
| tuned | 42 | $131.0k · $505.6k | $127.3k · $961.1k | $30.9k | $15.6k | $11.0k | 9.1 | 45% |
| youth | 42 | $84.1k · $882.0k | $0 · $792.4k | $11.3k | $63.8k | $7.0k | 7.5 | 60% |
| spender | 42 | $0 · $0 | $0 · $642.6k | $3.5k | $3.8k | $3.0k | 3.7 | 76% |
| badSponsor | 42 | $0 · $0 | $0 · $144.6k | $0 | $0 | $2.0k | 0.3 | 88% |
| losingStart | 42 | $0 · $0 | $0 · $0 | $0 | $0 | $4.0k | 0.0 | 55% |
| coachChurn | 42 | $131.0k · $464.8k | $140.0k · $796.0k | $33.1k | $22.9k | $10.0k | 9.0 | 48% |

#### C3. Payroll ÷ guaranteed income, and the prize share — p10 / p50 / p90 by season

Payroll = wages + coach paid that season; guaranteed = sponsor base + fanbase received. A season with no guaranteed income is left out of the ratio (it is infinite) and counted in its own row.

| Difficulty | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| easy · payroll ÷ guaranteed | 3.1 / 6.2 / 22.6 | 1.7 / 3.3 / 21.6 | 1.5 / 3.0 / 39.0 | 0.9 / 1.8 / 5.7 | 1.4 / 2.9 / 6.0 | 0.9 / 1.9 / 4.4 | 1.5 / 3.3 / 5.6 | 1.4 / 2.3 / 4.2 |
| easy · no sponsor all season | 16% | 13% | 11% | 5% | 3% | 0% | 0% | 0% |
| easy · prize share of earned | 61% / 72% / 89% | 14% / 62% / 79% | 20% / 53% / 77% | 20% / 46% / 70% | 30% / 50% / 63% | 28% / 43% / 64% | 33% / 53% / 66% | 27% / 53% / 66% |
| normal · payroll ÷ guaranteed | 3.9 / 7.2 / 43.0 | 2.4 / 4.0 / 29.3 | 1.9 / 4.3 / 13.1 | 1.8 / 3.0 / 6.4 | 1.3 / 3.3 / 9.0 | 1.3 / 2.4 / 4.1 | 1.3 / 3.0 / 5.2 | 1.4 / 2.2 / 3.7 |
| normal · no sponsor all season | 24% | 14% | 8% | 7% | 0% | 3% | 0% | 0% |
| normal · prize share of earned | 57% / 70% / 89% | 10% / 50% / 81% | 8% / 41% / 66% | 19% / 48% / 63% | 21% / 41% / 59% | 21% / 36% / 55% | 20% / 36% / 58% | 21% / 43% / 61% |
| hard · payroll ÷ guaranteed | 4.3 / 8.1 / 41.1 | 3.2 / 4.9 / 38.5 | 1.9 / 4.4 / 13.1 | 1.6 / 4.0 / 12.5 | 1.8 / 3.0 / 4.8 | 1.4 / 2.9 / 4.8 | 1.1 / 2.8 / 4.4 | 1.4 / 2.8 / 6.7 |
| hard · no sponsor all season | 29% | 19% | 7% | 6% | 0% | 4% | 0% | 0% |
| hard · prize share of earned | 42% / 70% / 84% | 6% / 50% / 81% | 8% / 40% / 65% | 9% / 32% / 62% | 21% / 39% / 57% | 11% / 33% / 47% | 11% / 34% / 58% | 22% / 43% / 54% |

#### C3b. Payroll against the sponsor base, by the sponsor tier held at season end (every difficulty)

Per split, at the season's end. Tier 0 = no deal. Guaranteed = the deal's base + the fanbase.

| Sponsor tier | season-rows | rep p50 | team rating p50 | wages + coach / split p50 | guaranteed / split p50 | payroll ÷ guaranteed p10 / p50 / p90 |
|---|---|---|---|---|---|---|
| none | 147 | 7 | 76.4 | $9.8k | $280 | 8.1 / 29.8 / 75.1 |
| T1 | 502 | 25 | 77.3 | $13.3k | $2.7k | 1.8 / 4.4 / 9.5 |
| T2 | 409 | 54 | 82.3 | $35.2k | $10.3k | 1.6 / 3.2 / 6.9 |
| T3 | 277 | 84 | 86.5 | $82.1k | $33.0k | 1.3 / 2.5 / 4.6 |
| T4 | 181 | 100 | 90.3 | $141.4k | $79.8k | 1.1 / 1.8 / 3.4 |

#### C4. Balance and debt at season end — p10 / p50 / p90 by difficulty

| Difficulty | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| easy · balance | $2.1k / $18.6k / $30.7k | $3.0k / $36.5k / $78.0k | −$6.4k / $45.6k / $139.3k | $14.7k / $118.6k / $284.9k | $10.4k / $158.2k / $416.2k | $47.6k / $235.7k / $674.0k | $17.7k / $271.1k / $782.2k | $52.7k / $355.7k / $1.03M |
| easy · low point | −$3.0k / $12.9k / $19.2k | −$3.6k / $12.9k / $28.0k | −$6.4k / $18.6k / $58.6k | $4.1k / $43.2k / $133.4k | $490 / $65.4k / $243.0k | $26.9k / $89.1k / $377.1k | $15.7k / $87.9k / $375.2k | $3.0k / $81.0k / $446.3k |
| easy · debt owed (Backer + bank) | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $10.5k | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 |
| easy · alive · rescued · ended | 98 · 8 · 3 | 95 · 8 · 1 | 94 · 15 · 20 | 74 · 3 · 4 | 70 · 1 · 7 | 63 · 2 · 2 | 61 · 5 · 3 | 58 · 5 · 5 |
| normal · balance | −$740 / $8.1k / $15.9k | −$5.2k / $15.1k / $48.1k | −$5.7k / $12.7k / $57.1k | −$5.6k / $47.6k / $106.3k | −$6.3k / $45.9k / $154.8k | $9.5k / $75.8k / $220.0k | $21.2k / $84.8k / $260.3k | $8.2k / $139.9k / $260.4k |
| normal · low point | −$4.0k / $4.7k / $9.9k | −$5.2k / $2.9k / $13.3k | −$5.7k / $5.0k / $24.6k | −$5.6k / $11.6k / $52.3k | −$6.3k / $22.4k / $63.0k | $5.0k / $41.9k / $110.6k | $3.0k / $36.1k / $206.8k | $5.9k / $50.4k / $189.3k |
| normal · debt owed (Backer + bank) | $0 / $0 / $9.7k | $0 / $0 / $10.4k | $0 / $0 / $12.0k | $0 / $0 / $9.7k | $0 / $0 / $11.8k | $0 / $0 / $0 | $0 / $0 / $2.9k | $0 / $0 / $0 |
| normal · alive · rescued · ended | 98 · 11 · 4 | 94 · 21 · 17 | 77 · 17 · 19 | 58 · 9 · 12 | 46 · 8 · 9 | 37 · 0 · 1 | 36 · 4 · 3 | 33 · 1 · 1 |
| hard · balance | −$4.1k / $3.2k / $10.5k | −$5.9k / $9.4k / $47.0k | −$5.7k / $13.7k / $48.5k | −$6.7k / $31.4k / $108.7k | −$7.1k / $43.6k / $144.0k | −$5.1k / $108.3k / $279.5k | $1.6k / $161.1k / $381.0k | $65.8k / $182.6k / $526.2k |
| hard · low point | −$4.8k / $270 / $5.8k | −$5.9k / −$2.1k / $7.7k | −$5.7k / $1.1k / $21.1k | −$6.7k / $6.9k / $28.4k | −$7.1k / $12.4k / $83.0k | −$5.1k / $32.5k / $187.7k | −$2.7k / $41.9k / $278.0k | $22.0k / $72.0k / $354.7k |
| hard · debt owed (Backer + bank) | $0 / $0 / $10.1k | $0 / $0 / $9.9k | $0 / $0 / $9.7k | $0 / $0 / $9.6k | $0 / $0 / $7.3k | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 |
| hard · alive · rescued · ended | 98 · 27 · 5 | 93 · 17 · 24 | 69 · 15 · 16 | 53 · 15 · 16 | 37 · 6 · 9 | 28 · 0 · 4 | 24 · 3 · 2 | 22 · 0 · 0 |

#### C5. Regions — normal difficulty, every policy

Rep and the money columns are p50 at the end of the season named. First sponsor = the season the first deal was signed (– never).

| Region | n | insolvent | rescued | first sponsor p50 | no sponsor by end S1 | rep S0 · S1 | guaranteed / wk S1 | wages / wk S1 | balance S1 · S3 | seasons alive p50 |
|---|---|---|---|---|---|---|---|---|---|---|
| NA | 14 | 100% | 100% | S0 | 21% | 12 · 17 | $142 | $988 | −$5.0k · −$5.7k | 2 |
| EU | 14 | 100% | 100% | S2 | 100% | 5 · 7 | $16 | $658 | −$5.0k · −$5.2k | 2 |
| SAM | 14 | 86% | 86% | S0 | 0% | 16 · 29 | $229 | $910 | $10.3k · $76.9k | 3 |
| MENA | 14 | 64% | 71% | S0 | 0% | 24 · 39 | $265 | $1.0k | $20.2k · $33.3k | 5 |
| OCE | 14 | 43% | 71% | S0 | 0% | 20 · 35 | $245 | $780 | $14.6k · $48.6k | 8 |
| APAC | 14 | 43% | 43% | S0 | 0% | 25 · 42 | $716 | $963 | $21.2k · $74.9k | 8 |
| SSA | 14 | 36% | 36% | S0 | 0% | 20 · 36 | $244 | $810 | $19.2k · $56.8k | 8 |

#### C6. The renewal shock — the fresh ask ÷ the wage it replaces

Every renewal the bot priced (autopilot renews all at the ask; the others keep a player only while the books carry him). Founder +3 = a founder who gained 3+ overall since day 1; signed ≤19 = a player signed at 19 or younger (the developed youth).

| Who | n | ask ÷ old wage p10 / p50 / p90 | overall gained p50 | new ask ÷ guaranteed income p50 | kept |
|---|---|---|---|---|---|
| founder | 31 | ×0.81 / ×0.97 / ×1.30 | 1.5 | 1.01 | 8% |
| founder +3 | 947 | ×0.86 / ×2.95 / ×8.15 | 9.3 | 1.66 | 89% |
| signed ≤19 | 222 | ×0.99 / ×1.61 / ×24.64 | 3.0 | 1.07 | 79% |
| signed 20+ | 110 | ×0.87 / ×1.05 / ×1.39 | 0.6 | 0.59 | 88% |

| Renewal season | n | ask ÷ old wage p10 / p50 / p90 | old wage / wk p50 | new ask / wk p50 | kept |
|---|---|---|---|---|---|
| S1 | 536 | ×2.16 / ×4.58 / ×11.12 | $164 | $694 | 75% |
| S2 | 40 | ×1.08 / ×35.36 / ×76.49 | $211 | $7.1k | 84% |
| S3 | 253 | ×1.18 / ×2.08 / ×6.77 | $572 | $1.5k | 92% |
| S4 | 55 | ×0.94 / ×1.68 / ×4.48 | $2.4k | $4.7k | 81% |
| S5 | 216 | ×0.77 / ×0.98 / ×1.43 | $1.6k | $1.8k | 96% |
| S6 | 71 | ×0.90 / ×1.13 / ×3.80 | $3.3k | $4.5k | 85% |
| S7 | 139 | ×0.77 / ×0.88 / ×1.60 | $2.5k | $2.4k | 97% |

#### C7. Star access at each season start — the market's 85+ and 90+ against the user's books

Sampled on day 1 of every season (the preseason window opens), before the bot moves. Cheapest = the lowest fee + bonus + a season's wage. Carry = the star's wage fits in the guaranteed income left after the current payroll; carry with prizes = in that plus last season's prizes ÷ 3. AI bill = the best AI rosters' three asks at the user's prices (world #1, region #1), the only measurable stand-in for a league budget.

| Season | n | 85+ on the market p50 (signable) | 90+ p50 (signable) | best available p50: overall · up front · wage / wk | cheapest 85+: up front · wage / wk | cheapest 90+: up front · wage / wk | balance p50 · p90 | can pay the 85+ up front | can carry the 85+ (with prizes) | can carry the 90+ (with prizes) | AI bill / wk: world #1 · region #1 | a 90+ wage ÷ the region's #1 AI bill |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 | 294 | 58 (0) | 9 (0) | 94 · $482.1k · $19.8k | $16.6k · $3.5k | $219.6k · $10.1k | $12.0k · $20.0k | 33% | 0% (0%) | 0% (0%) | $23.5k · $5.8k | 1.84 |
| S1 | 282 | 81 (0) | 18 (0) | 96 · $888.7k · $33.0k | $71.8k · $3.3k | $220.4k · $8.4k | $7.8k · $24.3k | 0% | 0% (0%) | 0% (0%) | $38.6k · $11.4k | 0.70 |
| S2 | 240 | 94 (0) | 24 (0) | 98 · $830.6k · $43.7k | $66.0k · $3.2k | $180.6k · $7.9k | $21.3k · $60.4k | 10% | 1% (6%) | 0% (3%) | $37.4k · $9.8k | 0.79 |
| S3 | 185 | 93 (63) | 29 (0) | 96 · $635.4k · $33.6k | $74.0k · $2.9k | $203.8k · $8.0k | $24.0k · $106.2k | 21% | 5% (19%) | 0% (9%) | $53.1k · $10.7k | 0.67 |
| S4 | 153 | 93 (75) | 28 (8) | 96 · $699.7k · $28.1k | $90.3k · $2.6k | $187.8k · $7.6k | $86.1k · $214.3k | 46% | 0% (22%) | 0% (3%) | $51.5k · $11.2k | 0.59 |
| S5 | 128 | 94 (89) | 28 (26) | 96 · $1.02M · $30.7k | $83.0k · $2.7k | $263.6k · $8.8k | $94.7k · $275.8k | 55% | 2% (27%) | 0% (10%) | $54.4k · $17.8k | 0.50 |
| S6 | 121 | 93 (82) | 27 (25) | 96 · $997.5k · $35.3k | $86.5k · $2.4k | $284.6k · $7.9k | $129.8k · $436.3k | 67% | 3% (31%) | 0% (6%) | $58.7k · $16.0k | 0.51 |
| S7 | 113 | 84 (80) | 23 (21) | 96 · $1.19M · $34.1k | $94.3k · $2.6k | $246.4k · $8.0k | $150.0k · $571.4k | 70% | 7% (42%) | 0% (19%) | $67.9k · $15.8k | 0.53 |

Signings the bot actually made, by season (88+ = the harness's "star"):

| Season | signings | of them 85+ | 88+ | 90+ | 85+ wage / wk p50 | 85+ fee + bonus p50 | careers with an 88+ signing |
|---|---|---|---|---|---|---|---|
| S0 | 206 | 0 | 0 | 0 | – | – | 0% |
| S1 | 176 | 4 | 0 | 0 | $2.2k | $73.3k | 0% |
| S2 | 333 | 22 | 4 | 0 | $3.3k | $79.2k | 2% |
| S3 | 154 | 50 | 10 | 2 | $3.5k | $99.8k | 5% |
| S4 | 115 | 46 | 16 | 2 | $3.7k | $109.8k | 10% |
| S5 | 80 | 36 | 18 | 5 | $4.4k | $146.4k | 13% |
| S6 | 99 | 49 | 20 | 10 | $5.0k | $144.6k | 15% |
| S7 | 106 | 49 | 24 | 12 | $5.6k | $211.6k | 20% |

#### C7b. Star access by difficulty — carrying the cheapest 90+ (guaranteed + last season's prizes) and signing an 88+

| Difficulty | can carry a 90+ at S3 | S5 | S6 | S7 | careers with an 88+ signing by S4 | by S7 |
|---|---|---|---|---|---|---|
| easy | 19% (n 74) | 21% (n 63) | 10% (n 61) | 36% (n 58) | 22% | 38% |
| normal | 3% (n 58) | 0% (n 37) | 3% (n 36) | 3% (n 33) | 4% | 4% |
| hard | 0% (n 53) | 0% (n 28) | 0% (n 24) | 0% (n 22) | 0% | 1% |

#### C8. The slope — a season's money by the team rating at its end (every difficulty)

Does a stronger squad earn what it costs? Each row is one career-season; per week.

| Team rating | n | wages + coach / wk p50 | prizes / wk p50 | guaranteed / wk p50 | net / wk p10 / p50 / p90 | ended that season |
|---|---|---|---|---|---|---|
| < 76 | 239 | $543 | $231 | $86 | −$560 / −$38 / $879 | 12% |
| 76–78 | 300 | $798 | $406 | $148 | −$671 / −$63 / $1.3k | 16% |
| 79–81 | 304 | $1.6k | $830 | $663 | −$815 / $24 / $1.3k | 20% |
| 82–84 | 234 | $3.7k | $1.7k | $982 | −$1.3k / $345 / $3.1k | 11% |
| 85–87 | 188 | $6.2k | $4.0k | $2.6k | −$1.7k / $674 / $4.7k | 5% |
| 88+ | 249 | $11.9k | $8.2k | $6.0k | −$2.6k / $1.3k / $6.3k | 5% |

#### C9. Snowball — the balance in seasons of payroll, by season (p50 / p90)

Balance at season end ÷ that season's wages + coach. Above 2, money has stopped being a decision for that career.

| Difficulty | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| easy · p50 / p90 | 0.9 / 3.1 | 0.7 / 3.1 | 0.5 / 2.6 | 0.7 / 3.8 | 0.7 / 2.7 | 0.7 / 4.4 | 0.6 / 3.9 | 0.7 / 1.6 |
| easy · above 2 seasons | 30% | 23% | 16% | 24% | 17% | 25% | 18% | 10% |
| easy · with a tight Monday (money still decides) | 19% | 31% | 35% | 18% | 19% | 14% | 23% | 19% |
| normal · p50 / p90 | 0.5 / 1.6 | 0.4 / 1.1 | 0.1 / 0.9 | 0.3 / 0.8 | 0.3 / 0.7 | 0.5 / 1.1 | 0.3 / 1.0 | 0.4 / 1.0 |
| normal · above 2 seasons | 5% | 2% | 1% | 2% | 2% | 3% | 0% | 0% |
| normal · with a tight Monday (money still decides) | 33% | 54% | 58% | 50% | 46% | 30% | 25% | 21% |
| hard · p50 / p90 | 0.2 / 0.7 | 0.3 / 1.3 | 0.1 / 0.5 | 0.2 / 0.8 | 0.2 / 0.7 | 0.4 / 1.4 | 0.5 / 1.4 | 0.5 / 1.6 |
| hard · above 2 seasons | 0% | 1% | 0% | 2% | 0% | 4% | 4% | 9% |
| hard · with a tight Monday (money still decides) | 71% | 73% | 80% | 60% | 59% | 32% | 33% | 23% |

_Re-rendered from a saved run (ECON_IN); that sweep took 2,109 s (35 min) in one process._
