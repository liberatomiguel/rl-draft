import { create } from "zustand";

/**
 * The "two copies" notice can be put away and brought back. `dismissedKey` names the conflict
 * that was put away (slot + kind + the account copy's revision), so a conflict that changes
 * shows the notice again; `openFor` clears it (the saves screen's "Choose" button).
 */
interface CloudNoticeUi {
  dismissedKey: string | null;
  dismiss: (key: string) => void;
  openFor: () => void;
}

export const useCloudNoticeUi = create<CloudNoticeUi>((set) => ({
  dismissedKey: null,
  dismiss: (key) => set({ dismissedKey: key }),
  openFor: () => set({ dismissedKey: null }),
}));
