/**
 * rc.36 (ROADMAP UX-05, DESIGN-DECISIONS #155): Road to Worlds' achievements
 * in the general list — one source per id, one record of what is unlocked,
 * permanent across saves and Season resets, never granted twice.
 */

import { describe, expect, it } from "vitest";
import { achievements as draftAchievements } from "@/data/catalog";
import { CAREER_ACHIEVEMENTS } from "@/data/career/achievements";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { PRESEASON_ID } from "@/config/season";
import { normalizeToSeason } from "@/engine/season";
import { EMPTY_ACHIEVEMENT_MEMORY, marksMissingFrom, withProfileMarks } from "./achievements";

describe("UX-05 — one source per id", () => {
  it("career ids are unique and never collide with the draft game's", () => {
    const career = CAREER_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(career).size).toBe(career.length);
    const draft = new Set(draftAchievements.map((a) => a.id));
    expect(career.filter((id) => draft.has(id))).toEqual([]);
  });

  it("every career id has its words in EN and PT — in the core copy only", () => {
    const ids = CAREER_ACHIEVEMENTS.map((a) => a.id).sort();
    for (const dict of [EN.ACH_UI.careerItems, PT.ACH_UI.careerItems]) {
      expect(Object.keys(dict).sort()).toEqual(ids);
      for (const id of ids) {
        expect(dict[id].name.trim().length).toBeGreaterThan(0);
        expect(dict[id].desc.trim().length).toBeGreaterThan(0);
      }
    }
    // No second copy of the words in the career dictionaries.
    expect("items" in CAREER_EN.achievements).toBe(false);
    expect("items" in CAREER_PT.achievements).toBe(false);
    for (const m of ["all", "draft", "career"]) {
      expect(EN.ACH_UI.modes[m]).toBeTruthy();
      expect(PT.ACH_UI.modes[m]).toBeTruthy();
    }
  });
});

describe("UX-05 — one record of what is unlocked", () => {
  it("the profile's marks join the memory silently, dated, unknown ids ignored", () => {
    const memory = withProfileMarks(EMPTY_ACHIEVEMENT_MEMORY, ["car-first-sponsor", "not-an-achievement"], 42);
    expect(memory.unlocked).toEqual({ "car-first-sponsor": 42 });
    // Already known: the same object back (nothing to persist).
    expect(withProfileMarks(memory, ["car-first-sponsor"], 99)).toBe(memory);
  });

  it("the memory's ids the profile lacks are mirrored back, in catalog order", () => {
    const memory = { unlocked: { "car-rep-50": 1, "car-first-sponsor": 2 }, worldsWonOn: {} };
    expect(marksMissingFrom(memory, ["car-rep-50"])).toEqual(["car-first-sponsor"]);
    expect(marksMissingFrom(memory, ["car-rep-50", "car-first-sponsor"])).toEqual([]);
  });

  it("a Season reset keeps the career marks (only the season's xp, rating and Challenges reset)", () => {
    const before = {
      xp: 1234,
      mmr: 1100,
      challengesCompleted: { a: "x" },
      challengeStars: { a: 1 },
      season: { id: PRESEASON_ID, startedAt: "2026-01-01", peakMmr: 0, peakRankId: "bronze-1", runs: 0, titles: 0, ratingHistory: [] },
      lifetime: { xp: 1234 },
      legacy: { preseason: null },
      careerMarks: ["car-first-sponsor", "car-first-worlds"],
      achievements: { "ach-first-team": "2026-01-01" },
      runsCompleted: 3,
      wins: { easy: 0, normal: 1, hard: 0, legacy: 0 },
    };
    const after = normalizeToSeason(before as unknown as Parameters<typeof normalizeToSeason>[0]) as unknown as typeof before;
    expect(after.xp).toBe(0);
    expect(after.careerMarks).toEqual(["car-first-sponsor", "car-first-worlds"]);
    expect(after.achievements).toEqual({ "ach-first-team": "2026-01-01" });
  });
});
