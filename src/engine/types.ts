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

export type Region = "NA" | "EU" | "SAM" | "MENA" | "OCE" | "APAC" | "SSA";

export type Difficulty = "easy" | "normal" | "hard" | "legacy";

/**
 * Game modes. classic = full 6-slot draft + Swiss + double elim.
 * quick = players only + straight single-elim bracket.
 * daily = classic structure with a date-seeded modifier set.
 */
export type RunMode = "classic" | "quick" | "daily";

/**
 * Visual rarity of a base card, derived from overall (see balance.RARITY).
 * "common" = no rarity (low overalls, neutral orgs, placeholder cards).
 */
export type BaseRarity = "common" | "silver" | "gold" | "blue";

export type SpecialRarity = "rare" | "epic" | "mythic" | "legendary" | "creator";

export type SpecialCardType =
  | "moment"
  | "major_mvp"
  | "worlds_mvp"
  | "season_mvp"
  | "mythic"
  | "legend"
  | "coach";

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
  /**
   * ISO 3166-1 alpha-2 country code, e.g. "BR", "FR", "US".
   * Optional — the imported dataset doesn't carry nationality for everyone;
   * same-country chemistry only applies when both sides have one.
   */
  country?: string;
  region: Region;
}

export interface Season {
  id: string;
  /** Display label, e.g. "RLCS Season 6". */
  label: string;
  /** Short label for tight card layouts, e.g. "S6 ’18". */
  shortLabel: string;
  year: string;
  /** Chronological position (1 = RLCS S1) — drives era-logo resolution. */
  order: number;
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
  /**
   * Era logos (v0.5.1): seasons with order <= untilOrder use the asset
   * public/orgs/<orgId>@<key>.png — orgs rebrand (NRG classic vs modern)
   * and the card should wear the logo of ITS season. Default logo otherwise.
   */
  logoEras?: { key: string; untilOrder: number }[];
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
  country?: string;
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
  /**
   * Org buff strength AS OF this season (orgs grow/shrink era to era).
   * Falls back to the org entity's default level when absent.
   */
  orgBuffLevel?: BuffLevel;
  /**
   * Regional-only lineup (v1.2.0): a SAM Top-8 team that did NOT reach
   * Worlds/Finals. Excluded from the general draft/opponent/daily pools;
   * appears only in the region-locked mode. Absent/false = a Worlds finals team.
   */
  samOnly?: boolean;
  /**
   * Easter-egg lineup (v1.2.0): excluded from the normal draw AND the opponent
   * pool; instead force-injected into one draft offer at DRAFT.easterEggChance
   * (region-locked mode only). Used by the Wings creator team — when it appears,
   * the creator's card is guaranteed to show as the Creator special.
   */
  rareSpawn?: boolean;
  historicalStrength: HistoricalStrength;
}

export type SpecialEffectType =
  // v3 effect model: direct attribute boosts (simple, no conditions).
  | "attribute_boost" // + value to the card's listed attributes
  | "team_attribute_boost" // + value to the TEAM's listed attributes (coach)
  // Legacy situational types — still supported by the engine.
  | "clutch_boost"
  | "swiss_consistency"
  | "playoff_experience"
  | "upset_boost"
  | "defense_stability"
  | "high_roll";

export interface SpecialEffect {
  type: SpecialEffectType;
  /** Boosted attributes for the attribute_boost family. */
  attributes?: StatKey[];
  value: number;
  /** Human readable, shown in collection/team review. */
  description: string;
}

export interface SpecialCard {
  id: string;
  /** "player" (default) or "coach". */
  kind?: "player" | "coach";
  /** Person identity (player id, or coach person id for coach specials). */
  playerId: string;
  /** Base card replaced in draft offers: a player card or a coach card. */
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
  /** Rarity family in the achievements grid (v1.2.0): common · rare · epic · legend. */
  category: "common" | "rare" | "epic" | "legend";
  /** Hidden until earned (v1.2.0) — shown as a locked mystery in the grid. */
  secret?: boolean;
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
  /** "vacant" = the lineup has no coach/sub — shown but never pickable (v0.5). */
  availability: "available" | "slot_full" | "already_drafted" | "vacant";
}

export interface DraftOffer {
  lineupId: string;
  cards: DraftOfferCard[];
  /** False when nothing in the offer can be picked → a free reroll is granted. */
  hasPickableCard: boolean;
}

export interface RosterPick {
  slot: RosterSlotId;
  kind: CardKind;
  refId: string;
  specialId?: string;
  fromLineupId: string;
}

export type Roster = Partial<Record<RosterSlotId, RosterPick>>;

/** One step of a scripted daily draft (one per pick, in order). */
export interface DraftScriptStep {
  /** The exact lineup to offer for this pick. */
  lineupId: string;
  /** Force a player in that lineup to appear as a specific special card. */
  special?: { playerId: string; specialId: string };
}

export interface DraftState {
  mode: RunMode;
  round: number;
  rerollsLeft: number;
  /** Lineups already shown this run (drawn without replacement). */
  shownLineupIds: string[];
  /** Person ids that can no longer be drafted (players, coaches, subs). */
  takenPersonIds: string[];
  /** Restricted lineup pool (daily challenges). Undefined = full pool. */
  poolLineupIds?: string[];
  /** Multiplier on the special-appearance chance (daily modifier; v1.3 also
   *  carries the rank-scaled chance for classic/quick runs). */
  specialChanceMult?: number;
  /**
   * Rank-gated special rarities that may appear (v1.3). Undefined = no gate (all
   * rarities — used by the daily). An empty array means specials are locked
   * (Unranked). Set from the player's rank in runStore for classic/quick runs.
   */
  specialRarities?: string[];
  /**
   * Daily "scripted" draft (v1.2.1): an exact ordered lineup per pick (index =
   * picks made so far), each optionally forcing a player to appear as a specific
   * special. Lets an authored daily curate the whole draft. A scripted offer that
   * can't fill the remaining slots falls back to a normal draw (see draft.ts).
   * Keyed off picks made (reroll-proof). Undefined = normal random draft.
   */
  scriptedLineups?: DraftScriptStep[];
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
  /** Player nicknames — used for star-of-the-game narration. */
  playerNames: string[];
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
  /** Star of the game (a player nickname from the winning side). */
  starName?: string;
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

/**
 * Playoff rounds in play order. The double-elimination set (classic mode)
 * plus the straight single-elimination set (quick mode).
 */
export type PlayoffRoundName =
  | "ub_quarterfinal"
  | "lb_round1"
  | "ub_semifinal"
  | "lb_round2"
  | "ub_final"
  | "lb_semifinal"
  | "lb_final"
  | "third_place"
  | "grand_final"
  | "quarterfinal"
  | "semifinal"
  | "final";

export interface PlayoffRound {
  name: PlayoffRoundName;
  series: SeriesResult[];
}

export interface PlayoffState {
  format: "double" | "single";
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
  | "third"
  | "fourth"
  | "top4"
  | "top6"
  | "top8"
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
  /** Total goals conceded across the whole run (0 → "Untouchable"). */
  goalsConceded: number;
  unlockedSpecialIds: string[];
  newAchievementIds: string[];
  xp: XpSummary;
  /**
   * The historical lineup that eliminated the user (lost runs only, v0.7.0).
   * Gated by FEATURES.showEliminatorTeam — null when the user is champion or
   * the feature is off. Optional so older persisted runs stay valid.
   */
  eliminatedBy?: EliminatorTeam | null;
}

/** The lineup that knocked the user out, for the results-screen reveal. */
export interface EliminatorTeam {
  lineupId: string;
  name: string;
  /** Stage label, e.g. "Grand Final" / "Swiss Round 5". */
  stage: string;
  /** Final series score, user's wins first. */
  score: [number, number];
}

/** Daily-challenge metadata attached to a run. */
export interface DailyInfo {
  /** ISO date (UTC), e.g. "2026-06-12" — also drives the shared seed. */
  date: string;
  /** Sequential challenge number since launch (#1, #2, …). */
  n: number;
  label: string;
  description: string;
  /** Optional bonus objective evaluated at results time. */
  objective?: DailyObjective;
}

export interface DailyObjective {
  type:
    | "chemistry_good"
    | "chemistry_great"
    | "concede_under"
    | "win_title"
    | "team_overall_under";
  /** Threshold for concede_under (max goals) / team_overall_under (max OVR). */
  value?: number;
  label: string;
  bonusXp: number;
}

/** The whole state of one run. Persisted so a refresh resumes the game. */
export interface RunState {
  runId: string;
  mode: RunMode;
  /** Region-locked run (v1.2.0): e.g. "SAM". Undefined = worldwide (default). */
  regionLock?: Region;
  seed: number;
  /** Mutable RNG cursor — persisted so reloads stay deterministic. */
  rngState: number;
  difficulty: Difficulty;
  /** Effective visibility (already accounts for Hard/Legacy lock). */
  showOverall: boolean;
  phase: RunPhase;
  startedAt: string;
  daily?: DailyInfo;
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
