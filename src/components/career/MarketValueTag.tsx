"use client";

/**
 * Road to Worlds — rc.37 F2 (Miguel, 05/11): the market-value tag on the
 * offers that are priced away from a player's value — an emergency-sale
 * offer reads BELOW MARKET VALUE (its fee as a percent of the value, stored
 * when it was tabled), a Blockbuster bid ABOVE MARKET VALUE
 * (CAREER_TRANSFER.blockbusterFeeMult). Every other offer shows none.
 */

import { CAREER_TRANSFER } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import type { TransferOffer } from "@/engine/career/types";
import { Badge } from "@/components/ui/Badge";

/** The offer's side of its market value and the percent it pays (null = no tag). */
export function marketValueTagOf(
  offer: Pick<TransferOffer, "emergency" | "blockbuster" | "valuePct">,
): { side: "below" | "above"; pct: number | null } | null {
  if (offer.emergency) return { side: "below", pct: offer.valuePct ?? null };
  if (offer.blockbuster) {
    const pct = Math.round(CAREER_TRANSFER.blockbusterFeeMult * 100);
    return { side: pct >= 100 ? "above" : "below", pct };
  }
  return null;
}

export function MarketValueTag({ offer }: { offer: Pick<TransferOffer, "emergency" | "blockbuster" | "valuePct"> }) {
  const C = useCareerCopy();
  const tag = marketValueTagOf(offer);
  if (!tag) return null;
  return (
    <Badge tone={tag.side === "below" ? "orange" : "good"}>
      {tag.side === "below" ? C.market.belowValue(tag.pct) : C.market.aboveValue(tag.pct)}
    </Badge>
  );
}
