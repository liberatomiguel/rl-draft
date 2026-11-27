/**
 * v2.2 ORGMODE 2027 stage 2 (front MANDATE): the board's mandate for an
 * established org, and the house's problems it is read from. Pure.
 *
 * An org taken over is not a founded club with the locks removed: it arrives
 * with problems, and the board tells the manager what it expects this season.
 * Three goals, no choice:
 *  - classification: the tier's Expected objective (board.boardPackagesFor),
 *    its aim moved by the org's demand level;
 *  - money: from the org's money problems (wages at the ceiling, short cash, a
 *    reserve paid like a starter), else the tier's default (a big org keeps
 *    its transfer spend inside a budget, a smaller one ends with cash);
 *  - squad: from its squad problems (a starter's deal ending, a weak link, an
 *    old core, a benched prospect), else what the demand asks (a high-demand
 *    board wants a signing, the others want the core kept).
 * Each goal says what meeting it gives and what missing it costs (confidence,
 * next season's budget, a bonus): CAREER_BOARD.mandate. The season review
 * settles the three (store/boardFlow).
 *
 * Stage 3 attaches its tools to the issue kinds (contract clauses, asks to
 * the board, departments): `OrgIssue` names the situation and the player.
 */

import { CAREER_BOARD } from "@/config/balance";
import { lineups, seasonById } from "@/data";
import type {
  BoardMandate,
  BoardPackage,
  ClassificationGoal,
  DemandLevel,
  MandateArea,
  MandateTerms,
  MoneyGoal,
  OrgIssue,
  OrgIssueKind,
  SquadGoal,
  Stature,
} from "./boardTypes";
import { wageCeilingOf } from "./budget";
import { growthModelOf, seasonOrderFor, seasonYear } from "./development";
import { quantize, weeklyWageBill } from "./economy";
import { signCapOf, structureWeeklyOf } from "./established";
import { listingValueOf } from "./transferList";
import type { CareerSave, CompactEventResult, SquadPlayer } from "./types";
import { careerChemistry } from "./worldSim";

const M = CAREER_BOARD.mandate;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------------------
// The demand level
// ---------------------------------------------------------------------------

/** How much the board asks: the tier's score plus the org's history (prestige 0-3). */
export function demandOf(tier: Stature, prestige: number): DemandLevel {
  const D = M.demand;
  const score = (D.tierScore[tier] ?? 0) + (D.prestigeScore[Math.max(0, Math.min(3, Math.round(prestige)))] ?? 0);
  return score >= D.cuts.high ? "high" : score >= D.cuts.medium ? "medium" : "low";
}

/** The classification aim's shift for a demand level (CAREER_BOARD.mandate.demand.aimShift). */
export function demandAimShiftOf(demand: DemandLevel): number {
  return M.demand.aimShift[demand] ?? 0;
}

// ---------------------------------------------------------------------------
// The house's problems
// ---------------------------------------------------------------------------

type IssueSave = Pick<CareerSave, "squad" | "starterIds" | "coach" | "finances" | "sponsor" | "clock" | "careerSeed" | "world" | "identity" | "reputation"> & {
  board?: CareerSave["board"];
};

const ageIn = (p: Pick<SquadPlayer, "birthYear">, seasonIndex: number) => seasonYear(seasonIndex) - p.birthYear;

export function startersOf(save: Pick<CareerSave, "squad" | "starterIds">): SquadPlayer[] {
  return save.starterIds.map((id) => save.squad.find((p) => p.id === id)).filter((p): p is SquadPlayer => Boolean(p));
}

/** The weekly wage bill (squad + coach) and the running bill (with the structure's upkeep and retainers). */
export function billsOf(save: Pick<CareerSave, "squad" | "coach" | "finances" | "clock">): { wages: number; running: number } {
  const wages = weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null);
  return { wages, running: wages + structureWeeklyOf(save.finances.gear, save.clock.seasonIndex) };
}

/**
 * The org's problems as it is today, most pressing first, at most
 * CAREER_BOARD.mandate.issues.max. Only an established board's org has a
 * ceiling; without a board the wage problems are not read.
 */
export function orgIssuesOf(save: IssueSave, opts: { all?: boolean } = {}): OrgIssue[] {
  const I = M.issues;
  const sev = (k: OrgIssueKind) => I.severity[k] ?? 0;
  const s = save.clock.seasonIndex;
  const out: OrgIssue[] = [];
  const starters = startersOf(save);
  const bench = save.squad.filter((p) => !save.starterIds.includes(p.id));
  const { wages, running } = billsOf(save);

  // Deals: a starter whose contract ends this season (the best one named), then the next season's.
  const ending = starters.filter((p) => p.contractEndSeason <= s).sort((a, b) => b.overall - a.overall);
  if (ending.length) out.push({ kind: "dealsEnding", severity: sev("dealsEnding"), value: ending.length, playerId: ending[0].id, playerName: ending[0].name });
  else {
    const soon = starters.filter((p) => p.contractEndSeason === s + 1).sort((a, b) => b.overall - a.overall);
    if (soon.length) out.push({ kind: "dealsSoon", severity: sev("dealsSoon"), value: soon.length, playerId: soon[0].id, playerName: soon[0].name });
  }

  // Wages against the board's ceiling.
  const board = save.board;
  if (board && board.kind === "board" && board.wageRoom > 0) {
    const ceiling = wageCeilingOf(board, s);
    const share = ceiling > 0 ? wages / ceiling : 0;
    if (share >= I.wageShare) out.push({ kind: "wageBill", severity: clamp01(sev("wageBill") + (share - 1) * 0.5), value: Math.round(share * 100) });
    else if (share >= I.roomShare) out.push({ kind: "wageRoom", severity: sev("wageRoom"), value: Math.round(share * 100) });
  }

  // Cash in weeks of the running bill.
  if (running > 0) {
    const weeks = save.finances.balance / running;
    if (weeks < I.cashWeeks) out.push({ kind: "shortCash", severity: clamp01(sev("shortCash") + (I.cashWeeks - weeks) * 0.03), value: Math.round(weeks * 10) / 10 });
  }

  // The lineup: a weak link, an old core, chemistry.
  if (starters.length === 3) {
    const sorted = [...starters].sort((a, b) => a.overall - b.overall);
    const gap = (sorted[1].overall + sorted[2].overall) / 2 - sorted[0].overall;
    if (gap >= I.weakGap) out.push({ kind: "weakLink", severity: clamp01(sev("weakLink") + (gap - I.weakGap) * 0.02), value: Math.round(gap), playerId: sorted[0].id, playerName: sorted[0].name });
    const ages = starters.map((p) => ageIn(p, s));
    const avg = ages.reduce((a, b) => a + b, 0) / 3;
    if (avg >= I.agingAvg || ages.filter((a) => a >= I.oldAge).length >= 2) out.push({ kind: "agingCore", severity: sev("agingCore"), value: Math.round(avg * 10) / 10 });
    const chem = careerChemistry(starters).percent;
    if (chem < I.chemistry) out.push({ kind: "lowChemistry", severity: sev("lowChemistry"), value: Math.round(chem) });
  }

  if (!save.coach) out.push({ kind: "noCoach", severity: sev("noCoach"), value: 0 });

  // The bench: a reserve paid like a starter; a prospect left out.
  const avgStarterWage = starters.length ? starters.reduce((a, p) => a + p.salaryPerSplit, 0) / starters.length : 0;
  const costly = bench.filter((p) => avgStarterWage > 0 && p.salaryPerSplit >= avgStarterWage * I.benchShare).sort((a, b) => b.salaryPerSplit - a.salaryPerSplit)[0];
  if (costly) out.push({ kind: "costlyBench", severity: sev("costlyBench"), value: Math.round((100 * costly.salaryPerSplit) / avgStarterWage), playerId: costly.id, playerName: costly.name });
  const prospect = bench.filter((p) => ageIn(p, s) <= I.prospectAge).sort((a, b) => b.potential - a.potential)[0];
  if (prospect) out.push({ kind: "prospectBenched", severity: sev("prospectBenched"), value: ageIn(prospect, s), playerId: prospect.id, playerName: prospect.name });

  // The sponsor.
  const ends = save.sponsor?.terms?.endsOn;
  if (!save.sponsor) out.push({ kind: "noSponsor", severity: sev("noSponsor"), value: 0 });
  else if (ends && ends.seasonIndex <= s) out.push({ kind: "sponsorEnding", severity: sev("sponsorEnding"), value: 0 });

  out.sort((a, b) => b.severity - a.severity || a.kind.localeCompare(b.kind));
  return opts.all ? out : out.slice(0, I.max);
}

// ---------------------------------------------------------------------------
// The three goals
// ---------------------------------------------------------------------------

const MONEY_FROM: Partial<Record<OrgIssueKind, MoneyGoal["kind"]>> = {
  wageBill: "wagesUnder",
  shortCash: "cashFloor",
  costlyBench: "sales",
};

const SQUAD_FROM: Partial<Record<OrgIssueKind, SquadGoal["kind"]>> = {
  dealsEnding: "renew",
  weakLink: "signStarter",
  agingCore: "ageUnder",
  lowChemistry: "keepCore",
  prospectBenched: "youthEvents",
};

export interface MandateInput {
  /** The season's classification goal: the Expected package, already aimed by the demand. */
  classification: BoardPackage;
  tier: Stature;
  demand: DemandLevel;
  /** The board's patience (stature × difficulty): every loss × it. */
  patience: number;
  /** Last season's mandate (the pop-up's "what changed"), when it was this board's, and the tier it was set for. */
  last?: BoardMandate | null;
  lastTier?: Stature;
}

function terms(area: MandateArea, demand: DemandLevel, patience: number, weekWages: number): { gain: MandateTerms; loss: MandateTerms } {
  const T = M.terms[area];
  const stakes = M.demand.stakes[demand] ?? 1;
  return {
    gain: { confidence: Math.round(T.hit * stakes), budget: T.budget, bonus: quantize(weekWages * T.bonusWeeks) },
    loss: { confidence: Math.round(T.miss * patience * stakes), budget: T.budgetLoss, bonus: 0 },
  };
}

function moneyGoalFor(save: IssueSave, issues: OrgIssue[], tier: Stature, demand: DemandLevel): Omit<MoneyGoal, "gain" | "loss" | "met"> {
  const s = save.clock.seasonIndex;
  const { running } = billsOf(save);
  const from = issues.find((i) => MONEY_FROM[i.kind]);
  const kind: MoneyGoal["kind"] = from ? MONEY_FROM[from.kind]! : tier === "elite" || tier === "contender" ? "netSpend" : "cashFloor";
  const issue = from ? { issue: from.kind } : {};
  if (kind === "wagesUnder") {
    const ceiling = save.board ? wageCeilingOf(save.board, s) : running;
    return { area: "money", kind, amount: ceiling, week: M.money.wagesWeek, ...issue };
  }
  if (kind === "sales") {
    const p = save.squad.find((x) => x.id === from?.playerId);
    const value = p ? listingValueOf(p, { careerSeed: save.careerSeed, seasonIndex: s, growthModel: growthModelOf(save.world) }) : running * 4;
    return { area: "money", kind, amount: Math.max(quantize(value * M.money.salesShare), quantize(running)), ...issue };
  }
  if (kind === "netSpend") return { area: "money", kind, amount: quantize(running * (M.money.netSpendWeeks[demand] ?? 4)), ...issue };
  return { area: "money", kind: "cashFloor", amount: quantize(running * (M.money.cashFloorWeeks[demand] ?? 3)), ...issue };
}

function squadGoalFor(save: IssueSave, issues: OrgIssue[], tier: Stature, demand: DemandLevel): Omit<SquadGoal, "gain" | "loss" | "met"> {
  const s = save.clock.seasonIndex;
  const starters = startersOf(save);
  const from = issues.find((i) => SQUAD_FROM[i.kind]);
  const named = (ps: SquadPlayer[]) => ({ playerIds: ps.map((p) => p.id), playerNames: ps.map((p) => p.name) });
  const kind: SquadGoal["kind"] = from ? SQUAD_FROM[from.kind]! : demand === "high" ? "signStarter" : "keepCore";
  const issue = from ? { issue: from.kind } : {};
  const player = from?.playerId ? save.squad.find((p) => p.id === from.playerId) : undefined;
  if (kind === "renew" && player) return { area: "squad", kind, value: 1, ...named([player]), ...issue };
  if (kind === "youthEvents" && player) return { area: "squad", kind, value: M.squad.youthEvents, ...named([player]), progress: 0, ...issue };
  if (kind === "ageUnder" && starters.length) {
    const avg = starters.reduce((a, p) => a + ageIn(p, s), 0) / starters.length;
    return { area: "squad", kind, value: Math.max(18, Math.floor(avg) - M.squad.ageCut), ...issue };
  }
  if (kind === "signStarter" && starters.length) {
    const weakest = Math.min(...starters.map((p) => p.overall));
    const cap = signCapOf(save);
    const bar = Math.min(cap, Math.max(M.squad.tierBar[tier] ?? 80, Math.round(weakest) + M.squad.signOver));
    return { area: "squad", kind, value: bar, baselineIds: save.squad.map((p) => p.id), ...issue };
  }
  // Keep the core: the best starters stay through the season.
  const core = [...starters].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id)).slice(0, M.squad.core);
  return { area: "squad", kind: "keepCore", value: core.length, ...named(core), ...(from?.kind === "lowChemistry" ? issue : {}) };
}

/** The season's mandate, built from the org as it is (the store calls it from offerSeason). */
export function buildMandate(save: IssueSave, input: MandateInput): BoardMandate {
  const s = save.clock.seasonIndex;
  const issues = orgIssuesOf(save);
  const { wages } = billsOf(save);
  const cls = terms("classification", input.demand, input.patience, wages);
  const classification: ClassificationGoal = {
    area: "classification",
    objective: { ...input.classification.objective },
    gain: { ...cls.gain, bonus: input.classification.bonus },
    loss: cls.loss,
    met: null,
  };
  const money: MoneyGoal = { ...moneyGoalFor(save, issues, input.tier, input.demand), ...terms("money", input.demand, input.patience, wages), met: null };
  const squad: SquadGoal = { ...squadGoalFor(save, issues, input.tier, input.demand), ...terms("squad", input.demand, input.patience, wages), met: null };
  const last = input.last && input.last.seasonIndex === s - 1
    ? { last: { demand: input.last.demand, tier: input.lastTier ?? input.tier, met: { classification: input.last.classification.met, money: input.last.money.met, squad: input.last.squad.met } } }
    : {};
  return { seasonIndex: s, demand: input.demand, issues, classification, money, squad, acknowledged: false, ...last };
}

// ---------------------------------------------------------------------------
// Progress and settlement
// ---------------------------------------------------------------------------

export interface GoalProgress {
  /** A figure now (balance, wage bill, net spend, sales, best newcomer, age, events, players kept). */
  now: number;
  /** The figure it is judged against. */
  target: number;
  /** "under": met while now <= target; "over": met while now >= target. */
  sense: "under" | "over";
  /** Met on today's figures (the review settles it; a deadline may have settled it already). */
  onTrack: boolean;
  /** Already settled at a deadline, or no longer reachable (a named player left). */
  settled?: boolean;
}

type ProgressSave = Pick<CareerSave, "squad" | "starterIds" | "finances" | "clock" | "coach">;

/** Net transfer spend and sales this season (the tally the mandate keeps). */
export function transferMoneyOf(save: Pick<CareerSave, "finances" | "clock">): { out: number; in: number; net: number } {
  const t = save.finances.transferTally;
  if (!t || t.seasonIndex !== save.clock.seasonIndex) return { out: 0, in: 0, net: 0 };
  return { out: t.out, in: t.in, net: t.out - t.in };
}

export function moneyProgressOf(save: ProgressSave, g: MoneyGoal): GoalProgress {
  const { wages } = billsOf(save);
  const tm = transferMoneyOf(save);
  switch (g.kind) {
    case "cashFloor":
      return { now: save.finances.balance, target: g.amount, sense: "over", onTrack: save.finances.balance >= g.amount };
    case "wagesUnder": {
      const settled = g.deadlineMet === false;
      return { now: wages, target: g.amount, sense: "under", onTrack: !settled && wages <= g.amount, ...(settled ? { settled } : {}) };
    }
    case "netSpend":
      return { now: tm.net, target: g.amount, sense: "under", onTrack: tm.net <= g.amount };
    case "sales":
      return { now: tm.in, target: g.amount, sense: "over", onTrack: tm.in >= g.amount };
  }
}

export function squadProgressOf(save: ProgressSave, g: SquadGoal): GoalProgress {
  const s = save.clock.seasonIndex;
  const starters = startersOf(save);
  const inSquad = (id: string) => save.squad.some((p) => p.id === id);
  switch (g.kind) {
    case "signStarter": {
      const base = new Set(g.baselineIds ?? []);
      const best = Math.max(0, ...starters.filter((p) => !base.has(p.id)).map((p) => Math.round(p.overall)));
      return { now: best, target: g.value, sense: "over", onTrack: best >= g.value };
    }
    case "renew": {
      const p = save.squad.find((x) => x.id === g.playerIds?.[0]);
      const done = Boolean(p && p.contractEndSeason > s);
      return { now: done ? 1 : 0, target: 1, sense: "over", onTrack: done, ...(!p ? { settled: true } : {}) };
    }
    case "ageUnder": {
      const avg = starters.length ? starters.reduce((a, p) => a + ageIn(p, s), 0) / starters.length : 0;
      const now = Math.round(avg * 10) / 10;
      return { now, target: g.value, sense: "under", onTrack: now <= g.value };
    }
    case "youthEvents": {
      const n = g.progress ?? 0;
      const gone = !inSquad(g.playerIds?.[0] ?? "");
      return { now: n, target: g.value, sense: "over", onTrack: n >= g.value, ...(gone && n < g.value ? { settled: true } : {}) };
    }
    case "keepCore": {
      const ids = g.playerIds ?? [];
      const kept = ids.filter(inSquad).length;
      return { now: kept, target: ids.length, sense: "over", onTrack: kept >= ids.length, ...(kept < ids.length ? { settled: true } : {}) };
    }
  }
}

/** The wage goal's deadline: at its week's boundary the bill is read once (the review reads it again). Mutates. */
export function markWageDeadline(save: ProgressSave, g: MoneyGoal, week: number): void {
  if (g.kind !== "wagesUnder" || g.week !== week || g.deadlineMet !== undefined) return;
  g.deadlineMet = billsOf(save).wages <= g.amount;
}

/** youthEvents: an official event the user played with the prospect in the starting three. Mutates. */
export function countYouthEvent(g: SquadGoal, result: Pick<CompactEventResult, "tier" | "userPlacement">, fieldedIds: readonly string[]): void {
  if (g.kind !== "youthEvents" || result.userPlacement === undefined || result.tier === "qualifier") return;
  if (fieldedIds.includes(g.playerIds?.[0] ?? "")) g.progress = (g.progress ?? 0) + 1;
}

/** The review's verdict on the money and squad goals (the classification goal is the season goal's target). */
export function settleMandate(save: ProgressSave, m: BoardMandate, balanceAtReview: number): { money: boolean; squad: boolean } {
  const mp = moneyProgressOf({ ...save, finances: { ...save.finances, balance: balanceAtReview } }, m.money);
  const money = m.money.kind === "wagesUnder" ? m.money.deadlineMet !== false && mp.onTrack : mp.onTrack;
  const squad = squadProgressOf(save, m.squad).onTrack;
  return { money, squad };
}

// ---------------------------------------------------------------------------
// The org's own history (the owner's welcome)
// ---------------------------------------------------------------------------

/**
 * What the dataset says about an org up to this career season: the RLCS
 * seasons it fielded a lineup in, the first one's label, and how many of
 * them it was a top side ("strong" or "elite"). Null when it has none.
 */
export function orgHistoryOf(ref: string, seasonIndex: number): { seasons: number; since: string; topSeasons: number } | null {
  const upTo = seasonOrderFor(seasonIndex);
  const mine = lineups.filter((l) => l.orgId === ref && !l.national && l.seasonId.startsWith("rlcs-"));
  const bySeason = new Map<string, { order: number; top: boolean }>();
  for (const l of mine) {
    const order = seasonById.get(l.seasonId)?.order;
    if (order === undefined || order > upTo) continue;
    const top = l.historicalStrength === "strong" || l.historicalStrength === "elite";
    const was = bySeason.get(l.seasonId);
    bySeason.set(l.seasonId, { order, top: Boolean(was?.top) || top });
  }
  if (bySeason.size === 0) return null;
  const first = [...bySeason.entries()].sort((a, b) => a[1].order - b[1].order)[0][0];
  return {
    seasons: bySeason.size,
    since: seasonById.get(first)?.label ?? first,
    topSeasons: [...bySeason.values()].filter((v) => v.top).length,
  };
}
