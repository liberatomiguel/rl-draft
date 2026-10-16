/**
 * Event-exclusive special cards + Special Hunt (v2.0). Uses synthetic cards so
 * the test is dataset-agnostic; the real curated windows live in specialCards.json.
 */
import { describe, expect, it } from "vitest";
import { SPECIALS } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { eventSpecialsFor, rollSpecial } from "./draft";
import type { SpecialCard } from "./types";

function card(id: string, rarity: SpecialCard["rarity"], event?: SpecialCard["event"]): SpecialCard {
  return {
    id,
    playerId: "p1",
    baseCardId: "p1-card",
    title: id,
    cardType: "moment",
    rarity,
    overall: 90,
    effect: { type: "high_roll", value: 1, description: "x" } as SpecialCard["effect"],
    flavor: "x",
    ...(event ? { event } : {}),
  };
}

const EVENT = card("sp-event", "epic", { from: "2026-11-02", to: "2026-11-08", huntRuns: 4 });
const PLAIN = card("sp-plain", "rare");

describe("eventSpecialsFor", () => {
  it("is live only inside the window (inclusive) and boosted after the hunt threshold", () => {
    expect(eventSpecialsFor([EVENT, PLAIN], "2026-11-01", {})).toBeUndefined();
    expect(eventSpecialsFor([EVENT, PLAIN], "2026-11-02", {})).toEqual({ active: ["sp-event"], boosted: [] });
    expect(eventSpecialsFor([EVENT, PLAIN], "2026-11-08", { "sp-event": { runs: 3 } })).toEqual({ active: ["sp-event"], boosted: [] });
    expect(eventSpecialsFor([EVENT, PLAIN], "2026-11-08", { "sp-event": { runs: 4 } })).toEqual({ active: ["sp-event"], boosted: ["sp-event"] });
    expect(eventSpecialsFor([EVENT, PLAIN], "2026-11-09", { "sp-event": { runs: 9 } })).toBeUndefined();
  });

  it("falls back to the default hunt threshold", () => {
    const noThreshold = card("sp-e2", "rare", { from: "2026-11-02", to: "2026-11-08" });
    expect(eventSpecialsFor([noThreshold], "2026-11-05", { "sp-e2": { runs: SPECIALS.event.defaultHuntRuns - 1 } })?.boosted).toEqual([]);
    expect(eventSpecialsFor([noThreshold], "2026-11-05", { "sp-e2": { runs: SPECIALS.event.defaultHuntRuns } })?.boosted).toEqual(["sp-e2"]);
  });
});

describe("rollSpecial with event cards", () => {
  const FORCE = 1000; // a huge mult forces the first eligible tier to proc

  it("never offers an event card outside its window, even when forced", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      expect(rollSpecial([EVENT], FORCE, rng, undefined, undefined)).toBeUndefined();
      expect(rollSpecial([EVENT], FORCE, rng, ["epic"], { active: [], boosted: [] })).toBeUndefined();
    }
  });

  it("offers it inside the window and bypasses the rank rarity gate", () => {
    const rng = createRng(2);
    const live = { active: ["sp-event"], boosted: [] };
    expect(rollSpecial([EVENT], FORCE, rng, [], live)).toBe("sp-event"); // Unranked gate (no rarities)
    expect(rollSpecial([EVENT], FORCE, rng, ["rare"], live)).toBe("sp-event"); // epic not unlocked
  });

  it("the hunt boost multiplies the event card's chance", () => {
    const trials = 20000;
    const count = (events: { active: string[]; boosted: string[] }) => {
      const rng = createRng(3);
      let hits = 0;
      for (let i = 0; i < trials; i++) if (rollSpecial([EVENT], 1, rng, undefined, events) === "sp-event") hits += 1;
      return hits / trials;
    };
    const base = count({ active: ["sp-event"], boosted: [] });
    const boosted = count({ active: ["sp-event"], boosted: ["sp-event"] });
    expect(base).toBeGreaterThan(SPECIALS.rarityChance.epic * 0.7);
    expect(base).toBeLessThan(SPECIALS.rarityChance.epic * 1.3);
    expect(boosted / base).toBeGreaterThan(SPECIALS.event.huntMultiplier * 0.8);
    expect(boosted / base).toBeLessThan(SPECIALS.event.huntMultiplier * 1.2);
  });

  it("plain cards are unaffected by the event context", () => {
    const rng = createRng(4);
    expect(rollSpecial([PLAIN], FORCE, rng, ["rare"], { active: ["sp-event"], boosted: ["sp-event"] })).toBe("sp-plain");
    expect(rollSpecial([PLAIN], FORCE, rng, ["epic"], undefined)).toBeUndefined(); // rank gate still applies
  });
});
