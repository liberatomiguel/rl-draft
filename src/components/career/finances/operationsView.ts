/**
 * v2.2 rc.6 (ORGMODE UI-C): the established org's operations as the screens
 * name and summarise them (Finances, the Club page, HQ). Pure; reads
 * `operationsOf` (engine/career/established) and the copy.
 */

import { CAREER_GEAR } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { OperationItem, Operations } from "@/engine/career/established";
import { bootcampTierFor } from "@/engine/career/economy";
import type { LadderRungId } from "@/engine/career/ladder";

export type OpsDept = keyof Operations;
export const OPS_DEPTS: OpsDept[] = ["facilities", "staff", "camps"];

export function opsRungOf(id: OperationItem["id"]): LadderRungId {
  return id as LadderRungId;
}

export function opsNameOf(C: CareerCopy, id: OperationItem["id"]): string {
  if (id === "bootcamp1") return C.finances.bootcampT1;
  if (id === "bootcamp2") return C.finances.bootcampT2;
  if (id === "psychologist") return C.finances.psychologist;
  if (id in C.finances.staff) return C.finances.staff[id as keyof typeof C.finances.staff].title;
  return C.finances.gear[id as keyof typeof C.finances.gear] ?? id;
}

/** What the item does, from the copy the toolbox and the ladder already use. */
export function opsEffectOf(C: CareerCopy, id: OperationItem["id"]): string {
  if (id === "bootcamp1" || id === "bootcamp2") {
    const tier = id === "bootcamp2" ? 2 : 1;
    const def = CAREER_GEAR.bootcamp[tier - 1];
    const edge = def.sharpRating * (CAREER_GEAR.bootcampSpan === "split" ? CAREER_GEAR.bootcampSplitEdgeShare : 1);
    return `${tier === 2 ? C.finances.bootcampT2Desc : C.finances.bootcampT1Desc} ${C.toolbox.rating(String(edge))}`;
  }
  if (id === "psychologist") return C.finances.psychologistDesc(CAREER_GEAR.psychologistStatBonus.clutch, CAREER_GEAR.psychologistStatBonus.consistency);
  if (id in C.finances.staff) return C.finances.staff[id as keyof typeof C.finances.staff].desc;
  const desc = C.finances.gearDesc[id as keyof typeof C.finances.gearDesc] ?? "";
  if (id === "perfCenter") {
    const pc = CAREER_GEAR.items.find((i) => i.id === "perfCenter");
    return pc ? `${desc} ${C.toolbox.rating(String(pc.ratingBonus))}` : desc;
  }
  return desc;
}

/** The camp the org runs (an established org runs the structured tier; the lighter one is superseded). */
export function campsShown(ops: Operations, gateRep: number): OperationItem[] {
  const tier = bootcampTierFor(gateRep);
  const shown = ops.camps.filter((c) => (c.id === "bootcamp2" ? 2 : 1) === tier);
  return shown.length ? shown : ops.camps.slice(-1);
}

/** Weekly running cost: the upkeep of what is owned and the retainers of who is retained. */
export function runningCostOf(ops: Operations): number {
  return [...ops.facilities, ...ops.staff].reduce((s, i) => s + (i.state === "owned" || i.state === "retained" ? i.upkeep : 0), 0);
}

/** The next sensible purchase: the first installation the org lacks (the list runs cheapest first). */
export function nextPurchaseOf(ops: Operations): OperationItem | null {
  return ops.facilities.find((i) => i.state !== "owned") ?? null;
}

export function ownedCount(ops: Operations): number {
  return ops.facilities.filter((i) => i.state === "owned").length;
}

export function retainedOf(ops: Operations): OperationItem[] {
  return ops.staff.filter((i) => i.state === "retained");
}
