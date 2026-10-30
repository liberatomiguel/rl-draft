/**
 * Road to Worlds — rc.35 front C (Miguel on rc.34): the Prospects headliner,
 * free agents with a real ceiling at creation, and bands that never read
 * below the current overall.
 */

import { describe, expect, it } from "vitest";
import { CAREER_DEV, CAREER_WORLD } from "@/config/balance";
import type { Region } from "../types";
import { playerViewById, scoutedBand } from "./development";
import { buildWorldAtCreation, starterRosterOffers } from "./worldSim";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

describe("rc.35 — the Prospects offer has one headliner above 90", () => {
  it("exactly one prospect above 90, none above the range's top, over many seeds", () => {
    const [, hi] = CAREER_WORLD.prospectHeadliner.potentialRange;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const region of REGIONS) {
        const prospects = starterRosterOffers(region, seed * 7919).find((o) => o.key === "prospects")!.players;
        const above = prospects.filter((p) => p.potential > 90);
        expect(above).toHaveLength(1);
        expect(above[0].potential).toBeLessThanOrEqual(hi);
        // Not a ready star: the offer's overall, years of growth to the ceiling.
        expect(above[0].overall).toBeLessThanOrEqual(68);
        expect(above[0].age).toBeLessThanOrEqual(17);
        seen.add(prospects.indexOf(above[0]));
      }
    }
    // The headliner is not always the same seat.
    expect(seen.size).toBe(3);
  });

  it("the other offers are unchanged in shape (journeymen ≤ 76, balanced ≤ 84)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const offers = starterRosterOffers("EU", seed);
      for (const p of offers.find((o) => o.key === "journeymen")!.players) expect(p.potential).toBeLessThanOrEqual(76);
      for (const p of offers.find((o) => o.key === "balanced")!.players) expect(p.potential).toBeLessThanOrEqual(84);
    }
  });
});

describe("rc.35 — every region's creation pool has free agents with a real ceiling", () => {
  it(`at least ${CAREER_WORLD.creationFaProspects.perRegion} free agents of potential ≥ ${CAREER_WORLD.creationFaProspects.minPotential} per region`, () => {
    const { perRegion, minPotential } = CAREER_WORLD.creationFaProspects;
    for (const seed of [1, 2, 3, 4, 5, 77, 4_242, 90_001]) {
      const world = buildWorldAtCreation(seed);
      const ctx = { careerSeed: seed, seasonIndex: 0, world };
      const views = world.freeAgentIds.map((id) => playerViewById(id, ctx));
      expect(new Set(world.freeAgentIds).size).toBe(world.freeAgentIds.length);
      for (const region of REGIONS) {
        const good = views.filter((v) => v && v.region === region && v.potential >= minPotential);
        expect(good.length, `${region} seed ${seed}`).toBeGreaterThanOrEqual(perRegion);
      }
    }
  });
});

describe("rc.35 — a potential band never reads below the current overall", () => {
  it("model 2, every level, with and without the age arc", () => {
    const model = CAREER_DEV.growthModel;
    for (let i = 0; i < 400; i++) {
      const id = `fic:EU:${i}`;
      const potential = 70 + (i % 25);
      const overall = potential - (i % 5) + 0.3;
      for (const level of [0, 1, 2, 3] as const) {
        for (const arc of [undefined, { peakAge: 20, exactAge: 26 }, { peakAge: 24, exactAge: 17 }]) {
          const band = scoutedBand(potential, overall, level, 99, id, model, { arc });
          expect(band.min).toBeGreaterThanOrEqual(Math.round(overall));
          expect(band.max).toBeGreaterThanOrEqual(band.min);
        }
      }
    }
  });

  it("a 78 at his peak reads 78, never 76–80", () => {
    const band = scoutedBand(80, 78, 0, 5, "fic:SAM:3", CAREER_DEV.growthModel, { arc: { peakAge: 20, exactAge: 27 } });
    expect(band.min).toBeGreaterThanOrEqual(78);
  });
});
