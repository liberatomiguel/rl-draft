/**
 * Road to Worlds — rc.37 F2 (finances and crisis), the flow half:
 *
 *  - package 3, the emergency sale: a save in the red receives an EXTRA
 *    offer outside the windows, at CAREER_EMERGENCY_SALE.feeRange × the
 *    player's value; one at a time, the cooldown between two, none during
 *    the user's event or for a locked player; accepting books the fee net of
 *    the emergency loan's share.
 *  - package 2, the bank's offer: the Monday the runway reaches the warning
 *    level, a "creditOffer" notice with the loan's numbers; accepting takes
 *    exactly that loan; one per cooldown; never while the emergency loan is
 *    owed. The floor stays at −8 weeks.
 *  - package 4, the alerts: a one-off spend that brings the breach within
 *    reach raises "spendRisk" at once; the season-close outlook.
 *
 * processDayArrival is driven directly (as advanceDayFlow does, without its
 * decision holds) so each day's rolls are read in isolation.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_BANK,
  CAREER_CREDIT_OFFER,
  CAREER_EMERGENCY_SALE,
  CAREER_GEAR,
  CAREER_LOAN,
} from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import { DAYS_PER_SEASON, firstDayOfWeek, weekAt, weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import {
  bankLoanTerms,
  gearPriceFor,
  quantize,
  saleGarnishFor,
  weeklyWageBill,
} from "@/engine/career/economy";
import { emergencyOfferForDay, emergencyValueOf } from "@/engine/career/emergencySale";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { moneyNoticeTextOf } from "@/components/career/MoneyNoticeModal";
import {
  acceptBidFlow,
  acceptCreditOfferFlow,
  acknowledgeMoneyNoticeFlow,
  backerLineOf,
  buyGearFlow,
  createCareerSave,
  declineBidFlow,
  moneyNoticeOf,
  processDayArrival,
  seasonOutlookOf,
  spendAlertFlow,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Finance Org",
    abbrev: "FIN",
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

/** The next day's arrival, as advanceDayFlow books it — without the decision holds. */
function arrive(save: CareerSave): CareerSave {
  return processDayArrival({ ...save, clock: { ...save.clock, day: save.clock.day + 1 } });
}

/** A quiet Sunday of `week`: nothing pending, no prompts. */
function quietSunday(save: CareerSave, week: number): CareerSave {
  const next = structuredClone(save);
  next.clock.day = firstDayOfWeek(week) + 6;
  next.pendingEventDef = null;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.sponsorOffers = null;
  next.pendingOffers = [];
  next.moneyNotices = [];
  next.prefs.autoEnterUnofficials = false;
  return next;
}

/** The first week from `from` with no transfer window and no official event. */
function plainWeek(from = 2): number {
  for (let w = from; w <= 32; w++) if (windowIndexOf(w) === null && weekAt(w).kind === "open") return w;
  throw new Error("no plain week");
}

/** A career whose wage bill no income carries (every Monday burns). */
function heavyCareer(seed: number): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (const [i, p] of save.squad.entries()) p.salaryPerSplit = 10_000 + i * 1_000;
  return save;
}

const emergencyOf = (save: CareerSave) => save.pendingOffers.find((o) => o.status === "pending" && o.emergency);

/** Arrive day by day (at most `days`) until an emergency offer is pending; the save at that day. */
function untilEmergencyOffer(save: CareerSave, days: number): CareerSave {
  let s = save;
  for (let i = 0; i < days && !emergencyOf(s); i++) s = arrive(s);
  return s;
}

// ===========================================================================
// Package 3 — the emergency sale
// ===========================================================================

describe("rc.37 F2 — the emergency sale", () => {
  const week = plainWeek();
  const inTheRed = (seed: number, balance = -100): CareerSave => {
    const save = quietSunday(createCareerSave(INPUT, seed), week - 1);
    save.finances.balance = balance;
    return save;
  };

  it("a case in the red receives an extra offer outside the windows, at 65–80% of the player's value", () => {
    const save = untilEmergencyOffer(inTheRed(73_001), 7);
    const offer = emergencyOf(save)!;
    expect(offer).toBeDefined();
    expect(offer.direction).toBe("out");
    expect(windowIndexOf(weekOfDay(save.clock.day))).toBeNull();
    const player = save.squad.find((p) => p.id === offer.playerId)!;
    const value = emergencyValueOf(player, save.clock.seasonIndex, save.careerSeed);
    const [lo, hi] = CAREER_EMERGENCY_SALE.feeRange;
    expect(offer.fee).toBeGreaterThanOrEqual(lo * value - 50); // quantized toward zero
    expect(offer.fee).toBeLessThanOrEqual(hi * value);
    expect(offer.resolveDay).toBe(save.clock.day + CAREER_EMERGENCY_SALE.validDays);
    expect(save.finances.emergencySaleAt).toEqual({ seasonIndex: save.clock.seasonIndex, day: save.clock.day });
    const mail = save.mail.find((m) => m.titleKey === "emergencyBid")!;
    expect(mail).toMatchObject({ kind: "offer", linkTo: "/career/market" });
    expect(mail.params).toMatchObject({ player: offer.playerName, fee: offer.fee });
    // A private operation (communications.newsChannelOf): its news line folds into that one mail, as incomingBid's does.
    expect(save.mail.filter((m) => m.titleKey === "emergencyBid")).toHaveLength(1);
  });

  it("one at a time, and none before the cooldown — a declined offer is not replaced at once", () => {
    const first = untilEmergencyOffer(inTheRed(73_002), 7);
    const offer = emergencyOf(first)!;
    expect(offer).toBeDefined();
    const arrived = first.clock.day;
    // While it is pending, no second one.
    let s = first;
    for (let d = 1; d < CAREER_EMERGENCY_SALE.validDays; d++) {
      s = arrive(s);
      expect(s.pendingOffers.filter((o) => o.emergency)).toHaveLength(1);
    }
    // Declined: still none until the cooldown from its arrival is over.
    s = declineBidFlow(s, offer.id);
    while (s.clock.day < arrived + CAREER_EMERGENCY_SALE.cooldownDays - 1) {
      s = arrive(s);
      expect(emergencyOf(s)).toBeUndefined();
    }
  });

  it("no offer while the balance is at or above zero", () => {
    let s = inTheRed(73_003, 50_000);
    for (let d = 0; d < 14; d++) {
      s = arrive(s);
      expect(emergencyOf(s)).toBeUndefined();
    }
  });

  it("no offer during the user's event, none for a locked player (the resale lock's hook)", () => {
    const save = inTheRed(73_004);
    const ctx = (day: number) => ({
      world: save.world,
      squad: save.squad,
      seasonIndex: 0,
      day,
      careerSeed: save.careerSeed,
      balance: -100,
      inEvent: false,
      pending: [],
      lastOffer: null,
      isLocked: () => false,
    });
    let open = 0;
    for (let day = 1; day <= 60; day++) {
      if (emergencyOfferForDay(ctx(day))) open++;
      expect(emergencyOfferForDay({ ...ctx(day), inEvent: true })).toBeNull();
      expect(emergencyOfferForDay({ ...ctx(day), isLocked: () => true })).toBeNull();
    }
    expect(open).toBeGreaterThan(0);
  });

  it("accepting sells at once: the fee less the emergency loan's share, his wages gone; never during an event", () => {
    const start = inTheRed(73_005);
    start.finances.loan = { remaining: 50_000 };
    const save = untilEmergencyOffer(start, 7);
    const offer = emergencyOf(save)!;
    expect(offer).toBeDefined();
    const locked = acceptBidFlow({ ...save, activeEvent: {} as CareerSave["activeEvent"] }, offer.id);
    expect(locked.error).toBe("rosterLocked");
    const res = acceptBidFlow(save, offer.id);
    expect(res.error).toBeUndefined();
    const garnish = saleGarnishFor(save.finances.loan, offer.fee);
    expect(garnish).toBe(quantize(CAREER_LOAN.saleGarnishRate * offer.fee));
    expect(res.save.finances.balance).toBe(save.finances.balance + offer.fee - garnish);
    expect(res.save.finances.loan!.remaining).toBe(50_000 - garnish);
    expect(res.save.squad.some((p) => p.id === offer.playerId)).toBe(false);
    expect(weeklyStatementOf(res.save).payroll).toBeLessThan(weeklyStatementOf(save).payroll);
  });
});

// ===========================================================================
// Package 2 — the bank's offer before the floor
// ===========================================================================

describe("rc.37 F2 — the bank offers its loan before the floor", () => {
  /** The Monday of `week + 1` with the runway at `weeks` (the burn ×weeks on the balance after its payroll). */
  const mondayWithRunway = (save: CareerSave, week: number, weeks: number): CareerSave => {
    const sunday = quietSunday(save, week);
    sunday.reputation = 45; // a bank limit the squeeze fits in
    const burn = -weeklyStatementOf(sunday).net;
    expect(burn).toBeGreaterThan(0);
    sunday.finances.balance = burn * (weeks + 1) + burn / 2;
    return arrive(sunday);
  };

  it("the floor stays at −8 weeks of payroll (decision: a −4 floor was rejected)", () => {
    expect(CAREER_LOAN.floorWeeks).toBe(8);
    const save = heavyCareer(73_100);
    const bill = weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null);
    expect(backerLineOf(save).floor).toBe(-quantize(8 * bill));
  });

  it("at the warning level: a notice with what lands, the total repaid and the term — and the bank's mail", () => {
    const save = mondayWithRunway(heavyCareer(73_101), 3, 2);
    expect(save.finances.loan).toBeNull();
    const notice = save.moneyNotices!.find((n) => n.kind === "creditOffer")!;
    expect(notice).toBeDefined();
    const principal = Number(notice.params.principal);
    expect(principal).toBeGreaterThan(0);
    expect(notice.params.loanNet).toBe(principal);
    expect(notice.params.loanTotal).toBe(bankLoanTerms(principal).total);
    expect(notice.params.loanWeekly).toBe(bankLoanTerms(principal).weeklyPayment);
    expect(notice.params.loanTerm).toBe(CAREER_BANK.termWeeks);
    expect(save.mail.some((m) => m.titleKey === "creditOffer" && m.fromKey === "bank")).toBe(true);
    // The words carry the three numbers in both languages.
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      const text = moneyNoticeTextOf(C, notice, save.clock);
      const all = [text.lead, ...text.rows.flat(), text.foot ?? ""].join(" ");
      for (const key of ["loanNet", "loanTotal", "loanWeekly"]) expect(all).toContain(formatMoney(Number(notice.params[key])));
      expect(all).toContain(String(CAREER_BANK.termWeeks));
    }
  });

  it("accepting takes exactly that loan and closes the notice", () => {
    const save = mondayWithRunway(heavyCareer(73_102), 3, 2);
    const notice = save.moneyNotices!.find((n) => n.kind === "creditOffer")!;
    const res = acceptCreditOfferFlow(save, notice.id);
    expect(res.error).toBeUndefined();
    expect(res.save.finances.bankLoan!.principal).toBe(Number(notice.params.principal));
    expect(res.save.finances.balance).toBe(save.finances.balance + Number(notice.params.principal));
    expect((res.save.moneyNotices ?? []).some((n) => n.id === notice.id)).toBe(false);
    // An unknown notice borrows nothing.
    expect(acceptCreditOfferFlow(save, "nope").error).toBe("none");
  });

  it("one offer per cooldown: the next Monday's squeeze brings none", () => {
    const first = mondayWithRunway(heavyCareer(73_103), 3, 2);
    expect(first.finances.creditOfferAt).toEqual({ seasonIndex: 0, week: 4 });
    const next = mondayWithRunway(acknowledgeMoneyNoticeFlow(first), 4, 2);
    expect((next.moneyNotices ?? []).some((n) => n.kind === "creditOffer")).toBe(false);
    expect(CAREER_CREDIT_OFFER.cooldownWeeks).toBeGreaterThan(1);
  });

  it("never while the emergency loan is owed (one debt at a time)", () => {
    const save = heavyCareer(73_104);
    save.finances.loan = { remaining: 1_000 };
    const monday = mondayWithRunway(save, 3, 2);
    expect((monday.moneyNotices ?? []).some((n) => n.kind === "creditOffer")).toBe(false);
  });
});

// ===========================================================================
// Package 4 — the alerts
// ===========================================================================

describe("rc.37 F2 — a one-off spend that brings the floor close raises its notice at once", () => {
  /** A Tuesday with the books `aboveFloor` burns over the floor (rep 50: gear open, a bank limit). */
  const tuesday = (aboveFloor: number, seed = 73_200): CareerSave => {
    const save = quietSunday(heavyCareer(seed), 3);
    save.clock.day = firstDayOfWeek(4) + 1;
    save.reputation = 50;
    const burn = -weeklyStatementOf(save).net;
    save.finances.balance = backerLineOf(save).floor + aboveFloor * burn;
    return save;
  };

  it("buying gear that leaves the next breach within reach: the notice, with the bank's offer", () => {
    const prev = tuesday(0);
    const burn = -weeklyStatementOf(prev).net;
    const price = gearPriceFor(CAREER_GEAR.items[0].cost, null, 0);
    prev.finances.balance = backerLineOf(prev).floor + 3.9 * burn + price;
    const bought = buyGearFlow(prev, CAREER_GEAR.items[0].id);
    expect(bought.error).toBeUndefined();
    const next = spendAlertFlow(prev, bought.save);
    const notice = moneyNoticeOf(next)!;
    expect(notice.kind).toBe("spendRisk");
    expect(notice.params.spent).toBe(price);
    expect(Number(notice.params.mondays)).toBeLessThanOrEqual(4);
    expect(notice.params.offer).toBe(1);
    expect(Number(notice.params.principal)).toBeGreaterThan(0);
    expect(next.finances.creditOfferAt).toBeDefined();
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      expect(moneyNoticeTextOf(C, notice, next.clock).title.length).toBeGreaterThan(5);
    }
  });

  it("nothing for a spend that keeps the floor far, or when the clock moved (an Advance's Monday)", () => {
    const prev = tuesday(30);
    const small = structuredClone(prev);
    small.finances.balance -= 100;
    expect(spendAlertFlow(prev, small)).toBe(small);
    const moved = structuredClone(prev);
    moved.clock.day += 1;
    moved.finances.balance = backerLineOf(prev).floor + 1;
    expect(spendAlertFlow(prev, moved)).toBe(moved);
  });

  it("with a bank loan already running the notice still warns, without an offer", () => {
    const prev = tuesday(5.5, 73_201);
    prev.finances.bankLoan = { principal: 5_000, remaining: 3_000, weeklyPayment: 350, takenSeason: 0, takenWeek: 1 };
    const burn = -weeklyStatementOf(prev).net;
    prev.finances.balance = backerLineOf(prev).floor + 5.5 * burn;
    const next = structuredClone(prev);
    next.finances.balance -= 2 * burn;
    const notice = moneyNoticeOf(spendAlertFlow(prev, next))!;
    expect(notice.kind).toBe("spendRisk");
    expect(notice.params.offer).toBe(0);
    expect(notice.params.principal).toBeUndefined();
  });
});

describe("rc.37 F2 — the season-close outlook", () => {
  const atReview = (): CareerSave => {
    const save = createCareerSave(INPUT, 73_300);
    save.clock.day = DAYS_PER_SEASON;
    for (const p of save.squad) {
      p.contractEndSeason = 2;
      delete p.finalSeasonAnnounced;
    }
    save.squad[0].contractEndSeason = 0; // expiring, not renewed
    save.squad[1].finalSeasonAnnounced = true; // retires at the rollover
    save.finances.loan = { remaining: 12_000, deadline: { seasonIndex: 1, week: 10 } };
    save.finances.bankLoan = { principal: 6_000, remaining: 3_400, weeklyPayment: 420, takenSeason: 0, takenWeek: 20 };
    return save;
  };

  it("next season's wage bill after the review, who leaves, what is owed and by when, the retirements", () => {
    const save = atReview();
    const view = seasonOutlookOf(save);
    const stays = save.squad.slice(2).map((p) => p.salaryPerSplit);
    expect(view.payrollNext).toBe(weeklyWageBill(stays, save.coach?.salaryPerSplit ?? null));
    expect(view.payrollNow).toBe(weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null));
    expect(view.leaving).toEqual([save.squad[0].name]);
    expect(view.retirements).toContainEqual({ playerId: save.squad[1].id, name: save.squad[1].name, when: "now" });
    expect(view.debt).toEqual({ emergency: 12_000, bank: 3_400, total: 15_400 });
    expect(view.deadline).toEqual({ seasonIndex: 1, week: 10, weeksLeft: 10 });
    expect(view.bankInstalmentsLeft).toBe(Math.ceil(3_400 / 420));
  });

  it("the cash to the first regional: next season's net over the Mondays to it, no prize counted", () => {
    const save = atReview();
    const view = seasonOutlookOf(save);
    const firstRegional = Array.from({ length: 32 }, (_, i) => i + 1).find((w) => weekAt(w).kind === "regional")!;
    expect(view.nextIncome.week).toBe(firstRegional);
    expect(view.nextIncome.mondays).toBe(firstRegional);
    expect(view.nextIncome.balanceAtIt).toBe(save.finances.balance + firstRegional * view.nextIncome.weeklyNetNext);
  });

  it("is live: a renewal moves it", () => {
    const save = atReview();
    const before = seasonOutlookOf(save);
    save.squad[0].contractEndSeason = 2;
    const after = seasonOutlookOf(save);
    expect(after.leaving).toEqual([]);
    expect(after.payrollNext).toBeGreaterThan(before.payrollNext);
  });
});
