/**
 * v2.2 Pro (PRO-SPEC §4.3, §5, R150): the week. Three blocks (Mon-Tue, Wed-Thu,
 * Fri), each one activity; energy is spent and recovered; a week that closes
 * tired shows the burnout warning, and only a week that closes tired AFTER a
 * warning can burn him out (so the warning always comes a week before).
 *
 * Pure and deterministic: ranked and burnout draw from career-seed streams
 * (`pro:ranked:...`, `pro:burnout:...`); training, scrims and content are
 * formulas. Nothing here reads a clock.
 */

import { CAREER_PRO_WEEK as W } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import type { StatKey } from "../../types";
import { deriveSeed } from "../seeds";
import { PRO_STAT_KEYS, round2 } from "./attrs";
import { applyGains, blockGains, diffGrowth, trainBlock, weakestStat } from "./growth";
import { expectedSessionDelta, playRankedSession, rankOf, rankedXp } from "./ranked";
import type { ProActivity, ProGrowthEntry, ProPlayer, ProStage, ProWeekNote, ProWeekPlan } from "./types";

export type { ProActivity, ProWeekNote, ProWeekPlan };

export interface WeekCtx {
  seasonIndex: number;
  /** The day the block falls on (the week's first day + blockDays[block] when played through applyWeekPlan). */
  day: number;
  /** The team's coach overall; undefined = none (ranked, amateur). */
  coachOverall?: number;
  hasTeam: boolean;
  careerSeed: number;
}

export type CoachCtx = Omit<WeekCtx, "day"> & {
  day?: number;
  daysToNextEvent?: number;
  nextEventIsLan?: boolean;
  stage?: ProStage;
};

export interface BlockResult {
  player: ProPlayer;
  growth: ProGrowthEntry[];
  notes: ProWeekNote[];
}

export function isBurnedOut(player: ProPlayer): boolean {
  return (player.burnout?.outWeeks ?? 0) > 0;
}

const REST: ProActivity = { kind: "rest" };

function rested(player: ProPlayer): ProPlayer {
  return { ...player, energy: Math.min(W.energyMax, player.energy + W.restGain) };
}

/** Content: money and fame, the audience feeding the next take. */
function contentBlock(player: ProPlayer): { player: ProPlayer; money: number; fame: number } {
  const C = W.content;
  const money = Math.round(C.money + player.fame * C.moneyPerFame);
  const fame = Math.round(C.fame + player.fame * C.famePerFame);
  return {
    player: {
      ...player,
      energy: Math.max(0, player.energy - W.cost.content),
      money: player.money + money,
      fame: Math.min(C.fameCap, player.fame + fame),
    },
    money,
    fame,
  };
}

/** A scrim with a team: a share of a block on experience, and chemistry. */
function scrimBlock(player: ProPlayer, ctx: Pick<WeekCtx, "seasonIndex" | "coachOverall">): ProPlayer {
  const gains = blockGains(player, "experience", { seasonIndex: ctx.seasonIndex, coachOverall: ctx.coachOverall ?? null });
  const scaled: Partial<Record<StatKey, number>> = {};
  for (const k of PRO_STAT_KEYS) scaled[k] = (gains[k] ?? 0) * W.scrimXpShare;
  return {
    ...player,
    attrs: applyGains(player.attrs, scaled),
    energy: Math.max(0, player.energy - W.cost.scrim),
    chemistry: Math.min(W.chemistryMax, (player.chemistry ?? 0) + W.scrimChemistry),
  };
}

/** One block (PRO-SPEC §5). A burned-out player plays every block as rest. */
export function applyBlock(player: ProPlayer, activity: ProActivity, ctx: WeekCtx): BlockResult {
  const notes: ProWeekNote[] = [];
  if (isBurnedOut(player)) {
    return { player: rested(player), growth: [], notes: [{ code: "stillBurnedOut" }] };
  }
  const at = { seasonIndex: ctx.seasonIndex, day: ctx.day };
  if (activity.kind !== "rest" && activity.kind !== "train" && player.energy < W.lowEnergy) {
    notes.push({ code: "lowEnergy", n: Math.round(player.energy) });
  }

  switch (activity.kind) {
    case "rest":
      return { player: rested(player), growth: [], notes };
    case "train": {
      if (player.energy < W.lowEnergy) notes.push({ code: "tiredTraining", n: Math.round(player.energy) });
      const trained = trainBlock(player, activity.focus, { seasonIndex: ctx.seasonIndex, coachOverall: ctx.coachOverall ?? null });
      const next: ProPlayer = {
        ...trained,
        energy: Math.max(0, player.energy - W.cost.train),
        mechanicsBlocks: (player.mechanicsBlocks ?? 0) + (activity.focus === "mechanics" ? 1 : 0),
      };
      return { player: next, growth: diffGrowth(player.attrs, next.attrs, "training", at), notes };
    }
    case "ranked": {
      const before = rankOf(player.mmr);
      const r = playRankedSession(player, { seasonIndex: ctx.seasonIndex, day: ctx.day, careerSeed: ctx.careerSeed });
      const after = rankOf(r.player.mmr);
      notes.push({ code: "rankedResult", n: r.mmrDelta });
      if (after.index > before.index) notes.push({ code: "rankUp", ref: after.id });
      else if (after.index < before.index) notes.push({ code: "rankDown", ref: after.id });
      return { player: r.player, growth: r.growth, notes };
    }
    case "scrim": {
      if (!ctx.hasTeam) return { player, growth: [], notes: [{ code: "scrimNeedsTeam" }] };
      const next = scrimBlock(player, ctx);
      return { player: next, growth: diffGrowth(player.attrs, next.attrs, "scrim", at), notes };
    }
    case "content": {
      const c = contentBlock(player);
      notes.push({ code: "contentPaid", n: c.money });
      return { player: c.player, growth: [], notes };
    }
  }
}

/**
 * The week closes: the weekend's sleep, then the burnout rules. The warning
 * shows when the week ends under `warnBelow`; a burnout can only roll in a week
 * that ends under `lowEnergy` with the warning already up from an earlier week.
 */
export function closeWeek(
  player: ProPlayer,
  ctx: { seasonIndex: number; day: number; careerSeed: number },
): { player: ProPlayer; notes: ProWeekNote[] } {
  const notes: ProWeekNote[] = [];
  let energy = Math.min(W.energyMax, player.energy + W.weekEndRecovery);
  const b = player.burnout ?? { warned: false, outWeeks: 0 };
  let warned = b.warned;
  let outWeeks = b.outWeeks;

  if (outWeeks > 0) {
    outWeeks -= 1;
    if (outWeeks === 0) {
      energy = Math.max(energy, W.burnoutReturnEnergy);
      warned = false;
      notes.push({ code: "backFromBurnout", n: Math.round(energy) });
    } else {
      notes.push({ code: "stillBurnedOut", n: outWeeks });
    }
  } else if (energy < W.lowEnergy && warned) {
    const rng = createRng(deriveSeed(ctx.careerSeed, `pro:burnout:${ctx.seasonIndex}:${ctx.day}`));
    const chance = Math.min(W.burnoutMax, W.burnoutBase + (W.lowEnergy - energy) * W.burnoutPerPoint);
    if (rng.next() < chance) {
      outWeeks = rng.int(W.burnoutWeeks[0], W.burnoutWeeks[1]);
      notes.push({ code: "burnedOut", n: outWeeks });
    } else {
      notes.push({ code: "burnoutWarning", n: Math.round(energy) });
    }
  } else if (energy < W.warnBelow) {
    warned = true;
    notes.push({ code: "burnoutWarning", n: Math.round(energy) });
  } else if (energy >= W.warnClear) {
    warned = false;
  }
  return { player: { ...player, energy, burnout: { warned, outWeeks } }, notes };
}

export interface WeekResult extends BlockResult {
  /** Energy after each block, then after the week closed (4 values). */
  energyTrace: number[];
}

/** Three blocks and the week's close; remembers the plan as `lastPlan`. */
export function applyWeekPlan(player: ProPlayer, plan: ProWeekPlan, ctx: WeekCtx): WeekResult {
  let p = player;
  const growth: ProGrowthEntry[] = [];
  const notes: ProWeekNote[] = [];
  const energyTrace: number[] = [];
  plan.forEach((activity, i) => {
    const r = applyBlock(p, activity, { ...ctx, day: ctx.day + W.blockDays[i] });
    p = r.player;
    growth.push(...r.growth);
    for (const n of r.notes) if (!notes.some((x) => x.code === n.code && x.n === n.n && x.ref === n.ref)) notes.push(n);
    energyTrace.push(Math.round(p.energy));
  });
  const closed = closeWeek(p, { seasonIndex: ctx.seasonIndex, day: ctx.day, careerSeed: ctx.careerSeed });
  notes.push(...closed.notes);
  energyTrace.push(Math.round(closed.player.energy));
  return { player: { ...closed.player, lastPlan: plan }, growth, notes, energyTrace };
}

/** What a block is worth, in plain numbers, before it is played (no RNG: ranked shows the expected change). */
export interface BlockPreview {
  energyAfter: number;
  /** Points per attribute, two decimals. */
  gains: Partial<Record<StatKey, number>>;
  /** Ranked: the expected MMR change of the session. */
  mmr?: number;
  money?: number;
  fame?: number;
  chemistry?: number;
  /** The block cannot be played as chosen (no team for a scrim). */
  blocked?: "needsTeam";
  /** The player is burned out: the block is a rest. */
  burnedOut?: boolean;
}

function gainsOf(before: ProPlayer, after: ProPlayer): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const k of PRO_STAT_KEYS) {
    const d = round2(after.attrs[k] - before.attrs[k]);
    if (d > 0) out[k] = d;
  }
  return out;
}

export function previewBlock(player: ProPlayer, activity: ProActivity, ctx: Omit<WeekCtx, "day">): { preview: BlockPreview; player: ProPlayer } {
  const coach = ctx.coachOverall ?? null;
  if (isBurnedOut(player)) {
    const next = rested(player);
    return { preview: { energyAfter: Math.round(next.energy), gains: {}, burnedOut: true }, player: next };
  }
  switch (activity.kind) {
    case "rest": {
      const next = rested(player);
      return { preview: { energyAfter: Math.round(next.energy), gains: {} }, player: next };
    }
    case "train": {
      const trained = trainBlock(player, activity.focus, { seasonIndex: ctx.seasonIndex, coachOverall: coach });
      const next = { ...trained, energy: Math.max(0, player.energy - W.cost.train) };
      return { preview: { energyAfter: Math.round(next.energy), gains: gainsOf(player, next) }, player: next };
    }
    case "ranked": {
      const attrs = rankedXp(player, { seasonIndex: ctx.seasonIndex, day: 0, careerSeed: ctx.careerSeed });
      const mmr = expectedSessionDelta(player);
      const next = { ...player, attrs, energy: Math.max(0, player.energy - W.cost.ranked), mmr: clamp(player.mmr + mmr, 0, 99999) };
      return { preview: { energyAfter: Math.round(next.energy), gains: gainsOf(player, next), mmr }, player: next };
    }
    case "scrim": {
      if (!ctx.hasTeam) return { preview: { energyAfter: Math.round(player.energy), gains: {}, blocked: "needsTeam" }, player };
      const next = scrimBlock(player, ctx);
      return { preview: { energyAfter: Math.round(next.energy), gains: gainsOf(player, next), chemistry: W.scrimChemistry }, player: next };
    }
    case "content": {
      const c = contentBlock(player);
      return { preview: { energyAfter: Math.round(c.player.energy), gains: {}, money: c.money, fame: c.fame }, player: c.player };
    }
  }
}

export interface WeekPreview {
  blocks: BlockPreview[];
  /** Energy once the week has closed. */
  energyEnd: number;
  /** The week ends under the warning line: the burnout warning would show. */
  warns: boolean;
  /** The week ends under the tired line. */
  tired: boolean;
}

export function previewWeek(player: ProPlayer, plan: ProWeekPlan, ctx: Omit<WeekCtx, "day">): WeekPreview {
  let p = player;
  const blocks: BlockPreview[] = [];
  for (const a of plan) {
    const r = previewBlock(p, a, ctx);
    blocks.push(r.preview);
    p = r.player;
  }
  const energyEnd = Math.round(Math.min(W.energyMax, p.energy + W.weekEndRecovery));
  return { blocks, energyEnd, warns: energyEnd < W.warnBelow, tired: energyEnd < W.lowEnergy };
}

/** The coach's plan for the week (PRO-SPEC §5): rest before a LAN or when tired, otherwise work the weak spots. */
export function coachPlanFor(player: ProPlayer, ctx: CoachCtx): ProWeekPlan {
  if (isBurnedOut(player)) return [REST, REST, REST];
  const lanSoon = Boolean(ctx.nextEventIsLan) && ctx.daysToNextEvent !== undefined && ctx.daysToNextEvent <= W.lanRestDays;
  const weakest = weakestStat(player.attrs);
  const second = [...PRO_STAT_KEYS].filter((k) => k !== weakest).sort((a, b) => player.attrs[a] - player.attrs[b])[0];
  let e = player.energy;
  const plan: ProActivity[] = [];
  for (let i = 0; i < 3; i++) {
    const rest = e < W.coachRestBelow || (lanSoon && (i === 2 || (i === 1 && e < 70)));
    let a: ProActivity;
    if (rest) a = REST;
    else if (i === 1) a = ctx.hasTeam ? { kind: "scrim" } : { kind: "ranked" };
    else a = { kind: "train", focus: i === 0 ? weakest : second };
    e = a.kind === "rest" ? Math.min(W.energyMax, e + W.restGain) : e - W.cost[a.kind];
    plan.push(a);
  }
  return plan as ProWeekPlan;
}

/** "Repeat last week": the last plan played, or the coach's when there is none. */
export function repeatPlanFor(player: ProPlayer, ctx: CoachCtx): ProWeekPlan {
  return player.lastPlan ?? coachPlanFor(player, ctx);
}
