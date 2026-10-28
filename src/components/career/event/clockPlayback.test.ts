/**
 * GAME-04 (R41) — the Match Center clock playback plan: one step per beat,
 * a continuous clock across steps, OT presented in a few seconds whatever its
 * length, and the 3:42 / +1:27 readings. Also the step record both halves
 * share, so a pause, a speed change or a remount never desyncs the clock
 * from the beat.
 */

import { describe, expect, it } from "vitest";
import { CAREER_MATCH_CLOCK as CLOCK, CAREER_PLAYBACK } from "@/config/balance";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import type { GameResult, SeriesResult } from "@/engine/types";
import {
  beatPlayedMs,
  beatStepKey,
  clockRunFrom,
  createBeatSync,
  formatClock,
  gamePlayback,
  overtimeRunMs,
  segmentValueAt,
  startBeat,
  stopBeat,
  type ClockSegment,
  type PlaybackStep,
} from "./clockPlayback";

function fixture(w: number, l: number, overtime: boolean, index = 1): { series: SeriesResult; game: GameResult } {
  const game: GameResult = {
    index,
    winnerTeamId: "opp",
    score: [w, l],
    overtime,
    deciding: false,
    notes: [],
    scorers: { a: [l, 0, 0], b: [0, w, 0] },
  };
  return {
    game,
    series: {
      teamAId: "user",
      teamBId: "opp",
      games: [game],
      score: [0, 1],
      winnerTeamId: "opp",
      ratingDiff: -1.2,
      upset: false,
    },
  };
}

const P = CLOCK.pacing;

describe("clockPlayback — formatClock", () => {
  it("reads like the RL clock", () => {
    expect(formatClock("regulation", 300)).toBe("5:00");
    expect(formatClock("regulation", 222)).toBe("3:42");
    expect(formatClock("regulation", 1)).toBe("0:01");
    expect(formatClock("regulation", 0)).toBe("0:00");
    expect(formatClock("overtime", 0)).toBe("+0:00");
    expect(formatClock("overtime", 87)).toBe("+1:27");
    expect(formatClock("overtime", 725)).toBe("+12:05");
  });
});

describe("clockPlayback — gamePlayback", () => {
  it("regulation: one step per goal, a continuous countdown, then the run-out", () => {
    for (const [w, l] of [[1, 0], [3, 2], [8, 7], [6, 1]] as const) {
      const { series, game } = fixture(w, l, false);
      const tl = buildGameTimeline(series, game, "sw:0");
      const plan = gamePlayback(tl);
      expect(plan.steps).toHaveLength(tl.beats.length);
      let from: number = CLOCK.regulationSeconds;
      plan.steps.forEach((step, i) => {
        const beat = tl.beats[i];
        if (beat.kind !== "goal") throw new Error("regulation games only have goals");
        expect(step.segment.period).toBe("regulation");
        expect(step.segment.from).toBe(from);
        expect(step.segment.to).toBe(beat.clock);
        expect(step.segment.holdMs).toBe(i === 0 ? P.kickoffHoldMs : P.goalHoldMs);
        expect(step.segment.runMs).toBe((from - beat.clock) * P.regulationMsPerSecond);
        expect(step.delayMs).toBe(step.segment.holdMs + step.segment.runMs);
        from = beat.clock;
      });
      expect(plan.tail.segment).toMatchObject({ period: "regulation", from, to: 0 });
      expect(plan.tail.delayMs).toBe(P.goalHoldMs + from * P.regulationMsPerSecond);
    }
  });

  it("overtime: runs out tied, the OT beat, then an accelerated OT clock to the golden goal", () => {
    for (const w of [1, 2, 4, 8]) {
      const { series, game } = fixture(w, w - 1, true);
      const tl = buildGameTimeline(series, game, "po:1");
      const plan = gamePlayback(tl);
      const otIndex = tl.beats.findIndex((b) => b.kind === "overtime");
      const buzzer = plan.steps[otIndex];
      expect(buzzer.segment).toMatchObject({ period: "regulation", to: 0 });
      expect(buzzer.delayMs).toBe(buzzer.segment.holdMs + buzzer.segment.runMs + P.regulationBuzzerMs);
      const golden = plan.steps[otIndex + 1];
      expect(golden.segment).toMatchObject({
        period: "overtime",
        from: 0,
        to: tl.overtimeSeconds,
        holdMs: P.overtimeIntroMs,
      });
      expect(golden.segment.runMs).toBeGreaterThanOrEqual(P.overtimeRunMinMs);
      expect(golden.segment.runMs).toBeLessThanOrEqual(P.overtimeRunMaxMs);
      expect(plan.tail).toEqual({
        delayMs: P.goldenGoalLingerMs,
        segment: { period: "overtime", from: tl.overtimeSeconds, to: tl.overtimeSeconds, holdMs: 0, runMs: 0 },
      });
    }
  });

  it("presents any OT length in a few seconds (log-scaled, monotonic)", () => {
    expect(overtimeRunMs(CLOCK.overtime.minSeconds)).toBe(P.overtimeRunMinMs);
    expect(overtimeRunMs(CLOCK.overtime.maxSeconds)).toBe(P.overtimeRunMaxMs);
    let prev = 0;
    for (const s of [30, 45, 90, 120, 300, 600, 900, 1_200]) {
      const ms = overtimeRunMs(s);
      expect(ms).toBeGreaterThanOrEqual(prev);
      prev = ms;
    }
    // Out-of-range inputs stay bounded.
    expect(overtimeRunMs(5)).toBe(P.overtimeRunMinMs);
    expect(overtimeRunMs(5_000)).toBe(P.overtimeRunMaxMs);
  });
});

describe("clockPlayback — pause, speed change and remount stay on the beat (TIM-C2)", () => {
  const LEAD = P.clockLeadMs;
  const EPS = 1e-6;
  const KEY = beatStepKey("po:0", 0, 0);

  it("startBeat / stopBeat bank how far a step has played", () => {
    const sync = createBeatSync();
    expect(startBeat(sync, KEY, 1_000, 2, 0)).toBe(500);
    expect(beatPlayedMs(sync, KEY, 100)).toBe(200); // 100 ms real at 2×
    stopBeat(sync, 100);
    expect(beatPlayedMs(sync, KEY, 5_000)).toBe(200); // paused: nothing more plays
    expect(startBeat(sync, KEY, 1_000, 4, 5_000)).toBe(200); // resumed at 4×: (1000 − 200) / 4
    // A re-run without a stop banks the run too: 200 + 50 ms × 4 = 400 played.
    expect(startBeat(sync, KEY, 1_000, 1, 5_050)).toBe(600);
    const next = beatStepKey("po:0", 0, 1);
    expect(startBeat(sync, next, 700, 1, 5_100)).toBe(700); // the next step starts from zero
    expect(beatPlayedMs(sync, KEY, 5_200)).toBe(0); // the record no longer answers for the old one
    expect(beatPlayedMs(sync, next, 5_200)).toBe(100);
  });

  it("segmentValueAt: `from` through the hold, a linear run, then `to`", () => {
    const seg: ClockSegment = { period: "regulation", from: 240, to: 200, holdMs: 400, runMs: 160 };
    expect(segmentValueAt(seg, 0)).toBe(240);
    expect(segmentValueAt(seg, 400)).toBe(240);
    expect(segmentValueAt(seg, 480)).toBe(220);
    expect(segmentValueAt(seg, 560)).toBe(200);
    expect(segmentValueAt(seg, 9_999)).toBe(200);
    expect(segmentValueAt({ ...seg, runMs: 0 }, 401)).toBe(200);
  });

  it("clockRunFrom: the rest of the hold and run, landing the lead early (never negative)", () => {
    const seg: ClockSegment = { period: "regulation", from: 240, to: 200, holdMs: 400, runMs: 160 };
    for (const speed of [1, 2, 4]) {
      for (const played of [0, 100, 399, 400, 450, 559, 560, 2_000]) {
        const holdLeft = Math.max(0, seg.holdMs - played) / speed;
        const runLeft = Math.max(0, seg.runMs - Math.max(0, played - seg.holdMs)) / speed;
        const { holdMs, runMs } = clockRunFrom(seg, played, speed, LEAD);
        expect(holdMs).toBeGreaterThanOrEqual(0);
        expect(runMs).toBeGreaterThanOrEqual(0);
        expect(holdMs).toBeLessThanOrEqual(holdLeft + EPS);
        expect(runMs).toBeLessThanOrEqual(runLeft + EPS);
        expect(holdMs + runMs).toBeCloseTo(Math.max(0, holdLeft + runLeft - LEAD), 9);
      }
    }
  });

  /** Every step of a few real plans, the tail with its game gap as EventScreen waits it. */
  function steps(): PlaybackStep[] {
    const out: PlaybackStep[] = [];
    for (const [w, l, ot] of [[3, 2, false], [3, 2, true], [1, 0, true], [6, 1, false]] as const) {
      const { series, game } = fixture(w, l, ot);
      const plan = gamePlayback(buildGameTimeline(series, game, "po:0"));
      out.push(...plan.steps, {
        delayMs: plan.tail.delayMs + CAREER_PLAYBACK.userGameGapMs,
        segment: plan.tail.segment,
      });
    }
    return out;
  }

  /**
   * How long before the beat the clock settles: 0 up to the lead, plus what
   * the plan itself waits after the run (the OT buzzer, the tail's linger).
   */
  const allowedGap = (step: PlaybackStep, speed: number) =>
    LEAD + (step.delayMs - step.segment.holdMs - step.segment.runMs) / speed + EPS;

  it("a pause or a speed change mid-step: the timer waits only what is left, the clock lands with it", () => {
    const problems: string[] = [];
    for (const [si, step] of steps().entries()) {
      for (const s1 of [1, 2, 4]) {
        for (const s2 of [1, 2, 4]) {
          for (const f of [0, 0.05, 0.3, 0.5, 0.75, 0.9, 0.99]) {
            for (const pausedMs of [0, 800]) {
              // The page's order: the timer's cleanup stops the step, then the
              // clock's effect reads the record (child effects run first),
              // then the timer re-arms.
              const sync = createBeatSync();
              startBeat(sync, KEY, step.delayMs, s1, 0);
              const stopAt = (f * step.delayMs) / s1;
              stopBeat(sync, stopAt);
              const resumeAt = stopAt + pausedMs;
              const played = beatPlayedMs(sync, KEY, resumeAt);
              const run = clockRunFrom(step.segment, played, s2, LEAD);
              const wait = startBeat(sync, KEY, step.delayMs, s2, resumeAt);
              const gap = wait - (run.holdMs + run.runMs);
              const tag = `step ${si} ${s1}×→${s2}× at ${f} (paused ${pausedMs} ms)`;
              if (Math.abs(wait - ((1 - f) * step.delayMs) / s2) > 1e-6) problems.push(`${tag}: waits ${wait}`);
              if (gap < -EPS || gap > allowedGap(step, s2)) problems.push(`${tag}: clock settles ${gap} ms early`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("a remount mid-step (closing an inspected series) picks the clock up where the step is", () => {
    const problems: string[] = [];
    for (const [si, step] of steps().entries()) {
      for (const speed of [1, 2, 4]) {
        for (const f of [0, 0.2, 0.5, 0.8, 0.99]) {
          const sync = createBeatSync();
          const beatAt = startBeat(sync, KEY, step.delayMs, speed, 0); // timer keeps running
          const mountAt = (f * step.delayMs) / speed;
          const played = beatPlayedMs(sync, KEY, mountAt);
          if (Math.abs(played - f * step.delayMs) > 1e-6) problems.push(`step ${si}: played ${played}`);
          const run = clockRunFrom(step.segment, played, speed, LEAD);
          const gap = beatAt - (mountAt + run.holdMs + run.runMs);
          if (gap < -EPS || gap > allowedGap(step, speed)) {
            problems.push(`step ${si} ${speed}× at ${f}: clock settles ${gap} ms early`);
          }
          // …and starts from the step's own reading, not from the segment's start.
          const shown = segmentValueAt(step.segment, played);
          const expected = segmentValueAt(step.segment, f * step.delayMs);
          if (shown !== expected) problems.push(`step ${si}: starts at ${shown}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("a fresh step plays exactly the planned segment (no record, or a record on another step)", () => {
    for (const step of steps()) {
      const sync = createBeatSync();
      startBeat(sync, beatStepKey("po:0", 0, 99), 1_000, 1, 0);
      expect(beatPlayedMs(sync, KEY, 500)).toBe(0);
      const run = clockRunFrom(step.segment, 0, 1, LEAD);
      expect(run.holdMs + run.runMs).toBeCloseTo(
        Math.max(0, step.segment.holdMs + step.segment.runMs - LEAD),
        9,
      );
    }
  });
});
