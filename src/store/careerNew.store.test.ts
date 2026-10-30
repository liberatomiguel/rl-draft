/**
 * rc.34 (UX-06, DESIGN-DECISIONS #154's recipe on the career scope): the
 * store seeds a save's "New" state on the first write that adds a key, marks
 * opened items seen, records the unlock modal's announcements, and keeps it
 * all PER SAVE (inside the slot the persist contract already holds). Buying a
 * toolbox item is opening it.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CAREER_HQ } from "@/config/balance";
import { firstDayOfWeek } from "@/engine/career/calendar";
import { careerNewSummary, contractNewKey, toolboxNewKey } from "@/engine/career/careerNew";
import { useCareerStore } from "./careerStore";

const INPUT = {
  identity: {
    orgName: "Seen Org",
    abbrev: "SEN",
    managerName: "Bot",
    country: "BR",
    region: "SAM" as const,
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency" as const,
  },
  difficulty: "normal" as const,
  style: "balanced" as const,
  rosterKey: "balanced" as const,
};

const active = () => {
  const s = useCareerStore.getState();
  return s.slots[s.activeSlot!]!;
};

/** Puts the active save on the eve of the contract warning week, one deal ending this season. */
function onTheEve(): string {
  const save = structuredClone(active());
  save.squad[0].contractEndSeason = 0;
  save.clock = { seasonIndex: 0, day: firstDayOfWeek(CAREER_HQ.contractWarnFromWeek) - 1 };
  save.pendingEventDef = null;
  save.unofficialOffer = null;
  save.pendingInsert = null;
  save.sponsorOffers = null;
  save.pendingOffers = [];
  const slots = [...useCareerStore.getState().slots];
  slots[useCareerStore.getState().activeSlot!] = save;
  useCareerStore.setState({ slots });
  return save.squad[0].id;
}

describe("careerStore — the career save's \"New\" state (rc.34)", () => {
  beforeEach(() => {
    useCareerStore.setState({ slots: [null, null, null], activeSlot: null, achievements: { unlocked: {}, worldsWonOn: {} }, toasts: [] });
  });

  it("an existing save stays unseeded until something arrives; the arrival is new; opening clears it", () => {
    useCareerStore.getState().createCareer(0, INPUT, 34_301);
    const playerId = onTheEve();
    expect(active().newItems).toBeUndefined();
    useCareerStore.getState().advanceDay(); // the warning week's Monday: his contract arrives
    const save = active();
    expect(save.clock.day).toBe(firstDayOfWeek(CAREER_HQ.contractWarnFromWeek));
    expect(save.newItems).toBeDefined();
    expect(careerNewSummary(save).contracts).toEqual([playerId]);
    useCareerStore.getState().markCareerSeen([contractNewKey(playerId, 0)]);
    expect(careerNewSummary(active()).contracts).toEqual([]);
    // Idempotent: marking again writes nothing.
    const before = useCareerStore.getState().slots;
    useCareerStore.getState().markCareerSeen([contractNewKey(playerId, 0)]);
    expect(useCareerStore.getState().slots).toBe(before);
  });

  it("per save: another slot's state is its own", () => {
    useCareerStore.getState().createCareer(0, INPUT, 34_302);
    onTheEve();
    useCareerStore.getState().advanceDay();
    expect(active().newItems).toBeDefined();
    useCareerStore.getState().createCareer(1, INPUT, 34_303);
    expect(active().newItems).toBeUndefined();
    useCareerStore.getState().selectSlot(0);
    expect(active().newItems).toBeDefined();
  });

  it("the unlock modal's announcement is recorded once; buying the item clears its New mark", () => {
    useCareerStore.getState().createCareer(0, INPUT, 34_304);
    const save = structuredClone(active());
    save.reputation = 8; // peripherals unlock: pretend it arrived through a write
    save.newItems = { seen: [] };
    save.finances.balance = 50_000;
    const slots = [...useCareerStore.getState().slots];
    slots[0] = save;
    useCareerStore.setState({ slots });
    expect(careerNewSummary(active()).toolbox).toEqual(["peripherals"]);
    useCareerStore.getState().markCareerAnnounced([toolboxNewKey("peripherals")]);
    useCareerStore.getState().markCareerAnnounced([toolboxNewKey("peripherals")]);
    expect(active().newAnnounced).toEqual([toolboxNewKey("peripherals")]);
    expect(careerNewSummary(active()).toolbox).toEqual(["peripherals"]); // announced ≠ opened
    useCareerStore.getState().buyGear("peripherals");
    expect(active().finances.gear.peripherals).toBe(true);
    expect(active().newItems!.seen).toContain(toolboxNewKey("peripherals"));
  });
});
