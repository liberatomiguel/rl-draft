/**
 * Team assembly — converts a user roster or a historical lineup into a
 * TournamentTeam (rating + chemistry + situational stats + special effects).
 * Shared by the user side and the AI opponent generator so both follow the
 * exact same rules.
 */

import { BUFF_LEVEL_VALUE, DIFFICULTY, TEAM_RATING } from "@/config/balance";
import {
  careerByPlayerId,
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
  RunMode,
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
  country?: string;
  region?: string;
  /** Career history (all lineups/orgs this player was ever on) for chemistry. */
  careerLineupIds?: string[];
  careerOrgIds?: string[];
}

interface AssembleInput {
  id: string;
  name: string;
  isUser: boolean;
  region: Region;
  lineupId?: string;
  players: MemberView[];
  coach?: { name: string; overall: number; bonusType: StatKey; bonusLevel: string; lineupId: string; orgId: string; country?: string; region?: string };
  sub?: { name: string; overall: number; lineupId: string; orgId: string; country?: string; region?: string };
  orgId?: string;
  /** Era-accurate org buff (lineup override). Falls back to the org default. */
  orgBuffLevel?: string;
  /** Team-wide stat boosts from coach special cards. */
  teamBoosts?: { attributes: StatKey[]; value: number }[];
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
  const orgBuffLevel = (input.orgBuffLevel ?? org?.buffLevel) as
    | keyof typeof BUFF_LEVEL_VALUE
    | undefined;

  const chemistryInput: ChemistryInput = {
    players: input.players.map((p) => ({
      name: p.name,
      lineupId: p.lineupId,
      orgId: p.orgId,
      country: p.country,
      region: p.region,
      careerLineupIds: p.careerLineupIds,
      careerOrgIds: p.careerOrgIds,
    })),
    coach: input.coach
      ? {
          name: input.coach.name,
          lineupId: input.coach.lineupId,
          orgId: input.coach.orgId,
          country: input.coach.country,
          region: input.coach.region,
        }
      : undefined,
    sub: input.sub
      ? {
          name: input.sub.name,
          lineupId: input.sub.lineupId,
          orgId: input.sub.orgId,
          country: input.sub.country,
          region: input.sub.region,
        }
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
    orgBuffLevel: orgBuffLevel as never,
    chemistryPercent: chemistry.percent,
    // Chemistry is the PLAYER's edge: opponents use their own (Hard/Legacy = 0)
    // cap so a coherent draft can out-chemistry a higher-overall AI lineup.
    chemistryMaxBonus: input.isUser
      ? DIFFICULTY[input.difficulty].chemistryMaxBonus
      : DIFFICULTY[input.difficulty].opponentChemistryMaxBonus,
    specialCount: input.specialIds.length,
    // Direct team-overall bonuses from special effects (Creator card). Summed
    // here so both the user and AI paths honour it (AI never holds such a card).
    specialOverallBonus: input.specialIds.reduce(
      (sum, id) => sum + (specialCardById.get(id)?.effect.overallBonus ?? 0),
      0,
    ),
    difficultyShift: input.difficultyShift,
  });

  // Situational stats: player average + thematic nudges from org buff,
  // coach bonus and sub depth. Small by design — overall dominates.
  const stats = averageStats(input.players);
  if (org && orgBuffLevel) {
    stats[org.buffType] = clamp(stats[org.buffType] + BUFF_LEVEL_VALUE[orgBuffLevel] * 1.0, 60, 99);
  }
  if (input.coach) {
    const level = BUFF_LEVEL_VALUE[input.coach.bonusLevel as never] ?? 0;
    stats[input.coach.bonusType] = clamp(stats[input.coach.bonusType] + level * 1.5, 60, 99);
  }
  if (input.sub) {
    // Squad depth scales with the sub's overall (v1.3.3): a strong/special sub is
    // a real bench, a token one barely registers.
    const d = TEAM_RATING.sub;
    const depth = clamp(
      1 + (input.sub.overall - d.depthBaseline) * d.depthScale,
      d.depthMin,
      d.depthMax,
    );
    stats.consistency = clamp(stats.consistency + depth, 60, 99);
    stats.experience = clamp(stats.experience + depth, 60, 99);
  }
  // Coach special cards: direct team attribute boosts (v3 effect model).
  for (const boost of input.teamBoosts ?? []) {
    for (const attr of boost.attributes) {
      stats[attr] = clamp(stats[attr] + boost.value, 60, 99);
    }
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
  // The special's own historical moment drives chemistry context (v0.5):
  // a 2022 card rolled as an S1 legend counts as the S1 lineup/org.
  const ctx = (special && playerCardById.get(special.baseCardId)) || card;
  const overall = special ? special.overall : finalOverall(card);
  const stats = special
    ? effectiveStats(special.overall, special.stats)
    : effectiveStats(finalOverall(card), card.stats);
  // v3 effect model: direct attribute boosts baked into the member's stats.
  if (special?.effect.type === "attribute_boost") {
    for (const attr of special.effect.attributes ?? []) {
      stats[attr] = clamp(stats[attr] + special.effect.value, 60, 99);
    }
  }
  const career = careerByPlayerId.get(card.playerId);
  return {
    name: player.nickname,
    overall,
    stats,
    lineupId: ctx.lineupId,
    orgId: ctx.orgId,
    country: player.country,
    region: player.region,
    careerLineupIds: career ? [...career.lineupIds] : undefined,
    careerOrgIds: career ? [...career.orgIds] : undefined,
  };
}

export function buildUserTeam(
  roster: Roster,
  difficulty: Difficulty,
  options: { mode?: RunMode; teamName?: string } = {},
): TournamentTeam {
  // "challenge" assembles a full 6-slot roster like classic; only "quick" is 3.
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
  const coachSpecial = roster.coach?.specialId
    ? specialCardById.get(roster.coach.specialId)
    : undefined;
  // Coach specials use their own moment's lineup/org for chemistry (v0.5).
  const coachCtx =
    (coachSpecial && coachById.get(coachSpecial.baseCardId)) || coachCard;
  const coach = coachCard
    ? {
        name: coachCard.name,
        overall: coachSpecial ? coachSpecial.overall : coachCard.overall,
        bonusType: coachCard.bonusType,
        bonusLevel: coachCard.bonusLevel,
        lineupId: (coachCtx ?? coachCard).lineupId,
        orgId: (coachCtx ?? coachCard).orgId,
        country: coachCard.country,
        region: coachCard.region,
      }
    : undefined;
  // Team-wide stat boosts: from a coach special AND from any player special
  // that carries one (e.g. the Creator card's light all-team buff, v1.2.0).
  const teamBoosts: { attributes: StatKey[]; value: number }[] = [];
  if (coachSpecial?.effect.type === "team_attribute_boost") {
    teamBoosts.push({
      attributes: coachSpecial.effect.attributes ?? [],
      value: coachSpecial.effect.value,
    });
  }
  for (const pick of playerPicks) {
    const sp = pick?.specialId ? specialCardById.get(pick.specialId) : undefined;
    if (sp?.effect.type === "team_attribute_boost") {
      teamBoosts.push({ attributes: sp.effect.attributes ?? [], value: sp.effect.value });
    }
  }

  const subCard =
    roster.sub && roster.sub.refId !== "vacant-sub"
      ? subById.get(roster.sub.refId)
      : undefined;
  // v1.3.3: subs can carry a special too (specials belong to the person). The
  // special's overall replaces the sub's, and its own moment drives chemistry.
  const subSpecial = roster.sub?.specialId
    ? specialCardById.get(roster.sub.specialId)
    : undefined;
  const subCtx = subSpecial ? playerCardById.get(subSpecial.baseCardId) : undefined;
  const sub: AssembleInput["sub"] = subCard
    ? {
        name: subCard.name,
        overall: subSpecial ? subSpecial.overall : subCard.overall,
        lineupId: (subCtx ?? subCard).lineupId,
        orgId: (subCtx ?? subCard).orgId,
        country: subCard.country,
        region: subCard.region,
      }
    : undefined;
  if (subSpecial?.effect.type === "team_attribute_boost") {
    teamBoosts.push({
      attributes: subSpecial.effect.attributes ?? [],
      value: subSpecial.effect.value,
    });
  }

  const specialIds = [
    roster.player1,
    roster.player2,
    roster.player3,
    roster.coach,
    roster.sub,
  ]
    .map((p) => p?.specialId)
    .filter((id): id is string => Boolean(id));

  // Region for display: majority region among the three players.
  const regions = playerPicks.map(
    (pick) => playerById.get(playerCardById.get(pick!.refId)!.playerId)!.region,
  );
  const region = [...regions].sort(
    (a, b) => regions.filter((r) => r === b).length - regions.filter((r) => r === a).length,
  )[0];

  // Era-accurate org buff: the org was drafted FROM a specific lineup.
  const orgBuffLevel = roster.org
    ? lineupById.get(roster.org.fromLineupId)?.orgBuffLevel
    : undefined;

  return assembleTeam({
    id: "user",
    name: options.teamName ?? "Your Team",
    isUser: true,
    region,
    players,
    coach,
    sub,
    orgId: roster.org?.refId,
    orgBuffLevel,
    teamBoosts,
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
  options?: { specialUpgrade?: { cardId: string; specialId: string }; extraShift?: number },
): TournamentTeam {
  const lineup = lineupById.get(lineupId);
  if (!lineup) throw new Error(`Unknown lineup "${lineupId}"`);
  const season = seasonById.get(lineup.seasonId);

  const specialIds: string[] = [];
  const players = lineup.playerCardIds.map((cardId) => {
    if (options?.specialUpgrade?.cardId === cardId) {
      specialIds.push(options.specialUpgrade.specialId);
      return playerMemberFromPick(cardId, options.specialUpgrade.specialId);
    }
    return playerMemberFromPick(cardId);
  });

  const coachCard = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
  const subCard = lineup.subId ? subById.get(lineup.subId) : undefined;

  // Player specials may carry a team-wide boost (e.g. the Creator card).
  const teamBoosts: { attributes: StatKey[]; value: number }[] = [];
  for (const spId of specialIds) {
    const sp = specialCardById.get(spId);
    if (sp?.effect.type === "team_attribute_boost") {
      teamBoosts.push({ attributes: sp.effect.attributes ?? [], value: sp.effect.value });
    }
  }

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
          country: coachCard.country,
          region: coachCard.region,
        }
      : undefined,
    sub: subCard
      ? {
          name: subCard.name,
          overall: subCard.overall,
          lineupId: subCard.lineupId,
          orgId: subCard.orgId,
          country: subCard.country,
          region: subCard.region,
        }
      : undefined,
    orgId: lineup.orgId,
    orgBuffLevel: lineup.orgBuffLevel,
    teamBoosts,
    specialIds,
    difficulty,
    // Region-locked runs add a flat boost so a weaker regional field plays as
    // hard as the worldwide one (v1.3.1).
    difficultyShift: DIFFICULTY[difficulty].opponentRatingShift + (options?.extraShift ?? 0),
  });
}
