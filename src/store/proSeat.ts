/**
 * v2.2 Pro spine round 2 (PROSPINE, R-PROSPINE-6): the org's seat.
 *
 * While the Pro is under contract his org takes the hidden host's "user"
 * seat, so its official series are the host's own and he PLAYS them (the
 * Matchday series engine, one decision a game). The org leaves `world.orgs`
 * for the stint and its record moves with it: its split and season points,
 * its places in the week's seeding, the qualified lists and the Major /
 * Worlds fields are read under "user". Its players are the host squad
 * (`pro:self` among them, never on a world roster at the same time). The AI
 * coach keeps the lineup (lineup.ts scores); the host's money and manager
 * decisions stay inert.
 *
 * When the stint ends (a move, the end of the deal, retirement) or at every
 * season rollover (the world, the dataset and Mundo vivo roll the org as
 * their own), the org goes back into the world in the same ref with the
 * players it has now, their growth written as world drift, and its record
 * back under its ref. Nobody else in the world sees a difference: there is
 * no filler, no second copy, no renamed side.
 *
 * Unlike the board front's seat swap (v22/board, `seatSwap.takeOrgSeat`,
 * which replaces the org by a filler for good), the stint here is temporary
 * and reversible, so it is done here, in the Pro's own module.
 */

import { CAREER_PRO_ORG, CAREER_WORLD_LIFE } from "@/config/balance";
import { playerViewById, seasonYear } from "@/engine/career/development";
import { proLineupScore } from "@/engine/career/pro/lineup";
import { proSquadPlayer } from "@/engine/career/pro/team";
import type { ProSave } from "@/engine/career/pro/types";
import { PRO_SELF_ID } from "@/engine/career/pro/world";
import type { CareerSave, CompetitionState, SquadPlayer } from "@/engine/career/types";
import { syncSquadRoles } from "./careerFlow";
import { hostOf, storeHost } from "./proFlow";

type Ctx = { careerSeed: number; seasonIndex: number };


/** Every reference to `from` in the competition record, under `to` (points add up; a list keeps one entry). */
export function remapCompetitionRef(c: CompetitionState, from: string, to: string): CompetitionState {
  const table = (t: Record<string, Record<string, number>> | undefined) => {
    if (!t) return t;
    const out: Record<string, Record<string, number>> = {};
    for (const [region, rows] of Object.entries(t)) {
      if (!(from in rows)) {
        out[region] = rows;
        continue;
      }
      const { [from]: moved, ...rest } = rows;
      out[region] = { ...rest, [to]: (rest[to] ?? 0) + moved };
    }
    return out;
  };
  const list = (refs: string[] | null | undefined) => {
    if (!refs || !refs.includes(from)) return refs;
    const mapped = refs.map((r) => (r === from ? to : r));
    return mapped.filter((r, i) => mapped.indexOf(r) === i);
  };
  const qualified = c.qualifiedRefs
    ? Object.fromEntries(Object.entries(c.qualifiedRefs).map(([r, q]) => [r, q ? { ...q, refs: list(q.refs) ?? q.refs } : q]))
    : c.qualifiedRefs;
  return {
    ...c,
    splitPoints: table(c.splitPoints as Record<string, Record<string, number>>) as CompetitionState["splitPoints"],
    seasonPoints: table(c.seasonPoints as Record<string, Record<string, number>>) as CompetitionState["seasonPoints"],
    qualifiedRefs: qualified as CompetitionState["qualifiedRefs"],
    majorFieldRefs: list(c.majorFieldRefs) ?? c.majorFieldRefs,
    worldsFieldRefs: list(c.worldsFieldRefs) ?? c.worldsFieldRefs,
    weekSeeding: c.weekSeeding ? { ...c.weekSeeding, direct: list(c.weekSeeding.direct)!, rest: list(c.weekSeeding.rest)! } : c.weekSeeding,
  };
}

function squadPlayerOf(id: string, ctx: Ctx & { world: CareerSave["world"] }, starter: boolean): SquadPlayer | null {
  const v = playerViewById(id, ctx);
  if (!v) return null;
  return {
    id: v.id,
    kind: v.kind,
    name: v.name,
    country: v.country,
    region: v.region,
    birthYear: seasonYear(ctx.seasonIndex) - v.age,
    archetype: v.archetype,
    overall: v.overall,
    attrOffsets: v.attrOffsets,
    potential: v.potential,
    peakAge: v.peakAge,
    declineRate: v.declineRate,
    role: starter ? "starter" : "sub",
    salaryPerSplit: 0,
    prizeSharePct: 0,
    contractEndSeason: ctx.seasonIndex + 99,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel: 2,
    splitsTogether: 0,
    joinedSeason: ctx.seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  };
}

export const isOrgSeated = (save: ProSave): boolean => Boolean(save.orgShell);

/**
 * The org takes the host seat. Requires `pro:self` on its world roster (the
 * signing placed him) and no event in progress. The same save back when it
 * cannot (the org is gone, a player does not resolve).
 */
export function seatOrgOnHost(save: ProSave): ProSave {
  if (save.orgShell || save.stage !== "org" || !save.contract) return save;
  const host = hostOf(save);
  const ref = save.contract.orgRef;
  const org = save.world.orgs[ref];
  if (!host || !org || host.activeEvent) return save;
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const ids = [...org.playerIds, ...(org.reserveIds ?? [])];
  if (!ids.includes(PRO_SELF_ID)) return save;
  const squad: SquadPlayer[] = [];
  const liftedOverall: Record<string, number> = {};
  for (const id of ids) {
    const starter = org.playerIds.includes(id);
    if (id === PRO_SELF_ID) {
      squad.push({ ...proSquadPlayer(save.player, save.clock.seasonIndex), role: starter ? "starter" : "sub" });
      continue;
    }
    const p = squadPlayerOf(id, ctx, starter);
    if (!p) return save;
    liftedOverall[id] = p.overall;
    squad.push(p);
  }
  const { [ref]: _gone, ...orgs } = save.world.orgs;
  void _gone;
  const world = { ...save.world, orgs, version: save.world.version + 1 };
  const competition = remapCompetitionRef(save.competition, ref, "user");
  const h: CareerSave = {
    ...host,
    world,
    competition,
    squad,
    starterIds: [org.playerIds[0], org.playerIds[1], org.playerIds[2]],
    identity: { ...host.identity, orgName: org.name, abbrev: org.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "ORG" },
    reputation: 15 + org.prestige * 20,
    // Its coach comes with it (orgTeamFor's thresholds: 85 "++", 75 "+"), so the seat plays as the org did.
    coach:
      org.coachOverall !== undefined
        ? {
            id: `seat:${ref}`,
            name: org.name,
            overall: org.coachOverall,
            bonusType: "consistency",
            bonusLevel: org.coachOverall >= 85 ? "++" : org.coachOverall >= 75 ? "+" : "~",
            salaryPerSplit: 0,
            source: "generated",
          }
        : null,
    prefs: { ...host.prefs, autoEnterUnofficials: false },
    unofficialOffer: null,
    pendingEventDef: host.pendingEventDef && (host.pendingEventDef.tier === "t3" || host.pendingEventDef.tier === "t2") ? null : host.pendingEventDef,
  };
  syncSquadRoles(h);
  return { ...storeHost(save, h), orgShell: { org: { ...org, playerIds: ["", "", ""], reserveIds: [] }, liftedOverall } };
}

/**
 * The org goes back into the world in its ref with the players it has now
 * (their host growth written as world drift). `keepPro`: he stays on its
 * roster (the season rollover); otherwise he leaves it (a move, the end of
 * the deal, retirement) and his seat is refilled from the bench or the
 * region's free agents. The host squad is the Pro alone again.
 */
export function unseatOrgFromHost(save: ProSave, keepPro: boolean): ProSave {
  const shell = save.orgShell;
  const host = hostOf(save);
  if (!shell || !host || host.activeEvent) return save;
  const ref = shell.org.ref;
  const world = { ...save.world, orgs: { ...save.world.orgs }, freeAgentIds: [...save.world.freeAgentIds], overallDelta: { ...save.world.overallDelta } };
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world };
  for (const p of host.squad) {
    if (p.id === PRO_SELF_ID || shell.liftedOverall[p.id] === undefined) continue;
    const drift = p.overall - shell.liftedOverall[p.id];
    if (drift !== 0) world.overallDelta[p.id] = Math.round(((world.overallDelta[p.id] ?? 0) + drift) * 100) / 100;
  }
  const inSquad = (id: string) => host.squad.some((p) => p.id === id);
  let starters = host.starterIds.filter((id) => id && inSquad(id) && (keepPro || id !== PRO_SELF_ID));
  const bench = host.squad.map((p) => p.id).filter((id) => !starters.includes(id) && (keepPro || id !== PRO_SELF_ID));
  const ovr = (id: string) => (id === PRO_SELF_ID ? 0 : (playerViewById(id, ctx)?.overall ?? 0));
  bench.sort((a, b) => ovr(b) - ovr(a) || a.localeCompare(b));
  while (starters.length < 3 && bench.length > 0) starters = [...starters, bench.shift()!];
  while (starters.length < 3) {
    const fa = world.freeAgentIds
      .filter((id) => id !== PRO_SELF_ID && playerViewById(id, ctx)?.region === shell.org.region)
      .sort((a, b) => ovr(b) - ovr(a) || a.localeCompare(b))[0];
    if (!fa) break;
    world.freeAgentIds = world.freeAgentIds.filter((id) => id !== fa);
    starters = [...starters, fa];
  }
  const cap = CAREER_WORLD_LIFE.scouting.reserveSlots + (keepPro && bench.includes(PRO_SELF_ID) ? 1 : 0);
  const keepBench: string[] = [...bench.filter((id) => id === PRO_SELF_ID), ...bench.filter((id) => id !== PRO_SELF_ID)].slice(0, cap);
  for (const id of bench) if (!keepBench.includes(id) && !world.freeAgentIds.includes(id)) world.freeAgentIds.push(id);
  world.orgs[ref] = { ...shell.org, playerIds: [starters[0], starters[1], starters[2]] as [string, string, string], reserveIds: keepBench };
  world.version += 1;
  const competition = remapCompetitionRef(save.competition, "user", ref);
  const me = host.squad.find((p) => p.id === PRO_SELF_ID) ?? proSquadPlayer(save.player, save.clock.seasonIndex);
  const h: CareerSave = {
    ...host,
    world,
    competition,
    squad: [{ ...me, role: "starter" }],
    starterIds: [PRO_SELF_ID, "", ""],
    coach: null,
    identity: { ...host.identity, orgName: save.player.name },
    pendingEventDef: null,
    pendingUnavailability: null,
  };
  syncSquadRoles(h);
  return { ...storeHost(save, h), orgShell: null };
}

/** Does he start on the host seat now. */
export function proStartsOnSeat(save: ProSave): boolean {
  const host = hostOf(save);
  return Boolean(host?.starterIds.includes(PRO_SELF_ID));
}

/**
 * The coach's lineup on the seat: the three best by lineup score start (the
 * Pro's score reads his form and the trust; the others their overall).
 */
export function decideSeatLineup(save: ProSave): { save: ProSave; starts: boolean; changed: boolean } {
  const host = hostOf(save);
  if (!host || !save.orgShell || host.activeEvent) return { save, starts: proStartsOnSeat(save), changed: false };
  const proScore = proLineupScore(save.player, save.matchLog, save.coachTrust ?? CAREER_PRO_ORG.trustStart);
  const score = (p: SquadPlayer) => (p.id === PRO_SELF_ID ? proScore : p.overall);
  const current = host.starterIds;
  const ranked = [...host.squad].sort((a, b) => score(b) - score(a) || current.indexOf(b.id) - current.indexOf(a.id));
  const top = ranked.slice(0, 3).map((p) => p.id);
  const starts = top.includes(PRO_SELF_ID);
  if (current.every((id) => top.includes(id))) return { save, starts, changed: false };
  const seats = [...current] as [string, string, string];
  const incoming = top.filter((id) => !seats.includes(id));
  for (let i = 0; i < 3; i++) if (!top.includes(seats[i])) seats[i] = incoming.shift()!;
  const h = { ...host, starterIds: seats };
  syncSquadRoles(h);
  return { save: storeHost(save, h), starts, changed: true };
}

/** Swaps the Pro and `otherId` between the bench and the court on the seat (a rotation week and its end). */
export function swapOnSeat(save: ProSave, outId: string, inId: string): ProSave {
  const host = hostOf(save);
  if (!host || host.activeEvent || !host.starterIds.includes(outId) || host.starterIds.includes(inId)) return save;
  const h = { ...host, starterIds: host.starterIds.map((id) => (id === outId ? inId : id)) as [string, string, string] };
  syncSquadRoles(h);
  return storeHost(save, h);
}
