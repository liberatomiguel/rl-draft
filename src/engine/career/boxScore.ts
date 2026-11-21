/**
 * Road to Worlds — the box score (v2.1 Matchday slice 4, MATCHDAY-SPEC §3 C and
 * §8, R137 option B). Pure TS. An extension of matchTimeline.ts.
 *
 * The engine settles a game as a winner, a winner-first scoreline, an overtime
 * flag and per-player goal counts. This turns that settled result into the
 * numbers a box score shows: goals, assists, shots, saves, demos, in-game score
 * and a 0-10 rating per player, the series MVP, and 2-4 key moments per game.
 *
 * Presentation only. It READS the result and never writes it: the winner and
 * the score cannot move. Every game rolls on a LOCAL mulberry32 seeded by a
 * hash of the persisted result (timelineSeed plus a fixed salt), so the same
 * result always draws the same box score and the competitive RNG is never
 * touched. It is built only for series someone opens, so the world simulation
 * does not pay for it.
 *
 * Invariants (boxScore.test.ts):
 *  - the per-player goals of a side sum to that side's score exactly, and the
 *    goals are the engine's own `scorers` counts when it recorded them;
 *  - assists <= goals per side and per player never exceeds its team's goals
 *    scored by the others; shots >= goals;
 *  - one side's saves are the other side's shots on target minus its goals;
 *  - the key moments come from the box score and the goal timeline, so they
 *    always match the result; no template repeats inside one series.
 */

import { CAREER_BOXSCORE as BOX, FEATURES } from "@/config/balance";
import { createRng, type Rng } from "@/lib/rng";
import type { GameResult, PlayStyleId, SeriesResult, TeamStyle } from "@/engine/types";
import { buildGameTimeline, timelineSeed, type ClockPeriod, type TimelineGoal, type TimelineSide } from "./matchTimeline";
import { deriveSeed } from "./seeds";
import { playedStyle } from "./styles";

/** The slice of a TournamentTeam the box score reads. */
export interface BoxSide {
  playerNames: string[];
  style?: TeamStyle;
}

export interface PlayerLine {
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  demos: number;
  /** In-game points (CAREER_BOXSCORE.points). */
  score: number;
  /** 0-10, one decimal. */
  rating: number;
}

export type MomentType =
  | "overtimeWinner"
  | "comeback"
  | "hatTrick"
  | "cleanSheet"
  | "lateGoal"
  | "saveMarathon"
  | "demoBlitz"
  | "decider";

export interface KeyMoment {
  type: MomentType;
  gameIndex: number;
  side: TimelineSide;
  /** Roster index into that side's playerNames (null = unattributed). */
  playerIdx: number | null;
  period: ClockPeriod;
  /** Regulation: seconds LEFT. Overtime: seconds PLAYED (as the timeline). */
  clock: number;
  /** Which text variant of the type (0..momentVariants-1). */
  variant: number;
  /** The number the line quotes: goals, saves, demos, or the deficit overcome. */
  n: number;
}

export interface GameBoxScore {
  index: number;
  /** Final score, teamA first. */
  final: [number, number];
  overtime: boolean;
  players: Record<TimelineSide, PlayerLine[]>;
  /** The best player of the game (winning side), by rating then score. */
  mvp: { side: TimelineSide; playerIdx: number } | null;
  /** In match order. */
  moments: KeyMoment[];
}

/** A player's totals over the series. */
export interface PlayerSeriesLine extends PlayerLine {
  games: number;
  /** Mean of the per-game ratings, one decimal. */
  avgRating: number;
}

export interface SeriesBoxScore {
  games: GameBoxScore[];
  totals: Record<TimelineSide, PlayerSeriesLine[]>;
  /** The series MVP: the winning side's top score (ties: rating, then roster order). */
  mvp: { side: TimelineSide; playerIdx: number } | null;
}

export interface BoxOptions {
  /** Read the play styles. Default FEATURES.matchdayStyles. */
  styles?: boolean;
}

const BOX_SALT = 0x5b0c_5c0e;

/** Stable seed of one game's box score (the timeline's seed, re-salted). */
export function boxScoreSeed(roundKey: string, series: SeriesResult, game: GameResult): number {
  return deriveSeed(BOX_SALT, `bs:${timelineSeed(roundKey, series, game)}`);
}

const emptyLine = (): PlayerLine => ({ goals: 0, assists: 0, shots: 0, saves: 0, demos: 0, score: 0, rating: 0 });

/** `total` units spread over players by weight, one draw each (always sums to total). */
function spread(total: number, weights: number[], rng: Rng): number[] {
  const out = weights.map(() => 0);
  const idxs = weights.map((_, i) => i);
  for (let k = 0; k < total; k++) out[rng.weightedPick(idxs, (i) => weights[i])] += 1;
  return out;
}

const weightsOf = (n: number, rng: Rng): number[] => Array.from({ length: n }, () => 1 + rng.range(-BOX.roleNoise, BOX.roleNoise));

const rangeInt = (rng: Rng, r: readonly [number, number]) => rng.int(r[0], r[1]);

function styleOf(side: BoxSide | undefined, on: boolean): PlayStyleId | null {
  return on && side?.style ? playedStyle(side.style) : null;
}

function rate(line: PlayerLine, won: boolean): number {
  const R = BOX.rating;
  const raw =
    R.base +
    (won ? R.win : R.loss) +
    line.goals * R.goal +
    line.assists * R.assist +
    line.saves * R.save +
    line.demos * R.demo -
    Math.max(0, line.shots - line.goals) * R.missedShot;
  return Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10;
}

function scoreOf(line: PlayerLine): number {
  const P = BOX.points;
  return P.participation + line.goals * P.goal + line.assists * P.assist + line.saves * P.save + line.shots * P.shot + line.demos * P.demo;
}

interface GameCore {
  box: Omit<GameBoxScore, "moments">;
  /** Every notable thing that happened, best first; the series picks and words them. */
  candidates: (Omit<KeyMoment, "variant"> & { priority: number; filler: boolean })[];
}

function buildGameCore(
  series: SeriesResult,
  game: GameResult,
  roundKey: string,
  sides: Record<TimelineSide, BoxSide | undefined>,
  useStyles: boolean,
): GameCore {
  const rng = createRng(boxScoreSeed(roundKey, series, game));
  const timeline = buildGameTimeline(series, game, roundKey);
  const [totalA, totalB] = timeline.final;
  const final: [number, number] = [totalA, totalB];
  const winSide: TimelineSide = game.winnerTeamId === series.teamAId ? "a" : "b";
  const loseSide: TimelineSide = winSide === "a" ? "b" : "a";
  const goalsOf: Record<TimelineSide, number> = { a: totalA, b: totalB };

  const size = (s: TimelineSide) =>
    Math.max(sides[s]?.playerNames.length ?? 0, (game.scorers?.[s] ?? []).length, 1, ...timeline.beats.map((b) => (b.kind === "goal" && b.side === s ? (b.playerIdx ?? 0) + 1 : 1)));
  const n: Record<TimelineSide, number> = { a: size("a"), b: size("b") };

  // Goals: the engine's scorers (the timeline's order); an unattributed goal
  // (legacy save) goes to a random player so the sums still hold.
  const goalBeats = timeline.beats.filter((b): b is TimelineGoal => b.kind === "goal");
  const scorerOf = goalBeats.map((b) => b.playerIdx ?? rng.int(0, n[b.side] - 1));
  const lines: Record<TimelineSide, PlayerLine[]> = {
    a: Array.from({ length: n.a }, emptyLine),
    b: Array.from({ length: n.b }, emptyLine),
  };
  goalBeats.forEach((b, i) => {
    lines[b.side][scorerOf[i]].goals += 1;
  });

  // Assists: a teammate of the scorer, on most goals.
  const assistW: Record<TimelineSide, number[]> = { a: weightsOf(n.a, rng), b: weightsOf(n.b, rng) };
  goalBeats.forEach((b, i) => {
    if (n[b.side] < 2 || !rng.chance(BOX.assistChance)) return;
    const mates = lines[b.side].map((_, k) => k).filter((k) => k !== scorerOf[i]);
    lines[b.side][rng.weightedPick(mates, (k) => assistW[b.side][k])].assists += 1;
  });

  // Team volume: shots on target = goals + the opponent's saves. Style flavour
  // reads the PLAYED style: possession cuts what the rival gets, pressure demos.
  const styleA = styleOf(sides.a, useStyles);
  const styleB = styleOf(sides.b, useStyles);
  const played: Record<TimelineSide, PlayStyleId | null> = { a: styleA, b: styleB };
  const other = (s: TimelineSide): TimelineSide => (s === "a" ? "b" : "a");
  const cut = (s: TimelineSide) => (played[other(s)] === "possession" ? BOX.possessionShotsCut : 0);
  const extraOn: Record<TimelineSide, number> = {
    a: Math.max(0, rangeInt(rng, BOX.extraOnTarget) - cut("a")),
    b: Math.max(0, rangeInt(rng, BOX.extraOnTarget) - cut("b")),
  };
  const off: Record<TimelineSide, number> = {
    a: Math.max(0, rangeInt(rng, BOX.offTarget) - cut("a")),
    b: Math.max(0, rangeInt(rng, BOX.offTarget) - cut("b")),
  };
  const demoTotal: Record<TimelineSide, number> = {
    a: rangeInt(rng, BOX.demos) + (styleA === "pressure" ? BOX.pressureExtraDemos : 0),
    b: rangeInt(rng, BOX.demos) + (styleB === "pressure" ? BOX.pressureExtraDemos : 0),
  };

  for (const s of ["a", "b"] as const) {
    const shotW = weightsOf(n[s], rng);
    const saveW = weightsOf(n[s], rng);
    const demoW = weightsOf(n[s], rng);
    const teamShots = goalsOf[s] + extraOn[s] + off[s];
    const goalSum = lines[s].reduce((x, l) => x + l.goals, 0);
    const missed = spread(teamShots - goalSum, shotW, rng);
    const saves = spread(extraOn[other(s)], saveW, rng); // this side keeps out the other's on-target shots
    const demos = spread(demoTotal[s], demoW, rng);
    lines[s].forEach((l, i) => {
      l.shots = l.goals + missed[i];
      l.saves = saves[i];
      l.demos = demos[i];
    });
  }

  for (const s of ["a", "b"] as const) {
    lines[s].forEach((l) => {
      l.score = scoreOf(l);
      l.rating = rate(l, s === winSide);
    });
  }

  // The game's best: the winning side's top rating (then score, then order).
  let mvp: GameBoxScore["mvp"] = null;
  lines[winSide].forEach((l, i) => {
    const best = mvp ? lines[winSide][mvp.playerIdx] : null;
    if (!best || l.rating > best.rating || (l.rating === best.rating && l.score > best.score)) mvp = { side: winSide, playerIdx: i };
  });

  // --- key moment candidates, read off the goal timeline and the numbers ---
  const cands: GameCore["candidates"] = [];
  const add = (c: Omit<KeyMoment, "variant" | "gameIndex"> & { priority: number; filler?: boolean }) =>
    cands.push({ ...c, gameIndex: game.index, filler: c.filler ?? false });
  const golden = goalBeats.findIndex((b) => b.golden);
  if (golden >= 0) {
    const b = goalBeats[golden];
    add({ type: "overtimeWinner", side: b.side, playerIdx: scorerOf[golden], period: b.period, clock: b.clock, n: 1, priority: 100 });
  }
  // Comeback: the winner trailed by 2+ at some point, and went ahead for good.
  let worst = 0;
  let aheadAt = -1;
  const wIdx = winSide === "a" ? 0 : 1;
  goalBeats.forEach((b) => {
    worst = Math.max(worst, b.scoreAfter[1 - wIdx] - b.scoreAfter[wIdx]);
  });
  if (worst >= BOX.comebackDeficit) {
    const deficitAt = goalBeats.findIndex((b) => b.scoreAfter[1 - wIdx] - b.scoreAfter[wIdx] >= BOX.comebackDeficit);
    aheadAt = goalBeats.findIndex((b, i) => i > deficitAt && b.scoreAfter[wIdx] > b.scoreAfter[1 - wIdx]);
    if (aheadAt >= 0) {
      const b = goalBeats[aheadAt];
      add({ type: "comeback", side: b.side, playerIdx: scorerOf[aheadAt], period: b.period, clock: b.clock, n: worst, priority: 90 });
    }
  }
  for (const s of ["a", "b"] as const) {
    lines[s].forEach((l, i) => {
      if (l.goals >= BOX.hatTrickGoals) {
        let seen = 0;
        const at = goalBeats.findIndex((b, k) => b.side === s && scorerOf[k] === i && ++seen === BOX.hatTrickGoals);
        const b = goalBeats[at];
        add({ type: "hatTrick", side: s, playerIdx: i, period: b.period, clock: b.clock, n: l.goals, priority: 80 });
      }
    });
  }
  const lastBeat = goalBeats[goalBeats.length - 1];
  if (lastBeat && lastBeat.period === "regulation" && lastBeat.side === winSide && lastBeat.clock <= BOX.lateGoalSecondsLeft) {
    add({ type: "lateGoal", side: winSide, playerIdx: scorerOf[goalBeats.length - 1], period: "regulation", clock: lastBeat.clock, n: 1, priority: 60 });
  }
  if (game.deciding && goalsOf[loseSide] === 0 && goalsOf[winSide] > 0) {
    let top = 0;
    lines[winSide].forEach((l, i) => {
      if (l.saves > lines[winSide][top].saves) top = i;
    });
    add({ type: "cleanSheet", side: winSide, playerIdx: top, period: "regulation", clock: rng.int(20, 120), n: lines[winSide][top].saves, priority: 70 });
  }
  for (const s of ["a", "b"] as const) {
    lines[s].forEach((l, i) => {
      if (l.saves >= BOX.saveMarathon) add({ type: "saveMarathon", side: s, playerIdx: i, period: "regulation", clock: rng.int(30, 270), n: l.saves, priority: 50 });
      if (l.demos >= BOX.demoBlitz) add({ type: "demoBlitz", side: s, playerIdx: i, period: "regulation", clock: rng.int(30, 270), n: l.demos, priority: 40 });
    });
  }
  // The filler: the goal that settled the game (the winner's goal number loser+1).
  if (golden < 0) {
    let seen = 0;
    const at = goalBeats.findIndex((b) => b.side === winSide && ++seen === goalsOf[loseSide] + 1);
    if (at >= 0) {
      const b = goalBeats[at];
      add({ type: "decider", side: winSide, playerIdx: scorerOf[at], period: b.period, clock: b.clock, n: 1, priority: 10, filler: true });
    }
  }
  cands.sort((x, y) => y.priority - x.priority);
  // The filler chance is drawn here so a game's draw count never depends on the series.
  if (cands.length === 1 && cands[0].filler && !rng.chance(BOX.fillerChanceAtZero)) cands.length = 0;
  return { box: { index: game.index, final, overtime: timeline.overtimeSeconds !== null, players: lines, mvp }, candidates: cands };
}

/** Match order: regulation by time played, then overtime. */
const elapsed = (m: { period: ClockPeriod; clock: number }) => (m.period === "overtime" ? 300 + m.clock : 300 - m.clock);

/**
 * The game's key moments out of its candidates: the notable ones (cap
 * CAREER_BOXSCORE.momentsMax), topped up with the deciding goal to at least two
 * when anything notable happened; a quiet game keeps at most the deciding goal.
 * A template (type + variant) already used in the series is skipped.
 */
function pickMoments(core: GameCore, used: Set<string>, rng: Rng): KeyMoment[] {
  const notable = core.candidates.filter((c) => !c.filler);
  const filler = core.candidates.filter((c) => c.filler);
  const chosen = notable.length >= 1 ? [...notable.slice(0, BOX.momentsMax), ...(notable.length === 1 ? filler : [])] : filler;
  const out: KeyMoment[] = [];
  for (const c of chosen) {
    const free = Array.from({ length: BOX.momentVariants }, (_, v) => v).filter((v) => !used.has(`${c.type}:${v}`));
    if (free.length === 0) continue;
    const variant = rng.pick(free);
    used.add(`${c.type}:${variant}`);
    const { priority: _p, filler: _f, ...m } = c;
    void _p;
    void _f;
    out.push({ ...m, variant });
  }
  return out.sort((x, y) => elapsed(x) - elapsed(y));
}

function sidesOf(teams: { a?: BoxSide; b?: BoxSide }): Record<TimelineSide, BoxSide | undefined> {
  return { a: teams.a, b: teams.b };
}

/** One game's box score (its key moments are picked with nothing used before). */
export function buildGameBoxScore(
  series: SeriesResult,
  game: GameResult,
  roundKey: string,
  teams: { a?: BoxSide; b?: BoxSide } = {},
  opts: BoxOptions = {},
): GameBoxScore {
  const core = buildGameCore(series, game, roundKey, sidesOf(teams), opts.styles ?? FEATURES.matchdayStyles);
  const rng = createRng(deriveSeed(boxScoreSeed(roundKey, series, game), "variant"));
  return { ...core.box, moments: pickMoments(core, new Set(), rng) };
}

/**
 * The whole series: every game, the per-player totals and the MVP. `roundKey`
 * is the round's RoundRef.key ("sw:2" / "po:0"); `teams.a/b` are the
 * TournamentTeams of series.teamAId / teamBId. No template repeats across the
 * series' games.
 */
export function buildSeriesBoxScore(
  series: SeriesResult,
  roundKey: string,
  teams: { a?: BoxSide; b?: BoxSide } = {},
  opts: BoxOptions = {},
): SeriesBoxScore {
  const useStyles = opts.styles ?? FEATURES.matchdayStyles;
  const used = new Set<string>();
  const games: GameBoxScore[] = [];
  const totals: Record<TimelineSide, PlayerSeriesLine[]> = { a: [], b: [] };
  const ratingSum: Record<TimelineSide, number[]> = { a: [], b: [] };
  for (const game of series.games) {
    const core = buildGameCore(series, game, roundKey, sidesOf(teams), useStyles);
    const rng = createRng(deriveSeed(boxScoreSeed(roundKey, series, game), "variant"));
    const gameBox: GameBoxScore = { ...core.box, moments: pickMoments(core, used, rng) };
    games.push(gameBox);
    for (const s of ["a", "b"] as const) {
      gameBox.players[s].forEach((l, i) => {
        const t = (totals[s][i] ??= { ...emptyLine(), games: 0, avgRating: 0 });
        t.goals += l.goals;
        t.assists += l.assists;
        t.shots += l.shots;
        t.saves += l.saves;
        t.demos += l.demos;
        t.score += l.score;
        t.games += 1;
        ratingSum[s][i] = (ratingSum[s][i] ?? 0) + l.rating;
      });
    }
  }
  for (const s of ["a", "b"] as const) {
    totals[s].forEach((t, i) => {
      t.avgRating = Math.round((ratingSum[s][i] / Math.max(1, t.games)) * 10) / 10;
      t.rating = t.avgRating;
    });
  }
  const winSide: TimelineSide = series.winnerTeamId === series.teamAId ? "a" : "b";
  let mvp: SeriesBoxScore["mvp"] = null;
  totals[winSide].forEach((t, i) => {
    const best = mvp ? totals[winSide][mvp.playerIdx] : null;
    if (!best || t.score > best.score || (t.score === best.score && t.avgRating > best.avgRating)) mvp = { side: winSide, playerIdx: i };
  });
  return { games, totals, mvp };
}

// ---------------------------------------------------------------------------
// The roster's season stats (the user's team, folded in when the event ends)
// ---------------------------------------------------------------------------

/** One player's season totals. `ratingSum` / `games` is the average rating. */
export interface PlayerSeasonLine {
  games: number;
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  demos: number;
  score: number;
  ratingSum: number;
}

/** One season of the user's roster. Keys: the player id (the name when the id is unknown). */
export interface SeasonBoxStats {
  seasonIndex: number;
  players: Record<string, PlayerSeasonLine>;
}

/** The mean rating of a season line, one decimal (0 with no games). */
export function avgRatingOf(line: PlayerSeasonLine): number {
  return line.games > 0 ? Math.round((line.ratingSum / line.games) * 10) / 10 : 0;
}

/**
 * Folds one finished series of the user's side into the saved seasons: returns
 * a NEW list holding only the current and the previous season (CAREER_BOXSCORE.
 * seasonsKept), at most `playersKept` players each. `keys` maps the user side's
 * roster indices to player keys.
 */
export function foldSeasonStats(
  prev: readonly SeasonBoxStats[] | undefined,
  seasonIndex: number,
  box: SeriesBoxScore,
  userSide: TimelineSide,
  keys: readonly string[],
): SeasonBoxStats[] {
  const seasons = (prev ?? []).map((s) => ({ seasonIndex: s.seasonIndex, players: { ...s.players } }));
  let cur = seasons.find((s) => s.seasonIndex === seasonIndex);
  if (!cur) {
    cur = { seasonIndex, players: {} };
    seasons.push(cur);
  }
  box.totals[userSide].forEach((t, i) => {
    const key = keys[i] ?? `#${i}`;
    const l = (cur!.players[key] ??= { games: 0, goals: 0, assists: 0, shots: 0, saves: 0, demos: 0, score: 0, ratingSum: 0 });
    l.games += t.games;
    l.goals += t.goals;
    l.assists += t.assists;
    l.shots += t.shots;
    l.saves += t.saves;
    l.demos += t.demos;
    l.score += t.score;
    // the sum of the per-game ratings, so the season average stays exact
    l.ratingSum = Math.round((l.ratingSum + box.games.reduce((x, g) => x + (g.players[userSide][i]?.rating ?? 0), 0)) * 10) / 10;
  });
  seasons.sort((x, y) => y.seasonIndex - x.seasonIndex);
  return seasons.slice(0, BOX.seasonsKept).map((s) => {
    const ranked = Object.entries(s.players).sort((x, y) => y[1].games - x[1].games);
    return { seasonIndex: s.seasonIndex, players: Object.fromEntries(ranked.slice(0, BOX.playersKept)) };
  });
}
