import { describe, expect, it } from "vitest";
import { lineupById } from "@/data";
import { generateDailyConfig, viablePool } from "./daily";
import { dailyInfo, LOCKDOWN_REGIONS, seedFromDate, type DailyPool } from "./dailyPlan";

describe("daily challenge generator", () => {
  it("is deterministic for a given date", () => {
    const a = generateDailyConfig("2026-06-12");
    const b = generateDailyConfig("2026-06-12");
    expect(a).toEqual(b);
    expect(seedFromDate("2026-06-12")).toBe(seedFromDate("2026-06-12"));
  });

  it("varies across dates", () => {
    const labels = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const date = `2026-07-${String(day).padStart(2, "0")}`;
      labels.add(generateDailyConfig(date).info.label.split(":")[0]);
    }
    // The template wheel should produce several distinct challenge types
    // over a month.
    expect(labels.size).toBeGreaterThanOrEqual(4);
  });

  it("authored daily (2026-06-17) is the featured specials challenge", () => {
    const a = generateDailyConfig("2026-06-17");
    const b = generateDailyConfig("2026-06-17");
    expect(a).toEqual(b); // deterministic override
    expect(a.difficulty).toBe("hard");
    expect(a.hiddenOverall).toBe(false); // overalls visible to show off the specials
    expect(a.info.label).toBe("Loaded Draft");
    // Scripted draft: al0t special on pick 2, violentpanda legend on pick 5.
    expect(a.scriptedLineups).toHaveLength(6);
    expect(a.scriptedLineups?.[1].special?.specialId).toBe("sp-al0t-ceiling-redirect");
    expect(a.scriptedLineups?.[4].special?.specialId).toBe("sp-violentpanda-dignitas-brain");
    // Every scripted lineup must be a real lineup (catches typos).
    for (const step of a.scriptedLineups ?? []) {
      expect(lineupById.has(step.lineupId)).toBe(true);
    }
  });

  it("restricted pools reference real lineups and stay viable", () => {
    for (let day = 1; day <= 28; day++) {
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      const config = generateDailyConfig(date);
      if (config.poolLineupIds) {
        expect(config.poolLineupIds.length).toBeGreaterThanOrEqual(8);
        for (const id of config.poolLineupIds) {
          expect(lineupById.has(id)).toBe(true);
        }
      }
    }
  });

  // The home menu reads `dailyInfo` (no dataset, #60), which takes every pool as
  // viable. If a data change shrank one below a draft, the run would fall back
  // to Pure Bracket while the menu still named the template: fix the data, or
  // give the menu the pool sizes.
  it("every pool a template can ask for is viable, so the menu names the run's challenge", () => {
    const pools: DailyPool[] = [
      ...LOCKDOWN_REGIONS.map((region): DailyPool => ({ kind: "region", region })),
      { kind: "era", era: "old-school" },
      { kind: "era", era: "modern" },
      { kind: "champions" },
    ];
    for (const pool of pools) expect(viablePool(pool), JSON.stringify(pool)).toBe(true);
    const start = Date.parse("2026-06-15T00:00:00Z");
    for (let day = 0; day < 730; day++) {
      const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
      expect(dailyInfo(date), date).toStrictEqual(generateDailyConfig(date).info);
    }
  });
});
