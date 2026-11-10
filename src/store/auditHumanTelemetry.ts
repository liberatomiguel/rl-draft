/** Audit-only observations. Counterfactuals call pure engine functions; no game state is patched. */
import { CAREER_GEAR, CAREER_SUNDAY, CAREER_TRAINING } from "@/config/balance";
import { DAYS_PER_SEASON, weekAt, weekOfDay } from "@/engine/career/calendar";
import { ageOf, growthCtxOf, growthModelOf, trainDay } from "@/engine/career/development";
import { renewalTermsFor } from "@/engine/career/renewal";
import { gearBuffLevels, gearTrainingBonus } from "@/engine/career/economy";
import { briefingEffectOf } from "@/engine/career/sunday";
import { coachProfileOf, packageEffectFor, paidSessionMultFor } from "@/engine/career/training";
import { userPlacement } from "@/engine/tournament";
import { placementOf } from "@/engine/career/careerResults";
import type { CareerSave, SundayBriefingChoice } from "@/engine/career/types";
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
  /** rc.37: a renewal against his fresh market ask (the "renewing is cheap" probe). */
  renewal?: { oldWage: number; newWage: number; freshAsk: number; bound: string; tenure: number; renewalCount: number; overall: number; age: number };
  briefing?: {
    requested: string; effective: string | null; tier: string; playing: boolean; swiss: number; playoffs: number;
    /** rc.37 F3: a hired coach (no coach = no briefing), the Sunday (regional / championship) and its per-round table. */
    coached?: boolean; stage?: string; quarters?: number; semis?: number; other?: number; final?: number;
  };
}
export interface AuditSeasonSnapshot extends Stamp {
  moment: "start" | "end"; balance: number; debt: number; phase: string;
  end: CareerSave["end"]; statement: ReturnType<typeof weeklyStatementOf>;
}
export interface AuditEvent extends Stamp {
  id: string; tier: string; placement: string; swissWins: number; playoffWins: number;
  /** rc.37: Swiss losses, and what the settlement paid: reputation delta, prize booked, the players' share (the rep / prize probes). */
  swissLosses?: number; repBefore?: number; repDelta?: number; prize?: number; playerShare?: number;
  /** rc.37 F6: a qualifier (Swiss-only) says whether the user went through to Sunday (its placement "top8"). */
  advanced?: boolean;
}

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

/**
 * rc.37 integration: the telemetry's whole state as plain data (Maps and Sets
 * structuredClone keeps), so a fork of a career (the paired Worlds
 * experiment) carries its observations so far and goes on independently.
 */
export interface TelemetryState {
  milestones: Record<string, AuditMilestone>;
  actions: AuditAction[];
  events: AuditEvent[];
  seasonSnapshots: AuditSeasonSnapshot[];
  seenEvents: Set<string>;
  seenLedger: Set<string>;
  days: Map<number, boolean>;
  sampledWeeks: Set<string>;
  activeEffects: { season: number; item: string; samples: number; rating: number; fullDayGain: number; paidDayGain: number; stats: Stats }[];
  income: Record<string, number>;
  spending: Record<string, number>;
  emergencyLoans: number;
  bankLoans: number;
  minimumBalance: number;
  /** rc.37: the lowest balance in weeks of payroll (the Backer's floor reads -8, the bank's offer a 4-week runway). */
  minimumPayrollWeeks: number;
  /** rc.37: the deepest red in weeks of payroll per season (season number -> weeks, <= 0). */
  redWeeksBySeason: Record<number, number>;
  finalEnd: CareerSave["end"] | null;
}

function newTelemetryState(): TelemetryState {
  return {
    milestones: {}, actions: [], events: [], seasonSnapshots: [],
    seenEvents: new Set(), seenLedger: new Set(), days: new Map(), sampledWeeks: new Set(),
    activeEffects: [], income: {}, spending: {},
    emergencyLoans: 0, bankLoans: 0, minimumBalance: Infinity, minimumPayrollWeeks: Infinity,
    redWeeksBySeason: {}, finalEnd: null,
  };
}

/** The briefing's numbers as the flow applies them: none without a hired coach (rc.37 F3), the Championship table on a two-day event. */
function briefingNumbersOf(choice: SundayBriefingChoice | null, coached: boolean, championship: boolean) {
  if (!choice || !coached) return { swiss: 0, playoffs: 0 };
  if (championship) return { swiss: 0, playoffs: 0, ...CAREER_SUNDAY.championshipBriefing[choice] };
  return briefingEffectOf(choice);
}

export function humanTelemetry(initial?: TelemetryState) {
  const st: TelemetryState = initial ?? newTelemetryState();
  const { milestones, actions, events, seasonSnapshots, seenEvents, seenLedger, days, sampledWeeks, activeEffects, income, spending } = st;
  function mark(key: string, s: CareerSave, extra: Partial<AuditMilestone> = {}) {
    milestones[key] ??= { ...auditStamp(s), ...extra };
  }
  function remember(s: CareerSave) {
    if (!Number.isFinite(s.finances.balance) || s.squad.some(p => !Number.isFinite(p.salaryPerSplit))) throw Error("Non-finite audit finances");
    const stamp = auditStamp(s);
    days.set(stamp.absoluteDay, (days.get(stamp.absoluteDay) ?? false) || s.finances.balance < 0);
    st.minimumBalance = Math.min(st.minimumBalance, s.finances.balance);
    if (s.finances.balance < 0) {
      const payroll = weeklyStatementOf(s).payroll;
      if (payroll > 0) {
        const weeks = s.finances.balance / payroll;
        st.minimumPayrollWeeks = Math.min(st.minimumPayrollWeeks, weeks);
        st.redWeeksBySeason[stamp.season] = Math.min(st.redWeeksBySeason[stamp.season] ?? 0, Math.round(weeks * 100) / 100);
      }
    }
    st.emergencyLoans = Math.max(st.emergencyLoans, s.finances.emergencyLoans ?? (s.finances.loanUsed ? 1 : 0));
    if (s.finances.balance < 0) mark("negative", s);
    if (s.finances.loan) mark("emergencyLoan", s);
    for (const l of s.finances.ledger) {
      if (seenLedger.has(l.id)) continue;
      seenLedger.add(l.id);
      const into = l.amount >= 0 ? income : spending;
      into[l.kind] = (into[l.kind] ?? 0) + Math.abs(l.amount);
      if (l.kind === "bankLoan") st.bankLoans++;
    }
    for (const e of s.eventResults) {
      const key = `${e.seasonIndex}:${e.eventId}`;
      if (!e.userPlacement || seenEvents.has(key)) continue;
      seenEvents.add(key);
      mark(e.tier, s, { placement: e.userPlacement });
      if (e.userPlacement === "champion") mark("title:" + e.tier, s);
      if (e.tier === "regional" && e.userPlacement !== "swiss_exit") mark("playoffs", s);
    }
    st.finalEnd = { ...s.end };
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
    // rc.37 F6: a Swiss-only qualifier places like the game books it (careerResults.placementOf:
    // "top8" = through, "swiss_exit" = out); tournament.userPlacement reads every Swiss-only row as an exit.
    const placement = ev.tournament.swissOnly ? placementOf(ev.tournament, "user") : userPlacement(ev.tournament);
    events.push({ ...auditStamp(s), id: ev.def.id, tier: ev.def.tier,
      placement, ...(ev.def.tier === "qualifier" ? { advanced: placement !== "swiss_exit" } : {}),
      swissWins: swiss.filter(r => r.winnerTeamId === "user").length,
      playoffWins: playoffs.filter(r => r.winnerTeamId === "user").length,
      swissLosses: swiss.filter(r => r.winnerTeamId && r.winnerTeamId !== "user").length });
  }
  /** rc.37: the event's settlement (finishEvent): the reputation and the prize it paid. */
  function onEventSettled(before: CareerSave, after: CareerSave) {
    const id = before.activeEvent?.def.id;
    const row = id ? [...events].reverse().find(e => e.id === id && e.repDelta === undefined) : undefined;
    if (!row) return;
    const seenIds = new Set(before.finances.ledger.map(l => l.id));
    const fresh = after.finances.ledger.filter(l => !seenIds.has(l.id));
    row.repBefore = before.reputation;
    row.repDelta = Math.round((after.reputation - before.reputation) * 100) / 100;
    row.prize = fresh.filter(l => l.kind === "prize").reduce((n, l) => n + l.amount, 0);
    row.playerShare = -fresh.filter(l => l.kind === "playerShare").reduce((n, l) => n + l.amount, 0);
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
    if (kind === "renewal") {
      const old = before.squad.find(p => p.id === item), now = after.squad.find(p => p.id === item);
      if (old && now) {
        const terms = renewalTermsFor(old, { rep: before.reputation, seasonIndex: before.clock.seasonIndex, difficulty: before.difficulty,
          careerSeed: before.careerSeed, lengthSeasons: 2, growthModel: growthModelOf(before.world) });
        action.renewal = { oldWage: old.salaryPerSplit, newWage: now.salaryPerSplit, freshAsk: terms.freshAsk, bound: terms.bound,
          tenure: terms.tenure, renewalCount: old.renewalCount ?? 0, overall: Math.round(old.overall * 10) / 10, age: ageOf(old.birthYear, before.clock.seasonIndex) };
      }
    }
    if (kind === "briefing") {
      // rc.37 F3: no hired coach = no briefing at all (the flow records the default, the edge is 0).
      const ahead = sundayAheadOf(before), recorded = after.weekend?.briefing ?? null, coached = Boolean(before.coach);
      const championship = ahead?.kind === "championship";
      action.briefing = { requested: item, effective: coached ? recorded : null, tier: ahead?.def.tier ?? "unknown",
        playing: ahead?.playing ?? false, coached, stage: ahead?.kind ?? "unknown",
        ...briefingNumbersOf(recorded, coached, championship) };
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
    const { emergencyLoans, bankLoans, minimumBalance, finalEnd } = st;
    const negativeDays = [...days.values()].filter(Boolean).length;
    let longestNegativeDays = 0, streak = 0, previous = -1;
    for (const [day, negative] of [...days].sort((a, b) => a[0] - b[0])) {
      streak = negative ? (day === previous + 1 ? streak + 1 : 1) : 0;
      longestNegativeDays = Math.max(longestNegativeDays, streak); previous = day;
    }
    return { milestones, events, actions, seasonSnapshots, activeEffects, finances: {
      observedDays: days.size, negativeDays, longestNegativeDays, emergencyLoans, bankLoans, minimumBalance,
      minimumPayrollWeeks: Number.isFinite(st.minimumPayrollWeeks) ? Math.round(st.minimumPayrollWeeks * 100) / 100 : null,
      redWeeksBySeason: { ...st.redWeeksBySeason },
      income, spending, end: finalEnd,
    } };
  }
  /** The state to clone at a fork (structuredClone; never shared between two live careers). */
  function state(): TelemetryState { return st; }
  return { onDay, onSeason, onAction, onEvent, onEventSettled, result, state };
}
