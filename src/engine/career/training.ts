/**
 * Road to Worlds — DEV-03 training packages (rc.34, docs/TRAINING-CONTRACT.md,
 * Gate 3a approved 30/10: decisions 1–7 A).
 *
 * Pure rules, no React, no RNG cursor (only `derivedFloat` for stable
 * per-entity defaults). The flow (`store/careerTraining.ts`) runs them day
 * by day; the Training screen, HQ's block and the coach hire card read the
 * same functions, so a number shown is the number that runs:
 *  - T1 the period grid (`periodOfDay`);
 *  - T2 a package's effect on one player (`packageEffectFor`) — it multiplies
 *    DEV-01's base and never goes below ×1.00; the peak stays DEV-01's;
 *  - T3 scrim levels, weekdays, the weekly diminishing pay and wear;
 *  - T4 a coach's three attributes and their effects (`coachProfileOf`), his
 *    growth (`coachAfterSeason`);
 *  - T5 the coach's proposal (`coachProposalFor`).
 */

import { CAREER_COACH_MARKET, CAREER_PLAN, CAREER_SCRIM, CAREER_TRAINING } from "@/config/balance";
import type { StatKey } from "../types";
import { DAYS_PER_SEASON, firstDayOfWeek } from "./calendar";
import { derivedFloat } from "./seeds";
import type {
  CoachState,
  DrillId,
  PlayerTweak,
  ScrimLevel,
  SquadFocus,
  TrainingObjective,
  TrainingPackage,
  TrainingWorkload,
} from "./types";

export const OBJECTIVES: readonly TrainingObjective[] = ["development", "preparation", "recovery"];
export const WORKLOADS: readonly TrainingWorkload[] = ["light", "normal", "heavy"];
export const SCRIM_LEVELS: readonly ScrimLevel[] = ["easy", "even", "hard"];
export const SQUAD_FOCI: readonly SquadFocus[] = ["balanced", ...CAREER_TRAINING.drills.map((d) => d.id as DrillId)];

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// T1 — the period
// ---------------------------------------------------------------------------

export interface TrainingPeriod {
  /** 0-based index inside the season. */
  index: number;
  startDay: number;
  endDay: number;
  /** Periods in a season (8 on the grid, 3 by split). */
  count: number;
}

function buildPeriods(mode: "grid" | "split"): TrainingPeriod[] {
  if (mode === "split") {
    const starts = CAREER_PLAN.splitStartWeeks.map((w) => firstDayOfWeek(w));
    return starts.map((startDay, i) => ({
      index: i,
      startDay,
      endDay: i + 1 < starts.length ? starts[i + 1] - 1 : DAYS_PER_SEASON,
      count: starts.length,
    }));
  }
  const len = Math.max(7, CAREER_PLAN.periodDays);
  const count = Math.ceil(DAYS_PER_SEASON / len);
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    startDay: i * len + 1,
    endDay: Math.min(DAYS_PER_SEASON, (i + 1) * len),
    count,
  }));
}

const PERIODS: Record<"grid" | "split", TrainingPeriod[]> = { grid: buildPeriods("grid"), split: buildPeriods("split") };

/** Every period of a season under the configured mode (decision 1-A grid; 1-B by split). */
export function periodsOfSeason(mode: "grid" | "split" = CAREER_PLAN.periodMode): TrainingPeriod[] {
  return PERIODS[mode];
}

/** The period a season day belongs to. */
export function periodOfDay(day: number, mode: "grid" | "split" = CAREER_PLAN.periodMode): TrainingPeriod {
  const all = PERIODS[mode];
  const d = clamp(day, 1, DAYS_PER_SEASON);
  return all.find((p) => d >= p.startDay && d <= p.endDay) ?? all[all.length - 1];
}

// ---------------------------------------------------------------------------
// T4 — the coach's three attributes
// ---------------------------------------------------------------------------

export interface CoachTrainingProfile {
  id: string;
  name: string;
  quality: number;
  experience: number;
  specialty: TrainingObjective;
  /** Quality → focus efficiency: the share of a package's effect that lands. */
  efficiency: number;
  /** Experience → plan quality: the share his own plan lands when he runs it alone. */
  planQuality: number;
  /** Experience → recovery: the share of wear he takes off. */
  wearCut: number;
  bonusType: StatKey;
  ceiling: number;
  source: CoachState["source"];
}

/** Focus efficiency for a coach quality (null = no coach: CAREER_PLAN.coach.coachless). */
export function coachEfficiencyFor(quality: number | null): number {
  const c = CAREER_PLAN.coach;
  if (quality === null) return c.coachless;
  return round2(clamp(c.efficiencyAt60 + (quality - 60) * c.efficiencyPerPoint, c.efficiencyRange[0], c.efficiencyRange[1]));
}

/** Plan quality for an experience (seasons): 0.85 at 0, +0.015 a season, at most 1. */
export function planQualityFor(experience: number): number {
  const c = CAREER_PLAN.coach;
  return round2(Math.min(1, c.planQualityBase + c.planQualityPerExperience * Math.max(0, experience)));
}

/** The share of wear an experienced coach takes off. */
export function coachWearCutFor(experience: number): number {
  const c = CAREER_PLAN.coach;
  return round2(Math.min(c.wearCutMax, c.wearCutPerExperience * Math.max(0, experience)));
}

/** A stable 0..1 per coach id (no career seed: a hired coach carries only his id). */
const coachFloat = (id: string, what: string): number => derivedFloat(0, `coach:${what}:${id}`);

/** T8: a coach hired before rc.34 — experience from his source (an ex-pro's playing years). */
export function defaultCoachExperience(coach: Pick<CoachState, "id" | "source">): number {
  if (coach.source === "real") return CAREER_COACH_MARKET.exPro.experience;
  const [lo, hi] = CAREER_COACH_MARKET.generated.standard.experience;
  return lo + Math.floor(coachFloat(coach.id, "exp") * (hi - lo + 1));
}

/** T8: a coach hired before rc.34 — a rolled specialty, stable per id. */
export function defaultCoachSpecialty(coach: Pick<CoachState, "id">): TrainingObjective {
  return OBJECTIVES[Math.floor(coachFloat(coach.id, "spec") * OBJECTIVES.length) % OBJECTIVES.length];
}

/** T4: the quality a coach can grow to (his quality + a stable 3–8, never above the max). */
export function defaultCoachCeiling(coach: Pick<CoachState, "id" | "overall">): number {
  const g = CAREER_COACH_MARKET.growth;
  const [lo, hi] = g.ceilingRoom;
  const room = lo + Math.floor(coachFloat(coach.id, "ceil") * (hi - lo + 1));
  return Math.min(g.ceilingMax, Math.max(coach.overall, Math.round(coach.overall + room)));
}

/** T4: a coach's training profile — every effect his card prints. Null = no coach. */
export function coachProfileOf(coach: CoachState | null | undefined): CoachTrainingProfile | null {
  if (!coach) return null;
  const experience = coach.experience ?? defaultCoachExperience(coach);
  return {
    id: coach.id,
    name: coach.name,
    quality: coach.overall,
    experience,
    specialty: coach.specialty ?? defaultCoachSpecialty(coach),
    efficiency: coachEfficiencyFor(coach.overall),
    planQuality: planQualityFor(experience),
    wearCut: coachWearCutFor(experience),
    bonusType: coach.bonusType,
    ceiling: coach.ceiling ?? defaultCoachCeiling(coach),
    source: coach.source,
  };
}

/** The buff level a coach quality prints ("~" / "+" / "++", market.ts's rule). */
export function coachBonusLevelFor(quality: number): string {
  return quality >= 85 ? "++" : quality >= 75 ? "+" : "~";
}

/**
 * T4 growth (at the rollover, the coach in post): +experience; quality
 * +0.5, or +1 when most of the season's periods ran his specialty, up to his
 * personal ceiling. Nothing else moves (his wage stays the deal he signed).
 */
export function coachAfterSeason(coach: CoachState, matchedMost: boolean): CoachState {
  const g = CAREER_COACH_MARKET.growth;
  const prof = coachProfileOf(coach)!;
  const step = matchedMost ? g.qualityPerSeasonMatched : g.qualityPerSeason;
  const quality = Math.round(Math.min(prof.ceiling, Math.max(coach.overall, coach.overall + step)) * 10) / 10;
  return {
    ...coach,
    overall: quality,
    experience: prof.experience + g.experiencePerSeason,
    specialty: prof.specialty,
    ceiling: prof.ceiling,
    bonusLevel: coachBonusLevelFor(quality),
  };
}

// ---------------------------------------------------------------------------
// T2 — a package's effect on one player
// ---------------------------------------------------------------------------

export interface PackageEffect {
  /** The session rate × DEV-01's base (≥ 1; 1 = the base). */
  sessionMult: number;
  /** The same package at the coachless efficiency — the coach's share is the difference. */
  coachlessMult: number;
  /** Attribute offset growth per training-week. */
  offsets: Partial<Record<StatKey, number>>;
  /** DEV-01's decline × this while it runs (recovery). */
  declineMult: number;
  /** Package-scrim XP and chemistry × this (preparation). */
  scrimMult: number;
  /** Wear points × this. */
  wearMult: number;
  /** Workload wear points a week (before wearMult). */
  wearPerWeek: number;
  /** Rest tweak: the base, no scrim, no wear. */
  rest: boolean;
}

export const BASE_EFFECT: PackageEffect = Object.freeze({
  sessionMult: 1,
  coachlessMult: 1,
  offsets: Object.freeze({}) as Partial<Record<StatKey, number>>,
  declineMult: 1,
  scrimMult: 1,
  wearMult: 1,
  wearPerWeek: 0,
  rest: false,
}) as PackageEffect;

/** The attributes a squad focus grows (the drill theme's). */
export function focusAttrsOf(focus: SquadFocus): readonly StatKey[] {
  if (focus === "balanced") return [];
  return (CAREER_TRAINING.drills.find((d) => d.id === focus)?.attrs ?? []) as readonly StatKey[];
}

/**
 * rc.36 (front T2): the drill theme of the fielded trio's weakest stat (the
 * theme's attributes averaged; ties keep the drills' order) — the focus the
 * RECOMMENDED tag marks without a coach (CAREER_PLAN.recommendedFocus "need").
 */
export function weakestFocusOf(stats: Partial<Record<StatKey, number>> | null | undefined): SquadFocus {
  if (!stats) return "balanced";
  let best: SquadFocus = "balanced";
  let low = Infinity;
  for (const d of CAREER_TRAINING.drills) {
    const vals = (d.attrs as readonly StatKey[]).map((a) => stats[a]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (avg < low - 1e-9) {
      low = avg;
      best = d.id as DrillId;
    }
  }
  return best;
}

/**
 * rc.36 (front T2, CAREER_PLAN.payout): the session multiplier paid along the
 * way for a plan running at `mult` — alongShare of it, never under the base
 * (×1): the rest is held for the cycle's completion.
 */
export function paidSessionMultFor(mult: number): number {
  return Math.max(1, mult * CAREER_PLAN.payout.alongShare);
}

/** The tweak that applies to a player (none = he follows the squad). */
export function tweakOf(pkg: TrainingPackage | null, playerId: string): PlayerTweak | null {
  return pkg?.tweaks?.[playerId] ?? null;
}

/**
 * T2: what a package does for one player under this coach. `unsupervised`
 * = the coach runs his own plan alone (mode "coach"): its effects land at
 * his plan quality. Every main effect lands at the coach effect (focus
 * efficiency; no coach = 0.5) × his specialty's +25 % on its objective.
 */
export function packageEffectFor(
  pkg: TrainingPackage | null,
  coach: CoachTrainingProfile | null,
  playerId: string,
  opts: { unsupervised?: boolean } = {},
): PackageEffect {
  if (!pkg) return BASE_EFFECT;
  const tweak = tweakOf(pkg, playerId);
  if (tweak?.rest) return { ...BASE_EFFECT, offsets: {}, rest: true, wearMult: 0 };
  const obj = CAREER_PLAN.objectives[pkg.objective];
  const load = CAREER_PLAN.workloads[tweak?.workload ?? pkg.workload] ?? CAREER_PLAN.workloads.normal;
  const spec = coach && coach.specialty === pkg.objective ? 1 + CAREER_PLAN.coach.specialtyBoost : 1;
  const strength =
    (coach ? coach.efficiency : CAREER_PLAN.coach.coachless) * spec * (coach && opts.unsupervised ? coach.planQuality : 1);
  const coachless = CAREER_PLAN.coach.coachless;
  const boost = obj.boost * load.boostScale;
  let sessionMult = 1 + boost * strength;
  let coachlessMult = 1 + boost * coachless;
  const offsets: Partial<Record<StatKey, number>> = {};
  if (tweak?.focus) {
    offsets[tweak.focus] = CAREER_PLAN.tweakFocus.offsetPerWeek;
    sessionMult = Math.max(1, sessionMult * CAREER_PLAN.tweakFocus.overallShare);
    coachlessMult = Math.max(1, coachlessMult * CAREER_PLAN.tweakFocus.overallShare);
  } else {
    for (const a of focusAttrsOf(pkg.focus)) offsets[a] = CAREER_PLAN.focusOffsetPerWeek;
  }
  const wearMult =
    (1 - load.wearCut) * Math.max(0, 1 - obj.wearCut * strength) * (1 - (coach?.wearCut ?? 0));
  return {
    sessionMult: Math.round(sessionMult * 10000) / 10000,
    coachlessMult: Math.round(coachlessMult * 10000) / 10000,
    offsets,
    declineMult: Math.round(Math.max(0, 1 - obj.declineCut * strength) * 10000) / 10000,
    scrimMult: Math.round((1 + obj.scrimBonus * strength) * 10000) / 10000,
    wearMult: Math.round(wearMult * 10000) / 10000,
    wearPerWeek: load.wearPerWeek,
    rest: false,
  };
}

/**
 * The objective's headline effect in percent for a coach (the hire card,
 * HQ's coach line): the session boost of a normal-workload package — e.g.
 * "+22 % on Development" for a quality-82 development specialist
 * (0.20 × 0.89 × 1.25). Preparation and recovery quote their main effect.
 */
export function objectiveEffectPct(objective: TrainingObjective, coach: CoachTrainingProfile | null): number {
  const obj = CAREER_PLAN.objectives[objective];
  const spec = coach && coach.specialty === objective ? 1 + CAREER_PLAN.coach.specialtyBoost : 1;
  const strength = (coach ? coach.efficiency : CAREER_PLAN.coach.coachless) * spec;
  const main = objective === "development" ? obj.boost : objective === "preparation" ? obj.scrimBonus : obj.wearCut;
  return Math.round(main * strength * 100);
}

// ---------------------------------------------------------------------------
// T3 — scrims
// ---------------------------------------------------------------------------

/** "The coach picks": the level his proposal would run for this objective. */
export function resolveScrimLevel(pkg: Pick<TrainingPackage, "scrimLevel" | "objective">): ScrimLevel {
  if (pkg.scrimLevel !== "auto") return pkg.scrimLevel;
  return CAREER_PLAN.proposal[pkg.objective].scrimLevel as ScrimLevel;
}

/** The weekdays (1 = Mon … 7 = Sun) a package's scrims run on. */
export function scrimDaysOf(perWeek: number): readonly number[] {
  const n = clamp(Math.round(perWeek), 0, CAREER_SCRIM.package.maxPerWeek);
  return n > 0 ? (CAREER_SCRIM.package.days[n] ?? []) : [];
}

/** The k-th (0-based) package scrim of a week pays this share (100 / 60 / 30 %). */
export function scrimWeekShare(k: number): number {
  const w = CAREER_SCRIM.package.weekShare;
  return w[Math.min(Math.max(0, k), w.length - 1)] ?? 0;
}

/**
 * T3: one package scrim's XP in training-week equivalents — the level's
 * weeks × the week's diminishing share × the opponent's field quality × the
 * package's scrim multiplier (preparation). The flow, the projection and the
 * probe read this one function.
 */
export function scrimXpWeeksFor(level: ScrimLevel, k: number, quality: number, scrimMult: number): number {
  return CAREER_SCRIM.levels[level].xpWeeks * scrimWeekShare(k) * quality * scrimMult;
}

/** T3: the cap on a period's scrim XP, as a multiple of its session gain (25 % of the total → 1/3). */
export function scrimCapRatio(): number {
  return CAREER_PLAN.scrimCapShare / Math.max(1e-6, 1 - CAREER_PLAN.scrimCapShare);
}

/**
 * The scrim opponent for a level: orgs inside the level's gap band first
 * (nearest its centre), else the one nearest the band; a stable float
 * rotates among the three best so the sparring varies.
 */
export function pickScrimOpponent(
  cands: readonly { ref: string; gap: number }[],
  level: ScrimLevel,
  f: number,
): string | null {
  const [lo, hi] = CAREER_SCRIM.levels[level].gap;
  const mid = (lo + hi) / 2;
  const dist = (g: number) => (g < lo ? lo - g : g > hi ? g - hi : 0);
  const sorted = [...cands].sort(
    (a, b) => dist(a.gap) - dist(b.gap) || Math.abs(a.gap - mid) - Math.abs(b.gap - mid) || a.ref.localeCompare(b.ref),
  );
  const inBand = sorted.filter((c) => dist(c.gap) === 0);
  const pool = inBand.length > 0 ? inBand.slice(0, 3) : sorted.slice(0, 1);
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(f * pool.length))].ref;
}

/** Decision 6-A: the pre-event unavailability chance a period's squad wear adds (≤ wear.chanceMax). */
export function unavailabilityAddFor(wear: number, periodDays: number): number {
  const w = CAREER_PLAN.wear;
  const perNominal = Math.max(0, wear) * (w.nominalDays / Math.max(1, periodDays));
  return Math.round(Math.min(w.chanceMax, w.chancePerPoint * perNominal) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

/** A package with every field inside its range (tweaks without a known player id are kept — the flow prunes). */
export function sanitizePackage(pkg: Partial<TrainingPackage> | null | undefined): TrainingPackage {
  const objective = OBJECTIVES.includes(pkg?.objective as TrainingObjective) ? (pkg!.objective as TrainingObjective) : "development";
  const focus = SQUAD_FOCI.includes(pkg?.focus as SquadFocus) ? (pkg!.focus as SquadFocus) : "balanced";
  const workload = WORKLOADS.includes(pkg?.workload as TrainingWorkload) ? (pkg!.workload as TrainingWorkload) : "normal";
  const scrimsPerWeek = clamp(Math.round(Number(pkg?.scrimsPerWeek ?? 0) || 0), 0, CAREER_SCRIM.package.maxPerWeek);
  const scrimLevel =
    pkg?.scrimLevel === "auto" || SCRIM_LEVELS.includes(pkg?.scrimLevel as ScrimLevel)
      ? (pkg!.scrimLevel as ScrimLevel | "auto")
      : "auto";
  const tweaks: Record<string, PlayerTweak> = {};
  for (const [id, t] of Object.entries(pkg?.tweaks ?? {})) {
    if (!t) continue;
    const clean: PlayerTweak = {};
    if (t.rest) clean.rest = true;
    else {
      if (t.focus) clean.focus = t.focus;
      if (t.workload && WORKLOADS.includes(t.workload)) clean.workload = t.workload;
    }
    if (Object.keys(clean).length > 0) tweaks[id] = clean;
  }
  return { objective, focus, workload, scrimsPerWeek, scrimLevel, ...(Object.keys(tweaks).length > 0 ? { tweaks } : {}) };
}

/** The squad focus whose theme trains a stat (the coach's buff → his focus). */
export function focusForStat(stat: StatKey | null | undefined): SquadFocus {
  if (!stat) return "balanced";
  const d = CAREER_TRAINING.drills.find((row) => (row.attrs as readonly StatKey[]).includes(stat));
  return d ? (d.id as DrillId) : "balanced";
}

/**
 * T5: the coach's proposal for a period — development by default,
 * preparation for a period with a Major or Worlds, recovery when the last
 * period's squad wear reached `proposal.recoveryWearAt`; the objective's
 * workload and scrims (CAREER_PLAN.proposal) and the theme of his buff stat.
 */
export function coachProposalFor(input: {
  /** rc.35: null = no coach — the recommended plan (a balanced focus). */
  coach: Pick<CoachTrainingProfile, "bonusType"> | null;
  bigEvent: boolean;
  lastWear: number;
  /** rc.36 (front T2): the focus without a coach (the squad's need); absent = balanced. */
  needFocus?: SquadFocus;
}): { package: TrainingPackage; reasonKey: "default" | "event" | "wear" } {
  const P = CAREER_PLAN.proposal;
  const reasonKey: "default" | "event" | "wear" =
    input.lastWear >= P.recoveryWearAt ? "wear" : input.bigEvent ? "event" : "default";
  const objective: TrainingObjective = reasonKey === "wear" ? "recovery" : reasonKey === "event" ? "preparation" : "development";
  const row = P[objective];
  return {
    package: {
      objective,
      focus: input.coach ? focusForStat(input.coach.bonusType) : (input.needFocus ?? "balanced"),
      workload: row.workload as TrainingWorkload,
      scrimsPerWeek: row.scrimsPerWeek,
      scrimLevel: row.scrimLevel as ScrimLevel,
    },
    reasonKey,
  };
}

// ---------------------------------------------------------------------------
// rc.35 (front T) — the simplified package: objective + intensity + scrims
// ---------------------------------------------------------------------------

/** The scrim choice the screen shows: none, or a level. */
export type ScrimChoice = "off" | ScrimLevel;
export const SCRIM_CHOICES: readonly ScrimChoice[] = ["off", "easy", "even", "hard"];

/** A package's scrim choice ("auto" reads as the level it resolves to). */
export function scrimChoiceOf(pkg: Pick<TrainingPackage, "scrimsPerWeek" | "scrimLevel" | "objective"> | null): ScrimChoice {
  if (!pkg || pkg.scrimsPerWeek <= 0) return "off";
  return resolveScrimLevel(pkg);
}

/**
 * rc.35: a package from the screen's choices; a scrim level runs
 * CAREER_PLAN.scrimsPerWeekOnLevel a week. No per-player tweaks. rc.36
 * (front T2, Miguel): the squad focus is a choice again (one per plan).
 */
export function simplePackageOf(input: {
  objective: TrainingObjective;
  workload: TrainingWorkload;
  scrims: ScrimChoice;
  focus?: SquadFocus;
}): TrainingPackage {
  return sanitizePackage({
    objective: input.objective,
    focus: input.focus ?? "balanced",
    workload: input.workload,
    scrimsPerWeek: input.scrims === "off" ? 0 : CAREER_PLAN.scrimsPerWeekOnLevel,
    scrimLevel: input.scrims === "off" ? "auto" : input.scrims,
  });
}

/** Two packages are the same routine (tweaks included). */
export function samePackage(a: TrainingPackage | null, b: TrainingPackage | null): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify(sanitizePackage(a)) === JSON.stringify(sanitizePackage(b));
}
