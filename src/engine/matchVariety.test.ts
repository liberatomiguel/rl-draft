/**
 * Series variety (v2.0, DESIGN-DECISIONS #114): momentum + the scoreline re-tune
 * make series between similar teams alternate (fewer sweeps, real comebacks)
 * without touching the §25 overall-dominance anchors (match.test.ts).
 */
import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type { Stats, TournamentTeam } from "./types";

function team(id: string, rating: number): TournamentTeam {
  const stat = (v: number) => Math.min(99, Math.max(60, v));
  const stats: Stats = { offense: stat(rating), defense: stat(rating), mechanics: stat(rating), consistency: stat(rating), experience: stat(rating), clutch: stat(rating) };
  return {
    id,
    name: id,
    isUser: false,
    region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 10, percent: 0, tier: "Poor", items: [] },
    stats,
    specialIds: [],
    playerNames: ["a", "b", "c"],
    orgId: id,
  };
}

function sample(gap: number, n: number, seed: number) {
  const rng = createRng(seed);
  let sweeps = 0;
  let comebacks = 0;
  let blowouts = 0;
  let games = 0;
  for (let i = 0; i < n; i++) {
    const s = simulateSeries(team("a", 90), team("b", 90 - gap), { bestOf: 7, stage: "playoff", difficulty: "normal" }, rng);
    if (s.score[0] === 0 || s.score[1] === 0) sweeps += 1;
    if (s.comeback) comebacks += 1;
    for (const g of s.games) {
      games += 1;
      if (g.score[0] >= 7 && g.score[1] === 0) blowouts += 1;
    }
  }
  return { sweeps: sweeps / n, comebacks: comebacks / n, blowouts: blowouts / games };
}

describe("series variety", () => {
  it("equal teams: sweeps are the exception, comebacks happen", () => {
    const r = sample(0, 3000, 11);
    expect(r.sweeps).toBeLessThan(0.3); // v1.4 was ~43 %
    expect(r.comebacks).toBeGreaterThan(0.005);
  });

  it("a clear favourite still sweeps most series (overall stays dominant)", () => {
    const r = sample(6, 2000, 12);
    expect(r.sweeps).toBeGreaterThan(0.75);
  });

  it("7–0 scorelines are rare even for a big favourite", () => {
    const r = sample(6, 2000, 13);
    expect(r.blowouts).toBeLessThan(0.05); // v1.4 was ~24 % of games
  });

  it("the comeback flag matches the games: the winner trailed by 2 at some point", () => {
    const rng = createRng(14);
    let seen = 0;
    for (let i = 0; i < 4000 && seen < 5; i++) {
      const s = simulateSeries(team("a", 90), team("b", 89), { bestOf: 7, stage: "playoff", difficulty: "normal" }, rng);
      if (!s.comeback) continue;
      seen += 1;
      let wa = 0;
      let wb = 0;
      let worst = 0;
      for (const g of s.games) {
        if (g.winnerTeamId === "a") wa += 1;
        else wb += 1;
        worst = Math.max(worst, s.winnerTeamId === "a" ? wb - wa : wa - wb);
      }
      expect(worst).toBeGreaterThanOrEqual(2);
      expect(s.games[s.games.length - 1].notes).toContain("comeback");
    }
    expect(seen).toBeGreaterThan(0);
  });
});
