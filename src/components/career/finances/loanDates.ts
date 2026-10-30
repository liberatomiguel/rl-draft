/**
 * Road to Worlds — the emergency loan's deadline as a date (rc.34, Miguel
 * 31/10). One formatter for the money notice, HQ's loan card and Finances,
 * so they never quote different days: the deadline Monday's calendar date
 * ("Mon, Mar 3"), with its year when it falls in another one than today.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { dateOfDay, firstDayOfWeek } from "@/engine/career/calendar";
import { formatDateShort } from "@/components/career/dateText";

export function deadlineDateText(
  D: CareerCopy["dates"],
  deadline: { seasonIndex: number; week: number },
  now: { seasonIndex: number; day: number },
): string {
  const date = dateOfDay(deadline.seasonIndex, firstDayOfWeek(deadline.week));
  const text = formatDateShort(D, date);
  return date.y === dateOfDay(now.seasonIndex, now.day).y ? text : `${text} ${date.y}`;
}
