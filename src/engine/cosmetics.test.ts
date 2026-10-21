import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { challengeById } from "@/data";
import { COSMETICS, cosmeticById, GRANT_COLORS } from "@/data/cosmetics";
import {
  cosmeticFacts,
  deriveOwnedIds,
  EMPTY_COSMETICS,
  equippedColumns,
  addBadge,
  compareForLocker,
  isTeasedWhenLocked,
  newlyOwnedIds,
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

describe("catalog integrity (rc.20, the final Season 1 set)", () => {
  it("ids are unique and every item has EN + PT copy", () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(EN.COSMETICS.items[id], `EN copy for ${id}`).toBeTruthy();
      expect(PT.COSMETICS.items[id], `PT copy for ${id}`).toBeTruthy();
    }
    for (const id of Object.keys(EN.COSMETICS.items)) expect(cosmeticById.has(id), `stale EN copy ${id}`).toBe(true);
    for (const id of Object.keys(PT.COSMETICS.items)) expect(cosmeticById.has(id), `stale PT copy ${id}`).toBe(true);
  });

  it("the official list: 35 badges, 36 titles, 18 banners", () => {
    const count = (kind: string) => COSMETICS.filter((c) => c.kind === kind).length;
    expect(count("badge")).toBe(35);
    expect(count("title")).toBe(36);
    expect(count("banner")).toBe(18);
  });

  it("every challenge-perfect source points at a real challenge", () => {
    for (const c of COSMETICS) {
      if (c.source.type === "challenge-perfect") expect(challengeById.has(c.source.challengeId), c.id).toBe(true);
    }
    expect(COSMETICS.filter((c) => c.source.type === "challenge-perfect").map((c) => c.id).sort()).toEqual([
      "challenge-banner-back-to-basics",
      "challenge-banner-golden-era",
      "challenge-title-homegrown",
      "challenge-title-pure-talent",
    ]);
  });

  it("the manual-grant colours are reserved: no other title uses them", () => {
    const reserved = new Set(
      Object.values(GRANT_COLORS)
        .flatMap((g) => [...g.colors, g.glow])
        .map((c) => c.toLowerCase()),
    );
    for (const c of COSMETICS) {
      if (c.kind !== "title" || c.source.type === "grant") continue;
      for (const col of c.style.colors) expect(reserved.has(col.toLowerCase()), `${c.id} uses a grant colour`).toBe(false);
    }
  });

  it("legendary titles are white gold; every banner's art exists in public/banners (rc.21)", () => {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/banners");
    for (const c of COSMETICS) {
      if (c.kind === "title" && c.tier === "legend") expect(c.style.colors).toEqual(["#ffffff", "#fff4d6", "#ffe6f3"]);
      if (c.kind === "banner") {
        expect(existsSync(resolve(dir, `${c.style.art}.svg`)), c.style.art).toBe(true);
        expect(c.style.glow, c.id).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("deriveOwnedIds — pre-season, grants, the rank track", () => {
  it("nothing without facts", () => {
    expect(deriveOwnedIds(facts())).toEqual([]);
  });

  it("pre-season participation + the peak-rank rewards up to THAT rank (rc.20: cumulative)", () => {
    const ids = deriveOwnedIds(facts({ preseason: snap({ rankId: "gold" }) }));
    expect(ids).toEqual(
      expect.arrayContaining(["legacy-title-first-chapter", "first-chapter", "pre-season-bronze", "pre-season-silver", "pre-season-gold", "legacy-title-ps-bronze", "legacy-title-ps-gold"]),
    );
    expect(ids).not.toContain("pre-season-platinum");
    expect(ids).not.toContain("legacy-title-ps-platinum");
    expect(ids).not.toContain("legacy-title-ps-supersonic-legend");
  });

  it("SSL pre-season gets every rank reward; a snapshot with no finished run gets nothing", () => {
    const ssl = deriveOwnedIds(facts({ preseason: snap({ rankId: "supersonic-legend" }) }));
    expect(ssl).toEqual(expect.arrayContaining(["legacy-title-ps-supersonic-legend", "pre-season-supersonic", "pre-season-bronze", "pre-season-grand-champion"]));
    expect(earned(facts({ preseason: snap({ runsCompleted: 0 }) }))).toEqual([]);
  });

  it("board places map to ONE band each (non-cumulative; rc.20 bands: 1 · 2 · 3 · 4–10 · 11–50)", () => {
    const at = (position: number) => deriveOwnedIds(facts({ preseason: snap({ position }) }));
    const top1 = at(1);
    expect(top1).toEqual(expect.arrayContaining(["season-champion-ps", "legacy-title-ps-board-champion"]));
    expect(top1).not.toContain("season-elite-ps");
    expect(top1).not.toContain("season-finalist-ps");
    expect(at(2)).toEqual(expect.arrayContaining(["season-runner-up-ps", "legacy-title-ps-board-2"]));
    expect(at(3)).toEqual(expect.arrayContaining(["season-third-place-ps", "legacy-title-ps-board-3"]));
    expect(at(4)).toEqual(expect.arrayContaining(["season-elite-ps", "legacy-title-ps-board-elite"]));
    expect(at(10)).toContain("season-elite-ps");
    expect(at(11)).toEqual(expect.arrayContaining(["season-finalist-ps", "legacy-title-ps-board-finalist"]));
    expect(at(50)).toContain("season-finalist-ps");
    expect(at(51)).not.toContain("season-finalist-ps");
    expect(at(51).some((id) => id.startsWith("legacy-title-ps-board"))).toBe(false);
    expect(legacyPositionTier(1)).toBe("champion");
    expect(legacyPositionTier(2)).toBe("runner-up");
    expect(legacyPositionTier(3)).toBe("third");
    expect(legacyPositionTier(10)).toBe("elite");
    expect(legacyPositionTier(50)).toBe("finalist");
    expect(legacyPositionTier(51)).toBeNull();
    expect(legacyPositionTier(null)).toBeNull();
  });

  it("grants map to their title + badge (early supporter included)", () => {
    expect(earned(facts({ grants: ["pro"] })).sort()).toEqual(["grant-title-pro", "verified-pro"]);
    expect(earned(facts({ grants: ["early-supporter"] })).sort()).toEqual(["early-supporter", "grant-title-early-supporter"]);
    expect(earned(facts({ grants: ["supporter", "contributor"] }))).toHaveLength(4);
  });

  it("the Season 1 rank track pays the first time a rank is reached, lower ranks included", () => {
    expect(earned(facts({ seasonPeakRankId: "unranked" }))).toEqual([]);
    expect(earned(facts({ seasonPeakRankId: "bronze" }))).toEqual(["rank-banner-circuit"]);
    expect(earned(facts({ seasonPeakRankId: "gold" })).sort()).toEqual(["rank-banner-circuit", "rank-banner-neon-grid", "rank-title-challenger", "rank-title-playmaker"]);
    const ssl = earned(facts({ seasonPeakRankId: "supersonic-legend" }));
    expect(ssl).toEqual(expect.arrayContaining(["rank-banner-cosmic-ascension", "rank-title-rocket-demigod", "rank-banner-overdrive", "rank-title-rocketeer", "rank-banner-singularity"]));
    expect(ssl.filter((id) => id.startsWith("rank-"))).toHaveLength(11);
    // Another season's facts never pay the Season 1 set.
    expect(earned(facts({ seasonId: 2, seasonPeakRankId: "supersonic-legend" })).filter((id) => id.startsWith("rank-"))).toEqual([]);
  });
});

describe("deriveOwnedIds — play milestones", () => {
  it("login calendar: the eight milestone days", () => {
    expect(earned(facts({ loginBestStreak: 2 }))).toEqual([]);
    expect(earned(facts({ loginBestStreak: 3 }))).toEqual(["login-title-the-regular"]);
    expect(earned(facts({ loginBestStreak: 7 })).sort()).toEqual(["login-banner-kickoff", "login-title-the-regular", "spark"]);
    const all = earned(facts({ loginBestStreak: 30 }));
    expect(all.sort()).toEqual(
      [
        "spark",
        "wildfire",
        "login-title-the-regular",
        "login-banner-kickoff",
        "login-title-locked-in",
        "login-banner-after-hours",
        "login-banner-solar-flare",
        "login-title-on-fire",
        "login-title-cant-stop",
        "login-banner-wildfire",
        "login-title-daily-driver",
      ].sort(),
    );
  });

  it("stars / quiz / missions thresholds (badges keep their rules; On Target is 25)", () => {
    expect(earned(facts({ challengeStars: 25 }))).toEqual(["rising-star"]);
    expect(earned(facts({ challengeStars: 70 })).sort()).toEqual(["constellation", "rising-star", "supernova"]);
    expect(earned(facts({ quizSolved: 10 })).sort()).toEqual(["quiz-title-rl-nerd", "scholar-1"]);
    expect(earned(facts({ quizSolved: 50 })).sort()).toEqual(["quiz-banner-playbook", "quiz-title-rl-nerd", "scholar-1", "scholar-2", "scholar-3"]);
    expect(earned(facts({ missionsCompleted: 24 }))).toEqual([]);
    expect(earned(facts({ missionsCompleted: 25 })).sort()).toEqual(["missions-banner-target-practice", "on-target"]);
  });

  it("runs: badges read lifetime wins, titles / banners read the Season 1 counters", () => {
    expect(earned(facts({ runsWon: 249 }))).toEqual(["veteran-drafter-1"]);
    expect(earned(facts({ runsWon: 1000 })).sort()).toEqual(["veteran-drafter-1", "veteran-drafter-2", "veteran-drafter-3", "veteran-drafter-4"]);
    expect(earned(facts({ runsWonSinceS1: 1 }))).toEqual(["runs-title-rookie"]);
    expect(earned(facts({ runsWonSinceS1: 25 })).sort()).toEqual(["runs-banner-victory-lane", "runs-title-rookie"]);
    expect(earned(facts({ runsWonSinceS1: 100 })).sort()).toEqual(["runs-banner-victory-lane", "runs-title-draft-veteran", "runs-title-rookie"]);
    expect(earned(facts({ runsFinishedSinceS1: 9 }))).toEqual([]);
    expect(earned(facts({ runsFinishedSinceS1: 10 }))).toEqual(["runs-banner-blueprint"]);
  });

  it("Legacy win streak, specials since Season 1, three-star challenges", () => {
    expect(earned(facts({ legacyStreakBest: 2 }))).toEqual([]);
    expect(earned(facts({ legacyStreakBest: 3 }))).toEqual(["streak-title-on-a-roll"]);
    expect(earned(facts({ legacyStreakBest: 5 })).sort()).toEqual(["streak-banner-heatwave", "streak-title-on-a-roll"]);
    expect(earned(facts({ specialsOwned: 1 }))).toEqual(["specials-title-card-hunter"]);
    expect(earned(facts({ specialsOwned: 10 })).sort()).toEqual(["specials-banner-the-vault", "specials-title-card-hunter"]);
    expect(earned(facts({ challengePerfect: ["ch-pure-talent"] })).sort()).toEqual(["challenge-banner-back-to-basics", "challenge-title-pure-talent"]);
    expect(earned(facts({ challengePerfect: ["ch-homegrown", "ch-time-capsule"] })).sort()).toEqual(["challenge-banner-golden-era", "challenge-title-homegrown"]);
  });

  it("Road to Worlds: marks, the first Worlds (badge + title), and Dynasty within one season", () => {
    expect(earned(facts({ careerMarks: ["car-three-seasons", "car-worlds-underdog"] })).sort()).toEqual(["road-warrior", "underdog"]);
    expect(earned(facts({ careerWorlds: 1 })).sort()).toEqual(["career-title-rtw-champion", "world-champion-crowned"]);
    expect(earned(facts({ careerWorlds: 3 })).sort()).toEqual(["career-title-rtw-champion", "world-champion-crowned"]);
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
    const mixed = refreshOwned(all, facts({ loginBestStreak: 3 }), "2026-11-02T00:00:00.000Z");
    expect(mixed).toEqual({ "login-title-the-regular": "2026-11-02T00:00:00.000Z" });
    // Preview ids are never "new unlocks".
    expect(newlyOwnedIds({}, all)).toEqual([]);
    expect(newlyOwnedIds({}, mixed)).toEqual(["login-title-the-regular"]);
  });
});

describe("owned map + equipped resolution", () => {
  it("refreshOwned keeps known dates, dates new ids, drops unknown ids", () => {
    const owned = refreshOwned({ "legacy-title-first-chapter": "2026-10-20T00:00:00.000Z", "ghost-id": "2026-01-01" }, facts({ preseason: snap() }), "2026-11-01T00:00:00.000Z");
    expect(owned["legacy-title-first-chapter"]).toBe("2026-10-20T00:00:00.000Z");
    expect(owned["pre-season-platinum"]).toBe("2026-11-01T00:00:00.000Z");
    expect(owned).not.toHaveProperty("ghost-id");
  });

  it("season-scoped rewards stay once earned (the rank track, Dynasty); other lost facts drop", () => {
    const s1 = refreshOwned({}, facts({ seasonPeakRankId: "supersonic-legend", seasonCareerWorlds: 3, seasonLegacyTitles: 25, grants: ["pro"] }), "2026-11-01T00:00:00.000Z");
    expect(s1).toHaveProperty("dynasty");
    expect(s1).toHaveProperty("rank-title-rocket-demigod");
    // Season 2 starts: the facts reset, the rewards do not. A revoked grant does go.
    const s2 = refreshOwned(s1, facts({ seasonId: 2, seasonPeakRankId: "unranked" }));
    expect(s2.dynasty).toBe("2026-11-01T00:00:00.000Z");
    expect(s2["rank-title-rocket-demigod"]).toBe("2026-11-01T00:00:00.000Z");
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
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 8 }), grants: ["pro"], seasonPeakRankId: "gold" }));
    const empty = resolveEquipped({ owned, equipped: EMPTY_COSMETICS.equipped });
    expect(empty.title).toBeNull();
    expect(empty.banner).toBeNull();
    expect(empty.badges).toEqual([]);

    const explicit = resolveEquipped({ owned, equipped: { title: "legacy-title-first-chapter", banner: "rank-banner-neon-grid", badges: ["first-chapter", "season-elite-ps"] } });
    expect(explicit.title?.id).toBe("legacy-title-first-chapter");
    expect(explicit.banner?.id).toBe("rank-banner-neon-grid");
    expect(explicit.badges.map((b) => b.id)).toEqual(["first-chapter", "season-elite-ps"]);

    const stale = resolveEquipped({ owned, equipped: { title: "legacy-title-day-one", banner: NONE, badges: null } });
    expect(stale.title).toBeNull();
    expect(stale.banner).toBeNull();
  });

  it("seen bookkeeping: unseen = owned, earned, not yet looked at; markSeen is idempotent", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro"] }));
    const state = { owned, equipped: EMPTY_COSMETICS.equipped };
    expect(unseenOwnedIds(state).sort()).toEqual(["grant-title-pro", "verified-pro"]);
    expect(unseenOfKind(state, "badge")).toEqual(["verified-pro"]);
    expect(unseenOfKind(state, "banner")).toEqual([]);
    const seen = markSeen(state, ["verified-pro"]);
    expect(unseenOwnedIds(seen)).toEqual(["grant-title-pro"]);
    expect(markSeen(seen, ["verified-pro"])).toBe(seen);
    expect(lockerItems(owned, "badge").owned.map((c) => c.id)).toEqual(["verified-pro"]);
  });

  it("the locker teases what is earned by playing (rank track included, rc.20): no exclusives, no Dynasty", () => {
    for (const kind of ["title", "badge", "banner"] as const) {
      const { locked } = lockerItems({}, kind);
      expect(locked.some((c) => c.exclusive), kind).toBe(false);
      expect(locked.some((c) => c.source.type === "season-feat"), kind).toBe(false);
    }
    const badges = lockerItems({}, "badge").locked.map((c) => c.id);
    expect(badges).toEqual(expect.arrayContaining(["spark", "veteran-drafter-4", "scholar-1", "on-target"]));
    expect(badges).not.toContain("dynasty");
    expect(badges).not.toContain("pre-season-gold");
    expect(lockerItems({}, "banner").locked.map((c) => c.id)).toContain("rank-banner-cosmic-ascension");
    expect(COSMETICS.filter((c) => isTeasedWhenLocked(c)).every((c) => !c.exclusive)).toBe(true);
  });

  it("sanitizeEquipped drops unowned ids and caps badges", () => {
    const owned = refreshOwned({}, facts({ grants: ["pro", "supporter", "contributor"], loginBestStreak: 7 }));
    const e = sanitizeEquipped(owned, { title: "legacy-title-ps-board-champion", banner: NONE, badges: ["verified-pro", "verified-pro", "supporter", "contributor", "spark"] });
    expect(e).toEqual({ title: null, banner: null, badges: ["verified-pro", "supporter", "contributor"] });
  });

  it("badge slots (rc.5): first free slot, replace when full, swap, remove", () => {
    expect(addBadge([], "a")).toEqual(["a"]);
    expect(addBadge(["a"], "b")).toEqual(["a", "b"]);
    expect(addBadge(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(addBadge(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(placeBadgeAt(["a", "b", "c"], 0, "d")).toEqual(["d", "b", "c"]);
    expect(placeBadgeAt(["a", "b", "c"], 2, "d")).toEqual(["a", "b", "d"]);
    expect(placeBadgeAt(["a", "b", "c"], 0, "c")).toEqual(["c", "b", "a"]);
    expect(placeBadgeAt(["a"], 2, "d")).toEqual(["a", "d"]);
    expect(swapBadges(["a", "b", "c"], 2, 0)).toEqual(["c", "b", "a"]);
    expect(swapBadges(["a", "b"], 0, 2)).toEqual(["b", "a"]);
    expect(swapBadges(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(removeBadgeAt(["a", "b", "c"], 0)).toEqual(["b", "c"]);
    expect(removeBadgeAt(["a", "b", "c"], 5)).toEqual(["a", "b", "c"]);
  });

  it("equippedColumns / rowCosmetics round-trip through the leaderboard view shape (order kept)", () => {
    const owned = refreshOwned({}, facts({ preseason: snap({ position: 1 }), grants: ["pro"] }));
    const cols = equippedColumns({ owned, equipped: { ...EMPTY_COSMETICS.equipped, title: "legacy-title-ps-board-champion", badges: ["verified-pro", "first-chapter"] } });
    expect(cols.equipped_title).toBe("legacy-title-ps-board-champion");
    expect(cols.equipped_frame).toBeNull();
    expect(cols.equipped_badges).toEqual(["verified-pro", "first-chapter"]);
    const row = rowCosmetics({ ...cols, equipped_badges: [...cols.equipped_badges, "not-a-badge"] });
    expect(row.title?.id).toBe("legacy-title-ps-board-champion");
    expect(row.badges.map((b) => b.id)).toEqual(cols.equipped_badges);
  });

  it("mergeCosmetics unions owned (earliest date) and prefers the local explicit choice", () => {
    const local = { owned: { a: "2026-10-22", "rank-banner-circuit": "2026-10-22" }, equipped: { title: null, banner: "rank-banner-circuit", badges: null }, seen: ["a"] };
    const cloud = {
      owned: { a: "2026-10-20", "legacy-title-first-chapter": "2026-10-21", "login-banner-kickoff": "2026-10-21" },
      equipped: { title: "legacy-title-first-chapter", banner: "login-banner-kickoff", badges: null },
      seen: ["legacy-title-first-chapter"],
    };
    const m = mergeCosmetics(local, cloud);
    expect(m.owned).toEqual({ a: "2026-10-20", "legacy-title-first-chapter": "2026-10-21", "rank-banner-circuit": "2026-10-22", "login-banner-kickoff": "2026-10-21" });
    expect(m.equipped.title).toBe("legacy-title-first-chapter"); // cloud's choice adopted (local was empty)
    expect(m.equipped.banner).toBe("rank-banner-circuit"); // local explicit wins
    expect(m.seen?.sort()).toEqual(["a", "legacy-title-first-chapter"]);
  });

  it("cosmeticFacts reads the profile shape defensively, with the Season 1 counters", () => {
    const f = cosmeticFacts({ legacy: { preseason: snap() }, grants: ["pro"], season: { id: 1, peakRankId: "silver" }, challengeStars: { a: 7, b: 1 } });
    expect(f).toMatchObject({ grants: ["pro"], seasonId: 1, seasonPeakRankId: "silver", challengeStars: 4, quizSolved: 0, runsWon: 0, careerWorlds: 0, challengePerfect: ["a"] });
    expect(cosmeticFacts({})).toMatchObject({ preseason: null, grants: [], seasonId: 0, runsWonSinceS1: 0, specialsOwned: 0, legacyStreakBest: 0 });
    const g = cosmeticFacts({
      wins: { easy: 3, normal: 2, hard: 1, legacy: 4 },
      runsCompleted: 42,
      careerMarks: ["car-first-worlds"],
      season: { id: 1, peakRankId: "gold", legacyTitles: 2, careerWorlds: 1 },
      legacyStreak: { current: 1, best: 4 },
      unlockedSpecials: { "sp-a": "2026-10-25T00:00:00.000Z", "sp-b": "2026-09-01T00:00:00.000Z" },
    });
    expect(g).toMatchObject({ runsWon: 10, runsWonSinceS1: 10, runsFinishedSinceS1: 42, careerWorlds: 1, seasonLegacyTitles: 2, seasonCareerWorlds: 1, legacyStreakBest: 4, specialsOwned: 2 });
    // A pre-season veteran: the snapshot's titles / runs / specials are subtracted.
    const v = cosmeticFacts({
      legacy: { preseason: snap({ titles: 5, runsCompleted: 30 }) },
      wins: { easy: 3, normal: 2, hard: 1, legacy: 0 },
      runsCompleted: 38,
      unlockedSpecials: { "sp-a": "2026-10-25T00:00:00.000Z", "sp-b": "2026-09-01T00:00:00.000Z" },
    });
    expect(v).toMatchObject({ runsWon: 6, runsWonSinceS1: 1, runsFinishedSinceS1: 8, specialsOwned: 1 });
    // Worlds counted before rc.4 are floored from the marks; a real count wins when higher.
    expect(cosmeticFacts({ careerMarks: ["car-three-worlds"] }).careerWorlds).toBe(3);
    expect(cosmeticFacts({ careerMarks: ["car-first-worlds"], careerWorldsWon: 2 }).careerWorlds).toBe(2);
  });
});

describe("badge art", () => {
  it("every badge's art file exists in public/badges", () => {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/badges");
    for (const c of COSMETICS) {
      if (c.kind !== "badge") continue;
      expect(existsSync(resolve(dir, `${c.style.art}.svg`)), c.style.art).toBe(true);
    }
  });

  it("the approved catalog (rev. 2026-10-21): 35 badges, each id = its art key; no retired ids", () => {
    const badges = COSMETICS.filter((c) => c.kind === "badge");
    expect(badges).toHaveLength(35);
    expect(badges.every((c) => c.kind === "badge" && c.style.art === c.id)).toBe(true);
    for (const retired of ["world-champion", "season-fourth-place-ps", "season-fifth-place-ps"]) expect(cosmeticById.has(retired)).toBe(false);
    expect(cosmeticById.get("world-champion-crowned")?.source).toEqual({ type: "career-worlds", count: 1 });
    expect(cosmeticById.get("on-target")?.source).toEqual({ type: "missions-completed", count: 25 });
    expect(cosmeticById.get("pre-season-champion")?.tier).toBe("epic");
  });
});
