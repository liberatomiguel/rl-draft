/**
 * rc.37 F6: opt-in balance experiments (HUMAN_EXPERIMENT=1). Plays a chosen
 * subset of the battery's units — the same profiles, seeds and cells as
 * auditHuman.test.ts, the same JSONL line per career — under a balance patch
 * applied in memory, so an arm compares PAIRED with the battery's control
 * (same unit key) or with another arm. The default suite never plays it and
 * the patch never touches a file: the balance values shipped are the file's.
 *
 * Spec (HUMAN_EXP = path to a JSON file):
 *   { "arm": "R1", "patch": { "CAREER_RENEWAL_TENURE": { "valueFloorByRenewal": [0.3, 0.45, 0.6] } },
 *     "profiles": ["academy"], "difficulties": ["normal"], "regions": ["NA"], "rosters": ["balanced"],
 *     "seeds": [9100], "seasons": 10, "endlessTo": null, "endlessIf": "title" }
 * The patch is a strict deep merge into balance.ts's exports: an unknown key
 * fails the run (a typo never plays the baseline under another name); arrays
 * and primitives are replaced in place. Engine modules are imported after the
 * patch, so a value a module reads at import time sees it too.
 *
 * Output (HUMAN_DIR, absolute, outside the repo): identity-i.json,
 * shard-i.jsonl, done-i.txt, progress-i.json per shard (HUMAN_SHARDS /
 * HUMAN_SHARD, round-robin). Resume skips done units and refuses a changed
 * arm, patch, plan or simulation.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { expect, it } from "vitest";
import * as balance from "@/config/balance";

const env = process.env;

interface ExperimentSpec {
  arm: string;
  patch?: Record<string, unknown>;
  profiles: string[];
  difficulties: string[];
  regions: string[];
  rosters: string[];
  seeds: number[];
  /** Instead of the cross product: an explicit list of cells (region, difficulty, roster, profile, seed). */
  units?: { region: string; difficulty: string; roster: string; profile: string; seed: number }[];
  seasons?: number;
  /** Continue careers past `seasons` to this season (the same career, no replay). */
  endlessTo?: number | null;
  /** Which careers continue: Worlds champions by `seasons` only (the battery's rule) or all. */
  endlessIf?: "title" | "all";
}

type Plain = Record<string, unknown>;
const isObject = (x: unknown): x is Plain => typeof x === "object" && x !== null && !Array.isArray(x);

/** Strict deep merge of `patch` into `target` (balance.ts's live objects). Returns the paths it set. */
export function applyBalancePatch(target: Plain, patch: Plain, path = "balance"): string[] {
  const set: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const here = `${path}.${key}`;
    if (!Object.hasOwn(target, key)) throw Error(`Unknown balance key ${here}`);
    const current = target[key];
    if (isObject(value)) {
      if (!isObject(current)) throw Error(`${here} is not an object in balance.ts`);
      set.push(...applyBalancePatch(current, value, here));
    } else if (Array.isArray(value)) {
      if (!Array.isArray(current)) throw Error(`${here} is not an array in balance.ts`);
      (current as unknown[]).splice(0, current.length, ...value);
      set.push(here);
    } else {
      if (path === "balance") throw Error(`${here}: a top-level primitive export cannot be patched`);
      if (isObject(current) || Array.isArray(current)) throw Error(`${here} is an object or array in balance.ts`);
      if (typeof current !== typeof value) throw Error(`${here}: ${typeof value} replaces a ${typeof current}`);
      target[key] = value;
      set.push(here);
    }
  }
  return set;
}

function externalDir(value: string | undefined): string {
  if (!value || !isAbsolute(value)) throw Error("HUMAN_DIR must be an absolute output path outside the repo");
  const path = resolve(value), rel = relative(process.cwd(), path);
  if (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))) throw Error("Experiment evidence belongs outside the repo");
  return path;
}

/** The battery's simulation hash (auditHuman.test.ts), so identities compare across both runners. */
function simulationHash(): string {
  const root = resolve(process.cwd(), "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) walk(path);
      else if (/\.(ts|tsx|json|mjs)$/.test(name.name) && !/\.test\.tsx?$/.test(name.name) && !name.name.startsWith("auditHumanSummary")) files.push(path);
    }
  };
  for (const sub of ["engine", "config", "data", "lib", "store"]) walk(join(root, sub));
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(root, file).split(sep).join("/")).update(readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
  }
  return hash.digest("hex");
}

it.skipIf(env.HUMAN_EXPERIMENT !== "1")("plays an F6 balance experiment arm (explicit opt-in)", async () => {
  if (!env.HUMAN_EXP) throw Error("HUMAN_EXP must name the experiment spec (JSON)");
  const spec = JSON.parse(readFileSync(env.HUMAN_EXP, "utf8")) as ExperimentSpec;
  if (!spec.arm || !/^[\w.+-]+$/.test(spec.arm)) throw Error("spec.arm must be a short name");
  const dir = externalDir(env.HUMAN_DIR);
  const shards = Number(env.HUMAN_SHARDS ?? 1), shard = Number(env.HUMAN_SHARD ?? 0);
  if (!Number.isSafeInteger(shards) || !Number.isSafeInteger(shard) || shards < 1 || shard < 0 || shard >= shards) throw Error("Invalid shard setting");

  // The patch first, then every module that reads balance.
  const patched = applyBalancePatch(balance as unknown as Plain, spec.patch ?? {});
  const { advanceArcRun, startArcRun } = await import("./auditHumanBot");
  const { profiles } = await import("./auditHumanProfiles");
  const { humanTelemetry } = await import("./auditHumanTelemetry");
  const { cellKey, validateCells } = await import("./auditHumanMatrix");
  type Cell = Parameters<typeof cellKey>[0];

  const seasons = spec.seasons ?? 10;
  const cells: Cell[] = [];
  if (spec.units) for (const u of spec.units) cells.push({ ...u, seasons, cohort: "coverage", worldsExtra: 0 } as Cell);
  else for (const difficulty of spec.difficulties) for (const region of spec.regions) for (const roster of spec.rosters)
    for (const profile of spec.profiles) for (const seed of spec.seeds)
      cells.push({ region, difficulty, roster, profile, seed, seasons, cohort: "coverage", worldsExtra: 0 } as Cell);
  validateCells(cells);
  const selected = cells.filter((_, i) => i % shards === shard);
  const identity = {
    protocol: "rc37-f6-v1", arm: spec.arm, patch: spec.patch ?? {}, patched, endlessTo: spec.endlessTo ?? null,
    endlessIf: spec.endlessIf ?? "title", simulationHash: simulationHash(), balanceVersion: balance.BALANCE_VERSION,
    planHash: createHash("sha256").update(JSON.stringify(cells)).digest("hex"), shards, shard,
  };
  mkdirSync(dir, { recursive: true });
  const idPath = resolve(dir, `identity-${shard}.json`);
  if (existsSync(idPath)) {
    const stored = JSON.parse(readFileSync(idPath, "utf8"));
    if (JSON.stringify(stored.identity) !== JSON.stringify(identity)) throw Error("Resume metadata differs (arm, patch, plan or simulation changed); use a fresh HUMAN_DIR");
  } else writeFileSync(idPath, JSON.stringify({ identity, planned: selected.length, total: cells.length }, null, 2));

  const jsonl = resolve(dir, `shard-${shard}.jsonl`), donePath = resolve(dir, `done-${shard}.txt`);
  const done = new Set(existsSync(donePath) ? readFileSync(donePath, "utf8").split("\n").filter(Boolean) : []);
  const failures: string[] = [];
  const t0 = Date.now();
  let played = 0;
  for (const cell of selected) {
    const key = cellKey(cell);
    if (done.has(key)) continue;
    const profile = profiles[cell.profile];
    const tel = humanTelemetry();
    const hooks = { onDay: tel.onDay, onSeason: tel.onSeason, onAction: tel.onAction, onEvent: tel.onEvent, onEventSettled: tel.onEventSettled };
    const lines: string[] = [];
    try {
      const run = startArcRun({
        region: cell.region, difficulty: cell.difficulty, rosterKey: cell.roster, policy: profile.base,
        policyOverrides: profile.changes, seed: cell.seed, seasons, budgetMs: 600_000,
      });
      advanceArcRun(run, seasons, hooks);
      lines.push(JSON.stringify({ unit: key, tier: "F6", arm: spec.arm, ...cell, arc: run.out, ...tel.result(), spyApplications: 0, forkAt: null }));
      if (run.out.softlock) failures.push(`${key}: ${run.out.softlock}`);
      const to = spec.endlessTo ?? null;
      const goOn = to !== null && to > seasons && run.stage === "seasonOver"
        && ((spec.endlessIf ?? "title") === "all" || run.out.worldsTitleSeason !== null);
      if (goOn) {
        run.budgetMs = 600_000 * (to / seasons);
        advanceArcRun(run, to, hooks);
        lines.push(JSON.stringify({ unit: key, tier: "F6", arm: spec.arm, ...cell, cohort: "endless", seasons: to, arc: run.out,
          ...tel.result(), spyApplications: 0, extendedFrom: seasons }));
        if (run.out.softlock) failures.push(`${key} endless: ${run.out.softlock}`);
      }
    } catch (error) {
      const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
      lines.push(JSON.stringify({ unit: key, tier: "F6", arm: spec.arm, ...cell, cohort: "error", error: message }));
      failures.push(`${key}: error ${message.split("\n")[0]}`);
    }
    appendFileSync(jsonl, lines.join("\n") + "\n");
    appendFileSync(donePath, key + "\n");
    played++;
    const progress = { arm: spec.arm, shard, done: done.size + played, planned: selected.length, last: key,
      failures: failures.length, elapsedMin: Math.round((Date.now() - t0) / 6000) / 10 };
    writeFileSync(resolve(dir, `progress-${shard}.json.tmp`), JSON.stringify(progress));
    renameSync(resolve(dir, `progress-${shard}.json.tmp`), resolve(dir, `progress-${shard}.json`));
  }
  if (failures.length) writeFileSync(resolve(dir, `failures-${shard}.json`), JSON.stringify(failures, null, 2));
  expect(failures, "softlocks / errors in this shard (all recorded in the JSONL)").toEqual([]);
}, 86_400_000);
