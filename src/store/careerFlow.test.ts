/**
 * Road to Worlds — full-season integration test (the bot manager, v0.2).
 *
 * Creates a career on a fixed seed and plays complete seasons headlessly
 * through the REAL flow functions (create → advance day-by-day → enter → sim
 * → finish → rollover), asserting the loop's invariants. This is the smoke
 * harness the pacing suite (CAREER_ARC) will grow from.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_GEAR } from "@/config/balance";
import { DAYS_PER_SEASON, firstDayOfWeek } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import {
  advanceDayFlow,
  createCareerSave,
  finishEvent,
  migrateSaveToV2,
  releasePlayerFlow,
  rolloverToNextSeason,
  runScrimFlow,
  simEventToEnd,
  startEvent,
  syncSquadRoles,
  type CreateCareerInput,
} from "./careerFlow";
import { userTeamFor } from "@/engine/career/worldSim";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Test Org",
    abbrev: "TST",
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

/** Resolve today's committed event (play or sim — officials block Advance). */
function resolveEventIfDue(input: CareerSave): CareerSave {
  let save = input;
  if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) {
    save = startEvent(save, false);
    expect(save.activeEvent).not.toBeNull();
    save = simEventToEnd(save);
    expect(save.activeEvent!.tournament.stage).toBe("finished");
    save = finishEvent(save);
    expect(save.activeEvent).toBeNull();
  }
  return save;
}

/** Plays every day of the current season; returns the save at seasonReview. */
function playSeason(input: CareerSave): CareerSave {
  let save = input;
  let guard = 0;
  while (save.phase === "running" && guard < DAYS_PER_SEASON + 60) {
    guard += 1;
    save = resolveEventIfDue(save);
    if (save.phase !== "running") break;
    const before = save.clock.day;
    save = advanceDayFlow(save);
    if (save.phase !== "running") break;
    if (save.clock.day === before) {
      // Blocked: only an unresolved official matchday or the season end may block.
      if (before >= DAYS_PER_SEASON) break;
      expect(save.pendingEventDef?.day).toBe(before);
      continue;
    }
    expect(save.clock.day).toBe(before + 1);
  }
  expect(guard).toBeLessThan(DAYS_PER_SEASON + 60);
  return save;
}

describe("careerFlow — full season integration (day clock)", () => {
  it("creates a deterministic career world", () => {
    const a = createCareerSave(INPUT, 424242);
    const b = createCareerSave(INPUT, 424242);
    expect(a.careerSeed).toBe(b.careerSeed);
    expect(Object.keys(a.world.orgs).length).toBe(Object.keys(b.world.orgs).length);
    expect(a.squad.map((p) => p.id)).toEqual(b.squad.map((p) => p.id));
    // 7 regions × 16 orgs.
    expect(Object.keys(a.world.orgs).length).toBe(112);
    expect(a.squad).toHaveLength(3);
    expect(a.clock).toEqual({ seasonIndex: 0, day: 1 });
    expect(a.phase).toBe("running");
    // RL-realistic squad ages (13+ only).
    for (const p of a.squad) {
      const age = 2020 - p.birthYear;
      expect(age).toBeGreaterThanOrEqual(13);
      expect(age).toBeLessThanOrEqual(27);
    }
    // v0.2 fields present from day one.
    expect(a.finances.gear.peripherals).toBe(false);
    expect(a.finances.bootcampSharp).toBe(0);
    expect(a.mail).toEqual([]);
    expect(a.scrimsThisWeek).toBe(0);
  });

  it("plays season 0 end-to-end: events, standings, payday, worlds, review", () => {
    let save = createCareerSave(INPUT, 20260709);
    save = playSeason(save);

    expect(save.phase).toBe("seasonReview");
    expect(save.history).toHaveLength(1);
    const record = save.history[0];
    expect(record.seasonId).toBe("rlcs-x");
    expect(record.worldsChampionRef).toBeTruthy();
    expect(record.userRegionRank).toBeGreaterThanOrEqual(1);
    // The user played 9 regionals minimum → stats accumulated.
    expect(save.stats.seriesWins + save.stats.seriesLosses).toBeGreaterThan(20);
    // Standings populated for every region.
    for (const region of ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"] as const) {
      const table = save.competition.seasonPoints[region];
      expect(Object.keys(table).length).toBeGreaterThanOrEqual(10);
    }
    // Money moved: ledger has salaries.
    const kinds = new Set(save.finances.ledger.map((l) => l.kind));
    expect(kinds.has("salary")).toBe(true);
    // The day clock never exceeded the season.
    expect(save.clock.day).toBeLessThanOrEqual(DAYS_PER_SEASON);
  });

  it("rolls over into season 1 and keeps playing", () => {
    let save = createCareerSave(INPUT, 777001);
    save = playSeason(save);
    expect(save.phase).toBe("seasonReview");

    save = rolloverToNextSeason(save);
    expect(save.phase).toBe("running");
    expect(save.clock.seasonIndex).toBe(1);
    expect(save.clock.day).toBe(1);
    expect(save.sponsorOffers === null || save.sponsorOffers.length > 0).toBe(true);
    // Squad survived (contracts ran to end of season 1).
    expect(save.squad.length).toBeGreaterThanOrEqual(1);

    // Play into the season's second window without exploding.
    const targetDay = firstDayOfWeek(11);
    let guard = 0;
    while (save.phase === "running" && save.clock.day < targetDay && guard < 300) {
      guard += 1;
      save = resolveEventIfDue(save);
      if (save.phase !== "running") break;
      save = advanceDayFlow(save);
    }
    expect(save.clock.day).toBeGreaterThanOrEqual(targetDay - 1);
  });

  it("is deterministic: same seed, same season story", () => {
    const runOnce = () => {
      let save = createCareerSave(INPUT, 999333);
      save = playSeason(save);
      return {
        champion: save.history[0].worldsChampionName,
        rank: save.history[0].userRegionRank,
        points: save.history[0].userSeasonPoints,
        balance: save.finances.balance,
        rep: save.reputation,
      };
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it("scrims run on weekdays, cap per week, and build chemistry credit", () => {
    let save = createCareerSave(INPUT, 555222);
    // Day 1 is a Monday — a training day.
    const before = save.squad[0].splitsTogether;
    const first = runScrimFlow(save);
    expect(first.error).toBeUndefined();
    save = first.save;
    expect(save.scrimsThisWeek).toBe(1);
    expect(save.squad[0].splitsTogether).toBeGreaterThan(before);
    const second = runScrimFlow(save);
    expect(second.error).toBeUndefined();
    const third = runScrimFlow(second.save);
    expect(third.error).toBe("used"); // weekly cap
    // Determinism: the same day always produces the same scrim outcome.
    const againA = runScrimFlow(createCareerSave(INPUT, 555222));
    const againB = runScrimFlow(createCareerSave(INPUT, 555222));
    expect(againA.outcome).toEqual(againB.outcome);
  });

  it("releasing a starter never leaves a dangling starter id (crash regression)", () => {
    let save = createCareerSave(INPUT, 314159);
    const victim = save.starterIds[1];
    const res = releasePlayerFlow(save, victim);
    save = res.save;
    expect(res.error).toBeUndefined();
    // starterIds must stay in sync with the squad — the bug left a ghost id here.
    for (const id of save.starterIds) {
      if (id) expect(save.squad.some((p) => p.id === id)).toBe(true);
    }
    // The team assembles without throwing (this is what crashed the top bar).
    expect(() =>
      userTeamFor({
        identity: save.identity,
        squad: save.squad,
        starterIds: save.starterIds,
        coach: save.coach,
        gear: save.finances.gear,
        bootcampSharp: 0,
        seasonIndex: save.clock.seasonIndex,
        careerSeed: save.careerSeed,
        difficulty: save.difficulty,
        unavailablePlayerId: null,
      }),
    ).not.toThrow();
  });

  it("syncSquadRoles repairs a corrupted save (self-heal on load)", () => {
    const save = createCareerSave(INPUT, 271828);
    // Simulate the old bug: a starter id that is no longer on the squad.
    save.squad = save.squad.filter((p) => p.id !== save.starterIds[0]);
    syncSquadRoles(save);
    expect(save.starterIds.filter(Boolean)).toHaveLength(save.squad.length >= 3 ? 3 : save.squad.length);
    for (const id of save.starterIds) {
      if (id) expect(save.squad.some((p) => p.id === id)).toBe(true);
    }
    const starterSet = new Set(save.starterIds);
    for (const p of save.squad) {
      expect(p.role).toBe(starterSet.has(p.id) ? "starter" : "sub");
    }
  });

  it("migrateSaveToV2 upgrades a v1 week-clock save in place", () => {
    // Build a v2 save, then dress it down to a v1 shape.
    const modern = createCareerSave(INPUT, 161803);
    const legacy = structuredClone(modern) as unknown as Record<string, unknown>;
    legacy.saveVersion = 1;
    legacy.clock = { seasonIndex: 0, week: 13 };
    const fin = legacy.finances as Record<string, unknown>;
    delete fin.gear;
    delete fin.freeBootcampsUsedThisSeason;
    fin.facilities = 2;
    fin.psychologist = true;
    fin.bootcampSharp = true;
    delete legacy.mail;
    delete legacy.scrimsThisWeek;
    delete legacy.seq;
    for (const p of (legacy.squad as Record<string, unknown>[]) ?? []) {
      delete p.trainingIntensity;
    }

    const upgraded = migrateSaveToV2(legacy)!;
    expect(upgraded.saveVersion).toBe(2);
    // Week 13 → its Monday on the day grid.
    expect(upgraded.clock.day).toBe((13 - 1) * CAREER_CALENDAR.daysPerWeek + 1);
    // Facilities L2 → peripherals + monitors + pcs; psychologist carried over.
    expect(upgraded.finances.gear).toEqual({
      peripherals: true,
      monitors: true,
      pcs: true,
      perfCenter: false,
      psychologist: true,
    });
    expect(upgraded.finances.bootcampSharp).toBe(CAREER_GEAR.bootcamp[1].sharpRating);
    expect(upgraded.finances.freeBootcampsUsedThisSeason).toBe(0);
    expect(upgraded.mail).toEqual([]);
    expect(upgraded.scrimsThisWeek).toBe(0);
    for (const p of upgraded.squad) expect(p.trainingIntensity).toBe("normal");
    // Idempotent.
    expect(migrateSaveToV2(upgraded)).toBe(upgraded);
  });
});
