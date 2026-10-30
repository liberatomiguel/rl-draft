/**
 * worldSim — RTW-01 (R49): local amateur sides as teams of the circuit, and
 * the real-org intake by era.
 *  - the anchor rule: one rating per local side per season (the user's region
 *    frozen around the user, every other region around its stored median),
 *    never the user's current squad in a Major / Worlds or an AI event;
 *  - a Major field with local sides builds and simulates end to end,
 *    deterministically (names, rosters, ratings);
 *  - the direct-8 seeding with local sides holding points, and qualifier /
 *    regional fields that stay well-formed (16, no duplicates, no org out of
 *    both events);
 *  - orgs enter by era: none before its first dataset season.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SEASONS, CAREER_SLOTS, CAREER_UNOFFICIAL, TOURNAMENT } from "@/config/balance";
import { lineups } from "@/data";
import type { Region, TournamentTeam } from "../types";
import { officialEventDefsForWeek, qualifierDefsForWeek, seasonSchedule } from "./calendar";
import { applyResultToStandings, compileEventResult } from "./careerResults";
import { localRef, localRegionOf, localSceneRefs, localTeamName, localTeamOffset } from "./localScene";
import type { CareerEventDef, CompetitionState, WorldState } from "./types";
import {
  buildWorldAtCreation,
  computeStars,
  fieldForEvent,
  localAnchorFor,
  localAnchorForEvent,
  localTeamFor,
  localTeamTarget,
  orgHistoryOverAt,
  orgTeamFor,
  qualifierEventRefsFor,
  qualifierFieldRefsFor,
  realOrgIntake,
  regionMedianRating,
  regionalEventRefsFor,
  regionalSeedingFor,
  simulateAiEvent,
} from "./worldSim";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];
const SEED = 424242;

function emptyCompetition(): CompetitionState {
  const empty = () => Object.fromEntries(REGIONS.map((r) => [r, {}])) as Record<Region, Record<string, number>>;
  return {
    splitPoints: empty(),
    seasonPoints: empty(),
    majorFieldRefs: null,
    worldsFieldRefs: null,
    newFacesThisSplit: [],
    squadAtSplitStart: [],
    stabilityTierApplied: 0,
  };
}

let cachedWorld: WorldState | null = null;
/** The season-0 world with its stored ratings (computeStars), built once. */
function world(): WorldState {
  cachedWorld ??= computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  return cachedWorld;
}

/** A stand-in user team at `rating` (fieldForEvent only reads its id and rating). */
function userTeamAt(rating: number): TournamentTeam {
  const base = orgTeamFor(Object.keys(world().orgs).sort()[0], {
    world: world(),
    seasonIndex: 0,
    careerSeed: SEED,
    difficulty: "normal",
  });
  return { ...base, id: "user", name: "User Org", isUser: true, rating: { ...base.rating, total: rating, difficultyShift: 0 } };
}

const regionalWeek = seasonSchedule().find((w) => w.kind === "regional")!.week;
const majorWeek = seasonSchedule().find((w) => w.kind === "major")!.week;
const majorDef = officialEventDefsForWeek(0, majorWeek)[0];
const worldsDef = officialEventDefsForWeek(0, 32)[0];
const qualifierOf = (region: Region): CareerEventDef =>
  qualifierDefsForWeek(0, regionalWeek).find((d) => d.region === region)!;
const intrinsic = (t: TournamentTeam) => t.rating.total - t.rating.difficultyShift;

/** A Major field: each region's top orgs by stored rating, one SAM and one EU seat to local sides. */
function majorFieldWithLocals(): string[] {
  const refs: string[] = [];
  for (const region of REGIONS) {
    const orgs = Object.values(world().orgs)
      .filter((o) => o.region === region)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.ref.localeCompare(b.ref))
      .map((o) => o.ref);
    refs.push(...orgs.slice(0, CAREER_SLOTS.major[region]));
  }
  refs[refs.findIndex((r) => world().orgs[r]?.region === "SAM")] = localRef("SAM", 0, 2);
  refs[refs.findIndex((r) => world().orgs[r]?.region === "EU")] = localRef("EU", 0, 5);
  return refs;
}

describe("the local scene's anchor (R49): one rating per side per season", () => {
  it("the user's region reads the frozen anchor; other regions their stored median; the live rating only before the freeze", () => {
    const competition = emptyCompetition();
    const median = regionMedianRating(world(), "EU");
    expect(localAnchorFor("EU", { world: world(), competition })).toBe(median);
    expect(localAnchorFor("SAM", { world: world(), competition, liveUserRating: 69 })).toBe(69);
    competition.localAnchor = { region: "SAM", rating: 71.5 };
    expect(localAnchorFor("SAM", { world: world(), competition, liveUserRating: 80 })).toBe(71.5);
    // Another region never reads the user's anchor (an AI event passes no live rating).
    expect(localAnchorFor("EU", { world: world(), competition })).toBe(median);
  });

  it("a Major / Worlds never reads the user's current squad; the user's own weekend events and cups may, before the freeze", () => {
    const ctx = { world: world(), competition: emptyCompetition(), userRegion: "SAM" as Region, userTeamRating: 66 };
    const median = regionMedianRating(world(), "SAM");
    expect(localAnchorForEvent({ tier: "major" }, "SAM", ctx)).toBe(median);
    expect(localAnchorForEvent({ tier: "worlds" }, "SAM", ctx)).toBe(median);
    expect(localAnchorForEvent({ tier: "qualifier" }, "SAM", ctx)).toBe(66);
    expect(localAnchorForEvent({ tier: "t3" }, "SAM", ctx)).toBe(66);
    expect(localAnchorForEvent({ tier: "qualifier" }, "EU", ctx)).toBe(regionMedianRating(world(), "EU"));
    // Frozen: every event of the season agrees.
    const frozen = { ...ctx, competition: { ...emptyCompetition(), localAnchor: { region: "SAM" as Region, rating: 70 } } };
    for (const tier of ["qualifier", "regional", "major", "worlds", "t3"] as const) {
      expect(localAnchorForEvent({ tier }, "SAM", frozen)).toBe(70);
    }
  });

  it("a local side keeps its home region from the ref and lands on anchor + offset", () => {
    const ref = localRef("OCE", 0, 3);
    const team = localTeamFor(ref, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", anchor: 78, region: "SAM" });
    expect(team.region).toBe("OCE");
    expect(team.name).toBe(localTeamName(ref, SEED));
    expect(team.playerNames).toHaveLength(3);
    expect(Math.abs(intrinsic(team) - localTeamTarget(ref, 78, SEED))).toBeLessThanOrEqual(1);
    expect(localTeamTarget(ref, 78, SEED)).toBeCloseTo(78 + localTeamOffset(ref, SEED), 5);
  });

  it("the same local side is the same team in the user's qualifier, an AI qualifier, a Major (in or out) and Worlds", () => {
    const local = localRef("SAM", 0, 2);
    const competition = emptyCompetition();
    competition.localAnchor = { region: "SAM", rating: 70 };
    competition.majorFieldRefs = majorFieldWithLocals();
    competition.worldsFieldRefs = majorFieldWithLocals();
    const ratingIn = (def: CareerEventDef, userTeam: TournamentTeam | null): number => {
      const { field } = fieldForEvent(def, {
        world: world(),
        competition,
        userTeam,
        userRegion: "SAM",
        careerSeed: SEED,
        difficulty: "normal",
      });
      const t = field.find((x) => x.id === local);
      expect(t, def.id).toBeDefined();
      return t!.rating.total;
    };
    const seen = new Set([
      ratingIn(qualifierOf("SAM"), userTeamAt(66)),
      ratingIn(qualifierOf("SAM"), userTeamAt(88)), // a better squad does not move it
      ratingIn(qualifierOf("SAM"), null), // the AI-resolved qualifier (the user direct)
      ratingIn(majorDef, null),
      ratingIn(worldsDef, null),
    ]);
    expect(seen.size).toBe(1);
  });
});

describe("a Major with local sides (R49) builds and simulates end to end", () => {
  it("names, rosters and ratings resolve; the same seed replays the same result; points bank to the sides' home regions", () => {
    const competition = emptyCompetition();
    competition.majorFieldRefs = majorFieldWithLocals();
    const ctx = { world: world(), competition, careerSeed: SEED, difficulty: "normal" as const };
    const a = simulateAiEvent(majorDef, ctx);
    const b = simulateAiEvent(majorDef, ctx);
    expect(a.stage).toBe("finished");
    expect(Object.keys(a.teams).sort()).toEqual([...competition.majorFieldRefs].sort());
    for (const ref of [localRef("SAM", 0, 2), localRef("EU", 0, 5)]) {
      const t = a.teams[ref];
      expect(t.name).toBe(localTeamName(ref, SEED));
      expect(t.region).toBe(localRegionOf(ref));
      expect(t.playerNames).toHaveLength(3);
      expect(Number.isFinite(t.rating.total)).toBe(true);
    }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));

    const result = compileEventResult(majorDef, a, { difficulty: "normal", fieldQuality: 1, nameOf: (id) => a.teams[id].name });
    const after = applyResultToStandings(competition, result, (ref) => world().orgs[ref]?.region ?? localRegionOf(ref)!);
    expect(after.seasonPoints.SAM[localRef("SAM", 0, 2)]).toBe(result.rows.find((r) => r.ref === localRef("SAM", 0, 2))!.points);
    expect(after.seasonPoints.EU[localRef("EU", 0, 5)]).toBeGreaterThan(0);
  });
});

describe("direct-8 seeding and Saturday/Sunday fields with local sides holding points (R49)", () => {
  /** The SAM split table after a regional: every org scored, two local sides too (one high, one low). */
  function samCompetition(): CompetitionState {
    const competition = emptyCompetition();
    const orgs = Object.values(world().orgs)
      .filter((o) => o.region === "SAM")
      .sort((a, b) => a.ref.localeCompare(b.ref));
    orgs.forEach((o, i) => {
      if (i < 12) competition.splitPoints.SAM[o.ref] = 60 + i * 20;
    });
    competition.splitPoints.SAM[localRef("SAM", 0, 1)] = 400; // won the regional
    competition.splitPoints.SAM[localRef("SAM", 0, 6)] = 60;
    return competition;
  }
  const seeded = (competition: CompetitionState, fieldsUser: boolean) => ({
    world: world(),
    competition,
    region: "SAM" as Region,
    seasonIndex: 0,
    week: regionalWeek,
    userSeed: fieldsUser ? { rating: 70, prestige: 0 } : null,
    fieldsUser,
    careerSeed: SEED,
  });

  it("a local side with enough split points takes a direct seat; the qualifier skips it and Sunday fields it", () => {
    const competition = samCompetition();
    const winner = localRef("SAM", 0, 1);
    const orgs = Object.values(world().orgs).filter((o) => o.region === "SAM");
    const seeding = regionalSeedingFor({
      orgs,
      splitPoints: competition.splitPoints.SAM,
      user: null,
      locals: [
        { ref: winner, rating: 70 },
        { ref: localRef("SAM", 0, 6), rating: 66 },
      ],
    });
    expect(seeding.direct[0]).toBe(winner);
    expect(seeding.rest).toContain(localRef("SAM", 0, 6));

    for (const fieldsUser of [false, true]) {
      const q = qualifierEventRefsFor(seeded(competition, fieldsUser));
      expect(q).toHaveLength(TOURNAMENT.swiss.teams);
      expect(new Set(q).size).toBe(q.length);
      expect(q).not.toContain(winner);
      expect(q.filter((r) => r === localRef("SAM", 0, 6))).toHaveLength(1);
      // Every SAM org plays Saturday or holds a direct seat — none is out of both.
      const direct = regionalSeedingFor({
        orgs,
        splitPoints: competition.splitPoints.SAM,
        user: fieldsUser ? { rating: 70, prestige: 0 } : null,
        locals: [
          { ref: winner, rating: localTeamTarget(winner, regionMedianRating(world(), "SAM"), SEED) },
          { ref: localRef("SAM", 0, 6), rating: localTeamTarget(localRef("SAM", 0, 6), regionMedianRating(world(), "SAM"), SEED) },
        ],
      }).direct;
      for (const o of orgs) expect(direct.includes(o.ref) || q.includes(o.ref), o.ref).toBe(true);
      // Sunday: the direct 8 (the local winner among them) + eight qualified.
      const qualified = q.filter((r) => r !== "user").slice(0, 8);
      const sunday = regionalEventRefsFor({ ...seeded(competition, fieldsUser), qualified });
      expect(sunday).toHaveLength(TOURNAMENT.swiss.teams);
      expect(new Set(sunday).size).toBe(sunday.length);
      expect(sunday).toContain(winner);
    }
  });

  it("the regional with a direct local side builds and plays (the team resolves)", () => {
    const competition = samCompetition();
    const q = qualifierEventRefsFor(seeded(competition, false));
    const def = officialEventDefsForWeek(0, regionalWeek).find((d) => d.region === "SAM")!;
    competition.qualifiedRefs = { SAM: { eventId: def.id, refs: q.slice(0, 8) } };
    const state = simulateAiEvent(def, { world: world(), competition, careerSeed: SEED, difficulty: "normal" });
    expect(Object.keys(state.teams)).toHaveLength(16);
    expect(state.teams[localRef("SAM", 0, 1)]).toBeDefined();
    expect(state.stage).toBe("finished");
  });

  it("an overflowing qualifier pool drops the lowest-seeded LOCAL sides, never an org", () => {
    const pool = localSceneRefs("SAM", 0);
    const orgs = Array.from({ length: 9 }, (_, i) => `org${i}`);
    // Nine non-direct orgs + all eight local sides seeded (every side scored): 17 for 16 seats.
    const rest = [...pool.slice(0, 4), ...orgs, ...pool.slice(4)];
    const refs = qualifierFieldRefsFor({ region: "SAM", seasonIndex: 0, seeding: { direct: [], rest }, seats: 16 });
    expect(refs).toHaveLength(16);
    for (const o of orgs) expect(refs).toContain(o);
    expect(refs).not.toContain(pool[7]);
    // A pool side in the direct 8 is never added again; unseeded ones fill.
    const filled = qualifierFieldRefsFor({
      region: "SAM",
      seasonIndex: 0,
      seeding: { direct: [pool[0]], rest: orgs },
      seats: 16,
    });
    expect(filled).toEqual([...orgs, ...pool.slice(1, 8)]);
    expect(CAREER_UNOFFICIAL.localScenePool).toBe(8);
  });
});

describe("real orgs enter by era (RTW-01): none arrives before its first dataset season", () => {
  /** Each org's first career season (index into CAREER_SEASONS) with a playable lineup. */
  const firstSeason = new Map<string, number>();
  CAREER_SEASONS.forEach((s, i) => {
    for (const l of lineups) {
      if (l.seasonId !== s.seasonId || l.rareSpawn || l.national) continue;
      if (!firstSeason.has(l.orgId)) firstSeason.set(l.orgId, i);
    }
  });
  const real = (w: WorldState) => Object.values(w.orgs).filter((o) => !o.ref.startsWith("fill:"));
  const fillersIn = (w: WorldState, region: Region) =>
    Object.values(w.orgs).filter((o) => o.region === region && o.ref.startsWith("fill:")).length;

  it.each([11, 777, 90210])("career seed %i: an org enters only in a season it has a lineup (its region), never before its first — and is never left out (rc.33 RTW-03)", (seed) => {
    let w = computeStars(buildWorldAtCreation(seed), { seasonIndex: 0, careerSeed: seed, difficulty: "normal" });
    // Season X: exactly the Season X orgs.
    const seasonX = new Set([...firstSeason].filter(([, s]) => s === 0).map(([org]) => org));
    expect(new Set(real(w).map((o) => o.ref))).toEqual(seasonX);
    for (let s = 1; s < CAREER_SEASONS.length; s++) {
      const seasonLineups = lineups.filter((l) => l.seasonId === CAREER_SEASONS[s].seasonId && !l.rareSpawn && !l.national);
      const before = new Set(Object.keys(w.orgs));
      const intake = realOrgIntake(w, s);
      w = computeStars(intake.world, { seasonIndex: s, careerSeed: seed, difficulty: "normal" });
      for (const e of intake.entered) {
        expect(before.has(e.ref), e.ref).toBe(false);
        // This season's lineup brings it in, in that lineup's region (Elevate: SAM had no seat
        // in 2021-22, so it arrives with its 2022-23 APAC lineup — never earlier).
        const lineup = seasonLineups.find((l) => l.orgId === e.ref);
        expect(lineup, `${e.ref} entered in season ${s} without a lineup that season`).toBeDefined();
        expect(e.region).toBe(lineup!.region);
        expect(firstSeason.get(e.ref)!).toBeLessThanOrEqual(s);
      }
      for (const o of real(w)) expect(firstSeason.get(o.ref), `${o.ref} present in season ${s}`).toBeLessThanOrEqual(s);
      // rc.33 (RTW-03): no org with a lineup this season is left out — with no
      // filler seat, an org whose history is over gives its seat (else the region grows).
      for (const l of seasonLineups) {
        expect(w.orgs[l.orgId], `${l.orgId} (${l.region}) left out in season ${s}`).toBeDefined();
      }
      for (const o of intake.left) {
        expect(orgHistoryOverAt(o.ref, s), `${o.ref} left with history to come`).toBe(true);
        expect(fillersIn(w, o.region), `${o.ref} left while ${o.region} kept a filler`).toBe(0);
      }
    }
    // The infinite era brings nobody.
    expect(realOrgIntake(w, CAREER_SEASONS.length).entered).toHaveLength(0);
  });
});
