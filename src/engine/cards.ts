/**
 * Card resolution — turns raw data references into display-ready card views.
 * Keeps UI components dumb: they receive a ResolvedCard and render it.
 */

import { RARITY } from "@/config/balance";
import {
  coachById,
  lineupById,
  orgById,
  playerById,
  playerCardById,
  seasonById,
  specialCardById,
  subById,
} from "@/data";
import { clamp } from "@/lib/util";
import type {
  BaseRarity,
  BuffLevel,
  CardKind,
  DraftOfferCard,
  PlayerCard,
  Region,
  RosterPick,
  SpecialCard,
  StatKey,
  Stats,
} from "./types";

export interface ResolvedCard {
  kind: CardKind;
  refId: string;
  /** Person identity (players/coaches/subs) for exclusion + display logic. */
  personId?: string;
  name: string;
  country?: string;
  region?: Region;
  orgId?: string;
  orgName?: string;
  lineupId?: string;
  /** Season of the card's context — drives era-correct org logos (v0.5.1). */
  seasonId?: string;
  seasonShort?: string;
  seasonLabel?: string;
  /** Final overall (manual adjustment applied). Undefined for orgs. */
  overall?: number;
  baseRarity?: BaseRarity;
  special?: SpecialCard;
  /** Org buff or coach bonus. */
  buffType?: StatKey;
  buffLevel?: BuffLevel;
  /** Generic "Coaching Staff" placeholder card. */
  generic?: boolean;
}

export function finalOverall(card: PlayerCard): number {
  return clamp(card.overall + card.manualAdjustment, 60, 99);
}

export function baseRarityOf(overall: number): BaseRarity {
  if (overall >= RARITY.blueMin) return "blue";
  if (overall >= RARITY.goldMin) return "gold";
  if (overall >= RARITY.silverMin) return "silver";
  return "common";
}

/** Org cards earn rarity from their buff: ~ common · + silver · ++ gold · +++ blue. */
export function orgRarityOf(buffLevel: BuffLevel): BaseRarity {
  switch (buffLevel) {
    case "+++":
      return "blue";
    case "++":
      return "gold";
    case "+":
      return "silver";
    default:
      return "common";
  }
}

/** Missing internal stats fall back to the card overall (base doc rule). */
export function effectiveStats(overall: number, partial?: Partial<Stats>): Stats {
  return {
    offense: partial?.offense ?? overall,
    defense: partial?.defense ?? overall,
    mechanics: partial?.mechanics ?? overall,
    consistency: partial?.consistency ?? overall,
    experience: partial?.experience ?? overall,
    clutch: partial?.clutch ?? overall,
  };
}

export function resolvePlayerCard(cardId: string, specialId?: string): ResolvedCard {
  const card = playerCardById.get(cardId);
  if (!card) throw new Error(`Unknown player card "${cardId}"`);
  const special = specialId ? specialCardById.get(specialId) : undefined;
  // A special carries its own historical context: any card of the player can
  // roll it (v0.5), but the moment's org/season is what the card shows.
  const ctx = (special && playerCardById.get(special.baseCardId)) || card;
  const player = playerById.get(card.playerId);
  const org = orgById.get(ctx.orgId);
  const season = seasonById.get(ctx.seasonId);
  const overall = special ? special.overall : finalOverall(card);
  return {
    kind: "player",
    refId: cardId,
    personId: card.playerId,
    name: player?.nickname ?? card.playerId,
    country: player?.country,
    region: player?.region,
    orgId: ctx.orgId,
    orgName: org?.name,
    lineupId: ctx.lineupId,
    seasonId: ctx.seasonId,
    seasonShort: season?.shortLabel,
    seasonLabel: season?.label,
    overall,
    baseRarity: baseRarityOf(overall),
    special,
  };
}

/** Vacant slot cards ("No Coach" / "No Sub") — pickable empty slots. */
function vacantCard(kind: "coach" | "sub", refId: string): ResolvedCard {
  return {
    kind,
    refId,
    name: kind === "coach" ? "No Coach" : "No Sub",
    overall: 50,
    baseRarity: "common",
    generic: true,
  };
}

export function resolveCoach(coachId: string, specialId?: string): ResolvedCard {
  if (coachId === "vacant-coach") return vacantCard("coach", coachId);
  const coach = coachById.get(coachId);
  if (!coach) throw new Error(`Unknown coach card "${coachId}"`);
  const special = specialId ? specialCardById.get(specialId) : undefined;
  // Coach specials carry their own moment too (see resolvePlayerCard).
  const ctx = (special && coachById.get(special.baseCardId)) || coach;
  const org = orgById.get(ctx.orgId);
  const season = seasonById.get(ctx.seasonId);
  const overall = special ? special.overall : coach.overall;
  return {
    kind: "coach",
    refId: coachId,
    personId: coach.personId,
    name: coach.name,
    country: coach.country,
    region: coach.region,
    orgId: ctx.orgId,
    orgName: org?.name,
    lineupId: ctx.lineupId,
    seasonId: ctx.seasonId,
    seasonShort: season?.shortLabel,
    seasonLabel: season?.label,
    overall,
    baseRarity: baseRarityOf(overall),
    special,
    buffType: coach.bonusType,
    buffLevel: coach.bonusLevel,
    generic: coach.generic,
  };
}

export function resolveSub(subId: string): ResolvedCard {
  if (subId === "vacant-sub") return vacantCard("sub", subId);
  const sub = subById.get(subId);
  if (!sub) throw new Error(`Unknown sub card "${subId}"`);
  const org = orgById.get(sub.orgId);
  const season = seasonById.get(sub.seasonId);
  return {
    kind: "sub",
    refId: subId,
    personId: sub.personId,
    name: sub.name,
    country: sub.country,
    region: sub.region,
    orgId: sub.orgId,
    orgName: org?.name,
    lineupId: sub.lineupId,
    seasonId: sub.seasonId,
    seasonShort: season?.shortLabel,
    seasonLabel: season?.label,
    overall: sub.overall,
    baseRarity: baseRarityOf(sub.overall),
  };
}

export function resolveOrg(
  orgId: string,
  buffOverride?: BuffLevel,
  seasonId?: string,
): ResolvedCard {
  const org = orgById.get(orgId);
  if (!org) throw new Error(`Unknown org "${orgId}"`);
  const buffLevel = buffOverride ?? org.buffLevel;
  return {
    kind: "org",
    refId: orgId,
    name: org.name,
    region: org.region,
    orgId: org.id,
    orgName: org.name,
    seasonId,
    baseRarity: orgRarityOf(buffLevel),
    buffType: org.buffType,
    buffLevel,
  };
}

/** Org buff strength as of a given lineup's season (era-accurate). */
export function orgBuffForLineup(orgId: string, lineupId?: string): BuffLevel {
  const lineup = lineupId ? lineupById.get(lineupId) : undefined;
  return lineup?.orgBuffLevel ?? orgById.get(orgId)?.buffLevel ?? "~";
}

export function resolveOfferCard(card: DraftOfferCard, offerLineupId?: string): ResolvedCard {
  switch (card.kind) {
    case "player":
      return resolvePlayerCard(card.refId, card.specialId);
    case "coach":
      return resolveCoach(card.refId, card.specialId);
    case "sub":
      return resolveSub(card.refId);
    case "org":
      return resolveOrg(
        card.refId,
        orgBuffForLineup(card.refId, offerLineupId),
        offerLineupId ? lineupById.get(offerLineupId)?.seasonId : undefined,
      );
  }
}

export function resolvePick(pick: RosterPick): ResolvedCard {
  switch (pick.kind) {
    case "player":
      return resolvePlayerCard(pick.refId, pick.specialId);
    case "coach":
      return resolveCoach(pick.refId, pick.specialId);
    case "sub":
      return resolveSub(pick.refId);
    case "org":
      return resolveOrg(
        pick.refId,
        orgBuffForLineup(pick.refId, pick.fromLineupId),
        lineupById.get(pick.fromLineupId)?.seasonId,
      );
  }
}

/** Display resolution for a special card (player- or coach-based). */
export function resolveSpecial(sp: SpecialCard): ResolvedCard {
  return sp.kind === "coach"
    ? resolveCoach(sp.baseCardId, sp.id)
    : resolvePlayerCard(sp.baseCardId, sp.id);
}

/** Lineup header info for the draft screen. */
export function lineupHeader(lineupId: string) {
  const lineup = lineupById.get(lineupId);
  if (!lineup) throw new Error(`Unknown lineup "${lineupId}"`);
  const org = orgById.get(lineup.orgId);
  const season = seasonById.get(lineup.seasonId);
  return {
    name: lineup.name,
    orgName: org?.name ?? lineup.name,
    seasonLabel: season?.label ?? lineup.seasonId,
    seasonShort: season?.shortLabel ?? "",
    region: lineup.region,
  };
}
