"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): an established org's season budget, the first
 * block of its Finances and the screen's focal object.
 *
 * The board's allocation is the figure; under it the season's money as one
 * bar (spent, committed to the season's end, free), the projection for the
 * season's end and the wage bill against the board's ceiling. Then the lines:
 * by department (spent, to come) and the income (received, contracted).
 *
 * Before the season plan is chosen the allocation is not in the balance yet
 * (`seasonBudgetOf.free` reads far below zero): the bar gives way to the
 * pending plan and a link to the Board page, and the projection adds the
 * proposed plan's budget, as the Board page's money strip does.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { seasonBudgetOf, type IncomeLine } from "@/engine/career/budget";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { AppLink } from "@/components/ui/AppLink";
import { pendingPackageOf } from "@/store/boardFlow";
import { seasonLabelFor } from "@/components/career/careerUi";
import { budgetBarOf, deptRowsOf } from "./budgetLines";

const money = (n: number) => formatMoney(n, { compact: true });
const INCOME_LINES: IncomeLine[] = ["sponsor", "prizes", "fanbase", "sales"];

/** The bar's three parts. Spent is the quiet ink, committed the information blue, free the gain green. */
const SEG = { spent: "bg-sub/70", committed: "bg-blue-bright/70", free: "bg-good/70", short: "bg-bad/80" } as const;

function Key({ tone, label, value, valueTone = "text-ink" }: { tone: string; label: string; value: string; valueTone?: string }) {
  return (
    <div className="min-w-0 max-sm:flex max-sm:min-h-11 max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:border-b max-sm:border-line max-sm:last:border-b-0">
      <p className="display text-xl font-bold leading-none tabular-nums sm:text-2xl max-sm:order-2">
        <span className={valueTone}>{value}</span>
      </p>
      <p className="flex items-center gap-1.5 text-xs text-sub sm:mt-1.5 max-sm:order-1">
        <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-[2px]", tone)} />
        {label}
      </p>
    </div>
  );
}

/** A table of lines: the label, then two right-aligned money columns. */
function Lines({ title, cols, rows, total, note }: { title: string; cols: [string, string]; rows: { key: string; label: string; a: number; b: number }[]; total: string; note?: string }) {
  const sumA = rows.reduce((s, r) => s + r.a, 0);
  const sumB = rows.reduce((s, r) => s + r.b, 0);
  const cell = (n: number) => (n > 0 ? money(n) : "–");
  return (
    <div className="min-w-0">
      <h3 className="card-title">{title}</h3>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong">
            <th className="sr-only">{title}</th>
            <th scope="col" className="pb-1.5 text-right text-xs font-medium text-sub">{cols[0]}</th>
            <th scope="col" className="w-24 pb-1.5 text-right text-xs font-medium text-sub sm:w-28">{cols[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line">
              <th scope="row" className="py-2 pr-2 text-left font-normal text-ink">{r.label}</th>
              <td className={cx("py-2 text-right tabular-nums", r.a > 0 ? "text-ink" : "text-faint")}>{cell(r.a)}</td>
              <td className={cx("py-2 text-right tabular-nums", r.b > 0 ? "text-sub" : "text-faint")}>{cell(r.b)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pt-2 text-left text-xs font-semibold uppercase tracking-[0.04em] text-sub">{total}</th>
            <td className="display pt-2 text-right text-base font-bold tabular-nums text-ink">{money(sumA)}</td>
            <td className="display pt-2 text-right text-base font-bold tabular-nums text-sub">{money(sumB)}</td>
          </tr>
        </tfoot>
      </table>
      {note ? <p className="mt-2 text-xs text-faint">{note}</p> : null}
    </div>
  );
}

export function SeasonBudget({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  const b = seasonBudgetOf(save);
  if (!b) return null;
  const T = C.orgmode.budget;
  const pending = pendingPackageOf(save);
  const proposed = pending ? (pending.find((o) => o.id === "expected") ?? pending[0]) : null;
  const pendingGrant = proposed?.grant ?? 0;
  const bar = budgetBarOf(b);
  const projected = b.projectedEnd + pendingGrant;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / bar.scale) * 100))}%`;
  const short = bar.free < 0;
  const ceiling = b.wageCeiling;
  const dept = deptRowsOf(save, b).map((r) => ({ key: r.line, label: T.line[r.line] ?? r.line, a: r.spent, b: r.committed }));
  const income = INCOME_LINES.map((k) => ({ key: k, label: T.income[k] ?? k, a: b.income[k], b: b.incomeToCome[k] }));

  return (
    <section id="career-season-budget" aria-labelledby="season-budget-title" className={cx("panel-strong min-w-0 scroll-mt-44 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="season-budget-title" className="card-title">{T.title}</h2>
        <p className="text-sm text-sub">{T.when(seasonLabelFor(b.seasonIndex), b.mondaysLeft)}</p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        {/* The board's money and the bar of the season's money. */}
        <div className="min-w-0">
          {pending ? (
            <>
              <p className="display text-5xl font-bold leading-none tabular-nums text-faint sm:text-6xl">{money(pendingGrant)}</p>
              <p className="mt-2 text-sm text-sub">{T.allocationProposed}</p>
              <div className="mt-5 rounded-lg border border-line-strong p-4">
                <p className="display text-base font-bold uppercase leading-tight text-ink">{T.pendingTitle}</p>
                <p className="mt-1 text-sm leading-snug text-sub">{T.pendingBody}</p>
                <AppLink href="/career/board" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">
                  {T.pendingLink}
                </AppLink>
              </div>
            </>
          ) : (
            <>
              <p className="display text-5xl font-bold leading-none tabular-nums text-ink sm:text-6xl">{money(b.allocation)}</p>
              <p className="mt-2 text-sm text-sub">{T.allocation}</p>
              {b.bonusAtStake > 0 ? <p className="mt-0.5 text-xs text-faint">{T.bonus(money(b.bonusAtStake))}</p> : null}

              <div className="mt-6">
                <p className="flex items-baseline justify-between gap-3 text-xs text-sub">
                  <span>{T.barLabel}</span>
                  <span className="display text-base font-bold tabular-nums text-ink">{money(Math.max(0, bar.money))}</span>
                </p>
                <div className="relative mt-2 flex h-3 w-full gap-px overflow-hidden rounded-sm bg-white/8" role="img" aria-label={`${T.spent} ${money(bar.spent)}, ${T.committed} ${money(bar.committed)}, ${short ? `${T.short} ${money(-bar.free)}` : `${T.free} ${money(bar.free)}`}`}>
                  {bar.spent > 0 ? <span className={SEG.spent} style={{ width: pct(bar.spent) }} /> : null}
                  {bar.committed > 0 ? <span className={SEG.committed} style={{ width: pct(short ? Math.max(0, bar.money - bar.spent) : bar.committed) }} /> : null}
                  {short ? <span className={SEG.short} style={{ width: pct(Math.min(-bar.free, bar.committed)) }} /> : bar.free > 0 ? <span className={SEG.free} style={{ width: pct(bar.free) }} /> : null}
                </div>
                <div className="mt-3 grid gap-x-4 max-sm:border-t max-sm:border-line sm:grid-cols-3">
                  <Key tone={SEG.spent} label={T.spent} value={money(bar.spent)} />
                  <Key tone={SEG.committed} label={T.committed} value={money(bar.committed)} />
                  {short ? (
                    <Key tone={SEG.short} label={T.short} value={money(-bar.free)} valueTone="text-bad" />
                  ) : (
                    <Key tone={SEG.free} label={T.free} value={money(bar.free)} valueTone="text-good" />
                  )}
                </div>
                <p className={cx("mt-3 text-xs leading-snug", short ? "text-bad" : "text-faint")}>{short ? T.shortBy(money(-bar.free)) : T.barNote}</p>
              </div>
            </>
          )}
        </div>

        {/* Where the season ends, and the wage bill against the ceiling. */}
        <div className="flex min-w-0 flex-col gap-5 border-line max-lg:border-t max-lg:pt-5 lg:border-l lg:pl-8">
          <div>
            <p className={cx("display text-4xl font-bold leading-none tabular-nums", projected < 0 ? "text-bad" : "text-ink")}>{money(projected)}</p>
            <p className="mt-2 text-sm text-sub">{T.projected}</p>
            <p className="mt-0.5 text-xs text-faint">{T.projectedBasis}</p>
            {pending ? (
              <p className="mt-0.5 text-xs text-faint">{T.projectedPending(money(pendingGrant))}</p>
            ) : b.bonusAtStake > 0 ? (
              <p className="mt-0.5 text-xs text-faint">{T.projectedIfMet(money(b.projectedEndIfMet))}</p>
            ) : null}
          </div>
          <div className="border-t border-line pt-4">
            <p className="text-xs text-sub">{T.wagesTitle}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className={cx("display text-3xl font-bold leading-none tabular-nums", b.overCeiling ? "text-orange-bright" : "text-ink")}>{money(b.wageBill)}</span>
              <span className="text-xs text-sub">{T.wagesUnit}</span>
            </p>
            {ceiling ? (
              <>
                <div className="relative mt-3 h-2 w-full rounded-sm bg-white/8" role="meter" aria-valuenow={b.wageBill} aria-valuemin={0} aria-valuemax={ceiling} aria-label={T.ceiling(money(ceiling))}>
                  <span
                    className={cx("absolute inset-y-0 left-0 rounded-sm", b.overCeiling ? "bg-orange" : "bg-blue-bright/70")}
                    style={{ width: `${Math.min(100, (b.wageBill / Math.max(ceiling, b.wageBill)) * 100)}%` }}
                  />
                  {b.overCeiling ? <span aria-hidden className="absolute -top-1 h-4 w-px bg-ink" style={{ left: `${(ceiling / b.wageBill) * 100}%` }} /> : null}
                </div>
                <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs">
                  <span className="text-sub">{T.ceiling(money(ceiling))}</span>
                  <span className={b.overCeiling ? "font-semibold text-orange-bright" : "text-faint"}>
                    {b.overCeiling ? T.over(money(b.wageBill - ceiling)) : T.room(money(ceiling - b.wageBill))}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-faint">{T.noCeiling}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-line pt-5 md:grid-cols-2 md:gap-8">
        <Lines title={T.linesTitle} cols={[T.colSpent, T.colCommitted]} rows={dept} total={T.total} note={b.ledgerFromWeek > 1 ? T.ledgerFrom(b.ledgerFromWeek) : undefined} />
        <Lines title={T.incomeTitle} cols={[T.colReceived, T.colContracted]} rows={income} total={T.total} note={T.incomeNote} />
      </div>
    </section>
  );
}
