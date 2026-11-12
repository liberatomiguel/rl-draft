import { describe, expect, it } from "vitest";
import { EMPTY_COSMETICS, markAnnounced, mergeCosmetics, unannouncedIds } from "./cosmetics";

describe("v2.0.8: unlock pop-ups already queued are remembered across devices", () => {
  it("markAnnounced is idempotent and unannouncedIds filters what was queued", () => {
    const a = markAnnounced({ ...EMPTY_COSMETICS, owned: { x: "2026-11-12", y: "2026-11-12" } }, ["x"]);
    expect(a.announced).toEqual(["x"]);
    expect(markAnnounced(a, ["x"])).toBe(a);
    expect(unannouncedIds(a, ["x", "y"])).toEqual(["y"]);
  });

  it("a new device takes the cloud's list on merge (union), so nothing replays", () => {
    const cloud = { ...EMPTY_COSMETICS, owned: { x: "2026-11-12" }, announced: ["x"] };
    const merged = mergeCosmetics(EMPTY_COSMETICS, cloud);
    expect(unannouncedIds(merged, Object.keys(merged.owned))).toEqual([]);
  });

  it("two profiles from before 2.0.8 merge without inventing a list", () => {
    expect(mergeCosmetics(EMPTY_COSMETICS, EMPTY_COSMETICS).announced).toBeUndefined();
  });
});
