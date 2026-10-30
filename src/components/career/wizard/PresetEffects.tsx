"use client";

/**
 * Road to Worlds — what a career preset means, in three plain bullets (rc.34,
 * front I; the presets are rc.32's BAL-02, R59). Miguel (31/10): "the texts
 * are still quite bad, and it is too cluttered" — written for a first-time
 * player on a phone, no jargon and no numbers to decode, each bullet derived
 * live from balance.ts:
 *  - matches: easier / fair / tougher — the preset's match edge against
 *    Normal's (CAREER_DIFFICULTY.match via `matchEdgeOf`);
 *  - money: the bank lends it, repay within N weeks or the career ends — N
 *    from `loanDeadlineWeeksFor` (front H's CAREER_LOAN.emergency.deadlineWeeks);
 *  - help: how much the game does for you (the preset's prefs).
 *
 * ONE descriptor list: a new bullet is `{ key, value }` in PRESET_BULLETS
 * plus its copy in `wizard` in copy.career.en.ts AND copy.career.pt.ts.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { loanDeadlineWeeksFor, matchEdgeOf, presetPrefs } from "@/engine/career/difficulty";
import type { CareerDifficulty } from "@/engine/career/types";

/** Edges within this many rating points of Normal's read as "even". */
const EVEN_EDGE_BAND = 0.25;

/** How a preset's matches feel against Normal's: easier, even or harder. */
export function matchFeelOf(difficulty: CareerDifficulty): "easier" | "even" | "harder" {
  const delta = matchEdgeOf(difficulty) - matchEdgeOf("normal");
  return delta > EVEN_EDGE_BAND ? "easier" : delta < -EVEN_EDGE_BAND ? "harder" : "even";
}

export interface PresetBullet {
  key: "matches" | "money" | "help";
  value: (difficulty: CareerDifficulty, C: CareerCopy) => string;
}

export const PRESET_BULLETS: PresetBullet[] = [
  { key: "matches", value: (d, C) => C.wizard.presetMatches[matchFeelOf(d)] },
  {
    key: "money",
    value: (d, C) => {
      const weeks = loanDeadlineWeeksFor(d);
      return weeks === null ? C.wizard.presetMoneyNoLoan : C.wizard.presetMoney(weeks);
    },
  },
  { key: "help", value: (d, C) => (presetPrefs(d).autoTrain ? C.wizard.presetHelpGuided : C.wizard.presetHelpHandsOn) },
];

export function PresetEffects({ difficulty, C }: { difficulty: CareerDifficulty; C: CareerCopy }) {
  return (
    <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-sub">
      {PRESET_BULLETS.map((b) => (
        <li key={b.key} className="flex gap-2">
          <span aria-hidden className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
          <span>{b.value(difficulty, C)}</span>
        </li>
      ))}
    </ul>
  );
}
