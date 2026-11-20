/**
 * Mundo vivo M1 (opt-in: WORLDLIFE=1) — do the AI orgs renew their rosters,
 * and who takes the Worlds seats in the infinite seasons? Plays whole careers
 * with the arc bot and, at every season's end, reads the world as it stands:
 *
 *  - per region, the top 4 orgs by stored rating: their starters' average age
 *    and overall, and how many of the 4 are real (dataset) orgs;
 *  - the region's best young players (age ≤ 21, top 6 by potential): where
 *    they are (top-4 org, other org, filler org, free agent, user squad), and
 *    the scouted reserves (M1);
 *  - the region's median org rating and the local scene's anchor;
 *  - the season's Worlds (and Majors) field: real orgs, fillers, M1's new
 *    orgs, Local sides, the user;
 *  - coach turnover (AI orgs whose coach took over this season; the user's
 *    coach announcements and retirements);
 *  - the user's endgame: rating at a Major / Worlds, the strongest rival,
 *    placement and series lost.
 *
 * Compare M1 by running it twice, the flag off and on (NEXT_PUBLIC_WORLD_LIFE=1):
 *   WORLDLIFE=1 WORLDLIFE_REGIONS=NA,EU,SAM WORLDLIFE_SEEDS=2 WORLDLIFE_SEASONS=13 WORLDLIFE_POLICIES=strong WORLDLIFE_DIFFS=normal,hard npx vitest run src/store/careerWorldLife.probe.test.ts
 *   WORLDLIFE_SLICE=i/n runs one slice (parallel processes); WORLDLIFE_OUT dumps the rows, WORLDLIFE_SUMMARY the tables.
 *
 * Observers only — the saves are never changed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_SEASONS, FEATURES } from "@/config/balance";
import { playerViewById } from "@/engine/career/development";
import { isLocalRef } from "@/engine/career/localScene";
import type { CareerSave, CareerDifficulty } from "@/engine/career/types";
import { localAnchorFor, localTeamFor, orgTeamFor, regionMedianRating } from "@/engine/career/worldSim";
import { localRegionOf } from "@/engine/career/localScene";
import { fastForward, initFieldTournament, userPlacement } from "@/engine/tournament";
import { createRng } from "@/lib/rng";
import type { Region, TournamentTeam } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";
import { localAnchorRatingFor } from "./careerFlow";

const env = process.env;
const ALL: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

type Kind = "real" | "filler" | "newOrg" | "local" | "user";
const kindOf = (ref: string): Kind => {
  if (ref === "user") return "user";
  if (isLocalRef(ref)) return "local";
  if (ref.startsWith("fill:")) return Number(ref.split(":")[2]) >= 100 ? "newOrg" : "filler";
  return "real";
};

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
  reserves: number;
  coachNew: number;
}
interface FieldRow { season: number; tier: string; kinds: Record<Kind, number> }
interface UserEvent { season: number; tier: string; rating: number; maxOpponent: number; placement: string; seriesLost: number; series: number }
/** A fixed-rating user team replayed REPS times in the season's real Worlds field (the world as M1 left it). */
interface ReplayRow { season: number; difficulty: CareerDifficulty; target: number; titles: number; reps: number; fieldTop: number; fieldMedian: number }
const REPLAY_TARGETS = [93, 95, 97];
const REPLAY_REPS = Number(env.WORLDLIFE_REPS ?? 150);

function replayWorlds(save: CareerSave, out: ReplayRow[]): void {
  const refs = (save.competition.worldsFieldRefs ?? []).filter((r) => r !== "user");
  if (refs.length < 15) return;
  const season = save.clock.seasonIndex;
  for (const difficulty of ["normal", "hard"] as CareerDifficulty[]) {
    const ctx = { world: save.world, seasonIndex: season, careerSeed: save.careerSeed, difficulty };
    const teams: TournamentTeam[] = refs.map((ref) => {
      const region = localRegionOf(ref);
      if (!region) return orgTeamFor(ref, ctx);
      const anchor = localAnchorFor(region, { world: save.world, competition: save.competition });
      return localTeamFor(ref, { careerSeed: save.careerSeed, seasonIndex: season, difficulty, anchor, nameBankVersion: save.world.nameBankVersion });
    });
    teams.sort((a, b) => b.rating.total - a.rating.total);
    const ai = teams.slice(0, 15);
    const ratings = ai.map((t) => t.rating.total);
    for (const target of REPLAY_TARGETS) {
      const user: TournamentTeam = { ...ai[7], id: "user", isUser: true, name: "User", rating: { ...ai[7].rating, total: target } };
      let titles = 0;
      for (let k = 0; k < REPLAY_REPS; k++) {
        const rng = createRng(83000 + k);
        const t = fastForward(initFieldTournament([...ai, user], "swiss", rng), difficulty, rng);
        if (userPlacement(t) === "champion") titles += 1;
      }
      out.push({ season, difficulty, target, titles, reps: REPLAY_REPS, fieldTop: ratings[0], fieldMedian: ratings[7] });
    }
  }
}

interface CareerRow { career: string; region: Region; difficulty: CareerDifficulty; policy: string; seed: number; softlock: boolean; seasons: number; endRating: number[]; coachAnnounced: number; coachRetired: number; userEvents: UserEvent[]; replays: ReplayRow[]; coachIds: string[] }

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
    for (const o of orgs) {
      const at = top4Ref.has(o.ref) ? "top4" : o.ref.startsWith("fill:") ? "filler" : "otherReal";
      for (const id of [...o.playerIds, ...(o.reserveIds ?? [])]) where.set(id, at);
    }
    const pool = [
      ...orgs.flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]),
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
      reserves: orgs.reduce((n, o) => n + (o.reserveIds?.length ?? 0), 0),
      coachNew: orgs.filter((o) => o.coachSince === season).length,
    });
  }
}

it.skipIf(!env.WORLDLIFE)("Mundo vivo M1: roster renewal, coaches and the Worlds field over the infinite seasons", () => {
  const regions = list<Region>(env.WORLDLIFE_REGIONS, ["NA", "EU", "SAM"]);
  const policies = list<ArcPolicyId>(env.WORLDLIFE_POLICIES, ["autopilot"]);
  const diffs = list<CareerDifficulty>(env.WORLDLIFE_DIFFS, ["normal"]);
  const seasons = Number(env.WORLDLIFE_SEASONS ?? 13);
  const seeds = Number(env.WORLDLIFE_SEEDS ?? 2);
  const [slice, slices] = (env.WORLDLIFE_SLICE ?? "0/1").split("/").map(Number);
  const cells = regions.flatMap((region) => diffs.flatMap((difficulty) => policies.flatMap((policy) =>
    Array.from({ length: seeds }, (_, k) => ({ region, difficulty, policy, seed: 9100 + 7919 * k })))));
  const regionRows: (RegionRow & { career: string })[] = [];
  const fieldRows: (FieldRow & { career: string })[] = [];
  const careers: CareerRow[] = [];
  for (const [i, cell] of cells.entries()) {
    if (i % slices !== slice) continue;
    const career = `${cell.region}/${cell.difficulty}/${cell.policy}/${cell.seed}`;
    const rows: RegionRow[] = [];
    const fields: FieldRow[] = [];
    const row: CareerRow = { career, ...cell, softlock: false, seasons: 0, endRating: [], coachAnnounced: 0, coachRetired: 0, userEvents: [], replays: [], coachIds: [] };
    const seenNews = new Set<string>();
    const res = playArcCareer({
      ...cell, seasons, budgetMs: 1_800_000,
      onEvent(save) {
        const ev = save.activeEvent;
        if (!ev || (ev.def.tier !== "worlds" && ev.def.tier !== "major")) return;
        const teams = Object.values(ev.tournament.teams);
        const opponents = teams.filter((t) => !t.isUser).map((t) => t.rating.total);
        const series = [...ev.tournament.swiss.rounds.flatMap((r) => r.series), ...(ev.tournament.playoffs?.rounds.flatMap((r) => r.series) ?? [])]
          .filter((s) => s.teamAId === "user" || s.teamBId === "user");
        row.userEvents.push({
          season: save.clock.seasonIndex, tier: ev.def.tier, rating: ev.tournament.teams.user?.rating.total ?? 0,
          maxOpponent: Math.max(...opponents), placement: String(userPlacement(ev.tournament)),
          seriesLost: series.filter((s) => s.winnerTeamId && s.winnerTeamId !== "user").length, series: series.length,
        });
      },
      onSeason(moment, save) {
        if (moment !== "end") return;
        snapshot(save, rows);
        if (save.clock.seasonIndex >= 4) replayWorlds(save, row.replays);
        row.endRating.push(Math.round(localAnchorRatingFor(save) * 10) / 10);
        // The rollover files its news under the season it leaves: count each item once, whenever seen.
        for (const n of save.mail) {
          if (seenNews.has(n.id)) continue;
          seenNews.add(n.id);
          if (n.titleKey === "coachRetireAnnounce") row.coachAnnounced += 1;
          if (n.titleKey === "coachRetired") row.coachRetired += 1;
        }
        row.coachIds.push(save.coach?.id ?? "-");
        for (const r of save.eventResults) {
          if (r.seasonIndex !== save.clock.seasonIndex || (r.tier !== "worlds" && r.tier !== "major")) continue;
          const kinds: Record<Kind, number> = { real: 0, filler: 0, newOrg: 0, local: 0, user: 0 };
          for (const x of r.rows) kinds[kindOf(x.ref)] += 1;
          fields.push({ season: r.seasonIndex, tier: r.tier, kinds });
        }
      },
    });
    row.softlock = Boolean(res.softlock);
    row.seasons = rows.length / ALL.length;
    careers.push(row);
    regionRows.push(...rows.map((r) => ({ ...r, career })));
    fieldRows.push(...fields.map((f) => ({ ...f, career })));
    if (env.WORLDLIFE_OUT) writeFileSync(env.WORLDLIFE_OUT, JSON.stringify({ worldLife: FEATURES.worldLife, timeline: CAREER_SEASONS.length, regionRows, fieldRows, careers }));
  }
  if (env.WORLDLIFE_SUMMARY) writeFileSync(env.WORLDLIFE_SUMMARY, summarize(FEATURES.worldLife, regionRows, fieldRows, careers));
}, 7_200_000);

/** WORLDLIFE_MERGE=a.json,b.json WORLDLIFE_SUMMARY=out.txt — one summary over several slices' dumps. */
it.skipIf(!env.WORLDLIFE_MERGE)("Mundo vivo M1: merges the slices' dumps", () => {
  const dumps = env.WORLDLIFE_MERGE!.split(",").map((p) => JSON.parse(readFileSync(p, "utf8")) as {
    worldLife: boolean; regionRows: (RegionRow & { career: string })[]; fieldRows: (FieldRow & { career: string })[]; careers: CareerRow[];
  });
  const text = summarize(dumps[0].worldLife, dumps.flatMap((d) => d.regionRows), dumps.flatMap((d) => d.fieldRows), dumps.flatMap((d) => d.careers));
  if (env.WORLDLIFE_SUMMARY) writeFileSync(env.WORLDLIFE_SUMMARY, text);
});

function longestRun(ids: string[]): number {
  let best = 0, run = 0;
  ids.forEach((id, i) => { run = id !== "-" && id === ids[i - 1] ? run + 1 : id !== "-" ? 1 : 0; best = Math.max(best, run); });
  return best;
}

/** The summary tables (also used by the merge script over several slices' dumps). */
export function summarize(flag: boolean, regionRows: (RegionRow & { career: string })[], fieldRows: (FieldRow & { career: string })[], careers: CareerRow[]): string {
  const f1 = (n: number) => n.toFixed(1);
  const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const group = <T,>(xs: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
    return [...m].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  };
  const lines: string[] = [`worldLife=${flag}`, "", "== careers"];
  for (const c of careers) lines.push(`${c.career} softlock=${c.softlock ? "yes" : "no"} seasons=${c.seasons} endRating=${c.endRating.join(",")} coach announced/retired=${c.coachAnnounced}/${c.coachRetired} coaches=${new Set(c.coachIds.filter((x) => x !== "-")).size} longest=${longestRun(c.coachIds)}`);
  lines.push("", "== world (all regions, avg): season | top4 age | top4 ovr | median | localAnchor | young top4/other/filler/FA/user | reserves/region | new coaches/region");
  for (const [s, rs] of group(regionRows, (r) => String(r.season))) {
    const y = (k: keyof RegionRow["young"]) => f1(avgOf(rs.map((r) => r.young[k])));
    lines.push(`S${s} | ${f1(avgOf(rs.map((r) => r.top4Age)))} | ${f1(avgOf(rs.map((r) => r.top4Ovr)))} | ${f1(avgOf(rs.map((r) => r.median)))} | ${f1(avgOf(rs.map((r) => r.localAnchor)))} | ${y("top4")}/${y("otherReal")}/${y("filler")}/${y("fa")}/${y("user")} | ${f1(avgOf(rs.map((r) => r.reserves)))} | ${f1(avgOf(rs.map((r) => r.coachNew)))}`);
  }
  lines.push("", "== Worlds field (avg of 16): season | real | filler | newOrg | local | user | events");
  for (const [s, fs] of group(fieldRows.filter((f) => f.tier === "worlds"), (f) => String(f.season))) {
    const a = (k: Kind) => f1(avgOf(fs.map((f) => f.kinds[k])));
    lines.push(`S${s} | ${a("real")} | ${a("filler")} | ${a("newOrg")} | ${a("local")} | ${a("user")} | ${fs.length}`);
  }
  lines.push("", "== user endgame by difficulty × tier × era: n | titles | title/appearance | series lost % | rating p50 / max | strongest rival p50 | gap p50");
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const evs = careers.flatMap((c) => c.userEvents.map((e) => ({ ...e, difficulty: c.difficulty })));
  for (const [k, es] of group(evs, (e) => `${e.difficulty} ${e.tier} ${e.season >= CAREER_SEASONS.length ? "infinite" : "timeline"}`)) {
    const titles = es.filter((e) => e.placement === "champion").length;
    const lost = es.reduce((n, e) => n + e.seriesLost, 0), all = es.reduce((n, e) => n + e.series, 0);
    lines.push(`${k} | ${es.length} | ${titles} | ${f1((100 * titles) / es.length)}% | ${f1(all ? (100 * lost) / all : 0)}% | ${f1(med(es.map((e) => e.rating)))} / ${f1(Math.max(...es.map((e) => e.rating)))} | ${f1(med(es.map((e) => e.maxOpponent)))} | ${f1(med(es.map((e) => e.maxOpponent - e.rating)))}`);
  }
  lines.push("", "== user at 93+ by difficulty: n | title/appearance | series lost %");
  for (const [k, es] of group(evs.filter((e) => e.rating >= 93), (e) => `${e.difficulty} ${e.tier}`)) {
    const titles = es.filter((e) => e.placement === "champion").length;
    const lost = es.reduce((n, e) => n + e.seriesLost, 0), all = es.reduce((n, e) => n + e.series, 0);
    lines.push(`${k} | ${es.length} | ${f1((100 * titles) / es.length)}% | ${f1(all ? (100 * lost) / all : 0)}%`);
  }
  lines.push("", "== Worlds replay (a user team at a fixed rating in the season's real Worlds field): season difficulty | 93 / 95 / 97 title % | field top | field 8th");
  const reps = careers.flatMap((c) => c.replays);
  for (const [k, rs] of group(reps, (x) => `${String(x.season).padStart(2, "0")} ${x.difficulty}`)) {
    const pct = (t: number) => {
      const xs = rs.filter((x) => x.target === t);
      const n = xs.reduce((a, x) => a + x.reps, 0);
      return f1(n ? (100 * xs.reduce((a, x) => a + x.titles, 0)) / n : 0);
    };
    const one = rs.filter((x) => x.target === REPLAY_TARGETS[0]);
    lines.push(`S${k} | ${pct(93)} / ${pct(95)} / ${pct(97)} | ${f1(avgOf(one.map((x) => x.fieldTop)))} | ${f1(avgOf(one.map((x) => x.fieldMedian)))}`);
  }
  return lines.join("\n");
}
