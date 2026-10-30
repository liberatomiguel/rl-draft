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
import { indexedAmount, quantize, signingBonusFor, weeklyWage } from "./economy";
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

/** Contract terms: the per-split wage written, the weekly wage it pays, the prize share, the signing bonus (rc.35). */
export interface ContractTerms {
  wagePerSplit: number;
  weekly: number;
  sharePct: number;
  /** rc.35 (front N): the signing bonus paid once on signature (luvas). */
  bonus: number;
}

/** What the user offers. Omitted fields read his ask: the share and bonus he asks, his wage at the share and bonus offered. */
export interface ContractOffer {
  /** The weekly wage offered — what every wage label shows. */
  weekly?: number;
  /** The prize share offered (whole percent). */
  sharePct?: number;
  /** rc.35 (front N): the signing bonus offered. */
  bonus?: number;
}

/** The zone at the share and bonus offered — everything the sheet draws. */
export interface NegotiationZone {
  /** The shares the talk allows (whole percent, inclusive). */
  shareMin: number;
  shareMax: number;
  /**
   * The share is a lever in this talk. False only while the prize share is
   * switched off (CAREER_PRIZES.playerShare.enabled). rc.35 (front N, Miguel
   * on rc.34): a player who asks no share still has the lever — offering him
   * one buys wage.
   */
  shareLever: boolean;
  /** One share point in weekly money (`sharePointWeeklyFor`). */
  pointWeekly: number;
  /** His ask at this share and bonus — the zone's top (paying it always signs; the wage never goes above it). */
  topPerSplit: number;
  topWeekly: number;
  /** The least he signs for for sure at this share and bonus — the zone's floor (100 % odds). */
  floorWeekly: number;
  /** rc.35 (front N): the wage where his odds reach 0 % (the floor minus the fall). */
  zeroWeekly: number;
  /** One press of the wage stepper (weekly). */
  stepWeekly: number;
  /** rc.34 (front I): the least any contract pays, in weekly money (the wage never goes under it). */
  minWeekly: number;
  /** rc.35 (front N): the signing bonus range and one step of it. */
  bonusMax: number;
  bonusStep: number;
  /** rc.35 (front N): what the contract length takes off his floor this talk (weekly). */
  lengthReliefWeekly: number;
}

/**
 * rc.34 (front I): why a lever cannot move further one way, for the offer on
 * the table — null = that way is open.
 */
export interface TalkLimits {
  /** Wage down: "minimum" = the least a contract pays. ("floor" is kept for the type; rc.35 lets an offer go under his floor.) */
  wageDown: "floor" | "minimum" | null;
  /** Wage up: "ask" = his full ask at this share and bonus (paying more buys nothing). */
  wageUp: "ask" | null;
  /** Share down: "least" = the least share the talk allows; "none" = the offer is already no share at all. */
  shareDown: "least" | "none" | null;
  /** Share up: "most" = the most the talk allows; "minimum" = his wage would go under the least a contract pays. */
  shareUp: "most" | "minimum" | null;
  /** rc.35 (front N): bonus down "none" (already 0), up "most" (the slider's top). */
  bonusDown: "none" | null;
  bonusUp: "most" | "minimum" | null;
}

export interface NegotiationAnswer {
  /** His ask: his wage, the share and the bonus he asks. */
  ask: ContractTerms;
  /** The offer as read: the share and bonus clamped to their ranges; the weekly wage between the minimum and the zone's top, on the weekly quantum. */
  offer: { weekly: number; sharePct: number; bonus: number };
  zone: NegotiationZone;
  limits: TalkLimits;
  /** rc.35 (front N): his odds of signing this offer, 0–1 (1 inside the zone). */
  odds: number;
  /** He signs the offer (his odds beat this window's roll). */
  accepted: boolean;
  /** The deal on the table: the offer when he signs it, else his counter. A confirm writes it only when `accepted`. */
  terms: ContractTerms;
  /** When he refuses: the nearest deal he signs for sure (the share and bonus offered, his floor). Null when he signs. */
  counter: ContractTerms | null;
  /** His weekly ask at his own share minus the weekly wage on the table (what the talk saves; negative = it costs more). */
  savingWeekly: number;
  /** His flexibility this window. */
  flex: number;
  /** rc.35 (front N): the contract length the talk was priced on. */
  lengthSeasons: number;
}

/** rc.35 (front N): his odds at `deficit` weekly money under his floor — smoothstep from 1 (at the floor) to 0 (`fall` under it). */
export function talkOddsFor(deficit: number, fall: number): number {
  if (deficit <= 0) return 1;
  if (fall <= 0 || deficit >= fall) return 0;
  const t = deficit / fall;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * rc.35 (front N): this window's roll for a player — he signs an offer under
 * his floor when his odds beat it. Seeded per (player, season, window) like
 * his flexibility, so a reload changes nothing.
 */
export function negotiationRollFor(
  careerSeed: number,
  playerId: string,
  seasonIndex: number,
  windowKey: string,
): number {
  return derivedFloat(careerSeed, streams.gen("negRoll", `${playerId}:${seasonIndex}:${windowKey}`));
}

/**
 * ECO-11 (with ECO-10), rc.35 (front N): the ONE answer to a contract offer.
 * His ask is a weekly wage at the share and signing bonus he asks. Three
 * levers trade against each other in weekly money: each share point over his
 * ask lowers the wage he needs by one point's weekly money
 * (`sharePointWeeklyFor`), each $1 of bonus over his ask by
 * bonusWeight / (contract weeks); under his ask they raise it. The zone runs
 * from his floor (his flexibility × his ask, at least minZoneSteps presses,
 * minus the length relief: lengthReliefPerSeason of his ask a season past
 * the first) to his ask (the top; paying more buys nothing). Inside the zone
 * he signs; under the floor his odds fall smoothly to 0 over oddsFallPct of
 * his ask (`talkOddsFor`) and he signs when they beat `roll` (seeded per
 * window; omitted = 1, he never signs under the floor). When he refuses he
 * counters with his floor at the same share and bonus. Monotone in every
 * lever, deterministic, one round.
 */
export function negotiationAnswerFor(input: {
  ask: { wagePerSplit: number; sharePct: number; bonus?: number };
  flex: number;
  offer?: ContractOffer;
  /** The least a contract may pay per split (CAREER_SALARY.minSalary, indexed). */
  minWagePerSplit?: number;
  /** rc.35: the contract length in seasons (1 when omitted). */
  lengthSeasons?: number;
  /** rc.35: this window's roll (`negotiationRollFor`); omitted = 1 (never signs under the floor). */
  roll?: number;
}): NegotiationAnswer {
  const S = CAREER_PRIZE_SHARE;
  const N = CAREER_NEGOTIATION;
  const q = CAREER_PAYROLL.weeklyQuantum;
  const bq = CAREER_ECONOMY.roundQuantum;
  const len = Math.max(1, Math.round(input.lengthSeasons ?? 1));
  const askShare = Math.max(0, Math.round(input.ask.sharePct));
  const askWage = input.ask.wagePerSplit;
  const askBonus = Math.max(0, input.ask.bonus ?? 0);
  const askWeekly = weeklyWage(askWage);
  const minWage = Math.min(askWage, Math.max(0, input.minWagePerSplit ?? 0));
  const minWeekly = Math.min(askWeekly, weeklyAtLeast(minWage));
  const pointWeekly = sharePointWeeklyFor(askWeekly);
  const stepWeekly = wageStepWeeklyFor(askWeekly);

  // The zone's width at his own share and bonus: flexibility, at least minZoneSteps presses, plus the length relief.
  const flexGap = Math.floor(((1 - input.flex) * askWeekly) / q + 1e-9) * q;
  const lengthReliefWeekly = Math.floor((askWeekly * N.lengthReliefPerSeason * (len - 1)) / q + 1e-9) * q;
  const gapWeekly = clamp(Math.max(flexGap, N.minZoneSteps * stepWeekly) + lengthReliefWeekly, 0, askWeekly - minWeekly);
  const floorAtAsk = askWeekly - gapWeekly;

  // The share lever (rc.35: also for a player who asks none).
  const shareLever = CAREER_PRIZES.playerShare.enabled;
  const roomAbove = Math.max(0, Math.floor((floorAtAsk - minWeekly) / pointWeekly));
  const mostAbove = Math.min(S.maxPct, askShare + S.maxAboveAsk);
  const shareMin = shareLever ? Math.min(askShare, Math.max(S.minPct, askShare - S.maxBelowAsk)) : askShare;
  const shareMax = shareLever ? Math.max(askShare, Math.min(mostAbove, askShare + roomAbove)) : askShare;
  const share = clamp(Math.round(input.offer?.sharePct ?? askShare), shareMin, shareMax);

  // The bonus lever: 0 … bonusMaxMult × the standard bonus (never under his own ask).
  const bonusMax = Math.max(askBonus, quantize(signingBonusFor(askWage) * N.bonusMaxMult));
  const bonusStep = Math.max(bq, quantize(bonusMax / N.bonusSteps));
  const bonus = clamp(Math.round((input.offer?.bonus ?? askBonus) / bq) * bq, 0, bonusMax);
  const bonusShift = ((bonus - askBonus) * N.bonusWeight) / (len * CAREER_PAYROLL.weeksPerSeason);

  // The zone at this share and bonus: both ends move by the same money, so its width holds.
  const shift = (share - askShare) * pointWeekly + bonusShift;
  const topRaw = Math.ceil((askWeekly - shift) / q - 1e-9) * q;
  const topWeekly = Math.max(minWeekly, topRaw);
  const atAsk = share === askShare && bonus === askBonus;
  const topPerSplit = atAsk ? askWage : perSplitForWeekly(topWeekly);
  const floorWeekly = clamp(Math.ceil((floorAtAsk - shift) / q - 1e-9) * q, minWeekly, topWeekly);
  const fall = Math.max(q, Math.round((askWeekly * N.oddsFallPct) / q) * q);
  const zeroWeekly = floorWeekly - fall;

  // The offer, on the weekly quantum: omitted = the top; between the minimum and the top.
  const rawWeekly = Math.floor((input.offer?.weekly ?? topWeekly) / q + 1e-9) * q;
  const offerWeekly = clamp(rawWeekly, minWeekly, topWeekly);
  const termsAt = (weekly: number): ContractTerms => {
    const wagePerSplit = weekly >= topWeekly ? topPerSplit : perSplitForWeekly(weekly);
    return { wagePerSplit, weekly: weeklyWage(wagePerSplit), sharePct: share, bonus };
  };
  const odds = talkOddsFor(floorWeekly - offerWeekly, fall);
  const roll = input.roll ?? 1;
  const accepted = odds >= 1 || odds > roll;
  const counter = accepted ? null : termsAt(floorWeekly);
  const terms = accepted ? termsAt(offerWeekly) : counter!;
  const limits: TalkLimits = {
    wageDown: offerWeekly > minWeekly ? null : "minimum",
    wageUp: offerWeekly < topWeekly ? null : "ask",
    shareDown: share > shareMin ? null : share <= 0 ? "none" : "least",
    // A share point or a bonus step that would push the wage under the league minimum buys nothing: closed.
    shareUp:
      share >= shareMax ? (shareMax < mostAbove ? "minimum" : "most") : offerWeekly - pointWeekly < minWeekly ? "minimum" : null,
    bonusDown: bonus > 0 ? null : "none",
    bonusUp: bonus >= bonusMax ? "most" : offerWeekly <= minWeekly ? "minimum" : null,
  };
  return {
    ask: { wagePerSplit: askWage, weekly: askWeekly, sharePct: askShare, bonus: askBonus },
    offer: { weekly: offerWeekly, sharePct: share, bonus },
    zone: {
      shareMin,
      shareMax,
      shareLever,
      pointWeekly,
      topPerSplit,
      topWeekly,
      floorWeekly,
      zeroWeekly,
      stepWeekly,
      minWeekly,
      bonusMax,
      bonusStep,
      lengthReliefWeekly,
    },
    limits,
    odds,
    accepted,
    terms,
    counter,
    savingWeekly: askWeekly - terms.weekly,
    flex: input.flex,
    lengthSeasons: len,
  };
}

/** rc.34 (front I) / rc.35 (front N): the three levers of the talk. */
export type TalkLever = "wage" | "share" | "bonus";

/**
 * rc.34 (front I), rc.35 (front N): the offer one press of a lever makes —
 * the wage by one stepper press (between the minimum and his ask; rc.35: it
 * may go under his floor), the share by one point and the bonus by one step
 * with the wage moved the other way by what that lever is worth, so the
 * offer keeps its place against the zone. Null when that way is closed
 * (`answer.limits` says why).
 */
export function talkPressFor(answer: NegotiationAnswer, lever: TalkLever, dir: 1 | -1): ContractOffer | null {
  const { zone, offer, limits } = answer;
  if (lever === "wage") {
    if (dir < 0) {
      return limits.wageDown ? null : { ...offer, weekly: Math.max(zone.minWeekly, offer.weekly - zone.stepWeekly) };
    }
    return limits.wageUp ? null : { ...offer, weekly: Math.min(zone.topWeekly, offer.weekly + zone.stepWeekly) };
  }
  if (lever === "share") {
    if (!zone.shareLever) return null;
    if (dir < 0) return limits.shareDown ? null : { ...offer, weekly: offer.weekly + zone.pointWeekly, sharePct: offer.sharePct - 1 };
    return limits.shareUp ? null : { ...offer, weekly: Math.max(0, offer.weekly - zone.pointWeekly), sharePct: offer.sharePct + 1 };
  }
  const nextBonus = clamp(offer.bonus + dir * zone.bonusStep, 0, zone.bonusMax);
  if ((dir < 0 && limits.bonusDown) || (dir > 0 && limits.bonusUp)) return null;
  const perDollar = CAREER_NEGOTIATION.bonusWeight / (answer.lengthSeasons * CAREER_PAYROLL.weeksPerSeason);
  const q = CAREER_PAYROLL.weeklyQuantum;
  const wageMove = Math.round(((nextBonus - offer.bonus) * perDollar) / q) * q;
  return { ...offer, bonus: nextBonus, weekly: Math.max(0, offer.weekly - wageMove) };
}

/**
 * rc.35 (front N): the offer a slider makes when it sets one lever to
 * `value` — the wage as is (on the weekly quantum); the share or the bonus
 * with the wage moved the other way by what the change is worth, so the
 * offer keeps its place against the zone (several presses of `talkPressFor`
 * at once). The engine clamps whatever comes back.
 */
export function talkSetFor(answer: NegotiationAnswer, lever: TalkLever, value: number): ContractOffer {
  const { offer, zone } = answer;
  const q = CAREER_PAYROLL.weeklyQuantum;
  if (lever === "wage") return { ...offer, weekly: Math.round(value / q) * q };
  if (lever === "share") {
    const share = clamp(Math.round(value), zone.shareMin, zone.shareMax);
    return { ...offer, sharePct: share, weekly: Math.max(0, offer.weekly - (share - offer.sharePct) * zone.pointWeekly) };
  }
  const bonus = clamp(Math.round(value / CAREER_ECONOMY.roundQuantum) * CAREER_ECONOMY.roundQuantum, 0, zone.bonusMax);
  const perDollar = CAREER_NEGOTIATION.bonusWeight / (answer.lengthSeasons * CAREER_PAYROLL.weeksPerSeason);
  const wageMove = Math.round(((bonus - offer.bonus) * perDollar) / q) * q;
  return { ...offer, bonus, weekly: Math.max(0, offer.weekly - wageMove) };
}

/** The smallest weekly wage (whole quanta) whose contract (`perSplitForWeekly`) pays at least `perSplit`. */
function weeklyAtLeast(perSplit: number): number {
  const q = CAREER_PAYROLL.weeklyQuantum;
  let w = Math.max(q, Math.floor((perSplit * CAREER_PAYROLL.splitsPerSeason) / CAREER_PAYROLL.weeksPerSeason / q) * q);
  while (perSplitForWeekly(w) < perSplit - 1e-6) w += q;
  return w;
}
