/** Opt-in series win rate by rating gap (balance baseline). Not part of the normal suite.
 * GAP=1 GAP_N=20000 GAP_OUT=gap.json npx vitest run src/engine/match.gap.probe.test.ts
 * Favourite = base+gap vs base, equal stats, one fixed seed. Upset rate = 1 - favourite win rate.
 * GAP_STYLES=1 (v2.1 Matchday): each series gives both sides a style and traits drawn from a
 * pool of real-looking career lineups (CAREER_DEV archetype mix, development.ts offsets), on a
 * separate RNG, so the series RNG stream is the same as without.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_DEV } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { deriveAttrOffsets } from "./career/development";
import { teamStyleFor } from "./career/styles";
import { playerTraits } from "./career/traits";
import type { ArchetypeId } from "./career/types";
import { simulateSeries } from "./match";
import type { Difficulty, Stats, TournamentTeam } from "./types";

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

type Profile = Pick<TournamentTeam, "style" | "traits">;
function profilePool(size: number, overall: number): Profile[] {
  const rng = createRng(777);
  const weights = Object.entries(CAREER_DEV.archetypeWeights as Record<string, number>);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const pick = () => { let u = rng.next() * total; for (const [id, w] of weights) if ((u -= w) < 0) return id; return weights[0][0]; };
  const out: Profile[] = [];
  for (let i = 0; i < size; i++) {
    const players = [0, 1, 2].map((j) => {
      const off = deriveAttrOffsets(`gp${i}-${j}`, 777, pick() as ArchetypeId);
      const stats = {} as Stats;
      for (const k of Object.keys(off) as (keyof Stats)[]) stats[k] = 85 + off[k];
      return { name: `gp${i}-${j}`, stats };
    });
    // As in production (teams.ts): stats only, no archetype.
    out.push({ style: teamStyleFor(players), traits: players.map((p) => playerTraits(p.name, overall + rng.int(-3, 3))) });
  }
  return out;
}

it.skipIf(!env.GAP)("measures series win rate by rating gap", () => {
  const n = Number(env.GAP_N ?? 20000);
  const styled = env.GAP_STYLES === "1";
  const decisions = env.GAP_DECISIONS === "1";
  const rows: { difficulty: Difficulty; stage: string; bestOf: number; base: number; gap: number; favouriteWin: number; upset: number }[] = [];
  for (const difficulty of ["normal", "hard"] as Difficulty[]) for (const stage of ["swiss", "playoff"] as const)
    for (const bestOf of [5, 7]) for (const base of [88, 100]) for (const gap of [0, 2, 5, 6, 12]) {
      const rng = createRng(4242 + gap);
      const pool = styled ? profilePool(600, base) : [];
      const pr = createRng(31337 + gap);
      const a = fakeTeam("a", base + gap), b = fakeTeam("b", base);
      let wins = 0;
      for (let i = 0; i < n; i++) {
        const sa0 = styled ? { ...a, ...pool[pr.int(0, pool.length - 1)] } : a;
        const sb0 = styled ? { ...b, ...pool[pr.int(0, pool.length - 1)] } : b;
        // GAP_DECISIONS=1 (slice 3): both sides carry the matchday mark (default plans, momentum meter).
        const sa = decisions ? { ...sa0, matchday: true as const } : sa0;
        const sb = decisions ? { ...sb0, matchday: true as const } : sb0;
        if (simulateSeries(sa, sb, { bestOf, stage, difficulty }, rng).winnerTeamId === "a") wins++;
      }
      rows.push({ difficulty, stage, bestOf, base, gap, favouriteWin: wins / n, upset: 1 - wins / n });
    }
  if (env.GAP_OUT) writeFileSync(env.GAP_OUT, JSON.stringify({ n, styled, decisions, rows }));
  console.log(`Gap probe: ${rows.length} cells x ${n}${styled ? " (styles on)" : ""}`);
}, 900_000);
