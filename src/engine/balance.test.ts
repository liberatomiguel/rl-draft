/**
 * Difficulty sanity — full-tournament outcome rates for a representative
 * "good draft" user team (v0.5 playtest targets).
 *
 * The live MVP played too hard: good rosters were missing playoffs on Normal.
 * These tests pin the experience end to end (real opponent generation, real
 * Swiss + double elim), not just the per-series anchors in match.test.ts:
 *   Normal · good team → makes playoffs most runs, wins a meaningful share.
 *   Hard   · good team → playoffs is a real fight, title is rare but real.
 *   Legacy · good team → a brutal gauntlet: playoffs is the exception, the
 *            title a long shot — but NOT impossible (v1.2.5: opponents lost
 *            their chemistry bonus, so a good draft can finally compete).
 * Bounds are wide on purpose — they catch balance regressions, not noise.
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { fastForward, initTournament, userPlacement } from "./tournament";
import type { Difficulty, TournamentTeam } from "./types";

/** A solid drafted roster: ~90.5 avg overall + typical modifiers ≈ 92 total. */
function goodUserTeam(): TournamentTeam {
  return {
    id: "user",
    name: "Your Team",
    isUser: true,
    region: "EU",
    rating: {
      avgPlayerOverall: 90.5,
      coachMod: 0.8,
      subMod: 0.3,
      orgMod: 0.6,
      chemMod: 0.3,
      specialMod: 0,
      difficultyShift: 0,
      total: 92.5,
    },
    chemistry: { raw: 3, max: 16, percent: 19, tier: "Okay", items: [] },
    stats: {
      offense: 88,
      defense: 87,
      mechanics: 88,
      consistency: 87,
      experience: 87,
      clutch: 88,
    },
    specialIds: [],
    playerNames: ["A", "B", "C"],
    orgId: "",
  };
}

function outcomeRates(difficulty: Difficulty, runs: number, seed: number) {
  const rng = createRng(seed);
  let playoffs = 0;
  let titles = 0;
  for (let i = 0; i < runs; i++) {
    const t = fastForward(
      initTournament(goodUserTeam(), difficulty, rng),
      difficulty,
      rng,
    );
    const placement = userPlacement(t);
    if (placement !== "swiss_exit") playoffs += 1;
    if (placement === "champion") titles += 1;
  }
  return { playoffs: playoffs / runs, titles: titles / runs };
}

describe("difficulty outcomes (v0.5 targets)", () => {
  it("Normal: a good roster reaches playoffs most runs and wins a real share", () => {
    const r = outcomeRates("normal", 300, 515);
    expect(r.playoffs).toBeGreaterThan(0.8); // swiss must not be the wall
    expect(r.titles).toBeGreaterThan(0.05); // the title is reachable…
    expect(r.titles).toBeLessThan(0.35); // …but not handed out
  });

  it("Hard: playoffs is a fight; the title stays rare but possible", () => {
    const r = outcomeRates("hard", 500, 626);
    expect(r.playoffs).toBeGreaterThan(0.55);
    expect(r.playoffs).toBeLessThan(0.95);
    expect(r.titles).toBeLessThan(0.2);
  });

  it("Easy: forgiving — playoffs is the norm", () => {
    const r = outcomeRates("easy", 200, 737);
    expect(r.playoffs).toBeGreaterThan(0.85);
    expect(r.titles).toBeGreaterThan(0.2);
  });

  it("Legacy: a gauntlet — playoffs is the exception, the title a long shot, but reachable", () => {
    const r = outcomeRates("legacy", 600, 626);
    expect(r.playoffs).toBeGreaterThan(0.12); // not impossible — a good draft competes
    expect(r.playoffs).toBeLessThan(0.5); // …but clearly the hardest: most runs end in Swiss
    expect(r.titles).toBeLessThan(0.1); // the crown is a true achievement
  });
});
