/**
 * GAME-04 (R41) — the Match Center goal timeline. Presentation only: totals
 * and orientation must equal the engine result, regulation must allow any
 * interleaving, overtime must end regulation tied and close on the winner's
 * golden goal, and nothing may touch the competitive RNG.
 */

import { describe, expect, it } from "vitest";
import { CAREER_MATCH_CLOCK as CLOCK } from "@/config/balance";
import { simulateSeries } from "@/engine/match";
import type { GameResult, SeriesResult, TournamentTeam } from "@/engine/types";
import { createRng } from "@/lib/rng";
import {
  buildGameTimeline,
  gameScoreAB,
  type GameTimeline,
  type TimelineGoal,
} from "./matchTimeline";

const ROSTER = 3;

/** Every regulation scoreline W-L with 1 <= W <= 8 and L < W (36 of them). */
const REGULATION: [number, number][] = [];
for (let w = 1; w <= 8; w++) for (let l = 0; l < w; l++) REGULATION.push([w, l]);
/** Every overtime scoreline W-(W-1), 1-0 … 8-7. */
const OVERTIME: [number, number][] = Array.from({ length: 8 }, (_, i) => [i + 1, i] as [number, number]);

function fixture(opts: {
  aWon: boolean;
  w: number;
  l: number;
  overtime: boolean;
  seed: number;
  index?: number;
  scorers?: boolean;
}): { series: SeriesResult; game: GameResult } {
  const r = createRng(opts.seed);
  const split = (total: number) => {
    const out = new Array(ROSTER).fill(0) as number[];
    for (let i = 0; i < total; i++) out[r.int(0, ROSTER - 1)] += 1;
    return out;
  };
  const game: GameResult = {
    index: opts.index ?? 1,
    winnerTeamId: opts.aWon ? "user" : "opp",
    score: [opts.w, opts.l],
    overtime: opts.overtime,
    deciding: false,
    notes: opts.overtime ? ["overtime"] : [],
    ...(opts.scorers === false
      ? {}
      : { scorers: { a: split(opts.aWon ? opts.w : opts.l), b: split(opts.aWon ? opts.l : opts.w) } }),
  };
  const series: SeriesResult = {
    teamAId: "user",
    teamBId: "opp",
    games: [game],
    score: opts.aWon ? [1, 0] : [0, 1],
    winnerTeamId: game.winnerTeamId,
    ratingDiff: Math.round((r.next() * 10 - 5) * 10) / 10,
    upset: false,
  };
  return { series, game };
}

const goalsOf = (tl: GameTimeline): TimelineGoal[] =>
  tl.beats.filter((b): b is TimelineGoal => b.kind === "goal");

function perPlayer(tl: GameTimeline, side: "a" | "b"): number[] {
  const out = new Array(ROSTER).fill(0) as number[];
  for (const g of goalsOf(tl)) if (g.side === side && g.playerIdx !== null) out[g.playerIdx] += 1;
  return out;
}

/**
 * Every structural invariant of one timeline against its engine game, as a
 * list of violations (plain checks: the sweeps below run thousands of these).
 */
function timelineProblems(series: SeriesResult, game: GameResult, tl: GameTimeline): string[] {
  const out: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) out.push(`${game.winnerTeamId} ${game.score.join("-")}${game.overtime ? " OT" : ""}: ${what}`);
  };
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  const [goalsA, goalsB] = gameScoreAB(series, game);
  const winSide = game.winnerTeamId === series.teamAId ? "a" : "b";
  const goals = goalsOf(tl);

  // Final score = the engine's, oriented teamA/teamB.
  check(same(tl.final, [goalsA, goalsB]), `final ${tl.final} != ${goalsA}-${goalsB}`);
  check(same(tl.beats[tl.beats.length - 1]?.scoreAfter, [goalsA, goalsB]), "last beat is not the final score");
  // Per side and per player totals = the engine's.
  check(goals.length === game.score[0] + game.score[1], "goal count");
  check(goals.filter((g) => g.side === "a").length === goalsA, "team A goals");
  check(goals.filter((g) => g.side === "b").length === goalsB, "team B goals");
  if (game.scorers) {
    check(same(perPlayer(tl, "a"), game.scorers.a), "team A scorers");
    check(same(perPlayer(tl, "b"), game.scorers.b), "team B scorers");
  }
  // The running score moves one goal at a time, on the scoring side.
  let prev: [number, number] = [0, 0];
  for (const beat of tl.beats) {
    const expected: [number, number] =
      beat.kind !== "goal" ? prev : beat.side === "a" ? [prev[0] + 1, prev[1]] : [prev[0], prev[1] + 1];
    check(same(beat.scoreAfter, expected), `running score ${beat.scoreAfter} after ${prev}`);
    prev = beat.scoreAfter;
  }

  // Regulation clock: whole seconds, strictly descending, inside the window.
  const regulation = goals.filter((g) => g.period === "regulation");
  regulation.forEach((g, i) => {
    check(Number.isInteger(g.clock), `clock ${g.clock} not whole`);
    check(g.clock >= CLOCK.goalMinLeft && g.clock <= CLOCK.goalMaxLeft, `clock ${g.clock} outside the window`);
    check(g.clock !== CLOCK.regulationSeconds && g.clock !== 0, `clock ${g.clock} at 5:00 / 0:00`);
    check(!g.golden, "regulation goal marked golden");
    if (i > 0) {
      check(regulation[i - 1].clock - g.clock >= CLOCK.minGoalGapSeconds, `goals ${regulation[i - 1].clock}/${g.clock} too close`);
    }
  });

  const otIndex = tl.beats.findIndex((b) => b.kind === "overtime");
  const otBeats = tl.beats.filter((b) => b.kind === "overtime").length;
  if (game.overtime) {
    const w = game.score[0];
    // Regulation ends tied (W-1)-(W-1); the OT beat precedes the golden goal.
    check(otBeats === 1, `${otBeats} overtime beats`);
    check(otIndex === 2 * (w - 1), `OT beat at ${otIndex}`);
    check(same(tl.beats[otIndex]?.scoreAfter, [w - 1, w - 1]), "regulation did not end tied");
    check(tl.beats.length === otIndex + 2, "beats after the golden goal");
    const golden = tl.beats[otIndex + 1];
    check(golden?.kind === "goal", "no golden goal after the OT beat");
    if (golden?.kind === "goal") {
      check(golden.side === winSide, "golden goal by the loser");
      check(golden.period === "overtime" && golden.golden, "golden goal not flagged");
      check(golden.clock === tl.overtimeSeconds, "golden goal clock != OT length");
      check(Number.isInteger(golden.clock), "OT length not whole");
      check(
        golden.clock >= CLOCK.overtime.minSeconds && golden.clock <= CLOCK.overtime.maxSeconds,
        `OT length ${golden.clock} out of bounds`,
      );
    }
    check(regulation.length === 2 * (w - 1), "regulation goal count");
  } else {
    check(otBeats === 0, "overtime beat in a regulation game");
    check(tl.overtimeSeconds === null, "OT length on a regulation game");
    check(goals.every((g) => g.period === "regulation"), "OT goal in a regulation game");
  }
  return out;
}

describe("matchTimeline — structure (every scoreline 1-0 … 8-7)", () => {
  for (const aWon of [true, false]) {
    it(`regulation, team ${aWon ? "A" : "B"} wins: totals, orientation, clock`, () => {
      const problems: string[] = [];
      for (const [w, l] of REGULATION) {
        for (let seed = 1; seed <= 25; seed++) {
          const { series, game } = fixture({ aWon, w, l, overtime: false, seed: seed * 977 + w * 31 + l });
          for (const roundKey of ["sw:0", "po:3"]) {
            problems.push(...timelineProblems(series, game, buildGameTimeline(series, game, roundKey)));
          }
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
    });

    it(`overtime, team ${aWon ? "A" : "B"} wins: tied regulation, OT beat, golden goal`, () => {
      const problems: string[] = [];
      for (const [w, l] of OVERTIME) {
        for (let seed = 1; seed <= 25; seed++) {
          const { series, game } = fixture({ aWon, w, l, overtime: true, seed: seed * 613 + w });
          for (const roundKey of ["sw:4", "po:0"]) {
            problems.push(...timelineProblems(series, game, buildGameTimeline(series, game, roundKey)));
          }
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
    });
  }

  it("orients the final score to teamA/teamB whichever side won", () => {
    const aWin = fixture({ aWon: true, w: 4, l: 1, overtime: false, seed: 5 });
    const bWin = fixture({ aWon: false, w: 4, l: 1, overtime: false, seed: 5 });
    expect(gameScoreAB(aWin.series, aWin.game)).toEqual([4, 1]);
    expect(gameScoreAB(bWin.series, bWin.game)).toEqual([1, 4]);
    expect(buildGameTimeline(bWin.series, bWin.game, "sw:0").final).toEqual([1, 4]);
    const otB = fixture({ aWon: false, w: 3, l: 2, overtime: true, seed: 9 });
    expect(buildGameTimeline(otB.series, otB.game, "sw:0").final).toEqual([2, 3]);
  });

  it("a 1-0 overtime game is a scoreless regulation, the OT beat, then the golden goal", () => {
    const { series, game } = fixture({ aWon: false, w: 1, l: 0, overtime: true, seed: 3 });
    const tl = buildGameTimeline(series, game, "po:1");
    expect(tl.beats.map((b) => b.kind)).toEqual(["overtime", "goal"]);
    expect(tl.beats[0].scoreAfter).toEqual([0, 0]);
    expect(tl.final).toEqual([0, 1]);
  });

  it("games persisted without scorer data degrade to unattributed goals", () => {
    const { series, game } = fixture({ aWon: true, w: 3, l: 2, overtime: false, seed: 4, scorers: false });
    const tl = buildGameTimeline(series, game, "sw:1");
    expect(timelineProblems(series, game, tl)).toEqual([]);
    expect(goalsOf(tl).every((g) => g.playerIdx === null)).toBe(true);
  });
});

describe("matchTimeline — variety", () => {
  it("regulation: the loser opens the scoring in a real share of games (the winner too)", () => {
    let withLoserGoals = 0;
    let loserFirst = 0;
    let loserLed = 0;
    for (const [w, l] of REGULATION) {
      if (l === 0) continue;
      for (let seed = 1; seed <= 60; seed++) {
        const aWon = seed % 2 === 0;
        const { series, game } = fixture({ aWon, w, l, overtime: false, seed: seed * 7919 + w * 13 + l });
        const tl = buildGameTimeline(series, game, `sw:${seed % 5}`);
        const loserSide = aWon ? "b" : "a";
        const goals = goalsOf(tl);
        withLoserGoals += 1;
        if (goals[0].side === loserSide) loserFirst += 1;
        if (goals.some((g) => (loserSide === "a" ? g.scoreAfter[0] > g.scoreAfter[1] : g.scoreAfter[1] > g.scoreAfter[0]))) {
          loserLed += 1;
        }
      }
    }
    const share = loserFirst / withLoserGoals;
    // Uniform interleaving: the loser opens with probability L/(W+L) (≈ 0.3 on average here).
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.45);
    expect(1 - share).toBeGreaterThan(0.5);
    expect(loserLed / withLoserGoals).toBeGreaterThan(0.1);
  });

  it("3-2: every interleaving shows up, roughly uniformly (0-1, 1-1, 1-2, 2-2, 3-2 included)", () => {
    const seen = new Map<string, number>();
    const N = 1_000;
    for (let seed = 1; seed <= N; seed++) {
      const { series, game } = fixture({ aWon: true, w: 3, l: 2, overtime: false, seed });
      const tl = buildGameTimeline(series, game, "sw:2");
      const path = tl.beats.map((b) => b.scoreAfter.join("-")).join(" ");
      seen.set(path, (seen.get(path) ?? 0) + 1);
    }
    expect(seen.size).toBe(10); // C(5, 2)
    expect(seen.has("0-1 1-1 1-2 2-2 3-2")).toBe(true);
    for (const n of seen.values()) {
      expect(n).toBeGreaterThan(N / 10 / 2);
      expect(n).toBeLessThan((N / 10) * 2);
    }
  });

  it("3-0 never invents a comeback: every goal is the winner's", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { series, game } = fixture({ aWon: false, w: 3, l: 0, overtime: false, seed });
      expect(goalsOf(buildGameTimeline(series, game, "sw:0")).every((g) => g.side === "b")).toBe(true);
    }
  });

  it("overtime: either side can open a tied regulation", () => {
    let total = 0;
    let loserFirst = 0;
    for (const [w, l] of OVERTIME) {
      if (l === 0) continue;
      for (let seed = 1; seed <= 80; seed++) {
        const aWon = seed % 2 === 1;
        const { series, game } = fixture({ aWon, w, l, overtime: true, seed: seed * 104729 + w });
        const first = goalsOf(buildGameTimeline(series, game, "po:2"))[0];
        total += 1;
        if (first.side === (aWon ? "b" : "a")) loserFirst += 1;
      }
    }
    expect(loserFirst / total).toBeGreaterThan(0.35);
    expect(loserFirst / total).toBeLessThan(0.65);
  });

  it("overtime length: within [0:30, 20:00], median short, very long OTs rare", () => {
    const lengths: number[] = [];
    for (let seed = 1; seed <= 4_000; seed++) {
      const w = 1 + (seed % 6);
      const { series, game } = fixture({ aWon: seed % 2 === 0, w, l: w - 1, overtime: true, seed });
      const tl = buildGameTimeline(series, game, `po:${seed % 7}`);
      lengths.push(tl.overtimeSeconds ?? -1);
    }
    lengths.sort((x, y) => x - y);
    expect(lengths[0]).toBeGreaterThanOrEqual(CLOCK.overtime.minSeconds);
    expect(lengths[lengths.length - 1]).toBeLessThanOrEqual(CLOCK.overtime.maxSeconds);
    const median = lengths[Math.floor(lengths.length / 2)];
    expect(median).toBeLessThan(150); // configured median ≈ 1:52
    const share = (min: number) => lengths.filter((s) => s > min).length / lengths.length;
    expect(share(300)).toBeGreaterThan(0.08); // ≈ 15 %
    expect(share(300)).toBeLessThan(0.22);
    expect(share(600)).toBeGreaterThan(0.005); // ≈ 3 %: rare, but it exists
    expect(share(600)).toBeLessThan(0.06);
  });
});

describe("matchTimeline — determinism and independence", () => {
  it("same input → the identical timeline; inputs are never mutated", () => {
    const deepFreeze = <T,>(o: T): T => {
      if (o && typeof o === "object") {
        Object.values(o as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };
    for (const [w, l, ot] of [[4, 3, false], [5, 4, true], [1, 0, true], [7, 2, false]] as const) {
      const a = fixture({ aWon: false, w, l, overtime: ot, seed: 42 });
      const b = fixture({ aWon: false, w, l, overtime: ot, seed: 42 });
      deepFreeze(a.series);
      const first = buildGameTimeline(a.series, a.game, "sw:3");
      expect(buildGameTimeline(a.series, a.game, "sw:3")).toEqual(first);
      // A structurally equal copy (a reload from the persisted save) agrees too.
      expect(buildGameTimeline(b.series, b.game, "sw:3")).toEqual(first);
    }
  });

  it("the round position seeds the story: other rounds tell it differently", () => {
    const { series, game } = fixture({ aWon: true, w: 4, l: 3, overtime: false, seed: 8 });
    const stories = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(buildGameTimeline(series, game, `sw:${i}`).beats)),
    );
    expect(stories.size).toBeGreaterThan(10);
  });

  it("never draws from the competitive RNG: real series sim identically with or without timelines", () => {
    const team = (id: string, rating: number): TournamentTeam => ({
      id,
      name: id,
      isUser: id === "user",
      region: "EU",
      rating: {
        avgPlayerOverall: rating,
        coachMod: 0,
        subMod: 0,
        orgMod: 0,
        chemMod: 0,
        specialMod: 0,
        difficultyShift: 0,
        total: rating,
      },
      chemistry: { raw: 0, max: 16, percent: 0, tier: "Poor", items: [] },
      stats: { offense: 85, defense: 85, mechanics: 85, consistency: 85, experience: 85, clutch: 85 },
      specialIds: [],
      playerNames: ["P1", "P2", "P3"],
      orgId: "",
    });
    const problems: string[] = [];
    const run = (withTimelines: boolean) => {
      const rng = createRng(20_261_028);
      const out: SeriesResult[] = [];
      let otGames = 0;
      for (let i = 0; i < 120; i++) {
        const s = simulateSeries(
          team("user", 86 + (i % 5)),
          team(`ai${i}`, 85 + (i % 7)),
          { bestOf: i % 2 ? 7 : 5, stage: i % 3 ? "swiss" : "playoff", difficulty: "normal" },
          rng,
        );
        if (withTimelines) {
          for (const g of s.games) {
            problems.push(...timelineProblems(s, g, buildGameTimeline(s, g, `sw:${i % 5}`)));
            if (g.overtime) otGames += 1;
          }
        }
        out.push(s);
      }
      return { out, state: rng.state, otGames };
    };
    const plain = run(false);
    const watched = run(true);
    expect(watched.out).toEqual(plain.out);
    expect(watched.state).toBe(plain.state);
    expect(watched.otGames).toBeGreaterThan(0); // the real engine's OT games were covered
    expect(problems.slice(0, 10)).toEqual([]);
  });
});
