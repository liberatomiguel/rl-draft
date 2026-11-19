/**
 * v2.0.32 (DESIGN-DECISIONS #171) — the inline repair for build files the
 * browser holds as a failed answer. The browser objects are stand-ins; the
 * real thing was checked end to end in Chromium against a server that answers
 * a chunk with a one-year immutable 404 first (CHANGELOG 2.0.32).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSET_HEAL,
  assetHealInlineScript,
  assetHealScript,
  markAppBooted,
  refetchThenReload,
  takeAssetHealNote,
} from "./assetHeal";

const ORIGIN = "https://rocketdraft.app";
const file = (name: string) => `${ORIGIN}/_next/static/chunks/${name}`;

interface Entry {
  name: string;
  initiatorType: string;
  responseStatus?: number;
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

function browser(
  opts: {
    statusSupport?: boolean;
    storage?: MemoryStorage | null | "throws";
    /** HTTP status of the refetch, per URL and attempt (1-based). Default 200. */
    refetch?: (url: string, attempt: number) => number;
    scripts?: string[];
    stylesheets?: string[];
    readyState?: DocumentReadyState;
  } = {},
) {
  const reload = vi.fn();
  const fetches: { url: string; init: RequestInit }[] = [];
  const attempts = new Map<string, number>();
  const fetchStub = vi.fn((url: string, init: RequestInit) => {
    fetches.push({ url, init });
    const n = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, n);
    const status = opts.refetch ? opts.refetch(url, n) : 200;
    return Promise.resolve({ ok: status >= 200 && status < 300, status });
  });
  let deliver: ((entries: Entry[]) => void) | null = null;
  let observed: unknown = null;
  class FakeObserver {
    constructor(cb: (list: { getEntries: () => Entry[] }) => void) {
      deliver = (entries) => cb({ getEntries: () => entries });
    }
    observe(args: unknown): void {
      observed = args;
    }
  }
  class FakeTiming {}
  if (opts.statusSupport !== false) Object.defineProperty(FakeTiming.prototype, "responseStatus", { get: () => 0 });
  const listeners: Record<string, () => void> = {};
  const storage = opts.storage === undefined ? new MemoryStorage() : opts.storage;
  const win: Record<string, unknown> = {
    location: { origin: ORIGIN, reload },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    addEventListener: (type: string, fn: () => void) => {
      listeners[type] = fn;
    },
  };
  Object.defineProperty(win, "sessionStorage", {
    get: () => {
      if (storage === "throws") throw new Error("denied");
      return storage;
    },
  });
  const scripts = (opts.scripts ?? []).map((src) => ({ src, href: "" }));
  const sheets = (opts.stylesheets ?? []).map((href) => ({ src: "", href }));
  const doc = {
    readyState: opts.readyState ?? "loading",
    querySelectorAll: (selector: string) => (selector.includes("script[src]") ? [...scripts, ...sheets] : sheets),
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("fetch", fetchStub);
  vi.stubGlobal("PerformanceObserver", FakeObserver);
  vi.stubGlobal("PerformanceResourceTiming", FakeTiming);
  return {
    reload,
    fetches,
    storage,
    win,
    listeners,
    observed: () => observed,
    deliver: (entries: Entry[]) => deliver?.(entries),
  };
}

const settle = () => vi.runAllTimersAsync();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T18:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("asset repair (v2.0.32)", () => {
  it("a chunk the browser holds as a 404 is fetched again, past the cache, and the page loads once more", async () => {
    const b = browser();
    assetHealScript(ASSET_HEAL);
    expect(b.observed()).toEqual({ type: "resource", buffered: true });
    b.deliver([
      { name: file("0sym80-l3ozyx.js"), initiatorType: "script", responseStatus: 404 },
      { name: file("1ok.js"), initiatorType: "script", responseStatus: 200 },
    ]);
    await settle();
    expect(b.fetches).toEqual([{ url: file("0sym80-l3ozyx.js"), init: { cache: "reload", credentials: "same-origin" } }]);
    expect(b.reload).toHaveBeenCalledTimes(1);
    const store = b.storage as MemoryStorage;
    expect(store.getItem(ASSET_HEAL.noteKey)).toBe("status chunks/0sym80-l3ozyx.js");
    expect(Number(store.getItem(ASSET_HEAL.key))).toBe(Date.now());
  });

  it("repairs once per page load, however the failures arrive", async () => {
    const b = browser();
    assetHealScript(ASSET_HEAL);
    b.deliver([{ name: file("a.js"), initiatorType: "script", responseStatus: 404 }]);
    b.deliver([{ name: file("b.js"), initiatorType: "script", responseStatus: 404 }]);
    await settle();
    expect(b.fetches.map((f) => f.url)).toEqual([file("a.js")]);
    expect(b.reload).toHaveBeenCalledTimes(1);
  });

  it("never twice in a row: a file still failing after a repair is left to the player for a minute", async () => {
    const store = new MemoryStorage();
    store.setItem(ASSET_HEAL.key, String(Date.now() - 10_000));
    const b = browser({ storage: store });
    assetHealScript(ASSET_HEAL);
    b.deliver([{ name: file("a.js"), initiatorType: "script", responseStatus: 404 }]);
    await settle();
    expect(b.fetches).toEqual([]);
    expect(b.reload).not.toHaveBeenCalled();

    store.setItem(ASSET_HEAL.key, String(Date.now() - ASSET_HEAL.windowMs - 1));
    const again = browser({ storage: store });
    assetHealScript(ASSET_HEAL);
    again.deliver([{ name: file("a.js"), initiatorType: "script", responseStatus: 404 }]);
    await settle();
    expect(again.reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing without sessionStorage: nothing could stop a reload loop", async () => {
    for (const storage of [null, "throws"] as const) {
      const b = browser({ storage });
      assetHealScript(ASSET_HEAL);
      b.deliver([{ name: file("a.js"), initiatorType: "script", responseStatus: 404 }]);
      await settle();
      expect(b.fetches).toEqual([]);
      expect(b.reload).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("leaves alone what is not a failed build file the page runs", async () => {
    const b = browser();
    assetHealScript(ASSET_HEAL);
    b.deliver([
      { name: "https://cdn.example.com/_next/static/chunks/a.js", initiatorType: "script", responseStatus: 404 }, // another origin
      { name: `${ORIGIN}/img/orgs/abc.webp`, initiatorType: "img", responseStatus: 404 }, // not a build file
      { name: `${ORIGIN}/career.txt`, initiatorType: "fetch", responseStatus: 404 }, // a route payload
      { name: file("offline.js"), initiatorType: "script", responseStatus: 0 }, // a network failure
      { name: file("fine.js"), initiatorType: "script", responseStatus: 200 },
      { name: file("prefetch.js"), initiatorType: "link", responseStatus: 404 }, // a prefetch / preload
      { name: `${ORIGIN}/_next/static/media/font.woff2`, initiatorType: "css", responseStatus: 404 }, // a font
      { name: file("old.js"), initiatorType: "script" }, // no status reported
    ]);
    await settle();
    expect(b.fetches).toEqual([]);
    expect(b.reload).not.toHaveBeenCalled();
  });

  it("repairs a stylesheet the page applies, not one it only prefetched", async () => {
    const b = browser({ stylesheets: [file("applied.css")] });
    assetHealScript(ASSET_HEAL);
    b.deliver([
      { name: file("prefetched.css"), initiatorType: "link", responseStatus: 404 },
      { name: file("applied.css"), initiatorType: "link", responseStatus: 404 },
    ]);
    await settle();
    expect(b.fetches.map((f) => f.url)).toEqual([file("applied.css")]);
    expect(b.reload).toHaveBeenCalledTimes(1);
  });

  it("asks again while a deploy is still spreading, then reloads either way", async () => {
    const b = browser({ refetch: (_url, attempt) => (attempt < 3 ? 404 : 200) });
    assetHealScript(ASSET_HEAL);
    b.deliver([{ name: file("a.js"), initiatorType: "script", responseStatus: 404 }]);
    await settle();
    expect(b.fetches).toHaveLength(3);
    expect(b.reload).toHaveBeenCalledTimes(1);

    const never = browser({ refetch: () => 404 });
    assetHealScript(ASSET_HEAL);
    never.deliver([{ name: file("b.js"), initiatorType: "script", responseStatus: 404 }]);
    await settle();
    expect(never.fetches).toHaveLength(ASSET_HEAL.retries + 1);
    expect(never.reload).toHaveBeenCalledTimes(1);
  });

  it("without responseStatus (Safari): an app that never mounted gets the page's build files fetched again", async () => {
    const b = browser({
      statusSupport: false,
      scripts: [file("a.js"), `${ORIGIN}/other/vendor.js`, "https://cdn.example.com/x.js"],
      stylesheets: [file("b.css")],
    });
    assetHealScript(ASSET_HEAL);
    expect(b.observed()).toBeNull();
    b.listeners.load?.();
    await vi.advanceTimersByTimeAsync(ASSET_HEAL.watchdogMs - 1);
    expect(b.fetches).toEqual([]);
    await settle();
    expect(b.fetches.map((f) => f.url)).toEqual([file("a.js"), file("b.css")]);
    expect(b.reload).toHaveBeenCalledTimes(1);
    expect((b.storage as MemoryStorage).getItem(ASSET_HEAL.noteKey)).toBe("stalled chunks/a.js,chunks/b.css");
  });

  it("without responseStatus: an app that mounted stands the watchdog down", async () => {
    const b = browser({ statusSupport: false, scripts: [file("a.js")], readyState: "complete" });
    assetHealScript(ASSET_HEAL);
    markAppBooted();
    await settle();
    expect(b.win[ASSET_HEAL.bootFlag]).toBe(true);
    expect(b.fetches).toEqual([]);
    expect(b.reload).not.toHaveBeenCalled();
  });

  it("the inlined script is plain JavaScript that carries its settings", () => {
    const source = assetHealInlineScript();
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain(JSON.stringify(ASSET_HEAL));
    expect(source).not.toMatch(/<\/script|<!--/i);
  });

  it("the note is read once", () => {
    const store = new MemoryStorage();
    store.setItem(ASSET_HEAL.noteKey, "status chunks/a.js");
    expect(takeAssetHealNote(store)).toBe("status chunks/a.js");
    expect(takeAssetHealNote(store)).toBeNull();
    expect(takeAssetHealNote(null)).toBeNull();
    const broken = { getItem: () => { throw new Error("denied"); }, removeItem: () => undefined };
    expect(takeAssetHealNote(broken)).toBeNull();
  });

  it("the error screen's reload fetches the failed chunk first, and reloads even if that fails", async () => {
    const b = browser();
    refetchThenReload("/_next/static/chunks/a.js");
    await settle();
    expect(b.fetches).toEqual([{ url: "/_next/static/chunks/a.js", init: { cache: "reload", credentials: "same-origin" } }]);
    expect(b.reload).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    const offline = browser();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    refetchThenReload("/_next/static/chunks/a.js");
    await settle();
    expect(offline.reload).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    const plain = browser();
    refetchThenReload(null);
    expect(plain.fetches).toEqual([]);
    expect(plain.reload).toHaveBeenCalledTimes(1);
  });
});
