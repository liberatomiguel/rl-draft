"use client";

/**
 * rc9 MATCHDAY (R244, DESIGN-DECISIONS #234): one game, live. Reusable: it
 * takes a game timeline (engine/career/matchTimeline), the two sides' names
 * and marks and, optionally, the game's box score lines; it imports nothing
 * from the career (the friend duel can mount it as is).
 *
 * The clock runs down, goals land at their minute with the scorer, the score
 * and the stats climb with the clock (liveModel.ts), overtime is its own
 * beat. Motion sits where the event is: the score that changes and the goal
 * line that lands; the board itself never pulses. Reduced motion (OS setting,
 * `html.reduce-fx`, `html.lite-fx`) shows the finished game at once: the
 * same goals, minutes and numbers, nothing moving.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MATCH_LIVE } from "@/config/balance";
import type { GameTimeline } from "@/engine/career/matchTimeline";
import { cx } from "@/lib/util";
import {
  formatLiveClock,
  goalsShown,
  linesAt,
  liveFrameAt,
  liveSchedule,
  sideTotals,
  type LiveLine,
  type LiveSide,
} from "./liveModel";
import { useMatchReducedMotion } from "./useMatchReducedMotion";

export interface LiveSideInfo {
  name: string;
  /** The side's crest / logo, already sized (24 to 40 px). */
  mark?: ReactNode;
  players: string[];
  /** The player's own side: its name in the accent. */
  own?: boolean;
}

export interface LiveLabels {
  game: string;
  overtime: string;
  final: string;
  goal: string;
  shots: string;
  saves: string;
  demos: string;
  assists: string;
  goals: string;
  player: string;
  /** Screen-reader name of the running clock. */
  clock: string;
  /** Screen-reader line for a goal: "{scorer} scores, 2-1". */
  goalLine: (scorer: string, a: number, b: number) => string;
  noGoalsYet: string;
}

export function LiveGameView({
  timeline,
  sides,
  finals,
  labels,
  context,
  speed = 1,
  paused = false,
  skip = false,
  onEnd,
}: {
  timeline: GameTimeline;
  sides: Record<LiveSide, LiveSideInfo>;
  /** The game's box score lines; without them the view shows goals only. */
  finals?: Record<LiveSide, LiveLine[]>;
  labels: LiveLabels;
  /** One quiet item for the head's right side (the series score). */
  context?: ReactNode;
  speed?: number;
  paused?: boolean;
  /** Jump to the final whistle. */
  skip?: boolean;
  /** Once, when the final whistle's hold is over. */
  onEnd?: () => void;
}) {
  const reduced = useMatchReducedMotion();
  const schedule = useMemo(() => liveSchedule(timeline), [timeline]);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const jump = reduced || skip;
  useEffect(() => {
    if (!jump) return;
    elapsedRef.current = schedule.totalMs;
    setElapsed(schedule.totalMs);
  }, [jump, schedule]);

  // One loop: game time advances with the speed; the view redraws ~12 times a second.
  useEffect(() => {
    if (endedRef.current) return;
    if (paused) return;
    let last = performance.now();
    let drawn = 0;
    let raf = 0;
    let hold: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      onEndRef.current?.();
    };
    if (jump) {
      // The finished game stays on screen for the final hold, then hands on.
      hold = setTimeout(finish, MATCH_LIVE.finalHoldMs / speed);
      return () => {
        if (hold) clearTimeout(hold);
      };
    }
    const step = (now: number) => {
      elapsedRef.current = Math.min(schedule.totalMs, elapsedRef.current + (now - last) * speed);
      last = now;
      if (now - drawn > 80 || elapsedRef.current >= schedule.totalMs) {
        drawn = now;
        setElapsed(elapsedRef.current);
      }
      if (elapsedRef.current >= schedule.totalMs) {
        finish();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, speed, schedule, jump]);

  const frame = liveFrameAt(schedule, jump ? schedule.totalMs : elapsed);
  const goals = goalsShown(timeline, frame);
  const lines = finals ? linesAt(timeline, frame, finals) : null;
  const totals = lines ? { a: sideTotals(lines.a), b: sideTotals(lines.b) } : null;
  const clockText = frame.over ? labels.final : formatLiveClock(frame.period, frame.clock);
  const scorer = (side: LiveSide, idx: number | null) => (idx !== null ? sides[side].players[idx] : undefined) ?? sides[side].name;
  const lastGoal = goals[goals.length - 1];

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="kicker">{labels.game}</p>
        {context ? <div className="text-sm text-sub">{context}</div> : null}
      </div>

      {/* The board: names, the score, the clock. */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <SideName side={sides.a} align="left" />
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-3 sm:gap-4">
            <Score value={frame.score[0]} />
            <span className="text-faint" aria-hidden>
              :
            </span>
            <Score value={frame.score[1]} />
          </div>
          <p
            className={cx(
              "display mt-1 rounded-[3px] px-2 py-0.5 text-sm font-semibold tabular-nums",
              frame.overtime && !frame.over ? "text-orange-bright" : "text-sub",
            )}
            role="timer"
            aria-label={labels.clock}
          >
            <ClockText text={clockText} />
          </p>
          {frame.overtime ? (
            <p key="ot" className={cx("kicker mt-1 !text-orange-bright", !reduced && "pop-in")}>
              {labels.overtime}
            </p>
          ) : null}
        </div>
        <SideName side={sides.b} align="right" />
      </div>

      {/* Team figures: shots, saves, demos, read across the board. */}
      {totals ? (
        <dl className="mt-4 grid grid-cols-3 border-y border-line py-2 text-center">
          {(["shots", "saves", "demos"] as const).map((k) => (
            <div key={k} className="min-w-0">
              <dt className="kicker">{labels[k]}</dt>
              <dd className="display mt-0.5 text-base font-semibold tabular-nums text-ink">
                {totals.a[k]}
                <span className="mx-1.5 text-faint">·</span>
                {totals.b[k]}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* The goals, in the order they went in. */}
        <ol className="min-h-[7rem] space-y-1" aria-live="polite" aria-relevant="additions">
          {goals.length === 0 ? <li className="text-sm text-faint">{labels.noGoalsYet}</li> : null}
          {goals.map((g, i) => (
            <li
              key={i}
              className={cx(
                "flex items-baseline gap-3 text-sm",
                g === lastGoal && !reduced && "pop-in",
              )}
            >
              <span className="display w-12 shrink-0 text-xs font-semibold tabular-nums text-faint">
                {formatLiveClock(g.period, g.clock)}
              </span>
              <span className={cx("min-w-0 truncate", sides[g.side].own ? "text-ink" : "text-sub")}>
                <span className="sr-only">{labels.goalLine(scorer(g.side, g.playerIdx), g.scoreAfter[0], g.scoreAfter[1])}</span>
                <span aria-hidden>{scorer(g.side, g.playerIdx)}</span>
              </span>
              <span className="display ml-auto shrink-0 text-xs font-semibold tabular-nums text-sub" aria-hidden>
                {g.scoreAfter[0]}-{g.scoreAfter[1]}
              </span>
            </li>
          ))}
        </ol>

        {/* The players' numbers, climbing with the clock. */}
        {lines ? (
          <div className="min-w-0 space-y-3">
            {(["a", "b"] as const).map((side) => (
              <table key={side} className="w-full table-fixed text-sm">
                <caption className={cx("display truncate pb-1 text-left text-xs font-semibold", sides[side].own ? "text-orange-bright" : "text-sub")}>
                  {sides[side].name}
                </caption>
                <thead>
                  <tr className="kicker">
                    <th scope="col" className="w-[46%] pb-1 text-left font-medium">
                      <span className="sr-only">{labels.player}</span>
                    </th>
                    <th scope="col" className="pb-1 text-right font-medium">{labels.goals}</th>
                    <th scope="col" className="pb-1 text-right font-medium">{labels.assists}</th>
                    <th scope="col" className="hidden pb-1 text-right font-medium min-[400px]:table-cell">{labels.shots}</th>
                    <th scope="col" className="pb-1 text-right font-medium">{labels.saves}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines[side].map((l, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="truncate py-1.5 pr-2 text-ink">{sides[side].players[i] ?? ""}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink">{l.goals}</td>
                      <td className="py-1.5 text-right tabular-nums text-sub">{l.assists}</td>
                      <td className="hidden py-1.5 text-right tabular-nums text-sub min-[400px]:table-cell">{l.shots}</td>
                      <td className="py-1.5 text-right tabular-nums text-sub">{l.saves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SideName({ side, align }: { side: LiveSideInfo; align: "left" | "right" }) {
  return (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row", align === "right" && "sm:flex-row-reverse")}>
      {side.mark ? <span className="shrink-0">{side.mark}</span> : null}
      <p
        className={cx(
          "display min-w-0 break-words text-sm font-semibold leading-tight sm:text-lg",
          align === "left" ? "sm:text-left" : "sm:text-right",
          side.own ? "text-orange-bright" : "text-ink",
        )}
      >
        {side.name}
      </p>
    </div>
  );
}

/** A score figure: re-keyed per value so a goal lands on it (and only then). */
function Score({ value }: { value: number }) {
  return (
    <span key={value} className="display pop-in min-w-[1ch] text-center text-5xl font-bold leading-none tabular-nums text-ink sm:text-6xl">
      {value}
    </span>
  );
}

/** Fixed cells, so a running clock never jitters on proportional figures. */
function ClockText({ text }: { text: string }) {
  if (!/^\+?\d/.test(text)) return <>{text}</>;
  return (
    <span className="inline-flex">
      {text.split("").map((ch, i) => (
        <span key={i} className={cx("inline-block text-center", /\d/.test(ch) ? "w-[0.62em]" : "w-[0.32em]")}>
          {ch}
        </span>
      ))}
    </span>
  );
}
