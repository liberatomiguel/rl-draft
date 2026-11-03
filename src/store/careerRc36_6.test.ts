import { autoplayWaitsForDecision } from "./careerDecisions";
import { describe, expect, it } from "vitest";
import { CAREER_INSERTS_CATALOG } from "@/data/career/inserts";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { regionalDayFor, seasonSchedule, unofficialOfferFor } from "@/engine/career/calendar";
import { deliverMail, deliverNews, repairCommunicationsOnLoad } from "@/engine/career/communications";
import { rollInsertFor } from "@/engine/career/inserts";
import { rescheduleScrimDays, simplePackageOf } from "@/engine/career/training";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { agendaDays } from "@/components/career/careerUi";
import { participationOf } from "@/components/career/event/weekendView";
import { resolveMail, resolveNews } from "@/components/career/news/newsText";
import { advanceDayFlow, advanceToNextStopFlow, createCareerSave, eventFieldFor, finishEvent, setCommunityParticipantsFlow, simEventToEnd, startEvent, userEventDefOnDay, userTeamForEvent } from "./careerFlow";
import { setTrainingPackageFlow } from "./careerTraining";
import { useCareerStore } from "./careerStore";

const input = { identity: { orgName: "Rocket Club", abbrev: "RCT", managerName: "Manager", country: "BR", region: "SAM" as const, crestId: "shield", colors: { primary: "#f97316", secondary: "#102050" }, buffType: "consistency" as const }, difficulty: "normal" as const, rosterKey: "balanced" as const, prefs: { autoEnterUnofficials: false } };
const fresh = (): CareerSave => createCareerSave(input, 36006);
const pkg = simplePackageOf({ objective: "development", workload: "normal", scrims: "even", focus: "balanced" });

describe("rc.36.6 — weekday practice and clock holds", () => {
  it("moves a legacy Thursday booking to the next Tuesday, without dropping it or replaying a past day", () => {
    const bookings = [{ day: 1, oppRef: "old" }, { day: 4, oppRef: "next" }];
    const repaired = rescheduleScrimDays(bookings, 1);
    expect(repaired).toEqual([{ day: 9, oppRef: "next" }]);
    expect(rescheduleScrimDays(repaired, 1)).toEqual(repaired);
  });
  it("runs practice Tuesday/Wednesday on day advance; Skip crosses practice days", () => {
    let save = setTrainingPackageFlow(fresh(), pkg).save;
    expect(agendaDays(save, 1, 7).filter(d => d.kinds.includes("scrim")).map(d => d.dow)).toEqual([2, 3]);
    const skipped = advanceToNextStopFlow(save);
    expect(skipped.clock.day).toBeGreaterThan(3);
    expect(skipped.scrimLog.some(e => e.day === 2)).toBe(true);
    expect(skipped.scrimLog.some(e => e.day === 3)).toBe(true);
    save = advanceDayFlow(save);
    expect(save.clock.day).toBe(2);
    expect(save.scrimLog.map(e => e.day)).toEqual([2]);
    save = advanceDayFlow(save);
    expect(save.clock.day).toBe(3);
    expect(save.scrimLog.map(e => e.day)).toEqual([3, 2]);
    save = advanceDayFlow(save);
    expect(save.clock.day).toBe(4);
    expect(save.scrimLog).toHaveLength(2);
  });

  it("every clock control waits for the recorded scrim, then advances once without replaying rewards", () => {
    const save = setTrainingPackageFlow(fresh(), pkg).save;
    useCareerStore.setState({ slots: [save, null, null], activeSlot: 0, scrimPlayback: null, toasts: [] });
    useCareerStore.getState().advanceDay();
    const after = useCareerStore.getState();
    expect(after.slots[0]!.clock.day).toBe(2);
    const id = after.scrimPlayback!.id;
    const recorded = JSON.stringify(after.slots[0]!.scrimLog);
    after.advanceDay();
    expect(useCareerStore.getState().slots[0]!.clock.day).toBe(2);
    expect(JSON.stringify(useCareerStore.getState().slots[0]!.scrimLog)).toBe(recorded);
    after.finishScrimPlayback(id);
    useCareerStore.getState().advanceDay();
    expect(useCareerStore.getState().slots[0]!.clock.day).toBe(3);
    useCareerStore.getState().advanceToNextStop();
    expect(useCareerStore.getState().slots[0]!.clock.day).toBeGreaterThan(3);
    expect(useCareerStore.getState().scrimPlayback).toBeNull();
    useCareerStore.setState({ slots: [null, null, null], activeSlot: null, scrimPlayback: null, autoAdvance: false, toasts: [] });
  });

  it("keeps the regional visible after a qualifier exit and marks it as spectating", () => {
    const save = fresh();
    const week = seasonSchedule().find(w => w.kind === "regional")!.week;
    const sunday = regionalDayFor(week);
    save.clock.day = sunday;
    const def = userEventDefOnDay(save, sunday)!;
    expect(def.tier).toBe("regional");
    save.competition.qualifiedRefs = { ...save.competition.qualifiedRefs, SAM: { eventId: def.id, refs: Object.keys(save.world.orgs).filter(ref => save.world.orgs[ref].region === "SAM").slice(0, 8) } };
    expect(userEventDefOnDay(save, sunday)?.id).toBe(def.id);
    expect(participationOf(save, def)).toBe("spectating");
  });
});

describe("rc.36.6 — editorial channels and partner events", () => {
  it("keeps public deals in news, private decisions in mail, and practice bookkeeping out of both", () => {
    const save = fresh();
    deliverNews(save, { titleKey: "incomingBid", type: "transfer", priority: 2, params: { player: "Test", org: "Other", fee: 1000 } });
    deliverMail(save, { titleKey: "incomingBid", kind: "offer", fromKey: "agent", params: { player: "Test", org: "Other", fee: 1000 } });
    expect(save.mail.filter(m => m.titleKey === "incomingBid")).toHaveLength(1);
    expect(save.news.some(n => n.titleKey === "incomingBid")).toBe(false);
    deliverNews(save, { titleKey: "scrimWin", type: "training", priority: 1 });
    expect(save.mail.some(m => m.titleKey === "scrimWin")).toBe(false);
    deliverNews(save, { titleKey: "transferFee", type: "transfer", priority: 2, params: { player: "Test", from: "A", to: "B", fee: 1000 } });
    expect(save.news[0].titleKey).toBe("transferFee");
    const resolved = resolveMail(save.mail.find(m => m.titleKey === "incomingBid")!, CAREER_EN);
    expect(resolved.body).toContain("Hello,\n\n");
    expect(resolved.body).toContain("Best regards,");
    deliverNews(save, { titleKey: "resultUser", type: "result", priority: 2, params: { event: "Qualifier", tier: "qualifier" } });
    deliverMail(save, { titleKey: "missedRegional", kind: "club", fromKey: "league", params: { event: "Regional" } });
    expect(save.mail.some(m => m.titleKey === "resultUser" && m.params?.tier === "qualifier")).toBe(false);
  });

  it("moves old private stories once, preserving their date and read state", () => {
    const save = fresh();
    save.news = [{ id: "n:old", seasonIndex: 0, week: 2, day: 9, read: true, type: "org", priority: 2, titleKey: "cashWarning", params: { weeks: 4 } }];
    save.mail = [];
    repairCommunicationsOnLoad(save);
    expect(save.news).toEqual([]);
    expect(save.mail[0]).toMatchObject({ day: 9, read: true, titleKey: "cashWarning" });
    const once = JSON.stringify(save);
    repairCommunicationsOnLoad(save);
    expect(JSON.stringify(save)).toBe(once);
  });

  it("does not roll a random event before the first regional, then allows both new showmatches", () => {
    const save = fresh();
    const first = seasonSchedule().find(w => w.kind === "regional")!.week;
    for (let seed = 1; seed <= 80; seed++) {
      for (let day = 1; day <= regionalDayFor(first); day++) {
        save.clock.day = day;
        save.careerSeed = seed;
        expect(rollInsertFor(save, Math.ceil(day / 7))).toBeNull();
      }
    }
    expect(CAREER_INSERTS_CATALOG.some(i => i.id === "ins-5050-showmatch")).toBe(true);
    expect(CAREER_INSERTS_CATALOG.some(i => i.id === "ins-duds-showmatch")).toBe(true);
    expect(CAREER_EN.inserts.items["ins-5050-showmatch"].title).toContain("50/50");
    expect(CAREER_PT.inserts.items["ins-duds-showmatch"].title).toContain("duds");
    save.clock.day = regionalDayFor(first) + 2;
    save.finances.balance = 100000;
    save.finances.incomeTally = { s: 0, earned: 100000, other: 0, period: 0, otherCount: 0 };
    const rolled = new Set<string>();
    for (let seed = 1; seed <= 5000; seed++) {
      save.careerSeed = seed;
      const event = rollInsertFor(save, first + 1);
      if (event) rolled.add(event.id);
    }
    expect(rolled.has("ins-5050-showmatch")).toBe(true);
    expect(rolled.has("ins-duds-showmatch")).toBe(true);
  });
});

describe("rc.36.6 — occasional community 1v1 and 2v2", () => {
  it.each([1, 2] as const)("a %s-player side uses the chosen players, rejects duplicate seats and resolves deterministically", (size) => {
    let save = fresh();
    const def: CareerEventDef = { id: `test:${size}`, tier: "t3", teamSize: size, seasonIndex: 0, week: 3, day: 20, format: "single", name: `50/50 · ${size}v${size}` };
    save.clock.day = def.day;
    const ids = save.squad.slice(-size).map(p => p.id);
    save.unofficialOffer = def;
    const offered = setCommunityParticipantsFlow(save, ids).save;
    expect(offered.unofficialOffer?.participantIds).toEqual(ids);
    expect(offered.pendingEventDef).toBeNull();
    save.unofficialOffer = null;
    save.pendingEventDef = def;
    save = setCommunityParticipantsFlow(save, ids).save;
    expect(userTeamForEvent(save, save.pendingEventDef!).fieldedIds).toEqual(ids);
    if (size === 2) expect(setCommunityParticipantsFlow(save, [ids[0], ids[0]]).error).toBe("invalid");
    const field = eventFieldFor(save, save.pendingEventDef!).field;
    expect(field).toHaveLength(8);
    for (const side of field) expect(side.playerNames).toHaveLength(size);
    const a = simEventToEnd(startEvent(save, false));
    const b = simEventToEnd(startEvent(save, false));
    expect(a.activeEvent!.tournament).toEqual(b.activeEvent!.tournament);
    expect(a.activeEvent!.fieldedIds).toEqual(ids);
    const done = finishEvent(a);
    expect(done.activeEvent).toBeNull();
    expect(done.eventResults[0].userPlacement).toBeDefined();
    const headline = done.news.find(n => n.titleKey === "resultUser")!;
    expect(resolveNews(headline, CAREER_EN, "en").body).not.toContain("Every placement pays");
  });

  it("generates side events occasionally alongside normal cups and rotates the 50/50 cup", () => {
    const formats = new Set<number>();
    const names = new Set<string>();
    let small = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const def = unofficialOfferFor(0, 3, { userTeamRating: 65, rep: 0, t3EntriesThisSplit: 0, careerSeed: seed })!;
      formats.add(def.teamSize ?? 3);
      if (def.teamSize) small++;
    }
    for (let s = 0; s < 4; s++) for (let w = 1; w <= 32; w++) {
      const def = unofficialOfferFor(s, w, { userTeamRating: 65, rep: 0, t3EntriesThisSplit: 0, careerSeed: 123 });
      if (def) names.add(def.name.split(" · ")[0]);
    }
    expect(formats).toEqual(new Set([1, 2, 3]));
    expect(small).toBeLessThan(40);
    expect(names.has("50/50 Community Cup")).toBe(true);
  });
});

describe("rc.36.9 autoplay intent around inserts", () => {
  it.each([true, false])("preserves the prior Play state (%s) when an insert is answered", playing => {
    const save = fresh();
    save.pendingInsert = { id: "ins-showmatch", day: save.clock.day };
    useCareerStore.setState({ slots: [save, null, null], activeSlot: 0, autoAdvance: playing, scrimPlayback: null, toasts: [] });
    expect(autoplayWaitsForDecision(save)).toBe(true);
    useCareerStore.getState().resolveInsert("b");
    expect(useCareerStore.getState().autoAdvance).toBe(playing);
    expect(autoplayWaitsForDecision(useCareerStore.getState().slots[0]!)).toBe(false);
    useCareerStore.setState({ slots: [null, null, null], activeSlot: null, autoAdvance: false, toasts: [] });
  });
});
