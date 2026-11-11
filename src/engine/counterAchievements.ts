/**
 * Lifetime counter / collection / rank achievements (v1.4), evaluated against
 * the PROFILE after a run's results are applied. Split out of `./achievements`
 * in rc.26 (#60): the profile store sits in the root layout and runs this on
 * every page, and unlike the run/team feats it needs no dataset, so it must not
 * import `@/data`. Returns only the ids not earned yet. Pure + deterministic.
 */

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
  if (s.gamesWon >= 50) ids.push("ach-games-50");
  if (s.gamesWon >= 200) ids.push("ach-games-200");
  if (s.goalsScored >= 100) ids.push("ach-goals-100");
  if (s.goalsScored >= 250) ids.push("ach-goals-250");
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
  return [...new Set(ids)].filter((id) => !earned.has(id));
}
