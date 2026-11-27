/**
 * rc.6 (R172): every season goal with a count above one says its count, in
 * EN and PT, in both the founded words (C.goals.season) and the established
 * board's words with the season's total (C.goals.seasonTotal). The stretch
 * "Win 2 Majors" used to read "Win a Major" (0/2).
 */
import { describe, expect, it } from "vitest";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { goalTotalOf } from "@/engine/career/board";
import { SEASON_GOAL_CANDIDATES } from "@/engine/career/seasonGoals";

const counted = SEASON_GOAL_CANDIDATES.filter((g) => g.count > 1);

describe("goal words carry their count", () => {
  for (const [lang, C] of [["en", CAREER_EN], ["pt", CAREER_PT]] as const) {
    it(`${lang}: C.goals.season and C.goals.seasonTotal name every count above one`, () => {
      expect(counted.length).toBeGreaterThan(10);
      for (const g of counted) {
        const place = g.place ?? 0;
        const total = goalTotalOf(g.kind);
        const season = C.goals.season(g.kind, g.count, place);
        const withTotal = C.goals.seasonTotal(g.kind, g.count, place, total);
        const tag = `${lang} ${g.kind}:${g.count}:${place}`;
        expect(season, tag).not.toBe("");
        // "all three Majors" names the count in words; every other one says it as a figure.
        if (!(g.kind === "majorQualify" && g.count === 3)) expect(season, tag).toContain(String(g.count));
        // Cups carry no total: an established board never asks for one (R166), and the cups a season holds vary.
        if (g.kind !== "cupFinal" && g.kind !== "cupWin") expect(withTotal, tag).toContain(String(total));
        if (g.count < total || g.kind === "cupFinal" || g.kind === "cupWin") expect(withTotal, tag).toContain(String(g.count));
      }
    });
  }

  it("the stretch of a 'win a Major' plan reads as two titles", () => {
    expect(CAREER_EN.goals.season("majorFinish", 2, 1)).toBe("Win 2 Majors");
    expect(CAREER_PT.goals.season("majorFinish", 2, 1)).toBe("Vença 2 Majors");
    expect(CAREER_PT.goals.seasonTotal("majorFinish", 2, 1, 3)).toBe("Vença 2 dos 3 Majors");
  });
});
