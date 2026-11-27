/**
 * v2.3 FEED: with FEATURES.fanFeed off (every build but staging, and every
 * test that does not mock it) nothing is written and nothing changes: the hook
 * and the action return without touching the save, and a real event plays out
 * to a save with no `fanFeed` field.
 */
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";
import { advanceDayFlow, createCareerSave, finishEvent, isEventPaused, simEventToEnd, startEvent, type CreateCareerInput } from "./careerFlow";
import { stepDayForTests } from "./careerClockForTests";
import { followersOf, pendingFeedPostOf, postToFeedFlow, recordFeedSeries } from "./fanFeedFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Feed Off Org",
    abbrev: "FOO",
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

describe("flag off: the save is untouched", () => {
  it("is off in tests", () => {
    expect((FEATURES as Record<string, unknown>).fanFeed).toBe(false);
  });

  it("the hook writes nothing", () => {
    const save = createCareerSave(INPUT, 11);
    const before = JSON.stringify(save);
    const t = {
      teams: { a: { id: "a", name: "A" } },
      swiss: { rounds: [{ round: 1, series: [{ teamAId: "user", teamBId: "a", games: [], score: [3, 1], winnerTeamId: "user", ratingDiff: 0, upset: false }], userSeriesIndex: 0 }] },
      playoffs: { rounds: [], championTeamId: "user" },
    } as unknown as TournamentState;
    recordFeedSeries(save, t, { id: "e", name: "E", tier: "regional", seasonIndex: 0, week: 2, day: 9 } as CareerEventDef);
    expect(JSON.stringify(save)).toBe(before);
    expect(save.fanFeed).toBeUndefined();
  });

  it("the action and the readers do nothing, even on a save that holds a feed", () => {
    const save: CareerSave = {
      ...createCareerSave(INPUT, 11),
      fanFeed: {
        v: 1,
        seq: 2,
        series: [{ n: 1, seasonIndex: 0, week: 2, eventId: "e", event: "E", opponentRef: "a", opponentName: "A", us: 3, them: 1, won: true, upset: false }],
        posts: [],
        answered: 0,
        followers: 500,
      },
    };
    expect(postToFeedFlow(save, "provocative")).toBe(save);
    expect(postToFeedFlow(save, "skip")).toBe(save);
    expect(pendingFeedPostOf(save)).toBeNull();
    expect(followersOf(save)).toBeNull();
  });

  it("a real event leaves no fanFeed field", () => {
    let save = createCareerSave(INPUT, 31_337);
    for (let guard = 0; guard < 200; guard++) {
      if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day && !save.activeEvent) {
        save = startEvent(save, false);
        save = simEventToEnd(save);
        if (isEventPaused(save)) {
          save = advanceDayFlow(save);
          save = simEventToEnd(save);
        }
        save = finishEvent(save);
        break;
      }
      save = stepDayForTests(save);
    }
    expect(save.eventResults.length).toBeGreaterThan(0);
    expect(save.fanFeed).toBeUndefined();
    expect(JSON.stringify(save)).not.toContain("fanFeed");
  }, 120_000);
});
