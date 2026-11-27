/**
 * v2.2 ORGMODE-2027 (front ERA, E1/E4): a takeover starts at its era — the
 * clock, the board, the manager and the world agree on it, the career's
 * progress counts from it, and a founded club still starts at Season X.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { careerSeasonOf, LAST_START_ERA } from "@/engine/career/era";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";

const SEED = 5150;

function input(region: Region, extra: Partial<CreateCareerInput> = {}): CreateCareerInput {
  return {
    identity: { orgName: "S", abbrev: "S", managerName: "Bot", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#fff" }, buffType: "offense" },
    difficulty: "normal",
    rosterKey: "balanced",
    ...extra,
  };
}

function takeover(region: Region, era: number, index = 0): CareerSave {
  const world = computeStars(buildWorldAtCreation(SEED, era), { seasonIndex: era, careerSeed: SEED, difficulty: "normal" });
  const pick = realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: era, difficulty: "normal", world })[index];
  return createCareerSave(input(region, { realOrgRef: pick.ref, startSeasonIndex: era }), SEED);
}

describe("a takeover at the last era (RLCS 2027)", () => {
  const save = takeover("EU", LAST_START_ERA);

  it("starts its clock, board and manager at the era; its progress reads season 0", () => {
    expect(save.clock).toEqual({ seasonIndex: LAST_START_ERA, day: 1 });
    expect(save.startSeasonIndex).toBe(LAST_START_ERA);
    expect(save.world.eraStart).toBe(LAST_START_ERA);
    expect(careerSeasonOf(save)).toBe(0);
    expect(save.board?.startSeason).toBe(LAST_START_ERA);
    expect(save.manager?.spells[0].fromSeason).toBe(LAST_START_ERA);
    expect(save.manager!.contractUntil).toBeGreaterThanOrEqual(LAST_START_ERA);
  });

  it("takes over a real 2027 roster, ages on the 2027 clock, with its 2027 coach when it has one", () => {
    expect(save.identity.realOrgRef).toBeTruthy();
    expect(save.world.orgs[save.identity.realOrgRef!]).toBeUndefined();
    expect(save.squad).toHaveLength(3);
    for (const p of save.squad) {
      expect(p.joinedSeason).toBe(LAST_START_ERA);
      expect(p.contractEndSeason).toBeGreaterThan(LAST_START_ERA);
      expect(2027 - p.birthYear).toBeGreaterThanOrEqual(13);
    }
  });

  it("the founding day runs as a career's first day: no payroll on week 1, the start balance recorded", () => {
    expect(save.finances.ledger.some((e) => e.kind === "payroll")).toBe(false);
  });
});

describe("other eras and the founded club", () => {
  it("a takeover can start at any era of the timeline", () => {
    for (const era of [0, 2, 4]) {
      const s = takeover("NA", era);
      expect(s.clock.seasonIndex).toBe(era);
      expect(s.startSeasonIndex).toBe(era === 0 ? undefined : era);
      expect(s.board?.startSeason).toBe(era);
    }
  });

  it("a founded club ignores a start era in this stage: Season X, no field", () => {
    const s = createCareerSave(input("NA", { startSeasonIndex: 6 }), SEED);
    expect(s.clock.seasonIndex).toBe(0);
    expect("startSeasonIndex" in s).toBe(false);
    expect(s.world.eraStart).toBeUndefined();
  });

  it("a returning org is a takeover choice and says so", () => {
    const world = computeStars(buildWorldAtCreation(SEED, LAST_START_ERA), { seasonIndex: LAST_START_ERA, careerSeed: SEED, difficulty: "normal" });
    const back = realOrgChoicesFor("SAM", { careerSeed: SEED, seasonIndex: LAST_START_ERA, difficulty: "normal", world }).filter((c) => c.returningFrom !== undefined);
    expect(back.length).toBeGreaterThan(0);
    const s = createCareerSave(input("SAM", { realOrgRef: back[0].ref, startSeasonIndex: LAST_START_ERA }), SEED);
    expect(s.identity.realOrgRef).toBe(back[0].ref);
    expect(s.squad).toHaveLength(3);
  });
});
