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
  authCbs: [] as ((event: string, session: unknown) => void)[],
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: h.createClient }));

function fakeClient() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }),
      upsert: h.upsert,
    }),
    auth: {
      onAuthStateChange: (cb: AuthCb) => {
        h.authCbs.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
}

const URL_ENV = "https://abcdref.supabase.co";

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
  h.authCbs.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchCloudRow — tagged result", () => {
  it("ok: the row exists", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: { durable: { xp: 5 }, username: "ace" }, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "ok", durable: { xp: 5 }, username: "ace" });
  });

  it("no-row: the read succeeded and returned nothing", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "no-row" });
  });

  it("error: a PostgREST error is NOT reported as no-row", async () => {
    const sb = await load();
    h.maybeSingle.mockResolvedValue({ data: null, error: { message: "upstream timeout", code: "57014" } });
    expect(await sb.fetchCloudRow("u1")).toEqual({ status: "error", error: "upstream timeout" });
  });

  it("error: a thrown network failure is NOT reported as no-row", async () => {
    const sb = await load();
    h.maybeSingle.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error" });
  });

  it("error: the SDK could not be created — and the next call retries", async () => {
    const sb = await load();
    h.createClient.mockImplementationOnce(() => {
      throw new Error("chunk load failed");
    });
    expect(await sb.fetchCloudRow("u1")).toMatchObject({ status: "error" });
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
  it("reports a failed upsert", async () => {
    const sb = await load();
    h.upsert.mockResolvedValue({ error: { message: "rls" } });
    const durable = { xp: 1 } as never;
    const res = await sb.pushCloudProfile("u1", "ace", durable, {} as never);
    expect(res).toEqual({ error: "rls" });
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
