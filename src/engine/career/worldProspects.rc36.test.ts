/** POL-04: a depleted market rebuilds its prospect pool every season. */
import { describe, expect, it } from "vitest";
import { CAREER_DEV, CAREER_SEASONS, CAREER_WORLD } from "@/config/balance";
import { fillerPlayerView, isCompetitiveAge, playerViewById, rookieView } from "./development";
import { listingFor } from "./market";
import { agePassAndIntake, buildWorldAtCreation } from "./worldSim";
import type { Region } from "../types";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

describe("rc.36 POL-04: prospects across seasons", () => {
  it("replenishes every region after the existing prospects are signed, and lists the new kids", () => {
    const rule = CAREER_WORLD.seasonFaProspects;
    for (const seed of [9100, 17019]) {
      let world = buildWorldAtCreation(seed);
      // Include a historical intake and the first infinite-era intake.
      for (const seasonIndex of [1, 3, CAREER_SEASONS.length]) {
        world = { ...world, freeAgentIds: [] };
        const before = structuredClone(world);
        const intake = agePassAndIntake(world, seasonIndex, seed, [], seasonIndex >= CAREER_SEASONS.length, []);
        expect(world).toEqual(before);
        expect(agePassAndIntake(world, seasonIndex, seed, [], seasonIndex >= CAREER_SEASONS.length, [])).toEqual(intake);
        world = intake.world;
        const context = { world, seasonIndex, careerSeed: seed };
        const pool = world.freeAgentIds.map((id) => playerViewById(id, context)).filter((v) => v !== null);
        const listed = listingFor({ ...context, squadIds: [], freeAgentsOnly: true }).freeAgents;
        const ids = new Set(listed.map((v) => v.id));
        expect(ids.size).toBe(listed.length);
        for (const region of REGIONS) {
          const prospects = pool.filter((v) => v.region === region && isCompetitiveAge(v.age) && v.potential >= rule.minPotential && v.potential - v.overall >= rule.minRoom);
          expect(prospects.length, region + " S" + seasonIndex).toBeGreaterThanOrEqual(rule.perRegion);
          expect(prospects.every((v) => ids.has(v.id))).toBe(true);
        }
        expect(new Set(intake.rookies.map((v) => v.id)).size).toBe(intake.rookies.length);
        for (const rookie of intake.rookies) expect(world.rookieNames?.[rookie.id]).toBe(rookie.name);
      }
    }
  });

  it("moves a generated player's peak later without raising his potential", () => {
    const settings = CAREER_DEV as unknown as { peakAgeShift: number };
    const shift = settings.peakAgeShift;
    let later = 0;
    try {
      for (const seed of [9100, 17019]) {
        const world = buildWorldAtCreation(seed);
        const context = { world, careerSeed: seed, seasonIndex: 0 };
        for (const region of REGIONS) for (let n = 0; n < 12; n++) {
          settings.peakAgeShift = 0;
          const oldFiller = fillerPlayerView(region, n, context);
          const oldRookie = rookieView(region, 1, n, seed, false, undefined, 2);
          settings.peakAgeShift = shift;
          const filler = fillerPlayerView(region, n, context);
          const rookie = rookieView(region, 1, n, seed, false, undefined, 2);
          for (const [oldPlayer, player] of [[oldFiller, filler], [oldRookie, rookie]]) {
            expect(player.potential).toBe(oldPlayer.potential);
            expect(player.overall).toBe(oldPlayer.overall);
            expect(player.peakAge).toBeGreaterThanOrEqual(oldPlayer.peakAge);
            if (player.peakAge > oldPlayer.peakAge) later++;
          }
        }
      }
    } finally {
      settings.peakAgeShift = shift;
    }
    expect(later).toBeGreaterThan(0);
  });
});
