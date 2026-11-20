/** Opt-in series win rate by rating gap (balance baseline). Not part of the normal suite.
 * GAP=1 GAP_N=20000 GAP_OUT=gap.json npx vitest run src/engine/match.gap.probe.test.ts
 * Favourite = base+gap vs base, equal stats, one fixed seed. Upset rate = 1 - favourite win rate.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { createRng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type { Difficulty, TournamentTeam } from "./types";

const env = process.env;

function fakeTeam(id: string, rating: number): TournamentTeam {
  return {
    id, name: id, isUser: false, region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
    specialIds: [], playerNames: ["A", "B", "C"], orgId: "",
  };
}

it.skipIf(!env.GAP)("measures series win rate by rating gap", () => {
  const n = Number(env.GAP_N ?? 20000);
  const rows: { difficulty: Difficulty; stage: string; bestOf: number; base: number; gap: number; favouriteWin: number; upset: number }[] = [];
  for (const difficulty of ["normal", "hard"] as Difficulty[]) for (const stage of ["swiss", "playoff"] as const)
    for (const bestOf of [5, 7]) for (const base of [88, 100]) for (const gap of [0, 2, 6, 12]) {
      const rng = createRng(4242 + gap);
      const a = fakeTeam("a", base + gap), b = fakeTeam("b", base);
      let wins = 0;
      for (let i = 0; i < n; i++) if (simulateSeries(a, b, { bestOf, stage, difficulty }, rng).winnerTeamId === "a") wins++;
      rows.push({ difficulty, stage, bestOf, base, gap, favouriteWin: wins / n, upset: 1 - wins / n });
    }
  if (env.GAP_OUT) writeFileSync(env.GAP_OUT, JSON.stringify({ n, rows }));
  console.log(`Gap probe: ${rows.length} cells x ${n}`);
}, 600_000);
