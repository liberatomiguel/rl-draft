/**
 * Team-against-team duel: the match (rc.9, DESIGN-DECISIONS #227).
 *
 * The two drafted teams play a best of 7 with the game's own series engine
 * (`simulateSeries`), as the same kind of team on both sides: both are built
 * by `buildUserTeam` (chemistry, coach and sub count for both, as in a normal
 * run), both read the same difficulty profile and neither gets an opponent
 * shift.
 *
 * The result is a function of (seed, both teams) and nothing else. The engine
 * has a first and a second side (a tie in the overtime roll goes to the first,
 * the series-form rolls are drawn first-then-second), so the series is always
 * played with the teams in a canonical order (sorted by their cards), then
 * turned to the caller's A and B. Swapping A and B therefore mirrors the
 * result and changes nothing else: the same games, goals, minutes and stats.
 *
 * Per game it exposes a clock timeline (`buildGameTimeline`) and the box score
 * lines (`buildSeriesBoxScore`) with running team stats. Both are built on the
 * canonical series and turned to the caller's sides the same way.
 */

import { DUEL_MATCH } from "@/config/balance";
import { coachById, lineupById, playerCardById, specialCardById, subById } from "@/data";
import { createRng } from "@/lib/rng";
import { buildGameTimeline, type GameTimeline, type TimelineBeat, type TimelineSide } from "./career/matchTimeline";
import {
  buildSeriesBoxScore,
  type GameBoxScore,
  type KeyMoment,
  type PlayerLine,
  type PlayerSeriesLine,
  type SeriesBoxScore,
} from "./career/boxScore";
import { duelStreamSeed, type DuelCard, type DuelMode, type DuelRules, type DuelTeamCards } from "./duelRules";
import { simulateSeries } from "./match";
import { displayTeamOverall } from "./rating";
import { buildUserTeam } from "./teams";
import type { Roster, TournamentTeam } from "./types";

const byId = (a: DuelCard, b: DuelCard) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The same team with its players in card-id order (what the series is built from). */
export function normalizeDuelTeam(team: DuelTeamCards): DuelTeamCards {
  return { ...team, players: [...team.players].sort(byId) };
}

/** Stable text of a team: its cards, specials included. */
export function duelTeamKey(team: DuelTeamCards): string {
  const c = (x?: DuelCard) => (x ? `${x.id}+${x.sp ?? ""}` : "-");
  const t = normalizeDuelTeam(team);
  return [...t.players.map(c), c(t.coach), c(t.sub), t.orgLineup ?? "-"].join("|");
}

/** True when every id of the team is in this version's dataset and its shape fits the mode. */
export function isKnownDuelTeam(team: DuelTeamCards, mode: DuelMode): boolean {
  if (team.players.length !== 3) return false;
  const special = (x: DuelCard) => x.sp === undefined || specialCardById.has(x.sp);
  if (!team.players.every((p) => playerCardById.has(p.id) && special(p))) return false;
  if (new Set(team.players.map((p) => playerCardById.get(p.id)!.playerId)).size !== 3) return false;
  if (mode === "quick") return !team.coach && !team.sub && !team.orgLineup;
  return Boolean(
    team.coach && coachById.has(team.coach.id) && special(team.coach) &&
      team.sub && subById.has(team.sub.id) && special(team.sub) &&
      team.orgLineup && lineupById.has(team.orgLineup),
  );
}

/** The roster the team engine builds from (the inverse of `duelTeamFromRoster`). */
function rosterOf(team: DuelTeamCards): Roster {
  const pick = (slot: "player1" | "player2" | "player3" | "coach" | "sub", kind: "player" | "coach" | "sub", c: DuelCard) => ({
    slot,
    kind,
    refId: c.id,
    specialId: c.sp,
    fromLineupId: "",
  });
  const t = normalizeDuelTeam(team);
  const roster: Roster = {
    player1: pick("player1", "player", t.players[0]),
    player2: pick("player2", "player", t.players[1]),
    player3: pick("player3", "player", t.players[2]),
  };
  if (t.coach) roster.coach = pick("coach", "coach", t.coach);
  if (t.sub) roster.sub = pick("sub", "sub", t.sub);
  if (t.orgLineup) {
    roster.org = { slot: "org", kind: "org", refId: lineupById.get(t.orgLineup)!.orgId, fromLineupId: t.orgLineup };
  }
  return roster;
}

/** The tournament team of a drafted team, under the id the series will use. Throws on an unknown card. */
export function buildDuelTeam(team: DuelTeamCards, mode: DuelMode, id: string): TournamentTeam {
  if (!isKnownDuelTeam(team, mode)) throw new Error("duel team: unknown or incomplete cards");
  const built = buildUserTeam(rosterOf(team), DUEL_MATCH.matchDifficulty, { mode, teamName: id });
  return { ...built, id, name: id };
}

// ---------------------------------------------------------------------------
// The series
// ---------------------------------------------------------------------------

export type DuelWinSide = TimelineSide;

/** Summed player lines of one side: the team's stat line. */
export interface DuelTeamLine {
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  demos: number;
  score: number;
}

export interface DuelGame {
  index: number;
  /** Final score, A first. */
  final: [number, number];
  winner: DuelWinSide;
  overtime: boolean;
  deciding: boolean;
  /** Series score after this game, A first. */
  after: [number, number];
  /** The clock: regulation, overtime and every goal at its minute. A is side "a". */
  timeline: GameTimeline;
  /** Per-player lines, key moments and the game's best player. */
  box: GameBoxScore;
  /** This game's team lines. */
  team: Record<DuelWinSide, DuelTeamLine>;
  /** The team lines summed over this game and the ones before it. */
  running: Record<DuelWinSide, DuelTeamLine>;
}

export interface DuelSideView {
  /** Starter nicknames, in the order the timeline and box score index them. */
  playerNames: string[];
  /** Team overall as the game shows it, and the raw rating the engine used. */
  overall: number;
  rating: number;
}

export interface DuelSeries {
  /** Series score, A first. */
  score: [number, number];
  winner: DuelWinSide;
  /** True when A is the second canonical team (the series was turned). Informational. */
  turned: boolean;
  sides: Record<DuelWinSide, DuelSideView>;
  games: DuelGame[];
  /** Per-player series totals and the series MVP. */
  box: SeriesBoxScore;
}

const flip = (s: TimelineSide): TimelineSide => (s === "a" ? "b" : "a");
const swap = <T,>(p: [T, T]): [T, T] => [p[1], p[0]];
const emptyTeamLine = (): DuelTeamLine => ({ goals: 0, assists: 0, shots: 0, saves: 0, demos: 0, score: 0 });

function sumLines(lines: PlayerLine[] | PlayerSeriesLine[]): DuelTeamLine {
  const out = emptyTeamLine();
  for (const l of lines) {
    out.goals += l.goals;
    out.assists += l.assists;
    out.shots += l.shots;
    out.saves += l.saves;
    out.demos += l.demos;
    out.score += l.score;
  }
  return out;
}

function flipTimeline(t: GameTimeline): GameTimeline {
  const beats: TimelineBeat[] = t.beats.map((b) =>
    b.kind === "goal" ? { ...b, side: flip(b.side), scoreAfter: swap(b.scoreAfter) } : { ...b, scoreAfter: swap(b.scoreAfter) },
  );
  return { ...t, beats, final: swap(t.final) };
}

function flipMoment(m: KeyMoment): KeyMoment {
  return { ...m, side: flip(m.side) };
}

function flipGameBox(g: GameBoxScore): GameBoxScore {
  return {
    ...g,
    final: swap(g.final),
    players: { a: g.players.b, b: g.players.a },
    mvp: g.mvp ? { ...g.mvp, side: flip(g.mvp.side) } : null,
    moments: g.moments.map(flipMoment),
  };
}

/**
 * Plays the duel: `a` against `b` under the rules, a best of 7. The result is
 * oriented to the arguments (A = `a`) and is a function of the seed and the two
 * teams only. Throws on a team the dataset does not know (check `isKnownDuelTeam`).
 */
export function playDuel(rules: DuelRules, a: DuelTeamCards, b: DuelTeamCards): DuelSeries {
  // Canonical order: the team whose key sorts first plays as the engine's first side.
  // Equal teams keep the caller's order (nothing to tell them apart).
  const turned = duelTeamKey(a) > duelTeamKey(b);
  const first = turned ? b : a;
  const second = turned ? a : b;
  const t1 = buildDuelTeam(first, rules.mode, "duel-1");
  const t2 = buildDuelTeam(second, rules.mode, "duel-2");

  const series = simulateSeries(
    t1,
    t2,
    { bestOf: DUEL_MATCH.bestOf, stage: "playoff", difficulty: DUEL_MATCH.matchDifficulty },
    createRng(duelStreamSeed(rules.seed, "series")),
  );
  const roundKey = `duel:${(rules.seed >>> 0).toString(36)}`;
  const box = buildSeriesBoxScore(
    series,
    roundKey,
    { a: { playerNames: t1.playerNames }, b: { playerNames: t2.playerNames } },
    { styles: false },
  );

  const o = (s: TimelineSide): TimelineSide => (turned ? flip(s) : s);
  const oPair = <T,>(p: [T, T]): [T, T] => (turned ? swap(p) : p);

  const running: Record<DuelWinSide, DuelTeamLine> = { a: emptyTeamLine(), b: emptyTeamLine() };
  const games: DuelGame[] = series.games.map((game, i) => {
    const canonTimeline = buildGameTimeline(series, game, roundKey);
    const canonBox = box.games[i];
    const timeline = turned ? flipTimeline(canonTimeline) : canonTimeline;
    const gameBox = turned ? flipGameBox(canonBox) : canonBox;
    const team: Record<DuelWinSide, DuelTeamLine> = { a: sumLines(gameBox.players.a), b: sumLines(gameBox.players.b) };
    for (const s of ["a", "b"] as const) {
      for (const k of Object.keys(running[s]) as (keyof DuelTeamLine)[]) running[s][k] += team[s][k];
    }
    // Score after this game, from the engine's winners.
    const wins: [number, number] = [0, 0];
    for (let j = 0; j <= i; j++) wins[series.games[j].winnerTeamId === series.teamAId ? 0 : 1] += 1;
    return {
      index: game.index,
      final: timeline.final,
      winner: o(game.winnerTeamId === series.teamAId ? "a" : "b"),
      overtime: game.overtime,
      deciding: game.deciding,
      after: oPair(wins),
      timeline,
      box: gameBox,
      team,
      running: { a: { ...running.a }, b: { ...running.b } },
    };
  });

  const sideView = (t: TournamentTeam): DuelSideView => ({
    playerNames: t.playerNames,
    overall: displayTeamOverall(t.rating),
    rating: t.rating.total,
  });
  const views: Record<TimelineSide, DuelSideView> = { a: sideView(t1), b: sideView(t2) };
  const canonTotals = box.totals;
  return {
    score: oPair(series.score),
    winner: o(series.winnerTeamId === t1.id ? "a" : "b"),
    turned,
    sides: turned ? { a: views.b, b: views.a } : views,
    games,
    box: turned
      ? {
          games: box.games.map(flipGameBox),
          totals: { a: canonTotals.b, b: canonTotals.a },
          mvp: box.mvp ? { ...box.mvp, side: flip(box.mvp.side) } : null,
        }
      : box,
  };
}
