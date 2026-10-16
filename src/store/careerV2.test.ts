/**
 * Road to Worlds 2.0 (v2.0) — flow-level checks for the economy & market
 * clarity pass: weekly payroll through the day clock, the bank loan flows,
 * Community Cup fields that stop stacking stronger locals, and starter
 * rosters that no longer hand out a dead start.
 */

import { describe, expect, it } from "vitest";
import { CAREER_BANK, CAREER_UNOFFICIAL } from "@/config/balance";
import { firstDayOfWeek } from "@/engine/career/calendar";
import { bankLoanTerms } from "@/engine/career/economy";
import { isLocalRef } from "@/engine/career/localScene";
import type { CareerSave } from "@/engine/career/types";
import { fieldForEvent, userTeamFor } from "@/engine/career/worldSim";
import {
  advanceDayFlow,
  createCareerSave,
  payBankLoanFlow,
  starterOffersForRegion,
  takeBankLoanFlow,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Test Org",
    abbrev: "TST",
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

/** Advance (declining unofficials) until the given day. */
function advanceTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard < 400) {
    guard += 1;
    const before = save.clock.day;
    save = advanceDayFlow(save);
    if (save.clock.day === before) break; // official matchday — stop here
  }
  return save;
}

describe("weekly payroll through the day clock (R20)", () => {
  it("books a payroll line every Monday but the founding day, never per split", () => {
    let save = createCareerSave(INPUT, 20261016);
    expect(save.finances.ledger.some((e) => e.kind === "payroll")).toBe(false);
    save = advanceTo(save, firstDayOfWeek(4));
    const payrolls = save.finances.ledger.filter((e) => e.kind === "payroll");
    // Mondays of weeks 2, 3 and 4.
    expect(payrolls).toHaveLength(3);
    expect(payrolls.map((e) => e.week)).toEqual([2, 3, 4]);
    expect(save.finances.ledger.some((e) => e.kind === "salary")).toBe(false);
  });
});

describe("bank loan flows (R21)", () => {
  it("lends within the rep-tier limit, instalments book on Mondays, early pay-down clears it", () => {
    let save = createCareerSave(INPUT, 424242);
    const before = save.finances.balance;
    const tooMuch = takeBankLoanFlow(save, CAREER_BANK.maxByRepTier[4] * 2);
    expect(tooMuch.error).toBe("bankLimit");
    const res = takeBankLoanFlow(save, 2_000);
    expect(res.error).toBeUndefined();
    save = res.save;
    expect(save.finances.balance).toBe(before + 2_000);
    expect(save.finances.bankLoan?.remaining).toBe(bankLoanTerms(2_000).total);
    expect(save.mail[0]?.titleKey).toBe("bankLoan");
    // A second request is refused while one is open.
    expect(takeBankLoanFlow(save, 1_000).error).toBe("bankActive");
    // Next Monday books an instalment.
    save = advanceTo(save, firstDayOfWeek(2));
    const instalments = save.finances.ledger.filter((e) => e.kind === "bankPayment");
    expect(instalments).toHaveLength(1);
    expect(-instalments[0].amount).toBe(save.finances.bankLoan!.weeklyPayment);
    // Early pay-down of everything clears it and reports the news.
    const cleared = payBankLoanFlow(save, 999_999);
    expect(cleared.error).toBeUndefined();
    expect(cleared.save.finances.bankLoan).toBeNull();
    expect(cleared.save.news.some((n) => n.titleKey === "bankCleared")).toBe(true);
    expect(payBankLoanFlow(cleared.save, 100).error).toBe("none");
  });
});

describe("Community Cup field (R23)", () => {
  it("fields at most t3MaxStrongerTeams orgs rated above the user team", () => {
    const save = createCareerSave(INPUT, 9090);
    const user = userTeamFor({
      identity: save.identity,
      squad: save.squad,
      starterIds: save.starterIds,
      coach: save.coach,
      gear: save.finances.gear,
      bootcampSharp: 0,
      seasonIndex: save.clock.seasonIndex,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
      unavailablePlayerId: null,
    }).team;
    const def = {
      id: "0:4:unofficial",
      seasonIndex: 0,
      week: 4,
      day: 27,
      tier: "t3" as const,
      format: "single" as const,
      region: "SAM" as const,
      nameKey: "communityCup",
    };
    const { field } = fieldForEvent(def as never, {
      world: save.world,
      competition: save.competition,
      userTeam: user,
      userRegion: save.identity.region,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
    });
    expect(field).toHaveLength(8);
    const stronger = field.filter(
      (t) => !t.isUser && t.rating.total - t.rating.difficultyShift > user.rating.total,
    );
    // At most 2 real orgs above the user; locals may sit up to +1 in the band.
    const strongerOrgs = stronger.filter((t) => !isLocalRef(t.id));
    expect(strongerOrgs.length).toBeLessThanOrEqual(CAREER_UNOFFICIAL.t3MaxStrongerTeams);
    // Season 0: every SAM org out-rates a starter roster → locals fill the rest.
    const locals = field.filter((t) => isLocalRef(t.id));
    expect(locals.length).toBeGreaterThanOrEqual(3);
    const [lo, hi] = CAREER_UNOFFICIAL.localSceneBand;
    for (const t of locals) {
      const intrinsic = t.rating.total - t.rating.difficultyShift;
      expect(intrinsic).toBeGreaterThanOrEqual(user.rating.total + lo - 1);
      expect(intrinsic).toBeLessThanOrEqual(user.rating.total + hi + 1);
      expect(t.name).not.toBe(t.id);
    }
    // Same inputs → same field (deterministic, never persisted).
    const again = fieldForEvent(def as never, {
      world: save.world,
      competition: save.competition,
      userTeam: user,
      userRegion: save.identity.region,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
    });
    expect(again.field.map((t) => [t.id, t.rating.total])).toEqual(field.map((t) => [t.id, t.rating.total]));
  });
});

describe("starter rosters (R24)", () => {
  it("the three shapes overlap in day-one strength — no dead start", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const offers = starterOffersForRegion("SAM", seed * 1_000_003);
      expect(offers).toHaveLength(3);
      const avg = offers.map((o) => {
        const ovr = o.players.reduce((s, p) => s + p.overall, 0) / o.players.length;
        return { key: o.key, ovr };
      });
      const lo = Math.min(...avg.map((a) => a.ovr));
      const hi = Math.max(...avg.map((a) => a.ovr));
      expect(hi - lo).toBeLessThanOrEqual(8);
      expect(lo).toBeGreaterThanOrEqual(64);
    }
  });
});
