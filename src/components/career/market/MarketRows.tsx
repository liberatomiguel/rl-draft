"use client";

/**
 * Road to Worlds — Market rows (rc9 TRAIN-MARKET).
 *
 * The Market's ledger rows. Candidates are a grid of player cards (MarketScreen,
 * PlayerCardTile); a deal (a bid, a listing, a trade) is a row: who and what,
 * the figure, then its actions. `OfferFact` is one fact of an offer or a sheet.
 */

import type { ReactNode } from "react";
import { cx } from "@/lib/util";

/** One fact of an offer (the fee, the balance after): the label in the faint step on the left, the value on the right. */
export function OfferFact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-3">
      <dt className="text-[13px] text-faint">{label}</dt>
      <dd className={cx("text-right text-sm tabular-nums", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** A deal: who and what on the left, its figure on the right, then its actions. */
export function DealRow({
  title,
  tags,
  lines,
  figure,
  actions,
}: {
  title: ReactNode;
  tags?: ReactNode;
  lines?: ReactNode[];
  figure?: { value: string; label: string; tone?: "ink" | "good" | "bad" } | null;
  actions?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="display text-[15px] font-semibold leading-snug text-ink">{title}</span>
          {tags}
        </div>
        {(lines ?? []).filter(Boolean).map((line, i) => (
          <p key={i} className={cx("text-[13px] leading-snug", i === 0 ? "mt-1 text-sub" : "mt-0.5 text-faint")}>
            {line}
          </p>
        ))}
      </div>
      {figure ? (
        <div className="text-right">
          <p className={cx("display text-xl font-bold leading-none tabular-nums", figure.tone === "good" ? "text-good" : figure.tone === "bad" ? "text-bad" : "text-ink")}>{figure.value}</p>
          <p className="kicker mt-1">{figure.label}</p>
        </div>
      ) : null}
      {actions ? <div className="col-span-2 flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}
