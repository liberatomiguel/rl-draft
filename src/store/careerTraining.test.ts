/**
 * rc.34 — DEV-03 training packages (TRAINING-CONTRACT.md §3, the flow tests
 * f1–f8) plus the rules they rest on: the peak is DEV-01's whatever the
 * package (decision 2-A), the ex-pro coach's quality (5-A), no coach = the
 * base (7-A), the load repair for an rc.33 save (T8) and the "approve" hold.
 * Deterministic: one seed per case, the real flow functions.
 */

import { describe, expect, it } from "vitest";
import { CAREER_COACH_MARKET, CAREER_PLAN, CAREER_SCRIM, CAREER_TRAINING } from "@/config/balance";
import { dayOfWeekOf, weekAt, weekOfDay } from "@/engine/career/calendar";
import {
  ageOf,
  developmentProfileOf,
  peakTargetOf,
  seasonYear,
  trainDay,
} from "@/engine/career/development";
import { coachWageFor } from "@/engine/career/economy";
import { coachCandidatesFor as marketCoaches, exProCoachQuality } from "@/engine/career/market";
import {
  BASE_EFFECT,
  coachAfterSeason,
  coachProfileOf,
  packageEffectFor,
  periodOfDay,
  periodsOfSeason,
  simplePackageOf,
} from "@/engine/career/training";
import type { CareerEventDef, CareerSave, CoachState, SquadPlayer, TrainingPackage } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation, orgTeamFor } from "@/engine/career/worldSim";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  coachCandidatesFor,
  createCareerSave,
  declineUnofficial,
  finishEvent,
  fireCoachFlow,
  hireCoachFlow,
  isEventPaused,
  migrateSaveToV5,
  resolveInsertFlow,
  rolloverToNextSeason,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  userSeedRatingFor,
  type CreateCareerInput,
} from "./careerFlow";
import {
  acknowledgeTrainingReportFlow,
  approveTrainingProposalFlow,
  coachImpactFor,
  coachPlansOf,
  coachProposalOf,
  cycleEndedTodayOf,
  recommendedPackageOf,
  recommendedPlanOf,
  setCoachPlansFlow,
  trainingBlockOf,
  trainingControllerOf,
  trainingReportOf,
  projectTrainingPackage,
  runPackageScrims,
  runTrainingSession,
  setTrainingModeFlow,
  setTrainingPackageFlow,
  trainingDayStart,
  trainingDecisionOf,
  trainingOf,
  trainingSeasonEnd,
} from "./careerTraining";
import { clockHoldOf } from "./careerDecisions";
import { walkPastForTests } from "./careerClockForTests";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Plan Org",
    abbrev: "PLN",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  // No auto-entered Community Cups: the calendar of a period is known (f1's projection).
  prefs: { autoEnterUnofficials: false },
  rosterKey: "balanced",
  trainingMode: "manual",
};

const DEV: TrainingPackage = { objective: "development", focus: "balanced", workload: "normal", scrimsPerWeek: 0, scrimLevel: "auto" };

function coach(id: string, quality: number, experience: number, specialty: CoachState["specialty"], source: CoachState["source"] = "generated"): CoachState {
  return { id, name: id, overall: quality, bonusType: "mechanics", bonusLevel: "+", salaryPerSplit: 500, source, experience, specialty };
}

/**
 * Today's decisions as the arc bot takes them (the weekly insert: "b"; the
 * user's event: instant sim, a two-day event pauses on Saturday), then one
 * day forward. A training proposal is answered only when `approve` is set.
 */
function step(input: CareerSave, approve = true): CareerSave {
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
  if (approve && trainingDecisionOf(save)) save = approveTrainingProposalFlow(save).save;
  // rc.34 (front G): bids, offers and invites hold the clock now — answer them as rc.33 walked past.
  return advanceDayFlow(walkPastForTests(save));
}

/** rc.36: today's decisions and events as `step` takes them, without moving the clock. */
function settle(input: CareerSave): CareerSave {
  let save = input;
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  } else if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  }
  return save.phase === "running" ? walkPastForTests(save) : save;
}

/** Advance (playing every event, answering every insert) until the clock reaches `day` (or the season stops). */
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

const sessionsOf = (s: CareerSave) => Object.fromEntries(Object.entries(trainingOf(s).plan!.players).map(([id, e]) => [id, e.sessions]));

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

describe("DEV-03 rules (engine)", () => {
  it("T1 (rc.36, Miguel: back to 28 days): a 28-day grid, 8 a season, never crossing one; the split mode is 3 periods", () => {
    const grid = periodsOfSeason("grid");
    expect(CAREER_PLAN.periodDays).toBe(28);
    expect(grid).toHaveLength(8);
    expect(grid[0]).toMatchObject({ startDay: 1, endDay: 28 });
    expect(grid[7]).toMatchObject({ startDay: 197, endDay: 224 });
    for (const p of grid) expect(dayOfWeekOf(p.startDay)).toBe(1); // every period starts on a Monday
    const split = periodsOfSeason("split");
    expect(split.map((p) => [p.startDay, p.endDay])).toEqual([[1, 84], [85, 154], [155, 224]]);
    expect(periodOfDay(15).index).toBe(0);
    expect(periodOfDay(29).index).toBe(1);
  });

  it("decision 7-A: no package = the base, whoever coaches; a coachless package runs at 0.5", () => {
    for (const c of [null, coach("a", 60, 0, "development"), coach("b", 94, 10, "development")]) {
      expect(packageEffectFor(null, coachProfileOf(c), "p")).toBe(BASE_EFFECT);
    }
    const none = packageEffectFor(DEV, null, "p");
    expect(none.sessionMult).toBeCloseTo(1 + CAREER_PLAN.objectives.development.boost * CAREER_PLAN.coach.coachless, 6);
    // A package is never below the base (tweaks, rest).
    const rest = packageEffectFor({ ...DEV, tweaks: { p: { rest: true } } }, null, "p");
    expect(rest.sessionMult).toBe(1);
    expect(rest.wearMult).toBe(0);
    const focus = packageEffectFor({ ...DEV, objective: "recovery", tweaks: { p: { focus: "clutch" } } }, null, "p");
    expect(focus.sessionMult).toBeGreaterThanOrEqual(1);
    expect(focus.offsets.clutch).toBe(CAREER_PLAN.tweakFocus.offsetPerWeek);
  });

  it("decision 2-A: a package speeds the road but never moves the peak", () => {
    const base: SquadPlayer = {
      id: "rook:1:SAM:0", kind: "fictional", name: "Kid", region: "SAM", birthYear: seasonYear(1) - 17, archetype: "allround",
      overall: 76, attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
      potential: 86, peakAge: 20, declineRate: "normal", role: "starter", salaryPerSplit: 1000, contractEndSeason: 9,
      trainingFocus: "auto", trainingIntensity: "normal", scoutLevel: 0, splitsTogether: 0, joinedSeason: 1,
      gainedThisSplit: 0, gainedThisSeason: 0,
    };
    const target = peakTargetOf(base.potential, developmentProfileOf(base.id, 7));
    const run = (mult: number) => {
      let p = { ...base };
      let max = p.overall;
      for (let s = 1; s <= 4; s++) {
        p = { ...p, gainedThisSeason: 0 };
        for (let d = 1; d <= 160; d++) {
          p = trainDay(p, { seasonIndex: s, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, splitGained: 0, seasonGained: p.gainedThisSeason, model: 2, day: d, careerSeed: 7, aging: true, packageMult: mult }).player;
          max = Math.max(max, p.overall);
        }
      }
      return max;
    };
    const plain = run(1);
    const boosted = run(1.5);
    expect(boosted).toBeLessThanOrEqual(target + 1e-9);
    expect(plain).toBeLessThanOrEqual(target + 1e-9);
    // Both reach the same real peak; the package only gets there sooner. rc.36 (POL-04): the
    // slower base (paceCurvature 1.5) closes the last points inside his plateau — within a tenth.
    expect(Math.abs(boosted - plain)).toBeLessThan(0.1);
  });

  it("decision 5-A: an ex-pro coaches from his career-best card at slope 0.8, ±4, inside 64–94", () => {
    expect(exProCoachQuality(75, 0.5)).toBe(66);
    expect(exProCoachQuality(90, 0.5)).toBe(78);
    expect(exProCoachQuality(99, 0.5)).toBe(85);
    expect(exProCoachQuality(99, 1)).toBe(89);
    expect(exProCoachQuality(60, 0)).toBe(CAREER_COACH_MARKET.exPro.range[0]);
    // The market's real coaches: experience 3, an archetype's specialty, the best card, ×1.15 the generic wage.
    const seed = 4_321;
    let world = buildWorldAtCreation(seed);
    for (let s = 1; s <= 4; s++) world = agePassAndIntake(world, s, seed, [], false).world;
    const real = [0, 1, 2, 3]
      .flatMap((w) => marketCoaches({ world, region: "SAM", seasonIndex: 4, windowIdx: w, careerSeed: seed, difficulty: "normal", nameBank: ["A"] }))
      .filter((c) => c.source === "real");
    expect(real.length).toBeGreaterThan(0);
    for (const c of real) {
      expect(c.experience).toBe(CAREER_COACH_MARKET.exPro.experience);
      expect(c.bestCard).toBeGreaterThan(0);
      expect(c.overall).toBeGreaterThanOrEqual(CAREER_COACH_MARKET.exPro.range[0]);
      expect(c.overall).toBeLessThanOrEqual(CAREER_COACH_MARKET.exPro.range[1]);
      expect(Math.abs(c.overall - (66 + 0.8 * (c.bestCard! - 75)))).toBeLessThanOrEqual(CAREER_COACH_MARKET.exPro.jitter + 0.5);
      expect(c.salaryPerSplit).toBe(coachWageFor({ quality: c.overall, experience: 3, exPro: true }, 4, "normal"));
      expect(c.salaryPerSplit).toBeGreaterThanOrEqual(coachWageFor({ quality: c.overall, experience: 3, exPro: false }, 4, "normal"));
    }
  });

  it("T4: coaches grow with a season coached — +experience, quality up to the ceiling, more when the specialty ran", () => {
    const c = coach("g", 80, 2, "development");
    const plain = coachAfterSeason(c, false);
    const matched = coachAfterSeason(c, true);
    expect(plain.experience).toBe(3);
    expect(plain.overall).toBeCloseTo(80 + CAREER_COACH_MARKET.growth.qualityPerSeason, 6);
    expect(matched.overall).toBeCloseTo(80 + CAREER_COACH_MARKET.growth.qualityPerSeasonMatched, 6);
    let capped: CoachState = { ...c, ceiling: 81 };
    for (let i = 0; i < 5; i++) capped = coachAfterSeason(capped, true);
    expect(capped.overall).toBe(81);
  });
});

// ---------------------------------------------------------------------------
// The flow (TRAINING-CONTRACT §3)
// ---------------------------------------------------------------------------

describe("DEV-03 flow (TRAINING-CONTRACT §3)", { timeout: 120_000 }, () => {
  it("f1: a period without a package is DEV-01's base, coach or not; with one the gain is higher and equals the card's projection", () => {
    const start = createCareerSave(INPUT, 61_001);
    expect(trainingOf(start).plan).toMatchObject({ periodIndex: 0, package: null, author: "base" });
    // No package: a coach changes nothing (decision 7-A) — the preseason weeks have no event.
    const coached = { ...structuredClone(start), coach: coach("c", 88, 6, "development") };
    const a = playTo(start, 14);
    const b = playTo(coached, 14);
    expect(b.squad.map((p) => p.overall)).toEqual(a.squad.map((p) => p.overall));
    expect(sessionsOf(b)).toEqual(sessionsOf(a));
    // With a package (from day 2 — day 1's session ran): the card's projection is what runs.
    const withPkg = setTrainingPackageFlow(start, DEV).save;
    const card = projectTrainingPackage(withPkg, DEV, { unsupervised: false });
    expect(card.fromDay).toBe(2);
    expect(card.endDay).toBe(28);
    const s1 = sessionsOf(withPkg);
    const end = playTo(withPkg, 27); // rc.36: the 28-day cycle's last weekday session ran on Friday 26
    const ran = sessionsOf(end);
    for (const p of card.players) {
      expect(Math.abs(ran[p.id] - s1[p.id] - p.sessions), p.name).toBeLessThanOrEqual(0.011);
    }
    const base = playTo(start, 27);
    for (const p of end.squad) {
      expect(trainingOf(end).plan!.players[p.id].sessions).toBeGreaterThan(trainingOf(base).plan!.players[p.id].sessions);
    }
  });

  it("f2: three coach profiles — none < a good generic < an ex-pro, as the hire card claims, in the projection and the summary", () => {
    const start = createCareerSave(INPUT, 61_002);
    const profiles: (CoachState | null)[] = [null, coach("gen", 76, 2, "preparation"), coach("expro", 85, 3, "development", "real")];
    const claims = profiles.map((c) => (c ? coachImpactFor(start, c).perStarter : coachImpactFor(start, coach("x", 60, 0, "recovery")).perStarter));
    const runs = profiles.map((c) => {
      const s = setTrainingPackageFlow({ ...structuredClone(start), coach: c }, DEV).save;
      const proj = projectTrainingPackage(s, DEV, { unsupervised: false });
      const end = playTo(s, 29); // period 2's first day: period 1's summary is filed
      return { proj, summary: trainingOf(end).history[0] };
    });
    // The hire card's ordering (a 60-quality stand-in for "none" — the card always compares two coaches).
    expect(claims[1]).toBeLessThan(claims[2]);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].proj.startersAvg).toBeGreaterThan(runs[i - 1].proj.startersAvg);
      const shareA = runs[i - 1].summary.players.reduce((n, p) => n + p.coachShare, 0);
      const shareB = runs[i].summary.players.reduce((n, p) => n + p.coachShare, 0);
      expect(shareB).toBeGreaterThan(shareA);
    }
    expect(runs[0].summary.players.every((p) => p.coachShare === 0)).toBe(true);
  });

  it("f3: three scrim levels — XP easy < even < hard, wear easy < even < hard, chemistry highest on even; practice only, inside the cap", () => {
    const start = createCareerSave(INPUT, 61_003);
    const out = (["easy", "even", "hard"] as const).map((level) => {
      const s0 = setTrainingPackageFlow(start, { ...DEV, scrimsPerWeek: 1, scrimLevel: level }).save;
      const chem0 = s0.squad.map((p) => p.splitsTogether);
      const s = playTo(s0, 14); // the preseason: no event, two Tuesday scrims
      const plan = trainingOf(s).plan!;
      const starters = s.squad.filter((p) => s.starterIds.includes(p.id));
      return {
        s,
        s0,
        xp: starters.reduce((n, p) => n + plan.players[p.id].scrims, 0),
        wear: starters.reduce((n, p) => n + plan.players[p.id].wear, 0),
        chem: starters.reduce((n, p) => n + p.splitsTogether - chem0[s.squad.indexOf(p)], 0),
        capOk: starters.every((p) => plan.players[p.id].scrims <= (plan.scrimCap[p.id] ?? 0) + 1e-6),
        scrims: s.scrimLog.filter((e) => e.level === level).length,
      };
    });
    const [easy, even, hard] = out;
    expect(easy.scrims).toBe(2);
    expect(easy.xp).toBeLessThan(even.xp);
    expect(even.xp).toBeLessThan(hard.xp);
    expect(easy.wear).toBeLessThan(even.wear);
    expect(even.wear).toBeLessThan(hard.wear);
    expect(even.chem).toBeGreaterThan(easy.chem);
    expect(even.chem).toBeGreaterThan(hard.chem);
    for (const o of out) {
      expect(o.capOk).toBe(true);
      // Practice only: no points, prize, reputation, series or achievement flags from scrims.
      expect(o.s.reputation).toBe(o.s0.reputation);
      expect(o.s.competition.seasonPoints).toEqual(o.s0.competition.seasonPoints);
      expect(o.s.stats).toEqual(o.s0.stats);
      expect(o.s.finances.ledger.some((l) => l.kind === "prize")).toBe(false);
      // (the weekly insert rolls its own bookkeeping flags; nothing else is set by a scrim)
      const noInserts = (f: Record<string, boolean>) => Object.keys(f).filter((k) => !k.startsWith("insertRolled:"));
      expect(noInserts(o.s.flags)).toEqual(noInserts(o.s0.flags));
    }
  });

  it("T3: a level always means its gap — an org inside the band, else a local side built at the band's centre", () => {
    for (const region of ["EU", "SAM"] as const) {
      for (const level of ["easy", "even", "hard"] as const) {
        const start = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region } }, 61_020);
        const s = playTo(setTrainingPackageFlow(start, { ...DEV, scrimsPerWeek: 1, scrimLevel: level }).save, 3);
        const entry = s.scrimLog.find((e) => e.level === level && e.day === 2)!;
        expect(entry, `${region} ${level}`).toBeDefined();
        const userRating = userSeedRatingFor({ ...s, finances: { ...s.finances, bootcampSharp: 0 } });
        const [lo, hi] = CAREER_SCRIM.levels[level].gap;
        // Each org read live (its roster today, the AI shift out), as the pick reads it.
        const live = (ref: string) => {
          const team = orgTeamFor(ref, { world: s.world, seasonIndex: 0, careerSeed: s.careerSeed, difficulty: s.difficulty });
          return team.rating.total - team.rating.difficultyShift;
        };
        const inBand = Object.values(s.world.orgs).some((o) => o.region === region && live(o.ref) - userRating >= lo && live(o.ref) - userRating <= hi);
        if (!inBand) expect(entry.oppRef.startsWith("local:"), `${region} ${level}`).toBe(true);
        else expect(s.world.orgs[entry.oppRef], `${region} ${level}`).toBeDefined();
      }
    }
  });

  it("f4: a coach runs several cycles — no prompt, one summary per cycle, preparation for the Major's cycle, a signing joins with a line", () => {
    let save = createCareerSave({ ...INPUT, trainingMode: "auto" }, 61_004);
    save = { ...save, coach: coach("del", 82, 4, "development"), reputation: 40 };
    save.finances = { ...save.finances, balance: 2_000_000 };
    let prompts = 0;
    let signed = false;
    save = playTo(save, 141, (s) => {
      if (trainingDecisionOf(s)) prompts += 1;
      // A window signing mid-period (W11, period 3): a free agent into the squad.
      if (!signed && weekOfDay(s.clock.day) === 11 && dayOfWeekOf(s.clock.day) === 2) {
        const fa = s.world.freeAgentIds.find((id) => id.startsWith("fic:"));
        if (fa) {
          const res = signPlayerFlow(s, fa, { lengthSeasons: 1, releaseId: s.squad.length >= 4 ? s.squad.find((p) => !s.starterIds.includes(p.id))?.id : undefined });
          if (!res.error) {
            signed = true;
            return res.save;
          }
        }
      }
      return s;
    });
    const t = trainingOf(save);
    expect(prompts).toBe(0);
    expect(t.history.length).toBe(5); // rc.36: 28-day cycles 1–5 filed by day 141 (cycle 6 runs)
    expect(new Set(t.history.map((h) => `${h.seasonIndex}:${h.periodIndex}`)).size).toBe(t.history.length);
    const byPeriod = new Map(t.history.map((h) => [h.periodIndex, h]));
    // Cycle 1 opened before he arrived — rc.36: nothing runs until a plan is
    // picked (Easy no longer applies one); from cycle 2 he plans and starts it.
    expect(byPeriod.get(0)).toMatchObject({ author: "base", package: null });
    expect(byPeriod.get(1)).toMatchObject({ author: "coach" });
    expect(byPeriod.get(1)?.package?.objective).toBe("development");
    // The Majors' cycles (W9–12, W17–20) are preparation, run by him.
    const prep = t.history.filter((h) => h.package?.objective === "preparation");
    expect(prep.length).toBeGreaterThan(0);
    const bigWeek = (h: { startDay: number; endDay: number }) =>
      [0, 7, 14, 21].map((o) => h.startDay + o).some((d) => d <= h.endDay && ["major", "worlds"].includes(weekAt(weekOfDay(d)).kind));
    for (const h of prep) expect(h.author === "coach" && bigWeek(h), `cycle ${h.periodIndex + 1}`).toBe(true);
    expect(signed).toBe(true);
    expect(t.history.some((h) => h.notes.some((n) => n.key === "joined"))).toBe(true);
  });

  it("f5: a coach change mid-period — the period runs on, each day uses the coach present, the summary splits by days; fired = the coachless rate", () => {
    let save = setTrainingPackageFlow({ ...createCareerSave(INPUT, 61_005), coach: coach("first", 80, 3, "development"), reputation: 50 }, DEV).save;
    save = playTo(save, 9);
    const hire = coachCandidatesFor(save).find((c) => c.id !== save.coach?.id)!;
    save = hireCoachFlow(save, hire).save;
    expect(save.coach?.id).toBe(hire.id);
    save = playTo(save, 11);
    save = fireCoachFlow(save).save;
    const fx = packageEffectFor(DEV, null, save.squad[0].id);
    expect(trainingOf(save).plan!.package).toEqual(DEV); // the package runs on
    expect(fx.sessionMult).toBeCloseTo(1 + CAREER_PLAN.objectives.development.boost * CAREER_PLAN.coach.coachless, 6);
    save = playTo(save, 29); // rc.36: the 28-day cycle is filed on day 29
    const summary = trainingOf(save).history[0];
    expect(summary.coaches.map((c) => c.name)).toEqual(["first", hire.name]);
    const [first, second] = summary.coaches;
    // Each session day counts for the coach present: the first runs days 2–5, 8 and 9
    // (hired away after Tuesday 9's session), the second 10 and 11 (fired after its session).
    expect(first.days).toBe(6);
    expect(second.days).toBe(2);
    expect(summary.coaches.reduce((n, c) => n + c.days, 0)).toBe(8);
    expect(first.share).toBeGreaterThan(0);
    expect(second.share).toBeGreaterThan(0);
    expect(summary.notes.map((n) => n.key)).toEqual(expect.arrayContaining(["coachHired", "coachFired"]));
  });

  it("f6: refresh and fast advance — Skip, +1 day and a reload reach the same save; no session, scrim or summary twice", () => {
    const start = setTrainingPackageFlow(createCareerSave(INPUT, 61_006), { ...DEV, scrimsPerWeek: 3, scrimLevel: "even" }).save;
    const skipped = advanceToNextStopFlow(start);
    let stepped = start;
    for (let g = 0; g < 60 && stepped.clock.day < skipped.clock.day; g++) stepped = advanceDayFlow(stepped);
    expect(stepped).toEqual(skipped);
    // A reload mid-period (the persisted JSON through the load chain) changes nothing.
    const reloaded = migrateSaveToV5(JSON.parse(JSON.stringify(stepped)))!;
    expect(reloaded.training).toEqual(stepped.training);
    expect(playTo(reloaded, 40)).toEqual(playTo(stepped, 40));
    // The same day twice: nothing runs again.
    const day = playTo(start, 9); // a Tuesday: a session and a scrim ran
    const again = structuredClone(day);
    trainingDayStart(again);
    runTrainingSession(again);
    runPackageScrims(again);
    expect(again).toEqual(day);
    // A summary is filed once (the rollover's filing twice).
    const filed = structuredClone(playTo(start, 40));
    trainingSeasonEnd(filed);
    const n = trainingOf(filed).history.length;
    trainingSeasonEnd(filed);
    expect(trainingOf(filed).history.length).toBe(n);
  });

  it("f7: events in the period — sessions Mon–Fri only, half load on an event week, no scrim on a matchday", () => {
    const start = setTrainingPackageFlow(createCareerSave(INPUT, 61_007), { ...DEV, scrimsPerWeek: 3, scrimLevel: "even" }).save;
    const days: { day: number; gain: number; prep: boolean }[] = [];
    let prev = start;
    const end = playTo(start, 56, (s) => {
      const plan = trainingOf(s).plan;
      const before = trainingOf(prev).plan;
      if (plan && before && plan.periodIndex === before.periodIndex && plan.lastSessionDay === s.clock.day) {
        const id = s.starterIds[0];
        days.push({ day: s.clock.day, gain: plan.players[id].sessions - before.players[id].sessions, prep: s.pendingEventDef !== null });
      }
      prev = s;
      return s;
    });
    for (const d of days) expect(dayOfWeekOf(d.day)).toBeLessThanOrEqual(CAREER_TRAINING.trainingDaysPerWeek);
    // An event week trains at matchPrepShare of an open training week (×1.25): ≈ 0.5 / 1.25.
    const prep = days.filter((d) => d.prep && d.gain > 0).map((d) => d.gain);
    const open = days.filter((d) => !d.prep && weekOfDay(d.day) % 2 === 1 && d.gain > 0).map((d) => d.gain);
    const ratio = prep.reduce((a, b) => a + b, 0) / prep.length / (open.reduce((a, b) => a + b, 0) / open.length);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.5);
    // Package scrims: Tue / Wed / Thu only (the matchdays are the weekend)…
    const pkg = end.scrimLog.filter((e) => e.level);
    expect(pkg.length).toBeGreaterThan(0);
    for (const e of pkg) expect(CAREER_SCRIM.package.days[3]).toContain(dayOfWeekOf(e.day));
    // …and never on a day the user plays: a Tuesday that is his matchday runs no scrim.
    const tuesday = playTo(start, 9);
    const matchday = structuredClone(tuesday);
    trainingOf(matchday).plan!.lastScrimDay = 8;
    matchday.pendingEventDef = { ...(tuesday.pendingEventDef ?? { id: "x", seasonIndex: 0, week: 2, tier: "t3", name: "Cup", format: "single" as const }), day: 9 } as typeof matchday.pendingEventDef;
    const logBefore = matchday.scrimLog.length;
    runPackageScrims(matchday);
    expect(matchday.scrimLog.length).toBe(logBefore);
  });

  it("f8: a young reserve keeps base + package growth without series XP; a starter earns series XP", () => {
    let start = createCareerSave(INPUT, 61_008);
    if (start.squad.length < 4) {
      // A young free agent joins as the reserve (the starting three are full).
      start = { ...start, finances: { ...start.finances, balance: 2_000_000 }, reputation: 60 };
      const kid = start.world.freeAgentIds.find((id) => id.startsWith("fic:"))!;
      const res = signPlayerFlow(start, kid, { lengthSeasons: 1 });
      expect(res.error).toBeUndefined();
      start = res.save;
    }
    start = setTrainingPackageFlow(start, DEV).save;
    const reserve = start.squad.find((p) => !start.starterIds.includes(p.id));
    expect(reserve).toBeDefined();
    const end = playTo(start, 29);
    const summary = trainingOf(end).history[0];
    const r = summary.players.find((p) => p.id === reserve!.id)!;
    const starter = summary.players.find((p) => end.starterIds.includes(p.id) && p.series > 0)!;
    expect(r.series).toBe(0);
    expect(r.seriesGain).toBe(0);
    expect(r.sessions).toBeGreaterThan(0);
    expect(packageEffectFor(DEV, null, reserve!.id).sessionMult).toBeGreaterThan(1);
    expect(starter.seriesGain).toBeGreaterThan(0);
    expect(ageOf(reserve!.birthYear, 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Delegation by preset, the hold, the repair
// ---------------------------------------------------------------------------

describe("DEV-03 delegation, the hold and the load repair", { timeout: 120_000 }, () => {
  it("rc.36 (Miguel): nothing runs until you pick — every preset starts on the base; Easy and Normal tag the best plan, Hard none", () => {
    const easy = createCareerSave({ ...INPUT, difficulty: "easy", trainingMode: undefined }, 1);
    const normal = createCareerSave({ ...INPUT, difficulty: "normal", trainingMode: undefined }, 1);
    const hard = createCareerSave({ ...INPUT, difficulty: "hard", trainingMode: undefined }, 1);
    expect(trainingOf(easy).mode).toBe("auto");
    expect(trainingOf(normal).mode).toBe("recommend");
    expect(trainingOf(hard).mode).toBe("manual");
    for (const s of [easy, normal, hard]) {
      expect(s.coach).toBeNull();
      // rc.35 applied the best plan on Easy; now no preset starts one by itself.
      expect(trainingOf(s).plan).toMatchObject({ author: "base", package: null });
      expect(trainingDecisionOf(s)).toBeNull();
      expect(clockHoldOf(s)).toBeNull();
      expect(trainingBlockOf(s)).toMatchObject({ running: false, cycle: null, promise: null });
    }
    // The tag: a real plan on Easy and Normal (development at a season's start), none on Hard.
    expect(recommendedPlanOf(easy)?.objective).toBe("development");
    expect(recommendedPlanOf(normal)).toEqual(recommendedPackageOf(normal).package);
    expect(recommendedPlanOf(hard)).toBeNull();
    expect(trainingControllerOf(normal)).toBe("recommend");
    expect(trainingControllerOf(hard)).toBe("manual");
    // rc.36: the focus it tags is the trio's weakest theme (a focus costs no overall).
    expect(recommendedPlanOf(normal)?.focus).not.toBe("balanced");
    // Not picking runs the base: the squad keeps growing, nothing waits.
    const later = playTo(normal, 20);
    expect(later.squad.some((p, i) => p.overall > normal.squad[i].overall)).toBe(true);
    expect(trainingOf(later).plan).toMatchObject({ package: null });
  });

  it("rc.36: a hired coach plans and starts each cycle (no prompt); an adjustment keeps his cycle's held gain; switched off he only recommends", () => {
    let save = createCareerSave({ ...INPUT, trainingMode: undefined }, 61_010);
    save = { ...save, coach: coach("run", 80, 2, "development") };
    expect(trainingControllerOf(save)).toBe("coach");
    expect(coachPlansOf(save)).toBe(CAREER_PLAN.coachPlansByDefault);
    let prompts = 0;
    save = playTo(save, 36, (s) => {
      if (trainingDecisionOf(s)) prompts += 1;
      return s;
    });
    expect(prompts).toBe(0);
    expect(trainingOf(save).plan).toMatchObject({ periodIndex: 1, author: "coach", cycleFrom: 29 });
    const heldBefore = Object.values(trainingOf(save).plan!.players).reduce((n, e) => n + (e.held ?? 0), 0);
    expect(heldBefore).toBeGreaterThan(0);
    // Adjust this cycle: the manager's plan runs to the boundary, what is held stays.
    const heavy = simplePackageOf({ objective: "development", workload: "heavy", scrims: "hard" });
    save = setTrainingPackageFlow(save, heavy).save;
    expect(trainingOf(save).plan).toMatchObject({ author: "user", cycleFrom: 29 });
    expect(trainingOf(save).plan!.package).toMatchObject({ workload: "heavy", scrimLevel: "hard", scrimsPerWeek: CAREER_PLAN.scrimsPerWeekOnLevel });
    const heldAfter = Object.values(trainingOf(save).plan!.players).reduce((n, e) => n + (e.held ?? 0), 0);
    expect(heldAfter).toBeGreaterThanOrEqual(heldBefore);
    save = playTo(save, 57);
    expect(trainingOf(save).history[0].players.some((p) => (p.completion ?? 0) > 0)).toBe(true);
    expect(trainingOf(save).plan).toMatchObject({ periodIndex: 2, author: "coach" });
    // Switched off: the running cycle runs on; the next one waits for the manager, his plan only tagged.
    save = setCoachPlansFlow(save, false).save;
    expect(trainingControllerOf(save)).toBe("recommend");
    expect(trainingOf(save).plan).toMatchObject({ author: "coach" });
    expect(recommendedPlanOf(save)).toEqual(coachProposalOf(save)!.package);
    save = playTo(save, 86);
    expect(trainingOf(save).plan).toMatchObject({ periodIndex: 3, author: "base", package: null });
    // Back on with nothing running: he starts his plan now.
    save = setCoachPlansFlow(save, true).save;
    expect(trainingOf(save).plan).toMatchObject({ author: "coach" });
    // Fired: his cycle runs on at the coachless rate to its end (rc.35 handed it to the preset).
    const fired = fireCoachFlow(save).save;
    expect(trainingOf(fired).plan).toMatchObject({ author: "coach" });
    expect(trainingOf(fired).plan!.package).toEqual(trainingOf(save).plan!.package);
  });

  it("rc.36: without a coach a finished cycle is started again by hand — the next period opens on the base and the batched Advance stops there once", () => {
    const start = setTrainingPackageFlow(createCareerSave({ ...INPUT, difficulty: "easy", trainingMode: undefined }, 61_021), DEV).save;
    expect(trainingOf(start).plan).toMatchObject({ author: "user", cycleFrom: 2 });
    const end = playTo(start, 29);
    expect(trainingOf(end).plan).toMatchObject({ periodIndex: 1, author: "base", package: null });
    expect(trainingOf(end).history[0]).toMatchObject({ periodIndex: 0, author: "user" });
    expect(cycleEndedTodayOf(end)).toBe(true);
    // The batched Advance from the cycle's last day stops on day 29 (the report, the next plan) —
    // once, and only because of the cycle (CAREER_PLAN.stopOnCycleEnd off: it runs on).
    const cups = setTrainingPackageFlow(
      createCareerSave({ ...INPUT, difficulty: "easy", trainingMode: undefined, prefs: { autoEnterUnofficials: true } }, 61_021),
      DEV,
    ).save;
    const eve = settle(playTo(cups, 28));
    expect(eve.clock.day).toBe(28);
    expect(advanceToNextStopFlow(eve).clock.day).toBe(29);
    const knob = CAREER_PLAN as unknown as { stopOnCycleEnd: boolean };
    knob.stopOnCycleEnd = false;
    try {
      expect(advanceToNextStopFlow(eve).clock.day).toBeGreaterThan(29);
    } finally {
      knob.stopOnCycleEnd = true;
    }
    expect(advanceToNextStopFlow(settle(advanceToNextStopFlow(eve))).clock.day).toBeGreaterThan(29);
    // It is a nudge, never a hold: the clock moves on without a plan.
    expect(clockHoldOf(end)).toBeNull();
    expect(advanceDayFlow(walkPastForTests(end)).clock.day).toBe(30);
    // Started by hand again: the next cycle runs.
    const again = setTrainingPackageFlow(end, DEV).save;
    expect(trainingOf(again).plan).toMatchObject({ periodIndex: 1, author: "user", cycleFrom: 30 });
    expect(cycleEndedTodayOf(again)).toBe(false);
    // The simple package: four choices; "off" scrims = none a week.
    expect(simplePackageOf({ objective: "recovery", workload: "light", scrims: "off" })).toMatchObject({ scrimsPerWeek: 0, focus: "balanced" });
    expect(simplePackageOf({ objective: "development", workload: "normal", scrims: "even", focus: "clutch-sets" })).toMatchObject({ focus: "clutch-sets" });
    expect(setTrainingModeFlow(start, "coach" as never).error).toBe("invalid");
  });

  it("rc.35: an rc.34 save migrates — 'coach' / 'approve' become the preset's meaning, a waiting proposal is dropped, idempotent", () => {
    let save = createCareerSave({ ...INPUT, difficulty: "easy", trainingMode: undefined }, 61_023);
    save = { ...save, coach: coach("old", 80, 2, "development") };
    const old = structuredClone(save) as CareerSave;
    const t = old.training as unknown as Record<string, unknown>;
    t.mode = "approve";
    t.delegatedFrom = "manual";
    delete t.reportSeen;
    old.training!.plan!.author = "base";
    old.training!.plan!.package = null;
    old.training!.proposal = { seasonIndex: 0, periodIndex: 0, day: old.clock.day, package: DEV, coachId: "old", reasonKey: "default" };
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(old)))!;
    expect(trainingOf(loaded)).toMatchObject({ mode: "auto", proposal: null, reportSeen: "" });
    expect(trainingOf(loaded).delegatedFrom).toBeUndefined();
    expect(trainingOf(loaded).plan!.author).toBe("coach"); // the coach in post runs it
    expect(trainingDecisionOf(loaded)).toBeNull();
    expect(migrateSaveToV5(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
  });

  it("rc.35 bug (Miguel): a finished cycle's results modal shows once, survives a reload, never repeats", () => {
    let save = setTrainingPackageFlow(createCareerSave(INPUT, 61_031), DEV).save;
    expect(trainingReportOf(save)).toBeNull();
    save = playTo(save, 29);
    const report = trainingReportOf(save);
    expect(report).toMatchObject({ seasonIndex: 0, periodIndex: 0 });
    expect(report!.players.length).toBeGreaterThan(0);
    // A reload before it is seen: still there.
    const reloaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(trainingReportOf(reloaded)).toMatchObject({ periodIndex: 0 });
    const seen = acknowledgeTrainingReportFlow(reloaded).save;
    expect(trainingReportOf(seen)).toBeNull();
    expect(trainingReportOf(migrateSaveToV5(JSON.parse(JSON.stringify(seen)))!)).toBeNull();
    expect(acknowledgeTrainingReportFlow(seen).save).toBe(seen);
    // rc.36: a period on the base (nothing started) is filed quietly — no modal.
    const quiet = playTo(seen, 57);
    expect(trainingOf(quiet).history[0]).toMatchObject({ periodIndex: 1, package: null });
    expect(trainingReportOf(quiet)).toBeNull();
    // A cycle started by hand files the next report: it shows once more.
    const later = playTo(setTrainingPackageFlow(quiet, DEV).save, 85);
    expect(trainingReportOf(later)).toMatchObject({ periodIndex: 2 });
    // An older save with reports but no seen key: nothing old pops after the update.
    const legacy = structuredClone(later);
    delete legacy.training!.reportSeen;
    expect(trainingReportOf(migrateSaveToV5(JSON.parse(JSON.stringify(legacy)))!)).toBeNull();
  });

  it("T8: an rc.33 save loads on the base — its mode from the preset, its focus as a tweak, nothing twice, no jump", () => {
    let save = createCareerSave({ ...INPUT, trainingMode: undefined }, 61_011);
    save = playTo(save, 10);
    const old = structuredClone(save) as CareerSave & { training?: unknown };
    delete old.training;
    old.prefs = { ...old.prefs, autoTrain: true };
    old.squad[0].trainingFocus = "mechanics";
    old.squad[1].trainingIntensity = "heavy";
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(old)))!;
    const t = trainingOf(loaded);
    expect(t.mode).toBe("recommend");
    expect(t.plan).toMatchObject({ periodIndex: 0, package: null, author: "base", lastSessionDay: 10 });
    expect(t.carryTweaks).toEqual({ [old.squad[0].id]: { focus: "mechanics" }, [old.squad[1].id]: { workload: "heavy" } });
    expect(loaded.squad.map((p) => p.overall)).toEqual(old.squad.map((p) => p.overall));
    // Idempotent: a second load changes nothing.
    expect(migrateSaveToV5(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
    // It keeps training (the base) on the next day.
    const next = advanceDayFlow(loaded);
    expect(next.clock.day).toBe(11);
    expect(Object.values(trainingOf(next).plan!.players).some((e) => e.sessions > 0)).toBe(true);
  });

  it("rc.34 review: passing a cup (a fresh invite or an accepted one) runs no hidden training day outside the plan", () => {
    const save = createCareerSave(INPUT, 61_030);
    const day = save.clock.day + 5;
    const cup = { id: `0:${weekOfDay(day)}:unofficial`, seasonIndex: 0, week: weekOfDay(day), day, split: 1, format: "single", tier: "t3", name: "Test Cup" } as CareerEventDef;
    const grown = (s: CareerSave) => s.squad.map((p) => ({ overall: p.overall, attrs: p.attrOffsets, split: p.gainedThisSplit, season: p.gainedThisSeason }));
    for (const offered of [
      { ...structuredClone(save), unofficialOffer: cup },
      { ...structuredClone(save), unofficialOffer: cup, pendingEventDef: cup },
    ]) {
      const passed = declineUnofficial(offered);
      expect(passed.unofficialOffer).toBeNull();
      expect(passed.pendingEventDef).toBeNull();
      expect(grown(passed)).toEqual(grown(offered));
      expect(trainingOf(passed).plan).toEqual(trainingOf(offered).plan);
    }
  });

  it("T4: the coach in post grows once at the season's filing (a second call changes nothing) — rc.34 review: only after days of work", () => {
    // Hired and straight to the filing (in the season review, or on the last day): no coach days, no growth.
    const idle = { ...createCareerSave(INPUT, 61_013), coach: coach("idle", 80, 2, "development") };
    trainingSeasonEnd(idle);
    expect(idle.coach).toMatchObject({ overall: 80, experience: 2 });
    // A coach who ran this season's sessions grows.
    const filed = playTo({ ...createCareerSave(INPUT, 61_013), coach: coach("grow", 80, 2, "development") }, 8);
    expect(trainingOf(filed).plan!.coaches.find((c) => c.name === "grow")!.days).toBeGreaterThan(0);
    trainingSeasonEnd(filed);
    expect(filed.coach!.experience).toBe(3);
    expect(filed.coach!.overall).toBeCloseTo(80 + CAREER_COACH_MARKET.growth.qualityPerSeason, 6);
    trainingSeasonEnd(filed);
    expect(filed.coach!.experience).toBe(3);
    expect(filed.coach!.overall).toBeCloseTo(80 + CAREER_COACH_MARKET.growth.qualityPerSeason, 6);
  });

  it("the rollover files the last cycle (8 a season, rc.36) and pays its completion; the next season opens on the base", () => {
    let save = setTrainingPackageFlow(createCareerSave(INPUT, 61_012), DEV).save;
    // rc.36: started by hand every cycle (nothing repeats by itself).
    save = playTo(save, 224, (s) => (trainingOf(s).plan && !trainingOf(s).plan!.package ? setTrainingPackageFlow(s, DEV).save : s));
    let guard = 0;
    while (save.phase === "running" && guard++ < 20) save = step(save);
    expect(save.phase).toBe("seasonReview");
    {
      const heldAtEnd = Object.values(trainingOf(save).plan?.players ?? {}).reduce((n, e) => n + (e.held ?? 0), 0);
      const next = rolloverToNextSeason(save);
      const t = trainingOf(next);
      const season0 = t.history.filter((h) => h.seasonIndex === 0);
      expect(season0).toHaveLength(8);
      expect(season0.every((h) => h.package !== null)).toBe(true);
      // The last cycle's held gain landed at the rollover (before the squad aged).
      if (heldAtEnd > 0) expect(season0[0].players.some((p) => (p.completion ?? 0) > 0)).toBe(true);
      expect(t.plan).toMatchObject({ seasonIndex: 1, periodIndex: 0, package: null, author: "base" });
    }
  });
});
