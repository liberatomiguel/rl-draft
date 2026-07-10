/**
 * Road to Worlds — event-playback view-model helpers (pure TS, no React).
 *
 * The engine simulates ahead (rounds land in the save whole); these helpers
 * slice that finished state into a reveal-ordered structure the screen can
 * animate: flattened rounds, per-goal timelines synthesized from the engine's
 * per-game scorer data, and spoiler-safe swiss records that only count what
 * has been revealed. Determinism note: nothing here rolls dice — goal order
 * is derived from the persisted scorer counts, so a replayed reveal is
 * identical every time.
 */

import type {
  GameResult,
  Placement,
  PlayoffRoundName,
  SeriesResult,
  TournamentState,
} from "@/engine/types";

// ---------------------------------------------------------------------------
// Round flattening (swiss rounds then playoff rounds, play order)
// ---------------------------------------------------------------------------

export interface RoundRef {
  /** Position in the flattened reveal order. */
  order: number;
  stage: "swiss" | "playoffs";
  /** Index within its own stage's rounds array. */
  stageIndex: number;
  /** Stable key, e.g. "sw:0" / "po:2". */
  key: string;
  /** Playoff round name (null for swiss rounds). */
  name: PlayoffRoundName | null;
  /** Swiss round number (1-based); playoff rounds count from 1 too. */
  roundNo: number;
  series: SeriesResult[];
  userSeriesIndex: number | null;
}

function userIndexIn(series: SeriesResult[]): number | null {
  const i = series.findIndex((s) => s.teamAId === "user" || s.teamBId === "user");
  return i >= 0 ? i : null;
}

export function roundsOf(t: TournamentState): RoundRef[] {
  const out: RoundRef[] = [];
  t.swiss.rounds.forEach((round, ri) => {
    out.push({
      order: out.length,
      stage: "swiss",
      stageIndex: ri,
      key: `sw:${ri}`,
      name: null,
      roundNo: round.round,
      series: round.series,
      userSeriesIndex: userIndexIn(round.series),
    });
  });
  (t.playoffs?.rounds ?? []).forEach((round, ri) => {
    out.push({
      order: out.length,
      stage: "playoffs",
      stageIndex: ri,
      key: `po:${ri}`,
      name: round.name,
      roundNo: ri + 1,
      series: round.series,
      userSeriesIndex: userIndexIn(round.series),
    });
  });
  return out;
}

export function seriesKey(round: RoundRef, seriesIndex: number): string {
  return `${round.key}:${seriesIndex}`;
}

// ---------------------------------------------------------------------------
// Goal timelines (per game, synthesized from engine scorer counts)
// ---------------------------------------------------------------------------

export interface GoalEvent {
  /** Which side scored: "a" = series.teamAId, "b" = series.teamBId. */
  side: "a" | "b";
  /** Roster index into that team's playerNames (null = unattributed). */
  playerIdx: number | null;
  /** Running score AFTER this goal, teamA first. */
  scoreAfter: [number, number];
}

/** Round-robin expansion: counts [2,1] → player order [0,1,0]. */
function scorerSequence(counts: number[]): number[] {
  const remaining = [...counts];
  const total = remaining.reduce((s, n) => s + n, 0);
  const out: number[] = [];
  while (out.length < total) {
    for (let i = 0; i < remaining.length && out.length < total; i++) {
      if (remaining[i] > 0) {
        out.push(i);
        remaining[i] -= 1;
      }
    }
  }
  return out;
}

/**
 * Deterministic goal order for one game: each side's goals are spread evenly
 * across a virtual clock ((i+1)/(n+1)) and merged — a 4-1 game reads as the
 * favorite scoring around a lone reply, never as two blocks. Scorers map to
 * roster indices via the engine's per-game scorer counts (round-robin within
 * the side); games persisted without scorer data degrade to unattributed
 * team goals.
 */
export function goalTimeline(series: SeriesResult, game: GameResult): GoalEvent[] {
  const aWon = game.winnerTeamId === series.teamAId;
  // game.score is [winnerGoals, loserGoals] — orient to teamA/teamB.
  const aTotal = aWon ? game.score[0] : game.score[1];
  const bTotal = aWon ? game.score[1] : game.score[0];

  const aSeq: (number | null)[] = game.scorers
    ? scorerSequence(game.scorers.a)
    : Array.from({ length: aTotal }, () => null);
  const bSeq: (number | null)[] = game.scorers
    ? scorerSequence(game.scorers.b)
    : Array.from({ length: bTotal }, () => null);

  const timed: { side: "a" | "b"; playerIdx: number | null; t: number }[] = [];
  aSeq.forEach((idx, i) => timed.push({ side: "a", playerIdx: idx, t: (i + 1) / (aSeq.length + 1) }));
  bSeq.forEach((idx, i) => timed.push({ side: "b", playerIdx: idx, t: (i + 1) / (bSeq.length + 1) }));
  timed.sort((x, y) => x.t - y.t || (x.side === y.side ? 0 : x.side === "a" ? -1 : 1));

  let a = 0;
  let b = 0;
  return timed.map((e) => {
    if (e.side === "a") a += 1;
    else b += 1;
    return { side: e.side, playerIdx: e.playerIdx, scoreAfter: [a, b] as [number, number] };
  });
}

/** Total goal pops in a game (both sides). */
export function goalsInGame(game: GameResult): number {
  return game.score[0] + game.score[1];
}

// ---------------------------------------------------------------------------
// Spoiler-safe reveal bookkeeping
// ---------------------------------------------------------------------------

export interface AnimSlice {
  /** roundsOf index currently animating. */
  round: number;
  /** AI series of that round already revealed (ticker order). */
  ai: number;
  /** True once the user's series banner has landed (result readable). */
  banner: boolean;
}

/**
 * The set of `seriesKey`s the viewer is allowed to see: every series of every
 * fully revealed round, plus — inside the round mid-animation — the first
 * `ai` AI series and the user series once its banner showed.
 */
export function revealedKeysFor(
  rounds: RoundRef[],
  revealedRounds: number,
  anim: AnimSlice | null,
): Set<string> {
  const keys = new Set<string>();
  rounds.forEach((round, ri) => {
    if (ri < revealedRounds) {
      round.series.forEach((_, si) => keys.add(seriesKey(round, si)));
    }
  });
  if (anim && anim.round < rounds.length) {
    const round = rounds[anim.round];
    const aiIndices = round.series
      .map((_, si) => si)
      .filter((si) => si !== round.userSeriesIndex);
    aiIndices.slice(0, anim.ai).forEach((si) => keys.add(seriesKey(round, si)));
    if (anim.banner && round.userSeriesIndex !== null) {
      keys.add(seriesKey(round, round.userSeriesIndex));
    }
  }
  return keys;
}

export interface DerivedRecord {
  wins: number;
  losses: number;
  gameDiff: number;
}

/** Swiss records counting ONLY revealed series (the board never spoils). */
export function swissRecordsFrom(
  t: TournamentState,
  revealed: Set<string>,
): Map<string, DerivedRecord> {
  const map = new Map<string, DerivedRecord>();
  for (const id of Object.keys(t.teams)) {
    map.set(id, { wins: 0, losses: 0, gameDiff: 0 });
  }
  t.swiss.rounds.forEach((round, ri) => {
    round.series.forEach((s, si) => {
      if (!revealed.has(`sw:${ri}:${si}`)) return;
      const margin = Math.abs(s.score[0] - s.score[1]);
      const loserId = s.winnerTeamId === s.teamAId ? s.teamBId : s.teamAId;
      const w = map.get(s.winnerTeamId);
      const l = map.get(loserId);
      if (w) {
        w.wins += 1;
        w.gameDiff += margin;
      }
      if (l) {
        l.losses += 1;
        l.gameDiff -= margin;
      }
    });
  });
  return map;
}

/** How many swiss rounds are COMPLETELY revealed (standings step size). */
export function revealedSwissRounds(t: TournamentState, revealed: Set<string>): number {
  let count = 0;
  for (let ri = 0; ri < t.swiss.rounds.length; ri++) {
    const whole = t.swiss.rounds[ri].series.every((_, si) => revealed.has(`sw:${ri}:${si}`));
    if (!whole) break;
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Series verdict helpers
// ---------------------------------------------------------------------------

/** A sweep never dropped a game; a reverse sweep lost the first two. */
export function seriesShape(series: SeriesResult): { sweep: boolean; reverseSweep: boolean } {
  const loserWins = Math.min(series.score[0], series.score[1]);
  const sweep = loserWins === 0 && series.games.length >= 3;
  const reverseSweep =
    series.games.length >= 4 &&
    series.games[0].winnerTeamId !== series.winnerTeamId &&
    series.games[1].winnerTeamId !== series.winnerTeamId;
  return { sweep, reverseSweep };
}

export type UserSeriesStatus = "advancing" | "eliminated" | "champion" | null;

/**
 * What the user's series result MEANS for the run (the banner status line).
 * Swiss verdicts key on the revealed record AFTER this series; playoff
 * verdicts on the round name (double elim: an upper-bracket loss only drops
 * to the lower bracket).
 */
export function userSeriesStatus(
  round: RoundRef,
  series: SeriesResult,
  ctx: {
    swissWinsAfter: number;
    swissLossesAfter: number;
    winsToAdvance: number;
    lossesToEliminate: number;
    playoffFormat: "double" | "single" | null;
  },
): UserSeriesStatus {
  const userWon = series.winnerTeamId === "user";
  if (round.stage === "swiss") {
    if (userWon && ctx.swissWinsAfter >= ctx.winsToAdvance) return "advancing";
    if (!userWon && ctx.swissLossesAfter >= ctx.lossesToEliminate) return "eliminated";
    return null;
  }
  const name = round.name;
  if (userWon) {
    if (name === "grand_final" || name === "final") return "champion";
    if (name === "third_place") return null; // run over, but on a win
    return "advancing";
  }
  if (ctx.playoffFormat === "single") return "eliminated";
  if (
    name === "lb_round1" ||
    name === "lb_round2" ||
    name === "lb_semifinal" ||
    name === "lb_final" ||
    name === "third_place" ||
    name === "grand_final"
  ) {
    return "eliminated";
  }
  return null; // upper-bracket loss → lower bracket
}

/** The series star: most game-stars on the WINNING side (ties → first named). */
export function seriesStarOf(series: SeriesResult): string | null {
  const counts = new Map<string, number>();
  for (const g of series.games) {
    if (g.winnerTeamId === series.winnerTeamId && g.starName) {
      counts.set(g.starName, (counts.get(g.starName) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Digest helpers
// ---------------------------------------------------------------------------

/**
 * The user team's goals per roster index summed across EVERY user series
 * (scorers.a/.b are teamA/teamB roster order — orientation handled here).
 * Games persisted without scorer data contribute nothing.
 */
export function userGoalCounts(t: TournamentState): number[] {
  const totals: number[] = [];
  const add = (counts: number[]): void => {
    counts.forEach((n, i) => {
      totals[i] = (totals[i] ?? 0) + n;
    });
  };
  const scan = (series: SeriesResult[]): void => {
    for (const s of series) {
      const side = s.teamAId === "user" ? "a" : s.teamBId === "user" ? "b" : null;
      if (!side) continue;
      for (const g of s.games) {
        if (g.scorers) add(g.scorers[side]);
      }
    }
  };
  t.swiss.rounds.forEach((r) => scan(r.series));
  (t.playoffs?.rounds ?? []).forEach((r) => scan(r.series));
  return totals;
}

/** Placement sort order for final-standings tables (champion first). */
export const PLACEMENT_ORDER: readonly Placement[] = [
  "champion",
  "runner_up",
  "third",
  "fourth",
  "top4",
  "top6",
  "top8",
  "swiss_exit",
];

export function placementRankOf(placement: Placement): number {
  const i = PLACEMENT_ORDER.indexOf(placement);
  return i === -1 ? PLACEMENT_ORDER.length : i;
}
