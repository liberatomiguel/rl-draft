/**
 * rc9 MATCHDAY (R244, DESIGN-DECISIONS #234): the live game view's model.
 * Pure TS, no career imports beyond the timeline types.
 *
 * A game's timeline (engine/career/matchTimeline) becomes a schedule of
 * phases: the clock runs to each goal, the board holds on it, regulation
 * runs out, overtime holds, the OT clock runs to the golden goal, the final
 * whistle holds. `liveFrameAt(schedule, elapsedMs)` reads one moment of it:
 * the clock, the goals shown and the stats so far.
 *
 * Stats climb with the clock. Goals land at their minute with their scorer;
 * assists follow the goals of their side; shots, saves, demos and points
 * grow with the game time. At the final whistle every number is the game's
 * box score exactly, so the live view and the sheet never disagree.
 */

import { MATCH_LIVE } from "@/config/balance";
import type { ClockPeriod, GameTimeline, TimelineGoal } from "@/engine/career/matchTimeline";

export type LiveSide = "a" | "b";

/** The per-player numbers the view climbs (a box score line's shape, rating left out). */
export interface LiveLine {
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  demos: number;
  score: number;
}

export type LivePhase =
  | { kind: "run"; period: ClockPeriod; from: number; to: number; ms: number }
  | { kind: "hold"; ms: number; beat: number | null; final?: boolean };

export interface LiveSchedule {
  phases: LivePhase[];
  totalMs: number;
  /** Game seconds played in all (300 + the OT length). */
  gameSeconds: number;
  timeline: GameTimeline;
}

export interface LiveFrame {
  period: ClockPeriod;
  /** Regulation: seconds LEFT. Overtime: seconds PLAYED. */
  clock: number;
  /** Timeline beats shown (goals and the OT beat). */
  beats: number;
  score: [number, number];
  overtime: boolean;
  /** The final whistle has gone. */
  over: boolean;
  /** 0..1 of the game time played. */
  progress: number;
}

const REGULATION = 300;

export function liveSchedule(timeline: GameTimeline): LiveSchedule {
  const P = MATCH_LIVE;
  const phases: LivePhase[] = [];
  let clock = REGULATION;
  let period: ClockPeriod = "regulation";
  const otRunMs = (s: number) => Math.min(P.overtimeMaxMs, Math.round(s * P.overtimeMsPerGameSecond));
  timeline.beats.forEach((beat, i) => {
    if (beat.kind === "overtime") {
      phases.push({ kind: "run", period: "regulation", from: clock, to: 0, ms: Math.round(clock * P.msPerGameSecond) });
      phases.push({ kind: "hold", ms: P.overtimeHoldMs, beat: i });
      period = "overtime";
      clock = 0;
      return;
    }
    if (beat.period === "overtime") {
      phases.push({ kind: "run", period: "overtime", from: clock, to: beat.clock, ms: otRunMs(beat.clock - clock) });
      clock = beat.clock;
    } else {
      phases.push({ kind: "run", period: "regulation", from: clock, to: beat.clock, ms: Math.round((clock - beat.clock) * P.msPerGameSecond) });
      clock = beat.clock;
    }
    phases.push({ kind: "hold", ms: P.goalHoldMs, beat: i });
  });
  if (period === "regulation" && clock > 0) {
    phases.push({ kind: "run", period: "regulation", from: clock, to: 0, ms: Math.round(clock * P.msPerGameSecond) });
  }
  phases.push({ kind: "hold", ms: P.finalHoldMs, beat: null, final: true });
  const totalMs = phases.reduce((s, p) => s + p.ms, 0);
  return { phases, totalMs, gameSeconds: REGULATION + (timeline.overtimeSeconds ?? 0), timeline };
}

/** One moment of the game, `elapsedMs` (1×) after kickoff. */
export function liveFrameAt(schedule: LiveSchedule, elapsedMs: number): LiveFrame {
  const { timeline } = schedule;
  let t = Math.max(0, elapsedMs);
  let beats = 0;
  let period: ClockPeriod = "regulation";
  let clock = REGULATION;
  let over = false;
  for (const ph of schedule.phases) {
    if (ph.kind === "run") {
      period = ph.period;
      if (t < ph.ms) {
        clock = ph.from + (ph.to - ph.from) * (ph.ms > 0 ? t / ph.ms : 1);
        t = -1;
        break;
      }
      clock = ph.to;
      t -= ph.ms;
    } else {
      if (ph.beat !== null) {
        beats = ph.beat + 1;
        if (timeline.beats[ph.beat].kind === "overtime") {
          period = "overtime";
          clock = 0;
        }
      }
      if (ph.final) over = true;
      if (t < ph.ms) {
        t = -1;
        break;
      }
      t -= ph.ms;
    }
  }
  if (t >= 0) {
    beats = timeline.beats.length;
    over = true;
  }
  const shown = timeline.beats.slice(0, beats);
  const last = shown[shown.length - 1];
  const played = period === "regulation" ? REGULATION - clock : REGULATION + clock;
  return {
    period,
    clock,
    beats,
    score: last ? [last.scoreAfter[0], last.scoreAfter[1]] : [0, 0],
    overtime: shown.some((b) => b.kind === "overtime"),
    over,
    progress: over ? 1 : Math.min(1, played / Math.max(1, schedule.gameSeconds)),
  };
}

/** The goals shown so far, in order. */
export function goalsShown(timeline: GameTimeline, frame: LiveFrame): TimelineGoal[] {
  return timeline.beats.slice(0, frame.beats).filter((b): b is TimelineGoal => b.kind === "goal");
}

/**
 * Every player's numbers at `frame`, from the game's final lines. Goals come
 * from the goals shown; assists follow their side's goals; the rest grow with
 * the game time. At the whistle: `finals`, exactly.
 */
export function linesAt(
  timeline: GameTimeline,
  frame: LiveFrame,
  finals: Record<LiveSide, LiveLine[]>,
): Record<LiveSide, LiveLine[]> {
  const goals = goalsShown(timeline, frame);
  const out = {} as Record<LiveSide, LiveLine[]>;
  for (const side of ["a", "b"] as const) {
    const total = timeline.final[side === "a" ? 0 : 1];
    const sideGoals = goals.filter((g) => g.side === side);
    const share = total > 0 ? sideGoals.length / total : 0;
    out[side] = finals[side].map((fin, i) => {
      if (frame.over) return { ...fin };
      const g = sideGoals.filter((x) => x.playerIdx === i).length;
      const grow = (n: number) => Math.floor(n * frame.progress);
      return {
        goals: g,
        assists: Math.floor(fin.assists * share),
        shots: Math.min(fin.shots, Math.max(g, grow(fin.shots))),
        saves: grow(fin.saves),
        demos: grow(fin.demos),
        score: grow(fin.score),
      };
    });
  }
  return out;
}

/** The sum of a side's lines. */
export function sideTotals(lines: LiveLine[]): LiveLine {
  return lines.reduce(
    (s, l) => ({
      goals: s.goals + l.goals,
      assists: s.assists + l.assists,
      shots: s.shots + l.shots,
      saves: s.saves + l.saves,
      demos: s.demos + l.demos,
      score: s.score + l.score,
    }),
    { goals: 0, assists: 0, shots: 0, saves: 0, demos: 0, score: 0 },
  );
}

/** "3:42" on the regulation countdown, "+1:27" in overtime (whole seconds; a countdown shows the second it is in). */
export function formatLiveClock(period: ClockPeriod, seconds: number): string {
  const s = Math.max(0, period === "regulation" ? Math.ceil(seconds - 1e-6) : Math.floor(seconds));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return period === "overtime" ? `+${text}` : text;
}
