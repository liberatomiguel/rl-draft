/**
 * v2.2 rc.6 (ORGMODE UI-C): the established org's operations as the screens
 * name and summarise them (Finances, the Club page, HQ). Pure; reads
 * `operationsOf` (engine/career/established) and the copy.
 *
 * rc9 org (R220): an established org's items carry the org catalogue's names
 * (engine/career/orgCatalogue: facilities with levels, departments, the event
 * camp), never the founded shelf's. The rows `operationsOf` still lists by
 * founded id are named through `orgItemOfFounded`; the catalogue's own view
 * (`orgOperationsOf`) is read by the helpers at the bottom, for wave 2.
 */

import { CAREER_GEAR, CAREER_STAFF } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { OperationItem, Operations } from "@/engine/career/established";
import { bootcampTierFor } from "@/engine/career/economy";
import type { LadderRungId } from "@/engine/career/ladder";
import {
  ORG_FACILITY_LEVELS,
  orgItemOfFounded,
  type OrgDepartment,
  type OrgFacility,
  type OrgItemId,
  type OrgOperations,
} from "@/engine/career/orgCatalogue";

export type OpsDept = keyof Operations;
export const OPS_DEPTS: OpsDept[] = ["facilities", "staff", "camps"];

export function opsRungOf(id: OperationItem["id"]): LadderRungId {
  return id as LadderRungId;
}

/** An org catalogue item's name. */
export function orgItemNameOf(C: CareerCopy, id: OrgItemId): string {
  return C.orgmode.org.name[id] ?? id;
}

/** A row of `operationsOf` (a founded id) under the org catalogue's name: a facility's level, a department, the camp. */
export function opsNameOf(C: CareerCopy, id: OperationItem["id"]): string {
  const org = orgItemOfFounded(id);
  if (!org) return id;
  const name = orgItemNameOf(C, org);
  if (org === "trainingCentre" || org === "performanceCentre") {
    const levels = ORG_FACILITY_LEVELS[org] as readonly string[];
    return levels.length > 1 ? C.orgmode.org.levelName(name, levels.indexOf(id) + 1) : name;
  }
  return name;
}

/** What the item does, in the org catalogue's words with the engine's figures. */
export function opsEffectOf(C: CareerCopy, id: OperationItem["id"]): string {
  const O = C.orgmode.org;
  if (id === "bootcamp1" || id === "bootcamp2") {
    const tier = id === "bootcamp2" ? 2 : 1;
    const def = CAREER_GEAR.bootcamp[tier - 1];
    const edge = def.sharpRating * (CAREER_GEAR.bootcampSpan === "split" ? CAREER_GEAR.bootcampSplitEdgeShare : 1);
    return `${O.about.eventCamp} ${C.toolbox.rating(String(edge))}`;
  }
  const org = orgItemOfFounded(id);
  if (org && org.startsWith("dept")) return departmentEffectOf(C, org as OrgDepartment["id"]);
  const item = CAREER_GEAR.items.find((i) => i.id === id);
  return item ? O.levelEffect(Math.round(item.trainingBonus * 100), item.buffLevels, item.ratingBonus) : "";
}

/** A department's effect with the engine's figures (CAREER_STAFF, CAREER_GEAR.psychologistStatBonus). */
export function departmentEffectOf(C: CareerCopy, id: OrgDepartment["id"]): string {
  const E = C.orgmode.org.deptEffect;
  const R = CAREER_STAFF.roles;
  switch (id) {
    case "deptDevelopment":
      return E.deptDevelopment(Math.round(R.assistant.benchXpShare * 100));
    case "deptAnalysis":
      return E.deptAnalysis(R.analyst.playoffRating);
    case "deptPsychology":
      return E.deptPsychology(CAREER_GEAR.psychologistStatBonus.clutch, CAREER_GEAR.psychologistStatBonus.consistency);
    case "deptHealth":
      return E.deptHealth(Math.round((1 - R.physio.wearRiskMult) * 100));
    case "deptCommercial":
      return E.deptCommercial(Math.round((R.brand.sponsorValueMult - 1) * 100));
  }
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

// ---------------------------------------------------------------------------
// rc9 org (R220): the org catalogue's view (orgOperationsOf), for wave 2
// ---------------------------------------------------------------------------

/** A facility as one row: its name, "Level 2 of 3", the next level's effect, and whether it came with the org. */
export interface FacilityRow {
  id: OrgFacility["id"];
  name: string;
  levelLine: string;
  /** The next level's effect ("+10% training, +1 team buff level"), or the "fully built" line. */
  nextLine: string;
  /** In place when the manager arrived (the tier's standard) or built since. */
  origin: "standard" | "built" | "none";
}

export function facilityRowOf(C: CareerCopy, f: OrgFacility): FacilityRow {
  const O = C.orgmode.org;
  const next = f.next ? f.levels[f.next.level - 1] : null;
  return {
    id: f.id,
    name: orgItemNameOf(C, f.id),
    levelLine: f.level > 0 ? O.level(f.level, f.maxLevel) : O.notBuilt,
    nextLine: next ? `${O.upgradeTo(f.next!.level)}: ${O.levelEffect(next.trainingPct, next.buffLevels, next.rating)}` : O.complete,
    origin: f.level === 0 ? "none" : f.level <= f.standard ? "standard" : "built",
  };
}

/** The next facility level worth showing on HQ: the cheapest one the org can build. */
export function nextUpgradeOf(ops: OrgOperations): OrgFacility | null {
  const open = ops.facilities.filter((f) => f.next);
  return open.sort((a, b) => a.next!.price - b.next!.price)[0] ?? null;
}

/** The departments staffed, by name (HQ's one line). */
export function staffedNamesOf(C: CareerCopy, ops: OrgOperations): string[] {
  return ops.departments.filter((d) => d.staffed).map((d) => orgItemNameOf(C, d.id));
}
