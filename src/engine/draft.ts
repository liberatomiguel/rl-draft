/**
 * Draft state machine (base doc §4-§6).
 *
 * Rules implemented here:
 *  - Each round shows one random historical lineup (pure random, all difficulties).
 *  - Lineups are drawn WITHOUT replacement within a run; pool resets if exhausted.
 *  - Free choice: any card can be taken, one per round.
 *  - A person picked once (player/coach/sub) is excluded for the rest of the run.
 *  - When player slots are full, player cards can still be drafted INTO the sub
 *    slot (design decision — see docs/DESIGN-DECISIONS.md).
 *  - If nothing in the offer is pickable, the lineup can be skipped for free.
 *  - Rerolls replace the entire lineup and are limited by difficulty.
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
} from "./types";

const PLAYER_SLOTS: RosterSlotId[] = ["player1", "player2", "player3"];

export function createDraft(difficulty: Difficulty): DraftState {
  return {
    round: 0,
    rerollsLeft: DIFFICULTY[difficulty].rerolls,
    shownLineupIds: [],
    takenPersonIds: [],
    offer: null,
    roster: {},
    complete: false,
  };
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

export function neededKinds(roster: Roster): CardKind[] {
  const needs: CardKind[] = [];
  if (openPlayerSlot(roster)) needs.push("player");
  if (!roster.coach) needs.push("coach");
  if (!roster.sub) needs.push("sub");
  if (!roster.org) needs.push("org");
  return needs;
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
  switch (kind) {
    case "player":
      if (openPlayerSlot(draft.roster)) return "available";
      if (!draft.roster.sub) return "as_sub";
      return "slot_full";
    case "coach":
      return draft.roster.coach ? "slot_full" : "available";
    case "sub":
      return draft.roster.sub ? "slot_full" : "available";
    case "org":
      return draft.roster.org ? "slot_full" : "available";
  }
}

function buildOffer(lineupId: string, draft: DraftState, rng: Rng): DraftOffer {
  const lineup = lineupById.get(lineupId);
  if (!lineup) throw new Error(`Unknown lineup "${lineupId}"`);

  const cards: DraftOfferCard[] = [];

  for (const cardId of lineup.playerCardIds) {
    const card = playerCardById.get(cardId)!;
    // Special version may appear in place of the base card (collectible rule).
    const special = specialByBaseCardId.get(cardId);
    const specialId =
      special && rng.chance(DRAFT.specialAppearanceChance) ? special.id : undefined;
    cards.push({
      kind: "player",
      refId: cardId,
      specialId,
      availability: availabilityFor("player", card.playerId, draft),
    });
  }

  if (lineup.coachId) {
    const coach = coachById.get(lineup.coachId)!;
    cards.push({
      kind: "coach",
      refId: coach.id,
      availability: availabilityFor("coach", coach.personId, draft),
    });
  }

  if (lineup.subId) {
    const sub = subById.get(lineup.subId)!;
    cards.push({
      kind: "sub",
      refId: sub.id,
      availability: availabilityFor("sub", sub.personId, draft),
    });
  }

  cards.push({
    kind: "org",
    refId: lineup.orgId,
    availability: availabilityFor("org", null, draft),
  });

  const hasPickableCard = cards.some(
    (c) => c.availability === "available" || c.availability === "as_sub",
  );

  return { lineupId, cards, hasPickableCard };
}

export function drawNextOffer(draft: DraftState, rng: Rng): DraftState {
  let pool = lineups.filter((l) => !draft.shownLineupIds.includes(l.id));
  let shown = draft.shownLineupIds;

  // Pool exhausted (small datasets / many skips): reset exclusions.
  if (pool.length === 0) {
    pool = lineups.slice();
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

/** Free skip — only legal when the offer has no pickable card. */
export function applySkip(draft: DraftState, rng: Rng): DraftState {
  if (!draft.offer) throw new Error("No active offer to skip");
  if (draft.offer.hasPickableCard) {
    throw new Error("Skip is only allowed when no card is pickable");
  }
  return drawNextOffer(draft, rng);
}

export function applyPick(
  draft: DraftState,
  offerCard: DraftOfferCard,
  rng: Rng,
): DraftState {
  if (!draft.offer) throw new Error("No active offer");
  if (!draft.offer.cards.some((c) => c.kind === offerCard.kind && c.refId === offerCard.refId)) {
    throw new Error("Card is not part of the current offer");
  }
  if (offerCard.availability !== "available" && offerCard.availability !== "as_sub") {
    throw new Error(`Card not pickable (${offerCard.availability})`);
  }

  let slot: RosterSlotId;
  let asSub = false;
  let personId: string | null = null;

  switch (offerCard.kind) {
    case "player": {
      const card = playerCardById.get(offerCard.refId)!;
      personId = card.playerId;
      const open = openPlayerSlot(draft.roster);
      if (open) {
        slot = open;
      } else {
        slot = "sub";
        asSub = true;
      }
      break;
    }
    case "coach": {
      personId = coachById.get(offerCard.refId)!.personId;
      slot = "coach";
      break;
    }
    case "sub": {
      personId = subById.get(offerCard.refId)!.personId;
      slot = "sub";
      break;
    }
    case "org": {
      slot = "org";
      break;
    }
  }

  const pick: RosterPick = {
    slot,
    kind: offerCard.kind,
    refId: offerCard.refId,
    specialId: offerCard.specialId,
    asSub: asSub || undefined,
    fromLineupId: draft.offer.lineupId,
  };

  const roster: Roster = { ...draft.roster, [slot]: pick };
  const takenPersonIds = personId
    ? [...draft.takenPersonIds, personId]
    : draft.takenPersonIds;

  const complete = filledCount(roster) === 6;
  const next: DraftState = { ...draft, roster, takenPersonIds, offer: null, complete };

  return complete ? next : drawNextOffer(next, rng);
}
