/**
 * v2.2 ENDLESS (opt-in: ENDLESS_PROBE=1) — how the infinite seasons read once
 * the user's team is dominant. Plays whole careers with the arc bot and records,
 * per season:
 *  - the user's team rating, titles by tier, series won / lost by tier;
 *  - at the user's Major / Worlds events: how many AI sides sit within 3 points
 *    of the user (ratings as the match reads them, shifts included);
 *  - the user's Saturday cups (t2 / t3): the opponents met in the semi-final
 *    and the final (distinct per season), and the cups' field ids;
 *  - the world's best AI sides at the season's end (top 1 / 3 / 8 intrinsic).
 *
 *   ENDLESS_PROBE=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 \
 *     EP_REGIONS=NA,EU,SAM EP_SEEDS=2 EP_SEASONS=14 EP_OUT=out.json npx vitest run src/store/careerEndless.probe.test.ts
 *   (NEXT_PUBLIC_ENDLESS_VARIETY=1 turns the front on.)
 *
 * Observers only — the saves are never changed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_ENDLESS, FEATURES } from "@/config/balance";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { playerViewById } from "@/engine/career/development";
import { orgTeamFor } from "@/engine/career/worldSim";
import { userPlacement } from "@/engine/tournament";
import type { Region, SeriesResult } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const FLOOR = Number(env.EP_FLOOR ?? 0);
const FLOOR_FROM = Number(env.EP_FLOOR_FROM ?? 6);
const list = <T extends string>(v: string | undefined, d: T[]): T[] => (v ? (v.split(",") as T[]) : d);

export interface EndlessSeason {
  season: number;
  rating: number;
  titles: Record<string, number>;
  played: Record<string, number>;
  series: Record<string, [number, number]>;
  /** Per Major/Worlds the user played: AI sides within 3 of the user. */
  near3: number[];
  /** Saturday cups: [semi opponent, final opponent] per cup ("" = not reached). */
  cupKnock: { tier: string; name: string; semi: string; final: string; place: string }[];
  worlds: string | null;
  aiTop: number[];
  /** Rival projects running this season (the front's own state; 0 when off). */
  projects?: number;
  projectLift?: string[];
  strength?: number;
  /** The user's consecutive Worlds titles going into the season (the dynasty the answer read). */
  userStreak?: number;
  /** The user's lead over the three best AI sides at the season's Worlds. */
  worldsGap?: number[];
  legends?: { user: number; top: number; mean: number; place: string }[];
  gap?: number;
  superWorld?: number;
  superRegion?: number;
  top3Ovr?: number[];
  rules?: string[];
}

function seriesOf(save: CareerSave): SeriesResult[] {
  const tr = save.activeEvent!.tournament;
  return [...tr.swiss.rounds.flatMap((r) => r.series), ...(tr.playoffs?.rounds.flatMap((r) => r.series) ?? [])];
}

it.runIf(env.ENDLESS_PROBE === "1")("v2.2 endless probe", { timeout: 24 * 3_600_000 }, () => {
  const regions = list<Region>(env.EP_REGIONS, ["NA", "EU", "SAM"]);
  const diffs = list<CareerDifficulty>(env.EP_DIFFS, ["normal"]);
  const policy = (env.EP_POLICY ?? "strong") as ArcPolicyId;
  const seeds = Number(env.EP_SEEDS ?? 2);
  const seasons = Number(env.EP_SEASONS ?? 14);
  const seedBase = Number(env.EP_SEED_BASE ?? 9100);
  console.log(`flags worldLife=${FEATURES.worldLife} styles=${FEATURES.matchdayStyles} decisions=${FEATURES.matchdayDecisions} endless=${(FEATURES as Record<string, unknown>).endlessVariety}`);
  // rc9 ENDGAME: EP_LATE='{"kitBase":5}' sets CAREER_ENDLESS.late.projects for an arm (probe-only).
  if (env.EP_LATE) {
    (CAREER_ENDLESS.late as { projects: Record<string, unknown> }).projects = JSON.parse(env.EP_LATE);
    console.log(`late ${JSON.stringify(CAREER_ENDLESS.late)}`);
  }
  const out: { region: Region; difficulty: CareerDifficulty; seed: number; ended: string | null; ms: number; rows: EndlessSeason[] }[] = [];
  for (const region of regions)
    for (const difficulty of diffs)
      for (let k = 0; k < seeds; k++) {
        const seed = seedBase + 7919 * k;
        const rows = new Map<number, EndlessSeason>();
        const row = (s: number): EndlessSeason =>
          rows.get(s) ??
          (rows.set(s, { season: s, rating: 0, titles: {}, played: {}, series: {}, near3: [], cupKnock: [], worlds: null, aiTop: [] }), rows.get(s)!);
        // rc9 ENDGAME: EP_DUMP_AT=6 EP_DUMP=prefix writes the save at that season's start and stops
        // (seasons before CAREER_ENDLESS.fromSeasonIndex do not read the endless config); EP_FROM=prefix
        // resumes every arm from those saves, so an arm plays only the endless years.
        const dumpAt = env.EP_DUMP_AT !== undefined ? Number(env.EP_DUMP_AT) : null;
        const fileOf = (prefix: string) => `${prefix}-${region}-${difficulty}-${seed}.json`;
        const startFrom = env.EP_FROM ? (JSON.parse(readFileSync(fileOf(env.EP_FROM), "utf8")) as CareerSave) : undefined;
        let dumped = false;
        let res: ReturnType<typeof playArcCareer>;
        try {
        res = playArcCareer({
          region,
          difficulty,
          policy,
          seed,
          seasons: startFrom ? seasons - startFrom.clock.seasonIndex : seasons,
          ...(startFrom ? { startFrom } : {}),
          budgetMs: 3_600_000,
          onEvent(save) {
            const a = save.activeEvent;
            if (!a) return;
            const r = row(save.clock.seasonIndex);
            const tier = a.def.tier;
            r.played[tier] = (r.played[tier] ?? 0) + 1;
            const place = String(userPlacement(a.tournament));
            if (place === "champion") r.titles[tier] = (r.titles[tier] ?? 0) + 1;
            const s = (r.series[tier] ??= [0, 0]);
            for (const x of seriesOf(save)) {
              if (x.teamAId !== "user" && x.teamBId !== "user") continue;
              s[x.winnerTeamId === "user" ? 0 : 1] += 1;
            }
            const teams = Object.values(a.tournament.teams);
            const user = teams.find((t) => t.isUser);
            if (user && (tier === "major" || tier === "worlds")) {
              r.near3.push(teams.filter((t) => !t.isUser && t.rating.total >= user.rating.total - 3).length);
              if (tier === "worlds") {
                r.worldsGap = teams.filter((t) => !t.isUser).map((t) => Math.round((user.rating.total - t.rating.total) * 10) / 10).sort((x, y) => x - y).slice(0, 3);
              }
            }
            if (tier === "t2" || tier === "t3") {
              const rounds = a.tournament.playoffs?.rounds ?? [];
              const opp = (name: string) => {
                const x = rounds.find((q) => q.name === name)?.series.find((q) => q.teamAId === "user" || q.teamBId === "user");
                return x ? (x.teamAId === "user" ? x.teamBId : x.teamAId) : "";
              };
              r.cupKnock.push({ tier, name: a.def.name, semi: opp("semifinal"), final: opp("final"), place });
              if (a.def.endless === "legends" && user) {
                const ai = teams.filter((t) => !t.isUser).map((t) => t.rating.total).sort((x, y) => y - x);
                (r.legends ??= []).push({ user: Math.round(user.rating.total * 10) / 10, top: Math.round(ai[0] * 10) / 10, mean: Math.round((ai.reduce((n, x) => n + x, 0) / ai.length) * 10) / 10, place });
              }
            }
          },
          onSeason(moment, save) {
            if (dumpAt !== null && moment === "start" && save.clock.seasonIndex === dumpAt && env.EP_DUMP) {
              writeFileSync(fileOf(env.EP_DUMP), JSON.stringify(save));
              dumped = true;
              throw new Error("EP_DUMPED");
            }
            // EP_FLOOR=98: a dominant user (a human who trains past the bot): from EP_FLOOR_FROM (6) each
            // season starts with every squad player at least this overall (probe-only, the arm's premise).
            // Also at the season's end, so the rollover (the projects' read of dominance) sees the same team.
            if (FLOOR > 0 && save.clock.seasonIndex >= FLOOR_FROM - (moment === "end" ? 1 : 0)) {
              for (const p of save.squad) {
                p.overall = Math.max(p.overall, FLOOR);
                p.potential = Math.max(p.potential, FLOOR);
              }
            }
            if (moment !== "end") return;
            const r = row(save.clock.seasonIndex);
            const ctx = { world: save.world, seasonIndex: save.clock.seasonIndex, careerSeed: save.careerSeed, difficulty: "normal" as const };
            r.aiTop = Object.values(save.world.orgs)
              .map((o) => orgTeamFor(o.ref, ctx).rating.total)
              .sort((x, y) => y - x)
              .slice(0, 8)
              .map((x) => Math.round(x * 10) / 10);
            // What concentration alone could build: the best org re-staffed with the 3 best AI players
            // of the world / of the user's region (no rating changes, only who plays where).
            const userIds = new Set(save.squad.map((p) => p.id));
            const pool = [...Object.values(save.world.orgs).flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]), ...save.world.freeAgentIds]
              .filter((id) => !userIds.has(id))
              .map((id) => playerViewById(id, ctx))
              .filter((v) => v !== null)
              .map((v) => v!)
              .sort((a, b) => b.overall - a.overall);
            const superOf = (region: Region | null) => {
              const ps = pool.filter((v) => !region || v.region === region).slice(0, 3).map((v) => v.id) as [string, string, string];
              const best = Object.values(save.world.orgs)
                .filter((o) => !region || o.region === region)
                .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
              const world = { ...save.world, orgs: { ...save.world.orgs, [best.ref]: { ...best, playerIds: ps } } };
              return Math.round(orgTeamFor(best.ref, { ...ctx, world }).rating.total * 10) / 10;
            };
            r.superWorld = superOf(null);
            r.superRegion = superOf(save.identity.region);
            r.top3Ovr = pool.slice(0, 3).map((v) => v.overall);
            const fresh = (save.endless?.projects ?? []).filter((p) => p.season === save.clock.seasonIndex);
            r.projects = fresh.length;
            r.projectLift = fresh.map((p) => `${p.region}:${p.ratingBefore}>${p.ratingAfter}`);
            r.gap = save.endless?.gap;
            r.strength = save.endless?.strength ?? 0;
            r.userStreak = save.endless?.streak?.ref === "user" ? save.endless.streak.titles : 0;
          },
        });
        } catch (e) {
          if (dumped) {
            console.log(`dumped ${fileOf(env.EP_DUMP!)}`);
            continue;
          }
          throw e;
        }
        for (const s of res.seasons) {
          const r = row(s.seasonIndex);
          r.rating = s.teamRating;
          r.worlds = s.worlds;
        }
        const c = { region, difficulty, seed, ended: res.ended, ms: res.ms, rows: [...rows.values()].sort((a, b) => a.season - b.season) };
        out.push(c);
        if (env.EP_OUT) writeFileSync(env.EP_OUT, JSON.stringify(out));
        console.log(
          `${region}/${difficulty}/${seed} ended=${c.ended} ${Math.round(c.ms / 1000)}s ` +
            c.rows.map((x) => `S${x.season}:${x.rating}${x.worlds === "champion" ? "W" : ""}`).join(" "),
        );
      }
  if (env.EP_OUT) writeFileSync(env.EP_OUT, JSON.stringify(out));
});
