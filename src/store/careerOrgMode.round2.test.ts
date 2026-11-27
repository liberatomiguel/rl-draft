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
  it("the season plan comes first, the sponsor desk opens once it is accepted, and the autopilot never stalls", () => {
    const pick = choices("SAM", "normal")[0];
    const save = createCareerSave(input("SAM", "normal", pick.ref), SEED);
    expect(pendingDecisionsOf(save)[0]?.kind).toBe("board");
    expect(save.sponsorOffers ?? []).toHaveLength(0);
    const planned = chooseBoardPackageFlow(save, "expected").save;
    expect(planned.sponsorOffers?.length).toBeGreaterThanOrEqual(2);
    expect(pendingDecisionsOf(planned).some((d) => d.kind === "sponsor")).toBe(true);
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
  it("every org of NA, EU and SAM, Normal and Hard, season 0: cash + Expected budget cover the committed season, before any sponsor income; Cautious < Expected < Ambitious", () => {
    let n = 0;
    for (const difficulty of ["normal", "hard"] as const)
      for (const region of ["NA", "EU", "SAM"] as const)
        for (const c of choices(region, difficulty)) {
          const save = createCareerSave(input(region, difficulty, c.ref), SEED);
          const offers = pendingPackageOf(save)!;
          const grant = (id: string) => offers.find((o) => o.id === id)!.grant;
          expect(grant("cautious")).toBeLessThan(grant("expected"));
          expect(grant("expected")).toBeLessThan(grant("ambitious"));
          const b = seasonBudgetOf(chooseBoardPackageFlow(save, "expected").save)!;
          expect(b.incomeToCome.sponsor, c.name).toBe(0);
          expect(b.free, `${difficulty} ${region} ${c.name} (${c.stature})`).toBeGreaterThanOrEqual(0);
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
