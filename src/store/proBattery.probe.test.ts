/**
 * v2.2 Pro slice 7 (PROSPINE round 3) — the calibration battery on the REAL
 * flow (opt-in: PRO_BATTERY=1). Whole careers through proFlow with the bot:
 * talent low / average / high (fixed on the save) × managed (the coach's
 * plan) / careless (content, ranked, content every week, no rest) × region ×
 * difficulty. Run it with every staging flag on. Prints one line per career
 * and a table per profile (median and range), and writes the rows as JSON
 * when PRO_BATTERY_OUT is set.
 *
 *   NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 \
 *   NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 NEXT_PUBLIC_PRO_CAREER=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 NEXT_PUBLIC_BOARD=1 NEXT_PUBLIC_REAL_ORG_START=1 \
 *   PRO_BATTERY=1 PRO_BATTERY_CELLS=avg-managed-NA-normal PRO_BATTERY_SEEDS=3 npx vitest run src/store/proBattery.probe.test.ts
 *
 * Cells: `<talent>-<plan>-<region>-<difficulty>`; "all" = the spec grid.
 */
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { ageOf } from "@/engine/career/development";
import type { ProGrowthEntry, ProSave } from "@/engine/career/pro/types";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playProBot } from "./proBot";
import { hostOf } from "./proFlow";

const env = process.env;
const ON = env.PRO_BATTERY === "1";
const TALENT: Record<string, number> = { low: 0.82, avg: 1.0, high: 1.2 }; // the lifecycle bot's profiles (talentRange 0.78-1.25)
const GRID = [
  ...["low", "avg", "high"].flatMap((t) => ["managed", "careless"].flatMap((p) => ["NA", "EU", "SAM"].map((r) => `${t}-${p}-${r}-normal`))),
  "avg-managed-NA-hard",
  "avg-managed-EU-hard",
  "avg-managed-SAM-hard",
];
const CELLS = (env.PRO_BATTERY_CELLS ?? "all") === "all" ? GRID : (env.PRO_BATTERY_CELLS ?? "").split(",");
const SEEDS = Number(env.PRO_BATTERY_SEEDS ?? 2);
const STOP_AGE = Number(env.PRO_BATTERY_STOP_AGE ?? 29);

export interface BatteryRow {
  cell: string;
  seed: number;
  peak: number;
  peakAge: number;
  /** The most any season after the peak season added (noise if small). */
  growthAfterPeak: number;
  firstOrgAge: number | null;
  worldsPlayed: number;
  worldsTitles: number;
  majorTitles: number;
  titles: number;
  starterSeasons: number;
  rotationToStarter: boolean;
  /** Attribute points by source over the career (the "why" of the peak). */
  xp: Record<string, number>;
  seriesPerSeason: number;
  /** Endless (ENDLESS_VARIETY): seasons his side was the reigning champion the world answered, and seasons it was answered by projects. */
  /** Week of the career (season 0 = weeks 1-32) of the first amateur invite, and his side's first-season cup series won / played. */
  firstInviteWeek: number | null;
  /** The career's title lines (event name and year). */
  titleNames: string[];
  firstSideCups: string;
  reigningSeasons: number;
  projectSeasons: number;
  /** Per-season trace (age, overall end, series, role) for the diagnosis. */
  trace: string;
  seconds: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

function runCell(cell: string, seed: number): BatteryRow {
  const [t, plan, region, difficulty] = cell.split("-") as [string, "managed" | "careless", Region, CareerDifficulty];
  const t0 = Date.now();
  const seen = new WeakSet<ProGrowthEntry>();
  const xp: Record<string, number> = {};
  const worldsIds = new Set<string>();
  const champs = new Set<string>();
  let worldsTitles = 0;
  let majorTitles = 0;
  let wasRotation = false;
  let rotationToStarter = false;
  const seasonsSeen = new Set<number>();
  let reigningSeasons = 0;
  let firstInviteWeek: number | null = null;
  const seenLog = new WeakSet<object>();
  let sideSeason: number | null = null;
  let cupsWon = 0;
  let cupsPlayed = 0;
  let projectSeasons = 0;
  const run = playProBot({
    region,
    difficulty,
    seed,
    seasons: 30,
    counter: true,
    talent: TALENT[t],
    plan,
    stopAge: STOP_AGE,
    onDay: (s: ProSave) => {
      for (const g of s.growthLog) {
        if (seen.has(g)) continue;
        seen.add(g);
        xp[g.source] = Math.round(((xp[g.source] ?? 0) + g.delta) * 100) / 100;
      }
      const ev = hostOf(s)?.activeEvent;
      if (ev?.def.tier === "worlds" && ev.fieldedIds?.includes("pro:self")) worldsIds.add(ev.def.id);
      const r = s.report;
      if (r && r.placement === "champion" && !champs.has(r.id) && !r.benched) {
        champs.add(r.id);
        if (r.tier === "worlds") worldsTitles += 1;
        if (r.tier === "major") majorTitles += 1;
      }
      if (!seasonsSeen.has(s.clock.seasonIndex)) {
        seasonsSeen.add(s.clock.seasonIndex);
        const e = hostOf(s)?.endless;
        const mine = (ref: string | null | undefined) => ref === "user" || (!!ref && ref === s.contract?.orgRef);
        if (e?.streak && e.streak.titles >= 1 && mine(e.streak.ref)) {
          reigningSeasons += 1;
          if ((e.strength ?? 0) > 0 && e.projects.length > 0) projectSeasons += 1;
        }
      }
      if (firstInviteWeek === null && s.offers.some((o) => o.kind === "amateur")) {
        const o = s.offers.find((x) => x.kind === "amateur")!;
        firstInviteWeek = o.madeSeason * 32 + Math.ceil(o.madeDay / 7);
      }
      if (s.stage === "amateur" && sideSeason === null) sideSeason = s.clock.seasonIndex;
      for (const e of s.matchLog ?? []) {
        if (seenLog.has(e)) continue;
        seenLog.add(e);
        if (sideSeason !== null && e.seasonIndex === sideSeason && (e.tier === "t3" || e.tier === "t2")) {
          cupsPlayed += 1;
          if (e.won) cupsWon += 1;
        }
      }
      if (s.contract?.role === "rotation") wasRotation = true;
      if (wasRotation && s.contract?.role === "starter") rotationToStarter = true;
    },
  });
  const h = run.save.history;
  let peak = 0;
  let peakAge = 0;
  let peakIdx = 0;
  h.forEach((line, i) => {
    if (line.overallEnd > peak) {
      peak = line.overallEnd;
      peakAge = line.age;
      peakIdx = i;
    }
  });
  const growthAfterPeak = Math.max(0, ...h.slice(peakIdx + 1).map((l) => l.overallEnd - l.overallStart));
  const played = h.filter((l) => l.series > 0);
  return {
    cell,
    seed,
    peak: Math.round(peak * 10) / 10,
    peakAge,
    growthAfterPeak: Math.round(growthAfterPeak * 100) / 100,
    firstOrgAge: run.firstOrgAge,
    worldsPlayed: worldsIds.size,
    worldsTitles,
    majorTitles,
    titles: (run.save.careerTitles ?? []).length,
    starterSeasons: h.filter((l) => l.role === "starter").length,
    rotationToStarter,
    xp,
    seriesPerSeason: played.length ? Math.round(played.reduce((a, l) => a + l.series, 0) / played.length) : 0,
    firstInviteWeek,
    titleNames: run.save.careerTitles ?? [],
    firstSideCups: `${cupsWon}/${cupsPlayed}`,
    reigningSeasons,
    projectSeasons,
    trace: h.map((l) => `${l.age}:${l.overallEnd.toFixed(0)}/${l.series}s/${(l.role ?? "-").slice(0, 3)}/${(l.results ?? []).length}t`).join(" "),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

describe.skipIf(!ON)("PROSPINE Pro calibration battery (real flow)", () => {
  it("runs the cells and prints the table", () => {
    const rows: BatteryRow[] = [];
    for (const cell of CELLS)
      for (let k = 0; k < SEEDS; k++) {
        const seed = 70_000 + k * 7919 + cell.length;
        const row = runCell(cell, seed);
        rows.push(row);
        console.log(`ROW ${JSON.stringify(row)}`);
        if (env.PRO_BATTERY_OUT) writeFileSync(env.PRO_BATTERY_OUT, JSON.stringify(rows, null, 1));
      }
    const profiles = [...new Set(rows.map((r) => r.cell.split("-").slice(0, 2).join("-") + (r.cell.endsWith("hard") ? "-hard" : "")))];
    for (const p of profiles) {
      const rs = rows.filter((r) => (r.cell.split("-").slice(0, 2).join("-") + (r.cell.endsWith("hard") ? "-hard" : "")) === p);
      const f = (k: keyof BatteryRow) => {
        const xs = rs.map((r) => Number(r[k])).filter((x) => Number.isFinite(x));
        return `${median(xs)} [${Math.min(...xs)}-${Math.max(...xs)}]`;
      };
      const share = (pred: (r: BatteryRow) => boolean) => `${Math.round((rs.filter(pred).length / rs.length) * 100)}%`;
      console.log(
        `TABLE ${p} N=${rs.length}: peak ${f("peak")} | peakAge ${f("peakAge")} | afterPeak ${f("growthAfterPeak")} | firstOrg ${f("firstOrgAge")} | Worlds played ${share((r) => r.worldsPlayed > 0)} | Worlds won ${share((r) => r.worldsTitles > 0)} | Majors+Worlds ${f("majorTitles")}/${f("worldsTitles")} | titles ${f("titles")} | starter seasons ${f("starterSeasons")} | rotation->starter ${share((r) => r.rotationToStarter)} | series/season ${f("seriesPerSeason")}`,
      );
    }
    void ageOf;
  }, 36_000_000);
});
