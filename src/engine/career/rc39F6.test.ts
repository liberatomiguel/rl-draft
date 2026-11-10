/**
 * rc.37 F6 (the package that ships after rc.38.3): regression tests of the
 * rules it adds. R102 chemistry by time and official matches together.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CHEMISTRY } from "@/config/balance";
import type { SquadPlayer } from "./types";
import { careerChemistry } from "./worldSim";

const player = (id: string, splitsTogether: number, region = "EU", country?: string) =>
  ({ id, name: id, region, country, splitsTogether }) as unknown as SquadPlayer;
const trio = (tenure: number, regions: string[], countries: (string | undefined)[] = []) =>
  careerChemistry([0, 1, 2].map((i) => player(`p${i}`, tenure, regions[i], countries[i]))).percent;

describe("R102 — chemistry grows with time together up to 100 %; heritage is only the base", () => {
  const C = CAREER_CHEMISTRY;
  const fastTenure = C.connMaxPerPair / C.connPerSplitTogether;
  const MIXED = ["EU", "NA", "SAM"];
  const SAME = ["EU", "EU", "EU"];

  it("the fast phase is rc.38's: a trio from three regions is at 67 % after two splits, a same-region trio at 92 %", () => {
    expect(trio(0, MIXED)).toBe(0);
    expect(trio(0, SAME)).toBe(25);
    expect(trio(fastTenure, MIXED)).toBe(67);
    expect(trio(fastTenure, SAME)).toBe(92);
  });

  it("past it every trio keeps climbing to 100 %, the one without heritage the slowest", () => {
    const fullMixed = fastTenure + (C.maxRawPerPair - C.connMaxPerPair) / C.bondPerSplitTogether;
    const fullSame = fastTenure + (C.maxRawPerPair - C.connMaxPerPair - C.herRegion) / C.bondPerSplitTogether;
    expect(fullSame).toBeLessThan(fullMixed);
    expect(trio(fullMixed, MIXED)).toBe(100);
    expect(trio(fullSame, SAME)).toBe(100);
    expect(trio(fullSame, MIXED)).toBeLessThan(100);
    let prev = 0;
    for (let t = 0; t <= fullMixed + 2; t += 0.5) {
      const now = trio(t, MIXED);
      expect(now).toBeGreaterThanOrEqual(prev);
      expect(now).toBeLessThanOrEqual(100);
      prev = now;
    }
    expect(prev).toBe(100);
  });

  it("heritage never counts past a full pair: one same-country pair does not cover a new pair", () => {
    // Two compatriots long together + a newcomer from elsewhere, no grace (he has his own tenure 0).
    const veterans = [player("a", 20, "EU", "FR"), player("b", 20, "EU", "FR")];
    const chem = careerChemistry([...veterans, player("c", 0, "NA")]);
    const grace = Math.min(C.connMaxPerPair, 20 * C.newcomerGraceFactor * C.connPerSplitTogether);
    const graceBond = Math.max(0, 20 * C.newcomerGraceFactor - C.connMaxPerPair / C.connPerSplitTogether) * C.bondPerSplitTogether;
    const newPair = Math.min(C.maxRawPerPair, grace + graceBond);
    expect(chem.raw).toBeCloseTo(C.maxRawPerPair + 2 * newPair, 9);
  });

  it("swapping a starter of a long-standing core now costs chemistry (rc.38: none once the core was old)", () => {
    const core = [player("a", 12, "EU"), player("b", 12, "NA"), player("c", 12, "SAM")];
    const swapped = [core[0], core[1], player("d", 0, "OCE")];
    expect(careerChemistry(core).percent).toBe(100);
    expect(careerChemistry(swapped).percent).toBeLessThan(90);
    expect(careerChemistry(swapped).percent).toBeGreaterThanOrEqual(67);
  });
});
