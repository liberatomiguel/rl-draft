"use client";

/**
 * Road to Worlds hub — THE FINANCE BLOCK (rc.34 UX-01e, H5 / 4-A; rc.35:
 * Miguel found rc.34's rows too much text — "earlier was better"). Visual,
 * key numbers only: the balance with its week trend and the Monday line
 * (tap: rc.33's larger chart), then icon tiles for the next payroll, the
 * runway, and the debt when there is any. Everything else lives in
 * Finances (link). Figures from store/careerHq.hqFinanceOf.
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BankIcon, CalendarIcon, TrendIcon, WalletIcon } from "@/components/ui/icons";
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

/** One key number: icon, label, value. */
function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "bad" | "warn" | "good" }) {
  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2",
        tone === "bad" ? "border-bad/40 bg-bad/[0.06]" : tone === "warn" ? "border-orange/40 bg-orange/[0.05]" : "border-line bg-white/[0.02]",
      )}
    >
      <span
        className={cx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          tone === "bad" ? "bg-bad/15 text-bad" : tone === "warn" ? "bg-orange/15 text-orange-bright" : tone === "good" ? "bg-good/15 text-good" : "bg-cyan/10 text-cyan",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="kicker block truncate !text-[9px]">{label}</span>
        <span className="block truncate text-xs font-bold text-ink">{value}</span>
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
  const hasDebt = f.debt.backer !== null || f.debt.bankRemaining !== null;

  return (
    <Panel
      className={cx("rise-in p-4", f.balance < 0 ? "border-bad/40" : cashTight ? "border-orange/40" : "")}
      style={{ animationDelay: "120ms" }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="kicker inline-flex items-center gap-1.5 text-[10px]">
          <WalletIcon className="h-3.5 w-3.5 text-cyan" />
          {C.hub.financesTitle}
        </p>
        {f.debt.backer !== null ? (
          <Badge tone="orange">{C.finances.backer}</Badge>
        ) : f.debt.bankRemaining !== null ? (
          <Badge tone="blue">{C.finances.bankTitle}</Badge>
        ) : null}
      </div>
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

      {!ended ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile
            icon={<CalendarIcon className="h-4 w-4" />}
            label={C.hub.financePayroll}
            value={`${formatDateShort(D, dateOfDay(f.payroll.seasonIndex, f.payroll.day))} · ${money(f.payroll.amount)}`}
          />
          <Tile
            icon={<TrendIcon className="h-4 w-4" down={f.net < 0} />}
            label={C.hub.financeRunway}
            value={f.runway === null ? C.finances.runwayOk : C.finances.runway(f.runway)}
            tone={f.balance < 0 ? "bad" : cashTight ? "warn" : "good"}
          />
          {hasDebt ? (
            <div className="col-span-2">
              <Tile
                icon={<BankIcon className="h-4 w-4" />}
                label={C.hub.financeDebt}
                value={money((f.debt.backer ?? 0) + (f.debt.bankRemaining ?? 0))}
                tone="warn"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <AppLink href="/career/finances" className="mt-2 flex min-h-11 items-center justify-end text-xs font-semibold text-blue-bright hover:underline">
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
