/**
 * rc9 DRAFT-UI (#281): the series that ended a run, read for the Results
 * screen. Pure and display-only; it reads the finished tournament and the
 * engine's own `runSeriesFacts`, so the numbers are the ones the engine used.
 */

import { runSeriesFacts } from "@/engine/runSeriesFacts";
import type { TournamentState } from "@/engine/types";

export interface RunEndGame {
  won: boolean;
  /** The player's goals first. */
  goals: [number, number];
  overtime: boolean;
}

export interface RunEnd {
  games: RunEndGame[];
  /** The rival's overall as every other screen shows it. */
  shown: number;
  /** The strength the rival played the series at, rounded; null when unknown. */
  played: number | null;
}

/** The player's last lost series that is not the third-place match, as games. */
export function runEnd(t: TournamentState | null | undefined): RunEnd | null {
  const user = t?.teams.user;
  if (!t || !user || t.playoffs?.championTeamId === "user") return null;
  const facts = runSeriesFacts(t);
  if (facts.endOppOverall == null) return null;
  const all = [
    ...t.swiss.rounds.flatMap((r) => r.series.map((s) => ({ s, round: "swiss" }))),
    ...(t.playoffs?.rounds ?? []).flatMap((r) => r.series.map((s) => ({ s, round: r.name }))),
  ].filter(({ s }) => s.teamAId === "user" || s.teamBId === "user");
  for (let i = all.length - 1; i >= 0; i--) {
    const { s, round } = all[i];
    if (s.winnerTeamId === "user" || round === "third_place") continue;
    return {
      games: s.games.map((g) => {
        const won = g.winnerTeamId === "user";
        return { won, goals: won ? [g.score[0], g.score[1]] : [g.score[1], g.score[0]], overtime: g.overtime };
      }),
      shown: facts.endOppOverall,
      played: facts.endOppStrength == null ? null : Math.round(facts.endOppStrength),
    };
  }
  return null;
}
