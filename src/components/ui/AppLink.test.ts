/**
 * rc.32 (WEB-02): AppLink prefetches on a mouse that really moves over the
 * link. The pointer events a browser sends when a link slides under a resting
 * cursor (a scroll, a dialog closing) carry no movement, and taps are never
 * intent — in the measured run one such accidental prefetch of /profile cost
 * 8 requests (scripts/request-budget.mjs).
 */

import { describe, expect, it } from "vitest";
import { isMouseIntent } from "./AppLink";

describe("isMouseIntent", () => {
  it("is a mouse that moved", () => {
    expect(isMouseIntent({ pointerType: "mouse", movementX: 3, movementY: 0 })).toBe(true);
    expect(isMouseIntent({ pointerType: "mouse", movementX: 0, movementY: -1 })).toBe(true);
  });

  it("is not a link that slid under a resting cursor", () => {
    expect(isMouseIntent({ pointerType: "mouse", movementX: 0, movementY: 0 })).toBe(false);
  });

  it("is never touch or pen", () => {
    expect(isMouseIntent({ pointerType: "touch", movementX: 5, movementY: 5 })).toBe(false);
    expect(isMouseIntent({ pointerType: "pen", movementX: 5, movementY: 5 })).toBe(false);
  });
});
