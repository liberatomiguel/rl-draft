/**
 * PERSIST CONTRACT — players' progress lives ONLY in localStorage on
 * https://rocketdraft.app, so the zustand `persist` key + version of every
 * store are a contract with every existing save (DESIGN-DECISIONS #55.6).
 *
 * This suite runs in `prebuild` (`npm run test:contract`), so it fails
 * `npm run build` — and with it `npm run deploy` and every Workers Builds
 * deploy — when a refactor:
 *  - renames a key, or bumps a version (= every save goes through `migrate`),
 *  - sets a version > 0 without a `migrate` (zustand then logs an error, keeps
 *    the INITIAL state, and the next `set()` overwrites the save),
 *  - adds a second `persist(` writer for an existing key,
 *  - stops persisting a sacred profile field,
 *  - turns on `skipHydration` (hydration order: settings → profile → run at import),
 *  - breaks the profile `migrate` for an older save shape.
 *
 * Changing CONTRACT below is a deliberate act: it needs a DESIGN-DECISIONS entry
 * and an additive migrate that keeps xp / collection / achievements.
 *
 * Runs in node (vitest `environment: "node"`): zustand's default storage is
 * `createJSONStorage(() => window.localStorage)`, resolved ONCE when the store
 * is created — so the stores are imported while `window.localStorage` is an
 * in-memory Storage, which they keep using after `window` is unstubbed.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mmrBackfillFloor, SEASON_RATING } from "@/config/balance";
import { SEASON } from "@/config/season";
import { achievements, specialCards } from "@/data";

/** The frozen contract. `version: 0` = zustand's default (no `version` option). */
const CONTRACT = {
  settings: { name: "rocket-draft:settings:v1", version: 0 },
  // v12 = the v2.0 Season 1 reset (DESIGN-DECISIONS #110): pre-season xp/mmr are
  // archived into `legacy.preseason`, season fields reset, lifetime kept.
  profile: { name: "rocket-draft:profile:v1", version: 12 },
  run: { name: "rocket-draft:run:v1", version: 3 },
  career: { name: "rocket-draft:career:v1", version: 3 },
} as const;

type StoreKey = keyof typeof CONTRACT;

/** Profile fields that ARE a player's progress — must always reach storage. */
const SACRED_PROFILE_FIELDS = [
  "xp",
  "mmr",
  "legacyUnlocked",
  "runsCompleted",
  "wins",
  "playoffAppearances",
  "podiums",
  "swissWinsTotal",
  "gamesWon",
  "goalsScored",
  "unlockedSpecials",
  "achievements",
  "runHistory",
  "dailyResults",
  "challengesCompleted",
  "challengeStars",
  "records",
  "settings",
  "flags",
  // v2.0
  "season",
  "lifetime",
  "legacy",
  "grants",
  "cosmetics",
  "missions",
  "login",
  "events",
  "quiz",
];

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

const storage = new MemoryStorage();

type Stores = {
  settings: typeof import("./settingsStore").useSettings;
  profile: typeof import("./profileStore").useProfileStore;
  run: typeof import("./runStore").useRunStore;
  career: typeof import("./careerStore").useCareerStore;
};
let stores: Stores;

/** Minimal persist surface shared by every store (avoids a 4-way type union). */
interface PersistApi {
  getOptions: () => {
    name?: string;
    version?: number;
    migrate?: (persisted: unknown, version: number) => unknown;
    partialize?: (state: never) => unknown;
    skipHydration?: boolean;
  };
  rehydrate: () => Promise<void> | void;
}

function persistOf(key: StoreKey): PersistApi {
  const store = stores[key] as unknown as { persist?: PersistApi };
  if (!store.persist) throw new Error(`${key} store has no persist API (storage unavailable?)`);
  return store.persist;
}

beforeAll(async () => {
  // Evaluate browser-ish deps BEFORE `window` exists, so only the store modules
  // themselves see the stub.
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  try {
    stores = {
      settings: (await import("./settingsStore")).useSettings,
      profile: (await import("./profileStore")).useProfileStore,
      run: (await import("./runStore")).useRunStore,
      career: (await import("./careerStore")).useCareerStore,
    };
  } finally {
    vi.unstubAllGlobals();
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("persist contract (frozen)", () => {
  it.each(Object.keys(CONTRACT) as StoreKey[])("%s: storage key + version", (key) => {
    const options = persistOf(key).getOptions();
    expect({ name: options.name, version: options.version }).toStrictEqual(CONTRACT[key]);
  });

  it.each(Object.keys(CONTRACT) as StoreKey[])(
    "%s: any version > 0 ships a migrate",
    (key) => {
      const options = persistOf(key).getOptions();
      if ((options.version ?? 0) > 0) expect(typeof options.migrate).toBe("function");
    },
  );

  it.each(Object.keys(CONTRACT) as StoreKey[])("%s: hydrates at import (no skipHydration)", (key) => {
    expect(persistOf(key).getOptions().skipHydration).toBeFalsy();
  });

  it("settings: never versioned, so it has no migrate — bumping it needs one first", () => {
    const options = persistOf("settings").getOptions();
    expect(options.version).toBe(0);
    expect(options.migrate).toBeUndefined();
  });

  it("one persist writer per key, and every persisted key is in the contract", () => {
    const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const writers = new Map<string, string[]>();
    for (const rel of readdirSync(srcDir, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
      const file = join(srcDir, rel);
      const text = readFileSync(file, "utf8");
      for (const [, name] of text.matchAll(/\bname:\s*["'](rocket-draft:[^"']+)["']/g)) {
        writers.set(name, [...(writers.get(name) ?? []), relative(srcDir, file)]);
      }
    }
    const expected = Object.values(CONTRACT).map((c) => c.name).sort();
    expect([...writers.keys()].sort()).toStrictEqual(expected);
    for (const [name, files] of writers) expect(files, name).toHaveLength(1);
  });

  // v2.0 (DESIGN-DECISIONS #118 / career R32): the career store also persists
  // `achievements` (permanent, cross-save). Additive — version stays 3.
  it("partialize: run persists only { run }, career only { slots, activeSlot, achievements }", () => {
    const runPart = persistOf("run").getOptions().partialize!(stores.run.getState() as never);
    expect(Object.keys(runPart as object).sort()).toStrictEqual(["run"]);
    const careerPart = persistOf("career").getOptions().partialize!(
      stores.career.getState() as never,
    );
    expect(Object.keys(careerPart as object).sort()).toStrictEqual(["achievements", "activeSlot", "slots"]);
  });

  it("profile: every sacred progress field is persisted", () => {
    const part = persistOf("profile").getOptions().partialize!(
      stores.profile.getState() as never,
    );
    const persistedKeys = Object.keys(JSON.parse(JSON.stringify(part)) as object);
    expect(persistedKeys).toEqual(expect.arrayContaining(SACRED_PROFILE_FIELDS));
  });

  it("settings: every preference is persisted", () => {
    const part = persistOf("settings").getOptions().partialize!(
      stores.settings.getState() as never,
    );
    const persistedKeys = Object.keys(JSON.parse(JSON.stringify(part)) as object);
    expect(persistedKeys).toEqual(
      expect.arrayContaining(["soundEnabled", "soundVolume", "reduceEffects", "animSpeed", "lang"]),
    );
  });
});

// ---------------------------------------------------------------------------
// Migration / hydration behaviour on old and current saves
// ---------------------------------------------------------------------------

const DATE = "2025-06-12T10:00:00.000Z";
const GHOST_SPECIAL = "sp-__removed-from-the-dataset__";

/** The oldest profile shape (v1, v0.1.0): no counters, daily, records, settings or flags. */
function oldProfile() {
  return {
    xp: 4321,
    runsCompleted: 12,
    wins: { easy: 2, normal: 3, hard: 1, legacy: 0 },
    unlockedSpecials: { [specialCards[0].id]: DATE, [GHOST_SPECIAL]: DATE },
    achievements: { [achievements[0].id]: DATE },
    runHistory: [],
  };
}

function rawSave(state: unknown, version: number): string {
  return JSON.stringify({ state, version });
}

describe("profile migrate (old saves keep their progress)", () => {
  beforeEach(() => {
    stores.profile.setState(stores.profile.getInitialState(), true);
    storage.clear();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])(
    "migrate(v%i save) archives the pre-season, resets the season, keeps the rest",
    (fromVersion) => {
      const migrate = persistOf("profile").getOptions().migrate!;
      let out: Record<string, unknown> = {};
      expect(() => {
        out = migrate(structuredClone(oldProfile()), fromVersion) as Record<string, unknown>;
      }).not.toThrow();
      const old = oldProfile();
      // Lifetime progress is untouched.
      expect(out.runsCompleted).toBe(old.runsCompleted);
      expect(out.wins).toStrictEqual(old.wins);
      // Real specials survive; ids no longer in specialCards.json are pruned (by design).
      expect(out.unlockedSpecials).toStrictEqual({ [specialCards[0].id]: DATE });
      // Earned achievements survive (the migrate may silently ADD satisfied counters).
      expect(out.achievements).toMatchObject(old.achievements);
      // v12 (Season 1 reset): the pre-season is ARCHIVED, the season fields reset.
      expect(out.xp).toBe(0);
      expect(out.mmr).toBe(SEASON_RATING.start);
      expect(out.lifetime).toStrictEqual({ xp: old.xp });
      expect(out.season).toMatchObject({ id: SEASON.id, runs: 0, titles: 0, peakMmr: SEASON_RATING.start });
      expect(out.legacy).toMatchObject({
        preseason: {
          xp: old.xp,
          rankId: "gold",
          runsCompleted: old.runsCompleted,
          titles: 6,
          position: null,
          // pre-v11 saves get the title-history backfill (the v11 correction)
          mmr: mmrBackfillFloor(old.wins),
        },
      });
      expect(out.challengesCompleted).toStrictEqual({}); // Challenges restart in v2.0
      // The legacy rewards are derived at migration time (no sync needed): First
      // Chapter (title + badge) and the peak-rank badges up to Gold (rc.20: cumulative).
      expect(Object.keys((out.cosmetics as { owned: Record<string, string> }).owned)).toEqual(
        expect.arrayContaining(["legacy-title-first-chapter", "first-chapter", "pre-season-gold", "pre-season-silver", "legacy-title-ps-gold"]),
      );
      // New fields are backfilled, not missing.
      expect(out).toMatchObject({
        dailyResults: expect.any(Object),
        records: expect.any(Object),
        settings: expect.objectContaining({ lastDifficulty: expect.any(String) }),
        flags: expect.objectContaining({ seenTutorial: expect.any(Boolean) }),
        grants: [],
        legacyUnlocked: true, // a Hard title keeps Legacy open
      });
    },
  );

  it("migrate(v11 save) keeps a live-earned MMR above the backfill in the snapshot", () => {
    const migrate = persistOf("profile").getOptions().migrate!;
    const v11 = { ...oldProfile(), mmr: 1575, challengesCompleted: { "ch-first-final": DATE } };
    const out = migrate(structuredClone(v11), 11) as Record<string, unknown>;
    expect(out.legacy).toMatchObject({ preseason: { mmr: 1575, challengesCleared: 1 } });
    expect(out.challengesCompleted).toStrictEqual({});
  });

  it("hydrating a v1 save end-to-end migrates it and writes it back as v12", async () => {
    storage.setItem(CONTRACT.profile.name, rawSave(oldProfile(), 1));
    await persistOf("profile").rehydrate();

    const state = stores.profile.getState();
    expect(state.xp).toBe(0);
    expect(state.lifetime.xp).toBe(4321);
    expect(state.legacy.preseason?.xp).toBe(4321);
    expect(state.unlockedSpecials).toStrictEqual({ [specialCards[0].id]: DATE });
    expect(state.achievements).toMatchObject({ [achievements[0].id]: DATE });

    const written = JSON.parse(storage.getItem(CONTRACT.profile.name)!);
    expect(written.version).toBe(CONTRACT.profile.version);
    expect(written.state.xp).toBe(0);
    expect(written.state.legacy.preseason.xp).toBe(4321);
    expect(written.state.unlockedSpecials).toStrictEqual({ [specialCards[0].id]: DATE });
  });

  it("hydrating a current-version save changes nothing and never writes back", async () => {
    const migrate = persistOf("profile").getOptions().migrate!;
    const current = JSON.parse(JSON.stringify(migrate(oldProfile(), 1)));
    const raw = rawSave(current, CONTRACT.profile.version);
    storage.setItem(CONTRACT.profile.name, raw);
    const setItem = vi.spyOn(storage, "setItem");
    try {
      await persistOf("profile").rehydrate();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
    expect(storage.getItem(CONTRACT.profile.name)).toBe(raw);
    expect(stores.profile.getState().xp).toBe(0); // season xp after the v12 reset
    expect(stores.profile.getState().legacy.preseason?.xp).toBe(4321);
  });
});

describe("run / settings / career hydration", () => {
  beforeEach(() => storage.clear());

  it("run: a pre-v3 run is discarded (shape changed), a v3 run is kept as-is", () => {
    const migrate = persistOf("run").getOptions().migrate!;
    expect(migrate({ run: { id: "old" } }, 2)).toStrictEqual({ run: null });
    const v3 = { run: null };
    expect(migrate(v3, 3)).toBe(v3);
  });

  it("settings: a saved language/sound survives hydration untouched", async () => {
    const saved = {
      soundEnabled: false,
      soundVolume: 0.25,
      reducedMotion: true, // pre-rc.4 key (the switch is gone): still hydrates harmlessly
      animSpeed: "fast",
      lang: "pt",
    };
    const raw = rawSave(saved, 0);
    storage.setItem(CONTRACT.settings.name, raw);
    await persistOf("settings").rehydrate();
    expect(stores.settings.getState()).toMatchObject(saved);
    expect(storage.getItem(CONTRACT.settings.name)).toBe(raw);
  });

  it("career: migrate keeps the slot array (empty slots stay empty)", () => {
    const migrate = persistOf("career").getOptions().migrate!;
    const out = migrate({ slots: [null, null, null], activeSlot: null }, 1) as {
      slots: unknown[];
      activeSlot: unknown;
    };
    expect(out.slots).toStrictEqual([null, null, null]);
    expect(out.activeSlot).toBeNull();
  });

  // v2.0 (R40): the weekend-calendar step (migrateSaveToV4) is gated by each
  // save's own saveVersion — the persist version stays 3 — so it must run on
  // BOTH paths: `migrate` (older store) and the same-version rehydrate.
  it("career: a saveVersion-3 slot is upgraded to 4 by migrate AND by a same-version rehydrate", async () => {
    const { createCareerSave } = await import("./careerFlow");
    const legacySlot = () => {
      const slot = createCareerSave(
        {
          identity: {
            orgName: "Contract Org",
            abbrev: "CTR",
            managerName: "Bot",
            country: "BR",
            region: "SAM",
            crestId: "shield",
            colors: { primary: "#f97316", secondary: "#fde68a" },
            buffType: "consistency",
          },
          difficulty: "normal",
          style: "balanced",
          rosterKey: "balanced",
        },
        4242,
      );
      return { ...JSON.parse(JSON.stringify(slot)), saveVersion: 3 };
    };
    const migrate = persistOf("career").getOptions().migrate!;
    const out = migrate({ slots: [legacySlot(), null, null], activeSlot: 0 }, 2) as {
      slots: ({ saveVersion: number } | null)[];
    };
    expect(out.slots[0]?.saveVersion).toBe(4);

    storage.setItem(
      CONTRACT.career.name,
      rawSave({ slots: [legacySlot(), null, null], activeSlot: 0 }, CONTRACT.career.version),
    );
    await persistOf("career").rehydrate();
    expect(stores.career.getState().slots[0]?.saveVersion).toBe(4);
  });
});
