"use client";

/**
 * Persistent player profile: XP, wins, collection, achievements, run history.
 * Stored in localStorage (guest play — base doc §31). Swapping this for a
 * Supabase-synced profile later only changes this module.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HISTORY_LIMIT } from "@/config/balance";
import type {
  Difficulty,
  Placement,
  Region,
  RunHistoryEntry,
  RunMode,
  RunResults,
} from "@/engine/types";

export interface DailyResult {
  placement: Placement;
  xp: number;
  label: string;
}

export interface ProfileState {
  xp: number;
  runsCompleted: number;
  wins: Record<Difficulty, number>;
  /** Lifetime counters (beyond the capped run history). */
  playoffAppearances: number;
  podiums: number;
  swissWinsTotal: number;
  /** specialCardId → ISO date unlocked. */
  unlockedSpecials: Record<string, string>;
  /** achievementId → ISO date earned. */
  achievements: Record<string, string>;
  runHistory: RunHistoryEntry[];
  /** ISO date → daily challenge result. */
  dailyResults: Record<string, DailyResult>;
  /** Setup memory: a new game pre-selects the last configuration. */
  settings: {
    lastDifficulty: Difficulty;
    lastShowOverall: boolean;
    lastMode: RunMode;
    /** Last region lock chosen on the setup screen; null = worldwide. */
    lastRegionLock: Region | null;
  };
  /** One-time onboarding flags (first-run how-to-play, first Legacy/regional intro). */
  flags: { seenHowToPlay: boolean; seenLegacyIntro: boolean; seenRegionalIntro: boolean };

  applyRunResults: (
    results: RunResults,
    entry: RunHistoryEntry,
    daily?: { date: string; label: string },
  ) => void;
  setLastSetup: (
    difficulty: Difficulty,
    showOverall: boolean,
    mode: RunMode,
    regionLock: Region | null,
  ) => void;
  markFlag: (flag: keyof ProfileState["flags"]) => void;
  resetAll: () => void;
}

const initialData = {
  xp: 0,
  runsCompleted: 0,
  wins: { easy: 0, normal: 0, hard: 0, legacy: 0 } as Record<Difficulty, number>,
  playoffAppearances: 0,
  podiums: 0,
  swissWinsTotal: 0,
  unlockedSpecials: {},
  achievements: {},
  runHistory: [] as RunHistoryEntry[],
  dailyResults: {} as Record<string, DailyResult>,
  settings: {
    lastDifficulty: "normal" as Difficulty,
    lastShowOverall: true,
    lastMode: "classic" as RunMode,
    lastRegionLock: null as Region | null,
  },
  flags: { seenHowToPlay: false, seenLegacyIntro: false, seenRegionalIntro: false },
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initialData,

      applyRunResults: (results, entry, daily) =>
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

          const madePlayoffs = results.placement !== "swiss_exit";
          const podium = ["champion", "runner_up", "third"].includes(results.placement);

          const dailyResults = { ...state.dailyResults };
          if (daily) {
            dailyResults[daily.date] = {
              placement: results.placement,
              xp: results.xp.total,
              label: daily.label,
            };
          }

          return {
            xp: state.xp + results.xp.total,
            runsCompleted: state.runsCompleted + 1,
            wins,
            playoffAppearances: state.playoffAppearances + (madePlayoffs ? 1 : 0),
            podiums: state.podiums + (podium ? 1 : 0),
            swissWinsTotal: state.swissWinsTotal + entry.swissRecord.wins,
            unlockedSpecials,
            achievements,
            runHistory: [entry, ...state.runHistory].slice(0, HISTORY_LIMIT),
            dailyResults,
          };
        }),

      setLastSetup: (lastDifficulty, lastShowOverall, lastMode, lastRegionLock) =>
        set({ settings: { lastDifficulty, lastShowOverall, lastMode, lastRegionLock } }),

      markFlag: (flag) => set((state) => ({ flags: { ...state.flags, [flag]: true } })),

      resetAll: () => set({ ...initialData }),
    }),
    {
      name: "rocket-draft:profile:v1",
      version: 3,
      // v2 added lifetime counters/daily/setup memory; v3 added the regional
      // lock setting + regional onboarding flag (backfilled for old saves).
      migrate: (persisted, version) => {
        const prev = (persisted ?? {}) as Partial<ProfileState>;
        const base =
          version < 2
            ? {
                ...initialData,
                ...prev,
                playoffAppearances: 0,
                podiums: 0,
                swissWinsTotal: 0,
                dailyResults: {},
                settings: initialData.settings,
                flags: initialData.flags,
              }
            : prev;
        // Deep-merge settings/flags so new keys get defaults on older profiles.
        return {
          ...initialData,
          ...base,
          settings: { ...initialData.settings, ...(base.settings ?? {}) },
          flags: { ...initialData.flags, ...(base.flags ?? {}) },
        } as ProfileState;
      },
    },
  ),
);

/** Legacy difficulty unlock rule (base doc §7): win once on Hard. */
export function selectLegacyUnlocked(state: ProfileState): boolean {
  return state.wins.hard > 0 || state.wins.legacy > 0;
}

/**
 * Consecutive daily-challenge VICTORIES (champion runs), ending today or
 * yesterday. A played-but-lost day breaks the streak — losses don't count
 * as completed.
 */
export function selectDailyStreak(state: ProfileState): number {
  const day = 24 * 60 * 60 * 1000;
  let cursor = Date.now();
  let streak = 0;
  const won = (date: string) => state.dailyResults[date]?.placement === "champion";
  // Allow the streak to be alive if today's challenge is still pending.
  const today = new Date(cursor).toISOString().slice(0, 10);
  if (!won(today)) cursor -= day;
  while (won(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= day;
  }
  return streak;
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
