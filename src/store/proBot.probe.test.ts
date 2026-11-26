/**
 * v2.2 Pro spine (PROSPINE) — the Pro bot probe (opt-in: PRO_BOT=1). Whole
 * careers through the real flows: an amateur year, then an org, then two
 * org seasons, in each region asked. Fails on a throw or a soft lock (a day
 * where Advance does nothing) and on pro:self on two rosters.
 *
 *   NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 \
 *   NEXT_PUBLIC_PRO_CAREER=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 NEXT_PUBLIC_BOARD=1 NEXT_PUBLIC_REAL_ORG_START=1 \
 *   PRO_BOT=1 PRO_BOT_REGIONS=NA,EU,SAM PRO_BOT_SEASONS=4 npx vitest run src/store/proBot.probe.test.ts
 */
import { describe, expect, it } from "vitest";
import { proOverall } from "@/engine/career/pro/attrs";
import { proRosterCount } from "@/engine/career/pro/offers";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playProBot, proBotSummary } from "./proBot";

const env = process.env;
const ON = env.PRO_BOT === "1";
const REGIONS = (env.PRO_BOT_REGIONS ?? "NA,EU,SAM").split(",") as Region[];
const DIFFS = (env.PRO_BOT_DIFFS ?? "normal").split(",") as CareerDifficulty[];
const SEASONS = Number(env.PRO_BOT_SEASONS ?? 4);
const SEEDS = Number(env.PRO_BOT_SEEDS ?? 1);

describe.skipIf(!ON)("PROSPINE Pro bot probe", () => {
  it("whole Pro careers: no throw, no soft lock, one roster at most", () => {
    const problems: string[] = [];
    for (const region of REGIONS)
      for (const difficulty of DIFFS)
        for (let k = 0; k < SEEDS; k++) {
          const seed = 31337 + k * 7919;
          const t0 = Date.now();
          let dup = 0;
          let orgSeasons = 0;
          let seriesAtOrg = 0;
          const seasonsSeen = new Set<number>();
          try {
            const run = playProBot({
              region, difficulty, seed, seasons: SEASONS, counter: true,
              onDay: (s) => {
                if (proRosterCount(s.world) > 1) dup += 1;
                if (s.stage === "org" && !seasonsSeen.has(s.clock.seasonIndex)) { seasonsSeen.add(s.clock.seasonIndex); orgSeasons += 1; }
                if (s.stage === "org" && s.report && s.report.day === s.clock.day && s.report.series.some((x) => x.rating !== null)) seriesAtOrg += 1;
              },
            });
            const line = `${region} ${difficulty} seed ${seed}: ${proBotSummary(run)} orgSeasons=${orgSeasons} orgReportDays=${seriesAtOrg} hist=${run.save.history.map((h) => `${h.age}y:${h.overallEnd.toFixed(0)}/${h.series}s/${h.avgRating ?? "-"}`).join(",")} ${Math.round((Date.now() - t0) / 1000)}s`;
            console.log(line);
            if (run.stuck.length) problems.push(`${region}: stuck ${run.stuck.join(" | ")}`);
            if (dup) problems.push(`${region}: pro:self on two rosters on ${dup} days`);
            void proOverall;
          } catch (e) {
            problems.push(`${region}: throws ${(e as Error).message}\n${(e as Error).stack?.split("\n").slice(1, 6).join("\n")}`);
          }
        }
    for (const p of problems) console.log(`   ! ${p}`);
    expect(problems).toEqual([]);
  }, 7_200_000);
});
