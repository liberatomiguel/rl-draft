/**
 * Lazy run access (rc.26, #60): AppShell and the home menu clear runs through
 * ./lazyRunStore instead of importing the run store (dataset + engine). This
 * pins what that relies on: it reads the key the store persists to, and once
 * the store is loaded a run is cleared right away, as AppShell did before.
 *
 * Runs in node: like persistContract.test.ts, the store is imported while
 * `window.localStorage` is an in-memory stub, so its persist API exists.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RunState } from "@/engine/types";

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
};

let lazy: typeof import("./lazyRunStore");
let useRunStore: typeof import("./runStore").useRunStore;

beforeAll(async () => {
  // Evaluate browser-ish deps BEFORE `window` exists, as the contract test does.
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  lazy = await import("./lazyRunStore");
  useRunStore = (await import("./runStore")).useRunStore;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const run = { phase: "draft", mode: "classic", difficulty: "normal", showOverall: true } as unknown as RunState;

describe("lazy run store access (#60)", () => {
  it("reads the key the run store persists to", () => {
    expect(useRunStore.persist.getOptions().name).toBe(lazy.RUN_STORAGE_KEY);
  });

  it("sees a persisted run, and none in an empty or unreadable save", () => {
    memory.clear();
    expect(lazy.hasPersistedRun()).toBe(false);
    useRunStore.setState({ run });
    expect(lazy.hasPersistedRun()).toBe(true);
    useRunStore.setState({ run: null });
    expect(lazy.hasPersistedRun()).toBe(false);
    memory.set(lazy.RUN_STORAGE_KEY, "{not json");
    expect(lazy.hasPersistedRun()).toBe(false);
  });

  it("clears the run right away once the store is loaded", () => {
    useRunStore.setState({ run });
    lazy.clearRunInProgress();
    expect(useRunStore.getState().run).toBeNull();
    expect(lazy.hasPersistedRun()).toBe(false);
  });
});
