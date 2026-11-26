/**
 * v2.2 PROQA: opt-in fixture dump for the manager career (CAREER_QA_DUMP=1).
 * Plays the arc bot with a floored squad (the endless probe's premise) and
 * writes the persisted career store JSON of a season 8+ save, where the
 * endless front offers its events, to public/qa-fixtures/ (git-ignored).
 *
 *   NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 \
 *   NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 NEXT_PUBLIC_BOARD=1 NEXT_PUBLIC_REAL_ORG_START=1 \
 *   CAREER_QA_DUMP=1 npx vitest run src/store/careerQaFixtures.probe.test.ts --maxWorkers=2
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";

const ON = process.env.CAREER_QA_DUMP === "1";
const FLOOR = 99;
const SEED = 6161;

describe.skipIf(!ON)("career QA fixtures", () => {
  it("dumps endless seasons 8 and 9", () => {
    mkdirSync("public/qa-fixtures", { recursive: true });
    const got: Record<string, CareerSave> = {};
    playArcCareer({
      region: "NA",
      difficulty: "normal",
      policy: "strong",
      seed: SEED,
      seasons: 10,
      budgetMs: 3_000_000,
      onSeason(moment, save) {
        if (save.clock.seasonIndex >= 5 - (moment === "end" ? 1 : 0)) {
          for (const p of save.squad) {
            p.overall = Math.max(p.overall, FLOOR);
            p.potential = Math.max(p.potential, FLOOR);
          }
        }
        if (moment === "start" && (save.clock.seasonIndex === 8 || save.clock.seasonIndex === 9)) got[`e${save.clock.seasonIndex}`] = structuredClone(save);
      },
    });
    for (const [k, s] of Object.entries(got)) writeFileSync(`public/qa-fixtures/${k}.json`, JSON.stringify({ state: { slots: [s, null, null], activeSlot: 0, achievements: {} }, version: 3 }));
    console.log("QA career dump", Object.keys(got));
    expect(Object.keys(got).length).toBeGreaterThan(0);
  }, 3_100_000);
});
