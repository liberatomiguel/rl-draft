import { describe, expect, it } from "vitest";
import {
  AUTO_RELOAD_KEY,
  AUTO_RELOAD_WINDOW_MS,
  chunkUrlOf,
  isChunkLoadError,
  isDomMismatchError,
  recoveryFor,
  shouldAutoReload,
  type ReloadStore,
} from "./errorRecovery";

const memory = (): ReloadStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

// The messages production reported between 12 and 14/11/2026 (PostHog `quality_error`).
const CHUNK = { name: "ChunkLoadError", message: "Failed to load chunk /_next/static/chunks/23eryilslb3rj.js from module 123" };
const DOM_CHROME = { name: "NotFoundError", message: "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node." };
const DOM_FIREFOX = { name: "NotFoundError", message: "Node.removeChild: The node to be removed is not a child of this node" };
const DOM_WEBKIT = { name: "NotFoundError", message: "The object can not be found here." };
const PLAIN = { name: "TypeError", message: "k.specialIds is not iterable" };

describe("error recovery (v2.0.14)", () => {
  it("a failed chunk and a DOM mismatch need a reload; an ordinary error a retry", () => {
    expect(recoveryFor(CHUNK)).toBe("reload");
    for (const e of [DOM_CHROME, DOM_FIREFOX, DOM_WEBKIT]) {
      expect(isDomMismatchError(e)).toBe(true);
      expect(recoveryFor(e)).toBe("reload");
    }
    expect(recoveryFor(PLAIN)).toBe("retry");
    expect(recoveryFor(null)).toBe("retry");
    expect(isChunkLoadError({ name: "Error", message: "Loading chunk 12 failed." })).toBe(true);
  });

  it("reloads by itself once for a failed chunk, then leaves it to the player", () => {
    const store = memory();
    expect(shouldAutoReload(CHUNK, store, 1_000_000)).toBe(true);
    expect(store.data.get(AUTO_RELOAD_KEY)).toBe("1000000");
    expect(shouldAutoReload(CHUNK, store, 1_000_000 + 5_000)).toBe(false);
    expect(shouldAutoReload(CHUNK, store, 1_000_000 + AUTO_RELOAD_WINDOW_MS + 1)).toBe(true);
  });

  it("names the build file a failed chunk asked for, so the reload can fetch it again (v2.0.32)", () => {
    expect(chunkUrlOf(CHUNK)).toBe("/_next/static/chunks/23eryilslb3rj.js");
    expect(chunkUrlOf({ name: "ChunkLoadError", message: "Failed to load chunk /_next/static/chunks/0sym80-l3ozyx.js from module 77" })).toBe(
      "/_next/static/chunks/0sym80-l3ozyx.js",
    );
    expect(chunkUrlOf({ name: "Error", message: "Loading CSS chunk /_next/static/chunks/1a2b.css failed" })).toBe("/_next/static/chunks/1a2b.css");
    // A numbered webpack chunk names no file; other errors are not chunks at all.
    expect(chunkUrlOf({ name: "Error", message: "Loading chunk 12 failed." })).toBeNull();
    expect(chunkUrlOf(PLAIN)).toBeNull();
    expect(chunkUrlOf(DOM_CHROME)).toBeNull();
    expect(chunkUrlOf(null)).toBeNull();
  });

  it("never reloads by itself for other errors, or without storage", () => {
    expect(shouldAutoReload(DOM_CHROME, memory(), 1)).toBe(false);
    expect(shouldAutoReload(PLAIN, memory(), 1)).toBe(false);
    expect(shouldAutoReload(CHUNK, null, 1)).toBe(false);
    const broken: ReloadStore = { getItem: () => { throw new Error("denied"); }, setItem: () => undefined };
    expect(shouldAutoReload(CHUNK, broken, 1)).toBe(false);
  });
});
