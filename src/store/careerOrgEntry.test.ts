/**
 * DATA-01 — every org enters a career in its RIGHT season, through the REAL
 * rollover (`rolloverToNextSeason`: the aging pass, retirements, rookies, the
 * intake and the anchors — the world a player actually plays in). RTW-01's
 * `worldSim.test.ts` proves the intake function on its own; this extends it to
 * the flow:
 *  - an org enters at a season only with a playable lineup that season
 *    (region-only rosters count; national and easter-egg rosters never), in
 *    that lineup's region, and never before its first career season;
 *  - an org with a lineup that season that is still missing after the
 *    rollover found no filler seat in that region (R31: 16 orgs a region,
 *    fillers only ever decrease);
 *  - once in, an org never leaves the world.
 * Season X orgs are there at creation. `docs/DATA-AUDIT-rc32.md` lists who
 * enters when, and who never finds a seat.
 */
import { describe, expect, it } from "vitest";
import { CAREER_SEASONS } from "@/config/balance";
import { lineups } from "@/data";
import type { CareerSave, WorldState } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { createCareerSave, rolloverToNextSeason, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Entry Test",
    abbrev: "ENT",
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

/** org → career season index → the region of its first playable lineup that season (file order, as the intake reads it). */
const seasonRegion = new Map<string, Map<number, Region>>();
CAREER_SEASONS.forEach((s, index) => {
  for (const l of lineups) {
    if (l.seasonId !== s.seasonId || l.rareSpawn || l.national) continue;
    const bySeason = seasonRegion.get(l.orgId) ?? new Map<number, Region>();
    if (!bySeason.has(index)) bySeason.set(index, l.region);
    seasonRegion.set(l.orgId, bySeason);
  }
});
const firstSeason = (org: string) => Math.min(...(seasonRegion.get(org)?.keys() ?? [Infinity]));

const realRefs = (w: WorldState) => Object.keys(w.orgs).filter((ref) => !ref.startsWith("fill:"));
const fillersIn = (w: WorldState, region: Region) =>
  Object.values(w.orgs).filter((o) => o.region === region && o.ref.startsWith("fill:")).length;

describe("DATA-01: each org enters the career in its right season (the real rollover)", () => {
  it("every career season brings orgs in the dataset; Season X holds most of them", () => {
    const perSeason = CAREER_SEASONS.map((_, i) => [...seasonRegion.keys()].filter((org) => firstSeason(org) === i).length);
    expect(perSeason[0]).toBeGreaterThan(40);
    for (const n of perSeason.slice(1)) expect(n).toBeGreaterThan(0);
  });

  it.each([
    [11, "SAM"],
    [90210, "EU"],
  ] as const)("career seed %i (%s): an org enters only with a lineup that season, in its region, never early, never leaves", (seed, region) => {
    let save: CareerSave = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region } }, seed);
    for (const ref of realRefs(save.world)) expect(firstSeason(ref), ref).toBe(0);

    for (let s = 1; s < CAREER_SEASONS.length; s++) {
      const before = new Set(realRefs(save.world));
      save = rolloverToNextSeason(save);
      expect(save.clock.seasonIndex).toBe(s);
      for (const ref of before) expect(save.world.orgs[ref], `${ref} left the world in season ${s}`).toBeDefined();
      for (const ref of realRefs(save.world)) {
        if (before.has(ref)) continue;
        const lineupRegion = seasonRegion.get(ref)?.get(s);
        expect(lineupRegion, `${ref} entered in season ${s} without a lineup that season`).toBeDefined();
        expect(save.world.orgs[ref].region, ref).toBe(lineupRegion);
        expect(firstSeason(ref), ref).toBeLessThanOrEqual(s);
      }
      // A lineup this season but still missing: that region has no filler seat left.
      for (const [ref, bySeason] of seasonRegion) {
        const r = bySeason.get(s);
        if (r === undefined || save.world.orgs[ref]) continue;
        expect(fillersIn(save.world, r), `${ref} (${r}) left out in season ${s} with a seat free`).toBe(0);
      }
    }
  });
});
