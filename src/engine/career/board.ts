/**
 * v2.2 board front — the board's objectives, the pre-season package,
 * confidence, the ultimatum and the season's verdict (FEATURES.board). Pure.
 *
 * Fairness contract:
 *  - every objective is a season goal (seasonGoals.ts) picked by its chance
 *    from the fitted curves, so its likelihood is stated and honest;
 *  - every confidence change has a reason in the log;
 *  - a dismissal needs a warning first, then an ultimatum (a concrete
 *    mission over the splits left, aimed at CAREER_BOARD.ultimatum.aim),
 *    and only a failed ultimatum dismisses, at the season's review;
 *  - no ultimatum in the board's grace seasons (a real org: its first
 *    season; a founded club's owners: two) nor while a title protects;
 *  - nothing already paid is taken back: punishments act on what is next.
 */

import { CAREER_BOARD, CAREER_SEASON_GOAL } from "@/config/balance";
import type { Placement } from "../types";
import { seasonSchedule, worldsCancelledIn } from "./calendar";
import { SEASON_GOAL_CANDIDATES, seasonGoalChance, type FieldDraw } from "./seasonGoals";
import { binomialTail, type TeamLevel } from "./sponsorDeals";
import { quantize } from "./economy";
import type {
  BoardLegacy,
  BoardPackage,
  BoardSecondary,
  BoardState,
  BoardUltimatum,
  LegacyKind,
  PackageId,
  SecondaryKind,
} from "./boardTypes";
import type { CareerDifficulty, CompactEventResult, SeasonGoalSpec } from "./types";
import { patienceOf, profileOf, type ProfileKey } from "./orgProfile";

const B = CAREER_BOARD;
export const PACKAGE_IDS: readonly PackageId[] = ["cautious", "expected", "ambitious"];

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const SCHEDULE = seasonSchedule();
const REGIONAL_WEEKS = SCHEDULE.filter((w) => w.kind === "regional").map((w) => w.week);
const MAJOR_WEEKS = SCHEDULE.filter((w) => w.kind === "major").map((w) => w.week);

// ---------------------------------------------------------------------------
// The sporting objective and the packages
// ---------------------------------------------------------------------------

export interface ObjectiveInput {
  level: TeamLevel;
  cup?: FieldDraw | null;
  seasonIndex: number;
  /**
   * The board's calibration cell (CAREER_BOARD.calibration): the season-goal
   * curves were fitted on founded careers before the staging flags moved the
   * field, so the board states the chance measured for its stature,
   * difficulty and stage. Absent = the raw model chance.
   */
  cal?: CalibrationCell;
}

export interface CalibrationCell {
  stature: ProfileKey;
  difficulty: CareerDifficulty;
  /** The board's first season (a takeover's first, a founded club's founding season). */
  first: boolean;
}

const logit = (p: number) => Math.log(p / (1 - p));

/**
 * The measured chance for a model chance: logit(p) = a + b·logit(model) (+ first
 * in a first season), fitted per stature × difficulty on BOARD_CAL (careerBoard.probe).
 */
export function calibratedChance(
  model: number,
  cell: CalibrationCell | undefined,
  table: Record<string, Record<string, { a: number; b: number; first: number }> | undefined> = B.calibration,
): number {
  if (!cell || !(model > 0)) return model;
  const row = table[cell.stature]?.[cell.difficulty];
  if (!row) return model;
  const x = logit(clamp(model, 0.01, 0.99));
  const z = row.a + row.b * x + (cell.first ? row.first : 0);
  return clamp(1 / (1 + Math.exp(-z)), 0.01, 0.99);
}

/**
 * The chance a board states for a season goal: the measured record of that
 * goal for clubs of this stature and difficulty (CAREER_BOARD.goalRates),
 * shrunk toward the calibrated model (the prior). No record: the prior.
 */
export function measuredGoalChance(
  spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">,
  prior: number,
  cell: CalibrationCell | undefined,
  rates: Record<string, Record<string, [number, number]> | undefined> = B.goalRates,
): number {
  if (!cell) return prior;
  const rec = rates[`${cell.stature}/${cell.difficulty}`]?.[`${spec.kind}:${spec.count}:${spec.place ?? ""}`];
  if (!rec) return prior;
  return (rec[1] + B.goalRatesK * prior) / (rec[0] + B.goalRatesK);
}

/** Every season goal with its chance for this squad (Worlds goals out in a season without Worlds), the board's stated chance when a cell is given. */
export function ratedGoals(input: ObjectiveInput): SeasonGoalSpec[] {
  const noWorlds = worldsCancelledIn(input.seasonIndex);
  return SEASON_GOAL_CANDIDATES.filter((c) => !noWorlds || (c.kind !== "worldsQualify" && c.kind !== "worldsFinish"))
    .map((c) => ({ ...c, chance: seasonGoalChance(c, input.level, input.cup) }))
    .filter((c) => Number.isFinite(c.chance) && c.chance > 0)
    .map((c) => ({ ...c, chance: round3(measuredGoalChance(c, calibratedChance(c.chance, input.cal), input.cal)) }));
}

/** The goal nearest `aim` (the less ambitious on a tie), optionally under / over a chance. */
function nearest(pool: readonly SeasonGoalSpec[], aim: number, filter?: (c: SeasonGoalSpec) => boolean): SeasonGoalSpec | null {
  let best: SeasonGoalSpec | null = null;
  for (const c of pool) {
    if (filter && !filter(c)) continue;
    if (!best || Math.abs(c.chance - aim) < Math.abs(best.chance - aim) - 1e-9) best = c;
  }
  return best;
}

export type ChanceBand = "expected" | "reach" | "stretch" | "longShot";

/** The words a calibrated chance is shown in (CAREER_BOARD.bands). */
export function chanceBandOf(p: number, cuts: { expected: number; reach: number; stretch: number } = B.bands): ChanceBand {
  if (p >= cuts.expected) return "expected";
  if (p >= cuts.reach) return "reach";
  if (p >= cuts.stretch) return "stretch";
  return "longShot";
}

export function objectiveAimOf(pkg: PackageId, stature: ProfileKey, difficulty: CareerDifficulty): number {
  return clamp(
    B.baseAim + B.packages[pkg].aimShift + profileOf(stature).aimShift + (B.difficulty[difficulty]?.aimShift ?? 0),
    B.aimClamp.min,
    B.aimClamp.max,
  );
}

export interface PackageInput extends ObjectiveInput {
  stature: ProfileKey;
  difficulty: CareerDifficulty;
  /** The seasonal budget at ×1 (0 for a founded club's owners). */
  grantBase: number;
  budgetMult: number;
  weekWages: number;
}

/**
 * The three offers, cautious → ambitious: each objective nearest its aim,
 * and each strictly harder than the one before when the season has one.
 */
export function boardPackagesFor(input: PackageInput): BoardPackage[] {
  const pool = ratedGoals(input);
  const patience = patienceOf(input.stature, input.difficulty);
  // Never an empty objective: a season with no rated goal (a squad that cannot play) asks to play a Sunday regional.
  const expected = nearest(pool, objectiveAimOf("expected", input.stature, input.difficulty)) ?? { kind: "regionalReach" as const, count: 1, chance: 0.5 };
  const cautious =
    nearest(pool, objectiveAimOf("cautious", input.stature, input.difficulty), (c) => c.chance > expected.chance + 0.02) ?? expected;
  const ambitious =
    nearest(pool, objectiveAimOf("ambitious", input.stature, input.difficulty), (c) => c.chance < expected.chance - 0.02) ?? expected;
  const goal: Record<PackageId, SeasonGoalSpec> = { cautious, expected, ambitious };
  return PACKAGE_IDS.map((id) => {
    const P = B.packages[id];
    return {
      id,
      objective: { ...goal[id] },
      grant: quantize(input.grantBase * input.budgetMult * P.grantMult + input.weekWages * P.upfrontWeeks),
      bonus: quantize(input.weekWages * P.bonusWeeks),
      hit: P.hit,
      miss: Math.round(P.miss * patience),
    };
  });
}

/** The stretch the season goal card shows beside the board's objective: harder by the goal model's gap. */
export function stretchFor(objective: SeasonGoalSpec, input: ObjectiveInput): SeasonGoalSpec | null {
  const pool = ratedGoals(input).filter((c) => c.chance <= objective.chance - CAREER_SEASON_GOAL.stretchGap + 1e-9);
  return nearest(pool, CAREER_SEASON_GOAL.stretchAim) ?? null;
}

// ---------------------------------------------------------------------------
// Secondary and legacy objectives
// ---------------------------------------------------------------------------

export function secondaryKindsFor(majorChance: number): SecondaryKind[] {
  const kinds: SecondaryKind[] = ["balance", "wages", "youth"];
  if (majorChance >= 0.3) kinds.push("homeCore");
  return kinds;
}

/** The season's secondary objective, drawn from the kinds the squad can be judged on (f: a seeded draw). */
export function secondaryFor(f: number, majorChance: number, wageRoom: number): BoardSecondary {
  const kinds = secondaryKindsFor(majorChance);
  const kind = kinds[Math.min(kinds.length - 1, Math.floor(f * kinds.length))];
  const value = kind === "wages" ? wageRoom : kind === "youth" ? B.secondary.youthAge : kind === "homeCore" ? B.secondary.homeStarters : 0;
  return { kind, value, met: null };
}

export interface SecondaryFacts {
  balance: number;
  weekWages: number;
  starterAges: number[];
  homeStarters: number;
  majorsQualified: number;
}

export function secondaryMet(s: BoardSecondary, facts: SecondaryFacts): boolean {
  switch (s.kind) {
    case "balance":
      return facts.balance >= 0;
    case "wages":
      return facts.weekWages <= s.value;
    case "youth":
      return facts.starterAges.some((a) => a < s.value);
    case "homeCore":
      return facts.majorsQualified >= 1 && facts.homeStarters >= s.value;
  }
}

/**
 * After a title the board adds a legacy objective (no penalty if missed):
 * defend the Worlds title, win two Majors, or win every Major of a season.
 */
export function legacyFor(last: { worlds: boolean; majors: number } | null, input: ObjectiveInput): BoardLegacy | null {
  if (!last || (!last.worlds && last.majors === 0)) return null;
  const noWorlds = worldsCancelledIn(input.seasonIndex);
  const kind: LegacyKind = last.worlds && !noWorlds ? "defendWorlds" : last.majors >= 2 ? "everyMajor" : "majorDouble";
  const spec: Omit<SeasonGoalSpec, "chance"> =
    kind === "defendWorlds"
      ? { kind: "worldsFinish", count: 1, place: 1 }
      : kind === "everyMajor"
        ? { kind: "majorFinish", count: 3, place: 1 }
        : { kind: "majorFinish", count: 2, place: 1 };
  const prior = calibratedChance(seasonGoalChance(spec, input.level, input.cup), input.cal);
  return { kind, objective: { ...spec, chance: round3(measuredGoalChance(spec, prior, input.cal)) }, met: null };
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export function isProtected(board: BoardState, seasonIndex: number): boolean {
  return board.protectedUntil !== null && seasonIndex <= board.protectedUntil;
}

/** Apply one change with its reason (a loss × patience, then halved under a title's protection). Mutates. */
export function applyConfidence(
  board: BoardState,
  delta: number,
  reason: string,
  when: { seasonIndex: number; day: number },
  /** Losses × this (the stature's and difficulty's patience; 1 when the delta already carries it). */
  patience = 1,
): number {
  let d = Math.round(delta < 0 ? delta * patience : delta);
  if (d < 0 && isProtected(board, when.seasonIndex)) d = Math.round(d / 2);
  if (d === 0) return 0;
  const before = board.confidence;
  board.confidence = clamp(before + d, 0, 100);
  const applied = board.confidence - before;
  board.log.unshift({ seasonIndex: when.seasonIndex, day: when.day, delta: applied, reason, after: board.confidence });
  if (board.log.length > 40) board.log.length = 40;
  return applied;
}

/** May the board issue an ultimatum now? (the grace seasons, a title's protection, one at a time) */
export function ultimatumAllowed(board: BoardState, seasonIndex: number): boolean {
  const grace = board.kind === "owners" ? B.graceSeasons.owners : B.graceSeasons.board;
  return seasonIndex - board.startSeason >= grace && !isProtected(board, seasonIndex) && board.ultimatum?.status !== "open";
}

// ---------------------------------------------------------------------------
// Chances mid-season (checkpoints, missions)
// ---------------------------------------------------------------------------

/** The per-event chance behind a counted goal (its "all of them" chance, rooted). */
function perEventChance(spec: Pick<SeasonGoalSpec, "kind" | "place">, n: number, input: ObjectiveInput): number {
  const all = seasonGoalChance({ kind: spec.kind, count: n, place: spec.place }, input.level, input.cup);
  return all > 0 ? Math.pow(all, 1 / n) : 0;
}

function eventsOf(kind: SeasonGoalSpec["kind"]): number {
  if (kind === "regionalReach" || kind === "regionalFinish") return REGIONAL_WEEKS.length;
  if (kind === "majorQualify" || kind === "majorFinish") return MAJOR_WEEKS.length;
  if (kind === "cupFinal" || kind === "cupWin") return CAREER_SEASON_GOAL.cupsPerSeason;
  return 1;
}

/** The objective's chance now, from its progress (done, chances left) — Worlds goals keep their start chance until decided. */
export function chanceNowOf(
  spec: SeasonGoalSpec,
  progress: { done: number; target: number; left: number; hit: boolean; out: boolean },
  input: ObjectiveInput,
): number {
  if (progress.hit) return 1;
  if (progress.out) return 0;
  const n = eventsOf(spec.kind);
  if (n <= 1) return spec.chance;
  const p = perEventChance(spec, n, input);
  const left = Math.min(progress.left, n);
  return round3(calibratedChance(binomialTail(left, progress.target - progress.done, p), input.cal));
}

export function checkpointDelta(startChance: number, nowChance: number): number {
  return Math.round(clamp((nowChance - startChance) * B.checkpoint.scale, B.checkpoint.min, B.checkpoint.max));
}

/**
 * The ultimatum's mission over the season's events after `week`: a number of
 * Sunday regionals, top-8 regional finishes or Major berths, nearest
 * CAREER_BOARD.ultimatum.aim. Null when no event is left (never issued then).
 */
export function ultimatumMissionFor(week: number, input: ObjectiveInput): SeasonGoalSpec | null {
  const regionals = REGIONAL_WEEKS.filter((w) => w >= week).length;
  const majors = MAJOR_WEEKS.filter((w) => w >= week).length;
  const pool: SeasonGoalSpec[] = [];
  const add = (kind: SeasonGoalSpec["kind"], left: number, place?: number) => {
    if (left <= 0) return;
    const p = perEventChance({ kind, place }, eventsOf(kind), input);
    for (let k = 1; k <= left; k++) {
      const spec: SeasonGoalSpec = { kind, count: k, chance: round3(calibratedChance(binomialTail(left, k, p), input.cal)) };
      if (place !== undefined) spec.place = place;
      if (spec.chance > 0) pool.push(spec);
    }
  };
  add("regionalReach", regionals);
  add("regionalFinish", regionals, 8);
  add("regionalFinish", regionals, 4);
  add("majorQualify", majors);
  return nearest(pool, B.ultimatum.aim);
}

const PLACE: Record<Placement, number> = {
  champion: 1, runner_up: 2, third: 3, fourth: 4, top4: 4, top6: 6, top8: 8, swiss_exit: 16,
};

/** How far the mission is: the user's results of the season from its week on. */
export function missionProgressOf(
  u: BoardUltimatum,
  results: readonly CompactEventResult[],
): { done: number; target: number } {
  const mine = results.filter((r) => r.seasonIndex === u.issuedSeason && r.week >= u.fromWeek && r.userPlacement !== undefined);
  const spec = u.objective;
  let done = 0;
  if (spec.kind === "regionalReach") done = mine.filter((r) => r.tier === "regional").length;
  else if (spec.kind === "regionalFinish") done = mine.filter((r) => r.tier === "regional" && PLACE[r.userPlacement!] <= (spec.place ?? 8)).length;
  else if (spec.kind === "majorQualify") done = mine.filter((r) => r.tier === "major").length;
  return { done: Math.min(done, spec.count), target: spec.count };
}

// ---------------------------------------------------------------------------
// Board creation
// ---------------------------------------------------------------------------

export function newBoardState(input: {
  kind: BoardState["kind"];
  stature: ProfileKey;
  startSeason: number;
  weekWages: number;
  grantBase: number;
  wageRoom: number;
  confidence?: number;
}): BoardState {
  return {
    kind: input.kind,
    stature: input.stature,
    startSeason: input.startSeason,
    confidence: input.confidence ?? B.confidence.start,
    log: [],
    budgetMult: 1,
    grantBase: input.grantBase,
    wageRoom: input.wageRoom,
    weekWages: input.weekWages,
    season: null,
    warnedSeason: null,
    ultimatum: null,
    protectedUntil: null,
    freeze: null,
    dismissedSeason: null,
  };
}
