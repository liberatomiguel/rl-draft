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
}

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
  return [...new Set(ids)].filter((id) => !earned.has(id));
}
