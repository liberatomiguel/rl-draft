/** Audit-only observations. Counterfactuals call pure engine functions; no game state is patched. */
import { CAREER_GEAR, CAREER_TRAINING } from "@/config/balance";
import { DAYS_PER_SEASON, weekAt, weekOfDay } from "@/engine/career/calendar";
import { ageOf, growthCtxOf, trainDay } from "@/engine/career/development";
import { gearBuffLevels, gearTrainingBonus } from "@/engine/career/economy";
import { briefingEffectOf } from "@/engine/career/sunday";
import { coachProfileOf, packageEffectFor, paidSessionMultFor } from "@/engine/career/training";
import { userPlacement } from "@/engine/tournament";
import type { CareerSave } from "@/engine/career/types";
import { userTeamFor } from "@/engine/career/worldSim";
import type { StatKey, Stats } from "@/engine/types";
import { weeklyStatementOf } from "./careerFlow";
import { sundayAheadOf } from "./careerSunday";

export function auditStamp(s: CareerSave) {
  return { season: s.clock.seasonIndex + 1, day: s.clock.day, week: weekOfDay(s.clock.day),
    absoluteDay: s.clock.seasonIndex * DAYS_PER_SEASON + s.clock.day };
}
type Stamp = ReturnType<typeof auditStamp>;
export interface AuditMilestone extends Stamp { tier?: string; placement?: string }
type Effect = { rating: number; buffLevels: number; trainingBonus: number; fullDayGain: number; paidDayGain: number } & Stats;
export interface AuditAction extends Stamp {
  kind: string; item: string; cashDelta: number; weeklyCostDelta: number; effect: Effect;
  age?: number; overall?: number; playerKind?: string;
  briefing?: { requested: string; effective: string | null; tier: string; playing: boolean; swiss: number; playoffs: number };
}
export interface AuditSeasonSnapshot extends Stamp {
  moment: "start" | "end"; balance: number; debt: number; phase: string;
  end: CareerSave["end"]; statement: ReturnType<typeof weeklyStatementOf>;
}
export interface AuditEvent extends Stamp { id: string; tier: string; placement: string; swissWins: number; playoffWins: number }

/** Same-day marginal training gain at the actual player's current split/season/potential caps.
 * Full gain includes held cycle XP; paid gain is what can land along the way.
 * This is a local counterfactual, NOT a claim about causal wins or an entire future season.
 */
function effectsOf(s: CareerSave): Effect {
  const plan = s.training?.plan;
  const kind = weekAt(weekOfDay(s.clock.day)).kind;
  const prep = s.pendingEventDef !== null;
  const share = prep ? CAREER_TRAINING.matchPrepShare : 1;
  let fullDayGain = 0, paidDayGain = 0;
  for (const p of s.squad) {
    const fx = packageEffectFor(plan?.package ?? null, coachProfileOf(s.coach), p.id, { unsupervised: plan?.author === "coach" });
    const ctx = { seasonIndex: s.clock.seasonIndex, coachOverall: null, gearBonus: gearTrainingBonus(s.finances.gear),
      trainingWeekBonus: (kind === "open" || kind === "preseason") && !prep,
      splitGained: p.gainedThisSplit, seasonGained: p.gainedThisSeason, ...growthCtxOf(s), aging: true,
      packageMult: fx.sessionMult, offsetGrowth: fx.offsets, declineMult: fx.declineMult };
    fullDayGain += trainDay(p, ctx, share).gained;
    paidDayGain += trainDay(p, { ...ctx, packageMult: plan?.package ? paidSessionMultFor(fx.sessionMult) : fx.sessionMult }, share).gained;
  }
  const team = userTeamFor({ identity: s.identity, squad: s.squad, starterIds: s.starterIds, coach: s.coach,
    gear: s.finances.gear, bootcampSharp: s.finances.bootcampSharp, seasonIndex: s.clock.seasonIndex,
    careerSeed: s.careerSeed, difficulty: s.difficulty, unavailablePlayerId: null }).team;
  return { ...team.stats, rating: team.rating.total, buffLevels: gearBuffLevels(s.finances.gear),
    trainingBonus: gearTrainingBonus(s.finances.gear), fullDayGain, paidDayGain };
}
function delta(before: Effect, after: Effect): Effect {
  return Object.fromEntries(Object.keys(before).map(k => [k, after[k as keyof Effect] - before[k as keyof Effect]])) as Effect;
}

export function humanTelemetry() {
  const milestones: Record<string, AuditMilestone> = {};
  const actions: AuditAction[] = [], events: AuditEvent[] = [], seasonSnapshots: AuditSeasonSnapshot[] = [];
  const seenEvents = new Set<string>(), seenLedger = new Set<string>();
  const days = new Map<number, boolean>(), sampledWeeks = new Set<string>();
  const activeEffects: { season: number; item: string; samples: number; rating: number; fullDayGain: number; paidDayGain: number; stats: Stats }[] = [];
  const income: Record<string, number> = {}, spending: Record<string, number> = {};
  let emergencyLoans = 0, bankLoans = 0, minimumBalance = Infinity;
  let finalEnd: CareerSave["end"] | null = null;
  function mark(key: string, s: CareerSave, extra: Partial<AuditMilestone> = {}) {
    milestones[key] ??= { ...auditStamp(s), ...extra };
  }
  function remember(s: CareerSave) {
    if (!Number.isFinite(s.finances.balance) || s.squad.some(p => !Number.isFinite(p.salaryPerSplit))) throw Error("Non-finite audit finances");
    const stamp = auditStamp(s);
    days.set(stamp.absoluteDay, (days.get(stamp.absoluteDay) ?? false) || s.finances.balance < 0);
    minimumBalance = Math.min(minimumBalance, s.finances.balance);
    emergencyLoans = Math.max(emergencyLoans, s.finances.emergencyLoans ?? (s.finances.loanUsed ? 1 : 0));
    if (s.finances.balance < 0) mark("negative", s);
    if (s.finances.loan) mark("emergencyLoan", s);
    for (const l of s.finances.ledger) {
      if (seenLedger.has(l.id)) continue;
      seenLedger.add(l.id);
      const into = l.amount >= 0 ? income : spending;
      into[l.kind] = (into[l.kind] ?? 0) + Math.abs(l.amount);
      if (l.kind === "bankLoan") bankLoans++;
    }
    for (const e of s.eventResults) {
      const key = `${e.seasonIndex}:${e.eventId}`;
      if (!e.userPlacement || seenEvents.has(key)) continue;
      seenEvents.add(key);
      mark(e.tier, s, { placement: e.userPlacement });
      if (e.userPlacement === "champion") mark("title:" + e.tier, s);
      if (e.tier === "regional" && e.userPlacement !== "swiss_exit") mark("playoffs", s);
    }
    finalEnd = { ...s.end };
  }
  function onEvent(s: CareerSave) {
    const ev = s.activeEvent;
    if (!ev) return;
    const userSeries = (series: { teamAId: string; teamBId: string; winnerTeamId?: string | null }) => series.teamAId === "user" || series.teamBId === "user";
    const swiss = ev.tournament.swiss.rounds.flatMap(r => r.series).filter(userSeries);
    const playoffs = ev.tournament.playoffs?.rounds.flatMap(r => r.series).filter(userSeries) ?? [];
    if ([...swiss, ...playoffs].some(r => r.winnerTeamId === "user")) mark("firstSeries", s, { tier: ev.def.tier });
    // A Swiss entry is not a Swiss win. Keep both for a useful funnel.
    if (ev.def.tier === "regional") {
      mark("swiss", s);
      if (swiss.some(r => r.winnerTeamId === "user")) mark("swissWin", s);
      if (ev.tournament.playoffs?.seeds.includes("user")) mark("playoffs", s);
    }
    events.push({ ...auditStamp(s), id: ev.def.id, tier: ev.def.tier,
      placement: userPlacement(ev.tournament),
      swissWins: swiss.filter(r => r.winnerTeamId === "user").length,
      playoffWins: playoffs.filter(r => r.winnerTeamId === "user").length });
  }
  function onAction(kind: string, before: CareerSave, after: CareerSave, item: string) {
    remember(before); remember(after);
    const beforeStatement = weeklyStatementOf(before), afterStatement = weeklyStatementOf(after);
    const action: AuditAction = { ...auditStamp(after), kind, item,
      cashDelta: after.finances.balance - before.finances.balance,
      weeklyCostDelta: beforeStatement.net - afterStatement.net,
      effect: delta(effectsOf(before), effectsOf(after)) };
    if (kind === "signing") {
      const p = after.squad.find(p => p.id === item)!;
      action.age = ageOf(p.birthYear, after.clock.seasonIndex); action.overall = p.overall; action.playerKind = p.kind;
    }
    if (kind === "briefing") {
      const ahead = sundayAheadOf(before), choice = after.weekend?.briefing ?? null;
      action.briefing = { requested: item, effective: choice, tier: ahead?.def.tier ?? "unknown", playing: ahead?.playing ?? false,
        ...(choice ? briefingEffectOf(choice) : { swiss: 0, playoffs: 0 }) };
    }
    actions.push(action);
  }
  function onSeason(moment: "start" | "end", s: CareerSave) {
    remember(s);
    seasonSnapshots.push({ moment, ...auditStamp(s), balance: s.finances.balance,
      debt: (s.finances.loan?.remaining ?? 0) + (s.finances.bankLoan?.remaining ?? 0), phase: s.phase,
      end: { ...s.end }, statement: weeklyStatementOf(s) });
    if (moment === "end" && s.history.at(-1)?.userWorldsPlacement === "champion") mark("title:worlds", s);
  }
  function onDay(s: CareerSave) {
    remember(s);
    const key = `${s.clock.seasonIndex}:${weekOfDay(s.clock.day)}`;
    // One sample per active-plan week, not every render or repeated blocked day.
    if (!s.training?.plan?.package || sampledWeeks.has(key)) return;
    sampledWeeks.add(key);
    const full = effectsOf(s);
    const items: string[] = CAREER_GEAR.items.filter(g => s.finances.gear[g.id]).map(g => g.id);
    if (s.coach) items.push("coach");
    if (s.finances.gear.psychologist) items.push("psychologist");
    if (s.finances.bootcampSharp > 0) items.push("bootcamp");
    for (const item of items) {
      const without = { ...s, finances: { ...s.finances, gear: { ...s.finances.gear } } };
      if (item === "coach") without.coach = null;
      else if (item === "bootcamp") without.finances.bootcampSharp = 0;
      else without.finances.gear[item as keyof typeof without.finances.gear] = false;
      const effect = delta(effectsOf(without), full);
      let row = activeEffects.find(r => r.season === s.clock.seasonIndex + 1 && r.item === item);
      if (!row) { row = { season: s.clock.seasonIndex + 1, item, samples: 0, rating: 0, fullDayGain: 0, paidDayGain: 0, stats: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 } }; activeEffects.push(row); }
      row.samples++; row.rating += effect.rating; row.fullDayGain += effect.fullDayGain; row.paidDayGain += effect.paidDayGain;
      for (const key of Object.keys(row.stats) as StatKey[]) row.stats[key] += effect[key];
    }
  }
  function result() {
    const negativeDays = [...days.values()].filter(Boolean).length;
    let longestNegativeDays = 0, streak = 0, previous = -1;
    for (const [day, negative] of [...days].sort((a, b) => a[0] - b[0])) {
      streak = negative ? (day === previous + 1 ? streak + 1 : 1) : 0;
      longestNegativeDays = Math.max(longestNegativeDays, streak); previous = day;
    }
    return { milestones, events, actions, seasonSnapshots, activeEffects, finances: {
      observedDays: days.size, negativeDays, longestNegativeDays, emergencyLoans, bankLoans, minimumBalance,
      income, spending, end: finalEnd,
    } };
  }
  return { onDay, onSeason, onAction, onEvent, result };
}
