import { profiles } from "./auditHumanProfiles";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
export const AUDIT_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
export const AUDIT_DIFFICULTIES: CareerDifficulty[] = ["easy", "normal", "hard"];
export const AUDIT_ROSTERS = ["balanced", "prospects", "journeymen"] as const;
export const AUDIT_SEEDS = [9100, 17019] as const;
export type HumanCohort = "smoke" | "coverage" | "endless" | "worldsPair";
export interface HumanCell {
  region: Region; difficulty: CareerDifficulty; roster: typeof AUDIT_ROSTERS[number];
  profile: string; seed: number; seasons: number; cohort: HumanCohort;
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
      || !["smoke", "coverage", "endless", "worldsPair"].includes(c.cohort)
      || !Number.isFinite(c.worldsExtra) || c.worldsExtra < 0) throw Error("Invalid audit cell: " + JSON.stringify(c));
    const key = cellKey(c);
    if (seen.has(key)) throw Error("Duplicate audit cell: " + key);
    seen.add(key);
    return c;
  });
}
/**
 * rc.36.10 F4a's flat plan (kept for reference and its contract test): every
 * cell × 3 Worlds variants × 2 horizons from S1 = 30,996 careers, where the
 * S20 rows replay the S10 rows' first ten seasons and the variants replay
 * everything before the first Worlds. Superseded by `humanCohortPlan`.
 */
export function humanMatrix(seeds = [9100, 17019], worldsExtras = [0, 0.5, 1]): HumanCell[] {
  if (new Set(seeds).size < 2) throw Error("Matrix requires at least two different seeds per cell");
  if (!worldsExtras.includes(0)) throw Error("Matrix requires a paired control");
  const cells: HumanCell[] = [];
  for (const region of AUDIT_REGIONS) for (const difficulty of AUDIT_DIFFICULTIES)
    for (const roster of AUDIT_ROSTERS) for (const profile of Object.keys(profiles))
      for (const seed of seeds) for (const worldsExtra of worldsExtras) {
        cells.push({ region, difficulty, roster, profile, seed, worldsExtra, seasons: 10, cohort: "coverage" });
        cells.push({ region, difficulty, roster, profile, seed, worldsExtra, seasons: 20, cohort: "endless" });
      }
  return validateCells(cells);
}

/** The base personas (the 04/11 baseline four + the rc.37 F4a profiles); the rest are one-factor cohorts. */
export const BASE_PROFILES = [
  "learner", "academy", "known", "ambitious", "homegrown", "prospectsOnly", "stars", "trader", "continuous",
  "buyAll", "experienced", "novice", "coachFixed", "coachUpgrades",
] as const;

/**
 * rc.37 round 2: one unit of the cohort plan — ONE control career (worldsExtra
 * 0, to S10) and what forks or extends from it, so no S1–S10 prefix is
 * played twice:
 *  - `worldsExtras`: the paired Worlds experiment. On the morning of the
 *    user's first Worlds the control is cloned; each copy goes on to S10 with
 *    the opponents' Worlds rating raised by x (spy, no patch). Same seed and
 *    same past up to that day, so the pair differs by the treatment only.
 *  - `endlessTo`: a control with a Worlds title by S10 goes on to this
 *    season (the long post-title sample), from its own S10 state.
 */
export interface HumanUnit {
  key: string;
  tier: "A" | "B" | "C" | "D" | "smoke";
  cell: HumanCell;
  worldsExtras: number[];
  endlessTo: number | null;
}

/**
 * rc.37 round 2 plan: 7 regions × 3 difficulties × 3 rosters × the distinct
 * profiles (aliases — identical effective policies — played once) × 2 seeds,
 * every control to S10, in four tiers so a partial run is already balanced:
 *  - A: base profiles, first seed — Worlds pairs (+0.5, +1) and the S20 extension;
 *  - B: base profiles, second seed — Worlds pairs;
 *  - C / D: one-factor profiles (style, plan, workload, focus, scrims, briefing), each seed.
 * Within a tier: difficulty → region → roster → profile, so the shards
 * (round-robin over this order) and any prefix cover every cell evenly.
 */
export function humanCohortPlan(opts: { aliases: Record<string, string>; seeds?: readonly number[]; worldsExtras?: number[]; endlessTo?: number }): HumanUnit[] {
  const seeds = opts.seeds ?? AUDIT_SEEDS;
  if (new Set(seeds).size < 2) throw Error("The plan requires at least two different seeds per cell");
  const extras = opts.worldsExtras ?? [0.5, 1];
  if (extras.some((x) => !(x > 0))) throw Error("Worlds variants are positive increments; the control is the unit's own career");
  const endlessTo = opts.endlessTo ?? 20;
  const distinct = Object.keys(profiles).filter((p) => !Object.hasOwn(opts.aliases, p));
  const base = BASE_PROFILES.filter((p) => distinct.includes(p));
  const factors = distinct.filter((p) => !(BASE_PROFILES as readonly string[]).includes(p));
  const tiers: { tier: HumanUnit["tier"]; profiles: string[]; seed: number; pairs: boolean; endless: boolean }[] = [
    { tier: "A", profiles: base, seed: seeds[0], pairs: true, endless: true },
    { tier: "B", profiles: base, seed: seeds[1], pairs: true, endless: false },
    { tier: "C", profiles: factors, seed: seeds[0], pairs: false, endless: false },
    { tier: "D", profiles: factors, seed: seeds[1], pairs: false, endless: false },
  ];
  const units: HumanUnit[] = [];
  for (const t of tiers) for (const difficulty of AUDIT_DIFFICULTIES) for (const region of AUDIT_REGIONS)
    for (const roster of AUDIT_ROSTERS) for (const profile of t.profiles) {
      const cell: HumanCell = { region, difficulty, roster, profile, seed: t.seed, seasons: 10, cohort: "coverage", worldsExtra: 0 };
      units.push({ key: cellKey(cell), tier: t.tier, cell, worldsExtras: t.pairs ? extras : [], endlessTo: t.endless ? endlessTo : null });
    }
  validateCells(units.map((u) => u.cell));
  return units;
}

/** Only default executable plan: three contrasting careers, no automatic matrix. */
export function humanSmoke(): HumanCell[] {
  return validateCells([
    { region: "SAM", difficulty: "normal", roster: "prospects", profile: "prospectsOnly", seed: 9100, seasons: 10, cohort: "smoke", worldsExtra: 0 },
    { region: "EU", difficulty: "hard", roster: "journeymen", profile: "continuous", seed: 17019, seasons: 10, cohort: "smoke", worldsExtra: 0 },
    { region: "APAC", difficulty: "easy", roster: "balanced", profile: "novice", seed: 31337, seasons: 10, cohort: "smoke", worldsExtra: 0 },
  ]);
}
