/**
 * rc.51 — the Road to Worlds facts behind the new cosmetics: Passport Stamped
 * (a Major berth), Day One (Worlds won by the starters registered as split 1
 * opened, unchanged) and Regional Dynasty (every main regional and Worlds in
 * one season). The flows leave flags; `careerCosmeticMarks` turns them into the
 * permanent marks the profile mirrors.
 */
import { describe, expect, it } from "vitest";
import { ACH_FLAGS, careerCosmeticMarks, sameStarters } from "@/engine/career/achievements";
import { firstDayOfWeek, seasonSchedule } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import {
  advanceDayFlow,
  chooseSponsorFlow,
  createCareerSave,
  declineBidFlow,
  finishEvent,
  isEventPaused,
  resolveInsertFlow,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Day One Org",
    abbrev: "DAY",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "easy",
  style: "balanced",
  rosterKey: "balanced",
};

function makeSave(seed = 51_051): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 600_000;
  // A squad that wins: the test is about the bookkeeping, not the balance.
  for (const p of save.squad) p.overall = 99;
  return save;
}

/** Plays season one through the real flows. `beforeEvent` may edit the save. */
function playSeason(save: CareerSave, beforeEvent?: (s: CareerSave, officialEvents: number) => void): { save: CareerSave; regionalsWon: number; wonWorlds: boolean; berth: boolean } {
  let official = 0;
  let regionalsWon = 0;
  let wonWorlds = false;
  let berth = false;
  let guard = 0;
  while (save.phase === "running" && save.clock.seasonIndex === 0 && guard++ < 500) {
    if (save.competition.majorFieldRefs?.includes("user")) berth = true;
    if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) {
      const def = save.pendingEventDef;
      if (!def.teamSize) beforeEvent?.(save, official);
      save = simEventToEnd(startEvent(save, false));
      if (isEventPaused(save)) save = simEventToEnd(advanceDayFlow(save));
      const champion = save.activeEvent!.tournament.playoffs?.championTeamId === "user";
      save = finishEvent(save);
      if (!def.teamSize) official += 1;
      if (champion && def.tier === "regional") regionalsWon += 1;
      if (champion && def.tier === "worlds") wonWorlds = true;
      if (def.tier === "worlds") break;
      continue;
    }
    if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
    if (save.sponsorOffers?.length) save = chooseSponsorFlow(save, save.sponsorOffers[0].sponsorId).save;
    for (const o of save.pendingOffers.filter((x) => x.status === "pending" && x.direction === "out")) save = declineBidFlow(save, o.id);
    const day = save.clock.day;
    save = advanceDayFlow(save);
    if (save.clock.day === day && !save.pendingEventDef) break;
  }
  return { save, regionalsWon, wonWorlds, berth };
}

describe("career cosmetic marks (rc.51)", () => {
  it("marks follow the flags; a save that already played a Major has the berth", () => {
    const save = makeSave();
    expect(careerCosmeticMarks(save)).toEqual([]);
    save.flags[ACH_FLAGS.majorBerth] = true;
    save.flags[ACH_FLAGS.dayOne] = true;
    save.flags[ACH_FLAGS.regionalDynasty] = true;
    expect(careerCosmeticMarks(save)).toEqual(["car-major-berth", "car-day-one", "car-regional-dynasty"]);
    const old = makeSave();
    old.stats.majorsQualified = 1;
    expect(careerCosmeticMarks(old)).toEqual(["car-major-berth"]);
  });

  it("sameStarters compares the fielded three as a set", () => {
    expect(sameStarters(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(sameStarters(["a", "b", "d"], ["a", "b", "c"])).toBe(false);
    expect(sameStarters(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("split 1 registers the starters; an unchanged season keeps Day One alive, and the Worlds win decides both rewards", () => {
    const start = makeSave();
    const registered = [...start.starterIds];
    const { save, regionalsWon, wonWorlds, berth } = playSeason(start);
    expect(save.clock.day).toBeGreaterThan(firstDayOfWeek(3));
    expect(save.dayOne).toEqual({ seasonIndex: 0, starterIds: registered, broken: false });
    const flags = save.flags as Record<string, unknown>;
    expect(Boolean(flags[ACH_FLAGS.majorBerth])).toBe(berth);
    expect(Boolean(flags[ACH_FLAGS.dayOne])).toBe(wonWorlds);
    const regionals = seasonSchedule().filter((w) => w.kind === "regional").length;
    expect(regionals).toBeGreaterThan(0);
    expect(Boolean(flags[ACH_FLAGS.regionalDynasty])).toBe(wonWorlds && regionalsWon === regionals);
    expect(careerCosmeticMarks(save).includes("car-day-one")).toBe(wonWorlds);
  }, 180_000);

  it("fielding the substitute once ends the Day One run for the season, even after the original three return", () => {
    const start = makeSave();
    const original = [...start.starterIds] as [string, string, string];
    // A new org starts with three players: give it a substitute to field.
    start.squad.push({ ...start.squad[0], id: "test:stand-in", name: "Stand-in", role: "sub" });
    let swapped = false;
    const { save } = playSeason(start, (s, officialEvents) => {
      const sub = s.squad.find((p) => p.role === "sub");
      // One official event inside split 1 with the substitute, then back.
      if (s.dayOne && !swapped && sub && officialEvents >= 1) {
        s.starterIds = [original[0], original[1], sub.id];
        swapped = true;
      } else if (swapped) {
        s.starterIds = [...original];
      }
    });
    expect(swapped).toBe(true);
    expect(save.dayOne?.broken).toBe(true);
    expect(save.dayOne?.starterIds).toEqual(original);
    expect(Boolean((save.flags as Record<string, unknown>)[ACH_FLAGS.dayOne])).toBe(false);
    expect(careerCosmeticMarks(save)).not.toContain("car-day-one");
  }, 180_000);
});
