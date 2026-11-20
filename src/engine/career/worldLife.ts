/**
 * v2.1 Mundo vivo M1 (R137, docs/MUNDO-VIVO-M1.md) — the AI world renews
 * itself in the infinite seasons, behind FEATURES.worldLife:
 *
 *  - scouting: strong orgs sign a near-ready prospect as their RESERVE; he
 *    starts only once he is better than the weakest starter (the starter
 *    moves to the bench and stays), so a top org's fielded overall never
 *    drops for a signing;
 *  - stack signing: a Local side that reached a Major or Worlds is signed;
 *  - org turnover: a small org stuck at the bottom gives its seat to a new org;
 *  - the local scene's ceiling: its region's median − localAnchorBelowMedian;
 *  - coaches age and retire; an AI org changes coach after bad seasons.
 *
 * Pure and rng-free: every roll is a derived float of (careerSeed, key), so
 * nothing here consumes a stream the rest of the career reads.
 */
import { CAREER_COACH_MARKET, CAREER_NAMES, CAREER_SEASONS, CAREER_WORLD_LIFE as L, FEATURES } from "@/config/balance";
import { playerById } from "@/data";
import type { Region } from "../types";
import {
  bestCardOverall,
  becomesCoachOnRetirement,
  developmentPhaseOf,
  developmentProfileOf,
  growthModelOf,
  peakAgeWithRoom,
  playerViewById,
  rookieView,
} from "./development";
import { exProCoachQuality } from "./market";
import { derivedFloat, streams } from "./seeds";
import type { CareerPlayerView, CoachState, CompactEventResult, WorldOrgState, WorldState } from "./types";
import { fillerOrgName, regionMedianRating } from "./worldSim";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];

/** The first season the M1 rules apply to. */
export function worldLifeFrom(): number {
  return L.fromSeasonIndex ?? CAREER_SEASONS.length;
}

/** M1 is live for `seasonIndex` (the flag on, past the RLCS timeline). */
export function worldLifeOn(seasonIndex: number): boolean {
  return FEATURES.worldLife && seasonIndex >= worldLifeFrom();
}

const ratingOf = (o: WorldOrgState) => o.rating ?? 70 + o.prestige * 6;
const byRatingDesc = (a: WorldOrgState, b: WorldOrgState) => ratingOf(b) - ratingOf(a) || a.ref.localeCompare(b.ref);

/** The season's local-scene ceiling per region (stored in `competition.localCap`). */
export function localCapsFor(world: WorldState): Partial<Record<Region, number>> {
  const out: Partial<Record<Region, number>> = {};
  for (const region of REGIONS) out[region] = regionMedianRating(world, region) - L.localAnchorBelowMedian;
  return out;
}

type Ctx = { careerSeed: number; seasonIndex: number };

function cloneOrgs(world: WorldState): WorldState {
  const orgs: Record<string, WorldOrgState> = {};
  for (const [ref, o] of Object.entries(world.orgs)) {
    orgs[ref] = { ...o, playerIds: [...o.playerIds] as [string, string, string], ...(o.reserveIds ? { reserveIds: [...o.reserveIds] } : {}) };
  }
  return { ...world, orgs, freeAgentIds: [...world.freeAgentIds], overallDelta: { ...world.overallDelta } };
}

/**
 * A reserve starts once his overall passes the weakest starter's; that
 * starter takes his bench seat (he stays at the org). The trio's overall can
 * only go up. Returns the same world when nobody moves.
 */
export function promoteReserves(world: WorldState, ctx: Ctx): { world: WorldState; promoted: { orgRef: string; inId: string; outId: string; gain: number }[] } {
  const promoted: { orgRef: string; inId: string; outId: string; gain: number }[] = [];
  if (!Object.values(world.orgs).some((o) => o.reserveIds?.length)) return { world, promoted };
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world };
  const ovr = (id: string) => playerViewById(id, view)?.overall ?? 0;
  let next: WorldState | null = null;
  for (const ref of Object.keys(world.orgs).sort()) {
    const org = world.orgs[ref];
    if (!org.reserveIds?.length) continue;
    const best = [...org.reserveIds].sort((a, b) => ovr(b) - ovr(a) || a.localeCompare(b))[0];
    let weakest = 0;
    org.playerIds.forEach((id, i) => {
      if (ovr(id) < ovr(org.playerIds[weakest])) weakest = i;
    });
    const out = org.playerIds[weakest];
    if (!(ovr(best) > ovr(out))) continue;
    next ??= cloneOrgs(world);
    const o = next.orgs[ref];
    o.playerIds[weakest] = best;
    o.reserveIds = [...o.reserveIds!.filter((id) => id !== best), out];
    promoted.push({ orgRef: ref, inId: best, outId: out, gain: ovr(best) - ovr(out) });
  }
  if (!next) return { world, promoted };
  next.version += 1;
  return { world: next, promoted };
}

/**
 * Scouting at the rollover: an org of prestige ≥ prestigeMin (strongest
 * first) signs, with `chance`, the best young free agent of its region whose
 * overall is within `belowWeakest` of its weakest starter — onto the bench.
 */
export function scoutingPass(
  world: WorldState,
  ctx: Ctx & { userSquadIds: readonly string[] },
): { world: WorldState; signings: { orgRef: string; orgName: string; playerId: string; playerName: string; region: Region }[] } {
  const S = L.scouting;
  const next = cloneOrgs(world);
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world: next };
  const user = new Set(ctx.userSquadIds);
  const signings: { orgRef: string; orgName: string; playerId: string; playerName: string; region: Region }[] = [];
  for (const org of Object.values(next.orgs).filter((o) => o.prestige >= S.prestigeMin).sort(byRatingDesc)) {
    if (derivedFloat(ctx.careerSeed, streams.gen("wlScout", `${org.ref}:${ctx.seasonIndex}`)) >= S.chance) continue;
    const weakest = Math.min(...org.playerIds.map((id) => playerViewById(id, view)?.overall ?? 0));
    let pick: { id: string; name: string; potential: number; overall: number } | null = null;
    for (const id of next.freeAgentIds) {
      if (user.has(id)) continue;
      const v = playerViewById(id, view);
      if (!v || v.region !== org.region || v.age > S.maxAge || v.potential < S.minPotential) continue;
      if (v.overall < weakest - S.belowWeakest) continue;
      if (!pick || v.potential > pick.potential || (v.potential === pick.potential && (v.overall > pick.overall || (v.overall === pick.overall && id < pick.id)))) {
        pick = { id, name: v.name, potential: v.potential, overall: v.overall };
      }
    }
    if (!pick) continue;
    const bench = org.reserveIds ?? [];
    if (bench.length >= S.reserveSlots) {
      // A full bench makes room only by releasing a veteran.
      const vet = bench
        .map((id) => ({ id, v: playerViewById(id, view) }))
        .filter((x) => !x.v || x.v.age >= S.benchVeteranAge)
        .sort((a, b) => (a.v?.overall ?? 0) - (b.v?.overall ?? 0) || a.id.localeCompare(b.id))[0];
      if (!vet) continue;
      org.reserveIds = bench.filter((id) => id !== vet.id);
      if (vet.v) next.freeAgentIds.push(vet.id);
    }
    org.reserveIds = [...(org.reserveIds ?? []), pick.id];
    next.freeAgentIds = next.freeAgentIds.filter((id) => id !== pick!.id);
    if (!(pick.id in next.overallDelta)) next.overallDelta[pick.id] = 0; // off-script from here, like any AI move
    signings.push({ orgRef: org.ref, orgName: org.name, playerId: pick.id, playerName: pick.name, region: org.region });
  }
  if (signings.length === 0) return { world, signings };
  next.version += 1;
  return { world: next, signings };
}

/** M2.1: active elite — a ceiling at the elite bar and not yet declining. */
function isActiveElite(v: CareerPlayerView, careerSeed: number): boolean {
  if (v.potential < L.eliteRenewal.potentialMin) return false;
  const { plateauYears } = developmentProfileOf(v.id, careerSeed);
  return developmentPhaseOf(v.age, { peakAge: v.peakAge, plateauYears }) !== "declining";
}

function liftedPotential(id: string, careerSeed: number): number {
  const w = L.eliteRenewal.liftWeights;
  const pots = Object.keys(w).map(Number).sort((a, b) => a - b);
  const total = pots.reduce((s, p) => s + (w[p] ?? 0), 0);
  let f = derivedFloat(careerSeed, streams.gen("wlElite", id)) * total;
  for (const p of pots) {
    f -= w[p] ?? 0;
    if (f < 0) return p;
  }
  return pots[pots.length - 1];
}

/**
 * v2.1 Mundo vivo M2.1 (R141): the world grows. The first time it runs, each
 * region's active AI elite is counted into `world.eliteBaseline` (× the dose,
 * `baselineShare`); afterwards, a region under its baseline promotes up to
 * `perRegionPerSeason` young AI players to an elite ceiling
 * (`world.potentialLift`, peak age fixed now). The user's squad never counts
 * and is never promoted.
 */
export function eliteRenewalPass(
  world: WorldState,
  ctx: Ctx & { userSquadIds: readonly string[] },
): { world: WorldState; lifted: { playerId: string; playerName: string; region: Region; orgName: string | null; potential: number }[] } {
  const E = L.eliteRenewal;
  const lifted: { playerId: string; playerName: string; region: Region; orgName: string | null; potential: number }[] = [];
  if (E.perRegionPerSeason <= 0) return { world, lifted };
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world };
  const user = new Set(ctx.userSquadIds);
  const orgOf = new Map<string, WorldOrgState>();
  for (const o of Object.values(world.orgs)) for (const id of [...o.playerIds, ...(o.reserveIds ?? [])]) orgOf.set(id, o);
  const pool = [...orgOf.keys(), ...world.freeAgentIds]
    .filter((id) => !user.has(id))
    .map((id) => playerViewById(id, view))
    .filter((v): v is CareerPlayerView => v !== null);
  const counting = world.eliteBaseline === undefined;
  const baseline: Partial<Record<Region, number>> = { ...(world.eliteBaseline ?? {}) };
  const lifts = { ...(world.potentialLift ?? {}) };
  const delta = { ...world.overallDelta };
  for (const region of REGIONS) {
    const mine = pool.filter((v) => v.region === region);
    const active = mine.filter((v) => isActiveElite(v, ctx.careerSeed)).length;
    if (counting) {
      baseline[region] = Math.round(active * E.baselineShare);
      continue;
    }
    const need = Math.min(E.perRegionPerSeason, (baseline[region] ?? 0) - active);
    if (need <= 0) continue;
    const picks = mine
      .filter((v) => !lifts[v.id] && v.age <= E.maxAge && v.potential >= E.candidateMinPotential && v.potential < E.potentialMin)
      .sort((a, b) => Number(orgOf.has(b.id)) - Number(orgOf.has(a.id)) || b.overall - a.overall || b.potential - a.potential || a.id.localeCompare(b.id))
      .slice(0, need);
    for (const v of picks) {
      const potential = liftedPotential(v.id, ctx.careerSeed);
      lifts[v.id] = { potential, peakAge: peakAgeWithRoom(v.peakAge, v.age, potential - v.overall) };
      if (!(v.id in delta)) delta[v.id] = 0; // off-script: the weekly world growth moves him from here
      lifted.push({ playerId: v.id, playerName: v.name, region, orgName: orgOf.get(v.id)?.name ?? null, potential });
    }
  }
  if (!counting && lifted.length === 0) return { world, lifted };
  return {
    world: { ...world, eliteBaseline: baseline, overallDelta: delta, ...(Object.keys(lifts).length ? { potentialLift: lifts } : {}), version: world.version + 1 },
    lifted,
  };
}

/** A Local side that played the season's Major or Worlds, read from the season's results. */
export interface StackCandidate {
  ref: string;
  region: Region;
  name: string;
  rating: number;
  playerNames: readonly [string, string, string];
  /** Best placement order (lower = better) — the region's best stack is signed. */
  rank: number;
}

/** The season's Local sides at a Major or Worlds (best placed first per region). */
export function stackCandidatesFrom(
  results: readonly CompactEventResult[],
  seasonIndex: number,
  describe: (ref: string) => Omit<StackCandidate, "rank" | "ref"> | null,
): StackCandidate[] {
  const best = new Map<string, number>();
  for (const r of results) {
    if (r.seasonIndex !== seasonIndex || (r.tier !== "major" && r.tier !== "worlds")) continue;
    r.rows.forEach((row, i) => {
      if (!row.ref.startsWith("local:")) return;
      const rank = (r.tier === "worlds" ? 0 : 100) + i;
      best.set(row.ref, Math.min(best.get(row.ref) ?? Infinity, rank));
    });
  }
  const out: StackCandidate[] = [];
  for (const [ref, rank] of best) {
    const d = describe(ref);
    if (d) out.push({ ...d, ref, rank });
  }
  return out.sort((a, b) => a.rank - b.rank || a.ref.localeCompare(b.ref));
}

export function coachRetireChance(age: number): number {
  let p = 0;
  for (const [k, v] of Object.entries(L.coaches.retireByAge)) if (age >= Number(k)) p = Math.max(p, v);
  return p;
}

function ageFrom(range: readonly [number, number], f: number): number {
  return range[0] + Math.floor(f * (range[1] - range[0] + 1));
}

/** A coach's age on first sight: an ex-pro is young in the job, everyone else in `ageRange`. */
export function coachAgeOnFirstSight(coachId: string, exPro: boolean, careerSeed: number): number {
  const f = derivedFloat(careerSeed, streams.gen("wlCoachAge", coachId));
  return ageFrom(exPro ? L.coaches.exProAge : L.coaches.ageRange, f);
}

function triangular(f: number, [lo, mode, hi]: readonly [number, number, number]): number {
  const c = (mode - lo) / (hi - lo);
  return f < c ? lo + Math.sqrt(f * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - f) * (hi - lo) * (hi - mode));
}

export interface OrgLifeReport {
  turnovers: { region: Region; leftRef: string; leftName: string; enteredRef: string; enteredName: string }[];
  stacks: { region: Region; stackName: string; orgRef: string; orgName: string }[];
  coachRetired: number;
  coachChanged: number;
}

/**
 * The rollover's org life cycle (into `ctx.seasonIndex`): bottom counters,
 * turnover, stack signing and the AI coaches. `retiredNow` = the players who
 * retired at this rollover (the ex-pros who move into coaching feed the AI
 * orgs' new coaches first).
 */
export function orgLifecycle(
  world: WorldState,
  ctx: Ctx & { stacks: readonly StackCandidate[]; retiredNow: readonly string[]; userSquadIds: readonly string[] },
): { world: WorldState; report: OrgLifeReport } {
  const T = L.orgTurnover;
  const C = L.coaches;
  const next = cloneOrgs(world);
  const report: OrgLifeReport = { turnovers: [], stacks: [], coachRetired: 0, coachChanged: 0 };
  const season = ctx.seasonIndex;
  const bank = next.nameBankVersion ?? CAREER_NAMES.bankVersion;
  const model = growthModelOf(next);
  const view = { careerSeed: ctx.careerSeed, seasonIndex: season, world: next };

  // Ex-pros of this rollover who move into coaching, best first.
  const exPros = ctx.retiredNow
    .filter((id) => playerById.has(id) && becomesCoachOnRetirement(id, ctx.careerSeed))
    .map((id) => ({ id, q: exProCoachQuality(bestCardOverall(id) ?? 74, derivedFloat(ctx.careerSeed, streams.gen("coachJitter", id))) }))
    .sort((a, b) => b.q - a.q || a.id.localeCompare(b.id));
  const newCoach = (key: string): { overall: number; age: number } => {
    const ex = exPros.shift();
    if (ex) return { overall: ex.q, age: coachAgeOnFirstSight(`ai:${ex.id}`, true, ctx.careerSeed) };
    const f = derivedFloat(ctx.careerSeed, streams.gen("wlCoachNew", key));
    return { overall: Math.round(triangular(f, CAREER_COACH_MARKET.generated.senior.quality)), age: coachAgeOnFirstSight(`ai:new:${key}`, false, ctx.careerSeed) };
  };

  for (const region of REGIONS) {
    const inRegion = Object.values(next.orgs).filter((o) => o.region === region).sort(byRatingDesc);
    // 1. Bottom counters (last season's stored ratings).
    inRegion.forEach((o, i) => {
      if (i >= T.outsideTop) o.lowSeasons = (o.lowSeasons ?? 0) + 1;
      else delete o.lowSeasons;
    });
    const stack = ctx.stacks.find((s) => s.region === region) ?? null;
    let stackHome: WorldOrgState | null = null;

    // 2. Turnover: the weakest small org stuck at the bottom gives way.
    const leaving = inRegion
      .filter((o) => o.prestige <= T.maxPrestige && (o.lowSeasons ?? 0) >= T.seasons)
      .sort((a, b) => ratingOf(a) - ratingOf(b) || a.ref.localeCompare(b.ref))
      .slice(0, T.perRegionPerSeason);
    for (const old of leaving) {
      const names = new Set(Object.values(next.orgs).map((o) => o.name));
      let i = 100 + season;
      let name = fillerOrgName(region, i, ctx.careerSeed, bank);
      for (let tries = 0; names.has(name) && tries < 40; tries++) name = fillerOrgName(region, ++i, ctx.careerSeed, bank);
      const ref = `fill:${region}:${100 + season}`;
      if (next.orgs[ref]) continue;
      const coach = newCoach(`${ref}`);
      delete next.orgs[old.ref];
      next.freeAgentIds.push(...(old.reserveIds ?? []));
      const org: WorldOrgState = {
        ref,
        name,
        region,
        prestige: 0,
        playerIds: [...old.playerIds] as [string, string, string],
        coachOverall: coach.overall,
        coachAge: coach.age,
        coachSince: season,
        stars: 0,
        ...(old.rating !== undefined ? { rating: old.rating } : {}),
      };
      next.orgs[ref] = org;
      report.turnovers.push({ region, leftRef: old.ref, leftName: old.name, enteredRef: ref, enteredName: name });
      if (stack && !stackHome) stackHome = org;
    }

    // 3. Stack signing: the entrant, else the region's weakest org.
    if (stack && ctx.stacks.filter((s) => s.region === region).length > 0) {
      const home = stackHome ?? Object.values(next.orgs).filter((o) => o.region === region).sort((a, b) => ratingOf(a) - ratingOf(b) || a.ref.localeCompare(b.ref))[0];
      if (home) {
        const ids: string[] = [];
        stack.playerNames.forEach((pname, k) => {
          const id = `rook:${season}:${region}:${300 + k}`;
          const base = rookieView(region, season, 300 + k, ctx.careerSeed, true, undefined, model);
          next.rookieNames = { ...(next.rookieNames ?? {}), [id]: pname };
          next.overallDelta[id] = Math.round(stack.rating) - base.overall;
          ids.push(id);
        });
        for (const id of home.playerIds) if (!ctx.userSquadIds.includes(id) && playerViewById(id, view)) next.freeAgentIds.push(id);
        home.playerIds = ids as [string, string, string];
        report.stacks.push({ region, stackName: stack.name, orgRef: home.ref, orgName: home.name });
      }
    }

    // 4. AI coaches: age, retire, or go after bad seasons.
    const ranked = Object.values(next.orgs).filter((o) => o.region === region).sort(byRatingDesc);
    ranked.forEach((o, rank) => {
      if (o.coachOverall === undefined) return;
      // First sight: an age, no stamp (his tenure counts from the first M1 season).
      if (o.coachAge === undefined) o.coachAge = coachAgeOnFirstSight(`ai:${o.ref}`, false, ctx.careerSeed);
      else if (o.coachSince !== season) o.coachAge += 1;
      const retires = derivedFloat(ctx.careerSeed, streams.gen("wlCoachRetire", `ai:${o.ref}:${season}`)) < coachRetireChance(o.coachAge);
      const sacked =
        !retires &&
        rank >= C.aiChangeOutsideTop &&
        season - (o.coachSince ?? worldLifeFrom()) >= C.aiChangeMinSeasons &&
        derivedFloat(ctx.careerSeed, streams.gen("wlCoachSack", `${o.ref}:${season}`)) < C.aiChangeChance;
      if (!retires && !sacked) return;
      const c = newCoach(`${o.ref}:${season}`);
      // A retiring coach's org hires at about his level (an org does not fall for a retirement);
      // a sacked one takes whoever answers.
      o.coachOverall = retires ? Math.max(c.overall, o.coachOverall - C.successorMaxDrop) : c.overall;
      o.coachAge = c.age;
      o.coachSince = season;
      if (retires) report.coachRetired += 1;
      else report.coachChanged += 1;
    });
  }
  next.version += 1;
  return { world: next, report };
}

/**
 * The user's coach at the rollover into `nextSeason`: an announced coach
 * leaves now (never mid-season); otherwise he ages and may announce that this
 * season is his last.
 */
export function userCoachRollover(
  coach: CoachState,
  nextSeason: number,
  careerSeed: number,
): { coach: CoachState | null; announced: boolean; retired: boolean } {
  if (coach.retiresAfterSeason !== undefined && nextSeason > coach.retiresAfterSeason) {
    return { coach: null, announced: false, retired: true };
  }
  const age = coach.age === undefined ? coachAgeOnFirstSight(coach.id, coach.source === "real", careerSeed) : coach.age + 1;
  const next: CoachState = { ...coach, age };
  if (next.retiresAfterSeason === undefined && derivedFloat(careerSeed, streams.gen("wlCoachRetire", `${coach.id}:${nextSeason}`)) < coachRetireChance(age)) {
    next.retiresAfterSeason = nextSeason;
    return { coach: next, announced: true, retired: false };
  }
  return { coach: next, announced: false, retired: false };
}
