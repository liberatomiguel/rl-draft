/**
 * Road to Worlds — the career's own difficulty presets (rc.32, BAL-02, R59).
 *
 * The career reads CAREER_DIFFICULTY, never the Draft's DIFFICULTY: the match
 * profile (form rolls, chemistry caps, the AI shift) every career team is
 * built with, and the prefs a new career starts on. Pure; no React.
 */

import { CAREER_DIFFICULTY } from "@/config/balance";
import type { CareerDifficulty, CareerPrefs } from "./types";

export type CareerMatchProfile = (typeof CAREER_DIFFICULTY.match)[CareerDifficulty];

/** The match profile a career difficulty plays with (CAREER_DIFFICULTY.match). */
export function careerMatchProfile(difficulty: CareerDifficulty): CareerMatchProfile {
  return CAREER_DIFFICULTY.match[difficulty] ?? CAREER_DIFFICULTY.match.normal;
}

/** The prefs a new career on this preset starts with (how much is guided). */
export function presetPrefs(difficulty: CareerDifficulty): CareerPrefs {
  const p = CAREER_DIFFICULTY.prefs[difficulty] ?? CAREER_DIFFICULTY.prefs.normal;
  return {
    managementStyle: p.managementStyle,
    autoTrain: p.autoTrain,
    autoEnterUnofficials: p.autoEnterUnofficials,
    playbackDefault: p.playbackDefault,
    newsDigest: p.newsDigest,
  };
}

/**
 * The user's match edge on a preset, in rating points against an even AI
 * side: the AI shift reversed plus the difference of the two form rolls'
 * means (the wizard's "Matches" line). Chemistry is listed on its own.
 */
export function matchEdgeOf(difficulty: CareerDifficulty): number {
  const m = careerMatchProfile(difficulty);
  const mean = (r: readonly [number, number]) => (r[0] + r[1]) / 2;
  return Math.round((-m.opponentRatingShift + mean(m.userRollRange) - mean(m.aiRollRange)) * 100) / 100;
}
