/**
 * Road to Worlds — the career's own difficulty presets (rc.32, BAL-02, R59).
 *
 * The career reads CAREER_DIFFICULTY, never the Draft's DIFFICULTY: the match
 * profile (form rolls, chemistry caps, the AI shift) every career team is
 * built with, and the prefs a new career starts on. Pure; no React.
 */

import { CAREER_DIFFICULTY, CAREER_LOAN, CAREER_PLAN } from "@/config/balance";
import type { CareerDifficulty, CareerPrefs, TrainingMode } from "./types";

/**
 * rc.34 (front I + front H): the weeks the bank gives to repay the emergency
 * loan on this preset before the career ends ("the bank lends you the money;
 * repay it within N weeks or the career ends"), from
 * `CAREER_LOAN.emergency.deadlineWeeks` (null = no deadline). rc.34 review:
 * the wizard's money line reads the whole rule, `economy.moneyRuleFor`.
 */
export function loanDeadlineWeeksFor(difficulty: CareerDifficulty): number | null {
  const weeks = CAREER_LOAN.emergency.deadlineWeeks[difficulty];
  return weeks === null || weeks === undefined ? null : Math.max(1, Math.round(weeks));
}

export type CareerMatchProfile = (typeof CAREER_DIFFICULTY.match)[CareerDifficulty];

/** The match profile a career difficulty plays with (CAREER_DIFFICULTY.match). */
export function careerMatchProfile(difficulty: CareerDifficulty): CareerMatchProfile {
  return CAREER_DIFFICULTY.match[difficulty] ?? CAREER_DIFFICULTY.match.normal;
}

/**
 * rc.34 review: the training delegation a new career on this preset starts
 * on (CAREER_PLAN.modeByPreset, decision 3-A) — Easy: the coach runs it;
 * Normal: he proposes, you approve; Hard: you set it. The wizard's help line
 * and the new career's training state both read it.
 */
export function presetTrainingModeOf(difficulty: CareerDifficulty): TrainingMode {
  return CAREER_PLAN.modeByPreset[difficulty] ?? "approve";
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
