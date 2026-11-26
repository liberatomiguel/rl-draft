/**
 * v2.2 Pro (R150): one week on a save. A thin, pure bridge between the week
 * (`week.ts`, on the player) and the save: the growth log, the world's
 * snapshot, and a clock that moves one week. The spine's world tick replaces
 * the clock step; the player-side part (`applyWeekToSave`) stays.
 */

import { CAREER_CALENDAR, CAREER_PRO } from "@/config/balance";
import { applyAging, withPeak } from "./aging";
import { checkRetirement, retireProSave, type RetirementCheck } from "./retire";
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
  return { save: withProInWorld({ ...save, player: withPeak(result.player), growthLog }), result };
}

/** One week later: the day moves by seven, into the next season when it passes the last day. */
export function nextWeekClock(clock: ProSave["clock"]): { clock: ProSave["clock"]; rolledOver: boolean } {
  const lastDay = CAREER_CALENDAR.weeksPerSeason * DAYS_PER_WEEK;
  const day = clock.day + DAYS_PER_WEEK;
  if (day <= lastDay) return { clock: { ...clock, day }, rolledOver: false };
  return { clock: { seasonIndex: clock.seasonIndex + 1, day: day - lastDay }, rolledOver: true };
}

/**
 * The player's part of a season rollover (`save.clock` is already the new
 * season): the decline with its explained entries, the contract-less count,
 * and the end of the career when his age says so. Returns what the end asks
 * of the player (an offer to retire after a year without a contract).
 */
export function rolloverProPlayer(save: ProSave): { save: ProSave; check: RetirementCheck } {
  const seasonIndex = save.clock.seasonIndex;
  const aged = applyAging(save.player, { seasonIndex, careerSeed: save.careerSeed });
  const without = save.stage === "freeAgent" ? (save.player.seasonsWithoutContract ?? 0) + 1 : 0;
  const player = { ...aged.player, seasonsWithoutContract: without };
  const growthLog = [...save.growthLog, ...aged.growth].slice(-CAREER_PRO.growthLogCap);
  let next = withProInWorld({ ...save, player, growthLog });
  const check = checkRetirement(player, { seasonIndex, careerSeed: save.careerSeed, retired: save.stage === "retired" });
  if (check.retire) next = retireProSave(next, check.retire);
  return { save: next, check };
}

/**
 * Play a week and move the clock by one (the store's stand-in until the world
 * tick lands). Crossing into a new season runs the player's rollover.
 */
export function playProWeek(save: ProSave, plan: ProWeekPlan): { save: ProSave; result: WeekResult; check: RetirementCheck | null } {
  const applied = applyWeekToSave(save, plan);
  const { clock, rolledOver } = nextWeekClock(applied.save.clock);
  const moved = { ...applied.save, clock };
  if (!rolledOver) return { save: moved, result: applied.result, check: null };
  const rolled = rolloverProPlayer(moved);
  return { save: rolled.save, result: applied.result, check: rolled.check };
}
