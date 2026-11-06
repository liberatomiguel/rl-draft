/**
 * Road to Worlds — rc.37 F2 package 3: the emergency sale.
 *
 * While the balance is below CAREER_EMERGENCY_SALE.balanceBelow (cash
 * negative), AI orgs table EXTRA offers for a squad player at a discount —
 * `feeRange` × his market value (economy.marketValueFor, called as it
 * stands) — on any day of a transfer window (Miguel, 05/11: windows only).
 * At most one is pending at a time, the next arrives `cooldownDays` after the
 * last at the earliest, and each stays open `validDays`, never past its
 * window's close. Never while the user's event is
 * in progress (the squad is frozen; acceptBidFlow refuses a sale then too).
 * The normal window bids (market.incomingBidForDay) roll as before, and an
 * emergency offer is a plain out-offer flagged `emergency`: the Market's
 * deals tab, the HQ decision and acceptBidFlow treat it like any bid, and
 * the sale books through the same applyTransferIncome (the emergency loan's
 * share included).
 *
 * The resale lock is the caller's `isLocked` predicate — the ONE connection
 * point to rc.37 F1's lock: the flow passes `market.resaleLocked(p,
 * seasonIndex, day)` once F1 lands (rc.35's window lock before it).
 *
 * Pure and deterministic: every roll is a derivedFloat of the career seed
 * and the day (`gen:emergency*:season:day`) — no Rng cursor is consumed.
 */

import { CAREER_EMERGENCY_SALE } from "@/config/balance";
import { DAYS_PER_SEASON, weekOfDay, windowCloseDayFor, windowIndexOf } from "./calendar";
import { ageOf, deriveBirthYear } from "./development";
import { marketValueFor, quantize } from "./economy";
import { derivedFloat, streams } from "./seeds";
import type { SquadPlayer, TransferOffer, WorldState } from "./types";

/** A day on the career clock (the season index and its day, 1–DAYS_PER_SEASON). */
export interface ClockDay {
  seasonIndex: number;
  day: number;
}

/** Days from `from` to `to` on the career clock (negative when `to` is earlier). */
export function daysBetween(from: ClockDay, to: ClockDay): number {
  return (to.seasonIndex - from.seasonIndex) * DAYS_PER_SEASON + (to.day - from.day);
}

/** Is the emergency sale open on this balance (CAREER_EMERGENCY_SALE: enabled, cash below `balanceBelow`)? */
export function emergencySaleOpen(balance: number): boolean {
  return CAREER_EMERGENCY_SALE.enabled && balance < CAREER_EMERGENCY_SALE.balanceBelow;
}

/** An emergency offer's fee: `f` (0–1) places it inside CAREER_EMERGENCY_SALE.feeRange × the value, quantized. */
export function emergencyFeeFor(value: number, f: number): number {
  const [lo, hi] = CAREER_EMERGENCY_SALE.feeRange;
  return quantize(value * (lo + (hi - lo) * Math.min(1, Math.max(0, f))));
}

/** The market value an emergency offer is priced on (economy.marketValueFor, the inputs the window bids use). */
export function emergencyValueOf(p: SquadPlayer, seasonIndex: number, careerSeed: number): number {
  return marketValueFor({
    overall: p.overall,
    age: ageOf(p.birthYear ?? deriveBirthYear(p.id, careerSeed), seasonIndex),
    potential: p.potential,
    seasonIndex,
  });
}

export interface EmergencyOfferContext {
  world: WorldState;
  squad: SquadPlayer[];
  seasonIndex: number;
  day: number;
  careerSeed: number;
  balance: number;
  /** The user's event is in progress (save.activeEvent): no offer. */
  inEvent: boolean;
  /** The save's pending offers — none doubles up on a player, and one emergency offer at a time. */
  pending: readonly Pick<TransferOffer, "playerId" | "direction" | "status" | "emergency">[];
  /** The day the last emergency offer arrived (FinanceState.emergencySaleAt; null = never). */
  lastOffer: ClockDay | null;
  /** The resale lock (rc.37 F1's market.resaleLocked once integrated): a locked player gets no offer. */
  isLocked: (p: SquadPlayer) => boolean;
}

/**
 * Today's emergency offer, or null: cash below the threshold, no event in
 * progress, none pending, the cooldown over, the day's roll
 * (`dailyChance`). The target is weighted by market value (a buyer in a
 * hurry shops the squad's worth, and the larger fee is the one that helps);
 * the buyer is an org of his region that does not hold him, as for the
 * window bids.
 */
export function emergencyOfferForDay(ctx: EmergencyOfferContext): TransferOffer | null {
  const E = CAREER_EMERGENCY_SALE;
  if (!emergencySaleOpen(ctx.balance) || ctx.inEvent || ctx.squad.length === 0) return null;
  // Miguel (05/11): only inside a transfer window; it lapses when the window closes at the latest.
  const windowIdx = windowIndexOf(weekOfDay(ctx.day));
  if (windowIdx === null) return null;
  const pendingOut = ctx.pending.filter((o) => o.status === "pending" && o.direction === "out");
  if (pendingOut.some((o) => o.emergency)) return null;
  const today: ClockDay = { seasonIndex: ctx.seasonIndex, day: ctx.day };
  if (ctx.lastOffer && daysBetween(ctx.lastOffer, today) < E.cooldownDays) return null;
  const key = `${ctx.seasonIndex}:${ctx.day}`;
  if (derivedFloat(ctx.careerSeed, streams.gen("emergencyDay", key)) >= E.dailyChance) return null;

  const busy = new Set(pendingOut.map((o) => o.playerId));
  const pool = ctx.squad
    .filter((p) => !busy.has(p.id) && !ctx.isLocked(p))
    .map((p) => ({ p, value: emergencyValueOf(p, ctx.seasonIndex, ctx.careerSeed) }))
    .filter((r) => r.value > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, r) => s + r.value, 0);
  let cursor = derivedFloat(ctx.careerSeed, streams.gen("emergencyTarget", key)) * total;
  let target = pool[pool.length - 1];
  for (const r of pool) {
    cursor -= r.value;
    if (cursor <= 0) {
      target = r;
      break;
    }
  }

  const bidders = Object.values(ctx.world.orgs).filter(
    (o) => o.region === target.p.region && o.prestige >= 1 && !o.playerIds.includes(target.p.id),
  );
  if (bidders.length === 0) return null;
  const pick = Math.floor(derivedFloat(ctx.careerSeed, streams.gen("emergencyOrg", key)) * bidders.length);
  const bidder = bidders[Math.min(pick, bidders.length - 1)];
  const fee = emergencyFeeFor(target.value, derivedFloat(ctx.careerSeed, streams.gen("emergencyFee", key)));
  if (fee <= 0) return null;

  return {
    id: `emergency:${ctx.seasonIndex}:${ctx.day}:${target.p.id}`,
    direction: "out",
    playerId: target.p.id,
    playerName: target.p.name,
    fee,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: bidder.ref,
    status: "pending",
    resolveSeason: ctx.seasonIndex,
    resolveDay: Math.min(DAYS_PER_SEASON, windowCloseDayFor(windowIdx), ctx.day + E.validDays),
    factors: [],
    emergency: true,
    valuePct: Math.round((fee / target.value) * 100),
  };
}
