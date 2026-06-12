/**
 * Playoffs (v0.2): 8 teams, DOUBLE ELIMINATION, Bo7, plus a dedicated
 * third-place series between the lower-bracket semifinal loser and the
 * lower-bracket final loser. The grand final closes the tournament
 * (single grand final — no bracket reset in the MVP).
 *
 * Round order (9 rounds, 13 series):
 *   UB QF ×4 → LB R1 ×2 → UB SF ×2 → LB R2 ×2 → UB Final ×1
 *   → LB SF ×1 → LB Final ×1 → Third Place ×1 → Grand Final ×1
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type {
  Difficulty,
  PlayoffRound,
  PlayoffRoundName,
  PlayoffState,
  SeriesResult,
  TournamentTeam,
} from "./types";

export const PLAYOFF_ROUND_ORDER: PlayoffRoundName[] = [
  "ub_quarterfinal",
  "lb_round1",
  "ub_semifinal",
  "lb_round2",
  "ub_final",
  "lb_semifinal",
  "lb_final",
  "third_place",
  "grand_final",
];

export function createPlayoffs(seeds: string[]): PlayoffState {
  if (seeds.length !== TOURNAMENT.playoffs.teams) {
    throw new Error(`Playoffs need ${TOURNAMENT.playoffs.teams} seeds, got ${seeds.length}`);
  }
  return { seeds, rounds: [], championTeamId: null, finished: false };
}

function roundByName(state: PlayoffState, name: PlayoffRoundName): SeriesResult[] {
  return state.rounds.find((r) => r.name === name)?.series ?? [];
}

function winner(series: SeriesResult): string {
  return series.winnerTeamId;
}

function loser(series: SeriesResult): string {
  return series.winnerTeamId === series.teamAId ? series.teamBId : series.teamAId;
}

/** Pairings for the next round, derived from seeds and previous results. */
export function nextPlayoffPairings(state: PlayoffState): [string, string][] {
  const name = PLAYOFF_ROUND_ORDER[state.rounds.length];
  if (!name) return [];

  const qf = roundByName(state, "ub_quarterfinal");
  const lb1 = roundByName(state, "lb_round1");
  const sf = roundByName(state, "ub_semifinal");
  const lb2 = roundByName(state, "lb_round2");
  const ubf = roundByName(state, "ub_final");
  const lbsf = roundByName(state, "lb_semifinal");
  const lbf = roundByName(state, "lb_final");

  switch (name) {
    case "ub_quarterfinal": {
      const s = state.seeds;
      // Top half: 1v8, 4v5 — bottom half: 2v7, 3v6.
      return [
        [s[0], s[7]],
        [s[3], s[4]],
        [s[1], s[6]],
        [s[2], s[5]],
      ];
    }
    case "lb_round1":
      return [
        [loser(qf[0]), loser(qf[1])],
        [loser(qf[2]), loser(qf[3])],
      ];
    case "ub_semifinal":
      return [
        [winner(qf[0]), winner(qf[1])],
        [winner(qf[2]), winner(qf[3])],
      ];
    case "lb_round2":
      // Cross-bracket to delay rematches.
      return [
        [winner(lb1[0]), loser(sf[1])],
        [winner(lb1[1]), loser(sf[0])],
      ];
    case "ub_final":
      return [[winner(sf[0]), winner(sf[1])]];
    case "lb_semifinal":
      return [[winner(lb2[0]), winner(lb2[1])]];
    case "lb_final":
      return [[winner(lbsf[0]), loser(ubf[0])]];
    case "third_place":
      return [[loser(lbsf[0]), loser(lbf[0])]];
    case "grand_final":
      return [[winner(ubf[0]), winner(lbf[0])]];
  }
}

export function playPlayoffRound(
  state: PlayoffState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
): PlayoffState {
  if (state.finished) return state;

  const name = PLAYOFF_ROUND_ORDER[state.rounds.length];
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
  const finished = name === "grand_final";
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
