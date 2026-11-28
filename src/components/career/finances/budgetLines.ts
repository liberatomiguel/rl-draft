/**
 * rc9 ORG-UI (#272): the view-model of an established org's money board
 * (`SeasonMoney.tsx`), read from `budget.seasonMoneyOf`. Pure, no money rule.
 * rc.6's department lines and bar (`deptRowsOf`, `budgetBarOf`) went with the
 * season budget card they fed.
 */

import type { SeasonMoney } from "@/engine/career/budget";
import type { CareerCopy } from "@/content/careerCopy";

// ---------------------------------------------------------------------------
// rc9 org (R223): the one money summary of an established org (budget.seasonMoneyOf)
// ---------------------------------------------------------------------------

/** The one sentence that explains why the budget and the cash are different figures. */
export function moneyGapSentenceOf(C: CareerCopy, m: SeasonMoney, money: (n: number) => string): string {
  const G = C.orgmode.money.gap;
  const budget = money(m.budget.amount);
  const opening = m.bridge ? money(Math.abs(m.bridge.opening)) : "";
  const net = m.bridge ? money(Math.abs(m.bridge.netSince)) : "";
  return (G[m.gap] ?? G.unknown)(budget, opening, net);
}

/** The keep-back line of the board's plan ("keeps 300k in the bank at the season's end"). */
export function keepBackLineOf(C: CareerCopy, m: SeasonMoney, money: (n: number) => string): string {
  const K = C.orgmode.money.keepBack;
  return (K[m.keepBack.reason] ?? K.none)(money(m.keepBack.amount));
}

/** The commitments as rows (label, amount), the lines that hold money only. */
export function commitmentRowsOf(C: CareerCopy, m: SeasonMoney): { key: string; label: string; amount: number }[] {
  const T = C.orgmode.money;
  const rows = [
    { key: "payroll", label: T.payroll, amount: m.commitments.payroll },
    { key: "coach", label: T.coach, amount: m.commitments.coach },
    { key: "retainers", label: T.retainers, amount: m.commitments.retainers },
    { key: "upkeep", label: T.upkeep, amount: m.commitments.upkeep },
    { key: "loan", label: T.loan, amount: m.commitments.loan },
  ];
  return rows.filter((r) => r.amount > 0);
}
