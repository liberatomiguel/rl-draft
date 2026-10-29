/**
 * Road to Worlds rc.30 — the saveVersion 5 migration of careers started
 * before rc.29 / rc.30 (ROADMAP Etapa 2, A4 + direct-8):
 *  - the world's one-time repair (worldSim.repairLegacyWorld): one roster per
 *    player, one gamertag per player in a region, the bank without real
 *    nicknames — with IDs, the squad, contracts, results and cards untouched;
 *  - a save inside a regional week whose Monday predates rc.30 gets that
 *    week's committed seeding from the commit it already made.
 * The legacy fixtures dress a fresh career down to the pre-rc.29 shape: no
 * name-bank version, Itachi listed by two orgs, founders wearing filler pros'
 * names (the old wizard bank), old rookies with derived names, a signed
 * player still on an AI roster.
 */

import { describe, expect, it } from "vitest";
import { CAREER_QUALIFIER } from "@/config/balance";
import { players } from "@/data";
import { firstDayOfWeek, officialEventDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import type { CareerSave, WorldState } from "@/engine/career/types";
import { repairLegacyWorld } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import {
  advanceDayFlow,
  createCareerSave,
  migrateSaveToV5,
  userIsDirect,
  type CreateCareerInput,
} from "./careerFlow";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const SEED = 7919;
const W = seasonSchedule().find((w) => w.kind === "regional")!.week;

const key = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const REAL = new Set(players.map((p) => key(p.nickname)));

function input(region: Region): CreateCareerInput {
  return {
    identity: {
      orgName: "Repair Check",
      abbrev: "RPR",
      managerName: "Bot",
      country: "BR",
      region,
      crestId: "shield",
      colors: { primary: "#f97316", secondary: "#fde68a" },
      buffType: "consistency",
    },
    difficulty: "normal",
    style: "balanced",
    rosterKey: "balanced",
  };
}

const rostered = (world: WorldState) => Object.values(world.orgs).flatMap((o) => o.playerIds);
const ctxOf = (save: CareerSave, world = save.world) => ({
  careerSeed: save.careerSeed,
  seasonIndex: save.clock.seasonIndex,
  world,
});

/** Per region: a name worn by two different world players (rosters + free agents). */
function nameClashes(save: CareerSave, world: WorldState): string[] {
  const out: string[] = [];
  for (const region of REGIONS) {
    const idsOf = new Map<string, Set<string>>();
    for (const id of [...rostered(world), ...world.freeAgentIds]) {
      const view = playerViewById(id, ctxOf(save, world));
      if (!view || view.region !== region) continue;
      idsOf.set(key(view.name), (idsOf.get(key(view.name)) ?? new Set()).add(id));
    }
    for (const [name, ids] of idsOf) if (ids.size > 1) out.push(`${region} ${name}: ${[...ids].join("/")}`);
  }
  return out;
}

/**
 * A MENA career dressed down to a pre-rc.29 world: the original name bank
 * (fillers wear "Sultan", "Fahad"…), no stored rookie names, Itachi on two
 * EU rosters, six season-0 rookies with derived bank names in free agency
 * (in MENA every bank name is a filler pro's), and the founders wearing
 * three filler pros' names (the old wizard drew from the filler bank).
 */
function legacyCareer(): { save: CareerSave; founderNames: string[] } {
  const save = structuredClone(createCareerSave(input("MENA"), SEED));
  const world = save.world;
  delete world.nameBankVersion;
  delete world.rookieNames;
  // Itachi back on a second roster: the org that does not hold him lists him too.
  const holder = ["fc-barcelona", "vodafone-giants"].find((ref) => world.orgs[ref].playerIds.includes("itachi"))!;
  const other = holder === "fc-barcelona" ? "vodafone-giants" : "fc-barcelona";
  world.freeAgentIds.push(world.orgs[other].playerIds[0]);
  world.orgs[other].playerIds[0] = "itachi";
  for (let n = 0; n < 6; n++) world.freeAgentIds.push(`rook:0:MENA:${n}`);
  // The founders take three MENA filler pros' names.
  const fillers = Object.values(world.orgs)
    .filter((o) => o.region === "MENA" && o.ref.startsWith("fill:"))
    .flatMap((o) => o.playerIds)
    .filter((id) => id.startsWith("fic:"))
    .slice(0, 3);
  const founderNames = fillers.map((id) => playerViewById(id, ctxOf(save))!.name);
  save.squad.forEach((p, i) => {
    if (i < 3) p.name = founderNames[i];
  });
  return { save, founderNames };
}

describe("repairLegacyWorld (rc.30 A4): one roster and one gamertag per player", { timeout: 60_000 }, () => {
  it("the legacy fixture really carries the old defects", () => {
    const { save } = legacyCareer();
    const ids = rostered(save.world);
    expect(new Set(ids).size).toBeLessThan(ids.length); // Itachi twice
    expect(nameClashes(save, save.world).length).toBeGreaterThan(0);
    const generated = [...ids, ...save.world.freeAgentIds]
      .map((id) => playerViewById(id, ctxOf(save)))
      .filter((v) => v && v.kind !== "real");
    expect(generated.some((v) => REAL.has(key(v!.name)))).toBe(true); // the bank's real nicknames
  });

  it("repairs rosters and names; never touches the user's players, real names, refs or development", () => {
    const { save, founderNames } = legacyCareer();
    // A player the user signed but an AI org still lists (the stale second seat).
    const signed = save.world.orgs["sandrock-gaming"].playerIds[0];
    const userSquad = [...save.squad.map((p) => ({ id: p.id, name: p.name })), { id: signed, name: "Signed" }];
    const before = save.world;
    const { world, reseated, renamed } = repairLegacyWorld(before, {
      seasonIndex: 0,
      careerSeed: save.careerSeed,
      userSquad,
    });
    expect(reseated).toBe(2); // Itachi's second seat + the signed player's stale seat
    expect(renamed).toBeGreaterThanOrEqual(3);
    expect(world.nameBankVersion).toBe(2);
    expect(world.version).toBe(before.version + 1);

    // One roster per player; nobody rostered (or the user's) is a free agent.
    const ids = rostered(world);
    expect(new Set(ids).size).toBe(ids.length);
    const fa = new Set(world.freeAgentIds);
    expect(ids.filter((id) => fa.has(id))).toEqual([]);
    expect(ids).not.toContain(signed);
    expect(world.freeAgentIds).not.toContain(signed);
    expect(ids.filter((id) => id === "itachi")).toHaveLength(1);

    // One gamertag per player in a region; none shared with the squad; no real nickname on a generated player.
    expect(nameClashes(save, world)).toEqual([]);
    const squadKeys = new Set(founderNames.map(key));
    for (const id of [...ids, ...world.freeAgentIds]) {
      const view = playerViewById(id, ctxOf(save, world))!;
      if (view.kind !== "real") {
        expect(squadKeys.has(key(view.name)), `${id} ${view.name}`).toBe(false);
        expect(REAL.has(key(view.name)), `${id} ${view.name}`).toBe(false);
      }
    }

    // What must not move: org refs, the seats that were not duplicates, real
    // players' names, development deltas, retirements, the squad itself.
    expect(Object.keys(world.orgs).sort()).toEqual(Object.keys(before.orgs).sort());
    for (const ref of Object.keys(before.orgs)) {
      const changed = before.orgs[ref].playerIds.filter((id, slot) => world.orgs[ref].playerIds[slot] !== id);
      for (const id of changed) expect(["itachi", signed]).toContain(id);
    }
    for (const id of ids) {
      const was = playerViewById(id, ctxOf(save, before));
      if (was?.kind === "real") expect(playerViewById(id, ctxOf(save, world))?.name).toBe(was.name);
    }
    expect(world.overallDelta).toEqual(before.overallDelta);
    expect(world.retiredIds).toEqual(before.retiredIds);
  });

  it("is idempotent, and a world built since rc.29 comes back unchanged", () => {
    const { save } = legacyCareer();
    const ctx = { seasonIndex: 0, careerSeed: save.careerSeed, userSquad: save.squad };
    const once = repairLegacyWorld(save.world, ctx).world;
    const twice = repairLegacyWorld(once, ctx);
    expect(twice).toMatchObject({ reseated: 0, renamed: 0 });
    expect(twice.world).toEqual(once);
    for (const region of REGIONS) {
      const fresh = createCareerSave(input(region), SEED + 1);
      const out = repairLegacyWorld(fresh.world, { seasonIndex: 0, careerSeed: fresh.careerSeed, userSquad: fresh.squad });
      expect(out, region).toMatchObject({ reseated: 0, renamed: 0 });
      expect(out.world, region).toEqual(fresh.world);
    }
  });

  it("a world filler the user signed keeps its squad name after it leaves the squad", () => {
    const { save } = legacyCareer();
    // fic:MENA:37 wears the real nickname "Fahad" in the old bank ("Nimr" in the new).
    const userSquad = [...save.squad, { id: "fic:MENA:37", name: "Fahad" }];
    const { world } = repairLegacyWorld(save.world, { seasonIndex: 0, careerSeed: save.careerSeed, userSquad });
    expect(world.rookieNames?.["fic:MENA:37"]).toBe("Fahad");
    // The founders' ids never resolve in the world: nothing stored for them.
    for (const p of save.squad) expect(world.rookieNames?.[p.id]).toBeUndefined();
  });
});

describe("migrateSaveToV5 (rc.30)", { timeout: 60_000 }, () => {
  it("repairs a legacy world once, says so in one news line, and leaves the career's own records alone", () => {
    const { save } = legacyCareer();
    const legacy = JSON.parse(JSON.stringify({ ...save, saveVersion: 4 })) as CareerSave;
    const up = migrateSaveToV5(legacy)!;
    expect(up.saveVersion).toBe(5);
    expect(up.world.nameBankVersion).toBe(2);
    expect(up.news.filter((n) => n.titleKey === "registryRepair")).toHaveLength(1);
    for (const field of ["squad", "starterIds", "finances", "eventResults", "competition", "coach", "sponsor"] as const) {
      expect(up[field], field).toEqual(save[field]);
    }
    // Gated by saveVersion: a second load is a no-op.
    expect(migrateSaveToV5(up)).toBe(up);
  });

  it("a clean save gets no news line", () => {
    const save = createCareerSave(input("SAM"), SEED);
    const up = migrateSaveToV5(JSON.parse(JSON.stringify({ ...save, saveVersion: 4 })))!;
    expect(up.saveVersion).toBe(5);
    expect(up.news.some((n) => n.titleKey === "registryRepair")).toBe(false);
  });

  it("direct-8: an in-flight regional week keeps the side its pre-rc.30 Monday committed", () => {
    // Monday of the first regional: the starter roster is outside the 8 → Saturday's qualifier.
    let save = createCareerSave(input("SAM"), 55501);
    while (save.clock.day < firstDayOfWeek(W)) save = advanceDayFlow({ ...save, sponsorOffers: null, pendingOffers: [] });
    expect(save.pendingEventDef?.tier).toBe("qualifier");
    // Dressed down to a pre-rc.30 save (a fresh copy each time: the migration upgrades in place).
    const dressDown = (): CareerSave => {
      const legacy = JSON.parse(JSON.stringify(save)) as CareerSave;
      legacy.saveVersion = 4;
      delete legacy.competition.weekSeeding;
      return legacy;
    };
    // …then drifted INTO the 8 (a live read would seat the user).
    const legacy = dressDown();
    legacy.competition.splitPoints.SAM = { ...legacy.competition.splitPoints.SAM, user: 10_000 };
    const up = migrateSaveToV5(legacy)!;
    const committed = up.competition.weekSeeding!;
    expect(committed).toMatchObject({ seasonIndex: 0, week: W, region: "SAM" });
    expect(committed.direct).toHaveLength(CAREER_QUALIFIER.directSlots);
    expect(committed.direct).not.toContain("user");
    expect(committed.rest).toContain("user");
    expect(userIsDirect(up)).toBe(false);
    // The reverse: a direct commit (the regional pending) stays direct after a drift out.
    const direct = dressDown();
    direct.pendingEventDef = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional" && d.region === "SAM")!;
    direct.competition.splitPoints.SAM = {};
    const upDirect = migrateSaveToV5(direct)!;
    expect(upDirect.competition.weekSeeding!.direct).toContain("user");
    expect(upDirect.competition.weekSeeding!.direct).toHaveLength(CAREER_QUALIFIER.directSlots);
    expect(userIsDirect(upDirect)).toBe(true);
  });
});
