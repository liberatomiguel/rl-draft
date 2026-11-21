/**
 * v2.1 Matchday slice 4 - the box score. Presentation only: deterministic from
 * the result, per-player goals sum to the score exactly, assists <= goals,
 * shots >= goals, saves mirror the rival shots on target, key moments come
 * from the numbers and never repeat a template, and nothing can touch the
 * result it reads.
 */
import { describe, expect, it } from "vitest";
import { CAREER_BOXSCORE as BOX } from "@/config/balance";
import { createRng } from "@/lib/rng";
import type { GameResult, SeriesResult, TeamStyle } from "@/engine/types";
import {
  avgRatingOf,
  boxScoreSeed,
  buildGameBoxScore,
  buildSeriesBoxScore,
  foldSeasonStats,
  type BoxSide,
} from "./boxScore";
import { buildGameTimeline } from "./matchTimeline";

const NAMES: BoxSide = { playerNames: ["Ann", "Bo", "Cy"] };

function mkGame(r: ReturnType<typeof createRng>, index: number, aWins: boolean, deciding = false): GameResult {
  const ot = r.chance(0.2);
  const w = r.int(1, 6);
  const l = ot ? w - 1 : r.int(0, w - 1);
  const split = (n: number) => {
    const out = [0, 0, 0];
    for (let i = 0; i < n; i++) out[r.int(0, 2)] += 1;
    return out;
  };
  const wSide = split(w);
  const lSide = split(l);
  return {
    index,
    winnerTeamId: aWins ? "a" : "b",
    score: [w, l],
    overtime: ot,
    deciding,
    notes: [],
    scorers: aWins ? { a: wSide, b: lSide } : { a: lSide, b: wSide },
  };
}

function mkSeries(seed: number, games = 5): SeriesResult {
  const r = createRng(seed);
  const gs: GameResult[] = [];
  let a = 0;
  let b = 0;
  for (let i = 1; i <= games; i++) {
    const aWins = r.chance(0.5);
    if (aWins) a++;
    else b++;
    gs.push(mkGame(r, i, aWins, i === games));
  }
  return { teamAId: "a", teamBId: "b", games: gs, score: [a, b], winnerTeamId: a > b ? "a" : "b", ratingDiff: 1, upset: false };
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const TEAMS = { a: NAMES, b: NAMES };

describe("box score", () => {
  it("is deterministic: the same result draws the same box score", () => {
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const a = buildSeriesBoxScore(s, "sw:1", TEAMS);
      const b = buildSeriesBoxScore(structuredClone(s), "sw:1", TEAMS);
      expect(b).toEqual(a);
    }
    const s = mkSeries(7);
    expect(boxScoreSeed("sw:1", s, s.games[0])).toBe(boxScoreSeed("sw:1", s, s.games[0]));
    expect(boxScoreSeed("sw:1", s, s.games[0])).not.toBe(boxScoreSeed("sw:2", s, s.games[0]));
  });

  it("per-player goals sum to the score exactly, and the engine scorers are kept", () => {
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const box = buildSeriesBoxScore(s, "po:0", TEAMS);
      box.games.forEach((g, k) => {
        const game = s.games[k];
        for (const side of ["a", "b"] as const) {
          const goals = g.players[side].map((p) => p.goals);
          expect(goals.reduce((x, y) => x + y, 0)).toBe(g.final[side === "a" ? 0 : 1]);
          expect(goals).toEqual(game.scorers![side]);
        }
        expect(g.final).toEqual(buildGameTimeline(s, game, "po:0").final);
      });
    }
  });

  it("a legacy game without scorers still sums", () => {
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      s.games.forEach((g) => delete g.scorers);
      const box = buildSeriesBoxScore(s, "po:0", TEAMS);
      box.games.forEach((g) => {
        expect(g.players.a.reduce((x, p) => x + p.goals, 0)).toBe(g.final[0]);
        expect(g.players.b.reduce((x, p) => x + p.goals, 0)).toBe(g.final[1]);
      });
    }
  });

  it("assists <= goals, shots >= goals, saves bounded by the rival shots, ratings 0-10", () => {
    for (const seed of SEEDS) {
      const box = buildSeriesBoxScore(mkSeries(seed), "sw:0", TEAMS);
      for (const g of box.games) {
        for (const side of ["a", "b"] as const) {
          const mine = g.players[side];
          const rival = g.players[side === "a" ? "b" : "a"];
          const goals = mine.reduce((x, p) => x + p.goals, 0);
          expect(mine.reduce((x, p) => x + p.assists, 0)).toBeLessThanOrEqual(goals);
          mine.forEach((p) => {
            expect(p.shots).toBeGreaterThanOrEqual(p.goals);
            expect(p.assists).toBeLessThanOrEqual(goals - p.goals);
            expect(p.rating).toBeGreaterThanOrEqual(0);
            expect(p.rating).toBeLessThanOrEqual(10);
            expect(p.score).toBeGreaterThan(0);
          });
          const rivalShots = rival.reduce((x, p) => x + p.shots, 0);
          const rivalGoals = rival.reduce((x, p) => x + p.goals, 0);
          expect(mine.reduce((x, p) => x + p.saves, 0)).toBeLessThanOrEqual(rivalShots - rivalGoals);
        }
      }
    }
  });

  it("the series MVP is the winner top score and the totals add up", () => {
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const box = buildSeriesBoxScore(s, "sw:0", TEAMS);
      const side = s.winnerTeamId === "a" ? "a" : "b";
      expect(box.mvp!.side).toBe(side);
      const top = Math.max(...box.totals[side].map((t) => t.score));
      expect(box.totals[side][box.mvp!.playerIdx].score).toBe(top);
      box.totals[side].forEach((t, i) => {
        expect(t.games).toBe(s.games.length);
        expect(t.goals).toBe(box.games.reduce((x, g) => x + g.players[side][i].goals, 0));
      });
    }
  });

  it("never changes the winner or the score: the input is read, never written", () => {
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const before = JSON.stringify(s);
      buildSeriesBoxScore(s, "sw:3", TEAMS);
      buildGameBoxScore(s, s.games[0], "sw:3", TEAMS);
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it("key moments: capped, in match order, no repeated template", () => {
    let withMoments = 0;
    for (const seed of SEEDS) {
      const box = buildSeriesBoxScore(mkSeries(seed, 7), "po:2", TEAMS);
      const seen = new Set<string>();
      for (const g of box.games) {
        expect(g.moments.length).toBeLessThanOrEqual(BOX.momentsMax);
        if (g.moments.length >= 2) withMoments++;
        for (const m of g.moments) {
          const k = `${m.type}:${m.variant}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
          expect(m.variant).toBeLessThan(BOX.momentVariants);
          expect(m.gameIndex).toBe(g.index);
        }
        const t = g.moments.map((m) => (m.period === "overtime" ? 300 + m.clock : 300 - m.clock));
        expect([...t].sort((x, y) => x - y)).toEqual(t);
      }
    }
    expect(withMoments).toBeGreaterThan(0);
  });

  it("an overtime game carries its golden-goal moment, from the timeline", () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const box = buildSeriesBoxScore(s, "sw:1", TEAMS);
      box.games.forEach((g, k) => {
        if (!g.overtime) return;
        const m = g.moments.find((x) => x.type === "overtimeWinner");
        if (!m) return; // all three variants already used earlier in a long series
        seen++;
        const golden = buildGameTimeline(s, s.games[k], "sw:1").beats.find((b) => b.kind === "goal" && b.golden);
        expect(golden && golden.kind === "goal" ? golden.side : null).toBe(m.side);
        expect(m.period).toBe("overtime");
      });
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("a hat-trick moment only names a player with 3+ goals", () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const box = buildSeriesBoxScore(mkSeries(seed, 7), "sw:1", TEAMS);
      box.games.forEach((g) => {
        g.moments
          .filter((m) => m.type === "hatTrick")
          .forEach((m) => {
            seen++;
            expect(g.players[m.side][m.playerIdx!].goals).toBeGreaterThanOrEqual(BOX.hatTrickGoals);
          });
      });
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("style flavour", () => {
  const fit = { pressure: 0.5, possession: 0.5, counter: 0.5, individual: 0.5, teamplay: 0.5 };
  const style = (id: TeamStyle["natural"]): TeamStyle => ({ natural: id, fit });
  const sum = (box: ReturnType<typeof buildSeriesBoxScore>, side: "a" | "b", key: "demos" | "shots") =>
    box.games.reduce((x, g) => x + g.players[side].reduce((y, p) => y + p[key], 0), 0);

  it("pressure takes more demos; possession cuts the rival shots; styles off = no effect", () => {
    let demoGain = 0;
    let shotCut = 0;
    for (const seed of SEEDS) {
      const s = mkSeries(seed);
      const base = buildSeriesBoxScore(s, "sw:0", TEAMS, { styles: false });
      const press = buildSeriesBoxScore(s, "sw:0", { a: { ...NAMES, style: style("pressure") }, b: NAMES }, { styles: true });
      const poss = buildSeriesBoxScore(s, "sw:0", { a: { ...NAMES, style: style("possession") }, b: NAMES }, { styles: true });
      demoGain += sum(press, "a", "demos") - sum(base, "a", "demos");
      shotCut += sum(base, "b", "shots") - sum(poss, "b", "shots");
      const ignored = buildSeriesBoxScore(s, "sw:0", { a: { ...NAMES, style: style("pressure") }, b: NAMES }, { styles: false });
      expect(ignored).toEqual(base);
    }
    expect(demoGain).toBeGreaterThan(SEEDS.length * 5 * 1.5);
    expect(shotCut).toBeGreaterThan(SEEDS.length * 5 * 0.5);
  });
});

describe("season stats", () => {
  it("folds a series into the roster, keeps two seasons and twelve players", () => {
    const s = mkSeries(11);
    const box = buildSeriesBoxScore(s, "sw:0", TEAMS);
    const keys = ["p1", "p2", "p3"];
    let stats = foldSeasonStats(undefined, 0, box, "a", keys);
    expect(stats).toHaveLength(1);
    expect(stats[0].players.p1.games).toBe(s.games.length);
    const goals = box.totals.a[0].goals;
    expect(stats[0].players.p1.goals).toBe(goals);
    expect(avgRatingOf(stats[0].players.p1)).toBeCloseTo(box.totals.a[0].avgRating, 0);
    stats = foldSeasonStats(stats, 0, box, "a", keys);
    expect(stats[0].players.p1.goals).toBe(goals * 2);
    stats = foldSeasonStats(stats, 1, box, "a", keys);
    stats = foldSeasonStats(stats, 2, box, "a", keys);
    expect(stats.map((x) => x.seasonIndex)).toEqual([2, 1]);
    const many = Array.from({ length: 20 }, (_, i) => `k${i}`);
    const wide = foldSeasonStats(undefined, 3, box, "a", many);
    expect(Object.keys(wide[0].players).length).toBeLessThanOrEqual(BOX.playersKept);
  });
});
