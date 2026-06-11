/**
 * Simulation sanity — asserts the §25 design anchors:
 * equal ratings ≈ coin flip · +2 favors · +6 dominant · +12 near-lock.
 * Deterministic seeds keep this suite stable.
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type { TournamentTeam } from "./types";

function fakeTeam(id: string, rating: number): TournamentTeam {
  return {
    id,
    name: id,
    isUser: false,
    region: "EU",
    rating: {
      avgPlayerOverall: rating,
      coachMod: 0,
      subMod: 0,
      orgMod: 0,
      chemMod: 0,
      specialMod: 0,
      difficultyShift: 0,
      total: rating,
    },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: {
      offense: 85,
      defense: 85,
      mechanics: 85,
      consistency: 85,
      experience: 85,
      clutch: 85,
    },
    specialIds: [],
    orgId: "",
  };
}

function winRate(diff: number, iterations: number, seed: number): number {
  const rng = createRng(seed);
  const a = fakeTeam("a", 88 + diff);
  const b = fakeTeam("b", 88);
  let wins = 0;
  for (let i = 0; i < iterations; i++) {
    const result = simulateSeries(a, b, { bestOf: 5, stage: "swiss", difficulty: "normal" }, rng);
    if (result.winnerTeamId === "a") wins += 1;
  }
  return wins / iterations;
}

describe("match simulation (§25 anchors)", () => {
  it("equal ratings → either team can win", () => {
    const rate = winRate(0, 1500, 101);
    expect(rate).toBeGreaterThan(0.42);
    expect(rate).toBeLessThan(0.58);
  });

  it("+2 rating → favored but beatable", () => {
    const rate = winRate(2, 1500, 202);
    expect(rate).toBeGreaterThan(0.55);
    expect(rate).toBeLessThan(0.82);
  });

  it("+6 rating → wins most of the time", () => {
    const rate = winRate(6, 1500, 303);
    expect(rate).toBeGreaterThan(0.82);
  });

  it("+12 rating → upsets are very rare", () => {
    const rate = winRate(12, 1500, 404);
    expect(rate).toBeGreaterThan(0.96);
  });

  it("series scores are well-formed", () => {
    const rng = createRng(7);
    const a = fakeTeam("a", 90);
    const b = fakeTeam("b", 87);
    for (let i = 0; i < 200; i++) {
      const r = simulateSeries(a, b, { bestOf: 7, stage: "playoff", difficulty: "normal" }, rng);
      const max = Math.max(r.score[0], r.score[1]);
      const min = Math.min(r.score[0], r.score[1]);
      expect(max).toBe(4);
      expect(min).toBeLessThan(4);
      expect(r.games.length).toBe(r.score[0] + r.score[1]);
      for (const g of r.games) {
        expect(g.score[0]).toBeGreaterThan(g.score[1]);
        if (g.overtime) expect(g.score[0] - g.score[1]).toBe(1);
      }
    }
  });
});
