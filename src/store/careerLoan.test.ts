/**
 * Road to Worlds — rc.34 front H (Miguel, 31/10): the money, the rescue and
 * the debt. Every number reads its balance.ts key.
 *
 *  - A breach is the bank's EMERGENCY LOAN (not an investor): lent back to
 *    the rescue target, owed ×repayFactor, due CAREER_LOAN.emergency.
 *    deadlineWeeks on; the investor (rc.33's rescue partner) joins only the
 *    career's first loan, where its difficulty has a share (Easy).
 *  - A later breach while it is owed adds to it (same deadline, capped); on
 *    the deadline the bank takes what it is owed if the balance covers it,
 *    otherwise the career ends. Warnings 8 and 4 Mondays before.
 *  - A modal notice explains each of those money events, once per save; the
 *    batched Advance stops on the Monday one is raised.
 *  - Nothing is locked while the loan is owed (lockCommitments false).
 *  - An rc.33 save that owes the Backer loads into the bank's loan.
 *  - Every founding roster starts with the same runway in weeks.
 */

import { describe, expect, it } from "vitest";
import { CAREER_ECONOMY, CAREER_GEAR, CAREER_LOAN, CAREER_UNLOCKS } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import { firstDayOfWeek, weekOfDay } from "@/engine/career/calendar";
import {
  applyPrize,
  deadlineWeeksFor,
  emergencyLoansOf,
  investorJoinsNext,
  investorWeeklyFor,
  mondayAfter,
  quantize,
  startingBudgetFor,
  weeklyWage,
  weeklyWageBill,
} from "@/engine/career/economy";
import type { CareerDifficulty, CareerSave, MailItem } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { moneyNoticeTextOf } from "@/components/career/MoneyNoticeModal";
import {
  acknowledgeMoneyNoticeFlow,
  advanceDayFlow,
  advanceToNextStopFlow,
  backerLineOf,
  buyGearFlow,
  createCareerSave,
  emergencyLoanViewOf,
  migrateSaveToV5,
  moneyNoticeOf,
  moneyNoticeRaisedToday,
  payDebtFlow,
  repairLoanOnLoad,
  signingPlanFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Loan Org",
    abbrev: "LON",
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

const DIFFS: CareerDifficulty[] = ["easy", "normal", "hard"];

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

/** The Monday of `week + 1` with the books `delta` from the floor (negative = a breach). */
function mondayAtFloor(save: CareerSave, week: number, delta: number): CareerSave {
  const sunday = quietSunday(save, week);
  sunday.finances.balance = backerLineOf(sunday).floor + delta;
  return advanceDayFlow(sunday);
}

/** The Monday of `week + 1` with the books at `balance` on Sunday. */
function mondayAt(save: CareerSave, week: number, balance: number): CareerSave {
  const sunday = quietSunday(save, week);
  sunday.finances.balance = balance;
  return advanceDayFlow(sunday);
}

/** A career on `difficulty` with a wage bill no income carries (every Monday burns). */
function heavyCareer(difficulty: CareerDifficulty, seed: number): CareerSave {
  const save = createCareerSave({ ...INPUT, difficulty }, seed);
  for (const [i, p] of save.squad.entries()) p.salaryPerSplit = 10_000 + i * 1_000;
  return save;
}

const mailOf = (save: CareerSave, titleKey: string): MailItem[] => save.mail.filter((m) => m.titleKey === titleKey);

/** Run `fn` with CAREER_LOAN.lockCommitments temporarily set. */
function withLock<T>(on: boolean, fn: () => T): T {
  const keys = CAREER_LOAN as { lockCommitments: boolean };
  const saved = keys.lockCommitments;
  keys.lockCommitments = on;
  try {
    return fn();
  } finally {
    keys.lockCommitments = saved;
  }
}

// ===========================================================================
// The loan
// ===========================================================================

describe("rc.34 — a breach is the bank's emergency loan", () => {
  it("on every difficulty: lent back to the rescue target, owed ×repayFactor, due deadlineWeeks on — the investor only on Easy's first", () => {
    expect(CAREER_LOAN.emergency.deadlineWeeks).toEqual({ easy: 64, normal: 48, hard: 24 });
    for (const d of DIFFS) {
      const sunday = quietSunday(heavyCareer(d, 71_001), 2);
      sunday.finances.balance = backerLineOf(sunday).floor - 10;
      const save = advanceDayFlow(sunday);
      expect(save.phase, d).toBe("running");
      const line = backerLineOf(save);
      expect(save.finances.balance, d).toBe(line.rescueTo);
      const grant = save.finances.ledger.filter((l) => l.kind === "loanGrant");
      expect(grant, d).toHaveLength(1);
      const lent = grant[0].amount;
      expect(save.finances.loan, d).toMatchObject({
        remaining: Math.round(lent * CAREER_LOAN.repayFactor),
        lent,
        topUps: 0,
        openedAt: { seasonIndex: 0, week: 3 },
        deadline: mondayAfter({ seasonIndex: 0, week: 3 }, CAREER_LOAN.emergency.deadlineWeeks[d]!),
      });
      expect(emergencyLoansOf(save.finances)).toBe(1);
      // The bank sends it, with the deadline and the investor where one comes.
      const mail = mailOf(save, "emergencyLoan")[0];
      expect(mail.fromKey).toBe("bank");
      expect(mail.params).toMatchObject({ dlWeek: save.finances.loan!.deadline!.week, dlWeeks: CAREER_LOAN.emergency.deadlineWeeks[d] });
      const bill = weeklyStatementOf(save).payroll + weeklyStatementOf(save).coach;
      if (d === "easy") {
        expect(save.finances.rescuePartner).toEqual({ weekly: investorWeeklyFor(bill, d), mondaysLeft: CAREER_LOAN.investor.weeks });
        expect(mail.params!.partnerWeekly).toBeGreaterThan(0);
      } else {
        expect(save.finances.rescuePartner ?? null, d).toBeNull();
        expect(mail.params!.partnerWeekly).toBe(0);
      }
    }
    // Hard has the shortest term, Easy the longest; the investor's share is light (20–25 % band).
    expect(deadlineWeeksFor("hard")!).toBeLessThan(deadlineWeeksFor("normal")!);
    expect(deadlineWeeksFor("normal")!).toBeLessThan(deadlineWeeksFor("easy")!);
    expect(CAREER_LOAN.investor.payrollShare.easy!).toBeGreaterThanOrEqual(0.2);
    expect(CAREER_LOAN.investor.payrollShare.easy!).toBeLessThanOrEqual(0.25);
  });

  it("the investor joins only the career's first loan: a loan opened after one was repaid comes alone", () => {
    let save = mondayAtFloor(heavyCareer("easy", 71_002), 2, -10);
    expect(save.finances.rescuePartner).not.toBeNull();
    // Repay it all, the investor's run over.
    save = structuredClone(save);
    save.finances.balance = 1_000_000;
    save = payDebtFlow(save, save.finances.loan!.remaining).save;
    expect(save.finances.loan).toBeNull();
    expect(mailOf(save, "debtCleared")[0]?.fromKey).toBe("bank");
    save.finances.rescuePartner = null;
    expect(investorJoinsNext(save.finances, "easy")).toBe(false);
    save = mondayAtFloor(save, 3, -10);
    expect(save.finances.loan).not.toBeNull();
    expect(emergencyLoansOf(save.finances)).toBe(2);
    expect(save.finances.rescuePartner ?? null).toBeNull();
    expect(mailOf(save, "emergencyLoan").at(0)!.params!.partnerWeekly).toBe(0);
  });

  it("a later breach while it is owed adds to the debt — the deadline stays — and the cap ends a spiral", () => {
    let save = mondayAtFloor(heavyCareer("normal", 71_003), 2, -10);
    const first = structuredClone(save.finances.loan!);
    save = mondayAtFloor(save, 3, -10);
    const loan = save.finances.loan!;
    expect(loan.deadline).toEqual(first.deadline);
    expect(loan.openedAt).toEqual(first.openedAt);
    expect(loan.topUps).toBe(1);
    expect(loan.remaining).toBeGreaterThan(first.remaining);
    expect(loan.lent).toBeGreaterThan(first.lent!);
    expect(emergencyLoansOf(save.finances)).toBe(1);
    expect(mailOf(save, "emergencyTopUp")).toHaveLength(1);
    expect(moneyNoticeOf(save)?.kind).toBe("loanOpened");
    expect(save.moneyNotices!.at(-1)!.kind).toBe("loanTopUp");
    // Up to the cap, then the bank lends no more.
    const cap = CAREER_LOAN.emergency.maxTopUps!;
    for (let w = 4; save.phase === "running" && w < 4 + cap + 2; w++) save = mondayAtFloor(save, w, -10);
    expect(save.phase).toBe("ended");
    expect(save.end).toMatchObject({ reason: "insolvency", moneyCause: "breach" });
    expect(save.moneyNotices!.at(-1)).toMatchObject({ kind: "careerEnded", params: { cause: "breach", topUps: cap } });
  });

  it("prizes and sales repay it on the way; the loan keeps its deadline and top-ups through each payment", () => {
    const save = mondayAtFloor(heavyCareer("normal", 71_004), 2, -10);
    const loan = save.finances.loan!;
    const paid = applyPrize(save.finances, 40_000, {
      seasonIndex: 0,
      week: 3,
      refName: "Cup",
      difficulty: "normal",
    });
    expect(paid.garnished).toBe(quantize(CAREER_LOAN.garnishRate.normal * 40_000));
    expect(paid.fin.loan).toEqual({ ...loan, remaining: loan.remaining - paid.garnished });
  });
});

// ===========================================================================
// The deadline
// ===========================================================================

describe("rc.34 — the deadline: repaid, collected, or the end", () => {
  /** A Hard loan opened on week 3's Monday (its 24-week term ends inside the season), and the Monday it is due. */
  function owing(seed: number): { save: CareerSave; dueWeek: number } {
    const save = mondayAtFloor(heavyCareer("hard", seed), 2, -10);
    const deadline = save.finances.loan!.deadline!;
    expect(deadline.seasonIndex).toBe(0);
    return { save, dueWeek: deadline.week };
  }

  it("repaid in time ('Pay it all' from Finances): the deadline is lifted and the career goes on", () => {
    const { save: opened, dueWeek } = owing(71_101);
    let save = opened;
    save = structuredClone(save);
    save.finances.balance += save.finances.loan!.remaining;
    const res = payDebtFlow(save, save.finances.loan!.remaining);
    expect(res.error).toBeUndefined();
    save = res.save;
    expect(save.finances.loan).toBeNull();
    expect(emergencyLoanViewOf(save)).toBeNull();
    // The deadline Monday comes and goes: nothing is collected, nothing ends.
    save = mondayAt(save, dueWeek - 1, 50_000);
    expect(save.phase).toBe("running");
    expect(save.moneyNotices?.some((n) => n.kind === "careerEnded" || n.kind === "deadlineCollected")).toBe(false);
  });

  it("partly repaid and the balance covers the rest on the day: the bank takes exactly what is owed, a notice says so", () => {
    const { save: opened, dueWeek } = owing(71_102);
    let save = opened;
    save = structuredClone(save);
    save.finances.balance += 5_000;
    save = payDebtFlow(save, 5_000).save;
    const owed = save.finances.loan!.remaining;
    // The Sunday before the deadline: enough to cover the debt after Monday's payroll.
    const sunday = quietSunday(save, dueWeek - 1);
    const net = weeklyStatementOf(sunday).net;
    sunday.finances.balance = owed - net + 1_000;
    save = advanceDayFlow(sunday);
    expect(save.phase).toBe("running");
    expect(save.finances.loan).toBeNull();
    const collected = save.finances.ledger.filter((l) => l.kind === "loanPayment" && l.day === save.clock.day);
    expect(collected.map((l) => l.amount)).toEqual([-owed]);
    expect(save.finances.balance).toBe(1_000);
    expect(mailOf(save, "loanCollected")).toHaveLength(1);
    expect(save.moneyNotices!.some((n) => n.kind === "deadlineCollected" && n.params.collected === owed)).toBe(true);
    expect(moneyNoticeRaisedToday(save)).toBe(true);
  });

  it("unpaid and not covered on the day: the career ends through the deadline (EN + PT say why)", () => {
    const { save: opened, dueWeek } = owing(71_103);
    let save = opened;
    const sunday = quietSunday(save, dueWeek - 1);
    // Above the floor, below the debt: no breach — the deadline alone ends it.
    sunday.finances.balance = sunday.finances.loan!.remaining - 5_000;
    save = advanceDayFlow(sunday);
    expect(save.phase).toBe("ended");
    expect(save.end).toMatchObject({ reason: "insolvency", moneyCause: "deadline" });
    const notice = save.moneyNotices!.at(-1)!;
    expect(notice).toMatchObject({ kind: "careerEnded", params: { cause: "deadline" } });
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      const text = moneyNoticeTextOf(C, notice, save.clock);
      expect(text.lead).toContain(formatMoney(Number(notice.params.owed)));
      expect(C.ceremonies.insolvencyBodyDeadline).not.toBe(C.ceremonies.insolvencyBody);
    }
  });

  it("warns 8 and then 4 Mondays before the deadline — a bank mail and a notice each, once", () => {
    const { save: opened, dueWeek } = owing(71_104);
    let save = opened;
    const warnedAt: number[] = [];
    for (let w = 3; w < dueWeek - 1; w++) {
      // Above the floor every Monday, the debt never covered.
      save = mondayAt(save, w, 1_000);
      if (moneyNoticeRaisedToday(save)) warnedAt.push(weekOfDay(save.clock.day));
      save = acknowledgeAll(save);
    }
    expect(warnedAt).toEqual(CAREER_LOAN.emergency.warnWeeks.map((n) => dueWeek - n));
    // The inbox is newest first: the 4-week mail, then the 8-week one.
    const mails = mailOf(save, "loanDeadline");
    expect(mails.map((m) => Number(m.params!.weeksLeft)).reverse()).toEqual([...CAREER_LOAN.emergency.warnWeeks]);
    for (const m of mails) {
      expect(m.fromKey).toBe("bank");
      expect(m.params).toMatchObject({ covered: 0, dlWeek: dueWeek });
    }
    expect(save.finances.loan!.warned).toEqual(expect.arrayContaining([...CAREER_LOAN.emergency.warnWeeks]));
  });
});

/** Acknowledge every pending notice (the bot's way; a player closes the modal). */
function acknowledgeAll(save: CareerSave): CareerSave {
  let next = save;
  while (moneyNoticeOf(next)) next = acknowledgeMoneyNoticeFlow(next);
  return next;
}

// ===========================================================================
// The notice
// ===========================================================================

describe("rc.34 — the money notice (a modal on every career screen)", () => {
  it("fires once on the breach Monday; acknowledging removes it; nothing is raised again the next days", () => {
    let save = mondayAtFloor(heavyCareer("normal", 71_201), 2, -10);
    const notice = moneyNoticeOf(save)!;
    expect(notice).toMatchObject({ kind: "loanOpened", seasonIndex: 0, day: firstDayOfWeek(3) });
    expect(moneyNoticeRaisedToday(save)).toBe(true);
    // An unknown id is a no-op (same save back).
    expect(acknowledgeMoneyNoticeFlow(save, "nope")).toBe(save);
    save = acknowledgeMoneyNoticeFlow(save, notice.id);
    expect(moneyNoticeOf(save)).toBeNull();
    save = advanceDayFlow(save);
    expect(moneyNoticeOf(save)).toBeNull();
  });

  it("the batched Advance stops on the Monday a notice is raised (not on the same Monday without one)", () => {
    const base = heavyCareer("normal", 71_202);
    const start = quietSunday(base, 4);
    start.clock.day = firstDayOfWeek(4) + 3; // Thursday of week 4
    const monday = firstDayOfWeek(5);
    const broke = structuredClone(start);
    broke.finances.balance = backerLineOf(broke).floor + 100; // Monday's payroll breaks the floor
    const stopped = advanceToNextStopFlow(broke);
    expect(stopped.clock.day).toBe(monday);
    expect(moneyNoticeOf(stopped)?.kind).toBe("loanOpened");
    const rich = structuredClone(start);
    rich.finances.balance = 10_000_000;
    expect(advanceToNextStopFlow(rich).clock.day).not.toBe(monday);
  });

  it("every kind reads in EN and PT: money formatted, the deadline as a date, the rule spelled out", () => {
    let save = mondayAtFloor(heavyCareer("easy", 71_203), 2, -10);
    save = mondayAtFloor(save, 3, -10);
    const kinds = new Set<string>();
    for (const notice of save.moneyNotices!) {
      kinds.add(notice.kind);
      for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
        const text = moneyNoticeTextOf(C, notice, save.clock);
        expect(text.title.length).toBeGreaterThan(5);
        expect(text.lead).toContain(formatMoney(Number(notice.params.lent)));
        const all = [text.lead, ...text.rows.flat(), text.foot ?? ""].join(" ");
        expect(all).toContain(formatMoney(Number(notice.params.owed)));
        expect(all).not.toMatch(/undefined|NaN/);
        // The deadline is a date on the calendar, never a raw week number.
        expect(all).toMatch(C === CAREER_PT ? /seg/i : /Mon/);
      }
    }
    expect([...kinds]).toEqual(["loanOpened", "loanTopUp"]);
    // Easy's first loan names the investor in its notice.
    const first = moneyNoticeTextOf(CAREER_EN as unknown as CareerCopy, save.moneyNotices![0], save.clock);
    expect(first.rows.map(([label]) => label)).toContain("Investor");
  });
});

// ===========================================================================
// No lock while owing
// ===========================================================================

describe("rc.34 — nothing is locked while the loan is owed (lockCommitments false; true restores rc.33)", () => {
  it("a fee signing and gear go through while owing; the lock key brings rc.33's refusals back", () => {
    let save = createCareerSave(INPUT, 71_301);
    // Owing the bank, with money to spend (day 1: the preseason window is open).
    save = structuredClone(save);
    save.finances.loan = { remaining: 20_000, topUps: 0 };
    save.finances.loanUsed = true;
    save.finances.balance = 2_000_000;
    save.reputation = 100;
    const contracted = Object.values(save.world.orgs)
      .flatMap((o) => o.playerIds)
      .find((id) => {
        const plan = withLock(false, () => signingPlanFor(save, id, { lengthSeasons: 1 }));
        return !("error" in plan) && plan.plan.cost > 0;
      });
    expect(contracted).toBeDefined();
    const open = signingPlanFor(save, contracted!, { lengthSeasons: 1 });
    expect("error" in open).toBe(false);
    const locked = withLock(true, () => signingPlanFor(save, contracted!, { lengthSeasons: 1 }));
    expect("error" in locked && locked.error).toBe("loanActive");
    // Gear: the first rung, its reputation met.
    expect(save.reputation).toBeGreaterThanOrEqual(CAREER_GEAR.items[0].repGate);
    expect(buyGearFlow(save, CAREER_GEAR.items[0].id).error).toBeUndefined();
    expect(withLock(true, () => buyGearFlow(save, CAREER_GEAR.items[0].id)).error).toBe("loanActive");
    expect(CAREER_UNLOCKS.coachRep).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Saves: an rc.33 career that owes the Backer
// ===========================================================================

describe("rc.34 — an rc.33 save that owes the Backer loads into the bank's loan", () => {
  function rc33Save(): CareerSave {
    const save = createCareerSave({ ...INPUT, difficulty: "easy" }, 71_401);
    save.clock.day = firstDayOfWeek(12) + 2;
    save.finances.loan = { remaining: 9_000 };
    save.finances.loanUsed = true;
    save.finances.loanBreaches = 1;
    // Easy's rc.33 rescue partner, four Mondays still to pay (50 % of the bill then).
    save.finances.rescuePartner = { weekly: 700, mondaysLeft: 4 };
    delete save.finances.emergencyLoans;
    delete save.moneyNotices;
    return save;
  }

  it("the debt keeps its amount, gets a deadline from the update, announced once (mail + notice), idempotent", () => {
    const loaded = migrateSaveToV5(structuredClone(rc33Save()))!;
    expect(loaded.finances.loan).toEqual({
      remaining: 9_000,
      deadline: mondayAfter({ seasonIndex: 0, week: 12 }, CAREER_LOAN.emergency.deadlineWeeks.easy!),
      openedAt: { seasonIndex: 0, week: 12 },
      topUps: 0,
    });
    expect(loaded.finances.loanBreaches).toBe(1);
    expect(loaded.finances.emergencyLoans).toBe(1);
    expect(mailOf(loaded, "loanTakenOver")).toHaveLength(1);
    expect(moneyNoticeOf(loaded)).toMatchObject({ kind: "loanTakenOver", params: { owed: 9_000 } });
    // A second load moves nothing.
    expect(migrateSaveToV5(structuredClone(loaded))).toEqual(loaded);
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      const text = moneyNoticeTextOf(C, moneyNoticeOf(loaded)!, loaded.clock);
      expect([text.lead, ...text.rows.flat()].join(" ")).toContain(formatMoney(9_000));
    }
  });

  it("the running rescue partner keeps paying as the investor; no investor joins this loan or a later one", () => {
    let save = migrateSaveToV5(structuredClone(rc33Save()))!;
    expect(investorJoinsNext(save.finances, "easy")).toBe(false);
    save = mondayAt(save, 12, 50_000);
    expect(save.finances.ledger.filter((l) => l.kind === "rescuePartner").map((l) => l.amount)).toEqual([700]);
    expect(save.finances.rescuePartner?.mondaysLeft).toBe(3);
  });

  it("an ended career, a cleared debt, a loan that has its deadline: nothing moves", () => {
    for (const tweak of [
      (s: CareerSave) => {
        s.phase = "ended";
      },
      (s: CareerSave) => {
        s.finances.loan = null;
      },
      (s: CareerSave) => {
        s.finances.loan = { remaining: 9_000, deadline: { seasonIndex: 1, week: 4 } };
      },
    ]) {
      const save = rc33Save();
      tweak(save);
      const before = structuredClone(save);
      repairLoanOnLoad(save);
      expect(save).toEqual(before);
    }
  });
});

// ===========================================================================
// Day one: every founding roster's runway
// ===========================================================================

describe("rc.34 — every founding roster starts with the same runway in weeks", () => {
  it("the start budget is at least startingBudgetWeeks of the founding wage bill, never under the flat budget", () => {
    for (const region of ["EU", "NA", "SAM", "APAC"] as Region[])
      for (const difficulty of DIFFS)
        for (const rosterKey of ["prospects", "balanced", "journeymen"] as const) {
          const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region }, difficulty, rosterKey }, 71_501);
          const bill = save.squad.reduce((n, p) => n + weeklyWage(p.salaryPerSplit), 0);
          expect(bill).toBe(weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), null));
          const weeks = CAREER_ECONOMY.startingBudgetWeeks[difficulty]!;
          expect(save.finances.balance).toBe(startingBudgetFor(difficulty, bill));
          expect(save.finances.balance).toBeGreaterThanOrEqual(CAREER_ECONOMY.startingBudget[difficulty]);
          expect(save.finances.balance).toBeGreaterThanOrEqual(quantize(weeks * bill));
        }
    // The older team gets more than the flat budget on Normal; the prospects keep it.
    const at = (rosterKey: CreateCareerInput["rosterKey"]) => createCareerSave({ ...INPUT, rosterKey }, 71_502).finances.balance;
    expect(at("journeymen")).toBeGreaterThan(CAREER_ECONOMY.startingBudget.normal);
    expect(at("prospects")).toBe(CAREER_ECONOMY.startingBudget.normal);
    // null restores the flat budget (rc.33).
    const keys = CAREER_ECONOMY.startingBudgetWeeks as Record<string, number | null>;
    const saved = keys.normal;
    keys.normal = null;
    try {
      expect(startingBudgetFor("normal", 5_000)).toBe(CAREER_ECONOMY.startingBudget.normal);
    } finally {
      keys.normal = saved;
    }
  });
});
