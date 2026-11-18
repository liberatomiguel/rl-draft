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
 * Failures (v2.0.25, POSTLAUNCH-2.0-REPORT item 6): every failed read or push is
 * NAMED (lib/syncErrors). A failed READ that may simply pass (dropped connection,
 * server error) is tried again within the sync. A failed PUSH is never repeated
 * on its own (the cloud may have changed since the read): the sync is owed
 * instead, per user, and the whole read, merge and push runs again after a
 * pause, when the connection comes back, when the tab returns, or with the next
 * progress. A new account takes the fallback name only when the name itself was
 * refused, never because the network failed.
 * One device, several accounts (v2.0.29, DESIGN-DECISIONS #170): the local
 * profile belongs to ONE account at a time (`rocket-draft:profile-owner:v1`).
 *  - a guest's progress is claimed by the first account that signs in (the
 *    guest → account migration, unchanged);
 *  - signing out stashes the profile under that account's id and resets the
 *    device to a fresh guest — the next account never inherits it;
 *  - a sign-in as a different account than the owner (no sign-out in between,
 *    e.g. an expired session) stashes the owner's profile and starts clean;
 *  - signing back in folds that account's stash in, so progress the last push
 *    did not carry is never lost;
 *  - a sync whose user lost the profile while its cloud read was in flight
 *    aborts: it never writes one account's row into another's (or a guest's).
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
import { CLOUD_SYNC } from "@/config/balance";
import {
  dropCareerStash,
  forgetLocalOwnerForTests,
  readLocalOwner,
  restoreCareersFor,
  stashCareersFor,
  writeLocalOwner,
} from "@/lib/localOwner";
import { useSignInDialog } from "./signInDialog";
import { registerSessionProps, trackEvent } from "@/lib/analytics";
import type { DurableProfile } from "@/lib/profileSync";
import { retrying } from "@/lib/retry";
import { isRecoverableSyncFailure, isTransientSyncFailure, type SyncFailReason } from "@/lib/syncErrors";

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
  /** v2.0.4: the account was created by this sign-in and still carries the automatic
   *  name: the sign-in dialog offers the choice once. Never persisted. */
  needsName: boolean;
  setNeedsName: (needs: boolean) => void;
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

// ── Which account the local profile belongs to (v2.0.29) ──────────────────────
// Plain localStorage keys next to the persisted stores (not zustand stores, so
// not part of the persist contract). Each read / write falls back to memory
// when storage is missing or blocked (tests, private windows).
/** How long signing out waits for a last push of unsynced progress. A network
 *  bound, not a gameplay value (kept out of balance.ts so BALANCE_VERSION does
 *  not move): the profile is stashed on the device either way. */
const SIGN_OUT_FLUSH_MS = 4000;
const STASH_PREFIX = "rocket-draft:account-stash:v1:";
const stashMem = new Map<string, string>();
const readOwner = readLocalOwner;
const writeOwner = writeLocalOwner;

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readStash(userId: string): DurableProfile | null {
  let raw: string | null | undefined = stashMem.get(userId);
  try {
    const ls = storage();
    if (ls) raw = ls.getItem(STASH_PREFIX + userId) ?? raw;
  } catch {
    // memory copy only
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DurableProfile;
    return parsed && typeof parsed.xp === "number" && Array.isArray(parsed.runHistory) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStash(userId: string, durable: DurableProfile | null): void {
  const raw = durable ? JSON.stringify(durable) : null;
  if (raw) stashMem.set(userId, raw);
  else stashMem.delete(userId);
  try {
    const ls = storage();
    if (!ls) return;
    if (raw) ls.setItem(STASH_PREFIX + userId, raw);
    else ls.removeItem(STASH_PREFIX + userId);
  } catch {
    // quota / blocked: the memory copy and the cloud row remain
  }
}

/** Tests only: forget the owner and every stash (module state outlives a test). */
export function forgetLocalProfileOwner(): void {
  forgetLocalOwnerForTests();
  stashMem.clear();
  try {
    const ls = storage();
    if (!ls) return;
    for (let i = ls.length - 1; i >= 0; i -= 1) {
      const k = ls.key(i);
      if (k?.startsWith(STASH_PREFIX)) ls.removeItem(k);
    }
  } catch {
    // nothing stored
  }
}

/** The local profile as a whole: memory folded with what is saved (another tab). */
function localDurable(): DurableProfile {
  const memory = toDurable(useProfileStore.getState());
  const stored = storedDurable();
  if (!stored) return memory;
  try {
    return mergeProfiles(memory, stored);
  } catch {
    return memory;
  }
}

/** Keep `durable` aside for `userId`, folded with what was already kept. */
function stashFor(userId: string, durable: DurableProfile): void {
  const prev = readStash(userId);
  let next = durable;
  if (prev) {
    try {
      next = mergeProfiles(durable, prev);
    } catch {
      // a malformed stash: replace it
    }
  }
  writeStash(userId, next);
}

/** Signature of the durable profile in memory — what a push would carry. */
const durableSig = (): string => JSON.stringify(toDurable(useProfileStore.getState()));

/** "synced" = cloud and local reconciled and pushed; "aborted" = nothing written
 *  to the cloud (failed read, failed push, or an unexpected error). */
type SyncOutcome = "synced" | "aborted";
/** One run's result: `owed` when it failed for a reason that may pass. */
interface SyncRun {
  outcome: SyncOutcome;
  owed: boolean;
}

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
/** v2.0.25: the user whose last sync failed for a reason that may pass (network,
 *  server, token, offline). It is owed: retried after a pause, on `online`, or
 *  when the tab returns. Per user, so a late sync of a previous user never
 *  touches it. Cleared by that user's sync going through and on sign-out. */
let owedFor: string | null = null;
/** The pending retry of an owed sync, and how many pauses were already spent. */
let resyncTimer: ReturnType<typeof setTimeout> | undefined;
let resyncAttempt = 0;
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

  /** A sync stopped at `stage`: name it for analytics (once per session, stage and
   *  reason) and remember whether it is worth trying again later. */
  const failed = (stage: "read" | "push", failure: { reason?: SyncFailReason; code?: string }): SyncRun => {
    const reason = failure.reason ?? "other";
    trackEvent("account_sync_failed", {
      actionId: `sync_failed:${stage}:${reason}`,
      stage,
      reason,
      ...(failure.code ? { code: failure.code } : {}),
    });
    return { outcome: "aborted", owed: isRecoverableSyncFailure(failure.reason) };
  };

  /** Replace the local profile with a fresh guest one. Not progress: no push. */
  const resetLocalProfile = (): void => {
    applyingSync = true;
    try {
      useProfileStore.getState().resetAll();
    } finally {
      applyingSync = false;
    }
  };

  /** This account takes the local profile. A guest's progress comes along (the
   *  guest → account migration); another account's is stashed under that
   *  account and the device starts clean, so it never reaches this account. */
  const claimLocalProfile = (userId: string): void => {
    const owner = readOwner();
    if (owner === userId) return;
    if (owner) {
      stashFor(owner, localDurable());
      resetLocalProfile();
      stashCareersFor(owner); // v2.0.29: their careers go aside with the profile
    }
    writeOwner(userId);
    restoreCareersFor(userId); // what this account left here, back in its slots
  };

  /** The account leaves this device: keep its profile aside (progress the last
   *  push did not carry is folded back in at its next sign-in) and reset the
   *  device to a fresh guest. */
  const releaseLocalProfile = (userId: string): void => {
    const owner = readOwner();
    if (owner && owner !== userId) {
      // Another tab already handed the profile to another account: this tab's
      // memory is stale, so adopt what that tab saved instead of resetting it.
      try {
        void useProfileStore.persist?.rehydrate();
      } catch {
        // nothing saved to adopt
      }
      return;
    }
    stashFor(userId, localDurable());
    resetLocalProfile();
    stashCareersFor(userId);
    writeOwner(null);
  };

  /** One full reconcile: read cloud → merge → hydrate local → push. */
  const runSync = async (session: Session): Promise<SyncRun> => {
    const userId = session.user.id;
    await whenProfileHydrated();
    claimLocalProfile(userId);
    const row = await retrying(
      () => fetchCloudRow(userId),
      (r) => r.status === "error" && isTransientSyncFailure(r.reason),
      CLOUD_SYNC.retryDelaysMs,
    );
    // Never push over a backup we could not read: a transient read error must not
    // be treated as "no row" (fresh device + one 5xx would wipe the cloud copy).
    if (row.status === "error") {
      keepName(session);
      return failed("read", row);
    }
    // The account signed out (or another one took the device) while the read was
    // in flight: the local profile is no longer this account's to merge or push.
    if (readOwner() !== userId) return { outcome: "aborted", owed: false };
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
    // What this account left on this device when it last signed out.
    const stash = readStash(userId);
    if (stash) {
      try {
        local = mergeProfiles(local, stash);
        folded = true;
      } catch {
        // a malformed stash: the cloud row still holds the last push
      }
    }
    const cloudDurable = row.status === "ok" ? row.durable : null;
    const mergedRaw = cloudDurable ? mergeProfiles(local, cloudDurable) : local;
    // Prune stale achievement ids the cloud row may still carry (the v1.4 swap)
    // BEFORE we hydrate AND push — so the count is right locally and the cloud
    // row self-heals on this write instead of re-seeding the stale ids forever.
    // Server-owned extras (v2.0): the manual grants and the frozen pre-season place
    // are read-only facts about this account — fold them in on every sync so a
    // grant Miguel added in the dashboard shows up on the next visit.
    const cloudGrants = row.status === "ok" ? row.grants : [];
    const cloudPosition = row.status === "ok" ? row.preseasonPosition : null;
    const cloudPlaces = row.status === "ok" ? row.preseasonPositions : {};
    const hasCloudPlaces = Object.keys(cloudPlaces).length > 0;
    const preseason = mergedRaw.legacy?.preseason ?? null;
    const merged: DurableProfile = {
      ...mergedRaw,
      achievements: pruneEarnedAchievements(mergedRaw.achievements),
      unlockedSpecials: pruneUnlockedSpecials(mergedRaw.unlockedSpecials),
      grants: [...new Set([...(mergedRaw.grants ?? []), ...cloudGrants])].sort(),
      legacy: {
        // The cloud is the only source of the frozen places: it replaces whatever
        // an earlier sync stored (a board frozen again before launch must not stick).
        preseason:
          preseason && (cloudPosition || hasCloudPlaces)
            ? {
                ...preseason,
                position: cloudPosition ?? preseason.position,
                ...(hasCloudPlaces ? { positions: cloudPlaces } : {}),
              }
            : preseason,
      },
    };
    if (cloudDurable || folded || cloudGrants.length || cloudPosition || hasCloudPlaces) {
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
    // A NEW account starts with the email prefix. Names are unique: when it is
    // taken (two emails with the same prefix), fall back to the prefix plus four
    // digits so the account is never left without a row. v2.0.4: the player then
    // picks the name in the sign-in dialog (`needsName`), after the account exists.
    let username = cloudName || emailPrefix(session);
    const streak = selectDailyStreak(useProfileStore.getState());
    // One attempt: `merged` is the cloud as it was at the read. A push repeated
    // after a pause could replace what another device wrote meanwhile, so a failed
    // push leaves the sync owed and the whole read, merge and push runs again.
    let pushed = await pushCloudProfile(userId, username, merged, leaderboardStats(merged, streak));
    // v2.0.25: only a refused NAME takes the fallback. Until 2.0.24 any failed
    // first push did (a dropped connection gave a new account a name with digits).
    if (pushed.error && !cloudName && pushed.reason === "conflict") {
      username = `${emailPrefix(session).slice(0, 19)}${1000 + Math.floor(Math.random() * 9000)}`;
      pushed = await pushCloudProfile(userId, username, merged, leaderboardStats(merged, streak));
    }
    if (pushed.error) {
      keepName(session);
      return failed("push", pushed);
    }
    // The stash is in the cloud now. Only while the account still owns the device:
    // a sign-out during the push wrote a newer stash that must survive.
    if (stash && readOwner() === userId) writeStash(userId, null);
    if (!cloudName) showName(userId, username); // the fallback name is now the stored one
    // v2.0.4: the row did not exist before this sync = the account was just created.
    // Ask for the display name now (the sign-in dialog shows that step).
    if (row.status === "no-row" && get().session?.user.id === userId) {
      set({ needsName: true });
      useSignInDialog.getState().show();
    }
    if (get().session?.user.id === userId) lastPushed = { userId, sig };
    return { outcome: "synced", owed: false };
  };

  /** Run a sync for this user, or join the one already in flight. */
  const syncGuarded = (session: Session): Promise<SyncOutcome> => {
    const userId = session.user.id;
    const running = inFlight.get(userId);
    if (running) return running;
    set({ syncing: true });
    const p = runSync(session)
      .catch((): SyncRun => {
        keepName(session);
        return { outcome: "aborted", owed: false };
      })
      .then(({ outcome, owed }) => {
        // Only while this user is still signed in: a sync that lands after a
        // sign-out must not make the next sign-in skip its own sync, and must not
        // touch the owed state or the timer of whoever is signed in now.
        if (get().session?.user.id !== userId) return outcome;
        if (outcome === "synced") {
          syncedThisLoad.add(userId);
          owedFor = null;
          clearResync();
          resyncAttempt = 0;
        } else if (owed) {
          owedFor = userId;
          scheduleResync();
        } else {
          owedFor = null;
          clearResync();
        }
        return outcome;
      })
      .finally(() => {
        inFlight.delete(userId);
        if (inFlight.size === 0) set({ syncing: false });
      });
    inFlight.set(userId, p);
    return p;
  };

  const clearResync = (): void => {
    if (resyncTimer !== undefined) clearTimeout(resyncTimer);
    resyncTimer = undefined;
  };

  /** Run the owed sync now (a pause ran out, the connection is back, the tab
   *  returned). Nothing to do when a sync is running or nothing is owed. */
  const retryOwed = (): void => {
    const session = get().session;
    if (!session || owedFor !== session.user.id || inFlight.has(session.user.id)) return;
    clearResync();
    void syncGuarded(session);
  };

  /** Arm the next pause of an owed sync. The last pause repeats while the
   *  failure lasts, so an open, idle tab still backs up once the cloud is back. */
  function scheduleResync(): void {
    clearResync();
    const delays = CLOUD_SYNC.resyncDelaysMs;
    const delay = delays[Math.min(resyncAttempt, delays.length - 1)];
    if (delay === undefined) return;
    resyncAttempt += 1;
    resyncTimer = setTimeout(() => {
      resyncTimer = undefined;
      retryOwed();
    }, delay);
  }

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
    clearResync();
    resyncAttempt = 0;
    owedFor = null;
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
    // The load's first sync belongs to INITIAL_SESSION / SIGNED_IN (and their retry),
    // unless it failed for a reason that may pass: then new progress retries it.
    if (!syncedThisLoad.has(userId)) {
      retryOwed();
      return;
    }
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
    if (userId && (syncedThisLoad.has(userId) || inFlight.has(userId) || owedFor === userId)) schedulePush();
  };

  /** Signing out: give unsynced progress one last push (bounded wait). */
  const flushBeforeSignOut = async (session: Session): Promise<void> => {
    const userId = session.user.id;
    const last = async (): Promise<void> => {
      const running = inFlight.get(userId);
      if (running) await running;
      if (!syncedThisLoad.has(userId)) return; // never synced: nothing to update
      if (lastPushed?.userId === userId && lastPushed.sig === durableSig()) return;
      clearPushTimer();
      await syncGuarded(session);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      last(),
      new Promise<void>((resolve) => (timer = setTimeout(resolve, SIGN_OUT_FLUSH_MS))),
    ]);
    clearTimeout(timer);
  };

  /** True while deleteAccount runs: its sign-out keeps the local profile. */
  let deleting = false;

  const onAuth = (session: Session | null, event: AuthChangeEvent): void => {
    // v2.0.29: the account left (sign-out here or in another tab, an expired
    // session): the device goes back to a fresh guest profile.
    const prev = get().session;
    if (prev && !session && !deleting) releaseLocalProfile(prev.user.id);
    // v2.0.29: an arriving account takes the device's saves BEFORE the session
    // is published, so nothing that reacts to the session (the career cloud
    // copy) ever reconciles another account's careers. If the profile has not
    // hydrated yet, the sync claims it once it has.
    if (session && session.user.id !== prev?.user.id && (useProfileStore.persist?.hasHydrated?.() ?? true)) {
      claimLocalProfile(session.user.id);
    }
    // 2.0 analytics: a sign-in completed in this tab (not a restored session, not
    // the SIGNED_IN Supabase re-emits on refocus: the user is already set then).
    if (event === "SIGNED_IN" && session && get().session?.user.id !== session.user.id) {
      const profile = useProfileStore.getState();
      trackEvent("account_signed_in", { hadLocalProgress: profile.runsCompleted > 0 || profile.xp > 0 });
    }
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
    needsName: false,
    initialized: false,

    setPendingEmail: (email) => set({ pendingEmail: email }),
    setNeedsName: (needs) => set({ needsName: needs }),

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
        // v2.0.25: back on the tab with a sync owed (a phone waking up): run it now.
        if (doc?.visibilityState === "visible") retryOwed();
      };
      doc?.addEventListener("visibilitychange", onVisibility);
      // v2.0.25: the connection is back: the owed sync runs at once, pauses start over.
      const win = typeof window !== "undefined" ? window : null;
      const onOnline = (): void => {
        // A connection that flaps must not restart the pauses each time: they
        // start over only when no retry is already waiting.
        if (resyncTimer === undefined) resyncAttempt = 0;
        retryOwed();
      };
      win?.addEventListener("online", onOnline);
      stopWatchers = () => {
        stopProfile();
        doc?.removeEventListener("visibilitychange", onVisibility);
        win?.removeEventListener("online", onOnline);
        clearResync();
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
      const session = get().session;
      if (session) await flushBeforeSignOut(session);
      await sbSignOut();
      // The auth listener normally released the profile already; when it did not
      // fire (no client), release it here.
      if (session && get().session?.user.id === session.user.id) releaseLocalProfile(session.user.id);
      syncedThisLoad.clear(); // as on SIGNED_OUT: the next sign-in syncs again
      resetPush();
      set({ session: null, username: null, status: "signedOut", pendingEmail: null });
    },

    deleteAccount: async () => {
      // The copy promises the local progress stays on the device: it becomes the
      // guest's (no owner) instead of being reset, and nothing is stashed.
      const userId = get().session?.user.id;
      deleting = true;
      try {
        await sbDeleteAccount();
      } finally {
        deleting = false;
      }
      if (userId) {
        writeStash(userId, null);
        dropCareerStash(userId);
        if (readOwner() === userId) writeOwner(null);
      }
      resetPush();
      set({ session: null, username: null, status: "signedOut" });
    },
  };
});

// 2.0 analytics: whether the player is signed in, for `session_started`
// (null while the stored session is still being read).
registerSessionProps(() => {
  const { status } = useAccountStore.getState();
  return { signedIn: status === "signedIn" ? true : status === "signedOut" ? false : null };
});
