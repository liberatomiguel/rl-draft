/**
 * Career v2.0 (R40) — the Swiss-ONLY tournament shape (the regional
 * qualifier) and the Swiss → playoffs boundary a two-day Major/Worlds pauses
 * on. Additive by contract: the existing "swiss" / "single" shapes and every
 * Draft mode draw exactly as before (the golden master locks the draws; this
 * file locks the state SHAPE and the boundary helpers).
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import {
  asSwissOnly,
  atPlayoffsStart,
  fastForward,
  initFieldTournament,
  initTournament,
  playNextRound,
  userHasPendingSeries,
  userIsAlive,
} from "./tournament";
import type { Stats, TournamentState, TournamentTeam } from "./types";

function fakeTeam(id: string, rating: number, statsShift = 0): TournamentTeam {
  const stat = (v: number) => Math.min(99, Math.max(60, v));
  const stats: Stats = {
    offense: stat(rating + statsShift),
    defense: stat(rating - statsShift),
    mechanics: stat(rating),
    consistency: stat(rating),
    experience: stat(rating),
    clutch: stat(rating),
  };
  return {
    id,
    name: id,
    isUser: id === "user",
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
    chemistry: { raw: 0, max: 10, percent: 0, tier: "Poor", items: [] },
    stats,
    specialIds: [],
    playerNames: [`${id}-a`, `${id}-b`, `${id}-c`],
    orgId: id,
  };
}

function field(size = 16): TournamentTeam[] {
  return Array.from({ length: size }, (_, i) =>
    fakeTeam(i === 0 ? "user" : `t${String(i).padStart(2, "0")}`, 92.5 - i * 0.75, (i % 3) - 1),
  );
}

/** Plays rounds until the Swiss stage is complete. */
function throughSwiss(state: TournamentState, seedState: number): { t: TournamentState; rngState: number } {
  const rng = createRng(seedState);
  let t = state;
  let guard = 0;
  while (!t.swiss.finished && guard++ < 8) t = playNextRound(t, "normal", rng);
  return { t, rngState: rng.state };
}

describe("Swiss-only tournaments (R40)", () => {
  it("the existing shapes keep their exact state shape (no swissOnly key)", () => {
    const swiss = initFieldTournament(field(), "swiss", createRng(1));
    const single = initFieldTournament(field(8), "single", createRng(1));
    expect(Object.keys(swiss)).not.toContain("swissOnly");
    expect(Object.keys(single)).not.toContain("swissOnly");
    const draft = initTournament(fakeTeam("user", 85), "normal", createRng(7), { mode: "classic" });
    expect(Object.keys(draft)).not.toContain("swissOnly");
    // Through the Swiss the classic shape still opens its playoffs.
    const { t } = throughSwiss(swiss, 99);
    expect(t.stage).toBe("playoffs");
    expect(t.playoffs?.seeds).toHaveLength(8);
  });

  it("draws the SAME Swiss as the full shape, then finishes there with playoffs null", () => {
    for (const seed of [20260709, 555555, 4242]) {
      const rngA = createRng(seed);
      const rngB = createRng(seed);
      const full = initFieldTournament(field(), "swiss", rngA);
      const only = initFieldTournament(field(), "swissOnly", rngB);
      expect(only.swissOnly).toBe(true);
      expect(only.swiss).toEqual(full.swiss);
      const a = throughSwiss(full, rngA.state);
      const b = throughSwiss(only, rngB.state);
      expect(b.t.swiss).toEqual(a.t.swiss);
      expect(b.rngState).toBe(a.rngState);
      expect(b.t.stage).toBe("finished");
      expect(b.t.playoffs).toBeNull();
      expect(a.t.stage).toBe("playoffs");
      // A finished Swiss-only state is inert: no further draw, nothing pending.
      const rng = createRng(b.rngState);
      expect(playNextRound(b.t, "normal", rng)).toBe(b.t);
      expect(rng.state).toBe(b.rngState);
      expect(userIsAlive(b.t)).toBe(false);
      expect(userHasPendingSeries(b.t)).toBe(false);
    }
  });

  it("always ends 8 advanced / 8 eliminated in at most 5 rounds (40 seeds)", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed * 7919);
      const t = fastForward(initFieldTournament(field(), "swissOnly", rng), "normal", rng);
      expect(t.stage).toBe("finished");
      expect(t.playoffs).toBeNull();
      expect(t.swiss.rounds.length).toBeLessThanOrEqual(5);
      expect(t.swiss.records.filter((r) => r.status === "advanced")).toHaveLength(8);
      expect(t.swiss.records.filter((r) => r.status === "eliminated")).toHaveLength(8);
      const user = t.swiss.records.find((r) => r.teamId === "user")!;
      expect(t.userEliminated).toBe(user.status === "eliminated");
    }
  });

  it("asSwissOnly: a Swiss in progress just gains the flag; one already in its playoffs ends at the Swiss", () => {
    const rng = createRng(31337);
    let t = initFieldTournament(field(), "swiss", rng);
    t = playNextRound(t, "normal", rng);
    const mid = asSwissOnly(t);
    expect(mid.swissOnly).toBe(true);
    expect(mid.stage).toBe("swiss");
    expect(mid.swiss).toEqual(t.swiss);
    while (t.stage === "swiss") t = playNextRound(t, "normal", rng);
    t = playNextRound(t, "normal", rng); // one playoff round on the old shape
    expect(t.playoffs!.rounds).toHaveLength(1);
    const ended = asSwissOnly(t);
    expect(ended.stage).toBe("finished");
    expect(ended.playoffs).toBeNull();
    expect(ended.swiss).toEqual(t.swiss);
    const user = t.swiss.records.find((r) => r.teamId === "user")!;
    expect(ended.userEliminated).toBe(user.status === "eliminated");
  });

  it("atPlayoffsStart marks only the real Swiss → playoffs boundary", () => {
    const rng = createRng(2024);
    let t = initFieldTournament(field(), "swiss", rng);
    expect(atPlayoffsStart(t)).toBe(false);
    while (t.stage === "swiss") {
      expect(atPlayoffsStart(t)).toBe(false);
      t = playNextRound(t, "normal", rng);
    }
    expect(atPlayoffsStart(t)).toBe(true);
    t = playNextRound(t, "normal", rng);
    expect(atPlayoffsStart(t)).toBe(false);
    // The single-elim shapes start in "playoffs" behind a dummy Swiss — not a boundary.
    expect(atPlayoffsStart(initFieldTournament(field(8), "single", createRng(5)))).toBe(false);
    expect(atPlayoffsStart(initTournament(fakeTeam("user", 85), "normal", createRng(5), { mode: "quick" }))).toBe(false);
  });
});
