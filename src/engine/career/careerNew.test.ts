/**
 * rc.34 (ROADMAP UX-06 + "New markers (all areas)"; DESIGN-DECISIONS #154's
 * model): the career save's scope. Identity (`ct:` / `tb:` keys) + the save
 * as the scope + the seen state; an existing save sees nothing new; the first
 * arrival seeds the state so exactly it is new; opening clears; contracts
 * (urgent) come before the toolbox; the unlock modal owes each novelty once.
 */

import { describe, expect, it } from "vitest";
import { CAREER_GEAR, CAREER_HQ } from "@/config/balance";
import { markSeen } from "@/engine/newItems";
import { firstDayOfWeek } from "./calendar";
import {
  careerAvailableKeys,
  careerNewDotsOf,
  careerNewSummary,
  contractNewKey,
  contractWarnsFor,
  seedCareerNew,
  toolboxNewKey,
  toolboxUnannouncedOf,
  toolboxUnlockedIds,
} from "./careerNew";
import type { CareerSave } from "./types";
import { createCareerSave } from "@/store/careerFlow";

const INPUT = {
  identity: {
    orgName: "New Org",
    abbrev: "NEW",
    managerName: "Bot",
    country: "BR",
    region: "SAM" as const,
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency" as const,
  },
  difficulty: "normal" as const,
  style: "balanced" as const,
  rosterKey: "balanced" as const,
};

const base = (): CareerSave => createCareerSave(INPUT, 34_201);

describe("rc.34 UX-06 — the career save's available keys", () => {
  it("toolbox: unlocked by reputation and not owned (unlocked ≠ bought); one bootcamp tier at a time", () => {
    const save = base();
    expect(toolboxUnlockedIds({ ...save, reputation: 5 })).toEqual([]);
    expect(toolboxUnlockedIds({ ...save, reputation: 8 })).toEqual(["peripherals"]);
    expect(toolboxUnlockedIds({ ...save, reputation: 30 })).toEqual(["peripherals", "monitors", "pcs", "bootcamp1"]);
    expect(toolboxUnlockedIds({ ...save, reputation: CAREER_GEAR.bootcamp[1].repGate })).toContain("bootcamp2");
    expect(toolboxUnlockedIds({ ...save, reputation: CAREER_GEAR.bootcamp[1].repGate })).not.toContain("bootcamp1");
    const owned = { ...save, reputation: 30, finances: { ...save.finances, gear: { ...save.finances.gear, peripherals: true } } };
    expect(toolboxUnlockedIds(owned)).not.toContain("peripherals");
  });

  it("contracts: only a final-season deal, from the warning week (or in the season review); urgent first", () => {
    const save = base();
    save.reputation = 30;
    save.squad[0].contractEndSeason = 0;
    expect(contractWarnsFor(save, save.squad[0])).toBe(false); // week 1: not yet
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(CAREER_HQ.contractWarnFromWeek) };
    expect(contractWarnsFor(save, save.squad[0])).toBe(true);
    expect(contractWarnsFor(save, save.squad[1])).toBe(false); // his deal runs on
    const keys = careerAvailableKeys(save);
    expect(keys[0]).toBe(contractNewKey(save.squad[0].id, 0));
    expect(keys.slice(1).every((k) => k.startsWith("tb:"))).toBe(true);
    expect(careerAvailableKeys({ ...save, phase: "ended" })).toEqual([]);
  });
});

describe("rc.34 UX-06 — seen state: nothing new on an existing save, the arrival is new, opening clears", () => {
  it("an existing save (no state) sees nothing new, whatever it can show", () => {
    const save = base();
    save.reputation = 40;
    save.squad[0].contractEndSeason = 0;
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(25) };
    expect(careerAvailableKeys(save).length).toBeGreaterThan(3);
    expect(careerNewSummary(save)).toMatchObject({ contracts: [], toolbox: [] });
    expect(careerNewDotsOf(careerNewSummary(save))).toEqual({ squad: false, finances: false });
  });

  it("the first write that adds a key seeds from before it — exactly the arrival is new; a later one too", () => {
    const prev = base();
    prev.reputation = 25;
    const next = { ...prev, reputation: 26 }; // the bootcamp unlocks
    expect(seedCareerNew(prev, prev)).toBeUndefined(); // no arrival, nothing written
    const seeded = seedCareerNew(prev, next)!;
    expect(seeded.seen).toEqual([...careerAvailableKeys(prev)].sort());
    const withState = { ...next, newItems: seeded };
    expect(careerNewSummary(withState).toolbox).toEqual(["bootcamp1"]);
    expect(careerNewDotsOf(careerNewSummary(withState))).toEqual({ squad: false, finances: true });
    // Already seeded: the store writes nothing more; the next arrival is new by the same state.
    expect(seedCareerNew(withState, { ...withState, reputation: 38 })).toBeUndefined();
    // Opening clears it (markSeen), and only it.
    const opened = { ...withState, newItems: markSeen(withState.newItems, [toolboxNewKey("bootcamp1")], careerAvailableKeys(withState)) };
    expect(careerNewSummary(opened).toolbox).toEqual([]);
  });

  it("a contract entering its final stretch is new (urgent, the Squad tab's dot); renewed later, it would be a new key", () => {
    const prev = base();
    prev.squad[0].contractEndSeason = 0;
    prev.clock = { seasonIndex: 0, day: firstDayOfWeek(CAREER_HQ.contractWarnFromWeek) - 1 };
    const next = { ...prev, clock: { seasonIndex: 0, day: firstDayOfWeek(CAREER_HQ.contractWarnFromWeek) } };
    const state = seedCareerNew(prev, next)!;
    const s = careerNewSummary({ ...next, newItems: state });
    expect(s.contracts).toEqual([prev.squad[0].id]);
    expect(careerNewDotsOf(s).squad).toBe(true);
    expect(contractNewKey(prev.squad[0].id, 0)).not.toBe(contractNewKey(prev.squad[0].id, 2));
  });

  it("the unlock modal owes each novelty once: announced, it stays New until opened", () => {
    const prev = { ...base(), reputation: 25 };
    const save = { ...prev, reputation: 26, newItems: seedCareerNew(prev, { ...prev, reputation: 26 }) };
    expect(toolboxUnannouncedOf(save)).toEqual(["bootcamp1"]);
    const announced = { ...save, newAnnounced: [toolboxNewKey("bootcamp1")] };
    expect(toolboxUnannouncedOf(announced)).toEqual([]);
    expect(careerNewSummary(announced).toolbox).toEqual(["bootcamp1"]);
  });
});
