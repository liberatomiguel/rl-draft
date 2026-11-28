/**
 * v2.3 UI (wave 2): the read-only views the screens use — promise progress and
 * risk, a player's recent changes, the squad mood, the word's standing, what
 * needs the manager on HQ, and the manager's post draft. No rule changes.
 */
import { describe, expect, it } from "vitest";
import { CAREER_LOCKER as L } from "@/config/balance";
import { CAREER_FEED_EN } from "@/content/copy.career.feed.en";
import { managerPostDraftOf } from "./fanFeed";
import { feedTextOf } from "./fanFeedText";
import {
  emptyLockerRoom,
  lockerAttentionOf,
  lockerDaysBetween,
  playerLockerLogOf,
  promiseProgressOf,
  squadMoodOf,
  wordStandingOf,
  type LockerPromise,
  type LockerRoomState,
} from "./lockerRoom";

const at = (day: number) => ({ seasonIndex: 0, day });
const minutes = (over: Partial<LockerPromise> = {}): LockerPromise => ({
  id: "promise:1",
  playerId: "a",
  kind: "minutes",
  made: at(10),
  deadline: at(80),
  need: 3,
  of: 4,
  started: 0,
  seen: 0,
  ...over,
});

describe("locker room views", () => {
  it("reads a minutes promise as starts, events left and risk", () => {
    expect(promiseProgressOf(minutes())).toMatchObject({ started: 0, need: 3, of: 4, eventsLeft: 4, atRisk: false });
    expect(promiseProgressOf(minutes({ started: 1, seen: 2 }))).toMatchObject({ started: 1, eventsLeft: 2, atRisk: true });
    expect(promiseProgressOf(minutes({ started: 2, seen: 2 }))).toMatchObject({ eventsLeft: 2, atRisk: false });
    const stay = promiseProgressOf({ id: "promise:2", playerId: "b", kind: "stay", made: at(10), deadline: at(40), inherited: true });
    expect(stay).toMatchObject({ kind: "stay", atRisk: false, inherited: true });
  });

  it("lists a player's latest changes, newest first, capped", () => {
    const st: LockerRoomState = emptyLockerRoom();
    st.log = [
      { playerId: "a", reason: "bench", delta: -3, morale: 44, on: at(30) },
      { playerId: "b", reason: "played", delta: 1, morale: 51, on: at(30) },
      { playerId: "a", reason: "bench", delta: -3, morale: 47, on: at(20) },
      { playerId: "a", reason: "played", delta: 1, morale: 50, on: at(10) },
    ];
    expect(playerLockerLogOf(st, "a", 2).map((e) => e.morale)).toEqual([44, 47]);
    expect(playerLockerLogOf(null, "a")).toEqual([]);
  });

  it("reads the squad's mood from its average, neutral without a state", () => {
    expect(squadMoodOf(undefined, ["a", "b"])).toBe("neutral");
    const st = emptyLockerRoom();
    st.players.a = { morale: 10, benchRun: 0, lowWeeks: 0 };
    st.players.b = { morale: 20, benchRun: 0, lowWeeks: 0 };
    expect(squadMoodOf(st, ["a", "b"])).toBe("angry");
    expect(squadMoodOf(st, ["a", "b", "c"])).toBe("unhappy");
  });

  it("reads the word: fresh, trusted, damaged", () => {
    expect(wordStandingOf({ kept: 0, broken: 0 })).toBe("fresh");
    expect(wordStandingOf({ kept: 2, broken: 1 })).toBe("trusted");
    expect(wordStandingOf({ kept: 0, broken: 1 })).toBe("damaged");
  });

  it("brings the open talks and the promises at risk of the current squad to HQ", () => {
    const st = emptyLockerRoom();
    st.promises = [minutes({ started: 1, seen: 2 }), minutes({ id: "promise:3", playerId: "b" }), minutes({ id: "promise:4", playerId: "gone", started: 0, seen: 1 })];
    st.talks = [
      { id: "talk:1", playerId: "c", topic: "request", answers: ["sell", "promiseMinutes", "refuse"], neutral: "refuse", opened: at(20), deadline: at(27), variant: 0 },
      { id: "talk:2", playerId: "c", topic: "bench", answers: ["earnIt"], neutral: "earnIt", opened: at(5), deadline: at(12), variant: 0, answer: "earnIt" },
    ];
    const out = lockerAttentionOf({ squad: [{ id: "a" }, { id: "b" }, { id: "c" }], lockerRoom: st });
    expect(out.talks.map((t) => t.id)).toEqual(["talk:1"]);
    expect(out.atRisk.map((p) => p.id)).toEqual(["promise:1"]);
    expect(lockerAttentionOf({ squad: [{ id: "a" }] })).toEqual({ talks: [], atRisk: [] });
  });

  it("counts days across a season boundary", () => {
    expect(lockerDaysBetween(at(10), at(17))).toBe(7);
    expect(lockerDaysBetween({ seasonIndex: 0, day: 224 }, { seasonIndex: 1, day: 1 })).toBe(1);
    expect(L.talkDays).toBeGreaterThan(0);
  });

  it("drafts the manager's post with the copy the feed uses once it is sent", () => {
    // v2.3 FIX: the draft is written after the series (its result, score, event)
    const series = { n: 1, opponentName: "FURIA", us: 3, them: 1, won: true, event: "Garage Series" };
    const draft = managerPostDraftOf({ identity: { orgName: "Kestrel Gaming" } as never, careerSeed: 5 }, series, "confident");
    expect(draft.variant).toMatch(/^managerPost\.(5|6|62|63)$/); // rc9 STORIES: two more confident-after-a-win variants
    expect(feedTextOf(draft, CAREER_FEED_EN.feed)).toMatch(/FURIA/);
  });
});
