/**
 * Road to Worlds — the transfer market + AI world roster moves (design §10).
 *
 * Pure module: every function takes plain data + derives its randomness from
 * seed streams (mkt:*) or per-entity derived floats. The living world's
 * "history gravity" lives here: at each preseason window the AI drifts toward
 * the dataset's REAL next-season rosters (fidelity-rolled, per-slot), and
 * mid-season windows add sparse needs-based moves. The user's squad is never
 * touched without consent — user-owned targets simply break their anchor.
 */

import {
  CAREER_COACH_MARKET,
  CAREER_SEASONS,
  CAREER_TRANSFER,
  CAREER_WORLD,
} from "@/config/balance";
import { lineups, playerById, playerCardById } from "@/data";
import { createRng } from "@/lib/rng";
import type { Region, StatKey } from "../types";
import { windowCloseDayFor } from "./calendar";
import {
  ageOf,
  anchorOverall,
  deriveBirthYear,
  playerViewById,
  type ViewCtx,
} from "./development";
import {
  coachSalaryFor,
  computeSalaryAsk,
  contractedFeeFor,
  marketValueFor,
  quantize,
  salaryAskFactors,
  signingBonusFor,
} from "./economy";
import { derivedFloat, deriveSeed, streams } from "./seeds";
import type {
  CareerDifficulty,
  CareerPlayerView,
  CoachState,
  OfferFactor,
  SquadPlayer,
  TransferOffer,
  WorldState,
} from "./types";

export interface AiTransferRecord {
  playerId: string;
  playerName: string;
  fromRef: string | null;
  toRef: string;
  fee: number;
}

// ---------------------------------------------------------------------------
// Synthetic AI contracts (fiction for transfer fees — deterministic per season)
// ---------------------------------------------------------------------------

export function contractedSplitsRemaining(
  playerId: string,
  seasonIndex: number,
  careerSeed: number,
): number {
  const f = derivedFloat(careerSeed, streams.gen("contract", `${playerId}:${seasonIndex}`));
  return 1 + Math.floor(f * 6); // 1..6
}

// ---------------------------------------------------------------------------
// Listings (market browse data)
// ---------------------------------------------------------------------------

export interface MarketListing {
  freeAgents: CareerPlayerView[];
  contracted: { view: CareerPlayerView; orgRef: string; splitsRemaining: number }[];
}

const LISTING_CAP = 120;

export function listingFor(ctx: {
  world: WorldState;
  squadIds: string[];
  seasonIndex: number;
  careerSeed: number;
}): MarketListing {
  const viewCtx: ViewCtx = {
    careerSeed: ctx.careerSeed,
    seasonIndex: ctx.seasonIndex,
    world: ctx.world,
  };
  const squad = new Set(ctx.squadIds);

  const freeAgents: CareerPlayerView[] = [];
  for (const id of ctx.world.freeAgentIds) {
    if (squad.has(id)) continue;
    const view = playerViewById(id, viewCtx);
    if (view) freeAgents.push(view);
  }
  freeAgents.sort((a, b) => b.overall - a.overall);

  const contracted: MarketListing["contracted"] = [];
  for (const org of Object.values(ctx.world.orgs)) {
    for (const id of org.playerIds) {
      if (squad.has(id)) continue;
      const view = playerViewById(id, viewCtx);
      if (!view) continue;
      contracted.push({
        view,
        orgRef: org.ref,
        splitsRemaining: contractedSplitsRemaining(id, ctx.seasonIndex, ctx.careerSeed),
      });
    }
  }
  contracted.sort((a, b) => b.view.overall - a.view.overall);

  return {
    freeAgents: freeAgents.slice(0, LISTING_CAP),
    contracted: contracted.slice(0, LISTING_CAP),
  };
}

// ---------------------------------------------------------------------------
// Ask packages (fixed-ask v1 — the "why this price" readout)
// ---------------------------------------------------------------------------

export interface AskPackage {
  salaryPerSplit: number;
  fee: number;
  signingBonus: number;
  factors: OfferFactor[];
}

export function askPackageFor(
  view: CareerPlayerView,
  ctx: {
    rep: number;
    seasonIndex: number;
    difficulty: CareerDifficulty;
    careerSeed: number;
    role: "starter" | "sub";
    lengthSeasons: 1 | 2 | 3;
    contracted?: { splitsRemaining: number };
  },
): AskPackage {
  const input = {
    overall: view.overall,
    age: view.age,
    potential: view.potential,
    rep: ctx.rep,
    role: ctx.role,
    seasonIndex: ctx.seasonIndex,
    lengthSeasons: ctx.lengthSeasons,
    difficulty: ctx.difficulty,
    careerSeed: ctx.careerSeed,
    playerId: view.id,
  };
  const salaryPerSplit = computeSalaryAsk(input);
  // v0.3: fees derive from the unified market value with a bounded contract
  // load — no more ask × raw-splits-remaining swings.
  const fee = ctx.contracted
    ? contractedFeeFor(
        marketValueFor({
          overall: view.overall,
          age: view.age,
          potential: view.potential,
          seasonIndex: ctx.seasonIndex,
        }),
        ctx.contracted.splitsRemaining,
      )
    : 0;
  const signingBonus = ctx.contracted ? 0 : signingBonusFor(salaryPerSplit);
  const factors = salaryAskFactors(input);
  if (ctx.contracted) {
    factors.push({ key: "contract", delta: fee });
  }
  return { salaryPerSplit, fee, signingBonus, factors };
}

// ---------------------------------------------------------------------------
// AI window moves — history gravity + needs
// ---------------------------------------------------------------------------

interface WindowCtx {
  seasonIndex: number;
  windowIdx: number;
  week: number;
  careerSeed: number;
  userSquadIds: string[];
  isPreseason: boolean;
  infinite: boolean;
}

/** This season's real dataset lineups (the anchor targets). Empty when infinite. */
function anchorLineupsFor(seasonIndex: number): { orgId: string; playerIds: string[] }[] {
  if (seasonIndex >= CAREER_SEASONS.length) return [];
  const seasonId = CAREER_SEASONS[seasonIndex].seasonId;
  return lineups
    .filter((l) => l.seasonId === seasonId && !l.rareSpawn)
    .map((l) => ({
      orgId: l.orgId,
      playerIds: l.playerCardIds.map((cid) => playerCardById.get(cid)!.playerId),
    }));
}

/** Top-3 prestige orgs per region get the stronger anchor fidelity. */
function isTopOrg(world: WorldState, orgRef: string): boolean {
  const org = world.orgs[orgRef];
  if (!org) return false;
  const peers = Object.values(world.orgs)
    .filter((o) => o.region === org.region)
    .sort((a, b) => b.prestige - a.prestige)
    .slice(0, 3);
  return peers.some((o) => o.ref === orgRef);
}

function removeFromWorld(world: WorldState, playerId: string): string | null {
  for (const org of Object.values(world.orgs)) {
    const idx = org.playerIds.indexOf(playerId);
    if (idx >= 0) {
      return org.ref; // caller decides the backfill
    }
  }
  const fa = world.freeAgentIds.indexOf(playerId);
  if (fa >= 0) return null;
  return null;
}

/** View lookup used across one market pass — memoized (views are stable). */
type ViewOf = (id: string) => CareerPlayerView | null;

function bestRegionalFa(
  world: WorldState,
  region: string,
  viewOf: ViewOf,
  exclude: Set<string>,
): string | null {
  let best: string | null = null;
  let bestOvr = -1;
  for (const id of world.freeAgentIds) {
    if (exclude.has(id)) continue;
    const view = viewOf(id);
    if (!view || view.region !== region) continue;
    if (view.overall > bestOvr) {
      bestOvr = view.overall;
      best = id;
    }
  }
  return best;
}

/** Effective org strength for market decisions (rating snapshot or fallback). */
function orgStrength(org: { rating?: number; prestige: number }): number {
  return org.rating ?? 70 + org.prestige * 6;
}

/**
 * v0.3 org-shopping: the best affordable target on a clearly LOWER-rated org
 * of the same region — bounded like-for-like (≤ buyer average + guard) so
 * mid orgs buy peers, not superstars. One displacement level (design §10).
 */
function bestShoppableTarget(
  world: WorldState,
  buyer: { ref: string; region: string; rating?: number; prestige: number },
  viewOf: ViewOf,
  exclude: Set<string>,
  weakestOvr: number,
  avgOvr: number,
): string | null {
  const buyerRating = orgStrength(buyer);
  let best: string | null = null;
  let bestOvr = -1;
  for (const org of Object.values(world.orgs)) {
    if (org.ref === buyer.ref || org.region !== buyer.region) continue;
    if (orgStrength(org) > buyerRating - CAREER_WORLD.orgBuyRatingEdge) continue;
    for (const id of org.playerIds) {
      if (exclude.has(id)) continue;
      const view = viewOf(id);
      if (!view) continue;
      if (view.overall < weakestOvr + 2) continue;
      if (view.overall > avgOvr + CAREER_WORLD.orgBuyMaxAboveAvg) continue;
      if (view.overall > bestOvr) {
        bestOvr = view.overall;
        best = id;
      }
    }
  }
  return best;
}

function feeFictionFor(
  view: CareerPlayerView,
  fromRef: string | null,
  ctx: WindowCtx,
): number {
  if (!fromRef) return 0;
  // v0.3: value-anchored with a small seeded band — same-OVR players now
  // trade for comparable fees everywhere.
  const value = marketValueFor({
    overall: view.overall,
    age: view.age,
    potential: view.potential,
    seasonIndex: ctx.seasonIndex,
  });
  const [lo, hi] = CAREER_TRANSFER.aiFeeBand;
  const f = derivedFloat(
    ctx.careerSeed,
    streams.gen("aiFee", `${view.id}:${ctx.seasonIndex}:${ctx.windowIdx}`),
  );
  return quantize(value * (lo + (hi - lo) * f));
}

/**
 * One market resolution tick. Deterministic: rng from the mkt stream.
 * PRESEASON: anchor pass (drift toward this season's real rosters) + top-up.
 * MID windows: sparse needs-based moves. Never touches the user squad.
 */
export function aiWindowMoves(
  world: WorldState,
  ctx: WindowCtx,
): { world: WorldState; transfers: AiTransferRecord[] } {
  const next: WorldState = structuredClone(world);
  const rng = createRng(
    deriveSeed(ctx.careerSeed, streams.market(ctx.seasonIndex, ctx.windowIdx, ctx.week)),
  );
  const viewCtx: ViewCtx = {
    careerSeed: ctx.careerSeed,
    seasonIndex: ctx.seasonIndex,
    world: next,
  };
  // One memo for the whole pass: derivations are pure per (id, season, delta)
  // and nothing this pass mutates changes a view — without it the v0.3
  // scavenger/shopping scans re-derive the FA pool hundreds of times.
  const viewCache = new Map<string, CareerPlayerView | null>();
  const viewOf: ViewOf = (id) => {
    let v = viewCache.get(id);
    if (v === undefined) {
      v = playerViewById(id, viewCtx);
      viewCache.set(id, v);
    }
    return v;
  };
  const userOwned = new Set(ctx.userSquadIds);
  const transfers: AiTransferRecord[] = [];

  const execMove = (playerId: string, toRef: string): void => {
    const target = next.orgs[toRef];
    if (!target) return;
    if (target.playerIds.includes(playerId)) return;
    const view = viewOf(playerId);
    if (!view) return;
    const fromRef = removeFromWorld(next, playerId);

    // Pull him out of his current spot.
    if (fromRef) {
      const fromOrg = next.orgs[fromRef];
      const idx = fromOrg.playerIds.indexOf(playerId);
      const backfill = bestRegionalFa(next, fromOrg.region, viewOf, userOwned);
      if (backfill) {
        fromOrg.playerIds[idx] = backfill;
        next.freeAgentIds = next.freeAgentIds.filter((id) => id !== backfill);
      } else {
        // No FA available: swap with the target's displaced player below.
        fromOrg.playerIds[idx] = target.playerIds[0];
      }
    } else {
      next.freeAgentIds = next.freeAgentIds.filter((id) => id !== playerId);
    }

    // Displace the target org's weakest player to free agency.
    let weakest = 0;
    let weakestOvr = Infinity;
    target.playerIds.forEach((id, i) => {
      const v = viewOf(id);
      const ovr = v?.overall ?? 60;
      if (ovr < weakestOvr) {
        weakestOvr = ovr;
        weakest = i;
      }
    });
    const displaced = target.playerIds[weakest];
    if (displaced && displaced !== playerId) {
      next.freeAgentIds.push(displaced);
      // Displaced off his script → permanently off-anchor.
      if (!(displaced in next.overallDelta)) next.overallDelta[displaced] = 0;
    }
    target.playerIds[weakest] = playerId;
    next.version += 1;
    transfers.push({
      playerId,
      playerName: view.name,
      fromRef,
      toRef,
      fee: quantize(feeFictionFor(view, fromRef, ctx)),
    });
  };

  if (ctx.isPreseason && !ctx.infinite) {
    // --- Anchor pass: history wants its rosters back -----------------------
    for (const anchor of anchorLineupsFor(ctx.seasonIndex)) {
      const org = next.orgs[anchor.orgId];
      if (!org) continue;
      const fidelity = isTopOrg(next, anchor.orgId)
        ? CAREER_WORLD.anchorFidelityTop
        : CAREER_WORLD.anchorFidelity;
      for (const playerId of anchor.playerIds) {
        if (org.playerIds.includes(playerId)) continue;
        if (userOwned.has(playerId)) continue; // the user broke this slot
        if (next.retiredIds.includes(playerId)) continue;
        const view = viewOf(playerId);
        if (!view) continue; // not debuted yet / unresolvable
        if (!rng.chance(fidelity)) continue; // per-slot break
        execMove(playerId, anchor.orgId);
      }
    }
  } else if (!ctx.isPreseason) {
    // --- Needs pass: a fraction of orgs make one move ----------------------
    // v0.3: orgs can now SHOP a lower-rated org's player (fee trade, one
    // displacement level) instead of only draining the FA pool — mid-season
    // org↔org trades were literally 0% before this pass.
    for (const org of Object.values(next.orgs)) {
      if (!rng.chance(CAREER_WORLD.midWindowMoveRate)) continue;
      let weakestOvr = Infinity;
      let sumOvr = 0;
      let n = 0;
      for (const id of org.playerIds) {
        const v = viewOf(id);
        if (!v) continue;
        sumOvr += v.overall;
        n += 1;
        if (v.overall < weakestOvr) weakestOvr = v.overall;
      }
      const avgOvr = n > 0 ? sumOvr / n : 70;
      let candidate: string | null = null;
      if (rng.chance(CAREER_WORLD.orgBuyChance)) {
        candidate = bestShoppableTarget(next, org, viewOf, userOwned, weakestOvr, avgOvr);
      }
      candidate ??= bestRegionalFa(next, org.region, viewOf, userOwned);
      if (!candidate) continue;
      const cView = viewOf(candidate);
      if (!cView || cView.overall < weakestOvr + 2) continue;
      execMove(candidate, org.ref);
    }
  }

  // --- v0.3 scavenger pass: displaced quality must not rot in the pool ----
  // Any org (chance-gated) picks up a free agent clearly better than its
  // weakest starter — quality percolates down the ladder after anchor/needs
  // displacement instead of accumulating as free agents forever.
  for (const org of Object.values(next.orgs)) {
    if (!rng.chance(CAREER_WORLD.scavengerChance)) continue;
    let weakestOvr = Infinity;
    for (const id of org.playerIds) {
      const v = viewOf(id);
      if (v && v.overall < weakestOvr) weakestOvr = v.overall;
    }
    const fa = bestRegionalFa(next, org.region, viewOf, userOwned);
    if (!fa) continue;
    const view = viewOf(fa);
    if (!view || view.overall < weakestOvr + CAREER_WORLD.scavengerMinEdge) continue;
    execMove(fa, org.ref);
  }

  // --- Top-up: no org plays short-handed ---------------------------------
  for (const org of Object.values(next.orgs)) {
    while (org.playerIds.filter(Boolean).length < 3) {
      const fa = bestRegionalFa(next, org.region, viewOf, userOwned);
      if (!fa) break;
      const slot = org.playerIds.findIndex((id) => !id);
      if (slot >= 0) org.playerIds[slot] = fa;
      else break;
      next.freeAgentIds = next.freeAgentIds.filter((id) => id !== fa);
      next.version += 1;
    }
  }

  return { world: next, transfers };
}

// ---------------------------------------------------------------------------
// Incoming AI bids for user players (poaching pressure)
// ---------------------------------------------------------------------------

/**
 * v0.3 daily poach roll: bids for user players can land on ANY window day
 * (was: only the window's first Monday, only ever for the single best
 * player). Chance scales with squad attractiveness — stars AND developing
 * prospects; target picked by attractiveness weight; capped per window with
 * a cooldown. All randomness derived per (seasonIndex, day) — seed-stable.
 */
export function incomingBidForDay(ctx: {
  world: WorldState;
  squad: SquadPlayer[];
  seasonIndex: number;
  windowIdx: number;
  day: number;
  careerSeed: number;
  rep: number;
  bidsThisWindow: number;
  lastBidDay: number;
  /** Player ids already carrying a pending bid (never doubled up). */
  pendingTargetIds: string[];
}): TransferOffer | null {
  const T = CAREER_TRANSFER;
  if (ctx.squad.length === 0) return null;
  if (ctx.bidsThisWindow >= T.maxBidsPerWindow) return null;
  if (ctx.day - ctx.lastBidDay < T.bidCooldownDays) return null;

  const ageFor = (p: SquadPlayer) =>
    ageOf(p.birthYear ?? deriveBirthYear(p.id, ctx.careerSeed), ctx.seasonIndex);
  const isProspect = (p: SquadPlayer) =>
    ageFor(p) <= T.prospectAgeMax && p.potential - p.overall >= T.prospectUpside;

  const stars = ctx.squad.filter((p) => p.overall >= T.starOverall).length;
  const prospects = ctx.squad.filter(isProspect).length;
  const chance = Math.min(
    T.poachDailyCap,
    T.poachDailyBase + T.poachPerStar * stars + T.poachPerProspect * prospects,
  );
  const roll = derivedFloat(ctx.careerSeed, streams.gen("poachDay", `${ctx.seasonIndex}:${ctx.day}`));
  if (roll >= chance) return null;

  // Target: attractiveness-weighted — AI GMs hunt upside, not only the star.
  const pendingSet = new Set(ctx.pendingTargetIds);
  const pool = ctx.squad.filter((p) => !pendingSet.has(p.id));
  if (pool.length === 0) return null;
  const weightOf = (p: SquadPlayer) =>
    Math.max(1, p.overall - 70) +
    (p.overall >= T.starOverall ? 6 : 0) +
    (isProspect(p) ? 8 : 0);
  const total = pool.reduce((s, p) => s + weightOf(p), 0);
  let cursor =
    derivedFloat(ctx.careerSeed, streams.gen("poachTarget", `${ctx.seasonIndex}:${ctx.day}`)) *
    total;
  let target = pool[pool.length - 1];
  for (const p of pool) {
    cursor -= weightOf(p);
    if (cursor <= 0) {
      target = p;
      break;
    }
  }

  const bidders = Object.values(ctx.world.orgs).filter(
    (o) => o.region === target.region && o.prestige >= 1 && !o.playerIds.includes(target.id),
  );
  if (bidders.length === 0) return null;
  const pick = Math.floor(
    derivedFloat(ctx.careerSeed, streams.gen("poachOrg", `${ctx.seasonIndex}:${ctx.day}`)) *
      bidders.length,
  );
  const bidder = bidders[Math.min(pick, bidders.length - 1)];

  const value = marketValueFor({
    overall: target.overall,
    age: ageFor(target),
    potential: target.potential,
    seasonIndex: ctx.seasonIndex,
  });
  const [lo, hi] = T.aiBidRange;
  const mult =
    lo +
    (hi - lo) *
      derivedFloat(ctx.careerSeed, streams.gen("poachFee", `${ctx.seasonIndex}:${ctx.day}`));
  const fee = quantize(value * mult);

  return {
    id: `bid:${ctx.seasonIndex}:${ctx.day}:${target.id}`,
    direction: "out",
    playerId: target.id,
    playerName: target.name,
    fee,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: bidder.ref,
    status: "pending",
    resolveSeason: ctx.seasonIndex,
    resolveDay: windowCloseDayFor((ctx.windowIdx as 0 | 1 | 2 | 3) ?? 0),
    factors: [],
  };
}

// ---------------------------------------------------------------------------
// Coach market (v0.2 — real retired pros + generated candidates)
// ---------------------------------------------------------------------------

const COACH_STATS: StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

function coachBonusLevel(overall: number): string {
  return overall >= 85 ? "++" : overall >= 75 ? "+" : "~";
}

/**
 * Deterministic coach candidates for a window: real retired pros (from the
 * world's retired list — familiar names feed the coach market, design §8)
 * mixed with generated candidates. Derived, never persisted; the same
 * (careerSeed, seasonIndex, windowIdx) always yields the same shortlist.
 */
export function coachCandidatesFor(ctx: {
  world: WorldState;
  region: Region;
  seasonIndex: number;
  windowIdx: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  nameBank: string[];
}): CoachState[] {
  const M = CAREER_COACH_MARKET;
  const out: CoachState[] = [];
  const key = (i: number) => `${ctx.seasonIndex}:${ctx.windowIdx}:${i}`;

  // Real candidates: retired real players (stable ids), ranked by a derived
  // float so the shortlist rotates between windows.
  const realPool = ctx.world.retiredIds
    .filter((id) => !id.startsWith("fic:") && !id.startsWith("rook:"))
    .map((id) => ({
      id,
      f: derivedFloat(ctx.careerSeed, streams.gen("coachReal", `${key(0)}:${id}`)),
    }))
    .sort((a, b) => a.f - b.f || a.id.localeCompare(b.id));

  const realTarget = Math.round(M.candidatesPerWindow * M.realShare);
  for (const cand of realPool) {
    if (out.length >= realTarget) break;
    const person = playerById.get(cand.id);
    if (!person) continue;
    // Final playing overall = the player's last dataset card (design §8:
    // coachOVR ≈ base + factor × final OVR).
    const finalOvr = anchorOverall(cand.id, Number.MAX_SAFE_INTEGER) ?? 74;
    const overall = Math.round(
      Math.min(92, M.retiredCoachBase + M.retiredCoachFinalOvrFactor * finalOvr),
    );
    const name = person.nickname;
    out.push({
      id: `coach:real:${cand.id}`,
      name,
      overall,
      bonusType:
        COACH_STATS[
          Math.floor(
            derivedFloat(ctx.careerSeed, streams.gen("coachBuff", cand.id)) * COACH_STATS.length,
          ) % COACH_STATS.length
        ],
      bonusLevel: coachBonusLevel(overall),
      salaryPerSplit: coachSalaryFor(overall, ctx.seasonIndex, ctx.difficulty),
      source: "real",
    });
  }

  // Generated candidates fill the shortlist.
  for (let i = 0; out.length < M.candidatesPerWindow; i++) {
    const f = derivedFloat(ctx.careerSeed, streams.gen("coach", `${key(i)}`));
    const f2 = derivedFloat(ctx.careerSeed, streams.gen("coachName", `${key(i)}`));
    const [lo, hi] = M.generatedOverallRange;
    const overall = lo + Math.floor(f * (hi - lo + 1));
    const name = `Coach ${ctx.nameBank[Math.floor(f2 * ctx.nameBank.length) % ctx.nameBank.length]}`;
    out.push({
      id: `coach:gen:${key(i)}`,
      name,
      overall,
      bonusType: COACH_STATS[Math.floor(f2 * COACH_STATS.length) % COACH_STATS.length],
      bonusLevel: coachBonusLevel(overall),
      salaryPerSplit: coachSalaryFor(overall, ctx.seasonIndex, ctx.difficulty),
      source: "generated",
    });
    if (i > M.candidatesPerWindow * 3) break; // defensive
  }
  return out;
}
