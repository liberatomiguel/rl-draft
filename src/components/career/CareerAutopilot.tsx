"use client";

/**
 * Road to Worlds v0.3 — the FIFA-style day autopilot (headless).
 *
 * Mounted once in the /career layout. While the store's `autoAdvance` switch
 * is ON, it ticks `advanceDay` every CAREER_PLAYBACK.autoAdvanceDayMs — and
 * pauses ITSELF the moment the career needs the manager:
 *  - continueKind ≠ "advance" (matchday lobby, decision, season review, end;
 *    R40: the Saturday pause before Championship Sunday — never rolled into
 *    on its own)
 *  - a fresh unofficial invite surfaced — once, on its Monday (rc.34 review,
 *    Gate 3b: it never holds the clock; switched on again that Monday, the
 *    autoplay rolls past it, and past its matchday it is passed)
 *  - a money notice is waiting (rc.34: the emergency loan, a top-up, the
 *    deadline's warnings or the deadline itself — MoneyNoticeModal)
 *  - the clock refused to move (blocked)
 * The user can pause any day from the TopBar; navigation never stops it —
 * the calendar keeps rolling on every career screen.
 */

import { trainingReportOf } from "@/store/careerTraining";
import { useEffect, useRef } from "react";
import { CAREER_PLAYBACK } from "@/config/balance";
import { inviteSurfacedToday, moneyNoticeOf } from "@/store/careerFlow";
import { useCareerStore, selectActiveSave } from "@/store/careerStore";
import { continueKind } from "./careerUi";

export function CareerAutopilot() {
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const save = useCareerStore(selectActiveSave);
  const dayRef = useRef<number>(save?.clock.day ?? 0);
  /** The day this run of the autoplay started on ("season:day"; null while it is off). */
  const startRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoAdvance) startRef.current = null;
  }, [autoAdvance]);

  useEffect(() => {
    if (!autoAdvance || !save) return;
    const today = `${save.clock.seasonIndex}:${save.clock.day}`;
    startRef.current ??= today;

    // Stop conditions checked BEFORE each tick (and re-checked after by the
    // next effect run, since advanceDay updates the store).
    if (continueKind(save) !== "advance" || save.phase !== "running") {
      setAutoAdvance(false);
      return;
    }
    if (inviteSurfacedToday(save) && startRef.current !== today) {
      setAutoAdvance(false);
      return;
    }
    // rc.34: a money notice (the emergency loan, a top-up, the deadline) waits to be read.
    if (moneyNoticeOf(save)) {
      setAutoAdvance(false);
      return;
    }
    // rc.35 review: a finished training cycle's report waits to be read (two cycles never stack).
    if (trainingReportOf(save)) {
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
