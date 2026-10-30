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
 * rc.34 (front I, Miguel 31/10: "sometimes you just can't move anything"):
 * the zone is never narrower than one wage press, a share press moves the
 * wage one point the other way (`talkPressFor`, the presses the sheet makes),
 * every closed way names its reason (`NegotiationAnswer.limits`), and only a
 * player above CAREER_PRIZE_SHARE.shareThresholdOverall asks a share.
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
 * asks more, a young player less (CAREER_PRIZE_SHARE). rc.34 (front I,
 * Miguel 31/10): none at or under `shareThresholdOverall`; above it the ask
 * starts from 0 and grows `askPerPoint` a point.
 */
export function prizeShareAskFor(p: { overall: number; age: number }): number {
  const S = CAREER_PRIZE_SHARE;
  const over = Math.round(p.overall) - S.shareThresholdOverall;
  if (over <= 0) return 0;
  const young = p.age <= S.youngAge ? S.youngDiscount : 0;
  return clamp(Math.round(over * S.askPerPoint) - young, S.minPct, S.maxPct);
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

/**
 * ECO-10: what one share point is worth in WEEKLY money — wagePerPoint of his
 * weekly ask, whole weekly quanta, never under one — so every press of the
 * share lever moves the wage shown (rc.33's first cut priced it per split in
 * $50 quanta, and ±1 point often left the $10 weekly label as it was).
 */
export function sharePointWeeklyFor(askWeekly: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  return Math.max(q, Math.round((askWeekly * CAREER_PRIZE_SHARE.wagePerPoint) / q) * q);
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
  /**
   * The share is a lever in this talk. False while the prize share is
   * switched off (CAREER_PRIZES.playerShare.enabled) and, rc.34 (front I),
   * for a player who asks no share: the share stays his ask, buys no wage,
   * and the sheet hides the lever.
   */
  shareLever: boolean;
  /** One share point in weekly money (`sharePointWeeklyFor`): each point over his ask lowers the zone by this, each under it raises it. */
  pointWeekly: number;
  /** His ask at this share — the zone's top (paying it always signs). */
  topPerSplit: number;
  topWeekly: number;
  /** The least he signs for at this share — the zone's floor. */
  floorWeekly: number;
  /** One press of the wage stepper (weekly). */
  stepWeekly: number;
  /** rc.34 (front I): the least any contract pays, in weekly money (the wage never goes under it). */
  minWeekly: number;
}

/**
 * rc.34 (front I): why a lever cannot move further one way, for the offer on
 * the table — null = that way is open. The sheet names the reason under the
 * button it closes, so a disabled lever always says why.
 */
export interface TalkLimits {
  /** Wage down: "floor" = the least he signs for at this share; "minimum" = the least a contract pays. */
  wageDown: "floor" | "minimum" | null;
  /** Wage up: "ask" = his full ask at this share (paying more buys nothing). */
  wageUp: "ask" | null;
  /** Share down: "least" = the least share the talk allows (his ask − maxBelowAsk, never under minPct); "none" = the offer is already no share at all. */
  shareDown: "least" | "none" | null;
  /** Share up: "most" = the most the talk allows (his ask + maxAboveAsk, maxPct); "minimum" = his wage would go under the least a contract pays. */
  shareUp: "most" | "minimum" | null;
}

export interface NegotiationAnswer {
  /** His ask: his wage and the share he asks. */
  ask: ContractTerms;
  /** The offer as read: the share clamped to the zone; the weekly wage capped at the zone's top, on the weekly quantum. */
  offer: { weekly: number; sharePct: number };
  zone: NegotiationZone;
  /** rc.34 (front I): which ways each lever is closed for this offer, and why (`talkPressFor` reads it). */
  limits: TalkLimits;
  /** He signs the offer. */
  accepted: boolean;
  /** The deal on the table: the offer when he signs it, else his counter. A confirm writes it only when `accepted`. */
  terms: ContractTerms;
  /** Under the zone: the nearest deal he signs (the share offered, his floor). Null when he signs. */
  counter: ContractTerms | null;
  /** His weekly ask at his own share minus the weekly wage on the table (what the talk saves; negative = it costs more). */
  savingWeekly: number;
  /** His flexibility this window (1 − the zone's width at his own share ÷ his ask, before minZoneSteps). */
  flex: number;
}

/**
 * ECO-11 (with ECO-10): the ONE answer to a contract offer. His ask is a
 * weekly wage at the share he asks. The zone where he signs runs from his
 * floor to his ask (the top); its width is his flexibility × his ask, never
 * under CAREER_NEGOTIATION.minZoneSteps presses of the wage stepper and never
 * under the least a contract pays (rc.34, front I: rc.33's zone collapsed on
 * the $10 weekly grid for most low asks, so the wage could not move). Each
 * share point over his ask moves the whole zone down by one share point's
 * weekly money (`sharePointWeeklyFor`: CAREER_PRIZE_SHARE.wagePerPoint of his
 * weekly ask, whole weekly quanta), each point under it moves it up, inside
 * maxAboveAsk / maxBelowAsk — and never so far that the floor would go under
 * the least a contract pays. The offer is capped at the top (paying more than
 * his ask buys nothing); under the floor he counters with the floor at the
 * same share — the nearest deal he signs, which taking always signs.
 * Monotone (more wage or more share never turns a yes into a counter),
 * deterministic, one round. The share is pinned to his ask when the prize
 * share is switched off (CAREER_PRIZES.playerShare.enabled: a share nobody is
 * paid buys no wage) and, rc.34, when he asks none (Miguel 31/10: a player
 * under the threshold gets no percentage).
 */
export function negotiationAnswerFor(input: {
  ask: { wagePerSplit: number; sharePct: number };
  flex: number;
  offer?: ContractOffer;
  /** The least a contract may pay per split (CAREER_SALARY.minSalary, indexed). */
  minWagePerSplit?: number;
}): NegotiationAnswer {
  const S = CAREER_PRIZE_SHARE;
  const q = CAREER_PAYROLL.weeklyQuantum;
  const askShare = Math.max(0, Math.round(input.ask.sharePct));
  const askWage = input.ask.wagePerSplit;
  const askWeekly = weeklyWage(askWage);
  const minWage = Math.min(askWage, Math.max(0, input.minWagePerSplit ?? 0));
  const minWeekly = Math.min(askWeekly, weeklyAtLeast(minWage));
  const pointWeekly = sharePointWeeklyFor(askWeekly);
  const stepWeekly = wageStepWeeklyFor(askWeekly);

  // The zone's width (weekly money, whole quanta): his flexibility × his ask,
  // at least minZoneSteps presses, never under the least a contract pays.
  const flexGap = Math.floor(((1 - input.flex) * askWeekly) / q + 1e-9) * q;
  const gapWeekly = clamp(Math.max(flexGap, CAREER_NEGOTIATION.minZoneSteps * stepWeekly), 0, askWeekly - minWeekly);
  const floorAtAsk = askWeekly - gapWeekly;

  const shareLever = CAREER_PRIZES.playerShare.enabled && askShare > 0;
  // Share points over his ask that still leave his floor at or above the minimum.
  const roomAbove = Math.max(0, Math.floor((floorAtAsk - minWeekly) / pointWeekly));
  const mostAbove = Math.min(S.maxPct, askShare + S.maxAboveAsk);
  const shareMin = shareLever ? Math.min(askShare, Math.max(S.minPct, askShare - S.maxBelowAsk)) : askShare;
  const shareMax = shareLever ? Math.max(askShare, Math.min(mostAbove, askShare + roomAbove)) : askShare;
  const share = clamp(Math.round(input.offer?.sharePct ?? askShare), shareMin, shareMax);

  // The zone at this share: his ask (the top) and the least he signs for (the
  // floor) both move by one point's weekly money a point, so its width holds.
  const shift = (share - askShare) * pointWeekly;
  const topWeekly = askWeekly - shift;
  const topPerSplit = share === askShare ? askWage : perSplitForWeekly(topWeekly);
  const floorWeekly = floorAtAsk - shift;

  // The offer, in weekly money on the weekly quantum: omitted = the top; never above it.
  const offerWeekly = Math.min(topWeekly, Math.max(0, Math.floor((input.offer?.weekly ?? topWeekly) / q + 1e-9) * q));
  const termsAt = (weekly: number): ContractTerms => {
    const wagePerSplit = weekly >= topWeekly ? topPerSplit : perSplitForWeekly(weekly);
    return { wagePerSplit, weekly: weeklyWage(wagePerSplit), sharePct: share };
  };
  const accepted = offerWeekly >= floorWeekly;
  const counter = accepted ? null : termsAt(floorWeekly);
  const terms = accepted ? termsAt(offerWeekly) : counter!;
  const limits: TalkLimits = {
    wageDown: offerWeekly > floorWeekly ? null : floorWeekly <= minWeekly ? "minimum" : "floor",
    wageUp: offerWeekly < topWeekly ? null : "ask",
    shareDown: share > shareMin ? null : share <= 0 ? "none" : "least",
    shareUp: share < shareMax ? null : shareMax < mostAbove ? "minimum" : "most",
  };
  return {
    ask: { wagePerSplit: askWage, weekly: askWeekly, sharePct: askShare },
    offer: { weekly: offerWeekly, sharePct: share },
    zone: { shareMin, shareMax, shareLever, pointWeekly, topPerSplit, topWeekly, floorWeekly, stepWeekly, minWeekly },
    limits,
    accepted,
    terms,
    counter,
    savingWeekly: askWeekly - terms.weekly,
    flex: input.flex,
  };
}

/** rc.34 (front I): the two levers of the talk. */
export type TalkLever = "wage" | "share";

/**
 * rc.34 (front I): the offer one press of a lever makes — the wage by one
 * stepper press (never past his floor or his ask), the share by one point
 * with the wage moved one point's weekly money the other way, so the offer
 * keeps its place in the zone: a share press always moves the wage shown and
 * never turns a yes into a counter (rc.33's sheet kept the wage, so lowering
 * his share often left the wage as it was and made him counter). Null when
 * that way is closed (`answer.limits` says why). The sheet only renders this.
 */
export function talkPressFor(answer: NegotiationAnswer, lever: TalkLever, dir: 1 | -1): ContractOffer | null {
  const { zone, offer, limits } = answer;
  if (lever === "wage") {
    if (dir < 0) {
      return limits.wageDown ? null : { weekly: Math.max(zone.floorWeekly, offer.weekly - zone.stepWeekly), sharePct: offer.sharePct };
    }
    return limits.wageUp ? null : { weekly: Math.min(zone.topWeekly, offer.weekly + zone.stepWeekly), sharePct: offer.sharePct };
  }
  if (!zone.shareLever) return null;
  if (dir < 0) return limits.shareDown ? null : { weekly: offer.weekly + zone.pointWeekly, sharePct: offer.sharePct - 1 };
  return limits.shareUp ? null : { weekly: Math.max(0, offer.weekly - zone.pointWeekly), sharePct: offer.sharePct + 1 };
}

/** The smallest weekly wage (whole quanta) whose contract (`perSplitForWeekly`) pays at least `perSplit`. */
function weeklyAtLeast(perSplit: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  let w = Math.max(q, Math.floor((perSplit * CAREER_PAYROLL.splitsPerSeason) / CAREER_PAYROLL.weeksPerSeason / q) * q);
  while (perSplitForWeekly(w) < perSplit - 1e-6) w += q;
  return w;
}
