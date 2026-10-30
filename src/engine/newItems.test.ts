/**
 * "New" markers (rc.33, COL-02c) — the pure model: available − seen, seeded so
 * an existing save never wakes up to "everything is new".
 */

import { describe, expect, it } from "vitest";
import {
  itemKey,
  keyId,
  keyKind,
  markSeen,
  newKeys,
  sameKeys,
  seedOnChange,
  seedSeen,
  withQuietArrivals,
} from "./newItems";

describe("newItems — keys", () => {
  it("an item key is <kind>:<id>, and splits back (ids may hold colons)", () => {
    const key = itemKey("sp", "nt-a:b");
    expect(key).toBe("sp:nt-a:b");
    expect(keyKind(key)).toBe("sp");
    expect(keyId(key)).toBe("nt-a:b");
  });
});

describe("newItems — what is new", () => {
  it("an unseeded scope has nothing new, whatever it can show", () => {
    expect(newKeys(undefined, ["sp:a", "sp:b"])).toEqual([]);
  });

  it("new = available and not seen, in available order, deduplicated", () => {
    const state = seedSeen(["sp:a"]);
    expect(newKeys(state, ["sp:b", "sp:a", "sp:c", "sp:b"])).toEqual(["sp:b", "sp:c"]);
  });

  it("a seen item that leaves and comes back (a challenge locked by a season reset) is not new again", () => {
    const state = seedSeen(["ch:x"]);
    expect(newKeys(state, [])).toEqual([]);
    expect(newKeys(state, ["ch:x"])).toEqual([]);
  });
});

describe("newItems — seeding", () => {
  it("the first change seeds from the set BEFORE it: exactly the arrival is new", () => {
    const before = ["sp:a", "sp:b"];
    const after = ["sp:a", "sp:b", "sp:c"];
    const state = seedOnChange(undefined, before, after);
    expect(state).toEqual({ seen: ["sp:a", "sp:b"] });
    expect(newKeys(state, after)).toEqual(["sp:c"]);
  });

  it("no arrival (no change, or only removals — a reset), or an already seeded scope: nothing to write", () => {
    expect(seedOnChange(undefined, ["sp:a"], ["sp:a"])).toBeUndefined();
    expect(seedOnChange(undefined, ["sp:a", "ch:x"], [])).toBeUndefined();
    expect(seedOnChange(seedSeen([]), ["sp:a"], ["sp:a", "sp:b"])).toBeUndefined();
  });

  it("a fresh scope (nothing owned) seeds empty: everything it collects is new", () => {
    const state = seedOnChange(undefined, [], ["sp:a"]);
    expect(newKeys(state, ["sp:a"])).toEqual(["sp:a"]);
  });
});

describe("newItems — opening content", () => {
  it("marks the opened keys seen and returns the same object when nothing changed", () => {
    const state = seedSeen(["sp:a"]);
    const next = markSeen(state, ["sp:b"], ["sp:a", "sp:b"]);
    expect(next).toEqual({ seen: ["sp:a", "sp:b"] });
    expect(markSeen(next, ["sp:b"], ["sp:a", "sp:b"])).toBe(next);
  });

  it("opening one item of an unseeded scope never turns the rest into news", () => {
    const next = markSeen(undefined, ["sp:b"], ["sp:a", "sp:b", "sp:c"]);
    expect(newKeys(next, ["sp:a", "sp:b", "sp:c"])).toEqual([]);
  });
});

describe("newItems — quiet arrivals (a merge is not news)", () => {
  it("what a merge brings in is marked seen; what was new stays new", () => {
    const state = { seen: ["sp:a"] }; // sp:b is new locally
    const next = withQuietArrivals(state, ["sp:a", "sp:b"], ["sp:a", "sp:b", "sp:c"]);
    expect(newKeys(next, ["sp:a", "sp:b", "sp:c"])).toEqual(["sp:b"]);
  });

  it("an unseeded scope stays unseeded (it has seen everything anyway)", () => {
    expect(withQuietArrivals(undefined, [], ["sp:a"])).toBeUndefined();
  });

  it("nothing arrived: the same state", () => {
    const state = seedSeen(["sp:a"]);
    expect(withQuietArrivals(state, ["sp:a"], ["sp:a"])).toBe(state);
  });
});

describe("newItems — sameKeys", () => {
  it("compares sets, not order", () => {
    expect(sameKeys(["a", "b"], ["b", "a", "a"])).toBe(true);
    expect(sameKeys(["a"], ["a", "b"])).toBe(false);
  });
});
