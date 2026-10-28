/**
 * The login calendar's focus for a streak (rc.29, E2E DRAFT-03): today's cell,
 * the next milestone day, and the days whose reward art is drawn in full —
 * just those two. Every other day gets a CSS rendition, so the calendar (open
 * on a cold home) requests at most one or two small images instead of six.
 */

import { LOGIN_STREAK } from "@/config/balance";

export interface LoginCalendarFocus {
  /** Today's cell (the streak, capped at the cycle). */
  today: number;
  /** The next day with a milestone reward, or null (cycle complete / last day). */
  nextRewardDay: number | null;
  /** Past the cycle: every day pays the flat maximum. */
  complete: boolean;
  /** Days whose reward art is shown in full (badges); the rest are CSS-only. */
  artDays: ReadonlySet<number>;
}

export function loginCalendarFocus(streak: number): LoginCalendarFocus {
  const cycle = LOGIN_STREAK.cycleDays;
  const today = Math.min(Math.max(streak, 1), cycle);
  let nextRewardDay: number | null = null;
  for (let d = today + 1; d <= cycle; d += 1) {
    if (LOGIN_STREAK.milestoneBonus[d] !== undefined) {
      nextRewardDay = d;
      break;
    }
  }
  const artDays = new Set<number>([today]);
  if (nextRewardDay !== null) artDays.add(nextRewardDay);
  return { today, nextRewardDay, complete: streak >= cycle, artDays };
}
