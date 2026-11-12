/**
 * v2.0 (P1) — the event lobby never offers a start the flow refuses.
 *
 * The soft lock reported on staging (11/11): a manager stood in a qualifier's
 * lobby and "Play it out" / "Instant result" did nothing. Root cause: the
 * lobby drew its buttons from the roster count alone, while `startEvent` also
 * refuses a starter ruled out with no reserve (R103) — and outside a transfer
 * window the only way out (sit the event out) lived on HQ, not in the lobby.
 * `eventStartBlockOf` is now the one rule both read.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qualifierDefsForWeek } from "@/engine/career/calendar";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import {
  canSkipShortSquadEvent,
  createCareerSave,
  eventStartBlockOf,
  skipShortSquadEventFlow,
  squadHoldFor,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Lobby Test",
    abbrev: "LOB",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

function onDay(save: CareerSave, day: number, def: CareerEventDef): CareerSave {
  const next = structuredClone(save);
  next.clock.day = day;
  next.pendingEventDef = def;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.sponsorOffers = null;
  next.pendingOffers = [];
  next.pendingUnavailability = null;
  return next;
}

const base = createCareerSave(INPUT, 61_001);
const qualifier = qualifierDefsForWeek(0, 4).find((d) => d.region === "SAM")!;

describe("v2.0 (P1) — eventStartBlockOf is the lobby's and the flow's one rule", () => {
  it("a full squad on the matchday starts; any other day is a preview", () => {
    const today = onDay(base, qualifier.day, qualifier);
    expect(eventStartBlockOf(today, qualifier)).toBeNull();
    expect(startEvent(today, true).activeEvent?.def.id).toBe(qualifier.id);
    const eve = onDay(base, qualifier.day - 1, qualifier);
    expect(eventStartBlockOf(eve, qualifier)).toBe("notToday");
    expect(startEvent(eve, true)).toBe(eve);
  });

  it("a starter ruled out with no reserve blocks the start, and the block always has a way out", () => {
    const today = onDay(base, qualifier.day, qualifier);
    today.squad = today.squad.filter((p) => today.starterIds.includes(p.id));
    today.pendingUnavailability = { playerId: today.starterIds[0], eventId: qualifier.id };
    expect(eventStartBlockOf(today, qualifier)).toBe("absentNoReserve");
    // The refusal is the same object (no clone, no store write) …
    expect(startEvent(today, true)).toBe(today);
    expect(startEvent(today, false)).toBe(today);
    // … HQ holds the clock for it and the event can be sat out, whatever the week.
    expect(squadHoldFor(today)?.id).toBe(qualifier.id);
    expect(canSkipShortSquadEvent(today)).toBe(true);
    const skipped = skipShortSquadEventFlow(today).save;
    expect(skipped.pendingEventDef).toBeNull();
    expect(squadHoldFor(skipped)).toBeNull();
  });

  it("a roster under three blocks it too", () => {
    const today = onDay(base, qualifier.day, qualifier);
    today.squad = today.squad.slice(0, 2);
    today.starterIds = [today.squad[0].id, today.squad[1].id, ""];
    expect(eventStartBlockOf(today, qualifier)).toBe("rosterShort");
    expect(startEvent(today, true)).toBe(today);
  });

  it("the lobby reads the rule (it once counted the roster only and offered dead buttons)", () => {
    const src = readFileSync("src/components/career/screens/EventScreen.tsx", "utf8");
    expect(src).toContain("eventStartBlockOf(save, def)");
    expect(src).toContain("squadShortAbsentBody");
  });
});

describe("v2.0 (P1) — an action that throws is never a dead button", () => {
  it("the store leaves the save untouched, names the failure and stops the autoplay", async () => {
    const { useCareerStore } = await import("./careerStore");
    const store = () => useCareerStore.getState();
    store().createCareer(0, INPUT, 61_002);
    const broken = { ...store().slots[0]!, world: null as never, squad: null as never, finances: null as never };
    useCareerStore.setState({ slots: [broken, null, null], autoAdvance: true, lastError: null });
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => store().advanceDay()).not.toThrow();
      expect(() => store().advanceToNextStop()).not.toThrow();
    } finally {
      console.error = quiet;
    }
    expect(store().slots[0]).toBe(broken);
    expect(store().lastError).toBe("actionFailed");
    expect(store().autoAdvance).toBe(false);
  });
});
