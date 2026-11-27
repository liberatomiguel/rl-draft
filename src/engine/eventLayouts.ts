/**
 * v2.2 event formats (docs/handoff-2.2/FORMATS-SPEC.md): the Saturday group
 * stages and the career-only brackets of the Road to Worlds Majors / Worlds.
 *
 * Stages (Saturday) live in a SwissState with `kind` set, so every screen and
 * flow that reads `stage === "swiss"`, `swiss.records` and `swiss.rounds`
 * keeps working:
 * - "groups4": four round-robin groups of four (3 rounds, Bo5); the table is
 *   wins → game diff → head-to-head → rating.
 * - "gsl8": two double-elimination groups of eight; 2 wins in, 2 losses out
 *   (3 rounds; two 2-0 and two 2-1 advance per group).
 *
 * Brackets (Sunday) keep their seeds in SLOT order: the stage's results are
 * arranged here (`bracketSlotsFor`) so the pairing rules in playoffs.ts are
 * fixed index pairs. Pure and deterministic; draws only the group draw.
 *
 * Nothing here is reachable from the Draft: it runs only for a state with a
 * `layout` (initFieldTournament with a layout).
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { simulateSeries, type UserSeriesResolver } from "./match";
import { seedsFromSwiss } from "./swiss";
import type {
  Difficulty,
  EventBracketKind,
  EventLayout,
  GroupStageKind,
  Placement,
  PlayoffRoundName,
  PlayoffState,
  SwissRound,
  SwissState,
  SwissTeamRecord,
  TournamentState,
  TournamentTeam,
} from "./types";

type PlayoffFormat = PlayoffState["format"];

/** The PlayoffState format a bracket kind plays as. */
export function playoffFormatOf(bracket: EventBracketKind): PlayoffFormat {
  return bracket === "double8" ? "double" : bracket;
}

/** How many teams a bracket takes. */
export function bracketSize(bracket: EventBracketKind): number {
  if (bracket === "hybrid12" || bracket === "single12") return 12;
  if (bracket === "double16") return 16;
  return 8;
}

/** Teams a group stage sends on, per group, for a bracket. */
export function advancePerGroup(stage: GroupStageKind, bracket: EventBracketKind): number {
  if (stage === "gsl8") return 4;
  return bracketSize(bracket) / 4;
}

// ---------------------------------------------------------------------------
// The group draw
// ---------------------------------------------------------------------------

/**
 * Pots by rating (pot 1 = the best `groupCount` teams), each pot shuffled and
 * dealt one per group, a team going to the first open group without a side
 * of its region when there is one. Members stay in pot order.
 */
export function drawGroups(
  teamIds: readonly string[],
  teams: Record<string, TournamentTeam>,
  groupCount: number,
  rng: Rng,
): string[][] {
  const ranked = [...teamIds].sort(
    (a, b) => teams[b].rating.total - teams[a].rating.total || a.localeCompare(b),
  );
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (let p = 0; p < ranked.length; p += groupCount) {
    const pot = rng.shuffle(ranked.slice(p, p + groupCount));
    const open = new Set(groups.map((_, i) => i));
    for (const id of pot) {
      const order = [...open];
      const clean = order.find((g) => !groups[g].some((m) => teams[m].region === teams[id].region));
      const g = clean ?? order[0];
      groups[g].push(id);
      open.delete(g);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Group-stage pairings
// ---------------------------------------------------------------------------

/** Round-robin of four (pot order a b c d): top seeds meet last. */
const ROUND_ROBIN_4: [number, number][][] = [
  [[0, 3], [1, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 3]],
];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function playedPairs(rounds: readonly SwissRound[]): Set<string> {
  const played = new Set<string>();
  for (const r of rounds) for (const s of r.series) played.add(pairKey(s.teamAId, s.teamBId));
  return played;
}

/** First-vs-last pairing of a record bucket that avoids a rematch when one exists. */
function pairBucket(bucket: readonly string[], played: ReadonlySet<string>): [string, string][] {
  const solve = (rest: readonly string[], allowRematch: boolean): [string, string][] | null => {
    if (rest.length < 2) return [];
    const [head, ...others] = rest;
    for (let i = others.length - 1; i >= 0; i--) {
      if (!allowRematch && played.has(pairKey(head, others[i]))) continue;
      const tail = solve(others.filter((_, j) => j !== i), allowRematch);
      if (tail) return [[head, others[i]], ...tail];
    }
    return null;
  };
  return solve(bucket, false) ?? solve(bucket, true) ?? [];
}

function recordOf(records: readonly SwissTeamRecord[], id: string): SwissTeamRecord {
  return records.find((r) => r.teamId === id)!;
}

/** The pairings of a group stage's next round (null once it is finished). */
export function groupStagePairings(state: Pick<SwissState, "kind" | "groups" | "rounds" | "records" | "finished">): [string, string][] | null {
  if (state.finished || !state.groups) return null;
  const round = state.rounds.length;
  if (state.kind === "groups4") {
    const schedule = ROUND_ROBIN_4[round];
    if (!schedule) return null;
    return state.groups.flatMap((g) => schedule.map(([i, j]) => [g[i], g[j]] as [string, string]));
  }
  // gsl8: within each group, same-record buckets of the teams still active.
  const played = playedPairs(state.rounds);
  const pairs: [string, string][] = [];
  for (const group of state.groups) {
    const active = group.filter((id) => recordOf(state.records, id).status === "active");
    const buckets = new Map<string, string[]>();
    for (const id of active) {
      const r = recordOf(state.records, id);
      const key = `${r.wins}-${r.losses}`;
      buckets.set(key, [...(buckets.get(key) ?? []), id]);
    }
    const keys = [...buckets.keys()].sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]));
    for (const key of keys) pairs.push(...pairBucket(buckets.get(key)!, played));
  }
  return pairs;
}

/** A fresh group stage over the field (draws the groups). */
export function createGroupStage(
  kind: GroupStageKind,
  teamIds: readonly string[],
  teams: Record<string, TournamentTeam>,
  rng: Rng,
): SwissState {
  const groupCount = kind === "groups4" ? 4 : 2;
  const groups = drawGroups(teamIds, teams, groupCount, rng);
  const records: SwissTeamRecord[] = groups.flat().map((teamId) => ({
    teamId,
    wins: 0,
    losses: 0,
    gameDiff: 0,
    status: "active",
  }));
  const state: SwissState = { rounds: [], records, nextPairings: null, finished: false, kind, groups };
  return { ...state, nextPairings: groupStagePairings(state) };
}

/**
 * A group's table, best first: wins → game diff → head-to-head (between two
 * tied sides) → rating → id. For "gsl8" fewer losses rank first.
 */
export function groupTable(
  state: Pick<SwissState, "kind" | "rounds" | "records">,
  group: readonly string[],
  teams: Record<string, TournamentTeam>,
): string[] {
  const h2h = (a: string, b: string): number => {
    for (const r of state.rounds) {
      for (const s of r.series) {
        if ((s.teamAId === a && s.teamBId === b) || (s.teamAId === b && s.teamBId === a)) {
          return s.winnerTeamId === a ? -1 : 1;
        }
      }
    }
    return 0;
  };
  return [...group].sort((a, b) => {
    const ra = recordOf(state.records, a);
    const rb = recordOf(state.records, b);
    return (
      rb.wins - ra.wins ||
      ra.losses - rb.losses ||
      rb.gameDiff - ra.gameDiff ||
      h2h(a, b) ||
      (teams[b]?.rating.total ?? 0) - (teams[a]?.rating.total ?? 0) ||
      a.localeCompare(b)
    );
  });
}

/** Play one group-stage round (mirrors playSwissRound: one series per pair). */
export function playGroupRound(
  state: SwissState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
  advance: number,
  userSeries?: UserSeriesResolver,
): SwissState {
  if (state.finished || !state.kind) return state;
  const records = state.records.map((r) => ({ ...r }));
  const pairs = groupStagePairings(state) ?? [];
  const round: SwissRound = { round: state.rounds.length + 1, series: [], userSeriesIndex: null };

  for (const [aId, bId] of pairs) {
    const options = { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss" as const, difficulty };
    const result =
      userSeries && (teams[aId].isUser || teams[bId].isUser)
        ? userSeries(teams[aId], teams[bId], options)
        : simulateSeries(teams[aId], teams[bId], options, rng);
    round.series.push(result);
    if (teams[aId].isUser || teams[bId].isUser) round.userSeriesIndex = round.series.length - 1;
    const winner = recordOf(records, result.winnerTeamId);
    const loser = recordOf(records, result.winnerTeamId === aId ? bId : aId);
    const margin = Math.abs(result.score[0] - result.score[1]);
    winner.wins += 1;
    winner.gameDiff += margin;
    loser.losses += 1;
    loser.gameDiff -= margin;
    if (state.kind === "gsl8") {
      if (winner.wins >= 2) winner.status = "advanced";
      if (loser.losses >= 2) loser.status = "eliminated";
    }
  }

  const rounds = [...state.rounds, round];
  let finished: boolean;
  if (state.kind === "groups4") {
    finished = rounds.length >= ROUND_ROBIN_4.length;
    if (finished) {
      for (const group of state.groups ?? []) {
        groupTable({ kind: state.kind, rounds, records }, group, teams).forEach((id, place) => {
          recordOf(records, id).status = place < advance ? "advanced" : "eliminated";
        });
      }
    }
  } else {
    finished = records.every((r) => r.status !== "active") || rounds.length >= 3;
  }
  const next: SwissState = { ...state, rounds, records, finished, nextPairings: null };
  return { ...next, nextPairings: finished ? null : groupStagePairings(next) };
}

// ---------------------------------------------------------------------------
// Bracket slots
// ---------------------------------------------------------------------------

/** The 16-team bracket's first round: 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15. */
const DOUBLE16_SLOTS = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];

/** Slots of a 16-team bracket that starts at once: the field by rating. */
export function double16Slots(teamIds: readonly string[], teams: Record<string, TournamentTeam>): string[] {
  const ranked = [...teamIds].sort(
    (a, b) => teams[b].rating.total - teams[a].rating.total || a.localeCompare(b),
  );
  return DOUBLE16_SLOTS.map((seed) => ranked[seed - 1]);
}

function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1)) {
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n - 1, ...rest.slice(i)]);
  }
  return out;
}

/** Index permutations in preference order (closest to `preferred` first, lexicographic). */
function rankedPerms(preferred: readonly number[]): number[][] {
  const n = preferred.length;
  const cost = (p: number[]) => p.reduce((sum, v, i) => sum + Math.abs(v - preferred[i]), 0);
  return permutations(n).sort((a, b) => cost(a) - cost(b) || a.join().localeCompare(b.join()));
}

/**
 * The second-placed side of each group against a third-placed side of ANOTHER
 * group: best second against the weakest third it may meet. Pairs come back
 * in the order of the seconds (best first).
 */
function crossPairs(
  seconds: readonly string[],
  thirds: readonly string[],
  groupOf: (id: string) => number,
): [string, string][] {
  const n = seconds.length;
  const preferred = seconds.map((_, i) => n - 1 - i);
  const perm =
    rankedPerms(preferred).find((p) => p.every((t, i) => groupOf(thirds[t]) !== groupOf(seconds[i]))) ?? preferred;
  return seconds.map((s, i) => [s, thirds[perm[i]]]);
}

/**
 * The bracket's slots from a finished stage (see playoffs.ts for each
 * bracket's slot pairings). Swiss: `seedsFromSwiss` order. Groups: by place,
 * each place ordered by record. Same-group first meetings are avoided.
 */
export function bracketSlotsFor(state: TournamentState, layout: EventLayout): string[] {
  const { teams, swiss } = state;
  const bracket = layout.bracket;

  if (layout.stage === "swiss" || !swiss.kind || !swiss.groups) {
    const s = seedsFromSwiss(swiss, teams);
    if (bracket === "single8") return [s[0], s[7], s[3], s[4], s[1], s[6], s[2], s[5]];
    if (bracket === "hybrid8") return [s[0], s[3], s[1], s[2], s[4], s[7], s[5], s[6]];
    return s; // double8 (classic seeding)
  }

  const groups = swiss.groups;
  const tables = groups.map((g) => groupTable(swiss, g, teams));
  const groupOf = (id: string) => groups.findIndex((g) => g.includes(id));
  const byRecord = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = recordOf(swiss.records, a);
      const rb = recordOf(swiss.records, b);
      return (
        rb.wins - ra.wins ||
        ra.losses - rb.losses ||
        rb.gameDiff - ra.gameDiff ||
        teams[b].rating.total - teams[a].rating.total ||
        a.localeCompare(b)
      );
    });
  const place = (k: number) => byRecord(tables.map((t) => t[k]));

  if (swiss.kind === "gsl8") {
    // Group A / B: the two 2-0 sides (A1, A2), then the two 2-1 sides (A3, A4).
    const [A, B] = tables.map((t) => {
      const advanced = t.filter((id) => recordOf(swiss.records, id).status === "advanced");
      return byRecord(advanced);
    });
    if (bracket === "hybrid8") return [A[0], B[1], B[0], A[1], A[2], B[3], B[2], A[3]];
    // single8: QF A1-B4, B2-A3 | B1-A4, A2-B3.
    return [A[0], B[3], B[1], A[2], B[0], A[3], A[1], B[2]];
  }

  // groups4
  const firsts = place(0);
  const top = [firsts[0], firsts[3], firsts[1], firsts[2]];
  if (bracket === "hybrid8") {
    const seconds = place(1);
    return [...top, seconds[0], seconds[3], seconds[1], seconds[2]];
  }
  const pairs = crossPairs(place(1), place(2), groupOf);
  if (bracket === "hybrid12") {
    // Lower R1 in the order S1, S4, S2, S3 → lower R2: S1 side v S4 side, S2 side v S3 side.
    const lower = [pairs[0], pairs[3], pairs[1], pairs[2]];
    return [...top, ...lower.flat()];
  }
  // single12: group winner k meets the winner of R1 pair k (never its own group).
  const perm =
    rankedPerms([3, 2, 1, 0]).find((p) =>
      p.every((pi, k) => !pairs[pi].some((id) => groupOf(id) === groupOf(firsts[k]))),
    ) ?? [3, 2, 1, 0];
  return [...firsts, ...perm.flatMap((pi) => pairs[pi])];
}

// ---------------------------------------------------------------------------
// Bracket rules shared by the engine and the results
// ---------------------------------------------------------------------------

/** A loss in this round ends the run (career-only brackets). */
export function lossEliminates(format: PlayoffFormat, round: PlayoffRoundName): boolean {
  if (format === "single8" || format === "single12") return true;
  if (format === "hybrid8" || format === "hybrid12") return round !== "upper_round";
  if (format === "double16") return !round.startsWith("ub_");
  return false;
}

/** Where a loss in each round finishes a team (career-only brackets). */
const LOSS_PLACEMENT: Partial<Record<PlayoffFormat, Partial<Record<PlayoffRoundName, Placement>>>> = {
  single8: { quarterfinal: "top8", semifinal: "top4", grand_final: "runner_up" },
  hybrid8: { lower_round1: "top8", quarterfinal: "top6", semifinal: "top4", grand_final: "runner_up" },
  hybrid12: {
    lower_round1: "top12",
    lower_round2: "top8",
    quarterfinal: "top6",
    semifinal: "top4",
    grand_final: "runner_up",
  },
  single12: { ko_round1: "top12", quarterfinal: "top8", semifinal: "top4", grand_final: "runner_up" },
  double16: {
    lb_round1: "swiss_exit",
    lb_round2: "top12",
    lb_round3: "top8",
    lb_round4: "top6",
    lb_semifinal: "fourth",
    lb_final: "third",
    grand_final: "runner_up",
  },
};

/** True for the brackets this module owns. */
export function isLayoutBracket(format: PlayoffFormat | undefined | null): boolean {
  return format !== undefined && format !== null && format !== "double" && format !== "single";
}

/**
 * Placement of any team in a career-only bracket: the round of its last
 * loss, "swiss_exit" when it never reached the bracket (13th–16th of a
 * 16-team double elimination too).
 */
export function layoutPlacementOf(state: TournamentState, teamId: string): Placement {
  const p = state.playoffs!;
  if (p.championTeamId === teamId) return "champion";
  let last: { round: PlayoffRoundName; won: boolean } | null = null;
  for (const round of p.rounds) {
    for (const s of round.series) {
      if (s.teamAId === teamId || s.teamBId === teamId) last = { round: round.name, won: s.winnerTeamId === teamId };
    }
  }
  if (!last) return "swiss_exit";
  const table = LOSS_PLACEMENT[p.format] ?? {};
  if (!last.won && lossEliminates(p.format, last.round)) return table[last.round] ?? "swiss_exit";
  // Still alive (an unfinished bracket): the best place it is sure of next.
  const order: Placement[] = ["swiss_exit", "top12", "top8", "top6", "fourth", "top4", "third", "runner_up"];
  const reachable = Object.values(table) as Placement[];
  return order.find((pl) => reachable.includes(pl) && pl !== "swiss_exit") ?? "top8";
}

/** How many teams finish on each placement in a 16-team event of this bracket. */
export const LAYOUT_PLACEMENTS: Record<Exclude<EventBracketKind, "double8">, [Placement, number][]> = {
  single8: [["champion", 1], ["runner_up", 1], ["top4", 2], ["top8", 4], ["swiss_exit", 8]],
  hybrid8: [["champion", 1], ["runner_up", 1], ["top4", 2], ["top6", 2], ["top8", 2], ["swiss_exit", 8]],
  hybrid12: [
    ["champion", 1], ["runner_up", 1], ["top4", 2], ["top6", 2], ["top8", 2], ["top12", 4], ["swiss_exit", 4],
  ],
  single12: [["champion", 1], ["runner_up", 1], ["top4", 2], ["top8", 4], ["top12", 4], ["swiss_exit", 4]],
  double16: [
    ["champion", 1], ["runner_up", 1], ["third", 1], ["fourth", 1], ["top6", 2], ["top8", 2], ["top12", 4],
    ["swiss_exit", 4],
  ],
};

// ---------------------------------------------------------------------------
// What the screens read
// ---------------------------------------------------------------------------

/** Where a side enters Sunday: the hybrids' upper / lower bracket, the 12-team knockout's bye / first round. */
export type SundaySide = "upper" | "lower" | "bye" | "round1";

/**
 * The sides that play Sunday, in standing order (upper / bye first, then by
 * stage record), with the side each enters on. For a 16-team double
 * elimination it is the eight left after Saturday (upper semifinalists,
 * then lower-round-2 winners). Null side for brackets without one. [] before
 * the bracket is drawn.
 */
export function sundayEntrantsOf(state: TournamentState): { id: string; side: SundaySide | null }[] {
  const p = state.playoffs;
  if (!p || !state.layout) return [];
  const rec = (id: string) => state.swiss.records.find((r) => r.teamId === id);
  const byRecord = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = rec(a);
      const rb = rec(b);
      return (
        (rb?.wins ?? 0) - (ra?.wins ?? 0) ||
        (ra?.losses ?? 0) - (rb?.losses ?? 0) ||
        (rb?.gameDiff ?? 0) - (ra?.gameDiff ?? 0) ||
        (state.teams[b]?.rating.total ?? 0) - (state.teams[a]?.rating.total ?? 0) ||
        a.localeCompare(b)
      );
    });
  const tag = (ids: string[], side: SundaySide | null) => byRecord(ids).map((id) => ({ id, side }));
  const s = p.seeds;
  switch (p.format) {
    case "hybrid8":
      return [...tag(s.slice(0, 4), "upper"), ...tag(s.slice(4), "lower")];
    case "hybrid12":
      return [...tag(s.slice(0, 4), "upper"), ...tag(s.slice(4), "lower")];
    case "single12":
      return [...tag(s.slice(0, 4), "bye"), ...tag(s.slice(4), "round1")];
    case "double16": {
      const won = (name: PlayoffRoundName) =>
        p.rounds.find((r) => r.name === name)?.series.map((x) => x.winnerTeamId) ?? [];
      const upper = won("ub_quarterfinal");
      const lower = won("lb_round2");
      if (!upper.length) return [];
      const order = (ids: string[]) => [...ids].sort((a, b) => s.indexOf(a) - s.indexOf(b));
      return [
        ...order(upper).map((id) => ({ id, side: "upper" as const })),
        ...order(lower).map((id) => ({ id, side: "lower" as const })),
      ];
    }
    default:
      return tag(s, null);
  }
}

/**
 * How a stage decides who goes on, for the live screens: a win / loss count
 * (Swiss 3/3, double-elimination groups 2/2), or the group table once the
 * stage is over ("table": groups of four).
 */
export function stageRuleOf(swiss: Pick<SwissState, "kind">): { wins: number; losses: number } | "table" {
  if (swiss.kind === "groups4") return "table";
  if (swiss.kind === "gsl8") return { wins: 2, losses: 2 };
  return { wins: TOURNAMENT.swiss.winsToAdvance, losses: TOURNAMENT.swiss.lossesToEliminate };
}

/** The finishing ranks each placement of a bracket covers ("3–4", "9–12", "13–16"). */
export function placementRanksOf(bracket: EventBracketKind): Partial<Record<Placement, string>> {
  if (bracket === "double8") return {};
  const out: Partial<Record<Placement, string>> = {};
  let rank = 1;
  for (const [placement, count] of LAYOUT_PLACEMENTS[bracket]) {
    out[placement] = count === 1 ? String(rank) : `${rank}–${rank + count - 1}`;
    rank += count;
  }
  return out;
}

/**
 * FORMATS-SPEC §4 (an event pays the same total): the value of each
 * placement of a bracket = the mean, over the 16-team finishing ranks it
 * covers, of the classic event's value per rank. `classic` gives the classic
 * values (champion, runner_up, third, fourth, top6, top8, swiss_exit); where
 * a bracket separates 9th–12th from 13th–16th, the first get (1 + lift) and
 * the second (1 − lift) of the classic 9th–16th value, so the total holds.
 */
export function layoutPlacementValues(
  bracket: Exclude<EventBracketKind, "double8">,
  classic: Record<"champion" | "runner_up" | "third" | "fourth" | "top6" | "top8" | "swiss_exit", number>,
  lift: number,
): Partial<Record<Placement, number>> {
  const rows = LAYOUT_PLACEMENTS[bracket];
  const splits = rows.some(([p]) => p === "top12");
  const perRank = [
    classic.champion,
    classic.runner_up,
    classic.third,
    classic.fourth,
    classic.top6,
    classic.top6,
    classic.top8,
    classic.top8,
    ...Array.from({ length: 4 }, () => classic.swiss_exit * (splits ? 1 + lift : 1)),
    ...Array.from({ length: 4 }, () => classic.swiss_exit * (splits ? 1 - lift : 1)),
  ];
  const out: Partial<Record<Placement, number>> = {};
  let rank = 0;
  for (const [placement, count] of rows) {
    const slice = perRank.slice(rank, rank + count);
    out[placement] = slice.reduce((a, b) => a + b, 0) / count;
    rank += count;
  }
  return out;
}
