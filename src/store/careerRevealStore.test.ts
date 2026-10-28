/**
 * Road to Worlds rc.29 (CAR-02) — the event playback's reveal cursor lives in
 * the session reveal store, mirrored to sessionStorage so a reload replays the
 * unfinished round. Node test env: sessionStorage is stubbed per case and the
 * store module is re-imported (it reads the session once, at creation).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

async function freshStore() {
  vi.resetModules();
  return import("./careerRevealStore");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("career reveal cursor (rc.29 CAR-02)", () => {
  it("a new store picks up this tab's cursors (and nothing else) from sessionStorage", async () => {
    const session = new MemoryStorage();
    session.setItem("rd:career:reveal:42:0:1:major", "3");
    session.setItem("rd:career:reveal:42:0:1:qual1:SAM", "junk");
    session.setItem("rocket-draft:career:v1", "{}");
    vi.stubGlobal("sessionStorage", session);
    const { useCareerRevealStore, revealCursorKey } = await freshStore();
    expect(revealCursorKey(42, "0:1:major")).toBe("42:0:1:major");
    expect(useCareerRevealStore.getState().cursors).toEqual({ "42:0:1:major": 3 });
  });

  it("setCursor writes through to the session; an unchanged value writes nothing", async () => {
    const session = new MemoryStorage();
    vi.stubGlobal("sessionStorage", session);
    const { useCareerRevealStore } = await freshStore();
    const before = useCareerRevealStore.getState();
    before.setCursor("7:0:2:major", 2);
    expect(session.getItem("rd:career:reveal:7:0:2:major")).toBe("2");
    const after = useCareerRevealStore.getState();
    expect(after.cursors["7:0:2:major"]).toBe(2);
    after.setCursor("7:0:2:major", 2);
    expect(useCareerRevealStore.getState()).toBe(after);
    after.setCursor("7:0:2:major", 4);
    expect(session.getItem("rd:career:reveal:7:0:2:major")).toBe("4");
  });

  it("blocked storage: the store still keeps the cursor in memory", async () => {
    vi.stubGlobal("sessionStorage", {
      get length(): number {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    const { useCareerRevealStore } = await freshStore();
    expect(useCareerRevealStore.getState().cursors).toEqual({});
    useCareerRevealStore.getState().setCursor("1:e", 5);
    expect(useCareerRevealStore.getState().cursors["1:e"]).toBe(5);
  });
});
