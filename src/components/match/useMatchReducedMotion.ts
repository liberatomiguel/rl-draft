"use client";

/**
 * rc9 MATCHDAY: true when the live view must not animate: the OS reduced
 * motion setting, or the game's own `html.reduce-fx` (Settings) or
 * `html.lite-fx` (slow device) class. Followed live.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function read(): boolean {
  const cls = document.documentElement.classList;
  return window.matchMedia(QUERY).matches || cls.contains("reduce-fx") || cls.contains("lite-fx");
}

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    mq.removeEventListener("change", onChange);
    mo.disconnect();
  };
}

export function useMatchReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
