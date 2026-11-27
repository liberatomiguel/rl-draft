/** rc9 LEGACY: the Region-only upset guard (DRAFT_UPSET_GUARD, DESIGN-DECISIONS #220). */
import { afterEach, describe, expect, it } from "vitest";
import { DIFFICULTY, DRAFT_UPSET_GUARD, regionFieldDepth, regionOpponentBoost } from "@/config/balance";
import { lineupPoolForRegion } from "@/data";
import { createRng } from "@/lib/rng";
import { rosterFromLineup } from "./challenges";
import { guardedSide, simulateSeries } from "./match";
import { displayTeamOverall } from "./rating";
import { runSeriesFacts } from "./runSeriesFacts";
import { buildLineupTeam, buildUserTeam } from "./teams";
import { fastForward, initTournament } from "./tournament";
import type { TournamentTeam } from "./types";

const enabled = DRAFT_UPSET_GUARD.enabled;
afterEach(() => { DRAFT_UPSET_GUARD.enabled = enabled; });

const pool = lineupPoolForRegion("MENA");
const strongId = pool[0];
function teams(): { user: TournamentTeam; opp: TournamentTeam } {
  const user = buildUserTeam(rosterFromLineup(strongId), "legacy", { mode: "classic" });
  const opp = buildLineupTeam(pool[pool.length - 1], "legacy", { extraShift: 8 });
  return { user, opp };
}
const withShownGap = (opp: TournamentTeam, user: TournamentTeam, gap: number, lift: number): TournamentTeam => {
  // Move the shown overall to `gap` below the user, keep the hidden part at `lift` above the base shift.
  const base = DIFFICULTY.legacy.opponentRatingShift;
  const shown = displayTeamOverall(user.rating) - gap;
  return { ...opp, regionLift: lift, rating: { ...opp.rating, difficultyShift: base + lift, total: shown + base + lift } };
};

describe("upset guard", () => {
  it("a side without regionLift comes back as the same object", () => {
    const { user, opp } = teams();
    expect(guardedSide(opp, user)).toBe(opp);
    expect(guardedSide(user, opp)).toBe(user);
  });

  it("fades the hidden lift out between startGap and fullGap of SHOWN gap", () => {
    const { user, opp } = teams();
    const { startGap, fullGap, floorKeep } = DRAFT_UPSET_GUARD;
    const lift = 8;
    const cutMax = lift * (1 - floorKeep);
    const at = (gap: number) => {
      const o = withShownGap(opp, user, gap, lift);
      return o.rating.total - guardedSide(o, user).rating.total;
    };
    expect(at(startGap)).toBeCloseTo(0, 6);
    expect(at(startGap - 2)).toBeCloseTo(0, 6);
    const mid = startGap + 2;
    expect(at(mid)).toBeCloseTo(Math.min(cutMax, lift * (2 / (fullGap - startGap))), 6);
    expect(at(fullGap)).toBeCloseTo(cutMax, 6);
    expect(at(fullGap + 6)).toBeCloseTo(cutMax, 6);
    // Monotonic: a bigger shown gap never leaves the rival more of its hidden lift.
    for (let g = startGap; g < fullGap + 3; g++) expect(at(g + 1)).toBeGreaterThanOrEqual(at(g) - 1e-9);
    // Never touches the user, never an AI-vs-AI series.
    const o = withShownGap(opp, user, fullGap, lift);
    expect(guardedSide(o, { ...opp, id: "opp-x" })).toBe(o);
  });

  it("off: nothing stamped, the region tournament is identical to a run without the option", () => {
    DRAFT_UPSET_GUARD.enabled = false;
    const user = buildUserTeam(rosterFromLineup(strongId), "legacy", { mode: "classic" });
    const opts = { poolLineupIds: pool, opponentRatingBoost: regionOpponentBoost("MENA", "legacy"), opponentFieldDepth: regionFieldDepth("MENA", "legacy") };
    const a = createRng(77), b = createRng(77);
    const ta = fastForward(initTournament(user, "legacy", a, { ...opts, regionLock: true }), "legacy", a);
    const tb = fastForward(initTournament(user, "legacy", b, opts), "legacy", b);
    expect(Object.values(ta.teams).some((t) => t.regionLift !== undefined)).toBe(false);
    expect(ta).toEqual(tb);
    expect(a.state).toBe(b.state);
  });

  it("on: draws the same RNG numbers as a series without the guard (only the rating moves)", () => {
    const { user, opp } = teams();
    const o = withShownGap(opp, user, 12, 8);
    // Reference: the same reduced opponent with no regionLift (the guard's output, by hand).
    const byHand = { ...guardedSide(o, user), regionLift: undefined };
    for (let seed = 1; seed < 40; seed++) {
      const r1 = createRng(seed), r2 = createRng(seed);
      const s1 = simulateSeries(user, o, { bestOf: 7, stage: "playoff", difficulty: "legacy" }, r1);
      const s2 = simulateSeries(user, byHand, { bestOf: 7, stage: "playoff", difficulty: "legacy" }, r2);
      expect(s1).toEqual(s2);
      expect(r1.state).toBe(r2.state);
    }
  });

  it("worldwide runs never carry the field", () => {
    const user = buildUserTeam(rosterFromLineup(strongId), "legacy", { mode: "classic" });
    const rng = createRng(5);
    const t = initTournament(user, "legacy", rng, {});
    expect(Object.values(t.teams).some((x) => x.regionLift !== undefined)).toBe(false);
  });

  it("runSeriesFacts reads a finished run", () => {
    const user = buildUserTeam(rosterFromLineup(strongId), "legacy", { mode: "classic" });
    const rng = createRng(9);
    const t = fastForward(initTournament(user, "legacy", rng, { poolLineupIds: pool, opponentRatingBoost: 4, regionLock: true }), "legacy", rng);
    const f = runSeriesFacts(t);
    expect(f.seriesWon + f.seriesLost).toBeGreaterThan(0);
    expect(f.oppOverallAvg).toBeGreaterThan(60);
    if (t.playoffs?.championTeamId === "user") expect(f.endRound).toBeNull();
    else expect(f.endScore).toMatch(/^\d-\d$/);
    expect(runSeriesFacts(null).seriesWon).toBe(0);
  });
});
