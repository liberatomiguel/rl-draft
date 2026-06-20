"use client";

/**
 * Account session state (v1.4) — one shared place for "am I signed in, who am I,
 * am I syncing". The header chip, the Profile account hub and the Leaderboards
 * all read this. When accounts are disabled (no Supabase env), it sits in a
 * permanent `signedOut` state and every action is a no-op, so the app is
 * unchanged for guests.
 *
 * Engine purity holds: this is store/lib only; nothing under src/engine touches it.
 */

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { mergeProfiles, toDurable } from "@/lib/profileSync";
import {
  accountsEnabled,
  deleteAccount as sbDeleteAccount,
  fetchCloudRow,
  getSession,
  isUsernameAvailable,
  leaderboardStats,
  onAuthChange,
  pushCloudProfile,
  signOut as sbSignOut,
  updateUsername as sbUpdateUsername,
} from "@/lib/supabase";
import {
  pruneEarnedAchievements,
  pruneUnlockedSpecials,
  selectDailyStreak,
  useProfileStore,
} from "./profileStore";
import { mmrBackfillFloor } from "@/config/balance";
import type { DurableProfile } from "@/lib/profileSync";

type Status = "loading" | "signedOut" | "signedIn";

const emailPrefix = (s: Session) => s.user.email?.split("@")[0] ?? "Player";

interface AccountStore {
  enabled: boolean;
  status: Status;
  session: Session | null;
  username: string | null;
  syncing: boolean;
  /** Mount-once guard so init() only wires listeners a single time. */
  initialized: boolean;

  init: () => void;
  syncNow: (session?: Session) => Promise<void>;
  checkUsername: (name: string) => Promise<boolean>;
  setUsername: (name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  enabled: accountsEnabled,
  status: accountsEnabled ? "loading" : "signedOut",
  session: null,
  username: null,
  syncing: false,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });
    if (!accountsEnabled) {
      set({ status: "signedOut" });
      return;
    }
    getSession().then((s) => {
      set({ session: s, status: s ? "signedIn" : "signedOut" });
      if (s) get().syncNow(s);
    });
    onAuthChange((s) => {
      set({ session: s, status: s ? "signedIn" : "signedOut" });
      if (s) get().syncNow(s);
      else set({ username: null });
    });
  },

  syncNow: async (sessionArg) => {
    const session = sessionArg ?? get().session;
    if (!session) return;
    set({ syncing: true });
    try {
      const local = toDurable(useProfileStore.getState());
      const row = await fetchCloudRow(session.user.id);
      const mergedRaw = row?.durable ? mergeProfiles(local, row.durable) : local;
      // Prune stale achievement ids the cloud row may still carry (the v1.4 swap)
      // BEFORE we hydrate AND push — so the count is right locally and the cloud
      // row self-heals on this write instead of re-seeding the stale ids forever.
      const merged: DurableProfile = {
        ...mergedRaw,
        achievements: pruneEarnedAchievements(mergedRaw.achievements),
        unlockedSpecials: pruneUnlockedSpecials(mergedRaw.unlockedSpecials),
        // Seed MMR for a signed-in veteran whose cloud row predates MMR (covers
        // the fresh-device case the local migrate can't). Idempotent floor.
        mmr: Math.max(
          mergedRaw.mmr ?? 200,
          mmrBackfillFloor(mergedRaw.wins, mergedRaw.podiums, mergedRaw.runsCompleted),
        ),
      };
      if (row?.durable) useProfileStore.getState().hydrateDurable(merged); // never lose local
      const username = row?.username || emailPrefix(session);
      const streak = selectDailyStreak(useProfileStore.getState());
      await pushCloudProfile(session.user.id, username, merged, leaderboardStats(merged, streak));
      set({ username });
    } finally {
      set({ syncing: false });
    }
  },

  checkUsername: async (name) => {
    return isUsernameAvailable(name, get().username ?? "");
  },

  setUsername: async (name) => {
    const session = get().session;
    if (!session) return { error: "signed out" };
    const next = name.trim().slice(0, 24);
    const res = await sbUpdateUsername(session.user.id, next);
    if (!res.error) set({ username: next });
    return res;
  },

  signOut: async () => {
    await sbSignOut();
    set({ session: null, username: null, status: "signedOut" });
  },

  deleteAccount: async () => {
    await sbDeleteAccount();
    set({ session: null, username: null, status: "signedOut" });
  },
}));
