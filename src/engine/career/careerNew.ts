/**
 * The CAREER SAVE scope of the "New" markers (rc.34, ROADMAP UX-06 and "New
 * markers (all areas)"; the model is `engine/newItems`, DESIGN-DECISIONS
 * #154). Pure: the save in, keys out. Its seen state is one `SeenState` per
 * career save (`CareerSave.newItems`): the store seeds it on the first write
 * that adds a key (`seedOnChange` — an existing save sees nothing new on its
 * first load) and marks keys seen when their content is OPENED (a player's
 * sheet, a toolbox item's sheet, a purchase) — visiting a tab never does.
 *
 * Items of this scope (kind → what makes it available), urgent first:
 * - `ct:<playerId>@<endSeason>` — a squad contract in its final stretch
 *   (UX-06b: its last season from CAREER_HQ.contractWarnFromWeek, or the
 *   season review): the Squad tab's dot, the HQ card's tag;
 * - `tb:<itemId>` — a toolbox item unlocked to buy and not owned (UX-06a:
 *   unlocked ≠ bought; gear by its reputation gate, the bootcamp tier the
 *   reputation opens, the psychologist): the Finances tab's dot, the HQ
 *   toolbox's tag, and HQ's centred unlock modal once per novelty
 *   (`CareerSave.newAnnounced`).
 */

import { CAREER_GEAR, CAREER_HQ } from "@/config/balance";
import { itemKey, keyId, keyKind, newKeys, seedOnChange, type SeenState } from "../newItems";
import { weekOfDay } from "./calendar";
import { bootcampTierFor, type GearItemId } from "./economy";
import type { CareerSave, SquadPlayer } from "./types";

export const CAREER_NEW_KIND = {
  contract: "ct",
  toolbox: "tb",
} as const;

/** The toolbox's items (HQ-CONTRACT H6): the gear ladder, the two bootcamp tiers, the psychologist. */
export type ToolboxItemId = GearItemId | "bootcamp1" | "bootcamp2" | "psych";

export const contractNewKey = (playerId: string, endSeason: number): string =>
  itemKey(CAREER_NEW_KIND.contract, `${playerId}@${endSeason}`);
export const toolboxNewKey = (id: ToolboxItemId): string => itemKey(CAREER_NEW_KIND.toolbox, id);

/** UX-06b: the contract is in its final stretch — the HQ card warns, the item is urgent. */
export function contractWarnsFor(save: CareerSave, p: Pick<SquadPlayer, "contractEndSeason">): boolean {
  if (p.contractEndSeason > save.clock.seasonIndex) return false;
  return save.phase === "seasonReview" || weekOfDay(save.clock.day) >= CAREER_HQ.contractWarnFromWeek;
}

/** UX-06a: the toolbox items unlocked to buy and not owned (a bootcamp tier stays unlocked once opened). */
export function toolboxUnlockedIds(save: CareerSave): ToolboxItemId[] {
  const rep = save.reputation;
  const gear = save.finances.gear;
  const out: ToolboxItemId[] = [];
  for (const item of CAREER_GEAR.items) if (rep >= item.repGate && !gear[item.id]) out.push(item.id);
  const tier = bootcampTierFor(rep);
  if (tier > 0) out.push(tier === 2 ? "bootcamp2" : "bootcamp1");
  if (rep >= CAREER_GEAR.psychologistRep && !gear.psychologist) out.push("psych");
  return out;
}

/** Every key this save can show right now, urgent (contracts) first. An ended career shows none. */
export function careerAvailableKeys(save: CareerSave): string[] {
  if (save.phase === "ended") return [];
  const keys: string[] = [];
  for (const p of save.squad) if (contractWarnsFor(save, p)) keys.push(contractNewKey(p.id, p.contractEndSeason));
  for (const id of toolboxUnlockedIds(save)) keys.push(toolboxNewKey(id));
  return keys;
}

/** The new items of a career save, split by where they show — contracts (urgent) above the toolbox. */
export interface CareerNewSummary {
  /** Every new key (for `isNew`). */
  keys: ReadonlySet<string>;
  /** Squad player ids whose final-stretch contract has not been opened. */
  contracts: string[];
  /** Toolbox items unlocked to buy and not opened. */
  toolbox: ToolboxItemId[];
}

export function careerNewSummary(save: CareerSave): CareerNewSummary {
  const keys = newKeys(save.newItems, careerAvailableKeys(save));
  const out: CareerNewSummary = { keys: new Set(keys), contracts: [], toolbox: [] };
  for (const key of keys) {
    const id = keyId(key);
    if (keyKind(key) === CAREER_NEW_KIND.contract) out.contracts.push(id.slice(0, id.lastIndexOf("@")));
    else if (keyKind(key) === CAREER_NEW_KIND.toolbox) out.toolbox.push(id as ToolboxItemId);
  }
  return out;
}

/** The tabs' dots, from the SAME summary as the tags inside (a dot always has a tag behind it). */
export function careerNewDotsOf(s: CareerNewSummary): { squad: boolean; finances: boolean } {
  return { squad: s.contracts.length > 0, finances: s.toolbox.length > 0 };
}

/** UX-06a: the toolbox unlocks HQ's centred modal still owes (new and never announced), in ladder order. */
export function toolboxUnannouncedOf(save: CareerSave, s: CareerNewSummary = careerNewSummary(save)): ToolboxItemId[] {
  const announced = new Set(save.newAnnounced ?? []);
  return s.toolbox.filter((id) => !announced.has(toolboxNewKey(id)));
}

/**
 * The store's seed rule on every write (#154's recipe): an unseeded save is
 * seeded from what it could show BEFORE the first write that adds a key, so
 * exactly that arrival is new. Undefined = nothing to write.
 */
export function seedCareerNew(prev: CareerSave, next: CareerSave): SeenState | undefined {
  if (next.newItems) return undefined;
  return seedOnChange(undefined, careerAvailableKeys(prev), careerAvailableKeys(next));
}
