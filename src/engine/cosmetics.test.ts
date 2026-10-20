import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { COSMETICS, cosmeticById } from "@/data/cosmetics";
import {
  cosmeticFacts,
  deriveOwnedIds,
  EMPTY_COSMETICS,
  equippedColumns,
  addBadge,
  compareForLocker,
  isTeasedWhenLocked,
  placeBadgeAt,
  removeBadgeAt,
  swapBadges,
  legacyPositionTier,
  lockerItems,
  markSeen,
  mergeCosmetics,
  NONE,
  refreshOwned,
  resolveEquipped,
  rowCosmetics,
  sanitizeEquipped,
  unseenOfKind,
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

  it("pre-season participation + the peak-rank badge of THAT rank only (rc.4, non-cumulative)", () => {
    const ids = deriveOwnedIds(facts({ preseason: snap({ rankId: "gold" }) }));
    expect(ids).toContain("legacy-title-day-one");
    expect(ids).toContain("first-chapter");
    expect(ids).toContain("pre-season-gold");
    expect(ids).not.toContain("pre-season-bronze");
    expect(ids).not.toContain("pre-season-silver");
    expect(ids).not.toContain("pre-season-platinum");
    expect(ids).not.toContain("legacy-title-preseason-legend");
  });

  it("SSL pre-season gets the legend title; a snapshot with no finished run gets nothing", () => {
    const ssl = deriveOwnedIds(facts({ preseason: snap({ rankId: "supersonic-legend" }) }));
    expect(ssl).toEqual(expect.arrayContaining(["legacy-title-preseason-legend", "pre-season-supersonic"]));
    expect(ssl).not.toContain("pre-season-grand-champion");
    expect(earned(facts({ preseason: snap({ runsCompleted: 0 }) }))).toEqual([]);
  });

  it("board places map to ONE band each (rc.4, non-cumulative)", () => {
    const at = (position: number) => deriveOwnedIds(facts({ preseason: snap({ position }) }));
    const top1 = at(1);
    expect(top1).toEqual(expect.arrayContaining(["season-champion-ps", "legacy-title-champion", "legacy-banner-champion"]));
    expect(top1).not.toContain("season-elite-ps");
    expect(top1).not.toContain("season-finalist-ps");
    expect(top1).not.toContain("legacy-title-elite");
    expect(at(2)).toContain("season-runner-up-ps");
    expect(at(3)).toContain("season-third-place-ps");
    expect(at(4)).toContain("season-fourth-place-ps");
    expect(at(5)).toContain("season-fifth-place-ps");
    expect(at(5)).not.toContain("season-elite-ps");
    expect(at(6)).toContain("season-elite-ps");
    expect(at(10)).toContain("season-elite-ps");
    expect(at(11)).toEqual(expect.arrayContaining(["season-finalist-ps", "legacy-title-contender"]));
    expect(at(50)).toContain("season-finalist-ps");
    expect(at(51)).not.toContain("season-finalist-ps");
    expect(at(51)).toContain("legacy-title-challenger");
    expect(at(101)).not.toContain("legacy-title-challenger");
    expect(legacyPositionTier(1)).toBe("champion");
    expect(legacyPositionTier(10)).toBe("elite");
    expect(legacyPositionTier(50)).toBe("contender");
    expect(legacyPositionTier(100)).toBe("challenger");
    expect(legacyPositionTier(101)).toBeNull();
    expect(legacyPositionTier(null)).toBeNull();
  });

  it("grants map to their title + badge", () => {
    expect(earned(facts({ grants: ["pro"] })).sort()).toEqual(["grant-title-pro-player", "verified-pro"]);
    expect(earned(facts({ grants: ["supporter", "contributor"] }))).toHaveLength(4);
  });

  it("no in-season rank rewards (rc.6): reaching a rank this season owns nothing", () => {
    expect(earned(facts({ seasonPeakRankId: "supersonic-legend" }))).toEqual([]);
    expect(COSMETICS.some((c) => c.source.type === "season-rank")).toBe(false);
  });

  it("streak / stars / quiz / missions / runs-won thresholds", () => {
    expect(earned(facts({ loginBestStreak: 6 }))).toEqual([]);
    expect(earned(facts({ loginBestStreak: 7 }))).toEqual(["spark"]);
    expect(earned(facts({ loginBestStreak: 30 })).sort()).toEqual(["spark", "streak-banner-14", "streak-title-30", "wildfire"]);
    expect(earned(facts({ challengeStars: 25 }))).toEqual(["rising-star"]);
    expect(earned(facts({ challengeStars: 50 })).sort()).toEqual(["constellation", "rising-star", "stars-title-45"]);
    expect(earned(facts({ challengeStars: 70 })).sort()).toEqual(["constellation", "rising-star", "stars-title-45", "supernova"]);
    expect(earned(facts({ quizSolved: 10 }))).toEqual(["scholar-1"]);
    expect(earned(facts({ quizSolved: 50 })).sort()).toEqual(["quiz-title-30", "scholar-1", "scholar-2", "scholar-3"]);
    expect(earned(facts({ missionsCompleted: 49 }))).toEqual([]);
    expect(earned(facts({ missionsCompleted: 100 })).sort()).toEqual(["missions-title-100", "on-target"]);
    expect(earned(facts({ runsWon: 249 }))).toEqual(["veteran-drafter-1"]);
    expect(earned(facts({ runsWon: 1000 })).sort()).toEqual(["veteran-drafter-1", "veteran-drafter-2", "veteran-drafter-3", "veteran-drafter-4"]);
  });

  it("Road to Worlds: marks, Worlds across saves, and Dynasty within one season", () => {
    expect(earned(facts({ careerMarks: ["car-three-seasons", "car-worlds-underdog"] })).sort()).toEqual(["road-warrior", "underdog"]);
    expect(earned(facts({ careerWorlds: 1 }))).toEqual(["world-champion"]);
    expect(earned(facts({ careerWorlds: 3 })).sort()).toEqual(["world-champion", "world-champion-crowned"]);
    const dynasty = { seasonPeakRankId: "supersonic-legend", seasonCareerWorlds: 3, seasonLegacyTitles: 25, careerWorlds: 3 };
    expect(earned(facts(dynasty))).toContain("dynasty");
    expect(earned(facts({ ...dynasty, seasonPeakRankId: "grand-champion" }))).not.toContain("dynasty");
    expect(earned(facts({ ...dynasty, seasonCareerWorlds: 2 }))).not.toContain("dynasty");
    expect(earned(facts({ ...dynasty, seasonLegacyTitles: 24 }))).not.toContain("dynasty");
  });

  it("the preview switch owns everything; switching it off drops the preview ids again", () => {
    expect(deriveOwnedIds(facts({ previewAll: true }))).toHaveLength(COSMETICS.length);
    const all = refreshOwned({}, facts({ previewAll: true }));
    expect(Object.keys(all)).toHaveLength(COSMETICS.length);
    const back = refreshOwned(all, facts());
    expect(Object.keys(back)).toEqual([]);
    // An item earned for real while previewing gets a real date and stays.
    const mixed = refreshOwned(all, facts({ loginBestStreak: 7 }), "2026-11-02T00:00:00.000Z");
    expect(mixed).toEqual({ spark: "2026-11-02T00:00:00.000Z" });
  });
});

describe("owned map + equipped resolution", () => {
  it("refreshOwned keeps known dates, dates new ids, drops unknown ids", () => {
    const owned = refreshOwned({ "legacy-title-day-one": "2026-10-20T00:00:00.000Z", "ghost-id": "2026-01-01" }, facts({ preseason: snap() }), "2026-11-01T00:00:00.000Z");
    expect(owned["legacy-title-day-one"]).toBe("2026-10-20T00:00:00.000Z");
    expect(owned["pre-season-platinum"]).toBe("2026-11-01T00:00:00.000Z");
    expect(owned).not.toHaveProperty("ghost-id");
  });

  it("season-scoped rewards stay once earned (Dynasty); other lost facts drop", () => {
    const s1 = refreshOwned({}, facts({ seasonPeakRankId: "supersonic-legend", seasonCareerWorlds: 3, seasonLegacyTitles: 25, grants: ["pro"] }), "2026-11-01T00:00:00.000Z");
    expect(s1).toHaveProperty("dynasty");
    // Season 2 starts: the facts reset, Dynasty does not. A revoked grant does go.
    const s2 = refreshOwned(s1, facts({ seasonId: 2, seasonPeakRankId: "unranked" }));
    expect(s2.dynasty).toBe("2026-11-01T00:00:00.000Z");
    expect(s2).not.toHaveProperty("verified-pro");
  });

  it("locker order (rc.6): rarity first, then the family, then the catalog priority", () => {
    const all = refreshOwned({}, facts({ previewAll: true }));
    const order = lockerItems(all, "badge").owned;
    const tiers = order.map((c) => c.tier);
    const rank = ["legend", "epic", "rare", "uncommon", "common"];
    expect(tiers).toEqual([...tiers].sort((a, b) => rank.indexOf(a) - rank.indexOf(b)));
    // Within a rarity, a family stays together (the board badges before the peak-rank ones).
    const epic = order.filter((c) => c.tier === "epic").map((c) => c.source.type);
    expect(epic.indexOf("legacy-position")).toBeLessThan(epic.indexOf("legacy-rank"));
    const firstOfEach = new Map<string, number>();
    epic.forEach((t, i) => (firstOfEach.has(t) ? null : firstOfEach.set(t, i)));
    for (const [t, i] of firstOfEach) expect(epic.slice(i).filter((x) => x === t).length).toBe(epic.filter((x) => x === t).length);
    expect(compareForLocker(cosmeticById.get("season-champion-ps")!, cosmeticById.get("spark")!)).toBeLessThan(0);
  });

  it("no auto-equip (rc.2): an empty slot shows nothing; a stale choice resolves to empty", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 8 }), grants: ["pro"] }));
    const empty = resolveEquipped({ owned, equipped: EMPTY_COSMETICS.equipped });
    expect(empty.title).toBeNull();
    expect(empty.banner).toBeNull();
    expect(empty.badges).toEqual([]);

    const explicit = resolveEquipped({ owned, equipped: { title: "legacy-title-day-one", banner: "legacy-banner-elite", badges: ["first-chapter", "season-elite-ps"] } });
    expect(explicit.title?.id).toBe("legacy-title-day-one");
    expect(explicit.banner?.id).toBe("legacy-banner-elite");
    expect(explicit.badges.map((b) => b.id)).toEqual(["first-chapter", "season-elite-ps"]);

    const stale = resolveEquipped({ owned, equipped: { title: "s1-title-grinder", banner: NONE, badges: null } });
    expect(stale.title).toBeNull();
    expect(stale.banner).toBeNull();
  });

  it("seen bookkeeping: unseen = owned, earned, not yet looked at; markSeen is idempotent", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro"] }));
    const state = { owned, equipped: EMPTY_COSMETICS.equipped };
    expect(unseenOwnedIds(state).sort()).toEqual(["grant-title-pro-player", "verified-pro"]);
    expect(unseenOfKind(state, "badge")).toEqual(["verified-pro"]);
    expect(unseenOfKind(state, "banner")).toEqual([]);
    const seen = markSeen(state, ["verified-pro"]);
    expect(unseenOwnedIds(seen)).toEqual(["grant-title-pro-player"]);
    expect(markSeen(seen, ["verified-pro"])).toBe(seen);
    expect(lockerItems(owned, "badge").owned.map((c) => c.id)).toEqual(["verified-pro"]);
  });

  it("the locker teases only what is earned by playing (rc.4): no exclusives, no season track", () => {
    for (const kind of ["title", "badge", "banner"] as const) {
      const { locked } = lockerItems({}, kind);
      expect(locked.some((c) => c.exclusive), kind).toBe(false);
      expect(locked.some((c) => c.source.type === "season-rank" || c.source.type === "season-feat"), kind).toBe(false);
    }
    const badges = lockerItems({}, "badge").locked.map((c) => c.id);
    expect(badges).toEqual(expect.arrayContaining(["spark", "veteran-drafter-4", "scholar-1", "on-target"]));
    expect(badges).not.toContain("dynasty");
    expect(badges).not.toContain("pre-season-gold");
    expect(COSMETICS.filter((c) => isTeasedWhenLocked(c)).every((c) => !c.exclusive)).toBe(true);
  });

  it("sanitizeEquipped drops unowned ids and caps badges", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro", "supporter", "contributor"], loginBestStreak: 7 }));
    const e = sanitizeEquipped(owned, { title: "legacy-title-champion", banner: NONE, badges: ["verified-pro", "verified-pro", "supporter", "contributor", "spark"] });
    expect(e).toEqual({ title: null, banner: null, badges: ["verified-pro", "supporter", "contributor"] });
  });

  it("badge slots (rc.5): first free slot, replace when full, swap, remove", () => {
    // A new badge drops into the first free slot; a shown one or a full row is unchanged.
    expect(addBadge([], "a")).toEqual(["a"]);
    expect(addBadge(["a"], "b")).toEqual(["a", "b"]);
    expect(addBadge(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(addBadge(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    // Full: the player picks the slot to replace (slot 0 = featured).
    expect(placeBadgeAt(["a", "b", "c"], 0, "d")).toEqual(["d", "b", "c"]);
    expect(placeBadgeAt(["a", "b", "c"], 2, "d")).toEqual(["a", "b", "d"]);
    // A badge already shown elsewhere swaps places instead of duplicating.
    expect(placeBadgeAt(["a", "b", "c"], 0, "c")).toEqual(["c", "b", "a"]);
    // Past the end = the first free slot.
    expect(placeBadgeAt(["a"], 2, "d")).toEqual(["a", "d"]);
    // Swap two shown badges (into the featured slot, too); past the end = last filled.
    expect(swapBadges(["a", "b", "c"], 2, 0)).toEqual(["c", "b", "a"]);
    expect(swapBadges(["a", "b"], 0, 2)).toEqual(["b", "a"]);
    expect(swapBadges(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    // Removing opens the slot; the ones behind close the gap.
    expect(removeBadgeAt(["a", "b", "c"], 0)).toEqual(["b", "c"]);
    expect(removeBadgeAt(["a", "b", "c"], 5)).toEqual(["a", "b", "c"]);
  });

  it("equippedColumns / rowCosmetics round-trip through the leaderboard view shape (order kept)", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 1 }), grants: ["pro"] }));
    const cols = equippedColumns({ owned, equipped: { ...EMPTY_COSMETICS.equipped, title: "legacy-title-champion", badges: ["verified-pro", "first-chapter"] } });
    expect(cols.equipped_title).toBe("legacy-title-champion");
    expect(cols.equipped_frame).toBeNull();
    expect(cols.equipped_badges).toEqual(["verified-pro", "first-chapter"]);
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
    expect(f).toMatchObject({ grants: ["pro"], seasonId: 1, seasonPeakRankId: "silver", challengeStars: 4, quizSolved: 0, runsWon: 0, careerWorlds: 0 });
    expect(cosmeticFacts({})).toMatchObject({ preseason: null, grants: [], seasonId: 0 });
    const g = cosmeticFacts({
      wins: { easy: 3, normal: 2, hard: 1, legacy: 4 },
      careerMarks: ["car-first-worlds"],
      season: { id: 1, peakRankId: "gold", legacyTitles: 2, careerWorlds: 1 },
    });
    expect(g).toMatchObject({ runsWon: 10, careerWorlds: 1, seasonLegacyTitles: 2, seasonCareerWorlds: 1 });
    // Worlds counted before rc.4 are floored from the marks; a real count wins when higher.
    expect(cosmeticFacts({ careerMarks: ["car-three-worlds"] }).careerWorlds).toBe(3);
    expect(cosmeticFacts({ careerMarks: ["car-first-worlds"], careerWorldsWon: 2 }).careerWorlds).toBe(2);
  });
});

describe("badge art (rc.4)", () => {
  it("every badge's art file exists in public/badges", () => {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/badges");
    for (const c of COSMETICS) {
      if (c.kind !== "badge") continue;
      expect(existsSync(resolve(dir, `${c.style.art}.svg`)), c.style.art).toBe(true);
    }
  });

  it("the approved catalog: 37 badges (rc.6 + Supernova), each id = its art key", () => {
    const badges = COSMETICS.filter((c) => c.kind === "badge");
    expect(badges).toHaveLength(37);
    expect(badges.every((c) => c.kind === "badge" && c.style.art === c.id)).toBe(true);
  });
});
