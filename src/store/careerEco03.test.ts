/**
 * Road to Worlds — ECO-03 / ECO-03b (Etapa 2b, R47): the sub contract and the
 * bid-free first window.
 *
 * The lineup slot is separate from the job's price: a player signs (and
 * renews) at his normal value, then the lineup is set; a full squad names who
 * leaves; promotion never renegotiates; every operation moves fee, bonus,
 * wage and slots together or not at all. And no bid of any kind lands for the
 * user's players in the career's first transfer window.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CAREER_CONTRACT, CAREER_NEGOTIATION } from "@/config/balance";
import { CAREER_BEATS, type CareerBeat } from "@/data/career/beats";
import { DAYS_PER_SEASON, firstDayOfWeek, weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import {
  computeSalaryAsk,
  negotiationAccepts,
  payrollProjection,
  quantize,
  severanceFor,
  signableOverallCap,
  weeklyStatement,
} from "@/engine/career/economy";
import { askPackageFor, incomingBidForDay, renewalAskFor, userBidsBlocked } from "@/engine/career/market";
import { renewalTermsFor } from "@/engine/career/renewal";
import type { CareerPlayerView, CareerSave, TransferOffer } from "@/engine/career/types";
import {
  acceptBidFlow,
  advanceDayFlow,
  backerLineOf,
  createCareerSave,
  releasePlayerFlow,
  renewPlayerFlow,
  setStartersFlow,
  signingPlanFor,
  signPlayerFlow,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Sub Org",
    abbrev: "SUB",
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

function makeSave(seed = 47_047, rosterKey: CreateCareerInput["rosterKey"] = "balanced"): CareerSave {
  const save = createCareerSave({ ...INPUT, rosterKey }, seed);
  // Plenty of money: these tests are about slots and prices, not runway.
  save.finances.balance = 400_000;
  return save;
}

/** Signable free agents (under the rep cap), strongest first. */
function freeAgents(save: CareerSave): CareerPlayerView[] {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const cap = signableOverallCap(save.reputation);
  return save.world.freeAgentIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is CareerPlayerView => v !== null && Math.round(v.overall) <= cap)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
}

/** The plain market ask (no slot input) — what any signing must charge. */
function marketAsk(save: CareerSave, view: CareerPlayerView, lengthSeasons: 1 | 2 | 3 = 2) {
  return askPackageFor(view, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons,
  });
}

function signOk(save: CareerSave, id: string, extra: { releaseId?: string } = {}): CareerSave {
  const res = signPlayerFlow(save, id, { lengthSeasons: 2, ...extra });
  expect(res.error).toBeUndefined();
  return res.save;
}

function bidFor(save: CareerSave, playerId: string, fee: number): CareerSave {
  const offer: TransferOffer = {
    id: `bid:test:${playerId}`,
    direction: "out",
    playerId,
    playerName: playerId,
    fee,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: Object.values(save.world.orgs).find((o) => o.region === "SAM")!.ref,
    status: "pending",
    resolveSeason: save.clock.seasonIndex,
    resolveDay: save.clock.day + 7,
    factors: [],
  };
  return { ...structuredClone(save), pendingOffers: [offer] };
}

const ledgerSum = (save: CareerSave) => save.finances.ledger.reduce((s, l) => s + l.amount, 0);
/** Everything a failed operation must leave untouched (bookkeeping aside). */
const moneyAndSlots = (save: CareerSave) =>
  JSON.stringify({
    balance: save.finances.balance,
    ledger: save.finances.ledger,
    squad: save.squad,
    starterIds: save.starterIds,
    freeAgents: save.world.freeAgentIds,
    orgs: save.world.orgs,
  });

// ---------------------------------------------------------------------------
// ECO-03: the price never depends on the slot
// ---------------------------------------------------------------------------

describe("ECO-03 — the slot is separate from the price", () => {
  it("sign with three starters: he joins as the reserve at his normal value (no sub discount)", () => {
    const save = makeSave();
    expect(save.squad).toHaveLength(3);
    const target = freeAgents(save)[0];
    const ask = marketAsk(save, target);
    // The pre-ECO-03 sub price is gone: role is ignored by every pricing path.
    expect(askPackageFor(target, { ...marketCtx(save), role: "sub", lengthSeasons: 2 })).toEqual(ask);
    const plan = signingPlanFor(save, target.id, { lengthSeasons: 2 });
    expect("plan" in plan && plan.plan.slot).toBe("reserve");
    const after = signOk(save, target.id);
    const signed = after.squad.find((p) => p.id === target.id)!;
    expect(signed.role).toBe("sub");
    expect(signed.salaryPerSplit).toBe(ask.salaryPerSplit);
    expect(after.starterIds).toEqual(save.starterIds); // nobody demoted
    expect(after.finances.balance).toBe(save.finances.balance - ask.signingBonus - ask.fee);
    // The old `role: "sub"` argument changes nothing either.
    const legacy = signPlayerFlow(save, target.id, { role: "sub", lengthSeasons: 2 });
    expect(legacy.save.squad.find((p) => p.id === target.id)?.salaryPerSplit).toBe(ask.salaryPerSplit);
  });

  it("sign with a full squad: refused until the user names who leaves; then fee, bonus, severance and slots move together", () => {
    const [first, second] = freeAgents(makeSave());
    let save = signOk(makeSave(), first.id); // 3 starters + 1 reserve = 4
    expect(save.squad).toHaveLength(CAREER_CONTRACT.squadCap);
    const before = moneyAndSlots(save);
    const full = signPlayerFlow(save, second.id, { lengthSeasons: 2 });
    expect(full.error).toBe("squadFull");
    expect(moneyAndSlots(full.save)).toBe(before);

    // The user chooses a STARTER to leave: the new player takes his seat.
    const leaver = save.squad.find((p) => p.id === save.starterIds[1])!;
    const severance = severanceFor(leaver, save.clock.seasonIndex);
    const ask = marketAsk(save, second);
    const ledgerBefore = save.finances.ledger.length;
    save = signOk(save, second.id, { releaseId: leaver.id });
    expect(save.squad.map((p) => p.id)).not.toContain(leaver.id);
    expect(save.world.freeAgentIds).toContain(leaver.id);
    expect(save.starterIds[1]).toBe(second.id);
    expect(save.squad).toHaveLength(CAREER_CONTRACT.squadCap);
    const lines = save.finances.ledger.slice(ledgerBefore);
    expect(lines.map((l) => l.kind)).toEqual(
      ask.fee > 0 ? ["severance", "transferOut", "signingBonus"] : ["severance", "signingBonus"],
    );
    expect(-lines.reduce((s, l) => s + l.amount, 0)).toBe(severance + ask.fee + ask.signingBonus);
  });

  it("naming the reserve as the leaver keeps the starting three and lands the signing on the bench", () => {
    const [first, second] = freeAgents(makeSave());
    const save = signOk(makeSave(), first.id);
    const after = signOk(save, second.id, { releaseId: first.id });
    expect(after.starterIds).toEqual(save.starterIds);
    expect(after.squad.find((p) => p.id === second.id)?.role).toBe("sub");
  });

  it("promote a reserve: no renegotiation, no money moves, both contracts unchanged", () => {
    const target = freeAgents(makeSave())[0];
    const save = signOk(makeSave(), target.id);
    const benched = save.starterIds[0];
    const wages = Object.fromEntries(save.squad.map((p) => [p.id, p.salaryPerSplit]));
    const res = setStartersFlow(save, [target.id, save.starterIds[1], save.starterIds[2]]);
    expect(res.error).toBeUndefined();
    expect(res.save.squad.find((p) => p.id === target.id)?.role).toBe("starter");
    expect(res.save.squad.find((p) => p.id === benched)?.role).toBe("sub");
    expect(Object.fromEntries(res.save.squad.map((p) => [p.id, p.salaryPerSplit]))).toEqual(wages);
    expect(res.save.finances).toEqual(save.finances);
  });

  it("sign and promote the same day: one charge, the signed wage, the new lineup", () => {
    const target = freeAgents(makeSave())[0];
    const save = makeSave();
    const ask = marketAsk(save, target);
    const signed = signOk(save, target.id);
    const promoted = setStartersFlow(signed, [save.starterIds[0], target.id, save.starterIds[2]]).save;
    expect(promoted.clock).toEqual(save.clock);
    expect(promoted.starterIds).toContain(target.id);
    expect(promoted.squad.find((p) => p.id === target.id)?.salaryPerSplit).toBe(ask.salaryPerSplit);
    expect(ledgerSum(promoted) - ledgerSum(save)).toBe(-(ask.fee + ask.signingBonus));
    expect(promoted.finances.balance).toBe(save.finances.balance - ask.fee - ask.signingBonus);
  });

  it("swap the lineup: roles follow the seats, wages and books stay put", () => {
    const target = freeAgents(makeSave())[0];
    const save = signOk(makeSave(), target.id);
    const [a, b, c] = save.starterIds;
    const swapped = setStartersFlow(save, [c, a, target.id]).save;
    expect(swapped.squad.find((p) => p.id === b)?.role).toBe("sub");
    expect(swapped.squad.every((p) => p.salaryPerSplit === save.squad.find((q) => q.id === p.id)!.salaryPerSplit)).toBe(true);
    expect(swapped.finances).toEqual(save.finances);
    // An invalid lineup moves nothing.
    expect(setStartersFlow(swapped, [a, a, b]).error).toBe("invalid");
  });

  it("renew a reserve: priced at his normal value, the same as a starter would ask", () => {
    const target = freeAgents(makeSave())[0];
    const save = signOk(makeSave(), target.id);
    const reserve = save.squad.find((p) => p.id === target.id)!;
    expect(reserve.role).toBe("sub");
    const ctx = {
      rep: save.reputation,
      seasonIndex: save.clock.seasonIndex,
      difficulty: save.difficulty,
      careerSeed: save.careerSeed,
      lengthSeasons: 2 as const,
    };
    const ask = renewalAskFor(reserve, ctx);
    expect(ask).toBe(renewalAskFor({ ...reserve }, ctx)); // stable
    // Same ask the plain salary curve gives with no slot at all.
    expect(ask).toBe(
      computeSalaryAsk({
        overall: reserve.overall,
        age: target.age,
        potential: reserve.potential,
        rep: save.reputation,
        seasonIndex: save.clock.seasonIndex,
        lengthSeasons: 2,
        difficulty: save.difficulty,
        careerSeed: save.careerSeed,
        playerId: reserve.id,
        ambitious: false,
      }),
    );
    const renewed = renewPlayerFlow(save, reserve.id, 2);
    expect(renewed.error).toBeUndefined();
    expect(renewed.save.squad.find((p) => p.id === reserve.id)?.salaryPerSplit).toBe(ask);
  });

  it("an old save's cheap sub contract keeps its wage through promotion and payroll, and reprices only at renewal", () => {
    const target = freeAgents(makeSave())[0];
    const save = signOk(makeSave(), target.id);
    const reserve = save.squad.find((p) => p.id === target.id)!;
    // The pre-rc.31 sub price (×0.4) still sits on this contract.
    reserve.salaryPerSplit = quantize(reserve.salaryPerSplit * 0.4);
    const legacyWage = reserve.salaryPerSplit;
    const promoted = setStartersFlow(save, [reserve.id, save.starterIds[1], save.starterIds[2]]).save;
    expect(promoted.squad.find((p) => p.id === reserve.id)?.salaryPerSplit).toBe(legacyWage);
    // A Monday books the legacy wage, untouched.
    let monday: CareerSave = { ...structuredClone(promoted), pendingEventDef: null, unofficialOffer: null, pendingInsert: null };
    monday.clock.day = firstDayOfWeek(2) - 1;
    monday = advanceDayFlow(monday);
    expect(monday.squad.find((p) => p.id === reserve.id)?.salaryPerSplit).toBe(legacyWage);
    // The renewal reprices toward his normal value and the projection says so.
    // rc.32 (M2, provisional): the raise is capped (renewalTermsFor), so the
    // old cheap deal reprices over renewals, not to the full ask in one step.
    const renewCtx = {
      rep: monday.reputation,
      seasonIndex: monday.clock.seasonIndex,
      difficulty: monday.difficulty,
      careerSeed: monday.careerSeed,
      lengthSeasons: 2 as const,
    };
    const ask = renewalTermsFor(reserve, renewCtx).ask;
    expect(ask).toBeGreaterThan(legacyWage);
    expect(ask).toBeLessThanOrEqual(renewalAskFor(reserve, renewCtx));
    const projection = payrollProjection({
      squadSalaries: monday.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
      coachSalary: null,
      remove: [reserve.id],
      add: [ask],
    });
    expect(projection.after).toBeGreaterThan(projection.now);
    const renewed = renewPlayerFlow(monday, reserve.id, 2).save;
    const statement = weeklyStatement({
      squadSalaries: renewed.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
      coachSalary: null,
      sponsor: null,
      rep: 0,
      gear: renewed.finances.gear,
    });
    expect(statement.payroll).toBe(projection.after);
  });
});

function marketCtx(save: CareerSave) {
  return {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
  };
}

// ---------------------------------------------------------------------------
// ECO-03: sales and failed transfers
// ---------------------------------------------------------------------------

describe("ECO-03 — sales and failed transfers are atomic", () => {
  it("sell a starter WITH a reserve: the reserve takes the seat; fee in, wage out, nothing else moves", () => {
    const target = freeAgents(makeSave())[0];
    const save = bidFor(signOk(makeSave(), target.id), makeSave().starterIds[0], 9_000);
    const sold = acceptBidFlow(save, `bid:test:${save.starterIds[0]}`);
    expect(sold.error).toBeUndefined();
    const after = sold.save;
    expect(after.squad).toHaveLength(3);
    expect(after.squad.every((p) => p.role === "starter")).toBe(true);
    expect(after.starterIds).toContain(target.id);
    expect(after.finances.balance).toBe(save.finances.balance + 9_000);
    const before = payrollProjection({
      squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
      coachSalary: null,
      remove: [save.starterIds[0]],
    });
    const now = payrollProjection({
      squadSalaries: after.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
      coachSalary: null,
    });
    expect(now.now).toBe(before.after);
  });

  it("sell a starter WITHOUT a reserve: the seat stays open (rc.33 RTW-05: the next event waits for a third player) — nobody else moves", () => {
    const save = bidFor(makeSave(), makeSave().starterIds[2], 7_500);
    const seller = save.starterIds[2];
    const sold = acceptBidFlow(save, `bid:test:${seller}`).save;
    expect(sold.squad).toHaveLength(2);
    expect(sold.starterIds.filter(Boolean)).toHaveLength(2);
    expect(sold.squad.every((p) => p.role === "starter")).toBe(true);
    expect(sold.finances.balance).toBe(save.finances.balance + 7_500);
    // The open seat takes the next signing straight into the lineup.
    const target = freeAgents(sold)[0];
    const plan = signingPlanFor(sold, target.id, { lengthSeasons: 2 });
    expect("plan" in plan && plan.plan.slot).toBe("starter");
    expect(signOk(sold, target.id).starterIds).toContain(target.id);
  });

  it("a bid for a player who already left cannot 'complete': refused, dropped, nothing moves", () => {
    const seller = makeSave().starterIds[1];
    const withBid = bidFor(makeSave(), seller, 6_000);
    // Releasing him drops his pending bid with him.
    const released = releasePlayerFlow(withBid, seller).save;
    expect(released.pendingOffers).toEqual([]);
    // A stale bid (e.g. an old save) is refused and removed, money untouched.
    const stale = { ...structuredClone(released), pendingOffers: withBid.pendingOffers };
    const res = acceptBidFlow(stale, `bid:test:${seller}`);
    expect(res.error).toBe("unknown");
    expect(res.save.pendingOffers).toEqual([]);
    expect(moneyAndSlots(res.save)).toBe(moneyAndSlots(stale));
  });

  it("accepting a bid settles every pending bid for that player (as a release does); other players' bids stay", () => {
    const save = makeSave();
    const [seller, other] = save.starterIds;
    const bid = (id: string, playerId: string, fee: number, blockbuster = false): TransferOffer => ({
      ...bidFor(save, playerId, fee).pendingOffers[0],
      id,
      ...(blockbuster ? { blockbuster: true } : {}),
    });
    // A Blockbuster beat bid can sit next to a daily bid for the same player.
    const withBids = {
      ...structuredClone(save),
      pendingOffers: [bid("bid:a", seller, 9_000), bid("bid:b", seller, 15_000, true), bid("bid:c", other, 7_000)],
    };
    const sold = acceptBidFlow(withBids, "bid:a");
    expect(sold.error).toBeUndefined();
    expect(sold.save.squad.some((p) => p.id === seller)).toBe(false);
    expect(sold.save.pendingOffers.map((o) => o.id)).toEqual(["bid:c"]);
    expect(sold.save.finances.balance).toBe(save.finances.balance + 9_000);
  });

  it("a failed transfer leaves money and squad untouched (funds, loan lock, rejected counter, bad leaver)", () => {
    const target = freeAgents(makeSave())[0];
    const save = makeSave();
    const ask = marketAsk(save, target);
    // Funds: one dollar short of the floor (rc.32: the Backer's line on this wage bill).
    const broke = structuredClone(save);
    broke.finances.balance = backerLineOf(broke).floor + ask.fee + ask.signingBonus - 1;
    const r1 = signPlayerFlow(broke, target.id, { lengthSeasons: 2 });
    expect(r1.error).toBe("funds");
    expect(moneyAndSlots(r1.save)).toBe(moneyAndSlots(broke));
    // An unknown leaver.
    const r2 = signPlayerFlow(save, target.id, { lengthSeasons: 2, releaseId: "nobody" });
    expect(r2.error).toBe("invalid");
    expect(moneyAndSlots(r2.save)).toBe(moneyAndSlots(save));
    // A rejected counter: only the hardened tries move.
    const counter = rejectedCounter(save, target, ask.salaryPerSplit);
    const r3 = signPlayerFlow(save, target.id, { lengthSeasons: 2, offeredSalary: counter });
    expect(r3.error).toBe("negotiationRejected");
    expect(moneyAndSlots(r3.save)).toBe(moneyAndSlots(save));
    expect(Object.values(r3.save.negotiationTries)).toEqual([1]);
    // A full squad + a leaver whose severance breaks the floor: nothing moves.
    const full = signOk(save, target.id);
    const other = freeAgents(full)[0];
    const tight = structuredClone(full);
    const otherAsk = marketAsk(tight, other);
    const leaver = tight.squad[0];
    tight.finances.balance =
      backerLineOf(tight).floor + otherAsk.fee + otherAsk.signingBonus + severanceFor(leaver, 0) - 1;
    const r4 = signPlayerFlow(tight, other.id, { lengthSeasons: 2, releaseId: leaver.id });
    expect(r4.error).toBe("funds");
    expect(moneyAndSlots(r4.save)).toBe(moneyAndSlots(tight));
  });
});

/** An offer at/above the insult floor that the hidden reserve rejects (deterministic). */
function rejectedCounter(save: CareerSave, view: CareerPlayerView, ask: number): number {
  const windowKey = `w${windowIndexOf(weekOfDay(save.clock.day))}`;
  for (let offered = quantize(ask * CAREER_NEGOTIATION.minOfferFactor); offered < ask; offered += 50) {
    const ok = negotiationAccepts({
      careerSeed: save.careerSeed,
      playerId: view.id,
      seasonIndex: save.clock.seasonIndex,
      windowKey,
      offered,
      ask,
      rejects: 0,
    });
    if (!ok) return offered;
  }
  throw new Error("no rejected counter for this ask");
}

// ---------------------------------------------------------------------------
// ECO-03: refresh mid-negotiation (the real store, persisted and reloaded)
// ---------------------------------------------------------------------------

describe("ECO-03 — refresh mid-negotiation (store reload)", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, String(value)),
    removeItem: (key: string) => void memory.delete(key),
  };
  let store: typeof import("./careerStore").useCareerStore;

  beforeAll(async () => {
    await import("@/lib/analytics");
    vi.stubGlobal("window", { localStorage: storage });
    store = (await import("./careerStore")).useCareerStore;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  async function reload(): Promise<CareerSave> {
    const disk = memory.get(store.persist.getOptions().name!)!;
    store.setState({ slots: [null, null, null], activeSlot: null });
    memory.set(store.persist.getOptions().name!, disk);
    await store.persist.rehydrate();
    return store.getState().slots[store.getState().activeSlot!]!;
  }

  it("a rejected counter survives the reload; the signing then charges exactly once", async () => {
    store.getState().createCareer(0, INPUT, 47_101);
    const fresh = store.getState().slots[0]!;
    const target = freeAgents(fresh)[0];
    const ask = marketAsk(fresh, target);
    const counter = rejectedCounter(fresh, target, ask.salaryPerSplit);
    store.getState().signPlayer(target.id, { lengthSeasons: 2, offeredSalary: counter });
    expect(store.getState().lastError).toBe("negotiationRejected");

    const reloaded = await reload();
    expect(reloaded.finances.balance).toBe(fresh.finances.balance);
    expect(reloaded.squad.map((p) => p.id)).toEqual(fresh.squad.map((p) => p.id));
    expect(Object.values(reloaded.negotiationTries)).toEqual([1]); // no free re-roll by reloading

    store.getState().signPlayer(target.id, { lengthSeasons: 2 });
    expect(store.getState().lastError).toBeNull();
    const signed = await reload();
    expect(signed.squad.filter((p) => p.id === target.id)).toHaveLength(1);
    expect(signed.finances.balance).toBe(fresh.finances.balance - ask.fee - ask.signingBonus);
    // A second tap after the refresh is refused: no double charge.
    store.getState().signPlayer(target.id, { lengthSeasons: 2 });
    expect(store.getState().lastError).toBe("alreadySigned");
    const again = await reload();
    expect(again.finances.balance).toBe(signed.finances.balance);
    expect(again.finances.ledger.filter((l) => l.kind === "signingBonus")).toHaveLength(
      signed.finances.ledger.filter((l) => l.kind === "signingBonus").length,
    );
  });
});

// ---------------------------------------------------------------------------
// ECO-03b: the career's first transfer window is bid-free
// ---------------------------------------------------------------------------

/** Advance a day, clearing whatever blocks the clock (this test follows the bids). */
function step(save: CareerSave): CareerSave {
  const next = advanceDayFlow(save);
  if (next.clock.day !== save.clock.day || next.phase !== "running") return next;
  return advanceDayFlow({ ...structuredClone(next), pendingEventDef: null, pendingInsert: null });
}

const outBids = (save: CareerSave) => save.pendingOffers.filter((o) => o.direction === "out");

describe("ECO-03b — no bids in the career's first window (season 0, windowIdx 0)", () => {
  const seeds = [3, 17, 4_242, 90_001, 123_457, 777_777];

  it("the guard is named and scoped to season 0's preseason window only", () => {
    expect(userBidsBlocked(0, 0)).toBe(true);
    expect(userBidsBlocked(0, 1)).toBe(false);
    expect(userBidsBlocked(1, 0)).toBe(false);
    expect(userBidsBlocked(0, null)).toBe(false);
  });

  it("no AI bid on any day of window 0 of season 0, across seeds and roster shapes (prospects attract bids)", () => {
    for (const seed of seeds) {
      for (const rosterKey of ["prospects", "balanced"] as const) {
        let save = createCareerSave({ ...INPUT, rosterKey }, seed);
        // The engine roll itself refuses every day of the window…
        for (let day = 1; day <= 14; day++) {
          const bid = incomingBidForDay({
            world: save.world,
            squad: save.squad,
            seasonIndex: 0,
            windowIdx: 0,
            day,
            careerSeed: seed,
            rep: save.reputation,
            bidsThisWindow: 0,
            lastBidDay: -99,
            pendingTargetIds: [],
          });
          expect(bid).toBeNull();
        }
        // …and the real day clock never surfaces one.
        while (windowIndexOf(weekOfDay(save.clock.day)) === 0 && save.clock.day < 15) {
          expect(outBids(save)).toEqual([]);
          save = step(save);
        }
        expect(outBids(save)).toEqual([]);
      }
    }
  });

  it("bids arrive as before from the next window on (season 0, window 1)", () => {
    let total = 0;
    for (const seed of seeds) {
      const save = createCareerSave({ ...INPUT, rosterKey: "prospects" }, seed);
      for (let day = firstDayOfWeek(11); day < firstDayOfWeek(13); day++) {
        const bid = incomingBidForDay({
          world: save.world,
          squad: save.squad,
          seasonIndex: 0,
          windowIdx: 1,
          day,
          careerSeed: seed,
          rep: save.reputation,
          bidsThisWindow: 0,
          lastBidDay: -99,
          pendingTargetIds: [],
        });
        if (bid) total += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it("a scripted Blockbuster in the first window is preempted, not turned into a bid; in a later window it bids", () => {
    const save0 = createCareerSave(INPUT, 47_303);
    const target = save0.squad[0].id;
    const toOrg = Object.values(save0.world.orgs).find((o) => o.region === "SAM")!.ref;
    const beat = (id: string, week: number): CareerBeat => ({
      id,
      trigger: { seasonIndex: 0, week },
      requiresPlayerFree: target,
      effect: { forceTransfer: { playerId: target, toOrgRef: toOrg } },
      degradeToOffer: true,
      en: { title: "t", body: "b" },
      pt: { title: "t", body: "b" },
    });
    const early = beat("test-eco03b-w2", 2);
    const later = beat("test-eco03b-w11", 11);
    CAREER_BEATS.push(early, later);
    try {
      let save = save0;
      while (save.clock.day < firstDayOfWeek(2) + 1) save = step(save);
      expect(save.firedBeatIds).toContain(early.id);
      expect(outBids(save)).toEqual([]);
      expect(save.news.some((n) => n.titleKey === "beatPreempted" && n.beatId === early.id)).toBe(true);
      expect(save.squad.some((p) => p.id === target)).toBe(true);
      // Window 1 (W11): the same kind of beat degrades into a Blockbuster bid as before.
      const w11 = { ...structuredClone(save), pendingEventDef: null, pendingInsert: null, unofficialOffer: null };
      w11.clock.day = firstDayOfWeek(11) - 1;
      const after = step(w11);
      expect(after.pendingOffers.some((o) => o.id === `bid:${later.id}` && o.blockbuster)).toBe(true);
    } finally {
      CAREER_BEATS.splice(CAREER_BEATS.indexOf(early), 1);
      CAREER_BEATS.splice(CAREER_BEATS.indexOf(later), 1);
    }
    expect(DAYS_PER_SEASON).toBeGreaterThan(firstDayOfWeek(12));
  });
});
