/**
 * v2.2 rc.6 (ORGMODE UI-A): the takeover pick's dossier, read from the save
 * the takeover WOULD create. `createCareerSave` with the same input and seed
 * the "Take the job" button will pass, so what the dossier shows (the board's
 * three plans, the money, the installations, the staff, the squad) is the
 * first day of the career exactly. Pure; called for the selected org only.
 *
 * Everything optional on the save is read with a fallback: the ENGINE front
 * adds retained staff, a season brief and more (orgs arriving with their
 * structure), and the screen shows them as soon as the save carries them.
 */

import { chanceBandOf, type ChanceBand } from "@/engine/career/board";
import type { BoardMandate, BoardPackage, BoardSecondary, PackageId, SeasonBrief, Stature } from "@/engine/career/boardTypes";
import { weeklyWageBill } from "@/engine/career/economy";
import type { CareerSave, CoachState, SeasonGoalSpec, SponsorState, SquadPlayer, StaffId } from "@/engine/career/types";
import { seasonMoneyOf, type SeasonMoney } from "@/engine/career/budget"; // rc9 org
import { establishedOf, standingSenseOf, type StandingSense } from "@/engine/career/established"; // rc9 org
import { orgOperationsOf, type OrgOperations } from "@/engine/career/orgCatalogue"; // rc9 org
import { createCareerSave, type CreateCareerInput } from "./careerFlow";

export interface TakeoverPlan {
  id: PackageId;
  objective: SeasonGoalSpec;
  band: ChanceBand;
  /** The season budget the plan pays when chosen. */
  budget: number;
  bonus: number;
  /** Confidence when met (positive) and when missed (negative or zero). */
  hit: number;
  miss: number;
}

/** The board's reason for its ask (`board.season.brief`, engine `SeasonBrief`), when the save carries one. */
export type TakeoverBrief = SeasonBrief;

export interface TakeoverPreview {
  /** The save the takeover creates (the screens may read anything else from it). */
  save: CareerSave;
  stature: Stature | "owners" | null;
  plans: TakeoverPlan[];
  /** The plan the board proposes (preselected later on HQ): "expected" when present. */
  proposed: TakeoverPlan | null;
  secondary: BoardSecondary | null;
  /** v2.2 MANDATE: an established org's mandate (demand level, the house's problems, the three goals). */
  mandate: BoardMandate | null;
  brief: TakeoverBrief | null;
  confidence: number | null;
  cash: number;
  /** The weekly wage bill (squad + coach) and the board's weekly ceiling. */
  weekWages: number;
  wageCeiling: number | null;
  /** Installations owned, in ladder order (finances.gear keys). */
  gear: ("peripherals" | "monitors" | "pcs" | "perfCenter")[];
  /** Staff retained: the psychologist and the support roles. */
  staff: ("psychologist" | StaffId)[];
  coach: CoachState | null;
  starters: SquadPlayer[];
  reserve: SquadPlayer | null;
  // rc9 org (R220-R223): what the dossier and the arrival show in the org's own terms (null for a founded club).
  /** The facilities' levels and the departments staffed (in place on day one): use this, not `gear` / `staff`. */
  org: OrgOperations | null;
  /** The sponsor deal in force on the takeover day. */
  sponsor: SponsorState | null;
  /** The standing as a word: tier, drift, signing cap, what the board expects. No figure. */
  sense: StandingSense | null;
  /** The season's money, one summary whose figures add up. */
  money: SeasonMoney | null;
}

const GEAR_ORDER = ["peripherals", "monitors", "pcs", "perfCenter"] as const;
const STAFF_ORDER: StaffId[] = ["assistant", "analyst", "physio", "brand"];

function planOf(p: BoardPackage): TakeoverPlan {
  return {
    id: p.id,
    objective: p.objective,
    band: chanceBandOf(p.objective.chance ?? 0),
    budget: p.grant,
    bonus: p.bonus,
    hit: p.hit,
    miss: p.miss,
  };
}

/** Reads a save the way the dossier needs it (exported for the arrival splash, which reads the created save). */
export function takeoverViewOf(save: CareerSave): TakeoverPreview {
  const board = save.board ?? null;
  const season = board?.season ?? null;
  const plans = (season?.offers ?? []).map(planOf);
  const gearState = save.finances.gear;
  // The staff may sit on the gear (rc.45) or, after the ENGINE front, on the finances themselves.
  const staffState = (save.finances as { staff?: Partial<Record<StaffId, boolean>> }).staff ?? gearState.staff ?? {};
  const starters = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => Boolean(p));
  // rc.6 (UI-B): the engine's brief is keyed by `reason` (UI-A read a `kind` that never exists).
  const brief = season?.brief ?? null;
  return {
    save,
    stature: board?.stature ?? null,
    plans,
    proposed: plans.find((p) => p.id === "expected") ?? plans[0] ?? null,
    secondary: season?.secondary ?? null,
    mandate: season?.mandate ?? null,
    brief: brief && typeof brief.reason === "string" ? brief : null,
    confidence: board ? board.confidence : null,
    cash: save.finances.balance,
    weekWages: weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null),
    wageCeiling: board && board.wageRoom > 0 ? board.wageRoom : null,
    gear: GEAR_ORDER.filter((g) => gearState[g]),
    staff: [...(gearState.psychologist ? (["psychologist"] as const) : []), ...STAFF_ORDER.filter((s) => staffState[s])],
    coach: save.coach ?? null,
    starters,
    reserve: save.squad.find((p) => !save.starterIds.includes(p.id)) ?? null,
    org: orgOperationsOf(save),
    sponsor: establishedOf(save) ? (save.sponsor ?? null) : null,
    sense: standingSenseOf(save),
    money: establishedOf(save) ? seasonMoneyOf(save) : null,
  };
}

/** The dossier of one org: the save `createCareer(slot, input, seed)` would make, read for the screen. */
export function takeoverPreviewOf(input: CreateCareerInput, seed: number): TakeoverPreview {
  return takeoverViewOf(createCareerSave(input, seed));
}
