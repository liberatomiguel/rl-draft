/**
 * Road to Worlds — rc.37 integration: the joins between the fronts.
 *
 *  - F2's emergency sale honours F1's resale lock (`market.resaleLocked`: the
 *    signing window AND the next one), not rc.35's same-window lock, so going
 *    red on purpose never reopens a fresh signing for resale.
 *  - F2's emergency offer is priced on F1's one valuation (`valueInputOf`, the
 *    reach gap included), the price every other bid and buy quotes.
 */

import { describe, expect, it } from "vitest";
import { CAREER_EMERGENCY_SALE } from "@/config/balance";
import { firstDayOfWeek, weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import { growthModelOf } from "@/engine/career/development";
import { marketValueFor } from "@/engine/career/economy";
import { resaleLocked, valueInputOf } from "@/engine/career/market";
import type { CareerSave } from "@/engine/career/types";
import { createCareerSave, processDayArrival, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Integration Org",
    abbrev: "INT",
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

/** The first mid-season window week (window 1). */
const WINDOW1_WEEK = Array.from({ length: 32 }, (_, i) => i + 1).find((w) => windowIndexOf(w) === 1)!;
/** The preseason window's first day (window 0): the signing day the lock counts from. */
const PRESEASON_DAY = 1;

function arrive(save: CareerSave): CareerSave {
  return processDayArrival({ ...save, clock: { ...save.clock, day: save.clock.day + 1 } });
}

/** A red save on the quiet Sunday before window 1; `signedIdx` squad slots carry a preseason signing. */
function redBeforeWindow1(seed: number, signedIdx: number[]): CareerSave {
  const save = structuredClone(createCareerSave(INPUT, seed));
  save.clock.day = firstDayOfWeek(WINDOW1_WEEK) - 1;
  save.pendingEventDef = null;
  save.unofficialOffer = null;
  save.pendingInsert = null;
  save.activeEvent = null;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  save.moneyNotices = [];
  save.prefs.autoEnterUnofficials = false;
  save.finances.balance = -100;
  for (const i of signedIdx) {
    save.squad[i].joinedSeason = 0;
    save.squad[i].signedDay = PRESEASON_DAY;
  }
  return save;
}

type Offer = CareerSave["pendingOffers"][number];

/**
 * Every emergency offer that arrives over window 1 (both weeks), the clock
 * day by day, each with the save of the day it arrived (the player's numbers
 * that day priced it). Nothing is accepted or declined: the cooldown and the
 * one-at-a-time rule stand.
 */
function emergencyOffersOverWindow1(save: CareerSave): { offers: Offer[]; arrivals: { offer: Offer; on: CareerSave }[] } {
  let s = save;
  const seen = new Map<string, { offer: Offer; on: CareerSave }>();
  while (true) {
    const next = arrive(s);
    if (windowIndexOf(weekOfDay(next.clock.day)) !== 1) break;
    s = next;
    for (const o of s.pendingOffers) if (o.emergency && !seen.has(o.id)) seen.set(o.id, { offer: o, on: s });
  }
  const arrivals = [...seen.values()];
  return { offers: arrivals.map((a) => a.offer), arrivals };
}

describe("rc.37 integration — F2's emergency sale on F1's resale lock and valuation", () => {
  it("a player signed in the previous window is still locked: no emergency offer targets him", () => {
    // The precondition the old rc.35 lock missed: signed in window 0, window 1 is the NEXT one.
    const probe = redBeforeWindow1(91_001, [0]);
    expect(resaleLocked(probe.squad[0], 0, firstDayOfWeek(WINDOW1_WEEK))).toBe(true);
    for (const seed of [91_001, 91_002, 91_003, 91_004]) {
      const save = redBeforeWindow1(seed, [0, 1]);
      const locked = new Set([save.squad[0].id, save.squad[1].id]);
      const { offers } = emergencyOffersOverWindow1(save);
      for (const o of offers) expect(locked.has(o.playerId)).toBe(false);
    }
  });

  it("a fully locked squad gets no emergency offer in the next window; the same squad unlocked does", () => {
    let unlockedOffers = 0;
    for (const seed of [91_011, 91_012, 91_013]) {
      const all = redBeforeWindow1(seed, [0, 1, 2]);
      const extra = all.squad.slice(3).map((_, k) => k + 3);
      const fullyLocked = redBeforeWindow1(seed, [0, 1, 2, ...extra]);
      expect(emergencyOffersOverWindow1(fullyLocked).offers).toHaveLength(0);
      unlockedOffers += emergencyOffersOverWindow1(redBeforeWindow1(seed, [])).offers.length;
    }
    // The control proves the window rolls offers at all (dailyChance over two weeks, one per cooldown).
    expect(unlockedOffers).toBeGreaterThan(0);
  });

  it("the emergency fee sits in the discount band of F1's market value (valueInputOf, the career's growth model)", () => {
    let checked = 0;
    for (const seed of [91_021, 91_022, 91_023, 91_024]) {
      const { arrivals } = emergencyOffersOverWindow1(redBeforeWindow1(seed, []));
      for (const { offer: o, on } of arrivals) {
        const p = on.squad.find((x) => x.id === o.playerId)!;
        const value = marketValueFor(valueInputOf(p, on.careerSeed, on.clock.seasonIndex, growthModelOf(on.world)));
        const [lo, hi] = CAREER_EMERGENCY_SALE.feeRange;
        expect(o.fee).toBeGreaterThanOrEqual(lo * value - 50);
        expect(o.fee).toBeLessThanOrEqual(hi * value);
        expect(o.valuePct).toBe(Math.round((o.fee / value) * 100));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
