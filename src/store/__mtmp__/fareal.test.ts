import { it, vi } from "vitest";
import { isCompetitiveAge, playerViewById } from "@/engine/career/development";
import { signableOverallCap } from "@/engine/career/economy";
import { listingFor } from "@/engine/career/market";
import type { CareerSave } from "@/engine/career/types";
import type { Region } from "@/engine/types";

const hub: { tap: ((s: CareerSave) => void) | null } = { tap: null };
vi.mock("../careerFlow", async (importOriginal) => {
  const real = await importOriginal<typeof import("../careerFlow")>();
  return {
    ...real,
    advanceDayFlow: (save: CareerSave) => {
      const out = real.advanceDayFlow(save);
      hub.tap?.(out);
      return out;
    },
  };
});

const { playArcCareer } = await import("../careerArcBot");

it("free agents with potential in the 80s through the seasons (a real career)", { timeout: 1_200_000 }, () => {
  const lines: string[] = [];
  const regions = (process.env.FA_REGIONS ?? "EU,SAM,APAC").split(",") as Region[];
  for (const region of regions) {
    const seen = new Set<number>();
    hub.tap = (save) => {
      const s = save.clock.seasonIndex;
      if (save.clock.day !== 2 || seen.has(s)) return;
      seen.add(s);
      const ctx = { careerSeed: save.careerSeed, seasonIndex: s, world: save.world };
      const listing = listingFor({ world: save.world, squadIds: save.squad.map((p) => p.id), seasonIndex: s, careerSeed: save.careerSeed, signableCap: signableOverallCap(save.reputation), freeAgentsOnly: true });
      const listed = new Set(listing.freeAgents.map((v) => v.id));
      let pool = 0, p80 = 0, l80 = 0, p85 = 0, l85 = 0, mine = 0, mine80 = 0, lmine80 = 0;
      for (const id of save.world.freeAgentIds) {
        const v = playerViewById(id, ctx);
        if (!v || !isCompetitiveAge(v.age)) continue;
        pool++;
        const prospect80 = v.potential >= 80 && v.potential - v.overall >= 3;
        if (prospect80) { p80++; if (listed.has(id)) l80++; }
        if (v.potential >= 85 && v.potential - v.overall >= 3) { p85++; if (listed.has(id)) l85++; }
        if (v.region === region) { mine++; if (prospect80) { mine80++; if (listed.has(id)) lmine80++; } }
      }
      lines.push(`${region} S${s}: pool ${pool} (mine ${mine}) · pot 80+ room≥3 ${p80} listed ${l80} · mine ${mine80} listed ${lmine80} · pot 85+ ${p85} listed ${l85} · listing ${listing.freeAgents.length}`);
    };
    playArcCareer({ region, difficulty: "normal", policy: "autopilot", seed: 9100, seasons: Number(process.env.FA_SEASONS ?? 4), budgetMs: 900_000 });
  }
  hub.tap = null;
  console.log(lines.join("\n"));
});
