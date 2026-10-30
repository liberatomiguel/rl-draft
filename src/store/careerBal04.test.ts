/**
 * Road to Worlds — BAL-04 (rc.33, Miguel 30/10: "Normal felt a bit easy";
 * the retune left to Claude). The presets' intent (R59): Easy 81 %, Normal
 * 65 %, Hard 55 % of Bo5 series won at even strength. Measured as the arc
 * harness measures it — two sides of EQUAL team rating (the AI shift left
 * out), the preset's form rolls and AI shift on top — rc.32 ran 84.7 / 70.5 /
 * 56.2 %; rc.33 moves Easy's and Normal's AI shift so the ladder sits on R59's
 * numbers. Overall stays the main signal: a 4-point gap still decides.
 */

import { describe, expect, it } from "vitest";
import { TOURNAMENT } from "@/config/balance";
import { careerMatchProfile } from "@/engine/career/difficulty";
import type { CareerDifficulty } from "@/engine/career/types";
import { orgTeamFor } from "@/engine/career/worldSim";
import { simulateSeries } from "@/engine/match";
import type { TournamentTeam } from "@/engine/types";
import { createRng } from "@/lib/rng";
import { createCareerSave } from "./careerFlow";

/** The user and an AI side of equal team rating (the base org's), each with the preset's match profile. */
function evenSides(base: TournamentTeam, d: CareerDifficulty, gap = 0): { user: TournamentTeam; ai: TournamentTeam } {
  const p = careerMatchProfile(d);
  const intrinsic = base.rating.total - base.rating.difficultyShift;
  return {
    user: {
      ...base,
      id: "user",
      isUser: true,
      rating: { ...base.rating, difficultyShift: 0, total: intrinsic + gap },
      rollRange: p.userRollRange,
    },
    ai: {
      ...base,
      id: "ai",
      isUser: false,
      rating: { ...base.rating, difficultyShift: p.opponentRatingShift, total: intrinsic + p.opponentRatingShift },
      rollRange: p.aiRollRange,
    },
  };
}

function winRate(base: TournamentTeam, d: CareerDifficulty, gap = 0, n = 1500): number {
  const { user, ai } = evenSides(base, d, gap);
  let won = 0;
  for (let k = 0; k < n; k++) {
    const s = simulateSeries(user, ai, { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss", difficulty: d }, createRng(80_000 + k));
    if (s.winnerTeamId === "user") won += 1;
  }
  return (100 * won) / n;
}

describe("BAL-04 — the presets at even strength (the arc's yardstick)", () => {
  const save = createCareerSave(
    {
      identity: { orgName: "Even", abbrev: "EVN", managerName: "Bot", country: "BR", region: "SAM", crestId: "shield", colors: { primary: "#000000", secondary: "#ffffff" }, buffType: "consistency" },
      difficulty: "normal",
      rosterKey: "balanced",
    },
    80_808,
  );
  const ref = Object.values(save.world.orgs).find((o) => o.region === "SAM")!.ref;
  const base = orgTeamFor(ref, { world: save.world, seasonIndex: 0, careerSeed: save.careerSeed, difficulty: "normal" });

  it("Easy ≈ 81 %, Normal ≈ 65 %, Hard ≈ 55 % of Bo5 series at an equal team rating", () => {
    const easy = winRate(base, "easy");
    const normal = winRate(base, "normal");
    const hard = winRate(base, "hard");
    expect(easy).toBeGreaterThan(78);
    expect(easy).toBeLessThan(84);
    expect(normal).toBeGreaterThan(62);
    expect(normal).toBeLessThan(68);
    expect(hard).toBeGreaterThan(52);
    expect(hard).toBeLessThan(59);
  });

  it("overall still decides: four points down loses most series on every preset", () => {
    for (const d of ["easy", "normal", "hard"] as const) expect(winRate(base, d, -4, 600)).toBeLessThan(40);
  });
});
