/**
 * Road to Worlds — economy leaf functions (design doc §9).
 *
 * Owner note (design §9): this module owns EVERY money formula and table —
 * salary asks, transfer fees, prizes, sponsor packages, paydays, the loan.
 * The market layer (./market.ts) and the season/world layers consume these;
 * nothing outside this file computes a dollar amount.
 *
 * Pure TS, deterministic: per-entity randomness (ask jitter, sponsor picks)
 * comes from `derivedFloat` — no Rng cursor is ever consumed here.
 */

import {
  CAREER_BANK,
  CAREER_ECONOMY,
  CAREER_GEAR,
  CAREER_LOAN,
  CAREER_NEGOTIATION,
  CAREER_PAYROLL,
  CAREER_POINTS,
  CAREER_PRIZES,
  CAREER_REP,
  CAREER_SALARY,
  CAREER_SAVE,
  CAREER_SPONSOR,
  CAREER_STARS,
  CAREER_TRANSFER,
  CAREER_UNLOCKS,
} from "@/config/balance";
import { clamp } from "@/lib/util";
import type { Placement } from "../types";
import { derivedFloat, streams } from "./seeds";
import type {
  BankLoanState,
  CareerDifficulty,
  CareerEventFormat,
  EventTier,
  FinanceState,
  GearState,
  LedgerEntry,
  SponsorObjectiveKind,
  SponsorState,
} from "./types";

// ---------------------------------------------------------------------------
// PINNED leaf contract (careerResults + worldSim + market code against these)
// ---------------------------------------------------------------------------

/** Quantize to CAREER_ECONOMY.roundQuantum, toward zero (−499 → −250). */
export function quantize(n: number): number {
  const q = CAREER_ECONOMY.roundQuantum;
  return Math.trunc(n / q) * q;
}

/** Market acceptance tier — ONE mapping, one table (design §9). */
export function repTierOf(rep: number): 0 | 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(0, Math.floor(rep / 20))) as 0 | 1 | 2 | 3 | 4;
}

/**
 * Placement → percent of the pool. Swiss16 pays every placement ("top4"
 * maps onto the fourth row); single8 collapses third/fourth into top4;
 * v2.0 (R40) Swiss-only pays flat by outcome (qualified "top8" vs
 * eliminated "swiss_exit").
 */
function prizePctFor(placement: Placement, format: CareerEventFormat): number {
  if (format === "swissOnly") {
    const table = CAREER_PRIZES.swissOnlyPct;
    return placement === "swiss_exit" ? table.eliminated : table.qualified;
  }
  if (format === "swiss") {
    const table = CAREER_PRIZES.swiss16Pct;
    if (placement === "top4") return table.fourth;
    return table[placement] ?? table.swiss_exit;
  }
  const table = CAREER_PRIZES.single8Pct;
  switch (placement) {
    case "champion":
      return table.champion;
    case "runner_up":
      return table.runner_up;
    case "third":
    case "fourth":
    case "top4":
      return table.top4;
    default:
      // top6/top8/swiss_exit — everything below top4 in an 8-team SE.
      return table.top8;
  }
}

/**
 * Prize for one placement: pool × pct table (by format) × difficulty
 * prizeMult, quantized. Design §9 "every placement pays": a positive share
 * never quantizes to $0 — it floors at one quantum.
 */
export function prizeFor(
  tier: EventTier,
  placement: Placement,
  format: CareerEventFormat,
  difficulty: CareerDifficulty,
  /** v0.3: pools grow ×growthPerSeason^seasonIndex (default 0 = season X). */
  seasonIndex = 0,
): number {
  const pool =
    CAREER_PRIZES.pools[tier] *
    Math.pow(CAREER_PRIZES.growthPerSeason, Math.max(0, seasonIndex));
  const pct = prizePctFor(placement, format);
  const raw = pool * (pct / 100) * CAREER_ECONOMY.prizeMult[difficulty];
  const quantized = quantize(raw);
  if (quantized === 0 && raw > 0) return CAREER_ECONOMY.roundQuantum;
  return quantized;
}

/**
 * How many teams finish on each placement, per event format: a 16-team Swiss
 * into a top-8 double elimination (3rd/4th from the third-place series, two
 * lb_round2 exits = top6, two lb_round1 exits = top8); an 8-team single
 * elimination (no third-place series); the Swiss-only qualifier (8 / 8).
 */
const PLACEMENTS_BY_FORMAT: Record<CareerEventFormat, Partial<Record<Placement, number>>> = {
  swiss: { champion: 1, runner_up: 1, third: 1, fourth: 1, top6: 2, top8: 2, swiss_exit: 8 },
  single: { champion: 1, runner_up: 1, top4: 2, top8: 4 },
  swissOnly: { top8: 8, swiss_exit: 8 },
};

/**
 * rc.29 (CAR-08): an event's REAL prize pool — every finishing place's
 * prizeFor summed over the field (season growth, difficulty and the $50
 * rounding included), so the figure a lobby advertises is what the event pays.
 */
export function prizePoolPaidFor(
  tier: EventTier,
  format: CareerEventFormat,
  difficulty: CareerDifficulty,
  seasonIndex = 0,
): number {
  let total = 0;
  for (const [placement, count] of Object.entries(PLACEMENTS_BY_FORMAT[format])) {
    total += (count ?? 0) * prizeFor(tier, placement as Placement, format, difficulty, seasonIndex);
  }
  return total;
}

/**
 * Season Points: 0 for unofficials (t3/t2) and Worlds (the finale pays no
 * points); regionals use the placement table; Majors pay exactly ×2.
 */
export function pointsFor(tier: EventTier, placement: Placement): number {
  if (tier === "t3" || tier === "t2" || tier === "qualifier" || tier === "worlds") return 0;
  const base = CAREER_POINTS.regional[placement] ?? 0;
  return tier === "major" ? base * CAREER_POINTS.majorMultiplier : base;
}

/**
 * Cosmetic team stars — v0.2 recalibration: 0-5★ in HALF-STAR steps. The
 * dominant signal is the org's rating PERCENTILE across the whole live world
 * (v0.1's absolute band under-rated the strong: a 90-rated contender read 3★
 * because the band stretched to 93). Percentile guarantees the strong teams
 * read strong BY CONSTRUCTION — the world's best profile is always ~5★ — with
 * a small prestige/reputation component separating established brands from
 * surging newcomers at equal rating.
 */
export function starsFor(input: {
  rating: number;
  /** Intrinsic ratings of EVERY live org (the percentile population). */
  worldRatings: number[];
  /** Prestige/rep tier 0..4 (AI: prestige+1; user: repTierOf(rep)). */
  repTier: number;
}): number {
  const { rating, worldRatings, repTier } = input;
  const pop = worldRatings.length > 0 ? worldRatings : [rating];
  let below = 0;
  for (const r of pop) if (r <= rating) below += 1;
  const percentile = below / pop.length;
  const score =
    CAREER_STARS.ratingWeight * percentile +
    CAREER_STARS.prestigeWeight * (clamp(repTier, 0, 4) / 4);
  // 0..1 → 0..maxStars in half-star steps.
  return clamp(Math.round(score * CAREER_STARS.maxStars * 2) / 2, 0, CAREER_STARS.maxStars);
}

// ---------------------------------------------------------------------------
// Salary & fees (design §9 — the CAREER_SALARY curve)
// ---------------------------------------------------------------------------

export interface SalaryAskInput {
  overall: number;
  age: number;
  potential: number;
  rep: number;
  role: "starter" | "sub";
  seasonIndex: number;
  lengthSeasons: 1 | 2 | 3;
  difficulty: CareerDifficulty;
  careerSeed: number;
  playerId: string;
  /** Prestige-band-above-rep-tier renewal (design §9 "Ambition"). */
  ambitious?: boolean;
  /** Refused-Blockbuster surcharge on this player's next renewal. */
  blockbusterRefused?: boolean;
}

function ageFactorFor(age: number): number {
  const f = CAREER_SALARY.ageFactor;
  if (age <= 18) return f.u18;
  if (age <= 22) return f.a19_22;
  if (age <= 24) return f.a23_24;
  return f.a25plus;
}

function potentialFactorFor(overall: number, potential: number): number {
  return Math.min(
    CAREER_SALARY.potentialCap,
    1 + CAREER_SALARY.potentialPerPoint * Math.max(0, potential - overall),
  );
}

/** The soft star-gate: money, never a hard refusal (design §9). */
function repPremiumFor(overall: number, rep: number): number {
  const comfort = CAREER_SALARY.repComfortBase + CAREER_SALARY.repComfortSlope * rep;
  return Math.min(
    CAREER_SALARY.repPremiumCap,
    1 + CAREER_SALARY.repPremiumPerPoint * Math.max(0, overall - comfort),
  );
}

/** Shared base curve: $base × growth^(OVR−anchor) × askMult × inflation. */
function baseCurve(
  overall: number,
  seasonIndex: number,
  difficulty: CareerDifficulty,
): number {
  return (
    CAREER_SALARY.basePerSplit *
    Math.pow(CAREER_SALARY.growthPerPoint, overall - CAREER_SALARY.anchorOverall) *
    CAREER_ECONOMY.salaryAskMult[difficulty] *
    Math.pow(CAREER_SALARY.inflationPerSeason, seasonIndex)
  );
}

/** ±askJitterPct deterministic personality jitter, stable per (career, player). */
function askJitterFor(careerSeed: number, playerId: string): number {
  const f = derivedFloat(careerSeed, streams.gen("ask", playerId));
  return 1 + (f * 2 - 1) * CAREER_SALARY.askJitterPct;
}

/**
 * Per-split salary ask (design §9). Curve anchors (prime age, neutral rest):
 * 75 ≈ $14.5k · 80 ≈ $27k · 85 ≈ $50k · 90 ≈ $92k · 95 ≈ $170k.
 * Floor CAREER_SALARY.minSalary, quantized.
 */
export function computeSalaryAsk(input: SalaryAskInput): number {
  const raw =
    baseCurve(input.overall, input.seasonIndex, input.difficulty) *
    ageFactorFor(input.age) *
    potentialFactorFor(input.overall, input.potential) *
    repPremiumFor(input.overall, input.rep) *
    (input.role === "sub" ? CAREER_SALARY.subRoleFactor : 1) *
    Math.pow(CAREER_SALARY.lengthDiscountPerSeason, input.lengthSeasons - 1) *
    (input.ambitious ? CAREER_SALARY.ambitionRenewalMult : 1) *
    (input.blockbusterRefused ? CAREER_SALARY.blockbusterRefusalRenewalMult : 1) *
    askJitterFor(input.careerSeed, input.playerId);
  return quantize(Math.max(CAREER_SALARY.minSalary, raw));
}

/**
 * The legible "why this price" breakdown for `computeSalaryAsk` — signed $
 * effects, applied cumulatively in this order on top of the core curve.
 * Exported for market.askPackageFor (kept here so formula and readout can
 * never drift apart).
 */
export function salaryAskFactors(input: SalaryAskInput): { key: string; delta: number }[] {
  // Core = curve at this OVR with everything person-specific neutral (but
  // role/difficulty/inflation/jitter folded in — they apply to every candidate).
  const core =
    baseCurve(input.overall, input.seasonIndex, input.difficulty) *
    (input.role === "sub" ? CAREER_SALARY.subRoleFactor : 1) *
    askJitterFor(input.careerSeed, input.playerId);
  const steps: { key: string; factor: number }[] = [
    { key: "age", factor: ageFactorFor(input.age) },
    { key: "potential", factor: potentialFactorFor(input.overall, input.potential) },
    { key: "repPremium", factor: repPremiumFor(input.overall, input.rep) },
    {
      key: "length",
      factor: Math.pow(CAREER_SALARY.lengthDiscountPerSeason, input.lengthSeasons - 1),
    },
  ];
  const factors: { key: string; delta: number }[] = [
    { key: "overall", delta: Math.round(core) },
  ];
  let running = core;
  for (const step of steps) {
    const next = running * step.factor;
    const delta = Math.round(next - running);
    if (delta !== 0) factors.push({ key: step.key, delta });
    running = next;
  }
  return factors;
}

/** Under-contract fee: ask × remaining splits × factor, min fee, quantized. */
export function transferFeeFor(askPerSplit: number, splitsRemaining: number): number {
  return quantize(
    Math.max(
      CAREER_TRANSFER.minFee,
      askPerSplit * splitsRemaining * CAREER_TRANSFER.feePerRemainingSplit,
    ),
  );
}

// ---------------------------------------------------------------------------
// v0.3 unified market value — ONE number every fee derives from
// ---------------------------------------------------------------------------

export interface MarketValueInput {
  overall: number;
  age: number;
  potential: number;
  seasonIndex: number;
}

/**
 * The player's market value: the salary curve at normal difficulty with the
 * person-neutral factors only (age, upside, inflation) × valueMultiple.
 * Deliberately EXCLUDES rep premium, role, length and jitter — the same
 * player is worth the same number in the news feed, an AI↔AI trade and the
 * user's market screen (Miguel: fees were wildly discrepant).
 */
export function marketValueFor(input: MarketValueInput): number {
  const raw =
    CAREER_SALARY.basePerSplit *
    Math.pow(CAREER_SALARY.growthPerPoint, input.overall - CAREER_SALARY.anchorOverall) *
    Math.pow(CAREER_SALARY.inflationPerSeason, input.seasonIndex) *
    ageFactorFor(input.age) *
    potentialFactorFor(input.overall, input.potential) *
    CAREER_TRANSFER.valueMultiple;
  return quantize(Math.max(CAREER_TRANSFER.minFee, raw));
}

/** User buys under-contract: value × bounded contract load (was ask×splits×1.4). */
export function contractedFeeFor(value: number, splitsRemaining: number): number {
  const load =
    CAREER_TRANSFER.contractLoadBase +
    CAREER_TRANSFER.contractLoadPerSplit * Math.max(1, splitsRemaining);
  return quantize(Math.max(CAREER_TRANSFER.minFee, value * load));
}

// ---------------------------------------------------------------------------
// v0.3 salary negotiation (deterministic hidden reserve, legible odds)
// ---------------------------------------------------------------------------

/**
 * The player's hidden reserve factor for this (season, window bucket): a
 * uniform draw in [reserveFloor, 1]. Fixed per window — re-rolling by
 * reloading is impossible by construction.
 */
export function negotiationReserveFor(
  careerSeed: number,
  playerId: string,
  seasonIndex: number,
  windowKey: string,
): number {
  const f = derivedFloat(
    careerSeed,
    streams.gen("negRes", `${playerId}:${seasonIndex}:${windowKey}`),
  );
  return CAREER_NEGOTIATION.reserveFloor + f * (1 - CAREER_NEGOTIATION.reserveFloor);
}

/**
 * TRUE accept probability of an offer at `offer/ask`, given `rejects` prior
 * lowballs this window (each hardens the reserve by hardenPerReject). This is
 * the honest uniform CDF — the UI shows exactly this number.
 */
export function negotiationAcceptChance(
  offered: number,
  ask: number,
  rejects: number,
): number {
  if (ask <= 0) return 0;
  const floor = Math.min(
    1,
    CAREER_NEGOTIATION.reserveFloor + CAREER_NEGOTIATION.hardenPerReject * rejects,
  );
  if (floor >= 1) return offered >= ask ? 1 : 0;
  return clamp((offered / ask - floor) / (1 - floor), 0, 1);
}

/** Resolve a counter-offer: accepted iff offer ≥ hardened reserve × ask. */
export function negotiationAccepts(input: {
  careerSeed: number;
  playerId: string;
  seasonIndex: number;
  windowKey: string;
  offered: number;
  ask: number;
  rejects: number;
}): boolean {
  if (input.offered >= input.ask) return true;
  if (input.rejects >= CAREER_NEGOTIATION.maxRejects) return false;
  const reserve = Math.min(
    1,
    negotiationReserveFor(input.careerSeed, input.playerId, input.seasonIndex, input.windowKey) +
      CAREER_NEGOTIATION.hardenPerReject * input.rejects,
  );
  return input.offered >= quantize(input.ask * reserve);
}

// ---------------------------------------------------------------------------
// v0.3 rep-gated signing cap (visible lock — supersedes §21.3's soft-only gate)
// ---------------------------------------------------------------------------

/** Max overall a NEW signing accepts at this reputation (squad/renewals exempt). */
export function signableOverallCap(rep: number): number {
  if (rep >= CAREER_UNLOCKS.signableCapFreeAt) return 99;
  return Math.min(
    99,
    CAREER_UNLOCKS.signableCapBase + CAREER_UNLOCKS.signableCapPerRep * rep,
  );
}

/** Reputation needed before a player of this overall signs (0 = signable now). */
export function repNeededForOverall(overall: number): number {
  if (overall <= CAREER_UNLOCKS.signableCapBase) return 0;
  const rep = Math.ceil(
    (overall - CAREER_UNLOCKS.signableCapBase) / CAREER_UNLOCKS.signableCapPerRep,
  );
  return Math.min(rep, CAREER_UNLOCKS.signableCapFreeAt);
}

/** Free-agent "luvas": ≈15% of the first SEASON's (3 splits) salary. */
export function signingBonusFor(salaryPerSplit: number): number {
  return quantize(salaryPerSplit * 3 * CAREER_TRANSFER.signingBonusPct);
}

/** Coach hire ask: the plain overall curve × coachFactor (no age/potential/rep). */
export function coachSalaryFor(
  coachOverall: number,
  seasonIndex: number,
  difficulty: CareerDifficulty,
): number {
  return quantize(
    baseCurve(coachOverall, seasonIndex, difficulty) * CAREER_SALARY.coachFactor,
  );
}

// ---------------------------------------------------------------------------
// Ledger & paydays (the two pure funnels feed through pushLedger)
// ---------------------------------------------------------------------------

/** Monotonic per-save ledger sequence — survives ring-buffer trimming. */
function nextLedgerSeq(fin: FinanceState): number {
  const last = fin.ledger[fin.ledger.length - 1];
  if (!last) return 0;
  const tail = Number(last.id.slice(last.id.lastIndexOf(":") + 1));
  return Number.isFinite(tail) ? tail + 1 : fin.ledger.length;
}

/**
 * Immutably append a ledger line and apply its signed amount to the balance.
 * The ledger is a ring buffer capped at CAREER_SAVE.ledgerTailCap.
 */
export function pushLedger(fin: FinanceState, entry: Omit<LedgerEntry, "id">): FinanceState {
  const id = `led:${entry.seasonIndex}:${entry.week}:${nextLedgerSeq(fin)}`;
  const ledger = [...fin.ledger, { ...entry, id }].slice(-CAREER_SAVE.ledgerTailCap);
  return { ...fin, ledger, balance: fin.balance + entry.amount };
}

/**
 * Prize payout: one prize line; while the Backer loan is active, a
 * garnishRate[difficulty] slice is line-itemized on the same payout and
 * reduces loan.remaining (the loan clears at 0 — final slice may be
 * sub-quantum so the debt zeroes exactly).
 */
export function applyPrize(
  fin: FinanceState,
  amount: number,
  ctx: { seasonIndex: number; week: number; day?: number; refName: string; difficulty: CareerDifficulty },
): { fin: FinanceState; garnished: number } {
  let next = pushLedger(fin, {
    seasonIndex: ctx.seasonIndex,
    week: ctx.week,
    day: ctx.day,
    kind: "prize",
    amount,
    refName: ctx.refName,
  });
  let garnished = 0;
  if (next.loan && amount > 0) {
    garnished = Math.min(
      next.loan.remaining,
      quantize(CAREER_LOAN.garnishRate[ctx.difficulty] * amount),
    );
    if (garnished > 0) {
      next = pushLedger(next, {
        seasonIndex: ctx.seasonIndex,
        week: ctx.week,
        day: ctx.day,
        kind: "loanGarnish",
        amount: -garnished,
        refName: ctx.refName,
      });
      const remaining = next.loan!.remaining - garnished;
      next = { ...next, loan: remaining > 0 ? { remaining } : null };
    }
  }
  return { fin: next, garnished };
}

/**
 * v0.3 debt-lock fix: a player sale while the Backer loan is active amortizes
 * the debt at saleGarnishRate (half the fee) — selling a star finally pays
 * the Backer down. Same line-item pattern as applyPrize.
 */
export function applyTransferIncome(
  fin: FinanceState,
  amount: number,
  ctx: { seasonIndex: number; week: number; day?: number; refName: string },
): { fin: FinanceState; garnished: number } {
  let next = pushLedger(fin, {
    seasonIndex: ctx.seasonIndex,
    week: ctx.week,
    day: ctx.day,
    kind: "transferIn",
    amount,
    refName: ctx.refName,
  });
  let garnished = 0;
  if (next.loan && amount > 0) {
    garnished = Math.min(
      next.loan.remaining,
      quantize(CAREER_LOAN.saleGarnishRate * amount),
    );
    if (garnished > 0) {
      next = pushLedger(next, {
        seasonIndex: ctx.seasonIndex,
        week: ctx.week,
        day: ctx.day,
        kind: "loanGarnish",
        amount: -garnished,
        refName: ctx.refName,
      });
      const remaining = next.loan!.remaining - garnished;
      next = { ...next, loan: remaining > 0 ? { remaining } : null };
    }
  }
  return { fin: next, garnished };
}

/**
 * v0.3 manual debt pay-down: any amount from the balance, any time. Clamped
 * to the outstanding debt; the loan clears at exactly 0.
 */
export function payLoanDown(
  fin: FinanceState,
  amount: number,
  ctx: { seasonIndex: number; week: number; day?: number },
): FinanceState {
  if (!fin.loan || amount <= 0) return fin;
  const paid = Math.min(fin.loan.remaining, amount);
  let next = pushLedger(fin, {
    seasonIndex: ctx.seasonIndex,
    week: ctx.week,
    day: ctx.day,
    kind: "loanPayment",
    amount: -paid,
  });
  const remaining = next.loan!.remaining - paid;
  next = { ...next, loan: remaining > 0 ? { remaining } : null };
  return next;
}

// ---------------------------------------------------------------------------
// v2.0 weekly payroll (R20) — ONE statement, used by the funnel AND the UI
// ---------------------------------------------------------------------------

/** Quantize a weekly line to CAREER_PAYROLL.weeklyQuantum (toward zero). */
export function quantizeWeekly(n: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  return Math.trunc(n / q) * q;
}

/**
 * A per-split amount spread over the season's weeks: ×splits/weeks, so 32
 * weekly lines add up to exactly 3 × the split figure (before quantization).
 */
export function weeklyOf(perSplit: number): number {
  const weekly = quantizeWeekly(
    (perSplit * CAREER_PAYROLL.splitsPerSeason) / CAREER_PAYROLL.weeksPerSeason,
  );
  // A positive contract never reads "$0 / week" — floor at one weekly quantum.
  return weekly === 0 && perSplit > 0 ? CAREER_PAYROLL.weeklyQuantum : weekly;
}

/** The weekly wage a per-split contract pays (the number every wage label shows). */
export function weeklyWage(salaryPerSplit: number): number {
  return weeklyOf(salaryPerSplit);
}

export interface WeeklyStatementInput {
  squadSalaries: { name: string; amount: number }[];
  coachSalary: number | null;
  sponsor: SponsorState | null;
  rep: number;
  gear: GearState;
  bankLoan?: BankLoanState | null;
}

export interface WeeklyStatement {
  sponsorBase: number;
  fanbase: number;
  payroll: number;
  coach: number;
  psychologist: number;
  upkeep: number;
  bankPayment: number;
  income: number;
  expenses: number;
  net: number;
}

/**
 * The Monday statement, computed ONCE here so the hub tile, the Finances
 * screen and the ledger lines can never disagree. All amounts positive;
 * `net` is income − expenses.
 */
export function weeklyStatement(input: WeeklyStatementInput): WeeklyStatement {
  const sponsorBase = input.sponsor ? weeklyOf(input.sponsor.basePerSplit) : 0;
  const fanbase = weeklyOf(Math.max(0, input.rep) * CAREER_ECONOMY.passivePerRepPoint);
  const payroll = input.squadSalaries.reduce((sum, l) => sum + weeklyWage(l.amount), 0);
  const coach = input.coachSalary !== null && input.coachSalary > 0 ? weeklyWage(input.coachSalary) : 0;
  const psychologist = input.gear.psychologist ? weeklyOf(CAREER_GEAR.psychologistPerSplit) : 0;
  const upkeep = weeklyOf(gearUpkeepPerSplit(input.gear));
  const bankPayment = input.bankLoan
    ? Math.min(input.bankLoan.remaining, input.bankLoan.weeklyPayment)
    : 0;
  const income = sponsorBase + fanbase;
  const expenses = payroll + coach + psychologist + upkeep + bankPayment;
  return {
    sponsorBase,
    fanbase,
    payroll,
    coach,
    psychologist,
    upkeep,
    bankPayment,
    income,
    expenses,
    net: income - expenses,
  };
}

/**
 * Weeks the balance covers at the current weekly net (null = not burning).
 * The Finances runway line and the hub warning read this.
 */
export function runwayWeeks(balance: number, weeklyNet: number): number | null {
  if (weeklyNet >= 0) return null;
  return Math.max(0, Math.floor(balance / -weeklyNet));
}

export interface WeeklyPayrollInput extends WeeklyStatementInput {
  fin: FinanceState;
  seasonIndex: number;
  week: number;
  day?: number;
  difficulty: CareerDifficulty;
}

/**
 * The Monday money funnel (v2.0 — replaces the per-split payday): sponsor
 * base in → fanbase in → squad payroll out (ONE aggregated line) → coach out →
 * psychologist out → upkeep out → bank instalment out → floor check.
 *
 * Floor check (design §9 Emergency Backer, unchanged): balance below
 * CAREER_LOAN.floor → first time the Backer grants back to `rescueTo`
 * (repayable at repayFactor, garnished from prizes); a second breach after
 * the rescue = insolvency (the STORE owns the ending).
 */
export function weeklyPayroll(input: WeeklyPayrollInput): {
  fin: FinanceState;
  statement: WeeklyStatement;
  insolvent: boolean;
  rescued: boolean;
  bankCleared: boolean;
} {
  const { seasonIndex, week, day } = input;
  const statement = weeklyStatement({ ...input, bankLoan: input.fin.bankLoan ?? null });
  let fin = input.fin;
  const line = (kind: LedgerEntry["kind"], amount: number, refName?: string) => {
    if (amount === 0) return;
    fin = pushLedger(fin, { seasonIndex, week, day, kind, amount, refName });
  };

  line("sponsorBase", statement.sponsorBase, input.sponsor?.sponsorId);
  line("fanbase", statement.fanbase);
  line("payroll", -statement.payroll);
  line("coachSalary", -statement.coach);
  line("buff", -statement.psychologist);
  line("upkeep", -statement.upkeep);

  let bankCleared = false;
  if (fin.bankLoan && statement.bankPayment > 0) {
    line("bankPayment", -statement.bankPayment);
    const remaining = fin.bankLoan.remaining - statement.bankPayment;
    bankCleared = remaining <= 0;
    fin = { ...fin, bankLoan: remaining > 0 ? { ...fin.bankLoan, remaining } : null };
  }

  let insolvent = false;
  let rescued = false;
  if (fin.balance < CAREER_LOAN.floor) {
    if (!fin.loanUsed) {
      const grant = CAREER_LOAN.rescueTo - fin.balance;
      fin = pushLedger(fin, { seasonIndex, week, day, kind: "loanGrant", amount: grant });
      fin = {
        ...fin,
        loan: { remaining: grant * CAREER_LOAN.repayFactor },
        loanUsed: true,
      };
      rescued = true;
    } else {
      insolvent = true;
    }
  }
  return { fin, statement, insolvent, rescued, bankCleared };
}

// ---------------------------------------------------------------------------
// v2.0 bank loan (R21)
// ---------------------------------------------------------------------------

/** Max principal the bank offers at this reputation (0 = nothing yet). */
export function bankLoanLimitFor(rep: number): number {
  return CAREER_BANK.maxByRepTier[repTierOf(rep)];
}

/** Repayment terms for a principal: total owed, weekly instalment, term. */
export function bankLoanTerms(principal: number): {
  total: number;
  weeklyPayment: number;
  termWeeks: number;
} {
  const total = quantizeWeekly(principal * (1 + CAREER_BANK.interestPct));
  const weeklyPayment = Math.max(
    CAREER_PAYROLL.weeklyQuantum,
    Math.ceil(total / CAREER_BANK.termWeeks / CAREER_PAYROLL.weeklyQuantum) *
      CAREER_PAYROLL.weeklyQuantum,
  );
  return { total, weeklyPayment, termWeeks: CAREER_BANK.termWeeks };
}

export type BankLoanRefusal = "active" | "backer" | "amount" | "limit";

/** Why a loan request would be refused right now (null = allowed). */
export function bankLoanRefusal(
  fin: FinanceState,
  rep: number,
  principal: number,
): BankLoanRefusal | null {
  if (fin.bankLoan) return "active";
  if (CAREER_BANK.blockedWhileBacker && fin.loan) return "backer";
  if (principal < CAREER_BANK.minAmount || principal !== quantize(principal)) return "amount";
  if (principal > bankLoanLimitFor(rep)) return "limit";
  return null;
}

/** Book the principal and open the loan (caller validated via bankLoanRefusal). */
export function takeBankLoan(
  fin: FinanceState,
  principal: number,
  ctx: { seasonIndex: number; week: number; day?: number },
): FinanceState {
  const terms = bankLoanTerms(principal);
  const next = pushLedger(fin, {
    seasonIndex: ctx.seasonIndex,
    week: ctx.week,
    day: ctx.day,
    kind: "bankLoan",
    amount: principal,
  });
  return {
    ...next,
    bankLoan: {
      principal,
      remaining: terms.total,
      weeklyPayment: terms.weeklyPayment,
      takenSeason: ctx.seasonIndex,
      takenWeek: ctx.week,
    },
  };
}

/** Early pay-down of the bank loan (any amount; clears at exactly 0). */
export function payBankLoanDown(
  fin: FinanceState,
  amount: number,
  ctx: { seasonIndex: number; week: number; day?: number },
): FinanceState {
  if (!fin.bankLoan || amount <= 0) return fin;
  const paid = Math.min(fin.bankLoan.remaining, amount);
  const next = pushLedger(fin, {
    seasonIndex: ctx.seasonIndex,
    week: ctx.week,
    day: ctx.day,
    kind: "bankPayment",
    amount: -paid,
  });
  const remaining = fin.bankLoan.remaining - paid;
  return { ...next, bankLoan: remaining > 0 ? { ...fin.bankLoan, remaining } : null };
}

// ---------------------------------------------------------------------------
// Sponsors, unlocks, reputation
// ---------------------------------------------------------------------------

/**
 * Fictional sponsor brands, 2 per tier (career-only flavor — never real
 * brands; display names live in copy under career.sponsor.*).
 */
const SPONSOR_POOL: Record<1 | 2 | 3 | 4, readonly [string, string]> = {
  1: ["voltway", "nitrocore"],
  2: ["apexfuel", "skyline-hw"],
  3: ["turbomate", "gridlock"],
  4: ["ionbeam", "hyperlane"],
};

function sponsorOfferForTier(
  tier: 1 | 2 | 3 | 4,
  seasonIndex: number,
  careerSeed: number,
  difficulty: CareerDifficulty,
): SponsorState {
  const row = CAREER_SPONSOR.tiers[tier - 1];
  const pick = derivedFloat(careerSeed, streams.gen("sponsor", `${seasonIndex}:${tier}`));
  // v0.3: sponsor money grows with the scene (new deals only — offers are
  // generated per season, so the growth bakes in at offer time).
  const mult =
    CAREER_ECONOMY.sponsorMult[difficulty] *
    Math.pow(CAREER_SPONSOR.growthPerSeason, Math.max(0, seasonIndex));
  return {
    sponsorId: SPONSOR_POOL[tier][pick < 0.5 ? 0 : 1],
    tier,
    basePerSplit: quantize(row.base * mult),
    bonus: quantize(row.bonus * mult),
    objectiveKind: row.objective as SponsorObjectiveKind,
    progress: 0,
    hitThisSplit: false,
    missedCount: 0,
  };
}

/**
 * Season-start sponsor offers: the best rep-eligible tier (one lower when the
 * patience meter ran out — design §9, re-earnable) plus the tier below as the
 * safe option. Amounts are ×sponsorMult[difficulty] and quantized HERE —
 * weeklyPayroll pays the stored figures verbatim (spread per week).
 *
 * NOTE: `difficulty` was added to the pinned signature — sponsorMult cannot
 * be applied without it (single deviation, coordinated via the build report).
 */
export function sponsorOffersFor(
  rep: number,
  seasonIndex: number,
  careerSeed: number,
  prevTier: number | null,
  patienceMissed: boolean,
  difficulty: CareerDifficulty,
): SponsorState[] {
  let best = 1;
  for (const row of CAREER_SPONSOR.tiers) {
    if (rep >= row.repGate) best = row.tier;
  }
  // Patience only demotes a renewal (there must have been a previous deal).
  if (patienceMissed && prevTier !== null) best = Math.max(1, best - 1);
  const tiers = best > 1 ? [best, best - 1] : [1];
  return tiers.map((tier) =>
    sponsorOfferForTier(tier as 1 | 2 | 3 | 4, seasonIndex, careerSeed, difficulty),
  );
}

// ---------------------------------------------------------------------------
// Gear & staff ladder (v0.2 — the progressive toolbox)
// ---------------------------------------------------------------------------

export type GearItemId = (typeof CAREER_GEAR.items)[number]["id"];

const GEAR_ORDER = CAREER_GEAR.items.map((i) => i.id) as GearItemId[];

export function gearItemById(id: GearItemId) {
  return CAREER_GEAR.items.find((i) => i.id === id)!;
}

/** Owned installations, in ladder order. */
export function gearOwned(gear: GearState): GearItemId[] {
  return GEAR_ORDER.filter((id) => gear[id]);
}

/** The next purchasable ladder item (strict order), or null when maxed. */
export function gearNextItem(gear: GearState): (typeof CAREER_GEAR.items)[number] | null {
  for (const item of CAREER_GEAR.items) {
    if (!gear[item.id]) return item;
  }
  return null;
}

/** Total training-efficiency bonus from owned gear (additive shares). */
export function gearTrainingBonus(gear: GearState): number {
  let bonus = 0;
  for (const item of CAREER_GEAR.items) if (gear[item.id]) bonus += item.trainingBonus;
  return bonus;
}

/** Org buff levels from owned gear (existing engine channel, cap 3). */
export function gearBuffLevels(gear: GearState): 0 | 1 | 2 | 3 {
  let levels = 0;
  for (const item of CAREER_GEAR.items) if (gear[item.id]) levels += item.buffLevels;
  return Math.min(3, levels) as 0 | 1 | 2 | 3;
}

/** Per-split upkeep of owned gear (the psychologist retainer bills separately). */
export function gearUpkeepPerSplit(gear: GearState): number {
  let upkeep = 0;
  for (const item of CAREER_GEAR.items) if (gear[item.id]) upkeep += item.upkeepPerSplit;
  return upkeep;
}

/** Highest bootcamp tier the org's reputation unlocks (0 = none yet). */
export function bootcampTierFor(rep: number): 0 | 1 | 2 {
  let tier: 0 | 1 | 2 = 0;
  for (const b of CAREER_GEAR.bootcamp) if (rep >= b.repGate) tier = b.tier as 1 | 2;
  return tier;
}

/** Gear price after the active sponsor's perk discount. */
export function gearPriceFor(baseCost: number, sponsorTier: number | null): number {
  if (!sponsorTier) return baseCost;
  const row = CAREER_SPONSOR.tiers[sponsorTier - 1];
  const pct = row?.gearDiscountPct ?? 0;
  return quantize(baseCost * (1 - pct / 100)) || baseCost;
}

/** Progressive unlock gates (v0.2: gear ladder + the non-gear gates). */
export function unlocksFor(rep: number): {
  peripherals: boolean;
  monitors: boolean;
  pcs: boolean;
  perfCenter: boolean;
  bootcamp1: boolean;
  bootcamp2: boolean;
  psychologist: boolean;
  t2: boolean;
  relocation: boolean;
} {
  const item = (id: GearItemId) => rep >= gearItemById(id).repGate;
  return {
    peripherals: item("peripherals"),
    monitors: item("monitors"),
    pcs: item("pcs"),
    perfCenter: item("perfCenter"),
    bootcamp1: rep >= CAREER_GEAR.bootcamp[0].repGate,
    bootcamp2: rep >= CAREER_GEAR.bootcamp[1].repGate,
    psychologist: rep >= CAREER_GEAR.psychologistRep,
    t2: rep >= CAREER_UNLOCKS.t2InvitationalRep,
    relocation: rep >= CAREER_UNLOCKS.relocationRep,
  };
}

/** Rep gain for one achievement kind; gains halve (rounded up) at the soft cap. */
export function repGainFor(kind: keyof typeof CAREER_REP.gains, currentRep: number): number {
  const base = CAREER_REP.gains[kind];
  if (currentRep >= CAREER_REP.softCapAt) {
    return Math.ceil(base * CAREER_REP.softCapFactor);
  }
  return base;
}

/** The save flag counting the t3 rep awards of one split (CAREER_UNOFFICIAL.t3RepCapPerSplit). */
export function t3RepKeyFor(seasonIndex: number, split: number | null): string {
  return `t3rep:${seasonIndex}:${split ?? 0}`;
}

const TOP4_PLACEMENTS: readonly Placement[] = ["runner_up", "third", "fourth", "top4"];

/**
 * v2.0 (R40 review): the ONE rule for the reputation an event placement
 * pays — finishEvent awards it, the results digest previews it. Null = no
 * rep. The qualifier is Swiss-only (qualifying is all it pays); the t3 win /
 * final share a per-split cap (`t3CapReached`); the regional pays a small
 * floor even for a Swiss exit; a Worlds podium pays `worldsTop4` (the title
 * itself then sets reputation to 100 in finishEvent).
 */
export function eventRepKindFor(
  tier: EventTier,
  placement: Placement,
  opts: { t3CapReached: boolean },
): keyof typeof CAREER_REP.gains | null {
  const top4 = TOP4_PLACEMENTS.includes(placement);
  switch (tier) {
    case "t3":
      if (opts.t3CapReached) return null;
      return placement === "champion" ? "t3Win" : placement === "runner_up" ? "t3Final" : null;
    case "t2":
      return placement === "champion" ? "t2Win" : placement === "runner_up" ? "t2Final" : null;
    case "qualifier":
      return placement !== "swiss_exit" ? "qualifierAdvance" : null;
    case "regional":
      if (placement === "champion") return "regionalWin";
      if (top4) return "regionalTop4";
      return placement !== "swiss_exit" ? "regionalTop8" : "regionalSwissExit";
    case "major":
      if (placement === "champion") return "majorWin";
      return top4 ? "majorTop4" : null;
    case "worlds":
      return placement === "champion" || top4 ? "worldsTop4" : null;
  }
}

/**
 * The rep-loss floor: never below (highest sponsor-tier gate earned −
 * lossFloorSlack), never above the current rep (a floor can't RAISE rep),
 * never below 0.
 */
export function repLossFloor(rep: number, highestTierEarned: number): number {
  const tier = clamp(Math.floor(highestTierEarned), 0, 4);
  const gate = tier >= 1 ? CAREER_SPONSOR.tiers[tier - 1].repGate : 0;
  return Math.min(Math.max(0, rep), Math.max(0, gate - CAREER_REP.lossFloorSlack));
}
