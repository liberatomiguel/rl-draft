/**
 * v2.2 PROQA: opt-in fixture dump (PRO_QA_DUMP=1). Plays the spine's bot and
 * writes the persisted Pro store JSON at three points to public/qa-fixtures/
 * (git-ignored, deleted after the browser pass): just signed at 17+, at an org
 * at 22+ with honours, and the season before retirement.
 *
 *   NEXT_PUBLIC_MATCHDAY_STYLES=1 NEXT_PUBLIC_WORLD_LIFE=1 NEXT_PUBLIC_MATCHDAY_DECISIONS=1 \
 *   NEXT_PUBLIC_MATCHDAY_BOXSCORE=1 NEXT_PUBLIC_PRO_CAREER=1 NEXT_PUBLIC_ENDLESS_VARIETY=1 PRO_QA_DUMP=1 \
 *   npx vitest run src/store/proQaFixtures.probe.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ageOf } from "@/engine/career/development";
import type { ProSave } from "@/engine/career/pro/types";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playProBot } from "./proBot";

const ON = process.env.PRO_QA_DUMP === "1";
const REGION = (process.env.PRO_QA_REGION ?? "SAM") as Region;
const DIFF = (process.env.PRO_QA_DIFF ?? "normal") as CareerDifficulty;
const SEED = Number(process.env.PRO_QA_SEED ?? 4040 + REGION.length * 17 + DIFF.length);

const wrap = (s: ProSave) => JSON.stringify({ state: { slots: [s, null, null], activeSlot: 0 }, version: 1 });

describe.skipIf(!ON)("PROQA fixtures", () => {
  it("dumps three saves", () => {
    mkdirSync("public/qa-fixtures", { recursive: true });
    // Pass 1: when does he retire?
    const first = playProBot({ region: REGION, difficulty: DIFF, seed: SEED, seasons: 24, counter: true });
    const endSeason = first.save.clock.seasonIndex;
    const got: Record<string, ProSave> = {};
    playProBot({
      region: REGION,
      difficulty: DIFF,
      seed: SEED,
      seasons: 24,
      counter: true,
      onDay: (s) => {
        const age = ageOf(s.player.birthYear, s.clock.seasonIndex);
        if (!got.a && age >= 17 && s.stage === "org") got.a = structuredClone(s);
        if (!got.b && age >= 22 && s.stage === "org" && s.clock.day > 20) got.b = structuredClone(s);
        if (!got.c && s.clock.seasonIndex === endSeason - 1 && s.clock.day > 20) got.c = structuredClone(s);
      },
    });
    for (const k of ["a", "b", "c"]) if (got[k]) writeFileSync(`public/qa-fixtures/${k}.json`, wrap(got[k]));
    console.log("QA dump", { SEED, endSeason, a: !!got.a, b: !!got.b, c: !!got.c, ages: Object.fromEntries(Object.entries(got).map(([k, s]) => [k, ageOf(s.player.birthYear, s.clock.seasonIndex)])) });
    expect(got.a).toBeTruthy();
  }, 600000);
});
