/**
 * Road to Worlds — the board's season goal (rc.36, ROADMAP UX-02, R87). Pure.
 *
 * A goal is set ONCE at the season's start and never moves: built from the
 * squad's level against its region's field (`TeamLevel`, the sponsors' level
 * model: the seed rating, the region, the difficulty edge), the career's
 * stage, its resources (the runway, a loan owed) and last season's goal.
 * It counts over the whole season — its Community Cups, the nine regionals,
 * the three Majors, Worlds — so its deadline is the last event that can
 * count, and its progress reads straight off the season's results.
 *
 * The chances come from the sponsors' fitted curves (CAREER_SPONSOR.goalModel)
 * read `seasonForm` points up (squads grow through a season): one regional
 * week at a time (binomial over the nine; playing Sunday's regional on its
 * own curve against the qualifier's line), one Major a split (binomial over
 * the three); Worlds reads as `worldsFromMajors` Majors qualified (Season
 * Points decide it, and they move with the Majors); a cup on a series curve
 * against the two closest stronger orgs. The target is picked inside
 * CAREER_SEASON_GOAL.targetBand, leaving room for a stretch; the stretch
 * inside its own band and at least `stretchGap` less likely. Measured and
 * fitted on CAREER_GOALS=1 (store/careerSeasonGoals.probe.test.ts).
 */

import { CAREER_CALENDAR, CAREER_QUALIFIER, CAREER_SEASON_GOAL, CAREER_SPONSOR, CAREER_UNOFFICIAL } from "@/config/balance";
import type { Placement, Region } from "../types";
import { firstDayOfWeek, seasonSchedule, weekOfDay } from "./calendar";
import {
  binomialTail,
  goalChance,
  goalDeadlineOf,
  goalProgressOf,
  majorQualifyChance,
  regionalChance,
  slotOf,
  type CareerDay,
  type TeamLevel,
} from "./sponsorDeals";
import type {
  CareerSave,
  CompactEventResult,
  SeasonGoalKind,
  SeasonGoalPlan,
  SeasonGoalSpec,
  SeasonGoalStage,
  SponsorGoal,
} from "./types";

const G = CAREER_SEASON_GOAL;

/**
 * The goal model's settings — CAREER_SEASON_GOAL by default; the probe's
 * offline evaluation passes variants (its seasons do not depend on the goal).
 */
export type SeasonGoalConfig = typeof CAREER_SEASON_GOAL;

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

const SCHEDULE = seasonSchedule();
/** The season's regional weeks (nine: three a split). */
const REGIONAL_WEEKS = SCHEDULE.filter((w) => w.kind === "regional").map((w) => w.week);
/** The season's Major weeks (three), with the week each one's split starts. */
const MAJOR_WEEKS = SCHEDULE.filter((w) => w.kind === "major").map((w) => w.week);
const SPLIT_START = new Map<number, number>(
  MAJOR_WEEKS.map((mw) => [mw, mw - CAREER_CALENDAR.majorOffset + 1]),
);
const REGIONALS = REGIONAL_WEEKS.length;
const MAJORS = MAJOR_WEEKS.length;
/** The weeks a Community Cup can be played (a split's open weeks), by split. */
const CUP_WEEKS: Record<1 | 2 | 3, number[]> = { 1: [], 2: [], 3: [] };
for (const w of SCHEDULE) if (w.kind === "open" && w.split) CUP_WEEKS[w.split].push(w.week);

const round3 = (x: number) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------
// The goals a season offers, and their chances
// ---------------------------------------------------------------------------

/** Every season goal, least ambitious first in each family (the tie-break order). */
export const SEASON_GOAL_CANDIDATES: readonly Omit<SeasonGoalSpec, "chance">[] = [
  ...G.cupCounts.map((count) => ({ kind: "cupFinal" as const, count })),
  ...G.cupWinCounts.map((count) => ({ kind: "cupWin" as const, count })),
  ...G.regionalCounts.map((count) => ({ kind: "regionalReach" as const, count })),
  ...G.regionalCounts.map((count) => ({ kind: "regionalFinish" as const, count, place: 8 })),
  ...G.regionalCounts.map((count) => ({ kind: "regionalFinish" as const, count, place: 4 })),
  ...G.majorCounts.map((count) => ({ kind: "majorQualify" as const, count })),
  ...G.majorCounts.map((count) => ({ kind: "regionalFinish" as const, count, place: 1 })),
  ...G.majorCounts.slice(0, 2).map((count) => ({ kind: "majorFinish" as const, count, place: 4 })),
  { kind: "worldsQualify", count: 1 },
  { kind: "majorFinish", count: 1, place: 1 },
  { kind: "worldsFinish", count: 1, place: 4 },
  { kind: "majorFinish", count: 2, place: 1 },
  { kind: "worldsFinish", count: 1, place: 1 },
];

/** The chance to qualify for Worlds (Season Points) — read as `worldsFromMajors` of the three Majors. */
function worldsChanceOf(level: TeamLevel, cfg: SeasonGoalConfig): number {
  return binomialTail(MAJORS, cfg.worldsFromMajors, majorQualifyChance(level));
}

/**
 * The squad against the lower end of its region's field: its Community Cup
 * draw — eligible while its rating is under the cups' ceiling, its margins
 * (difficulty edge included) over the two closest stronger orgs, the
 * semi-final's and the final's — and its margin over the Saturday
 * qualifier's line, the region's (direct + advancing)th org: the team it
 * must finish above to play Sunday's regional.
 */
export interface FieldDraw {
  eligible: boolean;
  /** Over the closest stronger org (the semi-final); the quarter-final's margin when no org is stronger. */
  vsSemi: number;
  /** Over the second closest (the final). */
  vsFinal: number;
  /** Over the qualifier's line (the region's 16th org, or its weakest). */
  vsLine: number;
}

export function fieldDrawFor(input: {
  region: Region;
  userRating: number;
  difficulty: string;
  orgs: readonly { region: Region; rating: number }[];
}): FieldDraw {
  const edge = CAREER_SPONSOR.levelEdge[input.difficulty] ?? 0;
  const above = input.orgs
    .filter((o) => o.region === input.region && o.rating > input.userRating)
    .map((o) => o.rating)
    .sort((a, b) => a - b);
  const vs = (r: number | undefined) => (r === undefined ? G.cupQuarterMargin : input.userRating - r) + edge;
  const home = input.orgs
    .filter((o) => o.region === input.region)
    .map((o) => o.rating)
    .sort((a, b) => b - a);
  const line = home[Math.min(home.length, CAREER_QUALIFIER.directSlots + CAREER_QUALIFIER.advanceSlots) - 1];
  return {
    eligible: input.userRating <= CAREER_UNOFFICIAL.t3RatingCeiling,
    vsSemi: Math.round(vs(above[0]) * 10) / 10,
    vsFinal: Math.round(vs(above[1]) * 10) / 10,
    vsLine: Math.round(((line === undefined ? 0 : input.userRating - line) + edge) * 10) / 10,
  };
}

/** One series at a margin (the cups' fitted curve, CAREER_SEASON_GOAL.cupSeries). */
function seriesAt(margin: number, cfg: SeasonGoalConfig): number {
  return 1 / (1 + Math.exp(-(margin - cfg.cupSeries.mid) / Math.max(0.1, cfg.cupSeries.scale)));
}

/** One cup: reaching its final (the quarter-final, then the semi-final), and winning it. */
function cupChances(cup: FieldDraw, cfg: SeasonGoalConfig): { final: number; win: number } {
  const final = seriesAt(cfg.cupQuarterMargin, cfg) * seriesAt(cup.vsSemi, cfg);
  return { final, win: final * seriesAt(cup.vsFinal, cfg) };
}

/** The level the league goals read: every margin `seasonForm` points up (the squad grows through the season). */
export function seasonFormOf(level: TeamLevel, form: number = G.seasonForm): TeamLevel {
  return {
    ...level,
    vs12: level.vs12 + form,
    vs8: level.vs8 + form,
    vs6: level.vs6 + form,
    vs4: level.vs4 + form,
    vs1: level.vs1 + form,
    vsCut: level.vsCut + form,
    vsMajor4: level.vsMajor4 + form,
    vsMajor8: level.vsMajor8 + form,
    vsMajor1: level.vsMajor1 + form,
  };
}

/**
 * One regional week's chance to play its Sunday regional, read over a season
 * (CAREER_SEASON_GOAL.reachCurve): the margin over the qualifier's line
 * (+ seasonForm) — over the region's 12th org when the draw is not known.
 */
function reachWeekChance(level: TeamLevel, cup: FieldDraw | null | undefined, cfg: SeasonGoalConfig): number {
  const c = cfg.reachCurve;
  const margin = cup && Number.isFinite(cup.vsLine) ? cup.vsLine + cfg.seasonForm : level.vs12;
  return 1 / (1 + Math.exp(-(margin - c.mid) / Math.max(0.1, c.scale)));
}

/**
 * The engine's estimate (0–1) that a season goal is reached, at the team's
 * level (its season-start level; league goals read it `seasonForm` up) and
 * its cup draw.
 */
export function seasonGoalChance(
  spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">,
  startLevel: TeamLevel,
  cup?: FieldDraw | null,
  cfg: SeasonGoalConfig = G,
): number {
  if (spec.kind === "cupFinal" || spec.kind === "cupWin") {
    if (!cup?.eligible) return 0;
    const c = cupChances(cup, cfg);
    return binomialTail(cfg.cupsPerSeason, spec.count, spec.kind === "cupFinal" ? c.final : c.win);
  }
  const level = seasonFormOf(startLevel, cfg.seasonForm);
  const q = majorQualifyChance(level);
  /** A Major finish once qualified (the sponsors' curve per split, over the qualifying chance). */
  const finishGivenIn = (place: number) =>
    q > 0 ? goalChance({ kind: "majorFinish", count: 1, place }, level) / q : 0;
  switch (spec.kind) {
    case "regionalReach":
      return binomialTail(REGIONALS, spec.count, reachWeekChance(level, cup, cfg));
    case "regionalFinish":
      return binomialTail(REGIONALS, spec.count, regionalChance(level, spec.place ?? 8));
    case "majorQualify":
      return binomialTail(MAJORS, spec.count, q);
    case "majorFinish":
      return binomialTail(MAJORS, spec.count, goalChance({ kind: "majorFinish", count: 1, place: spec.place ?? 4 }, level));
    case "worldsQualify":
      return worldsChanceOf(level, cfg);
    case "worldsFinish":
      return worldsChanceOf(level, cfg) * finishGivenIn(spec.place ?? 4);
  }
}

// ---------------------------------------------------------------------------
// The board's pick
// ---------------------------------------------------------------------------

export interface SeasonGoalInput {
  level: TeamLevel;
  /** The squad's Community Cup draw (fieldDrawFor); absent: no cup goals. */
  cup?: FieldDraw | null;
  seasonIndex: number;
  rep: number;
  /** False on the founding season (no season played yet). */
  hasHistory: boolean;
  /** Last season's target: met, missed, or unknown (null). */
  lastTargetMet: boolean | null;
  /** The weeks the balance covers at next Monday's net (null: no weekly burn). */
  runwayWeeks: number | null;
  /** The bank's emergency loan is owed. */
  loanOwed: boolean;
}

export function seasonGoalStageOf(
  input: Pick<SeasonGoalInput, "hasHistory" | "rep">,
  cfg: SeasonGoalConfig = G,
): SeasonGoalStage {
  if (!input.hasHistory) return "founding";
  return input.rep >= cfg.establishedRep ? "established" : "rising";
}

function moneyOf(input: Pick<SeasonGoalInput, "runwayWeeks" | "loanOwed">, cfg: SeasonGoalConfig): "tight" | "flush" | undefined {
  if (input.loanOwed || (input.runwayWeeks !== null && input.runwayWeeks < cfg.tightRunwayWeeks)) return "tight";
  if (input.runwayWeeks === null || input.runwayWeeks >= cfg.flushRunwayWeeks) return "flush";
  return undefined;
}

/** The target's aimed chance: the stage's, moved by last season and the money, clamped. */
export function seasonGoalAimOf(input: Omit<SeasonGoalInput, "level" | "seasonIndex">, cfg: SeasonGoalConfig = G): number {
  let aim: number = cfg.targetAim[seasonGoalStageOf(input, cfg)];
  if (input.hasHistory && input.lastTargetMet === true) aim += cfg.afterMetShift;
  if (input.hasHistory && input.lastTargetMet === false) aim += cfg.afterMissShift;
  const money = moneyOf(input, cfg);
  if (money === "tight") aim += cfg.tightShift;
  if (money === "flush") aim += cfg.flushShift;
  return Math.min(cfg.aimClamp.max, Math.max(cfg.aimClamp.min, aim));
}

type Rated = SeasonGoalSpec;

/** Distance from a chance to a band (0 inside it). */
const offBand = (c: number, band: { min: number; max: number }) =>
  c < band.min ? band.min - c : c > band.max ? c - band.max : 0;

/**
 * The candidate inside `band` closest to `aim` (the earlier one on a tie);
 * when none is inside, the one nearest the band.
 */
function pickIn(pool: readonly Rated[], aim: number, band: { min: number; max: number }): Rated | null {
  let best: Rated | null = null;
  for (const c of pool) {
    if (!best) {
      best = c;
      continue;
    }
    const d = offBand(c.chance, band);
    const bd = offBand(best.chance, band);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && Math.abs(c.chance - aim) < Math.abs(best.chance - aim) - 1e-9)) {
      best = c;
    }
  }
  return best;
}

const strip = (c: Rated): SeasonGoalSpec => {
  const out: SeasonGoalSpec = { kind: c.kind, count: c.count, chance: round3(c.chance) };
  if (c.place !== undefined) out.place = c.place;
  return out;
};

/** The season's goal: the target nearest the aim inside its band, the stretch harder and inside its own. */
export function seasonGoalPlanFor(input: SeasonGoalInput, cfg: SeasonGoalConfig = G): SeasonGoalPlan {
  const rated: Rated[] = SEASON_GOAL_CANDIDATES.map((c) => ({
    ...c,
    chance: seasonGoalChance(c, input.level, input.cup, cfg),
  })).filter((c) => c.chance > 0);
  const aim = seasonGoalAimOf(input, cfg);
  // A target leaves room for a stretch: some goal at least `stretchGap` less likely (a dominant
  // squad's target is never the hardest goal there is).
  const roomy = rated.filter((c) => rated.some((d) => d.chance <= c.chance - cfg.stretchGap + 1e-9));
  const target = pickIn(roomy.length > 0 ? roomy : rated, aim, cfg.targetBand)!;
  const harder = rated.filter((c) => c !== target && c.chance <= target.chance - cfg.stretchGap + 1e-9);
  const stretch =
    pickIn(harder, cfg.stretchAim, cfg.stretchBand) ??
    // The target is already the hardest goal there is: the next least likely one.
    [...rated].filter((c) => c !== target).sort((a, b) => a.chance - b.chance)[0];
  const money = moneyOf(input, cfg);
  const basis: SeasonGoalPlan["basis"] = {
    stage: seasonGoalStageOf(input, cfg),
    rank: input.level.rank,
    teams: input.level.teams,
  };
  if (money) basis.money = money;
  if (input.hasHistory && input.lastTargetMet !== null) basis.last = input.lastTargetMet ? "met" : "missed";
  return { seasonIndex: input.seasonIndex, target: strip(target), stretch: strip(stretch), basis };
}

// ---------------------------------------------------------------------------
// Deadline and progress
// ---------------------------------------------------------------------------

/** The last event a goal can count: the season's last regional, the last Major's field or final, Worlds'. */
export type SeasonGoalDeadlineEvent =
  | "lastCup"
  | "lastRegional"
  | "majorField"
  | "majorFinal"
  | "worldsField"
  | "worldsFinal";

export interface SeasonGoalDeadline {
  event: SeasonGoalDeadlineEvent;
  week: number;
  /** The day it is decided (a Sunday's final, or the Monday a field is announced). */
  on: CareerDay;
}

export function seasonGoalDeadlineOf(kind: SeasonGoalKind, seasonIndex: number): SeasonGoalDeadline {
  const C = CAREER_CALENDAR;
  const sunday = (week: number) => week * C.daysPerWeek;
  const lastRegional = REGIONAL_WEEKS[REGIONAL_WEEKS.length - 1];
  const lastMajor = MAJOR_WEEKS[MAJOR_WEEKS.length - 1];
  const lastCup = CUP_WEEKS[3][CUP_WEEKS[3].length - 1];
  switch (kind) {
    case "cupFinal":
    case "cupWin":
      return {
        event: "lastCup",
        week: lastCup,
        on: { seasonIndex, day: firstDayOfWeek(lastCup) + C.eventDayOfWeek - 1 },
      };
    case "regionalReach":
    case "regionalFinish":
      return { event: "lastRegional", week: lastRegional, on: { seasonIndex, day: sunday(lastRegional) } };
    case "majorQualify":
      return { event: "majorField", week: lastMajor, on: { seasonIndex, day: firstDayOfWeek(lastMajor) } };
    case "majorFinish":
      return { event: "majorFinal", week: lastMajor, on: { seasonIndex, day: sunday(lastMajor) } };
    case "worldsQualify":
      return { event: "worldsField", week: C.worldsWindowWeek, on: { seasonIndex, day: firstDayOfWeek(C.worldsWindowWeek) } };
    case "worldsFinish":
      return { event: "worldsFinal", week: C.worldsWeek, on: { seasonIndex, day: sunday(C.worldsWeek) } };
  }
}

export interface SeasonGoalProgress {
  done: number;
  target: number;
  hit: boolean;
  /** Chances still to come (regionals, Majors, Worlds); 0 once the season's events are over. */
  left: number;
  /** It cannot be reached any more (not enough chances left). */
  out: boolean;
}

export interface SeasonGoalContext {
  seasonIndex: number;
  today: CareerDay;
  results: readonly CompactEventResult[];
  /** The current split's announced Major field (null until announced). */
  majorFieldRefs: readonly string[] | null;
  worldsFieldRefs: readonly string[] | null;
  /** The season's events are over (the review). */
  over?: boolean;
}

/** How far a season goal is, from the season's results and the announced fields. */
export function seasonGoalProgressOf(
  spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">,
  ctx: SeasonGoalContext,
): SeasonGoalProgress {
  const mine = ctx.results.filter((r) => r.seasonIndex === ctx.seasonIndex && r.userPlacement !== undefined);
  const after = ctx.over || ctx.today.seasonIndex > ctx.seasonIndex;
  const week = after ? CAREER_CALENDAR.weeksPerSeason + 1 : weekOfDay(ctx.today.day);
  const target = Math.max(1, spec.count);
  const place = spec.place ?? (spec.kind === "regionalFinish" ? 8 : 4);
  let done = 0;
  let left = 0;

  switch (spec.kind) {
    case "cupFinal":
    case "cupWin": {
      const cups = mine.filter((r) => r.tier === "t3");
      done = cups.filter((r) => PLACE[r.userPlacement!] <= (spec.kind === "cupWin" ? 1 : 2)).length;
      for (const split of [1, 2, 3] as const) {
        const entered = cups.filter((r) => CUP_WEEKS[split].includes(r.week)).length;
        const ahead = CUP_WEEKS[split].filter((w) => w > week || (w === week && !cups.some((r) => r.week === w))).length;
        left += Math.max(0, Math.min(CAREER_UNOFFICIAL.t3MaxEntriesPerSplit - entered, ahead));
      }
      break;
    }
    case "regionalReach":
    case "regionalFinish": {
      const regionals = mine.filter((r) => r.tier === "regional");
      done =
        spec.kind === "regionalReach"
          ? regionals.length
          : regionals.filter((r) => PLACE[r.userPlacement!] <= place).length;
      for (const w of REGIONAL_WEEKS) {
        if (w > week) left += 1;
        else if (w === week) {
          // This week's regional is still to play unless it was played, or Saturday's qualifier ended it.
          const gone = mine.some(
            (r) => r.week === w && (r.tier === "regional" || (r.tier === "qualifier" && r.userPlacement === "swiss_exit")),
          );
          if (!gone) left += 1;
        }
      }
      break;
    }
    case "majorQualify":
    case "majorFinish": {
      // The announced field belongs to the Major of the latest split that has started.
      const fieldMajor = [...MAJOR_WEEKS].reverse().find((mw) => (SPLIT_START.get(mw) ?? 0) <= week);
      for (const mw of MAJOR_WEEKS) {
        const played = mine.find((r) => r.tier === "major" && r.week === mw);
        let state: "in" | "lost" | "open";
        if (played) state = "in";
        else if (!after && mw === fieldMajor && ctx.majorFieldRefs) state = ctx.majorFieldRefs.includes("user") ? "in" : "lost";
        else state = mw < week || after ? "lost" : "open";
        if (spec.kind === "majorQualify") {
          if (state === "in") done += 1;
          else if (state === "open") left += 1;
        } else if (played && PLACE[played.userPlacement!] <= place) done += 1;
        else if (!played && state !== "lost") left += 1;
      }
      break;
    }
    case "worldsQualify":
    case "worldsFinish": {
      const played = mine.find((r) => r.tier === "worlds");
      const inField = Boolean(played) || Boolean(ctx.worldsFieldRefs?.includes("user"));
      const lost = !inField && (Boolean(ctx.worldsFieldRefs) || after);
      if (spec.kind === "worldsQualify") {
        done = inField ? 1 : 0;
        left = inField || lost ? 0 : 1;
      } else {
        done = played && PLACE[played.userPlacement!] <= place ? 1 : 0;
        left = played || lost || after ? 0 : 1;
      }
      break;
    }
  }
  const hit = done >= target;
  return { done: Math.min(done, target), target, hit, left, out: !hit && done + left < target };
}

// ---------------------------------------------------------------------------
// The view HQ and the season screen read (plan, rc.35's split model, or a legacy key)
// ---------------------------------------------------------------------------

export type SeasonGoalLabel =
  | { scope: "season"; kind: SeasonGoalKind; count: number; place: number }
  | { scope: "split"; kind: SponsorGoal["kind"]; count: number; place: number }
  | { scope: "legacy"; key: string };

export interface SeasonGoalRowView {
  role: "target" | "stretch";
  label: SeasonGoalLabel;
  progress: SeasonGoalProgress | null;
  deadline: SeasonGoalDeadline | null;
  /** Settled at the season review (null before; absent outcome on a legacy stretch). */
  met: boolean | null;
}

export interface SeasonGoalsView {
  target: SeasonGoalRowView;
  stretch: SeasonGoalRowView;
  repRisk: number;
  basis: SeasonGoalPlan["basis"] | null;
}

function contextOf(save: CareerSave): SeasonGoalContext {
  return {
    seasonIndex: save.clock.seasonIndex,
    today: { seasonIndex: save.clock.seasonIndex, day: save.clock.day },
    results: save.eventResults,
    majorFieldRefs: save.competition.majorFieldRefs,
    worldsFieldRefs: save.competition.worldsFieldRefs,
    over: save.phase === "seasonReview" || save.phase === "ended",
  };
}

/** rc.35's split-scope goal, read as its best split so far (met if any split reached it). */
function splitProgressOf(
  goal: { kind: SponsorGoal["kind"]; count: number; place?: number },
  save: CareerSave,
): SeasonGoalProgress {
  const season = save.clock.seasonIndex;
  const over = save.phase === "seasonReview" || save.phase === "ended";
  let best: SeasonGoalProgress | null = null;
  let splitsLeft = 0;
  for (const split of [1, 2, 3] as const) {
    const slot = slotOf(season, split);
    const deadline = goalDeadlineOf({ slot, kind: goal.kind });
    const open = !over && save.clock.day <= deadline.day;
    if (open) splitsLeft += 1;
    const p = goalProgressOf(
      { ...goal, slot },
      { results: save.eventResults, inMajorField: open && Boolean(save.competition.majorFieldRefs?.includes("user")) },
    );
    const row: SeasonGoalProgress = { done: p.done, target: p.target, hit: p.hit, left: 0, out: false };
    if (!best) best = row;
    else if (!best.hit && (row.hit || row.done / row.target > best.done / best.target)) best = row;
  }
  const out = best!;
  return { ...out, left: out.hit ? 0 : splitsLeft, out: !out.hit && splitsLeft === 0 };
}

/** What the goals card shows: each goal's words, progress, deadline and outcome. */
export function seasonGoalsViewOf(save: CareerSave): SeasonGoalsView | null {
  const goals = save.seasonGoals;
  if (!goals) return null;
  const season = save.clock.seasonIndex;
  const plan = goals.plan && goals.plan.seasonIndex === season ? goals.plan : null;
  if (plan) {
    const ctx = contextOf(save);
    const row = (role: "target" | "stretch", spec: SeasonGoalSpec, met: boolean | null): SeasonGoalRowView => ({
      role,
      label: { scope: "season", kind: spec.kind, count: spec.count, place: spec.place ?? 0 },
      progress: seasonGoalProgressOf(spec, ctx),
      deadline: seasonGoalDeadlineOf(spec.kind, season),
      met,
    });
    return {
      target: row("target", plan.target, goals.targetMet),
      stretch: row("stretch", plan.stretch, goals.stretchMet ?? null),
      repRisk: goals.repRisk,
      basis: plan.basis,
    };
  }
  if (goals.model) {
    const row = (role: "target" | "stretch", g: NonNullable<typeof goals.model>["target"], met: boolean | null): SeasonGoalRowView => ({
      role,
      label: { scope: "split", kind: g.kind, count: g.count, place: g.place ?? 0 },
      progress: splitProgressOf(g, save),
      deadline: (() => {
        const d = goalDeadlineOf({ slot: slotOf(season, 3), kind: g.kind });
        const event: SeasonGoalDeadlineEvent =
          g.kind === "majorQualify" ? "majorField" : g.kind === "majorFinish" ? "majorFinal" : "lastRegional";
        return { event, week: weekOfDay(d.day), on: d };
      })(),
      met,
    });
    return {
      target: row("target", goals.model.target, goals.targetMet),
      stretch: row("stretch", goals.model.stretch, goals.stretchMet ?? null),
      repRisk: goals.repRisk,
      basis: null,
    };
  }
  const legacy = (role: "target" | "stretch", key: string, met: boolean | null): SeasonGoalRowView => ({
    role,
    label: { scope: "legacy", key },
    progress: null,
    deadline: null,
    met,
  });
  return {
    target: legacy("target", goals.targetKey, goals.targetMet),
    stretch: legacy("stretch", goals.stretchKey, goals.stretchMet ?? null),
    repRisk: goals.repRisk,
    basis: null,
  };
}

/** Is a planned goal met, read at the season review (every event of the season played). */
export function seasonGoalMetAtReview(spec: SeasonGoalSpec, save: CareerSave): boolean {
  return seasonGoalProgressOf(spec, { ...contextOf(save), over: true }).hit;
}

/** Settled once by the season review; existing settled reviews are never repaid. */
export function seasonGoalReputationAfter(rep: number, targetMet: boolean, stretchMet: boolean): number {
  return Math.min(100, rep + (targetMet ? CAREER_SEASON_GOAL.reward.target : 0) + (stretchMet ? CAREER_SEASON_GOAL.reward.stretch : 0));
}
