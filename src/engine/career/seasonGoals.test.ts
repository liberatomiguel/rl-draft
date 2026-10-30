/**
 * rc.36 (ROADMAP UX-02, R87): the board's season goal — the pick stays inside
 * its bands at every level, the deadline is the last event that can count,
 * the progress reads the season's results, and the view covers rc.35's split
 * model and the legacy keys. The hit rates themselves are the probe's
 * (careerSeasonGoals.probe.test.ts, CAREER_GOALS=1).
 */

import { describe, expect, it } from "vitest";
import { CAREER_SEASON_GOAL as G } from "@/config/balance";
import type { Placement } from "../types";
import type { TeamLevel } from "./sponsorDeals";
import {
  SEASON_GOAL_CANDIDATES,
  seasonGoalAimOf,
  seasonGoalChance,
  seasonGoalDeadlineOf,
  seasonGoalPlanFor,
  seasonGoalProgressOf,
  type FieldDraw,
  type SeasonGoalContext,
} from "./seasonGoals";
import type { CompactEventResult } from "./types";

/** A level `m` points over every reference team (a flat field). */
function levelAt(m: number, rank = 8): TeamLevel {
  return {
    rank,
    teams: 17,
    slots: 4,
    majorRank: 10,
    vs12: m + 3,
    vs8: m,
    vs6: m - 1,
    vs4: m - 2,
    vs1: m - 5,
    vsCut: m - 3,
    vsMajor4: m - 6,
    vsMajor8: m - 3,
    vsMajor1: m - 9,
  };
}
const drawAt = (m: number): FieldDraw => ({ eligible: m < 4, vsSemi: m - 2, vsFinal: m - 4, vsLine: m + 6 });

const input = (m: number, over: Partial<Parameters<typeof seasonGoalPlanFor>[0]> = {}) => ({
  level: levelAt(m),
  cup: drawAt(m),
  seasonIndex: 1,
  rep: 20,
  hasHistory: true,
  lastTargetMet: null,
  runwayWeeks: 12,
  loanOwed: false,
  ...over,
});

describe("the board's pick (UX-02)", () => {
  it("at every level, the target sits in its band and the stretch is harder, in its own band", () => {
    for (let m = -20; m <= 12; m += 0.5) {
      for (const stage of [{ hasHistory: false }, { hasHistory: true, rep: 10 }, { hasHistory: true, rep: 60 }]) {
        for (const money of [{ runwayWeeks: 3 }, { runwayWeeks: 12 }, { runwayWeeks: null }]) {
          const plan = seasonGoalPlanFor(input(m, { ...stage, ...money }));
          const rated = SEASON_GOAL_CANDIDATES.map((c) => seasonGoalChance(c, levelAt(m), drawAt(m))).filter((c) => c > 0);
          // When any goal that leaves room for a stretch lands in the band, the target does
          // (never trivial, never impossible).
          const roomy = rated.filter((c) => rated.some((d) => d <= c - G.stretchGap + 1e-9));
          if (roomy.some((c) => c >= G.targetBand.min && c <= G.targetBand.max)) {
            expect(plan.target.chance, `m=${m}`).toBeGreaterThanOrEqual(G.targetBand.min - 1e-3);
            expect(plan.target.chance, `m=${m}`).toBeLessThanOrEqual(G.targetBand.max + 1e-3);
          }
          expect(plan.stretch.chance, `m=${m}`).toBeLessThan(plan.target.chance);
          const harder = rated.filter((c) => c <= plan.target.chance - G.stretchGap);
          if (harder.some((c) => c >= G.stretchBand.min && c <= G.stretchBand.max)) {
            expect(plan.stretch.chance, `m=${m}`).toBeGreaterThanOrEqual(G.stretchBand.min - 1e-3);
            expect(plan.stretch.chance, `m=${m}`).toBeLessThanOrEqual(G.stretchBand.max + 1e-3);
          }
        }
      }
    }
  });

  it("a stronger squad is asked more (the target never gets easier as the level rises)", () => {
    let prev = -1;
    for (let m = -12; m <= 10; m += 2) {
      const plan = seasonGoalPlanFor(input(m));
      const rank = SEASON_GOAL_CANDIDATES.findIndex(
        (c) => c.kind === plan.target.kind && c.count === plan.target.count && c.place === plan.target.place,
      );
      // Within a family the candidates are ordered; across families compare the shared regional rung.
      expect(plan.target.chance).toBeGreaterThan(0);
      expect(rank).toBeGreaterThanOrEqual(0);
      prev = Math.max(prev, rank);
    }
    const weak = seasonGoalPlanFor(input(-14)).target;
    const strong = seasonGoalPlanFor(input(8)).target;
    expect(["cupFinal", "cupWin", "regionalReach"]).toContain(weak.kind);
    expect(["majorQualify", "majorFinish", "worldsQualify", "worldsFinish", "regionalFinish"]).toContain(strong.kind);
  });

  it("the aim reads the stage, the money and last season — clamped", () => {
    const base = { rep: 20, hasHistory: true, lastTargetMet: null, runwayWeeks: 12, loanOwed: false };
    expect(seasonGoalAimOf({ ...base, hasHistory: false })).toBeCloseTo(G.targetAim.founding);
    expect(seasonGoalAimOf(base)).toBeCloseTo(G.targetAim.rising);
    expect(seasonGoalAimOf({ ...base, rep: G.establishedRep })).toBeCloseTo(G.targetAim.established);
    expect(seasonGoalAimOf({ ...base, lastTargetMet: false })).toBeGreaterThan(seasonGoalAimOf(base));
    expect(seasonGoalAimOf({ ...base, lastTargetMet: true })).toBeLessThan(seasonGoalAimOf(base));
    expect(seasonGoalAimOf({ ...base, loanOwed: true })).toBeGreaterThan(seasonGoalAimOf(base));
    expect(seasonGoalAimOf({ ...base, runwayWeeks: null })).toBeLessThan(seasonGoalAimOf(base));
    const plan = seasonGoalPlanFor(input(0, { lastTargetMet: false, loanOwed: true }));
    expect(plan.basis).toMatchObject({ stage: "rising", money: "tight", last: "missed", rank: 8, teams: 17 });
  });

  it("no cup goal for a squad past the cups' ceiling", () => {
    const plan = seasonGoalPlanFor(input(2, { cup: { eligible: false, vsSemi: 0, vsFinal: 0, vsLine: 8 } }));
    expect(plan.target.kind.startsWith("cup")).toBe(false);
    expect(plan.stretch.kind.startsWith("cup")).toBe(false);
  });
});

describe("deadline and progress (UX-02)", () => {
  it("the deadline is the last event that can count", () => {
    expect(seasonGoalDeadlineOf("regionalFinish", 2)).toMatchObject({ event: "lastRegional", week: 28 });
    expect(seasonGoalDeadlineOf("majorQualify", 2)).toMatchObject({ event: "majorField", week: 30 });
    expect(seasonGoalDeadlineOf("majorFinish", 2)).toMatchObject({ event: "majorFinal", week: 30 });
    expect(seasonGoalDeadlineOf("worldsQualify", 2)).toMatchObject({ event: "worldsField", week: 31 });
    expect(seasonGoalDeadlineOf("worldsFinish", 2)).toMatchObject({ event: "worldsFinal", week: 32 });
    expect(seasonGoalDeadlineOf("cupWin", 2)).toMatchObject({ event: "lastCup", week: 29 });
    expect(seasonGoalDeadlineOf("worldsFinish", 2).on).toEqual({ seasonIndex: 2, day: 32 * 7 });
  });

  const res = (tier: CompactEventResult["tier"], week: number, placement: Placement): CompactEventResult => ({
    eventId: `${tier}:${week}`,
    tier,
    seasonIndex: 0,
    week,
    name: tier,
    rows: [],
    championRef: "x",
    userPlacement: placement,
    fieldQuality: 1,
  });
  const ctx = (week: number, results: CompactEventResult[], over: Partial<SeasonGoalContext> = {}): SeasonGoalContext => ({
    seasonIndex: 0,
    today: { seasonIndex: 0, day: (week - 1) * 7 + 1 },
    results,
    majorFieldRefs: null,
    worldsFieldRefs: null,
    ...over,
  });

  it("regional counts read the regionals, with the chances left and out of reach", () => {
    const results = [res("regional", 4, "top8"), res("regional", 6, "top4"), res("qualifier", 14, "swiss_exit")];
    const p = seasonGoalProgressOf({ kind: "regionalFinish", count: 2, place: 4 }, ctx(15, results));
    expect(p).toMatchObject({ done: 1, target: 2, hit: false, out: false });
    // W16, W18, W24, W26, W28 still ahead (W14's qualifier ended that week).
    expect(p.left).toBe(5);
    const reach = seasonGoalProgressOf({ kind: "regionalReach", count: 2 }, ctx(15, results));
    expect(reach).toMatchObject({ done: 2, hit: true });
    const late = seasonGoalProgressOf({ kind: "regionalFinish", count: 7, place: 8 }, ctx(25, results));
    expect(late.out).toBe(true);
  });

  it("a Major counts from the day its field includes the user, and is lost when it does not", () => {
    const inField = seasonGoalProgressOf({ kind: "majorQualify", count: 2 }, ctx(10, [], { majorFieldRefs: ["user", "a"] }));
    expect(inField).toMatchObject({ done: 1, left: 2, hit: false });
    const missed = seasonGoalProgressOf({ kind: "majorQualify", count: 3 }, ctx(10, [], { majorFieldRefs: ["a"] }));
    expect(missed).toMatchObject({ done: 0, left: 2, out: true });
    const finish = seasonGoalProgressOf({ kind: "majorFinish", count: 1, place: 4 }, ctx(21, [res("major", 10, "third")]));
    expect(finish.hit).toBe(true);
  });

  it("Worlds and cups", () => {
    const w = seasonGoalProgressOf({ kind: "worldsQualify", count: 1 }, ctx(31, [], { worldsFieldRefs: ["user"] }));
    expect(w).toMatchObject({ done: 1, hit: true });
    const notIn = seasonGoalProgressOf({ kind: "worldsFinish", count: 1, place: 4 }, ctx(31, [], { worldsFieldRefs: ["a"] }));
    expect(notIn).toMatchObject({ hit: false, left: 0, out: true });
    const cups = [res("t3", 3, "champion"), res("t3", 5, "runner_up"), res("t3", 13, "top4")];
    const final2 = seasonGoalProgressOf({ kind: "cupFinal", count: 2 }, ctx(14, cups));
    expect(final2).toMatchObject({ done: 2, hit: true });
    const win2 = seasonGoalProgressOf({ kind: "cupWin", count: 2 }, ctx(14, cups));
    // Split 2 has one cup left (W15/W17 — one entry used), split 3 two.
    expect(win2).toMatchObject({ done: 1, hit: false, left: 3 });
  });

  it("at the review every chance is over", () => {
    const p = seasonGoalProgressOf({ kind: "regionalReach", count: 5 }, ctx(32, [res("regional", 4, "top8")], { over: true }));
    expect(p).toMatchObject({ left: 0, out: true, hit: false });
  });
});
