/** Local, opt-in human audit. Default test suite never plays this matrix. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { expect, it } from "vitest";
import { BALANCE_VERSION } from "@/config/balance";
import { playArcCareer } from "./auditHumanBot";
import { profiles } from "./auditHumanProfiles";
import { cellKey, humanMatrix, humanSmoke, validateCells, type HumanCell } from "./auditHumanMatrix";
import { humanTelemetry } from "./auditHumanTelemetry";
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
it.skipIf(env.HUMAN_AUDIT !== "1")("plays human careers through real flows (explicit opt-in)", () => {
  const mode = env.HUMAN_MODE ?? "smoke";
  if (!["smoke", "matrix"].includes(mode)) throw Error("HUMAN_MODE must be smoke or matrix");
  const cells = env.HUMAN_MANIFEST ? validateCells(JSON.parse(readFileSync(env.HUMAN_MANIFEST, "utf8")))
    : mode === "matrix" ? humanMatrix() : humanSmoke();
  if (mode === "smoke" && cells.length > 3) throw Error("Smoke is limited to at most three careers");
  const dir = externalDir(env.HUMAN_DIR);
  const shards = integer(env.HUMAN_SHARDS, 1, 1), shard = integer(env.HUMAN_SHARD, 0, 0);
  if (shard >= shards) throw Error("HUMAN_SHARD must be below HUMAN_SHARDS");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const protocol = "rc37-human-v1";
  const profileHash = createHash("sha256").update(JSON.stringify(profiles)).digest("hex");
  const selected = cells.filter((_, i) => i % shards === shard);
  const manifestHash = createHash("sha256").update(JSON.stringify(cells)).digest("hex");
  const toolHash = createHash("sha256");
  for (const file of readdirSync(resolve(process.cwd(), "src/store")).filter(f => f.startsWith("auditHuman") && /\.(ts|mjs)$/.test(f)).sort()) {
    toolHash.update(file).update(readFileSync(resolve(process.cwd(), "src/store", file)));
  }
  const identity = { protocol, revision, toolHash: toolHash.digest("hex"), balanceVersion: BALANCE_VERSION, profileHash, manifestHash, mode, shards, shard };
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
