import { describe, expect, it } from "vitest";
import { CAREER_SEASONS, CAREER_WORLD_LIFE, FEATURES } from "@/config/balance";
import { developmentPhaseOf, developmentProfileOf, playerViewById } from "./development";
import type { CoachState, CompetitionState, WorldState } from "./types";
import {
  coachLifeOn,
  coachLifecycle,
  marketCoachRetiredBy,
  coachRetireChance,
  eliteRenewalPass,
  localCapsFor,
  orgLifecycle,
  promoteReserves,
  scoutingPass,
  stackCandidatesFrom,
  userCoachRollover,
  worldLifeOn,
} from "./worldLife";
import { buildWorldAtCreation, localAnchorFor } from "./worldSim";

const SEED = 4242;
const SEASON = CAREER_SEASONS.length;
const ctx = { careerSeed: SEED, seasonIndex: SEASON };

function world(): WorldState {
  return buildWorldAtCreation(SEED);
}
const ovr = (w: WorldState, id: string) => playerViewById(id, { ...ctx, world: w })?.overall ?? 0;
const trioMin = (w: WorldState, ref: string) => Math.min(...w.orgs[ref].playerIds.map((id) => ovr(w, id)));
const trioSum = (w: WorldState, ref: string) => w.orgs[ref].playerIds.reduce((n, id) => n + ovr(w, id), 0);

describe("v2.1 Mundo vivo M1 (R139)", () => {
  it("is off by default (v2.0.35 exactly) and only ever reaches the infinite seasons", () => {
    expect(FEATURES.worldLife).toBe(false);
    expect(worldLifeOn(SEASON + 5)).toBe(false);
  });

  it("a reserve starts only when he is better than the weakest starter, who keeps a bench seat", () => {
    const w = world();
    const ref = Object.keys(w.orgs).sort()[0];
    const region = w.orgs[ref].region;
    const fas = w.freeAgentIds.filter((id) => playerViewById(id, { ...ctx, world: w })?.region === region);
    const weak = fas.find((id) => ovr(w, id) < trioMin(w, ref));
    const strong = fas.find((id) => ovr(w, id) > trioMin(w, ref));
    expect(weak).toBeDefined();
    // A weaker reserve stays on the bench: nothing moves.
    w.orgs[ref].reserveIds = [weak!];
    expect(promoteReserves(w, ctx).world).toBe(w);
    if (!strong) return;
    w.orgs[ref].reserveIds = [strong];
    const before = trioSum(w, ref);
    const { world: next, promoted } = promoteReserves(w, ctx);
    expect(promoted).toHaveLength(1);
    expect(promoted[0].gain).toBeGreaterThan(0);
    expect(trioSum(next, ref)).toBeGreaterThan(before);
    expect(next.orgs[ref].playerIds).toContain(strong);
    expect(next.orgs[ref].reserveIds).toEqual([promoted[0].outId]);
  });

  it("scouting never touches the starters and only shortlists near-ready prospects", () => {
    const w = world();
    const { world: next, signings } = scoutingPass(w, { ...ctx, userSquadIds: [] });
    const S = CAREER_WORLD_LIFE.scouting;
    for (const s of signings) {
      const org = next.orgs[s.orgRef];
      expect(org.playerIds).toEqual(w.orgs[s.orgRef].playerIds);
      expect(org.reserveIds).toContain(s.playerId);
      expect(next.freeAgentIds).not.toContain(s.playerId);
      const v = playerViewById(s.playerId, { ...ctx, world: next })!;
      expect(v.age).toBeLessThanOrEqual(S.maxAge);
      expect(v.potential).toBeGreaterThanOrEqual(S.minPotential);
      expect(v.overall).toBeGreaterThanOrEqual(trioMin(w, s.orgRef) - S.belowWeakest);
      expect(org.prestige).toBeGreaterThanOrEqual(S.prestigeMin);
    }
  });

  it("the local scene's ceiling sits under each region's median", () => {
    const w = world();
    const caps = localCapsFor(w);
    const competition = { localCap: caps } as unknown as CompetitionState;
    const anchor = localAnchorFor("EU", { world: w, competition, liveUserRating: 99 });
    expect(anchor).toBe(caps.EU);
    expect(localAnchorFor("EU", { world: w, competition, liveUserRating: 60 })).toBe(60);
  });

  it("a Local side at a Major or Worlds becomes a stack; turnover gives a stuck small org's seat to a new org", () => {
    const w = world();
    const stacks = stackCandidatesFrom(
      [{ eventId: "w", tier: "worlds", seasonIndex: SEASON - 1, week: 30, name: "W", championRef: "x", fieldQuality: 1,
        rows: [{ ref: "local:EU:5:0", name: "L", placement: "top8" as never, points: 0, prize: 0 }] }],
      SEASON - 1,
      () => ({ region: "EU", name: "Garage", rating: 84, playerNames: ["a", "b", "c"] }),
    );
    expect(stacks).toHaveLength(1);
    // Two seasons at the bottom.
    for (const o of Object.values(w.orgs)) if (o.region === "EU") o.lowSeasons = 1;
    const { world: next, report } = orgLifecycle(w, { ...ctx, stacks, retiredNow: [], userSquadIds: [] });
    expect(report.turnovers.filter((t) => t.region === "EU")).toHaveLength(1);
    const t = report.turnovers.find((x) => x.region === "EU")!;
    expect(next.orgs[t.leftRef]).toBeUndefined();
    expect(next.orgs[t.enteredRef]).toBeDefined();
    expect(report.stacks[0].orgRef).toBe(t.enteredRef);
    const stackIds = next.orgs[t.enteredRef].playerIds;
    for (const id of stackIds) expect(Math.round(ovr(next, id))).toBe(84);
    expect(Object.values(next.orgs).filter((o) => o.region === "EU")).toHaveLength(Object.values(w.orgs).filter((o) => o.region === "EU").length);
  });

  it("the user's coach announces his last season a season ahead and leaves only at a rollover", () => {
    const coach: CoachState = { id: "coach:gen:0:0:1", name: "Coach X", overall: 80, bonusType: "shooting" as never, bonusLevel: "+", salaryPerSplit: 1, source: "generated", age: 34 };
    // rc9 ENDGAME (R230): the window is 28-35; 35 always retires, past it the exits spread.
    expect(coachRetireChance(35)).toBe(1);
    expect(coachRetireChance(27)).toBe(0);
    expect(coachRetireChance(60)).toBe(CAREER_WORLD_LIFE.coaches.pastWindowChance);
    const a = userCoachRollover(coach, SEASON, SEED);
    expect(a.announced).toBe(true);
    expect(a.coach).not.toBeNull();
    expect(a.coach!.retiresAfterSeason).toBe(SEASON);
    const b = userCoachRollover(a.coach!, SEASON + 1, SEED);
    expect(b.retired).toBe(true);
    expect(b.coach).toBeNull();
    // A young coach just ages.
    const young = userCoachRollover({ ...coach, age: 25 }, SEASON, SEED);
    expect(young.coach!.age).toBe(26);
    expect(young.announced).toBe(false);
  });
});

describe("rc9 ENDGAME (R230-R231): coaches age and retire from the first season", () => {
  const flags = FEATURES as { worldLife: boolean };
  const on = <T,>(fn: () => T): T => {
    flags.worldLife = true;
    try {
      return fn();
    } finally {
      flags.worldLife = false;
    }
  };

  it("is off with the flag off; on, it runs from season 1 while M1 itself waits for the infinite seasons", () => {
    expect(coachLifeOn(1)).toBe(false);
    on(() => {
      expect(coachLifeOn(1)).toBe(true);
      expect(worldLifeOn(1)).toBe(false);
    });
  });

  it("a timeline rollover ages the AI coaches, retires some, never sacks, never changes a roster", () => {
    const w = world();
    const first = on(() => coachLifecycle(w, { careerSeed: SEED, seasonIndex: 1, retiredNow: [] }));
    const coached = Object.values(w.orgs).filter((o) => o.coachOverall !== undefined);
    expect(coached.length).toBeGreaterThan(20);
    expect(first.report.coachChanged).toBe(0);
    for (const o of Object.values(first.world.orgs)) {
      expect(o.playerIds).toEqual(w.orgs[o.ref].playerIds);
      if (o.coachOverall !== undefined) expect(o.coachAge).toBeDefined();
    }
    // First-sight ages sit under the window: season 1 has no wave (at most a quarter retire).
    expect(first.report.coachRetired).toBeLessThanOrEqual(Math.ceil(coached.length / 4));
    // Everyone past 35 is gone within a few seasons; nobody coaches past the window for long.
    let cur = first.world;
    let retired = first.report.coachRetired;
    for (let s = 2; s <= 12; s++) {
      const r = on(() => coachLifecycle(cur, { careerSeed: SEED, seasonIndex: s, retiredNow: [] }));
      retired += r.report.coachRetired;
      cur = r.world;
    }
    expect(retired).toBeGreaterThan(coached.length / 2);
    const ages = Object.values(cur.orgs).map((o) => o.coachAge ?? 0);
    expect(Math.max(...ages)).toBeLessThanOrEqual(36);
  });

  it("a dataset coach on the market retires on the same draw for a career, and only with the flag on", () => {
    expect(marketCoachRetiredBy("coach:staff:x", 0, 12, SEED)).toBe(false);
    const ids = Array.from({ length: 40 }, (_, i) => `coach:staff:p${i}`);
    const at12 = on(() => ids.filter((id) => marketCoachRetiredBy(id, 0, 12, SEED)));
    const at3 = on(() => ids.filter((id) => marketCoachRetiredBy(id, 0, 3, SEED)));
    expect(at12.length).toBeGreaterThan(at3.length);
    for (const id of at3) expect(at12).toContain(id); // once retired, retired for good
  });

  it("a save in progress keeps its coach on load: a coach seen for the first time can only announce", () => {
    const coach: CoachState = { id: "coach:staff:old", name: "Coach Old", overall: 85, bonusType: "shooting" as never, bonusLevel: "+", salaryPerSplit: 1, source: "dataset" };
    for (let s = 1; s <= 12; s++) {
      const r = userCoachRollover(coach, s, SEED + s);
      expect(r.retired).toBe(false);
      expect(r.coach).not.toBeNull();
    }
  });
});

describe("v2.1 Mundo vivo M2.1 (R142): elite renewal", () => {
  const E = CAREER_WORLD_LIFE.eliteRenewal;
  const viewIn = (w: WorldState, id: string) => playerViewById(id, { ...ctx, world: w });
  const activeElite = (w: WorldState, region: string, user: Set<string> = new Set()) => {
    const ids = [...Object.values(w.orgs).flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]), ...w.freeAgentIds];
    return ids.filter((id) => {
      if (user.has(id)) return false;
      const v = viewIn(w, id);
      if (!v || v.region !== region || v.potential < E.potentialMin) return false;
      const { plateauYears } = developmentProfileOf(id, SEED);
      return developmentPhaseOf(v.age, { peakAge: v.peakAge, plateauYears }) !== "declining";
    }).length;
  };

  it("the first pass only counts each region's baseline (nothing is promoted)", () => {
    const w = world();
    const r = eliteRenewalPass(w, { ...ctx, userSquadIds: [] });
    expect(r.lifted).toEqual([]);
    expect(r.world.potentialLift).toBeUndefined();
    for (const region of ["EU", "NA", "SAM"] as const) expect(r.world.eliteBaseline?.[region]).toBe(Math.round(activeElite(w, region) * E.baselineShare));
  });

  it("a region under its baseline promotes at most perRegionPerSeason young AI players, deterministically", () => {
    const w = world();
    w.eliteBaseline = { NA: 99, EU: 99, SAM: 99, MENA: 99, OCE: 99, APAC: 99, SSA: 99 };
    const a = eliteRenewalPass(w, { ...ctx, userSquadIds: [] });
    const b = eliteRenewalPass(w, { ...ctx, userSquadIds: [] });
    expect(a.lifted).toEqual(b.lifted);
    expect(a.lifted.length).toBeGreaterThan(0);
    for (const g of new Set(a.lifted.map((p) => p.region))) expect(a.lifted.filter((p) => p.region === g).length).toBeLessThanOrEqual(E.perRegionPerSeason);
    for (const p of a.lifted) {
      const before = viewIn(w, p.playerId)!;
      const after = viewIn(a.world, p.playerId)!;
      expect(before.age).toBeLessThanOrEqual(E.maxAge);
      expect(before.potential).toBeGreaterThanOrEqual(E.candidateMinPotential);
      expect(after.potential).toBe(p.potential);
      expect(after.potential).toBeGreaterThanOrEqual(E.potentialMin);
      // His peak leaves room to grow, and it is FIXED (a later season reads the same).
      expect(after.peakAge).toBeGreaterThan(before.age);
      expect(playerViewById(p.playerId, { careerSeed: SEED, seasonIndex: SEASON + 3, world: a.world })!.peakAge).toBe(after.peakAge);
      expect(p.playerId in a.world.overallDelta).toBe(true);
      // The overall itself never moves at the promotion.
      expect(after.overall).toBe(before.overall);
    }
    // The baseline is never counted again.
    expect(a.world.eliteBaseline).toEqual(w.eliteBaseline);
  });

  it("never touches the user's players, and a region at its baseline returns the same world", () => {
    const w = world();
    const first = eliteRenewalPass(w, { ...ctx, userSquadIds: [] }).world;
    expect(eliteRenewalPass(first, { ...ctx, userSquadIds: [] }).world).toBe(first);
    first.eliteBaseline = { ...first.eliteBaseline, EU: 99 };
    const all = [...Object.values(first.orgs).flatMap((o) => [...o.playerIds, ...(o.reserveIds ?? [])]), ...first.freeAgentIds];
    const r = eliteRenewalPass(first, { ...ctx, userSquadIds: all });
    expect(r.lifted).toEqual([]);
  });

  it("is off with perRegionPerSeason 0", () => {
    const w = world();
    const saved = E.perRegionPerSeason;
    (E as { perRegionPerSeason: number }).perRegionPerSeason = 0;
    try {
      expect(eliteRenewalPass(w, { ...ctx, userSquadIds: [] }).world).toBe(w);
    } finally {
      (E as { perRegionPerSeason: number }).perRegionPerSeason = saved;
    }
  });
});
