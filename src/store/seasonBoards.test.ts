/**
 * rc.54: the Season 1 boards (Miguel, 12/11). Titles per region lock, Legacy
 * titles and Road to Worlds titles are counted per season and reach the cloud
 * as their own sortable columns.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { freshSeason, mergePlaces, mergeRegionTitles, mergeSeasonState, preseasonPlaces } from "@/engine/season";
import type { Region, RunHistoryEntry, RunResults } from "@/engine/types";
import { mergeProfiles, toDurable } from "@/lib/profileSync";
import { leaderboardStats } from "@/lib/supabase";
import { useProfileStore } from "./profileStore";

const result = (placement: RunResults["placement"]): RunResults => ({
  placement,
  swissRecord: { wins: 3, losses: 0 },
  playoffWins: placement === "champion" ? 4 : 0,
  championName: "Your Team",
  bestPlayerCardId: null,
  biggestWin: null,
  closestSeries: null,
  worstLoss: null,
  goalsConceded: 15,
  unlockedSpecialIds: [],
  newAchievementIds: [],
  userGoals: 40,
  userGameWins: 20,
  xp: { lines: [], difficultyMultiplier: 1, hiddenOverallBonus: 0, total: 200 },
});

let run = 0;
const entry = (region: Region | null, difficulty: RunHistoryEntry["difficulty"] = "normal"): RunHistoryEntry => ({
  runId: `board-run-${++run}`,
  date: new Date().toISOString(),
  difficulty,
  mode: "classic",
  region,
  hiddenOverall: false,
  placement: "champion",
  teamOverall: 90,
  swissRecord: { wins: 3, losses: 0 },
  rosterNames: [],
  xpGained: 200,
});

beforeEach(() => {
  useProfileStore.getState().resetAll();
});

describe("titles per region lock", () => {
  it("a region-locked title counts for that region, this season and for life", () => {
    const apply = useProfileStore.getState().applyRunResults;
    apply(result("champion"), entry("SAM"));
    apply(result("champion"), entry("SAM", "legacy"));
    apply(result("champion"), entry("EU"));
    const p = useProfileStore.getState();
    expect(p.regionTitles).toEqual({ SAM: 2, EU: 1 });
    expect(p.season.regionTitles).toEqual({ SAM: 2, EU: 1 });
    expect(p.season.titles).toBe(3);
    expect(p.season.legacyTitles).toBe(1);
  });

  it("a worldwide title and a lost regional run count for no region", () => {
    const apply = useProfileStore.getState().applyRunResults;
    apply(result("champion"), entry(null));
    apply(result("swiss_exit"), { ...entry("NA"), placement: "swiss_exit" });
    const p = useProfileStore.getState();
    expect(p.regionTitles).toEqual({});
    expect(p.season.regionTitles ?? {}).toEqual({});
    expect(p.season.titles).toBe(1);
  });

  it("the board columns carry the season's numbers", () => {
    const apply = useProfileStore.getState().applyRunResults;
    apply(result("champion"), entry("SAM"));
    apply(result("champion"), entry("MENA", "legacy"));
    apply(result("champion"), entry("OCE"));
    apply(result("champion"), entry("NA"));
    apply(result("champion"), entry("EU"));
    useProfileStore.getState().addCareerWorlds?.(2);
    const stats = leaderboardStats(toDurable(useProfileStore.getState()), 0);
    expect(stats).toMatchObject({
      season_titles: 5,
      season_legacy_titles: 1,
      season_titles_sam: 1,
      season_titles_na: 1,
      season_titles_eu: 1,
      season_titles_oce: 1,
      season_titles_mena: 1,
    });
    expect(stats.season_worlds).toBe(useProfileStore.getState().season.careerWorlds ?? 0);
  });

  it("a save from before rc.54 (no regionTitles anywhere) reads as zero and merges", () => {
    const old = toDurable(useProfileStore.getState());
    delete (old as Partial<typeof old>).regionTitles;
    expect(leaderboardStats(old, 0).season_titles_sam).toBe(0);
    useProfileStore.getState().applyRunResults(result("champion"), entry("SAM"));
    const merged = mergeProfiles(toDurable(useProfileStore.getState()), old);
    expect(merged.regionTitles).toEqual({ SAM: 1 });
    expect(merged.season?.regionTitles).toEqual({ SAM: 1 });
  });

  it("two devices: counters take the MAX per region, never the sum", () => {
    expect(mergeRegionTitles({ SAM: 3, EU: 1 }, { SAM: 2, NA: 4 })).toEqual({ SAM: 3, EU: 1, NA: 4 });
    const a = { ...freshSeason("2026-11-12T00:00:00.000Z"), regionTitles: { SAM: 3 } };
    const b = { ...freshSeason("2026-11-12T00:00:00.000Z"), regionTitles: { SAM: 1, OCE: 2 } };
    expect(mergeSeasonState(a, b).regionTitles).toEqual({ SAM: 3, OCE: 2 });
    expect(mergeSeasonState(freshSeason(), freshSeason()).regionTitles).toBeUndefined();
  });

  it("a tour seen on one device is seen on the other", () => {
    const local = toDurable(useProfileStore.getState());
    const cloud = { ...local, tours: { draft: 1, "career.hub": 1 } };
    expect(mergeProfiles({ ...local, tours: { "career.squad": 1 } }, cloud).tours).toEqual({
      draft: 1,
      "career.hub": 1,
      "career.squad": 1,
    });
    const old = { ...local };
    delete (old as Partial<typeof old>).tours;
    expect(mergeProfiles(old, old).tours).toEqual({});
  });
});

describe("frozen pre-season places", () => {
  it("the best place per board wins a merge; unknown boards and junk are ignored", () => {
    expect(mergePlaces({ mmr: 10, championships: 3 }, { mmr: 12, best_sam: 7 })).toEqual({
      mmr: 10,
      championships: 3,
      best_sam: 7,
    });
    expect(mergePlaces(undefined, undefined)).toBeUndefined();
    expect(mergePlaces({ mmr: 0 }, {})).toBeUndefined();
  });

  it("every known place is a candidate for a reward band", () => {
    expect(preseasonPlaces({ position: 10, positions: { championships: 3 } }).sort((a, b) => a - b)).toEqual([3, 10]);
    expect(preseasonPlaces({ position: null })).toEqual([]);
    expect(preseasonPlaces(null)).toEqual([]);
  });
});
