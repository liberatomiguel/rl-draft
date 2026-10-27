/**
 * Daily Challenge generator.
 *
 * The date decides the day — template, modifiers, bonus objective — in
 * `./dailyPlan`, which has no dataset import so the home menu can show today's
 * challenge without loading the data (rc.26, #60). This module runs that plan
 * and builds the restricted lineup pools it asks for from the dataset.
 */

import { draftableLineups, lineups, seasonById } from "@/data";
import { planDaily, type DailyPlan, type DailyPool } from "./dailyPlan";

export interface DailyConfig extends Omit<DailyPlan, "pool"> {
  /** Restricted lineup pool (sorted for determinism). */
  poolLineupIds?: string[];
}

function lineupYear(lineupId: string): number {
  const lineup = lineups.find((l) => l.id === lineupId);
  const season = lineup ? seasonById.get(lineup.seasonId) : undefined;
  return season ? parseInt(season.year, 10) : NaN;
}

// Daily pools draw from the Worlds-only set (regional samOnly teams belong to
// the dedicated region-locked mode, not the shared daily challenge).
function poolLineupIds(pool: DailyPool): string[] {
  switch (pool.kind) {
    case "region":
      return draftableLineups.filter((l) => l.region === pool.region).map((l) => l.id).sort();
    case "era": {
      const inEra = pool.era === "old-school" ? (y: number) => y <= 2019 : (y: number) => y >= 2020;
      return draftableLineups
        .filter((l) => inEra(lineupYear(l.id)))
        .map((l) => l.id)
        .sort();
    }
    case "champions":
      return draftableLineups
        .filter((l) => l.historicalStrength === "elite" || l.historicalStrength === "strong")
        .map((l) => l.id)
        .sort();
  }
}

/** A pool is playable when it can realistically fill a 6-slot draft. */
export function viablePool(pool: DailyPool): boolean {
  return poolLineupIds(pool).length >= 8;
}

export function generateDailyConfig(date: string): DailyConfig {
  const { pool, ...plan } = planDaily(date, viablePool);
  return { ...plan, poolLineupIds: pool ? poolLineupIds(pool) : undefined };
}
