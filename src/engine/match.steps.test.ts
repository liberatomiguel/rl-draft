/**
 * Matchday slice 1 — the series in steps (docs/MATCHDAY-SPEC.md §3 B, §10).
 *
 * `simulateSeries` is now a loop over `startSeries` / `playNextGame` /
 * `finishSeries`. These tests pin that the split changed NOTHING: a digest of
 * thousands of varied series (and of the RNG cursor after each one) was taken
 * with the pre-split engine (v2.0.35) and must still match byte for byte.
 */

import { describe, expect, it } from "vitest";
import { specialCards } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import {
  finishSeries,
  isSeriesOver,
  playNextGame,
  simulateSeries,
  startSeries,
  type SeriesOptions,
} from "./match";
import type { Difficulty, SeriesResult, TournamentTeam } from "./types";

/** One special card per effect type, so every effect path is exercised. */
const SPECIAL_POOL: string[] = (() => {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const s of specialCards) {
    if (seen.has(s.effect.type)) continue;
    seen.add(s.effect.type);
    ids.push(s.id);
  }
  return ids;
})();

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "legacy"];
const BEST_OF = [1, 3, 5, 7];

function randomTeam(id: string, rng: Rng): TournamentTeam {
  const rating = 70 + rng.range(0, 30);
  const stat = () => 60 + rng.int(0, 40);
  const specialIds: string[] = [];
  if (SPECIAL_POOL.length > 0 && rng.chance(0.5)) specialIds.push(rng.pick(SPECIAL_POOL));
  if (SPECIAL_POOL.length > 0 && rng.chance(0.25)) specialIds.push(rng.pick(SPECIAL_POOL));
  const names = ["P1", "P2", "P3", "P4"].slice(0, rng.int(0, 3));
  const team: TournamentTeam = {
    id,
    name: id,
    isUser: rng.chance(0.3),
    region: "EU",
    rating: {
      avgPlayerOverall: rating,
      coachMod: 0,
      subMod: 0,
      orgMod: 0,
      chemMod: 0,
      specialMod: 0,
      difficultyShift: 0,
      total: rating,
    },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: {
      offense: stat(),
      defense: stat(),
      mechanics: stat(),
      consistency: stat(),
      experience: stat(),
      clutch: stat(),
    },
    specialIds,
    playerNames: names,
    orgId: "",
  };
  if (rng.chance(0.3)) team.rollRange = [-rng.range(2, 6), rng.range(2, 6)];
  if (rng.chance(0.3)) team.careerScoreline = true;
  return team;
}

interface Case {
  a: TournamentTeam;
  b: TournamentTeam;
  options: SeriesOptions;
  seed: number;
}

function cases(count: number): Case[] {
  const gen = createRng(0x5e1e5);
  const out: Case[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      a: randomTeam(`a${i}`, gen),
      b: randomTeam(`b${i}`, gen),
      options: {
        bestOf: gen.pick(BEST_OF),
        stage: gen.chance(0.5) ? "swiss" : "playoff",
        difficulty: gen.pick(DIFFICULTIES),
      },
      seed: gen.int(1, 0x7fffffff),
    });
  }
  return out;
}

/** FNV-1a over a string — a compact digest of many results. */
function fnv(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Plays a case with `play`; folds every result and the RNG cursor into the digest. */
function digest(play: (c: Case, rng: Rng) => SeriesResult): number {
  let h = 0x811c9dc5;
  for (const c of cases(3000)) {
    const rng = createRng(c.seed);
    // Two series back to back on one cursor, like a round does.
    const r1 = play(c, rng);
    const r2 = play({ ...c, a: c.b, b: c.a }, rng);
    h = fnv(h, JSON.stringify(r1));
    h = fnv(h, JSON.stringify(r2));
    h = fnv(h, String(rng.state));
  }
  return h;
}

/** Digest of `simulateSeries` taken on the pre-split engine (v2.0.35, 9c9e12b). */
const V2_0_35_DIGEST = 947727507;

function stepByStep(c: Case, rng: Rng): SeriesResult {
  let state = startSeries(c.a, c.b, c.options, rng);
  while (!isSeriesOver(state)) state = playNextGame(state, c.a, c.b, rng);
  return finishSeries(state, c.a, c.b);
}

describe("series in steps (Matchday slice 1)", () => {
  it("simulateSeries matches the v2.0.35 engine byte for byte", () => {
    expect(digest((c, rng) => simulateSeries(c.a, c.b, c.options, rng))).toBe(V2_0_35_DIGEST);
  });

  it("driving the steps by hand gives the same results and cursor", () => {
    expect(digest(stepByStep)).toBe(V2_0_35_DIGEST);
  });

  it("the steps never mutate the state they are given", () => {
    for (const c of cases(200)) {
      const rng = createRng(c.seed);
      let state = startSeries(c.a, c.b, c.options, rng);
      while (!isSeriesOver(state)) {
        const before = JSON.stringify(state);
        const next = playNextGame(state, c.a, c.b, rng);
        expect(JSON.stringify(state)).toBe(before);
        expect(next.games.length).toBe(state.games.length + 1);
        state = next;
      }
      const before = JSON.stringify(state);
      finishSeries(state, c.a, c.b);
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("the state is plain JSON and resumes after a round trip", () => {
    for (const c of cases(200)) {
      const ref = simulateSeries(c.a, c.b, c.options, createRng(c.seed));
      const rng = createRng(c.seed);
      let state = startSeries(c.a, c.b, c.options, rng);
      let cursor = rng.state;
      while (!isSeriesOver(state)) {
        // Save and reload between every game, as the career will.
        state = JSON.parse(JSON.stringify(state));
        const resumed = createRng(cursor);
        state = playNextGame(state, c.a, c.b, resumed);
        cursor = resumed.state;
      }
      expect(finishSeries(state, c.a, c.b)).toEqual(ref);
    }
  });

  it("playing past the end of a series throws", () => {
    const c = cases(1)[0];
    const rng = createRng(c.seed);
    let state = startSeries(c.a, c.b, c.options, rng);
    while (!isSeriesOver(state)) state = playNextGame(state, c.a, c.b, rng);
    expect(() => playNextGame(state, c.a, c.b, rng)).toThrow();
  });

  it("finishing an unfinished series throws", () => {
    const c = cases(1)[0];
    const state = startSeries(c.a, c.b, c.options, createRng(c.seed));
    expect(() => finishSeries(state, c.a, c.b)).toThrow();
  });

  it("the teams must match the state", () => {
    const c = cases(1)[0];
    const state = startSeries(c.a, c.b, c.options, createRng(c.seed));
    expect(() => playNextGame(state, c.b, c.a, createRng(1))).toThrow();
  });
});
