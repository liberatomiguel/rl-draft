import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { careerIdOf } from "./careerAnalytics";
import { CURRENT_SAVE_VERSION, createCareerSave, type CreateCareerInput } from "./careerFlow";
import { useCareerStore } from "./careerStore";
import { exportSlotFile, importSaveFile } from "./careerSaveTransfer";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Immutable",
    abbrev: "IMM",
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

const slots = () => useCareerStore.getState().slots;

beforeEach(() => {
  useCareerStore.setState({ slots: [null, null, null], activeSlot: null, lastError: null });
});

function found(slot: number): CareerSave {
  useCareerStore.getState().createCareer(slot, INPUT, 36090);
  return slots()[slot]!;
}

describe("a fresh save", () => {
  it("is at the current saveVersion", () => {
    expect(found(0).saveVersion).toBe(CURRENT_SAVE_VERSION);
  });
});

describe("export / import of a slot file", () => {
  it("export of an empty slot is null", () => {
    expect(exportSlotFile(0)).toBeNull();
  });

  it("export then import into an empty slot keeps the career as it was", () => {
    const original = found(0);
    const out = exportSlotFile(0, new Date("2026-11-17T12:00:00Z"))!;
    expect(out.name).toMatch(/^rocket-draft-.*\.json$/);
    const before = JSON.parse(JSON.stringify(original)) as CareerSave;

    expect(importSaveFile(1, out.text)).toBeNull();
    const imported = slots()[1]!;
    expect(imported).toBeTruthy();
    expect(careerIdOf(imported)).toBe(careerIdOf(original));
    expect(imported.identity).toEqual(original.identity);
    expect(imported.clock).toEqual(original.clock);
    expect(imported.lastPlayedAt).toBe(original.lastPlayedAt);
    expect(imported.saveVersion).toBe(original.saveVersion);
    expect(imported.seq).toBe(original.seq);
    // the source slot is untouched
    expect(JSON.parse(JSON.stringify(slots()[0]))).toEqual(before);
    // importing does not move the active slot
    expect(useCareerStore.getState().activeSlot).toBe(0);
  });

  it("import into an occupied slot is refused and the slot is untouched", () => {
    found(0);
    const out = exportSlotFile(0)!;
    const before = JSON.stringify(slots()[0]);
    expect(importSaveFile(0, out.text)).toBe("slot-taken");
    expect(JSON.stringify(slots()[0])).toBe(before);
  });

  it.each(["", "not json", "[]", '{"format":"rocket-draft-career-save","formatVersion":1}'])("import of garbage %j is an error and the slot stays empty", (text) => {
    const res = importSaveFile(2, text);
    expect(res).not.toBeNull();
    expect(res).not.toBe("slot-taken");
    expect(slots()[2]).toBeNull();
  });

  it("a damaged file is refused", () => {
    found(0);
    const text = exportSlotFile(0)!.text.replace("Immutable", "Immutablf");
    expect(importSaveFile(1, text)).toBe("damaged");
    expect(slots()[1]).toBeNull();
  });
});

describe("adoptSave", () => {
  it("refuses a save from a newer build and leaves the slot untouched", () => {
    const future = createCareerSave(INPUT, 36090);
    future.saveVersion = CURRENT_SAVE_VERSION + 1;
    expect(useCareerStore.getState().adoptSave(1, future)).toBe(false);
    expect(slots()[1]).toBeNull();
  });

  it("refuses a non-save", () => {
    expect(useCareerStore.getState().adoptSave(1, { hello: "world" } as unknown as CareerSave)).toBe(false);
    expect(useCareerStore.getState().adoptSave(1, null as unknown as CareerSave)).toBe(false);
    expect(slots()[1]).toBeNull();
  });

  it("refuses an out-of-range slot", () => {
    const save = createCareerSave(INPUT, 36090);
    expect(useCareerStore.getState().adoptSave(7, save)).toBe(false);
    expect(useCareerStore.getState().adoptSave(-1, save)).toBe(false);
  });

  it("does not change the active slot, and stores a copy", () => {
    found(0);
    const save = createCareerSave(INPUT, 12345);
    expect(useCareerStore.getState().adoptSave(2, save)).toBe(true);
    expect(useCareerStore.getState().activeSlot).toBe(0);
    const stored = slots()[2]!;
    expect(stored).not.toBe(save);
    const snapshot = JSON.stringify(stored);
    save.identity.orgName = "Mutated";
    save.finances.balance += 999;
    expect(JSON.stringify(slots()[2])).toBe(snapshot);
    expect(slots()[2]!.identity.orgName).toBe("Immutable");
  });

  it("replaces an occupied slot when asked to (the sync's own call)", () => {
    found(0);
    const other = createCareerSave(INPUT, 777);
    other.identity.orgName = "Other";
    expect(useCareerStore.getState().adoptSave(0, other)).toBe(true);
    expect(slots()[0]!.identity.orgName).toBe("Other");
  });
});

describe("the write stamp (lastPlayedAt)", () => {
  it("is strictly increasing across real writes, even when the clock repeats or steps back", () => {
    const spy = vi.spyOn(Date, "now");
    try {
      spy.mockReturnValue(5_000_000_000_000);
      const first = found(0);
      useCareerStore.getState().advanceDay();
      const a = slots()[0]!;
      expect(a).not.toBe(first);
      useCareerStore.getState().advanceDay();
      const b = slots()[0]!;
      expect(b).not.toBe(a);
      expect(a.lastPlayedAt!).toBeGreaterThan(first.lastPlayedAt!);
      expect(b.lastPlayedAt!).toBeGreaterThan(a.lastPlayedAt!);
      // the clock steps back
      spy.mockReturnValue(1_000);
      useCareerStore.getState().advanceDay();
      const c = slots()[0]!;
      expect(c).not.toBe(b);
      expect(c.lastPlayedAt!).toBeGreaterThan(b.lastPlayedAt!);
      // a clock that is ahead still wins
      spy.mockReturnValue(9_000_000_000_000);
      useCareerStore.getState().advanceDay();
      expect(slots()[0]!.lastPlayedAt).toBe(9_000_000_000_000);
    } finally {
      spy.mockRestore();
    }
  });
});
