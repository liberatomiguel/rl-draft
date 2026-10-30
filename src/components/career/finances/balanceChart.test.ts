import { describe, expect, it } from "vitest";
import { CAREER_PAYROLL } from "@/config/balance";
import type { MondayBalance } from "@/engine/career/types";
import { CHART_MARGIN, CHART_MIN_WIDTH, balanceChartModel, nearestPoint, observeWidth, seasonSummaries } from "./balanceChart";

/** Mondays of season 0 weeks 30–32, then season 1 weeks 1–3 (consecutive), the floor recorded from week 31. */
const RING: MondayBalance[] = [
  { s: 0, w: 30, b: 5_000 },
  { s: 0, w: 31, b: 2_000, f: -4_000 },
  { s: 0, w: 32, b: -1_000, f: -4_000 },
  { s: 1, w: 1, b: -3_500, f: -4_500 },
  { s: 1, w: 2, b: 3_000, f: -4_500 },
  { s: 1, w: 3, b: 8_000, f: -4_500 },
];

describe("rc.33 UX-07 — the balance chart's geometry", () => {
  it("draws every Monday inside the plot at the given width (360 px fits, nothing outside)", () => {
    const m = balanceChartModel(RING, 280, 200)!;
    expect(m.points).toHaveLength(RING.length);
    for (const p of m.points) {
      expect(p.x).toBeGreaterThanOrEqual(CHART_MARGIN.left);
      expect(p.x).toBeLessThanOrEqual(280 - CHART_MARGIN.right);
      expect(p.y).toBeGreaterThanOrEqual(CHART_MARGIN.top);
      expect(p.y).toBeLessThanOrEqual(200 - CHART_MARGIN.bottom);
    }
    // x follows the real weeks across the season end: equal steps.
    const dx = m.points.slice(1).map((p, i) => p.x - m.points[i].x);
    for (const d of dx) expect(d).toBeCloseTo(dx[0], 6);
    // One run, $0 inside the domain, the low and high Mondays found.
    expect(m.lines).toHaveLength(1);
    expect(m.zeroY).toBeGreaterThan(m.plot.top);
    expect(m.zeroY).toBeLessThan(m.plot.bottom);
    expect(m.points[m.low].balance).toBe(-3_500);
    expect(m.points[m.high].balance).toBe(8_000);
    expect(m.yTicks.map((t) => t.v)).toEqual([8_000, 0, -4_500]);
  });

  it("marks the season start and draws the floor only where a Monday recorded it", () => {
    const m = balanceChartModel(RING, 300, 200)!;
    expect(m.seasonStarts).toEqual([{ x: m.points[3].x, s: 1 }]);
    expect(m.seasonBands.map((b) => b.s)).toEqual([0, 1]);
    expect(m.floorPath).not.toBeNull();
    // It starts at week 31 (the first recorded floor), never at week 30.
    expect(m.floorPath!.startsWith(`M${m.points[1].x.toFixed(1)},`)).toBe(true);
    // A ring with no floor at all (seeded from an older save's ledger) draws none.
    expect(balanceChartModel(RING.map(({ s, w, b }) => ({ s, w, b })), 300, 200)!.floorPath).toBeNull();
  });

  it("a missing Monday breaks the line — nothing is invented between two records", () => {
    const gap: MondayBalance[] = [...RING.slice(0, 2), { s: 1, w: 6, b: 0 }]; // season 1's weeks 1–5 are missing
    expect(balanceChartModel(gap, 300, 200)!.lines).toHaveLength(2);
    expect(balanceChartModel([], 300, 200)).toBeNull();
    const one = balanceChartModel([{ s: 0, w: 1, b: 12_000 }], 300, 200)!;
    expect(one.points[0].x).toBeCloseTo((one.plot.left + one.plot.right) / 2, 6);
  });

  it("the crosshair picks the nearest Monday; the table view sums each season", () => {
    const m = balanceChartModel(RING, 300, 200)!;
    expect(nearestPoint(m, 0)).toBe(0);
    expect(nearestPoint(m, 10_000)).toBe(RING.length - 1);
    expect(nearestPoint(m, m.points[3].x + 1)).toBe(3);
    expect(seasonSummaries(RING)).toEqual([
      { s: 0, mondays: 3, low: -1_000, high: 5_000, last: -1_000 },
      { s: 1, mondays: 3, low: -3_500, high: 8_000, last: 8_000 },
    ]);
  });

  it("a full ring of balanceRingWeeks Mondays still fits 280 px with distinct x per Monday", () => {
    const ring: MondayBalance[] = Array.from({ length: CAREER_PAYROLL.balanceRingWeeks }, (_, i) => ({
      s: Math.floor(i / CAREER_PAYROLL.weeksPerSeason),
      w: (i % CAREER_PAYROLL.weeksPerSeason) + 1,
      b: Math.round(Math.sin(i / 5) * 20_000),
    }));
    const m = balanceChartModel(ring, 280, 200)!;
    expect(m.lines).toHaveLength(1);
    expect(m.seasonStarts).toHaveLength(2);
    expect(Math.max(...m.points.map((p) => p.x))).toBeLessThanOrEqual(280 - CHART_MARGIN.right);
    expect(new Set(m.points.map((p) => p.x.toFixed(2))).size).toBe(ring.length);
  });
});

describe("rc.33 review — the chart box is measured on mount and on every resize", () => {
  it("observeWidth measures now, again on each resize, and stops on disconnect", () => {
    const el = { clientWidth: 512.7 } as unknown as Element & { clientWidth: number };
    const widths: number[] = [];
    let fire: (() => void) | null = null;
    let observed: Element | null = null;
    let disconnected = false;
    const stop = observeWidth(el, (w) => widths.push(w), (cb) => {
      fire = cb;
      return {
        observe: (target) => {
          observed = target;
        },
        disconnect: () => {
          disconnected = true;
        },
      };
    });
    expect(widths).toEqual([512]);
    expect(observed).toBe(el);
    (el as { clientWidth: number }).clientWidth = 340;
    fire!();
    (el as { clientWidth: number }).clientWidth = 120;
    fire!();
    expect(widths).toEqual([512, 340, CHART_MIN_WIDTH]);
    stop();
    expect(disconnected).toBe(true);
    // No ResizeObserver: one measurement, nothing to disconnect.
    const once: number[] = [];
    observeWidth(el, (w) => once.push(w), null)();
    expect(once).toEqual([CHART_MIN_WIDTH]);
  });
});
