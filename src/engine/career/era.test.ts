/**
 * v2.2 ORGMODE-2027 (front ERA, E1/E2): the start era. A founded world is the
 * Season X world it always was; a world built at a later era holds that
 * season's real orgs, completes its regions with returning orgs before
 * fillers, and fills its free-agent pool from the seasons just before it.
 */
import { describe, expect, it } from "vitest";
import { CAREER_ERA, CAREER_SEASONS, CAREER_WORLD } from "@/config/balance";
import { coachById, lineups, playerCardById, playerCards, seasonById, subs } from "@/data";
import { ageOf, deriveBirthYear, playerViewById } from "./development";
import { careerSeasonOf, clampStartEra, LAST_START_ERA, retirementTableOf, startSeasonOf, takeoverStartEraFor } from "./era";
import { buildWorldAtCreation } from "./worldSim";
import type { WorldState } from "./types";

const SEED = 5150;
const REGIONS = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"] as const;

const lastCardOrder = (id: string): number => {
  let last = -1;
  for (const c of playerCards) {
    const l = lineups.find((x) => x.id === c.lineupId);
    if (c.playerId !== id || l?.national) continue;
    last = Math.max(last, seasonById.get(c.seasonId)?.order ?? -1);
  }
  return last;
};

describe("era helpers", () => {
  it("clamps a start era to the buildable range", () => {
    expect(LAST_START_ERA).toBe(CAREER_WORLD.lateIntake.atSeasonIndex);
    expect(clampStartEra(undefined)).toBe(0);
    expect(clampStartEra(-3)).toBe(0);
    expect(clampStartEra(2.7)).toBe(2);
    expect(clampStartEra(99)).toBe(LAST_START_ERA);
    expect(clampStartEra(Number.NaN)).toBe(0);
  });

  it("counts the career season from the start era (absent = 0)", () => {
    expect(startSeasonOf({})).toBe(0);
    expect(careerSeasonOf({ clock: { seasonIndex: 3 } })).toBe(3);
    expect(careerSeasonOf({ startSeasonIndex: 6, clock: { seasonIndex: 6 } })).toBe(0);
    expect(careerSeasonOf({ startSeasonIndex: 6, clock: { seasonIndex: 8 } })).toBe(2);
    expect(careerSeasonOf({ startSeasonIndex: 6, clock: { seasonIndex: 8 } }, 7)).toBe(1);
  });

  it("a takeover defaults to the last era; ?era=N is read in the staging build only", () => {
    const def = clampStartEra(CAREER_ERA.takeoverDefaultStart);
    expect(def).toBe(LAST_START_ERA);
    expect(takeoverStartEraFor("?era=2", false)).toBe(def);
    expect(takeoverStartEraFor("?era=2", true)).toBe(2);
    expect(takeoverStartEraFor("?era=0", true)).toBe(0);
    expect(takeoverStartEraFor("?era=12", true)).toBe(LAST_START_ERA);
    expect(takeoverStartEraFor("?era=x", true)).toBe(def);
    expect(takeoverStartEraFor("", true)).toBe(def);
  });
});

describe("buildWorldAtCreation at an era", () => {
  it("start 0 is the Season X world, unchanged", () => {
    expect(buildWorldAtCreation(SEED, 0)).toEqual(buildWorldAtCreation(SEED));
    expect(buildWorldAtCreation(SEED).eraStart).toBeUndefined();
  });

  for (const era of [1, 3, LAST_START_ERA]) {
    describe(`era ${era}`, () => {
      const world: WorldState = buildWorldAtCreation(SEED, era);
      const ctx = { careerSeed: SEED, seasonIndex: era, world };
      const seats = Object.values(world.orgs).flatMap((o) => o.playerIds);

      it("records the era, fills every region, seats nobody twice", () => {
        expect(world.eraStart).toBe(era);
        for (const r of REGIONS) {
          expect(Object.values(world.orgs).filter((o) => o.region === r).length).toBeGreaterThanOrEqual(CAREER_WORLD.minOrgsPerRegion);
        }
        expect(new Set(seats).size).toBe(seats.length);
        for (const id of world.freeAgentIds) expect(seats).not.toContain(id);
        for (const id of seats) expect(playerViewById(id, ctx), id).not.toBeNull();
        for (const id of world.freeAgentIds) expect(playerViewById(id, ctx), id).not.toBeNull();
      });

      it("every org of the era's lineups is in the world; returning orgs come from the look-back seasons", () => {
        const seasonId = era < CAREER_SEASONS.length ? CAREER_SEASONS[era].seasonId : CAREER_WORLD.lateIntake.seasonId;
        for (const l of lineups) {
          if (l.seasonId === seasonId && !l.rareSpawn && !l.national) expect(world.orgs[l.orgId], l.orgId).toBeDefined();
        }
        for (const org of Object.values(world.orgs)) {
          if (org.returningFrom === undefined) continue;
          expect(org.returningFrom).toBeGreaterThanOrEqual(era - CAREER_ERA.returningOrgSeasons);
          expect(org.returningFrom).toBeLessThan(era);
          const last = CAREER_SEASONS[org.returningFrom].seasonId;
          expect(lineups.some((l) => l.orgId === org.ref && l.seasonId === last && !l.national)).toBe(true);
        }
      });

      it("returning orgs come before fillers: a region with a filler has no returning org left out", () => {
        for (const r of REGIONS) {
          const orgs = Object.values(world.orgs).filter((o) => o.region === r);
          if (!orgs.some((o) => o.ref.startsWith("fill:"))) continue;
          // An org's newest look-back lineup decides its region (an org may have moved).
          const lookBack = new Set<string>();
          const placed = new Set<string>();
          for (let back = 1; back <= CAREER_ERA.returningOrgSeasons; back++) {
            const s = CAREER_SEASONS[era - back];
            if (!s) continue;
            for (const l of lineups) {
              if (l.seasonId !== s.seasonId || l.rareSpawn || l.national || placed.has(l.orgId)) continue;
              placed.add(l.orgId);
              if (l.region === r) lookBack.add(l.orgId);
            }
          }
          // Every look-back org of the region is in the world (here or, relocated, in another region).
          for (const ref of lookBack) expect(world.orgs[ref], `${r} ${ref}`).toBeDefined();
        }
      });

      it("real free agents: last club card inside the window, nobody past the retirement window, no start-era coach", () => {
        const oldest = era - CAREER_ERA.freeAgentSeasons;
        const oldestOrder = CAREER_SEASONS[Math.max(0, oldest)].order;
        const maxAge = retirementTableOf(world).retireMaxAge;
        const seasonId = era < CAREER_SEASONS.length ? CAREER_SEASONS[era].seasonId : CAREER_WORLD.lateIntake.seasonId;
        const coaches = new Set(lineups.filter((l) => l.seasonId === seasonId && l.coachId).map((l) => coachById.get(l.coachId!)?.personId));
        const windowSubs = new Set<string>();
        for (let back = 1; back <= CAREER_ERA.freeAgentSeasons; back++) {
          const s = CAREER_SEASONS[era - back];
          if (s) for (const sub of subs) if (sub.seasonId === s.seasonId) windowSubs.add(sub.personId);
        }
        for (const id of world.freeAgentIds) {
          if (id.startsWith("fic:") || id.startsWith("rook:")) continue;
          if (!windowSubs.has(id)) expect(lastCardOrder(id), id).toBeGreaterThanOrEqual(oldestOrder);
          expect(ageOf(deriveBirthYear(id, SEED), era), id).toBeLessThanOrEqual(maxAge);
          expect(coaches.has(id), id).toBe(false);
        }
      });
    });
  }

  it("at the last era NA, EU, SAM and MENA need no filler org (the spec's expectation)", () => {
    const world = buildWorldAtCreation(SEED, LAST_START_ERA);
    for (const r of ["NA", "EU", "SAM", "MENA"]) {
      expect(Object.values(world.orgs).filter((o) => o.region === r && o.ref.startsWith("fill:")).length, r).toBe(0);
    }
  });

  it("a filler met at a later era is his base age there", () => {
    const at0 = buildWorldAtCreation(SEED);
    const at6 = buildWorldAtCreation(SEED, LAST_START_ERA);
    const id = Object.values(at0.orgs).find((o) => o.ref.startsWith("fill:SSA"))!.playerIds[0];
    expect(playerViewById(id, { careerSeed: SEED, seasonIndex: LAST_START_ERA, world: at6 })!.age).toBe(
      playerViewById(id, { careerSeed: SEED, seasonIndex: 0, world: at0 })!.age,
    );
  });

  it("is deterministic per seed", () => {
    expect(buildWorldAtCreation(SEED, LAST_START_ERA)).toEqual(buildWorldAtCreation(SEED, LAST_START_ERA));
    // a card id resolves (guards the dataset shape the build reads)
    expect(playerCardById.size).toBeGreaterThan(0);
  });
});
