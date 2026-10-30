import { it } from "vitest";
import { CAREER_SCOUT } from "@/config/balance";
import { exactAgeOf, playerViewById, scoutedBand } from "@/engine/career/development";
import type { CareerPlayerView, ScoutLevel } from "@/engine/career/types";
import { buildWorldAtCreation } from "@/engine/career/worldSim";

it("band honesty", { timeout: 600_000 }, () => {
  const S = CAREER_SCOUT as unknown as Record<string, unknown>;
  const views: { v: CareerPlayerView; seed: number }[] = [];
  for (let k = 0; k < 8; k++) {
    const seed = 1000 + k * 7919;
    const world = buildWorldAtCreation(seed);
    const ids = [...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds];
    for (const id of ids) {
      const v = playerViewById(id, { careerSeed: seed, seasonIndex: 0, world });
      if (v && v.potential - v.overall >= 3) views.push({ v, seed });
    }
  }
  const lines: string[] = [];
  for (const combo of JSON.parse(process.env.BX ?? "[{}]") as Record<string, unknown>[]) {
    const saved: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(combo)) { saved[k] = S[k]; S[k] = val; }
    for (const level of [0, 1, 2] as ScoutLevel[]) {
      const pos = [0, 0, 0, 0, 0, 0, 0];
      let n = 0, width = 0, over = 0;
      for (const { v, seed } of views) {
        const b = scoutedBand(v.potential, v.overall, level, seed, v.id, 2, { arc: { peakAge: v.peakAge, exactAge: exactAgeOf(v.age, 80) } });
        const t = Math.round(v.potential);
        if (t < b.min || t > b.max) continue;
        n++;
        width += b.max - b.min;
        over += b.max - t;
        pos[Math.min(6, b.max - t)]++;
      }
      lines.push(`${JSON.stringify(combo)} L${level}: n ${n} · width mean ${(width / n).toFixed(2)} · top − truth mean ${(over / n).toFixed(2)} · truth at top−0..6: ${pos.map((x) => `${Math.round((100 * x) / n)}%`).join(" ")}`);
    }
    for (const [k, val] of Object.entries(saved)) S[k] = val;
  }
  console.log(lines.join("\n"));
});
