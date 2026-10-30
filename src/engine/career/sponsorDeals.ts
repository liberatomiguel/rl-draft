/**
 * Road to Worlds — sponsor deals (rc.34, ECO-04 and ECO-05's cap;
 * docs/SPONSOR-CONTRACT.md, Gate 3a approved 30/10: decisions 1–5 A, 6-B, 7-A).
 *
 * The sponsor half of the economy (economy.ts owns every other money
 * formula; this module prices the deals with its `quantize` and its money
 * index). Pure and deterministic: brand picks come from `derivedFloat`, the
 * team's level and the results are handed in by the flow.
 *
 *  - The deal (S1): three profiles share their own ceiling between weekly
 *    pay, a fixed part (on signing, or — Bold — the day its first goal is
 *    reached) and a bonus per goal; one split, one season or two seasons.
 *    Each ceiling is sized so the deal's expected value at its goals' word
 *    equals the tier's value for the Mondays it pays (s1).
 *  - Goals (S2): one per split, built from the team's level (its seed
 *    rating ranked in its region) and the split's events, all still ahead
 *    when the goal is set; a word (Likely / Even / Stretch) from the
 *    engine's chance model (CAREER_SPONSOR.goalModel, calibrated on the
 *    harness). Never below `wordMin.stretch`.
 *  - Fines (S3): Balanced and Bold only, never on Easy; the profile's share
 *    × the goal's bonus × the shortfall, capped, in Monday instalments.
 *  - Other income (S7, ECO-05): the per-split count and the season share.
 */

import {
  CAREER_CALENDAR,
  CAREER_ECONOMY,
  CAREER_PAYROLL,
  CAREER_SLOTS,
  CAREER_SPONSOR,
} from "@/config/balance";
import { SPONSOR_BRANDS } from "@/data/career/sponsors";
import type { Placement, Region } from "../types";
import { firstDayOfWeek, weekOfDay } from "./calendar";
import { moneyIndex, periodOfWeek, quantize, quantizeWeekly } from "./economy";
import { derivedFloat, streams } from "./seeds";
import type {
  CareerDifficulty,
  CompactEventResult,
  IncomeTally,
  SponsorFineState,
  SponsorGoal,
  SponsorGoalWord,
  SponsorObjectiveKind,
  SponsorProfile,
  SponsorState,
  SponsorTerms,
} from "./types";

export const SPONSOR_PROFILES: readonly SponsorProfile[] = ["steady", "balanced", "bold"];

/** A day on the career clock. */
export interface CareerDay {
  seasonIndex: number;
  day: number;
}

const DAYS_PER_SEASON = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;

/** Absolute day number (season 0 day 1 = 1) — for ordering and counting Mondays. */
export function absDayOf(d: CareerDay): number {
  return d.seasonIndex * DAYS_PER_SEASON + d.day;
}

/** Is `a` strictly after `b`? */
export function isAfter(a: CareerDay, b: CareerDay): boolean {
  return absDayOf(a) > absDayOf(b);
}

// ---------------------------------------------------------------------------
// Splits ("slots") and their dates
// ---------------------------------------------------------------------------

/** The split weeks: its first Monday, its first regional week, its Major week, the Monday it settles. */
const SPLIT_WEEKS: Record<1 | 2 | 3, { start: number; firstEvent: number; lastRegional: number; major: number; settle: number }> = {
  1: { start: 3, firstEvent: 4, lastRegional: 8, major: 10, settle: 11 },
  2: { start: 13, firstEvent: 14, lastRegional: 18, major: 20, settle: 21 },
  3: { start: 23, firstEvent: 24, lastRegional: 28, major: 30, settle: CAREER_CALENDAR.worldsWindowWeek },
};

/** A split as one number: seasonIndex × 3 + split − 1. */
export function slotOf(seasonIndex: number, split: 1 | 2 | 3): number {
  return seasonIndex * 3 + split - 1;
}

export function slotSeason(slot: number): number {
  return Math.floor(slot / 3);
}

export function slotSplit(slot: number): 1 | 2 | 3 {
  return ((slot % 3) + 1) as 1 | 2 | 3;
}

export function splitWeeksOf(slot: number) {
  return SPLIT_WEEKS[slotSplit(slot)];
}

/** The boundary Monday a split settles on (W11 / W21 / W31 of its season). */
export function settleDayOf(slot: number): CareerDay {
  return { seasonIndex: slotSeason(slot), day: firstDayOfWeek(splitWeeksOf(slot).settle) };
}

/** The Monday a split starts (W3 / W13 / W23) — when a running deal's goal for it is set. */
export function splitStartDayOf(slot: number): CareerDay {
  return { seasonIndex: slotSeason(slot), day: firstDayOfWeek(splitWeeksOf(slot).start) };
}

/**
 * The first split a decision made today covers: the first whose first event
 * week is still ahead (all of its events can be entered).
 */
export function firstSlotFrom(at: CareerDay): number {
  const week = weekOfDay(at.day);
  for (const split of [1, 2, 3] as const) {
    if (SPLIT_WEEKS[split].firstEvent > week) return slotOf(at.seasonIndex, split);
  }
  return slotOf(at.seasonIndex + 1, 1);
}

/**
 * A decision's deadline: the Sunday before its first split's first event
 * week, never past the season's last day (a decision made at the Worlds
 * window lapses with the season; the rollover offers again, in the new
 * season's money).
 */
export function decideByFor(at: CareerDay, firstSlot: number): CareerDay {
  const season = slotSeason(firstSlot);
  const sunday = (splitWeeksOf(firstSlot).firstEvent - 1) * CAREER_CALENDAR.daysPerWeek;
  if (season > at.seasonIndex) return { seasonIndex: at.seasonIndex, day: DAYS_PER_SEASON };
  return { seasonIndex: season, day: sunday };
}

/** Mondays strictly after `from`, up to and including `to` (0 when `to` is not after `from`). */
export function mondaysBetween(from: CareerDay, to: CareerDay): number {
  const a = absDayOf(from);
  const b = absDayOf(to);
  if (b <= a) return 0;
  return Math.floor((b - 1) / 7) - Math.floor((a - 1) / 7);
}

/** The Mondays a deal still pays from today (its weekly pay on each). */
export function mondaysLeftOf(terms: Pick<SponsorTerms, "endsOn">, today: CareerDay): number {
  return mondaysBetween(today, terms.endsOn);
}

/** The day a goal's last counting event ends: the split's third regional, the Major's field or its final. */
export function goalDeadlineOf(goal: Pick<SponsorGoal, "slot" | "kind">): CareerDay {
  const w = splitWeeksOf(goal.slot);
  const seasonIndex = slotSeason(goal.slot);
  const sunday = (week: number) => week * CAREER_CALENDAR.daysPerWeek;
  switch (goal.kind) {
    case "regionalFinish":
    case "regionalReach":
      return { seasonIndex, day: sunday(w.lastRegional) };
    case "majorQualify":
      return { seasonIndex, day: firstDayOfWeek(w.major) };
    default:
      return { seasonIndex, day: sunday(w.major) };
  }
}

// ---------------------------------------------------------------------------
// The team's level and the chance model (S2)
// ---------------------------------------------------------------------------

export interface TeamLevel {
  /** 1-based rank among the region's teams (the user's rating plus the difficulty edge vs. the AI orgs). */
  rank: number;
  /** Teams ranked (the region's AI orgs + the user). */
  teams: number;
  /** The region's Major slots. */
  slots: number;
  /** 1-based rank in the expected Major field (each region's top orgs by rating, its slots' worth). */
  majorRank: number;
  /**
   * Rating margins (the user's rating plus the difficulty edge, minus the
   * reference AI rating): against the region's 12th org (the middle of the
   * Saturday qualifier), its 8th, 4th and best orgs, its `slots`-th (the
   * Major's cut), and the expected Major field's 4th and best.
   */
  vs12: number;
  vs8: number;
  /** Against the region's 6th org (a regional top 6). */
  vs6: number;
  vs4: number;
  vs1: number;
  vsCut: number;
  vsMajor4: number;
  vsMajor1: number;
}

/** The `n`-th best rating (1-based), or the last one when there are fewer. */
function nthBest(ratings: readonly number[], n: number): number {
  if (ratings.length === 0) return 0;
  return ratings[Math.min(ratings.length, Math.max(1, n)) - 1];
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * The team's level the goals are built from (S2): its seed rating (the R45
 * seeding's, plus CAREER_SPONSOR.levelEdge for the difficulty) ranked among
 * its region's AI orgs, and its margins over the teams that decide each
 * goal — the region's 8th, 4th and best orgs, the Major's cut, and the
 * expected Major field (each region's top orgs, its slots' worth).
 */
export function teamLevelFor(input: {
  region: Region;
  userRating: number;
  difficulty: CareerDifficulty;
  orgs: readonly { region: Region; rating: number }[];
}): TeamLevel {
  const rating = input.userRating + (CAREER_SPONSOR.levelEdge[input.difficulty] ?? 0);
  const home = input.orgs
    .filter((o) => o.region === input.region)
    .map((o) => o.rating)
    .sort((a, b) => b - a);
  const field: number[] = [];
  for (const region of Object.keys(CAREER_SLOTS.major) as Region[]) {
    const seats = CAREER_SLOTS.major[region] ?? 0;
    field.push(
      ...input.orgs
        .filter((o) => o.region === region)
        .map((o) => o.rating)
        .sort((a, b) => b - a)
        .slice(0, seats),
    );
  }
  field.sort((a, b) => b - a);
  const slots = CAREER_SLOTS.major[input.region] ?? 1;
  return {
    rank: 1 + home.filter((r) => r > rating).length,
    teams: home.length + 1,
    slots,
    majorRank: 1 + field.filter((r) => r > rating).length,
    vs12: round1(rating - nthBest(home, 12)),
    vs8: round1(rating - nthBest(home, 8)),
    vs6: round1(rating - nthBest(home, 6)),
    vs4: round1(rating - nthBest(home, 4)),
    vs1: round1(rating - nthBest(home, 1)),
    vsCut: round1(rating - nthBest(home, slots)),
    vsMajor4: round1(rating - nthBest(field, 4)),
    vsMajor1: round1(rating - nthBest(field, 1)),
  };
}

const M = CAREER_SPONSOR.goalModel;

/** The model's curve: a logistic in the rating margin, centred on `mid`, `scale` points wide. */
function curve(margin: number, c: { mid: number; scale: number }): number {
  return 1 / (1 + Math.exp(-(margin - c.mid) / Math.max(0.1, c.scale)));
}

/**
 * One regional week (its Saturday qualifier included): the chance to finish
 * at `place` or better (8, 4 or 1) — or, at 16, to play the Sunday regional
 * at all (direct, or through the qualifier).
 */
export function regionalChance(level: Pick<TeamLevel, "vs12" | "vs8" | "vs6" | "vs4" | "vs1">, place: number): number {
  if (place >= 16) return curve(level.vs12 ?? level.vs8 - 3, M.regionalReach);
  if (place >= 8) return curve(level.vs8, M.regionalTop8);
  if (place >= 6) return curve(level.vs6 ?? (level.vs8 + level.vs4) / 2, M.regionalTop6);
  if (place >= 4) return curve(level.vs4, M.regionalTop4);
  return curve(level.vs1, M.regionalWin);
}

/** P(at least k successes in n independent tries at p). */
export function binomialTail(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  for (let i = k; i <= n; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    total += c * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return Math.min(1, Math.max(0, total));
}

/** The chance to qualify for a split's Major: the margin over the region's last Major seat. */
export function majorQualifyChance(level: Pick<TeamLevel, "vsCut">): number {
  return curve(level.vsCut, M.majorQualify);
}

/** The engine's estimate that a goal is reached (0–1): the model (CAREER_SPONSOR.goalModel) at the team's level. */
export function goalChance(goal: Pick<SponsorGoal, "kind" | "count" | "place">, level: TeamLevel): number {
  switch (goal.kind) {
    case "enterEvents":
      return goal.count <= M.enterEvents.count ? M.enterEvents.p : 0;
    case "regionalFinish":
      return binomialTail(3, goal.count, regionalChance(level, goal.place ?? 8));
    case "regionalReach":
      return binomialTail(3, goal.count, regionalChance(level, 16));
    case "majorQualify":
      return majorQualifyChance(level);
    case "majorFinish":
      return (
        majorQualifyChance(level) *
        ((goal.place ?? 4) >= 4 ? curve(level.vsMajor4, M.majorTop4) : curve(level.vsMajor1, M.majorWin))
      );
  }
}

/** The word an estimate shows (decision 4-A): never a percentage. */
export function wordOf(chance: number): SponsorGoalWord {
  if (chance >= CAREER_SPONSOR.wordMin.likely) return "likely";
  if (chance >= CAREER_SPONSOR.wordMin.even) return "even";
  return "stretch";
}

/** Every goal a split offers, easiest first in each family (the tie-break order). */
export const SPONSOR_GOAL_CANDIDATES: readonly Pick<SponsorGoal, "kind" | "count" | "place">[] = [
  { kind: "enterEvents", count: M.enterEvents.count },
  { kind: "regionalReach", count: 1 },
  { kind: "regionalReach", count: 2 },
  { kind: "regionalReach", count: 3 },
  { kind: "regionalFinish", count: 1, place: 8 },
  { kind: "regionalFinish", count: 2, place: 8 },
  { kind: "regionalFinish", count: 1, place: 6 },
  { kind: "regionalFinish", count: 1, place: 4 },
  { kind: "majorQualify", count: 1 },
  { kind: "regionalFinish", count: 3, place: 8 },
  { kind: "regionalFinish", count: 2, place: 6 },
  { kind: "regionalFinish", count: 2, place: 4 },
  { kind: "regionalFinish", count: 1, place: 1 },
  { kind: "majorFinish", count: 1, place: 4 },
  { kind: "regionalFinish", count: 3, place: 6 },
  { kind: "regionalFinish", count: 3, place: 4 },
  { kind: "regionalFinish", count: 2, place: 1 },
  { kind: "majorFinish", count: 1, place: 1 },
];

/**
 * The split's goal at a word: among the split's goals the engine rates at
 * least `wordMin.stretch` (never unreachable), the one closest to the
 * word's chance, preferring one that shows the word itself.
 */
export function pickGoal(word: SponsorGoalWord, level: TeamLevel, slot: number): SponsorGoal {
  const target = CAREER_SPONSOR.wordChance[word];
  const rated = SPONSOR_GOAL_CANDIDATES.map((c) => ({ ...c, chance: goalChance(c, level) })).filter(
    (c) => c.chance >= CAREER_SPONSOR.wordMin.stretch,
  );
  const pool = rated.some((c) => wordOf(c.chance) === word) ? rated.filter((c) => wordOf(c.chance) === word) : rated;
  let best = pool[0];
  for (const c of pool) if (Math.abs(c.chance - target) < Math.abs(best.chance - target) - 1e-9) best = c;
  const chance = Math.round(best.chance * 1000) / 1000;
  const goal: SponsorGoal = { slot, kind: best.kind, count: best.count, chance, word: wordOf(chance) };
  if (best.place !== undefined) goal.place = best.place;
  return goal;
}

/** The nearest pre-rc.34 objective kind of a goal (the analytics' `objectiveKind`, the deal's legacy field). */
export function legacyKindOf(goal: Pick<SponsorGoal, "kind">): SponsorObjectiveKind {
  switch (goal.kind) {
    case "enterEvents":
    case "regionalReach":
      return "enterEvents";
    case "regionalFinish":
      return "regionalTop8";
    case "majorQualify":
      return "majorQualify";
    case "majorFinish":
      return "majorTop4";
  }
}

// ---------------------------------------------------------------------------
// Goal progress, read off the season's results
// ---------------------------------------------------------------------------

const PLACE: Record<Placement, number> = {
  champion: 1,
  runner_up: 2,
  third: 3,
  fourth: 4,
  top4: 4,
  top6: 6,
  top8: 8,
  swiss_exit: 16,
};

export interface GoalProgress {
  done: number;
  target: number;
  hit: boolean;
}

/**
 * How far a goal is, from the user's results (`CompactEventResult` rows
 * with a `userPlacement`) of its split, and — for a Major goal — whether
 * the user is in the split's announced Major field right now.
 */
export function goalProgressOf(
  goal: Pick<SponsorGoal, "slot" | "kind" | "count" | "place">,
  ctx: { results: readonly CompactEventResult[]; inMajorField?: boolean },
): GoalProgress {
  const season = slotSeason(goal.slot);
  const split = slotSplit(goal.slot);
  const w = splitWeeksOf(goal.slot);
  const mine = ctx.results.filter(
    (r) =>
      r.userPlacement !== undefined &&
      r.seasonIndex === season &&
      (r.split === split || (r.split === undefined && r.week >= w.start && r.week <= w.major)),
  );
  const target = Math.max(1, goal.count);
  let done = 0;
  switch (goal.kind) {
    case "enterEvents":
      done = mine.length;
      break;
    case "regionalFinish":
      done = mine.filter((r) => r.tier === "regional" && PLACE[r.userPlacement!] <= (goal.place ?? 8)).length;
      break;
    case "regionalReach":
      done = mine.filter((r) => r.tier === "regional").length;
      break;
    case "majorQualify":
      done = ctx.inMajorField || mine.some((r) => r.tier === "major") ? 1 : 0;
      break;
    case "majorFinish":
      done = mine.some((r) => r.tier === "major" && PLACE[r.userPlacement!] <= (goal.place ?? 4)) ? 1 : 0;
      break;
  }
  return { done: Math.min(done, target), target, hit: done >= target };
}

/** A missed goal's shortfall (0–1): the part of it not reached (a top 8 in one of two regionals is ½). */
export function shortfallOf(progress: GoalProgress): number {
  return progress.hit ? 0 : Math.max(0, Math.min(1, (progress.target - progress.done) / progress.target));
}

// ---------------------------------------------------------------------------
// The deal's money (S1) and its fines (S3)
// ---------------------------------------------------------------------------

/**
 * The tier's value per Monday: base × (splits + the signing payment's
 * splits) + bonus × splits × valueBonusShare, a season's worth spread over
 * its 32 Mondays — × the difficulty's sponsorMult and the sponsor stream's
 * money index (M1) at the offer's season.
 */
export function tierValuePerWeek(tier: 1 | 2 | 3 | 4, seasonIndex: number, difficulty: CareerDifficulty): number {
  const row = CAREER_SPONSOR.tiers[tier - 1];
  const splits = CAREER_PAYROLL.splitsPerSeason;
  const season =
    row.base * (splits + CAREER_SPONSOR.signingBonusSplits) + row.bonus * splits * CAREER_SPONSOR.valueBonusShare;
  const mult = CAREER_ECONOMY.sponsorMult[difficulty] * moneyIndex(seasonIndex, "sponsor");
  return (season * mult) / CAREER_PAYROLL.weeksPerSeason;
}

/**
 * The share of the tier's value a sponsor pays at the team's level (rc.34,
 * "deals scaled to the team's level" — the snowball lever at the top):
 * the newcomer tiers (T1, T2) always pay in full; a Tier 3 brand pays a
 * Major side in full (the margin over the region's last Major seat), a
 * Tier 4 brand a world contender (the margin over the expected Major
 * field's 4th) — below that, `perPoint` less a rating point, never under
 * the tier's floor (CAREER_SPONSOR.levelValue).
 */
export function levelValueShareOf(tier: 1 | 2 | 3 | 4, level: Pick<TeamLevel, "vsCut" | "vsMajor4">): number {
  const L = CAREER_SPONSOR.levelValue;
  const floor = (L.floor as Record<number, number>)[tier];
  if (floor === undefined || floor >= 1) return 1;
  const margin = tier >= 4 ? level.vsMajor4 : level.vsCut;
  if (!Number.isFinite(margin) || margin >= 0) return 1;
  return Math.max(floor, Math.round((1 + L.perPoint * margin) * 100) / 100);
}

/** Fines apply to this profile on this difficulty (decision 1-A: never Steady, never Easy). */
export function finesApply(profile: SponsorProfile, difficulty: CareerDifficulty): boolean {
  return difficulty !== "easy" && CAREER_SPONSOR.profiles[profile].fineShare > 0;
}

/** A missed goal's fine: fineShare × the goal's bonus × the shortfall, at most the cap. */
export function fineFor(terms: Pick<SponsorTerms, "fineShare" | "fineCap">, bonus: number, shortfall: number): number {
  if (terms.fineShare <= 0 || terms.fineCap <= 0 || shortfall <= 0) return 0;
  return quantize(Math.min(terms.fineCap, terms.fineShare * bonus * shortfall));
}

/** The most a missed goal can cost (a full miss) — the figure the offer prints. */
export function fineMaxOf(terms: Pick<SponsorTerms, "fineShare" | "fineCap">, bonus: number): number {
  return fineFor(terms, bonus, 1);
}

/**
 * A fine spread over CAREER_SPONSOR.fines.spreadMondays Monday instalments
 * (each a whole quantum, rounded up, so it never takes more Mondays; the
 * last one is what is left). The Monday funnel books them
 * (economy.weeklyPayroll, sponsorFineDueOf).
 */
export function fineScheduleFor(sponsorId: string, fine: number): SponsorFineState | null {
  if (fine <= 0) return null;
  const q = CAREER_ECONOMY.roundQuantum;
  const spread = Math.max(1, CAREER_SPONSOR.fines.spreadMondays);
  const perMonday = Math.max(q, Math.ceil(fine / spread / q) * q);
  return { sponsorId, remaining: fine, perMonday };
}

interface ProfileRow {
  weeklyShare: number;
  fixedShare: number;
  fixedKind: "signing" | "milestone";
  bonusShare: number;
  fineShare: number;
  word: SponsorGoalWord;
  lengthSplits: number;
}

function profileRow(profile: SponsorProfile): ProfileRow {
  return CAREER_SPONSOR.profiles[profile] as ProfileRow;
}

/**
 * A deal's expected value at its goals' chance, from its figures: weekly ×
 * Mondays + the fixed part (a milestone at the chance any goal is reached)
 * + the bonuses at the chance − the fines a miss costs.
 */
export function expectedValueOf(input: {
  weekly: number;
  mondays: number;
  fixed: number;
  fixedKind: "signing" | "milestone";
  bonus: number;
  goals: number;
  chance: number;
  fineMax: number;
}): number {
  const { weekly, mondays, fixed, fixedKind, bonus, goals, chance, fineMax } = input;
  const anyHit = 1 - Math.pow(1 - chance, goals);
  const fixedEv = fixedKind === "milestone" ? fixed * anyHit : fixed;
  return weekly * mondays + fixedEv + goals * (chance * bonus - (1 - chance) * fineMax);
}

export interface DealQuote {
  weekly: number;
  fixed: number;
  bonus: number;
  fineShare: number;
  fineCap: number;
  mondays: number;
  ev: number;
  ceiling: number;
}

/**
 * Price a profile at a tier for the Mondays it pays: the ceiling C solves
 * EV(C) = the tier's value × Mondays (every term is linear in C), then the
 * figures are quantized and the EV and the ceiling re-read from them.
 */
export function quoteDeal(input: {
  profile: SponsorProfile;
  tier: 1 | 2 | 3 | 4;
  seasonIndex: number;
  difficulty: CareerDifficulty;
  mondays: number;
  goals: number;
  /** The goals' chance the deal is priced at: its first goal's estimate (default: the profile word's chance). */
  chance?: number;
  /** The share of the tier's value paid at the team's level (levelValueShareOf; default 1). */
  valueShare?: number;
}): DealQuote {
  const row = profileRow(input.profile);
  const p = Math.min(0.99, Math.max(0.01, input.chance ?? CAREER_SPONSOR.wordChance[row.word]));
  const mondays = Math.max(1, input.mondays);
  const n = Math.max(1, input.goals);
  const value = tierValuePerWeek(input.tier, input.seasonIndex, input.difficulty) * mondays * (input.valueShare ?? 1);
  const fines = finesApply(input.profile, input.difficulty);
  // The fine per full miss as a share of C: min(capWeeks × weekly, fineShare × bonus per goal).
  const finePerC = fines
    ? Math.min((CAREER_SPONSOR.fines.capWeeks * row.weeklyShare) / mondays, (row.fineShare * row.bonusShare) / n)
    : 0;
  const anyHit = 1 - Math.pow(1 - p, n);
  const k =
    row.weeklyShare +
    row.fixedShare * (row.fixedKind === "milestone" ? anyHit : 1) +
    row.bonusShare * p -
    n * (1 - p) * finePerC;
  const ceiling = value / Math.max(0.05, k);
  const weekly = Math.max(CAREER_PAYROLL.weeklyQuantum, quantizeWeekly((row.weeklyShare * ceiling) / mondays));
  const fixed = quantize(row.fixedShare * ceiling);
  const bonus = quantize((row.bonusShare * ceiling) / n);
  const fineShare = fines ? row.fineShare : 0;
  const fineCap = fines ? quantize(CAREER_SPONSOR.fines.capWeeks * weekly) : 0;
  const fineMax = fineMaxOf({ fineShare, fineCap }, bonus);
  return {
    weekly,
    fixed,
    bonus,
    fineShare,
    fineCap,
    mondays,
    ev: Math.round(expectedValueOf({ weekly, mondays, fixed, fixedKind: row.fixedKind, bonus, goals: n, chance: p, fineMax })),
    ceiling: weekly * mondays + fixed + bonus * n,
  };
}

/** The best tier the reputation allows (one lower after a Steady deal ran out of patience). */
export function offerTierFor(rep: number, demote: boolean): 1 | 2 | 3 | 4 {
  let best = 1;
  for (const row of CAREER_SPONSOR.tiers) if (rep >= row.repGate) best = row.tier;
  return Math.max(1, best - (demote ? 1 : 0)) as 1 | 2 | 3 | 4;
}

/** The tier's brands (INVENTED, data/career/sponsors.ts), in a stable order. */
function brandsOfTier(tier: 1 | 2 | 3 | 4): string[] {
  return SPONSOR_BRANDS.filter((b) => b.tier === tier).map((b) => b.id);
}

/**
 * The three offers of one decision (decision 3-A): one per profile, all at
 * `tier`, each from a different brand of that tier, priced on today's money
 * index, with the first split's goal at the profile's word. Sorted Steady,
 * Balanced, Bold (the comparison's order — never a "recommended" one).
 */
export function sponsorDecisionFor(input: {
  tier: 1 | 2 | 3 | 4;
  today: CareerDay;
  careerSeed: number;
  difficulty: CareerDifficulty;
  level: TeamLevel;
}): SponsorState[] {
  const { tier, today, careerSeed, difficulty, level } = input;
  const firstSlot = firstSlotFrom(today);
  const decideBy = decideByFor(today, firstSlot);
  const pool = brandsOfTier(tier);
  const start = Math.floor(derivedFloat(careerSeed, streams.gen("sponsorDeal", `${firstSlot}:${tier}`)) * pool.length);
  const valueShare = levelValueShareOf(tier, level);
  return SPONSOR_PROFILES.map((profile, i) => {
    const row = profileRow(profile);
    const endsOn = settleDayOf(firstSlot + row.lengthSplits - 1);
    // The first split's goal comes first: the deal is priced at its chance (s1 — the same expected value whatever goal the level allows).
    const goal = pickGoal(row.word, level, firstSlot);
    const quote = quoteDeal({
      profile,
      tier,
      seasonIndex: today.seasonIndex,
      difficulty,
      mondays: mondaysBetween(today, endsOn),
      goals: row.lengthSplits,
      chance: goal.chance,
      valueShare,
    });
    const terms: SponsorTerms = {
      profile,
      lengthSplits: row.lengthSplits,
      firstSlot,
      endsOn,
      weekly: quote.weekly,
      fixedKind: row.fixedKind,
      fixed: quote.fixed,
      fineShare: quote.fineShare,
      fineCap: quote.fineCap,
      word: row.word,
      goals: [goal],
      ev: quote.ev,
      ceiling: quote.ceiling,
      pricedSeason: today.seasonIndex,
      offeredOn: { ...today },
      decideBy,
    };
    if (valueShare < 1) terms.levelShare = valueShare;
    return {
      sponsorId: pool.length > 0 ? pool[(start + i) % pool.length] : `sponsor-${tier}-${profile}`,
      tier,
      basePerSplit: Math.round((quote.weekly * CAREER_PAYROLL.weeksPerSeason) / CAREER_PAYROLL.splitsPerSeason),
      bonus: quote.bonus,
      objectiveKind: legacyKindOf(goal),
      progress: 0,
      hitThisSplit: false,
      missedCount: 0,
      terms,
    };
  });
}

/** What a deal pays for sure from today: its weekly pay on the Mondays left, plus a signing payment not yet paid. */
export function sureMoneyOf(terms: SponsorTerms, today: CareerDay): number {
  const fixed = terms.fixedKind === "signing" && !terms.fixedPaid ? terms.fixed : 0;
  return terms.weekly * mondaysLeftOf(terms, today) + fixed;
}

/** The most a deal can still pay from today: the sure money, the milestone and every goal's bonus not yet settled. */
export function upToMoneyOf(state: Pick<SponsorState, "bonus" | "terms">, today: CareerDay): number {
  const terms = state.terms!;
  const settled = terms.goals.filter((g) => g.hitOn || g.missed !== undefined).length;
  const milestone = terms.fixedKind === "milestone" && !terms.fixedPaid ? terms.fixed : 0;
  return sureMoneyOf(terms, today) + milestone + state.bonus * Math.max(0, terms.lengthSplits - settled);
}

/** The slots a deal covers (its splits), first to last. */
export function slotsOfDeal(terms: Pick<SponsorTerms, "firstSlot" | "lengthSplits">): number[] {
  return Array.from({ length: terms.lengthSplits }, (_, i) => terms.firstSlot + i);
}

/** The deal's goal for a split, once set. */
export function goalForSlot(terms: Pick<SponsorTerms, "goals">, slot: number): SponsorGoal | null {
  return terms.goals.find((g) => g.slot === slot) ?? null;
}

// ---------------------------------------------------------------------------
// ECO-05 (S7, decision 6-B): other income, capped
// ---------------------------------------------------------------------------

export interface OtherIncomeRoom {
  /** Other-income items still allowed this split. */
  count: number;
  /** Other income still allowed this season ($). */
  amount: number;
  /** The season's cap ($) and what it is a share of (the earned income, at least the guaranteed). */
  cap: number;
  basis: number;
  /** Other income booked this season. */
  taken: number;
}

/**
 * What other income the org may still take: CAREER_SPONSOR.otherIncome's
 * per-split count and its share of the season's earned income — at least
 * the season's guaranteed income (`guaranteedWeekly` × the season's
 * Mondays), so the cap is known before the prizes land.
 */
export function otherIncomeRoomOf(input: {
  tally: IncomeTally | undefined;
  seasonIndex: number;
  week: number;
  guaranteedWeekly: number;
}): OtherIncomeRoom {
  const O = CAREER_SPONSOR.otherIncome;
  const t = input.tally && input.tally.s === input.seasonIndex ? input.tally : null;
  const period = periodOfWeek(input.week);
  const used = t && t.period === period ? t.otherCount : 0;
  const basis = Math.max(t?.earned ?? 0, input.guaranteedWeekly * CAREER_PAYROLL.weeksPerSeason);
  const cap = quantize(O.seasonShare * basis);
  const taken = t?.other ?? 0;
  return {
    count: Math.max(0, O.perSplitCap - used),
    amount: Math.max(0, cap - taken),
    cap,
    basis,
    taken,
  };
}
