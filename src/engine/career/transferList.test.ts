/**
 * R135 (ECO-05 / ECO-06): the transfer list and the trade, pure engine.
 * Dataset-agnostic: hand-built fixtures, filler ids only.
 */

import { describe, expect, it } from "vitest";
import { CAREER_ECONOMY, CAREER_TRANSFER } from "@/config/balance";
import { firstDayOfWeek, windowCloseDayFor } from "./calendar";
import { playerViewById, seasonYear } from "./development";
import { marketValueFor } from "./economy";
import { bidPremiumFor, valueInputOf } from "./market";
import {
  clampListingAsk,
  listingAnswerDayFor,
  listingAnswerFor,
  listingAskBounds,
  listingBlockFor,
  listingBuyerFor,
  listingCeilingFor,
  listingValueOf,
  shortTenure,
  tradeAnswerDayFor,
  tradeCreditFor,
  tradeOutlookFor,
  tradeVerdictFor,
} from "./transferList";
import type { ListedPlayer, SquadPlayer, WorldOrgState, WorldState } from "./types";

const SEED = 4242;
const SEASON = 1;
const L = CAREER_TRANSFER.listing;
const T = CAREER_TRANSFER.trade;
const Q = CAREER_ECONOMY.roundQuantum;

// Window 0 = weeks 1-2 (close day 14); window 1 = weeks 11-12.
const W0 = firstDayOfWeek(1);
const W1 = firstDayOfWeek(11);
const CLOSE1 = windowCloseDayFor(1);

const player = (over: Partial<SquadPlayer> = {}): SquadPlayer => ({
  id: "rook:1:EU:0",
  kind: "fictional",
  name: "Seller",
  region: "EU",
  birthYear: seasonYear(SEASON) - 30,
  archetype: "allround",
  overall: 80,
  attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
  potential: 80,
  peakAge: 25,
  declineRate: "normal",
  role: "starter",
  salaryPerSplit: 1_000,
  contractEndSeason: 9,
  trainingFocus: "auto",
  trainingIntensity: "normal",
  scoutLevel: 0,
  splitsTogether: 0,
  joinedSeason: 0,
  gainedThisSplit: 0,
  gainedThisSeason: 0,
  ...over,
});

const youngTalent = () =>
  player({ id: "rook:1:EU:1", birthYear: seasonYear(SEASON) - 17, overall: 70, potential: 95, peakAge: 24 });

const emptyWorld = (): WorldState => ({
  orgs: {},
  overallDelta: {},
  freeAgentIds: [],
  retiredIds: [],
  version: 0,
});

/** An org of three fillers (ids start at `n0`), prestige 1. */
const org = (ref: string, n0: number, region: WorldOrgState["region"] = "EU", prestige: 0 | 1 | 2 | 3 = 1): WorldOrgState => ({
  ref,
  name: ref,
  region,
  prestige,
  playerIds: [`fic:${region}:${n0}`, `fic:${region}:${n0 + 1}`, `fic:${region}:${n0 + 2}`],
  stars: 3,
});

/** Pins every player of `o` to exactly `overall` through the world's overallDelta. */
function pinOveralls(world: WorldState, o: WorldOrgState, overall: number): void {
  for (const id of o.playerIds) {
    world.overallDelta[id] = 0;
    const base = playerViewById(id, { careerSeed: SEED, seasonIndex: SEASON, world })!.overall;
    world.overallDelta[id] = overall - base;
  }
}

/** A world with `weakOrgs` orgs whose players the seller out-rates and `strongOrgs` he does not. */
function worldWith(weakOrgs: number, strongOrgs = 0): WorldState {
  const world = emptyWorld();
  let n = 0;
  for (let i = 0; i < weakOrgs + strongOrgs; i++) {
    const o = org(`fill:EU:${i}`, n);
    n += 3;
    world.orgs[o.ref] = o;
    pinOveralls(world, o, i < weakOrgs ? 70 : 95);
  }
  return world;
}

const listing = (ask: number, over: Partial<ListedPlayer> = {}): ListedPlayer => ({
  playerId: "rook:1:EU:0",
  ask,
  seasonIndex: SEASON,
  day: W1,
  answerDay: W1 + 1,
  status: "waiting",
  ...over,
});

describe("listingBlockFor", () => {
  const free = { id: "p", joinedSeason: 0 };
  const base = { player: free, listed: [] as { playerId: string }[], seasonIndex: SEASON, day: W1 };

  it("is null on a legal window day", () => {
    expect(listingBlockFor(base)).toBeNull();
  });

  it("walks the checks in the documented order", () => {
    // windowClosed: a day between windows (week 5).
    expect(listingBlockFor({ ...base, day: firstDayOfWeek(5) })).toBe("windowClosed");
    // firstWindow: the career's first preseason.
    expect(listingBlockFor({ ...base, seasonIndex: 0, day: W0 })).toBe("firstWindow");
    // windowClosing: the close day itself.
    expect(listingBlockFor({ ...base, day: CLOSE1 })).toBe("windowClosing");
    // resaleLocked: signed in this window.
    expect(listingBlockFor({ ...base, player: { ...free, joinedSeason: SEASON, signedDay: W1 } })).toBe("resaleLocked");
    // alreadyListed.
    expect(listingBlockFor({ ...base, listed: [{ playerId: "p" }] })).toBe("alreadyListed");
    // listFull.
    const full = Array.from({ length: L.maxListed }, (_, i) => ({ playerId: `x${i}` }));
    expect(listingBlockFor({ ...base, listed: full })).toBe("listFull");
  });

  it("an earlier block wins over a later one", () => {
    const full = Array.from({ length: L.maxListed }, (_, i) => ({ playerId: i === 0 ? "p" : `x${i}` }));
    // Both alreadyListed and listFull hold: alreadyListed is first.
    expect(listingBlockFor({ ...base, listed: full })).toBe("alreadyListed");
    // Closed window beats a locked player.
    const locked = { ...free, joinedSeason: SEASON, signedDay: firstDayOfWeek(5) };
    expect(listingBlockFor({ ...base, player: locked, day: firstDayOfWeek(5) })).toBe("windowClosed");
    // The first window beats the closing day.
    expect(listingBlockFor({ ...base, seasonIndex: 0, day: windowCloseDayFor(0) })).toBe("firstWindow");
  });
});

describe("the ask", () => {
  it("bounds follow askRange, quantized, min <= max", () => {
    for (const v of [100, 1_234, 98_765, 500_000]) {
      const { min, max } = listingAskBounds(v);
      expect(min).toBeLessThanOrEqual(max);
      expect(min % Q).toBe(0);
      expect(max % Q).toBe(0);
      expect(min).toBeLessThanOrEqual(v * L.askRange[0]);
      expect(min).toBeGreaterThan(v * L.askRange[0] - Q);
      expect(max).toBeLessThanOrEqual(v * L.askRange[1]);
    }
  });

  it("clampListingAsk clamps both ends and quantizes inside", () => {
    const v = 200_000;
    const { min, max } = listingAskBounds(v);
    expect(clampListingAsk(v, 1)).toBe(min);
    expect(clampListingAsk(v, v * 10)).toBe(max);
    expect(clampListingAsk(v, min + Q + 1)).toBe(min + Q);
  });
});

describe("listingAnswerDayFor", () => {
  it("lands in [day+lo, day+hi], never past the close day, and is stable", () => {
    const [lo, hi] = L.answerDays;
    for (let day = W1; day < CLOSE1; day++) {
      for (let k = 0; k < 20; k++) {
        const ctx = { careerSeed: SEED + k, seasonIndex: SEASON, day, windowIdx: 1 as const, playerId: `p${k}` };
        const a = listingAnswerDayFor(ctx);
        expect(a).toBeGreaterThanOrEqual(Math.min(day + lo, CLOSE1));
        expect(a).toBeLessThanOrEqual(Math.min(day + hi, CLOSE1));
        expect(a).toBe(listingAnswerDayFor(ctx));
      }
    }
  });

  it("uses more than one delay across samples", () => {
    const delays = new Set<number>();
    for (let k = 0; k < 60; k++) {
      delays.add(listingAnswerDayFor({ careerSeed: SEED, seasonIndex: SEASON, day: W1, windowIdx: 1, playerId: `p${k}` }) - W1);
    }
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe("listingCeilingFor", () => {
  const ctxFor = (p: SquadPlayer, seed: number, windowIdx = 1) => ({
    day: W1,
    player: p,
    careerSeed: seed,
    seasonIndex: SEASON,
    windowIdx,
  });

  it("stays inside value x premium share x buyerRange", () => {
    for (const p of [player(), youngTalent()]) {
      for (let seed = 1; seed <= 60; seed++) {
        const input = valueInputOf(p, seed, SEASON);
        const base = marketValueFor(input) * (1 + L.premiumShare * (bidPremiumFor(input) - 1));
        const c = listingCeilingFor(ctxFor(p, seed));
        expect(c).toBeGreaterThanOrEqual(base * L.buyerRange[0] - Q);
        expect(c).toBeLessThanOrEqual(base * L.buyerRange[1]);
        expect(c % Q).toBe(0);
      }
    }
  });

  it("is one draw per window: identical however often it is read, new across windows", () => {
    let differs = false;
    for (let seed = 1; seed <= 40; seed++) {
      const p = player();
      expect(listingCeilingFor(ctxFor(p, seed))).toBe(listingCeilingFor(ctxFor(p, seed)));
      if (listingCeilingFor(ctxFor(p, seed, 1)) !== listingCeilingFor(ctxFor(p, seed, 2))) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("design anchor: a no-premium player's best ceiling sits below the top of a poach", () => {
    const old = player();
    let best = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const input = valueInputOf(old, seed, SEASON);
      expect(bidPremiumFor(input)).toBe(1);
      best = Math.max(best, listingCeilingFor(ctxFor(old, seed)) / marketValueFor(input));
    }
    expect(best).toBeLessThanOrEqual(L.buyerRange[1] + 1e-9);
    expect(best).toBeLessThan(CAREER_TRANSFER.aiBidRange[1]);
  });
});

describe("listingBuyerFor", () => {
  const ctx = (world: WorldState, p = player()) => ({ world, player: p, careerSeed: SEED, seasonIndex: SEASON, windowIdx: 1 });

  it("picks one weaker-fielding org, stably", () => {
    const world = worldWith(3, 2);
    const ref = listingBuyerFor(ctx(world));
    expect(ref).not.toBeNull();
    expect(world.orgs[ref!].playerIds.every((id) => (world.overallDelta[id] ?? 0) !== undefined)).toBe(true);
    // Only the weak orgs (fill:EU:0..2) would field an 80.
    expect(["fill:EU:0", "fill:EU:1", "fill:EU:2"]).toContain(ref);
    expect(listingBuyerFor(ctx(world))).toBe(ref);
  });

  it("nobody would start him: the funded org he is closest to takes him as depth", () => {
    // Three orgs of 95s: an 80 starts for none, and is still answered.
    const strong = worldWith(0, 3);
    const ref = listingBuyerFor(ctx(strong));
    expect(ref).not.toBeNull();
    expect(listingBuyerFor(ctx(strong))).toBe(ref);
    // With a weaker funded org in the region, an org that would field him answers instead.
    expect(listingBuyerFor(ctx(worldWith(1, 3)))).toBe("fill:EU:0");
  });

  it("is null with no org in his region, and an org without a wallet never buys above its own level", () => {
    expect(listingBuyerFor(ctx(worldWith(3), player({ region: "NA" })))).toBeNull();
    const world = worldWith(2);
    for (const o of Object.values(world.orgs)) o.prestige = 0;
    // An 80 is above both prestige-0 orgs' best (70), and nobody funded is left.
    expect(listingBuyerFor(ctx(world))).toBeNull();
  });

  it("an org with fewer than three players always would; the org already holding him never does", () => {
    const world = worldWith(0, 1);
    world.orgs["fill:EU:0"].playerIds = ["fic:EU:0", "fic:EU:1"] as unknown as WorldOrgState["playerIds"];
    expect(listingBuyerFor(ctx(world))).toBe("fill:EU:0");
    const p = player({ id: "fic:EU:0" });
    expect(listingBuyerFor(ctx(world, p))).toBeNull();
  });
});

describe("listingAnswerFor", () => {
  const p = player();
  const world = worldWith(3);
  const answer = (ask: number, w: WorldState = world) =>
    listingAnswerFor({
      world: w,
      player: p,
      listing: listing(ask),
      careerSeed: SEED,
      seasonIndex: SEASON,
      windowIdx: 1,
      day: W1 + 2,
    });
  const ceiling = listingCeilingFor({ player: p, careerSeed: SEED, seasonIndex: SEASON, windowIdx: 1, day: W1 + 2 });
  const value = listingValueOf(p, { careerSeed: SEED, seasonIndex: SEASON });

  it("an ask at or below the ceiling is paid in full", () => {
    for (const ask of [ceiling, ceiling - Q * 4]) {
      const a = answer(ask);
      expect(a.kind).toBe("offer");
      if (a.kind !== "offer") return;
      expect(a.offer.fee).toBe(ask);
      expect(a.offer.ask).toBe(ask);
      expect(a.offer.listed).toBe(true);
      expect(a.offer.direction).toBe("out");
      expect(a.offer.status).toBe("pending");
      expect(a.offer.resolveDay).toBe(CLOSE1);
      expect(a.offer.id).toBe(`list:${SEASON}:${W1 + 2}:${p.id}`);
      expect(a.offer.valuePct).toBe(Math.round((ask / value) * 100));
      expect(world.orgs[a.offer.otherRef!]).toBeDefined();
    }
  });

  it("slightly above the ceiling draws a counter at the ceiling", () => {
    const ask = ceiling + Q * 2;
    const a = answer(ask);
    expect(a.kind).toBe("counter");
    if (a.kind !== "counter") return;
    expect(a.offer.fee).toBe(ceiling);
    expect(a.offer.ask).toBe(ask);
    expect(a.offer.listed).toBe(true);
  });

  it("far above is a price refusal", () => {
    const a = answer(Math.ceil(ceiling * (1 + L.counterReach)) + Q);
    expect(a).toEqual({ kind: "noTakers", reason: "price" });
  });

  it("no org in his region is a noBuyer refusal; an org that would not start him still answers", () => {
    expect(answer(ceiling, worldWith(0, 0))).toEqual({ kind: "noTakers", reason: "noBuyer" });
    expect(answer(ceiling, worldWith(0, 3)).kind).toBe("offer");
  });
});

describe("tradeAnswerDayFor and tradeCreditFor", () => {
  it("the answer day lands in the delay range and never past the close", () => {
    const [lo, hi] = T.answerDays;
    for (let day = W1; day < CLOSE1; day++) {
      for (let k = 0; k < 10; k++) {
        const ctx = { careerSeed: SEED + k, seasonIndex: SEASON, day, windowIdx: 1 as const, giveId: "g", takeId: `t${k}` };
        const a = tradeAnswerDayFor(ctx);
        expect(a).toBeGreaterThanOrEqual(Math.min(day + lo, CLOSE1));
        expect(a).toBeLessThanOrEqual(Math.min(day + hi, CLOSE1));
        expect(a).toBe(tradeAnswerDayFor(ctx));
      }
    }
  });

  it("the credit stays in its band and is stable per window", () => {
    for (const p of [player(), youngTalent()]) {
      for (let seed = 1; seed <= 50; seed++) {
        const input = valueInputOf(p, seed, SEASON);
        const base = marketValueFor(input) * (1 + T.premiumShare * (bidPremiumFor(input) - 1));
        const ctx = { player: p, takeId: "t", careerSeed: seed, seasonIndex: SEASON, windowIdx: 1, day: W1 };
        const c = tradeCreditFor(ctx);
        expect(c).toBeGreaterThanOrEqual(base * T.creditRange[0] - Q);
        expect(c).toBeLessThanOrEqual(base * T.creditRange[1]);
        expect(tradeCreditFor(ctx)).toBe(c);
      }
    }
  });
});

describe("tradeVerdictFor", () => {
  const fit = { giveOverall: 80, takeOverall: 80 };

  it("accepts when credit plus cash covers the fee", () => {
    expect(tradeVerdictFor({ credit: 100_000, fee: 100_000, cash: 0, ...fit })).toEqual({ kind: "accept" });
    expect(tradeVerdictFor({ credit: 60_000, fee: 100_000, cash: 40_000, ...fit })).toEqual({ kind: "accept" });
  });

  it("counters a small gap in cash, rounded up so credit + cash covers the fee", () => {
    for (const [credit, fee, cash] of [
      [90_000, 100_000, 0],
      [85_030, 100_000, 1_000],
      [70_001, 100_000, 7],
    ]) {
      const v = tradeVerdictFor({ credit, fee, cash, ...fit });
      expect(v.kind).toBe("counter");
      if (v.kind !== "counter") return;
      expect(v.cash).toBeGreaterThan(cash);
      expect(v.cash % Q).toBe(0);
      expect(credit + v.cash).toBeGreaterThanOrEqual(fee);
      expect(credit + v.cash - fee).toBeLessThan(Q);
    }
  });

  it("rejects a gap beyond counterMaxShare on value", () => {
    const fee = 100_000;
    const credit = fee * (1 - T.counterMaxShare) - 1_000;
    expect(tradeVerdictFor({ credit, fee, cash: 0, ...fit })).toEqual({ kind: "reject", reason: "value" });
  });

  it("rejects a player too far below the one it gives up on fit, even when the money is there", () => {
    const v = tradeVerdictFor({ credit: 500_000, fee: 100_000, cash: 0, giveOverall: 80 - T.maxDowngrade - 1, takeOverall: 80 });
    expect(v).toEqual({ kind: "reject", reason: "fit" });
    // The edge: exactly maxDowngrade below is allowed.
    expect(tradeVerdictFor({ credit: 500_000, fee: 100_000, cash: 0, giveOverall: 80 - T.maxDowngrade, takeOverall: 80 }).kind).toBe(
      "accept",
    );
  });
});

describe("tradeOutlookFor", () => {
  const p = player();
  const base = { player: p, careerSeed: SEED, seasonIndex: SEASON, day: W1 };
  const mid = (T.creditRange[0] + T.creditRange[1]) / 2;
  const input = valueInputOf(p, SEED, SEASON);
  const midCredit = marketValueFor(input) * (1 + T.premiumShare * (bidPremiumFor(input) - 1)) * mid;

  it("likely, close, unlikely and noFit", () => {
    expect(tradeOutlookFor({ ...base, fee: midCredit * 0.5, cash: 0, takeOverall: p.overall })).toBe("likely");
    expect(tradeOutlookFor({ ...base, fee: midCredit * 1.2, cash: 0, takeOverall: p.overall })).toBe("close");
    expect(tradeOutlookFor({ ...base, fee: midCredit * 10, cash: 0, takeOverall: p.overall })).toBe("unlikely");
    expect(tradeOutlookFor({ ...base, fee: midCredit * 0.5, cash: 0, takeOverall: p.overall + T.maxDowngrade + 1 })).toBe(
      "noFit",
    );
  });

  it("cash moves a close read to likely", () => {
    const fee = midCredit * 1.2;
    expect(tradeOutlookFor({ ...base, fee, cash: fee, takeOverall: p.overall })).toBe("likely");
  });
});

describe("short tenure (the anti-flip rule)", () => {
  const L = CAREER_TRANSFER.listing;
  const founder = player();
  const fresh: SquadPlayer = { ...player(), joinedSeason: SEASON, signedDay: 1 };
  const settled: SquadPlayer = { ...player(), joinedSeason: SEASON - 1, signedDay: 1 };

  it("a founder is never short of tenure; a signing is until a full season has passed", () => {
    expect(shortTenure(founder, SEASON, W1)).toBe(false);
    expect(shortTenure(fresh, SEASON, W1)).toBe(true);
    expect(shortTenure(settled, SEASON, 1)).toBe(false);
    expect(shortTenure({ joinedSeason: SEASON - 1, signedDay: W1 }, SEASON, W1 - 1)).toBe(true);
    expect(shortTenure({ joinedSeason: SEASON - 1, signedDay: W1 }, SEASON, W1)).toBe(false);
  });

  it("the listing ceiling and the trade credit carry the discount", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const at = { careerSeed: seed, seasonIndex: SEASON, windowIdx: 1, day: W1 };
      const full = listingCeilingFor({ player: settled, ...at });
      const cut = listingCeilingFor({ player: fresh, ...at });
      // Same id, same window: the same draw, so the ratio is the share (to a rounding step).
      expect(Math.abs(cut - full * L.shortTenureShare)).toBeLessThanOrEqual(CAREER_ECONOMY.roundQuantum);
      expect(listingCeilingFor({ player: founder, ...at })).toBe(full);
      const credit = tradeCreditFor({ player: settled, takeId: "t", ...at });
      const creditCut = tradeCreditFor({ player: fresh, takeId: "t", ...at });
      expect(Math.abs(creditCut - credit * L.shortTenureShare)).toBeLessThanOrEqual(CAREER_ECONOMY.roundQuantum);
    }
  });

  it("a short-tenure player never sells at his market value, whatever he asks", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const value = listingValueOf(fresh, { careerSeed: seed, seasonIndex: SEASON });
      const ceiling = listingCeilingFor({ player: fresh, careerSeed: seed, seasonIndex: SEASON, windowIdx: 1, day: W1 });
      expect(ceiling).toBeLessThan(value);
    }
  });
});
