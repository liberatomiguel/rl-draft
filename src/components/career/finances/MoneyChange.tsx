"use client";
import type { CareerSave } from "@/engine/career/types";
import { latestMoneyChangeOf } from "@/store/careerFlow";
import { formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";

/** Quiet, shared feedback beside the balance; the ledger remains the source of truth. */
export function MoneyChange({ save }: { save: CareerSave }) {
  const change = latestMoneyChangeOf(save);
  if (!change) return null;
  return <span className={cx("font-mono text-[11px] font-semibold", change.amount > 0 ? "text-good" : "text-bad")} aria-live="polite">{formatMoneyDelta(change.amount, { compact: true })}</span>;
}
