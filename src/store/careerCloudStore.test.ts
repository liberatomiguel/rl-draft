/**
 * Road to Worlds cloud save (v2.0.26): the orchestration. `@/lib/supabase` is
 * mocked (no SDK, no network); the REAL career store, account store, codec and
 * reconcile rule run. Timers are faked (only setTimeout / Date), so the real
 * gzip streams still complete: `settle()` waits for the queue with real ticks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUD_SYNC } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import type { CloudSlotMeta } from "@/lib/careerCloud";
import { encodeSaveText } from "@/lib/saveCodec";

const h = vi.hoisted(() => ({
  fetchCareerMetas: vi.fn(),
  fetchCareerSave: vi.fn(),
  pushCareerSave: vi.fn(),
  deleteCareerSave: vi.fn(),
  track: vi.fn(),
  gate: { allowed: true },
}));

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  accountsEnabled: true,
  fetchCareerMetas: h.fetchCareerMetas,
  fetchCareerSave: h.fetchCareerSave,
  pushCareerSave: h.pushCareerSave,
  deleteCareerSave: h.deleteCareerSave,
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: h.track,
}));

vi.mock("@/lib/careerCloudGate", () => ({
  careerCloudAllowed: () => h.gate.allowed,
  CAREER_CLOUD_AUDIENCE: "all",
  CAREER_CLOUD_STAFF_GRANTS: [],
}));

import { useAccountStore } from "./accountStore";
import { careerIdOf } from "./careerAnalytics";
import { CAREER_CLOUD_BOOK_KEY, resetCareerCloudForTests, useCareerCloudStore } from "./careerCloudStore";
import { CURRENT_SAVE_VERSION, createCareerSave, type CreateCareerInput } from "./careerFlow";
import { useCareerStore } from "./careerStore";

// --- fixtures ---------------------------------------------------------------

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Immutable",
    abbrev: "IMM",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

const STAMP = 1_000_000;

function mkSave(id: string, seed = 111, org = "Immutable"): CareerSave {
  const s = createCareerSave(INPUT, seed);
  s.careerId = id;
  s.lastPlayedAt = STAMP;
  s.identity.orgName = org;
  return s;
}

/** The account's newer copy of a save. */
function ahead(save: CareerSave, org = "Renamed"): CareerSave {
  const copy = JSON.parse(JSON.stringify(save)) as CareerSave;
  copy.identity.orgName = org;
  copy.lastPlayedAt = STAMP + 500_000;
  copy.seq = (save.seq ?? 0) + 5;
  return copy;
}

function metaOf(slot: number, save: CareerSave, revision: number, over: Partial<CloudSlotMeta> = {}): CloudSlotMeta {
  return {
    slot,
    careerId: careerIdOf(save),
    saveVersion: save.saveVersion ?? 1,
    seq: save.seq ?? 0,
    revision,
    savedAt: save.lastPlayedAt ?? 0,
    updatedAt: 9_000_000,
    deviceId: "other-device",
    summary: { orgName: save.identity.orgName },
    ...over,
  };
}

interface AccountRow {
  save: CareerSave;
  revision: number;
  /** Override the meta (e.g. a newer `saveVersion`). */
  over?: Partial<CloudSlotMeta>;
}

/** What the account holds: the list answers its metas, the read answers the payload. */
async function account(rows: Record<number, AccountRow>): Promise<void> {
  const entries = await Promise.all(
    Object.entries(rows).map(async ([slot, r]) => ({
      meta: metaOf(Number(slot), r.save, r.revision, r.over),
      payload: await encodeSaveText(JSON.stringify(r.save)),
    })),
  );
  h.fetchCareerMetas.mockResolvedValue({ status: "ok", slots: entries.map((e) => e.meta) });
  h.fetchCareerSave.mockImplementation(async (_uid: string, slot: number) => {
    const e = entries.find((x) => x.meta.slot === slot);
    return e ? { status: "ok", meta: e.meta, payload: e.payload } : { status: "empty" };
  });
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
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

let storage: MemoryStorage;
let doc: { visibilityState: string; handlers: Map<string, () => void>; addEventListener: (t: string, f: () => void) => void; removeEventListener: () => void };
let revision = 0;

const cloud = () => useCareerCloudStore.getState();
const slots = () => useCareerStore.getState().slots;
const putSave = (slot: number, save: CareerSave | null) => {
  const next = [...slots()];
  next[slot] = save;
  useCareerStore.setState({ slots: next });
};
/** Local play: a new save object whose `lastPlayedAt` (and seq) moved on. */
function play(slot: number, by = 1000): CareerSave {
  const cur = slots()[slot]!;
  const next = { ...cur, lastPlayedAt: (cur.lastPlayedAt ?? 0) + by, seq: (cur.seq ?? 0) + 1 };
  putSave(slot, next);
  return next;
}
const signIn = (uid: string) => useAccountStore.setState({ session: { user: { id: uid } } as never, status: "signedIn" });
const signOut = () => useAccountStore.setState({ session: null, status: "signedOut" });
const book = () => JSON.parse(storage.getItem(CAREER_CLOUD_BOOK_KEY) ?? "null") as { users: Record<string, { slots: ({ careerId: string; revision: number; stamp: number; deleted?: boolean } | null)[] }> } | null;
const baseOf = (uid: string, slot: number) => book()?.users[uid]?.slots[slot] ?? null;
const pushInput = (call: number) => h.pushCareerSave.mock.calls[call][1] as Record<string, unknown>;

const tick = () => new Promise<void>((r) => setImmediate(r));
/** Wait (real ticks) until nothing is in flight. Fake timers are not advanced. */
async function settle(): Promise<void> {
  let calm = 0;
  const t0 = performance.now();
  for (let i = 0; calm < 5 && performance.now() - t0 < 4000; i++) {
    await tick();
    calm = cloud().syncing ? 0 : calm + 1;
  }
}
async function until(cond: () => boolean): Promise<void> {
  const t0 = performance.now();
  while (!cond() && performance.now() - t0 < 4000) await tick();
  expect(cond()).toBe(true);
}
/** Advance fake time, then wait for whatever that started. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** A device with one career in slot 0, signed in as u1 and synced to an empty account. */
async function syncedDevice(save = mkSave("career-A")): Promise<CareerSave> {
  putSave(0, save);
  await account({});
  cloud().start();
  signIn("u1");
  await settle();
  expect(cloud().slots[0].status).toBe("synced");
  expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
  return save;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  doc = {
    visibilityState: "visible",
    handlers: new Map(),
    addEventListener(type, fn) {
      this.handlers.set(type, fn);
    },
    removeEventListener() {},
  };
  vi.stubGlobal("document", doc);

  resetCareerCloudForTests();
  signOut();
  useCareerStore.setState({ slots: [null, null, null], activeSlot: null, lastError: null });
  h.gate.allowed = true;
  revision = 0;
  for (const f of [h.fetchCareerMetas, h.fetchCareerSave, h.pushCareerSave, h.deleteCareerSave, h.track]) f.mockReset();
  h.fetchCareerMetas.mockResolvedValue({ status: "ok", slots: [] });
  h.fetchCareerSave.mockResolvedValue({ status: "empty" });
  h.pushCareerSave.mockImplementation(async () => ({ status: "ok", revision: ++revision, updatedAt: 5000 }));
  h.deleteCareerSave.mockResolvedValue({ status: "ok", deleted: true });
});

afterEach(() => {
  resetCareerCloudForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// --- a. off ----------------------------------------------------------------

describe("a. the cloud copy is off", () => {
  it("not signed in: no cloud call, not active, local play calls nothing", async () => {
    putSave(0, mkSave("career-A"));
    cloud().start();
    expect(cloud().active).toBe(false);
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs * 3);
    await cloud().syncNow();
    for (const f of [h.fetchCareerMetas, h.fetchCareerSave, h.pushCareerSave, h.deleteCareerSave]) expect(f).not.toHaveBeenCalled();
    expect(cloud().active).toBe(false);
  });

  it("signed in but the gate says no: same", async () => {
    h.gate.allowed = false;
    putSave(0, mkSave("career-A"));
    cloud().start();
    signIn("u1");
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs * 3);
    await cloud().syncNow();
    expect(cloud().active).toBe(false);
    for (const f of [h.fetchCareerMetas, h.fetchCareerSave, h.pushCareerSave, h.deleteCareerSave]) expect(f).not.toHaveBeenCalled();
  });
});

// --- b. first sign-in --------------------------------------------------------

describe("b. first sign-in with a local career and an empty account", () => {
  it("lists once, pushes with no expected revision, marks synced and records the base", async () => {
    const save = mkSave("career-A");
    putSave(0, save);
    cloud().start();
    signIn("u1");
    await settle();
    expect(cloud().active).toBe(true);
    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(1);
    expect(h.fetchCareerMetas).toHaveBeenCalledWith("u1");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(h.pushCareerSave.mock.calls[0][0]).toBe("u1");
    expect(pushInput(0)).toMatchObject({ slot: 0, careerId: "career-A", expectedRevision: null, force: false, savedAt: STAMP });
    expect(cloud().slots[0].status).toBe("synced");
    expect(cloud().slots[1].status).toBe("none");
    expect(baseOf("u1", 0)).toEqual({ careerId: "career-A", revision: 1, stamp: save.lastPlayedAt });
    expect(cloud().lastFailure).toBeNull();
  });
});

// --- c. restore -------------------------------------------------------------

describe("c. an empty device, an account with a career", () => {
  it("downloads it into the slot, says restored, and pushes nothing", async () => {
    const remote = mkSave("career-R", 222, "Cloud FC");
    await account({ 1: { save: remote, revision: 4 } });
    cloud().start();
    signIn("u1");
    await settle();
    expect(h.fetchCareerSave).toHaveBeenCalledWith("u1", 1);
    expect(slots()[1]).not.toBeNull();
    expect(slots()[1]!.identity.orgName).toBe("Cloud FC");
    expect(cloud().slots[1].status).toBe("synced");
    expect(cloud().notice).toMatchObject({ slot: 1, kind: "restored", orgName: "Cloud FC" });
    expect(h.pushCareerSave).not.toHaveBeenCalled();
    expect(baseOf("u1", 1)).toEqual({ careerId: "career-R", revision: 4, stamp: slots()[1]!.lastPlayedAt });
    // the sync's own write is not "play": nothing goes back up
    await advance(CLOUD_SYNC.careerPushDebounceMs * 2);
    expect(h.pushCareerSave).not.toHaveBeenCalled();
  });
});

// --- d. fast-forward --------------------------------------------------------

describe("d. fast-forward", () => {
  it("the account moved on and this device did not: the account copy replaces it, no conflict", async () => {
    const save = await syncedDevice();
    await account({ 0: { save: ahead(save), revision: 5 } });
    await cloud().syncNow();
    await settle();
    expect(slots()[0]!.identity.orgName).toBe("Renamed");
    expect(cloud().notice).toMatchObject({ slot: 0, kind: "updated", orgName: "Renamed" });
    expect(cloud().slots[0].status).toBe("synced");
    expect(cloud().slots[0].conflict).toBeNull();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(baseOf("u1", 0)?.revision).toBe(5);
  });
});

// --- e. local play -----------------------------------------------------------

describe("e. local play after a sync", () => {
  it("is pending, and goes up only after the quiet period, expecting the last revision", async () => {
    await syncedDevice();
    play(0);
    expect(cloud().slots[0].status).toBe("pending");
    await advance(CLOUD_SYNC.careerPushDebounceMs - 1);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(pushInput(1)).toMatchObject({ slot: 0, careerId: "career-A", expectedRevision: 1, force: false });
    expect(cloud().slots[0].status).toBe("synced");
    expect(baseOf("u1", 0)).toMatchObject({ revision: 2, stamp: slots()[0]!.lastPlayedAt });
  });

  it("a second change inside the quiet period restarts the timer: one push in total", async () => {
    await syncedDevice();
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs - 100);
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs - 100);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    await advance(100);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(pushInput(1).savedAt).toBe(slots()[0]!.lastPlayedAt);
    await advance(CLOUD_SYNC.careerPushDebounceMs * 2);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
  });
});

// --- f. divergence -----------------------------------------------------------

describe("f. both sides moved", () => {
  async function diverge() {
    const save = await syncedDevice();
    const played = play(0);
    await account({ 0: { save: ahead(save, "From Cloud"), revision: 2 } });
    await cloud().syncNow();
    await settle();
    return played;
  }

  it("downloads nothing, pushes nothing, and asks (diverged)", async () => {
    await diverge();
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ slot: 0, kind: "diverged" });
    expect(slots()[0]!.identity.orgName).toBe("Immutable");
    // the quiet-period timer does not push over an unanswered notice
    await advance(CLOUD_SYNC.careerPushDebounceMs * 2);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
  });

  it("choosing this device pushes with force and reports the choice", async () => {
    await diverge();
    await cloud().resolveConflict(0, "local");
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(pushInput(1)).toMatchObject({ slot: 0, force: true, expectedRevision: 2 });
    expect(cloud().slots[0].status).toBe("synced");
    expect(h.track).toHaveBeenCalledWith("career_cloud_conflict", { kind: "diverged", choice: "local" });
  });

  it("choosing the account replaces the local save with the account copy and reports the choice", async () => {
    await diverge();
    await cloud().resolveConflict(0, "cloud");
    await settle();
    expect(h.fetchCareerSave).toHaveBeenCalledWith("u1", 0);
    expect(slots()[0]!.identity.orgName).toBe("From Cloud");
    expect(cloud().slots[0].status).toBe("synced");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(h.track).toHaveBeenCalledWith("career_cloud_conflict", { kind: "diverged", choice: "cloud" });
  });

  it("an answer for a slot with no conflict does nothing", async () => {
    await syncedDevice();
    await cloud().resolveConflict(0, "local");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(h.track).not.toHaveBeenCalledWith("career_cloud_conflict", expect.anything());
  });
});

// --- g. refused push ---------------------------------------------------------

describe("g. the server refuses a push", () => {
  it("nothing changes locally, the store lists again and asks the rule with the fresh row; no second push goes out", async () => {
    const save = await syncedDevice();
    const played = play(0);
    const fresh = metaOf(0, ahead(save), 7);
    const refusal = metaOf(0, ahead(save), 99); // not trusted: the list is
    h.fetchCareerMetas.mockResolvedValue({ status: "ok", slots: [fresh] });
    h.pushCareerSave.mockResolvedValueOnce({ status: "conflict", meta: refusal });
    const lists = h.fetchCareerMetas.mock.calls.length;
    await advance(CLOUD_SYNC.careerPushDebounceMs);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(lists + 1);
    expect(slots()[0]).toBe(played);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "diverged", cloud: { revision: 7 } });
    await advance(CLOUD_SYNC.careerPushDebounceMs * 4);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
  });

  it("a fresh row from a newer build: status newer, no push, no download", async () => {
    const save = await syncedDevice();
    play(0);
    h.fetchCareerMetas.mockResolvedValue({ status: "ok", slots: [metaOf(0, ahead(save), 7, { saveVersion: CURRENT_SAVE_VERSION + 1 })] });
    h.pushCareerSave.mockResolvedValueOnce({ status: "conflict", meta: metaOf(0, ahead(save), 7) });
    await advance(CLOUD_SYNC.careerPushDebounceMs);
    expect(cloud().slots[0].status).toBe("newer");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    await advance(CLOUD_SYNC.careerPushDebounceMs * 2);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
  });

  it("the list after a refusal fails: career_cloud_failed stage list, nothing else moves", async () => {
    const save = await syncedDevice();
    const played = play(0);
    h.fetchCareerMetas.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    h.pushCareerSave.mockResolvedValueOnce({ status: "conflict", meta: metaOf(0, ahead(save), 7) });
    await advance(CLOUD_SYNC.careerPushDebounceMs);
    expect(h.track).toHaveBeenCalledWith("career_cloud_failed", expect.objectContaining({ stage: "list", reason: "other" }));
    expect(cloud().slots[0].status).toBe("error");
    expect(slots()[0]).toBe(played);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
  });
});

// --- h. missing --------------------------------------------------------------

describe("h. the account copy is gone", () => {
  async function missing() {
    await syncedDevice();
    play(0);
    h.pushCareerSave.mockResolvedValueOnce({ status: "missing" });
    await advance(CLOUD_SYNC.careerPushDebounceMs);
  }

  it("a push answered missing is a conflict (cloud-deleted)", async () => {
    await missing();
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "cloud-deleted", cloud: null });
    expect(slots()[0]).not.toBeNull();
  });

  it("choosing the account deletes the local slot", async () => {
    await missing();
    await cloud().resolveConflict(0, "cloud");
    await settle();
    expect(slots()[0]).toBeNull();
    expect(baseOf("u1", 0)).toBeNull();
    expect(cloud().slots[0].status).toBe("none");
    expect(h.track).toHaveBeenCalledWith("career_cloud_conflict", { kind: "cloud-deleted", choice: "cloud" });
    // that delete is the player's answer, not a local delete to mirror
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
  });

  it("choosing this device recreates the row: expected revision null, forced", async () => {
    await missing();
    await cloud().resolveConflict(0, "local");
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(3);
    expect(pushInput(2)).toMatchObject({ expectedRevision: null, force: true });
    expect(cloud().slots[0].status).toBe("synced");
    expect(slots()[0]).not.toBeNull();
  });
});

// --- i. local delete ---------------------------------------------------------

describe("i. deleting a slot", () => {
  it("signed in: the account copy of that career is deleted and the base cleared", async () => {
    await syncedDevice();
    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledTimes(1);
    expect(h.deleteCareerSave).toHaveBeenCalledWith("u1", 0, "career-A", 1);
    expect(baseOf("u1", 0)).toBeNull();
    expect(cloud().slots[0].status).toBe("none");
  });

  it("signed out: marked now, deleted at the next sign-in, never downloaded again", async () => {
    const save = await syncedDevice();
    signOut();
    useCareerStore.getState().deleteSlot(0);
    expect(baseOf("u1", 0)).toMatchObject({ careerId: "career-A", deleted: true });
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
    await account({ 0: { save, revision: 1 } });
    signIn("u1");
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledWith("u1", 0, "career-A", 1);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(slots()[0]).toBeNull();
    expect(baseOf("u1", 0)).toBeNull();
  });

  it("signed out, and the account copy moved on meanwhile: it comes back, it is not deleted", async () => {
    const save = await syncedDevice();
    signOut();
    useCareerStore.getState().deleteSlot(0);
    await account({ 0: { save: ahead(save, "Played Elsewhere"), revision: 2 } });
    signIn("u1");
    await settle();
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
    expect(h.fetchCareerSave).toHaveBeenCalledWith("u1", 0);
    expect(slots()[0]!.identity.orgName).toBe("Played Elsewhere");
    expect(cloud().notice).toMatchObject({ kind: "restored" });
  });
});

// --- j. failed list ----------------------------------------------------------

describe("j. a failed list", () => {
  const failing = { status: "error", error: "x", reason: "network" };

  it("does nothing else, names the failure, and the owed sync runs again after the pause", async () => {
    putSave(0, mkSave("career-A"));
    h.fetchCareerMetas.mockResolvedValue(failing);
    cloud().start();
    signIn("u1");
    await vi.advanceTimersByTimeAsync(CLOUD_SYNC.retryDelaysMs[0]);
    await vi.advanceTimersByTimeAsync(CLOUD_SYNC.retryDelaysMs[1]);
    await settle();
    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(1 + CLOUD_SYNC.retryDelaysMs.length);
    for (const f of [h.pushCareerSave, h.fetchCareerSave, h.deleteCareerSave]) expect(f).not.toHaveBeenCalled();
    expect(cloud().lastFailure).toBe("network");
    expect(h.track).toHaveBeenCalledWith("career_cloud_failed", expect.objectContaining({ stage: "list", reason: "network" }));

    // the connection is back: the owed sync goes through on its own
    h.fetchCareerMetas.mockResolvedValue({ status: "ok", slots: [] });
    await advance(CLOUD_SYNC.resyncDelaysMs[0]);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(cloud().slots[0].status).toBe("synced");
    expect(cloud().lastFailure).toBeNull();
  });

  it("a local delete while the list has never succeeded keeps the base; the next good list deletes the account copy", async () => {
    // an earlier page load synced the career
    const save = await syncedDevice();
    resetCareerCloudForTests();
    signOut();
    expect(baseOf("u1", 0)).toMatchObject({ careerId: "career-A", revision: 1 });

    h.fetchCareerMetas.mockResolvedValue(failing);
    cloud().start();
    signIn("u1");
    await vi.advanceTimersByTimeAsync(10);
    useCareerStore.getState().deleteSlot(0);
    await vi.advanceTimersByTimeAsync(30_000);
    await settle();
    expect(baseOf("u1", 0)).toMatchObject({ careerId: "career-A", revision: 1, deleted: true });
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
    expect(h.fetchCareerSave).not.toHaveBeenCalled();

    await account({ 0: { save, revision: 1 } });
    const done = cloud().syncNow();
    await vi.advanceTimersByTimeAsync(20_000);
    await done;
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledWith("u1", 0, "career-A", 1);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(slots()[0]).toBeNull();
  });
});

// --- k. unusable copies ------------------------------------------------------

describe("k. a copy this build cannot use", () => {
  it("a garbage payload: the slot is untouched and the load failure is reported", async () => {
    const remote = mkSave("career-R");
    await account({ 0: { save: remote, revision: 2 } });
    h.fetchCareerSave.mockResolvedValue({
      status: "ok",
      meta: metaOf(0, remote, 2),
      payload: { encoding: "gzip", payload: "AAAAAAAA" },
    });
    cloud().start();
    signIn("u1");
    await settle();
    expect(slots()[0]).toBeNull();
    expect(cloud().slots[0].status).toBe("error");
    expect(h.track).toHaveBeenCalledWith("career_cloud_failed", expect.objectContaining({ stage: "load" }));
    expect(cloud().notice).toBeNull();
  });

  it("a payload whose save is from a newer build: the slot is untouched and the load failure is reported", async () => {
    const remote = mkSave("career-R");
    const future = { ...remote, saveVersion: CURRENT_SAVE_VERSION + 1 };
    await account({ 0: { save: remote, revision: 2 } });
    h.fetchCareerSave.mockResolvedValue({
      status: "ok",
      meta: metaOf(0, remote, 2),
      payload: await encodeSaveText(JSON.stringify(future)),
    });
    putSave(0, null);
    cloud().start();
    signIn("u1");
    await settle();
    expect(slots()[0]).toBeNull();
    expect(h.track).toHaveBeenCalledWith("career_cloud_failed", expect.objectContaining({ stage: "load" }));
  });

  it("an account meta from a newer build: status newer, no download, no push (empty or occupied slot)", async () => {
    const remote = mkSave("career-R");
    await account({ 0: { save: remote, revision: 2, over: { saveVersion: CURRENT_SAVE_VERSION + 1 } }, 1: { save: remote, revision: 2, over: { saveVersion: CURRENT_SAVE_VERSION + 1 } } });
    putSave(1, mkSave("career-L", 333));
    cloud().start();
    signIn("u1");
    await settle();
    expect(cloud().slots[0].status).toBe("newer");
    expect(cloud().slots[1].status).toBe("newer");
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(h.pushCareerSave).not.toHaveBeenCalled();
    expect(slots()[0]).toBeNull();
    expect(slots()[1]!.identity.orgName).toBe("Immutable");
  });
});

// --- l. progress during a download -------------------------------------------

describe("l. local progress while a download is in flight", () => {
  it("is never overwritten", async () => {
    const save = await syncedDevice();
    const theirs = ahead(save, "From Cloud");
    await account({ 0: { save: theirs, revision: 5 } });
    const meta = metaOf(0, theirs, 5);
    const payload = await encodeSaveText(JSON.stringify(theirs));
    const held = deferred<unknown>();
    h.fetchCareerSave.mockImplementation(() => held.promise);

    const done = cloud().syncNow();
    await until(() => h.fetchCareerSave.mock.calls.length > 0);
    const played = play(0);
    held.resolve({ status: "ok", meta, payload });
    await done;
    await settle();

    expect(slots()[0]).toBe(played);
    expect(slots()[0]!.identity.orgName).toBe("Immutable");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().notice).toBeNull();
  });
});

// --- m. user switch ----------------------------------------------------------

describe("m. the user changes mid-flight", () => {
  it("u1's answer writes nothing for u2; u2 gets its own list", async () => {
    putSave(0, mkSave("career-A"));
    const held = deferred<unknown>();
    h.pushCareerSave.mockImplementationOnce(() => held.promise);
    cloud().start();
    signIn("u1");
    await until(() => h.pushCareerSave.mock.calls.length > 0);
    expect(h.pushCareerSave.mock.calls[0][0]).toBe("u1");

    h.fetchCareerMetas.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    signIn("u2");
    held.resolve({ status: "ok", revision: 9, updatedAt: 1 });
    await settle();

    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(2);
    expect(h.fetchCareerMetas.mock.calls[1][0]).toBe("u2");
    expect(baseOf("u2", 0)).toBeNull();
    expect(cloud().slots[0].status).not.toBe("synced");
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
  });
});

// --- n. visibility -----------------------------------------------------------

describe("n. the tab hides and returns", () => {
  it("hiding with a pending change pushes at once; returning after a while lists again", async () => {
    await syncedDevice();
    play(0);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    doc.visibilityState = "hidden";
    doc.handlers.get("visibilitychange")?.();
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(cloud().slots[0].status).toBe("synced");

    const lists = h.fetchCareerMetas.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CLOUD_SYNC.careerRecheckAfterMs);
    doc.visibilityState = "visible";
    doc.handlers.get("visibilitychange")?.();
    await settle();
    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(lists + 1);
  });

  it("returning soon does not list again", async () => {
    await syncedDevice();
    const lists = h.fetchCareerMetas.mock.calls.length;
    doc.visibilityState = "hidden";
    doc.handlers.get("visibilitychange")?.();
    await vi.advanceTimersByTimeAsync(1000);
    doc.visibilityState = "visible";
    doc.handlers.get("visibilitychange")?.();
    await settle();
    expect(h.fetchCareerMetas).toHaveBeenCalledTimes(lists);
  });
});

// --- o. after the persistence review ----------------------------------------

describe("o. a shared browser", () => {
  it("an account copy in the slot never overwrites another account career without a question", async () => {
    const Y = mkSave("career-Y", 111, "Why FC");
    const X = mkSave("career-X", 222, "Ex FC");
    putSave(0, Y);
    cloud().start();
    await account({});
    signIn("u2");
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(baseOf("u2", 0)).toEqual({ careerId: "career-Y", revision: 1, stamp: STAMP });

    signOut();
    await account({ 0: { save: X, revision: 3 } });
    signIn("u1");
    await settle();
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "different-career" });
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);

    await cloud().resolveConflict(0, "cloud");
    await settle();
    expect(slots()[0]!.identity.orgName).toBe("Ex FC");
    expect(careerIdOf(slots()[0]!)).toBe("career-X");
    expect(cloud().slots[0].status).toBe("synced");

    signOut();
    await account({ 0: { save: Y, revision: 1 } });
    signIn("u2");
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "different-career" });
    expect(careerIdOf(slots()[0]!)).toBe("career-X");
  });

  it("the own replace of the player still uploads: expected revision of the synced copy, no question", async () => {
    await syncedDevice(mkSave("career-Y"));
    const Z = mkSave("career-Z", 333, "Zed FC");
    // the account still lists Y r1 on the next list
    await account({ 0: { save: mkSave("career-Y"), revision: 1 } });
    useCareerStore.getState().deleteSlot(0);
    putSave(0, Z);
    await settle();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(2);
    expect(pushInput(1)).toMatchObject({ careerId: "career-Z", expectedRevision: 1, force: false });
    expect(cloud().slots[0].status).toBe("synced");
    expect(cloud().slots[0].conflict).toBeNull();
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
  });

  it("a local delete by u1 does not mark the base of u2: that copy is kept and comes back", async () => {
    const Y = mkSave("career-Y");
    putSave(0, Y);
    cloud().start();
    await account({});
    signIn("u2");
    await settle();
    signOut();
    signIn("u1");
    await settle();
    expect(baseOf("u1", 0)).toMatchObject({ careerId: "career-Y" });
    expect(baseOf("u2", 0)).toMatchObject({ careerId: "career-Y" });

    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledTimes(1);
    expect(h.deleteCareerSave.mock.calls[0][0]).toBe("u1");
    expect(baseOf("u2", 0)?.deleted).toBeUndefined();

    signOut();
    await account({ 0: { save: Y, revision: 1 } });
    signIn("u2");
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledTimes(1);
    expect(h.fetchCareerSave).toHaveBeenCalledWith("u2", 0);
    expect(slots()[0]!.identity.orgName).toBe("Immutable");
  });

  it("signed out with two accounts on record: a delete marks nobody", async () => {
    const Y = mkSave("career-Y");
    putSave(0, Y);
    cloud().start();
    await account({});
    signIn("u2");
    await settle();
    signOut();
    signIn("u1");
    await settle();
    signOut();
    useCareerStore.getState().deleteSlot(0);
    expect(baseOf("u1", 0)?.deleted).toBeUndefined();
    expect(baseOf("u2", 0)?.deleted).toBeUndefined();
  });
});

describe("p. resolveConflict only acts on what the player saw", () => {
  async function diverged() {
    const save = await syncedDevice();
    const played = play(0);
    const theirs = ahead(save, "From Cloud");
    await account({ 0: { save: theirs, revision: 2 } });
    await cloud().syncNow();
    await settle();
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "diverged" });
    return { played, theirs };
  }

  it.each(["cloud", "local"] as const)("the kind changed in the queue (the account copy vanished): choice %s does nothing", async (choice) => {
    const { played } = await diverged();
    const held = deferred<unknown>();
    const lists = h.fetchCareerMetas.mock.calls.length;
    h.fetchCareerMetas.mockImplementationOnce(() => held.promise);
    const sync = cloud().syncNow();
    await until(() => h.fetchCareerMetas.mock.calls.length > lists);
    const pushes = h.pushCareerSave.mock.calls.length;
    const answer = cloud().resolveConflict(0, choice);
    held.resolve({ status: "ok", slots: [] });
    await sync;
    await answer;
    await settle();
    expect(slots()[0]).toBe(played);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "cloud-deleted" });
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(pushes);
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
  });

  it.each(["cloud", "local"] as const)("the local stamp moved between the click and the task: choice %s does nothing", async (choice) => {
    const { theirs } = await diverged();
    const held = deferred<unknown>();
    const lists = h.fetchCareerMetas.mock.calls.length;
    h.fetchCareerMetas.mockImplementationOnce(() => held.promise);
    const sync = cloud().syncNow();
    await until(() => h.fetchCareerMetas.mock.calls.length > lists);
    const pushes = h.pushCareerSave.mock.calls.length;
    const answer = cloud().resolveConflict(0, choice);
    const playedMore = play(0);
    held.resolve({ status: "ok", slots: [metaOf(0, theirs, 2)] });
    await sync;
    await answer;
    await settle();
    expect(slots()[0]).toBe(playedMore);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(h.pushCareerSave).toHaveBeenCalledTimes(pushes);
  });

  it("choice cloud while the local save moves during the fetch: not overwritten, still a conflict", async () => {
    const { theirs } = await diverged();
    const payload = await encodeSaveText(JSON.stringify(theirs));
    const held = deferred<unknown>();
    h.fetchCareerSave.mockImplementation(() => held.promise);
    const answer = cloud().resolveConflict(0, "cloud");
    await until(() => h.fetchCareerSave.mock.calls.length > 0);
    const playedMore = play(0);
    held.resolve({ status: "ok", meta: metaOf(0, theirs, 2), payload });
    await answer;
    await settle();
    expect(slots()[0]).toBe(playedMore);
    expect(slots()[0]!.identity.orgName).toBe("Immutable");
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().notice).toBeNull();
  });
});

describe("q. delete-cloud refused by the revision", () => {
  it("a fresh row at a higher revision: it is downloaded, not deleted twice", async () => {
    const save = await syncedDevice();
    await account({ 0: { save: ahead(save, "Played Elsewhere"), revision: 2 } });
    h.deleteCareerSave.mockResolvedValue({ status: "ok", deleted: false });
    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledTimes(1);
    expect(h.fetchCareerSave).toHaveBeenCalledWith("u1", 0);
    expect(slots()[0]!.identity.orgName).toBe("Played Elsewhere");
    expect(cloud().notice).toMatchObject({ kind: "restored" });
    expect(cloud().slots[0].status).toBe("synced");
  });

  it("no fresh row: the base is cleared and the slot is quiet", async () => {
    await syncedDevice();
    h.deleteCareerSave.mockResolvedValue({ status: "ok", deleted: false });
    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(h.deleteCareerSave).toHaveBeenCalledTimes(1);
    expect(h.fetchCareerSave).not.toHaveBeenCalled();
    expect(baseOf("u1", 0)).toBeNull();
    expect(cloud().slots[0].status).toBe("none");
  });

  it("a delete that errors is reported and keeps the mark", async () => {
    await syncedDevice();
    h.deleteCareerSave.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(h.track).toHaveBeenCalledWith("career_cloud_failed", expect.objectContaining({ stage: "delete" }));
    expect(baseOf("u1", 0)).toMatchObject({ careerId: "career-A", deleted: true });
    expect(cloud().slots[0].status).toBe("error");
  });
});

describe("r. a slot whose pushes keep being refused", () => {
  it("three refusals for a reason that will not pass: the fourth change sends nothing", async () => {
    await syncedDevice();
    h.pushCareerSave.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    for (let i = 0; i < 3; i++) {
      play(0);
      await advance(CLOUD_SYNC.careerPushDebounceMs);
    }
    expect(h.pushCareerSave).toHaveBeenCalledTimes(4);
    expect(cloud().slots[0].status).toBe("error");
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs * 2);
    expect(h.pushCareerSave).toHaveBeenCalledTimes(4);
    expect(cloud().slots[0].status).toBe("error");
  });

  it("a recoverable reason (network) never blocks", async () => {
    const synced = await syncedDevice();
    await account({ 0: { save: synced, revision: 1 } }); // what the owed re-syncs will list
    h.pushCareerSave.mockResolvedValue({ status: "error", error: "x", reason: "network" });
    for (let i = 0; i < 5; i++) {
      const before = h.pushCareerSave.mock.calls.length;
      play(0);
      await advance(CLOUD_SYNC.careerPushDebounceMs);
      expect(h.pushCareerSave.mock.calls.length).toBeGreaterThan(before);
    }
    h.pushCareerSave.mockImplementation(async () => ({ status: "ok", revision: ++revision, updatedAt: 5000 }));
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs);
    expect(cloud().slots[0].status).toBe("synced");
  });

  it("a slot handed to another career lifts the block", async () => {
    await syncedDevice();
    h.pushCareerSave.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    for (let i = 0; i < 4; i++) {
      play(0);
      await advance(CLOUD_SYNC.careerPushDebounceMs);
    }
    const blocked = h.pushCareerSave.mock.calls.length;
    h.pushCareerSave.mockImplementation(async () => ({ status: "ok", revision: ++revision, updatedAt: 5000 }));
    putSave(0, mkSave("career-N", 444, "New FC"));
    await settle();
    expect(h.pushCareerSave.mock.calls.length).toBeGreaterThan(blocked);
  });
});

describe("s. the record of the browser and failed lists", () => {
  it("a failed list turns a syncing slot into error", async () => {
    putSave(0, mkSave("career-A"));
    h.fetchCareerMetas.mockResolvedValue({ status: "error", error: "x", reason: "other" });
    cloud().start();
    signIn("u1");
    await settle();
    useCareerStore.getState().deleteSlot(0);
    await settle();
    expect(cloud().slots[0].status).toBe("error");
  });

  it("the device id is kept from the first start, even with nobody signed in", () => {
    cloud().start();
    const raw = JSON.parse(storage.getItem(CAREER_CLOUD_BOOK_KEY) ?? "null");
    expect(typeof raw?.deviceId).toBe("string");
    expect(raw.deviceId.length).toBeGreaterThan(0);
  });

  it("the record is read again on every use: a change made by another tab is seen", async () => {
    await syncedDevice();
    const raw = JSON.parse(storage.getItem(CAREER_CLOUD_BOOK_KEY)!);
    raw.users.u1.slots[0] = null;
    storage.setItem(CAREER_CLOUD_BOOK_KEY, JSON.stringify(raw));
    play(0);
    await advance(CLOUD_SYNC.careerPushDebounceMs);
    expect(cloud().slots[0].status).toBe("conflict");
    expect(cloud().slots[0].conflict).toMatchObject({ kind: "diverged" });
    expect(h.pushCareerSave).toHaveBeenCalledTimes(1);
  });
});
