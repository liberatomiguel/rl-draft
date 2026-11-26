/**
 * v2.2 Pro spine (PROSPINE): the contracts the spine promises. Old saves
 * load and play; an offer shown never changes; the counter is fixed by the
 * seed; Advance always moves; the hook never leaks; pro:self never doubles.
 */
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import { createProSave } from "@/engine/career/pro/create";
import { counterOutcomeOf, placeProInOrg, proRosterCount, proSeatOf, removeProFromWorld } from "@/engine/career/pro/offers";
import { decideOrgLineup } from "@/engine/career/pro/lineup";
import type { ProSave } from "@/engine/career/pro/types";
import { playProWeek } from "@/engine/career/pro/weekFlow";
import { PRO_SELF_ID } from "@/engine/career/pro/world";
import { newProBotSave, proBotDecide } from "./proBot";
import {
  acceptProOfferFlow,
  advanceProDayFlow,
  advanceProToNextStopFlow,
  counterProOfferFlow,
  declineProOfferFlow,
  ensureProHost,
  hostOf,
  openProOffersOf,
  proStopOf,
} from "./proFlow";
import { proHooks } from "./proHooks";
import { migrateProState } from "./proStore";

const slice1 = (seed: number): ProSave =>
  createProSave({ name: "Old Save", country: "BR", region: "SAM", startAge: 13, archetype: "playmaker", difficulty: "normal" }, seed, "2.2.0-dev.1");

/** Plays until an open offer of `kind` is on the table (the bot answers nothing else). */
function untilOffer(save: ProSave, kind: "amateur" | "org", max = 1500): ProSave {
  let s = save;
  for (let i = 0; i < max; i++) {
    if (openProOffersOf(s).some((o) => o.kind === kind)) return s;
    if (kind === "org" && openProOffersOf(s).some((o) => o.kind === "amateur")) s = proBotDecide(s);
    s = advanceProToNextStopFlow(s);
  }
  return s;
}

describe("PROSPINE contracts", () => {
  it("the flag is off in tests (the staging build turns it on)", () => {
    expect(FEATURES.proCareer).toBe(false);
  });

  it("a slice-1 save (no host, no spine fields) loads through the store's migrate and plays", () => {
    const old = JSON.parse(JSON.stringify(slice1(77))) as ProSave;
    const { slots } = migrateProState({ slots: [old, null, null], activeSlot: 0 });
    let save = ensureProHost(slots[0]!);
    expect(save.host).toBeTruthy();
    expect(save.clock).toEqual({ seasonIndex: 0, day: 1 });
    for (let i = 0; i < 30; i++) save = advanceProDayFlow(save);
    expect(save.clock.day).toBeGreaterThan(25);
  });

  it("a save whose clock slice 2's week already moved gets a host walked to its date", () => {
    let old = slice1(78);
    for (let i = 0; i < 3; i++) old = playProWeek(old, [{ kind: "rest" }, { kind: "rest" }, { kind: "rest" }]).save;
    const save = ensureProHost(old);
    expect(hostOf(save)!.clock).toEqual(old.clock);
    expect(advanceProDayFlow(save).clock.day).toBe(old.clock.day + 1);
  });

  it("Advance never does nothing on a live save (a season of single days, nothing answered)", () => {
    let save = newProBotSave("NA", "normal", 404, 14);
    for (let i = 0; i < 260; i++) {
      const before = save;
      save = advanceProDayFlow(save);
      const moved = save.clock.day !== before.clock.day || save.clock.seasonIndex !== before.clock.seasonIndex || save.report !== before.report || proStopOf(save)?.kind !== proStopOf(before)?.kind;
      expect(moved, `stuck at S${before.clock.seasonIndex} d${before.clock.day} ${proStopOf(before)?.kind ?? "-"}`).toBe(true);
    }
    expect(save.clock.seasonIndex).toBeGreaterThanOrEqual(1);
    expect(proHooks.onAiEvent).toBeNull();
  }, 300_000);

  it("an offer shown never changes, the counter is the seed's, a declined one stays declined", () => {
    const save = untilOffer(newProBotSave("EU", "easy", 61, 14), "amateur");
    const offer = openProOffersOf(save)[0];
    expect(offer).toBeTruthy();
    // Re-reading (re-opening the screen) is the same object, the next day too until it expires.
    expect(openProOffersOf(save)[0]).toEqual(offer);
    const declined = declineProOfferFlow(save, offer.id);
    expect(declined.offers.find((o) => o.id === offer.id)!.status).toBe("declined");
    expect(acceptProOfferFlow(declined, offer.id)).toBe(declined);
    const fake = { ...offer, kind: "org" as const, counterRisk: 0.5 };
    expect(counterOutcomeOf(save.careerSeed, fake)).toBe(counterOutcomeOf(save.careerSeed, fake));
  });

  it("signing displaces a starter to the bench or free agency; pro:self is on exactly one roster", () => {
    const save = newProBotSave("NA", "normal", 3, 14);
    const ref = Object.keys(save.world.orgs).find((r) => save.world.orgs[r].region === "NA")!;
    const before = save.world.orgs[ref].playerIds;
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0 };
    const a = placeProInOrg(save.world, ref, "starter", ctx);
    expect(proRosterCount(a.world)).toBe(1);
    expect(a.world.orgs[ref].playerIds).toContain(PRO_SELF_ID);
    expect(a.displaced).toBeTruthy();
    expect(before).toContain(a.displaced!.id);
    const where = a.displaced!.to === "reserve" ? a.world.orgs[ref].reserveIds : a.world.freeAgentIds;
    expect(where).toContain(a.displaced!.id);
    // Signing again elsewhere never leaves him on two rosters.
    const other = Object.keys(save.world.orgs).find((r) => r !== ref && save.world.orgs[r].region === "NA")!;
    const b = placeProInOrg(a.world, other, "rotation", ctx);
    expect(proRosterCount(b.world)).toBe(1);
    expect(proSeatOf(b.world)).toEqual({ ref: other, seat: "reserve" });
    // Leaving refills his seat.
    const c = removeProFromWorld(a.world, ctx);
    expect(proRosterCount(c)).toBe(0);
    expect(c.orgs[ref].playerIds.every((id) => id && id !== PRO_SELF_ID)).toBe(true);
  });

  it("the lineup starts the three best by score and benches the rest (the bench is recoverable)", () => {
    const save = newProBotSave("NA", "normal", 3, 14);
    const ref = Object.keys(save.world.orgs).find((r) => save.world.orgs[r].region === "NA")!;
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0 };
    const benched = placeProInOrg(save.world, ref, "rotation", ctx).world;
    const low = decideOrgLineup(benched, ref, 10, ctx);
    expect(low.starts).toBe(false);
    const high = decideOrgLineup(benched, ref, 99, ctx);
    expect(high.starts).toBe(true);
    expect(high.world.orgs[ref].playerIds).toContain(PRO_SELF_ID);
    expect(high.world.orgs[ref].reserveIds!.length).toBe((benched.orgs[ref].reserveIds ?? []).length);
  });

  it("a counter either improves the terms or the org walks away, once", () => {
    let save = untilOffer(newProBotSave("NA", "easy", 1234, 14), "org");
    const offer = openProOffersOf(save).find((o) => o.kind === "org");
    expect(offer, "an org offer within the budget").toBeTruthy();
    if (!offer) return;
    save = counterProOfferFlow(save, offer.id);
    const after = save.offers.find((o) => o.id === offer.id)!;
    if (after.status === "open") {
      expect(after.counter).toBe("improved");
      expect(after.salaryPerSplit).toBeGreaterThan(offer.salaryPerSplit);
      expect(counterProOfferFlow(save, offer.id)).toBe(save);
    } else {
      expect(after.status).toBe("withdrawn");
    }
  }, 300_000);
});
