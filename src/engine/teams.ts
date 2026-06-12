/**
 * Team assembly — converts a user roster or a historical lineup into a
 * TournamentTeam (rating + chemistry + situational stats + special effects).
 * Shared by the user side and the AI opponent generator so both follow the
 * exact same rules.
 */

import { BUFF_LEVEL_VALUE, DIFFICULTY } from "@/config/balance";
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
import { effectiveStats, finalOverall } from "./cards";
import { computeChemistry, type ChemistryInput } from "./chemistry";
import { computeTeamRating } from "./rating";
import type {
  Difficulty,
  Region,
  Roster,
  Stats,
  StatKey,
  TournamentTeam,
} from "./types";

interface MemberView {
  name: string;
  overall: number;
  stats: Stats;
  lineupId: string;
  orgId: string;
  country: string;
}

interface AssembleInput {
  id: string;
  name: string;
  isUser: boolean;
  region: Region;
  lineupId?: string;
  players: MemberView[];
  coach?: { name: string; overall: number; bonusType: StatKey; bonusLevel: string; lineupId: string; orgId: string };
  sub?: { name: string; overall: number; lineupId: string; orgId: string };
  orgId?: string;
  specialIds: string[];
  difficulty: Difficulty;
  difficultyShift: number;
}

function averageStats(players: MemberView[]): Stats {
  const keys: StatKey[] = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];
  const out = {} as Stats;
  for (const key of keys) {
    out[key] =
      players.reduce((sum, p) => sum + p.stats[key], 0) / Math.max(1, players.length);
  }
  return out;
}

function assembleTeam(input: AssembleInput): TournamentTeam {
  const org = input.orgId ? orgById.get(input.orgId) : undefined;

  const chemistryInput: ChemistryInput = {
    players: input.players.map((p) => ({
      name: p.name,
      lineupId: p.lineupId,
      orgId: p.orgId,
      country: p.country,
    })),
    coach: input.coach
      ? { name: input.coach.name, lineupId: input.coach.lineupId, orgId: input.coach.orgId }
      : undefined,
    sub: input.sub
      ? { name: input.sub.name, lineupId: input.sub.lineupId, orgId: input.sub.orgId }
      : undefined,
    orgId: input.orgId,
    orgName: org?.name,
  };
  const chemistry = computeChemistry(chemistryInput);

  const rating = computeTeamRating({
    playerOveralls: input.players.map((p) => p.overall),
    coach: input.coach
      ? { overall: input.coach.overall, bonusLevel: input.coach.bonusLevel as never }
      : undefined,
    sub: input.sub ? { overall: input.sub.overall } : undefined,
    orgBuffLevel: org?.buffLevel,
    chemistryPercent: chemistry.percent,
    chemistryMaxBonus: DIFFICULTY[input.difficulty].chemistryMaxBonus,
    specialCount: input.specialIds.length,
    difficultyShift: input.difficultyShift,
  });

  // Situational stats: player average + thematic nudges from org buff,
  // coach bonus and sub depth. Small by design — overall dominates.
  const stats = averageStats(input.players);
  if (org) {
    stats[org.buffType] = clamp(stats[org.buffType] + BUFF_LEVEL_VALUE[org.buffLevel] * 1.0, 60, 99);
  }
  if (input.coach) {
    const level = BUFF_LEVEL_VALUE[input.coach.bonusLevel as never] ?? 0;
    stats[input.coach.bonusType] = clamp(stats[input.coach.bonusType] + level * 1.5, 60, 99);
  }
  if (input.sub) {
    stats.consistency = clamp(stats.consistency + 1, 60, 99);
    stats.experience = clamp(stats.experience + 1, 60, 99);
  }

  return {
    id: input.id,
    name: input.name,
    isUser: input.isUser,
    region: input.region,
    lineupId: input.lineupId,
    rating,
    chemistry,
    stats,
    specialIds: input.specialIds,
    playerNames: input.players.map((p) => p.name),
    orgId: input.orgId ?? "",
  };
}

// ---------------------------------------------------------------------------
// User team from a completed draft roster
// ---------------------------------------------------------------------------

function playerMemberFromPick(refId: string, specialId?: string): MemberView {
  const card = playerCardById.get(refId)!;
  const player = playerById.get(card.playerId)!;
  const special = specialId ? specialCardById.get(specialId) : undefined;
  const overall = special ? special.overall : finalOverall(card);
  const stats = special
    ? effectiveStats(special.overall, special.stats)
    : effectiveStats(finalOverall(card), card.stats);
  return {
    name: player.nickname,
    overall,
    stats,
    lineupId: card.lineupId,
    orgId: card.orgId,
    country: player.country,
  };
}

export function buildUserTeam(
  roster: Roster,
  difficulty: Difficulty,
  options: { mode?: "classic" | "quick" | "daily"; teamName?: string } = {},
): TournamentTeam {
  const mode = options.mode ?? "classic";
  const playerPicks = [roster.player1, roster.player2, roster.player3].filter(Boolean);
  if (playerPicks.length !== 3) {
    throw new Error("Roster incomplete — cannot build team");
  }
  if (mode !== "quick" && (!roster.coach || !roster.sub || !roster.org)) {
    throw new Error("Roster incomplete — cannot build team");
  }

  const players = playerPicks.map((p) => playerMemberFromPick(p!.refId, p!.specialId));

  // Vacant picks ("No Coach"/"No Sub") and quick mode contribute nothing.
  const coachCard =
    roster.coach && roster.coach.refId !== "vacant-coach"
      ? coachById.get(roster.coach.refId)
      : undefined;
  const coach = coachCard
    ? {
        name: coachCard.name,
        overall: coachCard.overall,
        bonusType: coachCard.bonusType,
        bonusLevel: coachCard.bonusLevel,
        lineupId: coachCard.lineupId,
        orgId: coachCard.orgId,
      }
    : undefined;

  const subCard =
    roster.sub && roster.sub.refId !== "vacant-sub"
      ? subById.get(roster.sub.refId)
      : undefined;
  const sub: AssembleInput["sub"] = subCard
    ? {
        name: subCard.name,
        overall: subCard.overall,
        lineupId: subCard.lineupId,
        orgId: subCard.orgId,
      }
    : undefined;

  const specialIds = [roster.player1, roster.player2, roster.player3]
    .map((p) => p?.specialId)
    .filter((id): id is string => Boolean(id));

  // Region for display: majority region among the three players.
  const regions = playerPicks.map(
    (pick) => playerById.get(playerCardById.get(pick!.refId)!.playerId)!.region,
  );
  const region = [...regions].sort(
    (a, b) => regions.filter((r) => r === b).length - regions.filter((r) => r === a).length,
  )[0];

  return assembleTeam({
    id: "user",
    name: options.teamName ?? "Your Team",
    isUser: true,
    region,
    players,
    coach,
    sub,
    orgId: roster.org?.refId,
    specialIds,
    difficulty,
    difficultyShift: 0,
  });
}

// ---------------------------------------------------------------------------
// AI team from a historical lineup
// ---------------------------------------------------------------------------

export function buildLineupTeam(
  lineupId: string,
  difficulty: Difficulty,
  options?: { specialUpgradeCardId?: string },
): TournamentTeam {
  const lineup = lineupById.get(lineupId);
  if (!lineup) throw new Error(`Unknown lineup "${lineupId}"`);
  const season = seasonById.get(lineup.seasonId);

  const specialIds: string[] = [];
  const players = lineup.playerCardIds.map((cardId) => {
    const card = playerCardById.get(cardId)!;
    const player = playerById.get(card.playerId)!;
    let overall = finalOverall(card);
    let stats = effectiveStats(overall, card.stats);
    if (options?.specialUpgradeCardId === cardId) {
      const special = specialCardById.get(
        // upgrade target is validated by the caller (opponents.ts)
        [...specialCardById.values()].find((sp) => sp.baseCardId === cardId)!.id,
      )!;
      specialIds.push(special.id);
      overall = special.overall;
      stats = effectiveStats(special.overall, special.stats);
    }
    return {
      name: player.nickname,
      overall,
      stats,
      lineupId: card.lineupId,
      orgId: card.orgId,
      country: player.country,
    };
  });

  const coachCard = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
  const subCard = lineup.subId ? subById.get(lineup.subId) : undefined;

  return assembleTeam({
    id: `opp-${lineup.id}`,
    name: `${lineup.name} ${season?.shortLabel ?? ""}`.trim(),
    isUser: false,
    region: lineup.region,
    lineupId: lineup.id,
    players,
    coach: coachCard
      ? {
          name: coachCard.name,
          overall: coachCard.overall,
          bonusType: coachCard.bonusType,
          bonusLevel: coachCard.bonusLevel,
          lineupId: coachCard.lineupId,
          orgId: coachCard.orgId,
        }
      : undefined,
    sub: subCard
      ? { name: subCard.name, overall: subCard.overall, lineupId: subCard.lineupId, orgId: subCard.orgId }
      : undefined,
    orgId: lineup.orgId,
    specialIds,
    difficulty,
    difficultyShift: DIFFICULTY[difficulty].opponentRatingShift,
  });
}
