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
}

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
  /** v2.0 bank loan (absent on pre-2.0 saves = none). */
  bankLoan?: BankLoanState | null;
  gear: GearState;
  /** Bootcamp "Sharp" rating armed for the next official event (0 = none). */
  bootcampSharp: number;
  bootcampUsedThisSplit: boolean;
  /** Sponsor-perk free bootcamps consumed this season. */
  freeBootcampsUsedThisSeason: number;
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
  /** v2.0 (R27): this week's team drill (null/stale week = none chosen). */
  drill?: WeeklyDrill | null;
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
   */
  negotiationTries: Record<string, number>;
  /** v0.3: bookkeeping for the per-window incoming-bid cap/cooldown. */
  bidsThisWindow: number;
  lastBidDay: number;
  pendingOffers: TransferOffer[];
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
