/**
 * What each attribute actually does in the match sim (v2.0, career R28) —
 * the same SIMULATION constants `match.ts` applies, read back as legible
 * per-game effects so the Training and Player screens can print the truth
 * ("Clutch: +0.4 rating in deciding games") instead of a vague tooltip.
 * Pure; no RNG.
 */

import { SIMULATION as SIM } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey, Stats } from "./types";

function norm(stat: number): number {
  return clamp((stat - SIM.statBaseline) / SIM.statDivisor, -1.2, 1.2);
}

export interface StatEffect {
  key: StatKey;
  /** Signed rating-equivalent effect (or percent for the two chance stats). */
  value: number;
  unit: "rating" | "pct";
  /** When it applies: every game / deciding games / playoffs / negative rolls / proc. */
  when: "always" | "deciding" | "playoffs" | "badRolls" | "proc";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One effect line per attribute for a TEAM stat line. */
export function statEffectsFor(stats: Stats): StatEffect[] {
  return [
    { key: "offense", value: round1(SIM.offenseWeight * norm(stats.offense)), unit: "rating", when: "always" },
    { key: "defense", value: round1(SIM.defenseWeight * norm(stats.defense)), unit: "rating", when: "always" },
    { key: "mechanics", value: Math.round(SIM.mechProcBaseChance * (0.5 + Math.max(0, norm(stats.mechanics))) * 100), unit: "pct", when: "proc" },
    { key: "consistency", value: Math.round(SIM.consistencyDampen * Math.max(0, norm(stats.consistency)) * 100), unit: "pct", when: "badRolls" },
    { key: "experience", value: round1(SIM.experienceWeight * norm(stats.experience)), unit: "rating", when: "playoffs" },
    { key: "clutch", value: round1(SIM.clutchWeight * norm(stats.clutch)), unit: "rating", when: "deciding" },
  ];
}

/** The rating-equivalent swing of +1 attribute point, per stat (for "worth" labels). */
export function statPointWorth(key: StatKey): number {
  const perPoint = 1 / SIM.statDivisor;
  switch (key) {
    case "offense":
      return round1(SIM.offenseWeight * perPoint * 10) / 10;
    case "defense":
      return round1(SIM.defenseWeight * perPoint * 10) / 10;
    case "clutch":
      return round1(SIM.clutchWeight * perPoint * 10) / 10;
    case "experience":
      return round1(SIM.experienceWeight * perPoint * 10) / 10;
    default:
      return 0;
  }
}
