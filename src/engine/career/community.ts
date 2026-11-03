import { assembleTournamentTeam, type MemberView } from "@/engine/teams";
import type { TournamentTeam } from "@/engine/types";
import type { CareerDifficulty, CareerEventDef, CareerSave } from "./types";
import { careerMatchProfile } from "./difficulty";

export function communityParticipantsFor(save: CareerSave, def: CareerEventDef): string[] {
  const size = def.teamSize ?? 3;
  const chosen = def.participantIds ?? save.starterIds;
  const available = new Set(save.squad.map(p => p.id));
  const ids = [...new Set([...chosen, ...save.squad.map(p => p.id)])].filter(id => available.has(id));
  return ids.slice(0, size);
}

/** Side events are decided by the selected players' own ratings and attributes. */
export function communityTeamFor(
  base: Pick<TournamentTeam, "id" | "name" | "region" | "isUser">,
  members: MemberView[],
  difficulty: CareerDifficulty,
): TournamentTeam {
  const profile = careerMatchProfile(difficulty);
  return assembleTournamentTeam({
    ...base,
    name: members.length === 1 ? `${members[0].name} · ${base.name}` : base.name,
    players: members,
    specialIds: [],
    difficulty,
    difficultyShift: base.isUser ? 0 : profile.opponentRatingShift,
    chemistryMaxBonus: 0,
    rollRange: base.isUser ? profile.userRollRange : profile.aiRollRange,
  });
}
