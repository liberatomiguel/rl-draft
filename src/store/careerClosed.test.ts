/**
 * Road to Worlds — ECO-02 (Etapa 2b, R46): an ended career is closed. ONE
 * guard in the store (`withSave` / `withResult`) refuses every action that
 * changes the career on an ended save with "blocked" and leaves the save
 * untouched; only what the end still needs passes — retiring (the legacy
 * screen) and the viewing state (read marks, seen flags).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CAREER_LOAN, CAREER_SAVE } from "@/config/balance";
import { CAREER_INSERTS_CATALOG } from "@/data/career/inserts";
import { firstDayOfWeek, isWindowWeek, weekOfDay } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import { gearNextItem, signableOverallCap } from "@/engine/career/economy";
import type { CareerPlayerView, CareerSave, TransferOffer } from "@/engine/career/types";
import {
  acceptBidFlow,
  advanceDayFlow,
  backerLineOf,
  buyGearFlow,
  buyScoutReportFlow,
  coachCandidatesFor,
  createCareerSave,
  hireCoachFlow,
  releasePlayerFlow,
  renewPlayerFlow,
  resolveInsertFlow,
  signPlayerFlow,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Closed Org",
    abbrev: "CLS",
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

/**
 * A real insolvency: the Backer already used, the books just over the floor,
 * wages far above income, then W2's Monday. rc.32 (M4): the breach that ends
 * a Normal career is CAREER_LOAN.breachesToEnd.normal, so the fixture stands
 * one breach before it, just over the Backer's line on its own wage bill.
 */
function insolventSave(): CareerSave {
  const save = createCareerSave(INPUT, 46_505);
  save.clock.day = firstDayOfWeek(2) - 1;
  save.pendingEventDef = null;
  save.unofficialOffer = null;
  save.pendingInsert = null;
  save.sponsorOffers = null;
  save.finances.loanUsed = true;
  save.finances.loanBreaches = (CAREER_LOAN.breachesToEnd.normal ?? 2) - 1;
  save.finances.loan = null;
  for (const p of save.squad) p.salaryPerSplit = 10_000;
  save.finances.balance = backerLineOf(save).floor + 10;
  return advanceDayFlow(save);
}

describe("ECO-02 — an ended career is closed (the store's one guard)", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, String(value)),
    removeItem: (key: string) => void memory.delete(key),
  };
  let store: typeof import("./careerStore").useCareerStore;

  beforeAll(async () => {
    await import("@/lib/analytics");
    vi.stubGlobal("window", { localStorage: storage });
    store = (await import("./careerStore")).useCareerStore;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("after an insolvency, sign / release / accept a bid / renew / gear / coach / scouting / insert are refused and the save is unchanged", () => {
    const ended = insolventSave();
    expect(ended.phase).toBe("ended");
    expect(ended.end.reason).toBe("insolvency");
    expect(isWindowWeek(weekOfDay(ended.clock.day))).toBe(true);

    // Everything each action needs, so that nothing but the guard can refuse it.
    ended.finances.balance = 1_000_000;
    ended.reputation = 100;
    const [seller, released] = ended.starterIds;
    const bid: TransferOffer = {
      id: "bid:closed",
      direction: "out",
      playerId: seller,
      playerName: "Seller",
      fee: 8_000,
      salaryPerSplit: 0,
      lengthSeasons: 2,
      role: "starter",
      otherRef: Object.values(ended.world.orgs).find((o) => o.region === "SAM")!.ref,
      status: "pending",
      resolveSeason: ended.clock.seasonIndex,
      resolveDay: ended.clock.day + 7,
      factors: [],
    };
    ended.pendingOffers = [bid];
    ended.pendingInsert = { id: CAREER_INSERTS_CATALOG[0].id, day: ended.clock.day };
    const ctx = { careerSeed: ended.careerSeed, seasonIndex: ended.clock.seasonIndex, world: ended.world };
    const fa = ended.world.freeAgentIds
      .map((id) => playerViewById(id, ctx))
      .find((v): v is CareerPlayerView => v !== null && Math.round(v.overall) <= signableOverallCap(ended.reputation))!;
    const coach = coachCandidatesFor(ended)[0];
    const gear = gearNextItem(ended.finances.gear)!;
    expect(fa && coach && gear).toBeTruthy();

    // The same save still running: every one of these goes through.
    const running: CareerSave = {
      ...structuredClone(ended),
      phase: "running",
      end: createCareerSave(INPUT, 46_505).end,
    };
    expect(signPlayerFlow(running, fa.id, { lengthSeasons: 2 }).error).toBeUndefined();
    expect(releasePlayerFlow(running, released).error).toBeUndefined();
    expect(acceptBidFlow(running, bid.id).error).toBeUndefined();
    expect(renewPlayerFlow(running, seller, 2).error).toBeUndefined();
    expect(buyGearFlow(running, gear.id).error).toBeUndefined();
    expect(hireCoachFlow(running, coach).error).toBeUndefined();
    expect(buyScoutReportFlow(running, fa.id).error).toBeUndefined();
    expect(resolveInsertFlow(running, "a").error).toBeUndefined();

    // The ended save in the store: each is refused with "blocked", nothing moves.
    const slots: (CareerSave | null)[] = Array.from({ length: CAREER_SAVE.maxSlots }, (_, i) => (i === 0 ? ended : null));
    store.setState({ slots, activeSlot: 0, lastError: null, toasts: [] });
    const before = JSON.stringify(store.getState().slots[0]);
    const s = () => store.getState();
    const actions: [string, () => void][] = [
      ["sign", () => s().signPlayer(fa.id, { lengthSeasons: 2 })],
      ["release", () => s().releasePlayer(released)],
      ["accept a bid", () => s().acceptBid(bid.id)],
      ["renew", () => s().renewPlayer(seller, 2)],
      ["gear", () => s().buyGear(gear.id)],
      ["coach", () => s().hireCoach(coach)],
      ["scouting", () => s().buyScoutReport(fa.id)],
      ["insert", () => s().resolveInsert("a")],
      // …and the rest of what changes a career: the lineup, a decline, the clock, the money flows.
      ["lineup", () => s().setStarters([ended.starterIds[2], ended.starterIds[0], ended.starterIds[1]])],
      ["decline a bid", () => s().declineBid(bid.id)],
      ["advance", () => s().advanceDay()],
      ["next season", () => s().continueToNextSeason()],
      ["pay the Backer", () => s().payDebt(1_000)],
      ["bank loan", () => s().takeBankLoan(2_000)],
    ];
    for (const [name, act] of actions) {
      store.setState({ lastError: null });
      act();
      expect(s().lastError, name).toBe("blocked");
      expect(JSON.stringify(s().slots[0]), name).toBe(before);
    }

    // What the end still needs passes: the viewing state, then retiring (the ending stays the insolvency).
    store.setState({ lastError: null });
    s().markNewsRead();
    expect(s().lastError).toBeNull();
    expect(s().slots[0]!.news.every((n) => n.read)).toBe(true);
    s().retireCareer();
    expect(s().lastError).toBeNull();
    expect(s().slots[0]!.phase).toBe("ended");
    expect(s().slots[0]!.end.reason).toBe("insolvency");
  });

  // A Worlds title or the Final Whistle ends the timeline but not the career: those saves stay in
  // seasonReview (only an insolvency or a retirement sets phase "ended"), so "Defend the title" and
  // "Endless era" must pass the guard.
  for (const reason of ["worlds_won", "timeline_complete"] as const) {
    it(`a continuable ending (${reason}) is not closed: the next season and the endless era go through`, () => {
      const s = () => store.getState();
      const atReview = (): CareerSave => {
        const save = createCareerSave(INPUT, 46_505);
        save.phase = "seasonReview";
        save.end = { ...save.end, ended: true, reason, endedSeasonIndex: save.clock.seasonIndex, legacyGrade: "legend" };
        return save;
      };

      store.setState({ slots: [atReview(), null, null], activeSlot: 0, lastError: null });
      s().continueToNextSeason();
      expect(s().lastError).not.toBe("blocked");
      expect(s().slots[0]!.phase).toBe("running");
      expect(s().slots[0]!.clock.seasonIndex).toBe(1);

      store.setState({ slots: [atReview(), null, null], activeSlot: 0, lastError: null });
      s().continueInfinite();
      expect(s().lastError).not.toBe("blocked");
      expect(s().slots[0]!.phase).toBe("running");
      expect(s().slots[0]!.end.infinite).toBe(true);
    });
  }
});
