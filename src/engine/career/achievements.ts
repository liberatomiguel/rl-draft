/**
 * Road to Worlds — career achievement evaluation (v2.0, R32). Pure: reads a
 * save plus the cross-save memory the career store keeps (unlock dates, the
 * difficulties Worlds was won on) and returns the ids that just unlocked.
 * Flows leave MARKERS on `save.flags` for one-shot facts (sponsor signed,
 * bank cleared, qualifier advanced, the Worlds-win roster context) so this
 * never parses news.
 */

import { CAREER_ACHIEVEMENTS, careerAchievementById, type CareerAchievementDef } from "@/data/career/achievements";
import type { CareerDifficulty, CareerSave } from "./types";

export interface CareerAchievementMemory {
  /** id → unlocked-at (ms epoch). Permanent, across saves. */
  unlocked: Record<string, number>;
  /** Difficulties a Worlds title was won on (across saves). */
  worldsWonOn: Partial<Record<CareerDifficulty, true>>;
}

export const EMPTY_ACHIEVEMENT_MEMORY: CareerAchievementMemory = { unlocked: {}, worldsWonOn: {} };

/** Flag keys the flows set (kept here so engine + flows agree on the spelling). */
export const ACH_FLAGS = {
  sponsorSigned: "achSponsorSigned",
  bankCleared: "achBankCleared",
  qualifierAdvanced: "achQualifierAdvanced",
  /** Max fielded starter overall at the Worlds win (number, stored as flag value). */
  worldsMaxStarterOvr: "achWorldsMaxStarterOvr",
  /** rc.4: biggest overall gap (field average − user team) over the regional /
   *  Major / Worlds titles won (number; the underdog achievement reads it). */
  underdogGap: "achUnderdogGap",
  /** Worlds won with the founding roster only. */
  worldsHomegrown: "achWorldsHomegrown",
} as const;

const ALL_DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];

function satisfied(def: CareerAchievementDef, save: CareerSave, memory: CareerAchievementMemory): boolean {
  const c = def.condition;
  const flags = save.flags as Record<string, unknown>;
  switch (c.kind) {
    case "flag":
      return Boolean(flags[c.flag]);
    case "stat":
      return (save.stats[c.stat] ?? 0) >= c.min;
    case "reputation":
      return save.reputation >= c.min;
    case "seasonIndex":
      return save.clock.seasonIndex >= c.min;
    case "titleUnderdog": {
      const v = flags[ACH_FLAGS.underdogGap];
      return typeof v === "number" && v >= c.margin;
    }
    case "worldsHomegrown":
      return Boolean(flags[ACH_FLAGS.worldsHomegrown]);
    case "allDifficulties":
      return ALL_DIFFICULTIES.every((d) => memory.worldsWonOn[d] === true);
  }
}

/**
 * rc.36 (UX-05, DESIGN-DECISIONS #155): ONE record of what is unlocked. The
 * profile's career marks (cloud-synced, union-merged, untouched by a Season
 * reset) count as unlocked here too: a mark another device — or an older
 * store — already holds joins this memory silently, dated `at` (no toast, no
 * XP), so it is never granted twice. Unknown ids are ignored.
 */
export function withProfileMarks(
  memory: CareerAchievementMemory,
  marks: readonly string[],
  at: number,
): CareerAchievementMemory {
  const missing = marks.filter((id) => careerAchievementById.has(id) && !memory.unlocked[id]);
  if (missing.length === 0) return memory;
  const unlocked = { ...memory.unlocked };
  for (const id of missing) unlocked[id] = at;
  return { ...memory, unlocked };
}

/** The memory's unlocked ids the profile's marks lack (catalog order) — mirrored back, silently. */
export function marksMissingFrom(memory: CareerAchievementMemory, marks: readonly string[]): string[] {
  const have = new Set(marks);
  return CAREER_ACHIEVEMENTS.filter((d) => memory.unlocked[d.id] && !have.has(d.id)).map((d) => d.id);
}

/** Ids newly satisfied by this save that the memory has not unlocked yet (catalog order). */
export function evaluateCareerAchievements(save: CareerSave, memory: CareerAchievementMemory): string[] {
  const out: string[] = [];
  for (const def of CAREER_ACHIEVEMENTS) {
    if (memory.unlocked[def.id]) continue;
    if (satisfied(def, save, memory)) out.push(def.id);
  }
  return out;
}

/** The difficulties a Worlds title has been won on, folding this save's end state in. */
export function worldsWonOnAfter(
  save: CareerSave,
  memory: CareerAchievementMemory,
): CareerAchievementMemory["worldsWonOn"] {
  if (save.stats.titlesWorlds > 0) return { ...memory.worldsWonOn, [save.difficulty]: true };
  return memory.worldsWonOn;
}
