"use client";

/**
 * Road to Worlds — what a career preset means, in three plain bullets (rc.34,
 * front I; the presets are rc.32's BAL-02, R59). Miguel (31/10): "the texts
 * are still quite bad, and it is too cluttered" — written for a first-time
 * player on a phone, no jargon and no numbers to decode, each bullet derived
 * live from balance.ts:
 *  - matches: easier / fair / tougher — the preset's match edge against
 *    Normal's (CAREER_DIFFICULTY.match via `matchEdgeOf`);
 *  - money: the preset's whole money rule — rc.34 review: `economy.moneyRuleFor`
 *    from every key (the loans a career gets, the weeks to repay each or no
 *    deadline, a breach count that ends it outright);
 *  - help: rc.34 review — the training delegation the preset starts on
 *    (`presetTrainingModeOf`, CAREER_PLAN.modeByPreset: the coach runs it /
 *    proposes and you approve / you plan it) and whether cups are entered.
 *
 * ONE descriptor list: a new bullet is `{ key, value }` in PRESET_BULLETS
 * plus its copy in `wizard` in copy.career.en.ts AND copy.career.pt.ts.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { matchEdgeOf, presetPrefs, presetTrainingModeOf } from "@/engine/career/difficulty";
import { moneyRuleFor } from "@/engine/career/economy";
import type { CareerDifficulty } from "@/engine/career/types";
import { ClipboardIcon, CoinIcon, SwordsIcon } from "@/components/ui/icons";

/** rc.35 (front C): each bullet leads with its icon (matches / money / help). */
const BULLET_ICON = { matches: SwordsIcon, money: CoinIcon, help: ClipboardIcon } as const;

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
      const rule = moneyRuleFor(d);
      return rule.lends ? C.wizard.presetMoney(rule) : C.wizard.presetMoneyNoLoan;
    },
  },
  { key: "help", value: (d, C) => C.wizard.presetHelp(presetTrainingModeOf(d), presetPrefs(d).autoEnterUnofficials) },
];

export function PresetEffects({ difficulty, C }: { difficulty: CareerDifficulty; C: CareerCopy }) {
  return (
    <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-sub">
      {PRESET_BULLETS.map((b) => (
        <li key={b.key} className="flex gap-2">
          {(() => {
            const Icon = BULLET_ICON[b.key];
            return <Icon className="mt-px h-4 w-4 shrink-0 text-faint" />;
          })()}
          <span>{b.value(difficulty, C)}</span>
        </li>
      ))}
    </ul>
  );
}
