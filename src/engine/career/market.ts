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
  CAREER_DEV,
  CAREER_SALARY,
  CAREER_TALENT,
  CAREER_TRANSFER,
  CAREER_VALUATION,
  CAREER_WORLD,
} from "@/config/balance";
import { coaches as coachCards, lineups, playerById, playerCardById, seasonById } from "@/data";
import { createRng } from "@/lib/rng";
import type { Region, StatKey } from "../types";
import { intakeSeasonIdFor, weekOfDay, windowCloseDayFor, windowIndexOf } from "./calendar";
import {
  ageOf,
  anchorOverall,
  becomesCoachOnRetirement,
  bestCardOverall,
  deriveArchetype,
  deriveBirthYear,
  developmentProfileOf,
  growthModelOf,
  isCompetitiveAge,
  isGrowthContract,
  playerViewById,
  seasonOrderFor,
  type ViewCtx,
} from "./development";
import { OBJECTIVES, coachBonusLevelFor } from "./training";
import {
  coachWageFor,
  computeSalaryAsk,
  contractedFeeFor,
  marketValueFor,
  quantize,
  reachGapFor,
  repTierOf,
  salaryAskFactors,
  signableOverallCap,
  signingBonusFor,
  type MarketValueInput,
  type SalaryAskInput,
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

/**
 * UX-07 (rc.33): the ONE reputation rule for a new signing — he signs only up
 * to the org's cap (`economy.signableOverallCap`). The refusal in
 * `signingPlanFor` ("repGate"), the Market's locked tiles and its "signable
 * at my reputation" filter all read it. Renewals and the squad are exempt.
 */
export function signableAtRep(overall: number, rep: number): boolean {
  return Math.round(overall) <= signableOverallCap(rep);
}

// ---------------------------------------------------------------------------
// Listings (market browse data)
// ---------------------------------------------------------------------------

export interface MarketListing {
  freeAgents: CareerPlayerView[];
  contracted: { view: CareerPlayerView; orgRef: string; splitsRemaining: number }[];
}

const LISTING_CAP = 120;
/**
 * rc.32: free agents the org can sign that the listing always shows (one
 * market page). The top LISTING_CAP by overall can all sit above a low
 * reputation's signing cap — a restructured org at rep 0 saw only locked
 * rows and could never sign again. rc.37 (F1): the contracted page too.
 */
const LISTING_MIN_SIGNABLE = 24;

export function listingFor(ctx: {
  world: WorldState;
  squadIds: string[];
  seasonIndex: number;
  careerSeed: number;
  /** rc.32: the org's signing cap (economy.signableOverallCap) — tops the free agents up with signable ones. */
  signableCap?: number;
  /** Skip the contracted players (an empty `contracted`) — the free-agent page only. */
  freeAgentsOnly?: boolean;
}): MarketListing {
  const viewCtx: ViewCtx = {
    careerSeed: ctx.careerSeed,
    seasonIndex: ctx.seasonIndex,
    world: ctx.world,
  };
  const squad = new Set(ctx.squadIds);

  // DEV-02 (R48): the market lists only players of competitive age (13+).
  const freeAgents: CareerPlayerView[] = [];
  for (const id of ctx.world.freeAgentIds) {
    if (squad.has(id)) continue;
    const view = playerViewById(id, viewCtx);
    if (view && isCompetitiveAge(view.age)) freeAgents.push(view);
  }
  freeAgents.sort((a, b) => b.overall - a.overall);

  const contracted: MarketListing["contracted"] = [];
  for (const org of ctx.freeAgentsOnly ? [] : Object.values(ctx.world.orgs)) {
    for (const id of org.playerIds) {
      if (squad.has(id)) continue;
      const view = playerViewById(id, viewCtx);
      if (!view || !isCompetitiveAge(view.age)) continue;
      contracted.push({
        view,
        orgRef: org.ref,
        splitsRemaining: contractedSplitsRemaining(id, ctx.seasonIndex, ctx.careerSeed),
      });
    }
  }
  contracted.sort((a, b) => b.view.overall - a.view.overall);

  const listedFree = freeAgents.slice(0, LISTING_CAP);
  const listedContracted = contracted.slice(0, LISTING_CAP);
  const cap = ctx.signableCap;
  if (cap !== undefined) {
    const signable = (v: CareerPlayerView) => Math.round(v.overall) <= cap;
    const missing = LISTING_MIN_SIGNABLE - listedFree.filter(signable).length;
    if (missing > 0) listedFree.push(...freeAgents.slice(LISTING_CAP).filter(signable).slice(0, missing));
    // rc.37 (F1): the contracted page mirrors it. The top LISTING_CAP by
    // overall stay (stars included); below them the best players this org may
    // sign top the page up to LISTING_MIN_SIGNABLE, when there are that many.
    // A low reputation saw only locked rows: the top 120 sat above its cap.
    const missingContracted = LISTING_MIN_SIGNABLE - listedContracted.filter((c) => signable(c.view)).length;
    if (missingContracted > 0) {
      listedContracted.push(
        ...contracted.slice(LISTING_CAP).filter((c) => signable(c.view)).slice(0, missingContracted),
      );
    }
  }
  // rc.36 (POL-04, Miguel on rc.35: "more free agents with potential in the
  // 80s through the seasons"): every free-agent prospect is listed. The top
  // LISTING_CAP by overall across the regions hid the kids: by season 3 an
  // APAC career listed 1 of its region's 10 (the pool's 300 free agents).
  const { minPotential, minRoom } = CAREER_WORLD.listingProspects;
  if (minPotential !== null) {
    const listed = new Set(listedFree.map((v) => v.id));
    listedFree.push(
      ...freeAgents.filter((v) => !listed.has(v.id) && v.potential >= minPotential && v.potential - v.overall >= minRoom),
    );
  }
  return {
    freeAgents: listedFree,
    contracted: listedContracted,
  };
}

// ---------------------------------------------------------------------------
// rc.37 (F1): the one market-value input
// ---------------------------------------------------------------------------

/**
 * rc.37 (F1): a player a price reads — a market view (its season `age`) or a
 * squad player (his `birthYear`), with the peak age he carries.
 */
export interface PricedPlayer {
  id: string;
  overall: number;
  potential: number;
  /** A view's season age; a squad player gives his birthYear instead. */
  age?: number;
  birthYear?: number;
  /** The view's / squad player's stored peak age (authoritative, never recomputed). */
  peakAge?: number;
}

/** rc.37 (F1): his integer season age in `seasonIndex` — the age every price reads. */
export function seasonAgeOf(p: PricedPlayer, careerSeed: number, seasonIndex: number): number {
  return p.age ?? ageOf(p.birthYear ?? deriveBirthYear(p.id, careerSeed), seasonIndex);
}

/**
 * rc.37 (F1): the ONE `marketValueFor` input for a player — his numbers, his
 * season age and his arc (the peak age he carries and his DevelopmentProfile's
 * plateau years), so his reach gap prices him — for every fee, bid and
 * readout: the user's buys (`askPackageFor`), the AI's bids for his players
 * (`incomingBidForDay`, the Blockbuster), the AI↔AI fee fiction. A market view
 * and the squad player he becomes read the same input on the same day.
 * Another caller (a sale, a crisis) builds its input here too, so buying,
 * selling and a free agent's wage read one valuation.
 */
export function valueInputOf(
  p: PricedPlayer,
  careerSeed: number,
  seasonIndex: number,
  /**
   * The career's development model (`growthModelOf(save.world)`; absent = the
   * model a new career starts on). The arc prices model 2 only: rc.31's model
   * 1 has no plateau — he grows toward his potential at any age — so it reads
   * the profile-free input (his raw gap), as its bands read no age cap.
   */
  growthModel: number = CAREER_DEV.growthModel,
): MarketValueInput {
  const input: MarketValueInput = {
    overall: p.overall,
    age: seasonAgeOf(p, careerSeed, seasonIndex),
    potential: p.potential,
    seasonIndex,
  };
  if (p.peakAge == null || !isGrowthContract(growthModel)) return input;
  return { ...input, peakAge: p.peakAge, plateauYears: developmentProfileOf(p.id, careerSeed).plateauYears };
}

/** rc.37 (F1): the `computeSalaryAsk` input on the same valuation (`valueInputOf`). */
export function askInputOf(
  p: PricedPlayer,
  ctx: {
    careerSeed: number;
    seasonIndex: number;
    rep: number;
    lengthSeasons: 1 | 2 | 3;
    difficulty: CareerDifficulty;
    ambitious?: boolean;
    blockbusterRefused?: boolean;
    /** The career's development model (see `valueInputOf`). */
    growthModel?: number;
  },
): SalaryAskInput {
  return {
    ...valueInputOf(p, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel),
    rep: ctx.rep,
    lengthSeasons: ctx.lengthSeasons,
    difficulty: ctx.difficulty,
    careerSeed: ctx.careerSeed,
    playerId: p.id,
    ambitious: ctx.ambitious,
    blockbusterRefused: ctx.blockbusterRefused,
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
    /**
     * @deprecated ECO-03 (R47): the slot he takes never changes his price —
     * ignored (kept optional so older callers compile).
     */
    role?: "starter" | "sub";
    lengthSeasons: 1 | 2 | 3;
    contracted?: { splitsRemaining: number };
    /** rc.37 (F1): the career's development model (`growthModelOf(save.world)`; see `valueInputOf`). */
    growthModel?: number;
  },
): AskPackage {
  // rc.37 (F1): his ask and his fee read one valuation (his reach gap).
  const input = askInputOf(view, ctx);
  const salaryPerSplit = computeSalaryAsk(input);
  // v0.3: fees derive from the unified market value with a bounded contract
  // load — no more ask × raw-splits-remaining swings.
  const fee = ctx.contracted
    ? contractedFeeFor(
        marketValueFor(valueInputOf(view, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel)),
        ctx.contracted.splitsRemaining,
        ctx.seasonIndex,
      )
    : 0;
  const signingBonus = ctx.contracted ? 0 : signingBonusFor(salaryPerSplit);
  const factors = salaryAskFactors(input);
  if (ctx.contracted) {
    factors.push({ key: "contract", delta: fee });
  }
  return { salaryPerSplit, fee, signingBonus, factors };
}

/**
 * ECO-03 (R47): the fresh ask for renewing a squad player — his normal value
 * at today's overall, age, potential and the org's reputation, whatever his
 * slot (a reserve renews like a starter), with the "ambitious" premium
 * (design §9). ONE function for renewPlayerFlow and the renewal screen.
 */
export function renewalAskFor(
  player: Pick<SquadPlayer, "id" | "overall" | "potential" | "birthYear"> &
    Partial<Pick<SquadPlayer, "contractEndSeason" | "blockbusterRefusedUntil" | "peakAge">>,
  ctx: {
    rep: number;
    seasonIndex: number;
    difficulty: CareerDifficulty;
    careerSeed: number;
    lengthSeasons: 1 | 2 | 3;
    /** rc.32 (M2): false = the core ask, without the ambition premium or the Blockbuster surcharge (renewalTermsFor adds them on top). */
    surcharges?: boolean;
    /** rc.37 (F1): the career's development model (see `valueInputOf`). */
    growthModel?: number;
  },
): number {
  // rc.37 (F1): the one valuation (`askInputOf`) — his arc prices a renewal
  // like any other ask.
  return computeSalaryAsk(
    askInputOf(player, {
      careerSeed: ctx.careerSeed,
      seasonIndex: ctx.seasonIndex,
      rep: ctx.rep,
      lengthSeasons: ctx.lengthSeasons,
      difficulty: ctx.difficulty,
      growthModel: ctx.growthModel,
      // rc.32 (M2): `surcharges: false` prices the core ask — no ambition
      // premium and no Blockbuster surcharge (renewalTermsFor adds both on top).
      ambitious: ctx.surcharges !== false && isAmbitiousRenewal(player.overall, ctx.rep),
      // rc.32: a Blockbuster bid refused during THIS deal surcharges its renewal
      // (CAREER_SALARY.blockbusterRefusalRenewalMult; declared since v0.2, never
      // passed before — the offer and the mail now say so).
      blockbusterRefused: ctx.surcharges !== false && blockbusterRefusalApplies(player),
    }),
  );
}

/** The "ambitious" renewal premium's condition (design §9): a star at an org below rep tier 3. */
export function isAmbitiousRenewal(overall: number, rep: number): boolean {
  return overall >= CAREER_SALARY.ambitiousOverall && repTierOf(rep) < 3;
}

/**
 * rc.32: does the refused-Blockbuster surcharge apply to this player's next
 * renewal? Only for the deal that ran when he was kept (the stamp is that
 * deal's end season; a renewed deal ends later, so it applies once).
 */
export function blockbusterRefusalApplies(
  player: Partial<Pick<SquadPlayer, "contractEndSeason" | "blockbusterRefusedUntil">>,
): boolean {
  return (
    player.blockbusterRefusedUntil !== undefined && player.blockbusterRefusedUntil === player.contractEndSeason
  );
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
  /**
   * rc.35 (front C): players already signed by an org in this window
   * (`movedThisWindowIds`) — no AI org moves them again before it closes.
   */
  lockedIds?: string[];
}

/**
 * rc.35 (front C, Miguel on rc.34): the players an org (AI or the user)
 * signed in a given window, read from the transfer wire — a just-signed
 * player takes no other offer before that window closes.
 */
export function movedThisWindowIds(
  log: readonly { seasonIndex: number; day: number; playerId: string; toRef: string | null }[],
  seasonIndex: number,
  windowIdx: number,
): Set<string> {
  const out = new Set<string>();
  for (const e of log) {
    if (e.seasonIndex !== seasonIndex || e.toRef === null) continue;
    if (windowIndexOf(weekOfDay(e.day)) === windowIdx) out.add(e.playerId);
  }
  return out;
}

// rc.37 (F1): rc.35's `signedInWindow` (no bid in the signing window) is
// superseded by `resaleLocked` below (the signing window and the next).

/** Transfer windows a season (preseason, two mid-season, the Worlds window). */
const WINDOWS_PER_SEASON = 4;

/**
 * rc.37 (F1): the latest window opened by `day` of `seasonIndex`, as a career-
 * wide ordinal (season × 4 + window), and whether that window is still open.
 * The preseason window opens on day 1, so every day has one.
 */
function windowSlotOf(seasonIndex: number, day: number): { ord: number; open: boolean } {
  const week = weekOfDay(day);
  for (let w = week; w >= 1; w--) {
    const idx = windowIndexOf(w);
    if (idx !== null) return { ord: seasonIndex * WINDOWS_PER_SEASON + idx, open: w === week };
  }
  return { ord: seasonIndex * WINDOWS_PER_SEASON, open: false };
}

/**
 * rc.37 (F1, the resale lock): true while a player the user signed cannot be
 * sold — from his signing until the close of the
 * CAREER_VALUATION.resaleLockWindows-th window after the one he signed in
 * (signed between windows: after the last one that opened). No AI bid and no
 * Blockbuster bid lands on him meanwhile, so buying and selling in the same
 * window (or the next) is never a profit. A founder, or a squad player signed
 * before rc.35 (no `signedDay`), is never locked. One rule for
 * `incomingBidForDay`, the scripted Blockbuster degrade and any future sale.
 */
export function resaleLocked(
  p: { joinedSeason: number; signedDay?: number },
  seasonIndex: number,
  day: number,
): boolean {
  if (p.signedDay === undefined) return false;
  const lastLocked = windowSlotOf(p.joinedSeason, p.signedDay).ord + CAREER_VALUATION.resaleLockWindows;
  const now = windowSlotOf(seasonIndex, day);
  return now.open ? now.ord <= lastLocked : now.ord < lastLocked;
}

/** This season's real dataset lineups (the anchor targets). Empty when infinite. */
function anchorLineupsFor(seasonIndex: number): { orgId: string; region: Region; playerIds: string[] }[] {
  // rc.39 (R109): the late wave (RLCS 2027) anchors at its infinite-era season.
  const seasonId = intakeSeasonIdFor(seasonIndex);
  if (!seasonId) return [];
  return lineups
    .filter((l) => l.seasonId === seasonId && !l.rareSpawn)
    .map((l) => ({
      orgId: l.orgId,
      region: l.region,
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
  /** rc.37 (F1): the world's development model (see `valueInputOf`). */
  growthModel: number,
): number {
  if (!fromRef) return 0;
  // v0.3: value-anchored with a small seeded band — same-OVR players now
  // trade for comparable fees everywhere. rc.37 (F1): the same value input.
  const value = marketValueFor(valueInputOf(view, ctx.careerSeed, ctx.seasonIndex, growthModel));
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
  // rc.35 (front C): a player signed in this window is not moved again before it closes.
  const locked = new Set(ctx.lockedIds ?? []);
  const transfers: AiTransferRecord[] = [];

  const execMove = (playerId: string, toRef: string): void => {
    const target = next.orgs[toRef];
    if (!target) return;
    if (locked.has(playerId)) return;
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
    locked.add(playerId);
    next.version += 1;
    transfers.push({
      playerId,
      playerName: view.name,
      fromRef,
      toRef,
      fee: quantize(feeFictionFor(view, fromRef, ctx, growthModelOf(next))),
    });
  };

  if (ctx.isPreseason && (!ctx.infinite || intakeSeasonIdFor(ctx.seasonIndex) !== null)) {
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
        // v2.0 (C1): the dataset reuses an org id across regions (Elevate: SAM
        // in 2021-22, APAC after). The world keeps the org where it entered,
        // so a lineup from another region only brings the players who are
        // from the org's own region (FURIA's Brazilians in its NA season) —
        // never the other region's roster.
        if (anchor.region !== org.region && view.region !== org.region) continue;
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
 * ECO-03b (ROADMAP Etapa 2, decided 29/10 — R47): no bid of any kind for the
 * user's players during the career's first transfer window (season 0's
 * preseason window, windowIdx 0). `CAREER_TRANSFER.firstWindowBidFree`.
 * Read by `incomingBidForDay` and by the scripted-beat Blockbuster degrade.
 */
export function userBidsBlocked(seasonIndex: number, windowIdx: number | null): boolean {
  return CAREER_TRANSFER.firstWindowBidFree && seasonIndex === 0 && windowIdx === 0;
}

/**
 * The weight an AI bid targets a user player by: his level over 70, a star's
 * +6, and rc.37 (F1, package 2) a talent's interest — a reach gap ≥
 * CAREER_TRANSFER.prospectUpside at any age adds CAREER_TALENT.talentBidPerGap
 * × his reach gap, at least talentBidMin (rc.36's +8 for an u18 prospect) and
 * at most talentBidMax: a 70/98 at 17 weighs 29 (rc.36 9).
 */
export function bidWeightOf(
  p: SquadPlayer,
  ctx: { careerSeed: number; seasonIndex: number; /** The career's development model (see `valueInputOf`). */ growthModel?: number },
): number {
  const T = CAREER_TRANSFER;
  const K = CAREER_TALENT;
  const gap = reachGapFor(valueInputOf(p, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel));
  const talent = gap >= T.prospectUpside ? Math.min(K.talentBidMax, Math.max(K.talentBidMin, K.talentBidPerGap * gap)) : 0;
  return Math.max(1, p.overall - 70) + (p.overall >= T.starOverall ? 6 : 0) + talent;
}

/** rc.43 (R114): what an AI bid adds for youth and reach (CAREER_TALENT.bidPremium); 1 = the plain market value. */
export function bidPremiumFor(input: Parameters<typeof reachGapFor>[0]): number {
  const B = CAREER_TALENT.bidPremium;
  const young = input.age <= B.youngAgeMax ? B.young : 0;
  return 1 + Math.min(B.max, young + B.perGap * Math.max(0, reachGapFor(input)));
}

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
  // ECO-03b (R47): the career's first window is bid-free.
  if (userBidsBlocked(ctx.seasonIndex, ctx.windowIdx)) return null;
  if (ctx.bidsThisWindow >= T.maxBidsPerWindow) return null;
  if (ctx.day - ctx.lastBidDay < T.bidCooldownDays) return null;

  // The players a bid may target: none with a pending bid; rc.35 (front C):
  // none the user signed in this window; rc.37 (F1, the resale lock): nor in
  // the window before it (`resaleLocked`). rc.37: the daily chance counts
  // these players only, so a locked talent never draws bids onto his
  // teammates (rc.36 counted the whole squad). The rolls are per-day derived
  // floats: returning before them shifts nothing.
  const pendingSet = new Set(ctx.pendingTargetIds);
  const pool = ctx.squad.filter((p) => !pendingSet.has(p.id) && !resaleLocked(p, ctx.seasonIndex, ctx.day));
  if (pool.length === 0) return null;
  // rc.37 (F1): the career's development model prices his arc (`valueInputOf`).
  const valueCtx = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, growthModel: growthModelOf(ctx.world) };
  const isProspect = (p: SquadPlayer) => {
    const input = valueInputOf(p, ctx.careerSeed, ctx.seasonIndex, valueCtx.growthModel);
    return input.age <= T.prospectAgeMax && reachGapFor(input) >= T.prospectUpside;
  };

  const stars = pool.filter((p) => p.overall >= T.starOverall).length;
  const prospects = pool.filter(isProspect).length;
  const chance = Math.min(
    T.poachDailyCap,
    T.poachDailyBase + T.poachPerStar * stars + T.poachPerProspect * prospects,
  );
  const roll = derivedFloat(ctx.careerSeed, streams.gen("poachDay", `${ctx.seasonIndex}:${ctx.day}`));
  if (roll >= chance) return null;

  // Target: attractiveness-weighted — AI GMs hunt upside, not only the star
  // (rc.37 F1: the more reach, the more interest, at any age — `bidWeightOf`).
  const weightOf = (p: SquadPlayer) => bidWeightOf(p, valueCtx);
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

  // rc.37 (F1): the same valuation as a buy (`valueInputOf`).
  const targetInput = valueInputOf(target, ctx.careerSeed, ctx.seasonIndex, valueCtx.growthModel);
  // rc.43 (R114): a bid pays for youth and upside on top of the shared valuation.
  const value = marketValueFor(targetInput) * bidPremiumFor(targetInput);
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

// rc.33 (ECO-12): rc.32's "List for sale" helpers (listingWaitDaysFor,
// fieldingBuyerFor, listingOfferFor) are gone with the listing and the
// restructuring's forced sale; random AI bids (incomingBidForDay) stay.

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

/** A triangular draw on [min, mode, max] from a uniform float (most values near the mode). */
function triangularFrom(f: number, [lo, mode, hi]: readonly [number, number, number]): number {
  const fc = (mode - lo) / (hi - lo);
  return f < fc ? lo + Math.sqrt(f * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - f) * (hi - lo) * (hi - mode));
}

/** rc.34 (DEV-03 T4): a whole number of seasons inside [lo, hi] from a uniform float. */
const intIn = (f: number, [lo, hi]: readonly [number, number]): number => lo + Math.min(hi - lo, Math.floor(f * (hi - lo + 1)));

/** rc.34 (T4): the quality a coach can grow to — his quality at hire + a stable room, never above the max. */
function coachCeilingFor(quality: number, f: number): number {
  const g = CAREER_COACH_MARKET.growth;
  return Math.min(g.ceilingMax, Math.max(quality, quality + intIn(f, g.ceilingRoom)));
}

/**
 * rc.34 (decision 5-A): an ex-pro's coaching quality from his CAREER-BEST
 * club card — base + slope × (best − anchor) ± jitter, clamped to the range
 * (rc.33: min(92, 55 + 0.25 × the last card)). `f` is a stable 0..1.
 */
export function exProCoachQuality(bestCard: number, f: number): number {
  const X = CAREER_COACH_MARKET.exPro;
  const raw = X.base + X.slope * (bestCard - X.anchor) + (f * 2 - 1) * X.jitter;
  return Math.round(Math.min(X.range[1], Math.max(X.range[0], raw)));
}

/** rc.44 (R118): the dataset's real coaches by person: every season coached (its order) with that card's overall and buff. */
type StaffCard = { order: number; overall: number; bonusType: StatKey };
const staffByPerson: Map<string, { name: string; region: Region; cards: StaffCard[] }> = (() => {
  const map = new Map<string, { name: string; region: Region; cards: StaffCard[] }>();
  for (const c of coachCards) {
    const order = seasonById.get(c.seasonId)?.order;
    if (order == null) continue;
    const row = map.get(c.personId) ?? { name: c.name, region: c.region as Region, cards: [] };
    row.cards.push({ order, overall: c.overall, bonusType: c.bonusType as StatKey });
    map.set(c.personId, row);
  }
  return map;
})();

/** The last season order a person appears in as a PLAYER (absent = never). */
const lastPlayedOrder: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const card of playerCardById.values()) {
    const order = seasonById.get(card.seasonId)?.order ?? 0;
    map.set(card.playerId, Math.max(map.get(card.playerId) ?? 0, order));
  }
  return map;
})();

type StaffPick = { id: string; name: string; region: Region; overall: number; experience: number; bonusType: StatKey; f: number };

/**
 * rc.44 (R118): the real coaches a club of this reputation can shortlist in a
 * window (CAREER_COACH_MARKET.staff). Deterministic per (career, season,
 * window); quality and experience read only the seasons already played.
 */
export function staffCoachCandidatesFor(ctx: {
  region: Region;
  seasonIndex: number;
  windowIdx: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  reputation: number;
}): CoachState[] {
  const S = CAREER_COACH_MARKET.staff;
  if (S.perWindow <= 0) return [];
  const order = seasonOrderFor(ctx.seasonIndex);
  const cap = S.repCapBase + S.repCapPerRep * ctx.reputation;
  const key = `${ctx.seasonIndex}:${ctx.windowIdx}`;
  const pool: StaffPick[] = [];
  for (const [id, person] of staffByPerson) {
    const past = person.cards.filter((c) => c.order <= order);
    if (past.length === 0 || (lastPlayedOrder.get(id) ?? 0) >= order) continue;
    const best = past.reduce((a, b) => (b.overall > a.overall ? b : a));
    if (best.overall > cap) continue;
    pool.push({
      id,
      name: person.name,
      region: person.region,
      overall: best.overall,
      experience: Math.min(S.maxExperience, new Set(past.map((c) => c.order)).size),
      bonusType: best.bonusType,
      f: derivedFloat(ctx.careerSeed, streams.gen("coachStaff", `${key}:${id}`)),
    });
  }
  if (pool.length === 0) return [];
  const byQuality = [...pool].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const elite = new Set(byQuality.slice(0, Math.max(1, Math.ceil(pool.length * S.eliteShare))).map((p) => p.id));
  const rotation = [...pool].sort((a, b) => a.f - b.f || a.id.localeCompare(b.id));
  const picks: StaffPick[] = [];
  const first = rotation.find((p) => elite.has(p.id));
  if (first) picks.push(first);
  const wants: ((p: StaffPick) => boolean)[] = [(p) => p.region === ctx.region, () => true];
  for (const want of wants) {
    for (const p of rotation) {
      if (picks.length >= S.perWindow) break;
      if (!picks.includes(p) && want(p)) picks.push(p);
    }
  }
  return picks.slice(0, S.perWindow).map((p) => ({
    id: `coach:staff:${p.id}`,
    name: p.name,
    overall: p.overall,
    bonusType: p.bonusType,
    bonusLevel: coachBonusLevelFor(p.overall),
    salaryPerSplit: quantize(
      coachWageFor({ quality: p.overall, experience: p.experience, exPro: false }, ctx.seasonIndex, ctx.difficulty) * S.wageMult,
    ),
    source: "dataset" as const,
    experience: p.experience,
    specialty:
      OBJECTIVES[
        Math.floor(derivedFloat(ctx.careerSeed, streams.gen("coachSpec", `staff:${p.id}`)) * OBJECTIVES.length) % OBJECTIVES.length
      ],
    ceiling: coachCeilingFor(p.overall, derivedFloat(ctx.careerSeed, streams.gen("coachCeil", `staff:${p.id}`))),
  }));
}

/**
 * Deterministic coach candidates for a window: real retired pros (from the
 * world's retired list — familiar names feed the coach market, design §8)
 * mixed with generated candidates. Derived, never persisted; the same
 * (careerSeed, seasonIndex, windowIdx) always yields the same shortlist.
 * rc.34 (DEV-03 T4): every coach carries quality, experience and a
 * specialty (each with its printed effect, `training.coachProfileOf`), his
 * ceiling, and a wage on quality + experience (`economy.coachWageFor`).
 */
export function coachCandidatesFor(ctx: {
  world: WorldState;
  region: Region;
  seasonIndex: number;
  windowIdx: number;
  careerSeed: number;
  difficulty: CareerDifficulty;
  nameBank: string[];
  /** rc.44 (R118): the club's reputation, which decides who of the real coaches answers. Absent = none (rc.43's shortlist). */
  reputation?: number;
}): CoachState[] {
  const M = CAREER_COACH_MARKET;
  const out: CoachState[] = [];
  // rc.44 (R118): the dataset's real coaches take the first seats.
  const staff = ctx.reputation == null ? [] : staffCoachCandidatesFor({ ...ctx, reputation: ctx.reputation });
  const staffPeople = new Set(staff.map((c) => c.id.slice("coach:staff:".length)));
  out.push(...staff);
  const key = (i: number) => `${ctx.seasonIndex}:${ctx.windowIdx}:${i}`;
  const objectives = OBJECTIVES;

  // Real candidates: retired real players WHO BECAME COACHES (DEV-02, R48 —
  // the rest left the game), stable ids, ranked by a derived float so the
  // shortlist rotates between windows.
  const realPool = ctx.world.retiredIds
    .filter((id) => becomesCoachOnRetirement(id, ctx.careerSeed))
    .map((id) => ({
      id,
      f: derivedFloat(ctx.careerSeed, streams.gen("coachReal", `${key(0)}:${id}`)),
    }))
    .sort((a, b) => a.f - b.f || a.id.localeCompare(b.id));

  const realTarget = staff.length + Math.round((M.candidatesPerWindow - staff.length) * M.realShare);
  for (const cand of realPool) {
    if (out.length >= realTarget) break;
    const person = playerById.get(cand.id);
    if (!person || staffPeople.has(cand.id)) continue;
    // rc.34 (5-A): his career-best club card, the slope 0.8 formula, the
    // archetype's specialty (an all-rounder rolls one), 3 seasons of
    // experience and the ex-pro wage premium. Stable per (career, player).
    const bestCard = bestCardOverall(cand.id) ?? anchorOverall(cand.id, Number.MAX_SAFE_INTEGER) ?? 74;
    const overall = exProCoachQuality(bestCard, derivedFloat(ctx.careerSeed, streams.gen("coachJitter", cand.id)));
    const archetype = deriveArchetype(cand.id, ctx.careerSeed);
    const specialty =
      M.exPro.specialtyByArchetype[archetype] ??
      objectives[Math.floor(derivedFloat(ctx.careerSeed, streams.gen("coachSpec", cand.id)) * objectives.length) % objectives.length];
    const experience = M.exPro.experience;
    out.push({
      id: `coach:real:${cand.id}`,
      name: person.nickname,
      overall,
      bonusType:
        COACH_STATS[
          Math.floor(
            derivedFloat(ctx.careerSeed, streams.gen("coachBuff", cand.id)) * COACH_STATS.length,
          ) % COACH_STATS.length
        ],
      bonusLevel: coachBonusLevelFor(overall),
      salaryPerSplit: coachWageFor({ quality: overall, experience, exPro: true }, ctx.seasonIndex, ctx.difficulty),
      source: "real",
      experience,
      specialty,
      ceiling: coachCeilingFor(overall, derivedFloat(ctx.careerSeed, streams.gen("coachCeil", cand.id))),
      bestCard,
    });
  }

  // Generated candidates fill the shortlist: the first is a senior profile
  // (t7: a good generic in most windows), the rest standard.
  for (let i = 0; out.length < M.candidatesPerWindow; i++) {
    const f = derivedFloat(ctx.careerSeed, streams.gen("coach", `${key(i)}`));
    const f2 = derivedFloat(ctx.careerSeed, streams.gen("coachName", `${key(i)}`));
    const f3 = derivedFloat(ctx.careerSeed, streams.gen("coachExp", `${key(i)}`));
    const f4 = derivedFloat(ctx.careerSeed, streams.gen("coachSpec", `${key(i)}`));
    const f5 = derivedFloat(ctx.careerSeed, streams.gen("coachCeil", `${key(i)}`));
    const profile = i === 0 ? M.generated.senior : M.generated.standard;
    const overall = Math.round(triangularFrom(f, profile.quality));
    const experience = intIn(f3, profile.experience);
    const name = `Coach ${ctx.nameBank[Math.floor(f2 * ctx.nameBank.length) % ctx.nameBank.length]}`;
    out.push({
      id: `coach:gen:${key(i)}`,
      name,
      overall,
      bonusType: COACH_STATS[Math.floor(f2 * COACH_STATS.length) % COACH_STATS.length],
      bonusLevel: coachBonusLevelFor(overall),
      salaryPerSplit: coachWageFor({ quality: overall, experience, exPro: false }, ctx.seasonIndex, ctx.difficulty),
      source: "generated",
      experience,
      specialty: objectives[Math.floor(f4 * objectives.length) % objectives.length],
      ceiling: coachCeilingFor(overall, f5),
    });
    if (i > M.candidatesPerWindow * 3) break; // defensive
  }
  return out;
}
