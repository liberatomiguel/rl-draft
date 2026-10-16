/**
 * Season calendar (v2.0). The site is a static export with no server clock, so
 * the CURRENT season is a build-time constant: switching seasons is a deploy.
 * The client's UTC date drives everything date-based (dailies, missions, event
 * windows, the season countdown).
 *
 * `id` is the compatibility surface: profile saves tag their season-scoped
 * fields with it (`profile.season.id`), the cloud rows carry it (`season_id`),
 * and `src/engine/season.ts` resets + archives any save whose id differs.
 * Never reuse an id.
 *
 * Pre-season = everything before Season 1 (`PRESEASON_ID`). A save with no
 * `season` field at all is a pre-season save.
 */

export const PRESEASON_ID = 0;

export const SEASON = {
  id: 1,
  name: "Season 1",
  /** ISO dates (UTC). `endsAt` is informational (countdown + copy); the switch
   *  to Season 2 is a deploy that bumps `id`. TODO(Miguel): set the real dates. */
  startsAt: "2026-10-20",
  endsAt: "2026-12-22",
  weeks: 9,
} as const;

export type SeasonId = typeof SEASON.id | typeof PRESEASON_ID;

/** Days left in the season for the countdown; 0 once `endsAt` has passed. */
export function seasonDaysLeft(now = new Date()): number {
  const end = Date.parse(`${SEASON.endsAt}T23:59:59Z`);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** 1-based week of the season for the client's date (clamped to 1..weeks). */
export function seasonWeek(now = new Date()): number {
  const start = Date.parse(`${SEASON.startsAt}T00:00:00Z`);
  if (Number.isNaN(start)) return 1;
  const week = Math.floor((now.getTime() - start) / (7 * 86_400_000)) + 1;
  return Math.min(SEASON.weeks, Math.max(1, week));
}
