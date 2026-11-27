/**
 * v2.3 MEDIA: the rules of media days, pure. M1 the roll (seeded, who, how
 * much, which days), M2 the events named and the lapse, M3 never short for an
 * event, M4 the repeat record, M5 the cash against a sponsor's week.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_MEDIA as M } from "@/config/balance";
import { weekOfDay } from "./calendar";
import {
  absWeekOf,
  acceptOffer,
  addOffer,
  awayOn,
  cancelAway,
  dueAway,
  emptyMediaDays,
  lapseOffers,
  leavesEnough,
  mediaCashFor,
  offerChanceOf,
  openOffersOf,
  recentTripOf,
  rollMediaOffer,
  settleAway,
  sponsorTierOfRep,
  declineOffer,
  type MediaEventRef,
  type MediaRollContext,
  type MediaSquadMember,
} from "./mediaDays";
import { tierValuePerWeek } from "./sponsorDeals";

const SQUAD4: MediaSquadMember[] = [
  { id: "a", overall: 80, starter: true, role: "starter" },
  { id: "b", overall: 76, starter: true, role: "starter" },
  { id: "c", overall: 72, starter: true, role: "starter" },
  { id: "d", overall: 60, starter: false, role: "sub" },
];
const SQUAD3 = SQUAD4.slice(0, 3);

const DAY = 8 * 7 + 1; // the Monday of week 9
const ctxOf = (over: Partial<MediaRollContext> = {}): MediaRollContext => ({
  careerSeed: 1234,
  seasonIndex: 1,
  day: DAY,
  reputation: 60,
  difficulty: "normal",
  followers: null,
  squad: SQUAD4,
  state: null,
  eventOnDay: () => null,
  outForEvent: () => [],
  ...over,
});

/** Roll every Monday of a season until an offer comes (the chance is a roll, so scan weeks). */
function firstOffer(over: Partial<MediaRollContext> = {}, from = 4, to = 32) {
  for (let w = from; w <= to; w++) {
    const day = (w - 1) * CAREER_CALENDAR.daysPerWeek + 1;
    const rolled = rollMediaOffer(ctxOf({ ...over, day }));
    if (rolled) return { rolled, day };
  }
  return null;
}

describe("M1: the roll", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = firstOffer();
    const b = firstOffer();
    expect(a).not.toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const others = [1, 2, 3, 4, 5, 6].map((careerSeed) => JSON.stringify(firstOffer({ careerSeed })));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it("offers a player of the squad 2 to 4 days, a start inside the window, a deadline the day before it", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const hit = firstOffer({ careerSeed: seed, reputation: 100 });
      if (!hit) continue;
      const o = hit.rolled;
      expect(SQUAD4.some((p) => p.id === o.playerId)).toBe(true);
      const days = o.to - o.from + 1;
      expect(days).toBeGreaterThanOrEqual(M.days.min);
      expect(days).toBeLessThanOrEqual(M.days.max);
      expect(o.from - hit.day).toBeGreaterThanOrEqual(M.startOffset.min);
      expect(o.from - hit.day).toBeLessThanOrEqual(M.startOffset.max);
      expect(o.deadline).toBe(o.from - 1);
      expect(o.deadline).toBeGreaterThan(hit.day);
      expect(o.brand).toBeGreaterThanOrEqual(0);
      expect(o.brand).toBeLessThan(M.brands);
      expect(o.cash).toBeGreaterThan(0);
    }
  });

  it("is likelier with reputation, and with followers when the feed is on", () => {
    expect(offerChanceOf(0, null)).toBeLessThan(offerChanceOf(50, null));
    expect(offerChanceOf(50, null)).toBeLessThan(offerChanceOf(100, null));
    expect(offerChanceOf(100, null)).toBeLessThanOrEqual(M.chance.max);
    expect(offerChanceOf(50, 4_000)).toBeGreaterThan(offerChanceOf(50, 400));
    expect(offerChanceOf(50, 400)).toBeGreaterThan(offerChanceOf(50, null));
    const count = (rep: number) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) if (rollMediaOffer(ctxOf({ careerSeed: seed, reputation: rep }))) n++;
      return n;
    };
    expect(count(100)).toBeGreaterThan(count(0));
  });

  it("waits for week 3, one open offer at a time and the cooldown", () => {
    const early = (seed: number) => rollMediaOffer(ctxOf({ careerSeed: seed, day: 1, reputation: 100 }));
    for (let seed = 1; seed <= 200; seed++) expect(early(seed)).toBeNull();
    let seed = 0;
    let rolled = null;
    while (!rolled && seed < 500) rolled = rollMediaOffer(ctxOf({ careerSeed: ++seed, reputation: 100 }));
    expect(rolled).not.toBeNull();
    const { state } = addOffer(null, rolled!, absWeekOf(1, DAY));
    expect(openOffersOf(state)).toHaveLength(1);
    for (let s = 1; s <= 200; s++) expect(rollMediaOffer(ctxOf({ careerSeed: s, reputation: 100, state }))).toBeNull();
    // Answered: still inside the cooldown this week and the next ones.
    const declined = declineOffer(state, state.offers[0].id).state;
    for (let s = 1; s <= 200; s++) expect(rollMediaOffer(ctxOf({ careerSeed: s, reputation: 100, state: declined, day: DAY + 7 * M.cooldownWeeks }))).toBeNull();
  });
});

describe("M2: events named, lapse", () => {
  // An event every Saturday and Sunday of every week, so every window of 4 days holds one.
  const weekend = (day: number): MediaEventRef | null => {
    const dow = ((day - 1) % 7) + 1;
    return dow === 6 || dow === 7 ? { id: `evt:${weekOfDay(day)}:${dow}`, name: `Event W${weekOfDay(day)}${dow === 6 ? "a" : "b"}` } : null;
  };

  it("names exactly the events inside the days (and none when none falls there)", () => {
    let named = 0;
    let bare = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const hit = firstOffer({ careerSeed: seed, reputation: 100, eventOnDay: weekend });
      if (!hit) continue;
      const o = hit.rolled;
      const expected: string[] = [];
      for (let d = o.from; d <= o.to; d++) {
        const e = weekend(d);
        if (e && !expected.includes(e.id)) expected.push(e.id);
      }
      expect(o.events.map((e) => e.id)).toEqual(expected);
      for (const e of o.events) expect(e.name).toMatch(/^Event W\d+[ab]$/);
      if (expected.length) named++;
      else bare++;
    }
    expect(named).toBeGreaterThan(0);
    expect(bare).toBeGreaterThan(0);
  });

  it("closes unanswered offers as declined after the deadline, never before", () => {
    const hit = firstOffer({ reputation: 100 })!;
    const { state, offer } = addOffer(null, hit.rolled, absWeekOf(1, hit.day));
    const onDeadline = lapseOffers(state, { seasonIndex: 1, day: offer.deadline });
    expect(onDeadline.lapsed).toHaveLength(0);
    expect(onDeadline.state).toBe(state);
    const after = lapseOffers(state, { seasonIndex: 1, day: offer.deadline + 1 });
    expect(after.lapsed.map((o) => o.id)).toEqual([offer.id]);
    expect(after.state.offers[0].status).toBe("lapsed");
    expect(after.state.away).toEqual([]);
    expect(after.state.trips).toEqual([]);
    // A later season lapses it too.
    expect(lapseOffers(state, { seasonIndex: 2, day: 1 }).lapsed).toHaveLength(1);
  });
});

describe("M3: never short for an event", () => {
  it("leavesEnough: a starter's seat needs a reserve, and three must remain", () => {
    expect(leavesEnough(SQUAD4, "a")).toBe(true);
    expect(leavesEnough(SQUAD4, "d")).toBe(true);
    expect(leavesEnough(SQUAD3, "a")).toBe(false);
    expect(leavesEnough(SQUAD4, "a", ["d"])).toBe(false);
    // Four players, none registered as a reserve: a starter out leaves the seat uncovered.
    const noSub: MediaSquadMember[] = SQUAD4.map((p) => ({ ...p, role: "starter" as const }));
    expect(leavesEnough(noSub, "a")).toBe(false);
    expect(leavesEnough(SQUAD4, "nobody")).toBe(false);
  });

  it("never offers a date with an event to a club that would be left short, but still offers an event-free date", () => {
    const always = () => ({ id: "e", name: "E" });
    for (let seed = 1; seed <= 300; seed++) {
      const withEvents = firstOffer({ careerSeed: seed, reputation: 100, squad: SQUAD3, eventOnDay: always });
      expect(withEvents).toBeNull();
    }
    // The same club offered nothing on event days is offered something when the days are free.
    expect([1, 2, 3, 4, 5, 6, 7, 8].some((seed) => firstOffer({ careerSeed: seed, reputation: 100, squad: SQUAD3 }) !== null)).toBe(true);
  });

  it("refuses a date over an event another player is already out for, or a trip is already booked over", () => {
    const always = () => ({ id: "e", name: "E" });
    for (let seed = 1; seed <= 200; seed++) {
      expect(firstOffer({ careerSeed: seed, reputation: 100, eventOnDay: always, outForEvent: () => ["b"] })).toBeNull();
    }
    const booked = { ...emptyMediaDays(), away: [{ offerId: "x", playerId: "b", seasonIndex: 1, from: 1, to: 300, cash: 1, brand: 0, eventIds: ["e"], paid: false }] };
    for (let seed = 1; seed <= 200; seed++) {
      expect(firstOffer({ careerSeed: seed, reputation: 100, eventOnDay: always, state: booked })).toBeNull();
    }
  });
});

describe("accept, decline", () => {
  const make = () => {
    const hit = firstOffer({ reputation: 100 })!;
    const { state, offer } = addOffer(null, hit.rolled, absWeekOf(1, hit.day));
    return { state, offer, hit };
  };

  it("accept: away exactly those days, cash due only from the first day, once", () => {
    const { state, offer, hit } = make();
    const ids = SQUAD4.map((p) => p.id);
    const out = acceptOffer(state, offer.id, { seasonIndex: 1, day: hit.day + 1 }, ids);
    expect(out.error).toBeUndefined();
    expect(out.state.offers[0].status).toBe("accepted");
    for (let d = offer.from - 3; d <= offer.to + 3; d++) {
      expect(awayOn(out.state, offer.playerId, 1, d), `day ${d}`).toBe(d >= offer.from && d <= offer.to);
    }
    expect(awayOn(out.state, offer.playerId, 2, offer.from)).toBe(false);
    const other = SQUAD4.find((p) => p.id !== offer.playerId)!.id;
    expect(awayOn(out.state, other, 1, offer.from)).toBe(false);
    expect(dueAway(out.state, { seasonIndex: 1, day: offer.from - 1 })).toHaveLength(0);
    const due = dueAway(out.state, { seasonIndex: 1, day: offer.from });
    expect(due).toHaveLength(1);
    expect(due[0].cash).toBe(offer.cash);
    const paid = settleAway(out.state, due.map((a) => a.offerId), { seasonIndex: 1, day: offer.from });
    expect(dueAway(paid, { seasonIndex: 1, day: offer.to })).toHaveLength(0);
    // Once over and paid, the trip is dropped; the record of the trip stays.
    const over = settleAway(paid, [], { seasonIndex: 1, day: offer.to + 1 });
    expect(over.away).toHaveLength(0);
    expect(over.trips).toHaveLength(1);
  });

  it("accept refuses a late answer, an answered offer and a player who left; decline changes only the status", () => {
    const { state, offer } = make();
    const ids = SQUAD4.map((p) => p.id);
    expect(acceptOffer(state, offer.id, { seasonIndex: 1, day: offer.deadline + 1 }, ids).error).toBe("late");
    expect(acceptOffer(state, offer.id, { seasonIndex: 1, day: offer.made }, ids.filter((i) => i !== offer.playerId)).error).toBe("gone");
    expect(acceptOffer(state, "nope", { seasonIndex: 1, day: offer.made }, ids).error).toBe("unknown");
    const declined = declineOffer(state, offer.id);
    expect(declined.state.offers[0].status).toBe("declined");
    expect({ ...declined.state, offers: [] }).toEqual({ ...state, offers: [] });
    expect(declineOffer(declined.state, offer.id).error).toBe("answered");
    expect(acceptOffer(declined.state, offer.id, { seasonIndex: 1, day: offer.made }, ids).error).toBe("answered");
  });

  it("cancelAway drops the trip and cancels the offer", () => {
    const { state, offer } = make();
    const acc = acceptOffer(state, offer.id, { seasonIndex: 1, day: offer.made }, SQUAD4.map((p) => p.id));
    const c = cancelAway(acc.state, offer.id);
    expect(c.away).toHaveLength(0);
    expect(c.offers[0].status).toBe("cancelled");
  });
});

describe("M4: the repeat record", () => {
  it("flags a second trip inside the fatigue window and not outside it", () => {
    const hit = firstOffer({ reputation: 100 })!;
    const { state, offer } = addOffer(null, hit.rolled, absWeekOf(1, hit.day));
    const ids = SQUAD4.map((p) => p.id);
    const first = acceptOffer(state, offer.id, { seasonIndex: 1, day: hit.day }, ids);
    expect(first.tired).toBe(false);
    const wk = absWeekOf(1, offer.from);
    expect(recentTripOf(first.state, offer.playerId, wk + M.fatigue.weeks)).toBe(M.fatigue.weeks);
    expect(recentTripOf(first.state, offer.playerId, wk + M.fatigue.weeks + 1)).toBeNull();
    expect(recentTripOf(first.state, "someone else", wk)).toBeNull();
    // A second offer for the same player inside the window arrives marked tired and accepting it reports tired.
    const again = { ...hit.rolled, playerId: offer.playerId, from: offer.from + 14, to: offer.from + 15, deadline: offer.from + 13, made: offer.from + 7 };
    const second = addOffer(first.state, again, absWeekOf(1, offer.from + 7));
    const acc2 = acceptOffer(second.state, second.offer.id, { seasonIndex: 1, day: offer.from + 8 }, ids);
    expect(acc2.tired).toBe(true);
  });
});

describe("M5: the cash", () => {
  it("is about one week of the sponsor tier the reputation reaches, never a prize", () => {
    for (const rep of [0, 24, 25, 50, 75, 100]) {
      const tier = sponsorTierOfRep(rep);
      const week = tierValuePerWeek(tier, 1, "normal");
      const cash = mediaCashFor({ reputation: rep, seasonIndex: 1, difficulty: "normal", days: 3, spread: 0 });
      expect(cash).toBeLessThanOrEqual(week);
      expect(cash).toBeGreaterThan(week * 0.9 - 20);
      const hi = mediaCashFor({ reputation: rep, seasonIndex: 1, difficulty: "normal", days: 4, spread: 1 });
      const lo = mediaCashFor({ reputation: rep, seasonIndex: 1, difficulty: "normal", days: 2, spread: -1 });
      expect(hi).toBeLessThan(week * 1.5);
      expect(lo).toBeGreaterThan(week * 0.6 - 20);
    }
    expect(sponsorTierOfRep(0)).toBe(1);
    expect(sponsorTierOfRep(100)).toBe(4);
  });
});
