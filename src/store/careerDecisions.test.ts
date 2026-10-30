/**
 * rc.34 (Etapa 3, front G — ROADMAP UX-01a; HQ-CONTRACT H1 / h1, Gate 3a
 * decision 1-B): the decision queue. One list (pendingDecisionsOf) holds the
 * clock on every path — +1 day, the batched Advance, the autoplay (its stop is
 * continueKind ≠ "advance"), Championship Sunday's continue and a reload —
 * one test per kind; "Later" exists only for a bid and the sponsor offers, up
 * to their deadline day, where the clock stops again; the order is urgent
 * first. Plus Miguel's 31/10 asks: a short squad skips a regional, and front
 * H's notice slot holds until acknowledged.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  eventDayFor,
  firstDayOfWeek,
  officialEventDefsForWeek,
  qualifierDefsForWeek,
  splitEndDayFor,
  weekOfDay,
} from "@/engine/career/calendar";
import { sponsorOffersFor } from "@/engine/career/economy";
import type { CareerEventDef, CareerSave, TransferOffer } from "@/engine/career/types";
import { continueKind } from "@/components/career/careerUi";
import { playArcCareer } from "./careerArcBot";
import { stepDayForTests, walkPastForTests } from "./careerClockForTests";
import {
  DECISION_SOURCES,
  clockHoldOf,
  continueToNextSeasonFlow,
  declineSponsorOffersFlow,
  parkDecisionFlow,
  pendingDecisionsOf,
  reviewContractsFlow,
  rolloverHoldOf,
  topDecisionOf,
  type DecisionKind,
} from "./careerDecisions";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  canSkipShortSquadEvent,
  chooseSponsorFlow,
  continueEventToNextDayFlow,
  continueInfiniteFlow,
  createCareerSave,
  declineBidFlow,
  declineUnofficial,
  finishEvent,
  inviteSurfacedToday,
  isEventPaused,
  migrateSaveToV5,
  renewPlayerFlow,
  resolveInsertFlow,
  simEventToEnd,
  skipShortSquadEventFlow,
  squadHoldFor,
  startEvent,
  syncSquadRoles,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Queue Org",
    abbrev: "QUE",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

/** A fresh career on day 1 with nothing due (no inserts rolled, no offers). */
function fresh(seed = 34_001): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let s = 0; s < 2; s++) for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  return save;
}

function bidFor(save: CareerSave, days: number, id = "bid:test:1"): TransferOffer {
  const p = save.squad[0];
  return {
    id,
    direction: "out",
    playerId: p.id,
    playerName: p.name,
    fee: 20_000,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: Object.keys(save.world.orgs)[0],
    status: "pending",
    resolveSeason: save.clock.seasonIndex,
    resolveDay: save.clock.day + days,
    factors: [],
  };
}

function cupOn(save: CareerSave, day: number): CareerEventDef {
  const week = weekOfDay(day);
  return {
    id: `${save.clock.seasonIndex}:${week}:unofficial`,
    seasonIndex: save.clock.seasonIndex,
    week,
    day,
    split: 1,
    format: "single",
    tier: "t3",
    name: "Test Cup",
  } as CareerEventDef;
}

/** A save holding the clock on `kind`. */
function holding(kind: DecisionKind, base = fresh()): { save: CareerSave; restore?: () => void } {
  const save = structuredClone(base);
  switch (kind) {
    case "insert":
      save.pendingInsert = { id: "ins-showmatch", day: save.clock.day };
      return { save };
    case "invite":
      save.unofficialOffer = cupOn(save, save.clock.day + 5);
      save.pendingEventDef = null;
      return { save };
    case "bid":
      save.pendingOffers = [bidFor(save, 7)];
      return { save };
    case "sponsor":
      save.sponsorOffers = sponsorOffersFor(30, 0, save.careerSeed, null, false, "normal");
      return { save };
    case "event":
      // rc.34: an accepted Community Cup's matchday holds too (Play, or Pass).
      save.pendingEventDef = cupOn(save, save.clock.day);
      return { save };
    case "squadShort": {
      save.squad = save.squad.slice(0, 2);
      syncSquadRoles(save);
      const regional = officialEventDefsForWeek(0, 4).find((d) => d.tier === "regional" && d.region === "SAM")!;
      save.pendingEventDef = { ...regional, day: save.clock.day + 1 };
      return { save };
    }
    case "notice": {
      const was = DECISION_SOURCES.notice;
      DECISION_SOURCES.notice = () => ({ id: "notice:test" });
      return { save, restore: () => (DECISION_SOURCES.notice = was) };
    }
    case "training": {
      const was = DECISION_SOURCES.training;
      DECISION_SOURCES.training = () => ({ id: "training:test" });
      return { save, restore: () => (DECISION_SOURCES.training = was) };
    }
    default:
      throw new Error(`no fixture for ${kind}`);
  }
}

const reload = (save: CareerSave): CareerSave => migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;

describe("rc.34 UX-01a — the clock never passes a needed decision (one flow test per kind)", () => {
  // rc.34 review (Gate 3b): a fresh invite is not a needed decision (its default is "not entered") — its own describe below.
  const kinds: DecisionKind[] = ["insert", "bid", "sponsor", "event", "squadShort", "notice", "training"];
  for (const kind of kinds) {
    it(`${kind}: +1 day, the batched Advance, the autoplay and a reload all hold`, () => {
      const { save, restore } = holding(kind);
      try {
        expect(clockHoldOf(save)?.kind).toBe(kind);
        expect(topDecisionOf(save)?.kind).toBe(kind);
        expect(advanceDayFlow(save)).toBe(save);
        expect(advanceToNextStopFlow(save)).toBe(save);
        // The autoplay stops on anything but "advance" (CareerAutopilot).
        expect(continueKind(save)).toBe(kind === "event" ? "event" : "decision");
        const back = reload(save);
        expect(clockHoldOf(back)?.kind).toBe(kind);
        expect(advanceDayFlow(back)).toBe(back);
      } finally {
        restore?.();
      }
    });
  }

  it("answering releases the clock: insert, invite (accept or pass), bid, sponsor, a cup passed", () => {
    const ins = holding("insert").save;
    expect(advanceDayFlow(resolveInsertFlow(ins, "b").save).clock.day).toBe(ins.clock.day + 1);
    const inv = holding("invite").save;
    expect(advanceDayFlow(declineUnofficial(inv)).clock.day).toBe(inv.clock.day + 1);
    const bid = holding("bid").save;
    expect(advanceDayFlow(declineBidFlow(bid, "bid:test:1")).clock.day).toBe(bid.clock.day + 1);
    const sp = holding("sponsor").save;
    expect(advanceDayFlow(chooseSponsorFlow(sp, sp.sponsorOffers![0].sponsorId).save).clock.day).toBe(sp.clock.day + 1);
    expect(advanceDayFlow(declineSponsorOffersFlow(sp).save).clock.day).toBe(sp.clock.day + 1);
    const cup = holding("event").save;
    expect(advanceDayFlow(declineUnofficial(cup)).clock.day).toBe(cup.clock.day + 1);
  });

  it("the batched Advance stops on the day a decision arrives (a notice firing on a Monday)", () => {
    const was = DECISION_SOURCES.notice;
    // Front H's notice fires on the second Monday until acknowledged.
    let acknowledged = false;
    DECISION_SOURCES.notice = (s) => (!acknowledged && s.clock.day >= firstDayOfWeek(2) ? { id: "notice:w2" } : null);
    try {
      const save = fresh();
      const stopped = advanceToNextStopFlow(save);
      expect(stopped.clock.day).toBe(firstDayOfWeek(2));
      expect(clockHoldOf(stopped)?.kind).toBe("notice");
      expect(continueKind(stopped)).toBe("decision");
      expect(parkDecisionFlow(stopped, "notice:w2").error).toBe("cannotWait");
      acknowledged = true;
      expect(advanceDayFlow(stopped).clock.day).toBe(stopped.clock.day + 1);
    } finally {
      DECISION_SOURCES.notice = was;
    }
  });
});

describe("rc.34 review (Gate 3b: no repetitive weekly chore) — a fresh invite never holds the clock", () => {
  /** A Hard-like career that enters no cup on its own: its invites surface as invites. */
  function noAutoEntry(seed: number): CareerSave {
    const save = createCareerSave({ ...INPUT, prefs: { autoEnterUnofficials: false } }, seed);
    for (let s = 0; s < 2; s++) for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
    save.sponsorOffers = null;
    save.pendingOffers = [];
    return save;
  }

  it("shown on HQ (Accept / Pass) but not holding: +1 day, the routed continue and a reload all move on", () => {
    const { save } = holding("invite");
    expect(clockHoldOf(save)).toBeNull();
    expect(pendingDecisionsOf(save).find((d) => d.kind === "invite")).toMatchObject({ holds: false, canWait: false, parked: false });
    expect(topDecisionOf(save)?.kind).toBe("invite");
    expect(continueKind(save)).toBe("advance");
    expect(advanceDayFlow(save).clock.day).toBe(save.clock.day + 1);
    expect(advanceDayFlow(reload(save)).clock.day).toBe(save.clock.day + 1);
  });

  it("the batched Advance stops once, on the Monday it surfaces; a second press goes past it; past its matchday unanswered it is passed", () => {
    let save = noAutoEntry(34_041);
    let stop: CareerSave | null = null;
    for (let i = 0; i < 40 && save.phase === "running" && save.clock.seasonIndex === 0; i++) {
      const next = advanceToNextStopFlow(walkPastForTests(save));
      if (next.clock.day === save.clock.day) break;
      save = next;
      if (inviteSurfacedToday(save)) {
        stop = save;
        break;
      }
    }
    expect(stop).not.toBeNull();
    const monday = stop!;
    const offer = monday.unofficialOffer!;
    expect(dayOfWeekOf(monday.clock.day)).toBe(1);
    expect(clockHoldOf(monday)).toBeNull();
    // A second press moves on past the Monday (the invite stays on HQ until its matchday).
    const past = advanceToNextStopFlow(monday);
    expect(past.clock.day).toBeGreaterThan(monday.clock.day);
    // Day by day: still offered on its matchday (and the matchday does not hold); gone the day after.
    let s = monday;
    while (s.clock.day < offer.day) s = stepDayForTests(s);
    expect(s.unofficialOffer?.id).toBe(offer.id);
    expect(clockHoldOf(s)).toBeNull();
    s = stepDayForTests(s);
    expect(s.clock.day).toBe(offer.day + 1);
    expect(s.unofficialOffer).toBeNull();
    expect(s.eventResults.some((r) => r.eventId === offer.id && r.rows.some((row) => row.ref === "user"))).toBe(false);
    // Accepted instead, its matchday holds (Play, or Pass explicitly).
    let accepted: CareerSave = { ...structuredClone(monday), pendingEventDef: offer };
    while (accepted.clock.day < offer.day) accepted = stepDayForTests(accepted);
    expect(clockHoldOf(accepted)?.kind).toBe("event");
    expect(advanceDayFlow(accepted)).toBe(accepted);
  });
});

describe("rc.34 UX-01a — Championship Sunday holds too", () => {
  /** The user's Major on its Saturday, paused after the Swiss (R40). */
  function pausedMajor(): CareerSave {
    let save = fresh(34_011);
    const MAJOR_W = 10;
    while (save.clock.day < firstDayOfWeek(MAJOR_W) - 1 && save.phase === "running") {
      const phase = save.activeEvent ? "active" : save.pendingEventDef && save.pendingEventDef.day === save.clock.day ? "lobby" : null;
      if (phase === "lobby") {
        const s = simEventToEnd(startEvent(save, false));
        save = s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
        continue;
      }
      if (phase === "active") {
        const s = simEventToEnd(save);
        save = s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
        continue;
      }
      if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
      save = stepDayForTests(save);
    }
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
    save = stepDayForTests(save); // Monday: the Major field, the user in it
    while (save.clock.day < eventDayFor(MAJOR_W)) save = stepDayForTests(save);
    for (const p of save.squad) p.overall = 80;
    const paused = simEventToEnd(startEvent(save, false));
    expect(isEventPaused(paused)).toBe(true);
    return paused;
  }

  it("a decision on the paused Saturday holds the move to Sunday; answered, Sunday opens", () => {
    const paused = pausedMajor();
    // With nothing due the pause does not hold: moving to Sunday is its answer.
    expect(clockHoldOf(paused)).toBeNull();
    expect(topDecisionOf(paused)?.kind).toBe("event");
    expect(continueKind(paused)).toBe("eventPaused");
    const withBid = { ...paused, pendingOffers: [bidFor(paused, 3)] };
    expect(continueEventToNextDayFlow(withBid)).toBe(withBid);
    expect(advanceToNextStopFlow(withBid)).toBe(withBid);
    expect(continueKind(withBid)).toBe("decision");
    // The bid comes first; the pause waits behind it.
    expect(pendingDecisionsOf(withBid).map((d) => d.kind)).toEqual(["bid", "event"]);
    const sunday = continueEventToNextDayFlow(declineBidFlow(withBid, "bid:test:1"));
    expect(sunday.clock.day).toBe(paused.clock.day + 1);
  });
});

describe("rc.34 decision 1-B — Later only for a bid and the sponsor offers, up to their deadline", () => {
  it("a bid parks until its last day, when the clock stops again; then only an answer moves it", () => {
    const base = fresh();
    const save = { ...base, pendingOffers: [bidFor(base, 3)] };
    const d = pendingDecisionsOf(save)[0];
    expect(d).toMatchObject({ kind: "bid", canWait: true, parked: false, holds: true });
    const parked = parkDecisionFlow(save, d.id);
    expect(parked.error).toBeUndefined();
    expect(parked.save.parkedDecisions).toEqual([d.id]);
    let s = parked.save;
    expect(pendingDecisionsOf(s)[0]).toMatchObject({ parked: true, holds: false });
    expect(clockHoldOf(s)).toBeNull();
    expect(continueKind(s)).toBe("advance");
    // Parked, the clock moves day by day up to the deadline…
    for (let i = 0; i < 3; i++) s = advanceDayFlow(s);
    expect(s.clock.day).toBe(base.clock.day + 3);
    // …where it stops: no "Later" any more, and walking on is refused.
    const due = pendingDecisionsOf(s)[0];
    expect(due).toMatchObject({ kind: "bid", canWait: false, parked: false, holds: true });
    expect(advanceDayFlow(s)).toBe(s);
    expect(parkDecisionFlow(s, due.id).error).toBe("cannotWait");
    // The answer — decline (or accept) — moves it; the bid never lapses on its own.
    const answered = declineBidFlow(s, due.id);
    expect(advanceDayFlow(answered).clock.day).toBe(s.clock.day + 1);
  });

  it("the sponsor offers park until the Sunday before the next split boundary; there: sign or decline", () => {
    const base = holding("sponsor").save;
    const d = pendingDecisionsOf(base).find((x) => x.kind === "sponsor")!;
    expect(d.deadline).toEqual({ seasonIndex: 0, day: splitEndDayFor(base.clock.day) });
    expect(d.canWait).toBe(true);
    let s = parkDecisionFlow(base, d.id).save;
    expect(clockHoldOf(s)).toBeNull();
    s = { ...s, clock: { ...s.clock, day: d.deadline!.day } };
    const due = pendingDecisionsOf(s).find((x) => x.kind === "sponsor")!;
    expect(due).toMatchObject({ canWait: false, holds: true, parked: false });
    expect(advanceDayFlow(s)).toBe(s);
    expect(advanceDayFlow(declineSponsorOffersFlow(s).save).clock.day).toBe(s.clock.day + 1);
  });

  it("no Later for anything else: insert, invite, a matchday, a short squad, a notice, the training proposal", () => {
    for (const kind of ["insert", "invite", "event", "squadShort", "notice", "training"] as DecisionKind[]) {
      const { save, restore } = holding(kind);
      try {
        const d = pendingDecisionsOf(save).find((x) => x.kind === kind)!;
        expect(d.canWait).toBe(false);
        expect(parkDecisionFlow(save, d.id).error).toBe("cannotWait");
      } finally {
        restore?.();
      }
    }
  });
});

describe("rc.34 — the queue's order: urgent first", () => {
  it("matchday · notice · short squad · due today · by deadline · parked", () => {
    const base = fresh();
    const save: CareerSave = {
      ...base,
      pendingInsert: { id: "ins-showmatch", day: base.clock.day },
      pendingOffers: [bidFor(base, 9, "bid:late"), bidFor(base, 4, "bid:soon")],
      sponsorOffers: sponsorOffersFor(30, 0, base.careerSeed, null, false, "normal"),
    };
    expect(pendingDecisionsOf(save).map((d) => d.id)).toEqual([
      `insert:ins-showmatch:0:${base.clock.day}`,
      "bid:soon",
      "bid:late",
      `sponsor:0:${splitEndDayFor(base.clock.day)}`,
    ]);
    // Parked ones go last; the top block shows the first that is not parked.
    const parked = parkDecisionFlow(save, "bid:soon").save;
    expect(pendingDecisionsOf(parked).map((d) => d.id).slice(-1)).toEqual(["bid:soon"]);
    expect(topDecisionOf(resolveInsertFlow(parked, "b").save)?.id).toBe("bid:late");
    // A notice outranks what is due today; a short squad's eve too.
    const was = DECISION_SOURCES.notice;
    DECISION_SOURCES.notice = () => ({ id: "notice:x" });
    try {
      expect(pendingDecisionsOf(save)[0].kind).toBe("notice");
    } finally {
      DECISION_SOURCES.notice = was;
    }
    const short = holding("squadShort", save).save;
    expect(pendingDecisionsOf(short)[0].kind).toBe("squadShort");
    // The matchday comes first of all.
    const matchday = { ...save, pendingEventDef: cupOn(save, save.clock.day) };
    expect(pendingDecisionsOf(matchday)[0].kind).toBe("event");
  });
});

describe("rc.34 (Miguel, 31/10) — a short squad can skip each regional", () => {
  /** A two-player squad, the clock on the eve of its first regional-week event (qualifier or regional). */
  function shortEve(): CareerSave {
    let save = fresh(34_021);
    while (save.clock.day < firstDayOfWeek(4)) save = stepDayForTests(save);
    const def = save.pendingEventDef!;
    expect(["qualifier", "regional"]).toContain(def.tier);
    save = structuredClone(save);
    save.squad = save.squad.slice(0, 2);
    syncSquadRoles(save);
    while (save.clock.day < def.day - 1) save = stepDayForTests(save);
    expect(squadHoldFor(save)?.id).toBe(def.id);
    return save;
  }

  it("skips: the clock moves on every path, the regional resolves without the user — no points, no prize", () => {
    const eve = shortEve();
    expect(advanceDayFlow(eve)).toBe(eve); // the hold (R67)
    expect(canSkipShortSquadEvent(eve)).toBe(true);
    const def = eve.pendingEventDef!;
    const skipped = skipShortSquadEventFlow(eve);
    expect(skipped.error).toBeUndefined();
    const s0 = skipped.save;
    expect(s0.pendingEventDef).toBeNull();
    expect(s0.news[0]).toMatchObject({ titleKey: "regionalSkipped", params: { n: 2 } });
    // Every clock path moves now.
    expect(clockHoldOf(s0)).toBeNull();
    expect(continueKind(s0)).toBe("advance");
    expect(advanceDayFlow(s0).clock.day).toBe(eve.clock.day + 1);
    expect(advanceDayFlow(reload(s0)).clock.day).toBe(eve.clock.day + 1);
    const pointsBefore = s0.competition.splitPoints.SAM?.user ?? 0;
    const prizeLines = (x: CareerSave) => x.finances.ledger.filter((l) => l.kind === "prize").length;
    // Through the weekend: the regional is on file, played without the user.
    const week = weekOfDay(def.day);
    const regional = officialEventDefsForWeek(0, week).find((d) => d.tier === "regional" && d.region === "SAM")!;
    let s = s0;
    while (s.clock.day <= regional.day && s.phase === "running") s = stepDayForTests(s);
    const res = s.eventResults.find((r) => r.eventId === regional.id)!;
    expect(res).toBeTruthy();
    expect(res.rows.some((r) => r.ref === "user")).toBe(false);
    const qual = qualifierDefsForWeek(0, week).find((d) => d.region === "SAM")!;
    const qRes = s.eventResults.find((r) => r.eventId === qual.id);
    if (qRes) expect(qRes.rows.some((r) => r.ref === "user")).toBe(false);
    expect(s.competition.splitPoints.SAM?.user ?? 0).toBe(pointsBefore);
    expect(prizeLines(s)).toBe(prizeLines(s0));
    // The batched Advance also runs on past the skipped weekend.
    expect(advanceToNextStopFlow(s0).clock.day).toBeGreaterThan(s0.clock.day);
  });

  /**
   * rc.34 review: the user's event on its OWN day, the squad short only now (the
   * day's arrival already passed the event over as the user's). `direct` commits
   * the week to Sunday's regional (a direct seat) instead of Saturday's qualifier.
   */
  function shortOnTheDay(direct: boolean): { save: CareerSave; def: CareerEventDef } {
    let save = fresh(34_023);
    while (save.clock.day < firstDayOfWeek(4)) save = stepDayForTests(save);
    if (direct) {
      save = structuredClone(save);
      save.pendingEventDef = officialEventDefsForWeek(0, 4).find((d) => d.tier === "regional" && d.region === "SAM")!;
    }
    const def = save.pendingEventDef!;
    expect(def.tier).toBe(direct ? "regional" : "qualifier");
    while (save.clock.day < def.day) save = stepDayForTests(save);
    expect(save.eventResults.some((r) => r.eventId === def.id)).toBe(false);
    save = structuredClone(save);
    save.squad = save.squad.slice(0, 2);
    syncSquadRoles(save);
    expect(canSkipShortSquadEvent(save)).toBe(true);
    return { save, def };
  }

  for (const direct of [false, true]) {
    it(`rc.34 review: skipped on its own day (${direct ? "Sunday's regional" : "Saturday's qualifier"}), it resolves for the region at once — once`, () => {
      const { save, def } = shortOnTheDay(direct);
      const s = skipShortSquadEventFlow(save).save;
      const res = s.eventResults.filter((r) => r.eventId === def.id);
      expect(res).toHaveLength(1);
      expect(res[0].rows.some((r) => r.ref === "user")).toBe(false);
      if (direct) {
        // Sunday's regional crowned a champion and paid the region's points — to everyone but the user.
        expect(res[0].rows.some((r) => r.placement === "champion")).toBe(true);
        const pts = s.competition.splitPoints.SAM ?? {};
        expect(Object.entries(pts).some(([ref, v]) => ref !== "user" && v > 0)).toBe(true);
        expect(pts.user ?? 0).toBe(save.competition.splitPoints.SAM?.user ?? 0);
      }
      // The clock moves on, and the weekend never resolves it twice.
      expect(clockHoldOf(s)).toBeNull();
      let t = s;
      while (t.clock.day <= def.day + 1 && t.phase === "running") t = stepDayForTests(t);
      expect(t.eventResults.filter((r) => r.eventId === def.id)).toHaveLength(1);
    });
  }

  it("the next regional asks again; a Major keeps the hold (sign first) and a cup keeps its Pass", () => {
    let s = skipShortSquadEventFlow(shortEve()).save;
    let guard = 0;
    while (!squadHoldFor(s) && guard++ < 60) s = stepDayForTests(s);
    expect(squadHoldFor(s)).not.toBeNull();
    expect(canSkipShortSquadEvent(s)).toBe(["qualifier", "regional"].includes(squadHoldFor(s)!.tier));
    const major = structuredClone(s);
    major.pendingEventDef = { ...officialEventDefsForWeek(0, 10).find((d) => d.tier === "major")!, day: s.clock.day + 1 };
    expect(squadHoldFor(major)).not.toBeNull();
    expect(canSkipShortSquadEvent(major)).toBe(false);
    expect(skipShortSquadEventFlow(major).error).toBe("none");
    const cup = structuredClone(s);
    cup.pendingEventDef = cupOn(cup, cup.clock.day + 1);
    expect(canSkipShortSquadEvent(cup)).toBe(false);
  });
});

describe("rc.34 UX-06b — the explicit contract review holds the rollover", () => {
  function atReview(): CareerSave {
    const save = fresh(34_031);
    save.phase = "seasonReview";
    save.clock = { seasonIndex: 0, day: DAYS_PER_SEASON };
    for (const p of save.squad) p.contractEndSeason = 1;
    save.squad[0].contractEndSeason = 0; // his deal ends with this season
    return save;
  }

  it("refused until the review is given; then the rollover runs and he leaves", () => {
    const save = atReview();
    const leaver = save.squad[0];
    expect(rolloverHoldOf(save)?.kind).toBe("contractReview");
    expect(continueToNextSeasonFlow(save)).toEqual({ save, error: "decisionPending" });
    expect(continueInfiniteFlow(save)).toBe(save);
    const reviewed = reviewContractsFlow(save);
    expect(reviewed.error).toBeUndefined();
    expect(rolloverHoldOf(reviewed.save)).toBeNull();
    const next = continueToNextSeasonFlow(reviewed.save);
    expect(next.error).toBeUndefined();
    expect(next.save.clock.seasonIndex).toBe(1);
    expect(next.save.squad.some((p) => p.id === leaver.id)).toBe(false);
  });

  it("a renewed player is off the list; with nobody leaving there is nothing to review", () => {
    const save = atReview();
    const renewed = renewPlayerFlow(save, save.squad[0].id, 2);
    expect(renewed.error).toBeUndefined();
    expect(rolloverHoldOf(renewed.save)).toBeNull();
    expect(continueToNextSeasonFlow(renewed.save).save.clock.seasonIndex).toBe(1);
  });

  it("a bid on its last day holds the rollover too, until answered", () => {
    const save = reviewContractsFlow(atReview()).save;
    const withBid = { ...save, pendingOffers: [{ ...bidFor(save, 0), resolveDay: DAYS_PER_SEASON }] };
    expect(rolloverHoldOf(withBid)?.kind).toBe("bid");
    expect(continueToNextSeasonFlow(withBid).error).toBe("decisionPending");
    expect(continueToNextSeasonFlow(declineBidFlow(withBid, "bid:test:1")).error).toBeUndefined();
  });
});

describe("rc.34 UX-06b — the reminders before a player can leave", () => {
  it("W28 and W31 Mondays name who is still out of contract and the weeks left; a renewed player is not named", () => {
    let save = fresh(34_041);
    save.squad[0].contractEndSeason = 0;
    save.squad[1].contractEndSeason = 0;
    save = renewPlayerFlow(save, save.squad[1].id, 2).save;
    const leaver = save.squad[0].name;
    const kept = save.squad[1].name;
    // Straight to the eve of W28 (the day machine runs from there).
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(28) - 1 };
    save.pendingEventDef = null;
    let s = advanceDayFlow(walkPastForTests(save));
    expect(s.clock.day).toBe(firstDayOfWeek(28));
    const w28 = s.news.find((n) => n.titleKey === "contractReminder");
    expect(w28?.params).toMatchObject({ players: leaver, n: 1, weeks: 5 });
    expect(String(w28?.params?.players)).not.toContain(kept);
    expect(s.mail.some((m) => m.titleKey === "contractReminder" && m.linkTo === "/career/squad")).toBe(true);
    s = { ...s, clock: { seasonIndex: 0, day: firstDayOfWeek(31) - 1 }, pendingEventDef: null };
    s = advanceDayFlow(walkPastForTests(s));
    expect(s.news.find((n) => n.titleKey === "contractReminder")?.params).toMatchObject({ weeks: 2 });
  });
});

describe("rc.34 — the arc bot answers every decision the queue holds for (no softlock)", () => {
  it("a full season and the rollover through the review", { timeout: 120_000 }, () => {
    const arc = playArcCareer({ region: "EU", difficulty: "normal", policy: "tuned", seed: 34_051, seasons: 2 });
    expect(arc.softlock).toBeNull();
    expect(arc.seasons).toHaveLength(2);
  });
});

describe("rc.34 — test support stays out of the app", () => {
  it("no app file imports careerClockForTests", () => {
    const appSources = (dir = "src"): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const path = join(dir, e.name);
        if (e.isDirectory()) return appSources(path);
        return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
      });
    const importers = appSources().filter((f) => !f.endsWith("careerClockForTests.ts") && readFileSync(f, "utf8").includes("careerClockForTests"));
    expect(importers).toEqual([]);
  });
});
