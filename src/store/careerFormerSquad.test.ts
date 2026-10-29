/**
 * Road to Worlds — a founder who leaves the squad stays in the world (rc.32,
 * the integration review's P2).
 *
 * The founding roster's ids are "fic:{region}:starterN": no world generator
 * resolves them. Before rc.32 a founder sold to an AI org (an accepted bid
 * since rc.31; rc.32's restructurings and listings made it common) vanished,
 * and the buyer's roster held an id that never resolved, so the buyer fielded
 * a stand-in. Now his record is kept (WorldState.formerSquad): the buyer
 * fields him, a released or expired founder is a free agent like any other.
 */

import { describe, expect, it } from "vitest";
import { playerViewById } from "@/engine/career/development";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { orgTeamFor } from "@/engine/career/worldSim";
import { acceptBidFlow, createCareerSave, releasePlayerFlow, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Former Org",
    abbrev: "FRM",
    managerName: "Bot",
    country: "DE",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

const viewOf = (save: CareerSave, id: string) =>
  playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world });

function founderSave(): { save: CareerSave; founderId: string } {
  const save = createCareerSave(INPUT, 73_101);
  save.finances.balance = 100_000;
  const founderId = save.squad[0].id;
  expect(founderId).toMatch(/^fic:EU:starter\d+$/);
  expect(viewOf(save, founderId)).toBeNull(); // in the squad, the world never knew him
  return { save, founderId };
}

describe("rc.32 — a founder who leaves the squad stays in the world", () => {
  it("sold to an AI org: the buyer fields HIM (name, overall), not a stand-in", () => {
    const { save, founderId } = founderSave();
    const founder = save.squad[0];
    const buyer = Object.values(save.world.orgs).find((o) => o.region === "EU" && o.playerIds.length === 3)!;
    const offer: TransferOffer = {
      id: "bid:test:founder",
      direction: "out",
      playerId: founderId,
      playerName: founder.name,
      fee: 20_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: buyer.ref,
      status: "pending",
      resolveSeason: save.clock.seasonIndex,
      resolveDay: save.clock.day + 7,
      factors: [],
    };
    const sold = acceptBidFlow({ ...structuredClone(save), pendingOffers: [offer] }, offer.id);
    expect(sold.error).toBeUndefined();
    const after = sold.save;
    expect(after.squad.some((p) => p.id === founderId)).toBe(false);
    expect(after.world.orgs[buyer.ref].playerIds).toContain(founderId);
    const view = viewOf(after, founderId)!;
    expect(view).not.toBeNull();
    expect(view.name).toBe(founder.name);
    expect(view.overall).toBe(founder.overall);
    expect(view.region).toBe("EU");
    // Every id on the buyer's roster resolves: no stand-in fills his seat.
    for (const id of after.world.orgs[buyer.ref].playerIds) expect(viewOf(after, id), id).not.toBeNull();
    const team = orgTeamFor(buyer.ref, {
      world: after.world,
      seasonIndex: after.clock.seasonIndex,
      careerSeed: after.careerSeed,
      difficulty: after.difficulty,
    });
    expect(team.playerNames).toContain(founder.name);
  });

  it("released: he is a free agent the Market can list (and sign back)", () => {
    const { save, founderId } = founderSave();
    const name = save.squad[0].name;
    const res = releasePlayerFlow(save, founderId);
    expect(res.error).toBeUndefined();
    expect(res.save.world.freeAgentIds).toContain(founderId);
    expect(viewOf(res.save, founderId)?.name).toBe(name);
  });

  it("an old save (no formerSquad) loads as before: the field is optional", () => {
    const { save } = founderSave();
    expect(save.world.formerSquad).toBeUndefined();
    const legacy = structuredClone(save);
    delete legacy.world.formerSquad;
    expect(viewOf(legacy, legacy.squad[1].id)).toBeNull();
  });
});
