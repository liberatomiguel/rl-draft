"use client";

/**
 * Global achievement-toast queue (v1.4). Anything that awards an achievement
 * pushes its id here; <AchievementToaster> (mounted in AppShell) renders the
 * queue from anywhere — so an achievement pops the MOMENT it's earned, mid-draft
 * or mid-match, not only on the results screen.
 */

import { create } from "zustand";

interface ToastStore {
  queue: string[];
  push: (ids: string[]) => void;
  dismiss: (id: string) => void;
}

export const useAchievementToasts = create<ToastStore>((set) => ({
  queue: [],
  push: (ids) =>
    set((s) => {
      const fresh = ids.filter((id) => !s.queue.includes(id));
      return fresh.length ? { queue: [...s.queue, ...fresh] } : {};
    }),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((x) => x !== id) })),
}));
