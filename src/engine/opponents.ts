/**
 * Tournament opponent generation (base doc §26).
 *
 * Difficulty shapes the opponent pool via historical-strength weights and the
 * chance of special-card upgrades. It NEVER affects the user's draft pool.
 */

import { DIFFICULTY } from "@/config/balance";
import { lineups, specialByBaseCardId } from "@/data";
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
  const pool = poolLineupIds
    ? lineups.filter((l) => poolLineupIds.includes(l.id))
    : [...lineups];
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
    let specialUpgradeCardId: string | undefined;
    if (rng.chance(profile.opponentSpecialChance)) {
      const upgradable = lineup.playerCardIds.filter((id) => specialByBaseCardId.has(id));
      if (upgradable.length > 0) {
        specialUpgradeCardId = rng.pick(upgradable);
      }
    }
    return buildLineupTeam(lineup.id, difficulty, { specialUpgradeCardId });
  });
}
