import achievementsJson from "@/data/achievements.json";
import { describe, expect, it } from "vitest";
import { achievements, playerById, playerCardById, playerCards } from "@/data";
import { liveAchievements, teamAchievements } from "./achievements";
import { evaluateCounterAchievements, type CounterSnapshot } from "./counterAchievements";
import type {
  ChemistryResult,
  GameResult,
  Roster,
  RosterPick,
  SeriesResult,
  TournamentState,
} from "./types";

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
    // E1: SAM has a Region-only draft, so its single-region roster is no longer a feat.
    if (sam.length === 3) {
      const roster: Roster = { player1: pick(sam[0]), player2: pick(sam[1]), player3: pick(sam[2]) };
      expect(teamAchievements(roster, chem(), 0, earnedNone).filter((id) => id.startsWith("ach-all-") && id !== "ach-all-champions")).toEqual([]);
    }
    // The two regions without a Region-only draft keep theirs.
    for (const [region, id] of [["SSA", "ach-all-ssa"], ["APAC", "ach-all-apac"]] as const) {
      const three = [
        ...new Map(
          playerCards
            .filter((c) => playerById.get(c.playerId)?.region === region)
            .map((c) => [c.playerId, c.id]),
        ).values(),
      ].slice(0, 3);
      if (three.length === 3) {
        const roster: Roster = { player1: pick(three[0]), player2: pick(three[1]), player3: pick(three[2]) };
        expect(teamAchievements(roster, chem(), 0, earnedNone)).toContain(id);
      }
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

  it("v2.0 tiers: volume, the Season ladder, Season Rating and the Legacy streak", () => {
    const got = (over: Partial<typeof base> & { seasonRating?: number; legacyStreakBest?: number }) =>
      evaluateCounterAchievements({ ...base, ...over }, earnedNone);
    expect(got({ runsCompleted: 499 })).not.toContain("ach-runs-500");
    expect(got({ runsCompleted: 1000 })).toEqual(expect.arrayContaining(["ach-runs-500", "ach-runs-1000"]));
    expect(got({ titlesTotal: 250 })).toEqual(expect.arrayContaining(["ach-titles-100", "ach-titles-250"]));
    expect(got({ legacyTitles: 25 })).toContain("ach-legacy-25");
    expect(got({ rankId: "platinum" })).not.toContain("ach-rank-diamond");
    expect(got({ rankId: "champion" })).toEqual(expect.arrayContaining(["ach-rank-diamond", "ach-rank-champion"]));
    expect(got({ rankId: "champion" })).not.toContain("ach-rank-gc");
    expect(got({ rankId: "supersonic-legend" })).toEqual(expect.arrayContaining(["ach-rank-gc", "ach-ssl"]));
    expect(got({ seasonRating: 999 })).not.toContain("ach-rating-1000");
    expect(got({ seasonRating: 5000 })).toEqual(expect.arrayContaining(["ach-rating-1000", "ach-rating-2500", "ach-rating-5000"]));
    expect(got({})).not.toContain("ach-rating-1000"); // the backfill passes no rating
    expect(got({ legacyStreakBest: 1 })).not.toContain("ach-legacy-streak-2");
    expect(got({ legacyStreakBest: 2 })).toContain("ach-legacy-streak-2");
  });

  it("every id the engine can award exists in achievements.json", () => {
    const all = evaluateCounterAchievements(
      { ...base, runsCompleted: 1e6, titlesTotal: 1e6, legacyTitles: 1e6, gamesWon: 1e6, goalsScored: 1e6, specialsOwned: 80, dailyStreak: 99, rankId: "supersonic-legend", seasonRating: 1e6, legacyStreakBest: 99 },
      earnedNone,
    );
    const known = new Set((achievementsJson as { id: string }[]).map((a) => a.id));
    for (const id of [...all, "ach-legacy-undefeated", "ach-challenge-perfect", "ach-challenge-all", "ach-quiz-first-try", "ach-national-first", "ach-national-all"]) {
      expect(known.has(id), id).toBe(true);
    }
  });
});

// The feat the reveal-scoping tests below use: six goals by one player.
const FEAT = "ach-double-hat-trick";

describe("liveAchievements — reveal scoping (v1.4 bug-b fix)", () => {
  const game = (a: number[], b: number[]): GameResult => ({
    index: 0,
    winnerTeamId: a.reduce((x, y) => x + y, 0) >= b.reduce((x, y) => x + y, 0) ? "user" : "opp",
    score: [a.reduce((x, y) => x + y, 0), b.reduce((x, y) => x + y, 0)],
    overtime: false,
    deciding: false,
    notes: [],
    scorers: { a, b },
  });
  const userSeries = (games: GameResult[]): SeriesResult => ({
    teamAId: "user",
    teamBId: "opp",
    games,
    score: [games.filter((g) => g.winnerTeamId === "user").length, 0],
    winnerTeamId: "user",
    ratingDiff: 0,
    upset: false,
  });
  // Round 1: no feat (a plain hat-trick is no longer one). Round 2: a player scores six.
  const noFeat = userSeries([game([3, 1, 0], [0, 1, 0])]);
  const hatTrick = userSeries([game([6, 0, 0], [1, 0, 0])]);
  const t: TournamentState = {
    teams: {},
    swiss: {
      rounds: [
        { round: 1, series: [noFeat], userSeriesIndex: 0 },
        { round: 2, series: [hatTrick], userSeriesIndex: 0 },
      ],
      records: [],
      nextPairings: null,
      finished: false,
    },
    playoffs: null,
    stage: "swiss",
    userEliminated: false,
  };

  it("does NOT award a feat from a not-yet-revealed series", () => {
    // Only the first user series is revealed — the hat-trick is in round 2.
    expect(liveAchievements(t, earnedNone, 1)).not.toContain(FEAT);
  });
  it("awards the feat once its series is revealed", () => {
    expect(liveAchievements(t, earnedNone, 2)).toContain(FEAT);
  });
  it("evaluates the whole tournament when the limit is omitted (run-end net)", () => {
    expect(liveAchievements(t, earnedNone)).toContain(FEAT);
  });
});
