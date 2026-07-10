import { describe, expect, it } from "vitest";
import {
  CAREER_ECONOMY,
  CAREER_GEAR,
  CAREER_LOAN,
  CAREER_POINTS,
  CAREER_REP,
  CAREER_SALARY,
  CAREER_SAVE,
  CAREER_SPONSOR,
} from "@/config/balance";
import type { Placement } from "../types";
import {
  applyPrize,
  bootcampTierFor,
  coachSalaryFor,
  computeSalaryAsk,
  gearBuffLevels,
  gearNextItem,
  gearPriceFor,
  gearTrainingBonus,
  gearUpkeepPerSplit,
  pointsFor,
  prizeFor,
  pushLedger,
  quantize,
  repGainFor,
  repLossFloor,
  repTierOf,
  salaryAskFactors,
  signingBonusFor,
  splitPayday,
  sponsorOffersFor,
  starsFor,
  transferFeeFor,
  unlocksFor,
  type SalaryAskInput,
} from "./economy";
import type { CareerDifficulty, FinanceState, GearState, SponsorState } from "./types";

const QUANTUM = CAREER_ECONOMY.roundQuantum;

function freshGear(overrides: Partial<GearState> = {}): GearState {
  return {
    peripherals: false,
    monitors: false,
    pcs: false,
    perfCenter: false,
    psychologist: false,
    ...overrides,
  };
}

function freshFin(balance: number, overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    balance,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear: freshGear(),
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
    ...overrides,
  };
}

function askInput(overrides: Partial<SalaryAskInput> = {}): SalaryAskInput {
  return {
    overall: 80,
    age: 23,
    potential: 80,
    rep: 100, // comfort line above any OVR here → no rep premium
    role: "starter",
    seasonIndex: 0,
    lengthSeasons: 1,
    difficulty: "normal",
    careerSeed: 42,
    playerId: "test:anchor",
    ...overrides,
  };
}

/** The pure design-curve base at an overall (no age/role/jitter factors). */
function curveAt(overall: number): number {
  return (
    CAREER_SALARY.basePerSplit *
    CAREER_SALARY.growthPerPoint ** (overall - CAREER_SALARY.anchorOverall)
  );
}

describe("quantize / repTierOf", () => {
  it("quantizes toward zero", () => {
    expect(quantize(QUANTUM * 2 - 1)).toBe(QUANTUM);
    expect(quantize(-(QUANTUM * 2 - 1))).toBe(-QUANTUM);
    expect(quantize(QUANTUM)).toBe(QUANTUM);
    expect(quantize(0)).toBe(0);
    expect(quantize(30_100)).toBe(30_100 - (30_100 % QUANTUM));
  });

  it("maps rep to the 0-4 acceptance tier", () => {
    expect(repTierOf(0)).toBe(0);
    expect(repTierOf(19)).toBe(0);
    expect(repTierOf(20)).toBe(1);
    expect(repTierOf(59)).toBe(2);
    expect(repTierOf(80)).toBe(4);
    expect(repTierOf(100)).toBe(4);
  });
});

describe("prizeFor", () => {
  const allPlacements: Placement[] = [
    "champion", "runner_up", "third", "fourth", "top4", "top6", "top8", "swiss_exit",
  ];
  const difficulties: CareerDifficulty[] = ["easy", "normal", "hard"];

  it("regional champion pays 30% of the pool × prizeMult", () => {
    const pool = 0.3 * 40_000;
    expect(prizeFor("regional", "champion", "swiss", "normal")).toBe(quantize(pool));
    expect(prizeFor("regional", "champion", "swiss", "easy")).toBe(
      quantize(pool * CAREER_ECONOMY.prizeMult.easy),
    );
    expect(prizeFor("regional", "champion", "swiss", "hard")).toBe(
      quantize(pool * CAREER_ECONOMY.prizeMult.hard),
    );
  });

  it("every swiss16 placement pays > 0 at every difficulty", () => {
    for (const tier of ["t2", "regional", "major", "worlds"] as const) {
      for (const difficulty of difficulties) {
        for (const placement of allPlacements) {
          expect(prizeFor(tier, placement, "swiss", difficulty)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("prizes are quantized and monotonic down the swiss16 table", () => {
    const order: Placement[] = ["champion", "runner_up", "third", "fourth", "top6", "top8", "swiss_exit"];
    let prev = Infinity;
    for (const placement of order) {
      const prize = prizeFor("major", placement, "swiss", "normal");
      expect(prize % QUANTUM).toBe(0);
      expect(prize).toBeLessThanOrEqual(prev);
      prev = prize;
    }
  });

  it("single8 collapses third/fourth into the top4 row", () => {
    const top4 = prizeFor("t3", "top4", "single", "normal");
    expect(prizeFor("t3", "third", "single", "normal")).toBe(top4);
    expect(prizeFor("t3", "fourth", "single", "normal")).toBe(top4);
  });
});

describe("pointsFor", () => {
  it("regional table, major doubles, worlds/unofficials pay none", () => {
    expect(pointsFor("regional", "champion")).toBe(400);
    expect(pointsFor("major", "champion")).toBe(400 * CAREER_POINTS.majorMultiplier);
    expect(pointsFor("major", "top8")).toBe(120 * CAREER_POINTS.majorMultiplier);
    expect(pointsFor("worlds", "champion")).toBe(0);
    expect(pointsFor("t3", "champion")).toBe(0);
    expect(pointsFor("t2", "champion")).toBe(0);
  });

  it("top4 maps onto the fourth-equivalent row", () => {
    expect(pointsFor("regional", "top4")).toBe(pointsFor("regional", "fourth"));
  });
});

describe("starsFor (v0.2 — 0-5★, half steps, world percentile)", () => {
  // A 112-org-like population spread 70..92.
  const worldRatings = Array.from({ length: 112 }, (_, i) => 70 + (i % 23));

  it("is monotonic in rating and rep tier, bounded 0-5 in half steps", () => {
    let prev = 0;
    for (const rating of [65, 71, 75, 80, 84, 89, 93]) {
      const stars = starsFor({ rating, worldRatings, repTier: 2 });
      expect(stars).toBeGreaterThanOrEqual(prev);
      expect(stars).toBeGreaterThanOrEqual(0);
      expect(stars).toBeLessThanOrEqual(5);
      expect(stars * 2).toBe(Math.round(stars * 2)); // half-star grid
      prev = stars;
    }
    prev = 0;
    for (const repTier of [0, 1, 2, 3, 4]) {
      const stars = starsFor({ rating: 82, worldRatings, repTier });
      expect(stars).toBeGreaterThanOrEqual(prev);
      prev = stars;
    }
  });

  it("the strong always read strong: top of the world + top prestige = 5★", () => {
    expect(starsFor({ rating: 95, worldRatings, repTier: 4 })).toBe(5);
    // Bottom of the world with no standing reads at the floor.
    expect(starsFor({ rating: 60, worldRatings, repTier: 0 })).toBeLessThanOrEqual(1);
  });
});

describe("computeSalaryAsk (v0.2 rescale)", () => {
  it("hits the rescaled curve anchors (±25% around curve × ageFactor)", () => {
    // age 23 → a23_24 factor; no other premiums in askInput().
    const age = CAREER_SALARY.ageFactor.a23_24;
    const ask75 = computeSalaryAsk(askInput({ overall: 75, potential: 75 }));
    expect(ask75).toBeGreaterThanOrEqual(curveAt(75) * age * 0.75);
    expect(ask75).toBeLessThanOrEqual(curveAt(75) * age * 1.25);

    const ask90 = computeSalaryAsk(askInput({ overall: 90, potential: 90 }));
    expect(ask90).toBeGreaterThanOrEqual(curveAt(90) * age * 0.75);
    expect(ask90).toBeLessThanOrEqual(curveAt(90) * age * 1.25);
  });

  it("entry-tier salaries land in the hundreds (the garage-org economy)", () => {
    const entry = computeSalaryAsk(askInput({ overall: 64, potential: 68, age: 19 }));
    expect(entry).toBeLessThan(1_500);
    expect(entry).toBeGreaterThanOrEqual(CAREER_SALARY.minSalary);
  });

  it("subs cost ≈0.4× the starter formula", () => {
    const starter = computeSalaryAsk(askInput({ overall: 82, potential: 82 }));
    const sub = computeSalaryAsk(askInput({ overall: 82, potential: 82, role: "sub" }));
    expect(sub / starter).toBeGreaterThan(CAREER_SALARY.subRoleFactor - 0.05);
    expect(sub / starter).toBeLessThan(CAREER_SALARY.subRoleFactor + 0.05);
  });

  it("a 25yo veteran is cheaper than a 21yo prime at equal OVR", () => {
    const prime = computeSalaryAsk(askInput({ overall: 85, potential: 85, age: 21 }));
    const veteran = computeSalaryAsk(askInput({ overall: 85, potential: 85, age: 25 }));
    expect(veteran).toBeLessThan(prime);
  });

  it("applies the minSalary floor", () => {
    const ask = computeSalaryAsk(
      askInput({ overall: 60, potential: 60, age: 26, role: "sub" }),
    );
    expect(ask).toBe(CAREER_SALARY.minSalary);
  });

  it("premiums raise the ask: potential, low rep, ambition, blockbuster refusal", () => {
    const base = computeSalaryAsk(askInput());
    expect(computeSalaryAsk(askInput({ potential: 92 }))).toBeGreaterThan(base);
    expect(computeSalaryAsk(askInput({ rep: 5 }))).toBeGreaterThan(base);
    expect(computeSalaryAsk(askInput({ ambitious: true }))).toBeGreaterThan(base);
    expect(computeSalaryAsk(askInput({ blockbusterRefused: true }))).toBeGreaterThan(base);
    // longer deals discount the per-split rate
    expect(computeSalaryAsk(askInput({ lengthSeasons: 3 }))).toBeLessThan(base);
    // inflation applies on new deals in later seasons
    expect(computeSalaryAsk(askInput({ seasonIndex: 4 }))).toBeGreaterThan(base);
  });

  it("factor readout reconciles with the ask (rounding + quantization tolerance)", () => {
    const input = askInput({ overall: 86, potential: 91, rep: 30, age: 19, lengthSeasons: 2 });
    const factors = salaryAskFactors(input);
    expect(factors[0].key).toBe("overall");
    const sum = factors.reduce((acc, f) => acc + f.delta, 0);
    expect(Math.abs(sum - computeSalaryAsk(input))).toBeLessThanOrEqual(QUANTUM + factors.length);
  });
});

describe("fees", () => {
  it("transferFeeFor applies the per-split factor with a minimum fee", () => {
    expect(transferFeeFor(500, 1)).toBe(2_500); // floor
    expect(transferFeeFor(20_000, 4)).toBe(quantize(20_000 * 4 * 1.4));
  });

  it("signingBonusFor ≈ 15% of the first season (3 splits)", () => {
    expect(signingBonusFor(10_000)).toBe(4_500);
    expect(signingBonusFor(10_000) % QUANTUM).toBe(0);
  });

  it("coachSalaryFor rides the overall curve at coachFactor", () => {
    const coach = coachSalaryFor(75, 0, "normal");
    const expected = curveAt(75) * CAREER_SALARY.coachFactor;
    expect(coach).toBeGreaterThan(expected * 0.8);
    expect(coach).toBeLessThan(expected * 1.2);
    expect(coach % QUANTUM).toBe(0);
    expect(coachSalaryFor(85, 0, "normal")).toBeGreaterThan(coach);
  });
});

describe("gear ladder (v0.2)", () => {
  it("gearNextItem walks the ladder strictly in order", () => {
    let gear = freshGear();
    const seen: string[] = [];
    for (let i = 0; i < CAREER_GEAR.items.length; i++) {
      const next = gearNextItem(gear)!;
      expect(next).toBeDefined();
      seen.push(next.id);
      gear = { ...gear, [next.id]: true };
    }
    expect(seen).toEqual(CAREER_GEAR.items.map((i) => i.id));
    expect(gearNextItem(gear)).toBeNull();
  });

  it("training bonus, buff levels and upkeep accumulate with ownership", () => {
    const none = freshGear();
    expect(gearTrainingBonus(none)).toBe(0);
    expect(gearBuffLevels(none)).toBe(0);
    expect(gearUpkeepPerSplit(none)).toBe(0);

    const all = freshGear({ peripherals: true, monitors: true, pcs: true, perfCenter: true });
    const totalBonus = CAREER_GEAR.items.reduce((s, i) => s + i.trainingBonus, 0);
    const totalUpkeep = CAREER_GEAR.items.reduce((s, i) => s + i.upkeepPerSplit, 0);
    expect(gearTrainingBonus(all)).toBeCloseTo(totalBonus, 6);
    expect(gearBuffLevels(all)).toBe(Math.min(3, CAREER_GEAR.items.reduce((s, i) => s + i.buffLevels, 0)));
    expect(gearUpkeepPerSplit(all)).toBe(totalUpkeep);
  });

  it("bootcampTierFor follows the rep gates", () => {
    expect(bootcampTierFor(0)).toBe(0);
    expect(bootcampTierFor(CAREER_GEAR.bootcamp[0].repGate)).toBe(1);
    expect(bootcampTierFor(CAREER_GEAR.bootcamp[1].repGate)).toBe(2);
    expect(bootcampTierFor(100)).toBe(2);
  });

  it("gearPriceFor applies the sponsor perk discount", () => {
    expect(gearPriceFor(10_000, null)).toBe(10_000);
    expect(gearPriceFor(10_000, 1)).toBe(10_000); // tier 1 has no discount
    const t4 = CAREER_SPONSOR.tiers[3].gearDiscountPct;
    expect(gearPriceFor(10_000, 4)).toBe(quantize(10_000 * (1 - t4 / 100)));
  });
});

describe("ledger", () => {
  it("appends immutably, applies amounts, caps the tail, keeps ids unique", () => {
    let fin = freshFin(0);
    const before = fin;
    for (let i = 0; i < CAREER_SAVE.ledgerTailCap + 10; i++) {
      fin = pushLedger(fin, { seasonIndex: 0, week: 2, kind: "prize", amount: QUANTUM });
    }
    expect(before.ledger).toHaveLength(0); // untouched input
    expect(fin.ledger).toHaveLength(CAREER_SAVE.ledgerTailCap);
    expect(fin.balance).toBe(QUANTUM * (CAREER_SAVE.ledgerTailCap + 10));
    const ids = new Set(fin.ledger.map((entry) => entry.id));
    expect(ids.size).toBe(fin.ledger.length); // no collisions even after trimming
  });
});

describe("applyPrize", () => {
  it("pays the prize with no loan active", () => {
    const { fin, garnished } = applyPrize(freshFin(0), 12_000, {
      seasonIndex: 0, week: 4, refName: "Test Regional", difficulty: "normal",
    });
    expect(garnished).toBe(0);
    expect(fin.balance).toBe(12_000);
    expect(fin.ledger.map((e) => e.kind)).toEqual(["prize"]);
  });

  it("garnishes at garnishRate while the loan is active", () => {
    const start = freshFin(0, { loan: { remaining: 20_000 }, loanUsed: true });
    const { fin, garnished } = applyPrize(start, 12_000, {
      seasonIndex: 1, week: 8, refName: "Test Major", difficulty: "normal",
    });
    expect(garnished).toBe(quantize(CAREER_LOAN.garnishRate.normal * 12_000));
    expect(fin.balance).toBe(12_000 - garnished);
    expect(fin.ledger.map((e) => e.kind)).toEqual(["prize", "loanGarnish"]);
    expect(fin.loan?.remaining).toBe(20_000 - garnished);
  });

  it("clears the loan exactly at 0", () => {
    const start = freshFin(0, { loan: { remaining: 1_000 }, loanUsed: true });
    const { fin, garnished } = applyPrize(start, 12_000, {
      seasonIndex: 1, week: 8, refName: "Test Major", difficulty: "hard",
    });
    expect(garnished).toBe(1_000);
    expect(fin.loan).toBeNull();
  });
});

describe("splitPayday", () => {
  const sponsor: SponsorState = {
    sponsorId: "test-sponsor",
    tier: 1,
    basePerSplit: 1_500,
    bonus: 750,
    objectiveKind: "enterEvents",
    progress: 0,
    hitThisSplit: false,
    missedCount: 0,
  };

  it("books the funnel in the pinned order (psychologist + gear upkeep via gear)", () => {
    const gear = freshGear({ peripherals: true, monitors: true, pcs: true, psychologist: true });
    const { fin, insolvent, rescued } = splitPayday({
      fin: freshFin(50_000, { gear }),
      squadSalaries: [
        { name: "Alpha", amount: 2_000 },
        { name: "Beta", amount: 1_500 },
      ],
      coachSalary: 1_000,
      sponsor,
      rep: 10,
      seasonIndex: 0,
      week: 10,
      difficulty: "normal",
    });
    expect(insolvent).toBe(false);
    expect(rescued).toBe(false);
    expect(fin.ledger.map((e) => e.kind)).toEqual([
      "sponsorBase", "fanbase", "salary", "salary", "coachSalary", "buff", "upkeep",
    ]);
    const fanbase = quantize(10 * CAREER_ECONOMY.passivePerRepPoint);
    expect(fin.balance).toBe(
      50_000 + 1_500 + fanbase - 2_000 - 1_500 - 1_000 -
        CAREER_GEAR.psychologistPerSplit - gearUpkeepPerSplit(gear),
    );
  });

  it("rescues once via the Emergency Backer, then a second breach is insolvency", () => {
    const first = splitPayday({
      fin: freshFin(1_000),
      squadSalaries: [{ name: "Alpha", amount: 10_000 }],
      coachSalary: null,
      sponsor: null,
      rep: 0,
      seasonIndex: 1,
      week: 10,
      difficulty: "normal",
    });
    expect(first.rescued).toBe(true);
    expect(first.insolvent).toBe(false);
    expect(first.fin.balance).toBe(CAREER_LOAN.rescueTo);
    expect(first.fin.loanUsed).toBe(true);
    const grant = first.fin.ledger.find((e) => e.kind === "loanGrant");
    expect(grant).toBeDefined();
    expect(first.fin.loan?.remaining).toBeCloseTo(grant!.amount * CAREER_LOAN.repayFactor, 6);

    const second = splitPayday({
      fin: first.fin,
      squadSalaries: [{ name: "Alpha", amount: 10_000 }],
      coachSalary: null,
      sponsor: null,
      rep: 0,
      seasonIndex: 1,
      week: 20,
      difficulty: "normal",
    });
    expect(second.rescued).toBe(false);
    expect(second.insolvent).toBe(true);
    expect(second.fin.balance).toBeLessThan(CAREER_LOAN.floor);
  });

  it("does not rescue while above the floor", () => {
    const result = splitPayday({
      fin: freshFin(1_000),
      squadSalaries: [{ name: "Alpha", amount: 5_000 }],
      coachSalary: null,
      sponsor: null,
      rep: 0,
      seasonIndex: 0,
      week: 10,
      difficulty: "normal",
    });
    expect(result.rescued).toBe(false);
    expect(result.insolvent).toBe(false);
    expect(result.fin.balance).toBe(-4_000);
    expect(result.fin.loan).toBeNull();
  });
});

describe("sponsorOffersFor", () => {
  it("gates tiers by reputation and offers the tier below as the safe option", () => {
    const rookie = sponsorOffersFor(0, 0, 7, null, false, "normal");
    expect(rookie.map((o) => o.tier)).toEqual([1]);

    const challenger = sponsorOffersFor(25, 1, 7, 1, false, "normal");
    expect(challenger.map((o) => o.tier)).toEqual([2, 1]);

    const title = sponsorOffersFor(80, 3, 7, 3, false, "normal");
    expect(title.map((o) => o.tier)).toEqual([4, 3]);
  });

  it("patience misses demote a renewal one tier (never below 1, never on first deals)", () => {
    const demoted = sponsorOffersFor(80, 3, 7, 4, true, "normal");
    expect(demoted.map((o) => o.tier)).toEqual([3, 2]);
    const firstDeal = sponsorOffersFor(80, 0, 7, null, true, "normal");
    expect(firstDeal.map((o) => o.tier)).toEqual([4, 3]);
    const floor = sponsorOffersFor(0, 2, 7, 1, true, "normal");
    expect(floor.map((o) => o.tier)).toEqual([1]);
  });

  it("bakes sponsorMult into the signed figures, quantized", () => {
    for (const difficulty of ["easy", "normal", "hard"] as CareerDifficulty[]) {
      const [best] = sponsorOffersFor(80, 2, 11, null, false, difficulty);
      const row = CAREER_SPONSOR.tiers[best.tier - 1];
      expect(best.basePerSplit).toBe(quantize(row.base * CAREER_ECONOMY.sponsorMult[difficulty]));
      expect(best.bonus).toBe(quantize(row.bonus * CAREER_ECONOMY.sponsorMult[difficulty]));
      expect(best.objectiveKind).toBe(row.objective);
      expect(best.sponsorId.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic per (careerSeed, seasonIndex)", () => {
    const a = sponsorOffersFor(50, 2, 123, 2, false, "normal");
    const b = sponsorOffersFor(50, 2, 123, 2, false, "normal");
    expect(a).toEqual(b);
  });
});

describe("unlocks & reputation", () => {
  it("unlocksFor follows the v0.2 gear ladder", () => {
    expect(unlocksFor(0)).toEqual({
      peripherals: false, monitors: false, pcs: false, perfCenter: false,
      bootcamp1: false, bootcamp2: false, psychologist: false,
      t2: false, relocation: false,
    });
    expect(unlocksFor(34)).toEqual({
      peripherals: true, monitors: true, pcs: true, perfCenter: false,
      bootcamp1: true, bootcamp2: false, psychologist: false,
      t2: true, relocation: false,
    });
    expect(unlocksFor(100)).toEqual({
      peripherals: true, monitors: true, pcs: true, perfCenter: true,
      bootcamp1: true, bootcamp2: true, psychologist: true,
      t2: true, relocation: true,
    });
  });

  it("repGainFor halves (rounded up) at the soft cap", () => {
    expect(repGainFor("majorWin", 40)).toBe(CAREER_REP.gains.majorWin);
    expect(repGainFor("majorWin", CAREER_REP.softCapAt)).toBe(
      Math.ceil(CAREER_REP.gains.majorWin * CAREER_REP.softCapFactor),
    );
    expect(repGainFor("regionalTop8", CAREER_REP.softCapAt + 5)).toBe(1);
  });

  it("repLossFloor tracks the highest earned sponsor gate minus slack", () => {
    expect(repLossFloor(60, 3)).toBe(CAREER_SPONSOR.tiers[2].repGate - CAREER_REP.lossFloorSlack);
    expect(repLossFloor(60, 0)).toBe(0);
    expect(repLossFloor(60, 1)).toBe(0); // tier-1 gate 0 → max(0, −slack) = 0
    // a floor can never sit above the current rep
    expect(repLossFloor(40, 3)).toBe(40);
  });
});
