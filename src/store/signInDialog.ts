"use client";

import { create } from "zustand";

/** Disposable UI state only; never persisted into player saves. */
export const useSignInDialog = create<{
  open: boolean;
  show: () => void;
  close: () => void;
}>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
