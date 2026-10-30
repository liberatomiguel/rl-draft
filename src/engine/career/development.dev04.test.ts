/**
 * DEV-04 (rc.33, revisits DEV-01e) — honest potential: a band at most 5–6
 * wide that never reads much higher than the truth, an older player who
 * shows no potential he can no longer reach, a phase tag that reads "?"
 * until a report reveals it, and a bought report that never moves the wrong
 * way.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SCOUT } from "@/config/balance";
import {
  developmentPhaseOf,
  developmentProfileOf,
  exactAgeOf,
  nestedBand,
  phaseTagFor,
  playerViewById,
  rc31Band,
  reachableOverallOf,
  scoutedBand,
} from "./development";
import type { CareerPlayerView, ScoutLevel } from "./types";
import { buildWorldAtCreation } from "./worldSim";

const SEED = 33_004;
const LEVELS: ScoutLevel[] = [0, 1, 2, 3];

const sample = (): CareerPlayerView[] => {
  const w = buildWorldAtCreation(SEED);
  const ctx = { careerSeed: SEED, seasonIndex: 0, world: w };
  const ids = [...new Set([...Object.values(w.orgs).flatMap((o) => o.playerIds), ...w.freeAgentIds])];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
};
const PLAYERS = sample();

describe("DEV-04 — honest potential bands", () => {
  it("a band is at most 5 wide (Miguel: 5–6) and its top never more than bandMaxAbove over the truth", () => {
    expect(PLAYERS.length).toBeGreaterThan(300);
    for (const v of PLAYERS) {
      const truth = Math.round(v.potential);
      for (const level of LEVELS) {
        const b = scoutedBand(v.potential, v.overall, level, SEED, v.id, 2);
        expect(b.max - b.min).toBeLessThanOrEqual(CAREER_SCOUT.honestWidthByLevel[level]);
        expect(b.max - b.min).toBeLessThanOrEqual(6);
        expect(b.max - truth).toBeLessThanOrEqual(CAREER_SCOUT.bandMaxAbove);
        expect(b.min).toBeLessThanOrEqual(truth);
        expect(b.max).toBeGreaterThanOrEqual(truth);
        expect(b.min).toBeGreaterThanOrEqual(60);
        expect(b.max).toBeLessThanOrEqual(99);
      }
    }
  });

  it("no known player reads 99 unless his potential is within bandMaxAbove of it (rc.32: a 91 could read 89–99)", () => {
    for (const v of PLAYERS) {
      const b = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2);
      if (b.max === 99) expect(Math.round(v.potential)).toBeGreaterThanOrEqual(99 - CAREER_SCOUT.bandMaxAbove);
    }
    // rc.32's band did put far lower potentials at 99 — the case Miguel saw.
    const rc32At99 = PLAYERS.filter((v) => nestedBand(v.potential, 0, SEED, v.id).max === 99 && v.potential <= 93);
    expect(rc32At99.length).toBeGreaterThan(0);
  });

  it("the free level-0 band keeps its full width away from the 60 / 99 edges", () => {
    for (const v of PLAYERS) {
      const truth = Math.round(v.potential);
      if (truth < 66 || truth > 94) continue;
      const b = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2);
      expect(b.max - b.min).toBe(CAREER_SCOUT.honestWidthByLevel[0]);
    }
  });

  it("each report narrows inside the one before, and keeps its full width in a new career", () => {
    for (const v of PLAYERS) {
      const b = LEVELS.map((l) => scoutedBand(v.potential, v.overall, l, SEED, v.id, 2));
      for (let l = 1; l < 4; l++) {
        expect(b[l].min).toBeGreaterThanOrEqual(b[l - 1].min);
        expect(b[l].max).toBeLessThanOrEqual(b[l - 1].max);
      }
      expect(b[3].min).toBe(b[3].max);
      const truth = Math.round(v.potential);
      if (truth >= 66 && truth <= 94)
        for (const l of [1, 2] as ScoutLevel[]) expect(b[l].max - b[l].min).toBe(CAREER_SCOUT.honestWidthByLevel[l]);
      // Deterministic: the same call reads the same band.
      expect(scoutedBand(v.potential, v.overall, 1, SEED, v.id, 2)).toEqual(b[1]);
    }
  });

  it("in a career created before rc.33 a bought report only narrows: every level ≥ 1 sits inside rc.32's band", () => {
    for (const v of PLAYERS) {
      const b = LEVELS.map((l) => scoutedBand(v.potential, v.overall, l, SEED, v.id, 2, { rc32Reports: true }));
      for (let l = 1; l < 4; l++) {
        expect(b[l].min).toBeGreaterThanOrEqual(b[l - 1].min);
        expect(b[l].max).toBeLessThanOrEqual(b[l - 1].max);
        const was = nestedBand(v.potential, LEVELS[l], SEED, v.id);
        expect(b[l].min).toBeGreaterThanOrEqual(was.min);
        expect(b[l].max).toBeLessThanOrEqual(was.max);
        expect(b[l].max - b[l].min).toBeLessThanOrEqual(CAREER_SCOUT.honestWidthByLevel[l]);
        expect(b[l].max - Math.round(v.potential)).toBeLessThanOrEqual(CAREER_SCOUT.bandMaxAbove);
      }
      // The free level 0 is the same honest band in both.
      expect(b[0]).toEqual(scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2));
    }
  });
});

describe("DEV-04 — an older player shows no potential he can no longer reach", () => {
  it("past his plateau the band tops at his current overall (development.ts's own model: growth ends with the plateau)", () => {
    let checked = 0;
    for (const v of PLAYERS) {
      const plateauEnd = v.peakAge + developmentProfileOf(v.id, SEED).plateauYears;
      const arc = { peakAge: v.peakAge, exactAge: plateauEnd + 0.4 };
      expect(reachableOverallOf(v, arc.exactAge, SEED)).toBe(v.overall);
      for (const level of LEVELS) {
        const b = scoutedBand(v.potential, v.overall, level, SEED, v.id, 2, { arc });
        expect(b.max).toBeLessThanOrEqual(Math.round(v.overall));
        expect(b.min).toBeLessThanOrEqual(b.max);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("the cap only ever lowers the top, never under what he can still reach, and never rises while he ages", () => {
    for (const v of PLAYERS.slice(0, 200)) {
      const open = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2);
      let prevMax = Infinity;
      for (let t = 0; t <= 8; t += 0.25) {
        const exactAge = exactAgeOf(v.age, 1) + t;
        const b = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2, { arc: { peakAge: v.peakAge, exactAge } });
        expect(b.max).toBeLessThanOrEqual(open.max);
        expect(b.max).toBeGreaterThanOrEqual(Math.min(open.max, Math.round(reachableOverallOf(v, exactAge, SEED))));
        expect(b.max).toBeLessThanOrEqual(prevMax);
        prevMax = b.max;
      }
    }
  });

  it("a market veteran past his plateau today reads no headroom", () => {
    const vets = PLAYERS.filter(
      (v) => exactAgeOf(v.age, 1) >= v.peakAge + developmentProfileOf(v.id, SEED).plateauYears,
    );
    expect(vets.length).toBeGreaterThan(10);
    for (const v of vets) {
      const arc = { peakAge: v.peakAge, exactAge: exactAgeOf(v.age, 1) };
      const b = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 2, { arc });
      expect(b.max).toBeLessThanOrEqual(Math.round(v.overall));
    }
  });
});

describe("DEV-04 — the phase tag", () => {
  it("reads unknown until a report reveals it, then the real development state", () => {
    const seen = new Set<string>();
    for (const v of PLAYERS) {
      const ctx = { careerSeed: SEED, model: 2, seasonAge: v.age, day: 40 };
      expect(phaseTagFor(v, { ...ctx, level: 0 })).toBe("unknown");
      const real = developmentPhaseOf(exactAgeOf(v.age, 40), {
        peakAge: v.peakAge,
        plateauYears: developmentProfileOf(v.id, SEED).plateauYears,
      });
      for (const level of [1, 2, 3] as ScoutLevel[]) expect(phaseTagFor(v, { ...ctx, level })).toBe(real);
      seen.add(real);
    }
    expect([...seen].sort()).toEqual(["declining", "growing", "peak"]);
  });

  it("an rc.31 career (model 1) keeps the fixed ages 20 / 22", () => {
    const p = { id: "fic:EU:1", peakAge: 21 };
    const tag = (seasonAge: number) => phaseTagFor(p, { level: 1, careerSeed: SEED, model: 1, seasonAge });
    expect(tag(19)).toBe("growing");
    expect(tag(21)).toBe("peak");
    expect(tag(25)).toBe("declining");
    expect(phaseTagFor(p, { level: 0, careerSeed: SEED, model: 1, seasonAge: 25 })).toBe("unknown");
  });
});

describe("DEV-04 on model 1 — careers created on rc.31 (rc.33 review)", () => {
  // rc.31's development (no growthModel on the world): its potential is the ceiling training climbs to.
  const MODEL1: CareerPlayerView[] = (() => {
    const w = structuredClone(buildWorldAtCreation(SEED));
    delete (w as { growthModel?: number }).growthModel;
    const ctx = { careerSeed: SEED, seasonIndex: 0, world: w };
    const ids = [...new Set([...Object.values(w.orgs).flatMap((o) => o.playerIds), ...w.freeAgentIds])];
    return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
  })();

  it("reads the honest band on its potential: the honest width, a top at most bandMaxAbove over the truth, floored at the overall", () => {
    expect(MODEL1.length).toBeGreaterThan(300);
    let rc31Wide = 0;
    for (const v of MODEL1) {
      const truth = Math.round(v.potential);
      expect(v.potential).toBeGreaterThanOrEqual(v.overall);
      for (const level of LEVELS) {
        const b = scoutedBand(v.potential, v.overall, level, SEED, v.id, 1);
        expect(b.max - b.min).toBeLessThanOrEqual(CAREER_SCOUT.honestWidthByLevel[level]);
        expect(b.max - truth).toBeLessThanOrEqual(CAREER_SCOUT.bandMaxAbove);
        expect(b.min).toBeLessThanOrEqual(truth);
        expect(b.max).toBeGreaterThanOrEqual(truth);
        expect(b.min).toBeGreaterThanOrEqual(Math.floor(v.overall));
        // An absent model is model 1.
        expect(scoutedBand(v.potential, v.overall, level, SEED, v.id)).toEqual(b);
      }
      // The reproduction: rc.31's level-0 band, up to 10 wide.
      const old = rc31Band(v.potential, v.overall, 0, SEED, v.id);
      if (old.max - old.min > 6 || old.max - truth > CAREER_SCOUT.bandMaxAbove) rc31Wide += 1;
    }
    expect(rc31Wide).toBeGreaterThan(MODEL1.length / 2);
  });

  it("a bought report only narrows: each level nests in the one before and stays inside the band rc.31 showed at that level", () => {
    for (const v of MODEL1) {
      const b = LEVELS.map((l) => scoutedBand(v.potential, v.overall, l, SEED, v.id, 1));
      for (let l = 1; l < LEVELS.length; l++) {
        expect(b[l].min).toBeGreaterThanOrEqual(b[l - 1].min);
        expect(b[l].max).toBeLessThanOrEqual(b[l - 1].max);
        const was = rc31Band(v.potential, v.overall, LEVELS[l], SEED, v.id);
        expect(b[l].min).toBeGreaterThanOrEqual(was.min);
        expect(b[l].max).toBeLessThanOrEqual(was.max);
      }
    }
  });

  it("no age cap on model 1 — its growth never stops by age, so the arc changes nothing", () => {
    for (const v of MODEL1.slice(0, 150)) {
      const plain = scoutedBand(v.potential, v.overall, 0, SEED, v.id, 1);
      expect(scoutedBand(v.potential, v.overall, 0, SEED, v.id, 1, { arc: { peakAge: 18, exactAge: 29 } })).toEqual(plain);
    }
  });
});
