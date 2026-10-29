/**
 * Road to Worlds — ECO-02 (Etapa 2b, R46): the Emergency Backer and the bank
 * loan keep their rules through the real flow. The Backer rescues once, a
 * second breach ends the career for good, the bank lends one loan at a time,
 * and what the screens quote is what the ledger books and what a pay-down
 * settles (no unpayable stub left under the $50 quantum).
 */

import { describe, expect, it } from "vitest";
import { CAREER_BANK, CAREER_LOAN, CAREER_SEASONS } from "@/config/balance";
import { dayOfWeekOf, firstDayOfWeek } from "@/engine/career/calendar";
import {
  bankLoanRefusal,
  bankLoanTerms,
  debtPaymentFor,
  nextPaydayFor,
  quantize,
  salePreviewFor,
  weeklyPayroll,
} from "@/engine/career/economy";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import {
  acceptBidFlow,
  advanceDayFlow,
  backerLineOf,
  continueInfiniteFlow,
  createCareerSave,
  payBankLoanFlow,
  payDebtFlow,
  rolloverToNextSeason,
  takeBankLoanFlow,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import { slotMetaFor } from "./careerStore";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Eco Org",
    abbrev: "ECO",
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

function makeSave(seed = 46_046): CareerSave {
  return createCareerSave(INPUT, seed);
}

/** A quiet Sunday: nothing pending, so the next advance is a plain Monday arrival. */
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

describe("ECO-02 — pay-downs settle exactly what they quote", () => {
  it("'pay it all' clears a Backer debt that is not a multiple of the $50 quantum", () => {
    const save = makeSave();
    // A real grant: balance −5,010 → grant 8,010 → owed 9,612 (×1.2).
    save.finances.loan = { remaining: 9_612 };
    save.finances.loanUsed = true;
    save.finances.balance = 20_000;
    const res = payDebtFlow(save, 9_612);
    expect(res.error).toBeUndefined();
    expect(res.save.finances.loan).toBeNull();
    expect(res.save.finances.balance).toBe(20_000 - 9_612);
    const line = res.save.finances.ledger.at(-1)!;
    expect(line.kind).toBe("loanPayment");
    expect(line.amount).toBe(-9_612);
    expect(res.save.news.some((n) => n.titleKey === "debtCleared")).toBe(true);
  });

  it("a stub under the quantum can still be paid (it used to block the bank forever)", () => {
    const save = makeSave();
    save.finances.loan = { remaining: 32 };
    save.finances.loanUsed = true;
    save.finances.balance = 1_000;
    expect(bankLoanRefusal(save.finances, save.reputation, 2_000)).toBe("backer");
    const res = payDebtFlow(save, 32);
    expect(res.error).toBeUndefined();
    expect(res.save.finances.loan).toBeNull();
    expect(bankLoanRefusal(res.save.finances, res.save.reputation, 2_000)).toBeNull();
  });

  it("a partial pay-down stays on the quantum and never overpays", () => {
    const save = makeSave();
    save.finances.loan = { remaining: 9_612 };
    save.finances.loanUsed = true;
    save.finances.balance = 20_000;
    const res = payDebtFlow(save, 1_234);
    expect(res.save.finances.loan?.remaining).toBe(9_612 - quantize(1_234));
    expect(debtPaymentFor(9_612, 1_234)).toBe(quantize(1_234));
    expect(debtPaymentFor(9_612, 9_612)).toBe(9_612);
    expect(debtPaymentFor(9_612, 50_000)).toBe(9_612);
    expect(debtPaymentFor(32, 32)).toBe(32);
    expect(debtPaymentFor(9_612, 20)).toBe(0);
  });

  it("'pay the bank early' settles the exact remainder of a real loan", () => {
    let save = makeSave();
    const res = takeBankLoanFlow(save, 6_000);
    expect(res.error).toBeUndefined();
    save = res.save;
    const owed = save.finances.bankLoan!.remaining;
    expect(owed).toBe(bankLoanTerms(6_000).total);
    expect(owed % 50).not.toBe(0); // 6,720: the case that left a $20 stub
    const paid = payBankLoanFlow(save, owed);
    expect(paid.error).toBeUndefined();
    expect(paid.save.finances.bankLoan).toBeNull();
    expect(paid.save.finances.balance).toBe(save.finances.balance - owed);
  });

  it("a real Backer grant can be cleared in one payment from the Finances quote", () => {
    const save = makeSave();
    const rescued = weeklyPayroll({
      fin: { ...save.finances, balance: -4_990 },
      squadSalaries: [{ name: "A", amount: 1_000 }],
      coachSalary: null,
      sponsor: null,
      rep: 0,
      gear: save.finances.gear,
      seasonIndex: 0,
      week: 5,
      difficulty: "normal",
    });
    expect(rescued.rescued).toBe(true);
    const owed = rescued.fin.loan!.remaining;
    const flush = { ...save, finances: { ...rescued.fin, balance: owed + 1_000 } };
    const res = payDebtFlow(flush, owed);
    expect(res.save.finances.loan).toBeNull();
    expect(res.save.finances.balance).toBe(1_000);
  });
});

describe("ECO-02 — the Backer once, the bank one at a time (real day clock)", () => {
  // rc.32 (M4, provisional): on Hard the second breach ends the career (rc.31's
  // rule everywhere); Normal restructures it first (careerEco04.test.ts).
  it("a structural deficit gets exactly one rescue, then on Hard the second breach ends the career", () => {
    let save = createCareerSave({ ...INPUT, difficulty: "hard" }, 46_101);
    // Wages far above any income: every Monday burns ~$2.8k.
    for (const p of save.squad) p.salaryPerSplit = 10_000;
    save = quietSunday(save, 2);
    save.finances.balance = 2_000;
    let guard = 0;
    while (save.phase === "running" && guard++ < 400) {
      const before = save.clock.day;
      save = advanceDayFlow(save);
      if (save.clock.day === before && save.phase === "running") {
        // A matchday or an insert blocks the clock: this test only follows the money.
        save = { ...structuredClone(save), pendingEventDef: null, pendingInsert: null };
      }
    }
    expect(save.phase).toBe("ended");
    expect(save.end.reason).toBe("insolvency");
    const grants = save.finances.ledger.filter((l) => l.kind === "loanGrant");
    expect(grants).toHaveLength(1);
    expect(save.finances.loanUsed).toBe(true);
    // Ended means ended: no more days, no rollover, no endless era.
    expect(advanceDayFlow(save)).toBe(save);
    expect(rolloverToNextSeason(save).phase).toBe("ended");
    expect(continueInfiniteFlow(save).phase).toBe("ended");
  });

  it("the bank refuses a second loan and any loan while the Backer is owed — the flow reads bankLoanRefusal", () => {
    let save = makeSave();
    const first = takeBankLoanFlow(save, 2_000);
    expect(first.error).toBeUndefined();
    save = first.save;
    expect(takeBankLoanFlow(save, 1_000).error).toBe("bankActive");
    expect(save.finances.ledger.filter((l) => l.kind === "bankLoan")).toHaveLength(1);
    const backer = makeSave();
    backer.finances.loan = { remaining: 4_000 };
    backer.finances.loanUsed = true;
    expect(takeBankLoanFlow(backer, 2_000).error).toBe("bankBacker");
    expect(takeBankLoanFlow(makeSave(), CAREER_BANK.maxByRepTier[4] + 50).error).toBe("bankLimit");
    expect(takeBankLoanFlow(makeSave(), CAREER_BANK.minAmount - 50).error).toBe("bankAmount");
  });

  it("the Monday ledger books exactly the statement Finances and HQ show", () => {
    let save = makeSave();
    save = takeBankLoanFlow(save, 3_000).save;
    save = quietSunday(save, 3);
    // rc.32: the screens read weeklyStatementOf (the season's money index, the founding partner).
    const quoted = weeklyStatementOf(save);
    const before = save.finances.balance;
    const seen = new Set(save.finances.ledger.map((l) => l.id));
    const monday = advanceDayFlow(save);
    expect(dayOfWeekOf(monday.clock.day)).toBe(1);
    const booked = monday.finances.ledger.filter((l) => !seen.has(l.id));
    expect(booked.reduce((s, l) => s + l.amount, 0)).toBe(quoted.net);
    expect(monday.finances.balance).toBe(before + quoted.net);
    const instalment = booked.find((l) => l.kind === "bankPayment");
    expect(-instalment!.amount).toBe(quoted.bankPayment);
  });

  it("nextPaydayFor names the next Monday the books move (the next season's opener after week 32)", () => {
    expect(nextPaydayFor({ seasonIndex: 0, day: 1 })).toEqual({ seasonIndex: 0, day: 8 });
    expect(nextPaydayFor({ seasonIndex: 1, day: 8 })).toEqual({ seasonIndex: 1, day: 15 });
    expect(nextPaydayFor({ seasonIndex: 1, day: 10 })).toEqual({ seasonIndex: 1, day: 15 });
    expect(nextPaydayFor({ seasonIndex: 2, day: 220 })).toEqual({ seasonIndex: 3, day: 1 });
  });
});

describe("ECO-02 — insolvency is final, whatever ending came before", () => {
  function brokeAfter(reason: "worlds_won" | "timeline_complete"): CareerSave {
    const save = quietSunday(makeSave(46_202), 4);
    if (reason === "timeline_complete") save.clock.seasonIndex = CAREER_SEASONS.length;
    else save.clock.seasonIndex = 1;
    save.end = {
      ended: true,
      infinite: reason === "timeline_complete",
      creditsShown: true,
      reason,
      endedSeasonIndex: 0,
      legacyGrade: "legend",
    };
    save.finances.loanUsed = true;
    // rc.32 (M4): one breach before the one that ends a Normal career.
    save.finances.loanBreaches = (CAREER_LOAN.breachesToEnd.normal ?? 2) - 1;
    save.finances.loan = null;
    for (const p of save.squad) p.salaryPerSplit = 10_000;
    save.finances.balance = backerLineOf(save).floor + 10;
    return save;
  }

  for (const prior of ["worlds_won", "timeline_complete"] as const) {
    it(`a second breach after '${prior}' records the insolvency and cannot be continued`, () => {
      const broke = advanceDayFlow(brokeAfter(prior));
      expect(broke.phase).toBe("ended");
      expect(broke.end.reason).toBe("insolvency");
      // The legacy grade the career earned stays on the record.
      expect(broke.end.legacyGrade).toBe("legend");
      expect(rolloverToNextSeason(broke).phase).toBe("ended");
      expect(rolloverToNextSeason(broke).clock).toEqual(broke.clock);
      expect(continueInfiniteFlow(broke).phase).toBe("ended");
      // The saves picker archives it.
      expect(slotMetaFor([broke])[0]?.ended).toBe(true);
    });
  }
});

describe("ECO-02 — a sale's preview is what the ledger books", () => {
  /** A $20k bid for the first starter, with `owed` on the Backer (0 = none). */
  function sale(owed: number): { save: CareerSave; offer: TransferOffer } {
    const save = makeSave(46_404);
    if (owed > 0) {
      save.finances.loan = { remaining: owed };
      save.finances.loanUsed = true;
    }
    const offer: TransferOffer = {
      id: "bid:preview",
      direction: "out",
      playerId: save.starterIds[0],
      playerName: "Seller",
      fee: 20_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: Object.values(save.world.orgs).find((o) => o.region === "SAM")!.ref,
      status: "pending",
      resolveSeason: save.clock.seasonIndex,
      resolveDay: save.clock.day + 7,
      factors: [],
    };
    save.pendingOffers = [offer];
    return { save, offer };
  }

  // Nothing owed; a debt the sale clears (half the fee covers it); a debt it only cuts.
  for (const owed of [0, 9_612, 30_000]) {
    it(`Backer owed $${owed}: the balance after, the Backer's share and the debt left`, () => {
      const { save, offer } = sale(owed);
      const preview = salePreviewFor(save.finances, offer.fee);
      const res = acceptBidFlow(save, offer.id);
      expect(res.error).toBeUndefined();
      const booked = res.save.finances.ledger.slice(save.finances.ledger.length);
      expect(booked.reduce((sum, l) => sum + l.amount, 0)).toBe(preview.net);
      expect(res.save.finances.balance).toBe(preview.balanceAfter);
      const garnish = booked.find((l) => l.kind === "loanGarnish");
      expect(garnish ? -garnish.amount : 0).toBe(preview.garnished);
      expect(res.save.finances.loan?.remaining ?? 0).toBe(Math.max(0, owed - preview.garnished));
      if (owed === 0) expect(preview).toEqual({ garnished: 0, net: offer.fee, balanceAfter: save.finances.balance + offer.fee });
      else expect(preview.garnished).toBe(Math.min(owed, quantize(CAREER_LOAN.saleGarnishRate * offer.fee)));
    });
  }
});
