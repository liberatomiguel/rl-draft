/**
 * Season clock tests: 32-week schedule shape, the v0.2 day clock (224 days,
 * Monday-start weeks, real calendar dates), the v2.0 (R40) weekend (qualifier
 * Saturday → regional Sunday; Major/Worlds Swiss Saturday → playoffs Sunday),
 * the stable event-id grammar, unofficial-offer gating and the batched-advance
 * stop days. Dataset-agnostic — everything derives from balance config.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_CALENDAR,
  CAREER_QUALIFIER,
  CAREER_SEASONS,
  CAREER_SLOTS,
  CAREER_TRAINING,
  CAREER_UNOFFICIAL,
} from "@/config/balance";
import { T2_EVENT_NAMES, T3_EVENT_NAMES } from "@/data/career/names";
import type { Region } from "../types";
import {
  DAYS_PER_SEASON,
  dateOfDay,
  dayOfWeekOf,
  eventDayFor,
  eventEndDayFor,
  eventIdFor,
  firstDayOfWeek,
  isTrainingDay,
  isTwoDayEvent,
  isWindowStartWeek,
  isWindowWeek,
  officialEventDefsForWeek,
  orderFor,
  playoffsDayFor,
  qualifierDayFor,
  qualifierDefsForWeek,
  regionalDayFor,
  regionalForQualifier,
  seasonIdFor,
  seasonLabelFor,
  seasonSchedule,
  splitOfWeek,
  unofficialOfferFor,
  weekAt,
  weekOfDay,
  windowCloseDayFor,
  windowCloseWeekFor,
  windowIndexOf,
} from "./calendar";
import { derivedFloat, streams } from "./seeds";

const REGIONS = Object.keys(CAREER_SLOTS.major) as Region[];

describe("seasonSchedule", () => {
  const schedule = seasonSchedule();

  it("covers exactly the configured 32 weeks, in order", () => {
    expect(schedule).toHaveLength(CAREER_CALENDAR.weeksPerSeason);
    expect(schedule.map((w) => w.week)).toEqual(
      Array.from({ length: CAREER_CALENDAR.weeksPerSeason }, (_, i) => i + 1),
    );
  });

  it("lays out preseason, splits, windows, worlds window and worlds", () => {
    const kindOf = (week: number) => schedule[week - 1].kind;

    expect(kindOf(1)).toBe("preseason");
    expect(kindOf(2)).toBe("preseason");

    // Regionals on W4/6/8 (split 1), W14/16/18 (2), W24/26/28 (3); Majors on W10/20/30.
    for (const [split, base] of [
      [1, 2],
      [2, 12],
      [3, 22],
    ] as const) {
      for (const [i, offset] of CAREER_CALENDAR.regionalOffsets.entries()) {
        const wk = schedule[base + offset - 1];
        expect(wk.kind).toBe("regional");
        expect(wk.split).toBe(split);
        expect(wk.ordinal).toBe(i + 1);
        expect(wk.windowOpen).toBe(false);
      }
      const major = schedule[base + CAREER_CALENDAR.majorOffset - 1];
      expect(major.kind).toBe("major");
      expect(major.split).toBe(split);
    }

    for (const week of [11, 12, 21, 22]) expect(kindOf(week)).toBe("window");
    for (const week of [3, 5, 7, 9, 13, 15, 17, 19, 23, 25, 27, 29]) {
      expect(kindOf(week)).toBe("open");
    }
    expect(kindOf(CAREER_CALENDAR.worldsWindowWeek)).toBe("worldsWindow");
    expect(kindOf(CAREER_CALENDAR.worldsWeek)).toBe("worlds");
  });

  it("opens the window exactly on preseason, mid windows and the worlds window", () => {
    const openWeeks = schedule.filter((w) => w.windowOpen).map((w) => w.week);
    expect(openWeeks).toEqual([1, 2, 11, 12, 21, 22, CAREER_CALENDAR.worldsWindowWeek]);
    for (const w of schedule) expect(isWindowWeek(w.week)).toBe(w.windowOpen);
  });
});

describe("day clock (v0.2)", () => {
  it("DAYS_PER_SEASON spans the whole week grid", () => {
    expect(DAYS_PER_SEASON).toBe(
      CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek,
    );
  });

  it("weekOfDay / dayOfWeekOf / firstDayOfWeek / eventDayFor roundtrip", () => {
    for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
      const monday = firstDayOfWeek(week);
      expect(weekOfDay(monday)).toBe(week);
      expect(dayOfWeekOf(monday)).toBe(1);

      const saturday = eventDayFor(week);
      expect(saturday).toBe(
        (week - 1) * CAREER_CALENDAR.daysPerWeek + CAREER_CALENDAR.eventDayOfWeek,
      );
      expect(weekOfDay(saturday)).toBe(week);
      expect(dayOfWeekOf(saturday)).toBe(CAREER_CALENDAR.eventDayOfWeek);
    }
    // The season's last day is the last week's Sunday.
    expect(weekOfDay(DAYS_PER_SEASON)).toBe(CAREER_CALENDAR.weeksPerSeason);
    expect(dayOfWeekOf(DAYS_PER_SEASON)).toBe(7);
  });

  it("Mon-Fri are training days; the weekend is not", () => {
    for (const day of [1, 2, 3, 4, 5]) expect(isTrainingDay(day)).toBe(true);
    expect(isTrainingDay(6)).toBe(false); // Saturday (matchday)
    expect(isTrainingDay(7)).toBe(false); // Sunday
    expect(isTrainingDay(8)).toBe(true); // next Monday
  });

  it("dateOfDay anchors day 1 on each season's real start Monday", () => {
    for (let i = 0; i < CAREER_SEASONS.length; i++) {
      const [y, m, d] = CAREER_SEASONS[i].startDate.split("-").map(Number);
      expect(dateOfDay(i, 1)).toEqual({ y, m, d, dow: 1 });
    }
    // One week later is the next real-calendar Monday.
    const start = dateOfDay(0, 1); // 2020-10-05
    const nextMonday = dateOfDay(0, 8);
    expect(nextMonday.dow).toBe(1);
    expect(nextMonday).toEqual({ ...start, d: start.d + 7 }); // 2020-10-12
    // Season 0 (Oct 2020 start) runs across the year boundary.
    expect(dateOfDay(0, DAYS_PER_SEASON).y).toBe(2021);
  });

  it("window close weeks/days match the schedule", () => {
    expect(windowCloseWeekFor(0)).toBe(CAREER_CALENDAR.preseasonWeeks);
    expect(windowCloseWeekFor(1)).toBe(12);
    expect(windowCloseWeekFor(2)).toBe(22);
    expect(windowCloseWeekFor(3)).toBe(CAREER_CALENDAR.worldsWindowWeek);
    expect(windowCloseDayFor(0)).toBe(
      CAREER_CALENDAR.preseasonWeeks * CAREER_CALENDAR.daysPerWeek,
    );
    expect(windowCloseDayFor(1)).toBe(12 * CAREER_CALENDAR.daysPerWeek);
    expect(windowCloseDayFor(3)).toBe(
      CAREER_CALENDAR.worldsWindowWeek * CAREER_CALENDAR.daysPerWeek,
    );
  });

  it("isWindowStartWeek marks only the first week of each window", () => {
    expect(isWindowStartWeek(1)).toBe(true);
    expect(isWindowStartWeek(2)).toBe(false);
    expect(isWindowStartWeek(11)).toBe(true);
    expect(isWindowStartWeek(12)).toBe(false);
    expect(isWindowStartWeek(21)).toBe(true);
    expect(isWindowStartWeek(22)).toBe(false);
    expect(isWindowStartWeek(CAREER_CALENDAR.worldsWindowWeek)).toBe(true);
    for (const week of [3, 4, 10, 32]) expect(isWindowStartWeek(week)).toBe(false);
  });
});

describe("week lookups", () => {
  it("weekAt returns the schedule entry and throws outside the season", () => {
    expect(weekAt(4).kind).toBe("regional");
    expect(weekAt(32).kind).toBe("worlds");
    expect(() => weekAt(0)).toThrow();
    expect(() => weekAt(CAREER_CALENDAR.weeksPerSeason + 1)).toThrow();
  });

  it("splitOfWeek maps split weeks and nulls everything else", () => {
    expect(splitOfWeek(3)).toBe(1);
    expect(splitOfWeek(10)).toBe(1);
    expect(splitOfWeek(13)).toBe(2);
    expect(splitOfWeek(20)).toBe(2);
    expect(splitOfWeek(23)).toBe(3);
    expect(splitOfWeek(30)).toBe(3);
    for (const week of [1, 2, 11, 12, 21, 22, 31, 32]) {
      expect(splitOfWeek(week)).toBeNull();
    }
  });

  it("windowIndexOf numbers the four windows 0..3", () => {
    expect(windowIndexOf(1)).toBe(0);
    expect(windowIndexOf(2)).toBe(0);
    expect(windowIndexOf(11)).toBe(1);
    expect(windowIndexOf(12)).toBe(1);
    expect(windowIndexOf(21)).toBe(2);
    expect(windowIndexOf(22)).toBe(2);
    expect(windowIndexOf(CAREER_CALENDAR.worldsWindowWeek)).toBe(3);
    for (const week of [3, 4, 10, 20, 30, 32]) expect(windowIndexOf(week)).toBeNull();
  });
});

describe("eventIdFor (STABLE seed-stream grammar)", () => {
  it("emits the exact documented grammar", () => {
    expect(eventIdFor(0, "regional", 1, 2, "EU")).toBe("0:1:reg2:EU");
    expect(eventIdFor(4, "regional", 3, 1, "SAM")).toBe("4:3:reg1:SAM");
    expect(eventIdFor(3, "major", 2)).toBe("3:2:major");
    expect(eventIdFor(5, "worlds")).toBe("5:worlds");
  });

  it("rejects underspecified official events", () => {
    expect(() => eventIdFor(0, "regional", 1)).toThrow();
    expect(() => eventIdFor(0, "major")).toThrow();
  });
});

describe("officialEventDefsForWeek", () => {
  it("schedules one regional per region on a regional week", () => {
    const defs = officialEventDefsForWeek(0, 6);
    expect(defs).toHaveLength(REGIONS.length);
    expect(defs.map((d) => d.region)).toEqual(REGIONS);
    for (const def of defs) {
      expect(def.tier).toBe("regional");
      expect(def.format).toBe("swiss");
      expect(def.split).toBe(1);
      expect(def.ordinal).toBe(2);
      expect(def.week).toBe(6);
      expect(def.day).toBe(regionalDayFor(6)); // R40: the week's SUNDAY
      expect(dayOfWeekOf(def.day)).toBe(7);
      expect(eventEndDayFor(def)).toBe(def.day); // one-day event
      expect(def.id).toBe(`0:1:reg2:${def.region}`);
      expect(def.name).toBe(`${def.region} Regional 2`);
    }
  });

  it("schedules one cross-region Major on a major week", () => {
    const defs = officialEventDefsForWeek(2, 20);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      id: "2:2:major",
      tier: "major",
      split: 2,
      day: eventDayFor(20),
      name: "Split 2 Major",
      format: "swiss",
    });
    expect(defs[0].region).toBeUndefined();
    // R40: Saturday opens it (Swiss), Sunday plays the playoffs.
    expect(dayOfWeekOf(defs[0].day)).toBe(6);
    expect(playoffsDayFor(defs[0])).toBe(defs[0].day + 1);
    expect(eventEndDayFor(defs[0])).toBe(defs[0].day + 1);
  });

  it("schedules Worlds on the last week", () => {
    const defs = officialEventDefsForWeek(1, CAREER_CALENDAR.worldsWeek);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      id: "1:worlds",
      tier: "worlds",
      day: eventDayFor(CAREER_CALENDAR.worldsWeek),
      name: "World Championship",
      format: "swiss",
    });
    // R40: Championship Sunday IS the season's last day.
    expect(playoffsDayFor(defs[0])).toBe(DAYS_PER_SEASON);
  });

  it("schedules nothing on open, window and preseason weeks", () => {
    for (const week of [1, 3, 11, 31]) {
      expect(officialEventDefsForWeek(0, week)).toEqual([]);
    }
  });
});

describe("the weekend (v2.0 R40)", () => {
  it("keeps the day-of-week constants ordered: training < qualifier < regional, Swiss < playoffs", () => {
    expect(CAREER_TRAINING.trainingDaysPerWeek).toBeLessThan(CAREER_QUALIFIER.dayOfWeek);
    expect(CAREER_QUALIFIER.dayOfWeek).toBeLessThan(CAREER_CALENDAR.regionalDayOfWeek);
    expect(CAREER_CALENDAR.regionalDayOfWeek).toBeLessThanOrEqual(CAREER_CALENDAR.daysPerWeek);
    expect(CAREER_CALENDAR.eventDayOfWeek).toBeLessThan(CAREER_CALENDAR.playoffsDayOfWeek);
    expect(CAREER_CALENDAR.playoffsDayOfWeek).toBeLessThanOrEqual(CAREER_CALENDAR.daysPerWeek);
    // Miguel's table: qualifier Saturday, regional Sunday, Swiss Saturday, playoffs Sunday.
    expect([CAREER_QUALIFIER.dayOfWeek, CAREER_CALENDAR.regionalDayOfWeek]).toEqual([6, 7]);
    expect([CAREER_CALENDAR.eventDayOfWeek, CAREER_CALENDAR.playoffsDayOfWeek]).toEqual([6, 7]);
  });

  it("puts one Swiss-only qualifier per region on the regional week's Saturday", () => {
    for (const week of seasonSchedule().filter((w) => w.kind === "regional").map((w) => w.week)) {
      const qs = qualifierDefsForWeek(0, week);
      expect(qs.map((q) => q.region)).toEqual(REGIONS);
      for (const q of qs) {
        expect(q.tier).toBe("qualifier");
        expect(q.format).toBe("swissOnly");
        expect(q.day).toBe(qualifierDayFor(week));
        expect(q.day).toBe(eventDayFor(week)); // Saturday
        expect(isTwoDayEvent(q)).toBe(false);
        expect(eventEndDayFor(q)).toBe(q.day);
        // The regional it feeds: same week/region, the next day.
        const reg = regionalForQualifier(q)!;
        expect(reg.tier).toBe("regional");
        expect(reg.region).toBe(q.region);
        expect(reg.day).toBe(q.day + 1);
        expect(reg.day).toBe(regionalDayFor(week));
        // The stable grammar: qual ↔ reg differ only in the tag.
        expect(q.id.replace(":qual", ":reg")).toBe(reg.id);
      }
    }
    // No qualifier off regional weeks.
    for (const week of [1, 3, 10, 11, 31, 32]) expect(qualifierDefsForWeek(0, week)).toEqual([]);
  });

  it("only the Major and Worlds span two days", () => {
    const tiers = ["t3", "t2", "qualifier", "regional", "major", "worlds"] as const;
    expect(tiers.filter((tier) => isTwoDayEvent({ tier }))).toEqual(["major", "worlds"]);
    // A one-day event's playoffs/end day is its own day.
    const t3 = unofficialOfferFor(0, 3, { userTeamRating: 78, rep: 0, t3EntriesThisSplit: 0, careerSeed: 7 })!;
    expect(playoffsDayFor(t3)).toBe(t3.day);
    expect(dayOfWeekOf(t3.day)).toBe(6);
  });
});

describe("unofficialOfferFor", () => {
  const lowRepCtx = {
    userTeamRating: 78,
    rep: CAREER_UNOFFICIAL.t2RepGate - 1,
    t3EntriesThisSplit: 0,
    careerSeed: 42,
  };

  it("only fires on open weeks", () => {
    for (const week of [1, 2, 4, 10, 11, 31, 32]) {
      expect(unofficialOfferFor(0, week, lowRepCtx)).toBeNull();
    }
  });

  it("offers a t3 Community Cup to a low-rep, low-rated team", () => {
    const offer = unofficialOfferFor(0, 3, lowRepCtx);
    expect(offer).not.toBeNull();
    expect(offer!.tier).toBe("t3");
    expect(offer!.id).toBe("0:3:unofficial");
    expect(offer!.format).toBe("single");
    expect(offer!.split).toBe(1);
    expect(offer!.day).toBe(eventDayFor(3)); // plays on the week's Saturday
    expect(T3_EVENT_NAMES).toContain(offer!.name);
  });

  it("stops t3 offers above the rating ceiling or the split entry cap", () => {
    expect(
      unofficialOfferFor(0, 3, {
        ...lowRepCtx,
        userTeamRating: CAREER_UNOFFICIAL.t3RatingCeiling + 1,
      }),
    ).toBeNull();
    expect(
      unofficialOfferFor(0, 3, {
        ...lowRepCtx,
        t3EntriesThisSplit: CAREER_UNOFFICIAL.t3MaxEntriesPerSplit,
      }),
    ).toBeNull();
  });

  it("rolls the t2 Invitational on the documented derived stream", () => {
    // The t2 branch must agree with the raw derivedFloat for ANY seed — probe
    // a swath so both outcomes are exercised.
    let sawT2 = false;
    let sawFallback = false;
    for (let careerSeed = 1; careerSeed <= 64; careerSeed++) {
      const ctx = {
        userTeamRating: 78,
        rep: CAREER_UNOFFICIAL.t2RepGate,
        t3EntriesThisSplit: 0,
        careerSeed,
      };
      const offer = unofficialOfferFor(2, 15, ctx);
      const roll = derivedFloat(careerSeed, streams.gen("t2offer", "2:15"));
      if (roll < CAREER_UNOFFICIAL.t2OfferChance) {
        sawT2 = true;
        expect(offer?.tier).toBe("t2");
        expect(T2_EVENT_NAMES).toContain(offer!.name);
        expect(offer!.id).toBe("2:15:unofficial");
      } else {
        sawFallback = true;
        expect(offer?.tier).toBe("t3"); // rating 78 keeps the t3 fallback open
      }
    }
    expect(sawT2).toBe(true);
    expect(sawFallback).toBe(true);
  });

  it("is deterministic per (seed, season, week)", () => {
    const a = unofficialOfferFor(1, 5, lowRepCtx);
    const b = unofficialOfferFor(1, 5, lowRepCtx);
    expect(a).toEqual(b);
  });
});

describe("season identity", () => {
  it("uses dataset labels/ids/orders through the timeline", () => {
    for (let i = 0; i < CAREER_SEASONS.length; i++) {
      expect(seasonLabelFor(i)).toBe(CAREER_SEASONS[i].label);
      expect(seasonIdFor(i)).toBe(CAREER_SEASONS[i].seasonId);
      expect(orderFor(i)).toBe(CAREER_SEASONS[i].order);
    }
  });

  it("continues the infinite era from 2027 and clamps the dataset order", () => {
    const last = CAREER_SEASONS[CAREER_SEASONS.length - 1];
    expect(seasonLabelFor(6)).toBe("RLCS 2027");
    expect(seasonLabelFor(9)).toBe("RLCS 2030");
    expect(seasonIdFor(6)).toBe("career-2027");
    expect(seasonIdFor(8)).toBe("career-2029");
    expect(orderFor(6)).toBe(last.order);
    expect(orderFor(20)).toBe(last.order);
  });
});
