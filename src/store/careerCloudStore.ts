"use client";

/**
 * Road to Worlds cloud save (v2.0.26) — the copy of each career slot in the
 * player's account. localStorage stays the copy the game plays from; this store
 * only mirrors it to `career_saves` and brings the account copy to a device
 * that is behind. The rule is in `lib/careerCloud.ts` (pure); this file carries
 * it out.
 *
 * Save safety (same bar as the profile sync, DESIGN-DECISIONS #55.7):
 *  - a local save is replaced only (a) by a fast-forward (this device has not
 *    touched the career since the last sync and the account copy moved on), or
 *    (b) because the player said so in the notice. A download re-checks the
 *    local stamp right before it writes, so progress made while the payload was
 *    in flight is never overwritten;
 *  - the account copy is written through `push_career_save`, which refuses the
 *    write when the row moved on since this device last saw it. A refused write
 *    changes nothing and the rule is asked again with the fresh row;
 *  - a failed read never counts as "no copy";
 *  - a downloaded payload goes through the same migrations and repairs as a
 *    save loaded from storage (`careerStore.adoptSave`); one the game cannot
 *    load is refused and the slot is untouched;
 *  - one cloud operation at a time (a queue), and every queued step checks that
 *    the signed-in user is still the one it was queued for.
 *
 * The persist keys do not change: the careers stay under
 * `rocket-draft:career:v1`. What this browser and the account last agreed on
 * (`CareerCloudBook`) is bookkeeping and lives under its own key.
 *
 * Imported only from the career screens: it pulls in the career store.
 */

import { create } from "zustand";
import { CLOUD_SYNC } from "@/config/balance";
import { SITE } from "@/config/site";
import type { CareerSave } from "@/engine/career/types";
import { trackEvent } from "@/lib/analytics";
import {
  CAREER_CLOUD_SLOTS,
  baseFor,
  decideSlot,
  parseBook,
  withBase,
  withLocalDelete,
  type CareerCloudBook,
  type CareerCloudSummary,
  type CloudSlotMeta,
  type ConflictKind,
  type LocalSlotInfo,
  type SlotAction,
  type SlotBase,
} from "@/lib/careerCloud";
import { careerCloudAllowed } from "@/lib/careerCloudGate";
import { looksLikeCareerSave } from "@/lib/careerSaveFile";
import { localCareerSwitching } from "@/lib/localOwner";
import { retrying } from "@/lib/retry";
import { decodeSaveText, encodeSaveText } from "@/lib/saveCodec";
import {
  accountsEnabled,
  deleteCareerSave,
  fetchCareerMetas,
  fetchCareerSave,
  pushCareerSave,
} from "@/lib/supabase";
import { isRecoverableSyncFailure, isTransientSyncFailure, type SyncFailReason } from "@/lib/syncErrors";
import { useAccountStore } from "./accountStore";
import { careerIdOf } from "./careerAnalytics";
import { CURRENT_SAVE_VERSION } from "./careerFlow";
import { useCareerStore } from "./careerStore";
import { useProfileStore } from "./profileStore";

/** The bookkeeping key. Not a save and not a zustand persist key. */
export const CAREER_CLOUD_BOOK_KEY = "rocket-draft:career-cloud:v1";

export type SlotCloudStatus =
  /** Nothing to say: the cloud copy is off, or the slot is empty on both sides. */
  | "none"
  /** This device and the account hold the same copy. */
  | "synced"
  /** Played here; the copy goes up after the quiet period. */
  | "pending"
  | "syncing"
  /** Two copies: the player decides (see `conflict`). */
  | "conflict"
  /** The account copy was written by a newer build of the game. */
  | "newer"
  /** The last step failed; it will be tried again. */
  | "error";

export interface CareerConflict {
  slot: number;
  kind: ConflictKind;
  /** The account copy, when there is one (none for `cloud-deleted`). */
  cloud: CloudSlotMeta | null;
}

export interface SlotCloud {
  status: SlotCloudStatus;
  cloud: CloudSlotMeta | null;
  conflict: CareerConflict | null;
}

/** Something the career shell tells the player once. */
export interface CareerCloudNotice {
  slot: number;
  /** `updated`: the account copy was ahead and replaced this device's.
   *  `restored`: the slot was empty here and the account copy filled it. */
  kind: "updated" | "restored";
  orgName: string;
}

interface CareerCloudState {
  /** The cloud copy is on for the signed-in player. */
  active: boolean;
  syncing: boolean;
  slots: SlotCloud[];
  notice: CareerCloudNotice | null;
  /** The reason of the last failed step, cleared by the next good one. */
  lastFailure: SyncFailReason | null;

  /** Wire the listeners (once). Called by the career shell. */
  start: () => void;
  /** Ask the account again and reconcile every slot. */
  syncNow: () => Promise<void>;
  /** The player's answer to a notice: keep this device's copy, or the account's. */
  resolveConflict: (slot: number, choice: "local" | "cloud") => Promise<void>;
  dismissNotice: () => void;
}

const EMPTY_SLOT: SlotCloud = { status: "none", cloud: null, conflict: null };
const emptySlots = (): SlotCloud[] => Array.from({ length: CAREER_CLOUD_SLOTS }, () => EMPTY_SLOT);

// --- the browser's record ---------------------------------------------------

function newDeviceId(): string {
  const bytes = new Uint8Array(8);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `d-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** The record as last read or written. Only a fallback: storage is read every
 *  time, because another tab of the game may have written it since. */
let book: CareerCloudBook | null = null;

function readBook(): CareerCloudBook {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(CAREER_CLOUD_BOOK_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === null && book) return book; // no storage (or it was cleared under us): keep what we know
  const parsed = parseBook(raw, () => book?.deviceId ?? newDeviceId());
  // First use on this browser: keep the device id from now on.
  if (raw === null) writeBook(parsed);
  book = parsed;
  return parsed;
}

function writeBook(next: CareerCloudBook): void {
  book = next;
  try {
    globalThis.localStorage?.setItem(CAREER_CLOUD_BOOK_KEY, JSON.stringify(next));
  } catch {
    /* A lost record only costs the player a question later, never a save. */
  }
}

// --- the local side ---------------------------------------------------------

const localSave = (slot: number): CareerSave | null => useCareerStore.getState().slots[slot] ?? null;

function localInfo(save: CareerSave | null): LocalSlotInfo | null {
  if (!save) return null;
  const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return {
    careerId: careerIdOf(save),
    stamp: count(save.lastPlayedAt),
    seq: count(save.seq),
    saveVersion: count(save.saveVersion) || 1,
  };
}

/** The first `max` characters, never half of a surrogate pair. */
const clip = (v: unknown, max: number): string => Array.from(String(v ?? "")).slice(0, max).join("");

function summaryOf(save: CareerSave): CareerCloudSummary {
  return {
    orgName: clip(save.identity?.orgName, 60),
    abbrev: clip(save.identity?.abbrev, 8),
    region: clip(save.identity?.region, 16),
    difficulty: clip(save.difficulty, 16),
    seasonIndex: save.clock?.seasonIndex ?? 0,
    day: save.clock?.day ?? 0,
    ended: save.phase === "ended",
  };
}

/** A step worth sending at once instead of waiting out the quiet period: the
 *  season turned, an event ended, the career ended, or the slot changed hands. */
function isMilestone(prev: CareerSave | null, next: CareerSave | null): boolean {
  if (!prev || !next) return true;
  if (careerIdOf(prev) !== careerIdOf(next)) return true;
  return (
    prev.clock?.seasonIndex !== next.clock?.seasonIndex ||
    prev.phase !== next.phase ||
    (Boolean(prev.activeEvent) && !next.activeEvent)
  );
}

// --- module state (per page load) -------------------------------------------

/** One cloud operation at a time. */
let chain: Promise<void> = Promise.resolve();
/** True while this store writes a downloaded save (or a resolved delete) into
 *  the career store: that write is the sync's own, not the player's. */
let applying = false;
const pushTimers = new Map<number, ReturnType<typeof setTimeout>>();
/** Writes of a slot refused in a row for a reason that will not pass on its own
 *  (not the network, not the server). After `HARD_FAIL_LIMIT` the slot stops
 *  sending its payload again for this page load. */
const hardFails = new Map<number, number>();
const HARD_FAIL_LIMIT = 3;
/** A reconcile is owed (a recoverable failure): retried after a pause, on
 *  `online`, or when the tab returns. */
let owedFor: string | null = null;
let resyncTimer: ReturnType<typeof setTimeout> | undefined;
let resyncAttempt = 0;
let hiddenAt = 0;
let started = false;
/** The user the cloud copy is currently on for (null = off). */
let activeUser: string | null = null;
/** The user whose account rows this tab has listed at least once this load.
 *  Until then a slot's `cloud` is unknown, not "no row": no step may act on it. */
let listedFor: string | null = null;
/** Undo for the listeners `start()` registers (tests re-start the store). */
let stopListeners: (() => void) | undefined;

export const useCareerCloudStore = create<CareerCloudState>((set, get) => {
  const userId = (): string | null => {
    if (!accountsEnabled) return null;
    const session = useAccountStore.getState().session;
    if (!session) return null;
    return careerCloudAllowed(useProfileStore.getState().grants) ? session.user.id : null;
  };

  const patchSlot = (slot: number, patch: Partial<SlotCloud>): void => {
    set((state) => ({ slots: state.slots.map((s, i) => (i === slot ? { ...s, ...patch } : s)) }));
  };

  const setBase = (uid: string, slot: number, base: SlotBase | null): void => {
    writeBook(withBase(readBook(), uid, slot, base));
  };

  const clearResync = (): void => {
    if (resyncTimer !== undefined) clearTimeout(resyncTimer);
    resyncTimer = undefined;
  };

  /** A step failed: say so once per session, stage and reason; remember whether
   *  it is worth trying again. */
  const failed = (
    uid: string,
    slot: number | null,
    stage: "list" | "read" | "push" | "delete" | "load",
    failure: { reason?: SyncFailReason; code?: string },
  ): void => {
    const reason = failure.reason ?? "other";
    trackEvent("career_cloud_failed", {
      actionId: `career_cloud_failed:${stage}:${reason}`,
      stage,
      reason,
      ...(failure.code ? { code: failure.code } : {}),
    });
    set((state) => ({
      lastFailure: reason,
      slots: state.slots.map((sl, i) => (i === slot || (slot === null && sl.status === "syncing") ? { ...sl, status: "error" as const } : sl)),
    }));
    if (isRecoverableSyncFailure(failure.reason) && userId() === uid) {
      owedFor = uid;
      scheduleResync();
    }
  };

  function scheduleResync(): void {
    clearResync();
    const delays = CLOUD_SYNC.resyncDelaysMs;
    const delay = delays[Math.min(resyncAttempt, delays.length - 1)];
    if (delay === undefined) return;
    resyncAttempt += 1;
    resyncTimer = setTimeout(() => {
      resyncTimer = undefined;
      retryOwed();
    }, delay);
  }

  const retryOwed = (): void => {
    const uid = userId();
    if (!uid || owedFor !== uid) return;
    clearResync();
    void enqueue(uid, () => reconcile(uid));
  };

  /** Queue a cloud step for `uid`. It runs only if that user is still the one
   *  the cloud copy is on for when its turn comes. */
  const enqueue = (uid: string, task: () => Promise<void>): Promise<void> => {
    chain = chain
      .then(async () => {
        if (userId() !== uid) return;
        set({ syncing: true });
        try {
          await task();
        } finally {
          set({ syncing: false });
        }
      })
      .catch(() => {
        // An unexpected throw: nothing may stay "syncing" forever.
        set((state) => ({
          syncing: false,
          slots: state.slots.map((slot) => (slot.status === "syncing" ? { ...slot, status: "error" as const } : slot)),
        }));
      });
    return chain;
  };

  // --- the steps ------------------------------------------------------------

  /** Write this device's copy of `slot` to the account. */
  const upload = async (uid: string, slot: number, expectedRevision: number | null, force: boolean, depth: number): Promise<void> => {
    const save = localSave(slot);
    if (!save) return;
    const info = localInfo(save)!;
    if (!force && (hardFails.get(slot) ?? 0) >= HARD_FAIL_LIMIT) {
      patchSlot(slot, { status: "error" });
      return;
    }
    patchSlot(slot, { status: "syncing", conflict: null });
    const payload = await encodeSaveText(JSON.stringify(save));
    const res = await pushCareerSave(uid, {
      slot,
      careerId: info.careerId,
      saveVersion: info.saveVersion,
      seq: info.seq,
      summary: summaryOf(save),
      payload,
      deviceId: readBook().deviceId,
      release: SITE.version,
      savedAt: info.stamp,
      expectedRevision,
      force,
    });
    if (userId() !== uid) return;
    if (res.status === "ok") {
      setBase(uid, slot, { careerId: info.careerId, revision: res.revision, stamp: info.stamp });
      const cloud: CloudSlotMeta = {
        slot,
        careerId: info.careerId,
        saveVersion: info.saveVersion,
        seq: info.seq,
        revision: res.revision,
        savedAt: info.stamp,
        updatedAt: res.updatedAt,
        deviceId: readBook().deviceId,
        summary: summaryOf(save),
      };
      // Played again while the copy was going up: it is pending once more.
      const stillSame = localInfo(localSave(slot))?.stamp === info.stamp;
      patchSlot(slot, { status: stillSame ? "synced" : "pending", cloud, conflict: null });
      if (!stillSame) schedulePush(slot, false);
      hardFails.delete(slot);
      set({ lastFailure: null });
      return;
    }
    if (res.status === "conflict" || res.status === "missing") {
      // Nothing was written. The account holds something else now: list it again
      // (the refusal does not say which build wrote the row) and ask the rule.
      const metas = await fetchCareerMetas(uid);
      if (userId() !== uid) return;
      if (metas.status === "error") {
        failed(uid, slot, "list", metas);
        return;
      }
      const cloud = metas.slots.find((m) => m.slot === slot) ?? null;
      patchSlot(slot, { cloud });
      if (depth > 0) {
        // The account keeps moving under us: let the player look at it.
        if (cloud && cloud.saveVersion > CURRENT_SAVE_VERSION) {
          patchSlot(slot, { status: "newer", conflict: null });
          return;
        }
        patchSlot(slot, { status: "conflict", conflict: { slot, kind: cloud ? "diverged" : "cloud-deleted", cloud } });
        return;
      }
      await applySlot(uid, slot, cloud, depth + 1);
      return;
    }
    if (!isRecoverableSyncFailure(res.reason)) hardFails.set(slot, (hardFails.get(slot) ?? 0) + 1);
    failed(uid, slot, "push", res);
  };

  /** Bring the account copy of `slot` to this device. `expectStamp` is the local
   *  stamp the decision was made on, or the one the player was looking at when
   *  they chose the account copy (null = the slot was empty): if the local save
   *  moved meanwhile, nothing is written and the rule is asked again. */
  const download = async (uid: string, slot: number, expectStamp: number | null, depth: number): Promise<void> => {
    patchSlot(slot, { status: "syncing", conflict: null });
    const res = await retrying(
      () => fetchCareerSave(uid, slot),
      (r) => r.status === "error" && isTransientSyncFailure(r.reason),
      CLOUD_SYNC.retryDelaysMs,
    );
    if (userId() !== uid) return;
    if (res.status === "error") {
      failed(uid, slot, "read", res);
      return;
    }
    if (res.status === "empty") {
      patchSlot(slot, { cloud: null });
      if (depth > 0) {
        patchSlot(slot, { status: "error" });
        return;
      }
      await applySlot(uid, slot, null, depth + 1);
      return;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(await decodeSaveText(res.payload));
    } catch {
      parsed = null;
    }
    if (userId() !== uid) return;
    if (!looksLikeCareerSave(parsed) || parsed.saveVersion > CURRENT_SAVE_VERSION) {
      failed(uid, slot, "load", { reason: "other" });
      return;
    }
    // The local save moved while the payload was in flight: do not overwrite it.
    const before = localInfo(localSave(slot));
    if ((before?.stamp ?? null) !== expectStamp) {
      patchSlot(slot, { cloud: res.meta });
      if (depth > 0) {
        patchSlot(slot, { status: "conflict", conflict: { slot, kind: "diverged", cloud: res.meta } });
        return;
      }
      await applySlot(uid, slot, res.meta, depth + 1);
      return;
    }
    applying = true;
    let adopted = false;
    try {
      adopted = useCareerStore.getState().adoptSave(slot, parsed);
    } finally {
      applying = false;
    }
    if (!adopted) {
      failed(uid, slot, "load", { reason: "other" });
      return;
    }
    const now = localInfo(localSave(slot))!;
    setBase(uid, slot, { careerId: now.careerId, revision: res.meta.revision, stamp: now.stamp });
    patchSlot(slot, { status: "synced", cloud: res.meta, conflict: null });
    set({
      lastFailure: null,
      notice: { slot, kind: before ? "updated" : "restored", orgName: String(parsed.identity.orgName ?? "") },
    });
  };

  /** Decide one slot against `cloud` and carry the decision out. */
  async function applySlot(uid: string, slot: number, cloud: CloudSlotMeta | null, depth = 0): Promise<void> {
    const local = localInfo(localSave(slot));
    const base = baseFor(readBook(), uid, slot);
    const action: SlotAction = decideSlot({ local, cloud, base, maxSaveVersion: CURRENT_SAVE_VERSION });
    switch (action.type) {
      case "idle":
      case "adopt":
        setBase(uid, slot, action.base);
        patchSlot(slot, { status: local && cloud ? "synced" : "none", cloud, conflict: null });
        return;
      case "upload":
        await upload(uid, slot, action.expectedRevision, false, depth);
        return;
      case "download":
        await download(uid, slot, local?.stamp ?? null, depth);
        return;
      case "delete-cloud": {
        patchSlot(slot, { status: "syncing" });
        const res = await deleteCareerSave(uid, slot, action.careerId, (cloud as CloudSlotMeta).revision);
        if (userId() !== uid) return;
        if (res.status === "error") {
          failed(uid, slot, "delete", res);
          return;
        }
        if (!res.deleted) {
          // Not the row this device saw: another device wrote it since, or it is
          // already gone. List again and let the rule look at what is there.
          const metas = await fetchCareerMetas(uid);
          if (userId() !== uid) return;
          if (metas.status === "error") {
            failed(uid, slot, "list", metas);
            return;
          }
          const fresh = metas.slots.find((m) => m.slot === slot) ?? null;
          if (fresh && depth === 0) {
            await applySlot(uid, slot, fresh, depth + 1);
            return;
          }
          if (fresh) {
            patchSlot(slot, { status: "error", cloud: fresh });
            return;
          }
        }
        setBase(uid, slot, null);
        patchSlot(slot, { status: "none", cloud: null, conflict: null });
        return;
      }
      case "conflict":
        patchSlot(slot, { status: "conflict", cloud, conflict: { slot, kind: action.kind, cloud } });
        return;
      case "newer-build":
        patchSlot(slot, { status: "newer", cloud, conflict: null });
        return;
    }
  }

  /** Ask the account for every slot and reconcile each one. */
  async function reconcile(uid: string): Promise<void> {
    const metas = await retrying(
      () => fetchCareerMetas(uid),
      (r) => r.status === "error" && isTransientSyncFailure(r.reason),
      CLOUD_SYNC.retryDelaysMs,
    );
    if (userId() !== uid) return;
    if (metas.status === "error") {
      failed(uid, null, "list", metas);
      return;
    }
    owedFor = null;
    listedFor = uid;
    clearResync();
    resyncAttempt = 0;
    set({ lastFailure: null });
    for (let slot = 0; slot < CAREER_CLOUD_SLOTS; slot++) {
      if (userId() !== uid) return;
      // A notice the player has not answered stays as it is.
      if (get().slots[slot]?.status === "conflict") {
        const cloud = metas.slots.find((m) => m.slot === slot) ?? null;
        const local = localInfo(localSave(slot));
        const again = decideSlot({ local, cloud, base: baseFor(readBook(), uid, slot), maxSaveVersion: CURRENT_SAVE_VERSION });
        if (again.type === "conflict") {
          patchSlot(slot, { cloud, conflict: { slot, kind: again.kind, cloud } });
          continue;
        }
      }
      await applySlot(uid, slot, metas.slots.find((m) => m.slot === slot) ?? null);
    }
  }

  /** Reconcile one slot against the account row this tab last saw (the write
   *  itself checks the revision, so a stale view is caught by the server). */
  const syncSlot = (slot: number): void => {
    const uid = userId();
    if (!uid) return;
    void enqueue(uid, async () => {
      // The account has not been listed yet (the first read failed, or is still
      // to come): "no row" is not known, so list first.
      if (listedFor !== uid) {
        await reconcile(uid);
        return;
      }
      if (get().slots[slot]?.status === "conflict") return; // the player decides first
      await applySlot(uid, slot, get().slots[slot]?.cloud ?? null);
    });
  };

  function schedulePush(slot: number, now: boolean): void {
    const pending = pushTimers.get(slot);
    if (pending !== undefined) clearTimeout(pending);
    pushTimers.delete(slot);
    if (!userId()) return;
    if (now) {
      syncSlot(slot);
      return;
    }
    pushTimers.set(
      slot,
      setTimeout(() => {
        pushTimers.delete(slot);
        syncSlot(slot);
      }, CLOUD_SYNC.careerPushDebounceMs),
    );
  }

  const flushPending = (): void => {
    for (const slot of [...pushTimers.keys()]) schedulePush(slot, true);
  };

  const clearTimers = (): void => {
    for (const t of pushTimers.values()) clearTimeout(t);
    pushTimers.clear();
    hardFails.clear();
    clearResync();
    resyncAttempt = 0;
    owedFor = null;
  };

  /** The signed-in user, or their access to the cloud copy, changed. */
  const refreshActive = (): void => {
    const uid = userId();
    if (uid === activeUser) return;
    activeUser = uid;
    listedFor = null;
    clearTimers();
    set({ active: uid !== null, slots: emptySlots(), notice: null, lastFailure: null });
    if (uid) void enqueue(uid, () => reconcile(uid));
  };

  /** The career store changed: note what the player did to each slot. */
  const onCareerChange = (
    state: { slots: (CareerSave | null)[] },
    prev: { slots: (CareerSave | null)[] },
  ): void => {
    // v2.0.29: slots swapped for another account's (sign-in / sign-out) are not
    // the player emptying them: no delete mark, no push.
    if (applying || localCareerSwitching() || state.slots === prev.slots) return;
    for (let slot = 0; slot < CAREER_CLOUD_SLOTS; slot++) {
      const before = prev.slots[slot] ?? null;
      const after = state.slots[slot] ?? null;
      if (before === after) continue;
      // The slot was emptied or handed to another career on this device: the
      // account copy of the old one is to go too (see `withLocalDelete` for whose).
      if (before && (!after || careerIdOf(after) !== careerIdOf(before))) {
        const signedIn = useAccountStore.getState().session?.user.id ?? null;
        writeBook(withLocalDelete(readBook(), slot, careerIdOf(before), signedIn));
        hardFails.delete(slot);
      }
      if (!userId()) continue;
      if (get().slots[slot]?.status !== "conflict") patchSlot(slot, { status: after ? "pending" : "syncing" });
      schedulePush(slot, isMilestone(before, after));
    }
  };

  return {
    active: false,
    syncing: false,
    slots: emptySlots(),
    notice: null,
    lastFailure: null,

    start: () => {
      if (started) return;
      started = true;
      readBook(); // creates the device id on first use
      const stopCareer = useCareerStore.subscribe(onCareerChange);
      const stopAccount = useAccountStore.subscribe(refreshActive);
      const stopProfile = useProfileStore.subscribe((s, p) => {
        if (s.grants !== p.grants) refreshActive();
      });
      const doc = typeof document !== "undefined" ? document : null;
      const win = typeof window !== "undefined" ? window : null;
      const onVisibility = (): void => {
        if (doc?.visibilityState === "hidden") {
          hiddenAt = Date.now();
          flushPending(); // leaving the tab: send what is waiting
          return;
        }
        const uid = userId();
        if (!uid) return;
        const away = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        // Back after a while: another device may have played. Also retries an owed sync.
        if (owedFor === uid || away >= CLOUD_SYNC.careerRecheckAfterMs) {
          clearResync();
          void enqueue(uid, () => reconcile(uid));
        }
      };
      const onOnline = (): void => {
        if (resyncTimer === undefined) resyncAttempt = 0;
        retryOwed();
      };
      doc?.addEventListener("visibilitychange", onVisibility);
      win?.addEventListener("online", onOnline);
      stopListeners = () => {
        stopCareer();
        stopAccount();
        stopProfile();
        doc?.removeEventListener("visibilitychange", onVisibility);
        win?.removeEventListener("online", onOnline);
        clearTimers();
      };
      refreshActive();
    },

    syncNow: async () => {
      const uid = userId();
      if (!uid) return;
      await enqueue(uid, () => reconcile(uid));
    },

    resolveConflict: async (slot, choice) => {
      const uid = userId();
      const conflict = get().slots[slot]?.conflict;
      if (!uid || !conflict) return;
      // What the player is looking at as they choose.
      const seen = {
        kind: conflict.kind,
        revision: conflict.cloud?.revision ?? null,
        stamp: localInfo(localSave(slot))?.stamp ?? null,
      };
      trackEvent("career_cloud_conflict", { kind: conflict.kind, choice });
      await enqueue(uid, async () => {
        const current = get().slots[slot]?.conflict;
        if (!current) return;
        // A step queued ahead of this one may have changed the situation (the
        // account copy was deleted, or written again; the career was played on).
        // The choice was made about something else: leave the notice up, now
        // showing what is true, and let the player choose again.
        if (
          current.kind !== seen.kind ||
          (current.cloud?.revision ?? null) !== seen.revision ||
          (localInfo(localSave(slot))?.stamp ?? null) !== seen.stamp
        ) {
          return;
        }
        if (choice === "local") {
          // Keep this device's career: it replaces (or recreates) the account copy.
          await upload(uid, slot, current.cloud?.revision ?? null, true, 1);
          return;
        }
        if (current.kind === "cloud-deleted") {
          // The account copy is gone and the player lets this one go too.
          applying = true;
          try {
            useCareerStore.getState().deleteSlot(slot);
          } finally {
            applying = false;
          }
          setBase(uid, slot, null);
          patchSlot(slot, { status: "none", cloud: null, conflict: null });
          return;
        }
        // Take the account copy over this device's: the player chose it, about
        // the local save as it stood then.
        await download(uid, slot, seen.stamp, 1);
      });
    },

    dismissNotice: () => set({ notice: null }),
  };
});

/** Test support: drop the listeners and the per-load state so a test can start
 *  the store again from scratch. Never called by the app. */
export function resetCareerCloudForTests(): void {
  stopListeners?.();
  stopListeners = undefined;
  started = false;
  activeUser = null;
  listedFor = null;
  book = null;
  applying = false;
  hiddenAt = 0;
  chain = Promise.resolve();
  useCareerCloudStore.setState({ active: false, syncing: false, slots: emptySlots(), notice: null, lastFailure: null });
}
