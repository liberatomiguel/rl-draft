"use client";

/**
 * Road to Worlds — a career preset's basics (rc.33, UX-07; the presets are
 * rc.32's BAL-02, R59). Miguel (30/10): "the difficulty screen with only the
 * basics of each mode". Three readable lines, each derived live from
 * balance.ts — no rolls, chemistry caps or multipliers to decode:
 *  - matches: easier / even / harder — the preset's match edge against
 *    Normal's (CAREER_DIFFICULTY.match via `matchEdgeOf`);
 *  - money: what ends a career — CAREER_LOAN.breachesToEnd (never, or the
 *    Nth cash breach), rendered from the key whatever its value;
 *  - day to day: how hands-on it starts (the preset's prefs).
 *
 * ONE descriptor list: a new row is `{ key, value }` in PRESET_ROWS plus its
 * label in `wizard.presetRows` in copy.career.en.ts AND copy.career.pt.ts.
 */

import { CAREER_LOAN } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { matchEdgeOf, presetPrefs } from "@/engine/career/difficulty";
import type { CareerDifficulty } from "@/engine/career/types";

/** Edges within this many rating points of Normal's read as "even". */
const EVEN_EDGE_BAND = 0.25;

/** How a preset's matches feel against Normal's: easier, even or harder. */
export function matchFeelOf(difficulty: CareerDifficulty): "easier" | "even" | "harder" {
  const delta = matchEdgeOf(difficulty) - matchEdgeOf("normal");
  return delta > EVEN_EDGE_BAND ? "easier" : delta < -EVEN_EDGE_BAND ? "harder" : "even";
}

export interface PresetRow {
  key: string;
  value: (difficulty: CareerDifficulty, C: CareerCopy) => string;
}

export const PRESET_ROWS: PresetRow[] = [
  { key: "matches", value: (d, C) => C.wizard.presetMatchFeel[matchFeelOf(d)] },
  {
    key: "money",
    value: (d, C) => {
      const n = CAREER_LOAN.breachesToEnd[d];
      return n === null || n === undefined ? C.wizard.presetMoneyNever : C.wizard.presetMoneyAt(n);
    },
  },
  {
    key: "start",
    value: (d, C) => (presetPrefs(d).autoTrain ? C.wizard.presetStartGuided : C.wizard.presetStartHandsOn),
  },
];

export function PresetEffects({ difficulty, C }: { difficulty: CareerDifficulty; C: CareerCopy }) {
  return (
    <dl className="space-y-2 text-xs">
      {PRESET_ROWS.map((row) => (
        <div key={row.key}>
          <dt className="kicker text-[9px] text-faint">{C.wizard.presetRows[row.key] ?? row.key}</dt>
          <dd className="mt-0.5 leading-snug text-ink">{row.value(difficulty, C)}</dd>
        </div>
      ))}
    </dl>
  );
}
