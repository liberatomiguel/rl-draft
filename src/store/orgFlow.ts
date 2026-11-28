/**
 * rc.9 ORG: the established org's own flows (FEATURES.realOrgStart; the board's
 * parts also need FEATURES.board). Every function returns the founded answer,
 * or does nothing, for a founded club.
 *
 *  - The org catalogue's actions (R220): upgrade a facility a level, staff or
 *    close a department, run the event camp. Each is the founded flow it maps
 *    onto (buyGearFlow, setStaffFlow, setPsychologistFlow, runBootcampFlow),
 *    so prices, refusals and effects are the engine's own.
 *  - The deal in force on the takeover day (R221).
 *  - The repair on load of an rc.8 takeover save (R225).
 */

import { CAREER_ORG, CAREER_STAFF } from "@/config/balance";
import type { BoardState } from "@/engine/career/boardTypes";
import { weekOfDay } from "@/engine/career/calendar";
import { careerSeasonOf } from "@/engine/career/era";
import { pushLedger, staffOn } from "@/engine/career/economy";
import { establishedOf, tierOf } from "@/engine/career/established";
import {
  ORG_DEPARTMENT_ROLE,
  departmentStaffedOf,
  nextLevelGearOf,
  orgItemOfFounded,
  type OrgDepartmentId,
  type OrgFacilityId,
} from "@/engine/career/orgCatalogue";
import { inheritedDealOf, offerTierFor, sponsorAccessFor, sponsorDecisionFor, sponsorLadderLevelOf } from "@/engine/career/sponsorDeals";
import { deliverMail } from "@/engine/career/communications";
import type { CareerSave } from "@/engine/career/types";
import { buyGearFlow, gearRefusalOf, runBootcampFlow, setPsychologistFlow, setStaffFlow, sponsorLevelOf, type FlowResult } from "./careerFlow";

// ---------------------------------------------------------------------------
// The catalogue's actions (R220)
// ---------------------------------------------------------------------------

/** Why the facility's next level cannot be built now (null = it can): "maxed", "founded", or the gear flow's refusal. */
export function facilityUpgradeRefusalOf(save: CareerSave, id: OrgFacilityId): string | null {
  if (!establishedOf(save)) return "founded";
  const gear = nextLevelGearOf(save.finances.gear, id);
  if (!gear) return "maxed";
  return gearRefusalOf(save, gear);
}

/**
 * Build the facility's next level: the founded installation it maps onto is
 * bought (its price, upkeep and effect), with the board's sign-off. The
 * ledger line names the facility, not the installation.
 */
export function upgradeFacilityFlow(input: CareerSave, id: OrgFacilityId): FlowResult {
  const refused = facilityUpgradeRefusalOf(input, id);
  if (refused) return { save: input, error: refused };
  const gear = nextLevelGearOf(input.finances.gear, id)!;
  return buyGearFlow(input, gear);
}

/** Staff (on) or close (off) a department: the founded role's retainer and refusals. */
export function setDepartmentFlow(input: CareerSave, id: OrgDepartmentId, on: boolean): FlowResult {
  if (!establishedOf(input)) return { save: input, error: "founded" };
  if (departmentStaffedOf(input.finances.gear, id) === on) return { save: input };
  const role = ORG_DEPARTMENT_ROLE[id];
  return role === "psychologist" ? setPsychologistFlow(input, on) : setStaffFlow(input, role, on);
}

/** Run the event camp (the structured bootcamp an established org runs). */
export function runEventCampFlow(input: CareerSave): FlowResult {
  if (!establishedOf(input)) return { save: input, error: "founded" };
  return runBootcampFlow(input);
}

/** The ledger's reference for a purchase: an established org's names the facility (the screen resolves it). */
export function orgRefNameOf(save: CareerSave, foundedId: string): string {
  return establishedOf(save) ? (orgItemOfFounded(foundedId) ?? foundedId) : foundedId;
}

// ---------------------------------------------------------------------------
// The deal in force (R221)
// ---------------------------------------------------------------------------

/**
 * A takeover arrives with a running sponsor deal: the offer
 * of the difficulty's profile (R226: easy steady, normal balanced, hard bold) its desk would make today (same brands, money, goal
 * and fines), signed before the manager arrived. Its fixed part is booked
 * today as a signing books it; a mail from Sponsor Relations says what the
 * deal pays, what it asks and when it ends. No desk opens: the first
 * negotiation is its renewal when it ends. Mutates; idempotent.
 */
export function signInheritedSponsor(save: CareerSave): boolean {
  const tier = tierOf(save);
  if (!tier || save.sponsor || save.phase === "ended") return false;
  const today = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  // R226: every profile is on the day's desk, the bold one too (its ladder level does not gate an inherited deal).
  const access = { ...sponsorAccessFor(sponsorLadderLevelOf(save.reputation)), offers: 3 as const, boldAllowed: true };
  const offers = sponsorDecisionFor({
    tier: offerTierFor(save.reputation, false),
    today,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    level: sponsorLevelOf(save),
    access: staffOn(save.finances.gear, "brand") ? { ...access, valueMult: access.valueMult * CAREER_STAFF.roles.brand.sponsorValueMult } : access,
  });
  const deal = inheritedDealOf(offers, CAREER_ORG.inheritedSponsor.profile[save.difficulty] ?? "balanced", today);
  if (!deal || !deal.terms) return false;
  save.sponsor = deal;
  save.sponsorOffers = null;
  const terms = deal.terms;
  if (terms.fixedKind === "signing" && terms.fixed > 0) {
    terms.fixedPaid = true;
    save.finances = pushLedger(save.finances, { seasonIndex: today.seasonIndex, week: weekOfDay(today.day), day: today.day, kind: "sponsorSigning", amount: terms.fixed, refName: deal.sponsorId });
  }
  deliverMail(save, {
    kind: "sponsor",
    titleKey: "sponsorInherited",
    bodyKey: "sponsorInherited",
    params: {
      name: deal.sponsorId,
      org: save.identity.orgName,
      base: terms.weekly,
      bonus: deal.bonus,
      profile: terms.profile,
      endWeek: weekOfDay(terms.endsOn.day),
      endSeason: careerSeasonOf(save, terms.endsOn.seasonIndex) + 1,
      fines: terms.fineShare > 0 ? 1 : 0,
    },
    fromKey: "sponsor",
    linkTo: "/career/finances",
  });
  return true;
}

// ---------------------------------------------------------------------------
// The repair on load (R225)
// ---------------------------------------------------------------------------

/**
 * An rc.8 takeover save, on every load (idempotent, nothing for a founded
 * club): the season's opening cash for the money summary, read back from the
 * ledger when the board's payment is still in it (the cash before that line).
 * A save whose ledger no longer holds it keeps no opening and the summary
 * says so. Nothing else is written: the catalogue reads the gear as levels,
 * the deal on the desk (or signed) keeps running, the tier reads the board's
 * stature.
 */
export function repairEstablishedOnLoad(save: CareerSave): void {
  if (!establishedOf(save) || !save.board) return;
  const season = (save.board as BoardState).season;
  if (!season || season.seasonIndex !== save.clock.seasonIndex || season.openingCash !== undefined) return;
  const ledger = save.finances.ledger;
  const grantAt = ledger.findIndex((e) => e.seasonIndex === season.seasonIndex && e.kind === "boardGrant" && !e.refName);
  // The season not yet acknowledged holds the clock: the cash in hand is the opening.
  if (season.choice === null) {
    season.openingCash = save.finances.balance;
    return;
  }
  if (grantAt < 0) return;
  season.openingCash = save.finances.balance - ledger.slice(grantAt).reduce((s, e) => s + e.amount, 0);
}
