/**
 * The profile's "New" state through the REAL store and its persistence (rc.33,
 * COL-02c): an existing save never wakes up to "everything is new" (and is not
 * rewritten by the hydrate), the first arrival after the update is new, opening
 * clears it, the seen state survives a reload, a cloud merge is not news.
 *
 * Like persistContract.test.ts, the store is imported while `window.localStorage`
 * is an in-memory Storage, which it keeps using.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RANKS } from "@/config/balance";
import { nationalSpecialIdsByLineupId, specialCards } from "@/data";
import { nationalTeamKey, profileNewSummary, specialKey } from "@/engine/profileNew";
import { toDurable } from "@/lib/profileSync";

class MemoryStorage implements Storage {
  data = new Map<string, string>();
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

const storage = new MemoryStorage();
const NAME = "rocket-draft:profile:v1";
const VERSION = 12;
const DATE = "2026-06-01T00:00:00.000Z";
let store: typeof import("./profileStore").useProfileStore;

beforeAll(async () => {
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  try {
    store = (await import("./profileStore")).useProfileStore;
  } finally {
    vi.unstubAllGlobals();
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const official = specialCards.filter((sp) => sp.rarity !== "national").map((sp) => sp.id);
const [A, B, C, D] = official;
const summary = () => profileNewSummary(store.getState().newItems, store.getState());

/**
 * A current-version save written before rc.33: no `newItems`, no
 * `nationalDiscovered`. Built through the store so its derived fields (the owned
 * cosmetics) are consistent — a hydrate then has nothing to re-derive — and the
 * memory is left unseeded, like a page that has not loaded the save yet.
 */
function writeOldSave(over: Record<string, unknown> = {}): string {
  store.setState({ ...store.getInitialState(), unlockedSpecials: { [A]: DATE, [B]: DATE }, xp: RANKS[3].minXp, ...over }, true);
  store.getState().refreshCosmetics();
  const state = JSON.parse(JSON.stringify(store.getState())) as Record<string, unknown>;
  delete state.newItems;
  delete state.nationalDiscovered;
  store.setState({ newItems: undefined, nationalDiscovered: {} });
  const raw = JSON.stringify({ state, version: VERSION });
  storage.setItem(NAME, raw);
  return raw;
}

async function reload(): Promise<void> {
  await store.persist.rehydrate();
}

beforeEach(async () => {
  storage.clear();
  store.setState(store.getInitialState(), true);
});

describe("profile 'New' state — never everything new", () => {
  it("an existing save hydrates with NOTHING new, and the hydrate writes nothing back", async () => {
    const raw = writeOldSave();
    const setItem = vi.spyOn(storage, "setItem");
    try {
      await reload();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
    expect(storage.getItem(NAME)).toBe(raw);
    expect(store.getState().newItems).toBeUndefined();
    expect(summary().keys.size).toBe(0); // owned cards and open challenges: all seen
  });

  it("the first arrival after the update is new — only that one", async () => {
    writeOldSave();
    await reload();
    store.getState().collectSpecials([C], "classic");
    const s = summary();
    expect(s.specials).toEqual([C]);
    expect(s.challenges).toEqual([]);
    expect(store.getState().newItems?.seen).toEqual(expect.arrayContaining([specialKey(A), specialKey(B)]));
  });

  it("a fresh profile: what it collects is new", () => {
    store.getState().collectSpecials([D], "classic");
    expect(summary().specials).toEqual([D]);
  });
});

describe("profile 'New' state — opened content clears, and stays cleared", () => {
  it("opening clears the item, and the seen state survives a reload", async () => {
    writeOldSave();
    await reload();
    store.getState().collectSpecials([C, D], "classic");
    expect(summary().specials.sort()).toEqual([C, D].sort());

    store.getState().markItemsSeen([specialKey(C)]);
    expect(summary().specials).toEqual([D]);

    await reload(); // read back from storage
    expect(store.getState().newItems?.seen).toContain(specialKey(C));
    expect(summary().specials).toEqual([D]);
  });

  it("opening an item on an unseeded profile never turns the rest into news", async () => {
    writeOldSave();
    await reload();
    store.getState().markItemsSeen([specialKey(A)]);
    expect(store.getState().newItems).toBeDefined();
    expect(summary().keys.size).toBe(0);
  });

  it("a national team found is a new page until opened; its cards are separate items", async () => {
    writeOldSave();
    await reload();
    const [lineupId, ids] = [...nationalSpecialIdsByLineupId.entries()][0];
    expect(store.getState().discoverNationalTeam(lineupId, ids)).toBe(true);
    expect(store.getState().discoverNationalTeam(lineupId, ids)).toBe(false); // idempotent
    expect(summary().nationalTeams).toEqual([lineupId]);
    expect(summary().nationalCards).toEqual([]); // found, nothing collected
    store.getState().markItemsSeen([nationalTeamKey(lineupId)]);
    expect(summary().nationalTeams).toEqual([]);
  });

  it("a challenge opened by a rank-up is new", async () => {
    writeOldSave({ xp: 0 });
    await reload();
    store.getState().grantXp(RANKS[2].minXp); // → Silver: the Bronze/Silver challenges open
    expect(summary().challenges.length).toBeGreaterThan(0);
  });
});

describe("profile 'New' state — merges are not news", () => {
  it("cards a cloud merge brings in are not new; a card new here stays new", async () => {
    writeOldSave();
    await reload();
    store.getState().collectSpecials([C], "classic"); // new on this device
    const cloud = toDurable(store.getState());
    store.getState().hydrateDurable({
      ...cloud,
      unlockedSpecials: { ...cloud.unlockedSpecials, [D]: DATE },
      nationalDiscovered: { [[...nationalSpecialIdsByLineupId.keys()][0]]: DATE },
    });
    const s = summary();
    expect(s.specials).toEqual([C]);
    expect(s.nationalTeams).toEqual([]);
    expect(store.getState().unlockedSpecials[D]).toBe(DATE);
  });

  it("an unseeded profile stays unseeded through a merge (nothing new)", async () => {
    writeOldSave();
    await reload();
    const cloud = toDurable(store.getState());
    store.getState().hydrateDurable({ ...cloud, unlockedSpecials: { ...cloud.unlockedSpecials, [D]: DATE } });
    expect(store.getState().newItems).toBeUndefined();
    expect(summary().keys.size).toBe(0);
  });
});
