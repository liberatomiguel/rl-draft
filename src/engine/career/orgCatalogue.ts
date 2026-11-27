/**
 * rc.9 ORG (R220): an established org's own progression. Pure.
 *
 * A founded club climbs a shelf of items (peripherals, monitors, PCs, the
 * bootcamps, the support staff) unlocked by reputation. An established org
 * does not buy monitors: it runs departments with people in them and
 * upgrades its facilities, with the board's sign-off. This module is that
 * catalogue. Every item rides an effect the engine already has, so balance
 * does not move: a facility level is the founded gear item it maps onto
 * (same training gain, buff levels, rating bonus, upkeep and price), a
 * department is the founded staff role (same retainer, same effect), the
 * event camp is the structured bootcamp.
 *
 *   trainingCentre     levels 1-3 = peripherals, monitors, pcs (in order)
 *   performanceCentre  level 1    = perfCenter (the board's flagship sign-off)
 *   deptDevelopment    = staff.assistant  (reserves bank more series XP)
 *   deptAnalysis       = staff.analyst    (playoff rating)
 *   deptPsychology     = psychologist     (clutch, consistency)
 *   deptHealth         = staff.physio     (wear risk)
 *   deptCommercial     = staff.brand      (sponsor offers' value)
 *   eventCamp          = bootcamp tier 2  (chemistry, rating edge for the split)
 *
 * The save keeps the founded state (`finances.gear`): nothing new is written,
 * a founded club never reads this file, and an rc.8 takeover's gear reads as
 * levels with no repair (a level counts the installations owned, so an item
 * bought out of order still counts once).
 */

import { CAREER_BOARD, CAREER_GEAR, CAREER_STAFF } from "@/config/balance";
import type { Stature } from "./boardTypes";
import { inheritedGearFor, operationsOf, tierOf, type OperationItem, type OperationState } from "./established";
import type { GearItemId } from "./economy";
import type { CareerSave, GearState, StaffId } from "./types";

export type OrgFacilityId = "trainingCentre" | "performanceCentre";
export type OrgDepartmentId = "deptDevelopment" | "deptAnalysis" | "deptPsychology" | "deptHealth" | "deptCommercial";
export type OrgCampId = "eventCamp";
export type OrgItemId = OrgFacilityId | OrgDepartmentId | OrgCampId;

/** Each facility's levels, as the founded installations they map onto (level n = the first n owned). */
export const ORG_FACILITY_LEVELS: Readonly<Record<OrgFacilityId, readonly GearItemId[]>> = {
  trainingCentre: ["peripherals", "monitors", "pcs"],
  performanceCentre: ["perfCenter"],
};
export const ORG_FACILITIES: readonly OrgFacilityId[] = ["trainingCentre", "performanceCentre"];

/** Each department, as the founded role it maps onto. */
export const ORG_DEPARTMENT_ROLE: Readonly<Record<OrgDepartmentId, StaffId | "psychologist">> = {
  deptDevelopment: "assistant",
  deptAnalysis: "analyst",
  deptPsychology: "psychologist",
  deptHealth: "physio",
  deptCommercial: "brand",
};
export const ORG_DEPARTMENTS: readonly OrgDepartmentId[] = ["deptAnalysis", "deptPsychology", "deptDevelopment", "deptHealth", "deptCommercial"];

/** The camp an established org runs (the structured tier; the light camp is a founded club's). */
export const ORG_CAMP_TIER = 2 as const;

/** The founded catalogue's ids: none of them may name anything an established save shows. */
export const FOUNDED_ITEM_IDS: readonly string[] = [
  ...CAREER_GEAR.items.map((i) => i.id),
  "bootcamp1",
  "bootcamp2",
  "psychologist",
  "psych",
  ...CAREER_STAFF.order,
];

/** The org item a founded id maps onto (a gear item, a staff role, a camp), or null. */
export function orgItemOfFounded(id: string): OrgItemId | null {
  for (const f of ORG_FACILITIES) if ((ORG_FACILITY_LEVELS[f] as readonly string[]).includes(id)) return f;
  for (const d of ORG_DEPARTMENTS) if (ORG_DEPARTMENT_ROLE[d] === id || (id === "psych" && d === "deptPsychology")) return d;
  if (id === "bootcamp1" || id === "bootcamp2") return "eventCamp";
  return null;
}

/** A facility's level on this gear: how many of its installations are owned. */
export function facilityLevelOf(gear: GearState, id: OrgFacilityId): number {
  return ORG_FACILITY_LEVELS[id].filter((g) => gear[g]).length;
}

/** The installation the next level buys (the first one of the facility not owned), or null at the top. */
export function nextLevelGearOf(gear: GearState, id: OrgFacilityId): GearItemId | null {
  return ORG_FACILITY_LEVELS[id].find((g) => !gear[g]) ?? null;
}

/** Is the department staffed on this gear? */
export function departmentStaffedOf(gear: GearState, id: OrgDepartmentId): boolean {
  const role = ORG_DEPARTMENT_ROLE[id];
  return role === "psychologist" ? Boolean(gear.psychologist) : Boolean(gear.staff?.[role]);
}

/** What an org of this tier has in place as standard (the structure a takeover arrives with). */
export function tierStandardOf(tier: Stature): { facilities: Record<OrgFacilityId, number>; departments: OrgDepartmentId[] } {
  const gear = inheritedGearFor(tier);
  return {
    facilities: { trainingCentre: facilityLevelOf(gear, "trainingCentre"), performanceCentre: facilityLevelOf(gear, "performanceCentre") },
    departments: ORG_DEPARTMENTS.filter((d) => departmentStaffedOf(gear, d)),
  };
}

/** The effect of one level, as numbers the copy turns into words (the founded item's own figures). */
export interface OrgLevelEffect {
  trainingPct: number;
  buffLevels: number;
  rating: number;
}

export function levelEffectOf(gearId: GearItemId): OrgLevelEffect {
  const item = CAREER_GEAR.items.find((i) => i.id === gearId)!;
  return { trainingPct: Math.round(item.trainingBonus * 100), buffLevels: item.buffLevels, rating: item.ratingBonus };
}

export type OrgUpgradeState = "complete" | "available" | "needsApproval" | "frozen" | "cantAfford";

export interface OrgFacility {
  id: OrgFacilityId;
  level: number;
  maxLevel: number;
  /** The level an org of this tier has as standard (what was in place on day one). */
  standard: number;
  /** Every level's effect, level 1 first. */
  levels: OrgLevelEffect[];
  /** The upkeep of the levels built, a week. */
  upkeep: number;
  /** The next level: its price, its upkeep a week, the board's confidence it needs, and whether it can be done now. */
  next: { level: number; price: number; upkeep: number; confidence: number | null; state: Exclude<OrgUpgradeState, "complete"> } | null;
  state: OrgUpgradeState;
}

export interface OrgDepartment {
  id: OrgDepartmentId;
  staffed: boolean;
  /** Part of the tier's standard structure (in place on day one). */
  standard: boolean;
  /** The retainer, a week and a split. */
  weekly: number;
  perSplit: number;
}

export interface OrgCamp {
  id: OrgCampId;
  state: "available" | "cantAfford";
  price: number;
  free: boolean;
  note?: "used" | "active";
}

export interface OrgOperations {
  tier: Stature;
  facilities: OrgFacility[];
  departments: OrgDepartment[];
  camp: OrgCamp | null;
  /** The structure's weekly cost: facilities' upkeep and the departments' retainers. */
  runningWeekly: number;
}

const upgradeStateOf = (s: OperationState): Exclude<OrgUpgradeState, "complete"> =>
  s === "needsApproval" || s === "frozen" || s === "cantAfford" ? s : "available";

/**
 * The established org's facilities, departments and camp (null for a founded
 * club). Prices, states and the board's sign-off are `operationsOf`'s, read
 * per level: a facility's next level is its first installation not owned.
 */
export function orgOperationsOf(save: CareerSave, opts: { floor?: number } = {}): OrgOperations | null {
  const ops = operationsOf(save, opts);
  const tier = tierOf(save);
  if (!ops || !tier) return null;
  const gear = save.finances.gear;
  const std = tierStandardOf(tier);
  const byGear = new Map<string, OperationItem>(ops.facilities.map((i) => [i.id, i]));

  const facilities: OrgFacility[] = ORG_FACILITIES.map((id) => {
    const items = ORG_FACILITY_LEVELS[id];
    const level = facilityLevelOf(gear, id);
    const nextGear = nextLevelGearOf(gear, id);
    const op = nextGear ? byGear.get(nextGear) : undefined;
    const next = op ? { level: level + 1, price: op.price, upkeep: op.upkeep, confidence: op.confidence, state: upgradeStateOf(op.state) } : null;
    const upkeep = items.filter((g) => gear[g]).reduce((s, g) => s + (byGear.get(g)?.upkeep ?? 0), 0);
    return {
      id,
      level,
      maxLevel: items.length,
      standard: std.facilities[id],
      levels: items.map(levelEffectOf),
      upkeep,
      next,
      state: next ? next.state : "complete",
    };
  });

  const byRole = new Map<string, OperationItem>(ops.staff.map((i) => [i.id, i]));
  const departments: OrgDepartment[] = ORG_DEPARTMENTS.map((id) => {
    const op = byRole.get(ORG_DEPARTMENT_ROLE[id])!;
    return { id, staffed: departmentStaffedOf(gear, id), standard: std.departments.includes(id), weekly: op.upkeep, perSplit: op.price };
  });

  const c = ops.camps.find((x) => x.id === (ORG_CAMP_TIER === 2 ? "bootcamp2" : "bootcamp1")) ?? ops.camps[0];
  const camp: OrgCamp | null = c
    ? { id: "eventCamp", state: c.state === "cantAfford" ? "cantAfford" : "available", price: c.price, free: Boolean(c.free), ...(c.note ? { note: c.note } : {}) }
    : null;

  const runningWeekly = facilities.reduce((s, f) => s + f.upkeep, 0) + departments.reduce((s, d) => s + (d.staffed ? d.weekly : 0), 0);
  return { tier, facilities, departments, camp, runningWeekly };
}

/** The board's sign-off line for a facility's next level (CAREER_BOARD.approval), for the copy. */
export function facilityApprovalOf(id: OrgFacilityId): number {
  return id === "performanceCentre" ? CAREER_BOARD.approval.flagship : CAREER_BOARD.approval.capital;
}
