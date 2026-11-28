"use client";

/**
 * rc9 ORG-UI (#272): an established org's money, read from `seasonMoneyOf`
 * (R223). Second pass after Miguel saw the first (27/11: "falta um número
 * grande com o orçamento como era antes ... muitos textos explicativos"):
 *
 *  - The lead block: the board's budget as THE figure of the screen, the cash
 *    beside it as the second figure, and one bar that shows how the season's
 *    money (cash + income still contracted) splits: still to pay, kept back by
 *    the mandate, free to spend. The keys under the bar carry the figures, so
 *    the sum reconciles on screen without a sentence.
 *  - Three blocks under it, each led by its own figure: income to come, costs
 *    still to pay (their lines as rows), the wage bill against the ceiling.
 *
 * At most one short line per block. Replaces rc.6's `SeasonBudget` and the
 * founded club's three-figure strip on the established path.
 */

import type { ReactNode } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { seasonBudgetOf, seasonMoneyOf } from "@/engine/career/budget";
import { nextPaydayFor } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { weeklyStatementOf } from "@/store/careerFlow";
import { dateOfDay, seasonLabelFor } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { commitmentRowsOf } from "./budgetLines";

const compact = (n: number) => formatMoney(n, { compact: true });

/** The bar's parts: still to pay (information blue), kept back (quiet), free (gain green), short (loss red). */
const SEG = { committed: "bg-blue-bright/70", kept: "bg-sub/60", free: "bg-good/80", short: "bg-bad/80" } as const;

function Key({ tone, label, value, valueTone = "text-ink" }: { tone: string; label: string; value: string; valueTone?: string }) {
  return (
    <div className="min-w-0 max-sm:flex max-sm:min-h-11 max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:border-b max-sm:border-line max-sm:last:border-b-0">
      <p className={cx("display text-xl font-bold leading-none tabular-nums sm:text-2xl max-sm:order-2", valueTone)}>{value}</p>
      <p className="flex items-center gap-1.5 text-xs text-sub sm:mt-1.5 max-sm:order-1">
        <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-[2px]", tone)} />
        {label}
      </p>
    </div>
  );
}

/** A block under the lead: its title, its figure, then its rows or its meter. */
function Block({ title, figure, tone = "text-ink", line, children }: { title: string; figure: string; tone?: string; line?: ReactNode; children?: ReactNode }) {
  return (
    <section className="panel min-w-0 p-4 sm:p-5">
      <h3 className="card-title">{title}</h3>
      <p className={cx("display mt-3 text-3xl font-bold leading-none tabular-nums", tone)}>{figure}</p>
      {line ? <p className="mt-1.5 text-xs text-faint">{line}</p> : null}
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: { key: string; label: string; amount: number }[] }) {
  if (!rows.length) return null;
  return (
    <ul className="mt-4 border-t border-line">
      {rows.map((r) => (
        <li key={r.key} className="flex min-h-10 items-center justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
          <span className="min-w-0 text-sub">{r.label}</span>
          <span className="shrink-0 tabular-nums text-ink">{compact(r.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SeasonMoneyBoard({ save, C, onChart, className }: { save: CareerSave; C: CareerCopy; onChart: () => void; className?: string }) {
  const m = seasonMoneyOf(save);
  const b = seasonBudgetOf(save);
  if (!m || !b) return null;
  const M = C.orgmode.money;
  const T = C.orgmode.budget;
  const pending = !m.budget.paid;
  const ended = save.phase === "ended";

  // The season's money: the cash, the board's budget while it is still to be paid, the income to come.
  const pool = m.cash + (pending ? m.budget.amount : 0) + m.incomeToCome.total;
  const kept = pending ? 0 : m.keepBack.amount;
  const free = pool - m.commitments.total - kept;
  const short = free < 0;
  const scale = Math.max(1, pool, m.commitments.total + kept);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / scale) * 100))}%`;

  const st = weeklyStatementOf(save);
  const payday = nextPaydayFor(save.clock);
  const ceiling = b.wageCeiling;
  const income = [
    { key: "sponsor", label: M.sponsor, amount: m.incomeToCome.sponsor },
    { key: "fanbase", label: M.fanbase, amount: m.incomeToCome.fanbase },
  ].filter((r) => r.amount > 0);

  return (
    <div id="career-season-budget" data-tour="finances-overview" className={cx("min-w-0 scroll-mt-44 space-y-4", className)}>
      {/* ---- The lead: the budget, the cash, the bar of the season's money ---- */}
      <section aria-labelledby="season-money-title" className="panel-strong min-w-0 p-4 sm:p-6">
        <div className="card-head">
          <h2 id="season-money-title" className="card-title">{M.title}</h2>
          <p className="shrink-0 text-right text-xs text-sub max-sm:hidden sm:text-sm">{T.when(seasonLabelFor(m.seasonIndex), b.mondaysLeft)}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-12 gap-y-5">
          <div className="min-w-0">
            <p className={cx("display text-5xl font-bold leading-none tabular-nums sm:text-6xl", pending ? "text-faint" : "text-ink")}>{compact(m.budget.amount)}</p>
            <p className="mt-2 text-sm text-sub">{pending ? M.budgetProposed : M.budgetLabel}</p>
            {pending ? (
              <AppLink href="/career/board" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">{M.readMandate}</AppLink>
            ) : b.bonusAtStake > 0 ? (
              <p className="mt-0.5 text-xs text-faint">{M.bonusIfMet(compact(b.bonusAtStake))}</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className={cx("display text-3xl font-bold leading-none tabular-nums sm:text-4xl", m.cash < 0 ? "text-bad" : "text-ink")}>{compact(m.cash)}</p>
            <p className="mt-2 text-sm text-sub">{M.cash}</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto max-sm:-ml-3" onClick={onChart}>{C.finances.chartTitle}</Button>
        </div>

        {/* The season's money as one bar: what is still to pay, what the mandate keeps back, what is free. */}
        <div className="mt-6">
          <p className="flex items-baseline justify-between gap-3 text-xs text-sub">
            <span>{M.pool}</span>
            <span className="display text-base font-bold tabular-nums text-ink">{compact(pool)}</span>
          </p>
          <div
            className="mt-2 flex h-3 w-full gap-px overflow-hidden rounded-sm bg-white/8"
            role="img"
            aria-label={`${M.commitments} ${compact(m.commitments.total)}${kept > 0 ? `, ${M.kept} ${compact(kept)}` : ""}, ${short ? M.short : M.freeToSpend} ${compact(Math.abs(free))}`}
          >
            <span className={SEG.committed} style={{ width: pct(Math.min(m.commitments.total, pool)) }} />
            {kept > 0 ? <span className={SEG.kept} style={{ width: pct(Math.min(kept, Math.max(0, pool - m.commitments.total))) }} /> : null}
            {short ? <span className={SEG.short} style={{ width: pct(-free) }} /> : free > 0 ? <span className={SEG.free} style={{ width: pct(free) }} /> : null}
          </div>
          <div className="mt-3 grid gap-x-6 max-sm:border-t max-sm:border-line sm:grid-cols-3">
            <Key tone={SEG.committed} label={M.commitments} value={compact(m.commitments.total)} />
            {kept > 0 ? <Key tone={SEG.kept} label={M.kept} value={compact(kept)} valueTone="text-sub" /> : null}
            {pending ? (
              <Key tone={SEG.free} label={M.projectedEnd} value={compact(free)} valueTone={short ? "text-bad" : "text-good"} />
            ) : (
              <Key tone={short ? SEG.short : SEG.free} label={short ? M.short : M.freeToSpend} value={compact(free)} valueTone={short ? "text-bad" : "text-good"} />
            )}
          </div>
        </div>
      </section>

      {/* ---- Three blocks, each led by its own figure ---- */}
      <div className="grid gap-4 md:grid-cols-3">
        <Block
          title={M.incomeToCome}
          figure={`+${compact(m.incomeToCome.total)}`}
          tone="text-good"
          line={!ended ? `${C.finances.net} ${formatMoneyDelta(st.net, { compact: true })} · ${C.finances.payday} ${formatDateTiny(C.dates, dateOfDay(payday.seasonIndex, payday.day))}` : null}
        >
          <Rows rows={income} />
        </Block>
        <Block title={M.commitments} figure={`−${compact(m.commitments.total)}`} tone="text-bad">
          <Rows rows={commitmentRowsOf(C, m)} />
        </Block>
        <Block title={T.wagesTitle} figure={compact(b.wageBill)} tone={b.overCeiling ? "text-orange-bright" : "text-ink"} line={T.wagesUnit}>
          {ceiling ? (
            <>
              <div className="relative mt-4 h-2 w-full rounded-sm bg-white/10" role="meter" aria-valuenow={b.wageBill} aria-valuemin={0} aria-valuemax={ceiling} aria-label={T.ceiling(compact(ceiling))}>
                <span className={cx("absolute inset-y-0 left-0 rounded-sm", b.overCeiling ? "bg-orange" : "bg-blue-bright/70")} style={{ width: `${Math.min(100, (b.wageBill / Math.max(ceiling, b.wageBill)) * 100)}%` }} />
              </div>
              <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs">
                <span className="text-sub">{T.ceiling(compact(ceiling))}</span>
                <span className={b.overCeiling ? "font-semibold text-orange-bright" : "text-faint"}>
                  {b.overCeiling ? T.over(compact(b.wageBill - ceiling)) : T.room(compact(ceiling - b.wageBill))}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-faint">{T.noCeiling}</p>
          )}
        </Block>
      </div>
    </div>
  );
}
