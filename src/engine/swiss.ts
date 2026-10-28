/**
 * Swiss stage (base doc §24): 16 teams, Bo5, 3 wins advance / 3 losses out,
 * max 5 rounds. Pairings group teams by identical record each round.
 *
 * v2.0 rc.27 (DESIGN-DECISIONS #143): a pairing never repeats a series already
 * played in THIS Swiss. The history is derived from `rounds` (no new persisted
 * field), and each record group is paired by a complete backtracking search
 * instead of popping the shuffled group blindly. The search tries the old pop
 * order first and the RNG is consumed exactly as before (one shuffle per
 * group), so a round the old pairer already got right comes out byte-identical.
 *
 * For this format a rematch-free pairing always exists, whatever was chosen
 * before: the round-2/3 groups hold at most one past opponent per team, the
 * round-4 groups of six at most two (Dirac: the allowed graph keeps degree
 * ≥ 3), and in the round-5 2-2 group of six every team met at most three of
 * the others (its round-4 opponent left the group), which rules out every
 * Tutte obstacle. Histories that already hold a rematch (rounds saved by an
 * older build) fall back to the fewest rematches possible — never a throw,
 * never a dropped team.
 */

import { TOURNAMENT } from "@/config/balance";
import { createRng, type Rng } from "@/lib/rng";
import { simulateSeries } from "./match";
import type {
  Difficulty,
  SwissRound,
  SwissState,
  SwissTeamRecord,
  TournamentTeam,
} from "./types";

/** Order-free key of a pairing. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every pairing already played in this Swiss (derived from its rounds). */
export function swissHistory(rounds: readonly SwissRound[]): Set<string> {
  const played = new Set<string>();
  for (const round of rounds) {
    for (const s of round.series) played.add(pairKey(s.teamAId, s.teamBId));
  }
  return played;
}

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
    nextPairings: pairActiveTeams(records, new Set(), rng),
    finished: false,
  };
}

/** Search nodes per rematch allowance — only states far outside the format get near it. */
const SEARCH_NODE_BUDGET = 50_000;

/**
 * Pairs every active team with a same-record opponent it has not met yet.
 * An odd record group floats one team down to the next group (as before);
 * after the last group it sits the round out (impossible with an even field).
 * Exported for the engine tests; callers go through `createSwissState` /
 * `playSwissRound` / `upcomingSwissPairings`.
 */
export function pairActiveTeams(
  records: readonly SwissTeamRecord[],
  played: ReadonlySet<string>,
  rng: Rng,
): [string, string][] {
  const active = records.filter((r) => r.status === "active");

  // Group by record, best records first.
  const groups = new Map<string, string[]>();
  for (const record of active) {
    const key = `${record.wins}-${record.losses}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record.teamId);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw - aw || al - bl;
  });

  // One shuffle per group, in order: the old pairer's exact RNG consumption.
  // It popped pairs off the END of the shuffled group, so walking each group
  // back to front replays its order (the first pair is the last two teams).
  const sequences = orderedKeys.map((key) => rng.shuffle(groups.get(key)!).reverse());

  for (let allowance = 0; allowance <= active.length; allowance++) {
    const pairs = searchPairing(sequences, played, allowance);
    if (pairs) return pairs;
  }
  // Unreachable: with an allowance ≥ the number of pairs the first path wins.
  return searchPairing(sequences, new Set(), 0) ?? [];
}

/**
 * Depth-first search over the record groups in order, at most `allowance`
 * rematches. Partners are tried in sequence order, so the first complete
 * pairing found is the old pairer's whenever that one fits the allowance.
 */
function searchPairing(
  sequences: readonly string[][],
  played: ReadonlySet<string>,
  allowance: number,
): [string, string][] | null {
  const pairs: [string, string][] = [];
  let rematches = 0;
  let nodes = SEARCH_NODE_BUDGET;

  const solve = (gi: number, rest: readonly string[], floater: string | null): boolean => {
    if (--nodes < 0) return false;
    if (rest.length === 0) {
      const next = gi + 1;
      if (next >= sequences.length) return true; // a last floater sits out
      return solve(next, floater === null ? sequences[next] : [...sequences[next], floater], null);
    }
    // The last member of an odd group floats down (the old pairer's leftover).
    if (rest.length === 1 && floater === null) return solve(gi, [], rest[0]);

    const [a, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      const repeat = played.has(pairKey(a, others[i]));
      if (repeat && rematches >= allowance) continue;
      pairs.push([a, others[i]]);
      if (repeat) rematches += 1;
      if (solve(gi, others.filter((_, j) => j !== i), floater)) return true;
      pairs.pop();
      if (repeat) rematches -= 1;
    }
    // An odd group may float `a` instead of its last member.
    if (floater === null && rest.length % 2 === 1) return solve(gi, others, a);
    return false;
  };

  return solve(-1, [], null) ? pairs : null;
}

/** Rematches in a pairing, or -1 when it does not fit the current records. */
function pairingRematches(
  pairs: readonly [string, string][],
  records: readonly SwissTeamRecord[],
  played: ReadonlySet<string>,
): number {
  const active = new Set(records.filter((r) => r.status === "active").map((r) => r.teamId));
  const seen = new Set<string>();
  let rematches = 0;
  for (const [a, b] of pairs) {
    if (a === b || !active.has(a) || !active.has(b) || seen.has(a) || seen.has(b)) return -1;
    seen.add(a);
    seen.add(b);
    if (played.has(pairKey(a, b))) rematches += 1;
  }
  // Every active team plays (an odd field leaves at most one out).
  return active.size - seen.size <= active.size % 2 ? rematches : -1;
}

/** FNV-1a over the records and the round count — the repair's own seed. */
function repairSeed(state: SwissState): number {
  const text = `${state.rounds.length}#${state.records
    .map((r) => `${r.teamId}:${r.wins}-${r.losses}:${r.status}`)
    .join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The pairings the next round will play: the stored `nextPairings` while they
 * are a valid round with no rematch, else a deterministic repair. A run or
 * career event saved before rc.27 can hold a pre-computed round with a
 * rematch; the repair draws from its own seed (never the run's RNG cursor), so
 * the screens and the engine agree on it and replays stay identical. A stored
 * round is only replaced when the repair really plays fewer rematches.
 */
export function upcomingSwissPairings(state: SwissState): [string, string][] | null {
  if (state.finished) return null;
  const played = swissHistory(state.rounds);
  const stored = state.nextPairings ? pairingRematches(state.nextPairings, state.records, played) : -1;
  if (stored === 0) return state.nextPairings;
  const repaired = pairActiveTeams(state.records, played, createRng(repairSeed(state)));
  if (stored > 0 && pairingRematches(repaired, state.records, played) >= stored) {
    return state.nextPairings;
  }
  return repaired;
}

export function playSwissRound(
  state: SwissState,
  teams: Record<string, TournamentTeam>,
  difficulty: Difficulty,
  rng: Rng,
): SwissState {
  if (state.finished) return state;

  const records = state.records.map((r) => ({ ...r }));
  const pairs = upcomingSwissPairings(state) ?? [];
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

  const rounds = [...state.rounds, round];
  return {
    rounds,
    records,
    nextPairings: finished ? null : pairActiveTeams(records, swissHistory(rounds), rng),
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
