/**
 * Team-against-team duel: small pure view functions for the screens (rc.9,
 * DESIGN-DECISIONS #229). They turn the engine's results into words and rows;
 * the words come from `DUEL_MATCH_UI` (copy.en / copy.pt) handed in by the
 * caller, so nothing here reads a language or the store.
 *
 * In every function A is the challenger and B the opponent (the order
 * `playDuel` is called in).
 */

import type { Copy } from "@/content/copy.en";
import type { ClockPeriod } from "./career/matchTimeline";
import type { DuelParseError, DuelReply } from "./duelLink";
import type { DuelGame, DuelSeries, DuelWinSide } from "./duelMatch";
import { DUEL_MATCH } from "@/config/balance";
import type { DuelRules, DuelSideKey } from "./duelRules";

export type DuelCopy = Copy["DUEL_MATCH_UI"];

/** What the challenger chose, in words and in the order the screen lists it: draft, region, rerolls, overalls. */
export function duelRulesTags(rules: DuelRules, copy: DuelCopy, regionName: string): string[] {
  return [
    rules.mode === "quick" ? copy.modeQuick : copy.modeClassic,
    regionName,
    rules.rerolls === 0 ? copy.rerollsNone : copy.rerolls(rules.rerolls),
    rules.showOverall ? copy.overallShown : copy.overallHidden,
  ];
}

/** The same, on one line. */
export function duelRulesLine(rules: DuelRules, copy: DuelCopy, regionName: string): string {
  return duelRulesTags(rules, copy, regionName).join(" · ");
}

/** The name a side shows: what they typed, or "Challenger" / "Opponent". */
export function duelSideLabel(reply: Pick<DuelReply, "challenger" | "opponent">, side: DuelSideKey, copy: DuelCopy): string {
  return reply[side].name || (side === "challenger" ? copy.sideChallenger : copy.sideOpponent);
}

/** The side key of a series side: A is the challenger. */
export const duelSideKeyOf = (side: DuelWinSide): DuelSideKey => (side === "a" ? "challenger" : "opponent");

/** "Best of 7". */
export const duelBestOfLabel = (copy: DuelCopy): string => copy.bestOf(DUEL_MATCH.bestOf);

export interface DuelScoreline {
  a: number;
  b: number;
  /** "4-2", A first. */
  text: string;
  winner: DuelWinSide;
  winnerKey: DuelSideKey;
  /** Games played in the series. */
  games: number;
  /** The winner took every game they played to win it (a 4-0). */
  sweep: boolean;
}

/** The series scoreline. */
export function duelScoreline(series: DuelSeries): DuelScoreline {
  const [a, b] = series.score;
  return {
    a,
    b,
    text: `${a}-${b}`,
    winner: series.winner,
    winnerKey: duelSideKeyOf(series.winner),
    games: series.games.length,
    sweep: Math.min(a, b) === 0,
  };
}

/** Who won the series. */
export const duelWinner = (series: DuelSeries): DuelSideKey => duelSideKeyOf(series.winner);

/** "<name> takes the series". */
export function duelWinnerLine(reply: Pick<DuelReply, "challenger" | "opponent">, series: DuelSeries, copy: DuelCopy): string {
  return copy.seriesWon(duelSideLabel(reply, duelWinner(series), copy));
}

/**
 * A clock reading. Regulation counts down from 5:00 ("3:42" left); overtime
 * counts up from 0 ("+0:41" played), as the career's Match Center does.
 */
export function formatDuelClock(period: ClockPeriod, seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return period === "overtime" ? `+${text}` : text;
}

export interface DuelTimelineRow {
  kind: "goal" | "overtime";
  side: DuelWinSide | null;
  /** The scorer's nickname, when the engine can name one. */
  player: string | null;
  period: ClockPeriod;
  /** Reading of the clock ("" on the overtime beat). */
  clock: string;
  /** Raw clock seconds (regulation: left, overtime: played). */
  seconds: number | null;
  /** Score after the beat, A first. */
  score: [number, number];
  scoreText: string;
  golden: boolean;
  /** "Regulation ends" on the overtime beat, "Golden goal" on the winner, else null. */
  label: string | null;
}

/** One game's timeline in play order: goals at their minute, the overtime beat and the golden goal. */
export function duelGameTimeline(series: DuelSeries, gameIndex: number, copy: DuelCopy): DuelTimelineRow[] {
  const game: DuelGame | undefined = series.games.find((g) => g.index === gameIndex);
  if (!game) return [];
  return game.timeline.beats.map((beat): DuelTimelineRow => {
    if (beat.kind === "overtime") {
      return {
        kind: "overtime",
        side: null,
        player: null,
        period: "regulation",
        clock: "",
        seconds: null,
        score: beat.scoreAfter,
        scoreText: `${beat.scoreAfter[0]}-${beat.scoreAfter[1]}`,
        golden: false,
        label: copy.regulationEnds,
      };
    }
    const names = series.sides[beat.side].playerNames;
    return {
      kind: "goal",
      side: beat.side,
      player: beat.playerIdx === null ? null : (names[beat.playerIdx] ?? null),
      period: beat.period,
      clock: formatDuelClock(beat.period, beat.clock),
      seconds: beat.clock,
      score: beat.scoreAfter,
      scoreText: `${beat.scoreAfter[0]}-${beat.scoreAfter[1]}`,
      golden: beat.golden,
      label: beat.golden ? copy.goldenGoal : null,
    };
  });
}

export interface DuelGameRow {
  index: number;
  label: string;
  /** Game score, A first. */
  scoreText: string;
  winner: DuelWinSide;
  overtime: boolean;
  /** "OT" or "". */
  tag: string;
  /** Series score after the game, A first. */
  afterText: string;
}

/** The games of the series in play order, one row each. */
export function duelGameRows(series: DuelSeries, copy: DuelCopy): DuelGameRow[] {
  return series.games.map((g) => ({
    index: g.index,
    label: copy.gameLabel(g.index),
    scoreText: `${g.final[0]}-${g.final[1]}`,
    winner: g.winner,
    overtime: g.overtime,
    tag: g.overtime ? copy.overtimeShort : "",
    afterText: `${g.after[0]}-${g.after[1]}`,
  }));
}

/** The words for a link that does not open (a parse error or one of the two checks the screen adds). */
export function duelErrorText(reason: DuelParseError | "unknownCards" | "region", copy: DuelCopy): string {
  return copy.errors[reason] ?? copy.errors.malformed;
}
