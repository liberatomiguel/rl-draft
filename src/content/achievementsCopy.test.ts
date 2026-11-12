import { describe, expect, it } from "vitest";
import { achievements } from "@/data";
import { EN } from "./copy.en";
import { PT } from "./copy.pt";

/**
 * T1 (v2.0): the draft achievements were English for a Portuguese player (the
 * grid, the unlock toast and the results screen read `achievements.json`).
 * PT now carries one entry per id; EN keeps the catalogue as its source.
 */
describe("achievement copy", () => {
  it("PT names and describes every achievement in the catalogue", () => {
    const missing = achievements
      .filter((a) => !PT.ACH_UI.items[a.id]?.name || !PT.ACH_UI.items[a.id]?.desc)
      .map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it("PT has no entry for an id the catalogue dropped", () => {
    const ids = new Set(achievements.map((a) => a.id));
    expect(Object.keys(PT.ACH_UI.items).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("EN leaves the map to the catalogue (one source of truth)", () => {
    expect(Object.keys(EN.ACH_UI.items)).toEqual([]);
  });
});
