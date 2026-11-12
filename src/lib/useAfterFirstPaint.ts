"use client";

import { startTransition, useEffect, useState } from "react";

/**
 * v2.0 (P1): false until the screen has painted once, then true — for a heavy
 * block below the fold (the profile's achievements grid: about half of the
 * page's 1,800 nodes). Mounted with the rest, it sat in the same task as the
 * hero: one 450 ms block on a phone before anything showed. Mounted after the
 * first paint, inside a transition, React builds it in slices that yield to
 * input.
 *
 * The caller renders a placeholder of the block's own kind until then.
 */
export function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // rAF runs before the frame paints; the timeout it queues runs after it.
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => startTransition(() => setPainted(true)), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
  return painted;
}
