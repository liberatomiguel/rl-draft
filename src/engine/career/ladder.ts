/**
 * rc.35 — THE PROGRESSION LADDER (Miguel, rc.34 feedback). One ordered
 * staircase of reputation gates: gear, coach hiring, sponsor access, bootcamps
 * and staff, in the order a garage org grows. Pure and deterministic; the
 * gates live in config/balance.ts (CAREER_GEAR, CAREER_UNLOCKS, CAREER_LADDER).
 *
 * Coach hiring is ladder-gated here (generic from `coach`, ex-pros from
 * `exProCoach`). Sponsor access is exposed as a LEVEL (0–4): the sponsor desk
 * (sponsorDeals.sponsorAccessFor, front S) maps it to offers and values.
 */

import { CAREER_GEAR, CAREER_LADDER, CAREER_UNLOCKS } from "@/config/balance";
import type { CareerSave, CoachState } from "@/engine/career/types";

export type LadderRungId =
  | "peripherals"
  | "coach"
  | "monitors"
  | "sponsors1"
  | "pcs"
  | "exProCoach"
  | "bootcamp1"
  | "sponsors2"
  | "bootcamp2"
  | "psychologist"
  | "sponsors3"
  | "perfCenter"
  | "sponsors4";

export type LadderKind = "gear" | "coach" | "sponsor" | "bootcamp" | "staff";

export interface LadderRung {
  id: LadderRungId;
  kind: LadderKind;
  gate: number;
}

export type LadderRungStatus = "owned" | "open" | "locked";

export interface LadderRungState extends LadderRung {
  status: LadderRungStatus;
}

const gearGate = (id: (typeof CAREER_GEAR.items)[number]["id"]) => CAREER_GEAR.items.find((i) => i.id === id)!.repGate;

/** The rungs in ladder order (by gate; ties keep the declared order). */
export function ladderRungs(): LadderRung[] {
  const declared: LadderRung[] = [
    { id: "peripherals", kind: "gear", gate: gearGate("peripherals") },
    { id: "coach", kind: "coach", gate: CAREER_UNLOCKS.coachRep },
    { id: "monitors", kind: "gear", gate: gearGate("monitors") },
    { id: "sponsors1", kind: "sponsor", gate: CAREER_LADDER.sponsorRep[0] },
    { id: "pcs", kind: "gear", gate: gearGate("pcs") },
    { id: "exProCoach", kind: "coach", gate: CAREER_LADDER.exProCoachRep },
    { id: "bootcamp1", kind: "bootcamp", gate: CAREER_GEAR.bootcamp[0].repGate },
    { id: "sponsors2", kind: "sponsor", gate: CAREER_LADDER.sponsorRep[1] },
    { id: "bootcamp2", kind: "bootcamp", gate: CAREER_GEAR.bootcamp[1].repGate },
    { id: "psychologist", kind: "staff", gate: CAREER_GEAR.psychologistRep },
    { id: "sponsors3", kind: "sponsor", gate: CAREER_LADDER.sponsorRep[2] },
    { id: "perfCenter", kind: "gear", gate: gearGate("perfCenter") },
    { id: "sponsors4", kind: "sponsor", gate: CAREER_LADDER.sponsorRep[3] },
  ];
  return declared.map((r, i) => ({ r, i })).sort((a, b) => a.r.gate - b.r.gate || a.i - b.i).map((x) => x.r);
}

/** How many rungs a reputation has reached (0 = none). */
export function ladderLevelFor(rep: number): number {
  return ladderRungs().filter((r) => rep >= r.gate).length;
}

/** Sponsor ladder level 0–4 (0 = no sponsor access yet; 1 local, 2 challenger, 3 global, 4 headline). */
export function sponsorLadderLevelFor(rep: number): 0 | 1 | 2 | 3 | 4 {
  return CAREER_LADDER.sponsorRep.filter((g) => rep >= g).length as 0 | 1 | 2 | 3 | 4;
}

/**
 * The seam for the sponsor desk (front S): the org's sponsor ladder level.
 * TODO(rc.35 integrator): feed this into sponsorDeals.sponsorAccessFor(level)
 * where offers are rolled (level 1 = two offers, no Bold; 2 = three incl.
 * Bold; 3+ = global values/perks). Front P does not touch the pricing.
 */
export function sponsorLadderLevelOf(save: Pick<CareerSave, "reputation">): 0 | 1 | 2 | 3 | 4 {
  return sponsorLadderLevelFor(save.reputation);
}

/** Why a coach cannot be hired yet ("repGate": no coach rung; "exProGate": an ex-pro before his rung), or null. */
export function coachHireRefusalFor(rep: number, coach: Pick<CoachState, "source">): "repGate" | "exProGate" | null {
  if (rep < CAREER_UNLOCKS.coachRep) return "repGate";
  if (coach.source === "real" && rep < CAREER_LADDER.exProCoachRep) return "exProGate";
  return null;
}

function ownedOf(save: CareerSave, id: LadderRungId): boolean {
  const gear = save.finances.gear;
  switch (id) {
    case "peripherals":
    case "monitors":
    case "pcs":
    case "perfCenter":
      return Boolean(gear[id]);
    case "psychologist":
      return Boolean(gear.psychologist);
    case "coach":
      return Boolean(save.coach);
    case "exProCoach":
      return save.coach?.source === "real";
    case "sponsors1":
    case "sponsors2":
    case "sponsors3":
    case "sponsors4":
      return (save.sponsor?.tier ?? 0) >= Number(id.slice(-1));
    default:
      return false;
  }
}

/** Every rung with its state: owned (bought / in post / signed), open (reached), locked. */
export function ladderOf(save: CareerSave): LadderRungState[] {
  return ladderRungs().map((r) => {
    if (save.reputation < r.gate) return { ...r, status: "locked" as const };
    return { ...r, status: ownedOf(save, r.id) ? ("owned" as const) : ("open" as const) };
  });
}

/** The next locked rung, or null at the top. */
export function nextRungOf(save: CareerSave): LadderRungState | null {
  return ladderOf(save).find((r) => r.status === "locked") ?? null;
}
