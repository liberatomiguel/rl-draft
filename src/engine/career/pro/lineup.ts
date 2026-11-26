/**
 * v2.2 Pro spine (PROSPINE, slice 4, PRO-SPEC §7.4): the starting spot and
 * the coach's trust.
 *
 * Each split (and at signing) the coach picks the org's three best by a
 * lineup score: a world player's overall; the Pro's overall plus his recent
 * form and the coach's trust in him. Trust (0-100) rises with good ratings
 * and with honest weeks on the bench, falls with bad ratings and with a
 * transfer request. The bench is always recoverable: training lifts his
 * overall and the bench weeks lift trust, and both feed the next split.
 */

import { CAREER_PRO_ORG } from "@/config/balance";
import { clamp } from "@/lib/util";
import { playerViewById } from "../development";
import type { WorldOrgState, WorldState } from "../types";
import { proOverall, round2 } from "./attrs";
import type { ProMatchLogEntry } from "./spineTypes";
import type { ProPlayer } from "./types";
import { recentFormOf } from "./offers";
import { PRO_SELF_ID } from "./world";

export function proLineupScore(player: ProPlayer, log: readonly ProMatchLogEntry[] | undefined, trust: number): number {
  const O = CAREER_PRO_ORG;
  const form = recentFormOf(log, 8);
  return round2(proOverall(player.attrs) + O.formLineup * ((form.avg ?? 6) - 6) + (O.trustLineup * (trust - 50)) / 50);
}

/** Trust after one series he played (rating 0-10). */
export function trustAfterSeries(trust: number, rating: number): number {
  const O = CAREER_PRO_ORG;
  const delta = rating >= O.goodRating ? O.trustGood : rating <= O.badRating ? -O.trustBad : 0;
  return clamp(trust + delta, 0, 100);
}

/**
 * The coach's lineup for the Pro's org: its three best by the lineup score
 * start, the rest sit on the bench. Returns the same world when nothing
 * changes, and whether the Pro starts.
 */
export function decideOrgLineup(
  world: WorldState,
  orgRef: string,
  proScore: number,
  ctx: { careerSeed: number; seasonIndex: number },
): { world: WorldState; starts: boolean; changed: boolean } {
  const org = world.orgs[orgRef];
  if (!org) return { world, starts: false, changed: false };
  const all = [...org.playerIds, ...(org.reserveIds ?? [])];
  if (!all.includes(PRO_SELF_ID)) return { world, starts: false, changed: false };
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world };
  const score = (id: string) => (id === PRO_SELF_ID ? proScore : (playerViewById(id, view)?.overall ?? 0));
  // Ties keep the current starters (stable order: starters first).
  const ranked = [...all].sort((a, b) => score(b) - score(a) || all.indexOf(a) - all.indexOf(b));
  const starters = new Set(ranked.slice(0, 3));
  const starts = starters.has(PRO_SELF_ID);
  if (org.playerIds.every((id) => starters.has(id))) return { world, starts, changed: false };
  // Keep each staying starter in his seat; the newcomers take the freed seats.
  const seats = [...org.playerIds] as [string, string, string];
  const incoming = ranked.slice(0, 3).filter((id) => !seats.includes(id));
  const bench: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (!starters.has(seats[i])) {
      bench.push(seats[i]);
      seats[i] = incoming.shift()!;
    }
  }
  const reserves = [...(org.reserveIds ?? []).filter((id) => !starters.has(id)), ...bench];
  const nextOrg: WorldOrgState = { ...org, playerIds: seats, reserveIds: reserves };
  return {
    world: { ...world, orgs: { ...world.orgs, [orgRef]: nextOrg }, version: world.version + 1 },
    starts,
    changed: true,
  };
}
