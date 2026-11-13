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
export function reportSaveError(store: PersistedStoreId, kind: "quota" | "parse" | "migrate" | "write" | "action"): void {
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

/** Where `downgradeGuardedStorage` keeps its second copy of a save. */
export function backupKeyOf(name: string): string {
  return `${name}:backup`;
}

/**
 * v2.0.11: a save that survives an OLDER build writing over it.
 *
 * What happened (13/11/2026, the Season 1 leader): a tab opened before the 2.0
 * deploy stays alive with the pre-2.0 code and shares this origin's storage.
 * When it wakes up it writes the profile back in ITS format and version (11).
 * The next 2.0 load then sees a "pre-v12" save and runs the Season 1 reset on a
 * Season 1 profile: rating, XP and season counters gone, and the lost values
 * folded into the pre-season snapshot.
 *
 * The rule: every write also goes to a second key the old code has never heard
 * of. A read takes the main key whenever it holds a save of the current version
 * or newer (so nothing changes for a healthy save, and the frozen key and
 * version still describe it). When the main key was downgraded (or is missing or
 * unreadable) and the second key holds a current save, that one is returned and
 * no migrate runs. A real pre-season save has no second key and migrates as before.
 */
export function downgradeGuardedStorage<S>(
  base: PersistStorage<S> | undefined,
  currentVersion: number,
): PersistStorage<S> | undefined {
  if (!base) return undefined;
  const current = (v: StorageValue<S> | null): v is StorageValue<S> =>
    v !== null && typeof v === "object" && (v.version ?? 0) >= currentVersion;
  return {
    getItem: (name) => {
      let main: StorageValue<S> | null = null;
      let mainError: unknown;
      try {
        main = base.getItem(name) as StorageValue<S> | null;
      } catch (error) {
        mainError = error;
      }
      if (current(main)) return main;
      let backup: StorageValue<S> | null = null;
      try {
        backup = base.getItem(backupKeyOf(name)) as StorageValue<S> | null;
      } catch {
        backup = null;
      }
      if (current(backup)) return backup;
      if (mainError !== undefined) throw mainError;
      return main;
    },
    setItem: (name, value) => {
      base.setItem(name, value);
      try {
        base.setItem(backupKeyOf(name), value);
      } catch {
        // The main write went through; a full disk is already reported by `base`.
      }
    },
    removeItem: (name) => {
      base.removeItem(name);
      base.removeItem(backupKeyOf(name));
    },
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
    // rc.54: reported after the store module finishes loading. The migrate runs
    // inside the store's creation, before the profile registers what a session
    // carries, and the first event of a visit opens the session: sent from here
    // it gave every returning player a `session_started` with no profile on it,
    // on exactly the visit that matters (their first on a new version).
    queueMicrotask(() => reportMigration(store, version, toVersion));
    return out;
  };
}
