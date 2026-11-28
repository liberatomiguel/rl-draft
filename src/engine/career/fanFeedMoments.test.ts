/**
 * rc9 STORIES (R253): the rule that decides when the manager is offered a
 * post. Pure; the numbers come from CAREER_FEED.offer, so the tests read them.
 */
import { describe, expect, it } from "vitest";
import { CAREER_FEED } from "@/config/balance";
import { CAREER_FEED_EN } from "@/content/copy.career.feed.en";
import { CAREER_FEED_PT } from "@/content/copy.career.feed.pt";
import { DAYS_PER_SEASON } from "./calendar";
import { FEED_VARIANTS, MOMENT_RESULT } from "./fanFeedVariants";
import { offerAllowed, postMomentOf, runOf, type MomentInput, type MomentSeries } from "./fanFeedMoments";
import type { PostMoment } from "./fanFeedTypes";

const O = CAREER_FEED.offer;
const s = (n: number, won: boolean, upset = false, gap = 0): MomentSeries => ({ n, won, upset, gap });
const input = (over: Partial<MomentInput>): MomentInput => ({ tier: "regional", placement: "top8", series: [s(1, true), s(2, false)], runBefore: 0, seedRank: 6, reached: ["qualified", "playoffs"], ...over });

describe("postMomentOf: only the moments worth a statement", () => {
  it("a title, a final lost and a Major or Worlds exit, anchored on the last series", () => {
    expect(postMomentOf(input({ placement: "champion" }))).toEqual({ moment: "title", seriesN: 2 });
    expect(postMomentOf(input({ placement: "runner_up", tier: "major" }))).toEqual({ moment: "finalLost", seriesN: 2 });
    expect(postMomentOf(input({ placement: "top8", tier: "worlds" }))).toEqual({ moment: "exit", seriesN: 2 });
    expect(postMomentOf(input({ placement: "swiss_exit", tier: "major" }))?.moment).toBe("exit");
  });

  it("an everyday regional result, a cup title or a qualifier won leaves nothing", () => {
    expect(postMomentOf(input({ placement: "top4" }))).toBeNull();
    expect(postMomentOf(input({ placement: "swiss_exit" }))).toBeNull();
    expect(postMomentOf(input({ tier: "t3", placement: "champion" }))).toBeNull();
    expect(postMomentOf(input({ tier: "qualifier", placement: "top8", seedRank: 1 }))).toBeNull();
  });

  it("a qualifier lost is a moment only for one of its favourites", () => {
    expect(postMomentOf(input({ tier: "qualifier", placement: "swiss_exit", seedRank: O.qualifierFavouriteRank }))?.moment).toBe("missedQualification");
    expect(postMomentOf(input({ tier: "qualifier", placement: "swiss_exit", seedRank: O.qualifierFavouriteRank + 1 }))).toBeNull();
  });

  it("an upset needs the gap, the right side, and picks the biggest", () => {
    const g = O.upsetMinGap;
    expect(postMomentOf(input({ series: [s(1, true, true, -(g - 0.5))] }))).toBeNull();
    expect(postMomentOf(input({ series: [s(1, true, true, -g), s(2, true, true, -(g + 2))] }))).toEqual({ moment: "upsetWin", seriesN: 2 });
    expect(postMomentOf(input({ series: [s(1, false, true, g + 1)] }))).toEqual({ moment: "upsetLoss", seriesN: 1 });
    // An "upset" flag on the wrong side of the gap is not one.
    expect(postMomentOf(input({ series: [s(1, true, true, g + 1)] }))).toBeNull();
  });

  it("a win streak reaching a milestone inside the event", () => {
    const m = O.streakMilestones[0];
    expect(postMomentOf(input({ runBefore: m - 2, series: [s(7, true), s(8, true)] }))).toEqual({ moment: "streak", seriesN: 8, streak: m });
    expect(postMomentOf(input({ runBefore: m - 3, series: [s(7, true), s(8, true)] }))).toBeNull();
    expect(postMomentOf(input({ runBefore: m - 1, series: [s(7, false)] }))).toBeNull();
  });

  it("a breakthrough: the first time through a qualifier or into a regional's playoffs, anchored on the last win", () => {
    expect(postMomentOf(input({ tier: "qualifier", placement: "top8", reached: [], series: [s(1, true), s(2, true), s(3, false)] }))).toEqual({ moment: "breakthrough", seriesN: 2 });
    expect(postMomentOf(input({ placement: "top8", reached: ["qualified"] }))).toEqual({ moment: "breakthrough", seriesN: 1 });
    expect(postMomentOf(input({ tier: "qualifier", placement: "top8", reached: ["qualified"] }))).toBeNull();
    expect(postMomentOf(input({ placement: "top8", reached: ["playoffs"] }))).toBeNull();
  });

  it("no series, no moment", () => {
    expect(postMomentOf(input({ placement: "champion", series: [] }))).toBeNull();
  });

  it("runOf reads the signed run at the end", () => {
    expect(runOf([{ won: true }, { won: true }])).toBe(2);
    expect(runOf([{ won: true }, { won: false }, { won: false }])).toBe(-2);
    expect(runOf([])).toBe(0);
  });
});

describe("offerAllowed: a gap and a season cap", () => {
  it("waits minGapDays after the last offer; a title skips the gap", () => {
    const log = [{ seasonIndex: 1, day: 40 }];
    expect(offerAllowed(log, { seasonIndex: 1, day: 40 + O.minGapDays - 1 }, "exit")).toBe(false);
    expect(offerAllowed(log, { seasonIndex: 1, day: 40 + O.minGapDays }, "exit")).toBe(true);
    expect(offerAllowed(log, { seasonIndex: 1, day: 41 }, "title")).toBe(true);
  });

  it("counts the gap across a season turn", () => {
    const log = [{ seasonIndex: 1, day: DAYS_PER_SEASON - 2 }];
    expect(offerAllowed(log, { seasonIndex: 2, day: 1 }, "upsetWin")).toBe(false);
    expect(offerAllowed(log, { seasonIndex: 2, day: O.minGapDays }, "upsetWin")).toBe(true);
  });

  it("never more than perSeason offers in a season, titles included", () => {
    const log = Array.from({ length: O.perSeason }, (_, i) => ({ seasonIndex: 3, day: 10 + i * 30 }));
    expect(offerAllowed(log, { seasonIndex: 3, day: 220 }, "title")).toBe(false);
    expect(offerAllowed(log, { seasonIndex: 4, day: 220 }, "title")).toBe(true);
  });
});

describe("the moment variants (R255)", () => {
  const moments = Object.keys(MOMENT_RESULT) as PostMoment[];
  const tones = ["humble", "confident", "provocative"] as const;

  it("every moment has at least two variants per tone, all of its result", () => {
    for (const m of moments) {
      for (const t of tones) {
        const cell = FEED_VARIANTS.managerPost.filter((v) => v.moment === m && v.tone === t);
        expect(cell.length, `${m} ${t}`).toBeGreaterThanOrEqual(2);
        for (const v of cell) expect(v.result, v.key).toBe(MOMENT_RESULT[m]);
      }
    }
  });

  it("no two manager posts share a sentence, EN or PT (a season never reads the same line twice)", () => {
    for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) {
      const seen = new Map<string, string>();
      for (const v of FEED_VARIANTS.managerPost) {
        for (const sentence of dict[v.key].split(/(?<=[.?!])\s+/)) {
          const key = sentence.replace(/\{\w+\}/g, "#").trim();
          if (key.length < 12) continue; // "{score}." and the like are not sentences
          expect(seen.get(key), `${v.key}: "${sentence}" also in ${seen.get(key)}`).toBeUndefined();
          seen.set(key, v.key);
        }
      }
    }
  });

  it("no em dash, no machine closers in the manager's posts and replies", () => {
    const keys = [...FEED_VARIANTS.managerPost, ...FEED_VARIANTS.managerReply].map((v) => v.key);
    for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) {
      for (const k of keys) {
        expect(dict[k], k).not.toMatch(/—|--/);
        expect(dict[k], k).not.toMatch(/\b(journey|unlock|elevate|testament|we go again|onwards and upwards|seguimos juntos|rumo ao)\b/i);
      }
    }
  });
});
