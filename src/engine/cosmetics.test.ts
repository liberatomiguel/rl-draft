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
  mergeCosmetics,
  NONE,
  refreshOwned,
  resolveEquipped,
  rowCosmetics,
  sanitizeEquipped,
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
    expect(ids).toEqual(expect.arrayContaining(["legacy-frame-bronze", "legacy-frame-silver", "legacy-frame-gold"]));
    expect(ids).not.toContain("legacy-frame-platinum");
    expect(ids).not.toContain("legacy-title-preseason-legend");
  });

  it("SSL pre-season gets the legend title; a snapshot with no finished run gets nothing", () => {
    expect(deriveOwnedIds(facts({ preseason: snap({ rankId: "supersonic-legend" }) }))).toContain("legacy-title-preseason-legend");
    expect(deriveOwnedIds(facts({ preseason: snap({ runsCompleted: 0 }) }))).toEqual([]);
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
    expect(deriveOwnedIds(facts({ grants: ["pro"] }))).toEqual(["grant-title-pro-player", "grant-badge-pro-player"]);
    expect(deriveOwnedIds(facts({ grants: ["supporter", "contributor"] }))).toHaveLength(4);
  });

  it("the Season 1 track follows the season peak rank, only in Season 1", () => {
    expect(deriveOwnedIds(facts({ seasonPeakRankId: "gold" }))).toEqual(["s1-banner-kickoff", "s1-badge-ignition", "s1-frame-chrome"]);
    expect(deriveOwnedIds(facts({ seasonId: 2, seasonPeakRankId: "gold" }))).toEqual([]);
  });

  it("streak / stars / quiz / missions thresholds", () => {
    expect(deriveOwnedIds(facts({ loginBestStreak: 7 }))).toEqual(["streak-badge-3", "streak-frame-7"]);
    expect(deriveOwnedIds(facts({ challengeStars: 25 }))).toEqual(["stars-badge-10", "stars-frame-25"]);
    expect(deriveOwnedIds(facts({ quizSolved: 10 }))).toEqual(["quiz-badge-10"]);
    expect(deriveOwnedIds(facts({ missionsCompleted: 100 }))).toEqual(["missions-badge-25", "missions-title-100"]);
  });
});

describe("owned map + equipped resolution", () => {
  it("refreshOwned keeps known dates, dates new ids, drops unknown ids", () => {
    const owned = refreshOwned({ "legacy-title-day-one": "2026-10-20T00:00:00.000Z", "ghost-id": "2026-01-01" }, facts({ preseason: snap() }), "2026-11-01T00:00:00.000Z");
    expect(owned["legacy-title-day-one"]).toBe("2026-10-20T00:00:00.000Z");
    expect(owned["legacy-frame-platinum"]).toBe("2026-11-01T00:00:00.000Z");
    expect(owned).not.toHaveProperty("ghost-id");
  });

  it("auto shows the best owned per kind; NONE hides; a stale explicit choice falls back to auto", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 8 }), grants: ["pro"] }));
    const auto = resolveEquipped({ owned, equipped: EMPTY_COSMETICS.equipped });
    expect(auto.title?.id).toBe("grant-title-pro-player"); // priority 95 beats elite (90)
    expect(auto.frame?.id).toBe("legacy-frame-platinum");
    expect(auto.banner?.id).toBe("legacy-banner-elite");
    expect(auto.badges.map((b) => b.id)).toEqual(["grant-badge-pro-player", "legacy-badge-first-chapter"]);

    const explicit = resolveEquipped({ owned, equipped: { title: "legacy-title-day-one", frame: NONE, banner: null, badges: ["legacy-badge-first-chapter"] } });
    expect(explicit.title?.id).toBe("legacy-title-day-one");
    expect(explicit.frame).toBeNull();
    expect(explicit.badges.map((b) => b.id)).toEqual(["legacy-badge-first-chapter"]);

    const stale = resolveEquipped({ owned, equipped: { title: "s1-title-grinder", frame: null, banner: null, badges: null } });
    expect(stale.title?.id).toBe("grant-title-pro-player");
  });

  it("sanitizeEquipped drops unowned ids and caps badges", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro", "supporter", "contributor"], loginBestStreak: 3 }));
    const e = sanitizeEquipped(owned, { title: "legacy-title-champion", frame: "grant-badge-pro-player", banner: NONE, badges: ["grant-badge-pro-player", "grant-badge-pro-player", "grant-badge-early-supporter", "grant-badge-founding-contributor", "streak-badge-3"] });
    expect(e).toEqual({ title: null, frame: null, banner: NONE, badges: ["grant-badge-pro-player", "grant-badge-early-supporter", "grant-badge-founding-contributor"] });
  });

  it("equippedColumns / rowCosmetics round-trip through the leaderboard view shape", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 1 }) }));
    const cols = equippedColumns({ owned, equipped: EMPTY_COSMETICS.equipped });
    expect(cols.equipped_title).toBe("legacy-title-champion");
    const row = rowCosmetics({ ...cols, equipped_badges: [...cols.equipped_badges, "not-a-badge"] });
    expect(row.title?.id).toBe("legacy-title-champion");
    expect(row.badges.map((b) => b.id)).toEqual(cols.equipped_badges);
  });

  it("mergeCosmetics unions owned (earliest date) and prefers the local explicit choice", () => {
    const local = { owned: { a: "2026-10-22" }, equipped: { title: null, frame: NONE, banner: null, badges: null } };
    const cloud = { owned: { a: "2026-10-20", "legacy-title-day-one": "2026-10-21" }, equipped: { title: "legacy-title-day-one", frame: "legacy-frame-gold", banner: null, badges: null } };
    const m = mergeCosmetics(local, cloud);
    expect(m.owned).toEqual({ a: "2026-10-20", "legacy-title-day-one": "2026-10-21" });
    expect(m.equipped.title).toBe("legacy-title-day-one"); // cloud's choice adopted (local was auto)
    expect(m.equipped.frame).toBe(NONE); // local explicit wins
  });

  it("cosmeticFacts reads the profile shape defensively", () => {
    const f = cosmeticFacts({ legacy: { preseason: snap() }, grants: ["pro"], season: { id: 1, peakRankId: "silver" }, challengeStars: { a: 7, b: 1 } });
    expect(f).toMatchObject({ grants: ["pro"], seasonId: 1, seasonPeakRankId: "silver", challengeStars: 4, quizSolved: 0 });
    expect(cosmeticFacts({})).toMatchObject({ preseason: null, grants: [], seasonId: 0 });
  });
});
