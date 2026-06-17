/**
 * Tournament opponent generation (base doc §26).
 *
 * Difficulty shapes the opponent pool via historical-strength weights and the
 * chance of special-card upgrades. It NEVER affects the user's draft pool.
 */

import { DIFFICULTY, SPECIALS } from "@/config/balance";
import { draftableLineups, lineups, playerCardById, specialsByPlayerId } from "@/data";
import type { Rng } from "@/lib/rng";
import { buildLineupTeam } from "./teams";
import type { Difficulty, TournamentTeam } from "./types";

export function generateOpponents(
  difficulty: Difficulty,
  rng: Rng,
  count: number,
  poolLineupIds?: string[],
): TournamentTeam[] {
  const profile = DIFFICULTY[difficulty];
  // Easter-egg lineups (Wings) are draft-only treasures — never AI opponents.
  const pool = (
    poolLineupIds ? lineups.filter((l) => poolLineupIds.includes(l.id)) : [...draftableLineups]
  ).filter((l) => !l.rareSpawn);
  const picked: typeof pool = [];

  while (picked.length < count && pool.length > 0) {
    const lineup = rng.weightedPick(
      pool,
      (l) => profile.opponentTierWeights[l.historicalStrength] ?? 0.5,
    );
    picked.push(lineup);
    pool.splice(pool.indexOf(lineup), 1);
  }

  return picked.map((lineup) => {
    let specialUpgrade: { cardId: string; specialId: string } | undefined;
    if (rng.chance(profile.opponentSpecialChance)) {
      // v0.5: specials belong to the player — any of their cards can upgrade.
      const upgradable = lineup.playerCardIds.filter(
        (id) =>
          (specialsByPlayerId.get(playerCardById.get(id)!.playerId)?.length ?? 0) > 0,
      );
      if (upgradable.length > 0) {
        const cardId = rng.pick(upgradable);
        const pool = specialsByPlayerId.get(playerCardById.get(cardId)!.playerId)!;
        const specialId = rng.weightedPick(
          pool,
          (sp) => SPECIALS.rarityWeights[sp.rarity] ?? 1,
        ).id;
        specialUpgrade = { cardId, specialId };
      }
    }
    return buildLineupTeam(lineup.id, difficulty, { specialUpgrade });
  });
}
