import { describe, expect, it } from "vitest";
import { LOGIN_STREAK, MISSIONS } from "@/config/balance";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import {
  applyMissionEvent,
  EMPTY_LOGIN,
  EMPTY_MISSIONS,
  loginDayXp,
  mergeLogin,
  mergeMissions,
  MISSION_CATALOG,
  missionById,
  missionEligible,
  newSlot,
  periodKey,
  pickMissions,
  recordLogin,
  rollMissions,
  weekKey,
  type MissionEligibility,
  type MissionsState,
  type RunCompletedEvent,
} from "./missions";

const ROOKIE: MissionEligibility = { rankId: "unranked", legacyUnlocked: false, careerAvailable: false };
const VETERAN: MissionEligibility = { rankId: "diamond", legacyUnlocked: true, careerAvailable: true };

const runEvent = (over: Partial<RunCompletedEvent> = {}): RunCompletedEvent => ({
  type: "run_completed",
  mode: "classic",
  difficulty: "normal",
  placement: "swiss_exit",
  region: null,
  hiddenOverall: false,
  seriesWins: 2,
  gameWins: 6,
  goals: 14,
  specialsFielded: 0,
  chemistryTier: "Okay",
  sameLineupTrio: false,
  teamOverall: 88,
  ...over,
});

describe("catalog", () => {
  it("ids unique, every tier of each period has ≥3 options for a rookie, and EN + PT copy exists", () => {
    const ids = MISSION_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const period of ["daily", "weekly"] as const) {
      for (const tier of ["easy", "mid", "hard"] as const) {
        const pool = MISSION_CATALOG.filter((m) => m.period === period && m.tier === tier && missionEligible(m, ROOKIE));
        expect(pool.length, `${period}/${tier} rookie pool`).toBeGreaterThanOrEqual(3);
      }
    }
    for (const id of ids) {
      expect(EN.MISSIONS_UI.items[id], `EN copy ${id}`).toBeTruthy();
      expect(PT.MISSIONS_UI.items[id], `PT copy ${id}`).toBeTruthy();
    }
    for (const id of Object.keys(EN.MISSIONS_UI.items)) expect(missionById.has(id), `stale copy ${id}`).toBe(true);
  });

  it("gated missions never reach a player who cannot do them", () => {
    for (let day = 1; day <= 60; day++) {
      const key = `2026-11-${String((day % 28) + 1).padStart(2, "0")}-${day}`;
      for (const id of pickMissions("daily", key, ROOKIE)) {
        expect(missionById.get(id)!.requires ?? {}).toEqual({});
      }
    }
  });
});

describe("picking", () => {
  it("is deterministic per key + eligibility, one per tier", () => {
    const a = pickMissions("daily", "2026-10-21", VETERAN);
    const b = pickMissions("daily", "2026-10-21", VETERAN);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a.map((id) => missionById.get(id)!.tier)).toEqual(["easy", "mid", "hard"]);
    expect(pickMissions("daily", "2026-10-22", VETERAN)).not.toEqual(a);
  });

  it("period keys: UTC day and ISO week", () => {
    expect(periodKey("daily", new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-21");
    expect(weekKey(new Date("2026-10-19T00:00:00Z"))).toBe("2026-W43"); // Monday
    expect(weekKey(new Date("2026-10-25T23:59:59Z"))).toBe("2026-W43"); // Sunday, same week
    expect(weekKey(new Date("2026-10-26T00:00:00Z"))).toBe("2026-W44");
    expect(weekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53"); // ISO year rollover
  });

  it("rollMissions creates sets on first use and rolls only the period that moved", () => {
    const t0 = new Date("2026-10-21T10:00:00Z");
    const s1 = rollMissions(EMPTY_MISSIONS, ROOKIE, t0);
    expect(s1.daily?.key).toBe("2026-10-21");
    expect(s1.weekly?.key).toBe("2026-W43");
    expect(rollMissions(s1, ROOKIE, new Date("2026-10-21T22:00:00Z"))).toBe(s1); // same object, nothing changed
    const s2 = rollMissions(s1, ROOKIE, new Date("2026-10-22T01:00:00Z"));
    expect(s2.daily?.key).toBe("2026-10-22");
    expect(s2.weekly).toBe(s1.weekly);
  });
});

describe("progress + rewards", () => {
  it("folds events, completes at target, pays tier XP and the all-three bonus once", () => {
    const t = new Date("2026-10-21T10:00:00Z");
    const slot = { ...newSlot("daily", "2026-10-21", ROOKIE), ids: ["d-draft-1", "d-series-6", "d-goals-20"] };
    let state: MissionsState = { ...EMPTY_MISSIONS, daily: slot };
    let r = applyMissionEvent(state, runEvent({ seriesWins: 4, goals: 15 }), t);
    expect(r.completed).toEqual(["d-draft-1"]);
    expect(r.xp).toBe(MISSIONS.daily.xp.easy);
    expect(r.state.daily?.progress).toMatchObject({ "d-draft-1": 1, "d-series-6": 4, "d-goals-20": 15 });
    state = r.state;
    r = applyMissionEvent(state, runEvent({ seriesWins: 3, goals: 9 }), t);
    expect(r.completed).toEqual(["d-series-6", "d-goals-20"]);
    expect(r.bonuses).toEqual(["daily"]);
    expect(r.xp).toBe(MISSIONS.daily.xp.mid * 2 + MISSIONS.daily.allBonus); // both mid-tier
    expect(r.state.completedTotal).toBe(3);
    // Progress is capped at the target and completed missions never re-pay.
    expect(r.state.daily?.progress["d-series-6"]).toBe(6);
    const again = applyMissionEvent(r.state, runEvent({ seriesWins: 9 }), t);
    expect(again.xp).toBe(0);
    expect(again.state).toBe(r.state);
  });

  it("unrelated events change nothing (same object back)", () => {
    const state = rollMissions(EMPTY_MISSIONS, ROOKIE, new Date("2026-10-21T10:00:00Z"));
    const r = applyMissionEvent(state, { type: "career_title" });
    expect(r.state).toBe(state);
    expect(r.xp).toBe(0);
  });

  it("template semantics: daily win, perfect chemistry, trio, blind playoffs, quiz first try, stars", () => {
    const p = (id: string, e: Parameters<typeof applyMissionEvent>[1]) => missionById.get(id)!.progress(e);
    expect(p("d-daily-win", runEvent({ mode: "daily", placement: "champion" }))).toBe(1);
    expect(p("d-daily-win", runEvent({ mode: "classic", placement: "champion" }))).toBe(0);
    expect(p("d-chem-perfect", runEvent({ chemistryTier: "Perfect" }))).toBe(1);
    expect(p("d-chem-great", runEvent({ chemistryTier: "Perfect" }))).toBe(1);
    expect(p("d-trio-lineup", runEvent({ sameLineupTrio: true }))).toBe(1);
    expect(p("d-hidden-playoffs", runEvent({ hiddenOverall: true, placement: "top8" }))).toBe(1);
    expect(p("d-hidden-playoffs", runEvent({ hiddenOverall: true }))).toBe(0);
    expect(p("d-quiz-first-try", { type: "quiz_played", solved: true, attempt: 1 })).toBe(1);
    expect(p("d-quiz-first-try", { type: "quiz_played", solved: true, attempt: 2 })).toBe(0);
    expect(p("w-stars-5", { type: "challenge_cleared", newStars: 2 })).toBe(2);
    expect(p("d-win-hard", runEvent({ difficulty: "legacy", placement: "champion" }))).toBe(1);
    expect(p("d-legacy-series-2", runEvent({ difficulty: "legacy", seriesWins: 3 }))).toBe(3);
    expect(p("d-legacy-series-2", runEvent({ difficulty: "hard", seriesWins: 3 }))).toBe(0);
  });

  it("mergeMissions: same key → MAX progress + union completions; different keys → newer wins", () => {
    const a = { ...newSlot("daily", "2026-10-21", ROOKIE), ids: ["x", "y", "z"], progress: { x: 2 }, completedAt: { y: "2026-10-21T10:00:00.000Z" } };
    const b = { ...a, progress: { x: 1, z: 3 }, completedAt: { y: "2026-10-21T09:00:00.000Z", z: "2026-10-21T11:00:00.000Z" }, bonusAt: null };
    const m = mergeMissions({ ...EMPTY_MISSIONS, daily: a, completedTotal: 4 }, { ...EMPTY_MISSIONS, daily: b, completedTotal: 6 });
    expect(m.daily?.progress).toEqual({ x: 2, z: 3 });
    expect(m.daily?.completedAt).toEqual({ y: "2026-10-21T09:00:00.000Z", z: "2026-10-21T11:00:00.000Z" });
    expect(m.completedTotal).toBe(6);
    const newer = { ...a, key: "2026-10-22" };
    expect(mergeMissions({ ...EMPTY_MISSIONS, daily: a }, { ...EMPTY_MISSIONS, daily: newer }).daily?.key).toBe("2026-10-22");
  });
});

describe("login streak", () => {
  it("counts once per UTC day, extends on consecutive days, resets after a gap, keeps best", () => {
    const d1 = recordLogin(EMPTY_LOGIN, new Date("2026-10-21T08:00:00Z"));
    expect(d1).toMatchObject({ counted: true, xp: LOGIN_STREAK.perDayBase, milestone: null });
    expect(d1.state).toEqual({ lastDay: "2026-10-21", streak: 1, best: 1, total: 1 });
    expect(recordLogin(d1.state, new Date("2026-10-21T23:00:00Z")).counted).toBe(false);
    const d2 = recordLogin(d1.state, new Date("2026-10-22T00:10:00Z"));
    const d3 = recordLogin(d2.state, new Date("2026-10-23T00:10:00Z"));
    expect(d3.state.streak).toBe(3);
    expect(d3.milestone).toBe(3);
    expect(d3.xp).toBe(loginDayXp(3) + LOGIN_STREAK.milestoneBonus[3]);
    const gap = recordLogin(d3.state, new Date("2026-10-25T00:10:00Z"));
    expect(gap.state).toEqual({ lastDay: "2026-10-25", streak: 1, best: 3, total: 4 });
  });

  it("per-day XP grows to the cap", () => {
    expect(loginDayXp(1)).toBe(LOGIN_STREAK.perDayBase);
    expect(loginDayXp(2)).toBe(LOGIN_STREAK.perDayBase + LOGIN_STREAK.perDayStep);
    expect(loginDayXp(100)).toBe(LOGIN_STREAK.perDayMax);
  });

  it("mergeLogin: latest day wins the streak, best/total are monotonic", () => {
    const a = { lastDay: "2026-10-23", streak: 3, best: 3, total: 5 };
    const b = { lastDay: "2026-10-25", streak: 1, best: 9, total: 7 };
    expect(mergeLogin(a, b)).toEqual({ lastDay: "2026-10-25", streak: 1, best: 9, total: 7 });
    expect(mergeLogin(b, a)).toEqual({ lastDay: "2026-10-25", streak: 1, best: 9, total: 7 });
    expect(mergeLogin({ ...a, streak: 2 }, { ...a, streak: 3 }).streak).toBe(3);
  });
});
