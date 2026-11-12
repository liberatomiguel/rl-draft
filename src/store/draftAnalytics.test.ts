/**
 * OBS-01 — the Draft, progression and shared events (#145, the 2.0 catalogue),
 * through the REAL stores and a fake sink: ONE event per run (resets are a
 * counter, no start / tournament / per-special events), each fired once per
 * saved action, never on a reload / rehydrate, never on staging; plus the
 * quality events of the persist wrapper (`persistStorage.ts`). Every payload
 * the sink receives is checked against the catalogue.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { achievements, challenges, specialCards } from "@/data";
import { neededKinds, slotsForKind } from "@/engine/draft";
import { rankForXp } from "@/engine/progression";
import { quizForDate } from "@/engine/quiz";
import { connectAnalytics, notePageview, resetAnalyticsForTests } from "@/lib/analytics";
import { catalogProblems, EVENT_CATALOG, isCatalogEvent } from "@/lib/analyticsCatalog";
import { todayKey } from "@/lib/dailyPlan";
import { profileHistory, profileProgressEvents, UNLOCK_BATCH_FROM, type ProfileAnalyticsView } from "./profileAnalytics";
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
  connectAnalytics({
    capture: (name, props) => {
      const all = (props ?? {}) as Record<string, unknown>;
      calls.push({ name, props: all });
      if (!name.startsWith("$")) violations.push(...catalogProblems(name, ownProps(name, all)));
    },
  });
  return calls;
}

/** Common properties, added by the analytics layer to every event. */
const COMMON = ["release", "balanceVersion", "schemaVersion", "season", "environment", "locale", "gameMode", "sampleWeight", "sampleBucket"];
/** The event's own properties (a shared event lists `gameMode` itself). */
function ownProps(name: string, all: Record<string, unknown>): Record<string, unknown> {
  const listed = isCatalogEvent(name) ? Object.keys(EVENT_CATALOG[name].props) : [];
  return Object.fromEntries(Object.entries(all).filter(([key]) => listed.includes(key) || !COMMON.includes(key)));
}
/** Catalogue problems of anything the sink received (asserted empty after every test). */
const violations: string[] = [];

beforeEach(() => {
  profileStore.getState().resetAll();
  runStore.setState({ run: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetAnalyticsForTests();
  const problems = violations.splice(0);
  expect(problems, "every event sent matches the analytics catalogue").toEqual([]);
});

const names = (calls: Call[]) => calls.map((c) => c.name);
const steps = (calls: Call[]) => of(calls, "onboarding_step").map((c) => c.props.step);
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

describe("Draft runs: one event per run", () => {
  it("a Classic run sends ONE run_completed carrying the run — no start, tournament or per-special events", () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    draftThrough();
    playToResults();
    runStore.getState().finishRun(); // a second click: nothing
    for (const gone of ["run_started", "tournament_started", "special_used", "run_abandoned"]) expect(of(calls, gone), gone).toHaveLength(0);
    const done = of(calls, "run_completed");
    expect(done).toHaveLength(1);
    const after = profileStore.getState();
    expect(done[0].props).toMatchObject({
      runId: run().runId,
      region: "worldwide",
      mode: "classic",
      difficulty: "easy",
      dailyTemplate: null,
      gameMode: "draft",
      environment: "production",
      resets: 0,
      placement: run().results!.placement,
      xpGained: run().results!.xp.total,
      ratingAfter: after.mmr,
      rankId: rankForXp(after.xp).id,
    });
    expect(String(done[0].props.picks)).toMatch(/^p1:[^|]+\|p2:[^|]+\|p3:[^|]+/);
    expect(done[0].props.specialsCount).toBe(String(done[0].props.specials).split("|").filter(Boolean).length);
    expect(done[0].props.durationSec).toBeGreaterThanOrEqual(0);
    // The entry funnel: each first, once.
    expect(steps(calls)).toEqual(["draft_started", "draft_confirmed", "run_completed"]);
    expect(names(calls)[0]).toBe("session_started");
  });

  it("a restart mid-run is a counter on the run's event, not an event; play-again starts the count over", () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "quick", difficulty: "normal", showOverall: true, regionLock: "EU" });
    const first = run().runId;
    runStore.getState().restartRun();
    runStore.getState().restartRun();
    expect(run().runId).not.toBe(first);
    expect(calls.filter((c) => c.name.startsWith("run_"))).toEqual([]);
    draftThrough();
    playToResults();
    expect(of(calls, "run_completed").map((c) => [c.props.runId, c.props.region, c.props.resets])).toEqual([[run().runId, "EU", 2]]);

    runStore.getState().restartRun(); // from results: play again
    draftThrough();
    playToResults();
    expect(of(calls, "run_completed")[1].props.resets).toBe(0);
    runStore.getState().clearRun(); // leaving the results screen is no abandonment
    expect(of(calls, "run_abandoned")).toHaveLength(0);
    expect(steps(calls)).toEqual(["draft_started", "draft_confirmed", "run_completed"]);
  });

  it("leaving a run for good is run_abandoned, with its resets, phase and picks made", () => {
    const calls = deploy();
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: false });
    runStore.getState().restartRun();
    const { draft } = run();
    const pick = draft.offer!.cards.find((c) => c.availability === "available")!;
    runStore.getState().pickCard(pick, slotsForKind(pick.kind).find((slot) => !draft.roster[slot])!);
    const runId = run().runId;
    runStore.getState().clearRun();
    expect(of(calls, "run_abandoned").map((c) => c.props)).toEqual([
      expect.objectContaining({ runId, mode: "classic", phase: "draft", reason: "quit", hiddenOverall: true, region: "worldwide", resets: 1, picksMade: 1 }),
    ]);
    // The next run starts with a clean counter.
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    runStore.getState().clearRun();
    expect(of(calls, "run_abandoned")[1].props).toMatchObject({ resets: 0, picksMade: 0 });
  });

  it("a daily run reports region 'daily' and its template", () => {
    const calls = deploy();
    runStore.getState().startDailyRun();
    const daily = run().daily!;
    draftThrough();
    playToResults();
    expect(of(calls, "run_completed")[0].props).toMatchObject({ mode: "daily", region: "daily", dailyTemplate: daily.templateId ?? null });
  });

  it("a challenge is ONE challenge_played with its stars and team; leaving its result screen is no abandonment", () => {
    const calls = deploy();
    profileStore.setState({ xp: 60_000 });
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
    expect(played[0].props).toMatchObject({ challengeId: ch!.id, kind: ch!.kind ?? "boss", specials: specialCards[0].id, cleared: run().challenge!.cleared });
    expect(played[0].props.stars).toBeGreaterThanOrEqual(0);
    expect(played[0].props.stars).toBeLessThanOrEqual(3);
    expect(String(played[0].props.picks)).toContain("p1:");
    const found = of(calls, "special_discovered").find((c) => c.props.specialId === specialCards[0].id);
    expect(found?.props).toMatchObject({ mode: "challenge", rarity: specialCards[0].rarity, national: false });
    runStore.getState().clearRun();
    expect(of(calls, "run_abandoned")).toHaveLength(0);
    expect(steps(calls)).toContain("challenge_played");
  });
});

describe("collection, progression, quiz, duplicate grants", () => {
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
    const durable = structuredClone(data) as { unlockedSpecials: Record<string, string>; xp: number; achievements: Record<string, string> };
    durable.unlockedSpecials = { ...durable.unlockedSpecials, [specialCards[2].id]: new Date().toISOString() };
    durable.xp = 900_000;
    durable.achievements = { ...durable.achievements, [achievements[0].id]: new Date().toISOString() };
    const before = calls.length;
    profileStore.getState().hydrateDurable(durable as never);
    expect(profileStore.getState().unlockedSpecials[specialCards[2].id]).toBeDefined();
    expect(calls.slice(before)).toEqual([]); // no discovery, no rank-up, no achievement from a merge
  });

  it("run_completed.specialsNew: a special owned before the run is not new; one never owned is", () => {
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
      const r = run();
      const roster = {
        ...r.draft.roster,
        player1: { ...r.draft.roster.player1!, specialId: owned },
        player2: { ...r.draft.roster.player2!, specialId: fresh },
      };
      runStore.setState({ run: { ...r, draft: { ...r.draft, roster } } });
      playToResults();
      expect(of(calls, "run_completed")[0].props).toMatchObject({ specials: `${owned}|${fresh}`, specialsCount: 2, specialsNew: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rank-ups and achievements are read off the profile write, whoever granted the XP", () => {
    const calls = deploy();
    const before = rankForXp(profileStore.getState().xp);
    profileStore.getState().grantXp(60_000);
    const after = rankForXp(profileStore.getState().xp);
    expect(after.index).toBeGreaterThan(before.index);
    expect(of(calls, "rank_up").map((c) => c.props)).toEqual([
      expect.objectContaining({ rankId: after.id, rankIndex: after.index, xp: profileStore.getState().xp }),
    ]);
    profileStore.getState().grantXp(1); // same rank: nothing
    expect(of(calls, "rank_up")).toHaveLength(1);

    const [first, second] = achievements;
    profileStore.getState().awardAchievements([first.id]);
    profileStore.getState().awardAchievements([first.id, second.id]);
    expect(of(calls, "achievement_unlocked").map((c) => c.props.id)).toEqual([first.id, second.id]);
  });

  it("unlocks: each new cosmetic is an event; a catalog-sized batch is one; opening Legacy is one", () => {
    const view = (owned: string[], extra: Partial<ProfileAnalyticsView> = {}): ProfileAnalyticsView => ({
      xp: 0,
      mmr: 1000,
      runsCompleted: 0,
      achievements: {},
      unlockedSpecials: {},
      challengesCompleted: {},
      cosmetics: { owned: Object.fromEntries(owned.map((id) => [id, "2026-11-12"])) },
      ...extra,
    });
    expect(profileProgressEvents(view(["a"]), view(["a", "b", "c"])).map((e) => e.props)).toEqual([
      { kind: "cosmetic", id: "b", count: 1 },
      { kind: "cosmetic", id: "c", count: 1 },
    ]);
    const many = Array.from({ length: UNLOCK_BATCH_FROM + 3 }, (_, i) => `badge-${i}`);
    expect(profileProgressEvents(view([]), view(many)).map((e) => e.props)).toEqual([
      { kind: "cosmetic_batch", id: "batch", count: many.length },
    ]);
    expect(profileProgressEvents(view([]), view([], { legacyUnlocked: true })).map((e) => e.props)).toEqual([
      { kind: "mode", id: "legacy", count: 1 },
    ]);
    const same = view(["a"]);
    expect(profileProgressEvents(same, same)).toEqual([]);
  });

  it("the daily quiz is one quiz_played when it ends, never per guess", () => {
    const calls = deploy();
    notePageview(); // the page load: the device is counted before anything is played
    const puzzle = quizForDate(todayKey());
    profileStore.getState().guessQuiz(puzzle, null, "miss-1");
    expect(of(calls, "quiz_played")).toHaveLength(0);
    const out = profileStore.getState().guessQuiz(puzzle, puzzle.playerId, "answer");
    profileStore.getState().guessQuiz(puzzle, puzzle.playerId, "late");
    expect(of(calls, "quiz_played").map((c) => c.props)).toEqual([
      expect.objectContaining({ solved: true, attempts: 2, xp: out.xp, streak: profileStore.getState().quiz.streak }),
    ]);
    expect(of(calls, "quiz_played")[0].props.maxAttempts).toBeGreaterThanOrEqual(2);
    expect(steps(calls)).toEqual(["quiz_played"]);
  });

  it("albums: a national team seen for the first time is a collection_milestone, once", () => {
    const calls = deploy();
    expect(profileStore.getState().discoverNationalTeam("nt-test", ["nt-card-1"])).toBe(true);
    expect(profileStore.getState().discoverNationalTeam("nt-test", ["nt-card-1"])).toBe(false);
    expect(of(calls, "collection_milestone").map((c) => [c.props.kind, c.props.id])).toEqual([["national_team_found", "nt-test"]]);
  });

  it("tutorials and the locker's seen marks send nothing (cut from the 2.0 catalogue)", () => {
    const calls = deploy();
    const p = profileStore.getState();
    p.markFlag("seenTutorial", { step: 2, outcome: "skipped" });
    p.markFlag("seenHowToPlay");
    p.markCosmeticsSeen(["badge-a", "badge-b"]);
    expect(calls).toEqual([]);
  });

  it("session_started carries the profile's snapshot; a pre-2.0 player is flagged and skips the firsts already done", () => {
    profileStore.setState({ xp: 4200, runsCompleted: 12, unlockedSpecials: { [specialCards[0].id]: "2026-09-01T00:00:00.000Z" } });
    const calls = deploy();
    runStore.getState().startRun({ mode: "classic", difficulty: "easy", showOverall: true });
    profileStore.getState().collectSpecials([specialCards[1].id], "classic");
    const [session] = of(calls, "session_started");
    expect(session.props).toMatchObject({
      sessionNumber: 1,
      dayNumber: 1,
      existingPlayer: true,
      xp: 4200,
      runsCompleted: 12,
      specialsOwned: 1,
      rankId: rankForXp(4200).id,
      entryPath: "/play",
      gameMode: "app",
    });
    expect(steps(calls)).toEqual([]); // draft_started was already true for this profile
    expect(profileHistory({ xp: 0, mmr: 1000, runsCompleted: 0, achievements: {}, unlockedSpecials: {}, challengesCompleted: {} })).toEqual({
      existing: false,
      doneSteps: [],
    });
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

  it("quality_migration: each store's migrate reports its own persist version as toVersion", async () => {
    const calls = deploy();
    const profileOpts = profileStore.persist.getOptions();
    profileOpts.migrate!({ xp: 10, runsCompleted: 0, wins: { easy: 0, normal: 0, hard: 0, legacy: 0 }, unlockedSpecials: {}, achievements: {}, runHistory: [] }, 11);
    const runOpts = runStore.persist.getOptions();
    runOpts.migrate!({ run: null }, 2);
    // rc.54: nothing is sent from inside the migrate (the store is still loading,
    // so a session opened here would carry no profile); the report follows it.
    expect(of(calls, "quality_migration")).toEqual([]);
    await Promise.resolve();
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
