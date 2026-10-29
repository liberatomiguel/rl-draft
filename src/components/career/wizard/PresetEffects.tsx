"use client";

/**
 * Road to Worlds — a career preset's real effects (rc.32, BAL-02, R59), every
 * value read live from balance.ts: the match profile (CAREER_DIFFICULTY), the
 * money (CAREER_ECONOMY's per-difficulty keys) and how much is guided (the
 * preset's prefs).
 *
 * ONE descriptor list: to add a row — e.g. CAREER_LOAN.breachesToEnd by
 * difficulty — append `{ key, value }` to PRESET_ROWS and its label to
 * `wizard.presetRows` in copy.career.en.ts AND copy.career.pt.ts.
 */

import { CAREER_ECONOMY } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { careerMatchProfile, matchEdgeOf, presetPrefs } from "@/engine/career/difficulty";
import type { CareerDifficulty } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

export interface PresetRow {
  key: string;
  value: (difficulty: CareerDifficulty, C: CareerCopy) => string;
}

export const PRESET_ROWS: PresetRow[] = [
  { key: "matches", value: (d, C) => C.wizard.presetEdge(signed(matchEdgeOf(d))) },
  {
    key: "chemistry",
    value: (d, C) => {
      const m = careerMatchProfile(d);
      return C.wizard.presetChemistry(m.chemistryMaxBonus.toFixed(1), m.opponentChemistryMaxBonus.toFixed(1));
    },
  },
  { key: "budget", value: (d) => formatMoney(CAREER_ECONOMY.startingBudget[d]) },
  { key: "prizes", value: (d, C) => C.wizard.presetMult(String(CAREER_ECONOMY.prizeMult[d])) },
  { key: "asks", value: (d, C) => C.wizard.presetMult(String(CAREER_ECONOMY.salaryAskMult[d])) },
  { key: "sponsors", value: (d, C) => C.wizard.presetMult(String(CAREER_ECONOMY.sponsorMult[d])) },
  {
    key: "training",
    value: (d, C) => (presetPrefs(d).autoTrain ? C.wizard.presetTrainingGuided : C.wizard.presetTrainingManual),
  },
  {
    key: "cups",
    value: (d, C) => (presetPrefs(d).autoEnterUnofficials ? C.wizard.presetCupsAuto : C.wizard.presetCupsManual),
  },
];

export function PresetEffects({ difficulty, C }: { difficulty: CareerDifficulty; C: CareerCopy }) {
  return (
    <dl className="space-y-1 text-[11px]">
      {PRESET_ROWS.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-2">
          <dt className="text-faint">{C.wizard.presetRows[row.key] ?? row.key}</dt>
          <dd className="text-right font-semibold text-ink">{row.value(difficulty, C)}</dd>
        </div>
      ))}
    </dl>
  );
}
