/** Local audit extension: test support only; original game and balance unchanged. */
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

import { CAREER_DIFFICULTY, CAREER_GEAR, CAREER_PLAN, CAREER_UNLOCKS, CAREER_WORLD } from "@/config/balance";
import { coachHireRefusalFor } from "@/engine/career/ladder";
import { insertById } from "@/data/career/inserts";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  isWindowStartWeek,
  isWindowWeek,
  windowIndexOf,
  seasonLabelFor,
  weekOfDay,
} from "@/engine/career/calendar";
import { ageOf, growthModelOf, playerViewById, readsUniformBand, scoutedBand } from "@/engine/career/development";
import { bootcampCostFor, bootcampTierFor, psychologistPerSplitFor, signableOverallCap, weeklyOf } from "@/engine/career/economy";
import { askPackageFor, listingFor } from "@/engine/career/market";
import { userTeamFor } from "@/engine/career/worldSim";
import type {
  CareerDifficulty,
  CareerEndReason,
  CareerPlayerView,
  CareerPrefs,
  CareerSave,
  EventTier,
  ScoutLevel,
  ScrimLevel,
  SundayBriefingChoice,
  TrainingPackage,
} from "@/engine/career/types";
import type { Placement, Region } from "@/engine/types";
import {
  acceptBidFlow,
  acceptCreditOfferFlow,
  buyGearFlow,
  buyScoutReportFlow,
  signingTalkFor,
  acknowledgeMoneyNoticeFlow,
  advanceDayFlow,
  chooseSponsorFlow,
  coachCandidatesFor,
  createCareerSave,
  declineBidFlow,
  eventFieldFor,
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
  setPsychologistFlow,
  signPlayerFlow,
  simEventToEnd,
  spendAlertFlow,
  squadIsShort,
  canSkipShortSquadEvent,
  skipShortSquadEventFlow,
  uncoveredAbsenceOf,
  startEvent,
  takeBankLoanFlow,
  payDebtFlow,
  userSeedRatingFor,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import { clockHoldOf, reviewContractsFlow, rolloverHoldOf } from "./careerDecisions";
import { recordSundayBriefingFlow, sundayAheadOf, sundayStopHolds } from "./careerSunday";
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
  | "builder"
  | "loyal"
  | "academy"
  | "contender"
  | "professional"
  | "veterans";

/** rc.34: how the bot picks a sponsor offer (see ArcPolicy.sponsor). */
export type ArcSponsorPick = "best" | "worst" | "steady" | "balanced" | "bold";

/** rc.37 integration: what the manager remembers between days (ArcPolicy.mem). */
export interface ArcMemory {
  lastUpgradeWindow?: string;
  lastSaleSplit?: string;
  lastSaleSeason?: number;
  memorySoldTalent?: boolean;
}

/** The policy's memory, created on first use and then shared by every copy of the policy. */
function memOf(policy: ArcPolicy): ArcMemory {
  return (policy.mem ??= {});
}

export interface ArcPolicy {
  id: ArcPolicyId;
  negotiate?: boolean;
  shareWage?: boolean;
  humanPrefs?: boolean;
  buffType?: CreateCareerInput["identity"]["buffType"];
  trainingObjective?: TrainingPackage["objective"];
  trainingPackage?: Partial<TrainingPackage>;
  keepFirstCoach?: boolean;
  maxSalesPerSplit?: boolean;
  /**
   * rc.37 integration: the manager's memory (one upgrade per window, one sale
   * per split / season, a sold talent). ONE object shared by reference, so it
   * survives the per-day policy copies (`adaptFinances`, contend / switch
   * modes) that used to drop it on a crisis day.
   */
  mem?: ArcMemory;
  /**
   * rc.37 F2 (credit before the floor): the bank's offer — a `creditOffer`
   * notice, or a `spendRisk` one that carries it. "take" accepts the sum the
   * bank quotes; "lastResort" only when no incoming offer in hand covers it
   * (a sale is a manager's first answer); "never" reads and dismisses it.
   * Absent = "never" (the rc.36 bots never met one). Only the real notice's
   * offer is taken — the bot never sizes or invents a loan.
   */
  credit?: "take" | "lastResort" | "never";
  /**
   * rc.37 F2 (the emergency sale): an emergency offer — the below-market bid a
   * red balance brings inside a window. "accept" sells at once (the manager
   * reacting to the red), "whenTight" as any bid (runway under eight weeks),
   * "decline" keeps the player. Absent = the `bids` rule of the day. A planned
   * sale (`sellToFund`) never takes a crisis discount. Only a real offer from
   * the flow is ever answered.
   */
  emergencySale?: "accept" | "whenTight" | "decline";
  /** @deprecated rc.37: read `mem.lastSaleSplit` (kept so old overrides type-check). */
  lastSaleSplit?: string;
  /** Audit-only observer. Never imported by the app. */
  onAction?: (kind: string, before: CareerSave, after: CareerSave, item: string) => void;
  adaptFinances?: boolean;
  regularCoachUpgrades?: boolean;
  atomicMoves?: boolean;
  sellToFund?: boolean;
  sellMinAge?: number;
  sellMinOverall?: number;
  sellAfterRep?: number;
  sellFictionalOnly?: boolean;
  switchAfterSale?: boolean;
  memorySoldTalent?: boolean;
  maxUpgradePerWindow?: boolean;
  maxSalesPerSeason?: boolean;
  lastSaleSeason?: number;
  payDebtIfCovered?: boolean;
  renewAtReviewOnly?: boolean;
  lastUpgradeWindow?: string;
  protectPotential?: boolean;
  candidateKind?: "real" | "fictional";
  candidateMaxAge?: number;
  candidateMinBand?: number;
  candidateMinOverall?: number;
  upgradeMargin?: number;
  reserveWeeks?: number;
  runwayWeeks?: number;
  eagerInfrastructure?: boolean;
  scoutShortlist?: boolean;
  switchAtRep?: number;
  switchAfterSeason?: number;
  skipOptionalCups?: boolean;
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
  /**
   * rc.36 (SUN-01, R88): the Sunday briefing it starts each Sunday with.
   * Every default policy keeps the plan (= no briefing: the measured arc is
   * the base career's); a measuring run may set one per policy.
   */
  briefing: SundayBriefingChoice | "none" | "adaptive";
  /** Opt-in human-style infrastructure purchases, preserving the policy's runway. */
  infrastructure?: boolean;
  /** Buy the psychologist and use legal split bootcamps when the budget carries them. */
  fullSupport?: boolean;
  /** A youth project that buys current strength after its first Major qualification. */
  contendWhenReady?: boolean;
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
  briefing: "keep",
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
  builder: { id: "builder", ...base, market: "upgrade", renew: "selective", coach: "best", training: "repeat", scrims: true, others: "take", bids: "whenTight", infrastructure: true },
  loyal: { id: "loyal", ...base, coach: "best", training: "repeat", scrims: true, others: "take", infrastructure: true },
  academy: { id: "academy", ...base, rosterKey: "prospects", market: "youth", coach: "best", training: "repeat", scrims: true, others: "take", bids: "whenTight", infrastructure: true },
  contender: { id: "contender", ...base, rosterKey: "prospects", market: "youth", coach: "best", training: "repeat", scrims: true, others: "take", bids: "whenTight", infrastructure: true, contendWhenReady: true },
  professional: { id: "professional", ...base, market: "upgrade", renew: "selective", coach: "best", training: "repeat", scrims: true, others: "take", bids: "whenTight", infrastructure: true, fullSupport: true },
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
    objective: policy.trainingObjective ?? "development",
    focus: "balanced",
    workload: "normal",
    scrimsPerWeek: policy.scrims ? 2 : 0,
    scrimLevel: policy.scrimLevel,
    ...policy.trainingPackage,
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
  if (input.phase !== "running") return input;
  let save = input;
  const wanted = policy.coachPlans ?? true;
  if ((trainingOf(save).coachPlans ?? CAREER_PLAN.coachPlansByDefault) !== wanted) save = setCoachPlansFlow(save, wanted).save;
  if (policy.training === "base") return save;
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
  /** rc.37 F2: the season's crisis levers (absent in older dumps). */
  crisis?: ArcCrisis;
  /**
   * rc.37 integration: the fielded trio's chemistry at the season's end (the
   * percent the Squad screen shows), its pairs' shared tenure (splits) and
   * heritage mix (same country / same region / none) — the "stuck at 67 %" probe.
   */
  chemistry?: { percent: number; tier: string; pairTenure: number[]; heritage: { country: number; region: number; none: number } };
  /** rc.37: the market's price level at the season's first window visit (null = no visit). */
  market?: ArcMarketLevel | null;
  /**
   * rc.34 (DEV-03, TRAINING-CONTRACT §7): the season's training — periods
   * filed, training decisions the manager made (t1: a proposal approved or, since rc.37 F6, a plan picked at a
   * cycle start), the package objective per period
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
/** Observe only accepted, real-flow decisions, before their inputs are discarded. */
function policyAction(policy: ArcPolicy | undefined, kind: string, before: CareerSave, after: CareerSave, item = kind): void {
  (policy?.onAction ?? actionObserver)?.(kind, before, after, item);
}

/**
 * rc.37 integration: the observer of the run in progress (advanceArcRun sets
 * it for the duration of a call), so a run's state holds data only and can be
 * cloned at a fork (structuredClone refuses functions).
 */
let actionObserver: ArcPolicy["onAction"] | undefined;

interface Tally {
  policy?: ArcPolicy;
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
  /** rc.37 F2: the crisis levers met this season (the bank's offers, the emergency sale). */
  crisis: ArcCrisis & { emergencySeen: string[] };
  /** rc.37: the market's price level at the season's first window visit. */
  market?: ArcMarketLevel;
}

/**
 * rc.37: the market's price level the season's first window visit shows — the
 * signable listing's wage asks (per split, before any talk) by overall band,
 * the fees, and the squad's own payroll beside it (the "endless salaries" probe).
 */
export interface ArcMarketLevel {
  day: number;
  signable: number;
  wageP50: number | null;
  wageP90: number | null;
  feeP50: number | null;
  byBand: Record<string, { n: number; wageP50: number | null; feeP50: number | null }>;
  payrollPerSplit: number;
}

function pctl(values: number[], p: number): number | null {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.round((s.length - 1) * p)] : null;
}

function marketLevelOf(save: CareerSave, pool: Candidate[]): ArcMarketLevel {
  const bands: [string, number, number][] = [["<80", 0, 79.99], ["80-84", 80, 84.99], ["85-89", 85, 89.99], ["90+", 90, 200]];
  return {
    day: save.clock.day,
    signable: pool.length,
    wageP50: pctl(pool.map((c) => c.ask), 0.5),
    wageP90: pctl(pool.map((c) => c.ask), 0.9),
    feeP50: pctl(pool.map((c) => c.cost), 0.5),
    byBand: Object.fromEntries(bands.map(([key, lo, hi]) => {
      const inBand = pool.filter((c) => c.view.overall >= lo && c.view.overall <= hi);
      return [key, { n: inBand.length, wageP50: pctl(inBand.map((c) => c.ask), 0.5), feeP50: pctl(inBand.map((c) => c.cost), 0.5) }];
    })),
    payrollPerSplit: save.squad.reduce((n, p) => n + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0),
  };
}

/** rc.37 F2: one season's crisis levers — the bank's offers met / taken, the emergency offers met / accepted. */
export interface ArcCrisis {
  creditOffers: number;
  creditTaken: number;
  creditPrincipal: number;
  emergencyOffers: number;
  emergencyAccepted: number;
  emergencyFees: number;
}

/** The season's crisis levers as recorded (the seen-offer ids stay in the tally). */
function crisisOf(t: Tally): ArcCrisis {
  const c = t.crisis;
  return {
    creditOffers: c.creditOffers, creditTaken: c.creditTaken, creditPrincipal: c.creditPrincipal,
    emergencyOffers: c.emergencyOffers, emergencyAccepted: c.emergencyAccepted, emergencyFees: c.emergencyFees,
  };
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
    crisis: { creditOffers: 0, creditTaken: 0, creditPrincipal: 0, emergencyOffers: 0, emergencyAccepted: 0, emergencyFees: 0, emergencySeen: [] },
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
  if (policy.market === "stars" && policy.reserveWeeks === undefined) return after >= -2_000 && (net >= 0 || after / -net >= 8);
  // Everyone else keeps four weeks of wages and never plans to burn the rest within a split.
  return after >= (policy.reserveWeeks ?? 4) * stmt.payroll && (net >= 0 || after / -net >= (policy.runwayWeeks ?? 10));
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
  offer?: { weekly: number; sharePct?: number };
  lengthSeasons?: 2 | 3;
  /** rc.37: his ask before any talk (the listing's price, the same for every manager). */
  ask: number;
  /** A free agent (no fee; `cost` is then his signing bonus). */
  free?: boolean;
}

function candidatesFor(save: CareerSave, policy?: ArcPolicy): Candidate[] {
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
      lengthSeasons: policy?.negotiate ? 3 : 2,
      contracted: splitsRemaining === null ? undefined : { splitsRemaining },
      // rc.37 (F1, as the arc bot does): priced on the career's growth model.
      growthModel: growthModelOf(save.world),
    });
    const level = Math.min(2, Math.max(0, Number(save.scouted[view.id] ?? 0))) as ScoutLevel;
    // rc.32: the band the market screen shows (the save's development model);
    // rc.37 (F1): and its band model (the uniform band from rc.37 on).
    const band = scoutedBand(view.potential, view.overall, level, save.careerSeed, view.id, growthModelOf(save.world), {
      uniform: readsUniformBand(save.bandModel),
    });
    const baseTalk = policy?.negotiate ? signingTalkFor(save, view, pack, undefined, 3) : null;
    const talk = baseTalk && policy?.shareWage ? signingTalkFor(save, view, pack, { sharePct: baseTalk.zone.shareMax }, 3) : baseTalk;
    const offer = talk ? { weekly: talk.zone.floorWeekly, ...(policy?.shareWage ? { sharePct: talk.offered.sharePct } : {}) } : undefined;
    const priced = offer ? signingTalkFor(save, view, pack, offer, 3) : null;
    const wage = priced ? priced.offered.wagePerSplit : pack.salaryPerSplit;
    if (!Number.isFinite(wage) || wage <= 0 || (offer && weeklyOf(wage) !== offer.weekly)) throw new Error("Audit contract wage disagrees with actual negotiation");
    out.push({
      view,
      cost: pack.fee + pack.signingBonus,
      salaryPerSplit: wage,
      offer,
      lengthSeasons: policy?.negotiate ? 3 : 2,
      potentialRead: (band.min + band.max) / 2,
      ask: pack.salaryPerSplit,
      free: splitsRemaining === null,
    });
  };
  for (const view of listing.freeAgents) add(view, null);
  for (const c of listing.contracted) add(c.view, c.splitsRemaining);
  return out;
}

function starters(save: CareerSave) {
  return save.squad.filter((p) => save.starterIds.includes(p.id));
}

/**
 * rc.37 F2 (package 4): the store runs `spendAlertFlow` after EVERY player
 * action (careerStore.withResult), so a one-off spend that brings the floor
 * within reach raises its notice at once; the bot's actions do the same.
 */
function alerted(before: CareerSave, after: CareerSave): CareerSave {
  return after === before ? after : spendAlertFlow(before, after);
}

function sign(save: CareerSave, c: Candidate, t: Tally, releaseId?: string): CareerSave | null {
  // ECO-03 (R47): the slot follows the squad (an open seat, else the reserve); the price never changes.
  const res = signPlayerFlow(save, c.view.id, { lengthSeasons: c.lengthSeasons ?? 2, offer: c.offer, releaseId });
  if (res.error) return null;
  policyAction(t.policy, "signing", save, res.save, c.view.id);
  t.signings += 1;
  if (c.view.overall >= 88) t.starSignings += 1;
  return alerted(save, res.save);
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
function fillSeats(input: CareerSave, policy: ArcPolicy, t: Tally, pool: Candidate[] = candidatesFor(input, policy)): CareerSave {
  let save = input;
  const byOverall = [...pool].sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
  const byCost = [...pool].sort((a, b) => a.cost - b.cost || b.view.overall - a.view.overall);
  const youngest = pool.filter((c) => c.view.age <= 19 && eligible(c, policy)).sort((a, b) => b.potentialRead - a.potentialRead);
  // A refused signing (no funds for a fee while the Backer is owed, a closed
  // window…) is never retried in the same visit.
  const tried = new Set<string>();
  const pick = (list: Candidate[]) =>
    list.find((c) => !tried.has(c.view.id) && affordable(save, c.cost, c.salaryPerSplit, policy));
  while (starters(save).length < 3) {
    const c =
      pick(policy.market === "youth" ? youngest : byOverall.filter(c => eligible(c, policy))) ??
      pick(byCost) ??
      (squadIsShort(save) ? byCost.find((x) => !tried.has(x.view.id)) : undefined);
    if (!c) break;
    tried.add(c.view.id);
    save = sign(save, c, t) ?? save;
  }
  return save;
}

/**
 * rc.39 F6 (R103): a starter is ruled out of the committed event and nobody
 * covers his seat. What a manager does on the eve: sign a free agent as the
 * reserve — the best one whose wage is small beside the starters' (at most
 * half the cheapest starter's) and fits the policy's budget, else the
 * cheapest in the pool (never refused for money: emptySeatPriceFor) — and, if
 * nobody signs, sit a regional or its qualifier out. He stays as the reserve
 * for the length of his deal, so the next absence is covered.
 */
function coverAbsence(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  let save = signReserve(input, policy, t, true);
  if (uncoveredAbsenceOf(save) && canSkipShortSquadEvent(save)) {
    const skipped = skipShortSquadEventFlow(save);
    if (!skipped.error) save = alerted(save, skipped.save);
  }
  return save;
}

/**
 * rc.39 F6 (R103, Miguel 10/11): a reserve only signs in a transfer window.
 * A manager who read the rule keeps one from the season it applies: in a
 * window, with no reserve, the best free agent whose wage is small beside the
 * starters' (at most half the cheapest starter's) and fits the budget; with a
 * starter already ruled out (`must`), the cheapest one if nobody fits.
 */
function signReserve(input: CareerSave, policy: ArcPolicy, t: Tally, must: boolean): CareerSave {
  let save = input;
  if (!isWindowWeek(weekOfDay(save.clock.day)) || save.squad.length !== 3 || starters(save).length !== 3) return save;
  const pool = candidatesFor(save, policy).filter((c) => c.free);
  const starterWage = Math.min(...starters(save).map((p) => p.salaryPerSplit));
  const modest = pool
    .filter((c) => c.salaryPerSplit <= starterWage / 2 && affordable(save, c.cost, c.salaryPerSplit, policy))
    .sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
  const byCost = [...pool].sort((a, b) => a.salaryPerSplit - b.salaryPerSplit || b.view.overall - a.view.overall);
  for (const c of [...modest.slice(0, 2), ...(must ? byCost.slice(0, 6) : [])]) {
    if (save.squad.length !== 3) break;
    save = sign(save, c, t) ?? save;
  }
  return save;
}

/** RTW-05 test hook: one visit of the bot's seat filler (a squad under three always signs, broke or not). */
export function fillSeatsForTests(save: CareerSave, policyId: ArcPolicyId): CareerSave {
  return fillSeats(save, ARC_POLICIES[policyId], newTally(save, new Set()));
}

function eligible(c: Candidate, policy: ArcPolicy): boolean {
  return (!policy.candidateKind || c.view.kind === policy.candidateKind)
    && (policy.candidateMaxAge === undefined || c.view.age <= policy.candidateMaxAge)
    && (policy.candidateMinBand === undefined || c.potentialRead >= policy.candidateMinBand)
    && (policy.candidateMinOverall === undefined || c.view.overall >= policy.candidateMinOverall);
}
/** One window visit: fill open seats, then (by policy) one upgrade. */
function marketMoves(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  // A visible sporting milestone changes the manager's strategy, not the
  // simulation: no season locks, free cash or guaranteed titles.
  if (policy.contendWhenReady && (input.stats.majorsQualified > 0 || input.history.some(s => s.majorsQualified > 0))) {
    policy = { ...policy, market: "upgrade" };
  }
  if ((policy.switchAtRep !== undefined && input.reputation >= policy.switchAtRep) ||
      (policy.switchAfterSeason !== undefined && input.clock.seasonIndex >= policy.switchAfterSeason)) {
    policy = { ...policy, market: "upgrade", candidateKind: undefined, candidateMaxAge: undefined,
      candidateMinBand: undefined, candidateMinOverall: undefined, upgradeMargin: 2 };
  }
  let working = input;
  if (policy.scoutShortlist) {
    const shortlist = candidatesFor(working, policy).filter(c => eligible(c, policy))
      .sort((a,b) => b.potentialRead - a.potentialRead).slice(0, 2);
    for (const c of shortlist) {
      if (Number(working.scouted[c.view.id] ?? 0) >= 2) continue;
      const report = buyScoutReportFlow(working, c.view.id);
      if (!report.error && affordable(report.save, 0, 0, policy)) working = alerted(working, report.save);
    }
  }
  const pool = candidatesFor(working, policy);
  t.market ??= marketLevelOf(working, pool);
  const save = fillSeats(working, policy, t, pool);
  const byOverall = [...pool].sort((a, b) => b.view.overall - a.view.overall || a.view.id.localeCompare(b.view.id));
  if (policy.market === "keep") return save;
  const marketWindow = `${save.clock.seasonIndex}:${windowIndexOf(weekOfDay(save.clock.day))}`;
  if (policy.maxUpgradePerWindow && memOf(policy).lastUpgradeWindow === marketWindow) return save;

  // 2. One upgrade per visit: release the weakest starter for a clearly better player.
  const lineup = starters(save).sort((a, b) => a.overall - b.overall);
  const weakest = lineup[0];
  if (!weakest) return save;
  const margin = policy.upgradeMargin ?? (policy.market === "stars" ? 1 : 3);
  const age = (v: CareerPlayerView) => v.age;
  const incumbentBand = scoutedBand(weakest.potential, weakest.overall,
    Math.min(2, Math.max(0, Number(save.scouted[weakest.id] ?? weakest.scoutLevel ?? 0))) as ScoutLevel,
    save.careerSeed, weakest.id, growthModelOf(save.world), { uniform: readsUniformBand(save.bandModel) });
  const incumbentRead = (incumbentBand.min + incumbentBand.max) / 2;
  const preservesFuture = (c: Candidate) => !policy.protectPotential ||
    c.potentialRead >= incumbentRead - 1 || c.view.overall >= weakest.overall + 6;
  const allowed = pool.filter(c => eligible(c, policy) && preservesFuture(c));
  const list =
    policy.market === "youth"
      ? allowed
          .filter((c) => age(c.view) <= 19 && c.potentialRead >= incumbentRead + 3 && c.view.overall >= weakest.overall - 2)
          .sort((a, b) => b.potentialRead - a.potentialRead)
      : byOverall.filter((c) => eligible(c, policy) && preservesFuture(c) && c.view.overall >= weakest.overall + margin);
  const severance = weakest.salaryPerSplit * Math.max(1, (weakest.contractEndSeason - save.clock.seasonIndex) * 3) * 0.5;
  if (policy.atomicMoves) {
    for (const candidate of list) {
      if (!affordable(save, candidate.cost + severance, candidate.salaryPerSplit - weakest.salaryPerSplit, policy)) continue;
      const signed = sign(save, candidate, t, weakest.id);
      if (signed) { if (policy.maxUpgradePerWindow) memOf(policy).lastUpgradeWindow = marketWindow; return signed; }
    }
    return save;
  }
  const c = list.find((x) => affordable(save, x.cost + severance, x.salaryPerSplit - weakest.salaryPerSplit, policy));
  if (!c) return save;
  const released = releasePlayerFlow(save, weakest.id);
  if (released.error) return save;
  const afterRelease = alerted(save, released.save);
  return sign(afterRelease, c, t) ?? afterRelease;
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
      if (!res.error) { policyAction(policy, "renewal", save, res.save, p.id); save = alerted(save, res.save); }
      continue;
    }
    const young = ageOf(p.birthYear, seasonIndex) <= 21;
    if (p.overall < lineupFloor - 1 && !young) continue;
    // The renewal ask, from the talk renewPlayerFlow answers with.
    const baseTalk = renewalTalkFor(save, p, 2);
    const talk = policy.shareWage ? renewalTalkFor(save, p, 2, { sharePct: baseTalk.zone.shareMax }) : baseTalk;
    const offer = { weekly: talk.zone.floorWeekly, ...(policy.shareWage ? { sharePct: talk.offered.sharePct } : {}) };
    const priced = renewalTalkFor(save, p, 2, offer);
    const ask = policy.humanPrefs ? priced.offered.wagePerSplit : (policy.shareWage ? priced.offered.wagePerSplit : talk.ask.wagePerSplit);
    if (!Number.isFinite(ask) || weeklyOf(ask) !== offer.weekly) throw new Error("Audit renewal wage disagrees with actual negotiation");
    if (!affordable(save, 0, ask - p.salaryPerSplit, policy)) continue;
    // rc.33 (ECO-11): the zone is shown, so a negotiating manager signs at his
    // floor (his share ask, the least wage he takes this window) — about what
    // rc.32's 92 % opening paid on average (a third of them took it).
    const res = renewPlayerFlow(save, p.id, 2, offer);
    const accepted = res.error ? renewPlayerFlow(save, p.id, 2) : res;
    if (!accepted.error) { policyAction(policy, "renewal", save, accepted.save, p.id); save = alerted(save, accepted.save); }
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
  if (policy.coach === "none" || (save.coach && policy.keepFirstCoach) || save.reputation < CAREER_UNLOCKS.coachRep) return save;
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
  if (!res.error) policyAction(policy, "coach", save, res.save, pick.id);
  return res.error ? save : alerted(save, res.save);
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
  onEvent?: (save: CareerSave) => void;
  /** rc.37: the user's event before and after its real settlement (finishEvent: prize, reputation). */
  onSettled?: (before: CareerSave, after: CareerSave) => void;
}

/** A team's rating as the lobby and bracket show it (the AI's hidden difficulty shift left out). */
function shownRating(team: { rating: { total: number; difficultyShift: number } } | undefined): number {
  return team ? team.rating.total - team.rating.difficultyShift : 0;
}

/**
 * rc.37 F3: the "adaptive" briefing, on the numbers the screens show.
 * Championship Sunday (the bracket is set): the favourite of the playoff
 * field peaks for the grand final ("recover": −QF/SF, +GF); anyone else
 * spends it on the early rounds ("prepare": +QF/+SF, −GF). Regional Sunday:
 * a side among the field's four strongest saves it for the playoffs
 * ("recover"); the rest study the Swiss ("prepare"), which decides them.
 */
function adaptiveBriefingOf(save: CareerSave): SundayBriefingChoice {
  const ahead = sundayAheadOf(save);
  if (!ahead) return "keep";
  if (ahead.kind === "championship" && save.activeEvent) {
    const tr = save.activeEvent.tournament;
    const others = (tr.playoffs?.seeds ?? []).filter((id) => id !== "user").map((id) => shownRating(tr.teams[id]));
    return others.length > 0 && shownRating(tr.teams.user) >= Math.max(...others) ? "recover" : "prepare";
  }
  const { field } = eventFieldFor(save, ahead.def);
  const user = field.find((team) => team.isUser);
  const stronger = field.filter((team) => !team.isUser && shownRating(team) > shownRating(user)).length;
  return stronger < 4 ? "recover" : "prepare";
}

/**
 * rc.37 F2: the bank's offer (a `creditOffer` notice, or a `spendRisk` one
 * carrying it) under the policy's `credit` rule — the sum is the notice's own.
 */
function takesCredit(save: CareerSave, policy: ArcPolicy, principal: number): boolean {
  const rule = policy.credit ?? "never";
  if (rule === "never") return false;
  if (rule === "take") return true;
  // "lastResort": an incoming offer in hand that covers the bank's sum is the first answer.
  const inHand = save.pendingOffers
    .filter((o) => o.status === "pending" && o.direction === "out")
    .reduce((best, o) => Math.max(best, o.fee), 0);
  return inHand < principal;
}

/**
 * The money notices, read as the modal makes a player do (rc.34). rc.37 F2:
 * one that carries the bank's offer is answered by the policy's `credit` rule
 * (acceptCreditOfferFlow takes exactly the quoted loan and closes the notice).
 */
function answerMoneyNotices(input: CareerSave, policy: ArcPolicy, t: Tally): CareerSave {
  let save = input;
  for (let guard = 0; guard < 32; guard++) {
    // rc.40 (R110) made the bank's offer mail-only: `moneyNoticeOf` no longer returns it, so the bot
    // reads the quoted offer from the queue, as a player opening the mail does (rc.42: it saw none).
    const notice =
      (save.moneyNotices ?? []).find((n) => n.kind === "creditOffer" || n.kind === "spendRisk") ?? moneyNoticeOf(save);
    if (!notice) break;
    const principal = Number(notice.params?.principal ?? 0);
    const offered = (notice.kind === "creditOffer" || notice.kind === "spendRisk") && principal > 0;
    if (offered) t.crisis.creditOffers += 1;
    if (offered && takesCredit(save, policy, principal)) {
      const res = acceptCreditOfferFlow(save, notice.id);
      if (!res.error) {
        policyAction(policy, "credit", save, res.save, String(principal));
        t.crisis.creditTaken += 1;
        t.crisis.creditPrincipal += principal;
      }
      save = res.save;
      continue;
    }
    save = acknowledgeMoneyNoticeFlow(save, notice.id);
  }
  return save;
}

/** Today's decisions, in the order a player meets them. */
function decide(input: CareerSave, policy: ArcPolicy, t: Tally, opts: ArcOpts = {}): CareerSave {
  let save = input;
  if (policy.adaptFinances && save.finances.balance < 0) {
    // A visible warning changes discretionary decisions, not game balance.
    if (save.finances.gear.psychologist) save = setPsychologistFlow(save, false).save;
    policy = { ...policy, fullSupport: false, eagerInfrastructure: false, infrastructure: false, bids: "whenTight" };
  }
  if (policy.switchAfterSale && (memOf(policy).memorySoldTalent || save.transferLog.some(l => l.kind === "userOut"))) {
    policy = { ...policy, market: "stars", candidateKind: "real", candidateMinOverall: 88,
      candidateMinBand: undefined, candidateMaxAge: undefined, upgradeMargin: -5 };
  }
  // rc.34: a money notice (the emergency loan, its deadline) is read, as the modal makes a player do —
  // nothing in the books moves, and the clock never waits on an unread one. rc.37 F2: the bank's offer
  // is answered by the policy's `credit` rule.
  save = answerMoneyNotices(save, policy, t);
  // RTW-05 (rc.33): a squad under three signs first — no event starts short.
  if (!save.activeEvent && save.phase === "running" && squadIsShort(save)) save = fillSeats(save, policy, t);
  // rc.39 F6 (R103): ...and covers a ruled-out starter before his event.
  if (!save.activeEvent && save.phase === "running" && uncoveredAbsenceOf(save)) save = coverAbsence(save, policy, t);
  // ...and keeps a reserve from the season the rule applies (signed in a window, once a week at most).
  if (
    !save.activeEvent && save.phase === "running" &&
    CAREER_WORLD.unavailabilityWithoutReserve === "short" &&
    save.clock.seasonIndex >= CAREER_WORLD.unavailabilityNoReserveGraceSeasons &&
    save.squad.length === 3 && dayOfWeekOf(save.clock.day) === 1
  ) {
    save = signReserve(save, policy, t, false);
  }
  // The user's event: instant sim; a two-day event pauses on Saturday (tomorrow plays Sunday).
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") {
      countSeries(save, t);
      opts.onEvent?.(save);
      const unsettled = save;
      save = finishEvent(save);
      opts.onSettled?.(unsettled, save);
    }
  } else if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") {
      countSeries(save, t);
      opts.onEvent?.(save);
      const unsettled = save;
      save = finishEvent(save);
      opts.onSettled?.(unsettled, save);
    }
  }
  if (save.phase !== "running") return save;
  // rc.36 (SUN-01): back in HQ on Saturday evening — Sunday is started with the policy's briefing
  // (the loop's next day is Sunday).
  if (sundayStopHolds(save)) {
    // rc.37 F3: the flow ignores any choice without a hired coach (no bonus); the bot still asks, as a player would.
    const choice = policy.briefing === "none" ? null : policy.briefing === "adaptive" ? adaptiveBriefingOf(save) : policy.briefing;
    const briefed = recordSundayBriefingFlow(save, choice);
    if (!briefed.error) { policyAction(policy, "briefing", save, briefed.save, choice ?? "none"); save = briefed.save; }
  }
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = alerted(save, answerInsert(save, policy));
  // Every offered cup is entered (the store's enterUnofficial).
  if (!policy.skipOptionalCups && save.unofficialOffer && !save.pendingEventDef && !save.activeEvent) {
    save = { ...structuredClone(save), pendingEventDef: save.unofficialOffer };
  }
  save = chooseSponsor(save, policy);
  for (const bid of save.pendingOffers.filter((o) => o.status === "pending" && o.direction === "out")) {
    const net = statementOf(save).net;
    const tight = net < 0 && save.finances.balance / -net < 8;
    const current = save.squad.find(p => p.id === bid.playerId);
    const saleSplit = `${save.clock.seasonIndex}:${windowIndexOf(weekOfDay(save.clock.day))}`;
    const mem = memOf(policy);
    // rc.37 F2: an emergency offer (below market, a red balance's) answers to the crisis rule only;
    // a planned sale (sellToFund) never takes the discount.
    const emergency = Boolean(bid.emergency);
    if (emergency && !t.crisis.emergencySeen.includes(bid.id)) {
      t.crisis.emergencySeen.push(bid.id);
      t.crisis.emergencyOffers += 1;
    }
    const trade = !emergency && policy.sellToFund && (!policy.maxSalesPerSeason || mem.lastSaleSeason !== save.clock.seasonIndex)
      && (!policy.maxSalesPerSplit || mem.lastSaleSplit !== saleSplit) && current && ageOf(current.birthYear, save.clock.seasonIndex) >= (policy.sellMinAge ?? 21)
      && current.overall >= (policy.sellMinOverall ?? 0)
      && save.reputation >= (policy.sellAfterRep ?? 0)
      && (!policy.sellFictionalOnly || current.kind === "fictional")
      && bid.fee >= 6 * weeklyOf(current.salaryPerSplit);
    const rule = emergency ? (policy.emergencySale ?? policy.bids) : policy.bids;
    const wants = rule === "accept" || (rule === "whenTight" && tight) || trade;
    const sold = wants && !save.activeEvent ? acceptBidFlow(save, bid.id) : null;
    if (sold && !sold.error) {
      policyAction(policy, emergency ? "emergencySale" : "sale", save, sold.save, bid.playerId);
      if (policy.maxSalesPerSplit) mem.lastSaleSplit = saleSplit;
      t.sales += 1;
      if (emergency) { t.crisis.emergencyAccepted += 1; t.crisis.emergencyFees += bid.fee; }
      if (policy.maxSalesPerSeason) mem.lastSaleSeason = save.clock.seasonIndex;
      if (policy.switchAfterSale) mem.memorySoldTalent = true;
    }
    save = sold && !sold.error ? sold.save : declineBidFlow(save, bid.id);
  }
  const week = weekOfDay(save.clock.day);
  const dow = dayOfWeekOf(save.clock.day);
  if (policy.payDebtIfCovered && save.finances.loan && save.finances.balance >= save.finances.loan.remaining + 4 * statementOf(save).payroll) {
    const paid = payDebtFlow(save, save.finances.loan.remaining);
    save = paid.error ? paid.save : alerted(save, paid.save);
  }
  if (policy.infrastructure && dow === 1 && !save.activeEvent) {
    for (const gear of CAREER_GEAR.items) {
      if (save.finances.gear[gear.id]) continue;
      if (save.reputation < gear.repGate) break;
      const bought = buyGearFlow(save, gear.id);
      if (bought.error) break;
      const statement = statementOf(bought.save);
      if (policy.eagerInfrastructure || (policy.humanPrefs ? affordable(bought.save, 0, 0, policy) : (bought.save.finances.balance >= 8 * statement.payroll && (statement.net >= 0 || bought.save.finances.balance / -statement.net >= 12)))) {
        policyAction(policy, "gear", save, bought.save, gear.id); save = alerted(save, bought.save);
      }
      else break;
    }
  }
  if (policy.fullSupport && dow === 1 && !save.activeEvent) {
    const hired = !save.finances.gear.psychologist && save.reputation >= CAREER_GEAR.psychologistRep ? setPsychologistFlow(save, true) : null;
    if (hired && !hired.error) {
      const extra = save.finances.gear.psychologist ? 0 : psychologistPerSplitFor(save.clock.seasonIndex);
      if (policy.eagerInfrastructure || affordable(save, 0, extra, policy)) {
        policyAction(policy, "psychologist", save, hired.save); save = alerted(save, hired.save);
      }
    }
    // A human can hire a first coach as soon as the unlock is earned.
    if (!save.coach) save = coachMoves(save, policy);
  }
  if (!save.activeEvent) {
    if (isWindowWeek(week) && (dow === 1 || dow === 4)) save = marketMoves(save, policy, t);
    if ((policy.regularCoachUpgrades && dow === 1) || (!policy.regularCoachUpgrades && isWindowStartWeek(week) && dow === 2 && week <= 2)) save = coachMoves(save, policy);
    if (!policy.renewAtReviewOnly && week === 24 && dow === 1) save = renewals(save, policy);
  }
  // rc.34 (DEV-03): training is a package per period, never a weekly click —
  // a waiting proposal is approved (the bot never adjusts). rc.36 (front T2):
  // nothing runs until a plan is picked — the policy starts each cycle.
  if (trainingDecisionOf(save)) {
    t.promptDays.add(save.clock.seasonIndex * 1000 + save.clock.day);
    save = approveTrainingProposalFlow(save).save;
  }
  const hadPlan = Boolean(trainingOf(save).plan?.package);
  save = startArcCycle(save, policy);
  // rc.37 F6: since rc.36 (front T2) no proposal waits — the manager picks the plan at a cycle start;
  // that pick is the training decision `prompts` counts (it read 0 in every season of the 06/11 battery).
  if (!hadPlan && trainingOf(save).plan?.package) t.promptDays.add(save.clock.seasonIndex * 1000 + save.clock.day);
  // rc.34 (HQ decision 5-A's measurement, opt-in): a bootcamp on the first
  // Monday of each split it is affordable — `bootcamp` in playArcCareer's cfg.
  if ((opts.bootcamp || policy.fullSupport) && dow === 1 && !save.activeEvent && !save.finances.bootcampUsedThisSplit) {
    const tier = bootcampTierFor(save.reputation);
    if (tier !== 0 && (policy.eagerInfrastructure || affordable(save, bootcampCostFor(tier, save.clock.seasonIndex), 0, policy))) {
      const res = runBootcampFlow(save);
      if (!res.error) {
        policyAction(policy, "bootcamp", save, res.save);
        save = alerted(save, res.save);
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
      buffType: policy.buffType ?? "consistency",
    },
    difficulty,
    prefs: policy.humanPrefs ? { ...CAREER_DIFFICULTY.prefs[difficulty] } : ARC_BOT_PREFS,
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

/** The career a run plays (playArcCareer's cfg minus the observers). */
export interface ArcCareerCfg {
  region: Region;
  difficulty: CareerDifficulty;
  policy: ArcPolicyId;
  seed: number;
  seasons: number;
  /** Wall-clock budget: past it the career stops as a softlock with where it stood. */
  budgetMs?: number;
  policyOverrides?: Partial<ArcPolicy>;
  /** rc.34 (5-A's measurement, opt-in): book a bootcamp each split. */
  bootcamp?: boolean;
  rosterKey?: CreateCareerInput["rosterKey"];
  fullSupport?: boolean;
  /** rc.34: override the policy's sponsor pick (the probe's ECON_SPONSOR). */
  sponsor?: ArcSponsorPick;
  /** rc.34: override the policy's other-income answer (the probe's ECON_OTHERS). */
  others?: ArcPolicy["others"];
}

/** The observers of a run (test-only; never part of its state). */
export interface ArcHooks {
  /** Observer of a finished user event before its real settlement. */
  onEvent?: (save: CareerSave) => void;
  /** rc.37: the same event before and after its settlement (the prize and reputation it paid). */
  onEventSettled?: (before: CareerSave, after: CareerSave) => void;
  /** rc.36 (UX-02): read each season's start (day 1, its goal set) and end (the review) — the goals probe. */
  onSeason?: (moment: "start" | "end", save: CareerSave) => void;
  /** Test-only observation after each real-flow day, including the founding day. */
  onDay?: (save: CareerSave) => void;
  onAction?: ArcPolicy["onAction"];
  /**
   * rc.37 integration (the paired Worlds experiment): `take` is called ONCE,
   * at the top of the first day `when` holds — before that day's decisions
   * (`userWorldsStartsToday`: before the Worlds field is built). It may
   * structuredClone the run there and continue the copy under another
   * condition later; the run itself goes on untouched.
   */
  fork?: { when: (save: CareerSave) => boolean; take: (run: ArcRun) => void };
}

/**
 * rc.37 integration: a career in progress, as plain data — the save, the
 * bot's policy and memory, the records so far and where the day loop stands —
 * so it can be cloned (a fork) and continued (an extension past S10) without
 * replaying the seasons before. `advanceArcRun` moves it; `playArcCareer` is
 * one start + one advance.
 */
export interface ArcRun {
  bootcamp: boolean;
  budgetMs: number;
  /** Wall-clock spent by earlier advance calls (the budget counts every segment). */
  elapsedMs: number;
  policy: ArcPolicy;
  save: CareerSave;
  out: ArcCareer;
  seen: Set<string>;
  /** The season the loop is on (0-based count of seasons started). */
  season: number;
  /** Where the loop stands: before a season's start, inside its days, after its record, or finished. */
  stage: "seasonStart" | "inSeason" | "seasonOver" | "done";
  t: Tally | null;
  blocked: number;
  guard: number;
  /** The fork hook has run (a run, and any copy of it, forks once). */
  forked: boolean;
}

/** Creates a run on the founding day (no day played yet). */
export function startArcRun(cfg: ArcCareerCfg): ArcRun {
  const policy: ArcPolicy = {
    ...ARC_POLICIES[cfg.policy],
    ...cfg.policyOverrides,
    ...(cfg.rosterKey ? { rosterKey: cfg.rosterKey } : {}),
    ...(cfg.fullSupport !== undefined ? { fullSupport: cfg.fullSupport, infrastructure: cfg.fullSupport } : {}),
    ...(cfg.sponsor ? { sponsor: cfg.sponsor } : {}),
    ...(cfg.others ? { others: cfg.others } : {}),
  };
  delete policy.onAction;
  // The memory is created here, so every per-day copy of the policy shares it.
  policy.mem = {};
  const save = createCareerSave(inputFor(cfg.region, cfg.difficulty, policy), cfg.seed);
  return {
    bootcamp: Boolean(cfg.bootcamp),
    budgetMs: cfg.budgetMs ?? 120_000,
    elapsedMs: 0,
    policy,
    save,
    out: {
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
    },
    seen: new Set<string>(save.finances.ledger.map((l) => l.id)),
    season: 0,
    stage: "seasonStart",
    t: null,
    blocked: 0,
    guard: 0,
    forked: false,
  };
}

/** The morning the user's Worlds starts: today's matchday, not started yet (the fork point of the Worlds pairs). */
export function userWorldsStartsToday(save: CareerSave): boolean {
  return save.pendingEventDef?.tier === "worlds" && save.pendingEventDef.day === save.clock.day && !save.activeEvent;
}

/** rc.37 integration: the fielded trio's chemistry, its pairs' shared tenure and heritage (ArcSeason.chemistry). */
function chemistryOf(save: CareerSave): ArcSeason["chemistry"] {
  if (save.squad.length === 0) return undefined;
  const team = userTeamFor({
    identity: save.identity, squad: save.squad, starterIds: save.starterIds, coach: save.coach, gear: save.finances.gear,
    bootcampSharp: save.finances.bootcampSharp, seasonIndex: save.clock.seasonIndex, careerSeed: save.careerSeed,
    difficulty: save.difficulty, unavailablePlayerId: null,
  });
  const fielded = team.fieldedIds.map((id) => save.squad.find((p) => p.id === id)).filter((p): p is (typeof save.squad)[number] => Boolean(p));
  const pairTenure: number[] = [];
  const heritage = { country: 0, region: 0, none: 0 };
  for (let i = 0; i < fielded.length; i++) for (let j = i + 1; j < fielded.length; j++) {
    const a = fielded[i], b = fielded[j];
    pairTenure.push(Math.round(Math.min(a.splitsTogether, b.splitsTogether) * 100) / 100);
    if (a.country && b.country && a.country === b.country) heritage.country += 1;
    else if (a.region === b.region) heritage.region += 1;
    else heritage.none += 1;
  }
  return { percent: team.team.chemistry.percent, tier: String(team.team.chemistry.tier), pairTenure, heritage };
}

/** The season's record (the row the arc tests and the human audit read). */
function seasonRowOf(save: CareerSave, t: Tally): ArcSeason {
  const last = save.history[save.history.length - 1];
  const stmt = statementOf(save);
  return {
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
    crisis: crisisOf(t),
    chemistry: chemistryOf(save),
    market: t.market ?? null,
    // rc.34: the last period is filed at the rollover — read it off a copy filed now.
    training: (() => {
      const filed = structuredClone(save);
      trainingSeasonEnd(filed);
      return trainingOfSeason(filed, save.clock.seasonIndex, t);
    })(),
  };
}

/**
 * Moves a run until `seasons` seasons are recorded (or it ends), continuing
 * past a title / the timeline like the store's "continue". A run left after
 * its last season ("seasonOver") can be advanced again with a larger
 * `seasons`: the review and the rollover then run as they would have. The
 * day loop is rc.36's, step for step.
 */
export function advanceArcRun(run: ArcRun, seasons: number, hooks: ArcHooks = {}): ArcRun {
  const t0 = Date.now();
  const previousObserver = actionObserver;
  actionObserver = hooks.onAction;
  const policy = run.policy;
  const limit = DAYS_PER_SEASON * 4;
  try {
    while (run.stage !== "done") {
      if (run.stage === "seasonOver") {
        const save = run.save;
        if (run.season >= seasons - 1) break;
        if (save.phase === "seasonReview") {
          // rc.34 (UX-06b): the explicit contract review before the rollover — the
          // bot renewed whom it wanted at W24 and lets the rest go.
          run.save = reviewContractsFlow(save).save;
          const hold = rolloverHoldOf(run.save);
          if (hold) {
            run.out.softlock = `season ${run.save.clock.seasonIndex} review: ${hold.kind} ${hold.id} still holds the rollover`;
            run.out.ended = "softlock";
            run.stage = "done";
            break;
          }
          // The store's "continue": past a title or the dataset timeline, into the infinite era.
          if (run.save.end.ended) {
            run.save = structuredClone(run.save);
            run.save.end.infinite = true;
            run.save.end.creditsShown = true;
          }
          run.save = rolloverToNextSeason(run.save);
        }
        run.season += 1;
        run.stage = "seasonStart";
        continue;
      }
      if (run.stage === "seasonStart") {
        const t = newTally(run.save, run.seen);
        t.policy = policy;
        run.t = t;
        hooks.onSeason?.("start", run.save);
        run.blocked = 0;
        run.guard = 0;
        run.stage = "inSeason";
      }
      // stage "inSeason": the day loop.
      const t = run.t!;
      while (run.save.phase === "running" && run.guard < limit) {
        if (!run.forked && hooks.fork?.when(run.save)) {
          run.forked = true;
          hooks.fork.take(run);
        }
        run.guard += 1;
        let save = run.save;
        if (run.elapsedMs + (Date.now() - t0) > run.budgetMs) {
          run.out.softlock = `budget: season ${save.clock.seasonIndex} day ${save.clock.day} squad ${save.squad.length} starters ${starters(save).length} event ${save.pendingEventDef?.id ?? "-"}/${save.activeEvent?.def.id ?? "-"}`;
          break;
        }
        save = decide(save, policy, t, { bootcamp: run.bootcamp, onEvent: hooks.onEvent, onSettled: hooks.onEventSettled });
        track(save, t);
        hooks.onDay?.(save);
        if (save.sponsor && run.out.firstSponsorSeason === null) run.out.firstSponsorSeason = save.clock.seasonIndex;
        if (save.phase !== "running") {
          run.save = save;
          break;
        }
        const before = save.clock.day;
        const wasMonday = dayOfWeekOf(before + 1) === 1;
        save = advanceDayFlow(save);
        track(save, t);
        hooks.onDay?.(save);
        run.save = save;
        if (wasMonday && save.clock.day === before + 1 && save.finances.balance < 0) t.mondaysNegative += 1;
        if (save.clock.day === before && save.phase === "running") {
          run.blocked += 1;
          if (run.blocked > 3) {
            const hold = clockHoldOf(save);
            run.out.softlock = `season ${save.clock.seasonIndex} day ${before}: ${save.pendingEventDef?.id ?? "no event"} / ${save.activeEvent?.def.id ?? "-"}${hold ? ` (holds: ${hold.kind} ${hold.id})` : ""}`;
            break;
          }
        } else run.blocked = 0;
      }
      if (policy.humanPrefs && run.save.phase === "seasonReview") run.save = renewals(run.save, policy);
      track(run.save, t);
      hooks.onSeason?.("end", run.save);
      const row = seasonRowOf(run.save, t);
      run.out.seasons.push(row);
      run.t = null;
      if (row.majorsQualified > 0 && run.out.firstMajorSeason === null) run.out.firstMajorSeason = row.seasonIndex;
      if (row.worlds !== null && run.out.firstWorldsSeason === null) run.out.firstWorldsSeason = row.seasonIndex;
      if (row.worlds === "champion" && run.out.worldsTitleSeason === null) run.out.worldsTitleSeason = row.seasonIndex;
      if (run.out.softlock) {
        run.out.ended = "softlock";
        run.stage = "done";
      } else if (run.save.phase === "ended") {
        run.out.ended = run.save.end.reason ?? "insolvency";
        run.stage = "done";
      } else run.stage = "seasonOver";
    }
  } finally {
    actionObserver = previousObserver;
    run.elapsedMs += Date.now() - t0;
    run.out.ms = run.elapsedMs;
  }
  return run;
}

/** Plays `seasons` seasons (continuing past a title / the timeline like the store's "continue"). */
export function playArcCareer(cfg: ArcCareerCfg & ArcHooks): ArcCareer {
  const run = startArcRun(cfg);
  return advanceArcRun(run, cfg.seasons, cfg).out;
}

/** The world's players in rosters and free agency this season (for the curve samplers). */
export function worldPlayerViews(save: CareerSave): CareerPlayerView[] {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  const ids = [...Object.values(save.world.orgs).flatMap((o) => o.playerIds), ...save.world.freeAgentIds];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}
