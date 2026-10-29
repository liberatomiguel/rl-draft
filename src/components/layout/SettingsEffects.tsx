"use client";

/**
 * Applies player settings to the document (v1.0): animation-speed scale and the
 * manual "Reduce visual effects" switch (rc.4, `reduce-fx`) — plus the automatic
 * `lite-fx` class for weak devices (globals.css → "Lite effects"). `<html lang>`
 * is LocaleRoot's since rc.32 (it is in the exported HTML). DOM-only side
 * effects in effects — no state writes, so it's React-Compiler safe. Classes are
 * added after hydration (never in the server HTML), so <html>'s className can't
 * mismatch.
 */

import { useEffect } from "react";
import { ANIM_SCALE, useSettings } from "@/store/settingsStore";

/**
 * `lite-fx` threshold: navigator.deviceMemory is Chromium-only and reports a
 * rounded bucket (0.25 · 0.5 · 1 · 2 · 4 · 8 GB), so ≤ 2 means a phone with
 * ~3 GB of RAM or less. Browsers that don't expose it never get lite-fx from
 * memory. A rendering heuristic, not a gameplay tunable (so not balance.ts).
 */
const LITE_FX_MAX_DEVICE_MEMORY_GB = 2;

export function SettingsEffects() {
  const animSpeed = useSettings((s) => s.animSpeed);
  const reduceEffects = useSettings((s) => s.reduceEffects);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--anim-scale", String(ANIM_SCALE[animSpeed]));
    root.classList.toggle("reduce-fx", reduceEffects);
  }, [animSpeed, reduceEffects]);

  // Automatic lite effects: low-memory device OR the OS asks for reduced
  // motion (followed live). Independent of the manual switch above, which
  // globals.css treats as a superset of it.
  useEffect(() => {
    const root = document.documentElement;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowMemory =
      typeof memory === "number" && memory > 0 && memory <= LITE_FX_MAX_DEVICE_MEMORY_GB;
    const osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      root.classList.toggle("lite-fx", lowMemory || osReducedMotion.matches);
    };
    apply();
    osReducedMotion.addEventListener("change", apply);
    return () => osReducedMotion.removeEventListener("change", apply);
  }, []);

  return null;
}
