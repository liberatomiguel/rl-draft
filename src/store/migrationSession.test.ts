/**
 * rc.54: the visit on which a returning player's save migrates (every pre-season
 * player's first visit to v2.0) opens its analytics session WITH the profile.
 *
 * The migrate runs while the profile store is being created, before the store
 * has told analytics what a session carries. Reporting `quality_migration` from
 * inside it opened the session too early: `session_started` went out with
 * `existingPlayer: null` for the whole launch cohort. The report is deferred to
 * a microtask now (persistStorage.ts), so the store finishes loading first.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("a pre-season save opening v2.0 in production", () => {
  it("session_started carries the returning player's profile; the migration is reported after it", async () => {
    vi.resetModules();
    const storage = new MemoryStorage();
    storage.setItem(
      "rocket-draft:profile:v1",
      JSON.stringify({
        version: 11,
        state: {
          xp: 70_000,
          mmr: 1500,
          runsCompleted: 300,
          wins: { easy: 5, normal: 20, hard: 40, legacy: 60 },
          unlockedSpecials: {},
          achievements: {},
          runHistory: [],
        },
      }),
    );
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "");
    vi.stubEnv("NEXT_PUBLIC_PLAYTEST", "");
    vi.stubGlobal("window", {
      localStorage: storage,
      location: { hostname: "rocketdraft.app", href: "https://rocketdraft.app/", pathname: "/" },
    });

    const analytics = await import("@/lib/analytics");
    analytics.resetAnalyticsForTests();
    const calls: { name: string; props: Record<string, unknown> }[] = [];
    analytics.connectAnalytics({
      capture: (name, props) => {
        calls.push({ name, props: (props ?? {}) as Record<string, unknown> });
      },
    });

    const { useProfileStore } = await import("./profileStore");
    await Promise.resolve();
    await Promise.resolve();

    // The save did migrate (Season 1 reset, pre-season archived).
    expect(useProfileStore.getState().xp).toBe(0);
    expect(useProfileStore.getState().legacy.preseason?.xp).toBe(70_000);

    const names = calls.map((c) => c.name).filter((n) => !n.startsWith("$"));
    expect(names).toContain("quality_migration");
    const session = calls.find((c) => c.name === "session_started");
    expect(session, `events sent: ${names.join(", ")}`).toBeDefined();
    expect(session!.props.existingPlayer).toBe(true);
    const migration = calls.find((c) => c.name === "quality_migration")!;
    expect(migration.props).toMatchObject({ store: "profile", fromVersion: 11, toVersion: 12 });
  });
});
