"use client";

/**
 * Road to Worlds hub — THE FINANCE BLOCK (rc.34, ROADMAP UX-01e;
 * HQ-CONTRACT H5, decision 4-A). Money is honest: only booked or committed
 * figures — the balance, next Monday's net and the runway, the next payroll
 * (its date and the week's expenses), the guaranteed income a week, the debt
 * and the balance at the split's end with no prize counted — every one from
 * store/careerHq.hqFinanceOf, which reads the Finances desk's own functions.
 * The small line is the last CAREER_HQ.tileChartWeeks Mondays the save
 * recorded (mondayBalancesOf, rc.33's ring); a tap opens rc.33's larger
 * chart (BalanceHistory, the whole ring) in the portal Modal.
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 border-t border-line/50 py-1.5 text-xs">
      <span className="kicker w-20 shrink-0 !text-[9px] sm:w-24">{label}</span>
      <span className="min-w-0 flex-1 text-sub">{children}</span>
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
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.financesTitle}</p>
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
            <p className="mt-1.5 text-xs text-sub">
              <span className={f.net >= 0 ? "text-good" : "text-bad"}>{C.hub.financePerWeek(formatMoneyDelta(f.net, { compact: true }))}</span>
              <span className="text-faint"> · {f.runway === null ? C.finances.runwayOk : C.finances.runway(f.runway)}</span>
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
        <div className="mt-3">
          <Row label={C.hub.financePayroll}>
            {formatDateShort(D, dateOfDay(f.payroll.seasonIndex, f.payroll.day))} · {money(f.payroll.amount)}
          </Row>
          <Row label={C.hub.financeGuaranteed}>
            <span className="font-semibold text-good">{C.hub.financePerWeek(money(f.guaranteed.total))}</span>
            <span className="block text-[11px] text-faint">
              {C.hub.financeGuaranteedParts(money(f.guaranteed.sponsor), money(f.guaranteed.partner), money(f.guaranteed.fans))}
              {f.guaranteed.partnerMondays !== null ? ` (${C.hub.financePartnerWeeks(f.guaranteed.partnerMondays)})` : ""}
            </span>
          </Row>
          <Row label={C.hub.financeDebt}>
            {f.debt.backer === null && f.debt.bankRemaining === null ? (
              C.hub.financeDebtNone
            ) : (
              <>
                {f.debt.backer !== null ? (
                  <span className="font-semibold text-orange-bright">{C.hub.financeDebtBacker(money(f.debt.backer))}</span>
                ) : null}
                {f.debt.backer !== null && f.debt.bankRemaining !== null ? " · " : null}
                {f.debt.bankRemaining !== null ? C.hub.financeDebtBank(money(f.debt.bankRemaining), money(f.debt.bankNext ?? 0)) : null}
              </>
            )}
          </Row>
          <Row label={C.hub.financeProjection}>
            <span className={f.projection.balance < 0 ? "text-bad" : undefined}>
              {C.hub.financeProjectionLine(
                formatDateShort(D, dateOfDay(f.projection.seasonIndex, f.projection.day)),
                f.projection.mondays,
                money(f.projection.balance),
              )}
            </span>
          </Row>
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
