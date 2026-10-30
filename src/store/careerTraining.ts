/**
 * Road to Worlds — DEV-03 training flows (rc.34, docs/TRAINING-CONTRACT.md;
 * Gate 3a approved 30/10, decisions 1–7 A).
 *
 * One training decision per period, none per week. The rules live in
 * `engine/career/training.ts`; this module runs them on a career save:
 *  - the period lifecycle (`trainingDayStart`, called first thing on every
 *    day arrival): the summary filed once at the boundary, the next package
 *    decided by the mode (the coach runs it / proposes / you set it);
 *  - the sessions and the package's scrims, calendar-true and idempotent
 *    (`plan.lastSessionDay` / `lastScrimDay`: a reload, Skip, the autoplay or
 *    +1 day all reach the same save, and no day runs twice);
 *  - the decision flows (approve, adjust, keep the base, the mode, repeat);
 *  - the views (the projection "from the function that runs it", HQ's
 *    block, the pending decision, the coach hire card's impact).
 *
 * Never imports careerFlow (careerFlow imports this): the news line and the
 * scrim series are built here with the same id scheme. Everything mutating
 * takes a DRAFT save (the caller cloned it); flows return `{ save, error }`.
 */

import { CAREER_CALENDAR, CAREER_DEV, CAREER_PLAN, CAREER_SAVE, CAREER_SCRIM, CAREER_TRAINING, TOURNAMENT } from "@/config/balance";
import { DAYS_PER_SEASON, dayOfWeekOf, unofficialOfferFor, weekAt, weekOfDay } from "@/engine/career/calendar";
import { majorFieldFor, worldsFieldFor } from "@/engine/career/careerResults";
import { fieldQualityFor, growthCtxOf, trainDay, trainWeek } from "@/engine/career/development";
import { presetTrainingModeOf } from "@/engine/career/difficulty";
import { gearTrainingBonus } from "@/engine/career/economy";
import { deriveSeed, derivedFloat, streams } from "@/engine/career/seeds";
import {
  BASE_EFFECT,
  coachAfterSeason,
  coachProfileOf,
  coachProposalFor,
  packageEffectFor,
  periodOfDay,
  pickScrimOpponent,
  resolveScrimLevel,
  sanitizePackage,
  scrimCapRatio,
  scrimDaysOf,
  scrimWeekShare,
  scrimXpWeeksFor,
  unavailabilityAddFor,
  type CoachTrainingProfile,
  type PackageEffect,
  type TrainingPeriod,
} from "@/engine/career/training";
import { isLocalRef, localSceneRefs, localTeamName, localTeamOffset } from "@/engine/career/localScene";
import { LINEUP_SEATS, localTeamFor, orgTeamFor, userTeamFor } from "@/engine/career/worldSim";
import { simulateSeries } from "@/engine/match";
import { createRng } from "@/lib/rng";
import type {
  CareerDifficulty,
  CareerSave,
  CoachState,
  PlayerTweak,
  ScrimLevel,
  ScrimLogEntry,
  SquadPlayer,
  TrainingMode,
  TrainingObjective,
  TrainingPackage,
  TrainingPeriodPlayer,
  TrainingPlan,
  TrainingState,
  TrainingSummary,
} from "@/engine/career/types";
import type { StatKey } from "@/engine/types";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// ---------------------------------------------------------------------------
// Small helpers (careerFlow's own are private; same id scheme)
// ---------------------------------------------------------------------------

function nextSeq(save: CareerSave): number {
  save.seq = (save.seq ?? 0) + 1;
  return save.seq;
}

/** A training news line (priority 1 by default: the feed, never a toast — T7). */
function pushTrainingNews(
  save: CareerSave,
  titleKey: string,
  params?: Record<string, string | number>,
  priority: 0 | 1 | 2 = 1,
): void {
  save.news.unshift({
    id: `n:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    type: "training",
    priority,
    titleKey,
    ...(params ? { params } : {}),
    read: false,
  });
  if (save.news.length > CAREER_SAVE.newsCap) save.news.length = CAREER_SAVE.newsCap;
}

const squadShort = (save: CareerSave): boolean => save.squad.length < LINEUP_SEATS;

function approxUserRating(save: CareerSave): number {
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  return starters.reduce((s, p) => s + p.overall, 0) / LINEUP_SEATS;
}

/** The squad's team rating as it scrims (bootcamp edge left out) — the scrim levels' yardstick. */
function squadTeamRatingOf(save: CareerSave): number {
  try {
    return userTeamFor({
      identity: save.identity,
      squad: save.squad,
      starterIds: save.starterIds,
      coach: save.coach,
      gear: save.finances.gear,
      bootcampSharp: 0,
      seasonIndex: save.clock.seasonIndex,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
      unavailablePlayerId: null,
    }).team.rating.total;
  } catch {
    return approxUserRating(save);
  }
}

/** The fielded trio's chemistry (percent) — the summary's squad line. */
export function teamChemistryOf(save: CareerSave): number {
  if (save.squad.length === 0) return 0;
  try {
    const { team } = userTeamFor({
      identity: save.identity,
      squad: save.squad,
      starterIds: save.starterIds,
      coach: save.coach,
      gear: save.finances.gear,
      bootcampSharp: 0,
      seasonIndex: save.clock.seasonIndex,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
      unavailablePlayerId: null,
    });
    return Math.round(team.chemistry.percent);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// State: defaults, creation, the load repair
// ---------------------------------------------------------------------------

/** A new career's training state: the preset's delegation (decision 3-A). */
export function initialTrainingState(difficulty: CareerDifficulty, modeOverride?: TrainingMode): TrainingState {
  const mode = modeOverride ?? presetTrainingModeOf(difficulty);
  return {
    mode,
    repeat: CAREER_PLAN.repeatByMode[mode] ?? false,
    userPackage: null,
    plan: null,
    proposal: null,
    history: [],
    reportSeen: "",
  };
}

/** Read-only default for a save the repair has not touched yet (manual, the base). */
const EMPTY_STATE: TrainingState = Object.freeze({
  mode: "manual",
  repeat: true,
  userPackage: null,
  plan: null,
  proposal: null,
  history: [],
}) as TrainingState;

/** The career's training state (never null: an unrepaired save reads the base). */
export function trainingOf(save: Pick<CareerSave, "training">): TrainingState {
  return save.training ?? EMPTY_STATE;
}

/**
 * rc.34 (T8): the one-time load repair, run by migrateSaveToV5 on every load
 * next to the economy's (idempotent; persist version 3 and saveVersion 5
 * unchanged). A save from before rc.34 gets its training state and starts the
 * running period on DEV-01's base — no package, no overall jump, today's
 * session (already run by rc.33's tick) never runs twice. Its mode: the
 * preset's delegation when it delegated training (prefs.autoTrain), else
 * "I set it". Its per-player focus / intensity are kept as the tweaks the
 * first package it builds is offered (`carryTweaks`); the week's drill
 * expires with its week; a hired coach keeps his quality and reads his
 * experience from his source (`training.coachProfileOf`).
 */
export function repairTrainingOnLoad(save: CareerSave): void {
  if (save.training !== undefined) {
    normaliseTrainingState(save);
    return;
  }
  if (!save.clock || !Array.isArray(save.squad) || !save.finances || !save.world) return;
  const mode: TrainingMode = presetTrainingModeOf(save.difficulty);
  const carry: Record<string, PlayerTweak> = {};
  for (const p of save.squad) {
    const tweak: PlayerTweak = {};
    if (p.trainingFocus && p.trainingFocus !== "auto" && p.trainingFocus !== "balanced") tweak.focus = p.trainingFocus;
    if (p.trainingIntensity === "light" || p.trainingIntensity === "heavy") tweak.workload = p.trainingIntensity;
    if (Object.keys(tweak).length > 0) carry[p.id] = tweak;
  }
  save.training = {
    ...initialTrainingState(save.difficulty, mode),
    ...(Object.keys(carry).length > 0 ? { carryTweaks: carry } : {}),
  };
  normaliseTrainingState(save);
  if (save.phase === "ended") return;
  save.news ??= [];
  // The running period opens on the base: today's session already ran (rc.33's tick).
  openPlan(save, periodOfDay(save.clock.day), { repaired: true });
}

/** A report's stable key ("season:period") — what `reportSeen` stores. */
export function reportKeyOf(s: Pick<TrainingSummary, "seasonIndex" | "periodIndex">): string {
  return `${s.seasonIndex}:${s.periodIndex}`;
}

/**
 * rc.35 (front T): the load repair's idempotent half for a save that already
 * has a training state. rc.34's delegation modes ("coach" / "approve") become
 * the preset's meaning (Easy auto, Normal recommend, Hard manual) — a hired
 * coach runs the plan whatever the mode; a proposal left waiting is dropped
 * (the plan it held keeps the base, or the coach's plan when he is there);
 * `reportSeen` is stamped with the newest filed report, so no old report
 * pops after the update. Running it twice changes nothing.
 */
function normaliseTrainingState(save: CareerSave): void {
  const t = save.training!;
  const modes: readonly string[] = ["auto", "recommend", "manual"];
  if (!modes.includes(t.mode as string)) {
    t.mode = presetTrainingModeOf(save.difficulty);
    t.repeat = CAREER_PLAN.repeatByMode[t.mode] ?? true;
  }
  if (t.delegatedFrom !== undefined) delete t.delegatedFrom;
  if (t.proposal) {
    t.proposal = null;
    if (save.coach && t.plan && t.plan.author === "base") {
      const proposal = coachProposalOf(save);
      if (proposal) {
        t.plan.package = sanitizePackage(proposal.package);
        t.plan.author = "coach";
      }
    }
  }
  if (t.reportSeen === undefined) t.reportSeen = t.history[0] ? reportKeyOf(t.history[0]) : "";
}

/**
 * rc.35 (front T): who sets the package now — the hired coach, else the
 * preset's mode (Easy "auto", Normal "recommend", Hard "manual").
 */
export function trainingControllerOf(save: Pick<CareerSave, "coach" | "training">): "coach" | TrainingMode {
  if (save.coach) return "coach";
  const m = trainingOf(save).mode;
  return m === "auto" || m === "recommend" || m === "manual" ? m : "recommend";
}

/**
 * rc.35: the most effective plan for this cycle without a coach — the same
 * rule the coach proposes by (development; preparation for a Major / Worlds
 * cycle; recovery after a worn one), at a balanced focus. Easy applies it,
 * Normal tags it RECOMMENDED, Hard shows no tag.
 */
export function recommendedPackageOf(save: CareerSave): { package: TrainingPackage; reasonKey: "default" | "event" | "wear" } {
  return coachProposalFor({
    coach: coachProfileOf(save.coach),
    bigEvent: periodHasBigEvent(periodOfDay(save.clock.day)),
    lastWear: lastWearOf(trainingOf(save)),
  });
}

/**
 * rc.35 (front T): the newest filed report the manager has not seen — the
 * results modal (once per finished cycle; survives a reload: the seen key is
 * in the save). Null when there is none, or the career ended.
 */
export function trainingReportOf(save: CareerSave): TrainingSummary | null {
  const t = save.training;
  if (!t || save.phase === "ended") return null;
  const last = t.history[0];
  if (!last || last.players.length === 0) return null;
  return t.reportSeen === reportKeyOf(last) ? null : last;
}

/** rc.35: the manager saw the results modal — never again for that report (nor older ones). */
export function acknowledgeTrainingReportFlow(input: CareerSave): TrainingFlowResult {
  const t = input.training;
  const last = t?.history[0];
  if (!t || !last || t.reportSeen === reportKeyOf(last)) return { save: input };
  const save = clone(input);
  save.training!.reportSeen = reportKeyOf(last);
  return { save };
}

// ---------------------------------------------------------------------------
// The period lifecycle
// ---------------------------------------------------------------------------

function snapshotPlayer(p: SquadPlayer, joinedDay?: number): TrainingPeriodPlayer {
  return {
    name: p.name,
    overallStart: round4(p.overall),
    offsetsStart: { ...p.attrOffsets },
    ...(joinedDay !== undefined ? { joinedDay } : {}),
    sessions: 0,
    scrims: 0,
    series: 0,
    seriesGain: 0,
    coachShare: 0,
    declined: 0,
    wear: 0,
  };
}

/** The plan's entry for a squad player — a signing joins the plan (and the summary says so, f4/f7). */
function entryOf(save: CareerSave, plan: TrainingPlan, p: SquadPlayer): TrainingPeriodPlayer {
  let e = plan.players[p.id];
  if (!e) {
    e = snapshotPlayer(p, save.clock.day);
    plan.players[p.id] = e;
    plan.notes.push({ key: "joined", params: { player: p.name } });
    recomputePlan(save);
  }
  return e;
}

/** A Major or Worlds week inside the period (the coach's preparation call, T5). */
function periodHasBigEvent(period: TrainingPeriod): boolean {
  for (let d = period.startDay; d <= period.endDay; d += CAREER_CALENDAR.daysPerWeek) {
    const kind = weekAt(weekOfDay(d)).kind;
    if (kind === "major" || kind === "worlds") return true;
  }
  return false;
}

/** The squad's wear over the last filed period (the coach's recovery call, T5). */
function lastWearOf(t: TrainingState): number {
  const last = t.history[0];
  if (!last) return 0;
  const ws = last.players.map((p) => p.wear);
  return ws.length > 0 ? ws.reduce((s, w) => s + w, 0) / ws.length : 0;
}

/** T5: the coach's proposal for the period this day belongs to (null = no coach). */
export function coachProposalOf(
  save: CareerSave,
  coach: CoachState | null = save.coach,
): { package: TrainingPackage; reasonKey: "default" | "event" | "wear" } | null {
  const prof = coachProfileOf(coach);
  if (!prof) return null;
  return coachProposalFor({
    coach: prof,
    bigEvent: periodHasBigEvent(periodOfDay(save.clock.day)),
    lastWear: lastWearOf(trainingOf(save)),
  });
}

/**
 * Open the plan for `period` and decide its package (T5):
 *  - "coach" + a coach: his proposal runs (exceptions become summary lines);
 *  - "approve" + a coach, no package repeated (repeat off, or nothing set —
 *    rc.34 review): his proposal WAITS — the clock holds on the period's
 *    first day until the manager approves, adjusts or keeps the base
 *    (`trainingDecisionOf`); that day's session runs once answered;
 *  - otherwise: the repeated package (repeat on) or DEV-01's base.
 */
function openPlan(save: CareerSave, period: TrainingPeriod, opts: { repaired?: boolean } = {}): void {
  const t = save.training!;
  const day = save.clock.day;
  const proposal = opts.repaired ? null : coachProposalOf(save);
  let pkg: TrainingPackage | null = null;
  let author: TrainingPlan["author"] = "base";
  t.proposal = null;
  if (!opts.repaired) {
    // rc.35 (front T): a hired coach picks and runs it; without one Easy
    // applies the recommended plan; Normal / Hard keep the manager's plan
    // (repeat) or the base. Nothing waits — no clock hold.
    const controller = trainingControllerOf(save);
    if (controller === "coach" && proposal) {
      pkg = proposal.package;
      author = "coach";
    } else if (controller === "auto") {
      pkg = recommendedPackageOf(save).package;
      author = "auto";
    } else if (t.repeat && t.userPackage) {
      pkg = sanitizePackage(t.userPackage);
      author = "user";
    }
  }
  const players: Record<string, TrainingPeriodPlayer> = {};
  for (const p of save.squad) players[p.id] = snapshotPlayer(p);
  t.plan = {
    seasonIndex: save.clock.seasonIndex,
    periodIndex: period.index,
    startDay: period.startDay,
    endDay: period.endDay,
    package: pkg,
    author,
    packageFromDay: day,
    // A repaired save already trained today under rc.33's tick (T8: never twice).
    lastSessionDay: opts.repaired ? day : day - 1,
    lastScrimDay: opts.repaired ? day : day - 1,
    coaches: [],
    players,
    scrims: {},
    chemStart: teamChemistryOf(save),
    wearProjected: 0,
    scrimCap: {},
    notes: [],
  };
  const prev = t.history[0];
  if (author === "coach" && pkg && proposal && proposal.reasonKey !== "default") {
    t.plan.notes.push({ key: proposal.reasonKey === "event" ? "coachEvent" : "coachWear" });
  }
  const follows =
    prev &&
    ((prev.seasonIndex === save.clock.seasonIndex && prev.periodIndex === period.index - 1) ||
      (prev.seasonIndex === save.clock.seasonIndex - 1 && period.index === 0 && prev.periodIndex === period.count - 1));
  if (prev && follows) prev.next = pkg?.objective ?? null;
  recomputePlan(save);
}

/** T7: file the running period (once — keyed by season and period) and clear it. */
function closePlan(save: CareerSave): void {
  const t = save.training;
  const plan = t?.plan;
  if (!t || !plan) return;
  t.plan = null;
  t.proposal = null;
  if (t.history.some((h) => h.seasonIndex === plan.seasonIndex && h.periodIndex === plan.periodIndex)) return;
  const players = save.squad
    .filter((p) => plan.players[p.id])
    .map((p) => {
      const e = plan.players[p.id];
      const attrs: Partial<Record<StatKey, number>> = {};
      for (const k of Object.keys(p.attrOffsets) as StatKey[]) {
        const d = round2((p.attrOffsets[k] ?? 0) - (e.offsetsStart[k] ?? 0));
        if (Math.abs(d) >= 0.01) attrs[k] = d;
      }
      return {
        id: p.id,
        name: p.name,
        before: round2(e.overallStart),
        after: round2(p.overall),
        attrs,
        sessions: round2(e.sessions),
        scrims: round2(e.scrims),
        series: e.series,
        seriesGain: round2(e.seriesGain),
        coachShare: round2(e.coachShare),
        declined: round2(e.declined),
        wear: round2(Math.max(0, e.wear)),
        ...(e.unavailable ? { unavailable: true } : {}),
        ...(e.joinedDay !== undefined ? { joined: true } : {}),
      };
    });
  const summary: TrainingSummary = {
    seasonIndex: plan.seasonIndex,
    periodIndex: plan.periodIndex,
    startDay: plan.startDay,
    endDay: plan.endDay,
    package: plan.package,
    author: plan.author,
    players,
    scrims: plan.scrims,
    chemStart: plan.chemStart,
    chemEnd: teamChemistryOf(save),
    coaches: plan.coaches
      .filter((c) => c.id !== "none")
      .map((c) => ({ name: c.name, days: c.days, share: round2(c.share) })),
    notes: plan.notes.slice(0, 8),
  };
  t.history.unshift(summary);
  if (t.history.length > CAREER_PLAN.historySize) t.history.length = CAREER_PLAN.historySize;
  const gains = players.map((p) => ({ name: p.name, gain: round2(p.after - p.before) }));
  const avg = gains.length > 0 ? round2(gains.reduce((s, g) => s + g.gain, 0) / gains.length) : 0;
  const best = [...gains].sort((a, b) => b.gain - a.gain)[0];
  pushTrainingNews(save, "trainingPeriod", {
    objective: plan.package?.objective ?? "base",
    n: plan.periodIndex + 1,
    avg: avg.toFixed(1),
    player: best?.name ?? "",
    gain: best ? best.gain.toFixed(1) : "0",
  });
}

/**
 * The day hook (careerFlow.processDayArrival, first thing): on a new period
 * (or a new season) file the last one and open this one. Idempotent: the
 * same day twice changes nothing.
 */
export function trainingDayStart(save: CareerSave): void {
  if (!save.training) save.training = initialTrainingState(save.difficulty);
  if (save.phase === "ended") return;
  const t = save.training;
  const period = periodOfDay(save.clock.day);
  const plan = t.plan;
  if (plan && plan.seasonIndex === save.clock.seasonIndex && plan.periodIndex === period.index) return;
  if (plan) closePlan(save);
  openPlan(save, period);
}

/**
 * The rollover hook (careerFlow.rolloverToNextSeason, before the squad ages):
 * period 8's summary is filed at the rollover (T6), and the coach in post
 * grows (T4): +experience, quality +0.5 — +1 when most of the season's
 * periods ran his specialty — up to his ceiling. rc.34 review: only when he
 * worked days of this season's sessions.
 */
export function trainingSeasonEnd(save: CareerSave): void {
  if (!save.training) return;
  const season = save.clock.seasonIndex;
  // Once per season: a second call finds the plan already filed (no second growth).
  const filing = save.training.plan !== null;
  closePlan(save);
  if (filing && save.coach) {
    const prof = coachProfileOf(save.coach)!;
    const ran = save.training.history.filter((h) => h.seasonIndex === season);
    // rc.34 review: only a coach who worked this season grows (his days on the season's
    // plans) — one hired in the season review or on its last day grew after zero days.
    const name = save.coach.name;
    const days = ran.reduce((n, h) => n + h.coaches.filter((c) => c.name === name).reduce((d, c) => d + c.days, 0), 0);
    if (days <= 0) return;
    const matched = ran.filter((h) => h.package?.objective === prof.specialty && h.coaches.some((c) => c.name === name)).length;
    save.coach = coachAfterSeason(save.coach, ran.length > 0 && matched * 2 > ran.length);
  }
}

// ---------------------------------------------------------------------------
// Running the plan: sessions and the package's scrims
// ---------------------------------------------------------------------------

/** Who runs the plan right now: the coach's own plan lands at his plan quality (experience). */
function unsupervisedOf(_t: TrainingState, plan: TrainingPlan): boolean {
  return plan.author === "coach";
}

/** A player's effect under the running plan (the base when none). */
export function playerEffectOf(save: CareerSave, playerId: string): PackageEffect {
  const t = trainingOf(save);
  const plan = t.plan;
  if (!plan?.package) return BASE_EFFECT;
  return packageEffectFor(plan.package, coachProfileOf(save.coach), playerId, { unsupervised: unsupervisedOf(t, plan) });
}

/** The proposal holds today (the session waits for the answer). */
function proposalHoldsToday(save: CareerSave): boolean {
  const p = save.training?.proposal;
  return Boolean(p && p.seasonIndex === save.clock.seasonIndex && p.day === save.clock.day);
}

function coachEntry(plan: TrainingPlan, coach: CoachState | null): TrainingPlan["coaches"][number] {
  const id = coach?.id ?? "none";
  let e = plan.coaches.find((c) => c.id === id);
  if (!e) {
    e = { id, name: coach?.name ?? "", days: 0, share: 0 };
    plan.coaches.push(e);
  }
  return e;
}

/** Today's committed-week share and Training Week bonus — processDayArrival's own rule. */
function todaysWeekPlan(save: CareerSave): { share: number; bonus: boolean } {
  const prep = save.pendingEventDef !== null;
  const kind = weekAt(weekOfDay(save.clock.day)).kind;
  return { share: prep ? CAREER_TRAINING.matchPrepShare : 1, bonus: (kind === "open" || kind === "preseason") && !prep };
}

/**
 * Today's session (Mon–Fri), once: DEV-01's base × the package's effect for
 * each player, his attribute focus, the slower decline of a recovery
 * package; the coach's share (the gain above the coachless package rate) and
 * the wear go on the plan. Skipped while a proposal holds the day — the
 * decision flow runs it once answered.
 */
export function runTrainingSession(save: CareerSave): void {
  if (dayOfWeekOf(save.clock.day) > CAREER_TRAINING.trainingDaysPerWeek) return;
  trainingDayStart(save);
  const t = save.training!;
  const plan = t.plan;
  if (!plan || plan.lastSessionDay >= save.clock.day || proposalHoldsToday(save)) return;
  plan.lastSessionDay = save.clock.day;
  const { share, bonus } = todaysWeekPlan(save);
  const coach = coachProfileOf(save.coach);
  const unsupervised = unsupervisedOf(t, plan);
  const ce = coachEntry(plan, save.coach);
  ce.days += 1;
  const gearBonus = gearTrainingBonus(save.finances.gear);
  const growth = growthCtxOf(save);
  for (const p of save.squad) {
    const fx = packageEffectFor(plan.package, coach, p.id, { unsupervised });
    const e = entryOf(save, plan, p);
    const ctx = {
      seasonIndex: save.clock.seasonIndex,
      coachOverall: null,
      gearBonus,
      trainingWeekBonus: bonus,
      splitGained: p.gainedThisSplit,
      seasonGained: p.gainedThisSeason,
      ...growth,
      aging: true,
      packageMult: fx.sessionMult,
      offsetGrowth: fx.offsets,
      declineMult: fx.declineMult,
    };
    const res = trainDay(p, ctx, share);
    if (coach && fx.sessionMult > fx.coachlessMult + 1e-9) {
      const alt = trainDay(p, { ...ctx, packageMult: fx.coachlessMult }, share);
      const coachGain = Math.max(0, res.gained - alt.gained);
      e.coachShare = round4(e.coachShare + coachGain);
      ce.share = round4(ce.share + coachGain);
    }
    e.sessions = round4(e.sessions + res.gained);
    e.declined = round4(e.declined + res.declined);
    e.wear = round4(e.wear + (fx.wearPerWeek * fx.wearMult * share) / CAREER_TRAINING.trainingDaysPerWeek);
    Object.assign(p, res.player);
  }
}

/** The scrim series core (shared with careerFlow's run-now / booked scrims): one Bo5 vs `oppRef`. */
export function simulateScrimSeries(
  save: CareerSave,
  oppRef: string,
  seedKey: string,
  /** A local side's anchor (R49): the sparring side is built at anchor + its offset. */
  localAnchor?: number,
): { won: boolean; score: [number, number]; games: string[] } {
  const { team } = userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: 0,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });
  const oppTeam =
    isLocalRef(oppRef) && localAnchor !== undefined
      ? localTeamFor(oppRef, {
          careerSeed: save.careerSeed,
          seasonIndex: save.clock.seasonIndex,
          difficulty: save.difficulty,
          anchor: localAnchor,
          region: save.identity.region,
        })
      : orgTeamFor(oppRef, {
          world: save.world,
          seasonIndex: save.clock.seasonIndex,
          careerSeed: save.careerSeed,
          difficulty: save.difficulty,
        });
  const rng = createRng(deriveSeed(save.careerSeed, seedKey));
  const series = simulateSeries(team, oppTeam, { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss", difficulty: save.difficulty }, rng);
  const games = series.games.map((g) => {
    const userWon = g.winnerTeamId === "user";
    return userWon ? `${g.score[0]}-${g.score[1]}` : `${g.score[1]}-${g.score[0]}`;
  });
  return { won: series.winnerTeamId === "user", score: [series.score[0], series.score[1]], games };
}

/** The region's sparring candidates with their rating gap to the squad (today's ratings). */
function scrimCandidatesOf(
  save: CareerSave,
  exclude: Set<string>,
  userRating: number = squadTeamRatingOf(save),
): { ref: string; gap: number; rating: number }[] {
  // The gap reads both sides on one scale: an org's intrinsic team rating
  // TODAY (its roster as it stands, the AI shift left out — the stored
  // computeStars snapshot lags the weekly growth and the windows) against
  // the squad's own team rating (chemistry, coach and gear in —
  // userSeedRatingFor's yardstick). The plain overall average made every
  // "even" sparring partner a stronger side.
  const ctx = { world: save.world, seasonIndex: save.clock.seasonIndex, careerSeed: save.careerSeed, difficulty: save.difficulty };
  return Object.values(save.world.orgs)
    .filter((o) => o.region === save.identity.region && !exclude.has(o.ref))
    .map((o) => {
      let rating = o.rating ?? 70 + o.prestige * 6;
      try {
        const team = orgTeamFor(o.ref, ctx);
        rating = team.rating.total - team.rating.difficultyShift;
      } catch {
        // a roster that fails to resolve keeps its stored rating
      }
      return { ref: o.ref, rating, gap: Math.round((rating - userRating) * 10) / 10 };
    });
}

/**
 * The package scrim's opponent for a day (stable per career and day): an org
 * of the region inside the level's gap band, else a side of the local scene
 * (R49) built at the band's centre — so "easy", "even" and "hard" mean what
 * they say even when every org out-rates a new squad. `localAnchor` is set
 * for a local side (its team is built from it).
 */
function packageScrimOpponent(
  save: CareerSave,
  level: ScrimLevel,
  day: number,
): { ref: string; rating: number; localAnchor?: number } | null {
  const today = new Set(
    save.scrimLog.filter((e) => e.seasonIndex === save.clock.seasonIndex && e.day === day).map((e) => e.oppRef),
  );
  const userRating = squadTeamRatingOf(save);
  const cands = scrimCandidatesOf(save, today, userRating);
  const f = derivedFloat(save.careerSeed, streams.gen("pkgScrim", `${save.clock.seasonIndex}:${day}`));
  const [lo, hi] = CAREER_SCRIM.levels[level].gap;
  if (cands.some((c) => c.gap >= lo && c.gap <= hi)) {
    const ref = pickScrimOpponent(cands, level, f);
    if (ref) return { ref, rating: cands.find((c) => c.ref === ref)?.rating ?? userRating };
  }
  const locals = localSceneRefs(save.identity.region, save.clock.seasonIndex).filter((r) => !today.has(r));
  if (locals.length === 0) return null;
  const ref = locals[Math.min(locals.length - 1, Math.floor(f * locals.length))];
  const rating = Math.min(96, Math.max(55, userRating + (lo + hi) / 2));
  return { ref, rating, localAnchor: rating - localTeamOffset(ref, save.careerSeed) };
}

/** A sparring partner's name (an org, or a side of the local scene). */
function opponentNameOf(save: CareerSave, ref: string): string {
  return save.world.orgs[ref]?.name ?? (isLocalRef(ref) ? localTeamName(ref, save.careerSeed) : ref);
}

/** The squad players a package scrim counts for: the starters, minus a rested one. */
function scrimPlayersOf(save: CareerSave, pkg: TrainingPackage): SquadPlayer[] {
  return save.squad.filter((p) => save.starterIds.includes(p.id) && !pkg.tweaks?.[p.id]?.rest);
}

/** Apply a package scrim's XP to one player inside his period cap; returns the gain. */
function applyScrimXp(save: CareerSave, p: SquadPlayer, weeks: number, room: number): number {
  if (weeks <= 0 || room <= 0) return 0;
  const ctx = {
    seasonIndex: save.clock.seasonIndex,
    coachOverall: null,
    gearBonus: gearTrainingBonus(save.finances.gear),
    trainingWeekBonus: false,
    splitGained: p.gainedThisSplit,
    seasonGained: p.gainedThisSeason,
    weeks,
    ...growthCtxOf(save),
  };
  let res = trainWeek(p, ctx);
  if (res.gained > room + 1e-9) res = trainWeek(p, { ...ctx, weeks: weeks * (room / res.gained) });
  Object.assign(p, res.player);
  return res.gained;
}

/** The easy scrim's "confidence" (decision 4-A): the consistency offset, inside the offset cap and attr ≤ 99. */
function addConfidence(p: SquadPlayer, amount: number): void {
  if (amount <= 0) return;
  const cap = CAREER_DEV.attrOffsetCap;
  const cur = p.attrOffsets.consistency ?? 0;
  const allowedMax = Math.min(cap, Math.max(cur, 99 - p.overall));
  p.attrOffsets = { ...p.attrOffsets, consistency: round2(Math.min(cur + amount, allowedMax)) };
}

/**
 * Today's package scrim (T3), once: on the package's weekday (Tue / Thu /
 * Wed), never on a matchday or with a short squad. One Bo5 vs an org of the
 * level's gap — practice only: no points, prize, reputation or achievement.
 * XP × the opponent's field quality × the week's diminishing share, inside
 * the period's cap; chemistry; wear; the easy scrim's confidence. One news
 * line a week (on the last scrim day), never a toast per scrim.
 */
export function runPackageScrims(save: CareerSave): void {
  const t = save.training;
  const plan = t?.plan;
  const day = save.clock.day;
  if (!t || !plan?.package || plan.lastScrimDay >= day) return;
  if (save.phase !== "running" || save.activeEvent || proposalHoldsToday(save)) return;
  const days = scrimDaysOf(plan.package.scrimsPerWeek);
  const dow = dayOfWeekOf(day);
  const k = days.indexOf(dow);
  if (k < 0) return;
  if (save.pendingEventDef && save.pendingEventDef.day === day) return; // never on a matchday
  plan.lastScrimDay = day;
  if (squadShort(save)) return;
  const pkg = plan.package;
  const level = resolveScrimLevel(pkg);
  const opp = packageScrimOpponent(save, level, day);
  if (!opp) return;
  const out = simulateScrimSeries(save, opp.ref, `pkgScrim:${save.clock.seasonIndex}:${day}`, opp.localAnchor);
  const coach = coachProfileOf(save.coach);
  const unsupervised = unsupervisedOf(t, plan);
  const row = CAREER_SCRIM.levels[level];
  const share = scrimWeekShare(k);
  const quality = fieldQualityFor([opp.rating]);
  const playing = new Set(scrimPlayersOf(save, pkg).map((p) => p.id));
  for (const p of save.squad) {
    if (!playing.has(p.id)) continue;
    const fx = packageEffectFor(pkg, coach, p.id, { unsupervised });
    const e = entryOf(save, plan, p);
    p.splitsTogether = round4(p.splitsTogether + row.chemistry * share * fx.scrimMult);
    const room = Math.max(0, (plan.scrimCap[p.id] ?? Infinity) - e.scrims);
    e.scrims = round4(e.scrims + applyScrimXp(save, p, scrimXpWeeksFor(level, k, quality, fx.scrimMult), room));
    if (row.consistency > 0) addConfidence(p, row.consistency * share);
    e.wear = round4(e.wear + row.wear * fx.wearMult);
  }
  const tally = plan.scrims[level] ?? [0, 0];
  plan.scrims[level] = out.won ? [tally[0] + 1, tally[1]] : [tally[0], tally[1] + 1];
  save.scrimsThisWeek = (save.scrimsThisWeek ?? 0) + 1;
  const entry: ScrimLogEntry = {
    id: `s:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    day,
    oppRef: opp.ref,
    oppName: opponentNameOf(save, opp.ref),
    won: out.won,
    scoreA: out.score[0],
    scoreB: out.score[1],
    games: out.games,
    level,
  };
  save.scrimLog.unshift(entry);
  if (save.scrimLog.length > CAREER_SAVE.scrimLogCap) save.scrimLog.length = CAREER_SAVE.scrimLogCap;
  if (k === days.length - 1) {
    const week = weekOfDay(day);
    const mine = save.scrimLog.filter(
      (s) => s.level && s.seasonIndex === save.clock.seasonIndex && weekOfDay(s.day) === week,
    );
    const won = mine.filter((s) => s.won).length;
    pushTrainingNews(save, "scrimWeek", { won, lost: mine.length - won, level }, 0);
  }
}

/** Decision 6-A: the pre-event unavailability chance the period's projected wear adds (careerFlow.rollUnavailability). */
export function wearUnavailabilityAddOf(save: CareerSave): number {
  const plan = save.training?.plan;
  if (!plan) return 0;
  return unavailabilityAddFor(plan.wearProjected, plan.endDay - plan.startDay + 1);
}

/** The pre-event roll ruled a player out — the period's summary says so (T7). */
export function noteUnavailable(save: CareerSave, playerId: string): void {
  const e = save.training?.plan?.players[playerId];
  if (e) e.unavailable = true;
}

/** finishEvent: the series a squad player played and the overall they paid (T7's "series"). */
export function noteSeriesXp(save: CareerSave, playerId: string, series: number, gain: number): void {
  const plan = save.training?.plan;
  const p = save.squad.find((x) => x.id === playerId);
  if (!plan || !p) return;
  const e = entryOf(save, plan, p);
  e.series += series;
  e.seriesGain = round4(e.seriesGain + Math.max(0, gain));
}

/** An exception line for the summary (a coach change, a signing — never a stop). */
export function noteTraining(save: CareerSave, key: string, params?: Record<string, string | number>): void {
  const plan = save.training?.plan;
  if (!plan) return;
  plan.notes.push({ key, ...(params ? { params } : {}) });
  if (plan.notes.length > 12) plan.notes.splice(0, plan.notes.length - 12);
}

/**
 * hire / fire hooks: the period runs on (f5) — each day uses the coach
 * present. A waiting proposal from a coach who left is void (the base runs
 * today); the projection and the caps are recomputed.
 */
export function onCoachChanged(save: CareerSave, kind: "hired" | "fired", name: string): void {
  const t = save.training;
  if (!t) return;
  noteTraining(save, kind === "hired" ? "coachHired" : "coachFired", { coach: name });
  if (t.proposal && (!save.coach || save.coach.id !== t.proposal.coachId)) {
    t.proposal = null;
    runTodaysSessionIfDue(save);
  }
  // "The coach runs it": a coach hired into a period on the base (or on his
  // predecessor's plan) takes it over from his first day — never a plan the
  // manager set himself.
  // rc.35 (front T): a hired coach takes the cycle over from his first day
  // (never a plan the manager set himself); a coach who leaves hands it back
  // to the preset (Easy: the recommended plan; else the manager's or the base).
  const plan = t.plan;
  if (kind === "hired" && save.coach && plan && plan.author !== "user") {
    const proposal = coachProposalOf(save);
    if (proposal) {
      applyPackage(save, proposal.package, "coach");
      return;
    }
  }
  if (kind === "fired" && !save.coach && plan && plan.author === "coach") {
    const controller = trainingControllerOf(save);
    if (controller === "auto") applyPackage(save, recommendedPackageOf(save).package, "auto");
    else if (t.repeat && t.userPackage) applyPackage(save, t.userPackage, "user");
    else applyPackage(save, null, "base");
    return;
  }
  recomputePlan(save);
}

// ---------------------------------------------------------------------------
// The projection — "from the function that runs it" (T2 c)
// ---------------------------------------------------------------------------

export interface PlayerProjection {
  id: string;
  name: string;
  /** Overall from sessions + package scrims over the projected days. */
  gain: number;
  sessions: number;
  scrims: number;
  coachShare: number;
  offsets: Partial<Record<StatKey, number>>;
  wear: number;
  overallEnd: number;
  /** The weekly session rate today (the ETA reads it). */
  weeklyRate: number;
}

export interface PackageProjection {
  fromDay: number;
  endDay: number;
  /** Days left in the period, today included. */
  daysLeft: number;
  sessionDays: number;
  scrimDays: number;
  scrimLevel: ScrimLevel | null;
  players: PlayerProjection[];
  /** The starters' average gain. */
  startersAvg: number;
  /** The squad's period wear (starters' average; sessions so far + projected). */
  squadWear: number;
  /** The pre-event unavailability it adds, in percentage points (≤ wear.chanceMax). */
  unavailabilityPts: number;
}

interface WeekForecast {
  share: number;
  bonus: boolean;
  /** An unofficial cup the forecast commits to (counts toward the split's t3 entries). */
  t3: boolean;
}

/**
 * A future week's training rule, forecast from what the save knows: the
 * current week is exact (its Monday commit); a regional week is an event
 * week; a Major / Worlds week is one when the announced (else the live)
 * field holds the user; an open week is one when the autoplay enters the cup
 * the calendar offers (prefs.autoEnterUnofficials). Windows and the
 * preseason have no event.
 */
function forecastWeek(save: CareerSave, week: number, t3Entries: number): WeekForecast {
  const prep = CAREER_TRAINING.matchPrepShare;
  if (week === weekOfDay(save.clock.day)) {
    const w = todaysWeekPlan(save);
    return { share: w.share, bonus: w.bonus, t3: false };
  }
  const cal = weekAt(week);
  if (cal.kind === "regional") return { share: prep, bonus: false, t3: false };
  if (cal.kind === "major") {
    const field = save.competition.majorFieldRefs ?? majorFieldFor(save.competition, save.careerSeed);
    return field.includes("user") ? { share: prep, bonus: false, t3: false } : { share: 1, bonus: false, t3: false };
  }
  if (cal.kind === "worlds") {
    const field = save.competition.worldsFieldRefs ?? worldsFieldFor(save.competition, save.careerSeed);
    return field.includes("user") ? { share: prep, bonus: false, t3: false } : { share: 1, bonus: false, t3: false };
  }
  if (cal.kind === "open" && save.prefs.autoEnterUnofficials) {
    const offer = unofficialOfferFor(save.clock.seasonIndex, week, {
      userTeamRating: approxUserRating(save),
      rep: save.reputation,
      t3EntriesThisSplit: t3Entries,
      careerSeed: save.careerSeed,
    });
    if (offer) return { share: prep, bonus: false, t3: offer.tier === "t3" };
  }
  return { share: 1, bonus: cal.kind === "open" || cal.kind === "preseason", t3: false };
}

/** The first day the projection covers: today, unless today's session already ran. */
function projectionStart(save: CareerSave): number {
  const plan = save.training?.plan;
  const today = save.clock.day;
  const done = plan && plan.seasonIndex === save.clock.seasonIndex && plan.lastSessionDay >= today;
  return done ? today + 1 : today;
}

interface ProjectOpts {
  /** Another coach (the hire card); undefined = the coach in post. */
  coach?: CoachState | null;
  /** The coach runs his plan alone (mode "coach"); default: the running plan's rule. */
  unsupervised?: boolean;
  fromDay?: number;
  toDay?: number;
  /** Skip the scrims (the cap's sessions-only pass). */
  sessionsOnly?: boolean;
  /** Period-so-far totals per player (the cap and the period wear); default: the running plan's. */
  soFar?: Record<string, { sessions: number; scrims: number; wear: number }>;
}

/**
 * Project `pkg` (null = the base) over the rest of the period (or
 * [fromDay, toDay]) through the same session and scrim functions the days
 * run, on a copy of the squad. Scrim XP reads the opponent today's ratings
 * pick; unknown event commitments are forecast (`forecastWeek`).
 */
export function projectTrainingPackage(
  save: CareerSave,
  pkgIn: TrainingPackage | null,
  opts: ProjectOpts = {},
): PackageProjection {
  const t = trainingOf(save);
  const plan = t.plan;
  const pkg = pkgIn ? sanitizePackage(pkgIn) : null;
  const period = periodOfDay(save.clock.day);
  const fromDay = Math.max(1, opts.fromDay ?? projectionStart(save));
  const endDay = Math.min(DAYS_PER_SEASON, opts.toDay ?? (plan?.endDay ?? period.endDay));
  const coachState = opts.coach !== undefined ? opts.coach : save.coach;
  const coach = coachProfileOf(coachState);
  const unsupervised = opts.unsupervised ?? (plan ? plan.author === "coach" : Boolean(coachState));
  const soFar =
    opts.soFar ??
    Object.fromEntries(
      Object.entries(plan?.players ?? {}).map(([id, e]) => [id, { sessions: e.sessions, scrims: e.scrims, wear: e.wear }]),
    );
  const squad: SquadPlayer[] = save.squad.map((p) => ({ ...p, attrOffsets: { ...p.attrOffsets } }));
  const before = new Map(save.squad.map((p) => [p.id, { overall: p.overall, offsets: { ...p.attrOffsets } }]));
  const acc = new Map(squad.map((p) => [p.id, { sessions: 0, scrims: 0, coachShare: 0, wear: 0 }]));
  const gearBonus = gearTrainingBonus(save.finances.gear);
  const level = pkg && pkg.scrimsPerWeek > 0 ? resolveScrimLevel(pkg) : null;
  const scrimDays = pkg ? scrimDaysOf(pkg.scrimsPerWeek) : [];
  const caps = opts.sessionsOnly || !pkg ? null : scrimCapsFor(save, pkg, { coach: coachState, unsupervised, fromDay, toDay: endDay, soFar });
  const scrimTarget = level && !opts.sessionsOnly && !squadShort(save) ? packageScrimOpponent(save, level, fromDay) : null;
  const quality = scrimTarget ? fieldQualityFor([scrimTarget.rating]) : 0;
  let sessionDays = 0;
  let scrimCount = 0;
  let t3Entries = save.t3EntriesThisSplit ?? 0;
  let forecast: WeekForecast | null = null;
  let forecastWeekNo = -1;
  const weeklyRates = new Map<string, number>();
  for (let d = fromDay; d <= endDay; d++) {
    const week = weekOfDay(d);
    const dow = dayOfWeekOf(d);
    if (week !== forecastWeekNo) {
      if (dow === 1 && (week === 3 || week === 13 || week === 23)) t3Entries = 0;
      forecast = forecastWeek(save, week, t3Entries);
      if (forecast.t3) t3Entries += 1;
      forecastWeekNo = week;
    }
    if (dow > CAREER_TRAINING.trainingDaysPerWeek || !forecast) continue;
    sessionDays += 1;
    for (const p of squad) {
      const fx = packageEffectFor(pkg, coach, p.id, { unsupervised });
      const a = acc.get(p.id)!;
      const ctx = {
        seasonIndex: save.clock.seasonIndex,
        coachOverall: null,
        gearBonus,
        trainingWeekBonus: forecast.bonus,
        splitGained: p.gainedThisSplit,
        seasonGained: p.gainedThisSeason,
        model: growthCtxOf(save).model,
        day: d,
        careerSeed: save.careerSeed,
        aging: true,
        packageMult: fx.sessionMult,
        offsetGrowth: fx.offsets,
        declineMult: fx.declineMult,
      };
      const res = trainDay(p, ctx, forecast.share);
      if (!weeklyRates.has(p.id)) weeklyRates.set(p.id, round2(res.gained * (CAREER_TRAINING.trainingDaysPerWeek / Math.max(1e-9, forecast.share))));
      if (coach && fx.sessionMult > fx.coachlessMult + 1e-9) {
        const alt = trainDay(p, { ...ctx, packageMult: fx.coachlessMult }, forecast.share);
        a.coachShare += Math.max(0, res.gained - alt.gained);
      }
      a.sessions += res.gained;
      a.wear += (fx.wearPerWeek * fx.wearMult * forecast.share) / CAREER_TRAINING.trainingDaysPerWeek;
      Object.assign(p, res.player);
    }
    const k = scrimDays.indexOf(dow);
    if (k >= 0 && level && scrimTarget && pkg) {
      scrimCount += 1;
      const row = CAREER_SCRIM.levels[level];
      for (const p of squad) {
        if (!save.starterIds.includes(p.id) || pkg.tweaks?.[p.id]?.rest) continue;
        const fx = packageEffectFor(pkg, coach, p.id, { unsupervised });
        const a = acc.get(p.id)!;
        const room = Math.max(0, (caps?.[p.id] ?? Infinity) - (soFar[p.id]?.scrims ?? 0) - a.scrims);
        const weeks = scrimXpWeeksFor(level, k, quality, fx.scrimMult);
        if (weeks > 0 && room > 0) {
          const ctx = {
            seasonIndex: save.clock.seasonIndex,
            coachOverall: null,
            gearBonus,
            trainingWeekBonus: false,
            splitGained: p.gainedThisSplit,
            seasonGained: p.gainedThisSeason,
            weeks,
            model: growthCtxOf(save).model,
            day: d,
            careerSeed: save.careerSeed,
          };
          let res = trainWeek(p, ctx);
          if (res.gained > room + 1e-9) res = trainWeek(p, { ...ctx, weeks: weeks * (room / res.gained) });
          a.scrims += res.gained;
          Object.assign(p, res.player);
        }
        if (row.consistency > 0) addConfidence(p, row.consistency * scrimWeekShare(k));
        a.wear += row.wear * fx.wearMult;
      }
    }
  }
  const players: PlayerProjection[] = squad.map((p) => {
    const a = acc.get(p.id)!;
    const b = before.get(p.id)!;
    const offsets: Partial<Record<StatKey, number>> = {};
    for (const k of Object.keys(p.attrOffsets) as StatKey[]) {
      const d = round2((p.attrOffsets[k] ?? 0) - (b.offsets[k] ?? 0));
      if (Math.abs(d) >= 0.01) offsets[k] = d;
    }
    return {
      id: p.id,
      name: p.name,
      gain: round2(a.sessions + a.scrims),
      sessions: round2(a.sessions),
      scrims: round2(a.scrims),
      coachShare: round2(a.coachShare),
      offsets,
      wear: round2(Math.max(0, (soFar[p.id]?.wear ?? 0) + a.wear)),
      overallEnd: round2(p.overall),
      weeklyRate: weeklyRates.get(p.id) ?? 0,
    };
  });
  const starters = players.filter((p) => save.starterIds.includes(p.id));
  const startersAvg = starters.length > 0 ? round2(starters.reduce((s, p) => s + p.gain, 0) / starters.length) : 0;
  const squadWear = starters.length > 0 ? round2(starters.reduce((s, p) => s + p.wear, 0) / starters.length) : 0;
  const periodDays = (plan?.endDay ?? period.endDay) - (plan?.startDay ?? period.startDay) + 1;
  return {
    fromDay,
    endDay,
    daysLeft: Math.max(0, endDay - save.clock.day + 1),
    sessionDays,
    scrimDays: scrimCount,
    scrimLevel: level,
    players,
    startersAvg,
    squadWear,
    unavailabilityPts: Math.round(unavailabilityAddFor(squadWear, periodDays) * 1000) / 10,
  };
}

/**
 * T3's cap per player: package scrims may pay at most scrimCapShare of the
 * period's gain — capShare / (1 − capShare) × its sessions (so far + the
 * projected rest), net of what scrims already paid is the caller's room.
 */
function scrimCapsFor(
  save: CareerSave,
  pkg: TrainingPackage,
  opts: Omit<ProjectOpts, "sessionsOnly">,
): Record<string, number> {
  const sessions = projectTrainingPackage(save, pkg, { ...opts, sessionsOnly: true });
  const ratio = scrimCapRatio();
  const out: Record<string, number> = {};
  for (const p of sessions.players) out[p.id] = round4(ratio * ((opts.soFar?.[p.id]?.sessions ?? 0) + p.sessions));
  return out;
}

/** Recompute the running plan's projected wear (the roll reads it) and the scrim caps. */
function recomputePlan(save: CareerSave): void {
  const t = save.training;
  const plan = t?.plan;
  if (!t || !plan) return;
  if (!plan.package) {
    plan.wearProjected = 0;
    plan.scrimCap = {};
    return;
  }
  const soFar = Object.fromEntries(
    Object.entries(plan.players).map(([id, e]) => [id, { sessions: e.sessions, scrims: e.scrims, wear: e.wear }]),
  );
  const unsupervised = unsupervisedOf(t, plan);
  plan.scrimCap = scrimCapsFor(save, plan.package, { unsupervised, soFar });
  plan.wearProjected = projectTrainingPackage(save, plan.package, { unsupervised, soFar }).squadWear;
}

// ---------------------------------------------------------------------------
// Decisions and flows
// ---------------------------------------------------------------------------

export interface TrainingFlowResult {
  save: CareerSave;
  error?: string;
}

/**
 * HQ-CONTRACT H1 (front G wires it into the decision queue): the coach's
 * proposal waiting for the manager in "approve" mode. Required: the clock
 * holds on `deadlineDay` (advanceDayFlow, isStopState) until one option is
 * taken — "approve" (`approveTrainingProposalFlow`), "adjust" (the Training
 * screen, then `setTrainingPackageFlow`) or "base"
 * (`keepBaseTrainingFlow`). Null when nothing waits.
 */
export interface TrainingDecision {
  /** Stable per proposal (season and period) — front G's queue key (`DECISION_SOURCES.training`). */
  id: string;
  /** The day the clock holds on (G's queue field; same as deadlineDay). */
  deadline: number;
  kind: "trainingPlan";
  seasonIndex: number;
  /** 0-based period index (and the count, for "Period 3 of 8"). */
  periodIndex: number;
  periodCount: number;
  /** The day the clock holds on (the period's first day; today when it shows). */
  deadlineDay: number;
  required: true;
  proposal: TrainingPackage;
  coachName: string;
  reasonKey: "default" | "event" | "wear";
  options: readonly ["approve", "adjust", "base"];
}

export function trainingDecisionOf(save: CareerSave): TrainingDecision | null {
  const p = save.training?.proposal;
  if (!p || save.phase !== "running") return null;
  if (p.seasonIndex !== save.clock.seasonIndex || p.day !== save.clock.day) return null;
  return {
    id: `training:${p.seasonIndex}:${p.periodIndex}`,
    deadline: p.day,
    kind: "trainingPlan",
    seasonIndex: p.seasonIndex,
    periodIndex: p.periodIndex,
    periodCount: periodOfDay(save.clock.day).count,
    deadlineDay: p.day,
    required: true,
    proposal: p.package,
    coachName: save.coach?.name ?? "",
    reasonKey: p.reasonKey,
    options: ["approve", "adjust", "base"] as const,
  };
}

/** Run today's session (and scrim) now that nothing holds it — a decision answered on its day. */
function runTodaysSessionIfDue(save: CareerSave): void {
  if (save.phase !== "running") return;
  runTrainingSession(save);
  runPackageScrims(save);
}

function clone(save: CareerSave): CareerSave {
  return structuredClone(save);
}

/** Put `pkg` (null = the base) on the running plan from today (or tomorrow, today's session done). */
function applyPackage(save: CareerSave, pkg: TrainingPackage | null, author: TrainingPlan["author"]): void {
  trainingDayStart(save);
  const t = save.training!;
  const plan = t.plan!;
  const before = plan.package?.objective ?? null;
  plan.package = pkg ? sanitizePackage(pkg) : null;
  plan.author = pkg ? author : "base";
  plan.packageFromDay = plan.lastSessionDay >= save.clock.day ? save.clock.day + 1 : save.clock.day;
  t.proposal = null;
  const after = plan.package?.objective ?? null;
  if (save.clock.day > plan.startDay && before !== after) {
    noteTraining(save, "objectiveChange", { from: before ?? "base", to: after ?? "base" });
  }
  recomputePlan(save);
}

/** "Approve": the coach's proposal runs this period (and becomes what "repeat" renews). */
export function approveTrainingProposalFlow(input: CareerSave): TrainingFlowResult {
  const decision = trainingDecisionOf(input);
  if (!decision) return { save: input, error: "none" };
  const save = clone(input);
  const pkg = sanitizePackage(decision.proposal);
  save.training!.userPackage = pkg;
  applyPackage(save, pkg, "coach");
  runTodaysSessionIfDue(save);
  return { save };
}

/** "Keep the base": no package this period (DEV-01's base; never a malus). */
export function keepBaseTrainingFlow(input: CareerSave): TrainingFlowResult {
  if (input.phase !== "running") return { save: input, error: "blocked" };
  const save = clone(input);
  applyPackage(save, null, "base");
  runTodaysSessionIfDue(save);
  return { save };
}

/**
 * "I set it" / "Adjust": the manager's package runs from today to the
 * period's boundary (the card says how many days) and is what "repeat"
 * renews. A waiting proposal is answered by it. null = the base.
 */
export function setTrainingPackageFlow(input: CareerSave, pkg: TrainingPackage | null): TrainingFlowResult {
  if (input.phase !== "running") return { save: input, error: "blocked" };
  const save = clone(input);
  trainingDayStart(save);
  const t = save.training!;
  const clean = pkg ? sanitizePackage(pkg) : null;
  if (clean?.tweaks) {
    const ids = new Set(save.squad.map((p) => p.id));
    for (const id of Object.keys(clean.tweaks)) if (!ids.has(id)) delete clean.tweaks[id];
    if (Object.keys(clean.tweaks).length === 0) delete clean.tweaks;
  }
  t.userPackage = clean;
  delete t.carryTweaks;
  applyPackage(save, clean, "user");
  runTodaysSessionIfDue(save);
  return { save };
}

/**
 * The delegation mode (T5; every mode always available). Switching to "the
 * coach runs it" hands him the period now (his proposal, from today) when
 * he is there; a waiting proposal is answered by the switch ("coach": it
 * runs; "manual": the repeated package or the base).
 */
export function setTrainingModeFlow(input: CareerSave, mode: TrainingMode): TrainingFlowResult {
  if (!["auto", "recommend", "manual"].includes(mode)) return { save: input, error: "invalid" };
  if (input.phase === "ended") return { save: input, error: "blocked" };
  const save = clone(input);
  trainingDayStart(save);
  const t = save.training!;
  if (t.mode === mode) return { save: input };
  delete t.delegatedFrom;
  t.mode = mode;
  // rc.34 review: the new mode's own "repeat" (CAREER_PLAN.repeatByMode) — the old one
  // made "approve" never propose (repeat on) and "I set it" lapse after a period (off).
  t.repeat = CAREER_PLAN.repeatByMode[mode] ?? false;
  // rc.35: switching to "auto" without a coach applies the recommended plan now.
  if (mode === "auto" && !save.coach && t.plan && t.plan.author !== "user") {
    applyPackage(save, recommendedPackageOf(save).package, "auto");
  }
  return { save };
}

/** "Repeat until I change it" (every mode, with or without a coach). */
export function setTrainingRepeatFlow(input: CareerSave, on: boolean): TrainingFlowResult {
  const save = clone(input);
  trainingDayStart(save);
  save.training!.repeat = on;
  return { save };
}

// ---------------------------------------------------------------------------
// Views: HQ's block, the hire card, the ETA
// ---------------------------------------------------------------------------

/** HQ's training block (HQ-CONTRACT H3) — one read for front G's layout. */
export interface TrainingBlockView {
  mode: TrainingMode;
  /** rc.35: who sets the package now (the hired coach, else the preset's mode). */
  controller: "coach" | TrainingMode;
  /** rc.35: the starters' expected average gain over the cycle's remaining days (the running plan). */
  expectedAvg: number;
  /** rc.35: the share of the cycle gone (0..1), for the progress ring. */
  progress: number;
  repeat: boolean;
  period: { index: number; count: number; startDay: number; endDay: number; dayOf: number; length: number; daysLeft: number };
  package: TrainingPackage | null;
  author: TrainingPlan["author"];
  scrims: { done: number; planned: number; level: ScrimLevel | null; won: number; lost: number };
  coach: { name: string; effectPct: number; objective: TrainingObjective | null } | null;
  last: TrainingSummary | null;
  lastAvg: number | null;
  lastBest: { name: string; gain: number } | null;
  lastWear: "low" | "mid" | "high" | null;
  decision: TrainingDecision | null;
  /** The pre-event unavailability the plan adds, in points. */
  unavailabilityPts: number;
}

/** The package scrims the period's remaining weekdays hold (never on a matchday). */
function plannedScrimsOf(plan: TrainingPlan, fromDay: number): number {
  if (!plan.package) return 0;
  const days = scrimDaysOf(plan.package.scrimsPerWeek);
  let n = 0;
  for (let d = fromDay; d <= plan.endDay; d++) if (days.includes(dayOfWeekOf(d))) n += 1;
  return n;
}

/** The wear band HQ prints for a summary's average wear. */
export function wearBandOf(wear: number): "low" | "mid" | "high" {
  return wear >= CAREER_PLAN.proposal.recoveryWearAt ? "high" : wear >= CAREER_PLAN.proposal.recoveryWearAt / 2 ? "mid" : "low";
}

export function trainingBlockOf(save: CareerSave): TrainingBlockView {
  const t = trainingOf(save);
  const period = periodOfDay(save.clock.day);
  const plan = t.plan && t.plan.seasonIndex === save.clock.seasonIndex ? t.plan : null;
  const startDay = plan?.startDay ?? period.startDay;
  const endDay = plan?.endDay ?? period.endDay;
  const length = endDay - startDay + 1;
  const tally = Object.values(plan?.scrims ?? {}).reduce((s, [w, l]) => ({ won: s.won + w, lost: s.lost + l }), { won: 0, lost: 0 });
  const done = tally.won + tally.lost;
  const nextDay = plan && plan.lastScrimDay >= save.clock.day ? save.clock.day + 1 : save.clock.day;
  const coach = coachProfileOf(save.coach);
  const pkg = plan?.package ?? null;
  const last = t.history[0] ?? null;
  const lastGains = last?.players.map((p) => ({ name: p.name, gain: round2(p.after - p.before) })) ?? [];
  const lastAvg = lastGains.length > 0 ? round2(lastGains.reduce((s, g) => s + g.gain, 0) / lastGains.length) : null;
  const lastBest = [...lastGains].sort((a, b) => b.gain - a.gain)[0] ?? null;
  const lastWearAvg = last && last.players.length > 0 ? last.players.reduce((s, p) => s + p.wear, 0) / last.players.length : null;
  const expectedAvg = save.phase === "running" && plan ? projectTrainingPackage(save, pkg).startersAvg : 0;
  const dayOf = Math.min(length, Math.max(1, save.clock.day - startDay + 1));
  return {
    mode: t.mode,
    controller: trainingControllerOf(save),
    expectedAvg: round2(expectedAvg),
    progress: round2(Math.min(1, Math.max(0, (dayOf - 1) / Math.max(1, length)))),
    repeat: t.repeat,
    period: {
      index: period.index,
      count: period.count,
      startDay,
      endDay,
      dayOf,
      length,
      daysLeft: Math.max(0, endDay - save.clock.day),
    },
    package: pkg,
    author: plan?.author ?? "base",
    scrims: {
      done,
      planned: done + (plan ? plannedScrimsOf(plan, nextDay) : 0),
      level: pkg && pkg.scrimsPerWeek > 0 ? resolveScrimLevel(pkg) : null,
      won: tally.won,
      lost: tally.lost,
    },
    coach: coach
      ? {
          name: coach.name,
          effectPct: pkg ? Math.round((packageEffectFor(pkg, coach, "", { unsupervised: plan ? unsupervisedOf(t, plan) : false }).sessionMult - 1) * 100) : 0,
          objective: pkg?.objective ?? null,
        }
      : null,
    last,
    lastAvg,
    lastBest,
    lastWear: lastWearAvg === null ? null : wearBandOf(lastWearAvg),
    decision: trainingDecisionOf(save),
    unavailabilityPts: Math.round(wearUnavailabilityAddOf(save) * 1000) / 10,
  };
}

/** T4's hire card: what this coach would do here, from the same functions that run it. */
export interface CoachImpact {
  quality: number;
  experience: number;
  specialty: TrainingObjective;
  /** Quality → focus efficiency (percent of a package's effect that lands). */
  efficiencyPct: number;
  /** Experience → the share his own plan lands when he runs it alone (percent). */
  planQualityPct: number;
  /** Experience → wear he takes off (percent). */
  wearCutPct: number;
  /** His effect on a Development package (percent of the base session rate). */
  developmentPct: number;
  /** The package this impact is read on (the running one, else his proposal). */
  packageObjective: TrainingObjective;
  /** That package's session effect with him (percent). */
  packagePct: number;
  /** Expected overall per starter over the next period with him … */
  perStarter: number;
  /** … minus the same with the coach in post (or none). */
  vsCurrent: number;
}

/** T4: `coachImpactFor` — the hire card's numbers (one function for the card and the tests). */
export function coachImpactFor(save: CareerSave, coach: CoachState): CoachImpact {
  const prof = coachProfileOf(coach)!;
  const plan = trainingOf(save).plan;
  const pkg = plan?.package ?? coachProposalOf(save, coach)?.package ?? null;
  const fromDay = save.clock.day;
  const toDay = Math.min(DAYS_PER_SEASON, fromDay + CAREER_PLAN.periodDays - 1);
  const unsupervised = true;
  const soFar = {};
  const withHim = projectTrainingPackage(save, pkg, { coach, fromDay, toDay, unsupervised, soFar });
  const withNow = projectTrainingPackage(save, pkg, { coach: save.coach, fromDay, toDay, unsupervised, soFar });
  const fx = pkg ? packageEffectFor(pkg, prof, "", { unsupervised }) : null;
  return {
    quality: prof.quality,
    experience: prof.experience,
    specialty: prof.specialty,
    efficiencyPct: Math.round(prof.efficiency * 100),
    planQualityPct: Math.round(prof.planQuality * 100),
    wearCutPct: Math.round(prof.wearCut * 100),
    developmentPct: Math.round((packageEffectFor({ objective: "development", focus: "balanced", workload: "normal", scrimsPerWeek: 0, scrimLevel: "auto" }, prof, "").sessionMult - 1) * 100),
    packageObjective: pkg?.objective ?? "development",
    packagePct: fx ? Math.round((fx.sessionMult - 1) * 100) : 0,
    perStarter: withHim.startersAvg,
    vsCurrent: round2(withHim.startersAvg - withNow.startersAvg),
  };
}

/** The ETA / weekly projection context for a squad player under the running plan. */
export function packageTickCtxOf(save: CareerSave, playerId: string): {
  packageMult: number;
  offsetGrowth: Partial<Record<StatKey, number>>;
  declineMult: number;
} {
  const fx = playerEffectOf(save, playerId);
  return { packageMult: fx.sessionMult, offsetGrowth: fx.offsets, declineMult: fx.declineMult };
}

/** A coach's training profile for the UI (null = no coach). */
export function coachTrainingProfileOf(coach: CoachState | null): CoachTrainingProfile | null {
  return coachProfileOf(coach);
}
