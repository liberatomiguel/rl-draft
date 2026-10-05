"use client";

/**
 * Road to Worlds v0.3 — the FIFA-style day autopilot (headless).
 *
 * Mounted once in the /career layout. While the store's `autoAdvance` switch
 * is ON, it ticks `advanceDay` every CAREER_PLAYBACK.autoAdvanceDayMs — and
 * pauses ITSELF the moment the career needs the manager:
 *  - continueKind ≠ "advance" (matchday lobby, decision, season review, end)
 *  - a fresh unofficial invite surfaced and isn't committed
 *  - the clock refused to move (blocked)
 * The user can pause any day from the TopBar; navigation never stops it —
 * the calendar keeps rolling on every career screen.
 */

import { useEffect, useRef } from "react";
import { CAREER_PLAYBACK } from "@/config/balance";
import { useCareerStore, selectActiveSave } from "@/store/careerStore";
import { continueKind } from "./careerUi";

export function CareerAutopilot() {
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const save = useCareerStore(selectActiveSave);
  const dayRef = useRef<number>(save?.clock.day ?? 0);

  useEffect(() => {
    if (!autoAdvance || !save) return;

    // Stop conditions checked BEFORE each tick (and re-checked after by the
    // next effect run, since advanceDay updates the store).
    if (continueKind(save) !== "advance" || save.phase !== "running") {
      setAutoAdvance(false);
      return;
    }
    if (save.unofficialOffer && !save.pendingEventDef) {
      setAutoAdvance(false);
      return;
    }

    dayRef.current = save.clock.day;
    const timer = setTimeout(() => {
      advanceDay();
      // A refused advance (blocked lobby / season end) must not spin forever.
      const after = selectActiveSave(useCareerStore.getState());
      if (after && after.clock.day === dayRef.current) {
        setAutoAdvance(false);
      }
    }, CAREER_PLAYBACK.autoAdvanceDayMs);
    return () => clearTimeout(timer);
  }, [autoAdvance, save, advanceDay, setAutoAdvance]);

  return null;
}
