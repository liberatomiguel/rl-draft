/**
 * Road to Worlds — a contract's terms and the talk that sets them (rc.33,
 * ECO-10 + ECO-11).
 *
 * ONE pure module behind the signing sheet, the renewal sheet and the flows
 * (`signPlayerFlow`, `renewPlayerFlow`), so a screen can never quote a deal
 * the flow would not write:
 *
 * - the PRIZE SHARE every contract carries (ECO-10): what a player asks
 *   (`prizeShareAskFor`), what a deal signed before rc.33 keeps
 *   (`contractSharePctFor`, the rc.32 rule), and what a podium pays the
 *   players who played (`prizeShareOfPodium`);
 * - the WAGE TALK (ECO-11): one answer (`negotiationAnswerFor`) to an offer
 *   of a weekly wage and a prize share against his ask — he signs it, or
 *   counters with the nearest deal he signs — inside a zone the sheet shows.
 *
 * The talk works in WEEKLY money, the number every wage label shows: a step
 * is a whole number of weekly quanta, and the contract written pays exactly
 * the weekly wage shown (`perSplitForWeekly`). rc.32 stepped the per-split
 * wage by $50 (≈ $4.69 a week), so a press often left the shown wage as it
 * was.
 *
 * Engine rules: pure, deterministic (his flexibility is a seeded draw per
 * player and window), no React; every number from balance.ts.
 */

import {
  CAREER_ECONOMY,
  CAREER_NEGOTIATION,
  CAREER_PAYROLL,
  CAREER_PRIZE_SHARE,
  CAREER_PRIZES,
  CAREER_SALARY,
} from "@/config/balance";
import { clamp } from "@/lib/util";
import type { Placement } from "../types";
import { indexedAmount, quantize, weeklyWage } from "./economy";
import { derivedFloat, streams } from "./seeds";
import type { EventTier } from "./types";

// ---------------------------------------------------------------------------
// ECO-10 — the prize share each contract carries
// ---------------------------------------------------------------------------

/** The places a share is paid on: 1st–4th ("top4" is single-elimination's 3rd/4th). */
const PODIUM: readonly Placement[] = ["champion", "runner_up", "third", "fourth", "top4"];

/** The events whose podium pays a share — never a qualifier or an unofficial cup. */
const SHARE_TIERS: readonly EventTier[] = ["regional", "major", "worlds"];

/** The rc.32 team share of a tier (CAREER_PRIZES.playerShare) — a pre-rc.33 deal's default. */
function legacyTeamShare(tier: EventTier): number {
  const s = CAREER_PRIZES.playerShare;
  return tier === "regional" ? s.regional : tier === "major" ? s.major : tier === "worlds" ? s.worlds : 0;
}

/**
 * ECO-10: the share of a podium prize (whole percent) a player asks — a star
 * asks more, a young or low player less (CAREER_PRIZE_SHARE).
 */
export function prizeShareAskFor(p: { overall: number; age: number }): number {
  const S = CAREER_PRIZE_SHARE;
  const raw = S.askAtPivot + S.askPerPoint * (Math.round(p.overall) - S.pivotOverall);
  const young = p.age <= S.youngAge ? S.youngDiscount : 0;
  return clamp(Math.round(raw) - young, S.minPct, S.maxPct);
}

/** ECO-10: is a share booked out of this event's prize at this place? */
export function sharePaysOn(tier: EventTier, placement: Placement): boolean {
  return CAREER_PRIZES.playerShare.enabled && SHARE_TIERS.includes(tier) && PODIUM.includes(placement);
}

/**
 * ECO-10: a contract's share (percent) at an event of this tier — his own,
 * or, for a deal signed before rc.33 (no `prizeSharePct`), the rc.32 team
 * share of the tier split over CAREER_PRIZE_SHARE.legacySeats.
 */
export function contractSharePctFor(contract: { prizeSharePct?: number }, tier: EventTier): number {
  if (contract.prizeSharePct !== undefined) return contract.prizeSharePct;
  return (legacyTeamShare(tier) * 100) / CAREER_PRIZE_SHARE.legacySeats;
}

/**
 * ECO-10: what the players who played keep of a podium prize — the sum of
 * their contracts' shares, quantized, never more than the prize; 0 off the
 * podium, outside a regional / Major / Worlds, or with the share switched off
 * (CAREER_PRIZES.playerShare.enabled). Three pre-rc.33 deals pay exactly the
 * rc.32 team share.
 */
export function prizeShareOfPodium(
  contracts: readonly { prizeSharePct?: number }[],
  tier: EventTier,
  placement: Placement,
  prize: number,
): number {
  if (prize <= 0 || !sharePaysOn(tier, placement)) return 0;
  const pct = contracts.reduce((sum, c) => sum + contractSharePctFor(c, tier), 0);
  if (pct <= 0) return 0;
  // The epsilon keeps 3 × (20 / 3) % of a round prize on its exact quantum.
  return Math.min(prize, quantize((prize * pct) / 100 + 1e-6));
}

// ---------------------------------------------------------------------------
// ECO-11 — the wage talk: one model, two levers, a visible zone
// ---------------------------------------------------------------------------

/**
 * ECO-11: the player's flexibility this window — a seeded draw in
 * [CAREER_NEGOTIATION.flexFloor, 1] per (player, season, window). He signs
 * any offer worth at least this × his ask; a reload changes nothing.
 */
export function negotiationFlexFor(
  careerSeed: number,
  playerId: string,
  seasonIndex: number,
  windowKey: string,
): number {
  const f = derivedFloat(careerSeed, streams.gen("negFlex", `${playerId}:${seasonIndex}:${windowKey}`));
  const floor = CAREER_NEGOTIATION.flexFloor;
  return floor + f * (1 - floor);
}

/**
 * The per-split contract whose weekly line is exactly `weekly` (a multiple of
 * the weekly quantum): the smallest such amount on the per-split quantum.
 * `weeklyWage(perSplitForWeekly(w)) === w` for every such w.
 */
export function perSplitForWeekly(weekly: number): number {
  const q = CAREER_ECONOMY.roundQuantum;
  const perSplit = (weekly * CAREER_PAYROLL.weeksPerSeason) / CAREER_PAYROLL.splitsPerSeason;
  return Math.max(q, Math.ceil(perSplit / q - 1e-9) * q);
}

/** ECO-11: the least any contract pays per split this season (CAREER_SALARY.minSalary on the money index). */
export function contractMinWageFor(seasonIndex: number): number {
  return indexedAmount(CAREER_SALARY.minSalary, seasonIndex);
}

/** ECO-11: one press of the wage stepper (weekly) — wageStepPct of his weekly ask, whole weekly quanta, never under one. */
export function wageStepWeeklyFor(askWeekly: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  return Math.max(q, Math.round((askWeekly * CAREER_NEGOTIATION.wageStepPct) / q) * q);
}

/** Contract terms: the per-split wage written, the weekly wage it pays, the prize share. */
export interface ContractTerms {
  wagePerSplit: number;
  weekly: number;
  sharePct: number;
}

/** What the user offers. Omitted fields read his ask: the share he asks, his wage at the share offered. */
export interface ContractOffer {
  /** The weekly wage offered — what every wage label shows. */
  weekly?: number;
  /** The prize share offered (whole percent). */
  sharePct?: number;
}

/** The zone at the share offered — everything the sheet draws. */
export interface NegotiationZone {
  /** The shares the talk allows (whole percent, inclusive). */
  shareMin: number;
  shareMax: number;
  /** His ask at this share — the zone's top (paying it always signs). */
  topPerSplit: number;
  topWeekly: number;
  /** The least he signs for at this share — the zone's floor. */
  floorWeekly: number;
  /** One press of the wage stepper (weekly). */
  stepWeekly: number;
}

export interface NegotiationAnswer {
  /** His ask: his wage and the share he asks. */
  ask: ContractTerms;
  /** The offer as read: the share clamped to the zone; the weekly wage capped at the zone's top. */
  offer: { weekly: number; sharePct: number };
  zone: NegotiationZone;
  /** He signs the offer. */
  accepted: boolean;
  /** The deal on the table: the offer when he signs it, else his counter. A confirm writes it only when `accepted`. */
  terms: ContractTerms;
  /** Under the zone: the nearest deal he signs (the share offered, his floor). Null when he signs. */
  counter: ContractTerms | null;
  /** His weekly ask at his own share minus the weekly wage on the table (what the talk saves; negative = it costs more). */
  savingWeekly: number;
  /** His flexibility this window (the floor ÷ his ask). */
  flex: number;
}

/**
 * ECO-11 (with ECO-10): the ONE answer to a contract offer. His ask is a
 * weekly wage at the share he asks; each share point over it lowers the wage
 * he signs for by CAREER_PRIZE_SHARE.wagePerPoint of his asking wage (each
 * point under it raises it), inside maxAboveAsk / maxBelowAsk. At the share
 * offered he signs anything from his flexibility × that ask (the floor) to
 * the ask itself (the top) — never more than the ask (the offer is capped
 * there). Under the floor he counters with the floor at the same share: the
 * nearest deal he signs, which taking always signs. Monotone (more wage or
 * more share never turns a yes into a counter), deterministic, one round.
 */
export function negotiationAnswerFor(input: {
  ask: { wagePerSplit: number; sharePct: number };
  flex: number;
  offer?: ContractOffer;
  /** The least a contract may pay per split (CAREER_SALARY.minSalary, indexed). */
  minWagePerSplit?: number;
}): NegotiationAnswer {
  const S = CAREER_PRIZE_SHARE;
  const askShare = Math.round(input.ask.sharePct);
  const askWage = input.ask.wagePerSplit;
  const minWage = Math.min(askWage, Math.max(0, input.minWagePerSplit ?? 0));
  const shareMin = Math.min(askShare, Math.max(S.minPct, askShare - S.maxBelowAsk));
  const shareMax = Math.max(askShare, Math.min(S.maxPct, askShare + S.maxAboveAsk));
  const share = clamp(Math.round(input.offer?.sharePct ?? askShare), shareMin, shareMax);

  // His ask at this share (the top) and the least he signs for (the floor), per split.
  const factor = 1 - S.wagePerPoint * (share - askShare);
  const topPerSplit = share === askShare ? askWage : Math.max(minWage, quantize(askWage * factor));
  const floorPerSplit = Math.min(topPerSplit, Math.max(minWage, input.flex * askWage * factor));
  const topWeekly = weeklyWage(topPerSplit);
  const floorWeekly = Math.min(topWeekly, weeklyAtLeast(floorPerSplit));
  const stepWeekly = wageStepWeeklyFor(weeklyWage(askWage));

  // The offer, in weekly money: omitted = the top; never above it.
  const offerWeekly = Math.min(topWeekly, Math.max(0, input.offer?.weekly ?? topWeekly));
  const termsAt = (weekly: number): ContractTerms => {
    const wagePerSplit = weekly >= topWeekly ? topPerSplit : perSplitForWeekly(weekly);
    return { wagePerSplit, weekly: weeklyWage(wagePerSplit), sharePct: share };
  };
  const accepted = offerWeekly >= floorWeekly;
  const counter = accepted ? null : termsAt(floorWeekly);
  const terms = accepted ? termsAt(offerWeekly) : counter!;
  return {
    ask: { wagePerSplit: askWage, weekly: weeklyWage(askWage), sharePct: askShare },
    offer: { weekly: offerWeekly, sharePct: share },
    zone: { shareMin, shareMax, topPerSplit, topWeekly, floorWeekly, stepWeekly },
    accepted,
    terms,
    counter,
    savingWeekly: weeklyWage(askWage) - terms.weekly,
    flex: input.flex,
  };
}

/** The smallest weekly wage (whole quanta) whose contract (`perSplitForWeekly`) pays at least `perSplit`. */
function weeklyAtLeast(perSplit: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  let w = Math.max(q, Math.floor((perSplit * CAREER_PAYROLL.splitsPerSeason) / CAREER_PAYROLL.weeksPerSeason / q) * q);
  while (perSplitForWeekly(w) < perSplit - 1e-6) w += q;
  return w;
}
