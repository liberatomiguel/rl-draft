/**
 * Analytics (OBS-01, #145): the production-only guard, the common properties,
 * the scalar payload, the actionId ring, and the lazy PostHog queue
 * (`trackEvent` / `notePageview` before the SDK and the flush in
 * `connectAnalytics`). No SDK and no network: a fake sink records the
 * `capture(...)` calls the real posthog-js client would receive.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Analytics = typeof import("./analytics");
type Call = { name: string; props: Record<string, unknown> | null | undefined; opts?: { timestamp?: Date } };

const loc = { href: "https://rocketdraft.app/", pathname: "/", hostname: "rocketdraft.app" };
function go(pathname: string, hostname = loc.hostname) {
  loc.hostname = hostname;
  loc.pathname = pathname;
  loc.href = `https://${hostname}${pathname}`;
}

function fakeSink() {
  const calls: Call[] = [];
  return {
    calls,
    capture(name: string, props?: Record<string, unknown> | null, opts?: { timestamp?: Date }) {
      calls.push({ name, props, opts });
    },
  };
}

/** A fresh module under a given build: production by default, with a key. */
async function load(
  key: string | undefined,
  build: { nodeEnv?: string; noindex?: string; playtest?: string } = {},
): Promise<Analytics> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", build.nodeEnv ?? "production");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key ?? "");
  vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", build.playtest ?? "");
  return import("./analytics");
}

const RUN = { runId: "run-1", mode: "classic", difficulty: "normal", hiddenOverall: false, region: "worldwide" } as const;

beforeEach(() => {
  go("/", "rocketdraft.app");
  vi.stubGlobal("window", { location: loc });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the production-only guard (Miguel 29/10: no analytics on staging / playtest)", () => {
  it("allows only a production build on rocketdraft.app", async () => {
    const a = await load("phc_test");
    expect(a.analyticsEnvironment()).toBe("production");
    expect(a.analyticsAllowed()).toBe(true);
  });

  it.each([
    ["staging build (NEXT_PUBLIC_NOINDEX=1)", { noindex: "1" }, "staging"],
    ["playtest build (NEXT_PUBLIC_PLAYTEST=1)", { playtest: "1", noindex: "1" }, "playtest"],
    ["dev server", { nodeEnv: "development" }, "dev"],
    ["tests", { nodeEnv: "test" }, "dev"],
  ] as const)("%s: environment %s — nothing queued, nothing sent, the SDK refused", async (_label, build, env) => {
    const a = await load("phc_test", build);
    expect(a.analyticsEnvironment()).toBe(env);
    expect(a.analyticsAllowed()).toBe(false);
    a.trackEvent("run_started", RUN);
    a.notePageview();
    const sink = fakeSink();
    a.connectAnalytics(sink);
    a.trackEvent("run_started", RUN);
    expect(sink.calls).toHaveLength(0);
  });

  it.each(["staging.rocketdraft.app", "playtest.rocketdraft.app", "localhost", "www.rocketdraft.app"])(
    "a production build served from %s sends nothing (the host guard)",
    async (host) => {
      go("/", host);
      const a = await load("phc_test");
      expect(a.analyticsAllowed()).toBe(false);
      a.trackEvent("run_started", RUN);
      const sink = fakeSink();
      a.connectAnalytics(sink);
      a.trackEvent("run_started", RUN);
      expect(sink.calls).toHaveLength(0);
    },
  );

  it("checks the guard on every call, not only at connect (a staging page never sends)", async () => {
    const a = await load("phc_test");
    const sink = fakeSink();
    a.connectAnalytics(sink);
    go("/", "staging.rocketdraft.app");
    a.trackEvent("run_started", RUN);
    expect(sink.calls).toHaveLength(0);
  });

  it("without a window (the static prerender) nothing is allowed", async () => {
    vi.unstubAllGlobals();
    const a = await load("phc_test");
    expect(a.analyticsAllowed()).toBe(false);
  });
});

describe("the payload", () => {
  it("carries the common properties; release equals package.json's version", async () => {
    const a = await load("phc_test");
    const { BALANCE_VERSION } = await import("@/config/balance");
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
    const sink = fakeSink();
    a.connectAnalytics(sink);
    a.setAnalyticsLocaleSource(() => "pt");
    a.trackEvent("run_started", RUN);
    expect(sink.calls).toEqual([
      {
        name: "run_started",
        props: {
          ...RUN,
          release: pkg.version,
          balanceVersion: BALANCE_VERSION,
          schemaVersion: a.ANALYTICS_SCHEMA_VERSION,
          environment: "production",
          locale: "pt",
          gameMode: "draft",
        },
        opts: undefined,
      },
    ]);
  });

  it("gameMode: career_* events are career; shared events carry their own", async () => {
    const a = await load("phc_test");
    expect(
      a.analyticsPayload("career_milestone", { careerId: "c1", actionId: "x", seasonIndex: 0, kind: "backer" })
        .gameMode,
    ).toBe("career");
    expect(
      a.analyticsPayload("ux_tutorial", { gameMode: "career", actionId: "t", id: "seenHub", step: 1, outcome: "completed" })
        .gameMode,
    ).toBe("career");
    expect(a.analyticsPayload("special_discovered", { specialId: "s", rarity: "epic", national: false, mode: "classic" }).gameMode).toBe(
      "draft",
    );
  });

  it("scalars only: objects, arrays and undefined are dropped, NaN becomes null, long strings are cut", async () => {
    const a = await load("phc_test");
    const props = a.analyticsPayload("run_started", {
      ...RUN,
      region: "x".repeat(500),
      // @ts-expect-error — a wrong shape at runtime must still flatten safely
      nested: { a: 1 },
      list: [1, 2],
      missing: undefined,
      broken: Number.NaN,
    });
    for (const value of Object.values(props)) {
      expect(value === null || ["string", "number", "boolean"].includes(typeof value)).toBe(true);
    }
    expect(props).not.toHaveProperty("nested");
    expect(props).not.toHaveProperty("list");
    expect(props).not.toHaveProperty("missing");
    expect(props.broken).toBeNull();
    expect(String(props.region).length).toBeLessThanOrEqual(120);
  });

  it("an actionId goes out once per session", async () => {
    const a = await load("phc_test");
    const sink = fakeSink();
    a.connectAnalytics(sink);
    const e = { careerId: "c1", actionId: "c1:0:12:milestone:backer", seasonIndex: 0, kind: "backer" } as const;
    a.trackEvent("career_milestone", e);
    a.trackEvent("career_milestone", e);
    a.trackEvent("career_milestone", { ...e, actionId: "c1:0:13:milestone:bank_loan", kind: "bank_loan" });
    expect(sink.calls.map((c) => c.props?.kind)).toEqual(["backer", "bank_loan"]);
  });

  it("anonymousId is random, prefixed and carries nothing else", async () => {
    const a = await load("phc_test");
    const ids = new Set(Array.from({ length: 50 }, () => a.anonymousId("c")));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^c[0-9a-f]{16}$/);
  });
});

describe("trackEvent before the SDK is ready", () => {
  it("queues events and flushes them in order with their ORIGINAL timestamp and URL", async () => {
    const a = await load("phc_test");
    go("/play");
    a.trackEvent("run_started", RUN);
    const t1 = new Date();
    vi.setSystemTime(new Date("2026-10-03T12:00:05.000Z"));
    a.trackEvent("tournament_started", { runId: "run-1", mode: "classic", difficulty: "normal", region: "worldwide" });
    const t2 = new Date();
    vi.setSystemTime(new Date("2026-10-03T12:00:09.000Z"));
    go("/collection"); // the player moved on before PostHog arrived

    const sink = fakeSink();
    a.connectAnalytics(sink);
    const events = sink.calls.filter((c) => c.name !== "$pageview");
    expect(events.map((c) => c.name)).toEqual(["run_started", "tournament_started"]);
    expect(events[0].opts?.timestamp).toEqual(t1);
    expect(events[1].opts?.timestamp).toEqual(t2);
    expect(events[0].props).toMatchObject({ ...RUN, $pathname: "/play", $current_url: "https://rocketdraft.app/play" });
  });

  it("after connect, events go straight to the SDK (no timestamp override, no URL props)", async () => {
    const a = await load("phc_test");
    const sink = fakeSink();
    a.connectAnalytics(sink);
    a.trackEvent("run_started", RUN);
    expect(sink.calls).toHaveLength(1);
    expect(sink.calls[0].opts).toBeUndefined();
    expect(sink.calls[0].props).toMatchObject(RUN);
    expect(sink.calls[0].props).not.toHaveProperty("$pathname");
  });

  it("the queue is bounded", async () => {
    const a = await load("phc_test");
    for (let i = 0; i < a.ANALYTICS_QUEUE_LIMIT + 25; i++) a.trackEvent("run_started", RUN);
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(a.ANALYTICS_QUEUE_LIMIT);
  });

  it("without a PostHog key nothing is queued", async () => {
    const a = await load(undefined);
    a.trackEvent("run_started", RUN);
    a.notePageview();
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(0);
  });

  it("disableAnalytics (SDK failed to load) drops the queue and stops queueing", async () => {
    const a = await load("phc_test");
    a.trackEvent("run_started", RUN);
    a.disableAnalytics();
    a.trackEvent("run_started", RUN);
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(0);
  });

  it("never throws into gameplay when the sink throws", async () => {
    const a = await load("phc_test");
    a.connectAnalytics({
      capture() {
        throw new Error("boom");
      },
    });
    expect(() => a.trackEvent("run_started", RUN)).not.toThrow();
  });
});

describe("pageviews before the SDK is ready", () => {
  it("landing page only: nothing replayed — the SDK's own initial $pageview covers it", async () => {
    const a = await load("phc_test");
    a.notePageview();
    a.notePageview(); // strict-mode double effect / re-render: deduped
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(0);
  });

  it("SPA navigations made before init are replayed as $pageview with their own URL + time", async () => {
    const a = await load("phc_test");
    a.notePageview(); // landing "/"
    const tLanding = new Date();
    vi.setSystemTime(new Date("2026-10-03T12:00:02.000Z"));
    go("/play");
    a.notePageview();
    const tPlay = new Date();
    a.trackEvent("run_started", RUN);
    vi.setSystemTime(new Date("2026-10-03T12:00:04.000Z"));
    go("/leaderboards");
    a.notePageview(); // current page at init → left to the SDK

    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls.map((c) => [c.name, c.props?.$pathname])).toEqual([
      ["$pageview", "/"],
      ["$pageview", "/play"],
      ["run_started", "/play"],
    ]);
    expect(sink.calls[0].opts?.timestamp).toEqual(tLanding);
    expect(sink.calls[1].opts?.timestamp).toEqual(tPlay);
    expect(sink.calls[1].props?.$current_url).toBe("https://rocketdraft.app/play");
  });

  it("is a no-op once the SDK is connected (history_change capture takes over)", async () => {
    const a = await load("phc_test");
    const sink = fakeSink();
    a.connectAnalytics(sink);
    go("/play");
    a.notePageview();
    expect(sink.calls).toHaveLength(0);
  });
});
