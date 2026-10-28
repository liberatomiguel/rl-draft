/**
 * Road to Worlds rc.29 (CAR-01) — one gamertag never plays for two teams of a
 * field. The E2E run saw the same name scoring for both sides of a fixture:
 * the local amateur sides drew from the bank of the wizard starters, the
 * filler pros and the rookies; the wizard's starters (and every rookie) in
 * MENA / APAC / SSA wore a filler pro's name; real players who changed teams
 * during Season X sat on two rosters of the season-0 world; and four bank
 * names were real nicknames. Real fields are built through fieldForEvent for
 * fresh careers, and the world is rolled over to check the rookie intake.
 */

import { describe, expect, it } from "vitest";
import { STARTER_NAME_BANK } from "@/data/career/names";
import { officialEventDefsForWeek, qualifierDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import { isLocalRef } from "@/engine/career/localScene";
import { aiWindowMoves } from "@/engine/career/market";
import type { CareerEventDef, CareerSave, WorldState } from "@/engine/career/types";
import {
  agePassAndIntake,
  buildWorldAtCreation,
  fieldForEvent,
  realOrgIntake,
  starterRosterOffers,
} from "@/engine/career/worldSim";
import type { Region, TournamentTeam } from "@/engine/types";
import { createCareerSave, userTeamForEvent, type CreateCareerInput } from "./careerFlow";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const SEEDS = [7919, 15838, 23757, 31676];

const key = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function input(region: Region): CreateCareerInput {
  return {
    identity: {
      orgName: "Name Check",
      abbrev: "NCK",
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

/** Names that sit on two different teams of one field ("name[teamA|teamB]"). */
function sharedNames(field: TournamentTeam[]): string[] {
  const teamsOf = new Map<string, Set<string>>();
  for (const team of field) {
    for (const name of team.playerNames) {
      const k = key(name);
      teamsOf.set(k, (teamsOf.get(k) ?? new Set()).add(team.id));
    }
  }
  return [...teamsOf.entries()].filter(([, teams]) => teams.size > 1).map(([n, t]) => `${n}[${[...t].join("|")}]`);
}

/** Every field a fresh career can meet in its first regional week and its cups. */
function freshFields(save: CareerSave): Record<string, TournamentTeam[]> {
  const region = save.identity.region;
  const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
  const qualifier = qualifierDefsForWeek(0, W).find((d) => d.region === region)!;
  const regional = officialEventDefsForWeek(0, W).find((d) => d.region === region)!;
  const cup: CareerEventDef = {
    id: "0:4:unofficial",
    tier: "t3",
    region,
    seasonIndex: 0,
    week: 4,
    day: 27,
    name: "Cup",
    format: "single",
  };
  const ctx = (s: CareerSave, def: CareerEventDef) => ({
    world: s.world,
    competition: s.competition,
    userTeam: userTeamForEvent(s, def).team,
    userRegion: region,
    careerSeed: s.careerSeed,
    difficulty: s.difficulty,
    userPrestige: 0,
  });
  const qual = fieldForEvent(qualifier, ctx(save, qualifier)).field;
  // Sunday with Saturday's eight — local sides and the user among them.
  const through = [
    ...qual.filter((t) => isLocalRef(t.id)).slice(0, 4),
    ...qual.filter((t) => !isLocalRef(t.id)),
  ].slice(0, 8);
  const withQualified: CareerSave = {
    ...save,
    competition: {
      ...save.competition,
      qualifiedRefs: {
        ...(save.competition.qualifiedRefs ?? {}),
        [region]: { eventId: regional.id, refs: through.map((t) => (t.isUser ? "user" : t.id)) },
      },
    },
  };
  return {
    qualifier: qual,
    regional: fieldForEvent(regional, ctx(withQualified, regional)).field,
    regionalByPoints: fieldForEvent(regional, ctx(save, regional)).field,
    cup: fieldForEvent(cup, ctx(save, cup)).field,
  };
}

function rosteredIds(world: WorldState): string[] {
  return Object.values(world.orgs).flatMap((o) => o.playerIds);
}

describe("no gamertag on two teams of one field (rc.29 CAR-01)", { timeout: 60_000 }, () => {
  it("fresh careers in every region: qualifier, regional (with and without Saturday's list) and Community Cup", () => {
    const failures: string[] = [];
    let localSides = 0;
    for (const region of REGIONS) {
      for (const seed of SEEDS) {
        const save = createCareerSave(input(region), seed);
        for (const [kind, field] of Object.entries(freshFields(save))) {
          localSides += field.filter((t) => isLocalRef(t.id)).length;
          const shared = sharedNames(field);
          if (shared.length > 0) failures.push(`${region} ${seed} ${kind}: ${shared.join(", ")}`);
        }
      }
    }
    // The fields really do mix the user, orgs and the local scene.
    expect(localSides).toBeGreaterThan(REGIONS.length * SEEDS.length * 4);
    expect(failures.slice(0, 6)).toEqual([]);
  });

  it("the season-0 world puts every player on one roster (Season X's mid-season moves sat on two)", () => {
    // Straight out of the builder: Itachi stays at the first of his Season X
    // orgs (dataset order) and the other seat signed the best regional free agent.
    const built = buildWorldAtCreation(SEEDS[0]);
    expect(built.orgs["fc-barcelona"].playerIds).toContain("itachi");
    expect(built.orgs["vodafone-giants"].playerIds).not.toContain("itachi");
    expect(built.orgs["vodafone-giants"].playerIds).toHaveLength(3);
    expect(built.nameBankVersion).toBe(2);
    for (const world of [built, createCareerSave(input("SAM"), SEEDS[0]).world]) {
      const ids = rosteredIds(world);
      expect(new Set(ids).size).toBe(ids.length);
      // …and nobody rostered is also a free agent.
      const fa = new Set(world.freeAgentIds);
      expect(ids.filter((id) => fa.has(id))).toEqual([]);
    }
  });

  it("the founding roster draws its own bank: nine distinct names nobody in the world wears", () => {
    for (const region of REGIONS) {
      const save = createCareerSave(input(region), SEEDS[1]);
      const ctx = { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world };
      const worldNames = new Set(
        [...rosteredIds(save.world), ...save.world.freeAgentIds]
          .map((id) => playerViewById(id, ctx)?.name)
          .filter((n): n is string => Boolean(n))
          .map(key),
      );
      const names = starterRosterOffers(region, save.careerSeed).flatMap((o) => o.players.map((p) => p.name));
      expect(new Set(names).size, region).toBe(9);
      for (const name of names) {
        expect(STARTER_NAME_BANK[region], region).toContain(name);
        expect(worldNames.has(key(name)), `${region} ${name}`).toBe(false);
      }
      for (const p of save.squad) expect(STARTER_NAME_BANK[region]).toContain(p.name);
    }
  });
});

/** Three seasons of the world passes a career's rollovers and windows run. */
function rollWorld(save: CareerSave, seasons: number): WorldState {
  let world = save.world;
  const squadIds = save.squad.map((p) => p.id);
  const squadNames = save.squad.map((p) => p.name);
  for (let s = 1; s <= seasons; s++) {
    world = agePassAndIntake(world, s, save.careerSeed, squadIds, false, squadNames).world;
    world = realOrgIntake(world, s).world;
    const moves = { careerSeed: save.careerSeed, userSquadIds: squadIds, infinite: false, seasonIndex: s };
    world = aiWindowMoves(world, { ...moves, windowIdx: 0, week: 1, isPreseason: true }).world;
    world = aiWindowMoves(world, { ...moves, windowIdx: 1, week: 12, isPreseason: false }).world;
  }
  return world;
}

/** Per region: names worn by two different players (rosters + free agents). */
function regionNameClashes(world: WorldState, seasonIndex: number, careerSeed: number): string[] {
  const ctx = { careerSeed, seasonIndex, world };
  const out: string[] = [];
  for (const region of REGIONS) {
    const idsOf = new Map<string, Set<string>>();
    for (const id of [...rosteredIds(world), ...world.freeAgentIds]) {
      const view = playerViewById(id, ctx);
      if (!view || view.region !== region) continue;
      const k = key(view.name);
      idsOf.set(k, (idsOf.get(k) ?? new Set()).add(id));
    }
    for (const [name, ids] of idsOf) if (ids.size > 1) out.push(`${region} ${name}: ${[...ids].join("/")}`);
  }
  return out;
}

describe("the rookie intake picks a free gamertag (rc.29 CAR-01)", { timeout: 60_000 }, () => {
  it("three seasons on, no two players of a region share a name — thin regions included", () => {
    for (const [region, seed] of [
      ["MENA", SEEDS[2]],
      ["SSA", SEEDS[3]],
      ["APAC", SEEDS[0]],
    ] as [Region, number][]) {
      const save = createCareerSave(input(region), seed);
      const world = rollWorld(save, 3);
      expect(regionNameClashes(world, 3, save.careerSeed)).toEqual([]);
      // Every rookie in the world got his name stored at intake…
      const rookies = [...rosteredIds(world), ...world.freeAgentIds].filter((id) => id.startsWith("rook:"));
      expect(rookies.length).toBeGreaterThan(0);
      for (const id of rookies) expect(world.rookieNames?.[id], id).toBeDefined();
      // …never the user's founding names, and retired rookies' entries are gone.
      const squad = new Set(save.squad.map((p) => key(p.name)));
      for (const name of Object.values(world.rookieNames ?? {})) expect(squad.has(key(name))).toBe(false);
      for (const id of world.retiredIds) expect(world.rookieNames?.[id]).toBeUndefined();
    }
  });

  it("an existing career keeps every name it had: no swap, derived rookie names, only new rookies are stored", () => {
    const save = createCareerSave(input("MENA"), SEEDS[0]);
    // A pre-rc.29 world: no name-bank version, no stored rookie names.
    const legacy: WorldState = structuredClone(save.world);
    delete legacy.nameBankVersion;
    const ctx = (world: WorldState, seasonIndex: number) => ({ careerSeed: save.careerSeed, seasonIndex, world });
    // fic:MENA:37 is the filler "Fahad" in an old world and "Nimr" in a new one.
    expect(playerViewById("fic:MENA:37", ctx(legacy, 0))?.name).toBe("Fahad");
    expect(playerViewById("fic:MENA:37", ctx(save.world, 0))?.name).toBe("Nimr");
    // A rookie generated before rc.29 (no entry) keeps the derived bank pick.
    const oldRookie = "rook:1:MENA:0";
    const before = playerViewById(oldRookie, ctx({ ...legacy, freeAgentIds: [...legacy.freeAgentIds, oldRookie] }, 1))?.name;
    expect(before).toBeTruthy();
    const rolled = agePassAndIntake({ ...legacy, freeAgentIds: [...legacy.freeAgentIds, oldRookie] }, 2, save.careerSeed, [], false).world;
    expect(rolled.nameBankVersion).toBeUndefined();
    expect(rolled.rookieNames?.[oldRookie]).toBeUndefined();
    if (!rolled.retiredIds.includes(oldRookie)) {
      expect(playerViewById(oldRookie, ctx(rolled, 2))?.name).toBe(before);
    }
    // The new class (season 2) is stored.
    expect(Object.keys(rolled.rookieNames ?? {}).filter((id) => id.startsWith("rook:2:")).length).toBeGreaterThan(0);
  });
});
