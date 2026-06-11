"use client";

/**
 * Persistent player profile: XP, wins, collection, achievements, run history.
 * Stored in localStorage (guest play — base doc §31). Swapping this for a
 * Supabase-synced profile later only changes this module.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HISTORY_LIMIT } from "@/config/balance";
import type { Difficulty, RunHistoryEntry, RunResults } from "@/engine/types";

export interface ProfileState {
  xp: number;
  runsCompleted: number;
  wins: Record<Difficulty, number>;
  /** specialCardId → ISO date unlocked. */
  unlockedSpecials: Record<string, string>;
  /** achievementId → ISO date earned. */
  achievements: Record<string, string>;
  runHistory: RunHistoryEntry[];

  applyRunResults: (results: RunResults, entry: RunHistoryEntry) => void;
  resetAll: () => void;
}

const initialData = {
  xp: 0,
  runsCompleted: 0,
  wins: { easy: 0, normal: 0, hard: 0, legacy: 0 } as Record<Difficulty, number>,
  unlockedSpecials: {},
  achievements: {},
  runHistory: [],
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initialData,

      applyRunResults: (results, entry) =>
        set((state) => {
          const now = new Date().toISOString();

          const unlockedSpecials = { ...state.unlockedSpecials };
          for (const id of results.unlockedSpecialIds) {
            if (!unlockedSpecials[id]) unlockedSpecials[id] = now;
          }

          const achievements = { ...state.achievements };
          for (const id of results.newAchievementIds) {
            if (!achievements[id]) achievements[id] = now;
          }

          const wins = { ...state.wins };
          if (results.placement === "champion") {
            wins[entry.difficulty] += 1;
          }

          return {
            xp: state.xp + results.xp.total,
            runsCompleted: state.runsCompleted + 1,
            wins,
            unlockedSpecials,
            achievements,
            runHistory: [entry, ...state.runHistory].slice(0, HISTORY_LIMIT),
          };
        }),

      resetAll: () => set({ ...initialData }),
    }),
    {
      name: "rocket-draft:profile:v1",
      version: 1,
    },
  ),
);

/** Legacy difficulty unlock rule (base doc §7): win once on Hard. */
export function selectLegacyUnlocked(state: ProfileState): boolean {
  return state.wins.hard > 0 || state.wins.legacy > 0;
}

export function selectChampionships(state: ProfileState): number {
  return state.wins.easy + state.wins.normal + state.wins.hard + state.wins.legacy;
}

export function selectBestClear(state: ProfileState): Difficulty | null {
  if (state.wins.legacy > 0) return "legacy";
  if (state.wins.hard > 0) return "hard";
  if (state.wins.normal > 0) return "normal";
  if (state.wins.easy > 0) return "easy";
  return null;
}
