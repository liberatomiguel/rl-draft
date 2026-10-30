/**
 * Collection rules (rc.33, COL-01b / COL-02a): national discovery vs ownership,
 * team progress, and the offer's NEW (not owned — not "not seen").
 */

import { describe, expect, it } from "vitest";
import { nationalSpecialIdsByLineupId, obtainableNationalLineups } from "@/data";
import {
  completeNationalLineups,
  isNationalTeamDiscovered,
  nationalCardIdsOf,
  nationalTeamProgress,
  unownedOfferSpecials,
} from "./collection";
import type { DraftOffer } from "./types";

const DATE = "2026-10-30T00:00:00.000Z";
const team = obtainableNationalLineups[0];
const ids = nationalCardIdsOf(team.id);

describe("national album — discovery is not ownership", () => {
  it("every national team has 4 or 5 cards (three players, a coach, maybe a sub)", () => {
    for (const [lineupId, cards] of nationalSpecialIdsByLineupId) {
      expect(cards.length, lineupId).toBeGreaterThanOrEqual(4);
      expect(cards.length, lineupId).toBeLessThanOrEqual(5);
    }
  });

  it("found in a draft → discovered, with no card owned", () => {
    expect(isNationalTeamDiscovered(team.id, { [team.id]: DATE }, {})).toBe(true);
    expect(nationalTeamProgress(team.id, {})).toEqual({ have: 0, total: ids.length, complete: false });
  });

  it("a save from before rc.33 (any card owned) counts as discovered — derived", () => {
    expect(isNationalTeamDiscovered(team.id, undefined, { [ids[0]]: DATE })).toBe(true);
    expect(isNationalTeamDiscovered(team.id, {}, {})).toBe(false);
  });

  it("progress counts owned cards; complete only with every card", () => {
    const partial = { [ids[0]]: DATE, [ids[1]]: DATE };
    expect(nationalTeamProgress(team.id, partial)).toMatchObject({ have: 2, complete: false });
    expect(completeNationalLineups(partial)).not.toContain(team.id);
    const full = Object.fromEntries(ids.map((id) => [id, DATE]));
    expect(nationalTeamProgress(team.id, full)).toMatchObject({ have: ids.length, complete: true });
    expect(completeNationalLineups(full)).toEqual([team.id]);
  });

  it("a lineup that is no national team has no cards and is never complete", () => {
    expect(nationalCardIdsOf("not-a-lineup")).toEqual([]);
    expect(nationalTeamProgress("not-a-lineup", {})).toEqual({ have: 0, total: 0, complete: false });
  });
});

describe("offer NEW — not owned (COL-02a)", () => {
  const offer: DraftOffer = {
    lineupId: team.id,
    hasPickableCard: true,
    cards: [
      { kind: "player", refId: "a", specialId: ids[0], availability: "available" },
      { kind: "player", refId: "b", specialId: ids[1], availability: "available" },
      { kind: "player", refId: "c", availability: "available" },
      { kind: "org", refId: team.orgId, availability: "available" },
    ],
  };

  it("lists the offer's specials the inventory does not hold — seen before or not", () => {
    expect(unownedOfferSpecials(offer, {})).toEqual([ids[0], ids[1]]);
    expect(unownedOfferSpecials(offer, { [ids[0]]: DATE })).toEqual([ids[1]]);
    expect(unownedOfferSpecials(null, {})).toEqual([]);
  });
});
