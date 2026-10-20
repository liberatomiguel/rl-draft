import { describe, expect, it } from "vitest";
import { CAREER_ACHIEVEMENTS } from "@/data/career/achievements";
import type { CareerSave } from "./types";
import {
  ACH_FLAGS,
  EMPTY_ACHIEVEMENT_MEMORY,
  evaluateCareerAchievements,
  worldsWonOnAfter,
} from "./achievements";

function fakeSave(
  over: {
    difficulty?: CareerSave["difficulty"];
    reputation?: number;
    clock?: CareerSave["clock"];
    flags?: Record<string, unknown>;
    stats?: Partial<CareerSave["stats"]>;
  } = {},
): CareerSave {
  const stats = {
    seriesWins: 0, seriesLosses: 0, gameWins: 0, gameLosses: 0, goalsFor: 0, goalsAgainst: 0,
    titlesT3: 0, titlesT2: 0, titlesRegional: 0, titlesMajor: 0, titlesWorlds: 0,
    majorsQualified: 0, worldsQualified: 0, totalPrize: 0, biggestSigningFee: 0, biggestWinName: null,
    ...(over.stats ?? {}),
  };
  return {
    difficulty: over.difficulty ?? "normal",
    reputation: over.reputation ?? 5,
    clock: over.clock ?? { seasonIndex: 0, day: 1 },
    flags: (over.flags ?? {}) as Record<string, boolean>,
    stats,
  } as unknown as CareerSave;
}

describe("career achievements (R32)", () => {
  it("catalog ids are unique and every id has a condition", () => {
    const ids = new Set(CAREER_ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(CAREER_ACHIEVEMENTS.length);
    expect(CAREER_ACHIEVEMENTS.every((a) => a.xp > 0)).toBe(true);
  });

  it("unlocks from flags, stats, reputation and season, once each", () => {
    const save = fakeSave({
      flags: { [ACH_FLAGS.sponsorSigned]: true, [ACH_FLAGS.qualifierAdvanced]: true },
      reputation: 55,
      clock: { seasonIndex: 2, day: 1 },
      stats: { titlesRegional: 1, majorsQualified: 1 },
    });
    const fresh = evaluateCareerAchievements(save, EMPTY_ACHIEVEMENT_MEMORY);
    expect(fresh).toEqual([
      "car-first-sponsor", "car-first-qualifier", "car-rep-50", "car-three-seasons", "car-major-qualified", "car-first-regional",
    ]);
    const memory = { ...EMPTY_ACHIEVEMENT_MEMORY, unlocked: Object.fromEntries(fresh.map((id) => [id, 1])) };
    expect(evaluateCareerAchievements(save, memory)).toEqual([]);
  });

  it("Worlds context: underdog, homegrown, dynasty, every road", () => {
    // rc.4: Underdog = a regional / Major / Worlds title won 3+ overall below the field.
    const base = fakeSave({ difficulty: "hard", stats: { titlesWorlds: 1 }, flags: { [ACH_FLAGS.underdogGap]: 3.4, [ACH_FLAGS.worldsHomegrown]: true } });
    const fresh = evaluateCareerAchievements(base, EMPTY_ACHIEVEMENT_MEMORY);
    expect(fresh).toContain("car-first-worlds");
    expect(fresh).toContain("car-worlds-underdog");
    expect(fresh).toContain("car-worlds-homegrown");
    expect(fresh).not.toContain("car-three-worlds");
    expect(fresh).not.toContain("car-all-difficulties");
    const strong = fakeSave({ stats: { titlesWorlds: 3 }, flags: { [ACH_FLAGS.underdogGap]: 2.9 } });
    const fresh2 = evaluateCareerAchievements(strong, EMPTY_ACHIEVEMENT_MEMORY);
    expect(fresh2).toContain("car-three-worlds");
    expect(fresh2).not.toContain("car-worlds-underdog");
    // Every road: the memory remembers difficulties across saves.
    const memory = { unlocked: {}, worldsWonOn: { easy: true as const, normal: true as const } };
    expect(worldsWonOnAfter(base, memory)).toEqual({ easy: true, normal: true, hard: true });
    expect(evaluateCareerAchievements(base, { ...memory, worldsWonOn: worldsWonOnAfter(base, memory) })).toContain("car-all-difficulties");
    expect(evaluateCareerAchievements(base, memory)).not.toContain("car-all-difficulties");
  });
});
