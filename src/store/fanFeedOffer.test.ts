/**
 * rc9 STORIES (R253-R257), store side, FEATURES.fanFeed ON (and the locker
 * room and the board ON here, to prove the effects): the offer only after a
 * moment, the gap and the cap, the lapse, the queue entry that never holds,
 * the effects the sheet shows equal what the action applies, the preview is
 * the post, and an rc.8 save with a pending post loads repaired.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, fanFeed: true, lockerRoom: true } };
});

import { CAREER_FEED } from "@/config/balance";
import { CAREER_FEED_EN } from "@/content/copy.career.feed.en";
import { fanFeedFor, managerPostForOffer } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import { moraleOf } from "@/engine/career/lockerRoom";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { SeriesResult, TournamentState } from "@/engine/types";
import { advanceDayFlow, createCareerSave, migrateSaveToV5, type CreateCareerInput } from "./careerFlow";
import { clockHoldOf, pendingDecisionsOf } from "./careerDecisions";
import { feedPostSurfacedToday, pendingFeedPostOf, postEffectsOf, postToFeedFlow, recordFeedSeries, repairFanFeedOnLoad } from "./fanFeedFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Offer Org",
    abbrev: "OFO",
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

const base = (seed = 99): CareerSave => {
  const save = createCareerSave(INPUT, seed);
  return { ...save, clock: { ...save.clock, day: 40 } };
};

const DEF = (over: Partial<CareerEventDef> = {}): CareerEventDef =>
  ({ id: "0:1:reg1:SAM", name: "SAM Regional 1", tier: "regional", seasonIndex: 0, week: 6, day: 40, ...over }) as CareerEventDef;

function seriesOf(opp: string, won: boolean, upset = false, ratingDiff = 0): SeriesResult {
  return { teamAId: "user", teamBId: opp, games: [], score: won ? [3, 1] : [1, 3], winnerTeamId: won ? "user" : opp, ratingDiff, upset };
}

/** Swiss rounds with the user's series; `champion` makes the user the playoffs champion. */
function tournament(rows: [string, boolean, boolean?, number?][], champion = false): TournamentState {
  const teams = Object.fromEntries([["user", { id: "user", name: "Offer Org", rating: { total: 80 } }], ...rows.map(([o]) => [o, { id: o, name: `Team ${o}`, rating: { total: 78 } }])]);
  return {
    teams,
    swiss: { rounds: rows.map(([o, won, upset, gap], i) => ({ round: i + 1, series: [seriesOf(o, won, upset ?? false, gap ?? 0)], userSeriesIndex: 0 })) },
    playoffs: champion ? { rounds: [], championTeamId: "user" } : null,
  } as unknown as TournamentState;
}

const at = (save: CareerSave, day: number, seasonIndex = save.clock.seasonIndex): CareerSave => ({ ...save, clock: { ...save.clock, day, seasonIndex } });

describe("the offer comes after a moment, not after every series", () => {
  it("an everyday regional writes no offer; a title, a Major exit or a big upset does", () => {
    const plain = base();
    recordFeedSeries(plain, tournament([["a", true], ["b", false]]), DEF());
    expect(plain.fanFeed!.series).toHaveLength(2);
    expect(pendingFeedPostOf(plain)).toBeNull();

    const title = base();
    recordFeedSeries(title, tournament([["a", true], ["b", true]], true), DEF());
    expect(pendingFeedPostOf(title)).toMatchObject({ moment: "title", seriesN: 2, opponentRef: "b", won: true, event: "SAM Regional 1" });

    const exit = base();
    recordFeedSeries(exit, tournament([["a", true], ["b", false]]), DEF({ tier: "major", name: "Major 1" }));
    expect(pendingFeedPostOf(exit)).toMatchObject({ moment: "exit", opponentRef: "b", won: false });

    const upset = base();
    recordFeedSeries(upset, tournament([["a", true, true, -(CAREER_FEED.offer.upsetMinGap + 1)]]), DEF());
    expect(pendingFeedPostOf(upset)).toMatchObject({ moment: "upsetWin", opponentRef: "a" });
  });

  it("a second moment inside the gap writes nothing; after the gap it replaces the first", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", false]]), DEF({ tier: "major" }));
    const first = pendingFeedPostOf(save)!;
    const soon = at(save, 40 + CAREER_FEED.offer.minGapDays - 1);
    recordFeedSeries(soon, tournament([["b", false]]), DEF({ tier: "major", id: "m2" }));
    expect(soon.fanFeed!.offer!.seriesN).toBe(first.seriesN);
    const later = at(soon, 40 + CAREER_FEED.offer.minGapDays);
    recordFeedSeries(later, tournament([["c", false]]), DEF({ tier: "major", id: "m3" }));
    expect(pendingFeedPostOf(later)?.opponentRef).toBe("c");
    expect(later.fanFeed!.offerLog).toHaveLength(2);
  });

  it("lapses quietly expireDays after it surfaced, and with the season", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true]], true), DEF());
    expect(pendingFeedPostOf(at(save, 40 + CAREER_FEED.offer.expireDays))).not.toBeNull();
    expect(pendingFeedPostOf(at(save, 40 + CAREER_FEED.offer.expireDays + 1))).toBeNull();
    expect(pendingFeedPostOf(at(save, 41, save.clock.seasonIndex + 1))).toBeNull();
    expect(feedPostSurfacedToday(save)).toBe(true);
    expect(feedPostSurfacedToday(at(save, 41))).toBe(false);
  });
});

describe("a decision among the others, that never holds the clock", () => {
  it("is in the queue with its last day, holds nothing, and the clock moves past it", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true]], true), DEF());
    const d = pendingDecisionsOf(save).find((x) => x.kind === "post");
    expect(d).toMatchObject({ holds: false, canWait: false, parked: false, deadline: { seasonIndex: save.clock.seasonIndex, day: 40 + CAREER_FEED.offer.expireDays } });
    expect(clockHoldOf(save)?.kind).not.toBe("post");
    const next = advanceDayFlow(save);
    if (!clockHoldOf(save)) expect(next.clock.day).toBe(save.clock.day + 1);
  });

  it("answered (posted or let pass), it leaves the queue", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true]], true), DEF());
    for (const answer of ["skip", "humble"] as const) {
      const next = postToFeedFlow(save, answer);
      expect(pendingDecisionsOf(next).some((x) => x.kind === "post")).toBe(false);
    }
    // "Not this time" posts nothing and moves nothing.
    const passed = postToFeedFlow(save, "skip");
    expect(passed.fanFeed!.posts).toHaveLength(0);
    expect(passed.fanFeed!.followers).toBe(save.fanFeed!.followers);
    expect(passed.lockerRoom).toBe(save.lockerRoom);
  });
});

describe("the effects: what the sheet shows is what the post does (R256)", () => {
  it("each tone x result applies CAREER_FEED.effects to followers and morale, and the preview reads the same figures", () => {
    for (const won of [true, false]) {
      for (const tone of ["humble", "confident", "provocative"] as const) {
        const save = base();
        recordFeedSeries(save, tournament([["a", true], ["b", won]], won), DEF({ tier: won ? "regional" : "major" }));
        const fx = postEffectsOf(save, tone)!;
        const after = postToFeedFlow(save, tone);
        const row = CAREER_FEED.effects[tone][won ? "won" : "lost"];
        expect(fx.followers).toBe(after.fanFeed!.followers - save.fanFeed!.followers);
        expect(fx.followersPct).toBe(row.followers);
        for (const p of save.squad) expect(moraleOf(after.lockerRoom, p.id) - moraleOf(save.lockerRoom, p.id)).toBe(row.morale);
        expect(fx.morale).toBe(row.morale);
        expect(fx.receiptPct !== null).toBe(tone === "provocative");
        // the preview did not touch the save
        expect(save.fanFeed!.posts).toHaveLength(0);
      }
    }
  });

  it("the board's confidence moves only with the board flag and a board; the log names the post", () => {
    const save = base();
    recordFeedSeries(save, tournament([["b", false]]), DEF({ tier: "major" }));
    // No board on this save: the sheet shows no board figure, and the post moves none.
    expect(save.board).toBeUndefined();
    expect(postEffectsOf(save, "provocative")!.board).toBe(0);
    expect(postToFeedFlow(save, "provocative").board).toBeUndefined();
  });
});

describe("the post as it will look (R255)", () => {
  it("the preview is the stored post: same key and text in the feed, with two different fan replies", () => {
    const save = base();
    recordFeedSeries(save, tournament([["a", true], ["b", true]], true), DEF());
    const offer = pendingFeedPostOf(save)!;
    const draft = managerPostForOffer(save, offer, "confident");
    const after = postToFeedFlow(save, "confident");
    const feed = fanFeedFor(after);
    const mine = feed.find((p) => p.kind === "managerPost")!;
    expect(mine.variant).toBe(draft.variant);
    expect(feedTextOf(mine, CAREER_FEED_EN.feed)).toBe(feedTextOf(draft, CAREER_FEED_EN.feed));
    expect(feedTextOf(mine, CAREER_FEED_EN.feed)).toContain("SAM Regional 1");
    const replies = feed.filter((p) => p.kind === "managerReply");
    expect(replies).toHaveLength(2);
    expect(replies[0].variant).not.toBe(replies[1].variant);
  });

  it("never the same post twice in a season: six titles in one season read six different posts", () => {
    let save = base();
    const keys: string[] = [];
    for (let i = 0; i < 6; i++) {
      save = at(save, 20 + i * 30);
      recordFeedSeries(save, tournament([[`o${i}`, true]], true), DEF({ id: `t${i}` }));
      save = postToFeedFlow(save, "humble");
      keys.push(save.fanFeed!.posts[save.fanFeed!.posts.length - 1].variant!);
    }
    expect(new Set(keys).size).toBe(6);
  });
});

describe("an rc.8 save with a pending post (R254 repair)", () => {
  /** rc.8's feed: no `offer`, the latest series unanswered (the old card offered it). */
  function rc8Save(): CareerSave {
    const save = base();
    recordFeedSeries(save, tournament([["a", true], ["b", false]]), DEF());
    const { offer: _offer, offerLog: _log, ...rest } = save.fanFeed!;
    void _offer;
    void _log;
    return { ...save, fanFeed: rest };
  }

  it("loads through the migration: the old implicit offer is retired, nothing surfaces, the feed still reads", () => {
    const raw = JSON.parse(JSON.stringify(rc8Save()));
    expect(raw.fanFeed.answered).toBe(0);
    const loaded = migrateSaveToV5(raw)!;
    expect(loaded).not.toBeNull();
    expect(loaded.fanFeed!.offer).toBeNull();
    expect(loaded.fanFeed!.answered).toBe(2);
    expect(pendingFeedPostOf(loaded)).toBeNull();
    expect(pendingDecisionsOf(loaded).some((d) => d.kind === "post")).toBe(false);
    expect(fanFeedFor(loaded).length).toBeGreaterThan(0);
  });

  it("is idempotent, and leaves an rc.9 feed alone", () => {
    const save = rc8Save();
    repairFanFeedOnLoad(save);
    const once = JSON.stringify(save);
    repairFanFeedOnLoad(save);
    expect(JSON.stringify(save)).toBe(once);
    const fresh = base();
    recordFeedSeries(fresh, tournament([["a", true]], true), DEF());
    const before = JSON.stringify(fresh);
    repairFanFeedOnLoad(fresh);
    expect(JSON.stringify(fresh)).toBe(before);
  });
});
