/**
 * rc9 duel-ui: a drafted duel team (ids only, as the link carries it) turned
 * into what the screens draw: the game's resolved cards, the org mark and the
 * team overall. Reads the dataset, so only the lazy duel chunk imports it.
 */

import { lineupById } from "@/data";
import { resolvePick, type ResolvedCard } from "@/engine/cards";
import { buildDuelTeam } from "@/engine/duelMatch";
import type { DuelCard, DuelMode, DuelTeamCards } from "@/engine/duelRules";
import { displayTeamOverall } from "@/engine/rating";
import type { RosterPick } from "@/engine/types";

export interface DuelTeamView {
  players: ResolvedCard[];
  coach: ResolvedCard | null;
  sub: ResolvedCard | null;
  org: ResolvedCard | null;
  /** The drafted org's mark (Classic), or null (Quick: the side shows a monogram). */
  mark: { orgId: string; seasonId?: string } | null;
  overall: number;
}

const pick = (kind: RosterPick["kind"], c: DuelCard, fromLineupId = ""): RosterPick => ({
  slot: kind === "player" ? "player1" : kind,
  kind,
  refId: c.id,
  specialId: c.sp,
  fromLineupId,
});

/** The cards and figures of a team. Throws on a card the dataset lacks (check `isKnownDuelTeam` first). */
export function duelTeamView(team: DuelTeamCards, mode: DuelMode): DuelTeamView {
  const lineup = team.orgLineup ? lineupById.get(team.orgLineup) : undefined;
  const built = buildDuelTeam(team, mode, "duel-view");
  return {
    players: team.players.map((p) => resolvePick(pick("player", p))),
    coach: team.coach ? resolvePick(pick("coach", team.coach)) : null,
    sub: team.sub ? resolvePick(pick("sub", team.sub)) : null,
    org: lineup ? resolvePick({ slot: "org", kind: "org", refId: lineup.orgId, fromLineupId: lineup.id }) : null,
    mark: lineup ? { orgId: lineup.orgId, seasonId: lineup.seasonId } : null,
    overall: displayTeamOverall(built.rating),
  };
}
