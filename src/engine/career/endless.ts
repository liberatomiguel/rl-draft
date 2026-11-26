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
import { CAREER_ENDLESS as E, CAREER_GEAR, CAREER_SEASONS, FEATURES } from "@/config/balance";
import { coachById, lineupById, lineups, seasonById, specialCards, subById } from "@/data";
import { assembleTournamentTeam, playerMemberFromPick } from "@/engine/teams";
import type { Region, TournamentTeam } from "../types";
import { playerViewById } from "./development";
import { careerMatchProfile } from "./difficulty";
import { derivedFloat, streams } from "./seeds";
import type { CareerDifficulty, CareerEventDef, CareerPlayerView, EndlessState, RivalProject, WorldOrgState, WorldState } from "./types";
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

type Ctx = {
  careerSeed: number;
  seasonIndex: number;
  difficulty: CareerDifficulty;
  userSquadIds: readonly string[];
  /** The user's team rating (userSeedRatingFor), on the orgs' intrinsic scale. */
  userRating: number;
  userRegion: Region;
  /** Orgs that ran a project last season (they sit this one out: projects rotate). */
  lastProjectRefs: readonly string[];
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

/** Projects this season for a dominance gap: 0 below the floor, then one per step, capped. */
export function projectLevelFor(gap: number): number {
  const P = E.projects;
  if (gap < P.dominanceFloor) return 0;
  return Math.min(P.maxProjects, 1 + Math.floor((gap - P.dominanceFloor) / P.dominanceStep));
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
 * returns the new world and the projects (for the news and the next season's
 * rotation). The user's squad is never read for a signing and never touched.
 */
export function rivalProjectsPass(input: WorldState, ctx: Ctx): { world: WorldState; projects: RivalProject[]; gap: number; leader: string | null } {
  const P = E.projects;
  // Last season's performance centres close first (a project that runs again reopens its own below).
  let world = input;
  if (Object.values(input.orgs).some((o) => o.projectBonus)) {
    world = cloneOrgs(input);
    for (const o of Object.values(world.orgs)) delete o.projectBonus;
    world.version += 1;
  }
  const teamCtx = { world, seasonIndex: ctx.seasonIndex, careerSeed: ctx.careerSeed, difficulty: ctx.difficulty };
  const ratings = new Map<string, number>();
  for (const ref of Object.keys(world.orgs).sort()) ratings.set(ref, matchRating(orgTeamFor(ref, teamCtx)));
  const { leader, gap } = dominanceOf([{ id: "user", rating: ctx.userRating }, ...[...ratings].map(([id, rating]) => ({ id, rating }))]);
  // An AI leader is answered only from a bigger lead (an ordinary career is barely touched).
  const level = leader === "user" || gap >= P.aiLeaderFloor ? projectLevelFor(gap) : 0;
  if (level === 0 || !endlessYear(ctx.seasonIndex)) return { world, projects: [], gap, leader };

  // Where the answer comes from: the leader's region first, then the others in a seeded order.
  const leaderRegion: Region | undefined = leader === "user" ? ctx.userRegion : leader ? world.orgs[leader]?.region : undefined;
  const others = (P.regions as readonly Region[])
    .filter((r) => r !== leaderRegion)
    .map((r) => ({ r, k: f(ctx.careerSeed, "endlessRegion", `${ctx.seasonIndex}:${r}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  const regions = [...(leaderRegion && (P.regions as readonly Region[]).includes(leaderRegion) ? [leaderRegion] : []), ...others].slice(0, level);
  const buys = Math.min(P.maxBuys, P.buysBase + Math.floor((level - 1) / 2) + (gap >= P.importGap ? 1 : 0));
  const imports = gap >= P.importGap;

  const next = cloneOrgs(world);
  const view = { careerSeed: ctx.careerSeed, seasonIndex: ctx.seasonIndex, world: next };
  const viewCache = new Map<string, CareerPlayerView | null>();
  const viewOf = (id: string) => {
    if (!viewCache.has(id)) viewCache.set(id, playerViewById(id, view));
    return viewCache.get(id) ?? null;
  };
  const user = new Set(ctx.userSquadIds);
  const last = new Set(ctx.lastProjectRefs);
  const taken = new Set<string>(); // players a project signed this pass: nobody takes them again
  const projectRefs = new Set<string>();
  const projects: RivalProject[] = [];

  for (const region of regions) {
    const candidates = Object.values(next.orgs)
      .filter((o) => o.region === region && o.ref !== leader && !last.has(o.ref) && !projectRefs.has(o.ref))
      .sort((a, b) => (ratings.get(b.ref) ?? 0) - (ratings.get(a.ref) ?? 0) || a.ref.localeCompare(b.ref))
      .slice(0, P.candidateOrgs);
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(f(ctx.careerSeed, "endlessProject", `${ctx.seasonIndex}:${region}`) * candidates.length)];
    const org = next.orgs[pick.ref];
    projectRefs.add(org.ref);
    const before = ratings.get(org.ref) ?? 0;
    const signed: RivalProject["signed"] = [];

    // Where every AI player sits: an org's starter or reserve seat, or free agency.
    const seatOf = new Map<string, { ref: string; bench: boolean }>();
    for (const o of Object.values(next.orgs)) {
      o.playerIds.forEach((id) => seatOf.set(id, { ref: o.ref, bench: false }));
      for (const id of o.reserveIds ?? []) seatOf.set(id, { ref: o.ref, bench: true });
    }
    const pool = [...seatOf.keys(), ...next.freeAgentIds]
      .filter((id) => !user.has(id) && !taken.has(id) && !org.playerIds.includes(id))
      .filter((id) => {
        const at = seatOf.get(id);
        return !at || !projectRefs.has(at.ref);
      })
      .map((id) => viewOf(id))
      .filter((v): v is CareerPlayerView => v !== null && (imports || v.region === region))
      .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));

    for (const v of pool) {
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
    // Financing: the project hires the best coach of its region (a swap with that org).
    if (P.coachSwap) {
      const best = Object.values(next.orgs)
        .filter((o) => o.region === region && o.ref !== org.ref && !projectRefs.has(o.ref) && (o.coachOverall ?? 0) > (org.coachOverall ?? 0))
        .sort((a, b) => (b.coachOverall ?? 0) - (a.coachOverall ?? 0) || a.ref.localeCompare(b.ref))[0];
      if (best && signed.length > 0) {
        const mine = { coachOverall: org.coachOverall, coachAge: org.coachAge, coachSince: org.coachSince };
        org.coachOverall = best.coachOverall;
        org.coachAge = best.coachAge;
        org.coachSince = ctx.seasonIndex;
        best.coachOverall = mine.coachOverall;
        best.coachAge = mine.coachAge;
        best.coachSince = ctx.seasonIndex;
      }
    }
    if (signed.length === 0) continue;
    const facility = level >= P.facilityFromLevel ? PERF_CENTER_BONUS : 0;
    if (facility > 0) org.projectBonus = facility;
    next.version += 1;
    const after = matchRating(orgTeamFor(org.ref, { ...teamCtx, world: next }));
    projects.push({ season: ctx.seasonIndex, orgRef: org.ref, orgName: org.name, region, signed, facility, ratingBefore: round1(before), ratingAfter: round1(after) });
  }
  if (projects.length === 0) return { world, projects, gap, leader };
  return { world: next, projects, gap, leader };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
/** The user's performance centre's team-rating bonus: a project's money buys the same. */
const PERF_CENTER_BONUS = CAREER_GEAR.items.find((i) => i.id === "perfCenter")?.ratingBonus ?? 0;

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
 * Legends play at their real level on every difficulty (no AI shift); the
 * career's AI chemistry cap and form roll apply.
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
    difficultyShift: 0,
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
