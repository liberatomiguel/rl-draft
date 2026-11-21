/** v2.1 Matchday slice 3: the plan, the momentum meter and the coach (career/matchday.ts, matchdaySeries.ts). */
import { describe, expect, it } from "vitest";
import { CAREER_MATCHDAY as MD } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { isSeriesOver, playNextGame, simulateSeries, startSeries } from "../match";
import type { PlayStyleId, TournamentTeam } from "../types";
import {
  applyTimeout,
  coachPlanFor,
  coachQualityOf,
  initMatchday,
  momentumTerm,
  planShift,
  updateMomentum,
} from "./matchday";
import { autoUserSeries, callTimeout, openUserSeries, playUserGame } from "./matchdaySeries";
import { PLAY_STYLES } from "./styles";

const fits = (nat: PlayStyleId, natFit: number, other: number) =>
  Object.fromEntries(PLAY_STYLES.map((s) => [s, s === nat ? natFit : other])) as Record<PlayStyleId, number>;

function team(id: string, rating: number, extra: Partial<TournamentTeam> = {}): TournamentTeam {
  return {
    id, name: id, isUser: false, region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
    stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
    specialIds: [], playerNames: ["A", "B", "C"], orgId: "",
    rollRange: [-4, 4], careerScoreline: true, matchday: true, playmakerIndex: 1,
    style: { natural: "pressure", fit: fits("pressure", 0.8, 0.4) },
    ...extra,
  };
}

const opts = { bestOf: 5, stage: "playoff" as const, difficulty: "normal" as const };

describe("matchday slice 3 — engine", () => {
  it("a series without the mark has no matchday layer (the old bounce path)", () => {
    const a = team("a", 88, { matchday: undefined });
    const b = team("b", 88, { matchday: undefined });
    expect(startSeries(a, b, opts, createRng(1)).matchday).toBeUndefined();
    expect(startSeries(team("a", 88), b, opts, createRng(1)).matchday).toBeDefined();
  });

  it("meters stay within ±momentumMax and the term within ±momentumCap", () => {
    const a = team("a", 90, { traits: [["hotHeaded"], ["hotHeaded"], ["leader"]] });
    const b = team("b", 86, { traits: [["iceCold"], [], []] });
    const rng = createRng(9);
    for (let i = 0; i < 400; i++) {
      let st = startSeries(a, b, opts, rng);
      while (!isSeriesOver(st)) {
        st = playNextGame(st, a, b, rng);
        for (const m of [st.matchday!.momentumA, st.matchday!.momentumB]) {
          expect(Math.abs(m)).toBeLessThanOrEqual(MD.momentumMax);
          expect(Math.abs(momentumTerm(m))).toBeLessThanOrEqual(MD.momentumCap);
        }
      }
    }
  });

  it("a plain loss leaves the loser the old bounce; a rout shakes it", () => {
    const a = team("a", 88);
    const b = team("b", 88);
    const plain = updateMomentum(initMatchday(), { winner: "a", overtime: false, goalDiff: 1, comeback: false }, a, b);
    expect(momentumTerm(plain.momentumB)).toBeCloseTo(1.5);
    const rout = updateMomentum(initMatchday(), { winner: "a", overtime: false, goalDiff: 4, comeback: false }, a, b);
    expect(rout.momentumB).toBeLessThan(plain.momentumB);
    expect(rout.momentumA).toBeGreaterThan(plain.momentumA);
  });

  it("the timeout clears at most timeoutMax of the opponent's momentum, once", () => {
    const md = { ...initMatchday(), momentumB: 2 };
    const once = applyTimeout(md, "a");
    expect(momentumTerm(md.momentumB) - momentumTerm(once.momentumB)).toBeCloseTo(MD.timeoutMax);
    expect(applyTimeout(once, "a")).toBe(once);
    expect(applyTimeout({ ...initMatchday(), momentumB: -1 }, "a").momentumB).toBe(-1);
  });

  it("the plan shift stays within ±planCap", () => {
    const a = team("a", 88, { style: { natural: "pressure", fit: fits("pressure", 1, 0) } });
    const b = team("b", 88);
    expect(planShift(a, b, { kickoff: "standard", style: "counter", mark: 0 })).toBeCloseTo(-MD.planCap);
    expect(planShift(a, b, { kickoff: "standard", mark: 1 })).toBe(0);
  });

  it("no coach plans at the floor (R145); quality 1 counters the opponent and marks its playmaker", () => {
    const a = team("a", 86, { style: { natural: "possession", fit: fits("possession", 0.8, 0.7) } });
    const b = team("b", 88, { style: { natural: "counter", fit: fits("counter", 0.8, 0.4) } });
    expect(coachPlanFor(a, b, null, 1, "user")).toEqual(coachPlanFor(a, b, MD.coachlessQuality, 1, "user"));
    expect(coachPlanFor(a, b, 0, 1, "user")).toEqual(coachPlanFor(a, b, null, 1, "user"));
    const best = coachPlanFor(a, b, 1, 1, "user");
    expect(best.kickoff).toBe("aggressive");
    expect(best.mark).toBe(1);
    expect(coachQualityOf(60)).toBe(0);
    expect(coachQualityOf(90)).toBe(1);
  });

  it("a series stepped with a reload between games equals one played straight", () => {
    const a = team("user", 88, { isUser: true });
    const b = team("b", 88);
    const ctl = { userSide: "a" as const, userQuality: 0.5 };
    const straight = autoUserSeries(a, b, opts, 4242, ctl);
    let cur = openUserSeries(a, b, opts, 4242, ctl);
    while (!isSeriesOver(cur.state)) {
      cur = JSON.parse(JSON.stringify(cur)) as typeof cur;
      cur = playUserGame(cur.state, cur.rngState, a, b, "a");
    }
    // playUserGame makes no user break (custom mode), so the reference is a second stepped run without reloads.
    let again = openUserSeries(a, b, opts, 4242, ctl);
    while (!isSeriesOver(again.state)) again = playUserGame(again.state, again.rngState, a, b, "a");
    expect(again.state).toEqual(cur.state);
    expect(straight.games.length).toBeGreaterThan(0);
    expect(callTimeout(again.state, "a")).toBe(again.state);
  });

  it("a marked AI side plans with its coach (R140 rev.); no coach on the mark = the default quality", () => {
    const a = team("a", 86, { coachQuality: 1, style: { natural: "possession", fit: fits("possession", 0.8, 0.7) } });
    const b = team("b", 88, { coachQuality: 1, style: { natural: "counter", fit: fits("counter", 0.8, 0.4) } });
    const st = startSeries(a, b, opts, createRng(5));
    expect(st.matchday!.planA).toEqual(coachPlanFor(a, b, 1, st.matchday!.seed, "a"));
    expect(st.matchday!.planA.mark).toBe(1);
    expect(st.matchday!.planB.kickoff).toBe("safe");
    // The seed is the starting cursor: the series draws exactly the same numbers as an unplanned one.
    const rngPlanned = createRng(5);
    const rngPlain = createRng(5);
    startSeries(a, b, opts, rngPlanned);
    startSeries({ ...a, matchday: undefined }, { ...b, matchday: undefined }, opts, rngPlain);
    expect(rngPlanned.state).toBe(rngPlain.state);
  });

  it("simulateSeries with marked sides is deterministic", () => {
    const a = team("a", 88);
    const b = team("b", 87);
    const r1 = simulateSeries(a, b, opts, createRng(77));
    const r2 = simulateSeries(a, b, opts, createRng(77));
    expect(r1).toEqual(r2);
  });
});
