"use client";

/**
 * Road to Worlds — the Match Center game clock (GAME-04, R41).
 *
 * `GameClock` animates ONE playback segment (clockPlayback.ts): hold at `from`,
 * then run to `to`, in step with the EventScreen timer that reveals the next
 * beat. The parent keys it per beat, so every segment starts fresh. Both read
 * the same step record (`sync`): pausing freezes the clock, and a resume, a
 * speed change or a remount mid-step (closing an inspected series) plays the
 * rest of the segment over exactly the time the timer has left, so the clock
 * still settles just before the beat. Reduced motion never animates.
 *
 * Performance (measured on the static export): no rAF loop. The clock sleeps
 * through its hold, then ticks `clockMaxFps` times a second, writing the
 * digits straight into the fixed cells (and the screen-reader text) instead
 * of re-rendering through React; React state catches up when a run settles or
 * the reading changes length (OT past 10:00). The pill is layout/paint
 * contained, so a tick never relayouts the page.
 */

import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import { CAREER_MATCH_CLOCK } from "@/config/balance";
import type { ClockPeriod } from "@/engine/career/matchTimeline";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { cx } from "@/lib/util";
import {
  beatPlayedMs,
  clockRunFrom,
  formatClock,
  segmentValueAt,
  type BeatSync,
  type ClockSegment,
} from "./clockPlayback";

/**
 * A clock reading in fixed-width cells. Rajdhani's figures are proportional
 * and the font has no `tnum` feature, so `tabular-nums` alone would let a
 * running clock jitter: every figure gets a cell as wide as the widest one.
 */
export function ClockDigits({
  text,
  className,
  cellsRef,
  srRef,
}: {
  text: string;
  className?: string;
  /** GameClock only: the cell row and the screen-reader text it writes per frame. */
  cellsRef?: Ref<HTMLSpanElement>;
  srRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <span className={cx("inline-flex tabular-nums tracking-normal", className)}>
      <span ref={srRef} className="sr-only">
        {text}
      </span>
      {/* Keyed by length: a longer reading (OT past 10:00) gets fresh cells.
          React would otherwise keep digits GameClock wrote straight into the
          DOM wherever its own old and new text happen to match. */}
      <span key={text.length} ref={cellsRef} aria-hidden className="inline-flex">
        {Array.from(text).map((ch, i) => (
          <span
            key={i}
            className={cx("inline-block text-center", ch === ":" ? "w-[0.26em]" : "w-[0.58em]")}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}

export function GameClock({
  segment,
  speed,
  paused,
  label,
  sync,
  syncKey,
  className,
}: {
  segment: ClockSegment;
  /** The playback speed factor (durations are ÷ speed). */
  speed: number;
  paused: boolean;
  /** Accessible name of the timer (e.g. "Game clock"). */
  label: string;
  /**
   * The reveal timer's step record and this segment's step in it
   * (beatStepKey). Without them, every (re)start plays the whole segment.
   */
  sync?: RefObject<BeatSync>;
  syncKey?: string;
  className?: string;
}) {
  const reduced = useOsReducedMotion();
  const { period, from, to, holdMs, runMs } = segment;
  /** The React-rendered reading: the segment's start, then each settled one. */
  const [text, setText] = useState(() => formatClock(period, from));
  /** Exact (fractional) clock value on screen: the resume point. */
  const valueRef = useRef(from);
  const cellsRef = useRef<HTMLSpanElement>(null);
  const srRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    const seg: ClockSegment = { period, from, to, holdMs, runMs };
    const { clockLeadMs, clockMaxFps } = CAREER_MATCH_CLOCK.pacing;
    // How far the step has played, read off the reveal timer's own record.
    const played =
      sync?.current && syncKey !== undefined
        ? beatPlayedMs(sync.current, syncKey, performance.now())
        : 0;
    // Resume from what is on screen or from where the step is, whichever is
    // further along: a remount starts back at `from`, and a resume never
    // runs the clock backwards.
    const total = Math.abs(to - from);
    const along = (v: number) => (total > 0 ? Math.abs(v - from) / total : 1);
    const stepValue = segmentValueAt(seg, played);
    const start = along(stepValue) > along(valueRef.current) ? stepValue : valueRef.current;
    valueRef.current = start;
    const counting = to < from ? Math.ceil : Math.floor; // countdown shows the second in progress
    const paint = (reading: string): boolean => {
      const cells = cellsRef.current?.children;
      if (!cells || cells.length !== reading.length) return false;
      for (let i = 0; i < reading.length; i++) {
        if (cells[i].textContent !== reading[i]) cells[i].textContent = reading[i];
      }
      const sr = srRef.current;
      if (sr && sr.textContent !== reading) sr.textContent = reading;
      return true;
    };
    let painted = "";
    const show = (reading: string) => {
      if (reading === painted) return;
      // A new length (OT past 10:00) needs new cells: React lays them out.
      if (!paint(reading)) setText(reading);
      painted = reading;
    };
    // The resume point goes straight into the cells, so a remount mid-step
    // never flashes `from`. A reading React must lay out waits for a tick.
    const first = formatClock(period, counting(start));
    if (paint(first)) painted = first;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (paused || start === to) {
      // Frozen or finished: only React's state still has to match the screen.
      if (start === to || painted !== first) timer = setTimeout(() => setText(first), 0);
      return () => clearTimeout(timer);
    }
    // Timeouts, not a rAF loop: a rAF loop asks for a main-thread frame every
    // vsync (holds included) and each one runs the page's whole lifecycle.
    // This sleeps through the hold, then ticks at the capped rate, with the
    // last tick landing exactly on the run's end.
    const { holdMs: hold, runMs: run } = clockRunFrom(seg, played, speed, clockLeadMs);
    const runStart = performance.now() + hold;
    const end = runStart + run;
    const tick = () => {
      const now = performance.now();
      const p = now < runStart ? 0 : run > 0 ? Math.min(1, (now - runStart) / run) : 1;
      const value = start + (to - start) * p;
      valueRef.current = value;
      const reading = formatClock(period, counting(value));
      show(reading);
      if (p >= 1) {
        setText(reading); // settle: React state = what is on screen
        return;
      }
      timer = setTimeout(
        tick,
        now < runStart ? runStart - now : Math.min(1000 / clockMaxFps, end - now),
      );
    };
    timer = setTimeout(tick, painted ? hold : 0);
    return () => clearTimeout(timer);
  }, [period, from, to, holdMs, runMs, speed, paused, reduced, sync, syncKey]);

  return (
    <span role="timer" aria-label={label} className={cx("[contain:layout_paint]", className)}>
      <ClockDigits text={text} cellsRef={cellsRef} srRef={srRef} />
    </span>
  );
}

/** A static clock reading (feed rows): same cells, no animation. */
export function ClockStamp({
  period,
  seconds,
  className,
}: {
  period: ClockPeriod;
  seconds: number;
  className?: string;
}) {
  return <ClockDigits text={formatClock(period, seconds)} className={className} />;
}
