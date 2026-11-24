/**
 * v2.2 Pro (#178): the Pro store creates, selects and deletes careers in its
 * own three slots, and leaves the manager's store alone.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CAREER_PRO } from "@/config/balance";
import { activeProSave, migrateProState, useProStore } from "./proStore";

const INPUT = { name: "Kai", country: "US", region: "NA", startAge: 14, archetype: "playmaker", difficulty: "normal" } as const;

describe("Pro store", () => {
  beforeEach(() => {
    useProStore.setState({ slots: Array.from({ length: CAREER_PRO.slots }, () => null), activeSlot: null });
  });

  it("creates a career in an empty slot and makes it active", () => {
    useProStore.getState().createPro(1, INPUT, 123);
    const s = useProStore.getState();
    expect(s.activeSlot).toBe(1);
    const save = activeProSave(s)!;
    expect(save.player.name).toBe("Kai");
    expect(save.careerSeed).toBe(123);
    expect(save.careerId).toMatch(/^p/);
    expect(typeof save.lastPlayedAt).toBe("number");
  });

  it("never overwrites a taken slot, and ignores a slot out of range", () => {
    useProStore.getState().createPro(0, INPUT, 1);
    useProStore.getState().createPro(0, { ...INPUT, name: "Other" }, 2);
    useProStore.getState().createPro(CAREER_PRO.slots, INPUT, 3);
    const s = useProStore.getState();
    expect(s.slots[0]?.player.name).toBe("Kai");
    expect(s.slots).toHaveLength(CAREER_PRO.slots);
  });

  it("selects and deletes", () => {
    useProStore.getState().createPro(0, INPUT, 1);
    useProStore.getState().createPro(2, { ...INPUT, name: "Second" }, 2);
    useProStore.getState().selectSlot(0);
    expect(useProStore.getState().activeSlot).toBe(0);
    useProStore.getState().selectSlot(1); // empty: ignored
    expect(useProStore.getState().activeSlot).toBe(0);
    useProStore.getState().deleteSlot(0);
    expect(useProStore.getState().slots[0]).toBeNull();
    expect(useProStore.getState().activeSlot).toBeNull();
    expect(useProStore.getState().slots[2]?.player.name).toBe("Second");
  });

  it("the migrate drops an active slot that points at nothing", () => {
    expect(migrateProState({ slots: [null, null, null], activeSlot: 2 }).activeSlot).toBeNull();
    expect(migrateProState({ slots: "broken", activeSlot: "x" })).toStrictEqual({ slots: [null, null, null], activeSlot: null });
  });
});
