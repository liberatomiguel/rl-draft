/**
 * v2.2 ORGMODE-2027 (front ERA): the start era. Pure.
 *
 * `seasonIndex` is the absolute era everywhere (0 = RLCS Season X … 6 = RLCS
 * 2027): ages, labels, dataset lookups, intake and streams read it. A save may
 * start later (`startSeasonIndex`, absent = 0); the career's PROGRESS (its
 * first season, its founding day, the novice guards, the season number it
 * shows) reads `careerSeasonOf`, the season counted from that start.
 */

import { CAREER_AGE, CAREER_ERA, CAREER_SEASONS, CAREER_WORLD, STAGING_BUILD } from "@/config/balance";

/** The last era a career can start at: the late wave's season (RLCS 2027) when it is on, else the timeline's last. */
export const LAST_START_ERA: number = CAREER_WORLD.lateIntake.enabled
  ? CAREER_WORLD.lateIntake.atSeasonIndex
  : CAREER_SEASONS.length - 1;

/** A requested start era as one the world can be built at (0..LAST_START_ERA, integer). */
export function clampStartEra(n: number | undefined | null): number {
  if (n === undefined || n === null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LAST_START_ERA, Math.trunc(n)));
}

/** The era a save began at (absent = 0, every save before v2.2's era front). */
export function startSeasonOf(save: { startSeasonIndex?: number } | null | undefined): number {
  return save?.startSeasonIndex ?? 0;
}

/** The career season (0 = its first) of an absolute season index, by default the clock's. */
export function careerSeasonOf(
  save: { startSeasonIndex?: number; clock: { seasonIndex: number } },
  seasonIndex: number = save.clock.seasonIndex,
): number {
  return seasonIndex - startSeasonOf(save);
}

/** A world built at the last era: the dataset has no later season, so E3's projection and long careers apply. */
export function isLastEraWorld(world: { eraStart?: number } | null | undefined): boolean {
  return (world?.eraStart ?? 0) > 0 && world!.eraStart === LAST_START_ERA;
}

/** E3's rules are live for this world: built at the last era, with CAREER_ERA.lastEraRules on. */
export function lastEraRulesOn(world: { eraStart?: number } | null | undefined): boolean {
  return CAREER_ERA.lastEraRules && isLastEraWorld(world);
}

export interface RetirementTable {
  retireMinAge: number;
  retireMaxAge: number;
  retirementByAge: Record<number, number>;
}

/** The retirement window a world's players follow: E3's long careers in a last-era world, else CAREER_AGE's. */
export function retirementTableOf(world: { eraStart?: number } | null | undefined): RetirementTable {
  return lastEraRulesOn(world) ? CAREER_ERA.longCareers : CAREER_AGE;
}

/**
 * E4: the era a takeover starts at — CAREER_ERA.takeoverDefaultStart, or, in
 * the staging build only, the pick screen's `?era=N` (0..LAST_START_ERA) for
 * testing other eras before the picker exists (a stage-4 screen).
 */
export function takeoverStartEraFor(search: string | null | undefined, staging: boolean = STAGING_BUILD): number {
  const fallback = clampStartEra(CAREER_ERA.takeoverDefaultStart);
  if (!staging || !search) return fallback;
  const raw = new URLSearchParams(search).get("era")?.trim() ?? "";
  return /^\d+$/.test(raw) ? clampStartEra(Number(raw)) : fallback;
}
