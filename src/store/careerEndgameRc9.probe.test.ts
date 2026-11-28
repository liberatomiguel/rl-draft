/**
 * rc9 ENDGAME (opt-in: RC9_ENDGAME=1) — the three cheap checks of the front,
 * one career at a time with the arc bot (observers only, the saves are never
 * changed). Per season, at its end:
 *  - coaches: AI orgs whose coach took over this season, by region; the
 *    user's coach (announce / retire mails); the coach market per region
 *    (shortlist by source, best quality, dataset coaches still on it);
 *  - formats: the layout of each Major / Worlds the calendar scheduled, and
 *    the layout of the ones the user played;
 *  - the field: Worlds participants by kind (real org, generated filler, M1's
 *    new org, Local side, user) and the top 8 of the season's points race in
 *    NA, EU and SAM by kind.
 *
 *   RC9_ENDGAME=1 RC9_REGION=NA RC9_SEED=9100 RC9_SEASONS=12 RC9_OUT=x.json \
 *     NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_EVENT_FORMATS=1 ... npx vitest run src/store/careerEndgameRc9.probe.test.ts
 *   RC9_POLICY (default strong), RC9_DIFF (default normal), RC9_FROM (resume
 *   is not supported: one career per process, so the heavy lock stays short).
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { CAREER_WORLD_LIFE, FEATURES } from "@/config/balance";
import { officialEventDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { isLocalRef } from "@/engine/career/localScene";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";
import { coachCandidatesFor } from "./careerFlow";

const env = process.env;
const ALL: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
type Kind = "real" | "filler" | "newOrg" | "local" | "user";
const kindOf = (ref: string): Kind => {
  if (ref === "user") return "user";
  if (isLocalRef(ref)) return "local";
  if (ref.startsWith("fill:")) return Number(ref.split(":")[2]) >= 100 ? "newOrg" : "filler";
  return "real";
};
const kinds = (refs: string[]) => {
  const k: Record<Kind, number> = { real: 0, filler: 0, newOrg: 0, local: 0, user: 0 };
  for (const r of refs) k[kindOf(r)] += 1;
  return k;
};

export interface Rc9Row {
  season: number;
  rating: number;
  coachNew: Partial<Record<Region, number>>;
  coachMean: Partial<Record<Region, number>>;
  market: Partial<Record<Region, { n: number; staff: number; real: number; gen: number; best: number }>>;
  userCoach: string;
  layouts: string[];
  userLayouts: string[];
  worlds: Record<Kind, number> | null;
  top8: Partial<Record<Region, Record<Kind, number>>>;
}

it.runIf(env.RC9_ENDGAME === "1")("rc9 endgame probe", { timeout: 3_600_000 }, () => {
  const region = (env.RC9_REGION ?? "NA") as Region;
  const seed = Number(env.RC9_SEED ?? 9100);
  const seasons = Number(env.RC9_SEASONS ?? 12);
  const difficulty = (env.RC9_DIFF ?? "normal") as CareerDifficulty;
  const policy = (env.RC9_POLICY ?? "strong") as ArcPolicyId;
  // RC9_COACH_FROM=null: the rc.8 coach life (infinite seasons only), the guard arm's base.
  if (env.RC9_COACH_FROM !== undefined) {
    (CAREER_WORLD_LIFE.coaches as { lifeFromSeasonIndex: number | null }).lifeFromSeasonIndex = env.RC9_COACH_FROM === "null" ? null : Number(env.RC9_COACH_FROM);
  }
  const rows: Rc9Row[] = [];
  const userLayouts = new Map<number, string[]>();
  const seen = new Set<string>();
  const mails: string[] = [];
  const majorWeeks = seasonSchedule().filter((w) => w.kind === "major" || w.kind === "worlds").map((w) => w.week);
  const res = playArcCareer({
    region,
    difficulty,
    policy,
    seed,
    seasons,
    budgetMs: 3_000_000,
    onEvent(save) {
      const a = save.activeEvent;
      if (!a || (a.def.tier !== "major" && a.def.tier !== "worlds")) return;
      const l = a.tournament.layout;
      const list = userLayouts.get(save.clock.seasonIndex) ?? [];
      list.push(`${a.def.tier}:${l ? `${l.stage}/${l.bracket}` : "classic"}`);
      userLayouts.set(save.clock.seasonIndex, list);
    },
    onSeason(moment, save: CareerSave) {
      // RC9_DUMP=prefix: the save at season RC9_DUMP_AT's start (default 6), named as the endless probe's EP_FROM reads it.
      if (moment === "start" && env.RC9_DUMP && save.clock.seasonIndex === Number(env.RC9_DUMP_AT ?? 6)) {
        writeFileSync(`${env.RC9_DUMP}-${region}-${difficulty}-${seed}.json`, JSON.stringify(save));
      }
      if (moment !== "end") return;
      const s = save.clock.seasonIndex;
      for (const m of save.mail) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        if (m.titleKey === "coachRetireAnnounce" || m.titleKey === "coachRetired") mails.push(`S${s}:${m.titleKey}`);
      }
      const coachNew: Rc9Row["coachNew"] = {};
      const coachMean: Rc9Row["coachMean"] = {};
      const market: Rc9Row["market"] = {};
      for (const r of ALL) {
        const orgs = Object.values(save.world.orgs).filter((o) => o.region === r && o.coachOverall !== undefined);
        coachNew[r] = orgs.filter((o) => o.coachSince === s).length;
        coachMean[r] = Math.round((orgs.reduce((n, o) => n + (o.coachOverall ?? 0), 0) / Math.max(1, orgs.length)) * 10) / 10;
        const c = coachCandidatesFor({ ...save, identity: { ...save.identity, region: r } });
        market[r] = {
          n: c.length,
          staff: c.filter((x) => x.source === "dataset").length,
          real: c.filter((x) => x.source === "real").length,
          gen: c.filter((x) => x.source === "generated").length,
          best: Math.max(0, ...c.map((x) => x.overall)),
        };
      }
      const layouts = majorWeeks.flatMap((w) => officialEventDefsForWeek(s, w)).map((d) => `${d.tier}:${d.layout ? `${d.layout.stage}/${d.layout.bracket}` : "classic"}`);
      const w = save.eventResults.find((e) => e.seasonIndex === s && e.tier === "worlds");
      const top8: Rc9Row["top8"] = {};
      for (const r of ["NA", "EU", "SAM"] as Region[]) {
        const pts = save.competition.seasonPoints[r] ?? {};
        const refs = Object.entries(pts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([ref]) => ref);
        top8[r] = kinds(refs);
      }
      rows.push({
        season: s,
        rating: 0,
        coachNew,
        coachMean,
        market,
        userCoach: save.coach ? `${save.coach.id}@${save.coach.age ?? "?"}${save.coach.retiresAfterSeason !== undefined ? "!" : ""}` : "-",
        layouts,
        userLayouts: userLayouts.get(s) ?? [],
        worlds: w ? kinds(w.rows.map((x) => x.ref)) : null,
        top8,
      });
    },
  });
  for (const s of res.seasons) {
    const r = rows.find((x) => x.season === s.seasonIndex);
    if (r)
      Object.assign(r, {
        rating: s.teamRating,
        balance: s.balanceEnd,
        payroll: s.payrollPerSplit,
        income: s.income,
        spend: s.spend,
        worldsPlace: s.worlds,
        titles: s.titles,
        regionRank: s.regionRank,
        majorsQualified: s.majorsQualified,
      });
  }
  const out = { region, seed, difficulty, policy, worldLife: FEATURES.worldLife, eventFormats: (FEATURES as Record<string, unknown>).eventFormats, ended: res.ended, softlock: Boolean(res.softlock), ms: res.ms, mails, rows };
  if (env.RC9_OUT) writeFileSync(env.RC9_OUT, JSON.stringify(out));
  console.log(`${region}/${seed} ended=${res.ended} softlock=${out.softlock} ${Math.round(res.ms / 1000)}s mails=${mails.join(",")}`);
});
