/**
 * E1 — the Season 1 achievements review: the migrate's SILENT backfill. A
 * veteran's lifetime totals pre-mark the new counter achievements (no XP, no
 * toast), the retired ids are pruned, and nothing a veteran has not earned
 * (secrets, run feats, Season systems) is credited.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { achievementById, achievements } from "@/data/catalog";

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

let migrate: (persisted: unknown, version: number) => unknown;
let toasts: typeof import("./achievementToastStore").useAchievementToasts;

// The persist middleware only mounts (and exposes `migrate`) with a storage in place.
beforeAll(async () => {
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: new MemoryStorage() });
  try {
    const store = (await import("./profileStore")).useProfileStore;
    toasts = (await import("./achievementToastStore")).useAchievementToasts;
    migrate = (store as unknown as { persist: { getOptions: () => { migrate: typeof migrate } } }).persist.getOptions().migrate;
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("E1 — the migrate's silent backfill", () => {

  const veteranSave = () => ({
    xp: 60_000,
    mmr: 1400,
    runsCompleted: 900,
    wins: { easy: 12, normal: 40, hard: 80, legacy: 30 },
    playoffAppearances: 700,
    podiums: 450,
    swissWinsTotal: 2400,
    gamesWon: 6000,
    goalsScored: 21000,
    legacyUnlocked: true,
    unlockedSpecials: {},
    achievements: { "ach-first-team": "2026-01-01T00:00:00.000Z", "ach-hattrick": "2026-01-01T00:00:00.000Z" },
    runHistory: [],
    dailyResults: Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10),
        { placement: i < 31 ? "champion" : "swiss_exit", xp: 100, label: "x" },
      ]),
    ),
    challengesCompleted: {},
    records: { bestOverall: { easy: 0, normal: 0, hard: 0, legacy: 0 }, bestOverallWorldwide: 0, bestOverallSam: 0 },
    settings: { lastDifficulty: "legacy", lastShowOverall: true, lastMode: "classic", lastRegionLock: null },
    flags: { seenHowToPlay: true, seenLegacyIntro: true, seenRegionalIntro: true, seenTutorial: true },
  });

  it("pre-marks the lifetime counters a veteran already satisfies, with no XP and no toast", () => {
    const before = toasts.getState().queue.length;
    const out = migrate(veteranSave(), 11) as { achievements: Record<string, string>; xp: number; lifetime: { xp: number } };
    for (const id of ["ach-hard-10", "ach-all-difficulties", "ach-podiums-100", "ach-daily-30", "ach-runs-500", "ach-titles-100", "ach-legacy-25"]) {
      expect(out.achievements[id], id).toBeTruthy();
    }
    // The Season 1 reset: Season XP starts at 0, and the backfill paid nothing.
    expect(out.xp).toBe(0);
    expect(out.lifetime.xp).toBe(60_000);
    expect(toasts.getState().queue.length).toBe(before);
  });

  it("drops the retired ids and backfills NO feat, secret or Season-system achievement", () => {
    const out = migrate(veteranSave(), 11) as { achievements: Record<string, string> };
    expect(out.achievements["ach-first-team"]).toBeTruthy();
    expect(out.achievements["ach-hattrick"]).toBeUndefined();
    const got = new Set(Object.keys(out.achievements));
    // No secret at all (a secret is a feat or the Creator card; none is a lifetime total here).
    expect(achievements.filter((a) => a.secret && got.has(a.id)).map((a) => a.id)).toEqual([]);
    for (const id of [
      // run feats
      "ach-double-hat-trick", "ach-final-comeback", "ach-giant-killer", "ach-lower-bracket-full", "ach-low-ovr-title", "ach-blind-title",
      // Season systems and the new Region-only counter: earned live, with their XP
      "ach-region-sweep", "ach-region-25", "ach-legacy-streak-2", "ach-legacy-streak-3",
      "ach-stars-45", "ach-stars-90", "ach-stars-all", "ach-quiz-streak-7", "ach-quiz-streak-30",
      "ach-login-7", "ach-login-30", "ach-missions-25", "ach-missions-100",
      "ach-rating-1000", "ach-daily-7", "ach-challenge-perfect", "ach-challenge-all",
    ]) {
      expect(got.has(id), id).toBe(false);
    }
    // Every backfilled id exists in the build.
    for (const id of got) expect(achievementById.has(id), id).toBe(true);
  });

  it("a veteran short of a threshold is not credited", () => {
    const save = { ...veteranSave(), wins: { easy: 0, normal: 40, hard: 9, legacy: 3 }, podiums: 99, dailyResults: {} };
    const out = migrate(save, 11) as { achievements: Record<string, string> };
    for (const id of ["ach-hard-10", "ach-all-difficulties", "ach-podiums-100", "ach-daily-30"]) {
      expect(out.achievements[id], id).toBeUndefined();
    }
  });
});
