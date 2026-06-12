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
  const player = playerById.get(card.playerId);
  const org = orgById.get(card.orgId);
  const season = seasonById.get(card.seasonId);
  const special = specialId ? specialCardById.get(specialId) : undefined;
  const overall = special ? special.overall : finalOverall(card);
  return {
    kind: "player",
    refId: cardId,
    personId: card.playerId,
    name: player?.nickname ?? card.playerId,
    country: player?.country,
    region: player?.region,
    orgId: card.orgId,
    orgName: org?.name,
    lineupId: card.lineupId,
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

export function resolveCoach(coachId: string): ResolvedCard {
  if (coachId === "vacant-coach") return vacantCard("coach", coachId);
  const coach = coachById.get(coachId);
  if (!coach) throw new Error(`Unknown coach card "${coachId}"`);
  const org = orgById.get(coach.orgId);
  const season = seasonById.get(coach.seasonId);
  return {
    kind: "coach",
    refId: coachId,
    personId: coach.personId,
    name: coach.name,
    country: coach.country,
    region: coach.region,
    orgId: coach.orgId,
    orgName: org?.name,
    lineupId: coach.lineupId,
    seasonShort: season?.shortLabel,
    seasonLabel: season?.label,
    overall: coach.overall,
    baseRarity: baseRarityOf(coach.overall),
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
    seasonShort: season?.shortLabel,
    seasonLabel: season?.label,
    overall: sub.overall,
    baseRarity: baseRarityOf(sub.overall),
  };
}

export function resolveOrg(orgId: string): ResolvedCard {
  const org = orgById.get(orgId);
  if (!org) throw new Error(`Unknown org "${orgId}"`);
  return {
    kind: "org",
    refId: orgId,
    name: org.name,
    region: org.region,
    orgId: org.id,
    orgName: org.name,
    baseRarity: orgRarityOf(org.buffLevel),
    buffType: org.buffType,
    buffLevel: org.buffLevel,
  };
}

export function resolveOfferCard(card: DraftOfferCard): ResolvedCard {
  switch (card.kind) {
    case "player":
      return resolvePlayerCard(card.refId, card.specialId);
    case "coach":
      return resolveCoach(card.refId);
    case "sub":
      return resolveSub(card.refId);
    case "org":
      return resolveOrg(card.refId);
  }
}

export function resolvePick(pick: RosterPick): ResolvedCard {
  switch (pick.kind) {
    case "player":
      return resolvePlayerCard(pick.refId, pick.specialId);
    case "coach":
      return resolveCoach(pick.refId);
    case "sub":
      return resolveSub(pick.refId);
    case "org":
      return resolveOrg(pick.refId);
  }
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
