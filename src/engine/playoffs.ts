/**
 * Playoffs (MVP): 8 teams, single elimination, Bo7.
 * Bracket: 1v8, 4v5 on the top half; 2v7, 3v6 on the bottom half.
 * V2 upgrade path (double elimination) only touches this module.
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type {
  Difficulty,
  PlayoffRound,
  PlayoffRoundName,
  PlayoffState,
  TournamentTeam,
} from "./types";

const ROUND_ORDER: PlayoffRoundName[] = ["quarterfinal", "semifinal", "final"];

export function createPlayoffs(seeds: string[]): PlayoffState {
  if (seeds.length !== TOURNAMENT.playoffs.teams) {
    throw new Error(`Playoffs need ${TOURNAMENT.playoffs.teams} seeds, got ${seeds.length}`);
  }
  return { seeds, rounds: [], championTeamId: null, finished: false };
}

/** Pairings for the next round based on previous winners (or seeds for QF). */
export function nextPlayoffPairings(state: PlayoffState): [string, string][] {
  if (state.rounds.length === 0) {
    const s = state.seeds;
    // Top half: 1v8, 4v5 — bottom half: 2v7, 3v6.
    return [
      [s[0], s[7]],
      [s[3], s[4]],
      [s[1], s[6]],
      [s[2], s[5]],
    ];
  }
  const lastRound = state.rounds[state.rounds.length - 1];
  const winners = lastRound.series.map((s) => s.winnerTeamId);
  const pairs: [string, string][] = [];
  for (let i = 0; i < winners.length; i += 2) {
    pairs.push([winners[i], winners[i + 1]]);
  }
  return pairs;
}

export function playPlayoffRound(
  state: PlayoffState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
): PlayoffState {
  if (state.finished) return state;

  const name = ROUND_ORDER[state.rounds.length];
  const pairs = nextPlayoffPairings(state);

  const round: PlayoffRound = {
    name,
    series: pairs.map(([aId, bId]) =>
      simulateSeries(teams[aId], teams[bId], {
        bestOf: TOURNAMENT.playoffs.bestOf,
        stage: "playoff",
        difficulty,
      }, rng),
    ),
  };

  const rounds = [...state.rounds, round];
  const finished = name === "final";
  return {
    ...state,
    rounds,
    finished,
    championTeamId: finished ? round.series[0].winnerTeamId : null,
  };
}

export function userPlayoffSeries(state: PlayoffState | null) {
  if (!state) return [];
  return state.rounds.flatMap((round) =>
    round.series
      .filter((s) => s.teamAId === "user" || s.teamBId === "user")
      .map((s) => ({ round: round.name, series: s })),
  );
}
