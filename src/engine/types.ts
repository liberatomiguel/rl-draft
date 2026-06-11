/**
 * Core domain types for Rocket Draft.
 *
 * This file is the single source of truth for every entity in the game.
 * It is split in three sections:
 *   1. Data entities  — mirror the JSON files in /src/data
 *   2. Run state      — everything that describes one game (draft → tournament → results)
 *   3. Derived values — ratings, chemistry, results
 *
 * The engine (src/engine) only depends on these types + balance config.
 * No React / UI types are allowed here.
 */

// ---------------------------------------------------------------------------
// 1. Data entities
// ---------------------------------------------------------------------------

export type Region = "NA" | "EU" | "SAM" | "MENA" | "OCE" | "APAC";

export type Difficulty = "easy" | "normal" | "hard" | "legacy";

/** Visual rarity of a base card, derived from overall (see balance.rarity). */
export type BaseRarity = "silver" | "gold" | "blue";

export type SpecialRarity = "rare" | "epic" | "mythic" | "legendary";

export type SpecialCardType =
  | "moment"
  | "major_mvp"
  | "worlds_mvp"
  | "mythic"
  | "legend";

/** Org / coach buff notation used across the game. `~` means neutral. */
export type BuffLevel = "~" | "+" | "++" | "+++";

export type StatKey =
  | "offense"
  | "defense"
  | "mechanics"
  | "consistency"
  | "experience"
  | "clutch";

export type Stats = Record<StatKey, number>;

export type HistoricalStrength = "elite" | "strong" | "solid" | "underdog";

/** A real person. Identity only — strength lives on cards. */
export interface Player {
  id: string;
  nickname: string;
  realName?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "BR", "FR", "US". */
  country: string;
  region: Region;
}

export interface Season {
  id: string;
  /** Display label, e.g. "RLCS Season 6". */
  label: string;
  /** Short label for tight card layouts, e.g. "S6 ’18". */
  shortLabel: string;
  year: string;
}

/**
 * A version of a player in a specific lineup/season.
 * The same person can have many cards with different overalls.
 */
export interface PlayerCard {
  id: string;
  playerId: string;
  orgId: string;
  lineupId: string;
  seasonId: string;
  /** Calculated base overall (before manual adjustment). */
  overall: number;
  /** Curator adjustment, normally -3..+3 (exceptional -5..+5). Stored separately. */
  manualAdjustment: number;
  /** Optional internal stats. Missing keys fall back to overall in the engine. */
  stats?: Partial<Stats>;
  imageUrl?: string;
}

export interface Org {
  id: string;
  name: string;
  region: Region;
  buffType: StatKey;
  buffLevel: BuffLevel;
  logoUrl?: string;
}

export interface CoachCard {
  id: string;
  /** Person identity for "cannot draft twice" rule. Generic staff use the card id. */
  personId: string;
  name: string;
  country?: string;
  region?: Region;
  orgId: string;
  lineupId: string;
  seasonId: string;
  overall: number;
  bonusType: StatKey;
  bonusLevel: BuffLevel;
  /** True for anonymous "Coaching Staff" placeholder cards. */
  generic?: boolean;
}

export interface SubCard {
  id: string;
  personId: string;
  name: string;
  country: string;
  region: Region;
  orgId: string;
  lineupId: string;
  seasonId: string;
  overall: number;
  stats?: Partial<Stats>;
}

/** A historical roster used both as draft offer and as tournament opponent. */
export interface Lineup {
  id: string;
  /** Display name, e.g. "Gale Force Esports". Usually the org name. */
  name: string;
  seasonId: string;
  orgId: string;
  region: Region;
  playerCardIds: [string, string, string];
  coachId?: string;
  subId?: string;
  historicalStrength: HistoricalStrength;
}

export type SpecialEffectType =
  | "clutch_boost" // bonus in the deciding game of a series
  | "swiss_consistency" // flat bonus during Swiss stage games
  | "playoff_experience" // flat bonus during playoff games
  | "upset_boost" // bonus when facing a higher-rated opponent
  | "defense_stability" // dampens this team's negative variance
  | "high_roll"; // boosts mechanics proc bonus

export interface SpecialEffect {
  type: SpecialEffectType;
  value: number;
  /** Human readable, shown in collection/team review. */
  description: string;
}

export interface SpecialCard {
  id: string;
  playerId: string;
  /** The base card this special version replaces when it appears in a draft. */
  baseCardId: string;
  title: string;
  cardType: SpecialCardType;
  rarity: SpecialRarity;
  overall: number;
  stats?: Partial<Stats>;
  effect: SpecialEffect;
  /** Short historical context shown in the collection. */
  flavor: string;
  imageUrl?: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xp: number;
}

// ---------------------------------------------------------------------------
// 2. Run state (one game from setup to results)
// ---------------------------------------------------------------------------

export type RunPhase = "draft" | "review" | "tournament" | "results";

export type RosterSlotId =
  | "player1"
  | "player2"
  | "player3"
  | "coach"
  | "sub"
  | "org";

export type CardKind = "player" | "coach" | "sub" | "org";

/** One card inside a draft offer, with availability resolved. */
export interface DraftOfferCard {
  kind: CardKind;
  /** PlayerCard.id | CoachCard.id | SubCard.id | Org.id */
  refId: string;
  /** Set when this player card appears as its special version. */
  specialId?: string;
  availability: "available" | "as_sub" | "slot_full" | "already_drafted";
}

export interface DraftOffer {
  lineupId: string;
  cards: DraftOfferCard[];
  /** False when nothing in the offer can be picked → free skip allowed. */
  hasPickableCard: boolean;
}

export interface RosterPick {
  slot: RosterSlotId;
  kind: CardKind;
  refId: string;
  specialId?: string;
  /** True when a player card occupies the sub slot. */
  asSub?: boolean;
  fromLineupId: string;
}

export type Roster = Partial<Record<RosterSlotId, RosterPick>>;

export interface DraftState {
  round: number;
  rerollsLeft: number;
  /** Lineups already shown this run (drawn without replacement). */
  shownLineupIds: string[];
  /** Person ids that can no longer be drafted (players, coaches, subs). */
  takenPersonIds: string[];
  offer: DraftOffer | null;
  roster: Roster;
  complete: boolean;
}

// --- Tournament ---

export interface TeamRatingBreakdown {
  avgPlayerOverall: number;
  coachMod: number;
  subMod: number;
  orgMod: number;
  chemMod: number;
  specialMod: number;
  /** Flat opponent shift from difficulty (0 for the user team). */
  difficultyShift: number;
  total: number;
}

export interface ChemistryBreakdownItem {
  label: string;
  points: number;
}

export interface ChemistryResult {
  raw: number;
  max: number;
  percent: number;
  tier: "Poor" | "Okay" | "Good" | "Great" | "Perfect";
  items: ChemistryBreakdownItem[];
}

/** A resolved tournament participant (the user team or an AI lineup). */
export interface TournamentTeam {
  id: string;
  name: string;
  isUser: boolean;
  region: Region;
  /** Source lineup for AI teams. */
  lineupId?: string;
  rating: TeamRatingBreakdown;
  chemistry: ChemistryResult;
  /** Average internal stats used for situational modifiers. */
  stats: Stats;
  /** Special cards active on this team (user picks or AI upgrades). */
  specialIds: string[];
  orgId: string;
}

export interface GameResult {
  index: number;
  winnerTeamId: string;
  /** Goals, winner first. Flavor only — series logic uses winners. */
  score: [number, number];
  overtime: boolean;
  deciding: boolean;
  /** Message keys resolved to text by the UI layer. */
  notes: string[];
}

export interface SeriesResult {
  teamAId: string;
  teamBId: string;
  games: GameResult[];
  /** Series score: [teamA wins, teamB wins]. */
  score: [number, number];
  winnerTeamId: string;
  /** Rating difference (teamA - teamB) at sim time. */
  ratingDiff: number;
  upset: boolean;
}

export interface SwissRound {
  round: number;
  series: SeriesResult[];
  /** Id of the user series in this round, if the user was still alive. */
  userSeriesIndex: number | null;
}

export interface SwissTeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  gameDiff: number;
  status: "active" | "advanced" | "eliminated";
}

export interface SwissState {
  rounds: SwissRound[];
  records: SwissTeamRecord[];
  /** Pre-computed pairings for the next round (UI shows the matchup early). */
  nextPairings: [string, string][] | null;
  finished: boolean;
}

export type PlayoffRoundName = "quarterfinal" | "semifinal" | "final";

export interface PlayoffRound {
  name: PlayoffRoundName;
  series: SeriesResult[];
}

export interface PlayoffState {
  /** Seeded team ids, best record first. */
  seeds: string[];
  rounds: PlayoffRound[];
  championTeamId: string | null;
  finished: boolean;
}

export type TournamentStage = "swiss" | "playoffs" | "finished";

export interface TournamentState {
  teams: Record<string, TournamentTeam>;
  swiss: SwissState;
  playoffs: PlayoffState | null;
  stage: TournamentStage;
  userEliminated: boolean;
}

// --- Results ---

export type Placement =
  | "champion"
  | "runner_up"
  | "semifinalist"
  | "quarterfinalist"
  | "swiss_exit";

export interface XpLine {
  label: string;
  amount: number;
}

export interface XpSummary {
  lines: XpLine[];
  /** e.g. 1.5 for Hard. Applied to run lines, not achievement lines. */
  difficultyMultiplier: number;
  hiddenOverallBonus: number;
  total: number;
}

export interface SeriesHighlight {
  opponentName: string;
  score: [number, number];
  stage: string;
}

export interface RunResults {
  placement: Placement;
  swissRecord: { wins: number; losses: number };
  playoffWins: number;
  championName: string | null;
  bestPlayerCardId: string | null;
  biggestWin: SeriesHighlight | null;
  closestSeries: SeriesHighlight | null;
  worstLoss: SeriesHighlight | null;
  unlockedSpecialIds: string[];
  newAchievementIds: string[];
  xp: XpSummary;
}

/** The whole state of one run. Persisted so a refresh resumes the game. */
export interface RunState {
  runId: string;
  seed: number;
  /** Mutable RNG cursor — persisted so reloads stay deterministic. */
  rngState: number;
  difficulty: Difficulty;
  /** Effective visibility (already accounts for Hard/Legacy lock). */
  showOverall: boolean;
  phase: RunPhase;
  startedAt: string;
  draft: DraftState;
  tournament: TournamentState | null;
  results: RunResults | null;
}

// ---------------------------------------------------------------------------
// 3. Profile / persistence
// ---------------------------------------------------------------------------

export interface RunHistoryEntry {
  runId: string;
  date: string;
  difficulty: Difficulty;
  hiddenOverall: boolean;
  placement: Placement;
  teamOverall: number;
  swissRecord: { wins: number; losses: number };
  rosterNames: string[];
  xpGained: number;
}
