import { profiles } from "./auditHumanProfiles";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
export const AUDIT_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
export const AUDIT_DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];
export const AUDIT_ROSTERS = ["balanced", "prospects", "journeymen"] as const;
export interface HumanCell {
  region: Region; difficulty: CareerDifficulty; roster: typeof AUDIT_ROSTERS[number];
  profile: string; seed: number; seasons: number; cohort: "smoke" | "coverage" | "endless";
  /** Extra opponent rating at Worlds only, applied by a test spy. Major stays unchanged. */
  worldsExtra: number;
}
export function cellKey(c: HumanCell): string {
  return [c.cohort, c.region, c.difficulty, c.roster, c.profile, c.seed, c.seasons, c.worldsExtra].join("|");
}
export function validateCells(input: unknown): HumanCell[] {
  if (!Array.isArray(input) || input.length === 0) throw Error("Empty or invalid human-audit manifest");
  const seen = new Set<string>();
  return input.map((c: HumanCell) => {
    if (!AUDIT_REGIONS.includes(c.region) || !AUDIT_DIFFICULTIES.includes(c.difficulty)
      || !AUDIT_ROSTERS.includes(c.roster) || !Object.hasOwn(profiles, c.profile)
      || !Number.isSafeInteger(c.seed) || !Number.isInteger(c.seasons) || c.seasons < 1 || c.seasons > 20
      || !["smoke", "coverage", "endless"].includes(c.cohort)
      || !Number.isFinite(c.worldsExtra) || c.worldsExtra < 0) throw Error("Invalid audit cell: " + JSON.stringify(c));
    const key = cellKey(c);
    if (seen.has(key)) throw Error("Duplicate audit cell: " + key);
    seen.add(key);
    return c;
  });
}
/** Build only: execution requires HUMAN_MODE=matrix explicitly. */
export function humanMatrix(seeds = [9100, 17019], worldsExtras = [0, 0.5, 1]): HumanCell[] {
  if (new Set(seeds).size < 2) throw Error("Matrix requires at least two different seeds per cell");
  if (!worldsExtras.includes(0)) throw Error("Matrix requires a paired control");
  const cells: HumanCell[] = [];
  for (const region of AUDIT_REGIONS) for (const difficulty of AUDIT_DIFFICULTIES)
    for (const roster of AUDIT_ROSTERS) for (const profile of Object.keys(profiles))
      for (const seed of seeds) for (const worldsExtra of worldsExtras) {
        cells.push({ region, difficulty, roster, profile, seed, worldsExtra, seasons: 10, cohort: "coverage" });
        // Continue the SAME seed/policy through S20. No forced championship: no-title rows
        // remain explicit non-entrants to post-title analysis rather than fabricated successes.
        cells.push({ region, difficulty, roster, profile, seed, worldsExtra, seasons: 20, cohort: "endless" });
      }
  return validateCells(cells);
}
/** Only default executable plan: three contrasting careers, no automatic matrix. */
export function humanSmoke(): HumanCell[] {
  return validateCells([
    { region: "SAM", difficulty: "normal", roster: "prospects", profile: "prospectsOnly", seed: 9100, seasons: 10, cohort: "smoke", worldsExtra: 0 },
    { region: "EU", difficulty: "hard", roster: "journeymen", profile: "continuous", seed: 17019, seasons: 10, cohort: "smoke", worldsExtra: 0 },
    { region: "APAC", difficulty: "easy", roster: "balanced", profile: "novice", seed: 31337, seasons: 10, cohort: "smoke", worldsExtra: 0 },
  ]);
}
