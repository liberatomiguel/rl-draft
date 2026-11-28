import { describe, expect, it } from "vitest";
import { CAREER_ENDLESS, CAREER_GEAR } from "@/config/balance";
import { lineupById } from "@/data";
import type { TournamentTeam } from "../types";
import {
  cupDrawSeeds,
  dominanceOf,
  invitationalGuests,
  KIT_ORDER,
  kitFor,
  legendLineupIdsFor,
  legendTeamFor,
  legendsWeekFor,
  majorHostsFor,
  projectKitEffect,
  projectStrengthFor,
  projectsAt,
  rivalProjectsPass,
  worldsStreakOf,
} from "./endless";
import { buildWorldAtCreation, orgTeamFor } from "./worldSim";

const SEED = 4242;
const P = CAREER_ENDLESS.projects;

describe("dominance, dynasty and the strength of the answer", () => {
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
  it("reads the reigning champion's consecutive Worlds from the honours", () => {
    const h = (seasonIndex: number, orgRef: string) => ({ tier: "worlds", seasonIndex, orgRef });
    expect(worldsStreakOf([h(7, "x"), h(8, "user"), h(9, "user"), h(10, "user")], 10)).toEqual({ ref: "user", titles: 3 });
    expect(worldsStreakOf([h(8, "user"), h(9, "user"), h(10, "x")], 10)).toEqual({ ref: "x", titles: 1 });
    expect(worldsStreakOf([{ tier: "major", seasonIndex: 10, orgRef: "user" }], 10)).toEqual({ ref: null, titles: 0 });
    expect(worldsStreakOf(undefined, 10)).toEqual({ ref: null, titles: 0 });
  });
  it("a first defence meets one project, each further title one more, capped; no dominance no answer", () => {
    expect(projectStrengthFor(0.5, 3)).toBe(0);
    expect(projectStrengthFor(P.defenceFloor, 0)).toBe(0);
    expect(projectStrengthFor(P.defenceFloor, 1)).toBe(1);
    expect(projectStrengthFor(P.defenceFloor, 3)).toBe(3);
    expect(projectStrengthFor(P.dominanceFloor, 0)).toBe(1);
    expect(projectStrengthFor(P.bigGap, 2)).toBe(3);
    expect(projectStrengthFor(50, 50)).toBe(P.maxProjects);
  });
  it("the kit grows with the strength, in the toolbox order", () => {
    expect(kitFor(1)).toEqual(KIT_ORDER.slice(0, P.kitBase));
    expect(kitFor(2).length).toBe(P.kitBase + 1);
    expect(kitFor(99)).toEqual([...KIT_ORDER]);
  });
  it("every kit item is the user's own effect, read from CAREER_GEAR", () => {
    const perf = CAREER_GEAR.items.find((i) => i.id === "perfCenter")!.ratingBonus;
    const camp = Math.min(Math.max(...CAREER_GEAR.bootcamp.map((b) => b.sharpRating)), CAREER_GEAR.tempRatingMax);
    expect(projectKitEffect(["facilities"]).ratingBonus).toBe(perf);
    expect(projectKitEffect(["facilities"]).buffLevel).toBe("+++");
    expect(projectKitEffect(["bootcamp"]).ratingBonus).toBe(camp);
    expect(projectKitEffect(["psychologist"]).statBonus).toEqual(CAREER_GEAR.psychologistStatBonus);
    expect(projectKitEffect([]).ratingBonus).toBe(0);
  });
});

describe("rival projects", () => {
  const world = buildWorldAtCreation(SEED);
  const allIds = (w: typeof world) =>
    [...Object.values(w.orgs).flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]), ...w.freeAgentIds].sort();
  const userSquadIds = Object.values(world.orgs).find((o) => o.region === "NA")!.playerIds.slice(0, 1);
  const ctx = {
    careerSeed: SEED,
    seasonIndex: 8,
    difficulty: "normal" as const,
    userSquadIds,
    userRating: 110,
    userRegion: "NA" as const,
    running: [],
    streak: { ref: "user", titles: 3 },
  };

  it("only moves players: the same people, every org still fields three, nobody twice", () => {
    const res = rivalProjectsPass(world, ctx);
    expect(res.projects.length).toBe(projectStrengthFor(res.gap, 3, false, ctx.seasonIndex)); // rc9 ENDGAME: the season's rules (R234)
    expect(allIds(res.world)).toEqual(allIds(world));
    for (const o of Object.values(res.world.orgs)) {
      expect(o.playerIds.filter(Boolean)).toHaveLength(3);
      expect(new Set(o.playerIds).size).toBe(3);
    }
  });
  it("never signs a player the user holds, answers in the leader's region first, and its kit shows on the org", () => {
    const res = rivalProjectsPass(world, ctx);
    expect(res.projects[0].region).toBe("NA");
    for (const p of res.projects) {
      for (const s of p.signed) expect(userSquadIds).not.toContain(s.playerId);
      expect(res.world.orgs[p.orgRef].projectKit?.items).toEqual(kitFor(res.strength));
      expect(p.ratingAfter).toBeGreaterThan(p.ratingBefore);
    }
  });
  it("the kit is what lifts the side: the same roster without it rates lower", () => {
    const res = rivalProjectsPass(world, ctx);
    const p = res.projects[0];
    const tc = { world: res.world, seasonIndex: 8, careerSeed: SEED, difficulty: "normal" as const };
    const bare = { ...res.world, orgs: { ...res.world.orgs, [p.orgRef]: { ...res.world.orgs[p.orgRef], projectKit: undefined } } };
    expect(orgTeamFor(p.orgRef, tc).rating.total).toBeGreaterThan(orgTeamFor(p.orgRef, { ...tc, world: bare }).rating.total);
  });
  it("is deterministic and leaves the input world alone", () => {
    const before = JSON.stringify(world);
    const a = rivalProjectsPass(world, ctx);
    const b = rivalProjectsPass(world, ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(world)).toBe(before);
  });
  it("a core continues next season (same orgs, same start) and stops after maxSeasons", () => {
    const first = rivalProjectsPass(world, ctx);
    const next = rivalProjectsPass(first.world, { ...ctx, seasonIndex: 9, running: first.projects });
    for (const p of first.projects) {
      const again = next.projects.find((x) => x.orgRef === p.orgRef);
      if (again) expect(again.since).toBe(8);
    }
    expect(next.projects.filter((x) => x.since === 8).length).toBeGreaterThan(0);
    const late = rivalProjectsPass(first.world, { ...ctx, seasonIndex: 8 + P.maxSeasons, running: first.projects });
    expect(late.projects.some((x) => x.since === 8)).toBe(false);
  });
  it("a broken dynasty with no lead: no answer, and every kit closes", () => {
    const first = rivalProjectsPass(world, ctx);
    const after = rivalProjectsPass(first.world, { ...ctx, seasonIndex: 9, userRating: 60, streak: { ref: null, titles: 0 }, running: first.projects });
    if (after.strength === 0) {
      expect(after.projects).toEqual([]);
      expect(Object.values(after.world.orgs).some((o) => o.projectKit)).toBe(false);
    } else for (const p of after.projects) expect(p.orgRef).not.toBe(after.leader);
  });
  it("rc9 ENDGAME (R234): the late rules start at CAREER_ENDLESS.late.fromSeasonIndex, never earlier", () => {
    const L = CAREER_ENDLESS.late;
    expect(projectsAt(L.fromSeasonIndex - 1)).toEqual(CAREER_ENDLESS.projects);
    expect(projectsAt(L.fromSeasonIndex)).toEqual({ ...CAREER_ENDLESS.projects, ...L.projects });
    expect(L.fromSeasonIndex).toBeGreaterThan(CAREER_ENDLESS.fromSeasonIndex);
  });
  it("does nothing before the endless years; an AI leader gets the same rule, never answered by itself", () => {
    expect(rivalProjectsPass(world, { ...ctx, seasonIndex: 3 }).projects).toEqual([]);
    const ai = rivalProjectsPass(world, { ...ctx, userRating: 60, streak: { ref: null, titles: 0 } });
    expect(ai.leader).not.toBe("user");
    expect(ai.strength).toBe(projectStrengthFor(ai.gap, 0, false, ctx.seasonIndex)); // rc9 ENDGAME: the season's rules (R234)
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
