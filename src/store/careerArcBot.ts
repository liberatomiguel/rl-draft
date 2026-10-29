/**
 * Road to Worlds — the long-career bot manager (rc.30, ROADMAP Etapa 2a OBS-02).
 *
 * TEST SUPPORT ONLY: imported by `careerArc.test.ts`, never by the app. It plays
 * whole careers headlessly through the REAL flow functions (the calls the store
 * makes) under simple, deterministic manager policies, and records one row of
 * metrics per season: money (balance, low point, debt, payroll, income and
 * spending by ledger kind), the competitive arc (rank, Majors, Worlds, titles)
 * and the squad (age, overall, potential). Policies decide only from what the
 * screens show (the scouted potential band, never the hidden truth). The
 * matrix runner and the report live in the test file.
 */

import { CAREER_UNLOCKS } from "@/config/balance";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  isWindowStartWeek,
  isWindowWeek,
  seasonLabelFor,
  weekOfDay,
} from "@/engine/career/calendar";
import { ageOf, growthModelOf, playerViewById, scoutedBand } from "@/engine/career/development";
import { quantize, signableOverallCap, weeklyOf } from "@/engine/career/economy";
import { askPackageFor, listingFor } from "@/engine/career/market";
import type { CareerDifficulty, CareerEndReason, CareerPlayerView, CareerPrefs, CareerSave, ScoutLevel } from "@/engine/career/types";
import type { Placement, Region } from "@/engine/types";
import {
  acceptBidFlow,
  advanceDayFlow,
  chooseSponsorFlow,
  coachCandidatesFor,
  createCareerSave,
  declineBidFlow,
  finishEvent,
  hireCoachFlow,
  isEventPaused,
  releasePlayerFlow,
  renewPlayerFlow,
  resolveInsertFlow,
  rolloverToNextSeason,
  runScrimFlow,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  takeBankLoanFlow,
  userSeedRatingFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type ArcPolicyId =
  | "autopilot"
  | "tuned"
  | "youth"
  | "spender"
  | "badSponsor"
  | "losingStart"
  | "coachChurn";

export interface ArcPolicy {
  id: ArcPolicyId;
  /** The founding roster the wizard offers (prospects = the weakest start). */
  rosterKey: CreateCareerInput["rosterKey"];
  /** Sponsor pick: the richest base deal, or the poorest one (the "bad sponsor" case). */
  sponsor: "best" | "worst";
  /**
   * Window moves: "keep" only fills an open starter seat; "upgrade" replaces
   * the weakest starter with a clearly better affordable player; "youth"
   * signs the best young prospects by the scouted band; "stars" chases the
   * best overall it can pay for (and borrows to do it).
   */
  market: "keep" | "upgrade" | "youth" | "stars";
  /** Renew every expiring player, or only those still worth a starting seat. */
  renew: "all" | "selective";
  /** No coach, the best affordable one, or a new one every season (coach change). */
  coach: "none" | "best" | "churn";
  /** Scrim on Tuesdays and Thursdays. */
  scrims: boolean;
  /** Take a bank loan when the balance goes negative. */
  bank: boolean;
  /** Incoming bids: always declined, or accepted while the runway is under eight weeks. */
  bids: "decline" | "whenTight";
}

const base: Omit<ArcPolicy, "id"> = {
  rosterKey: "balanced",
  sponsor: "best",
  market: "keep",
  renew: "all",
  coach: "none",
  scrims: false,
  bank: false,
  bids: "decline",
};

export const ARC_POLICIES: Record<ArcPolicyId, ArcPolicy> = {
  /** The median, hands-off manager: takes the best sponsor, renews everyone, never shops. */
  autopilot: { id: "autopilot", ...base },
  /** The engaged manager chasing titles: upgrades, coach, scrims, selective renewals. */
  tuned: { id: "tuned", ...base, market: "upgrade", renew: "selective", coach: "best", scrims: true, bids: "whenTight" },
  /** A youth core: the prospects start, young high-potential signings, everyone renewed. */
  youth: { id: "youth", ...base, rosterKey: "prospects", market: "youth", coach: "best", scrims: true, bids: "whenTight" },
  /** A costly squad: stars first, borrowing to pay for them. */
  spender: {
    id: "spender",
    ...base,
    rosterKey: "journeymen",
    market: "stars",
    renew: "selective",
    coach: "best",
    scrims: true,
    bank: true,
  },
  /** The autopilot stuck with the poorest sponsor deal. */
  badSponsor: { id: "badSponsor", ...base, sponsor: "worst" },
  /** The weakest founding roster, hands-off. */
  losingStart: { id: "losingStart", ...base, rosterKey: "prospects" },
  /** The tuned manager who changes coach every season. */
  coachChurn: {
    id: "coachChurn",
    ...base,
    market: "upgrade",
    renew: "selective",
    coach: "churn",
    scrims: true,
    bids: "whenTight",
  },
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface ArcSquadRow {
  id: string;
  kind: string;
  role: string;
  age: number;
  overall: number;
  potential: number;
  joinedSeason: number;
}

export interface ArcSeason {
  seasonIndex: number;
  label: string;
  balanceEnd: number;
  balanceMin: number;
  /** Mondays the books closed below zero. */
  mondaysNegative: number;
  /** Emergency Backer + bank loan still owed at the season's end. */
  debtEnd: number;
  backerActive: boolean;
  bankLoans: number;
  /** Squad wages + coach, per split, at the season's end. */
  payrollPerSplit: number;
  sponsorBasePerSplit: number;
  /** Weekly net of the standing commitments (sponsor + fanbase − wages, staff, upkeep, instalments). */
  weeklyNet: number;
  /** Ledger money in / out this season, by kind (out as positive numbers). */
  income: Record<string, number>;
  spend: Record<string, number>;
  regionRank: number;
  seasonPoints: number;
  majorsQualified: number;
  worlds: Placement | null;
  titles: number;
  rep: number;
  teamRating: number;
  signings: number;
  /** Signings at 88+ overall (the "stars"). */
  starSignings: number;
  /** Players sold to an incoming bid. */
  sales: number;
  squad: ArcSquadRow[];
}

export interface ArcCareer {
  region: Region;
  difficulty: CareerDifficulty;
  policy: ArcPolicyId;
  seed: number;
  seasons: ArcSeason[];
  /** Why the career stopped before its last season (insolvency, a softlock), else null. */
  ended: CareerEndReason | "softlock" | null;
  softlock: string | null;
  firstMajorSeason: number | null;
  firstWorldsSeason: number | null;
  worldsTitleSeason: number | null;
  ms: number;
}

/** Running tallies for the season in progress. */
interface Tally {
  seenLedger: Set<string>;
  income: Record<string, number>;
  spend: Record<string, number>;
  balanceMin: number;
  mondaysNegative: number;
  bankLoans: number;
  signings: number;
  starSignings: number;
  sales: number;
}

function newTally(save: CareerSave, seen: Set<string>): Tally {
  return {
    seenLedger: seen,
    income: {},
    spend: {},
    balanceMin: save.finances.balance,
    mondaysNegative: 0,
    bankLoans: 0,
    signings: 0,
    starSignings: 0,
    sales: 0,
  };
}

/** Books every ledger line not seen yet (ids are unique; the tail is a ring buffer). */
function track(save: CareerSave, t: Tally): void {
  for (const line of save.finances.ledger) {
    if (t.seenLedger.has(line.id)) continue;
    t.seenLedger.add(line.id);
    const into = line.amount >= 0 ? t.income : t.spend;
    into[line.kind] = (into[line.kind] ?? 0) + Math.abs(line.amount);
  }
  t.balanceMin = Math.min(t.balanceMin, save.finances.balance);
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** rc.32: the statement the Monday books (the season's money index, the founding partner) — what Finances shows. */
function statementOf(save: CareerSave) {
  return weeklyStatementOf(save);
}

/** Can the books carry `extraPerSplit` more in wages and `cost` up front? */
function affordable(save: CareerSave, cost: number, extraPerSplit: number, policy: ArcPolicy): boolean {
  const stmt = statementOf(save);
  const net = stmt.net - weeklyOf(extraPerSplit);
  const after = save.finances.balance - cost;
  // The spender only keeps the lights on for two months; it borrows the rest.
  if (policy.market === "stars") return after >= -2_000 && (net >= 0 || after / -net >= 8);
  // Everyone else keeps four weeks of wages and never plans to burn the rest within a split.
  return after >= 4 * stmt.payroll && (net >= 0 || after / -net >= 10);
}

// ---------------------------------------------------------------------------
// The market (window moves)
// ---------------------------------------------------------------------------

interface Candidate {
  view: CareerPlayerView;
  cost: number;
  salaryPerSplit: number;
  /** The scouted band's midpoint — what the market screen shows. */
  potentialRead: number;
}

function candidatesFor(save: CareerSave): Candidate[] {
  const cap = signableOverallCap(save.reputation);
  // rc.32: the Market's own listing (a page of signable free agents always shown).
  const listing = listingFor({
    world: save.world,
    squadIds: save.squad.map((p) => p.id),
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    signableCap: cap,
  });
  const out: Candidate[] = [];
  const add = (view: CareerPlayerView, splitsRemaining: number | null) => {
    if (Math.round(view.overall) > cap) return;
    const pack = askPackageFor(view, {
      rep: save.reputation,
      seasonIndex: save.clock.seasonIndex,
      difficulty: save.difficulty,
      careerSeed: save.careerSeed,
      lengthSeasons: 2,
      contracted: splitsRemaining === null ? undefined : { splitsRemaining },
    });
    const level = Math.min(2, Math.max(0, Number(save.scouted[view.id] ?? 0))) as ScoutLevel;
    // rc.32: the band the market screen shows (the save's development model).
    const band = scoutedBand(view.potential, view.overall, level, save.careerSeed, view.id, growthModelOf(save.world));
    out.push({
      view,
      cost: pack.fee + pack.signingBonus,
      salaryPerSplit: pack.salaryPerSplit,
      potentialRead: (band.min + band.max) / 2,
    });
  };
  for (const view of listing.freeAgents) add(view, null);
  for (const c of listing.contracted) add(c.view, c.splitsRemaining);
  return out;
}

function starters(save: CareerSave) {
  return save.squad.filter((p) => save.starterIds.includes(p.id));
}

function sign(save: CareerSave, c: Candidate, t: Tally): CareerSave | null {
  // ECO-03 (R47): the slot follows the squad (an open seat, else the reserve); the price never changes.
  const res = signPlayerFlow(save, c.view.id, { lengthSeasons: 2 });
  if (res.error) return null;
  t.signings += 1;
  if (c.view.overall >= 88) t.starSignings += 1;
  return res.save;
}

/** One window visit: fill open seats, then (by policy) one upgrade. */
function marketMoves(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  let save = input;
  const pool = candidatesFor(save);
  const byOverall = [...pool].sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
  const byCost = [...pool].sort((a, b) => a.cost - b.cost || b.view.overall - a.view.overall);
  const youngest = pool.filter((c) => c.view.age <= 19).sort((a, b) => b.potentialRead - a.potentialRead);
  // A refused signing (no funds for a fee while the Backer is owed, a closed
  // window…) is never retried in the same visit.
  const tried = new Set<string>();
  const pick = (list: Candidate[]) =>
    list.find((c) => !tried.has(c.view.id) && affordable(save, c.cost, c.salaryPerSplit, policy));

  // 1. Open starter seats (contracts that ran out, retirements, a sale): every policy fills them.
  while (starters(save).length < 3) {
    const c = pick(policy.market === "youth" ? youngest : byOverall) ?? pick(byCost);
    if (!c) break;
    tried.add(c.view.id);
    save = sign(save, c, t) ?? save;
  }
  if (policy.market === "keep") return save;

  // 2. One upgrade per visit: release the weakest starter for a clearly better player.
  const lineup = starters(save).sort((a, b) => a.overall - b.overall);
  const weakest = lineup[0];
  if (!weakest) return save;
  const margin = policy.market === "stars" ? 1 : 3;
  const age = (v: CareerPlayerView) => v.age;
  const list =
    policy.market === "youth"
      ? pool
          .filter((c) => age(c.view) <= 19 && c.potentialRead >= weakest.potential + 3 && c.view.overall >= weakest.overall - 2)
          .sort((a, b) => b.potentialRead - a.potentialRead)
      : byOverall.filter((c) => c.view.overall >= weakest.overall + margin);
  const severance = weakest.salaryPerSplit * Math.max(1, (weakest.contractEndSeason - save.clock.seasonIndex) * 3) * 0.5;
  const c = list.find((x) => affordable(save, x.cost + severance, x.salaryPerSplit - weakest.salaryPerSplit, policy));
  if (!c) return save;
  const released = releasePlayerFlow(save, weakest.id);
  if (released.error) return save;
  return sign(released.save, c, t) ?? released.save;
}

// ---------------------------------------------------------------------------
// Other decisions
// ---------------------------------------------------------------------------

/**
 * The final-season renewals (W24, after the W23 telegraph). "all" signs every
 * expiring player at the fresh ask — the naive manager. "selective" keeps a
 * player only while he is worth a seat and the books carry the new wage, and
 * opens at 92 % of the ask (a rejection pays the ask, if still affordable).
 */
function renewals(input: CareerSave, policy: ArcPolicy): CareerSave {
  let save = input;
  const seasonIndex = save.clock.seasonIndex;
  const lineupFloor = Math.min(...starters(save).map((p) => p.overall));
  const expiring = save.squad
    .filter((p) => p.contractEndSeason === seasonIndex)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  for (const p of expiring) {
    if (policy.renew === "all") {
      const res = renewPlayerFlow(save, p.id, 2);
      if (!res.error) save = res.save;
      continue;
    }
    const young = ageOf(p.birthYear, seasonIndex) <= 21;
    if (p.overall < lineupFloor - 1 && !young) continue;
    // The fresh ask, read off a probe (renewPlayerFlow prices it).
    const probe = renewPlayerFlow(save, p.id, 2);
    const ask = probe.save.squad.find((x) => x.id === p.id)?.salaryPerSplit ?? p.salaryPerSplit;
    if (!affordable(save, 0, ask - p.salaryPerSplit, policy)) continue;
    const counter = renewPlayerFlow(save, p.id, 2, quantize(ask * 0.92));
    save = counter.error ? renewPlayerFlow(counter.save, p.id, 2).save : counter.save;
  }
  return save;
}

function chooseSponsor(save: CareerSave, policy: ArcPolicy): CareerSave {
  const offers = save.sponsorOffers ?? [];
  if (offers.length === 0) return save;
  const sorted = [...offers].sort((a, b) => b.basePerSplit - a.basePerSplit || a.sponsorId.localeCompare(b.sponsorId));
  const pick = policy.sponsor === "best" ? sorted[0] : sorted[sorted.length - 1];
  const res = chooseSponsorFlow(save, pick.sponsorId);
  return res.error ? save : res.save;
}

function coachMoves(save: CareerSave, policy: ArcPolicy): CareerSave {
  if (policy.coach === "none" || save.reputation < CAREER_UNLOCKS.coachRep) return save;
  const candidates = coachCandidatesFor(save)
    .filter((c) => c.id !== save.coach?.id)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const budget = (c: { salaryPerSplit: number }) =>
    affordable(save, save.coach ? save.coach.salaryPerSplit : 0, c.salaryPerSplit - (save.coach?.salaryPerSplit ?? 0), policy);
  const pick =
    policy.coach === "churn"
      ? candidates.find(budget)
      : candidates.find((c) => (save.coach ? c.overall >= save.coach.overall + 3 : true) && budget(c));
  if (!pick) return save;
  const res = hireCoachFlow(save, pick);
  return res.error ? save : res.save;
}

function borrow(save: CareerSave, t: Tally): CareerSave {
  if (save.finances.balance >= 0 || save.finances.bankLoan || save.finances.loan) return save;
  for (const amount of [50_000, 25_000, 12_000, 6_000, 3_000]) {
    const res = takeBankLoanFlow(save, amount);
    if (!res.error) {
      t.bankLoans += 1;
      return res.save;
    }
  }
  return save;
}

/** Today's decisions, in the order a player meets them. */
function decide(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  let save = input;
  // The user's event: instant sim; a two-day event pauses on Saturday (tomorrow plays Sunday).
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  } else if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  }
  if (save.phase !== "running") return save;
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
  // Every offered cup is entered (the store's enterUnofficial).
  if (save.unofficialOffer && !save.pendingEventDef && !save.activeEvent) {
    save = { ...structuredClone(save), pendingEventDef: save.unofficialOffer };
  }
  save = chooseSponsor(save, policy);
  for (const bid of save.pendingOffers.filter((o) => o.status === "pending" && o.direction === "out")) {
    const net = statementOf(save).net;
    const tight = net < 0 && save.finances.balance / -net < 8;
    const sold = policy.bids === "whenTight" && tight && !save.activeEvent ? acceptBidFlow(save, bid.id) : null;
    if (sold && !sold.error) t.sales += 1;
    save = sold && !sold.error ? sold.save : declineBidFlow(save, bid.id);
  }
  const week = weekOfDay(save.clock.day);
  const dow = dayOfWeekOf(save.clock.day);
  if (!save.activeEvent) {
    if (isWindowWeek(week) && (dow === 1 || dow === 4)) save = marketMoves(save, policy, t);
    if (isWindowStartWeek(week) && dow === 2 && week <= 2) save = coachMoves(save, policy);
    if (week === 24 && dow === 1) save = renewals(save, policy);
  }
  if (policy.scrims && (dow === 2 || dow === 4) && !save.activeEvent) {
    const res = runScrimFlow(save);
    if (!res.error) save = res.save;
  }
  if (policy.bank) save = borrow(save, t);
  return save;
}

// ---------------------------------------------------------------------------
// The career
// ---------------------------------------------------------------------------

/**
 * rc.32 (BAL-02): the bot keeps rc.31's "balanced" prefs on every difficulty
 * (the presets would otherwise change how much is delegated), so the economy
 * probe and the arc sweeps stay comparable across versions.
 */
const ARC_BOT_PREFS: CareerPrefs = {
  managementStyle: "balanced",
  autoTrain: true,
  autoEnterUnofficials: true,
  playbackDefault: "full",
  newsDigest: true,
};

function inputFor(region: Region, difficulty: CareerDifficulty, policy: ArcPolicy): CreateCareerInput {
  return {
    identity: {
      orgName: "Arc Bot",
      abbrev: "ARC",
      managerName: "Bot",
      country: "BR",
      region,
      crestId: "shield",
      colors: { primary: "#f97316", secondary: "#fde68a" },
      buffType: "consistency",
    },
    difficulty,
    prefs: ARC_BOT_PREFS,
    rosterKey: policy.rosterKey,
  };
}

function squadRows(save: CareerSave): ArcSquadRow[] {
  return save.squad.map((p) => ({
    id: p.id,
    kind: p.kind,
    role: p.role,
    age: ageOf(p.birthYear, save.clock.seasonIndex),
    overall: Math.round(p.overall * 10) / 10,
    potential: p.potential,
    joinedSeason: p.joinedSeason,
  }));
}

/** Plays `seasons` seasons (continuing past a title / the timeline like the store's "continue"). */
export function playArcCareer(cfg: {
  region: Region;
  difficulty: CareerDifficulty;
  policy: ArcPolicyId;
  seed: number;
  seasons: number;
  /** Wall-clock budget: past it the career stops as a softlock with where it stood. */
  budgetMs?: number;
}): ArcCareer {
  const t0 = Date.now();
  const policy = ARC_POLICIES[cfg.policy];
  let save = createCareerSave(inputFor(cfg.region, cfg.difficulty, policy), cfg.seed);
  const out: ArcCareer = {
    region: cfg.region,
    difficulty: cfg.difficulty,
    policy: cfg.policy,
    seed: cfg.seed,
    seasons: [],
    ended: null,
    softlock: null,
    firstMajorSeason: null,
    firstWorldsSeason: null,
    worldsTitleSeason: null,
    ms: 0,
  };
  const seen = new Set<string>(save.finances.ledger.map((l) => l.id));

  for (let s = 0; s < cfg.seasons; s++) {
    const t = newTally(save, seen);
    let blocked = 0;
    let guard = 0;
    while (save.phase === "running" && guard++ < DAYS_PER_SEASON * 4) {
      if (Date.now() - t0 > (cfg.budgetMs ?? 120_000)) {
        out.softlock = `budget: season ${save.clock.seasonIndex} day ${save.clock.day} squad ${save.squad.length} starters ${starters(save).length} event ${save.pendingEventDef?.id ?? "-"}/${save.activeEvent?.def.id ?? "-"}`;
        break;
      }
      save = decide(save, policy, t);
      track(save, t);
      if (save.phase !== "running") break;
      const before = save.clock.day;
      const wasMonday = dayOfWeekOf(before + 1) === 1;
      save = advanceDayFlow(save);
      track(save, t);
      if (wasMonday && save.clock.day === before + 1 && save.finances.balance < 0) t.mondaysNegative += 1;
      if (save.clock.day === before && save.phase === "running") {
        blocked += 1;
        if (blocked > 3) {
          out.softlock = `season ${save.clock.seasonIndex} day ${before}: ${save.pendingEventDef?.id ?? "no event"} / ${save.activeEvent?.def.id ?? "-"}`;
          break;
        }
      } else blocked = 0;
    }
    const last = save.history[save.history.length - 1];
    const stmt = statementOf(save);
    out.seasons.push({
      seasonIndex: save.clock.seasonIndex,
      label: seasonLabelFor(save.clock.seasonIndex),
      balanceEnd: save.finances.balance,
      balanceMin: t.balanceMin,
      mondaysNegative: t.mondaysNegative,
      debtEnd: (save.finances.loan?.remaining ?? 0) + (save.finances.bankLoan?.remaining ?? 0),
      backerActive: Boolean(save.finances.loan),
      bankLoans: t.bankLoans,
      payrollPerSplit: save.squad.reduce((n, p) => n + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0),
      sponsorBasePerSplit: save.sponsor?.basePerSplit ?? 0,
      weeklyNet: stmt.net,
      income: t.income,
      spend: t.spend,
      regionRank: last?.seasonIndex === save.clock.seasonIndex ? last.userRegionRank : 0,
      seasonPoints: last?.seasonIndex === save.clock.seasonIndex ? last.userSeasonPoints : 0,
      majorsQualified: last?.seasonIndex === save.clock.seasonIndex ? last.majorsQualified : 0,
      worlds: last?.seasonIndex === save.clock.seasonIndex ? last.userWorldsPlacement : null,
      titles: last?.seasonIndex === save.clock.seasonIndex ? last.titles : 0,
      rep: save.reputation,
      teamRating: save.squad.length ? Math.round(userSeedRatingFor(save) * 10) / 10 : 0,
      signings: t.signings,
      starSignings: t.starSignings,
      sales: t.sales,
      squad: squadRows(save),
    });
    const row = out.seasons[out.seasons.length - 1];
    if (row.majorsQualified > 0 && out.firstMajorSeason === null) out.firstMajorSeason = row.seasonIndex;
    if (row.worlds !== null && out.firstWorldsSeason === null) out.firstWorldsSeason = row.seasonIndex;
    if (row.worlds === "champion" && out.worldsTitleSeason === null) out.worldsTitleSeason = row.seasonIndex;

    if (out.softlock) {
      out.ended = "softlock";
      break;
    }
    if (save.phase === "ended") {
      out.ended = save.end.reason ?? "insolvency";
      break;
    }
    if (s === cfg.seasons - 1) break;
    if (save.phase === "seasonReview") {
      // The store's "continue": past a title or the dataset timeline, into the infinite era.
      if (save.end.ended) {
        save = structuredClone(save);
        save.end.infinite = true;
        save.end.creditsShown = true;
      }
      save = rolloverToNextSeason(save);
    }
  }
  out.ms = Date.now() - t0;
  return out;
}

/** The world's players in rosters and free agency this season (for the curve samplers). */
export function worldPlayerViews(save: CareerSave): CareerPlayerView[] {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const ids = [...Object.values(save.world.orgs).flatMap((o) => o.playerIds), ...save.world.freeAgentIds];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}
