/**
 * Road to Worlds — does a scripted beat hold in this save? (rc.36, ROADMAP
 * UX-03, R87). Pure.
 *
 * A historical beat never claims what the save contradicts. Its `check`
 * (data/career/beats.ts) names the state it needs — the org in the world and
 * near the top of its region, the player still playing (or not signed yet),
 * a region's run at a Major this season. When the check holds the beat runs
 * live (its effect included); when it does not, or for an `archiveOnly` beat
 * (real history this timeline does not replay), it files "From the archive":
 * the real event, labelled, and no effect.
 */

import type { CareerBeat } from "@/data/career/beats";
import type { Placement } from "../types";
import { playerViewById } from "./development";
import type { CompactEventResult, WorldState } from "./types";

export type BeatMode = "live" | "archive";

export interface BeatContext {
  world: WorldState;
  careerSeed: number;
  seasonIndex: number;
  /** The user's squad (a player there is still playing — the beat's own preempt rules decide the rest). */
  squadIds: readonly string[];
  /** This season's results (a Major run). */
  results: readonly CompactEventResult[];
  /** The user org's region (its own Major run counts for its region). */
  userRegion?: string;
}

const PLACE: Record<Placement, number> = {
  champion: 1,
  runner_up: 2,
  third: 3,
  fourth: 4,
  top4: 4,
  top6: 6,
  top8: 8,
  swiss_exit: 16,
};

/** An org's rank in its region by rating (1 = the best). */
function regionRankOf(world: WorldState, ref: string): number {
  const org = world.orgs[ref];
  if (!org) return Infinity;
  const mine = org.rating ?? 0;
  return 1 + Object.values(world.orgs).filter((o) => o.region === org.region && (o.rating ?? 0) > mine).length;
}

/** Live (the save holds the beat's claim) or archive (it does not, or it is real history only). */
export function beatModeFor(beat: Pick<CareerBeat, "check" | "archiveOnly">, ctx: BeatContext): BeatMode {
  if (beat.archiveOnly) return "archive";
  const c = beat.check;
  if (!c) return "live";
  const { world } = ctx;
  for (const ref of c.orgs ?? []) {
    if (!world.orgs[ref]) return "archive";
    if (c.top !== undefined && regionRankOf(world, ref) > c.top) return "archive";
  }
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world };
  for (const id of c.players ?? []) {
    if (!ctx.squadIds.includes(id) && playerViewById(id, view) === null) return "archive";
  }
  for (const id of c.unsigned ?? []) {
    if (world.retiredIds.includes(id) || ctx.squadIds.includes(id)) return "archive";
    if (Object.values(world.orgs).some((o) => o.playerIds.includes(id))) return "archive";
  }
  if (c.majorRun) {
    const { regions, place } = c.majorRun;
    const ran = ctx.results.some(
      (r) =>
        r.seasonIndex === ctx.seasonIndex &&
        r.tier === "major" &&
        r.rows.some((row) => {
          const region = row.ref === "user" ? ctx.userRegion : world.orgs[row.ref]?.region;
          return region !== undefined && regions.includes(region) && PLACE[row.placement] <= place;
        }),
    );
    if (!ran) return "archive";
  }
  return "live";
}
