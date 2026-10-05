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
}));

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  accountsEnabled: true,
  ...sb,
}));

import { useAccountStore } from "./accountStore";
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

function cloud(over: Partial<DurableProfile>): CloudRowResult {
  return {
    status: "ok",
    durable: { ...toDurable(useProfileStore.getState()), ...over },
    username: "CloudName",
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
  for (const f of Object.values(sb)) f.mockReset();
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
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "rls" });
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
    sb.pushCloudProfile.mockResolvedValueOnce({ error: "503" });
    await useAccountStore.getState().syncNow(s);
    expect(useAccountStore.getState().username).toBe(prefix(s));
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
      read.resolve(outcome === "read-error" ? { status: "error", error: "503" } : cloud({}));
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
