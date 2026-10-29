"use client";

/**
 * Player settings (v1.0): sound, visual effects, animation speed, language.
 * Persisted to localStorage. Read by the SFX layer, the SettingsEffects
 * applier (CSS), the tournament playback default and (next pass) i18n.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAnalyticsLocaleSource } from "@/lib/analytics";
import { reportingJSONStorage } from "./persistStorage";

export type AnimSpeedKey = "slow" | "normal" | "fast";

/** CSS duration multiplier per speed (smaller = faster animations). */
export const ANIM_SCALE: Record<AnimSpeedKey, number> = {
  slow: 1.45,
  normal: 1,
  fast: 0.6,
};

/** Default tournament auto-playback speed derived from the animation speed. */
export const ANIM_TOURNAMENT_SPEED: Record<AnimSpeedKey, 1 | 2 | 4> = {
  slow: 1,
  normal: 1,
  fast: 2,
};

export interface SettingsState {
  soundEnabled: boolean;
  /** 0..1 */
  soundVolume: number;
  /** rc.4: "Reduce visual effects" (performance). Replaced "Reduce motion", whose
   *  manual override stopped the draft reel and stalled the draft. Sets
   *  `html.reduce-fx` (+ lite-fx); never stops an animation the game waits on. */
  reduceEffects: boolean;
  animSpeed: AnimSpeedKey;
  /** UI language (wired now; the PT-BR dictionary lands in the i18n pass). */
  lang: "en" | "pt";

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetSettings: () => void;
}

const DEFAULTS = {
  soundEnabled: true,
  soundVolume: 0.6,
  reduceEffects: false,
  animSpeed: "normal" as AnimSpeedKey,
  lang: "en" as const,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    { name: "rocket-draft:settings:v1", storage: reportingJSONStorage("settings") },
  ),
);

// OBS-01: every analytics event carries the UI language as `locale`.
setAnalyticsLocaleSource(() => useSettings.getState().lang);
