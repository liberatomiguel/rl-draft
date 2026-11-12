/**
 * rc.54 (Miguel): the first-run tour runs over a FIXED static draft, before
 * the real draw. That demo must never touch the real run: no RNG consumed, the
 * seed and RNG cursor unchanged, nothing written to the run store or its save.
 * Checked against a real run started through the REAL run store.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { coachById, lineupById, playerCardById, subById } from "@/data";
import { VACANT_COACH, VACANT_SUB } from "@/engine/draft";
import type { RunState } from "@/engine/types";
import { DRAFT_TOUR_RUN_ID, draftTourDemo, draftTourLineup } from "./draftTourDemo";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

const RUN_KEY_PREFIX = "rocket-draft:run";
const storage = new MemoryStorage();
let runStore: typeof import("@/store/runStore").useRunStore;

beforeAll(async () => {
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  try {
    await import("@/store/profileStore");
    runStore = (await import("@/store/runStore")).useRunStore;
  } finally {
    vi.unstubAllGlobals();
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function startRun(mode: "classic" | "quick"): RunState {
  runStore.getState().startRun({ mode, difficulty: "normal", showOverall: true, regionLock: null });
  return runStore.getState().run!;
}

const savedRun = (): string | null => {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (key.startsWith(RUN_KEY_PREFIX)) return storage.getItem(key);
  }
  return null;
};

describe("draftTourDemo", () => {
  beforeEach(() => {
    runStore.setState({ run: null });
  });

  it("is a fixed board: one hand-picked lineup, round 1, an empty team, every card pickable", () => {
    const run = startRun("classic");
    const demo = draftTourDemo(run);
    const lineup = draftTourLineup();

    expect(lineupById.get(lineup.id)).toBe(lineup);
    expect(lineup.national ?? false).toBe(false);
    expect(lineup.rareSpawn ?? false).toBe(false);

    expect(demo.runId).toBe(DRAFT_TOUR_RUN_ID);
    expect(demo.draft.round).toBe(1);
    expect(demo.draft.roster).toStrictEqual({});
    expect(demo.draft.takenPersonIds).toStrictEqual([]);
    expect(demo.draft.complete).toBe(false);
    expect(demo.offerNew).toStrictEqual({ round: 1, ids: [] });

    const offer = demo.draft.offer!;
    expect(offer.lineupId).toBe(lineup.id);
    expect(offer.hasPickableCard).toBe(true);
    expect(offer.cards.map((c) => c.kind)).toStrictEqual(["player", "player", "player", "coach", "sub", "org"]);
    // Base cards only: no special is ever rolled for the demo.
    expect(offer.cards.every((c) => c.specialId === undefined)).toBe(true);
    for (const card of offer.cards) {
      if (card.kind === "player") expect(playerCardById.has(card.refId)).toBe(true);
      if (card.kind === "coach") expect(card.refId === VACANT_COACH || coachById.has(card.refId)).toBe(true);
      if (card.kind === "sub") expect(card.refId === VACANT_SUB || subById.has(card.refId)).toBe(true);
      if (card.kind === "org") expect(card.refId).toBe(lineup.orgId);
      expect(card.availability).toBe(card.refId === VACANT_COACH || card.refId === VACANT_SUB ? "vacant" : "available");
    }
  });

  it("follows the run's mode: three player cards in Quick", () => {
    const demo = draftTourDemo(startRun("quick"));
    expect(demo.mode).toBe("quick");
    expect(demo.draft.offer!.cards.map((c) => c.kind)).toStrictEqual(["player", "player", "player"]);
  });

  it("is deterministic: the same board every time, whatever the run's seed", () => {
    const first = startRun("classic");
    const a = draftTourDemo(first);
    const b = draftTourDemo(first);
    expect(b).toStrictEqual(a);
    const second = startRun("classic"); // a new seed, a new real offer
    expect(second.runId).not.toBe(first.runId);
    expect(draftTourDemo(second).draft.offer).toStrictEqual(a.draft.offer);
  });

  it("never touches the real run: no RNG, no mutation, no store write, no save", () => {
    const run = startRun("classic");
    const before = JSON.stringify(run);
    const savedBefore = savedRun();
    expect(savedBefore).not.toBeNull();
    deepFreeze(run); // any write to the run or its draft would throw

    let stateChanges = 0;
    const unsubscribe = runStore.subscribe(() => {
      stateChanges += 1;
    });
    const random = vi.spyOn(Math, "random");
    const setItem = vi.spyOn(storage, "setItem");
    try {
      const demo = draftTourDemo(run);
      draftTourDemo(run);

      // A separate object, down to the parts it changes.
      expect(demo).not.toBe(run);
      expect(demo.draft).not.toBe(run.draft);
      expect(demo.draft.offer).not.toBe(run.draft.offer);

      // The seed and the RNG cursor are the run's own, unmoved.
      expect(demo.seed).toBe(run.seed);
      expect(demo.rngState).toBe(run.rngState);
      expect(random).not.toHaveBeenCalled();

      // The store still holds the very same run, and nothing was saved.
      expect(runStore.getState().run).toBe(run);
      expect(JSON.stringify(runStore.getState().run)).toBe(before);
      expect(stateChanges).toBe(0);
      expect(setItem).not.toHaveBeenCalled();
      expect(savedRun()).toBe(savedBefore);
    } finally {
      unsubscribe();
      random.mockRestore();
      setItem.mockRestore();
    }
  });

  it("the real draft is the same with or without the tour (the next offer follows the run's own RNG)", () => {
    const run = startRun("classic");
    const realOffer = structuredClone(run.draft.offer);
    const cursor = run.rngState;
    for (let i = 0; i < 5; i++) draftTourDemo(run);
    expect(runStore.getState().run!.draft.offer).toStrictEqual(realOffer);
    expect(runStore.getState().run!.rngState).toBe(cursor);
    expect(runStore.getState().run!.draft.round).toBe(1);
  });

  it("the module imports no store and no RNG", () => {
    const source = readFileSync(resolve(__dirname, "draftTourDemo.ts"), "utf8");
    const imports = source.split("\n").filter((line) => line.startsWith("import "));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) {
      expect(line).not.toMatch(/@\/store\//);
      expect(line).not.toMatch(/@\/lib\/rng/);
    }
    expect(source).not.toMatch(/Math\.random|createRng|drawNextOffer\(/);
  });
});
