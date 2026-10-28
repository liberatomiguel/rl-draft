"use client";

import { useEffect, useRef, useState } from "react";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";

/** Count-up number used on results / XP reveals. `play` (default true) holds
 *  the count at 0 until it turns true — e.g. while a ceremony covers it
 *  (rc.29, DRAFT-05). Once started it runs to the end even if `play` drops. */
export function AnimatedNumber({
  value,
  duration = 900,
  className,
  play = true,
}: {
  value: number;
  duration?: number;
  className?: string;
  play?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  // Reduced motion shows the final value straight away (derived in render).
  const reduced = useOsReducedMotion();

  useEffect(() => {
    let frame: number;
    if (reduced) {
      // Count as finished: turning motion back on later must not re-count.
      startRef.current = Number.NEGATIVE_INFINITY;
      frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    // Not started yet and still covered: wait at 0.
    if (!play && startRef.current === null) return;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced, play]);

  return <span className={className}>{reduced ? value : display}</span>;
}
