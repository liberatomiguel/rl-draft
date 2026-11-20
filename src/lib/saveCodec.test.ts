import { afterEach, describe, expect, it, vi } from "vitest";
import { base64ToBytes, bytesToBase64, canGzip, decodeSaveText, encodeSaveText } from "./saveCodec";

afterEach(() => vi.unstubAllGlobals());

function bigText(): string {
  const rows: unknown[] = [];
  for (let i = 0; i < 3600; i++) {
    rows.push({ id: i, name: `Jogador ${i} Ação`, note: "café São Paulo ✓", tag: i % 7 === 0 ? "🚀" : "x", v: (i * 31) % 97 });
  }
  return JSON.stringify({ rows });
}

describe("saveCodec", () => {
  it("gzip round trip of ~300 KB of non-ASCII JSON is identical and much smaller", async () => {
    const text = bigText();
    expect(text.length).toBeGreaterThan(200_000);
    const p = await encodeSaveText(text);
    expect(p.encoding).toBe("gzip");
    expect(p.payload.length).toBeLessThan(text.length / 4);
    expect(await decodeSaveText(p)).toBe(text);
  });

  it("decodes a hand-made json payload", async () => {
    const text = JSON.stringify({ a: "çã🚀" });
    const payload = bytesToBase64(new TextEncoder().encode(text));
    expect(await decodeSaveText({ encoding: "json", payload })).toBe(text);
  });

  it("without CompressionStream it falls back to json and still round-trips", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    expect(canGzip()).toBe(false);
    const text = bigText();
    const p = await encodeSaveText(text);
    expect(p.encoding).toBe("json");
    expect(await decodeSaveText(p)).toBe(text);
  });

  it("decode rejects garbage gzip bytes", async () => {
    const payload = bytesToBase64(new TextEncoder().encode("this is not gzip at all"));
    await expect(decodeSaveText({ encoding: "gzip", payload })).rejects.toBeDefined();
  });

  it("decode rejects a payload that is not base64", async () => {
    await expect(decodeSaveText({ encoding: "json", payload: "!!!not base64!!!" })).rejects.toBeDefined();
  });

  it.each([0, 1, 0x7fff, 0x8000, 0x8001, 0xffff, 0x10000, 0x10001, 100_000])("base64 round trip of %i bytes", (n) => {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = (i * 7 + 13) & 255;
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
