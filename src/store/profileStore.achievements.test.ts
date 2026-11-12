/**
 * E1 — the Season 1 achievements review, at the store: where each new
 * achievement is actually granted (a run, a login, a mission). The migrate's
 * silent backfill is in `profileStore.achievementsBackfill.test.ts`.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { REGION_LOCK } from "@/config/balance";
import { achievementById } from "@/data/catalog";
import { EMPTY_LOGIN, EMPTY_MISSIONS } from "@/engine/missions";
import type { Region, RunHistoryEntry, RunResults } from "@/engine/types";
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

let n = 0;
const entry = (region: Region | null, difficulty: RunHistoryEntry["difficulty"] = "normal"): RunHistoryEntry => ({
  runId: `e1-run-${++n}`,
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

const earned = () => useProfileStore.getState().achievements;

beforeEach(() => {
  useProfileStore.getState().resetAll();
});

describe("E1 — granted by a run", () => {
  it("World Circuit lands with the title in the LAST of the lockable regions, and pays its XP once", () => {
    const apply = useProfileStore.getState().applyRunResults;
    const regions = [...REGION_LOCK.regions];
    apply(result("champion"), entry(null)); // a worldwide title first, so "5 titles" lands before the last region
    for (const r of regions.slice(0, -1)) apply(result("champion"), entry(r));
    expect(earned()["ach-region-sweep"]).toBeUndefined();
    const before = useProfileStore.getState().xp;
    apply(result("champion"), entry(regions[regions.length - 1]));
    expect(earned()["ach-region-sweep"]).toBeTruthy();
    // 200 run XP + the achievement (no other counter crosses a threshold on this run).
    expect(useProfileStore.getState().xp - before).toBe(200 + achievementById.get("ach-region-sweep")!.xp);
    const again = useProfileStore.getState().xp;
    apply(result("champion"), entry(regions[0]));
    expect(useProfileStore.getState().xp - again).toBe(200);
  });

  it("a worldwide title never counts for a region; Home Turf needs 25 in ONE region", () => {
    const apply = useProfileStore.getState().applyRunResults;
    for (let i = 0; i < 6; i++) apply(result("champion"), entry(null));
    expect(earned()["ach-region-sweep"]).toBeUndefined();
    useProfileStore.setState({ regionTitles: { SAM: 24, EU: 24 } });
    apply(result("champion"), entry("NA"));
    expect(earned()["ach-region-25"]).toBeUndefined();
    apply(result("champion"), entry("SAM"));
    expect(earned()["ach-region-25"]).toBeTruthy();
  });

  it("Full Rotation and Three-Peat follow the difficulties and the Legacy streak", () => {
    const apply = useProfileStore.getState().applyRunResults;
    apply(result("champion"), entry(null, "easy"));
    apply(result("champion"), entry(null, "normal"));
    apply(result("champion"), entry(null, "hard"));
    expect(earned()["ach-all-difficulties"]).toBeUndefined();
    apply(result("champion"), entry(null, "legacy"));
    expect(earned()["ach-all-difficulties"]).toBeTruthy();
    apply(result("champion"), entry(null, "legacy"));
    expect(earned()["ach-legacy-streak-3"]).toBeUndefined();
    apply(result("champion"), entry(null, "legacy"));
    expect(earned()["ach-legacy-streak-3"]).toBeTruthy();
    expect(earned()["ach-legacy-streak-5"]).toBeUndefined();
  });
});

describe("E1 — granted outside a run", () => {
  it("the login streak awards Daily Warm-Up on the seventh day in a row, not before", () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    useProfileStore.setState({ login: { ...EMPTY_LOGIN, lastDay: yesterday, streak: 5, best: 5, total: 5 } });
    // A sixth day does not award it.
    expect(useProfileStore.getState().recordLogin().counted).toBe(true);
    expect(useProfileStore.getState().login.best).toBe(6);
    expect(earned()["ach-login-7"]).toBeUndefined();
    // The seventh does.
    useProfileStore.setState({ login: { ...useProfileStore.getState().login, lastDay: yesterday } });
    expect(useProfileStore.getState().recordLogin().counted).toBe(true);
    expect(useProfileStore.getState().login.best).toBe(7);
    expect(earned()["ach-login-7"]).toBeTruthy();
    expect(earned()["ach-login-30"]).toBeUndefined();
    // Same day again: nothing new.
    const xp = useProfileStore.getState().xp;
    expect(useProfileStore.getState().recordLogin().counted).toBe(false);
    expect(useProfileStore.getState().xp).toBe(xp);
  });

  it("a login never toasts a lifetime counter (that is the run's job)", () => {
    // A profile that satisfies volume milestones without holding them (a cloud row on a new device).
    useProfileStore.setState({
      runsCompleted: 400,
      wins: { easy: 5, normal: 5, hard: 30, legacy: 5 },
      podiums: 300,
      goalsScored: 9000,
      gamesWon: 3000,
    });
    useProfileStore.getState().recordLogin();
    expect(Object.keys(earned())).toEqual([]);
  });

  it("the mission counter is also caught by the next run (the same evaluation a completion sweeps)", () => {
    useProfileStore.setState({ missions: { ...EMPTY_MISSIONS, completedTotal: 25 } });
    useProfileStore.getState().applyRunResults(result("third"), { ...entry(null), placement: "third" });
    expect(earned()["ach-missions-25"]).toBeTruthy();
    expect(earned()["ach-missions-100"]).toBeUndefined();
  });
});
