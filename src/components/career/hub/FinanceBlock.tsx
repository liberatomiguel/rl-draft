"use client";

/**
 * Road to Worlds hub — THE FINANCE BLOCK (rc.34 UX-01e, H5 / 4-A; rc.35:
 * Miguel found rc.34's rows too much text — "earlier was better"). Visual,
 * key numbers only: the balance with its week trend and the Monday line
 * (tap: rc.33's larger chart). Everything else lives in Finances (link).
 * Figures from store/careerHq.hqFinanceOf.
 * rc.36 (POL-02, Miguel on rc.35): only the balance, the weekly out, the
 * chart, and the next-payroll and runway LINES — full-width icon lines
 * instead of rc.35's tiles (which truncated at 360 px), no debt tile or
 * badge (the emergency loan keeps its own HQ card, NowCards' DebtCard).
 */

import { useMemo, useState } from "react";
import { CAREER_HQ, CAREER_PAYROLL } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { mondayBalancesOf } from "@/store/careerFlow";
import { hqFinanceOf } from "@/store/careerHq";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { BalanceHistory } from "@/components/career/finances/BalanceHistory";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CalendarIcon, HourglassIcon, TrendIcon, WalletIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";

/** A small line of the recorded Monday balances (no axes; the chart opens larger). */
function MondayLine({ points }: { points: number[] }) {
  const W = 120;
  const H = 32;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / span) * H;
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28" aria-hidden preserveAspectRatio="none">
      {min < 0 ? <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-white/20" strokeDasharray="2 3" /> : null}
      <path d={d} fill="none" strokeWidth={1.6} className={last < 0 ? "stroke-bad" : "stroke-cyan"} />
    </svg>
  );
}

/** rc.36: one full-width line — icon, label, the value on the right (toned when it warns). */
function Line({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "bad" | "warn" | "good" }) {
  return (
    <div className="flex min-h-10 items-center gap-2.5 py-1.5">
      <span
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          tone === "bad" ? "bg-bad/15 text-bad" : tone === "warn" ? "bg-orange/15 text-orange-bright" : tone === "good" ? "bg-good/15 text-good" : "bg-cyan/10 text-cyan",
        )}
      >
        {icon}
      </span>
      <span className="kicker shrink-0 !text-[9px]">{label}</span>
      <span
        className={cx(
          "ml-auto min-w-0 truncate text-right text-xs font-semibold",
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-orange-bright" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function FinanceBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const [chartOpen, setChartOpen] = useState(false);
  const f = useMemo(() => hqFinanceOf(save), [save]);
  const ring = mondayBalancesOf(save);
  const line = ring.slice(-CAREER_HQ.tileChartWeeks).map((m) => m.b);
  const D = C.dates;
  const money = (n: number) => formatMoney(n, { compact: true });
  const cashTight = f.runway !== null && f.runway <= CAREER_PAYROLL.runwayWarnWeeks;
  const ended = save.phase === "ended";

  return (
    <Panel
      className={cx("rise-in p-4", f.balance < 0 ? "border-bad/40" : cashTight ? "border-orange/40" : "")}
      style={{ animationDelay: "120ms" }}
    >
      <p className="kicker mb-1 inline-flex items-center gap-1.5 text-[10px]">
        <WalletIcon className="h-3.5 w-3.5 text-cyan" />
        {C.hub.financesTitle}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("display text-2xl font-bold leading-none", f.balance < 0 ? "text-bad" : "text-ink")}>{money(f.balance)}</p>
          {!ended ? (
            <p className={cx("mt-1.5 inline-flex items-center gap-1 text-xs font-semibold", f.net >= 0 ? "text-good" : "text-bad")}>
              <TrendIcon className="h-3.5 w-3.5" down={f.net < 0} />
              {C.hub.financePerWeek(formatMoneyDelta(f.net, { compact: true }))}
            </p>
          ) : null}
        </div>
        {/* decision 4-A: the recorded Mondays; the tap opens rc.33's chart. */}
        <button
          type="button"
          onClick={() => setChartOpen(true)}
          aria-label={C.finances.chartOpen}
          title={C.finances.chartOpen}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-line px-1.5 transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-cyan/60"
        >
          {line.length >= 2 ? <MondayLine points={line} /> : <span className="px-1 text-[10px] text-faint">{C.finances.chartTitle}</span>}
        </button>
      </div>

      {/* rc.36: the next payroll and the runway as two full-width lines. */}
      {!ended ? (
        <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white/[0.02] px-2.5">
          <Line
            icon={<CalendarIcon className="h-4 w-4" />}
            label={C.hub.financePayroll}
            value={`${formatDateShort(D, dateOfDay(f.payroll.seasonIndex, f.payroll.day))} · ${money(f.payroll.amount)}`}
          />
          <Line
            icon={<HourglassIcon className="h-4 w-4" />}
            label={C.hub.financeRunway}
            value={f.runway === null ? C.hub.financeRunwayOk : C.hub.financeRunwayWeeks(f.runway)}
            tone={f.balance < 0 ? "bad" : cashTight ? "warn" : "good"}
          />
        </div>
      ) : null}

      <AppLink href="/career/finances" className="mt-1 flex min-h-11 items-center justify-end text-xs font-semibold text-blue-bright hover:underline">
        {C.hub.financesOpen} →
      </AppLink>

      {/* rc.33 (UX-07): the larger chart (portal Modal; 360 px, no horizontal scroll). */}
      <Modal
        open={chartOpen}
        title={C.finances.chartTitle}
        onClose={() => setChartOpen(false)}
        wide
        actions={
          <Button variant="secondary" className="min-h-11" onClick={() => setChartOpen(false)}>
            {C.finances.chartClose}
          </Button>
        }
      >
        <BalanceHistory ring={ring} />
      </Modal>
    </Panel>
  );
}
