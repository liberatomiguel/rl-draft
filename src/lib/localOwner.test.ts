/**
 * v2.0.29 (DESIGN-DECISIONS #170): the career slots on a device belong to one
 * account. Moving them aside and back works on raw storage, never loses a
 * career, and tells a loaded career store to follow.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CAREER_PERSIST_KEY,
  CAREER_STASH_PREFIX,
  dropCareerStash,
  forgetLocalOwnerForTests,
  localCareerSwitching,
  asCareerSwitch,
  onLocalCareerReplaced,
  readLocalOwner,
  restoreCareersFor,
  setLocalOwnerStorageForTests,
  stashCareersFor,
  writeLocalOwner,
} from "./localOwner";

class Mem {
  data = new Map<string, string>();
  quota = Infinity;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const used = [...this.data.entries()].reduce((n, [kk, vv]) => n + (kk === k ? 0 : vv.length), 0);
    if (used + v.length > this.quota) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let mem: Mem;
const career = (id: string) => ({ careerId: id, pad: "x".repeat(50) });
const persisted = (slots: unknown[], activeSlot: number | null = null, unlocked: Record<string, string> = {}) =>
  JSON.stringify({ state: { slots, activeSlot, achievements: { unlocked, worldsWonOn: {} } }, version: 3 });
const live = () => JSON.parse(mem.getItem(CAREER_PERSIST_KEY) ?? "null");
const stashOf = (u: string) => JSON.parse(mem.getItem(CAREER_STASH_PREFIX + u) ?? "null");
const ids = (v: { state: { slots: ({ careerId: string } | null)[] } } | null) => v?.state.slots.map((s) => s?.careerId ?? null);

beforeEach(() => {
  mem = new Mem();
  setLocalOwnerStorageForTests(mem);
  forgetLocalOwnerForTests();
});
afterEach(() => setLocalOwnerStorageForTests(undefined));

describe("owner", () => {
  it("is remembered and forgotten", () => {
    expect(readLocalOwner()).toBeNull();
    writeLocalOwner("a");
    expect(readLocalOwner()).toBe("a");
    writeLocalOwner(null);
    expect(readLocalOwner()).toBeNull();
  });
});

describe("career slots", () => {
  it("signing out moves them aside; signing back in brings them back", () => {
    mem.setItem(CAREER_PERSIST_KEY, persisted([career("c1"), null, career("c3")], 2, { a1: "x" }));
    let heard = 0;
    const stop = onLocalCareerReplaced(() => (heard += 1));
    expect(stashCareersFor("A")).toBe(true);
    expect(mem.getItem(CAREER_PERSIST_KEY)).toBeNull();
    expect(ids(stashOf("A"))).toEqual(["c1", null, "c3"]);
    restoreCareersFor("A");
    expect(ids(live())).toEqual(["c1", null, "c3"]);
    expect(live().state.activeSlot).toBe(2);
    expect(live().state.achievements.unlocked).toEqual({ a1: "x" });
    expect(mem.getItem(CAREER_STASH_PREFIX + "A")).toBeNull();
    expect(heard).toBe(2);
    stop();
  });

  it("another account finds no careers and gets none of the stash", () => {
    mem.setItem(CAREER_PERSIST_KEY, persisted([career("c1"), null, null]));
    stashCareersFor("A");
    restoreCareersFor("B");
    expect(mem.getItem(CAREER_PERSIST_KEY)).toBeNull();
    expect(ids(stashOf("A"))).toEqual(["c1", null, null]);
  });

  it("a guest's careers stay in their slots; the account's fill the empty ones and the rest waits", () => {
    mem.setItem(CAREER_STASH_PREFIX + "A", persisted([career("a0"), career("a1"), null]));
    mem.setItem(CAREER_PERSIST_KEY, persisted([career("g0"), null, null], 0));
    restoreCareersFor("A");
    expect(ids(live())).toEqual(["g0", "a1", null]);
    expect(live().state.activeSlot).toBe(0);
    expect(ids(stashOf("A"))).toEqual(["a0", null, null]); // did not fit: kept aside
  });

  it("no room for the stash: the live slots are put back, nothing is lost", () => {
    const raw = persisted([career("c1"), null, null]);
    mem.setItem(CAREER_PERSIST_KEY, raw);
    const older = persisted([null, career("c2"), null]);
    mem.setItem(CAREER_STASH_PREFIX + "A", older);
    const set = mem.setItem.bind(mem);
    mem.setItem = (k: string, v: string) => {
      if (k.startsWith(CAREER_STASH_PREFIX)) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      set(k, v);
    };
    expect(stashCareersFor("A")).toBe(false);
    expect(mem.getItem(CAREER_PERSIST_KEY)).toBe(raw);
    expect(mem.getItem(CAREER_STASH_PREFIX + "A")).toBe(older);
  });

  it("an empty store is simply cleared, and a deleted account drops its stash", () => {
    mem.setItem(CAREER_PERSIST_KEY, persisted([null, null, null]));
    expect(stashCareersFor("A")).toBe(true);
    expect(mem.getItem(CAREER_PERSIST_KEY)).toBeNull();
    expect(mem.getItem(CAREER_STASH_PREFIX + "A")).toBeNull();
    mem.setItem(CAREER_STASH_PREFIX + "A", persisted([career("c1"), null, null]));
    dropCareerStash("A");
    expect(mem.getItem(CAREER_STASH_PREFIX + "A")).toBeNull();
  });

  it("the switch flag covers a synchronous and an async re-read", async () => {
    asCareerSwitch(() => expect(localCareerSwitching()).toBe(true));
    expect(localCareerSwitching()).toBe(false);
    let release!: () => void;
    asCareerSwitch(() => new Promise<void>((r) => (release = r)));
    expect(localCareerSwitching()).toBe(true);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(localCareerSwitching()).toBe(false);
  });
});
