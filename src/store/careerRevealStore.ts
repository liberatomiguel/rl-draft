"use client";

/**
 * Road to Worlds v2.0 (R40 review) — session-only reveal hold, never persisted.
 *
 * The engine runs ahead of the event playback: on a Major / Worlds Saturday
 * it simulates the user's deciding Swiss series and the AI rounds after it
 * in one step, so the save sits at the Saturday pause (continueKind
 * "eventPaused") while the screen is still animating that series. The top
 * bar's routed Continue must not flip to "Championship Sunday" before the
 * playback shows the verdict — that would spoil it. EventPlayback holds the
 * event id here while Saturday's Swiss is still being revealed; the top bar
 * keeps the event's own Continue until the hold clears.
 */

import { create } from "zustand";

interface CareerRevealState {
  /** The event whose Saturday Swiss the playback is still revealing, or null. */
  heldEventId: string | null;
  setHeldEventId: (eventId: string | null) => void;
}

export const useCareerRevealStore = create<CareerRevealState>()((set) => ({
  heldEventId: null,
  setHeldEventId: (heldEventId) => set({ heldEventId }),
}));
