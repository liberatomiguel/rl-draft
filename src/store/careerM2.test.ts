/**
 * Road to Worlds — M2, renewing your own players (rc.32, ECONOMY-CONTRACT §6
 * decision 2, option B as a PROVISIONAL default, R58).
 *
 * ask = min(fresh, max(current wage × renewalRaiseCap, fresh × renewalMarketFloor)),
 * the ambition premium and the Blockbuster-refusal surcharge on top; a
 * declining veteran renews at his lower fresh ask. renewalRule "fresh" is
 * rc.31's rule (the plain fresh ask, with rc.32's fix that a refused
 * Blockbuster surcharges it). The Squad sheet and the Market panel read the
 * same function renewPlayerFlow prices with.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SALARY } from "@/config/balance";
import { quantize, runwayWeeks, weeklyWage } from "@/engine/career/economy";
import { renewalAskFor } from "@/engine/career/market";
import { renewalTermsFor, titlePremiumFor } from "@/engine/career/renewal";
import type { CareerSave, SquadPlayer, TransferOffer } from "@/engine/career/types";
import { renewalRunwayOf } from "@/components/career/RenewalReadout";
import {
  createCareerSave,
  declineBidFlow,
  renewalTalkFor,
  renewalTermsOfSave,
  renewalTitlesOf,
  renewPlayerFlow,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Renew Org",
    abbrev: "RNW",
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

const S = CAREER_SALARY as { renewalRule: "capFloor" | "fresh" };

/** A save in its final contract season with player 0 set to `over`. */
function withPlayer(over: Partial<SquadPlayer>, mutate?: (save: CareerSave) => void): { save: CareerSave; p: SquadPlayer } {
  const save = structuredClone(createCareerSave(INPUT, 61_001));
  save.clock = { seasonIndex: 1, day: 24 * 7 - 6 };
  const p = Object.assign(save.squad[0], over, { contractEndSeason: 1 });
  mutate?.(save);
  return { save, p };
}

const ctxOf = (save: CareerSave, lengthSeasons: 1 | 2 | 3 = 2) => ({
  rep: save.reputation,
  seasonIndex: save.clock.seasonIndex,
  difficulty: save.difficulty,
  careerSeed: save.careerSeed,
  lengthSeasons,
});

/** What the flow writes. */
const renewed = (save: CareerSave, id: string, len: 1 | 2 | 3 = 2) => {
  const res = renewPlayerFlow(save, id, len);
  expect(res.error).toBeUndefined();
  return res.save.squad.find((x) => x.id === id)!;
};

describe("M2 — renewing your own players (provisional default 2-B)", () => {
  it("the provisional keys: rule capFloor, cap ×1.75, floor 60 %", () => {
    expect(CAREER_SALARY.renewalRule).toBe("capFloor");
    expect(CAREER_SALARY.renewalRaiseCap).toBe(1.75);
    expect(CAREER_SALARY.renewalMarketFloor).toBe(0.6);
  });

  it("a developed founder: his raise is capped at ×1.75 his current wage, not the full market jump", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 });
    const fresh = renewalAskFor(p, ctxOf(save));
    expect(fresh).toBeGreaterThan(6_000 * CAREER_SALARY.renewalRaiseCap);
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.bound).toBe("cap");
    expect(terms.ask).toBe(quantize(6_000 * CAREER_SALARY.renewalRaiseCap));
    expect(terms.freshAsk).toBe(fresh);
    expect(renewed(save, p.id).salaryPerSplit).toBe(terms.ask);
  });

  it("a breakout star on a modest old deal: never under 60 % of his market value", () => {
    // His wage × renewalMaxJump is above the floor, so the floor prices him.
    const probe = withPlayer({ overall: 86, potential: 88, salaryPerSplit: 1_000 });
    const floor = quantize(renewalTermsFor(probe.p, ctxOf(probe.save)).freshAsk * CAREER_SALARY.renewalMarketFloor);
    const wage = quantize((floor / CAREER_SALARY.renewalMaxJump) * 1.2);
    expect(wage * CAREER_SALARY.renewalRaiseCap).toBeLessThan(floor);
    const { save, p } = withPlayer({ overall: 86, potential: 88, salaryPerSplit: wage });
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.bound).toBe("floor");
    expect(terms.ask).toBe(quantize(terms.freshAsk * CAREER_SALARY.renewalMarketFloor));
    expect(terms.ask).toBeGreaterThan(wage * CAREER_SALARY.renewalRaiseCap);
    expect(renewed(save, p.id).salaryPerSplit).toBe(terms.ask);
  });

  it("rc.33: a breakout star on a cheap old deal climbs at most ×renewalMaxJump in one renewal", () => {
    const { save, p } = withPlayer({ overall: 86, potential: 88, salaryPerSplit: 1_000 });
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(quantize(terms.freshAsk * CAREER_SALARY.renewalMarketFloor)).toBeGreaterThan(1_000 * CAREER_SALARY.renewalMaxJump);
    expect(terms.bound).toBe("jump");
    expect(terms.ask).toBe(quantize(1_000 * CAREER_SALARY.renewalMaxJump));
    expect(terms.ask).toBeLessThan(terms.freshAsk);
    expect(renewed(save, p.id).salaryPerSplit).toBe(terms.ask);
  });

  it("a declining veteran renews at his lower fresh ask (the rule only ever lowers the price)", () => {
    const { save, p } = withPlayer({ overall: 72, potential: 72, salaryPerSplit: 30_000, birthYear: 2024 - 27 });
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.freshAsk).toBeLessThan(30_000);
    expect(terms.bound).toBe("fresh");
    expect(terms.ask).toBe(terms.freshAsk);
    expect(renewed(save, p.id).salaryPerSplit).toBe(terms.freshAsk);
  });

  it("a refused Blockbuster bid adds its surcharge on top of the rule (the flag is set by declining it)", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 });
    const before = renewalTermsFor(p, ctxOf(save)).ask;
    const offer: TransferOffer = {
      id: "bid:test-blockbuster",
      direction: "out",
      playerId: p.id,
      playerName: p.name,
      fee: 100_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      status: "pending",
      resolveSeason: 1,
      resolveDay: save.clock.day + 7,
      factors: [],
      blockbuster: true,
    };
    save.pendingOffers.push(offer);
    const declined = declineBidFlow(save, offer.id);
    // The refusal is stamped on that deal (front A's stamp, the one source).
    expect(declined.squad.find((x) => x.id === p.id)!.blockbusterRefusedUntil).toBe(p.contractEndSeason);
    const after = renewed(declined, p.id);
    expect(after.salaryPerSplit).toBe(quantize(quantize(6_000 * CAREER_SALARY.renewalRaiseCap) * CAREER_SALARY.blockbusterRefusalRenewalMult));
    expect(after.salaryPerSplit).toBeGreaterThan(before);
    // An ordinary bid leaves no mark.
    const plain = structuredClone(save);
    plain.pendingOffers = [{ ...offer, id: "bid:plain", blockbuster: undefined }];
    expect(declineBidFlow(plain, "bid:plain").squad.find((x) => x.id === p.id)!.blockbusterRefusedUntil).toBeUndefined();
  });

  it("the ambition premium stays on top of the capped price", () => {
    const { save, p } = withPlayer({ overall: CAREER_SALARY.ambitiousOverall + 1, potential: 92, salaryPerSplit: 45_000 }, (s) => {
      s.reputation = 10;
    });
    // rc.33 (ECO-09 steepened the ask above 80): a wage the raise cap prices whatever the
    // curve — the cap (×1.75) lands between the market floor and his fresh ask.
    p.salaryPerSplit = quantize(renewalTermsFor(p, ctxOf(save)).marketFloor * 0.8);
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.ambitious).toBe(true);
    expect(terms.bound).toBe("cap");
    expect(terms.ask).toBe(quantize(quantize(p.salaryPerSplit * CAREER_SALARY.renewalRaiseCap) * CAREER_SALARY.ambitionRenewalMult));
  });

  it("switch back: renewalRule 'fresh' prices the plain fresh ask exactly (rc.31's rule; a refused Blockbuster's surcharge is rc.32's fix)", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 }, (s) => {
      s.squad[0].blockbusterRefusedUntil = 1;
    });
    const was = S.renewalRule;
    try {
      S.renewalRule = "fresh";
      for (const len of [1, 2, 3] as const) {
        const terms = renewalTermsFor(p, ctxOf(save, len));
        expect(terms.rule).toBe("fresh");
        expect(terms.ask).toBe(renewalAskFor(p, ctxOf(save, len)));
        expect(terms.ask).toBeGreaterThan(renewalAskFor({ ...p, blockbusterRefusedUntil: undefined }, ctxOf(save, len)));
        expect(renewed(save, p.id, len).salaryPerSplit).toBe(renewalAskFor(p, ctxOf(save, len)));
      }
    } finally {
      S.renewalRule = was;
    }
  });

  it("the wage talk negotiates against the M2 price (rc.33: under his floor nothing moves; the floor signs)", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 });
    const ask = renewalTermsFor(p, ctxOf(save)).ask;
    const talk = renewalTalkFor(save, p, 2);
    expect(talk.ask.wagePerSplit).toBe(ask);
    const low = renewPlayerFlow(save, p.id, 2, { weekly: weeklyWage(quantize(ask * 0.3)) });
    expect(low.error).toBe("negotiationCounter");
    // rc.36 (front S2): the deal is untouched — only his refusal is counted.
    expect(low.save.squad).toEqual(save.squad);
    expect(low.save.finances).toEqual(save.finances);
    const atAsk = renewPlayerFlow(save, p.id, 2);
    expect(atAsk.save.squad.find((x) => x.id === p.id)!.salaryPerSplit).toBe(ask);
    const atFloor = renewPlayerFlow(save, p.id, 2, { weekly: talk.zone.floorWeekly });
    expect(weeklyWage(atFloor.save.squad.find((x) => x.id === p.id)!.salaryPerSplit)).toBe(talk.zone.floorWeekly);
  });

  it("the readout's runway is the Monday books after the renewal (M4's runwayWeeksAfter, his wage swapped for the ask)", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 }, (s) => {
      s.finances.balance = 4_000;
    });
    const terms = renewalTermsFor(p, ctxOf(save));
    const runway = renewalRunwayOf(save, p, terms);
    // Renew him, then read the books the next Monday would see.
    const after = renewPlayerFlow(save, p.id, 2).save;
    expect(runway).toBe(runwayWeeks(after.finances.balance, weeklyStatementOf(after).net));
    // A raise never lengthens the runway.
    const now = runwayWeeks(save.finances.balance, weeklyStatementOf(save).net);
    if (terms.ask > p.salaryPerSplit && now !== null) expect(runway).not.toBeNull();
  });
});

describe("rc.33 — the title raise at renewal (ECONOMY-CONTRACT M6 lever 3)", () => {
  const T = CAREER_SALARY.titleRenewalPremium;
  let nextId = 0;
  /** A stored result the user won (or not) at `tier` in `seasonIndex`. */
  const result = (tier: "t3" | "regional" | "major" | "worlds", seasonIndex: number, won = true) => ({
    eventId: `${seasonIndex}:${tier}:${nextId++}`,
    tier,
    seasonIndex,
    week: 4,
    name: tier,
    rows: [],
    championRef: won ? "user" : "org:x",
    userPlacement: won ? ("champion" as const) : ("top4" as const),
    fieldQuality: 1,
  });

  it("prices +10 % a Major or Worlds title and +5 % a regional title, capped at +30 %", () => {
    expect(titlePremiumFor(undefined)).toBe(0);
    expect(titlePremiumFor({ majorOrWorlds: 0, regional: 0 })).toBe(0);
    expect(titlePremiumFor({ majorOrWorlds: 2, regional: 1 })).toBeCloseTo(2 * T.perMajorOrWorlds + T.perRegional);
    expect(titlePremiumFor({ majorOrWorlds: 9, regional: 9 })).toBe(T.max);
  });

  it("counts only the user's regional / Major / Worlds titles in the window, and never before he joined", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000, joinedSeason: 0 }, (s) => {
      s.eventResults = [
        result("major", 1),
        result("regional", 1),
        result("regional", 0),
        result("t3", 1), // a cup is not a title here
        result("worlds", 1, false), // a loss
        result("regional", 0), // season 0 again, inside the two-season window
      ] as unknown as CareerSave["eventResults"];
    });
    expect(renewalTitlesOf(save, p)).toEqual({ majorOrWorlds: 1, regional: 3 });
    // A player who joined this season only counts this season's titles.
    expect(renewalTitlesOf(save, { joinedSeason: 1 })).toEqual({ majorOrWorlds: 1, regional: 1 });
  });

  it("the renewal the flow prices carries the raise; without titles it is the M2 ask", () => {
    const plain = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000, joinedSeason: 0 });
    const base = renewalTermsOfSave(plain.save, plain.p, 2);
    expect(base.titlePremium).toBe(0);
    expect(base.ask).toBe(renewalTermsFor(plain.p, ctxOf(plain.save)).ask);
    const won = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000, joinedSeason: 0 }, (s) => {
      s.eventResults = [result("major", 1), result("regional", 1)] as unknown as CareerSave["eventResults"];
    });
    const terms = renewalTermsOfSave(won.save, won.p, 2);
    expect(terms.titlePremium).toBeCloseTo(T.perMajorOrWorlds + T.perRegional);
    expect(terms.ask).toBe(quantize(base.ask * (1 + terms.titlePremium)));
    // The talk and the flow read the same terms.
    expect(renewalTalkFor(won.save, won.p, 2).ask.weekly).toBeGreaterThan(renewalTalkFor(plain.save, plain.p, 2).ask.weekly);
  });
});

