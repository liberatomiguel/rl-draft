"use client";

/**
 * Road to Worlds — what accepting a bid books (ECO-02 R46, ECO-03 R47): the
 * balance after the sale (the fee net of the Backer's share —
 * economy.salePreviewFor, applyTransferIncome's own garnish), "Backer repaid
 * $X" while the Backer is owed, and the weekly wage bill before → after
 * (economy.payrollProjection, the Monday funnel's rounding). ONE block for
 * the Market's and HQ's sale confirmations, so both quote what the ledger
 * books. rc.37 F2 (package 3): an emergency-sale offer also says who leaves
 * (and the seat it opens), what lands after the bank's share and the wages
 * it frees.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { payrollProjection, salePreviewFor } from "@/engine/career/economy";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { LINEUP_SEATS } from "@/engine/career/worldSim";
import { formatMoney } from "@/lib/format";
import { nameOfRef } from "@/store/careerFlow";

export function SaleConsequences({
  save,
  offer,
}: {
  save: CareerSave;
  offer: Pick<TransferOffer, "playerId" | "fee"> & Partial<Pick<TransferOffer, "emergency" | "otherRef" | "playerName">>;
}) {
  const C = useCareerCopy();
  const preview = salePreviewFor(save.finances, offer.fee);
  const bill = payrollProjection({
    squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    remove: [offer.playerId],
  });
  const squadAfter = save.squad.filter((p) => p.id !== offer.playerId).length;
  return (
    <>
      <p className="kicker text-[10px]">{C.market.consequences}</p>
      {offer.emergency ? (
        <>
          <p className="font-semibold text-ink">
            {C.market.saleLeaves(
              offer.playerName ?? "?",
              offer.otherRef ? nameOfRef(save, offer.otherRef) : "?",
              squadAfter,
            )}
          </p>
          {squadAfter < LINEUP_SEATS ? (
            <p className="text-xs font-semibold text-orange-bright">{C.market.saleShortSeat}</p>
          ) : null}
          <p className="font-semibold text-good">
            {preview.garnished > 0
              ? C.market.saleNetAfterDebt(formatMoney(preview.net), formatMoney(offer.fee), formatMoney(preview.garnished))
              : C.market.saleNetFull(formatMoney(preview.net))}
          </p>
          <p>{C.market.saleWagesFreed(formatMoney(Math.max(0, bill.now - bill.after)))}</p>
        </>
      ) : null}
      <p className="font-semibold text-good">{C.market.balanceAfter(formatMoney(preview.balanceAfter))}</p>
      {preview.garnished > 0 && !offer.emergency ? (
        <p className="text-xs font-semibold text-orange-bright">
          {C.market.saleBackerRepaid(formatMoney(preview.garnished))}
        </p>
      ) : null}
      <p>{C.market.payrollWeek(formatMoney(bill.now), formatMoney(bill.after))}</p>
    </>
  );
}
