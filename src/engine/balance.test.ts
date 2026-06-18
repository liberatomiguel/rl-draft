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

/** A great draft that ALSO commits to chemistry (~95.5 total) — the only kind of
 *  roster that should be able to win Legacy (v1.3). */
function strongUserTeam(): TournamentTeam {
  return {
    ...goodUserTeam(),
    rating: {
      avgPlayerOverall: 93.7,
      coachMod: 0.8,
      subMod: 0.4,
      orgMod: 0.6,
      chemMod: 0,
      specialMod: 0,
      difficultyShift: 0,
      total: 95.5,
    },
    chemistry: { raw: 9, max: 16, percent: 75, tier: "Perfect", items: [] },
    stats: {
      offense: 89,
      defense: 89,
      mechanics: 89,
      consistency: 89,
      experience: 89,
      clutch: 89,
    },
  };
}

function outcomeRates(
  difficulty: Difficulty,
  runs: number,
  seed: number,
  makeTeam: () => TournamentTeam = goodUserTeam,
) {
  const rng = createRng(seed);
  let playoffs = 0;
  let titles = 0;
  for (let i = 0; i < runs; i++) {
    const t = fastForward(
      initTournament(makeTeam(), difficulty, rng),
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
    // 1000 runs (was 300): after the v1.3 community overall review the field is a
    // touch stronger, so a good team's Normal title rate sits near ~5.5% — right at
    // the 5% line, where a 300-run sample was just noise. Bigger sample, true rate.
    const r = outcomeRates("normal", 1000, 515);
    expect(r.playoffs).toBeGreaterThan(0.8); // swiss must not be the wall
    expect(r.titles).toBeGreaterThan(0.05); // the title is reachable…
    expect(r.titles).toBeLessThan(0.35); // …but not handed out
  });

  it("Hard (v1.3.1): a good team makes playoffs and has a real title shot", () => {
    // v1.3.1 targets: a 90 team can't win Hard, a 92 elite wins ~10%, a 95 dream
    // comfortably. The balance team (92.5) sits at the elite mark — it makes
    // playoffs almost always and wins ~1-in-8. The REAL Hard difficulty is
    // drafting with overalls HIDDEN, which this fixed-team test can't model.
    const r = outcomeRates("hard", 500, 626);
    expect(r.playoffs).toBeGreaterThan(0.8);
    expect(r.titles).toBeGreaterThan(0.04); // reachable for an elite-level team
    expect(r.titles).toBeLessThan(0.25); // …but not handed out
  });

  it("Easy: forgiving — playoffs is the norm", () => {
    const r = outcomeRates("easy", 200, 737);
    expect(r.playoffs).toBeGreaterThan(0.85);
    expect(r.titles).toBeGreaterThan(0.2);
  });

  it("Legacy (v1.3.2): the title is the wall, not the playoffs", () => {
    // v1.3.2 — live feedback: even a strong draft felt impossible, because the
    // problem isn't the dream team's WIN chance, it's how rarely you can BUILD one.
    // So win rates were raised (shift 0.2→-0.3) AND chemistry made more reachable.
    // A merely-GOOD team (92.5) now reaches playoffs often but almost never lifts
    // the trophy; a STRONG, coherent draft (~95.5) has a real ~1-in-5 shot. Legacy
    // stays strictly harder than Hard (a 92.5 wins it far less than on Hard).
    const good = outcomeRates("legacy", 600, 626);
    expect(good.playoffs).toBeGreaterThan(0.3); // you genuinely compete…
    expect(good.playoffs).toBeLessThan(0.92); // …but the title is the gauntlet
    expect(good.titles).toBeLessThan(0.06); // a 92.5 team almost never wins it

    // Reachability is the whole point: a great draft must be able to win it.
    const strong = outcomeRates("legacy", 600, 909, strongUserTeam);
    expect(strong.titles).toBeGreaterThan(0.04); // a real shot…
    expect(strong.titles).toBeLessThan(0.4); // …but a true achievement
  });
});
