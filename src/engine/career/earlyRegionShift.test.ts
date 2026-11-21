import { afterEach, describe, expect, it } from "vitest";
import { CAREER_REGION_FIELD, FEATURES } from "@/config/balance";
import type { Region } from "@/engine/types";
import { earlyRegionShift } from "./worldSim";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const flags = FEATURES as { worldLife: boolean };
const was = flags.worldLife;
afterEach(() => {
  flags.worldLife = was;
});

describe("v2.1 Mundo vivo M3 (R143): the early regional ramp", () => {
  it("is 0 everywhere with FEATURES.worldLife off (v2.0.35 exactly)", () => {
    flags.worldLife = false;
    for (const r of REGIONS)
      for (const d of ["easy", "normal", "hard"] as const)
        for (let s = 0; s < 12; s++) expect(earlyRegionShift(r, d, s)).toBe(0);
  });

  it("only eases EU and NA, never Hard, and never touches Major / Worlds tiers", () => {
    flags.worldLife = true;
    for (const r of REGIONS) {
      const dose = CAREER_REGION_FIELD.earlyShift[r];
      expect(dose).toBeLessThanOrEqual(0);
      if (r !== "EU" && r !== "NA") expect(dose).toBe(0);
      for (let s = 0; s < 12; s++) expect(earlyRegionShift(r, "hard", s)).toBe(0);
    }
    expect(CAREER_REGION_FIELD.tiers).not.toContain("major");
    expect(CAREER_REGION_FIELD.tiers).not.toContain("worlds");
    // EU is eased more than NA (the deeper field); Easy takes the same dose as Normal (R143: x1.2 made Easy EU easier than Easy NA).
    expect(earlyRegionShift("EU", "normal", 0)).toBeLessThan(earlyRegionShift("NA", "normal", 0));
    expect(earlyRegionShift("EU", "easy", 0)).toBe(earlyRegionShift("EU", "normal", 0));
  });

  it("is full through fade.fullThrough, fades linearly and is gone at fade.goneAt", () => {
    flags.worldLife = true;
    const { fullThrough, goneAt } = CAREER_REGION_FIELD.earlyShiftFade;
    const full = earlyRegionShift("EU", "normal", 0);
    expect(full).toBe(CAREER_REGION_FIELD.earlyShift.EU);
    expect(earlyRegionShift("EU", "normal", fullThrough)).toBe(full);
    let prev = full;
    for (let s = fullThrough + 1; s < goneAt; s++) {
      const v = earlyRegionShift("EU", "normal", s);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThan(0);
      prev = v;
    }
    expect(earlyRegionShift("EU", "normal", goneAt)).toBe(0);
    expect(earlyRegionShift("EU", "normal", goneAt + 5)).toBe(0);
  });
});
