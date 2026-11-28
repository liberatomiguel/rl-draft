import { describe, expect, it } from "vitest";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import type { GameResult, SeriesResult } from "@/engine/types";
import { formatLiveClock, linesAt, liveFrameAt, liveSchedule, type LiveLine } from "./liveModel";

function series(games: GameResult[]): SeriesResult {
  return { teamAId: "user", teamBId: "x", games, score: [1, 0], winnerTeamId: "user", ratingDiff: 2, upset: false };
}
const g1: GameResult = { index: 1, winnerTeamId: "user", score: [3, 1], overtime: false, deciding: false, notes: [], scorers: { a: [2, 1, 0], b: [0, 0, 1] } };
const gOt: GameResult = { index: 2, winnerTeamId: "x", score: [2, 1], overtime: true, deciding: false, notes: [], scorers: { a: [1, 0, 0], b: [1, 1, 0] } };
const fin = (n: number): LiveLine => ({ goals: n, assists: 1, shots: 5 + n, saves: 3, demos: 2, score: 300 + n });

describe("liveModel (rc9 MATCHDAY)", () => {
  it("lands every goal at its beat and ends on the box score exactly", () => {
    const s = series([g1]);
    const tl = buildGameTimeline(s, g1, "po:0");
    const sch = liveSchedule(tl);
    const finals = { a: [fin(2), fin(1), fin(0)], b: [fin(0), fin(0), fin(1)] };
    let prev = liveFrameAt(sch, 0);
    expect(prev.score).toEqual([0, 0]);
    expect(formatLiveClock(prev.period, prev.clock)).toBe("5:00");
    let prevLines = linesAt(tl, prev, finals);
    for (let ms = 0; ms <= sch.totalMs + 10; ms += 97) {
      const f = liveFrameAt(sch, ms);
      expect(f.beats).toBeGreaterThanOrEqual(prev.beats);
      const lines = linesAt(tl, f, finals);
      for (const side of ["a", "b"] as const) {
        lines[side].forEach((l, i) => {
          const p = prevLines[side][i];
          expect(l.goals).toBeGreaterThanOrEqual(p.goals);
          expect(l.saves).toBeGreaterThanOrEqual(p.saves);
          expect(l.shots).toBeGreaterThanOrEqual(l.goals);
        });
      }
      prev = f;
      prevLines = lines;
    }
    const end = liveFrameAt(sch, sch.totalMs);
    expect(end.over).toBe(true);
    expect(end.score).toEqual([3, 1]);
    expect(linesAt(tl, end, finals)).toEqual(finals);
  });

  it("an overtime game shows the OT beat, then the golden goal on the OT clock", () => {
    const s = series([g1, gOt]);
    const tl = buildGameTimeline(s, gOt, "po:0");
    const sch = liveSchedule(tl);
    const end = liveFrameAt(sch, sch.totalMs + 1);
    expect(end.overtime).toBe(true);
    expect(end.period).toBe("overtime");
    expect(end.score).toEqual([1, 2]);
    expect(formatLiveClock("overtime", 87)).toBe("+1:27");
  });

  it("a game's timeline is the same before and after the later games are played (R241)", () => {
    const later: GameResult = { ...g1, index: 2, winnerTeamId: "x", score: [4, 0], scorers: { a: [0, 0, 0], b: [4, 0, 0] } };
    const a = buildGameTimeline(series([g1]), g1, "sw:1");
    const b = buildGameTimeline(series([g1, later]), g1, "sw:1");
    expect(b).toEqual(a);
  });
});
