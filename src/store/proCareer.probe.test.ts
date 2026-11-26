/**
 * v2.2 Pro spine round 2 (PROSPINE) — the whole-career probe (opt-in:
 * PRO_CAREER=1). A Pro from 13 to retirement through the real flows, every
 * series played game by game (with the Matchday flags on), org moves,
 * benching, free agency, the dataset's end and the endless seasons. A
 * stability run, not the calibration. Fails on a throw, a day where Advance
 * does nothing, a season that does not close, pro:self on two rosters, or a
 * card that does not round-trip.
 *
 *   NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 \
 *   NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 NEXT_PUBLIC_PRO_CAREER=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 NEXT_PUBLIC_BOARD=1 NEXT_PUBLIC_REAL_ORG_START=1 PRO_CAREER=1 \
 *   PRO_CAREER_RUNS=NA:normal,EU:normal,SAM:normal,NA:hard npx vitest run src/store/proCareer.probe.test.ts
 */
import { describe, expect, it } from "vitest";
import { ageOf } from "@/engine/career/development";
import { decodeCard } from "@/engine/career/pro/card";
import { proOverall } from "@/engine/career/pro/attrs";
import { proRosterCount } from "@/engine/career/pro/offers";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playProBot } from "./proBot";
import { hostOf, proCardHrefOf, proCardOf } from "./proFlow";

const env = process.env;
const ON = env.PRO_CAREER === "1";
const RUNS = (env.PRO_CAREER_RUNS ?? "NA:normal,EU:normal,SAM:normal,NA:hard").split(",").map((r) => r.split(":") as [Region, CareerDifficulty]);
const SEASONS = Number(env.PRO_CAREER_SEASONS ?? 24);

describe.skipIf(!ON)("PROSPINE whole-career probe", () => {
  it("13 to retirement: no throw, no stuck day, every season closes, the card round-trips", () => {
    const problems: string[] = [];
    for (const [region, difficulty] of RUNS) {
      // A seed per region and difficulty (NA and EU shared one: region.length was the only region term).
      const seed = 4040 + [...region].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 0) % 997 + difficulty.length * 7;
      const t0 = Date.now();
      let peak = 0;
      let peakAge = 0;
      let worlds = new Set<string>();
      let doubled = 0;
      let lastSeason = 0;
      try {
        const run = playProBot({
          region,
          difficulty,
          seed,
          seasons: SEASONS,
          counter: true,
          onDay: (s) => {
            const o = proOverall(s.player.attrs);
            if (o > peak) {
              peak = o;
              peakAge = ageOf(s.player.birthYear, s.clock.seasonIndex);
            }
            const host = hostOf(s)!;
            const onSeat = host.squad.filter((p) => p.id === "pro:self").length;
            if (proRosterCount(s.world) + (s.orgShell ? onSeat : 0) > 1 || onSeat > 1) doubled += 1;
            const ev = host.activeEvent;
            if (ev?.def.tier === "worlds" && ev.fieldedIds?.includes("pro:self")) worlds.add(ev.def.id);
            lastSeason = s.clock.seasonIndex;
          },
        });
        const save = run.save;
        const card = decodeCard(proCardHrefOf(save).split("#")[1]);
        const starterSeasons = save.history.filter((h) => h.role === "starter").length;
        const line = `${region} ${difficulty} seed ${seed}: retired=${save.stage === "retired"} at ${ageOf(save.player.birthYear, save.clock.seasonIndex)} after S${lastSeason}; firstOrg age ${run.firstOrgAge ?? "-"}; starter seasons ${starterSeasons}; peak ${peak.toFixed(1)} at ${peakAge}; Worlds played ${worlds.size}; titles ${(save.careerTitles ?? []).length}; honours ${save.honors.length}; nickname ${save.player.nickname ?? "-"}; seasons ${save.history.length}; stages ${run.stages.length}; ${Math.round((Date.now() - t0) / 1000)}s`;
        console.log(line);
        if (run.stuck.length) problems.push(`${region} ${difficulty}: stuck ${run.stuck.join(" | ")}`);
        if (doubled) problems.push(`${region} ${difficulty}: pro:self on two rosters on ${doubled} steps`);
        if (save.stage !== "retired") problems.push(`${region} ${difficulty}: never retired (S${save.clock.seasonIndex})`);
        if (save.history.length !== new Set(save.history.map((h) => h.seasonIndex)).size) problems.push(`${region} ${difficulty}: a season booked twice`);
        if (save.stage === "retired" && save.history.length < save.clock.seasonIndex) problems.push(`${region} ${difficulty}: ${save.clock.seasonIndex - save.history.length} seasons without a line`);
        if (!card || JSON.stringify(card) !== JSON.stringify(proCardOf(save))) problems.push(`${region} ${difficulty}: the card does not round-trip`);
        worlds = new Set();
      } catch (e) {
        problems.push(`${region} ${difficulty}: throws ${(e as Error).message}\n${(e as Error).stack?.split("\n").slice(1, 6).join("\n")}`);
      }
    }
    for (const p of problems) console.log(`   ! ${p}`);
    expect(problems).toEqual([]);
  }, 7_200_000);
});
