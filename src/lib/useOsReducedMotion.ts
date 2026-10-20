"use client";

/**
 * rc.4: the OS "reduce motion" preference, followed live. The game's own
 * "Reduce motion" switch is gone (it stalled the draft reel); screens that skip
 * an animated reveal (career event playback) read the OS setting through this.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useOsReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
