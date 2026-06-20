import { describe, expect, it } from "vitest";
import { mergeProfiles, type DurableProfile } from "./profileSync";

function make(over: Partial<DurableProfile> = {}): DurableProfile {
  return {
    xp: 0,
    mmr: 1000,
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

  it("seeds MMR to the start floor for legacy rows saved before MMR existed (never drags down)", () => {
    const withMmr = make({ mmr: 1600 });
    // Simulate a pre-MMR cloud row: mmr field absent at runtime.
    const legacy = make();
    delete (legacy as Partial<DurableProfile>).mmr;
    expect(mergeProfiles(withMmr, legacy).mmr).toBe(1600); // earned value survives
    expect(mergeProfiles(legacy, withMmr).mmr).toBe(1600);
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
