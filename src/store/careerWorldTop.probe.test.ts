/**
 * Mundo vivo M2 diagnosis (opt-in: WORLDTOP=1) — why does the top of the AI
 * field decay over the infinite seasons, and what would hold it? Plays whole
 * careers with the arc bot and, at every season's end, reads:
 *
 *  - the world's top 30 AI players (orgs, reserves, free agents): overall,
 *    age, real share, how many are frozen on their last dataset card (real and
 *    never moved off-script: worldGrowthWeek never touches them), how many are
 *    declining, and the gap to their own peak target;
 *  - the elite pipeline: AI players with potential ≥ 94 / overall ≥ 94;
 *  - concentration: of each region's 9 best players, the most in one org and
 *    how many are free agents;
 *  - the Worlds field (top, 4th, 8th) and a fixed-rating user team replayed
 *    REPS times in it, in several variants: as the world stands; "held" (each
 *    rank of the field lifted back to that career's S6 rating, never lowered;
 *    "lift25" / "lift50" give back a quarter / half of that drop);
 *    "super" (the strongest org's region regroups its 3 best AI players in it).
 *
 *   WORLDTOP=1 NEXT_PUBLIC_WORLD_LIFE=1 WORLDTOP_REGIONS=NA,EU WORLDTOP_SLICE=0/2 WORLDTOP_OUT=a.json npx vitest run src/store/careerWorldTop.probe.test.ts
 *   WORLDTOP_MERGE=a.json,b.json WORLDTOP_SUMMARY=out.txt npx vitest run src/store/careerWorldTop.probe.test.ts
 *
 * Observers only — the saves are never changed (the replays build their own teams).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { FEATURES } from "@/config/balance";
import { developmentProfileOf, developmentPhaseOf, peakTargetOf, playerViewById } from "@/engine/career/development";
import { localRegionOf } from "@/engine/career/localScene";
import type { CareerSave } from "@/engine/career/types";
import { localAnchorFor, localTeamFor, orgTeamFor } from "@/engine/career/worldSim";
import { fastForward, initFieldTournament, userPlacement } from "@/engine/tournament";
import { createRng } from "@/lib/rng";
import type { Region, TournamentTeam } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const ALL: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const TARGETS = (env.WORLDTOP_TARGETS ?? "95,97,99,101").split(",").map(Number);
const REPS = Number(env.WORLDTOP_REPS ?? 100);
const VARIANTS = ["base", "lift25", "lift50", "held", "super", "held+super"] as const;
type Variant = (typeof VARIANTS)[number];

interface Row {
  season: number;
  top30Ovr: number; top30Age: number; top30Real: number; top30Frozen: number; top30Declining: number; top30Gap: number;
  top30Pot: number; elitePot: number; eliteOvr: number; eliteFicPot: number; eliteFicPotAge: number; eliteFicReached: number;
  maxInOneOrg: number; topFa: number;
  field: number[]; superRating: number;
  replay: Record<string, number>; // `${variant}:${target}` → titles of REPS
}
interface Career { career: string; rows: Row[] }

function worldsTeams(save: CareerSave): TournamentTeam[] {
  const refs = (save.competition.worldsFieldRefs ?? []).filter((r) => r !== "user");
  const season = save.clock.seasonIndex;
  const ctx = { world: save.world, seasonIndex: season, careerSeed: save.careerSeed, difficulty: "normal" as const };
  return refs.map((ref) => {
    const region = localRegionOf(ref);
    if (!region) return orgTeamFor(ref, ctx);
    const anchor = localAnchorFor(region, { world: save.world, competition: save.competition });
    return localTeamFor(ref, { careerSeed: save.careerSeed, seasonIndex: season, difficulty: "normal", anchor, nameBankVersion: save.world.nameBankVersion });
  }).sort((a, b) => b.rating.total - a.rating.total);
}

function replay(ai: TournamentTeam[], target: number): number {
  const user: TournamentTeam = { ...ai[7], id: "user", isUser: true, name: "User", rating: { ...ai[7].rating, total: target } };
  let titles = 0;
  for (let k = 0; k < REPS; k++) {
    const rng = createRng(83000 + k);
    const t = fastForward(initFieldTournament([...ai, user], "swiss", rng), "normal", rng);
    if (userPlacement(t) === "champion") titles += 1;
  }
  return titles;
}

function snapshot(save: CareerSave, s6: number[] | null): Row | null {
  const season = save.clock.seasonIndex;
  const ctx = { careerSeed: save.careerSeed, seasonIndex: season, world: save.world };
  const user = new Set(save.squad.map((p) => p.id));
  const orgOf = new Map<string, string>();
  for (const o of Object.values(save.world.orgs)) for (const id of [...o.playerIds, ...(o.reserveIds ?? [])]) orgOf.set(id, o.ref);
  const ids = [...orgOf.keys(), ...save.world.freeAgentIds].filter((id) => !user.has(id));
  const views = ids.map((id) => playerViewById(id, ctx)).filter((v) => v !== null).map((v) => v!);
  views.sort((a, b) => b.overall - a.overall);
  const top = views.slice(0, 30);
  const info = top.map((v) => {
    const prof = developmentProfileOf(v.id, save.careerSeed);
    const target = peakTargetOf(v.potential, prof);
    return {
      v, frozen: v.kind === "real" && !(v.id in save.world.overallDelta),
      declining: developmentPhaseOf(v.age + 0.5, { peakAge: v.peakAge, plateauYears: prof.plateauYears }) === "declining",
      gap: Math.max(0, target - v.overall),
    };
  });
  const elitePot = views.filter((v) => v.potential >= 94);
  const eliteFic = elitePot.filter((v) => v.kind !== "real");
  // Concentration: each region's 9 best players.
  let maxInOneOrg = 0, topFa = 0;
  for (const region of ALL) {
    const best = views.filter((v) => v.region === region).slice(0, 9);
    const count = new Map<string, number>();
    for (const v of best) {
      const o = orgOf.get(v.id);
      if (!o) topFa += 1; else count.set(o, (count.get(o) ?? 0) + 1);
    }
    maxInOneOrg += Math.max(0, ...count.values());
  }
  const teams = worldsTeams(save);
  if (teams.length < 15) return null;
  const ai = teams.slice(0, 15);
  // "super": the strongest org's region regroups its 3 best AI players in that org.
  const topRef = ai.find((t) => save.world.orgs[t.id])?.id;
  let superAi = ai, superRating = 0;
  if (topRef) {
    const org = save.world.orgs[topRef];
    const trio = views.filter((v) => v.region === org.region && v.kind !== undefined).slice(0, 3).map((v) => v.id) as [string, string, string];
    const world = { ...save.world, orgs: { ...save.world.orgs, [topRef]: { ...org, playerIds: trio } } };
    const st = orgTeamFor(topRef, { world, seasonIndex: season, careerSeed: save.careerSeed, difficulty: "normal" });
    superRating = st.rating.total;
    superAi = ai.map((t) => (t.id === topRef ? st : t)).sort((a, b) => b.rating.total - a.rating.total);
  }
  // Each rank lifted by `share` of its drop below the career's S6 field (never lowered).
  const lift = (field: TournamentTeam[], share = 1) =>
    s6 ? field.map((t, k) => ({ ...t, rating: { ...t.rating, total: t.rating.total + share * Math.max(0, (s6[k] ?? 0) - t.rating.total) } })) : field;
  const fields: Record<Variant, TournamentTeam[]> = {
    base: ai, lift25: lift(ai, 0.25), lift50: lift(ai, 0.5), held: lift(ai), super: superAi, "held+super": lift(superAi),
  };
  const out: Record<string, number> = {};
  for (const variant of VARIANTS) for (const target of TARGETS) out[`${variant}:${target}`] = replay(fields[variant], target);
  return {
    season,
    top30Ovr: avg(top.map((v) => v.overall)), top30Age: avg(top.map((v) => v.age)),
    top30Real: top.filter((v) => v.kind === "real").length, top30Frozen: info.filter((x) => x.frozen).length,
    top30Declining: info.filter((x) => x.declining).length, top30Gap: avg(info.map((x) => x.gap)),
    top30Pot: avg(top.map((v) => v.potential)),
    elitePot: elitePot.length, eliteOvr: views.filter((v) => v.overall >= 94).length,
    eliteFicPot: eliteFic.length, eliteFicPotAge: avg(eliteFic.map((v) => v.age)), eliteFicReached: eliteFic.filter((v) => v.overall >= 94).length,
    maxInOneOrg: maxInOneOrg / ALL.length, topFa: topFa / ALL.length,
    field: ai.map((t) => Math.round(t.rating.total * 10) / 10), superRating, replay: out,
  };
}

it.skipIf(!env.WORLDTOP)("Mundo vivo M2: why the top of the AI field decays", () => {
  const regions = list<Region>(env.WORLDTOP_REGIONS, ["NA", "EU", "SAM", "MENA", "APAC"]);
  const policy = (env.WORLDTOP_POLICY ?? "tuned") as ArcPolicyId;
  const seeds = Number(env.WORLDTOP_SEEDS ?? 1);
  const seasons = Number(env.WORLDTOP_SEASONS ?? 13);
  const [slice, slices] = (env.WORLDTOP_SLICE ?? "0/1").split("/").map(Number);
  const cells = regions.flatMap((region) => Array.from({ length: seeds }, (_, k) => ({ region, seed: 9100 + 7919 * k })));
  const careers: Career[] = [];
  for (const [i, cell] of cells.entries()) {
    if (i % slices !== slice) continue;
    const c: Career = { career: `${cell.region}/${cell.seed}`, rows: [] };
    let s6: number[] | null = null;
    playArcCareer({
      region: cell.region, seed: cell.seed, difficulty: "normal", policy, seasons, budgetMs: 1_800_000,
      onSeason(moment, save) {
        if (moment !== "end" || save.clock.seasonIndex < 4) return;
        const row = snapshot(save, save.clock.seasonIndex > 6 ? s6 : null);
        if (!row) return;
        if (save.clock.seasonIndex === 6) s6 = row.field;
        c.rows.push(row);
      },
    });
    careers.push(c);
    if (env.WORLDTOP_OUT) writeFileSync(env.WORLDTOP_OUT, JSON.stringify({ worldLife: FEATURES.worldLife, careers }));
  }
  if (env.WORLDTOP_SUMMARY) writeFileSync(env.WORLDTOP_SUMMARY, summarize(careers));
}, 7_200_000);

it.skipIf(!env.WORLDTOP_MERGE)("Mundo vivo M2: merges the slices' dumps", () => {
  const careers = env.WORLDTOP_MERGE!.split(",").flatMap((p) => (JSON.parse(readFileSync(p, "utf8")) as { careers: Career[] }).careers);
  if (env.WORLDTOP_SUMMARY) writeFileSync(env.WORLDTOP_SUMMARY, summarize(careers));
});

export function summarize(careers: Career[]): string {
  const f1 = (n: number) => n.toFixed(1);
  const rows = careers.flatMap((c) => c.rows);
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => a - b);
  const lines = [`careers=${careers.map((c) => c.career).join(" ")}`, "",
    "season | top30 ovr / age / real / frozen / declining / gap / pot | pot≥94 / ovr≥94 | fic pot≥94 (age, reached) | max of region top-9 in one org / FA | field 1st / 4th / 8th | superteam"];
  for (const s of seasons) {
    const rs = rows.filter((r) => r.season === s);
    const a = (k: keyof Row) => f1(avg(rs.map((r) => r[k] as number)));
    lines.push(`S${s} | ${a("top30Ovr")} / ${a("top30Age")} / ${a("top30Real")} / ${a("top30Frozen")} / ${a("top30Declining")} / ${a("top30Gap")} / ${a("top30Pot")} | ${a("elitePot")} / ${a("eliteOvr")} | ${a("eliteFicPot")} (${a("eliteFicPotAge")}, ${a("eliteFicReached")}) | ${a("maxInOneOrg")} / ${a("topFa")} | ${f1(avg(rs.map((r) => r.field[0])))} / ${f1(avg(rs.map((r) => r.field[3])))} / ${f1(avg(rs.map((r) => r.field[7])))} | ${a("superRating")}`);
  }
  lines.push("", `Worlds replay, Normal, title % of ${REPS} (user at ${TARGETS.join(" / ")}): ${VARIANTS.join(" | ")}`);
  for (const s of seasons) {
    const rs = rows.filter((r) => r.season === s);
    const pct = (key: string) => f1((100 * rs.reduce((n, r) => n + (r.replay[key] ?? 0), 0)) / (REPS * rs.length));
    lines.push(`S${s} | ${VARIANTS.map((v) => TARGETS.map((t) => pct(`${v}:${t}`)).join(" / ")).join(" | ")}`);
  }
  return lines.join("\n");
}
