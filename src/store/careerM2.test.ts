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
import { quantize } from "@/engine/career/economy";
import { renewalAskFor } from "@/engine/career/market";
import { renewalTermsFor } from "@/engine/career/renewal";
import type { CareerSave, SquadPlayer, TransferOffer } from "@/engine/career/types";
import { createCareerSave, declineBidFlow, renewPlayerFlow, type CreateCareerInput } from "./careerFlow";

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
  it("the provisional keys: rule capFloor, cap ×1.5, floor 50 %", () => {
    expect(CAREER_SALARY.renewalRule).toBe("capFloor");
    expect(CAREER_SALARY.renewalRaiseCap).toBe(1.5);
    expect(CAREER_SALARY.renewalMarketFloor).toBe(0.5);
  });

  it("a developed founder: his raise is capped at ×1.5 his current wage, not the full market jump", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 });
    const fresh = renewalAskFor(p, ctxOf(save));
    expect(fresh).toBeGreaterThan(6_000 * CAREER_SALARY.renewalRaiseCap);
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.bound).toBe("cap");
    expect(terms.ask).toBe(quantize(6_000 * CAREER_SALARY.renewalRaiseCap));
    expect(terms.freshAsk).toBe(fresh);
    expect(renewed(save, p.id).salaryPerSplit).toBe(terms.ask);
  });

  it("a breakout star on a cheap old deal: never under 50 % of his market value", () => {
    const { save, p } = withPlayer({ overall: 86, potential: 88, salaryPerSplit: 1_000 });
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.bound).toBe("floor");
    expect(terms.ask).toBe(quantize(terms.freshAsk * CAREER_SALARY.renewalMarketFloor));
    expect(terms.ask).toBeGreaterThan(1_000 * CAREER_SALARY.renewalRaiseCap);
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
    const terms = renewalTermsFor(p, ctxOf(save));
    expect(terms.ambitious).toBe(true);
    expect(terms.bound).toBe("cap");
    expect(terms.ask).toBe(quantize(quantize(45_000 * CAREER_SALARY.renewalRaiseCap) * CAREER_SALARY.ambitionRenewalMult));
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

  it("the wage talk negotiates against the M2 price (a counter under it consults the hidden reserve)", () => {
    const { save, p } = withPlayer({ overall: 79, potential: 82, salaryPerSplit: 6_000 });
    const ask = renewalTermsFor(p, ctxOf(save)).ask;
    const low = renewPlayerFlow(save, p.id, 2, quantize(ask * 0.3));
    expect(low.error).toBe("lowball");
    const atAsk = renewPlayerFlow(save, p.id, 2, ask);
    expect(atAsk.save.squad.find((x) => x.id === p.id)!.salaryPerSplit).toBe(ask);
  });
});
