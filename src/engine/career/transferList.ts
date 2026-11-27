/**
 * R135 (ECO-06): the user's transfer list and player-for-player
 * trades, the pure engine side. A listed player is answered after a derived
 * delay by one AI org; a trade is answered by the org that holds the target.
 * Every tunable is CAREER_TRANSFER.listing / .trade. Streams are NEW names, so
 * no shipped stream shifts. The store drives the clock; nothing here reads it.
 */

import { CAREER_ECONOMY, CAREER_TRANSFER } from "@/config/balance";
import { DAYS_PER_SEASON, weekOfDay, windowCloseDayFor, windowIndexOf } from "./calendar";
import { growthModelOf, playerViewById } from "./development";
import { marketValueFor, quantize } from "./economy";
import { bidPremiumFor, resaleLocked, userBidsBlocked, valueInputOf } from "./market";
import { derivedFloat, streams } from "./seeds";
import type { ListedPlayer, SquadPlayer, TransferOffer, WorldState } from "./types";

type WindowIdx = 0 | 1 | 2 | 3;

export type ListingBlock =
  | "disabled"
  | "windowClosed"
  | "firstWindow"
  | "windowClosing"
  | "resaleLocked"
  | "listFull"
  | "alreadyListed";

/** Why this player cannot be listed today, or null. Pure reads only. */
export function listingBlockFor(ctx: {
  player: { id: string; joinedSeason: number; signedDay?: number };
  listed: readonly { playerId: string }[];
  seasonIndex: number;
  /** v2.2 ORGMODE-2027: the save's start era (absent = 0). */
  startSeasonIndex?: number;
  day: number;
}): ListingBlock | null {
  const L = CAREER_TRANSFER.listing;
  if (!L.enabled) return "disabled";
  const windowIdx = windowIndexOf(weekOfDay(ctx.day));
  if (windowIdx === null) return "windowClosed";
  if (userBidsBlocked(ctx.seasonIndex, windowIdx, ctx.startSeasonIndex)) return "firstWindow";
  // An answer needs at least one more window day.
  if (ctx.day >= windowCloseDayFor(windowIdx)) return "windowClosing";
  if (resaleLocked(ctx.player, ctx.seasonIndex, ctx.day)) return "resaleLocked";
  if (ctx.listed.some((l) => l.playerId === ctx.player.id)) return "alreadyListed";
  if (ctx.listed.length >= L.maxListed) return "listFull";
  return null;
}

/** Rounds up to the quantize step (quantize truncates), so a countered sum always covers a gap. */
function quantizeUp(n: number): number {
  const q = quantize(n);
  return q < n ? q + CAREER_ECONOMY.roundQuantum : q;
}

/** A draw in [lo, hi] from one derived stream. */
function draw(careerSeed: number, what: string, key: string, range: readonly [number, number]): number {
  return range[0] + (range[1] - range[0]) * derivedFloat(careerSeed, streams.gen(what, key));
}

/** The answer day: day + an integer delay in the (inclusive) range, never past the close day. */
function answerDayIn(
  careerSeed: number,
  what: string,
  key: string,
  range: readonly [number, number],
  day: number,
  windowIdx: WindowIdx,
): number {
  const [lo, hi] = range;
  const delay = Math.min(hi, lo + Math.floor(derivedFloat(careerSeed, streams.gen(what, key)) * (hi - lo + 1)));
  return Math.min(day + delay, Math.max(day, windowCloseDayFor(windowIdx)));
}

/** The ask bounds for a market value, quantized; min <= max always. */
export function listingAskBounds(value: number): { min: number; max: number } {
  const [lo, hi] = CAREER_TRANSFER.listing.askRange;
  const min = quantize(value * lo);
  return { min, max: Math.max(min, quantize(value * hi)) };
}

/** An ask forced inside the bounds and quantized. */
export function clampListingAsk(value: number, ask: number): number {
  const { min, max } = listingAskBounds(value);
  return Math.min(max, Math.max(min, quantize(ask)));
}

type ValueCtx = { careerSeed: number; seasonIndex: number; growthModel?: number };

/** The player's market value as every fee reads it. */
export function listingValueOf(player: SquadPlayer, ctx: ValueCtx): number {
  return marketValueFor(valueInputOf(player, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel));
}

/**
 * True while he arrived less than listing.shortTenureSeasons ago: a buyer (and
 * a trade partner) discounts him, so a free agent signed for no fee is never
 * sold on at his full value a few weeks later. A founder is never discounted.
 */
export function shortTenure(
  player: { joinedSeason: number; signedDay?: number },
  seasonIndex: number,
  day: number,
): boolean {
  if (player.signedDay === undefined) return false;
  const days = (seasonIndex - player.joinedSeason) * DAYS_PER_SEASON + (day - player.signedDay);
  return days < CAREER_TRANSFER.listing.shortTenureSeasons * DAYS_PER_SEASON;
}

/**
 * True while a player the user sold or traded away cannot sign for him again
 * (CAREER_TRANSFER.buyBackLockSeasons from the day he left).
 */
export function buyBackLocked(
  left: { seasonIndex: number; day: number } | undefined,
  seasonIndex: number,
  day: number,
): boolean {
  if (!left) return false;
  const days = (seasonIndex - left.seasonIndex) * DAYS_PER_SEASON + (day - left.day);
  return days < CAREER_TRANSFER.buyBackLockSeasons * DAYS_PER_SEASON;
}

type TenureCtx = ValueCtx & { day: number };

/** What he is worth to another org today: market value, `share` of the youth premium, and the short-tenure discount. */
function premiumValue(player: SquadPlayer, ctx: TenureCtx, share: number): number {
  const input = valueInputOf(player, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel);
  const tenure = shortTenure(player, ctx.seasonIndex, ctx.day) ? CAREER_TRANSFER.listing.shortTenureShare : 1;
  return marketValueFor(input) * (1 + share * (bidPremiumFor(input) - 1)) * tenure;
}

/** The day the market answers a listing made on `day`. */
export function listingAnswerDayFor(ctx: {
  careerSeed: number;
  seasonIndex: number;
  day: number;
  windowIdx: WindowIdx;
  playerId: string;
}): number {
  return answerDayIn(
    ctx.careerSeed,
    "listAnswerDay",
    `${ctx.seasonIndex}:${ctx.day}:${ctx.playerId}`,
    CAREER_TRANSFER.listing.answerDays,
    ctx.day,
    ctx.windowIdx,
  );
}

/** The most a buyer pays for him in this window (one draw per window, not per day; `day` reads his tenure only). */
export function listingCeilingFor(ctx: {
  player: SquadPlayer;
  careerSeed: number;
  seasonIndex: number;
  windowIdx: number;
  day: number;
  growthModel?: number;
}): number {
  const L = CAREER_TRANSFER.listing;
  const m = draw(ctx.careerSeed, "listCeiling", `${ctx.seasonIndex}:${ctx.windowIdx}:${ctx.player.id}`, L.buyerRange);
  return quantize(premiumValue(ctx.player, ctx, L.premiumShare) * m);
}

/** The org that answers: one of his region that would field him, else the funded org he is closest to; null when the region has neither. */
export function listingBuyerFor(ctx: {
  world: WorldState;
  player: SquadPlayer;
  careerSeed: number;
  seasonIndex: number;
  windowIdx: number;
}): string | null {
  const viewCtx = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world: ctx.world };
  const orgs = Object.values(ctx.world.orgs)
    .filter((o) => o.region === ctx.player.region && !o.playerIds.includes(ctx.player.id))
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .map((o) => {
      const overalls = o.playerIds
        .map((id) => playerViewById(id, viewCtx)?.overall)
        .filter((v): v is number => v !== undefined);
      // Fewer than three known players: he always fills a seat.
      const short = overalls.length < 3;
      return {
        ref: o.ref,
        prestige: o.prestige,
        weakest: short ? -Infinity : Math.min(...overalls),
        best: short ? Infinity : Math.max(...overalls),
      };
    });
  // An org that would field him. One without a wallet (prestige 0) only buys a
  // player inside its own level, never a star above its best.
  let candidates = orgs.filter(
    (o) => ctx.player.overall > o.weakest && (o.prestige >= 1 || ctx.player.overall <= o.best),
  );
  if (candidates.length === 0) {
    // Nobody would start him: the org with a wallet he is closest to takes him
    // as depth (the same orgs an unsolicited bid comes from, which never
    // checks the fit). The price is his value, so a weak player sells cheap.
    const funded = orgs.filter((o) => o.prestige >= 1);
    const closest = Math.min(...funded.map((o) => o.weakest));
    candidates = funded.filter((o) => o.weakest === closest);
  }
  if (candidates.length === 0) return null;
  const r = derivedFloat(
    ctx.careerSeed,
    streams.gen("listBuyer", `${ctx.seasonIndex}:${ctx.windowIdx}:${ctx.player.id}`),
  );
  return candidates[Math.min(Math.floor(r * candidates.length), candidates.length - 1)].ref;
}

export type ListingAnswer =
  | { kind: "offer"; offer: TransferOffer }
  | { kind: "counter"; offer: TransferOffer }
  | { kind: "noTakers"; reason: "noBuyer" | "price" };

/** The market's answer on the listing's answer day. */
export function listingAnswerFor(ctx: {
  world: WorldState;
  player: SquadPlayer;
  listing: ListedPlayer;
  careerSeed: number;
  seasonIndex: number;
  windowIdx: WindowIdx;
  day: number;
}): ListingAnswer {
  const { player, listing } = ctx;
  const buyerRef = listingBuyerFor(ctx);
  if (buyerRef === null) return { kind: "noTakers", reason: "noBuyer" };
  const growthModel = growthModelOf(ctx.world);
  const ceiling = listingCeilingFor({ ...ctx, growthModel });
  const reach = CAREER_TRANSFER.listing.counterReach;
  const counter = listing.ask > ceiling;
  if (counter && listing.ask > ceiling * (1 + reach)) return { kind: "noTakers", reason: "price" };
  const fee = counter ? ceiling : listing.ask;
  const value = listingValueOf(player, { ...ctx, growthModel });
  const offer: TransferOffer = {
    id: `list:${ctx.seasonIndex}:${ctx.day}:${player.id}`,
    direction: "out",
    playerId: player.id,
    playerName: player.name,
    fee,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: buyerRef,
    status: "pending",
    resolveSeason: ctx.seasonIndex,
    resolveDay: windowCloseDayFor(ctx.windowIdx),
    factors: [],
    listed: true,
    ask: listing.ask,
    valuePct: value > 0 ? Math.round((fee / value) * 100) : 0,
  };
  return { kind: counter ? "counter" : "offer", offer };
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

/** The day the org answers a trade proposed on `day`. */
export function tradeAnswerDayFor(ctx: {
  careerSeed: number;
  seasonIndex: number;
  day: number;
  windowIdx: WindowIdx;
  giveId: string;
  takeId: string;
}): number {
  return answerDayIn(
    ctx.careerSeed,
    "tradeAnswerDay",
    `${ctx.seasonIndex}:${ctx.day}:${ctx.giveId}:${ctx.takeId}`,
    CAREER_TRANSFER.trade.answerDays,
    ctx.day,
    ctx.windowIdx,
  );
}

/** What the org credits for the user's player (one draw per pair and window). */
export function tradeCreditFor(ctx: {
  player: SquadPlayer;
  takeId: string;
  careerSeed: number;
  seasonIndex: number;
  windowIdx: number;
  day: number;
  growthModel?: number;
}): number {
  const T = CAREER_TRANSFER.trade;
  const m = draw(
    ctx.careerSeed,
    "tradeCredit",
    `${ctx.seasonIndex}:${ctx.windowIdx}:${ctx.player.id}:${ctx.takeId}`,
    T.creditRange,
  );
  return quantize(premiumValue(ctx.player, ctx, T.premiumShare) * m);
}

export type TradeVerdict =
  | { kind: "accept" }
  | { kind: "counter"; cash: number }
  | { kind: "reject"; reason: "fit" | "value" };

/** The shared arithmetic of the verdict and the outlook. */
function tradeGap(c: {
  credit: number;
  fee: number;
  cash: number;
  giveOverall: number;
  takeOverall: number;
}): "fit" | { shortfall: number; withinCounter: boolean } {
  const T = CAREER_TRANSFER.trade;
  if (c.giveOverall < c.takeOverall - T.maxDowngrade) return "fit";
  const shortfall = c.fee - c.credit - c.cash;
  return { shortfall, withinCounter: shortfall <= c.fee * T.counterMaxShare };
}

/** The org's answer. Pure arithmetic, no RNG (the draw is in `credit`). */
export function tradeVerdictFor(ctx: {
  credit: number;
  fee: number;
  cash: number;
  giveOverall: number;
  takeOverall: number;
}): TradeVerdict {
  const gap = tradeGap(ctx);
  if (gap === "fit") return { kind: "reject", reason: "fit" };
  if (gap.shortfall <= 0) return { kind: "accept" };
  if (!gap.withinCounter) return { kind: "reject", reason: "value" };
  return { kind: "counter", cash: quantizeUp(ctx.cash + gap.shortfall) };
}

/** The hint a sheet shows before proposing: the credit read at the middle of the band, no draw. */
export function tradeOutlookFor(ctx: {
  player: SquadPlayer;
  fee: number;
  cash: number;
  takeOverall: number;
  careerSeed: number;
  seasonIndex: number;
  day: number;
  growthModel?: number;
}): "likely" | "close" | "unlikely" | "noFit" {
  const T = CAREER_TRANSFER.trade;
  const mid = (T.creditRange[0] + T.creditRange[1]) / 2;
  const credit = quantize(premiumValue(ctx.player, ctx, T.premiumShare) * mid);
  const gap = tradeGap({ credit, fee: ctx.fee, cash: ctx.cash, giveOverall: ctx.player.overall, takeOverall: ctx.takeOverall });
  if (gap === "fit") return "noFit";
  if (gap.shortfall <= 0) return "likely";
  return gap.withinCounter ? "close" : "unlikely";
}
