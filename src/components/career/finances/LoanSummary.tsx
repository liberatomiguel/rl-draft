import type { CareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";

/**
 * Numeric offer/debt readout shared by mail, bank request and emergency notice.
 * One strip of figures (the 1px gaps are its dividers): the number first and
 * large, its label under it. What lands is a gain, what is owed is a cost.
 */
export function LoanSummary({ C, received, total, weekly, weeks }: { C: CareerCopy; received: number; total: number; weekly?: number; weeks?: number }) {
  const rows = [
    [C.moneyNotice.received, formatMoney(received)],
    [C.moneyNotice.repayTotal, formatMoney(total)],
    ...(weekly !== undefined ? [[C.moneyNotice.weeklyPayment, formatMoney(weekly)]] : []),
    ...(weeks !== undefined && weeks > 0 ? [[C.moneyNotice.termWeeks, String(weeks)]] : []),
  ];
  return (
    <dl className="my-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
      {rows.map(([label, value], i) => (
        // dt stays first in the DOM; the column is reversed so the figure reads first.
        <div key={label} className={`flex flex-col-reverse justify-end gap-1 bg-surface p-3 ${rows.length % 2 === 1 && i === rows.length - 1 ? "col-span-2" : ""}`}>
          <dt className="text-xs leading-snug text-sub">{label}</dt>
          <dd className={`display text-2xl font-bold leading-none tabular-nums ${i === 0 ? "text-good" : i === 1 ? "text-bad" : "text-ink"}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
