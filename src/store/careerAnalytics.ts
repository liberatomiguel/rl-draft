/**
 * Road to Worlds analytics (OBS-01, DESIGN-DECISIONS #145; the 2.0 launch
 * catalogue) — the career events of `docs/ANALYTICS-EVENTS-2.0.md`: one per
 * tournament, three split summaries and one review per season, the rare
 * decisions (transfers, staff, sponsor, debt) and the career's end. Nothing per
 * day advanced. DERIVED from one store write: the save as
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

import { CAREER_CALENDAR, CAREER_SAVE } from "@/config/balance";
import { firstDayOfWeek, splitOfWeek } from "@/engine/career/calendar";
import { rankByPoints } from "@/engine/career/careerResults";
import { ageOf, exactAgeOf, growthModelOf, readsUniformBand, scoutedBand } from "@/engine/career/development";
import { loanBreachesOf } from "@/engine/career/economy";
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
  | { kind: "renewCoach" }
  | { kind: "chooseSponsor" }
  /** A support-staff retainer switched (assistant / analyst / physio / brand / psychologist). */
  | { kind: "staff"; staffId: string }
  | { kind: "other" };

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
  // The band the screens show: the save's development model (rc.32 review);
  // rc.33 (DEV-04): with the age clock's cap and an older career's reports.
  const exactAge = exactAgeOf(ageOf(p.birthYear, save.clock.seasonIndex), save.clock.day);
  const band = scoutedBand(p.potential, p.overall, clampLevel(p.scoutLevel), save.careerSeed, p.id, growthModelOf(save.world), {
    arc: { peakAge: p.peakAge, exactAge },
    rc32Reports: save.bandModel === undefined,
    uniform: readsUniformBand(save.bandModel),
  });
  return (band.min + band.max) / 2;
}

/** Mean overall of the starters (the whole squad when none is marked), one decimal. */
function squadOverallOf(save: CareerSave): number {
  const starters = save.squad.filter((p) => p.role === "starter");
  const pool = starters.length > 0 ? starters : save.squad;
  if (pool.length === 0) return 0;
  return Math.round((pool.reduce((total, p) => total + p.overall, 0) / pool.length) * 10) / 10;
}

function payrollOf(save: CareerSave): number {
  return save.squad.reduce((total, p) => total + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0);
}

/** Support-staff retainers in force (the four roles and the psychologist). */
function staffCountOf(save: CareerSave): number {
  const gear = save.finances.gear;
  return Object.values(gear.staff ?? {}).filter(Boolean).length + (gear.psychologist ? 1 : 0);
}

function staffOn(save: CareerSave, staffId: string): boolean {
  const gear = save.finances.gear;
  if (staffId === "psychologist") return !!gear.psychologist;
  return !!(gear.staff as Record<string, boolean | undefined> | undefined)?.[staffId];
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

/**
 * One event per TOURNAMENT. A regional weekend is one tournament: a Saturday
 * qualifier the team got through is not reported on its own — it rides on
 * Sunday's regional as `qualifierPlacement`. A qualifier the team fell in is the
 * weekend's event (tier "qualifier", `qualified: false`).
 */
function eventCompletions(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  const banked = new Set(prev.eventResults.map((r) => r.eventId));
  const out: TrackedEvent[] = [];
  for (const r of next.eventResults) {
    if (banked.has(r.eventId)) continue;
    const row = r.rows.find((x) => x.ref === "user");
    const placement = r.userPlacement ?? row?.placement;
    if (!placement) continue; // an AI event the user did not play
    const qualified = r.tier === "qualifier" ? placement !== "swiss_exit" : null;
    if (qualified) continue; // reported with Sunday's regional
    const regionalWeek = r.tier === "qualifier" || r.tier === "regional";
    const seeding = [next.competition.weekSeeding, prev.competition.weekSeeding].find(
      (ws) => ws && ws.seasonIndex === r.seasonIndex && ws.week === r.week,
    );
    const active = prev.activeEvent?.def.id === r.eventId ? prev.activeEvent : null;
    // The user's own qualifier of that weekend (every region banks one the same week).
    const userPlacementIn = (q: (typeof next.eventResults)[number]) =>
      q.userPlacement ?? q.rows.find((x) => x.ref === "user")?.placement;
    const qualifier =
      r.tier === "regional"
        ? next.eventResults.find(
            (q) => q.tier === "qualifier" && q.seasonIndex === r.seasonIndex && q.week === r.week && userPlacementIn(q) !== undefined,
          )
        : undefined;
    const qualifierPlacement = qualifier ? (userPlacementIn(qualifier) ?? null) : null;
    const weekend = [prev.weekend, next.weekend].find((w) => w?.eventId === r.eventId);
    out.push({
      name: "career_event_completed",
      props: {
        careerId: careerIdOf(next),
        actionId: actionIdOf(next, "event", r.eventId),
        seasonIndex: r.seasonIndex,
        week: r.week,
        tier: r.tier,
        eventRegion: r.region ?? "international",
        placement,
        qualified: r.tier === "regional" && qualifierPlacement ? true : qualified,
        qualifierPlacement,
        watched: active?.watched ?? false,
        seedingDirect: regionalWeek && seeding ? seeding.direct.includes("user") : null,
        briefing: weekend?.briefing ?? null,
        squadOverall: squadOverallOf(next),
        balance: next.finances.balance,
      },
    });
  }
  return out;
}

function milestones(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  const hits: { kind: CareerMilestoneKind; ref: string; amount?: number }[] = [];
  const hit = (kind: CareerMilestoneKind, amount?: number) => hits.push({ kind, ref: kind, amount });
  if (titlesOf(prev) === 0 && titlesOf(next) > 0) hit("first_title");
  if ((prev.stats.majorsQualified ?? 0) === 0 && (next.stats.majorsQualified ?? 0) > 0) hit("first_major");
  if ((prev.stats.worldsQualified ?? 0) === 0 && (next.stats.worldsQualified ?? 0) > 0) hit("first_worlds");
  if ((prev.stats.titlesWorlds ?? 0) === 0 && (next.stats.titlesWorlds ?? 0) > 0) hit("worlds_title");
  // rc.33 review (ECO-08): every rescue, not only the first — the breach number rides in
  // the actionId (the event has no field for it). rc.34: every breach the bank covered (a
  // new emergency loan or a top-up; the kind keeps its "backer" name) — all but a breach
  // that ended the career in this write (`end.moneyCause` "breach").
  const endedByBreach =
    prev.end.reason !== "insolvency" && next.end.reason === "insolvency" && next.end.moneyCause === "breach";
  const lastRescue = loanBreachesOf(next.finances) - (endedByBreach ? 1 : 0);
  for (let b = loanBreachesOf(prev.finances) + 1; b <= lastRescue; b++) {
    hits.push({ kind: "backer", ref: `backer:${b}`, amount: next.finances.loan?.remaining ?? 0 });
  }
  if (!prev.finances.bankLoan && next.finances.bankLoan) hit("bank_loan", next.finances.bankLoan.remaining);
  // An insolvency is the career's end: `career_ended` (reason "insolvency") reports it.
  return hits.map(({ kind, ref, amount }) => ({
    name: "career_milestone",
    props: {
      careerId: careerIdOf(next),
      actionId: actionIdOf(next, "milestone", ref),
      seasonIndex: next.clock.seasonIndex,
      kind,
      amount: amount ?? null,
    },
  }));
}

/** The career closed in this write (a Worlds title, the timeline's end, insolvency, retirement). */
function careerEnds(prev: CareerSave, next: CareerSave): TrackedEvent[] {
  if (prev.end.ended || !next.end.ended) return [];
  return [
    {
      name: "career_ended",
      props: {
        careerId: careerIdOf(next),
        actionId: `${careerIdOf(next)}:ended`,
        seasonIndex: next.end.endedSeasonIndex ?? next.clock.seasonIndex,
        reason: next.end.reason ?? "unknown",
        legacyGrade: next.end.legacyGrade ?? null,
        titles: titlesOf(next),
        titlesWorlds: next.stats.titlesWorlds ?? 0,
        balance: next.finances.balance,
        rep: next.reputation,
      },
    },
  ];
}

const WAGE_KINDS: readonly LedgerKind[] = ["salary", "coachSalary", "payroll"];
const MARKET_KINDS: readonly LedgerKind[] = ["transferOut", "signingBonus", "releaseFee", "severance", "standInFee"];
/** Debt service is not spending on the club: it is reported as the debt going down. */
const DEBT_KINDS: readonly LedgerKind[] = ["loanGarnish", "loanPayment", "bankPayment"];

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
        payrollPerSplit: payrollOf(next),
        incomePrize: sumKinds(lines, ["prize"]),
        // rc.34 (ECO-04): a Bold deal's milestone is sponsor income too (fines are spending).
        incomeSponsor: sumKinds(lines, ["sponsorBase", "sponsorBonus", "sponsorSigning", "sponsorMilestone"]),
        incomeFanbase: sumKinds(lines, ["fanbase"]),
        incomeTransfers: sumKinds(lines, ["transferIn"]),
        // Spending is reported positive: wages (squad, coach), the market, and every other outflow.
        spendWages: -sumKinds(lines, WAGE_KINDS),
        spendTransfers: -sumKinds(lines, MARKET_KINDS),
        spendOther: -lines
          .filter((e) => e.amount < 0 && !WAGE_KINDS.includes(e.kind) && !MARKET_KINDS.includes(e.kind) && !DEBT_KINDS.includes(e.kind))
          .reduce((total, e) => total + e.amount, 0),
        debtBacker: next.finances.loan?.remaining ?? 0,
        debtBank: next.finances.bankLoan?.remaining ?? 0,
        splitRank: rank >= 0 ? rank + 1 : null,
        ledgerComplete,
        squadOverall: squadOverallOf(next),
        squadSize: next.squad.length,
        coachOverall: next.coach?.overall ?? null,
        sponsorTier: next.sponsor?.tier ?? null,
        trainingMode: next.training?.mode ?? null,
        staffCount: staffCountOf(next),
        rep: next.reputation,
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
        region: next.identity.region,
        difficulty: next.difficulty,
        regionRank: h.userRegionRank,
        seasonPoints: h.userSeasonPoints,
        majorsQualified: h.majorsQualified,
        worldsPlacement: h.userWorldsPlacement ?? null,
        grade: h.grade,
        earnings: h.earnings,
        balance: h.balanceEnd,
        rep: h.repEnd,
        titlesSeason: h.titles,
        titlesTotal: titlesOf(next),
        titlesWorlds: next.stats.titlesWorlds ?? 0,
        squadOverall: squadOverallOf(next),
        squadSize: next.squad.length,
        squadAvgAge:
          next.squad.length > 0
            ? Math.round((next.squad.reduce((total, p) => total + ageOf(p.birthYear, h.seasonIndex), 0) / next.squad.length) * 10) / 10
            : 0,
        payrollPerSplit: payrollOf(next),
        coachOverall: next.coach?.overall ?? null,
        sponsorTier: next.sponsor?.tier ?? null,
        sponsorProfile: next.sponsor?.terms?.profile ?? null,
        trainingMode: next.training?.mode ?? null,
        staffCount: staffCountOf(next),
        debtBacker: next.finances.loan?.remaining ?? 0,
        debtBank: next.finances.bankLoan?.remaining ?? 0,
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
  warned = false,
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
      warned,
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
      out.push(transferProps(next, p, "sell", fee, wasWarned(prev, p)));
    } else {
      const severance = newLedger
        .filter((e) => e.kind === "severance" && e.refName === p.name)
        .reduce((total, e) => total - e.amount, 0);
      out.push(transferProps(next, p, "release", severance, wasWarned(prev, p)));
    }
  }
  for (const p of next.squad) {
    if (prevIds.has(p.id)) {
      const before = prev.squad.find((x) => x.id === p.id)!;
      const renewed =
        p.contractEndSeason !== before.contractEndSeason || p.salaryPerSplit !== before.salaryPerSplit;
      if (action.kind === "renew" && p.id === action.playerId && renewed) {
        out.push(transferProps(next, p, "renew", 0, wasWarned(prev, before)));
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
  if (action.kind === "renewCoach" && prev.coach && next.coach && next.coach.id === prev.coach.id && next.coach !== prev.coach) {
    return [
      {
        name: "career_staff",
        props: {
          ...base,
          actionId: actionIdOf(next, "coach_renewed", next.coach.id),
          kind: "coach_renewed",
          overall: next.coach.overall,
          salaryPerSplit: next.coach.salaryPerSplit,
        },
      },
    ];
  }
  if (action.kind === "staff" && staffOn(prev, action.staffId) !== staffOn(next, action.staffId)) {
    const kind = staffOn(next, action.staffId) ? "staff_on" : "staff_off";
    return [
      {
        name: "career_staff",
        props: { ...base, actionId: actionIdOf(next, kind, action.staffId), kind, staffId: action.staffId },
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
          // rc.34 (ECO-04): the first goal's kind and the profile of a deal signed since rc.34.
          objectiveKind: next.sponsor.terms?.goals[0]?.kind ?? next.sponsor.objectiveKind,
          ...(next.sponsor.terms ? { profile: next.sponsor.terms.profile } : {}),
        },
      },
    ];
  }
  return [];
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
    ...eventCompletions(prev, next),
    ...milestones(prev, next),
    ...splitSummaries(prev, next),
    ...seasonReviews(prev, next),
    ...careerEnds(prev, next),
  ];
}

/** `career_created`, from the save the wizard just founded. */
export function careerCreatedEvent(save: CareerSave, rosterKey: string, slot?: number): TrackedEvent {
  return {
    name: "career_created",
    props: {
      careerId: careerIdOf(save),
      actionId: actionIdOf(save, "created", "career"),
      region: save.identity.region,
      difficulty: save.difficulty,
      rosterKey,
      startOverall: squadOverallOf(save),
      startBalance: save.finances.balance,
      slot: slot ?? null,
    },
  };
}
