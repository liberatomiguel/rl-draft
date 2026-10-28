/**
 * rc.29 (E2E DRAFT-02 / DRAFT-13): overlay holds — while a tournament plays, a
 * ceremony or the first-run tour is up, the login calendar and the cosmetic
 * unlock pop-ups wait; they show once every holder has let go.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { NO_HOLDS, addHold, isHeld, removeHold, selectHeld, useOverlayHolds } from "./overlayHoldStore";

describe("hold counts", () => {
  it("nothing held by default", () => {
    expect(isHeld(NO_HOLDS)).toBe(false);
  });

  it("any reason holds", () => {
    for (const reason of ["intro", "live", "ceremony"] as const) {
      expect(isHeld(addHold(NO_HOLDS, reason)), reason).toBe(true);
    }
  });

  it("counts holders, so one leaving does not release another's hold", () => {
    const two = addHold(addHold(NO_HOLDS, "ceremony"), "ceremony");
    expect(isHeld(removeHold(two, "ceremony"))).toBe(true);
    expect(isHeld(removeHold(removeHold(two, "ceremony"), "ceremony"))).toBe(false);
  });

  it("never goes below zero (a stray release cannot pre-empt a later hold)", () => {
    const stray = removeHold(NO_HOLDS, "live");
    expect(stray.live).toBe(0);
    expect(isHeld(addHold(stray, "live"))).toBe(true);
  });
});

describe("the store", () => {
  beforeEach(() => useOverlayHolds.setState({ holds: NO_HOLDS, serial: 0 }));

  it("tournament → results: unlocks queued mid-run stay held until the last ceremony closes", () => {
    const { hold, release } = useOverlayHolds.getState();
    hold("live"); // the tournament phase (PlayView)
    // The results commit: the tournament hold goes, the ceremony's comes in —
    // both layout effects of one commit, so no render sees the gap.
    release("live");
    hold("ceremony"); // the special reveal…
    release("ceremony");
    hold("ceremony"); // …then the rank-up
    expect(selectHeld(useOverlayHolds.getState())).toBe(true);
    release("ceremony");
    expect(selectHeld(useOverlayHolds.getState())).toBe(false);
  });

  it("every new hold bumps the serial (a waiting pop-up settles again), a release does not", () => {
    const { hold, release } = useOverlayHolds.getState();
    const s0 = useOverlayHolds.getState().serial;
    hold("live");
    expect(useOverlayHolds.getState().serial).toBe(s0 + 1);
    release("live");
    expect(useOverlayHolds.getState().serial).toBe(s0 + 1);
    hold("ceremony");
    hold("ceremony");
    expect(useOverlayHolds.getState().serial).toBe(s0 + 3);
    release("ceremony");
    release("ceremony");
  });

  it("holders of different reasons are independent", () => {
    const { hold, release } = useOverlayHolds.getState();
    hold("intro");
    hold("live");
    release("intro");
    expect(selectHeld(useOverlayHolds.getState())).toBe(true);
    release("live");
    expect(selectHeld(useOverlayHolds.getState())).toBe(false);
  });
});
