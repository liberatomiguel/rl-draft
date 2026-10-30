/**
 * Road to Worlds — rc.33 (Etapa 2b part 3, front A): Miguel's 30/10 money
 * answers on rc.32. Every number reads its balance.ts key.
 *
 *  - ECO-08: what ends a career by difficulty — Easy at the 3rd breach,
 *    Normal at the 2nd, Hard at the 1st; every breach before it is the
 *    Backer's rescue; no restructuring (rc.32's forced sale is gone).
 *  - ECO-07: no day-one founding partner (a running rc.32 deal is honoured);
 *    Easy's first breach brings a rescue partner for one split.
 *  - ECO-09: one index at 12 % and a steeper ask above the strong-player line.
 *  - M7: the sponsor tier bases and the fanbase (guaranteed income).
 *  - ECO-12: no sale listing and no late signing; an rc.32 save loads clean.
 *  - UX-07: the Monday balance ring behind the expanded Finances chart.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_ECONOMY,
  CAREER_LOAN,
  CAREER_PAYROLL,
  CAREER_REP,
  CAREER_SALARY,
  CAREER_SPONSOR,
} from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { RESCUE_PARTNER_BRAND } from "@/data/career/sponsors";
import { firstDayOfWeek, isWindowWeek, weekOfDay } from "@/engine/career/calendar";
import {
  breachOutcomeFor,
  breachesToEndFor,
  coachSalaryFor,
  computeSalaryAsk,
  foundingPartnerActive,
  loanBreachesOf,
  marketValueFor,
  moneyIndex,
  mondayBalancesFromLedger,
  mondaysToBreach,
  quantizeWeekly,
  recordMondayBalance,
  rescuePartnerAt,
  rescuePartnerLastPayday,
  rescuePartnerWeeklyFor,
  runwayWeeks,
  sponsorOffersFor,
  starCurveFactor,
  weeklyOf,
  weeklyWage,
} from "@/engine/career/economy";
import type { CareerDifficulty, CareerSave, FinanceState, MailItem, TransferOffer } from "@/engine/career/types";
import { resolveMail } from "@/components/career/news/newsText";
import { errorTextFor } from "@/components/career/hub/hubShared";
import type { CareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import {
  advanceDayFlow,
  backerLineOf,
  createCareerSave,
  migrateSaveToV5,
  mondayBalancesOf,
  nextBreachOutcomeOf,
  repairMoneyOnLoad,
  runwayWeeksOf,
  signingPlanFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import * as flow from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Money Org",
    abbrev: "MNY",
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

/** The Monday of `week + 1` with the books `delta` from the Backer's floor (negative = a breach). */
function mondayAtFloor(save: CareerSave, week: number, delta: number): CareerSave {
  const sunday = quietSunday(save, week);
  sunday.finances.balance = backerLineOf(sunday).floor + delta;
  return advanceDayFlow(sunday);
}

/** A career on `difficulty` with a wage bill no income carries (every Monday burns). */
function heavyCareer(difficulty: CareerDifficulty, seed: number): CareerSave {
  const save = createCareerSave({ ...INPUT, difficulty }, seed);
  for (const [i, p] of save.squad.entries()) p.salaryPerSplit = 10_000 + i * 1_000;
  return save;
}

const mailOf = (save: CareerSave, titleKey: string): MailItem[] => save.mail.filter((m) => m.titleKey === titleKey);

// ===========================================================================
// ECO-08 — breaches by difficulty: 3 / 2 / 1, no restructuring
// ===========================================================================

describe("rc.33 ECO-08 — what ends a career through money, by difficulty", () => {
  it("Easy: rescue, rescue, the end · Normal: rescue, the end · Hard: the first breach ends it", () => {
    expect(CAREER_LOAN.breachesToEnd).toEqual({ easy: 3, normal: 2, hard: 1 });
    expect([1, 2, 3, 4].map((b) => breachOutcomeFor(b, "easy"))).toEqual(["rescue", "rescue", "insolvent", "insolvent"]);
    expect([1, 2, 3].map((b) => breachOutcomeFor(b, "normal"))).toEqual(["rescue", "insolvent", "insolvent"]);
    expect([1, 2].map((b) => breachOutcomeFor(b, "hard"))).toEqual(["insolvent", "insolvent"]);
    for (const d of ["easy", "normal", "hard"] as const) expect(breachesToEndFor(d)).toBe(CAREER_LOAN.breachesToEnd[d]);
    // null = money never ends it: every breach is a rescue.
    const keys = CAREER_LOAN.breachesToEnd as Record<string, number | null>;
    const saved = keys.easy;
    keys.easy = null;
    try {
      expect([1, 2, 7].map((b) => breachOutcomeFor(b, "easy"))).toEqual(["rescue", "rescue", "rescue"]);
    } finally {
      keys.easy = saved;
    }
  });

  it("Easy through the real flow: breach 1 rescues with the partner, breach 2 rescues again (the debt adds up), breach 3 ends it", () => {
    let save = heavyCareer("easy", 70_101);
    save = mondayAtFloor(save, 2, -10);
    expect(save.phase).toBe("running");
    expect(save.finances.loanBreaches).toBe(1);
    expect(save.finances.balance).toBe(backerLineOf(save).rescueTo);
    expect(save.finances.rescuePartner).not.toBeNull();
    const owedAfterFirst = save.finances.loan!.remaining;
    const first = mailOf(save, "backerIn")[0];
    expect(first.params).toMatchObject({ n: 1, next: "rescue", nextPartner: 0, partnerName: RESCUE_PARTNER_BRAND.name });

    save = mondayAtFloor(save, 3, -10);
    expect(save.phase).toBe("running");
    expect(save.finances.loanBreaches).toBe(2);
    expect(save.finances.balance).toBe(backerLineOf(save).rescueTo);
    // The second loan is added to what is still owed — no forced sale, the squad intact.
    expect(save.finances.loan!.remaining).toBeGreaterThan(owedAfterFirst);
    expect(save.squad).toHaveLength(createCareerSave({ ...INPUT, difficulty: "easy" }, 70_101).squad.length);
    const second = mailOf(save, "backerIn").find((m) => m.params?.n === 2)!;
    expect(second.params).toMatchObject({ next: "insolvent", partnerWeekly: 0 });
    expect(CAREER_EN.mail.body.backerIn(second.params!)).toContain("second time");
    expect(CAREER_PT.mail.body.backerIn(second.params!)).toContain("segunda vez");

    save = mondayAtFloor(save, 4, -10);
    expect(save.phase).toBe("ended");
    expect(save.end.reason).toBe("insolvency");
    expect(save.finances.ledger.filter((l) => l.kind === "loanGrant")).toHaveLength(2);
  });

  it("Normal: one rescue (no partner), the second breach ends it — Hard: the first breach ends it, no Backer", () => {
    let normal = mondayAtFloor(heavyCareer("normal", 70_102), 2, -10);
    expect(normal.phase).toBe("running");
    expect(normal.finances.rescuePartner ?? null).toBeNull();
    expect(mailOf(normal, "backerIn")[0].params).toMatchObject({ next: "insolvent", partnerWeekly: 0 });
    normal = mondayAtFloor(normal, 3, -10);
    expect(normal.phase).toBe("ended");

    const hard = mondayAtFloor(heavyCareer("hard", 70_103), 2, -10);
    expect(hard.phase).toBe("ended");
    expect(hard.end.reason).toBe("insolvency");
    expect(hard.finances.ledger.some((l) => l.kind === "loanGrant")).toBe(false);
    expect(mailOf(hard, "backerIn")).toHaveLength(0);
  });

  it("no restructuring anywhere: no forced sale, no rep loss, no 'restructured' mail on any difficulty", () => {
    for (const [d, seed] of [["easy", 70_104], ["normal", 70_105]] as const) {
      let save = heavyCareer(d, seed);
      const squad = save.squad.map((p) => p.id);
      const rep = save.reputation;
      for (let w = 2; save.phase === "running" && w < 8; w++) save = mondayAtFloor(save, w, -10);
      expect(save.phase).toBe("ended");
      expect(save.squad.map((p) => p.id)).toEqual(squad);
      expect(save.reputation).toBe(rep);
      expect(mailOf(save, "restructured")).toHaveLength(0);
      expect(save.news.some((n) => n.titleKey === "restructured")).toBe(false);
    }
  });

  it("the warnings quote the next breach per difficulty: Easy's first names the partner, Hard's first names the end", () => {
    for (const [d, next, partner] of [["easy", "rescue", 1], ["normal", "rescue", 0], ["hard", "insolvent", 0]] as const) {
      let save = createCareerSave({ ...INPUT, difficulty: d }, 70_106);
      for (const p of save.squad) p.salaryPerSplit = 8_000;
      save = quietSunday(save, 2);
      // Six weeks of runway: the 8-week notice goes out on Monday.
      save.finances.balance = -weeklyStatementOf(save).net * 6;
      save = advanceDayFlow(save);
      const notice = mailOf(save, "cashNotice")[0] ?? mailOf(save, "cashWarning")[0];
      expect(notice, d).toBeDefined();
      expect(notice.params).toMatchObject({ next, nextPartner: partner });
    }
  });

  it("every player-facing statement of when money ends a career derives N from breachesToEnd (EN + PT, no restructuring)", () => {
    for (const C of [CAREER_EN, CAREER_PT]) {
      const at = (d: CareerDifficulty) => C.finances.breachLadder(breachesToEndFor(d), CAREER_LOAN.rescuePartner.atBreach[d] ?? null);
      for (const d of ["easy", "normal", "hard"] as const) {
        const text = at(d);
        expect(text).not.toMatch(/restructur|reestrutur/i);
      }
      // rc.34 (front I): the wizard's money line reads the loan's deadline now
      // (difficulty.loanDeadlineWeeksFor, tested in careerBal02.test.ts).
      // The count reads the end too.
      expect(C.finances.breachCount(1, 2)).toMatch(/1/);
      expect(C.finances.breachCount(2, 3)).not.toBe(C.finances.breachCount(1, 3));
      // No screen string promises a restructuring any more (the rc.32 mail and news
      // templates stay only to render an older save's inbox).
      const screens = JSON.stringify([C.hub, C.finances, C.market, C.wizard], (_k, v) => (typeof v === "function" ? v.toString() : v));
      expect(screens).not.toMatch(/restructur|reestrutur/i);
    }
    expect(CAREER_EN.finances.breachLadder(3, 1)).toMatch(/third ends the career/);
    expect(CAREER_EN.finances.breachLadder(2, null)).toMatch(/second ends the career/);
    expect(CAREER_EN.finances.breachLadder(1, null)).toMatch(/first breach of the floor ends the career/);
    expect(CAREER_PT.finances.breachLadder(3, 1)).toMatch(/terceira encerra a carreira/);
  });
});

// ===========================================================================
// ECO-07 — no founding partner; Easy's rescue partner for one split
// ===========================================================================

describe("rc.33 ECO-07 — the rescue partner (Easy's first breach) and no founding partner", () => {
  it("a new career gets no founding partner: recorded null, no mail, no ledger line", () => {
    expect(CAREER_SPONSOR.founding.enabled).toBe(false);
    for (const d of ["easy", "normal", "hard"] as const) {
      const save = createCareerSave({ ...INPUT, difficulty: d }, 70_201);
      expect(save.foundingPartner).toBeNull();
      expect(mailOf(save, "foundingPartner")).toHaveLength(0);
      expect(weeklyStatementOf(save).foundingPartner).toBe(0);
    }
  });

  it("an rc.32 save with a running founding-partner deal: honoured to its own end, nothing new granted", () => {
    const save = createCareerSave(INPUT, 70_202);
    const bill = save.squad.reduce((n, p) => n + p.salaryPerSplit, 0);
    save.foundingPartner = { wageBillPerSplit: bill, sizedSeason: 0 };
    const loaded = migrateSaveToV5(structuredClone(save))!;
    expect(foundingPartnerActive(loaded.foundingPartner)).toBe(true);
    expect(weeklyStatementOf(loaded).foundingPartner).toBeGreaterThan(0);
    const monday = advanceDayFlow(quietSunday(loaded, 2));
    expect(monday.finances.ledger.some((l) => l.kind === "foundingPartner")).toBe(true);
    // An rc.31-era save that never decided gets none at load (decided: none).
    const undecided = structuredClone(save);
    delete undecided.foundingPartner;
    expect(migrateSaveToV5(undecided)!.foundingPartner).toBeNull();
  });

  it("pays payrollShare × the rescue Monday's wage bill for `weeks` Mondays, its own line, then clears", () => {
    let save = mondayAtFloor(heavyCareer("easy", 70_203), 2, -10);
    const bill = weeklyStatementOf(save).payroll + weeklyStatementOf(save).coach;
    const partner = save.finances.rescuePartner!;
    expect(partner).toEqual({ weekly: rescuePartnerWeeklyFor(bill), mondaysLeft: CAREER_LOAN.rescuePartner.weeks });
    expect(partner.weekly).toBe(quantizeWeekly(CAREER_LOAN.rescuePartner.payrollShare * bill));
    // The rescue mail announces who, how much, how long and until when.
    const mail = mailOf(save, "backerIn")[0];
    const last = rescuePartnerLastPayday(partner, save.clock)!;
    expect(mail.params).toMatchObject({
      partnerName: RESCUE_PARTNER_BRAND.name,
      partnerWeekly: partner.weekly,
      partnerWeeks: CAREER_LOAN.rescuePartner.weeks,
      partnerUntilWeek: weekOfDay(last.day),
    });
    for (const C of [CAREER_EN, CAREER_PT]) expect(C.mail.body.backerIn(mail.params!)).toContain(RESCUE_PARTNER_BRAND.name);
    // Next Monday's statement counts it (the runway the screens show).
    expect(weeklyStatementOf(save).rescuePartner).toBe(partner.weekly);
    // A balance the burn cannot breach for the whole run: one line per Monday, then nothing.
    let week = 3;
    for (let i = 0; i < CAREER_LOAN.rescuePartner.weeks; i++) {
      const sunday = quietSunday(save, week++);
      sunday.finances.balance = 10_000_000;
      save = advanceDayFlow(sunday);
    }
    const lines = save.finances.ledger.filter((l) => l.kind === "rescuePartner");
    expect(lines).toHaveLength(CAREER_LOAN.rescuePartner.weeks);
    for (const l of lines) expect(l.amount).toBe(partner.weekly);
    expect(save.finances.rescuePartner ?? null).toBeNull();
    expect(weeklyStatementOf(save).rescuePartner).toBe(0);
    const sunday = quietSunday(save, week);
    sunday.finances.balance = 10_000_000;
    expect(advanceDayFlow(sunday).finances.ledger.filter((l) => l.kind === "rescuePartner")).toHaveLength(lines.length);
  });

  it("its last payday is `mondaysLeft` paydays on, across the season end", () => {
    expect(rescuePartnerLastPayday(null, { seasonIndex: 0, day: 1 })).toBeNull();
    expect(rescuePartnerLastPayday({ weekly: 100, mondaysLeft: 1 }, { seasonIndex: 0, day: firstDayOfWeek(5) })).toEqual({
      seasonIndex: 0,
      day: firstDayOfWeek(6),
    });
    expect(rescuePartnerLastPayday({ weekly: 100, mondaysLeft: 10 }, { seasonIndex: 2, day: firstDayOfWeek(30) })).toEqual({
      seasonIndex: 3,
      day: firstDayOfWeek(8),
    });
    expect(rescuePartnerAt(1, "easy")).toBe(true);
    expect(rescuePartnerAt(2, "easy")).toBe(false);
    expect(rescuePartnerAt(1, "normal")).toBe(false);
    expect(rescuePartnerAt(1, "hard")).toBe(false);
  });
});

// ===========================================================================
// rc.33 review — the rescue mail's money and the projections over the partner's run
// ===========================================================================

describe("rc.33 review — the rescue partner in the mail and in the projections", () => {
  it("the rescue mail prints the partner's weekly help as money, EN and PT (a real Easy rescue through resolveMail)", () => {
    const save = mondayAtFloor(heavyCareer("easy", 70_203), 2, -10);
    const partner = save.finances.rescuePartner!;
    expect(partner.weekly).toBeGreaterThan(999);
    const mail = mailOf(save, "backerIn")[0];
    const en = resolveMail(mail, CAREER_EN as unknown as CareerCopy).body;
    const pt = resolveMail(mail, CAREER_PT).body;
    expect(en).toContain(`${formatMoney(partner.weekly)} a week`);
    expect(pt).toContain(`${formatMoney(partner.weekly)} por semana`);
    for (const body of [en, pt]) {
      expect(body).toContain(RESCUE_PARTNER_BRAND.name);
      expect(body).not.toContain(` ${partner.weekly} `);
      // Every other amount of the rescue mail is money too.
      expect(body).toContain(formatMoney(Number(mail.params!.rescueTo)));
      expect(body).toContain(formatMoney(Number(mail.params!.owed)));
    }
  });

  it("Easy, seed 70101, $10–12k wages, rescued on week 3's Monday: the warnings quote the Monday the books really cross the floor", () => {
    let save = mondayAtFloor(heavyCareer("easy", 70_101), 2, -10);
    expect(loanBreachesOf(save.finances)).toBe(1);
    expect(save.finances.rescuePartner?.mondaysLeft).toBe(CAREER_LOAN.rescuePartner.weeks);
    const seen = new Set(save.mail.map((m) => m.id));
    const quoted: { sentWeek: number; breachWeek: number; nextSeason: number }[] = [];
    let realBreachWeek: number | null = null;
    for (let week = 3; week < 31 && realBreachWeek === null; week++) {
      save = advanceDayFlow(quietSunday(save, week));
      if (loanBreachesOf(save.finances) > 1) {
        realBreachWeek = weekOfDay(save.clock.day);
        break;
      }
      for (const m of save.mail) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        if (m.titleKey === "cashNotice" || m.titleKey === "cashWarning") {
          quoted.push({
            sentWeek: weekOfDay(m.day),
            breachWeek: Number(m.params!.breachWeek),
            nextSeason: Number(m.params!.nextSeason),
          });
        }
      }
    }
    expect(realBreachWeek).not.toBeNull();
    expect(quoted.length).toBeGreaterThan(0);
    for (const q of quoted) expect(q, `sent in week ${q.sentWeek}`).toEqual({ ...q, breachWeek: realBreachWeek!, nextSeason: 0 });
  });

  it("the runway and the breach run over the partner's remaining Mondays, then without its weekly", () => {
    // Burning 1,000 a week of which the partner pays 600 for 3 more Mondays: −1,000 then −1,600.
    const run = { weekly: 600, mondays: 3 };
    expect(runwayWeeks(10_000, -1_000)).toBe(10);
    expect(runwayWeeks(10_000, -1_000, run)).toBe(3 + Math.floor(7_000 / 1_600));
    expect(mondaysToBreach(10_000, -1_000, -5_000)).toBe(16);
    expect(mondaysToBreach(10_000, -1_000, -5_000, run)).toBe(3 + Math.floor(12_000 / 1_600) + 1);
    // A breach inside the run is unchanged; a net that only burns after the run now has an end.
    expect(mondaysToBreach(1_500, -1_000, 0, run)).toBe(2);
    expect(runwayWeeks(10_000, 200)).toBeNull();
    expect(runwayWeeks(10_000, 200, run)).toBe(3 + Math.floor(10_600 / 400));
    expect(mondaysToBreach(10_000, 700, 0, run)).toBeNull();
    // HQ and Finances read the flow's runway, which counts the partner only on its Mondays (finding 9).
    const rescued = mondayAtFloor(heavyCareer("easy", 70_101), 2, -10);
    const net = weeklyStatementOf(rescued).net;
    const partner = rescued.finances.rescuePartner!;
    expect(runwayWeeksOf(rescued)).toBe(
      runwayWeeks(rescued.finances.balance, net, { weekly: partner.weekly, mondays: partner.mondaysLeft }),
    );
  });

  it("where the next breach ends the career, no warning promises the Backer: the deal warning, the loans and bank hints, the error banner (EN + PT)", () => {
    const hard = createCareerSave({ ...INPUT, difficulty: "hard" }, 70_301);
    const easy = createCareerSave({ ...INPUT, difficulty: "easy" }, 70_301);
    const rescuedOnce = structuredClone(createCareerSave(INPUT, 70_301));
    rescuedOnce.finances.loanBreaches = 1;
    rescuedOnce.finances.loanUsed = true;
    expect(nextBreachOutcomeOf(hard)).toBe("insolvent");
    expect(nextBreachOutcomeOf(easy)).toBe("rescue");
    expect(nextBreachOutcomeOf(rescuedOnce)).toBe("insolvent");
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      expect(errorTextFor(C, "funds", "rescue")).toBe(C.finances.backerWarning);
      expect(errorTextFor(C, "funds", "insolvent")).toBe(C.finances.endsCareerWarning);
      // "No fee transfers while the Backer is owed" — Easy's next breach is a rescue, not the end.
      expect(errorTextFor(C, "loanActive", "rescue")).toBe(C.market.errors.loanActive);
      expect(errorTextFor(C, "loanActive", "insolvent")).toBe(C.finances.insolvencyWarning);
      expect(C.finances.endsCareerWarning).not.toBe(C.finances.backerWarning);
      expect(C.finances.loansHintEnd).not.toBe(C.finances.loansHint);
      expect(C.finances.bankHintEnd(12, 10)).not.toBe(C.finances.bankHint(12, 10));
      expect(C.finances.bankHintEnd(12, 10)).toContain("12");
    }
    expect(CAREER_EN.finances.loansHintEnd).not.toMatch(/on theirs/);
    expect(CAREER_EN.finances.bankHintEnd(12, 10)).not.toMatch(/alternative to the Backer/);
    expect(CAREER_PT.finances.bankHintEnd(12, 10)).not.toMatch(/alternativa ao Investidor/);
  });

  it("the partner's run reads CAREER_LOAN.rescuePartner.weeks, never a hardcoded split (EN + PT)", () => {
    const weeks = CAREER_LOAN.rescuePartner.weeks;
    for (const C of [CAREER_EN as unknown as CareerCopy, CAREER_PT]) {
      const texts = [C.finances.breachLadder(3, 1, weeks), C.hub.backerNextBreach("rescue", true, weeks)];
      for (const t of texts) {
        expect(t).toContain(String(weeks));
        expect(t).not.toMatch(/a split|um split/);
      }
    }
    expect(CAREER_EN.hub.backerNextBreach("rescue", true, 7)).toContain("for 7 weeks");
    expect(CAREER_PT.hub.backerNextBreach("rescue", true, 7)).toContain("por 7 semanas");
    // The warnings carry it: Easy's first breach names the partner's run.
    let save = createCareerSave({ ...INPUT, difficulty: "easy" }, 70_106);
    for (const p of save.squad) p.salaryPerSplit = 8_000;
    save = quietSunday(save, 2);
    save.finances.balance = -weeklyStatementOf(save).net * 6;
    save = advanceDayFlow(save);
    const notice = mailOf(save, "cashNotice")[0] ?? mailOf(save, "cashWarning")[0];
    expect(notice.params).toMatchObject({ nextPartner: 1, partnerRun: weeks });
    const body = resolveMail(notice, CAREER_EN as unknown as CareerCopy).body;
    expect(body).toContain(`for ${weeks} weeks`);
    expect(resolveMail(notice, CAREER_PT).body).toContain(`por ${weeks} semanas`);
  });
});

// ===========================================================================
// ECO-09 — the 12 % index and the steeper ask for strong players
// ===========================================================================

describe("rc.33 ECO-09 — one index at 12 % and a steeper curve above the strong-player line", () => {
  const ask = (overall: number, seasonIndex = 0) =>
    computeSalaryAsk({ overall, age: 23, potential: overall, rep: 100, seasonIndex, lengthSeasons: 1, difficulty: "normal", careerSeed: 7, playerId: "x" });

  it("every stream moves on one index of 12 % a season", () => {
    expect(CAREER_ECONOMY.indexPerSeason).toBe(1.12);
    for (const stream of ["wages", "prizes", "sponsor", "flat"] as const) expect(moneyIndex(7, stream)).toBeCloseTo(1.12 ** 7, 10);
  });

  it("asks at or under the line are untouched; above it each point adds starGrowthPerPoint", () => {
    expect(starCurveFactor(CAREER_SALARY.starCurveFrom)).toBe(1);
    expect(starCurveFactor(60)).toBe(1);
    expect(starCurveFactor(CAREER_SALARY.starCurveFrom + 10)).toBeCloseTo(CAREER_SALARY.starGrowthPerPoint ** 10, 12);
    // Steeper: each point above the line costs more than one below it (rep 100: comfort ≥ 86 → no premium under 86).
    const below = ask(79) / ask(78);
    const above = ask(85) / ask(84);
    expect(above / below).toBeCloseTo(CAREER_SALARY.starGrowthPerPoint, 1);
    // Market value follows the same bend; a coach never does.
    const value = (o: number) => marketValueFor({ overall: o, age: 23, potential: o, seasonIndex: 0 });
    expect(value(88) / value(87)).toBeCloseTo(CAREER_SALARY.growthPerPoint * CAREER_SALARY.starGrowthPerPoint, 1);
    expect(coachSalaryFor(84, 0, "normal") / coachSalaryFor(83, 0, "normal")).toBeCloseTo(CAREER_SALARY.growthPerPoint, 1);
  });
});

// ===========================================================================
// M7 — guaranteed income: the tier bases and the fanbase
// ===========================================================================

describe("rc.33 M7 — guaranteed income carries a newcomer's founding wage bill", () => {
  it("the first offer (T1) plus the fanbase at its gate carries a balanced founding roster's wages — at least half, at most ~1.5×", () => {
    for (const d of ["easy", "normal", "hard"] as const) {
      const save = createCareerSave({ ...INPUT, difficulty: d }, 70_401);
      const wages = save.squad.reduce((n, p) => n + weeklyWage(p.salaryPerSplit), 0);
      const gate = CAREER_SPONSOR.firstOfferRepGate;
      const t1 = sponsorOffersFor(gate, 0, save.careerSeed, null, false, d).find((o) => o.tier === 1)!;
      const guaranteed = weeklyOf(t1.basePerSplit) + weeklyOf(gate * CAREER_ECONOMY.passivePerRepPoint);
      // Payroll ÷ guaranteed (b3) at the first offer: the founders are carried, a squad above them is not.
      const ratio = wages / guaranteed;
      expect(ratio, d).toBeGreaterThanOrEqual(0.66);
      expect(ratio, d).toBeLessThanOrEqual(2);
    }
    // The tiers climb and the fanbase grows with reputation from day one.
    const bases = CAREER_SPONSOR.tiers.map((t) => t.base);
    expect([...bases].sort((a, b) => a - b)).toEqual(bases);
    expect(CAREER_REP.start * CAREER_ECONOMY.passivePerRepPoint).toBeGreaterThan(0);
  });
});

// ===========================================================================
// ECO-12 — no sale listing, no late signing; an rc.32 save loads clean
// ===========================================================================

describe("rc.33 ECO-12 — the sale listing and the late signing are gone", () => {
  it("the flows are gone and nothing signs outside a window", () => {
    expect("listForSaleFlow" in flow).toBe(false);
    expect("withdrawListingFlow" in flow).toBe(false);
    expect("lateSigningOpen" in flow).toBe(false);
    const save = createCareerSave(INPUT, 70_501);
    save.clock.day = firstDayOfWeek(5) + 1;
    expect(isWindowWeek(5)).toBe(false);
    const fa = save.world.freeAgentIds[0];
    const planned = signingPlanFor(save, fa, { lengthSeasons: 1 });
    expect("error" in planned && planned.error).toBe("windowClosed");
  });

  /** An rc.32 Easy save mid-crisis: two restructurings behind it, a listing with its offer, a late-signing window. */
  function rc32Save(): CareerSave {
    const save = createCareerSave({ ...INPUT, difficulty: "easy" }, 70_502);
    const listed = save.squad[0];
    save.saleListings = [{ playerId: listed.id, seasonIndex: 0, day: firstDayOfWeek(11) + 1, waitDays: 0 }];
    save.lateSigning = { seasonIndex: 0, windowIdx: 1, untilDay: firstDayOfWeek(13) + 6, used: false, squadAfterSale: 3 };
    const offer: TransferOffer = {
      id: `list:0:${firstDayOfWeek(11) + 2}:${listed.id}`,
      direction: "out",
      playerId: listed.id,
      playerName: listed.name,
      fee: 12_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: Object.keys(save.world.orgs)[0],
      status: "pending",
      resolveSeason: 0,
      resolveDay: firstDayOfWeek(12) + 6,
      factors: [],
      listing: true,
    };
    save.pendingOffers = [offer];
    save.finances.loanBreaches = 3;
    save.finances.loanUsed = true;
    save.finances.loan = { remaining: 9_000 };
    save.mail.push({
      id: "m:old",
      seasonIndex: 0,
      day: firstDayOfWeek(9) + 1,
      kind: "finance",
      titleKey: "restructured",
      bodyKey: "restructured",
      params: { n: 3, player: "Someone", org: "Other", fee: 9_000, garnished: 4_500, granted: 0, balance: 1_200, rep: 5, rescueTo: 3_000, owed: 9_000, next: "restructure" },
      fromKey: "backer",
      read: false,
    } as MailItem);
    save.clock.day = firstDayOfWeek(12) + 1;
    const fin = save.finances as FinanceState & Record<string, unknown>;
    delete fin.balanceRing;
    delete fin.rescuePartner;
    return save;
  }

  it("an rc.32-shaped save loads cleanly: listing and late seat cleared, the offer kept as a plain bid, idempotent", () => {
    const old = rc32Save();
    const loaded = migrateSaveToV5(structuredClone(old))!;
    expect("saleListings" in loaded).toBe(false);
    expect("lateSigning" in loaded).toBe(false);
    expect(loaded.pendingOffers).toHaveLength(1);
    expect("listing" in loaded.pendingOffers[0]).toBe(false);
    expect(loaded.pendingOffers[0].fee).toBe(12_000);
    expect(loaded.finances.loanBreaches).toBe(3);
    expect(Array.isArray(loaded.finances.balanceRing)).toBe(true);
    expect(migrateSaveToV5(structuredClone(loaded))).toEqual(loaded);
    // The old mail still reads (EN + PT), and predicts no rule that no longer exists.
    const mail = loaded.mail.find((m) => m.titleKey === "restructured")!;
    for (const C of [CAREER_EN, CAREER_PT]) {
      const r = resolveMail(mail, C);
      expect(r.title).not.toBe("restructured");
      expect(r.body.length).toBeGreaterThan(20);
      expect(r.body).not.toMatch(/next breach forces|próxima quebra força/);
    }
    // rc.33's rules from the next breach: three breaches behind it, so the next one ends it on Easy.
    expect(CAREER_EN.finances.breachCount(3, breachesToEndFor("easy"))).toMatch(/next one ends the career/);
    const next = mondayAtFloor(loaded, 13, -10);
    expect(next.phase).toBe("ended");
    expect(next.end.reason).toBe("insolvency");
  });

  it("the repair is safe on a fresh rc.33 save (nothing to clear, the ring kept)", () => {
    const save = createCareerSave(INPUT, 70_503);
    const before = structuredClone(save);
    repairMoneyOnLoad(save);
    expect(save).toEqual(before);
  });
});

// ===========================================================================
// UX-07 — the Monday balance ring (the expanded Finances chart)
// ===========================================================================

describe("rc.33 UX-07 — the Monday balance ring", () => {
  const fin = (balance: number, ring?: FinanceState["balanceRing"]): FinanceState => ({
    balance,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear: { peripherals: false, monitors: false, pcs: false, perfCenter: false, psychologist: false },
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
    ...(ring ? { balanceRing: ring } : {}),
  });

  it("records one entry per Monday: a second record of the same Monday replaces it", () => {
    let f = recordMondayBalance(fin(1_000), { seasonIndex: 0, week: 2 }, -4_000);
    f = recordMondayBalance({ ...f, balance: 1_500 }, { seasonIndex: 0, week: 2 }, -4_000);
    expect(f.balanceRing).toEqual([{ s: 0, w: 2, b: 1_500, f: -4_000 }]);
    f = recordMondayBalance({ ...f, balance: 900 }, { seasonIndex: 0, week: 3 });
    expect(f.balanceRing).toEqual([
      { s: 0, w: 2, b: 1_500, f: -4_000 },
      { s: 0, w: 3, b: 900 },
    ]);
  });

  it("keeps the last balanceRingWeeks Mondays, oldest dropped", () => {
    let f = fin(0);
    for (let i = 0; i < CAREER_PAYROLL.balanceRingWeeks + 10; i++) {
      f = recordMondayBalance({ ...f, balance: i }, { seasonIndex: Math.floor(i / 32), week: (i % 32) + 1 });
    }
    expect(f.balanceRing).toHaveLength(CAREER_PAYROLL.balanceRingWeeks);
    expect(f.balanceRing![0].b).toBe(10);
    expect(f.balanceRing!.at(-1)!.b).toBe(CAREER_PAYROLL.balanceRingWeeks + 9);
  });

  it("the flow records the founding day and each Monday once — replaying a Monday or reloading adds nothing", () => {
    let save = createCareerSave(INPUT, 70_601);
    expect(mondayBalancesOf(save)).toEqual([{ s: 0, w: 1, b: save.finances.balance, f: backerLineOf(save).floor }]);
    for (let week = 1; week <= 5; week++) save = advanceDayFlow(quietSunday(save, week));
    const ring = mondayBalancesOf(save);
    expect(ring.map((m) => m.w)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ring.at(-1)!.b).toBe(save.finances.balance);
    // The same Monday processed again from the same Sunday (a replayed advance) → the same ring.
    const sunday = quietSunday(save, 6);
    expect(mondayBalancesOf(advanceDayFlow(sunday))).toEqual(mondayBalancesOf(advanceDayFlow(structuredClone(sunday))));
    // A reload never touches a recorded ring.
    expect(mondayBalancesOf(migrateSaveToV5(structuredClone(save))!)).toEqual(ring);
  });

  it("an older save is seeded only from the Mondays its ledger really booked (no floor, no invented weeks)", () => {
    let save = createCareerSave(INPUT, 70_602);
    for (let week = 1; week <= 4; week++) save = advanceDayFlow(quietSunday(save, week));
    const live = mondayBalancesOf(save).filter((m) => m.w > 1); // the founding day books no payroll line
    const old = structuredClone(save);
    delete (old.finances as FinanceState & Record<string, unknown>).balanceRing;
    const seeded = mondayBalancesOf(migrateSaveToV5(old)!);
    expect(seeded).toEqual(live.map(({ s, w, b }) => ({ s, w, b })));
    expect(mondayBalancesFromLedger({ balance: 500, ledger: [] })).toEqual([]);
  });

  it("a purchase on a Monday after the books closed is not seeded as payroll (rc.33 review)", () => {
    let save = createCareerSave(INPUT, 70_603);
    for (let week = 1; week <= 3; week++) save = advanceDayFlow(quietSunday(save, week));
    // Week 4's Monday: a psychologist on the books, a bank instalment, then the user's own moves that day.
    save = structuredClone(save);
    save.finances.gear.psychologist = true;
    save.finances.bankLoan = { principal: 4_000, remaining: 4_000, weeklyPayment: 400, takenSeason: 0, takenWeek: 3 };
    save = advanceDayFlow(quietSunday(save, 4));
    const live = mondayBalancesOf(save).find((m) => m.w === 5)!;
    const monday = save.finances.ledger.filter((l) => l.day === save.clock.day).map((l) => l.kind);
    expect(monday).toEqual(expect.arrayContaining(["payroll", "buff", "bankPayment"]));
    // A scout report (a "buff" line with a name) and an early bank payment, the same Monday.
    const bought = flow.buyScoutReportFlow(save, save.world.freeAgentIds[0]);
    expect(bought.error).toBeUndefined();
    const paid = flow.payBankLoanFlow(bought.save, 1_000);
    expect(paid.error).toBeUndefined();
    expect(paid.save.finances.balance).toBeLessThan(live.b);
    const old = structuredClone(paid.save);
    delete (old.finances as FinanceState & Record<string, unknown>).balanceRing;
    const seeded = mondayBalancesFromLedger(old.finances).find((m) => m.w === 5)!;
    expect(seeded.b).toBe(live.b);
  });
});
