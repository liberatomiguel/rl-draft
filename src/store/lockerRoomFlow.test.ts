/**
 * v2.3 LOCKER (wave 1): the store side. Flag off = the save untouched and the
 * career unchanged over a few advanced weeks; flag on = the facts of a write
 * reach the locker room, talks reach the inbox and are answered there.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { growthCtxOf } from "@/engine/career/development";
import { openTalksOf } from "@/engine/career/lockerRoom";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { CAREER_EN } from "@/content/copy.career.en";
import { stepDayForTests } from "./careerClockForTests";
import { createCareerSave, finishEvent, resolveInsertFlow, simEventToEnd, startEvent, type CreateCareerInput } from "./careerFlow";
import { answerLockerTalkFlow, lockerFactsOf, lockerRoomAfter } from "./lockerRoomFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Locker Org",
    abbrev: "LCK",
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

function fresh(seed = 23_001): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:0:${w}`] = true;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  return save;
}

const setFlag = (on: boolean) => ((FEATURES as Record<string, unknown>).lockerRoom = on);
afterEach(() => setFlag(false));

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
    if (hook && save !== prev) lockerRoomAfter(prev, save);
  }
  return save;
}

describe("flag off", () => {
  it("writes nothing and plays exactly as without the hook over six weeks", () => {
    expect(FEATURES.lockerRoom).toBe(false);
    const plain = walk(fresh(), 42, false);
    const hooked = walk(fresh(), 42, true);
    expect(plain.eventResults.some((r) => r.rows.some((row) => row.ref === "user"))).toBe(true);
    expect(hooked).not.toHaveProperty("lockerRoom");
    expect(JSON.stringify(hooked)).toBe(JSON.stringify(plain));
    expect(growthCtxOf({ ...plain, lockerRoom: { v: 1, players: { x: { morale: 0, benchRun: 0, lowWeeks: 0 } }, promises: [], talks: [], word: { kept: 0, broken: 0 }, losingRun: 0, seq: 0, log: [] } })).not.toHaveProperty("moraleFactors");
    expect(answerLockerTalkFlow(plain, "talk:1", "earnIt").error).toBe("unknown");
  }, 120_000);
});

describe("flag on", () => {
  it("weeks and events played reach the locker room; its mail resolves", () => {
    setFlag(true);
    const save = walk(fresh(), 42, true);
    const st = save.lockerRoom!;
    expect(st).toBeDefined();
    expect(st.log.length).toBeGreaterThan(0);
    expect(st.log.some((e) => e.reason === "played")).toBe(true);
    for (const p of save.squad) expect(st.players[p.id]?.morale ?? L.neutral).toBeGreaterThanOrEqual(0);
    const mails = save.mail.filter((m) => m.titleKey.startsWith("locker"));
    for (const m of mails) expect(CAREER_EN.locker.mail.tpl[m.titleKey], m.titleKey).toBeDefined();
    // The same walk twice: deterministic.
    expect(JSON.stringify(walk(fresh(), 42, true).lockerRoom)).toBe(JSON.stringify(st));
  }, 120_000);

  it("derives listing, sale and a refused bid from the saves; the talk is answered from the inbox", () => {
    setFlag(true);
    const base = fresh();
    const [p0, p1, p2] = base.squad;
    // A bid refused today: gone the same day, the player still here.
    const offer = { id: "o1", direction: "out", playerId: p0.id, status: "pending", fee: 1 } as unknown as TransferOffer;
    const withBid = { ...structuredClone(base), pendingOffers: [offer] };
    const refused = structuredClone(withBid);
    refused.pendingOffers = [];
    expect(lockerFactsOf(withBid, refused)?.bidsRefused).toEqual([p0.id]);
    lockerRoomAfter(withBid, refused);
    const talk = openTalksOf(refused.lockerRoom)[0];
    expect(talk).toMatchObject({ playerId: p0.id, topic: "bid" });
    const mail = refused.mail.find((m) => m.params?.talkId === talk.id)!;
    expect(mail.titleKey).toBe("lockerTalk_bid");
    expect(CAREER_EN.locker.mail.body[mail.bodyKey!]?.(mail.params!)).toContain(p0.name);

    const answered = answerLockerTalkFlow(refused, talk.id, "promiseStay");
    expect(answered.error).toBeUndefined();
    expect(answered.save.lockerRoom!.promises).toMatchObject([{ playerId: p0.id, kind: "stay" }]);
    expect(answered.save.lockerRoom!.players[p0.id].morale).toBe(L.neutral + L.promise.calm);
    expect(refused.lockerRoom!.promises).toHaveLength(0); // the input save is untouched

    // Listed: a new transfer-list entry breaks the stay promise.
    const listed = structuredClone(answered.save);
    listed.transferList = [{ playerId: p0.id, ask: 1, seasonIndex: 0, day: listed.clock.day, answerDay: listed.clock.day + 3, status: "waiting" }];
    expect(lockerFactsOf(answered.save, listed)?.listed).toEqual([p0.id]);
    lockerRoomAfter(answered.save, listed);
    expect(listed.lockerRoom!.word).toEqual({ kept: 0, broken: 1 });
    expect(listed.mail.some((m) => m.titleKey === "lockerPromiseBroken")).toBe(true);

    // Sold: gone from the squad with a fresh soldOn entry; released: gone without one.
    const sold = structuredClone(base);
    sold.squad = sold.squad.filter((p) => p.id !== p1.id && p.id !== p2.id);
    sold.soldOn = { [p1.id]: { seasonIndex: 0, day: sold.clock.day } };
    expect(lockerFactsOf(base, sold)?.departed).toEqual([
      { id: p1.id, sold: true },
      { id: p2.id, sold: false },
    ]);
  });

  it("an unanswered talk never holds: it closes itself a week later", () => {
    setFlag(true);
    const base = fresh();
    const offer = { id: "o1", direction: "out", playerId: base.squad[0].id, status: "pending", fee: 1 } as unknown as TransferOffer;
    const withBid = { ...structuredClone(base), pendingOffers: [offer] };
    const refused = structuredClone(withBid);
    refused.pendingOffers = [];
    lockerRoomAfter(withBid, refused);
    const later = walk(refused, L.talkDays + 1, true);
    expect(openTalksOf(later.lockerRoom)).toHaveLength(0);
    expect(later.lockerRoom!.talks[0]).toMatchObject({ answer: "focus", auto: true });
    expect(later.mail.some((m) => m.titleKey === "lockerTalkAuto")).toBe(true);
    expect(later.clock.day).toBeGreaterThanOrEqual(refused.clock.day + L.talkDays);
  }, 120_000);
});
