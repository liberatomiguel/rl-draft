import { describe, expect, it } from "vitest";
import { CAREER_GEAR } from "@/config/balance";
import { userTeamFor } from "@/engine/career/worldSim";
import { createCareerSave } from "./careerFlow";
import { toolboxOf } from "./careerHq";

function fixture() {
  const save = createCareerSave({ identity: { orgName: "Late", abbrev: "END", managerName: "Tester", country: "BR", region: "SAM",
    crestId: "shield", colors: { primary: "#f97316", secondary: "#102050" }, buffType: "consistency" },
  difficulty: "normal", rosterKey: "prospects" }, 364);
  save.finances.gear = { peripherals: true, monitors: true, pcs: true, perfCenter: true, psychologist: false };
  return save;
}

function team(save: ReturnType<typeof fixture>, sharp = 0) {
  return userTeamFor({ identity: save.identity, squad: save.squad, starterIds: save.starterIds, coach: save.coach,
    gear: save.finances.gear, bootcampSharp: sharp, seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed, difficulty: save.difficulty }).team;
}

describe("late progression — actual assembled team and shown benefits", () => {
  it("the centre's competitive benefit survives the org-buff cap without changing players' permanent overall", () => {
    const save = fixture();
    const squad = structuredClone(save.squad);
    const actual = team(save);
    const item = CAREER_GEAR.items.find(i => i.id === "perfCenter")!;
    const mutable = item as unknown as { ratingBonus: number };
    const benefit = mutable.ratingBonus;
    try {
      mutable.ratingBonus = 0;
      const oldChannels = team(save);
      expect(actual.rating.orgMod).toBe(oldChannels.rating.orgMod);
      expect(actual.rating.total - oldChannels.rating.total).toBeCloseTo(benefit, 6);
    } finally { mutable.ratingBonus = benefit; }
    expect(save.squad).toEqual(squad);
    expect(toolboxOf(save).find(i => i.id === "perfCenter")?.ratingEdge).toBe(benefit);
  });

  it("caps the temporary camp independently; permanent facilities are retained", () => {
    const save = fixture();
    const base = team(save);
    const excessive = team(save, CAREER_GEAR.tempRatingMax * 10);
    const atCap = team(save, CAREER_GEAR.tempRatingMax);
    expect(excessive.rating.total).toBe(atCap.rating.total);
    expect(atCap.rating.total - base.rating.total).toBeCloseTo(CAREER_GEAR.tempRatingMax, 6);
  });

  it("psychology changes competitive stats and dropping it removes the effect", () => {
    const save = fixture();
    const without = team(save);
    save.finances.gear.psychologist = true;
    const retained = team(save);
    expect(retained.stats.clutch).toBeGreaterThan(without.stats.clutch);
    expect(retained.stats.consistency).toBeGreaterThan(without.stats.consistency);
    save.finances.gear.psychologist = false;
    expect(team(save).stats).toEqual(without.stats);
  });
});
