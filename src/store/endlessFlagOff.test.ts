/**
 * v2.2 ENDLESS: with FEATURES.endlessVariety off a career is byte for byte the
 * career of the base it was built on (staging rc.6, cfcf1cd). The hashes below
 * were taken by running this same file on that commit: three seasons of the
 * arc bot, the whole save at each season's end.
 */
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const BASE: Record<string, string[]> = {
  "NA:9100": ["253a6ec2", "80862c81", "bf73aae2"],
  "SAM:17019": ["22963bf6", "83cd4ad8", "2d62e841"],
};

describe("endless variety off = the base career", () => {
  it("the flag is off in tests", () => {
    expect((FEATURES as Record<string, unknown>).endlessVariety ?? false).toBe(false);
  });
  for (const key of Object.keys(BASE)) {
    it(`${key}: three seasons hash like the base`, { timeout: 120_000 }, () => {
      const [region, seed] = key.split(":");
      const hashes: string[] = [];
      playArcCareer({
        region: region as CareerSave["identity"]["region"],
        difficulty: "normal",
        policy: "strong",
        seed: Number(seed),
        seasons: 3,
        budgetMs: 110_000,
        onSeason(moment, save) {
          if (moment === "end") hashes.push(fnv(JSON.stringify({ ...save, lastPlayedAt: 0 })));
        },
      });
      if (process.env.ENDLESS_PRINT_BASE === "1") console.log(`BASE ${key} ${JSON.stringify(hashes)}`);
      else expect(hashes).toEqual(BASE[key]);
    });
  }
});
