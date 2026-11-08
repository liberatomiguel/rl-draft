import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUIZ } from "@/config/balance";
import { quizForDate, quizFacts, cluesFor } from "@/engine/quiz";
import { visibleClues, mergeQuiz } from "@/engine/quizState";
import { todayKey } from "@/lib/dailyPlan";
import { coachById, playerCardById, subById } from "@/data";
import { finalOverall } from "@/engine/cards";
import { slotsForKind } from "@/engine/draft";
import type { DraftOfferCard, RunHistoryEntry, RunResults } from "@/engine/types";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";

const originalMission = useProfileStore.getState().applyMissionEvent;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-07T23:59:50Z"));
  useProfileStore.getState().resetAll(); useRunStore.setState({ run: null });
});
afterEach(() => { useProfileStore.setState({ applyMissionEvent: originalMission }); vi.useRealTimers(); });

describe("CH-03: Daily Quiz", () => {
  for (const attempt of [1, 2, 3]) it(`solves on attempt ${attempt}, survives reload and pays once`, () => {
    const mission = vi.fn(originalMission);
    useProfileStore.setState({ applyMissionEvent: mission });
    const puzzle = quizForDate(todayKey());
    for (let i = 1; i < attempt; i++) {
      useProfileStore.getState().guessQuiz(puzzle, null, `miss-${i}`);
      useProfileStore.setState({ quiz: JSON.parse(JSON.stringify(useProfileStore.getState().quiz)) });
    }
    expect(visibleClues(puzzle, attempt - 1).length).toBeGreaterThanOrEqual(2);
    const before = useProfileStore.getState().xp;
    expect(useProfileStore.getState().guessQuiz(puzzle, puzzle.playerId, "answer")).toMatchObject({ correct: true, xp: QUIZ.xpByAttempt[attempt], attempts: attempt });
    expect(useProfileStore.getState().xp - before).toBe(QUIZ.xpByAttempt[attempt]);
    const snapshot = JSON.parse(JSON.stringify(useProfileStore.getState().quiz));
    const xp = useProfileStore.getState().xp;
    for (let i = 0; i < 3; i++) useProfileStore.getState().guessQuiz(puzzle, puzzle.playerId, "answer");
    expect(useProfileStore.getState().xp).toBe(xp);
    expect(useProfileStore.getState().quiz).toEqual(snapshot);
    expect(mission).toHaveBeenCalledTimes(1);
  });
  it("three misses finish once; a fourth guess cannot solve or advance a weekly mission", () => {
    const mission = vi.fn(originalMission); useProfileStore.setState({ applyMissionEvent: mission });
    const puzzle = quizForDate(todayKey());
    for (let i = 0; i < QUIZ.attempts; i++) useProfileStore.getState().guessQuiz(puzzle, null, `miss-${i}`);
    expect(useProfileStore.getState().quiz).toMatchObject({ played: 1, solved: 0 });
    const xp = useProfileStore.getState().xp;
    useProfileStore.getState().guessQuiz(puzzle, puzzle.playerId, "late");
    expect(useProfileStore.getState().quiz).toMatchObject({ played: 1, solved: 0 });
    expect(useProfileStore.getState().xp).toBe(xp);
    expect(mission).toHaveBeenCalledTimes(1);
  });
  it("UTC midnight opens a new puzzle and rejects the old tab's pending submission", () => {
    const yesterday = quizForDate(todayKey());
    useProfileStore.getState().guessQuiz(yesterday, null, "miss");
    vi.advanceTimersByTime(20_000);
    expect(todayKey()).toBe("2026-11-08");
    const before = useProfileStore.getState().xp;
    useProfileStore.getState().guessQuiz(yesterday, yesterday.playerId, "stale");
    expect(useProfileStore.getState().xp).toBe(before);
    const today = quizForDate(todayKey());
    useProfileStore.getState().guessQuiz(today, today.playerId, "today");
    expect(useProfileStore.getState().quiz.results[today.date]).toMatchObject({ solved: true, attempts: 1 });
    expect(useProfileStore.getState().quiz.results[yesterday.date]).toMatchObject({ solved: false, attempts: 1 });
  });
  it("every eligible answer exposes the full clue ladder before the last guess", () => {
    for (const facts of quizFacts().values()) {
      const puzzle = { date: todayKey(), playerId: facts.player.id, clues: cluesFor(facts) };
      expect(visibleClues(puzzle, QUIZ.attempts - 1)).toEqual(puzzle.clues);
      expect(puzzle.clues.at(-1)?.kind).toBe("peak");
    }
  });
  it("merging a finished day with an older in-progress save preserves its lock", () => {
    const p = quizForDate(todayKey());
    useProfileStore.getState().guessQuiz(p, null, "miss");
    const earlier = structuredClone(useProfileStore.getState().quiz);
    useProfileStore.getState().guessQuiz(p, p.playerId, "answer");
    const finished = useProfileStore.getState().quiz;
    for (const merged of [mergeQuiz(earlier, finished), mergeQuiz(finished, earlier)]) {
      expect(merged.results[p.date]).toMatchObject({ solved: true, attempts: 2 });
      expect(merged).toMatchObject({ played: 1, solved: 1 });
    }
  });
});

describe("CH-03: Daily Challenge", () => {
  it("a real completed Daily restored from a stale snapshot cannot repeat mission or XP rewards", () => {
    const mission = vi.fn(originalMission); useProfileStore.setState({ applyMissionEvent: mission });
    useRunStore.getState().startDailyRun();
    for (let guard = 0; useRunStore.getState().run!.phase === "draft" && guard < 70; guard++) {
      const run = useRunStore.getState().run!;
      if (!run.draft.offer!.hasPickableCard) { useRunStore.getState().freeReroll(); continue; }
      const score = (c: DraftOfferCard) => c.kind === "player" ? finalOverall(playerCardById.get(c.refId)!) + 20 : c.kind === "coach" ? coachById.get(c.refId)?.overall ?? 0 : c.kind === "sub" ? subById.get(c.refId)?.overall ?? 0 : 50;
      const card = run.draft.offer!.cards.filter(c => c.availability === "available" && slotsForKind(c.kind).some(s => !run.draft.roster[s])).sort((a,b) => score(b) - score(a))[0];
      useRunStore.getState().pickCard(card, slotsForKind(card.kind).find(s => !run.draft.roster[s])!);
    }
    expect(useRunStore.getState().run!.phase).toBe("review");
    useRunStore.getState().startTournament();
    for (let i=0; useRunStore.getState().run!.tournament!.stage !== "finished" && i<80; i++) useRunStore.getState().playRound();
    expect(useRunStore.getState().run!.tournament!.stage).toBe("finished");
    const stale = JSON.parse(JSON.stringify(useRunStore.getState().run));
    useRunStore.getState().finishRun();
    const xp = useProfileStore.getState().xp;
    const missions = mission.mock.calls.length;
    const runs = useProfileStore.getState().runsCompleted;
    useRunStore.setState({ run: stale }); useRunStore.getState().finishRun();
    expect(useRunStore.getState().run!.results!.xp.total).toBe(0);
    expect(useProfileStore.getState().xp).toBe(xp);
    expect(useProfileStore.getState().runsCompleted).toBe(runs);
    expect(mission).toHaveBeenCalledTimes(missions);
  });
  it("same UTC date shares offers, seed and modifiers, independent of profile rank", () => {
    useRunStore.getState().startDailyRun(); const first = useRunStore.getState().run!;
    useProfileStore.setState({ xp: 60_000 });
    useRunStore.getState().startDailyRun(); const second = useRunStore.getState().run!;
    expect(second.seed).toBe(first.seed); expect(second.draft).toEqual(first.draft);
    expect(second.daily).toEqual(first.daily); expect(second.rngState).toBe(first.rngState);
    useRunStore.getState().restartRun(); expect(useRunStore.getState().run!.draft).toEqual(first.draft);
  });
  it("records one official result; a repeated reward does not add XP, rating, titles or runs", () => {
    useRunStore.getState().startDailyRun(); const daily = useRunStore.getState().run!.daily!;
    const result: RunResults = { placement: "champion", swissRecord: { wins: 3, losses: 0 }, playoffWins: 4, championName: "Your Team", bestPlayerCardId: null, biggestWin: null, closestSeries: null, worstLoss: null, goalsConceded: 15, unlockedSpecialIds: [], newAchievementIds: [], userGoals: 40, userGameWins: 20, xp: { lines: [], difficultyMultiplier: 1, hiddenOverallBonus: 0, total: 200 } };
    const entry: RunHistoryEntry = { runId: "daily-first", date: new Date().toISOString(), difficulty: "normal", mode: "daily", region: null, hiddenOverall: false, placement: "champion", teamOverall: 90, swissRecord: { wins: 3, losses: 0 }, rosterNames: [], xpGained: 200 };
    useProfileStore.getState().applyRunResults(result, entry, daily);
    const first = useProfileStore.getState();
    useProfileStore.getState().applyRunResults(result, { ...entry, runId: "daily-repeat" }, daily);
    const after = useProfileStore.getState();
    for (const key of ["xp", "mmr", "runsCompleted", "wins", "dailyResults", "runHistory"] as const) expect(after[key]).toEqual(first[key]);
    useRunStore.setState({ run: null }); useRunStore.getState().startDailyRun();
    expect(useRunStore.getState().run).toBeNull();
    vi.advanceTimersByTime(20_000); useRunStore.getState().startDailyRun();
    expect(useRunStore.getState().run!.daily!.date).toBe("2026-11-08");
  });
});
