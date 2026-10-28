"use client";

/**
 * Persistent player profile: XP, wins, collection, achievements, run history.
 * Stored in localStorage (guest play — base doc §31). Swapping this for a
 * Supabase-synced profile later only changes this module.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  HISTORY_LIMIT,
  mmrBackfillFloor,
  RANKS,
  SEASON_RATING,
  seasonRatingAfter,
  seasonRatingDelta,
} from "@/config/balance";
import { achievementById, specialCardIds } from "@/data/catalog";
import { COUNTS, isNationalSpecialId } from "@/data/counts";
import { evaluateCounterAchievements } from "@/engine/counterAchievements";
import { rankForXp, rankRewardsForXp } from "@/engine/progression";
import {
  cosmeticFacts,
  EMPTY_COSMETICS,
  markSeen,
  newlyOwnedIds,
  refreshOwned,
  sanitizeEquipped,
  type CosmeticsState,
  type EquippedState,
} from "@/engine/cosmetics";
import {
  applyMissionEvent as foldMissionEvent,
  EMPTY_LOGIN,
  EMPTY_MISSIONS,
  missionById,
  recordLogin as countLogin,
  rollMissions as rollMissionPeriods,
  type LoginState,
  type MissionApplyResult,
  type MissionEligibility,
  type MissionEvent,
  type MissionsState,
} from "@/engine/missions";
import {
  applyGuess,
  EMPTY_QUIZ,
  foldQuizDay,
  type QuizPuzzle,
  type QuizState,
} from "@/engine/quizState";
import {
  freshSeason,
  normalizeToSeason,
  pushRatingHistory,
  type LegacyState,
  type SeasonState,
} from "@/engine/season";
import { FEATURES, MISSIONS } from "@/config/balance";
import type { DurableProfile } from "@/lib/profileSync";
import { useAchievementToasts } from "./achievementToastStore";
import { useCosmeticUnlocks } from "./cosmeticUnlockStore";
import { useRewardToasts } from "./rewardToastStore";
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
  /** SEASON XP (v2.0): resets every season; drives the rank ladder and every
   *  rank-gated reward. Cumulative XP lives in `lifetime.xp`. */
  xp: number;
  /** SEASON RATING (v2.0, still named `mmr` for every existing reader): the
   *  competitive number behind the Season leaderboard. Starts at
   *  `SEASON_RATING.start`, moves by placement × difficulty, floor 0. */
  mmr: number;
  /** Signed rating delta of the most recent finished run — for the results
   *  readout. Transient/display only (NOT in the durable sync slice). */
  lastMmrGain: number;
  /** Season-scoped bookkeeping: which season `xp`/`mmr` belong to, peaks, runs,
   *  titles and the rating history (v2.0). */
  season: SeasonState;
  /** Never reset: cumulative XP across seasons (v2.0). */
  lifetime: { xp: number };
  /** Archived pre-season achievements, frozen at the Season 1 reset (v2.0). */
  legacy: LegacyState;
  /** Server-owned manual grants (`supporter` / `pro` / `contributor`), read from the
   *  cloud on every sync and unioned — never written by the client (v2.0). */
  grants: string[];
  /** Titles / badges / frames / banners: `owned` is DERIVED from the profile's facts
   *  (refreshed on every progress write), `equipped` holds explicit choices (v2.0). */
  cosmetics: CosmeticsState;
  /** Daily + weekly missions (v2.0): the current sets, progress and completions. */
  missions: MissionsState;
  /** Login streak (v2.0): first open of a UTC day counts. */
  login: LoginState;
  /** Special Hunt progress (v2.0): event special id → runs finished while its
   *  window was live. Never pruned (a few bytes per event; the id is the key). */
  events: Record<string, { runs: number }>;
  /** Daily Quiz results + counters (v2.0). */
  quiz: QuizState;
  /** Legacy difficulty gate (v1.4): set once by a real Classic/Quick Hard (or Legacy)
   *  championship. Decoupled from `wins` so Daily/Challenge titles never open Legacy. */
  legacyUnlocked: boolean;
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
  /** challengeId → star bit mask (bit 0 = clear, 1 = star 2, 2 = star 3), v2.0. */
  challengeStars: Record<string, number>;
  /** v2.0 (career R32): career achievement ids mirrored here so cosmetics can derive from them. */
  careerMarks: string[];
  /** rc.4: Road to Worlds World Championships won, across every career save
   *  (World Champion badges). This season's share lives in `season.careerWorlds`. */
  careerWorldsWon: number;
  /** rc.20: consecutive Legacy-difficulty titles — the live run and the best
   *  ever (the "On a Roll" / "Heatwave" cosmetics read `best`). A lost Legacy
   *  run resets `current`; other difficulties leave it alone. */
  legacyStreak: { current: number; best: number };
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
    /** The pre-season → Season 1 recap ("Your Legacy Lives On"), v2.0. */
    seenSeasonRecap: boolean;
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
  /** Record a finished challenge attempt (v2.0): OR the star mask in, pay XP for the
   *  stars that are NEW (clear = `reward.xp`, each extra star = `CHALLENGE.starXp`),
   *  mark the clear date on a first clear, grant the reward special. Returns the
   *  mask of newly earned stars (0 = nothing new). */
  recordChallengeResult: (
    challengeId: string,
    starsMask: number,
    xpForNew: number,
    reward: { xp: number; badge?: string; specialId?: string },
  ) => number;
  /** Add fielded special cards to the collection — the same unlock a normal run
   *  does (compileResults → applyRunResults), exposed standalone so the Challenge
   *  flow can collect the specials it drafted too. Idempotent. (v1.4.3, #100) */
  collectSpecials: (specialIds: string[]) => void;
  /** Replace the durable slice wholesale (v1.4 cloud sync — after a merge). */
  hydrateDurable: (durable: DurableProfile) => void;
  /** Award achievements the MOMENT they're earned (v1.4): mark + grant XP +
   *  toast the genuinely-new ones. Used for the real-time mid-run feats. */
  awardAchievements: (ids: string[]) => void;
  /** Grant Season XP from a non-run source (missions, login streak, quiz, career
   *  milestones — v2.0). Also accrues `lifetime.xp`. Ignores non-positive amounts. */
  grantXp: (amount: number) => void;
  /** v2.0 (career R32): record career achievement marks (idempotent) and refresh cosmetics. */
  addCareerMarks: (ids: string[]) => void;
  /** rc.4: a career save just won `count` World Championship(s) — lifetime and season counters. */
  addCareerWorlds: (count: number) => void;
  /** Choose what the profile shows (locker, v2.0). Unknown / unowned ids are dropped;
   *  null = auto (best owned), `NONE` = hide the slot. */
  setEquipped: (patch: Partial<EquippedState>) => void;
  /** rc.2: mark owned cosmetics as seen in the locker (clears the "new" count). */
  markCosmeticsSeen: (ids: string[]) => void;
  /** rc.2 preview tools (dev / staging only): every cosmetic counts as owned. */
  previewUnlockAll: boolean;
  setPreviewUnlockAll: (on: boolean) => void;
  /** Re-derive owned cosmetics from the profile's facts (idempotent). Called after
   *  every progress write; exposed for screens that unlock through other stores. */
  refreshCosmetics: () => void;
  /** Roll the daily / weekly mission sets when their period moved on (v2.0).
   *  Idempotent; call on screens that show missions and before applying events. */
  rollMissions: () => void;
  /** Fold a progress event into the missions, granting XP for completions (v2.0).
   *  Returns what happened so the UI can toast it. */
  applyMissionEvent: (event: MissionEvent) => MissionApplyResult;
  /** Count today's login (idempotent per UTC day), granting the streak XP (v2.0). */
  recordLogin: () => { counted: boolean; xp: number; streak: number; milestone: number | null };
  /** Count one finished run toward each live event card's Special Hunt (v2.0). */
  recordEventRuns: (eventSpecialIds: string[]) => void;
  /** One Daily Quiz guess (v2.0): records the attempt, grants XP on a solve, folds
   *  the day into the counters when it finishes, and feeds the missions. */
  guessQuiz: (puzzle: QuizPuzzle, guessPlayerId: string | null, rawText: string) => {
    correct: boolean;
    finished: boolean;
    xp: number;
    attempts: number;
  };
  resetAll: () => void;
}

const initialData = {
  xp: 0,
  mmr: SEASON_RATING.start,
  lastMmrGain: 0,
  season: freshSeason(),
  lifetime: { xp: 0 },
  legacy: { preseason: null } as LegacyState,
  grants: [] as string[],
  cosmetics: EMPTY_COSMETICS,
  missions: EMPTY_MISSIONS,
  login: EMPTY_LOGIN,
  events: {} as Record<string, { runs: number }>,
  quiz: EMPTY_QUIZ,
  legacyUnlocked: false,
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
  challengeStars: {} as Record<string, number>,
  careerMarks: [] as string[],
  careerWorldsWon: 0,
  legacyStreak: { current: 0, best: 0 },
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
    seenSeasonRecap: false,
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
 * Since v2.0 the valid set also holds the derived national-team cards; it comes
 * from the light catalog (`specialCardIds`, the same ids as `specialCardById`),
 * so this store never loads the dataset (rc.26, #60).
 */
export function pruneUnlockedSpecials(
  m: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(m ?? {}).filter(([id]) => specialCardIds.has(id)),
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
  const specialIds = new Set(Object.keys(p.unlockedSpecials ?? {}).filter((id) => !isNationalSpecialId(id)));
  const ids = evaluateCounterAchievements(
    {
      runsCompleted: p.runsCompleted ?? 0,
      titlesTotal: p.wins.easy + p.wins.normal + p.wins.hard + p.wins.legacy,
      legacyTitles: p.wins.legacy,
      gamesWon: p.gamesWon ?? 0,
      goalsScored: p.goalsScored ?? 0,
      specialsOwned: specialIds.size,
      totalSpecials: COUNTS.specialCards,
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

/** What the mission picker may hand this player (v2.0). Career missions need the
 *  mode in the build AND an existing save; the career store is not imported here
 *  (it must not load on the draft pages), so the flag alone gates them. */
function eligibilityOf(p: Pick<ProfileState, "xp" | "legacyUnlocked">): MissionEligibility {
  return {
    rankId: rankForXp(p.xp).id,
    legacyUnlocked: p.legacyUnlocked,
    careerAvailable: FEATURES.careerMode,
  };
}

/** The `cosmetics` patch for a (possibly partially updated) profile. */
function withCosmetics(
  p: Pick<ProfileState, "legacy" | "grants" | "season" | "cosmetics"> &
    Partial<
      Pick<
        ProfileState,
        "missions" | "login" | "quiz" | "challengeStars" | "careerMarks" | "careerWorldsWon" | "wins" | "runsCompleted" | "unlockedSpecials" | "legacyStreak" | "previewUnlockAll"
      >
    >,
  now = new Date().toISOString(),
): CosmeticsState {
  // The preview switch only ever counts where the preview tools exist (dev / staging).
  const facts = cosmeticFacts({ ...p, previewUnlockAll: FEATURES.previewTools && p.previewUnlockAll === true });
  const owned = refreshOwned(p.cosmetics?.owned ?? {}, facts, now);
  const equipped = sanitizeEquipped(owned, p.cosmetics?.equipped ?? EMPTY_COSMETICS.equipped);
  return { owned, equipped, seen: p.cosmetics?.seen ?? [] };
}

/** rc.20: > 0 while a hydrate / merge is writing (no unlock pop-ups for those). */
let quietUnlocks = 0;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
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
          // rc.20: consecutive Legacy titles (On a Roll / Heatwave). Only Legacy
          // runs touch the streak: a title extends it, any other result ends it.
          const prevStreak = state.legacyStreak ?? initialData.legacyStreak;
          const legacyStreak =
            entry.difficulty !== "legacy"
              ? prevStreak
              : results.placement === "champion"
                ? { current: prevStreak.current + 1, best: Math.max(prevStreak.best, prevStreak.current + 1) }
                : { ...prevStreak, current: 0 };

          // Legacy unlock (v1.4): decoupled from the raw `wins` counter so a Daily or
          // Challenge Hard win still counts as a TITLE (achievements/leaderboard/MMR)
          // but does NOT open Legacy. Only a real Classic/Quick Hard (or Legacy)
          // championship flips the gate. One-way latch.
          const isTournamentMode = entry.mode === "classic" || entry.mode === "quick";
          const legacyUnlocked =
            state.legacyUnlocked ||
            (results.placement === "champion" &&
              isTournamentMode &&
              (entry.difficulty === "hard" || entry.difficulty === "legacy"));

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
          // Season Rating (v2.0): a signed placement × difficulty delta (SEASON_RATING),
          // floor 0, with the first `placementRuns` runs of a season protected from
          // losses. `lastMmrGain` feeds the results-screen readout. Challenge mode never
          // reaches here; Daily does (×1.25) and a Daily title counts like any tournament.
          const ratingDelta = seasonRatingDelta({
            difficulty: entry.difficulty,
            placement: results.placement,
            mode: entry.mode,
            hiddenOverall: entry.hiddenOverall,
            seasonRunsBefore: state.season.runs,
          });
          const mmr = seasonRatingAfter(state.mmr, ratingDelta);
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
              // National-team cards (v2.0) have their own album: the special-card
              // achievements (Collector / Curator / Completionist) skip them.
              specialsOwned: Object.keys(unlockedSpecials).filter((id) => !isNationalSpecialId(id)).length,
              totalSpecials: COUNTS.specialCards,
              specialIds: new Set(Object.keys(unlockedSpecials).filter((id) => !isNationalSpecialId(id))),
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

          const xpFinal = xpAfterRun + counterXp;
          const rankAfter = rankForXp(xpFinal);
          const peakRankId =
            rankForXp(xpFinal).index >= rankIndexOf(state.season.peakRankId)
              ? rankAfter.id
              : state.season.peakRankId;
          const season: SeasonState = {
            ...state.season,
            runs: state.season.runs + 1,
            titles: state.season.titles + (results.placement === "champion" ? 1 : 0),
            legacyTitles:
              (state.season.legacyTitles ?? 0) +
              (results.placement === "champion" && entry.difficulty === "legacy" ? 1 : 0),
            peakMmr: Math.max(state.season.peakMmr, mmr),
            peakRankId,
            ratingHistory: pushRatingHistory(state.season.ratingHistory, {
              t: now,
              delta: lastMmrGain,
              mmr,
              difficulty: entry.difficulty,
              placement: results.placement,
              mode: entry.mode,
            }),
          };

          return {
            xp: xpFinal,
            mmr,
            lastMmrGain,
            season,
            lifetime: { xp: state.lifetime.xp + (xpFinal - state.xp) },
            cosmetics: withCosmetics({ ...state, season, wins, runsCompleted, unlockedSpecials, legacyStreak }, now),
            legacyUnlocked,
            runsCompleted,
            wins,
            legacyStreak,
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
            lifetime: { xp: state.lifetime.xp + reward.xp },
            challengesCompleted: { ...state.challengesCompleted, [challengeId]: now },
            unlockedSpecials,
          };
        }),

      recordChallengeResult: (challengeId, starsMask, xpForNew, reward) => {
        let fresh = 0;
        set((state) => {
          const had = state.challengeStars[challengeId] ?? 0;
          fresh = starsMask & ~had;
          if (!fresh) return {};
          const now = new Date().toISOString();
          const challengeStars = { ...state.challengeStars, [challengeId]: had | starsMask };
          const challengesCompleted = { ...state.challengesCompleted };
          if (fresh & 1 && !challengesCompleted[challengeId]) challengesCompleted[challengeId] = now;
          const unlockedSpecials = { ...state.unlockedSpecials };
          if (fresh & 1 && reward.specialId && !unlockedSpecials[reward.specialId]) {
            unlockedSpecials[reward.specialId] = now;
          }
          const xp = state.xp + Math.max(0, xpForNew);
          const rank = rankForXp(xp);
          const season = {
            ...state.season,
            peakRankId: rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId,
          };
          return {
            xp,
            lifetime: { xp: state.lifetime.xp + Math.max(0, xpForNew) },
            season,
            challengeStars,
            challengesCompleted,
            unlockedSpecials,
            cosmetics: withCosmetics({ ...state, season, challengeStars }),
          };
        });
        return fresh;
      },

      collectSpecials: (specialIds) =>
        set((state) => {
          const unlockedSpecials = { ...state.unlockedSpecials };
          const now = new Date().toISOString();
          let changed = false;
          for (const id of specialIds) {
            if (!unlockedSpecials[id]) {
              unlockedSpecials[id] = now;
              changed = true;
            }
          }
          return changed ? { unlockedSpecials, cosmetics: withCosmetics({ ...state, unlockedSpecials }) } : {};
        }),

      hydrateDurable: (durable) => {
        // A cloud / storage merge is never "a new unlock": whatever it brings in
        // stays silent (the pop-up is for rewards earned in THIS session).
        quietUnlocks += 1;
        try {
          set(() => {
            const next = normalizeToSeason(durable);
            return {
              ...next,
              legacyStreak: durable.legacyStreak ?? initialData.legacyStreak,
              achievements: pruneEarnedAchievements(durable.achievements),
              unlockedSpecials: pruneUnlockedSpecials(durable.unlockedSpecials),
              cosmetics: withCosmetics({ ...next, cosmetics: next.cosmetics ?? EMPTY_COSMETICS }),
            };
          });
        } finally {
          quietUnlocks -= 1;
        }
      },

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
          if (!fresh.length) return {};
          const total = state.xp + xp;
          const rank = rankForXp(total);
          const season = {
            ...state.season,
            peakRankId: rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId,
          };
          return { achievements, xp: total, lifetime: { xp: state.lifetime.xp + xp }, season, cosmetics: withCosmetics({ ...state, season }) };
        });
        if (fresh.length) useAchievementToasts.getState().push(fresh);
      },

      addCareerMarks: (ids) =>
        set((state) => {
          const careerMarks = Array.from(new Set([...(state.careerMarks ?? []), ...ids]));
          if (careerMarks.length === (state.careerMarks ?? []).length) return {};
          return { careerMarks, cosmetics: withCosmetics({ ...state, careerMarks }) };
        }),

      addCareerWorlds: (count) =>
        set((state) => {
          if (!(count > 0)) return {};
          const careerWorldsWon = (state.careerWorldsWon ?? 0) + count;
          const season = { ...state.season, careerWorlds: (state.season.careerWorlds ?? 0) + count };
          return { careerWorldsWon, season, cosmetics: withCosmetics({ ...state, careerWorldsWon, season }) };
        }),

      grantXp: (amount) =>
        set((state) => {
          if (!(amount > 0)) return {};
          const xp = state.xp + Math.round(amount);
          const rank = rankForXp(xp);
          const peakRankId =
            rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId;
          const season = { ...state.season, peakRankId };
          return {
            xp,
            lifetime: { xp: state.lifetime.xp + Math.round(amount) },
            season,
            cosmetics: withCosmetics({ ...state, season }),
          };
        }),

      setEquipped: (patch) =>
        set((state) => ({
          cosmetics: {
            ...state.cosmetics,
            equipped: sanitizeEquipped(state.cosmetics.owned, {
              ...state.cosmetics.equipped,
              ...patch,
            }),
          },
        })),

      markCosmeticsSeen: (ids) =>
        set((state) => {
          const next = markSeen(state.cosmetics, ids);
          return next === state.cosmetics ? {} : { cosmetics: next };
        }),

      previewUnlockAll: false,
      setPreviewUnlockAll: (on) =>
        set((state) => ({ previewUnlockAll: on, cosmetics: withCosmetics({ ...state, previewUnlockAll: on }) })),

      refreshCosmetics: () => set((state) => ({ cosmetics: withCosmetics(state) })),

      rollMissions: () =>
        set((state) => {
          const missions = rollMissionPeriods(state.missions, eligibilityOf(state));
          return missions === state.missions ? {} : { missions };
        }),

      applyMissionEvent: (event) => {
        let result: MissionApplyResult = { state: EMPTY_MISSIONS, xp: 0, completed: [], bonuses: [] };
        if (FEATURES.playtest) return result; // playtest build: missions are cut
        set((state) => {
          const now = new Date();
          const rolled = rollMissionPeriods(state.missions, eligibilityOf(state), now);
          result = foldMissionEvent(rolled, event, now);
          const missions = result.state;
          if (missions === state.missions) return {};
          if (result.xp <= 0) return { missions };
          const xp = state.xp + result.xp;
          const rank = rankForXp(xp);
          const season = {
            ...state.season,
            peakRankId: rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId,
          };
          return {
            missions,
            xp,
            lifetime: { xp: state.lifetime.xp + result.xp },
            season,
            cosmetics: withCosmetics({ ...state, season, missions }),
          };
        });
        if (result.completed.length || result.bonuses.length) {
          useRewardToasts.getState().push([
            ...result.completed.map((missionId) => {
              const def = missionById.get(missionId);
              const tier = def?.tier ?? "easy";
              const period = def?.period ?? "daily";
              return { kind: "mission" as const, missionId, xp: MISSIONS[period].xp[tier] };
            }),
            ...result.bonuses.map((period) => ({ kind: "missionBonus" as const, period, xp: MISSIONS[period].allBonus })),
          ]);
        }
        return result;
      },

      recordLogin: () => {
        let out = { counted: false, xp: 0, streak: 0, milestone: null as number | null };
        set((state) => {
          const r = countLogin(state.login);
          out = { counted: r.counted, xp: r.xp, streak: r.state.streak, milestone: r.milestone };
          if (!r.counted) return {};
          const xp = state.xp + r.xp;
          const rank = rankForXp(xp);
          const season = {
            ...state.season,
            peakRankId: rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId,
          };
          return {
            login: r.state,
            xp,
            lifetime: { xp: state.lifetime.xp + r.xp },
            season,
            cosmetics: withCosmetics({ ...state, season, login: r.state }),
          };
        });
        if (out.counted) {
          useRewardToasts.getState().showLogin({ streak: out.streak, xp: out.xp, milestone: out.milestone });
        }
        return out;
      },

      recordEventRuns: (ids) =>
        set((state) => {
          if (ids.length === 0) return {};
          const events = { ...state.events };
          for (const id of ids) events[id] = { runs: (events[id]?.runs ?? 0) + 1 };
          return { events };
        }),

      guessQuiz: (puzzle, guessPlayerId, rawText) => {
        let out = { correct: false, finished: false, xp: 0, attempts: 0 };
        set((state) => {
          const prev = state.quiz.results[puzzle.date];
          const o = applyGuess(puzzle, prev, guessPlayerId, rawText);
          out = { correct: o.correct, finished: o.finished, xp: o.xp, attempts: o.result.attempts };
          if (o.result === prev) return {};
          // In-progress days live in `results` too (so a reload keeps the attempts);
          // the counters only move when the day finishes.
          const wasFinished = !!prev && (prev.solved || prev.attempts >= 3);
          const quiz: QuizState =
            o.finished && !wasFinished
              ? foldQuizDay(state.quiz, puzzle.date, o.result)
              : { ...state.quiz, results: { ...state.quiz.results, [puzzle.date]: o.result } };
          if (o.xp <= 0) return { quiz, cosmetics: withCosmetics({ ...state, quiz }) };
          const xp = state.xp + o.xp;
          const rank = rankForXp(xp);
          const season = {
            ...state.season,
            peakRankId: rank.index >= rankIndexOf(state.season.peakRankId) ? rank.id : state.season.peakRankId,
          };
          return {
            quiz,
            xp,
            lifetime: { xp: state.lifetime.xp + o.xp },
            season,
            cosmetics: withCosmetics({ ...state, season, quiz }),
          };
        });
        if (out.correct) useRewardToasts.getState().push([{ kind: "quiz", attempt: out.attempts, xp: out.xp }]);
        if (out.finished) {
          get().applyMissionEvent({ type: "quiz_played", solved: out.correct, attempt: out.attempts });
        }
        return out;
      },

      resetAll: () => set({ ...initialData, season: freshSeason() }),
    }),
    {
      name: "rocket-draft:profile:v1",
      version: 12,
      // rc.2: re-derive the owned cosmetics after hydration so a catalog change
      // (new items, the preview switch) shows up without waiting for a run.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Only write when the derivation actually changed the owned set — a
        // current save must hydrate without a write-back (persist contract).
        const next = withCosmetics(state);
        const a = Object.keys(next.owned).sort().join("|");
        const b = Object.keys(state.cosmetics?.owned ?? {}).sort().join("|");
        if (a !== b || state.cosmetics?.seen === undefined) state.refreshCosmetics();
      },
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
      // prunes ghost specials; v10 re-runs the MMR backfill after raising the start
      // to 1000 (new players begin at 1000, veterans re-seed from history); v11
      // HARD-RESETS mmr to the reworked title-only backfill (capped 1500) — the old
      // formula over-rewarded (a mediocre fresh account drifted to ~1200, elites past
      // 1500), so this is a one-time correction, NOT a floor; and seeds `legacyUnlocked`
      // from history (anyone with a Hard/Legacy title keeps Legacy open); v12 (v2.0,
      // DESIGN-DECISIONS #110) is the SEASON 1 RESET: the pre-season xp / mmr / rank /
      // titles / challenge count are archived into `legacy.preseason`, then xp → 0,
      // mmr → SEASON_RATING.start, challengesCompleted → {} and a fresh `season`
      // block; `lifetime.xp` keeps the cumulative total. Collection, achievements,
      // lifetime counters, run history and records are untouched. All other new
      // fields backfill from initialData via the deep-merge.
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
        const v11 = {
          ...merged,
          achievements: { ...merged.achievements, ...backfilled },
          // v11: recompute MMR from the reworked title-only backfill (capped 1500).
          // This is a hard SET (not a floor) so the inflated old-formula values are
          // corrected down: elites land near 1500, a title-less account back at start.
          // A save already AT v11 keeps its live-earned value (the correction ran once).
          mmr:
            version < 11
              ? mmrBackfillFloor(merged.wins)
              : (base.mmr ?? mmrBackfillFloor(merged.wins)),
          // v11: seed the new Legacy gate from history — anyone who already won a
          // Hard or Legacy title keeps Legacy open (no one loses access they earned).
          legacyUnlocked:
            merged.legacyUnlocked || merged.wins.hard > 0 || merged.wins.legacy > 0,
        } as ProfileState;
        // v12: the Season 1 reset. A pre-v12 save has no `season` block (the spread
        // from initialData above gave it a FRESH one, which must not count as "already
        // in the season"), so strip it before normalising: every pre-v12 save is a
        // pre-season save by definition.
        const preV12 = version < 12 ? { ...v11, season: undefined, lifetime: undefined, legacy: base.legacy } : v11;
        const inSeason = normalizeToSeason(preV12 as ProfileState);
        // The legacy rewards appear the moment the save migrates (no sync needed).
        return { ...inSeason, cosmetics: withCosmetics({ ...inSeason, cosmetics: inSeason.cosmetics ?? EMPTY_COSMETICS }) };
      },
    },
  ),
);

// rc.20: the unlock pop-up. Every write that derives a new owned cosmetic
// (a run, a challenge, a login, a quiz, a mission, a career milestone) is
// announced here — one place, no per-action bookkeeping. Hydration and the
// cloud merge are quiet (`quietUnlocks`), and the persist hydrate runs before
// this subscription exists, so a migrated save never floods the queue.
useProfileStore.subscribe((state, prev) => {
  if (quietUnlocks > 0 || state.cosmetics?.owned === prev.cosmetics?.owned) return;
  const ids = newlyOwnedIds(prev.cosmetics?.owned ?? {}, state.cosmetics?.owned ?? {});
  if (ids.length) useCosmeticUnlocks.getState().push(ids);
});

/** Legacy difficulty unlock rule (v1.4): a real Classic/Quick Hard (or Legacy)
 *  championship opens Legacy. Read from the dedicated `legacyUnlocked` latch so a
 *  Daily/Challenge title — which still counts as a title elsewhere — never opens it. */
export function selectLegacyUnlocked(state: ProfileState): boolean {
  return state.legacyUnlocked;
}

/**
 * Hard mode unlocks at Silver (v1.3) — the rank ladder now gates difficulty too.
 * Back-compat: anyone who already WON Hard/Legacy keeps access even if their XP
 * predates the gate, so no existing player is locked out of a mode they cleared.
 */
export function selectHardUnlocked(state: ProfileState): boolean {
  return rankRewardsForXp(state.xp).hardMode || state.wins.hard > 0 || state.wins.legacy > 0;
}

/** Collection screen unlocks at Bronze (v1.3); Unranked has it locked. v2.0: a
 *  player who already OWNS cards (a pre-season veteran after the reset) always
 *  keeps access — the gate is an on-ramp, not a lock on what they earned. */
export function selectCollectionUnlocked(state: ProfileState): boolean {
  return rankRewardsForXp(state.xp).collection || Object.keys(state.unlockedSpecials).length > 0;
}

/** Ladder position of a rank id (0 = Unranked / unknown). */
function rankIndexOf(rankId: string): number {
  const i = RANKS.findIndex((r) => r.id === rankId);
  return i < 0 ? 0 : i;
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
