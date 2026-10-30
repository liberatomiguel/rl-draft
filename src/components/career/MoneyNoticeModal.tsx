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
const NOTICE_MONEY_KEYS = new Set(["lent", "owed", "rescueTo", "floor", "partnerWeekly", "balance", "collected"]);

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
  const notice = save ? moneyNoticeOf(save) : null;
  if (!save || !notice) return null;

  const text = moneyNoticeTextOf(C, notice, save.clock);
  const close = () => acknowledge(notice.id);
  return (
    <Modal
      open
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
          <Button variant="primary" className="min-h-11" onClick={close}>
            {C.moneyNotice.ok}
          </Button>
        </>
      }
    >
      <p className="text-ink">{text.lead}</p>
      {text.rows.length > 0 ? (
        <dl className="mt-3 space-y-2.5 border-t border-line pt-3">
          {text.rows.map(([label, value]) => (
            <div key={label}>
              <dt className="kicker text-[10px] text-faint">{label}</dt>
              <dd className="mt-0.5 text-sm leading-snug text-sub">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {text.foot ? <p className="mt-3 text-xs text-faint">{text.foot}</p> : null}
    </Modal>
  );
}
