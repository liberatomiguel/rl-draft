import type { CareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";

/** Numeric offer/debt readout shared by mail, bank request and emergency notice. */
export function LoanSummary({ C, received, total, weekly, weeks }: { C: CareerCopy; received: number; total: number; weekly?: number; weeks?: number }) {
  const rows = [[C.moneyNotice.received, formatMoney(received)], [C.moneyNotice.repayTotal, formatMoney(total)], ...(weekly !== undefined ? [[C.moneyNotice.weeklyPayment, formatMoney(weekly)]] : []), ...(weeks !== undefined && weeks > 0 ? [[C.moneyNotice.termWeeks, String(weeks)]] : [])];
  return <dl className="my-3 grid grid-cols-2 gap-2">{rows.map(([label,value],i) => <div key={label} className="rounded-lg border border-line bg-black/20 p-3"><dt className="text-[10px] text-sub">{label}</dt><dd className={`display mt-1 text-xl font-bold tabular-nums ${i === 0 ? "text-good" : i === 1 ? "text-orange-bright" : "text-ink"}`}>{value}</dd></div>)}</dl>;
}
