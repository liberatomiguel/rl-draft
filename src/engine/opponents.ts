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
  extraShift = 0,
): TournamentTeam[] {
  const profile = DIFFICULTY[difficulty];
  // Easter-egg lineups (Wings) are draft-only treasures — never AI opponents.
  const base = (
    poolLineupIds ? lineups.filter((l) => poolLineupIds.includes(l.id)) : [...draftableLineups]
  ).filter((l) => !l.rareSpawn);
  const weight = (l: (typeof base)[number]) =>
    profile.opponentTierWeights[l.historicalStrength] ?? 0.5;
  const picked: typeof base = [];

  // v1.3: ONE lineup per org. A tournament field is a bracket of distinct teams —
  // facing "FURIA 24" and "FURIA 25" in the same Swiss broke the fiction and
  // stacked the very strongest orgs against the player (the legacy/SAM "FURIA
  // wall"). Primary pass draws org-unique; same weighting, just no repeats.
  const usedOrgs = new Set<string>();
  let pool = [...base];
  while (picked.length < count && pool.length > 0) {
    const lineup = rng.weightedPick(pool, weight);
    picked.push(lineup);
    usedOrgs.add(lineup.orgId);
    pool = pool.filter((l) => l.orgId !== lineup.orgId);
  }
  // Fallback (tiny regional pools only): if there weren't enough distinct orgs to
  // fill the field, top up allowing repeat orgs — but never the same lineup twice.
  if (picked.length < count) {
    let rest = base.filter((l) => !picked.includes(l));
    while (picked.length < count && rest.length > 0) {
      const lineup = rng.weightedPick(rest, weight);
      picked.push(lineup);
      rest = rest.filter((l) => l !== lineup);
    }
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
        // Weight the AI's special pick by the same per-rarity rates as the player
        // draft (v1.4) — rares are common, legendaries are the rare flex.
        const specialId = rng.weightedPick(
          pool,
          (sp) => SPECIALS.rarityChance[sp.rarity] ?? 0.01,
        ).id;
        specialUpgrade = { cardId, specialId };
      }
    }
    return buildLineupTeam(lineup.id, difficulty, { specialUpgrade, extraShift });
  });
}
