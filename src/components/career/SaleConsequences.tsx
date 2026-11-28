"use client";

/**
 * Road to Worlds — what accepting a bid books (ECO-02 R46, ECO-03 R47). One
 * block for the Market's and HQ's sale confirmations, so both quote what the
 * ledger books: the balance after the sale (the fee net of the loan's share,
 * economy.salePreviewFor, applyTransferIncome's own garnish) and the weekly
 * wage bill before and after (economy.payrollProjection, the Monday funnel's
 * rounding). rc9 TRAIN-MARKET: the consequences are rows under hairlines (the
 * label in the faint step, the figure on the right), not a stack of sentences;
 * an emergency-sale offer adds who leaves, the squad it leaves, what lands
 * after the bank's share. Rows are the same ones the signing sheet shows.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { payrollProjection, salePreviewFor } from "@/engine/career/economy";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { LINEUP_SEATS } from "@/engine/career/worldSim";
import { formatMoney } from "@/lib/format";
import { nameOfRef } from "@/store/careerFlow";
import { OfferFact } from "@/components/career/market/MarketRows";

export function SaleConsequences({
  save,
  offer,
}: {
  save: CareerSave;
  offer: Pick<TransferOffer, "playerId" | "fee"> & Partial<Pick<TransferOffer, "emergency" | "otherRef" | "playerName">>;
}) {
  const C = useCareerCopy();
  const M = C.market;
  const preview = salePreviewFor(save.finances, offer.fee);
  const bill = payrollProjection({
    squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    remove: [offer.playerId],
  });
  const squadAfter = save.squad.filter((p) => p.id !== offer.playerId).length;
  const seatOpens = squadAfter < LINEUP_SEATS;
  return (
    <div className="mt-4">
      <h3 className="card-title mb-2">{M.consequences}</h3>
      <dl className="border-t border-line">
        {offer.emergency ? (
          <>
            <OfferFact label={M.sale.leavesFor} value={offer.otherRef ? nameOfRef(save, offer.otherRef) : "?"} />
            <OfferFact label={M.sale.squadAfter} value={M.sale.players(squadAfter)} />
            <OfferFact label={M.sale.lands} value={formatMoney(preview.net)} tone="good" />
          </>
        ) : null}
        {preview.garnished > 0 ? <OfferFact label={M.sale.loanShare} value={formatMoney(preview.garnished)} /> : null}
        <OfferFact label={M.cons.balance} value={formatMoney(preview.balanceAfter)} tone="good" />
        <OfferFact label={M.cons.wages} value={M.wageBillTo(formatMoney(bill.now), formatMoney(bill.after))} />
      </dl>
      {offer.emergency && seatOpens ? <p className="mt-3 text-[13px] text-sub">{M.saleShortSeat}</p> : null}
    </div>
  );
}
