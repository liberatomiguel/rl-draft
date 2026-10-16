import { describe, expect, it } from "vitest";
import { SEASON_RATING } from "@/config/balance";
import { SEASON } from "@/config/season";
import { EMPTY_COSMETICS } from "@/engine/cosmetics";
import { EMPTY_LOGIN, EMPTY_MISSIONS } from "@/engine/missions";
import { freshSeason } from "@/engine/season";
import { mergeProfiles, type DurableProfile } from "./profileSync";

/** A CURRENT-season row (v2.0). Pre-season rows are built in the v2.0 block below. */
function make(over: Partial<DurableProfile> = {}): DurableProfile {
  return {
    season: freshSeason("2026-10-20T00:00:00.000Z"),
    lifetime: { xp: 0 },
    legacy: { preseason: null },
    grants: [],
    cosmetics: EMPTY_COSMETICS,
    missions: EMPTY_MISSIONS,
    login: EMPTY_LOGIN,
    xp: 0,
    mmr: SEASON_RATING.start,
    legacyUnlocked: false,
    runsCompleted: 0,
    wins: { easy: 0, normal: 0, hard: 0, legacy: 0 },
    playoffAppearances: 0,
    podiums: 0,
    swissWinsTotal: 0,
    gamesWon: 0,
    goalsScored: 0,
    unlockedSpecials: {},
    achievements: {},
    runHistory: [],
    dailyResults: {},
    challengesCompleted: {},
    records: { bestOverall: { easy: 0, normal: 0, hard: 0, legacy: 0 }, bestOverallWorldwide: 0, bestOverallSam: 0 },
    settings: { lastDifficulty: "normal", lastShowOverall: true, lastMode: "classic", lastRegionLock: null },
    flags: { seenHowToPlay: false, seenLegacyIntro: false, seenRegionalIntro: false, seenTutorial: false },
    ...over,
  };
}

describe("mergeProfiles — never lose progress (#55.7)", () => {
  it("a guest with local progress into an EMPTY cloud keeps everything", () => {
    const local = make({
      xp: 4200,
      runsCompleted: 7,
      wins: { easy: 2, normal: 3, hard: 1, legacy: 0 },
      unlockedSpecials: { "sp-a": "2026-02-01", "sp-b": "2026-03-01" },
      achievements: { "ach-x": "2026-01-15" },
      challengesCompleted: { "ch-first-final": "2026-04-01" },
      records: { bestOverall: { easy: 80, normal: 88, hard: 91, legacy: 0 }, bestOverallWorldwide: 91, bestOverallSam: 84 },
    });
    const merged = mergeProfiles(local, make());
    expect(merged.xp).toBe(4200);
    expect(merged.wins.normal).toBe(3);
    expect(merged.unlockedSpecials).toEqual(local.unlockedSpecials);
    expect(merged.challengesCompleted["ch-first-final"]).toBe("2026-04-01");
    expect(merged.records.bestOverallWorldwide).toBe(91);
  });

  it("takes the MAX of every counter and peak — result regresses below neither side", () => {
    const a = make({ xp: 5000, mmr: 1750, wins: { easy: 5, normal: 1, hard: 0, legacy: 0 }, records: { bestOverall: { easy: 90, normal: 0, hard: 0, legacy: 0 }, bestOverallWorldwide: 90, bestOverallSam: 0 } });
    const b = make({ xp: 3000, mmr: 1400, wins: { easy: 1, normal: 4, hard: 2, legacy: 0 }, records: { bestOverall: { easy: 70, normal: 85, hard: 92, legacy: 0 }, bestOverallWorldwide: 92, bestOverallSam: 88 } });
    const m = mergeProfiles(a, b);
    expect(m.xp).toBe(5000);
    expect(m.mmr).toBe(1750);
    expect(m.wins).toEqual({ easy: 5, normal: 4, hard: 2, legacy: 0 });
    expect(m.records.bestOverall).toEqual({ easy: 90, normal: 85, hard: 92, legacy: 0 });
    expect(m.records.bestOverallWorldwide).toBe(92);
    expect(m.records.bestOverallSam).toBe(88);
  });

  it("rating: the copy that played more of the season wins; a tie takes the MAX (v2.0)", () => {
    const ahead = make({ mmr: 380, season: { ...freshSeason(), runs: 8 } });
    const behind = make({ mmr: 430, season: { ...freshSeason(), runs: 3 } });
    // `ahead` lost rating after `behind` last synced — its lower value is the truth.
    expect(mergeProfiles(ahead, behind).mmr).toBe(380);
    expect(mergeProfiles(behind, ahead).mmr).toBe(380);
    // Same run count → never regress.
    expect(mergeProfiles(make({ mmr: 410 }), make({ mmr: 450 })).mmr).toBe(450);
  });

  describe("v2.0 season reset (#110): a pre-season row can never re-inflate Season 1", () => {
    /** A row written by a v1.4 build: no season / lifetime / legacy / grants. */
    function preseasonRow(over: Partial<DurableProfile> = {}): DurableProfile {
      const row = make(over) as Partial<DurableProfile>;
      delete row.season;
      delete row.lifetime;
      delete row.legacy;
      delete row.grants;
      return row as DurableProfile;
    }

    it("archives a pre-season cloud row into legacy.preseason and resets its season fields", () => {
      const local = make({ xp: 300, mmr: 410, season: { ...freshSeason(), runs: 2 } });
      const cloud = preseasonRow({ xp: 12000, mmr: 1480, runsCompleted: 40, wins: { easy: 3, normal: 4, hard: 2, legacy: 0 } });
      const m = mergeProfiles(local, cloud);
      expect(m.xp).toBe(300); // Season XP is NOT lifted by the old total
      expect(m.mmr).toBe(410);
      expect(m.season.id).toBe(SEASON.id);
      expect(m.lifetime.xp).toBe(12000);
      expect(m.legacy.preseason).toMatchObject({ xp: 12000, mmr: 1480, rankId: "platinum", runsCompleted: 40, titles: 9 });
      expect(m.runsCompleted).toBe(40); // lifetime counters still merge by MAX
    });

    it("two snapshots of the same pre-season merge by MAX (and keep a known position)", () => {
      const a = make({ legacy: { preseason: { xp: 5000, mmr: 1200, rankId: "gold", runsCompleted: 10, titles: 2, challengesCleared: 3, snapshotAt: "2026-10-20T00:00:00.000Z", position: null } } });
      const b = make({ legacy: { preseason: { xp: 4000, mmr: 1300, rankId: "gold", runsCompleted: 12, titles: 1, challengesCleared: 5, snapshotAt: "2026-10-21T00:00:00.000Z", position: 42 } } });
      const m = mergeProfiles(a, b);
      expect(m.legacy.preseason).toMatchObject({ xp: 5000, mmr: 1300, runsCompleted: 12, titles: 2, challengesCleared: 5, position: 42, snapshotAt: "2026-10-20T00:00:00.000Z" });
    });

    it("unions grants and the rating history, MAXes peaks and season counters", () => {
      const a = make({ grants: ["pro"], season: { ...freshSeason(), runs: 4, titles: 1, peakMmr: 460, ratingHistory: [{ t: "2026-10-22T10:00:00.000Z", delta: 10, mmr: 460, difficulty: "normal", placement: "champion", mode: "classic" }] } });
      const b = make({ grants: ["supporter"], season: { ...freshSeason(), runs: 3, titles: 0, peakMmr: 420, ratingHistory: [{ t: "2026-10-21T10:00:00.000Z", delta: -3, mmr: 420, difficulty: "normal", placement: "swiss_exit", mode: "classic" }] } });
      const m = mergeProfiles(a, b);
      expect(m.grants).toEqual(["pro", "supporter"]);
      expect(m.season.runs).toBe(4);
      expect(m.season.titles).toBe(1);
      expect(m.season.peakMmr).toBe(460);
      expect(m.season.ratingHistory.map((e) => e.t)).toEqual(["2026-10-22T10:00:00.000Z", "2026-10-21T10:00:00.000Z"]);
    });
  });

  it("ORs the Legacy unlock — once earned on either side, it survives the merge", () => {
    expect(mergeProfiles(make({ legacyUnlocked: true }), make()).legacyUnlocked).toBe(true);
    expect(mergeProfiles(make(), make({ legacyUnlocked: true })).legacyUnlocked).toBe(true);
    expect(mergeProfiles(make(), make()).legacyUnlocked).toBe(false);
  });

  it("unions collections and keeps the EARLIEST unlock date", () => {
    const a = make({ unlockedSpecials: { "sp-a": "2026-05-01", "sp-c": "2026-01-01" } });
    const b = make({ unlockedSpecials: { "sp-a": "2026-02-01", "sp-b": "2026-03-01" } });
    const m = mergeProfiles(a, b);
    expect(m.unlockedSpecials).toEqual({ "sp-a": "2026-02-01", "sp-b": "2026-03-01", "sp-c": "2026-01-01" });
  });

  it("dedupes runHistory by runId, newest first, and ORs onboarding flags", () => {
    const a = make({
      runHistory: [{ runId: "r2", date: "2026-02-02", difficulty: "normal", mode: "classic", region: null, hiddenOverall: false, placement: "champion", teamOverall: 90, swissRecord: { wins: 3, losses: 0 }, rosterNames: [], xpGained: 200 }],
      flags: { seenHowToPlay: true, seenLegacyIntro: false, seenRegionalIntro: false, seenTutorial: false },
    });
    const b = make({
      runHistory: [
        { runId: "r1", date: "2026-01-01", difficulty: "easy", mode: "classic", region: null, hiddenOverall: false, placement: "swiss_exit", teamOverall: 80, swissRecord: { wins: 1, losses: 3 }, rosterNames: [], xpGained: 50 },
        { runId: "r2", date: "2026-02-02", difficulty: "normal", mode: "classic", region: null, hiddenOverall: false, placement: "champion", teamOverall: 90, swissRecord: { wins: 3, losses: 0 }, rosterNames: [], xpGained: 200 },
      ],
      flags: { seenHowToPlay: false, seenLegacyIntro: true, seenRegionalIntro: false, seenTutorial: false },
    });
    const m = mergeProfiles(a, b);
    expect(m.runHistory.map((r) => r.runId)).toEqual(["r2", "r1"]); // newest first, deduped
    expect(m.flags.seenHowToPlay).toBe(true);
    expect(m.flags.seenLegacyIntro).toBe(true);
  });

  it("is idempotent — merging again changes nothing", () => {
    const a = make({ xp: 1000, unlockedSpecials: { "sp-a": "2026-01-01" } });
    const b = make({ xp: 2000, achievements: { "ach-y": "2026-02-01" } });
    const once = mergeProfiles(a, b);
    const twice = mergeProfiles(a, once);
    expect(twice).toEqual(once);
  });
});
