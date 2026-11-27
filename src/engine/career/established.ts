/**
 * v2.2 rc.6 (ORGMODE spec E1, E2): the established-org mode. Pure.
 *
 * An org is ESTABLISHED when the manager runs a real organization
 * (`save.identity.realOrgRef`: a takeover or an accepted job offer) and the
 * real-org start is on. A founded club keeps the reputation ladder exactly as
 * before; every rule here returns the founded answer for it.
 *
 *  - Standing: `save.reputation`, shown on a four-tier track (underdog, mid,
 *    contender, elite; CAREER_BOARD.standing lines).
 *  - Nothing is locked by reputation: every gate reads `gateRepOf(save)`,
 *    which opens the whole ladder for an established org. What still scales
 *    with reputation (sponsor tier, fanbase, coach quality, loans) keeps
 *    reading `save.reputation`.
 *  - New signings accept up to the tier's `signCap`, not the reputation line.
 *  - Capital projects need the board's sign-off (`capitalRefusalOf`).
 *  - `operationsOf` is the Club screen's view of what the org owns, retains
 *    and can buy.
 */

import { CAREER_BOARD, CAREER_GEAR, CAREER_STAFF, FEATURES } from "@/config/balance";
import type { BoardState, Stature, TierChange } from "./boardTypes";
import { windowIndexOf, weekOfDay } from "./calendar";
import {
  bootcampCostFor,
  gearPriceFor,
  moneyIndex,
  psychologistPerSplitFor,
  signableOverallCap,
  signingLevelOf,
  staffOn,
  staffPerSplitFor,
  weeklyOf,
  type GearItemId,
} from "./economy";
import type { CareerSave, GearState, StaffId } from "./types";

const B = CAREER_BOARD;
/** The reputation every gate reads in an established org: above the ladder's top rung. */
export const OPEN_GATE_REP = 100;
export const STANDING_TIERS: readonly Stature[] = ["underdog", "mid", "contender", "elite"];

type SaveLike = Pick<CareerSave, "identity" | "reputation"> & { proHost?: boolean; board?: BoardState };

/** The predicate every rule of the mode reads: a real org (takeover or job), the real-org start on. */
export function establishedOf(save: Pick<CareerSave, "identity"> & { proHost?: boolean }): boolean {
  return FEATURES.realOrgStart && !save.proHost && Boolean(save.identity.realOrgRef);
}

/** The reputation a gate compares against: the save's own for a founded club, the ladder's top for an established org. */
export function gateRepOf(save: SaveLike): number {
  return establishedOf(save) ? Math.max(OPEN_GATE_REP, save.reputation) : save.reputation;
}

// ---------------------------------------------------------------------------
// Standing (E1)
// ---------------------------------------------------------------------------

/** The line a tier starts at (underdog: 0). */
export function standingLineOf(tier: Stature): number {
  return tier === "underdog" ? 0 : B.standing[tier];
}

/** The tier a standing value sits in, read on the lines alone (no hysteresis). */
export function standingTierFor(value: number): Stature {
  if (value >= B.standing.elite) return "elite";
  if (value >= B.standing.contender) return "contender";
  if (value >= B.standing.mid) return "mid";
  return "underdog";
}

/** An established org's tier: the board's stature when it has one, else the standing's line. Null for a founded club. */
export function tierOf(save: SaveLike): Stature | null {
  if (!establishedOf(save)) return null;
  const st = save.board?.stature;
  return st && st !== "owners" ? st : standingTierFor(save.reputation);
}

export interface StandingView {
  tier: Stature;
  /** The standing (the engine's reputation, rounded). */
  value: number;
  /** The current tier's line. */
  line: number;
  /** The next tier and the line that promotes into it (null at the top). */
  next: { tier: Stature; line: number } | null;
  /** Under this the org is relegated at the review (null at the bottom). */
  relegationLine: number | null;
}

/** The Standing track for the Board and Club pages (null for a founded club). */
export function standingOf(save: SaveLike): StandingView | null {
  const tier = tierOf(save);
  if (!tier) return null;
  return standingViewFor(tier, save.reputation);
}

export function standingViewFor(tier: Stature, rep: number): StandingView {
  const i = STANDING_TIERS.indexOf(tier);
  const nextTier = STANDING_TIERS[i + 1];
  return {
    tier,
    value: Math.round(rep),
    line: standingLineOf(tier),
    next: nextTier ? { tier: nextTier, line: standingLineOf(nextTier) } : null,
    relegationLine: i > 0 ? standingLineOf(tier) - B.standing.hysteresis : null,
  };
}

/**
 * The tier after the season review: one step at most, never in the board's
 * first season (the takeover's, a new job's). Null = no change.
 */
export function standingChangeFor(board: Pick<BoardState, "kind" | "stature" | "startSeason">, rep: number, seasonIndex: number): Stature | null {
  if (board.kind !== "board" || board.stature === "owners" || seasonIndex <= board.startSeason) return null;
  const view = standingViewFor(board.stature, rep);
  if (view.next && rep >= view.next.line) return view.next.tier;
  if (view.relegationLine !== null && rep < view.relegationLine) return STANDING_TIERS[STANDING_TIERS.indexOf(board.stature) - 1];
  return null;
}

/**
 * Apply a tier change to the board (mutates): the stature (patience,
 * expectations and the calibration cell read it), the budget base and the
 * wage ceiling by `budgetStep`. The confidence bonus, the mail and the news
 * are the flow's (boardFlow). Returns the change record.
 */
export function applyTierChange(board: BoardState, to: Stature, seasonIndex: number): TierChange {
  const from = board.stature as Stature;
  const up = STANDING_TIERS.indexOf(to) > STANDING_TIERS.indexOf(from);
  const step = up ? B.standing.budgetStep.up : B.standing.budgetStep.down;
  board.stature = to;
  board.grantBase = Math.round(board.grantBase * step);
  board.wageRoom = Math.round(board.wageRoom * step);
  const change: TierChange = { seasonIndex, from, to };
  board.tierChange = change;
  return change;
}

// ---------------------------------------------------------------------------
// Signing pull (E1)
// ---------------------------------------------------------------------------

/** The best signing level a new signing accepts: the tier's cap in an established org, the reputation line otherwise. */
export function signCapOf(save: SaveLike): number {
  const tier = tierOf(save);
  return tier ? B.profiles[tier].signCap : signableOverallCap(save.reputation);
}

/** Does this player sign for this org (his signing level against `signCapOf`)? Renewals and the squad are exempt, as before. */
export function signableFor(save: SaveLike, who: number | { overall: number; potential?: number; age?: number; peakAge?: number }): boolean {
  const level = typeof who === "number" ? Math.round(who) : signingLevelOf(who);
  return level <= signCapOf(save);
}

// ---------------------------------------------------------------------------
// The structure an org arrives with (E2)
// ---------------------------------------------------------------------------

/** The installations and staff an established org of this tier owns at the takeover. */
export function inheritedGearFor(tier: Stature): GearState {
  const p = B.profiles[tier];
  const owned = CAREER_GEAR.items.map((i) => i.id).filter((id) => id !== "perfCenter").slice(0, p.gear);
  const staff: Partial<Record<StaffId, boolean>> = {};
  for (const id of p.staff) if (id !== "psychologist") staff[id] = true;
  return {
    peripherals: owned.includes("peripherals"),
    monitors: owned.includes("monitors"),
    pcs: owned.includes("pcs"),
    perfCenter: false,
    psychologist: p.staff.includes("psychologist"),
    ...(Object.keys(staff).length > 0 ? { staff } : {}),
  };
}

// ---------------------------------------------------------------------------
// The board's sign-off (E2)
// ---------------------------------------------------------------------------

export type CapitalRefusal = "boardFrozen" | "boardApproval" | "boardFlagship";

/** Is the board's hiring freeze on this window? (boardFlow.boardHiringFrozen's rule, without the flag check.) */
export function freezeOnNow(save: Pick<CareerSave, "clock"> & { board?: BoardState }): boolean {
  const f = save.board?.freeze;
  return Boolean(f && f.seasonIndex === save.clock.seasonIndex && windowIndexOf(weekOfDay(save.clock.day)) === f.windowIdx);
}

/** The confidence the board needs to fund an installation (null: not a capital project, or no board to ask). */
export function capitalApprovalFor(save: SaveLike, itemId: GearItemId): number | null {
  if (!establishedOf(save) || !FEATURES.board || !save.board || save.board.kind !== "board") return null;
  return itemId === "perfCenter" ? B.approval.flagship : B.approval.capital;
}

/** Why the board will not fund this installation now (null = it signs). Staff, coaches and camps never ask. */
export function capitalRefusalOf(save: SaveLike & Pick<CareerSave, "clock">, itemId: GearItemId): CapitalRefusal | null {
  const need = capitalApprovalFor(save, itemId);
  if (need === null || !save.board) return null;
  if (freezeOnNow(save)) return "boardFrozen";
  if (save.board.confidence < need) return itemId === "perfCenter" ? "boardFlagship" : "boardApproval";
  return null;
}

// ---------------------------------------------------------------------------
// Operations (E2): the Club screen's view
// ---------------------------------------------------------------------------

export type OperationState = "owned" | "retained" | "available" | "needsApproval" | "frozen" | "cantAfford";

export interface OperationItem {
  id: GearItemId | StaffId | "psychologist" | "bootcamp1" | "bootcamp2";
  state: OperationState;
  /** What buying it books now (gear, a camp run); a retainer's per-split fee for staff. */
  price: number;
  /** What it costs every week once owned (upkeep, retainer); 0 for a camp. */
  upkeep: number;
  /** The copy key of its effect (career.toolbox / finances read it by id). */
  effect: string;
  /** The board confidence it needs (installations only; null otherwise). */
  confidence: number | null;
  /** A camp already used this split or running now (the camp's slot is spent). */
  note?: "used" | "active";
}

export interface Operations {
  facilities: OperationItem[];
  staff: OperationItem[];
  camps: OperationItem[];
}

/**
 * Every installation, staff role and camp with its state. `floor`: the
 * lowest balance a purchase may leave (the store's Backer floor; 0 when
 * omitted). Null for a founded club (its screen keeps the ladder).
 */
export function operationsOf(save: CareerSave, opts: { floor?: number } = {}): Operations | null {
  if (!establishedOf(save)) return null;
  const s = save.clock.seasonIndex;
  const fin = save.finances;
  const floor = opts.floor ?? 0;
  const afford = (cost: number) => fin.balance - cost >= floor;
  const frozen = freezeOnNow(save);

  const facilities: OperationItem[] = CAREER_GEAR.items.map((item) => {
    const price = gearPriceFor(item.cost, save.sponsor?.tier ?? null, s);
    const confidence = capitalApprovalFor(save, item.id);
    const refusal = capitalRefusalOf(save, item.id);
    const state: OperationState = fin.gear[item.id]
      ? "owned"
      : refusal === "boardFrozen" || (frozen && confidence !== null)
        ? "frozen"
        : refusal
          ? "needsApproval"
          : afford(price)
            ? "available"
            : "cantAfford";
    return { id: item.id, state, price, upkeep: item.upkeepPerSplit > 0 ? weeklyOf(item.upkeepPerSplit * moneyIndex(s, "flat")) : 0, effect: item.id, confidence };
  });

  const staffRow = (id: StaffId | "psychologist"): OperationItem => {
    const on = id === "psychologist" ? fin.gear.psychologist : staffOn(fin.gear, id);
    const perSplit = id === "psychologist" ? psychologistPerSplitFor(s) : staffPerSplitFor(id, s);
    return { id, state: on ? "retained" : "available", price: Math.round(perSplit), upkeep: weeklyOf(perSplit), effect: id, confidence: null };
  };
  const staff = [staffRow("psychologist"), ...CAREER_STAFF.order.map((id) => staffRow(id))];

  const camps: OperationItem[] = CAREER_GEAR.bootcamp.map((camp) => {
    const id = camp.tier === 2 ? ("bootcamp2" as const) : ("bootcamp1" as const);
    const price = bootcampCostFor(camp.tier, s);
    const note = fin.bootcampSharp > 0 ? ("active" as const) : fin.bootcampUsedThisSplit ? ("used" as const) : undefined;
    return { id, state: afford(price) ? "available" : "cantAfford", price, upkeep: 0, effect: id, confidence: null, ...(note ? { note } : {}) };
  });
  return { facilities, staff, camps };
}
