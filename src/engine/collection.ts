/**
 * Collection rules (rc.33, COL-01b / COL-02a) — pure reads of the inventory.
 *
 * National teams: DISCOVERY is separate from OWNERSHIP. Seeing a national team
 * in a draft offer reveals its album page (`profile.nationalDiscovered`);
 * drafting one of its cards and finishing the run collects that card, like any
 * special (results → `unlockedSpecials`). A save from before rc.33 got every
 * card at the find, so owning any card of a team also counts as discovered —
 * derived here, never written back. The draw favours the teams that are not
 * COMPLETE yet (`DRAFT.nationalUndiscoveredWeight`).
 */

import { nationalSpecialIdsByLineupId } from "@/data";
import type { DraftOffer } from "./types";

type Owned = Record<string, string>;

/** The national special ids of a lineup (empty for any other lineup). */
export function nationalCardIdsOf(lineupId: string): string[] {
  return nationalSpecialIdsByLineupId.get(lineupId) ?? [];
}

/** Found in a draft, or (saves from before rc.33) any of its cards owned. */
export function isNationalTeamDiscovered(
  lineupId: string,
  discovered: Owned | undefined,
  owned: Owned,
): boolean {
  if (discovered?.[lineupId]) return true;
  return nationalCardIdsOf(lineupId).some((id) => Boolean(owned[id]));
}

export interface NationalTeamProgress {
  have: number;
  total: number;
  complete: boolean;
}

/** Owned cards of a national team (players, coach and sub — the org is no card). */
export function nationalTeamProgress(lineupId: string, owned: Owned): NationalTeamProgress {
  const ids = nationalCardIdsOf(lineupId);
  const have = ids.filter((id) => Boolean(owned[id])).length;
  return { have, total: ids.length, complete: ids.length > 0 && have === ids.length };
}

/** National lineups whose every card is owned — the draw favours the others. */
export function completeNationalLineups(owned: Owned): string[] {
  const out: string[] = [];
  for (const [lineupId, ids] of nationalSpecialIdsByLineupId) {
    if (ids.length > 0 && ids.every((id) => Boolean(owned[id]))) out.push(lineupId);
  }
  return out;
}

/**
 * COL-02a: the special cards (rolled specials and national cards) of an offer
 * the player does not own yet. The store calls it the moment the offer is
 * drawn, BEFORE anything is collected, and keeps the answer with the offer —
 * so a card shows NEW in the very offer that ends up collecting it. "Not owned"
 * is not "not seen": a card seen before and never collected is still NEW.
 */
export function unownedOfferSpecials(offer: DraftOffer | null, owned: Owned): string[] {
  if (!offer) return [];
  const out: string[] = [];
  for (const card of offer.cards) {
    if (card.specialId && !owned[card.specialId] && !out.includes(card.specialId)) out.push(card.specialId);
  }
  return out;
}
