import { describe, expect, it } from "vitest";
import { lineupById } from "@/data";
import { generateDailyConfig, seedFromDate } from "./daily";

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
});
