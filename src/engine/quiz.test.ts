import { describe, expect, it } from "vitest";
import { QUIZ } from "@/config/balance";
import { playerById } from "@/data";
import { cluesFor, normalizeGuess, quizFacts, quizForDate, quizSuggestions, resolveGuess } from "./quiz";
import { applyGuess, EMPTY_QUIZ, foldQuizDay, mergeQuiz, visibleClues } from "./quizState";

describe("quiz puzzle generation", () => {
  it("is deterministic per date and picks a player with enough history", () => {
    const a = quizForDate("2026-10-21");
    const b = quizForDate("2026-10-21");
    expect(a.playerId).toBe(b.playerId);
    expect(quizFacts().get(a.playerId)!.appearances.length).toBeGreaterThanOrEqual(QUIZ.minLineups);
    const days = new Set(Array.from({ length: 30 }, (_, i) => quizForDate(`2026-11-${String(i + 1).padStart(2, "0")}`).playerId));
    expect(days.size).toBeGreaterThan(20); // variety across a month
  });

  it("every eligible player yields at least attempts + 1 clues, broad first", () => {
    for (const facts of quizFacts().values()) {
      const clues = cluesFor(facts);
      expect(clues.length).toBeGreaterThanOrEqual(QUIZ.attempts);
      expect(clues[clues.length - 1].kind).toBe("peak");
      if (facts.player.country) expect(clues[0].kind).toBe("country");
    }
  });

  it("visibleClues grows with misses and never exceeds the ladder", () => {
    const p = quizForDate("2026-10-22");
    expect(visibleClues(p, 0)).toHaveLength(1);
    expect(visibleClues(p, 2).length).toBe(Math.min(3, p.clues.length));
    expect(visibleClues(p, 99).length).toBe(p.clues.length);
  });
});

describe("guessing", () => {
  it("normalises nicknames and resolves exact matches only", () => {
    expect(normalizeGuess("  M0nkey M00n! ")).toBe("m0nkeym00n");
    const p = quizForDate("2026-10-23");
    const nick = playerById.get(p.playerId)!.nickname;
    expect(resolveGuess(nick.toUpperCase())).toBe(p.playerId);
    expect(resolveGuess("definitely-not-a-player-xyz")).toBeNull();
    expect(quizSuggestions(nick.slice(0, 3)).some((s) => s.id === p.playerId)).toBe(true);
    expect(quizSuggestions("")).toEqual([]);
  });

  it("scores by attempt, finishes on a solve or after the last miss, then rejects more guesses", () => {
    const p = quizForDate("2026-10-24");
    const miss = applyGuess(p, undefined, null, "nope");
    expect(miss).toMatchObject({ correct: false, finished: false, xp: 0 });
    expect(miss.result).toMatchObject({ attempts: 1, solved: false, guesses: ["nope"] });
    const solve = applyGuess(p, miss.result, p.playerId, "x");
    expect(solve).toMatchObject({ correct: true, finished: true, xp: QUIZ.xpByAttempt[2] });
    expect(solve.result.score).toBe(QUIZ.attempts - 1);
    expect(applyGuess(p, solve.result, p.playerId, "x").finished).toBe(true);

    let r = applyGuess(p, undefined, null, "a").result;
    r = applyGuess(p, r, null, "b").result;
    const last = applyGuess(p, r, null, "c");
    expect(last).toMatchObject({ finished: true, correct: false, xp: 0 });
    expect(last.result.score).toBe(0);
  });

  it("first-try solve pays the maximum", () => {
    const p = quizForDate("2026-10-25");
    const o = applyGuess(p, undefined, p.playerId, "");
    expect(o.xp).toBe(QUIZ.xpByAttempt[1]);
    expect(o.result.score).toBe(QUIZ.attempts);
  });
});

describe("counters + merge", () => {
  const solved = { solved: true, attempts: 1, score: 3, guesses: ["x"] };
  const missed = { solved: false, attempts: 3, score: 0, guesses: ["a", "b", "c"] };

  it("foldQuizDay tracks solved/played and consecutive-day streaks", () => {
    let s = foldQuizDay(EMPTY_QUIZ, "2026-10-21", solved);
    s = foldQuizDay(s, "2026-10-22", solved);
    expect(s).toMatchObject({ solved: 2, played: 2, streak: 2, bestStreak: 2 });
    s = foldQuizDay(s, "2026-10-23", missed);
    expect(s).toMatchObject({ solved: 2, played: 3, streak: 0, bestStreak: 2 });
    s = foldQuizDay(s, "2026-10-25", solved); // gap → streak restarts at 1
    expect(s.streak).toBe(1);
  });

  it("prunes history beyond QUIZ.historyDays", () => {
    let s = EMPTY_QUIZ;
    for (let i = 0; i < QUIZ.historyDays + 10; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      s = foldQuizDay(s, d, solved);
    }
    expect(Object.keys(s.results)).toHaveLength(QUIZ.historyDays);
  });

  it("mergeQuiz keeps the better day result and MAX counters", () => {
    const a = { ...EMPTY_QUIZ, results: { "2026-10-21": missed }, solved: 1, played: 3, streak: 1, bestStreak: 2 };
    const b = { ...EMPTY_QUIZ, results: { "2026-10-21": solved, "2026-10-22": solved }, solved: 2, played: 2, streak: 2, bestStreak: 2 };
    const m = mergeQuiz(a, b);
    expect(m.results["2026-10-21"]).toBe(solved);
    expect(m).toMatchObject({ solved: 2, played: 3, streak: 2, bestStreak: 2 });
  });
});
