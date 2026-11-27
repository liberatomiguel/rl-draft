/**
 * rc.6 (ORGMODE UI-A): the pick's dossier is the save the takeover creates.
 * Same input and seed, same board plans, money and squad; an older save
 * (no staff, no brief) still reads.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";
import { takeoverPreviewOf, takeoverViewOf } from "./takeoverPreview";

const SEED = 777;

function inputFor(ref: string): CreateCareerInput {
  return {
    identity: {
      orgName: "Org",
      abbrev: "ORG",
      managerName: "Manager",
      country: "US",
      region: "NA",
      crestId: "shield",
      colors: { primary: "#000000", secondary: "#ffffff" },
      buffType: "offense",
    },
    difficulty: "normal",
    rosterKey: "balanced",
    realOrgRef: ref,
  };
}

describe("takeoverPreviewOf", () => {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  const pick = realOrgChoicesFor("NA", { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world })[0];

  it("reads the board's mandate, the money and the squad of the save the takeover creates", () => {
    const preview = takeoverPreviewOf(inputFor(pick.ref), SEED);
    const created = createCareerSave(inputFor(pick.ref), SEED);
    expect(preview.plans.map((p) => p.objective)).toEqual(created.board!.season!.offers.map((o) => o.objective));
    // v2.2 MANDATE: one package (the mandate's classification goal) and the mandate with its demand and problems.
    expect(preview.plans).toHaveLength(1);
    expect(preview.mandate).toEqual(created.board!.season!.mandate);
    expect(["low", "medium", "high"]).toContain(preview.mandate!.demand);
    expect(preview.proposed?.id).toBe("expected");
    expect(preview.cash).toBe(created.finances.balance);
    expect(preview.starters.map((p) => p.id)).toEqual(created.starterIds);
    expect(preview.save.identity.realOrgRef).toBe(pick.ref);
    expect(preview.stature).toBe(pick.stature);
    expect(preview.weekWages).toBeGreaterThan(0);
    for (const p of preview.plans) expect(["expected", "reach", "stretch", "longShot"]).toContain(p.band);
  });

  it("reads a save with no board, no staff and no brief without throwing", () => {
    const save = createCareerSave(inputFor(pick.ref), SEED);
    delete save.board;
    delete save.finances.gear.staff;
    const view = takeoverViewOf(save);
    expect(view.plans).toEqual([]);
    expect(view.proposed).toBeNull();
    expect(view.brief).toBeNull();
    expect(view.staff.filter((s) => s !== "psychologist")).toEqual([]);
  });
});
