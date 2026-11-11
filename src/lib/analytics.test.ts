/**
 * Analytics (OBS-01, #145; the 2.0 catalogue): the production-only guard, the
 * common properties, the scalar payload, the actionId ring, the lazy PostHog
 * queue, sessions and the entry funnel, `$pageview` once per route per session,
 * the career counters, screen errors and the budget guard as wired into
 * `trackEvent`. No SDK and no network: a fake sink records the `capture(...)`
 * calls the real posthog-js client would receive.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogProblems } from "./analyticsCatalog";

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

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** A fresh module under a given build: production by default, with a key. */
async function load(
  key: string | undefined,
  build: { nodeEnv?: string; noindex?: string; playtest?: string; players?: string } = {},
): Promise<Analytics> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", build.nodeEnv ?? "production");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key ?? "");
  vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", build.playtest ?? "");
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY", build.players ?? "");
  return import("./analytics");
}

/** A connected module and its sink. */
async function live(build?: Parameters<typeof load>[1]) {
  const a = await load("phc_test", build);
  const sink = fakeSink();
  a.connectAnalytics(sink);
  return { a, sink };
}

const CARD = { specialId: "sp-1", rarity: "epic", national: false, mode: "classic" } as const;
const card = (n: number) => ({ ...CARD, specialId: `sp-${n}` });
const START = new Date("2026-11-12T12:00:00.000Z");
const MINUTE = 60_000;

const named = (calls: Call[], name: string) => calls.filter((c) => c.name === name);
const names = (calls: Call[]) => calls.map((c) => c.name);
/** Everything but the session bookkeeping. */
const game = (calls: Call[]) => calls.filter((c) => c.name !== "session_started");

const COMMON = ["release", "balanceVersion", "schemaVersion", "season", "environment", "locale", "gameMode", "sampleWeight", "sampleBucket", "$current_url", "$pathname"];
/** The event's own properties (what the catalogue describes). */
function own(call: Call): Record<string, unknown> {
  return Object.fromEntries(Object.entries(call.props ?? {}).filter(([key]) => !COMMON.includes(key)));
}

beforeEach(() => {
  go("/", "rocketdraft.app");
  vi.stubGlobal("window", { location: loc });
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    a.trackEvent("special_discovered", CARD);
    a.trackOnboardingStep("draft_started");
    a.notePageview();
    const sink = fakeSink();
    a.connectAnalytics(sink);
    a.trackEvent("special_discovered", CARD);
    a.reportScreenError("window", new Error("boom"));
    expect(sink.calls).toHaveLength(0);
  });

  it.each(["staging.rocketdraft.app", "playtest.rocketdraft.app", "localhost", "www.rocketdraft.app"])(
    "a production build served from %s sends nothing and writes no device record (the host guard)",
    async (host) => {
      go("/", host);
      const storage = new MemoryStorage();
      vi.stubGlobal("window", { location: loc, localStorage: storage });
      const a = await load("phc_test");
      expect(a.analyticsAllowed()).toBe(false);
      a.trackEvent("special_discovered", CARD);
      a.notePageview();
      a.noteRunReset();
      const sink = fakeSink();
      a.connectAnalytics(sink);
      a.trackEvent("special_discovered", CARD);
      expect(sink.calls).toHaveLength(0);
      expect(storage.data.size).toBe(0);
    },
  );

  it("checks the guard on every call, not only at connect (a staging page never sends)", async () => {
    const { a, sink } = await live();
    go("/", "staging.rocketdraft.app");
    a.trackEvent("special_discovered", CARD);
    expect(sink.calls).toHaveLength(0);
  });

  it("without a window (the static prerender) nothing is allowed", async () => {
    vi.unstubAllGlobals();
    const a = await load("phc_test");
    expect(a.analyticsAllowed()).toBe(false);
    expect(() => a.notePageview()).not.toThrow();
  });
});

describe("the payload", () => {
  it("carries the common properties; release equals package.json's version; season and schema mark the 2.0 data", async () => {
    const { a, sink } = await live();
    const { BALANCE_VERSION } = await import("@/config/balance");
    const { SEASON } = await import("@/config/season");
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
    a.setAnalyticsLocaleSource(() => "pt");
    a.trackEvent("special_discovered", CARD);
    const [event] = named(sink.calls, "special_discovered");
    expect(event.props).toEqual({
      ...CARD,
      release: pkg.version,
      balanceVersion: BALANCE_VERSION,
      schemaVersion: 2,
      season: SEASON.id,
      environment: "production",
      locale: "pt",
      gameMode: "draft",
      sampleWeight: 1,
      sampleBucket: expect.any(Number),
    });
    expect(a.ANALYTICS_SCHEMA_VERSION).toBe(2);
    expect(event.opts).toBeUndefined();
  });

  it("gameMode: from the catalogue; shared (quality) events carry their own", async () => {
    const a = await load("phc_test");
    expect(a.analyticsPayload("career_milestone", { careerId: "c1", actionId: "x", seasonIndex: 0, kind: "backer" }).gameMode).toBe("career");
    expect(a.analyticsPayload("special_discovered", CARD).gameMode).toBe("draft");
    expect(a.analyticsPayload("account_signed_in", { hadLocalProgress: true }).gameMode).toBe("app");
    const migration = { actionId: "m", store: "career", fromVersion: 1, toVersion: 2 };
    expect(a.analyticsPayload("quality_migration", { ...migration, gameMode: "career" }).gameMode).toBe("career");
    expect(a.analyticsPayload("quality_migration", { ...migration, gameMode: "draft" }).gameMode).toBe("draft");
  });

  it("scalars only: objects, arrays and undefined are dropped, NaN becomes null, long strings are cut", async () => {
    const a = await load("phc_test");
    const props = a.analyticsPayload("special_discovered", {
      ...CARD,
      mode: "x".repeat(900),
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
    expect(String(props.mode).length).toBeLessThanOrEqual(320);
  });

  it("an actionId goes out once per session", async () => {
    const { a, sink } = await live();
    const e = { careerId: "c1", actionId: "c1:0:12:milestone:backer", seasonIndex: 0, kind: "backer" } as const;
    a.trackEvent("career_milestone", e);
    a.trackEvent("career_milestone", e);
    a.trackEvent("career_milestone", { ...e, actionId: "c1:0:13:milestone:bank_loan", kind: "bank_loan" });
    expect(named(sink.calls, "career_milestone").map((c) => c.props?.kind)).toEqual(["backer", "bank_loan"]);
  });

  it("anonymousId is random, prefixed and carries nothing else", async () => {
    const a = await load("phc_test");
    const ids = new Set(Array.from({ length: 50 }, () => a.anonymousId("c")));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^c[0-9a-f]{16}$/);
  });
});

describe("the catalogue is enforced where events are sent", () => {
  it("an event outside the catalogue throws under Vitest (so the test that fires it fails)", async () => {
    const { a, sink } = await live();
    // @ts-expect-error — removed in 2.0
    expect(() => a.trackEvent("run_started", { runId: "r" })).toThrow(/not in the analytics catalogue/);
    expect(sink.calls).toHaveLength(0);
  });

  it("a missing required property, a wrong type or an unlisted property throws", async () => {
    const { a } = await live();
    // @ts-expect-error — `mode` is required
    expect(() => a.trackEvent("special_discovered", { specialId: "s", rarity: "epic", national: false })).toThrow(/special_discovered\.mode is required/);
    // @ts-expect-error — `national` is a boolean
    expect(() => a.trackEvent("special_discovered", { ...CARD, national: "yes" })).toThrow(/national must be a boolean/);
    // @ts-expect-error — `title` left the catalogue
    expect(() => a.trackEvent("special_discovered", { ...CARD, title: "Free text" })).toThrow(/title is not in the catalogue/);
  });

  it("the check runs even where nothing is sent (dev, staging), so every store test covers its payloads", async () => {
    const a = await load("phc_test", { nodeEnv: "test" });
    // @ts-expect-error — unknown event
    expect(() => a.trackEvent("tournament_started", {})).toThrow();
  });

  it("every event this module sends on its own matches the catalogue", async () => {
    const { a, sink } = await live({ players: "800" });
    a.trackOnboardingStep("draft_started");
    for (let i = 0; i < 40; i++) a.trackEvent("special_discovered", card(i));
    a.noteCareerAdvance("day", 9000);
    a.reportScreenError("window", new TypeError("x is undefined"));
    for (const name of ["session_started", "onboarding_step", "quality_event_cap", "quality_slow_advance", "quality_error"]) {
      const sent = named(sink.calls, name);
      expect(sent.length, name).toBeGreaterThan(0);
      for (const call of sent) expect(catalogProblems(name, own(call)), name).toEqual([]);
    }
  });
});

describe("trackEvent before the SDK is ready", () => {
  it("queues events and flushes them in order with their ORIGINAL timestamp and URL", async () => {
    const a = await load("phc_test");
    go("/play");
    a.trackEvent("special_discovered", card(1));
    vi.setSystemTime(new Date(START.getTime() + 5000));
    go("/collection");
    a.trackEvent("special_discovered", card(2));
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(names(sink.calls)).toEqual(["session_started", "special_discovered", "special_discovered"]);
    const [first, second] = named(sink.calls, "special_discovered");
    expect(first.props).toMatchObject({ specialId: "sp-1", $current_url: "https://rocketdraft.app/play", $pathname: "/play" });
    expect(first.opts).toEqual({ timestamp: START });
    expect(second.props).toMatchObject({ specialId: "sp-2", $pathname: "/collection" });
    expect(second.opts).toEqual({ timestamp: new Date(START.getTime() + 5000) });
  });

  it("after connect, events go straight to the SDK (no timestamp override, no URL props)", async () => {
    const { a, sink } = await live();
    a.trackEvent("special_discovered", CARD);
    const [event] = named(sink.calls, "special_discovered");
    expect(event.opts).toBeUndefined();
    expect(event.props).not.toHaveProperty("$current_url");
  });

  it("the queue is bounded", async () => {
    const a = await load("phc_test");
    for (let i = 0; i < a.ANALYTICS_QUEUE_LIMIT + 20; i++) a.trackEvent("special_discovered", card(i));
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(a.ANALYTICS_QUEUE_LIMIT);
  });

  it("without a PostHog key nothing is queued", async () => {
    const a = await load(undefined);
    a.trackEvent("special_discovered", CARD);
    a.notePageview();
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(0);
  });

  it("disableAnalytics (SDK failed to load) drops the queue and stops queueing", async () => {
    const a = await load("phc_test");
    a.trackEvent("special_discovered", card(1));
    a.disableAnalytics();
    a.trackEvent("special_discovered", card(2));
    const sink = fakeSink();
    a.connectAnalytics(sink);
    expect(sink.calls).toHaveLength(0);
  });

  it("never throws into gameplay when the sink throws", async () => {
    const a = await load("phc_test");
    a.connectAnalytics({
      capture() {
        throw new Error("network");
      },
    });
    expect(() => a.trackEvent("special_discovered", CARD)).not.toThrow();
    expect(() => a.notePageview()).not.toThrow();
  });
});

describe("sessions and the entry funnel", () => {
  it("the first activity starts session 1; 30 idle minutes start the next; a new day counts a day", async () => {
    const { a, sink } = await live();
    a.registerSessionProps(() => ({ xp: 120, runsCompleted: 3, signedIn: false }));
    go("/play");
    a.trackEvent("special_discovered", card(1));
    vi.setSystemTime(new Date(START.getTime() + 20 * MINUTE));
    a.trackEvent("special_discovered", card(2)); // same session
    vi.setSystemTime(new Date(START.getTime() + 51 * MINUTE));
    a.trackEvent("special_discovered", card(3)); // 31 idle minutes: session 2
    vi.setSystemTime(new Date(START.getTime() + 26 * 60 * MINUTE));
    a.trackEvent("special_discovered", card(4)); // the next day: session 3, day 2
    const sessions = named(sink.calls, "session_started").map(own);
    expect(sessions).toEqual([
      expect.objectContaining({ sessionNumber: 1, dayNumber: 1, daysSinceFirst: 0, daysSinceLast: null, entryPath: "/play", xp: 120, runsCompleted: 3, signedIn: false }),
      expect.objectContaining({ sessionNumber: 2, dayNumber: 1, daysSinceLast: 0 }),
      expect.objectContaining({ sessionNumber: 3, dayNumber: 2, daysSinceFirst: 1, daysSinceLast: 1 }),
    ]);
    expect(names(sink.calls)[0]).toBe("session_started");
  });

  it("a step of the funnel goes out once per device, ever", async () => {
    const { a, sink } = await live();
    a.trackOnboardingStep("draft_started");
    a.trackOnboardingStep("draft_started");
    vi.setSystemTime(new Date(START.getTime() + 90_000));
    a.trackOnboardingStep("run_completed");
    expect(named(sink.calls, "onboarding_step").map(own)).toEqual([
      { step: "draft_started", sessionNumber: 1, dayNumber: 1, secondsSinceFirstSeen: 0 },
      { step: "run_completed", sessionNumber: 1, dayNumber: 1, secondsSinceFirstSeen: 90 },
    ]);
  });

  it("a player from before 2.0 is flagged, and the steps already done are never sent as firsts", async () => {
    const { a, sink } = await live();
    a.setAnalyticsHistorySource(() => ({ existing: true, doneSteps: ["draft_started", "draft_confirmed", "run_completed"] }));
    a.trackOnboardingStep("draft_started");
    a.trackOnboardingStep("run_completed");
    a.trackOnboardingStep("career_created");
    expect(named(sink.calls, "session_started")[0].props).toMatchObject({ existingPlayer: true });
    expect(named(sink.calls, "onboarding_step").map((c) => c.props?.step)).toEqual(["career_created"]);
  });

  it("the device record survives a reload: counters, funnel steps and the sample bucket (a reload inside 30 minutes is the same session)", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { location: loc, localStorage: storage });
    let { a, sink } = await live();
    a.trackOnboardingStep("draft_started");
    const bucket = sink.calls[0].props?.sampleBucket;
    expect([...storage.data.keys()]).toEqual(["rd-analytics:v1"]);

    vi.setSystemTime(new Date(START.getTime() + 5 * MINUTE));
    ({ a, sink } = await live()); // the page reloaded
    a.trackOnboardingStep("draft_started");
    a.trackEvent("special_discovered", CARD);
    expect(names(sink.calls)).toEqual(["special_discovered"]);
    expect(sink.calls[0].props?.sampleBucket).toBe(bucket);

    vi.setSystemTime(new Date(START.getTime() + 2 * 60 * MINUTE));
    ({ a, sink } = await live());
    a.trackEvent("special_discovered", CARD);
    expect(named(sink.calls, "session_started")[0].props).toMatchObject({ sessionNumber: 2, dayNumber: 1 });
  });

  it("a corrupt device record is replaced, never thrown", async () => {
    const storage = new MemoryStorage();
    storage.setItem("rd-analytics:v1", "{not json");
    vi.stubGlobal("window", { location: loc, localStorage: storage });
    const { a, sink } = await live();
    expect(() => a.trackEvent("special_discovered", CARD)).not.toThrow();
    expect(named(sink.calls, "session_started")[0].props).toMatchObject({ sessionNumber: 1 });
  });
});

describe("pageviews: once per route per session", () => {
  it("the first visit to each route is a $pageview with the common properties; a repeat is not", async () => {
    const { a, sink } = await live();
    for (const path of ["/", "/play", "/", "/play/", "/collection", "/play"]) {
      go(path);
      a.notePageview();
    }
    const views = named(sink.calls, "$pageview");
    expect(views).toHaveLength(3);
    expect(views[0].props).toMatchObject({ gameMode: "app", schemaVersion: 2, sampleWeight: 1 });
    expect(names(sink.calls)[0]).toBe("session_started");
  });

  it("a new session counts its routes again", async () => {
    const { a, sink } = await live();
    go("/play");
    a.notePageview();
    vi.setSystemTime(new Date(START.getTime() + 45 * MINUTE));
    a.notePageview();
    expect(named(sink.calls, "$pageview")).toHaveLength(2);
    expect(named(sink.calls, "session_started")).toHaveLength(2);
  });

  it("navigations made before the SDK is ready are replayed with their own URL and time", async () => {
    const a = await load("phc_test");
    go("/");
    a.notePageview();
    vi.setSystemTime(new Date(START.getTime() + 2000));
    go("/play");
    a.notePageview();
    const sink = fakeSink();
    a.connectAnalytics(sink);
    const views = named(sink.calls, "$pageview");
    expect(views.map((v) => v.props?.$pathname)).toEqual(["/", "/play"]);
    expect(views[1].props).toMatchObject({ $current_url: "https://rocketdraft.app/play" });
    expect(views[1].opts).toEqual({ timestamp: new Date(START.getTime() + 2000) });
  });

  it("career tabs are counted on every visit and handed to the next career event, then reset", async () => {
    const { a, sink } = await live();
    for (const path of ["/career", "/career/club", "/career", "/career/market", "/career/club", "/career/event", "/career/new"]) {
      go(path);
      a.notePageview();
    }
    a.noteCareerAdvance("day", 40);
    a.noteCareerAdvance("day", 300);
    expect(a.takeCareerActivity()).toEqual({ tab_hq: 2, tab_club: 2, tab_market: 1, advanceCount: 2, advanceMaxMs: 300, advanceSlowCount: 0 });
    expect(a.takeCareerActivity()).toEqual({});
    expect(named(sink.calls, "quality_slow_advance")).toHaveLength(0);
  });

  it("a slow advance is reported once per session and kind", async () => {
    const { a, sink } = await live();
    a.noteCareerAdvance("day", a.ANALYTICS_SLOW_ADVANCE_MS.day + 1);
    a.noteCareerAdvance("day", 4000);
    a.noteCareerAdvance("stop", a.ANALYTICS_SLOW_ADVANCE_MS.stop + 1);
    expect(named(sink.calls, "quality_slow_advance").map(own)).toEqual([
      { actionId: "slow_advance:day", kind: "day", ms: a.ANALYTICS_SLOW_ADVANCE_MS.day + 1 },
      { actionId: "slow_advance:stop", kind: "stop", ms: a.ANALYTICS_SLOW_ADVANCE_MS.stop + 1 },
    ]);
    expect(a.takeCareerActivity()).toMatchObject({ advanceCount: 3, advanceSlowCount: 3 });
  });
});

describe("the reset counter of the open run", () => {
  it("counts resets until the run ends, then starts over", async () => {
    const a = await load("phc_test");
    a.noteRunReset();
    a.noteRunReset();
    expect(a.takeRunResets()).toBe(2);
    expect(a.takeRunResets()).toBe(0);
  });
});

describe("screen errors", () => {
  it("the message loses quoted text, URLs and long numbers", async () => {
    const a = await load("phc_test");
    expect(a.sanitizeErrorMessage(`Unexpected token 'M', "Miguel FC" is not valid JSON`)).toBe("Unexpected token <text>, <text> is not valid JSON");
    expect(a.sanitizeErrorMessage("Failed to fetch https://example.com/a?b=1 after 123456 ms")).toBe("Failed to fetch <url> after <n> ms");
    expect(a.sanitizeErrorMessage("x".repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it("reports the error's name, route and cleaned message; the same error once; three per session at most", async () => {
    const { a, sink } = await live();
    go("/career/club");
    const boom = new TypeError(`Cannot read properties of undefined (reading 'squad')`);
    a.reportScreenError("boundary", boom);
    a.reportScreenError("boundary", boom);
    a.reportScreenError("promise", "plain string");
    a.reportScreenError("window", new RangeError("one"));
    a.reportScreenError("window", new RangeError("two"));
    const errors = named(sink.calls, "quality_error").map(own);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatchObject({ source: "boundary", name: "TypeError", route: "/career/club", message: "Cannot read properties of undefined (reading <text>)" });
    expect(errors[1]).toMatchObject({ source: "promise", name: "Error", message: "plain string" });
  });
});

describe("the budget guard, as wired in", () => {
  it("below the first threshold everything is sent, with weight 1", async () => {
    const { a, sink } = await live({ players: "500" });
    for (let i = 0; i < 120; i++) a.trackEvent("special_discovered", card(i));
    const sent = named(sink.calls, "special_discovered");
    expect(sent).toHaveLength(120);
    expect(new Set(sent.map((c) => c.props?.sampleWeight))).toEqual(new Set([1]));
    expect(named(sink.calls, "quality_event_cap")).toHaveLength(0);
  });

  it("above it, the device's daily cap thins standard events, the weights still add up, and the cap is noted once", async () => {
    const { a, sink } = await live({ players: "800" });
    let draws = 0;
    vi.spyOn(Math, "random").mockImplementation(() => (draws++ % 4) / 4); // exactly 1 in 4 passes
    for (let i = 0; i < 110; i++) a.trackEvent("special_discovered", card(i));
    const sent = named(sink.calls, "special_discovered");
    expect(sent).toHaveLength(30 + 20); // 30 in full, then 1 in 4 of the other 80
    expect(sent.reduce((total, c) => total + Number(c.props?.sampleWeight), 0)).toBe(110);
    expect(named(sink.calls, "quality_event_cap").map(own)).toEqual([{ kind: "cap", level: 1 }]);
    // Critical events are never capped.
    a.trackEvent("rank_up", { rankId: "gold", rankIndex: 3, xp: 900 });
    expect(named(sink.calls, "rank_up")).toHaveLength(1);
  });

  it("the cap is per UTC day", async () => {
    const { a, sink } = await live({ players: "800" });
    for (let i = 0; i < 40; i++) a.trackEvent("special_discovered", card(i));
    vi.setSystemTime(new Date(START.getTime() + 24 * 60 * MINUTE));
    for (let i = 40; i < 60; i++) a.trackEvent("special_discovered", card(i));
    const sent = named(sink.calls, "special_discovered");
    expect(sent.slice(-20).every((c) => c.props?.sampleWeight === 1)).toBe(true);
  });

  it("the budget file overrides the build's player count (and a broken file changes nothing)", async () => {
    const { a, sink } = await live();
    a.setAnalyticsBudget("garbage");
    a.setAnalyticsBudget({ playersPerDay: 800 });
    for (let i = 0; i < 40; i++) a.trackEvent("special_discovered", card(i));
    expect(named(sink.calls, "special_discovered").length).toBeLessThan(40);
  });

  it("the circuit breaker is always on: a runaway loop stops at the daily ceiling, noted once", async () => {
    const { a, sink } = await live();
    for (let i = 0; i < 700; i++) a.trackEvent("career_milestone", { careerId: "c", actionId: `loop:${i}`, seasonIndex: 0, kind: "backer" });
    expect(game(sink.calls).filter((c) => c.name === "career_milestone").length).toBeLessThanOrEqual(400);
    expect(named(sink.calls, "quality_event_cap").map(own)).toEqual([{ kind: "breaker", level: 0 }]);
  });
});
