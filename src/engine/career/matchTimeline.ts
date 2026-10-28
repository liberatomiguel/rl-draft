/**
 * Road to Worlds — the Match Center goal timeline (GAME-04, R41). Pure TS.
 *
 * The engine settles a game as a winner, a WINNER-FIRST scoreline, an
 * overtime flag and per-player goal counts (match.ts). This turns that
 * settled result into the story the Match Center plays back: the order the
 * goals went in, a regulation clock time for each (a 5:00 countdown) and, for
 * overtime games, the end-of-regulation beat, the OT length and the golden
 * goal.
 *
 * Presentation only, and independent of the competitive RNG: each game rolls
 * on a LOCAL mulberry32 seeded by a hash of its persisted result (the round
 * key, both team ids, the series' games, this game's index). The run/event
 * cursor is never read, so winners, drafts and balance cannot move, and a
 * reload or a replay draws the identical timeline.
 *
 * Invariants (matchTimeline.test.ts):
 *  - totals per side and per player are exactly the engine's;
 *  - regulation W-L: a uniform interleaving of the W and L goals, so the
 *    loser can open the scoring and lead whenever L >= 1;
 *  - overtime W-(W-1): regulation ends tied (W-1)-(W-1), then the overtime
 *    beat, then the winner's golden goal at the sampled OT length;
 *  - regulation goal times are strictly ordered inside the goal window
 *    (never 5:00, never 0:00); the OT length stays inside its bounds.
 */

import { CAREER_MATCH_CLOCK as CLOCK } from "@/config/balance";
import { createRng, type Rng } from "@/lib/rng";
import type { GameResult, SeriesResult } from "@/engine/types";
import { deriveSeed } from "./seeds";

export type TimelineSide = "a" | "b";
export type ClockPeriod = "regulation" | "overtime";

export interface TimelineGoal {
  kind: "goal";
  /** "a" = series.teamAId, "b" = series.teamBId. */
  side: TimelineSide;
  /** Roster index into that side's playerNames (null = unattributed). */
  playerIdx: number | null;
  /** Running score AFTER this goal, teamA first. */
  scoreAfter: [number, number];
  period: ClockPeriod;
  /** Regulation: seconds LEFT on the 5:00 clock. Overtime: seconds PLAYED in OT. */
  clock: number;
  /** The overtime winner: the game ends on it. */
  golden: boolean;
}

export interface TimelineOvertime {
  kind: "overtime";
  /** The tied score regulation ended on, teamA first. */
  scoreAfter: [number, number];
}

export type TimelineBeat = TimelineGoal | TimelineOvertime;

export interface GameTimeline {
  /** Reveal order: regulation goals, then (OT games) the OT beat and the golden goal. */
  beats: TimelineBeat[];
  /** Final score, teamA first: the engine's scoreline, oriented. */
  final: [number, number];
  /** OT length in seconds (the golden goal's OT clock); null for regulation games. */
  overtimeSeconds: number | null;
}

/** game.score is [winnerGoals, loserGoals]; this returns [teamA goals, teamB goals]. */
export function gameScoreAB(series: SeriesResult, game: GameResult): [number, number] {
  return game.winnerTeamId === series.teamAId
    ? [game.score[0], game.score[1]]
    : [game.score[1], game.score[0]];
}

/** Fixed salt of the presentation stream (never the career seed or a cursor). */
const TIMELINE_SALT = 0x2f6b_a7c3;

/**
 * Stable seed of one game's timeline. `roundKey` is the round's position in
 * the event (eventPlayback's RoundRef.key, e.g. "sw:2" / "po:0"); together
 * with both team ids it pins the series, since a team plays once per round.
 * The whole series' persisted results go in too, so the same pairing in a
 * different event (different games) gets its own story.
 */
export function timelineSeed(roundKey: string, series: SeriesResult, game: GameResult): number {
  const games = series.games
    .map((g) => {
      const side = g.winnerTeamId === series.teamAId ? "a" : "b";
      const scorers = g.scorers ? `${g.scorers.a.join(",")}/${g.scorers.b.join(",")}` : "-";
      return `${g.index}${side}${g.score[0]}-${g.score[1]}${g.overtime ? "o" : ""}:${scorers}`;
    })
    .join(";");
  return deriveSeed(
    TIMELINE_SALT,
    `tl:${roundKey}:${series.teamAId}:${series.teamBId}:${series.ratingDiff}:${games}:g${game.index}`,
  );
}

/** One side's scorer order: the engine's per-player counts, shuffled locally. */
function scorerQueue(counts: number[] | undefined, total: number, rng: Rng): (number | null)[] {
  const expanded: number[] = [];
  (counts ?? []).forEach((n, idx) => {
    for (let k = 0; k < n; k++) expanded.push(idx);
  });
  const queue: (number | null)[] = rng.shuffle(expanded).slice(0, total);
  // Legacy saves without scorer data (or a roster-less side): unattributed goals.
  while (queue.length < total) queue.push(null);
  return queue;
}

/**
 * `n` regulation goal times as seconds LEFT, strictly descending, inside
 * [goalMinLeft, goalMaxLeft] and at least `minGoalGapSeconds` apart (the gap
 * shrinks only if `n` could not fit otherwise). Distinct while
 * n <= goalMaxLeft - goalMinLeft + 1.
 */
function regulationClock(n: number, rng: Rng): number[] {
  if (n <= 0) return [];
  const first = CLOCK.regulationSeconds - CLOCK.goalMaxLeft; // earliest elapsed second
  const last = CLOCK.regulationSeconds - CLOCK.goalMinLeft; // latest elapsed second
  const room = last - first;
  const gap = n > 1 ? Math.min(CLOCK.minGoalGapSeconds, Math.floor(room / (n - 1))) : 0;
  const span = room - gap * (n - 1);
  const picks = Array.from({ length: n }, () => rng.int(0, span)).sort((x, y) => x - y);
  return picks.map((p, i) => CLOCK.regulationSeconds - (first + p + i * gap));
}

/** OT length: a weighted bucket, then uniform (whole seconds) inside it. */
function overtimeLength(rng: Rng): number {
  const O = CLOCK.overtime;
  const bucket = rng.weightedPick(O.buckets, (b) => b.weight);
  const seconds = rng.int(bucket.fromS, bucket.toS);
  return Math.min(O.maxSeconds, Math.max(O.minSeconds, seconds));
}

/**
 * The timeline of one game of `series`. `roundKey` = the round's RoundRef.key.
 * Draw order is fixed (interleaving, scorers a then b, clock, OT length) so a
 * given input always yields the same timeline.
 */
export function buildGameTimeline(
  series: SeriesResult,
  game: GameResult,
  roundKey: string,
): GameTimeline {
  const rng = createRng(timelineSeed(roundKey, series, game));
  const winSide: TimelineSide = game.winnerTeamId === series.teamAId ? "a" : "b";
  const loseSide: TimelineSide = winSide === "a" ? "b" : "a";
  const winnerGoals = Math.max(0, game.score[0]);
  const loserGoals = Math.max(0, game.score[1]);
  // The engine's OT scoreline is always [w, w-1]; anything else plays as regulation.
  const overtime = game.overtime && winnerGoals >= 1 && loserGoals === winnerGoals - 1;
  const regulationWinner = overtime ? winnerGoals - 1 : winnerGoals;

  // 1 — who scores when: a uniform shuffle of the regulation goals' sides.
  const order = rng.shuffle<TimelineSide>([
    ...Array.from({ length: regulationWinner }, () => winSide),
    ...Array.from({ length: loserGoals }, () => loseSide),
  ]);

  // 2 — who scores each goal: the engine's counts, order shuffled per side.
  const [totalA, totalB] = gameScoreAB(series, game);
  const queues: Record<TimelineSide, (number | null)[]> = {
    a: scorerQueue(game.scorers?.a, totalA, rng),
    b: scorerQueue(game.scorers?.b, totalB, rng),
  };

  // 3 — when: regulation clock times, then the OT length.
  const times = regulationClock(order.length, rng);
  const overtimeSeconds = overtime ? overtimeLength(rng) : null;

  const beats: TimelineBeat[] = [];
  const score: [number, number] = [0, 0];
  const goal = (side: TimelineSide, period: ClockPeriod, clock: number, golden: boolean) => {
    score[side === "a" ? 0 : 1] += 1;
    beats.push({
      kind: "goal",
      side,
      playerIdx: queues[side].shift() ?? null,
      scoreAfter: [score[0], score[1]],
      period,
      clock,
      golden,
    });
  };
  order.forEach((side, i) => goal(side, "regulation", times[i], false));
  if (overtimeSeconds !== null) {
    beats.push({ kind: "overtime", scoreAfter: [score[0], score[1]] });
    goal(winSide, "overtime", overtimeSeconds, true);
  }
  return { beats, final: [score[0], score[1]], overtimeSeconds };
}
