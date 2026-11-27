/**
 * v2.3 SKIP (R200): the batched Skip and the autoplay stop once on the Monday
 * a multi-week transfer window enters its last week, and the player gets one
 * notice that day. A stop of the batch, never a clock hold.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  firstDayOfWeek,
  isWindowLastWeekStart,
  isWindowStartWeek,
  weekOfDay,
  windowCloseWeekFor,
} from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { stepDayForTests, walkPastForTests } from "./careerClockForTests";
import { clockHoldOf } from "./careerDecisions";
import { advanceToNextStopFlow, createCareerSave, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Closing Org",
    abbrev: "CLO",
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

function fresh(): CareerSave {
  const save = createCareerSave(INPUT, 34_001);
  for (let s = 0; s < 2; s++) for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  return save;
}

const closingNews = (s: CareerSave) => s.news.filter((n) => n.titleKey === "windowClosing");

/** Midwindow Monday: window 1's last week is week 12. */
const LAST_WEEK_MONDAY = firstDayOfWeek(windowCloseWeekFor(1));

describe("isWindowLastWeekStart", () => {
  it("is true exactly on the Monday of the last week of each multi-week window", () => {
    const expected = ([0, 1, 2, 3] as const)
      .map((i) => windowCloseWeekFor(i))
      .filter((w) => !isWindowStartWeek(w))
      .map((w) => firstDayOfWeek(w));
    const actual: number[] = [];
    for (let d = 1; d <= DAYS_PER_SEASON; d++) if (isWindowLastWeekStart(d)) actual.push(d);
    expect(actual).toEqual(expected);
    expect(actual.length).toBe(3); // preseason, W11-12, W21-22; the one-week Worlds window never qualifies
    for (const d of actual) expect(dayOfWeekOf(d)).toBe(1);
  });

  it("is false on a single-week window's open Monday (that Monday keeps the open stop)", () => {
    const worldsWeek = windowCloseWeekFor(3);
    expect(isWindowStartWeek(worldsWeek)).toBe(true);
    expect(isWindowLastWeekStart(firstDayOfWeek(worldsWeek))).toBe(false);
  });
});

describe("the batched Skip at a closing window", () => {
  it("stops on the last-week Monday when the skip began earlier, with one notice", () => {
    let save = fresh();
    save = { ...save, clock: { ...save.clock, day: LAST_WEEK_MONDAY - 1 } };
    save = walkPastForTests(save);
    const stopped = advanceToNextStopFlow(save);
    expect(stopped.clock.day).toBe(LAST_WEEK_MONDAY);
    expect(weekOfDay(stopped.clock.day)).toBe(windowCloseWeekFor(1));
    expect(clockHoldOf(stopped)).toBeNull(); // never a hold
    expect(closingNews(stopped).length).toBe(1);
    expect(closingNews(stopped)[0].params?.n).toBe(6);
  });

  it("a second press goes on past it, and the notice is not repeated", () => {
    let save = fresh();
    save = { ...save, clock: { ...save.clock, day: LAST_WEEK_MONDAY - 1 } };
    const stopped = advanceToNextStopFlow(walkPastForTests(save));
    expect(stopped.clock.day).toBe(LAST_WEEK_MONDAY);
    const next = advanceToNextStopFlow(walkPastForTests(stopped));
    expect(next.clock.day).toBeGreaterThan(LAST_WEEK_MONDAY);
    expect(closingNews(next).length).toBe(1);
  });

  it("nothing is pushed on the days around it", () => {
    let save = fresh();
    save = { ...save, clock: { ...save.clock, day: LAST_WEEK_MONDAY - 3 } };
    for (let i = 0; i < 6; i++) {
      save = stepDayForTests(save);
      const onMonday = save.clock.day === LAST_WEEK_MONDAY;
      if (save.clock.day < LAST_WEEK_MONDAY) expect(closingNews(save).length).toBe(0);
      if (onMonday) expect(closingNews(save).length).toBe(1);
    }
    expect(closingNews(save).length).toBe(1);
  });
});
