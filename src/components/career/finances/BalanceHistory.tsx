"use client";

/**
 * Road to Worlds — rc.33 (UX-07): the expanded balance chart, opened from the
 * Finances sparkline. It draws the Monday balances the save recorded
 * (careerFlow.mondayBalancesOf, HQ-CONTRACT decision 4-A — nothing invented),
 * the Backer's floor where a Monday recorded it, $0, the season starts and
 * the low / high Mondays. A crosshair follows the pointer, the finger or the
 * arrow keys; the per-season table below is the same data as text.
 * Geometry: ./balanceChart.ts (pure). Drawn at the container's measured
 * width, so text never scales and nothing overflows at 360 px.
 */

import { useEffect, useRef, useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { dateOfDay, firstDayOfWeek, seasonLabelFor } from "@/engine/career/calendar";
import type { MondayBalance } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { formatDateTiny } from "@/components/career/dateText";
import { balanceChartModel, nearestPoint, seasonSummaries } from "./balanceChart";

const HEIGHT = 200;
const TOOLTIP_WIDTH = 132;
/** Narrowest season band that still gets its label (px). */
const SEASON_LABEL_MIN = 64;

/** The container's width (a ResizeObserver), so the chart draws 1:1 in px. */
function useWidth(ref: React.RefObject<HTMLDivElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setWidth(Math.max(200, Math.floor(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export function BalanceHistory({ ring }: { ring: readonly MondayBalance[] }) {
  const C = useCareerCopy();
  const D = C.dates;
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useWidth(boxRef, 280);
  const [active, setActive] = useState<number | null>(null);
  const model = balanceChartModel(ring, width, HEIGHT);

  if (!model || model.points.length < 2) {
    return <p className="text-xs text-faint">{C.finances.chartEmpty}</p>;
  }

  const money = (n: number) => formatMoney(n, { compact: true });
  const when = (s: number, w: number) => `${formatDateTiny(D, dateOfDay(s, firstDayOfWeek(w)))} · ${C.hub.week(w)}`;
  const { points, plot } = model;
  const first = points[0];
  const last = points[points.length - 1];
  const low = points[model.low];
  const high = points[model.high];
  const summary = C.finances.chartSummary(points.length, money(first.balance), money(last.balance), money(low.balance), money(high.balance));
  const act = active === null ? null : (points[active] ?? null);
  const describe = (i: number) => {
    const p = points[i];
    return `${seasonLabelFor(p.s)} · ${when(p.s, p.w)}: ${money(p.balance)}${p.floor !== undefined ? ` · ${C.finances.chartFloor(money(p.floor))}` : ""}`;
  };

  const pointAt = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setActive(nearestPoint(model, clientX - box.left));
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = active ?? points.length - 1;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -points.length, End: points.length };
    if (!(e.key in step)) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(points.length - 1, at + step[e.key])));
  };
  const tipLeft = act ? Math.max(0, Math.min(width - TOOLTIP_WIDTH, act.x - TOOLTIP_WIDTH / 2)) : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-sub">{C.finances.chartRange(points.length, when(first.s, first.w), when(last.s, last.w))}</p>

      {/* Legend: the balance, the floor and the season starts — never colour alone. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sub">
        <li className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden className="shrink-0">
            <line x1="1" y1="4" x2="17" y2="4" className="stroke-cyan" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {C.finances.chartLegendBalance}
        </li>
        {model.floorPath ? (
          <li className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden className="shrink-0">
              <line x1="1" y1="4" x2="17" y2="4" className="stroke-bad" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            {C.finances.chartLegendFloor}
          </li>
        ) : null}
        {model.seasonStarts.length > 0 ? (
          <li className="flex items-center gap-1.5">
            <svg width="8" height="12" aria-hidden className="shrink-0">
              <line x1="4" y1="0" x2="4" y2="12" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            </svg>
            {C.finances.chartLegendSeason}
          </li>
        ) : null}
      </ul>

      <div
        ref={boxRef}
        role="group"
        aria-label={summary}
        tabIndex={0}
        className="relative w-full touch-pan-y select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
        onPointerMove={(e) => pointAt(e.clientX)}
        onPointerDown={(e) => pointAt(e.clientX)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden className="block">
          {/* Recessive grid: the top, $0 and the bottom of what was recorded. */}
          {model.yTicks.map((t) => (
            <g key={`y${t.v}`}>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={t.y}
                y2={t.y}
                stroke={t.v === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)"}
                strokeWidth="1"
                strokeDasharray={t.v === 0 ? "3 3" : undefined}
              />
              <text x={plot.left - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize="10" className="fill-faint">
                {money(t.v)}
              </text>
            </g>
          ))}

          {/* Season starts, each band labelled when it has the room. */}
          {model.seasonStarts.map((b) => (
            <line key={`s${b.s}`} x1={b.x} x2={b.x} y1={plot.top - 6} y2={plot.bottom} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          ))}
          {model.seasonBands
            .filter((band, k) => model.seasonBands.length === 1 || band.x1 - band.x0 >= SEASON_LABEL_MIN || (k === model.seasonBands.length - 1 && plot.right - band.x0 >= SEASON_LABEL_MIN))
            .map((band) => (
              <text key={`l${band.s}`} x={band.x0 + 4} y={12} fontSize="10" className="fill-faint">
                {seasonLabelFor(band.s)}
              </text>
            ))}

          {/* The Backer's floor (a Monday below it is a breach). */}
          {model.floorPath ? (
            <path d={model.floorPath} fill="none" className="stroke-bad" strokeWidth="1.5" strokeDasharray="4 3" />
          ) : null}

          {/* The balance after each Monday's payroll. */}
          {model.lines.map((pts, k) => (
            <polyline key={`b${k}`} points={pts} fill="none" className="stroke-cyan" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Selective direct labels: the low and the high Monday. */}
          {[
            { p: high, text: C.finances.chartHigh(money(high.balance)), dy: -8 },
            { p: low, text: C.finances.chartLow(money(low.balance)), dy: 14 },
          ]
            .filter((l, k) => k === 0 || model.low !== model.high)
            .map(({ p, text, dy }) => (
              <text
                key={`d${p.i}${dy}`}
                x={Math.max(plot.left + 2, Math.min(plot.right - 2, p.x))}
                y={Math.max(plot.top + 8, Math.min(plot.bottom - 2, p.y + dy))}
                textAnchor={p.x < plot.left + 60 ? "start" : p.x > plot.right - 60 ? "end" : "middle"}
                fontSize="10"
                className="fill-sub"
              >
                {text}
              </text>
            ))}

          {/* The crosshair, or the latest Monday's marker. */}
          {act ? (
            <g>
              <line x1={act.x} x2={act.x} y1={plot.top} y2={plot.bottom} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <circle cx={act.x} cy={act.y} r="4.5" className="fill-cyan" style={{ stroke: "var(--panel-strong)" }} strokeWidth="2" />
              {act.fy !== undefined ? <circle cx={act.x} cy={act.fy} r="3" className="fill-bad" /> : null}
            </g>
          ) : (
            <circle cx={last.x} cy={last.y} r="4" className="fill-cyan" style={{ stroke: "var(--panel-strong)" }} strokeWidth="2" />
          )}
        </svg>

        {act ? (
          <div
            className="pointer-events-none absolute top-0 rounded-md border border-line-strong bg-panel-strong px-2 py-1.5 text-[11px] leading-snug shadow-lg"
            style={{ left: tipLeft, width: TOOLTIP_WIDTH }}
          >
            <p className="text-faint">{seasonLabelFor(act.s)}</p>
            <p className="text-sub">{when(act.s, act.w)}</p>
            <p className={cx("display text-sm font-bold", act.balance < 0 ? "text-bad" : "text-ink")}>{money(act.balance)}</p>
            {act.floor !== undefined ? <p className="text-faint">{C.finances.chartFloor(money(act.floor))}</p> : null}
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {act ? describe(act.i) : ""}
      </p>

      {/* The same data as text: one row per season on the chart. */}
      <table className="w-full table-fixed text-left text-[11px]">
        <thead className="text-faint">
          <tr>
            <th className="w-[34%] py-1 font-semibold">{C.finances.chartColSeason}</th>
            <th className="py-1 font-semibold">{C.finances.chartColLow}</th>
            <th className="py-1 font-semibold">{C.finances.chartColHigh}</th>
            <th className="py-1 text-right font-semibold">{C.finances.chartColLast}</th>
          </tr>
        </thead>
        <tbody className="text-sub">
          {seasonSummaries(ring).map((row) => (
            <tr key={row.s} className="border-t border-line/50">
              <td className="py-1 pr-1 text-ink">{seasonLabelFor(row.s)}</td>
              <td className={cx("py-1 font-mono", row.low < 0 && "text-bad")}>{money(row.low)}</td>
              <td className="py-1 font-mono">{money(row.high)}</td>
              <td className={cx("py-1 text-right font-mono", row.last < 0 && "text-bad")}>{money(row.last)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
