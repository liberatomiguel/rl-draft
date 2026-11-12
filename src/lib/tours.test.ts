/**
 * rc.54: every guided tour is shown ONCE after the Season 1 reset, to a new
 * player and to a pre-season veteran alike, and never again. The marker is
 * `profile.tours` (tour id → the season it was seen in); the older one-shot
 * flags never suppress a tour. Checked on the pure helpers and through the
 * REAL profile store (migrate, persist, cloud merge).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SEASON } from "@/config/season";
import { careerTourId, DRAFT_TOUR, tourSeen, TOURS_REARMED_IN, withTourSeen } from "./tours";

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

const PROFILE_KEY = "rocket-draft:profile:v1";
const storage = new MemoryStorage();
let profile: typeof import("@/store/profileStore").useProfileStore;
let toDurable: typeof import("./profileSync").toDurable;

beforeAll(async () => {
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  try {
    profile = (await import("@/store/profileStore")).useProfileStore;
    toDurable = (await import("./profileSync")).toDurable;
  } finally {
    vi.unstubAllGlobals();
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("tourSeen (pure)", () => {
  it("nothing seen without a marker", () => {
    expect(tourSeen(undefined, DRAFT_TOUR)).toBe(false);
    expect(tourSeen(null, DRAFT_TOUR)).toBe(false);
    expect(tourSeen({}, DRAFT_TOUR)).toBe(false);
  });

  it("the marker carries the current season, and one tour never covers another", () => {
    const tours = withTourSeen(undefined, DRAFT_TOUR);
    expect(tours).toStrictEqual({ [DRAFT_TOUR]: SEASON.id });
    expect(tourSeen(tours, DRAFT_TOUR)).toBe(true);
    expect(tourSeen(tours, careerTourId("hub"))).toBe(false);
    const both = withTourSeen(tours, careerTourId("hub"));
    expect(tourSeen(both, DRAFT_TOUR)).toBe(true);
    expect(tourSeen(both, careerTourId("hub"))).toBe(true);
    expect(tours).toStrictEqual({ [DRAFT_TOUR]: SEASON.id }); // not mutated
  });

  it("a marker from before the season that re-armed the tours does not count; a later one does", () => {
    expect(tourSeen({ [DRAFT_TOUR]: TOURS_REARMED_IN - 1 }, DRAFT_TOUR)).toBe(false);
    expect(tourSeen({ [DRAFT_TOUR]: TOURS_REARMED_IN }, DRAFT_TOUR)).toBe(true);
    expect(tourSeen({ [DRAFT_TOUR]: TOURS_REARMED_IN + 3 }, DRAFT_TOUR)).toBe(true);
    // The current season is at or past the re-arm, or nobody could ever dismiss a tour.
    expect(SEASON.id).toBeGreaterThanOrEqual(TOURS_REARMED_IN);
  });

  it("garbage in the marker is not 'seen'", () => {
    expect(tourSeen({ [DRAFT_TOUR]: true as unknown as number }, DRAFT_TOUR)).toBe(false);
    expect(tourSeen({ [DRAFT_TOUR]: "1" as unknown as number }, DRAFT_TOUR)).toBe(false);
  });
});

describe("once per season, through the profile store", () => {
  beforeEach(() => {
    profile.setState(profile.getInitialState(), true);
    storage.clear();
  });

  /** A pre-season veteran's save: every old one-shot flag already set, no `tours`. */
  const veteranSave = (version: number) =>
    JSON.stringify({
      version,
      state: {
        xp: 4321,
        runsCompleted: 40,
        wins: { easy: 2, normal: 3, hard: 1, legacy: 0 },
        unlockedSpecials: {},
        achievements: {},
        runHistory: [],
        flags: {
          seenHowToPlay: true,
          seenLegacyIntro: true,
          seenRegionalIntro: true,
          seenTutorial: true,
          seenSeasonRecap: true,
          seenDraftTour: true,
        },
      },
    });

  it("a new player has seen no tour", () => {
    const state = profile.getState();
    expect(tourSeen(state.tours, DRAFT_TOUR)).toBe(false);
    expect(tourSeen(state.tours, careerTourId("hub"))).toBe(false);
  });

  it.each([11, 12])("a veteran (v%i save, every old flag set) still gets each tour once", async (version) => {
    storage.setItem(PROFILE_KEY, veteranSave(version));
    await profile.persist.rehydrate();

    const before = profile.getState();
    // The old flags are kept as they were (nothing is reset)...
    expect(before.flags.seenTutorial).toBe(true);
    expect(before.flags.seenHowToPlay).toBe(true);
    expect(before.flags.seenDraftTour).toBe(true);
    // ...and they do not suppress the Season 1 tours.
    expect(tourSeen(before.tours, DRAFT_TOUR)).toBe(false);
    expect(tourSeen(before.tours, careerTourId("hub"))).toBe(false);

    // First visit: the tour is finished or skipped.
    profile.getState().markTourSeen(DRAFT_TOUR);
    expect(profile.getState().tours).toStrictEqual({ [DRAFT_TOUR]: SEASON.id });
    expect(tourSeen(profile.getState().tours, DRAFT_TOUR)).toBe(true);
    // The career chapters are their own tours.
    expect(tourSeen(profile.getState().tours, careerTourId("hub"))).toBe(false);

    // Second visit, after a reload: the marker was saved, the tour stays away.
    const saved = JSON.parse(storage.getItem(PROFILE_KEY)!);
    expect(saved.state.tours).toStrictEqual({ [DRAFT_TOUR]: SEASON.id });
    profile.setState(profile.getInitialState(), true);
    storage.setItem(PROFILE_KEY, JSON.stringify(saved));
    await profile.persist.rehydrate();
    expect(tourSeen(profile.getState().tours, DRAFT_TOUR)).toBe(true);
  });

  it("marking twice writes once (no second save, same object)", () => {
    profile.getState().markTourSeen(careerTourId("squad"));
    const first = profile.getState().tours;
    const setItem = vi.spyOn(storage, "setItem");
    try {
      profile.getState().markTourSeen(careerTourId("squad"));
      expect(profile.getState().tours).toBe(first);
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("a cloud / storage merge (hydrateDurable) never drops the marker", () => {
    profile.getState().markTourSeen(DRAFT_TOUR);
    profile.getState().markTourSeen(careerTourId("hub"));
    const durable = toDurable(profile.getState());
    // Synced since the coordinator's pass: a tour seen on one device is seen on all.
    expect(durable.tours).toEqual({ [DRAFT_TOUR]: 1, [careerTourId("hub")]: 1 });
    profile.getState().hydrateDurable(durable);
    expect(tourSeen(profile.getState().tours, DRAFT_TOUR)).toBe(true);
    expect(tourSeen(profile.getState().tours, careerTourId("hub"))).toBe(true);
    // A cloud row written before the marker existed carries no `tours`: the
    // device keeps what it knows.
    const older = { ...durable };
    delete (older as Partial<typeof older>).tours;
    profile.getState().hydrateDurable(older);
    expect(tourSeen(profile.getState().tours, DRAFT_TOUR)).toBe(true);
  });

  it("a full reset is a new player again", () => {
    profile.getState().markTourSeen(DRAFT_TOUR);
    profile.getState().resetAll();
    expect(tourSeen(profile.getState().tours, DRAFT_TOUR)).toBe(false);
  });
});
