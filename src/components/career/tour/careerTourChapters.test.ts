/**
 * rc.54 (Miguel): Road to Worlds has NO guided tour on Calendar, Market,
 * Standings, Inbox and Club. The HQ, Squad, Training and Finances keep theirs.
 * Also: the copy carries exactly the chapters that exist, in EN and PT, and the
 * tour component offers nothing else.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { CAREER_TOUR_CHAPTERS, careerTourChapter } from "./careerTourChapters";

const REMOVED = ["calendar", "market", "standings", "news", "inbox", "club"] as const;

/** Keys of `tour` that are a chapter (an object of steps), not a label or a formatter. */
const chapterKeys = (tour: Record<string, unknown>): string[] =>
  Object.keys(tour)
    .filter((key) => typeof tour[key] === "object" && tour[key] !== null)
    .sort();

describe("career tour chapters", () => {
  it.each(REMOVED)("no tour on /career/%s", (tab) => {
    expect(careerTourChapter(`/career/${tab}`)).toBeNull();
    expect(careerTourChapter(`/career/${tab}/`)).toBeNull();
  });

  it("the HQ, Squad, Training and Finances keep their chapter", () => {
    expect(careerTourChapter("/career")).toBe("hub");
    expect(careerTourChapter("/career/")).toBe("hub");
    expect(careerTourChapter("/career/squad")).toBe("squad");
    expect(careerTourChapter("/career/training")).toBe("training");
    expect(careerTourChapter("/career/finances/")).toBe("finances");
    expect([...CAREER_TOUR_CHAPTERS].sort()).toStrictEqual(["finances", "hub", "squad", "training"]);
  });

  it("no tour anywhere else (the event, follow, saves and review screens, odd paths)", () => {
    for (const path of ["/career/event", "/career/follow", "/career/saves", "/career/review", "/career/new", "/", "", null, undefined, "/career/constructor", "/play"]) {
      expect(careerTourChapter(path)).toBeNull();
    }
  });

  it("the copy has exactly the chapters that exist, keyed the same in EN and PT", () => {
    const expected = [...CAREER_TOUR_CHAPTERS].sort();
    expect(chapterKeys(CAREER_EN.tour)).toStrictEqual(expected);
    expect(chapterKeys(CAREER_PT.tour)).toStrictEqual(expected);
    for (const chapter of CAREER_TOUR_CHAPTERS) {
      const en = CAREER_EN.tour[chapter] as Record<string, unknown>;
      const pt = CAREER_PT.tour[chapter] as Record<string, unknown>;
      expect(Object.keys(pt).sort()).toStrictEqual(Object.keys(en).sort());
    }
  });

  it("the tour component builds no step for a removed tab", () => {
    const source = readFileSync(resolve(__dirname, "CareerTour.tsx"), "utf8");
    for (const token of ["calendar-month", "calendar-next", "market-tabs", "market-search", "standings-tabs", "standings-table", "club-progress", "club-trophies"]) {
      expect(source).not.toContain(token);
    }
    for (const chapter of ["market", "calendar", "standings", "club"]) {
      expect(source).not.toContain(`case "${chapter}"`);
    }
  });
});
