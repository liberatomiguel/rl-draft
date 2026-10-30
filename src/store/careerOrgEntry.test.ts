/**
 * DATA-01 — every org enters a career in its RIGHT season, through the REAL
 * rollover (`rolloverToNextSeason`: the aging pass, retirements, rookies, the
 * intake and the anchors — the world a player actually plays in). RTW-01's
 * `worldSim.test.ts` proves the intake function on its own; this extends it to
 * the flow:
 *  - an org enters at a season only with a playable lineup that season
 *    (region-only rosters count; national and easter-egg rosters never), in
 *    that lineup's region, and never before its first career season;
 *  - rc.33 (RTW-03, Miguel's answer to C-1): EVERY org with a lineup that
 *    season is in the world after the rollover — Karmine Corp included. An
 *    entrant takes a filler's seat, else the seat of an org whose history is
 *    over, else the region grows past 16;
 *  - an org leaves only when its history is over (no lineup that season or
 *    later), and only to give its seat to an entrant of its region.
 * Season X orgs are there at creation. `docs/DATA-AUDIT-rc32.md` lists who
 * enters when (rc.32 left most later EU, SAM and NA orgs without a seat).
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
  ] as const)("career seed %i (%s): an org enters only with a lineup that season, in its region, never early; every org with a lineup is in; only a finished history leaves", (seed, region) => {
    let save: CareerSave = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region } }, seed);
    for (const ref of realRefs(save.world)) expect(firstSeason(ref), ref).toBe(0);
    const hasLineupFrom = (ref: string, s: number) => [...(seasonRegion.get(ref)?.keys() ?? [])].some((k) => k >= s);

    for (let s = 1; s < CAREER_SEASONS.length; s++) {
      const before = new Set(realRefs(save.world));
      const regionBefore = new Map([...before].map((ref) => [ref, save.world.orgs[ref].region] as const));
      const fillersBefore = new Map(
        (["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"] as Region[]).map((r) => [r, fillersIn(save.world, r)] as const),
      );
      save = rolloverToNextSeason(save);
      expect(save.clock.seasonIndex).toBe(s);
      const entered = realRefs(save.world).filter((ref) => !before.has(ref));
      for (const ref of entered) {
        const lineupRegion = seasonRegion.get(ref)?.get(s);
        expect(lineupRegion, `${ref} entered in season ${s} without a lineup that season`).toBeDefined();
        expect(save.world.orgs[ref].region, ref).toBe(lineupRegion);
        expect(firstSeason(ref), ref).toBeLessThanOrEqual(s);
      }
      // RTW-03: every org with a lineup this season is in the world.
      for (const [ref, bySeason] of seasonRegion) {
        if (bySeason.get(s) === undefined) continue;
        expect(save.world.orgs[ref], `${ref} has a ${CAREER_SEASONS[s].seasonId} lineup but no seat`).toBeDefined();
      }
      // RTW-03: an org leaves only when its history is over, to seat an entrant of its region
      // once that region's fillers are gone.
      const leftByRegion = new Map<Region, number>();
      for (const ref of before) {
        if (save.world.orgs[ref]) continue;
        expect(hasLineupFrom(ref, s), `${ref} left in season ${s} with a lineup still to come`).toBe(false);
        const r = regionBefore.get(ref)!;
        leftByRegion.set(r, (leftByRegion.get(r) ?? 0) + 1);
      }
      for (const [r, n] of leftByRegion) {
        const entrants = entered.filter((ref) => save.world.orgs[ref].region === r).length;
        expect(n, `${r}: ${n} orgs left for ${entrants} entrants in season ${s}`).toBeLessThanOrEqual(
          Math.max(0, entrants - fillersBefore.get(r)!),
        );
      }
    }
  });

  it("Karmine Corp and the later EU, SAM and NA orgs appear in their region at their season (RTW-03)", () => {
    let save: CareerSave = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region: "EU" } }, 4242);
    const due = (s: number) =>
      [...seasonRegion].filter(([ref, bySeason]) => firstSeason(ref) === s && ["EU", "SAM", "NA"].includes(bySeason.get(s)!));
    for (let s = 1; s < CAREER_SEASONS.length; s++) {
      save = rolloverToNextSeason(save);
      for (const [ref, bySeason] of due(s)) {
        expect(save.world.orgs[ref]?.region, `${ref} in ${CAREER_SEASONS[s].seasonId}`).toBe(bySeason.get(s));
      }
      if (s === 1) expect(save.world.orgs["karmine-corp"]?.region).toBe("EU");
    }
    // Every region still fields its events from 16 by the existing seeding.
    expect(Object.values(save.world.orgs).filter((o) => o.region === "EU").length).toBeGreaterThanOrEqual(16);
  });
});
