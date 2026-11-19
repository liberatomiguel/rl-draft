/**
 * Cloud sync save-safety (gap2 SAVE-4/SAVE-5, NET-2/NET-3; review SAVE-1/2/4,
 * ACC-1/2). `@/lib/supabase` is mocked — no SDK, no network — and the REAL
 * profile store + merge run.
 *
 *  - a failed cloud read aborts the sync: nothing hydrated, nothing pushed;
 *  - no sync reads the local profile before the profile store has hydrated;
 *  - one sync in flight per user; the automatic sync runs once per page load per
 *    user and ignores TOKEN_REFRESHED / repeat SIGNED_IN;
 *  - progress made while the cloud read is in flight is kept, not reverted;
 *  - progress made later in the session is pushed by a debounced, change-gated
 *    push (and at once when the tab is hidden);
 *  - a signed-in player always sees a name, but never a previous user's;
 *  - the profile another tab SAVED is folded into the snapshot, never lost.
 */
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUD_SYNC } from "@/config/balance";
import type { SyncFailReason } from "@/lib/syncErrors";
import { toDurable, type DurableProfile } from "@/lib/profileSync";
import type { CloudRowResult } from "@/lib/supabase";

const sb = vi.hoisted(() => ({
  fetchCloudRow: vi.fn(),
  pushCloudProfile: vi.fn(),
  hasStoredAuthSession: vi.fn(),
  startAuth: vi.fn(),
  getSession: vi.fn(),
  onAuthChange: vi.fn(),
  onStoredAuthSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  accountsEnabled: true,
  ...sb,
}));

const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: track,
}));

import { forgetLocalProfileOwner, useAccountStore } from "./accountStore";
import { useProfileStore } from "./profileStore";

type AuthCb = (session: Session | null, event: string) => void;

let n = 0;
/** A fresh user id per test — the once-per-page-load set is module state. */
function session(): Session {
  n += 1;
  return { user: { id: `user-${n}`, email: `ace${n}@example.com` } } as unknown as Session;
}

/** Put `s` in the store as the signed-in user (what onAuth does), without syncing. */
function signedIn(s: Session): Session {
  useAccountStore.setState({ session: s, status: "signedIn" });
  return s;
}

const prefix = (s: Session) => s.user.email!.split("@")[0];

const flush = () => new Promise((r) => setTimeout(r, 0));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function cloud(
  over: Partial<DurableProfile>,
  extras: { grants?: string[]; preseasonPosition?: number | null; preseasonPositions?: Record<string, number> } = {},
): CloudRowResult {
  return {
    status: "ok",
    durable: { ...toDurable(useProfileStore.getState()), ...over },
    username: "CloudName",
    grants: extras.grants ?? [],
    preseasonPosition: extras.preseasonPosition ?? null,
    preseasonPositions: extras.preseasonPositions ?? {},
  };
}

const pushedDurable = (call: number) => sb.pushCloudProfile.mock.calls[call][2] as DurableProfile;

/** init() for a guest and hand back the auth listener the store registered. */
function initAndGetAuthCb(): AuthCb {
  useAccountStore.getState().init();
  const cb = sb.onAuthChange.mock.calls.at(-1)?.[0] as AuthCb | undefined;
  if (!cb) throw new Error("init did not register an auth listener");
  return cb;
}

/** The store's auth listener — one closure for the store's lifetime. */
let storeAuth: AuthCb;
beforeAll(() => {
  storeAuth = initAndGetAuthCb();
});

beforeEach(() => {
  // Sign the previous test's user out through the store itself: clears the module
  // state (synced-this-load set, pending debounced push, last-pushed signature).
  storeAuth(null, "SIGNED_OUT");
  forgetLocalProfileOwner(); // each test starts on a device no account owns
  for (const f of Object.values(sb)) f.mockReset();
  track.mockReset();
  sb.pushCloudProfile.mockResolvedValue({});
  sb.hasStoredAuthSession.mockReturnValue(false);
  sb.startAuth.mockResolvedValue(true);
  sb.getSession.mockResolvedValue(null);
  sb.onAuthChange.mockReturnValue(() => {});
  sb.onStoredAuthSession.mockReturnValue(() => {});
  useAccountStore.setState({
    initialized: false,
    status: "loading",
    session: null,
    username: null,
    syncing: false,
    pendingEmail: null,
  });
  useProfileStore.getState().resetAll();
});

describe("syncNow — tagged cloud read", () => {
  it("read ERROR aborts: local untouched, nothing pushed", async () => {
    useProfileStore.setState({ xp: 100 });
    sb.fetchCloudRow.mockResolvedValue({ status: "error", error: "503" });
    await useAccountStore.getState().syncNow(session());
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    expect(useProfileStore.getState().xp).toBe(100);
    expect(useAccountStore.getState().syncing).toBe(false);
  });

  it("NO-ROW pushes the local profile under the email-prefix name", async () => {
    useProfileStore.setState({ xp: 100 });
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await useAccountStore.getState().syncNow(s);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    const [userId, username, durable] = sb.pushCloudProfile.mock.calls[0];
    expect(userId).toBe(s.user.id);
    expect(username).toBe(prefix(s));
    expect((durable as DurableProfile).xp).toBe(100);
    expect(useAccountStore.getState().username).toBe(prefix(s));
  });

  it("OK merges cloud into local (never lower) and pushes the merge", async () => {
    useProfileStore.setState({ xp: 100 });
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 500 }));
    await useAccountStore.getState().syncNow(s);
    expect(useProfileStore.getState().xp).toBe(500);
    const [, username, durable] = sb.pushCloudProfile.mock.calls[0];
    expect(username).toBe("CloudName");
    expect((durable as DurableProfile).xp).toBe(500);
    expect(useAccountStore.getState().username).toBe("CloudName");
  });

  it("progress made while the read is in flight is kept (local snapshot taken after the read)", async () => {
    useProfileStore.setState({ xp: 100 });
    const read = deferred<CloudRowResult>();
    sb.fetchCloudRow.mockReturnValue(read.promise);
    const done = useAccountStore.getState().syncNow(session());
    await flush();
    useProfileStore.setState({ xp: 300 }); // a run finished meanwhile
    read.resolve(cloud({ xp: 200 }));
    await done;
    expect(useProfileStore.getState().xp).toBe(300);
    expect(pushedDurable(0).xp).toBe(300);
  });

  it("a failed push is reported as not synced (a later sign-in may retry)", async () => {
    const s = session();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "rls", reason: "denied" });
    cb(s, "INITIAL_SESSION");
    await flush();
    cb(s, "SIGNED_IN");
    await flush();
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });
});

describe("display name (a signed-in player always sees one — never a stale one)", () => {
  it("a failed PUSH still shows the cloud name the read returned", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}));
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "503" });
    await useAccountStore.getState().syncNow(s);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    expect(useAccountStore.getState().username).toBe("CloudName");
  });

  it("a failed push with no cloud row falls back to the email prefix", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValue({ error: "503" });
    await useAccountStore.getState().syncNow(s);
    expect(useAccountStore.getState().username).toBe(prefix(s));
  });

  it("v2.0.4: a new account starts with the email prefix and is asked for its name; a taken prefix falls back to prefix + digits", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await useAccountStore.getState().syncNow(s);
    expect(sb.pushCloudProfile.mock.calls[0][1]).toBe(prefix(s));
    expect(useAccountStore.getState().needsName).toBe(true);

    useAccountStore.getState().setNeedsName(false);
    const s2 = signedIn(session());
    sb.pushCloudProfile.mockReset();
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "duplicate key", reason: "conflict" }).mockResolvedValue({});
    await useAccountStore.getState().syncNow(s2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(useAccountStore.getState().username).toMatch(new RegExp(`^${prefix(s2)}[0-9]{4}$`));
    expect(useAccountStore.getState().needsName).toBe(true);
  });

  it("v2.0.4: an existing account is never asked for a name", async () => {
    useAccountStore.getState().setNeedsName(false);
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}));
    await useAccountStore.getState().syncNow(s);
    expect(useAccountStore.getState().username).toBe("CloudName");
    expect(useAccountStore.getState().needsName).toBe(false);
  });

  it("a failed READ shows the email prefix, and keeps a name already shown", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "error", error: "503" });
    await useAccountStore.getState().syncNow(s);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    expect(useAccountStore.getState().username).toBe(prefix(s));

    useAccountStore.setState({ username: "Ace" });
    await useAccountStore.getState().syncNow(s);
    expect(useAccountStore.getState().username).toBe("Ace");
  });

  it("an unexpected sync error still shows a name", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockRejectedValue(new Error("boom"));
    await useAccountStore.getState().syncNow(s);
    expect(useAccountStore.getState().username).toBe(prefix(s));
  });

  it("never resurrects a name after a sign-out mid-sync", async () => {
    const cb = initAndGetAuthCb();
    for (const outcome of ["ok", "read-error", "push-error"] as const) {
      sb.pushCloudProfile.mockReset();
      const s = session();
      const read = deferred<CloudRowResult>();
      sb.fetchCloudRow.mockReturnValueOnce(read.promise);
      sb.pushCloudProfile.mockResolvedValue(outcome === "push-error" ? { error: "503" } : {});
      cb(s, "INITIAL_SESSION");
      await flush();
      cb(null, "SIGNED_OUT");
      read.resolve(outcome === "read-error" ? { status: "error", error: "503", reason: "other" } : cloud({}));
      await flush();
      expect(useAccountStore.getState().username).toBeNull();
    }
  });

  it("a user switch never shows the previous user's name", async () => {
    const cb = initAndGetAuthCb();
    const a = session();
    const b = session();
    sb.fetchCloudRow.mockResolvedValueOnce(cloud({}));
    cb(a, "INITIAL_SESSION");
    await flush();
    expect(useAccountStore.getState().username).toBe("CloudName");
    sb.fetchCloudRow.mockResolvedValueOnce({ status: "error", error: "503" });
    cb(b, "SIGNED_IN");
    await flush();
    expect(useAccountStore.getState().username).toBe(prefix(b));
  });
});

describe("cross-tab: the profile another tab SAVED is folded in (SAVE-2)", () => {
  const store = useProfileStore as unknown as { persist?: unknown };
  const VERSION = 11;
  let original: unknown;

  beforeEach(() => {
    original = store.persist;
  });
  afterEach(() => {
    store.persist = original;
  });

  /** Stand-in persist API whose storage holds what another tab saved. */
  function storageReturns(getItem: () => unknown) {
    store.persist = {
      hasHydrated: () => true,
      onFinishHydration: () => () => {},
      getOptions: () => ({
        name: "rocket-draft:profile:v1",
        version: VERSION,
        storage: { getItem, setItem: () => {}, removeItem: () => {} },
      }),
    };
  }

  it("keeps the newer SAVED progress and this tab's own, then pushes both", async () => {
    useProfileStore.setState({ xp: 100, runsCompleted: 2, gamesWon: 5 }); // stale tab's memory
    const saved = { ...toDurable(useProfileStore.getState()), xp: 900, runsCompleted: 7, gamesWon: 0 };
    storageReturns(() => ({ state: saved, version: VERSION }));
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await useAccountStore.getState().syncNow(s);
    const pushed = pushedDurable(0);
    expect(pushed.xp).toBe(900); // the other tab's progress
    expect(pushed.runsCompleted).toBe(7);
    expect(pushed.gamesWon).toBe(5); // memory-only progress — never replaced by storage
    const mem = useProfileStore.getState();
    expect([mem.xp, mem.runsCompleted, mem.gamesWon]).toEqual([900, 7, 5]);
  });

  it("folds storage AND the cloud row (max of all three)", async () => {
    useProfileStore.setState({ xp: 100, gamesWon: 5 });
    const saved = { ...toDurable(useProfileStore.getState()), xp: 900 };
    storageReturns(() => ({ state: saved, version: VERSION }));
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 400, runsCompleted: 9 }));
    await useAccountStore.getState().syncNow(s);
    const pushed = pushedDurable(0);
    expect([pushed.xp, pushed.runsCompleted, pushed.gamesWon]).toEqual([900, 9, 5]);
  });

  it("ignores another schema version, unreadable, async or malformed storage", async () => {
    const newer = () => ({ ...toDurable(useProfileStore.getState()), xp: 900 });
    const cases: (() => unknown)[] = [
      () => ({ state: newer(), version: VERSION - 1 }),
      () => ({ state: newer(), version: VERSION + 1 }),
      () => {
        throw new Error("SecurityError: storage blocked");
      },
      () => Promise.resolve({ state: newer(), version: VERSION }),
      () => ({ state: "garbage", version: VERSION }),
      () => ({ state: { ...newer(), runHistory: "nope" }, version: VERSION }),
      () => null,
    ];
    useProfileStore.setState({ xp: 100 });
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    for (const [i, getItem] of cases.entries()) {
      storageReturns(getItem);
      forgetLocalProfileOwner(); // each case is a device no account owns yet
      await useAccountStore.getState().syncNow(signedIn(session()));
      expect(pushedDurable(i).xp).toBe(100);
      expect(useProfileStore.getState().xp).toBe(100);
    }
  });
});

describe("hydration gate", () => {
  it("does not read local (or the cloud) until the profile store has hydrated", async () => {
    const listeners: (() => void)[] = [];
    const store = useProfileStore as unknown as { persist?: unknown };
    const original = store.persist;
    store.persist = {
      hasHydrated: () => false,
      onFinishHydration: (fn: () => void) => {
        listeners.push(fn);
        return () => {};
      },
    };
    try {
      sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
      const done = useAccountStore.getState().syncNow(session());
      await flush();
      expect(sb.fetchCloudRow).not.toHaveBeenCalled();
      expect(sb.pushCloudProfile).not.toHaveBeenCalled();
      listeners.forEach((fn) => fn()); // hydration finished
      await done;
      expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
      expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    } finally {
      store.persist = original;
    }
  });
});

describe("in-flight + once-per-page-load guards", () => {
  it("concurrent syncs for the same user share one read/push", async () => {
    const s = session();
    const read = deferred<CloudRowResult>();
    sb.fetchCloudRow.mockReturnValue(read.promise);
    const a = useAccountStore.getState().syncNow(s);
    const b = useAccountStore.getState().syncNow(s);
    await flush();
    read.resolve({ status: "no-row" });
    await Promise.all([a, b]);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("INITIAL_SESSION syncs once; repeat SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED don't", async () => {
    const s = session();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    cb(s, "INITIAL_SESSION");
    cb(s, "SIGNED_IN"); // arrives while the first sync is still in flight
    await flush();
    cb(s, "SIGNED_IN"); // tab refocus
    cb(s, "TOKEN_REFRESHED");
    cb(s, "USER_UPDATED");
    await flush();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    expect(useAccountStore.getState().status).toBe("signedIn");
  });

  it("TOKEN_REFRESHED never starts a sync, even if none ran yet", async () => {
    const cb = initAndGetAuthCb();
    cb(session(), "TOKEN_REFRESHED");
    await flush();
    expect(sb.fetchCloudRow).not.toHaveBeenCalled();
  });

  it("a sync aborted by a read error is retried by a later SIGNED_IN", async () => {
    const s = session();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValueOnce({ status: "error", error: "timeout" });
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    cb(s, "INITIAL_SESSION");
    await flush();
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    cb(s, "TOKEN_REFRESHED");
    await flush();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    cb(s, "SIGNED_IN");
    await flush();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("sign out then sign in again syncs again", async () => {
    const s = session();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    cb(s, "SIGNED_IN");
    await flush();
    cb(null, "SIGNED_OUT");
    expect(useAccountStore.getState().status).toBe("signedOut");
    expect(useAccountStore.getState().username).toBeNull();
    cb(s, "SIGNED_IN");
    await flush();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
  });

  it("a sync that lands after a sign-out doesn't make the next sign-in skip its sync", async () => {
    const s = session();
    const cb = initAndGetAuthCb();
    const read = deferred<CloudRowResult>();
    sb.fetchCloudRow.mockReturnValueOnce(read.promise);
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    cb(s, "INITIAL_SESSION");
    await flush();
    cb(null, "SIGNED_OUT");
    read.resolve({ status: "no-row" });
    await flush(); // the old sync completes while signed out
    cb(s, "SIGNED_IN");
    await flush();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
  });
});

describe("debounced mid-session push (SAVE-1 / ACC-1)", () => {
  const D = CLOUD_SYNC.pushDebounceMs;
  /** Advance fake time, then let every (instant, mocked) promise chain settle. */
  const tick = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    storeAuth(null, "SIGNED_OUT"); // cancels any pending push
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Sign `s` in through the store's listener and let the load's sync finish. */
  async function signInAndSync(s: Session): Promise<AuthCb> {
    const cb = initAndGetAuthCb();
    cb(s, "INITIAL_SESSION");
    await tick();
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    return cb;
  }

  it("a profile change after the load's sync is pushed once, after the debounce", async () => {
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await signInAndSync(session());
    useProfileStore.setState({ xp: 250 }); // a run finished…
    useProfileStore.setState({ runsCompleted: 1 }); // …same burst: coalesced
    await tick(D - 1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2); // full guarded sync: read, then push
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(pushedDurable(1).xp).toBe(250);
    expect(pushedDurable(1).runsCompleted).toBe(1);
    await tick(D * 3);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });

  it("no push when nothing durable changed — including each sync's own hydrate", async () => {
    useProfileStore.setState({ xp: 100 });
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 500 }));
    await signInAndSync(session()); // hydrates xp 500 from the cloud
    expect(useProfileStore.getState().xp).toBe(500);
    await tick(D * 3);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);

    useProfileStore.setState({ xp: 500 }); // a write that changes nothing durable
    await tick(D * 2);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);

    // A real change whose sync hydrates even newer cloud progress (another device):
    // that hydrate must not schedule yet another push.
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 800 }));
    useProfileStore.setState({ xp: 600 });
    await tick(D);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(useProfileStore.getState().xp).toBe(800);
    await tick(D * 3);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });

  it("a failing push is not retried in a loop by its own hydrate", async () => {
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await signInAndSync(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 800 })); // the retry's sync hydrates
    sb.pushCloudProfile.mockResolvedValue({ error: "503" }); // …and its push fails
    useProfileStore.setState({ xp: 600 });
    await tick(D);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    await tick(D * 5);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2); // no outage request storm
    sb.pushCloudProfile.mockResolvedValue({});
    useProfileStore.setState({ xp: 900 }); // the next real change retries
    await tick(D);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(3);
    expect(pushedDurable(2).xp).toBe(900);
  });

  it("progress made while a push is in flight still counts as unsynced", async () => {
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    const push = deferred<{ error?: string }>();
    sb.pushCloudProfile.mockReturnValueOnce(push.promise);
    const cb = initAndGetAuthCb();
    cb(session(), "INITIAL_SESSION");
    await tick();
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1); // in flight
    useProfileStore.setState({ xp: 300 }); // a run finished during the push
    await tick(D); // the debounce fires while the sync is still in flight → waits for it
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    push.resolve({});
    await tick();
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    await tick(D);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(pushedDurable(1).xp).toBe(300);
  });

  it("no push for a guest, nor before the load's first successful sync", async () => {
    initAndGetAuthCb();
    useProfileStore.setState({ xp: 10 }); // guest progress
    await tick(D * 2);
    expect(sb.fetchCloudRow).not.toHaveBeenCalled();

    sb.fetchCloudRow.mockResolvedValueOnce({ status: "error", error: "503" });
    const cb = initAndGetAuthCb();
    cb(session(), "INITIAL_SESSION"); // the load's sync aborts on the read error
    await tick();
    useProfileStore.setState({ xp: 20 });
    await tick(D * 2);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1); // retry is SIGNED_IN's job
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
  });

  it("signing out cancels a pending push", async () => {
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    const cb = await signInAndSync(session());
    useProfileStore.setState({ xp: 50 }); // push pending
    cb(null, "SIGNED_OUT");
    useProfileStore.setState({ xp: 60 }); // guest progress
    await tick(D * 2);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("refocus SIGNED_IN / TOKEN_REFRESHED still don't sync; only the change does", async () => {
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    const s = session();
    const cb = await signInAndSync(s);
    useProfileStore.setState({ xp: 70 });
    cb(s, "SIGNED_IN");
    cb(s, "TOKEN_REFRESHED");
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    await tick(D);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });

  it("hiding the tab sends a pending push at once; nothing pending → no request", async () => {
    const handlers = new Map<string, () => void>();
    const doc = {
      visibilityState: "visible",
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: () => {},
    };
    vi.stubGlobal("document", doc);
    const hide = () => {
      doc.visibilityState = "hidden";
      handlers.get("visibilitychange")?.();
      doc.visibilityState = "visible";
    };
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await signInAndSync(session());
    expect(handlers.has("visibilitychange")).toBe(true);

    hide(); // nothing pending
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);

    useProfileStore.setState({ xp: 90 });
    hide();
    await tick();
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(pushedDurable(1).xp).toBe(90);
    await tick(D * 2); // the debounce was consumed by the flush
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });
});

describe("init — lazy Supabase", () => {
  it("guest (no stored session): signedOut at once, SDK not started, auth listener registered", () => {
    sb.hasStoredAuthSession.mockReturnValue(false);
    useAccountStore.getState().init();
    expect(useAccountStore.getState().status).toBe("signedOut");
    expect(sb.startAuth).not.toHaveBeenCalled();
    expect(sb.onAuthChange).toHaveBeenCalledTimes(1);
    expect(sb.onStoredAuthSession).toHaveBeenCalledTimes(1);
  });

  it("returning signed-in player: starts auth and syncs once from the stored session", async () => {
    const s = session();
    sb.hasStoredAuthSession.mockReturnValue(true);
    sb.getSession.mockResolvedValue(s);
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    const cb = initAndGetAuthCb();
    expect(sb.startAuth).toHaveBeenCalledTimes(1);
    cb(s, "INITIAL_SESSION"); // the SDK's own initial event, alongside getSession()
    await flush();
    expect(useAccountStore.getState().status).toBe("signedIn");
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
  });

  it("SDK download failure leaves a usable signed-out state (no endless loading)", async () => {
    sb.hasStoredAuthSession.mockReturnValue(true);
    sb.startAuth.mockResolvedValue(false);
    useAccountStore.getState().init();
    await flush();
    expect(useAccountStore.getState().status).toBe("signedOut");
    expect(sb.fetchCloudRow).not.toHaveBeenCalled();
  });

  it("a sign-in completed in another tab starts auth here", () => {
    useAccountStore.getState().init();
    const onStored = sb.onStoredAuthSession.mock.calls[0][0] as () => void;
    expect(sb.startAuth).not.toHaveBeenCalled();
    onStored();
    expect(sb.startAuth).toHaveBeenCalledTimes(1);
  });

  it("init is mount-once", () => {
    useAccountStore.getState().init();
    useAccountStore.getState().init();
    expect(sb.onAuthChange).toHaveBeenCalledTimes(1);
  });
});

describe("Season 1 cutover: a pre-season account signs in (rc.54)", () => {
  /** The cloud row a v1.4.8 client left behind: no season block, pre-season totals. */
  const preseasonRow = (extras: Parameters<typeof cloud>[1]) => {
    const row = cloud(
      { xp: 70_000, mmr: 2100, runsCompleted: 300, wins: { easy: 5, normal: 20, hard: 40, legacy: 60 } },
      extras,
    );
    if (row.status !== "ok" || !row.durable) throw new Error("fixture");
    const durable = { ...row.durable } as Partial<DurableProfile>;
    delete durable.season;
    delete durable.lifetime;
    delete durable.legacy;
    delete durable.cosmetics;
    return { ...row, durable: durable as DurableProfile };
  };

  it("clean device: reset to Season 1, peak rank archived, every frozen board pays its band", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(
      preseasonRow({ preseasonPosition: 10, preseasonPositions: { mmr: 10, championships: 3, titles_legacy: 140 } }),
    );
    await useAccountStore.getState().syncNow(s);

    const profile = useProfileStore.getState();
    expect(profile.xp).toBe(0);
    expect(profile.mmr).toBe(400);
    expect(profile.lifetime.xp).toBe(70_000);
    expect(profile.legacy.preseason).toMatchObject({
      xp: 70_000,
      mmr: 2100,
      rankId: "supersonic-legend",
      titles: 125,
      position: 10,
      positions: { mmr: 10, championships: 3, titles_legacy: 140 },
    });
    const owned = Object.keys(profile.cosmetics.owned);
    // Rank: the peak only. Boards: Elite (#10 rating) and Third (#3 titles); #140 pays nothing.
    expect(owned).toEqual(
      expect.arrayContaining([
        "first-chapter",
        "pre-season-supersonic",
        "legacy-title-ps-supersonic-legend",
        "season-elite-ps",
        "season-third-place-ps",
      ]),
    );
    expect(owned).not.toContain("pre-season-grand-champion");
    expect(owned).not.toContain("season-finalist-ps");
    expect(owned).not.toContain("season-champion-ps");

    // What goes back to the cloud is a Season 1 profile that still carries the archive.
    const pushed = pushedDurable(0);
    expect(pushed.xp).toBe(0);
    expect(pushed.legacy?.preseason?.positions).toEqual({ mmr: 10, championships: 3, titles_legacy: 140 });
  });

  it("the cloud's frozen places replace an earlier copy (a board frozen again before launch)", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(preseasonRow({ preseasonPosition: 4, preseasonPositions: { mmr: 4 } }));
    await useAccountStore.getState().syncNow(s);
    expect(Object.keys(useProfileStore.getState().cosmetics.owned)).toContain("season-elite-ps");

    sb.fetchCloudRow.mockResolvedValue(cloud({}, { preseasonPosition: 2, preseasonPositions: { mmr: 2, titles_legacy: 30 } }));
    await useAccountStore.getState().syncNow(s);
    expect(useProfileStore.getState().legacy.preseason?.positions).toEqual({ mmr: 2, titles_legacy: 30 });
    expect(useProfileStore.getState().legacy.preseason?.position).toBe(2);
  });

  it("a row frozen before the player ever finished a run earns nothing", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}, { preseasonPosition: null, preseasonPositions: {} }));
    await useAccountStore.getState().syncNow(s);
    expect(useProfileStore.getState().legacy.preseason).toBeNull();
    expect(Object.keys(useProfileStore.getState().cosmetics.owned).filter((id) => id.includes("ps"))).toEqual([]);
  });
});

describe("2.0.0: what a sync brings is announced by the normal unlock pop-up", () => {
  it("a manual grant read from the cloud is queued once, and nothing is equipped", async () => {
    const { useCosmeticUnlocks } = await import("./cosmeticUnlockStore");
    useCosmeticUnlocks.getState().clear();
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}, { grants: ["creator", "supporter"] }));
    await useAccountStore.getState().syncNow(s);
    const queue = useCosmeticUnlocks.getState().queue;
    expect(queue).toEqual(expect.arrayContaining(["creator", "grant-title-creator", "supporter", "grant-title-supporter"]));
    const equipped = useProfileStore.getState().cosmetics.equipped;
    expect(equipped.title ?? null).toBeNull();
    expect(equipped.banner ?? null).toBeNull();

    // The same sync again brings nothing new: no second pop-up.
    useCosmeticUnlocks.getState().clear();
    await useAccountStore.getState().syncNow(s);
    expect(useCosmeticUnlocks.getState().queue).toEqual([]);
  });

  it("v2.0.17: the Verified grant queues its pop-up until it is dismissed, then never again", async () => {
    const { useCosmeticUnlocks } = await import("./cosmeticUnlockStore");
    useCosmeticUnlocks.getState().clear();
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}, { grants: ["verified"] }));
    await useAccountStore.getState().syncNow(s);
    expect(useProfileStore.getState().grants).toContain("verified");
    expect(useCosmeticUnlocks.getState().queue).toEqual(["verified"]);
    // Not a cosmetic: nothing owned, nothing equipped.
    expect(useProfileStore.getState().cosmetics.owned.verified).toBeUndefined();

    // Not dismissed yet (closed tab): the next sync offers it again.
    useCosmeticUnlocks.getState().clear();
    await useAccountStore.getState().syncNow(s);
    expect(useCosmeticUnlocks.getState().queue).toEqual(["verified"]);

    // Dismissed: recorded in the synced `announced` list, and never queued again.
    useCosmeticUnlocks.getState().clear();
    useProfileStore.getState().markVerifiedAnnounced();
    expect(useProfileStore.getState().cosmetics.announced).toContain("verified");
    await useAccountStore.getState().syncNow(s);
    expect(useCosmeticUnlocks.getState().queue).toEqual([]);
    const pushed = sb.pushCloudProfile.mock.calls.at(-1)?.[2] as DurableProfile | undefined;
    expect(pushed?.cosmetics?.announced).toContain("verified");
  });

  it("pre-season rewards wait for the recap; once it was seen, a late sign-in announces them", async () => {
    const { useCosmeticUnlocks } = await import("./cosmeticUnlockStore");
    useCosmeticUnlocks.getState().clear();
    const preseason = { xp: 70_000, mmr: 2100, rankId: "supersonic-legend", runsCompleted: 300, titles: 125, challengesCleared: 0, snapshotAt: "2026-11-12T13:00:00.000Z", position: null };
    useProfileStore.setState({ legacy: { preseason } });
    useProfileStore.getState().refreshCosmetics();
    useCosmeticUnlocks.getState().clear();
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(cloud({}, { preseasonPosition: 3, preseasonPositions: { mmr: 3 } }));
    await useAccountStore.getState().syncNow(s);
    expect(useCosmeticUnlocks.getState().queue).toEqual([]); // the recap will show it

    useProfileStore.getState().resetAll();
    useProfileStore.setState({ legacy: { preseason }, flags: { ...useProfileStore.getState().flags, seenSeasonRecap: true } });
    useProfileStore.getState().refreshCosmetics();
    useCosmeticUnlocks.getState().clear();
    forgetLocalProfileOwner(); // a guest on another device signs in
    const s2 = signedIn(session());
    await useAccountStore.getState().syncNow(s2);
    expect(useCosmeticUnlocks.getState().queue).toEqual(expect.arrayContaining(["season-third-place-ps", "legacy-title-ps-board-3"]));
  });
});


describe("v2.0.25: named failures, retries and the owed sync", () => {
  const RETRY = CLOUD_SYNC.retryDelaysMs;
  const RESYNC = CLOUD_SYNC.resyncDelaysMs;
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
  const retrySum = sum(RETRY);
  const resyncSum = sum(RESYNC);
  const tick = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(0);
  };
  const fail = (reason: SyncFailReason, code?: string) => ({
    status: "error" as const,
    error: "boom",
    reason,
    ...(code ? { code } : {}),
  });
  const failedEvents = () => track.mock.calls.filter((c) => c[0] === "account_sync_failed");

  /** Run one sync to the end, advancing through every in-sync pause. */
  async function syncThrough(s: Session): Promise<void> {
    const done = useAccountStore.getState().syncNow(s);
    await tick(retrySum);
    await done;
  }

  /** Stand-ins for the browser: handlers by event type, as init() registers them. */
  function stubBrowser() {
    const doc = {
      visibilityState: "visible",
      handlers: new Map<string, () => void>(),
      addEventListener(type: string, fn: () => void) {
        this.handlers.set(type, fn);
      },
      removeEventListener() {},
    };
    const win = {
      handlers: new Map<string, () => void>(),
      addEventListener(type: string, fn: () => void) {
        this.handlers.set(type, fn);
      },
      removeEventListener() {},
    };
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
    return { doc, win };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    // Sign out through the store: clears syncOwed, the resync timer and its attempt count.
    storeAuth(null, "SIGNED_OUT");
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a transient read failure is retried inside the same sync: no event, the push happens", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValueOnce(fail("network")).mockResolvedValue({ status: "no-row" });
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    expect(failedEvents()).toEqual([]);
  });

  it("a denied read is not retried: no push, the event names stage and reason", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(fail("denied"));
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    expect(failedEvents()).toEqual([
      ["account_sync_failed", { actionId: "sync_failed:read:denied", stage: "read", reason: "denied" }],
    ]);
  });

  it("a read that keeps failing is tried 1 + retryDelaysMs.length times, then reported", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(fail("network"));
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    expect(failedEvents()).toHaveLength(1);
    expect(failedEvents()[0][1]).toMatchObject({ stage: "read", reason: "network" });
  });

  it("a failure without a reason counts as other and is not retried", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "error", error: "503" });
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(failedEvents()[0][1]).toMatchObject({ actionId: "sync_failed:read:other", reason: "other" });
  });

  it("the database code goes on the event only when there is one", async () => {
    sb.fetchCloudRow.mockResolvedValue(fail("auth", "PGRST301"));
    await syncThrough(signedIn(session()));
    expect(failedEvents()[0][1]).toMatchObject({ reason: "auth", code: "PGRST301" });

    track.mockReset();
    sb.fetchCloudRow.mockResolvedValue(fail("denied"));
    await syncThrough(signedIn(session()));
    expect(failedEvents()).toHaveLength(1);
    expect(Object.keys(failedEvents()[0][1] as object)).not.toContain("code");
  });

  it("a new account whose first push fails with network never takes the fallback name", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValue({ error: "boom", reason: "network" });
    await syncThrough(s);
    await tick(RESYNC[0] + retrySum); // and again in the owed sync
    expect(sb.pushCloudProfile.mock.calls.length).toBeGreaterThan(1);
    for (const call of sb.pushCloudProfile.mock.calls) expect(call[1]).toBe(prefix(s));
    expect(failedEvents()[0][1]).toMatchObject({ actionId: "sync_failed:push:network", stage: "push" });
    expect(useAccountStore.getState().username).toBe(prefix(s));
  });

  it("a push failing with network is called once within the sync: no in-sync push retry", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValue({ error: "boom", reason: "network" });
    await syncThrough(s);
    expect(retrySum).toBeLessThan(RESYNC[0]);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("a new account whose name is refused (conflict) takes prefix + 4 digits on the second push", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "dup", reason: "conflict", code: "23505" }).mockResolvedValue({});
    await syncThrough(s);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile.mock.calls[0][1]).toBe(prefix(s));
    expect(sb.pushCloudProfile.mock.calls[1][1]).toMatch(new RegExp(`^${prefix(s)}[0-9]{4}$`));
    expect(failedEvents()).toEqual([]);
  });

  it("a failed push is a whole new sync later (re-read + push), with the same name, and then nothing is owed", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "boom", reason: "network" }).mockResolvedValue({});
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    expect(failedEvents()).toHaveLength(1);
    expect(failedEvents()[0][1]).toMatchObject({ actionId: "sync_failed:push:network", stage: "push", reason: "network" });

    await tick(RESYNC[0]);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2); // the retry re-reads the cloud
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile.mock.calls[0][1]).toBe(prefix(s));
    expect(sb.pushCloudProfile.mock.calls[1][1]).toBe(prefix(s));
    expect(failedEvents()).toHaveLength(1);

    await tick(resyncSum * 3);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(2);
  });

  it("a read failing with auth is not retried inside the sync, but it is owed", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValueOnce(fail("auth")).mockResolvedValue({ status: "no-row" });
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
    expect(failedEvents()[0][1]).toMatchObject({ actionId: "sync_failed:read:auth", reason: "auth" });
    await tick(RESYNC[0]);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("a rate-limited read is owed but not retried inside the sync", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValueOnce(fail("rate")).mockResolvedValue({ status: "no-row" });
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    await tick(RESYNC[0]);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("an owed sync runs again after the first resync pause, and once it works nothing else fires", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValueOnce(fail("network")).mockResolvedValueOnce(fail("network")).mockResolvedValueOnce(fail("network"));
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await syncThrough(s);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();

    await tick(RESYNC[0] - 1);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length);
    await tick(1);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2 + RETRY.length);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);

    await tick(resyncSum * 2);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2 + RETRY.length);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("an owed sync walks the pause list; the last pause repeats while the failure lasts; success stops it", async () => {
    const s = signedIn(session());
    sb.fetchCloudRow.mockResolvedValue(fail("server"));
    await syncThrough(s);
    const perSync = 1 + RETRY.length;
    const last = RESYNC[RESYNC.length - 1];
    // Every listed pause, then the last one twice more.
    const pauses = [...RESYNC, last, last];
    for (const [i, pause] of pauses.entries()) {
      expect(sb.fetchCloudRow).toHaveBeenCalledTimes(perSync * (i + 1));
      await tick(pause - 1); // not yet
      expect(sb.fetchCloudRow).toHaveBeenCalledTimes(perSync * (i + 1));
      await tick(1 + retrySum);
    }
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(perSync * (pauses.length + 1));
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();

    // The cloud is back: the next repeat goes through, and then no timer fires a sync.
    sb.fetchCloudRow.mockClear();
    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    await tick(last);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    await tick(last * 5);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  describe("a late sync of a user who signed out touches nothing of the user signed in now", () => {
    async function switchUsers(lateResult: "fail" | "ok") {
      const cb = initAndGetAuthCb();
      const a = session();
      const b = session();
      const held = deferred<CloudRowResult>();
      let aReads = 0;
      sb.fetchCloudRow.mockImplementation((id: string) => {
        if (id === a.user.id) return ++aReads === 1 ? held.promise : Promise.resolve(fail("network"));
        return Promise.resolve(fail("network")); // B is owed
      });
      cb(a, "INITIAL_SESSION");
      await tick();
      cb(null, "SIGNED_OUT");
      cb(b, "SIGNED_IN");
      await tick(retrySum); // B's sync fails through its in-sync retries and is owed
      const reads = (u: Session) => sb.fetchCloudRow.mock.calls.filter((c) => c[0] === u.user.id).length;
      expect(reads(b)).toBe(1 + RETRY.length);

      held.resolve(lateResult === "ok" ? cloud({}) : (fail("network") as CloudRowResult));
      await tick(retrySum); // A's late sync finishes (still before B's pause ends)
      expect(reads(b)).toBe(1 + RETRY.length);

      sb.fetchCloudRow.mockImplementation(() => Promise.resolve({ status: "no-row" }));
      await tick(RESYNC[0] - retrySum);
      expect(reads(b)).toBe(2 + RETRY.length); // B's owed sync ran
      const pushesFor = (u: Session) => sb.pushCloudProfile.mock.calls.filter((c) => c[0] === u.user.id).length;
      expect(pushesFor(b)).toBe(1);
      return { pushesFor, a };
    }

    it("A's late sync FAILS: B's owed retry still runs", async () => {
      const { pushesFor, a } = await switchUsers("fail");
      expect(pushesFor(a)).toBe(0);
    });

    it("A's late sync SUCCEEDS: B's owed retry still runs", async () => {
      await switchUsers("ok");
    });
  });

  it("an owed sync runs at once when the connection comes back", async () => {
    const { win } = stubBrowser();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue(fail("network"));
    cb(session(), "INITIAL_SESSION");
    await tick(retrySum);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length);

    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    win.handlers.get("online")?.(); // what window.dispatchEvent(new Event("online")) runs
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2 + RETRY.length);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
    await tick(resyncSum * 2);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2 + RETRY.length);
  });

  it("an owed sync runs at once when the tab becomes visible", async () => {
    const { doc } = stubBrowser();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue(fail("server"));
    cb(session(), "INITIAL_SESSION");
    await tick(retrySum);
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length);

    sb.fetchCloudRow.mockResolvedValue({ status: "no-row" });
    doc.visibilityState = "hidden";
    doc.handlers.get("visibilitychange")?.();
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1 + RETRY.length); // hiding does not retry
    doc.visibilityState = "visible";
    doc.handlers.get("visibilitychange")?.();
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(2 + RETRY.length);
    expect(sb.pushCloudProfile).toHaveBeenCalledTimes(1);
  });

  it("a denied failure is not owed: no pause, online or tab return runs another sync", async () => {
    const { doc, win } = stubBrowser();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue(fail("denied"));
    cb(session(), "INITIAL_SESSION");
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
    await tick(resyncSum * 2);
    win.handlers.get("online")?.();
    doc.handlers.get("visibilitychange")?.();
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(1);
  });

  it("signing out clears an owed sync", async () => {
    const { win } = stubBrowser();
    const cb = initAndGetAuthCb();
    sb.fetchCloudRow.mockResolvedValue(fail("network"));
    cb(session(), "INITIAL_SESSION");
    await tick(retrySum);
    const reads = sb.fetchCloudRow.mock.calls.length;
    expect(reads).toBe(1 + RETRY.length);

    await useAccountStore.getState().signOut();
    await tick(resyncSum * 2);
    win.handlers.get("online")?.();
    await tick();
    expect(sb.fetchCloudRow).toHaveBeenCalledTimes(reads);
  });
});

describe("v2.0.29: one device, several accounts — the local profile is one account's", () => {
  /** Sign `s` in through the auth listener and let its sync land. */
  async function signInAs(s: Session, row: CloudRowResult): Promise<void> {
    sb.fetchCloudRow.mockResolvedValueOnce(row);
    storeAuth(s, "SIGNED_IN");
    await flush();
    await flush();
  }

  it("guest progress still comes along on the first sign-in", async () => {
    useProfileStore.setState({ xp: 120 });
    const a = session();
    await signInAs(a, { status: "no-row" });
    expect(pushedDurable(0).xp).toBe(120);
    expect(useProfileStore.getState().xp).toBe(120);
  });

  it("signing out resets the device to a fresh guest", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900, grants: ["staff"] }, { grants: ["staff"] }));
    expect(useProfileStore.getState().xp).toBe(900);
    await useAccountStore.getState().signOut();
    expect(useAccountStore.getState().status).toBe("signedOut");
    expect(useProfileStore.getState().xp).toBe(0);
    expect(useProfileStore.getState().grants ?? []).toEqual([]);
  });

  it("the listener's SIGNED_OUT (another tab, an expired session) resets too", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900 }));
    storeAuth(null, "SIGNED_OUT");
    expect(useProfileStore.getState().xp).toBe(0);
  });

  it("the next account never inherits the previous one's progress or grants", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900, grants: ["staff"] }, { grants: ["staff"] }));
    await useAccountStore.getState().signOut();
    sb.pushCloudProfile.mockClear();
    const b = session();
    await signInAs(b, { status: "no-row" });
    expect(pushedDurable(0).xp).toBe(0);
    expect(pushedDurable(0).grants ?? []).toEqual([]);
    expect(useProfileStore.getState().xp).toBe(0);
  });

  it("a sign-in as another account without a sign-out starts clean too", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900, grants: ["staff"] }, { grants: ["staff"] }));
    sb.pushCloudProfile.mockClear();
    const b = session();
    await signInAs(b, { status: "no-row" });
    expect(pushedDurable(0).xp).toBe(0);
    expect(pushedDurable(0).grants ?? []).toEqual([]);
  });

  it("progress the last push missed is folded back in at the account's next sign-in", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900 }));
    useProfileStore.setState({ xp: 950 }); // unsynced
    sb.fetchCloudRow.mockResolvedValue({ status: "error", error: "offline" }); // the last push cannot run
    await useAccountStore.getState().signOut();
    expect(useProfileStore.getState().xp).toBe(0);
    sb.fetchCloudRow.mockReset();
    sb.pushCloudProfile.mockClear();
    await signInAs(a, cloud({ xp: 900 })); // the cloud never got the 950
    expect(useProfileStore.getState().xp).toBe(950);
    expect(pushedDurable(0).xp).toBe(950);
  });

  it("signing out pushes unsynced progress first", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900 }));
    useProfileStore.setState({ xp: 950 });
    sb.pushCloudProfile.mockClear();
    sb.fetchCloudRow.mockResolvedValue(cloud({ xp: 900 }));
    await useAccountStore.getState().signOut();
    expect(pushedDurable(0).xp).toBe(950);
    expect(useProfileStore.getState().xp).toBe(0);
  });

  it("a sync whose account signed out mid-read writes nothing into the guest", async () => {
    const a = session();
    const read = deferred<CloudRowResult>();
    sb.fetchCloudRow.mockReturnValueOnce(read.promise);
    storeAuth(a, "SIGNED_IN");
    await flush();
    storeAuth(null, "SIGNED_OUT");
    read.resolve(cloud({ xp: 900 }));
    await flush();
    await flush();
    expect(useProfileStore.getState().xp).toBe(0);
    expect(sb.pushCloudProfile).not.toHaveBeenCalled();
  });

  it("deleting the account keeps the local progress as the guest's", async () => {
    const a = session();
    await signInAs(a, cloud({ xp: 900 }));
    await useAccountStore.getState().deleteAccount();
    expect(useProfileStore.getState().xp).toBe(900);
    sb.pushCloudProfile.mockClear();
    await signInAs(session(), { status: "no-row" }); // a new account adopts it, as a guest's
    expect(pushedDurable(0).xp).toBe(900);
  });
});
