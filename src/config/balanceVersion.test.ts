/**
 * BALANCE_VERSION is hand-bumped by every tuning commit (OBS-01, DESIGN-
 * DECISIONS #145): analytics sends it as `balanceVersion`, so data splits
 * across retunes inside one release. This fingerprint of every balance.ts
 * export (values, and functions by their source; FEATURES excepted, it reads
 * the build's env) fails the suite when a value changes without the bump.
 *
 * When it fails, the message names the fix: add 1 to BALANCE_VERSION in
 * balance.ts and paste the printed FINGERPRINT here, in the same commit.
 */
import { describe, expect, it } from "vitest";
import * as balance from "./balance";

const FINGERPRINT = { balanceVersion: 4, hash: "63f43fc5" };

/** Stable text of any value: sorted keys, functions by their whitespace-free source. */
function canon(value: unknown): string {
  if (typeof value === "function") return `fn:${String(value).replace(/\s+/g, "")}`;
  if (typeof value === "number") return `n:${Object.is(value, -0) ? "-0" : String(value)}`;
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (value instanceof Map) return `map:${canon([...value.entries()])}`;
  if (value instanceof Set) return `set:${canon([...value.values()])}`;
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a, 32 bits, hex. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("BALANCE_VERSION (hand-bumped with every tuning change)", () => {
  it("matches the fingerprint of balance.ts", () => {
    const { BALANCE_VERSION, FEATURES: _features, ...tuned } = balance;
    void _features;
    const hash = fnv1a(canon(tuned));
    const changed = hash !== FINGERPRINT.hash;
    const next = changed && BALANCE_VERSION === FINGERPRINT.balanceVersion ? BALANCE_VERSION + 1 : BALANCE_VERSION;
    const fix =
      next !== BALANCE_VERSION
        ? `balance.ts changed: set BALANCE_VERSION = ${next} in balance.ts and FINGERPRINT = ${JSON.stringify({ balanceVersion: next, hash })} here`
        : `set FINGERPRINT = ${JSON.stringify({ balanceVersion: BALANCE_VERSION, hash })} here`;
    expect({ balanceVersion: BALANCE_VERSION, hash }, fix).toEqual(FINGERPRINT);
  });

  it("is a positive integer", () => {
    expect(Number.isInteger(balance.BALANCE_VERSION) && balance.BALANCE_VERSION > 0).toBe(true);
  });
});
