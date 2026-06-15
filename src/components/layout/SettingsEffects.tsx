"use client";

/**
 * Applies player settings to the document (v1.0): animation-speed scale and a
 * manual reduced-motion override. DOM-only side effects in an effect — no
 * state writes, so it's React-Compiler safe.
 */

import { useEffect } from "react";
import { ANIM_SCALE, useSettings } from "@/store/settingsStore";

export function SettingsEffects() {
  const animSpeed = useSettings((s) => s.animSpeed);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const lang = useSettings((s) => s.lang);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--anim-scale", String(ANIM_SCALE[animSpeed]));
    root.classList.toggle("force-reduce-motion", reducedMotion);
    root.lang = lang === "pt" ? "pt-BR" : "en";
  }, [animSpeed, reducedMotion, lang]);

  return null;
}
