import { describe, expect, it } from "vitest";
import { achievements, playerById, playerCardById, playerCards } from "@/data";
import {
  evaluateCounterAchievements,
  teamAchievements,
  type CounterSnapshot,
} from "./achievements";
import type { ChemistryResult, Roster, RosterPick } from "./types";

const earnedNone = new Set<string>();
const chem = (over: Partial<ChemistryResult> = {}): ChemistryResult => ({
  raw: 0,
  max: 1,
  percent: 0,
  tier: "Poor",
  items: [],
  ...over,
});
const pick = (refId: string): RosterPick => ({
  slot: "player1",
  kind: "player",
  refId,
  fromLineupId: playerCardById.get(refId)!.lineupId,
});

describe("achievements — data set", () => {
  it("ships the rebuilt set, each with a group, unique ids", () => {
    expect(achievements.length).toBeGreaterThanOrEqual(50);
    const groups = new Set(achievements.map((a) => a.group));
    expect(groups).toContain("milestone");
    expect(groups).toContain("performance");
    expect(groups).toContain("roster");
    expect(new Set(achievements.map((a) => a.id)).size).toBe(achievements.length);
    expect(achievements.some((a) => a.secret)).toBe(true);
  });
});

describe("teamAchievements", () => {
  it("first-team always; perfect chem + 3 specials when present", () => {
    const roster: Roster = {};
    const ids = teamAchievements(roster, chem(), 0, earnedNone);
    expect(ids).toContain("ach-first-team");
    expect(teamAchievements(roster, chem({ tier: "Perfect" }), 3, earnedNone)).toEqual(
      expect.arrayContaining(["ach-perfect-chem", "ach-three-specials"]),
    );
  });

  it("an all-one-region roster earns that region's achievement", () => {
    // three distinct SAM players
    const sam = [
      ...new Map(
        playerCards
          .filter((c) => playerById.get(c.playerId)?.region === "SAM")
          .map((c) => [c.playerId, c.id]),
      ).values(),
    ].slice(0, 3);
    if (sam.length === 3) {
      const roster: Roster = { player1: pick(sam[0]), player2: pick(sam[1]), player3: pick(sam[2]) };
      expect(teamAchievements(roster, chem(), 0, earnedNone)).toContain("ach-all-sam");
    }
  });
});

describe("evaluateCounterAchievements", () => {
  const base: CounterSnapshot = {
    runsCompleted: 0,
    titlesTotal: 0,
    legacyTitles: 0,
    gamesWon: 0,
    goalsScored: 0,
    specialsOwned: 0,
    totalSpecials: 80,
    specialIds: new Set(),
    dailyStreak: 0,
    rankId: "bronze",
  };

  it("fires counter milestones at the thresholds and not before", () => {
    expect(evaluateCounterAchievements({ ...base, runsCompleted: 9 }, earnedNone)).not.toContain("ach-runs-10");
    expect(evaluateCounterAchievements({ ...base, runsCompleted: 10 }, earnedNone)).toContain("ach-runs-10");
    expect(evaluateCounterAchievements({ ...base, titlesTotal: 5 }, earnedNone)).toContain("ach-titles-5");
    expect(evaluateCounterAchievements({ ...base, goalsScored: 500 }, earnedNone)).toContain("ach-goals-500");
    expect(evaluateCounterAchievements({ ...base, rankId: "supersonic-legend" }, earnedNone)).toContain("ach-ssl");
  });

  it("completionist only when every special is owned; already-earned filtered", () => {
    expect(evaluateCounterAchievements({ ...base, specialsOwned: 79, totalSpecials: 80 }, earnedNone)).not.toContain("ach-specials-all");
    expect(evaluateCounterAchievements({ ...base, specialsOwned: 80, totalSpecials: 80 }, earnedNone)).toContain("ach-specials-all");
    expect(
      evaluateCounterAchievements({ ...base, runsCompleted: 10 }, new Set(["ach-runs-10"])),
    ).not.toContain("ach-runs-10");
  });
});
