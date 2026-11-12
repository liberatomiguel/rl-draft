/**
 * Lifetime counter / collection / rank achievements (v1.4), evaluated against
 * the PROFILE after a run's results are applied. Split out of `./achievements`
 * in rc.26 (#60): the profile store sits in the root layout and runs this on
 * every page, and unlike the run/team feats it needs no dataset, so it must not
 * import `@/data` (the light `@/data/catalog` is fine). Returns only the ids not
 * earned yet. Pure + deterministic.
 */

import { REGION_LOCK } from "@/config/balance";
import { specialCardIds, specialRarityOf } from "@/data/catalog";
import { ALL_STARS, totalStars } from "./challengeStars";

export const CREATOR_SPECIAL_ID = "sp-liberatorl-rocket-draft-creator";

export interface CounterSnapshot {
  runsCompleted: number;
  titlesTotal: number;
  legacyTitles: number;
  gamesWon: number;
  goalsScored: number;
  specialsOwned: number;
  totalSpecials: number;
  specialIds: ReadonlySet<string>;
  dailyStreak: number;
  rankId: string;
  /** v2.0 (C2): Season Rating after the run. Optional so the backfill stays valid. */
  seasonRating?: number;
  /** v2.0 (C2): best run of consecutive Legacy titles. */
  legacyStreakBest?: number;
  // --- E1 (Season 1 review). All optional: an absent fact never awards. ---
  /** Titles on Hard. */
  hardTitles?: number;
  /** How many of the four difficulties hold at least one title. */
  difficultiesWon?: number;
  /** Lifetime top-three finishes. */
  podiums?: number;
  /** Daily Challenges won (champion), on any day. */
  dailyWins?: number;
  /** Lifetime Region-only titles, by region (`profile.regionTitles`). */
  regionTitles?: Partial<Record<string, number>>;
  /** Legendary special cards owned / in the catalogue. */
  legendariesOwned?: number;
  legendariesTotal?: number;
  /** Best run of consecutive Daily Quiz solves. */
  quizBestStreak?: number;
  /** Best login streak, in days. */
  loginBest?: number;
  /** Lifetime missions completed. */
  missionsCompleted?: number;
}

/** The profile facts the E1 counters read (a structural slice of the profile). */
export interface ProfileCounterFacts {
  wins: { easy: number; normal: number; hard: number; legacy: number };
  podiums?: number;
  dailyResults?: Record<string, { placement: string }>;
  regionTitles?: Partial<Record<string, number>>;
  unlockedSpecials?: Record<string, string>;
  quiz?: { bestStreak?: number };
  login?: { best?: number };
  missions?: { completedTotal?: number };
}

const LEGENDARY_IDS: readonly string[] = [...specialCardIds].filter((id) => specialRarityOf(id) === "legendary");

/**
 * E1: the extra counters, read straight off a profile. Spread into the
 * snapshot wherever one is built (a run, the migrate's backfill, the sweeps
 * after a quiz / login / mission), so every path judges the same facts.
 * Every read is defensive: an old save lacks the newer fields.
 */
export function profileCounters(p: ProfileCounterFacts): Partial<CounterSnapshot> {
  const owned = p.unlockedSpecials ?? {};
  return {
    hardTitles: p.wins.hard,
    difficultiesWon: [p.wins.easy, p.wins.normal, p.wins.hard, p.wins.legacy].filter((n) => n > 0).length,
    podiums: p.podiums ?? 0,
    dailyWins: Object.values(p.dailyResults ?? {}).filter((r) => r?.placement === "champion").length,
    regionTitles: p.regionTitles ?? {},
    legendariesOwned: LEGENDARY_IDS.filter((id) => owned[id]).length,
    legendariesTotal: LEGENDARY_IDS.length,
    quizBestStreak: p.quiz?.bestStreak ?? 0,
    loginBest: p.login?.best ?? 0,
    missionsCompleted: p.missions?.completedTotal ?? 0,
  };
}

/**
 * E1: the Season-systems subset (quiz, login, missions) on its own. The store
 * sweeps it after those writes, where the full counter snapshot is not in hand
 * and where a lifetime counter must never fire (that is the run's job, and the
 * migrate's silent backfill for a veteran).
 */
export function evaluateSeasonSystemAchievements(
  s: Pick<CounterSnapshot, "quizBestStreak" | "loginBest" | "missionsCompleted">,
  earned: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  if ((s.quizBestStreak ?? 0) >= 7) ids.push("ach-quiz-streak-7");
  if ((s.quizBestStreak ?? 0) >= 30) ids.push("ach-quiz-streak-30");
  if ((s.loginBest ?? 0) >= 7) ids.push("ach-login-7");
  if ((s.loginBest ?? 0) >= 30) ids.push("ach-login-30");
  if ((s.missionsCompleted ?? 0) >= 25) ids.push("ach-missions-25");
  if ((s.missionsCompleted ?? 0) >= 100) ids.push("ach-missions-100");
  return ids.filter((id) => !earned.has(id));
}

/**
 * E1: challenge achievements, read after a challenge result landed. Stars and
 * clears are Season-scoped (the reset empties them), the achievement is
 * permanent. `challengeIds` is the catalogue (the caller owns the dataset).
 */
export function evaluateChallengeAchievements(
  input: { stars: Record<string, number>; completed: Record<string, string>; challengeIds: readonly string[] },
  earned: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  const total = totalStars(input.stars);
  const max = input.challengeIds.length * 3;
  if (Object.values(input.stars).some((m) => (m & ALL_STARS) === ALL_STARS)) ids.push("ach-challenge-perfect");
  if (input.challengeIds.length > 0 && input.challengeIds.every((id) => input.completed[id])) ids.push("ach-challenge-all");
  if (total >= 45) ids.push("ach-stars-45");
  if (total >= 90) ids.push("ach-stars-90");
  if (max > 0 && input.challengeIds.every((id) => ((input.stars[id] ?? 0) & ALL_STARS) === ALL_STARS)) ids.push("ach-stars-all");
  return ids.filter((id) => !earned.has(id));
}

/** Rank ladder order, lowest first (ids only: this file imports no dataset). */
const RANK_ORDER = ["unranked", "bronze", "silver", "gold", "platinum", "diamond", "champion", "grand-champion", "supersonic-legend"];
const rankAtLeast = (have: string, need: string): boolean => RANK_ORDER.indexOf(have) >= RANK_ORDER.indexOf(need);

export function evaluateCounterAchievements(
  s: CounterSnapshot,
  earned: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  if (s.runsCompleted >= 1) ids.push("ach-first-run");
  if (s.runsCompleted >= 10) ids.push("ach-runs-10");
  if (s.runsCompleted >= 50) ids.push("ach-runs-50");
  if (s.runsCompleted >= 200) ids.push("ach-runs-200");
  if (s.titlesTotal >= 5) ids.push("ach-titles-5");
  if (s.titlesTotal >= 15) ids.push("ach-titles-15");
  if (s.titlesTotal >= 50) ids.push("ach-titles-50");
  if (s.legacyTitles >= 10) ids.push("ach-legacy-10");
  if (s.gamesWon >= 200) ids.push("ach-games-200");
  if (s.goalsScored >= 500) ids.push("ach-goals-500");
  if (s.specialsOwned >= 1) ids.push("ach-first-special");
  if (s.specialsOwned >= 15) ids.push("ach-specials-15");
  if (s.specialsOwned >= 50) ids.push("ach-specials-50");
  if (s.totalSpecials > 0 && s.specialsOwned >= s.totalSpecials) ids.push("ach-specials-all");
  if (s.specialIds.has(CREATOR_SPECIAL_ID)) ids.push("ach-creator");
  if (s.dailyStreak >= 7) ids.push("ach-daily-7");
  if (s.rankId === "supersonic-legend") ids.push("ach-ssl");
  // v2.0 (C2): higher volume tiers, the Season ladder and the Season Rating.
  if (s.runsCompleted >= 500) ids.push("ach-runs-500");
  if (s.runsCompleted >= 1000) ids.push("ach-runs-1000");
  if (s.titlesTotal >= 100) ids.push("ach-titles-100");
  if (s.titlesTotal >= 250) ids.push("ach-titles-250");
  if (s.gamesWon >= 1000) ids.push("ach-games-1000");
  if (s.goalsScored >= 2500) ids.push("ach-goals-2500");
  if (s.legacyTitles >= 25) ids.push("ach-legacy-25");
  if (s.specialsOwned >= 100) ids.push("ach-specials-100");
  if (rankAtLeast(s.rankId, "diamond")) ids.push("ach-rank-diamond");
  if (rankAtLeast(s.rankId, "champion")) ids.push("ach-rank-champion");
  if (rankAtLeast(s.rankId, "grand-champion")) ids.push("ach-rank-gc");
  const rating = s.seasonRating ?? 0;
  if (rating >= 1000) ids.push("ach-rating-1000");
  if (rating >= 2500) ids.push("ach-rating-2500");
  if (rating >= 5000) ids.push("ach-rating-5000");
  if ((s.legacyStreakBest ?? 0) >= 2) ids.push("ach-legacy-streak-2");
  // E1 (Season 1 review). The 100-goal, 250-goal and 50-game rungs are retired.
  if ((s.legacyStreakBest ?? 0) >= 3) ids.push("ach-legacy-streak-3");
  if ((s.legacyStreakBest ?? 0) >= 5) ids.push("ach-legacy-streak-5");
  if ((s.hardTitles ?? 0) >= 10) ids.push("ach-hard-10");
  if ((s.difficultiesWon ?? 0) >= 4) ids.push("ach-all-difficulties");
  if ((s.podiums ?? 0) >= 100) ids.push("ach-podiums-100");
  if ((s.dailyWins ?? 0) >= 30) ids.push("ach-daily-30");
  const regional = s.regionTitles ?? {};
  if (REGION_LOCK.regions.every((r) => (regional[r] ?? 0) >= 1)) ids.push("ach-region-sweep");
  if (REGION_LOCK.regions.some((r) => (regional[r] ?? 0) >= 25)) ids.push("ach-region-25");
  if ((s.legendariesTotal ?? 0) > 0 && (s.legendariesOwned ?? 0) >= (s.legendariesTotal ?? 0)) ids.push("ach-legendaries-all");
  ids.push(...evaluateSeasonSystemAchievements(s, earned));
  return [...new Set(ids)].filter((id) => !earned.has(id));
}
