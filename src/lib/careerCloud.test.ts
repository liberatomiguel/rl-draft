import { describe, expect, it } from "vitest";
import {
  CAREER_CLOUD_SLOTS,
  baseFor,
  decideSlot,
  emptyBook,
  newerSide,
  parseBook,
  withBase,
  withLocalDelete,
  type CloudSlotMeta,
  type DecideInput,
  type LocalSlotInfo,
  type SlotBase,
} from "./careerCloud";

const MAX = 5;
const local = (over: Partial<LocalSlotInfo> = {}): LocalSlotInfo => ({ careerId: "A", stamp: 100, seq: 7, saveVersion: MAX, ...over });
const cloud = (over: Partial<CloudSlotMeta> = {}): CloudSlotMeta => ({
  slot: 0,
  careerId: "A",
  saveVersion: MAX,
  seq: 7,
  revision: 3,
  savedAt: 100,
  updatedAt: 999,
  deviceId: "d",
  summary: {},
  ...over,
});
const base = (over: Partial<SlotBase> = {}): SlotBase => ({ careerId: "A", revision: 3, stamp: 100, ...over });
const decide = (i: Partial<DecideInput>) => decideSlot({ local: null, cloud: null, base: null, maxSaveVersion: MAX, ...i });

describe("decideSlot: one side or none", () => {
  it("both empty: idle, base forgotten (whatever the base said)", () => {
    expect(decide({})).toEqual({ type: "idle", base: null });
    expect(decide({ base: base() })).toEqual({ type: "idle", base: null });
  });

  it.each([
    ["no base", null, { type: "upload", expectedRevision: null }],
    ["base of the same career", base(), { type: "conflict", kind: "cloud-deleted" }],
    ["base of another career", base({ careerId: "B" }), { type: "upload", expectedRevision: null }],
    ["base of the same career marked deleted", base({ deleted: true }), { type: "upload", expectedRevision: null }],
  ])("local only, %s", (_n, b, expected) => {
    expect(decide({ local: local(), base: b })).toEqual(expected);
  });

  it.each([
    ["no base", null, cloud(), { type: "download" }],
    ["base without the delete mark", base(), cloud(), { type: "download" }],
    ["deleted mark, same career and revision", base({ deleted: true }), cloud(), { type: "delete-cloud", careerId: "A" }],
    ["deleted mark but the revision moved", base({ deleted: true }), cloud({ revision: 4 }), { type: "download" }],
    ["deleted mark of another career", base({ deleted: true, careerId: "B" }), cloud(), { type: "download" }],
    ["newer build", null, cloud({ saveVersion: MAX + 1 }), { type: "newer-build" }],
    ["newer build beats a delete mark", base({ deleted: true }), cloud({ saveVersion: MAX + 1 }), { type: "newer-build" }],
  ])("cloud only, %s", (_n, b, c, expected) => {
    expect(decide({ cloud: c, base: b })).toEqual(expected);
  });
});

describe("decideSlot: both sides, same career", () => {
  it("unchanged / unchanged: idle, the base carries the cloud revision and the local stamp", () => {
    expect(decide({ local: local(), cloud: cloud(), base: base() })).toEqual({
      type: "idle",
      base: { careerId: "A", revision: 3, stamp: 100 },
    });
  });
  it("local changed only: upload expecting the cloud revision", () => {
    expect(decide({ local: local({ stamp: 150 }), cloud: cloud(), base: base() })).toEqual({ type: "upload", expectedRevision: 3 });
  });
  it("cloud changed only: download", () => {
    expect(decide({ local: local(), cloud: cloud({ revision: 4, savedAt: 200 }), base: base() })).toEqual({ type: "download" });
  });
  it("both changed: conflict diverged", () => {
    expect(decide({ local: local({ stamp: 150 }), cloud: cloud({ revision: 4, savedAt: 200 }), base: base() })).toEqual({
      type: "conflict",
      kind: "diverged",
    });
  });
  it("no base but the very same copy: adopt", () => {
    expect(decide({ local: local(), cloud: cloud() })).toEqual({ type: "adopt", base: { careerId: "A", revision: 3, stamp: 100 } });
  });
  it("no base and different: conflict diverged", () => {
    expect(decide({ local: local({ stamp: 150 }), cloud: cloud() })).toEqual({ type: "conflict", kind: "diverged" });
    expect(decide({ local: local({ seq: 8 }), cloud: cloud() })).toEqual({ type: "conflict", kind: "diverged" });
  });
  it("cloud newer saveVersion: newer-build, never an upload", () => {
    expect(decide({ local: local({ stamp: 150 }), cloud: cloud({ saveVersion: MAX + 1 }), base: base() })).toEqual({ type: "newer-build" });
  });
});

describe("decideSlot: both sides, different careers", () => {
  it("the base matches the cloud row AND carries the delete mark: this player replaced the career, upload expecting that revision", () => {
    expect(decide({ local: local({ careerId: "B" }), cloud: cloud(), base: base({ deleted: true }) })).toEqual({ type: "upload", expectedRevision: 3 });
  });
  it("the base matches the cloud row but has no delete mark (a second account on a shared browser): a question", () => {
    expect(decide({ local: local({ careerId: "B" }), cloud: cloud(), base: base() })).toEqual({ type: "conflict", kind: "different-career" });
  });
  it.each([
    ["no base", null],
    ["revision moved", base({ revision: 2, deleted: true })],
    ["base of a third career", base({ careerId: "C", deleted: true })],
  ])("otherwise conflict different-career (%s)", (_n, b) => {
    expect(decide({ local: local({ careerId: "B" }), cloud: cloud(), base: b })).toEqual({ type: "conflict", kind: "different-career" });
  });
  it("cloud newer saveVersion: newer-build", () => {
    expect(decide({ local: local({ careerId: "B" }), cloud: cloud({ saveVersion: MAX + 1 }), base: base({ deleted: true }) })).toEqual({ type: "newer-build" });
  });
});

describe("decideSlot: never overwrites local progress silently", () => {
  it("over every combination, a download / delete-cloud never follows a local change, and an upload carries null or the cloud revision", () => {
    const locals: (LocalSlotInfo | null)[] = [
      null,
      local(),
      local({ stamp: 150 }),
      local({ seq: 9 }),
      local({ careerId: "B" }),
      local({ careerId: "B", stamp: 100 }),
    ];
    const clouds: (CloudSlotMeta | null)[] = [
      null,
      cloud(),
      cloud({ revision: 4, savedAt: 200 }),
      cloud({ careerId: "B" }),
      cloud({ saveVersion: MAX + 1 }),
    ];
    const bases: (SlotBase | null)[] = [
      null,
      base(),
      base({ stamp: 50 }),
      base({ revision: 2 }),
      base({ careerId: "B" }),
      base({ deleted: true }),
      base({ deleted: true, careerId: "B", revision: 4 }),
    ];
    let combos = 0;
    for (const l of locals) {
      for (const c of clouds) {
        for (const b of bases) {
          combos++;
          const action = decide({ local: l, cloud: c, base: b });
          const localChanged = Boolean(l) && !(b && !b.deleted && b.careerId === l!.careerId && b.stamp === l!.stamp);
          if (localChanged && l) {
            expect(action.type, JSON.stringify({ l, c, b })).not.toBe("download");
            expect(action.type, JSON.stringify({ l, c, b })).not.toBe("delete-cloud");
          }
          if (action.type === "upload") {
            expect(action.expectedRevision === null || action.expectedRevision === c?.revision, JSON.stringify({ l, c, b })).toBe(true);
          }
        }
      }
    }
    expect(combos).toBe(6 * 5 * 7);
  });
});

describe("newerSide", () => {
  it("marks the cloud only when it is strictly newer", () => {
    expect(newerSide(100, 200)).toBe("cloud");
    expect(newerSide(200, 100)).toBe("local");
    expect(newerSide(100, 100)).toBe("local");
  });
});

describe("the book", () => {
  const newId = () => "d-new";

  it.each([[null], [""], ["not json {"], ["42"], ["null"], ['"str"']])("parseBook(%j) gives an empty book with a new device id", (raw) => {
    expect(parseBook(raw, newId)).toEqual({ deviceId: "d-new", users: {} });
  });

  it("keeps a valid device id, replaces a missing / non-string / oversized one", () => {
    expect(parseBook(JSON.stringify({ deviceId: "mine", users: {} }), newId).deviceId).toBe("mine");
    expect(parseBook(JSON.stringify({ deviceId: 5 }), newId).deviceId).toBe("d-new");
    expect(parseBook(JSON.stringify({ deviceId: "" }), newId).deviceId).toBe("d-new");
    expect(parseBook(JSON.stringify({ deviceId: "x".repeat(65) }), newId).deviceId).toBe("d-new");
  });

  it("always gives three slots per user and drops malformed slots, keeping the delete mark", () => {
    const raw = JSON.stringify({
      deviceId: "d",
      users: {
        u1: {
          slots: [
            { careerId: "A", revision: 2, stamp: 5, deleted: true },
            { careerId: 5, revision: 2, stamp: 5 },
            { careerId: "C", revision: "2", stamp: 5 },
            { careerId: "D", revision: 1, stamp: 1 },
          ],
        },
        u2: { slots: "nope" },
        u3: null,
        u4: {},
      },
    });
    const book = parseBook(raw, newId);
    expect(book.users.u1.slots).toEqual([{ careerId: "A", revision: 2, stamp: 5, deleted: true }, null, null]);
    for (const u of ["u1", "u2", "u3", "u4"]) expect(book.users[u].slots).toHaveLength(CAREER_CLOUD_SLOTS);
    expect(book.users.u2.slots).toEqual([null, null, null]);
  });

  it("does not carry unknown fields into a base", () => {
    const raw = JSON.stringify({ deviceId: "d", users: { u: { slots: [{ careerId: "A", revision: 1, stamp: 1, extra: "x" }] } } });
    expect(parseBook(raw, newId).users.u.slots[0]).toEqual({ careerId: "A", revision: 1, stamp: 1 });
  });

  it("withBase sets one slot, creates the user, and does not mutate its input", () => {
    const b0 = emptyBook("d");
    const frozen = JSON.stringify(b0);
    const b1 = withBase(b0, "u", 1, base());
    expect(JSON.stringify(b0)).toBe(frozen);
    expect(b1.users.u.slots).toEqual([null, base(), null]);
    expect(baseFor(b1, "u", 1)).toEqual(base());
    expect(baseFor(b1, "u", 0)).toBeNull();
    expect(baseFor(b1, "nobody", 0)).toBeNull();
    const snapshot = JSON.stringify(b1);
    const b2 = withBase(b1, "u", 1, null);
    expect(JSON.stringify(b1)).toBe(snapshot);
    expect(b2.users.u.slots).toEqual([null, null, null]);
    expect(b2.deviceId).toBe("d");
  });

  describe("withLocalDelete", () => {
    const shared = () => {
      let b = emptyBook("d");
      b = withBase(b, "u1", 0, base());
      b = withBase(b, "u2", 0, base({ revision: 9 }));
      b = withBase(b, "u1", 1, base({ careerId: "B" }));
      return b;
    };

    it("signed in: marks only that account, and only when it holds that career in that slot", () => {
      const b = shared();
      const frozen = JSON.stringify(b);
      const next = withLocalDelete(b, 0, "A", "u1");
      expect(JSON.stringify(b)).toBe(frozen);
      expect(next.users.u1.slots[0]).toEqual({ ...base(), deleted: true });
      expect(next.users.u2.slots[0]).toEqual(base({ revision: 9 }));
      expect(next.users.u1.slots[1]).toEqual(base({ careerId: "B" }));
    });

    it("never the wrong career, the wrong slot, a user without a base, or an already marked base", () => {
      const b = shared();
      expect(withLocalDelete(b, 0, "Z", "u1")).toEqual(b);
      expect(withLocalDelete(b, 2, "A", "u1")).toEqual(b);
      expect(withLocalDelete(b, 1, "A", "u1")).toEqual(b);
      expect(withLocalDelete(b, 0, "A", "nobody")).toEqual(b);
      const marked = withLocalDelete(b, 0, "A", "u1");
      expect(withLocalDelete(marked, 0, "A", "u1")).toEqual(marked);
    });

    it("signed out with exactly one known account: marks that account", () => {
      const b = withBase(emptyBook("d"), "u1", 0, base());
      const frozen = JSON.stringify(b);
      expect(withLocalDelete(b, 0, "A", null).users.u1.slots[0]).toEqual({ ...base(), deleted: true });
      expect(JSON.stringify(b)).toBe(frozen);
      expect(withLocalDelete(b, 0, "B", null)).toEqual(b);
      expect(withLocalDelete(b, 1, "A", null)).toEqual(b);
    });

    it("signed out with two accounts on record: nothing is marked", () => {
      const b = shared();
      expect(withLocalDelete(b, 0, "A", null)).toEqual(b);
    });

    it("signed out with no account on record: nothing is marked", () => {
      expect(withLocalDelete(emptyBook("d"), 0, "A", null)).toEqual(emptyBook("d"));
    });
  });
});
