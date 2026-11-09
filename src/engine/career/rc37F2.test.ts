/**
 * Road to Worlds — rc.37 F2 (finances and crisis), the engine half:
 *
 *  - package 1, late revenue: from the 4th season (season index 3) a Major's
 *    pool ×1.15, Worlds' ×1.25, a NEW tier 3–4 sponsor quote ×1.10; S1–S3
 *    and every other tier pay exactly as before; the distribution by
 *    placement still follows the table; a signed deal keeps its terms.
 *  - package 2, the bank's offer before the floor (economy.creditOfferFor).
 *  - package 4, the one-off spend alert (economy.spendRiskFor).
 *
 * Every number reads its balance.ts key; the "off" side of a comparison
 * switches CAREER_LATE_REVENUE off for the call.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_BANK,
  CAREER_CREDIT_OFFER,
  CAREER_ECONOMY,
  CAREER_LATE_REVENUE,
  CAREER_PRIZES,
  CAREER_SPEND_ALERT,
} from "@/config/balance";
import type { Placement } from "../types";
import {
  bankLoanLimitFor,
  bankLoanTerms,
  bankMinAmountFor,
  creditOfferFor,
  latePrizeMultFor,
  lateSponsorMultFor,
  prizePoolPaidFor,
  prizeScheduleFor,
  spendRiskFor,
  weeklyStatement,
} from "./economy";
import { quoteDeal, tierValuePerWeek } from "./sponsorDeals";
import type { CareerDifficulty, EventTier, FinanceState, GearState, SponsorState } from "./types";

const DIFFS: CareerDifficulty[] = ["easy", "normal", "hard"];
const S3 = CAREER_LATE_REVENUE.fromSeasonIndex - 1; // the 3rd season (index 2)
const S4 = CAREER_LATE_REVENUE.fromSeasonIndex; // the 4th season (index 3)

/** Run `fn` with the late revenue switched off (its first season pushed out of reach). */
function withoutLateRevenue<T>(fn: () => T): T {
  const keys = CAREER_LATE_REVENUE as unknown as { fromSeasonIndex: number };
  const saved = keys.fromSeasonIndex;
  keys.fromSeasonIndex = Number.POSITIVE_INFINITY;
  try {
    return fn();
  } finally {
    keys.fromSeasonIndex = saved;
  }
}

const PLACEMENT_COUNT: Partial<Record<Placement, number>> = {
  champion: 1,
  runner_up: 1,
  third: 1,
  fourth: 1,
  top6: 2,
  top8: 2,
  swiss_exit: 8,
};

function gear(): GearState {
  return { peripherals: false, monitors: false, pcs: false, perfCenter: false, psychologist: false };
}

function fin(balance: number, overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    balance,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear: gear(),
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
    ...overrides,
  };
}

// ===========================================================================
// Package 1 — late revenue
// ===========================================================================

describe("rc.37 F2 — late revenue from the 4th season", () => {
  it("the factor is explicit: Major ×1.15 and Worlds ×1.25 from season index 3, 1 for every other tier and before", () => {
    expect(CAREER_LATE_REVENUE.fromSeasonIndex).toBe(3);
    expect(latePrizeMultFor("major", S4)).toBe(1.15);
    expect(latePrizeMultFor("worlds", S4)).toBe(1.25);
    expect(latePrizeMultFor("major", S3)).toBe(1);
    expect(latePrizeMultFor("worlds", S3)).toBe(1);
    for (const tier of ["t3", "t2", "qualifier", "regional"] as EventTier[]) expect(latePrizeMultFor(tier, 9)).toBe(1);
    expect(lateSponsorMultFor(3, S4)).toBe(1.1);
    expect(lateSponsorMultFor(4, S4)).toBe(1.1);
    expect(lateSponsorMultFor(1, S4)).toBe(1);
    expect(lateSponsorMultFor(2, S4)).toBe(1);
    expect(lateSponsorMultFor(4, S3)).toBe(1);
  });

  it("S1–S3 pay exactly the rc.36 tables; every tier but Major and Worlds stays the same in S4 and after", () => {
    for (const difficulty of DIFFS) {
      for (const tier of ["t3", "t2", "qualifier", "regional", "major", "worlds"] as EventTier[]) {
        const format = tier === "qualifier" ? "swissOnly" : tier === "t3" || tier === "t2" ? "single" : "swiss";
        for (let s = 0; s <= S3; s++) {
          expect(prizeScheduleFor(tier, format, difficulty, s)).toEqual(
            withoutLateRevenue(() => prizeScheduleFor(tier, format, difficulty, s)),
          );
        }
        if (tier === "major" || tier === "worlds") continue;
        for (const s of [S4, S4 + 2]) {
          expect(prizeScheduleFor(tier, format, difficulty, s)).toEqual(
            withoutLateRevenue(() => prizeScheduleFor(tier, format, difficulty, s)),
          );
        }
      }
    }
  });

  it("S4: the Major pool is ×1.15 and the Worlds pool ×1.25 of what it would be (within one pool step)", () => {
    for (const difficulty of DIFFS) {
      for (const tier of ["major", "worlds"] as const) {
        const on = prizePoolPaidFor(tier, "swiss", difficulty, S4);
        const off = withoutLateRevenue(() => prizePoolPaidFor(tier, "swiss", difficulty, S4));
        const mult = CAREER_LATE_REVENUE.prizePoolMult[tier]!;
        const step = CAREER_PRIZES.poolQuantum[tier];
        expect(Math.abs(on - off * mult)).toBeLessThanOrEqual(step);
        // and it keeps paying more every season after (the money index on top of the factor)
        expect(prizePoolPaidFor(tier, "swiss", difficulty, S4 + 1)).toBeGreaterThan(on);
      }
    }
  });

  it("S3 → S4 (the distribution by placement): every place is paid more, each place's share stays on the table", () => {
    const table = CAREER_PRIZES.swiss16Pct;
    for (const difficulty of DIFFS) {
      for (const tier of ["major", "worlds"] as const) {
        const s3 = prizeScheduleFor(tier, "swiss", difficulty, S3);
        const s4 = prizeScheduleFor(tier, "swiss", difficulty, S4);
        const pool3 = prizePoolPaidFor(tier, "swiss", difficulty, S3);
        const pool4 = prizePoolPaidFor(tier, "swiss", difficulty, S4);
        // The pool's step: the money index × the late factor (rounding within one pool step each side).
        const expected = pool3 * CAREER_ECONOMY.indexPerSeason * CAREER_LATE_REVENUE.prizePoolMult[tier]!;
        expect(Math.abs(pool4 - expected)).toBeLessThanOrEqual(2 * CAREER_PRIZES.poolQuantum[tier]);
        const step = CAREER_PRIZES.payoutQuantum[tier];
        for (const placement of Object.keys(PLACEMENT_COUNT) as Placement[]) {
          expect(s4[placement], `${tier} ${difficulty} ${placement}`).toBeGreaterThan(s3[placement]);
          // Each place is its table percent of the pool, give or take the payout step's rounding (the
          // champion absorbs the other 15 places' rounding).
          const target = (pool4 * table[placement]) / 100;
          const slack = placement === "champion" ? 16 * step : step;
          expect(Math.abs(s4[placement] - target), `${tier} ${difficulty} ${placement}`).toBeLessThanOrEqual(slack);
        }
        // The pool is paid exactly (the champion reconciles the rounding).
        const paid = (Object.entries(PLACEMENT_COUNT) as [Placement, number][]).reduce((n, [p, c]) => n + s4[p] * c, 0);
        expect(paid).toBe(pool4);
      }
    }
  });

  it("a new tier 3–4 sponsor quote is ×1.10 from S4 (tiers 1–2 and S3 untouched)", () => {
    for (const difficulty of DIFFS) {
      for (const tier of [1, 2, 3, 4] as const) {
        const on = tierValuePerWeek(tier, S4, difficulty);
        const off = withoutLateRevenue(() => tierValuePerWeek(tier, S4, difficulty));
        expect(on / off).toBeCloseTo(tier >= 3 ? 1.1 : 1, 10);
        expect(tierValuePerWeek(tier, S3, difficulty)).toBe(withoutLateRevenue(() => tierValuePerWeek(tier, S3, difficulty)));
      }
      // The offer's own weekly pay follows (on the weekly quantum).
      const quote = (t: 3 | 4) => quoteDeal({ profile: "balanced", tier: t, seasonIndex: S4, difficulty, mondays: 30, goals: 3 });
      for (const t of [3, 4] as const) {
        const on = quote(t).weekly;
        const off = withoutLateRevenue(() => quote(t).weekly);
        // Both sides truncate to the weekly quantum ($10): at most ~2 quanta apart from an exact ×1.1.
        expect(Math.abs(on - off * 1.1)).toBeLessThanOrEqual(25);
      }
    }
  });

  it("a deal signed before S4 keeps its terms: the Monday pays the stored weekly in S4", () => {
    const signed: SponsorState = {
      sponsorId: "turbomate",
      tier: 4,
      basePerSplit: 0,
      bonus: 0,
      objectiveKind: "enterEvents",
      progress: 0,
      hitThisSplit: false,
      missedCount: 0,
      terms: {
        profile: "steady",
        lengthSplits: 3,
        firstSlot: 7,
        endsOn: { seasonIndex: S4, day: 200 },
        weekly: 1_230,
        fixedKind: "signing",
        fixed: 0,
        fineShare: 0,
        fineCap: 0,
        word: "likely",
        goals: [],
        ev: 0,
        ceiling: 0,
        pricedSeason: S3,
        offeredOn: { seasonIndex: S3, day: 150 },
        decideBy: { seasonIndex: S3, day: 160 },
      },
    } as unknown as SponsorState;
    const statement = weeklyStatement({ squadSalaries: [], coachSalary: null, sponsor: signed, rep: 0, gear: gear(), seasonIndex: S4 });
    expect(statement.sponsorBase).toBe(1_230);
  });
});

// ===========================================================================
// Package 2 — the bank's offer before the floor
// ===========================================================================

describe("rc.37 F2 — the bank's voluntary loan, sized to the squeeze", () => {
  const q = CAREER_ECONOMY.roundQuantum;

  it("covers the horizon at this pace with the smallest principal on the quantum (its instalments counted)", () => {
    const books = fin(2_000);
    const offer = creditOfferFor({ fin: books, rep: 45, seasonIndex: 0, weeklyNet: -1_000 })!;
    expect(offer).not.toBeNull();
    expect(offer.capped).toBe(false);
    expect(offer.principal % q).toBe(0);
    expect(offer.principal).toBeGreaterThanOrEqual(bankMinAmountFor(0));
    expect(offer.principal).toBeLessThanOrEqual(bankLoanLimitFor(45, 0));
    expect(offer.net).toBe(offer.principal);
    const terms = bankLoanTerms(offer.principal);
    expect(offer.total).toBe(terms.total);
    expect(offer.weeklyPayment).toBe(terms.weeklyPayment);
    expect(offer.termWeeks).toBe(CAREER_BANK.termWeeks);
    expect(offer.coversMondays).toBeGreaterThanOrEqual(CAREER_CREDIT_OFFER.coverWeeks);
    // One quantum less no longer covers the horizon (the smallest principal that does).
    let b = books.balance + offer.principal - q;
    let owed = bankLoanTerms(offer.principal - q).total;
    let covered = 0;
    for (let k = 1; k <= CAREER_CREDIT_OFFER.coverWeeks; k++) {
      const pay = Math.min(owed, bankLoanTerms(offer.principal - q).weeklyPayment);
      owed -= pay;
      b += -1_000 - pay;
      if (b < 0) break;
      covered = k;
    }
    expect(covered).toBeLessThan(CAREER_CREDIT_OFFER.coverWeeks);
  });

  it("a need beyond the reputation limit offers the limit, marked capped", () => {
    const offer = creditOfferFor({ fin: fin(2_000), rep: 10, seasonIndex: 0, weeklyNet: -1_000 })!;
    expect(offer.capped).toBe(true);
    expect(offer.principal).toBe(bankLoanLimitFor(10, 0));
    expect(offer.coversMondays).toBeLessThan(CAREER_CREDIT_OFFER.coverWeeks);
  });

  it("no offer when the bank would refuse (a loan running, the emergency loan owed) or nothing is needed", () => {
    const burn = { rep: 45, seasonIndex: 0, weeklyNet: -1_000 };
    const bankLoan = { principal: 5_000, remaining: 3_000, weeklyPayment: 350, takenSeason: 0, takenWeek: 1 };
    expect(creditOfferFor({ ...burn, fin: fin(2_000, { bankLoan }) })).toBeNull();
    expect(creditOfferFor({ ...burn, fin: fin(2_000, { loan: { remaining: 4_000 } }) })).toBeNull();
    expect(creditOfferFor({ ...burn, fin: fin(50_000) })).toBeNull(); // 8 Mondays covered already
    expect(creditOfferFor({ fin: fin(500), rep: 45, seasonIndex: 0, weeklyNet: 200 })).toBeNull();
  });
});

// ===========================================================================
// Package 4 — the one-off spend alert
// ===========================================================================

describe("rc.37 F2 — a one-off spend that brings the floor within reach", () => {
  const within = CAREER_SPEND_ALERT.withinMondays;
  const base = { weeklyNet: -1_000, floor: -8_000 };

  it("alerts when the spend moves the breach within reach, not when it stays far", () => {
    const risky = spendRiskFor({ ...base, balance: 10_000, upfront: 15_000 });
    expect(risky.mondaysBefore).toBe(19);
    expect(risky.mondaysAfter).toBe(4);
    expect(risky.mondaysAfter!).toBeLessThanOrEqual(within);
    expect(risky.alert).toBe(true);
    expect(spendRiskFor({ ...base, balance: 10_000, upfront: 5_000 }).alert).toBe(false);
    expect(spendRiskFor({ ...base, balance: 10_000, upfront: 0 }).alert).toBe(false);
  });

  it("does not repeat what the runway warnings already say (the breach was within reach before)", () => {
    const already = spendRiskFor({ ...base, balance: -6_000, upfront: 1_000 });
    expect(already.mondaysBefore).toBeLessThanOrEqual(within);
    expect(already.alert).toBe(false);
  });

  it("books left below the floor after the week's income breach next Monday, whatever the net's sign", () => {
    const below = spendRiskFor({ balance: -7_000, weeklyNet: 500, floor: -8_000, upfront: 2_000 });
    expect(below.mondaysBefore).toBeNull();
    expect(below.mondaysAfter).toBe(1);
    expect(below.alert).toBe(true);
  });

  it("a spend that adds a weekly cost is read at the new net and the new floor", () => {
    const signing = spendRiskFor({ ...base, balance: 4_000, upfront: 1_000, weeklyChange: -2_000, floorAfter: -24_000 });
    expect(signing.mondaysAfter).toBe(Math.floor((3_000 + 24_000) / 3_000) + 1);
  });
});
