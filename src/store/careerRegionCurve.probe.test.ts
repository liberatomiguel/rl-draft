/**
 * Mundo vivo M3 (opt-in: REGIONCURVE=1) — the early difficulty curve per region.
 * Plays whole careers with the arc bot and records, per season:
 *  - whether the user reached a regional final (champion / runner-up of a
 *    `regional` event) and won one;
 *  - the user's rating at the regional events against the field's top 4
 *    (AI ratings as the match reads them: intrinsic + difficultyShift);
 *  - money (balance end / low, payroll, debt) and the squad (avg starter overall).
 *
 *   REGIONCURVE=1 RC_REGIONS=EU,SAM RC_DIFFS=normal RC_POLICIES=strong RC_SEEDS=4 RC_SEASONS=9 \
 *     RC_SLICE=i/n RC_OUT=out.json npx vitest run src/store/careerRegionCurve.probe.test.ts
 *   node scripts/region-curve-summary.mjs <dir-of-json>   (the tables)
 *
 * Observers only — the saves are never changed.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_REGION_FIELD } from "@/config/balance";
import type { CareerDifficulty } from "@/engine/career/types";
import { userPlacement } from "@/engine/tournament";
import type { Region } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const ALL: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

export interface RegionCurveSeason {
  season: number;
  regionalFinal: boolean;
  regionalTitle: boolean;
  /** Best placement at a regional this season ("" = none played). */
  bestRegional: string;
  userRating: number;
  /** Avg of the top-4 AI ratings over the season's regional events. */
  top4: number;
  top1: number;
  balanceEnd: number;
  balanceMin: number;
  payroll: number;
  debt: number;
  starterOvr: number;
  starterPot: number;
  starterAge: number;
  rank: number;
  majors: number;
  worlds: string | null;
  rep: number;
  signings: number;
  sales: number;
  income: Record<string, number>;
  spend: Record<string, number>;
}
export interface RegionCurveCareer {
  region: Region;
  difficulty: CareerDifficulty;
  policy: string;
  seed: number;
  ended: string | null;
  seasons: RegionCurveSeason[];
}

const RANK: Record<string, number> = { champion: 0, runner_up: 1, third: 2, fourth: 3, playoffs: 4, swiss_exit: 5 };

it.runIf(env.REGIONCURVE === "1")("M3 region curve probe", { timeout: 24 * 3_600_000 }, () => {
  const regions = list<Region>(env.RC_REGIONS, ALL);
  const diffs = list<CareerDifficulty>(env.RC_DIFFS, ["normal"]);
  const policies = list<ArcPolicyId>(env.RC_POLICIES, ["strong"]);
  const seeds = Number(env.RC_SEEDS ?? 3);
  const seasons = Number(env.RC_SEASONS ?? 9);
  const [si, sn] = (env.RC_SLICE ?? "0/1").split("/").map(Number);
  const cells: { region: Region; difficulty: CareerDifficulty; policy: ArcPolicyId; seed: number }[] = [];
  for (const region of regions)
    for (const difficulty of diffs)
      for (const policy of policies)
        for (let k = 0; k < seeds; k++) cells.push({ region, difficulty, policy, seed: 9100 + 7919 * k });
  // RC_SEED_LIST="EU:9100,NA:17019": only these cells (re-runs a gap in a dump).
  if (env.RC_SEED_LIST) {
    const want = new Set(env.RC_SEED_LIST.split(","));
    cells.splice(0, cells.length, ...cells.filter((c) => want.has(`${c.region}:${c.seed}`)));
  }
  // Experiment only (never committed to balance.ts): RC_SHIFT={"EU":-3} overrides CAREER_REGION_FIELD.shift in this
  // process, RC_STARTER={"EU":2} its starterOvrOffset. One difficulty per process = a per-difficulty table.
  if (env.RC_SHIFT) Object.assign(CAREER_REGION_FIELD.shift as Record<string, number>, JSON.parse(env.RC_SHIFT));
  if (env.RC_STARTER) Object.assign(CAREER_REGION_FIELD.starterOvrOffset as Record<string, number>, JSON.parse(env.RC_STARTER));
  // M3 (R138, flag on): RC_GONE=9 moves earlyShiftFade.goneAt; RC_NO_EARLY=1 zeroes earlyShift (the paired baseline).
  if (env.RC_GONE) Object.assign(CAREER_REGION_FIELD.earlyShiftFade, { goneAt: Number(env.RC_GONE) });
  if (env.RC_EARLY) Object.assign(CAREER_REGION_FIELD.earlyShift, JSON.parse(env.RC_EARLY));
  if (env.RC_NO_EARLY === "1") for (const r of Object.keys(CAREER_REGION_FIELD.earlyShift)) (CAREER_REGION_FIELD.earlyShift as Record<string, number>)[r] = 0;
  // RC_FADE="4,7": the RC_SHIFT doses at full strength through seasonIndex 4, fading linearly to 0 at 7 (set each season start).
  const fullShift: Record<string, number> = env.RC_SHIFT ? JSON.parse(env.RC_SHIFT) : {};
  const [fadeFrom, fadeTo] = (env.RC_FADE ?? "").split(",").map(Number);
  const fadeShift = (season: number) => {
    if (!env.RC_FADE) return;
    const k = season <= fadeFrom ? 1 : season >= fadeTo ? 0 : (fadeTo - season) / (fadeTo - fadeFrom);
    for (const [r, v] of Object.entries(fullShift)) (CAREER_REGION_FIELD.shift as Record<string, number>)[r] = v * k;
  };
  const mine = cells.filter((_, i) => i % sn === si);
  const out: RegionCurveCareer[] = [];
  for (const cell of mine) {
    const ev: Record<number, { best: number; ratings: number[]; top4: number[]; top1: number[] }> = {};
    const res = playArcCareer({
      ...cell,
      seasons,
      budgetMs: 3_600_000,
      policyOverride: env.RC_OVERRIDE ? JSON.parse(env.RC_OVERRIDE) : undefined,
      onSeason(moment, save) {
        if (moment === "start") fadeShift(save.clock.seasonIndex);
      },
      onEvent(save) {
        const a = save.activeEvent;
        if (!a || a.def.tier !== "regional") return;
        const s = save.clock.seasonIndex;
        const e = (ev[s] ??= { best: 9, ratings: [], top4: [], top1: [] });
        e.best = Math.min(e.best, RANK[String(userPlacement(a.tournament))] ?? 9);
        const teams = Object.values(a.tournament.teams);
        const ai = teams.filter((t) => !t.isUser).map((t) => t.rating.total).sort((x, y) => y - x);
        e.ratings.push(teams.find((t) => t.isUser)?.rating.total ?? 0);
        e.top4.push(ai.slice(0, 4).reduce((n, x) => n + x, 0) / 4);
        e.top1.push(ai[0] ?? 0);
      },
    });
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((n, x) => n + x, 0) / xs.length) * 10) / 10 : 0);
    const names = Object.keys(RANK);
    out.push({
      ...cell,
      policy: env.RC_TAG ?? cell.policy,
      ended: res.ended,
      seasons: res.seasons.map((r) => {
        const e = ev[r.seasonIndex];
        const st = [...r.squad].sort((a, b) => b.overall - a.overall).slice(0, 3);
        return {
          season: r.seasonIndex,
          regionalFinal: e ? e.best <= 1 : false,
          regionalTitle: e ? e.best === 0 : false,
          bestRegional: e ? (names[e.best] ?? "") : "",
          userRating: e ? avg(e.ratings) : r.teamRating,
          top4: e ? avg(e.top4) : 0,
          top1: e ? avg(e.top1) : 0,
          balanceEnd: r.balanceEnd,
          balanceMin: r.balanceMin,
          payroll: r.payrollPerSplit,
          debt: r.debtEnd,
          starterOvr: avg(st.map((p) => p.overall)),
          starterPot: avg(st.map((p) => p.potential)),
          starterAge: avg(st.map((p) => p.age)),
          rank: r.regionRank,
          majors: r.majorsQualified,
          worlds: r.worlds,
          rep: r.rep,
          signings: r.signings,
          sales: r.sales,
          income: r.income,
          spend: r.spend,
        };
      }),
    });
    const c = out[out.length - 1];
    // Written after every career, so a long run is readable (and resumable by slice) while it plays.
    if (env.RC_OUT) writeFileSync(env.RC_OUT, JSON.stringify(out));
    console.log(`${cell.region}/${cell.difficulty}/${cell.policy}/${cell.seed} ended=${c.ended} ` +
      c.seasons.map((s) => `S${s.season}:${s.regionalFinal ? (s.regionalTitle ? "T" : "F") : "-"}${s.userRating}/${s.top4}`).join(" "));
  }
  if (env.RC_OUT) writeFileSync(env.RC_OUT, JSON.stringify(out));
});
