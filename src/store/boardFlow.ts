/**
 * v2.2 board front — the board's flow (FEATURES.board, FEATURES.realOrgStart).
 *
 * careerFlow calls these from one-line hooks:
 *   - createCareerSave      → boardOnCreate (a takeover's seat swap, the board)
 *   - runSplitBoundary      → boardOnSplitBoundary (checkpoints at W11 / W21)
 *   - enterSeasonReview     → boardOnSeasonReview (the verdict, dismissal, offers)
 *   - rolloverToNextSeason  → boardSeatAtRollover (an accepted offer's move)
 *                           → boardOnSeasonStart (an older save's board, the packages)
 * The decisions that hold the clock are reported to careerDecisions
 * (`boardDecisionOf`): the package choice on the season's first day and,
 * after a dismissal, the job choice that holds the rollover.
 *
 * Flag off: every hook returns at once and nothing is created, so a career
 * plays exactly as before (careerBoard.flagOff.test.ts).
 */

import { CAREER_BOARD, FEATURES } from "@/config/balance";
import {
  applyConfidence,
  bestFinishOf,
  boardPackagesFor,
  chanceNowOf,
  chanceBandOf,
  checkpointDelta,
  legacyFor,
  missionProgressOf,
  newBoardState,
  ratedGoals,
  seasonBriefFor,
  secondaryFor,
  secondaryMet,
  stretchFor,
  ultimatumAllowed,
  ultimatumMissionFor,
  type ObjectiveInput,
} from "@/engine/career/board";
import type { BoardPackage, BoardState, JobOffer, PackageId } from "@/engine/career/boardTypes";
import { deliverMail, deliverNews } from "@/engine/career/communications";
import { grantBaseNow, wageCeilingOf } from "@/engine/career/budget";
import { applyTierChange, establishedOf, gateRepOf, standingChangeFor } from "@/engine/career/established";
import { seasonYear } from "@/engine/career/development";
import { pushLedger, quantize, weeklyWageBill } from "@/engine/career/economy";
import { bumpManagerRep, dismissalOffersFor, newManagerState, unsolicitedOfferFor } from "@/engine/career/manager";
import { orgMoneyFor, patienceOf, profileOf, type ProfileKey } from "@/engine/career/orgProfile";
import { foundNewSeat, leaveSeat, takeOrgSeat } from "@/engine/career/seatSwap";
import { seasonGoalProgressOf, seasonGoalChance } from "@/engine/career/seasonGoals";
import { derivedFloat, streams } from "@/engine/career/seeds";
import { windowIndexOf, weekOfDay } from "@/engine/career/calendar";
import { fillerOrgName } from "@/engine/career/worldSim";
import type { CareerSave, MailItem } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { buyGearFlow, fieldDrawOf, setStaffFlow, sponsorLevelOf, type CreateCareerInput, type FlowResult } from "./careerFlow";
import { CAREER_STAFF } from "@/config/balance";
import { gearNextItem, gearPriceFor, staffOn, staffPerSplitFor, type GearItemId } from "@/engine/career/economy";
import type { StaffId } from "@/engine/career/types";
import { initialTrainingState } from "./careerTraining";

const B = CAREER_BOARD;
const OFFER_REGIONS: readonly Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

export function boardOn(save: CareerSave): save is CareerSave & { board: BoardState } {
  return FEATURES.board && !save.proHost && save.board !== undefined;
}

function today(save: CareerSave) {
  return { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
}

function mail(save: CareerSave, titleKey: string, params: Record<string, string | number> = {}, linkTo = "/career/board"): void {
  const item: Omit<MailItem, "id" | "seasonIndex" | "day" | "read"> = { kind: "club", titleKey, bodyKey: titleKey, params, fromKey: "board", linkTo };
  deliverMail(save, item);
}

/** The board's patience on this save (its stature × the difficulty): every loss is scaled by it. */
function patienceNow(save: CareerSave & { board: BoardState }): number {
  return patienceOf(save.board.stature, save.difficulty);
}

function weekWagesOf(save: CareerSave): number {
  return weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null);
}

function objectiveInputOf(save: CareerSave): ObjectiveInput {
  const input: ObjectiveInput = { level: sponsorLevelOf(save), cup: fieldDrawOf(save), seasonIndex: save.clock.seasonIndex };
  if (save.board) input.cal = { stature: save.board.stature, difficulty: save.difficulty, first: save.clock.seasonIndex === save.board.startSeason };
  return input;
}

/** For the probe's calibration: the season's every goal at its RAW model chance (no cell). */
export function boardRawGoalsOf(save: CareerSave): ReturnType<typeof ratedGoals> {
  return ratedGoals({ level: sponsorLevelOf(save), cup: fieldDrawOf(save), seasonIndex: save.clock.seasonIndex });
}

/** The wage ceiling in this season's money (the board sized it in its own season's). */
export function wageRoomNow(board: BoardState, seasonIndex: number): number {
  return wageCeilingOf(board, seasonIndex);
}

// ---------------------------------------------------------------------------
// Creation and the season's offer
// ---------------------------------------------------------------------------

function boardFor(save: CareerSave, stature: ProfileKey, startSeason: number, confidence?: number): BoardState {
  const week = weekWagesOf(save);
  const money = orgMoneyFor(stature, week, save.difficulty, startSeason);
  return newBoardState({
    kind: stature === "owners" ? "owners" : "board",
    stature,
    startSeason,
    weekWages: week,
    grantBase: money.grant,
    wageRoom: money.wageRoom,
    ...(confidence !== undefined ? { confidence } : {}),
  });
}

/** The season's three packages, the secondary and (after a title) the legacy objective: fixed once shown. */
function offerSeason(save: CareerSave & { board: BoardState }): void {
  const board = save.board;
  const s = save.clock.seasonIndex;
  // A squad short of three (contracts ran out at the rollover) is not judged yet: the offer waits for it.
  if (board.season?.seasonIndex === s || save.squad.length < 3) return;
  const input = objectiveInputOf(save);
  const week = weekWagesOf(save);
  // rc.6 (ORGMODE E3): an established org's budget is its own (grantBase on the money index), not the current wage bill.
  const established = establishedOf(save) && board.kind === "board";
  const grantBase =
    board.kind === "owners"
      ? 0
      : established
        ? grantBaseNow(board, s)
        : quantize(Math.min(week, wageRoomNow(board, s)) * profileOf(board.stature).grantWeeks);
  const offers = boardPackagesFor({
    ...input,
    stature: board.stature,
    difficulty: save.difficulty,
    grantBase,
    budgetMult: board.budgetMult,
    weekWages: week,
    ...(established ? { established: true } : {}),
  });
  const last = save.history[save.history.length - 1];
  const lastTitles = last && last.seasonIndex === s - 1 ? titlesOfSeason(save, s - 1) : null;
  const majorChance = seasonGoalChance({ kind: "majorQualify", count: 1 }, input.level, input.cup);
  // rc.6 (ORGMODE E4): why the board asks this, read from last season (an established org only).
  const prev = board.season?.seasonIndex === s - 1 ? board.season : null;
  const brief =
    established && board.stature !== "owners"
      ? seasonBriefFor({
          tier: board.stature,
          firstSeason: s === board.startSeason,
          last: prev,
          tierChange: board.tierChange?.seasonIndex === s - 1 ? board.tierChange : null,
          ultimatumSurvived: board.ultimatum?.status === "met" && board.ultimatum.issuedSeason === s - 1,
          titles: lastTitles,
          ...(last && last.seasonIndex === s - 1 && last.userRegionRank ? { lastRegionalRank: last.userRegionRank } : {}),
          ...(prev ? { bestFinish: bestFinishOf(save.eventResults, s - 1) } : {}),
        })
      : null;
  board.season = {
    seasonIndex: s,
    offers,
    choice: null,
    secondary: secondaryFor(derivedFloat(save.careerSeed, streams.gen("boardSecondary", String(s))), majorChance, wageRoomNow(board, s)),
    legacy: legacyFor(lastTitles, input),
    startChance: null,
    checkpoints: [],
    met: null,
    ...(brief ? { brief } : {}),
  };
  mail(save, "boardPackage", { season: s + 1 });
}

/** v2.2: the season's titles as the history kept them (Major wins counted from the honours, Worlds from the record). */
function titlesOfSeason(save: CareerSave, seasonIndex: number): { worlds: boolean; majors: number } {
  const rec = save.history.find((h) => h.seasonIndex === seasonIndex);
  const worlds = rec?.userWorldsPlacement === "champion";
  const both = (save.userTitlesBySeason ?? []).find((t) => t.seasonIndex === seasonIndex)?.majorOrWorlds ?? 0;
  return { worlds, majors: Math.max(0, both - (worlds ? 1 : 0)) };
}

/**
 * Hook: career creation (before the season goal is attached). A takeover
 * swaps the placeholder squad for the org's (FEATURES.realOrgStart); the
 * board starts with its first season's offer (FEATURES.board).
 */
export function boardOnCreate(save: CareerSave, input: CreateCareerInput): void {
  // The Pro's hidden host has no board, no manager and no takeover: the predicate every board hook reads.
  if (input.proHost) {
    save.proHost = true;
    return;
  }
  let stature: ProfileKey = "owners";
  if (input.realOrgRef && FEATURES.realOrgStart) {
    const ref = input.realOrgRef;
    if (save.world.orgs[ref]) {
      leaveSeat(save, false);
      const taken = takeOrgSeat(save, ref);
      if (taken) stature = taken.stature;
      else throw new Error(`takeover failed: ${ref}`);
      save.training = initialTrainingState(input.difficulty, input.trainingMode);
    }
  }
  if (!FEATURES.board) return;
  save.board = boardFor(save, stature, 0);
  save.manager = newManagerState(0, save.identity.orgName, save.identity.realOrgRef);
  offerSeason(save as CareerSave & { board: BoardState });
}

/** Hook: every day's arrival, before anything else: a season whose squad was short at the rollover gets its offer once it has three. */
export function boardOnDayArrival(save: CareerSave): void {
  if (!boardOn(save) || save.phase !== "running") return;
  if (save.board.season?.seasonIndex === save.clock.seasonIndex) return;
  offerSeason(save as CareerSave & { board: BoardState });
}

/** Hook: the rollover, once the new season's goal is attached. An older save's board starts here, at full confidence. */
export function boardOnSeasonStart(save: CareerSave): void {
  if (!FEATURES.board || save.proHost) return;
  if (!save.board) {
    save.board = boardFor(save, save.identity.realOrgRef ? "mid" : "owners", save.clock.seasonIndex, 100);
    save.manager ??= newManagerState(save.clock.seasonIndex, save.identity.orgName, save.identity.realOrgRef);
  }
  const board = save.board;
  // A move into another region: the old region's local-scene origin does not travel (read afresh, as a new career).
  if (board.regionChangedAt === save.clock.seasonIndex) delete save.competition.localOrigin;
  board.weekWages = weekWagesOf(save);
  // A fresh season: the board forgives part of the gap below its starting view.
  const gap = B.confidence.start - board.confidence;
  if (gap > 0 && board.startSeason < save.clock.seasonIndex) {
    applyConfidence(board, Math.round(gap * B.seasonRecovery[board.kind]), "newSeason", today(save));
  }
  if (board.freeze && board.freeze.seasonIndex < save.clock.seasonIndex) board.freeze = null;
  offerSeason(save as CareerSave & { board: BoardState });
}

// ---------------------------------------------------------------------------
// The package choice
// ---------------------------------------------------------------------------

export function pendingPackageOf(save: CareerSave): BoardPackage[] | null {
  if (!boardOn(save) || save.phase !== "running") return null;
  const season = save.board.season;
  return season && season.seasonIndex === save.clock.seasonIndex && season.choice === null ? season.offers : null;
}

/** The manager takes one of the three packages: its budget is paid, its objective becomes the season's target. */
export function chooseBoardPackageFlow(input: CareerSave, id: PackageId): FlowResult {
  if (!pendingPackageOf(input)) return { save: input, error: "none" };
  const save = structuredClone(input) as CareerSave & { board: BoardState };
  const season = save.board.season!;
  const pkg = season.offers.find((o) => o.id === id);
  if (!pkg) return { save: input, error: "unknown" };
  season.choice = id;
  season.startChance = pkg.objective.chance;
  if (pkg.grant > 0) {
    save.finances = pushLedger(save.finances, { seasonIndex: save.clock.seasonIndex, week: weekOfDay(save.clock.day), day: save.clock.day, kind: "boardGrant", amount: pkg.grant });
  }
  // The board's objective is the season goal's target: one goal card, one settlement (seasonGoals).
  if (save.seasonGoals) {
    const oi = objectiveInputOf(save);
    const plan = save.seasonGoals.plan;
    const stretch = stretchFor(pkg.objective, oi);
    if (plan && plan.seasonIndex === save.clock.seasonIndex) {
      plan.target = { ...pkg.objective };
      if (stretch) plan.stretch = stretch;
    }
  }
  return { save };
}

// ---------------------------------------------------------------------------
// Checkpoints (end of splits 1 and 2)
// ---------------------------------------------------------------------------

function progressCtx(save: CareerSave) {
  return {
    seasonIndex: save.clock.seasonIndex,
    today: today(save),
    results: save.eventResults,
    majorFieldRefs: save.competition.majorFieldRefs,
    worldsFieldRefs: save.competition.worldsFieldRefs,
  };
}

function chosenOf(board: BoardState): BoardPackage | null {
  const season = board.season;
  return season?.choice ? (season.offers.find((o) => o.id === season.choice) ?? null) : null;
}

function debtCheck(save: CareerSave & { board: BoardState }): void {
  if (save.finances.balance < -B.debt.weeks * Math.max(1, weekWagesOf(save))) applyConfidence(save.board, B.debt.cost, "debt", today(save), patienceNow(save));
}

function warnIfLow(save: CareerSave & { board: BoardState }): void {
  const board = save.board;
  if (board.confidence < B.confidence.warn && board.warnedSeason === null) {
    board.warnedSeason = save.clock.seasonIndex;
    mail(save, "boardWarning", { confidence: board.confidence, line: B.confidence.ultimatum });
  }
}

/** Hook: the split boundary Monday (weeks 11 and 21 are checkpoints; 31 is the season's own verdict). */
export function boardOnSplitBoundary(save: CareerSave, week: number): void {
  if (!boardOn(save) || (week !== 11 && week !== 21)) return;
  const board = save.board;
  const season = board.season;
  const split = week === 11 ? 1 : 2;
  if (!season || season.seasonIndex !== save.clock.seasonIndex || season.checkpoints.includes(split)) return;
  season.checkpoints.push(split);
  const pkg = chosenOf(board);
  const when = today(save);
  const before = board.confidence;
  let bandNow: string | null = null;
  if (pkg && season.startChance !== null) {
    const oi = objectiveInputOf(save);
    const progress = seasonGoalProgressOf(pkg.objective, progressCtx(save));
    const now = chanceNowOf(pkg.objective, progress, oi);
    if (progress.out && !season.outCharged) {
      season.outCharged = true;
      applyConfidence(board, B.checkpoint.outCost, "objectiveOut", when, patienceNow(save));
    } else if (!progress.out) {
      // Compared on one basis: the model's chance now against its own chance with nothing played yet.
      const base = chanceNowOf(pkg.objective, { done: 0, target: Math.max(1, pkg.objective.count), left: 99, hit: false, out: false }, oi);
      const shift = season.startChance - base;
      const nowStated = Math.min(1, Math.max(0, now + shift));
      bandNow = chanceBandOf(nowStated);
      season.bandNow = bandNow;
      applyConfidence(board, checkpointDelta(base, now), now >= base ? "onTrack" : "behind", when, patienceNow(save));
    }
  }
  debtCheck(save);
  const warnedBefore = board.warnedSeason !== null;
  warnIfLow(save);
  if (board.confidence < B.confidence.ultimatum && warnedBefore && ultimatumAllowed(board, save.clock.seasonIndex)) {
    const mission = ultimatumMissionFor(week, objectiveInputOf(save));
    if (mission) {
      board.ultimatum = { issuedSeason: save.clock.seasonIndex, issuedDay: save.clock.day, fromWeek: week, objective: mission, status: "open" };
      mail(save, "boardUltimatum", { kind: mission.kind, count: mission.count, place: mission.place ?? 0, band: chanceBandOf(mission.chance) });
    }
  }
  if (board.confidence !== before && !board.ultimatum) mail(save, "boardCheckpoint", { split, confidence: board.confidence, delta: board.confidence - before, ...(bandNow ? { band: bandNow } : {}) });
}

// ---------------------------------------------------------------------------
// The season's verdict
// ---------------------------------------------------------------------------

function seasonTitles(save: CareerSave): { majors: number; worlds: number; regionals: number } {
  const mine = save.eventResults.filter((r) => r.seasonIndex === save.clock.seasonIndex && r.rows.find((x) => x.ref === "user")?.placement === "champion");
  return {
    majors: mine.filter((r) => r.tier === "major").length,
    worlds: mine.filter((r) => r.tier === "worlds").length,
    regionals: mine.filter((r) => r.tier === "regional").length,
  };
}

function pay(save: CareerSave, amount: number, refName?: string): void {
  if (amount <= 0) return;
  save.finances = pushLedger(save.finances, { seasonIndex: save.clock.seasonIndex, week: weekOfDay(save.clock.day), day: save.clock.day, kind: "boardBonus", amount, ...(refName ? { refName } : {}) });
}

/** Hook: the season review, after the season goal is settled and the record filed. */
export function boardOnSeasonReview(save: CareerSave): void {
  if (!boardOn(save)) return;
  const board = save.board;
  const season = board.season;
  const s = save.clock.seasonIndex;
  const manager = (save.manager ??= newManagerState(s, save.identity.orgName, save.identity.realOrgRef));
  if (!season || season.seasonIndex !== s || season.met !== null) return;
  const when = today(save);
  const week = weekWagesOf(save);
  const pkg = chosenOf(board);

  // 1. The sporting objective (the season goal's target).
  if (pkg) {
    const met = save.seasonGoals?.targetMet === true;
    season.met = met;
    if (met) {
      applyConfidence(board, pkg.hit, "objectiveMet", when);
      pay(save, pkg.bonus);
      bumpManagerRep(manager, B.manager.objectiveHit[pkg.id]);
    } else {
      applyConfidence(board, pkg.miss, "objectiveMissed", when);
      bumpManagerRep(manager, B.manager.objectiveMiss);
    }
  } else season.met = false;

  // 2. The secondary objective.
  if (season.secondary) {
    const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
    const last = save.history[save.history.length - 1];
    const met = secondaryMet(season.secondary, {
      balance: save.finances.balance,
      weekWages: week,
      starterAges: starters.map((p) => seasonYear(s) - p.birthYear),
      homeStarters: starters.filter((p) => p.region === save.identity.region).length,
      majorsQualified: last?.seasonIndex === s ? last.majorsQualified : 0,
    });
    season.secondary.met = met;
    applyConfidence(board, met ? B.secondary.hit : B.secondary.miss, met ? "secondaryMet" : "secondaryMissed", when, patienceNow(save));
    if (met) pay(save, quantize(week * B.secondary.bonusWeeks));
  }

  // 3. A legacy objective: a reward when met, nothing when missed.
  if (season.legacy) {
    const met = seasonGoalProgressOf(season.legacy.objective, { ...progressCtx(save), over: true }).hit;
    season.legacy.met = met;
    if (met) {
      applyConfidence(board, B.legacy.hit, "legacyMet", when);
      pay(save, quantize(week * B.legacy.bonusWeeks));
      bumpManagerRep(manager, B.legacy.managerRep);
    }
  }

  // 4. Titles: confidence, the manager's name, and a protection period.
  const t = seasonTitles(save);
  if (t.majors > 0) applyConfidence(board, B.titleConfidence.major * t.majors, "titleMajor", when);
  if (t.worlds > 0) applyConfidence(board, B.titleConfidence.worlds, "titleWorlds", when);
  if (t.majors + t.worlds > 0) board.protectedUntil = s + B.titleProtectSeasons;
  bumpManagerRep(manager, t.regionals * B.manager.titles.regional + t.majors * B.manager.titles.major + t.worlds * B.manager.titles.worlds);

  // 5. The books.
  debtCheck(save);

  // 6. The ultimatum's answer.
  const u = board.ultimatum;
  if (u && u.status === "open") {
    const prog = missionProgressOf(u, save.eventResults);
    if (prog.done >= prog.target) {
      u.status = "met";
      board.confidence = Math.max(board.confidence, B.ultimatum.restore);
      board.log.unshift({ seasonIndex: s, day: when.day, delta: 0, reason: "ultimatumMet", after: board.confidence });
      board.warnedSeason = null;
      mail(save, "boardUltimatumMet", { confidence: board.confidence });
    } else {
      u.status = "failed";
      board.dismissedSeason = s;
      bumpManagerRep(manager, B.manager.dismissed);
      manager.offers = dismissalOffersFor({
        world: save.world,
        rep: manager.reputation,
        home: save.identity.region,
        regions: OFFER_REGIONS,
        exclude: [save.identity.realOrgRef ?? ""],
        careerSeed: save.careerSeed,
        seasonIndex: s,
        foundName: fillerOrgName(save.identity.region, 200 + s, save.careerSeed, save.world.nameBankVersion ?? 1),
      });
      const spell = manager.spells[manager.spells.length - 1];
      if (spell) {
        spell.toSeason = s;
        spell.left = "dismissed";
      }
      mail(save, "boardDismissed", { org: save.identity.orgName, n: manager.offers.length });
      return;
    }
  }

  // 7. What the confidence earns or costs next season (nothing paid is taken back).
  const c = board.confidence;
  if (c >= B.confidence.top && !board.upgrade) {
    board.upgrade = { offeredSeason: s };
    mail(save, "boardUpgrade", { confidence: c });
  }
  if (c >= B.confidence.high) {
    board.budgetMult = Math.min(B.budget.max, board.budgetMult + B.budget.step);
    manager.contractUntil = Math.max(manager.contractUntil, s + 1) + B.contract.extendSeasons;
    mail(save, "boardHighConfidence", { confidence: c, until: manager.contractUntil + 1 });
  } else if (c < B.confidence.warn) {
    board.budgetMult = Math.max(B.budget.min, board.budgetMult - B.budget.step);
  }
  if (c < B.freezeBelow) {
    board.freeze = { seasonIndex: s + 1, windowIdx: 0 };
    mail(save, "boardFreeze", { confidence: c });
  }
  if (c >= B.confidence.warn) board.warnedSeason = null;
  warnIfLow(save);
  mail(save, "boardVerdict", { met: season.met ? 1 : 0, confidence: c });
  boardTierReview(save as CareerSave & { board: BoardState });

  // 8. An unsolicited approach from a bigger org (never holds).
  const approach = unsolicitedOfferFor({
    world: save.world,
    rep: manager.reputation,
    confidence: c,
    current: board.stature,
    regions: OFFER_REGIONS,
    exclude: [save.identity.realOrgRef ?? ""],
    careerSeed: save.careerSeed,
    seasonIndex: s,
  });
  manager.offers = approach ? [approach] : null;
  if (approach) mail(save, "boardApproach", { org: approach.name, region: approach.region });
}

/**
 * rc.6 (ORGMODE E1): an established org's tier is re-read from its Standing
 * at the review (after the verdict): one step at most, never in the board's
 * first season. Patience, expectations and the calibration cell follow the
 * stature; the budget base and the wage ceiling step; a promotion adds
 * confidence. A mail, a news line, and the review's line (board.tierChange).
 */
function boardTierReview(save: CareerSave & { board: BoardState }): void {
  if (!establishedOf(save)) return;
  const board = save.board;
  const s = save.clock.seasonIndex;
  const to = standingChangeFor(board, save.reputation, s);
  if (!to) return;
  const change = applyTierChange(board, to, s);
  const up = to === nextTierUp(change.from);
  if (up) applyConfidence(board, B.standing.promoteConfidence, "promoted", today(save));
  mail(save, up ? "boardTierUp" : "boardTierDown", { org: save.identity.orgName, from: change.from, to });
  deliverNews(save, { type: "org", priority: 2, titleKey: up ? "orgTierUp" : "orgTierDown", params: { org: save.identity.orgName, from: change.from, to } });
}

function nextTierUp(t: string): string | null {
  return t === "underdog" ? "mid" : t === "mid" ? "contender" : t === "contender" ? "elite" : null;
}

// ---------------------------------------------------------------------------
// Offers: answer, and the seat move at the rollover
// ---------------------------------------------------------------------------

/** The job choice after a dismissal (it holds the rollover until answered). */
export function pendingJobChoiceOf(save: CareerSave): JobOffer[] | null {
  if (!boardOn(save) || save.phase !== "seasonReview") return null;
  if (save.board.dismissedSeason !== save.clock.seasonIndex || save.manager?.accepted) return null;
  return save.manager?.offers ?? null;
}

export function acceptJobOfferFlow(input: CareerSave, offerId: string): FlowResult {
  if (!boardOn(input) || input.phase !== "seasonReview") return { save: input, error: "none" };
  const offer = input.manager?.offers?.find((o) => o.id === offerId);
  if (!offer) return { save: input, error: "unknown" };
  const save = structuredClone(input);
  save.manager!.accepted = offer;
  return { save };
}

/** Turn down an approach (a dismissal's offers cannot all be turned down: "found a new club" is one of them). */
export function declineJobOfferFlow(input: CareerSave): FlowResult {
  if (!boardOn(input) || pendingJobChoiceOf(input)) return { save: input, error: "none" };
  const save = structuredClone(input);
  if (save.manager) {
    save.manager.offers = null;
    save.manager.accepted = null;
  }
  return { save };
}

/**
 * Hook: the rollover, after the squad's rollover and before the sponsors —
 * an accepted offer moves the manager (the club he leaves stays in the world
 * with the squad he built). The world has already turned to `nextSeason`.
 */
export function boardSeatAtRollover(save: CareerSave, nextSeason: number): void {
  if (!boardOn(save)) return;
  const manager = save.manager;
  const offer = manager?.accepted;
  if (!manager || !offer) {
    if (manager) manager.offers = null;
    return;
  }
  const clock = save.clock;
  save.clock = { seasonIndex: nextSeason, day: 1 };
  const leftName = save.identity.orgName;
  const leftRegion = save.identity.region;
  leaveSeat(save, true);
  const taken = offer.kind === "org" && offer.ref ? takeOrgSeat(save, offer.ref) : foundNewSeat(save, offer.name);
  const seat = taken ?? foundNewSeat(save, offer.name);
  save.clock = clock;
  if (!seat) return;
  const last = manager.spells[manager.spells.length - 1];
  if (last && last.toSeason === undefined) {
    last.toSeason = nextSeason - 1;
    last.left = "moved";
  }
  manager.spells.push({ orgName: save.identity.orgName, ...(save.identity.realOrgRef ? { ref: save.identity.realOrgRef } : {}), fromSeason: nextSeason });
  manager.offers = null;
  manager.accepted = null;
  manager.contractUntil = nextSeason + B.contract.startSeasons - 1;
  save.board = { ...boardFor(save, seat.stature, nextSeason), log: [], ...(save.identity.region !== leftRegion ? { regionChangedAt: nextSeason } : {}) };
  save.training = initialTrainingState(save.difficulty, save.training?.mode);
  save.seq += 1;
  mail(save, "boardNewJob", { org: save.identity.orgName, left: leftName });
}

// ---------------------------------------------------------------------------
// The hiring freeze, the decisions, the bot
// ---------------------------------------------------------------------------

/** A signing is refused while the board's freeze covers the current window. */
export function boardHiringFrozen(save: CareerSave): boolean {
  if (!boardOn(save) || !save.board.freeze) return false;
  const w = windowIndexOf(weekOfDay(save.clock.day));
  return save.board.freeze.seasonIndex === save.clock.seasonIndex && w === save.board.freeze.windowIdx;
}

/** What careerDecisions lists: the package choice (holds the clock) or the job choice (holds the rollover). */
export function boardDecisionOf(save: CareerSave): { id: string } | null {
  if (pendingPackageOf(save)) return { id: `board:package:${save.clock.seasonIndex}` };
  if (pendingJobChoiceOf(save)) return { id: `board:job:${save.clock.seasonIndex}` };
  return null;
}

/** For the measuring bot and tools: answer any board decision (a package; the best org offer, never "found"). */
export function boardAutoAnswer(save: CareerSave, pkg: PackageId = "expected", acceptApproach = false): CareerSave {
  if (pendingPackageOf(save)) return chooseBoardPackageFlow(save, pkg).save;
  const jobs = pendingJobChoiceOf(save);
  if (jobs) return acceptJobOfferFlow(save, (jobs.find((o) => o.kind === "org") ?? jobs[0]).id).save;
  const approach = save.phase === "seasonReview" && !save.manager?.accepted ? save.manager?.offers?.find((o) => o.reason === "approach") : undefined;
  if (acceptApproach && approach) return acceptJobOfferFlow(save, approach.id).save;
  return save;
}

// ---------------------------------------------------------------------------
// The high-confidence reward: one board-funded upgrade the manager picks
// ---------------------------------------------------------------------------

export interface BoardUpgradeOption {
  /** "gear" = the next installation of the ladder; else a support-staff role (a season's retainer paid). */
  id: "gear" | StaffId;
  /** The gear item's id, for the label. */
  item?: string;
  cost: number;
}

/** What the board would fund now: the next installation and the staff roles not yet retained, as the toolbox sells them. */
export function boardUpgradeOptionsOf(save: CareerSave): BoardUpgradeOption[] {
  if (!boardOn(save) || !save.board.upgrade || save.board.upgrade.taken || save.phase !== "running") return [];
  const out: BoardUpgradeOption[] = [];
  const next = gearNextItem(save.finances.gear);
  const rep = gateRepOf(save);
  if (next && rep >= next.repGate) out.push({ id: "gear", item: next.id, cost: gearPriceFor(next.cost, save.sponsor?.tier ?? null, save.clock.seasonIndex) });
  for (const id of CAREER_STAFF.order) {
    if (staffOn(save.finances.gear, id) || rep < CAREER_STAFF.roles[id].repGate) continue;
    out.push({ id, cost: quantize(staffPerSplitFor(id, save.clock.seasonIndex) * 3) });
  }
  return out;
}

/** The board pays for the pick (the grant lands first, then the toolbox's own purchase runs). Once per tenure. */
export function chooseBoardUpgradeFlow(input: CareerSave, id: BoardUpgradeOption["id"]): FlowResult {
  const option = boardUpgradeOptionsOf(input).find((o) => o.id === id);
  if (!option) return { save: input, error: "none" };
  let save = structuredClone(input) as CareerSave & { board: BoardState };
  save.finances = pushLedger(save.finances, { seasonIndex: save.clock.seasonIndex, week: weekOfDay(save.clock.day), day: save.clock.day, kind: "boardGrant", amount: option.cost, refName: option.item ?? option.id });
  const bought = id === "gear" ? buyGearFlow(save, option.item as GearItemId) : setStaffFlow(save, id, true);
  if (bought.error) return { save: input, error: bought.error };
  save = bought.save as CareerSave & { board: BoardState };
  save.board.upgrade = { ...save.board.upgrade!, taken: option.item ?? option.id };
  return { save };
}
