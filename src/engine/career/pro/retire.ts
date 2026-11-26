/**
 * v2.2 Pro (PRO-SPEC §7.6, §8, R150): the end of a career. Three ways: by age
 * (a yearly chance from the late twenties, certain at the forced age), by
 * choice (from an age where it is not a misclick), and after a year without a
 * contract (offered, never forced: a failed year must not end a save). The v2.2
 * bridge is "legend": the end with the card. Manager and coach bridges come
 * with the coach career. Retiring never deletes anything the player earned.
 */

import { CAREER_PRO_AGING as A } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { deriveSeed } from "../seeds";
import { proAgeOf } from "./growth";
import type { ProPlayer, ProSave } from "./types";

export type RetireReason = "age" | "choice" | "noContract";

export interface RetirementCheck {
  /** He retires now, by age. */
  retire: "age" | null;
  /** The game offers the end (a year without a contract): the player may continue. */
  offer: "noContract" | null;
}

/** The yearly chance of retiring by age, 0 to 1. */
export function retireChanceAt(age: number): number {
  if (age >= A.retireForcedAge) return 1;
  return A.retireChance[age] ?? 0;
}

/** At a season rollover: does the age end it, and is the end being offered. */
export function checkRetirement(
  player: Pick<ProPlayer, "birthYear" | "seasonsWithoutContract">,
  ctx: { seasonIndex: number; careerSeed: number; retired?: boolean },
): RetirementCheck {
  if (ctx.retired) return { retire: null, offer: null };
  const age = proAgeOf(player, ctx.seasonIndex);
  const chance = retireChanceAt(age);
  const rng = createRng(deriveSeed(ctx.careerSeed, `pro:retire:${ctx.seasonIndex}`));
  if (chance > 0 && rng.next() < chance) return { retire: "age", offer: null };
  const offer = (player.seasonsWithoutContract ?? 0) >= A.noContractSeasons && age >= A.noContractMinAge;
  return { retire: null, offer: offer ? "noContract" : null };
}

/** Retiring by choice is open from this age on. */
export function canRetireByChoice(player: Pick<ProPlayer, "birthYear">, seasonIndex: number): boolean {
  return proAgeOf(player, seasonIndex) >= A.choiceMinAge;
}

/** The career ends with the card: stage "retired", no team, the "legend" bridge. A new save; the input is untouched. */
export function retireProSave(save: ProSave, reason: RetireReason): ProSave {
  if (save.stage === "retired") return save;
  return {
    ...save,
    stage: "retired",
    team: null,
    bridge: { to: "legend", atSeason: save.clock.seasonIndex },
    flags: { ...save.flags, [`retired:${reason}`]: true },
  };
}

/**
 * Polish: what the end looks like from this season: the last one (the forced
 * age comes at its rollover), or one where the end can come by chance.
 */
export function retirementOutlookOf(player: Pick<ProPlayer, "birthYear">, seasonIndex: number): { age: number; lastSeason: boolean; mayEnd: boolean } {
  const next = proAgeOf(player, seasonIndex + 1);
  return { age: proAgeOf(player, seasonIndex), lastSeason: next >= A.retireForcedAge, mayEnd: retireChanceAt(next) > 0 };
}
