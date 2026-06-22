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
  playerById,
  playerCardById,
  specialsByPlayerId,
  subById,
} from "@/data";
import type { Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import type {
  CardKind,
  ChallengeConstraint,
  Difficulty,
  DraftOffer,
  DraftOfferCard,
  DraftScriptStep,
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
 * Roll a special appearance from a person's pool (v1.4). Each rarity the person
 * OWNS is rolled at its own ABSOLUTE rate (`SPECIALS.rarityChance × mult`),
 * RAREST FIRST; the first tier to proc supplies the card (uniform within tier).
 *
 * `mult` is the rank/daily special-chance multiplier (1.0 at the baseline rank;
 * higher ranks and the Specials-Surge daily scale it up). Passing a huge mult
 * forces a special to always appear (used by tests / scripted dailies).
 *
 * Why rarest-first per rarity instead of one weighted pick: the old model
 * normalised a single pick across the pool, so a player whose ONLY special is a
 * legendary (kronovi) showed it every time a special procced. Now a legendary
 * appears at its own low rate regardless of how many cards the person has.
 */
export function rollSpecial(
  pool: SpecialCard[] | undefined,
  mult: number,
  rng: Rng,
  allowedRarities?: readonly string[],
): string | undefined {
  // Easter-egg specials (rarity "creator": the Creator + the Wings cards) are
  // assigned ONLY via the rareSpawn-lineup path (see drawNextOffer), never a normal
  // roll — otherwise a creator-rarity card owned by a player WITH OTHER cards (e.g.
  // repi/ninja23509) would leak onto those cards. Exclude them here. (v1.4)
  const rollable = pool?.filter((sp) => sp.rarity !== "creator");
  // v1.3 rank gate: restrict the person's catalogue to the rarities the player's
  // rank has unlocked. Undefined = no gate (daily / pre-v1.3 callers). An empty
  // list (Unranked) leaves no eligible special, so none appears.
  const eligible = allowedRarities
    ? rollable?.filter((sp) => allowedRarities.includes(sp.rarity))
    : rollable;
  if (!eligible || eligible.length === 0) return undefined;
  for (const rarity of SPECIALS.rarityOrder) {
    const tier = eligible.filter((sp) => sp.rarity === rarity);
    if (tier.length === 0) continue;
    if (rng.chance((SPECIALS.rarityChance[rarity] ?? 0) * mult)) {
      return rng.pick(tier).id;
    }
  }
  return undefined;
}

export interface CreateDraftOptions {
  mode?: RunMode;
  /** Restrict the lineup pool (daily challenges). */
  poolLineupIds?: string[];
  /** Override the difficulty's reroll budget (daily modifier). */
  rerollsOverride?: number;
  /** Multiply the special-appearance chance (daily modifier / rank scaling). */
  specialChanceMult?: number;
  /** Rank-gated special rarities that may appear (v1.3). Undefined = all. */
  specialRarities?: string[];
  /** Scripted daily draft: exact lineup per pick, optional forced special. */
  scriptedLineups?: DraftScriptStep[];
  /** Challenge constraint (v1.4): per-card eligibility + no-specials. */
  constraint?: ChallengeConstraint;
}

/**
 * v1.4 challenge eligibility: a drafted PLAYER may be capped by overall and/or
 * pinned to a nationality. Pool-level twists (region/season) are applied via
 * `poolLineupIds`; this is the per-card gate that marks offer cards ineligible.
 */
export function playerEligibleUnderConstraint(
  cardId: string,
  constraint: ChallengeConstraint | undefined,
): boolean {
  if (!constraint) return true;
  const card = playerCardById.get(cardId);
  if (!card) return true;
  if (constraint.maxPlayerOverall != null && finalOverall(card) > constraint.maxPlayerOverall) {
    return false;
  }
  if (constraint.country) {
    const country = playerById.get(card.playerId)?.country;
    if (country !== constraint.country) return false;
  }
  return true;
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
    specialRarities: options.specialRarities,
    scriptedLineups: options.scriptedLineups,
    constraint: options.constraint,
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
  // Rank/daily special-chance multiplier (1.0 at the baseline rank). rollSpecial
  // applies the per-rarity rates × this (v1.4). A "no specials" challenge twist
  // forces 0 → base cards only.
  const mult = draft.constraint?.noSpecials ? 0 : (draft.specialChanceMult ?? 1);

  for (const cardId of lineup.playerCardIds) {
    const card = playerCardById.get(cardId)!;
    // A special version may appear in place of the base card — the pool is
    // the PLAYER's full catalogue, rolled per-rarity rarest-first (v1.4), gated
    // to the player's rank-unlocked rarities (v1.3).
    let specialId = rollSpecial(
      specialsByPlayerId.get(card.playerId),
      mult,
      rng,
      draft.specialRarities,
    );
    // Easter-egg lineup (Wings): the creator's card ALWAYS appears as its
    // special (the Creator card) — finding the lineup is the rare gate, so the
    // prize isn't gated behind a second roll (v1.2.0).
    if (lineup.rareSpawn) {
      const eggSpecial = specialsByPlayerId.get(card.playerId)?.[0];
      if (eggSpecial) specialId = eggSpecial.id;
    }
    // A challenge constraint (OVR cap / nationality) can mark an otherwise-open
    // player card ineligible — shown dimmed, never pickable (v1.4).
    let availability = availabilityFor("player", card.playerId, draft);
    if (availability === "available" && !playerEligibleUnderConstraint(cardId, draft.constraint)) {
      availability = "ineligible";
    }
    cards.push({ kind: "player", refId: cardId, specialId, availability });
  }

  if (draft.mode !== "quick") {
    if (lineup.coachId) {
      const coach = coachById.get(lineup.coachId)!;
      cards.push({
        kind: "coach",
        refId: coach.id,
        specialId: rollSpecial(
          coachSpecialsByPersonId.get(coach.personId),
          mult,
          rng,
          draft.specialRarities,
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
        // v1.3.3: subs can roll a special too (specials belong to the PERSON, so a
        // sub who was also a famous player — e.g. Turbopolsa — can show one).
        specialId: rollSpecial(
          specialsByPlayerId.get(sub.personId),
          mult,
          rng,
          draft.specialRarities,
        ),
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

  // Scripted daily (v1.2.1): force the scripted player to appear as its special on
  // this pick — regardless of whether its slot is still open (the card still
  // shows; it's just not pickable once the slot is full). Keyed off picks made
  // (reroll-proof). Only set on an authored daily; inert otherwise.
  const scriptStep = draft.scriptedLineups?.[filledCount(draft.roster)];
  if (scriptStep?.special) {
    const target = cards.find(
      (c) =>
        c.kind === "player" &&
        playerCardById.get(c.refId)?.playerId === scriptStep.special!.playerId,
    );
    if (target) target.specialId = scriptStep.special.specialId;
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

/** Roster overall (avg of the three player cards). Memoised — a lineup constant. */
const lineupOverallCache = new Map<string, number>();
function lineupOverall(lineup: Lineup): number {
  const cached = lineupOverallCache.get(lineup.id);
  if (cached !== undefined) return cached;
  const cards = lineup.playerCardIds.map((id) => playerCardById.get(id)!);
  const avg =
    cards.reduce((sum, c) => sum + finalOverall(c), 0) / Math.max(1, cards.length);
  lineupOverallCache.set(lineup.id, avg);
  return avg;
}

/**
 * Soft anti-frustration weight by roster OVERALL (v1.3.3; was historical strength).
 * The lineup's overall is normalised within the draw pool [poolMin, poolMax] and
 * lerped to a raw weight in [draftWeight.min, .max], then scaled by `bias`. 1 =
 * neutral. Never filters the pool — weak rosters still appear, just a touch less.
 */
function lineupTierWeight(
  lineup: Lineup,
  poolMin: number,
  poolMax: number,
  bias: number,
): number {
  if (poolMax <= poolMin) return 1;
  const norm = (lineupOverall(lineup) - poolMin) / (poolMax - poolMin);
  const raw = DRAFT.draftWeight.min + norm * (DRAFT.draftWeight.max - DRAFT.draftWeight.min);
  return 1 + (raw - 1) * bias;
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
  // Tier bias is classic/quick only — the daily's draw must stay byte-identical
  // (tierBiasOn=false there → the staff branch multiplies by 1 and the open branch
  // stays rng.pick, so the seeded RNG sequence is untouched).
  const tierBiasOn = draft.mode !== "daily";
  // Region-locked pools (SAM) get a firmer nudge; worldwide stays gentle. Overall
  // range is taken over the stable full `base` pool so a lineup's weight doesn't
  // drift as others are drawn without replacement.
  const bias = draft.poolLineupIds ? DRAFT.regionTierBias : DRAFT.tierBias;
  const overalls = base.map(lineupOverall);
  const poolMin = overalls.length ? Math.min(...overalls) : 0;
  const poolMax = overalls.length ? Math.max(...overalls) : 0;
  const tierWeight = (l: Lineup) => lineupTierWeight(l, poolMin, poolMax, bias);
  const randomLineup = (): Lineup => {
    if (availableEggs.length > 0 && rng.chance(DRAFT.easterEggChance)) {
      return rng.pick(availableEggs);
    }
    if (staffNeeds.length > 0) {
      return rng.weightedPick(
        pool,
        (l) => lineupWeight(l, staffNeeds) * (tierBiasOn ? tierWeight(l) : 1),
      );
    }
    return tierBiasOn ? rng.weightedPick(pool, tierWeight) : rng.pick(pool);
  };

  const draw = (lineup: Lineup): DraftState => {
    const next: DraftState = {
      ...draft,
      round: draft.round + 1,
      shownLineupIds: [...shown, lineup.id],
      offer: null,
    };
    return { ...next, offer: buildOffer(lineup.id, next, rng) };
  };

  // Scripted daily (v1.2.1): use the authored lineup for this pick. If it can't
  // fill the remaining slots (e.g. only a coach is needed but it has none), fall
  // back to the normal staff-aware draw so the run can always complete.
  const scriptStep = draft.scriptedLineups?.[filledCount(draft.roster)];
  const scripted = scriptStep ? lineupById.get(scriptStep.lineupId) : undefined;
  if (scripted) {
    const state = draw(scripted);
    if (state.offer?.hasPickableCard) return state;
  }
  return draw(randomLineup());
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
