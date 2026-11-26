/**
 * v2.2 board front — opt-in probe (BOARD_PROBE=1). Plays arc-bot careers at
 * real orgs of each stature (the region's first org of each stature) and at a
 * founded club, and reports per policy × difficulty × stature: the Expected
 * objective's measured hit rate against its stated chance, Cautious and
 * Ambitious measured on the same seasons (every offered objective is settled
 * against the season's results), season-1 hits, dismissals and their season,
 * cash at the last season.
 *
 *   BOARD_PROBE=1 BOARD_REGIONS=NA,EU,SAM BOARD_DIFFS=normal,hard BOARD_SEASONS=6 BOARD_SEEDS=1 \
 *   BOARD_POLICIES=competent,careless BOARD_STATURES=elite,contender,mid,underdog,founded \
 *   node ../../../node_modules/vitest/vitest.mjs run src/store/careerBoard.probe.test.ts --disable-console-intercept
 * Staging flags: also set NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1
 * NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 NEXT_PUBLIC_ENDLESS_VARIETY=1.
 * BOARD_SLICE=i/n runs one slice; BOARD_OUT=<file> writes the rows (JSON).
 * Calibration: BOARD_CAL_OUT=<file> writes every season goal's raw model chance and outcome;
 * BOARD_FIT_FROM=<file,file> fits CAREER_BOARD.calibration from those files (no careers played).
 * BOARD_SUMMARY_FROM=<file,file> prints the summary table from BOARD_OUT files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import type { PackageId } from "@/engine/career/boardTypes";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import { seasonGoalProgressOf } from "@/engine/career/seasonGoals";
import type { CareerDifficulty, CareerSave, SeasonGoalSpec } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";
import { boardRawGoalsOf } from "./boardFlow";

const env = process.env;
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

const POLICY: Record<string, { policy: ArcPolicyId; pkg: PackageId }> = {
  competent: { policy: "tuned", pkg: "expected" },
  careless: { policy: "badSponsor", pkg: "ambitious" },
};

interface SeasonRow {
  s: number;
  stature: string;
  pkg: string | null;
  chance: number | null;
  met: boolean | null;
  /** Every offered package's objective settled on the season: [stated, met]. */
  offers: Record<string, [number, boolean]>;
  conf: number;
  ultimatum: boolean;
  dismissed: boolean;
  moved: boolean;
  balance: number;
  rank: number;
}
interface CareerRow {
  region: Region;
  diff: CareerDifficulty;
  policy: string;
  stature: string;
  seed: number;
  softlock: string | null;
  ended: string | null;
  seasons: SeasonRow[];
}
interface CalRow {
  stature: string;
  diff: string;
  first: boolean;
  model: number;
  met: boolean;
}

function input(region: Region, difficulty: CareerDifficulty, realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Probe", abbrev: "PRB", managerName: "Bot", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty,
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function overCtx(save: CareerSave) {
  return {
    seasonIndex: save.clock.seasonIndex,
    today: { seasonIndex: save.clock.seasonIndex, day: save.clock.day },
    results: save.eventResults,
    majorFieldRefs: save.competition.majorFieldRefs,
    worldsFieldRefs: save.competition.worldsFieldRefs,
    over: true,
  };
}

// ---------------------------------------------------------------------------
// Fitting: logit(p) = a + b·logit(model) + c·first, by Newton's method (ridge-damped).
// ---------------------------------------------------------------------------

const lg = (p: number) => Math.log(Math.min(0.99, Math.max(0.01, p)) / (1 - Math.min(0.99, Math.max(0.01, p))));

function fit(rows: CalRow[]): { a: number; b: number; first: number } {
  let w = [0, 1, 0];
  for (let it = 0; it < 30; it++) {
    const g = [0, 0, 0];
    const H = [[1e-3, 0, 0], [0, 1e-3, 0], [0, 0, 1e-3]];
    for (const r of rows) {
      const x = [1, lg(r.model), r.first ? 1 : 0];
      const z = w[0] * x[0] + w[1] * x[1] + w[2] * x[2];
      const p = 1 / (1 + Math.exp(-z));
      const y = r.met ? 1 : 0;
      for (let i = 0; i < 3; i++) {
        g[i] += (y - p) * x[i];
        for (let j = 0; j < 3; j++) H[i][j] += p * (1 - p) * x[i] * x[j];
      }
    }
    // Solve H d = g (3×3, Cramer's rule).
    const det = (m: number[][]) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(H);
    if (Math.abs(D) < 1e-12) break;
    const d = [0, 1, 2].map((k) => det(H.map((row, i) => row.map((v, j) => (j === k ? g[i] : v)))) / D);
    // Backtracking: halve the step until the log-likelihood improves (plain Newton oscillates here).
    const ll = (v: number[]) => rows.reduce((n, r) => {
      const z = v[0] + v[1] * lg(r.model) + v[2] * (r.first ? 1 : 0);
      return n + (r.met ? -Math.log1p(Math.exp(-z)) : -Math.log1p(Math.exp(z)));
    }, 0);
    const base = ll(w);
    let step = 1;
    let cand = w.map((v, i) => v + d[i]);
    while (ll(cand) < base && step > 1e-4) {
      step /= 2;
      cand = w.map((v, i) => v + step * d[i]);
    }
    w = cand;
    if (Math.max(...d.map(Math.abs)) < 1e-6) break;
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { a: r2(w[0]), b: r2(Math.max(0.2, w[1])), first: r2(w[2]) };
}

it.skipIf(!env.BOARD_PROBE)("board probe", () => {
  if (env.BOARD_FIT_FROM) {
    const rows: CalRow[] = env.BOARD_FIT_FROM.split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as CalRow[]);
    const out: Record<string, Record<string, { a: number; b: number; first: number }>> = {};
    for (const st of [...new Set(rows.map((r) => r.stature))])
      for (const df of [...new Set(rows.map((r) => r.diff))]) {
        const xs = rows.filter((r) => r.stature === st && r.diff === df);
        if (xs.length < 40) continue;
        const f = fit(xs);
        (out[st] ??= {})[df] = f;
        const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.01];
        const line = bins.slice(0, -1).map((lo, i) => {
          const b = xs.filter((x) => x.model >= lo && x.model < bins[i + 1]);
          return b.length ? `${Math.round(lo * 100)}-${Math.round(bins[i + 1] * 100)}%: ${Math.round((100 * b.filter((x) => x.met).length) / b.length)}% (n${b.length})` : "";
        });
        console.log(`${st}/${df} n=${xs.length} fit ${JSON.stringify(f)} | real by model band: ${line.filter(Boolean).join(", ")}`);
      }
    console.log("CALIBRATION " + JSON.stringify(out));
    return;
  }
  if (env.BOARD_SUMMARY_FROM) {
    summary(env.BOARD_SUMMARY_FROM.split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as CareerRow[]));
    return;
  }
  const regions = list<Region>(env.BOARD_REGIONS, ["NA", "EU", "SAM"]);
  const diffs = list<CareerDifficulty>(env.BOARD_DIFFS, ["normal", "hard"]);
  const policies = list(env.BOARD_POLICIES, ["competent", "careless"]);
  const statures = list(env.BOARD_STATURES, ["elite", "contender", "mid", "underdog", "founded"]);
  const seasons = Number(env.BOARD_SEASONS ?? 6);
  const seeds = Number(env.BOARD_SEEDS ?? 1);
  const seed0 = Number(env.BOARD_SEED0 ?? 9000);
  const [si, sn] = (env.BOARD_SLICE ?? "0/1").split("/").map(Number);
  const jobs: { region: Region; diff: CareerDifficulty; policy: string; seed: number; ref: string | null; stature: string }[] = [];
  for (const region of regions)
    for (const diff of diffs)
      for (let k = 0; k < seeds; k++) {
        const seed = seed0 + k * 101;
        const world = computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: diff });
        const choices = realOrgChoicesFor(region, { careerSeed: seed, seasonIndex: 0, difficulty: diff, world });
        for (const policy of policies)
          for (const st of statures) {
            if (st === "founded") jobs.push({ region, diff, policy, seed, ref: null, stature: st });
            else {
              const c = choices.find((x) => x.stature === st);
              if (c) jobs.push({ region, diff, policy, seed, ref: c.ref, stature: st });
            }
          }
      }
  const mine = jobs.filter((_, i) => i % sn === si);
  const rows: CareerRow[] = [];
  const cal: CalRow[] = [];
  for (const job of mine) {
    const P = POLICY[job.policy];
    const seasonRows: SeasonRow[] = [];
    let pool: { s: number; goals: SeasonGoalSpec[]; first: boolean; stature: string } | null = null;
    let lastOrg = "";
    const onDay = (save: CareerSave) => {
      const b = save.board;
      if (!b?.season || b.season.seasonIndex !== save.clock.seasonIndex || pool?.s === save.clock.seasonIndex) return;
      pool = { s: save.clock.seasonIndex, goals: boardRawGoalsOf(save), first: save.clock.seasonIndex === b.startSeason, stature: String(b.stature) };
    };
    const onSeason = (moment: "start" | "end", save: CareerSave) => {
      if (moment !== "end" || !save.board) return;
      const b = save.board;
      const se = b.season;
      const ctx = overCtx(save);
      if (pool && pool.s === save.clock.seasonIndex) {
        const st = job.stature === "founded" && pool.stature === "owners" ? "owners" : pool.stature;
        for (const g of pool.goals) cal.push({ stature: st, diff: job.diff, first: pool.first, model: g.chance, met: seasonGoalProgressOf(g, ctx).hit });
      }
      const offers: Record<string, [number, boolean]> = {};
      if (se?.seasonIndex === save.clock.seasonIndex) for (const o of se.offers) offers[o.id] = [o.objective.chance, seasonGoalProgressOf(o.objective, ctx).hit];
      const pkg = se?.choice ? se.offers.find((o) => o.id === se.choice) : null;
      const h = save.history[save.history.length - 1];
      const moved = lastOrg !== "" && lastOrg !== save.identity.orgName;
      lastOrg = save.identity.orgName;
      seasonRows.push({
        s: save.clock.seasonIndex,
        stature: String(b.stature),
        pkg: se?.choice ?? null,
        chance: pkg?.objective.chance ?? null,
        met: se?.seasonIndex === save.clock.seasonIndex ? se.met : null,
        offers,
        conf: b.confidence,
        ultimatum: b.ultimatum?.issuedSeason === save.clock.seasonIndex,
        dismissed: b.dismissedSeason === save.clock.seasonIndex,
        moved,
        balance: save.finances.balance,
        rank: h?.userRegionRank ?? 0,
      });
    };
    const start = createCareerSave(input(job.region, job.diff, job.ref ?? undefined), job.seed);
    const out = playArcCareer({ region: job.region, difficulty: job.diff, policy: P.policy, seed: job.seed, seasons, startFrom: start, boardPackage: P.pkg, onSeason, onDay, budgetMs: 900_000 });
    rows.push({ region: job.region, diff: job.diff, policy: job.policy, stature: job.stature, seed: job.seed, softlock: out.softlock, ended: out.ended, seasons: seasonRows });
    const tag = `${job.region}/${job.diff}/${job.policy}/${job.stature}`;
    console.log(
      `${tag.padEnd(34)} ${out.softlock ? "SOFTLOCK " + out.softlock : (out.ended ?? "ok")} | ` +
        seasonRows.map((r) => `S${r.s + 1}:${r.pkg?.[0] ?? "-"}${Math.round((r.chance ?? 0) * 100)}${r.met ? "+" : "-"}${r.conf}${r.ultimatum ? "U" : ""}${r.dismissed ? "D" : ""}${r.moved ? "M" : ""} $${Math.round(r.balance / 1000)}k#${r.rank}`).join(" "),
    );
    if (env.BOARD_OUT) writeFileSync(env.BOARD_OUT, JSON.stringify(rows));
    if (env.BOARD_CAL_OUT) writeFileSync(env.BOARD_CAL_OUT, JSON.stringify(cal));
  }
  summary(rows);
});

function summary(rows: CareerRow[]): void {
  const pc = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");
  for (const pol of [...new Set(rows.map((r) => r.policy))])
    for (const diff of [...new Set(rows.map((r) => r.diff))]) {
      console.log(`\n[${pol} ${diff}] stature | Expected stated→measured (N) | Cautious / Ambitious measured | S1 hit | dismissed (seasons) | cash last season (median) | softlocks`);
      for (const st of ["elite", "contender", "mid", "underdog", "founded"]) {
        const cs = rows.filter((r) => r.policy === pol && r.diff === diff && r.stature === st);
        if (!cs.length) continue;
        // Seasons at the career's starting club only (a move changes the stature).
        const ss = cs.flatMap((c) => {
          const out: SeasonRow[] = [];
          for (const s of c.seasons) {
            if (s.moved) break;
            out.push(s);
          }
          return out;
        });
        const ex = ss.filter((s) => s.offers.expected);
        const exStated = ex.reduce((n, s) => n + s.offers.expected[0], 0);
        const exMet = ex.filter((s) => s.offers.expected[1]).length;
        const ca = ss.filter((s) => s.offers.cautious);
        const am = ss.filter((s) => s.offers.ambitious);
        const s1 = cs.map((c) => c.seasons[0]).filter((s) => s && s.met !== null);
        const dism = cs.filter((c) => c.seasons.some((s) => s.dismissed));
        const firstD = dism.map((c) => c.seasons.find((s) => s.dismissed)!.s + 1);
        const cash = cs.map((c) => c.seasons[c.seasons.length - 1]?.balance ?? 0).sort((a, b) => a - b);
        console.log(
          `  ${st.padEnd(9)} | ${pc(exStated, ex.length)} → ${pc(exMet, ex.length)} (N=${ex.length})` +
            ` | ${pc(ca.filter((s) => s.offers.cautious[1]).length, ca.length)} / ${pc(am.filter((s) => s.offers.ambitious[1]).length, am.length)}` +
            ` | ${pc(s1.filter((s) => s.met).length, s1.length)} (N=${s1.length})` +
            ` | ${dism.length}/${cs.length} (${firstD.join(",") || "-"})` +
            ` | $${Math.round((cash[Math.floor(cash.length / 2)] ?? 0) / 1000)}k | ${cs.filter((c) => c.softlock).length}`,
        );
      }
    }
}
