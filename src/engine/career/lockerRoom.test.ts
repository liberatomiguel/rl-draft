/**
 * v2.3 LOCKER (wave 1): the locker room's rules — each driver, promises kept
 * and broken, the word, the transfer request, the training factor's bounds,
 * the unanswered talk, determinism, the L5 hooks.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { expectedWinOf, seriesOfUser } from "./lockerRoomFacts";
import {
  answerLockerTalk,
  credibilityOf,
  emptyLockerRoom,
  heldMoodOf,
  lockerIssuesOf,
  lockerMatchBonusOf,
  lockerStep,
  matchMoraleEffectOf,
  shownMoodOf,
  moodOf,
  moraleOf,
  moraleTrainingCtxOf,
  nudgeMorale,
  openTalksOf,
  seedInheritedLockerRoom,
  stayDeadlineFrom,
  trainingFactorFor,
  wordMultiplierOf,
  type LockerRoomState,
  type LockerStepInput,
  type LockerSquadMember,
} from "./lockerRoom";
import { trainWeek } from "./development";
import type { SquadPlayer } from "./types";
import type { Placement } from "../types";

const SQUAD: LockerSquadMember[] = [
  { id: "a", overall: 80 },
  { id: "b", overall: 79 },
  { id: "c", overall: 78 },
  { id: "d", overall: 70 }, // a reserve: below the weakest starter
  { id: "e", overall: 82 }, // benched although the best: expects to start
];
const LINEUP = ["a", "b", "c"];
const SEED = 2300;

let day = 10;
const clock = () => ({ seasonIndex: 0, day });

function step(st: LockerRoomState, facts: Partial<LockerStepInput>) {
  return lockerStep(st, { clock: clock(), careerSeed: SEED, squad: SQUAD, ...facts });
}
const event = (placement: Placement | undefined, tier = "regional", lineup = LINEUP) => ({
  eventId: `ev${day}`,
  tier,
  placement,
  lineup,
});

function withMorale(values: Record<string, number>): LockerRoomState {
  const st = emptyLockerRoom();
  for (const [id, morale] of Object.entries(values)) st.players[id] = { morale, benchRun: 0, lowWeeks: 0 };
  return st;
}

function answer(st: LockerRoomState, talkId: string, a: Parameters<typeof answerLockerTalk>[2]) {
  return answerLockerTalk(st, talkId, a, { clock: clock(), careerSeed: SEED, squad: SQUAD });
}

afterEach(() => {
  (FEATURES as Record<string, unknown>).lockerRoom = false;
  day = 10;
});

describe("L1 morale and moods", () => {
  it("reads neutral without state and maps the five moods", () => {
    expect(moraleOf(undefined, "a")).toBe(L.neutral);
    expect(moraleOf(emptyLockerRoom(), "a")).toBe(L.neutral);
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(moodOf)).toEqual([
      "angry", "angry", "unhappy", "unhappy", "neutral", "neutral", "content", "content", "delighted", "delighted",
    ]);
  });
});

describe("L2 drivers", () => {
  it("bench: each event sat out costs benchDrop; at N a talk; it keeps falling; playing again lifts", () => {
    let st = emptyLockerRoom();
    for (let i = 1; i <= L.benchRunTalk; i++) {
      const out = step(st, { events: [event("top8")] });
      st = out.state;
      expect(st.players.e.morale).toBe(L.neutral - i * L.benchDrop);
      expect(openTalksOf(st).some((t) => t.playerId === "e" && t.topic === "bench")).toBe(i === L.benchRunTalk);
    }
    st = step(st, { events: [event("top8")] }).state;
    expect(st.players.e.morale).toBe(L.neutral - (L.benchRunTalk + 1) * L.benchDrop);
    expect(openTalksOf(st).filter((t) => t.playerId === "e")).toHaveLength(1);
    const back = step(st, { events: [event("top8", "regional", ["a", "b", "e"])] }).state;
    expect(back.players.e.morale).toBe(st.players.e.morale + L.backInSide);
    expect(back.players.e.last?.reason).toBe("backInSide");
    expect(back.players.e.benchRun).toBe(0);
  });

  it("a reserve who does not expect to start stops falling at the floor", () => {
    let st = emptyLockerRoom();
    for (let i = 0; i < 20; i++) st = step(st, { events: [event("top8")] }).state;
    expect(st.players.d.morale).toBe(L.benchFloorReserve);
    expect(st.players.e.morale).toBeLessThan(L.benchFloorReserve);
  });

  it("results: a title lifts the squad, a deep run less, a long losing run lowers it", () => {
    const title = step(emptyLockerRoom(), { events: [event("champion")] }).state;
    expect(title.players.a.morale).toBe(L.neutral + L.played + L.titleLift);
    expect(title.players.a.last?.reason).toBe("title");
    const cup = step(emptyLockerRoom(), { events: [event("champion", "t3")] }).state;
    expect(cup.players.a.morale).toBe(L.neutral + L.played);
    const deep = step(emptyLockerRoom(), { events: [event("third", "major")] }).state;
    expect(deep.players.a.morale).toBe(L.neutral + L.played + L.deepRunLift);
    let st = emptyLockerRoom();
    const poor = [];
    for (let i = 0; i < L.losingRunFrom; i++) {
      st = step(st, { events: [event("swiss_exit")] }).state;
      poor.push(st.players.a.morale);
    }
    expect(poor[L.losingRunFrom - 2]).toBe(L.neutral + (L.losingRunFrom - 1) * L.played);
    expect(poor[L.losingRunFrom - 1]).toBe(L.neutral + L.losingRunFrom * L.played - L.losingRunDrop);
    expect(st.players.a.last?.reason).toBe("losingRun");
  });

  it("the market: listed lowers him; a refused bid opens a talk", () => {
    const listed = step(emptyLockerRoom(), { listed: ["b"] });
    expect(listed.state.players.b.morale).toBe(L.neutral - L.listedDrop);
    const bid = step(emptyLockerRoom(), { bidsRefused: ["c"] });
    expect(openTalksOf(bid.state)).toMatchObject([{ playerId: "c", topic: "bid", neutral: "focus" }]);
    expect(bid.notes.some((n) => n.kind === "talk" && n.playerId === "c")).toBe(true);
  });

  it("every visible mood change carries its reason", () => {
    const out = step(withMorale({ b: 45 }), { listed: ["b"] });
    expect(out.notes).toContainEqual({ kind: "mood", reason: "listed", changes: [{ playerId: "b", mood: "unhappy" }] });
    for (const entry of out.state.log) expect(entry.reason).toBeTruthy();
  });

  it("rc9 (R211): with nothing going on, the weekly pull moves toward neutral, never past it", () => {
    const pull = (m: number) => {
      const gap = L.neutral - m;
      return Math.abs(gap) < L.pull.minGap ? m : m + Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) * L.pull.share));
    };
    const st = step(withMorale({ a: 70, b: 30, c: 50, d: 51 }), { weeks: 3 }).state;
    expect([st.players.a.morale, st.players.b.morale, st.players.c.morale, st.players.d.morale]).toEqual([
      pull(pull(pull(70))),
      pull(pull(pull(30))),
      50,
      51,
    ]);
    expect(st.players.a.morale).toBeGreaterThan(L.neutral);
    expect(st.players.b.morale).toBeLessThan(L.neutral);
  });
});

describe("L3 talks, promises and the word", () => {
  function benchTalk(st = emptyLockerRoom()) {
    for (let i = 0; i < L.benchRunTalk; i++) st = step(st, { events: [event("top8")] }).state;
    return { st, talk: openTalksOf(st).find((t) => t.playerId === "e")! };
  }

  it("a minutes promise kept lifts him and the word", () => {
    const { st, talk } = benchTalk();
    const made = answer(st, talk.id, "promiseMinutes");
    expect(made.state.players.e.morale).toBe(st.players.e.morale + L.promise.calm);
    let s = made.state;
    const withE = ["a", "b", "e"];
    for (let i = 0; i < L.promise.minutesNeed; i++) s = step(s, { events: [event("top8", "regional", withE)] }).state;
    expect(s.promises).toHaveLength(0);
    expect(s.word).toEqual({ kept: 1, broken: 0 });
    expect(s.players.e.last?.reason).toBe("promiseKept");
  });

  it("a minutes promise broken drops him hard, the squad a little, and the word", () => {
    const { st, talk } = benchTalk();
    let s = answer(st, talk.id, "promiseMinutes").state;
    const before = { e: s.players.e.morale, a: s.players.a.morale };
    let notes: ReturnType<typeof step>["notes"] = [];
    for (let i = 0; i <= L.promise.minutesOf - L.promise.minutesNeed; i++) {
      const out = step(s, { events: [event("top8")] });
      s = out.state;
      notes = notes.concat(out.notes);
    }
    expect(s.word).toEqual({ kept: 0, broken: 1 });
    expect(notes.some((n) => n.kind === "promiseBroken" && n.playerId === "e")).toBe(true);
    const benched = L.promise.minutesOf - L.promise.minutesNeed + 1;
    expect(s.players.e.morale).toBe(Math.max(0, before.e - benched * L.benchDrop - L.promise.broken));
    expect(s.players.a.morale).toBe(before.a + benched * L.played - L.promise.brokenSquad);
  });

  it("a stay promise is kept when the window closes, broken by a listing or a sale", () => {
    const bid = step(emptyLockerRoom(), { bidsRefused: ["c"] }).state;
    const talk = openTalksOf(bid)[0];
    const made = answer(bid, talk.id, "promiseStay").state;
    const deadline = made.promises[0].deadline;
    expect(deadline).toEqual(stayDeadlineFrom(clock()));
    day = deadline.day + 1;
    const kept = step(made, {}).state;
    expect(kept.word).toEqual({ kept: 1, broken: 0 });
    day = 10;
    const listed = step(made, { listed: ["c"] }).state;
    expect(listed.word).toEqual({ kept: 0, broken: 1 });
    const sold = step(made, { departed: [{ id: "c", sold: true }], squad: SQUAD.filter((m) => m.id !== "c") }).state;
    expect(sold.word.broken).toBe(1);
    expect(sold.players.c).toBeUndefined();
    expect(sold.players.a.morale).toBe(L.neutral - L.promise.brokenSquad);
    const released = step(made, { departed: [{ id: "c", sold: false }], squad: SQUAD.filter((m) => m.id !== "c") }).state;
    expect(released.word).toEqual({ kept: 0, broken: 0 });
    expect(released.promises).toHaveLength(0);
  });

  it("the word decides how much a promise calms", () => {
    expect(credibilityOf({ kept: 0, broken: 0 })).toBe(0.5);
    expect(wordMultiplierOf({ kept: 0, broken: 0 })).toBe(1);
    expect(wordMultiplierOf({ kept: 3, broken: 0 })).toBe(L.word.maxMult);
    expect(wordMultiplierOf({ kept: 0, broken: 2 })).toBe(0);
    const calmWith = (word: { kept: number; broken: number }) => {
      const st = step(emptyLockerRoom(), { bidsRefused: ["c"] }).state;
      st.word = word;
      return answer(st, openTalksOf(st)[0].id, "promiseStay").state.players.c?.morale ?? L.neutral;
    };
    const fresh = calmWith({ kept: 0, broken: 0 });
    const trusted = calmWith({ kept: 4, broken: 0 });
    const liar = calmWith({ kept: 0, broken: 3 });
    expect(fresh).toBe(L.neutral + L.promise.calm);
    expect(trusted).toBeGreaterThan(fresh);
    expect(liar).toBe(L.neutral); // a manager who broke his word cannot talk his way out
  });

  it("an unanswered talk resolves itself with the neutral answer after talkDays", () => {
    const { st, talk } = benchTalk();
    day += L.talkDays - 1;
    expect(openTalksOf(step(st, {}).state)).toHaveLength(1);
    day += 1;
    const out = step(st, {});
    expect(openTalksOf(out.state)).toHaveLength(0);
    const closed = out.state.talks.find((t) => t.id === talk.id)!;
    expect(closed).toMatchObject({ answer: "earnIt", auto: true });
    expect(out.notes).toContainEqual({ kind: "talkAuto", talkId: talk.id, playerId: "e", topic: "bench", answer: "earnIt" });
    expect(answer(out.state, talk.id, "blunt").error).toBe("answered");
  });

  it("refuses an answer the talk does not offer", () => {
    const { st, talk } = benchTalk();
    expect(answer(st, talk.id, "sell").error).toBe("badAnswer");
    expect(answer(st, "talk:999", "earnIt").error).toBe("unknown");
  });
});

describe("L4 consequences", () => {
  it("low morale for requestWeeks weeks files a transfer request; refuse, sell, promise", () => {
    let st = withMorale({ a: 10 });
    st.players.a.benchRun = L.benchRunTalk; // sulking: no drift back up
    for (let w = 1; w < L.requestWeeks; w++) st = step(st, { weeks: 1 }).state;
    expect(openTalksOf(st)).toHaveLength(0);
    st = step(st, { weeks: 1 }).state;
    const talk = openTalksOf(st).find((t) => t.topic === "request")!;
    expect(talk).toMatchObject({ playerId: "a", answers: ["sell", "promiseMinutes", "refuse"], neutral: "refuse" });

    const refused = answer(st, talk.id, "refuse").state;
    expect(refused.players.a.morale).toBe(st.players.a.morale - L.refuseDrop);
    let later = refused;
    for (let w = 0; w < L.requestWeeks; w++) later = step(later, { weeks: 1 }).state;
    expect(openTalksOf(later)).toHaveLength(0); // the cooldown holds

    const sold = answer(st, talk.id, "sell");
    expect(sold.effect).toBe("list");
    expect(sold.state.players.a.agreedSale).toBe(true);
    const listed = step(sold.state, { listed: ["a"] }).state;
    expect(listed.players.a.morale).toBe(sold.state.players.a.morale); // an agreed sale: the list costs nothing
  });

  it("the training factor stays inside its bounds and is neutral at 50", () => {
    expect(trainingFactorFor(0)).toBeCloseTo(L.trainingMin, 10);
    expect(trainingFactorFor(50)).toBe(1);
    expect(trainingFactorFor(100)).toBeCloseTo(L.trainingMax, 10);
    expect(trainingFactorFor(-40)).toBeCloseTo(L.trainingMin, 10);
    expect(trainingFactorFor(400)).toBeCloseTo(L.trainingMax, 10);
    for (let m = 0; m <= 100; m += 5) {
      expect(trainingFactorFor(m)).toBeGreaterThanOrEqual(L.trainingMin - 1e-12);
      expect(trainingFactorFor(m)).toBeLessThanOrEqual(L.trainingMax + 1e-12);
    }
  });

  it("the factor reaches a tick only with the flag on, and never lowers a stored overall", () => {
    const st = withMorale({ p1: 0, p2: 100, p3: 50 });
    expect(moraleTrainingCtxOf(st)).toEqual({});
    (FEATURES as Record<string, unknown>).lockerRoom = true;
    const ctx = moraleTrainingCtxOf(st);
    expect(ctx.moraleFactors).toEqual({ p1: trainingFactorFor(0), p2: trainingFactorFor(100) });
    const player = {
      id: "p1", kind: "fictional", name: "P1", region: "EU", birthYear: 2006, archetype: "allrounder", overall: 70,
      attrOffsets: {}, potential: 88, peakAge: 24, declineRate: "normal", role: "starter", salaryPerSplit: 0,
      contractEndSeason: 3, trainingFocus: "balanced", trainingIntensity: "normal", scoutLevel: 0, splitsTogether: 0,
      joinedSeason: 0, gainedThisSplit: 0, gainedThisSeason: 0,
    } as unknown as SquadPlayer;
    const base = { seasonIndex: 0, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, splitGained: 0, seasonGained: 0, weeks: 1, model: 1 };
    const plain = trainWeek(player, base);
    const low = trainWeek(player, { ...base, ...ctx });
    const high = trainWeek({ ...player, id: "p2" }, { ...base, ...ctx });
    expect(plain.gained).toBeGreaterThan(0);
    expect(low.gained).toBeLessThan(plain.gained);
    expect(low.player.overall).toBeGreaterThanOrEqual(player.overall);
    expect(high.gained).toBeGreaterThan(plain.gained);
    expect(low.player.potential).toBe(player.potential);
  });

  it("wave 1's per-50-morale tunable still ships at zero (rc9 replaced it with the mood table)", () => {
    expect(L.matchEffect).toBe(0);
    for (const m of [0, 25, 50, 75, 100]) expect(matchMoraleEffectOf(m)).toBe(0);
  });

  it("rc9 (R217): the match bonus is the lineup's mean mood effect, clamped, damped in the first season, 0 with the flag off", () => {
    const st = withMorale({ a: 90, b: 90, c: 90, d: 5, e: 5, f: 5 });
    expect(lockerMatchBonusOf(st, ["a", "b", "c"], { firstSeason: false })).toBe(0); // flag off
    (FEATURES as Record<string, unknown>).lockerRoom = true;
    expect(lockerMatchBonusOf(st, ["a", "b", "c"], { firstSeason: false })).toBe(Math.min(L.match.byMood.delighted, L.match.teamMax));
    expect(lockerMatchBonusOf(st, ["d", "e", "f"], { firstSeason: false })).toBe(Math.max(L.match.byMood.angry, L.match.teamMin));
    expect(lockerMatchBonusOf(st, ["d", "e", "f"], { firstSeason: true })).toBeCloseTo(Math.max(L.match.byMood.angry, L.match.teamMin) * L.match.firstSeasonNegScale, 10);
    expect(lockerMatchBonusOf(st, ["a", "d", "x"], { firstSeason: false })).toBeCloseTo((L.match.byMood.delighted + L.match.byMood.angry) / 3, 2);
    expect(lockerMatchBonusOf(emptyLockerRoom(), ["a", "b", "c"], { firstSeason: false })).toBe(0);
    // A recent Worlds champion is never lifted by its mood; a bad room still costs it.
    expect(lockerMatchBonusOf(st, ["a", "b", "c"], { firstSeason: false, dynasty: true })).toBe(Math.min(L.match.byMood.delighted, L.match.teamMax) * L.match.dynastyPosScale);
    expect(lockerMatchBonusOf(st, ["d", "e", "f"], { firstSeason: false, dynasty: true })).toBe(Math.max(L.match.byMood.angry, L.match.teamMin));
    // Bounded for any morale, and the effect never depends on how long the save has run.
    for (const m of [0, 10, 30, 50, 70, 90, 100]) {
      const b = lockerMatchBonusOf(withMorale({ a: m, b: m, c: m }), ["a", "b", "c"], { firstSeason: false });
      expect(b).toBeGreaterThanOrEqual(L.match.teamMin);
      expect(b).toBeLessThanOrEqual(L.match.teamMax);
    }
  });
});

describe("rc9 LOCKER: morale that moves", () => {
  const won = (p: number) => ({ won: true, p });
  const lost = (p: number) => ({ won: false, p });
  const weeksOf = (st: LockerRoomState, n: number, facts: Partial<LockerStepInput> = {}) => {
    for (let w = 0; w < n; w++) {
      day += 7;
      st = step(st, { weeks: 1, ...facts }).state;
    }
    return st;
  };

  it("R215: the shown mood holds inside the hysteresis band and follows a clear crossing", () => {
    const h = L.moodHysteresis;
    expect(heldMoodOf("neutral", 60)).toBe("neutral");
    expect(heldMoodOf("neutral", 60 + h)).toBe("content");
    expect(heldMoodOf("content", 59)).toBe("content");
    expect(heldMoodOf("content", 60 - h - 1)).toBe("neutral");
    expect(heldMoodOf("neutral", 10)).toBe("angry"); // two moods away: no hold
    expect(heldMoodOf(undefined, 61)).toBe("content");
    // In a step: a small push over the bound shows nothing; the mood is stored only while it differs.
    const ctx = { clock: clock(), careerSeed: SEED };
    const dip = nudgeMorale(withMorale({ b: 61 }), ctx, "b", -3, "settling");
    expect(dip.state.players.b.morale).toBe(58);
    expect(shownMoodOf(dip.state, "b")).toBe("content");
    expect(dip.state.players.b.mood).toBe("content");
    expect(dip.notes.some((n) => n.kind === "mood")).toBe(false);
    const back = nudgeMorale(dip.state, ctx, "b", 2, "settling");
    expect(back.state.players.b.mood).toBeUndefined(); // 60: content again, nothing stored
    const fall = nudgeMorale(dip.state, ctx, "b", -2, "settling");
    expect(shownMoodOf(fall.state, "b")).toBe("neutral");
    expect(fall.notes).toContainEqual({ kind: "mood", reason: "settling", changes: [{ playerId: "b", mood: "neutral" }] });
  });

  it("R212: results above expectation lift the target, below it lower it; a favourite's title lifts less", () => {
    const beat = step(emptyLockerRoom(), { events: [{ ...event("top4"), series: [won(0.3), won(0.3), won(0.4)] }] }).state;
    expect(beat.results).toBeGreaterThan(1.5);
    const up = weeksOf(beat, 4);
    expect(up.players.a.morale).toBeGreaterThan(L.neutral + L.played);
    expect(up.players.a.last?.reason).toBe("goodResults");
    // The bench feels it at benchShare (d has sat out one event).
    expect(up.players.d.morale).toBeLessThan(up.players.a.morale);

    const flop = step(emptyLockerRoom(), { events: [{ ...event("swiss_exit"), series: [lost(0.8), lost(0.75), lost(0.7)] }] }).state;
    const down = weeksOf(flop, 4);
    expect(down.players.a.morale).toBeLessThan(L.neutral);
    expect(down.players.a.last?.reason).toBe("poorResults");

    const fav = step(emptyLockerRoom(), { events: [{ ...event("champion"), favourite: true }] }).state;
    const dog = step(emptyLockerRoom(), { events: [{ ...event("champion"), favourite: false }] }).state;
    expect(dog.players.a.morale - fav.players.a.morale).toBe(L.titleLift - Math.round(L.titleLift * L.favouriteTitleShare));
  });

  it("R212: the difficulty's edge shifts the expectation (Hard expects less), none without a difficulty", () => {
    const t = {
      teams: {},
      swiss: { rounds: [{ series: [{ teamAId: "user", teamBId: "x", winnerTeamId: "user", ratingDiff: 0 }] }] },
    } as unknown as Parameters<typeof seriesOfUser>[0];
    expect(seriesOfUser(t)[0].p).toBeCloseTo(0.5, 6);
    expect(seriesOfUser(t, "user", "normal")[0].p).toBeCloseTo(expectedWinOf(L.expectShift.normal ?? 0), 6);
    expect(seriesOfUser(t, "user", "hard")[0].p).toBeLessThan(0.5);
    expect(seriesOfUser(t, "user", "hard")[0].p).toBeCloseTo(expectedWinOf(L.expectShift.hard), 6);
  });

  it("R213: box-score form against the lineup's mean moves his target, and fades", () => {
    const box = { a: { games: 3, ratingSum: 24 }, b: { games: 3, ratingSum: 18 }, c: { games: 3, ratingSum: 18 } };
    const st = step(emptyLockerRoom(), { box }).state;
    expect(st.players.a.form).toBeGreaterThan(0);
    expect(st.players.b.form).toBeLessThan(0);
    const later = weeksOf(st, 3);
    expect(later.players.a.morale).toBeGreaterThan(later.players.b.morale);
    expect(later.players.a.last?.reason).toBe("goodForm");
    expect(Math.abs(later.players.a.form ?? 0)).toBeLessThan(Math.abs(st.players.a.form ?? 0));
  });

  it("R214: sustained heavy load tires him, then he asks for a lighter load; rest recovers", () => {
    const heavy = { a: "heavy" as const, b: "normal" as const };
    let st = emptyLockerRoom();
    const notes: ReturnType<typeof step>["notes"] = [];
    for (let w = 0; w < L.asks.loadAt; w++) {
      day += 7;
      const out = step(st, { weeks: 1, loads: heavy });
      st = out.state;
      notes.push(...out.notes);
    }
    expect(st.players.a.load).toBe(L.asks.loadAt);
    expect(st.players.a.morale).toBeLessThan(L.neutral);
    expect(st.log.some((e) => e.playerId === "a" && e.reason === "heavyLoad")).toBe(true);
    const talk = openTalksOf(st).find((t) => t.playerId === "a")!;
    expect(talk).toMatchObject({ topic: "load", answers: ["lighten", "keepLoad"], neutral: "keepLoad" });
    expect(notes.some((n) => n.kind === "talk" && n.topic === "load")).toBe(true);
    const yes = answer(st, talk.id, "lighten");
    expect(yes.effect).toEqual({ kind: "load", playerId: "a", workload: "light" });
    expect(yes.state.players.a.morale).toBe(st.players.a.morale + L.answers.heard);
    const no = answer(st, talk.id, "keepLoad");
    expect(no.effect).toBeNull();
    expect(no.state.players.a.morale).toBe(st.players.a.morale - L.answers.passedOver);
    const rested = weeksOf(no.state, 3, { loads: { a: "rest" } });
    expect(rested.players.a.load ?? 0).toBe(0);
    expect(rested.players.a.morale).toBeGreaterThan(no.state.players.a.morale);
    expect(rested.players.a.last?.reason).toBe("rested");
  });

  it("R216: one new talk per gapWeeks for the whole squad; a refused bid is exempt", () => {
    let st = emptyLockerRoom();
    const loads = { a: "heavy" as const, b: "heavy" as const };
    for (let w = 0; w < L.asks.loadAt; w++) {
      day += 7;
      st = step(st, { weeks: 1, loads }).state;
    }
    expect(openTalksOf(st).filter((t) => t.topic === "load")).toHaveLength(1);
    const bid = step(st, { bidsRefused: ["c"] }).state;
    expect(openTalksOf(bid).map((t) => t.topic).sort()).toEqual(["bid", "load"]);
    // The other tired player asks once the gap has passed.
    let later = st;
    for (let w = 0; w < L.asks.gapWeeks; w++) {
      day += 7;
      later = step(later, { weeks: 1, loads }).state;
    }
    expect(later.talks.filter((t) => t.topic === "load").map((t) => t.playerId).sort()).toEqual(["a", "b"]);
    expect(later.talks.find((t) => t.playerId === "a")).toMatchObject({ answer: "keepLoad", auto: true }); // a's lapsed after a week
  });

  it("R216: a player who feels good asks for more load now and then (seeded); the yes is a heavy tweak", () => {
    const opened: string[] = [];
    for (let w = 0; w < 40; w++) {
      day = 10 + w * 7;
      const out = step(withMorale({ a: 75 }), { weeks: 1, loads: { a: "normal" } });
      if (openTalksOf(out.state).some((t) => t.playerId === "a" && t.topic === "more")) opened.push(String(w));
    }
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.length).toBeLessThan(40);
    day = 10 + Number(opened[0]) * 7;
    const st = step(withMorale({ a: 75 }), { weeks: 1, loads: { a: "normal" } }).state;
    const talk = openTalksOf(st).find((t) => t.topic === "more")!;
    expect(answer(st, talk.id, "pushHim").effect).toEqual({ kind: "load", playerId: "a", workload: "heavy" });
    expect(answer(st, talk.id, "holdBack").state.players.a.morale).toBe(st.players.a.morale - L.answers.heldBack);
  });

  it("R216: a 1v1 / 2v2 cup surfacing: a reserve asks to play it; the yes enters him, the talk closes before the cup", () => {
    let found: { st: LockerRoomState; talkId: string } | null = null;
    for (let k = 0; k < 30 && !found; k++) {
      const out = step(emptyLockerRoom(), { starters: LINEUP, sideOffer: { eventId: `cup${k}`, teamSize: 1, day: day + 5 } });
      const t = openTalksOf(out.state).find((x) => x.topic === "side");
      if (t) found = { st: out.state, talkId: t.id };
    }
    expect(found).not.toBeNull();
    const talk = found!.st.talks.find((t) => t.id === found!.talkId)!;
    expect(LINEUP).not.toContain(talk.playerId); // a reserve first
    expect(talk.params).toMatchObject({ size: 1 });
    const yes = answer(found!.st, talk.id, "enterHim");
    expect(yes.effect).toEqual({ kind: "enterSide", playerId: talk.playerId, eventId: talk.params!.eventId });
    expect(talk.deadline.day).toBeLessThan(day + 5);
    // The cup played: its participants are lifted, the club's results memory is untouched.
    const played = step(yes.state, { events: [{ eventId: "cupX", tier: "t3", placement: "champion", lineup: [talk.playerId], side: true }] }).state;
    expect(played.players[talk.playerId].morale).toBe(yes.state.players[talk.playerId].morale + L.sideEvent.played + L.sideEvent.champion);
    expect(played.results).toBeUndefined();
    expect(played.losingRun).toBe(0);
  });

  it("R216: a benched reserve asks to start the regional; the yes swaps him in for that event, then back", () => {
    let st = emptyLockerRoom();
    for (let i = 0; i < L.asks.startBenchRun; i++) st = step(st, { events: [event("top8")] }).state;
    // e (82, benched) is the candidate; drop his bench talk to isolate the start ask.
    st.talks = [];
    st.lastAskWeek = undefined;
    for (const p of Object.values(st.players)) delete p.askedWeek;
    let talk: ReturnType<typeof openTalksOf>[number] | undefined;
    let base = st;
    for (let k = 0; k < 30 && !talk; k++) {
      base = step(st, { starters: LINEUP, nextOfficial: { eventId: `reg${k}`, tier: "regional", day: day + 4 } }).state;
      talk = openTalksOf(base).find((t) => t.topic === "start");
    }
    expect(talk).toBeDefined();
    expect(talk!.params).toMatchObject({ outId: "c" }); // the weakest starter
    const yes = answer(base, talk!.id, "startHim");
    expect(yes.effect).toEqual({ kind: "startSub", inId: talk!.playerId, outId: "c", eventId: talk!.params!.eventId });
    expect(yes.state.players.c.morale).toBe((base.players.c?.morale ?? L.neutral) - L.answers.madeWay);
    expect(yes.state.swap).toMatchObject({ inId: talk!.playerId, outId: "c" });
    const after = step(yes.state, { events: [{ ...event("top4", "regional", ["a", "b", talk!.playerId]), eventId: String(talk!.params!.eventId) }] });
    expect(after.notes).toContainEqual({ kind: "swapBack", inId: talk!.playerId, outId: "c" });
    expect(after.state.swap).toBeUndefined();
    // Not a regional: no ask.
    const major = step(st, { starters: LINEUP, nextOfficial: { eventId: "m1", tier: "major", day: day + 4 } }).state;
    expect(openTalksOf(major).some((t) => t.topic === "start")).toBe(false);
  });

  it("an event seen twice (same key) counts once", () => {
    const ev = { ...event("champion"), key: "0:ev" };
    const once = step(emptyLockerRoom(), { events: [ev] }).state;
    const twice = step(once, { events: [ev] }).state;
    expect(twice.players.a.morale).toBe(once.players.a.morale);
  });
});

describe("determinism", () => {
  it("the same facts and seed give the same state and notes", () => {
    const run = () => {
      let st = emptyLockerRoom();
      const notes: unknown[] = [];
      for (let i = 0; i < 6; i++) {
        const out = step(st, { events: [event(i % 2 ? "swiss_exit" : "champion")], weeks: 1, bidsRefused: i === 2 ? ["b"] : [] });
        st = out.state;
        notes.push(out.notes);
      }
      return { st, notes };
    };
    expect(run()).toEqual(run());
    const input = emptyLockerRoom();
    step(input, { listed: ["a"] });
    expect(input).toEqual(emptyLockerRoom()); // pure: the input is untouched
  });
});

describe("L5 takeover hooks", () => {
  const save = { squad: SQUAD.map(({ id }) => ({ id })), clock: { seasonIndex: 2, day: 1 } };

  it("seedInheritedLockerRoom: one unhappy player and a promise left behind, seeded, save untouched", () => {
    const a = seedInheritedLockerRoom(save, createRng(7));
    const b = seedInheritedLockerRoom(save, createRng(7));
    expect(a).toEqual(b);
    expect(save).not.toHaveProperty("lockerRoom");
    const issues = lockerIssuesOf({ ...save, lockerRoom: a });
    expect(issues.unhappy).toHaveLength(1);
    expect(issues.unhappy[0].mood).toBe("unhappy");
    expect(issues.promises).toHaveLength(1);
    expect(issues.promises[0]).toMatchObject({ kind: "minutes", inherited: true });
    expect(issues.promises[0].playerId).not.toBe(issues.unhappy[0].playerId);
  });

  it("lockerIssuesOf: nothing without state; open talks only", () => {
    expect(lockerIssuesOf(save)).toEqual({ unhappy: [], promises: [], talks: [] });
    const st = step(withMorale({ d: 5 }), { bidsRefused: ["b"] }).state;
    const issues = lockerIssuesOf({ ...save, lockerRoom: st });
    expect(issues.unhappy.map((u) => u.playerId)).toEqual(["d"]);
    expect(issues.talks.map((t) => t.playerId)).toEqual(["b"]);
  });
});
