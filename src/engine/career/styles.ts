/**
 * Matchday play styles (v2.1 slice 2, docs/MATCHDAY-SPEC.md §4).
 *
 * Five styles in a cycle: Pressure > Possession > Counter > Individual >
 * Team play > Pressure. A side's natural style and its fit (0–1) in each style
 * come from its three starters: each player's attributes taken against their
 * own mean (so overall never picks the style), plus a lean from the archetype
 * when the caller knows it. Pure and deterministic: no RNG, no save field.
 *
 * The matchup is a table lookup: the side whose played style beats the other's
 * gets CAREER_MATCHDAY.matchupCap × its fit in that style, per game.
 */

import { CAREER_MATCHDAY as MD } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { PlayStyleId, StatKey, Stats, TeamStyle, TournamentTeam } from "../types";

export const PLAY_STYLES: readonly PlayStyleId[] = MD.styleCycle;

const STAT_KEYS: readonly StatKey[] = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];

/** The style that `style` beats (the next one in the cycle). */
export function styleBeats(style: PlayStyleId): PlayStyleId {
  const i = PLAY_STYLES.indexOf(style);
  return PLAY_STYLES[(i + 1) % PLAY_STYLES.length];
}

export interface StylePlayer {
  stats: Stats;
  /** Career archetype id, when the caller has it. */
  archetype?: string;
}

const NORMALISED_WEIGHTS: Record<PlayStyleId, Record<StatKey, number>> = (() => {
  const out = {} as Record<PlayStyleId, Record<StatKey, number>>;
  for (const style of PLAY_STYLES) {
    const w = MD.styleStatWeights[style];
    const sum = STAT_KEYS.reduce((s, k) => s + w[k], 0);
    out[style] = {} as Record<StatKey, number>;
    for (const k of STAT_KEYS) out[style][k] = w[k] / sum;
  }
  return out;
})();

/** One player's lean toward each style (attribute deviations + archetype). */
export function playerStyleScores(player: StylePlayer): Record<PlayStyleId, number> {
  const mean = STAT_KEYS.reduce((s, k) => s + player.stats[k], 0) / STAT_KEYS.length;
  const lean = player.archetype ? MD.archetypeStyle[player.archetype] ?? null : null;
  const out = {} as Record<PlayStyleId, number>;
  for (const style of PLAY_STYLES) {
    let score = 0;
    for (const k of STAT_KEYS) score += NORMALISED_WEIGHTS[style][k] * (player.stats[k] - mean);
    if (lean === style) score += MD.archetypeStyleBonus;
    out[style] = score;
  }
  return out;
}

/**
 * The side's style from its starters (the first three players given). Ties go
 * to the earlier style in the cycle, so the result never depends on float noise
 * order. An empty lineup reads as a neutral Team play side at the base fit.
 */
export function teamStyleFor(players: readonly StylePlayer[]): TeamStyle {
  const starters = players.slice(0, 3);
  const scores = {} as Record<PlayStyleId, number>;
  for (const style of PLAY_STYLES) scores[style] = 0;
  for (const p of starters) {
    const s = playerStyleScores(p);
    for (const style of PLAY_STYLES) scores[style] += s[style] / Math.max(1, starters.length);
  }
  // Round to 1e-6 so a platform's float noise cannot flip the natural style.
  for (const style of PLAY_STYLES) scores[style] = Math.round(scores[style] * 1e6) / 1e6;

  let natural: PlayStyleId = starters.length ? PLAY_STYLES[0] : "teamplay";
  for (const style of PLAY_STYLES) if (scores[style] > scores[natural]) natural = style;
  const second = Math.max(...PLAY_STYLES.filter((s) => s !== natural).map((s) => scores[s]));
  const naturalFit = clamp(MD.fitNaturalBase + MD.fitNaturalPerMargin * (scores[natural] - second), MD.fitNaturalBase, 1);

  const fit = {} as Record<PlayStyleId, number>;
  for (const style of PLAY_STYLES) {
    fit[style] =
      style === natural
        ? round3(naturalFit)
        : round3(clamp(naturalFit - MD.fitDropPerPoint * (scores[natural] - scores[style]), MD.fitMin, naturalFit));
  }
  return { natural, fit };
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** The style a side plays this series (fatia 3's plan sets `played`). */
export function playedStyle(style: TeamStyle): PlayStyleId {
  return style.played ?? style.natural;
}

/**
 * Per-game matchup bonus for `team` against `opponent`, in rating points:
 * matchupCap × the team's fit when its played style beats the opponent's,
 * 0 otherwise (same style, neutral pairing, or either side without a style).
 */
export function styleMatchupBonus(team: TournamentTeam, opponent: TournamentTeam): number {
  if (!team.style || !opponent.style) return 0;
  const mine = playedStyle(team.style);
  if (styleBeats(mine) !== playedStyle(opponent.style)) return 0;
  return MD.matchupCap * clamp(team.style.fit[mine] ?? 0, 0, 1);
}
