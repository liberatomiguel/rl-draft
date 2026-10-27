/**
 * Lazy access to the run store (rc.26, #60). `runStore` pulls in the dataset
 * and the whole engine, so the shared path — AppShell in the root layout, the
 * home menu — must not import it statically. What they need is small: clear a
 * run in progress when the player leaves /play, and start one from a menu
 * card. This module does both without loading the store unless a run exists
 * or is about to start.
 */

import type { useRunStore } from "./runStore";

/** The run store's persist key — `runStore.ts` writes it (persist contract). */
export const RUN_STORAGE_KEY = "rocket-draft:run:v1";

/** Loads the run store with its dataset + engine chunks (cached after the first call). */
export const loadRunStore = () => import("./runStore");

export type RunStoreState = ReturnType<typeof useRunStore.getState>;

let loaded: typeof useRunStore | null = null;

/** Called once by `runStore.ts` when the store is created. */
export function registerRunStore(store: typeof useRunStore): void {
  loaded = store;
}

/** Whether localStorage holds a run (the store persists `{ state: { run } }`). */
export function hasPersistedRun(): boolean {
  try {
    const raw = window.localStorage.getItem(RUN_STORAGE_KEY);
    return raw !== null && Boolean((JSON.parse(raw) as { state?: { run?: unknown } }).state?.run);
  } catch {
    // No storage (server render, blocked storage) or an unreadable save: the
    // store could not hydrate a run from it either.
    return false;
  }
}

/**
 * Clear the run in progress, if any: `useRunStore.getState().clearRun()`,
 * which also logs an abandonment. Once the store is loaded it is called right
 * away, as before. Until then the only possible run is the one persisted in
 * localStorage, so the store loads only when that exists.
 */
export function clearRunInProgress(): void {
  if (loaded) {
    if (loaded.getState().run) loaded.getState().clearRun();
    return;
  }
  if (!hasPersistedRun()) return;
  loadRunStore()
    .then(({ useRunStore }) => {
      if (useRunStore.getState().run) useRunStore.getState().clearRun();
    })
    .catch(() => {
      // Offline, or a deploy replaced the chunk: the next navigation retries.
    });
}
