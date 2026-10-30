/**
 * Card frame classes (GameCard), split out so the rules are testable without
 * rendering. Pure: no React, no dataset.
 */

import type { ResolvedCard } from "@/engine/cards";

/** Special rarities whose frame carries the holo treatment. */
const HOLO_RARITIES = ["epic", "mythic", "legendary", "creator", "wings", "community", "national"];

/**
 * COL-02b (rc.33): the ORG card of a national team (`national-<iso>` org) wears
 * the national visual — the trophy-gold frame of its players, the flag as the
 * crest, "National team" as its tag. Visual only: it is no special and no
 * collectible (no specialId, no album slot), and its buff is unchanged.
 */
export function isNationalOrgCard(card: Pick<ResolvedCard, "kind" | "orgId">): boolean {
  return card.kind === "org" && Boolean(card.orgId?.startsWith("national-"));
}

export function frameOf(card: ResolvedCard, showOverall: boolean): string {
  if (card.special) {
    const holo = HOLO_RARITIES.includes(card.special.rarity) ? ` holo-${card.special.rarity}` : "";
    return `card-${card.special.rarity} card-special${holo}`;
  }
  // The national org frame shows on hidden runs too: it tells nothing the offer
  // header does not (the team is named there) and no national org has a buff.
  if (isNationalOrgCard(card)) return "card-national card-national-org";
  // Hidden runs black out EVERYTHING except special cards (base doc §11):
  // player/coach/sub overalls, coach bonuses, org buffs and all rarities.
  if (!showOverall) return "card-hidden";
  return `card-${card.baseRarity ?? "common"}`;
}
