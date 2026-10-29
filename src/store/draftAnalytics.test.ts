/**
 * OBS-01 — the Draft and the shared events (#145), through the REAL stores and
 * a fake sink: each fires once per saved action, with the catalogue's
 * properties, never on a reload / rehydrate, never on staging; plus the
 * quality events of the persist wrapper (`persistStorage.ts`).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { challenges, specialCards } from "@/data";
import { neededKinds, slotsForKind } from "@/engine/draft";
import { connectAnalytics, resetAnalyticsForTests } from "@/lib/analytics";
import { reportingJSONStorage } from "./persistStorage";

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

type Call = { name: string; props: Record<string, unknown> };

const storage = new MemoryStorage();
let runStore: typeof import("./runStore").useRunStore;
let profileStore: typeof import("./profileStore").useProfileStore;

beforeAll(async () => {
  vi.stubGlobal("window", { localStorage: storage });
  try {
    profileStore = (await import("./profileStore")).useProfileStore;
    runStore = (await import("./runStore")).useRunStore;
  } finally {
    vi.unstubAllGlobals();
  }
});

/** A production build on a host; returns the fake sink's calls. */
function deploy(host = "rocketdraft.app", build: { noindex?: string } = {}): Call[] {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_NOINDEX", build.noindex ?? "");
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", "");
  vi.stubGlobal("window", { location: { hostname: host, href: `https://${host}/play`, pathname: "/play" } });
  resetAnalyticsForTests();
  const calls: Call[] = [];
  connectAnalytics({ capture: (name, props) => void calls.push({ name, props: (props ?? {}) as Record<string, unknown> }) });
  return calls;
}

beforeEach(() => {
  profileStore.getState().resetAll();
  runStore.setState({ run: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetAnalyticsForTests();
});

const names = (calls: Call[]) => calls.map((c) => c.name);
const of = (calls: Call[], name: string) => calls.filter((c) => c.name === name);
const run = () => runStore.getState().run!;

/** Draft through the store: a needed card for a free slot, else any card, else a reroll. */
function draftThrough(): void {
  tryDraft();
  expect(run().phase).toBe("review");
}

function tryDraft(): boolean {
  for (let i = 0; i < 200 && run().phase === "draft"; i++) {
    const { draft } = run();
    const fits = (kind: Parameters<typeof slotsForKind>[0]) => slotsForKind(kind).some((s) => !draft.roster[s]);
    const cards = (draft.offer?.cards ?? []).filter((c) => c.availability === "available" && fits(c.kind));
    const need = neededKinds(draft.roster, draft.mode);
    const pick = cards.find((c) => need.includes(c.kind)) ?? cards[0];
    if (!pick) {
      runStore.getState().reroll();
      continue;
    }
    runStore.getState().pickCard(pick, slotsForKind(pick.kind).find((s) => !draft.roster[s])!);
  }
  return run().phase === "review";
}

function playToResults(): void {
  runStore.getState().startTournament();
  for (let i = 0; i < 40 && run().tournament!.stage !== "finished"; i++) runStore.getState().playRound();
  runStore.getState().finishRun();
  expect(run().phase).toBe("results");
}

describe("Draft runs", () => {
  it("a Classic run: started → tournament → completed, once each, one runId, the 2.0 properties", () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    draftThrough();
    playToResults();
    runStore.getState().finishRun(); // a second click: nothing
    const lifecycle = names(calls).filter((n) => n.startsWith("run_") || n === "tournament_started");
    expect(lifecycle).toEqual(["run_started", "tournament_started", "run_completed"]);
    const runId = run().runId;
    for (const c of calls.filter((x) => x.props.runId !== undefined)) expect(c.props.runId).toBe(runId);
    const [done] = of(calls, "run_completed");
    expect(done.props).toMatchObject({
      region: "worldwide",
      mode: "classic",
      dailyTemplate: null,
      gameMode: "draft",
      environment: "production",
      chemistryTier: run().results ? expect.any(String) : undefined,
    });
    expect(typeof done.props.chemistryPercent).toBe("number");
    expect(done.props.durationSec).toBeGreaterThanOrEqual(0);
    expect(of(calls, "tournament_started")[0].props.region).toBe("worldwide");
    for (const c of of(calls, "special_used")) expect(typeof c.props.isNew).toBe("boolean");
  });

  it("restart mid-draft abandons the old runId and starts a new one; clearing from results is no abandonment", () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "quick", difficulty: "normal", showOverall: true, regionLock: "EU" });
    const first = run().runId;
    runStore.getState().restartRun();
    const second = run().runId;
    expect(second).not.toBe(first);
    expect(calls.filter((c) => c.name.startsWith("run_")).map((c) => [c.name, c.props.runId, c.props.region])).toEqual([
      ["run_started", first, "EU"],
      ["run_abandoned", first, "EU"],
      ["run_started", second, "EU"],
    ]);
    expect(of(calls, "run_abandoned")[0].props.reason).toBe("restart");
    draftThrough();
    playToResults();
    runStore.getState().clearRun();
    expect(of(calls, "run_abandoned")).toHaveLength(1);
  });

  it("a daily run reports region 'daily' on every event and its template on completion", () => {
    const calls = deploy();
    runStore.getState().startDailyRun();
    const daily = run().daily!;
    draftThrough();
    playToResults();
    for (const c of calls.filter((x) => x.props.runId !== undefined && x.name !== "special_used")) {
      expect(c.props.region, c.name).toBe("daily");
    }
    expect(of(calls, "run_completed")[0].props.dailyTemplate).toBe(daily.templateId ?? null);
  });

  it("a challenge reports its stars (0–3) and the specials it collects as discovered, mode challenge", () => {
    const calls = deploy();
    const ch = challenges.find((c) => {
      runStore.getState().startChallenge(c.id);
      return tryDraft();
    });
    expect(ch, "a challenge the simple drafter can assemble").toBeTruthy();
    runStore.getState().startTournament();
    expect(run().phase).toBe("challenge");
    // Field a special the profile does not own, so the play collects it.
    const r = run();
    runStore.setState({ run: { ...r, challenge: { ...r.challenge!, user: { ...r.challenge!.user, specialIds: [specialCards[0].id] } } } });
    runStore.getState().playChallenge();
    runStore.getState().playChallenge(); // already played: nothing
    const played = of(calls, "challenge_played");
    expect(played).toHaveLength(1);
    expect(played[0].props.stars).toBeGreaterThanOrEqual(0);
    expect(played[0].props.stars).toBeLessThanOrEqual(3);
    const found = of(calls, "special_discovered").find((c) => c.props.specialId === specialCards[0].id);
    expect(found?.props).toMatchObject({ mode: "challenge", rarity: specialCards[0].rarity, national: false });
  });
});

describe("collection, tutorials, unlocks, duplicate grants", () => {
  it("special_discovered fires once per card, the first time; a cloud merge is silent", () => {
    const calls = deploy();
    const [a, b] = specialCards;
    profileStore.getState().collectSpecials([a.id], "classic");
    profileStore.getState().collectSpecials([a.id, b.id], "quick");
    expect(of(calls, "special_discovered").map((c) => [c.props.specialId, c.props.mode, c.props.rarity])).toEqual([
      [a.id, "classic", a.rarity],
      [b.id, "quick", b.rarity],
    ]);
    const data = Object.fromEntries(Object.entries(profileStore.getState()).filter(([, v]) => typeof v !== "function"));
    const durable = structuredClone(data) as { unlockedSpecials: Record<string, string> };
    durable.unlockedSpecials = { ...durable.unlockedSpecials, [specialCards[2].id]: new Date().toISOString() };
    profileStore.getState().hydrateDurable(durable as never);
    expect(profileStore.getState().unlockedSpecials[specialCards[2].id]).toBeDefined();
    expect(of(calls, "special_discovered")).toHaveLength(2);
  });

  it("special_used.isNew: owned before the run → false; never owned → true", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const owned = specialCards[0].id;
      vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
      profileStore.getState().collectSpecials([owned], "classic");
      vi.setSystemTime(new Date("2026-10-01T10:05:00.000Z"));
      const calls = deploy();
      runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
      draftThrough();
      const fresh = specialCards.find((s) => s.id !== owned && !profileStore.getState().unlockedSpecials[s.id])!.id;
      const withSpecial = (id: string) => {
        const r = run();
        const roster = { ...r.draft.roster, player1: { ...r.draft.roster.player1!, specialId: id } };
        runStore.setState({ run: { ...r, phase: "review", tournament: null, draft: { ...r.draft, roster } } });
      };
      withSpecial(owned);
      runStore.getState().startTournament();
      expect(of(calls, "special_used").find((c) => c.props.specialId === owned)?.props.isNew).toBe(false);
      withSpecial(fresh);
      runStore.getState().startTournament();
      expect(of(calls, "special_used").find((c) => c.props.specialId === fresh)?.props.isNew).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ux_tutorial: the tour reports where it closed, explainers count as completed, each once; the recap is no tutorial", () => {
    const calls = deploy();
    const p = profileStore.getState();
    p.markFlag("seenTutorial", { step: 2, outcome: "skipped" });
    p.markFlag("seenTutorial", { step: 4, outcome: "completed" });
    p.markFlag("seenHowToPlay");
    p.markFlag("seenSeasonRecap");
    expect(of(calls, "ux_tutorial").map((c) => [c.props.id, c.props.step, c.props.outcome])).toEqual([
      ["seenTutorial", 2, "skipped"],
      ["seenHowToPlay", 1, "completed"],
    ]);
  });

  it("ux_unlock_seen: each cosmetic the locker shows, once", () => {
    const calls = deploy();
    profileStore.getState().markCosmeticsSeen(["badge-a", "badge-b"]);
    profileStore.getState().markCosmeticsSeen(["badge-b", "badge-c"]);
    expect(of(calls, "ux_unlock_seen").map((c) => [c.props.kind, c.props.id])).toEqual([
      ["cosmetic", "badge-a"],
      ["cosmetic", "badge-b"],
      ["cosmetic", "badge-c"],
    ]);
  });

  it("quality_duplicate_reward: a second clear, or XP offered for stars already held", () => {
    const calls = deploy();
    const p = profileStore.getState();
    p.completeChallenge("ch-x", { xp: 100 });
    p.completeChallenge("ch-x", { xp: 100 });
    p.recordChallengeResult("ch-y", 1, 50, { xp: 50 });
    p.recordChallengeResult("ch-y", 1, 50, { xp: 50 });
    p.recordChallengeResult("ch-y", 1, 0, { xp: 50 }); // a replay that asks nothing: no report
    expect(of(calls, "quality_duplicate_reward").map((c) => [c.props.kind, c.props.id])).toEqual([
      ["challenge_clear", "ch-x"],
      ["challenge_stars", "ch-y"],
    ]);
  });
});

describe("reloads, staging and the persist wrapper", () => {
  it("rehydrating the run and the profile stores sends nothing", async () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    profileStore.getState().collectSpecials([specialCards[0].id], "classic");
    const sent = calls.length;
    await runStore.persist.rehydrate();
    await profileStore.persist.rehydrate();
    expect(calls).toHaveLength(sent);
  });

  it.each([
    ["the staging build", "rocketdraft.app", "1"],
    ["the staging host", "staging.rocketdraft.app", ""],
  ])("%s sends nothing", (_label, host, noindex) => {
    const calls = deploy(host, { noindex });
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    draftThrough();
    playToResults();
    profileStore.getState().markFlag("seenHowToPlay");
    expect(calls).toEqual([]);
  });

  it("quality_migration: each store's migrate reports its own persist version as toVersion", () => {
    const calls = deploy();
    const profileOpts = profileStore.persist.getOptions();
    profileOpts.migrate!({ xp: 10, runsCompleted: 0, wins: { easy: 0, normal: 0, hard: 0, legacy: 0 }, unlockedSpecials: {}, achievements: {}, runHistory: [] }, 11);
    const runOpts = runStore.persist.getOptions();
    runOpts.migrate!({ run: null }, 2);
    expect(of(calls, "quality_migration").map((c) => [c.props.store, c.props.fromVersion, c.props.toVersion])).toEqual([
      ["profile", 11, profileOpts.version],
      ["run", 2, runOpts.version],
    ]);
  });

  it("quality_save_error: a quota error reports once per session and still reaches the caller; a corrupt save reports parse", () => {
    const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
    const broken = new MemoryStorage();
    broken.setItem = () => {
      throw quota;
    };
    broken.data.set("k", "{not json");
    vi.stubGlobal("window", { localStorage: broken });
    const wrapped = reportingJSONStorage<unknown>("career")!;
    const calls = deploy();
    expect(() => wrapped.setItem("k", { state: {}, version: 3 })).toThrow(quota);
    expect(() => wrapped.setItem("k", { state: {}, version: 3 })).toThrow(quota);
    expect(() => wrapped.getItem("k")).toThrow(SyntaxError);
    expect(of(calls, "quality_save_error").map((c) => [c.props.store, c.props.kind, c.props.gameMode])).toEqual([
      ["career", "quota", "career"],
      ["career", "parse", "career"],
    ]);
  });

  it("the wrapper reads and writes exactly like zustand's JSON storage", () => {
    const mem = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: mem });
    const wrapped = reportingJSONStorage<{ a: number }>("settings")!;
    wrapped.setItem("x", { state: { a: 1 }, version: 0 });
    expect(mem.getItem("x")).toBe(JSON.stringify({ state: { a: 1 }, version: 0 }));
    expect(wrapped.getItem("x")).toEqual({ state: { a: 1 }, version: 0 });
    expect(wrapped.getItem("missing")).toBeNull();
    wrapped.removeItem("x");
    expect(mem.getItem("x")).toBeNull();
  });
});
