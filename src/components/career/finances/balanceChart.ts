/**
 * Road to Worlds — rc.33 (UX-07): the expanded balance chart's geometry.
 *
 * Pure: the Monday ring (economy.recordMondayBalance, read through
 * careerFlow.mondayBalancesOf) → pixel geometry for one width. Nothing is
 * invented: x is the real week (season × weeksPerSeason + week), a missing
 * Monday breaks the line, the floor is drawn only where a Monday recorded it.
 */

import { CAREER_PAYROLL } from "@/config/balance";
import type { MondayBalance } from "@/engine/career/types";

export interface ChartPoint {
  /** Index in the ring. */
  i: number;
  s: number;
  w: number;
  balance: number;
  floor?: number;
  x: number;
  y: number;
  /** y of the floor that Monday (absent when the ring has none). */
  fy?: number;
}

export interface BalanceChartModel {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  points: ChartPoint[];
  /** Polyline `points` strings, one per run of consecutive Mondays. */
  lines: string[];
  /** SVG path of the floor as a step line (null: no Monday recorded one). */
  floorPath: string | null;
  /** y of $0 ($0 is always inside the domain). */
  zeroY: number;
  /** The first Monday of each season after the first one on the chart. */
  seasonStarts: { x: number; s: number }[];
  /** Where each season's band starts and ends (labels go inside). */
  seasonBands: { s: number; x0: number; x1: number }[];
  /** Indexes of the lowest and the highest Monday (the direct labels). */
  low: number;
  high: number;
  /** The y-axis values the chart labels: the domain's top, $0 and its bottom. */
  yTicks: { v: number; y: number }[];
}

/** Margins: room for the y labels on the left and the season labels on top. */
export const CHART_MARGIN = { left: 46, right: 10, top: 20, bottom: 10 } as const;

const absWeek = (m: Pick<MondayBalance, "s" | "w">): number => m.s * CAREER_PAYROLL.weeksPerSeason + (m.w - 1);

/** The geometry of `ring` (oldest first) drawn `width` × `height` px; null when it holds no Monday. */
export function balanceChartModel(ring: readonly MondayBalance[], width: number, height: number): BalanceChartModel | null {
  if (ring.length === 0) return null;
  const plot = {
    left: CHART_MARGIN.left,
    right: Math.max(CHART_MARGIN.left + 1, width - CHART_MARGIN.right),
    top: CHART_MARGIN.top,
    bottom: Math.max(CHART_MARGIN.top + 1, height - CHART_MARGIN.bottom),
  };
  const weeks = ring.map(absWeek);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const values = [0, ...ring.map((m) => m.b), ...ring.flatMap((m) => (m.f === undefined ? [] : [m.f]))];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max(1, (hi - lo) * 0.06);
  lo -= pad;
  hi += pad;
  const x = (a: number) =>
    last === first ? (plot.left + plot.right) / 2 : plot.left + ((a - first) / (last - first)) * (plot.right - plot.left);
  const y = (v: number) => plot.bottom - ((v - lo) / (hi - lo)) * (plot.bottom - plot.top);

  const points: ChartPoint[] = ring.map((m, i) => ({
    i,
    s: m.s,
    w: m.w,
    balance: m.b,
    floor: m.f,
    x: x(weeks[i]),
    y: y(m.b),
    fy: m.f === undefined ? undefined : y(m.f),
  }));

  // A missing Monday (more than one week between two records) breaks the line.
  const lines: string[] = [];
  let run: ChartPoint[] = [];
  points.forEach((p, i) => {
    if (i > 0 && weeks[i] - weeks[i - 1] > 1) {
      lines.push(run.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" "));
      run = [];
    }
    run.push(p);
  });
  lines.push(run.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" "));

  // The floor as a step line: each Monday's floor holds until the next recorded one.
  let floorPath = "";
  points.forEach((p, i) => {
    if (p.fy === undefined) return;
    const prev = points[i - 1];
    const joined = prev?.fy !== undefined && weeks[i] - weeks[i - 1] === 1;
    floorPath += joined ? ` H${p.x.toFixed(1)} V${p.fy.toFixed(1)}` : ` M${p.x.toFixed(1)},${p.fy.toFixed(1)}`;
  });
  const nextX = (i: number) => (i + 1 < points.length && weeks[i + 1] - weeks[i] === 1 ? points[i + 1].x : points[i].x);
  // The last recorded floor of a run reaches to the next Monday's x (or ends at its own).
  if (points.length > 0 && points[points.length - 1].fy !== undefined) floorPath += ` H${nextX(points.length - 1).toFixed(1)}`;

  const seasonStarts = points.filter((p, i) => i > 0 && p.s !== points[i - 1].s).map((p) => ({ x: p.x, s: p.s }));
  const seasonBands: BalanceChartModel["seasonBands"] = [];
  for (const p of points) {
    const band = seasonBands[seasonBands.length - 1];
    if (!band || band.s !== p.s) seasonBands.push({ s: p.s, x0: p.x, x1: p.x });
    else band.x1 = p.x;
  }

  let low = 0;
  let high = 0;
  points.forEach((p, i) => {
    if (p.balance < points[low].balance) low = i;
    if (p.balance > points[high].balance) high = i;
  });

  const maxV = Math.max(...points.map((p) => p.balance), 0);
  const minV = Math.min(...values);
  const yTicks = [{ v: maxV, y: y(maxV) }];
  if (maxV !== 0) yTicks.push({ v: 0, y: y(0) });
  if (minV < 0) yTicks.push({ v: minV, y: y(minV) });

  return {
    width,
    height,
    plot,
    points,
    lines,
    floorPath: floorPath ? floorPath.trim() : null,
    zeroY: y(0),
    seasonStarts,
    seasonBands,
    low,
    high,
    yTicks,
  };
}

/** The Monday nearest to `px` (the crosshair under a pointer). */
export function nearestPoint(model: BalanceChartModel, px: number): number {
  let best = 0;
  model.points.forEach((p, i) => {
    if (Math.abs(p.x - px) < Math.abs(model.points[best].x - px)) best = i;
  });
  return best;
}

/** One row per season on the chart: its Mondays, low, high and last balance (the table view). */
export function seasonSummaries(ring: readonly MondayBalance[]): { s: number; mondays: number; low: number; high: number; last: number }[] {
  const rows: { s: number; mondays: number; low: number; high: number; last: number }[] = [];
  for (const m of ring) {
    const row = rows[rows.length - 1];
    if (!row || row.s !== m.s) rows.push({ s: m.s, mondays: 1, low: m.b, high: m.b, last: m.b });
    else {
      row.mondays += 1;
      row.low = Math.min(row.low, m.b);
      row.high = Math.max(row.high, m.b);
      row.last = m.b;
    }
  }
  return rows;
}
