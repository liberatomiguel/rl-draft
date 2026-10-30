/**
 * Road to Worlds — rc.35 (front C, Miguel on rc.34): a player who just signed
 * gets no other offer in the same transfer window — no AI bid for a player
 * the user just signed, no user offer for a player an AI org just signed, and
 * no second AI move for him in that window.
 */

import { describe, expect, it } from "vitest";
import { firstDayOfWeek, weekOfDay, windowIndexOf } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import { signableOverallCap } from "@/engine/career/economy";
import { aiWindowMoves, incomingBidForDay, movedThisWindowIds } from "@/engine/career/market";
import type { CareerPlayerView, CareerSave } from "@/engine/career/types";
import { createCareerSave, signPlayerFlow, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Fresh Org",
    abbrev: "FRS",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "prospects",
};

const W1_START = firstDayOfWeek(11);

function windowSave(seed: number): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 2_000_000;
  save.reputation = 100;
  save.clock.day = W1_START;
  // Make room: drop the reserve so the signing needs no release.
  if (save.squad.length >= 4) {
    const sub = save.squad.find((p) => !save.starterIds.includes(p.id));
    save.squad = save.squad.filter((p) => p !== sub);
  }
  return save;
}

function bestFreeAgent(save: CareerSave): CareerPlayerView {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const cap = signableOverallCap(save.reputation);
  return save.world.freeAgentIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is CareerPlayerView => v !== null && v.age >= 16 && Math.round(v.overall) <= cap)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
}

describe("rc.35 — a just-signed player gets no other offer in the same window", () => {
  it("an AI bid never targets a player the user signed in this window (many seeds, every window day)", () => {
    let otherBids = 0;
    for (const seed of [5, 61, 909, 4_242, 31_337, 777_001]) {
      const save = windowSave(seed);
      const fa = bestFreeAgent(save);
      const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
      expect(res.error).toBeUndefined();
      const signed = res.save.squad.find((p) => p.id === fa.id)!;
      expect(signed.signedDay).toBe(W1_START);
      // Make him the only target worth bidding for.
      signed.overall = 92;
      signed.potential = 97;
      for (let day = W1_START; windowIndexOf(weekOfDay(day)) === 1; day++) {
        const bid = incomingBidForDay({
          world: res.save.world,
          squad: res.save.squad,
          seasonIndex: 0,
          windowIdx: 1,
          day,
          careerSeed: seed,
          rep: res.save.reputation,
          bidsThisWindow: 0,
          lastBidDay: -99,
          pendingTargetIds: [],
        });
        if (bid) {
          expect(bid.playerId).not.toBe(fa.id);
          otherBids += 1;
        }
      }
    }
    // The rest of the squad still draws bids.
    expect(otherBids).toBeGreaterThan(0);
  });

  it("a player signed in an earlier window can be bid for again", () => {
    const save = windowSave(909);
    const fa = bestFreeAgent(save);
    const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2 });
    const squad = res.save.squad.filter((p) => p.id === fa.id);
    squad[0].overall = 92;
    let hits = 0;
    for (let day = firstDayOfWeek(21); windowIndexOf(weekOfDay(day)) === 2; day++) {
      const bid = incomingBidForDay({
        world: res.save.world,
        squad,
        seasonIndex: 0,
        windowIdx: 2,
        day,
        careerSeed: 909 + day,
        rep: 100,
        bidsThisWindow: 0,
        lastBidDay: -99,
        pendingTargetIds: [],
      });
      if (bid) hits += 1;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("the user cannot sign a player an AI org signed in this window", () => {
    const save = windowSave(61);
    const org = Object.values(save.world.orgs).find((o) => o.region === "SAM" && o.prestige >= 1)!;
    const pid = org.playerIds[0];
    save.transferLog.unshift({
      id: "t:test",
      seasonIndex: 0,
      day: W1_START,
      playerId: pid,
      playerName: "x",
      fromRef: null,
      toRef: org.ref,
      fee: 0,
      kind: "fa",
      region: "SAM",
    });
    expect(movedThisWindowIds(save.transferLog, 0, 1).has(pid)).toBe(true);
    expect(movedThisWindowIds(save.transferLog, 0, 2).has(pid)).toBe(false);
    expect(signPlayerFlow(save, pid, { lengthSeasons: 2 }).error).toBe("justSigned");
  });

  it("an AI org never moves a player twice in one window", () => {
    for (const seed of [11, 222, 3_333]) {
      const save = createCareerSave(INPUT, seed);
      const ctx = {
        seasonIndex: 0,
        windowIdx: 1,
        week: 11,
        careerSeed: seed,
        userSquadIds: save.squad.map((p) => p.id),
        isPreseason: false,
        infinite: false,
      };
      const first = aiWindowMoves(save.world, ctx);
      const moved = first.transfers.map((t) => t.playerId);
      expect(new Set(moved).size).toBe(moved.length);
      const second = aiWindowMoves(first.world, { ...ctx, week: 12, lockedIds: moved });
      for (const t of second.transfers) expect(moved).not.toContain(t.playerId);
    }
  });
});
