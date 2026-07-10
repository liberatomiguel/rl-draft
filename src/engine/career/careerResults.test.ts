/**
 * careerResults tests: placement generalization on real (synthetic-team)
 * tournaments, compact result compilation, standings math, qualification
 * slots + deterministic tiebreak, roster stability tiers (incl. the hard-rule
 * flag) and the grade/goal ladders. Dataset-agnostic — teams are literal
 * fakes (regression.golden.test.ts pattern).
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_POINTS,
  CAREER_REP,
  CAREER_SLOTS,
  CAREER_STABILITY,
  FEATURES,
} from "@/config/balance";
import { createRng } from "@/lib/rng";
import { fastForward, initFieldTournament, userPlacement } from "../tournament";
import type { Placement, Region, Stats, TournamentState, TournamentTeam } from "../types";
import { eventDayFor } from "./calendar";
import {
  applyResultToStandings,
  compileEventResult,
  legacyGradeFor,
  majorFieldFor,
  placementOf,
  seasonGoalsFor,
  seasonGradeFor,
  stabilityAssess,
  worldsFieldFor,
} from "./careerResults";
import { pointsFor, prizeFor } from "./economy";
import { derivedFloat, streams } from "./seeds";
import type { CareerEventDef, CareerLifetimeStats, CompetitionState } from "./types";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];

// --- fixtures (fakeTeam pattern from regression.golden.test.ts) -------------

function fakeTeam(id: string, rating: number, statsShift = 0): TournamentTeam {
  const stat = (v: number) => Math.min(99, Math.max(60, v));
  const stats: Stats = {
    offense: stat(rating + statsShift),
    defense: stat(rating - statsShift),
    mechanics: stat(rating),
    consistency: stat(rating),
    experience: stat(rating),
    clutch: stat(rating),
  };
  return {
    id,
    name: id,
    isUser: id === "user",
    region: "EU",
    rating: {
      avgPlayerOverall: rating,
      coachMod: 0,
      subMod: 0,
      orgMod: 0,
      chemMod: 0,
      specialMod: 0,
      difficultyShift: 0,
      total: rating,
    },
    chemistry: { raw: 0, max: 10, percent: 0, tier: "Poor", items: [] },
    stats,
    specialIds: [],
    playerNames: [`${id}-a`, `${id}-b`, `${id}-c`],
    orgId: id,
  };
}

function field(size: 8 | 16, withUser: boolean): TournamentTeam[] {
  return Array.from({ length: size }, (_, i) => {
    const id = withUser && i === 0 ? "user" : `t${String(i).padStart(2, "0")}`;
    return fakeTeam(id, 92.5 - i * 0.75, (i % 3) - 1);
  });
}

function finishedSwiss(seed: number, withUser = true): TournamentState {
  const rng = createRng(seed);
  const state = initFieldTournament(field(16, withUser), "swiss", rng);
  return fastForward(state, "normal", rng);
}

function finishedSingle(seed: number, withUser = true): TournamentState {
  const rng = createRng(seed);
  const state = initFieldTournament(field(8, withUser), "single", rng);
  return fastForward(state, "normal", rng);
}

function placementCounts(state: TournamentState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const teamId of Object.keys(state.teams)) {
    const p = placementOf(state, teamId);
    counts[p] = (counts[p] ?? 0) + 1;
  }
  return counts;
}

// --- placements --------------------------------------------------------------

describe("placementOf", () => {
  it("assigns the full double-elim placement shape to a 16-team Swiss event", () => {
    for (const seed of [11, 20260709, 987654]) {
      const state = finishedSwiss(seed);
      expect(placementCounts(state)).toEqual({
        champion: 1,
        runner_up: 1,
        third: 1,
        fourth: 1,
        top6: 2,
        top8: 2,
        swiss_exit: 8,
      });
      expect(placementOf(state, state.playoffs!.championTeamId!)).toBe("champion");
    }
  });

  it("assigns the single-elim shape to an 8-team cup", () => {
    for (const seed of [7, 4242]) {
      const state = finishedSingle(seed);
      expect(placementCounts(state)).toEqual({
        champion: 1,
        runner_up: 1,
        top4: 2,
        top8: 4,
      });
    }
  });

  it("agrees with the existing user-centric userPlacement on every seed probed", () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      const swiss = finishedSwiss(seed);
      expect(placementOf(swiss, "user")).toBe(userPlacement(swiss));
      const single = finishedSingle(seed);
      expect(placementOf(single, "user")).toBe(userPlacement(single));
    }
  });
});

// --- compact results ---------------------------------------------------------

const regionalDef: CareerEventDef = {
  id: "0:1:reg1:EU",
  tier: "regional",
  region: "EU",
  seasonIndex: 0,
  week: 4,
  day: eventDayFor(4),
  split: 1,
  ordinal: 1,
  name: "EU Regional 1",
  format: "swiss",
};

const majorDef: CareerEventDef = {
  id: "0:1:major",
  tier: "major",
  seasonIndex: 0,
  week: 10,
  day: eventDayFor(10),
  split: 1,
  name: "Split 1 Major",
  format: "swiss",
};

const t3Def: CareerEventDef = {
  id: "0:3:unofficial",
  tier: "t3",
  seasonIndex: 0,
  week: 3,
  day: eventDayFor(3),
  split: 1,
  name: "Boost Bracket",
  format: "single",
};

const ctx = {
  difficulty: "normal" as const,
  fieldQuality: 1.1,
  nameOf: (teamId: string) => `Team ${teamId}`,
};

describe("compileEventResult", () => {
  it("compiles one row per team with economy points/prizes, champion first", () => {
    const state = finishedSwiss(20260709);
    const result = compileEventResult(regionalDef, state, ctx);

    expect(result.rows).toHaveLength(16);
    expect(result.eventId).toBe(regionalDef.id);
    expect(result.fieldQuality).toBe(1.1);
    expect(result.championRef).toBe(state.playoffs!.championTeamId);
    expect(result.rows[0].ref).toBe(result.championRef);
    expect(result.rows[0].placement).toBe("champion");
    expect(result.rows[0].points).toBe(CAREER_POINTS.regional.champion);
    expect(result.userPlacement).toBe(placementOf(state, "user"));

    for (const row of result.rows) {
      expect(row.name).toBe(`Team ${row.ref}`);
      expect(row.points).toBe(pointsFor("regional", row.placement));
      expect(row.prize).toBe(prizeFor("regional", row.placement, "swiss", "normal"));
      expect(row.prize).toBeGreaterThan(0); // every placement pays
    }
    // Sorted best placement first.
    const ranks = result.rows.map((r) => r.placement);
    expect(ranks[0]).toBe("champion");
    expect(ranks[ranks.length - 1]).toBe("swiss_exit");
  });

  it("pays double points at a Major and none at unofficials", () => {
    const state = finishedSwiss(555);
    const major = compileEventResult(majorDef, state, ctx);
    expect(major.rows[0].points).toBe(
      CAREER_POINTS.regional.champion * CAREER_POINTS.majorMultiplier,
    );

    const cup = compileEventResult(t3Def, finishedSingle(555), ctx);
    for (const row of cup.rows) expect(row.points).toBe(0);
    expect(cup.rows[0].prize).toBeGreaterThan(0);
  });

  it("keeps the user ref and omits userPlacement in AI-only events", () => {
    const state = finishedSwiss(99, false);
    const result = compileEventResult(regionalDef, state, ctx);
    expect(result.userPlacement).toBeUndefined();
    expect(result.rows.some((r) => r.ref === "user")).toBe(false);
  });
});

// --- standings ---------------------------------------------------------------

function emptyPoints(): Record<Region, Record<string, number>> {
  return Object.fromEntries(REGIONS.map((r) => [r, {}])) as Record<
    Region,
    Record<string, number>
  >;
}

function emptyCompetition(): CompetitionState {
  return {
    splitPoints: emptyPoints(),
    seasonPoints: emptyPoints(),
    majorFieldRefs: null,
    worldsFieldRefs: null,
    newFacesThisSplit: [],
    squadAtSplitStart: [],
    stabilityTierApplied: 0,
  };
}

describe("applyResultToStandings", () => {
  const homeRegion = (ref: string): Region => (ref === "user" ? "SAM" : "NA");

  it("banks regional points into the split AND season tables of the event region", () => {
    const state = finishedSwiss(31337);
    const result = compileEventResult(regionalDef, state, ctx);
    const before = emptyCompetition();
    const after = applyResultToStandings(before, result, homeRegion);

    for (const row of result.rows) {
      expect(after.splitPoints.EU[row.ref]).toBe(row.points);
      expect(after.seasonPoints.EU[row.ref]).toBe(row.points);
    }
    // Other regions untouched; source object not mutated (immutability).
    expect(after.splitPoints.NA).toEqual({});
    expect(before.splitPoints.EU).toEqual({});

    // A second regional accumulates.
    const again = applyResultToStandings(after, result, homeRegion);
    expect(again.splitPoints.EU[result.championRef]).toBe(2 * CAREER_POINTS.regional.champion);
  });

  it("banks Major points into each team's HOME region season table only", () => {
    const state = finishedSwiss(777);
    const result = compileEventResult(majorDef, state, ctx);
    const after = applyResultToStandings(emptyCompetition(), result, homeRegion);

    for (const row of result.rows) {
      expect(after.seasonPoints[homeRegion(row.ref)][row.ref]).toBe(row.points);
    }
    for (const region of REGIONS) expect(after.splitPoints[region]).toEqual({});
    expect(after.seasonPoints.EU).toEqual({});
  });

  it("ignores unofficials and Worlds", () => {
    const cup = compileEventResult(t3Def, finishedSingle(9), ctx);
    const worlds = compileEventResult(
      { ...majorDef, id: "0:worlds", tier: "worlds", week: 32, split: undefined },
      finishedSwiss(9),
      ctx,
    );
    const competition = emptyCompetition();
    expect(applyResultToStandings(competition, cup, homeRegion)).toBe(competition);
    expect(applyResultToStandings(competition, worlds, homeRegion)).toBe(competition);
  });
});

// --- qualification -----------------------------------------------------------

describe("majorFieldFor / worldsFieldFor", () => {
  function syntheticTable(prefixSeed: string): Record<Region, Record<string, number>> {
    const table = emptyPoints();
    for (const region of REGIONS) {
      for (let i = 0; i < 6; i++) {
        table[region][`${prefixSeed}:${region}:org${i}`] = 600 - i * 50;
      }
    }
    return table;
  }

  it("fills exactly 16 slots, top-K per region by points", () => {
    const competition = {
      ...emptyCompetition(),
      splitPoints: syntheticTable("sp"),
      seasonPoints: syntheticTable("se"),
    };
    const major = majorFieldFor(competition, 123);
    const worlds = worldsFieldFor(competition, 123);

    expect(major).toHaveLength(16);
    expect(worlds).toHaveLength(16);
    // Reads the right table each.
    expect(major.every((ref) => ref.startsWith("sp:"))).toBe(true);
    expect(worlds.every((ref) => ref.startsWith("se:"))).toBe(true);

    for (const region of REGIONS) {
      const slots = CAREER_SLOTS.major[region];
      const regional = major.filter((ref) => ref.includes(`:${region}:`));
      expect(regional).toEqual(
        Array.from({ length: slots }, (_, i) => `sp:${region}:org${i}`),
      );
    }
  });

  it("breaks point ties by the documented derived float (committee decision)", () => {
    const careerSeed = 20260709;
    const competition = emptyCompetition();
    // EU has 4 slots: three locks + two orgs tied on the last slot.
    competition.splitPoints.EU = { l1: 600, l2: 550, l3: 520, tiedA: 500, tiedB: 500 };

    const floatOf = (ref: string) => derivedFloat(careerSeed, streams.gen("tie", `EU${ref}`));
    const expected = floatOf("tiedA") < floatOf("tiedB") ? "tiedA" : "tiedB";
    const eu = majorFieldFor(competition, careerSeed).filter((ref) =>
      ["l1", "l2", "l3", "tiedA", "tiedB"].includes(ref),
    );

    expect(eu).toHaveLength(CAREER_SLOTS.major.EU);
    expect(eu).toContain(expected);
    expect(eu).not.toContain(expected === "tiedA" ? "tiedB" : "tiedA");
    // Deterministic: same inputs, same field.
    expect(majorFieldFor(competition, careerSeed)).toEqual(majorFieldFor(competition, careerSeed));
  });
});

// --- roster stability ----------------------------------------------------------

describe("stabilityAssess", () => {
  const base = {
    squadAtSplitStart: ["a", "b", "c"],
    newFacesSoFar: [] as string[],
    exemptIds: [] as string[],
    isPreseason: false,
    seasonPointsUser: 400,
    tierApplied: 0 as const,
  };

  it("first new face is free; the second and third tier up", () => {
    expect(stabilityAssess({ ...base, fieldedIds: ["a", "b", "c"] })).toEqual({
      newFaces: [],
      tier: 0,
      pointsLost: 0,
    });
    expect(stabilityAssess({ ...base, fieldedIds: ["a", "b", "x"] })).toEqual({
      newFaces: ["x"],
      tier: 0,
      pointsLost: 0,
    });
    expect(stabilityAssess({ ...base, fieldedIds: ["a", "x", "y"] })).toEqual({
      newFaces: ["x", "y"],
      tier: CAREER_STABILITY.secondFacePenaltyPct,
      pointsLost: Math.round((400 * CAREER_STABILITY.secondFacePenaltyPct) / 100),
    });
    expect(stabilityAssess({ ...base, fieldedIds: ["x", "y", "z"] })).toEqual({
      newFaces: ["x", "y", "z"],
      tier: CAREER_STABILITY.thirdFacePenaltyPct,
      pointsLost: Math.round((400 * CAREER_STABILITY.thirdFacePenaltyPct) / 100),
    });
  });

  it("applies the worst tier once — only the increment is charged on escalation", () => {
    // 25% already applied earlier this split; the third face costs the extra 35%.
    const escalated = stabilityAssess({
      ...base,
      fieldedIds: ["x", "y", "z"],
      newFacesSoFar: ["x", "y"],
      tierApplied: 25,
    });
    expect(escalated.tier).toBe(60);
    expect(escalated.pointsLost).toBe(Math.round((400 * (60 - 25)) / 100));

    // Same tier again → nothing more to charge.
    const repeat = stabilityAssess({
      ...base,
      fieldedIds: ["a", "x", "y"],
      newFacesSoFar: ["x", "y"],
      tierApplied: 25,
    });
    expect(repeat.pointsLost).toBe(0);
    expect(repeat.tier).toBe(25);
  });

  it("accumulates and dedupes new faces across the split", () => {
    const out = stabilityAssess({
      ...base,
      fieldedIds: ["a", "b", "x"],
      newFacesSoFar: ["x"],
    });
    expect(out.newFaces).toEqual(["x"]);
  });

  it("emergency exemptions and preseason never count", () => {
    expect(
      stabilityAssess({ ...base, fieldedIds: ["x", "y", "z"], exemptIds: ["x", "y"] }),
    ).toEqual({ newFaces: ["z"], tier: 0, pointsLost: 0 });

    expect(
      stabilityAssess({ ...base, fieldedIds: ["x", "y", "z"], isPreseason: true }),
    ).toEqual({ newFaces: [], tier: 0, pointsLost: 0 });
  });

  it("hard-rule flag zeroes all points at 2+ new faces (once)", () => {
    const features = FEATURES as { careerHardStabilityRule: boolean };
    const original = features.careerHardStabilityRule;
    features.careerHardStabilityRule = true;
    try {
      const zeroed = stabilityAssess({ ...base, fieldedIds: ["a", "x", "y"] });
      expect(zeroed.tier).toBe(60);
      expect(zeroed.pointsLost).toBe(400);

      const once = stabilityAssess({
        ...base,
        fieldedIds: ["a", "x", "y"],
        newFacesSoFar: ["x", "y"],
        tierApplied: 60,
      });
      expect(once.pointsLost).toBe(0);

      const free = stabilityAssess({ ...base, fieldedIds: ["a", "b", "x"] });
      expect(free.pointsLost).toBe(0);
      expect(free.tier).toBe(0);
    } finally {
      features.careerHardStabilityRule = original;
    }
  });
});

// --- grades & goals -----------------------------------------------------------

describe("seasonGradeFor", () => {
  const season = (over: Partial<Parameters<typeof seasonGradeFor>[0]>) =>
    seasonGradeFor({
      regionRank: 8,
      majorsQualified: 0,
      worldsPlacement: null,
      seasonIndex: 2,
      rep: 10,
      ...over,
    });

  it("low rep: making a Major overshoots the expectation (A)", () => {
    expect(season({ majorsQualified: 1 })).toBe("A");
  });

  it("low rep: an empty season still reads as the intended arc (B, not failure)", () => {
    expect(season({})).toBe("B");
  });

  it("high rep: a Worlds semifinal run merely meets expectations", () => {
    expect(
      season({ rep: 85, worldsPlacement: "third", majorsQualified: 2, regionRank: 3 }),
    ).toBe("B");
  });

  it("high rep: missing Worlds entirely is a failed season", () => {
    expect(season({ rep: 85, majorsQualified: 1, regionRank: 5 })).toBe("D");
  });

  it("a Worlds title grades S at any rep", () => {
    for (const rep of [5, 45, 85]) {
      expect(
        season({ rep, worldsPlacement: "champion", majorsQualified: 3, regionRank: 1 }),
      ).toBe("S");
    }
  });

  it("never grades a better Worlds run worse (monotone in placement)", () => {
    const order: (Placement | null)[] = [null, "swiss_exit", "top8", "top6", "fourth", "third", "runner_up", "champion"];
    const gradeRank = { S: 0, A: 1, B: 2, C: 3, D: 4 } as const;
    for (const rep of [10, 50, 90]) {
      let bestSoFar = 4;
      for (const worldsPlacement of order) {
        const g = gradeRank[season({ rep, worldsPlacement, majorsQualified: 2 })];
        expect(g).toBeLessThanOrEqual(bestSoFar);
        bestSoFar = g;
      }
    }
  });
});

describe("legacyGradeFor", () => {
  const stats = (over: Partial<CareerLifetimeStats>): CareerLifetimeStats => ({
    seriesWins: 0,
    seriesLosses: 0,
    gameWins: 0,
    gameLosses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    titlesT3: 0,
    titlesT2: 0,
    titlesRegional: 0,
    titlesMajor: 0,
    titlesWorlds: 0,
    majorsQualified: 0,
    worldsQualified: 0,
    totalPrize: 0,
    biggestSigningFee: 0,
    biggestWinName: null,
    ...over,
  });

  it("walks the ladder: legend > contender > challenger > journeyman", () => {
    expect(legacyGradeFor(stats({ titlesWorlds: 1, titlesMajor: 2 }))).toBe("legend");
    expect(legacyGradeFor(stats({ titlesMajor: 1, worldsQualified: 3 }))).toBe("contender");
    expect(legacyGradeFor(stats({ worldsQualified: 1 }))).toBe("challenger");
    expect(legacyGradeFor(stats({ titlesRegional: 4, titlesT2: 2 }))).toBe("journeyman");
  });
});

describe("seasonGoalsFor", () => {
  it("scales the target ladder with rep", () => {
    expect(seasonGoalsFor({ rep: 5, seasonIndex: 0 })).toMatchObject({
      targetKey: "career.goals.reachMajor",
      stretchKey: "career.goals.regionalTop4",
      targetMet: null,
    });
    expect(seasonGoalsFor({ rep: 30, seasonIndex: 2 }).targetKey).toBe("career.goals.majorTop8");
    expect(seasonGoalsFor({ rep: 55, seasonIndex: 3 }).targetKey).toBe(
      "career.goals.qualifyWorlds",
    );
    expect(seasonGoalsFor({ rep: 80, seasonIndex: 4 })).toMatchObject({
      targetKey: "career.goals.winMajor",
      stretchKey: "career.goals.winWorlds",
    });
  });

  it("prices the rep at stake from the CAREER_REP loss table", () => {
    expect(seasonGoalsFor({ rep: 10, seasonIndex: 0 }).repRisk).toBe(
      CAREER_REP.lossSeasonGoalMiss,
    );
    expect(seasonGoalsFor({ rep: 45, seasonIndex: 2 }).repRisk).toBe(
      CAREER_REP.lossSeasonGoalMiss + CAREER_REP.lossMajorMiss,
    );
    expect(seasonGoalsFor({ rep: 70, seasonIndex: 4 }).repRisk).toBe(
      CAREER_REP.lossSeasonGoalMiss + CAREER_REP.lossMajorMiss + CAREER_REP.lossWorldsMiss,
    );
  });
});
