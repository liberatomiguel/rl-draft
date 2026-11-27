/**
 * v2.2 rc.6 (ORGMODE E1/E2/E4): the established-org rules, pure. Dataset-agnostic.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_BOARD, CAREER_GEAR } from "@/config/balance";
import { seasonBriefFor, establishedPool, isPreferred, preferredKindsOf } from "./board";
import type { BoardState, Stature } from "./boardTypes";
import { newBoardState } from "./board";
import { signableOverallCap } from "./economy";
import {
  OPEN_GATE_REP,
  applyTierChange,
  capitalRefusalOf,
  establishedOf,
  gateRepOf,
  inheritedGearFor,
  signCapOf,
  standingChangeFor,
  standingOf,
  standingTierFor,
} from "./established";
import { goalTotalOf } from "./board";
import type { CareerSave, SeasonGoalSpec } from "./types";

const S = CAREER_BOARD.standing;

function board(stature: Stature, startSeason = 0, confidence = 75): BoardState {
  return newBoardState({ kind: "board", stature, startSeason, weekWages: 10_000, grantBase: 200_000, wageRoom: 12_000, confidence });
}

function fakeSave(opts: { ref?: string; rep: number; board?: BoardState; proHost?: boolean; day?: number }): CareerSave {
  return {
    identity: { orgName: "X", abbrev: "X", region: "EU", ...(opts.ref ? { realOrgRef: opts.ref } : {}) },
    reputation: opts.rep,
    clock: { seasonIndex: 1, day: opts.day ?? 30 },
    ...(opts.board ? { board: opts.board } : {}),
    ...(opts.proHost ? { proHost: true } : {}),
  } as unknown as CareerSave;
}

describe("the predicate", () => {
  it("is a real org's seat, never a founded club or the Pro's host", () => {
    expect(establishedOf(fakeSave({ ref: "org", rep: 10 }))).toBe(true);
    expect(establishedOf(fakeSave({ rep: 10 }))).toBe(false);
    expect(establishedOf(fakeSave({ ref: "org", rep: 10, proHost: true }))).toBe(false);
  });

  it("opens every reputation gate for an established org only", () => {
    expect(gateRepOf(fakeSave({ ref: "org", rep: 14 }))).toBe(OPEN_GATE_REP);
    expect(gateRepOf(fakeSave({ rep: 14 }))).toBe(14);
    const top = Math.max(...CAREER_GEAR.items.map((i) => i.repGate), CAREER_GEAR.psychologistRep, ...CAREER_GEAR.bootcamp.map((b) => b.repGate));
    expect(OPEN_GATE_REP).toBeGreaterThanOrEqual(top);
  });
});

describe("standing (E1)", () => {
  it("reads the starting reputations of the four profiles as their own tier", () => {
    for (const t of ["underdog", "mid", "contender", "elite"] as const) expect(standingTierFor(CAREER_BOARD.profiles[t].rep)).toBe(t);
  });

  it("promotes at the next tier's promote line, relegates under its own keep floor, one step, never in the first season", () => {
    expect(standingChangeFor(board("mid", 0), S.promote.contender, 1)).toBe("contender");
    expect(standingChangeFor(board("mid", 0), S.promote.elite + 10, 1)).toBe("contender");
    expect(standingChangeFor(board("mid", 0), S.promote.contender - 1, 1)).toBeNull();
    expect(standingChangeFor(board("mid", 0), S.keep.mid, 1)).toBeNull();
    expect(standingChangeFor(board("mid", 0), S.keep.mid - 1, 1)).toBe("underdog");
    expect(standingChangeFor(board("elite", 0), 100, 1)).toBeNull();
    expect(standingChangeFor(board("underdog", 0), 0, 1)).toBeNull();
    expect(standingChangeFor(board("mid", 1), S.promote.contender + 5, 1)).toBeNull();
    // promoteNeedsObjective: a missed objective blocks the promotion, never the relegation.
    expect(standingChangeFor(board("mid", 0), S.promote.contender, 1, false)).toBe(S.promoteNeedsObjective ? null : "contender");
    expect(standingChangeFor(board("mid", 0), S.promote.contender, 1, true)).toBe("contender");
    expect(standingChangeFor(board("mid", 0), S.keep.mid - 1, 1, false)).toBe("underdog");
    // Every tier's starting standing holds it: above its keep floor, under the next tier's promote line.
    for (const t of ["underdog", "mid", "contender", "elite"] as const) expect(standingChangeFor(board(t, 0), CAREER_BOARD.profiles[t].rep, 1), t).toBeNull();
    expect(standingChangeFor({ ...board("mid", 0), kind: "owners", stature: "owners" }, 90, 3)).toBeNull();
  });

  it("a change steps the budget base and the wage ceiling and records itself", () => {
    const b = board("mid");
    const c = applyTierChange(b, "contender", 2);
    expect(c).toEqual({ seasonIndex: 2, from: "mid", to: "contender" });
    expect(b.stature).toBe("contender");
    expect(b.grantBase).toBe(Math.round(200_000 * S.budgetStep.up));
    expect(b.wageRoom).toBe(Math.round(12_000 * S.budgetStep.up));
    applyTierChange(b, "mid", 3);
    expect(b.grantBase).toBe(Math.round(Math.round(200_000 * S.budgetStep.up) * S.budgetStep.down));
  });

  it("the track shows the next line and the relegation line", () => {
    const v = standingOf(fakeSave({ ref: "org", rep: 24, board: board("mid") }))!;
    expect(v.tier).toBe("mid");
    expect(v.next).toEqual({ tier: "contender", line: S.promote.contender });
    expect(v.relegationLine).toBe(S.keep.mid);
    expect(standingOf(fakeSave({ rep: 24 }))).toBeNull();
  });
});

describe("signing pull (E1)", () => {
  it("an established org signs up to its tier's cap, a founded club on the reputation line", () => {
    for (const t of ["underdog", "mid", "contender", "elite"] as const) {
      expect(signCapOf(fakeSave({ ref: "org", rep: CAREER_BOARD.profiles[t].rep, board: board(t) }))).toBe(CAREER_BOARD.profiles[t].signCap);
    }
    expect(signCapOf(fakeSave({ rep: 14 }))).toBe(signableOverallCap(14));
    expect(CAREER_BOARD.profiles.underdog.signCap).toBeGreaterThan(signableOverallCap(CAREER_BOARD.profiles.underdog.rep));
  });
});

describe("the structure (E2)", () => {
  it("installations and retained staff by tier", () => {
    const elite = inheritedGearFor("elite");
    expect([elite.peripherals, elite.monitors, elite.pcs, elite.perfCenter]).toEqual([true, true, true, false]);
    expect(elite.psychologist).toBe(true);
    expect(elite.staff?.analyst).toBe(true);
    expect(inheritedGearFor("contender").staff).toEqual({ analyst: true });
    expect(inheritedGearFor("mid").staff).toEqual({ assistant: true });
    const u = inheritedGearFor("underdog");
    expect(u.staff).toBeUndefined();
    expect(u.psychologist || u.peripherals).toBe(false);
  });

  it("the board signs off installations: confidence lines, the flagship, the freeze", () => {
    const low = fakeSave({ ref: "org", rep: 30, board: board("mid", 0, CAREER_BOARD.approval.capital - 1) });
    expect(capitalRefusalOf(low, "pcs")).toBe("boardApproval");
    const mid = fakeSave({ ref: "org", rep: 30, board: board("mid", 0, CAREER_BOARD.approval.flagship - 1) });
    expect(capitalRefusalOf(mid, "pcs")).toBeNull();
    expect(capitalRefusalOf(mid, "perfCenter")).toBe("boardFlagship");
    const frozen = board("mid", 0, 99);
    frozen.freeze = { seasonIndex: 1, windowIdx: 0 };
    expect(capitalRefusalOf(fakeSave({ ref: "org", rep: 30, board: frozen, day: 1 }), "peripherals")).toBe("boardFrozen");
    expect(capitalRefusalOf(fakeSave({ rep: 30, board: board("mid", 0, 0) }), "pcs")).toBeNull();
  });
});

describe("objectives (E4)", () => {
  const goal = (kind: SeasonGoalSpec["kind"], count: number, place?: number): SeasonGoalSpec => ({ kind, count, chance: 0.5, ...(place !== undefined ? { place } : {}) });

  it("an established pool has no cup and no more than objectiveMaxCount regionals", () => {
    const pool = establishedPool([goal("cupFinal", 1), goal("cupWin", 1), goal("regionalReach", 7), goal("regionalFinish", 5, 4), goal("majorQualify", 1)]);
    expect(pool.map((g) => `${g.kind}:${g.count}`)).toEqual(["regionalFinish:5", "majorQualify:1"]);
  });

  it("preferences read kind or kind:place, a plan's own list replaces the tier's", () => {
    expect(isPreferred(goal("regionalFinish", 1, 1), preferredKindsOf("contender", "expected"))).toBe(true);
    expect(isPreferred(goal("regionalFinish", 1, 4), preferredKindsOf("contender", "expected"))).toBe(false);
    expect(preferredKindsOf("underdog", "ambitious")).toEqual(["majorQualify"]);
  });

  it("goal totals", () => {
    expect(goalTotalOf("majorQualify")).toBe(3);
    expect(goalTotalOf("regionalFinish")).toBeGreaterThanOrEqual(goalTotalOf("majorQualify"));
    expect(goalTotalOf("worldsQualify")).toBe(1);
  });
});

describe("the season brief (E4)", () => {
  const last = (met: boolean) => ({
    seasonIndex: 0,
    offers: [{ id: "expected" as const, objective: { kind: "majorQualify" as const, count: 1, chance: 0.6 }, grant: 0, bonus: 0, hit: 1, miss: -1 }],
    choice: "expected" as const,
    met,
  });
  const base = { tier: "mid" as const, firstSeason: false, tierChange: null, ultimatumSurvived: false, titles: null };

  it("reads the takeover, then a tier change, a title, an ultimatum answered, the verdict", () => {
    expect(seasonBriefFor({ ...base, firstSeason: true, last: null }).reason).toBe("takeover");
    expect(seasonBriefFor({ ...base, last: last(true) }).reason).toBe("met");
    const missed = seasonBriefFor({ ...base, last: last(false), lastRegionalRank: 6 });
    expect(missed.reason).toBe("missed");
    expect(missed.lastObjective?.kind).toBe("majorQualify");
    expect(missed.lastRegionalRank).toBe(6);
    expect(seasonBriefFor({ ...base, last: last(false), ultimatumSurvived: true }).reason).toBe("ultimatumSurvived");
    expect(seasonBriefFor({ ...base, last: last(true), titles: { majors: 1, worlds: false } }).reason).toBe("title");
    expect(seasonBriefFor({ ...base, last: last(true), titles: { majors: 1, worlds: false }, tierChange: { seasonIndex: 0, from: "mid", to: "contender" } }).reason).toBe("promoted");
    expect(seasonBriefFor({ ...base, last: last(true), tierChange: { seasonIndex: 0, from: "mid", to: "underdog" } }).reason).toBe("relegated");
  });
});
