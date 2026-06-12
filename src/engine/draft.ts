/**
 * Draft state machine (base doc §4-§6, revised in v0.2).
 *
 * Rules implemented here:
 *  - Each round shows one random historical lineup (pure random, all difficulties).
 *  - Lineups are drawn WITHOUT replacement within a run; pool resets if exhausted.
 *  - Free choice: pick one card per round and place it on a chosen slot
 *    (players pick which of the three player slots).
 *  - A person picked once (player/coach/sub) is excluded for the rest of the run.
 *  - Only sub cards can fill the sub slot (v0.2 — player-as-sub removed).
 *  - If nothing in the offer is pickable, the player gets a FREE reroll
 *    (does not consume the difficulty reroll budget).
 *  - Paid rerolls replace the entire lineup and are limited by difficulty.
 */

import { DIFFICULTY, DRAFT } from "@/config/balance";
import { coachById, lineupById, lineups, playerCardById, specialByBaseCardId, subById } from "@/data";
import type { Rng } from "@/lib/rng";
import type {
  CardKind,
  Difficulty,
  DraftOffer,
  DraftOfferCard,
  DraftState,
  Roster,
  RosterPick,
  RosterSlotId,
  RunMode,
} from "./types";

const PLAYER_SLOTS: RosterSlotId[] = ["player1", "player2", "player3"];

/**
 * Virtual "leave it empty" cards. When a lineup has no coach/sub, these are
 * offered instead and CAN be drafted (overall 50, no bonuses) — letting the
 * player intentionally punt a slot to finish the draft sooner.
 */
export const VACANT_COACH = "vacant-coach";
export const VACANT_SUB = "vacant-sub";
export const VACANT_OVERALL = 50;

export interface CreateDraftOptions {
  mode?: RunMode;
  /** Restrict the lineup pool (daily challenges). */
  poolLineupIds?: string[];
  /** Override the difficulty's reroll budget (daily modifier). */
  rerollsOverride?: number;
  /** Multiply the special-appearance chance (daily modifier). */
  specialChanceMult?: number;
}

export function createDraft(
  difficulty: Difficulty,
  options: CreateDraftOptions = {},
): DraftState {
  return {
    mode: options.mode ?? "classic",
    round: 0,
    rerollsLeft: options.rerollsOverride ?? DIFFICULTY[difficulty].rerolls,
    shownLineupIds: [],
    takenPersonIds: [],
    poolLineupIds: options.poolLineupIds,
    specialChanceMult: options.specialChanceMult,
    offer: null,
    roster: {},
    complete: false,
  };
}

/** Quick mode drafts players only. */
function slotTarget(mode: RunMode): number {
  return mode === "quick" ? 3 : 6;
}

// ---------------------------------------------------------------------------
// Slot helpers
// ---------------------------------------------------------------------------

export function openPlayerSlot(roster: Roster): RosterSlotId | null {
  return PLAYER_SLOTS.find((slot) => !roster[slot]) ?? null;
}

export function filledCount(roster: Roster): number {
  return (Object.keys(roster) as RosterSlotId[]).filter((k) => roster[k]).length;
}

export function neededKinds(roster: Roster, mode: RunMode = "classic"): CardKind[] {
  const needs: CardKind[] = [];
  if (openPlayerSlot(roster)) needs.push("player");
  if (mode !== "quick") {
    if (!roster.coach) needs.push("coach");
    if (!roster.sub) needs.push("sub");
    if (!roster.org) needs.push("org");
  }
  return needs;
}

/** Slots a given card kind may occupy (players choose among the open ones). */
export function slotsForKind(kind: CardKind): RosterSlotId[] {
  switch (kind) {
    case "player":
      return PLAYER_SLOTS;
    case "coach":
      return ["coach"];
    case "sub":
      return ["sub"];
    case "org":
      return ["org"];
  }
}

// ---------------------------------------------------------------------------
// Offer creation
// ---------------------------------------------------------------------------

function availabilityFor(
  kind: CardKind,
  personId: string | null,
  draft: DraftState,
): DraftOfferCard["availability"] {
  if (personId && draft.takenPersonIds.includes(personId)) return "already_drafted";
  const hasOpenSlot = slotsForKind(kind).some((slot) => !draft.roster[slot]);
  return hasOpenSlot ? "available" : "slot_full";
}

function buildOffer(lineupId: string, draft: DraftState, rng: Rng): DraftOffer {
  const lineup = lineupById.get(lineupId);
  if (!lineup) throw new Error(`Unknown lineup "${lineupId}"`);

  const cards: DraftOfferCard[] = [];
  const specialChance =
    DRAFT.specialAppearanceChance * (draft.specialChanceMult ?? 1);

  for (const cardId of lineup.playerCardIds) {
    const card = playerCardById.get(cardId)!;
    // Special version may appear in place of the base card (collectible rule).
    const special = specialByBaseCardId.get(cardId);
    const specialId =
      special && rng.chance(specialChance) ? special.id : undefined;
    cards.push({
      kind: "player",
      refId: cardId,
      specialId,
      availability: availabilityFor("player", card.playerId, draft),
    });
  }

  if (draft.mode !== "quick") {
    if (lineup.coachId) {
      const coach = coachById.get(lineup.coachId)!;
      cards.push({
        kind: "coach",
        refId: coach.id,
        availability: availabilityFor("coach", coach.personId, draft),
      });
    } else {
      // "No Coach" vacant card — pickable, fills the slot with nothing.
      cards.push({
        kind: "coach",
        refId: VACANT_COACH,
        availability: availabilityFor("coach", null, draft),
      });
    }

    if (lineup.subId) {
      const sub = subById.get(lineup.subId)!;
      cards.push({
        kind: "sub",
        refId: sub.id,
        availability: availabilityFor("sub", sub.personId, draft),
      });
    } else {
      cards.push({
        kind: "sub",
        refId: VACANT_SUB,
        availability: availabilityFor("sub", null, draft),
      });
    }

    cards.push({
      kind: "org",
      refId: lineup.orgId,
      availability: availabilityFor("org", null, draft),
    });
  }

  const hasPickableCard = cards.some((c) => c.availability === "available");

  return { lineupId, cards, hasPickableCard };
}

function lineupPool(draft: DraftState) {
  return draft.poolLineupIds
    ? lineups.filter((l) => draft.poolLineupIds!.includes(l.id))
    : lineups;
}

export function drawNextOffer(draft: DraftState, rng: Rng): DraftState {
  const fullPool = lineupPool(draft);
  let pool = fullPool.filter((l) => !draft.shownLineupIds.includes(l.id));
  let shown = draft.shownLineupIds;

  // Pool exhausted (small datasets / many free rerolls): reset exclusions.
  if (pool.length === 0) {
    pool = fullPool.slice();
    shown = [];
  }

  const lineup = rng.pick(pool);
  const next: DraftState = {
    ...draft,
    round: draft.round + 1,
    shownLineupIds: [...shown, lineup.id],
    offer: null,
  };
  return { ...next, offer: buildOffer(lineup.id, next, rng) };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyReroll(draft: DraftState, rng: Rng): DraftState {
  if (draft.rerollsLeft <= 0) throw new Error("No rerolls left");
  if (!draft.offer) throw new Error("No active offer to reroll");
  return drawNextOffer({ ...draft, rerollsLeft: draft.rerollsLeft - 1 }, rng);
}

/** Free reroll — only legal when the offer has no pickable card. */
export function applyFreeReroll(draft: DraftState, rng: Rng): DraftState {
  if (!draft.offer) throw new Error("No active offer");
  if (draft.offer.hasPickableCard) {
    throw new Error("Free reroll is only granted when no card is pickable");
  }
  return drawNextOffer(draft, rng);
}

export function applyPick(
  draft: DraftState,
  offerCard: DraftOfferCard,
  targetSlot: RosterSlotId,
  rng: Rng,
): DraftState {
  if (!draft.offer) throw new Error("No active offer");
  if (!draft.offer.cards.some((c) => c.kind === offerCard.kind && c.refId === offerCard.refId)) {
    throw new Error("Card is not part of the current offer");
  }
  if (offerCard.availability !== "available") {
    throw new Error(`Card not pickable (${offerCard.availability})`);
  }
  if (!slotsForKind(offerCard.kind).includes(targetSlot)) {
    throw new Error(`A ${offerCard.kind} card cannot fill the ${targetSlot} slot`);
  }
  if (draft.roster[targetSlot]) {
    throw new Error(`Slot ${targetSlot} is already filled`);
  }

  let personId: string | null = null;
  switch (offerCard.kind) {
    case "player":
      personId = playerCardById.get(offerCard.refId)!.playerId;
      break;
    case "coach":
      personId =
        offerCard.refId === VACANT_COACH
          ? null
          : coachById.get(offerCard.refId)!.personId;
      break;
    case "sub":
      personId =
        offerCard.refId === VACANT_SUB
          ? null
          : subById.get(offerCard.refId)!.personId;
      break;
    case "org":
      break;
  }

  const pick: RosterPick = {
    slot: targetSlot,
    kind: offerCard.kind,
    refId: offerCard.refId,
    specialId: offerCard.specialId,
    fromLineupId: draft.offer.lineupId,
  };

  const roster: Roster = { ...draft.roster, [targetSlot]: pick };
  const takenPersonIds = personId
    ? [...draft.takenPersonIds, personId]
    : draft.takenPersonIds;

  const complete = filledCount(roster) === slotTarget(draft.mode);
  const next: DraftState = { ...draft, roster, takenPersonIds, offer: null, complete };

  return complete ? next : drawNextOffer(next, rng);
}
