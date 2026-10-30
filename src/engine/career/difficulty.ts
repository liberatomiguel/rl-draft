/**
 * Road to Worlds — the career's own difficulty presets (rc.32, BAL-02, R59).
 *
 * The career reads CAREER_DIFFICULTY, never the Draft's DIFFICULTY: the match
 * profile (form rolls, chemistry caps, the AI shift) every career team is
 * built with, and the prefs a new career starts on. Pure; no React.
 */

import { CAREER_DIFFICULTY, CAREER_LOAN } from "@/config/balance";
import type { CareerDifficulty, CareerPrefs } from "./types";

/**
 * rc.34 (front I) — INTEGRATION SCAFFOLD: front H's
 * `CAREER_LOAN.emergency.deadlineWeeks` does not exist on this branch yet;
 * until it does, the wizard reads these weeks. When H's key merges, point
 * `loanDeadlineWeeksFor` at it and delete this fallback.
 */
const LOAN_DEADLINE_FALLBACK: Record<CareerDifficulty, number | null> = { easy: 12, normal: 8, hard: 4 };

/**
 * rc.34 (front I): the weeks the bank gives to repay the emergency loan on
 * this preset before the career ends (front H: "the bank lends you the
 * money; repay it within N weeks or the career ends") — the wizard's money
 * line. Reads `CAREER_LOAN.emergency.deadlineWeeks`, else the scaffold
 * above. null = no loan on this preset: running out of money ends it.
 */
export function loanDeadlineWeeksFor(difficulty: CareerDifficulty): number | null {
  type Emergency = { emergency?: { deadlineWeeks?: Partial<Record<CareerDifficulty, number | null>> } };
  const fromKey = (CAREER_LOAN as unknown as Emergency).emergency?.deadlineWeeks;
  const weeks = fromKey && difficulty in fromKey ? fromKey[difficulty] : LOAN_DEADLINE_FALLBACK[difficulty];
  return weeks === null || weeks === undefined ? null : Math.max(1, Math.round(weeks));
}

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
