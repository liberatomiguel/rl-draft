/**
 * Card resolution — guards the v1.4 sub-special fix: a sub who carries a special
 * (e.g. Turbopolsa) must resolve its SPECIAL overall + art the same way players
 * and coaches do, so the special shows in the DRAFT, not only on results.
 */

import { describe, expect, it } from "vitest";
import { resolveOfferCard, resolvePick, resolveSub } from "./cards";
import type { DraftOfferCard, RosterPick } from "./types";

const SUB_ID = "turbopolsa-sub-northern-gaming-s2"; // base overall 92
const SPECIAL_ID = "sp-turbopolsa-four-times-world-champion"; // overall 99

describe("resolveSub with a special", () => {
  it("returns the base card when no special is active", () => {
    const r = resolveSub(SUB_ID);
    expect(r.special).toBeUndefined();
    expect(r.overall).toBe(92);
  });

  it("applies the special overall + special field when a specialId is given", () => {
    const r = resolveSub(SUB_ID, SPECIAL_ID);
    expect(r.special?.id).toBe(SPECIAL_ID);
    expect(r.overall).toBe(99);
  });

  it("forwards the specialId through resolveOfferCard (draft offer)", () => {
    const offer: DraftOfferCard = {
      kind: "sub",
      refId: SUB_ID,
      specialId: SPECIAL_ID,
      availability: "available",
    };
    const r = resolveOfferCard(offer);
    expect(r.special?.id).toBe(SPECIAL_ID);
    expect(r.overall).toBe(99);
  });

  it("forwards the specialId through resolvePick (chosen bench slot)", () => {
    const pick: RosterPick = {
      slot: "sub",
      kind: "sub",
      refId: SUB_ID,
      specialId: SPECIAL_ID,
      fromLineupId: "northern-gaming-s2",
    };
    const r = resolvePick(pick);
    expect(r.special?.id).toBe(SPECIAL_ID);
    expect(r.overall).toBe(99);
  });
});
