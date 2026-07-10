/**
 * Road to Worlds — placements, points, qualification, roster stability and
 * grades (design doc §7 "Points & qualification", §10 "Roster Stability",
 * §7 "Season rollover" / "Endgame").
 *
 * This module turns finished TournamentStates into compact, persistable
 * results and keeps the competition ledger (split/season points → Major and
 * Worlds fields). Money/points tables live in ./economy (pinned leafs);
 * everything here is pure and deterministic — the only "random" surface is
 * the qualification tiebreaker, which is cursor-free (`derivedFloat`).
 */

import { CAREER_REP, CAREER_SLOTS, CAREER_STABILITY, FEATURES } from "@/config/balance";
import type { Placement, PlayoffState, Region, TournamentState } from "../types";
import { pointsFor, prizeFor, repTierOf } from "./economy";
import { derivedFloat, streams } from "./seeds";
import type {
  CareerDifficulty,
  CareerEventDef,
  CareerLifetimeStats,
  CompactEventResult,
  CompactPlacementRow,
  CompetitionState,
  LegacyGrade,
  SeasonGoals,
} from "./types";

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

/** Every playoff series a team played, in play order (generalized from tournament.ts). */
function teamPlayoffSeries(playoffs: PlayoffState | null, teamId: string) {
  if (!playoffs) return [];
  return playoffs.rounds.flatMap((round) =>
    round.series
      .filter((s) => s.teamAId === teamId || s.teamBId === teamId)
      .map((s) => ({ round: round.name, series: s })),
  );
}

/**
 * Placement of ANY team in a finished tournament (generalizes the
 * user-centric `userPlacement` in tournament.ts).
 *
 * Double elim (career "swiss" format): a run can only END at lb_round1 (top8),
 * lb_round2 (top6), the third-place series (third/fourth) or the grand final
 * (champion/runner_up); teams that never reached playoffs are swiss_exit.
 * Single elim: quarterfinal losers top8, semifinal losers top4, final loser
 * runner_up.
 */
export function placementOf(state: TournamentState, teamId: string): Placement {
  if (state.playoffs?.championTeamId === teamId) return "champion";

  const runs = teamPlayoffSeries(state.playoffs, teamId);
  if (runs.length === 0) return "swiss_exit";

  const last = runs[runs.length - 1];
  const won = last.series.winnerTeamId === teamId;

  switch (last.round) {
    case "grand_final":
    case "final":
      return "runner_up";
    case "third_place":
      return won ? "third" : "fourth";
    case "lb_round2":
      return "top6";
    case "lb_round1":
      return "top8";
    case "semifinal":
      return "top4";
    case "quarterfinal":
      return "top8";
    default:
      // Defensive: a finished run can only END on the rounds above.
      return won ? "third" : "top8";
  }
}

// ---------------------------------------------------------------------------
// Compact event results
// ---------------------------------------------------------------------------

/** Display/sort order for placements (best first). */
const PLACEMENT_RANK: Record<Placement, number> = {
  champion: 0,
  runner_up: 1,
  third: 2,
  fourth: 3,
  top4: 4,
  top6: 5,
  top8: 6,
  swiss_exit: 7,
};

/**
 * Compile a finished tournament into the compact result the save keeps
 * (brackets are discarded). One row per team — refs are team ids, the user
 * team stays "user" — sorted champion-first for the recap screens.
 */
export function compileEventResult(
  def: CareerEventDef,
  state: TournamentState,
  ctx: {
    difficulty: CareerDifficulty;
    fieldQuality: number;
    nameOf: (teamId: string) => string;
  },
): CompactEventResult {
  const rows: CompactPlacementRow[] = Object.keys(state.teams).map((teamId) => {
    const placement = placementOf(state, teamId);
    return {
      ref: teamId,
      name: ctx.nameOf(teamId),
      placement,
      points: pointsFor(def.tier, placement),
      prize: prizeFor(def.tier, placement, def.format, ctx.difficulty),
    };
  });
  rows.sort(
    (a, b) => PLACEMENT_RANK[a.placement] - PLACEMENT_RANK[b.placement] || a.ref.localeCompare(b.ref),
  );

  const userRow = rows.find((r) => r.ref === "user");

  return {
    eventId: def.id,
    tier: def.tier,
    region: def.region,
    seasonIndex: def.seasonIndex,
    week: def.week,
    split: def.split,
    name: def.name,
    rows,
    championRef: state.playoffs?.championTeamId ?? rows[0].ref,
    userPlacement: userRow?.placement,
    fieldQuality: ctx.fieldQuality,
  };
}

// ---------------------------------------------------------------------------
// Standings & qualification
// ---------------------------------------------------------------------------

/**
 * Fold a compiled result into the competition ledger (immutably).
 * Regionals bank into BOTH the split table and the season table of the event
 * region; Majors (cross-region) bank into the season table of each team's
 * HOME region (`regionOf` resolves it — the store knows org homes);
 * unofficials and Worlds award no Season Points.
 */
export function applyResultToStandings(
  competition: CompetitionState,
  result: CompactEventResult,
  regionOf: (ref: string) => Region,
): CompetitionState {
  if (result.tier === "regional") {
    const region = result.region;
    if (!region) return competition;
    const split = { ...competition.splitPoints[region] };
    const season = { ...competition.seasonPoints[region] };
    for (const row of result.rows) {
      split[row.ref] = (split[row.ref] ?? 0) + row.points;
      season[row.ref] = (season[row.ref] ?? 0) + row.points;
    }
    return {
      ...competition,
      splitPoints: { ...competition.splitPoints, [region]: split },
      seasonPoints: { ...competition.seasonPoints, [region]: season },
    };
  }

  if (result.tier === "major") {
    const seasonPoints = { ...competition.seasonPoints };
    const copied = new Set<Region>();
    for (const row of result.rows) {
      const region = regionOf(row.ref);
      if (!copied.has(region)) {
        seasonPoints[region] = { ...seasonPoints[region] };
        copied.add(region);
      }
      seasonPoints[region][row.ref] = (seasonPoints[region][row.ref] ?? 0) + row.points;
    }
    return { ...competition, seasonPoints };
  }

  // t3 / t2 / worlds: no Season Points — the ledger is untouched.
  return competition;
}

/**
 * Top-K per region from a points table, K from the slot table. Ties break by
 * a per-(region, ref) derived float — deterministic, insertion-order-proof
 * (the "committee decision"). Region blocks follow the slot table's order.
 */
function qualifiersFrom(
  points: Record<Region, Record<string, number>>,
  slots: Record<string, number>,
  careerSeed: number,
): string[] {
  const field: string[] = [];
  for (const region of Object.keys(slots) as Region[]) {
    const table = points[region] ?? {};
    const refs = Object.keys(table).sort(
      (a, b) =>
        table[b] - table[a] ||
        derivedFloat(careerSeed, streams.gen("tie", region + a)) -
          derivedFloat(careerSeed, streams.gen("tie", region + b)),
    );
    field.push(...refs.slice(0, slots[region]));
  }
  return field;
}

/** The split's Major field (16 org refs) from the locked split standings. */
export function majorFieldFor(competition: CompetitionState, careerSeed: number): string[] {
  return qualifiersFrom(competition.splitPoints, CAREER_SLOTS.major, careerSeed);
}

/** The Worlds field (16 org refs) from the full-season standings. */
export function worldsFieldFor(competition: CompetitionState, careerSeed: number): string[] {
  return qualifiersFrom(competition.seasonPoints, CAREER_SLOTS.worlds, careerSeed);
}

// ---------------------------------------------------------------------------
// Roster Stability (fielded new faces, tiered — design §10)
// ---------------------------------------------------------------------------

/**
 * Assess roster stability after fielding a lineup. New faces = fielded ids
 * not in the squad-at-split-start baseline (emergency `exemptIds` never
 * count; preseason is fully exempt). The penalty applies ONCE per split at
 * the worst tier reached — when the tier worsens, only the increment over
 * what was already applied is charged. `FEATURES.careerHardStabilityRule`
 * swaps in Miguel's original rule: 2+ new faces zero all points instead.
 */
export function stabilityAssess(input: {
  fieldedIds: string[];
  squadAtSplitStart: string[];
  newFacesSoFar: string[];
  exemptIds: string[];
  isPreseason: boolean;
  seasonPointsUser: number;
  tierApplied: 0 | 25 | 60;
}): { newFaces: string[]; tier: 0 | 25 | 60; pointsLost: number } {
  if (input.isPreseason && CAREER_STABILITY.preseasonExempt) {
    return { newFaces: [...input.newFacesSoFar], tier: input.tierApplied, pointsLost: 0 };
  }

  const newFaces = [...input.newFacesSoFar];
  for (const id of input.fieldedIds) {
    if (input.squadAtSplitStart.includes(id)) continue;
    if (input.exemptIds.includes(id)) continue;
    if (!newFaces.includes(id)) newFaces.push(id);
  }

  if (FEATURES.careerHardStabilityRule) {
    // Original hard rule: fielding 2+ new faces forfeits the Season Points.
    if (newFaces.length > CAREER_STABILITY.freeNewFaces && input.tierApplied < 60) {
      return { newFaces, tier: 60, pointsLost: Math.max(0, input.seasonPointsUser) };
    }
    return { newFaces, tier: input.tierApplied, pointsLost: 0 };
  }

  const tier: 0 | 25 | 60 =
    newFaces.length <= CAREER_STABILITY.freeNewFaces
      ? 0
      : newFaces.length === CAREER_STABILITY.freeNewFaces + 1
        ? CAREER_STABILITY.secondFacePenaltyPct
        : CAREER_STABILITY.thirdFacePenaltyPct;

  const worst = Math.max(tier, input.tierApplied) as 0 | 25 | 60;
  const incrementPct = Math.max(0, tier - input.tierApplied);
  const pointsLost = Math.max(0, Math.round((input.seasonPointsUser * incrementPct) / 100));
  return { newFaces, tier: worst, pointsLost };
}

// ---------------------------------------------------------------------------
// Grades & goals
// ---------------------------------------------------------------------------

/**
 * Season-grade ladder (engine-brief pinned; candidates for a CAREER_GRADES
 * balance group when balance.ts reopens). A season scores achievement points
 * (majors made + Worlds run + region rank) against a rep-scaled expectation:
 * at low rep making a Major overshoots (A); at max rep a Worlds semifinal
 * merely meets it (B).
 */
const GRADE_WORLDS_SCORE: Record<Placement, number> = {
  champion: 7,
  runner_up: 5,
  third: 4,
  fourth: 4,
  top4: 4,
  top6: 3,
  top8: 3,
  swiss_exit: 2,
};
/** Expected score per rep tier (repTierOf: 0..4). */
const GRADE_EXPECTED_BY_TIER = [0, 2, 4, 6, 8] as const;
const GRADE_RANK_BONUS_TOP2 = 2;
const GRADE_RANK_BONUS_TOP4 = 1;
/** Grade cuts on (score − expected). */
const GRADE_CUTS = { S: 3, A: 1, B: -1, C: -3 } as const;
/** The debut season is graded one notch kinder (the intended-arc framing). */
const GRADE_DEBUT_GRACE = 1;

export function seasonGradeFor(input: {
  regionRank: number;
  majorsQualified: number;
  worldsPlacement: Placement | null;
  seasonIndex: number;
  rep: number;
}): "S" | "A" | "B" | "C" | "D" {
  const worlds = input.worldsPlacement ? GRADE_WORLDS_SCORE[input.worldsPlacement] : 0;
  const rank =
    input.regionRank <= 2 ? GRADE_RANK_BONUS_TOP2 : input.regionRank <= 4 ? GRADE_RANK_BONUS_TOP4 : 0;
  const score = input.majorsQualified + worlds + rank;

  let expected: number = GRADE_EXPECTED_BY_TIER[repTierOf(input.rep)];
  if (input.seasonIndex === 0) expected = Math.max(0, expected - GRADE_DEBUT_GRACE);

  const delta = score - expected;
  if (delta >= GRADE_CUTS.S) return "S";
  if (delta >= GRADE_CUTS.A) return "A";
  if (delta >= GRADE_CUTS.B) return "B";
  if (delta >= GRADE_CUTS.C) return "C";
  return "D";
}

/**
 * Lifetime legacy grade (design §7 endgame). NOTE: CareerLifetimeStats has no
 * Worlds-top-4 counter, so the "Contender" rung keys on a Major title — the
 * closest expressible check (a Worlds top-4 career virtually always carries
 * one; the design's exact wording needs a stats field to land in v1.1).
 */
export function legacyGradeFor(stats: CareerLifetimeStats): LegacyGrade {
  if (stats.titlesWorlds >= 1) return "legend";
  if (stats.titlesMajor >= 1) return "contender";
  if (stats.worldsQualified >= 1) return "challenger";
  return "journeyman";
}

/** Goal ladder by rep (keys under career.goals.* — copy owns the words). */
const GOAL_LADDER = [
  { minRep: 75, targetKey: "career.goals.winMajor", stretchKey: "career.goals.winWorlds" },
  { minRep: 50, targetKey: "career.goals.qualifyWorlds", stretchKey: "career.goals.worldsTop4" },
  { minRep: 25, targetKey: "career.goals.majorTop8", stretchKey: "career.goals.majorTop4" },
  { minRep: 0, targetKey: "career.goals.reachMajor", stretchKey: "career.goals.regionalTop4" },
] as const;

/**
 * The preseason Season Goals card: target + stretch from the rep ladder, and
 * the total rep at stake this season — the base goal-miss loss plus the
 * telegraphed expectation losses that arm at higher rep (CAREER_REP).
 */
export function seasonGoalsFor(input: { rep: number; seasonIndex: number }): SeasonGoals {
  const rung = GOAL_LADDER.find((r) => input.rep >= r.minRep) ?? GOAL_LADDER[GOAL_LADDER.length - 1];

  let repRisk = CAREER_REP.lossSeasonGoalMiss;
  if (input.rep >= CAREER_REP.lossMajorMissAtRep) repRisk += CAREER_REP.lossMajorMiss;
  if (input.rep >= CAREER_REP.lossWorldsMissAtRep) repRisk += CAREER_REP.lossWorldsMiss;

  return { targetKey: rung.targetKey, stretchKey: rung.stretchKey, repRisk, targetMet: null };
}
