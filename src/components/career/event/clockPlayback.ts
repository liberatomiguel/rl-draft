/**
 * Road to Worlds — Match Center clock playback (GAME-04, R41). Pure TS.
 *
 * Turns one game's timeline (engine/career/matchTimeline) into the plan both
 * halves of the live reveal share. EventScreen's playback effect waits
 * `delayMs` (÷ the speed toggle) before revealing each beat; the Match
 * Center's clock animates the matching `segment` during that same wait (hold
 * at `from`, then run to `to`). Same numbers on both sides, so the clock
 * reaches each goal's time as the goal lands, whatever the OT length.
 *
 * Pause, a speed change or a remount mid-step must not break that, so both
 * halves also read ONE record of how far the current step has played
 * (`BeatSync`): the timer only waits what is left of the step, and the clock
 * plays the rest of its segment over that same time.
 */

import { CAREER_MATCH_CLOCK } from "@/config/balance";
import type { ClockPeriod, GameTimeline } from "@/engine/career/matchTimeline";

export interface ClockSegment {
  period: ClockPeriod;
  /** Clock seconds at the start (regulation counts DOWN, overtime counts UP). */
  from: number;
  to: number;
  /** ms (1×) the clock holds at `from` before it runs. */
  holdMs: number;
  /** ms (1×) the run from `from` to `to` takes. */
  runMs: number;
}

export interface PlaybackStep {
  /** ms (1×) from the previous beat (or the game's start) until this beat lands. */
  delayMs: number;
  /** What the clock does during that wait. */
  segment: ClockSegment;
}

export interface GamePlayback {
  /** One step per timeline beat, in the same order. */
  steps: PlaybackStep[];
  /** After the last beat, before the game gap: regulation runs out to 0:00; OT holds. */
  tail: PlaybackStep;
}

/** The OT clock's run time, log-scaled by OT length (0:30 → min … 20:00 → max). */
export function overtimeRunMs(seconds: number): number {
  const { overtime: O, pacing: P } = CAREER_MATCH_CLOCK;
  const f =
    Math.log(Math.max(seconds, O.minSeconds) / O.minSeconds) /
    Math.log(O.maxSeconds / O.minSeconds);
  const t = Math.min(1, Math.max(0, f));
  return Math.round(P.overtimeRunMinMs + (P.overtimeRunMaxMs - P.overtimeRunMinMs) * t);
}

export function gamePlayback(timeline: GameTimeline): GamePlayback {
  const { regulationSeconds, pacing: P } = CAREER_MATCH_CLOCK;
  const regulationRun = (from: number, to: number) =>
    Math.max(0, Math.round((from - to) * P.regulationMsPerSecond));

  const steps: PlaybackStep[] = [];
  let period: ClockPeriod = "regulation";
  let clock: number = regulationSeconds;
  let hold: number = P.kickoffHoldMs;

  for (const beat of timeline.beats) {
    if (beat.kind === "overtime") {
      // Regulation runs out tied; a breath on 0:00, then OVERTIME lands.
      const runMs = regulationRun(clock, 0);
      steps.push({
        delayMs: hold + runMs + P.regulationBuzzerMs,
        segment: { period: "regulation", from: clock, to: 0, holdMs: hold, runMs },
      });
      period = "overtime";
      clock = 0;
      hold = P.overtimeIntroMs;
    } else if (beat.period === "overtime") {
      // The OT clock counts up, accelerated, to the golden goal.
      const runMs = overtimeRunMs(beat.clock);
      steps.push({
        delayMs: hold + runMs,
        segment: { period: "overtime", from: clock, to: beat.clock, holdMs: hold, runMs },
      });
      clock = beat.clock;
      hold = P.goalHoldMs;
    } else {
      const runMs = regulationRun(clock, beat.clock);
      steps.push({
        delayMs: hold + runMs,
        segment: { period: "regulation", from: clock, to: beat.clock, holdMs: hold, runMs },
      });
      clock = beat.clock;
      hold = P.goalHoldMs;
    }
  }

  if (period === "overtime") {
    return {
      steps,
      tail: {
        delayMs: P.goldenGoalLingerMs,
        segment: { period, from: clock, to: clock, holdMs: 0, runMs: 0 },
      },
    };
  }
  const runMs = regulationRun(clock, 0);
  return {
    steps,
    tail: {
      delayMs: hold + runMs,
      segment: { period, from: clock, to: 0, holdMs: hold, runMs },
    },
  };
}

/** The clock value `playedMs` (1×) into a step: `from` through the hold, a linear run, then `to`. */
export function segmentValueAt(segment: ClockSegment, playedMs: number): number {
  const { from, to, holdMs, runMs } = segment;
  if (playedMs <= holdMs) return from;
  if (runMs <= 0 || playedMs >= holdMs + runMs) return to;
  return from + (to - from) * ((playedMs - holdMs) / runMs);
}

/**
 * How the clock plays the rest of `segment` from `playedMs` (1×) into its
 * step at `speed`, in real ms: hold, then run to `to`, landing `leadMs`
 * before the run's planned end (trimming the run, then the hold), so it
 * settles just ahead of the beat and a goal never pops ahead of its time.
 * Fresh (`playedMs` 0) it is the whole hold and run; resumed, only what is left.
 */
export function clockRunFrom(
  segment: ClockSegment,
  playedMs: number,
  speed: number,
  leadMs: number,
): { holdMs: number; runMs: number } {
  const holdLeft = Math.max(0, segment.holdMs - playedMs) / speed;
  const runLeft = Math.max(0, segment.runMs - Math.max(0, playedMs - segment.holdMs)) / speed;
  const runTrim = Math.min(runLeft, leadMs);
  return { holdMs: Math.max(0, holdLeft - (leadMs - runTrim)), runMs: runLeft - runTrim };
}

/**
 * How far the live reveal is into its current step: the one record both
 * halves read. EventScreen's playback effect owns it (startBeat when it arms
 * a step's timer, stopBeat whenever that timer stops: pause, speed change,
 * any re-run); GameClock only reads it (beatPlayedMs).
 */
export interface BeatSync {
  /** The step measured (beatStepKey); "" before the first one. */
  key: string;
  /** ms (1×) of the step played before the current run. */
  playedMs: number;
  /** performance.now() when the current run started; null while stopped. */
  since: number | null;
  /** Speed factor of the current run. */
  speed: number;
}

export function createBeatSync(): BeatSync {
  return { key: "", playedMs: 0, since: null, speed: 1 };
}

/** One playback step: beat `beat` of game `game` of a round (`beat` = steps.length is the tail). */
export function beatStepKey(roundKey: string, game: number, beat: number): string {
  return `${roundKey}:${game}:${beat}`;
}

/** ms (1×) of step `key` played at `now`; 0 for a step the record is not on yet. */
export function beatPlayedMs(sync: BeatSync, key: string, now: number): number {
  if (sync.key !== key) return 0;
  const running = sync.since === null ? 0 : Math.max(0, now - sync.since) * sync.speed;
  return sync.playedMs + running;
}

/**
 * Starts step `key` (`delayMs` long at 1×) at `speed`, or resumes it if the
 * record is already on it. Returns the real ms left until its beat lands.
 */
export function startBeat(
  sync: BeatSync,
  key: string,
  delayMs: number,
  speed: number,
  now: number,
): number {
  if (sync.key === key) {
    stopBeat(sync, now); // banks a run that was never stopped
  } else {
    sync.key = key;
    sync.playedMs = 0;
  }
  sync.since = now;
  sync.speed = speed;
  return Math.max(0, delayMs - sync.playedMs) / speed;
}

/** Stops the current run, banking the time it played. */
export function stopBeat(sync: BeatSync, now: number): void {
  if (sync.since === null) return;
  sync.playedMs += Math.max(0, now - sync.since) * sync.speed;
  sync.since = null;
}

/** "3:42" on the regulation countdown, "+1:27" in overtime (whole seconds). */
export function formatClock(period: ClockPeriod, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return period === "overtime" ? `+${text}` : text;
}
