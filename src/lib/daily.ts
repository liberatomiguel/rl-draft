/**
 * Daily Challenge generator.
 *
 * The UTC date string hashes into the run seed, so EVERYONE gets the same
 * draft, the same opponents and the same modifiers on the same day. Variety
 * comes from a template wheel (regional lockdowns, era restrictions,
 * blackout, no-reroll, gauntlet, specials surge…) plus an optional bonus
 * objective — both picked deterministically from the date.
 */

import { lineups, seasonById } from "@/data";
import { createRng } from "@/lib/rng";
import type { DailyInfo, Difficulty, Region } from "@/engine/types";

export interface DailyConfig {
  info: DailyInfo;
  difficulty: Difficulty;
  /** Forced hidden overalls (Blackout). */
  hiddenOverall: boolean;
  /** undefined = use the difficulty's budget. */
  rerollsOverride?: number;
  /** Multiplier on the special appearance chance. */
  specialChanceMult?: number;
  /** Restricted lineup pool (sorted for determinism). */
  poolLineupIds?: string[];
}

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** FNV-1a — stable across platforms, good enough to seed mulberry32. */
export function seedFromDate(date: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function lineupYear(lineupId: string): number {
  const lineup = lineups.find((l) => l.id === lineupId);
  const season = lineup ? seasonById.get(lineup.seasonId) : undefined;
  return season ? parseInt(season.year, 10) : NaN;
}

function poolByRegion(region: Region): string[] {
  return lineups.filter((l) => l.region === region).map((l) => l.id).sort();
}

function poolByEra(test: (year: number) => boolean): string[] {
  return lineups
    .filter((l) => test(lineupYear(l.id)))
    .map((l) => l.id)
    .sort();
}

/** A pool is playable when it can realistically fill a 6-slot draft. */
function viable(pool: string[]): boolean {
  return pool.length >= 8;
}

export function generateDailyConfig(date: string): DailyConfig {
  const rng = createRng(seedFromDate(date) ^ 0x5eed);

  type Template = () => Omit<DailyConfig, "info"> & { label: string; description: string };

  const templates: Template[] = [
    () => ({
      label: "Pure Bracket",
      description: "No modifiers. A clean classic run — same seed for everyone.",
      difficulty: "normal",
      hiddenOverall: false,
    }),
    () => {
      const regions: Region[] = ["NA", "EU", "SAM", "MENA", "OCE"];
      const region = rng.pick(regions);
      const pool = poolByRegion(region);
      if (!viable(pool)) {
        return {
          label: "Pure Bracket",
          description: "No modifiers. A clean classic run — same seed for everyone.",
          difficulty: "normal",
          hiddenOverall: false,
        };
      }
      return {
        label: `Regional Lockdown: ${region}`,
        description: `Only ${region} lineups in the draft and the bracket.`,
        difficulty: "normal",
        hiddenOverall: false,
        poolLineupIds: pool,
      };
    },
    () => {
      const pool = poolByEra((y) => y <= 2019);
      return viable(pool)
        ? {
            label: "Old School",
            description: "2016-2019 lineups only. The classics decide it.",
            difficulty: "normal",
            hiddenOverall: false,
            poolLineupIds: pool,
          }
        : {
            label: "Pure Bracket",
            description: "No modifiers. A clean classic run — same seed for everyone.",
            difficulty: "normal",
            hiddenOverall: false,
          };
    },
    () => {
      const pool = poolByEra((y) => y >= 2020);
      return viable(pool)
        ? {
            label: "Modern Era",
            description: "RLCS X and later only. Today's game, today's stars.",
            difficulty: "normal",
            hiddenOverall: false,
            poolLineupIds: pool,
          }
        : {
            label: "Pure Bracket",
            description: "No modifiers. A clean classic run — same seed for everyone.",
            difficulty: "normal",
            hiddenOverall: false,
          };
    },
    () => ({
      label: "Blackout",
      description: "Overalls hidden everywhere. Draft on knowledge alone.",
      difficulty: "normal",
      hiddenOverall: true,
    }),
    () => ({
      label: "No Safety Net",
      description: "Zero rerolls. The first read has to be the right one.",
      difficulty: "normal",
      hiddenOverall: false,
      rerollsOverride: 0,
    }),
    () => ({
      label: "Gauntlet",
      description: "Hard rules: hidden overalls and a stronger field.",
      difficulty: "hard",
      hiddenOverall: true,
    }),
    () => ({
      label: "Specials Surge",
      description: "Special cards appear far more often — collectors' day.",
      difficulty: "normal",
      hiddenOverall: false,
      // v0.5: base chance went 0.07 → 0.16, so the surge multiplier came down
      // (×4 would have meant a special on most cards).
      specialChanceMult: 2.5,
    }),
  ];

  const picked = rng.pick(templates)();

  // ~45% of days carry a bonus objective on top.
  let objective: DailyInfo["objective"];
  if (rng.chance(0.45)) {
    objective = rng.chance(0.5)
      ? {
          type: "chemistry_good",
          label: "Finish with Good+ chemistry",
          bonusXp: 50,
        }
      : {
          type: "concede_under",
          value: 25,
          label: "Concede fewer than 25 goals",
          bonusXp: 50,
        };
  }

  return {
    info: {
      date,
      label: picked.label,
      description: picked.description,
      objective,
    },
    difficulty: picked.difficulty,
    hiddenOverall: picked.hiddenOverall,
    rerollsOverride: picked.rerollsOverride,
    specialChanceMult: picked.specialChanceMult,
    poolLineupIds: picked.poolLineupIds,
  };
}
