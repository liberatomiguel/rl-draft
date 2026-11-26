/**
 * v2.2 Pro (R150): one week on a save. A thin, pure bridge between the week
 * (`week.ts`, on the player) and the save: the growth log, the world's
 * snapshot, and a clock that moves one week. The spine's world tick replaces
 * the clock step; the player-side part (`applyWeekToSave`) stays.
 */

import { CAREER_CALENDAR, CAREER_PRO } from "@/config/balance";
import { applyWeekPlan, type WeekResult } from "./week";
import type { ProSave, ProWeekPlan } from "./types";
import { withProInWorld } from "./world";

const DAYS_PER_WEEK = 7;

/** The week's player-side effect on the save (no clock change). */
export function applyWeekToSave(save: ProSave, plan: ProWeekPlan, coachOverall?: number): { save: ProSave; result: WeekResult } {
  const result = applyWeekPlan(save.player, plan, {
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    coachOverall,
    hasTeam: save.team !== null,
    careerSeed: save.careerSeed,
  });
  const growthLog = [...save.growthLog, ...result.growth].slice(-CAREER_PRO.growthLogCap);
  return { save: withProInWorld({ ...save, player: result.player, growthLog }), result };
}

/** One week later: the day moves by seven, into the next season when it passes the last day. */
export function nextWeekClock(clock: ProSave["clock"]): { clock: ProSave["clock"]; rolledOver: boolean } {
  const lastDay = CAREER_CALENDAR.weeksPerSeason * DAYS_PER_WEEK;
  const day = clock.day + DAYS_PER_WEEK;
  if (day <= lastDay) return { clock: { ...clock, day }, rolledOver: false };
  return { clock: { seasonIndex: clock.seasonIndex + 1, day: day - lastDay }, rolledOver: true };
}

/**
 * Play a week and move the clock by one (the store's stand-in until the world
 * tick lands). The growth log keeps the explained changes of the last weeks.
 */
export function playProWeek(save: ProSave, plan: ProWeekPlan): { save: ProSave; result: WeekResult } {
  const applied = applyWeekToSave(save, plan);
  const { clock } = nextWeekClock(applied.save.clock);
  return { save: { ...applied.save, clock }, result: applied.result };
}
