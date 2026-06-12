import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { createSwissState, playSwissRound, seedsFromSwiss } from "./swiss";
import type { TournamentTeam } from "./types";

function fakeTeam(id: string, rating: number): TournamentTeam {
  return {
    id,
    name: id,
    isUser: false,
    region: "NA",
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
    stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
    specialIds: [],
    playerNames: ["A", "B", "C"],
    orgId: "",
  };
}

describe("swiss stage (§24)", () => {
  it("16 teams resolve into exactly 8 advanced and 8 eliminated within 5 rounds", () => {
    for (const seed of [3, 17, 256]) {
      const rng = createRng(seed);
      const teams: Record<string, TournamentTeam> = {};
      for (let i = 0; i < 16; i++) {
        teams[`t${i}`] = fakeTeam(`t${i}`, 80 + i);
      }

      let state = createSwissState(Object.keys(teams), rng);
      let guard = 0;
      while (!state.finished && guard < 6) {
        state = playSwissRound(state, teams, "normal", rng);
        guard += 1;
      }

      expect(state.finished).toBe(true);
      expect(state.rounds.length).toBeLessThanOrEqual(5);

      const advanced = state.records.filter((r) => r.status === "advanced");
      const eliminated = state.records.filter((r) => r.status === "eliminated");
      expect(advanced).toHaveLength(8);
      expect(eliminated).toHaveLength(8);
      for (const r of advanced) {
        expect(r.wins).toBe(3);
        expect(r.losses).toBeLessThan(3);
      }
      for (const r of eliminated) {
        expect(r.losses).toBe(3);
        expect(r.wins).toBeLessThan(3);
      }

      // Game diff is zero-sum across the field.
      expect(state.records.reduce((sum, r) => sum + r.gameDiff, 0)).toBe(0);

      const seeds = seedsFromSwiss(state, teams);
      expect(seeds).toHaveLength(8);
      expect(new Set(seeds).size).toBe(8);
    }
  });

  it("pre-computes next pairings so the UI can show the upcoming opponent", () => {
    const rng = createRng(9);
    const teams: Record<string, TournamentTeam> = {};
    for (let i = 0; i < 16; i++) teams[`t${i}`] = fakeTeam(`t${i}`, 84 + (i % 8));

    let state = createSwissState(Object.keys(teams), rng);
    expect(state.nextPairings).toHaveLength(8);

    state = playSwissRound(state, teams, "normal", rng);
    expect(state.nextPairings).toHaveLength(8); // round 2: 4 in 1-0, 4 in 0-1
  });
});
