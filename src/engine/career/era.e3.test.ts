/**
 * v2.2 ORGMODE-2027 (front ERA, E3): real players past the end of the dataset.
 * In a world built at the last era a young real player's ceiling is projected
 * (never below the dataset's), every real player develops off his cards, and
 * the retirement window is CAREER_ERA.longCareers. Every other world keeps the
 * dataset rules.
 */
import { describe, expect, it } from "vitest";
import { CAREER_AGE, CAREER_ERA } from "@/config/balance";
import { ageOf, deriveBirthYear, derivePotentialV2, playerViewById, retirementChanceFor } from "./development";
import { LAST_START_ERA, lastEraRulesOn, retirementTableOf } from "./era";
import { buildWorldAtCreation } from "./worldSim";

const SEED = 5150;

describe("E3 in a last-era world", () => {
  const world = buildWorldAtCreation(SEED, LAST_START_ERA);
  const ctx = { careerSeed: SEED, seasonIndex: LAST_START_ERA, world };
  const reals = Object.values(world.orgs)
    .flatMap((o) => o.playerIds)
    .filter((id) => !id.startsWith("fic:"));

  it("is on only for the last era", () => {
    expect(lastEraRulesOn(world)).toBe(CAREER_ERA.lastEraRules);
    expect(lastEraRulesOn(buildWorldAtCreation(SEED, 3))).toBe(false);
    expect(lastEraRulesOn(buildWorldAtCreation(SEED))).toBe(false);
    expect(retirementTableOf(buildWorldAtCreation(SEED))).toBe(CAREER_AGE);
  });

  it("every real player develops (off his cards) from day one", () => {
    if (!CAREER_ERA.lastEraRules) return;
    for (const id of reals) expect(id in world.overallDelta, id).toBe(true);
  });

  it("a young real player's potential is never below the dataset's, never above the cap; older players keep theirs", () => {
    let raised = 0;
    let young = 0;
    for (const id of reals) {
      const v = playerViewById(id, ctx)!;
      const dataset = derivePotentialV2(id, SEED);
      const age = ageOf(deriveBirthYear(id, SEED), LAST_START_ERA);
      if (age <= CAREER_ERA.projectedPotential.maxAge) {
        young++;
        expect(v.potential, id).toBeGreaterThanOrEqual(dataset);
        expect(v.potential, id).toBeLessThanOrEqual(Math.max(dataset, CAREER_ERA.projectedPotential.cap));
        if (v.potential > dataset) raised++;
        if (v.potential > dataset) expect(v.peakAge, id).toBeGreaterThanOrEqual(age);
      } else {
        expect(v.potential, id).toBe(dataset);
      }
    }
    expect(young).toBeGreaterThan(50);
    if (CAREER_ERA.lastEraRules) expect(raised).toBeGreaterThan(young / 2);
  });

  it("the long window: nobody retires before 26, the season at 32 is the last", () => {
    const T = CAREER_ERA.longCareers;
    const p = { peakAge: 22, overall: 80, starOverall: 99 };
    expect(retirementChanceFor({ ...p, age: 25, nextAge: 26 }, T)).toBe(0);
    expect(retirementChanceFor({ ...p, age: 26, nextAge: 27 }, T)).toBe(T.retirementByAge[26]);
    expect(retirementChanceFor({ ...p, age: 32, nextAge: 33 }, T)).toBe(1);
    // The default window is CAREER_AGE's, unchanged.
    expect(retirementChanceFor({ ...p, age: 29, nextAge: 30 })).toBe(1);
    expect(retirementChanceFor({ ...p, age: 24, nextAge: 25 })).toBe(CAREER_AGE.retirementByAge[24]);
  });
});
