import { describe, expect, it } from "vitest";
import { CAREER_ENDLESS } from "@/config/balance";
import { lineupById } from "@/data";
import type { TournamentTeam } from "../types";
import {
  cupDrawSeeds,
  dominanceOf,
  invitationalGuests,
  legendLineupIdsFor,
  legendTeamFor,
  legendsWeekFor,
  majorHostsFor,
  projectLevelFor,
  rivalProjectsPass,
} from "./endless";
import { buildWorldAtCreation } from "./worldSim";

const SEED = 4242;

describe("dominance and the number of projects", () => {
  it("measures the leader against the next three", () => {
    const d = dominanceOf([
      { id: "user", rating: 101 },
      { id: "a", rating: 98 },
      { id: "b", rating: 97 },
      { id: "c", rating: 96 },
      { id: "d", rating: 80 },
    ]);
    expect(d.leader).toBe("user");
    expect(d.gap).toBeCloseTo(4, 5);
  });
  it("a level world runs no project; a dynasty runs several, capped", () => {
    expect(projectLevelFor(0)).toBe(0);
    expect(projectLevelFor(CAREER_ENDLESS.projects.dominanceFloor - 0.01)).toBe(0);
    expect(projectLevelFor(CAREER_ENDLESS.projects.dominanceFloor)).toBe(1);
    expect(projectLevelFor(50)).toBe(CAREER_ENDLESS.projects.maxProjects);
  });
});

describe("rival projects", () => {
  const world = buildWorldAtCreation(SEED);
  const allIds = (w: typeof world) =>
    [...Object.values(w.orgs).flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]), ...w.freeAgentIds].sort();
  const userSquadIds = Object.values(world.orgs).find((o) => o.region === "NA")!.playerIds.slice(0, 1);
  const ctx = { careerSeed: SEED, seasonIndex: 8, difficulty: "normal" as const, userSquadIds, userRating: 110, userRegion: "NA" as const, lastProjectRefs: [] };

  it("only moves players: the same people, every org still fields three, nobody twice", () => {
    const res = rivalProjectsPass(world, ctx);
    expect(res.projects.length).toBeGreaterThan(0);
    expect(allIds(res.world)).toEqual(allIds(world));
    for (const o of Object.values(res.world.orgs)) {
      expect(o.playerIds.filter(Boolean)).toHaveLength(3);
      expect(new Set(o.playerIds).size).toBe(3);
    }
  });
  it("never signs a player the user holds, answers in the leader's region first, and never runs for the leader", () => {
    const res = rivalProjectsPass(world, ctx);
    expect(res.projects[0].region).toBe("NA");
    for (const p of res.projects) for (const s of p.signed) expect(userSquadIds).not.toContain(s.playerId);
    expect(res.projects.every((p) => p.ratingAfter >= p.ratingBefore)).toBe(true);
  });
  it("is deterministic and leaves the input world alone", () => {
    const before = JSON.stringify(world);
    const a = rivalProjectsPass(world, ctx);
    const b = rivalProjectsPass(world, ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(world)).toBe(before);
  });
  it("rotates: last season's project orgs sit out", () => {
    const first = rivalProjectsPass(world, ctx);
    const next = rivalProjectsPass(world, { ...ctx, lastProjectRefs: first.projects.map((p) => p.orgRef) });
    for (const p of next.projects) expect(first.projects.map((x) => x.orgRef)).not.toContain(p.orgRef);
  });
  it("does nothing before the endless years; an AI leader is answered too, never by itself", () => {
    expect(rivalProjectsPass(world, { ...ctx, seasonIndex: 3 }).projects).toEqual([]);
    const ai = rivalProjectsPass(world, { ...ctx, userRating: 60 });
    expect(ai.leader).not.toBe("user");
    for (const p of ai.projects) expect(p.orgRef).not.toBe(ai.leader);
  });
});

describe("cups", () => {
  const ranked = Array.from({ length: 16 }, (_, i) => `org${i}`);
  it("the Invitational keeps the points leaders and draws the rest from the next places", () => {
    const g = invitationalGuests(ranked, { id: "8:5:unofficial" }, SEED, 7);
    expect(g).toHaveLength(7);
    expect(g.slice(0, CAREER_ENDLESS.cups.keepTop)).toEqual(ranked.slice(0, CAREER_ENDLESS.cups.keepTop));
    expect(g.every((r) => ranked.indexOf(r) < CAREER_ENDLESS.cups.poolSize)).toBe(true);
    const fields = new Set([3, 4, 5, 6, 7, 8].map((w) => invitationalGuests(ranked, { id: `8:${w}:unofficial` }, SEED, 7).join()));
    expect(fields.size).toBeGreaterThan(3);
  });
  it("the draw keeps seeds 1 and 2 apart and moves the rest per event", () => {
    const teams = Object.fromEntries(ranked.slice(0, 8).map((id, i) => [id, { id, rating: { total: 100 - i } } as unknown as TournamentTeam]));
    const seeds = cupDrawSeeds(teams, { id: "9:4:unofficial" }, SEED);
    expect(seeds.slice(0, 2)).toEqual(["org0", "org1"]);
    expect(new Set(seeds.slice(2, 4))).toEqual(new Set(["org2", "org3"]));
    expect([...seeds].sort()).toEqual(ranked.slice(0, 8).sort());
    const draws = new Set([3, 4, 5, 6, 7].map((w) => cupDrawSeeds(teams, { id: `9:${w}:unofficial` }, SEED).join()));
    expect(draws.size).toBeGreaterThan(2);
  });
});

describe("Legends", () => {
  it("seven all-time rosters of seven orgs, at their peak, named with their year", () => {
    const ids = legendLineupIdsFor({ id: "9:6:unofficial" }, SEED);
    expect(ids).toHaveLength(7);
    expect(new Set(ids.map((id) => lineupById.get(id)!.orgId)).size).toBe(7);
    for (const id of ids) {
      const t = legendTeamFor(id, "normal");
      expect(t.rating.total).toBeGreaterThan(95);
      expect(t.id).toBe(`legend:${id}`);
      expect(t.name.length).toBeGreaterThan(lineupById.get(id)!.name.length);
    }
  });
  it("runs on its weeks of the endless years only", () => {
    const open = [3, 4, 5, 6, 7, 8, 9, 10];
    expect(open.filter((w) => legendsWeekFor(9, w, SEED, open))).toHaveLength(CAREER_ENDLESS.legends.perSeason);
    expect(open.filter((w) => legendsWeekFor(2, w, SEED, open))).toHaveLength(0);
  });
  it("hosts: four distinct cities a season", () => {
    const h = majorHostsFor(9, SEED, 12);
    expect(new Set(h).size).toBe(4);
    expect(h.every((i) => i >= 0 && i < 12)).toBe(true);
  });
});
