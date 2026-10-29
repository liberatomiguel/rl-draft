/**
 * RTW-01 (R49) — the two race tables' view-model (raceTable.ts), pure:
 * the order and the cut are the Major / Worlds selection's own, every team of
 * the region is listed (zero-point orgs and the user included), local and
 * generic sides are marked, the announced field flags its teams, and
 * "fixtures left" counts the points events still to finish.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_POINTS, CAREER_SLOTS } from "@/config/balance";
import type { Region } from "../types";
import { firstDayOfWeek, officialEventDefsForWeek, regionalDayFor } from "./calendar";
import { majorFieldFor, worldsFieldFor } from "./careerResults";
import { localRef } from "./localScene";
import { fixturesLeftFor, raceTableFor, sideOfRef, tableSplitOf, type RaceTableInput } from "./raceTable";
import type { CompetitionState, WorldOrgState, WorldState } from "./types";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];
const LOCAL = localRef("SAM", 0, 4);

function points(): Record<Region, Record<string, number>> {
  return Object.fromEntries(REGIONS.map((r) => [r, {}])) as Record<Region, Record<string, number>>;
}

function competition(): CompetitionState {
  return {
    splitPoints: points(),
    seasonPoints: points(),
    majorFieldRefs: null,
    worldsFieldRefs: null,
    newFacesThisSplit: [],
    squadAtSplitStart: [],
    stabilityTierApplied: 0,
  };
}

function org(ref: string, name: string): WorldOrgState {
  return { ref, name, region: "SAM", prestige: 1, playerIds: ["a", "b", "c"], stars: 2, rating: 80 };
}

/** SAM: three real orgs, two fillers (two never scored), the user, one local side on the table. */
function world(): WorldState {
  const orgs = [
    org("furia", "FURIA"),
    org("loud", "LOUD"),
    org("ts", "Team Secret"),
    org("fill:SAM:0", "Zebra Gaming"),
    org("fill:SAM:1", "Alpha Club"),
  ];
  return { orgs: Object.fromEntries(orgs.map((o) => [o.ref, o])), overallDelta: {}, freeAgentIds: [], retiredIds: [], version: 1 };
}

function input(over: Partial<RaceTableInput> = {}): RaceTableInput {
  const c = competition();
  c.splitPoints.SAM = { furia: 520, loud: 380, [LOCAL]: 560, user: 380, ts: 60 };
  c.seasonPoints.SAM = { furia: 1300, loud: 700, [LOCAL]: 560, user: 900, ts: 60 };
  const w = world();
  return {
    kind: "major",
    region: "SAM",
    competition: c,
    world: w,
    clock: { seasonIndex: 0, day: firstDayOfWeek(7) },
    userRegion: "SAM",
    careerSeed: 2468,
    results: [],
    nameOf: (ref) => (ref === "user" ? "My Org" : (w.orgs[ref]?.name ?? `Local ${ref.slice(-1)}`)),
    ...over,
  };
}

describe("race tables — order, cut, rows (RTW-01, R49)", () => {
  it("the Major table ranks like majorFieldFor: the rows inside the cut ARE the region's Major slots", () => {
    const i = input();
    const t = raceTableFor(i);
    expect(t.cut).toBe(CAREER_SLOTS.major.SAM);
    const field = majorFieldFor(i.competition, i.careerSeed);
    const samSlots = field.filter((ref) => Object.keys(i.competition.splitPoints.SAM).includes(ref));
    expect(t.rows.filter((r) => r.inCut).map((r) => r.ref)).toEqual(samSlots);
    // The local side leads the split and holds a slot.
    expect(t.rows[0]).toMatchObject({ ref: LOCAL, rank: 1, side: "local", inCut: true, points: 560 });
    // Ranks are 1..n with no gaps; points never increase down the table.
    t.rows.forEach((r, k) => expect(r.rank).toBe(k + 1));
    for (let k = 1; k < t.rows.length; k++) expect(t.rows[k].points).toBeLessThanOrEqual(t.rows[k - 1].points);
  });

  it("the Worlds table reads the season points and cuts at the Worlds slots", () => {
    const i = input({ kind: "worlds" });
    const t = raceTableFor(i);
    expect(t.cut).toBe(CAREER_SLOTS.worlds.SAM);
    const field = worldsFieldFor(i.competition, i.careerSeed);
    expect(t.rows.filter((r) => r.inCut).map((r) => r.ref)).toEqual(
      field.filter((ref) => Object.keys(i.competition.seasonPoints.SAM).includes(ref)),
    );
    expect(t.rows.slice(0, 2).map((r) => r.ref)).toEqual(["furia", "user"]);
  });

  it("lists every team of the region: zero-point orgs by name after the scorers, sides marked", () => {
    const t = raceTableFor(input());
    expect(t.rows.map((r) => r.ref).slice(-2)).toEqual(["fill:SAM:1", "fill:SAM:0"]); // Alpha before Zebra
    expect(t.rows.slice(-2).every((r) => r.points === 0)).toBe(true);
    const side = Object.fromEntries(t.rows.map((r) => [r.ref, r.side]));
    expect(side).toMatchObject({ furia: "org", [LOCAL]: "local", user: "user", "fill:SAM:0": "generic" });
    expect(t.userRow?.ref).toBe("user");
    expect(sideOfRef("fill:EU:3")).toBe("generic");
  });

  it("the user's row is there (at 0) before they score; other regions have none", () => {
    const i = input();
    i.competition.splitPoints.SAM = {};
    const t = raceTableFor(i);
    expect(t.userRow).toMatchObject({ points: 0, side: "user" });
    expect(t.rows).toHaveLength(6); // five orgs + the user (the local side has no points yet)
    expect(raceTableFor({ ...input(), region: "EU" }).userRow).toBeNull();
  });

  it("an announced field flags its teams; null before the announcement", () => {
    const i = input();
    expect(raceTableFor(i).rows.every((r) => r.qualified === null)).toBe(true);
    i.competition.majorFieldRefs = [LOCAL, "furia"];
    const t = raceTableFor(i);
    expect(t.announced).toBe(true);
    expect(t.rows.filter((r) => r.qualified).map((r) => r.ref)).toEqual([LOCAL, "furia"]);
    expect(t.userStatus).toBe("out");
  });

  it("user status: secured, in the race, or out of reach — conservative until the field is set", () => {
    // Mid-split: one regional left in the split (one champion's haul).
    const mid = input({ clock: { seasonIndex: 0, day: firstDayOfWeek(7) } });
    const t = raceTableFor(mid);
    expect(t.fixturesLeft.regionals).toBe(1);
    expect(t.userStatus).toBe("contention");
    expect(t.userGap).toBe(520 - 380);
    // Far ahead with one regional left: secured.
    mid.competition.splitPoints.SAM.user = 2000;
    expect(raceTableFor(mid).userStatus).toBe("clinched");
    // Hopelessly behind: out.
    mid.competition.splitPoints.SAM.user = 0;
    mid.competition.splitPoints.SAM.loud = 1000;
    mid.competition.splitPoints.SAM.furia = 1000;
    expect(raceTableFor(mid).userStatus).toBe("out");
  });
});

describe("race tables — fixtures left", () => {
  it("the preseason counts split 1's three regionals (Major) and the whole season (Worlds)", () => {
    const clock = { seasonIndex: 0, day: 1 };
    expect(tableSplitOf(1)).toBe(1);
    expect(fixturesLeftFor({ kind: "major", region: "EU", clock, results: [] })).toEqual({ regionals: 3, majors: 0, total: 3 });
    expect(fixturesLeftFor({ kind: "worlds", region: "EU", clock, results: [] })).toEqual({ regionals: 9, majors: 3, total: 12 });
  });

  it("an event ending today counts until its result is on file", () => {
    const sunday = { seasonIndex: 0, day: regionalDayFor(4) };
    const reg = officialEventDefsForWeek(0, 4).find((d) => d.region === "EU")!;
    expect(fixturesLeftFor({ kind: "major", region: "EU", clock: sunday, results: [] }).regionals).toBe(3);
    expect(fixturesLeftFor({ kind: "major", region: "EU", clock: sunday, results: [{ eventId: reg.id }] }).regionals).toBe(2);
    // The next day it is behind the clock whatever the results say.
    expect(fixturesLeftFor({ kind: "major", region: "EU", clock: { seasonIndex: 0, day: sunday.day + 1 }, results: [] }).regionals).toBe(2);
  });

  it("the windows read the finished split; Worlds week has nothing left", () => {
    const w11 = { seasonIndex: 0, day: firstDayOfWeek(11) };
    expect(tableSplitOf(11)).toBe(1);
    expect(fixturesLeftFor({ kind: "major", region: "NA", clock: w11, results: [] }).total).toBe(0);
    expect(fixturesLeftFor({ kind: "worlds", region: "NA", clock: w11, results: [] })).toEqual({ regionals: 6, majors: 2, total: 8 });
    const w31 = { seasonIndex: 0, day: firstDayOfWeek(CAREER_CALENDAR.worldsWindowWeek) };
    expect(tableSplitOf(CAREER_CALENDAR.worldsWindowWeek)).toBe(3);
    expect(fixturesLeftFor({ kind: "worlds", region: "NA", clock: w31, results: [] }).total).toBe(0);
  });

  it("max points left is a champion's haul in every fixture left (Majors double)", () => {
    const t = raceTableFor(input({ kind: "worlds", clock: { seasonIndex: 0, day: 1 } }));
    expect(t.maxPointsLeft).toBe(9 * CAREER_POINTS.regional.champion + 3 * CAREER_POINTS.regional.champion * CAREER_POINTS.majorMultiplier);
  });
});
