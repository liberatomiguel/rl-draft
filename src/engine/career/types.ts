/**
 * Road to Worlds — career-mode domain types (design doc: docs/ROAD-TO-WORLDS-DESIGN.md).
 *
 * The career layer NEVER mutates the base dataset: real players/orgs are
 * referenced by their dataset ids, dynamic state lives here, and everything
 * derivable (attribute offsets, potential, birth years, filler identities) is
 * DERIVED from (careerSeed, id) by pure functions rather than stored — the
 * save persists deltas and decisions, not the world.
 *
 * Engine rules apply: pure TS, no React, no storage, all randomness through
 * injected Rng streams (see ./seeds.ts).
 */

import type {
  Difficulty,
  Placement,
  Region,
  StatKey,
  TournamentState,
} from "../types";

// ---------------------------------------------------------------------------
// Identity & preferences
// ---------------------------------------------------------------------------

export interface CareerColors {
  /** Hex like "#f97316". Applied to the tintable crest + org accents. */
  primary: string;
  secondary: string;
}

export interface CareerIdentity {
  orgName: string;
  /** 2-4 uppercase chars, monogram + table label. */
  abbrev: string;
  managerName: string;
  /** ISO 3166-1 alpha-2 (drives the manager flag chip). */
  country: string;
  region: Region;
  crestId: string;
  colors: CareerColors;
  /** The org's chosen identity buff (fed to the team assembler as orgOverride). */
  buffType: StatKey;
}

export type ManagementStyle = "handsOn" | "balanced" | "delegate";

export interface CareerPrefs {
  managementStyle: ManagementStyle;
  autoTrain: boolean;
  autoEnterUnofficials: boolean;
  playbackDefault: "full" | "instant";
  newsDigest: boolean;
}

/** Career difficulty excludes legacy (reserved for a later preset). */
export type CareerDifficulty = Exclude<Difficulty, "legacy">;

// ---------------------------------------------------------------------------
// Players (dynamic layer over the dataset)
// ---------------------------------------------------------------------------

export type ArchetypeId =
  | "mechanical"
  | "anchor"
  | "playmaker"
  | "icecold"
  | "veteranmind"
  | "allround";

export type DeclineRate = "slow" | "normal" | "fast";
export type TrainingFocus = StatKey | "balanced" | "auto";
/** v2.0 (R27) weekly team drill ids (catalog: CAREER_TRAINING.drills). */
export type DrillId = "mechanics-lab" | "rotations" | "set-plays" | "film-room" | "clutch-sets";
export interface WeeklyDrill {
  seasonIndex: number;
  week: number;
  id: DrillId;
}
export type TrainingIntensity = "light" | "normal" | "heavy";
export type ScoutLevel = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// rc.34 (DEV-03, TRAINING-CONTRACT.md): training packages per period
// ---------------------------------------------------------------------------

/** T2: what a package is for. Also a coach's specialty (T4). */
export type TrainingObjective = "development" | "preparation" | "recovery";
/** T2: the squad's load (also a per-player tweak). */
export type TrainingWorkload = "light" | "normal" | "heavy";
/** T3: a scrim's level by the opponent's rating gap. */
export type ScrimLevel = "easy" | "even" | "hard";
/** T2: one squad focus — balanced, or one of the five drill themes (CAREER_TRAINING.drills). */
export type SquadFocus = "balanced" | DrillId;
/** T5: who decides the package at each period boundary. */
export type TrainingMode = "coach" | "approve" | "manual";

/** T2: an optional per-player tweak — the card lists only the players who differ. */
export interface PlayerTweak {
  /** His own attribute focus instead of the squad's (CAREER_PLAN.tweakFocus). */
  focus?: StatKey;
  /** His own workload instead of the squad's. */
  workload?: TrainingWorkload;
  /** Rest: he trains at the base (×1.00), plays no scrim and takes no wear. */
  rest?: boolean;
}

/** T2: one training package — the period's routine. */
export interface TrainingPackage {
  objective: TrainingObjective;
  focus: SquadFocus;
  workload: TrainingWorkload;
  /** 0..CAREER_SCRIM.package.maxPerWeek scrims a week, on fixed weekdays. */
  scrimsPerWeek: number;
  /** "auto" = the coach picks (even without a coach). */
  scrimLevel: ScrimLevel | "auto";
  tweaks?: Record<string, PlayerTweak>;
}

/** T6: a squad player's running totals inside a period (the summary reads them). */
export interface TrainingPeriodPlayer {
  name: string;
  overallStart: number;
  offsetsStart: Record<StatKey, number>;
  /** The day he joined the plan when he arrived mid-period (a signing). */
  joinedDay?: number;
  /** Overall from training sessions (decline not netted). */
  sessions: number;
  /** Overall from package scrims. */
  scrims: number;
  /** Official series played and the overall they paid. */
  series: number;
  seriesGain: number;
  /** The gain above the coachless package rate, summed per day (T7). */
  coachShare: number;
  /** Overall lost to DEV-01's decline. */
  declined: number;
  /** Wear points taken (T3). */
  wear: number;
  /** Ruled out of an event in this period (the pre-event roll). */
  unavailable?: boolean;
}

/** T6: the running period — one per season grid slot, never crossing a season. */
export interface TrainingPlan {
  seasonIndex: number;
  periodIndex: number;
  startDay: number;
  endDay: number;
  /** null = DEV-01's base (no package). */
  package: TrainingPackage | null;
  author: "coach" | "user" | "base";
  /** The day the current package took over (a mid-period change runs to the boundary). */
  packageFromDay: number;
  lastSessionDay: number;
  lastScrimDay: number;
  /** Days per coach (and their share), in order of arrival; id "none" = coachless days. */
  coaches: { id: string; name: string; days: number; share: number }[];
  players: Record<string, TrainingPeriodPlayer>;
  /** Package scrims won / lost by level. */
  scrims: Partial<Record<ScrimLevel, [number, number]>>;
  /** Team chemistry (percent) at the period's start. */
  chemStart: number;
  /** The squad's projected wear for the period (the pre-event roll reads it, T3/t6). */
  wearProjected: number;
  /** Per player: the most overall package scrims may pay in this period (T3's cap). */
  scrimCap: Record<string, number>;
  /** Exception lines the summary carries (copy keys under career.training.notes). */
  notes: { key: string; params?: Record<string, string | number> }[];
}

/** T5: a proposal waiting for the manager ("the coach proposes, I approve"). */
export interface TrainingProposal {
  seasonIndex: number;
  periodIndex: number;
  /** The day the clock holds on (the period's first day). */
  day: number;
  package: TrainingPackage;
  coachId: string;
  reasonKey: "default" | "event" | "wear";
}

/** T7: one player's line in a period summary. */
export interface TrainingSummaryPlayer {
  id: string;
  name: string;
  before: number;
  after: number;
  /** Attribute offset changes (non-zero only, 2 decimals). */
  attrs: Partial<Record<StatKey, number>>;
  sessions: number;
  scrims: number;
  series: number;
  seriesGain: number;
  coachShare: number;
  declined: number;
  wear: number;
  unavailable?: boolean;
  joined?: boolean;
}

/** T7: a closed period, filed as history (Training → History, HQ's "last period"). */
export interface TrainingSummary {
  seasonIndex: number;
  periodIndex: number;
  startDay: number;
  endDay: number;
  package: TrainingPackage | null;
  author: "coach" | "user" | "base";
  players: TrainingSummaryPlayer[];
  scrims: Partial<Record<ScrimLevel, [number, number]>>;
  chemStart: number;
  chemEnd: number;
  coaches: { name: string; days: number; share: number }[];
  notes: { key: string; params?: Record<string, string | number> }[];
  /** The next period's package objective (null = the base), when known. */
  next?: TrainingObjective | null;
}

/** rc.34 (DEV-03): the career's training state (CareerSave.training). */
export interface TrainingState {
  mode: TrainingMode;
  /** "Repeat until I change it": the last package runs again at the boundary. */
  repeat: boolean;
  /** The package the manager set ("I set it"/"adjust"): what "repeat" renews. */
  userPackage: TrainingPackage | null;
  plan: TrainingPlan | null;
  proposal: TrainingProposal | null;
  /** Ring of CAREER_PLAN.historySize summaries, newest first. */
  history: TrainingSummary[];
  /**
   * T8: an older save's per-player focus / intensity, offered as the tweaks
   * of the first package the manager builds (then cleared). Optional.
   */
  carryTweaks?: Record<string, PlayerTweak>;
}

/**
 * A world player as the career sees them RIGHT NOW. For real players most
 * fields are derived from the dataset + careerSeed (pure functions in
 * development.ts); fictional fillers/rookies are derived from their generated
 * id. This is a VIEW shape — the save stores only world deltas (see WorldState)
 * and full records for the user's squad.
 */
export interface CareerPlayerView {
  /** Dataset personId, or "fic:{region}:{n}" filler / "rook:{season}:{region}:{n}" rookie id. */
  id: string;
  kind: "real" | "fictional";
  name: string;
  country?: string;
  region: Region;
  age: number;
  archetype: ArchetypeId;
  /** Current overall (float 60-99; display rounds). */
  overall: number;
  /** attr = clamp(round(overall + offset), 60, 99); |offset| ≤ CAREER_DEV.attrOffsetCap. */
  attrOffsets: Record<StatKey, number>;
  /** HIDDEN true ceiling — UI only ever receives the scouted band. */
  potential: number;
  /** Hidden development shape. */
  peakAge: number;
  declineRate: DeclineRate;
  /** True while an AI-owned real player still tracks his real per-season cards. */
  anchored: boolean;
}

/** The scouted, spoiler-safe potential display band. */
export interface PotentialBand {
  min: number;
  max: number;
  level: ScoutLevel;
}

/** A player under contract with the USER org (max 4: 3 starters + 1 sub). */
export interface SquadPlayer {
  id: string;
  kind: "real" | "fictional";
  name: string;
  country?: string;
  region: Region;
  birthYear: number;
  archetype: ArchetypeId;
  overall: number;
  attrOffsets: Record<StatKey, number>;
  potential: number;
  peakAge: number;
  declineRate: DeclineRate;
  role: "starter" | "sub";
  salaryPerSplit: number;
  /**
   * rc.33 (ECO-10): the share of a podium prize (percent) this contract lets
   * him keep, set by the talk (`contract.negotiationAnswerFor`). Optional and
   * additive: a deal signed before rc.33 has none and reads the rc.32 rule
   * (`contract.contractSharePctFor`), so no save is migrated.
   */
  prizeSharePct?: number;
  /** Last seasonIndex (inclusive) the contract covers. */
  contractEndSeason: number;
  trainingFocus: TrainingFocus;
  /** v0.2 training: session load (heavier = faster development, fatigue risk). */
  trainingIntensity: TrainingIntensity;
  scoutLevel: ScoutLevel;
  /** Splits spent on the squad — chemistry accrual credit (subs accrue 0.5/split). */
  splitsTogether: number;
  joinedSeason: number;
  /** Set one season ahead when the retirement roll hits a user player. */
  finalSeasonAnnounced?: boolean;
  /**
   * rc.32: the user refused a Blockbuster bid for him while this deal ran —
   * its `contractEndSeason`. The renewal of THAT deal asks
   * CAREER_SALARY.blockbusterRefusalRenewalMult more (`market.renewalAskFor`);
   * a renewed deal ends later, so the surcharge applies once.
   */
  blockbusterRefusedUntil?: number;
  /** Training-cap accumulators (CAREER_TRAINING.maxSplitGain/maxSeasonGain). */
  gainedThisSplit: number;
  gainedThisSeason: number;
}

// ---------------------------------------------------------------------------
// World (AI orgs + market) — stored as deltas over the dataset
// ---------------------------------------------------------------------------

export interface WorldOrgState {
  /** Dataset orgId or "fill:{region}:{n}". */
  ref: string;
  name: string;
  region: Region;
  /** 0-3, from historicalStrength/buffLevel — drives AI wallets + starters guard. */
  prestige: 0 | 1 | 2 | 3;
  playerIds: [string, string, string];
  /** Effective coach quality for team assembly (dataset coach or generated). */
  coachOverall?: number;
  /** Cosmetic star rating 0-5 in half-star steps (world-percentile based). */
  stars: number;
  /** Intrinsic team-rating snapshot from the last computeStars pass. */
  rating?: number;
}

export interface WorldState {
  /** Every active AI org this season, keyed by ref (~16 per region). */
  orgs: Record<string, WorldOrgState>;
  /** Sparse overall drift vs the derived baseline (AI training/aging). */
  overallDelta: Record<string, number>;
  /** Players currently signable (not on any AI org, not on the user squad). */
  freeAgentIds: string[];
  /** Player ids retired from the world. */
  retiredIds: string[];
  /** Bumped on any roster/overall change — invalidates team-assembly caches. */
  version: number;
  /**
   * rc.29 (CAR-01): the gamertag each rookie got at his intake (id → name),
   * chosen so nobody in his region already holds it. Optional and additive:
   * rookies generated before rc.29 have no entry and keep their derived name.
   * rc.30: also the stored name of a filler the one-time legacy repair
   * renamed or kept (`repairLegacyWorld`) — read before the bank's.
   */
  rookieNames?: Record<string, string>;
  /**
   * rc.29 (CAR-01): which filler/rookie name bank the world reads — 2 =
   * PLAYER_NAME_BANK with PLAYER_NAME_BANK_SWAPS (the real nicknames swapped
   * out), set at creation; absent = the original bank (older careers).
   */
  nameBankVersion?: number;
  /**
   * rc.32 (DEV-01, R55): the development model this career runs on, set once
   * at creation from CAREER_DEV.growthModel — 2 = the growth contract
   * (individual peaks, potential as the expected peak, nested scouting
   * bands, weekly world growth); absent = rc.31's model (older careers keep
   * it for life, so nothing they scouted or built moves).
   */
  growthModel?: number;
  /**
   * rc.32 (integration review): the user's former FOUNDERS, kept as they
   * left the squad (a sale, a release, an expired deal). Their
   * "fic:{region}:starterN" ids come from no world generator, so without
   * this a sold founder vanished and his buyer fielded a stand-in (since
   * rc.31's AI bids; rc.32's restructurings and listings made it common).
   * Optional and additive: absent = none.
   */
  formerSquad?: Record<string, FormerSquadPlayer>;
}

/** A former founder as he left the user's squad (WorldState.formerSquad). */
export type FormerSquadPlayer = Pick<
  SquadPlayer,
  "name" | "country" | "region" | "birthYear" | "archetype" | "overall" | "attrOffsets" | "potential" | "peakAge" | "declineRate"
>;

// ---------------------------------------------------------------------------
// Calendar & competition
// ---------------------------------------------------------------------------

export type WeekKind =
  | "preseason" // W1-2 (window open)
  | "open" // free week: training / unofficial offers
  | "regional"
  | "major"
  | "window" // mid-season windows W11-12, W21-22
  | "worldsWindow" // W31 (1-week window before Worlds)
  | "worlds"; // W32

export interface CalendarWeek {
  week: number; // 1..32
  kind: WeekKind;
  split?: 1 | 2 | 3;
  /** Regional ordinal within the split (1..3). */
  ordinal?: 1 | 2 | 3;
  windowOpen: boolean;
}

/**
 * v0.2 day clock: the playable unit is the DAY (1..weeksPerSeason×7,
 * Monday-start weeks). The 32-week grid remains the scheduling skeleton —
 * `week = weekOfDay(day)` everywhere the schedule/seed grammar needs it.
 */
export interface CareerClock {
  /** 0-based index into CAREER_SEASONS (0 = RLCS Season X). ≥6 = infinite era. */
  seasonIndex: number;
  /** 1..224 (weeksPerSeason × daysPerWeek). Day 1 is always a Monday. */
  day: number;
}

export type EventTier = "t3" | "t2" | "qualifier" | "regional" | "major" | "worlds";

export interface CareerEventDef {
  /** Also the seed stream id suffix, e.g. "0:1:reg2:EU" — stable forever. */
  id: string;
  tier: EventTier;
  /** Undefined = cross-region (major/worlds). */
  region?: Region;
  seasonIndex: number;
  week: number;
  /**
   * The day the event STARTS (its lobby opens) on the day clock. v2.0 (R40):
   * Saturday for the unofficial cups, the qualifier and the Major/Worlds
   * (Swiss stage); Sunday for the regional. A Major/Worlds continues on
   * `playoffsDayFor(def)` (Sunday, "Championship Sunday") — derived, never
   * stored.
   */
  day: number;
  split?: 1 | 2 | 3;
  ordinal?: 1 | 2 | 3;
  /** Display name (official events from copy; unofficials generated). */
  name: string;
  /**
   * Tournament shape: "swiss" = 16-team Swiss → 8-team double elimination;
   * "swissOnly" = v2.0 (R40) 16-team Swiss that ENDS with the Swiss (the
   * regional qualifier: the 8 that reach 3 wins qualify — no playoffs, no
   * champion); "single" = 8-team single elimination (unofficial cups).
   */
  format: CareerEventFormat;
}

/** v2.0 (R40): the tournament shapes a career event can take. */
export type CareerEventFormat = "swiss" | "swissOnly" | "single";

/** One team's line in a compiled event result (compact — brackets are discarded). */
export interface CompactPlacementRow {
  /** Org ref ("user" for the player org). */
  ref: string;
  name: string;
  placement: Placement;
  points: number;
  prize: number;
}

export interface CompactEventResult {
  eventId: string;
  tier: EventTier;
  region?: Region;
  seasonIndex: number;
  week: number;
  split?: 1 | 2 | 3;
  name: string;
  rows: CompactPlacementRow[];
  /**
   * The playoffs champion. v2.0 (R40): a Swiss-only event (tier "qualifier")
   * has NO champion — this holds its TOP SWISS SEED (rows[0]) so the field
   * stays a plain string; never label it a champion (see `hasChampion`).
   */
  championRef: string;
  userPlacement?: Placement;
  /** Field quality multiplier used for match-XP (persisted for the recap). */
  fieldQuality: number;
}

export interface CompetitionState {
  /** Points per org-ref per region, current split (reset each split). */
  splitPoints: Record<Region, Record<string, number>>;
  /** Season Points per org-ref per region (the Worlds race). */
  seasonPoints: Record<Region, Record<string, number>>;
  /** Announced Major field (org refs) for the current split, once R3 concluded. */
  majorFieldRefs: string[] | null;
  /** Announced Worlds field (org refs), once Split 3's Major concluded. */
  worldsFieldRefs: string[] | null;
  /** Roster Stability: fielded new-face player ids this split. */
  newFacesThisSplit: string[];
  /** Squad player ids at split start (baseline for "new face"). */
  squadAtSplitStart: string[];
  /** Worst stability tier already applied this split (0 | 25 | 60 %). */
  stabilityTierApplied: 0 | 25 | 60;
  /**
   * v2.0 (R30): per region, the latest qualifier's 8 qualified refs (R40:
   * Saturday's Swiss-only qualifier — the teams that reached 3 wins, in seed
   * order) and the regional event id they qualified for (absent on pre-2.0
   * saves).
   */
  qualifiedRefs?: Partial<Record<Region, { eventId: string; refs: string[] } | null>>;
  /**
   * rc.30 (direct-8): the user's region seeding for a regional week, decided
   * ONCE on its Monday with the team rating HQ shows — the direct top 8 and
   * everyone else ("user" included). Saturday's qualifier, Sunday's regional,
   * the lobby, the agenda and the calendar all read it for that week, so a
   * signing or the Mon–Fri training can never move the user across the line
   * mid-week. Absent on older saves and before the first regional Monday.
   */
  weekSeeding?: WeekSeeding | null;
  /**
   * RTW-01 (R49): the local scene's strength anchor in the user's region for
   * this season — the user's team rating (`userSeedRatingFor`) frozen on the
   * season's first regional Monday, so a local side has ONE rating wherever
   * it plays (qualifier, regional, Major, Worlds, cups). Other regions anchor
   * on the median of their stored org ratings (the season's snapshot) and need
   * no field. Optional and season-scoped (the competition resets at the
   * rollover): absent before the first regional Monday and on saves from
   * before rc.31 until their next Monday.
   */
  localAnchor?: LocalSceneAnchor | null;
}

/** RTW-01 (R49): the user's region and the team rating its local scene is rated around this season. */
export interface LocalSceneAnchor {
  region: Region;
  rating: number;
}

/** rc.30 (direct-8): one region's regional seeding, committed on the week's Monday. */
export interface WeekSeeding {
  seasonIndex: number;
  week: number;
  region: Region;
  direct: string[];
  rest: string[];
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

export type LedgerKind =
  | "prize"
  | "sponsorBase"
  | "sponsorBonus"
  | "sponsorSigning"
  | "salary"
  | "coachSalary"
  | "severance"
  | "transferIn" // fee received
  | "transferOut" // fee paid
  | "signingBonus"
  | "releaseFee"
  | "standInFee"
  | "facility"
  | "upkeep"
  | "buff"
  | "loanGrant"
  | "loanGarnish"
  | "loanPayment" // v0.3: manual Backer pay-down
  | "foundingPartner" // rc.32 (M3, provisional): the founding partner's weekly base
  | "rescuePartner" // rc.33 (ECO-07): the rescue partner's weekly help
  | "playerShare" // rc.32 (M6, provisional): the players' share of a podium prize
  | "fanbase"
  | "payroll" // v2.0: the squad aggregated weekly wages (one line per Monday)
  | "bankLoan" // v2.0: bank loan principal received
  | "bankPayment" // v2.0: weekly instalment / early pay-down
  | "insert"; // v2.0 (R33): a mid-week decision's money effect

export interface LedgerEntry {
  id: string;
  seasonIndex: number;
  week: number;
  /** Day stamp (v0.2 day clock); older entries may lack it. */
  day?: number;
  kind: LedgerKind;
  /** Signed, quantized to CAREER_ECONOMY.roundQuantum. */
  amount: number;
  /** Free-form context (player/sponsor/event name) rendered after the kind label. */
  refName?: string;
}

/**
 * v0.2 gear & staff ladder — the org's owned installations. Items unlock by
 * reputation (CAREER_GEAR) and are bought strictly in ladder order; effects
 * map onto existing engine channels (training multiplier + org buff levels).
 */
export interface GearState {
  peripherals: boolean;
  monitors: boolean;
  pcs: boolean;
  perfCenter: boolean;
  /** Sports psychologist retainer (rolling, paid per split). */
  psychologist: boolean;
}

/**
 * v2.0 bank loan (R21): the player-initiated line of credit. `remaining`
 * includes the flat interest; `weeklyPayment` is booked every Monday until
 * it clears (the last instalment is clamped to the remainder).
 */
export interface BankLoanState {
  principal: number;
  remaining: number;
  weeklyPayment: number;
  takenSeason: number;
  takenWeek: number;
}

export interface FinanceState {
  balance: number;
  /** Ring-buffer tail (CAREER_SAVE.ledgerTailCap). */
  ledger: LedgerEntry[];
  loan: { remaining: number } | null;
  /** One rescue per career — a second breach after this is set ends the career. */
  loanUsed: boolean;
  /**
   * rc.32 (M4): Mondays the books closed below the Backer's floor so far
   * (the first rescue was the first). Absent on older saves: read as 1 when
   * `loanUsed`, else 0 (`economy.loanBreachesOf`). rc.33 (ECO-08): the count
   * CAREER_LOAN.breachesToEnd ends the career at.
   */
  loanBreaches?: number;
  /** rc.33 (ECO-07): the rescue partner's help while it runs (absent / null = none). */
  rescuePartner?: RescuePartnerState | null;
  /**
   * rc.33 (UX-07): the Monday balances, oldest first, a ring of
   * CAREER_PAYROLL.balanceRingWeeks (economy.recordMondayBalance). Absent on
   * a save from before rc.33 until its load repair seeds it from the ledger.
   */
  balanceRing?: MondayBalance[];
  /** v2.0 bank loan (absent on pre-2.0 saves = none). */
  bankLoan?: BankLoanState | null;
  gear: GearState;
  /** Bootcamp "Sharp" rating armed for the next official event (0 = none). */
  bootcampSharp: number;
  bootcampUsedThisSplit: boolean;
  /** Sponsor-perk free bootcamps consumed this season. */
  freeBootcampsUsedThisSeason: number;
}

/**
 * rc.33 (ECO-07): the rescue partner — "a partner's help" that comes with
 * the Backer's loan at the breach CAREER_LOAN.rescuePartner.atBreach names
 * (Easy's first). The Monday funnel pays `weekly` while `mondaysLeft` > 0,
 * counting it down, then clears it.
 */
export interface RescuePartnerState {
  /** Weekly income, fixed at the rescue: payrollShare × that Monday's wage bill. */
  weekly: number;
  /** Mondays still to pay (CAREER_LOAN.rescuePartner.weeks at the rescue). */
  mondaysLeft: number;
}

/**
 * rc.33 (UX-07): one Monday's closing books in the Finances chart's ring.
 * Short keys: the ring holds up to CAREER_PAYROLL.balanceRingWeeks of them.
 */
export interface MondayBalance {
  /** Season index of the Monday. */
  s: number;
  /** Week of the Monday (1–32). */
  w: number;
  /** The balance after that Monday's payroll (the Backer's rescue included). */
  b: number;
  /** The Backer's floor that Monday; absent on Mondays seeded from an older save's ledger. */
  f?: number;
}

export type SponsorObjectiveKind =
  | "enterEvents" // enter ≥2 events this split (officials count)
  | "regionalTop8"
  | "majorQualify"
  | "majorTop4";

export interface SponsorState {
  sponsorId: string;
  tier: 1 | 2 | 3 | 4;
  basePerSplit: number;
  bonus: number;
  objectiveKind: SponsorObjectiveKind;
  /** Progress toward the objective within the current split. */
  progress: number;
  hitThisSplit: boolean;
  missedCount: number;
}

export interface CoachState {
  id: string;
  name: string;
  overall: number;
  bonusType: StatKey;
  bonusLevel: string;
  salaryPerSplit: number;
  /** "real" = a retired real pro turned coach (v0.2 coach market). */
  source: "dataset" | "generated" | "real";
  /**
   * rc.34 (DEV-03 T4): seasons of coaching experience (0–10+). Optional and
   * additive: a coach hired before rc.34 reads `training.coachProfileOf`'s
   * default (an ex-pro 3, a generic derived from his id).
   */
  experience?: number;
  /** rc.34 (T4): the objective he is best at (+CAREER_PLAN.coach.specialtyBoost on its main effect). */
  specialty?: TrainingObjective;
  /** rc.34 (T4): the quality he can grow to (a personal ceiling, never above CAREER_COACH_MARKET.growth.ceilingMax). */
  ceiling?: number;
  /** rc.34 (T4): an ex-pro's career-best card (his quality's source, printed on the card). */
  bestCard?: number;
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export interface OfferFactor {
  /** Copy key suffix (career.market.factor.*). */
  key: string;
  delta: number;
}

export interface TransferOffer {
  id: string;
  /** "in" = user signs a player · "out" = AI org bids for a user player. */
  direction: "in" | "out";
  playerId: string;
  playerName: string;
  fee: number;
  salaryPerSplit: number;
  lengthSeasons: 1 | 2 | 3;
  role: "starter" | "sub";
  /** AI org making an out-bid, or the org being bought from. */
  otherRef?: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  /** Expires when the Advance passes this clock (end of the window). */
  resolveSeason: number;
  resolveDay: number;
  factors: OfferFactor[];
  /** True when this offer came from a degraded scripted beat (Blockbuster). */
  blockbuster?: boolean;
  /**
   * @deprecated rc.32 (M8): the offer answered the user's "List for sale" —
   * withdrawn in rc.33 (ECO-12). Never written; the load repair
   * (careerFlow.repairMoneyOnLoad) strips it, so the offer stays a plain bid.
   */
  listing?: boolean;
}

/** @deprecated rc.32 (M8): a squad player the user listed for sale — withdrawn in rc.33 (ECO-12). */
export interface SaleListing {
  playerId: string;
  seasonIndex: number;
  day: number;
  /** Eligible window days left before the offer arrives (counts down; 0 = offer made). */
  waitDays: number;
}

/**
 * @deprecated rc.32 (M8): a seat sold in a window could be refilled with a
 * free agent until `untilDay` — withdrawn in rc.33 (ECO-12).
 */
export interface LateSigningState {
  seasonIndex: number;
  windowIdx: number;
  untilDay: number;
  used: boolean;
  /**
   * rc.32 (integration review): the squad size the window's sale left. The
   * late signing refills THAT seat: once the squad is back above it (a
   * signing inside the window) there is no sold seat left to refill.
   */
  squadAfterSale?: number;
}

/**
 * rc.32 (M3, provisional): the founding partner — a tier-0 deal sized on the
 * founding wage bill (CAREER_SPONSOR.founding). Paid every Monday while it
 * has no `endedSeason`.
 */
export interface FoundingPartnerState {
  /** The wage bill per split it is sized on (squad + coach) … */
  wageBillPerSplit: number;
  /** … priced in this season's money (0 at creation; the load season for an older save). */
  sizedSeason: number;
  /** Set when it ends: the first real deal, never before throughSeasonIndex is over. */
  endedSeason?: number;
}

// ---------------------------------------------------------------------------
// Scrims v2 + the transfer wire (v0.3)
// ---------------------------------------------------------------------------

/** A scrim booked ahead from the Training screen (runs on its day arrival). */
export interface ScheduledScrim {
  day: number;
  oppRef: string;
}

/** Compact scrim result (ring buffer CAREER_SAVE.scrimLogCap). */
export interface ScrimLogEntry {
  id: string;
  seasonIndex: number;
  day: number;
  oppRef: string;
  oppName: string;
  won: boolean;
  scoreA: number;
  scoreB: number;
  /** Per-game scores, user first (e.g. ["3-1", "2-4", "5-2", "1-0"]). */
  games: string[];
  /** rc.34 (DEV-03 T3): a package scrim's level (absent = a booked or run-now scrim). */
  level?: ScrimLevel;
}

/**
 * One line of the transfer wire (ring buffer CAREER_SAVE.transferLogCap):
 * every AI move, user signing/sale and scripted-beat transfer, feeding the
 * HQ window panel + the window-close report.
 */
export interface TransferLogEntry {
  id: string;
  seasonIndex: number;
  day: number;
  playerId: string;
  playerName: string;
  /** Org refs ("user" included); null = free agency on that side. */
  fromRef: string | null;
  toRef: string | null;
  fee: number;
  kind: "fee" | "fa" | "userIn" | "userOut" | "beat";
  region: Region;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export type NewsType =
  | "result"
  | "transfer"
  | "beat"
  | "org" // user-org notices: contracts, sponsors, stability, unlocks
  | "training"
  | "milestone"
  | "window"
  | "rep"
  | "flavor";

export interface NewsItem {
  id: string;
  seasonIndex: number;
  week: number;
  /** Day stamp (v0.2 day clock); older items may lack it. */
  day?: number;
  type: NewsType;
  /** 3 = scripted beat · 2 = user-relevant · 1 = world · 0 = flavor. */
  priority: 0 | 1 | 2 | 3;
  /**
   * copy key under career.news.tpl (params interpolated by the UI). Body text
   * resolves from career.news.body[titleKey] when present — same params.
   */
  titleKey: string;
  params?: Record<string, string | number>;
  bodyKey?: string;
  /** Scripted beats resolve their EN/PT text from the beats data by this id. */
  beatId?: string;
  read: boolean;
}

/**
 * v0.2 Inbox: MAIL is the actionable, addressed-to-the-manager channel
 * (transfer bids, sponsor offers/settlements, contracts, finances, unlocks).
 * The news feed stays the world's wire; mail is what lands on YOUR desk.
 */
export type MailKind = "offer" | "sponsor" | "contract" | "finance" | "unlock" | "club";

export interface MailItem {
  id: string;
  seasonIndex: number;
  day: number;
  kind: MailKind;
  /** copy keys under career.mail.* (params interpolated by the UI). */
  titleKey: string;
  bodyKey?: string;
  params?: Record<string, string | number>;
  /** Sender display key under career.mail.from.* (e.g. "board", "agent"). */
  fromKey: string;
  read: boolean;
  /** Deep link into the app (route suffix under /career). */
  linkTo?: string;
}

// ---------------------------------------------------------------------------
// Events in progress + season archive + endgame
// ---------------------------------------------------------------------------

export interface ActiveEventState {
  def: CareerEventDef;
  /** Mid-stream RNG cursor (the runStore resume trick) — the ONLY persisted cursor. */
  rngState: number;
  tournament: TournamentState;
  /** Field-quality multiplier for match XP, computed at init. */
  fieldQuality: number;
  /** True when the user chose watch-mode (playback) rather than instant sim. */
  watched: boolean;
  /**
   * v2.0 (R40 review): the squad ids fielded when the event started — the
   * team is frozen for the whole event (Saturday and Sunday of a two-day
   * one), so finishEvent credits match XP / roster stability to the players
   * who actually played. Absent on older saves (finishEvent then reads the
   * current lineup, as before).
   */
  fieldedIds?: string[];
}

export interface StandingRowSnapshot {
  ref: string;
  name: string;
  points: number;
}

export interface SeasonRecord {
  seasonIndex: number;
  /** Dataset season id (or "career-<year>" in the infinite era). */
  seasonId: string;
  label: string;
  worldsChampionRef: string | null;
  worldsChampionName: string | null;
  userWorldsPlacement: Placement | null;
  userSeasonPoints: number;
  userRegionRank: number;
  /** Top rows + user row of the final regional season standings. */
  regionTable: StandingRowSnapshot[];
  earnings: number;
  balanceEnd: number;
  repEnd: number;
  grade: "S" | "A" | "B" | "C" | "D";
  majorsQualified: number;
  titles: number;
}

export type CareerEndReason =
  | "worlds_won"
  | "timeline_complete"
  | "insolvency"
  | "retired";

export type LegacyGrade = "legend" | "contender" | "challenger" | "journeyman";

export interface CareerEndState {
  ended: boolean;
  reason?: CareerEndReason;
  endedSeasonIndex?: number;
  legacyGrade?: LegacyGrade;
  /** Continuing past the ending (post-title defense or the infinite era). */
  infinite: boolean;
  /** Set once the first Worlds title fired the full credits (later wins go lighter). */
  creditsShown?: boolean;
}

export interface SeasonGoals {
  /** copy keys under career.goals.* */
  targetKey: string;
  stretchKey: string;
  /** Rep at stake if the target is missed (0 = none). */
  repRisk: number;
  targetMet: boolean | null;
}

export interface CareerLifetimeStats {
  seriesWins: number;
  seriesLosses: number;
  gameWins: number;
  gameLosses: number;
  goalsFor: number;
  goalsAgainst: number;
  titlesT3: number;
  titlesT2: number;
  titlesRegional: number;
  titlesMajor: number;
  titlesWorlds: number;
  majorsQualified: number;
  worldsQualified: number;
  totalPrize: number;
  biggestSigningFee: number;
  biggestWinName: string | null;
}

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

export interface CareerSave {
  saveVersion: number;
  createdAtAppVersion: string;
  careerSeed: number;
  /**
   * OBS-01 (#145): a random anonymous id the STORE stamps at creation, sent as
   * the analytics `careerId`. Never read by the engine; older saves derive one.
   */
  careerId?: string;
  identity: CareerIdentity;
  difficulty: CareerDifficulty;
  prefs: CareerPrefs;
  /** One-shot UI flags (onboarding explainers, first-worlds framing, ...). */
  flags: Record<string, boolean>;
  clock: CareerClock;
  /** UI flow gate: running weeks · season-review ceremony · career over. */
  phase: "running" | "seasonReview" | "ended";

  squad: SquadPlayer[];
  starterIds: [string, string, string];
  /** v2.0 (R32): the roster the org was founded with ("homegrown" Worlds). */
  foundingSquadIds?: string[];
  coach: CoachState | null;

  finances: FinanceState;
  sponsor: SponsorState | null;
  /** Sponsor offers pending a decision (season start). */
  sponsorOffers: SponsorState[] | null;
  reputation: number;

  competition: CompetitionState;
  world: WorldState;

  activeEvent: ActiveEventState | null;
  /** This week's committed user event (lobby opens on its matchday). */
  pendingEventDef: CareerEventDef | null;
  /** This week's optional unofficial invite (open weeks only). */
  unofficialOffer: CareerEventDef | null;
  /** t3 Community Cup entries used this split (CAREER_UNOFFICIAL cap). */
  t3EntriesThisSplit: number;
  /** Scrims run this week (CAREER_SCRIM.maxPerWeek; resets each Monday). */
  scrimsThisWeek: number;
  /**
   * v2.0 (R27): this week's team drill (null/stale week = none chosen).
   * @deprecated rc.34 (DEV-03): the weekly drill retired into the package's
   * squad focus — never written; an older save's drill expires with its week.
   */
  drill?: WeeklyDrill | null;
  /**
   * rc.34 (DEV-03): training packages per period — the mode, the running
   * period, a waiting proposal and the history. Optional and additive: the
   * load repair (careerTraining.repairTrainingOnLoad) gives an older save
   * one on DEV-01's base.
   */
  training?: TrainingState;
  /** v2.0 (R33): the mid-week insert waiting for a decision (expires with its day). */
  pendingInsert?: { id: string; day: number } | null;
  /** v2.0 (R33): insert ids surfaced so far (recency window). */
  insertsSeen?: string[];
  /** v0.3: scrims booked ahead (auto-run on day arrival, future days only). */
  scheduledScrims: ScheduledScrim[];
  /** v0.3: recent scrim results (ring buffer). */
  scrimLog: ScrimLogEntry[];
  /** v0.3: the transfer wire (AI + user + beat moves, ring buffer). */
  transferLog: TransferLogEntry[];
  /**
   * v0.3 negotiation bookkeeping: rejected-counter counts keyed
   * "{playerId}:{seasonIndex}:{windowKey}" (pruned at each window close).
   * rc.33 (ECO-11): no longer written — the contract talk stores nothing
   * (`contract.negotiationAnswerFor`); kept so older saves load unchanged.
   */
  negotiationTries: Record<string, number>;
  /**
   * rc.33 (DEV-04): the scouting band this career reads — 2 = DEV-04's honest
   * band, stamped at creation. Absent = a career created before rc.33: on
   * growth model 2 a bought or earned report (level ≥ 1) also stays inside
   * the band rc.32 showed at that level, so a report it already holds only
   * narrows (`development.scoutedBand`'s `rc32Reports`). Optional, additive.
   */
  bandModel?: number;
  /** v0.3: bookkeeping for the per-window incoming-bid cap/cooldown. */
  bidsThisWindow: number;
  lastBidDay: number;
  pendingOffers: TransferOffer[];
  /**
   * rc.32 (M3): the founding partner; null = none; absent = not decided yet
   * (older save). rc.33 (ECO-07): never granted any more (null); a deal an
   * rc.32 career holds runs to its own end (CAREER_SPONSOR.founding.honourRunning).
   */
  foundingPartner?: FoundingPartnerState | null;
  /** @deprecated rc.32 (M8) — withdrawn in rc.33 (ECO-12): never written; the load repair (careerFlow.repairMoneyOnLoad) deletes it. */
  saleListings?: SaleListing[];
  /** @deprecated rc.32 (M8) — withdrawn in rc.33 (ECO-12): never written; the load repair (careerFlow.repairMoneyOnLoad) deletes it. */
  lateSigning?: LateSigningState | null;
  /** A starter is unavailable for this event (random event, sub steps in). */
  pendingUnavailability: { playerId: string; eventId: string } | null;

  news: NewsItem[];
  /** v0.2 Inbox — actionable mail addressed to the manager (ring buffer). */
  mail: MailItem[];
  firedBeatIds: string[];
  /** Paid scout-report levels for NON-squad players (playerId → ScoutLevel). */
  scouted: Record<string, number>;
  /** This season's compiled events (archived into history at rollover). */
  eventResults: CompactEventResult[];

  history: SeasonRecord[];
  seasonGoals: SeasonGoals | null;
  end: CareerEndState;
  stats: CareerLifetimeStats;

  /** Monotonic id counter for news/mail items (deterministic ids). */
  seq: number;

  /** Stamped by the STORE on each persist (engine never reads the clock). */
  lastPlayedAt: number;
}

/** Slot metadata rendered by the saves picker without hydrating full saves. */
export interface CareerSlotMeta {
  slot: number;
  orgName: string;
  abbrev: string;
  crestId: string;
  colors: CareerColors;
  managerName: string;
  region: Region;
  difficulty: CareerDifficulty;
  seasonLabel: string;
  week: number;
  /** Day-clock position (v0.2). */
  day: number;
  balance: number;
  reputation: number;
  stars: number;
  champion: boolean;
  ended: boolean;
  lastPlayedAt: number;
}
