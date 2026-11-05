"use client";

/**
 * Road to Worlds — rc.37 F2 package 4: the season-close outlook. The season
 * review shows next season's books in one place next to the contract review
 * (careerFlow.seasonOutlookOf — live, so a renewal moves it): the wage bill
 * now → after the review (who leaves), what is owed and by when, the balance
 * projected to the first regional (no prize counted) and the retirements in
 * sight (decision 8: the warning only). Components only render.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { seasonOutlookOf } from "@/store/careerFlow";
import { Panel } from "@/components/ui/Panel";
import { deadlineDateText } from "@/components/career/finances/loanDates";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <p className="kicker text-[10px] text-faint">{label}</p>
      <div className="mt-0.5 space-y-0.5 text-sm leading-snug text-sub">{children}</div>
    </div>
  );
}

export function SeasonOutlook({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const O = C.finances.outlook;
  const view = seasonOutlookOf(save);
  const now = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  return (
    <Panel className="rise-in p-4 sm:p-5" style={{ animationDelay: "210ms" }}>
      <p className="kicker mb-3 !text-[10px]">{O.title}</p>
      <div className="space-y-2.5">
        <Row label={O.payroll}>
          <p className="font-semibold text-ink">
            {O.payrollLine(formatMoney(view.payrollNow), formatMoney(view.payrollNext))}
          </p>
          {view.leaving.length > 0 ? <p className="text-xs">{O.leaving(view.leaving.join(", "))}</p> : null}
        </Row>
        <Row label={O.debt}>
          {view.debt.total <= 0 ? <p>{O.debtNone}</p> : null}
          {view.debt.emergency > 0 ? (
            <p className="font-semibold text-orange-bright">{O.debtEmergency(formatMoney(view.debt.emergency))}</p>
          ) : null}
          {view.deadline ? (
            <p className="text-xs">{O.deadline(deadlineDateText(C.dates, view.deadline, now), view.deadline.weeksLeft)}</p>
          ) : null}
          {view.debt.bank > 0 ? (
            <p>{O.debtBank(formatMoney(view.debt.bank), view.bankInstalmentsLeft)}</p>
          ) : null}
        </Row>
        <Row label={O.cash}>
          <p className={cx("font-semibold", view.nextIncome.balanceAtIt < 0 ? "text-bad" : "text-ink")}>
            {O.cashLine(
              formatMoney(view.nextIncome.balanceAtIt),
              view.nextIncome.week,
              view.nextIncome.mondays,
              formatMoney(view.nextIncome.weeklyNetNext),
            )}
          </p>
          {view.sponsorEnds ? <p className="text-xs">{O.sponsorEnds}</p> : null}
        </Row>
        <Row label={O.retirements}>
          {view.retirements.length === 0 ? <p>{O.retireNone}</p> : null}
          {view.retirements.map((r) => (
            <p key={r.playerId} className={r.when === "now" ? "font-semibold text-ink" : undefined}>
              {r.when === "now" ? O.retireNow(r.name) : r.when === "likely" ? O.retireLikely(r.name) : O.retirePossible(r.name)}
            </p>
          ))}
        </Row>
      </div>
    </Panel>
  );
}
