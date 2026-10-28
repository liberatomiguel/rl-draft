"use client";

/**
 * Road to Worlds v2.0 (R40 review) — session-only reveal state, never in the save.
 *
 * The engine runs ahead of the event playback: on a Major / Worlds Saturday
 * it simulates the user's deciding Swiss series and the AI rounds after it
 * in one step, so the save sits at the Saturday pause (continueKind
 * "eventPaused") while the screen is still animating that series. The top
 * bar's routed Continue must not flip to "Championship Sunday" before the
 * playback shows the verdict — that would spoil it. EventPlayback holds the
 * event id here while Saturday's Swiss is still being revealed; the top bar
 * keeps the event's own Continue until the hold clears.
 *
 * rc.29 (CAR-02): the REVEAL CURSOR — how many rounds of an event the playback
 * has fully revealed — lives here too, mirrored to sessionStorage
 * (`rd:career:reveal:<careerSeed>:<eventId>`), so a reload or a trip to HQ
 * replays the unfinished round from its start instead of counting it as seen;
 * and while the cursor says a watched Saturday is still unrevealed, the top
 * bar, HQ and the calendar keep holding (careerUi.useRevealHeldEventId).
 * Session-scoped by design: a new tab resumes as before (everything simulated
 * counts as seen). Not a persist key — the career save stays untouched.
 */

import { create } from "zustand";

const CURSOR_PREFIX = "rd:career:reveal:";

/** The cursor key of one event of one career. */
export function revealCursorKey(careerSeed: number, eventId: string): string {
  return `${careerSeed}:${eventId}`;
}

/** Every cursor this tab wrote (an empty map on the server or without storage). */
function readSessionCursors(): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    if (typeof sessionStorage === "undefined") return out;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith(CURSOR_PREFIX)) continue;
      const n = Number(sessionStorage.getItem(k));
      if (Number.isInteger(n) && n >= 0) out[k.slice(CURSOR_PREFIX.length)] = n;
    }
  } catch {
    // Storage blocked (sandboxed frame, privacy mode): the in-memory map still works.
  }
  return out;
}

function writeSessionCursor(key: string, revealed: number): void {
  try {
    sessionStorage.setItem(CURSOR_PREFIX + key, String(revealed));
  } catch {
    // Best effort — see readSessionCursors.
  }
}

interface CareerRevealState {
  /** The event whose Saturday Swiss the playback is still revealing, or null. */
  heldEventId: string | null;
  setHeldEventId: (eventId: string | null) => void;
  /** rc.29 (CAR-02): fully revealed rounds per `revealCursorKey`. */
  cursors: Record<string, number>;
  setCursor: (key: string, revealed: number) => void;
}

export const useCareerRevealStore = create<CareerRevealState>()((set) => ({
  heldEventId: null,
  setHeldEventId: (heldEventId) => set({ heldEventId }),
  cursors: readSessionCursors(),
  setCursor: (key, revealed) =>
    set((state) => {
      if (state.cursors[key] === revealed) return state;
      writeSessionCursor(key, revealed);
      return { cursors: { ...state.cursors, [key]: revealed } };
    }),
}));
