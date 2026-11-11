/**
 * rc.46 (R121): a young player who can still reach the elite costs more
 * (CAREER_TALENT.elite). rc.48 (R129): the reputation gate reads his overall
 * alone again (gateShare 0); the rule itself stays, behind the knob.
 */
import { describe, expect, it } from "vitest";
import { CAREER_TALENT } from "@/config/balance";
import {
  eliteFactorFor,
  marketValueFor,
  repNeededForOverall,
  signableOverallCap,
  signingLevelOf,
  talentFactorsFor,
  upsideFactorFor,
} from "./economy";
import { signableAtRep } from "./market";

const E = CAREER_TALENT.elite;
const arc = { peakAge: 22, plateauYears: 3 };

describe("rc.46 (R121): elite talent", () => {
  it("nobody under the elite line is priced differently", () => {
    for (const [overall, gap] of [[70, 15], [80, 8], [85, 7], [88, 4], [92, 0], [97, 0]] as const) {
      if (overall + gap < E.fromPotential) expect(eliteFactorFor(overall, gap)).toBe(1);
    }
    expect(eliteFactorFor(97, 0)).toBe(1);
    const f = talentFactorsFor({ overall: 80, potential: 88, age: 18, ...arc });
    expect(f.potential).toBeCloseTo(upsideFactorFor(f.reachGap), 9);
  });

  it("the factor grows with the reachable top, in full from valueFullGap, and is capped", () => {
    expect(eliteFactorFor(87, 10)).toBeCloseTo(Math.min(E.valueMax, 1 + E.valuePerPoint * 5), 9);
    expect(eliteFactorFor(87, 10)).toBeGreaterThan(eliteFactorFor(85, 8));
    expect(eliteFactorFor(92, 1)).toBeCloseTo(1 + E.valuePerPoint * 1 * (1 / E.valueFullGap), 9);
    expect(eliteFactorFor(80, 19)).toBe(E.valueMax);
    for (const [o, g] of [[87, 10], [90, 5], [70, 29]] as const) expect(eliteFactorFor(o, g)).toBeLessThanOrEqual(E.valueMax);
  });

  it("his market value carries it; a ready star of the same overall is untouched", () => {
    const kid = { overall: 87, potential: 97, age: 18, seasonIndex: 4, ...arc };
    const f = talentFactorsFor(kid);
    expect(f.potential).toBeCloseTo(upsideFactorFor(f.reachGap) * eliteFactorFor(87, f.reachGap), 9);
    const plain = marketValueFor({ ...kid, potential: 91 });
    expect(marketValueFor(kid)).toBeGreaterThan(plain * 1.5);
    // Past his window the potential is unreachable: no premium.
    expect(talentFactorsFor({ overall: 87, potential: 97, age: 27, ...arc }).potential).toBe(1);
  });

  it("the reputation gate reads gateShare of an elite talent's gap while he is growing (rc.48: none)", () => {
    const kid = { overall: 87, potential: 97, age: 18, peakAge: 22 };
    expect(E.gateShare).toBe(0);
    expect(signingLevelOf(kid)).toBe(Math.round(87 + E.gateShare * 10));
    expect(signingLevelOf(kid)).toBe(87);
    expect(signingLevelOf({ ...kid, potential: 92 })).toBe(87);
    expect(signingLevelOf({ ...kid, age: 25 })).toBe(87);
    expect(signingLevelOf({ overall: 86.6 })).toBe(87);
    const needKid = repNeededForOverall(signingLevelOf(kid));
    const needPlain = repNeededForOverall(87);
    expect(needKid).toBe(needPlain);
    expect(signableAtRep(kid, needPlain)).toBe(true);
    if (needPlain > 0) expect(signableAtRep(kid, needPlain - 1)).toBe(false);
    // A bare overall keeps rc.45's rule.
    expect(signableAtRep(87, needPlain)).toBe(true);
    expect(signableOverallCap(needKid)).toBeGreaterThanOrEqual(signingLevelOf(kid));
  });
});
