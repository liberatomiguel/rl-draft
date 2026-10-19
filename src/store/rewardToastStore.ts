"use client";

/**
 * Generic reward toasts (v2.0): missions completed, the all-three bonus, login
 * streak XP, quiz solves. Payloads are DATA (ids, numbers); <RewardToaster>
 * composes the text from the active copy dictionary at render time, so a toast
 * pushed by a store is translated like everything else.
 */

import { create } from "zustand";

export type RewardToast =
  | { id: string; kind: "mission"; missionId: string; xp: number }
  | { id: string; kind: "missionBonus"; period: "daily" | "weekly"; xp: number }
  | { id: string; kind: "login"; streak: number; xp: number; milestone: number | null }
  | { id: string; kind: "quiz"; attempt: number; xp: number };

/** `Omit` distributed over the union (a plain Omit collapses to the common keys). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type RewardToastInput = DistributiveOmit<RewardToast, "id">;

/** rc.2: the login-streak MODAL (shown once per counted day, on app open). */
export interface LoginModalData {
  streak: number;
  xp: number;
  milestone: number | null;
}

interface RewardToastStore {
  queue: RewardToast[];
  push: (toasts: RewardToastInput[]) => void;
  dismiss: (id: string) => void;
  loginModal: LoginModalData | null;
  showLogin: (data: LoginModalData) => void;
  dismissLogin: () => void;
}

let n = 0;
const nextId = (): string => `rw-${Date.now().toString(36)}-${(n += 1)}`;

export const useRewardToasts = create<RewardToastStore>((set) => ({
  queue: [],
  push: (toasts) =>
    set((s) =>
      toasts.length ? { queue: [...s.queue, ...toasts.map((t) => ({ ...t, id: nextId() } as RewardToast))] } : {},
    ),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
  loginModal: null,
  showLogin: (data) => set({ loginModal: data }),
  dismissLogin: () => set({ loginModal: null }),
}));
