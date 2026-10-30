/**
 * rc.36 — front T2 (POL-01, Miguel's rc.35 playtest; ROAD-TO-WORLDS-DECISIONS
 * R83): the promise paid along the way and on completion (never twice, kept
 * by an adjustment, forfeited by a stop), a signing joining the running cycle,
 * an unknown phase read after a few training days, an rc.35 save with a
 * running 14-day cycle, Heavy / Hard's modest absence risk, and the arc bot
 * starting cycles as its players would. Deterministic: one seed per case.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PLAN, CAREER_SCOUT } from "@/config/balance";
import { trainingEta } from "@/engine/career/development";
import { simplePackageOf } from "@/engine/career/training";
import type { CareerSave, SquadPlayer, TrainingPackage, TrainingSummary } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  createCareerSave,
  finishEvent,
  isEventPaused,
  migrateSaveToV5,
  resolveInsertFlow,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";
import {
  projectTrainingPackage,
  reportKeyOf,
  setTrainingPackageFlow,
  squadPhaseLevelOf,
  trainingBlockOf,
  trainingDayStart,
  trainingOf,
  trainingReportOf,
  wearUnavailabilityAddOf,
} from "./careerTraining";
import { walkPastForTests } from "./careerClockForTests";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Promise Org",
    abbrev: "PRM",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  prefs: { autoEnterUnofficials: false },
  rosterKey: "prospects",
  trainingMode: "manual",
};

const DEV: TrainingPackage = simplePackageOf({ objective: "development", workload: "heavy", scrims: "even", focus: "mechanics-lab" });

function step(input: CareerSave): CareerSave {
  let save = input;
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  } else if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  }
  if (save.phase !== "running") return save;
  return advanceDayFlow(walkPastForTests(save));
}

function playTo(input: CareerSave, day: number, onDay?: (s: CareerSave) => CareerSave): CareerSave {
  let save = input;
  let stuck = 0;
  for (let guard = 0; save.clock.day < day && save.phase === "running" && guard < 1000; guard++) {
    const before = save.clock.day;
    save = step(save);
    if (save.clock.day !== before) {
      stuck = 0;
      if (onDay) save = onDay(save);
    } else if (++stuck > 4) break;
  }
  return save;
}

const heldOf = (s: CareerSave): Record<string, number> =>
  Object.fromEntries(Object.entries(trainingOf(s).plan?.players ?? {}).map(([id, e]) => [id, e.held ?? 0]));
const reload = (s: CareerSave): CareerSave => migrateSaveToV5(JSON.parse(JSON.stringify(s)))!;

describe("rc.36 T2 — the promise: paid along the way, the rest on completion", { timeout: 120_000 }, () => {
  it("a cycle climbs to about 8–9 of 10 along the way and lands the held rest on its last day — never under the base", () => {
    const start = createCareerSave(INPUT, 36_001);
    const pkg = setTrainingPackageFlow(start, DEV).save;
    const promise = projectTrainingPackage(pkg, DEV);
    const eve = playTo(pkg, 28);
    const plan = trainingOf(eve).plan!;
    // Along the way: what landed is alongShare-ish of the cycle's gain (held part > 0).
    const along: number[] = [];
    for (const p of eve.squad) {
      const e = plan.players[p.id];
      if (!e || (e.cycleGain ?? 0) < 0.3) continue;
      expect(e.held ?? 0, p.name).toBeGreaterThan(0);
      along.push(((e.cycleGain ?? 0) - (e.held ?? 0)) / (e.cycleGain ?? 1));
    }
    expect(along.length).toBeGreaterThan(0);
    for (const share of along) {
      expect(share).toBeGreaterThanOrEqual(CAREER_PLAN.payout.alongShare - 0.02);
      expect(share).toBeLessThan(0.95);
    }
    // The base never runs ahead of a plan along the way.
    const base = playTo(start, 28);
    for (const p of eve.squad) {
      const b = base.squad.find((x) => x.id === p.id)!;
      expect(p.overall + 1e-6, p.name).toBeGreaterThanOrEqual(b.overall);
    }
    // Day 29: the cycle completes — the held gain lands, the summary says how much.
    const done = playTo(eve, 29);
    const summary = trainingOf(done).history[0];
    expect(summary).toMatchObject({ periodIndex: 0, author: "user" });
    for (const p of summary.players) {
      const e = plan.players[p.id];
      if ((e?.held ?? 0) > 0.001) expect(p.completion ?? 0, p.name).toBeGreaterThan(0);
      expect(p.completion ?? 0).toBeLessThanOrEqual((e?.held ?? 0) + 0.005); // the summary rounds to 2 decimals
    }
    // The promise shown at the start is what the cycle delivered (sessions + scrims), within the forecast's noise.
    const starters = summary.players.filter((p) => done.starterIds.includes(p.id));
    const delivered = starters.reduce((n, p) => n + p.sessions + p.scrims, 0) / starters.length;
    expect(Math.abs(delivered - promise.startersAvg)).toBeLessThan(0.15);
    expect(trainingReportOf(done)).toMatchObject({ periodIndex: 0 });
  });

  it("never pays twice — a reload, the same day twice, the batched Advance and +1 day reach the same save", () => {
    const pkg = setTrainingPackageFlow(createCareerSave(INPUT, 36_002), DEV).save;
    const eve = playTo(pkg, 28);
    // A reload on the last day, then the completion.
    const a = playTo(reload(eve), 29);
    const b = playTo(eve, 29);
    expect(a.squad).toEqual(b.squad);
    expect(trainingOf(a).history).toEqual(trainingOf(b).history);
    // The completion day twice (and reloaded): nothing lands again.
    const twice = structuredClone(b);
    trainingDayStart(twice);
    expect(twice.squad).toEqual(b.squad);
    expect(reload(b).squad).toEqual(b.squad);
    // The batched Advance through the boundary = stepping day by day.
    const skipped = advanceToNextStopFlow(walkPastForTests(eve));
    let stepped = walkPastForTests(eve);
    for (let g = 0; g < 60 && stepped.clock.day < skipped.clock.day; g++) stepped = advanceDayFlow(stepped);
    expect(stepped.squad).toEqual(skipped.squad);
    expect(trainingOf(stepped)).toEqual(trainingOf(skipped));
  });

  it("an adjustment midway keeps what was earned and held; a cycle stopped early forfeits its held part", () => {
    const pkg = setTrainingPackageFlow(createCareerSave(INPUT, 36_003), DEV).save;
    const mid = playTo(pkg, 15);
    const held = heldOf(mid);
    const adjusted = setTrainingPackageFlow(mid, simplePackageOf({ objective: "recovery", workload: "light", scrims: "easy", focus: "balanced" })).save;
    expect(heldOf(adjusted)).toEqual(held);
    expect(trainingOf(adjusted).plan).toMatchObject({ cycleFrom: 2, package: { objective: "recovery" } });
    expect(trainingOf(adjusted).plan!.notes.map((n) => n.key)).toContain("objectiveChange");
    const kept = playTo(adjusted, 29);
    const landed = trainingOf(kept).history[0].players.reduce((n, p) => n + (p.completion ?? 0), 0);
    expect(landed).toBeGreaterThan(0);
    // Stopped (the flow's null; the screen offers no stop): the held part is gone, the base runs on.
    const stopped = setTrainingPackageFlow(mid, null).save;
    expect(Object.values(heldOf(stopped)).every((h) => h === 0)).toBe(true);
    expect(trainingOf(stopped).plan).toMatchObject({ package: null, author: "base" });
    expect(trainingOf(stopped).plan!.cycleFrom).toBeUndefined();
    expect(trainingOf(stopped).plan!.notes.map((n) => n.key)).toContain("cycleStopped");
    const after = playTo(stopped, 29);
    expect(trainingOf(after).history[0].players.every((p) => !p.completion)).toBe(true);
    // A forfeited cycle is still the report of a cycle that ran (its package until the stop is filed as base).
    expect(trainingOf(after).history[0].package).toBeNull();
  });

  it("the HQ / Training view: the promise bar adds up and the ETA reads the rate paid along the way", () => {
    const pkg = setTrainingPackageFlow(createCareerSave(INPUT, 36_004), DEV).save;
    const mid = playTo(pkg, 12);
    const view = trainingBlockOf(mid);
    expect(view.running).toBe(true);
    expect(view.cycle).toMatchObject({ fromDay: 2, endDay: 28 });
    const pr = view.promise!;
    expect(pr.paid).toBeGreaterThan(0);
    expect(pr.held).toBeGreaterThan(0);
    expect(pr.paid + pr.held + pr.restPaid + pr.restHeld).toBeCloseTo(pr.total, 1);
    // At the end of the cycle the bar reads 8–9 of 10 earned (the rest on completion).
    const last = trainingBlockOf(playTo(pkg, 28)).promise!;
    const share = last.paid / Math.max(0.01, last.total);
    expect(share).toBeGreaterThan(0.8);
    expect(share).toBeLessThan(0.95);
  });
});

describe("rc.36 T2 — a signing joins the running cycle; an unknown phase is read after a few training days", { timeout: 120_000 }, () => {
  function signKid(save0: CareerSave): { save: CareerSave; id: string } {
    const save = { ...structuredClone(save0), reputation: 60 };
    save.finances = { ...save.finances, balance: 2_000_000 };
    const reserve = save.squad.find((p) => !save.starterIds.includes(p.id));
    for (const id of save.world.freeAgentIds.filter((x) => x.startsWith("fic:"))) {
      const res = signPlayerFlow(save, id, { lengthSeasons: 1, releaseId: save.squad.length >= 4 ? reserve?.id : undefined });
      if (!res.error) return { save: res.save, id };
    }
    throw new Error("no free agent signed");
  }

  it("he is in the plan the day he signs (a summary line), trains its package from his first session and is filed with it", () => {
    const pkg = setTrainingPackageFlow(createCareerSave(INPUT, 36_005), DEV).save;
    const { save, id } = signKid(playTo(pkg, 4));
    const plan = trainingOf(save).plan!;
    expect(plan.players[id]).toMatchObject({ joinedDay: save.clock.day, sessions: 0 });
    expect(plan.notes.some((n) => n.key === "joined")).toBe(true);
    expect(projectTrainingPackage(save, plan.package).players.some((p) => p.id === id)).toBe(true);
    const later = playTo(save, 29);
    const row = trainingOf(later).history[0].players.find((p) => p.id === id);
    expect(row).toMatchObject({ joined: true });
    expect(row!.sessions).toBeGreaterThan(0);
  });

  it(`a "?" phase reads after CAREER_PLAN.phaseRevealDays training days, with a feed line — never earlier`, () => {
    const { save, id } = signKid(createCareerSave(INPUT, 36_006));
    const kid = () => save.squad.find((p) => p.id === id)!;
    expect(kid().scoutLevel).toBeLessThan(CAREER_SCOUT.phaseRevealLevel);
    expect(squadPhaseLevelOf(kid())).toBeLessThan(CAREER_SCOUT.phaseRevealLevel);
    let s = save;
    let days = 0;
    for (let guard = 0; guard < 30 && days < CAREER_PLAN.phaseRevealDays; guard++) {
      const before = (s.squad.find((p) => p.id === id)?.phaseDays ?? 0) as number;
      s = step(s);
      const p = s.squad.find((x) => x.id === id)!;
      if ((p.phaseDays ?? 0) > before) days += 1;
      if (days < CAREER_PLAN.phaseRevealDays) expect(squadPhaseLevelOf(p)).toBeLessThan(CAREER_SCOUT.phaseRevealLevel);
    }
    const p = s.squad.find((x) => x.id === id) as SquadPlayer;
    expect(p.phaseDays).toBe(CAREER_PLAN.phaseRevealDays);
    expect(squadPhaseLevelOf(p)).toBe(CAREER_SCOUT.phaseRevealLevel);
    expect(p.scoutLevel).toBeLessThan(CAREER_SCOUT.phaseRevealLevel); // the potential band is not narrowed for free
    expect(s.news.some((n) => n.titleKey === "phaseRead" && n.params?.player === p.name)).toBe(true);
    // One more day changes nothing (no second line).
    const lines = s.news.filter((n) => n.titleKey === "phaseRead").length;
    expect(playTo(s, s.clock.day + 3).news.filter((n) => n.titleKey === "phaseRead").length).toBe(lines);
  });
});

describe("rc.36 T2 — an rc.35 save with a running 14-day cycle converts cleanly", { timeout: 120_000 }, () => {
  /** An rc.35 shape: the 14-day plan running (no hold fields), its filed 14-day summaries, the "season:index" seen key. */
  function asRc35(save: CareerSave, plan: { startDay: number; endDay: number; periodIndex: number }, filed: TrainingSummary[], seen: string): CareerSave {
    const old = structuredClone(save);
    const t = old.training!;
    Object.assign(t.plan!, plan);
    delete t.plan!.cycleFrom;
    for (const e of Object.values(t.plan!.players)) {
      delete e.held;
      delete e.cycleGain;
    }
    t.history = filed;
    t.reportSeen = seen;
    return old;
  }

  function summaryFor(save: CareerSave, periodIndex: number, startDay: number, endDay: number): TrainingSummary {
    return {
      seasonIndex: 0,
      periodIndex,
      startDay,
      endDay,
      package: DEV,
      author: "user",
      players: save.squad.map((p) => ({ id: p.id, name: p.name, before: p.overall, after: p.overall, attrs: {}, sessions: 0, scrims: 0, series: 0, seriesGain: 0, coachShare: 0, declined: 0, wear: 0 })),
      scrims: {},
      chemStart: 0,
      chemEnd: 0,
      coaches: [],
      notes: [],
    };
  }

  it("a cycle on rc.35's second half (days 15–28) runs to its end; the 28-day grid follows with no index clash and no old report popping", () => {
    const now = playTo(setTrainingPackageFlow(createCareerSave(INPUT, 36_007), DEV).save, 20);
    const old = asRc35(now, { startDay: 15, endDay: 28, periodIndex: 1 }, [summaryFor(now, 0, 1, 14)], "0:0");
    const loaded = reload(old);
    const t = trainingOf(loaded);
    expect(t.reportSeen).toBe(reportKeyOf({ seasonIndex: 0, startDay: 1 }));
    expect(t.plan).toMatchObject({ startDay: 15, endDay: 28, periodIndex: 1 });
    expect(trainingReportOf(loaded)).toBeNull();
    expect(reload(loaded)).toEqual(loaded); // idempotent
    // Its end: filed (its report shows, once), then the grid's period 2 (days 29–56) opens on the base.
    const end = playTo(loaded, 29);
    expect(trainingOf(end).history[0]).toMatchObject({ startDay: 15, periodIndex: 1 });
    expect(trainingReportOf(end)).toMatchObject({ startDay: 15 });
    expect(trainingOf(end).plan).toMatchObject({ startDay: 29, endDay: 56, periodIndex: 1, package: null });
    // The grid's period with the same index is filed too (rc.35 keyed by index would have dropped it).
    const next = playTo(setTrainingPackageFlow(end, DEV).save, 57);
    const filed = trainingOf(next).history.map((h) => `${h.startDay}-${h.endDay}`);
    expect(filed.slice(0, 3)).toEqual(["29-56", "15-28", "1-14"]);
    expect(trainingReportOf(next)).toMatchObject({ startDay: 29 });
  });

  it("a cycle on rc.35's first half (days 1–14) runs to day 14; the grid's period then runs from day 15 and both are filed", () => {
    const now = playTo(setTrainingPackageFlow(createCareerSave(INPUT, 36_008), DEV).save, 10);
    const old = asRc35(now, { startDay: 1, endDay: 14, periodIndex: 0 }, [], "");
    const loaded = reload(old);
    const at15 = playTo(loaded, 15);
    expect(trainingOf(at15).history[0]).toMatchObject({ startDay: 1, endDay: 14, periodIndex: 0 });
    expect(trainingOf(at15).plan).toMatchObject({ startDay: 15, endDay: 28, periodIndex: 0, package: null });
    const at29 = playTo(setTrainingPackageFlow(at15, DEV).save, 29);
    expect(trainingOf(at29).history.map((h) => h.startDay).slice(0, 2)).toEqual([15, 1]);
    expect(trainingOf(at29).plan).toMatchObject({ startDay: 29, periodIndex: 1 });
  });
});

describe("rc.36 T2 — Heavy and Hard raise the absence risk, modestly and additively", { timeout: 120_000 }, () => {
  it("each adds about +2 points to a cycle, both reach the +4 cap, Easy scrims never cancel a Heavy load", () => {
    const start = createCareerSave(INPUT, 36_009);
    const pts = (workload: "light" | "normal" | "heavy", scrims: "off" | "easy" | "even" | "hard") => {
      const s = setTrainingPackageFlow(start, simplePackageOf({ objective: "development", workload, scrims, focus: "balanced" })).save;
      return Math.round(wearUnavailabilityAddOf(s) * 1000) / 10;
    };
    const cap = CAREER_PLAN.wear.chanceMax * 100;
    expect(pts("normal", "even")).toBe(0);
    expect(pts("normal", "off")).toBe(0);
    const heavy = pts("heavy", "even");
    const hard = pts("normal", "hard");
    const both = pts("heavy", "hard");
    expect(heavy).toBeGreaterThanOrEqual(1.2);
    expect(heavy).toBeLessThanOrEqual(2.5);
    expect(hard).toBeGreaterThanOrEqual(1.2);
    expect(hard).toBeLessThanOrEqual(2.5); // rc.35: Hard alone hit the cap
    expect(both).toBeGreaterThan(Math.max(heavy, hard));
    expect(both).toBeLessThanOrEqual(cap);
    const heavyEasy = pts("heavy", "easy");
    expect(heavyEasy).toBeGreaterThan(0); // rc.35: 0
    expect(heavyEasy).toBeLessThan(heavy);
    expect(pts("light", "hard")).toBeLessThan(hard);
  });
});

describe("rc.36 T2 — HQ's green bar fills only toward the next point the card prints", () => {
  it("progress runs 0 → 1 from the last shown overall to the next one and resets as the number ticks up", () => {
    const save = createCareerSave(INPUT, 36_010);
    const p0 = save.squad[0];
    const ctx = { seasonIndex: 0, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, model: 2, day: 10, careerSeed: save.careerSeed };
    const at = (overall: number) => trainingEta({ ...p0, overall, potential: 95, gainedThisSeason: 0, gainedThisSplit: 0 }, ctx);
    // 78.6 prints 79: the bar leads to 80 (lands at 79.5) — 0.1 of the way.
    expect(at(78.6)).toMatchObject({ nextPoint: 80 });
    expect(at(78.6).progress).toBeCloseTo(0.1, 5);
    expect(at(78.6).toNext).toBeCloseTo(0.9, 5);
    // 78.4 prints 78: the bar leads to 79 — 0.9 of the way.
    expect(at(78.4)).toMatchObject({ nextPoint: 79 });
    expect(at(78.4).progress).toBeCloseTo(0.9, 5);
    // The tick to a new printed point resets it.
    expect(at(78.5).progress).toBeCloseTo(0, 5);
    expect(at(78.5).nextPoint).toBe(80);
    expect(at(79.49).progress).toBeGreaterThan(0.98);
  });
});

describe("rc.36 T2 — the arc bot starts cycles as its players would (no measurement drops the package)", { timeout: 300_000 }, () => {
  it("the hands-off manager follows the recommendation, the delegator's coach plans them, the trainer runs his own", () => {
    const share = (policy: "autopilot" | "delegator" | "trainer") => {
      const career = playArcCareer({ region: "EU", difficulty: "normal", policy, seed: 36_011, seasons: 1 });
      expect(career.softlock).toBeNull();
      const objectives = career.seasons[0].training?.objectives ?? [];
      expect(objectives.length).toBe(periodsInSeason);
      return objectives.filter((o) => o !== "base").length / objectives.length;
    };
    const periodsInSeason = 8;
    expect(share("autopilot")).toBe(1);
    expect(share("delegator")).toBe(1);
    expect(share("trainer")).toBe(1);
  });
});
