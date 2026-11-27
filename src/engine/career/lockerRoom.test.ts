/**
 * v2.3 LOCKER (wave 1): the locker room's rules — each driver, promises kept
 * and broken, the word, the transfer request, the training factor's bounds,
 * the unanswered talk, determinism, the L5 hooks.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { createRng } from "@/lib/rng";
import {
  answerLockerTalk,
  credibilityOf,
  emptyLockerRoom,
  lockerIssuesOf,
  lockerStep,
  matchMoraleEffectOf,
  moodOf,
  moraleOf,
  moraleTrainingCtxOf,
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

  it("the weekly drift moves toward neutral, never past it", () => {
    const st = step(withMorale({ a: 70, b: 30, c: 50 }), { weeks: 3 }).state;
    expect([st.players.a.morale, st.players.b.morale, st.players.c.morale]).toEqual([67, 33, 50]);
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

  it("the match effect ships at zero", () => {
    expect(L.matchEffect).toBe(0);
    for (const m of [0, 25, 50, 75, 100]) expect(matchMoraleEffectOf(m)).toBe(0);
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
