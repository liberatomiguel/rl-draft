"use client";

/**
 * Road to Worlds — date rendering helpers (v0.2 day clock).
 *
 * Pure formatters over the engine's CareerDate + the CAREER copy `dates`
 * group (month/weekday names live in copy so EN/PT stay in lockstep).
 */

import type { CareerDate } from "@/engine/career/calendar";

interface DatesCopy {
  months: readonly string[];
  weekdays: readonly string[];
  weekdaysLong: readonly string[];
  short: (dow: string, month: string, d: number) => string;
  tiny: (month: string, d: number) => string;
  today: string;
  tomorrow: string;
  inDays: (n: number) => string;
  daysShort: (n: number) => string;
}

/** "Sat, Oct 24" / "Sáb, 24 Out". */
export function formatDateShort(D: DatesCopy, date: CareerDate): string {
  return D.short(D.weekdays[date.dow - 1], D.months[date.m - 1], date.d);
}

/** "Oct 24" / "24 Out". */
export function formatDateTiny(D: DatesCopy, date: CareerDate): string {
  return D.tiny(D.months[date.m - 1], date.d);
}

/** "Today" / "Tomorrow" / "in N days". */
export function formatDaysAway(D: DatesCopy, daysAway: number): string {
  if (daysAway <= 0) return D.today;
  if (daysAway === 1) return D.tomorrow;
  return D.inDays(daysAway);
}

/** Weekday full name ("Monday" / "Segunda-feira"). */
export function formatWeekday(D: DatesCopy, dow: number): string {
  return D.weekdaysLong[dow - 1] ?? "";
}
