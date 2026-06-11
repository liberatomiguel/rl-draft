/**
 * Swiss stage (base doc §24): 16 teams, Bo5, 3 wins advance / 3 losses out,
 * max 5 rounds. Pairings group teams by identical record each round.
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type {
  Difficulty,
  SwissRound,
  SwissState,
  SwissTeamRecord,
  TournamentTeam,
} from "./types";

export function createSwissState(teamIds: string[], rng: Rng): SwissState {
  const records: SwissTeamRecord[] = teamIds.map((teamId) => ({
    teamId,
    wins: 0,
    losses: 0,
    gameDiff: 0,
    status: "active",
  }));
  return {
    rounds: [],
    records,
    nextPairings: pairActiveTeams(records, rng),
    finished: false,
  };
}

function pairActiveTeams(records: SwissTeamRecord[], rng: Rng): [string, string][] {
  const active = records.filter((r) => r.status === "active");

  // Group by record, best records first.
  const groups = new Map<string, SwissTeamRecord[]>();
  for (const record of active) {
    const key = `${record.wins}-${record.losses}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw - aw || al - bl;
  });

  const pairs: [string, string][] = [];
  let carry: SwissTeamRecord | null = null;
  for (const key of orderedKeys) {
    const group = rng.shuffle(groups.get(key)!);
    if (carry) {
      group.unshift(carry);
      carry = null;
    }
    while (group.length >= 2) {
      const a = group.pop()!;
      const b = group.pop()!;
      pairs.push([a.teamId, b.teamId]);
    }
    if (group.length === 1) carry = group[0];
  }
  return pairs;
}

export function playSwissRound(
  state: SwissState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
): SwissState {
  if (state.finished) return state;

  const records = state.records.map((r) => ({ ...r }));
  const pairs = state.nextPairings ?? pairActiveTeams(records, rng);
  const roundNumber = state.rounds.length + 1;

  const round: SwissRound = { round: roundNumber, series: [], userSeriesIndex: null };

  for (const [aId, bId] of pairs) {
    const result = simulateSeries(teams[aId], teams[bId], {
      bestOf: TOURNAMENT.swiss.bestOf,
      stage: "swiss",
      difficulty,
    }, rng);
    round.series.push(result);
    if (teams[aId].isUser || teams[bId].isUser) {
      round.userSeriesIndex = round.series.length - 1;
    }

    const winner = records.find((r) => r.teamId === result.winnerTeamId)!;
    const loser = records.find(
      (r) => r.teamId === (result.winnerTeamId === aId ? bId : aId),
    )!;
    const margin = Math.abs(result.score[0] - result.score[1]);
    winner.wins += 1;
    winner.gameDiff += margin;
    loser.losses += 1;
    loser.gameDiff -= margin;

    if (winner.wins >= TOURNAMENT.swiss.winsToAdvance) winner.status = "advanced";
    if (loser.losses >= TOURNAMENT.swiss.lossesToEliminate) loser.status = "eliminated";
  }

  const finished =
    records.every((r) => r.status !== "active") ||
    roundNumber >= 5; // structural cap

  return {
    rounds: [...state.rounds, round],
    records,
    nextPairings: finished ? null : pairActiveTeams(records, rng),
    finished,
  };
}

/** Bracket seeding for the advanced teams: fewer losses, then game diff, then rating. */
export function seedsFromSwiss(
  state: SwissState,
  teams: Record<string, TournamentTeam>,
): string[] {
  return state.records
    .filter((r) => r.status === "advanced")
    .sort(
      (a, b) =>
        a.losses - b.losses ||
        b.gameDiff - a.gameDiff ||
        teams[b.teamId].rating.total - teams[a.teamId].rating.total,
    )
    .map((r) => r.teamId);
}

export function userSwissRecord(state: SwissState): { wins: number; losses: number } {
  const record = state.records.find((r) => r.teamId === "user");
  return record ? { wins: record.wins, losses: record.losses } : { wins: 0, losses: 0 };
}
