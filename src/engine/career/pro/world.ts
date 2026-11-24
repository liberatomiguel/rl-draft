/**
 * v2.2 Pro (PRO-SPEC §10, R148): the Pro as a player of the shared world.
 *
 * The save owns the player; the world holds a derived snapshot under
 * `world.proSelf`, which `development.playerViewById("pro:self")` reads, so a
 * team assembled with him (slices 3–4) sees his attributes as any other
 * player's. Call `withProInWorld` after every change to the player.
 *
 * The snapshot's `potential` is his current overall: the world has no idea
 * of his ceiling (there is none, P7), and nothing in the world scouts him.
 */

import { PRO_SELF_ID } from "../development";
import type { FormerSquadPlayer } from "../types";
import { PRO_STAT_KEYS, proOverall, round2 } from "./attrs";
import type { ProPlayer, ProSave } from "./types";

export { PRO_SELF_ID };

export function proWorldEntryOf(player: ProPlayer): FormerSquadPlayer {
  const overall = proOverall(player.attrs);
  const attrOffsets = {} as FormerSquadPlayer["attrOffsets"];
  for (const k of PRO_STAT_KEYS) attrOffsets[k] = round2(player.attrs[k] - overall);
  return {
    name: player.name,
    country: player.country,
    region: player.region,
    birthYear: player.birthYear,
    archetype: player.archetype,
    overall,
    attrOffsets,
    potential: overall,
    peakAge: player.peakAge,
    declineRate: player.declineRate,
  };
}

/** The save with the world's snapshot of the player brought up to date (a new save; the input is untouched). */
export function withProInWorld(save: ProSave): ProSave {
  return { ...save, world: { ...save.world, proSelf: proWorldEntryOf(save.player) } };
}
