/**
 * Mundo vivo M1 (opt-in: WORLDLIFE=1) — do the AI orgs renew their rosters,
 * and who takes the Worlds seats in the infinite seasons? Plays whole careers
 * with the arc bot and, at every season's end, reads the world as it stands:
 *
 *  - per region, the top 4 orgs by stored rating: their starters' average age
 *    and overall, and how many of the 4 are real (dataset) orgs;
 *  - the region's best young players (age ≤ 21, top 6 by potential): where
 *    they are (top-4 org, other org, filler org, free agent, user squad);
 *  - the region's median org rating and the local scene's anchor;
 *  - the season's Worlds (and Majors) field: real orgs, fillers, Local sides, user.
 *
 *   WORLDLIFE=1 WORLDLIFE_REGIONS=NA,EU,SAM WORLDLIFE_SEEDS=2 WORLDLIFE_SEASONS=13 npx vitest run src/store/careerWorldLife.probe.test.ts
 *
 * Observers only — the saves are never changed. Prints the summary tables.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_SEASONS } from "@/config/balance";
import { playerViewById } from "@/engine/career/development";
import { isLocalRef } from "@/engine/career/localScene";
import type { CareerSave, CareerDifficulty } from "@/engine/career/types";
import { localAnchorFor, regionMedianRating } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const ALL: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

type Kind = "real" | "filler" | "local" | "user";
const kindOf = (ref: string): Kind =>
  ref === "user" ? "user" : isLocalRef(ref) ? "local" : ref.startsWith("fill:") ? "filler" : "real";

interface RegionRow {
  season: number;
  region: Region;
  userRegion: boolean;
  top4Age: number;
  top4Ovr: number;
  top4Real: number;
  orgs: number;
  realOrgs: number;
  median: number;
  localAnchor: number;
  young: Record<"top4" | "otherReal" | "filler" | "fa" | "user", number>;
  youngAvgPot: number;
  youngAvgOvr: number;
  faBestOvr: number;
}
interface FieldRow { season: number; tier: string; region: Region | null; kinds: Record<Kind, number> }

function snapshot(save: CareerSave, rows: RegionRow[]): void {
  const season = save.clock.seasonIndex;
  const ctx = { careerSeed: save.careerSeed, seasonIndex: season, world: save.world };
  const userIds = new Set(save.squad.map((p) => p.id));
  for (const region of ALL) {
    const orgs = Object.values(save.world.orgs).filter((o) => o.region === region);
    const rated = orgs.map((o) => ({ o, r: o.rating ?? 70 + o.prestige * 6 })).sort((a, b) => b.r - a.r);
    const top4 = rated.slice(0, 4).map((x) => x.o);
    const top4Ref = new Set(top4.map((o) => o.ref));
    const starters = top4.flatMap((o) => o.playerIds.map((id) => playerViewById(id, ctx))).filter((v) => v !== null);
    const where = new Map<string, "top4" | "otherReal" | "filler">();
    for (const o of orgs) for (const id of o.playerIds) where.set(id, top4Ref.has(o.ref) ? "top4" : o.ref.startsWith("fill:") ? "filler" : "otherReal");
    const pool = [
      ...orgs.flatMap((o) => o.playerIds),
      ...save.world.freeAgentIds,
      ...(save.identity.region === region ? [...userIds] : []),
    ];
    const youngViews = pool
      .map((id) => playerViewById(id, ctx))
      .filter((v) => v !== null && v.region === region && v.age <= 21)
      .sort((a, b) => b!.potential - a!.potential)
      .slice(0, 6);
    const young = { top4: 0, otherReal: 0, filler: 0, fa: 0, user: 0 };
    for (const v of youngViews) young[userIds.has(v!.id) ? "user" : (where.get(v!.id) ?? "fa")] += 1;
    const faBest = Math.max(0, ...save.world.freeAgentIds.map((id) => playerViewById(id, ctx)).filter((v) => v?.region === region).map((v) => v!.overall));
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    rows.push({
      season,
      region,
      userRegion: save.identity.region === region,
      top4Age: avg(starters.map((v) => v!.age)),
      top4Ovr: avg(starters.map((v) => v!.overall)),
      top4Real: top4.filter((o) => !o.ref.startsWith("fill:")).length,
      orgs: orgs.length,
      realOrgs: orgs.filter((o) => !o.ref.startsWith("fill:")).length,
      median: regionMedianRating(save.world, region),
      localAnchor: localAnchorFor(region, { world: save.world, competition: save.competition }),
      young,
      youngAvgPot: avg(youngViews.map((v) => v!.potential)),
      youngAvgOvr: avg(youngViews.map((v) => v!.overall)),
      faBestOvr: faBest,
    });
  }
}

it.skipIf(!env.WORLDLIFE)("Mundo vivo M1: roster renewal and the Worlds field over the infinite seasons", () => {
  const regions = list<Region>(env.WORLDLIFE_REGIONS, ["NA", "EU", "SAM"]);
  const policies = list<ArcPolicyId>(env.WORLDLIFE_POLICIES, ["autopilot"]);
  const difficulty = (env.WORLDLIFE_DIFF ?? "normal") as CareerDifficulty;
  const seasons = Number(env.WORLDLIFE_SEASONS ?? 13);
  const seeds = Number(env.WORLDLIFE_SEEDS ?? 2);
  const regionRows: (RegionRow & { career: string })[] = [];
  const fieldRows: (FieldRow & { career: string })[] = [];
  const outcomes: string[] = [];
  for (const region of regions)
    for (const policy of policies)
      for (let k = 0; k < seeds; k++) {
        const seed = 9100 + 7919 * k;
        const career = `${region}/${policy}/${seed}`;
        const rows: RegionRow[] = [];
        const fields: FieldRow[] = [];
        const res = playArcCareer({
          region, difficulty, policy, seed, seasons, budgetMs: 1_200_000,
          onSeason(moment, save) {
            if (moment !== "end") return;
            snapshot(save, rows);
            for (const r of save.eventResults) {
              if (r.seasonIndex !== save.clock.seasonIndex || (r.tier !== "worlds" && r.tier !== "major")) continue;
              const kinds: Record<Kind, number> = { real: 0, filler: 0, local: 0, user: 0 };
              for (const row of r.rows) kinds[kindOf(row.ref)] += 1;
              fields.push({ season: r.seasonIndex, tier: r.tier, region: r.region ?? null, kinds });
            }
          },
        });
        outcomes.push(`${career} softlock=${res.softlock ? "yes" : "no"} seasons=${rows.length / ALL.length}`);
        regionRows.push(...rows.map((r) => ({ ...r, career })));
        fieldRows.push(...fields.map((f) => ({ ...f, career })));
        if (env.WORLDLIFE_OUT) writeFileSync(env.WORLDLIFE_OUT, JSON.stringify({ timeline: CAREER_SEASONS.length, regionRows, fieldRows, outcomes }));
      }

  const f1 = (n: number) => n.toFixed(1);
  const bySeason = new Map<number, (RegionRow & { career: string })[]>();
  for (const r of regionRows) bySeason.set(r.season, [...(bySeason.get(r.season) ?? []), r]);
  const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const lines: string[] = ["", "== careers", ...outcomes, "",
    "== all regions, every career (avg): season | top4 age | top4 ovr | real in top4 | real orgs/orgs | median | localAnchor | young(top4/other/filler/FA/user) pot/ovr | best FA ovr"];
  for (const [s, rs] of [...bySeason].sort((a, b) => a[0] - b[0])) {
    const y = (k: keyof RegionRow["young"]) => f1(avgOf(rs.map((r) => r.young[k])));
    lines.push(`S${s} | ${f1(avgOf(rs.map((r) => r.top4Age)))} | ${f1(avgOf(rs.map((r) => r.top4Ovr)))} | ${f1(avgOf(rs.map((r) => r.top4Real)))} | ${f1(avgOf(rs.map((r) => r.realOrgs)))}/${f1(avgOf(rs.map((r) => r.orgs)))} | ${f1(avgOf(rs.map((r) => r.median)))} | ${f1(avgOf(rs.map((r) => r.localAnchor)))} | ${y("top4")}/${y("otherReal")}/${y("filler")}/${y("fa")}/${y("user")} ${f1(avgOf(rs.map((r) => r.youngAvgPot)))}/${f1(avgOf(rs.map((r) => r.youngAvgOvr)))} | ${f1(avgOf(rs.map((r) => r.faBestOvr)))}`);
  }
  lines.push("", "== user's region only: season | top4 ovr | median | localAnchor");
  for (const [s, rs] of [...bySeason].sort((a, b) => a[0] - b[0])) {
    const u = rs.filter((r) => r.userRegion);
    lines.push(`S${s} | ${f1(avgOf(u.map((r) => r.top4Ovr)))} | ${f1(avgOf(u.map((r) => r.median)))} | ${f1(avgOf(u.map((r) => r.localAnchor)))}`);
  }
  lines.push("", "== Worlds / Majors field (avg per event): season | tier | real | filler | local | user | events");
  const fk = new Map<string, (FieldRow & { career: string })[]>();
  for (const f of fieldRows) fk.set(`${String(f.season).padStart(2, "0")} ${f.tier}`, [...(fk.get(`${String(f.season).padStart(2, "0")} ${f.tier}`) ?? []), f]);
  for (const [key, fs] of [...fk].sort()) {
    const a = (k: Kind) => f1(avgOf(fs.map((f) => f.kinds[k])));
    lines.push(`S${key} | ${a("real")} | ${a("filler")} | ${a("local")} | ${a("user")} | ${fs.length}`);
  }
  if (env.WORLDLIFE_SUMMARY) writeFileSync(env.WORLDLIFE_SUMMARY, lines.join("\n"));
  console.log(lines.join("\n"));
}, 7_200_000);
