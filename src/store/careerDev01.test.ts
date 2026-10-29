/**
 * Road to Worlds — DEV-01, the growth contract (rc.32, R55–R57), through the
 * real flow: a new career runs development model 2, an rc.31 save keeps model
 * 1 for life (versioned derivation: nothing it scouted or built moves), the
 * band of a bought report never moves, the AI world grows week by week (no
 * lump at the rollover), a reserve who did not play earns no event XP, and a
 * signing never rerolls a player's arc.
 */

import { describe, expect, it } from "vitest";
import { CAREER_DEV, CAREER_TRAINING } from "@/config/balance";
import { potBandOfSquad, potBandOfView } from "@/components/career/careerUi";
import { growthModelOf, playerViewById } from "@/engine/career/development";
import type { CareerSave } from "@/engine/career/types";
import {
  advanceDayFlow,
  buyScoutReportFlow,
  createCareerSave,
  finishEvent,
  isEventPaused,
  migrateSaveToV5,
  rolloverToNextSeason,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Growth Org",
    abbrev: "GRO",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "prospects",
};

/** An rc.31 save: the same career without the rc.32 field (what every older career is). */
function asRc31(save: CareerSave): CareerSave {
  const out = structuredClone(save);
  delete out.world.growthModel;
  return out;
}

/** Plays `n` days the way the bot does: skips the weekly insert, sims the user's matchdays. */
const days = (save: CareerSave, n: number): CareerSave => {
  let s = save;
  for (let i = 0; i < n && s.phase === "running"; i++) {
    if (s.pendingInsert && s.pendingInsert.day === s.clock.day) s = { ...s, pendingInsert: null };
    if (s.activeEvent) {
      s = simEventToEnd(s);
      if (!isEventPaused(s) && s.activeEvent?.tournament.stage === "finished") s = finishEvent(s);
    } else if (s.pendingEventDef && s.pendingEventDef.day === s.clock.day) {
      s = simEventToEnd(startEvent(s, false));
      if (!isEventPaused(s) && s.activeEvent?.tournament.stage === "finished") s = finishEvent(s);
    }
    s = advanceDayFlow(s);
  }
  return s;
};

/** A career created on rc.31's model (CAREER_DEV.growthModel 1 — what every older career is). */
function rc31Career(seed: number): CareerSave {
  const dev = CAREER_DEV as { growthModel: number };
  const was = dev.growthModel;
  try {
    dev.growthModel = 1;
    return createCareerSave(INPUT, seed);
  } finally {
    dev.growthModel = was;
  }
}

describe("DEV-01 through the flow", { timeout: 120_000 }, () => {
  it("a new career runs model 2 for life (the rollover keeps it); an rc.31 save loads on model 1 and stays there", () => {
    const save = createCareerSave(INPUT, 50_101);
    expect(growthModelOf(save.world)).toBe(2);
    const next = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(growthModelOf(next.world)).toBe(2);
    const old = migrateSaveToV5(JSON.parse(JSON.stringify(asRc31(save))))!;
    expect(growthModelOf(old.world)).toBe(1);
    expect(growthModelOf(rolloverToNextSeason({ ...old, phase: "seasonReview" }).world)).toBe(1);
  });

  it("migration: an rc.31 save keeps its ids, contracts and overalls on load — no compensating jump", () => {
    const save = days(createCareerSave(INPUT, 50_202), 20);
    const old = asRc31(save);
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(old)))!;
    expect(loaded.squad.map((p) => [p.id, p.overall, p.potential, p.contractEndSeason, p.salaryPerSplit])).toEqual(
      old.squad.map((p) => [p.id, p.overall, p.potential, p.contractEndSeason, p.salaryPerSplit]),
    );
    expect(loaded.world.overallDelta).toEqual(old.world.overallDelta);
  });

  it("an rc.31 save keeps rc.31's growth: the split cap, the rollover lump for the world", () => {
    let save = rc31Career(50_303);
    expect(growthModelOf(save.world)).toBe(1);
    save = days(save, 60);
    expect(save.clock.day).toBeGreaterThan(40);
    for (const p of save.squad) expect(p.gainedThisSplit).toBeLessThanOrEqual(CAREER_TRAINING.maxSplitGain + 1e-9);
    // The rc.31 world never grows between rollovers (no weekly tick): the market only marks
    // displaced players off-script at 0; the growth lands at the rollover.
    const fictional = Object.entries(save.world.overallDelta).filter(([id]) => id.startsWith("fic:"));
    for (const [, d] of fictional) expect(d).toBe(0);
    const rolled = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(Object.entries(rolled.world.overallDelta).some(([id, d]) => id.startsWith("fic:") && d !== 0)).toBe(true);
  });

  it("model 2: the AI world grows week by week; the rollover adds no growth lump", () => {
    let save = createCareerSave(INPUT, 50_404);
    const kid = Object.values(save.world.orgs)
      .flatMap((o) => o.playerIds)
      .map((id) => playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world }))
      .find((v) => v && v.kind === "fictional" && v.age <= 18 && v.potential - v.overall >= 4)!;
    expect(kid).toBeTruthy();
    const at = (s: CareerSave) => playerViewById(kid.id, { careerSeed: s.careerSeed, seasonIndex: s.clock.seasonIndex, world: s.world })!.overall;
    const o0 = at(save);
    save = days(save, 14); // two Mondays
    const o2 = at(save);
    expect(o2).toBeGreaterThan(o0);
    expect(o2 - o0).toBeLessThan(1);
    // Jump to the season's last day, then the rollover: his overall does not move at the rollover.
    save = { ...save, clock: { ...save.clock, day: 224 }, phase: "seasonReview" };
    const beforeRoll = at(save);
    const rolled = rolloverToNextSeason(save);
    // The new season's day 1 is a Monday: one week of growth at most.
    const after = playerViewById(kid.id, { careerSeed: rolled.careerSeed, seasonIndex: rolled.clock.seasonIndex, world: rolled.world });
    if (after) expect(Math.abs(after.overall - beforeRoll)).toBeLessThan(0.5);
  });

  it("model 2: a bought report's band never moves across days, a reload or the overall growing", () => {
    let save = createCareerSave(INPUT, 50_505);
    save.finances.balance = 100_000;
    const fa = save.world.freeAgentIds.find((id) => id.startsWith("fic:"))!;
    const view0 = playerViewById(fa, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world })!;
    const l0 = potBandOfView(save, view0);
    save = buyScoutReportFlow(save, fa).save;
    const bought = potBandOfView(save, view0);
    expect(bought.min).toBeGreaterThanOrEqual(l0.min);
    expect(bought.max).toBeLessThanOrEqual(l0.max);
    save = days(save, 30);
    const reloaded = JSON.parse(JSON.stringify(save)) as CareerSave;
    const view1 = playerViewById(fa, { careerSeed: reloaded.careerSeed, seasonIndex: reloaded.clock.seasonIndex, world: reloaded.world });
    if (view1) {
      expect(view1.potential).toBe(view0.potential);
      expect(potBandOfView(reloaded, view1)).toEqual(bought);
    }
    // The squad's own bands hold too while his overall trains up.
    const p = save.squad[0];
    const grown = { ...p, overall: p.overall + 2 };
    expect(potBandOfSquad(save, grown)).toEqual(potBandOfSquad(save, p));
  });

  it("a signing never rerolls the arc: the squad record carries the world's peak age and potential", () => {
    const save = createCareerSave(INPUT, 50_606);
    save.finances.balance = 1_000_000;
    save.reputation = 100;
    const id = save.world.freeAgentIds.find((x) => {
      const v = playerViewById(x, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world });
      return v && v.kind === "fictional" && v.age >= 16;
    })!;
    const view = playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world })!;
    const res = signPlayerFlow(save, id, { lengthSeasons: 2, releaseId: save.squad[3]?.id });
    expect(res.error).toBeUndefined();
    const p = res.save.squad.find((x) => x.id === id)!;
    expect([p.peakAge, p.potential, p.declineRate]).toEqual([view.peakAge, view.potential, view.declineRate]);
  });

  it("a reserve who did not play the event earns no event XP (model 2); the fielded trio does", () => {
    let save = createCareerSave({ ...INPUT, rosterKey: "balanced" }, 50_707);
    // Sign a fourth player so the squad carries a reserve.
    save.finances.balance = 1_000_000;
    save.reputation = 100;
    const fa = save.world.freeAgentIds.find((x) => x.startsWith("fic:"))!;
    save = signPlayerFlow(save, fa, { lengthSeasons: 2 }).save;
    expect(save.squad.some((p) => p.role === "sub")).toBe(true);
    // Play to the first event the user enters.
    let guard = 0;
    while (!(save.pendingEventDef && save.pendingEventDef.day === save.clock.day) && guard++ < 60) save = advanceDayFlow(save);
    expect(save.pendingEventDef).toBeTruthy();
    const started = simEventToEnd(startEvent(save, false));
    const before = new Map(started.squad.map((p) => [p.id, p.gainedThisSeason]));
    const done = finishEvent(started);
    const fielded = started.activeEvent!.fieldedIds ?? started.starterIds;
    for (const p of done.squad) {
      if (fielded.includes(p.id)) expect(p.gainedThisSeason).toBeGreaterThanOrEqual(before.get(p.id)!);
      else expect(p.gainedThisSeason).toBe(before.get(p.id));
    }
    expect(done.squad.some((p) => fielded.includes(p.id) && p.gainedThisSeason > before.get(p.id)!)).toBe(true);
  });
});
