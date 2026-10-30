/**
 * Road to Worlds — rc.34 (Etapa 3, ECO-04 / ECO-05; docs/SPONSOR-CONTRACT.md,
 * Gate 3a approved 30/10: decisions 1–5 A, 6-B, 7-A) through the real flow.
 *
 *  - Offers: three profiles at a split boundary, a deadline, a lapse, a
 *    refresh mid-offer, the decision's shape for HQ (`sponsorDecisionOf`).
 *  - The deal: signing (the fixed part), the weekly pay, a goal reached (the
 *    bonus, a Bold deal's milestone), a goal missed (a fine proportional,
 *    capped, spread, never below the floor; none on Steady — the patience
 *    meter — or on Easy), the end of a deal and the next decision.
 *  - A signed deal keeps its figures across the money index.
 *  - Older saves: offers from before rc.34 become a decision at load; a deal
 *    from before rc.34 runs out on its old rules.
 *  - S6 as adjusted to ECO-07/08: an rc.32 founding partner hands over in
 *    ⅔, ⅓ steps (s6), `taper: []` restores the cliff.
 *  - ECO-05: the money inserts stop at the cap.
 *  - The arc bot's three profiles play without a softlock.
 */

import { describe, expect, it } from "vitest";
import { CAREER_INSERTS, CAREER_SPONSOR } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { CAREER_INSERTS_CATALOG, insertById } from "@/data/career/inserts";
import { ACH_FLAGS } from "@/engine/career/achievements";
import { firstDayOfWeek, weekOfDay } from "@/engine/career/calendar";
import { foundingPartnerBaseFor, sponsorOffersFor, weeklyOf } from "@/engine/career/economy";
import { insertWithinCap, rollInsertFor } from "@/engine/career/inserts";
import { fineFor, slotOf } from "@/engine/career/sponsorDeals";
import type { CareerSave, CompactEventResult, SponsorGoal, SponsorState } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";
import {
  advanceDayFlow,
  backerLineOf,
  chooseSponsorFlow,
  createCareerSave,
  migrateSaveToV5,
  repairSponsorsOnLoad,
  resolveInsertFlow,
  rolloverToNextSeason,
  sponsorDecisionOf,
  sponsorGoalProgressOf,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Deal Org",
    abbrev: "DEA",
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

/** Flip config keys for one check and always restore them. */
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

/** The Sunday of `week`, nothing else pending (offers kept): the next advance is that week's Monday + 1. */
function sundayOf(save: CareerSave, week: number, seasonIndex = save.clock.seasonIndex): CareerSave {
  const next = structuredClone(save);
  next.clock = { seasonIndex, day: firstDayOfWeek(week) + 6 };
  next.pendingEventDef = null;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.pendingOffers = [];
  return next;
}

/** The Monday after `week` (a plain arrival). */
function mondayAfter(save: CareerSave, week: number, seasonIndex = save.clock.seasonIndex): CareerSave {
  return advanceDayFlow(sundayOf(save, week, seasonIndex));
}

/** A career at `rep` that reaches the W11 boundary without a deal: the decision is on the desk. */
function decisionAtW11(seed: number, rep = 30, difficulty: CareerSave["difficulty"] = "normal"): CareerSave {
  const save = createCareerSave({ ...INPUT, difficulty }, seed);
  save.reputation = rep;
  save.sponsorOffers = null;
  return mondayAfter(save, 10);
}

function sign(save: CareerSave, profile: string): CareerSave {
  const offer = save.sponsorOffers!.find((o) => o.terms?.profile === profile)!;
  const res = chooseSponsorFlow(save, offer.sponsorId);
  expect(res.error).toBeUndefined();
  return res.save;
}

/** Set the running deal's goal for a slot (the tests pick the goal; the engine's pick is tested in sponsorDeals.test.ts). */
function withGoal(save: CareerSave, goal: Omit<SponsorGoal, "chance" | "word">): CareerSave {
  const next = structuredClone(save);
  const terms = next.sponsor!.terms!;
  terms.goals = [...terms.goals.filter((g) => g.slot !== goal.slot), { ...goal, chance: 0.5, word: "even" }];
  return next;
}

function userResult(seasonIndex: number, split: 1 | 2 | 3, week: number, tier: CompactEventResult["tier"], userPlacement: CompactEventResult["userPlacement"]): CompactEventResult {
  return { eventId: `t:${seasonIndex}:${week}:${tier}`, tier, seasonIndex, week, split, name: `T ${week}`, rows: [], championRef: "x", userPlacement, fieldQuality: 1 };
}

const ledgerOf = (save: CareerSave, kind: string) => save.finances.ledger.filter((l) => l.kind === kind);
const mailsOf = (save: CareerSave, key: string) => save.mail.filter((m) => m.titleKey === key);

// ===========================================================================
// Offers
// ===========================================================================

describe("rc.34 ECO-04 — a sponsor decision (S4: three profiles, one tier, a deadline)", () => {
  it("at a split boundary an org with standing and no deal gets three offers, mailed with their deadline", () => {
    const save = decisionAtW11(34_001);
    const d = sponsorDecisionOf(save)!;
    expect(d.offers.map((o) => o.terms!.profile)).toEqual(["steady", "balanced", "bold"]);
    expect(new Set(d.offers.map((o) => o.tier))).toEqual(new Set([2]));
    // HQ's queue reads { id, deadline (a day of the season) }; the cards the career day.
    expect(d.id).toBe(`sponsor:0:${firstDayOfWeek(11)}`);
    expect(d.deadline).toBe(13 * 7);
    expect(d.deadlineOn).toEqual({ seasonIndex: 0, day: 13 * 7 });
    const mail = mailsOf(save, "sponsorOffers")[0];
    expect(mail.bodyKey).toBe("sponsorDecision");
    expect(mail.params).toMatchObject({ n: 3, tier: 2, byWeek: 13 });
    expect(CAREER_EN.mail.body.sponsorDecision(mail.params!)).toContain("week 13");
    expect(CAREER_PT.mail.body.sponsorDecision(mail.params!)).toContain("semana 13");
    // Below the standing gate, nothing.
    expect(sponsorDecisionOf(decisionAtW11(34_001, CAREER_SPONSOR.firstOfferRepGate - 1))).toBeNull();
  });

  it("unsigned offers lapse the day after their deadline (a mail says so); the next boundary offers again", () => {
    let save = decisionAtW11(34_002);
    // The deadline day itself still holds them.
    save = advanceDayFlow({ ...sundayOf(save, 12), clock: { seasonIndex: 0, day: 13 * 7 - 1 } });
    expect(sponsorDecisionOf(save)).not.toBeNull();
    save = advanceDayFlow(sundayOf(save, 13));
    expect(save.clock.day).toBe(13 * 7 + 1);
    expect(sponsorDecisionOf(save)).toBeNull();
    expect(mailsOf(save, "sponsorLapsed")).toHaveLength(1);
    // Signing a stale offer (a screen left open) is refused.
    const stale = { ...save, sponsorOffers: decisionAtW11(34_002).sponsorOffers };
    expect(chooseSponsorFlow(stale, stale.sponsorOffers![0].sponsorId).error).toBe("expired");
    // W21: a fresh decision.
    const next = mondayAfter(save, 20);
    expect(sponsorDecisionOf(next)?.offers).toHaveLength(3);
  });

  it("a refresh mid-offer: the persisted decision loads unchanged, signable, and the load repair is idempotent", () => {
    const save = decisionAtW11(34_003);
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(loaded.sponsorOffers).toEqual(save.sponsorOffers);
    const again = migrateSaveToV5(JSON.parse(JSON.stringify(loaded)))!;
    expect(again.sponsorOffers).toEqual(save.sponsorOffers);
    expect(again.mail.length).toBe(save.mail.length);
    const signed = sign(loaded, "balanced");
    expect(signed.sponsor?.terms?.profile).toBe("balanced");
  });

  it("sponsorDecisionOf: null without offers or once the career is over", () => {
    const save = decisionAtW11(34_004);
    expect(sponsorDecisionOf({ ...save, sponsorOffers: null })).toBeNull();
    expect(sponsorDecisionOf({ ...save, phase: "ended" })).toBeNull();
  });
});

// ===========================================================================
// The deal
// ===========================================================================

describe("rc.34 ECO-04 — the deal: three dated parts (S1)", () => {
  it("signing books the fixed part (Steady, Balanced); every Monday books the weekly pay; Bold pays nothing on signing", () => {
    const save = decisionAtW11(34_011);
    const balanced = sign(save, "balanced");
    const terms = balanced.sponsor!.terms!;
    expect(terms.decideBy).toBeUndefined();
    expect(terms.fixedPaid).toBe(true);
    expect(ledgerOf(balanced, "sponsorSigning").at(-1)?.amount).toBe(terms.fixed);
    expect(balanced.sponsorOffers).toBeNull();
    expect(weeklyStatementOf(balanced).sponsorBase).toBe(terms.weekly);
    const monday = mondayAfter(balanced, 11);
    expect(ledgerOf(monday, "sponsorBase").at(-1)?.amount).toBe(terms.weekly);

    const bold = sign(save, "bold");
    expect(bold.sponsor!.terms!.fixedKind).toBe("milestone");
    expect(bold.sponsor!.terms!.fixedPaid).toBeFalsy();
    expect(ledgerOf(bold, "sponsorSigning").length).toBe(ledgerOf(save, "sponsorSigning").length);
  });

  it("a goal reached pays its bonus — and a Bold deal's milestone with the first one", () => {
    let save = sign(decisionAtW11(34_012), "bold");
    const slot = slotOf(0, 2);
    save = withGoal(save, { slot, kind: "regionalFinish", count: 1, place: 8 });
    save.eventResults = [...save.eventResults, userResult(0, 2, 14, "regional", "top8")];
    const bonus = save.sponsor!.bonus;
    const fixed = save.sponsor!.terms!.fixed;
    const settled = mondayAfter(save, 20);
    expect(ledgerOf(settled, "sponsorBonus").at(-1)?.amount).toBe(bonus);
    expect(ledgerOf(settled, "sponsorMilestone").at(-1)?.amount).toBe(fixed);
    expect(mailsOf(settled, "sponsorGoalHit")[0].params).toMatchObject({ bonus, milestone: fixed });
    // A one-split deal ends on its boundary: the next decision is on the desk.
    expect(settled.sponsor).toBeNull();
    expect(mailsOf(settled, "sponsorEnded")).toHaveLength(1);
    expect(sponsorDecisionOf(settled)?.offers).toHaveLength(3);
  });

  it("the Major goal is reached the day the field is announced (progress reads the field)", () => {
    const save = sign(decisionAtW11(34_013), "balanced");
    const goal: SponsorGoal = { slot: slotOf(0, 2), kind: "majorQualify", count: 1, chance: 0.5, word: "even" };
    const inField = structuredClone(save);
    inField.clock.day = firstDayOfWeek(20);
    inField.competition.majorFieldRefs = ["user"];
    expect(sponsorGoalProgressOf(inField, goal).hit).toBe(true);
    expect(sponsorGoalProgressOf(save, goal).hit).toBe(false);
  });

  it("a goal missed on a Balanced deal: a fine proportional to the shortfall, capped, spread over the next Mondays", () => {
    let save = sign(decisionAtW11(34_014), "balanced");
    const slot = slotOf(0, 2);
    save = withGoal(save, { slot, kind: "regionalFinish", count: 2, place: 8 });
    save.eventResults = [...save.eventResults, userResult(0, 2, 14, "regional", "top8")];
    save.finances.balance = 1_000_000;
    const terms = save.sponsor!.terms!;
    const fine = fineFor(terms, save.sponsor!.bonus, 0.5);
    expect(fine).toBeGreaterThan(0);
    expect(fine).toBeLessThanOrEqual(terms.fineCap);
    let s = mondayAfter(save, 20);
    expect(s.sponsor?.terms?.goals.find((g) => g.slot === slot)?.missed).toBe(0.5);
    expect(s.finances.sponsorFines?.[0].remaining).toBe(fine);
    expect(mailsOf(s, "sponsorGoalMissed")[0].params).toMatchObject({ fine, done: 1, target: 2 });
    // The patience meter is a Steady deal's: a Balanced miss is the fine alone (7-A).
    expect(s.sponsor!.missedCount).toBe(0);
    // Booked as its own line over the next Mondays (none on the settling Monday), never a lump sum.
    expect(ledgerOf(s, "sponsorFine")).toHaveLength(0);
    let paid = 0;
    for (let w = 21; w < 21 + CAREER_SPONSOR.fines.spreadMondays + 1; w++) {
      s = mondayAfter(s, w);
      paid += -ledgerOf(s, "sponsorFine").filter((l) => weekOfDay(l.day ?? 0) === w + 1).reduce((n, l) => n + l.amount, 0);
      expect(weeklyStatementOf(s).sponsorFine).toBeLessThanOrEqual(Math.max(...[0, ...(s.finances.sponsorFines ?? []).map((f) => f.perMonday)]));
    }
    expect(paid).toBe(fine);
    expect(s.finances.sponsorFines).toBeUndefined();
  });

  it("an instalment never takes the books below the Backer's floor — what would is waived (s4)", () => {
    let save = sign(decisionAtW11(34_015), "balanced");
    save = withGoal(save, { slot: slotOf(0, 2), kind: "regionalFinish", count: 3, place: 1 });
    save.finances.balance = 1_000_000;
    save = mondayAfter(save, 20);
    const owed = save.finances.sponsorFines![0];
    // Next Monday the books sit exactly where the week's lines leave them at the floor.
    const sunday = sundayOf(save, 21);
    const st = weeklyStatementOf(sunday);
    sunday.finances.balance = backerLineOf(sunday).floor - (st.income - st.expenses + st.sponsorFine);
    const monday = advanceDayFlow(sunday);
    expect(ledgerOf(monday, "sponsorFine").filter((l) => weekOfDay(l.day ?? 0) === 22)).toHaveLength(0);
    expect(monday.finances.loanBreaches ?? 0).toBe(0);
    expect(monday.finances.sponsorFines?.[0]?.remaining ?? 0).toBe(Math.max(0, owed.remaining - owed.perMonday));
  });

  it("no fine on a Steady deal (the patience meter counts the miss) and none on Easy (decision 1-A)", () => {
    let steady = sign(decisionAtW11(34_016), "steady");
    steady = withGoal(steady, { slot: slotOf(0, 2), kind: "regionalFinish", count: 3, place: 1 });
    steady = mondayAfter(steady, 20);
    expect(steady.finances.sponsorFines).toBeUndefined();
    expect(steady.sponsor!.missedCount).toBe(1);
    expect(mailsOf(steady, "sponsorGoalMissed")[0].params).toMatchObject({ fine: 0, steady: 1, misses: 1 });

    let easy = sign(decisionAtW11(34_017, 30, "easy"), "bold");
    expect(easy.sponsor!.terms!.fineShare).toBe(0);
    easy = withGoal(easy, { slot: slotOf(0, 2), kind: "regionalFinish", count: 3, place: 1 });
    easy = mondayAfter(easy, 20);
    expect(easy.finances.sponsorFines).toBeUndefined();
    expect(mailsOf(easy, "sponsorGoalMissed")[0].params).toMatchObject({ fine: 0, steady: 0 });
  });

  it("a Steady deal that ran out of patience renews one tier lower (7-A)", () => {
    let save = sign(decisionAtW11(34_018, 60), "steady");
    const tier = save.sponsor!.tier;
    // Two seasons from Split 2: six splits, the last settles on season 2's W11 boundary.
    const last = save.sponsor!.terms!.firstSlot + 5;
    expect(save.sponsor!.terms!.endsOn).toEqual({ seasonIndex: 2, day: firstDayOfWeek(11) });
    save.sponsor!.missedCount = CAREER_SPONSOR.patienceMisses - 1;
    save = withGoal(save, { slot: last, kind: "regionalFinish", count: 3, place: 1 });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview", clock: { seasonIndex: 0, day: 224 } });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview", clock: { seasonIndex: 1, day: 224 } });
    expect(save.sponsor?.terms?.profile).toBe("steady");
    save.reputation = 60;
    save = mondayAfter(save, 10, 2);
    expect(save.sponsor).toBeNull();
    expect(mailsOf(save, "sponsorEnded")[0].params).toMatchObject({ demoted: 1 });
    expect(sponsorDecisionOf(save)!.offers[0].tier).toBe(tier - 1);
  });
});

describe("rc.34 ECO-04 — a signed deal keeps its figures (S1, M1's index)", () => {
  it("a two-season deal pays the same weekly figure through the rollover; new offers carry the new season's money", () => {
    let save = sign(decisionAtW11(34_021), "steady");
    const weekly = save.sponsor!.terms!.weekly;
    save = rolloverToNextSeason({ ...save, phase: "seasonReview", clock: { seasonIndex: 0, day: 224 } });
    expect(save.clock.seasonIndex).toBe(1);
    expect(save.sponsor?.terms?.weekly).toBe(weekly);
    expect(weeklyStatementOf(save).sponsorBase).toBe(weekly);
    expect(ledgerOf(save, "sponsorBase").at(-1)).toMatchObject({ seasonIndex: 1, amount: weekly });
    expect(save.sponsorOffers).toBeNull();
    // The same tier offered fresh in season 1 pays more a week (the index moved on).
    const fresh = decisionAtW11(34_021);
    const s1 = mondayAfter({ ...fresh, sponsor: null, sponsorOffers: null, clock: { seasonIndex: 1, day: 1 } }, 10, 1);
    const steady1 = s1.sponsorOffers?.find((o) => o.terms?.profile === "steady");
    if (steady1 && steady1.tier === save.sponsor!.tier) expect(steady1.terms!.weekly).toBeGreaterThan(weekly);
  });
});

// ===========================================================================
// Older saves
// ===========================================================================

describe("rc.34 — saves from before rc.34", () => {
  it("offers from before rc.34 still pending become an rc.34 decision at load (repairSponsorsOnLoad, idempotent)", () => {
    const save = createCareerSave(INPUT, 34_031);
    save.reputation = 30;
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(11) };
    save.sponsorOffers = sponsorOffersFor(30, 0, save.careerSeed, null, false, "normal");
    expect(save.sponsorOffers.every((o) => !o.terms)).toBe(true);
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(loaded.sponsorOffers?.map((o) => o.terms?.profile)).toEqual(["steady", "balanced", "bold"]);
    const again = structuredClone(loaded);
    repairSponsorsOnLoad(again);
    expect(again).toEqual(loaded);
    // An ended career drops them.
    const ended = migrateSaveToV5(JSON.parse(JSON.stringify({ ...save, phase: "ended" })))!;
    expect(ended.sponsorOffers).toBeNull();
  });

  it("a deal from before rc.34 runs out on its old rules: its objective settles at the boundary, it ends at the rollover", () => {
    const save = createCareerSave(INPUT, 34_032);
    save.reputation = 30;
    const legacy: SponsorState = { ...sponsorOffersFor(30, 0, save.careerSeed, null, false, "normal")[0], progress: 2, hitThisSplit: false, missedCount: 0 };
    save.sponsor = legacy;
    expect(weeklyStatementOf(save).sponsorBase).toBe(weeklyOf(legacy.basePerSplit));
    // enterEvents with 2 entries: the old bonus at W11.
    const w11 = mondayAfter({ ...save, sponsor: { ...legacy, objectiveKind: "enterEvents", progress: 2 } }, 10);
    expect(ledgerOf(w11, "sponsorBonus").at(-1)?.amount).toBe(legacy.bonus);
    expect(w11.sponsor?.terms).toBeUndefined();
    expect(w11.sponsorOffers).toBeNull();
    // The rollover ends it and offers an rc.34 decision (the old patience meter can demote it).
    const next = rolloverToNextSeason({ ...w11, phase: "seasonReview", clock: { seasonIndex: 0, day: 224 } });
    expect(next.sponsor).toBeNull();
    expect(next.sponsorOffers?.map((o) => o.terms?.profile)).toEqual(["steady", "balanced", "bold"]);
  });
});

// ===========================================================================
// S6 — the founding partner's handover (an rc.32 career still running one)
// ===========================================================================

describe("rc.34 S6 — the founding partner hands over in steps (decision 5-A as adjusted to ECO-07/08)", () => {
  const withFounding = (fn: () => void) => withConfig(CAREER_SPONSOR.founding, { enabled: true }, fn);

  it("in full through season index 1; from season 2's first Monday ⅔, then ⅓, then it ends — no step above ⅓ of its pay (s6)", () => withFounding(() => {
    let save = createCareerSave(INPUT, 34_041);
    save.flags[ACH_FLAGS.sponsorSigned] = true; // a real deal signed in season 0
    const bill = save.foundingPartner!.wageBillPerSplit;
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.foundingPartner?.taperStep).toBeUndefined();
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(save.clock.seasonIndex).toBe(2);
    expect(save.foundingPartner?.taperStep).toBe(1);
    expect(mailsOf(save, "foundingHandover")).toHaveLength(1);
    const full = weeklyOf(foundingPartnerBaseFor({ wageBillPerSplit: bill, sizedSeason: 0 }, 2));
    const weeklyAt = (s: CareerSave) => weeklyStatementOf(s).foundingPartner;
    const steps = [full, weeklyAt(save)];
    expect(weeklyAt(save)).toBeCloseTo(full * CAREER_SPONSOR.founding.taper[0], -2);
    save = mondayAfter(save, 10);
    steps.push(weeklyAt(save));
    expect(save.foundingPartner?.taperStep).toBe(2);
    save = mondayAfter(save, 20);
    steps.push(weeklyAt(save));
    expect(save.foundingPartner?.endedSeason).toBe(2);
    expect(weeklyAt(save)).toBe(0);
    for (let i = 1; i < steps.length; i++) expect(steps[i - 1] - steps[i]).toBeLessThanOrEqual(full / 3 + 10);
  }));

  it("no deal before season 2: the handover starts with the first real deal; `taper: []` restores rc.33's cliff", () => withFounding(() => {
    let save = createCareerSave(INPUT, 34_042);
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    save.reputation = 30;
    const atW11 = mondayAfter({ ...save, sponsorOffers: null }, 10);
    expect(atW11.foundingPartner?.taperStep).toBeUndefined();
    const signed = sign(atW11, "balanced");
    expect(signed.foundingPartner?.taperStep).toBe(1);
    withConfig(CAREER_SPONSOR.founding, { taper: [] }, () => {
      const cliff = sign(atW11, "balanced");
      expect(cliff.foundingPartner?.endedSeason).toBe(2);
      expect(weeklyStatementOf(cliff).foundingPartner).toBe(0);
    });
  }));
});

// ===========================================================================
// ECO-05 — other income, capped (decision 6-B)
// ===========================================================================

describe("rc.34 ECO-05 — the money inserts count against the cap", () => {
  const moneyInserts = CAREER_INSERTS_CATALOG.filter((d) => d.options.some((o) => (o.effects.money ?? 0) > 0));

  it("past the split's count (or the season's share) no fee-paying insert comes; the others still do", () => {
    const save = createCareerSave(INPUT, 34_051);
    save.sponsor = { ...sponsorOffersFor(30, 0, save.careerSeed, null, false, "normal")[0] };
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(5) + 2 };
    for (const d of moneyInserts) expect(insertWithinCap(d, save)).toBe(true);
    const full = structuredClone(save);
    full.finances.incomeTally = { s: 0, earned: 1e6, other: 1_000, period: 1, otherCount: CAREER_SPONSOR.otherIncome.perSplitCap };
    for (const d of moneyInserts) expect(insertWithinCap(d, full)).toBe(false);
    const broke = structuredClone(save);
    broke.finances.incomeTally = { s: 0, earned: 0, other: 1e9, period: 1, otherCount: 0 };
    for (const d of moneyInserts) expect(insertWithinCap(d, broke)).toBe(false);
    // Rolled over many weeks, a capped save never draws one.
    const old = CAREER_INSERTS.chancePerWeek;
    withConfig(CAREER_INSERTS, { chancePerWeek: 1 }, () => {
      for (let w = 3; w <= 10; w++) {
        const d = rollInsertFor({ ...full, insertsSeen: [] }, w);
        if (d) expect(moneyInserts.map((m) => m.id)).not.toContain(d.id);
      }
    });
    expect(CAREER_INSERTS.chancePerWeek).toBe(old);
  });

  it("every fee-paying insert costs agenda time (a training session), never free money", () => {
    for (const d of moneyInserts) {
      const a = d.options.find((o) => (o.effects.money ?? 0) > 0)!;
      expect(a.effects.trainingWeeks ?? 0).toBeLessThan(0);
    }
    expect(insertById.get("ins-sponsor-jersey")!.options[0].effects.trainingWeeks).toBeLessThan(0);
  });

  it("an insert's fee lands in the season's other income (the cap's tally), its basis the earned income", () => {
    const save = createCareerSave(INPUT, 34_052);
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(5) + 2 };
    save.pendingInsert = { id: "ins-showmatch", day: save.clock.day };
    const before = save.finances.incomeTally?.other ?? 0;
    const after = flowResolve(save);
    expect((after.finances.incomeTally?.other ?? 0) - before).toBeGreaterThan(0);
    expect(after.finances.incomeTally?.otherCount).toBe(1);
  });
});

// ===========================================================================
// The arc bot's three profiles (the harness's "deals by profile")
// ===========================================================================

describe("rc.34 — the arc bot signs each profile and plays on (no softlock)", () => {
  it.each(["steady", "balanced", "bold"] as const)("%s", (profile) => {
    const career = playArcCareer({ region: "APAC", difficulty: "normal", policy: "autopilot", seed: 9100, seasons: 1, sponsor: profile, budgetMs: 60_000 });
    expect(career.softlock).toBeNull();
    expect(career.firstSponsorSeason).not.toBeNull();
  }, 120_000);
});

function flowResolve(save: CareerSave): CareerSave {
  return resolveInsertFlow(save, "a").save;
}
