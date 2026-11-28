/**
 * v2.3 MEDIA: the store side. Flag off = the save untouched and the career
 * unchanged over a few advanced weeks; flag on = offers reach the inbox on the
 * weekly tick, an accepted trip books its cash once and rules the player out
 * of the committed event inside its days (the absence system), a declined or
 * lapsed offer changes nothing else, repeat fatigue costs morale only with the
 * locker room on.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_MEDIA as M, FEATURES } from "@/config/balance";
import { eventEndDayFor, firstDayOfWeek, officialEventDefsForWeek, qualifierDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { moraleOf } from "@/engine/career/lockerRoom";
import { addOffer, awayOn, absWeekOf, openOffersOf, type MediaOffer } from "@/engine/career/mediaDays";
import type { CareerSave } from "@/engine/career/types";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { resolveMail } from "@/components/career/news/newsText";
import { stepDayForTests } from "./careerClockForTests";
import { createCareerSave, finishEvent, resolveInsertFlow, ruledOutFor, simEventToEnd, startEvent, userTeamForEvent, type CreateCareerInput } from "./careerFlow";
import { answerMediaOfferFlow, mediaDaysAfter } from "./mediaDaysFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Media Org",
    abbrev: "MED",
    managerName: "Bot",
    country: "BR",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

function fresh(seed = 23_101): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:0:${w}`] = true;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  save.reputation = 60;
  return save;
}

const F = FEATURES as Record<string, unknown>;
const chance = M.chance as { base: number; max: number };
const saved = { base: chance.base, max: chance.max };
const sure = (on: boolean) => {
  chance.base = on ? 1 : saved.base;
  chance.max = on ? 1 : saved.max;
};
afterEach(() => {
  F.mediaDays = false;
  F.lockerRoom = false;
  sure(false);
});

/** Walk `days` days through the real flows (events simmed), running the store's hook after each write when `hook`. */
function walk(start: CareerSave, days: number, hook: boolean): CareerSave {
  let save = start;
  const target = save.clock.day + days;
  let guard = 0;
  while (save.clock.day < target && save.phase === "running" && guard++ < days * 12) {
    const prev = save;
    const lobby = !save.activeEvent && save.pendingEventDef?.day === save.clock.day;
    if (lobby || save.activeEvent) {
      const s = simEventToEnd(lobby ? startEvent(save, false) : save);
      save = s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
      if (save === prev) save = stepDayForTests(save);
    } else if (save.pendingInsert && save.pendingInsert.day === save.clock.day) {
      save = resolveInsertFlow(save, "b").save;
    } else {
      save = stepDayForTests(save);
    }
    if (hook && save !== prev) mediaDaysAfter(prev, save);
  }
  return save;
}

const ledgerOf = (s: CareerSave) => s.finances.ledger.filter((e) => e.kind === "mediaDay");
/** The Monday of week 4: the first Monday tick the hooked walk sees. */
const toEve = () => walk(fresh(), 20, false);

describe("flag off", () => {
  it("writes nothing and plays exactly as without the hook over six weeks", () => {
    expect(FEATURES.mediaDays).toBe(false);
    const plain = walk(fresh(), 42, false);
    const hooked = walk(fresh(), 42, true);
    expect(hooked).not.toHaveProperty("mediaDays");
    expect(JSON.stringify(hooked)).toBe(JSON.stringify(plain));
    expect(answerMediaOfferFlow(plain, "media:1", true).error).toBe("unknown");
    // Even with an offer on file and the chance at 100 %, the hook does nothing while the flag is off.
    sure(true);
    const prev = structuredClone(plain);
    const next = structuredClone(plain);
    next.clock = { ...next.clock, day: next.clock.day + 7 };
    const before = JSON.stringify(next);
    mediaDaysAfter(prev, next);
    expect(JSON.stringify(next)).toBe(before);
  }, 120_000);
});

describe("flag on: the weekly tick", () => {
  it("brings offers to the inbox, deterministically, and their mail resolves in both languages", () => {
    F.mediaDays = true;
    sure(true);
    const a = walk(toEve(), 14, true);
    expect(a.mediaDays).toBeDefined();
    expect(a.mediaDays!.offers.length).toBeGreaterThan(0);
    const mails = a.mail.filter((m) => m.titleKey === "mediaOffer");
    expect(mails.length).toBe(a.mediaDays!.offers.length);
    for (const m of mails) {
      for (const C of [CAREER_EN, CAREER_PT]) {
        const r = resolveMail(m, C);
        expect(r.title).not.toBe("mediaOffer");
        expect(r.body).not.toContain("undefined");
        expect(r.body).not.toContain("NaN");
      }
      expect(m.params?.offerId).toBeTruthy();
      expect(a.squad.map((p) => p.name)).toContain(m.params?.player);
    }
    // Nothing answered: nothing paid, nobody away.
    expect(ledgerOf(a)).toHaveLength(0);
    expect(a.mediaDays!.away).toHaveLength(0);
    // Same career, same offers.
    const b = walk(toEve(), 14, true);
    expect(JSON.stringify(b.mediaDays)).toBe(JSON.stringify(a.mediaDays));
  }, 120_000);
});

describe("answering", () => {
  /** Week 4's Monday with one open offer (the chance forced to 100 %). */
  function withOpenOffer() {
    F.mediaDays = true;
    sure(true);
    const s1 = walk(toEve(), 1, true);
    const offer = openOffersOf(s1.mediaDays)[0];
    expect(offer).toBeDefined();
    return { s1, offer };
  }

  it("accept: away exactly the days, the cash booked once with a named line; he is back after", () => {
    const { s1, offer } = withOpenOffer();
    const out = answerMediaOfferFlow(s1, offer.id, true);
    expect(out.error).toBeUndefined();
    let save = out.save;
    expect(save.mediaDays!.offers.find((o) => o.id === offer.id)!.status).toBe("accepted");
    const startBalance = save.finances.balance;
    expect(ledgerOf(save)).toHaveLength(0);
    for (let guard = 0; save.clock.day < offer.to + 3 && guard < 20; guard++) {
      save = walk(save, 1, true);
      const d = save.clock.day;
      expect(awayOn(save.mediaDays, offer.playerId, save.clock.seasonIndex, d), `day ${d}`).toBe(d >= offer.from && d <= offer.to);
      expect(ledgerOf(save), `day ${d}`).toHaveLength(d >= offer.from ? 1 : 0);
    }
    const line = ledgerOf(save)[0];
    expect(line.amount).toBe(offer.cash);
    expect(line.refName).toBe(CAREER_EN.media.brands[offer.brand]);
    expect(CAREER_EN.finances.ledgerKind.mediaDay).toBe("Media day");
    expect(save.finances.balance).not.toBe(startBalance);
    expect(save.mediaDays!.away).toHaveLength(0);
    expect(save.mediaDays!.trips).toHaveLength(1);
  }, 180_000);

  it("decline and lapse change nothing else", () => {
    const { s1, offer } = withOpenOffer();
    const d = answerMediaOfferFlow(s1, offer.id, false).save;
    expect(d.mediaDays!.offers.find((o) => o.id === offer.id)!.status).toBe("declined");
    expect({ ...d, mediaDays: undefined }).toEqual({ ...s1, mediaDays: undefined });
    const days = offer.deadline - s1.clock.day + 3;
    const declined = walk(d, days, true);
    const lapsed = walk(s1, days, true);
    expect(lapsed.mediaDays!.offers.find((o) => o.id === offer.id)!.status).toBe("lapsed");
    expect(declined.mediaDays!.offers.find((o) => o.id === offer.id)!.status).toBe("declined");
    for (const s of [declined, lapsed]) {
      expect(ledgerOf(s)).toHaveLength(0);
      expect(s.mediaDays!.away).toHaveLength(0);
      expect(s.pendingUnavailability?.reason).not.toBe("media");
    }
    expect(JSON.stringify({ ...declined, mediaDays: undefined, mail: undefined })).toBe(JSON.stringify({ ...lapsed, mediaDays: undefined, mail: undefined }));
  }, 180_000);

  it("refuses a late answer and a second answer", () => {
    const { s1, offer } = withOpenOffer();
    const late = structuredClone(s1);
    late.clock = { ...late.clock, day: offer.deadline + 1 };
    expect(answerMediaOfferFlow(late, offer.id, true).error).toBe("late");
    const done = answerMediaOfferFlow(s1, offer.id, false).save;
    expect(answerMediaOfferFlow(done, offer.id, true).error).toBe("answered");
  }, 120_000);
});

/** A save on the Monday of the first regional week, with `pendingEventDef` set to his region's regional. */
function regionalWeek() {
  const week = seasonSchedule().find((w) => w.kind === "regional")!.week;
  const def = officialEventDefsForWeek(0, week).find((d) => d.region === "EU")!;
  const monday = firstDayOfWeek(week);
  const save = fresh();
  // A registered reserve: the fresh squad has three players, and a club of three is never offered an event date.
  if (save.squad.length < 4) save.squad.push({ ...structuredClone(save.squad[0]), id: "reserve:test", name: "Reserve Test", role: "sub" });
  save.starterIds = save.starterIds.slice(0, 3) as CareerSave["starterIds"];
  save.clock = { ...save.clock, day: monday };
  save.pendingEventDef = def;
  return { save, def, week, monday };
}

describe("events inside the days", () => {
  it("accept rules the player out of the committed event through the absence system; he does not play it", () => {
    F.mediaDays = true;
    const { save, def, monday } = regionalWeek();
    expect(save.squad.length).toBeGreaterThanOrEqual(4);
    const playerId = save.starterIds[0];
    const offer: Omit<MediaOffer, "id" | "status"> = {
      brand: 2, playerId, seasonIndex: 0, made: monday, from: def.day - 1, to: def.day, deadline: def.day - 2, cash: 1_000,
      events: [{ id: def.id, name: def.name }],
    };
    const added = addOffer(null, offer, absWeekOf(0, monday));
    save.mediaDays = added.state;
    const out = answerMediaOfferFlow(save, added.offer.id, true);
    expect(out.error).toBeUndefined();
    expect(out.save.pendingUnavailability).toEqual({ playerId, eventId: def.id, reason: "media" });
    expect(ruledOutFor(out.save, def)?.id).toBe(playerId);
    expect(userTeamForEvent(out.save, def).fieldedIds).not.toContain(playerId);
    expect(CAREER_EN.hub.absenceReasons.media).toBe("a media day");
  });

  it("a seat already taken by another player cancels the trip and nothing is paid", () => {
    F.mediaDays = true;
    const { save, def, monday } = regionalWeek();
    const [playerId, other] = save.starterIds;
    save.pendingUnavailability = { playerId: other, eventId: def.id, reason: "illness" };
    const added = addOffer(null, { brand: 0, playerId, seasonIndex: 0, made: monday, from: def.day - 1, to: def.day, deadline: def.day - 2, cash: 1_000, events: [{ id: def.id, name: def.name }] }, absWeekOf(0, monday));
    save.mediaDays = added.state;
    const out = answerMediaOfferFlow(save, added.offer.id, true);
    expect(out.save.pendingUnavailability).toEqual({ playerId: other, eventId: def.id, reason: "illness" });
    expect(out.save.mediaDays!.offers[0].status).toBe("cancelled");
    expect(out.save.mediaDays!.away).toHaveLength(0);
    expect(out.save.mail.some((m) => m.titleKey === "mediaCalledOff")).toBe(true);
    expect(ledgerOf(out.save)).toHaveLength(0);
  });

  /** Scan seeds for the offers a regional week's Monday rolls. */
  function offersAcrossSeeds(prepare: (s: CareerSave) => void) {
    F.mediaDays = true;
    sure(true);
    const out: MediaOffer[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const { save, monday } = regionalWeek();
      save.careerSeed = seed;
      save.pendingEventDef = null;
      prepare(save);
      const prev = structuredClone(save);
      prev.clock = { ...prev.clock, day: monday - 1 };
      mediaDaysAfter(prev, save);
      out.push(...(save.mediaDays?.offers ?? []));
    }
    return out;
  }

  it("names the event the days contain, and only that", () => {
    const week = seasonSchedule().find((w) => w.kind === "regional")!.week;
    const quals = qualifierDefsForWeek(0, week).filter((d) => d.region === "EU");
    const defs = [...quals, ...officialEventDefsForWeek(0, week).filter((d) => d.region === "EU")];
    const offers = offersAcrossSeeds(() => undefined);
    expect(offers.length).toBeGreaterThan(10);
    let named = 0;
    for (const o of offers) {
      const inside = defs.filter((d) => (d.day >= o.from && d.day <= o.to) || (eventEndDayFor(d) >= o.from && eventEndDayFor(d) <= o.to));
      // The qualifier is his only when the seeding sends him through it; the regional is always his.
      const ids = o.events.map((e) => e.id);
      expect(ids.filter((id) => !quals.some((q) => q.id === id)).sort()).toEqual(inside.filter((d) => !quals.includes(d)).map((d) => d.id).sort());
      for (const id of ids) expect(inside.some((d) => d.id === id)).toBe(true);
      for (const e of o.events) expect(defs.find((d) => d.id === e.id)!.name).toBe(e.name);
      if (o.events.length) named++;
    }
    expect(named).toBeGreaterThan(0);
  }, 120_000);

  it("never offers a club of three a date with an event (no reserve to cover the seat)", () => {
    const offers = offersAcrossSeeds((s) => {
      s.squad = s.squad.filter((p) => s.starterIds.includes(p.id));
    });
    expect(offers.length).toBeGreaterThan(5);
    for (const o of offers) expect(o.events).toEqual([]);
  }, 120_000);
});

describe("M4: repeat fatigue and the locker room", () => {
  function twice(lockerOn: boolean) {
    F.mediaDays = true;
    F.lockerRoom = lockerOn;
    const { save, monday } = regionalWeek();
    save.pendingEventDef = null;
    const playerId = save.starterIds[1];
    const wk = absWeekOf(0, monday);
    const mk = (from: number, brand: number) => ({ brand, playerId, seasonIndex: 0, made: monday, from, to: from + 1, deadline: from - 1, cash: 500, events: [] as { id: string; name: string }[] });
    const first = addOffer(null, mk(monday + 3, 1), wk);
    save.mediaDays = first.state;
    const afterFirst = answerMediaOfferFlow(save, first.offer.id, true).save;
    const second = addOffer(afterFirst.mediaDays, mk(monday + 10, 4), wk + 1);
    afterFirst.mediaDays = second.state;
    const moraleBefore = moraleOf(afterFirst.lockerRoom, playerId);
    const afterSecond = answerMediaOfferFlow(afterFirst, second.offer.id, true).save;
    return { playerId, firstSave: afterFirst, moraleBefore, afterSecond };
  }

  it("lowers his morale with a visible reason when the locker room is on", () => {
    const { playerId, moraleBefore, afterSecond, firstSave } = twice(true);
    expect(firstSave.lockerRoom).toBeUndefined();
    expect(moraleBefore).toBe(50);
    expect(moraleOf(afterSecond.lockerRoom, playerId)).toBe(50 - M.fatigue.morale);
    expect(afterSecond.lockerRoom!.players[playerId].last).toMatchObject({ reason: "mediaFatigue", delta: -M.fatigue.morale });
    expect(afterSecond.lockerRoom!.log[0]).toMatchObject({ playerId, reason: "mediaFatigue" });
    expect(CAREER_EN.locker.reasons.mediaFatigue).toBeTruthy();
  });

  it("has no effect when the locker room is off", () => {
    const { afterSecond } = twice(false);
    expect(afterSecond).not.toHaveProperty("lockerRoom");
    expect(afterSecond.mediaDays!.trips).toHaveLength(2);
  });

  it("a trip outside the fatigue window costs nothing", () => {
    F.mediaDays = true;
    F.lockerRoom = true;
    const { save, monday } = regionalWeek();
    save.pendingEventDef = null;
    const playerId = save.starterIds[1];
    const mk = (from: number) => ({ brand: 1, playerId, seasonIndex: 0, made: monday, from, to: from + 1, deadline: from - 1, cash: 500, events: [] as { id: string; name: string }[] });
    const first = addOffer(null, mk(monday + 3), absWeekOf(0, monday));
    save.mediaDays = first.state;
    const afterFirst = answerMediaOfferFlow(save, first.offer.id, true).save;
    const far = addOffer(afterFirst.mediaDays, mk(monday + 3 + 7 * (M.fatigue.weeks + 2)), absWeekOf(0, monday) + 1);
    afterFirst.mediaDays = far.state;
    const out = answerMediaOfferFlow(afterFirst, far.offer.id, true).save;
    expect(out.lockerRoom).toBeUndefined();
  });
});
