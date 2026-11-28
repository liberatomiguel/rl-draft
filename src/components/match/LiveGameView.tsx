"use client";

/**
 * rc9 MATCHDAY (R244, DESIGN-DECISIONS #234, #238): one game, live. Reusable:
 * it takes a game timeline (engine/career/matchTimeline), the two sides'
 * names, marks and tones and, optionally, the game's box score lines; it
 * imports nothing from the career's screens or store (the friend duel mounts
 * it as is). Its contract is in docs/handoff-rc9/MATCHDAY.md.
 *
 * The broadcast board: both crests and names large, the score as the figure,
 * the clock under it, the 5:00 as a line that fills and takes each goal at its
 * minute. Under it the goals, each on its side; then the team comparison (one
 * stat per row, the label in the centre, each side's value on its side, a
 * proportional bar under the row); then each team's players. Everything
 * climbs with the clock (liveModel.ts). Side A is blue and side B orange
 * unless a side says otherwise (the career gives the player's side orange).
 *
 * Motion sits where the event is: a score that changes, a goal that lands,
 * overtime. Nothing loops. Reduced motion (OS setting, `html.reduce-fx`,
 * `html.lite-fx`) shows the finished game at once: the same goals, minutes and
 * numbers, nothing moving.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MATCH_LIVE } from "@/config/balance";
import type { GameTimeline, TimelineGoal } from "@/engine/career/matchTimeline";
import { cx } from "@/lib/util";
import {
  formatLiveClock,
  goalsShown,
  linesAt,
  liveFrameAt,
  liveSchedule,
  sideTotals,
  type LiveFrame,
  type LiveLine,
  type LiveSide,
} from "./liveModel";
import { useMatchReducedMotion } from "./useMatchReducedMotion";

export type LiveTone = "blue" | "orange";

export interface LiveSideInfo {
  name: string;
  /** The side's crest / logo, already sized (40 to 64 px reads best). */
  mark?: ReactNode;
  players: string[];
  /** Side colour. Default: A blue, B orange. */
  tone?: LiveTone;
  /** The player's own side (its name carries the weight). */
  own?: boolean;
}

export interface LiveLabels {
  /** The head's kicker ("Game 2 · Best of 5"). */
  game: string;
  overtime: string;
  final: string;
  /** The team comparison's rows, in words. */
  strip: { shots: string; saves: string; assists: string; demos: string; score: string };
  /** The player table's column heads (short: "G", "A", "Sv", "Sh", "Pts"). */
  goals: string;
  assists: string;
  shots: string;
  saves: string;
  score: string;
  player: string;
  /** Screen-reader name of the running clock. */
  clock: string;
  /** Screen-reader line for a goal: "{scorer} scores, 2-1". */
  goalLine: (scorer: string, a: number, b: number) => string;
  noGoalsYet: string;
}

const TONE = {
  blue: { text: "text-blue-bright", bg: "bg-blue-bright", soft: "bg-blue-bright/25" },
  orange: { text: "text-orange-bright", bg: "bg-orange-bright", soft: "bg-orange-bright/25" },
} as const;

function toneOf(sides: Record<LiveSide, LiveSideInfo>, side: LiveSide): LiveTone {
  return sides[side].tone ?? (side === "a" ? "blue" : "orange");
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
    // The render already shows the end while jumping; only the loop's clock moves.
    if (!jump) return;
    elapsedRef.current = schedule.totalMs;
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
  const tones = { a: toneOf(sides, "a"), b: toneOf(sides, "b") };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="kicker">{labels.game}</p>
        {context ? <div className="text-sm text-sub">{context}</div> : null}
      </div>

      {/* The board: crests and names, the score, the clock. */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <SideName side={sides.a} tone={tones.a} align="left" />
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-3 sm:gap-4">
            {/* At the whistle the loser's figure steps back, so the end reads at a glance. */}
            <Score value={frame.score[0]} dim={frame.over && frame.score[0] < frame.score[1]} />
            <span className="text-3xl text-faint" aria-hidden>
              :
            </span>
            <Score value={frame.score[1]} dim={frame.over && frame.score[1] < frame.score[0]} />
          </div>
          <p
            className={cx(
              "display mt-2 text-2xl font-semibold leading-none tabular-nums sm:text-[28px]",
              frame.overtime && !frame.over ? "text-orange-bright" : frame.over ? "text-sub" : "text-ink",
            )}
            role="timer"
            aria-label={labels.clock}
          >
            <ClockText text={clockText} />
          </p>
          {frame.overtime ? (
            <p key="ot" className={cx("kicker mt-1.5 !text-orange-bright", !reduced && "pop-in")}>
              {labels.overtime}
            </p>
          ) : null}
        </div>
        <SideName side={sides.b} tone={tones.b} align="right" />
      </div>

      {/* The 5:00 as a line: it fills with the clock and each goal lands on it at its minute. */}
      <GameTrack frame={frame} goals={goals} tones={tones} reduced={reduced} />

      {/* The goals, in order, each on its side. */}
      <ol className="mx-auto mt-4 min-h-[3.5rem] max-w-md space-y-1" aria-live="polite" aria-relevant="additions">
        {goals.length === 0 ? <li className="text-center text-sm text-faint">{labels.noGoalsYet}</li> : null}
        {goals.map((g, i) => (
          <li
            key={i}
            className={cx(
              "flex items-baseline gap-2 text-sm",
              g.side === "b" && "flex-row-reverse text-right",
              g === lastGoal && !reduced && "pop-in",
            )}
          >
            <span className={cx("h-2 w-2 shrink-0 self-center rounded-[2px]", TONE[tones[g.side]].bg)} aria-hidden />
            <span className="display shrink-0 text-xs font-semibold tabular-nums text-faint">{formatLiveClock(g.period, g.clock)}</span>
            <span className="min-w-0 truncate text-ink">
              <span className="sr-only">{labels.goalLine(scorer(g.side, g.playerIdx), g.scoreAfter[0], g.scoreAfter[1])}</span>
              <span aria-hidden>{scorer(g.side, g.playerIdx)}</span>
            </span>
            <span className="display shrink-0 text-xs font-semibold tabular-nums text-sub" aria-hidden>
              {g.scoreAfter[0]}-{g.scoreAfter[1]}
            </span>
          </li>
        ))}
      </ol>

      {/* The team comparison: one stat a row, the label in the centre, each side on its side. */}
      {totals ? (
        <dl className="mx-auto mt-5 max-w-md space-y-2.5 border-t border-line pt-4">
          {(["shots", "saves", "assists", "demos", "score"] as const).map((k) => (
            <CompareRow key={k} label={labels.strip[k]} a={totals.a[k]} b={totals.b[k]} tones={tones} />
          ))}
        </dl>
      ) : null}

      {/* The players' numbers, climbing with the clock: each team on its side. */}
      {lines ? (
        <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-2 md:gap-6">
          {(["a", "b"] as const).map((side) => (
            <PlayerTable key={side} side={sides[side]} tone={tones[side]} lines={lines[side]} labels={labels} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SideName({ side, tone, align }: { side: LiveSideInfo; tone: LiveTone; align: "left" | "right" }) {
  return (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3", align === "right" && "sm:flex-row-reverse")}>
      {side.mark ? <span className="shrink-0">{side.mark}</span> : null}
      <div className={cx("min-w-0", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p className={cx("display break-words text-[15px] leading-tight sm:text-xl", side.own ? "font-bold text-ink" : "font-semibold text-ink")}>
          {side.name}
        </p>
        <span className={cx("mt-1.5 inline-block h-1 w-8 rounded-[1px]", TONE[tone].bg)} aria-hidden />
      </div>
    </div>
  );
}

/** One stat, broadcast style: A's value, the label, B's value; a bar split by share under it. */
function CompareRow({ label, a, b, tones }: { label: string; a: number; b: number; tones: Record<LiveSide, LiveTone> }) {
  const total = a + b;
  const shareA = total > 0 ? a / total : 0.5;
  return (
    <div>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-baseline">
        <dd className={cx("display text-left text-base font-semibold tabular-nums", a > b ? "text-ink" : "text-sub")}>{a}</dd>
        <dt className="kicker text-center">{label}</dt>
        <dd className={cx("display text-right text-base font-semibold tabular-nums", b > a ? "text-ink" : "text-sub")}>{b}</dd>
      </div>
      <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-[1px]" aria-hidden>
        <span className={cx("h-full transition-[width] duration-300", total > 0 ? TONE[tones.a].bg : "bg-line-strong")} style={{ width: `${shareA * 100}%` }} />
        <span className={cx("h-full flex-1", total > 0 ? TONE[tones.b].bg : "bg-line-strong")} />
      </div>
    </div>
  );
}

function PlayerTable({ side, tone, lines, labels }: { side: LiveSideInfo; tone: LiveTone; lines: LiveLine[]; labels: LiveLabels }) {
  const best = lines.reduce((m, l, i) => (l.score > lines[m].score ? i : m), 0);
  return (
    <table className="w-full table-fixed text-sm">
      <caption className="pb-2 text-left">
        <span className="flex items-center gap-2">
          <span className={cx("h-2 w-2 shrink-0 rounded-[2px]", TONE[tone].bg)} aria-hidden />
          <span className="display truncate text-[13px] font-semibold text-sub">{side.name}</span>
        </span>
      </caption>
      <thead>
        <tr className="kicker">
          <th scope="col" className="w-[40%] pb-1 text-left font-medium">
            <span className="sr-only">{labels.player}</span>
          </th>
          <th scope="col" className="pb-1 text-right font-medium">{labels.goals}</th>
          <th scope="col" className="pb-1 text-right font-medium">{labels.assists}</th>
          <th scope="col" className="pb-1 text-right font-medium">{labels.saves}</th>
          <th scope="col" className="hidden pb-1 text-right font-medium min-[400px]:table-cell">{labels.shots}</th>
          <th scope="col" className="pb-1 text-right font-medium">{labels.score}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-t border-line">
            <td className={cx("truncate py-1.5 pr-2", i === best && l.score > 0 ? "display font-semibold text-ink" : "text-ink")}>
              {side.players[i] ?? ""}
            </td>
            <td className={cx("py-1.5 text-right tabular-nums", l.goals > 0 ? cx("font-semibold", TONE[tone].text) : "text-sub")}>{l.goals}</td>
            <td className="py-1.5 text-right tabular-nums text-sub">{l.assists}</td>
            <td className="py-1.5 text-right tabular-nums text-sub">{l.saves}</td>
            <td className="hidden py-1.5 text-right tabular-nums text-sub min-[400px]:table-cell">{l.shots}</td>
            <td className="py-1.5 text-right tabular-nums text-ink">{l.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The regulation clock as a track. The filled part is the time played; each
 * goal shown sits on it at its minute in its side's tone. Overtime goals sit
 * at the end. It moves only with the clock, so a paused game holds it and
 * reduced motion shows it full.
 */
function GameTrack({
  frame,
  goals,
  tones,
  reduced,
}: {
  frame: LiveFrame;
  goals: TimelineGoal[];
  tones: Record<LiveSide, LiveTone>;
  reduced: boolean;
}) {
  const REG = 300;
  const played = frame.over || frame.period === "overtime" ? 1 : Math.min(1, Math.max(0, (REG - frame.clock) / REG));
  return (
    <div className="relative mx-auto mt-5 h-4 w-full max-w-md" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-[1px] bg-line-strong" />
      <div
        className={cx("absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-[1px]", frame.overtime ? "bg-orange-bright" : "bg-sub")}
        style={{ width: `${played * 100}%` }}
      />
      {goals.map((g, i) => {
        const at = g.period === "overtime" ? 1 : Math.min(1, Math.max(0, (REG - g.clock) / REG));
        return (
          <span
            key={i}
            className={cx(
              "absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-[1px]",
              TONE[tones[g.side]].bg,
              !reduced && i === goals.length - 1 && "pop-in",
            )}
            style={{ left: `${at * 100}%` }}
          />
        );
      })}
    </div>
  );
}

/** A score figure: re-keyed per value so a goal lands on it (and only then). */
function Score({ value, dim = false }: { value: number; dim?: boolean }) {
  return (
    <span
      key={value}
      className={cx(
        "display pop-in min-w-[1ch] text-center text-6xl font-bold leading-none tabular-nums transition-colors sm:text-7xl",
        dim ? "text-faint" : "text-ink",
      )}
    >
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
