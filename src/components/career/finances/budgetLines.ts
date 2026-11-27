/**
 * v2.2 rc.6 (ORGMODE UI-C): the season budget's department lines and its bar,
 * read from `seasonBudgetOf`. Pure, no money rule.
 *
 * `seasonBudgetOf` books the coach's pay with the squad's under "wages" and a
 * loan's instalments under "other"; the Finances screen shows them on their
 * own lines, so this splits them back out of the same season's ledger.
 */

import type { SeasonBudget } from "@/engine/career/budget";
import type { CareerSave, LedgerKind } from "@/engine/career/types";

export type DeptLine = "wages" | "coach" | "staff" | "facilities" | "camps" | "transfers" | "loan" | "other";
export interface DeptRow {
  line: DeptLine;
  spent: number;
  committed: number;
}

const LOAN_KINDS: ReadonlySet<LedgerKind> = new Set(["bankPayment", "loanPayment", "loanGarnish"]);

/** The department rows (wages, coach, staff, facilities, camps, transfers, then loan and other when they hold money). */
export function deptRowsOf(save: Pick<CareerSave, "finances" | "clock">, b: SeasonBudget): DeptRow[] {
  let coachSpent = 0;
  let loanSpent = 0;
  for (const e of save.finances.ledger) {
    if (e.seasonIndex !== b.seasonIndex || e.amount >= 0) continue;
    if (e.kind === "coachSalary") coachSpent += -e.amount;
    else if (LOAN_KINDS.has(e.kind)) loanSpent += -e.amount;
  }
  coachSpent = Math.min(coachSpent, b.spent.wages);
  loanSpent = Math.min(loanSpent, b.spent.other);
  const rows: DeptRow[] = [
    { line: "wages", spent: b.spent.wages - coachSpent, committed: b.committed.wages },
    { line: "coach", spent: coachSpent, committed: b.committed.coach },
    { line: "staff", spent: b.spent.staff, committed: b.committed.staff },
    { line: "facilities", spent: b.spent.facilities, committed: b.committed.upkeep },
    { line: "camps", spent: b.spent.camps, committed: 0 },
    { line: "transfers", spent: b.spent.transfers, committed: 0 },
    { line: "loan", spent: loanSpent, committed: b.committed.loan },
    { line: "other", spent: b.spent.other - loanSpent, committed: 0 },
  ];
  // The first six are the org's departments and always read; loan and other only when they hold money.
  return rows.filter((r) => (r.line !== "loan" && r.line !== "other") || r.spent > 0 || r.committed > 0);
}

export interface BudgetBar {
  /** The season's money: spent so far + cash in hand + contracted income to come. */
  money: number;
  spent: number;
  committed: number;
  /** What is left after the commitments (negative: the commitments run past the money). */
  free: number;
  /** The bar's scale: the larger of the money and spent + committed. */
  scale: number;
}

/** The season's money split into spent, committed and free (free = seasonBudgetOf's own figure). */
export function budgetBarOf(b: SeasonBudget, extra = 0): BudgetBar {
  const free = b.free + extra;
  const money = b.spentTotal + b.committedTotal + free;
  return { money, spent: b.spentTotal, committed: b.committedTotal, free, scale: Math.max(1, money, b.spentTotal + b.committedTotal) };
}
