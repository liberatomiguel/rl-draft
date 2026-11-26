/**
 * v2.2 board front — opt-in probe (BOARD_PROBE=1). Plays arc-bot careers at
 * real orgs of each stature (the region's first org of each stature) and a
 * founded-club baseline, and reports the objective hit rate per package
 * (season 1 apart), confidence, ultimatums, dismissals and cash.
 *
 *   BOARD_PROBE=1 BOARD_REGIONS=NA,EU,SAM BOARD_DIFFS=normal,hard BOARD_SEASONS=6 BOARD_SEEDS=1 \
 *   BOARD_POLICIES=competent,careless node ../../../node_modules/vitest/vitest.mjs run src/store/careerBoard.probe.test.ts --disable-console-intercept
 * BOARD_SLICE=i/n runs one slice; BOARD_OUT=<file> writes the rows as JSON.
 */
import { writeFileSync } from "node:fs";
import { it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { FEATURES } from "@/config/balance";
import type { PackageId } from "@/engine/career/boardTypes";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

const POLICY: Record<string, { policy: ArcPolicyId; pkg: PackageId }> = {
  competent: { policy: "tuned", pkg: "expected" },
  cautious: { policy: "tuned", pkg: "cautious" },
  ambitious: { policy: "tuned", pkg: "ambitious" },
  careless: { policy: "badSponsor", pkg: "ambitious" },
};

interface SeasonRow {
  s: number;
  org: string;
  stature: string;
  pkg: string | null;
  kind: string | null;
  chance: number | null;
  met: boolean | null;
  conf: number;
  ultimatum: boolean;
  dismissed: boolean;
  balance: number;
  rank: number;
}

function input(region: Region, difficulty: CareerDifficulty, realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Probe", abbrev: "PRB", managerName: "Bot", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty,
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

it.skipIf(!env.BOARD_PROBE)("board probe", () => {
  const regions = list<Region>(env.BOARD_REGIONS, ["NA", "EU", "SAM"]);
  const diffs = list<CareerDifficulty>(env.BOARD_DIFFS, ["normal", "hard"]);
  const policies = list(env.BOARD_POLICIES, ["competent", "careless"]);
  const seasons = Number(env.BOARD_SEASONS ?? 6);
  const seeds = Number(env.BOARD_SEEDS ?? 1);
  const [si, sn] = (env.BOARD_SLICE ?? "0/1").split("/").map(Number);
  const jobs: { region: Region; diff: CareerDifficulty; policy: string; seed: number; ref: string | null; stature: string }[] = [];
  for (const region of regions)
    for (const diff of diffs)
      for (let k = 0; k < seeds; k++) {
        const seed = 9000 + k * 101;
        const world = computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: diff });
        const choices = realOrgChoicesFor(region, { careerSeed: seed, seasonIndex: 0, difficulty: diff, world });
        const picks = list(env.BOARD_STATURES, ["elite", "contender", "mid", "underdog"]).map((st) => choices.find((c) => c.stature === st)).filter(Boolean);
        for (const policy of policies) {
          for (const c of picks) jobs.push({ region, diff, policy, seed, ref: c!.ref, stature: c!.stature });
          if (env.BOARD_FOUNDED !== "0") jobs.push({ region, diff, policy, seed, ref: null, stature: "founded" });
        }
      }
  const mine = jobs.filter((_, i) => i % sn === si);
  const rows: { job: (typeof jobs)[number]; softlock: string | null; ended: string | null; seasons: SeasonRow[]; baselineBalance?: number[] }[] = [];
  for (const job of mine) {
    const P = POLICY[job.policy];
    const seasonRows: SeasonRow[] = [];
    let last: CareerSave | null = null;
    const onSeason = (moment: "start" | "end", save: CareerSave) => {
      last = save;
      if (moment !== "end" || !save.board) return;
      const b = save.board;
      const se = b.season;
      const pkg = se?.choice ? se.offers.find((o) => o.id === se.choice) : null;
      const h = save.history[save.history.length - 1];
      seasonRows.push({
        s: save.clock.seasonIndex,
        org: save.identity.orgName,
        stature: String(b.stature),
        pkg: se?.choice ?? null,
        kind: pkg ? `${pkg.objective.kind}:${pkg.objective.count}:${pkg.objective.place ?? ""}` : null,
        chance: pkg?.objective.chance ?? null,
        met: se?.met ?? null,
        conf: b.confidence,
        ultimatum: b.ultimatum?.issuedSeason === save.clock.seasonIndex,
        dismissed: b.dismissedSeason === save.clock.seasonIndex,
        balance: save.finances.balance,
        rank: h?.userRegionRank ?? 0,
      });
    };
    const start = createCareerSave(input(job.region, job.diff, job.ref ?? undefined), job.seed);
    const out = playArcCareer({ region: job.region, difficulty: job.diff, policy: P.policy, seed: job.seed, seasons, startFrom: start, boardPackage: P.pkg, onSeason, budgetMs: 600_000 });
    const row: (typeof rows)[number] = { job, softlock: out.softlock, ended: out.ended, seasons: seasonRows };
    if (job.ref === null) {
      // The founded club without the board: the cash baseline.
      (FEATURES as { board: boolean }).board = false;
      const base = playArcCareer({ region: job.region, difficulty: job.diff, policy: P.policy, seed: job.seed, seasons, budgetMs: 600_000 });
      (FEATURES as { board: boolean }).board = true;
      row.baselineBalance = base.seasons.map((x) => x.balanceEnd);
    }
    rows.push(row);
    void last;
    const tag = `${job.region}/${job.diff}/${job.policy}/${job.stature}`;
    console.log(
      `${tag.padEnd(34)} ${out.softlock ? "SOFTLOCK " + out.softlock : (out.ended ?? "ok")} | ` +
        seasonRows.map((r) => `S${r.s + 1}:${r.pkg?.[0] ?? "-"}${r.met ? "+" : "-"}${r.conf}${r.ultimatum ? "U" : ""}${r.dismissed ? "D" : ""} $${Math.round(r.balance / 1000)}k#${r.rank}`).join(" ") +
        (row.baselineBalance ? ` | base $${row.baselineBalance.map((b) => Math.round(b / 1000)).join("/")}k` : ""),
    );
  }
  if (env.BOARD_OUT) writeFileSync(env.BOARD_OUT, JSON.stringify(rows));
  // Summary.
  const all = rows.flatMap((r) => r.seasons.map((s) => ({ ...s, policy: r.job.policy, diff: r.job.diff, start: r.job.stature })));
  const rate = (xs: typeof all) => (xs.length ? `${Math.round((100 * xs.filter((x) => x.met).length) / xs.length)}% (N=${xs.length}, stated ${Math.round((100 * xs.reduce((n, x) => n + (x.chance ?? 0), 0)) / xs.length)}%)` : "-");
  for (const pol of policies)
    for (const diff of diffs) {
      const xs = all.filter((x) => x.policy === pol && x.diff === diff);
      const careers = rows.filter((r) => r.job.policy === pol && r.job.diff === diff);
      const dism = careers.filter((r) => r.seasons.some((s) => s.dismissed));
      const firstDism = dism.map((r) => r.seasons.find((s) => s.dismissed)!.s + 1);
      console.log(
        `\n[${pol} ${diff}] objective hit: S1 ${rate(xs.filter((x) => x.s === 0))} | S2+ ${rate(xs.filter((x) => x.s > 0))}` +
          ` | dismissed ${dism.length}/${careers.length} (seasons ${firstDism.join(",") || "-"})` +
          ` | ultimatums ${xs.filter((x) => x.ultimatum).length} | softlocks ${careers.filter((r) => r.softlock).length} | insolvent ${careers.filter((r) => r.ended === "insolvency").length}`,
      );
      for (const st of ["elite", "contender", "mid", "underdog", "founded"]) {
        const ys = xs.filter((x) => x.start === st);
        if (!ys.length) continue;
        const conf = [0, 1, 2, 3, 4, 5].map((s) => {
          const z = ys.filter((y) => y.s === s);
          return z.length ? Math.round(z.reduce((n, y) => n + y.conf, 0) / z.length) : "-";
        });
        console.log(`  ${st.padEnd(9)} hit ${rate(ys)} conf by season ${conf.join("/")}`);
      }
    }
});
