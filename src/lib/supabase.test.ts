/**
 * Lazy Supabase client wrapper — tagged cloud reads, lazy client creation and
 * the startup session probe. `@supabase/supabase-js` is mocked: no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sb = typeof import("./supabase");
type AuthCb = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  getSession: vi.fn(),
  setHeader: vi.fn(),
  listRows: vi.fn(),
  rpc: vi.fn(),
  del: vi.fn(),
  delEq: vi.fn(),
  authCbs: [] as ((event: string, session: unknown) => void)[],
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: h.createClient }));

function fakeClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          setHeader: (name: string, value: string) => {
            h.setHeader("read", name, value);
            // The real builder is a thenable: awaiting it sends the request.
            return {
              maybeSingle: h.maybeSingle,
              then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(h.listRows()).then(ok, bad),
            };
          },
        }),
      }),
      delete: () => {
        const eqs: unknown[][] = [];
        const selects: unknown[][] = [];
        const chain = {
          eq: (...a: unknown[]) => {
            eqs.push(a);
            return chain;
          },
          select: (...a: unknown[]) => {
            selects.push(a);
            return chain;
          },
          setHeader: (name: string, value: string) => {
            h.setHeader("delete", name, value);
            h.delEq(eqs, selects);
            return Promise.resolve(h.del());
          },
        };
        return chain;
      },
      upsert: (...args: unknown[]) => ({
        // The real builder sends on await: the request leaves only once the header is set.
        setHeader: (name: string, value: string) => {
          h.setHeader("push", name, value);
          return h.upsert(...args);
        },
      }),
    }),
    rpc: (name: string, args: Record<string, unknown>) => ({
      setHeader: (header: string, value: string) => {
        h.setHeader("rpc", header, value);
        return Promise.resolve(h.rpc(name, args));
      },
    }),
    auth: {
      getSession: h.getSession,
      onAuthStateChange: (cb: AuthCb) => {
        h.authCbs.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
}

const URL_ENV = "https://abcdref.supabase.co";

/** What `auth.getSession()` answers for a signed-in user. */
const sessionOf = (userId: string) => ({
  data: { session: { user: { id: userId }, access_token: `tok-${userId}` } },
  error: null,
});

async function load(enabled = true): Promise<Sb> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", enabled ? URL_ENV : "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", enabled ? "anon-key" : "");
  return import("./supabase");
}

beforeEach(() => {
  h.createClient.mockReset().mockImplementation(() => fakeClient());
  h.maybeSingle.mockReset();
  h.upsert.mockReset().mockResolvedValue({ error: null });
  h.getSession.mockReset().mockResolvedValue(sessionOf("u1"));
  h.setHeader.mockReset();
  h.listRows.mockReset().mockResolvedValue({ data: [], error: null });
  h.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  h.del.mockReset().mockResolvedValue({ data: [], error: null });
  h.delEq.mockReset();
  h.authCbs.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchCloudRow — tagged result", () => {
  it("ok: the row exists (server extras default to empty / null)", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: { durable: { xp: 5 }, username: "ace" }, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({
      status: "ok",
      durable: { xp: 5 },
      username: "ace",
      grants: [],
      preseasonPosition: null,
      preseasonPositions: {},
    });
  });

  it("ok: embedded grants + the frozen pre-season position are read (v2.0)", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({
      data: {
        durable: { xp: 5 },
        username: "ace",
        preseason_position: 17,
        // rc.54: one place per frozen board; junk keys and values are dropped.
        preseason_positions: { mmr: 17, championships: 3, best_sam: "9", hacked: 1, titles_legacy: 0 },
        profile_grants: [{ grant_id: "pro" }, { grant_id: "supporter" }],
      },
      error: null,
    });
    expect(await sb.fetchCloudRow("u1")).toMatchObject({
      status: "ok",
      grants: ["pro", "supporter"],
      preseasonPosition: 17,
      preseasonPositions: { mmr: 17, championships: 3 },
    });
    expect((await sb.fetchCloudRow("u1")) as { preseasonPositions: object }).toHaveProperty("preseasonPositions", {
      mmr: 17,
      championships: 3,
    });
  });

  it("no-row: the read succeeded and returned nothing", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "no-row" });
  });

  it("error: a PostgREST error is NOT reported as no-row", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: { message: "upstream timeout", code: "57014" } });
    expect(await sb.fetchCloudRow("u1")).toEqual({
      status: "error",
      error: "upstream timeout",
      reason: "server",
      code: "57014",
    });
  });

  it("error: a thrown network failure is NOT reported as no-row", async () => {
    const sb = await load();
    h.maybeSingle.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error", reason: "network" });
  });

  it("error: the SDK could not be created — and the next call retries", async () => {
    const sb = await load();
    h.createClient.mockImplementationOnce(() => {
      throw new Error("chunk load failed");
    });
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error", reason: "unavailable" });
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "no-row" });
    expect(h.createClient).toHaveBeenCalledTimes(2);
  });

  it("accounts disabled: error, and the SDK is never loaded", async () => {
    const sb = await load(false);
    expect(sb.accountsEnabled).toBe(false);
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error" });
    expect(h.createClient).not.toHaveBeenCalled();
  });
});

describe("pushCloudProfile", () => {
  it("never writes the frozen pre-season columns (xp / mmr) — v2.0", async () => {
    const sb = await load();
    const durable = { xp: 120, mmr: 433 } as never;
    await sb.pushCloudProfile("u1", "ace", durable, { season_xp: 120, season_mmr: 433 } as never);
    const row = h.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("xp");
    expect(row).not.toHaveProperty("mmr");
    expect(row).toMatchObject({ id: "u1", username: "ace", season_xp: 120, season_mmr: 433 });
  });

  it("reports a failed upsert", async () => {
    const sb = await load();
    h.upsert.mockResolvedValue({ error: { message: "rls" } });
    const durable = { xp: 1 } as never;
    const res = await sb.pushCloudProfile("u1", "ace", durable, {} as never);
    expect(res).toEqual({ error: "rls", reason: "other" });
  });

  it("names a refused display name (unique violation) as a conflict", async () => {
    const sb = await load();
    h.upsert.mockResolvedValue({ error: { message: "duplicate key value", code: "23505" }, status: 409 });
    const res = await sb.pushCloudProfile("u1", "ace", { xp: 1 } as never, {} as never);
    expect(res).toEqual({ error: "duplicate key value", reason: "conflict", code: "23505" });
  });
});

describe("v2.0.25: a cloud call carries the player's own token, or is not sent", () => {
  // supabase-js falls back to the anon key when it has no session to offer. The
  // read then ran as nobody, row-level security hid the row and an existing
  // account read as "no row".
  it("no session (expired token, refresh failed): auth error, nothing is sent", async () => {
    const sb = await load();
    h.getSession.mockResolvedValue({ data: { session: null }, error: null });
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "error", error: "no session", reason: "auth" });
    expect(await sb.pushCloudProfile("u1", "ace", { xp: 1 } as never, {} as never)).toEqual({
      error: "no session",
      reason: "auth",
    });
    expect(h.maybeSingle).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("the session of another user: auth error, nothing is sent", async () => {
    const sb = await load();
    h.getSession.mockResolvedValue(sessionOf("someone-else"));
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error", reason: "auth" });
    expect(await sb.pushCloudProfile("u1", "ace", { xp: 1 } as never, {} as never)).toMatchObject({ reason: "auth" });
    expect(h.maybeSingle).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("a token refresh that failed on the network is a network failure, not auth", async () => {
    const sb = await load();
    h.getSession.mockResolvedValue({ data: { session: null }, error: { message: "Failed to fetch", status: 0 } });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "error", error: "Failed to fetch", reason: "network" });
    expect(h.maybeSingle).not.toHaveBeenCalled();
  });

  it("the read and the push put the checked token on the request itself", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    await sb.fetchCloudRow("u1");
    await sb.pushCloudProfile("u1", "ace", { xp: 1 } as never, {} as never);
    expect(h.setHeader.mock.calls).toEqual([
      ["read", "Authorization", "Bearer tok-u1"],
      ["push", "Authorization", "Bearer tok-u1"],
    ]);
  });
});

describe("lazy client", () => {
  it("one client for concurrent first calls", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    await Promise.all([sb.fetchCloudRow("a"), sb.fetchCloudRow("b"), sb.startAuth()]);
    expect(h.createClient).toHaveBeenCalledTimes(1);
  });

  it("keeps the client options (persistSession / autoRefreshToken / detectSessionInUrl, default storageKey)", async () => {
    const sb = await load();
    await sb.startAuth();
    expect(h.createClient).toHaveBeenCalledWith(URL_ENV, "anon-key", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  });

  it("onAuthChange does not load the SDK; it binds when the client is created", async () => {
    const sb = await load();
    const seen: [unknown, string][] = [];
    sb.onAuthChange((session, event) => seen.push([session, event]));
    await Promise.resolve();
    expect(h.createClient).not.toHaveBeenCalled();
    await sb.startAuth();
    expect(h.authCbs).toHaveLength(1);
    h.authCbs[0]("INITIAL_SESSION", null);
    expect(seen).toEqual([[null, "INITIAL_SESSION"]]);
    // a listener added after creation binds immediately
    sb.onAuthChange(() => {});
    expect(h.authCbs).toHaveLength(2);
  });
});

describe("hasStoredAuthSession — startup probe (no SDK download)", () => {
  function stubBrowser(store: Record<string, string>, href = "https://rocketdraft.app/") {
    const url = new URL(href);
    vi.stubGlobal("window", { location: { href, hash: url.hash, search: url.search } });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null });
  }

  it("true when supabase-js v2's default key sb-<ref>-auth-token is persisted", async () => {
    const sb = await load();
    stubBrowser({ "sb-abcdref-auth-token": "{}" });
    expect(sb.hasStoredAuthSession()).toBe(true);
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it("true for a PKCE code-verifier mid-flow", async () => {
    const sb = await load();
    stubBrowser({ "sb-abcdref-auth-token-code-verifier": "x" });
    expect(sb.hasStoredAuthSession()).toBe(true);
  });

  it("true on an auth redirect URL (detectSessionInUrl)", async () => {
    const sb = await load();
    stubBrowser({}, "https://rocketdraft.app/profile#access_token=t&refresh_token=r");
    expect(sb.hasStoredAuthSession()).toBe(true);
  });

  it("false for a guest (other project's key, other app keys)", async () => {
    const sb = await load();
    stubBrowser({ "sb-otherref-auth-token": "{}", "rocket-draft:profile:v1": "{}" });
    expect(sb.hasStoredAuthSession()).toBe(false);
  });

  it("false when accounts are disabled", async () => {
    const sb = await load(false);
    stubBrowser({ "sb-abcdref-auth-token": "{}" });
    expect(sb.hasStoredAuthSession()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Road to Worlds cloud save (v2.0.26)
// ---------------------------------------------------------------------------

const ROW = {
  slot: 1,
  career_id: "c1",
  save_version: 5,
  seq: 42,
  summary: { orgName: "Immutable" },
  device_id: "d-1",
  saved_at: "2026-11-01T10:00:00.000Z",
  revision: 3,
  updated_at: "2026-11-01T10:00:05.000Z",
};

const PUSH_INPUT = {
  slot: 1,
  careerId: "c1",
  saveVersion: 5,
  seq: 42,
  summary: { orgName: "Immutable" },
  payload: { encoding: "gzip" as const, payload: "QUJD" },
  deviceId: "d-1",
  release: "2.0.26",
  savedAt: Date.parse("2026-11-01T10:00:00.000Z"),
  expectedRevision: null as number | null,
};

const P_KEYS = [
  "p_slot",
  "p_career_id",
  "p_save_version",
  "p_seq",
  "p_summary",
  "p_encoding",
  "p_payload",
  "p_device_id",
  "p_client_release",
  "p_saved_at",
  "p_expected_revision",
  "p_force",
];

describe("fetchCareerMetas", () => {
  it("maps rows (snake_case, ISO dates to ms) and drops malformed ones", async () => {
    const sb = await load();
    h.listRows.mockResolvedValue({
      data: [ROW, { ...ROW, slot: 2, career_id: 5 }, { ...ROW, slot: 0, revision: "3" }, null, { ...ROW, slot: "x" }, { slot: 2, career_id: "c2", revision: 1 }],
      error: null,
    });
    const res = await sb.fetchCareerMetas("u1");
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.slots).toHaveLength(2);
    expect(res.slots[0]).toEqual({
      slot: 1,
      careerId: "c1",
      saveVersion: 5,
      seq: 42,
      revision: 3,
      savedAt: Date.parse("2026-11-01T10:00:00.000Z"),
      updatedAt: Date.parse("2026-11-01T10:00:05.000Z"),
      deviceId: "d-1",
      summary: { orgName: "Immutable" },
    });
    // a row with only the required fields gets safe defaults
    expect(res.slots[1]).toMatchObject({ slot: 2, careerId: "c2", saveVersion: 0, seq: 0, savedAt: 0, updatedAt: 0, deviceId: "", summary: {} });
  });

  it("null data is an empty list; an error is an error, never an empty list", async () => {
    const sb = await load();
    h.listRows.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCareerMetas("u1")).toEqual({ status: "ok", slots: [] });
    h.listRows.mockResolvedValue({ data: null, error: { message: "upstream timeout", code: "57014" }, status: 504 });
    expect(await sb.fetchCareerMetas("u1")).toMatchObject({ status: "error", reason: "server", code: "57014" });
  });

  it("a thrown network failure is an error", async () => {
    const sb = await load();
    h.listRows.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sb.fetchCareerMetas("u1")).toMatchObject({ status: "error", reason: "network" });
  });
});

describe("fetchCareerSave", () => {
  it("null data is empty", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCareerSave("u1", 1)).toEqual({ status: "empty" });
    expect(h.rpc).toHaveBeenCalledWith("get_career_save", { p_slot: 1 });
  });

  it("maps meta and payload", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: { ...ROW, encoding: "json", payload: "e30=" }, error: null });
    const res = await sb.fetchCareerSave("u1", 1);
    expect(res).toMatchObject({ status: "ok", meta: { slot: 1, careerId: "c1", revision: 3 }, payload: { encoding: "json", payload: "e30=" } });
  });

  it.each([
    ["no payload", { ...ROW, encoding: "gzip" }],
    ["unknown encoding", { ...ROW, encoding: "zip", payload: "x" }],
    ["no career id", { ...ROW, career_id: undefined, encoding: "gzip", payload: "x" }],
  ])("a malformed row (%s) is an error", async (_n, data) => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data, error: null });
    expect(await sb.fetchCareerSave("u1", 1)).toEqual({ status: "error", error: "malformed row", reason: "other" });
  });

  it("an rpc error is an error", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom", code: "XX000" }, status: 500 });
    expect(await sb.fetchCareerSave("u1", 1)).toMatchObject({ status: "error", reason: "server", code: "XX000" });
  });
});

describe("pushCareerSave", () => {
  it("sends every argument key, with a null expected revision present and the release", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: { status: "ok", revision: 4, updated_at: "2026-11-01T10:00:09.000Z" }, error: null });
    const res = await sb.pushCareerSave("u1", PUSH_INPUT);
    expect(res).toEqual({ status: "ok", revision: 4, updatedAt: Date.parse("2026-11-01T10:00:09.000Z") });
    const [name, args] = h.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("push_career_save");
    expect(Object.keys(args).sort()).toEqual([...P_KEYS].sort());
    expect(args.p_expected_revision).toBeNull();
    expect(args.p_force).toBe(false);
    expect(args.p_client_release).toBe("2.0.26");
    expect(args.p_encoding).toBe("gzip");
    expect(args.p_payload).toBe("QUJD");
    expect(args.p_saved_at).toBe("2026-11-01T10:00:00.000Z");
  });

  it("passes the expected revision and force through", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: { status: "ok", revision: 8 }, error: null });
    await sb.pushCareerSave("u1", { ...PUSH_INPUT, expectedRevision: 7, force: true });
    const args = h.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_expected_revision).toBe(7);
    expect(args.p_force).toBe(true);
  });

  it("maps conflict (with the row's meta), missing, and malformed answers", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: { status: "conflict", ...ROW, slot: undefined }, error: null });
    expect(await sb.pushCareerSave("u1", PUSH_INPUT)).toMatchObject({ status: "conflict", meta: { slot: 1, careerId: "c1", revision: 3 } });
    h.rpc.mockResolvedValue({ data: { status: "missing" }, error: null });
    expect(await sb.pushCareerSave("u1", PUSH_INPUT)).toEqual({ status: "missing" });
    h.rpc.mockResolvedValue({ data: { status: "conflict" }, error: null });
    expect(await sb.pushCareerSave("u1", PUSH_INPUT)).toEqual({ status: "error", error: "malformed answer", reason: "other" });
    h.rpc.mockResolvedValue({ data: null, error: null });
    expect(await sb.pushCareerSave("u1", PUSH_INPUT)).toEqual({ status: "error", error: "malformed answer", reason: "other" });
  });

  it("an error with a code is named", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" }, status: 403 });
    expect(await sb.pushCareerSave("u1", PUSH_INPUT)).toEqual({ status: "error", error: "permission denied", reason: "denied", code: "42501" });
  });
});

describe("deleteCareerSave", () => {
  it("filters by user, slot, career AND revision, asks for the deleted rows, and maps rows to deleted: true", async () => {
    const sb = await load();
    h.del.mockResolvedValue({ data: [{ slot: 2 }], error: null });
    expect(await sb.deleteCareerSave("u1", 2, "c9", 7)).toEqual({ status: "ok", deleted: true });
    expect(h.delEq).toHaveBeenCalledWith(
      [
        ["user_id", "u1"],
        ["slot", 2],
        ["career_id", "c9"],
        ["revision", 7],
      ],
      [["slot"]],
    );
  });

  it("no row came back: deleted false (not an error)", async () => {
    const sb = await load();
    h.del.mockResolvedValue({ data: [], error: null });
    expect(await sb.deleteCareerSave("u1", 2, "c9", 7)).toEqual({ status: "ok", deleted: false });
    h.del.mockResolvedValue({ data: null, error: null });
    expect(await sb.deleteCareerSave("u1", 2, "c9", 7)).toEqual({ status: "ok", deleted: false });
  });

  it("reports an error", async () => {
    const sb = await load();
    h.del.mockResolvedValue({ data: null, error: { message: "rls", code: "42501" }, status: 403 });
    expect(await sb.deleteCareerSave("u1", 2, "c9", 7)).toEqual({ status: "error", error: "rls", reason: "denied", code: "42501" });
  });

  it("a thrown network failure is an error", async () => {
    const sb = await load();
    h.del.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sb.deleteCareerSave("u1", 2, "c9", 7)).toMatchObject({ status: "error", reason: "network" });
  });
});

describe("career calls: the player's own token, or nothing is sent", () => {
  const calls = (sb: Sb) => [
    () => sb.fetchCareerMetas("u1"),
    () => sb.fetchCareerSave("u1", 0),
    () => sb.pushCareerSave("u1", PUSH_INPUT),
    () => sb.deleteCareerSave("u1", 0, "c1", 1),
  ];

  it("no session: reason auth on all four, and nothing is sent", async () => {
    const sb = await load();
    h.getSession.mockResolvedValue({ data: { session: null }, error: null });
    for (const call of calls(sb)) {
      expect(await call()).toMatchObject({ reason: "auth" });
    }
    expect(h.listRows).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.del).not.toHaveBeenCalled();
  });

  it("the session of another user: auth on all four", async () => {
    const sb = await load();
    h.getSession.mockResolvedValue(sessionOf("someone-else"));
    for (const call of calls(sb)) {
      expect(await call()).toMatchObject({ reason: "auth" });
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("the Authorization header is set from the checked token on all four", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: null, error: null });
    for (const call of calls(sb)) await call();
    expect(h.setHeader.mock.calls).toEqual([
      ["read", "Authorization", "Bearer tok-u1"],
      ["rpc", "Authorization", "Bearer tok-u1"],
      ["rpc", "Authorization", "Bearer tok-u1"],
      ["delete", "Authorization", "Bearer tok-u1"],
    ]);
  });
});

describe("pushCareerSave: the stamp", () => {
  it("a stamp of 0 is sent as the epoch, not as now", async () => {
    const sb = await load();
    h.rpc.mockResolvedValue({ data: { status: "ok", revision: 1 }, error: null });
    await sb.pushCareerSave("u1", { ...PUSH_INPUT, savedAt: 0 });
    expect((h.rpc.mock.calls[0][1] as Record<string, unknown>).p_saved_at).toBe("1970-01-01T00:00:00.000Z");
  });
});
