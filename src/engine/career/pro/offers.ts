/**
 * v2.2 Pro spine (PROSPINE, slice 4, PRO-SPEC §7.3): what orgs offer the Pro
 * and how a signing changes a real roster.
 *
 * Offers come in the transfer windows from real orgs of his region. Each one
 * is decided ONCE, the window's first Monday, and stored on the save: an
 * offer shown never changes on re-open, and it expires with the window. The
 * value an org reads is his overall, his recent ratings, his fans and his
 * age; the written reason quotes the one that weighed most (numbers from the
 * save, never invented).
 *
 * Signing puts `pro:self` in the org's `playerIds` (a promised start: the
 * weakest starter steps aside) or `reserveIds` (rotation). The displaced
 * player follows the world-life rules: the org's bench while Mundo vivo
 * runs and a bench seat is free, otherwise free agency. `pro:self` is first
 * taken out of every roster, so he can never be on two.
 */

import { CAREER_PRO_ORG, CAREER_WORLD_LIFE } from "@/config/balance";
import { clamp } from "@/lib/util";
import { quantize } from "../economy";
import { ageOf, playerViewById } from "../development";
import { derivedFloat } from "../seeds";
import type { WorldOrgState, WorldState } from "../types";
import { worldLifeOn } from "../worldLife";
import { proOverall, round2 } from "./attrs";
import type { ProMatchLogEntry, ProOffer, ProOfferReason, ProRole } from "./spineTypes";
import type { ProSave } from "./types";
import { PRO_SELF_ID } from "./world";

type ViewCtx = { careerSeed: number; seasonIndex: number; world: WorldState };

/** His recent form: the mean rating of the last `window` series he played (null = none yet). */
export function recentFormOf(log: readonly ProMatchLogEntry[] | undefined, window: number): { avg: number | null; n: number; won: number } {
  const recent = (log ?? []).slice(-window);
  if (recent.length === 0) return { avg: null, n: 0, won: 0 };
  const avg = Math.round((recent.reduce((s, e) => s + e.rating, 0) / recent.length) * 10) / 10;
  return { avg, n: recent.length, won: recent.filter((e) => e.won).length };
}

/** The Pro's market value (CAREER_PRO_ORG: overall, form, fans, youth). */
export function proValueOf(save: Pick<ProSave, "player" | "clock">, form: { avg: number | null }): number {
  const O = CAREER_PRO_ORG;
  const age = ageOf(save.player.birthYear, save.clock.seasonIndex);
  const value =
    proOverall(save.player.attrs) +
    O.formWeight * ((form.avg ?? 6) - 6) +
    O.fameWeight * Math.log10(1 + Math.max(0, save.player.fame)) +
    O.youthWeight * Math.max(0, 20 - age);
  return round2(value);
}

const overallOf = (id: string, ctx: ViewCtx): number => playerViewById(id, ctx)?.overall ?? 60;

/** The org's bar: its weakest starter who is not the Pro. */
export function orgBarOf(org: WorldOrgState, ctx: ViewCtx): number {
  const others = org.playerIds.filter((id) => id !== PRO_SELF_ID);
  if (others.length === 0) return 60;
  return Math.min(...others.map((id) => overallOf(id, ctx)));
}

/** The org's strength as the screens show it (its starters' mean, or its rating snapshot). */
export function orgLevelOf(org: WorldOrgState, ctx: ViewCtx): number {
  const ids = org.playerIds;
  return round2(ids.reduce((s, id) => s + overallOf(id, ctx), 0) / Math.max(1, ids.length));
}

/** The counter-offer's shown risk of the org walking away (a bigger org walks more easily). */
export function counterRiskFor(prestige: number): number {
  return round2(clamp(CAREER_PRO_ORG.counterRisk + CAREER_PRO_ORG.counterRiskPerPrestige * prestige, 0, 0.9));
}

function reasonFor(save: Pick<ProSave, "player" | "clock">, form: { avg: number | null; n: number; won: number }): ProOfferReason {
  const age = ageOf(save.player.birthYear, save.clock.seasonIndex);
  const overall = Math.floor(proOverall(save.player.attrs));
  const base = { age, overall };
  if (form.avg !== null && form.n >= 3 && form.avg >= 7) return { key: "form", params: { ...base, avg: form.avg.toFixed(1), n: form.n } };
  if (form.n >= 3 && form.won / form.n >= 0.6) return { key: "results", params: { ...base, won: form.won, n: form.n } };
  if (age <= 16) return { key: "youth", params: base };
  return { key: "level", params: base };
}

/** The chance an org calls this window (CAREER_PRO_ORG). */
function callChance(value: number, rotationBar: number, difficulty: string, age: number): number {
  const O = CAREER_PRO_ORG;
  if (age < O.minAge) return 0;
  const youth = age === O.minAge ? O.youngChance : 1;
  const raw = clamp(O.baseChance + O.perPoint * (value - rotationBar), 0, O.maxChance);
  return raw * (O.difficultyChance[difficulty] ?? 1) * youth;
}

export interface OrgOfferCtx {
  week: number;
  /** Last day of this window (the offers' expiry). */
  windowEndDay: number;
  seq: number;
  /** The org he is at now (never offers itself), or null. */
  currentOrg: string | null;
}

/**
 * The window's offers, decided once on its first Monday. Every org of his
 * region whose bar his value reaches rolls its own seeded chance; the best
 * `maxOffers` that call are kept, strongest org first.
 */
export function orgOffersFor(save: Pick<ProSave, "player" | "clock" | "careerSeed" | "world" | "difficulty" | "matchLog">, ctx: OrgOfferCtx): ProOffer[] {
  const O = CAREER_PRO_ORG;
  const { seasonIndex, day } = save.clock;
  const view: ViewCtx = { careerSeed: save.careerSeed, seasonIndex, world: save.world };
  const age = ageOf(save.player.birthYear, seasonIndex);
  const form = recentFormOf(save.matchLog, 8);
  const value = proValueOf(save, form);
  const calls: { org: WorldOrgState; role: ProRole; level: number }[] = [];
  for (const ref of Object.keys(save.world.orgs).sort()) {
    const org = save.world.orgs[ref];
    if (org.region !== save.player.region || ref === ctx.currentOrg) continue;
    if (org.playerIds.includes(PRO_SELF_ID) || org.reserveIds?.includes(PRO_SELF_ID)) continue;
    const bar = orgBarOf(org, view);
    const rotationBar = bar - O.rotationMargin;
    if (value < rotationBar) continue;
    const chance = callChance(value, rotationBar, save.difficulty, age);
    if (derivedFloat(save.careerSeed, `pro:offer:${seasonIndex}:${ctx.week}:${ref}`) >= chance) continue;
    calls.push({ org, role: value >= bar - O.starterMargin ? "starter" : "rotation", level: orgLevelOf(org, view) });
  }
  calls.sort((a, b) => b.level - a.level || a.org.ref.localeCompare(b.org.ref));
  const reason = reasonFor(save, form);
  return calls.slice(0, O.maxOffers).map(({ org, role, level }, i) => {
    const salary = Math.max(
      O.salaryBase,
      quantize(O.salaryBase + O.salaryPerValue * Math.max(0, value - 60) + O.salaryPerPrestige * org.prestige),
    );
    const length: 1 | 2 = derivedFloat(save.careerSeed, `pro:offer:len:${seasonIndex}:${ctx.week}:${org.ref}`) < 0.5 ? 1 : 2;
    return {
      id: `org:${seasonIndex}:${day}:${ctx.seq + i}`,
      kind: "org",
      ref: org.ref,
      name: org.name,
      level,
      salaryPerSplit: salary,
      lengthSeasons: length,
      role,
      reason,
      madeSeason: seasonIndex,
      madeDay: day,
      expiresSeason: seasonIndex,
      expiresDay: ctx.windowEndDay,
      status: "open",
      counterRisk: counterRiskFor(org.prestige),
    } satisfies ProOffer;
  });
}

/** The renewal his org offers in the deal's last season (null when it lets him go). */
export function renewalOfferFor(
  save: Pick<ProSave, "player" | "clock" | "careerSeed" | "world" | "matchLog" | "contract" | "coachTrust">,
  ctx: { seq: number; starts: boolean },
): ProOffer | null {
  const c = save.contract;
  if (!c || c.renewed || c.endSeason !== save.clock.seasonIndex) return null;
  const org = save.world.orgs[c.orgRef];
  if (!org) return null;
  const trust = save.coachTrust ?? CAREER_PRO_ORG.trustStart;
  if (!ctx.starts && trust < CAREER_PRO_ORG.renewTrust) return null;
  const form = recentFormOf(save.matchLog, 8);
  const view: ViewCtx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const value = proValueOf(save, form);
  const grew = value >= orgBarOf(org, view);
  return {
    id: `renew:${save.clock.seasonIndex}:${ctx.seq}`,
    kind: "renewal",
    ref: c.orgRef,
    name: org.name,
    level: orgLevelOf(org, view),
    salaryPerSplit: grew ? quantize(c.salaryPerSplit * (1 + CAREER_PRO_ORG.renewalRaise)) : c.salaryPerSplit,
    lengthSeasons: 2,
    role: ctx.starts ? "starter" : "rotation",
    reason: { key: "renewal", params: { age: ageOf(save.player.birthYear, save.clock.seasonIndex), overall: Math.floor(proOverall(save.player.attrs)), trust: Math.round(trust) } },
    madeSeason: save.clock.seasonIndex,
    madeDay: save.clock.day,
    expiresSeason: save.clock.seasonIndex,
    expiresDay: 224,
    status: "open",
    counterRisk: counterRiskFor(org.prestige),
  };
}

/** The counter-offer's answer, fixed by the seed: the org improves the deal or walks away. */
export function counterOutcomeOf(careerSeed: number, offer: ProOffer): "improved" | "walked" {
  return derivedFloat(careerSeed, `pro:counter:${offer.id}`) < offer.counterRisk ? "walked" : "improved";
}

/** The offer after an improved counter: a raise, and a promised start when he was close to one. */
export function improvedOffer(offer: ProOffer): ProOffer {
  return { ...offer, salaryPerSplit: quantize(offer.salaryPerSplit * (1 + CAREER_PRO_ORG.counterRaise)), counter: "improved" };
}

// ---------------------------------------------------------------------------
// Rosters
// ---------------------------------------------------------------------------

function cloneOrgsOf(world: WorldState): WorldState {
  const orgs: Record<string, WorldOrgState> = {};
  for (const [ref, o] of Object.entries(world.orgs)) {
    orgs[ref] = { ...o, playerIds: [...o.playerIds] as [string, string, string], ...(o.reserveIds ? { reserveIds: [...o.reserveIds] } : {}) };
  }
  return { ...world, orgs, freeAgentIds: [...world.freeAgentIds] };
}

/** Where `pro:self` is in the world: the org and his seat, or null. */
export function proSeatOf(world: WorldState): { ref: string; seat: "starter" | "reserve" } | null {
  for (const ref of Object.keys(world.orgs).sort()) {
    const o = world.orgs[ref];
    if (o.playerIds.includes(PRO_SELF_ID)) return { ref, seat: "starter" };
    if (o.reserveIds?.includes(PRO_SELF_ID)) return { ref, seat: "reserve" };
  }
  return null;
}

/** Every roster spot `pro:self` holds (the duplication guard and its test read it). */
export function proRosterCount(world: WorldState): number {
  let n = world.freeAgentIds.filter((id) => id === PRO_SELF_ID).length;
  for (const o of Object.values(world.orgs)) {
    n += o.playerIds.filter((id) => id === PRO_SELF_ID).length;
    n += (o.reserveIds ?? []).filter((id) => id === PRO_SELF_ID).length;
  }
  return n;
}

/** The best free agent of a region (a vacated seat's refill), or null. */
function bestFreeAgentOf(world: WorldState, region: string, ctx: ViewCtx): string | null {
  let best: string | null = null;
  let bestOvr = -1;
  for (const id of world.freeAgentIds) {
    if (id === PRO_SELF_ID) continue;
    const v = playerViewById(id, { ...ctx, world });
    if (v && v.region === region && v.overall > bestOvr) {
      bestOvr = v.overall;
      best = id;
    }
  }
  return best;
}

/**
 * The org without the Pro: his bench seat simply goes; a starting seat is
 * filled by the best of the bench, else the region's best free agent.
 */
export function removeProFromWorld(world: WorldState, ctx: Omit<ViewCtx, "world">): WorldState {
  if (proRosterCount(world) === 0) return world;
  const next = cloneOrgsOf(world);
  next.freeAgentIds = next.freeAgentIds.filter((id) => id !== PRO_SELF_ID);
  const view: ViewCtx = { ...ctx, world: next };
  for (const ref of Object.keys(next.orgs).sort()) {
    const o = next.orgs[ref];
    if (o.reserveIds?.includes(PRO_SELF_ID)) o.reserveIds = o.reserveIds.filter((id) => id !== PRO_SELF_ID);
    const idx = o.playerIds.indexOf(PRO_SELF_ID);
    if (idx < 0) continue;
    const bench = [...(o.reserveIds ?? [])].sort((a, b) => overallOf(b, view) - overallOf(a, view) || a.localeCompare(b));
    const fill = bench[0] ?? bestFreeAgentOf(next, o.region, view);
    // An org fields three: with nobody to take the seat he stays on it (the caller sees proRosterCount > 0 and keeps him).
    if (!fill) continue;
    o.playerIds[idx] = fill;
    if (bench[0] === fill) o.reserveIds = o.reserveIds!.filter((id) => id !== fill);
    else next.freeAgentIds = next.freeAgentIds.filter((id) => id !== fill);
  }
  next.version += 1;
  return next;
}

/**
 * Signs `pro:self` for `orgRef` in `role`. Returns the world and who made
 * room (the weakest starter for a promised start; the weakest bench player
 * when the bench is full), and where he went.
 */
export function placeProInOrg(
  world: WorldState,
  orgRef: string,
  role: ProRole,
  ctx: Omit<ViewCtx, "world">,
): { world: WorldState; displaced: { id: string; name: string; to: "reserve" | "freeAgent" } | null } {
  const cleared = removeProFromWorld(world, ctx);
  if (!cleared.orgs[orgRef]) return { world: cleared, displaced: null };
  const next = cloneOrgsOf(cleared);
  const view: ViewCtx = { ...ctx, world: next };
  const org = next.orgs[orgRef];
  const benchCap = CAREER_WORLD_LIFE.scouting.reserveSlots;
  const benchOn = worldLifeOn(ctx.seasonIndex);
  let displaced: { id: string; name: string; to: "reserve" | "freeAgent" } | null = null;
  const nameOf = (id: string) => playerViewById(id, view)?.name ?? id;
  if (role === "starter") {
    let weakest = 0;
    org.playerIds.forEach((id, i) => {
      if (overallOf(id, view) < overallOf(org.playerIds[weakest], view)) weakest = i;
    });
    const out = org.playerIds[weakest];
    org.playerIds[weakest] = PRO_SELF_ID;
    const bench = org.reserveIds ?? [];
    if (benchOn && bench.length < benchCap) {
      org.reserveIds = [...bench, out];
      displaced = { id: out, name: nameOf(out), to: "reserve" };
    } else {
      next.freeAgentIds.push(out);
      displaced = { id: out, name: nameOf(out), to: "freeAgent" };
    }
  } else {
    const bench = [...(org.reserveIds ?? [])];
    if (bench.length >= benchCap) {
      bench.sort((a, b) => overallOf(a, view) - overallOf(b, view) || a.localeCompare(b));
      const out = bench.shift()!;
      next.freeAgentIds.push(out);
      displaced = { id: out, name: nameOf(out), to: "freeAgent" };
    }
    org.reserveIds = [...bench, PRO_SELF_ID];
  }
  next.version += 1;
  return { world: next, displaced };
}
