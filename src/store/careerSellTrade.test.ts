/**
 * Road to Worlds — R134 (ECO-06): the transfer list and player-for-player
 * trades, through the store flows. The pure arithmetic is in
 * engine/career/transferList.test.ts; here the flows move saves: listing,
 * the market's answer, accepting / declining, the window's close, the trade's
 * verdicts and its atomic completion, persistence and the anti-flip anchor.
 *
 * Outcomes never lean on a seed's luck: each case reads the engine's own
 * numbers for the save in hand (ceiling, buyer, credit, fee) and picks the ask
 * or the cash relative to them.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CONTRACT, CAREER_TRANSFER } from "@/config/balance";
import { firstDayOfWeek, weekOfDay, windowCloseDayFor, windowIndexOf } from "@/engine/career/calendar";
import { growthModelOf, playerViewById } from "@/engine/career/development";
import { marketValueFor, quantize, signableOverallCap } from "@/engine/career/economy";
import { bidPremiumFor, resaleLocked, valueInputOf } from "@/engine/career/market";
import {
  listingAskBounds,
  listingBuyerFor,
  listingCeilingFor,
  shortTenure,
  tradeCreditFor,
} from "@/engine/career/transferList";
import type { CareerPlayerView, CareerSave, SquadPlayer, TradeProposal, TransferOffer } from "@/engine/career/types";
import { clockHoldOf, pendingDecisionsOf } from "./careerDecisions";
import {
  acceptBidFlow,
  advanceDayFlow,
  backerLineOf,
  createCareerSave,
  declineBidFlow,
  delistPlayerFlow,
  listingPlanFor,
  listPlayerFlow,
  proposeTradeFlow,
  releasePlayerFlow,
  repairMoneyOnLoad,
  signingPlanFor,
  signPlayerFlow,
  tradeCashOf,
  tradePlanFor,
  tradeProposalsOf,
  transferListOf,
  type CreateCareerInput,
} from "./careerFlow";
import { stepDayForTests } from "./careerClockForTests";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Sell Org",
    abbrev: "SEL",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

/** Season 0's second window (weeks 11-12): open to listings and trades. */
const WINDOW_IDX = 1 as const;
const W_START = firstDayOfWeek(11);
const W_CLOSE = windowCloseDayFor(WINDOW_IDX);
const OUTSIDE_DAY = firstDayOfWeek(15);

/** A career parked on a window day with money and reputation to spare and no chores in the way. */
function windowSave(seed: number, day = W_START): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 2_000_000;
  save.reputation = 100;
  save.clock.day = day;
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= 32; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

/** Through the real clock to `day` (the walk answers what the old walk did). */
function advanceTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && guard++ < 40) {
    const next = stepDayForTests(save);
    if (next.clock.day === save.clock.day) {
      throw new Error(`clock blocked on day ${save.clock.day}: ${JSON.stringify(clockHoldOf(save))}`);
    }
    save = next;
  }
  expect(save.clock.day).toBe(day);
  return save;
}

const ctxOf = (save: CareerSave) => ({ careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world });
const squadOf = (save: CareerSave, id: string): SquadPlayer => save.squad.find((p) => p.id === id)!;
// A story reaches the feed or the inbox by channel (communications.newsChannelOf): read both.
const newsKeys = (save: CareerSave) => [...save.news.map((n) => n.titleKey), ...save.mail.map((m) => m.titleKey)];
const mailKeys = (save: CareerSave) => save.mail.map((m) => m.titleKey);
const count = (list: string[], key: string) => list.filter((k) => k === key).length;
const listedOffers = (save: CareerSave) => save.pendingOffers.filter((o) => o.listed);

function ceilingOf(save: CareerSave, p: SquadPlayer, windowIdx: number = WINDOW_IDX): number {
  return listingCeilingFor({
    player: p,
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    windowIdx,
    day: save.clock.day,
    growthModel: growthModelOf(save.world),
  });
}

function buyerOf(save: CareerSave, p: SquadPlayer, windowIdx: number = WINDOW_IDX): string | null {
  return listingBuyerFor({
    world: save.world,
    player: p,
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    windowIdx,
  });
}

function listOk(save: CareerSave, playerId: string, ask: number): CareerSave {
  const res = listPlayerFlow(save, playerId, ask);
  expect(res.error).toBeUndefined();
  return res.save;
}

/** The money and the slots a refused operation must leave exactly as they were. */
const snapshot = (save: CareerSave) =>
  JSON.stringify({
    balance: save.finances.balance,
    ledger: save.finances.ledger,
    squad: save.squad,
    starterIds: save.starterIds,
    freeAgents: save.world.freeAgentIds,
    orgs: save.world.orgs,
    transferList: save.transferList,
    tradeProposals: save.tradeProposals,
    pendingOffers: save.pendingOffers,
  });

// ---------------------------------------------------------------------------
// Scenarios: a save, a player and an ask whose answer is known in advance
// ---------------------------------------------------------------------------

type ListKind = "ok" | "counter" | "dear";
interface ListScenario {
  save: CareerSave;
  playerId: string;
  ask: number;
  ceiling: number;
}

const listCache = new Map<ListKind, ListScenario>();

/** `ok`: an ask well under the ceiling. `counter`: 12% over it (inside the reach). `dear`: the top of the slider, past the reach. */
function listScenario(kind: ListKind): ListScenario {
  const cached = listCache.get(kind);
  if (cached) return cached;
  const reach = CAREER_TRANSFER.listing.counterReach;
  for (let seed = 101; seed < 301; seed++) {
    const save = windowSave(seed);
    for (const p of save.squad) {
      if (buyerOf(save, p) === null) continue;
      const plan = listingPlanFor(save, p.id)!;
      if (plan.error) continue;
      const ceiling = ceilingOf(save, p);
      let ask: number | null = null;
      if (kind === "ok") {
        const a = quantize(Math.min(ceiling * 0.9, plan.max));
        if (a >= plan.min) ask = a;
      } else if (kind === "counter") {
        const a = quantize(ceiling * 1.12);
        if (a > ceiling * 1.05 && a <= plan.max) ask = a;
      } else if (plan.max > ceiling * (1 + reach) * 1.08) {
        ask = plan.max;
      }
      if (ask === null) continue;
      const found = { save, playerId: p.id, ask, ceiling };
      listCache.set(kind, found);
      return found;
    }
  }
  throw new Error(`no ${kind} listing scenario in 200 seeds`);
}

interface Pair {
  giveId: string;
  takeId: string;
  fee: number;
  credit: number;
  giveOverall: number;
  takeOverall: number;
}

/** Same-region (give, take) pairs the signing gates let through, by overall proximity. */
function tradePairs(save: CareerSave, perGive = 18): Pair[] {
  const ctx = ctxOf(save);
  const growthModel = growthModelOf(save.world);
  const out: Pair[] = [];
  for (const give of save.squad) {
    const takes: CareerPlayerView[] = [];
    for (const org of Object.values(save.world.orgs)) {
      if (org.region !== give.region) continue;
      for (const id of org.playerIds) {
        const v = playerViewById(id, ctx);
        if (v) takes.push(v);
      }
    }
    takes.sort((a, b) => Math.abs(a.overall - give.overall) - Math.abs(b.overall - give.overall) || a.id.localeCompare(b.id));
    for (const take of takes.slice(0, perGive)) {
      const planned = tradePlanFor(save, give.id, take.id, { lengthSeasons: 2, cash: 0 });
      if ("error" in planned) continue;
      out.push({
        giveId: give.id,
        takeId: take.id,
        fee: planned.plan.fee,
        credit: tradeCreditFor({
          player: give,
          takeId: take.id,
          careerSeed: save.careerSeed,
          seasonIndex: save.clock.seasonIndex,
          windowIdx: WINDOW_IDX,
          day: save.clock.day,
          growthModel,
        }),
        giveOverall: give.overall,
        takeOverall: take.overall,
      });
    }
  }
  return out;
}

type TradeKind = "agree" | "counter" | "value" | "fit";
interface TradeScenario {
  save: CareerSave;
  pair: Pair;
  cash: number;
}

const tradeCache = new Map<TradeKind, TradeScenario>();
const maxDown = () => CAREER_TRANSFER.trade.maxDowngrade;
const counterShare = () => CAREER_TRANSFER.trade.counterMaxShare;

/**
 * `agree`: credit + cash covers the fee with a 10% margin. `counter`: cash
 * short by 12% of the fee, a gap the org can counter. `value`: no cash and a
 * credit under 30% of the fee (past the counter share) with a fitting giver.
 * `fit`: a copy where the giver sits 11 overall under the target.
 */
function tradeScenario(kind: TradeKind): TradeScenario {
  const cached = tradeCache.get(kind);
  if (cached) return cached;
  for (let seed = 201; seed < 261; seed++) {
    const save = windowSave(seed);
    const pairs = tradePairs(save);
    const fits = pairs.filter((p) => p.giveOverall >= p.takeOverall - maxDown() + 1);
    let found: TradeScenario | null = null;
    if (kind === "agree") {
      const pair = fits[0];
      if (pair) found = { save, pair, cash: quantize(Math.max(0, pair.fee - pair.credit) + pair.fee * 0.1) };
    } else if (kind === "counter") {
      const pair = fits.find((p) => p.fee - p.credit >= 0.3 * p.fee && p.fee - p.credit <= counterShare() * p.fee * 0.9);
      if (pair) found = { save, pair, cash: quantize(pair.fee - pair.credit - pair.fee * 0.12) };
    } else if (kind === "value") {
      const pair = fits.find((p) => p.credit < 0.3 * p.fee);
      if (pair) found = { save, pair, cash: 0 };
    } else if (pairs[0]) {
      const pair = pairs[0];
      const copy = structuredClone(save);
      squadOf(copy, pair.giveId).overall = pair.takeOverall - maxDown() - 3;
      found = { save: copy, pair: { ...pair, giveOverall: pair.takeOverall - maxDown() - 3 }, cash: 0 };
    }
    if (found) {
      tradeCache.set(kind, found);
      return found;
    }
  }
  throw new Error(`no ${kind} trade scenario in 60 seeds`);
}

function propose(s: TradeScenario, cashOverride?: number): { save: CareerSave; proposal: TradeProposal } {
  const res = proposeTradeFlow(s.save, s.pair.giveId, s.pair.takeId, { lengthSeasons: 2, cash: cashOverride ?? s.cash });
  expect(res.error).toBeUndefined();
  return { save: res.save, proposal: tradeProposalsOf(res.save)[0] };
}

/** Proposes and advances to the org's answer day. */
function answered(s: TradeScenario, cashOverride?: number): { save: CareerSave; id: string; before: CareerSave } {
  const { save, proposal } = propose(s, cashOverride);
  const after = advanceTo(save, proposal.answerDay);
  return { save: after, id: proposal.id, before: save };
}

const statusOf = (save: CareerSave, id: string) => tradeProposalsOf(save).find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

describe("R134 listing — the rules of the list", () => {
  it("is closed in the career's first window (listFirstWindow) and outside any window (windowClosed)", () => {
    const first = createCareerSave(INPUT, 7);
    expect(windowIndexOf(weekOfDay(first.clock.day))).toBe(0);
    expect(listPlayerFlow(first, first.squad[0].id, 10_000).error).toBe("listFirstWindow");
    expect(listingPlanFor(first, first.squad[0].id)?.error).toBe("listFirstWindow");

    const outside = windowSave(7, OUTSIDE_DAY);
    expect(windowIndexOf(weekOfDay(outside.clock.day))).toBeNull();
    expect(listPlayerFlow(outside, outside.squad[0].id, 10_000).error).toBe("windowClosed");
    expect(listPlayerFlow(windowSave(7), "nobody", 10_000).error).toBe("unknown");
  });

  it("the window's closing day takes no new listing (listWindowClosing)", () => {
    const save = windowSave(7, W_CLOSE);
    expect(listPlayerFlow(save, save.squad[0].id, 10_000).error).toBe("listWindowClosing");
  });

  it("adds a waiting entry answered within answerDays; the ask is clamped into [min, max]; a third listing is refused; the flow never mutates its input", () => {
    const input = windowSave(7);
    const before = JSON.stringify(input);
    const [a, b, c] = input.squad;
    const planA = listingPlanFor(input, a.id)!;
    expect(planA.error).toBeNull();
    expect(planA).toMatchObject(listingAskBounds(planA.value));

    // Far under the floor clamps up to min; far over the top clamps down to max.
    let save = listOk(input, a.id, 1);
    save = listOk(save, b.id, 100_000_000);
    expect(JSON.stringify(input)).toBe(before);
    const list = transferListOf(save);
    expect(list).toHaveLength(2);
    const entryA = list.find((l) => l.playerId === a.id)!;
    const entryB = list.find((l) => l.playerId === b.id)!;
    expect(entryA.ask).toBe(planA.min);
    expect(entryB.ask).toBe(listingPlanFor(input, b.id)!.max);
    const [lo, hi] = CAREER_TRANSFER.listing.answerDays;
    for (const e of list) {
      expect(e.status).toBe("waiting");
      expect(e.answerDay).toBeGreaterThanOrEqual(W_START + lo);
      expect(e.answerDay).toBeLessThanOrEqual(Math.min(W_START + hi, W_CLOSE));
      expect(e.seasonIndex).toBe(0);
      expect(e.day).toBe(W_START);
    }
    expect(save.squad.map((p) => p.id)).toEqual(input.squad.map((p) => p.id)); // nothing moved
    expect(listPlayerFlow(save, c.id, planA.min).error).toBe("listFull");
    expect(CAREER_TRANSFER.listing.maxListed).toBe(2);
    // Re-pricing one of the two is not a third listing.
    const repriced = listPlayerFlow(save, a.id, planA.max);
    expect(repriced.error).toBeUndefined();
    expect(transferListOf(repriced.save)).toHaveLength(2);
    expect(transferListOf(repriced.save).find((l) => l.playerId === a.id)!.ask).toBe(planA.max);
  });
});

describe("R134 listing — the market's answer", () => {
  it("an ask at or under the ceiling: a listed offer paying the ask in full, with a mail and a news item", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const entry = transferListOf(listed)[0];
    const after = advanceTo(listed, entry.answerDay);

    const offers = listedOffers(after);
    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer).toMatchObject({ listed: true, direction: "out", playerId, fee: ask, ask, status: "pending" });
    expect(offer.otherRef).toBeTruthy();
    expect(after.world.orgs[offer.otherRef!]).toBeTruthy();
    expect(offer.resolveDay).toBe(W_CLOSE);
    expect(transferListOf(after)[0].status).toBe("offered");
    expect(newsKeys(after)).toContain("listingOffer");
    expect(mailKeys(after)).toContain("listingOffer");
    expect(count(mailKeys(after), "listingCounter")).toBe(0);
    expect(squadOf(after, playerId)).toBeTruthy(); // not sold until the user says yes
  });

  it("an ask a little over the ceiling (inside counterReach): the offer is the ceiling, below the ask", () => {
    const { save: base, playerId, ask } = listScenario("counter");
    const listed = listOk(base, playerId, ask);
    const after = advanceTo(listed, transferListOf(listed)[0].answerDay);
    const offer = listedOffers(after)[0];
    expect(offer).toBeTruthy();
    expect(offer.ask).toBe(ask);
    expect(offer.fee).toBeLessThan(ask);
    // The ceiling is one draw per window: the day's small drift in his value is the only difference.
    const ceilingNow = ceilingOf(after, squadOf(after, playerId));
    expect(Math.abs(offer.fee - ceilingNow)).toBeLessThanOrEqual(ceilingNow * 0.05);
    expect(offer.listed).toBe(true);
    expect(newsKeys(after)).toContain("listingCounter");
    expect(mailKeys(after)).toContain("listingCounter");
    expect(count(newsKeys(after), "listingOffer")).toBe(0);
  });

  it("an ask far above: nobody answers (noTakers / price, listingTooDear); re-pricing fairly yields an offer; re-pricing an offered entry is refused", () => {
    const { save: base, playerId, ask } = listScenario("dear");
    const listed = listOk(base, playerId, ask);
    const dayOne = advanceTo(listed, transferListOf(listed)[0].answerDay);
    expect(listedOffers(dayOne)).toHaveLength(0);
    const entry = transferListOf(dayOne)[0];
    expect(entry).toMatchObject({ status: "noTakers", reason: "price" });
    expect(newsKeys(dayOne)).toContain("listingTooDear");
    expect(mailKeys(dayOne)).toContain("listingTooDear");
    expect(listingPlanFor(dayOne, playerId)?.error).toBeNull(); // a noTakers entry may be re-priced

    const fair = quantize(ceilingOf(dayOne, squadOf(dayOne, playerId)) * 0.9);
    const relisted = listOk(dayOne, playerId, Math.max(fair, listingPlanFor(dayOne, playerId)!.min));
    const reEntry = transferListOf(relisted)[0];
    expect(reEntry.status).toBe("waiting");
    expect(reEntry.reason).toBeUndefined();
    expect(reEntry.answerDay).toBeGreaterThan(dayOne.clock.day);
    const dayTwo = advanceTo(relisted, reEntry.answerDay);
    expect(listedOffers(dayTwo)).toHaveLength(1);
    expect(transferListOf(dayTwo)[0].status).toBe("offered");

    const again = listPlayerFlow(dayTwo, playerId, listingPlanFor(dayTwo, playerId)!.min);
    expect(again.error).toBe("listOffered");
    expect(again.save).toBe(dayTwo);
    expect(listingPlanFor(dayTwo, playerId)?.error).toBe("listOffered");
  });
});

describe("R134 listing — answering the offer", () => {
  function offered(): { save: CareerSave; playerId: string; offer: TransferOffer } {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const save = advanceTo(listed, transferListOf(listed)[0].answerDay);
    return { save, playerId, offer: listedOffers(save)[0] };
  }

  it("accepting sells him: he leaves the squad, the fee is booked through the ledger, the entry and the offer are gone", () => {
    const { save, playerId, offer } = offered();
    const ledgerBefore = save.finances.ledger.length;
    const balanceBefore = save.finances.balance;
    const squadBefore = save.squad.length;
    const res = acceptBidFlow(save, offer.id);
    expect(res.error).toBeUndefined();
    const sold = res.save;
    expect(sold.squad.map((p) => p.id)).not.toContain(playerId);
    expect(sold.squad).toHaveLength(squadBefore - 1);
    expect(transferListOf(sold)).toHaveLength(0);
    expect(sold.transferList ?? []).toHaveLength(0);
    expect(sold.pendingOffers.find((o) => o.id === offer.id)).toBeUndefined();
    expect(listedOffers(sold)).toHaveLength(0);

    const lines = sold.finances.ledger.slice(ledgerBefore);
    const delta = sold.finances.balance - balanceBefore;
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(delta);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(offer.fee); // the Backer's share, if owed, comes off the top
    if (!save.finances.loan) expect(delta).toBe(offer.fee);
    // He is on the buying org (and nowhere else).
    const holders = Object.values(sold.world.orgs).filter((o) => o.playerIds.includes(playerId));
    expect(holders.map((o) => o.ref)).toEqual([offer.otherRef]);
    expect(sold.transferLog.some((t) => t.kind === "userOut" && t.playerId === playerId && t.fee === offer.fee)).toBe(true);
    expect(newsKeys(sold)).toContain("userSold");
    for (const s of sold.starterIds) if (s) expect(sold.squad.some((p) => p.id === s)).toBe(true); // a squad under three pads with ""
  });

  it("declining keeps him and removes the entry; delisting removes the entry and its offer", () => {
    const { save, playerId, offer } = offered();
    const declined = declineBidFlow(save, offer.id);
    expect(declined.squad.map((p) => p.id)).toContain(playerId);
    expect(listedOffers(declined)).toHaveLength(0);
    expect(transferListOf(declined)).toHaveLength(0);
    expect(declined.finances.balance).toBe(save.finances.balance);

    const delisted = delistPlayerFlow(save, playerId);
    expect(transferListOf(delisted)).toHaveLength(0);
    expect(listedOffers(delisted)).toHaveLength(0);
    expect(delisted.squad.map((p) => p.id)).toContain(playerId);
    // He can be listed again afterwards (the list is free).
    expect(listingPlanFor(delisted, playerId)?.error).toBeNull();
  });

  it("delisting a waiting entry removes it before any answer", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const delisted = delistPlayerFlow(listed, playerId);
    expect(transferListOf(delisted)).toHaveLength(0);
    // And no answer ever arrives for him.
    const later = advanceTo(delisted, W_START + 3);
    expect(listedOffers(later)).toHaveLength(0);
  });

  it("an offer on the list holds the clock as a bid decision", () => {
    const { save, offer } = offered();
    const decision = pendingDecisionsOf(save).find((d) => d.id === offer.id);
    expect(decision).toMatchObject({ kind: "bid", holds: true });
    // An ordinary bid may hold too and sort first: the clock is held either way.
    expect(clockHoldOf(save)?.kind).toBe("bid");
    expect(advanceDayFlow(save).clock.day).toBe(save.clock.day);
  });

  it("an event in progress locks accepting (roster move) but not listing", () => {
    const { save, offer } = offered();
    const locked = { ...structuredClone(save), activeEvent: {} as never };
    expect(acceptBidFlow(locked, offer.id).error).toBe("rosterLocked");
    expect(listingPlanFor(locked, save.squad[0].id)?.error).not.toBe("rosterLocked");
  });
});

describe("R134 listing — the window's close and other exits", () => {
  it("entries not sold are gone the first day outside the window, with one listingLapsed news item", () => {
    const { save: base, playerId, ask } = listScenario("dear");
    const listed = listOk(base, playerId, ask);
    const noTakers = advanceTo(listed, transferListOf(listed)[0].answerDay);
    expect(transferListOf(noTakers)).toHaveLength(1);
    expect(count(newsKeys(noTakers), "listingLapsed")).toBe(0);
    const closed = advanceTo(noTakers, W_CLOSE + 1);
    expect(windowIndexOf(weekOfDay(closed.clock.day))).toBeNull();
    expect(transferListOf(closed)).toHaveLength(0);
    expect(closed.transferList ?? []).toHaveLength(0);
    expect(count(newsKeys(closed), "listingLapsed")).toBe(1);
    expect(closed.squad.map((p) => p.id)).toContain(playerId);
  });

  it("a pending listed offer does not outlive the window: it is answered or expired, and the entry goes with it", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const offeredSave = advanceTo(listed, transferListOf(listed)[0].answerDay);
    expect(listedOffers(offeredSave)).toHaveLength(1);
    const closed = advanceTo(offeredSave, W_CLOSE + 1);
    expect(listedOffers(closed)).toHaveLength(0);
    expect(transferListOf(closed)).toHaveLength(0);
    expect(closed.pendingOffers.filter((o) => o.status === "pending" && o.direction === "out")).toHaveLength(0);
    expect(closed.squad.map((p) => p.id)).toContain(playerId); // the walk declined on the last day
  });

  it("an entry whose offer is gone (expired) is pruned on the next day", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const offeredSave = advanceTo(listed, transferListOf(listed)[0].answerDay);
    // The offer vanishes without the flows (as an older client settling a plain bid would leave it).
    const stale = structuredClone(offeredSave);
    stale.pendingOffers = stale.pendingOffers.filter((o) => !o.listed);
    const next = advanceTo(stale, stale.clock.day + 1);
    expect(transferListOf(next).find((l) => l.status === "offered")).toBeUndefined();
  });

  it("releasing a listed player removes his entry", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const res = releasePlayerFlow(listed, playerId);
    expect(res.error).toBeUndefined();
    expect(res.save.squad.map((p) => p.id)).not.toContain(playerId);
    expect(transferListOf(res.save)).toHaveLength(0);
    expect((res.save.transferList ?? []).some((l) => l.playerId === playerId)).toBe(false);
  });

  it("releasing a player with a listed offer pending leaves no offer behind", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const offeredSave = advanceTo(listed, transferListOf(listed)[0].answerDay);
    const res = releasePlayerFlow(offeredSave, playerId);
    expect(res.error).toBeUndefined();
    expect(listedOffers(res.save).filter((o) => o.playerId === playerId)).toHaveLength(0);
    expect((res.save.transferList ?? []).some((l) => l.playerId === playerId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

describe("R134 trade — the plan's refusals", () => {
  it("errors: first window, outside a window, unknown giver, free agent, another region", () => {
    const fresh = createCareerSave(INPUT, 7);
    const anyTake = Object.values(fresh.world.orgs)[0].playerIds[0];
    expect(tradePlanFor(fresh, fresh.squad[0].id, anyTake, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "listFirstWindow" });

    const outside = windowSave(7, OUTSIDE_DAY);
    expect(tradePlanFor(outside, outside.squad[0].id, anyTake, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "windowClosed" });

    const save = windowSave(7);
    const give = save.squad[0];
    expect(tradePlanFor(save, "nobody", anyTake, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "unknown" });

    const freeAgent = save.world.freeAgentIds[0];
    expect(freeAgent).toBeTruthy();
    expect(tradePlanFor(save, give.id, freeAgent, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "tradeFreeAgent" });

    const foreign = Object.values(save.world.orgs).find((o) => o.region !== give.region && o.playerIds.length > 0);
    expect(foreign).toBeTruthy();
    expect(tradePlanFor(save, give.id, foreign!.playerIds[0], { lengthSeasons: 2, cash: 0 })).toEqual({ error: "tradeRegion" });

    expect(tradePlanFor(windowSave(7, W_CLOSE), give.id, anyTake, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "listWindowClosing" });
  });

  it("a resale-locked giver cannot be traded (signed this window)", () => {
    const s = tradeScenario("agree");
    const save = structuredClone(s.save);
    const give = squadOf(save, s.pair.giveId);
    give.joinedSeason = save.clock.seasonIndex;
    give.signedDay = save.clock.day;
    expect(resaleLocked(give, save.clock.seasonIndex, save.clock.day)).toBe(true);
    expect(tradePlanFor(save, give.id, s.pair.takeId, { lengthSeasons: 2, cash: 0 })).toEqual({ error: "resaleLocked" });
  });

  it("the plan reads the fee of a plain buy and charges no severance (cash replaces the fee)", () => {
    const s = tradeScenario("agree");
    const planned = tradePlanFor(s.save, s.pair.giveId, s.pair.takeId, { lengthSeasons: 2, cash: 5_000 });
    expect("plan" in planned).toBe(true);
    if (!("plan" in planned)) return;
    expect(planned.plan.fee).toBe(s.pair.fee);
    expect(planned.plan.cash).toBe(5_000);
    expect(["likely", "close", "unlikely", "noFit"]).toContain(planned.plan.outlook);
    const signing = signingPlanFor(s.save, s.pair.takeId, { lengthSeasons: 2, releaseId: s.pair.giveId, trade: { cash: 5_000 } });
    expect("plan" in signing && signing.plan.view.id).toBe(s.pair.takeId);
  });
});

describe("R134 trade — proposing", () => {
  it("stores one waiting proposal and moves nothing; a second is refused (tradePending)", () => {
    const s = tradeScenario("agree");
    const before = snapshot(s.save);
    const inputJson = JSON.stringify(s.save);
    const { save, proposal } = propose(s);
    expect(JSON.stringify(s.save)).toBe(inputJson); // the input is untouched
    expect(tradeProposalsOf(save)).toHaveLength(1);
    expect(proposal).toMatchObject({
      giveId: s.pair.giveId,
      takeId: s.pair.takeId,
      cash: s.cash,
      status: "waiting",
      seasonIndex: 0,
      day: W_START,
      resolveDay: W_CLOSE,
    });
    expect(proposal.answerDay).toBeGreaterThan(W_START);
    expect(proposal.answerDay).toBeLessThanOrEqual(W_CLOSE);
    expect(proposal.orgRef).toBe(Object.values(save.world.orgs).find((o) => o.playerIds.includes(s.pair.takeId))!.ref);
    // Nothing moved: squad, orgs, balance, ledger.
    const strip = (x: CareerSave) => JSON.stringify({ ...JSON.parse(snapshot(x)), tradeProposals: undefined });
    expect(strip(save)).toBe(strip(s.save));
    expect(JSON.parse(before).balance).toBe(save.finances.balance);
    // A proposal still waiting owes the manager nothing.
    expect(pendingDecisionsOf(save).some((d) => d.id === proposal.id)).toBe(false);

    // The second proposal (even another pair) is refused.
    const other = tradePairs(save, 6).find((p) => p.giveId !== s.pair.giveId || p.takeId !== s.pair.takeId);
    const second = proposeTradeFlow(save, other?.giveId ?? s.pair.giveId, other?.takeId ?? s.pair.takeId, { lengthSeasons: 2, cash: 0 });
    expect(second.error).toBe("tradePending");
    expect(tradeProposalsOf(second.save)).toHaveLength(1);
  });

  it("withdrawing a waiting proposal removes it", () => {
    const { save, proposal } = propose(tradeScenario("agree"));
    const withdrawn = declineBidFlow(save, proposal.id);
    expect(tradeProposalsOf(withdrawn)).toHaveLength(0);
  });
});

describe("R134 trade — the org's verdict", () => {
  it("credit + cash covering the fee: agreed, a holding bid decision, tradeAgreed", () => {
    const s = tradeScenario("agree");
    const { save, id } = answered(s);
    const p = statusOf(save, id)!;
    expect(p.status).toBe("agreed");
    expect(p.cashAsked).toBeUndefined();
    expect(tradeCashOf(p)).toBe(s.cash);
    expect(newsKeys(save)).toContain("tradeAgreed");
    expect(mailKeys(save)).toContain("tradeAgreed");
    const decision = pendingDecisionsOf(save).find((d) => d.id === id);
    expect(decision).toMatchObject({ kind: "bid", holds: true });
    expect(clockHoldOf(save)?.id).toBe(id);
    expect(advanceDayFlow(save).clock.day).toBe(save.clock.day);
  });

  it("cash a small gap short: countered, cashAsked above the cash and covering the fee with the credit", () => {
    const s = tradeScenario("counter");
    const { save, id } = answered(s);
    const p = statusOf(save, id)!;
    expect(p.status).toBe("countered");
    expect(p.cashAsked).toBeGreaterThan(p.cash);
    const credit = tradeCreditFor({
      player: squadOf(save, p.giveId),
      takeId: p.takeId,
      careerSeed: save.careerSeed,
      seasonIndex: save.clock.seasonIndex,
      windowIdx: WINDOW_IDX,
      day: save.clock.day,
      growthModel: growthModelOf(save.world),
    });
    const fee = (tradePlanFor(save, p.giveId, p.takeId, { lengthSeasons: p.lengthSeasons, cash: 0 }) as { plan: { fee: number } }).plan.fee;
    expect(credit + p.cashAsked!).toBeGreaterThanOrEqual(fee);
    expect(tradeCashOf(p)).toBe(p.cashAsked);
    expect(newsKeys(save)).toContain("tradeCountered");
    expect(mailKeys(save)).toContain("tradeCountered");
    expect(pendingDecisionsOf(save).find((d) => d.id === id)).toMatchObject({ kind: "bid", holds: true });
  });

  it("a giver more than maxDowngrade below the target: refused for fit, the proposal removed", () => {
    const s = tradeScenario("fit");
    const { save, id } = answered(s);
    expect(statusOf(save, id)).toBeUndefined();
    expect(tradeProposalsOf(save)).toHaveLength(0);
    expect(newsKeys(save)).toContain("tradeRefusedFit");
    expect(mailKeys(save)).toContain("tradeRefusedFit");
    expect(squadOf(save, s.pair.giveId)).toBeTruthy();
  });

  it("a tiny credit against a big fee and no cash: refused for value", () => {
    const s = tradeScenario("value");
    const { save, id } = answered(s);
    expect(statusOf(save, id)).toBeUndefined();
    expect(newsKeys(save)).toContain("tradeRefusedValue");
    expect(mailKeys(save)).toContain("tradeRefusedValue");
    expect(count(newsKeys(save), "tradeRefusedFit")).toBe(0);
  });
});

describe("R134 trade — completing", () => {
  it("an agreed trade is atomic: seats swap, the arrival signs fresh, only the cash moves", () => {
    const s = tradeScenario("agree");
    const { save, id } = answered(s);
    const prop = statusOf(save, id)!;
    const org = save.world.orgs[prop.orgRef];
    const seat = org.playerIds.indexOf(prop.takeId);
    expect(seat).toBeGreaterThanOrEqual(0);
    const orgSizeBefore = org.playerIds.length;
    const planned = signingPlanFor(save, prop.takeId, { lengthSeasons: prop.lengthSeasons, releaseId: prop.giveId, trade: { cash: prop.cash } });
    if (!("plan" in planned)) throw new Error(`plan refused: ${planned.error}`);
    const bonus = planned.plan.talk.terms.bonus;
    const wasStarter = save.starterIds.includes(prop.giveId);
    const squadBefore = save.squad.length;
    const ledgerBefore = save.finances.ledger.length;
    const logBefore = save.transferLog.length;
    const balanceBefore = save.finances.balance;
    const inputJson = JSON.stringify(save);

    const res = acceptBidFlow(save, id);
    expect(res.error).toBeUndefined();
    expect(JSON.stringify(save)).toBe(inputJson); // pure
    const after = res.save;

    // The giver took the taker's old seat; the org still fields three distinct players.
    const orgAfter = after.world.orgs[prop.orgRef];
    expect(orgAfter.playerIds[seat]).toBe(prop.giveId);
    expect(orgAfter.playerIds).toHaveLength(orgSizeBefore);
    expect(new Set(orgAfter.playerIds).size).toBe(orgAfter.playerIds.length);
    expect(orgAfter.playerIds).not.toContain(prop.takeId);
    // The taker is in the squad, signed today.
    const taker = squadOf(after, prop.takeId);
    expect(taker).toBeTruthy();
    expect(taker.joinedSeason).toBe(after.clock.seasonIndex);
    expect(taker.signedDay).toBe(after.clock.day);
    expect(after.squad.map((p) => p.id)).not.toContain(prop.giveId);
    expect(after.squad).toHaveLength(squadBefore);
    // Starters: three valid, distinct ids; the taker has the leaver's seat.
    expect(after.starterIds).toHaveLength(3);
    expect(new Set(after.starterIds).size).toBe(3);
    for (const sid of after.starterIds) expect(after.squad.some((p) => p.id === sid)).toBe(true);
    if (wasStarter) expect(after.starterIds).toContain(prop.takeId);
    // Money: exactly the cash (and the signing bonus, if the talk asks one) leaves.
    expect(after.finances.balance).toBe(balanceBefore - prop.cash - bonus);
    const lines = after.finances.ledger.slice(ledgerBefore);
    expect(lines.map((l) => l.kind)).not.toContain("severance");
    expect(lines.reduce((acc, l) => acc + l.amount, 0)).toBe(-(prop.cash + bonus));
    // The wire: a free-of-fee exit and the cash as the entry's fee.
    const log = after.transferLog.slice(0, after.transferLog.length - logBefore > 0 ? after.transferLog.length - logBefore : 0);
    const added = after.transferLog.filter((t) => !save.transferLog.some((o) => o.id === t.id));
    expect(added.length).toBeGreaterThanOrEqual(2);
    expect(log.length).toBeGreaterThanOrEqual(0);
    expect(added.find((t) => t.kind === "userOut" && t.playerId === prop.giveId)).toMatchObject({ fee: 0, toRef: prop.orgRef });
    expect(added.find((t) => t.kind === "userIn" && t.playerId === prop.takeId)).toMatchObject({ fee: prop.cash, fromRef: prop.orgRef });
    // Neither is a free agent; the proposal is gone; the feed says so.
    expect(after.world.freeAgentIds).not.toContain(prop.giveId);
    expect(after.world.freeAgentIds).not.toContain(prop.takeId);
    expect(statusOf(after, id)).toBeUndefined();
    expect(newsKeys(after)).toContain("userTraded");
    // No other org still lists either of them.
    for (const pid of [prop.giveId, prop.takeId]) {
      expect(Object.values(after.world.orgs).filter((o) => o.playerIds.includes(pid)).length).toBe(pid === prop.giveId ? 1 : 0);
    }
  });

  it("a countered trade, accepted, moves the cash the org asked for", () => {
    const s = tradeScenario("counter");
    const { save, id } = answered(s);
    const prop = statusOf(save, id)!;
    expect(prop.status).toBe("countered");
    const planned = signingPlanFor(save, prop.takeId, {
      lengthSeasons: prop.lengthSeasons,
      releaseId: prop.giveId,
      trade: { cash: prop.cashAsked! },
    });
    if (!("plan" in planned)) throw new Error(`plan refused: ${planned.error}`);
    const bonus = planned.plan.talk.terms.bonus;
    const res = acceptBidFlow(save, id);
    expect(res.error).toBeUndefined();
    expect(res.save.finances.balance).toBe(save.finances.balance - prop.cashAsked! - bonus);
    expect(squadOf(res.save, prop.takeId)).toBeTruthy();
    expect(statusOf(res.save, id)).toBeUndefined();
    const out = res.save.finances.ledger.find((l) => l.kind === "transferOut" && l.amount === -prop.cashAsked!);
    expect(out).toBeTruthy();
  });

  it("without the balance the trade is refused (funds) and nothing moves", () => {
    const s = tradeScenario("counter");
    const { save, id } = answered(s);
    const prop = statusOf(save, id)!;
    const poor = structuredClone(save);
    poor.finances.balance = backerLineOf(poor).floor + prop.cashAsked! - 1;
    const before = snapshot(poor);
    const res = acceptBidFlow(poor, id);
    expect(res.error).toBe("funds");
    expect(snapshot(res.save)).toBe(before);
    expect(statusOf(res.save, id)).toBeTruthy();
  });

  it("declining removes the proposal and moves nothing; an event in progress locks accepting", () => {
    const s = tradeScenario("agree");
    const { save, id } = answered(s);
    const declined = declineBidFlow(save, id);
    expect(statusOf(declined, id)).toBeUndefined();
    expect(declined.squad.map((p) => p.id)).toEqual(save.squad.map((p) => p.id));
    expect(declined.finances.balance).toBe(save.finances.balance);
    expect(JSON.stringify(declined.world.orgs)).toBe(JSON.stringify(save.world.orgs));
    expect(clockHoldOf(declined)).toBeNull();

    const locked = { ...structuredClone(save), activeEvent: {} as never };
    const before = snapshot(locked);
    const res = acceptBidFlow(locked, id);
    expect(res.error).toBe("rosterLocked");
    expect(snapshot(res.save)).toBe(before);
  });

  it("waiting proposals cannot be accepted", () => {
    const { save, proposal } = propose(tradeScenario("agree"));
    const res = acceptBidFlow(save, proposal.id);
    expect(res.error).toBe("unknown");
    expect(res.save).toBe(save);
  });
});

describe("R134 trade — lapsing and other exits", () => {
  it("a proposal never answered lapses at the window's close with a tradeLapsed news item", () => {
    const { save, proposal } = propose(tradeScenario("agree"));
    const stuck = structuredClone(save);
    stuck.tradeProposals![0].answerDay = 500; // the org never gets to it
    const inWindow = advanceTo(stuck, W_CLOSE);
    expect(tradeProposalsOf(inWindow)).toHaveLength(1);
    expect(count(newsKeys(inWindow), "tradeLapsed")).toBe(0);
    const closed = advanceTo(inWindow, W_CLOSE + 1);
    expect(statusOf(closed, proposal.id)).toBeUndefined();
    expect(tradeProposalsOf(closed)).toHaveLength(0);
    expect(count(newsKeys(closed), "tradeLapsed")).toBe(1);
  });

  it("an agreed trade left to the walk is refused on the last day, not completed", () => {
    const s = tradeScenario("agree");
    const { save, id } = answered(s);
    const closed = advanceTo(save, W_CLOSE + 1);
    expect(statusOf(closed, id)).toBeUndefined();
    expect(closed.squad.map((p) => p.id)).toContain(s.pair.giveId);
    expect(closed.squad.map((p) => p.id)).not.toContain(s.pair.takeId);
  });

  it("selling the giver through an ordinary bid removes the proposal", () => {
    const s = tradeScenario("agree");
    const { save } = answered(s);
    expect(tradeProposalsOf(save)).toHaveLength(1);
    const buyer = Object.values(save.world.orgs).find((o) => o.region === squadOf(save, s.pair.giveId).region && !o.playerIds.includes(s.pair.giveId))!;
    const bid: TransferOffer = {
      id: "bid:test:giver",
      direction: "out",
      playerId: s.pair.giveId,
      playerName: "Giver",
      fee: 50_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: buyer.ref,
      status: "pending",
      resolveSeason: 0,
      resolveDay: W_CLOSE,
      factors: [],
    };
    const withBid = { ...structuredClone(save), pendingOffers: [bid] };
    const res = acceptBidFlow(withBid, bid.id);
    expect(res.error).toBeUndefined();
    expect(res.save.squad.map((p) => p.id)).not.toContain(s.pair.giveId);
    expect(tradeProposalsOf(res.save)).toHaveLength(0);
  });

  it("releasing the giver removes the proposal too", () => {
    const s = tradeScenario("agree");
    const { save } = propose(s);
    const res = releasePlayerFlow(save, s.pair.giveId);
    expect(res.error).toBeUndefined();
    expect(tradeProposalsOf(res.save)).toHaveLength(0);
  });

  it("a proposal whose target moved before the answer lapses instead of answering", () => {
    const { save, proposal } = propose(tradeScenario("agree"));
    const moved = structuredClone(save);
    const org = moved.world.orgs[proposal.orgRef];
    org.playerIds = org.playerIds.filter((id) => id !== proposal.takeId) as typeof org.playerIds;
    const next = advanceTo(moved, proposal.answerDay);
    expect(tradeProposalsOf(next)).toHaveLength(0);
    expect(newsKeys(next)).toContain("tradeLapsed");
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe("R134 persistence", () => {
  function withBothFields(): CareerSave {
    const s = tradeScenario("agree");
    const { save } = propose(s);
    const { save: base, playerId, ask } = listScenario("ok");
    // One save carrying both: a listing from the list scenario on the trade save is not needed — any listable player will do.
    void base;
    void playerId;
    void ask;
    const free = save.squad.find((p) => p.id !== s.pair.giveId)!;
    const listed = listOk(save, free.id, listingPlanFor(save, free.id)!.min);
    return listed;
  }

  it("repairMoneyOnLoad drops the legacy pair and leaves the new pair untouched", () => {
    const save = withBothFields();
    expect(save.transferList).toHaveLength(1);
    expect(save.tradeProposals).toHaveLength(1);
    const legacy = save as unknown as Record<string, unknown>;
    legacy.saleListings = [{ playerId: "x", ask: 1 }];
    legacy.lateSigning = { day: 3 };
    const listBefore = structuredClone(save.transferList);
    const tradeBefore = structuredClone(save.tradeProposals);
    repairMoneyOnLoad(save);
    expect("saleListings" in save).toBe(false);
    expect("lateSigning" in save).toBe(false);
    expect(save.transferList).toEqual(listBefore);
    expect(save.tradeProposals).toEqual(tradeBefore);
    // Idempotent.
    repairMoneyOnLoad(save);
    expect(save.transferList).toEqual(listBefore);
    expect(save.tradeProposals).toEqual(tradeBefore);
  });

  it("repairMoneyOnLoad keeps a listed offer's listed / ask fields (only the legacy `listing` flag is stripped)", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const save = advanceTo(listed, transferListOf(listed)[0].answerDay);
    const offer = listedOffers(save)[0];
    (offer as { listing?: boolean }).listing = true;
    repairMoneyOnLoad(save);
    const kept = save.pendingOffers.find((o) => o.id === offer.id)!;
    expect(kept.listed).toBe(true);
    expect(kept.ask).toBe(ask);
    expect(kept.listing).toBeUndefined();
  });

  it("a JSON round trip of a save with both fields is deep-equal", () => {
    const save = withBothFields();
    const round = JSON.parse(JSON.stringify(save)) as CareerSave;
    expect(round.transferList).toEqual(save.transferList);
    expect(round.tradeProposals).toEqual(save.tradeProposals);
    expect(round).toEqual(save);
  });

  it("a save without the two fields behaves as before: empty reads, and a day adds neither field", () => {
    const save = windowSave(7);
    expect(save.transferList).toBeUndefined();
    expect(save.tradeProposals).toBeUndefined();
    expect(transferListOf(save)).toEqual([]);
    expect(tradeProposalsOf(save)).toEqual([]);
    const next = advanceTo(save, save.clock.day + 2);
    expect("transferList" in next).toBe(false);
    expect("tradeProposals" in next).toBe(false);
    // A read-only flow on the empty save adds no field either.
    expect(declineBidFlow(save, "nope").tradeProposals).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The anti-flip anchor
// ---------------------------------------------------------------------------

describe("R134 money anchor — the list is no flip", () => {
  const SEEDS = [3, 11, 29, 47, 61, 83, 101, 127, 149, 173, 197, 211];

  it("no listing can be made on a player signed in this window or the next (resaleLocked)", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const save = windowSave(seed);
      const ctx = ctxOf(save);
      const cap = signableOverallCap(save.reputation);
      const target = save.world.freeAgentIds
        .map((id) => playerViewById(id, ctx))
        .filter((v): v is CareerPlayerView => v !== null && v.age >= 16 && Math.round(v.overall) <= cap)
        .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
      if (!target) continue;
      const signed = signPlayerFlow(save, target.id, { lengthSeasons: 2 });
      expect(signed.error).toBeUndefined();
      const listed = listPlayerFlow(signed.save, target.id, 1_000_000);
      expect(listed.error).toBe("resaleLocked");
      expect(listingPlanFor(signed.save, target.id)?.error).toBe("resaleLocked");
      expect(transferListOf(listed.save)).toHaveLength(0);
      // Founders have no signedDay: never locked.
      expect(listingPlanFor(signed.save, signed.save.squad[0].id)?.error).toBeNull();
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });

  it("a short-tenure player's ceiling is discounted (at most share x the band's top x premium x value); a founder's is not", () => {
    const L = CAREER_TRANSFER.listing;
    let checked = 0;
    for (const seed of SEEDS) {
      const save = windowSave(seed);
      const ctx = ctxOf(save);
      const growthModel = growthModelOf(save.world);
      for (const founder of save.squad) {
        expect(shortTenure(founder, save.clock.seasonIndex, save.clock.day)).toBe(false);
        expect(listingPlanFor(save, founder.id)?.shortTenure).toBe(false);
        const recent: SquadPlayer = { ...founder, joinedSeason: save.clock.seasonIndex, signedDay: save.clock.day - 10 };
        const old: SquadPlayer = { ...founder, joinedSeason: save.clock.seasonIndex - 1, signedDay: save.clock.day - 10 };
        expect(shortTenure(recent, save.clock.seasonIndex, save.clock.day)).toBe(true);
        expect(shortTenure(old, save.clock.seasonIndex, save.clock.day)).toBe(false);
        const input = valueInputOf(founder, ctx.careerSeed, ctx.seasonIndex, growthModel);
        const value = marketValueFor(input);
        const top = L.shortTenureShare * L.buyerRange[1] * (1 + L.premiumShare * (bidPremiumFor(input) - 1)) * value;
        const c = (p: SquadPlayer) => ceilingOf(save, p);
        expect(c(recent)).toBeLessThanOrEqual(top + 1_000); // quantize slack
        expect(c(recent)).toBeLessThan(c(old));
        expect(c(founder)).toBe(c(old)); // a founder (no signedDay) is not discounted
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("listingPlanFor flags a short-tenure player", () => {
    const save = windowSave(7);
    const p = save.squad[0];
    const recent = structuredClone(save);
    Object.assign(squadOf(recent, p.id), { joinedSeason: 0, signedDay: 1 });
    expect(listingPlanFor(recent, p.id)?.shortTenure).toBe(true);
    expect(listingPlanFor(save, p.id)?.shortTenure).toBe(false);
  });

  it("the ask slider's top never exceeds what the engine could ever pay on a counter (the sheet cannot promise more than the ceiling band)", () => {
    for (const seed of SEEDS) {
      const save = windowSave(seed);
      for (const p of save.squad) {
        const plan = listingPlanFor(save, p.id)!;
        expect(plan.min).toBeLessThanOrEqual(plan.max);
        const [lo, hi] = CAREER_TRANSFER.listing.askRange;
        expect(plan.min).toBe(quantize(plan.value * lo));
        expect(plan.max).toBeGreaterThanOrEqual(quantize(plan.value * hi));
      }
    }
  });
});

describe("R134 — sanity of the fixtures", () => {
  it("the squad fits under the cap and windows are where the tests expect", () => {
    const save = windowSave(7);
    expect(save.squad.length).toBeLessThanOrEqual(CAREER_CONTRACT.squadCap);
    expect(windowIndexOf(weekOfDay(W_START))).toBe(WINDOW_IDX);
    expect(W_CLOSE).toBeGreaterThan(W_START + 3);
  });
});

describe("R134 — no buying back (the pre-commit review's loop)", () => {
  function sold(): { save: CareerSave; playerId: string } {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    const offeredSave = advanceTo(listed, transferListOf(listed)[0].answerDay);
    const res = acceptBidFlow(offeredSave, listedOffers(offeredSave)[0].id);
    expect(res.error).toBeUndefined();
    return { save: res.save, playerId };
  }

  it("a player sold from the list does not sign again for a season, then he can", () => {
    const { save, playerId } = sold();
    expect(save.soldOn?.[playerId]).toEqual({ seasonIndex: save.clock.seasonIndex, day: save.clock.day });
    // Same window, and the season's later windows: refused as a buy-back (never for money or the window).
    const later = structuredClone(save);
    later.clock.day = OUTSIDE_DAY;
    for (const s of [save, later]) {
      const plan = signingPlanFor(s, playerId, { lengthSeasons: 1 });
      expect("error" in plan ? plan.error : null).toMatch(/buyBack|justSigned|windowClosed/);
    }
    const nextWindow = structuredClone(save);
    nextWindow.transferLog = []; // past the "just signed elsewhere" window rule
    const refused = signingPlanFor(nextWindow, playerId, { lengthSeasons: 1 });
    expect("error" in refused ? refused.error : null).toBe("buyBack");
    // A full season on, the lock is over.
    const nextSeason = structuredClone(nextWindow);
    nextSeason.clock.seasonIndex += 1;
    const free = signingPlanFor(nextSeason, playerId, { lengthSeasons: 1 });
    expect("error" in free ? free.error : null).not.toBe("buyBack");
  });

  it("a traded-away player is locked the same way, and old entries are dropped at the next sale", () => {
    const s = tradeScenario("agree");
    const { save, id } = answered(s);
    const prop = statusOf(save, id)!;
    const stale = structuredClone(save);
    stale.soldOn = { ghost: { seasonIndex: save.clock.seasonIndex - 2, day: 1 } };
    const res = acceptBidFlow(stale, id);
    expect(res.error).toBeUndefined();
    expect(Object.keys(res.save.soldOn ?? {})).toEqual([prop.giveId]);
    const back = structuredClone(res.save);
    back.transferLog = [];
    const plan = signingPlanFor(back, prop.giveId, { lengthSeasons: 1 });
    expect("error" in plan ? plan.error : null).toBe("buyBack");
  });

  it("a listing made in an earlier window lapses instead of being answered in the next one", () => {
    const { save: base, playerId, ask } = listScenario("ok");
    const listed = listOk(base, playerId, ask);
    // As an older client would leave it: the clock walked into the season's next window, the entry untouched.
    const jumped = structuredClone(listed);
    let day = W_CLOSE + 1;
    while (windowIndexOf(weekOfDay(day)) === null) day++;
    jumped.clock.day = day - 1;
    const after = stepDayForTests(jumped);
    expect(windowIndexOf(weekOfDay(after.clock.day))).not.toBe(WINDOW_IDX);
    expect(transferListOf(after)).toHaveLength(0);
    expect(listedOffers(after)).toHaveLength(0);
  });
});
