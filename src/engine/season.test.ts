import { describe, expect, it } from "vitest";
import { mmrBackfillFloor, SEASON_RATING, seasonRatingAfter, seasonRatingDelta } from "@/config/balance";
import { PRESEASON_ID, SEASON } from "@/config/season";
import {
  freshSeason,
  isCurrentSeason,
  mergeRating,
  mergeSeasonState,
  mergeSnapshots,
  normalizeToSeason,
  pushRatingHistory,
  snapshotPreseason,
  type SeasonFields,
  retuneRatingHistory,
} from "./season";

const NOW = "2026-10-20T12:00:00.000Z";

function preseasonSave(over: Partial<SeasonFields> = {}): SeasonFields {
  return {
    xp: 9000,
    mmr: 1320,
    runsCompleted: 31,
    wins: { easy: 4, normal: 6, hard: 1, legacy: 0 },
    challengesCompleted: { "ch-a": NOW, "ch-b": NOW },
    ...over,
  };
}

describe("normalizeToSeason (v2.0 season reset)", () => {
  it("archives a pre-season save (no `season` block) and resets the season fields", () => {
    const out = normalizeToSeason(preseasonSave(), NOW);
    expect(out.xp).toBe(0);
    expect(out.mmr).toBe(SEASON_RATING.start);
    expect(out.challengesCompleted).toStrictEqual({});
    expect(out.season).toMatchObject({ id: SEASON.id, startedAt: NOW, runs: 0, titles: 0 });
    expect(out.lifetime).toStrictEqual({ xp: 9000 });
    expect(out.legacy?.preseason).toStrictEqual({
      xp: 9000,
      mmr: 1320,
      rankId: "platinum",
      runsCompleted: 31,
      titles: 11,
      challengesCleared: 2,
      snapshotAt: NOW,
      position: null,
    });
    // lifetime counters are not touched
    expect(out.runsCompleted).toBe(31);
    expect(out.wins.normal).toBe(6);
  });

  it("treats an explicit pre-season id the same way", () => {
    const out = normalizeToSeason(
      preseasonSave({ season: { ...freshSeason(NOW), id: PRESEASON_ID } }),
      NOW,
    );
    expect(out.xp).toBe(0);
    expect(out.legacy?.preseason?.xp).toBe(9000);
  });

  it("is idempotent: a current-season save comes back as the same object", () => {
    const once = normalizeToSeason(preseasonSave(), NOW);
    const twice = normalizeToSeason(once, "2026-11-01T00:00:00.000Z");
    expect(twice).toBe(once);
  });

  it("a current-season save that only lacks lifetime/legacy gets them without a reset", () => {
    const cur: SeasonFields = { ...preseasonSave({ xp: 700, mmr: 455 }), season: freshSeason(NOW) };
    const out = normalizeToSeason(cur, NOW);
    expect(out.xp).toBe(700);
    expect(out.mmr).toBe(455);
    expect(out.lifetime).toStrictEqual({ xp: 700 });
    expect(out.legacy).toStrictEqual({ preseason: null });
  });

  it("keeps an existing snapshot and MAXes it with the new one", () => {
    const earlier = { ...snapshotPreseason(preseasonSave({ xp: 20000 }), "2026-10-19T00:00:00.000Z")!, position: 7 };
    const out = normalizeToSeason(preseasonSave({ legacy: { preseason: earlier } }), NOW);
    expect(out.legacy?.preseason).toMatchObject({ xp: 20000, mmr: 1320, position: 7, snapshotAt: "2026-10-19T00:00:00.000Z" });
  });

  it("an untouched save (no xp, no runs) has no pre-season to remember", () => {
    const out = normalizeToSeason(
      preseasonSave({ xp: 0, mmr: 1000, runsCompleted: 0, wins: { easy: 0, normal: 0, hard: 0, legacy: 0 }, challengesCompleted: {} }),
      NOW,
    );
    expect(out.legacy?.preseason).toBeNull();
    expect(out.lifetime).toStrictEqual({ xp: 0 });
  });

  it("seeds the snapshot MMR from title history when the save predates MMR", () => {
    const save = preseasonSave({ mmr: undefined as unknown as number });
    const out = normalizeToSeason(save, NOW);
    expect(out.legacy?.preseason?.mmr).toBe(mmrBackfillFloor(save.wins));
  });
});

describe("snapshots + season merges", () => {
  it("the pre-season rank is judged on the frozen pre-season ladder, not the Season curve", () => {
    expect(snapshotPreseason(preseasonSave({ xp: 60000 }), NOW)?.rankId).toBe("supersonic-legend");
    expect(snapshotPreseason(preseasonSave({ xp: 38000 }), NOW)?.rankId).toBe("grand-champion");
    expect(snapshotPreseason(preseasonSave({ xp: 250 }), NOW)?.rankId).toBe("bronze");
  });
  it("mergeSnapshots: MAX numbers, earliest date, best known position", () => {
    const a = snapshotPreseason(preseasonSave({ xp: 5000 }), "2026-10-20T00:00:00.000Z")!;
    const b = { ...snapshotPreseason(preseasonSave({ xp: 3000, runsCompleted: 50 }), "2026-10-21T00:00:00.000Z")!, position: 12 };
    const m = mergeSnapshots(a, b)!;
    expect(m).toMatchObject({ xp: 5000, runsCompleted: 50, position: 12, snapshotAt: "2026-10-20T00:00:00.000Z", rankId: "gold" });
    expect(mergeSnapshots(null, b)).toBe(b);
    expect(mergeSnapshots(a, null)).toBe(a);
    expect(mergeSnapshots(null, undefined)).toBeNull();
  });

  it("mergeRating: more season runs wins, tie → MAX", () => {
    expect(mergeRating({ mmr: 380, runs: 9 }, { mmr: 440, runs: 4 })).toBe(380);
    expect(mergeRating({ mmr: 440, runs: 4 }, { mmr: 380, runs: 9 })).toBe(380);
    expect(mergeRating({ mmr: 410, runs: 4 }, { mmr: 430, runs: 4 })).toBe(430);
  });

  it("mergeSeasonState: MAX peaks/counters, union history newest first, higher peak rank", () => {
    const a = { ...freshSeason(NOW), runs: 3, peakMmr: 450, peakRankId: "silver", ratingHistory: [{ t: "2026-10-22T00:00:00.000Z", delta: 6, mmr: 450, difficulty: "easy" as const, placement: "champion" as const, mode: "classic" as const }] };
    const b = { ...freshSeason("2026-10-19T00:00:00.000Z"), runs: 5, titles: 2, peakMmr: 420, peakRankId: "gold", ratingHistory: [{ t: "2026-10-21T00:00:00.000Z", delta: -3, mmr: 420, difficulty: "normal" as const, placement: "swiss_exit" as const, mode: "classic" as const }] };
    const m = mergeSeasonState(a, b);
    expect(m).toMatchObject({ runs: 5, titles: 2, peakMmr: 450, peakRankId: "gold", startedAt: "2026-10-19T00:00:00.000Z" });
    expect(m.ratingHistory.map((e) => e.delta)).toEqual([6, -3]);
  });

  it("pushRatingHistory keeps newest first and caps the length", () => {
    let h: ReturnType<typeof pushRatingHistory> = [];
    for (let i = 0; i < SEASON_RATING.historyLimit + 5; i++) {
      h = pushRatingHistory(h, { t: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T00:00:0${i % 10}.000Z`, delta: 1, mmr: 400 + i, difficulty: "easy", placement: "champion", mode: "classic" });
    }
    expect(h).toHaveLength(SEASON_RATING.historyLimit);
    expect(h[0].mmr).toBe(400 + SEASON_RATING.historyLimit + 4);
  });

  it("isCurrentSeason", () => {
    expect(isCurrentSeason({ season: freshSeason() })).toBe(true);
    expect(isCurrentSeason({})).toBe(false);
    expect(isCurrentSeason({ season: { ...freshSeason(), id: 99 } })).toBe(false);
  });
});

describe("seasonRatingDelta (SEASON_RATING table)", () => {
  const base = { mode: "classic", hiddenOverall: false, seasonRunsBefore: 10 } as const;

  it("titles pay by difficulty; playoffs buckets collapse; Swiss exits cost", () => {
    expect(seasonRatingDelta({ ...base, difficulty: "normal", placement: "champion" })).toBe(4);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "champion" })).toBe(70);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "top8" })).toBe(0); // v2.0.6: only the top 4 pays
    expect(seasonRatingDelta({ ...base, difficulty: "hard", placement: "top8" })).toBe(0);
    expect(seasonRatingDelta({ ...base, difficulty: "hard", placement: "top6" })).toBe(0);
    expect(seasonRatingDelta({ ...base, difficulty: "easy", placement: "top4" })).toBe(0);
    expect(seasonRatingDelta({ ...base, difficulty: "normal", placement: "swiss_exit" })).toBe(-4);
  });

  it("the first placement runs never lose rating", () => {
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "swiss_exit", seasonRunsBefore: 0 })).toBe(0);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "swiss_exit", seasonRunsBefore: SEASON_RATING.placementRuns - 1 })).toBe(0);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "swiss_exit", seasonRunsBefore: SEASON_RATING.placementRuns })).toBe(-5);
  });

  it("mode multipliers and the hidden-overall bonus (gains only)", () => {
    expect(seasonRatingDelta({ ...base, difficulty: "normal", placement: "champion", mode: "quick" })).toBe(2);
    expect(seasonRatingDelta({ ...base, difficulty: "normal", placement: "champion", mode: "daily" })).toBe(5);
    expect(seasonRatingDelta({ ...base, difficulty: "hard", placement: "champion", hiddenOverall: true })).toBe(12);
    expect(seasonRatingDelta({ ...base, difficulty: "hard", placement: "swiss_exit", hiddenOverall: true })).toBe(-4);
  });

  it("v2.0.5: the average Legacy run out-earns the average Normal run on the first live day's results", () => {
    // Measured shares of Classic runs on 12/11/2026 (Legacy 351 runs, Normal 348).
    const ev = (difficulty: "legacy" | "normal", shares: Record<string, number>, hiddenOverall: boolean) =>
      Object.entries(shares).reduce(
        (sum, [placement, share]) => sum + share * seasonRatingDelta({ ...base, difficulty, placement: placement as never, hiddenOverall }),
        0,
      );
    const legacy = ev("legacy", { champion: 0.02, runner_up: 0.023, third: 0.054, fourth: 0.063, top6: 0.142, top8: 0.174, swiss_exit: 0.524 }, true);
    const normal = ev("normal", { champion: 0.374, runner_up: 0.227, third: 0.135, fourth: 0.098, top6: 0.106, top8: 0.032, swiss_exit: 0.029 }, false);
    expect(legacy).toBeGreaterThan(normal);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "swiss_exit" })).toBeLessThan(0); // it still punishes
  });

  it("v2.0.5: Hard and Legacy runs in the history are re-priced once; protected losses and other modes stay", () => {
    const e = (difficulty: "legacy" | "normal" | "hard", placement: string, delta: number, mmr: number) =>
      ({ t: `t${mmr}-${placement}`, delta, mmr, difficulty, placement, mode: "classic" }) as never;
    // Newest first: 400 start, protected Legacy loss (0), Normal title (+4), Legacy Swiss exit (-7), Legacy top 8 (0), Legacy title (+41).
    const history = [e("legacy", "champion", 41, 438), e("legacy", "top8", 0, 397), e("legacy", "swiss_exit", -7, 397), e("normal", "champion", 4, 404), e("legacy", "swiss_exit", 0, 400)];
    const out = retuneRatingHistory(438, history);
    expect(out.history.map((h) => h.delta)).toEqual([92, 0, -6, 4, 0]);
    expect(out.change).toBe(92 - 41 + 1);
    // A history already priced by v2.0.5 (bracket exit +6) goes back to 0.
    expect(retuneRatingHistory(406, [e("legacy", "top8", 6, 406)]).mmr).toBe(400);
    expect(out.mmr).toBe(438 + out.change);
    expect(out.history[0].mmr).toBe(out.mmr);
    expect(out.history[4].mmr).toBe(400);
    expect(retuneRatingHistory(500, [e("normal", "champion", 4, 500)]).change).toBe(0);
  });

  it("soft ceiling: above the mark a gain shrinks but never reaches 0; losses are untouched", () => {
    const c = SEASON_RATING.softCeiling;
    const at = (difficulty: "easy" | "normal" | "hard" | "legacy", placement: string, ratingBefore: number) =>
      seasonRatingDelta({ ...base, difficulty, placement: placement as never, ratingBefore });
    expect(at("normal", "champion", c.normal![0].above - 1)).toBe(4);
    expect(at("normal", "champion", c.normal![0].above)).toBe(3);
    expect(at("normal", "champion", c.normal![1].above)).toBe(2);
    expect(at("normal", "third", 5000)).toBe(1);
    expect(at("easy", "champion", c.easy![0].above)).toBe(1);
    expect(at("easy", "runner_up", 5000)).toBe(1);
    expect(at("hard", "champion", c.hard![0].above)).toBe(8);
    expect(at("hard", "champion", c.hard![1].above)).toBe(5);
    expect(at("normal", "swiss_exit", 5000)).toBe(-4);
    expect(at("legacy", "champion", c.legacy![0].above - 1)).toBe(70);
    expect(at("legacy", "champion", c.legacy![0].above)).toBe(53);
    expect(at("legacy", "champion", c.legacy![1].above)).toBe(35);
    expect(at("legacy", "swiss_exit", 9000)).toBe(-5);
    // The history re-price is frozen at the 2.0.6 table: a later retune never reaches back.
    expect(SEASON_RATING.retuneTable.legacy!.champion).toBe(80);
    expect(seasonRatingDelta({ ...base, difficulty: "legacy", placement: "champion", frozenRetune: true })).toBe(80);
    for (const steps of Object.values(c)) {
      // Steps ascend and each one trims more than the last.
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].above).toBeGreaterThan(steps[i - 1].above);
        expect(steps[i].factor).toBeLessThan(steps[i - 1].factor);
      }
    }
    for (const [difficulty, row] of Object.entries(SEASON_RATING.delta)) {
      for (const [placement, value] of Object.entries(row)) {
        const d = at(difficulty as never, placement === "playoffs" ? "top8" : placement, 99999);
        if (value > 0) expect(d).toBeGreaterThanOrEqual(1);
        else expect(d).toBe(value);
      }
    }
    // No rating given: the plain table (the v2.0.5 history re-price never applies it).
    expect(seasonRatingDelta({ ...base, difficulty: "normal", placement: "champion" })).toBe(4);
  });

  it("seasonRatingAfter floors at SEASON_RATING.floor", () => {
    expect(seasonRatingAfter(2, -5)).toBe(SEASON_RATING.floor);
    expect(seasonRatingAfter(400, 10)).toBe(410);
  });
});
