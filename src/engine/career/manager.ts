/**
 * v2.2 board front — the manager's own reputation (separate from the club's)
 * and the job offers it earns (FEATURES.board). Pure.
 *
 * A dismissal never ends the save: the manager gets
 * CAREER_BOARD.manager.offersAfterDismissal offers scaled by his reputation
 * (always one real option in his home region at a stature he can reach) plus
 * "found a new club". Strong seasons bring an unsolicited off-season approach
 * from a bigger org. Accepting is the same seat swap as a takeover.
 */

import { CAREER_BOARD } from "@/config/balance";
import type { Region } from "../types";
import { derivedFloat, streams } from "./seeds";
import { regionOrgsByRating, statureFor } from "./orgProfile";
import type { JobOffer, ManagerState, Stature } from "./boardTypes";
import type { WorldState } from "./types";

const M = CAREER_BOARD.manager;
const STATURE_RANK: Record<Stature | "owners", number> = { elite: 0, contender: 1, mid: 2, underdog: 3, owners: 4 };

export function newManagerState(seasonIndex: number, orgName: string, ref?: string): ManagerState {
  return {
    reputation: M.start,
    contractUntil: seasonIndex + CAREER_BOARD.contract.startSeasons - 1,
    spells: [{ orgName, ...(ref ? { ref } : {}), fromSeason: seasonIndex }],
    offers: null,
    accepted: null,
  };
}

export function bumpManagerRep(m: ManagerState, delta: number): void {
  m.reputation = Math.min(100, Math.max(0, Math.round(m.reputation + delta)));
}

/** The best stature a manager's reputation reaches. */
export function reachOf(rep: number): Stature {
  if (rep >= M.offerReach.elite) return "elite";
  if (rep >= M.offerReach.contender) return "contender";
  if (rep >= M.offerReach.mid) return "mid";
  return "underdog";
}

interface Candidate {
  ref: string;
  name: string;
  region: Region;
  stature: Stature;
  rank: number;
  rating: number;
  f: number;
}

function candidatesOf(world: WorldState, regions: readonly Region[], exclude: ReadonlySet<string>, seed: number, key: string): Candidate[] {
  const out: Candidate[] = [];
  for (const region of regions) {
    regionOrgsByRating(world, region).forEach((o, i) => {
      if (o.ref.includes(":") || exclude.has(o.ref)) return;
      out.push({
        ref: o.ref,
        name: o.name,
        region,
        stature: statureFor(i + 1, o.prestige),
        rank: i + 1,
        rating: Math.round((o.rating ?? 70) * 10) / 10,
        f: derivedFloat(seed, streams.gen("jobOffer", `${key}:${o.ref}`)),
      });
    });
  }
  return out;
}

const toOffer = (c: Candidate, reason: JobOffer["reason"], key: string): JobOffer => ({
  id: `job:${key}:${c.ref}`,
  kind: "org",
  ref: c.ref,
  name: c.name,
  region: c.region,
  stature: c.stature,
  rank: c.rank,
  rating: c.rating,
  reason,
});

/**
 * The offers after a dismissal: the best org his reputation reaches at home,
 * the best one reachable in another of `regions`, and a safe seat at home
 * (the reachable org lowest in the table) — distinct, never the club he left
 * — plus "found a new club". Always at least one org when the home region
 * has a real org.
 */
export function dismissalOffersFor(input: {
  world: WorldState;
  rep: number;
  home: Region;
  regions: readonly Region[];
  exclude: readonly string[];
  careerSeed: number;
  seasonIndex: number;
  foundName: string;
}): JobOffer[] {
  const key = `d${input.seasonIndex}`;
  const reach = STATURE_RANK[reachOf(input.rep)];
  const all = candidatesOf(input.world, input.regions, new Set(input.exclude), input.careerSeed, key).filter(
    (c) => STATURE_RANK[c.stature] >= reach,
  );
  const best = (pool: Candidate[]) =>
    [...pool].sort((a, b) => STATURE_RANK[a.stature] - STATURE_RANK[b.stature] || a.f - b.f || a.ref.localeCompare(b.ref))[0];
  const picks: Candidate[] = [];
  const add = (c: Candidate | undefined) => {
    if (c && !picks.some((p) => p.ref === c.ref) && picks.length < M.offersAfterDismissal) picks.push(c);
  };
  const home = all.filter((c) => c.region === input.home);
  add(best(home));
  add(best(all.filter((c) => c.region !== input.home)));
  add([...home].sort((a, b) => b.rank - a.rank || a.ref.localeCompare(b.ref))[0]);
  for (const c of [...all].sort((a, b) => a.f - b.f)) add(c);
  return [
    ...picks.map((c) => toOffer(c, "dismissal", key)),
    { id: `job:${key}:found`, kind: "found", name: input.foundName, region: input.home, stature: "owners", reason: "dismissal" },
  ];
}

/**
 * An unsolicited off-season approach: a bigger org (a stature above the
 * current one, within reach) when the manager's reputation and the board's
 * confidence show a strong career; seeded per season. Null most seasons.
 */
export function unsolicitedOfferFor(input: {
  world: WorldState;
  rep: number;
  confidence: number;
  current: Stature | "owners";
  regions: readonly Region[];
  exclude: readonly string[];
  careerSeed: number;
  seasonIndex: number;
}): JobOffer | null {
  const U = M.unsolicited;
  if (input.rep < U.minRep || input.confidence < U.minConfidence) return null;
  if (derivedFloat(input.careerSeed, streams.gen("jobApproach", String(input.seasonIndex))) >= U.chance) return null;
  const key = `a${input.seasonIndex}`;
  const reach = STATURE_RANK[reachOf(input.rep)];
  const pool = candidatesOf(input.world, input.regions, new Set(input.exclude), input.careerSeed, key).filter(
    (c) => STATURE_RANK[c.stature] >= reach && STATURE_RANK[c.stature] < STATURE_RANK[input.current],
  );
  const pick = pool.sort((a, b) => STATURE_RANK[a.stature] - STATURE_RANK[b.stature] || a.f - b.f)[0];
  return pick ? toOffer(pick, "approach", key) : null;
}
