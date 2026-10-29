/**
 * Road to Worlds — rc.32 (Etapa 2b part 2, front A): the economy package, as
 * PROVISIONAL DEFAULTS (ECONOMY-CONTRACT §6, 30/10 — R50–R54). Every rule has
 * its own balance.ts key, and each key has at least one switch-back test:
 * flipping it restores rc.31's behaviour exactly.
 *
 *  - M1 (1-A): one season money index for every stream, the flat ones too.
 *  - M3 (3-A): the founding partner.
 *  - M4 (4-B): warnings with the projected breach, the Backer in weeks of
 *    payroll, the lock on runway-shortening commitments, and what ends a
 *    career by difficulty (restructurings in between).
 *  - M5 (6-B): prize tables that pay 100 %.
 *  - M6 (5-B): the comfort cap and the players' share of podium prizes.
 *  - M8 (8-B): "List for sale" and the late signing.
 *  - The Blockbuster refusal surcharge (declared since v0.2, now applied and
 *    explained) and the age clock (+1 a season, 2022-23 → 2024 included).
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_BANK,
  CAREER_ECONOMY,
  CAREER_GEAR,
  CAREER_LOAN,
  CAREER_PAYROLL,
  CAREER_PRIZES,
  CAREER_SALARY,
  CAREER_SCOUT,
  CAREER_SEASONS,
  CAREER_SPONSOR,
  CAREER_SUB,
  CAREER_TRANSFER,
} from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { playerById } from "@/data";
import { ACH_FLAGS } from "@/engine/career/achievements";
import { firstDayOfWeek, officialEventDefsForWeek, weekOfDay } from "@/engine/career/calendar";
import { ageOf, deriveBirthYear, playerViewById, seasonYear } from "@/engine/career/development";
import {
  applyPrize,
  backerLineFor,
  bankLoanLimitFor,
  bankMinAmountFor,
  bootcampCostFor,
  breachOutcomeFor,
  foundingPartnerBaseFor,
  gearPriceFor,
  indexedAmount,
  insertMoneyFor,
  loanBreachesOf,
  marketValueFor,
  mondaysToBreach,
  moneyIndex,
  playerShareFor,
  prizeFor,
  prizePoolPaidFor,
  prizeTables,
  psychologistPerSplitFor,
  quantize,
  repPremiumFor,
  runwayShortened,
  runwayWeeksAfter,
  scoutReportCostFor,
  sponsorOffersFor,
  standInFeeFor,
  weeklyOf,
  weeklyStatement,
} from "@/engine/career/economy";
import { blockbusterRefusalApplies, listingFor, renewalAskFor } from "@/engine/career/market";
import type { CareerPlayerView, CareerSave, FinanceState, TransferOffer } from "@/engine/career/types";
import { buildWorldAtCreation, agePassAndIntake } from "@/engine/career/worldSim";
import {
  acceptBidFlow,
  advanceDayFlow,
  backerLineOf,
  chooseSponsorFlow,
  coachCandidatesFor,
  createCareerSave,
  declineBidFlow,
  hireCoachFlow,
  lateSigningOpen,
  listForSaleFlow,
  migrateSaveToV5,
  rolloverToNextSeason,
  signingPlanFor,
  signPlayerFlow,
  userTeamForEvent,
  weeklyStatementOf,
  withdrawListingFlow,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Ledger Org",
    abbrev: "LED",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

/** Flip config keys for one check and always restore them (the switch-back tests). */
function withConfig(target: object, patch: Record<string, unknown>, fn: () => void): void {
  const t = target as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    saved[k] = t[k];
    t[k] = patch[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) t[k] = saved[k];
  }
}

/** A quiet Sunday of `week`: nothing pending, so the next advance is a plain Monday arrival. */
function quietSunday(save: CareerSave, week: number): CareerSave {
  const next = structuredClone(save);
  next.clock.day = firstDayOfWeek(week) + 6;
  next.pendingEventDef = null;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.sponsorOffers = null;
  next.pendingOffers = [];
  return next;
}

/** Advance one day; a matchday or an insert that blocks the clock is cleared (these tests follow the money). */
function step(save: CareerSave): CareerSave {
  const before = save.clock.day;
  const next = advanceDayFlow(save);
  if (next.clock.day === before && next.phase === "running") {
    return advanceDayFlow({ ...structuredClone(next), pendingEventDef: null, pendingInsert: null, unofficialOffer: null });
  }
  return next;
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

function freshFin(balance: number, extra: Partial<FinanceState> = {}): FinanceState {
  return {
    balance,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear: { peripherals: false, monitors: false, pcs: false, perfCenter: false, psychologist: false },
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
    ...extra,
  };
}

// ===========================================================================
// M1 — one season money index (decision 1-A)
// ===========================================================================

describe("rc.32 M1 — one season money index for every stream", () => {
  it("×1 at season 0, then indexPerSeason^s for wages, prizes, sponsors and the flat amounts alike", () => {
    for (let s = 0; s < 10; s++) {
      const want = Math.pow(CAREER_ECONOMY.indexPerSeason, s);
      for (const stream of ["wages", "prizes", "sponsor", "flat"] as const) {
        expect(moneyIndex(s, stream)).toBeCloseTo(want, 12);
      }
    }
    expect(moneyIndex(0, "prizes")).toBe(1);
    expect(moneyIndex(-1)).toBe(1);
  });

  it("indexes today's flat amounts: bank, minimum fee, stand-in, scouting, gear, upkeep, psychologist, inserts, fanbase", () => {
    const s = 4;
    const idx = moneyIndex(s);
    const tier = 2;
    expect(bankLoanLimitFor(45, s)).toBe(quantize(CAREER_BANK.maxByRepTier[tier] * idx));
    expect(bankMinAmountFor(s)).toBe(quantize(CAREER_BANK.minAmount * idx));
    expect(standInFeeFor(s)).toBe(quantize(CAREER_SUB.standInFee * idx));
    expect(scoutReportCostFor(s)).toBe(quantize(CAREER_SCOUT.reportCost * idx));
    expect(gearPriceFor(CAREER_GEAR.items[2].cost, null, s)).toBe(quantize(CAREER_GEAR.items[2].cost * idx));
    expect(bootcampCostFor(1, s)).toBe(quantize(CAREER_GEAR.bootcamp[0].cost * idx));
    expect(psychologistPerSplitFor(s)).toBeCloseTo(CAREER_GEAR.psychologistPerSplit * idx, 9);
    expect(insertMoneyFor(-1_500, s)).toBe(quantize(-1_500 * idx));
    // The minimum fee floors the market value of a 60 (the curve is below it).
    expect(marketValueFor({ overall: 60, age: 30, potential: 60, seasonIndex: s })).toBe(
      quantize(CAREER_TRANSFER.minFee * idx),
    );
    const gear = { peripherals: true, monitors: true, pcs: true, perfCenter: false, psychologist: true };
    const st = weeklyStatement({ squadSalaries: [], coachSalary: null, sponsor: null, rep: 50, gear, seasonIndex: s });
    expect(st.fanbase).toBe(weeklyOf(50 * CAREER_ECONOMY.passivePerRepPoint * idx));
    expect(st.upkeep).toBe(weeklyOf(CAREER_GEAR.items[2].upkeepPerSplit * idx));
    expect(st.psychologist).toBe(weeklyOf(CAREER_GEAR.psychologistPerSplit * idx));
    // Season 0 (and an omitted season) is today's money exactly.
    for (const n of [CAREER_SCOUT.reportCost, CAREER_SUB.standInFee, -800]) expect(indexedAmount(n, 0)).toBe(n);
  });

  it("no ratio between two streams drifts: prizes ÷ asks and sponsors ÷ asks stay flat", () => {
    const champ = (s: number) => prizeFor("regional", "champion", "swiss", "normal", s);
    const deal = (s: number) => sponsorOffersFor(80, s, 7, null, false, "normal")[0].basePerSplit;
    const value = (s: number) => marketValueFor({ overall: 82, age: 20, potential: 82, seasonIndex: s });
    for (const s of [3, 7]) {
      expect(champ(s) / champ(0) / (value(s) / value(0))).toBeCloseTo(1, 1);
      expect(deal(s) / deal(0) / (value(s) / value(0))).toBeCloseTo(1, 1);
    }
  });

  it("switch-back: indexMode 'rc31' restores the three rates and the flat streams exactly", () => {
    withConfig(CAREER_ECONOMY, { indexMode: "rc31" }, () => {
      const s = 5;
      expect(moneyIndex(s, "wages")).toBe(Math.pow(CAREER_SALARY.inflationPerSeason, s));
      expect(moneyIndex(s, "prizes")).toBe(Math.pow(CAREER_PRIZES.growthPerSeason, s));
      expect(moneyIndex(s, "sponsor")).toBe(Math.pow(CAREER_SPONSOR.growthPerSeason, s));
      expect(moneyIndex(s, "flat")).toBe(1);
      expect(prizeFor("major", "champion", "swiss", "normal", s)).toBe(
        quantize(CAREER_PRIZES.pools.major * Math.pow(1.12, s) * (prizeTables().swiss16.champion / 100)),
      );
      expect(scoutReportCostFor(s)).toBe(CAREER_SCOUT.reportCost);
      expect(bankLoanLimitFor(99, s)).toBe(CAREER_BANK.maxByRepTier[4]);
      const st = weeklyStatement({
        squadSalaries: [],
        coachSalary: null,
        sponsor: null,
        rep: 40,
        gear: { peripherals: false, monitors: false, pcs: true, perfCenter: false, psychologist: false },
        seasonIndex: s,
      });
      expect(st.fanbase).toBe(weeklyOf(40 * CAREER_ECONOMY.passivePerRepPoint));
      expect(st.upkeep).toBe(weeklyOf(CAREER_GEAR.items[2].upkeepPerSplit));
    });
  });

  it("signed contracts keep their figure: a rollover reprices nothing on the squad", () => {
    const save = createCareerSave(INPUT, 50_011);
    const before = save.squad.map((p) => [p.id, p.salaryPerSplit]);
    const next = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    for (const [id, wage] of before) {
      const p = next.squad.find((x) => x.id === id);
      if (p) expect(p.salaryPerSplit).toBe(wage);
    }
  });
});

// ===========================================================================
// M5 — prize tables that pay 100 % (decision 6-B)
// ===========================================================================

describe("rc.32 M5 — prize tables that sum to 100 %", () => {
  it("Swiss-16 28/18/12/9/6.5/5/1.25 and single-elim 40/20/10/5 both sum to 100 %", () => {
    const { swiss16, single8 } = prizeTables();
    expect([swiss16.champion, swiss16.runner_up, swiss16.third, swiss16.fourth]).toEqual([28, 18, 12, 9]);
    expect([swiss16.top6, swiss16.top8, swiss16.swiss_exit]).toEqual([6.5, 5, 1.25]);
    expect(swiss16.champion + swiss16.runner_up + swiss16.third + swiss16.fourth + 2 * swiss16.top6 + 2 * swiss16.top8 + 8 * swiss16.swiss_exit).toBe(100);
    expect([single8.champion, single8.runner_up, single8.top4, single8.top8]).toEqual([40, 20, 10, 5]);
    expect(single8.champion + single8.runner_up + 2 * single8.top4 + 4 * single8.top8).toBe(100);
  });

  it("a season-0 regional pays its $40k and a Community Cup its $2k; the qualifier is unchanged", () => {
    expect(prizePoolPaidFor("regional", "swiss", "normal", 0)).toBe(CAREER_PRIZES.pools.regional);
    expect(prizePoolPaidFor("t3", "single", "normal", 0)).toBe(CAREER_PRIZES.pools.t3);
    expect(prizePoolPaidFor("qualifier", "swissOnly", "normal", 0)).toBe(CAREER_PRIZES.pools.qualifier);
    expect(prizeFor("regional", "champion", "swiss", "normal", 0)).toBe(11_200);
    expect(prizeFor("regional", "swiss_exit", "swiss", "normal", 0)).toBe(500);
  });

  it("switch-back: tables 'rc31' restore rc.31's 30 % title and its 102 % Swiss table", () => {
    withConfig(CAREER_PRIZES, { tables: "rc31" }, () => {
      expect(prizeFor("regional", "champion", "swiss", "normal", 0)).toBe(12_000);
      expect(prizePoolPaidFor("regional", "swiss", "normal", 0)).toBe(40_800);
      expect(prizeFor("t2", "runner_up", "single", "normal", 0)).toBe(2_200);
    });
  });
});

// ===========================================================================
// M6 — stars and the snowball (decision 5-B)
// ===========================================================================

describe("rc.32 M6 — the comfort cap and the players' share", () => {
  it("a star carries a premium even at rep 100: a 90 ×1.16, a 95 ×1.36; below the cap nothing changes", () => {
    expect(repPremiumFor(90, 100)).toBeCloseTo(1.16, 9);
    expect(repPremiumFor(95, 100)).toBeCloseTo(1.36, 9);
    expect(repPremiumFor(85, 100)).toBe(1);
    expect(repPremiumFor(80, 20)).toBeCloseTo(1 + CAREER_SALARY.repPremiumPerPoint * (80 - 69), 9);
  });

  it("switch-back: repComfortMax null restores rc.31 (no premium at rep 100 below 97)", () => {
    withConfig(CAREER_SALARY, { repComfortMax: null }, () => {
      expect(repPremiumFor(90, 100)).toBe(1);
      expect(repPremiumFor(95, 100)).toBe(1);
    });
  });

  it("the players' share: 20 / 35 / 50 % of a regional / Major / Worlds podium, 1st–4th only", () => {
    const prize = 10_000;
    expect(playerShareFor("regional", "champion", prize)).toBe(quantize(prize * CAREER_PRIZES.playerShare.regional));
    expect(playerShareFor("major", "runner_up", prize)).toBe(quantize(prize * CAREER_PRIZES.playerShare.major));
    expect(playerShareFor("worlds", "fourth", prize)).toBe(quantize(prize * CAREER_PRIZES.playerShare.worlds));
    expect(playerShareFor("regional", "top4", prize)).toBeGreaterThan(0);
    for (const placement of ["top6", "top8", "swiss_exit"] as const) expect(playerShareFor("major", placement, prize)).toBe(0);
    for (const tier of ["t3", "t2", "qualifier"] as const) expect(playerShareFor(tier, "champion", prize)).toBe(0);
  });

  it("applyPrize books the share as its own line, and the Backer garnishes the org's part", () => {
    const fin = freshFin(0, { loan: { remaining: 50_000 }, loanUsed: true });
    const prize = 12_000;
    const share = playerShareFor("regional", "champion", prize);
    const res = applyPrize(fin, prize, { seasonIndex: 0, week: 4, refName: "Regional", difficulty: "normal", playerShare: share });
    expect(res.fin.ledger.map((l) => l.kind)).toEqual(["prize", "playerShare", "loanGarnish"]);
    expect(res.fin.ledger[1].amount).toBe(-share);
    expect(res.garnished).toBe(quantize(CAREER_LOAN.garnishRate.normal * (prize - share)));
    expect(res.fin.balance).toBe(prize - share - res.garnished);
  });

  it("switch-back: playerShare.enabled false pays the whole prize (rc.31)", () => {
    withConfig(CAREER_PRIZES.playerShare, { enabled: false }, () => {
      expect(playerShareFor("worlds", "champion", 600_000)).toBe(0);
    });
  });
});

// ===========================================================================
// M3 — the founding partner (decision 3-A)
// ===========================================================================

describe("rc.32 M3 — the founding partner", () => {
  it("opens on day one, sized on the founding wage bill, announced, and paid on Mondays as its own line", () => {
    const save = createCareerSave(INPUT, 50_101);
    const bill = sum(save.squad.map((p) => p.salaryPerSplit));
    expect(save.foundingPartner).toEqual({ wageBillPerSplit: bill, sizedSeason: 0 });
    expect(save.mail.map((m) => m.titleKey)).toContain("foundingPartner");
    const base = foundingPartnerBaseFor(save.foundingPartner, 0);
    expect(base).toBe(quantize(CAREER_SPONSOR.founding.payrollShare * bill));
    expect(weeklyStatementOf(save).foundingPartner).toBe(weeklyOf(base));
    const monday = advanceDayFlow(quietSunday(save, 1));
    const line = monday.finances.ledger.find((l) => l.kind === "foundingPartner");
    expect(line?.amount).toBe(weeklyOf(base));
    // Indexed after creation (the sponsor stream), never re-sized on the squad.
    expect(foundingPartnerBaseFor(save.foundingPartner, 3)).toBe(
      quantize(CAREER_SPONSOR.founding.payrollShare * bill * moneyIndex(3, "sponsor")),
    );
  });

  it("a deal signed early: it runs alongside through season 1 and steps back on season 2's first Monday", () => {
    let save = createCareerSave(INPUT, 50_102);
    save.flags[ACH_FLAGS.sponsorSigned] = true; // a real deal was signed in season 0
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.clock.seasonIndex).toBe(1);
    expect(save.foundingPartner?.endedSeason).toBeUndefined();
    expect(save.finances.ledger.some((l) => l.kind === "foundingPartner" && l.seasonIndex === 1)).toBe(true);
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.foundingPartner?.endedSeason).toBe(2);
    expect(save.mail.some((m) => m.titleKey === "foundingPartnerEnds")).toBe(true);
    expect(save.finances.ledger.some((l) => l.kind === "foundingPartner" && l.seasonIndex === 2)).toBe(false);
  });

  it("no deal yet: it carries on past season 1 and the first real deal ends it there and then", () => {
    let save = createCareerSave(INPUT, 50_103);
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.clock.seasonIndex).toBe(2);
    expect(save.foundingPartner?.endedSeason).toBeUndefined();
    expect(save.finances.ledger.some((l) => l.kind === "foundingPartner" && l.seasonIndex === 2)).toBe(true);
    const offers = sponsorOffersFor(20, 2, save.careerSeed, null, false, save.difficulty);
    const signed = chooseSponsorFlow({ ...save, sponsorOffers: offers }, offers[0].sponsorId);
    expect(signed.error).toBeUndefined();
    expect(signed.save.foundingPartner?.endedSeason).toBe(2);
    expect(signed.save.mail.some((m) => m.titleKey === "foundingPartnerEnds")).toBe(true);
    expect(weeklyStatementOf(signed.save).foundingPartner).toBe(0);
  });

  it("an older save: only in season index ≤ 1 with no sponsor ever, sized on its wage bill at load, announced once", () => {
    const old = createCareerSave(INPUT, 50_104);
    delete old.foundingPartner;
    old.mail = [];
    old.clock.seasonIndex = 1;
    const loaded = migrateSaveToV5(structuredClone(old))!;
    expect(loaded.foundingPartner).toEqual({ wageBillPerSplit: sum(old.squad.map((p) => p.salaryPerSplit)), sizedSeason: 1 });
    expect(loaded.mail.filter((m) => m.titleKey === "foundingPartner")).toHaveLength(1);
    const again = migrateSaveToV5(structuredClone(loaded))!;
    expect(again.mail.filter((m) => m.titleKey === "foundingPartner")).toHaveLength(1);
    expect(again.foundingPartner).toEqual(loaded.foundingPartner);
    // Too late, or a sponsor already signed: decided, none.
    const late = migrateSaveToV5({ ...structuredClone(old), clock: { seasonIndex: 2, day: 1 } })!;
    expect(late.foundingPartner).toBeNull();
    const sponsored = structuredClone(old);
    sponsored.flags[ACH_FLAGS.sponsorSigned] = true;
    expect(migrateSaveToV5(sponsored)!.foundingPartner).toBeNull();
  });

  it("switch-back: founding.enabled false — no partner, no mail, no ledger line (rc.31)", () => {
    withConfig(CAREER_SPONSOR.founding, { enabled: false }, () => {
      const save = createCareerSave(INPUT, 50_105);
      expect(save.foundingPartner).toBeUndefined();
      expect(save.mail).toEqual([]);
      const monday = advanceDayFlow(quietSunday(save, 1));
      expect(monday.finances.ledger.some((l) => l.kind === "foundingPartner")).toBe(false);
    });
  });
});

// ===========================================================================
// M4 — the safety net (decision 4-B)
// ===========================================================================

describe("rc.32 M4 — the Backer in weeks of payroll and what each breach does", () => {
  it("season 0 keeps about rc.31's line: −8 / +6 weeks of a $500 week is −$4k / +$3k", () => {
    expect(backerLineFor(500, 0)).toEqual({ floor: -4_000, rescueTo: 3_000 });
    // The line moves with the wage bill, not with the index.
    expect(backerLineFor(11_000, 6)).toEqual({ floor: -88_000, rescueTo: 66_000 });
    // An empty squad still gets a real line (the guard).
    expect(backerLineFor(0, 0).floor).toBe(-CAREER_LOAN.floorWeeks * CAREER_LOAN.weeksBasisMin);
  });

  it("switch-back: sizing 'flat' restores rc.31's −$5k / +$3k", () => {
    withConfig(CAREER_LOAN, { sizing: "flat" }, () => {
      expect(backerLineFor(11_000, 0)).toEqual({ floor: CAREER_LOAN.floor, rescueTo: CAREER_LOAN.rescueTo });
    });
  });

  it("what ends a career: Easy never, Normal at the third breach, Hard at the second (restructurings between)", () => {
    expect([1, 2, 3, 4, 9].map((b) => breachOutcomeFor(b, "easy"))).toEqual(["rescue", "restructure", "restructure", "restructure", "restructure"]);
    expect([1, 2, 3].map((b) => breachOutcomeFor(b, "normal"))).toEqual(["rescue", "restructure", "insolvent"]);
    expect([1, 2].map((b) => breachOutcomeFor(b, "hard"))).toEqual(["rescue", "insolvent"]);
    // An older save: its one rescue counts as the first breach.
    expect(loanBreachesOf({ loanUsed: true })).toBe(1);
    expect(loanBreachesOf({ loanUsed: false })).toBe(0);
  });

  it("switch-back: breachesToEnd 2 everywhere restores rc.31 (the second breach ends it)", () => {
    withConfig(CAREER_LOAN, { breachesToEnd: { easy: 2, normal: 2, hard: 2 } }, () => {
      for (const d of ["easy", "normal", "hard"] as const) expect(breachOutcomeFor(2, d)).toBe("insolvent");
    });
  });

  it("Normal: rescue, then a restructuring (the highest-paid sold, rep down, topped back up, still playable), then the end", () => {
    let save = createCareerSave(INPUT, 50_201);
    for (const [i, p] of save.squad.entries()) p.salaryPerSplit = 10_000 + i * 1_000;
    const top = save.squad[save.squad.length - 1];
    // Breach 1 — the rescue.
    save = quietSunday(save, 2);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    expect(save.finances.loanBreaches).toBe(1);
    expect(save.finances.balance).toBe(backerLineOf(save).rescueTo);
    const rescueMail = save.mail.find((m) => m.titleKey === "backerIn")!;
    expect(rescueMail.params?.next).toBe("restructure");
    // Breach 2 — the restructuring.
    const repBefore = save.reputation;
    save = quietSunday(save, 3);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    expect(save.phase).toBe("running");
    expect(save.finances.loanBreaches).toBe(2);
    expect(save.squad.some((p) => p.id === top.id)).toBe(false);
    expect(save.world.retiredIds).not.toContain(top.id);
    expect(Object.values(save.world.orgs).some((o) => o.playerIds.includes(top.id))).toBe(true);
    expect(save.finances.ledger.some((l) => l.kind === "transferIn" && l.refName === top.name)).toBe(true);
    expect(save.reputation).toBe(Math.max(0, repBefore - CAREER_LOAN.restructureRepLoss));
    expect(save.finances.balance).toBeGreaterThanOrEqual(backerLineOf(save).rescueTo);
    const mail = save.mail.find((m) => m.titleKey === "restructured")!;
    expect(mail.params).toMatchObject({ n: 2, player: top.name, next: "insolvent", rep: repBefore - save.reputation });
    // rc.32 review: the mail states what the sale and the Backer really did.
    const garnishedLogged = -save.finances.ledger
      .filter((l) => l.kind === "loanGarnish" && l.day === save.clock.day)
      .reduce((n, l) => n + l.amount, 0);
    expect(mail.params?.garnished).toBe(garnishedLogged);
    expect(Number(mail.params?.garnished)).toBeGreaterThan(0);
    expect(mail.params?.balance).toBe(save.finances.balance);
    expect(CAREER_EN.mail.body.restructured(mail.params!)).toContain("went to the debt");
    expect(save.news.some((n) => n.titleKey === "restructured")).toBe(true);
    // Playable: two players and a stand-in in the third seat, no softlock.
    const regional = officialEventDefsForWeek(0, 4).find((d) => d.region === "SAM")!;
    expect(userTeamForEvent(save, regional).usedStandIn).toBe(true);
    // Breach 3 — the end on Normal.
    save = quietSunday(save, 4);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    expect(save.phase).toBe("ended");
    expect(save.end.reason).toBe("insolvency");
  });

  it("a restructuring after the Backer was repaid says so: nothing to the debt, no top-up, the real balance (rc.32 review)", () => {
    let save = createCareerSave(INPUT, 50_203);
    for (const [i, p] of save.squad.entries()) p.salaryPerSplit = 10_000 + i * 1_000;
    const top = save.squad[save.squad.length - 1];
    top.overall = 88; // worth far more than the gap to the rescue target
    save = quietSunday(save, 2);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    expect(save.finances.loanBreaches).toBe(1);
    save.finances.loan = null; // repaid
    save = quietSunday(save, 3);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    const mail = save.mail.find((m) => m.titleKey === "restructured")!;
    expect(mail.params).toMatchObject({ player: top.name, garnished: 0, granted: 0, owed: 0 });
    expect(mail.params?.balance).toBe(save.finances.balance);
    for (const C of [CAREER_EN, CAREER_PT]) {
      const text = C.mail.body.restructured(mail.params!);
      expect(text).toContain(String(save.finances.balance));
      expect(text).not.toMatch(/half of it|metade para a dívida|topped the balance|recompôs o saldo/);
    }
  });

  it("Easy: money never ends the career — every later breach restructures, down to an empty squad", () => {
    let save = createCareerSave({ ...INPUT, difficulty: "easy" }, 50_202);
    for (const p of save.squad) p.salaryPerSplit = 12_000;
    const breaches = save.squad.length + 2; // the rescue, one restructuring per player, then one with nobody left
    for (let breach = 1; breach <= breaches; breach++) {
      save = quietSunday(save, 1 + breach);
      // A burn the books cannot carry, every time.
      save.finances.balance = backerLineOf(save).floor - 1;
      save = advanceDayFlow(save);
      expect(save.phase).toBe("running");
    }
    expect(save.squad).toHaveLength(0);
    expect(save.mail.filter((m) => m.titleKey === "restructured").length).toBeGreaterThanOrEqual(3);
  });

  it("an older save rescued under rc.31 (loanUsed, no counter): its next breach on Normal restructures", () => {
    let save = createCareerSave(INPUT, 50_203);
    save.finances.loanUsed = true;
    delete save.finances.loanBreaches;
    for (const p of save.squad) p.salaryPerSplit = 10_000;
    save = quietSunday(save, 2);
    save.finances.balance = backerLineOf(save).floor + 10;
    save = advanceDayFlow(save);
    expect(save.phase).toBe("running");
    expect(save.finances.loanBreaches).toBe(2);
    expect(save.mail.some((m) => m.titleKey === "restructured")).toBe(true);
  });
});

describe("rc.32 M4 — warnings with the projected breach", () => {
  it("runway helpers: the breach Monday, the runway a change leaves, what counts as shorter", () => {
    expect(mondaysToBreach(1_000, -500, -4_000)).toBe(11);
    expect(mondaysToBreach(1_000, 200, -4_000)).toBeNull();
    expect(runwayWeeksAfter({ balance: 10_000, weeklyNet: -1_000 })).toBe(10);
    expect(runwayWeeksAfter({ balance: 10_000, weeklyNet: -1_000, upfront: 2_000, weeklyChange: -1_000 })).toBe(4);
    expect(runwayWeeksAfter({ balance: 10_000, weeklyNet: 500, weeklyChange: -400 })).toBeNull();
    expect(runwayShortened(10, 9)).toBe(true);
    expect(runwayShortened(null, 30)).toBe(true);
    expect(runwayShortened(null, null)).toBe(false);
    expect(runwayShortened(5, null)).toBe(false);
  });

  /** A steady burn from a positive balance, followed Monday by Monday up to the rescue. */
  function burnToRescue(): CareerSave {
    let save = createCareerSave(INPUT, 50_301);
    for (const p of save.squad) p.salaryPerSplit = 8_000;
    save = quietSunday(save, 2);
    const net = weeklyStatementOf(save).net;
    expect(net).toBeLessThan(0);
    save.finances.balance = -net * (CAREER_PAYROLL.runwayNoticeWeeks + 3);
    let guard = 0;
    while (!save.mail.some((m) => m.titleKey === "backerIn") && guard++ < 400) save = step(save);
    return save;
  }

  it("a notice once at ≤ 8 weeks, then a mail every Monday at ≤ 4, each naming the breach — all before the rescue", () => {
    const save = burnToRescue();
    const rescue = save.mail.find((m) => m.titleKey === "backerIn")!;
    const rescueWeek = weekOfDay(rescue.day);
    const notices = save.mail.filter((m) => m.titleKey === "cashNotice");
    const warnings = save.mail.filter((m) => m.titleKey === "cashWarning" && m.day < rescue.day);
    expect(notices).toHaveLength(1);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(new Set(warnings.map((m) => m.day)).size).toBe(warnings.length); // one per Monday
    for (const m of [...notices, ...warnings]) {
      expect(m.params?.breachWeek).toBeTypeOf("number");
      expect(m.params?.next).toBe("rescue");
    }
    // A steady burn: the projection names the Monday the Backer stepped in.
    const lastWarning = warnings.sort((a, b) => b.day - a.day)[0];
    expect(lastWarning.params?.breachWeek).toBe(rescueWeek);
    // The copy reads the projected breach (EN and PT).
    expect(CAREER_EN.mail.body.cashWarning(lastWarning.params!)).toContain(`week ${rescueWeek}`);
    expect(CAREER_PT.mail.body.cashWarning(lastWarning.params!)).toContain(`semana ${rescueWeek}`);
  });

  it("switch-back: runwayWarnMode 'rc31' — one mail at exactly 4 weeks, no notice", () => {
    withConfig(CAREER_PAYROLL, { runwayWarnMode: "rc31" }, () => {
      const save = burnToRescue();
      expect(save.mail.filter((m) => m.titleKey === "cashNotice")).toHaveLength(0);
      const warnings = save.mail.filter((m) => m.titleKey === "cashWarning");
      expect(warnings.length).toBeLessThanOrEqual(1);
      for (const m of warnings) expect(m.params?.weeks).toBe(CAREER_PAYROLL.runwayWarnWeeks);
    });
  });
});

describe("rc.32 M4 — while the Backer is owed, nothing that shortens the runway", () => {
  /** In the window after split 1, burning, the Backer owed — exactly 10 weeks of runway, so any new weekly cost shortens it. */
  function owedInWindow(): CareerSave {
    const save = createCareerSave(INPUT, 50_401);
    save.clock.day = firstDayOfWeek(11) + 1;
    for (const p of save.squad) p.salaryPerSplit = 8_000;
    save.finances.loan = { remaining: 6_000 };
    save.finances.loanUsed = true;
    save.reputation = 20;
    save.finances.balance = -weeklyStatementOf(save).net * 10;
    return save;
  }
  const cheapFa = (save: CareerSave): CareerPlayerView =>
    save.world.freeAgentIds
      .map((id) => playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world }))
      .filter((v): v is CareerPlayerView => v !== null && v.age >= 13 && Math.round(v.overall) <= 74)
      .sort((a, b) => a.overall - b.overall)[0];

  it("a signing that adds wages is refused with the reason, and leaves the save untouched", () => {
    const save = owedInWindow();
    const fa = cheapFa(save);
    const planned = signingPlanFor(save, fa.id, { lengthSeasons: 2 });
    expect("error" in planned && planned.error).toBe("loanRunway");
    const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
    expect(res.error).toBe("loanRunway");
    expect(res.save).toBe(save);
    expect(CAREER_EN.market.errors.loanRunway.length).toBeGreaterThan(0);
    expect(CAREER_PT.market.errors.loanRunway.length).toBeGreaterThan(0);
  });

  it("the lock holds in the overdraft too: between $0 and the Backer's floor a commitment is still refused (rc.32 review)", () => {
    for (const weeks of [0.5, 0, -1, -3]) {
      const save = owedInWindow();
      const net = weeklyStatementOf(save).net;
      save.finances.balance = Math.round(-net * weeks);
      expect(save.finances.balance).toBeGreaterThan(backerLineOf(save).floor);
      const fa = cheapFa(save);
      expect(signPlayerFlow(save, fa.id, { lengthSeasons: 2 }).error, `balance ${weeks} weeks of burn`).toBe("loanRunway");
      expect(hireCoachFlow(save, coachCandidatesFor(save)[0]).error, `coach at ${weeks} weeks`).toBe("loanRunway");
    }
  });

  it("never a soft lock: a free agent may still fill an empty starting seat (a restructured squad under three)", () => {
    const save = owedInWindow();
    save.squad = save.squad.slice(0, 2);
    save.starterIds = [save.squad[0].id, save.squad[1].id, ""];
    save.finances.balance = -weeklyStatementOf(save).net * 10;
    const fa = cheapFa(save);
    const planned = signingPlanFor(save, fa.id, { lengthSeasons: 2 });
    expect("plan" in planned).toBe(true);
    const signed = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
    expect(signed.error).toBeUndefined();
    // Back at three: the next signing (a reserve) is a commitment again.
    const next = cheapFa(signed.save);
    expect(signPlayerFlow(signed.save, next.id, { lengthSeasons: 2 }).error).toBe("loanRunway");
  });

  it("never a soft lock: the Market always lists a page of free agents a low-reputation org can sign", () => {
    let world = buildWorldAtCreation(50_404);
    for (let s = 0; s < 4; s++) world = agePassAndIntake(world, s + 1, 50_404, [], false, []).world;
    const ctx = { world, squadIds: [], seasonIndex: 4, careerSeed: 50_404 };
    const plain = listingFor(ctx);
    expect(plain.freeAgents.length).toBe(120);
    const cap = Math.min(...plain.freeAgents.map((v) => Math.round(v.overall))) - 1;
    const pool = world.freeAgentIds
      .map((id) => playerViewById(id, { careerSeed: 50_404, seasonIndex: 4, world }))
      .filter((v): v is CareerPlayerView => v !== null && v.age >= 13 && Math.round(v.overall) <= cap);
    expect(pool.length).toBeGreaterThan(0);
    const topped = listingFor({ ...ctx, signableCap: cap });
    expect(topped.freeAgents.slice(0, 120)).toEqual(plain.freeAgents);
    expect(topped.freeAgents.filter((v) => Math.round(v.overall) <= cap)).toHaveLength(Math.min(24, pool.length));
  });

  it("a coach hire that adds wages is refused the same way", () => {
    const save = owedInWindow();
    const coach = coachCandidatesFor(save)[0];
    expect(hireCoachFlow(save, coach).error).toBe("loanRunway");
  });

  it("switch-back: lockCommitments false restores rc.31 (only fees, gear and the bank are locked)", () => {
    withConfig(CAREER_LOAN, { lockCommitments: false }, () => {
      const save = owedInWindow();
      const fa = cheapFa(save);
      expect("plan" in signingPlanFor(save, fa.id, { lengthSeasons: 2 })).toBe(true);
      expect(hireCoachFlow(save, coachCandidatesFor(save)[0]).error).toBeUndefined();
    });
  });
});

// ===========================================================================
// M8 — "List for sale" and the late signing (decision 8-B)
// ===========================================================================

describe("rc.32 M8 — List for sale", () => {
  /** Sunday before the window after split 1 (W11), money plentiful. */
  function beforeWindow1(seed = 50_501): CareerSave {
    const save = quietSunday(createCareerSave(INPUT, seed), 10);
    save.finances.balance = 400_000;
    return save;
  }
  function untilListingOffer(save: CareerSave, playerId: string): CareerSave {
    let s = save;
    let guard = 0;
    while (!s.pendingOffers.some((o) => o.listing && o.playerId === playerId) && guard++ < 20) s = step(s);
    return s;
  }

  it("an AI org of his region that would field him offers market value × 0.9–1.15 within a few window days", () => {
    const start = beforeWindow1();
    const seller = start.squad[0];
    const listed = listForSaleFlow(start, seller.id);
    expect(listed.error).toBeUndefined();
    const listing = listed.save.saleListings![0];
    expect(listing.waitDays).toBeGreaterThanOrEqual(CAREER_TRANSFER.listingOfferDays[0]);
    expect(listing.waitDays).toBeLessThanOrEqual(CAREER_TRANSFER.listingOfferDays[1]);
    const withOffer = untilListingOffer(listed.save, seller.id);
    const offer = withOffer.pendingOffers.find((o) => o.listing && o.playerId === seller.id)!;
    expect(offer).toBeTruthy();
    expect(weekOfDay(withOffer.clock.day)).toBeLessThanOrEqual(12);
    expect(withOffer.world.orgs[offer.otherRef!].region).toBe(seller.region);
    const value = marketValueFor({
      overall: seller.overall,
      age: ageOf(seller.birthYear, 0),
      potential: seller.potential,
      seasonIndex: 0,
    });
    const [lo, hi] = CAREER_TRANSFER.listingOfferRange;
    expect(offer.fee).toBeGreaterThanOrEqual(quantize(value * lo) - CAREER_ECONOMY.roundQuantum);
    expect(offer.fee).toBeLessThanOrEqual(value * hi);
    expect(withOffer.mail.some((m) => m.titleKey === "listingOffer")).toBe(true);
    // Accept: atomic, like any sale — and the seat may be refilled after the window closes.
    const sold = acceptBidFlow(withOffer, offer.id);
    expect(sold.error).toBeUndefined();
    expect(sold.save.squad.some((p) => p.id === seller.id)).toBe(false);
    expect(sold.save.saleListings).toEqual([]);
    expect(sold.save.finances.balance).toBe(withOffer.finances.balance + offer.fee);
    expect(sold.save.lateSigning).toMatchObject({ seasonIndex: 0, windowIdx: 1, used: false });
  });

  it("decline keeps him and ends the listing; withdraw takes him off the market", () => {
    const start = beforeWindow1(50_502);
    const p = start.squad[1];
    const withOffer = untilListingOffer(listForSaleFlow(start, p.id).save, p.id);
    const offer = withOffer.pendingOffers.find((o) => o.listing && o.playerId === p.id)!;
    const declined = declineBidFlow(withOffer, offer.id);
    expect(declined.squad.some((x) => x.id === p.id)).toBe(true);
    expect(declined.saleListings).toEqual([]);
    const relisted = listForSaleFlow(declined, p.id);
    expect(relisted.error).toBeUndefined();
    expect(listForSaleFlow(relisted.save, p.id).error).toBe("alreadyListed");
    const withdrawn = withdrawListingFlow(relisted.save, p.id);
    expect(withdrawn.save.saleListings).toEqual([]);
    expect(withdrawn.save.pendingOffers.some((o) => o.listing)).toBe(false);
  });

  it("the career's first window is bid-free: a listing there waits for the next window", () => {
    let save = createCareerSave(INPUT, 50_503);
    save.finances.balance = 400_000;
    const p = save.squad[0];
    save = listForSaleFlow(save, p.id).save;
    while (weekOfDay(save.clock.day) <= 2) {
      save = step(save);
      expect(save.pendingOffers.some((o) => o.listing)).toBe(false);
    }
    expect(save.saleListings?.[0].waitDays).toBe(listForSaleFlow(createCareerSave(INPUT, 50_503), p.id).save.saleListings![0].waitDays);
  });

  it("the late signing: one free agent within 7 days after the window, never a contracted player, once", () => {
    const start = beforeWindow1(50_504);
    const seller = start.squad[0];
    const withOffer = untilListingOffer(listForSaleFlow(start, seller.id).save, seller.id);
    let save = acceptBidFlow(withOffer, withOffer.pendingOffers.find((o) => o.listing)!.id).save;
    // Past the window's close (W12 Sunday), inside the 7 days.
    save = { ...structuredClone(save), pendingEventDef: null, pendingInsert: null, unofficialOffer: null };
    save.clock.day = firstDayOfWeek(13) + 1;
    expect(lateSigningOpen(save)).toBe(true);
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world };
    const fas = save.world.freeAgentIds
      .map((id) => playerViewById(id, ctx))
      .filter((v): v is CareerPlayerView => v !== null && v.age >= 13 && Math.round(v.overall) <= 74);
    const contracted = Object.values(save.world.orgs)[0].playerIds[0];
    expect("error" in signingPlanFor(save, contracted, { lengthSeasons: 2 }) && signingPlanFor(save, contracted, { lengthSeasons: 2 })).toMatchObject({ error: "windowClosed" });
    const planned = signingPlanFor(save, fas[0].id, { lengthSeasons: 2 });
    expect("plan" in planned && planned.plan.lateSigning).toBe(true);
    const signed = signPlayerFlow(save, fas[0].id, { lengthSeasons: 2 });
    expect(signed.error).toBeUndefined();
    expect(signed.save.lateSigning?.used).toBe(true);
    expect(signPlayerFlow(signed.save, fas[1].id, { lengthSeasons: 2 }).error).toBe("windowClosed");
    // Past the 7 days: closed.
    const after = { ...structuredClone(save), clock: { seasonIndex: 0, day: save.lateSigning!.untilDay + 1 } };
    expect(lateSigningOpen(after)).toBe(false);
  });

  it("the late signing refills the sold seat only: not after a refill inside the window, never as a swap (rc.32 review)", () => {
    const start = beforeWindow1(50_507);
    const seller = start.squad[0];
    const withOffer = untilListingOffer(listForSaleFlow(start, seller.id).save, seller.id);
    let save = acceptBidFlow(withOffer, withOffer.pendingOffers.find((o) => o.listing)!.id).save;
    const sizeAfterSale = save.squad.length;
    expect(save.lateSigning?.squadAfterSale).toBe(sizeAfterSale);
    const ctx = () => ({ careerSeed: save.careerSeed, seasonIndex: 0, world: save.world });
    const freeAgents = () =>
      save.world.freeAgentIds
        .map((id) => playerViewById(id, ctx()))
        .filter((v): v is CareerPlayerView => v !== null && v.age >= 13 && Math.round(v.overall) <= 74);
    // Refill the seat inside the window: the squad is back to its size before the sale.
    const inWindow = signPlayerFlow(save, freeAgents()[0].id, { lengthSeasons: 2 });
    expect(inWindow.error).toBeUndefined();
    save = { ...structuredClone(inWindow.save), pendingEventDef: null, pendingInsert: null, unofficialOffer: null };
    save.clock.day = firstDayOfWeek(13) + 1; // after the window, inside the 7 days
    expect(lateSigningOpen(save)).toBe(false); // the Market no longer offers it
    const fa = freeAgents()[0];
    // No sold seat is left to refill, and the late seat is not a swap either.
    expect(signPlayerFlow(save, fa.id, { lengthSeasons: 2 }).error).toBe("windowClosed");
    expect(signPlayerFlow(save, fa.id, { lengthSeasons: 2, releaseId: save.squad[0].id }).error).toBe("windowClosed");
  });

  it("switch-back: listingEnabled false (rc.31) — no listing; lateSigningDays 0 (option C) — no late seat", () => {
    withConfig(CAREER_TRANSFER, { listingEnabled: false }, () => {
      const save = beforeWindow1(50_505);
      expect(listForSaleFlow(save, save.squad[0].id).error).toBe("listingOff");
    });
    withConfig(CAREER_TRANSFER, { lateSigningDays: 0 }, () => {
      const start = beforeWindow1(50_506);
      const seller = start.squad[0];
      const withOffer = untilListingOffer(listForSaleFlow(start, seller.id).save, seller.id);
      const sold = acceptBidFlow(withOffer, withOffer.pendingOffers.find((o) => o.listing)!.id).save;
      expect(sold.lateSigning ?? null).toBeNull();
    });
  });
});

// ===========================================================================
// The Blockbuster bid: the refusal surcharge, applied and explained
// ===========================================================================

describe("rc.32 — a refused Blockbuster raises that deal's renewal ask (and the copy says so)", () => {
  const blockbuster = (playerId: string, day: number, extra: Partial<TransferOffer> = {}): TransferOffer => ({
    id: `bid:test-bb:${playerId}`,
    direction: "out",
    playerId,
    playerName: playerId,
    fee: 50_000,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: undefined,
    status: "pending",
    resolveSeason: 0,
    resolveDay: day,
    factors: [],
    blockbuster: true,
    ...extra,
  });

  it("declining it stamps the deal, and its renewal asks ×blockbusterRefusalRenewalMult — once", () => {
    const save = createCareerSave(INPUT, 50_601);
    const p = save.squad[0];
    const declined = declineBidFlow({ ...save, pendingOffers: [blockbuster(p.id, 99)] }, `bid:test-bb:${p.id}`);
    const after = declined.squad.find((x) => x.id === p.id)!;
    expect(after.blockbusterRefusedUntil).toBe(after.contractEndSeason);
    const ctx = { rep: save.reputation, seasonIndex: 1, difficulty: save.difficulty, careerSeed: save.careerSeed, lengthSeasons: 2 as const };
    const plain = renewalAskFor(p, ctx);
    const surcharged = renewalAskFor(after, ctx);
    expect(surcharged / plain).toBeCloseTo(CAREER_SALARY.blockbusterRefusalRenewalMult, 1);
    // A renewed deal ends later: the stamp no longer applies.
    expect(blockbusterRefusalApplies({ ...after, contractEndSeason: after.contractEndSeason + 2 })).toBe(false);
    // An ordinary bid declined: no stamp.
    const plainBid = declineBidFlow(
      { ...save, pendingOffers: [blockbuster(p.id, 99, { blockbuster: false })] },
      `bid:test-bb:${p.id}`,
    );
    expect(plainBid.squad.find((x) => x.id === p.id)!.blockbusterRefusedUntil).toBeUndefined();
  });

  it("letting it expire is a refusal too", () => {
    const save = createCareerSave(INPUT, 50_602);
    const p = save.squad[0];
    const next = step({ ...save, pendingOffers: [blockbuster(p.id, save.clock.day)] });
    expect(next.pendingOffers).toEqual([]);
    expect(next.squad.find((x) => x.id === p.id)!.blockbusterRefusedUntil).toBe(p.contractEndSeason);
  });

  it("the offer and the mail explain it — the scripted moment, ×1.5 his value, +10 % at renewal (EN and PT, from balance.ts)", () => {
    const pct = Math.round((CAREER_SALARY.blockbusterRefusalRenewalMult - 1) * 100);
    const mult = String(CAREER_TRANSFER.blockbusterFeeMult);
    for (const [C, shown] of [
      [CAREER_EN, `×${mult}`],
      [CAREER_PT, `×${mult.replace(".", ",")}`], // PT: the decimal comma
    ] as const) {
      const offerLine = C.market.blockbusterWhat("FaZe Clan", mult, pct);
      expect(offerLine).toContain(shown);
      expect(offerLine).toContain(`${pct}%`);
      const mail = C.mail.body.blockbusterBid({ org: "FaZe Clan", player: "Firstkiller", fee: "$80,000", mult: CAREER_TRANSFER.blockbusterFeeMult, pct });
      expect(mail).toContain(shown);
      expect(mail).toContain(`${pct}%`);
      expect(C.market.declineHint(pct)).toContain(`${pct}%`);
    }
  });
});

// ===========================================================================
// The age clock (Miguel, 30/10): +1 a season, 2022-23 → 2024 included
// ===========================================================================

describe("rc.32 — the age clock steps exactly one year a season", () => {
  it("every world player ages exactly +1 at every rollover, 2022-23 → 2024 included", () => {
    const seed = 50_701;
    let world = buildWorldAtCreation(seed);
    for (let s = 0; s < 6; s++) {
      const ctx = { careerSeed: seed, seasonIndex: s, world };
      const ids = [...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds].slice(0, 400);
      const before = new Map(ids.map((id) => [id, playerViewById(id, ctx)?.age]));
      world = agePassAndIntake(world, s + 1, seed, [], s + 1 >= CAREER_SEASONS.length, []).world;
      const next = { careerSeed: seed, seasonIndex: s + 1, world };
      for (const [id, age] of before) {
        const v = playerViewById(id, next);
        if (v && age !== undefined) expect(v.age - age, `${id} at ${s} → ${s + 1}`).toBe(1);
      }
    }
  });

  it("real birth dates give the real age from RLCS 2024 on; inferred debut ages stay in the 13–17 band (±1 for form)", () => {
    const withBirthday = [...playerById.values()].filter((p) => p.birthday).slice(0, 25);
    for (const p of withBirthday) {
      const born = Number(p.birthday!.slice(0, 4));
      expect(ageOf(deriveBirthYear(p.id, 1), 3)).toBe(2024 - born);
      expect(ageOf(deriveBirthYear(p.id, 1), 5)).toBe(2026 - born);
    }
    // Inferred: a player whose first club season is a career season is 13–18 in it on the same clock.
    const world = buildWorldAtCreation(50_702);
    const ctx = { careerSeed: 50_702, seasonIndex: 0, world };
    let checked = 0;
    for (const id of [...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds]) {
      const v = playerViewById(id, ctx);
      if (!v || v.kind !== "real" || playerById.get(id)?.birthday) continue;
      expect(v.age).toBeGreaterThanOrEqual(13);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
    expect(seasonYear(2)).toBe(2023);
  });
});
