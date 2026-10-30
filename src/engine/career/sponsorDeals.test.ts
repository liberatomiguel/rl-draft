/**
 * Road to Worlds — rc.34 (ECO-04 / ECO-05, docs/SPONSOR-CONTRACT.md §3): the
 * sponsor deals' engine. The contract's acceptance on the pure functions:
 * three dated parts in every deal (s-a), fair goals only from events still
 * ahead (S2), fines proportional, capped and spread, never on Steady or Easy
 * (S3), the offers of one decision within the EV band (s1), and ECO-05's
 * other-income cap (S7). The flows (signing, settling, the handover, a
 * refresh mid-offer) are careerSponsors.test.ts.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_ECONOMY, CAREER_PAYROLL, CAREER_SLOTS, CAREER_SPONSOR } from "@/config/balance";
import { SPONSOR_BRANDS } from "@/data/career/sponsors";
import type { Region } from "../types";
import { firstDayOfWeek, seasonSchedule, splitBoundaryWeeks } from "./calendar";
import { moneyIndex, quantize, quantizeWeekly, sponsorFineDueOf, tallyIncome } from "./economy";
import {
  binomialTail,
  decideByFor,
  expectedValueOf,
  fineFor,
  fineMaxOf,
  fineScheduleFor,
  firstSlotFrom,
  goalChance,
  goalDeadlineOf,
  goalProgressOf,
  levelValueShareOf,
  mondaysBetween,
  offerTierFor,
  otherIncomeRoomOf,
  pickGoal,
  settleDayOf,
  shortfallOf,
  slotOf,
  slotSeason,
  slotSplit,
  SPONSOR_GOAL_CANDIDATES,
  splitStartDayOf,
  splitWeeksOf,
  sponsorDecisionFor,
  sureMoneyOf,
  teamLevelFor,
  tierValuePerWeek,
  upToMoneyOf,
  wordOf,
  cappedSeasonFine,
  seasonGoalModelFor,
  sponsorAccessFor,
  sponsorFreeBootcampsOf,
  type TeamLevel,
} from "./sponsorDeals";
import type { CareerDifficulty, CompactEventResult, SponsorGoalWord } from "./types";
import { buildWorldAtCreation, computeStars } from "./worldSim";

/** A level `m` rating points from every reference team (m > 0: stronger). */
function levelAt(m: number, slots = 2): TeamLevel {
  return { rank: m > 0 ? 1 : 12, teams: 17, slots, majorRank: 8, vs12: m + 3, vs8: m, vs6: m - 1, vs4: m - 2, vs1: m - 5, vsCut: m - 3, vsMajor8: m - 3, vsMajor4: m - 6, vsMajor1: m - 9 };
}

const MOMENTS = [
  { seasonIndex: 0, day: 1 }, // a rollover (season start)
  { seasonIndex: 1, day: firstDayOfWeek(11) }, // the split 1 → 2 boundary
  { seasonIndex: 2, day: firstDayOfWeek(21) }, // 2 → 3
  { seasonIndex: 3, day: firstDayOfWeek(31) }, // the Worlds window
];
const DIFFS: CareerDifficulty[] = ["easy", "normal", "hard"];
const MARGINS = [-12, -6, -3, -1, 0, 2, 5, 9];

describe("rc.34 sponsors — splits and dates", () => {
  it("a decision covers the first split whose events are all ahead, and lapses before them (never past the season)", () => {
    expect(firstSlotFrom({ seasonIndex: 0, day: 1 })).toBe(slotOf(0, 1));
    expect(firstSlotFrom({ seasonIndex: 0, day: firstDayOfWeek(11) })).toBe(slotOf(0, 2));
    expect(firstSlotFrom({ seasonIndex: 0, day: firstDayOfWeek(21) })).toBe(slotOf(0, 3));
    expect(firstSlotFrom({ seasonIndex: 0, day: firstDayOfWeek(31) })).toBe(slotOf(1, 1));
    // Mid-split (a converted older offer): the next split.
    expect(firstSlotFrom({ seasonIndex: 0, day: firstDayOfWeek(15) })).toBe(slotOf(0, 3));
    // The deadline: the Sunday before the split's first regional week; a Worlds-window decision lapses with the season.
    expect(decideByFor({ seasonIndex: 0, day: firstDayOfWeek(11) }, slotOf(0, 2))).toEqual({ seasonIndex: 0, day: 13 * 7 });
    expect(decideByFor({ seasonIndex: 0, day: firstDayOfWeek(31) }, slotOf(1, 1))).toEqual({ seasonIndex: 0, day: 32 * 7 });
    // A split settles on its boundary Monday; the next one's goal is set on its first Monday.
    expect(settleDayOf(slotOf(2, 3))).toEqual({ seasonIndex: 2, day: firstDayOfWeek(31) });
    expect(splitStartDayOf(slotOf(2, 2))).toEqual({ seasonIndex: 2, day: firstDayOfWeek(13) });
    expect(slotSeason(slotOf(4, 3))).toBe(4);
    expect(slotSplit(slotOf(4, 3))).toBe(3);
  });

  it("rc.34 review: a split's weeks are the calendar's (CAREER_CALENDAR), not a copy of them", () => {
    const schedule = seasonSchedule();
    for (const split of [1, 2, 3] as const) {
      const weeks = schedule.filter((w) => w.split === split);
      const regionals = weeks.filter((w) => w.kind === "regional").map((w) => w.week);
      expect(splitWeeksOf(slotOf(0, split))).toEqual({
        start: weeks[0].week,
        firstEvent: regionals[0],
        lastRegional: regionals[regionals.length - 1],
        major: weeks.find((w) => w.kind === "major")!.week,
        settle: splitBoundaryWeeks()[split - 1],
      });
    }
    expect(splitWeeksOf(slotOf(0, 3)).settle).toBe(CAREER_CALENDAR.worldsWindowWeek);
  });

  it("counts the Mondays a deal pays: after the signing day, through its last boundary (across a rollover)", () => {
    expect(mondaysBetween({ seasonIndex: 0, day: firstDayOfWeek(11) }, { seasonIndex: 0, day: firstDayOfWeek(21) })).toBe(10);
    expect(mondaysBetween({ seasonIndex: 0, day: firstDayOfWeek(31) }, { seasonIndex: 1, day: firstDayOfWeek(11) })).toBe(12);
    expect(mondaysBetween({ seasonIndex: 0, day: 1 }, { seasonIndex: 0, day: firstDayOfWeek(31) })).toBe(30);
    expect(mondaysBetween({ seasonIndex: 1, day: 50 }, { seasonIndex: 1, day: 40 })).toBe(0);
  });
});

describe("rc.34 sponsors — the offers of one decision (S1, S4, s1)", () => {
  it("three offers, one per profile, at one tier, three brands, three dated parts each", () => {
    for (const today of MOMENTS) {
      const offers = sponsorDecisionFor({ tier: 2, today, careerSeed: 77, difficulty: "normal", level: levelAt(0) });
      expect(offers.map((o) => o.terms!.profile)).toEqual(["steady", "balanced", "bold"]);
      expect(new Set(offers.map((o) => o.sponsorId)).size).toBe(3);
      for (const o of offers) {
        const t = o.terms!;
        expect(o.tier).toBe(2);
        expect(SPONSOR_BRANDS.find((b) => b.id === o.sponsorId)?.tier).toBe(2);
        // (a) weekly pay, a fixed part (on signing; Bold's at a milestone), a bonus per goal.
        expect(t.weekly).toBeGreaterThan(0);
        expect(t.fixed).toBeGreaterThan(0);
        expect(t.fixedKind).toBe(t.profile === "bold" ? "milestone" : "signing");
        expect(o.bonus).toBeGreaterThan(0);
        // Lengths: two seasons / one season / one split (decision 2-A).
        expect(t.lengthSplits).toBe(CAREER_SPONSOR.profiles[t.profile].lengthSplits);
        expect(t.endsOn).toEqual(settleDayOf(t.firstSlot + t.lengthSplits - 1));
        // Dated: the first goal sits in the first split, its deadline after the offer and before the split settles.
        const goal = t.goals[0];
        expect(goal.slot).toBe(t.firstSlot);
        const by = goalDeadlineOf(goal);
        expect(by.seasonIndex * 1000 + by.day).toBeGreaterThan(today.seasonIndex * 1000 + today.day);
        const settle = settleDayOf(goal.slot);
        expect(by.seasonIndex * 1000 + by.day).toBeLessThanOrEqual(settle.seasonIndex * 1000 + settle.day);
        expect(t.decideBy).toEqual(decideByFor(today, t.firstSlot));
        // The offer's figures are what it books: weekly × Mondays + fixed + the bonuses.
        expect(t.ceiling).toBe(t.weekly * mondaysBetween(today, t.endsOn) + t.fixed + o.bonus * t.lengthSplits);
      }
    }
  });

  it("rc.35 — priced by risk: the most each pays is its profile's share of the tier's value (Bold > Balanced > Steady)", () => {
    const P = CAREER_SPONSOR.profiles;
    expect(P.bold.ceilingOfValue).toBeGreaterThan(P.balanced.ceilingOfValue);
    expect(P.balanced.ceilingOfValue).toBeGreaterThan(P.steady.ceilingOfValue);
    for (const difficulty of DIFFS)
      for (const tier of [1, 2, 3, 4] as const)
        for (const today of MOMENTS)
          for (const m of MARGINS) {
            const offers = sponsorDecisionFor({ tier, today, careerSeed: 5, difficulty, level: levelAt(m) });
            const value = tierValuePerWeek(tier, today.seasonIndex, difficulty) * levelValueShareOf(tier, levelAt(m));
            for (const o of offers) {
              const mondays = mondaysBetween(today, o.terms!.endsOn);
              const per = o.terms!.ceiling / mondays;
              expect(Math.abs(per / (P[o.terms!.profile].ceilingOfValue * value) - 1)).toBeLessThan(0.08);
            }
          }
  });

  it("stability runs Steady > Balanced > Bold: the share of the most a deal pays that is sure (the Stability bar)", () => {
    for (const m of MARGINS) {
      const today = { seasonIndex: 1, day: firstDayOfWeek(11) };
      const [steady, balanced, bold] = sponsorDecisionFor({ tier: 3, today, careerSeed: 9, difficulty: "normal", level: levelAt(m) });
      const sureShare = (o: typeof steady) => sureMoneyOf(o.terms!, today) / upToMoneyOf(o, today);
      expect(sureShare(steady)).toBeGreaterThan(sureShare(balanced));
      expect(sureShare(balanced)).toBeGreaterThan(sureShare(bold));
    }
  });

  it("scaled to the team's level: a Tier 2, 3 or 4 brand pays a side below its level less, never under the floor; T1 in full", () => {
    const L = CAREER_SPONSOR.levelValue;
    expect(levelValueShareOf(1, levelAt(-20))).toBe(1);
    expect(levelValueShareOf(2, levelAt(0))).toBe(1); // vs8 0: a regional top-8 side
    expect(levelValueShareOf(2, levelAt(-20))).toBe(L.floor[2]);
    expect(levelValueShareOf(4, levelAt(6))).toBe(1); // vsMajor4 0: a contender
    expect(levelValueShareOf(4, levelAt(4))).toBeCloseTo(1 + L.perPoint * -2, 6);
    expect(levelValueShareOf(4, levelAt(-20))).toBe(L.floor[4]);
    expect(levelValueShareOf(3, levelAt(3))).toBe(1); // vsMajor8 0: holds its own at a Major
    expect(levelValueShareOf(3, levelAt(-20))).toBe(L.floor[3]);
    const [full] = sponsorDecisionFor({ tier: 4, today: MOMENTS[1], careerSeed: 4, difficulty: "normal", level: levelAt(6) });
    const [king] = sponsorDecisionFor({ tier: 4, today: MOMENTS[1], careerSeed: 4, difficulty: "normal", level: levelAt(-2) });
    expect(full.terms!.levelShare).toBeUndefined();
    expect(king.terms!.levelShare).toBe(levelValueShareOf(4, levelAt(-2)));
    expect(king.terms!.ev).toBeLessThan(full.terms!.ev);
  });

  it("the tier's value is M7's money on the index at offer time (difficulty × sponsorMult)", () => {
    const row = CAREER_SPONSOR.tiers[1];
    const season = row.base * 4 + row.bonus * 3 * CAREER_SPONSOR.valueBonusShare;
    expect(tierValuePerWeek(2, 3, "hard")).toBeCloseTo((season * CAREER_ECONOMY.sponsorMult.hard * moneyIndex(3, "sponsor")) / 32, 6);
  });

  it("the tier: the best the reputation allows, one lower after a Steady deal ran out of patience", () => {
    expect(offerTierFor(10, false)).toBe(1);
    expect(offerTierFor(60, false)).toBe(3);
    expect(offerTierFor(60, true)).toBe(2);
    expect(offerTierFor(5, true)).toBe(1);
  });
});

describe("rc.35 — pay runs Bold ≥ Balanced ≥ Steady, goals the other way, in every decision", () => {
  it("7 regions × 3 difficulties × ratings 40–100 × 4 tiers × the decision days: weekly and per-Monday ceiling ordered, Bold's goal the hardest", () => {
    const seed = 34_301;
    const world = computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: "normal" });
    const orgs = Object.values(world.orgs).map((o) => ({ region: o.region, rating: o.rating ?? 70 + o.prestige * 6 }));
    const regions = Object.keys(CAREER_SLOTS.major) as Region[];
    // A rollover, the three boundaries, a day inside each split (a converted older offer) and the Worlds week.
    const days = [1, ...splitBoundaryWeeks().map(firstDayOfWeek), firstDayOfWeek(5), firstDayOfWeek(15), firstDayOfWeek(26), firstDayOfWeek(32)];
    let decisions = 0;
    let unordered = 0;
    let goalsUnordered = 0;
    for (const region of regions)
      for (const difficulty of DIFFS)
        for (let rating = 40; rating <= 100; rating += 2) {
          const level = teamLevelFor({ region, userRating: rating, difficulty, orgs });
          for (const tier of [1, 2, 3, 4] as const)
            for (const seasonIndex of [0, 3])
              for (const day of days) {
                const today = { seasonIndex, day };
                const offers = sponsorDecisionFor({ tier, today, careerSeed: seed, difficulty, level });
                const [steady, balanced, bold] = offers.map((o) => o.terms!.weekly);
                const [cs, cb, cx] = offers.map((o) => o.terms!.ceiling / Math.max(1, mondaysBetween(today, o.terms!.endsOn)));
                decisions += 1;
                if (steady > balanced || balanced > bold || cs >= cb || cb >= cx) unordered += 1;
                const [gs, gb, gx] = offers.map((o) => o.terms!.goals[0].chance);
                if (gx > gb || gb > gs) goalsUnordered += 1;
              }
        }
    expect(decisions).toBeGreaterThan(30_000);
    expect(unordered).toBe(0);
    expect(goalsUnordered).toBe(0);
  });

  it("the weekly pay is the profile's share of its ceiling, whatever the goal", () => {
    const P = CAREER_SPONSOR.profiles;
    for (const m of MARGINS) {
      const offers = sponsorDecisionFor({ tier: 2, today: MOMENTS[1], careerSeed: 5, difficulty: "normal", level: levelAt(m) });
      const value = tierValuePerWeek(2, MOMENTS[1].seasonIndex, "normal") * levelValueShareOf(2, levelAt(m));
      for (const o of offers) {
        const t = o.terms!;
        expect(t.weekly).toBe(Math.max(CAREER_PAYROLL.weeklyQuantum, quantizeWeekly(P[t.profile].ceilingOfValue * P[t.profile].weeklyOfCeiling * value)));
      }
    }
  });
});

describe("rc.34 sponsors — goals (S2)", () => {
  const WORDS: SponsorGoalWord[] = ["likely", "even", "stretch"];

  it("never an unreachable goal: every pick sits at or above the Stretch floor, at every level and word", () => {
    for (const m of [-20, -12, -6, -3, 0, 3, 6, 12, 20])
      for (const word of WORDS) {
        const g = pickGoal(word, levelAt(m), slotOf(0, 2));
        expect(g.chance).toBeGreaterThanOrEqual(CAREER_SPONSOR.wordMin.stretch);
        expect(g.word).toBe(wordOf(g.chance));
        expect(g.slot).toBe(slotOf(0, 2));
      }
  });

  it("scaled to the team: a stronger side gets a harder goal at the same word", () => {
    const weak = pickGoal("even", levelAt(-1), 0);
    const strong = pickGoal("even", levelAt(6), 0);
    const hardness = (g: typeof weak) =>
      goalChance(g, levelAt(-1)); // the same goal's chance for the weak side
    expect(hardness(strong)).toBeLessThan(hardness(weak));
    // Where a word's band has a goal at this level, the pick shows that word.
    for (const m of MARGINS) {
      const level = levelAt(m);
      const words = new Set(
        SPONSOR_GOAL_CANDIDATES.map((c) => goalChance(c, level))
          .filter((p) => p >= CAREER_SPONSOR.wordMin.stretch)
          .map(wordOf),
      );
      for (const word of WORDS) if (words.has(word)) expect(pickGoal(word, level, 0).word).toBe(word);
    }
  });

  it("reads progress off the split's results: the shortfall scales a miss (a top 8 in one of two is half)", () => {
    const res = (tier: CompactEventResult["tier"], userPlacement: CompactEventResult["userPlacement"], split: 1 | 2 | 3 = 2, week = 14): CompactEventResult =>
      ({ eventId: `e:${tier}:${week}`, tier, seasonIndex: 1, week, split, name: "x", rows: [], championRef: "x", userPlacement, fieldQuality: 1 });
    const slot = slotOf(1, 2);
    const results = [res("qualifier", "top8"), res("regional", "top8"), res("regional", "swiss_exit", 2, 16), res("regional", "champion", 1, 4)];
    const two8 = { slot, kind: "regionalFinish" as const, count: 2, place: 8 };
    const p = goalProgressOf(two8, { results });
    expect(p).toEqual({ done: 1, target: 2, hit: false });
    expect(shortfallOf(p)).toBe(0.5);
    expect(goalProgressOf({ slot, kind: "regionalReach", count: 2 }, { results }).hit).toBe(true);
    expect(goalProgressOf({ slot, kind: "enterEvents", count: 3 }, { results }).hit).toBe(true);
    // The Major: the announced field reaches it the day it is announced.
    expect(goalProgressOf({ slot, kind: "majorQualify", count: 1 }, { results }).hit).toBe(false);
    expect(goalProgressOf({ slot, kind: "majorQualify", count: 1 }, { results, inMajorField: true }).hit).toBe(true);
    // Another split's (or season's) results never count.
    expect(goalProgressOf({ slot: slotOf(1, 1), kind: "regionalFinish", count: 1, place: 1 }, { results }).hit).toBe(true);
    expect(goalProgressOf({ slot: slotOf(0, 2), kind: "regionalFinish", count: 1, place: 8 }, { results }).done).toBe(0);
  });

  it("the level: margins over the region's 12th, 8th, 4th and best orgs, its Major cut and the Major field (with the difficulty edge)", () => {
    const orgs = [
      ...Array.from({ length: 16 }, (_, i) => ({ region: "EU" as const, rating: 90 - i })),
      ...Array.from({ length: 16 }, (_, i) => ({ region: "NA" as const, rating: 88 - i })),
    ];
    const lv = teamLevelFor({ region: "EU", userRating: 84, difficulty: "normal", orgs });
    expect(lv.rank).toBe(7);
    expect(lv.vs8).toBe(84 - 83);
    expect(lv.vs6).toBe(84 - 85);
    expect(lv.vs4).toBe(84 - 87);
    expect(lv.vs1).toBe(84 - 90);
    expect(lv.vs12).toBe(84 - 79);
    expect(lv.vsCut).toBe(84 - 87); // EU's 4 Major seats
    const hard = teamLevelFor({ region: "EU", userRating: 84, difficulty: "hard", orgs });
    expect(hard.vs8).toBeCloseTo(lv.vs8 + CAREER_SPONSOR.levelEdge.hard, 6);
  });

  it("the K-of-3 tail is the binomial one", () => {
    expect(binomialTail(3, 0, 0.3)).toBe(1);
    expect(binomialTail(3, 3, 0.5)).toBeCloseTo(0.125, 6);
    expect(binomialTail(3, 2, 0.5)).toBeCloseTo(0.5, 6);
    expect(binomialTail(3, 4, 0.9)).toBe(0);
  });
});

describe("rc.34 sponsors — fines (S3, decision 1-A)", () => {
  it("never on a Steady deal, never on Easy: no share, no cap, a miss costs nothing", () => {
    for (const difficulty of DIFFS) {
      const offers = sponsorDecisionFor({ tier: 2, today: MOMENTS[1], careerSeed: 3, difficulty, level: levelAt(0) });
      for (const o of offers) {
        const fines = o.terms!.profile !== "steady" && difficulty !== "easy";
        expect(o.terms!.fineShare > 0).toBe(fines);
        expect(fineMaxOf(o.terms!, o.bonus) > 0).toBe(fines);
        expect(fineFor(o.terms!, o.bonus, 1) > 0).toBe(fines);
      }
    }
  });

  it("proportional to the shortfall, capped at the deal's weekly pay × capWeeks, announced on the offer", () => {
    const [, balanced, bold] = sponsorDecisionFor({ tier: 3, today: MOMENTS[1], careerSeed: 3, difficulty: "normal", level: levelAt(1) });
    for (const o of [balanced, bold]) {
      const t = o.terms!;
      expect(t.fineShare).toBe(CAREER_SPONSOR.profiles[t.profile].fineShare);
      // rc.35: the cap is per profile (Balanced 1 week, Bold 2).
      expect(t.fineCap).toBe(quantize(CAREER_SPONSOR.profiles[t.profile].fineCapWeeks * t.weekly));
      const full = fineFor(t, o.bonus, 1);
      expect(full).toBe(quantize(Math.min(t.fineCap, t.fineShare * o.bonus)));
      expect(fineFor(t, o.bonus, 0.5)).toBeLessThanOrEqual(full);
      expect(fineFor(t, o.bonus, 0.5)).toBe(quantize(Math.min(t.fineCap, t.fineShare * o.bonus * 0.5)));
      expect(fineFor(t, o.bonus, 0)).toBe(0);
      expect(fineMaxOf(t, o.bonus)).toBe(full);
    }
  });

  it("spread over the next Mondays in whole instalments that add up to the fine, never a lump sum", () => {
    for (const fine of [50, 650, 1_200, 4_850]) {
      const sched = fineScheduleFor("voltway", fine)!;
      let left = sched;
      let paid = 0;
      let mondays = 0;
      while (left.remaining > 0) {
        const due = sponsorFineDueOf([left]);
        paid += due;
        mondays += 1;
        left = { ...left, remaining: left.remaining - due };
      }
      expect(paid).toBe(fine);
      expect(mondays).toBeLessThanOrEqual(CAREER_SPONSOR.fines.spreadMondays);
      if (fine >= CAREER_SPONSOR.fines.spreadMondays * CAREER_ECONOMY.roundQuantum) expect(mondays).toBeGreaterThan(1);
    }
    expect(fineScheduleFor("voltway", 0)).toBeNull();
  });

  it("the expected value counts the fines a miss costs and a milestone at the chance any goal is reached", () => {
    const ev = expectedValueOf({ weekly: 100, mondays: 10, fixed: 500, fixedKind: "milestone", bonus: 1_000, goals: 1, chance: 0.25, fineMax: 200 });
    expect(ev).toBeCloseTo(1_000 + 500 * 0.25 + 0.25 * 1_000 - 0.75 * 200, 6);
  });
});

describe("rc.34 ECO-05 — other income, capped (S7, decision 6-B)", () => {
  it("the tally: earned income is every positive line but loans; other income is a positive insert, counted per split", () => {
    let t = tallyIncome(undefined, { seasonIndex: 1, week: 3, kind: "prize", amount: 1_000 });
    t = tallyIncome(t, { seasonIndex: 1, week: 4, kind: "loanGrant", amount: 5_000 });
    t = tallyIncome(t, { seasonIndex: 1, week: 5, kind: "insert", amount: 600 });
    t = tallyIncome(t, { seasonIndex: 1, week: 6, kind: "insert", amount: -300 });
    expect(t).toEqual({ s: 1, earned: 1_600, other: 600, period: 1, otherCount: 1 });
    t = tallyIncome(t, { seasonIndex: 1, week: 12, kind: "insert", amount: 400 });
    expect(t).toMatchObject({ period: 2, otherCount: 1, other: 1_000 });
    t = tallyIncome(t, { seasonIndex: 2, week: 1, kind: "fanbase", amount: 100 });
    expect(t).toEqual({ s: 2, earned: 100, other: 0, period: 1, otherCount: 0 });
  });

  it("the cap: a count a split and a share of the season's earned income — at least its guaranteed income", () => {
    const O = CAREER_SPONSOR.otherIncome;
    const fresh = otherIncomeRoomOf({ tally: undefined, seasonIndex: 1, week: 4, guaranteedWeekly: 1_000 });
    expect(fresh.count).toBe(O.perSplitCap);
    expect(fresh.cap).toBe(quantize(O.seasonShare * 1_000 * CAREER_PAYROLL.weeksPerSeason));
    const used = otherIncomeRoomOf({
      tally: { s: 1, earned: 500_000, other: 9_000, period: 1, otherCount: O.perSplitCap },
      seasonIndex: 1,
      week: 8,
      guaranteedWeekly: 1_000,
    });
    expect(used.count).toBe(0);
    expect(used.cap).toBe(quantize(O.seasonShare * 500_000));
    expect(used.amount).toBe(used.cap - 9_000);
    // A new split resets the count, a new season the money.
    expect(otherIncomeRoomOf({ tally: { s: 1, earned: 0, other: 0, period: 1, otherCount: 2 }, seasonIndex: 1, week: 12, guaranteedWeekly: 0 }).count).toBe(O.perSplitCap);
    expect(otherIncomeRoomOf({ tally: { s: 1, earned: 9e5, other: 9e4, period: 3, otherCount: 2 }, seasonIndex: 2, week: 2, guaranteedWeekly: 0 }).taken).toBe(0);
  });
});

describe("rc.35 front S — the ladder's sponsor access, the season fine cap, the season goal", () => {
  it("early: two offers, no Bold, tier ≤ 2; better: three with Bold; global: the most money and bootcamps", () => {
    const early = sponsorAccessFor(0);
    expect(early).toMatchObject({ offers: 2, boldAllowed: false, tierCap: 2, global: false });
    expect(sponsorAccessFor(2)).toMatchObject({ offers: 3, boldAllowed: true, global: false });
    const global = sponsorAccessFor(4);
    expect(global).toMatchObject({ offers: 3, boldAllowed: true, tierCap: 4, global: true });
    const two = sponsorDecisionFor({ tier: 3, today: MOMENTS[1], careerSeed: 3, difficulty: "normal", level: levelAt(0), access: early });
    expect(two.map((o) => o.terms!.profile)).toEqual(["steady", "balanced"]);
    expect(two.every((o) => o.tier === 2)).toBe(true);
    const plain = sponsorDecisionFor({ tier: 4, today: MOMENTS[1], careerSeed: 3, difficulty: "normal", level: levelAt(6), access: sponsorAccessFor(3) });
    const top = sponsorDecisionFor({ tier: 4, today: MOMENTS[1], careerSeed: 3, difficulty: "normal", level: levelAt(6), access: global });
    expect(top[2].terms!.ceiling).toBeGreaterThan(plain[2].terms!.ceiling);
    expect(top[0].terms!.global).toBe(true);
    expect(sponsorFreeBootcampsOf(top[0])).toBe(CAREER_SPONSOR.access.globalBootcamps);
    expect(sponsorFreeBootcampsOf(plain[0])).toBe(CAREER_SPONSOR.tiers[plain[0].tier - 1].freeBootcampsPerSeason);
  });

  it("a season's fines never pass seasonCapWeeks weeks of the deal's weekly pay", () => {
    const terms = { weekly: 10_000 };
    const cap = quantize(CAREER_SPONSOR.fines.seasonCapWeeks * 10_000);
    const a = cappedSeasonFine(terms, 1, cap - 2_500);
    expect(a.fine).toBe(cap - 2_500);
    const b = cappedSeasonFine({ ...terms, finedSeason: a.finedSeason }, 1, 10_000);
    expect(b.fine).toBe(2_500);
    expect(cappedSeasonFine({ ...terms, finedSeason: b.finedSeason }, 1, 5_000).fine).toBe(0);
    // A new season starts a new tally.
    expect(cappedSeasonFine({ ...terms, finedSeason: b.finedSeason }, 2, 5_000).fine).toBe(5_000);
  });

  it("the season target is never harder than a Balanced goal, its stretch a Bold one's", () => {
    for (const m of [-12, -6, -3, 0, 3, 6, 12]) {
      const level = levelAt(m);
      const { target, stretch } = seasonGoalModelFor(level, 1);
      const balanced = pickGoal("even", level, slotOf(1, 1));
      expect(target.chance).toBeGreaterThanOrEqual(balanced.chance - 1e-9);
      expect(stretch.chance).toBeLessThanOrEqual(target.chance + 1e-9);
      expect(stretch.chance).toBeGreaterThanOrEqual(CAREER_SPONSOR.wordMin.stretch);
    }
  });
});
