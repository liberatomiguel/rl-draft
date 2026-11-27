/**
 * v2.2 rc.6 round 2 (R168-R170): the established org's sponsor desk on day one,
 * a season plan that funds the season it asks for, and the budget's income
 * lines. FEATURES.board and FEATURES.realOrgStart on; dataset-agnostic (every
 * org of NA, EU and SAM).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { careerCosmeticMarks, evaluateCareerAchievements, startAchievementBaseline, worldsWonOnAfter } from "@/engine/career/achievements";
import { seasonBudgetOf } from "@/engine/career/budget";
import { operationsOf } from "@/engine/career/established";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { advanceDayFlow, createCareerSave, type CreateCareerInput } from "./careerFlow";
import { boardAutoAnswer, chooseBoardPackageFlow, pendingPackageOf } from "./boardFlow";
import { pendingDecisionsOf } from "./careerDecisions";

const SEED = 4242;
type R = "NA" | "EU" | "SAM";

function input(region: R, difficulty: CareerDifficulty, realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Test Club", abbrev: "TST", managerName: "Manager", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty,
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function choices(region: R, difficulty: CareerDifficulty) {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty });
  return realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty, world });
}

describe("R168: the sponsor desk on day one", () => {
  // rc9 org (R221): the org arrives with a deal in force; the desk opens only when the org has none
  // (an rc.8 save loaded without one, or after a deal ends).
  it("the season plan comes first, the deal in force keeps the desk closed, a dealless org gets its desk, and the autopilot never stalls", () => {
    const pick = choices("SAM", "normal")[0];
    const save = createCareerSave(input("SAM", "normal", pick.ref), SEED);
    expect(pendingDecisionsOf(save)[0]?.kind).toBe("board");
    expect(save.sponsorOffers ?? []).toHaveLength(0);
    expect(save.sponsor?.terms?.inherited).toBe(true);
    const planned = chooseBoardPackageFlow(save, "expected").save;
    expect(planned.sponsorOffers ?? []).toHaveLength(0);
    expect(pendingDecisionsOf(planned).some((d) => d.kind === "sponsor")).toBe(false);
    const dealless = structuredClone(save);
    dealless.sponsor = null;
    const plannedDealless = chooseBoardPackageFlow(dealless, "expected").save;
    expect(plannedDealless.sponsorOffers?.length).toBeGreaterThanOrEqual(2);
    expect(pendingDecisionsOf(plannedDealless).some((d) => d.kind === "sponsor")).toBe(true);
    // Advance is never a dead button: the autopilot answers the plan and the desk, and the clock moves.
    let s: CareerSave = save;
    for (let i = 0; i < 20; i++) s = advanceDayFlow(boardAutoAnswer(s));
    expect(s.clock.day).toBeGreaterThan(10);
    expect(s.sponsor).not.toBeNull();
  });

  it("a founded club still waits for its reputation (no day-one desk)", () => {
    const founded = createCareerSave(input("SAM", "normal"), SEED);
    const planned = pendingPackageOf(founded) ? chooseBoardPackageFlow(founded, "expected").save : founded;
    expect(planned.sponsorOffers ?? []).toHaveLength(0);
  });
});

describe("R169: the Expected plan funds the season it asks for", () => {
  it("every org of NA, EU and SAM, Normal and Hard, season 0: cash + the mandate's budget cover the committed season, before any sponsor income", () => {
    let n = 0;
    for (const difficulty of ["normal", "hard"] as const)
      for (const region of ["NA", "EU", "SAM"] as const)
        for (const c of choices(region, difficulty)) {
          const save = createCareerSave(input(region, difficulty, c.ref), SEED);
          // v2.2 MANDATE: an established org's season has one package, the mandate's (the plans' order is the founded club's now).
          const offers = pendingPackageOf(save)!;
          expect(offers.map((o) => o.id)).toEqual(["expected"]);
          const b = seasonBudgetOf(chooseBoardPackageFlow(save, "expected").save)!;
          // rc9 org (R221): the deal in force pays from day one; the claim is still read before any sponsor money.
          const fixed = save.sponsor?.terms?.fixedPaid ? save.sponsor.terms.fixed : 0;
          expect(b.free - b.incomeToCome.sponsor - fixed, `${difficulty} ${region} ${c.name} (${c.stature})`).toBeGreaterThanOrEqual(0);
          n += 1;
        }
    expect(n).toBeGreaterThan(60);
  }, 300_000);
});

describe("R170: the budget's lines and the camp", () => {
  it("a signed deal's weekly pay is received and contracted, through its own last Monday", () => {
    let s: CareerSave = createCareerSave(input("EU", "normal", choices("EU", "normal")[0].ref), SEED);
    for (let i = 0; i < 30; i++) s = advanceDayFlow(boardAutoAnswer(s));
    const b = seasonBudgetOf(s)!;
    expect(s.sponsor).not.toBeNull();
    expect(b.income.sponsor).toBeGreaterThan(0);
    expect(b.incomeToCome.sponsor).toBeGreaterThan(0);
    const weekly = s.sponsor!.terms?.weekly ?? 0;
    expect(b.incomeToCome.sponsor).toBeLessThanOrEqual(weekly * b.mondaysLeft);
  }, 120_000);

  it("operationsOf returns the camp the flow runs, free when the sponsor pays for it", () => {
    const save = createCareerSave(input("NA", "normal", choices("NA", "normal")[0].ref), SEED);
    const camps = operationsOf(save)!.camps;
    expect(camps).toHaveLength(1);
    expect(camps[0].id).toBe("bootcamp2");
    const sponsored = structuredClone(save);
    sponsored.finances.balance = 0;
    sponsored.sponsor = { tier: 4, terms: undefined } as unknown as CareerSave["sponsor"];
    const free = operationsOf(sponsored)!.camps[0];
    if (free.free) {
      expect(free.price).toBe(0);
      expect(free.state).toBe("available");
    } else expect(free.state).toBe("cantAfford");
  });
});

describe("R171: permanent career achievements belong to the founded road", () => {
  const memory = { unlocked: {}, worldsWonOn: {} };

  it("an established org earns none of them, its cosmetic marks nor a Worlds-won difficulty", () => {
    const elite = createCareerSave(input("EU", "easy", choices("EU", "easy")[0].ref), SEED);
    expect(elite.reputation).toBeGreaterThanOrEqual(50);
    elite.stats.titlesMajor = 3;
    elite.stats.titlesWorlds = 1;
    elite.clock.seasonIndex = 6;
    expect(evaluateCareerAchievements(elite, memory)).toEqual([]);
    expect(careerCosmeticMarks(elite)).toEqual([]);
    expect(worldsWonOnAfter(elite, memory)).toEqual({});
  });

  it("a founded club earns them as before", () => {
    const founded = createCareerSave(input("EU", "normal"), SEED);
    founded.stats.titlesMajor = 1;
    expect(evaluateCareerAchievements(founded, memory)).toContain("car-first-major");
  });

  it("a club founded after a dismissal counts from its founding: nothing retroactive, seasons with that club", () => {
    const save = createCareerSave(input("EU", "normal"), SEED);
    save.stats.titlesMajor = 2;
    save.stats.titlesWorlds = 1;
    (save.flags as Record<string, unknown>).achSponsorSigned = true;
    save.clock.seasonIndex = 4;
    startAchievementBaseline(save, 4);
    expect(evaluateCareerAchievements(save, memory)).toEqual([]);
    expect(worldsWonOnAfter(save, memory)).toEqual({});
    save.stats.titlesMajor = 3;
    save.clock.seasonIndex = 7;
    const got = evaluateCareerAchievements(save, memory);
    expect(got).toContain("car-first-major");
    expect(got).toContain("car-three-seasons");
    expect(got).not.toContain("car-first-sponsor");
    expect(got).not.toContain("car-three-majors");
  });
});
