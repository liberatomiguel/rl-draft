"use client";

/**
 * Persistent player profile: XP, wins, collection, achievements, run history.
 * Stored in localStorage (guest play — base doc §31). Swapping this for a
 * Supabase-synced profile later only changes this module.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HISTORY_LIMIT, MMR, mmrAfterRun, mmrBackfillFloor } from "@/config/balance";
import { achievementById, specialCardById, specialCards } from "@/data";
import { evaluateCounterAchievements } from "@/engine/achievements";
import { rankForXp, rankRewardsForXp } from "@/engine/progression";
import type { DurableProfile } from "@/lib/profileSync";
import { useAchievementToasts } from "./achievementToastStore";
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
  /** Cosmetic skill rating (v1.4), parallel to XP. Starts at MMR.start, rises a
   *  small amount per run, never spent or lost. Profile card + leaderboard only. */
  mmr: number;
  /** MMR gained on the most recent finished run — for the results screen readout.
   *  Transient/display only (NOT in the durable sync slice). */
  lastMmrGain: number;
  runsCompleted: number;
  wins: Record<Difficulty, number>;
  /** Lifetime counters (beyond the capped run history). */
  playoffAppearances: number;
  podiums: number;
  swissWinsTotal: number;
  /** Lifetime individual game wins + goals scored (v1.4 — achievement counters). */
  gamesWon: number;
  goalsScored: number;
  /** specialCardId → ISO date unlocked. */
  unlockedSpecials: Record<string, string>;
  /** achievementId → ISO date earned. */
  achievements: Record<string, string>;
  runHistory: RunHistoryEntry[];
  /** ISO date → daily challenge result. */
  dailyResults: Record<string, DailyResult>;
  /** challengeId → ISO date cleared (v1.4, one-and-done like achievements). */
  challengesCompleted: Record<string, string>;
  /** Leaderboard aggregates (v1.4): peak team overall per difficulty and per pool
   *  (worldwide vs SAM). The durable feed for the cloud leaderboards. */
  records: {
    bestOverall: Record<Difficulty, number>;
    bestOverallWorldwide: number;
    bestOverallSam: number;
  };
  /** Setup memory: a new game pre-selects the last configuration. */
  settings: {
    lastDifficulty: Difficulty;
    lastShowOverall: boolean;
    lastMode: RunMode;
    /** Last region lock chosen on the setup screen; null = worldwide. */
    lastRegionLock: Region | null;
  };
  /** One-time onboarding flags (first-run how-to-play, first Legacy/regional intro). */
  flags: {
    seenHowToPlay: boolean;
    seenLegacyIntro: boolean;
    seenRegionalIntro: boolean;
    /** First-launch full-screen feature tour (v1.3.1). */
    seenTutorial: boolean;
  };

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
  /** Mark a challenge cleared (v1.4) — idempotent: re-clearing never re-rewards. */
  completeChallenge: (
    challengeId: string,
    reward: { xp: number; badge?: string; specialId?: string },
  ) => void;
  /** Replace the durable slice wholesale (v1.4 cloud sync — after a merge). */
  hydrateDurable: (durable: DurableProfile) => void;
  /** Award achievements the MOMENT they're earned (v1.4): mark + grant XP +
   *  toast the genuinely-new ones. Used for the real-time mid-run feats. */
  awardAchievements: (ids: string[]) => void;
  resetAll: () => void;
}

const initialData = {
  xp: 0,
  mmr: MMR.start,
  lastMmrGain: 0,
  runsCompleted: 0,
  wins: { easy: 0, normal: 0, hard: 0, legacy: 0 } as Record<Difficulty, number>,
  playoffAppearances: 0,
  podiums: 0,
  swissWinsTotal: 0,
  gamesWon: 0,
  goalsScored: 0,
  unlockedSpecials: {},
  achievements: {},
  runHistory: [] as RunHistoryEntry[],
  dailyResults: {} as Record<string, DailyResult>,
  challengesCompleted: {} as Record<string, string>,
  records: {
    bestOverall: { easy: 0, normal: 0, hard: 0, legacy: 0 } as Record<Difficulty, number>,
    bestOverallWorldwide: 0,
    bestOverallSam: 0,
  },
  settings: {
    lastDifficulty: "normal" as Difficulty,
    lastShowOverall: true,
    lastMode: "classic" as RunMode,
    lastRegionLock: null as Region | null,
  },
  flags: {
    seenHowToPlay: false,
    seenLegacyIntro: false,
    seenRegionalIntro: false,
    seenTutorial: false,
  },
};

type Records = ProfileState["records"];

/** Fold one finished run into the peak-overall records (monotonic — only rises). */
function bumpRecords(records: Records, entry: RunHistoryEntry): Records {
  const next: Records = {
    bestOverall: { ...records.bestOverall },
    bestOverallWorldwide: records.bestOverallWorldwide,
    bestOverallSam: records.bestOverallSam,
  };
  const ovr = entry.teamOverall;
  next.bestOverall[entry.difficulty] = Math.max(next.bestOverall[entry.difficulty] ?? 0, ovr);
  if (entry.region === "SAM") next.bestOverallSam = Math.max(next.bestOverallSam, ovr);
  else if (!entry.region) next.bestOverallWorldwide = Math.max(next.bestOverallWorldwide, ovr);
  return next;
}

/** Rebuild records from a run history (migration backfill — pre-v4 entries have
 *  no region, so they count as worldwide). */
function backfillRecords(history: RunHistoryEntry[]): Records {
  return history.reduce(bumpRecords, initialData.records);
}

/**
 * Drop earned-achievement ids that no longer exist in the current set. The v1.4
 * swap replaced EVERY id, so a stale earned-map would inflate the unlocked count
 * (e.g. show "28 unlocked" while the grid renders almost nothing). Pure; applied
 * on every path a durable profile enters the store — the persist migrate, cloud
 * `hydrateDurable`, and the cloud merge in `accountStore` — so the count self-heals
 * for signed-in players too, not just on local rehydration. Exported for the
 * account sync path. (v1.4)
 */
export function pruneEarnedAchievements(
  m: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(m ?? {}).filter(([id]) => achievementById.has(id)),
  );
}

/**
 * Same idea for unlocked specials: drop ids no longer in the hand-curated
 * `specialCards.json`. A removed/renamed special would otherwise inflate the
 * Collection counter ("X / N" with X counting ghosts) and the `specialsOwned`
 * achievement counter, even though no card renders for it. (v1.4)
 */
export function pruneUnlockedSpecials(
  m: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(m ?? {}).filter(([id]) => specialCardById.has(id)),
  );
}

/**
 * Counter / collection / rank achievements ALREADY satisfied by a profile's
 * career totals. Used by the migrate to SILENTLY pre-mark them when the v1.4
 * achievement set is introduced, so an existing player doesn't get a flood of
 * toasts for milestones they passed long ago (e.g. "Score 100 goals across all
 * your runs" firing on their first post-update run). No XP is granted — the old
 * set already rewarded the equivalent milestones; this is purely a no-surprise
 * reconciliation. Daily-streak is intentionally left out (re-earns naturally).
 * (v1.4)
 */
function backfillSatisfiedCounters(
  p: Pick<ProfileState, "xp" | "runsCompleted" | "wins" | "gamesWon" | "goalsScored" | "unlockedSpecials">,
  alreadyEarned: ReadonlySet<string>,
  now: string,
): Record<string, string> {
  const specialIds = new Set(Object.keys(p.unlockedSpecials ?? {}));
  const ids = evaluateCounterAchievements(
    {
      runsCompleted: p.runsCompleted ?? 0,
      titlesTotal: p.wins.easy + p.wins.normal + p.wins.hard + p.wins.legacy,
      legacyTitles: p.wins.legacy,
      gamesWon: p.gamesWon ?? 0,
      goalsScored: p.goalsScored ?? 0,
      specialsOwned: specialIds.size,
      totalSpecials: specialCards.length,
      specialIds,
      dailyStreak: 0,
      rankId: rankForXp(p.xp ?? 0).id,
    },
    alreadyEarned,
  );
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = now;
  return out;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initialData,

      applyRunResults: (results, entry, daily) => {
        const freshToasts: string[] = [];
        set((state) => {
          const now = new Date().toISOString();

          const unlockedSpecials = { ...state.unlockedSpecials };
          for (const id of results.unlockedSpecialIds) {
            if (!unlockedSpecials[id]) unlockedSpecials[id] = now;
          }

          const achievements = { ...state.achievements };
          for (const id of results.newAchievementIds) {
            if (!achievements[id]) {
              achievements[id] = now;
              freshToasts.push(id);
            }
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

          const runsCompleted = state.runsCompleted + 1;
          const gamesWon = state.gamesWon + results.userGameWins;
          const goalsScored = state.goalsScored + results.userGoals;
          // results.xp.total already includes the run-state achievement XP.
          const xpAfterRun = state.xp + results.xp.total;
          // Cosmetic MMR (v1.4): damped per-run gain from the same outcome fields
          // (placement + Swiss wins + difficulty + regional title bonus), converging
          // toward the soft cap. `lastMmrGain` feeds the results-screen readout.
          const mmr = mmrAfterRun(
            state.mmr,
            entry.difficulty,
            results.placement,
            entry.region != null,
            entry.swissRecord.wins,
          );
          const lastMmrGain = mmr - state.mmr;

          // Lifetime counters / collection / rank achievements — evaluated AFTER
          // this run is applied, then awarded with their XP (v1.4).
          const counterIds = evaluateCounterAchievements(
            {
              runsCompleted,
              titlesTotal: wins.easy + wins.normal + wins.hard + wins.legacy,
              legacyTitles: wins.legacy,
              gamesWon,
              goalsScored,
              specialsOwned: Object.keys(unlockedSpecials).length,
              totalSpecials: specialCards.length,
              specialIds: new Set(Object.keys(unlockedSpecials)),
              dailyStreak: selectDailyStreak({ ...state, dailyResults } as ProfileState),
              rankId: rankForXp(xpAfterRun).id,
            },
            new Set(Object.keys(achievements)),
          );
          let counterXp = 0;
          for (const id of counterIds) {
            if (!achievements[id]) {
              achievements[id] = now;
              counterXp += achievementById.get(id)?.xp ?? 0;
              freshToasts.push(id);
            }
          }

          return {
            xp: xpAfterRun + counterXp,
            mmr,
            lastMmrGain,
            runsCompleted,
            wins,
            playoffAppearances: state.playoffAppearances + (madePlayoffs ? 1 : 0),
            podiums: state.podiums + (podium ? 1 : 0),
            swissWinsTotal: state.swissWinsTotal + entry.swissRecord.wins,
            gamesWon,
            goalsScored,
            unlockedSpecials,
            achievements,
            runHistory: [entry, ...state.runHistory].slice(0, HISTORY_LIMIT),
            dailyResults,
            records: bumpRecords(state.records, entry),
          };
        });
        if (freshToasts.length) useAchievementToasts.getState().push(freshToasts);
      },

      setLastSetup: (lastDifficulty, lastShowOverall, lastMode, lastRegionLock) =>
        set({ settings: { lastDifficulty, lastShowOverall, lastMode, lastRegionLock } }),

      markFlag: (flag) => set((state) => ({ flags: { ...state.flags, [flag]: true } })),

      completeChallenge: (challengeId, reward) =>
        set((state) => {
          if (state.challengesCompleted[challengeId]) return {}; // one-and-done
          const now = new Date().toISOString();
          const unlockedSpecials = { ...state.unlockedSpecials };
          // An earned reward special bypasses the rank rarity-gate — it just lands
          // in the collection (challenge design §9-B).
          if (reward.specialId && !unlockedSpecials[reward.specialId]) {
            unlockedSpecials[reward.specialId] = now;
          }
          return {
            xp: state.xp + reward.xp,
            challengesCompleted: { ...state.challengesCompleted, [challengeId]: now },
            unlockedSpecials,
          };
        }),

      hydrateDurable: (durable) =>
        set(() => ({
          ...durable,
          achievements: pruneEarnedAchievements(durable.achievements),
          unlockedSpecials: pruneUnlockedSpecials(durable.unlockedSpecials),
        })),

      awardAchievements: (ids) => {
        const fresh: string[] = [];
        set((state) => {
          const achievements = { ...state.achievements };
          const now = new Date().toISOString();
          let xp = 0;
          for (const id of ids) {
            if (!achievements[id]) {
              achievements[id] = now;
              xp += achievementById.get(id)?.xp ?? 0;
              fresh.push(id);
            }
          }
          return fresh.length ? { achievements, xp: state.xp + xp } : {};
        });
        if (fresh.length) useAchievementToasts.getState().push(fresh);
      },

      resetAll: () => set({ ...initialData }),
    }),
    {
      name: "rocket-draft:profile:v1",
      version: 9,
      // v2 added lifetime counters/daily/setup memory; v3 added the regional
      // lock setting + regional onboarding flag; v4 added challengesCompleted;
      // v5 added the leaderboard `records` (backfilled from runHistory below);
      // v6 added the gamesWon/goalsScored counters (default 0 — they only
      // accrue going forward); v7 prunes earned-achievement ids that no longer
      // exist (the v1.4 set replaced every id, so old earned ids would inflate
      // the count); v8 (a) routes that prune through pruneEarnedAchievements and
      // (b) SILENTLY backfills already-satisfied counter achievements so the v1.4
      // set swap doesn't toast a flood of old milestones; v9 re-runs the MMR
      // backfill after the scale rework (so it lands in the 1500-2000 range) and
      // prunes ghost specials. All backfill from initialData via the deep-merge.
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
        // Deep-merge settings/flags so new keys get defaults on older profiles;
        // rebuild records from history when they're missing (pre-v5 saves);
        // drop earned-achievement ids that no longer exist (v1.4 swap).
        const merged = {
          ...initialData,
          ...base,
          achievements: pruneEarnedAchievements(base.achievements),
          unlockedSpecials: pruneUnlockedSpecials(base.unlockedSpecials),
          settings: { ...initialData.settings, ...(base.settings ?? {}) },
          flags: { ...initialData.flags, ...(base.flags ?? {}) },
          records: base.records ?? backfillRecords(base.runHistory ?? []),
        } as ProfileState;
        // v8: silently pre-mark already-earned counter achievements (no toast,
        // no XP) so the set swap is invisible to players who already cleared the
        // equivalent milestones under the old set.
        const backfilled = backfillSatisfiedCounters(
          merged,
          new Set(Object.keys(merged.achievements)),
          new Date().toISOString(),
        );
        return {
          ...merged,
          achievements: { ...merged.achievements, ...backfilled },
          // v8/v9: seed MMR for veterans from their history so a Supersonic Legend
          // doesn't land on the board at 200 (no reset needed). v9 re-runs it after
          // the MMR scale rework so existing players get the new (1500-2000-range)
          // values.
          mmr: Math.max(merged.mmr, mmrBackfillFloor(merged.wins, merged.podiums, merged.runsCompleted)),
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
 * Hard mode unlocks at Silver (v1.3) — the rank ladder now gates difficulty too.
 * Back-compat: anyone who already WON Hard/Legacy keeps access even if their XP
 * predates the gate, so no existing player is locked out of a mode they cleared.
 */
export function selectHardUnlocked(state: ProfileState): boolean {
  return rankRewardsForXp(state.xp).hardMode || state.wins.hard > 0 || state.wins.legacy > 0;
}

/** Collection screen unlocks at Bronze (v1.3); Unranked has it locked. */
export function selectCollectionUnlocked(state: ProfileState): boolean {
  return rankRewardsForXp(state.xp).collection;
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
