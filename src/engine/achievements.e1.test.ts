/**
 * E1 — the Season 1 achievements review (docs/handoff-2.0/E1-achievements.md).
 * Each new achievement is proven EARNABLE: the test builds the state that
 * triggers it and the nearest state that must not. Dataset-agnostic: the
 * bracket states are built by hand, the catalogue is read for existence only.
 */
import { describe, expect, it } from "vitest";
import { REGION_LOCK } from "@/config/balance";
import { achievements } from "@/data/catalog";
import { CAREER_ACHIEVEMENTS } from "@/data/career/achievements";
import { evaluateRunAchievements, liveAchievements } from "./achievements";
import { ACH_FLAGS, EMPTY_ACHIEVEMENT_MEMORY, evaluateCareerAchievements } from "./career/achievements";
import type { CareerSave } from "./career/types";
import { STAR_2, STAR_3, STAR_CLEAR } from "./challengeStars";
import {
  CREATOR_SPECIAL_ID,
  evaluateChallengeAchievements,
  evaluateCounterAchievements,
  evaluateSeasonSystemAchievements,
  profileCounters,
  type CounterSnapshot,
} from "./counterAchievements";
import type {
  Difficulty,
  GameResult,
  PlayoffRoundName,
  RunMode,
  RunState,
  SeriesResult,
  TournamentState,
  TournamentTeam,
} from "./types";

const none = new Set<string>();
const known = new Set(achievements.map((a) => a.id));

// --- hand-built brackets ---------------------------------------------------

/** One game: `u` = the user's goals per player, `o` = the opponent's total. */
function game(u: number[], o: number, overtime = false): GameResult {
  const mine = u.reduce((x, y) => x + y, 0);
  const won = mine > o;
  return {
    index: 0,
    winnerTeamId: won ? "user" : "opp",
    score: won ? [mine, o] : [o, mine],
    overtime,
    deciding: false,
    notes: [],
    scorers: { a: u, b: [o, 0, 0] },
  };
}
const W = () => game([1, 1, 0], 1);
const L = () => game([1, 0, 0], 2);
/** A series from a pattern ("LLLWWWW"); the user is team A. */
function series(pattern: string, over: Partial<SeriesResult> = {}, lastGame?: GameResult): SeriesResult {
  const games = [...pattern].map((c) => (c === "W" ? W() : L()));
  if (lastGame) games[games.length - 1] = lastGame;
  const wins = games.filter((g) => g.winnerTeamId === "user").length;
  const losses = games.length - wins;
  return {
    teamAId: "user",
    teamBId: "opp",
    games,
    score: [wins, losses],
    winnerTeamId: wins > losses ? "user" : "opp",
    ratingDiff: 0,
    upset: false,
    ...over,
  };
}
const userTeam = (over: Partial<TournamentTeam> = {}): TournamentTeam =>
  ({
    id: "user",
    name: "User",
    isUser: true,
    region: "EU",
    rating: { avgPlayerOverall: 92, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: 92 },
    chemistry: { raw: 1, max: 4, percent: 25, tier: "Poor", items: [] },
    stats: {},
    specialIds: [],
    playerNames: ["a", "b", "c"],
    orgId: "org",
    ...over,
  }) as unknown as TournamentTeam;

function tournament(
  swiss: SeriesResult[],
  playoffs: [PlayoffRoundName, SeriesResult][],
  over: { champion?: boolean; team?: Partial<TournamentTeam> } = {},
): TournamentState {
  const wins = swiss.filter((s) => s.winnerTeamId === "user").length;
  return {
    teams: { user: userTeam(over.team) },
    swiss: {
      rounds: swiss.map((s, i) => ({ round: i + 1, series: [s], userSeriesIndex: 0 })),
      records: [{ teamId: "user", wins, losses: swiss.length - wins, gameDiff: 0, status: wins >= 3 ? "advanced" : "eliminated" }],
      nextPairings: null,
      finished: true,
    },
    playoffs: playoffs.length
      ? {
          format: "double",
          seeds: ["user"],
          rounds: playoffs.map(([name, s]) => ({ name, series: [s] })),
          championTeamId: over.champion === false ? "opp" : "user",
          finished: true,
        }
      : null,
    stage: "finished",
    userEliminated: false,
  };
}
const run = (over: { mode?: RunMode; difficulty?: Difficulty; showOverall?: boolean; regionLock?: RunState["regionLock"] } = {}): RunState =>
  ({ mode: "classic", difficulty: "normal", showOverall: true, draft: { roster: {} }, ...over }) as unknown as RunState;

const SWEEP3 = () => [series("WWW"), series("WWW"), series("WWW")];
const CLEAN_PLAYOFFS = (): [PlayoffRoundName, SeriesResult][] => [
  ["ub_quarterfinal", series("WWWW")],
  ["ub_semifinal", series("WWWW")],
  ["ub_final", series("WWWW")],
  ["grand_final", series("WWWW")],
];
const got = (r: RunState, t: TournamentState) => evaluateRunAchievements(r, t, none);

describe("E1 — the catalogue", () => {
  it("every id the review awards exists; the retired ids are gone", () => {
    for (const id of [
      "ach-double-hat-trick", "ach-final-comeback", "ach-final-reverse-sweep", "ach-giant-killer", "ach-heartbreak",
      "ach-flawless-run", "ach-swiss-escape", "ach-lower-bracket-full", "ach-low-ovr-title", "ach-blind-title",
      "ach-creator-title", "ach-all-difficulties", "ach-hard-10", "ach-podiums-100", "ach-daily-30",
      "ach-legacy-streak-3", "ach-legacy-streak-5", "ach-region-sweep", "ach-region-25", "ach-legendaries-all",
      "ach-stars-45", "ach-stars-90", "ach-stars-all", "ach-quiz-streak-7", "ach-quiz-streak-30",
      "ach-quiz-last-guess", "ach-login-7", "ach-login-30", "ach-missions-25", "ach-missions-100",
    ]) {
      expect(known.has(id), id).toBe(true);
    }
    for (const id of [
      "ach-hattrick", "ach-four-goals", "ach-blowout", "ach-solo-show", "ach-giant-slayer", "ach-swiss-flawless",
      "ach-goals-100", "ach-goals-250", "ach-games-50", "ach-open-era-title",
      "ach-all-eu", "ach-all-na", "ach-all-sam", "ach-all-oce", "ach-all-mena",
    ]) {
      expect(known.has(id), id).toBe(false);
    }
  });

  it("XP follows the tier, and the secrets carry the flag", () => {
    const xp = { common: 100, rare: 250, epic: 600, legend: 1500 } as const;
    for (const a of achievements) expect(a.xp, a.id).toBe(xp[a.category]);
    const secrets = achievements.filter((a) => a.secret).map((a) => a.id);
    expect(secrets).toEqual(expect.arrayContaining([
      "ach-final-reverse-sweep", "ach-heartbreak", "ach-flawless-run", "ach-swiss-escape",
      "ach-creator-title", "ach-legacy-streak-5", "ach-quiz-last-guess",
    ]));
  });

  it("nothing the engine can award is missing from the catalogue (no dead ids either way)", () => {
    // A run that trips every run feat at once would be contradictory, so this
    // checks the other direction: a flawless Easy title awards only known ids.
    for (const id of got(run({ difficulty: "easy" }), tournament(SWEEP3(), CLEAN_PLAYOFFS()))) {
      expect(known.has(id), id).toBe(true);
    }
  });
});

describe("E1 — a first run earns nothing by accident", () => {
  it("an ordinary Normal title (hat-tricks, a 3-0 Swiss, an upset) awards none of the new feats", () => {
    const upset = series("WWWLW", { ratingDiff: -1 });
    upset.games[0] = game([4, 0, 0], 0); // four by one player, a clean sheet game
    const t = tournament([upset, series("WWW"), series("WWW")], [
      ["ub_quarterfinal", series("WWLWW")],
      ["ub_semifinal", series("WLWWLW")],
      ["ub_final", series("WWWLW")],
      ["grand_final", series("WLWLWW", { ratingDiff: -1.9 })],
    ]);
    const ids = got(run(), t);
    for (const id of [
      "ach-double-hat-trick", "ach-final-comeback", "ach-final-reverse-sweep", "ach-giant-killer", "ach-heartbreak",
      "ach-flawless-run", "ach-swiss-escape", "ach-lower-bracket-full", "ach-low-ovr-title", "ach-blind-title", "ach-creator-title",
    ]) {
      expect(ids, id).not.toContain(id);
    }
    // The hooks a new player does get.
    expect(ids).toEqual(expect.arrayContaining(["ach-first-team", "ach-first-title", "ach-undefeated"]));
  });
});

describe("E1 — live feats (fire when the series is revealed)", () => {
  it("Double Hat-Trick: six by one player, not five", () => {
    const five = tournament([series("WWW", {}, game([5, 2, 2], 0))], []);
    const six = tournament([series("WWW", {}, game([6, 0, 0], 3))], []);
    expect(liveAchievements(five, none)).not.toContain("ach-double-hat-trick");
    expect(liveAchievements(six, none)).toContain("ach-double-hat-trick");
  });

  it("Never Out of It / The Impossible Comeback: a final won from two and from three games down", () => {
    const from2 = tournament(SWEEP3(), [["grand_final", series("LLWWWW")]]);
    const from3 = tournament(SWEEP3(), [["grand_final", series("LLLWWWW")]]);
    const from1 = tournament(SWEEP3(), [["grand_final", series("LWWWW")]]);
    const notFinal = tournament(SWEEP3(), [["ub_final", series("LLLWWWW")]]);
    expect(liveAchievements(from1, none)).not.toContain("ach-final-comeback");
    expect(liveAchievements(from2, none)).toContain("ach-final-comeback");
    expect(liveAchievements(from2, none)).not.toContain("ach-final-reverse-sweep");
    expect(liveAchievements(from3, none)).toEqual(expect.arrayContaining(["ach-final-comeback", "ach-final-reverse-sweep"]));
    expect(liveAchievements(notFinal, none)).not.toContain("ach-final-reverse-sweep");
    // Still a plain reverse sweep (the older, easier achievement) in any series.
    expect(liveAchievements(notFinal, none)).toContain("ach-reverse-sweep");
  });

  it("Giant Killer: the beaten finalist stood 2+ rating points above", () => {
    const by = (ratingDiff: number, round: PlayoffRoundName = "grand_final") =>
      liveAchievements(tournament(SWEEP3(), [[round, series("WWWW", { ratingDiff })]]), none);
    expect(by(-1.9)).not.toContain("ach-giant-killer");
    expect(by(-2)).toContain("ach-giant-killer");
    expect(by(-4, "ub_final")).not.toContain("ach-giant-killer");
    // The user as team B: the sign flips.
    const asB = series("WWWW", { ratingDiff: 3 });
    const flipped: SeriesResult = { ...asB, teamAId: "opp", teamBId: "user" };
    expect(liveAchievements(tournament(SWEEP3(), [["grand_final", flipped]]), none)).toContain("ach-giant-killer");
  });

  it("Heartbreaker (secret): a final LOST in game 7 overtime, and only that", () => {
    const lostOt = tournament(SWEEP3(), [["grand_final", series("WLWLWLL", {}, game([1, 0, 0], 2, true))]], { champion: false });
    const lostReg = tournament(SWEEP3(), [["grand_final", series("WLWLWLL")]], { champion: false });
    const wonOt = tournament(SWEEP3(), [["grand_final", series("WLWLWLW", {}, game([2, 0, 0], 1, true))]]);
    expect(liveAchievements(lostOt, none)).toContain("ach-heartbreak");
    expect(liveAchievements(lostReg, none)).not.toContain("ach-heartbreak");
    expect(liveAchievements(wonOt, none)).not.toContain("ach-heartbreak");
    expect(liveAchievements(wonOt, none)).toContain("ach-ot-game7");
    // Not before the final is on screen (reveal scoping).
    expect(liveAchievements(lostOt, none, 3)).not.toContain("ach-heartbreak");
  });
});

describe("E1 — run-end feats", () => {
  it("Perfect Event (secret): no game lost, Classic, Hard or Legacy only", () => {
    const perfect = () => tournament(SWEEP3(), CLEAN_PLAYOFFS());
    expect(got(run({ difficulty: "hard" }), perfect())).toContain("ach-flawless-run");
    expect(got(run({ difficulty: "legacy" }), perfect())).toContain("ach-flawless-run");
    expect(got(run({ difficulty: "easy" }), perfect())).not.toContain("ach-flawless-run");
    expect(got(run({ difficulty: "normal" }), perfect())).not.toContain("ach-flawless-run");
    expect(got(run({ difficulty: "hard", mode: "quick" }), perfect())).not.toContain("ach-flawless-run");
    const oneGame = tournament([series("WLWW"), series("WWW"), series("WWW")], CLEAN_PLAYOFFS());
    expect(got(run({ difficulty: "hard" }), oneGame)).not.toContain("ach-flawless-run");
    // Undefeated in series is the older, easier one.
    expect(got(run({ difficulty: "hard" }), oneGame)).toContain("ach-undefeated");
  });

  it("Back from the Brink (secret): 0-2, three straight wins, the playoffs (no title needed)", () => {
    const escape = [series("LLL"), series("LWLL"), series("WWW"), series("WWW"), series("WWW")];
    const out = tournament(escape, [["ub_quarterfinal", series("LLLL")], ["lb_round1", series("LLLL")]], { champion: false });
    expect(got(run(), out)).toContain("ach-swiss-escape");
    // 1-1 start: no. 0-2 and out at 2-3: no (never reached the playoffs).
    const even = tournament([series("LLL"), series("WWW"), series("WWW"), series("WWW")], [["ub_quarterfinal", series("LLLL")]], { champion: false });
    expect(got(run(), even)).not.toContain("ach-swiss-escape");
    const eliminated = tournament([series("LLL"), series("LLL"), series("WWW"), series("WWW"), series("LLL")], [], { champion: false });
    expect(got(run(), eliminated)).not.toContain("ach-swiss-escape");
  });

  it("The Longest Road: the title after losing the first playoff series", () => {
    const long = tournament(SWEEP3(), [
      ["ub_quarterfinal", series("LLLL")],
      ["lb_round1", series("WWWW")],
      ["lb_round2", series("WWWW")],
      ["lb_semifinal", series("WWWW")],
      ["lb_final", series("WWWW")],
      ["grand_final", series("WWWW")],
    ]);
    const late = tournament(SWEEP3(), [
      ["ub_quarterfinal", series("WWWW")],
      ["ub_semifinal", series("LLLL")],
      ["lb_semifinal", series("WWWW")],
      ["lb_final", series("WWWW")],
      ["grand_final", series("WWWW")],
    ]);
    expect(got(run(), long)).toEqual(expect.arrayContaining(["ach-lower-bracket", "ach-lower-bracket-full"]));
    expect(got(run(), late)).toContain("ach-lower-bracket");
    expect(got(run(), late)).not.toContain("ach-lower-bracket-full");
    // Losing the grand final afterwards earns nothing.
    const lost = tournament(SWEEP3(), [["ub_quarterfinal", series("LLLL")], ["grand_final", series("LLLL")]], { champion: false });
    expect(got(run(), lost)).not.toContain("ach-lower-bracket-full");
  });

  it("Moneyball: a worldwide Classic Hard / Legacy title at team overall 90 or lower", () => {
    const at = (total: number, shift = 0) =>
      tournament(SWEEP3(), CLEAN_PLAYOFFS().slice(0, 3).concat([["grand_final", series("WWLWW")]]), {
        team: { rating: { avgPlayerOverall: total, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: shift, total } },
      });
    expect(got(run({ difficulty: "hard" }), at(90))).toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "legacy" }), at(89))).toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "hard" }), at(91))).not.toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "normal" }), at(85))).not.toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "hard", regionLock: "SAM" }), at(88))).not.toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "hard", mode: "quick" }), at(88))).not.toContain("ach-low-ovr-title");
    expect(got(run({ difficulty: "hard", mode: "daily" }), at(88))).not.toContain("ach-low-ovr-title");
  });

  it("Eye Test: a Normal title with overalls hidden by choice", () => {
    const t = () => tournament(SWEEP3(), CLEAN_PLAYOFFS());
    expect(got(run({ showOverall: false }), t())).toContain("ach-blind-title");
    expect(got(run({ showOverall: true }), t())).not.toContain("ach-blind-title");
    // Hard and Legacy lock the overalls: no choice, no achievement.
    expect(got(run({ difficulty: "hard", showOverall: false }), t())).not.toContain("ach-blind-title");
    expect(got(run({ showOverall: false, mode: "daily" }), t())).not.toContain("ach-blind-title");
    expect(got(run({ showOverall: false }), tournament(SWEEP3(), CLEAN_PLAYOFFS(), { champion: false }))).not.toContain("ach-blind-title");
  });

  it("Dev Build (secret): the Creator card on the title-winning team", () => {
    const withCreator = (champion: boolean) =>
      tournament(SWEEP3(), CLEAN_PLAYOFFS(), { champion, team: { specialIds: [CREATOR_SPECIAL_ID] } });
    expect(got(run(), withCreator(true))).toContain("ach-creator-title");
    expect(got(run(), withCreator(false))).not.toContain("ach-creator-title");
    expect(got(run(), tournament(SWEEP3(), CLEAN_PLAYOFFS()))).not.toContain("ach-creator-title");
  });
});

describe("E1 — profile counters", () => {
  const base: CounterSnapshot = {
    runsCompleted: 0, titlesTotal: 0, legacyTitles: 0, gamesWon: 0, goalsScored: 0,
    specialsOwned: 0, totalSpecials: 80, specialIds: new Set(), dailyStreak: 0, rankId: "bronze",
  };
  const ids = (over: Partial<CounterSnapshot>) => evaluateCounterAchievements({ ...base, ...over }, none);

  it("a brand-new profile earns none of them", () => {
    const fresh = ids(profileCounters({ wins: { easy: 0, normal: 0, hard: 0, legacy: 0 } }));
    expect(fresh).toEqual([]);
  });

  it("World Circuit: a Region-only title in EVERY lockable region; Home Turf: 25 in one", () => {
    const all = Object.fromEntries(REGION_LOCK.regions.map((r) => [r, 1]));
    const missingOne = Object.fromEntries(REGION_LOCK.regions.slice(1).map((r) => [r, 9]));
    expect(ids({ regionTitles: all })).toContain("ach-region-sweep");
    expect(ids({ regionTitles: missingOne })).not.toContain("ach-region-sweep");
    expect(ids({})).not.toContain("ach-region-sweep");
    // A key that is not a lockable region never counts (old saves wrote "worldwide").
    expect(ids({ regionTitles: { ...missingOne, worldwide: 50 } })).not.toContain("ach-region-sweep");
    expect(ids({ regionTitles: { worldwide: 50 } })).not.toContain("ach-region-25");
    expect(ids({ regionTitles: { [REGION_LOCK.regions[0]]: 24 } })).not.toContain("ach-region-25");
    expect(ids({ regionTitles: { [REGION_LOCK.regions[0]]: 25 } })).toContain("ach-region-25");
  });

  it("Full Rotation, Hard Carry, Podium Regular, Daily Driver read the lifetime facts", () => {
    const p = profileCounters({
      wins: { easy: 1, normal: 2, hard: 10, legacy: 1 },
      podiums: 100,
      dailyResults: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`2026-01-${i + 1}`, { placement: "champion" }])),
    });
    expect(ids(p)).toEqual(expect.arrayContaining(["ach-all-difficulties", "ach-hard-10", "ach-podiums-100", "ach-daily-30"]));
    const short = profileCounters({
      wins: { easy: 5, normal: 5, hard: 9, legacy: 0 },
      podiums: 99,
      dailyResults: { a: { placement: "champion" }, b: { placement: "runner_up" } },
    });
    const none4 = ids(short);
    for (const id of ["ach-all-difficulties", "ach-hard-10", "ach-podiums-100", "ach-daily-30"]) expect(none4).not.toContain(id);
  });

  it("Three-Peat and Unbreakable (secret) read the best Legacy streak", () => {
    expect(ids({ legacyStreakBest: 2 })).not.toContain("ach-legacy-streak-3");
    expect(ids({ legacyStreakBest: 3 })).toContain("ach-legacy-streak-3");
    expect(ids({ legacyStreakBest: 4 })).not.toContain("ach-legacy-streak-5");
    expect(ids({ legacyStreakBest: 5 })).toEqual(expect.arrayContaining(["ach-legacy-streak-2", "ach-legacy-streak-3", "ach-legacy-streak-5"]));
  });

  it("Hall of Legends: every Legendary card owned (the catalogue decides how many)", () => {
    const total = profileCounters({ wins: { easy: 0, normal: 0, hard: 0, legacy: 0 } }).legendariesTotal ?? 0;
    expect(total).toBeGreaterThan(0);
    expect(ids({ legendariesOwned: total - 1, legendariesTotal: total })).not.toContain("ach-legendaries-all");
    expect(ids({ legendariesOwned: total, legendariesTotal: total })).toContain("ach-legendaries-all");
    expect(ids({ legendariesOwned: 0, legendariesTotal: 0 })).not.toContain("ach-legendaries-all");
  });

  it("quiz, login and mission counters fire at their thresholds, alone or inside the run evaluation", () => {
    const sys = (s: Parameters<typeof evaluateSeasonSystemAchievements>[0]) => evaluateSeasonSystemAchievements(s, none);
    expect(sys({ quizBestStreak: 6, loginBest: 6, missionsCompleted: 24 })).toEqual([]);
    expect(sys({ quizBestStreak: 7, loginBest: 7, missionsCompleted: 25 })).toEqual(["ach-quiz-streak-7", "ach-login-7", "ach-missions-25"]);
    expect(sys({ quizBestStreak: 30, loginBest: 30, missionsCompleted: 100 })).toEqual([
      "ach-quiz-streak-7", "ach-quiz-streak-30", "ach-login-7", "ach-login-30", "ach-missions-25", "ach-missions-100",
    ]);
    expect(evaluateSeasonSystemAchievements({ loginBest: 7 }, new Set(["ach-login-7"]))).toEqual([]);
    expect(ids({ loginBest: 30 })).toEqual(expect.arrayContaining(["ach-login-7", "ach-login-30"]));
  });

  it("challenge stars: 45, 90 and every star on every challenge", () => {
    const all = STAR_CLEAR | STAR_2 | STAR_3;
    const challengeIds = Array.from({ length: 45 }, (_, i) => `c${i}`);
    const stars = (n: number, mask: number) => Object.fromEntries(challengeIds.slice(0, n).map((id) => [id, mask]));
    const completed = (n: number) => Object.fromEntries(challengeIds.slice(0, n).map((id) => [id, "d"]));
    const ev = (s: Record<string, number>, c: Record<string, string>) =>
      evaluateChallengeAchievements({ stars: s, completed: c, challengeIds }, none);
    expect(ev({}, {})).toEqual([]);
    expect(ev(stars(1, all), completed(1))).toEqual(["ach-challenge-perfect"]);
    expect(ev(stars(44, STAR_CLEAR), completed(44))).toEqual([]);
    expect(ev(stars(45, STAR_CLEAR), completed(45))).toEqual(["ach-challenge-all", "ach-stars-45"]);
    expect(ev(stars(30, all), completed(30))).toEqual(["ach-challenge-perfect", "ach-stars-45", "ach-stars-90"]);
    expect(ev(stars(45, STAR_CLEAR | STAR_2), completed(45))).not.toContain("ach-stars-all");
    expect(ev(stars(45, all), completed(45))).toEqual(["ach-challenge-perfect", "ach-challenge-all", "ach-stars-45", "ach-stars-90", "ach-stars-all"]);
    // An empty catalogue awards nothing.
    expect(evaluateChallengeAchievements({ stars: {}, completed: {}, challengeIds: [] }, none)).toEqual([]);
  });
});

describe("E1 — Road to Worlds", () => {
  const save = (over: { stats?: Record<string, number>; flags?: Record<string, unknown>; seasonIndex?: number }): CareerSave =>
    ({
      difficulty: "normal",
      reputation: 0,
      clock: { seasonIndex: over.seasonIndex ?? 0, day: 1 },
      flags: over.flags ?? {},
      stats: { titlesRegional: 0, titlesMajor: 0, titlesWorlds: 0, majorsQualified: 0, worldsQualified: 0, ...(over.stats ?? {}) },
    }) as unknown as CareerSave;
  const fresh = (s: CareerSave) => evaluateCareerAchievements(s, EMPTY_ACHIEVEMENT_MEMORY);
  const E1 = ["car-seven-seasons", "car-worlds-regular", "car-five-regionals", "car-three-majors", "car-two-worlds", "car-worlds-unchanged", "car-perfect-season"];

  it("the seven new ids are in the catalogue, inside the mode's XP range", () => {
    for (const id of E1) {
      const def = CAREER_ACHIEVEMENTS.find((a) => a.id === id);
      expect(def, id).toBeTruthy();
      expect(def!.xp).toBeGreaterThan(0);
      expect(def!.xp).toBeLessThanOrEqual(800);
    }
  });

  it("a first Worlds title earns none of them", () => {
    const first = fresh(save({ stats: { titlesWorlds: 1, titlesRegional: 2, titlesMajor: 1, worldsQualified: 1, majorsQualified: 1 }, seasonIndex: 2 }));
    expect(first).toContain("car-first-worlds");
    for (const id of E1) expect(first, id).not.toContain(id);
  });

  it("each one unlocks from the stat or flag the flows already record", () => {
    expect(fresh(save({ seasonIndex: 5 }))).not.toContain("car-seven-seasons");
    expect(fresh(save({ seasonIndex: 6 }))).toContain("car-seven-seasons");
    expect(fresh(save({ stats: { worldsQualified: 3 } }))).toContain("car-worlds-regular");
    expect(fresh(save({ stats: { titlesRegional: 4 } }))).not.toContain("car-five-regionals");
    expect(fresh(save({ stats: { titlesRegional: 5 } }))).toContain("car-five-regionals");
    expect(fresh(save({ stats: { titlesMajor: 3 } }))).toContain("car-three-majors");
    expect(fresh(save({ stats: { titlesWorlds: 2 } }))).toEqual(expect.arrayContaining(["car-first-worlds", "car-two-worlds"]));
    expect(fresh(save({ stats: { titlesWorlds: 2 } }))).not.toContain("car-three-worlds");
    expect(fresh(save({ stats: { titlesWorlds: 1 }, flags: { [ACH_FLAGS.dayOne]: true } }))).toContain("car-worlds-unchanged");
    expect(fresh(save({ stats: { titlesWorlds: 1 }, flags: { [ACH_FLAGS.regionalDynasty]: true } }))).toContain("car-perfect-season");
  });
});
