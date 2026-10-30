/**
 * Road to Worlds — the season-goal probe (rc.36, ROADMAP UX-02, R87). Opt-in,
 * like careerArc.test.ts: it plays careers through the real flow (the arc
 * bot) and MEASURES how often the board's goals are met — the target and the
 * stretch, by difficulty, region and the career's stage — next to rc.35's
 * rule (a Balanced split goal met in any split, R82 b) on the same seasons,
 * and how well the model's chance at the season's start predicts every
 * candidate goal (calibration).
 *
 *   CAREER_GOALS=1 GOALS_MD=goals.md npx vitest run src/store/careerSeasonGoals.probe.test.ts
 *
 * Knobs: GOALS_REGIONS (default EU,NA,SAM,APAC), GOALS_DIFFS (normal,hard),
 * GOALS_POLICIES (autopilot,tuned,losingStart), GOALS_SEEDS (careers per cell,
 * default 1), GOALS_SEASONS (default 4), GOALS_OUT (the raw rows as JSON),
 * GOALS_SLICE "i/n" (this process plays every n-th cell).
 * Bands it reads against (CAREER_SEASON_GOAL): the target met 40–75 %, the
 * stretch 10–35 %.
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_SEASON_GOAL } from "@/config/balance";
import {
  SEASON_GOAL_CANDIDATES,
  seasonGoalChance,
  seasonGoalMetAtReview,
  seasonGoalPlanFor,
  type FieldDraw,
  type SeasonGoalConfig,
} from "@/engine/career/seasonGoals";
import { seasonGoalMetOf, seasonGoalModelFor, type TeamLevel } from "@/engine/career/sponsorDeals";
import type { CareerDifficulty, CareerSave, SeasonGoalPlan, SeasonGoalSpec } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { ARC_POLICIES, playArcCareer, type ArcPolicyId } from "./careerArcBot";
import { fieldDrawOf, sponsorLevelOf, userSeedRatingFor } from "./careerFlow";

const env = process.env;
const list = <T extends string>(v: string | undefined, all: readonly T[], fallback: readonly T[]): T[] =>
  v ? (v.split(",").filter((x) => (all as readonly string[]).includes(x)) as T[]) : [...fallback];

const ALL_REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

interface GoalRow {
  region: Region;
  difficulty: CareerDifficulty;
  policy: ArcPolicyId;
  seed: number;
  seasonIndex: number;
  stage: string;
  rank: number;
  teams: number;
  plan: SeasonGoalPlan | null;
  targetMet: boolean | null;
  stretchMet: boolean | null;
  /** rc.35's rule on the same season: the Balanced / Bold split goals, met in any split. */
  anySplit: { target: string; targetChance: number; targetMet: boolean; stretch: string; stretchMet: boolean };
  /** Every candidate: the model's chance at the start, and whether the season reached it. */
  candidates: { key: string; chance: number; hit: boolean }[];
  repStart: number;
  repEnd: number;
  /** The level and cup draw at the season's start (the fit's input). */
  level: TeamLevel;
  cup: FieldDraw;
  /** The squad's seed rating at the start and at the review. */
  ratingStart: number;
  ratingEnd: number;
  /** Community Cups this season: entered, finals reached, won. */
  cups: [number, number, number];
}

const keyOf = (g: { kind: string; count: number; place?: number }) => `${g.kind}:${g.count}${g.place ? `@${g.place}` : ""}`;

function playCell(region: Region, difficulty: CareerDifficulty, policy: ArcPolicyId, seed: number, seasons: number): GoalRow[] {
  const rows: GoalRow[] = [];
  let open: {
    start: Pick<GoalRow, "stage" | "rank" | "teams" | "plan" | "repStart" | "level" | "cup" | "ratingStart">;
    chances: number[];
    model: ReturnType<typeof seasonGoalModelFor>;
  } | null = null;
  playArcCareer({
    region,
    difficulty,
    policy,
    seed,
    seasons,
    budgetMs: 600_000,
    onSeason: (moment, save: CareerSave) => {
      if (moment === "start") {
        const level = sponsorLevelOf(save);
        const plan = save.seasonGoals?.plan ?? null;
        open = {
          start: {
            stage: plan?.basis.stage ?? "?",
            rank: level.rank,
            teams: level.teams,
            plan,
            repStart: save.reputation,
            level,
            cup: fieldDrawOf(save),
            ratingStart: save.squad.length ? userSeedRatingFor(save) : 0,
          },
          chances: SEASON_GOAL_CANDIDATES.map((c) => seasonGoalChance(c, level, fieldDrawOf(save))),
          model: seasonGoalModelFor(level, save.clock.seasonIndex),
        };
        return;
      }
      if (!open) return;
      const s = save.clock.seasonIndex;
      const { start, chances, model } = open;
      const t3 = save.eventResults.filter((r) => r.seasonIndex === s && r.tier === "t3" && r.userPlacement);
      rows.push({
        region,
        difficulty,
        policy,
        seed,
        seasonIndex: s,
        ...start,
        targetMet: save.seasonGoals?.targetMet ?? null,
        stretchMet: save.seasonGoals?.stretchMet ?? null,
        anySplit: {
          target: keyOf(model.target),
          targetChance: model.target.chance,
          targetMet: seasonGoalMetOf(model.target, s, save.eventResults),
          stretch: keyOf(model.stretch),
          stretchMet: seasonGoalMetOf(model.stretch, s, save.eventResults),
        },
        candidates: SEASON_GOAL_CANDIDATES.map((c, i) => ({
          key: keyOf(c),
          chance: Math.round(chances[i] * 1000) / 1000,
          hit: seasonGoalMetAtReview({ ...c, chance: chances[i] }, save),
        })),
        repEnd: save.reputation,
        ratingEnd: save.squad.length ? userSeedRatingFor(save) : 0,
        cups: [
          t3.length,
          t3.filter((r) => r.userPlacement === "champion" || r.userPlacement === "runner_up").length,
          t3.filter((r) => r.userPlacement === "champion").length,
        ],
      });
      open = null;
    },
  });
  return rows;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : "—");

function report(rows: GoalRow[]): string {
  const out: string[] = [];
  const B = CAREER_SEASON_GOAL;
  out.push(`# Season goals — probe (rc.36, UX-02)`, ``);
  out.push(
    `Season-rows: ${rows.length}. Bands: target ${B.targetBand.min * 100}–${B.targetBand.max * 100} %, stretch ${B.stretchBand.min * 100}–${B.stretchBand.max * 100} % (the model's chance at the season's start; the rows below are what the seasons did).`,
    ``,
  );
  const group = (label: string, keyFn: (r: GoalRow) => string) => {
    const keys = [...new Set(rows.map(keyFn))].sort();
    out.push(`### By ${label}`, ``);
    out.push(`| ${label} | n | target met | stretch met | target chance (model) | rc.35 any-split target met | rc.35 stretch met | rc.35 target chance (one split) |`);
    out.push(`|---|---|---|---|---|---|---|---|`);
    for (const k of keys) {
      const rs = rows.filter((r) => keyFn(r) === k);
      const planned = rs.filter((r) => r.plan);
      const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "—");
      out.push(
        `| ${k} | ${rs.length} | ${pct(planned.filter((r) => r.targetMet).length, planned.length)} | ${pct(planned.filter((r) => r.stretchMet).length, planned.length)} | ${mean(planned.map((r) => r.plan!.target.chance))} | ${pct(rs.filter((r) => r.anySplit.targetMet).length, rs.length)} | ${pct(rs.filter((r) => r.anySplit.stretchMet).length, rs.length)} | ${mean(rs.map((r) => r.anySplit.targetChance))} |`,
      );
    }
    out.push(``);
  };
  group("all", () => "all");
  group("difficulty", (r) => r.difficulty);
  group("region", (r) => r.region);
  group("stage", (r) => r.stage);
  group("season", (r) => `S${r.seasonIndex}`);
  group("policy", (r) => r.policy);

  // Calibration: every candidate of every season, by the model's chance.
  const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];
  out.push(`### Calibration — every candidate goal of every season, by the model's chance`, ``);
  out.push(`| model chance | n | reached |`, `|---|---|---|`);
  const all = rows.flatMap((r) => r.candidates);
  for (let i = 0; i < buckets.length - 1; i++) {
    const xs = all.filter((c) => c.chance >= buckets[i] && c.chance < buckets[i + 1]);
    out.push(`| ${buckets[i].toFixed(1)}–${Math.min(1, buckets[i + 1]).toFixed(1)} | ${xs.length} | ${pct(xs.filter((c) => c.hit).length, xs.length)} |`);
  }
  out.push(``, `### Calibration by goal family (model chance 0.2–0.8)`, ``, `| family | n | mean model chance | reached |`, `|---|---|---|---|`);
  const fam = (k: string) => k.split(":")[0] + (k.includes("@") ? `@${k.split("@")[1]}` : "");
  for (const f of [...new Set(all.map((c) => fam(c.key)))]) {
    const xs = all.filter((c) => fam(c.key) === f && c.chance >= 0.2 && c.chance <= 0.8);
    if (!xs.length) continue;
    out.push(`| ${f} | ${xs.length} | ${(xs.reduce((a, c) => a + c.chance, 0) / xs.length).toFixed(2)} | ${pct(xs.filter((c) => c.hit).length, xs.length)} |`);
  }
  out.push(``, `### The picks`, ``, `| target | n | met |`, `|---|---|---|`);
  const picks = [...new Set(rows.filter((r) => r.plan).map((r) => keyOf(r.plan!.target)))].sort();
  for (const k of picks) {
    const rs = rows.filter((r) => r.plan && keyOf(r.plan.target) === k);
    out.push(`| ${k} | ${rs.length} | ${pct(rs.filter((r) => r.targetMet).length, rs.length)} |`);
  }
  out.push(``, `### Founding season, weak squads (rank in the region's bottom quarter)`, ``);
  const weak = rows.filter((r) => r.seasonIndex === 0 && r.rank >= r.teams * 0.75);
  out.push(
    `n ${weak.length} · reached a Sunday regional ${pct(weak.filter((r) => r.candidates.find((c) => c.key === "regionalReach:1")?.hit).length, weak.length)} · a cup final ${pct(weak.filter((r) => r.cups[1] > 0).length, weak.length)} · won a cup ${pct(weak.filter((r) => r.cups[2] > 0).length, weak.length)} · cups entered p50 ${weak.map((r) => r.cups[0]).sort((a, b) => a - b)[Math.floor(weak.length / 2)] ?? "—"} · rep gained p50 ${weak.map((r) => Math.round(r.repEnd - r.repStart)).sort((a, b) => a - b)[Math.floor(weak.length / 2)] ?? "—"}`,
    ``,
  );
  return out.join("\n");
}

describe.skipIf(!env.CAREER_GOALS)("season-goal probe (CAREER_GOALS=1)", () => {
  it("measures the goals' hit rates", { timeout: 6 * 60 * 60_000 }, () => {
    const regions = list(env.GOALS_REGIONS, ALL_REGIONS, ["EU", "NA", "SAM", "APAC"]);
    const diffs = list(env.GOALS_DIFFS, ["easy", "normal", "hard"] as const, ["normal", "hard"]);
    const policies = list(env.GOALS_POLICIES, Object.keys(ARC_POLICIES) as ArcPolicyId[], ["autopilot", "tuned", "losingStart"]);
    const seeds = Number(env.GOALS_SEEDS ?? 1);
    const seasons = Number(env.GOALS_SEASONS ?? 4);
    const [si, sn] = (env.GOALS_SLICE ?? "0/1").split("/").map(Number);
    const rows: GoalRow[] = [];
    let cell = 0;
    for (const difficulty of diffs)
      for (const region of regions)
        for (const policy of policies)
          for (let k = 0; k < seeds; k++) {
            if (cell++ % sn !== si) continue;
            rows.push(...playCell(region, difficulty, policy, 9100 + 7919 * k, seasons));
          }
    if (env.GOALS_OUT) writeFileSync(env.GOALS_OUT, JSON.stringify(rows));
    if (env.GOALS_MD) writeFileSync(env.GOALS_MD, report(rows));
    expect(rows.length).toBeGreaterThan(0);
  });
});

/**
 * The model's fit and the picker's replay (GOALS_FIT=1 GOALS_IN=a.json,…).
 * The arc bot never reads the board's goal, so a season's outcomes do not
 * depend on it: any setting of CAREER_SEASON_GOAL can be replayed on the
 * stored seasons. It prints (1) the log-likelihood of what the seasons did by
 * `seasonForm` (the league goals; cups unshifted), (2) the grid fit of
 * `reachCurve`, (3) the per-family calibration at the shipped settings, and
 * (4) the shipped picker's replay: its target and stretch met, by cell.
 */
describe.skipIf(!env.GOALS_FIT)("season-goal probe — fit and replay (GOALS_FIT=1)", () => {
  it("fits", async () => {
    const { readFileSync } = await import("node:fs");
    const all = (env.GOALS_IN ?? "").split(",").filter(Boolean).flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as GoalRow[]);
    // GOALS_REGION / GOALS_DIFF narrow the replay to one cell (e.g. EU).
    const rows = all.filter(
      (r) => (!env.GOALS_REGION || r.region === env.GOALS_REGION) && (!env.GOALS_DIFF || r.difficulty === env.GOALS_DIFF),
    );
    const isCup = (k: string) => k === "cupFinal" || k === "cupWin";
    // Candidates by key (a row stored before a candidate was added simply lacks it).
    const hitMaps = new Map(rows.map((r) => [r, new Map(r.candidates.map((c) => [c.key, c.hit]))]));
    const hitIn = (r: GoalRow, c: Pick<SeasonGoalSpec, "kind" | "count" | "place">) => hitMaps.get(r)!.get(keyOf(c));
    const ll = (p: number, hit: boolean) => {
      const q = Math.min(1 - 1e-4, Math.max(1e-4, p));
      return hit ? Math.log(q) : Math.log(1 - q);
    };
    const cfgWith = (over: Partial<Record<keyof SeasonGoalConfig, unknown>>) =>
      ({ ...CAREER_SEASON_GOAL, ...over }) as unknown as SeasonGoalConfig;
    const out: string[] = ["## (1) seasonForm — league goals' log-likelihood", "", "form | LL | n | model 0.3–0.7 → reached"];
    for (let g = 0; g <= 4; g += 0.5) {
      const cfg = cfgWith({ seasonForm: g });
      let total = 0, n = 0, sm = 0, sr = 0, nb = 0;
      for (const r of rows) {
        SEASON_GOAL_CANDIDATES.forEach((c) => {
          const hit = hitIn(r, c);
          if (isCup(c.kind) || c.kind === "regionalReach" || hit === undefined) return;
          const p = seasonGoalChance(c, r.level, r.cup, cfg);
          total += ll(p, hit);
          n += 1;
          if (p >= 0.3 && p <= 0.7) { sm += p; sr += hit ? 1 : 0; nb += 1; }
        });
      }
      out.push(`${g} | ${total.toFixed(1)} | ${n} | ${nb ? `${(sm / nb).toFixed(2)} → ${(sr / nb).toFixed(2)} (n ${nb})` : "—"}`);
    }
    out.push("", "## (2) reachCurve — Sunday-regional goals' log-likelihood (at the shipped seasonForm)", "", "mid | scale | LL");
    let best = { mid: 0, scale: 0, ll: -Infinity };
    for (let mid = -12; mid <= 8; mid += 0.5) {
      for (let scale = 1; scale <= 6; scale += 0.25) {
        const cfg = cfgWith({ reachCurve: { mid, scale } });
        let total = 0;
        for (const r of rows) {
          SEASON_GOAL_CANDIDATES.forEach((c) => {
            const hit = hitIn(r, c);
            if (c.kind !== "regionalReach" || hit === undefined) return;
            total += ll(seasonGoalChance(c, r.level, r.cup, cfg), hit);
          });
        }
        if (total > best.ll) best = { mid, scale, ll: total };
      }
    }
    out.push(`best: ${best.mid} | ${best.scale} | ${best.ll.toFixed(1)}`);

    out.push("", "## (3) calibration at the shipped settings (bucket: reached / n)", "");
    const edges = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.01];
    const fams = new Map<string, { n: number[]; hit: number[] }>();
    for (const r of rows) {
      SEASON_GOAL_CANDIDATES.forEach((c) => {
        const hit = hitIn(r, c);
        if ((isCup(c.kind) && !r.cup.eligible) || hit === undefined) return;
        const p = seasonGoalChance(c, r.level, r.cup);
        const f = `${c.kind}${c.place ? `@${c.place}` : ""}`;
        const row = fams.get(f) ?? { n: edges.slice(1).map(() => 0), hit: edges.slice(1).map(() => 0) };
        const b = edges.findIndex((e, k) => p >= e && p < edges[k + 1]);
        if (b >= 0 && b < row.n.length) {
          row.n[b] += 1;
          row.hit[b] += hit ? 1 : 0;
        }
        fams.set(f, row);
      });
    }
    for (const [f, row] of fams) {
      out.push(`- ${f}: ` + row.n.map((n, k) => (n ? `${edges[k]}–${edges[k + 1]} ${Math.round((100 * row.hit[k]) / n)}%/${n}` : "")).filter(Boolean).join(" · "));
    }

    // (4) The shipped picker, replayed on every stored season.
    const replay = rows.map((r) => {
      const plan = seasonGoalPlanFor({
        level: r.level,
        cup: r.cup,
        seasonIndex: r.seasonIndex,
        rep: r.repStart,
        hasHistory: r.stage !== "founding",
        lastTargetMet: r.plan?.basis.last === "met" ? true : r.plan?.basis.last === "missed" ? false : null,
        runwayWeeks: r.plan?.basis.money === "tight" ? 4 : r.plan?.basis.money === "flush" ? null : 12,
        loanOwed: false,
      });
      const hitOf = (g: SeasonGoalSpec) => r.candidates.find((c) => c.key === keyOf(g))?.hit ?? false;
      return { r, plan, target: hitOf(plan.target), stretch: hitOf(plan.stretch) };
    });
    const cell = (label: string, keyFn: (r: GoalRow) => string) => {
      out.push("", `## (4) the picker replayed — by ${label}`, "", `| ${label} | n | target met | stretch met | target chance | stretch chance |`, "|---|---|---|---|---|---|");
      for (const k of [...new Set(replay.map((x) => keyFn(x.r)))].sort()) {
        const xs = replay.filter((x) => keyFn(x.r) === k);
        const mean = (f: (x: (typeof xs)[number]) => number) => (xs.reduce((a, x) => a + f(x), 0) / xs.length).toFixed(2);
        out.push(`| ${k} | ${xs.length} | ${pct(xs.filter((x) => x.target).length, xs.length)} | ${pct(xs.filter((x) => x.stretch).length, xs.length)} | ${mean((x) => x.plan.target.chance)} | ${mean((x) => x.plan.stretch.chance)} |`);
      }
    };
    cell("all", () => "all");
    cell("difficulty", (r) => r.difficulty);
    cell("region", (r) => r.region);
    cell("stage", (r) => r.stage);
    cell("policy", (r) => r.policy);
    out.push("", "## (4b) the picks", "", "| target | n | met | stretch | n | met |", "|---|---|---|---|---|---|");
    const tk = [...new Set(replay.map((x) => keyOf(x.plan.target)))].sort();
    const sk = [...new Set(replay.map((x) => keyOf(x.plan.stretch)))].sort();
    for (let i = 0; i < Math.max(tk.length, sk.length); i++) {
      const t = tk[i], s = sk[i];
      const tx = replay.filter((x) => t && keyOf(x.plan.target) === t);
      const sx = replay.filter((x) => s && keyOf(x.plan.stretch) === s);
      out.push(`| ${t ?? ""} | ${tx.length || ""} | ${t ? pct(tx.filter((x) => x.target).length, tx.length) : ""} | ${s ?? ""} | ${sx.length || ""} | ${s ? pct(sx.filter((x) => x.stretch).length, sx.length) : ""} |`);
    }
    const growth = rows.map((r) => r.ratingEnd - r.ratingStart).sort((a, b) => a - b);
    out.push("", `Squad rating growth over a season: p10 ${growth[Math.floor(growth.length * 0.1)]?.toFixed(1)} · p50 ${growth[Math.floor(growth.length / 2)]?.toFixed(1)} · p90 ${growth[Math.floor(growth.length * 0.9)]?.toFixed(1)}`);
    writeFileSync(env.GOALS_MD ?? "goals-fit.md", out.join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  });
});

/** ARC-style merge: GOALS_REPORT=1 GOALS_IN=a.json,b.json GOALS_MD=report.md. */
describe.skipIf(!env.GOALS_REPORT)("season-goal probe — merge slices (GOALS_REPORT=1)", () => {
  it("merges", async () => {
    const { readFileSync } = await import("node:fs");
    const rows = (env.GOALS_IN ?? "").split(",").filter(Boolean).flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as GoalRow[]);
    writeFileSync(env.GOALS_MD ?? "goals.md", report(rows));
    expect(rows.length).toBeGreaterThan(0);
  });
});
