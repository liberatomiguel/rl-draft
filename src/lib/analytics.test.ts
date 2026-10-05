/**
 * Lazy PostHog — the pre-init queue in `trackEvent` / `notePageview` and its
 * flush in `connectAnalytics`. No SDK and no network: a fake sink records the
 * `capture(...)` calls the real posthog-js client would receive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Analytics = typeof import("./analytics");
type Call = { name: string; props: Record<string, unknown> | null | undefined; opts?: { timestamp?: Date } };

const loc = { href: "https://rocketdraft.app/", pathname: "/" };
function go(pathname: string) {
  loc.pathname = pathname;
  loc.href = `https://rocketdraft.app${pathname}`;
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

async function load(key: string | undefined): Promise<Analytics> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key ?? "");
  return import("./analytics");
}

const RUN = { mode: "classic", difficulty: "normal", hiddenOverall: false } as const;

beforeEach(() => {
  go("/");
  vi.stubGlobal("window", { location: loc });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("trackEvent before the SDK is ready", () => {
  it("queues events and flushes them in order with their ORIGINAL timestamp and URL", async () => {
    const a = await load("phc_test");
    go("/play");
    a.trackEvent("run_started", RUN);
    const t1 = new Date();
    vi.setSystemTime(new Date("2026-10-03T12:00:05.000Z"));
    a.trackEvent("tournament_started", { mode: "classic", difficulty: "normal" });
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
    expect(sink.calls).toEqual([{ name: "run_started", props: RUN, opts: undefined }]);
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
