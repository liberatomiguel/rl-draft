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
  quantize,
  salaryAskFactors,
  signingBonusFor,
  transferFeeFor,
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
  const fee = ctx.contracted
    ? transferFeeFor(salaryPerSplit, ctx.contracted.splitsRemaining)
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

function bestRegionalFa(
  world: WorldState,
  region: string,
  viewCtx: ViewCtx,
  exclude: Set<string>,
): string | null {
  let best: string | null = null;
  let bestOvr = -1;
  for (const id of world.freeAgentIds) {
    if (exclude.has(id)) continue;
    const view = playerViewById(id, viewCtx);
    if (!view || view.region !== region) continue;
    if (view.overall > bestOvr) {
      bestOvr = view.overall;
      best = id;
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
  const ask = computeSalaryAsk({
    overall: view.overall,
    age: view.age,
    potential: view.potential,
    rep: 50,
    role: "starter",
    seasonIndex: ctx.seasonIndex,
    lengthSeasons: 2,
    difficulty: "normal",
    careerSeed: ctx.careerSeed,
    playerId: view.id,
  });
  return transferFeeFor(ask, contractedSplitsRemaining(view.id, ctx.seasonIndex, ctx.careerSeed));
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
  const userOwned = new Set(ctx.userSquadIds);
  const transfers: AiTransferRecord[] = [];

  const execMove = (playerId: string, toRef: string): void => {
    const target = next.orgs[toRef];
    if (!target) return;
    if (target.playerIds.includes(playerId)) return;
    const view = playerViewById(playerId, viewCtx);
    if (!view) return;
    const fromRef = removeFromWorld(next, playerId);

    // Pull him out of his current spot.
    if (fromRef) {
      const fromOrg = next.orgs[fromRef];
      const idx = fromOrg.playerIds.indexOf(playerId);
      const backfill = bestRegionalFa(next, fromOrg.region, viewCtx, userOwned);
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
      const v = playerViewById(id, viewCtx);
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
        const view = playerViewById(playerId, viewCtx);
        if (!view) continue; // not debuted yet / unresolvable
        if (!rng.chance(fidelity)) continue; // per-slot break
        execMove(playerId, anchor.orgId);
      }
    }
  } else if (!ctx.isPreseason) {
    // --- Needs pass: a fraction of orgs make one move ----------------------
    for (const org of Object.values(next.orgs)) {
      if (!rng.chance(CAREER_WORLD.midWindowMoveRate)) continue;
      // Weakest starter vs best affordable FA.
      let weakestOvr = Infinity;
      for (const id of org.playerIds) {
        const v = playerViewById(id, viewCtx);
        if (v && v.overall < weakestOvr) weakestOvr = v.overall;
      }
      const candidate = bestRegionalFa(next, org.region, viewCtx, userOwned);
      if (!candidate) continue;
      const cView = playerViewById(candidate, viewCtx);
      if (!cView || cView.overall < weakestOvr + 2) continue;
      execMove(candidate, org.ref);
    }
  }

  // --- Top-up: no org plays short-handed ---------------------------------
  for (const org of Object.values(next.orgs)) {
    while (org.playerIds.filter(Boolean).length < 3) {
      const fa = bestRegionalFa(next, org.region, viewCtx, userOwned);
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

export function incomingBids(ctx: {
  world: WorldState;
  squad: SquadPlayer[];
  seasonIndex: number;
  windowIdx: number;
  week: number;
  careerSeed: number;
  rep: number;
  regionRatings: number[];
}): TransferOffer[] {
  if (ctx.squad.length === 0) return [];
  const topPlayers = ctx.squad.filter((p) => p.overall >= 85).length;
  const chance = Math.min(
    CAREER_TRANSFER.poachCap,
    CAREER_TRANSFER.poachBaseChance + CAREER_TRANSFER.poachPerTopPlayer * topPlayers,
  );
  const roll = derivedFloat(
    ctx.careerSeed,
    streams.gen("poach", `${ctx.seasonIndex}:${ctx.windowIdx}`),
  );
  if (roll >= chance) return [];

  // Target: the squad's best player; bidder: a prestige-1+ org of his region.
  const target = [...ctx.squad].sort((a, b) => b.overall - a.overall)[0];
  const bidders = Object.values(ctx.world.orgs).filter(
    (o) => o.region === target.region && o.prestige >= 1 && !o.playerIds.includes(target.id),
  );
  if (bidders.length === 0) return [];
  const pick = Math.floor(
    derivedFloat(ctx.careerSeed, streams.gen("poachOrg", `${ctx.seasonIndex}:${ctx.windowIdx}`)) *
      bidders.length,
  );
  const bidder = bidders[Math.min(pick, bidders.length - 1)];

  const ask = computeSalaryAsk({
    overall: target.overall,
    age: ageOf(target.birthYear ?? deriveBirthYear(target.id, ctx.careerSeed), ctx.seasonIndex),
    potential: target.potential,
    rep: ctx.rep,
    role: "starter",
    seasonIndex: ctx.seasonIndex,
    lengthSeasons: 2,
    difficulty: "normal",
    careerSeed: ctx.careerSeed,
    playerId: target.id,
  });
  const [lo, hi] = CAREER_TRANSFER.aiBidRange;
  const mult =
    lo +
    (hi - lo) *
      derivedFloat(ctx.careerSeed, streams.gen("poachFee", `${ctx.seasonIndex}:${ctx.windowIdx}`));
  const fee = quantize(transferFeeFor(ask, 4) * mult);

  return [
    {
      id: `bid:${ctx.seasonIndex}:${ctx.windowIdx}:${target.id}`,
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
    },
  ];
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
