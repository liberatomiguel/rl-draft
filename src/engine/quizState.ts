/**
 * Daily Quiz — the player's side (v2.0): puzzle/result types, guesses, the
 * day fold and the cloud merge. Pure, and free of the dataset on purpose: the
 * profile store (root layout, every page) and the cloud sync use this half, so
 * it must not import `@/data` (rc.26, #60). Building the puzzle and resolving a
 * typed name need the player list; that half lives in `./quiz`.
 */

import { QUIZ } from "@/config/balance";

export type QuizClue =
  | { kind: "country"; country: string; region: string }
  | { kind: "era"; firstYear: number; lastYear: number; lineups: number }
  | { kind: "orgs"; orgIds: string[] }
  | { kind: "teammate"; playerId: string }
  | { kind: "peak"; overall: number; orgId: string; year: number };

export interface QuizPuzzle {
  date: string;
  playerId: string;
  clues: QuizClue[];
}

export interface QuizDayResult {
  solved: boolean;
  /** Attempts used (1..attempts). */
  attempts: number;
  /** 3 / 2 / 1 for a solve on the 1st / 2nd / 3rd attempt, 0 for a miss. */
  score: number;
  /** Guesses made so far (player ids or raw text), for the in-progress state. */
  guesses: string[];
}

export interface QuizState {
  results: Record<string, QuizDayResult>;
  solved: number;
  played: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_QUIZ: QuizState = { results: {}, solved: 0, played: 0, streak: 0, bestStreak: 0 };

/** How many clues are visible after `attemptsUsed` misses (at least 1). */
export function visibleClues(puzzle: QuizPuzzle, attemptsUsed: number): QuizClue[] {
  return puzzle.clues.slice(0, Math.min(puzzle.clues.length, 1 + attemptsUsed));
}

export interface GuessOutcome {
  result: QuizDayResult;
  correct: boolean;
  finished: boolean;
  xp: number;
}

/** Apply one guess to the day's result (pure). */
export function applyGuess(puzzle: QuizPuzzle, prev: QuizDayResult | undefined, guessPlayerId: string | null, rawText: string): GuessOutcome {
  const base: QuizDayResult = prev ?? { solved: false, attempts: 0, score: 0, guesses: [] };
  if (base.solved || base.attempts >= QUIZ.attempts) return { result: base, correct: false, finished: true, xp: 0 };
  const attempts = base.attempts + 1;
  const correct = guessPlayerId !== null && guessPlayerId === puzzle.playerId;
  const finished = correct || attempts >= QUIZ.attempts;
  const score = correct ? QUIZ.attempts - attempts + 1 : 0;
  const result: QuizDayResult = {
    solved: correct,
    attempts,
    score,
    guesses: [...base.guesses, guessPlayerId ?? rawText.trim()],
  };
  return { result, correct, finished, xp: correct ? QUIZ.xpByAttempt[attempts] ?? 0 : 0 };
}

/** Fold a FINISHED day into the counters (streak = consecutive solved days by date order). */
export function foldQuizDay(state: QuizState, date: string, result: QuizDayResult): QuizState {
  const results = { ...state.results, [date]: result };
  // Prune old days.
  const keys = Object.keys(results).sort();
  while (keys.length > QUIZ.historyDays) delete results[keys.shift()!];
  const prevDates = Object.keys(state.results).filter((d) => d < date).sort();
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const continues = prevDates.length > 0 && prevDates[prevDates.length - 1] === yesterday && state.results[yesterday]?.solved;
  const streak = result.solved ? (continues ? state.streak + 1 : 1) : 0;
  return {
    results,
    solved: state.solved + (result.solved ? 1 : 0),
    played: state.played + 1,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
  };
}

/** Merge two quiz states (cloud ↔ local): per-day best, MAX counters. */
export function mergeQuiz(a: QuizState, b: QuizState): QuizState {
  const results: Record<string, QuizDayResult> = { ...a.results };
  for (const [d, r] of Object.entries(b.results)) {
    const cur = results[d];
    if (!cur || r.score > cur.score || (r.score === cur.score && r.attempts > cur.attempts)) results[d] = r;
  }
  const latest = Object.keys(a.results).sort().pop() ?? "";
  const latestB = Object.keys(b.results).sort().pop() ?? "";
  return {
    results,
    solved: Math.max(a.solved, b.solved),
    played: Math.max(a.played, b.played),
    streak: latestB > latest ? b.streak : latest > latestB ? a.streak : Math.max(a.streak, b.streak),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
  };
}
