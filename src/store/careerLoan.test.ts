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
import { CAREER_ECONOMY, CAREER_GEAR, CAREER_LOAN, CAREER_SALARY, CAREER_UNLOCKS } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import { firstDayOfWeek, weekOfDay } from "@/engine/career/calendar";
import {
  applyPrize,
  balanceAfterMondays,
  canSettleLoan,
  deadlineWeeksFor,
  emergencyLoansOf,
  investorJoinsNext,
  investorWeeklyFor,
  maxLoansFor,
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
  nextBreachOutcomeOf,
  nextBreachParamsOf,
  payDebtFlow,
  repairLoanOnLoad,
  signingPlanFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import { walkPastForTests } from "./careerClockForTests";

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
    // rc.34 review: above the floor (no breach — the deadline alone ends it), but paying
    // the debt would close the books $5,000 below the floor after Monday's payroll.
    const net = weeklyStatementOf(sunday).net;
    sunday.finances.balance = sunday.finances.loan!.remaining + backerLineOf(sunday).floor - 5_000 - net;
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

describe("rc.36 — one start budget for every roster; the founders' wages fit it (BAL-05 reversed)", () => {
  it("every roster starts on the difficulty's budget, and its founding bill covers foundingFitWeeks of it", () => {
    for (const region of ["EU", "NA", "SAM", "APAC"] as Region[])
      for (const difficulty of DIFFS)
        for (const rosterKey of ["prospects", "balanced", "journeymen"] as const) {
          const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region }, difficulty, rosterKey }, 71_501);
          const bill = save.squad.reduce((n, p) => n + weeklyWage(p.salaryPerSplit), 0);
          expect(bill).toBe(weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), null));
          // The same budget whatever the roster: only the difficulty changes it.
          expect(save.finances.balance).toBe(CAREER_ECONOMY.startingBudget[difficulty]);
          expect(save.finances.balance).toBe(startingBudgetFor(difficulty, bill));
          // The founders' deals fit it: at least foundingFitWeeks of wages, never under the minimum salary.
          const weeks = CAREER_SALARY.foundingFitWeeks[difficulty]!;
          expect(bill * weeks).toBeLessThanOrEqual(save.finances.balance);
          for (const p of save.squad) expect(p.salaryPerSplit).toBeGreaterThanOrEqual(CAREER_SALARY.minSalary);
        }
    // The older team signs for less than the 0.85 founding discount; the prospects keep it.
    const wagesOf = (rosterKey: CreateCareerInput["rosterKey"]) =>
      createCareerSave({ ...INPUT, rosterKey }, 71_502).squad.map((p) => p.salaryPerSplit);
    const sum = (ws: number[]) => ws.reduce((n, w) => n + w, 0);
    const fitVets = wagesOf("journeymen");
    const fitKids = wagesOf("prospects");
    const keys = CAREER_SALARY.foundingFitWeeks as Record<string, number | null>;
    const saved = keys.normal;
    keys.normal = null;
    try {
      // null = rc.35: no fit — the dearer founding deals, and still the flat budget.
      expect(sum(wagesOf("journeymen"))).toBeGreaterThan(sum(fitVets));
      expect(wagesOf("prospects")).toEqual(fitKids);
      expect(createCareerSave({ ...INPUT, rosterKey: "journeymen" }, 71_502).finances.balance).toBe(CAREER_ECONOMY.startingBudget.normal);
    } finally {
      keys.normal = saved;
    }
    // rc.35's weeks (BAL-05) restore the budget that grows with the bill.
    const weekKeys = CAREER_ECONOMY.startingBudgetWeeks as Record<string, number | null>;
    const savedWeeks = weekKeys.normal;
    weekKeys.normal = 24;
    try {
      expect(startingBudgetFor("normal", 1_000)).toBe(quantize(24 * 1_000));
    } finally {
      weekKeys.normal = savedWeeks;
    }
  });
});

// ===========================================================================
// rc.34 review (P1–P3): one rule on the deadline, the loan cap, the boundary
// Monday, and "covered" as the bank's own test on the projected books
// ===========================================================================

const EN = CAREER_EN as unknown as CareerCopy;

/** The Sunday before a Hard loan's deadline, the books `afterPay` from the floor once Monday's payroll and the whole debt are paid. */
function dueSunday(seed: number, afterPay: number): { sunday: CareerSave; owed: number; floor: number } {
  const save = mondayAtFloor(heavyCareer("hard", seed), 2, -10);
  const sunday = quietSunday(save, save.finances.loan!.deadline!.week - 1);
  const owed = sunday.finances.loan!.remaining;
  const floor = backerLineOf(sunday).floor;
  sunday.finances.balance = owed + floor + afterPay - weeklyStatementOf(sunday).net;
  return { sunday, owed, floor };
}

describe("rc.34 review (P1) — the deadline and 'Pay it all' read ONE rule: balance − owed ≥ the floor", () => {
  it("short of the debt but above the floor once it is paid: 'Pay it all' is accepted and the bank collects on the day (the Hard repro)", () => {
    const { sunday, owed, floor } = dueSunday(71_601, 5_000);
    expect(canSettleLoan(sunday.finances.balance, owed, floor)).toBe(true);
    expect(payDebtFlow(sunday, owed).error).toBeUndefined();
    // Doing nothing is the same test on Monday: the bank takes it, the books close in the overdraft.
    const monday = advanceDayFlow(sunday);
    expect(monday.phase).toBe("running");
    expect(monday.finances.loan).toBeNull();
    expect(monday.finances.balance).toBe(floor + 5_000);
    expect(monday.finances.balance).toBeLessThan(0);
    expect(monday.moneyNotices!.some((n) => n.kind === "deadlineCollected" && n.params.collected === owed)).toBe(true);
  });

  it("past the floor once paid: the deadline ends the career, and 'Pay it all' refuses those same books", () => {
    const { sunday, owed, floor } = dueSunday(71_602, -5_000);
    const monday = advanceDayFlow(sunday);
    expect(monday.phase).toBe("ended");
    expect(monday.end).toMatchObject({ reason: "insolvency", moneyCause: "deadline" });
    const atCheck = structuredClone(sunday);
    atCheck.finances.balance = owed + floor - 5_000;
    expect(canSettleLoan(atCheck.finances.balance, owed, floor)).toBe(false);
    expect(payDebtFlow(atCheck, owed).error).toBe("funds");
    atCheck.finances.balance = owed + floor;
    expect(canSettleLoan(atCheck.finances.balance, owed, floor)).toBe(true);
    expect(payDebtFlow(atCheck, owed).error).toBeUndefined();
  });
});

describe("rc.34 review (P1) — a career-wide cap on emergency loans: the deadline cannot be rolled over forever", () => {
  it("maxLoans by difficulty (Easy 3, Normal 2, Hard 1): after the last one is repaid the next breach ends the career, and the warnings say so first", () => {
    expect(CAREER_LOAN.emergency.maxLoans).toEqual({ easy: 3, normal: 2, hard: 1 });
    for (const d of DIFFS) {
      let save = heavyCareer(d, 71_611);
      const cap = maxLoansFor(d)!;
      let week = 2;
      for (let n = 1; n <= cap; n++) {
        save = acknowledgeAll(mondayAtFloor(save, week++, -10));
        expect(save.phase, `${d} loan ${n}`).toBe("running");
        expect(emergencyLoansOf(save.finances)).toBe(n);
        expect(nextBreachParamsOf(save)).toMatchObject({ owing: 1, loansLeft: cap - n });
        // Paid in full, into the overdraft (the deadline's own rule).
        save = structuredClone(save);
        save.finances.balance = save.finances.loan!.remaining + backerLineOf(save).floor;
        save = payDebtFlow(save, save.finances.loan!.remaining).save;
        expect(save.finances.loan).toBeNull();
        expect(nextBreachOutcomeOf(save), `${d} after loan ${n}`).toBe(n === cap ? "insolvent" : "rescue");
      }
      const next = nextBreachParamsOf(save);
      expect(next).toMatchObject({ next: "insolvent", owing: 0, loansLeft: 0, maxLoans: cap });
      expect(EN.hub.backerNextBreach(next)).toMatch(/will not open another emergency loan/);
      expect(CAREER_PT.hub.backerNextBreach(next)).toMatch(/não abre outro empréstimo emergencial/);
      // The bank's "repaid in full" mail says it too (it used to say its door stays open).
      const cleared = mailOf(save, "debtCleared")[0];
      expect(EN.mail.body.debtCleared(cleared.params!)).toMatch(/will not open another emergency loan/);
      expect(CAREER_PT.mail.body.debtCleared(cleared.params!)).toMatch(/não abre outro empréstimo emergencial/);
      save = mondayAtFloor(save, week, -10);
      expect(save.phase, d).toBe("ended");
      expect(save.end).toMatchObject({ reason: "insolvency", moneyCause: "breach" });
      const notice = save.moneyNotices!.at(-1)!;
      expect(notice).toMatchObject({ kind: "careerEnded", params: { cause: "breach", loans: cap, maxLoans: cap } });
      expect(moneyNoticeTextOf(EN, notice, save.clock).lead).toMatch(/would not open another emergency loan/);
      expect(moneyNoticeTextOf(CAREER_PT, notice, save.clock).lead).toMatch(/não abriria outro empréstimo emergencial/);
    }
  });

  it("the reviewer's rollover: Hard settles on its deadline in the overdraft and breaks the floor later — no fresh loan, no fresh term", () => {
    const { sunday } = dueSunday(71_612, 2_000);
    const monday = advanceDayFlow(sunday);
    expect(monday.phase).toBe("running");
    expect(monday.finances.loan).toBeNull();
    const collected = monday.moneyNotices!.find((n) => n.kind === "deadlineCollected")!;
    expect(collected.params).toMatchObject({ next: "insolvent", loansLeft: 0 });
    expect(moneyNoticeTextOf(EN, collected, monday.clock).rows.flat().join(" ")).toMatch(/will not open another emergency loan/);
    let save = acknowledgeAll(monday);
    save = mondayAtFloor(save, weekOfDay(save.clock.day) + 2, -10);
    expect(save.phase).toBe("ended");
    expect(save.end).toMatchObject({ reason: "insolvency", moneyCause: "breach" });
    expect(emergencyLoansOf(save.finances)).toBe(1);
  });
});

describe("rc.34 review (P2) — a split boundary's sponsor bonus is booked before the deadline is checked", () => {
  it("W11: the objective bonus that closes the gap keeps the career (it used to land after the check); without it the deadline ends it", () => {
    const sunday = quietSunday(heavyCareer("normal", 71_621), 10);
    const bonus = 40_000;
    sunday.sponsor = { sponsorId: "test-sponsor", tier: 1, basePerSplit: 0, bonus, objectiveKind: "majorQualify", progress: 0, hitThisSplit: true, missedCount: 0 };
    sunday.finances.loan = { remaining: 60_000, lent: 50_000, topUps: 0, openedAt: { seasonIndex: 0, week: 3 }, deadline: { seasonIndex: 0, week: 11 }, warned: [...CAREER_LOAN.emergency.warnWeeks] };
    sunday.finances.loanUsed = true;
    sunday.finances.emergencyLoans = 1;
    sunday.finances.loanBreaches = 1;
    const floor = backerLineOf(sunday).floor;
    // After Monday's payroll the books are $10,000 past the floor once the debt is paid — the bonus closes it.
    sunday.finances.balance = 60_000 + floor - 10_000 - weeklyStatementOf(sunday).net;
    const monday = advanceDayFlow(sunday);
    expect(weekOfDay(monday.clock.day)).toBe(11);
    expect(monday.phase).toBe("running");
    expect(monday.finances.loan).toBeNull();
    expect(monday.finances.balance).toBe(floor - 10_000 + bonus);
    expect(monday.finances.ledger.some((l) => l.kind === "sponsorBonus" && l.amount === bonus)).toBe(true);
    const missed = structuredClone(sunday);
    missed.sponsor!.hitThisSplit = false;
    expect(advanceDayFlow(missed)).toMatchObject({ phase: "ended", end: { moneyCause: "deadline" } });
  });
});

describe("rc.34 review (P3) — 'covered' is the bank's test on the books projected to the deadline", () => {
  it("warnWeeks [8, 4, 1]; covered = balance + weeksLeft × the weekly net, less the debt, at or above the floor", () => {
    expect(CAREER_LOAN.emergency.warnWeeks).toEqual([8, 4, 1]);
    const opened = mondayAtFloor(heavyCareer("hard", 71_631), 2, -10);
    const save = structuredClone(opened);
    save.clock.day = firstDayOfWeek(save.finances.loan!.deadline!.week - 4);
    const owed = save.finances.loan!.remaining;
    const floor = backerLineOf(save).floor;
    const net = weeklyStatementOf(save).net;
    expect(net).toBeLessThan(-1_000);
    // Payable today with $2,000 to spare — four more Mondays of burn sink it.
    save.finances.balance = owed + floor + 2_000;
    expect(canSettleLoan(save.finances.balance, owed, floor)).toBe(true);
    const view = emergencyLoanViewOf(save)!;
    expect(view.weeksLeft).toBe(4);
    expect(view.projected).toBe(balanceAfterMondays(save.finances.balance, net, 4));
    expect(view.projected).toBe(save.finances.balance + 4 * net);
    expect(view.covered).toBe(false);
    expect(view.gap).toBe(owed + floor - view.projected);
    save.finances.balance = owed + floor - 4 * net;
    expect(emergencyLoanViewOf(save)).toMatchObject({ covered: true, gap: 0 });
  });

  it("the 4-week warning quotes the projection (not today's balance), and the copy says what closes the gap — never a partial payment", () => {
    const opened = mondayAtFloor(heavyCareer("hard", 71_632), 2, -10);
    const sunday = quietSunday(opened, opened.finances.loan!.deadline!.week - 5);
    sunday.finances.loan!.warned = [8];
    const owed = sunday.finances.loan!.remaining;
    const floor = backerLineOf(sunday).floor;
    sunday.finances.balance = owed + floor + 2_000 - weeklyStatementOf(sunday).net;
    const monday = advanceDayFlow(sunday);
    const mail = mailOf(monday, "loanDeadline")[0];
    expect(mail.params).toMatchObject({ weeksLeft: 4, covered: 0 });
    expect(Number(mail.params!.gap)).toBeGreaterThan(0);
    for (const C of [EN, CAREER_PT]) {
      const body = C.mail.body.loanDeadline(mail.params!);
      const notice = moneyNoticeTextOf(C, moneyNoticeOf(monday)!, monday.clock);
      const all = [body, notice.lead, ...notice.rows.flat()].join(" ");
      expect(all).not.toMatch(/Pay it down from Finances|Abata em Finanças|undefined|NaN/);
      expect(all).toMatch(C === CAREER_PT ? /Quitar tudo/ : /Pay it all/);
    }
  });

  it("inside the last 4 weeks the bank watches every day: the day 'covered' flips to 'not covered' a notice and a mail say so, once", () => {
    const opened = mondayAtFloor(heavyCareer("hard", 71_633), 2, -10);
    const sunday = quietSunday(opened, opened.finances.loan!.deadline!.week - 5);
    sunday.finances.loan!.warned = [8];
    const owed = sunday.finances.loan!.remaining;
    const floor = backerLineOf(sunday).floor;
    // Covered on this pace with $3,000 to spare after five Mondays of burn (this one and four more).
    sunday.finances.balance = owed + floor + 3_000 - 5 * weeklyStatementOf(sunday).net;
    let save = advanceDayFlow(sunday);
    expect(mailOf(save, "loanDeadline")[0].params).toMatchObject({ weeksLeft: 4, covered: 1 });
    expect(emergencyLoanViewOf(save)!.covered).toBe(true);
    save = structuredClone(walkPastForTests(acknowledgeAll(save)));
    // A late transfer fee (nothing is locked while owing): $5,000 out — the projection now misses.
    save.finances.balance -= 5_000;
    expect(emergencyLoanViewOf(save)!.covered).toBe(false);
    save = advanceDayFlow(save);
    expect(moneyNoticeOf(save)).toMatchObject({ kind: "deadlineSlipped" });
    expect(moneyNoticeRaisedToday(save)).toBe(true);
    const slipped = mailOf(save, "loanSlipped");
    expect(slipped).toHaveLength(1);
    expect(slipped[0].fromKey).toBe("bank");
    for (const C of [EN, CAREER_PT]) {
      const text = moneyNoticeTextOf(C, moneyNoticeOf(save)!, save.clock);
      expect([text.title, text.lead, ...text.rows.flat()].join(" ")).not.toMatch(/undefined|NaN/);
      expect(C.mail.tpl.loanSlipped()).not.toMatch(/undefined|NaN/);
      expect(C.mail.body.loanSlipped(slipped[0].params!)).not.toMatch(/undefined|NaN/);
    }
    // Once: the next day raises nothing more.
    save = advanceDayFlow(walkPastForTests(acknowledgeAll(save)));
    expect(mailOf(save, "loanSlipped")).toHaveLength(1);
    expect(moneyNoticeRaisedToday(save)).toBe(false);
  });

  it("outside the last 4 weeks the same flip raises nothing (the 8- and 4-week warnings carry it)", () => {
    const opened = mondayAtFloor(heavyCareer("hard", 71_634), 2, -10);
    let save = structuredClone(opened);
    save.clock.day = firstDayOfWeek(save.finances.loan!.deadline!.week - 7) + 1;
    save.finances.loan!.warned = [8];
    save.finances.balance = save.finances.loan!.remaining + backerLineOf(save).floor + 3_000 - 7 * weeklyStatementOf(save).net;
    expect(emergencyLoanViewOf(save)!.covered).toBe(true);
    save = advanceDayFlow(walkPastForTests(acknowledgeAll(save)));
    save.finances.balance -= 5_000;
    expect(emergencyLoanViewOf(save)!.covered).toBe(false);
    save = advanceDayFlow(walkPastForTests(acknowledgeAll(save)));
    expect(mailOf(save, "loanSlipped")).toHaveLength(0);
  });
});
