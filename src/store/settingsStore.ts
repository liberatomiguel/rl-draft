"use client";

/**
 * Player settings (v1.0): sound, motion, animation speed, language.
 * Persisted to localStorage. Read by the SFX layer, the SettingsEffects
 * applier (CSS), the tournament playback default and (next pass) i18n.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  /** Manual override on top of the OS prefers-reduced-motion. */
  reducedMotion: boolean;
  animSpeed: AnimSpeedKey;
  /** UI language (wired now; the PT-BR dictionary lands in the i18n pass). */
  lang: "en" | "pt";

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetSettings: () => void;
}

const DEFAULTS = {
  soundEnabled: true,
  soundVolume: 0.6,
  reducedMotion: false,
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
    { name: "rocket-draft:settings:v1" },
  ),
);
