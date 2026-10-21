"use client";

/**
 * Cosmetic unlock queue (rc.20): the ids of titles / badges / banners the
 * player just earned, in order. `profileStore` pushes them the moment the
 * derivation adds an owned id (hydration and cloud merges stay quiet);
 * <CosmeticUnlockModal> (AppShell) shows one at a time — art, rarity, a short
 * description and the chance to wear it right away — after the run
 * ceremonies and the login modal have had their turn.
 */

import { create } from "zustand";

interface CosmeticUnlockStore {
  queue: string[];
  push: (ids: string[]) => void;
  /** Drop the first item (the one being shown). */
  shift: () => void;
  clear: () => void;
}

export const useCosmeticUnlocks = create<CosmeticUnlockStore>((set) => ({
  queue: [],
  push: (ids) =>
    set((s) => {
      const fresh = ids.filter((id) => !s.queue.includes(id));
      return fresh.length ? { queue: [...s.queue, ...fresh] } : {};
    }),
  shift: () => set((s) => (s.queue.length ? { queue: s.queue.slice(1) } : {})),
  clear: () => set({ queue: [] }),
}));
