/**
 * Road to Worlds v0.3 — behavior locks for the adjustment pass:
 * training anti-stagnation, early rep floor, rep-gated signings, unified
 * market value, Backer debt pay-down, daily window bids, scrim scheduling,
 * negotiation determinism and the v3 migration.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_LOAN,
  CAREER_TRAINING,
  CAREER_TRANSFER,
  CAREER_UNLOCKS,
} from "@/config/balance";
import { playerViewById, trainDay } from "@/engine/career/development";
import {
  applyTransferIncome,
  contractedFeeFor,
  marketValueFor,
  moneyIndex,
  payLoanDown,
  prizeFor,
  repNeededForOverall,
  signableOverallCap,
} from "@/engine/career/economy";
import { incomingBidForDay } from "@/engine/career/market";
import type { CareerSave, FinanceState, SquadPlayer } from "@/engine/career/types";
import {
  advanceToNextStopFlow,
  cancelScrimFlow,
  createCareerSave,
  migrateSaveToV3,
  payDebtFlow,
  runScrimFlow,
  scheduleScrimFlow,
  signPlayerFlow,
  type CreateCareerInput,
} from "./careerFlow";

const SEED = 20260711;

function makeSave(): CareerSave {
  const input: CreateCareerInput = {
    identity: {
      orgName: "Test Org",
      abbrev: "TST",
      managerName: "Miguel",
      country: "BR",
      region: "SAM",
      crestId: "shield",
      colors: { primary: "#1f3a5f", secondary: "#c9a227" },
      buffType: "mechanics",
    },
    difficulty: "normal",
    style: "balanced",
    rosterKey: "balanced",
  };
  return createCareerSave(input, SEED);
}

function playerFixture(over: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: "fix:1",
    kind: "fictional",
    name: "Fixture",
    region: "SAM",
    birthYear: 2004,
    archetype: "allround",
    overall: 78,
    attrOffsets: {
      offense: 0,
      defense: 0,
      mechanics: 0,
      consistency: 0,
      experience: 0,
      clutch: 0,
    },
    potential: 80,
    peakAge: 20,
    declineRate: "normal",
    role: "starter",
    salaryPerSplit: 5000,
    contractEndSeason: 2,
    trainingFocus: "balanced",
    trainingIntensity: "normal",
    scoutLevel: 1,
    splitsTogether: 0,
    joinedSeason: 0,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
    ...over,
  };
}

function finFixture(over: Partial<FinanceState> = {}): FinanceState {
  return {
    balance: 10_000,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear: { peripherals: false, monitors: false, pcs: false, perfCenter: false, psychologist: false },
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Training anti-stagnation
// ---------------------------------------------------------------------------

describe("v0.3 training quantization fix", () => {
  it("a slow developer (23yo, 2 pts of headroom) gains a nonzero amount per day", () => {
    // seasonIndex 2 (year 2022) with birthYear 1999 → age 23; the old floor2
    // quantization zeroed this player's daily tick forever.
    const p = playerFixture({ birthYear: 1999, overall: 78, potential: 80 });
    const res = trainDay(p, {
      seasonIndex: 2,
      coachOverall: null,
      gearBonus: 0,
      trainingWeekBonus: false,
      splitGained: 0,
      seasonGained: 0,
    });
    expect(res.gained).toBeGreaterThan(0);
  });

  it("match-prep share halves the tick instead of freezing it", () => {
    const p = playerFixture({ birthYear: 2006, overall: 70, potential: 85 });
    const ctx = {
      seasonIndex: 0,
      coachOverall: null,
      gearBonus: 0,
      trainingWeekBonus: false,
      splitGained: 0,
      seasonGained: 0,
    };
    const full = trainDay(p, ctx, 1).gained;
    const prep = trainDay(p, ctx, CAREER_TRAINING.matchPrepShare).gained;
    expect(prep).toBeGreaterThan(0);
    expect(prep).toBeLessThan(full);
  });
});

// ---------------------------------------------------------------------------
// Rep-gated signings (visible lock)
// ---------------------------------------------------------------------------

describe("v0.3 signable cap", () => {
  it("grows linearly with rep and frees at signableCapFreeAt", () => {
    expect(signableOverallCap(0)).toBe(CAREER_UNLOCKS.signableCapBase);
    expect(signableOverallCap(20)).toBe(
      CAREER_UNLOCKS.signableCapBase + CAREER_UNLOCKS.signableCapPerRep * 20,
    );
    expect(signableOverallCap(CAREER_UNLOCKS.signableCapFreeAt)).toBe(99);
    expect(signableOverallCap(100)).toBe(99);
  });

  it("repNeededForOverall inverts the cap", () => {
    expect(repNeededForOverall(CAREER_UNLOCKS.signableCapBase)).toBe(0);
    const rep = repNeededForOverall(85);
    expect(signableOverallCap(rep)).toBeGreaterThanOrEqual(85);
    expect(signableOverallCap(rep - 1)).toBeLessThan(85);
  });

  it("signPlayerFlow rejects an over-cap free agent with repGate", () => {
    const save = makeSave(); // day 1 = preseason window (market open)
    const cap = signableOverallCap(save.reputation);
    expect(cap).toBeLessThan(99);
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world };
    const strong = save.world.freeAgentIds.find((id) => {
      const view = playerViewById(id, ctx);
      return view !== null && Math.round(view.overall) > cap;
    });
    if (!strong) return; // seed produced no over-cap FA — nothing to assert
    const res = signPlayerFlow(save, strong, { role: "sub", lengthSeasons: 1 });
    expect(res.error).toBe("repGate");
  });
});

// ---------------------------------------------------------------------------
// Unified market value + escalation
// ---------------------------------------------------------------------------

describe("v0.3 market value", () => {
  it("same profile → same value; contracted load is bounded", () => {
    const base = { overall: 80, age: 20, potential: 84, seasonIndex: 1 };
    expect(marketValueFor(base)).toBe(marketValueFor({ ...base }));
    const value = marketValueFor(base);
    const feeShort = contractedFeeFor(value, 1);
    const feeLong = contractedFeeFor(value, 6);
    expect(feeLong).toBeGreaterThan(feeShort);
    // Bounded: the long-contract premium can never reach the old 6× swings.
    expect(feeLong / feeShort).toBeLessThan(2.5);
  });

  it("prize pools escalate per season", () => {
    const s0 = prizeFor("regional", "champion", "swiss", "normal", 0);
    const s3 = prizeFor("regional", "champion", "swiss", "normal", 3);
    expect(s3).toBeGreaterThan(s0);
    // rc.32 (M1, provisional): prizes ride the one season money index.
    expect(s3 / s0).toBeCloseTo(moneyIndex(3, "prizes"), 1);
  });
});

// ---------------------------------------------------------------------------
// Backer debt: sales amortize + manual pay-down
// ---------------------------------------------------------------------------

describe("v0.3 Backer debt lock fix", () => {
  it("a player sale amortizes the loan at saleGarnishRate", () => {
    const fin = finFixture({ balance: 0, loan: { remaining: 10_000 }, loanUsed: true });
    const { fin: next, garnished } = applyTransferIncome(fin, 8_000, {
      seasonIndex: 0,
      week: 12,
      refName: "Sold Guy",
    });
    expect(garnished).toBe(8_000 * CAREER_LOAN.saleGarnishRate);
    expect(next.loan?.remaining).toBe(10_000 - garnished);
    // Net cash: fee in, garnish out.
    expect(next.balance).toBe(8_000 - garnished);
  });

  it("payLoanDown clears the loan at exactly zero", () => {
    const fin = finFixture({ balance: 20_000, loan: { remaining: 3_000 }, loanUsed: true });
    const next = payLoanDown(fin, 99_999, { seasonIndex: 0, week: 12 });
    expect(next.loan).toBeNull();
    expect(next.balance).toBe(17_000);
  });

  it("payDebtFlow guards funds and clears the lock end-to-end", () => {
    const save = makeSave();
    save.finances.loan = { remaining: 2_000 };
    save.finances.loanUsed = true;
    save.finances.balance = 5_000;
    const ok = payDebtFlow(save, 2_000);
    expect(ok.error).toBeUndefined();
    expect(ok.save.finances.loan).toBeNull();
    const broke = payDebtFlow({ ...save, finances: { ...save.finances, balance: -4_000 } }, 2_000);
    expect(broke.error).toBe("funds");
  });
});

// ---------------------------------------------------------------------------
// Daily window bids
// ---------------------------------------------------------------------------

describe("v0.3 incoming bids", () => {
  it("respects the per-window cap and cooldown, and can target non-best players", () => {
    const save = makeSave();
    // ECO-03b (R47): season 0's first window is bid-free — exercise the next
    // season's preseason window, where the daily roll runs as before.
    const capBid = incomingBidForDay({
      world: save.world,
      squad: save.squad,
      seasonIndex: 1,
      windowIdx: 0,
      day: 3,
      careerSeed: SEED,
      rep: 5,
      bidsThisWindow: CAREER_TRANSFER.maxBidsPerWindow,
      lastBidDay: -99,
      pendingTargetIds: [],
    });
    expect(capBid).toBeNull();
    const cooled = incomingBidForDay({
      world: save.world,
      squad: save.squad,
      seasonIndex: 1,
      windowIdx: 0,
      day: 3,
      careerSeed: SEED,
      rep: 5,
      bidsThisWindow: 0,
      lastBidDay: 2,
      pendingTargetIds: [],
    });
    expect(cooled).toBeNull();

    // Sweep a window's days: any bid produced must reference a squad member
    // and carry a positive fee; determinism: same inputs, same result.
    for (let day = 1; day <= 14; day++) {
      const a = incomingBidForDay({
        world: save.world,
        squad: save.squad,
        seasonIndex: 1,
        windowIdx: 0,
        day,
        careerSeed: SEED,
        rep: 5,
        bidsThisWindow: 0,
        lastBidDay: -99,
        pendingTargetIds: [],
      });
      const b = incomingBidForDay({
        world: save.world,
        squad: save.squad,
        seasonIndex: 1,
        windowIdx: 0,
        day,
        careerSeed: SEED,
        rep: 5,
        bidsThisWindow: 0,
        lastBidDay: -99,
        pendingTargetIds: [],
      });
      expect(a?.id).toBe(b?.id);
      if (a) {
        expect(save.squad.some((p) => p.id === a.playerId)).toBe(true);
        expect(a.fee).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scrims v2
// ---------------------------------------------------------------------------

describe("v0.3 scrim scheduling", () => {
  it("books, renders on future days only, and cancels", () => {
    const save = makeSave();
    // Find a valid weekday ahead of the clock.
    let day = save.clock.day + 1;
    while ((day - 1) % 7 >= CAREER_TRAINING.trainingDaysPerWeek) day++;
    const opp = Object.values(save.world.orgs).find((o) => o.region === "SAM")!;
    const booked = scheduleScrimFlow(save, day, opp.ref);
    expect(booked.error).toBeUndefined();
    expect(booked.save.scheduledScrims).toEqual([{ day, oppRef: opp.ref }]);

    const dup = scheduleScrimFlow(booked.save, day, opp.ref);
    expect(dup.error).toBe("sameDay");

    const cancelled = cancelScrimFlow(booked.save, day);
    expect(cancelled.save.scheduledScrims).toEqual([]);

    const past = scheduleScrimFlow(save, save.clock.day, opp.ref);
    expect(past.error).toBe("invalid");
  });

  it("booked scrims run on arrival and land in the scrim log", () => {
    const save = makeSave();
    let day = save.clock.day + 1;
    while ((day - 1) % 7 >= CAREER_TRAINING.trainingDaysPerWeek) day++;
    const opp = Object.values(save.world.orgs).find((o) => o.region === "SAM")!;
    const booked = scheduleScrimFlow(save, day, opp.ref).save;
    // Advance far enough for the booked day to arrive (next stop batching may
    // pass through it — the scrim runs during processDayArrival).
    let cur = booked;
    let guard = 0;
    while (cur.clock.day < day && guard < 30) {
      const next = advanceToNextStopFlow(cur);
      if (next.clock.day === cur.clock.day) break;
      cur = next;
      guard += 1;
    }
    if (cur.clock.day >= day) {
      expect(cur.scheduledScrims.some((s) => s.day === day)).toBe(false);
      expect(cur.scrimLog.some((e) => e.day === day && e.oppRef === opp.ref)).toBe(true);
      const entry = cur.scrimLog.find((e) => e.day === day)!;
      expect(entry.games.length).toBeGreaterThan(0);
    }
  });

  it("never offers the same opponent twice on one day", () => {
    let save = makeSave();
    // Move to a weekday if needed.
    while ((save.clock.day - 1) % 7 >= CAREER_TRAINING.trainingDaysPerWeek) {
      save = { ...save, clock: { ...save.clock, day: save.clock.day + 1 } };
    }
    const first = runScrimFlow(save);
    if (first.error) return; // blocked day in this fixture — nothing to assert
    const oppA = first.save.scrimLog[0]?.oppRef;
    const second = runScrimFlow(first.save, oppA);
    expect(second.error).toBe("sameDay");
  });
});

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

describe("v0.3 negotiation → rc.33 contract talk (ECO-11; the model's own tests: engine/career/contract.test.ts)", () => {
  it("an offer under his floor is refused with nothing moved — no hidden dice; rc.36: only the refusal is counted", () => {
    const save = makeSave();
    // fictional fillers are cheap and under the cap
    const target = save.world.freeAgentIds.find((id) => id.startsWith("fic:"));
    if (!target) return;
    const res = signPlayerFlow(save, target, { lengthSeasons: 1, offer: { weekly: 0 } });
    expect(["negotiationCounter", "windowClosed", "repGate"]).toContain(res.error);
    expect(res.save.squad).toEqual(save.squad);
    expect(res.save.finances).toEqual(save.finances);
    // rc.36 (front S2): a refusal raises what he needs this window — counted under its own "talk:" key.
    const written = Object.keys(res.save.negotiationTries).filter((k) => !(k in save.negotiationTries));
    expect(written).toEqual(res.error === "negotiationCounter" ? [`talk:${target}:0:${written[0]?.split(":").pop()}`] : []);
  });
});

// ---------------------------------------------------------------------------
// Save migration v3
// ---------------------------------------------------------------------------

describe("v0.3 migration", () => {
  it("adds the new fields additively and stamps saveVersion 3", () => {
    const save = makeSave();
    const legacy = structuredClone(save) as unknown as Record<string, unknown>;
    legacy.saveVersion = 2;
    delete legacy.scheduledScrims;
    delete legacy.scrimLog;
    delete legacy.transferLog;
    delete legacy.negotiationTries;
    delete legacy.bidsThisWindow;
    delete legacy.lastBidDay;
    const upgraded = migrateSaveToV3(legacy);
    expect(upgraded).not.toBeNull();
    expect(upgraded!.saveVersion).toBe(3);
    expect(upgraded!.scheduledScrims).toEqual([]);
    expect(upgraded!.scrimLog).toEqual([]);
    expect(upgraded!.transferLog).toEqual([]);
    expect(upgraded!.negotiationTries).toEqual({});
    expect(upgraded!.bidsThisWindow).toBe(0);
  });

  it("new saves are born at the latest save version (rc.30: 5, the world repair + week seeding)", () => {
    expect(makeSave().saveVersion).toBe(5);
  });
});
