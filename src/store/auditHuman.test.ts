/** Local, opt-in human audit. Default test suite never plays this matrix. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync, closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, readdirSync,
  renameSync, statSync, writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { expect, it } from "vitest";
import { BALANCE_VERSION } from "@/config/balance";
import { ARC_POLICIES, advanceArcRun, playArcCareer, startArcRun, userWorldsStartsToday, type ArcHooks, type ArcRun } from "./auditHumanBot";
import { profileAliases, profiles } from "./auditHumanProfiles";
import { cellKey, humanCohortPlan, humanSmoke, validateCells, type HumanCell, type HumanUnit } from "./auditHumanMatrix";
import { auditStamp, humanTelemetry, type TelemetryState } from "./auditHumanTelemetry";
import { withWorldsExtra } from "./auditHumanSpy";

const env = process.env;
type AuditRow = HumanCell & ReturnType<ReturnType<typeof humanTelemetry>["result"]> & {
  arc: ReturnType<typeof playArcCareer>; spyApplications: number;
};
function externalDir(value: string | undefined): string {
  if (!value || !isAbsolute(value)) throw Error("HUMAN_DIR must be an absolute output path outside the repo");
  const path = resolve(value), rel = relative(process.cwd(), path);
  if (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))) throw Error("Audit evidence belongs outside the repo");
  return path;
}
function integer(value: string | undefined, fallback: number, min: number) {
  const result = Number(value ?? fallback);
  if (!Number.isSafeInteger(result) || result < min) throw Error("Invalid shard setting");
  return result;
}

/**
 * rc.37: the hash of what decides a career — the engine, config, data, lib and
 * the store (flows + the audit bot), tests and the read-only summary left out —
 * so a resume refuses a changed simulation but not a docs or report commit.
 */
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
  for (const file of files.sort()) hash.update(relative(root, file).split(sep).join("/")).update(readFileSync(file));
  return hash.digest("hex");
}

/** The JSONL ends at a complete line: a fragment a killed process left is cut before appending again. */
function trimPartialLine(path: string): void {
  if (!existsSync(path)) return;
  const size = statSync(path).size;
  if (size === 0) return;
  const fd = openSync(path, "r+");
  try {
    const tail = Math.min(size, 8 * 1024 * 1024);
    const buf = Buffer.alloc(tail);
    readSync(fd, buf, 0, tail, size - tail);
    if (buf[tail - 1] === 0x0a) return;
    const cut = buf.lastIndexOf(0x0a);
    ftruncateSync(fd, cut < 0 ? size - tail : size - tail + cut + 1);
  } finally {
    closeSync(fd);
  }
}

/** One career's record, serialized at once (the telemetry goes on mutating when the career is extended). */
function recordLine(unit: HumanUnit, cell: HumanCell, run: ArcRun, tel: ReturnType<typeof humanTelemetry>, extra: Record<string, unknown>): string {
  return JSON.stringify({ unit: unit.key, tier: unit.tier, ...cell, arc: run.out, ...tel.result(), ...extra });
}

/**
 * rc.37 round 2: one unit — the control to S10 (forked on the morning of its
 * first Worlds when the unit carries Worlds pairs), each pair from the fork
 * under the spy, then the S20 extension of a titled control. Lines are
 * returned, never written here: the caller appends a unit in one write.
 */
function playUnit(unit: HumanUnit, budgetMs: number): { lines: string[]; softlocks: string[]; budgetSoftlock: boolean } {
  const cell = unit.cell, profile = profiles[cell.profile];
  const telemetry = humanTelemetry();
  const run = startArcRun({
    region: cell.region, difficulty: cell.difficulty, rosterKey: cell.roster, policy: profile.base,
    policyOverrides: profile.changes, seed: cell.seed, seasons: cell.seasons, budgetMs,
  });
  let fork: { run: ArcRun; tel: TelemetryState; at: ReturnType<typeof auditStamp> } | null = null;
  const observe = (tel: ReturnType<typeof humanTelemetry>): ArcHooks => ({
    onDay: tel.onDay, onSeason: tel.onSeason, onAction: tel.onAction, onEvent: tel.onEvent, onEventSettled: tel.onEventSettled,
  });
  advanceArcRun(run, cell.seasons, {
    ...observe(telemetry),
    fork: unit.worldsExtras.length > 0
      ? { when: userWorldsStartsToday, take: (r) => { fork = structuredClone({ run: r, tel: telemetry.state(), at: auditStamp(r.save) }); } }
      : undefined,
  });
  const forked = fork as { run: ArcRun; tel: TelemetryState; at: ReturnType<typeof auditStamp> } | null;
  const lines = [recordLine(unit, cell, run, telemetry, { spyApplications: 0, forkAt: forked?.at ?? null })];
  const softlocks = run.out.softlock ? [run.out.softlock] : [];
  let budgetSoftlock = Boolean(run.out.softlock?.startsWith("budget"));
  for (const worldsExtra of unit.worldsExtras) {
    const pairCell: HumanCell = { ...cell, cohort: "worldsPair", worldsExtra };
    if (!forked) {
      // Never exposed: no Worlds by S10, so the pair IS the control (reported as not exposed, never as a result).
      lines.push(JSON.stringify({ unit: unit.key, tier: unit.tier, ...pairCell, exposed: false }));
      continue;
    }
    const copy = structuredClone(forked);
    const tel = humanTelemetry(copy.tel);
    const exp = withWorldsExtra(worldsExtra, () => advanceArcRun(copy.run, cell.seasons, observe(tel)));
    lines.push(recordLine(unit, pairCell, copy.run, tel, { exposed: true, spyApplications: exp.applications, forkAt: copy.at }));
    if (copy.run.out.softlock) {
      softlocks.push(`pair+${worldsExtra}: ${copy.run.out.softlock}`);
      budgetSoftlock ||= copy.run.out.softlock.startsWith("budget");
    }
  }
  if (unit.endlessTo && run.stage === "seasonOver" && run.out.worldsTitleSeason !== null) {
    // The same career goes on from its own S10 (no replay): the long post-title sample.
    run.budgetMs = budgetMs * (unit.endlessTo / cell.seasons);
    advanceArcRun(run, unit.endlessTo, observe(telemetry));
    lines.push(recordLine(unit, { ...cell, cohort: "endless", seasons: unit.endlessTo }, run, telemetry, {
      spyApplications: 0, extendedFrom: cell.seasons,
    }));
    if (run.out.softlock) {
      softlocks.push(`endless: ${run.out.softlock}`);
      budgetSoftlock ||= run.out.softlock.startsWith("budget");
    }
  }
  return { lines, softlocks, budgetSoftlock };
}

function runCohorts(dir: string, shards: number, shard: number) {
  const aliases = profileAliases(ARC_POLICIES);
  let units = humanCohortPlan({ aliases });
  const tiers = env.HUMAN_TIERS ? new Set(env.HUMAN_TIERS.split(",")) : null;
  const selected = units.filter((_, i) => i % shards === shard).filter((u) => !tiers || tiers.has(u.tier));
  const limit = env.HUMAN_LIMIT ? integer(env.HUMAN_LIMIT, 0, 1) : Infinity;
  const planHash = createHash("sha256").update(JSON.stringify(units)).digest("hex");
  const identity = {
    protocol: "rc37-human-v2", simulationHash: simulationHash(), balanceVersion: BALANCE_VERSION,
    profileHash: createHash("sha256").update(JSON.stringify(profiles)).digest("hex"), planHash, shards, shard,
  };
  mkdirSync(dir, { recursive: true });
  const idPath = resolve(dir, `identity-${shard}.json`);
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (existsSync(idPath)) {
    const stored = JSON.parse(readFileSync(idPath, "utf8"));
    if (JSON.stringify(stored.identity) !== JSON.stringify(identity)) throw Error("Resume metadata differs (simulation, plan or partition changed); use a fresh HUMAN_DIR");
  } else writeFileSync(idPath, JSON.stringify({ identity, revision, aliases, planned: selected.length, totalUnits: units.length }, null, 2));
  if (env.HUMAN_PLAN_ONLY === "1") {
    writeFileSync(resolve(dir, "plan.json"), JSON.stringify({ identity, aliases, total: units.length,
      byTier: Object.fromEntries(["A", "B", "C", "D"].map((t) => [t, units.filter((u) => u.tier === t).length])),
      pairs: units.filter((u) => u.worldsExtras.length).length, endlessCandidates: units.filter((u) => u.endlessTo).length,
      note: "Plan only; no career was simulated" }, null, 2));
    return;
  }
  units = [];
  const jsonl = resolve(dir, `shard-${shard}.jsonl`), donePath = resolve(dir, `done-${shard}.txt`);
  trimPartialLine(jsonl);
  const done = new Set(existsSync(donePath) ? readFileSync(donePath, "utf8").split("\n").filter(Boolean) : []);
  const softlocks: string[] = [];
  let played = 0;
  const t0 = Date.now();
  for (const unit of selected) {
    if (done.has(unit.key)) continue;
    if (played >= limit) break;
    let result: ReturnType<typeof playUnit>;
    try {
      result = playUnit(unit, 600_000);
    } catch (error) {
      const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
      result = { lines: [JSON.stringify({ unit: unit.key, tier: unit.tier, ...unit.cell, cohort: "error", error: message })], softlocks: [`error: ${message.split("\n")[0]}`], budgetSoftlock: false };
    }
    appendFileSync(jsonl, result.lines.join("\n") + "\n");
    // A wall-clock budget stop depends on the machine's load: left undone, it is retried on resume.
    if (!result.budgetSoftlock) appendFileSync(donePath, unit.key + "\n");
    softlocks.push(...result.softlocks.map((s) => `${unit.key}: ${s}`));
    played++;
    const doneCount = done.size + played;
    const progress = { shard, done: doneCount, planned: selected.length, last: unit.key, lines: result.lines.length,
      softlocks: softlocks.length, elapsedMin: Math.round((Date.now() - t0) / 60_000) };
    writeFileSync(resolve(dir, `progress-${shard}.json.tmp`), JSON.stringify(progress));
    renameSync(resolve(dir, `progress-${shard}.json.tmp`), resolve(dir, `progress-${shard}.json`));
    console.log(JSON.stringify(progress));
  }
  if (softlocks.length) writeFileSync(resolve(dir, `softlocks-${shard}.json`), JSON.stringify(softlocks, null, 2));
  expect(softlocks, "softlocks / errors in this shard (all recorded in the JSONL)").toEqual([]);
}

it.skipIf(env.HUMAN_AUDIT !== "1")("plays human careers through real flows (explicit opt-in)", () => {
  const mode = env.HUMAN_MODE ?? "smoke";
  if (!["smoke", "matrix"].includes(mode)) throw Error("HUMAN_MODE must be smoke or matrix");
  const dir = externalDir(env.HUMAN_DIR);
  const shards = integer(env.HUMAN_SHARDS, 1, 1), shard = integer(env.HUMAN_SHARD, 0, 0);
  if (shard >= shards) throw Error("HUMAN_SHARD must be below HUMAN_SHARDS");
  // rc.37 round 2: "matrix" is the cohort plan (coverage + Worlds pairs + the S20 extension), never the flat 30,996.
  if (mode === "matrix" && !env.HUMAN_MANIFEST) return runCohorts(dir, shards, shard);
  const cells = env.HUMAN_MANIFEST ? validateCells(JSON.parse(readFileSync(env.HUMAN_MANIFEST, "utf8"))) : humanSmoke();
  if (mode === "smoke" && cells.length > 3) throw Error("Smoke is limited to at most three careers");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const protocol = "rc37-human-v1";
  const profileHash = createHash("sha256").update(JSON.stringify(profiles)).digest("hex");
  const selected = cells.filter((_, i) => i % shards === shard);
  const manifestHash = createHash("sha256").update(JSON.stringify(cells)).digest("hex");
  const identity = { protocol, revision, simulationHash: simulationHash(), balanceVersion: BALANCE_VERSION, profileHash, manifestHash, mode, shards, shard };
  mkdirSync(dir, { recursive: true });
  if (env.HUMAN_PLAN_ONLY === "1") {
    writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(cells, null, 2));
    writeFileSync(resolve(dir, "plan.json"), JSON.stringify({ identity, total: cells.length, selected: selected.length,
      plannedSeasons: cells.reduce((n, c) => n + c.seasons, 0), note: "Plan only; no career was simulated" }, null, 2));
    return;
  }
  const path = resolve(dir, `shard-${shard}.json`);
  const out: { schema: number; identity: typeof identity; planned: number; profiles: typeof profiles; careers: AuditRow[] } = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8")) : { schema: 2, identity, planned: selected.length, profiles, careers: [] };
  if (out.schema !== 2 || JSON.stringify(out.identity) !== JSON.stringify(identity)) throw Error("Resume metadata differs; use a fresh HUMAN_DIR");
  const completed = new Set(out.careers.filter(r => !r.arc.softlock).map(cellKey));
  // A blocked row is retried rather than silently considered complete.
  out.careers = out.careers.filter(r => !r.arc.softlock);
  for (const cell of selected.filter(c => !completed.has(cellKey(c)))) {
    const telemetry = humanTelemetry(), profile = profiles[cell.profile];
    const experiment = withWorldsExtra(cell.worldsExtra, () => playArcCareer({
      region: cell.region, difficulty: cell.difficulty, rosterKey: cell.roster, policy: profile.base,
      policyOverrides: profile.changes, seed: cell.seed, seasons: cell.seasons, budgetMs: 600_000,
      onDay: telemetry.onDay, onSeason: telemetry.onSeason, onAction: telemetry.onAction, onEvent: telemetry.onEvent,
    }));
    const row = { ...cell, arc: experiment.value, spyApplications: experiment.applications, ...telemetry.result() };
    out.careers.push(row);
    writeFileSync(path + ".tmp", JSON.stringify(out));
    renameSync(path + ".tmp", path);
    console.log(JSON.stringify({ completed: out.careers.length, planned: selected.length, ...cell,
      ended: row.arc.ended, softlock: row.arc.softlock, seasonsPlayed: row.arc.seasons.length }));
    expect(row.arc.softlock, cellKey(cell)).toBeNull();
    expect(row.arc.seasons.length).toBeGreaterThan(0);
  }
}, 86_400_000);
