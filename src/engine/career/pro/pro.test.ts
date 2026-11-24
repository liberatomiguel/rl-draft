/**
 * v2.2 Pro slice 1 (PRO-SPEC §4.1, R148): creating the player and the
 * training growth curve.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PRO } from "@/config/balance";
import { playerViewById, statsFromView } from "../development";
import { cleanProName, createProSave, startAttrsFor, talentFor } from "./create";
import {
  PRO_STAT_KEYS,
  blockGains,
  gapFactorFor,
  proAgeOf,
  proOverall,
  trainBlock,
  trainSaveBlock,
  weakestStat,
} from "./growth";
import type { CreateProInput, ProPlayer } from "./types";
import { PRO_SELF_ID } from "./world";

const INPUT: CreateProInput = {
  name: "Rookie",
  country: "br",
  region: "SAM",
  startAge: 13,
  archetype: "mechanical",
  difficulty: "normal",
};

/** Training blocks a season of the full game gives a well-run Pro (two a week, ~28 weeks). */
const BLOCKS_PER_SEASON = 56;

/** Train the weakest attribute every block from the start age to `untilAge`; overall at the end. */
function project(player: ProPlayer, untilAge: number, coachOverall: number | null): number {
  let p = player;
  for (let s = 0; proAgeOf(p, s) <= untilAge; s++) {
    for (let b = 0; b < BLOCKS_PER_SEASON; b++) {
      p = trainBlock(p, weakestStat(p.attrs), { seasonIndex: s, coachOverall });
    }
  }
  return proOverall(p.attrs);
}

describe("Pro: creation", () => {
  it("is deterministic per seed", () => {
    expect(JSON.stringify(createProSave(INPUT, 42, "test"))).toBe(JSON.stringify(createProSave(INPUT, 42, "test")));
  });

  it("starts in the ranked prologue at the chosen age, with no team and no ceiling on the player", () => {
    const save = createProSave(INPUT, 7, "test");
    expect(save.kind).toBe("pro");
    expect(save.stage).toBe("ranked");
    expect(save.team).toBeNull();
    expect(proAgeOf(save.player, 0)).toBe(13);
    expect(proAgeOf(createProSave({ ...INPUT, startAge: 14 }, 7, "test").player, 0)).toBe(14);
    expect(save.player).not.toHaveProperty("potential");
    expect(save.player.country).toBe("BR");
  });

  it("starts near the start-age overall, the style leaning to its two attributes", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const attrs = startAttrsFor(INPUT, seed);
      expect(Math.abs(proOverall(attrs) - CAREER_PRO.startOverall[13])).toBeLessThanOrEqual(CAREER_PRO.startJitter);
      expect(attrs.mechanics).toBeGreaterThan(attrs.defense);
      expect(attrs.offense).toBeGreaterThan(attrs.clutch);
    }
    const allround = startAttrsFor({ startAge: 14, archetype: "allround" }, 9);
    for (const k of PRO_STAT_KEYS) expect(Math.abs(allround[k] - CAREER_PRO.startOverall[14])).toBeLessThanOrEqual(CAREER_PRO.startJitter);
  });

  it("keeps the talent inside its range, and seeds differ", () => {
    const talents = Array.from({ length: 200 }, (_, i) => talentFor(i + 1));
    for (const t of talents) {
      expect(t).toBeGreaterThanOrEqual(CAREER_PRO.talentRange[0]);
      expect(t).toBeLessThanOrEqual(CAREER_PRO.talentRange[1]);
    }
    expect(new Set(talents).size).toBeGreaterThan(100);
  });

  it("checks the nickname", () => {
    expect(cleanProName("  Zen  ")).toBe("Zen");
    expect(cleanProName("a")).toBeNull();
    expect(cleanProName("x".repeat(CAREER_PRO.nameMax + 1))).toBeNull();
    expect(() => createProSave({ ...INPUT, name: " " }, 1, "test")).toThrow();
  });

  it("puts him in the world: playerViewById resolves pro:self with his attributes", () => {
    const save = createProSave({ ...INPUT, startAge: 14 }, 11, "test");
    const view = playerViewById(PRO_SELF_ID, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world });
    expect(view?.name).toBe("Rookie");
    expect(view?.age).toBe(14);
    expect(view?.archetype).toBe("mechanical");
    // The world floors attributes at 60; above it his stats are his own.
    const grown = { ...save.player, attrs: { ...save.player.attrs, mechanics: 81.4, offense: 77.2 } };
    const synced = trainSaveBlock({ ...save, player: grown }, "defense");
    const v2 = playerViewById(PRO_SELF_ID, { careerSeed: save.careerSeed, seasonIndex: 0, world: synced.world })!;
    const stats = statsFromView(v2);
    expect(stats.mechanics).toBe(81);
    expect(stats.offense).toBe(77);
    expect(stats.defense).toBe(60);
  });

  it("is absent from a world that has no Pro (a manager career)", () => {
    const save = createProSave(INPUT, 3, "test");
    const world = { ...save.world, proSelf: undefined };
    expect(playerViewById(PRO_SELF_ID, { careerSeed: 3, seasonIndex: 0, world })).toBeNull();
  });
});

describe("Pro: training growth", () => {
  const base = createProSave(INPUT, 5, "test").player;

  it("a focused block raises only that attribute; balanced spreads", () => {
    const focused = trainBlock(base, "defense", { seasonIndex: 0, coachOverall: null });
    for (const k of PRO_STAT_KEYS) {
      if (k === "defense") expect(focused.attrs[k]).toBeGreaterThan(base.attrs[k]);
      else expect(focused.attrs[k]).toBe(base.attrs[k]);
    }
    const balanced = trainBlock(base, "balanced", { seasonIndex: 0, coachOverall: null });
    for (const k of PRO_STAT_KEYS) expect(balanced.attrs[k]).toBeGreaterThan(base.attrs[k]);
  });

  it("talent, a coach and energy each speed it up; age slows it", () => {
    const g = (p: ProPlayer, coach: number | null, season = 0) =>
      blockGains(p, "defense", { seasonIndex: season, coachOverall: coach }).defense!;
    expect(g({ ...base, talent: 1.15 }, null)).toBeGreaterThan(g({ ...base, talent: 0.85 }, null));
    expect(g(base, 90)).toBeGreaterThan(g(base, null));
    expect(g(base, 95)).toBeCloseTo(g(base, null) * (1 + CAREER_PRO.growth.coachMax));
    expect(g({ ...base, energy: 10 }, null)).toBeLessThan(g(base, null));
    expect(g(base, null, 6)).toBeLessThan(g(base, null, 0));
  });

  it("slows near 99 but never stops below it, and never passes it", () => {
    expect(gapFactorFor(98.9)).toBeGreaterThan(0);
    expect(gapFactorFor(99)).toBe(0);
    let p: ProPlayer = { ...base, attrs: { ...base.attrs, clutch: 98.95 } };
    for (let i = 0; i < 20; i++) p = trainBlock(p, "clutch", { seasonIndex: 0, coachOverall: 95 });
    expect(p.attrs.clutch).toBe(99);
  });

  it("logs every training change it explains", () => {
    const save = trainSaveBlock(createProSave(INPUT, 5, "test"), "balanced");
    expect(save.growthLog).toHaveLength(6);
    expect(save.growthLog.every((e) => e.source === "training" && e.delta > 0)).toBe(true);
    let s = save;
    for (let i = 0; i < 20; i++) s = trainSaveBlock(s, "balanced");
    expect(s.growthLog.length).toBe(CAREER_PRO.growthLogCap);
  });

  // The slice-1 share of PRO-SPEC §4.1's targets: training alone, before match
  // XP (slice 3) and the week's other sources. The slice 7 battery retunes.
  it("training alone: a median talent reaches the high 80s by his peak, a top one with a good coach the low 90s", () => {
    const median = project({ ...base, talent: 1, peakAge: 22 }, 22, null);
    const top = project({ ...base, talent: 1.15, peakAge: 22 }, 22, 90);
    const low = project({ ...base, talent: 0.85, peakAge: 22 }, 22, null);
    // Measured 24/11: low 84.2, median 87.7, top with a coach of 90 93.4.
    expect(median).toBeGreaterThanOrEqual(84);
    expect(median).toBeLessThanOrEqual(90);
    expect(top).toBeGreaterThanOrEqual(91);
    expect(top).toBeLessThanOrEqual(97);
    expect(low).toBeLessThan(median);
  });
});
