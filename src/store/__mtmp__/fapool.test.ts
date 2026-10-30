import { it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import { isCompetitiveAge, playerViewById } from "@/engine/career/development";
import { signableOverallCap } from "@/engine/career/economy";
import { listingFor } from "@/engine/career/market";
import { agePassAndIntake, buildWorldAtCreation, worldGrowthWeek } from "@/engine/career/worldSim";
import type { WorldState } from "@/engine/career/types";
import type { Region } from "@/engine/types";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

it("free-agent pool by season", { timeout: 600_000 }, () => {
  const seeds = [9100, 17019, 31337];
  const lines: string[] = [];
  const agg = new Map<number, { pool80: number[]; list80: number[]; pool85: number[]; list85: number[]; total: number[]; young80: number[] }>();
  for (const seed of seeds) {
    let world: WorldState = buildWorldAtCreation(seed);
    for (let s = 0; s <= 5; s++) {
      const ctx = { careerSeed: seed, seasonIndex: s, world };
      const listing = listingFor({ world, squadIds: [], seasonIndex: s, careerSeed: seed, signableCap: signableOverallCap(30), freeAgentsOnly: true });
      const listed = new Set(listing.freeAgents.map((v) => v.id));
      const a = agg.get(s) ?? { pool80: [], list80: [], pool85: [], list85: [], total: [], young80: [] };
      for (const region of REGIONS) {
        let p80 = 0, l80 = 0, p85 = 0, l85 = 0, tot = 0, y80 = 0;
        for (const id of world.freeAgentIds) {
          const v = playerViewById(id, ctx);
          if (!v || v.region !== region || !isCompetitiveAge(v.age)) continue;
          tot++;
          if (v.potential >= 80 && v.potential <= 89 && v.potential - v.overall >= 3) {
            p80++;
            if (listed.has(id)) l80++;
            if (v.age <= 19) y80++;
          }
          if (v.potential >= 85 && v.potential - v.overall >= 3) {
            p85++;
            if (listed.has(id)) l85++;
          }
        }
        a.pool80.push(p80); a.list80.push(l80); a.pool85.push(p85); a.list85.push(l85); a.total.push(tot); a.young80.push(y80);
      }
      agg.set(s, a);
      // a season: 32 weeks of growth, then the rollover
      for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) world = worldGrowthWeek(world, { seasonIndex: s, week: w, careerSeed: seed, userSquadIds: [] });
      world = agePassAndIntake(world, s + 1, seed, [], s + 1 >= 6).world;
    }
  }
  const mean = (xs: number[]) => (xs.reduce((x, y) => x + y, 0) / xs.length).toFixed(1);
  const min = (xs: number[]) => Math.min(...xs);
  for (const [s, a] of [...agg.entries()].sort((x, y) => x[0] - y[0])) {
    lines.push(`S${s}: per region mean (min) — FAs ${mean(a.total)} · pot 80–89 with room ≥3: pool ${mean(a.pool80)} (${min(a.pool80)}), listed ${mean(a.list80)} (${min(a.list80)}), aged ≤19 ${mean(a.young80)} · pot 85+: pool ${mean(a.pool85)} (${min(a.pool85)}), listed ${mean(a.list85)} (${min(a.list85)})`);
  }
  console.log(lines.join("\n"));
});
