/**
 * OBS-01 quality events for the four persisted stores (#145):
 * `quality_save_error` (a write that failed — the quota — or a save that could
 * not be read or migrated) and `quality_migration` (a save upgraded to a newer
 * shape).
 *
 * BEHAVIOUR IS UNCHANGED. `reportingJSONStorage` makes exactly the reads and
 * writes of zustand's default `createJSONStorage(() => window.localStorage)`
 * (the storage is resolved once, when the store is created; no storage → no
 * persistence) and `reportingMigrate` returns what the store's migrate returns.
 * Both only REPORT, then rethrow any error to the same place it reached before.
 * Persist keys and versions stay frozen (`persistContract.test.ts`).
 */

import type { PersistStorage, StorageValue } from "zustand/middleware";
import { trackEvent, type GameMode, type PersistedStoreId } from "@/lib/analytics";

const GAME_MODE: Record<PersistedStoreId, GameMode> = {
  settings: "draft",
  profile: "draft",
  run: "draft",
  career: "career",
};

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

/** One report per store and kind per session (a full disk fails every write). */
export function reportSaveError(store: PersistedStoreId, kind: "quota" | "parse" | "migrate" | "write"): void {
  trackEvent("quality_save_error", {
    gameMode: GAME_MODE[store],
    actionId: `save_error:${store}:${kind}`,
    store,
    kind,
  });
}

export function reportMigration(
  store: PersistedStoreId,
  fromVersion: number,
  toVersion: number,
  ref: string = store,
): void {
  trackEvent("quality_migration", {
    gameMode: GAME_MODE[store],
    actionId: `migration:${ref}:${fromVersion}:${toVersion}`,
    store,
    fromVersion,
    toVersion,
  });
}

/** zustand's localStorage JSON storage, reporting failed writes and unreadable saves. */
export function reportingJSONStorage<S>(store: PersistedStoreId): PersistStorage<S> | undefined {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return undefined; // like createJSONStorage: no storage → the store runs unpersisted
  }
  return {
    getItem: (name) => {
      const raw = storage.getItem(name) ?? null;
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch (error) {
        reportSaveError(store, "parse");
        throw error;
      }
    },
    setItem: (name, value) => {
      try {
        storage.setItem(name, JSON.stringify(value));
      } catch (error) {
        reportSaveError(store, isQuotaError(error) ? "quota" : "write");
        throw error;
      }
    },
    removeItem: (name) => storage.removeItem(name),
  };
}

/** Wraps a persist `migrate`: reports the upgrade (or its failure), returns its result. */
export function reportingMigrate<T>(
  store: PersistedStoreId,
  toVersion: number,
  migrate: (persisted: unknown, version: number) => T,
): (persisted: unknown, version: number) => T {
  return (persisted, version) => {
    let out: T;
    try {
      out = migrate(persisted, version);
    } catch (error) {
      reportSaveError(store, "migrate");
      throw error;
    }
    reportMigration(store, version, toVersion);
    return out;
  };
}
