import { describe, expect, it } from "vitest";
import { CAREER_BOXSCORE as BOX } from "@/config/balance";
import type { KeyMoment, MomentType } from "@/engine/career/boxScore";
import { CAREER_EN } from "./copy.career.en";
import { CAREER_PT } from "./copy.career.pt";
import { momentText } from "./momentText";

const TYPES: MomentType[] = ["overtimeWinner", "comeback", "hatTrick", "cleanSheet", "lateGoal", "saveMarathon", "demoBlitz", "decider"];

describe("key moment text", () => {
  it("every type has every variant in both languages, naming the player", () => {
    for (const copy of [CAREER_EN, CAREER_PT]) {
      for (const type of TYPES) {
        expect(copy.moments[type]).toHaveLength(BOX.momentVariants);
        for (let variant = 0; variant < BOX.momentVariants; variant++) {
          const m: KeyMoment = { type, gameIndex: 1, side: "a", playerIdx: 0, period: "overtime", clock: 83, variant, n: 3 };
          const text = momentText(copy, m, "Ann");
          expect(text).toContain("Ann");
          expect(text).not.toContain("undefined");
        }
      }
    }
  });

  it("an unattributed player reads as a neutral noun and the clock is formatted", () => {
    const m: KeyMoment = { type: "overtimeWinner", gameIndex: 1, side: "a", playerIdx: null, period: "overtime", clock: 83, variant: 0, n: 1 };
    expect(momentText(CAREER_EN, m, undefined)).toBe("A player ends it in overtime at +1:23.");
  });
});
