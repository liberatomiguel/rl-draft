/** rc9 LOCKER (R218): the per-player view the Squad screen and HQ read. */
import { afterEach, describe, expect, it } from "vitest";
import { CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { CAREER_LOCKER_EN } from "@/content/copy.career.locker.en";
import { CAREER_LOCKER_PT } from "@/content/copy.career.locker.pt";
import { emptyLockerRoom, lockerStep, type LockerRoomState } from "./lockerRoom";
import { lockerPlayerViewOf, lockerSquadViewOf, moodMatchTable } from "./lockerRoomView";

const SQUAD = [
  { id: "a", overall: 80 },
  { id: "b", overall: 79 },
  { id: "c", overall: 78 },
  { id: "d", overall: 70 },
];
afterEach(() => ((FEATURES as Record<string, unknown>).lockerRoom = false));

describe("lockerPlayerViewOf", () => {
  it("no state: settled, steady, nothing waiting, no reason", () => {
    const v = lockerPlayerViewOf({ clock: { seasonIndex: 0, day: 10 } }, "a");
    expect(v).toEqual({ playerId: "a", morale: L.neutral, mood: "neutral", trend: "steady", reason: null, waiting: false, talkId: null, matchEffect: 0 });
  });

  it("a fall reads as down with its reason; a talk about him is waiting; the reason has copy in both languages", () => {
    let st: LockerRoomState = emptyLockerRoom();
    st = lockerStep(st, { clock: { seasonIndex: 0, day: 10 }, careerSeed: 1, squad: SQUAD, listed: ["b"], bidsRefused: ["c"] }).state;
    const save = { clock: { seasonIndex: 0, day: 12 }, squad: SQUAD, lockerRoom: st };
    const b = lockerPlayerViewOf(save, "b");
    expect(b.trend).toBe("down");
    expect(b.reason?.key).toBe("listed");
    expect(b.mood).toBe("neutral");
    const c = lockerPlayerViewOf(save, "c");
    expect(c.waiting).toBe(true);
    expect(c.talkId).toBe(st.talks[0].id);
    for (const C of [CAREER_LOCKER_EN, CAREER_LOCKER_PT]) for (const v of lockerSquadViewOf(save)) if (v.reason) expect(C.why[v.reason.key]).toBeTruthy();
    // Old changes fall out of the window.
    expect(lockerPlayerViewOf({ ...save, clock: { seasonIndex: 0, day: 60 } }, "b").trend).toBe("steady");
  });

  it("the match table runs from the worst mood to the best inside the team clamp", () => {
    const t = moodMatchTable();
    expect(t.map((r) => r.mood)).toEqual(["angry", "unhappy", "neutral", "content", "delighted"]);
    expect(t[0].points).toBeLessThan(0);
    expect(t[2].points).toBe(0);
    expect(t[4].points).toBeGreaterThan(0);
  });
});
