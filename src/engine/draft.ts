/**
 * Draft state machine (base doc §4-§6, revised in v0.2, v0.5).
 *
 * Rules implemented here:
 *  - Each round shows one random historical lineup (pure random, all difficulties).
 *  - Lineups are drawn WITHOUT replacement within a run; pool resets if exhausted.
 *  - Free choice: pick one card per round and place it on a chosen slot
 *    (players pick which of the three player slots).
 *  - A person picked once (player/coach/sub) is excluded for the rest of the run.
 *  - Only sub cards can fill the sub slot (v0.2 — player-as-sub removed).
 *  - Missing coach/sub show as vacant cards but are NOT pickable (v0.5 — the
 *    pickable punt was removed); a fully blocked offer grants a FREE reroll
 *    (does not consume the difficulty reroll budget).
 *  - When only coach/sub slots remain, the draw favors lineups that still
 *    have them (soft weighting, see DRAFT.staffScarcityBoost).
 *  - Special versions roll per PERSON: any card of a player can appear as any
 *    of that player's specials, weighted by rarity tier (v0.5).
 *  - Paid rerolls replace the entire lineup and are limited by difficulty.
 */

import { DIFFICULTY, DRAFT, SPECIALS } from "@/config/balance";
import {
  coachById,
  coachSpecialsByPersonId,
  draftableLineups,
  lineupById,
  lineups,
  playerCardById,
  specialsByPlayerId,
  subById,
} from "@/data";
import type { Rng } from "@/lib/rng";
import type {
  CardKind,
  Difficulty,
  DraftOffer,
  DraftOfferCard,
  DraftState,
  Lineup,
  Roster,
  RosterPick,
  RosterSlotId,
  RunMode,
  SpecialCard,
} from "./types";

const PLAYER_SLOTS: RosterSlotId[] = ["player1", "player2", "player3"];

/**
 * Virtual "no coach/sub this season" cards. Shown in the offer as context but
 * never pickable (v0.5 — picking a vacant slot was removed; blocked offers
 * grant a free reroll instead).
 */
export const VACANT_COACH = "vacant-coach";
export const VACANT_SUB = "vacant-sub";
export const VACANT_OVERALL = 50;

/**
 * Roll a special appearance from a person's pool: gate by chance, then pick
 * which special by rarity weight (legendaries are the chase pulls).
 * Shared by the draft offer and the AI opponent upgrade path.
 */
export function rollSpecial(
  pool: SpecialCard[] | undefined,
  chance: number,
  rng: Rng,
): string | undefined {
  if (!pool || pool.length === 0 || !rng.chance(chance)) return undefined;
  return rng.weightedPick(pool, (sp) => SPECIALS.rarityWeights[sp.rarity] ?? 1).id;
}

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
    SPECIALS.appearanceChance * (draft.specialChanceMult ?? 1);

  for (const cardId of lineup.playerCardIds) {
    const card = playerCardById.get(cardId)!;
    // A special version may appear in place of the base card — the pool is
    // the PLAYER's full catalogue, weighted by rarity (v0.5).
    let specialId = rollSpecial(specialsByPlayerId.get(card.playerId), specialChance, rng);
    // Easter-egg lineup (Wings): the creator's card ALWAYS appears as its
    // special (the Creator card) — finding the lineup is the rare gate, so the
    // prize isn't gated behind a second roll (v1.2.0).
    if (lineup.rareSpawn) {
      const eggSpecial = specialsByPlayerId.get(card.playerId)?.[0];
      if (eggSpecial) specialId = eggSpecial.id;
    }
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
        specialId: rollSpecial(
          coachSpecialsByPersonId.get(coach.personId),
          SPECIALS.coachAppearanceChance * (draft.specialChanceMult ?? 1),
          rng,
        ),
        availability: availabilityFor("coach", coach.personId, draft),
      });
    } else {
      // "No Coach" placeholder — context only, never pickable (v0.5).
      cards.push({ kind: "coach", refId: VACANT_COACH, availability: "vacant" });
    }

    if (lineup.subId) {
      const sub = subById.get(lineup.subId)!;
      cards.push({
        kind: "sub",
        refId: sub.id,
        availability: availabilityFor("sub", sub.personId, draft),
      });
    } else {
      cards.push({ kind: "sub", refId: VACANT_SUB, availability: "vacant" });
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
  // An explicit pool (daily / region-locked) may include samOnly teams, so it
  // filters the FULL set; the default general pool is Worlds-only.
  return draft.poolLineupIds
    ? lineups.filter((l) => draft.poolLineupIds!.includes(l.id))
    : draftableLineups;
}

/**
 * Staff scarcity weighting: when the player only needs coach and/or sub,
 * favor lineups that can actually fill those slots (person not taken).
 * Weight ramps 1 → staffScarcityBoost with the share of missing kinds the
 * lineup covers, so blank offers become rare instead of constant.
 */
function lineupWeight(lineup: Lineup, staffNeeds: CardKind[]): number {
  if (staffNeeds.length === 0) return 1;
  let covered = 0;
  if (staffNeeds.includes("coach") && lineup.coachId) covered += 1;
  if (staffNeeds.includes("sub") && lineup.subId) covered += 1;
  return 1 + (covered / staffNeeds.length) * (DRAFT.staffScarcityBoost - 1);
}

export function drawNextOffer(draft: DraftState, rng: Rng): DraftState {
  const fullPool = lineupPool(draft);
  // Easter-egg lineups (Wings) never enter the normal draw — they're excluded
  // here and force-injected below at a small chance. So the seeded daily/general
  // draws stay byte-identical (those pools carry no rareSpawn lineup).
  const eggs = fullPool.filter((l) => l.rareSpawn);
  const base = fullPool.filter((l) => !l.rareSpawn);
  let pool = base.filter((l) => !draft.shownLineupIds.includes(l.id));
  let shown = draft.shownLineupIds;

  // Pool exhausted (small datasets / many free rerolls): reset exclusions.
  if (pool.length === 0) {
    pool = base.slice();
    shown = [];
  }

  // Only coach/sub missing → bias toward lineups that still have them.
  const needs = neededKinds(draft.roster, draft.mode);
  const staffNeeds =
    needs.length > 0 && needs.every((k) => k === "coach" || k === "sub")
      ? needs.filter((k) => {
          if (k === "coach") {
            return !pool.every((l) => !l.coachId); // ignore if nobody has one
          }
          return !pool.every((l) => !l.subId);
        })
      : [];

  // Force-inject an as-yet-unseen easter-egg lineup at a small chance — only
  // reachable in the region-locked pool (worlds/daily carry no rareSpawn, so the
  // `&&` short-circuits and the seeded RNG sequence stays byte-identical).
  const availableEggs = eggs.filter((l) => !draft.shownLineupIds.includes(l.id));
  const lineup =
    availableEggs.length > 0 && rng.chance(DRAFT.easterEggChance)
      ? rng.pick(availableEggs)
      : staffNeeds.length > 0
        ? rng.weightedPick(pool, (l) => lineupWeight(l, staffNeeds))
        : rng.pick(pool);

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
      personId = coachById.get(offerCard.refId)!.personId;
      break;
    case "sub":
      personId = subById.get(offerCard.refId)!.personId;
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
