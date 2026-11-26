/**
 * v2.2 ENDLESS (FEATURES.endlessVariety, docs/handoff-2.2/endless.md): the
 * infinite seasons stay interesting once a team is dominant.
 *
 *  - Rival projects: each endless season a few AI orgs per region concentrate
 *    the best players they can sign (from other orgs or free agency, a swap:
 *    the project's weakest starter takes the signed player's seat), scaled by
 *    how far the leading team sits above the rest. No rating is created or
 *    taken: only who plays where changes.
 *  - Cups: the Invitational invites from a wider points table and draws its
 *    bracket per event (the two best seeds in opposite halves).
 *  - Legends: an Invitational field of all-time RLCS rosters at their real
 *    card ratings, offered to a strong team in the endless years.
 *  - Season rules: the season's Major hosts and Worlds name, drawn by seed.
 *
 * Pure and rng-free: every roll is a derived float of (careerSeed, key), so
 * nothing here consumes a stream the rest of the career reads.
 */
import { CAREER_ENDLESS as E, CAREER_GEAR, CAREER_SEASONS, CAREER_TRANSFER, FEATURES } from "@/config/balance";
import { coachById, lineupById, lineups, seasonById, specialCards, subById } from "@/data";
import { assembleTournamentTeam, playerMemberFromPick } from "@/engine/teams";
import type { Region, TournamentTeam } from "../types";
import { windowCloseDayFor } from "./calendar";
import { playerViewById } from "./development";
import { marketValueFor, quantize } from "./economy";
import { bidPremiumFor, resaleLocked, valueInputOf } from "./market";
import { careerMatchProfile } from "./difficulty";
import { derivedFloat, streams } from "./seeds";
import type { CareerDifficulty, CareerEventDef, CareerPlayerView, EndlessState, RivalProject, SquadPlayer, TransferOffer, WorldOrgState, WorldState } from "./types";
import { orgTeamFor } from "./worldSim";

/** The front is live for this save from `endless.fromSeason` on (set at a rollover, so a running season never changes). */
export function endlessOn(save: { endless?: EndlessState | null }, seasonIndex: number): boolean {
  return FEATURES.endlessVariety && !!save.endless && seasonIndex >= save.endless.fromSeason;
}

/** Endless years proper (past the dataset timeline and its late intake): projects, Legends, rules. */
export function endlessYear(seasonIndex: number): boolean {
  return seasonIndex >= Math.max(E.fromSeasonIndex, CAREER_SEASONS.length);
}

const f = (seed: number, what: string, key: string) => derivedFloat(seed, streams.gen(what, key));

// ---------------------------------------------------------------------------
// Rival projects
// ---------------------------------------------------------------------------

/**
 * The user's own toolbox, item by item, as a project buys it (decision of
 * 26/11: a project may use what the user's club can use, nothing else). Each
 * effect is read from the user's own configuration, never a new number.
 */
export type KitItem = "facilities" | "coach" | "bench" | "bootcamp" | "psychologist";
export const KIT_ORDER: readonly KitItem[] = ["facilities", "coach", "bench", "bootcamp", "psychologist"];

const GEAR_BY_ID = new Map<string, (typeof CAREER_GEAR.items)[number]>(CAREER_GEAR.items.map((i) => [i.id, i]));
/** pcs + perfCenter: the org-buff levels the user's facilities give (capped at 3, as gearBuffLevels). */
const FACILITY_LEVELS = Math.min(3, (GEAR_BY_ID.get("pcs")?.buffLevels ?? 0) + (GEAR_BY_ID.get("perfCenter")?.buffLevels ?? 0));
const FACILITY_BUFF = (["~", "+", "++", "+++"] as const)[FACILITY_LEVELS];
/** The performance centre's flat team-rating bonus (gearCompetitiveBonus). */
const FACILITY_RATING = GEAR_BY_ID.get("perfCenter")?.ratingBonus ?? 0;
/** The best bootcamp's sharpness, under the user's own temporary cap (userTeamFor). */
const BOOTCAMP_RATING = Math.min(Math.max(...CAREER_GEAR.bootcamp.map((b) => b.sharpRating)), CAREER_GEAR.tempRatingMax);

/** What a project's kit adds to its side in orgTeamFor (worldSim). */
export function projectKitEffect(items: readonly KitItem[]): {
  buffLevel: "~" | "+" | "++" | "+++" | null;
  ratingBonus: number;
  statBonus: Record<string, number> | null;
  bench: boolean;
} {
  const has = (k: KitItem) => items.includes(k);
  return {
    buffLevel: has("facilities") ? FACILITY_BUFF : null,
    ratingBonus: (has("facilities") ? FACILITY_RATING : 0) + (has("bootcamp") ? BOOTCAMP_RATING : 0),
    statBonus: has("psychologist") ? (CAREER_GEAR.psychologistStatBonus as Record<string, number>) : null,
    bench: has("bench"),
  };
}

type Ctx = {
  careerSeed: number;
  seasonIndex: number;
  difficulty: CareerDifficulty;
  userSquadIds: readonly string[];
  /** The user's team rating (userSeedRatingFor), on the orgs' scale. */
  userRating: number;
  userRegion: Region;
  /** Last season's projects (they may continue while the answer lasts). */
  running: readonly RivalProject[];
  /** Orgs whose project ended last season: they start no new one this season. */
  restingRefs?: readonly string[];
  /** The reigning Worlds champion and its consecutive titles (`worldsStreakOf`). */
  streak: { ref: string | null; titles: number };
};

/** As the matches read it: the difficulty's shift on the AI side included (a Hard world needs a bigger lead). */
const matchRating = (t: TournamentTeam) => t.rating.total;

/**
 * How far the leading side (the user or an AI org) sits above the next three
 * sides of the world, in team-rating points. 0 when the world is level.
 */
export function dominanceOf(sides: { id: string; rating: number }[]): { leader: string | null; gap: number } {
  const sorted = [...sides].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  if (sorted.length < 4) return { leader: sorted[0]?.id ?? null, gap: 0 };
  const next = (sorted[1].rating + sorted[2].rating + sorted[3].rating) / 3;
  return { leader: sorted[0].id, gap: Math.max(0, sorted[0].rating - next) };
}

/**
 * The consecutive Worlds titles of the last Worlds' champion ("user" for the
 * user), read from the honours ledger. A season without a Worlds is skipped.
 */
export function worldsStreakOf(
  honors: readonly { tier: string; seasonIndex: number; orgRef: string }[] | undefined,
  lastSeason: number,
): { ref: string | null; titles: number } {
  // One champion per season with a Worlds, newest first (a cancelled Worlds neither breaks nor extends a run).
  const bySeason = new Map<number, string>();
  for (const h of honors ?? []) if (h.tier === "worlds" && h.seasonIndex <= lastSeason) bySeason.set(h.seasonIndex, h.orgRef);
  const seasons = [...bySeason.keys()].sort((x, y) => y - x);
  if (seasons.length === 0 || lastSeason - seasons[0] > 1) return { ref: null, titles: 0 };
  const ref = bySeason.get(seasons[0])!;
  let titles = 0;
  for (const k of seasons) {
    if (bySeason.get(k) !== ref) break;
    titles += 1;
  }
  return { ref, titles };
}

/**
 * The world's answer this season: how many projects (0 = none). A first title
 * defence meets one project, each further consecutive Worlds adds one, a big
 * rating lead adds one, capped. Without dominance there is no answer, and a
 * broken dynasty starts again from the bottom. The kit follows the strength.
 */
export function projectStrengthFor(gap: number, defendingTitles: number, holding = false): number {
  const P = E.projects;
  // A running dynasty (two titles or more) is answered while it holds the top; a first defence needs a lead.
  const answered = gap >= P.dominanceFloor || (defendingTitles >= 1 && gap >= P.defenceFloor) || (defendingTitles >= 2 && holding);
  if (!answered) return 0;
  return Math.min(P.maxProjects, Math.max(1, defendingTitles) + (gap >= P.bigGap ? 1 + Math.floor((gap - P.bigGap) / P.gapStep) : 0));
}

/** The kit at a strength, in KIT_ORDER: `kitBase` items for one project, one more per step. */
export function kitFor(strength: number): KitItem[] {
  return KIT_ORDER.slice(0, Math.min(KIT_ORDER.length, strength + E.projects.kitBase - 1));
}

function cloneOrgs(world: WorldState): WorldState {
  const orgs: Record<string, WorldOrgState> = {};
  for (const [ref, o] of Object.entries(world.orgs)) {
    orgs[ref] = { ...o, playerIds: [...o.playerIds] as [string, string, string], ...(o.reserveIds ? { reserveIds: [...o.reserveIds] } : {}) };
  }
  return { ...world, orgs, freeAgentIds: [...world.freeAgentIds], overallDelta: { ...world.overallDelta } };
}

/**
 * The rollover pass. Reads the world as it stands after the age pass and M1,
 * returns the new world and this season's projects (continued and new). The
 * user's squad is never read for a signing and never touched; no player's
 * rating changes, only who plays where and what the org has bought.
 */
export function rivalProjectsPass(
  input: WorldState,
  ctx: Ctx,
): { world: WorldState; projects: RivalProject[]; gap: number; leader: string | null; strength: number } {
  const P = E.projects;
  // Every kit is decided again each season, on the bare world (a running project never hides the lead it answers).
  let world = input;
  if (Object.values(input.orgs).some((o) => o.projectKit)) {
    world = cloneOrgs(input);
    for (const o of Object.values(world.orgs)) delete o.projectKit;
    world.version += 1;
  }
  const teamCtx = { world, seasonIndex: ctx.seasonIndex, careerSeed: ctx.careerSeed, difficulty: ctx.difficulty };
  const ratings = new Map<string, number>();
  for (const ref of Object.keys(world.orgs).sort()) ratings.set(ref, matchRating(orgTeamFor(ref, teamCtx)));
  const sides = [{ id: "user", rating: ctx.userRating }, ...[...ratings].map(([id, rating]) => ({ id, rating }))];
  const top = dominanceOf(sides);
  // The side the world answers: the reigning champion while it still sits near the top (a dynasty is
  // answered even when last season's answer closed the gap), else the leader. The same rule for the user and an AI.
  const topRating = Math.max(...sides.map((x) => x.rating));
  const champ = ctx.streak.titles >= 1 ? sides.find((x) => x.id === ctx.streak.ref) : undefined;
  const holding = !!champ && champ.rating >= topRating - P.holdSlack;
  const leader = holding ? champ!.id : top.leader;
  const next3 = holding ? sides.filter((x) => x.id !== champ!.id).sort((a, b) => b.rating - a.rating).slice(0, 3) : [];
  const gap = holding ? Math.max(0, champ!.rating - next3.reduce((n, x) => n + x.rating, 0) / Math.max(1, next3.length)) : top.gap;
  const defending = holding ? ctx.streak.titles : 0;
  const strength = endlessYear(ctx.seasonIndex) ? projectStrengthFor(gap, defending, holding) : 0;
  if (strength === 0) return { world, projects: [], gap, leader, strength };
  const items = kitFor(strength);
  const imports = strength >= P.importFromStrength;

  const next = cloneOrgs(world);
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world: next };
  const viewCache = new Map<string, CareerPlayerView | null>();
  const viewOf = (id: string) => {
    if (!viewCache.has(id)) viewCache.set(id, playerViewById(id, view));
    return viewCache.get(id) ?? null;
  };
  const user = new Set(ctx.userSquadIds);
  const taken = new Set<string>(); // players a project signed this pass: nobody takes them again
  const projects: RivalProject[] = [];

  // Continued projects first (a core kept together), while the answer lasts and under the season cap.
  const plan: { ref: string; since: number; region: Region; continued: boolean }[] = [];
  for (const p of [...ctx.running].sort((a, b) => a.since - b.since || a.orgRef.localeCompare(b.orgRef))) {
    if (plan.length >= strength) break;
    const org = next.orgs[p.orgRef];
    if (!org || org.ref === leader || ctx.seasonIndex - p.since >= P.maxSeasons) continue;
    plan.push({ ref: org.ref, since: p.since, region: org.region, continued: true });
  }
  // New ones: the leader's region first, then the others in a seeded order, one per region.
  const leaderRegion: Region | undefined = leader === "user" ? ctx.userRegion : leader ? world.orgs[leader]?.region : undefined;
  const others = (P.regions as readonly Region[])
    .filter((r) => r !== leaderRegion)
    .map((r) => ({ r, k: f(ctx.careerSeed, "endlessRegion", `${ctx.seasonIndex}:${r}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  const order = [...(leaderRegion && (P.regions as readonly Region[]).includes(leaderRegion) ? [leaderRegion] : []), ...others];
  const resting = new Set([...(ctx.restingRefs ?? []), ...ctx.running.map((p) => p.orgRef)]);
  for (const region of order) {
    if (plan.length >= strength) break;
    if (plan.some((x) => x.region === region)) continue;
    const candidates = Object.values(next.orgs)
      .filter((o) => o.region === region && o.ref !== leader && !resting.has(o.ref))
      .sort((a, b) => (ratings.get(b.ref) ?? 0) - (ratings.get(a.ref) ?? 0) || a.ref.localeCompare(b.ref))
      .slice(0, P.candidateOrgs);
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(f(ctx.careerSeed, "endlessProject", `${ctx.seasonIndex}:${region}`) * candidates.length)];
    plan.push({ ref: pick.ref, since: ctx.seasonIndex, region, continued: false });
  }
  const projectRefs = new Set(plan.map((x) => x.ref));

  // Where every AI player sits: an org's starter or reserve seat, or free agency.
  const seatOf = new Map<string, { ref: string; bench: boolean }>();
  for (const o of Object.values(next.orgs)) {
    o.playerIds.forEach((id) => seatOf.set(id, { ref: o.ref, bench: false }));
    for (const id of o.reserveIds ?? []) seatOf.set(id, { ref: o.ref, bench: true });
  }
  const poolFor = (org: WorldOrgState, region: Region) =>
    [...seatOf.keys(), ...next.freeAgentIds]
      .filter((id) => !user.has(id) && !taken.has(id) && !org.playerIds.includes(id) && !(org.reserveIds ?? []).includes(id))
      .filter((id) => {
        const at = seatOf.get(id);
        return !at || !projectRefs.has(at.ref);
      })
      .map((id) => viewOf(id))
      .filter((v): v is CareerPlayerView => v !== null && (imports || v.region === region))
      .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));

  for (const x of plan) {
    const org = next.orgs[x.ref];
    const before = ratings.get(org.ref) ?? 0;
    const signed: RivalProject["signed"] = [];
    const buys = x.continued ? P.topUpBuys : imports ? P.maxBuys : P.buysBase;
    for (const v of poolFor(org, x.region)) {
      if (signed.length >= buys) break;
      let weakest = 0;
      org.playerIds.forEach((id, i) => {
        if ((viewOf(id)?.overall ?? 0) < (viewOf(org.playerIds[weakest])?.overall ?? 0)) weakest = i;
      });
      const out = org.playerIds[weakest];
      if (v.overall < (viewOf(out)?.overall ?? 0) + P.minEdge) break; // the pool is sorted: nobody further helps
      const at = seatOf.get(v.id);
      if (at) {
        const from = next.orgs[at.ref];
        if (at.bench) from.reserveIds = (from.reserveIds ?? []).map((id) => (id === v.id ? out : id));
        else from.playerIds = from.playerIds.map((id) => (id === v.id ? out : id)) as [string, string, string];
        seatOf.set(out, at);
      } else {
        next.freeAgentIds = next.freeAgentIds.map((id) => (id === v.id ? out : id));
        seatOf.delete(out);
      }
      org.playerIds[weakest] = v.id;
      seatOf.set(v.id, { ref: org.ref, bench: false });
      // Off their script from here, like any AI move.
      for (const id of [v.id, out]) if (!(id in next.overallDelta)) next.overallDelta[id] = 0;
      taken.add(v.id);
      signed.push({ playerId: v.id, playerName: v.name, fromRef: at?.ref ?? null, fromName: at ? (next.orgs[at.ref]?.name ?? null) : null, outId: out });
    }
    if (!x.continued && signed.length === 0) continue;
    // The coach: the region's best AI coach, a swap with his org (the user hires from the coach market).
    if (items.includes("coach")) {
      const best = Object.values(next.orgs)
        .filter((o) => o.region === x.region && !projectRefs.has(o.ref) && (o.coachOverall ?? 0) > (org.coachOverall ?? 0))
        .sort((a, b) => (b.coachOverall ?? 0) - (a.coachOverall ?? 0) || a.ref.localeCompare(b.ref))[0];
      if (best) {
        const mine = { coachOverall: org.coachOverall, coachAge: org.coachAge, coachSince: org.coachSince };
        org.coachOverall = best.coachOverall;
        org.coachAge = best.coachAge;
        org.coachSince = ctx.seasonIndex;
        best.coachOverall = mine.coachOverall;
        best.coachAge = mine.coachAge;
        best.coachSince = ctx.seasonIndex;
      }
    }
    // The bench: a reserve who plays the sub's part, like the user's; signed from free agency when there is none.
    if (items.includes("bench") && !(org.reserveIds ?? []).length) {
      const fa = next.freeAgentIds
        .filter((id) => !user.has(id) && !taken.has(id))
        .map((id) => viewOf(id))
        .filter((v): v is CareerPlayerView => v !== null && (imports || v.region === x.region))
        .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
      if (fa) {
        next.freeAgentIds = next.freeAgentIds.filter((id) => id !== fa.id);
        org.reserveIds = [fa.id];
        seatOf.set(fa.id, { ref: org.ref, bench: true });
        taken.add(fa.id);
        if (!(fa.id in next.overallDelta)) next.overallDelta[fa.id] = 0;
      }
    }
    org.projectKit = { since: x.since, items: [...items] };
    next.version += 1;
    const after = matchRating(orgTeamFor(org.ref, { ...teamCtx, world: next }));
    projects.push({
      season: ctx.seasonIndex,
      since: x.since,
      orgRef: org.ref,
      orgName: org.name,
      region: x.region,
      signed,
      items: [...items],
      ratingBefore: round1(before),
      ratingAfter: round1(after),
    });
  }
  return { world: projects.length ? next : world, projects, gap, leader, strength };
}

/**
 * M2.1 in a long dynasty: the new elite generation's ceiling is lifted a
 * little (new promotions only; nobody already promoted moves).
 */
export function eliteBonusFor(streak: { titles: number }, seasonIndex: number): number {
  if (!FEATURES.endlessVariety || !endlessYear(seasonIndex)) return 0;
  const B = E.eliteGeneration;
  return streak.titles >= B.fromTitles ? Math.min(B.max, (streak.titles - B.fromTitles + 1) * B.perTitle) : 0;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Lever (c): during a user dynasty a rival project bids for one of the
 * user's stars, through the ordinary bid decision (refusable like any bid).
 * At most one a window (the caller tracks it), on a per-day roll. The fee is
 * the ordinary AI bid at the top of its range (a rich project). Null = no bid.
 */
export function projectBidFor(ctx: {
  squad: readonly SquadPlayer[];
  projects: readonly RivalProject[];
  seasonIndex: number;
  windowIdx: number;
  day: number;
  careerSeed: number;
  growthModel: number;
  pendingTargetIds: readonly string[];
  /** The user's consecutive Worlds titles going into the season (the dynasty). */
  userTitles: number;
}): TransferOffer | null {
  const B = E.projectBid;
  if (!FEATURES.endlessVariety || ctx.userTitles < B.fromTitles || ctx.projects.length === 0) return null;
  if (derivedFloat(ctx.careerSeed, streams.gen("endlessBidDay", `${ctx.seasonIndex}:${ctx.day}`)) >= B.dailyChance) return null;
  const pending = new Set(ctx.pendingTargetIds);
  const target = ctx.squad
    .filter((p) => p.role === "starter" && !pending.has(p.id) && !resaleLocked(p, ctx.seasonIndex, ctx.day))
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
  if (!target) return null;
  const bidder = [...ctx.projects].sort((a, b) => b.ratingAfter - a.ratingAfter || a.orgRef.localeCompare(b.orgRef))[0];
  const input = valueInputOf(target, ctx.careerSeed, ctx.seasonIndex, ctx.growthModel);
  const fee = quantize(marketValueFor(input) * bidPremiumFor(input) * CAREER_TRANSFER.aiBidRange[1]);
  return {
    id: `bid:${ctx.seasonIndex}:${ctx.day}:${target.id}`,
    direction: "out",
    playerId: target.id,
    playerName: target.name,
    fee,
    salaryPerSplit: 0,
    lengthSeasons: 2,
    role: "starter",
    otherRef: bidder.orgRef,
    status: "pending",
    resolveSeason: ctx.seasonIndex,
    resolveDay: windowCloseDayFor(ctx.windowIdx as 0 | 1 | 2 | 3),
    factors: [],
  };
}

// ---------------------------------------------------------------------------
// Cups: the Invitational's field and the bracket draw
// ---------------------------------------------------------------------------

/**
 * The Invitational's seven AI guests: the top `keepTop` of the points table
 * always, the rest drawn from the next `poolSize − keepTop` by the event's id.
 * Shared by fieldForEvent and the lobby so "The field" lists who plays.
 */
export function invitationalGuests(rankedByPoints: readonly string[], def: Pick<CareerEventDef, "id">, careerSeed: number, seats: number): string[] {
  const C = E.cups;
  const keep = rankedByPoints.slice(0, Math.min(C.keepTop, seats));
  const rest = rankedByPoints
    .slice(keep.length, C.poolSize)
    .map((ref) => ({ ref, k: f(careerSeed, "endlessCup", `${def.id}:${ref}`) }))
    .sort((a, b) => a.k - b.k || a.ref.localeCompare(b.ref))
    .map((x) => x.ref);
  return [...keep, ...rest].slice(0, seats);
}

/**
 * The t2 field's seven guests (fieldForEvent and the lobby): the Legends
 * lineups (as `legend:` refs), the drawn Invitational guests, or (the front
 * off, or a plain def) the points table's top seven as before.
 */
export function invitationalRefsFor(
  def: Pick<CareerEventDef, "id" | "endless">,
  careerSeed: number,
  ranked: readonly string[],
  seats: number,
  /** The Intercontinental's guests: another region's points order (fieldForEvent and the lobby pass the same). */
  rankedIn?: (region: Region) => readonly string[],
  homeRegion?: Region,
): string[] {
  if (FEATURES.endlessVariety && def.endless === "world" && rankedIn) {
    const pool = (E.world.regions as readonly Region[])
      .filter((r) => r !== homeRegion)
      .flatMap((r) => rankedIn(r).slice(0, E.world.perRegion));
    const drawn = pool
      .map((ref) => ({ ref, k: f(careerSeed, "endlessWorld", `${def.id}:${ref}`) }))
      .sort((a, b) => a.k - b.k || a.ref.localeCompare(b.ref))
      .map((x) => x.ref);
    if (drawn.length >= seats) return drawn.slice(0, seats);
  }
  if (FEATURES.endlessVariety && def.endless === "legends") return legendLineupIdsFor(def, careerSeed).slice(0, seats).map((id) => `${LEGEND_REF_PREFIX}${id}`);
  if (FEATURES.endlessVariety && def.endless === "cup") return invitationalGuests(ranked, def, careerSeed, seats);
  return ranked.slice(0, seats);
}

/**
 * The single-elimination seed order for an 8-team cup: the two best ratings
 * stay seeds 1 and 2 (opposite halves), 3–4 and 5–8 are drawn inside their
 * pots by the event's id, so the path to a final changes from cup to cup.
 */
export function cupDrawSeeds(teams: Record<string, TournamentTeam>, def: Pick<CareerEventDef, "id">, careerSeed: number): string[] {
  const byRating = Object.keys(teams).sort((a, b) => teams[b].rating.total - teams[a].rating.total);
  const draw = (pot: string[]) =>
    pot.map((id) => ({ id, k: f(careerSeed, "endlessDraw", `${def.id}:${id}`) })).sort((a, b) => a.k - b.k || a.id.localeCompare(b.id)).map((x) => x.id);
  return [...byRating.slice(0, 2), ...draw(byRating.slice(2, 4)), ...draw(byRating.slice(4))];
}

// ---------------------------------------------------------------------------
// Legends invitational
// ---------------------------------------------------------------------------

export const LEGEND_REF_PREFIX = "legend:";
export const isLegendRef = (ref: string) => ref.startsWith(LEGEND_REF_PREFIX);

/** A roster's peak card per player: the special the dataset made of that lineup's card, when there is one. */
let peakByBase: Map<string, { id: string; overall: number }> | null = null;
function peakSpecialOf(cardId: string): string | undefined {
  if (!peakByBase) {
    peakByBase = new Map();
    for (const sp of specialCards) {
      const b = peakByBase.get(sp.baseCardId);
      if (!b || sp.overall > b.overall || (sp.overall === b.overall && sp.id < b.id)) peakByBase.set(sp.baseCardId, sp);
    }
  }
  return peakByBase.get(cardId)?.id;
}

/**
 * A Legends side: the real lineup, each player on that roster's own special
 * card where the dataset has one (its peak), with its coach and sub. The
 * Legends play at their real level on Normal and Hard (no AI shift); Easy
 * applies its usual AI shift. The career's AI chemistry cap and form roll apply.
 */
export function legendTeamFor(lineupId: string, difficulty: CareerDifficulty): TournamentTeam {
  const l = lineupById.get(lineupId)!;
  const profile = careerMatchProfile(difficulty);
  const coach = l.coachId ? coachById.get(l.coachId) : undefined;
  const sub = l.subId ? subById.get(l.subId) : undefined;
  const year = CAREER_SEASONS.find((s) => s.seasonId === l.seasonId)?.year ?? seasonById.get(l.seasonId)?.shortLabel;
  const specials = l.playerCardIds.map((id) => peakSpecialOf(id));
  return assembleTournamentTeam({
    id: `${LEGEND_REF_PREFIX}${l.id}`,
    name: year ? `${l.name} ${year}` : l.name,
    isUser: false,
    region: l.region,
    lineupId: l.id,
    players: l.playerCardIds.map((id, i) => playerMemberFromPick(id, specials[i])),
    coach: coach
      ? { name: coach.name, overall: coach.overall, bonusType: coach.bonusType, bonusLevel: coach.bonusLevel, lineupId: coach.lineupId, orgId: coach.orgId, country: coach.country, region: coach.region }
      : undefined,
    sub: sub ? { name: sub.name, overall: sub.overall, lineupId: sub.lineupId, orgId: sub.orgId, country: sub.country, region: sub.region } : undefined,
    orgId: l.orgId,
    orgBuffLevel: l.orgBuffLevel,
    specialIds: specials.filter((x): x is string => !!x),
    difficulty,
    difficultyShift: difficulty === "easy" ? profile.opponentRatingShift : 0,
    chemistryMaxBonus: profile.opponentChemistryMaxBonus,
    rollRange: profile.aiRollRange,
  });
}

/** The all-time rosters a Legends field is drawn from: the dataset's best by their peak team rating, nationals excluded. */
let legendPool: { id: string; rating: number }[] | null = null;
function legendLineups(): { id: string; rating: number }[] {
  if (legendPool) return legendPool;
  const rows: { id: string; rating: number }[] = [];
  for (const l of lineups) {
    if (l.national || l.playerCardIds.length !== 3) continue;
    rows.push({ id: l.id, rating: legendTeamFor(l.id, "normal").rating.total });
  }
  legendPool = rows.sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).slice(0, E.legends.poolSize);
  return legendPool;
}

/** The event's seven Legends, one lineup per org, drawn from the pool by the event id. */
export function legendLineupIdsFor(def: Pick<CareerEventDef, "id">, careerSeed: number): string[] {
  const seenOrg = new Set<string>();
  const out: string[] = [];
  const drawn = legendLineups()
    .map((x) => ({ ...x, k: f(careerSeed, "endlessLegend", `${def.id}:${x.id}`) }))
    .sort((a, b) => a.k - b.k || a.id.localeCompare(b.id));
  for (const x of drawn) {
    const org = lineupById.get(x.id)?.orgId ?? x.id;
    if (seenOrg.has(org)) continue;
    seenOrg.add(org);
    out.push(x.id);
    if (out.length >= 7) break;
  }
  return out;
}

/** Is this open week a Legends week for the save (endless year, strong enough team, the season's slot)? */
export function legendsWeekFor(seasonIndex: number, week: number, careerSeed: number, openWeeks: readonly number[]): boolean {
  if (!endlessYear(seasonIndex) || openWeeks.length === 0) return false;
  const L = E.legends;
  const picks = new Set<number>();
  const ordered = openWeeks
    .map((w) => ({ w, k: f(careerSeed, "endlessLegendsWeek", `${seasonIndex}:${w}`) }))
    .sort((a, b) => a.k - b.k || a.w - b.w);
  for (const x of ordered.slice(0, L.perSeason)) picks.add(x.w);
  return picks.has(week);
}

/** Is this open week an Intercontinental week (endless year, not a Legends week, the season's draw)? */
export function worldWeekFor(seasonIndex: number, week: number, careerSeed: number, openWeeks: readonly number[]): boolean {
  if (!endlessYear(seasonIndex)) return false;
  const free = openWeeks.filter((w) => !legendsWeekFor(seasonIndex, w, careerSeed, openWeeks));
  const picks = free
    .map((w) => ({ w, k: f(careerSeed, "endlessWorldWeek", `${seasonIndex}:${w}`) }))
    .sort((a, b) => a.k - b.k || a.w - b.w)
    .slice(0, E.world.perSeason)
    .map((x) => x.w);
  return picks.includes(week);
}

// ---------------------------------------------------------------------------
// Season rules (the season's identity, drawn by seed)
// ---------------------------------------------------------------------------

/** The season's three Major hosts (indexes into the copy's city list), drawn without repeats; stable per season. */
export function majorHostsFor(seasonIndex: number, careerSeed: number, cities: number): number[] {
  const order = Array.from({ length: cities }, (_, i) => i)
    .map((i) => ({ i, k: f(careerSeed, "endlessHost", `${seasonIndex}:${i}`) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.i);
  return order.slice(0, 4); // three Majors + the Worlds host
}

/**
 * Polish: the project records a save keeps after a rollover: last season's
 * (who rests) and this season's, one entry per org. An org that carries on
 * keeps only its newest record, so an org never shows twice (one org runs one
 * project at a time).
 */
export function projectRecordsAfter(running: readonly RivalProject[], fresh: readonly RivalProject[]): RivalProject[] {
  const now = new Set(fresh.map((p) => p.orgRef));
  return [...running.filter((r) => !now.has(r.orgRef)), ...fresh];
}
