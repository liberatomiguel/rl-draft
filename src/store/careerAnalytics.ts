/**
 * Road to Worlds analytics (OBS-01, DESIGN-DECISIONS #145) — the career events
 * of `docs/ANALYTICS-EVENTS-2.0.md`, DERIVED from one store write: the save as
 * it was before the action and the save the career store just wrote. Pure: no
 * clock, no storage, no sending — `careerStore.ts` sends the list it returns,
 * right after `set()`.
 *
 * Why a diff of the write instead of calls inside `careerFlow.ts`: the flows
 * are shared with the arc bot and the other fronts, and an event read off the
 * write fires exactly once per saved change whatever path banked it (a watched
 * event, an instant sim, an Advance that resolved the day). A reload only
 * rehydrates — it never re-runs an action — so it can never fire one again.
 *
 * Spoiler-safe and anonymous: the potential is always the band the screens
 * show (`scoutedBand` at the level the player paid for), never the hidden
 * value; no names (org, manager, players) are ever sent — refs and ids only.
 */

import { CAREER_CALENDAR, CAREER_SAVE, CAREER_SCOUT } from "@/config/balance";
import { firstDayOfWeek, splitOfWeek } from "@/engine/career/calendar";
import { rankByPoints } from "@/engine/career/careerResults";
import { ageOf, growthModelOf, playerViewById, scoutedBand } from "@/engine/career/development";
import { deriveSeed } from "@/engine/career/seeds";
import type { CareerSave, LedgerEntry, LedgerKind, ScoutLevel, SquadPlayer } from "@/engine/career/types";
import type { CareerMilestoneKind, TrackedEvent } from "@/lib/analytics";

/** What the store action was, when the event depends on the user's intent. */
export type CareerAction =
  | { kind: "sign"; playerId: string }
  | { kind: "release"; playerId: string }
  | { kind: "renew"; playerId: string }
  | { kind: "sell"; offerId: string }
  | { kind: "hireCoach" }
  | { kind: "fireCoach" }
  | { kind: "chooseSponsor" }
  | { kind: "scout"; playerId: string }
  | { kind: "readMail"; mailId: string }
  | { kind: "other" };

/** Career onboarding explainers that report `ux_tutorial` when first closed. */
const CAREER_TUTORIAL_FLAGS = ["seenHub"] as const;

/**
 * The Mondays that close a split: the week after each split's last week
 * (weeks 11 / 21 / 31 today — the weeks `processDayArrival` runs the split
 * boundary). Derived from the calendar so a calendar change moves them too.
 */
export const SPLIT_BOUNDARY_WEEKS: readonly number[] = ([1, 2, 3] as const).map((split) => {
  let last = 0;
  for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) if (splitOfWeek(w) === split) last = w;
  return last + 1;
});

/** The save's anonymous analytics id: stamped at creation; derived for older saves. */
export function careerIdOf(save: CareerSave): string {
  if (save.careerId) return save.careerId;
  const h = deriveSeed(save.careerSeed, "analytics:careerId") >>> 0;
  return `c${h.toString(16).padStart(8, "0")}`;
}

function actionIdOf(save: CareerSave, kind: string, ref: string | number): string {
  return `${careerIdOf(save)}:${save.clock.seasonIndex}:${save.clock.day}:${kind}:${ref}`;
}

function titlesOf(save: CareerSave): number {
  const s = save.stats;
  return (s.titlesT3 ?? 0) + (s.titlesT2 ?? 0) + (s.titlesRegional ?? 0) + (s.titlesMajor ?? 0) + (s.titlesWorlds ?? 0);
}

function clampLevel(level: number): ScoutLevel {
  return Math.min(3, Math.max(0, Math.floor(level))) as ScoutLevel;
}

/** Midpoint of the band the squad screen shows for this player. */
function bandMidOf(save: CareerSave, p: SquadPlayer): number {
  // The band the screens show: the save's development model (rc.32 review).
  const band = scoutedBand(p.potential, p.overall, clampLevel(p.scoutLevel), save.careerSeed, p.id, growthModelOf(save.world));
  return (band.min + band.max) / 2;
}

/** Bucketed headroom (band midpoint − overall). Bucket edges are reporting only. */
export function headroomBucket(headroom: number): string {
  if (headroom <= 0) return "0";
  if (headroom <= 2) return "1-2";
  if (headroom <= 5) return "3-5";
  if (headroom <= 9) return "6-9";
  return "10+";
}

function ledgerDayOf(e: LedgerEntry): number {
  return e.day ?? firstDayOfWeek(e.week);
}

function newById<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  const known = new Set(before.map((x) => x.id));
  return after.filter((x) => !known.has(x.id));
}

// ---------------------------------------------------------------------------
// Detectors (each returns the events one write produced)
// ---------------------------------------------------------------------------

function eventCompletions(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  const banked = new Set(prev.eventResults.map((r) => r.eventId));
  const out: TrackedEvent[] = [];
  for (const r of next.eventResults) {
    if (banked.has(r.eventId)) continue;
    const row = r.rows.find((x) => x.ref === "user");
    const placement = r.userPlacement ?? row?.placement;
    if (!placement) continue; // an AI event the user did not play
    const regionalWeek = r.tier === "qualifier" || r.tier === "regional";
    const seeding = [next.competition.weekSeeding, prev.competition.weekSeeding].find(
      (ws) => ws && ws.seasonIndex === r.seasonIndex && ws.week === r.week,
    );
    const active = prev.activeEvent?.def.id === r.eventId ? prev.activeEvent : null;
    out.push({
      name: "career_event_completed",
      props: {
        careerId: careerIdOf(next),
        actionId: actionIdOf(next, "event", r.eventId),
        seasonIndex: r.seasonIndex,
        tier: r.tier,
        eventRegion: r.region ?? "international",
        placement,
        qualified: r.tier === "qualifier" ? placement !== "swiss_exit" : null,
        watched: active?.watched ?? false,
        seedingDirect: regionalWeek && seeding ? seeding.direct.includes("user") : null,
      },
    });
  }
  return out;
}

function milestones(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  const hits: CareerMilestoneKind[] = [];
  if (titlesOf(prev) === 0 && titlesOf(next) > 0) hits.push("first_title");
  if ((prev.stats.majorsQualified ?? 0) === 0 && (next.stats.majorsQualified ?? 0) > 0) hits.push("first_major");
  if ((prev.stats.worldsQualified ?? 0) === 0 && (next.stats.worldsQualified ?? 0) > 0) hits.push("first_worlds");
  if ((prev.stats.titlesWorlds ?? 0) === 0 && (next.stats.titlesWorlds ?? 0) > 0) hits.push("worlds_title");
  if (!prev.finances.loanUsed && next.finances.loanUsed) hits.push("backer");
  if (!prev.finances.bankLoan && next.finances.bankLoan) hits.push("bank_loan");
  if (prev.end.reason !== "insolvency" && next.end.reason === "insolvency") hits.push("insolvency");
  return hits.map((kind) => ({
    name: "career_milestone",
    props: {
      careerId: careerIdOf(next),
      actionId: actionIdOf(next, "milestone", kind),
      seasonIndex: next.clock.seasonIndex,
      kind,
    },
  }));
}

function sumKinds(entries: readonly LedgerEntry[], kinds: readonly LedgerKind[]): number {
  return entries.filter((e) => kinds.includes(e.kind)).reduce((total, e) => total + e.amount, 0);
}

function splitSummaries(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  if (prev.clock.seasonIndex !== next.clock.seasonIndex) return [];
  const seasonIndex = next.clock.seasonIndex;
  const out: TrackedEvent[] = [];
  SPLIT_BOUNDARY_WEEKS.forEach((week, i) => {
    const boundaryDay = firstDayOfWeek(week);
    if (!(prev.clock.day < boundaryDay && next.clock.day >= boundaryDay)) return;
    const startDay = i === 0 ? 0 : firstDayOfWeek(SPLIT_BOUNDARY_WEEKS[i - 1]);
    const ledger = next.finances.ledger;
    const lines = ledger.filter(
      (e) => e.seasonIndex === seasonIndex && ledgerDayOf(e) > startDay && ledgerDayOf(e) <= boundaryDay,
    );
    const oldest = ledger[0];
    const ledgerComplete =
      ledger.length < CAREER_SAVE.ledgerTailCap ||
      !oldest ||
      oldest.seasonIndex < seasonIndex ||
      (oldest.seasonIndex === seasonIndex && ledgerDayOf(oldest) <= startDay);
    const region = next.identity.region;
    const order = rankByPoints(next.competition.splitPoints[region] ?? {}, region, next.careerSeed);
    const rank = order.indexOf("user");
    const split = i + 1;
    out.push({
      name: "career_split_summary",
      props: {
        careerId: careerIdOf(next),
        actionId: `${careerIdOf(next)}:${seasonIndex}:${boundaryDay}:split:${split}`,
        seasonIndex,
        split,
        balance: next.finances.balance,
        payrollPerSplit:
          next.squad.reduce((total, p) => total + p.salaryPerSplit, 0) + (next.coach?.salaryPerSplit ?? 0),
        incomePrize: sumKinds(lines, ["prize"]),
        incomeSponsor: sumKinds(lines, ["sponsorBase", "sponsorBonus", "sponsorSigning"]),
        incomeFanbase: sumKinds(lines, ["fanbase"]),
        incomeTransfers: sumKinds(lines, ["transferIn"]),
        debtBacker: next.finances.loan?.remaining ?? 0,
        debtBank: next.finances.bankLoan?.remaining ?? 0,
        splitRank: rank >= 0 ? rank + 1 : null,
        ledgerComplete,
      },
    });
  });
  return out;
}

function seasonReviews(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  const reviewed = new Set(prev.history.map((h) => h.seasonIndex));
  return next.history
    .filter((h) => !reviewed.has(h.seasonIndex))
    .map((h) => ({
      name: "career_season_completed" as const,
      props: {
        careerId: careerIdOf(next),
        actionId: `${careerIdOf(next)}:${h.seasonIndex}:${next.clock.day}:season:${h.seasonIndex}`,
        seasonIndex: h.seasonIndex,
        regionRank: h.userRegionRank,
        seasonPoints: h.userSeasonPoints,
        majorsQualified: h.majorsQualified,
        worldsPlacement: h.userWorldsPlacement ?? null,
        grade: h.grade,
        balance: h.balanceEnd,
        rep: h.repEnd,
      },
    }));
}

/** A contract-expiry warning was mailed for this player this season. */
function wasWarned(save: CareerSave, p: SquadPlayer): boolean {
  return save.mail.some(
    (m) => m.kind === "contract" && m.seasonIndex === save.clock.seasonIndex && m.params?.player === p.name,
  );
}

function transferProps(
  save: CareerSave,
  p: SquadPlayer,
  kind: "sign" | "sell" | "release" | "renew",
  fee: number,
): TrackedEvent {
  return {
    name: "career_transfer",
    props: {
      careerId: careerIdOf(save),
      actionId: actionIdOf(save, kind, p.id),
      seasonIndex: save.clock.seasonIndex,
      kind,
      overall: p.overall,
      age: ageOf(p.birthYear, save.clock.seasonIndex),
      potentialBandMid: bandMidOf(save, p),
      fee,
      salaryPerSplit: p.salaryPerSplit,
      role: p.role,
    },
  };
}

function contractOutcome(save: CareerSave, outcome: "renewed" | "released" | "let_go", ref: string): TrackedEvent {
  return {
    name: "ux_contract_warning",
    props: {
      gameMode: "career",
      careerId: careerIdOf(save),
      actionId: actionIdOf(save, `contract_${outcome}`, ref),
      outcome,
    },
  };
}

function transfers(prev: CareerSave, next: CareerSave, action: CareerAction): TrackedEvent[] {
  if (action.kind !== "sign" && action.kind !== "release" && action.kind !== "renew" && action.kind !== "sell") {
    return [];
  }
  const out: TrackedEvent[] = [];
  const prevIds = new Set(prev.squad.map((p) => p.id));
  const nextIds = new Set(next.squad.map((p) => p.id));
  const newLog = newById(prev.transferLog, next.transferLog);
  const newLedger = newById(prev.finances.ledger, next.finances.ledger);

  // Who left first (a full squad's signing names the leaver in the same deal).
  for (const p of prev.squad) {
    if (nextIds.has(p.id)) continue;
    if (action.kind === "sell") {
      const fee =
        newLog.find((t) => t.kind === "userOut" && t.playerId === p.id)?.fee ??
        prev.pendingOffers.find((o) => o.id === action.offerId)?.fee ??
        0;
      out.push(transferProps(next, p, "sell", fee));
    } else {
      const severance = newLedger
        .filter((e) => e.kind === "severance" && e.refName === p.name)
        .reduce((total, e) => total - e.amount, 0);
      out.push(transferProps(next, p, "release", severance));
      if (wasWarned(prev, p)) out.push(contractOutcome(next, "released", p.id));
    }
  }
  for (const p of next.squad) {
    if (prevIds.has(p.id)) {
      const before = prev.squad.find((x) => x.id === p.id)!;
      const renewed =
        p.contractEndSeason !== before.contractEndSeason || p.salaryPerSplit !== before.salaryPerSplit;
      if (action.kind === "renew" && p.id === action.playerId && renewed) {
        out.push(transferProps(next, p, "renew", 0));
        if (wasWarned(prev, before)) out.push(contractOutcome(next, "renewed", p.id));
      }
      continue;
    }
    const fee = newLog.find((t) => t.kind === "userIn" && t.playerId === p.id)?.fee ?? 0;
    out.push(transferProps(next, p, "sign", fee));
  }
  return out;
}

function staff(prev: CareerSave, next: CareerSave, action: CareerAction): TrackedEvent[] {
  const base = { careerId: careerIdOf(next), seasonIndex: next.clock.seasonIndex };
  if (action.kind === "hireCoach" && next.coach && next.coach.id !== prev.coach?.id) {
    return [
      {
        name: "career_staff",
        props: {
          ...base,
          actionId: actionIdOf(next, "coach_hired", next.coach.id),
          kind: "coach_hired",
          overall: next.coach.overall,
          salaryPerSplit: next.coach.salaryPerSplit,
        },
      },
    ];
  }
  if (action.kind === "fireCoach" && prev.coach && !next.coach) {
    return [
      {
        name: "career_staff",
        props: {
          ...base,
          actionId: actionIdOf(next, "coach_fired", prev.coach.id),
          kind: "coach_fired",
          overall: prev.coach.overall,
          salaryPerSplit: prev.coach.salaryPerSplit,
        },
      },
    ];
  }
  if (action.kind === "chooseSponsor" && next.sponsor && next.sponsor.sponsorId !== prev.sponsor?.sponsorId) {
    return [
      {
        name: "career_staff",
        props: {
          ...base,
          actionId: actionIdOf(next, "sponsor_signed", next.sponsor.sponsorId),
          kind: "sponsor_signed",
          tier: next.sponsor.tier,
          basePerSplit: next.sponsor.basePerSplit,
          objectiveKind: next.sponsor.objectiveKind,
        },
      },
    ];
  }
  return [];
}

function scoutReports(prev: CareerSave, next: CareerSave, action: CareerAction): TrackedEvent[] {
  if (action.kind !== "scout") return [];
  const id = action.playerId;
  const level = Number(next.scouted[id] ?? 0);
  if (!(level > Number(prev.scouted[id] ?? 0))) return [];
  const seasonIndex = next.clock.seasonIndex;
  const own = next.squad.find((p) => p.id === id);
  const view = own
    ? { overall: own.overall, potential: own.potential, age: ageOf(own.birthYear, seasonIndex) }
    : playerViewById(id, { careerSeed: next.careerSeed, seasonIndex, world: next.world });
  if (!view) return [];
  const band = scoutedBand(
    view.potential,
    view.overall,
    clampLevel(Math.min(level, CAREER_SCOUT.reportMaxLevel)),
    next.careerSeed,
    id,
    growthModelOf(next.world),
  );
  return [
    {
      name: "career_scout_report",
      props: {
        careerId: careerIdOf(next),
        actionId: actionIdOf(next, "scout", id),
        seasonIndex,
        level,
        age: view.age,
        headroomBand: headroomBucket((band.min + band.max) / 2 - view.overall),
      },
    },
  ];
}

function mailReads(prev: CareerSave, next: CareerSave, action: CareerAction): TrackedEvent[] {
  if (action.kind !== "readMail") return [];
  const before = prev.mail.find((m) => m.id === action.mailId);
  const after = next.mail.find((m) => m.id === action.mailId);
  if (!before || before.read || !after?.read) return [];
  if (after.kind === "contract") {
    return [
      {
        name: "ux_contract_warning",
        props: {
          gameMode: "career",
          careerId: careerIdOf(next),
          actionId: actionIdOf(next, "contract_seen", after.id),
          outcome: "seen",
        },
      },
    ];
  }
  if (after.kind === "unlock") {
    const unlock = String(after.params?.name ?? after.titleKey);
    return [
      {
        name: "ux_unlock_seen",
        props: {
          gameMode: "career",
          actionId: `${careerIdOf(next)}:unlock_seen:toolbox:${unlock}`,
          kind: "toolbox",
          id: unlock,
        },
      },
    ];
  }
  return [];
}

/** Players whose contract ran out at the rollover and left (retirements excluded). */
function lettingGo(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  if (next.clock.seasonIndex <= prev.clock.seasonIndex) return [];
  const kept = new Set(next.squad.map((p) => p.id));
  const retired = new Set(next.world.retiredIds);
  return prev.squad
    .filter((p) => p.contractEndSeason < next.clock.seasonIndex && !kept.has(p.id) && !retired.has(p.id))
    .map((p) => contractOutcome(next, "let_go", p.id));
}

function tutorials(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  return CAREER_TUTORIAL_FLAGS.filter((f) => !prev.flags[f] && next.flags[f]).map((f) => ({
    name: "ux_tutorial" as const,
    props: {
      gameMode: "career" as const,
      actionId: `${careerIdOf(next)}:tutorial:${f}`,
      id: f,
      step: 1,
      outcome: "completed" as const,
    },
  }));
}

/**
 * Every career event one store write produced, in a stable order. `prev` is
 * the save before the action; `next` the save the store wrote.
 */
export function careerEventsFor(prev: CareerSave, next: CareerSave, action: CareerAction = { kind: "other" }): TrackedEvent[] {
  if (prev === next) return [];
  return [
    ...transfers(prev, next, action),
    ...staff(prev, next, action),
    ...scoutReports(prev, next, action),
    ...mailReads(prev, next, action),
    ...eventCompletions(prev, next),
    ...milestones(prev, next),
    ...splitSummaries(prev, next),
    ...seasonReviews(prev, next),
    ...lettingGo(prev, next),
    ...tutorials(prev, next),
  ];
}

/** `career_created`, from the save the wizard just founded. */
export function careerCreatedEvent(save: CareerSave, rosterKey: string): TrackedEvent {
  return {
    name: "career_created",
    props: {
      careerId: careerIdOf(save),
      actionId: actionIdOf(save, "created", "career"),
      region: save.identity.region,
      difficulty: save.difficulty,
      rosterKey,
    },
  };
}
