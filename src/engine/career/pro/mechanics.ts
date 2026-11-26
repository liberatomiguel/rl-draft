/**
 * v2.2 Pro (PRO-SPEC §4.2, R150): signature mechanics. Mechanics training opens
 * them in a fixed order (wavedash to flip reset); each needs enough mechanics
 * blocks done and enough Mechanics. They are the visible bridge between the
 * training and the match: every one adds an option to the decision of a game
 * (moments.ts). Pure.
 */

import { CAREER_PRO_MOMENTS } from "@/config/balance";
import type { ProPlayer } from "./types";

const LIST = CAREER_PRO_MOMENTS.mechanics;

export const MECHANIC_IDS: readonly string[] = LIST.map((m) => m.id);

export interface MechanicRequirement {
  id: string;
  /** Position in the unlock order, 0 = first. */
  order: number;
  mechanics: number;
  blocks: number;
}

export function mechanicRequirement(id: string): MechanicRequirement | null {
  const i = LIST.findIndex((m) => m.id === id);
  return i < 0 ? null : { id, order: i, mechanics: LIST[i].mechanics, blocks: LIST[i].blocks };
}

/** The mechanics a player has earned: in order, each one only after the one before it. */
export function earnedMechanics(player: Pick<ProPlayer, "attrs" | "mechanicsBlocks">): string[] {
  const out: string[] = [];
  const blocks = player.mechanicsBlocks ?? 0;
  for (const m of LIST) {
    if (blocks >= m.blocks && player.attrs.mechanics >= m.mechanics) out.push(m.id);
    else break;
  }
  return out;
}

/** Bring `player.mechanics` up to what he has earned. Never takes one away (a decline does not erase a learned move). */
export function syncMechanics(player: ProPlayer): { player: ProPlayer; unlocked: string[] } {
  const earned = earnedMechanics(player);
  const have = new Set(player.mechanics);
  const unlocked = earned.filter((id) => !have.has(id));
  if (unlocked.length === 0) return { player, unlocked };
  const ordered = MECHANIC_IDS.filter((id) => have.has(id) || earned.includes(id));
  return { player: { ...player, mechanics: ordered }, unlocked };
}

/** The next mechanic to chase, with what is still missing (for the planner and the player card). */
export function nextMechanic(player: Pick<ProPlayer, "attrs" | "mechanics" | "mechanicsBlocks">): {
  id: string;
  needMechanics: number;
  needBlocks: number;
  haveBlocks: number;
  blocksLeft: number;
  mechanicsLeft: number;
} | null {
  const have = new Set(player.mechanics);
  const m = LIST.find((x) => !have.has(x.id));
  if (!m) return null;
  const haveBlocks = player.mechanicsBlocks ?? 0;
  return {
    id: m.id,
    needMechanics: m.mechanics,
    needBlocks: m.blocks,
    haveBlocks,
    blocksLeft: Math.max(0, m.blocks - haveBlocks),
    mechanicsLeft: Math.max(0, Math.ceil(m.mechanics - player.attrs.mechanics)),
  };
}
