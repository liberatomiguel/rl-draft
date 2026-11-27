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
import { simulateSeries, type UserSeriesResolver } from "./match";
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

/** Quick mode: straight single elimination. */
export const SINGLE_ELIM_ROUND_ORDER: PlayoffRoundName[] = [
  "quarterfinal",
  "semifinal",
  "final",
];

/**
 * v2.2 event formats (career-only brackets; seeds in SLOT order, arranged by
 * eventLayouts.bracketSlotsFor). Round order is play order: one round per
 * playNextRound.
 */
export const LAYOUT_ROUND_ORDER: Record<LayoutFormat, PlayoffRoundName[]> = {
  single8: ["quarterfinal", "semifinal", "grand_final"],
  hybrid8: ["upper_round", "lower_round1", "quarterfinal", "semifinal", "grand_final"],
  hybrid12: ["upper_round", "lower_round1", "lower_round2", "quarterfinal", "semifinal", "grand_final"],
  single12: ["ko_round1", "quarterfinal", "semifinal", "grand_final"],
  double16: [
    "ub_round1",
    "lb_round1",
    "ub_quarterfinal",
    "lb_round2",
    "ub_semifinal",
    "lb_round3",
    "lb_round4",
    "ub_final",
    "lb_semifinal",
    "lb_final",
    "grand_final",
  ],
};

type LayoutFormat = Exclude<PlayoffState["format"], "double" | "single">;

/** Teams each career-only bracket takes. */
const LAYOUT_TEAMS: Record<LayoutFormat, number> = {
  single8: 8,
  hybrid8: 8,
  hybrid12: 12,
  single12: 12,
  double16: 16,
};

function isLayoutFormat(format: PlayoffState["format"]): format is LayoutFormat {
  // A positive check: a playoff state with no `format` (older saves, partial states) is the
  // classic double elimination, as before the event formats (rc.8 integration fix).
  return typeof format === "string" && Object.prototype.hasOwnProperty.call(LAYOUT_ROUND_ORDER, format);
}

/**
 * v2.2 event formats: the 16-team double elimination plays its first four
 * rounds on Saturday (down to eight sides) — the round index its Sunday
 * starts at. 0 for every other bracket (the stage is the Saturday).
 */
export function sundayStartRoundOf(format: PlayoffState["format"]): number {
  return format === "double16" ? 4 : 0;
}

export function roundOrderFor(format: PlayoffState["format"]): PlayoffRoundName[] {
  if (isLayoutFormat(format)) return LAYOUT_ROUND_ORDER[format];
  return format === "single" ? SINGLE_ELIM_ROUND_ORDER : PLAYOFF_ROUND_ORDER;
}

export function createPlayoffs(
  seeds: string[],
  format: PlayoffState["format"] = "double",
): PlayoffState {
  const size = isLayoutFormat(format) ? LAYOUT_TEAMS[format] : TOURNAMENT.playoffs.teams;
  if (seeds.length !== size) {
    throw new Error(`Playoffs need ${size} seeds, got ${seeds.length}`);
  }
  return { format, seeds, rounds: [], championTeamId: null, finished: false };
}

/**
 * v2.2 event formats: the rounds that open a career-only bracket's Sunday,
 * whose pairings depend only on the seeds (and, for the 16-team double
 * elimination, on Saturday's results): the screens' preview and "your
 * opener". [] for the classic brackets.
 */
export function sundayOpeningRoundsOf(format: PlayoffState["format"]): PlayoffRoundName[] {
  switch (format) {
    case "hybrid8":
    case "hybrid12":
      return ["upper_round", "lower_round1"];
    case "single12":
      return ["ko_round1"];
    case "single8":
      return ["quarterfinal"];
    case "double16":
      return ["ub_semifinal", "lb_round3"];
    default:
      return [];
  }
}

/** v2.2 event formats: one round's pairings of a career-only bracket, once the rounds it reads are played. */
export function pairingsForRound(state: PlayoffState, name: PlayoffRoundName): [string, string][] {
  return isLayoutFormat(state.format) ? layoutPairings(state, name) : [];
}

/** v2.2 event formats: next pairings of a career-only bracket (slot-order seeds). */
function layoutPairings(state: PlayoffState, name: PlayoffRoundName): [string, string][] {
  const s = state.seeds;
  const r = (n: PlayoffRoundName) => roundByName(state, n);
  const W = (n: PlayoffRoundName, i: number) => winner(r(n)[i]);
  const L = (n: PlayoffRoundName, i: number) => loser(r(n)[i]);
  const slotPairs = (from: number, count: number): [string, string][] =>
    Array.from({ length: count }, (_, k) => [s[from + 2 * k], s[from + 2 * k + 1]]);

  switch (state.format) {
    case "single8":
      if (name === "quarterfinal") return slotPairs(0, 4);
      if (name === "semifinal") return [[W("quarterfinal", 0), W("quarterfinal", 1)], [W("quarterfinal", 2), W("quarterfinal", 3)]];
      return [[W("semifinal", 0), W("semifinal", 1)]];
    case "hybrid8":
    case "hybrid12": {
      const lowerIn = state.format === "hybrid8" ? "lower_round1" : "lower_round2";
      if (name === "upper_round") return slotPairs(0, 2);
      if (name === "lower_round1") return slotPairs(4, state.format === "hybrid8" ? 2 : 4);
      if (name === "lower_round2") return [[W("lower_round1", 0), W("lower_round1", 1)], [W("lower_round1", 2), W("lower_round1", 3)]];
      if (name === "quarterfinal") return [[L("upper_round", 0), W(lowerIn, 1)], [L("upper_round", 1), W(lowerIn, 0)]];
      if (name === "semifinal") return [[W("upper_round", 0), W("quarterfinal", 1)], [W("upper_round", 1), W("quarterfinal", 0)]];
      return [[W("semifinal", 0), W("semifinal", 1)]];
    }
    case "single12":
      if (name === "ko_round1") return slotPairs(4, 4);
      if (name === "quarterfinal") return [0, 1, 2, 3].map((k) => [s[k], W("ko_round1", k)] as [string, string]);
      if (name === "semifinal") return [[W("quarterfinal", 0), W("quarterfinal", 3)], [W("quarterfinal", 1), W("quarterfinal", 2)]];
      return [[W("semifinal", 0), W("semifinal", 1)]];
    case "double16":
      switch (name) {
        case "ub_round1":
          return slotPairs(0, 8);
        case "lb_round1":
          return [0, 1, 2, 3].map((k) => [L("ub_round1", 2 * k), L("ub_round1", 2 * k + 1)] as [string, string]);
        case "ub_quarterfinal":
          return [0, 1, 2, 3].map((k) => [W("ub_round1", 2 * k), W("ub_round1", 2 * k + 1)] as [string, string]);
        case "lb_round2":
          // Cross-bracket: the lower half meets the upper half's drops.
          return [0, 1, 2, 3].map((k) => [W("lb_round1", k), L("ub_quarterfinal", 3 - k)] as [string, string]);
        case "ub_semifinal":
          return [[W("ub_quarterfinal", 0), W("ub_quarterfinal", 1)], [W("ub_quarterfinal", 2), W("ub_quarterfinal", 3)]];
        case "lb_round3":
          return [[W("lb_round2", 0), W("lb_round2", 1)], [W("lb_round2", 2), W("lb_round2", 3)]];
        case "lb_round4":
          return [[W("lb_round3", 0), L("ub_semifinal", 1)], [W("lb_round3", 1), L("ub_semifinal", 0)]];
        case "ub_final":
          return [[W("ub_semifinal", 0), W("ub_semifinal", 1)]];
        case "lb_semifinal":
          return [[W("lb_round4", 0), W("lb_round4", 1)]];
        case "lb_final":
          return [[W("lb_semifinal", 0), L("ub_final", 0)]];
        default:
          return [[W("ub_final", 0), W("lb_final", 0)]];
      }
    default:
      return [];
  }
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
  const name = roundOrderFor(state.format)[state.rounds.length];
  if (!name) return [];

  if (isLayoutFormat(state.format)) return layoutPairings(state, name);

  // Single elimination (quick mode).
  if (state.format === "single") {
    if (name === "quarterfinal") {
      const s = state.seeds;
      return [
        [s[0], s[7]],
        [s[3], s[4]],
        [s[1], s[6]],
        [s[2], s[5]],
      ];
    }
    const prev = state.rounds[state.rounds.length - 1].series;
    const pairs: [string, string][] = [];
    for (let i = 0; i < prev.length; i += 2) {
      pairs.push([winner(prev[i]), winner(prev[i + 1])]);
    }
    return pairs;
  }

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
    default:
      return [];
  }
}

export function playPlayoffRound(
  state: PlayoffState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
  userSeries?: UserSeriesResolver,
): PlayoffState {
  if (state.finished) return state;

  const name = roundOrderFor(state.format)[state.rounds.length];
  const pairs = nextPlayoffPairings(state);
  const bestOf =
    state.format === "single" ? TOURNAMENT.quick.bestOf : TOURNAMENT.playoffs.bestOf;

  const round: PlayoffRound = {
    name,
    series: pairs.map(([aId, bId]) => {
      const options = { bestOf, stage: "playoff" as const, difficulty };
      return userSeries && (teams[aId].isUser || teams[bId].isUser)
        ? userSeries(teams[aId], teams[bId], options)
        : simulateSeries(teams[aId], teams[bId], options, rng);
    }),
  };

  const rounds = [...state.rounds, round];
  const finished = name === "grand_final" || name === "final";
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
