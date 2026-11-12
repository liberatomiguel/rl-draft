/**
 * Card resolution — guards the v1.4 sub-special fix: a sub who carries a special
 * (e.g. Turbopolsa) must resolve its SPECIAL overall + art the same way players
 * and coaches do, so the special shows in the DRAFT, not only on results.
 */

import { describe, expect, it } from "vitest";
import { resolveOfferCard, resolvePick, resolveSpecial, resolveSub } from "./cards";
import { coachById, lineupById, specialCardById } from "@/data";
import type { DraftOfferCard, RosterPick } from "./types";

const SUB_ID = "turbopolsa-sub-northern-gaming-s2"; // base overall 92
const SPECIAL_ID = "sp-turbopolsa-four-times-world-champion"; // overall 99

describe("resolveSub with a special", () => {
  it("resolves the curated Duds community card as FURIA's 2025 substitute", () => {
    const sp = specialCardById.get("sp-dudsmelow-community")!;
    const card = resolveSpecial(sp);
    expect(card.kind).toBe("sub");
    expect(card.personId).toBe("dudsmelow");
    expect(card.lineupId).toBe("furia-2025");
    expect(card.special?.rarity).toBe("community");
    expect(lineupById.get("furia-2025")!.subId).toBe(sp.baseCardId);
  });

  it("anchors STL's Worlds special in 2022 without replacing head coach Kairos", () => {
    const sp = specialCardById.get("sp-stl-gamers8-furia")!;
    const card = resolveSpecial(sp);
    expect(card.lineupId).toBe("furia-2122");
    expect(card.personId).toBe("stl");
    const headCoach = coachById.get(lineupById.get("furia-2122")!.coachId!)!;
    expect(headCoach.personId).toBe("kairos");
    expect(headCoach.country).toBe("US");
  });
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
