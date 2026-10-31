/** Read-only adapter: the recorded event uses the same boards as a played event. */
import type { FollowEventState } from "@/engine/career/types";
import type { PlayoffRoundName } from "@/engine/types";
import { followSwissTable, followWinnerOf } from "@/engine/career/follow";
import { roundOrderFor } from "@/engine/playoffs";
import type { BracketTournament } from "./CareerBracket";

const names = new Set<string>([...roundOrderFor("double"), ...roundOrderFor("single")]);

export function followBoardOf(f: Pick<FollowEventState, "teams" | "swiss" | "playoffs" | "seeds">, revealedRounds: number) {
  const swissShown = Math.max(0, Math.min(revealedRounds, f.swiss.length));
  const playoffShown = Math.max(0, revealedRounds - f.swiss.length);
  const swissComplete = swissShown === f.swiss.length;
  const teams = Object.fromEntries(f.teams.map((team) => [team.id, { name: team.name, rating: { total: team.rating } }]));
  const rounds = f.playoffs.filter((round) => names.has(round.name)).map((round) => ({
    name: round.name as PlayoffRoundName,
    series: round.series.map((s) => ({ teamAId: s.a, teamBId: s.b, score: [s.sa, s.sb] as [number, number], winnerTeamId: followWinnerOf(s) })),
  }));
  const playoffs: BracketTournament["playoffs"] = rounds.length ? {
    format: rounds.some((r) => r.name.startsWith("ub_")) ? "double" : "single",
    finished: true,
    seeds: swissComplete ? f.seeds : [],
    rounds: swissComplete ? rounds : [],
    championTeamId: null,
  } : null;
  const revealed = new Set<string>();
  if (swissComplete) rounds.slice(0, playoffShown).forEach((round, ri) => round.series.forEach((_, si) => revealed.add(`po:${ri}:${si}`)));
  const records = new Map(followSwissTable(f, swissShown).map(({ id, ...record }) => [id, record]));
  return { tournament: { teams, playoffs }, revealed, records, swissShown };
}
