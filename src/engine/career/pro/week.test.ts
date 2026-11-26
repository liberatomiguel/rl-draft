/**
 * v2.2 Pro slice 2 (PRO-SPEC §4.3, §5, §7.1, R150): the week, ranked and match XP.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PRO, CAREER_PRO_RANKED, CAREER_PRO_WEEK, RANKS } from "@/config/balance";
import { createProSave } from "./create";
import { applyMatchXp, proAgeOf, proOverall } from "./growth";
import { confidenceOf, withRating } from "./form";
import { cupsUnlocked, expectedSessionDelta, playRankedSession, rankOf, skillMmrFor, winChance } from "./ranked";
import {
  applyBlock,
  applyWeekPlan,
  closeWeek,
  coachPlanFor,
  isBurnedOut,
  previewWeek,
  type ProActivity,
  type ProWeekPlan,
  type WeekCtx,
} from "./week";
import type { CreateProInput, ProPlayer } from "./types";

const INPUT: CreateProInput = {
  name: "Rookie",
  country: "br",
  region: "SAM",
  startAge: 13,
  archetype: "allround",
  difficulty: "normal",
};

const SEED = 4242;
const fresh = (seed = SEED, over: Partial<ProPlayer> = {}): ProPlayer => ({ ...createProSave(INPUT, seed, "test").player, ...over });
const ctxOf = (seasonIndex = 0, day = 1, hasTeam = false, seed = SEED): WeekCtx => ({ seasonIndex, day, hasTeam, careerSeed: seed });

const REST: ProActivity = { kind: "rest" };
const TRAIN = (focus: "mechanics" | "defense" | "balanced" = "mechanics"): ProActivity => ({ kind: "train", focus });
const RANKED: ProActivity = { kind: "ranked" };
const CONTENT: ProActivity = { kind: "content" };

const DAYS_PER_WEEK = 7;
const WEEKS_PER_SEASON = 32;

/** Play weeks with a policy until `stop` or `maxWeeks`; returns the player and the week count. */
function play(
  start: ProPlayer,
  policy: (p: ProPlayer, week: number, ctx: WeekCtx) => ProWeekPlan,
  maxWeeks: number,
  stop: (p: ProPlayer) => boolean = () => false,
  seed = SEED,
): { player: ProPlayer; weeks: number } {
  let p = start;
  for (let w = 0; w < maxWeeks; w++) {
    if (stop(p)) return { player: p, weeks: w };
    const seasonIndex = Math.floor(w / WEEKS_PER_SEASON);
    const day = 1 + (w % WEEKS_PER_SEASON) * DAYS_PER_WEEK;
    const ctx = ctxOf(seasonIndex, day, false, seed);
    p = applyWeekPlan(p, policy(p, w, ctx), ctx).player;
  }
  return { player: p, weeks: maxWeeks };
}

const sensible = (p: ProPlayer, _w: number, ctx: WeekCtx) => coachPlanFor(p, ctx);
const careless = (): ProWeekPlan => [CONTENT, CONTENT, RANKED];

describe("Pro week: energy", () => {
  it("each activity spends its energy; rest recovers; energy stays inside 0-100", () => {
    const p = fresh();
    expect(applyBlock(p, TRAIN(), ctxOf()).player.energy).toBe(p.energy - CAREER_PRO_WEEK.cost.train);
    expect(applyBlock(p, CONTENT, ctxOf()).player.energy).toBe(p.energy - CAREER_PRO_WEEK.cost.content);
    expect(applyBlock(p, RANKED, ctxOf()).player.energy).toBe(p.energy - CAREER_PRO_WEEK.cost.ranked);
    expect(applyBlock({ ...p, energy: 10 }, REST, ctxOf()).player.energy).toBe(10 + CAREER_PRO_WEEK.restGain);
    expect(applyBlock(p, REST, ctxOf()).player.energy).toBe(CAREER_PRO_WEEK.energyMax);
    expect(applyBlock({ ...p, energy: 5 }, TRAIN(), ctxOf()).player.energy).toBe(0);
  });

  it("stays in bounds over a hundred random weeks", () => {
    let p = fresh();
    const acts: ProActivity[] = [REST, TRAIN(), RANKED, CONTENT, TRAIN("defense"), TRAIN("balanced")];
    for (let w = 0; w < 100; w++) {
      const plan = [acts[(w * 7) % 6], acts[(w * 5 + 1) % 6], acts[(w * 3 + 2) % 6]] as ProWeekPlan;
      p = applyWeekPlan(p, plan, ctxOf(0, 1 + w * 7)).player;
      expect(p.energy).toBeGreaterThanOrEqual(0);
      expect(p.energy).toBeLessThanOrEqual(CAREER_PRO_WEEK.energyMax);
    }
  });

  it("a scrim needs a team and changes nothing without one; with one it gives experience and chemistry", () => {
    const p = fresh();
    const none = applyBlock(p, { kind: "scrim" }, ctxOf(0, 1, false));
    expect(none.player).toEqual(p);
    expect(none.notes[0].code).toBe("scrimNeedsTeam");
    const some = applyBlock(p, { kind: "scrim" }, ctxOf(0, 1, true));
    expect(some.player.attrs.experience).toBeGreaterThan(p.attrs.experience);
    expect(some.player.chemistry).toBe(CAREER_PRO_WEEK.scrimChemistry);
    expect(some.player.energy).toBe(p.energy - CAREER_PRO_WEEK.cost.scrim);
  });

  it("content pays money and fame, and a bigger audience pays more", () => {
    const p = fresh();
    const a = applyBlock(p, CONTENT, ctxOf()).player;
    expect(a.money).toBeGreaterThan(0);
    expect(a.fame).toBeGreaterThan(0);
    const b = applyBlock({ ...p, fame: 10_000 }, CONTENT, ctxOf()).player;
    expect(b.money).toBeGreaterThan(a.money);
  });
});

describe("Pro week: tired training", () => {
  it("a tired block yields less than a rested one, and says so", () => {
    const p = fresh();
    const rested = applyBlock({ ...p, energy: 100 }, TRAIN(), ctxOf());
    const tired = applyBlock({ ...p, energy: 10 }, TRAIN(), ctxOf());
    const gain = (r: typeof rested) => r.player.attrs.mechanics - p.attrs.mechanics;
    expect(gain(tired)).toBeLessThan(gain(rested));
    expect(gain(tired)).toBeGreaterThan(0);
    expect(tired.notes.some((n) => n.code === "tiredTraining")).toBe(true);
    expect(rested.notes.some((n) => n.code === "tiredTraining")).toBe(false);
  });

  it("every training gain is in the explained log with its source", () => {
    const r = applyBlock(fresh(), TRAIN("defense"), ctxOf(0, 3));
    expect(r.growth).toHaveLength(1);
    expect(r.growth[0]).toMatchObject({ source: "training", stat: "defense", day: 3 });
    expect(r.growth[0].delta).toBeGreaterThan(0);
  });
});

describe("Pro week: burnout", () => {
  const tiredWeek: ProWeekPlan = [TRAIN(), TRAIN(), TRAIN()];

  it("the warning shows the week energy ends low, and a burnout never comes without one a week earlier", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let p = fresh(seed);
      let warnedBefore = false;
      for (let w = 0; w < 14; w++) {
        const r = applyWeekPlan(p, tiredWeek, ctxOf(0, 1 + w * 7, false, seed));
        const burned = r.notes.some((n) => n.code === "burnedOut");
        if (p.burnout?.warned) warnedBefore = true;
        if (burned) expect(warnedBefore).toBe(true);
        p = r.player;
        if (burned) {
          expect(isBurnedOut(p)).toBe(true);
          break;
        }
      }
    }
  });

  it("training three blocks a week without rest ends in burnout for most seeds, after a warning", () => {
    let burned = 0;
    let warned = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let p = fresh(seed);
      let sawWarning = false;
      for (let w = 0; w < 14; w++) {
        const r = applyWeekPlan(p, tiredWeek, ctxOf(0, 1 + w * 7, false, seed));
        if (r.notes.some((n) => n.code === "burnoutWarning")) sawWarning = true;
        p = r.player;
        if (isBurnedOut(p)) {
          burned++;
          if (sawWarning) warned++;
          break;
        }
      }
    }
    expect(burned).toBeGreaterThanOrEqual(45);
    expect(warned).toBe(burned);
  });

  it("a burned-out player rests every block, trains nothing, and returns rested after one or two weeks", () => {
    const p = fresh(SEED, { burnout: { warned: true, outWeeks: 2 }, energy: 10 });
    const r = applyWeekPlan(p, tiredWeek, ctxOf());
    expect(r.growth).toHaveLength(0);
    expect(r.player.attrs).toEqual(p.attrs);
    expect(isBurnedOut(r.player)).toBe(true);
    const r2 = applyWeekPlan(r.player, tiredWeek, ctxOf(0, 8));
    expect(isBurnedOut(r2.player)).toBe(false);
    expect(r2.player.energy).toBeGreaterThanOrEqual(CAREER_PRO_WEEK.burnoutReturnEnergy);
    expect(r2.notes.some((n) => n.code === "backFromBurnout")).toBe(true);
  });

  it("a balanced week never burns out and clears the warning", () => {
    let p = fresh();
    for (let w = 0; w < 60; w++) {
      const r = applyWeekPlan(p, [TRAIN(), TRAIN("defense"), REST], ctxOf(0, 1 + w * 7));
      expect(r.notes.some((n) => n.code === "burnedOut")).toBe(false);
      p = r.player;
    }
    expect(p.burnout?.warned).toBe(false);
  });

  it("closeWeek is deterministic", () => {
    const p = fresh(SEED, { energy: 5, burnout: { warned: true, outWeeks: 0 } });
    const c = { seasonIndex: 0, day: 8, careerSeed: SEED };
    expect(closeWeek(p, c)).toEqual(closeWeek(p, c));
  });
});

describe("Pro week: confidence", () => {
  it("is the mean of recent ratings around 6, ±2, over the last five", () => {
    expect(confidenceOf([])).toBe(0);
    expect(confidenceOf([6, 6])).toBe(0);
    expect(confidenceOf([9, 9])).toBe(2);
    expect(confidenceOf([1, 2])).toBe(-2);
    let p = fresh();
    for (const r of [3, 3, 3, 3, 3, 8, 8, 8, 8, 8]) p = withRating(p, r);
    expect(p.recentRatings).toEqual([8, 8, 8, 8, 8]);
    expect(p.confidence).toBe(2);
  });

  it("good form helps the ranked game; bad form hurts it", () => {
    const p = fresh();
    expect(winChance({ ...p, confidence: 2 })).toBeGreaterThan(winChance({ ...p, confidence: 0 }));
    expect(winChance({ ...p, confidence: -2 })).toBeLessThan(winChance({ ...p, confidence: 0 }));
    expect(winChance({ ...p, energy: 0 })).toBeLessThan(winChance({ ...p, energy: 100 }));
  });
});

describe("Pro week: the coach's plan and the preview", () => {
  it("rests before a LAN, rests when tired, trains the weak spot otherwise", () => {
    const p = fresh();
    const open = coachPlanFor(p, { ...ctxOf(), hasTeam: true });
    expect(open.filter((a) => a.kind === "rest")).toHaveLength(0);
    expect(open[1].kind).toBe("scrim");
    const lan = coachPlanFor(p, { ...ctxOf(), hasTeam: true, nextEventIsLan: true, daysToNextEvent: 5 });
    expect(lan[2].kind).toBe("rest");
    expect(coachPlanFor({ ...p, energy: 20 }, ctxOf())[0].kind).toBe("rest");
    expect(coachPlanFor({ ...p, burnout: { warned: true, outWeeks: 1 } }, ctxOf()).every((a) => a.kind === "rest")).toBe(true);
    const solo = coachPlanFor(p, ctxOf());
    expect(solo[1].kind).toBe("ranked");
  });

  it("the preview matches what a deterministic week does to energy and attributes", () => {
    const p = fresh();
    const plan: ProWeekPlan = [TRAIN("defense"), CONTENT, REST];
    const prev = previewWeek(p, plan, ctxOf());
    const real = applyWeekPlan(p, plan, ctxOf());
    expect(prev.energyEnd).toBe(real.energyTrace[3]);
    expect(prev.blocks[0].gains.defense).toBeCloseTo(real.player.attrs.defense - p.attrs.defense, 2);
    expect(prev.blocks[1].money).toBeGreaterThan(0);
    expect(previewWeek({ ...p, energy: 70 }, [TRAIN(), TRAIN(), TRAIN()], ctxOf()).warns).toBe(true);
  });

  it("repeat last week reuses the plan; applyWeekPlan remembers it", () => {
    const plan: ProWeekPlan = [TRAIN("defense"), REST, RANKED];
    const r = applyWeekPlan(fresh(), plan, ctxOf());
    expect(r.player.lastPlan).toEqual(plan);
  });

  it("applyWeekPlan is deterministic", () => {
    const plan: ProWeekPlan = [RANKED, TRAIN(), RANKED];
    expect(applyWeekPlan(fresh(), plan, ctxOf())).toEqual(applyWeekPlan(fresh(), plan, ctxOf()));
  });
});

describe("Pro ranked", () => {
  it("uses the Draft's rank ids and names, bronze to supersonic legend", () => {
    const ids = RANKS.map((r) => r.id as string);
    for (const t of CAREER_PRO_RANKED.tiers) expect(ids).toContain(t.id);
    expect(rankOf(0).id).toBe("bronze");
    expect(rankOf(1000)).toMatchObject({ id: "silver", label: "Silver", division: 2 });
    expect(rankOf(2400).id).toBe("grand-champion");
    expect(rankOf(99999)).toMatchObject({ id: "supersonic-legend", division: 0 });
    // Monotone: a higher MMR is never a lower rank.
    let last = -1;
    for (let m = 0; m <= 3200; m += 25) {
      const r = rankOf(m);
      expect(r.index).toBeGreaterThanOrEqual(last);
      last = r.index;
    }
  });

  it("the skill table is monotone and a fresh Pro starts around Silver", () => {
    let prev = -1;
    for (let o = 30; o <= 99; o++) {
      const m = skillMmrFor(o);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(rankOf(CAREER_PRO.startMmr).id).toBe("silver");
  });

  it("a session moves the MMR by at most games × step, logs itself, spends energy and is deterministic", () => {
    const p = fresh();
    const c = { seasonIndex: 0, day: 3, careerSeed: SEED };
    const r = playRankedSession(p, c);
    expect(Math.abs(r.mmrDelta)).toBeLessThanOrEqual(CAREER_PRO_RANKED.gamesPerSession * CAREER_PRO_RANKED.step);
    expect(r.player.mmr).toBe(p.mmr + r.mmrDelta);
    expect(r.player.rankedLog).toHaveLength(1);
    expect(r.player.energy).toBe(p.energy - CAREER_PRO_WEEK.cost.ranked);
    expect(playRankedSession(p, c)).toEqual(r);
    // Consecutive sessions draw different games.
    const r2 = playRankedSession(r.player, c);
    expect(r2.player.rankedSessions).toBe(2);
  });

  it("the expected change tracks the real mean", () => {
    const p = fresh(SEED, { mmr: 1000 });
    let total = 0;
    const N = 400;
    for (let s = 0; s < N; s++) total += playRankedSession(p, { seasonIndex: 0, day: s, careerSeed: 99 }).mmrDelta;
    expect(total / N).toBeCloseTo(expectedSessionDelta(p), -1);
  });

  it("the log keeps the last logCap sessions", () => {
    let p = fresh();
    for (let i = 0; i < 20; i++) p = playRankedSession({ ...p, energy: 100 }, { seasonIndex: 0, day: i, careerSeed: SEED }).player;
    expect(p.rankedLog).toHaveLength(CAREER_PRO_RANKED.logCap);
  });

  it("Grand Champion opens the cups", () => {
    expect(cupsUnlocked({ mmr: 2349 })).toBe(false);
    expect(cupsUnlocked({ mmr: 2350 })).toBe(true);
    expect(cupsUnlocked({ mmr: 3000 })).toBe(true);
  });
});

describe("Pro: from creation to Grand Champion (calibration)", () => {
  const GC = (p: ProPlayer) => cupsUnlocked(p);
  const MAX = 400;

  /** The weeks to Grand Champion for a policy, over a handful of seeds. */
  function weeksToGc(policy: Parameters<typeof play>[1], seeds: number[]): number[] {
    return seeds.map((s) => play(fresh(s), policy, MAX, GC, s).weeks);
  }
  const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  it("a sensibly played Pro (the coach's plan: train, ranked, train, rest when tired) reaches Grand Champion in 45-85 weeks (median ~65: two seasons, age 15)", () => {
    const weeks = weeksToGc(sensible, SEEDS);
    console.log("weeks to GC, sensible:", weeks.join(","), "median", median(weeks));
    expect(median(weeks)).toBeGreaterThanOrEqual(45);
    expect(median(weeks)).toBeLessThanOrEqual(85);
    expect(Math.max(...weeks)).toBeLessThan(MAX);
  });

  it("a careless Pro (content and ranked, no training, no rest) gets there much later or never", () => {
    const sens = median(weeksToGc(sensible, SEEDS));
    const weeks = weeksToGc(careless, SEEDS);
    console.log("weeks to GC, careless:", weeks.join(","));
    expect(median(weeks)).toBeGreaterThanOrEqual(sens * 2);
  });

  it("is deterministic end to end", () => {
    expect(play(fresh(5), sensible, 30, undefined, 5).player).toEqual(play(fresh(5), sensible, 30, undefined, 5).player);
  });

  it("the overall at Grand Champion is that of a Pro who has trained, and age moves with the weeks", () => {
    const r = play(fresh(11), sensible, MAX, GC, 11);
    expect(proOverall(r.player.attrs)).toBeGreaterThan(55);
    expect(proAgeOf(r.player, Math.floor(r.weeks / WEEKS_PER_SEASON))).toBeLessThanOrEqual(17);
  });
});

describe("Pro: match XP", () => {
  const base = { rating: 6, opponentStrength: 75, tier: "regional", seasonIndex: 0, day: 5 };

  it("pays more at a Major or the Worlds, for a high rating and for a stronger opponent", () => {
    const p = fresh(SEED, { attrs: { offense: 70, defense: 70, mechanics: 70, consistency: 70, experience: 70, clutch: 70 } });
    const total = (inp: Partial<typeof base>) => {
      const r = applyMatchXp(p, { ...base, ...inp });
      return proOverall(r.player.attrs) - proOverall(p.attrs);
    };
    expect(total({ tier: "worlds" })).toBeGreaterThan(total({ tier: "major" }));
    expect(total({ tier: "major" })).toBeGreaterThan(total({ tier: "regional" }));
    expect(total({ tier: "regional" })).toBeGreaterThan(total({ tier: "t3" }));
    expect(total({ rating: 9 })).toBeGreaterThan(total({ rating: 4 }));
    expect(total({ opponentStrength: 90 })).toBeGreaterThan(total({ opponentStrength: 60 }));
  });

  it("is explained in the log, records the rating and moves confidence", () => {
    const p = fresh();
    const r = applyMatchXp(p, { ...base, rating: 9 });
    expect(r.growth.length).toBeGreaterThan(0);
    expect(r.growth.every((g) => g.source === "match" && g.delta > 0)).toBe(true);
    expect(r.player.recentRatings).toEqual([9]);
    expect(r.player.confidence).toBeGreaterThan(0);
    expect(applyMatchXp(p, base)).toEqual(applyMatchXp(p, base));
  });

  it("never passes the ceiling and never takes a point away", () => {
    const top = fresh(SEED, { attrs: { offense: 99, defense: 99, mechanics: 99, consistency: 99, experience: 99, clutch: 99 } });
    const r = applyMatchXp(top, { ...base, tier: "worlds", rating: 10, opponentStrength: 99 });
    expect(r.player.attrs).toEqual(top.attrs);
    const low = applyMatchXp(fresh(), { ...base, rating: 0, opponentStrength: 40, tier: "t3" });
    for (const g of low.growth) expect(g.delta).toBeGreaterThan(0);
  });
});

describe("Pro: a slice-1 save loads and plays", () => {
  it("a player with none of the slice-2 fields plays a week", () => {
    const old = createProSave(INPUT, 9, "test").player;
    for (const k of ["lastPlan", "rankedLog", "rankedSessions", "recentRatings", "burnout", "mechanicsBlocks", "chemistry"] as const) {
      expect(old[k]).toBeUndefined();
    }
    const r = applyWeekPlan(old, [TRAIN(), RANKED, REST], ctxOf());
    expect(r.player.attrs.mechanics).toBeGreaterThan(old.attrs.mechanics);
    expect(r.player.rankedLog).toHaveLength(1);
  });
});

describe("Pro: a week on a save", () => {
  it("logs the growth, refreshes the world's snapshot and moves the clock by a week, rolling into the next season", async () => {
    const { playProWeek, nextWeekClock } = await import("./weekFlow");
    const { playerViewById } = await import("../development");
    const { PRO_SELF_ID } = await import("./world");
    const save = createProSave(INPUT, 12, "test");
    const played = playProWeek(save, [TRAIN("defense"), RANKED, REST]);
    expect(played.save.clock).toEqual({ seasonIndex: 0, day: 8 });
    expect(played.save.growthLog.length).toBeGreaterThan(0);
    expect(played.save.growthLog.every((g) => g.delta > 0)).toBe(true);
    expect(played.save.world.proSelf?.overall).toBeCloseTo(proOverall(played.save.player.attrs), 1);
    expect(playerViewById(PRO_SELF_ID, { careerSeed: 12, seasonIndex: 0, world: played.save.world })).toBeTruthy();
    expect(save.growthLog).toHaveLength(0);
    const last = 32 * 7;
    expect(nextWeekClock({ seasonIndex: 2, day: last - 6 })).toEqual({ clock: { seasonIndex: 3, day: 1 }, rolledOver: true });
    expect(nextWeekClock({ seasonIndex: 2, day: last - 13 }).rolledOver).toBe(false);
  });
});
