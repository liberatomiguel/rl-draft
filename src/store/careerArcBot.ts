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

import { CAREER_PLAN, CAREER_UNLOCKS } from "@/config/balance";
import { coachHireRefusalFor } from "@/engine/career/ladder";
import { insertById } from "@/data/career/inserts";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  isWindowStartWeek,
  isWindowWeek,
  seasonLabelFor,
  weekOfDay,
} from "@/engine/career/calendar";
import { ageOf, growthModelOf, playerViewById, scoutedBand } from "@/engine/career/development";
import { bootcampCostFor, bootcampTierFor, signableOverallCap, weeklyOf } from "@/engine/career/economy";
import { askPackageFor, listingFor } from "@/engine/career/market";
import type {
  CareerDifficulty,
  CareerEndReason,
  CareerPlayerView,
  CareerPrefs,
  CareerSave,
  EventTier,
  ScoutLevel,
  ScrimLevel,
  TrainingPackage,
} from "@/engine/career/types";
import type { Placement, Region } from "@/engine/types";
import {
  acceptBidFlow,
  acknowledgeMoneyNoticeFlow,
  advanceDayFlow,
  chooseSponsorFlow,
  coachCandidatesFor,
  createCareerSave,
  declineBidFlow,
  finishEvent,
  hireCoachFlow,
  isEventPaused,
  moneyNoticeOf,
  releasePlayerFlow,
  renewPlayerFlow,
  renewalTalkFor,
  resolveInsertFlow,
  rolloverToNextSeason,
  runBootcampFlow,
  signPlayerFlow,
  simEventToEnd,
  squadIsShort,
  startEvent,
  takeBankLoanFlow,
  userSeedRatingFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import { clockHoldOf, reviewContractsFlow, rolloverHoldOf } from "./careerDecisions";
import {
  approveTrainingProposalFlow,
  coachPlansOf,
  recommendedPlanOf,
  setCoachPlansFlow,
  setTrainingPackageFlow,
  trainingDecisionOf,
  trainingOf,
  trainingSeasonEnd,
} from "./careerTraining";

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
  | "coachChurn"
  | "delegator"
  | "trainer"
  | "veterans";

/** rc.34: how the bot picks a sponsor offer (see ArcPolicy.sponsor). */
export type ArcSponsorPick = "best" | "worst" | "steady" | "balanced" | "bold";

export interface ArcPolicy {
  id: ArcPolicyId;
  /** The founding roster the wizard offers (prospects = the weakest start). */
  rosterKey: CreateCareerInput["rosterKey"];
  /**
   * Sponsor pick: the richest weekly pay, the poorest one (the "bad sponsor"
   * case), or — rc.34 (ECO-04, SPONSOR-CONTRACT §7's measuring note) — the
   * offer of one profile. An offer from before rc.34 (no profile) is read
   * by its base, as rc.33's harness did.
   */
  sponsor: ArcSponsorPick;
  /**
   * rc.34 (ECO-05): the weekly inserts that pay a fee (other income) —
   * "take" answers them "a" (the fee, at its agenda cost), "skip" answers
   * every insert "b" (rc.33's harness).
   */
  others: "take" | "skip";
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
  /**
   * rc.34 (DEV-03, TRAINING-CONTRACT §7): "base" never sets a package;
   * "repeat" sets a Development package once ("I set it", repeated every
   * period); "delegate" lets the coach run it (no coach = the base).
   */
  training: "base" | "repeat" | "delegate";
  /**
   * rc.36 (front T2, R83): a hired coach plans each cycle (the default, as
   * rc.35's coach ran every plan); false = the manager keeps planning himself
   * (the trainer). Absent = on.
   */
  coachPlans?: boolean;
  /** rc.34: the repeated package's scrims — two a week (Tue, Thu) at `scrimLevel`, or none. */
  scrims: boolean;
  scrimLevel: ScrimLevel | "auto";
  /** Take a bank loan when the balance goes negative. */
  bank: boolean;
  /** Incoming bids: always declined, or accepted while the runway is under eight weeks. */
  bids: "decline" | "whenTight";
}

const base: Omit<ArcPolicy, "id"> = {
  rosterKey: "balanced",
  // rc.34 (ECO-04): the median manager signs the Balanced deal (the contract's s5 measures b3 on it).
  sponsor: "balanced",
  others: "skip",
  market: "keep",
  renew: "all",
  coach: "none",
  training: "delegate",
  scrims: false,
  scrimLevel: "even",
  bank: false,
  bids: "decline",
};

export const ARC_POLICIES: Record<ArcPolicyId, ArcPolicy> = {
  /** The median, hands-off manager: takes the best sponsor, renews everyone, never shops (delegates; no coach = the base). */
  autopilot: { id: "autopilot", ...base },
  /** The engaged manager chasing titles: upgrades, coach, a Development package with scrims, selective renewals, the side income (rc.34). */
  tuned: { id: "tuned", ...base, market: "upgrade", renew: "selective", coach: "best", training: "repeat", scrims: true, bids: "whenTight", others: "take" },
  /** A youth core: the prospects start, young high-potential signings, everyone renewed; a Development package. */
  youth: { id: "youth", ...base, rosterKey: "prospects", market: "youth", coach: "best", training: "repeat", scrims: true, bids: "whenTight" },
  /** A costly squad: stars first, borrowing to pay for them. */
  spender: {
    id: "spender",
    ...base,
    rosterKey: "journeymen",
    market: "stars",
    renew: "selective",
    coach: "best",
    training: "repeat",
    scrims: true,
    bank: true,
    others: "take",
  },
  /** The autopilot stuck with the poorest sponsor deal (rc.34: the least sure weekly pay — a Bold deal). */
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
    training: "repeat",
    scrims: true,
    bids: "whenTight",
  },
  /** rc.34 (TRAINING-CONTRACT §7): the delegator — hires the best coach and lets him run every period. */
  delegator: { id: "delegator", ...base, coach: "best", training: "delegate" },
  /** rc.34 (§7): the trainer — the best coach and a manual Development package with even scrims, renewed every period (rc.36: his coach never plans it). */
  trainer: { id: "trainer", ...base, coach: "best", training: "repeat", coachPlans: false, scrims: true, scrimLevel: "even" },
  /**
   * rc.34 (Miguel, 31/10: "the older team went broke in the first split"):
   * the wizard's older founding roster (journeymen), hands-off — the
   * autopilot with the dearest founding payroll. Only the spender started
   * from it before, with stars and loans on top. Opt-in: not in
   * ARC_DEFAULT_POLICIES, so the default sweeps compare like with like.
   */
  veterans: { id: "veterans", ...base, rosterKey: "journeymen" },
};

/**
 * The sweeps' default policies: the seven of rc.30–33, so a re-measure plays
 * the same careers as the baselines (147 = 7 regions × 3 presets × 7). The
 * rc.34 opt-in policies (delegator, trainer, veterans) join when ARC_POLICIES /
 * ECON_POLICIES name them.
 */
export const ARC_DEFAULT_POLICIES: readonly ArcPolicyId[] = [
  "autopilot",
  "tuned",
  "youth",
  "spender",
  "badSponsor",
  "losingStart",
  "coachChurn",
];

/** rc.34: the Development package a "repeat" policy sets once (normal workload, the policy's scrims). */
function arcPackageFor(policy: ArcPolicy): TrainingPackage {
  return {
    objective: "development",
    focus: "balanced",
    workload: "normal",
    scrimsPerWeek: policy.scrims ? 2 : 0,
    scrimLevel: policy.scrimLevel,
  };
}

/**
 * rc.36 (front T2, R83): "nothing runs until you pick" — on a day nothing
 * runs, each policy starts the cycle as its player would: "repeat" its own
 * Development package (by hand, every cycle), "delegate" the recommendation
 * (the bot's mode "auto" always tags one), "base" never. A coach who plans
 * (the policy's `coachPlans`, default on) starts his own at the period's
 * first day, so the bot only fills the days he does not.
 */
function startArcCycle(input: CareerSave, policy: ArcPolicy): CareerSave {
  if (policy.training === "base" || input.phase !== "running") return input;
  let save = input;
  const wanted = policy.coachPlans ?? true;
  if ((trainingOf(save).coachPlans ?? CAREER_PLAN.coachPlansByDefault) !== wanted) save = setCoachPlansFlow(save, wanted).save;
  if (trainingOf(save).plan?.package) return save;
  if (coachPlansOf(save)) return save;
  const pkg = policy.training === "repeat" ? arcPackageFor(policy) : recommendedPlanOf(save);
  if (!pkg) return save;
  const res = setTrainingPackageFlow(save, pkg);
  return res.error ? save : res.save;
}

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
  /**
   * rc.33 (BAL-04): the user's series this season, [won, lost], by event tier
   * (t3, t2, qualifier, regional, major, worlds). Absent in older dumps.
   */
  series?: Partial<Record<EventTier, [number, number]>>;
  /**
   * rc.33 (BAL-04): the same series by the rating gap at the series (the
   * user's team rating − the opponent's, the AI shift left out; buckets of
   * `ARC_GAP_BUCKETS`), [won, lost] — "even" is the presets' intent row.
   */
  seriesByGap?: Record<string, [number, number]>;
  /** rc.34: bootcamps booked this season (the opt-in 5-A measurement; absent in older dumps). */
  bootcamps?: number;
  /**
   * rc.34 (DEV-03, TRAINING-CONTRACT §7): the season's training — periods
   * filed, prompts the manager met (t1), the package objective per period
   * ("base" = none), package scrims won / lost, the scrims' share of each
   * player's period gain (t4, p90), players ruled out by the pre-event roll,
   * and each player's season gain split by source. Absent in older dumps.
   */
  training?: ArcTraining;
}

/** rc.34 (DEV-03): one season of training in the arc records. */
export interface ArcTraining {
  summaries: number;
  prompts: number;
  objectives: string[];
  scrimsWon: number;
  scrimsLost: number;
  scrimShareP90: number;
  unavailable: number;
  /** Per squad player at the season's end: age, overall gained (sessions, scrims, series), coach's share. */
  players: { age: number; gain: number; sessions: number; scrims: number; series: number; coachShare: number }[];
}

/** rc.33 (BAL-04): the rating-gap buckets of `ArcSeason.seriesByGap` (user − opponent). */
export const ARC_GAP_BUCKETS: { key: string; max: number }[] = [
  { key: "≤ −6", max: -6 },
  { key: "−6 to −2", max: -2 },
  { key: "even (±2)", max: 2 },
  { key: "2 to 6", max: 6 },
  { key: "≥ 6", max: Infinity },
];

function gapBucketOf(gap: number): string {
  return (ARC_GAP_BUCKETS.find((b) => gap <= b.max) ?? ARC_GAP_BUCKETS[ARC_GAP_BUCKETS.length - 1]).key;
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
  /** rc.33 (RTW-02): the season the first real sponsor deal was signed (null = never; absent in older dumps). */
  firstSponsorSeason?: number | null;
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
  series: Partial<Record<EventTier, [number, number]>>;
  seriesByGap: Record<string, [number, number]>;
  /** rc.34: bootcamps booked (the opt-in 5-A measurement). */
  bootcamps: number;
  /** rc.34: the days a training proposal held the clock (t1). */
  promptDays: Set<number>;
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
    series: {},
    seriesByGap: {},
    bootcamps: 0,
    promptDays: new Set(),
  };
}

/** rc.34 (DEV-03): the season's training read off its filed summaries (call after the rollover's filing, or at the end). */
function trainingOfSeason(save: CareerSave, seasonIndex: number, t: Tally): ArcTraining {
  const hist = trainingOf(save).history.filter((h) => h.seasonIndex === seasonIndex);
  const shares: number[] = [];
  const byPlayer = new Map<string, ArcTraining["players"][number]>();
  let won = 0;
  let lost = 0;
  let unavailable = 0;
  for (const h of hist) {
    for (const [w, l] of Object.values(h.scrims)) {
      won += w;
      lost += l;
    }
    for (const p of h.players) {
      const gain = p.after - p.before;
      if (p.sessions + p.scrims > 0.01) shares.push(p.scrims / (p.sessions + p.scrims + p.seriesGain));
      if (p.unavailable) unavailable += 1;
      const row = byPlayer.get(p.id) ?? { age: 0, gain: 0, sessions: 0, scrims: 0, series: 0, coachShare: 0 };
      row.gain += gain;
      row.sessions += p.sessions;
      row.scrims += p.scrims;
      row.series += p.seriesGain;
      row.coachShare += p.coachShare;
      byPlayer.set(p.id, row);
    }
  }
  for (const [id, row] of byPlayer) {
    const sq = save.squad.find((p) => p.id === id);
    row.age = sq ? ageOf(sq.birthYear, seasonIndex) : 0;
  }
  const sorted = [...shares].sort((a, b) => a - b);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    summaries: hist.length,
    prompts: t.promptDays.size,
    objectives: [...hist].reverse().map((h) => h.package?.objective ?? "base"),
    scrimsWon: won,
    scrimsLost: lost,
    scrimShareP90: sorted.length ? r2(sorted[Math.min(sorted.length - 1, Math.round(0.9 * (sorted.length - 1)))]) : 0,
    unavailable,
    players: [...byPlayer.values()].map((r) => ({
      age: r.age,
      gain: r2(r.gain),
      sessions: r2(r.sessions),
      scrims: r2(r.scrims),
      series: r2(r.series),
      coachShare: r2(r.coachShare),
    })),
  };
}

/**
 * rc.33 (BAL-04): books the user's series of a finished event (called right
 * before finishEvent): won / lost by tier and by the rating gap at the series
 * (each side's rating with the AI shift left out — the presets' edge is what
 * the win rate at an even gap measures).
 */
function countSeries(save: CareerSave, t: Tally): void {
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage !== "finished") return;
  const tr = ev.tournament;
  const intrinsic = (id: string) => {
    const r = tr.teams[id]?.rating;
    return r ? r.total - r.difficultyShift : 0;
  };
  const byTier = (t.series[ev.def.tier] ??= [0, 0]);
  for (const s of [...tr.swiss.rounds.flatMap((r) => r.series), ...(tr.playoffs?.rounds.flatMap((r) => r.series) ?? [])]) {
    if (s.teamAId !== "user" && s.teamBId !== "user") continue;
    const opponent = s.teamAId === "user" ? s.teamBId : s.teamAId;
    const slot = s.winnerTeamId === "user" ? 0 : 1; // [won, lost]
    byTier[slot] += 1;
    const gap = Math.round((intrinsic("user") - intrinsic(opponent)) * 10) / 10;
    (t.seriesByGap[gapBucketOf(gap)] ??= [0, 0])[slot] += 1;
  }
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

/**
 * Open starter seats (contracts that ran out, retirements, a sale): every
 * policy fills them. RTW-05 (rc.33): no event plays short and the clock holds
 * before one, so a squad under three always signs — the cheapest player when
 * nothing fits the policy's budget. A free agent into an empty seat is never
 * refused for the window, and the cheapest one the org may sign never for
 * money (`careerFlow.emptySeatPriceFor`); a dearer one refused for money is
 * tried no more, so the cost-ordered fallback always reaches him.
 */
function fillSeats(input: CareerSave, policy: ArcPolicy, t: Tally, pool: Candidate[] = candidatesFor(input)): CareerSave {
  let save = input;
  const byOverall = [...pool].sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
  const byCost = [...pool].sort((a, b) => a.cost - b.cost || b.view.overall - a.view.overall);
  const youngest = pool.filter((c) => c.view.age <= 19).sort((a, b) => b.potentialRead - a.potentialRead);
  // A refused signing (no funds for a fee while the Backer is owed, a closed
  // window…) is never retried in the same visit.
  const tried = new Set<string>();
  const pick = (list: Candidate[]) =>
    list.find((c) => !tried.has(c.view.id) && affordable(save, c.cost, c.salaryPerSplit, policy));
  while (starters(save).length < 3) {
    const c =
      pick(policy.market === "youth" ? youngest : byOverall) ??
      pick(byCost) ??
      (squadIsShort(save) ? byCost.find((x) => !tried.has(x.view.id)) : undefined);
    if (!c) break;
    tried.add(c.view.id);
    save = sign(save, c, t) ?? save;
  }
  return save;
}

/** RTW-05 test hook: one visit of the bot's seat filler (a squad under three always signs, broke or not). */
export function fillSeatsForTests(save: CareerSave, policyId: ArcPolicyId): CareerSave {
  return fillSeats(save, ARC_POLICIES[policyId], newTally(save, new Set()));
}

/** One window visit: fill open seats, then (by policy) one upgrade. */
function marketMoves(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  const pool = candidatesFor(input);
  const save = fillSeats(input, policy, t, pool);
  const byOverall = [...pool].sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
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
 * signs at the floor of the talk's zone (rc.33 ECO-11; rc.32 opened at 92 % of
 * the ask and paid the ask on a rejection).
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
    // The renewal ask, from the talk renewPlayerFlow answers with.
    const talk = renewalTalkFor(save, p, 2);
    const ask = talk.ask.wagePerSplit;
    if (!affordable(save, 0, ask - p.salaryPerSplit, policy)) continue;
    // rc.33 (ECO-11): the zone is shown, so a negotiating manager signs at his
    // floor (his share ask, the least wage he takes this window) — about what
    // rc.32's 92 % opening paid on average (a third of them took it).
    const res = renewPlayerFlow(save, p.id, 2, { weekly: talk.zone.floorWeekly });
    save = res.error ? renewPlayerFlow(save, p.id, 2).save : res.save;
  }
  return save;
}

function chooseSponsor(save: CareerSave, policy: ArcPolicy): CareerSave {
  const offers = save.sponsorOffers ?? [];
  if (offers.length === 0) return save;
  const weekly = (o: (typeof offers)[number]) => o.terms?.weekly ?? weeklyOf(o.basePerSplit);
  const sorted = [...offers].sort((a, b) => weekly(b) - weekly(a) || a.sponsorId.localeCompare(b.sponsorId));
  const byProfile =
    policy.sponsor === "best" || policy.sponsor === "worst"
      ? null
      : (offers.find((o) => o.terms?.profile === policy.sponsor) ?? null);
  // A profile pick on offers from before rc.34 (no profile) falls back to the best base, as rc.33's harness did.
  const pick = byProfile ?? (policy.sponsor === "worst" ? sorted[sorted.length - 1] : sorted[0]);
  const res = chooseSponsorFlow(save, pick.sponsorId);
  return res.error ? save : res.save;
}

/** rc.34 (ECO-05): answer the day's insert — its fee ("a") when the policy takes other income, else "b". */
function answerInsert(save: CareerSave, policy: ArcPolicy): CareerSave {
  const def = save.pendingInsert ? insertById.get(save.pendingInsert.id) : undefined;
  const pays = (def?.options.find((o) => o.key === "a")?.effects.money ?? 0) > 0;
  return resolveInsertFlow(save, policy.others === "take" && pays ? "a" : "b").save;
}

function coachMoves(save: CareerSave, policy: ArcPolicy): CareerSave {
  if (policy.coach === "none" || save.reputation < CAREER_UNLOCKS.coachRep) return save;
  const candidates = coachCandidatesFor(save)
    .filter((c) => c.id !== save.coach?.id && !coachHireRefusalFor(save.reputation, c))
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

/** Opt-in behaviours that measure one lever without changing the default sweeps. */
interface ArcOpts {
  /** rc.34: book a bootcamp each split (CAREER_GEAR.bootcampSpan decides how long it lasts). */
  bootcamp?: boolean;
}

/** Today's decisions, in the order a player meets them. */
function decide(input: CareerSave, policy: ArcPolicy, t: Tally, opts: ArcOpts = {}): CareerSave {
  let save = input;
  // rc.34: a money notice (the emergency loan, its deadline) is read, as the modal makes a player do —
  // nothing in the books moves, and the clock never waits on an unread one.
  while (moneyNoticeOf(save)) save = acknowledgeMoneyNoticeFlow(save);
  // RTW-05 (rc.33): a squad under three signs first — no event starts short.
  if (!save.activeEvent && save.phase === "running" && squadIsShort(save)) save = fillSeats(save, policy, t);
  // The user's event: instant sim; a two-day event pauses on Saturday (tomorrow plays Sunday).
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") {
      countSeries(save, t);
      save = finishEvent(save);
    }
  } else if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") {
      countSeries(save, t);
      save = finishEvent(save);
    }
  }
  if (save.phase !== "running") return save;
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = answerInsert(save, policy);
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
  // rc.34 (DEV-03): training is a package per period, never a weekly click —
  // a waiting proposal is approved (the bot never adjusts). rc.36 (front T2):
  // nothing runs until a plan is picked — the policy starts each cycle.
  if (trainingDecisionOf(save)) {
    t.promptDays.add(save.clock.seasonIndex * 1000 + save.clock.day);
    save = approveTrainingProposalFlow(save).save;
  }
  save = startArcCycle(save, policy);
  // rc.34 (HQ decision 5-A's measurement, opt-in): a bootcamp on the first
  // Monday of each split it is affordable — `bootcamp` in playArcCareer's cfg.
  if (opts.bootcamp && dow === 1 && !save.activeEvent && !save.finances.bootcampUsedThisSplit) {
    const tier = bootcampTierFor(save.reputation);
    if (tier !== 0 && affordable(save, bootcampCostFor(tier, save.clock.seasonIndex), 0, policy)) {
      const res = runBootcampFlow(save);
      if (!res.error) {
        save = res.save;
        t.bootcamps += 1;
      }
    }
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
    // rc.34 (DEV-03): the policy's training mode, never the preset's (comparable across difficulties).
    trainingMode: policy.training === "delegate" ? "auto" : "manual",
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
  /** rc.34 (5-A's measurement, opt-in): book a bootcamp each split. */
  bootcamp?: boolean;
  /** rc.34: override the policy's sponsor pick (the probe's ECON_SPONSOR). */
  sponsor?: ArcSponsorPick;
  /** rc.34: override the policy's other-income answer (the probe's ECON_OTHERS). */
  others?: ArcPolicy["others"];
  /** rc.36 (UX-02): read each season's start (day 1, its goal set) and end (the review) — the goals probe. */
  onSeason?: (moment: "start" | "end", save: CareerSave) => void;
}): ArcCareer {
  const t0 = Date.now();
  const policy: ArcPolicy = {
    ...ARC_POLICIES[cfg.policy],
    ...(cfg.sponsor ? { sponsor: cfg.sponsor } : {}),
    ...(cfg.others ? { others: cfg.others } : {}),
  };
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
    firstSponsorSeason: null,
    ms: 0,
  };
  const seen = new Set<string>(save.finances.ledger.map((l) => l.id));

  for (let s = 0; s < cfg.seasons; s++) {
    const t = newTally(save, seen);
    cfg.onSeason?.("start", save);
    let blocked = 0;
    let guard = 0;
    while (save.phase === "running" && guard++ < DAYS_PER_SEASON * 4) {
      if (Date.now() - t0 > (cfg.budgetMs ?? 120_000)) {
        out.softlock = `budget: season ${save.clock.seasonIndex} day ${save.clock.day} squad ${save.squad.length} starters ${starters(save).length} event ${save.pendingEventDef?.id ?? "-"}/${save.activeEvent?.def.id ?? "-"}`;
        break;
      }
      save = decide(save, policy, t, { bootcamp: cfg.bootcamp });
      track(save, t);
      if (save.sponsor && out.firstSponsorSeason === null) out.firstSponsorSeason = save.clock.seasonIndex;
      if (save.phase !== "running") break;
      const before = save.clock.day;
      const wasMonday = dayOfWeekOf(before + 1) === 1;
      save = advanceDayFlow(save);
      track(save, t);
      if (wasMonday && save.clock.day === before + 1 && save.finances.balance < 0) t.mondaysNegative += 1;
      if (save.clock.day === before && save.phase === "running") {
        blocked += 1;
        if (blocked > 3) {
          const hold = clockHoldOf(save);
          out.softlock = `season ${save.clock.seasonIndex} day ${before}: ${save.pendingEventDef?.id ?? "no event"} / ${save.activeEvent?.def.id ?? "-"}${hold ? ` (holds: ${hold.kind} ${hold.id})` : ""}`;
          break;
        }
      } else blocked = 0;
    }
    const last = save.history[save.history.length - 1];
    cfg.onSeason?.("end", save);
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
      series: t.series,
      seriesByGap: t.seriesByGap,
      bootcamps: t.bootcamps,
      // rc.34: the last period is filed at the rollover — read it off a copy filed now.
      training: (() => {
        const filed = structuredClone(save);
        trainingSeasonEnd(filed);
        return trainingOfSeason(filed, save.clock.seasonIndex, t);
      })(),
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
      // rc.34 (UX-06b): the explicit contract review before the rollover — the
      // bot renewed whom it wanted at W24 and lets the rest go.
      save = reviewContractsFlow(save).save;
      const hold = rolloverHoldOf(save);
      if (hold) {
        out.softlock = `season ${save.clock.seasonIndex} review: ${hold.kind} ${hold.id} still holds the rollover`;
        out.ended = "softlock";
        break;
      }
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
