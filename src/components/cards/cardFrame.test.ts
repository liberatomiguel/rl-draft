/**
 * COL-02b (rc.33): the org card of a national team gets the national visual —
 * through the REAL offer resolution, and only for national orgs.
 */

import { describe, expect, it } from "vitest";
import { lineups, nationalSpecialByCardId } from "@/data";
import { resolveOfferCard, resolvePick } from "@/engine/cards";
import { frameOf, isNationalOrgCard } from "./cardFrame";

const national = lineups.find((l) => l.national)!;
const club = lineups.find((l) => !l.national && !l.rareSpawn)!;

describe("national org card — the national visual (COL-02b)", () => {
  it("a national team's org card (offer and roster) wears the national frame, on hidden runs too", () => {
    const offerCard = resolveOfferCard({ kind: "org", refId: national.orgId, availability: "available" }, national.id);
    expect(isNationalOrgCard(offerCard)).toBe(true);
    expect(frameOf(offerCard, true)).toContain("card-national");
    expect(frameOf(offerCard, false)).toContain("card-national");
    const picked = resolvePick({ slot: "org", kind: "org", refId: national.orgId, fromLineupId: national.id });
    expect(frameOf(picked, true)).toContain("card-national");
  });

  it("it stays a plain org card: no special, so no collectible and no special effects", () => {
    const offerCard = resolveOfferCard({ kind: "org", refId: national.orgId, availability: "available" }, national.id);
    expect(offerCard.special).toBeUndefined();
    expect(frameOf(offerCard, true)).not.toContain("card-special");
  });

  it("a club's org card keeps its buff rarity frame, and hides it on hidden runs", () => {
    const offerCard = resolveOfferCard({ kind: "org", refId: club.orgId, availability: "available" }, club.id);
    expect(isNationalOrgCard(offerCard)).toBe(false);
    expect(frameOf(offerCard, true)).toBe(`card-${offerCard.baseRarity}`);
    expect(frameOf(offerCard, false)).toBe("card-hidden");
  });

  it("a national player card keeps its special frame", () => {
    const cardId = national.playerCardIds[0];
    const resolved = resolveOfferCard(
      { kind: "player", refId: cardId, specialId: nationalSpecialByCardId.get(cardId)!.id, availability: "available" },
      national.id,
    );
    expect(frameOf(resolved, true)).toBe("card-national card-special holo-national");
  });
});
