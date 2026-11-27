import { describe, expect, it } from "vitest";
import { DIFFICULTY } from "@/config/balance";
import { lineups } from "@/data";
import { createRng } from "@/lib/rng";
import { rosterFromLineup } from "./challenges";
import { overallBreakdown, sumOfParts } from "./overallBreakdown";
import { computeTeamRating, displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import type { BuffLevel, Difficulty } from "./types";

const keys = (b: ReturnType<typeof overallBreakdown>) => b.parts.map((p) => p.key);

describe("overallBreakdown (rc9 LEGACY, #222)", () => {
  it("three 99 cards and nothing else: the curve line explains why they read 97", () => {
    const r = computeTeamRating({ playerOveralls: [99, 99, 99], chemistryPercent: 0, chemistryMaxBonus: 0, specialCount: 0 });
    const b = overallBreakdown(r, { quick: true });
    expect(b.shown).toBe(displayTeamOverall(r));
    expect(b.shown).toBe(97);
    expect(keys(b)).toContain("curve");
    expect(b.parts.find((p) => p.key === "curve")!.value).toBeLessThan(0);
    expect(sumOfParts(b)).toBe(b.shown);
  });

  it("below the pivot there is no curve line", () => {
    const r = computeTeamRating({ playerOveralls: [88, 87, 86], coach: { overall: 82, bonusLevel: "+" }, sub: { overall: 80 }, chemistryPercent: 40, chemistryMaxBonus: 2, specialCount: 0 });
    const b = overallBreakdown(r);
    expect(keys(b)).not.toContain("curve");
    expect(keys(b)).not.toContain("cap");
    expect(sumOfParts(b)).toBe(b.shown);
  });

  it("a stacked roster shows the 99 cap and still reconciles", () => {
    const r = computeTeamRating({ playerOveralls: [101, 101, 101], coach: { overall: 99, bonusLevel: "+++" }, sub: { overall: 99 }, orgBuffLevel: "+++", chemistryPercent: 100, chemistryMaxBonus: 3, specialCount: 3 });
    const b = overallBreakdown(r);
    expect(b.shown).toBe(99);
    expect(keys(b)).toContain("cap");
    expect(sumOfParts(b)).toBe(99);
  });

  it("the parts always sum to the shown number (random rosters)", () => {
    const rng = createRng(2209);
    const levels = ["~", "+", "++", "+++"] as BuffLevel[];
    for (let i = 0; i < 3000; i++) {
      const r = computeTeamRating({
        playerOveralls: [rng.range(78, 101), rng.range(78, 101), rng.range(78, 101)].map((x) => Math.round(x)),
        coach: rng.chance(0.9) ? { overall: Math.round(rng.range(70, 99)), bonusLevel: rng.pick(levels) } : undefined,
        sub: rng.chance(0.9) ? { overall: Math.round(rng.range(70, 99)) } : undefined,
        orgBuffLevel: rng.pick(levels),
        chemistryPercent: Math.round(rng.range(0, 100)),
        chemistryMaxBonus: rng.pick([1.3, 2, 2.4, 3]),
        specialCount: rng.int(0, 3),
      });
      const b = overallBreakdown(r);
      expect(sumOfParts(b)).toBe(b.shown);
      // Rounding: half a point to the integer, plus up to 0.05 per stored part
      // (each part is rounded to 0.1 on its own in computeTeamRating).
      expect(Math.abs(b.parts.find((p) => p.key === "rounding")?.value ?? 0)).toBeLessThanOrEqual(0.8);
    }
  });

  it("reconciles for every real lineup drafted whole, on every difficulty", () => {
    for (const d of Object.keys(DIFFICULTY) as Difficulty[]) {
      for (const l of lineups.filter((x) => !x.rareSpawn)) {
        const team = buildUserTeam(rosterFromLineup(l.id), d, { mode: "classic" });
        const b = overallBreakdown(team.rating);
        expect(b.shown).toBe(displayTeamOverall(team.rating));
        expect(sumOfParts(b)).toBe(b.shown);
      }
    }
  });
});
