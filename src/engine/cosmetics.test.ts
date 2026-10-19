import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { COSMETICS, cosmeticById } from "@/data/cosmetics";
import {
  cosmeticFacts,
  deriveOwnedIds,
  EMPTY_COSMETICS,
  equippedColumns,
  legacyPositionTier,
  lockerItems,
  markSeen,
  mergeCosmetics,
  NONE,
  refreshOwned,
  resolveEquipped,
  rowCosmetics,
  sanitizeEquipped,
  unseenOwnedIds,
  type CosmeticFacts,
} from "./cosmetics";
import type { PreseasonSnapshot } from "./season";

const snap = (over: Partial<PreseasonSnapshot> = {}): PreseasonSnapshot => ({
  xp: 9000,
  mmr: 1300,
  rankId: "platinum",
  runsCompleted: 30,
  titles: 5,
  challengesCleared: 4,
  snapshotAt: "2026-10-20T00:00:00.000Z",
  position: null,
  ...over,
});

const facts = (over: Partial<CosmeticFacts> = {}): CosmeticFacts => ({
  preseason: null,
  grants: [],
  seasonId: 1,
  seasonPeakRankId: "unranked",
  ...over,
});

const earned = (f: CosmeticFacts): string[] => deriveOwnedIds(f);

describe("catalog integrity", () => {
  it("ids are unique and every item has EN + PT copy", () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(EN.COSMETICS.items[id], `EN copy for ${id}`).toBeTruthy();
      expect(PT.COSMETICS.items[id], `PT copy for ${id}`).toBeTruthy();
    }
    for (const id of Object.keys(EN.COSMETICS.items)) expect(cosmeticById.has(id), `stale EN copy ${id}`).toBe(true);
  });
});

describe("deriveOwnedIds (the legacy rewards + grants + season track)", () => {
  it("nothing without facts", () => {
    expect(deriveOwnedIds(facts())).toEqual([]);
  });

  it("pre-season participation + peak-rank frames (cumulative up to the peak)", () => {
    const ids = deriveOwnedIds(facts({ preseason: snap({ rankId: "gold" }) }));
    expect(ids).toContain("legacy-title-day-one");
    expect(ids).toContain("legacy-badge-first-chapter");
    expect(ids).toEqual(expect.arrayContaining(["legacy-badge-bronze", "legacy-badge-silver", "legacy-badge-gold"]));
    expect(ids).not.toContain("legacy-badge-platinum");
    expect(ids).not.toContain("legacy-title-preseason-legend");
  });

  it("SSL pre-season gets the legend title; a snapshot with no finished run gets nothing", () => {
    expect(deriveOwnedIds(facts({ preseason: snap({ rankId: "supersonic-legend" }) }))).toContain("legacy-title-preseason-legend");
    expect(earned(facts({ preseason: snap({ runsCompleted: 0 }) }))).toEqual([]);
  });

  it("board position tiers include the lower tiers", () => {
    const top1 = deriveOwnedIds(facts({ preseason: snap({ position: 1 }) }));
    expect(top1).toEqual(expect.arrayContaining(["legacy-title-champion", "legacy-title-elite", "legacy-title-contender", "legacy-title-challenger", "legacy-banner-champion"]));
    const p37 = deriveOwnedIds(facts({ preseason: snap({ position: 37 }) }));
    expect(p37).toContain("legacy-title-contender");
    expect(p37).not.toContain("legacy-title-elite");
    expect(deriveOwnedIds(facts({ preseason: snap({ position: 101 }) }))).not.toContain("legacy-title-challenger");
    expect(legacyPositionTier(1)).toBe("champion");
    expect(legacyPositionTier(10)).toBe("elite");
    expect(legacyPositionTier(50)).toBe("contender");
    expect(legacyPositionTier(100)).toBe("challenger");
    expect(legacyPositionTier(101)).toBeNull();
    expect(legacyPositionTier(null)).toBeNull();
  });

  it("grants map to their title + badge", () => {
    expect(earned(facts({ grants: ["pro"] }))).toEqual(["grant-title-pro-player", "grant-badge-pro-player"]);
    expect(earned(facts({ grants: ["supporter", "contributor"] }))).toHaveLength(4);
  });

  it("the Season 1 track follows the season peak rank, only in Season 1", () => {
    expect(earned(facts({ seasonPeakRankId: "gold" }))).toEqual(["s1-banner-kickoff", "s1-badge-ignition", "s1-badge-gilded"]);
    expect(earned(facts({ seasonId: 2, seasonPeakRankId: "gold" }))).toEqual([]);
  });

  it("streak / stars / quiz / missions thresholds", () => {
    expect(earned(facts({ loginBestStreak: 7 }))).toEqual(["streak-badge-3", "streak-badge-7"]);
    expect(earned(facts({ challengeStars: 25 }))).toEqual(["stars-badge-10", "stars-badge-25"]);
    expect(earned(facts({ quizSolved: 10 }))).toEqual(["quiz-badge-10"]);
    expect(earned(facts({ missionsCompleted: 100 }))).toEqual(["missions-badge-25", "missions-title-100"]);
  });

  it("the preview switch owns everything; switching it off drops the preview ids again", () => {
    expect(deriveOwnedIds(facts({ previewAll: true }))).toHaveLength(COSMETICS.length);
    const all = refreshOwned({}, facts({ previewAll: true }));
    const back = refreshOwned(all, facts());
    expect(Object.keys(back)).toEqual([]);
  });
});

describe("owned map + equipped resolution", () => {
  it("refreshOwned keeps known dates, dates new ids, drops unknown ids", () => {
    const owned = refreshOwned({ "legacy-title-day-one": "2026-10-20T00:00:00.000Z", "ghost-id": "2026-01-01" }, facts({ preseason: snap() }), "2026-11-01T00:00:00.000Z");
    expect(owned["legacy-title-day-one"]).toBe("2026-10-20T00:00:00.000Z");
    expect(owned["legacy-badge-platinum"]).toBe("2026-11-01T00:00:00.000Z");
    expect(owned).not.toHaveProperty("ghost-id");
  });

  it("no auto-equip (rc.2): an empty slot shows nothing; a stale choice resolves to empty", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 8 }), grants: ["pro"] }));
    const empty = resolveEquipped({ owned, equipped: EMPTY_COSMETICS.equipped });
    expect(empty.title).toBeNull();
    expect(empty.banner).toBeNull();
    expect(empty.badges).toEqual([]);

    const explicit = resolveEquipped({ owned, equipped: { title: "legacy-title-day-one", banner: "legacy-banner-elite", badges: ["legacy-badge-first-chapter"] } });
    expect(explicit.title?.id).toBe("legacy-title-day-one");
    expect(explicit.banner?.id).toBe("legacy-banner-elite");
    expect(explicit.badges.map((b) => b.id)).toEqual(["legacy-badge-first-chapter"]);

    const stale = resolveEquipped({ owned, equipped: { title: "s1-title-grinder", banner: NONE, badges: null } });
    expect(stale.title).toBeNull();
    expect(stale.banner).toBeNull();
  });

  it("seen bookkeeping: unseen = owned, earned, not yet looked at; markSeen is idempotent", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro"] }));
    const state = { owned, equipped: EMPTY_COSMETICS.equipped };
    expect(unseenOwnedIds(state).sort()).toEqual(["grant-badge-pro-player", "grant-title-pro-player"]);
    const seen = markSeen(state, ["grant-badge-pro-player"]);
    expect(unseenOwnedIds(seen)).toEqual(["grant-title-pro-player"]);
    expect(markSeen(seen, ["grant-badge-pro-player"])).toBe(seen);
    expect(lockerItems(owned, "title").locked.some((c) => c.exclusive)).toBe(false);
    expect(lockerItems(owned, "badge").owned.map((c) => c.id)).toEqual(["grant-badge-pro-player"]);
  });

  it("sanitizeEquipped drops unowned ids and caps badges", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro", "supporter", "contributor"], loginBestStreak: 3 }));
    const e = sanitizeEquipped(owned, { title: "legacy-title-champion", banner: NONE, badges: ["grant-badge-pro-player", "grant-badge-pro-player", "grant-badge-early-supporter", "grant-badge-founding-contributor", "streak-badge-3"] });
    expect(e).toEqual({ title: null, banner: null, badges: ["grant-badge-pro-player", "grant-badge-early-supporter", "grant-badge-founding-contributor"] });
  });

  it("equippedColumns / rowCosmetics round-trip through the leaderboard view shape", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 1 }) }));
    const cols = equippedColumns({ owned, equipped: { ...EMPTY_COSMETICS.equipped, title: "legacy-title-champion", badges: ["legacy-badge-first-chapter"] } });
    expect(cols.equipped_title).toBe("legacy-title-champion");
    expect(cols.equipped_frame).toBeNull();
    const row = rowCosmetics({ ...cols, equipped_badges: [...cols.equipped_badges, "not-a-badge"] });
    expect(row.title?.id).toBe("legacy-title-champion");
    expect(row.badges.map((b) => b.id)).toEqual(cols.equipped_badges);
  });

  it("mergeCosmetics unions owned (earliest date) and prefers the local explicit choice", () => {
    const local = { owned: { a: "2026-10-22", "legacy-banner-elite": "2026-10-22" }, equipped: { title: null, banner: "legacy-banner-elite", badges: null }, seen: ["a"] };
    const cloud = { owned: { a: "2026-10-20", "legacy-title-day-one": "2026-10-21", "legacy-banner-challenger": "2026-10-21" }, equipped: { title: "legacy-title-day-one", banner: "legacy-banner-challenger", badges: null }, seen: ["legacy-title-day-one"] };
    const m = mergeCosmetics(local, cloud);
    expect(m.owned).toEqual({ a: "2026-10-20", "legacy-title-day-one": "2026-10-21", "legacy-banner-elite": "2026-10-22", "legacy-banner-challenger": "2026-10-21" });
    expect(m.equipped.title).toBe("legacy-title-day-one"); // cloud's choice adopted (local was empty)
    expect(m.equipped.banner).toBe("legacy-banner-elite"); // local explicit wins
    expect(m.seen?.sort()).toEqual(["a", "legacy-title-day-one"]);
  });

  it("cosmeticFacts reads the profile shape defensively", () => {
    const f = cosmeticFacts({ legacy: { preseason: snap() }, grants: ["pro"], season: { id: 1, peakRankId: "silver" }, challengeStars: { a: 7, b: 1 } });
    expect(f).toMatchObject({ grants: ["pro"], seasonId: 1, seasonPeakRankId: "silver", challengeStars: 4, quizSolved: 0 });
    expect(cosmeticFacts({})).toMatchObject({ preseason: null, grants: [], seasonId: 0 });
  });
});
