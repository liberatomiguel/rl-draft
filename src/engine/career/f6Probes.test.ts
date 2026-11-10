/**
 * rc.37 F6 probes (opt-in F6_PROBE=1): pure-engine Monte Carlo of match
 * effects that the battery's rating telemetry cannot see. The psychologist
 * adds clutch and consistency, which `team.rating.total` ignores but
 * match.ts reads (clutch in deciding games and overtime, consistency
 * dampening bad rolls and the series form). This prices that effect in
 * rating points: the win rate a +3/+3 side gets equals the win rate of
 * which rating edge. The default suite skips it.
 */
import { expect, it } from "vitest";
import { CAREER_GEAR } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { simulateSeries } from "@/engine/match";
import type { Stats, TournamentTeam } from "@/engine/types";

const N = Number(process.env.F6_PROBE_N ?? 40_000);

function team(id: string, total: number, stat: number, bonus: Partial<Stats> = {}): TournamentTeam {
  const stats = { offense: stat, defense: stat, mechanics: stat, consistency: stat, experience: stat, clutch: stat } as Stats;
  for (const [k, v] of Object.entries(bonus)) stats[k as keyof Stats] = Math.min(99, stats[k as keyof Stats] + (v ?? 0));
  return {
    id, name: id, isUser: false, region: "EU", rating: { total, avgPlayerOverall: total, coachMod: 0, subMod: 0 } as TournamentTeam["rating"],
    chemistry: { percent: 0 } as unknown as TournamentTeam["chemistry"], stats, specialIds: [], playerNames: [], orgId: id,
    rollRange: [-4, 4],
  };
}

function winRate(a: TournamentTeam, b: TournamentTeam, bestOf: number, stage: "swiss" | "playoff", seed: number): number {
  const rng = createRng(seed);
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const r = simulateSeries(a, b, { bestOf, stage, difficulty: "normal" }, rng);
    const winsA = r.games.filter((g) => g.winnerTeamId === a.id).length;
    if (winsA >= Math.ceil(bestOf / 2)) wins++;
  }
  return wins / N;
}

/** The rating edge whose win rate matches `target` (bisection on the same seed). */
function ratingEquivalent(target: number, stat: number, bestOf: number, stage: "swiss" | "playoff", seed: number): number {
  let lo = -1, hi = 1;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    const w = winRate(team("a", 85 + mid, stat), team("b", 85, stat), bestOf, stage, seed);
    if (w < target) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}

it.skipIf(process.env.F6_PROBE !== "1")("prices the psychologist's clutch/consistency in rating points", () => {
  const bonus = CAREER_GEAR.psychologistStatBonus as Partial<Stats>;
  const rows: string[] = [];
  for (const stat of [78, 84, 90]) for (const [bestOf, stage] of [[3, "swiss"], [5, "playoff"], [7, "playoff"]] as const) {
    const seed = 20261109 + stat * 10 + bestOf;
    const base = winRate(team("a", 85, stat), team("b", 85, stat), bestOf, stage, seed);
    const psych = winRate(team("a", 85, stat, bonus), team("b", 85, stat), bestOf, stage, seed);
    const eq = ratingEquivalent(psych, stat, bestOf, stage, seed);
    rows.push(`stats ${stat} | Bo${bestOf} ${stage} | equal teams ${(base * 100).toFixed(1)}% | +psychologist ${(psych * 100).toFixed(1)}% | ≈ ${eq} rating`);
  }
  console.log(["psychologist +" + JSON.stringify(bonus) + `, N=${N} series per point`, ...rows].join("\n"));
  expect(rows.length).toBe(9);
}, 3_600_000);

/**
 * rc.37 F6 (E): the championship briefing as a title chance. A Sunday bracket
 * (quarters Bo5, semis Bo7, final Bo7) against opponents that get stronger each
 * round; the plan shifts the user's rating per round (CAREER_SUNDAY
 * .championshipBriefing, or F6_BRIEFING = a JSON table to try). Prints the
 * title chance of keep / recover / prepare for a favourite, an even side and
 * an underdog, so "recover" can be priced as the favourite's choice.
 */
it.skipIf(process.env.F6_PROBE !== "1")("prices the championship briefing as a title chance by how favoured the side is", async () => {
  const { CAREER_SUNDAY } = await import("@/config/balance");
  type Plan = Record<"quarters" | "semis" | "final", number>;
  const table = (process.env.F6_BRIEFING ? JSON.parse(process.env.F6_BRIEFING) : CAREER_SUNDAY.championshipBriefing) as Record<string, Plan>;
  const rounds = [["quarters", 5], ["semis", 7], ["final", 7]] as const;
  // The user's edge over the quarter-final opponent; each later opponent is `step` stronger.
  const sides = [["strong favourite", 3, 1], ["favourite", 2, 1], ["even", 0.5, 0.75], ["underdog", -1, 0.75]] as const;
  const rows: string[] = [];
  for (const [label, edge, step] of sides) {
    const cells: string[] = [];
    for (const plan of ["keep", "recover", "prepare"]) {
      let title = 1;
      rounds.forEach(([round, bestOf], i) => {
        const user = team("a", 85 + edge - step * i + table[plan][round], 84);
        title *= winRate(user, team("b", 85, 84), bestOf, "playoff", 20261110 + i);
      });
      cells.push(`${plan} ${(title * 100).toFixed(1)}%`);
    }
    rows.push(`${label} (edge ${edge}, −${step}/round) | ${cells.join(" | ")}`);
  }
  console.log([`championship briefing ${JSON.stringify(table)}, N=${N}`, ...rows].join("\n"));
  expect(rows.length).toBe(sides.length);
}, 3_600_000);
