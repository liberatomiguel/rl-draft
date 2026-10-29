"use client";

/**
 * Road to Worlds — what accepting a bid books (ECO-02 R46, ECO-03 R47): the
 * balance after the sale (the fee net of the Backer's share —
 * economy.salePreviewFor, applyTransferIncome's own garnish), "Backer repaid
 * $X" while the Backer is owed, and the weekly wage bill before → after
 * (economy.payrollProjection, the Monday funnel's rounding). ONE block for
 * the Market's and HQ's sale confirmations, so both quote what the ledger
 * books.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { payrollProjection, salePreviewFor } from "@/engine/career/economy";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";

export function SaleConsequences({
  save,
  offer,
}: {
  save: CareerSave;
  offer: Pick<TransferOffer, "playerId" | "fee">;
}) {
  const C = useCareerCopy();
  const preview = salePreviewFor(save.finances, offer.fee);
  const bill = payrollProjection({
    squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    remove: [offer.playerId],
  });
  return (
    <>
      <p className="kicker text-[10px]">{C.market.consequences}</p>
      <p className="font-semibold text-good">{C.market.balanceAfter(formatMoney(preview.balanceAfter))}</p>
      {preview.garnished > 0 ? (
        <p className="text-xs font-semibold text-orange-bright">
          {C.market.saleBackerRepaid(formatMoney(preview.garnished))}
        </p>
      ) : null}
      <p>{C.market.payrollWeek(formatMoney(bill.now), formatMoney(bill.after))}</p>
    </>
  );
}
