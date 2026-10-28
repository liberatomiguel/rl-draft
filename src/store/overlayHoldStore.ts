"use client";

/**
 * Overlay holds (rc.29, E2E DRAFT-02 / DRAFT-13): while a full-screen moment is
 * in front, the quieter pop-ups behind it wait their turn — so two dialogs
 * never stack, and nothing opens over a live tournament or pre-announces the
 * results ceremony.
 *
 *   "intro"     the first-run tour or the season recap (home)
 *   "live"      a Draft tournament in progress, a challenge series playing
 *   "ceremony"  a results / challenge ceremony on screen (CeremonyPortal)
 *
 * Waiting: the daily-login calendar and the cosmetic unlock pop-up (both in
 * AppShell). The unlock pop-up also waits for the login calendar, so the order
 * after a run is: ceremonies → login calendar (if due) → unlocks.
 *
 * Holders register with `useOverlayHold` — a LAYOUT effect, so the hold is in
 * place before the browser paints. A hold can still land in the same commit
 * as what it holds back (one click on "Start Tournament" both awards a feat
 * that unlocks a cosmetic and enters the live phase), so the waiting pop-ups
 * also wait one frame (`useSettled`) before they mount, play a sting or take
 * the focus. Light on purpose (zustand + react only): the shared path reads it.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { create } from "zustand";

export type HoldReason = "intro" | "live" | "ceremony";

export type HoldCounts = Record<HoldReason, number>;

interface OverlayHoldStore {
  /** Active holders per reason (several components may hold the same one). */
  holds: HoldCounts;
  /** Bumped by every new hold: a waiting pop-up settles again after one. */
  serial: number;
  hold: (reason: HoldReason) => void;
  release: (reason: HoldReason) => void;
}

export const NO_HOLDS: HoldCounts = { intro: 0, live: 0, ceremony: 0 };

/** The counts after one more `reason` holder (pure — the store's update). */
export function addHold(holds: HoldCounts, reason: HoldReason): HoldCounts {
  return { ...holds, [reason]: holds[reason] + 1 };
}

/** The counts after one `reason` holder lets go (never below zero). */
export function removeHold(holds: HoldCounts, reason: HoldReason): HoldCounts {
  return { ...holds, [reason]: Math.max(0, holds[reason] - 1) };
}

/** Anything in front: the login calendar and the unlock pop-up wait. */
export function isHeld(holds: HoldCounts): boolean {
  return holds.intro > 0 || holds.live > 0 || holds.ceremony > 0;
}

export const useOverlayHolds = create<OverlayHoldStore>((set) => ({
  holds: NO_HOLDS,
  serial: 0,
  hold: (reason) => set((s) => ({ holds: addHold(s.holds, reason), serial: s.serial + 1 })),
  release: (reason) => set((s) => ({ holds: removeHold(s.holds, reason) })),
}));

/** Selector for the waiting pop-ups. */
export const selectHeld = (s: { holds: HoldCounts }): boolean => isHeld(s.holds);

/**
 * `ready`, a frame late on the way in (immediate on the way out): a waiting
 * pop-up appears only once it has stayed ready for one animation frame with no
 * new hold (`serial`), so a hold arriving in the same commit cancels it before
 * it ever mounts. Once shown it stays put while ready (next item, new pushes).
 */
export function useSettled(ready: boolean): boolean {
  const serial = useOverlayHolds((s) => s.serial);
  const [settledAt, setSettledAt] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettledAt(ready ? serial : null));
    return () => cancelAnimationFrame(frame);
  }, [ready, serial]);
  return ready && settledAt === serial;
}

/** Hold `reason` while `active` (released on unmount). */
export function useOverlayHold(reason: HoldReason, active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    const { hold, release } = useOverlayHolds.getState();
    hold(reason);
    return () => release(reason);
  }, [reason, active]);
}
