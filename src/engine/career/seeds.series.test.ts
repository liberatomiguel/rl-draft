/**
 * Matchday slice 1 — the user's own series seed (docs/MATCHDAY-SPEC.md §3 B).
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { deriveSeed, seriesSeed, streams } from "./seeds";

const EVT = streams.event(0, 1, "open", 1, "EU");

describe("seriesSeed", () => {
  it("has a documented stream id", () => {
    expect(streams.series(EVT, "sw:2", "a", "b")).toBe("ser:evt:0:1:open1:EU:sw:2:a:b");
    expect(seriesSeed(7, EVT, "sw:2", "a", "b")).toBe(
      deriveSeed(7, streams.series(EVT, "sw:2", "a", "b")),
    );
  });

  it("is stable: same inputs, same seed (and RNG stream)", () => {
    const s1 = seriesSeed(12345, EVT, "po:0", "team-x", "team-y");
    const s2 = seriesSeed(12345, EVT, "po:0", "team-x", "team-y");
    expect(s1).toBe(s2);
    const r1 = createRng(s1);
    const r2 = createRng(s2);
    for (let i = 0; i < 10; i++) expect(r1.next()).toBe(r2.next());
  });

  it("is an unsigned 32-bit integer", () => {
    for (let i = 0; i < 200; i++) {
      const s = seriesSeed(i * 7919, EVT, `sw:${i % 5}`, `a${i}`, `b${i}`);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 32);
    }
  });

  it("changes with every input", () => {
    const base = seriesSeed(1, EVT, "sw:0", "a", "b");
    expect(seriesSeed(2, EVT, "sw:0", "a", "b")).not.toBe(base);
    expect(seriesSeed(1, streams.worlds(0), "sw:0", "a", "b")).not.toBe(base);
    expect(seriesSeed(1, EVT, "sw:1", "a", "b")).not.toBe(base);
    expect(seriesSeed(1, EVT, "sw:0", "c", "b")).not.toBe(base);
    expect(seriesSeed(1, EVT, "sw:0", "a", "c")).not.toBe(base);
    // Side order matters: the engine draws side A first.
    expect(seriesSeed(1, EVT, "sw:0", "b", "a")).not.toBe(base);
  });

  it("spreads: no collisions across a season's worth of series", () => {
    const seen = new Set<number>();
    let n = 0;
    for (let round = 0; round < 8; round++) {
      for (let t = 0; t < 16; t++) {
        for (let ev = 0; ev < 6; ev++) {
          seen.add(seriesSeed(99, streams.event(0, ev, "open", 1, "EU"), `sw:${round}`, `t${t}`, `t${t + 16}`));
          n++;
        }
      }
    }
    expect(seen.size).toBe(n);
  });
});
