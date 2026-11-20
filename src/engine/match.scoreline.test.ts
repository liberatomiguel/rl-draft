/**
 * v2.0.34 (player survey, 18/11): "a strong team against a weak one wins every
 * game 7–0, 7–1 or 7–2". The Draft's scoreline curve grows with the game's
 * margin until it hits the 7-goal cap; a career's wide gaps sat on the cap.
 * Road to Worlds sides (`careerScoreline`) read SIMULATION.goals.career.
 */
import { describe, expect, it } from "vitest";
import { SIMULATION } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type { TournamentTeam } from "./types";

function side(id: string, total: number, career: boolean): TournamentTeam {
  const stat = Math.round(total);
  return {
    id,
    name: id,
    isUser: id === "user",
    region: "EU",
    rating: { avgPlayerOverall: total, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total },
    chemistry: { raw: 3, max: 16, percent: 19, tier: "Okay", items: [] },
    stats: { offense: stat, defense: stat, mechanics: stat, consistency: stat, experience: stat, clutch: stat },
    specialIds: [],
    playerNames: ["A", "B", "C"],
    orgId: "",
    ...(career ? { rollRange: [-3, 3] as const, careerScoreline: true as const } : {}),
  };
}

function scorelines(strong: number, weak: number, career: boolean, seeds = 300) {
  const counts = new Map<string, number>();
  const winners: string[] = [];
  let games = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const series = simulateSeries(side("user", strong, career), side("opp", weak, career), { bestOf: 7, stage: "playoff", difficulty: "normal" }, createRng(seed));
    winners.push(`${series.winnerTeamId}:${series.score.join("-")}:${createRng(seed).state}`);
    for (const g of series.games) {
      const key = g.score.join("-");
      counts.set(key, (counts.get(key) ?? 0) + 1);
      games += 1;
    }
  }
  return { counts, games, winners };
}

describe("v2.0.34 — the career scoreline levels off on wide gaps", () => {
  it("a 105 side against a 75 one no longer wins most games 7–x; its usual win is 4 to 6 goals", () => {
    const career = scorelines(105, 75, true);
    const sevens = [...career.counts].filter(([k]) => k.startsWith("7-")).reduce((n, [, c]) => n + c, 0);
    expect(sevens / career.games).toBeLessThan(0.02);
    const mid = [...career.counts].filter(([k]) => ["4", "5", "6"].includes(k.split("-")[0])).reduce((n, [, c]) => n + c, 0);
    expect(mid / career.games).toBeGreaterThan(0.75);
    // No single scoreline repeats in most games (the survey's "always 7–0").
    expect(Math.max(...career.counts.values()) / career.games).toBeLessThan(0.5);
  });

  it("the Draft keeps its curve: the same gap still reaches the 7-goal cap (its goal stars are tuned on it)", () => {
    const draft = scorelines(105, 75, false);
    const sevens = [...draft.counts].filter(([k]) => k.startsWith("7-")).reduce((n, [, c]) => n + c, 0);
    expect(sevens / draft.games).toBeGreaterThan(0.5);
  });

  it("scorelines never change results: the same seeds give the same winners and series scores either way", () => {
    // Only the narrative goals differ; the form roll is the career's here, so compare the career run with itself
    // under the Draft curve by flipping the flag alone.
    const withCurve = (career: boolean) => {
      const out: string[] = [];
      for (let seed = 1; seed <= 200; seed++) {
        const a = { ...side("user", 95, true), ...(career ? {} : { careerScoreline: undefined }) };
        const b = { ...side("opp", 88, true), ...(career ? {} : { careerScoreline: undefined }) };
        const rng = createRng(seed);
        const s = simulateSeries(a, b, { bestOf: 7, stage: "playoff", difficulty: "normal" }, rng);
        out.push(`${s.winnerTeamId}:${s.score.join("-")}:${s.games.length}:${rng.state}`);
      }
      return out;
    };
    expect(withCurve(true)).toEqual(withCurve(false));
  });

  it("close games read as before: at a margin near zero the two curves give the same goals", () => {
    const g = SIMULATION.goals;
    expect(g.career.winnerBase).toBe(g.winnerBase);
    expect(g.career.winnerSpread).toBe(g.winnerSpread);
    expect(g.career.loserSpread).toBe(g.loserSpread);
    // The slope at zero (cap / scale) stays near the Draft's per-margin figures.
    expect(Math.abs(g.career.winnerCap / g.career.marginScale - g.winnerPerMargin)).toBeLessThan(0.05);
    expect(Math.abs(g.career.loserCap / g.career.marginScale - g.loserPerMargin)).toBeLessThan(0.1);
  });
});
