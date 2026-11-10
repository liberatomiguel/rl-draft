"use client";

/**
 * Road to Worlds — the money notice (rc.34; Miguel, 31/10: "it must be
 * communicated better, with a modal that says what is happening").
 *
 * Mounted once in the career shell. It shows the oldest money notice the
 * save holds (careerFlow.moneyNoticeOf) — the bank's emergency loan, a
 * top-up, the deadline's warnings, the deadline itself, the end — through
 * the portal Modal, on whatever career screen is open: why it happened, how
 * much the bank lent, how it is repaid, the deadline, the investor's help
 * and what ends the career. Closing it (the button, Escape, the backdrop) or
 * opening Finances acknowledges it, so each notice shows once per save; the
 * batched Advance stops on the day one is raised and the autoplay pauses
 * while one waits (careerFlow / CareerAutopilot). Components only render:
 * the params come from the flow, the words from `career.moneyNotice`.
 */

import { LoanSummary } from "./finances/LoanSummary";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { MoneyNoticeText } from "@/content/copy.career.en";
import type { MoneyNotice } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { moneyNoticeOf } from "@/store/careerFlow";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deadlineDateText } from "@/components/career/finances/loanDates";

/** The notice params that carry raw dollar amounts (formatted before the copy reads them). */
const NOTICE_MONEY_KEYS = new Set([
  "lent",
  "owed",
  "rescueTo",
  "floor",
  "partnerWeekly",
  "balance",
  "collected",
  // rc.34 review: the deadline's projection — the books on that Monday, the shortfall, the weekly net.
  "projected",
  "gap",
  "net",
  // rc.37 F2: the bank's offer (what lands, the total, the instalment), the spend and the weekly burn.
  "principal",
  "loanNet",
  "loanTotal",
  "loanWeekly",
  "spent",
  "burn",
]);

/** rc.37 F2: does this notice carry the bank's offer (the loan its button takes)? */
export function noticeOffersLoan(notice: MoneyNotice): boolean {
  return (notice.kind === "creditOffer" || notice.kind === "spendRisk") && Number(notice.params.principal) > 0;
}

/**
 * Pure: a notice's words in this language — the money formatted and the
 * deadline's date (`dlDate`) added from its season and week.
 */
export function moneyNoticeTextOf(
  C: CareerCopy,
  notice: MoneyNotice,
  now: { seasonIndex: number; day: number },
): MoneyNoticeText {
  const p: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(notice.params)) {
    p[key] = NOTICE_MONEY_KEYS.has(key) && typeof value === "number" ? formatMoney(value) : value;
  }
  const { dlSeason, dlWeek } = notice.params;
  if (typeof dlSeason === "number" && typeof dlWeek === "number") {
    p.dlDate = deadlineDateText(C.dates, { seasonIndex: dlSeason, week: dlWeek }, now);
  }
  return C.moneyNotice[notice.kind](p);
}

export function MoneyNoticeModal() {
  const C = useCareerCopy();
  const save = useCareerStore(selectActiveSave);
  const acknowledge = useCareerStore((s) => s.acknowledgeMoneyNotice);
  const acceptCreditOffer = useCareerStore((s) => s.acceptCreditOffer);
  const notice = save ? moneyNoticeOf(save) : null;
  if (!save || !notice) return null;

  const text = moneyNoticeTextOf(C, notice, save.clock);
  const close = () => acknowledge(notice.id);
  // rc.37 F2: an offer of the bank's loan is answered here — take it, or leave it ("Not now").
  const offersLoan = noticeOffersLoan(notice);
  const numerical = Number(notice.params.lent) > 0;
  const mainRows = numerical ? text.rows.filter((_, i) => i === 1 || i === 2 || i === text.rows.length - 1) : text.rows;
  const otherRows = numerical ? text.rows.filter((_, i) => i !== 1 && i !== 2 && i !== text.rows.length - 1) : [];
  return (
    <Modal
      open
      wide
      title={text.title}
      onClose={close}
      actions={
        <>
          <AppLink
            href="/career/finances"
            onClick={close}
            className={cx(buttonClass("secondary", "md"), "min-h-11")}
          >
            {C.moneyNotice.toFinances}
          </AppLink>
          {offersLoan ? (
            <>
              <Button variant="secondary" className="min-h-11" onClick={close}>
                {C.moneyNotice.notNow}
              </Button>
              <Button variant="primary" className="min-h-11" onClick={() => acceptCreditOffer(notice.id)}>
                {C.moneyNotice.takeLoan(formatMoney(Number(notice.params.principal)))}
              </Button>
            </>
          ) : (
            <Button variant="primary" className="min-h-11" onClick={close}>
              {C.moneyNotice.ok}
            </Button>
          )}
        </>
      }
    >
      <p className="text-ink">{text.lead}</p>
      {Number(notice.params.lent) > 0 ? <LoanSummary C={C} received={Number(notice.params.lent)} total={Number(notice.params.owed)} weeks={Number(notice.params.term)} /> : null}
      {mainRows.length > 0 ? (
        <dl className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          {mainRows.map(([label, value], i) => (
            <div key={label} className={cx("rounded-lg border border-line bg-white/[0.03] p-3", numerical && i === mainRows.length - 1 && "border-bad/30 bg-bad/5 sm:col-span-2")}>
              <dt className="kicker text-[10px] text-faint">{label}</dt>
              <dd className="mt-0.5 text-sm leading-snug text-sub">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {otherRows.length > 0 ? <details className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-xs font-semibold text-blue-bright">{C.moneyNotice.otherTerms}</summary><dl className="mt-3 space-y-3">{otherRows.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-ink">{label}</dt><dd className="mt-1 text-xs leading-relaxed text-sub">{value}</dd></div>)}</dl></details> : null}
      {text.foot ? <p className="mt-3 text-xs text-faint">{text.foot}</p> : null}
    </Modal>
  );
}
