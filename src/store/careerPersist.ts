/**
 * v2.0 (C1, performance): the career store's persist writer.
 *
 * zustand's `persist` writes the WHOLE persisted slice on every `set` — and
 * the career store sets often for things that are never persisted (a toast
 * dismissed, `lastError` cleared, the scrim playback, the "skip" button's two
 * `scrimPlayback` resets around the real write). Each of those re-serialised
 * every save slot (a save is ~240 KB in its first season and ~350 KB from the
 * eighth; three slots are over 1 MB) and wrote it to localStorage, on the main
 * thread. The cost grew with the save, which is why late seasons felt heavy.
 *
 * `skipUnchangedWrites` wraps the storage: a write whose persisted fields are
 * all the SAME references as the last one written is skipped — nothing in it
 * changed. It is safe because the store never mutates a persisted field in
 * place without replacing its container (`withSave` / `withResult` always put
 * the save in a new `slots` array). A failed write is not remembered, so the
 * next `set` tries again.
 */

import type { PersistStorage, StorageValue } from "zustand/middleware";

export function skipUnchangedWrites<S>(
  storage: PersistStorage<S> | undefined,
  keys: readonly string[],
): PersistStorage<S> | undefined {
  if (!storage) return storage;
  let last: { name: string; version: number | undefined; refs: unknown[] } | null = null;
  return {
    getItem: (name) => storage.getItem(name),
    removeItem: (name) => {
      last = null;
      return storage.removeItem(name);
    },
    setItem: (name: string, value: StorageValue<S>) => {
      const state = (value.state ?? {}) as Record<string, unknown>;
      const refs = keys.map((k) => state[k]);
      if (
        last !== null &&
        last.name === name &&
        last.version === value.version &&
        refs.every((r, i) => Object.is(r, last!.refs[i]))
      ) {
        return;
      }
      const out = storage.setItem(name, value);
      last = { name, version: value.version, refs };
      return out;
    },
  };
}
