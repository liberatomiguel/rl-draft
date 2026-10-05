"use client";

/**
 * Account session state (v1.4) — one shared place for "am I signed in, who am I,
 * am I syncing". The header chip, the Profile account hub and the Leaderboards
 * all read this. When accounts are disabled (no Supabase env), it sits in a
 * permanent `signedOut` state and every action is a no-op, so the app is
 * unchanged for guests.
 *
 * Lazy auth (static-export move): `init()` only downloads supabase-js when a
 * persisted Supabase session exists (a returning signed-in player) or the URL is
 * an auth redirect. A guest goes straight to `signedOut`; the auth listener is
 * registered anyway and binds as soon as anything creates the client (sending a
 * sign-in code, opening the leaderboards, or a sign-in in another tab).
 *
 * Save safety (the "never lose progress" rule, DESIGN-DECISIONS #55.7):
 *  - a sync never reads the local profile before the profile store has HYDRATED
 *    from localStorage;
 *  - a failed cloud read ABORTS the sync — nothing is merged or pushed;
 *  - the local snapshot is taken AFTER the cloud read, so progress made while
 *    the read was in flight is merged instead of being reverted;
 *  - the snapshot also folds in the profile as currently SAVED (another tab may
 *    have saved newer progress — zustand persist never re-reads storage) with the
 *    monotonic merge; memory is never replaced by storage;
 *  - at most one sync per user is in flight, and the automatic sync runs once
 *    per page load per user (INITIAL_SESSION / first SIGNED_IN). TOKEN_REFRESHED
 *    and the SIGNED_IN Supabase re-emits on tab refocus don't sync again;
 *  - progress made later in the session is pushed by the tab that made it: a
 *    debounced push (CLOUD_SYNC.pushDebounceMs after the last profile change, or
 *    at once when the tab is hidden) that only syncs when the durable profile
 *    differs from what this tab last pushed. Idle tabs never sync.
 *
 * Engine purity holds: this is store/lib only; nothing under src/engine touches it.
 */

import { create } from "zustand";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { mergeProfiles, toDurable } from "@/lib/profileSync";
import {
  accountsEnabled,
  deleteAccount as sbDeleteAccount,
  fetchCloudRow,
  getSession,
  hasStoredAuthSession,
  isUsernameAvailable,
  leaderboardStats,
  onAuthChange,
  onStoredAuthSession,
  pushCloudProfile,
  signOut as sbSignOut,
  startAuth,
  updateUsername as sbUpdateUsername,
} from "@/lib/supabase";
import {
  pruneEarnedAchievements,
  pruneUnlockedSpecials,
  selectDailyStreak,
  useProfileStore,
} from "./profileStore";
import type { ProfileState } from "./profileStore";
import { CLOUD_SYNC, MMR, mmrBackfillFloor } from "@/config/balance";
import type { DurableProfile } from "@/lib/profileSync";

type Status = "loading" | "signedOut" | "signedIn";

const emailPrefix = (s: Session) => s.user.email?.split("@")[0] ?? "Player";

interface AccountStore {
  enabled: boolean;
  status: Status;
  session: Session | null;
  username: string | null;
  syncing: boolean;
  /** The email a sign-in code was just sent to, if a sign-in is mid-flight. Lives in
   *  the store (a navigation-surviving singleton) instead of the SignIn component's
   *  local state, so leaving and returning to /profile resumes the code step with the
   *  email remembered — the player can still enter the code they already received. */
  pendingEmail: string | null;
  /** Mount-once guard so init() only wires listeners a single time. */
  initialized: boolean;

  init: () => void;
  setPendingEmail: (email: string | null) => void;
  syncNow: (session?: Session) => Promise<void>;
  checkUsername: (name: string) => Promise<boolean>;
  setUsername: (name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/** Resolves once the persisted profile has been loaded from localStorage. The
 *  default persist storage hydrates synchronously at store creation, so this is
 *  normally already true; if hydration ever becomes async (or fails), syncing
 *  waits (or never runs) rather than merging the empty initial state. */
function whenProfileHydrated(): Promise<void> {
  const p = useProfileStore.persist;
  if (!p || p.hasHydrated()) return Promise.resolve(); // no storage (tests/SSR) → nothing to load
  return new Promise((resolve) => {
    let unsub: (() => void) | undefined = undefined;
    unsub = p.onFinishHydration(() => {
      unsub?.();
      resolve();
    });
  });
}

/** The durable profile as currently SAVED in storage. zustand persist never
 *  re-reads storage after load, so another tab may have saved newer progress than
 *  this tab holds in memory. Null (= ignore it) when there is no storage, or it is
 *  unreadable, async, malformed, or holds another schema version (an older or newer
 *  build open in another tab). Synchronous, so it can't interleave with a sync. */
function storedDurable(): DurableProfile | null {
  const p = useProfileStore.persist;
  if (!p) return null;
  try {
    const { name, version, storage } = p.getOptions();
    if (!name || !storage) return null;
    const saved = storage.getItem(name);
    if (!saved || saved instanceof Promise || saved.version !== version) return null;
    const state = saved.state as Partial<ProfileState> | null;
    if (
      !state ||
      typeof state !== "object" ||
      typeof state.xp !== "number" ||
      !Array.isArray(state.runHistory)
    ) {
      return null;
    }
    return toDurable({ ...useProfileStore.getState(), ...state });
  } catch {
    return null;
  }
}

/** Signature of the durable profile in memory — what a push would carry. */
const durableSig = (): string => JSON.stringify(toDurable(useProfileStore.getState()));

/** "synced" = cloud and local reconciled and pushed; "aborted" = nothing written
 *  to the cloud (failed read, failed push, or an unexpected error). */
type SyncOutcome = "synced" | "aborted";

/** Users whose automatic sync already succeeded during this page load. */
const syncedThisLoad = new Set<string>();
/** The one in-flight sync per user (concurrent callers share it). */
const inFlight = new Map<string, Promise<SyncOutcome>>();
/** What this tab's last successful push carried: the store signature taken AFTER
 *  the sync's own hydrate and BEFORE the push await. The debounced push skips
 *  when the store still matches it. Cleared on sign-out / user switch. */
let lastPushed: { userId: string; sig: string } | null = null;
/** The pending debounced push, if any. */
let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** True while a sync writes its merged profile into the store — that write is
 *  the sync's own result (already being pushed), not new progress. */
let applyingSync = false;
/** Undo for the watchers init() registers (a re-init replaces them — tests only;
 *  in the app init() runs once). */
let stopWatchers: (() => void) | undefined;

export const useAccountStore = create<AccountStore>((set, get) => {
  /** Show a display name — only while that user is still the signed-in one, so a
   *  late sync never resurrects a name after a sign-out or a user switch. */
  const showName = (userId: string, name: string): void => {
    if (get().session?.user.id === userId) set({ username: name });
  };

  /** v1.4.4 parity: a signed-in player always sees a name, even when a sync
   *  aborts — keep the one shown, else fall back to the email prefix. */
  const keepName = (session: Session): void => {
    if (!get().username) showName(session.user.id, emailPrefix(session));
  };

  /** One full reconcile: read cloud → merge → hydrate local → push. */
  const runSync = async (session: Session): Promise<SyncOutcome> => {
    const userId = session.user.id;
    await whenProfileHydrated();
    const row = await fetchCloudRow(userId);
    // Never push over a backup we could not read: a transient read error must not
    // be treated as "no row" (fresh device + one 5xx would wipe the cloud copy).
    if (row.status === "error") {
      keepName(session);
      return "aborted";
    }
    // The stored name is known now — show it even if the push below fails.
    const cloudName = row.status === "ok" ? row.username : null;
    if (cloudName) showName(userId, cloudName);
    // Snapshot local only now (after the await) — nothing can interleave between
    // here and hydrateDurable, so in-flight progress is merged, never reverted.
    // Fold in what is SAVED too (another tab may have saved newer progress) with
    // the monotonic merge — never by replacing memory with storage.
    const memory = toDurable(useProfileStore.getState());
    const stored = storedDurable();
    let local = memory;
    let folded = false;
    if (stored) {
      try {
        local = mergeProfiles(memory, stored);
        folded = true;
      } catch {
        // A malformed save: ignore it — memory alone is still a complete snapshot.
      }
    }
    const cloudDurable = row.status === "ok" ? row.durable : null;
    const mergedRaw = cloudDurable ? mergeProfiles(local, cloudDurable) : local;
    // Prune stale achievement ids the cloud row may still carry (the v1.4 swap)
    // BEFORE we hydrate AND push — so the count is right locally and the cloud
    // row self-heals on this write instead of re-seeding the stale ids forever.
    const merged: DurableProfile = {
      ...mergedRaw,
      achievements: pruneEarnedAchievements(mergedRaw.achievements),
      unlockedSpecials: pruneUnlockedSpecials(mergedRaw.unlockedSpecials),
      // Seed MMR for a signed-in veteran whose cloud row predates MMR (covers the
      // fresh-device case the local migrate can't). Floor from title history, capped
      // at 1500; live-earned values above it (forward play) are preserved by the max.
      mmr: Math.max(mergedRaw.mmr ?? MMR.start, mmrBackfillFloor(mergedRaw.wins)),
    };
    if (cloudDurable || folded) {
      applyingSync = true;
      try {
        useProfileStore.getState().hydrateDurable(merged); // never lose local
      } finally {
        applyingSync = false;
      }
    }
    // What this push carries, read from the store AFTER the hydrate (so the hydrate
    // itself never looks like new progress) and BEFORE the await (so progress made
    // while the push is in flight still counts as unsynced).
    const sig = durableSig();
    const username = cloudName || emailPrefix(session);
    const streak = selectDailyStreak(useProfileStore.getState());
    const pushed = await pushCloudProfile(userId, username, merged, leaderboardStats(merged, streak));
    if (pushed.error) {
      keepName(session);
      return "aborted";
    }
    if (!cloudName) showName(userId, username); // the fallback name is now the stored one
    if (get().session?.user.id === userId) lastPushed = { userId, sig };
    return "synced";
  };

  /** Run a sync for this user, or join the one already in flight. */
  const syncGuarded = (session: Session): Promise<SyncOutcome> => {
    const userId = session.user.id;
    const running = inFlight.get(userId);
    if (running) return running;
    set({ syncing: true });
    const p = runSync(session)
      .catch((): SyncOutcome => {
        keepName(session);
        return "aborted";
      })
      .then((outcome) => {
        // Only while this user is still signed in: a sync that lands after a
        // sign-out must not make the next sign-in skip its own sync.
        if (outcome === "synced" && get().session?.user.id === userId) syncedThisLoad.add(userId);
        return outcome;
      })
      .finally(() => {
        inFlight.delete(userId);
        if (inFlight.size === 0) set({ syncing: false });
      });
    inFlight.set(userId, p);
    return p;
  };

  /** Automatic sync: once per page load per user. A failed attempt (nothing was
   *  pushed) may be retried by a later sign-in event. */
  const autoSync = (session: Session): void => {
    if (syncedThisLoad.has(session.user.id)) return;
    void syncGuarded(session);
  };

  const clearPushTimer = (): void => {
    if (pushTimer !== undefined) clearTimeout(pushTimer);
    pushTimer = undefined;
  };

  /** Forget the pending push and the last-pushed signature (sign-out / switch). */
  const resetPush = (): void => {
    clearPushTimer();
    lastPushed = null;
  };

  /** The debounced mid-session push: sync only when the durable profile differs
   *  from what this tab last pushed. Goes through syncGuarded, so the tagged read,
   *  abort-on-read-error and one-in-flight guards all still apply. */
  const pushIfChanged = (): void => {
    clearPushTimer();
    const session = get().session;
    if (!session) return;
    const userId = session.user.id;
    const running = inFlight.get(userId);
    if (running) {
      // Its snapshot may predate the change — look again once it settles.
      void running.then(schedulePush);
      return;
    }
    // The load's first sync belongs to INITIAL_SESSION / SIGNED_IN (and their retry).
    if (!syncedThisLoad.has(userId)) return;
    if (lastPushed?.userId === userId && lastPushed.sig === durableSig()) return; // nothing new
    void syncGuarded(session);
  };

  const schedulePush = (): void => {
    clearPushTimer();
    if (!get().session) return;
    pushTimer = setTimeout(pushIfChanged, CLOUD_SYNC.pushDebounceMs);
  };

  /** Profile store listener: (re)arm the debounce on any change while signed in,
   *  once this load's first sync has succeeded or while it runs (its snapshot may
   *  predate the change). Before that, INITIAL_SESSION / SIGNED_IN owns syncing. */
  const onProfileChange = (): void => {
    if (applyingSync) return; // the sync's own merge write — already being pushed
    const userId = get().session?.user.id;
    if (userId && (syncedThisLoad.has(userId) || inFlight.has(userId))) schedulePush();
  };

  const onAuth = (session: Session | null, event: AuthChangeEvent): void => {
    if (get().session?.user.id !== session?.user.id) {
      // Signed out, or another user signed in: the pending push, the last-pushed
      // signature and the shown name all belonged to the previous user.
      resetPush();
      set({ username: null });
    }
    set({ session, status: session ? "signedIn" : "signedOut" });
    if (!session) {
      set({ username: null });
      if (event === "SIGNED_OUT") {
        syncedThisLoad.clear(); // a fresh sign-in syncs again
        resetPush();
      }
      return;
    }
    set({ pendingEmail: null }); // sign-in completed — clear the in-flight email
    // Only the session's arrival syncs; TOKEN_REFRESHED / USER_UPDATED never do,
    // and repeat SIGNED_IN events (tab refocus) are absorbed by autoSync's guard.
    // Later progress reaches the cloud through the debounced push instead.
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") autoSync(session);
  };

  /** Download + create the Supabase client and adopt its current session. */
  const startSession = (): void => {
    startAuth()
      .then((ok) => (ok ? getSession() : null))
      .then((s) => onAuth(s, "INITIAL_SESSION"))
      .catch(() => {
        if (get().status === "loading") set({ status: "signedOut" });
      });
  };

  return {
    enabled: accountsEnabled,
    status: accountsEnabled ? "loading" : "signedOut",
    session: null,
    username: null,
    syncing: false,
    pendingEmail: null,
    initialized: false,

    setPendingEmail: (email) => set({ pendingEmail: email }),

    init: () => {
      if (get().initialized) return;
      set({ initialized: true });
      if (!accountsEnabled) {
        set({ status: "signedOut" });
        return;
      }
      // Registering is free (no download); it binds when the client is created.
      onAuthChange(onAuth);
      // Mid-session push: watch the profile; leaving the tab (switch, minimise,
      // close) sends a pending push at once instead of waiting out the debounce.
      stopWatchers?.();
      const stopProfile = useProfileStore.subscribe(onProfileChange);
      const doc = typeof document !== "undefined" ? document : null;
      const onVisibility = (): void => {
        if (doc?.visibilityState === "hidden" && pushTimer !== undefined) pushIfChanged();
      };
      doc?.addEventListener("visibilitychange", onVisibility);
      stopWatchers = () => {
        stopProfile();
        doc?.removeEventListener("visibilitychange", onVisibility);
      };
      if (hasStoredAuthSession()) {
        startSession(); // returning signed-in player / auth redirect
      } else {
        set({ status: "signedOut" }); // guest: no Supabase download at startup
        // A sign-in completed in another tab → adopt it here too.
        const stop = onStoredAuthSession(() => {
          stop();
          startSession();
        });
      }
    },

    syncNow: async (sessionArg) => {
      const session = sessionArg ?? get().session;
      if (!session) return;
      await syncGuarded(session);
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
      resetPush();
      set({ session: null, username: null, status: "signedOut", pendingEmail: null });
    },

    deleteAccount: async () => {
      await sbDeleteAccount();
      resetPush();
      set({ session: null, username: null, status: "signedOut" });
    },
  };
});
