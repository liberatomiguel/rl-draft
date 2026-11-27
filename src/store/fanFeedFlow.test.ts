/**
 * v2.3 FEED, store side (FEATURES.fanFeed ON here): the log the finishEvent
 * hook writes, the one action, the receipt and the followers. One real event
 * is played through the flows to prove the hook; the rest runs on hand-built
 * tournaments. The flag-off contract is in fanFeedFlow.flagOff.test.ts.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, fanFeed: true } };
});

import { CAREER_FEED } from "@/config/balance";
import { CAREER_FEED_EN } from "@/content/copy.career.feed.en";
import { fanFeedFor } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import type { FanFeedSave } from "@/engine/career/fanFeedTypes";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { SeriesResult, TournamentState } from "@/engine/types";
import { advanceDayFlow, createCareerSave, finishEvent, isEventPaused, simEventToEnd, startEvent, type CreateCareerInput } from "./careerFlow";
import { stepDayForTests } from "./careerClockForTests";
import { followersOf, pendingFeedPostOf, postToFeedFlow, recordFeedSeries } from "./fanFeedFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Feed Flow Org",
    abbrev: "FFO",
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

const base = (seed = 4242): CareerSave => createCareerSave(INPUT, seed);

const DEF = (over: Partial<CareerEventDef> = {}): CareerEventDef =>
  ({ id: "0:1:reg1:SAM", name: "SAM Regional 1", tier: "regional", seasonIndex: 0, week: 6, day: 40, ...over }) as CareerEventDef;

function seriesOf(opp: string, userWon: boolean, upset = false, userIsA = true, self = "user"): SeriesResult {
  const us = userWon ? 3 : 1;
  const them = userWon ? 1 : 3;
  return {
    teamAId: userIsA ? self : opp,
    teamBId: userIsA ? opp : self,
    games: [],
    score: userIsA ? [us, them] : [them, us],
    winnerTeamId: userWon ? self : opp,
    ratingDiff: 0,
    upset,
  };
}

/** A tournament holding the given user series in order (swiss rounds), and optionally a user title. */
function tournament(rows: [string, boolean, boolean?][], champion = false): TournamentState {
  const names = Object.fromEntries(rows.map(([o]) => [o, { id: o, name: `Team ${o}` }]));
  return {
    teams: names,
    swiss: { rounds: rows.map(([o, won, upset], i) => ({ round: i + 1, series: [seriesOf(o, won, upset ?? false, i % 2 === 0), seriesOf("q", true, false, true, "p")], userSeriesIndex: 0 })) },
    playoffs: champion ? { rounds: [], championTeamId: "user" } : null,
  } as unknown as TournamentState;
}

const feedOf = (save: CareerSave): FanFeedSave => save.fanFeed!;

describe("recordFeedSeries: what the finishEvent hook writes", () => {
  it("logs the user's series in order, skipping the other teams' series", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true], ["b", false], ["c", true, true]]), DEF());
    const f = feedOf(save);
    expect(f.series.map((s) => [s.n, s.opponentRef, s.won, s.upset, s.us, s.them])).toEqual([
      [1, "a", true, false, 3, 1],
      [2, "b", false, false, 1, 3],
      [3, "c", true, true, 3, 1],
    ]);
    expect(f.series[0]).toMatchObject({ opponentName: "Team a", event: "SAM Regional 1", week: 6, seasonIndex: 0 });
    expect(f.seq).toBe(4);
  });

  it("reads the score for the user whichever side he was on", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true], ["b", true]]), DEF());
    expect(feedOf(save).series.map((s) => [s.us, s.them])).toEqual([[3, 1], [3, 1]]);
  });

  it("keeps only the last seriesKept series, numbering on", () => {
    const save = base();
    const rows: [string, boolean][] = Array.from({ length: CAREER_FEED.seriesKept + 5 }, (_, i) => [`o${i}`, i % 2 === 0]);
    recordFeedSeries(save, tournament(rows), DEF());
    const f = feedOf(save);
    expect(f.series).toHaveLength(CAREER_FEED.seriesKept);
    expect(f.series[0].n).toBe(6);
    expect(f.seq).toBe(CAREER_FEED.seriesKept + 6);
  });

  it("writes nothing for a side event (1v1, 2v2) or when the user played no series", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true]]), DEF({ teamSize: 2 }));
    recordFeedSeries(save, tournament([]), DEF());
    expect(save.fanFeed).toBeUndefined();
  });

  it("moves the followers with results, an upset and a title, never below zero", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true]]), DEF());
    const start = feedOf(save).followers;
    recordFeedSeries(save, tournament([["b", true]]), DEF({ id: "e2" }));
    expect(feedOf(save).followers).toBeGreaterThan(start);
    const afterWin = feedOf(save).followers;
    recordFeedSeries(save, tournament([["c", false]]), DEF({ id: "e3" }));
    expect(feedOf(save).followers).toBeLessThan(afterWin);
    const beforeTitle = feedOf(save).followers;
    recordFeedSeries(save, tournament([], true), DEF({ id: "e4" }));
    expect(feedOf(save).followers).toBeGreaterThan(beforeTitle);
    const broke = base();
    broke.fanFeed = { v: 1, seq: 1, series: [], posts: [], answered: 0, followers: 1 };
    for (let i = 0; i < 6; i++) recordFeedSeries(broke, tournament([[`z${i}`, false]]), DEF({ id: `f${i}` }));
    expect(feedOf(broke).followers).toBe(0);
  });

  it("starts the followers from the manager's reputation", () => {
    const lo = base();
    lo.reputation = 0;
    const hi = base();
    hi.reputation = 50;
    recordFeedSeries(lo, tournament([["a", true]]), DEF());
    recordFeedSeries(hi, tournament([["a", true]]), DEF());
    expect(feedOf(hi).followers).toBeGreaterThan(feedOf(lo).followers);
  });
});

describe("postToFeedFlow: the one action", () => {
  const played = (...rows: [string, boolean][]): CareerSave => {
    const save = base();
    recordFeedSeries(save, tournament(rows), DEF());
    return save;
  };

  it("stores tone, opponent and week on the one field, and answers the series", () => {
    const save = played(["a", true], ["b", false]);
    expect(pendingFeedPostOf(save)?.opponentRef).toBe("b");
    const next = postToFeedFlow(save, "confident");
    const p = feedOf(next).posts[0];
    expect(p).toMatchObject({ tone: "confident", opponentRef: "b", opponentName: "Team b", seriesN: 2, seasonIndex: save.clock.seasonIndex });
    expect(typeof p.week).toBe("number");
    // v2.3 FIX: it remembers the result it reacted to (the second series is a loss)
    expect(p.result).toMatchObject({ won: false });
    expect(pendingFeedPostOf(next)).toBeNull();
    // only fanFeed differs, and the input was not mutated
    expect({ ...next, fanFeed: undefined }).toEqual({ ...save, fanFeed: undefined });
    expect(feedOf(save).posts).toHaveLength(0);
  });

  it("does nothing when there is nothing to answer, or twice for one series", () => {
    const fresh = base();
    expect(postToFeedFlow(fresh, "humble")).toBe(fresh);
    const next = postToFeedFlow(played(["a", true]), "humble");
    expect(postToFeedFlow(next, "provocative")).toBe(next);
  });

  it("skip stores no post and no followers move", () => {
    const save = played(["a", true]);
    const next = postToFeedFlow(save, "skip");
    expect(feedOf(next).posts).toHaveLength(0);
    expect(feedOf(next).followers).toBe(feedOf(save).followers);
    expect(pendingFeedPostOf(next)).toBeNull();
  });

  it("tone moves the followers: provocative more than confident more than humble", () => {
    const after = (tone: "humble" | "confident" | "provocative") => {
      const save = played(["a", true]);
      return feedOf(postToFeedFlow(save, tone)).followers - feedOf(save).followers;
    };
    const [h, c, p] = [after("humble"), after("confident"), after("provocative")];
    expect(h).toBeGreaterThan(0);
    expect(c).toBeGreaterThan(h);
    expect(p).toBeGreaterThan(c);
  });

  it("a refused tone writes nothing", () => {
    const save = played(["a", true]);
    expect(postToFeedFlow(save, "rude" as never)).toBe(save);
  });

  it("keeps the last postsKept posts", () => {
    let save = base();
    for (let i = 0; i < CAREER_FEED.postsKept + 3; i++) {
      recordFeedSeries(save, tournament([[`o${i}`, true]]), DEF({ id: `ev${i}` }));
      save = postToFeedFlow(save, "humble");
    }
    expect(feedOf(save).posts).toHaveLength(CAREER_FEED.postsKept);
    expect(feedOf(save).posts[0].opponentRef).toBe("o3");
  });
});

describe("the receipt", () => {
  const provoked = (): CareerSave => {
    const save = base();
    recordFeedSeries(save, tournament([["rival", true]]), DEF());
    return postToFeedFlow(save, "provocative");
  };

  it("provoke, then lose to that opponent: the post is settled as a receipt, the followers fall, the feed quotes it", () => {
    const save = provoked();
    const before = feedOf(save).followers;
    recordFeedSeries(save, tournament([["rival", false]]), DEF({ id: "e2", week: 9, name: "SAM Regional 2" }));
    const post = feedOf(save).posts[0];
    expect(post.settled).toMatchObject({ kind: "receipt", week: 9, event: "SAM Regional 2", us: 1, them: 3 });
    expect(feedOf(save).followers).toBeLessThan(before);
    const receipt = fanFeedFor(save).find((p) => p.kind === "receipt")!;
    expect(receipt.slots.opponent).toBe("Team rival");
    expect(feedTextOf(receipt, CAREER_FEED_EN.feed)).toContain("Team rival");
  });

  it("provoke, then beat him: backed up, followers rise, no receipt", () => {
    const save = provoked();
    const before = feedOf(save).followers;
    recordFeedSeries(save, tournament([["rival", true]]), DEF({ id: "e2", week: 9 }));
    expect(feedOf(save).posts[0].settled?.kind).toBe("backedUp");
    expect(feedOf(save).followers).toBeGreaterThan(before);
    expect(fanFeedFor(save).some((p) => p.kind === "receipt")).toBe(false);
  });

  it("a loss to someone else, or after a humble or confident post, is no receipt", () => {
    const other = provoked();
    recordFeedSeries(other, tournament([["somebody", false]]), DEF({ id: "e2" }));
    expect(feedOf(other).posts[0].settled).toBeUndefined();
    for (const tone of ["humble", "confident"] as const) {
      const save = base();
      recordFeedSeries(save, tournament([["rival", true]]), DEF());
      const posted = postToFeedFlow(save, tone);
      recordFeedSeries(posted, tournament([["rival", false]]), DEF({ id: "e2" }));
      expect(feedOf(posted).posts[0].settled).toBeUndefined();
    }
  });

  it("settles once, on the first later series; later losses to him are plain losses", () => {
    const save = provoked();
    recordFeedSeries(save, tournament([["rival", false]]), DEF({ id: "e2", week: 9 }));
    const settled = feedOf(save).posts[0].settled;
    recordFeedSeries(save, tournament([["rival", false]]), DEF({ id: "e3", week: 11 }));
    expect(feedOf(save).posts[0].settled).toEqual(settled);
  });

  it("the post's own series never settles it; an old post (past the window) does not either", () => {
    const save = provoked();
    expect(feedOf(save).posts[0].settled).toBeUndefined();
    const late = provoked();
    recordFeedSeries(late, tournament([["rival", false]]), DEF({ id: "e9", seasonIndex: CAREER_FEED.receiptWindowSeasons + 1 }));
    expect(feedOf(late).posts[0].settled).toBeUndefined();
  });
});

describe("followers have no other effect (R198)", () => {
  it("is only a number the feed reports", () => {
    const save = base();
    expect(followersOf(save)).toBeNull();
    recordFeedSeries(save, tournament([["a", true]]), DEF());
    expect(followersOf(save)).toBe(feedOf(save).followers);
    const copy = { ...save, fanFeed: undefined };
    expect(Object.keys(copy).filter((k) => /follow/i.test(k))).toEqual([]);
  });
});

describe("through a real event (the finishEvent hook)", () => {
  /** Plays days until the first event the user plays has finished. */
  function playFirstEvent(input: CareerSave): CareerSave {
    let save = input;
    for (let guard = 0; guard < 200; guard++) {
      if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day && !save.activeEvent) {
        save = startEvent(save, false);
        save = simEventToEnd(save);
        if (isEventPaused(save)) {
          save = advanceDayFlow(save);
          save = simEventToEnd(save);
        }
        return finishEvent(save);
      }
      save = stepDayForTests(save);
    }
    throw new Error("no event reached");
  }

  it("the series of a real event land in the log and read as a feed; nothing else of the save differs", () => {
    const on = playFirstEvent(base(31_337));
    expect(on.fanFeed).toBeDefined();
    expect(on.fanFeed!.series.length).toBeGreaterThan(0);
    for (const s of on.fanFeed!.series) {
      expect(s.won ? s.us > s.them : s.them > s.us).toBe(true);
      expect(s.opponentName).not.toBe("user");
    }
    const feed = fanFeedFor(on);
    expect(feed.length).toBeGreaterThan(0);
    for (const p of feed) expect(feedTextOf(p, CAREER_FEED_EN.feed)).not.toMatch(/[{}]|undefined/);
    expect(on.stats.seriesWins + on.stats.seriesLosses).toBe(on.fanFeed!.series.length);
  }, 120_000);
});
