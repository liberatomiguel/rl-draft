/**
 * v2.0 (C2): a migrating veteran is credited with the rank they HELD in the
 * pre-season, not with their old XP read against the longer Season curve.
 */
import { describe, expect, it } from "vitest";
import { evaluateCounterAchievements } from "@/engine/counterAchievements";
import { backfillRankId } from "./profileStore";

describe("backfillRankId", () => {
  it("judges a pre-season save by the frozen pre-season ladder", () => {
    expect(backfillRankId(true, 60_000, undefined)).toBe("supersonic-legend");
    expect(backfillRankId(true, 15_000, undefined)).toBe("diamond");
    expect(backfillRankId(true, 8_500, undefined)).toBe("platinum");
  });

  it("judges a Season save by the Season curve", () => {
    expect(backfillRankId(false, 60_000, undefined)).toBe("platinum");
    expect(backfillRankId(false, 75_000, undefined)).toBe("diamond");
  });

  it("never reads below the archived pre-season rank", () => {
    expect(backfillRankId(false, 0, "champion")).toBe("champion");
    expect(backfillRankId(false, 400_000, "bronze")).toBe("grand-champion");
  });

  it("a pre-season Diamond earns Diamond Standard, not the higher rank achievements", () => {
    const ids = evaluateCounterAchievements(
      { runsCompleted: 0, titlesTotal: 0, legacyTitles: 0, gamesWon: 0, goalsScored: 0, specialsOwned: 0, totalSpecials: 80, specialIds: new Set(), dailyStreak: 0, rankId: backfillRankId(true, 20_000, undefined) },
      new Set(),
    );
    expect(ids).toContain("ach-rank-diamond");
    expect(ids).not.toContain("ach-rank-champion");
  });
});
