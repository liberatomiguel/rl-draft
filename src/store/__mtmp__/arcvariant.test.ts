// Temporary (front M, not committed): the arc sweep with balance overrides from VARIANT
// (JSON: { "CAREER_DEV.peakAgeShift": 0, ... }), so a lever's sensitivity can be measured
// without editing balance.ts. Same cells and seeds as careerArc.test.ts.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import * as B from "@/config/balance";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { ARC_DEFAULT_POLICIES, ARC_POLICIES, playArcCareer, type ArcCareer, type ArcPolicyId } from "../careerArcBot";

const env = process.env;
const ALL_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, all: readonly T[]): T[] =>
  v ? (v.split(",").filter((x) => (all as readonly string[]).includes(x)) as T[]) : [...all];

function patch(path: string, value: unknown) {
  const parts = path.split(".");
  let o = (B as unknown as Record<string, unknown>)[parts[0]] as Record<string, unknown>;
  for (const p of parts.slice(1, -1)) o = o[p] as Record<string, unknown>;
  o[parts[parts.length - 1]] = value;
}

it("arc variant sweep", { timeout: 7_200_000 }, () => {
  for (const [k, v] of Object.entries(JSON.parse(env.VARIANT ?? "{}") as Record<string, unknown>)) patch(k, v);
  const regions = list(env.ARC_REGIONS, ALL_REGIONS);
  const diffs = list<CareerDifficulty>(env.ARC_DIFFS, ["easy", "normal", "hard"]);
  const policies = env.ARC_POLICIES ? list<ArcPolicyId>(env.ARC_POLICIES, Object.keys(ARC_POLICIES) as ArcPolicyId[]) : [...ARC_DEFAULT_POLICIES];
  const seeds = Number(env.ARC_SEEDS ?? 1);
  const [slice, slices] = (env.ARC_SLICE ?? "0/1").split("/").map(Number);
  const cells: { region: Region; difficulty: CareerDifficulty; policy: ArcPolicyId; seed: number }[] = [];
  for (const region of regions)
    for (const difficulty of diffs)
      for (const policy of policies)
        for (const seed of env.ARC_SEED_LIST ? env.ARC_SEED_LIST.split(",").map(Number) : Array.from({ length: seeds }, (_, k) => 9100 + k * 7919))
          cells.push({ region, difficulty, policy, seed });
  const careers: ArcCareer[] = [];
  for (const cell of cells.filter((_, i) => i % slices === slice)) {
    careers.push(playArcCareer({ ...cell, seasons: 8, budgetMs: 900_000 }));
    if (env.ARC_OUT) writeFileSync(env.ARC_OUT, JSON.stringify({ seasons: 8, careers }));
  }
});
